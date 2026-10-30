import { Hono } from "hono";
import { db } from "@/lib/db";
import { checkouts, propostas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { registrarAberturaCheckout } from "@/lib/crm/checkout";

const app = new Hono();

/**
 * Bridge page pública (Commercial Core v2, ADR-EXEC-021) — o cliente é
 * direcionado pra cá a partir da proposta pública, ANTES de ir pro checkout
 * hosted do Stripe. Existe pra registrar CheckoutOpened de verdade (não dá
 * pra saber que o cliente "abriu o link de pagamento" se ele só é
 * redirecionado direto pro domínio do Stripe) e preservar nossa
 * identidade visual no passo intermediário.
 *
 * Decisão técnica (verificada antes de codar): a integração Stripe atual é
 * REST direto (sem SDK, sem publishable key) usando Hosted Checkout
 * Sessions — não há Embedded Checkout/Elements configurado no projeto.
 * Migrar pra isso exigiria nova infra (chave pública + @stripe/stripe-js
 * client-side), fora do escopo desta rodada. Por isso o pagamento em si
 * continua no domínio do Stripe (redirect), e esta página é a "casca"
 * nossa antes/depois.
 */
app.get("/checkouts/:id/publica", async (c) => {
  const id = c.req.param("id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return c.json({ error: "Checkout não encontrado" }, 404);
  const [checkout] = await db.select().from(checkouts).where(eq(checkouts.id, id)).limit(1);
  if (!checkout) return c.json({ error: "Checkout não encontrado" }, 404);

  const [proposta] = await db.select({ numero: propostas.numero, versao: propostas.versao, revogado: propostas.linkPublicoRevogadoEm }).from(propostas).where(eq(propostas.id, checkout.propostaId)).limit(1);

  // Link da proposta desativado (D6) desativa também o pagamento que nasceu dele.
  if (proposta?.revogado) return c.json({ error: "Este link foi desativado. Fale com quem te enviou a proposta.", desativado: true }, 410);

  await registrarAberturaCheckout(id);

  return c.json({
    id: checkout.id,
    status: checkout.status,
    stripeCheckoutUrl: checkout.stripeCheckoutUrl,
    propostaId: checkout.propostaId,
    propostaNumero: proposta ? `#P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}` : null,
  });
});

export { app as checkoutsRoutes };
