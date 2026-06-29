import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateLabelSchema = z.object({
  nome: z.string().min(1).max(50).optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser hex válido (#RRGGBB)").optional(),
});

// PATCH /api/labels/[id] — update a label
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateLabelSchema.parse(body);

    if (!data.nome && !data.cor) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const [updated] = await db
      .update(labels)
      .set(data)
      .where(and(eq(labels.id, id), eq(labels.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Label não encontrada" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Error updating label:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/labels/[id] — delete a label (cascade removes assignments)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [deleted] = await db
    .delete(labels)
    .where(and(eq(labels.id, id), eq(labels.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Label não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
