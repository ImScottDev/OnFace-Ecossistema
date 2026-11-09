/**
 * Reconversão e duplicata na origem são coisas diferentes, contra o banco real.
 *
 * O card de Mídia Paga mostrava `leadsMeta - leads` rotulado "dedupe/reconversão":
 * um resíduo de subtração vendido como contagem. Na semana de 01 a 07/11/2026 ele
 * dizia 106, e das 117 entregas `duplicada` do período 100 eram o mesmo lead
 * chegando por duas portas (webhook Meta e depois RD) contra 13 reconversões reais.
 * As 13 — gente que levantou a mão de novo — sumiam dentro das 100.
 *
 * A régua é a data de criação do lead: antes da janela é reconversão, dentro da
 * janela é a mesma entrada chegando duas vezes. Org de QA própria, apagada no fim.
 *
 * DATABASE_URL=... node --import tsx --env-file=.env --test src/lib/relatorios/entradas-repetidas.test.ts
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getEntradasRepetidas } from "./midia-paga";

const T = `qa-rep-${Date.now().toString(36)}`;
let org = "";
const since = new Date("2026-11-01T00:00:00Z");
const until = new Date("2026-11-08T00:00:00Z");

async function entrega(nome: string, leadCriadoEm: string, entregaEm: string, status: string) {
  const [lead] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, tipo, status, created_at)
    VALUES (${org}::uuid, ${nome}, 'lead', 'novo', ${leadCriadoEm}::timestamptz) RETURNING id::text`);
  await db.execute(sql`
    INSERT INTO captacao_entregas (organizacao_id, canal, chave_idempotencia, payload, status, lead_id, created_at)
    VALUES (${org}::uuid, 'rd', ${`${T}-${nome}-${entregaEm}`}, '{}'::jsonb, ${status}, ${lead.id}::uuid, ${entregaEm}::timestamptz)`);
  return lead.id;
}

before(async () => {
  const [o] = await db.execute<{ id: string }>(sql`INSERT INTO organizacoes (nome, slug) VALUES (${T}, ${T}) RETURNING id::text`);
  org = o.id;
});

after(async () => {
  for (const t of ["captacao_entregas", "leads"]) {
    await db.execute(sql.raw(`DELETE FROM ${t} WHERE organizacao_id = '${org}'`)).catch(() => {});
  }
  await db.execute(sql`DELETE FROM organizacoes WHERE id = ${org}::uuid`).catch(() => {});
});

test("separa quem já existia antes (reconversão) de quem chegou duas vezes na semana", async () => {
  // Reconversão: lead de junho, entrega duplicada em novembro.
  await entrega("QA Voltou", "2026-06-10T10:00:00Z", "2026-11-05T10:00:00Z", "duplicada");
  await entrega("QA Voltou 2", "2026-07-01T10:00:00Z", "2026-11-06T10:00:00Z", "duplicada");
  // Duplicata na origem: lead nasceu na própria semana e a 2ª porta entregou depois.
  await entrega("QA Duas Portas", "2026-11-03T09:00:00Z", "2026-11-03T09:05:00Z", "duplicada");
  // Ruído que NÃO pode entrar: entrega processada (entrou normal) e entrega fora da janela.
  await entrega("QA Normal", "2026-11-04T10:00:00Z", "2026-11-04T10:00:00Z", "processada");
  await entrega("QA Fora", "2026-06-10T10:00:00Z", "2026-10-20T10:00:00Z", "duplicada");

  const r = await getEntradasRepetidas(org, since, until);
  assert.equal(r.reconversoes, 2, "só lead criado ANTES da janela conta como reconversão");
  assert.equal(r.duplicataNaOrigem, 1, "lead nascido na janela é a mesma entrada chegando 2x");
});

test("sem entrega duplicada no período os dois números são zero, não nulos", async () => {
  const r = await getEntradasRepetidas(org, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-02T00:00:00Z"));
  assert.deepEqual(r, { reconversoes: 0, duplicataNaOrigem: 0 });
});
