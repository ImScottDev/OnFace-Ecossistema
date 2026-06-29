import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailSequencias, emailSequenciaPassos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const passoSchema = z.object({
  ordem: z.number().int().min(0),
  tipo: z.enum(["email", "espera", "condicao"]),
  templateId: z.string().uuid().optional(),
  delayMinutos: z.number().int().min(0).default(0),
  condicao: z.record(z.string(), z.unknown()).optional(),
});

const updateSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  descricao: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
  gatilho: z.enum(["manual", "novo_lead", "mudanca_status"]).optional(),
  gatilhoConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  passos: z.array(passoSchema).optional(),
});

// PATCH /api/email/sequencias/:id
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

    const { passos, ...seqData } = data;

    const [updated] = await db.update(emailSequencias)
      .set({ ...seqData, updatedAt: new Date() })
      .where(and(eq(emailSequencias.id, id), eq(emailSequencias.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Sequência não encontrada" }, { status: 404 });

    // Replace steps if provided
    if (passos) {
      await db.delete(emailSequenciaPassos).where(eq(emailSequenciaPassos.sequenciaId, id));
      for (const passo of passos) {
        await db.insert(emailSequenciaPassos).values({
          sequenciaId: id,
          ordem: passo.ordem,
          tipo: passo.tipo,
          templateId: passo.templateId || null,
          delayMinutos: passo.delayMinutos,
          condicao: passo.condicao || null,
        });
      }
    }

    const updatedPassos = await db.select()
      .from(emailSequenciaPassos)
      .where(eq(emailSequenciaPassos.sequenciaId, id))
      .orderBy(emailSequenciaPassos.ordem);

    return NextResponse.json({ ...updated, passos: updatedPassos });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/email/sequencias/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [deleted] = await db.delete(emailSequencias)
    .where(and(eq(emailSequencias.id, id), eq(emailSequencias.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Sequência não encontrada" }, { status: 404 });
  return NextResponse.json({ success: true });
}
