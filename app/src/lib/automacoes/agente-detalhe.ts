/**
 * Dados do editor de um agente (Automação → Agentes → [id]), no SSR.
 *
 * Mesmo princípio da lista (`agentes-tela.ts`): ler no servidor, com o
 * tenant do contexto, e deixar TODA escrita nas rotas Hono que já existem
 * (PATCH agente, POST/PATCH versão, publish, test, knowledge, memory). A
 * prontidão vem da mesma `verificarProntidao` que o publish usa.
 *
 * Desempenho é contado em `ai_agent_runs` deste agente. Sem execução, os
 * números são zero e a tela diz isso; nada é estimado.
 *
 * Segredo nunca sai daqui: de credencial só id, provedor, rótulo e se foi
 * validada.
 */
import { db } from "@/lib/db";
import {
  aiAgents, aiAgentVersions, aiAgentRuns, aiProviderCredentials, aiModels,
  aiKnowledgeSources, aiMemoryPointers, aiMemoryVersions, aiCases,
} from "@/lib/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { provedoresNoAmbiente, verificarProntidao, type Falta } from "@/lib/ai-platform/prontidao";

export interface VersaoDoEditor {
  id: string;
  versao: number;
  status: string; // draft | published | superseded
  systemPrompt: string;
  provider: string | null;
  modelo: string | null;
  credentialId: string | null;
  channelSessionId: string | null;
  tools: string[];
  triggerConfig: Record<string, unknown>;
  handoffConfig: Record<string, unknown>;
  knowledgeConfig: Record<string, unknown>;
  guardrailConfig: Record<string, unknown>;
  maxSteps: number;
  tokenBudget: number;
  costBudget: string | null;
  historyMessageWindow: number;
  historyTokenWindow: number;
  casesEnabled: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export interface ExecucaoDoEditor {
  id: string;
  versao: number | null;
  modo: string;
  status: string;
  mensagem: string | null;
  tokens: number;
  custo: number;
  latenciaMs: number | null;
  erro: string | null;
  handoff: string | null;
  ferramentas: string[];
  inicio: string;
}

export interface DadosEditorAgente {
  agente: { id: string; nome: string; slug: string; descricao: string | null; finalidade: string; prioridade: number; status: string; atualizadoEm: string };
  versoes: VersaoDoEditor[];
  /** Prontidão da versão em trabalho (rascunho, ou a mais recente). */
  faltas: Falta[];
  modelos: { provider: string; modelId: string; nome: string; padrao: boolean }[];
  credenciais: { id: string; provider: string; label: string; validada: boolean }[];
  /** Provedor -> há chave no ambiente? Só o booleano. */
  ambiente: Record<string, boolean>;
  conhecimento: { id: string; nome: string; tipo: string; status: string; indexadoEm: string | null }[];
  memoria: { versao: number; conteudo: string; em: string } | null;
  desempenho: {
    total: number; producao: number; teste: number; concluidas: number; humano: number; falhas: number;
    tokens: number; custo: number; latenciaMediaMs: number | null;
    serie: { dia: string; total: number; falhas: number }[];
  };
  execucoes: ExecucaoDoEditor[];
  casosAbertos: { id: string; titulo: string; resumo: string; origem: string; aberto: string }[];
}

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

export async function dadosEditorAgente(organizacaoId: string, agentId: string): Promise<DadosEditorAgente | null> {
  const [agente] = await db.select().from(aiAgents)
    .where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizacaoId, organizacaoId))).limit(1);
  if (!agente) return null;

  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  // Janela de 30 dias a partir da meia-noite BRT (mesmo corte da lista).
  const desde = sql`((now() at time zone 'America/Sao_Paulo')::date - 29)::timestamp at time zone 'America/Sao_Paulo'`;
  const doAgente = and(eq(aiAgentRuns.organizacaoId, organizacaoId), eq(aiAgentRuns.agentId, agente.id));

  const [versoes, modelos, credenciais, fontes, memoria, [agregado], serieBruta, runs, casos] = await Promise.all([
    db.select().from(aiAgentVersions)
      .where(and(eq(aiAgentVersions.agentId, agente.id), eq(aiAgentVersions.organizacaoId, organizacaoId)))
      .orderBy(desc(aiAgentVersions.versao)),
    db.select().from(aiModels).where(isNull(aiModels.deprecatedAt)).orderBy(aiModels.provider, aiModels.displayName),
    db.select({ id: aiProviderCredentials.id, provider: aiProviderCredentials.provider, label: aiProviderCredentials.label, validatedAt: aiProviderCredentials.validatedAt })
      .from(aiProviderCredentials)
      .where(and(eq(aiProviderCredentials.organizacaoId, organizacaoId), eq(aiProviderCredentials.ativo, true))),
    db.select().from(aiKnowledgeSources)
      .where(eq(aiKnowledgeSources.organizacaoId, organizacaoId)).orderBy(desc(aiKnowledgeSources.updatedAt)).limit(50),
    db.select({ versao: aiMemoryVersions.versionNumber, conteudo: aiMemoryVersions.content, em: aiMemoryVersions.createdAt })
      .from(aiMemoryPointers).innerJoin(aiMemoryVersions, eq(aiMemoryVersions.id, aiMemoryPointers.versionId))
      .where(eq(aiMemoryPointers.organizacaoId, organizacaoId)).limit(1),
    db.select({
      total: sql<number>`count(*)::int`,
      producao: sql<number>`count(*) filter (where ${aiAgentRuns.modo} = 'live')::int`,
      teste: sql<number>`count(*) filter (where ${aiAgentRuns.modo} <> 'live')::int`,
      concluidas: sql<number>`count(*) filter (where ${aiAgentRuns.status} = 'completed')::int`,
      humano: sql<number>`count(*) filter (where ${aiAgentRuns.status} = 'handed_off' or ${aiAgentRuns.handoffMotivo} is not null)::int`,
      falhas: sql<number>`count(*) filter (where ${aiAgentRuns.status} in ('failed', 'aborted'))::int`,
      tokens: sql<number>`coalesce(sum(${aiAgentRuns.tokens}), 0)::int`,
      custo: sql<string>`coalesce(sum(${aiAgentRuns.custo}), 0)`,
      // latency_ms nem sempre é gravado; a duração real é completed - started.
      latencia: sql<string | null>`avg(coalesce(${aiAgentRuns.latencyMs}, extract(epoch from (${aiAgentRuns.completedAt} - ${aiAgentRuns.startedAt})) * 1000))`,
    }).from(aiAgentRuns).where(and(doAgente, sql`${aiAgentRuns.startedAt} >= ${desde}`)),
    db.select({
      dia: sql<string>`to_char(${aiAgentRuns.startedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      falhas: sql<number>`count(*) filter (where ${aiAgentRuns.status} in ('failed', 'aborted'))::int`,
    }).from(aiAgentRuns).where(and(doAgente, sql`${aiAgentRuns.startedAt} >= ${desde}`)).groupBy(sql`1`),
    db.select().from(aiAgentRuns).where(doAgente).orderBy(desc(aiAgentRuns.startedAt)).limit(20),
    db.select({ id: aiCases.id, titulo: aiCases.title, resumo: aiCases.summary, origem: aiCases.source, aberto: aiCases.openedAt })
      .from(aiCases)
      .where(and(eq(aiCases.organizacaoId, organizacaoId), eq(aiCases.agentId, agente.id), eq(aiCases.status, "awaiting_human")))
      .orderBy(desc(aiCases.openedAt)).limit(20),
  ]);

  const trabalho = versoes.find((v) => v.status === "draft") ?? versoes[0] ?? null;
  const pront = trabalho ? await verificarProntidao(trabalho) : null;
  const numeroDaVersao = new Map(versoes.map((v) => [v.id, v.versao]));

  const porDia = new Map(serieBruta.map((s) => [s.dia, s]));
  const serie = Array.from({ length: 30 }, (_, i) => {
    const dia = new Date(Date.parse(hoje + "T00:00:00Z") - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    const s = porDia.get(dia);
    return { dia, total: s?.total ?? 0, falhas: s?.falhas ?? 0 };
  });

  return {
    agente: {
      id: agente.id, nome: agente.nome, slug: agente.slug, descricao: agente.descricao, finalidade: agente.finalidade,
      prioridade: agente.prioridade, status: agente.status, atualizadoEm: agente.updatedAt.toISOString(),
    },
    versoes: versoes.map((v) => ({
      id: v.id, versao: v.versao, status: v.status, systemPrompt: v.systemPrompt, provider: v.provider, modelo: v.modelo,
      credentialId: v.credentialId, channelSessionId: v.channelSessionId,
      tools: Array.isArray(v.tools) ? (v.tools as unknown[]).filter((t): t is string => typeof t === "string") : [],
      triggerConfig: obj(v.triggerConfig), handoffConfig: obj(v.handoffConfig), knowledgeConfig: obj(v.knowledgeConfig), guardrailConfig: obj(v.guardrailConfig),
      maxSteps: v.maxSteps, tokenBudget: v.tokenBudget, costBudget: v.costBudget,
      historyMessageWindow: v.historyMessageWindow, historyTokenWindow: v.historyTokenWindow, casesEnabled: v.casesEnabled,
      publishedAt: v.publishedAt?.toISOString() ?? null, createdAt: v.createdAt.toISOString(),
    })),
    faltas: pront?.faltas ?? [],
    modelos: modelos.map((m) => ({ provider: m.provider, modelId: m.modelId, nome: m.displayName, padrao: m.isDefaultForProvider })),
    credenciais: credenciais.map((c) => ({ id: c.id, provider: c.provider, label: c.label, validada: Boolean(c.validatedAt) })),
    /* Quem sabe qual variável vale para cada provedor é a plataforma de IA,
       a mesma que o gate de publicação consulta. A tela só mostra o booleano. */
    ambiente: Object.fromEntries(
      provedoresNoAmbiente().map((p) => [p.id, p.temCredencial]),
    ) as Record<string, boolean>,
    conhecimento: fontes.map((f) => ({ id: f.id, nome: f.nome, tipo: f.sourceType, status: f.status, indexadoEm: f.indexedAt?.toISOString() ?? null })),
    memoria: memoria[0] ? { versao: memoria[0].versao, conteudo: memoria[0].conteudo, em: memoria[0].em.toISOString() } : null,
    desempenho: {
      total: agregado?.total ?? 0, producao: agregado?.producao ?? 0, teste: agregado?.teste ?? 0,
      concluidas: agregado?.concluidas ?? 0, humano: agregado?.humano ?? 0, falhas: agregado?.falhas ?? 0,
      tokens: agregado?.tokens ?? 0, custo: Number(agregado?.custo ?? 0),
      latenciaMediaMs: agregado?.latencia == null ? null : Math.round(Number(agregado.latencia)),
      serie,
    },
    execucoes: runs.map((r) => {
      const trace = Array.isArray(r.trace) ? r.trace as Record<string, unknown>[] : [];
      const msg = obj(r.input).message;
      return {
        id: r.id, versao: r.versionId ? numeroDaVersao.get(r.versionId) ?? null : null, modo: r.modo, status: r.status,
        mensagem: typeof msg === "string" ? msg.slice(0, 280) : null,
        tokens: r.tokens, custo: Number(r.custo ?? 0),
        latenciaMs: r.latencyMs ?? (r.completedAt ? r.completedAt.getTime() - r.startedAt.getTime() : null),
        erro: r.erro, handoff: r.handoffMotivo,
        ferramentas: trace.filter((t) => t.type === "tool_call" && typeof t.name === "string").map((t) => String(t.name)),
        inicio: r.startedAt.toISOString(),
      };
    }),
    casosAbertos: casos.map((c) => ({ ...c, aberto: c.aberto.toISOString() })),
  };
}
