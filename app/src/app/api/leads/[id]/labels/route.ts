import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labels, leadLabels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const labelAssignSchema = z.object({
  labelId: z.string().uuid(),
});

// GET /api/leads/[id]/labels — get labels for a lead
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id: leadId } = await params;

  const result = await db
    .select({
      id: labels.id,
      nome: labels.nome,
      cor: labels.cor,
      assignedAt: leadLabels.createdAt,
    })
    .from(leadLabels)
    .innerJoin(labels, eq(leadLabels.labelId, labels.id))
    .where(
      and(
        eq(leadLabels.leadId, leadId),
        eq(labels.organizacaoId, ctx.organizacaoId)
      )
    );

  return NextResponse.json(result);
}

// POST /api/leads/[id]/labels — assign label to lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id: leadId } = await params;

  try {
    const body = await request.json();
    const { labelId } = labelAssignSchema.parse(body);

    // Verify label belongs to same org
    const [label] = await db
      .select()
      .from(labels)
      .where(and(eq(labels.id, labelId), eq(labels.organizacaoId, ctx.organizacaoId)));

    if (!label) {
      return NextResponse.json({ error: "Label não encontrada" }, { status: 404 });
    }

    // Check if already assigned (upsert-like)
    const [existing] = await db
      .select()
      .from(leadLabels)
      .where(and(eq(leadLabels.leadId, leadId), eq(leadLabels.labelId, labelId)));

    if (existing) {
      return NextResponse.json({ message: "Label já atribuída" }, { status: 200 });
    }

    const [assignment] = await db
      .insert(leadLabels)
      .values({ leadId, labelId })
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

// DELETE /api/leads/[id]/labels — remove label from lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id: leadId } = await params;

  try {
    const body = await request.json();
    const { labelId } = labelAssignSchema.parse(body);

    const [deleted] = await db
      .delete(leadLabels)
      .where(and(eq(leadLabels.leadId, leadId), eq(leadLabels.labelId, labelId)))
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
