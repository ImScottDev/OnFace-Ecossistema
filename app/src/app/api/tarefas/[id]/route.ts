import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tarefas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateTarefaSchema = z.object({
  titulo: z.string().min(1).optional(),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["follow_up", "ligar", "enviar_proposta", "diagnostico", "renovacao", "nps", "upsell", "geral"]).optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  dataVencimento: z.string().optional().nullable(),
  concluida: z.boolean().optional(),
});

// PATCH /api/tarefas/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateTarefaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify tarefa belongs to user (which is already org-scoped via usuario)
  const [existing] = await db
    .select({ id: tarefas.id })
    .from(tarefas)
    .where(and(eq(tarefas.id, id), eq(tarefas.usuarioId, ctx.userId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Tarefa nao encontrada" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  // When marking as concluida, set concluidaEm
  if (parsed.data.concluida === true) {
    updateData.concluidaEm = new Date();
  } else if (parsed.data.concluida === false) {
    updateData.concluidaEm = null;
  }

  const [updated] = await db
    .update(tarefas)
    .set(updateData)
    .where(eq(tarefas.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Tarefa nao encontrada" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
