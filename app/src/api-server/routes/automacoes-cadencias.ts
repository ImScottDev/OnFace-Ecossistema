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
import { cadenceDefinitions, cadenceDefinitionPointers, cadenceVersions, cadenceEnrollments, cadenceEnrollmentEvents, contatos, leads, negocios } from "@/lib/db/schema";
import { eq, sql, and, desc, inArray } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { z } from "zod";
import { cancelarCadencia } from "@/lib/cadencia/cadence-engine";
import type { CadenceStep } from "@/lib/cadencia/cadence-engine";
import { compileFollowupGraph } from "@/lib/ai-platform/followup/compile";
import { createEmptyFollowupGraph, followupGraphSchema, type FollowupGraph } from "@/lib/ai-platform/followup/graph";
import { legacyStepsToFollowupGraph } from "@/lib/ai-platform/followup/legacy";
import { validateFollowupForPublish } from "@/lib/ai-platform/followup/validate";

const app = new Hono();

app.get("/automacoes/cadencias", async (c) => {
  const ctx = await getCtx(c);

  const [definicoes, pointers, versoes] = await Promise.all([
    db.select().from(cadenceDefinitions).where(eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId)),
    db.select().from(cadenceDefinitionPointers).where(eq(cadenceDefinitionPointers.organizacaoId, ctx.organizacaoId)),
    db.select().from(cadenceVersions).where(eq(cadenceVersions.organizacaoId, ctx.organizacaoId)),
  ]);
  const pointerByDefinition = new Map(pointers.map((pointer) => [pointer.cadenceDefinitionId, pointer]));
  const versionById = new Map(versoes.map((version) => [version.id, version]));

  const contagens = await db.execute<{ cadence_definition_id: string; status: string; n: number }>(sql`
    SELECT cadence_definition_id, status, COUNT(*)::int AS n
    FROM cadence_enrollments
    WHERE organizacao_id = ${ctx.organizacaoId}
    GROUP BY 1, 2
  `);

  const [legadoInbound] = await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM cadencia_execucoes WHERE organizacao_id = ${ctx.organizacaoId}`);

  return c.json({
    cadencias: definicoes.map((d) => {
      const pointer = pointerByDefinition.get(d.id);
      const draftVersion = pointer?.draftVersionId ? versionById.get(pointer.draftVersionId) : null;
      const publishedVersion = pointer?.publishedVersionId ? versionById.get(pointer.publishedVersionId) : null;
      return {
        ...d,
        draftSteps: d.draftSteps ?? d.steps,
        draftGraph: draftVersion?.graph ?? null,
        publishedGraph: publishedVersion?.graph ?? null,
        draftVersionId: draftVersion?.id ?? null,
        publishedVersionId: publishedVersion?.id ?? null,
        publishedVersionNumber: publishedVersion?.versionNumber ?? null,
        totalPassos: Array.isArray(publishedVersion?.compiledSteps) ? publishedVersion.compiledSteps.length : Array.isArray(d.steps) ? d.steps.length : 0,
        enrollmentsPorStatus: contagens.filter((ct) => ct.cadence_definition_id === d.id).reduce((acc, ct) => ({ ...acc, [ct.status]: ct.n }), {} as Record<string, number>),
      };
    }),
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
  steps: stepsComRegraDeTipo.optional(),
  graph: followupGraphSchema.optional(),
  triggerConfig: z.record(z.string(), z.unknown()).default({}),
  handoffPolicy: z.record(z.string(), z.unknown()).default({ mode: "pause_on_reply" }),
});

function graphFromInput(input: { graph?: FollowupGraph; steps?: z.infer<typeof stepsComRegraDeTipo> }): FollowupGraph {
  if (input.graph) return input.graph;
  if (input.steps) return legacyStepsToFollowupGraph(input.steps as CadenceStep[]);
  return createEmptyFollowupGraph();
}

app.post("/automacoes/cadencias", async (c) => {
  const ctx = await getCtx(c);
  const parsed = definitionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Cadencia invalida", details: parsed.error.flatten() }, 400);
  const graph = graphFromInput(parsed.data);
  const compiled = compileFollowupGraph(graph);
  const result = await db.transaction(async (tx) => {
    const [cadencia] = await tx.insert(cadenceDefinitions).values({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.nome,
      entityType: parsed.data.entityType,
      steps: compiled,
      draftSteps: compiled,
      triggerConfig: parsed.data.triggerConfig,
      handoffPolicy: parsed.data.handoffPolicy,
      status: "draft",
      ativo: false,
    }).returning();
    const [version] = await tx.insert(cadenceVersions).values({
      organizacaoId: ctx.organizacaoId,
      cadenceDefinitionId: cadencia.id,
      versionNumber: 1,
      status: "draft",
      graph,
      compiledSteps: compiled,
      triggerConfig: parsed.data.triggerConfig,
      handoffPolicy: parsed.data.handoffPolicy,
      createdById: ctx.userId,
    }).returning();
    await tx.insert(cadenceDefinitionPointers).values({ organizacaoId: ctx.organizacaoId, cadenceDefinitionId: cadencia.id, draftVersionId: version.id });
    return { cadencia, version };
  });
  return c.json(result, 201);
});

app.patch("/automacoes/cadencias/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const body = await c.req.json();
  const action = z.object({ action: z.enum(["save_draft", "publish", "pause", "rollback"]) }).safeParse(body);
  if (!action.success) return c.json({ error: "Acao invalida" }, 400);
  const [current] = await db.select().from(cadenceDefinitions).where(and(
    eq(cadenceDefinitions.id, id), eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId),
  )).limit(1);
  if (!current) return c.json({ error: "Cadencia nao encontrada" }, 404);

  const [pointer] = await db.select().from(cadenceDefinitionPointers).where(and(
    eq(cadenceDefinitionPointers.cadenceDefinitionId, id),
    eq(cadenceDefinitionPointers.organizacaoId, ctx.organizacaoId),
  )).limit(1);

  if (action.data.action === "save_draft") {
    const parsed = definitionSchema.partial({ nome: true, entityType: true }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Rascunho invalido", details: parsed.error.flatten() }, 400);
    if (!parsed.data.graph && !parsed.data.steps) return c.json({ error: "Rascunho sem grafo" }, 400);
    const graph = graphFromInput(parsed.data);
    const compiled = compileFollowupGraph(graph);
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(cadenceDefinitions).set({
        ...(parsed.data.nome ? { nome: parsed.data.nome } : {}),
        ...(parsed.data.entityType ? { entityType: parsed.data.entityType } : {}),
        ...(parsed.data.triggerConfig ? { triggerConfig: parsed.data.triggerConfig } : {}),
        ...(parsed.data.handoffPolicy ? { handoffPolicy: parsed.data.handoffPolicy } : {}),
        draftSteps: compiled,
        updatedAt: new Date(),
      }).where(eq(cadenceDefinitions.id, id)).returning();
      if (pointer?.draftVersionId) {
        const [version] = await tx.update(cadenceVersions).set({
          graph,
          compiledSteps: compiled,
          triggerConfig: parsed.data.triggerConfig ?? current.triggerConfig,
          handoffPolicy: parsed.data.handoffPolicy ?? current.handoffPolicy,
        }).where(and(eq(cadenceVersions.id, pointer.draftVersionId), eq(cadenceVersions.status, "draft"))).returning();
        if (version) return { cadencia: updated, version };
      }
      const [last] = await tx.select({ versionNumber: cadenceVersions.versionNumber }).from(cadenceVersions).where(eq(cadenceVersions.cadenceDefinitionId, id)).orderBy(desc(cadenceVersions.versionNumber)).limit(1);
      const [version] = await tx.insert(cadenceVersions).values({
        organizacaoId: ctx.organizacaoId, cadenceDefinitionId: id, versionNumber: (last?.versionNumber ?? 0) + 1, status: "draft", graph, compiledSteps: compiled,
        triggerConfig: parsed.data.triggerConfig ?? current.triggerConfig, handoffPolicy: parsed.data.handoffPolicy ?? current.handoffPolicy, createdById: ctx.userId,
      }).returning();
      await tx.insert(cadenceDefinitionPointers).values({ organizacaoId: ctx.organizacaoId, cadenceDefinitionId: id, draftVersionId: version.id, publishedVersionId: pointer?.publishedVersionId ?? null })
        .onConflictDoUpdate({ target: cadenceDefinitionPointers.cadenceDefinitionId, set: { draftVersionId: version.id, updatedAt: new Date() } });
      return { cadencia: updated, version };
    });
    return c.json(result);
  }

  if (action.data.action === "pause") {
    const [updated] = await db.update(cadenceDefinitions).set({ ativo: false, status: "disabled", updatedAt: new Date() }).where(eq(cadenceDefinitions.id, id)).returning();
    return c.json(updated);
  }

  if (action.data.action === "rollback") {
    const rollback = z.object({ versionId: z.string().uuid() }).safeParse(body);
    if (!rollback.success) return c.json({ error: "Versao de rollback invalida" }, 400);
    const [version] = await db.select().from(cadenceVersions).where(and(
      eq(cadenceVersions.id, rollback.data.versionId), eq(cadenceVersions.cadenceDefinitionId, id), eq(cadenceVersions.organizacaoId, ctx.organizacaoId),
    )).limit(1);
    if (!version || version.status === "draft") return c.json({ error: "Versao publicada nao encontrada" }, 404);
    const [updated] = await db.transaction(async (tx) => {
      await tx.insert(cadenceDefinitionPointers).values({ organizacaoId: ctx.organizacaoId, cadenceDefinitionId: id, draftVersionId: pointer?.draftVersionId ?? null, publishedVersionId: version.id })
        .onConflictDoUpdate({ target: cadenceDefinitionPointers.cadenceDefinitionId, set: { publishedVersionId: version.id, updatedAt: new Date() } });
      return tx.update(cadenceDefinitions).set({ steps: version.compiledSteps, ativo: true, status: "published", versao: version.versionNumber, publishedAt: new Date(), updatedAt: new Date() }).where(eq(cadenceDefinitions.id, id)).returning();
    });
    return c.json({ cadencia: updated, publishedVersion: version });
  }

  if (!pointer?.draftVersionId) return c.json({ error: "Fluxo sem rascunho versionado" }, 409);
  const [draftVersion] = await db.select().from(cadenceVersions).where(and(eq(cadenceVersions.id, pointer.draftVersionId), eq(cadenceVersions.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!draftVersion || draftVersion.status !== "draft") return c.json({ error: "Rascunho nao encontrado" }, 409);
  const parsedGraph = followupGraphSchema.safeParse(draftVersion.graph);
  if (!parsedGraph.success) return c.json({ error: "Grafo invalido", details: parsedGraph.error.flatten() }, 422);
  const validation = validateFollowupForPublish(parsedGraph.data);
  if (!validation.ok) return c.json({ error: "Fluxo nao pode ser publicado", validation }, 422);
  const compiled = compileFollowupGraph(parsedGraph.data);
  const publishedAt = new Date();
  const result = await db.transaction(async (tx) => {
    if (pointer.publishedVersionId) await tx.update(cadenceVersions).set({ status: "superseded", supersededAt: publishedAt }).where(eq(cadenceVersions.id, pointer.publishedVersionId));
    const [publishedVersion] = await tx.update(cadenceVersions).set({ status: "published", compiledSteps: compiled, validationSnapshot: validation, publishedAt }).where(eq(cadenceVersions.id, draftVersion.id)).returning();
    const [nextDraft] = await tx.insert(cadenceVersions).values({
      organizacaoId: ctx.organizacaoId, cadenceDefinitionId: id, versionNumber: draftVersion.versionNumber + 1, status: "draft", graph: parsedGraph.data, compiledSteps: compiled,
      triggerConfig: draftVersion.triggerConfig, handoffPolicy: draftVersion.handoffPolicy, createdById: ctx.userId,
    }).returning();
    await tx.update(cadenceDefinitionPointers).set({ draftVersionId: nextDraft.id, publishedVersionId: publishedVersion.id, updatedAt: publishedAt }).where(eq(cadenceDefinitionPointers.cadenceDefinitionId, id));
    const [cadencia] = await tx.update(cadenceDefinitions).set({ steps: compiled, draftSteps: compiled, ativo: true, status: "published", versao: publishedVersion.versionNumber, publishedAt, updatedAt: publishedAt }).where(eq(cadenceDefinitions.id, id)).returning();
    return { cadencia, publishedVersion, draftVersion: nextDraft };
  });
  return c.json(result);
});

app.get("/automacoes/cadencias/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const [definition] = await db.select().from(cadenceDefinitions).where(and(eq(cadenceDefinitions.id, id), eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!definition) return c.json({ error: "Cadencia nao encontrada" }, 404);
  const [pointer, versions] = await Promise.all([
    db.select().from(cadenceDefinitionPointers).where(and(eq(cadenceDefinitionPointers.cadenceDefinitionId, id), eq(cadenceDefinitionPointers.organizacaoId, ctx.organizacaoId))).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(cadenceVersions).where(and(eq(cadenceVersions.cadenceDefinitionId, id), eq(cadenceVersions.organizacaoId, ctx.organizacaoId))).orderBy(desc(cadenceVersions.versionNumber)),
  ]);
  const byId = new Map(versions.map((version) => [version.id, version]));
  return c.json({ definition, pointer, draftVersion: pointer?.draftVersionId ? byId.get(pointer.draftVersionId) ?? null : null, publishedVersion: pointer?.publishedVersionId ? byId.get(pointer.publishedVersionId) ?? null : null, versions });
});

app.get("/automacoes/cadencias/:id/enrollments", async (c) => {
  const ctx = await getCtx(c);
  const rows = await db.select().from(cadenceEnrollments).where(and(
    eq(cadenceEnrollments.cadenceDefinitionId, c.req.param("id")),
    eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId),
  )).orderBy(desc(cadenceEnrollments.updatedAt)).limit(100);
  return c.json({ enrollments: rows });
});

app.get("/automacoes/cadencias/enrollments/:id/events", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const [enrollment] = await db.select({ id: cadenceEnrollments.id }).from(cadenceEnrollments)
    .where(and(eq(cadenceEnrollments.id, id), eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!enrollment) return c.json({ error: "Enrollment nao encontrado" }, 404);
  const events = await db.select().from(cadenceEnrollmentEvents).where(eq(cadenceEnrollmentEvents.enrollmentId, id)).orderBy(desc(cadenceEnrollmentEvents.createdAt)).limit(200);
  return c.json({ events });
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
