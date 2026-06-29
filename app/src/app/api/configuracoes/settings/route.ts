import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/configuracoes/settings — retorna o objeto settings da org (ICP, tracking, handover, etc)
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const [org] = await db
    .select({ settings: organizacoes.settings })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  return NextResponse.json((org?.settings as Record<string, unknown>) || {});
}

// PATCH /api/configuracoes/settings — merge por chave: { key: "icp", value: {...} }
export async function PATCH(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await req.json();

  const [org] = await db
    .select({ settings: organizacoes.settings })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const current = (org?.settings as Record<string, unknown>) || {};
  const next: Record<string, unknown> = { ...current };

  if (body.key) {
    next[body.key] = body.value;
  } else {
    Object.assign(next, body);
  }

  await db
    .update(organizacoes)
    .set({ settings: next, updatedAt: new Date() })
    .where(eq(organizacoes.id, ctx.organizacaoId));

  return NextResponse.json({ ok: true, settings: next });
}
