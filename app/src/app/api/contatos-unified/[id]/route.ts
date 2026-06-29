import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// PATCH /api/contatos-unified/:id — update contato fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();

  // Only allow updating safe fields
  const allowed = ["nome", "email", "telefone", "empresa", "cargo", "linkedin", "origem", "status"] as const;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const [updated] = await db
    .update(leads)
    .set(updates)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });

  return NextResponse.json(updated);
}

// DELETE /api/contatos-unified/:id — delete contato
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  await db
    .delete(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)));

  return NextResponse.json({ ok: true });
}
