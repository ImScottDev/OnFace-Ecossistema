/**
 * A tela do lead (/pre-vendas/[id]) lê e grava no MESMO lugar que o board, a
 * ficha da Pessoa e a ficha da Empresa?
 *
 * Mesma pergunta de `smoke-tela-escreve-tela-le.ts`: depois de a ação rodar
 * (pela MESMA função que a server action chama), a leitura que cada tela usa
 * mostra o resultado? Aqui as leituras são `detalheLead` (tela do lead, drawer e
 * Pessoa), `boardPreVendas` (cartão e drawer), `relacoesDaPessoa` (Pessoa) e
 * `empresa360` (Empresa).
 *
 * Cria registros de teste com o prefixo abaixo e apaga TUDO por esse prefixo
 * no fim (e no começo, para limpar o resíduo de uma rodada que morreu).
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-tela-do-lead.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { criarLead, moverEtapa, nutrir } from "@/lib/vendas/pre-vendas";
import { boardPreVendas, detalheLead, empresa360 } from "@/lib/vendas/consultas";
import { relacoesDaPessoa } from "@/lib/vendas/ficha-extras";
import { atorHumano } from "@/lib/vendas/dominio";
import { aquisicaoDaFicha } from "@/components/onface/proto/relacoes-da-ficha";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) process.exitCode = 1;
};

const PREFIXO = "smoke-tela-lead-%";
const marca = `smoke-tela-lead-${Date.now()}`;

async function limpar() {
  const meusLeads = sql`(SELECT id FROM leads WHERE nome LIKE ${PREFIXO})`;
  const minhasPessoas = sql`(SELECT id FROM pessoas WHERE nome LIKE ${PREFIXO})`;
  const minhasEmpresas = sql`(SELECT id FROM empresas WHERE nome LIKE ${PREFIXO})`;
  const meusNegocios = sql`(SELECT id FROM negocios WHERE lead_id IN ${meusLeads} OR empresa_id IN ${minhasEmpresas})`;
  for (const q of [
    sql`DELETE FROM notas WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM entity_labels WHERE entity_type = 'lead' AND entity_id IN ${meusLeads}`,
    sql`DELETE FROM lead_labels WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM contratos WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM atividades WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM tarefas WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM status_changes WHERE lead_id IN ${meusLeads}`,
    sql`DELETE FROM vendas_eventos WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM reunioes WHERE lead_id IN ${meusLeads} OR negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM comercial_evidencia WHERE negocio_id IN ${meusNegocios}`,
    sql`DELETE FROM timeline_events WHERE aquisicao_id IN (SELECT id FROM aquisicoes WHERE lead_legado_id IN ${meusLeads})
         OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM pontos_contato WHERE lead_id_legado IN ${meusLeads} OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM oportunidades WHERE lead_id IN ${meusLeads} OR negocio_id_legado IN ${meusNegocios} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM negocios WHERE lead_id IN ${meusLeads} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM aquisicoes WHERE lead_legado_id IN ${meusLeads} OR pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM event_outbox WHERE payload ->> 'lead_legado_id' IN (SELECT id::text FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM domain_events WHERE payload ->> 'lead_legado_id' IN (SELECT id::text FROM leads WHERE nome LIKE ${PREFIXO})`,
    sql`DELETE FROM pessoa_empresa_vinculos WHERE pessoa_id IN ${minhasPessoas} OR empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM pessoas WHERE nome LIKE ${PREFIXO}`,
    sql`DELETE FROM leads WHERE nome LIKE ${PREFIXO}`,
    sql`UPDATE leads SET empresa_id = NULL WHERE empresa_id IN ${minhasEmpresas}`,
    sql`DELETE FROM empresas WHERE nome LIKE ${PREFIXO}`,
  ]) await db.execute(q).catch((e) => console.warn("  limpeza:", String(e).slice(0, 120)));
  await db.execute(sql`
    DELETE FROM backfill_provenance bp WHERE bp.entidade_canonica = 'aquisicao'
      AND NOT EXISTS (SELECT 1 FROM aquisicoes a WHERE a.id = bp.id_canonico)`).catch(() => undefined);
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [u] = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE ativo = true LIMIT 1`);
  const ator = atorHumano(u.id);
  const novo = async (sufixo: string, nome = `${marca}-${sufixo}`) => (await criarLead({
    organizacaoId: org.id,
    // Uma empresa por lead: a entrada canônica reaproveita a aquisição ABERTA da mesma empresa
    // (`acharAquisicaoAberta`), e o segundo lead dela ficaria sem aquisição própria.
    empresa: { nome: `${marca} Ltda ${sufixo}` },
    pessoa: { nome, email: `${marca}-${sufixo}@teste.local` },
    touchpoint: { tipoOrigem: "organica", source: "smoke" },
    origem: "site", responsavelId: u.id,
  } as never, { tipo: "HUMAN", usuarioId: u.id })).leadId;

  try {
    console.log("\n═══ modelo: pessoa e lead são 1:1, a pessoa entra mais de uma vez ═══");
    const [m] = await db.execute<{ pessoas: number; aq: number; max_aq_por_pessoa: number }>(sql`
      SELECT (SELECT count(*) FROM pessoas WHERE organizacao_id = ${org.id}::uuid)::int AS pessoas,
             (SELECT count(*) FROM aquisicoes WHERE organizacao_id = ${org.id}::uuid)::int AS aq,
             (SELECT coalesce(max(n), 0) FROM (SELECT count(*) n FROM aquisicoes WHERE pessoa_id IS NOT NULL GROUP BY pessoa_id) x)::int AS max_aq_por_pessoa`);
    console.log(`  (informativo) pessoas ${m.pessoas}, aquisições ${m.aq}, máx. de aquisições por pessoa canônica: ${m.max_aq_por_pessoa}`);

    console.log("\n═══ Relações da PESSOA: todas as aquisições dela ═══");
    const a = await novo("a");
    const b = await novo("b");                    // mesma pessoa que A (e-mail igual): entrou duas vezes
    const c = await novo("c");                    // outra pessoa, mesmo telefone da A, outro primeiro nome
    const d = await novo("d", `${marca}-a x`);    // mesmo telefone e primeiro nome da A
    const e = await novo("e");                    // outra pessoa, só a mesma empresa
    await db.execute(sql`UPDATE leads SET email = ${`${marca}-a@teste.local`} WHERE id = ${b}::uuid`);
    await db.execute(sql`UPDATE pessoas SET email = ${`${marca}-a@teste.local`} WHERE lead_id_legado = ${b}::uuid`);
    for (const id of [a, c, d]) await db.execute(sql`UPDATE leads SET telefone = '(11) 98877-6655' WHERE id = ${id}::uuid`);
    await db.execute(sql`UPDATE leads SET nome = ${`${marca}-a`} WHERE id = ${d}::uuid`);
    await db.execute(sql`UPDATE leads SET nome = ${`${marca}-a`} WHERE id = ${a}::uuid`);

    /* Todos na MESMA empresa: é o que a ficha da Empresa lista. */
    const [primeira] = await db.execute<{ id: string }>(sql`SELECT empresa_id::text AS id FROM leads WHERE id = ${a}::uuid`);
    for (const id of [b, c, d, e]) {
      await db.execute(sql`UPDATE leads SET empresa_id = ${primeira.id}::uuid WHERE id = ${id}::uuid`);
      await db.execute(sql`UPDATE aquisicoes SET empresa_id = ${primeira.id}::uuid WHERE lead_legado_id = ${id}::uuid`);
    }

    await nutrir({ organizacaoId: org.id, leadId: b, motivo: "sem_orcamento", retomarEm: "2030-01-15", observacao: "Volta em janeiro", ator });
    await moverEtapa({ organizacaoId: org.id, leadId: a, para: "em_contato", ator });

    const rp = await relacoesDaPessoa(org.id, a);
    const ids = rp.aquisicoes.map((x) => x.id).sort();
    ok(ids.includes(a) && ids.includes(b), "a pessoa vê as DUAS aquisições do mesmo e-mail");
    ok(ids.includes(d), "e a do mesmo telefone + primeiro nome");
    ok(!ids.includes(c), "mas NÃO a de outro nome que só divide o telefone");
    ok(!ids.includes(e), "nem a de outra pessoa da mesma empresa");
    const rb = await relacoesDaPessoa(org.id, b);
    ok(rb.aquisicoes.map((x) => x.id).sort().join() === ids.join(), "visto de qualquer uma das duas, o conjunto é o mesmo (B liga A por e-mail e A liga D por telefone: o fecho)");

    const nutriB = rp.aquisicoes.find((x) => x.id === b);
    ok(nutriB?.etapa === "nutricao", `a nutrição aparece como etapa "${nutriB?.etapa}"`);
    ok(nutriB?.nutricao?.motivo === "sem_orcamento", `com o motivo (${nutriB?.nutricao?.motivo})`);
    ok(Boolean(nutriB?.nutricao?.desde), `e QUANDO entrou (${nutriB?.nutricao?.desde?.slice(0, 10)})`);
    ok(nutriB?.nutricao?.retomarEm?.slice(0, 10) === "2030-01-15", `e a retomada (${nutriB?.nutricao?.retomarEm})`);
    const linha = nutriB && aquisicaoDaFicha({ ...nutriB, pessoa: null });
    ok(linha?.titulo === "Em nutrição: Sem orçamento agora" && /desde \d{2}\/\d{2}\/\d{4}/.test(linha.sub), `a linha do card diz tudo ("${linha?.titulo} | ${linha?.sub}")`);
    ok(rp.aquisicoes.find((x) => x.id === a)?.etapa === "em_contato", "a outra segue na etapa do board (Em contato)");

    console.log("\n═══ Relações da EMPRESA: etapa do board e nutrição com motivo e data ═══");
    const [emp] = await db.execute<{ id: string }>(sql`SELECT empresa_id::text AS id FROM leads WHERE id = ${a}::uuid`);
    const e360 = await empresa360(org.id, emp.id);
    const linhaB = e360?.leads.find((x) => x.id === b);
    const linhaA = e360?.leads.find((x) => x.id === a);
    ok(e360 !== null && e360.leads.length >= 5, `a empresa lista as aquisições (${e360?.leads.length})`);
    ok(linhaB?.etapa === "nutricao" && linhaB.nutricao?.motivo === "sem_orcamento" && Boolean(linhaB.nutricao?.desde),
      `a nutrição chega à empresa com motivo e data (${linhaB?.etapa}, ${linhaB?.nutricao?.motivo}, ${linhaB?.nutricao?.desde?.slice(0, 10)})`);
    ok(linhaA?.etapa === "em_contato", `e a etapa é a do board, não a derivada (${linhaA?.etapa})`);

    console.log("\n═══ as quatro leituras concordam na etapa ═══");
    const board = await boardPreVendas(org.id, { aba: "ativos" });
    const card = Object.values(board.colunas).flatMap((col) => col.cards).find((x) => x.leadId === a);
    const det = await detalheLead(org.id, a);
    ok(card?.etapa === "em_contato" && det?.etapa === "em_contato" && linhaA?.etapa === "em_contato" && rp.aquisicoes.find((x) => x.id === a)?.etapa === "em_contato",
      `board ${card?.etapa} · detalhe ${det?.etapa} · empresa ${linhaA?.etapa} · pessoa ${rp.aquisicoes.find((x) => x.id === a)?.etapa}`);
    const detB = await detalheLead(org.id, b);
    ok(detB?.etapa === "nutricao" && Boolean(detB.nutricao.desde) && detB.nutricao.motivo === "sem_orcamento", `o detalhe da nutrição traz motivo e data (${detB?.nutricao.motivo}, ${detB?.nutricao.desde?.slice(0, 10)})`);
  } finally {
    await limpar();
    const [resto] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM leads WHERE nome LIKE ${PREFIXO}`);
    ok(resto.n === 0, "os registros de teste foram removidos");
  }
}

main().then(() => process.exit()).catch((e) => { console.error(e); process.exit(1); });
