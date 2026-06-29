import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  tipo: z.enum(["text", "number", "date", "daterange", "enum", "boolean", "url"]).optional(),
  opcoes: z.array(z.string()).optional().nullable(),
  obrigatorio: z.boolean().optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

// PUT /api/custom-fields/[id]
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.label !== undefined) updateData.label = parsed.data.label;
  if (parsed.data.tipo !== undefined) updateData.tipo = parsed.data.tipo;
  if (parsed.data.opcoes !== undefined) updateData.opcoes = parsed.data.opcoes;
  if (parsed.data.obrigatorio !== undefined) updateData.obrigatorio = parsed.data.obrigatorio;
  if (parsed.data.ordem !== undefined) updateData.ordem = parsed.data.ordem;
  if (parsed.data.ativo !== undefined) updateData.ativo = parsed.data.ativo;

  const [updated] = await db
    .update(customFields)
    .set(updateData)
    .where(and(eq(customFields.id, id), eq(customFields.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Campo não encontrado" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/custom-fields/[id]
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

  // Soft delete
  const [updated] = await db
    .update(customFields)
    .set({ ativo: false, updatedAt: new Date() })
    .where(and(eq(customFields.id, id), eq(customFields.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Campo não encontrado" }, { status: 404 });
  return NextResponse.json({ success: true });
}
