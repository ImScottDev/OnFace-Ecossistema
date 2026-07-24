import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { callfaceCallEventsQueue } from "@/lib/queue";

/**
 * POST /api/webhooks/callface
 * Webhook de SAÍDA da Callface: recebe o payload de cada ligação finalizada
 * (resumo IA, transcrição, áudio, deal_closure_percentage, scheduling).
 *
 * Configurar no painel Callface: Configurações → Integração → Webhooks → Saída
 *   URL: https://<crm>/api/webhooks/callface
 *   Header secret → vai em X-Callface-Signature em toda requisição.
 *
 * Segurança (mesmo espírito do webhook Stripe):
 * - FAIL-CLOSED: sem CALLFACE_WEBHOOK_SECRET no env, recusa tudo (503).
 * - Comparação em tempo constante do header X-Callface-Signature.
 * - Secret nunca vai pra log.
 *
 * Processamento: responde 200 rápido e delega pra fila `callface-call-events`
 * (retry com backoff no worker — evento não se perde se o banco piscar).
 * Idempotência fica no worker (unique key em `ligacoes`), então retry da
 * Callface ou da fila não duplica registro.
 */
export const dynamic = "force-dynamic";

function signatureValida(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CALLFACE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[CallfaceWebhook] CALLFACE_WEBHOOK_SECRET não configurado — recusando (fail-closed)");
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const sig = request.headers.get("x-callface-signature");
  if (!signatureValida(sig, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    await callfaceCallEventsQueue.add("call-finished", { payload, receivedAt: Date.now() });
  } catch (e) {
    // Fila fora do ar: 500 de propósito pra Callface reenviar o evento.
    console.error("[CallfaceWebhook] falha ao enfileirar evento:", e);
    return NextResponse.json({ error: "queue unavailable, retry" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
