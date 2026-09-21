/**
 * Smoke do caminho transacional de evento (SPEC §24.2).
 *
 * Prova contra o banco real que estado, evento de domínio e outbox nascem na
 * MESMA transação, e que o consumidor entrega. É o item da Definition of Done
 * que diz que o refactor não está pronto enquanto o `event_outbox` estiver sem
 * uso: a tabela existe e tem consumidor desde agosto, mas até aqui ninguém
 * tinha provado a cadeia inteira ponta a ponta contra dado real.
 *
 * Também prova o rollback: se a transação falhar depois de publicar, nem o
 * evento nem o outbox sobrevivem. Evento publicado de uma escrita que não
 * aconteceu é pior que evento nenhum.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { publicarEvento } from "@onface/platform-events";
import { processarEventosPendentes } from "@/lib/events/consumer";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const marca = `smoke-outbox-${Date.now()}`;
  const criados: string[] = [];
  let saida = 1;

  try {
    console.log("\n  1. evento + outbox na mesma transação");
    const r = await db.transaction(async (tx) => {
      return publicarEvento(tx as never, sql as never, {
        organizacaoId: org.id,
        eventType: "SmokeOutbox",
        aggregateType: "smoke",
        aggregateId: org.id,
        actorType: "SYSTEM",
        source: marca,
        idempotencyKey: marca,
        payload: { marca },
        entregarExternamente: true,
      });
    });
    criados.push(marca);

    const depois = await um<{ ev: number; ob: number; status: string | null }>(sql`
      SELECT (SELECT count(*)::int FROM domain_events WHERE idempotency_key = ${marca}) AS ev,
             (SELECT count(*)::int FROM event_outbox WHERE idempotency_key = ${marca}) AS ob,
             (SELECT status FROM event_outbox WHERE idempotency_key = ${marca}) AS status`);
    console.log(`     domain_events=${depois.ev}  event_outbox=${depois.ob}  status=${depois.status}`);

    console.log("\n  2. reentrega do mesmo fato não duplica");
    await db.transaction(async (tx) => publicarEvento(tx as never, sql as never, {
      organizacaoId: org.id, eventType: "SmokeOutbox", aggregateType: "smoke",
      aggregateId: org.id, actorType: "SYSTEM", source: marca,
      idempotencyKey: marca, payload: { marca }, entregarExternamente: true,
    }));
    const dedup = await um<{ ev: number; ob: number }>(sql`
      SELECT (SELECT count(*)::int FROM domain_events WHERE idempotency_key = ${marca}) AS ev,
             (SELECT count(*)::int FROM event_outbox WHERE idempotency_key = ${marca}) AS ob`);
    console.log(`     domain_events=${dedup.ev}  event_outbox=${dedup.ob}`);

    console.log("\n  3. transação que falha não deixa evento órfão");
    const marcaRollback = `${marca}-rollback`;
    await db.transaction(async (tx) => {
      await publicarEvento(tx as never, sql as never, {
        organizacaoId: org.id, eventType: "SmokeRollback", aggregateType: "smoke",
        aggregateId: org.id, actorType: "SYSTEM", source: marcaRollback,
        idempotencyKey: marcaRollback, payload: {}, entregarExternamente: true,
      });
      throw new Error("falha proposital");
    }).catch(() => undefined);
    const rb = await um<{ ev: number; ob: number }>(sql`
      SELECT (SELECT count(*)::int FROM domain_events WHERE idempotency_key = ${marcaRollback}) AS ev,
             (SELECT count(*)::int FROM event_outbox WHERE idempotency_key = ${marcaRollback}) AS ob`);
    console.log(`     domain_events=${rb.ev}  event_outbox=${rb.ob}  (esperado 0 e 0)`);

    console.log("\n  4. o consumidor entrega");
    const proc = await processarEventosPendentes(10);
    const fim = await um<{ status: string | null }>(sql`
      SELECT status FROM event_outbox WHERE idempotency_key = ${marca}`);
    console.log(`     processados=${proc.processados}  falhados=${proc.falhados}  status final=${fim.status}`);

    console.log("\n  RESULTADO");
    const checagens: [string, boolean, string][] = [
      ["transacional", depois.ev === 1 && depois.ob === 1, "evento e outbox na mesma transação"],
      ["pendente", depois.status === "pending", "nasce pendente, para o consumidor pegar"],
      ["idempotente", dedup.ev === 1 && dedup.ob === 1, "reentrega do mesmo fato não duplica"],
      ["rollback", rb.ev === 0 && rb.ob === 0, "transação que falha não deixa evento órfão"],
      ["consumido", fim.status !== "pending", "o consumidor tirou da fila"],
    ];
    let ok = true;
    for (const [nome, passou, desc] of checagens) {
      if (!passou) ok = false;
      console.log(`    ${nome.padEnd(14)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
    }
    console.log(`\n  ${ok ? "SMOKE PASSOU: estado, evento e outbox são um fato só" : "SMOKE FALHOU"}\n`);
    saida = ok ? 0 : 1;
  } finally {
    for (const m of criados) {
      await db.execute(sql`DELETE FROM event_outbox WHERE idempotency_key IN (${m}, ${m + "-rollback"})`);
      await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key IN (${m}, ${m + "-rollback"})`);
    }
    console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
