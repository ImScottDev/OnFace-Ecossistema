import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateSchema = z.object({
  nome: z.string().optional(),
  syncStatus: z.enum(["active", "paused"]).optional(),
  isDefault: z.boolean().optional(),
});

// PATCH /api/email/contas/:id — update account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await db.update(emailContas)
        .set({ isDefault: false })
        .where(eq(emailContas.organizacaoId, ctx.organizacaoId));
    }

    const [updated] = await db.update(emailContas)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailContas.id, id), eq(emailContas.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/email/contas/:id — remove account
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [deleted] = await db.delete(emailContas)
    .where(and(eq(emailContas.id, id), eq(emailContas.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  return NextResponse.json({ success: true });
}
