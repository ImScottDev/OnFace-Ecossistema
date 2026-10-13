import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stripeWebhookEvents } from "@/lib/db/schema";
import { EVENTOS_ESPERADOS } from "@/lib/integrations/stripe-financeiro";
import { executarEventoDoInbox, resolverOrganizacao } from "@/lib/integrations/stripe-webhook-inbox-db";
import { normalizarStatusInbox } from "@/lib/integrations/stripe-webhook-status";
import type { StripeEventPayload } from "@/lib/integrations/stripe-webhook-processor";

/**
 * POST /api/webhooks/stripe
 *
 * Esta rota só: verifica a assinatura, guarda o evento no inbox (idempotente por
 * `event.id`) e entrega ao processador. Os handlers de negócio moram em
 * `lib/integrations/stripe-webhook-handlers.ts` e o ciclo de vida do inbox em
 * `stripe-webhook-inbox*.ts` — o worker e o reprocesso rodam EXATAMENTE o mesmo código.
 *
 * Falha não é silenciosa: o evento vira `failed` com o erro e entra na fila
 * `stripe-webhook-events` (retry com backoff). Se nem a fila aceitar, 500 para o Stripe reentregar.
 *
 * Configurar no painel Stripe (Developers > Webhooks) https://crm.callface.io/api/webhooks/stripe com os
 * eventos de `EVENTOS_ESPERADOS` (lista: `npx tsx src/scripts/stripe-endpoint-eventos-faltantes.ts`).
 * O signing secret (whsec_...) vai em STRIPE_WEBHOOK_SECRET.
 */
export const dynamic = "force-dynamic";

const RELEVANT = new Set<string>(EVENTOS_ESPERADOS);

// Tolerância de timestamp (doc Stripe: proteger contra replay) + suporte a múltiplos
// v1 no header (acontece durante rotação do signing secret).
const TOLERANCIA_SEGUNDOS = 5 * 60;

function verify(payload: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader) return false;
  let t: string | null = null;
  const v1s: string[] = [];
  for (const parte of sigHeader.split(",")) {
    const [k, v] = parte.split("=");
    if (k === "t") t = v;
    if (k === "v1" && v) v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;
  const idade = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(idade) || idade > TOLERANCIA_SEGUNDOS) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return v1s.some((v1) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
    } catch {
      return false;
    }
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // FAIL-CLOSED (auditoria item 8): sem secret, o endpoint público aceitaria QUALQUER payload forjado.
  // 503 diz ao Stripe que a porta está indisponível e que deve reentregar depois.
  if (!secret) {
    console.error("[StripeWebhook] STRIPE_WEBHOOK_SECRET não configurado — recusando evento (fail-closed)");
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const payload = await request.text();
  if (!verify(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEventPayload;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const type = event.type || "";
  if (!RELEVANT.has(type)) return NextResponse.json({ received: true, ignored: type });
  if (!event.id) return NextResponse.json({ error: "event id missing" }, { status: 400 });

  // A conta live é COMPARTILHADA com o SaaS Callface: objeto do SaaS (metadata organization_id/plan_id/user_id)
  // e cliente que o ONFACE não conhece não entram no inbox nem no sync.
  const tenant = await resolverOrganizacao(event);
  if (tenant.ignorar) {
    console.log(`[StripeWebhook] ${type} ${event.id} ignorado (${tenant.ignorar})`);
    return NextResponse.json({ received: true, ignored: tenant.ignorar, eventId: event.id });
  }

  const [inserido] = await db.insert(stripeWebhookEvents).values({
    eventId: event.id,
    organizacaoId: tenant.organizacaoId,
    eventType: type,
    apiVersion: event.api_version || null,
    livemode: event.livemode ?? null,
    status: tenant.organizacaoId ? "pending" : "unresolved",
    payload: event,
    receivedAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing({ target: stripeWebhookEvents.eventId }).returning({ id: stripeWebhookEvents.id });

  // ORDEM IMPORTA: a reentrega NÃO pode parar no "duplicate" se a 1ª entrega morreu no meio
  // (era o contrário até 17/09/2026 e travou vendas PAGAS). Só `processed` pula.
  let inboxId = inserido?.id ?? null;
  if (!inboxId) {
    const [existente] = await db.select({ id: stripeWebhookEvents.id, status: stripeWebhookEvents.status })
      .from(stripeWebhookEvents).where(eq(stripeWebhookEvents.eventId, event.id)).limit(1);
    if (!existente) return NextResponse.json({ error: "webhook inbox unavailable" }, { status: 500 });
    // Sem diferenciar caixa: produção gravou PROCESSED.
    if (normalizarStatusInbox(existente.status) === "processed") {
      return NextResponse.json({ received: true, duplicate: true, eventId: event.id });
    }
    inboxId = existente.id;
  }

  const r = await executarEventoDoInbox(inboxId, { enfileirarSeFalhar: true });
  switch (r.estado) {
    case "processado": return NextResponse.json({ received: true, type });
    case "ja_processado": return NextResponse.json({ received: true, duplicate: true, eventId: event.id });
    case "em_andamento": return NextResponse.json({ received: true, inProgress: true, eventId: event.id });
    case "sem_organizacao": return NextResponse.json({ received: true, unresolved: true, eventId: event.id }, { status: 202 });
    case "falhou":
      // Gravado como failed e na fila: o worker refaz com backoff. Se a fila não aceitou, 500 → o Stripe reentrega.
      if (r.enfileirado) return NextResponse.json({ received: true, type, failed: true, queued: true, error: r.erro.slice(0, 300) });
      return NextResponse.json({ error: "processing failed and could not be queued, retry", detail: r.erro.slice(0, 300) }, { status: 500 });
    default: return NextResponse.json({ error: "webhook inbox unavailable" }, { status: 500 });
  }
}
