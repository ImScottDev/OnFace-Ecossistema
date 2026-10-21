// Automações → Agentes (19/08) — 1ª entrada de um catálogo de agentes de IA
// que ainda não existe hoje no CRM2. Achado real (investigação 19/08): não
// há múltiplos "agentes" configuráveis — existe 1 config por organização
// (`ai_sdr_config`) que já roda em produção como AI SDR. Recovery/Collection/
// CS Agent NÃO existem ainda; esta rota não inventa dados pra eles, só
// devolve o único agente real hoje. Estrutura em lista pronta pra crescer
// quando esses outros agentes existirem de fato.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { aiAgents, aiAgentVersions, aiAgentRuns, usuarios, whatsappSessao } from "@/lib/db/schema";
import { eq, and, count, desc, inArray, not } from "drizzle-orm";
import { getCtx, exigirCtx } from "../compat.js";
import { z } from "zod";
import {
  AGENT_TRIGGER_EVENTS,
  AGENT_SYSTEM_SLUGS,
  AGENT_PURPOSES,
  AGENT_TOOL_CATALOG,
  DEFAULT_HANDOFF_CONFIG,
  DEFAULT_TRIGGER_CONFIG,
  isSystemAgentSlug,
  isKnownAgentTool,
} from "@/lib/ai/agent-studio";
import { CLASSES_AUTONOMIA, ehModo } from "@/lib/ai-platform/tools/politica";
import { executeAgent } from "@/lib/ai-platform/runtime/execute-agent";
import { verificarProntidao, resumoDasFaltas } from "@/lib/ai-platform/prontidao";
import { arquivarAgente } from "@/lib/ai-platform/publicacao";

const app = new Hono();
const agenteConfiguravel = (id: string, organizacaoId: string) => and(
  eq(aiAgents.id, id), eq(aiAgents.organizacaoId, organizacaoId), not(inArray(aiAgents.slug, [...AGENT_SYSTEM_SLUGS])),
);

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
    .where(and(eq(aiAgents.organizacaoId, orgId), not(inArray(aiAgents.slug, [...AGENT_SYSTEM_SLUGS]))))
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
  return c.json({ tools: AGENT_TOOL_CATALOG, events: AGENT_TRIGGER_EVENTS, purposes: AGENT_PURPOSES });
});

const versionSchema = z.object({
  systemPrompt: z.string().default(""),
  // claude_subscription: adaptador da assinatura (execute-agent.ts); a
  // prontidão recusa credencial da organização para ele.
  provider: z.enum(["groq", "openai", "anthropic", "google", "claude_subscription"]).nullable().optional(),
  modelo: z.string().nullable().optional(),
  credentialId: z.string().uuid().nullable().optional(),
  channelSessionId: z.string().uuid().nullable().optional(),
  tools: z.array(z.string()).max(30).default([]).refine((tools) => tools.every(isKnownAgentTool), "Capacidade desconhecida"),
  triggerConfig: z.record(z.string(), z.unknown()).default(DEFAULT_TRIGGER_CONFIG),
  handoffConfig: z.record(z.string(), z.unknown()).default(DEFAULT_HANDOFF_CONFIG),
  knowledgeConfig: z.record(z.string(), z.unknown()).default({}),
  guardrailConfig: z.record(z.string(), z.unknown()).default({}),
  maxSteps: z.number().int().min(1).max(30).default(8),
  tokenBudget: z.number().int().min(1).max(100000).default(4000),
  costBudget: z.number().nonnegative().nullable().optional(),
  historyMessageWindow: z.number().int().min(1).max(100).default(20),
  historyTokenWindow: z.number().int().min(500).max(100000).default(8000),
  casesEnabled: z.boolean().default(false),
});

const agentSchema = z.object({
  nome: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80).refine((slug) => !isSystemAgentSlug(slug), "Identidade interna reservada"),
  descricao: z.string().max(500).nullable().optional(),
  finalidade: z.string().min(1).max(80).default("atendimento"),
  prioridade: z.number().int().min(0).max(10000).default(100),
  versao: versionSchema.default({
    systemPrompt: "",
    tools: [],
    triggerConfig: DEFAULT_TRIGGER_CONFIG,
    handoffConfig: DEFAULT_HANDOFF_CONFIG,
    knowledgeConfig: {},
    guardrailConfig: {},
    maxSteps: 8,
    tokenBudget: 4000,
    historyMessageWindow: 20,
    historyTokenWindow: 8000,
    casesEnabled: false,
  }),
});

/* ── Validação da configuração (servidor é a fonte da regra; a tela só espelha) ───────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const inteiroEntre = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Devolve a primeira mensagem de erro (em português) ou null. Chaves ausentes valem o padrão do runtime. */
export async function validarConfiguracaoDaVersao(organizacaoId: string, v: z.infer<typeof versionSchema>): Promise<string | null> {
  const g = rec(v.guardrailConfig);
  for (const k of ["autonomia", "autonomy"]) if (g[k] !== undefined && !ehModo(g[k])) return "Modo de autonomia inválido: use copiloto, sob aprovação ou autônomo controlado.";
  if (g.autonomiaPorAcao !== undefined) {
    const p = rec(g.autonomiaPorAcao);
    const ids: string[] = CLASSES_AUTONOMIA.map((c) => c.id);
    for (const [k, m] of Object.entries(p)) {
      if (!ids.includes(k)) return `Classe de autonomia desconhecida: ${k}.`;
      if (!ehModo(m)) return `Modo de autonomia inválido em ${CLASSES_AUTONOMIA.find((c) => c.id === k)?.rotulo ?? k}.`;
    }
  }
  const l = rec(g.limites);
  if (l.maxMensagensPorHora !== undefined && !inteiroEntre(l.maxMensagensPorHora, 0, 600)) return "Mensagens por hora deve ser um número inteiro de 0 a 600 (0 = sem limite).";
  if (l.maxMensagensPorDia !== undefined && !inteiroEntre(l.maxMensagensPorDia, 0, 5000)) return "Mensagens por dia deve ser um número inteiro de 0 a 5000 (0 = sem limite).";
  if (l.maxSemRetorno !== undefined && !inteiroEntre(l.maxSemRetorno, 0, 20)) return "Mensagens sem retorno deve ser um número inteiro de 0 a 20.";
  if (l.responderForaDoHorario !== undefined && typeof l.responderForaDoHorario !== "boolean") return "Responder fora do horário deve ser sim ou não.";
  const h = rec(g.horarioComercial);
  if (h.inicio !== undefined && !(typeof h.inicio === "string" && HHMM.test(h.inicio))) return "Horário de início inválido (use HH:MM).";
  if (h.fim !== undefined && !(typeof h.fim === "string" && HHMM.test(h.fim))) return "Horário de fim inválido (use HH:MM).";
  if (typeof h.inicio === "string" && typeof h.fim === "string" && h.inicio >= h.fim) return "O horário de início deve ser antes do fim.";
  if (h.dias !== undefined && !(Array.isArray(h.dias) && h.dias.length > 0 && h.dias.every((d) => inteiroEntre(d, 0, 6)))) return "Escolha pelo menos um dia da semana válido para o horário.";
  const f = rec(g.followup);
  if (f.maxRetomadas !== undefined && !inteiroEntre(f.maxRetomadas, 0, 20)) return "Máximo de retomadas deve ser um número inteiro de 0 a 20.";
  if (f.janelaDias !== undefined && !inteiroEntre(f.janelaDias, 1, 180)) return "Janela das retomadas deve ser de 1 a 180 dias.";
  if (f.maxDiasRetomada !== undefined && !inteiroEntre(f.maxDiasRetomada, 1, 365)) return "Horizonte máximo da retomada deve ser de 1 a 365 dias.";
  if (g.memoria !== undefined && typeof rec(g.memoria).ativa !== "boolean" && rec(g.memoria).ativa !== undefined) return "Memória ligada deve ser sim ou não.";
  const ho = rec(v.handoffConfig);
  if (ho.prioridade !== undefined && !["normal", "alta", "urgente"].includes(String(ho.prioridade))) return "Prioridade do handoff inválida (normal, alta ou urgente).";
  if (ho.retomada !== undefined && !["somente_humano", "automatica"].includes(String(ho.retomada))) return "Regra de retomada inválida.";
  if (ho.retomadaHoras !== undefined && !inteiroEntre(ho.retomadaHoras, 1, 720)) return "Devolver ao agente após deve ser um número inteiro de horas, de 1 a 720.";
  if (ho.mensagemTransicao !== undefined && ho.mensagemTransicao !== null && (typeof ho.mensagemTransicao !== "string" || ho.mensagemTransicao.length > 600)) return "A mensagem de transição deve ter até 600 caracteres.";
  const kc = rec(v.knowledgeConfig);
  if (kc.maxTrechos !== undefined && !inteiroEntre(kc.maxTrechos, 1, 8)) return "Máximo de trechos de conhecimento deve ser de 1 a 8.";
  if (kc.categorias !== undefined && !(Array.isArray(kc.categorias) && kc.categorias.every((x) => typeof x === "string" && x.length <= 40))) return "Categorias de conhecimento inválidas.";

  const c = rec(g.canais);
  if (c.sessoes !== undefined) {
    if (!Array.isArray(c.sessoes) || !c.sessoes.every((x) => typeof x === "string" && UUID_RE.test(x))) return "Números autorizados inválidos.";
    const ids = [...new Set(c.sessoes as string[])];
    if (ids.length) {
      const ok = await db.select({ id: whatsappSessao.id }).from(whatsappSessao).where(and(eq(whatsappSessao.organizacaoId, organizacaoId), inArray(whatsappSessao.id, ids)));
      if (ok.length !== ids.length) return "Um dos números autorizados não pertence a esta organização.";
    }
  }
  const sup = g.supervisorUsuarioId;
  if (sup !== undefined && sup !== null && sup !== "") {
    if (typeof sup !== "string" || !UUID_RE.test(sup)) return "Supervisor inválido.";
    const [u] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.id, sup), eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true), not(eq(usuarios.tipo, "agente")))).limit(1);
    if (!u) return "O supervisor precisa ser uma pessoa ativa desta organização.";
  }
  return null;
}

function normalizarVersao(version: z.infer<typeof versionSchema>) {
  return {
    ...version,
    costBudget: version.costBudget == null ? null : String(version.costBudget),
  };
}

app.post("/automacoes/agentes", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const parsed = agentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Agente invalido", details: parsed.error.flatten() }, 400);
  const invalida = await validarConfiguracaoDaVersao(ctx.organizacaoId, parsed.data.versao);
  if (invalida) return c.json({ error: invalida }, 400);
  const [agent] = await db.insert(aiAgents).values({
    organizacaoId: ctx.organizacaoId,
    nome: parsed.data.nome,
    slug: parsed.data.slug,
    descricao: parsed.data.descricao ?? null,
    finalidade: parsed.data.finalidade,
    prioridade: parsed.data.prioridade,
    createdById: ctx.userId,
  }).returning();
  await db.insert(aiAgentVersions).values({ organizacaoId: ctx.organizacaoId, agentId: agent.id, versao: 1, createdById: ctx.userId, ...normalizarVersao(parsed.data.versao) });
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
  const ctx = await exigirCtx(c, "ai.use");
  const parsed = dispatchDryRunSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Evento inválido", details: parsed.error.flatten() }, 400);

  const [candidatos] = await Promise.all([
    db.select({
      agent: aiAgents,
      version: aiAgentVersions,
    }).from(aiAgents)
      .innerJoin(aiAgentVersions, and(eq(aiAgentVersions.agentId, aiAgents.id), eq(aiAgentVersions.status, "published")))
      .where(and(eq(aiAgents.organizacaoId, ctx.organizacaoId), eq(aiAgents.status, "published"), not(inArray(aiAgents.slug, [...AGENT_SYSTEM_SLUGS])))),
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
  const [agent] = await db.select().from(aiAgents).where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const versions = await db.select().from(aiAgentVersions).where(eq(aiAgentVersions.agentId, agent.id)).orderBy(desc(aiAgentVersions.versao));
  const runs = await db.select().from(aiAgentRuns).where(and(eq(aiAgentRuns.agentId, agent.id), eq(aiAgentRuns.organizacaoId, ctx.organizacaoId))).orderBy(desc(aiAgentRuns.startedAt)).limit(50);
  return c.json({ agent, versions, runs });
});

app.patch("/automacoes/agentes/:id", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const parsed = agentSchema.partial({ versao: true }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Agente invalido", details: parsed.error.flatten() }, 400);
  const [agent] = await db.select({ id: aiAgents.id }).from(aiAgents).where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const [updated] = await db.update(aiAgents).set({
    ...(parsed.data.nome ? { nome: parsed.data.nome } : {}),
    ...(parsed.data.slug ? { slug: parsed.data.slug } : {}),
    ...(parsed.data.descricao !== undefined ? { descricao: parsed.data.descricao } : {}),
    ...(parsed.data.finalidade ? { finalidade: parsed.data.finalidade } : {}),
    ...(parsed.data.prioridade !== undefined ? { prioridade: parsed.data.prioridade } : {}),
    updatedAt: new Date(),
  }).where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).returning();
  if (!updated) return c.json({ error: "Agente nao encontrado" }, 404);
  return c.json(updated);
});

// Excluir agente = arquivar (ver `arquivarAgente`): ele para de responder e sai
// dos seletores, e o histórico de execuções continua consultável.
app.delete("/automacoes/agentes/:id", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const [agent] = await db.select({ id: aiAgents.id }).from(aiAgents).where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const arquivado = await arquivarAgente(ctx.organizacaoId, agent.id);
  if (!arquivado) return c.json({ error: "Este agente já está arquivado" }, 409);
  return c.json({ agente: arquivado });
});

app.post("/automacoes/agentes/:id/versions", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const [agent] = await db.select().from(aiAgents).where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const parsed = versionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Versao invalida", details: parsed.error.flatten() }, 400);
  const invalida = await validarConfiguracaoDaVersao(ctx.organizacaoId, parsed.data);
  if (invalida) return c.json({ error: invalida }, 400);
  const [last] = await db.select({ versao: aiAgentVersions.versao }).from(aiAgentVersions).where(eq(aiAgentVersions.agentId, agent.id)).orderBy(desc(aiAgentVersions.versao)).limit(1);
  const [version] = await db.insert(aiAgentVersions).values({ organizacaoId: ctx.organizacaoId, agentId: agent.id, versao: (last?.versao ?? 0) + 1, createdById: ctx.userId, ...normalizarVersao(parsed.data) }).returning();
  return c.json(version, 201);
});

app.patch("/automacoes/agentes/:id/versions/:versionId", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const [agent] = await db.select({ id: aiAgents.id }).from(aiAgents)
    .where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const parsed = versionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Versao invalida", details: parsed.error.flatten() }, 400);
  const invalida = await validarConfiguracaoDaVersao(ctx.organizacaoId, parsed.data);
  if (invalida) return c.json({ error: invalida }, 400);
  const [updated] = await db.update(aiAgentVersions).set(normalizarVersao(parsed.data))
    .where(and(
      eq(aiAgentVersions.id, c.req.param("versionId")),
      eq(aiAgentVersions.agentId, agent.id),
      eq(aiAgentVersions.status, "draft"),
    )).returning();
  if (!updated) return c.json({ error: "Somente um rascunho pode ser editado" }, 409);
  return c.json(updated);
});

// A tela pergunta ANTES de tentar publicar: a lista de pendências é a mesma
// que o publish usa, então não existe "passou aqui e falhou lá".
app.get("/automacoes/agentes/:id/versions/:versionId/prontidao", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const [agent] = await db.select({ id: aiAgents.id }).from(aiAgents)
    .where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const [version] = await db.select().from(aiAgentVersions)
    .where(and(eq(aiAgentVersions.id, c.req.param("versionId")), eq(aiAgentVersions.agentId, agent.id))).limit(1);
  if (!version) return c.json({ error: "Versao nao encontrada" }, 404);
  return c.json(await verificarProntidao(version));
});

app.post("/automacoes/agentes/:id/versions/:versionId/publish", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const [agent] = await db.select({ id: aiAgents.id }).from(aiAgents).where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const [version] = await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.id, c.req.param("versionId")), eq(aiAgentVersions.agentId, agent.id))).limit(1);
  if (!version) return c.json({ error: "Versao nao encontrada" }, 404);
  if (version.status !== "draft") return c.json({ error: "Somente um rascunho pode ser publicado" }, 409);

  // As quatro checagens que existiam aqui viraram uma, junto com a que
  // faltava: CREDENCIAL. Sem ela a publicação passava e o agente falhava na
  // primeira mensagem do cliente, sem cair no legado (cair duplicaria a
  // resposta) — ou seja, o contato ficava sem resposta em silêncio.
  const prontidao = await verificarProntidao(version);
  if (!prontidao.pronto) {
    return c.json({
      error: `Falta ${prontidao.faltas.length === 1 ? "um item" : `${prontidao.faltas.length} itens`} para publicar: ${resumoDasFaltas(prontidao)}`,
      faltas: prontidao.faltas,
    }, 409);
  }
  const updated = await db.transaction(async (tx) => {
    await tx.update(aiAgentVersions).set({ status: "superseded", supersededAt: new Date() }).where(and(eq(aiAgentVersions.agentId, agent.id), eq(aiAgentVersions.status, "published")));
    await tx.update(aiAgentVersions).set({ status: "published", publishedAt: new Date() }).where(eq(aiAgentVersions.id, version.id));
    const [publishedAgent] = await tx.update(aiAgents).set({ status: "published", publishedVersionId: version.id, updatedAt: new Date() }).where(eq(aiAgents.id, agent.id)).returning();
    return publishedAgent;
  });
  // O agente publicado vira (ou continua sendo) um usuário do sistema: responsável de lead, nos seletores.
  const { sincronizarUsuariosDosAgentes } = await import("@/lib/agentes/usuario-do-agente");
  await sincronizarUsuariosDosAgentes(ctx.organizacaoId).catch((e) => console.error("[agentes] sincronizar usuário do agente:", e));
  return c.json({ agent: updated, versionId: version.id });
});

app.post("/automacoes/agentes/:id/test", async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const [agent] = await db.select().from(aiAgents).where(agenteConfiguravel(c.req.param("id"), ctx.organizacaoId)).limit(1);
  if (!agent) return c.json({ error: "Agente nao encontrado" }, 404);
  const parsed = z.object({
    versionId: z.string().uuid().optional(),
    message: z.string().min(1).max(10000),
    contatoId: z.string().uuid().nullable().optional(),
    leadId: z.string().uuid().nullable().optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
  }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Teste invalido", details: parsed.error.flatten() }, 400);
  const body = parsed.data;
  const [version] = body?.versionId
    ? await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.agentId, agent.id), eq(aiAgentVersions.id, body.versionId))).limit(1)
    : await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.agentId, agent.id), eq(aiAgentVersions.status, "published"))).orderBy(desc(aiAgentVersions.versao)).limit(1);
  if (!version) return c.json({ error: "Versao do agente nao encontrada" }, 409);
  try {
    const result = await executeAgent({
      organizacaoId: ctx.organizacaoId,
      agentId: agent.id,
      versionId: version.id,
      eventType: "agent.test",
      message: body.message,
      contatoId: body.contatoId ?? null,
      leadId: body.leadId ?? null,
      mode: "test",
      suppressEgress: true,
      payload: body.payload,
    });
    const [run] = await db.select().from(aiAgentRuns).where(and(eq(aiAgentRuns.id, result.runId), eq(aiAgentRuns.organizacaoId, ctx.organizacaoId))).limit(1);
    return c.json({ mode: "test", externalEgress: false, result, run });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 502);
  }
});

export const automacoesAgentesRoutes = app;
