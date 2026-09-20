import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Toda tarefa precisa pertencer a uma organização antes de qualquer leitura
 * tenant-scoped. Sem isso ela existe no banco, mas some da fila do time.
 */
test("tarefas persistidas pertencem a uma organização", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");

  const [resultado] = await db.execute<{ sem_organizacao: number }>(sql`
    SELECT count(*)::int AS sem_organizacao
      FROM tarefas
     WHERE organizacao_id IS NULL
  `);

  assert.equal(
    resultado?.sem_organizacao ?? 0,
    0,
    "tarefa sem organização fica invisível para toda leitura multi-tenant",
  );
});
