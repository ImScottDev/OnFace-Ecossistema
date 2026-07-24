import { Hono } from "hono";
import { db } from "@/lib/db";
import { tarefas, leads } from "@/lib/db/schema";
import { desc, eq, and, lte, SQL, asc, isNull } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();

const createTarefaSchema = z.object({
  leadId: z.string().uuid().optional().nullable(),
  negocioId: z.string().uuid().optional().nullable(),
  titulo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["follow_up", "ligar", "enviar_proposta", "diagnostico", "renovacao", "nps", "upsell", "geral"]),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  dataVencimento: z.string().optional().nullable(),
  venceEm: z.string().optional().nullable(), // data+hora ISO (lembrete/follow-up)
});

const updateTarefaSchema = z.object({
  titulo: z.string().min(1).optional(),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["follow_up", "ligar", "enviar_proposta", "diagnostico", "renovacao", "nps", "upsell", "geral"]).optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  dataVencimento: z.string().optional().nullable(),
  concluida: z.boolean().optional(),
});

// GET /api/tarefas
app.get("/tarefas", async (c) => {
  const ctx = await getCtx(c);

  const concluida = c.req.query("concluida") ?? null;
  const leadId = c.req.query("leadId") ?? null;
  const negocioId = c.req.query("negocioId") ?? null;
  const tipo = c.req.query("tipo") ?? null;
  const data = c.req.query("data") || "all";

  // Por negócio: mostra as tarefas do negócio pro time todo (contexto do card).
  // Sem negócio: "Minhas Tarefas" (só as do usuário).
  const conditions: SQL[] = negocioId
    ? [eq(tarefas.negocioId, negocioId), eq(tarefas.organizacaoId, ctx.organizacaoId)]
    : [eq(tarefas.usuarioId, ctx.userId)];

  if (concluida !== null && concluida !== "") {
    conditions.push(eq(tarefas.concluida, concluida === "true"));
  } else {
    // Default: pending
    conditions.push(eq(tarefas.concluida, false));
  }

  if (leadId) {
    conditions.push(eq(tarefas.leadId, leadId));
  }

  if (tipo) {
    conditions.push(eq(tarefas.tipo, tipo));
  }

  if (data === "today") {
    const today = new Date().toISOString().split("T")[0];
    conditions.push(lte(tarefas.dataVencimento, today));
  } else if (data === "overdue") {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    conditions.push(lte(tarefas.dataVencimento, yesterday));
  }

  const where = and(...conditions);

  const prioridadeOrder = [
    { value: "urgente", rank: 0 },
    { value: "alta", rank: 1 },
    { value: "media", rank: 2 },
    { value: "baixa", rank: 3 },
  ];

  const result = await db
    .select()
    .from(tarefas)
    .where(where)
    .orderBy(asc(tarefas.dataVencimento), asc(tarefas.createdAt));

  // Sort by prioridade in JS since drizzle doesn't have CASE easily
  result.sort((a, b) => {
    // First by dataVencimento
    if (a.dataVencimento && b.dataVencimento) {
      if (a.dataVencimento < b.dataVencimento) return -1;
      if (a.dataVencimento > b.dataVencimento) return 1;
    } else if (a.dataVencimento && !b.dataVencimento) return -1;
    else if (!a.dataVencimento && b.dataVencimento) return 1;

    // Then by prioridade
    const rankA = prioridadeOrder.find((p) => p.value === a.prioridade)?.rank ?? 2;
    const rankB = prioridadeOrder.find((p) => p.value === b.prioridade)?.rank ?? 2;
    return rankA - rankB;
  });

  return c.json({ tarefas: result });
});

// POST /api/tarefas
app.post("/tarefas", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createTarefaSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }

  // If leadId provided, verify it belongs to org
  if (parsed.data.leadId) {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, parsed.data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!lead) {
      return c.json({ error: "Lead nao encontrado" }, 404);
    }
  }

  // venceEm = data+hora combinadas; deriva também data_vencimento (parte data) pra
  // compatibilidade com o dashboard "Tarefas do Dia" (que filtra por data_vencimento).
  const venceEm = parsed.data.venceEm ? new Date(parsed.data.venceEm) : null;
  const dataVenc =
    parsed.data.dataVencimento ||
    (venceEm && !isNaN(venceEm.getTime()) ? venceEm.toISOString().split("T")[0] : null);

  const [tarefa] = await db
    .insert(tarefas)
    .values({
      organizacaoId: ctx.organizacaoId, // faltava: sem isso não aparece no dashboard
      leadId: parsed.data.leadId,
      negocioId: parsed.data.negocioId,
      usuarioId: ctx.userId,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      prioridade: parsed.data.prioridade || "media",
      dataVencimento: dataVenc,
      venceEm: venceEm && !isNaN(venceEm.getTime()) ? venceEm : null,
    })
    .returning();

  return c.json(tarefa, 201);
});

// PATCH /api/tarefas/:id
app.patch("/tarefas/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTarefaSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }

  // Verify tarefa belongs to user (which is already org-scoped via usuario)
  const [existing] = await db
    .select({ id: tarefas.id })
    .from(tarefas)
    .where(and(eq(tarefas.id, id), eq(tarefas.usuarioId, ctx.userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Tarefa nao encontrada" }, 404);
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
    return c.json({ error: "Tarefa nao encontrada" }, 404);
  }

  return c.json(updated);
});

export const tarefasRoutes = app;
