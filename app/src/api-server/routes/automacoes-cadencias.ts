// Automações → Cadências (19/08) — visão real das cadências configuráveis
// (`cadence_definitions`/`cadence_enrollments`, motor genérico em
// lib/cadencia/cadence-engine.ts). Achado real (investigação 19/08): esse
// motor hoje só tem 1 consumidor real (Prospecção outbound) — existem 2
// outros mecanismos de "sequência no tempo" ainda não unificados a ele
// (cadência SDR inbound sobre `cadencia_execucoes`, e o retry do AI SDR
// hardcoded no worker). Não escondido, reportado explicitamente na
// resposta pra não passar a falsa impressão de que já é 1 motor só.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { cadenceDefinitions, cadenceEnrollments, cadenceEnrollmentEvents, contatos, leads, negocios } from "@/lib/db/schema";
import { eq, sql, and, desc, inArray } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { z } from "zod";
import { cancelarCadencia } from "@/lib/cadencia/cadence-engine";

const app = new Hono();

app.get("/automacoes/cadencias", async (c) => {
  const ctx = await getCtx(c);

  const definicoes = await db.select().from(cadenceDefinitions).where(eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId));

  const contagens = await db.execute<{ cadence_definition_id: string; status: string; n: number }>(sql`
    SELECT cadence_definition_id, status, COUNT(*)::int AS n
    FROM cadence_enrollments
    WHERE organizacao_id = ${ctx.organizacaoId}
    GROUP BY 1, 2
  `);

  const [legadoInbound] = await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM cadencia_execucoes WHERE organizacao_id = ${ctx.organizacaoId}`);

  return c.json({
    cadencias: definicoes.map((d) => ({
      ...d,
      draftSteps: d.draftSteps ?? d.steps,
      totalPassos: Array.isArray(d.steps) ? d.steps.length : 0,
      enrollmentsPorStatus: contagens.filter((ct) => ct.cadence_definition_id === d.id).reduce((acc, ct) => ({ ...acc, [ct.status]: ct.n }), {} as Record<string, number>),
    })),
    // Mecanismos paralelos ainda não unificados a este motor — visibilidade
    // honesta, não é bug escondido, é achado de arquitetura real.
    mecanismosParalelos: {
      cadenciaSdrInboundExecucoes: legadoInbound?.n ?? 0,
      aiSdrRetrySweep: "hardcoded no worker (runAiSdrRetrySweep), não passa por cadence_definitions",
    },
  });
});

// Fila operacional dos Follow-ups. A inscrição é a fonte de verdade; o
// nome da entidade é resolvido só para leitura, preservando o motor genérico
// (lead | negocio | contato) e sem criar uma tabela paralela de fila.
app.get("/automacoes/cadencias/fila", async (c) => {
  const ctx = await getCtx(c);
  const status = c.req.query("status");
  const definitionId = c.req.query("definitionId");
  const query = (c.req.query("q") ?? "").trim().toLowerCase();

  const conditions = [eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId)];
  if (status && status !== "all") conditions.push(eq(cadenceEnrollments.status, status));
  if (definitionId && definitionId !== "all") conditions.push(eq(cadenceEnrollments.cadenceDefinitionId, definitionId));

  const [definitions, enrollments] = await Promise.all([
    db.select().from(cadenceDefinitions).where(eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId)),
    db.select().from(cadenceEnrollments).where(and(...conditions)).orderBy(desc(cadenceEnrollments.updatedAt)).limit(250),
  ]);
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
  const idsByType = enrollments.reduce((acc, enrollment) => {
    if (enrollment.entityType === "lead" || enrollment.entityType === "negocio" || enrollment.entityType === "contato") acc[enrollment.entityType].push(enrollment.entityId);
    return acc;
  }, { lead: [] as string[], negocio: [] as string[], contato: [] as string[] });
  const [leadRows, negocioRows, contatoRows] = await Promise.all([
    idsByType.lead.length ? db.select({ id: leads.id, nome: leads.nome, empresa: leads.empresa, email: leads.email, telefone: leads.telefone }).from(leads).where(and(eq(leads.organizacaoId, ctx.organizacaoId), inArray(leads.id, idsByType.lead))) : [],
    idsByType.negocio.length ? db.select({ id: negocios.id, titulo: negocios.titulo }).from(negocios).where(and(eq(negocios.organizacaoId, ctx.organizacaoId), inArray(negocios.id, idsByType.negocio))) : [],
    idsByType.contato.length ? db.select({ id: contatos.id, nome: contatos.nome, email: contatos.email, telefone: contatos.telefone }).from(contatos).where(and(eq(contatos.organizacaoId, ctx.organizacaoId), inArray(contatos.id, idsByType.contato))) : [],
  ]);
  const leadById = new Map(leadRows.map((row) => [row.id, row]));
  const negocioById = new Map(negocioRows.map((row) => [row.id, row]));
  const contatoById = new Map(contatoRows.map((row) => [row.id, row]));

  const items = enrollments.map((enrollment) => {
    const definition = definitionById.get(enrollment.cadenceDefinitionId);
    const steps = (definition?.steps ?? []) as Array<{ id?: string; tipo?: string; config?: Record<string, unknown>; esperaMinutos?: number }>;
    const currentStep = steps.find((step) => step.id === enrollment.currentStepId);
    const lead = enrollment.entityType === "lead" ? leadById.get(enrollment.entityId) : undefined;
    const negocio = enrollment.entityType === "negocio" ? negocioById.get(enrollment.entityId) : undefined;
    const contato = enrollment.entityType === "contato" ? contatoById.get(enrollment.entityId) : undefined;
    const entityName = lead?.nome ?? negocio?.titulo ?? contato?.nome ?? "Registro indisponível";
    return {
      id: enrollment.id,
      status: enrollment.status,
      startedAt: enrollment.startedAt,
      updatedAt: enrollment.updatedAt,
      nextFireAt: enrollment.scheduledAt,
      entityType: enrollment.entityType,
      entityId: enrollment.entityId,
      entityName,
      entityDetail: lead?.empresa ?? lead?.email ?? lead?.telefone ?? contato?.email ?? contato?.telefone ?? null,
      definitionId: enrollment.cadenceDefinitionId,
      definitionName: definition?.nome ?? "Fluxo removido",
      currentStep: currentStep ? ((currentStep.config?.label as string | undefined) || (currentStep.tipo === "wait" ? `Aguardar ${currentStep.esperaMinutos ?? 0} min` : currentStep.tipo === "condition" ? "Condição" : "Ação")) : "Aguardando início",
    };
  }).filter((item) => !query || `${item.entityName} ${item.entityDetail ?? ""} ${item.definitionName}`.toLowerCase().includes(query));

  return c.json({ items, total: items.length, definitions: definitions.map((definition) => ({ id: definition.id, nome: definition.nome })) });
});

const stepSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(["wait", "action", "condition"]),
  esperaMinutos: z.number().int().min(0).optional(),
  adapter: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  branches: z.array(z.object({ condicao: z.unknown().nullable(), proximoStepId: z.string().nullable() })).default([]),
});
// Consistência por tipo — "condition" só faz sentido com pelo menos 1 branch
// (senão é um step que não faz nada); "wait" exige o intervalo. Validado
// aqui pra não deixar o builder salvar um step visualmente montado mas
// funcionalmente incompleto no motor.
const stepsComRegraDeTipo = z.array(stepSchema).min(1).superRefine((steps, ctx) => {
  steps.forEach((s, i) => {
    if (s.tipo === "condition" && s.branches.length === 0) {
      ctx.addIssue({ code: "custom", path: [i, "branches"], message: `Etapa de condição "${s.id}" precisa de pelo menos 1 branch.` });
    }
    if (s.tipo === "wait" && s.esperaMinutos === undefined) {
      ctx.addIssue({ code: "custom", path: [i, "esperaMinutos"], message: `Etapa de espera "${s.id}" precisa de esperaMinutos.` });
    }
  });
});
const definitionSchema = z.object({
  nome: z.string().min(1).max(120),
  entityType: z.enum(["lead", "negocio", "contato"]),
  steps: stepsComRegraDeTipo,
});

app.post("/automacoes/cadencias", async (c) => {
  const ctx = await getCtx(c);
  const parsed = definitionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Cadencia invalida", details: parsed.error.flatten() }, 400);
  const [cadencia] = await db.insert(cadenceDefinitions).values({
    organizacaoId: ctx.organizacaoId,
    nome: parsed.data.nome,
    entityType: parsed.data.entityType,
    steps: parsed.data.steps,
    draftSteps: parsed.data.steps,
    ativo: false,
  }).returning();
  return c.json(cadencia, 201);
});

app.patch("/automacoes/cadencias/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const action = z.object({ action: z.enum(["save_draft", "publish", "pause"]) }).safeParse(body);
  if (!action.success) return c.json({ error: "Acao invalida" }, 400);
  const [current] = await db.select().from(cadenceDefinitions).where(and(
    eq(cadenceDefinitions.id, id), eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId),
  )).limit(1);
  if (!current) return c.json({ error: "Cadencia nao encontrada" }, 404);

  if (action.data.action === "save_draft") {
    const parsed = definitionSchema.partial({ nome: true, entityType: true }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Rascunho invalido", details: parsed.error.flatten() }, 400);
    if (!parsed.data.steps) return c.json({ error: "Rascunho sem etapas" }, 400);
    const [updated] = await db.update(cadenceDefinitions).set({
      ...(parsed.data.nome ? { nome: parsed.data.nome } : {}),
      ...(parsed.data.entityType ? { entityType: parsed.data.entityType } : {}),
      draftSteps: parsed.data.steps,
      updatedAt: new Date(),
    }).where(eq(cadenceDefinitions.id, id)).returning();
    return c.json(updated);
  }

  if (action.data.action === "pause") {
    const [updated] = await db.update(cadenceDefinitions).set({ ativo: false, updatedAt: new Date() }).where(eq(cadenceDefinitions.id, id)).returning();
    return c.json(updated);
  }

  const draft = (current.draftSteps ?? current.steps) as unknown[];
  const [updated] = await db.update(cadenceDefinitions).set({
    steps: draft,
    ativo: true,
    versao: current.versao + 1,
    publishedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(cadenceDefinitions.id, id)).returning();
  return c.json(updated);
});

app.get("/automacoes/cadencias/:id/enrollments", async (c) => {
  const ctx = await getCtx(c);
  const rows = await db.select().from(cadenceEnrollments).where(and(
    eq(cadenceEnrollments.cadenceDefinitionId, c.req.param("id")),
    eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId),
  )).orderBy(desc(cadenceEnrollments.updatedAt)).limit(100);
  return c.json({ enrollments: rows });
});

app.post("/automacoes/cadencias/enrollments/:id/action", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const parsed = z.object({ action: z.enum(["pause", "resume", "cancel"]) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Acao invalida" }, 400);
  const [enrollment] = await db.select().from(cadenceEnrollments).where(and(
    eq(cadenceEnrollments.id, id), eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId),
  )).limit(1);
  if (!enrollment) return c.json({ error: "Enrollment nao encontrado" }, 404);
  if (parsed.data.action === "cancel") await cancelarCadencia(id, `cancelado_por_${ctx.userId}`);
  else if (parsed.data.action === "pause") await db.update(cadenceEnrollments).set({ status: "paused", updatedAt: new Date() }).where(eq(cadenceEnrollments.id, id));
  else await db.update(cadenceEnrollments).set({ status: "active", updatedAt: new Date() }).where(eq(cadenceEnrollments.id, id));
  await db.insert(cadenceEnrollmentEvents).values({ enrollmentId: id, stepId: enrollment.currentStepId ?? "-", status: parsed.data.action, resultado: { actorId: ctx.userId } });
  return c.json({ ok: true });
});

export const automacoesCadenciasRoutes = app;
