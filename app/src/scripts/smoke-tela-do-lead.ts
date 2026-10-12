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
import { atribuirResponsavel, criarLead, desqualificar, moverEtapa, nutrir, qualificar, salvarQualificacao } from "@/lib/vendas/pre-vendas";
import { boardPreVendas, detalheLead, empresa360 } from "@/lib/vendas/consultas";
import { notasDoLead, relacoesDaPessoa, tarefasDoLead } from "@/lib/vendas/ficha-extras";
import { confirmarEspelho } from "@/lib/vendas/sincronizar-aquisicao";
import { adicionarTag } from "@/lib/crm/tags";
import { bannerDoLead, qualDaTela, qualParaDominio, tilesDeSla } from "@/components/onface/proto/lead-da-tela";
import { qualDoDesenho } from "@/components/onface/proto/qual-do-desenho";
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
    sql`DELETE FROM labels WHERE nome LIKE ${PREFIXO}`,
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

/** Cada edição da tela do lead, lida de volta por TODAS as telas que leem o lead. */
async function persistencia(org: string, usuarioId: string, ator: ReturnType<typeof atorHumano>, leadId: string) {
  console.log("\n═══ editar na tela do lead: o board, o detalhe, a Pessoa e a Empresa leem o mesmo ═══");
  const leituras = async () => {
    const board = await boardPreVendas(org, { aba: "ativos" });
    const card = Object.values(board.colunas).flatMap((c) => c.cards).find((x) => x.leadId === leadId) ?? null;
    const det = await detalheLead(org, leadId);
    const pessoa = (await relacoesDaPessoa(org, leadId)).aquisicoes.find((x) => x.id === leadId) ?? null;
    const e360 = det?.empresa.id ? await empresa360(org, det.empresa.id) : null;
    return { card, det, pessoa, empresa: e360?.leads.find((x) => x.id === leadId) ?? null };
  };

  // 1. Qualificação (interesse, tamanho, dor, fit) — grava como a tela: qualParaDominio + salvarQualificacao.
  await db.execute(sql`UPDATE leads SET qualificacao = jsonb_build_object('observacoes', 'Cliente indicado · Fit Baixo', 'icp', 'ICP A') WHERE id = ${leadId}::uuid`);
  const editado = { interesse: ["PABX", "Callface AI"], tamanho: "42", dor: "Fila longa no suporte", fit: "Alto", observacao: "" };
  const antes = await detalheLead(org, leadId);
  await salvarQualificacao({ organizacaoId: org, leadId, qualificacao: qualParaDominio(editado, antes?.qualificacao?.observacoes), ator });
  let r = await leituras();
  const daTela = qualDaTela(r.det!);
  ok(JSON.stringify(daTela.interesse) === JSON.stringify(editado.interesse) && daTela.tamanho === "42" && daTela.dor === editado.dor && daTela.fit === "Alto",
    `a tela do lead lê o que gravou (${daTela.interesse.join("+")}, ${daTela.tamanho}, "${daTela.dor}", Fit ${daTela.fit})`);
  const doCard = qualDoDesenho(r.card?.qualificacao);
  const doDet = qualDoDesenho(r.det?.qualificacao);
  ok(JSON.stringify(doCard) === JSON.stringify(doDet) && doCard?.tamanho === "42" && doCard?.fit === "Alto",
    "o drawer do board (cartão) e a ficha da Pessoa leem a MESMA qualificação");
  ok(String(r.det?.qualificacao?.observacoes).includes("Cliente indicado") && r.det?.qualificacao?.icp === "ICP A",
    `mudar o Fit preserva a observação e o ICP (observacoes "${r.det?.qualificacao?.observacoes}")`);

  // 2. Responsável.
  const [outro] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${org}::uuid AND ativo = true AND id <> ${usuarioId}::uuid LIMIT 1`);
  if (outro) {
    await atribuirResponsavel({ organizacaoId: org, leadId, responsavelId: outro.id, origemAtribuicao: "manual", ator });
    r = await leituras();
    ok(r.card?.responsavel === outro.nome && r.det?.responsavel.nome === outro.nome && r.pessoa?.responsavel === outro.nome && r.empresa?.responsavel === outro.nome,
      `responsável: cartão "${r.card?.responsavel}" · tela "${r.det?.responsavel.nome}" · Pessoa "${r.pessoa?.responsavel}" · Empresa "${r.empresa?.responsavel}"`);
    ok(await confirmarEspelho(org, leadId, { responsavelId: outro.id }) === null, "e o espelho confirma");
  } else console.log("  (sem segundo usuário ativo: troca de responsável não exercitada)");

  // 3. Tag.
  const [lb] = await db.execute<{ id: string }>(sql`INSERT INTO labels (nome, organizacao_id) VALUES (${marca + " tag"}, ${org}::uuid) RETURNING id::text`);
  const t = await adicionarTag({ organizacaoId: org, entityType: "lead", entityId: leadId, label: lb.id, atorId: usuarioId });
  r = await leituras();
  ok(t.ok && r.card?.tag === `${marca} tag` && r.det?.tags.some((x) => x.nome === `${marca} tag`), `tag: cartão "${r.card?.tag}" · tela ${JSON.stringify(r.det?.tags.map((x) => x.nome))}`);

  // 4. Próxima ação (a Task real) — o mesmo INSERT de acaoCriarTarefa.
  const venceEm = new Date(Date.now() + 3 * 86_400_000);
  await db.execute(sql`
    INSERT INTO tarefas (organizacao_id, lead_id, usuario_id, titulo, descricao, tipo, prioridade, vence_em, data_vencimento, origem)
    VALUES (${org}::uuid, ${leadId}::uuid, ${usuarioId}::uuid, ${marca + " ligar"}, null, 'tarefa', 'media',
            ${venceEm.toISOString()}::timestamptz, ${venceEm.toISOString()}::date, 'MANUAL')`);
  r = await leituras();
  const tarefas = await tarefasDoLead(org, leadId);
  ok(r.card?.proximaAcao?.titulo === `${marca} ligar` && r.det?.proximaAcao?.titulo === `${marca} ligar` && tarefas[0]?.titulo === `${marca} ligar`,
    `próxima ação: cartão "${r.card?.proximaAcao?.titulo}" · tela "${r.det?.proximaAcao?.titulo}" · atividades "${tarefas[0]?.titulo}"`);

  // 5. Nota (a mesma tabela que /api/notas grava e a Pessoa lê).
  await db.execute(sql`INSERT INTO notas (organizacao_id, lead_id, conteudo, autor_id) VALUES (${org}::uuid, ${leadId}::uuid, ${marca + " nota @alguém"}, ${usuarioId}::uuid)`);
  const notas = await notasDoLead(org, leadId);
  ok(notas[0]?.texto === `${marca} nota @alguém`, "nota: a tela do lead lê o que /api/notas grava");

  console.log("\n═══ saídas: nutrir, desqualificar, reativar — o board confirma cada uma ═══");
  await nutrir({ organizacaoId: org, leadId, motivo: "timing", retomarEm: "2030-02-01", observacao: "Q1", ator });
  r = await leituras();
  ok(r.card === null && r.det?.etapa === "nutricao" && r.pessoa?.etapa === "nutricao" && r.empresa?.etapa === "nutricao", "nutrir: sai dos ativos e as telas leem Nutrição");
  const banner = bannerDoLead(r.det!);
  ok(banner?.acao === "reativar" && /Timing inadequado/.test(banner.titulo) && /retomar em 01\/02\/2030/.test(banner.sub), `banner de nutrição: "${banner?.titulo}" | ${banner?.sub}`);
  ok(await confirmarEspelho(org, leadId, { etapa: "nutricao" }) === null, "o espelho confirma a nutrição");

  await desqualificar({ organizacaoId: org, leadId, motivo: "sem_fit", detalhe: "Só revende", ator });
  r = await leituras();
  const bd = bannerDoLead(r.det!);
  ok(r.det?.etapa === "desqualificado" && r.pessoa?.etapa === "desqualificado" && bd?.acaoLabel === "Reativar" && /Empresa sem fit/.test(bd.titulo), `desqualificar com motivo: "${bd?.titulo}"`);
  ok(await confirmarEspelho(org, leadId, { etapa: "desqualificado" }) === null, "o espelho confirma a desqualificação");

  await moverEtapa({ organizacaoId: org, leadId, para: "em_contato", ator, motivo: "Lead retomado" });
  r = await leituras();
  ok(r.card?.etapa === "em_contato" && r.det?.etapa === "em_contato" && bannerDoLead(r.det!) === null, "reativar: volta ao board em Em contato, sem banner");
  ok(r.det?.desqualificacao.motivo === null, `e limpa a desqualificação (motivo ${r.det?.desqualificacao.motivo})`);
  const tiles = tilesDeSla(r.det!, null);
  ok(tiles.length === 4 && tiles[0].label === "Na etapa", "a faixa de SLA monta com o dado real");

  console.log("\n═══ falha visível: o espelho que não acompanha NÃO passa em silêncio ═══");
  const [aq] = await db.execute<{ id: string; pipeline_id: string }>(sql`SELECT id::text, pipeline_id::text FROM aquisicoes WHERE lead_legado_id = ${leadId}::uuid`);
  const [novoEtapa] = await db.execute<{ id: string; atual: string }>(sql`
    SELECT (SELECT id::text FROM pipeline_etapas WHERE pipeline_id = ${aq.pipeline_id}::uuid AND codigo = 'novo' LIMIT 1) AS id,
           (SELECT etapa_id::text FROM aquisicoes WHERE id = ${aq.id}::uuid) AS atual`);
  if (novoEtapa.id) {
    await db.execute(sql`UPDATE aquisicoes SET etapa_id = ${novoEtapa.id}::uuid WHERE id = ${aq.id}::uuid`);   // o espelho "falhou"
    const aviso = await confirmarEspelho(org, leadId, { etapa: "em_contato" });
    ok(Boolean(aviso) && /board ainda não reflete/.test(aviso ?? ""), `divergência devolve aviso para a tela ("${aviso?.slice(0, 60)}…")`);
    await db.execute(sql`UPDATE aquisicoes SET etapa_id = ${novoEtapa.atual}::uuid WHERE id = ${aq.id}::uuid`);
    ok(await confirmarEspelho(org, leadId, { etapa: "em_contato" }) === null, "restaurado, o espelho volta a confirmar");
  } else console.log("  (pipeline sem etapa 'novo': divergência não exercitada)");
  await qualificar({ organizacaoId: org, leadId, ator });
  ok(await confirmarEspelho(org, leadId, { etapa: "qualificado" }) === null, "qualificar: o espelho confirma Qualificado");
}

async function main() {
  await limpar();
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const [u] = await db.execute<{ id: string }>(sql`SELECT id::text FROM usuarios WHERE ativo = true LIMIT 1`);
  const ator = atorHumano(u.id);
  const novo = async (sufixo: string, nome = `${marca}-${sufixo}`) => (await criarLead({
    organizacaoId: org.id,
    // Uma empresa por lead só para isolar os cenários; a entrada canônica reaproveita a aquisição
    // aberta apenas da MESMA pessoa (`acharAquisicaoAberta`), então duas pessoas na mesma empresa
    // também têm um cartão cada.
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

    console.log("\n═══ aquisição é por PESSOA: duas pessoas da mesma empresa = dois cartões ═══");
    const mesmaEmpresa = `${marca} Ltda mesma`;
    const entrada = (sufixo: string) => ({
      organizacaoId: org.id, empresa: { nome: mesmaEmpresa },
      pessoa: { nome: `${marca}-${sufixo}`, email: `${marca}-${sufixo}@teste.local` },
      touchpoint: { tipoOrigem: "organica", source: "smoke" }, origem: "site", responsavelId: u.id,
    });
    const p1 = await criarLead(entrada("p1") as never, { tipo: "HUMAN", usuarioId: u.id });
    const p2 = await criarLead(entrada("p2") as never, { tipo: "HUMAN", usuarioId: u.id });
    ok(p1.leadId !== p2.leadId && p1.empresaId === p2.empresaId, "dois leads, a mesma empresa");
    const [aqs] = await db.execute<{ n: number; distintas: number }>(sql`
      SELECT count(*)::int AS n, count(DISTINCT lead_legado_id)::int AS distintas FROM aquisicoes
       WHERE lead_legado_id IN (${p1.leadId}::uuid, ${p2.leadId}::uuid) AND closed_at IS NULL`);
    ok(aqs.n === 2 && aqs.distintas === 2, `cada pessoa tem a sua aquisição aberta (${aqs.n})`);
    const quadro = await boardPreVendas(org.id, { aba: "ativos" });
    const cartoes = Object.values(quadro.colunas).flatMap((col) => col.cards).filter((x) => x.leadId === p1.leadId || x.leadId === p2.leadId);
    ok(cartoes.length === 2, `o board mostra os dois cartões (${cartoes.length})`);
    const repetida = await criarLead(entrada("p1") as never, { tipo: "HUMAN", usuarioId: u.id });
    const [aqs2] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM aquisicoes WHERE pessoa_id = (SELECT id FROM pessoas WHERE lead_id_legado = ${p1.leadId}::uuid) AND closed_at IS NULL`);
    ok(repetida.leadId === p1.leadId && aqs2.n === 1, "a MESMA pessoa entrando de novo devolve o mesmo lead e não abre segunda aquisição");

    console.log("\n═══ sair da nutrição encerra a tarefa de retomada ═══");
    const tarefaRetomada = async (id: string) => (await db.execute<{ status: string; concluida: boolean }>(sql`
      SELECT status, concluida FROM tarefas WHERE lead_id = ${id}::uuid AND titulo = 'Retomar lead em nutrição'`));
    await nutrir({ organizacaoId: org.id, leadId: p1.leadId, motivo: "sem_orcamento", retomarEm: "2030-02-01", ator });
    ok((await tarefaRetomada(p1.leadId))[0]?.status === "a_fazer", "nutrir com data cria a tarefa de retomada aberta");
    let vis = await boardPreVendas(org.id, { aba: "nutricao" });
    ok(Object.values(vis.colunas).flatMap((col) => col.cards).some((x) => x.leadId === p1.leadId), "o lead aparece na aba Nutrição");
    await moverEtapa({ organizacaoId: org.id, leadId: p1.leadId, para: "em_contato", ator });
    const t = (await tarefaRetomada(p1.leadId))[0];
    ok(t?.status === "concluida" && t.concluida === true, `reativar conclui a retomada (${t?.status}, concluida=${t?.concluida})`);
    const dl = await detalheLead(org.id, p1.leadId);
    ok(dl?.proximaAcao?.titulo !== "Retomar lead em nutrição", `a retomada não é mais a próxima ação (${dl?.proximaAcao?.titulo ?? "sem próxima ação"})`);
    vis = await boardPreVendas(org.id, { aba: "ativos" });
    const cartao = Object.values(vis.colunas).flatMap((col) => col.cards).find((x) => x.leadId === p1.leadId);
    ok(cartao?.proximaAcao?.titulo !== "Retomar lead em nutrição", "nem no cartão do board");
    await nutrir({ organizacaoId: org.id, leadId: p2.leadId, motivo: "sem_orcamento", retomarEm: "2030-02-01", ator });
    await qualificar({ organizacaoId: org.id, leadId: p2.leadId, ator });
    ok((await tarefaRetomada(p2.leadId))[0]?.status === "concluida", "qualificar a partir da nutrição também conclui a retomada");

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

    await persistencia(org.id, u.id, ator, a);
  } finally {
    await limpar();
    const [resto] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM leads WHERE nome LIKE ${PREFIXO}`);
    ok(resto.n === 0, "os registros de teste foram removidos");
  }
}

main().then(() => process.exit()).catch((e) => { console.error(e); process.exit(1); });
