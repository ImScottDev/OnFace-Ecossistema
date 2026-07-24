import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { negocios, atividades } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { statusChecklist } from "@/lib/onboarding/checklist-status";
import { criarContaCsAoFinalizarOnboarding } from "@/lib/cs/health-score";

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
    .select({ id: negocios.id, leadId: negocios.leadId, camposCustom: negocios.camposCustom, ganhoAt: negocios.ganhoAt })
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!neg) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  const cc = (neg.camposCustom || {}) as Record<string, unknown>;
  const anterior = (cc.onboardingStage as string) || "?";
  const produto = cc.produto as string | undefined;

  // Critério de conclusão real (Onda 1 do CS, ver callface/onboarding-cs.md):
  // conjunto de itens varia por produto (AI x PABX são processos diferentes,
  // não o mesmo checklist genérico) — só chega em "concluido" com todos
  // marcados (manuais + automáticos, ex: primeiro uso real via ligacoes).
  if (stage === "concluido" && anterior !== "concluido") {
    const itens = await statusChecklist(id, produto, neg.ganhoAt);
    const faltando = itens.filter((i) => !i.concluido).map((i) => i.item);
    if (faltando.length > 0) {
      return NextResponse.json(
        { error: `Onboarding não pode ser concluído: faltam ${faltando.join(", ")}` },
        { status: 400 }
      );
    }
  }

  cc.onboardingStage = stage;

  await db
    .update(negocios)
    .set({ camposCustom: cc, updatedAt: new Date() })
    .where(eq(negocios.id, id));

  if (stage === "concluido" && anterior !== "concluido") {
    await criarContaCsAoFinalizarOnboarding(id);
  }

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
