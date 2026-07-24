import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { getAging, getFilaCobranca, getRecuperacao, getClientesRisco } from "@/lib/financeiro/metricas";

/**
 * GET /api/financeiro/cobranca?produto=todos|ai|pabx
 *
 * Payload da aba "Cobrança & Inadimplência": aging em faixas, fila de ação
 * (quem cobrar primeiro), taxa de recuperação de pagamento falho, clientes em risco.
 */
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const orgId = ctx.organizacaoId;
  const produtoParam = request.nextUrl.searchParams.get("produto") || "todos";
  const produto = produtoParam === "todos" ? undefined : produtoParam;

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [aging, fila, recuperacao, risco] = await Promise.all([
    getAging(orgId, produto),
    getFilaCobranca(orgId),
    getRecuperacao(orgId, { inicio: inicioMes, fim: hoje }),
    getClientesRisco(orgId),
  ]);

  return NextResponse.json({ aging, fila, recuperacao, risco });
}
