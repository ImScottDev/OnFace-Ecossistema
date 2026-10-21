import { NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { consultarQualidadeDados } from "@/lib/relatorios/qualidade-dados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const podeLer = await temPermissao({
    usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId,
    role: ctx.userRole, tipo: "HUMAN",
  }, "finance.read");
  if (!podeLer) return forbiddenResponse();
  const resposta = await consultarQualidadeDados(ctx.organizacaoId);
  return NextResponse.json(resposta, { headers: { "Cache-Control": "no-store" } });
}
