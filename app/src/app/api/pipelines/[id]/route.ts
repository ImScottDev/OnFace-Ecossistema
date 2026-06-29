import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipelines, negocios } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updatePipelineSchema = z.object({
  nome: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  ordem: z.number().int().optional(),
  stages: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string(),
    slaHours: z.number().optional(),
  })).optional(),
  closedStages: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string(),
  })).optional(),
  isDefault: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

// GET /api/pipelines/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizacaoId, ctx.organizacaoId)));

  if (!pipeline) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  return NextResponse.json(pipeline);
}

// PUT /api/pipelines/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updatePipelineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.nome !== undefined) updateData.nome = parsed.data.nome;
  if (parsed.data.slug !== undefined) updateData.slug = parsed.data.slug;
  if (parsed.data.ordem !== undefined) updateData.ordem = parsed.data.ordem;
  if (parsed.data.stages !== undefined) updateData.stages = parsed.data.stages;
  if (parsed.data.closedStages !== undefined) updateData.closedStages = parsed.data.closedStages;
  if (parsed.data.isDefault !== undefined) updateData.isDefault = parsed.data.isDefault;
  if (parsed.data.ativo !== undefined) updateData.ativo = parsed.data.ativo;

  const [updated] = await db
    .update(pipelines)
    .set(updateData)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/pipelines/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;

  // Check if pipeline has associated deals
  const [{ total }] = await db
    .select({ total: count() })
    .from(negocios)
    .where(eq(negocios.pipelineId, id));

  if (total > 0) {
    return NextResponse.json(
      { error: `Não é possível excluir: ${total} negócio(s) vinculado(s). Mova-os para outro pipeline primeiro.` },
      { status: 409 }
    );
  }

  const [deleted] = await db
    .delete(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  return NextResponse.json({ success: true });
}
