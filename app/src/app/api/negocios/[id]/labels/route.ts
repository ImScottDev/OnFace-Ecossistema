import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labels, negocioLabels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const labelAssignSchema = z.object({
  labelId: z.string().uuid(),
});

// GET /api/negocios/[id]/labels
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id: negocioId } = await params;

  const result = await db
    .select({
      id: labels.id,
      nome: labels.nome,
      cor: labels.cor,
      assignedAt: negocioLabels.createdAt,
    })
    .from(negocioLabels)
    .innerJoin(labels, eq(negocioLabels.labelId, labels.id))
    .where(
      and(
        eq(negocioLabels.negocioId, negocioId),
        eq(labels.organizacaoId, ctx.organizacaoId)
      )
    );

  return NextResponse.json(result);
}

// POST /api/negocios/[id]/labels
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id: negocioId } = await params;

  try {
    const body = await request.json();
    const { labelId } = labelAssignSchema.parse(body);

    const [label] = await db
      .select()
      .from(labels)
      .where(and(eq(labels.id, labelId), eq(labels.organizacaoId, ctx.organizacaoId)));

    if (!label) {
      return NextResponse.json({ error: "Label não encontrada" }, { status: 404 });
    }

    const [existing] = await db
      .select()
      .from(negocioLabels)
      .where(and(eq(negocioLabels.negocioId, negocioId), eq(negocioLabels.labelId, labelId)));

    if (existing) {
      return NextResponse.json({ message: "Label já atribuída" }, { status: 200 });
    }

    const [assignment] = await db
      .insert(negocioLabels)
      .values({ negocioId, labelId })
      .returning();

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Error assigning label:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/negocios/[id]/labels
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id: negocioId } = await params;

  try {
    const body = await request.json();
    const { labelId } = labelAssignSchema.parse(body);

    const [deleted] = await db
      .delete(negocioLabels)
      .where(and(eq(negocioLabels.negocioId, negocioId), eq(negocioLabels.labelId, labelId)))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Atribuição não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Error removing label:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
