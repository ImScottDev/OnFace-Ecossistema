import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { enviarPropostaComCheckout } from "@/lib/crm/enviar-proposta";

// POST /api/propostas/:id/enviar — gera checkout Stripe (assinatura) + email pro cliente
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const result = await enviarPropostaComCheckout({
    propostaId: id,
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
    userName: ctx.userName,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    ...result.proposta,
    checkoutUrl: result.checkoutUrl,
    emailSent: result.emailSent,
    emailSkipped: result.emailSkipped,
    emailError: result.emailError,
  });
}
