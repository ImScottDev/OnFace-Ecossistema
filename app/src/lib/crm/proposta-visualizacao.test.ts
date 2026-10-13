import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { incrementarVisualizacao } from "./proposta-publica";

/** Integração com o banco: aberturas simultâneas não perdem contagem e só uma é "a primeira". Restaura a linha no fim. */
test("visualização: incremento atômico e uma única primeira vez", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const [p] = await db.execute<{ id: string; v: number }>(sql`
    SELECT id::text, visualizacoes AS v FROM propostas WHERE primeira_visualizacao_em IS NULL LIMIT 1`);
  if (!p) return t.skip("sem proposta nunca visualizada");
  try {
    const rs = await Promise.all(Array.from({ length: 10 }, () => incrementarVisualizacao(p.id)));
    assert.equal(rs.filter((r) => r.primeiraVez).length, 1);
    const [depois] = await db.execute<{ v: number }>(sql`SELECT visualizacoes AS v FROM propostas WHERE id = ${p.id}::uuid`);
    assert.equal(depois.v, p.v + 10, "contagem perdida sob concorrência");
  } finally {
    await db.execute(sql`UPDATE propostas SET visualizacoes = ${p.v}, primeira_visualizacao_em = NULL, ultima_visualizacao_em = NULL WHERE id = ${p.id}::uuid`);
  }
});
