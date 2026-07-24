import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { negocios, onboardingChecklist } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { itensParaProduto, ITENS_AUTOMATICOS } from "@/lib/onboarding/checklist-config";
import { statusChecklist } from "@/lib/onboarding/checklist-status";

/** GET /api/onboarding/:id/checklist — status dos itens (conjunto varia por produto AI/PABX/AI+PABX). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [neg] = await db
    .select({ camposCustom: negocios.camposCustom, ganhoAt: negocios.ganhoAt })
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!neg) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  const produto = ((neg.camposCustom || {}) as Record<string, unknown>).produto as string | undefined;
  const items = await statusChecklist(id, produto, neg.ganhoAt);

  return NextResponse.json({ items, completo: items.every((i) => i.concluido) });
}

/** PATCH /api/onboarding/:id/checklist — Body: { item, concluido: boolean }. Marca/desmarca 1 item manual (itens automáticos rejeitam). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const item = body?.item as string;
  const concluido = body?.concluido !== false;

  const [neg] = await db
    .select({ id: negocios.id, camposCustom: negocios.camposCustom })
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!neg) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  const produto = ((neg.camposCustom || {}) as Record<string, unknown>).produto as string | undefined;
  const itensValidos = itensParaProduto(produto);
  if (!itensValidos.includes(item)) {
    return NextResponse.json({ error: `item inválido pra este produto: ${item}` }, { status: 400 });
  }
  if (ITENS_AUTOMATICOS.has(item)) {
    return NextResponse.json({ error: `item "${item}" é automático (confirmado por dado real) — não pode marcar manualmente` }, { status: 400 });
  }

  const [existente] = await db
    .select()
    .from(onboardingChecklist)
    .where(and(eq(onboardingChecklist.negocioId, id), eq(onboardingChecklist.item, item)))
    .limit(1);

  if (existente) {
    await db
      .update(onboardingChecklist)
      .set({ concluidoEm: concluido ? new Date() : null, concluidoPor: concluido ? ctx.userId : null })
      .where(eq(onboardingChecklist.id, existente.id));
  } else {
    await db.insert(onboardingChecklist).values({
      organizacaoId: ctx.organizacaoId,
      negocioId: id,
      item,
      concluidoEm: concluido ? new Date() : null,
      concluidoPor: concluido ? ctx.userId : null,
    });
  }

  return NextResponse.json({ ok: true, item, concluido });
}
