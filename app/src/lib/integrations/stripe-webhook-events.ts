import { eq } from "drizzle-orm";
import { db } from "../db";
import { stripeWebhookEvents } from "../db/schema";
import { normalizarStatusInbox } from "./stripe-webhook-status";
import { executarEventoDoInbox } from "./stripe-webhook-inbox-db";

export { normalizarStatusInbox, statusIgual } from "./stripe-webhook-status";

/**
 * Consome um evento persistido (job da fila `stripe-webhook-events`).
 *
 * Roda o MESMO processamento da primeira entrega HTTP (handlers + sync + timeline +
 * pagamentos), não só o sync. Em falha LANÇA o erro: o BullMQ refaz com backoff e o
 * inbox fica `failed` com o motivo. O status é comparado sem diferenciar caixa
 * (produção gravou MAIÚSCULAS).
 */
export async function processStoredStripeWebhookEvent(stripeEventId: string) {
  const [event] = await db
    .select({ id: stripeWebhookEvents.id, status: stripeWebhookEvents.status, eventType: stripeWebhookEvents.eventType })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, stripeEventId))
    .limit(1);
  if (!event) throw new Error(`evento Stripe ${stripeEventId} não encontrado`);
  if (normalizarStatusInbox(event.status) === "processed") return { skipped: true, type: event.eventType };

  const r = await executarEventoDoInbox(event.id, { enfileirarSeFalhar: false });
  switch (r.estado) {
    case "processado": return { skipped: false, type: event.eventType, passos: r.passos };
    case "ja_processado": return { skipped: true, type: event.eventType };
    case "sem_organizacao": return { skipped: true, type: event.eventType, semOrganizacao: true };
    case "em_andamento": throw new Error(`evento ${stripeEventId} está sendo processado por outro executor; tentar de novo`);
    case "falhou": throw new Error(r.erro);
    default: throw new Error(`evento Stripe ${stripeEventId} não encontrado`);
  }
}
