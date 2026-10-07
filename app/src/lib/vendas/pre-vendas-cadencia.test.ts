/**
 * E11 e item 4 do marco zero, só leitura (nenhuma escrita no banco):
 *  - o passo da cadência vem do último toque quando não há inscrição;
 *  - o Kanban único traz Nutrição e Desqualificado com card, não só total.
 * Precisa de DATABASE_URL; pula sem ela.
 */
import test from "node:test";
import assert from "node:assert/strict";

test("passoDaCadenciaPorLead devolve o último toque de quem não tem inscrição", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { passoDaCadenciaPorLead } = await import("./pre-vendas.js");

  const [x] = await db.execute<{ org: string; lead: string; ordem: number }>(sql`
    SELECT DISTINCT ON (lead_id) organizacao_id::text AS org, lead_id::text AS lead, ordem
      FROM cadencia_execucoes ORDER BY lead_id, enviado_em DESC, ordem DESC LIMIT 1`);
  if (!x) return t.skip("sem cadencia_execucoes");
  const mapa = await passoDaCadenciaPorLead(x.org, [x.lead]);
  assert.match(mapa[x.lead] ?? "", new RegExp(`^(Toque ${x.ordem} · |Cadência )`));
  assert.deepEqual(await passoDaCadenciaPorLead(x.org, []), {});
});

test("o Kanban único mostra cards de Nutrição e Desqualificado", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { boardPreVendas } = await import("./consultas.js");
  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const board = await boardPreVendas(org.id, {});
  for (const chave of ["nutricao", "desqualificado"] as const) {
    const col = board.colunas.find((c) => c.chave === chave);
    assert.ok(col, `coluna ${chave} ausente`);
    assert.equal(col.cards.length, col.total, `${chave}: total ${col.total} e ${col.cards.length} cards`);
  }
});
