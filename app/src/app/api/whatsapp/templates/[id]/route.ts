import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whatsappTemplates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateTemplateSchema = z.object({
  nome: z.string().min(1).optional(),
  categoria: z
    .enum(["primeiro_contato", "follow_up", "proposta", "pos_venda", "geral"])
    .optional(),
  conteudo: z.string().min(1).optional(),
  botoes: z.any().optional(),
});

// PATCH /api/whatsapp/templates/:id — update a template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(whatsappTemplates)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Template nao encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}

// DELETE /api/whatsapp/templates/:id — soft delete (set ativo=false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [updated] = await db
    .update(whatsappTemplates)
    .set({ ativo: false, updatedAt: new Date() })
    .where(and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Template nao encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
