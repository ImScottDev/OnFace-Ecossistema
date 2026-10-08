/**
 * Prova, contra o banco LOCAL, as duas promessas do editor de proposta:
 *
 *  1. Quem assina (cliente + Callface) é GRAVADO em propostas.signatarios, congelado no
 *     envio, copiado para contratos.signatarios, e o Documenso recebe os destinatários
 *     certos, com campo de assinatura em cada bloco do PDF.
 *  2. O que se preenche em "Dados do contrato" vai para a EMPRESA e o CONTATO; reler pela
 *     consulta da tela devolve; OUTRA proposta da mesma empresa já vem preenchida; o
 *     contrato gerado usa esses dados.
 *
 * Escreve e relê pelas MESMAS funções que a tela usa (lerPropostasDoNegocio,
 * lerDadosDoContrato, editorDeSignatarios). Cria registros "[QA]" e apaga no fim.
 *
 *   cd app && npx tsx --env-file=.env src/scripts/verificar-signatarios-e-dados-contrato.ts
 *
 * Recusa rodar se o DATABASE_URL não for localhost.
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { empresas, leads, negocios, pipelines, usuarios, propostas, contratos, propostaGrupoComercial, organizacoes } from "@/lib/db/schema";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { formarGruposComerciais } from "@/lib/crm/grupo-comercial";
import { gerarContratoDeTemplate } from "@/lib/crm/contrato-template";
import { contratoPdfHtml, renderContratoPdf, localizarAncoras } from "@/lib/crm/contrato-pdf";
import { montarDestinatarios } from "@/lib/crm/signature/documenso-provider";
import {
  comPadraoDaPolitica, editorDeSignatarios, juntarEndereco, normalizarSignatarios,
} from "@/lib/crm/proposta-signatarios";
import * as vendas from "@/lib/vendas/propostas";
import { atorHumano } from "@/lib/vendas/dominio";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL não é local: recusado.");
  process.exit(2);
}

let falhas = 0;
const ok = (cond: unknown, msg: string, det = "") => {
  console.log(`  ${cond ? "OK   " : "FALHA"} ${msg}${det ? ` — ${det}` : ""}`);
  if (!cond) falhas++;
};

async function main() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  const [user] = await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email }).from(usuarios).where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.ativo, true))).limit(1);
  const [pipeline] = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.organizacaoId, org.id)).limit(1);
  const ator = atorHumano(user.id);
  const suf = Date.now().toString(36);
  const mail = `qa-${suf}@cliente.local`;

  // Empresa SEM dados jurídicos e um contato sem CPF: o modal é quem vai preenchê-los.
  const [empresa] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `[QA] Dados contrato ${suf}` } as never).returning({ id: empresas.id });
  const [lead] = await db.insert(leads).values({
    organizacaoId: org.id, nome: "[QA] Signatária", sobrenome: suf, email: mail, empresaId: empresa.id,
    empresa: `[QA] Dados contrato ${suf}`, status: "qualified", origem: "teste_local",
  }).returning({ id: leads.id });
  const [neg] = await db.insert(negocios).values({
    organizacaoId: org.id, leadId: lead.id, empresaId: empresa.id, pipelineId: pipeline.id, responsavelId: user.id,
    titulo: `[QA] Dados contrato ${suf}`, status: "proposta_enviada", serviceFamily: "PABX",
  } as never).returning({ id: negocios.id });
  await syncOportunidadeFromNegocio(neg.id);
  const novaProposta = async () => (await criarPropostaComItens({
    organizacaoId: org.id, leadId: lead.id, negocioId: neg.id, moeda: "BRL", prazoContratoMeses: 12,
    itens: [{ nome: "PABX [QA] ramais", descricao: "PABX em nuvem", tipo: "recorrente", quantidade: 5, valorUnitario: 49.9, desconto: 0, descontoTipo: "valor" }],
    criadoPorId: user.id,
  } as never)).id as string;

  try {
    console.log("\n1. Dados do contrato: escreve pela porta, relê pela consulta da tela");
    const r1 = await vendas.salvarDadosDoContrato({
      organizacaoId: org.id, empresaId: empresa.id, ator,
      empresa: { razao: `[QA] Dados ${suf} LTDA`, cnpj: "11.222.333/0001-81", rua: "Av. Paulista, 1000, Sala 4", bairro: "Bela Vista", cep: "01310-100", cidade: "São Paulo", uf: "sp" },
      pessoa: { nome: `[QA] Signatária ${suf}`, cargo: "Diretora", email: mail, telefone: "11999990000", cpf: "123.456.789-09" },
    });
    ok(r1.pessoaSalva, "pessoa do signatário gravada", String(r1.pessoaId));
    const lido = await vendas.lerDadosDoContrato(org.id, empresa.id);
    const e = lido.empresaDados!;
    ok(e.razao === `[QA] Dados ${suf} LTDA` && e.cnpj === "11.222.333/0001-81", "razão social e CNPJ voltam da Empresa");
    ok(e.rua === "Av. Paulista, 1000, Sala 4" && e.bairro === "Bela Vista" && e.cep === "01310-100" && e.cidadeCob === "São Paulo" && e.uf === "SP", "endereço volta inteiro (rua, número e complemento num campo só)", e.rua);
    const [col] = await db.execute<Record<string, string>>(sql`SELECT logradouro, numero, complemento FROM empresas WHERE id = ${empresa.id}::uuid`);
    ok(col.logradouro === "Av. Paulista" && col.numero === "1000" && col.complemento === "Sala 4", "nas colunas da empresa: logradouro, número e complemento separados");
    const jur = await vendas.conferirDadosJuridicos(org.id, empresa.id);
    ok(jur.completo, "o gate de dados jurídicos do envio enxerga o que o modal gravou", jur.faltando.join(", "));
    const sig = lido.contatos.find((c) => c.email === mail);
    ok(sig && sig.cargo === "Diretora" && sig.telefone === "11999990000" && sig.cpf === "123.456.789-09", "contato volta com cargo, telefone e CPF", JSON.stringify(sig));
    const [dupe] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM pessoas WHERE organizacao_id = ${org.id}::uuid AND lower(email) = ${mail}`);
    ok(dupe.n === 1, "uma pessoa só (sem duplicar ao regravar)");
    // Mudança parcial: só o cargo. O resto fica.
    await vendas.salvarDadosDoContrato({ organizacaoId: org.id, empresaId: empresa.id, ator, pessoa: { nome: `[QA] Signatária ${suf}`, pessoaId: r1.pessoaId, cargo: "CEO" } });
    const l2 = await vendas.lerDadosDoContrato(org.id, empresa.id);
    ok(l2.contatos.find((c) => c.email === mail)?.cargo === "CEO" && l2.contatos.find((c) => c.email === mail)?.cpf === "123.456.789-09", "mudar só o cargo não apaga o CPF");

    console.log("\n2. Proposta A: signatários dos dois lados gravados, editor relido como a tela relê");
    const A = await novaProposta();
    const lista = [
      { nome: `[QA] Signatária ${suf}`, email: mail, papel: "contratante", cargo: "CEO", cpf: "123.456.789-09" },
      { nome: "Vendedor QA", email: "vendedor.qa@callface.local", papel: "testemunha_vendedor" },
      { nome: "Rep Legal QA", email: "", papel: "representante_legal" }, // sem e-mail: Ajustes é o padrão
      { nome: "Segunda Testemunha", email: "email@callface.ai", papel: "testemunha_2" }, // placeholder nunca vale
    ];
    await vendas.salvarEditorDaProposta({ organizacaoId: org.id, propostaId: A, signatarios: lista, editor: { sigs: [{ nome: "x", email: mail }], ct: { prazo: "24", multa: "20", aviso: "60" }, testemunhas: true } });
    const rowsA = await vendas.lerPropostasDoNegocio(org.id, neg.id);
    const a = rowsA.find((p) => p.id === A)!;
    const sA = normalizarSignatarios(a.signatarios);
    ok(sA.map((s) => s.papel).join() === "contratante,representante_legal,testemunha_vendedor,testemunha_2", "papéis gravados em propostas.signatarios", sA.map((s) => s.papel).join());
    ok(sA.find((s) => s.papel === "testemunha_2")?.email === "", "email@callface.ai não passa como e-mail real");
    const ed = editorDeSignatarios(a.signatarios);
    ok(ed.sigs?.[0].email === mail && ed.sigCf?.rep.nome === "Rep Legal QA" && ed.sigCf?.vend.email === "vendedor.qa@callface.local" && ed.testemunhas === true, "a tela reconstrói 'Assinam pelo cliente' e 'pela Callface' do que foi gravado");
    ok((a.editor as { ct?: { multa?: string } })?.ct?.multa === "20", "editor (condições do contrato) volta");

    console.log("\n3. Envio: bloqueia sem e-mail do representante; padrão de Ajustes só quando a proposta não traz");
    const antes = { u: process.env.DOCUMENSO_API_URL, t: process.env.DOCUMENSO_API_TOKEN };
    process.env.DOCUMENSO_API_URL = "http://documenso.invalido.local/api/v2"; process.env.DOCUMENSO_API_TOKEN = "x";
    const envio = { organizacaoId: org.id, propostaId: A, modoFechamento: "CONTRACT" as const, validadeDias: 14, tipoContratual: "NOVO_CONTRATO" as const, ator };
    let msg = "";
    await vendas.enviarProposta(envio).catch((err) => { msg = String(err.message); });
    ok(/representante legal/i.test(msg), "sem e-mail do representante (proposta nem Ajustes) o envio para com mensagem clara", msg);
    const [st] = await db.select({ status: propostas.status }).from(propostas).where(eq(propostas.id, A));
    ok(st.status === "rascunho", "e a proposta continua rascunho (nada saiu)");
    // Representante informado na proposta, com e-mail
    await vendas.salvarEditorDaProposta({ organizacaoId: org.id, propostaId: A, signatarios: lista.map((s) => s.papel === "representante_legal" ? { ...s, email: "rep.qa@callface.local" } : s) });
    await vendas.enviarProposta(envio);
    const [env] = await db.select({ status: propostas.status, sig: propostas.signatarios }).from(propostas).where(eq(propostas.id, A));
    const congel = normalizarSignatarios(env.sig);
    ok(env.status === "enviada" && congel.find((s) => s.papel === "representante_legal")?.email === "rep.qa@callface.local", "a proposta enviada leva o representante informado nela (a proposta ganha)");
    // Padrão de Ajustes: valor padrão quando a proposta não traz
    const padrao = comPadraoDaPolitica(normalizarSignatarios(lista), { representanteNome: "Diretor Padrão", representanteEmail: "diretor@callface.local" });
    ok(padrao.find((s) => s.papel === "representante_legal")?.email === "diretor@callface.local", "padrão de Ajustes > Contratos entra quando a proposta não traz e-mail");
    if (antes.u === undefined) delete process.env.DOCUMENSO_API_URL; else process.env.DOCUMENSO_API_URL = antes.u;
    if (antes.t === undefined) delete process.env.DOCUMENSO_API_TOKEN; else process.env.DOCUMENSO_API_TOKEN = antes.t;

    console.log("\n4. Contrato gerado: signatários congelados e dados do modal nas variáveis");
    const grupos = await formarGruposComerciais(A);
    const g = grupos.find((x) => !x.contratoId) ?? grupos[0];
    const { contratoId } = await gerarContratoDeTemplate(g.id);
    const [ct] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
    const sC = normalizarSignatarios(ct.signatarios);
    ok(JSON.stringify(sC.map((s) => [s.papel, s.email])) === JSON.stringify(congel.map((s) => [s.papel, s.email])), "contratos.signatarios = os congelados da proposta", sC.map((s) => s.papel).join());
    const v = ct.variaveisPreenchidas as Record<string, string>;
    ok(v.empresa_razao_social === `[QA] Dados ${suf} LTDA` && v.empresa_cnpj === "11.222.333/0001-81" && v.empresa_cep === "01310-100", "contrato usa razão social, CNPJ e CEP gravados pelo modal", v.empresa_razao_social);
    ok(v.empresa_endereco.includes("Av. Paulista") && v.empresa_endereco.includes("1000"), "endereço do contrato vem da Empresa", v.empresa_endereco);
    ok(v.pessoa_nome.includes("Signatária") && v.pessoa_cargo === "CEO" && v.pessoa_cpf === "123.456.789-09", "signatário do contrato: nome, cargo e CPF do contato", `${v.pessoa_cargo} ${v.pessoa_cpf}`);
    ok(v.testemunha_1_nome === "Vendedor QA" && v.testemunha_2_nome === "Segunda Testemunha", "testemunhas impressas no contrato");
    ok(v.percentual_multa === "20%" && v.prazo_meses === "12", "multa digitada na proposta vale no contrato", `${v.percentual_multa} / prazo ${v.prazo_meses}`);
    ok(!/\{\{\w+\}\}/.test(ct.corpoGerado ?? ""), "corpo do contrato sem variável sobrando");

    console.log("\n5. Documenso: destinatários e campos nos blocos certos do PDF");
    const pdf = await renderContratoPdf(contratoPdfHtml({ corpoGerado: ct.corpoGerado, numero: v.contrato_numero }), v.contrato_numero);
    const ancoras = localizarAncoras(pdf);
    ok(["cf-sig-contratante", "cf-sig-contratada", "cf-sig-testemunha-1", "cf-sig-testemunha-2"].every((n) => ancoras[n]), "as 4 âncoras estão no PDF", Object.keys(ancoras).join(", "));
    const dest = montarDestinatarios(sC, ancoras) as Array<{ email: string; name: string; signingOrder: number; fields: Array<{ page: number; positionY: number }> }>;
    ok(dest.length === 3, "3 destinatários: cliente, representante, testemunha vendedor (testemunha 2 sem e-mail não assina)", dest.map((d) => d.email).join(", "));
    ok(dest[0].email === mail && dest[1].email === "rep.qa@callface.local" && dest[2].email === "vendedor.qa@callface.local", "ordem: cliente, representante legal, testemunha");
    ok(dest.every((d) => d.fields.length === 1), "um campo de assinatura por destinatário");
    ok(dest[1].fields[0].positionY === (ancoras["cf-sig-contratada"].y) && dest[2].fields[0].positionY === (ancoras["cf-sig-testemunha-1"].y), "campos caem em cf-sig-contratada e cf-sig-testemunha-1");
    let semRep = ""; try { montarDestinatarios(normalizarSignatarios(lista), ancoras); } catch (err) { semRep = (err as Error).message; }
    ok(/representante legal/i.test(semRep), "o provedor também recusa sem e-mail do representante", semRep);

    console.log("\n6. OUTRA proposta da mesma empresa já vem preenchida");
    const B = await novaProposta();
    const lerB = await vendas.lerDadosDoContrato(org.id, empresa.id); // é o que a tela roda ao abrir qualquer proposta
    ok(!!B && lerB.empresaDados?.razao === `[QA] Dados ${suf} LTDA` && lerB.empresaDados?.rua === "Av. Paulista, 1000, Sala 4" && lerB.contatos.some((c) => c.cpf === "123.456.789-09"), "empresa e contato preenchidos na proposta B sem digitar nada");
    ok(juntarEndereco({ logradouro: "a", numero: "1" }) === "a, 1", "(junção de endereço)");

    console.log("\n7. Revisão copia o editor");
    // A foi enviada: revisão nova copia signatários e editor
    const rev = await vendas.criarRevisao({ organizacaoId: org.id, propostaId: A, ator });
    const [rv] = await db.execute<{ editor: unknown; signatarios: unknown }>(sql`SELECT editor, signatarios FROM propostas WHERE id = ${rev.propostaId}::uuid`);
    ok(normalizarSignatarios(rv.signatarios).length === 4 && (rv.editor as { ct?: { multa?: string } })?.ct?.multa === "20", "a nova versão nasce com os signatários e o editor da anterior");
  } finally {
    // Limpeza dos registros [QA] (ordem das FKs).
    const props = (await db.execute<{ id: string }>(sql`SELECT id::text FROM propostas WHERE negocio_id = ${neg.id}::uuid`)).map((p) => p.id);
    const ctIds = (await db.execute<{ id: string }>(sql`SELECT id::text FROM contratos WHERE negocio_id = ${neg.id}::uuid`)).map((c) => c.id);
    const tentar = async (rotulo: string, q: ReturnType<typeof sql>) => { try { await db.execute(q); } catch (err) { console.log(`  (limpeza ${rotulo}: ${(err as Error).message.slice(0, 90)})`); } };
    if (props.length) {
      await tentar("oportunidade_itens", sql`DELETE FROM oportunidade_itens WHERE oportunidade_id IN (SELECT id FROM oportunidades WHERE negocio_id_legado = ${neg.id}::uuid)`);
      await tentar("contrato fk", sql`UPDATE propostas SET contrato_id = NULL WHERE negocio_id = ${neg.id}::uuid`);
      await tentar("grupo fk", sql`UPDATE proposta_grupo_comercial SET contrato_id = NULL WHERE proposta_id IN (${sql.join(props.map((i) => sql`${i}::uuid`), sql`, `)})`);
      if (ctIds.length) await tentar("contratos", sql`DELETE FROM contratos WHERE negocio_id = ${neg.id}::uuid`);
      await tentar("grupo itens", sql`DELETE FROM proposta_grupo_comercial_itens WHERE grupo_id IN (SELECT id FROM proposta_grupo_comercial WHERE proposta_id IN (${sql.join(props.map((i) => sql`${i}::uuid`), sql`, `)}))`);
      await tentar("grupos", sql`DELETE FROM proposta_grupo_comercial WHERE proposta_id IN (${sql.join(props.map((i) => sql`${i}::uuid`), sql`, `)})`);
      await tentar("itens", sql`DELETE FROM proposta_itens WHERE proposta_id IN (${sql.join(props.map((i) => sql`${i}::uuid`), sql`, `)})`);
      await tentar("propostas", sql`DELETE FROM propostas WHERE negocio_id = ${neg.id}::uuid`);
    }
    // Quem ainda aponta para os [QA]: apaga a referência (um nível) antes da linha.
    const referencias = async (tabela: string, id: string) => {
      const fks = await db.execute<{ t: string; c: string }>(sql`
        SELECT c.conrelid::regclass::text AS t, a.attname AS c FROM pg_constraint c
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
         WHERE c.contype = 'f' AND c.confrelid = ${tabela}::regclass`);
      for (const fk of fks) await tentar(`${fk.t}.${fk.c}`, sql.raw(`DELETE FROM ${fk.t} WHERE ${fk.c} = '${id}'`));
    };
    await tentar("eventos", sql`DELETE FROM event_outbox WHERE aggregate_id IN (${sql.join([neg.id, lead.id, ...props].map((i) => sql`${i}::uuid`), sql`, `)})`);
    const ops = await db.execute<{ id: string }>(sql`SELECT id::text FROM oportunidades WHERE negocio_id_legado = ${neg.id}::uuid`);
    for (const o of ops) { await referencias("oportunidades", o.id); await tentar("oportunidade", sql`DELETE FROM oportunidades WHERE id = ${o.id}::uuid`); }
    await referencias("negocios", neg.id);
    await tentar("negocio", sql`DELETE FROM negocios WHERE id = ${neg.id}::uuid`);
    const pes = await db.execute<{ id: string }>(sql`SELECT id::text FROM pessoas WHERE empresa_id = ${empresa.id}::uuid`);
    for (const p of pes) { await referencias("pessoas", p.id); await tentar("pessoa", sql`DELETE FROM pessoas WHERE id = ${p.id}::uuid`); }
    await referencias("leads", lead.id);
    await tentar("lead", sql`DELETE FROM leads WHERE id = ${lead.id}::uuid`);
    await referencias("empresas", empresa.id);
    await tentar("empresa", sql`DELETE FROM empresas WHERE id = ${empresa.id}::uuid`);
  }
}

main()
  .catch((err) => { console.error(err); falhas++; })
  .finally(async () => {
    await fecharConexao().catch(() => {});
    console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
    process.exit(falhas ? 1 : 0);
  });
