import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateSchema = z.object({
  conteudo: z.string().min(1),
});

// PATCH /api/notas/:id — update note content
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [existing] = await db
    .select({ id: notas.id })
    .from(notas)
    .where(and(eq(notas.id, id), eq(notas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const [updated] = await db
      .update(notas)
      .set({ conteudo: data.conteudo, updatedAt: new Date() })
      .where(eq(notas.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/notas/:id — hard delete note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [existing] = await db
    .select({ id: notas.id })
    .from(notas)
    .where(and(eq(notas.id, id), eq(notas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  }

  await db.delete(notas).where(eq(notas.id, id));

  return NextResponse.json({ success: true });
}
