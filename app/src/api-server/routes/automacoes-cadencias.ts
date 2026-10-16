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
import { cadenceDefinitions, cadenceDefinitionPointers, cadenceVersions, cadenceEnrollments, cadenceEnrollmentEvents, contatos, leads, negocios, whatsappTemplates } from "@/lib/db/schema";
import { eq, sql, and, desc, inArray } from "drizzle-orm";
import { getCtx, exigirCtx } from "../compat.js";
import { z } from "zod";
import { cancelarCadencia, iniciarCadencia } from "@/lib/cadencia/cadence-engine";
import type { CadenceStep } from "@/lib/cadencia/cadence-engine";
import { compileFollowupGraph } from "@/lib/ai-platform/followup/compile";
import { createEmptyFollowupGraph, followupGraphSchema, type FollowupGraph } from "@/lib/ai-platform/followup/graph";
import { legacyStepsToFollowupGraph } from "@/lib/ai-platform/followup/legacy";
import { validateFollowupForPublish } from "@/lib/ai-platform/followup/validate";
import { opcoesInspetor } from "@/lib/automacoes/fluxos-servico";

const app = new Hono();

// :id (cadência ou enrollment) que não é uuid estourava no Postgres (500); vira 404.
// "fila", "opcoes" e o prefixo "enrollments" são rotas literais, não ids.
const LITERAIS = new Set(["fila", "opcoes"]);
app.use("/automacoes/cadencias/*", async (c, next) => {
  const [, , , seg, sub] = new URL(c.req.url).pathname.replace(/^\/api/, "").split("/");
  const id = seg === "enrollments" ? sub : seg;
  if (id && !LITERAIS.has(id) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "Nao encontrado" }, 404);
  }
  await next();
});

/**
 * Opções do editor de passos: as mesmas do inspetor de Fluxos
 * (`opcoesInspetor` — números de WhatsApp, usuários, tags, etapas, agentes),
 * mais o que só a cadência precisa: o modelo aprovado com `categoria` (para
 * agrupar a biblioteca) e `conteudo` (para a prévia do que vai chegar).
 *
 * Reusa a mesma função do inspetor de propósito: dois lugares calculando
 * "números conectados desta organização" é como nasce a lista divergente.
 */
app.get("/automacoes/cadencias/opcoes", async (c) => {
  const ctx = await getCtx(c);
  const [opcoes, templates] = await Promise.all([
    opcoesInspetor(ctx.organizacaoId),
    db.select({ id: whatsappTemplates.id, nome: whatsappTemplates.nome, categoria: whatsappTemplates.categoria, conteudo: whatsappTemplates.conteudo })
      .from(whatsappTemplates)
      .where(and(eq(whatsappTemplates.organizacaoId, ctx.organizacaoId), eq(whatsappTemplates.ativo, true)))
      .orderBy(whatsappTemplates.categoria, whatsappTemplates.nome),
  ]);
  return c.json({ ...opcoes, templates });
});

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
  // "em_curso" agrega os três estados vivos do motor (o retry grava "waiting",
  // ver cadence-engine.ts) — é o mesmo agrupamento do card "Em curso", para o
  // número do card bater com a lista aberta no drill-down.
  if (status === "em_curso") conditions.push(inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply"]));
  else if (status && status !== "all") conditions.push(eq(cadenceEnrollments.status, status));
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
    idsByType.lead.length ? db.select({ id: leads.id, nome: leads.nome, sobrenome: leads.sobrenome, empresa: leads.empresa, email: leads.email, telefone: leads.telefone }).from(leads).where(and(eq(leads.organizacaoId, ctx.organizacaoId), inArray(leads.id, idsByType.lead))) : [],
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
    const entityName = (lead ? [lead.nome, lead.sobrenome].filter(Boolean).join(" ") || null : null) ?? negocio?.titulo ?? contato?.nome ?? "Registro indisponível";
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
  entityType: z.enum(["lead", "negocio", "contato", "oportunidade", "cliente", "empresa", "servico"]),
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

function triggerConfigFor(graph: FollowupGraph, explicit?: Record<string, unknown>) {
  const trigger = graph.nodes.find((node) => node.type === "trigger");
  return { ...(explicit ?? {}), event: trigger?.config.event ?? "manual", filters: trigger?.config.filters ?? {} };
}

app.post("/automacoes/cadencias", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  const parsed = definitionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Cadencia invalida", details: parsed.error.flatten() }, 400);
  const graph = graphFromInput(parsed.data);
  const compiled = compileFollowupGraph(graph);
  const triggerConfig = triggerConfigFor(graph, parsed.data.triggerConfig);
  const result = await db.transaction(async (tx) => {
    const [cadencia] = await tx.insert(cadenceDefinitions).values({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.nome,
      entityType: parsed.data.entityType,
      steps: compiled,
      draftSteps: compiled,
      triggerConfig,
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
      triggerConfig,
      handoffPolicy: parsed.data.handoffPolicy,
      createdById: ctx.userId,
    }).returning();
    await tx.insert(cadenceDefinitionPointers).values({ organizacaoId: ctx.organizacaoId, cadenceDefinitionId: cadencia.id, draftVersionId: version.id });
    return { cadencia, version };
  });
  return c.json(result, 201);
});

app.patch("/automacoes/cadencias/:id", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
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
    const triggerConfig = triggerConfigFor(graph, parsed.data.triggerConfig ?? current.triggerConfig as Record<string, unknown>);
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(cadenceDefinitions).set({
        ...(parsed.data.nome ? { nome: parsed.data.nome } : {}),
        ...(parsed.data.entityType ? { entityType: parsed.data.entityType } : {}),
        triggerConfig,
        ...(parsed.data.handoffPolicy ? { handoffPolicy: parsed.data.handoffPolicy } : {}),
        draftSteps: compiled,
        updatedAt: new Date(),
      }).where(eq(cadenceDefinitions.id, id)).returning();
      if (pointer?.draftVersionId) {
        const [version] = await tx.update(cadenceVersions).set({
          graph,
          compiledSteps: compiled,
          triggerConfig,
          handoffPolicy: parsed.data.handoffPolicy ?? current.handoffPolicy,
        }).where(and(eq(cadenceVersions.id, pointer.draftVersionId), eq(cadenceVersions.status, "draft"))).returning();
        if (version) return { cadencia: updated, version };
      }
      const [last] = await tx.select({ versionNumber: cadenceVersions.versionNumber }).from(cadenceVersions).where(eq(cadenceVersions.cadenceDefinitionId, id)).orderBy(desc(cadenceVersions.versionNumber)).limit(1);
      const [version] = await tx.insert(cadenceVersions).values({
        organizacaoId: ctx.organizacaoId, cadenceDefinitionId: id, versionNumber: (last?.versionNumber ?? 0) + 1, status: "draft", graph, compiledSteps: compiled,
        triggerConfig, handoffPolicy: parsed.data.handoffPolicy ?? current.handoffPolicy, createdById: ctx.userId,
      }).returning();
      await tx.insert(cadenceDefinitionPointers).values({ organizacaoId: ctx.organizacaoId, cadenceDefinitionId: id, draftVersionId: version.id, publishedVersionId: pointer?.publishedVersionId ?? null })
        .onConflictDoUpdate({ target: cadenceDefinitionPointers.cadenceDefinitionId, set: { draftVersionId: version.id, updatedAt: new Date() } });
      return { cadencia: updated, version };
    });
    return c.json(result);
  }

  if (action.data.action === "pause") {
    const updated = await db.transaction(async (tx) => {
      const [definition] = await tx.update(cadenceDefinitions).set({ ativo: false, status: "disabled", updatedAt: new Date() }).where(eq(cadenceDefinitions.id, id)).returning();
      await tx.update(cadenceEnrollments).set({
        status: "paused", cancelReason: "definicao_pausada",
        scheduledAt: null, claimedUntil: null, updatedAt: new Date(),
      }).where(and(eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId),
        eq(cadenceEnrollments.cadenceDefinitionId, id),
        inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply"])));
      return definition;
    });
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
      return tx.update(cadenceDefinitions).set({ steps: version.compiledSteps, triggerConfig: version.triggerConfig, handoffPolicy: version.handoffPolicy, ativo: true, status: "published", versao: version.versionNumber, publishedAt: new Date(), updatedAt: new Date() }).where(eq(cadenceDefinitions.id, id)).returning();
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
    const [cadencia] = await tx.update(cadenceDefinitions).set({ steps: compiled, draftSteps: compiled, triggerConfig: publishedVersion.triggerConfig, handoffPolicy: publishedVersion.handoffPolicy, ativo: true, status: "published", versao: publishedVersion.versionNumber, publishedAt, updatedAt: publishedAt }).where(eq(cadenceDefinitions.id, id)).returning();
    await tx.update(cadenceEnrollments).set({
      status: "active",
      scheduledAt: sql`GREATEST(COALESCE(${cadenceEnrollments.nextEvalAt}, now()), now())`,
      claimedUntil: null, cancelReason: null, updatedAt: publishedAt,
    }).where(and(eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId),
      eq(cadenceEnrollments.cadenceDefinitionId, id), eq(cadenceEnrollments.status, "paused"),
      eq(cadenceEnrollments.cancelReason, "definicao_pausada")));
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

// Inscrição manual (tela /automacoes/cadencias, 01/10). Antes a única porta
// de entrada manual era POST /prospeccao/cadencia/enroll, que não confere se o
// lead é da organização (o motor recebe organizacaoId mas não valida a
// entidade). Aqui a entidade é resolvida no tenant ANTES de chamar o motor, e
// a escrita exige automation.manage como o resto do arquivo.
const ENTIDADES_INSCREVIVEIS = ["lead", "contato", "negocio"] as const;
type EntidadeInscrevivel = (typeof ENTIDADES_INSCREVIVEIS)[number];
const ehInscrevivel = (t: string): t is EntidadeInscrevivel => (ENTIDADES_INSCREVIVEIS as readonly string[]).includes(t);

async function buscarEntidades(organizacaoId: string, tipo: EntidadeInscrevivel, termo: string, ids?: string[]) {
  const like = `%${termo}%`;
  if (tipo === "lead") {
    const rows = await db.select({ id: leads.id, nome: leads.nome, sobrenome: leads.sobrenome, empresa: leads.empresa, email: leads.email, telefone: leads.telefone }).from(leads)
      .where(and(eq(leads.organizacaoId, organizacaoId), ids ? inArray(leads.id, ids) : termo ? sql`(concat_ws(' ', ${leads.nome}, ${leads.sobrenome}) ILIKE ${like} OR ${leads.empresa} ILIKE ${like} OR ${leads.email} ILIKE ${like})` : undefined))
      .orderBy(desc(leads.updatedAt)).limit(20);
    return rows.map((r) => ({ id: r.id, nome: [r.nome, r.sobrenome].filter(Boolean).join(" ") || "Sem nome", detalhe: r.empresa ?? r.email ?? r.telefone ?? null }));
  }
  if (tipo === "contato") {
    const rows = await db.select({ id: contatos.id, nome: contatos.nome, email: contatos.email, telefone: contatos.telefone }).from(contatos)
      .where(and(eq(contatos.organizacaoId, organizacaoId), ids ? inArray(contatos.id, ids) : termo ? sql`(${contatos.nome} ILIKE ${like} OR ${contatos.email} ILIKE ${like})` : undefined))
      .orderBy(desc(contatos.updatedAt)).limit(20);
    return rows.map((r) => ({ id: r.id, nome: r.nome || "Sem nome", detalhe: r.email ?? r.telefone ?? null }));
  }
  const rows = await db.select({ id: negocios.id, titulo: negocios.titulo, status: negocios.status }).from(negocios)
    .where(and(eq(negocios.organizacaoId, organizacaoId), ids ? inArray(negocios.id, ids) : termo ? sql`${negocios.titulo} ILIKE ${like}` : undefined))
    .orderBy(desc(negocios.updatedAt)).limit(20);
  return rows.map((r) => ({ id: r.id, nome: r.titulo || "Sem título", detalhe: r.status ?? null }));
}

app.get("/automacoes/cadencias/:id/candidatos", async (c) => {
  const ctx = await getCtx(c);
  const [definition] = await db.select().from(cadenceDefinitions).where(and(eq(cadenceDefinitions.id, c.req.param("id")), eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!definition) return c.json({ error: "Cadencia nao encontrada" }, 404);
  if (!ehInscrevivel(definition.entityType)) return c.json({ suportado: false, candidatos: [] });
  const candidatos = await buscarEntidades(ctx.organizacaoId, definition.entityType, (c.req.query("q") ?? "").trim().slice(0, 80));
  const ativos = candidatos.length ? await db.select({ entityId: cadenceEnrollments.entityId }).from(cadenceEnrollments).where(and(
    eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId), eq(cadenceEnrollments.cadenceDefinitionId, definition.id),
    inArray(cadenceEnrollments.entityId, candidatos.map((x) => x.id)), inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply", "paused"]),
  )) : [];
  const inscritos = new Set(ativos.map((a) => a.entityId));
  return c.json({ suportado: true, candidatos: candidatos.map((x) => ({ ...x, jaInscrito: inscritos.has(x.id) })) });
});

app.post("/automacoes/cadencias/:id/enrollments", async (c) => {
  const ctx = await exigirCtx(c, "automation.manage");
  const parsed = z.object({ entityId: z.string().uuid(), sessaoId: z.string().uuid().optional() }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Registro invalido" }, 400);
  const [definition] = await db.select().from(cadenceDefinitions).where(and(eq(cadenceDefinitions.id, c.req.param("id")), eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!definition) return c.json({ error: "Cadencia nao encontrada" }, 404);
  if (!definition.ativo) return c.json({ error: "Publique a cadência antes de inscrever alguém." }, 409);
  if (!ehInscrevivel(definition.entityType)) return c.json({ error: "Inscrição manual disponível só para lead, contato ou negócio." }, 422);
  const [entidade] = await buscarEntidades(ctx.organizacaoId, definition.entityType, "", [parsed.data.entityId]);
  if (!entidade) return c.json({ error: "Registro nao encontrado" }, 404);
  const [jaAtivo] = await db.select({ id: cadenceEnrollments.id }).from(cadenceEnrollments).where(and(
    eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId), eq(cadenceEnrollments.cadenceDefinitionId, definition.id),
    eq(cadenceEnrollments.entityId, entidade.id), inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply", "paused"]),
  )).limit(1);
  if (jaAtivo) return c.json({ enrollmentId: jaAtivo.id, jaExistia: true });
  const enrollmentId = await iniciarCadencia({ cadenceDefinitionId: definition.id, organizacaoId: ctx.organizacaoId, entityType: definition.entityType, entityId: entidade.id, varsIniciais: { nome: entidade.nome, ...(parsed.data.sessaoId ? { cadencia_sessao_id: parsed.data.sessaoId } : {}) } });
  if (!enrollmentId) return c.json({ error: "Cadência sem passos publicados." }, 409);
  await db.insert(cadenceEnrollmentEvents).values({ enrollmentId, stepId: "-", status: "enrolled", resultado: { actorId: ctx.userId, origem: "inscricao_manual" } });
  return c.json({ enrollmentId, jaExistia: false }, 201);
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
  const ctx = await exigirCtx(c, "automation.manage");
  const id = c.req.param("id");
  const parsed = z.object({ action: z.enum(["pause", "resume", "cancel"]) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Acao invalida" }, 400);
  const [enrollment] = await db.select().from(cadenceEnrollments).where(and(
    eq(cadenceEnrollments.id, id), eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId),
  )).limit(1);
  if (!enrollment) return c.json({ error: "Enrollment nao encontrado" }, 404);
  const emCurso = ["active", "waiting", "waiting_reply"].includes(enrollment.status);
  if (parsed.data.action === "resume") {
    if (enrollment.status !== "paused") return c.json({ error: "Só inscrições pausadas podem ser retomadas." }, 409);
    const [def] = await db.select({ ativo: cadenceDefinitions.ativo }).from(cadenceDefinitions)
      .where(and(eq(cadenceDefinitions.id, enrollment.cadenceDefinitionId),
        eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId))).limit(1);
    if (!def?.ativo) return c.json({ error: "Esta cadência está desativada. Publique-a antes de retomar." }, 409);
  } else if (!emCurso && !(parsed.data.action === "cancel" && enrollment.status === "paused")) {
    return c.json({ error: "Esta inscrição já está parada ou concluída." }, 409);
  }
  if (parsed.data.action === "cancel") await cancelarCadencia(id, `cancelado_por_${ctx.userId}`);
  else if (parsed.data.action === "pause") {
    /* Pausar zera o agendamento: a varredura não pode pegar a inscrição de novo
       enquanto ela estiver parada. `claimedUntil` também sai, senão um claim
       vivo segura a inscrição por até 2 minutos depois do retomar. */
    await db.update(cadenceEnrollments)
      .set({ status: "paused", scheduledAt: null, nextEvalAt: null, claimedUntil: null, updatedAt: new Date() })
      .where(eq(cadenceEnrollments.id, id));
  } else {
    /* Retomar precisa DEVOLVER o agendamento. A pausa (aqui ou a automática por
       resposta, em cadence-engine) deixa `scheduledAt` nulo, e a varredura
       filtra por `scheduledAt <= now`: nulo nunca casa. Sem esta linha a
       inscrição voltava para "active" e não andava mais — parecia retomada e
       estava morta. Volta a correr agora. */
    await db.update(cadenceEnrollments)
      .set({ status: "active", scheduledAt: new Date(), nextEvalAt: new Date(), claimedUntil: null, cancelReason: null, updatedAt: new Date() })
      .where(eq(cadenceEnrollments.id, id));
  }
  await db.insert(cadenceEnrollmentEvents).values({ enrollmentId: id, stepId: enrollment.currentStepId ?? "-", status: parsed.data.action, resultado: { actorId: ctx.userId } });
  return c.json({ ok: true });
});

export const automacoesCadenciasRoutes = app;
