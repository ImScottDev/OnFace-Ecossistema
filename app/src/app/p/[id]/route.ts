import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { propostas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCheckoutSessionStatus } from "@/lib/integrations/stripe-sync";
import { enviarPropostaComCheckout } from "@/lib/crm/enviar-proposta";

/**
 * Link curto e branded de pagamento: crm.callface.io/p/<propostaId>
 * Redireciona (302) pro checkout do Stripe da proposta. Usado na mensagem de
 * WhatsApp pra não jogar a URL gigante do Stripe. Público (o cliente clica).
 */
function paginaExpirada(): NextResponse {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link expirado — Callface</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#0b0b10; color:#fff; font-family:-apple-system,Segoe UI,Roboto,sans-serif; text-align:center; padding:24px; }
  .card { max-width:420px; }
  h1 { font-size:20px; margin:0 0 12px; background:linear-gradient(90deg,#e23752,#8e27ef);
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  p { color:rgba(255,255,255,.6); font-size:14px; line-height:1.6; margin:0; }
</style></head>
<body><div class="card"><h1>Este link de pagamento expirou</h1>
<p>O prazo de validade dessa proposta passou. Fale com quem te enviou a proposta na Callface para receber um link atualizado.</p>
</div></body></html>`;
  return new NextResponse(html, { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function paginaBoletoAguardando(): NextResponse {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boleto emitido — Callface</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#0b0b10; color:#fff; font-family:-apple-system,Segoe UI,Roboto,sans-serif; text-align:center; padding:24px; }
  .card { max-width:420px; }
  h1 { font-size:20px; margin:0 0 12px; background:linear-gradient(90deg,#e23752,#8e27ef);
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  p { color:rgba(255,255,255,.6); font-size:14px; line-height:1.6; margin:0; }
</style></head>
<body><div class="card"><h1>Boleto emitido — aguardando compensação</h1>
<p>Você já gerou o boleto desta proposta. A compensação leva até 1 dia útil após o pagamento. Se preferir pagar de outra forma ou o boleto venceu, fale com quem te enviou a proposta na Callface.</p>
</div></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const [p] = await db
      .select({
        checkoutUrl: propostas.checkoutUrl,
        status: propostas.status,
        dataValidade: propostas.dataValidade,
        stripeSessionId: propostas.stripeSessionId,
        organizacaoId: propostas.organizacaoId,
        criadoPorId: propostas.criadoPorId,
      })
      .from(propostas)
      .where(eq(propostas.id, id))
      .limit(1);

    if (p?.status === "expirada") return paginaExpirada();
    // Defensivo: job de expiração roda de hora em hora, então cobre a janela
    // entre a validade vencer e o job rodar (evita pagar com valor desatualizado).
    if (p?.status === "enviada" && p.dataValidade && p.dataValidade < new Date().toISOString().split("T")[0]) {
      return paginaExpirada();
    }
    if (p?.status === "enviada" && p.checkoutUrl) {
      // Checkout Session do Stripe expira em NO MÁXIMO 24h (limite da plataforma) —
      // proposta com validade de dias tinha link morto no dia seguinte (auditoria
      // Stripe 21/07, item 1). Aqui a sessão é checada e, se não estiver mais aberta,
      // um checkout NOVO é gerado na hora (o link curto /p/ continua o mesmo).
      const st = p.stripeSessionId ? await getCheckoutSessionStatus(p.stripeSessionId) : null;
      if (st?.status === "open") {
        return NextResponse.redirect(p.checkoutUrl, 302);
      }
      if (st?.status === "complete" && st.payment_status !== "paid") {
        // Boleto emitido, aguardando compensar. NÃO gerar 2º checkout: o cliente
        // poderia pagar duas vezes (boleto + cartão) e virar assinatura duplicada.
        return paginaBoletoAguardando();
      }
      if (st?.status === "complete" && st.payment_status === "paid") {
        return NextResponse.redirect(new URL(process.env.CHECKOUT_SUCCESS_URL || "/obrigado", req.url), 302);
      }
      // Sessão expirada (ou não consultável): regenera o checkout mantendo o link curto.
      if (p.criadoPorId) {
        const regen = await enviarPropostaComCheckout({
          propostaId: id,
          organizacaoId: p.organizacaoId,
          userId: p.criadoPorId,
          skipEmail: true,
        });
        if (regen.ok) {
          return NextResponse.redirect(regen.checkoutUrl, 302);
        }
      }
      // Regeneração indisponível (ex.: Stripe fora / proposta sem criador) —
      // melhor mandar pro link antigo do que pra home.
      return NextResponse.redirect(p.checkoutUrl, 302);
    }
    if (p?.checkoutUrl) {
      return NextResponse.redirect(p.checkoutUrl, 302);
    }
  } catch {
    /* fall through */
  }
  // sem checkout (proposta não enviada / inexistente) → manda pra home
  return NextResponse.redirect(new URL("/", req.url), 302);
}
