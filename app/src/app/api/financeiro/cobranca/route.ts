import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";
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
  // Gate por PERMISSÃO, não por cargo (SPEC §31). `isAdminView` responde
  // "é gestão?"; esta pergunta é "pode fazer isto?", que é o que permite
  // separar leitura de escrita e delegar para agente sem dar tudo.
  if (!(await temPermissao({ usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" }, "finance.read"))) {
    return forbiddenResponse();
  }
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
