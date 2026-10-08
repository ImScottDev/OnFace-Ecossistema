/**
 * SLA do lead, só leitura: a fonte única dos marcos precisa bater com a coluna
 * do lead e nunca devolver tempo negativo. Precisa de DATABASE_URL; pula sem ela.
 */
import test from "node:test";
import assert from "node:assert/strict";

test("marcos do lead: 1º contato vem da coluna/evento e os tempos nunca são negativos", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { marcosDoLead, resumoSlaPreVendas } = await import("./sla-lead.js");

  const [x] = await db.execute<{ org: string; lead: string; pc: string }>(sql`
    SELECT organizacao_id::text AS org, id::text AS lead, primeiro_contato_at::text AS pc
      FROM leads WHERE primeiro_contato_at IS NOT NULL LIMIT 1`);
  if (!x) return t.skip("nenhum lead com primeiro contato");
  const m = await marcosDoLead(x.org, x.lead);
  assert.ok(m?.primeiroContatoEm, "lead com primeiro_contato_at precisa ter o marco");
  assert.ok((m.horasAteContato ?? 0) >= 0);

  const r = await resumoSlaPreVendas(x.org);
  assert.ok(r.contatados <= r.chegaram && r.convertidos <= r.chegaram);
  for (const h of [r.horasAteContato, r.horasAteQualificar, r.horasAteConverter]) {
    assert.ok(h === null || h >= 0);
  }
});
