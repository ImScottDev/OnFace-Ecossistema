/**
 * E11 e item 4 do marco zero, só leitura (nenhuma escrita no banco):
 *  - o chip de cadência só existe com inscrição viva (a régua antiga "Toque N" saiu);
 *  - o Kanban único traz Nutrição e Desqualificado com card, não só total.
 * Precisa de DATABASE_URL; pula sem ela.
 */
import test from "node:test";
import assert from "node:assert/strict";

test("passoDaCadenciaPorLead só conta inscrição viva: sem inscrição não há chip, e 'Toque N' não existe mais", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { passoDaCadenciaPorLead } = await import("./pre-vendas.js");

  // Lead com régua antiga (cadencia_execucoes) e SEM inscrição viva: não ganha chip.
  const [x] = await db.execute<{ org: string; lead: string }>(sql`
    SELECT x.organizacao_id::text AS org, x.lead_id::text AS lead FROM cadencia_execucoes x
     WHERE NOT EXISTS (SELECT 1 FROM cadence_enrollments e WHERE e.entity_type = 'lead'
                        AND e.entity_id = x.lead_id AND e.status IN ('active', 'waiting'))
     LIMIT 1`);
  if (x) {
    const mapa = await passoDaCadenciaPorLead(x.org, null, [x.lead]);
    assert.equal(mapa[x.lead], undefined);
  }
  // Quem tem inscrição viva mostra o nome da cadência, nunca "Toque N · canal".
  const [v] = await db.execute<{ org: string; lead: string }>(sql`
    SELECT organizacao_id::text AS org, entity_id::text AS lead FROM cadence_enrollments
     WHERE entity_type = 'lead' AND status IN ('active', 'waiting') LIMIT 1`);
  if (v) {
    const mapa = await passoDaCadenciaPorLead(v.org, null, [v.lead]);
    assert.match(mapa[v.lead] ?? "", /^Cadência /);
  }
  assert.deepEqual(await passoDaCadenciaPorLead("00000000-0000-0000-0000-000000000000", null, []), {});
});

test("o Kanban único mostra cards de Nutrição e Desqualificado", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { boardPreVendas } = await import("./consultas.js");
  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes ORDER BY created_at LIMIT 1`);
  const board = await boardPreVendas(org.id, {});
  for (const chave of ["nutricao", "desqualificado"] as const) {
    const col = board.colunas.find((c) => c.chave === chave);
    assert.ok(col, `coluna ${chave} ausente`);
    assert.equal(col.cards.length, col.total, `${chave}: total ${col.total} e ${col.cards.length} cards`);
  }
});
