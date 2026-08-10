/**
 * F0/Eventos — Event Outbox real, lado "consumir".
 *
 * `processarEventosPendentes()` é chamado pelo worker (job `event-outbox-
 * sweep`) — lê `event_outbox` em status pending, executa todo handler
 * registrado pro `eventType`, marca processed/failed com retry e
 * dead-letter (5 tentativas). Registro de handler é local a este processo
 * (mesmo padrão do registry de adapters do Cadence Engine em
 * `lib/cadencia/cadence-engine.ts`) — plugar um novo consumidor não exige
 * tocar em quem publica o evento.
 *
 * Consumidor real #1 (prova de que o barramento funciona de ponta a ponta,
 * não é só a tabela existindo): jornal de auditoria de domínio — toda
 * transição real de Lead/Deal grava em `audit_log` (F0), decoplado do
 * código que fez a transição. Ver ADR-EXEC-016.
 */
import { db } from "@/lib/db";
import { eventOutbox, auditLog } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

type EventoOutbox = typeof eventOutbox.$inferSelect;
type Handler = (evento: EventoOutbox) => Promise<void>;

const handlers = new Map<string, Handler[]>();

export function registrarConsumidorEvento(eventType: string, handler: Handler): void {
  const list = handlers.get(eventType) || [];
  list.push(handler);
  handlers.set(eventType, list);
}

const MAX_TENTATIVAS = 5;

export async function processarEventosPendentes(limite = 50): Promise<{ processados: number; falhados: number }> {
  const pendentes = await db
    .select()
    .from(eventOutbox)
    .where(eq(eventOutbox.status, "pending"))
    .orderBy(asc(eventOutbox.createdAt))
    .limit(limite);

  let processados = 0;
  let falhados = 0;

  for (const evento of pendentes) {
    try {
      const list = handlers.get(evento.eventType) || [];
      for (const handler of list) await handler(evento);
      await db
        .update(eventOutbox)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(eventOutbox.id, evento.id));
      processados++;
    } catch (err) {
      const attempts = (evento.attempts || 0) + 1;
      await db
        .update(eventOutbox)
        .set({
          status: attempts >= MAX_TENTATIVAS ? "failed" : "pending",
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
        })
        .where(eq(eventOutbox.id, evento.id));
      falhados++;
      console.error(`[EventOutbox] falha ao processar ${evento.eventType} (${evento.id}), tentativa ${attempts}:`, err);
    }
  }

  return { processados, falhados };
}

async function registrarNoAuditLog(evento: EventoOutbox): Promise<void> {
  await db.insert(auditLog).values({
    organizacaoId: evento.organizacaoId,
    actorId: null,
    action: `event.${evento.eventType}`,
    entityType: evento.aggregateType,
    entityId: evento.aggregateId,
    after: evento.payload as object,
    source: "worker",
  });
}

for (const eventType of [
  "LeadCreated", "DealCreated", "StageChanged", "DealWon", "DealLost", "CustomerCreated",
  "ProposalSent", "ProposalViewed", "ProposalAccepted", "ProposalRejected",
]) {
  registrarConsumidorEvento(eventType, registrarNoAuditLog);
}
