import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { extractVariables } from "@/lib/email/template-engine";

const updateSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  assunto: z.string().min(1).optional(),
  corpo: z.string().min(1).optional(),
  categoria: z.string().nullable().optional(),
});

// PATCH /api/email/templates/:id
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

    // Re-extract variables if content changed
    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.assunto || data.corpo) {
      const [current] = await db.select({ assunto: emailTemplates.assunto, corpo: emailTemplates.corpo })
        .from(emailTemplates)
        .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (current) {
        const newAssunto = data.assunto || current.assunto;
        const newCorpo = data.corpo || current.corpo;
        updates.variaveis = extractVariables(newAssunto + " " + newCorpo);
      }
    }

    const [updated] = await db.update(emailTemplates)
      .set(updates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/email/templates/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [deleted] = await db.delete(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  return NextResponse.json({ success: true });
}
