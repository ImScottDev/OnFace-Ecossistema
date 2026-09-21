import { Hono } from "hono";
import { db } from "@/lib/db";
import { automacoes, automacaoExecucoes } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getCtx, exigirCtx } from "../compat.js";

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
    "pagamento_falhou",
    "fatura_atrasada",
    "fatura_paga",
    "assinatura_status_alterado",
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
    "adicionar_tag_empresa",
    "remover_tag_empresa",
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
    tag: z.string().min(1).max(80).optional(),
  }).optional().nullable(),
  ativo: z.boolean().default(true),
});

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
    "pagamento_falhou",
    "fatura_atrasada",
    "fatura_paga",
    "assinatura_status_alterado",
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
    "adicionar_tag_empresa",
    "remover_tag_empresa",
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
    tag: z.string().min(1).max(80).optional(),
  }).optional().nullable(),
  ativo: z.boolean().optional(),
});

const app = new Hono();

// GET /automacoes — list all automations for current org
app.get("/", async (c) => {
  const ctx = await getCtx(c);

  const result = await db
    .select()
    .from(automacoes)
    .where(eq(automacoes.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(automacoes.createdAt));

  return c.json(result);
});

// POST /automacoes — create a new automation
app.post("/", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");

  try {
    const body = await c.req.json();
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

    return c.json(newAutomacao, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("Error creating automacao:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// GET /automacoes/execucoes-resumo — total + última execução por regra
// (mapa automacaoId -> {total, ultima}). PRECISA vir antes de /:id (Hono
// trataria "execucoes-resumo" como :id senão, mesmo padrão de outras rotas).
app.get("/execucoes-resumo", async (c) => {
  const ctx = await getCtx(c);

  const rows = await db
    .select({
      automacaoId: automacaoExecucoes.automacaoId,
      total: sql<number>`count(*)`,
      ultima: sql<Date>`max(${automacaoExecucoes.executedAt})`,
    })
    .from(automacaoExecucoes)
    .where(eq(automacaoExecucoes.organizacaoId, ctx.organizacaoId))
    .groupBy(automacaoExecucoes.automacaoId);

  const resumo: Record<string, { total: number; ultima: Date }> = {};
  for (const r of rows) resumo[r.automacaoId] = { total: Number(r.total), ultima: r.ultima };

  return c.json(resumo);
});

// GET /automacoes/:id
app.get("/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [automacao] = await db
    .select()
    .from(automacoes)
    .where(and(eq(automacoes.id, id), eq(automacoes.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!automacao) {
    return c.json({ error: "Automação não encontrada" }, 404);
  }

  return c.json(automacao);
});

// GET /automacoes/:id/execucoes — histórico recente de execuções da regra
app.get("/:id/execucoes", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const rows = await db
    .select({
      id: automacaoExecucoes.id,
      entityType: automacaoExecucoes.entityType,
      entityId: automacaoExecucoes.entityId,
      status: automacaoExecucoes.status,
      erro: automacaoExecucoes.erro,
      executedAt: automacaoExecucoes.executedAt,
    })
    .from(automacaoExecucoes)
    .where(and(eq(automacaoExecucoes.automacaoId, id), eq(automacaoExecucoes.organizacaoId, ctx.organizacaoId)))
    .orderBy(desc(automacaoExecucoes.executedAt))
    .limit(20);

  return c.json(rows);
});

// PATCH /automacoes/:id — update an automation
app.patch("/:id", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const data = updateAutomacaoSchema.parse(body);

    const [updated] = await db
      .update(automacoes)
      .set(data)
      .where(and(eq(automacoes.id, id), eq(automacoes.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) {
      return c.json({ error: "Automação não encontrada" }, 404);
    }

    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("Error updating automacao:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// DELETE /automacoes/:id
app.delete("/:id", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  const id = c.req.param("id");

  const [deleted] = await db
    .delete(automacoes)
    .where(and(eq(automacoes.id, id), eq(automacoes.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Automação não encontrada" }, 404);
  }

  return c.json({ success: true });
});

export const automacoesRoutes = app;
