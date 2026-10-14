/**
 * Eventos transacionais (SPEC §24.2, §50.3).
 *
 * A invariante: estado + evento + outbox na mesma transação. O levantamento
 * AS-IS mediu 569 negócios ganhos contra 33 eventos `DealWon` — o estado mudou
 * e o evento não, então nada a jusante soube.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { publicarEvento, projetarTimeline } from "@onface/platform-events";

const org = async () => (await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes ORDER BY created_at LIMIT 1`))[0]?.id;
const algumaEmpresa = async () => (await db.execute<{ id: string }>(sql`SELECT id FROM empresas LIMIT 1`))[0]?.id;

test("evento com a mesma chave de idempotência não duplica", async () => {
  const organizacaoId = await org();
  const aggregateId = await algumaEmpresa();
  const chave = `teste-idem-${aggregateId}`;
  await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key = ${chave}`);

  const a = await publicarEvento(db as never, sql as never, {
    organizacaoId, eventType: "TesteIdempotencia", aggregateType: "empresa",
    aggregateId, idempotencyKey: chave, payload: { tentativa: 1 },
  });
  const b = await publicarEvento(db as never, sql as never, {
    organizacaoId, eventType: "TesteIdempotencia", aggregateType: "empresa",
    aggregateId, idempotencyKey: chave, payload: { tentativa: 2 },
  });

  assert.equal(a.jaExistia, false, "primeira publicação cria");
  assert.equal(b.jaExistia, true, "segunda reconhece que já existe");
  assert.equal(a.eventId, b.eventId, "e devolve o MESMO evento, não um novo");

  const n = await db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM domain_events WHERE idempotency_key = ${chave}`);
  assert.equal(Number(n[0].n), 1, "retry de webhook não pode virar segundo fato");
  await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key = ${chave}`);
});

test("evento repetido não gera segunda entrega no outbox", async () => {
  const organizacaoId = await org();
  const aggregateId = await algumaEmpresa();
  const chave = `teste-outbox-${aggregateId}`;
  await db.execute(sql`DELETE FROM event_outbox WHERE idempotency_key = ${chave}`);
  await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key = ${chave}`);

  const a = await publicarEvento(db as never, sql as never, {
    organizacaoId, eventType: "TesteOutbox", aggregateType: "empresa",
    aggregateId, idempotencyKey: chave, entregarExternamente: true,
  });
  const b = await publicarEvento(db as never, sql as never, {
    organizacaoId, eventType: "TesteOutbox", aggregateType: "empresa",
    aggregateId, idempotencyKey: chave, entregarExternamente: true,
  });

  assert.ok(a.outboxId, "primeira publicação enfileira");
  assert.equal(b.outboxId, null, "segunda NÃO enfileira de novo");
  const n = await db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM event_outbox WHERE idempotency_key = ${chave}`);
  assert.equal(Number(n[0].n), 1, "uma entrega por fato, não uma por tentativa");
  await db.execute(sql`DELETE FROM event_outbox WHERE idempotency_key = ${chave}`);
  await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key = ${chave}`);
});

test("rollback desfaz evento e outbox junto com o estado", async () => {
  const organizacaoId = await org();
  const aggregateId = await algumaEmpresa();
  const chave = `teste-rollback-${aggregateId}`;

  // Se o estado falha depois do evento, o evento não pode sobreviver: é o
  // cenário exato que produziu 569 ganhos para 33 eventos.
  await db.transaction(async (tx) => {
    await publicarEvento(tx as never, sql as never, {
      organizacaoId, eventType: "TesteRollback", aggregateType: "empresa",
      aggregateId, idempotencyKey: chave, entregarExternamente: true,
    });
    throw new Error("falha proposital depois do evento");
  }).catch(() => {});

  const ev = await db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM domain_events WHERE idempotency_key = ${chave}`);
  const ob = await db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM event_outbox WHERE idempotency_key = ${chave}`);
  assert.equal(Number(ev[0].n), 0, "evento não pode sobreviver ao rollback do estado");
  assert.equal(Number(ob[0].n), 0, "outbox idem");
});

test("timeline é projeção: pode ser criada a partir do evento", async () => {
  const organizacaoId = await org();
  const empresaId = await algumaEmpresa();
  const chave = `teste-timeline-${empresaId}`;
  await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key = ${chave}`);

  const ev = await publicarEvento(db as never, sql as never, {
    organizacaoId, eventType: "TesteTimeline", aggregateType: "empresa",
    aggregateId: empresaId, idempotencyKey: chave,
  });
  const id = await projetarTimeline(db as never, sql as never, {
    organizacaoId, domainEventId: ev.eventId, empresaId,
    tipo: "teste", titulo: "Item de teste", metadata: { teste: true },
  });
  assert.ok(id, "projeção criada");
  await db.execute(sql`DELETE FROM timeline_events WHERE id = ${id}::uuid`);
  await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key = ${chave}`);
});
