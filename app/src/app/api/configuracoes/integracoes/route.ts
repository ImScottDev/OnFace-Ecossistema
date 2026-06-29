import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";

// GET — return integration config (key masked)
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") return forbiddenResponse();

  const [org] = await db
    .select({ apolloApiKey: organizacoes.apolloApiKey })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const key = org?.apolloApiKey || "";
  const masked = key ? key.slice(0, 4) + "•".repeat(Math.max(0, key.length - 8)) + key.slice(-4) : "";

  return NextResponse.json({
    apolloApiKey: masked,
    apolloConfigured: !!key,
  });
}

// PATCH — update integration config
export async function PATCH(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") return forbiddenResponse();

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if ("apolloApiKey" in body) {
    updates.apolloApiKey = body.apolloApiKey || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  await db
    .update(organizacoes)
    .set(updates)
    .where(eq(organizacoes.id, ctx.organizacaoId));

  return NextResponse.json({ ok: true });
}
