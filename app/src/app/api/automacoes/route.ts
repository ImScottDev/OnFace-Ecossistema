import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automacoes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createAutomacaoSchema = z.object({
  nome: z.string().min(1).max(100),
  gatilho: z.enum([
    "novo_lead",
    "mudanca_status",
    "novo_negocio",
    "lead_inativo",
    "contrato_vencendo",
    "whatsapp_recebido",
    "nps_recebido",
  ]),
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
  ]),
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
  ativo: z.boolean().default(true),
});

// GET /api/automacoes — list all automations for current org
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const result = await db
    .select()
    .from(automacoes)
    .where(eq(automacoes.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(automacoes.createdAt));

  return NextResponse.json(result);
}

// POST /api/automacoes — create a new automation
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createAutomacaoSchema.parse(body);

    const [newAutomacao] = await db
      .insert(automacoes)
      .values({
        organizacaoId: ctx.organizacaoId,
        nome: data.nome,
        gatilho: data.gatilho,
        condicao: data.condicao || null,
        acao: data.acao,
        acaoConfig: data.acaoConfig || null,
        ativo: data.ativo,
      })
      .returning();

    return NextResponse.json(newAutomacao, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Error creating automacao:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
