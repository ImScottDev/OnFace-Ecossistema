import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { negocios, leads, empresas } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

/**
 * GET /api/onboarding
 *
 * Board de Onboarding (pós-ganho). Cards = negócios GANHOS com
 * camposCustom.onboardingStage definido (fluxo decidido pelo Scott 12/jun):
 *   - AI:   aguardando_pagamento → em_andamento → concluido (sem Setup)
 *   - PABX: faturamento (Wevy) → setup → concluido
 */
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const incluirConcluidos = request.nextUrl.searchParams.get("concluidos") === "1";

  const rows = await db
    .select({
      id: negocios.id,
      titulo: negocios.titulo,
      valorTotal: negocios.valorTotal,
      camposCustom: negocios.camposCustom,
      ganhoAt: negocios.ganhoAt,
      updatedAt: negocios.updatedAt,
      leadId: negocios.leadId,
      leadNome: leads.nome,
      empresaNome: empresas.nome,
    })
    .from(negocios)
    .leftJoin(leads, eq(negocios.leadId, leads.id))
    .leftJoin(empresas, eq(negocios.empresaId, empresas.id))
    .where(
      and(
        eq(negocios.organizacaoId, ctx.organizacaoId),
        eq(negocios.status, "ganho"),
        sql`${negocios.camposCustom} ->> 'onboardingStage' IS NOT NULL`
      )
    )
    .orderBy(sql`${negocios.updatedAt} DESC`)
    .limit(500);

  const items = rows
    .map((r) => {
      const cc = (r.camposCustom || {}) as Record<string, unknown>;
      return {
        id: r.id,
        titulo: r.titulo,
        valorTotal: r.valorTotal,
        ganhoAt: r.ganhoAt,
        leadId: r.leadId,
        leadNome: r.leadNome,
        empresaNome: r.empresaNome,
        stage: (cc.onboardingStage as string) || "aguardando_pagamento",
        produto: (cc.produto as string) || "ai",
      };
    })
    .filter((i) => incluirConcluidos || i.stage !== "concluido");

  return NextResponse.json({ items });
}
