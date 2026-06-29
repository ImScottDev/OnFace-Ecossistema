import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { syncStripe } from "@/lib/integrations/stripe-sync";
import { db } from "@/lib/db";
import { propostas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { marcarPropostaAceita } from "@/lib/crm/aceitar-proposta";

/**
 * checkout.session.completed: o cliente pagou. Acha a proposta pela metadata
 * (gravada na criação do checkout) e marca como aceita → negócio ganho +
 * contrato + cliente. Idempotente (só age se ainda estiver 'enviada').
 */
async function handleCheckoutCompleted(session: Record<string, unknown>): Promise<string> {
  const metadata = (session.metadata as Record<string, string> | undefined) || {};
  const propostaId = metadata.propostaId;
  if (!propostaId) return "sem propostaId na metadata";

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  if (!proposta) return `proposta ${propostaId} não encontrada`;
  if (proposta.status === "aceita") return "proposta já estava aceita (idempotente)";
  if (proposta.status !== "enviada") return `proposta em status '${proposta.status}', ignorando`;

  const { contratoId } = await marcarPropostaAceita({
    proposta,
    organizacaoId: proposta.organizacaoId,
    userId: proposta.criadoPorId, // ator: quem criou a proposta
  });
  return `proposta ${propostaId} aceita via pagamento, contrato ${contratoId}`;
}

// POST /api/webhooks/stripe
// Recebe eventos do Stripe em TEMPO REAL (pagamento, assinatura, cancelamento,
// checkout) e dispara um sync incremental. Configurar no painel Stripe:
//   Developers > Webhooks > Add endpoint: https://crm.callface.io/api/webhooks/stripe
//   Eventos: invoice.paid, invoice.payment_failed, customer.subscription.*,
//            checkout.session.completed
//   Copiar o "Signing secret" (whsec_...) -> STRIPE_WEBHOOK_SECRET no .env.
export const dynamic = "force-dynamic";

const RELEVANT = new Set([
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "checkout.session.completed",
]);

function verify(payload: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = request.headers.get("stripe-signature");

  if (secret) {
    if (!verify(payload, sig, secret)) {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }
  } else {
    console.warn("[StripeWebhook] STRIPE_WEBHOOK_SECRET não configurado — aceitando sem verificar (configurar no .env!)");
  }

  let event: { type?: string; id?: string };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const type = event.type || "";
  if (!RELEVANT.has(type)) {
    return NextResponse.json({ received: true, ignored: type });
  }

  // Pagamento confirmado no checkout → marca a proposta aceita (ganho + contrato + cliente)
  if (type === "checkout.session.completed") {
    try {
      const session = (event as { data?: { object?: Record<string, unknown> } }).data?.object || {};
      const r = await handleCheckoutCompleted(session);
      console.log(`[StripeWebhook] checkout.session.completed -> ${r}`);
    } catch (e) {
      console.error("[StripeWebhook] erro ao aceitar proposta:", e);
    }
  }

  // Sync incremental (idempotente: upsert por stripe id). Reconcilia assinaturas/faturas/churn.
  try {
    const r = await syncStripe();
    console.log(`[StripeWebhook] ${type} -> sync: ${r.subs} subs, ${r.faturas} faturas, ${r.churns} churns`);
    return NextResponse.json({ received: true, type, synced: r });
  } catch (e) {
    console.error("[StripeWebhook] erro no sync:", e);
    // 200 mesmo assim p/ o Stripe não ficar reenviando; o polling de 30min cobre.
    return NextResponse.json({ received: true, type, syncError: String(e) });
  }
}
