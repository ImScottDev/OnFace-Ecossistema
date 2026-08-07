import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { negocios, atividades } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const STAGES = ["aguardando_pagamento", "faturamento", "setup", "em_andamento", "concluido"];

/**
 * PATCH /api/onboarding/:id — move o card de onboarding de coluna.
 * Body: { stage: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const stage = body?.stage as string;
  if (!STAGES.includes(stage)) {
    return NextResponse.json({ error: `stage inválido: ${stage}` }, { status: 400 });
  }

  const [neg] = await db
    .select({ id: negocios.id, leadId: negocios.leadId, camposCustom: negocios.camposCustom })
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!neg) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  const cc = (neg.camposCustom || {}) as Record<string, unknown>;
  const anterior = (cc.onboardingStage as string) || "?";
  cc.onboardingStage = stage;

  await db
    .update(negocios)
    .set({ camposCustom: cc, updatedAt: new Date() })
    .where(eq(negocios.id, id));

  if (neg.leadId) {
    await db.insert(atividades).values({
      organizacaoId: ctx.organizacaoId,
      leadId: neg.leadId,
      negocioId: neg.id,
      usuarioId: ctx.userId,
      tipo: "nota",
      titulo: `Onboarding: ${anterior} → ${stage}`,
    });
  }

  return NextResponse.json({ ok: true, stage });
}
