/**
 * Uma aquisição aberta por pessoa, contra o banco real.
 *
 * Bug (13/10): o mesmo formulário Meta gerava duas aquisições abertas para a
 * mesma pessoa, 1-3 min de diferença (utm meta/paid_social e depois ig/cpc). A
 * primeira nascia sem etapa e sem canal; a segunda caía numa corrida ou numa
 * aquisição sem `lead_legado_id`. Org de QA própria, apagada no fim.
 *
 * DATABASE_URL=... node --import tsx --env-file=.env --test src/lib/vendas/entrada-sem-duplicata.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { garantirEntradaCanonica, travarEntrada, acharLeadPorContato } from "./ponte-canonica";

const T = `qa-dup-${Date.now().toString(36)}`;
let org = "";
const email = `${T}@qa.local`;
const telefone = "11987654321";

const entrada = (utmSource: string, utmMedium: string) => ({
  organizacaoId: org, tipo: "INBOUND" as const, origem: "Mídia Paga", provider: "meta",
  pessoa: { nome: "QA Duplicata", email, telefone },
  atribuicao: { utmSource, utmMedium, utmCampaign: "TRT - CALL FACE [2026]" },
});
const abertas = () => db.execute<{ id: string; etapa: string | null; canal: string | null; lead: string | null }>(sql`
  SELECT a.id::text, pe.codigo AS etapa, a.canal, a.lead_legado_id::text AS lead
    FROM aquisicoes a LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
   WHERE a.organizacao_id = ${org}::uuid AND a.closed_at IS NULL`);

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
  for (const t of ["pontos_contato", "backfill_provenance", "aquisicoes", "pessoa_empresa_vinculos", "pessoas", "empresas", "domain_events", "outbox_events", "pipeline_etapas", "pipelines"]) {
    await db.execute(sql.raw(`DELETE FROM ${t} WHERE organizacao_id = '${org}'`)).catch(() => {});
  }
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`).catch(() => {});
});

test("o mesmo lead Meta chegando duas vezes (meta, depois ig/cpc) fica numa aquisição só, com etapa e canal", async () => {
  const a = await garantirEntradaCanonica(entrada("meta", "paid_social"));
  const b = await garantirEntradaCanonica(entrada("ig", "cpc"));
  assert.ok(a.ok && b.ok, JSON.stringify({ a, b }));
  assert.equal(a.aquisicaoId, b.aquisicaoId);
  const linhas = await abertas();
  assert.equal(linhas.length, 1, "uma aquisição aberta por pessoa");
  assert.equal(linhas[0].etapa, "novo", "nasce na etapa inicial");
  assert.equal(linhas[0].canal, "meta");
});

test("duas entradas simultâneas da mesma identidade não abrem duas aquisições", async () => {
  const outro = { ...entrada("meta", "paid_social"), pessoa: { nome: "QA Corrida", email: `x-${email}`, telefone: "11977776666" } };
  const rs = await Promise.all([1, 2, 3].map(() => garantirEntradaCanonica(outro)));
  assert.ok(rs.every((r) => r.ok), JSON.stringify(rs));
  assert.equal(new Set(rs.map((r) => r.aquisicaoId)).size, 1);
  const [{ n }] = await db.execute<{ n: number }>(sql`
    SELECT count(DISTINCT pessoa_id)::int AS n FROM aquisicoes WHERE id = ${rs[0].aquisicaoId}::uuid`);
  assert.equal(n, 1);
  const [{ p }] = await db.execute<{ p: number }>(sql`SELECT count(*)::int AS p FROM pessoas WHERE organizacao_id = ${org}::uuid AND email = ${`x-${email}`}`);
  assert.equal(p, 1, "a corrida também não duplica a pessoa");
});

test("aquisição aberta sem lead_legado_id e sem etapa é reaproveitada e enriquecida", async () => {
  const em = `semlead-${email}`;
  const [pe] = await db.execute<{ id: string }>(sql`INSERT INTO pessoas (organizacao_id, nome, email) VALUES (${org}::uuid, 'QA Sem Lead', ${em}) RETURNING id::text`);
  const [aq] = await db.execute<{ id: string }>(sql`INSERT INTO aquisicoes (organizacao_id, pessoa_id, tipo) VALUES (${org}::uuid, ${pe.id}::uuid, 'INBOUND') RETURNING id::text`);
  const [lead] = await db.execute<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, email, tipo, status) VALUES (${org}::uuid, 'QA Sem Lead', ${em}, 'lead', 'novo') RETURNING id::text`);
  const r = await garantirEntradaCanonica({ ...entrada("ig", "cpc"), pessoa: { nome: "QA Sem Lead", email: em } }, lead.id);
  assert.ok(r.ok);
  assert.equal(r.aquisicaoId, aq.id);
  assert.equal(r.criada, false);
  const [x] = await db.execute<{ etapa: string | null; canal: string | null; lead: string | null }>(sql`
    SELECT pe.codigo AS etapa, a.canal, a.lead_legado_id::text AS lead FROM aquisicoes a
      LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id WHERE a.id = ${aq.id}::uuid`);
  assert.deepEqual(x, { etapa: "novo", canal: "meta", lead: lead.id });
  await db.execute(sql`DELETE FROM leads WHERE organizacao_id = ${org}::uuid`);
});

test("lead legado casa por e-mail sem caixa e telefone em outro formato, e a trava de entrada não trava a ponte", async () => {
  const em = `fmt-${email}`;
  const [lead] = await db.execute<{ id: string }>(sql`INSERT INTO leads (organizacao_id, nome, email, telefone, tipo, status) VALUES (${org}::uuid, 'QA Formato', ${` ${em.toUpperCase()}`}, '+5527992237109', 'lead', 'novo') RETURNING id::text`);
  assert.equal((await acharLeadPorContato(org, em, null))?.id, lead.id);
  assert.equal((await acharLeadPorContato(org, null, "(27) 99223-7109"))?.id, lead.id);
  const soltar = await travarEntrada(org, em, "27992237109");
  try {
    const r = await garantirEntradaCanonica({ ...entrada("meta", "paid_social"), pessoa: { nome: "QA Formato", email: em, telefone: "27992237109" } }, lead.id);
    assert.ok(r.ok, JSON.stringify(r));
  } finally { soltar(); }
  await db.execute(sql`DELETE FROM leads WHERE organizacao_id = ${org}::uuid`);
});
