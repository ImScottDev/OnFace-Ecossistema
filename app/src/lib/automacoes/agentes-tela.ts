/**
 * Dados da tela Automação → Agentes (NEXO / Agentes IA), no SSR.
 *
 * Lê as mesmas tabelas que a rota Hono `/api/automacoes/agentes` (ai_agents,
 * ai_agent_versions, ai_agent_runs) — a escrita continua toda lá. Ler aqui no
 * servidor evita a tela abrir num skeleton e permite calcular a prontidão com
 * a MESMA função que o publish usa (`verificarProntidao`): o que a lista diz
 * que falta é exatamente o que o botão Publicar vai recusar.
 *
 * Segredo nunca sai daqui: de credencial só respondemos SE existe (booleano
 * por provedor e rótulo da credencial da organização), nunca valor nem last4.
 */
import { db } from "@/lib/db";
import { aiAgents, aiAgentVersions, aiAgentRuns, aiProviderCredentials } from "@/lib/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { provedoresNoAmbiente, verificarProntidao, type Falta } from "@/lib/ai-platform/prontidao";
import { AGENT_PURPOSES, AGENT_TOOL_CATALOG, isKnownAgentTool, type AgentToolCategory } from "@/lib/ai/agent-studio";

export type ProviderId = "groq" | "openai" | "anthropic" | "google" | "claude_subscription";

export interface AgenteDaTela {
  id: string;
  nome: string;
  descricao: string | null;
  papel: string;
  status: string; // draft | published | paused | archived
  versao: number | null; // versão em trabalho (a mais recente)
  versaoPublicada: number | null;
  provider: string | null;
  modelo: string | null;
  capacidades: number;
  /** Capacidades ligadas por categoria do catálogo (só as que o runtime executa). */
  categorias: Partial<Record<AgentToolCategory, number>>;
  /** Ações gravadas em formato antigo: o runtime ignora até o editor converter e salvar. */
  legadas: number;
  /** `guardrail_config.autonomy` da versão em trabalho: suggest | approval | autonomous. */
  modo: string;
  faltas: Falta[];
  execucoes: number;
  ultimaExecucao: string | null;
  atualizadoEm: string;
}

export interface ExecucaoDaTela {
  id: string;
  agenteId: string;
  agente: string;
  modo: string;
  status: string;
  tokens: number;
  latenciaMs: number | null;
  erro: string | null;
  handoff: string | null;
  inicio: string;
}

export interface DadosTelaAgentes {
  agentes: AgenteDaTela[];
  execucoes: ExecucaoDaTela[];
  /** Execuções por dia nos últimos 30 dias, do mais antigo ao de hoje. */
  serie: { dia: string; total: number; falhas: number }[];
  totais30d: { execucoes: number; falhas: number; handoffs: number; tokens: number };
  /** Provedor -> há credencial disponível (ambiente ou organização)? */
  provedores: { id: ProviderId; nome: string; ambiente: boolean; organizacao: string[] }[];
}

// Finalidades que existem no banco mas não estão no catálogo de presets
// (NEXO = copiloto, Hermes = orquestração). Sem isto a tela mostraria o id cru.
const PAPEL_EXTRA: Record<string, string> = { copiloto: "Copiloto", orquestracao: "Orquestração" };
export function nomeDoPapel(id: string) {
  return AGENT_PURPOSES.find((p) => p.id === id)?.nome ?? PAPEL_EXTRA[id] ?? id;
}


export async function dadosTelaAgentes(organizacaoId: string): Promise<DadosTelaAgentes> {
  // Janela de 30 dias ancorada no dia de HOJE em São Paulo, não no fuso do
  // processo: o SSR roda em UTC em produção, e `setHours` deixaria o dia de
  // hoje (BRT) fora da série enquanto as execuções dele entrariam nos totais.
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const [agentes, versoes, porAgente, execucoes, serieBruta, credenciais] = await Promise.all([
    db.select().from(aiAgents)
      .where(eq(aiAgents.organizacaoId, organizacaoId))
      .orderBy(desc(aiAgents.prioridade), desc(aiAgents.updatedAt)),
    db.select().from(aiAgentVersions)
      .where(eq(aiAgentVersions.organizacaoId, organizacaoId))
      .orderBy(desc(aiAgentVersions.versao)),
    db.select({ agentId: aiAgentRuns.agentId, total: count(), ultima: sql<string>`max(${aiAgentRuns.startedAt})` })
      .from(aiAgentRuns).where(eq(aiAgentRuns.organizacaoId, organizacaoId)).groupBy(aiAgentRuns.agentId),
    db.select({
      id: aiAgentRuns.id, agenteId: aiAgentRuns.agentId, agente: aiAgents.nome, modo: aiAgentRuns.modo,
      status: aiAgentRuns.status, tokens: aiAgentRuns.tokens, latenciaMs: aiAgentRuns.latencyMs,
      erro: aiAgentRuns.erro, handoff: aiAgentRuns.handoffMotivo, inicio: aiAgentRuns.startedAt,
    }).from(aiAgentRuns)
      .innerJoin(aiAgents, eq(aiAgents.id, aiAgentRuns.agentId))
      .where(eq(aiAgentRuns.organizacaoId, organizacaoId))
      .orderBy(desc(aiAgentRuns.startedAt)).limit(12),
    db.select({
      dia: sql<string>`to_char(${aiAgentRuns.startedAt} at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      total: count(),
      falhas: sql<number>`count(*) filter (where ${aiAgentRuns.status} in ('failed', 'aborted'))::int`, // aborted = orçamento estourou (execute-agent.ts)
      handoffs: sql<number>`count(*) filter (where ${aiAgentRuns.handoffMotivo} is not null or ${aiAgentRuns.status} = 'handed_off')::int`,
      tokens: sql<number>`coalesce(sum(${aiAgentRuns.tokens}), 0)::int`,
    }).from(aiAgentRuns)
      .where(and(eq(aiAgentRuns.organizacaoId, organizacaoId), 
        // Mesmo corte da série, calculado no banco: meia-noite BRT de 29 dias atrás.
        sql`${aiAgentRuns.startedAt} >= ((now() at time zone 'America/Sao_Paulo')::date - 29)::timestamp at time zone 'America/Sao_Paulo'`))
      .groupBy(sql`1`),
    db.select({ provider: aiProviderCredentials.provider, label: aiProviderCredentials.label })
      .from(aiProviderCredentials)
      .where(and(eq(aiProviderCredentials.organizacaoId, organizacaoId), eq(aiProviderCredentials.ativo, true))),
  ]);

  const runs = new Map(porAgente.map((r) => [r.agentId, r]));
  const lista: AgenteDaTela[] = await Promise.all(agentes.map(async (a) => {
    const minhas = versoes.filter((v) => v.agentId === a.id); // já vem desc por versão
    const trabalho = minhas[0] ?? null;
    const publicada = minhas.find((v) => v.status === "published") ?? null;
    // Prontidão da versão em trabalho: é ela que o botão Publicar vai mandar.
    const pront = trabalho ? await verificarProntidao(trabalho) : null;
    const r = runs.get(a.id);
    // Só conta o que o runtime executa: id fora do catálogo é ignorado por ele.
    const brutas = Array.isArray(trabalho?.tools) ? (trabalho.tools as unknown[]).filter((t): t is string => typeof t === "string") : [];
    const tools = brutas.filter(isKnownAgentTool);
    const categorias: Partial<Record<AgentToolCategory, number>> = {};
    for (const t of tools) {
      const c = AGENT_TOOL_CATALOG.find((d) => d.id === t)?.categoria;
      if (c) categorias[c] = (categorias[c] ?? 0) + 1;
    }
    const g = (trabalho?.guardrailConfig ?? {}) as Record<string, unknown>;
    // Os agentes semeados gravaram `autonomia`; o runtime lê `autonomy`.
    const modoBruto = g.autonomy ?? g.autonomia;
    return {
      id: a.id,
      nome: a.nome,
      descricao: a.descricao,
      papel: nomeDoPapel(a.finalidade),
      status: a.status,
      versao: trabalho?.versao ?? null,
      versaoPublicada: publicada?.versao ?? null,
      provider: trabalho?.provider ?? null,
      modelo: trabalho?.modelo ?? null,
      capacidades: tools.length,
      categorias,
      legadas: brutas.length - tools.length,
      modo: typeof modoBruto === "string" ? modoBruto : "suggest",
      faltas: pront?.faltas ?? [],
      execucoes: r?.total ?? 0,
      ultimaExecucao: r?.ultima ? new Date(r.ultima).toISOString() : null,
      atualizadoEm: a.updatedAt.toISOString(),
    };
  }));

  const porDia = new Map(serieBruta.map((s) => [s.dia, s]));
  const serie = Array.from({ length: 30 }, (_, i) => {
    // Aritmética em UTC sobre a data-string: sem fuso nem horário de verão no meio.
    const dia = new Date(Date.parse(hoje + "T00:00:00Z") - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    const s = porDia.get(dia);
    return { dia, total: s?.total ?? 0, falhas: s?.falhas ?? 0 };
  });
  const totais30d = serieBruta.reduce(
    (acc, s) => ({ execucoes: acc.execucoes + s.total, falhas: acc.falhas + s.falhas, handoffs: acc.handoffs + s.handoffs, tokens: acc.tokens + s.tokens }),
    { execucoes: 0, falhas: 0, handoffs: 0, tokens: 0 },
  );

  return {
    agentes: lista,
    execucoes: execucoes.map((e) => ({ ...e, inicio: e.inicio.toISOString() })),
    serie,
    totais30d,
    /* Quem sabe qual variável vale para cada provedor é a plataforma de IA, a
       mesma que o gate de publicação e o runtime consultam. A tela só mostra
       o booleano. */
    provedores: provedoresNoAmbiente().map((p) => ({
      id: p.id as ProviderId, nome: p.nome, ambiente: p.temCredencial,
      organizacao: credenciais.filter((c) => c.provider === p.id).map((c) => c.label),
    })),
  };
}
