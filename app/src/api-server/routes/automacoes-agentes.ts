// Automações → Agentes (19/08) — 1ª entrada de um catálogo de agentes de IA
// que ainda não existe hoje no CRM2. Achado real (investigação 19/08): não
// há múltiplos "agentes" configuráveis — existe 1 config por organização
// (`ai_sdr_config`) que já roda em produção como AI SDR. Recovery/Collection/
// CS Agent NÃO existem ainda; esta rota não inventa dados pra eles, só
// devolve o único agente real hoje. Estrutura em lista pronta pra crescer
// quando esses outros agentes existirem de fato.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { aiAgents, aiAgentVersions, aiAgentRuns } from "@/lib/db/schema";
import { eq, and, count, desc, inArray } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { z } from "zod";
import {
  AGENT_EVENT_CATALOG,
  AGENT_PURPOSES,
  AGENT_TOOL_CATALOG,
  DEFAULT_HANDOFF_CONFIG,
  DEFAULT_TRIGGER_CONFIG,
  isKnownAgentTool,
} from "@/lib/ai/agent-studio";

const app = new Hono();

app.get("/automacoes/agentes", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;

  const catalogo = await db.select({
    id: aiAgents.id,
    tipo: aiAgents.finalidade,
    nome: aiAgents.nome,
    descricao: aiAgents.descricao,
    ativo: eq(aiAgents.status, "published"),
    status: aiAgents.status,
    prioridade: aiAgents.prioridade,
    atualizadoEm: aiAgents.updatedAt,
    versao: aiAgentVersions.versao,
    modelo: aiAgentVersions.modelo,
  }).from(aiAgents)
    .leftJoin(aiAgentVersions, and(eq(aiAgentVersions.agentId, aiAgents.id), eq(aiAgentVersions.status, "published")))
    .where(eq(aiAgents.organizacaoId, orgId))
    .orderBy(desc(aiAgents.prioridade), desc(aiAgents.updatedAt));

  const agentIds = catalogo.map((agent) => agent.id);
  const execucoes = agentIds.length === 0 ? [] : await db.select({
    agentId: aiAgentRuns.agentId,
    total: count(),
  }).from(aiAgentRuns)
    .where(and(eq(aiAgentRuns.organizacaoId, orgId), inArray(aiAgentRuns.agentId, agentIds)))
    .groupBy(aiAgentRuns.agentId);
  const execucoesPorAgente = new Map(execucoes.map((row) => [row.agentId, row.total]));

  return c.json({
    agentes: catalogo.map((agent) => ({
      id: agent.id,
      tipo: agent.tipo,
      nome: agent.nome,
      descricao: agent.descricao || "Agente configurável da operação Callface.",
      ativo: agent.ativo,
      configurado: true,
      modelo: agent.modelo,
      atualizadoEm: agent.atualizadoEm,
      status: agent.status,
      versao: agent.versao,
      execucoes: execucoesPorAgente.get(agent.id) ?? 0,
      configHref: `/automacoes/agentes/${agent.id}`,
    })),
  });
});

app.get("/automacoes/agentes/catalogo", async (c) => {
  await getCtx(c);
  return c.json({ tools: AGENT_TOOL_CATALOG, events: AGENT_EVENT_CATALOG, purposes: AGENT_PURPOSES });
});

const versionSchema = z.object({
  systemPrompt: z.string().default(""),
  provider: z.string().nullable().optional(),
  modelo: z.string().nullable().optional(),
  tools: z.array(z.string()).max(30).default([]).refine((tools) => tools.every(isKnownAgentTool), "Capacidade desconhecida"),
  triggerConfig: z.record(z.string(), z.unknown()).default(DEFAULT_TRIGGER_CONFIG),
  handoffConfig: z.record(z.string(), z.unknown()).default(DEFAULT_HANDOFF_CONFIG),
  knowledgeConfig: z.record(z.string(), z.unknown()).default({}),
  maxSteps: z.number().int().min(1).max(30).default(8),
  tokenBudget: z.number().int().min(1).max(100000).default(4000),
  costBudget: z.number().nonnegative().nullable().optional(),
});

const agentSchema = z.object({
  nome: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  descricao: z.string().max(500).nullable().optional(),
  finalidade: z.string().min(1).max(80).default("atendimento"),
  prioridade: z.number().int().min(0).max(10000).default(100),
  versao: versionSchema.default({
    systemPrompt: "",
    tools: [],
    triggerConfig: DEFAULT_TRIGGER_CONFIG,
    handoffConfig: DEFAULT_HANDOFF_CONFIG,
    knowledgeConfig: {},
    maxSteps: 8,
    tokenBudget: 4000,
  }),
});

function normalizarVersao(version: z.infer<typeof versionSchema>) {
  return {
    ...version,
    costBudget: version.costBudget == null ? null : String(version.costBudget),
  };
}

app.post("/automacoes/agentes", async (c) => {
  const ctx = await getCtx(c);
  const parsed = agentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Agente invalido", details: parsed.error.flatten() }, 400);
  const [agent] = await db.insert(aiAgents).values({
    organizacaoId: ctx.organizacaoId,
    nome: parsed.data.nome,
    slug: parsed.data.slug,
    descricao: parsed.data.descricao ?? null,
    finalidade: parsed.data.finalidade,
    prioridade: parsed.data.prioridade,
    createdById: ctx.userId,
  }).returning();
  await db.insert(aiAgentVersions).values({ agentId: agent.id, versao: 1, createdById: ctx.userId, ...normalizarVersao(parsed.data.versao) });
  return c.json({ agent }, 201);
});

// Dispatcher V1: roteamento determinístico e seguro para validação do fluxo.
// Não chama provedor de IA, não envia mensagem e não executa ferramentas. A
// execução é persistida em ai_agent_runs para podermos validar seleção,
// versão, limites e handoff antes de habilitar qualquer modo live.
const dispatchDryRunSchema = z.object({
  eventType: z.string().min(1).max(120),
  entityType: z.string().min(1).max(80).default("lead"),
  entityId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  contatoId: z.string().uuid().optional().nullable(),
  agentId: z.string().uuid().optional().nullable(),
  message: z.string().max(10000).optional().nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
  requestedTools: z.array(z.string()).default([]),
});

app.post("/automacoes/agentes/dispatch-dry-run", async (c) => {
  const ctx = await getCtx(c);
  const parsed = dispatchDryRunSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Evento inválido", details: parsed.error.flatten() }, 400);

  const [candidatos] = await Promise.all([
    db.select({
      agent: aiAgents,
      version: aiAgentVersions,
    }).from(aiAgents)
      .innerJoin(aiAgentVersions, and(eq(aiAgentVersions.agentId, aiAgents.id), eq(aiAgentVersions.status, "published")))
      .where(and(eq(aiAgents.organizacaoId, ctx.organizacaoId), eq(aiAgents.status, "published"))),
  ]);

  const eventType = parsed.data.eventType.trim();
  const matches = candidatos.filter(({ agent, version }) => {
    if (parsed.data.agentId && agent.id !== parsed.data.agentId) return false;
    const config = version.triggerConfig && typeof version.triggerConfig === "object" ? version.triggerConfig as Record<string, unknown> : {};
    const configured = [config.eventType, config.trigger, ...(Array.isArray(config.events) ? config.events : []), ...(Array.isArray(config.eventTypes) ? config.eventTypes : [])]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim());
    // Versão publicada sem trigger explícito é elegível somente quando o
    // vendedor seleciona o agentId, evitando roteamento acidental.
    return configured.includes(eventType);
  }).sort((a, b) => b.agent.prioridade - a.agent.prioridade || b.agent.updatedAt.getTime() - a.agent.updatedAt.getTime());

  const selecionado = matches[0] ?? null;
  if (!selecionado) {
    return c.json({ ok: true, modo: "dry_run", selecionado: null, motivo: "nenhum agente publicado corresponde ao evento", candidatos: candidatos.length });
  }

  const configuredTools = Array.isArray(selecionado.version.tools)
    ? selecionado.version.tools.filter((tool): tool is string => typeof tool === "string")
    : [];
  const requestedTools = parsed.data.requestedTools;
  const allowedTools = requestedTools.length > 0
    ? requestedTools.filter((tool) => configuredTools.includes(tool))
    : configuredTools;
  const blockedTools = requestedTools.filter((tool) => !configuredTools.includes(tool));
  const trace = [
    { type: "dispatch", eventType, entityType: parsed.data.entityType, entityId: parsed.data.entityId ?? null },
    { type: "agent_selected", agentId: selecionado.agent.id, versionId: selecionado.version.id, prioridade: selecionado.agent.prioridade },
    { type: "policy", modo: "dry_run", allowedTools, blockedTools, maxSteps: selecionado.version.maxSteps, tokenBudget: selecionado.version.tokenBudget },
    { type: "handoff", required: false, reason: null },
    { type: "dry_run", message: "Execução simulada; nenhuma mensagem, chamada de modelo ou ferramenta externa foi executada." },
  ];
  const [run] = await db.insert(aiAgentRuns).values({
    organizacaoId: ctx.organizacaoId,
    agentId: selecionado.agent.id,
    versionId: selecionado.version.id,
    contatoId: parsed.data.contatoId ?? null,
    leadId: parsed.data.leadId ?? null,
    modo: "dry_run",
    status: "completed",
    input: parsed.data,
    trace,
    tokens: 0,
    custo: "0",
    completedAt: new Date(),
  }).returning();

  return c.json({
    ok: true,
    modo: "dry_run",
    selecionado: { agentId: selecionado.agent.id, nome: selecionado.agent.nome, versionId: selecionado.version.id, versao: selecionado.version.versao },
    policy: { allowedTools, blockedTools, maxSteps: selecionado.version.maxSteps, tokenBudget: selecionado.version.tokenBudget },
    run,
  });
});

app.get("/automacoes/agentes/:id", async (c) => {
  const ctx = await getCtx(c);
  const [agent] = await db.select().from(aiAgents).where(and(eq(aiAgents.id, c.req.param("id")), eq(aiAgents.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const versions = await db.select().from(aiAgentVersions).where(eq(aiAgentVersions.agentId, agent.id)).orderBy(desc(aiAgentVersions.versao));
  const runs = await db.select().from(aiAgentRuns).where(and(eq(aiAgentRuns.agentId, agent.id), eq(aiAgentRuns.organizacaoId, ctx.organizacaoId))).orderBy(desc(aiAgentRuns.startedAt)).limit(50);
  return c.json({ agent, versions, runs });
});

app.patch("/automacoes/agentes/:id", async (c) => {
  const ctx = await getCtx(c);
  const parsed = agentSchema.partial({ versao: true }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Agente invalido", details: parsed.error.flatten() }, 400);
  const [updated] = await db.update(aiAgents).set({
    ...(parsed.data.nome ? { nome: parsed.data.nome } : {}),
    ...(parsed.data.slug ? { slug: parsed.data.slug } : {}),
    ...(parsed.data.descricao !== undefined ? { descricao: parsed.data.descricao } : {}),
    ...(parsed.data.finalidade ? { finalidade: parsed.data.finalidade } : {}),
    ...(parsed.data.prioridade !== undefined ? { prioridade: parsed.data.prioridade } : {}),
    updatedAt: new Date(),
  }).where(and(eq(aiAgents.id, c.req.param("id")), eq(aiAgents.organizacaoId, ctx.organizacaoId))).returning();
  if (!updated) return c.json({ error: "Agente nao encontrado" }, 404);
  return c.json(updated);
});

app.post("/automacoes/agentes/:id/versions", async (c) => {
  const ctx = await getCtx(c);
  const [agent] = await db.select().from(aiAgents).where(and(eq(aiAgents.id, c.req.param("id")), eq(aiAgents.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const parsed = versionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Versao invalida", details: parsed.error.flatten() }, 400);
  const [last] = await db.select({ versao: aiAgentVersions.versao }).from(aiAgentVersions).where(eq(aiAgentVersions.agentId, agent.id)).orderBy(desc(aiAgentVersions.versao)).limit(1);
  const [version] = await db.insert(aiAgentVersions).values({ agentId: agent.id, versao: (last?.versao ?? 0) + 1, createdById: ctx.userId, ...normalizarVersao(parsed.data) }).returning();
  return c.json(version, 201);
});

app.patch("/automacoes/agentes/:id/versions/:versionId", async (c) => {
  const ctx = await getCtx(c);
  const [agent] = await db.select({ id: aiAgents.id }).from(aiAgents)
    .where(and(eq(aiAgents.id, c.req.param("id")), eq(aiAgents.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const parsed = versionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Versao invalida", details: parsed.error.flatten() }, 400);
  const [updated] = await db.update(aiAgentVersions).set(normalizarVersao(parsed.data))
    .where(and(
      eq(aiAgentVersions.id, c.req.param("versionId")),
      eq(aiAgentVersions.agentId, agent.id),
      eq(aiAgentVersions.status, "draft"),
    )).returning();
  if (!updated) return c.json({ error: "Somente um rascunho pode ser editado" }, 409);
  return c.json(updated);
});

app.post("/automacoes/agentes/:id/versions/:versionId/publish", async (c) => {
  const ctx = await getCtx(c);
  const [agent] = await db.select({ id: aiAgents.id }).from(aiAgents).where(and(eq(aiAgents.id, c.req.param("id")), eq(aiAgents.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const [version] = await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.id, c.req.param("versionId")), eq(aiAgentVersions.agentId, agent.id))).limit(1);
  if (!version) return c.json({ error: "Versao nao encontrada" }, 404);
  if (version.status !== "draft") return c.json({ error: "Somente um rascunho pode ser publicado" }, 409);
  const triggerConfig = version.triggerConfig && typeof version.triggerConfig === "object" ? version.triggerConfig as Record<string, unknown> : {};
  const events = Array.isArray(triggerConfig.events) ? triggerConfig.events.filter((event): event is string => typeof event === "string") : [];
  if (!version.provider?.trim() || !version.modelo?.trim()) return c.json({ error: "Defina provider e modelo antes de publicar" }, 409);
  if (version.systemPrompt.trim().length < 20) return c.json({ error: "Complete as instrucoes antes de publicar" }, 409);
  if (events.length === 0) return c.json({ error: "Escolha pelo menos um gatilho antes de publicar" }, 409);
  const updated = await db.transaction(async (tx) => {
    await tx.update(aiAgentVersions).set({ status: "superseded" }).where(and(eq(aiAgentVersions.agentId, agent.id), eq(aiAgentVersions.status, "published")));
    await tx.update(aiAgentVersions).set({ status: "published", publishedAt: new Date() }).where(eq(aiAgentVersions.id, version.id));
    const [publishedAgent] = await tx.update(aiAgents).set({ status: "published", updatedAt: new Date() }).where(eq(aiAgents.id, agent.id)).returning();
    return publishedAgent;
  });
  return c.json({ agent: updated, versionId: version.id });
});

app.post("/automacoes/agentes/:id/test", async (c) => {
  const ctx = await getCtx(c);
  const [agent] = await db.select().from(aiAgents).where(and(eq(aiAgents.id, c.req.param("id")), eq(aiAgents.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const body = await c.req.json();
  const [version] = body?.versionId
    ? await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.agentId, agent.id), eq(aiAgentVersions.id, body.versionId))).limit(1)
    : await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.agentId, agent.id), eq(aiAgentVersions.status, "published"))).orderBy(desc(aiAgentVersions.versao)).limit(1);
  if (!version) return c.json({ error: "Versao do agente nao encontrada" }, 409);
  const requestedTools = Array.isArray(body?.requestedTools) ? body.requestedTools.filter((tool: unknown): tool is string => typeof tool === "string") : [];
  const configuredTools = Array.isArray(version.tools) ? version.tools.filter((tool): tool is string => typeof tool === "string") : [];
  const allowedTools = requestedTools.filter((tool: string) => configuredTools.includes(tool));
  const [run] = await db.insert(aiAgentRuns).values({
    organizacaoId: ctx.organizacaoId,
    agentId: agent.id,
    versionId: version.id,
    modo: "dry_run",
    status: "completed",
    input: body,
    trace: [
      { type: "version_selected", versionId: version.id, versao: version.versao, status: version.status },
      { type: "policy", allowedTools, maxSteps: version.maxSteps, tokenBudget: version.tokenBudget },
      { type: "dry_run", message: "Execucao simulada; nenhuma LLM, mensagem ou ferramenta externa foi acionada." },
    ],
    completedAt: new Date(),
  }).returning();
  return c.json({ run });
});

export const automacoesAgentesRoutes = app;
