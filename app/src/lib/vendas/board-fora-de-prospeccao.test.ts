import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";

import { db, fecharConexao } from "@/lib/db";

import { boardPreVendas } from "./consultas";

/**
 * Prospecção não ocupa card no Kanban de Pré-vendas.
 *
 * O board abria com 62 cards em "Novo", e 37 eram prospects de outbound que em
 * produção estavam parados na coluna "Outbound" do board legado. O recorte
 * vive em `somenteDePreVendas()` e precisa valer nos cards E nos totais: se
 * valesse só nos cards, a coluna diria 62 com 25 cartões embaixo.
 */
test("nenhum prospect em prospecção vira card de pré-vendas", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");

  try {
    const [org] = await db.execute<{ id: string }>(sql`
      SELECT organizacao_id::text AS id FROM aquisicoes
       GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`);
    if (!org) return t.skip("banco sem aquisições");

    const board = await boardPreVendas(org.id, { porColuna: 5000 });
    const ids = board.colunas.flatMap((c) => c.cards.map((card) => card.leadId));
    assert.ok(ids.length > 0, "board vazio: o teste não provaria nada");

    const [intruso] = await db.execute<{ id: string; estado: string }>(sql`
      SELECT id::text, prospeccao_estado AS estado FROM leads
       WHERE id = ANY(${sql.raw(`ARRAY[${ids.map((i) => `'${i}'`).join(",")}]::uuid[]`)})
         AND prospeccao_estado IS NOT NULL
         AND prospeccao_estado <> 'pre_qualificado'
       LIMIT 1`);
    assert.equal(intruso, undefined,
      `lead ${intruso?.id} está em prospecção (${intruso?.estado}) e virou card de pré-vendas`);

    // Total da coluna e cartões da coluna contam o mesmo universo.
    for (const c of board.colunas) {
      assert.equal(c.total, c.cards.length,
        `coluna ${c.chave}: total ${c.total} com ${c.cards.length} cartões`);
    }
  } finally {
    await fecharConexao();
  }
});
