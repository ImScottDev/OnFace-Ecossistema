import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { stripeWebhookEvents } from "../db/schema";
import { syncStripe } from "./stripe-sync";

/**
 * Consumes a persisted delivery. It is intentionally a reconciliation job:
 * all Stripe-side facts are re-read by syncStripe, so a webhook payload cannot
 * overwrite a newer subscription/invoice state that arrived out of order.
 */
export async function processStoredStripeWebhookEvent(stripeEventId: string) {
  const [event] = await db
    .select({ id: stripeWebhookEvents.id, status: stripeWebhookEvents.status, eventType: stripeWebhookEvents.eventType })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, stripeEventId))
    .limit(1);
  if (!event) throw new Error(`evento Stripe ${stripeEventId} não encontrado`);
  if (event.status === "PROCESSED") return { skipped: true, type: event.eventType };

  await db
    .update(stripeWebhookEvents)
    .set({ status: "PROCESSING", processingStartedAt: new Date(), attempts: sql`${stripeWebhookEvents.attempts} + 1`, lastError: null })
    .where(and(eq(stripeWebhookEvents.id, event.id), inArray(stripeWebhookEvents.status, ["PENDING", "FAILED", "PROCESSING"])));

  try {
    const synced = await syncStripe();
    await db.update(stripeWebhookEvents)
      .set({ status: "PROCESSED", processedAt: new Date(), lastError: null })
      .where(eq(stripeWebhookEvents.id, event.id));
    return { skipped: false, type: event.eventType, synced };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
    await db.update(stripeWebhookEvents)
      .set({ status: "FAILED", lastError: message })
      .where(eq(stripeWebhookEvents.id, event.id));
    throw error;
  }
}
