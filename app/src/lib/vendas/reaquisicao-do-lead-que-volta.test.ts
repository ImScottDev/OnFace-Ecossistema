/**
 * O lead que volta abre processo novo quando o anterior fechou, contra o banco real.
 *
 * Bug (medido em produção, 01 a 07/11/2026): 11 pessoas que já estavam na base
 * reconverteram pela mídia paga e NENHUMA gerou aquisição. O índice único global
 * `uq_aquisicoes_lead_legado` (migration 0069, premissa "um lead vira no máximo
 * uma aquisição") barrava a segunda com 23505, mesmo quando a primeira estava
 * fechada há meses. Sem aquisição nova não nasce cartão, etapa nem responsável:
 * 9 das 11 não receberam nenhuma atividade depois de voltar e 3 seguiam paradas
 * em Desqualificado. A migration 0143 troca o índice por um parcial sobre as
 * aquisições ABERTAS.
 *
 * Org de QA própria, apagada no fim.
 *
 * DATABASE_URL=... node --import tsx --env-file=.env --test src/lib/vendas/reaquisicao-do-lead-que-volta.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { garantirEntradaCanonica } from "./ponte-canonica";

const T = `qa-reaq-${Date.now().toString(36)}`;
let org = "";

const entrada = (nome: string, email: string) => ({
  organizacaoId: org,
  tipo: "INBOUND" as const,
  origem: "Mídia Paga",
  provider: "meta",
  pessoa: { nome, email },
  atribuicao: { utmSource: "ig", utmMedium: "cpc", utmCampaign: "QA Reaquisição" },
});

/** Cria lead legado + pessoa + aquisição já vinculada, como o backfill deixou a base. */
async function leadComAquisicao(nome: string, email: string, fechada: boolean) {
  const [pes] = await db.execute<{ id: string }>(sql`
    INSERT INTO pessoas (organizacao_id, nome, email) VALUES (${org}::uuid, ${nome}, ${email}) RETURNING id::text`);
  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, email, tipo, status)
    VALUES (${org}::uuid, ${nome}, ${email}, 'lead', 'novo') RETURNING id::text`);
  const [aq] = await db.execute<{ id: string }>(sql`
    INSERT INTO aquisicoes (organizacao_id, pessoa_id, tipo, lead_legado_id, first_touch_at, last_touch_at, closed_at)
    VALUES (${org}::uuid, ${pes.id}::uuid, 'INBOUND', ${lead.id}::uuid,
            now() - interval '120 days', now() - interval '120 days',
            ${fechada ? sql`now() - interval '90 days'` : sql`NULL`})
    RETURNING id::text`);
  return { pessoaId: pes.id, leadId: lead.id, aquisicaoId: aq.id };
}

const doLead = (leadId: string) => db.execute<{ id: string; aberta: boolean; last_touch: string; first_touch: string }>(sql`
  SELECT a.id::text, (a.closed_at IS NULL) AS aberta,
         a.last_touch_at::text AS last_touch, a.first_touch_at::text AS first_touch
    FROM aquisicoes a WHERE a.lead_legado_id = ${leadId}::uuid ORDER BY a.created_at`);

before(async () => {
  const [o] = await db.execute<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${T}, ${T}) RETURNING id::text`);
  org = o.id;
  const [p] = await db.execute<{ id: string }>(sql`
    INSERT INTO pipelines (organizacao_id, nome, slug, ordem, stages, closed_stages, is_default, ativo, tipo)
    VALUES (${org}::uuid, 'Pré-vendas', 'aquisicao', 0, '[]'::jsonb, '[]'::jsonb, false, true, 'ACQUISITION') RETURNING id::text`);
  await db.execute(sql`
    INSERT INTO pipeline_etapas (organizacao_id, pipeline_id, codigo, nome, ordem, tipo_fechamento)
    VALUES (${org}::uuid, ${p.id}::uuid, 'novo', 'Novo', 0, 'OPEN')`);
});

after(async () => {
  for (const t of ["pontos_contato", "backfill_provenance", "aquisicoes", "pessoa_empresa_vinculos", "pessoas", "leads", "empresas", "domain_events", "outbox_events", "pipeline_etapas", "pipelines"]) {
    await db.execute(sql.raw(`DELETE FROM ${t} WHERE organizacao_id = '${org}'`)).catch(() => {});
  }
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`).catch(() => {});
});

test("lead com aquisição FECHADA que reconverte abre um processo novo", async () => {
  const email = `fechada-${T}@qa.local`;
  const { leadId, aquisicaoId } = await leadComAquisicao("QA Voltou", email, true);

  const r = await garantirEntradaCanonica(entrada("QA Voltou", email), leadId);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.criada, true, "reconversão com a anterior fechada cria processo novo");
  assert.notEqual(r.aquisicaoId, aquisicaoId, "não reaproveita a aquisição encerrada");

  const linhas = await doLead(leadId);
  assert.equal(linhas.length, 2, "o histórico guarda os dois processos do mesmo lead");
  assert.equal(linhas.filter((l) => l.aberta).length, 1, "só UMA aberta por lead");

  // O ponto que o time sente: a aquisição nova nasce com etapa, para virar cartão no board.
  const [etapa] = await db.execute<{ codigo: string | null }>(sql`
    SELECT pe.codigo FROM aquisicoes a LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
     WHERE a.id = ${r.aquisicaoId}::uuid`);
  assert.equal(etapa.codigo, "novo", "sem etapa o cartão não aparece para ninguém trabalhar");
});

test("lead com aquisição ABERTA que reconverte NÃO duplica o cartão", async () => {
  const email = `aberta-${T}@qa.local`;
  const { leadId, aquisicaoId } = await leadComAquisicao("QA Em Contato", email, false);

  const r = await garantirEntradaCanonica(entrada("QA Em Contato", email), leadId);
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.criada, false, "já existe processo aberto: alguém está trabalhando");
  assert.equal(r.aquisicaoId, aquisicaoId);
  assert.equal((await doLead(leadId)).length, 1, "nada de dois cartões do mesmo processo");
});

test("a volta do lead NÃO carimba last_touch_at, senão ele some da fila de contato", async () => {
  // Guarda de regressão. "Sem 1º contato" é derivado de last_touch_at <= first_touch_at
  // (lib/vendas/consultas.ts). Carimbar o toque de ENTRADA tiraria justamente o lead que
  // voltou da fila do SDR e da lista de não-contatados do Início: o sinal viraria sumiço.
  const email = `toque-${T}@qa.local`;
  const { leadId } = await leadComAquisicao("QA Toque", email, false);
  const [antes] = await doLead(leadId);

  await garantirEntradaCanonica(entrada("QA Toque", email), leadId);

  const [depois] = await doLead(leadId);
  assert.equal(depois.last_touch, antes.last_touch, "last_touch_at não pode andar com a reconversão");
  assert.ok(depois.last_touch <= depois.first_touch, "o lead continua contando como nunca contatado");
});

test("a volta fica registrada em pontos_contato, que é onde o toque de entrada mora", async () => {
  const email = `ponto-${T}@qa.local`;
  const { leadId } = await leadComAquisicao("QA Ponto", email, false);
  const antes = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM pontos_contato WHERE organizacao_id = ${org}::uuid`);

  await garantirEntradaCanonica(entrada("QA Ponto", email), leadId);

  const depois = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM pontos_contato WHERE organizacao_id = ${org}::uuid`);
  assert.ok(depois[0].n > antes[0].n, "a reconversão precisa deixar rastro de atribuição");
});
