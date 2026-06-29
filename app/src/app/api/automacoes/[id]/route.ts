import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automacoes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateAutomacaoSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  gatilho: z.enum([
    "novo_lead",
    "mudanca_status",
    "novo_negocio",
    "lead_inativo",
    "contrato_vencendo",
    "whatsapp_recebido",
    "nps_recebido",
  ]).optional(),
  condicao: z.object({
    campo: z.string().optional(),
    operador: z.enum(["igual", "diferente", "contem", "maior_que", "menor_que"]).optional(),
    valor: z.string().optional(),
  }).optional().nullable(),
  acao: z.enum([
    "enviar_email",
    "criar_tarefa",
    "notificar_usuario",
    "atribuir_responsavel",
    "mudar_status",
    "enviar_whatsapp",
  ]).optional(),
  acaoConfig: z.object({
    templateId: z.string().uuid().optional(),
    tituloTarefa: z.string().optional(),
    tipoTarefa: z.string().optional(),
    prioridade: z.enum(["baixa", "media", "alta"]).optional(),
    usuarioId: z.string().uuid().optional(),
    novoStatus: z.string().optional(),
    mensagem: z.string().optional(),
    diasInatividade: z.number().int().positive().optional(),
    diasAntesVencimento: z.number().int().positive().optional(),
  }).optional().nullable(),
  ativo: z.boolean().optional(),
});

// GET /api/automacoes/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [automacao] = await db
    .select()
    .from(automacoes)
    .where(and(eq(automacoes.id, id), eq(automacoes.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!automacao) {
    return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });
  }

  return NextResponse.json(automacao);
}

// PATCH /api/automacoes/[id] — update an automation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateAutomacaoSchema.parse(body);

    const [updated] = await db
      .update(automacoes)
      .set(data)
      .where(and(eq(automacoes.id, id), eq(automacoes.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Error updating automacao:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/automacoes/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [deleted] = await db
    .delete(automacoes)
    .where(and(eq(automacoes.id, id), eq(automacoes.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
