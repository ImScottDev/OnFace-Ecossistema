/**
 * A automação move etapa pela porta canônica, e a tela enxerga (SPEC §16).
 *
 * `crm_update_stage` escrevia na tabela por conta própria. Para lead, escrevia
 * em `leads.crm2_pre_vendas_stage`, coluna com **zero linhas preenchidas em
 * todo o banco** e que nenhuma leitura consulta: a automação movia a etapa,
 * reportava sucesso e nada acontecia. Para negócio, escrevia `negocios.status`
 * sem chamar o espelho, e o board de pipeline, que lê `oportunidades`,
 * continuava na etapa antiga.
 *
 * Não há automação ativa hoje, então isso nunca queimou ninguém. Queimaria na
 * primeira que alguém ligasse, em silêncio.
 *
 * Roda a ação de verdade, sobre entidades sintéticas.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-automacao-etapa.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { executarAcaoAvulsa } from "@/lib/cadencia/cadence-engine";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

const criados: Array<[string, string]> = [];

async function limpar() {
  const lead = criados.find(([t]) => t === "leads")?.[1];
  const neg = criados.find(([t]) => t === "negocios")?.[1];
  for (const [tabela, coluna, alvo] of [
    ["status_changes", "lead_id", lead], ["status_changes", "negocio_id", neg],
    ["vendas_eventos", "lead_id", lead], ["vendas_eventos", "negocio_id", neg],
    ["eventos_comerciais", "negocio_id", neg],
    ["atividades", "lead_id", lead], ["atividades", "negocio_id", neg],
    ["tarefas", "lead_id", lead], ["tarefas", "negocio_id", neg],
    ["aquisicoes", "lead_legado_id", lead],
    ["timeline_events", "pessoa_id", criados.find(([t]) => t === "pessoas")?.[1]],
    ["oportunidades", "negocio_id_legado", neg],
  ] as Array<[string, string, string | undefined]>) {
    if (!alvo) continue;
    await db.execute(sql.raw(`DELETE FROM ${tabela} WHERE ${coluna} = '${alvo}'::uuid`)).catch(() => undefined);
  }
  for (const id of [lead, neg].filter(Boolean)) {
    await db.execute(sql`DELETE FROM event_outbox WHERE aggregate_id::text = ${id}`).catch(() => undefined);
    await db.execute(sql`DELETE FROM domain_events WHERE aggregate_id::text = ${id}`).catch(() => undefined);
  }
  for (const [tabela, id] of [...criados].reverse()) {
    await db.execute(sql.raw(`DELETE FROM ${tabela} WHERE id = '${id}'::uuid`)).catch(() => undefined);
  }
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);
  const marca = `smoke-automacao-${Date.now()}`;
  console.log(`\norganização: ${org.id}\n`);

  // ── Lead: a etapa tem que sair da coluna morta e chegar na aquisição ────
  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, email, estagio_pre_vendas)
    VALUES (${org.id}::uuid, ${marca}, ${marca + "@teste.local"}, 'novo')
    RETURNING id::text`);
  criados.push(["leads", lead.id]);

  // `ck_aquisicoes_tem_identidade` exige empresa ou pessoa: aquisição sem
  // identidade não é aquisição de ninguém. A constraint está certa, o smoke é
  // que precisa respeitar o modelo em vez de contorná-lo.
  const [pessoa] = await db.execute<{ id: string }>(sql`
    INSERT INTO pessoas (organizacao_id, nome, email)
    VALUES (${org.id}::uuid, ${marca}, ${marca + "@teste.local"})
    RETURNING id::text`);
  criados.push(["pessoas", pessoa.id]);

  await db.execute(sql`
    INSERT INTO aquisicoes (organizacao_id, lead_legado_id, pessoa_id, tipo, origem)
    VALUES (${org.id}::uuid, ${lead.id}::uuid, ${pessoa.id}::uuid, 'INBOUND', 'smoke')`);

  const r1 = await executarAcaoAvulsa("crm_update_stage", {
    organizacaoId: org.id, entityType: "lead", entityId: lead.id,
    config: { stage: "em_contato" }, vars: {},
  } as never);
  ok(r1.sucesso, `mover etapa do lead pela automação (${r1.sucesso ? "ok" : r1.erro})`);

  const [depoisLead] = await db.execute<{ estagio: string | null; morta: string | null }>(sql`
    SELECT estagio_pre_vendas AS estagio, crm2_pre_vendas_stage AS morta
      FROM leads WHERE id = ${lead.id}::uuid`);
  ok(depoisLead.estagio === "em_contato",
     `a etapa foi para a coluna que o produto lê (${depoisLead.estagio})`);
  ok(depoisLead.morta === null,
     `e NÃO para a coluna morta (${depoisLead.morta ?? "nula, como deve"})`);

  const [aq] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM aquisicoes
     WHERE lead_legado_id = ${lead.id}::uuid AND updated_at > now() - interval '1 minute'`);
  ok(aq.n === 1, "a aquisição canônica foi sincronizada pela ação");

  // A porta recusa o que exige comando próprio, em vez de mover em silêncio.
  const r2 = await executarAcaoAvulsa("crm_update_stage", {
    organizacaoId: org.id, entityType: "lead", entityId: lead.id,
    config: { stage: "qualificado" }, vars: {},
  } as never);
  ok(!r2.sucesso, "qualificar por 'mover etapa' é recusado: qualificação é um fato, não posição");
  ok(String(r2.erro ?? "").length > 10, `e a recusa explica ("${String(r2.erro ?? "").slice(0, 60)}")`);

  const r3 = await executarAcaoAvulsa("crm_update_stage", {
    organizacaoId: org.id, entityType: "lead", entityId: lead.id,
    config: { stage: "etapa_que_nao_existe" }, vars: {},
  } as never);
  ok(!r3.sucesso, "etapa inexistente é recusada, não gravada");

  // ── Negócio: a etapa tem que chegar na oportunidade canônica ────────────
  const [neg] = await db.execute<{ id: string }>(sql`
    INSERT INTO negocios (organizacao_id, titulo, status, etapa)
    VALUES (${org.id}::uuid, ${marca}, 'reuniao_agendada', 'entrada')
    RETURNING id::text`);
  criados.push(["negocios", neg.id]);
  await db.execute(sql`
    INSERT INTO oportunidades (organizacao_id, titulo, stage, etapa, negocio_id_legado)
    VALUES (${org.id}::uuid, ${marca}, 'reuniao_agendada', 'entrada', ${neg.id}::uuid)`);

  // `negocios.status` é o estado comercial legado, vocabulário próprio, e é o
  // que esta ação sempre mexeu. O defeito era a falta de propagação.
  const r4 = await executarAcaoAvulsa("crm_update_stage", {
    organizacaoId: org.id, entityType: "negocio", entityId: neg.id,
    config: { stage: "negociacao_iniciada" }, vars: {},
  } as never);
  ok(r4.sucesso, `mover status do negócio pela automação (${r4.sucesso ? "ok" : r4.erro})`);

  const [opo] = await db.execute<{ stage: string | null }>(sql`
    SELECT stage FROM oportunidades WHERE negocio_id_legado = ${neg.id}::uuid`);
  ok(opo.stage === "negociacao_iniciada",
     `a OPORTUNIDADE canônica acompanhou (${opo.stage ?? "nula"})`);

  const r5 = await executarAcaoAvulsa("crm_update_stage", {
    organizacaoId: org.id, entityType: "negocio", entityId: neg.id,
    config: { stage: "ganho" }, vars: {},
  } as never);
  ok(!r5.sucesso, "Ganho continua exigindo o gate comercial, não a automação");

  // ── Nota: tem que aparecer para quem lê a conta ─────────────────────────
  const r6 = await executarAcaoAvulsa("crm_add_note", {
    organizacaoId: org.id, entityType: "lead", entityId: lead.id,
    config: { title: `${marca} nota`, description: "escrita por regra" }, vars: {},
  } as never);
  ok(r6.sucesso, `nota por automação (${r6.sucesso ? "ok" : r6.erro})`);

  const [fato] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM domain_events
     WHERE event_type = 'NoteAdded' AND aggregate_id = ${lead.id}::uuid`);
  ok(fato.n === 1, `a nota vira FATO no registro (${fato.n})`);

  const [naFila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM event_outbox
     WHERE event_type = 'NoteAdded' AND aggregate_id = ${lead.id}::uuid`);
  ok(naFila.n === 1, `e entra na fila para o consumidor projetar (${naFila.n})`);

  // A projeção é quem põe na linha do tempo, e ela roda no consumidor.
  const { processarEventosPendentes } = await import("@/lib/events/consumer");
  await processarEventosPendentes(50);

  const [naTimeline] = await db.execute<{ n: number; titulo: string | null }>(sql`
    SELECT count(*)::int AS n, max(titulo) AS titulo FROM timeline_events
     WHERE tipo = 'nota' AND pessoa_id = ${pessoa.id}::uuid`);
  ok(naTimeline.n === 1,
     `e APARECE na linha do tempo da pessoa (${naTimeline.n}: "${naTimeline.titulo ?? ""}")`);

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT ((SELECT count(*) FROM leads WHERE nome LIKE 'smoke-automacao-%')
          + (SELECT count(*) FROM negocios WHERE titulo LIKE 'smoke-automacao-%')
          + (SELECT count(*) FROM pessoas WHERE nome LIKE 'smoke-automacao-%'))::int AS n`);
  ok(resto.n === 0, "o smoke não deixa resíduo");

  console.log(process.exitCode ? "\nsmoke de automação: FALHOU\n" : "\nsmoke de automação: ok\n");
}

main().catch(async (e) => {
  console.error(e);
  await limpar().catch(() => undefined);
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
