import { MOTIVO_NUMERO_PRIVADO, sessaoEhOperacional, sessaoEhPrivada, usaPoolOperacional } from "@/lib/whatsapp/uso-automatico";
import { createHash, randomUUID } from "node:crypto";
import { compilarPrompt } from "@/lib/ai/agente-escopo";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiAgentRuns, aiAgentRunSteps, aiAgentVersions, aiAgents, aiAlerts, aiCases, aiModels, aiProviderCredentials, aiSendLedger, aiUsageBudgets,
  contatos, whatsappMensagens,
} from "@/lib/db/schema";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { decryptCredential } from "../security/credentials";
import { executeRegisteredTool, modelToolsForIds, type AgentToolResult } from "../tools/registry";
import { runModelCall, type AgentMessage, type AiProvider } from "./provider-gateway";
import { ClaudeSubscriptionAdapter } from "./claude-subscription-adapter";
import { usuarioDoAgente } from "@/lib/agentes/usuario-do-agente";
import { custoEstimadoDoSdk, precoPorTokens } from "@/lib/agentes/custo";
import { versaoAtendeSessao } from "@/lib/atendimento/ia-conversa";
import { construirContexto, type ContextoMontado } from "../contexto/builder";
import { autonomiaDaFerramenta, lerAutonomiaPorAcao, type ModoAutonomia } from "../tools/politica";
import { avaliarEnvio } from "../operacao/politica-canal";
import { FALHAS_PARA_HANDOFF, motivoDeHandoffAutomatico, type ConfigDeHandoff, type SinaisDaExecucao } from "./politica-handoff";
import { textoDoQueChegou } from "../midia/transcrever";

export type ExecuteAgentInput = {
  organizacaoId: string;
  agentId?: string | null;
  versionId?: string | null;
  eventType: string;
  message: string;
  contatoId?: string | null;
  leadId?: string | null;
  sourceMessageId?: string | null;
  mode: "test" | "live";
  suppressEgress?: boolean;
  payload?: Record<string, unknown>;
  /**
   * Quem acionou o agente (SPEC §31).
   *
   * NEXO é operado por conversa e tem usuário; Hermes roda por evento e não
   * tem. Quando existe, o teto de permissão da execução é a INTERSEÇÃO entre
   * o que a versão do agente permite e o que essa pessoa pode — o agente não
   * empresta poder a ninguém, e ninguém empresta poder ao agente.
   */
  usuarioId?: string | null;
  /**
   * Ferramentas de LEITURA/proposta somadas às da versão para esta execução
   * (ex.: o painel do NEXO consulta o CRM com o escopo do usuário). Não
   * amplia permissão de escrita: o gate delegado continua por ferramenta.
   */
  extraToolIds?: string[];
  /** Só as ferramentas de `extraToolIds` (o chat do NEXO não herda as de contato da versão). */
  somenteFerramentasExtras?: boolean;
  /**
   * NEXO age COMO o usuário (decisão do Scott, 08/10): o teto é o RBAC efetivo
   * dele. Se a versão configurar `guardrail_config.permissoes`, a interseção com
   * elas continua valendo; sem configuração, o teto é só o usuário.
   */
  delegarComoUsuario?: boolean;
  usuarioPapel?: string | null;
  /** Autonomia desta execução, acima da configurada na versão (o chat do NEXO executa direto). */
  autonomia?: "suggest" | "approval" | "autonomous";
  /** O usuário confirmou no chat a ação que esta execução reexecuta. */
  confirmado?: boolean;
  /** Atribuição persistente que conduz este atendimento (objetivo e autonomia próprios). */
  atribuicaoId?: string | null;
  objetivo?: string | null;
  atribuicaoAutonomia?: ModoAutonomia | null;
  /** Por que o agente foi acionado agora (retomada, tag, atribuição). Entra no contexto. */
  motivoDaExecucao?: string | null;
  compromissoId?: string | null;
  /** Análise: nenhuma escrita comercial nem mensagem; só nota na timeline. */
  somenteAnalise?: boolean;
};

export type ExecuteAgentResult = {
  runId: string;
  agentId: string;
  versionId: string;
  status: "completed" | "handed_off" | "failed" | "aborted";
  responseText: string | null;
  sentMessageIds: string[];
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  handoff: boolean;
  /** O que o agente viu (secoes/fontes) e o que ficou de fora: a tela de execução mostra isto. */
  contexto?: Pick<ContextoMontado, "secoes" | "fontes" | "sinais" | "tokensAprox"> | null;
};

type SelectedAgent = { agent: typeof aiAgents.$inferSelect; version: typeof aiAgentVersions.$inferSelect };

/** Distinto de outras falhas — deixa quem chamou (ex.: worker de inbound) decidir cair no fluxo legado sem confundir com falha real de execução. */
export class NoEligibleAgentError extends Error {}

function configuredEvents(triggerConfig: unknown): string[] {
  if (!triggerConfig || typeof triggerConfig !== "object") return [];
  const config = triggerConfig as Record<string, unknown>;
  return [config.eventType, config.trigger, ...(Array.isArray(config.events) ? config.events : []), ...(Array.isArray(config.eventTypes) ? config.eventTypes : [])]
    .filter((value): value is string => typeof value === "string");
}

async function selectAgent(input: ExecuteAgentInput): Promise<SelectedAgent> {
  const rows = await db.select({ agent: aiAgents, version: aiAgentVersions }).from(aiAgents)
    .innerJoin(aiAgentVersions, eq(aiAgentVersions.agentId, aiAgents.id))
    .where(and(eq(aiAgents.organizacaoId, input.organizacaoId), input.agentId ? eq(aiAgents.id, input.agentId) : undefined))
    .orderBy(desc(aiAgents.prioridade), desc(aiAgents.updatedAt));

  // Número (sessão) da conversa: versão ligada a um número só atende conversa dele.
  // Sem isto o `channel_session_id` do agente era gravado e nunca lido.
  let sessaoDoContato: string | null = null;
  if (input.mode === "live" && input.contatoId) {
    const [ct] = await db.select({ sessaoId: contatos.sessaoId }).from(contatos).where(and(eq(contatos.id, input.contatoId), eq(contatos.organizacaoId, input.organizacaoId))).limit(1);
    sessaoDoContato = ct?.sessaoId ?? null;
    // Conversa de número privado nunca vai para o modelo: nem leitura de histórico, nem resposta.
    if (await sessaoEhPrivada(input.organizacaoId, sessaoDoContato)) throw new NoEligibleAgentError(MOTIVO_NUMERO_PRIVADO);
  }

  const operacionais = new Set(sessaoDoContato && rows.some(({ version }) => usaPoolOperacional(version.guardrailConfig))
    && await sessaoEhOperacional(input.organizacaoId, sessaoDoContato) ? [sessaoDoContato] : []);
  const selected = rows.find(({ agent, version }) => {
    if (input.versionId && version.id !== input.versionId) return false;
    if (input.mode === "live") {
      if (agent.status !== "published" || version.status !== "published") return false;
      if (agent.publishedVersionId && agent.publishedVersionId !== version.id) return false;
      // Seleção explícita por agentId (ex.: nó de follow-up já escolheu o agente) confia na
      // escolha do chamador e não exige trigger_config — esse gate é só pra roteamento por
      // evento inbound quando múltiplos agentes publicados competem por prioridade.
      if (input.agentId) return true;
      if (!versaoAtendeSessao(version.channelSessionId, sessaoDoContato)) return false;
      // Agente no pool operacional só atende conversa de número operacional.
      if (usaPoolOperacional(version.guardrailConfig) && !(sessaoDoContato && operacionais.has(sessaoDoContato))) return false;
      return configuredEvents(version.triggerConfig).includes(input.eventType);
    }
    return input.versionId ? version.id === input.versionId : version.status === "published" || version.status === "draft";
  });
  if (!selected) throw new NoEligibleAgentError("Nenhum agente/versão elegível para esta execução");
  return selected;
}

async function resolveApiKey(version: typeof aiAgentVersions.$inferSelect): Promise<{ apiKey: string; baseUrl: string | null }> {
  const provider = version.provider as AiProvider | null;
  if (!provider) throw new Error("Provider não configurado");
  if (provider === "claude_subscription") {
    throw new Error("Claude Subscription não usa API key; use o ClaudeSubscriptionAdapter.");
  }
  if (version.credentialId) {
    const [credential] = await db.select().from(aiProviderCredentials).where(and(eq(aiProviderCredentials.id, version.credentialId), eq(aiProviderCredentials.organizacaoId, version.organizacaoId!), eq(aiProviderCredentials.ativo, true))).limit(1);
    if (!credential) throw new Error("Credencial ativa não encontrada");
    return { apiKey: decryptCredential({ ciphertext: credential.apiKeyCiphertext, iv: credential.apiKeyIv, tag: credential.apiKeyTag }), baseUrl: null };
  }
  const envByProvider: Record<AiProvider, string | undefined> = {
    groq: process.env.GROQ_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
    claude_subscription: undefined,
  };
  const apiKey = envByProvider[provider];
  if (!apiKey) throw new Error(`Credencial ${provider} não configurada`);
  // Só fora de produção: aponta o provider para um servidor local de teste (verificação sem token de IA).
  return { apiKey, baseUrl: process.env.NODE_ENV !== "production" ? process.env.ONFACE_AI_BASE_URL_TESTE ?? null : null };
}

/** Motivo do handoff para ai_agent_runs.handoff_motivo (Execuções mostra por que o agente passou a bola). */
function motivoDoHandoff(nome: string, entrada: unknown, resultado: { data?: unknown }): string | null {
  if (nome === "handoff_request") { const m = (entrada as { motivo?: unknown } | null)?.motivo; return typeof m === "string" && m.trim() ? m.trim().slice(0, 300) : "handoff_request"; }
  const m = (resultado.data as { motivoEncerramento?: unknown } | null)?.motivoEncerramento;
  return typeof m === "string" ? m : nome;
}

function sanitizeResponse(raw: string): string {
  return raw
    .replace(/<function=[^>]+>[\s\S]*?<\/function>/gi, "")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|gsk_[A-Za-z0-9_-]{12,})\b/g, "[credencial removida]")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 12_000);
}

/**
 * Quantas mensagens o agente pode disparar de uma vez.
 *
 * Eram oito. Em 21/10/2026 o WhatsApp RESTRINGIU o número da agente por
 * "spam, automated or bulk messaging" — e não foi volume: foram 47 mensagens
 * em dois dias, para 4 contatos, sem UMA conversa iniciada por ela. Foi o
 * padrão: ela quebrava cada resposta em duas ou três mensagens, e 22 disparos
 * numa hora para a MESMA pessoa é exatamente o que o detector lê como robô.
 *
 * Duas por turno dá espaço para o caso legítimo (a resposta e o link, ou a
 * resposta e o horário confirmado) e fecha a porta da metralhadora. Juntar em
 * vez de cortar: ninguém perde conteúdo, o texto vira uma mensagem só.
 */
export const MAX_MENSAGENS_POR_TURNO = 2;

function responseMessages(text: string | null, prepared: string[]): string[] {
  const partes = prepared.length
    ? prepared.map(sanitizeResponse).filter(Boolean)
    : (text ? text.split("\n---SPLIT---\n").map(sanitizeResponse).filter(Boolean) : []);
  if (partes.length <= MAX_MENSAGENS_POR_TURNO) return partes;
  // O excedente é juntado na última, com linha em branco entre as ideias.
  const inicio = partes.slice(0, MAX_MENSAGENS_POR_TURNO - 1);
  const resto = partes.slice(MAX_MENSAGENS_POR_TURNO - 1).join("\n\n");
  return [...inicio, resto];
}

async function calculateCost(provider: string, model: string, tokensInput: number, tokensOutput: number): Promise<number> {
  const [pricing] = await db.select().from(aiModels).where(and(eq(aiModels.provider, provider), eq(aiModels.modelId, model))).limit(1);
  return precoPorTokens(tokensInput, tokensOutput, pricing);
}

async function assertBudget(runId: string, input: ExecuteAgentInput, agentId: string): Promise<void> {
  const budgets = await db.select().from(aiUsageBudgets).where(and(eq(aiUsageBudgets.organizacaoId, input.organizacaoId), eq(aiUsageBudgets.ativo, true)));
  const applicable = budgets.filter((budget) => !budget.agentId || budget.agentId === agentId);
  if (!applicable.length) return;
  const [usage] = await db.select({ tokens: sql<number>`coalesce(sum(${aiAgentRuns.tokensInput} + ${aiAgentRuns.tokensOutput}), 0)::int`, cost: sql<string>`coalesce(sum(${aiAgentRuns.custo}), 0)` }).from(aiAgentRuns)
    .where(and(eq(aiAgentRuns.organizacaoId, input.organizacaoId), sql`${aiAgentRuns.startedAt} >= date_trunc('month', now())`, sql`${aiAgentRuns.id} <> ${runId}`));
  for (const budget of applicable) {
    const exceeded = (budget.tokenLimit != null && (usage?.tokens ?? 0) >= budget.tokenLimit) || (budget.costLimit != null && Number(usage?.cost ?? 0) >= Number(budget.costLimit));
    if (exceeded && budget.hardStop) {
      await db.insert(aiAlerts).values({ organizacaoId: input.organizacaoId, kind: "budget_exceeded", severity: "critical", title: "Orçamento de IA atingido", body: `Execução bloqueada para o agente ${agentId}`, refKind: "run", refId: runId });
      throw new Error("Orçamento de IA atingido");
    }
  }
}

async function persistStep(args: {
  organizacaoId: string; runId: string; sequence: number; kind: string; name?: string; status: string; input?: unknown; output?: unknown;
  tokensInput?: number; tokensOutput?: number; cost?: number; latencyMs?: number; errorCode?: string; errorMessage?: string;
}) {
  await db.insert(aiAgentRunSteps).values({
    organizacaoId: args.organizacaoId, runId: args.runId, sequence: args.sequence, kind: args.kind, name: args.name ?? null, status: args.status,
    input: args.input ?? null, output: args.output ?? null, tokensInput: args.tokensInput ?? 0, tokensOutput: args.tokensOutput ?? 0,
    custo: args.cost == null ? null : String(args.cost), latencyMs: args.latencyMs ?? null, errorCode: args.errorCode ?? null, errorMessage: args.errorMessage ?? null,
    completedAt: args.status === "running" ? null : new Date(),
  });
}

type OpcoesEnvio = {
  /** O próprio run pausou a conversa (handoff, reunião marcada): a mensagem final dele ainda sai. */
  pausaDoProprioRun?: boolean;
  /** Pessoa que aprovou o texto (caso "sob aprovação"): fica em `dados` da mensagem. */
  aprovadoPorId?: string | null;
};

async function sendMessages(input: Pick<ExecuteAgentInput, "organizacaoId" | "contatoId" | "leadId" | "mode" | "suppressEgress" | "eventType">, runId: string, messages: string[], opcoes: OpcoesEnvio = {}): Promise<string[]> {
  if (input.mode !== "live" || input.suppressEgress || !input.contatoId || !messages.length) return [];
  const [contact] = await db.select().from(contatos).where(and(eq(contatos.id, input.contatoId), eq(contatos.organizacaoId, input.organizacaoId))).limit(1);
  if (!contact?.telefone || !contact.sessaoId) throw new Error("Contato sem telefone/sessão para egress");
  // Política de canal aplicada pelo backend: opt-out, número desconectado, janela, IA pausada. O modelo não decide isto.
  const politica = await avaliarEnvio({ organizacaoId: input.organizacaoId, contatoId: contact.id, proativo: input.eventType !== "conversation.message_received", pausaDoProprioRun: opcoes.pausaDoProprioRun });
  if (!politica.permitido) throw new Error(`Envio bloqueado pela política de canal: ${politica.motivo}`);
  const sentIds: string[] = [];
  for (let sequence = 0; sequence < messages.length; sequence++) {
    const body = messages[sequence]!;
    const bodyHash = createHash("sha256").update(body).digest("hex");
    const [ledger] = await db.insert(aiSendLedger).values({ organizacaoId: input.organizacaoId, runId, sequence, bodyHash, channel: "whatsapp" }).onConflictDoNothing().returning();
    if (!ledger) continue;
    const dados = { aiGenerated: true, aiRunId: runId, aiSequence: sequence, ...(opcoes.aprovadoPorId ? { aprovadoPorId: opcoes.aprovadoPorId } : {}) };
    const [row] = await db.insert(whatsappMensagens).values({ contatoId: contact.id, leadId: input.leadId ?? contact.leadId ?? null, sessaoId: contact.sessaoId, telefone: contact.telefone, direcao: "out", tipo: "text", conteudo: body, status: "pending", dados }).returning({ id: whatsappMensagens.id });
    await whatsappOutgoingQueue.add("send", { messageId: row.id, phone: contact.telefone, conteudo: body, tipo: "text", sessaoId: contact.sessaoId }, { jobId: `ai:${runId}:${sequence}` });
    await db.update(aiSendLedger).set({ status: "queued", externalMessageId: row.id, attempts: 1 }).where(eq(aiSendLedger.id, ledger.id));
    sentIds.push(row.id);
  }
  const last = messages.at(-1);
  if (last) await db.update(contatos).set({ ultimaMsg: last.slice(0, 100), ultimaMsgAt: new Date(), updatedAt: new Date() }).where(eq(contatos.id, contact.id));

  /* Falou com o lead, então ele não está mais em "Novo". O quadro de Pré-vendas
     contava outra história: a agente trocava dezenas de mensagens e o cartão
     ficava parado em Novo, como se ninguém tivesse encostado nele. Só o primeiro
     passo da esteira mora aqui — "Qualificação" e "Qualificado" dependem do que
     foi descoberto e saem de `lead_qualify`; "Oportunidade" exige oportunidade
     real e sai da reunião marcada. Best-effort: etapa não derruba envio. */
  const leadDaConversa = input.leadId ?? contact.leadId ?? null;
  if (sentIds.length && leadDaConversa) {
    try {
      const [l] = await db.execute<{ etapa: string | null }>(sql`SELECT estagio_pre_vendas AS etapa FROM leads WHERE id = ${leadDaConversa}::uuid AND organizacao_id = ${input.organizacaoId}::uuid`);
      if (l?.etapa === "novo") {
        const { moverEtapa } = await import("@/lib/vendas/pre-vendas");
        await moverEtapa({ organizacaoId: input.organizacaoId, leadId: leadDaConversa, para: "em_contato", ator: { tipo: "AI_AGENT", usuarioId: null, ref: runId } });
      }
    } catch (e) {
      console.error(`[agentes] não moveu o lead ${leadDaConversa} para "em contato":`, e instanceof Error ? e.message : e);
    }
  }
  return sentIds;
}

/**
 * Resposta do agente que estava "sob aprovação": a pessoa aprovou, o texto sai pelo MESMO caminho
 * do agente (política de canal, ai_send_ledger do run, whatsapp_mensagens, fila). Idempotente pelo
 * ledger: aprovar duas vezes não manda duas vezes.
 */
export async function enviarMensagensAprovadas(p: { organizacaoId: string; runId: string; contatoId: string; leadId?: string | null; mensagens: string[]; aprovadorId: string }): Promise<string[]> {
  const [run] = await db.select({ input: aiAgentRuns.input }).from(aiAgentRuns).where(and(eq(aiAgentRuns.id, p.runId), eq(aiAgentRuns.organizacaoId, p.organizacaoId))).limit(1);
  if (!run) throw new Error("Execução do agente não encontrada nesta organização");
  const eventType = typeof (run.input as Record<string, unknown> | null)?.eventType === "string" ? String((run.input as Record<string, unknown>).eventType) : "conversation.message_received";
  const ids = await sendMessages({ organizacaoId: p.organizacaoId, contatoId: p.contatoId, leadId: p.leadId ?? null, mode: "live", eventType }, p.runId, p.mensagens.map(sanitizeResponse).filter(Boolean).slice(0, 8), { aprovadoPorId: p.aprovadorId });
  return ids;
}

/**
 * Contexto para executar a ação de um caso aprovado. O teto de permissão é o que o run TINHA (gravado no
 * trace, ou recalculado da versão com o usuário da agente) INTERSEÇÃO o que a pessoa que aprova pode.
 * Aprovar nunca dá ao agente mais do que ele tinha, nem mais do que quem aprova poderia fazer. Antes a
 * aprovação ia sem teto nenhum e toda ferramenta mapeada a permissão (ex.: sales.manage) era negada.
 */
export async function contextoDeAprovacao(p: { organizacaoId: string; runId: string; aprovadorId: string; aprovadorPapel?: string | null }): Promise<{
  permissoesDelegadas: Set<string>; agenteUsuarioId: string | null; guardrails: Record<string, unknown>; handoffConfig: Record<string, unknown>;
} | null> {
  const [run] = await db.select({ agentId: aiAgentRuns.agentId, versionId: aiAgentRuns.versionId, trace: aiAgentRuns.trace }).from(aiAgentRuns)
    .where(and(eq(aiAgentRuns.id, p.runId), eq(aiAgentRuns.organizacaoId, p.organizacaoId))).limit(1);
  if (!run) return null;
  const agenteUsuarioId = await usuarioDoAgente(run.agentId);
  const gravado = Array.isArray(run.trace) ? (run.trace as Array<Record<string, unknown>>).find((t) => t?.type === "permissoes") : undefined;
  let doRun: string[];
  if (gravado && Array.isArray(gravado.concedidas)) doRun = gravado.concedidas.filter((x): x is string => typeof x === "string");
  else {
    const { delegacaoDoRun } = await import("../permissao-delegada");
    doRun = [...(await delegacaoDoRun({ organizacaoId: p.organizacaoId, agentVersionId: run.versionId, usuarioId: agenteUsuarioId })).permissoes];
  }
  const { permissoesEfetivas } = await import("@/lib/auth/permissoes");
  const doAprovador = await permissoesEfetivas({ usuarioId: p.aprovadorId, organizacaoId: p.organizacaoId, role: p.aprovadorPapel ?? null, tipo: "HUMAN" });
  const [versao] = run.versionId
    ? await db.select({ guardrails: aiAgentVersions.guardrailConfig, handoff: aiAgentVersions.handoffConfig }).from(aiAgentVersions).where(and(eq(aiAgentVersions.id, run.versionId), eq(aiAgentVersions.organizacaoId, p.organizacaoId))).limit(1)
    : [];
  const obj = (v: unknown) => (v && typeof v === "object" ? v as Record<string, unknown> : {});
  return { permissoesDelegadas: new Set(doRun.filter((c) => doAprovador.has(c as never))), agenteUsuarioId, guardrails: obj(versao?.guardrails), handoffConfig: obj(versao?.handoff) };
}

export async function executeAgent(input: ExecuteAgentInput): Promise<ExecuteAgentResult> {
  const selected = await selectAgent(input);
  const provider = selected.version.provider as AiProvider | null;
  if (!provider || !["groq", "openai", "anthropic", "google", "claude_subscription"].includes(provider)) throw new Error(`Provider não suportado: ${provider ?? "vazio"}`);
  if (!selected.version.modelo) throw new Error("Modelo não configurado");
  const correlationId = randomUUID();
  const [run] = await db.insert(aiAgentRuns).values({
    organizacaoId: input.organizacaoId, agentId: selected.agent.id, versionId: selected.version.id, contatoId: input.contatoId ?? null, leadId: input.leadId ?? null,
    sourceMessageId: input.sourceMessageId ?? null, channelSessionId: selected.version.channelSessionId ?? null, correlationId,
    modo: input.mode, status: "running", input,
  }).returning();

  let sequence = 0;
  let tokensInput = 0;
  let tokensOutput = 0;
  let cost = 0;
  let handoff = false;
  // Pausa causada por este run (handoff pedido, reunião marcada): não barra a mensagem final dele.
  let pausouNesteRun = false;
  let handoffMotivo: string | null = null;
  const trace: Array<Record<string, unknown>> = [{ type: "selected", agentId: selected.agent.id, versionId: selected.version.id, provider, model: selected.version.modelo }];
  try {
    const guardrails = selected.version.guardrailConfig && typeof selected.version.guardrailConfig === "object" ? selected.version.guardrailConfig as Record<string, unknown> : {};
    // A tela persiste `autonomia`; `autonomy` é aceito para versões já
    // gravadas por integrações em inglês. Sem essa normalização o agente
    // sempre caía silenciosamente em suggest.
    const configuredAutonomy = guardrails.autonomia ?? guardrails.autonomy;
    const autonomy = input.somenteAnalise ? "suggest" : input.autonomia ?? input.atribuicaoAutonomia ?? ((["suggest", "approval", "autonomous"] as const).includes(configuredAutonomy as "suggest") ? configuredAutonomy as "suggest" | "approval" | "autonomous" : "suggest");
    // Autonomia por classe de ação (leitura, mensagens, CRM, agenda, comercial). Execução com
    // autonomia imposta pelo chamador (chat do NEXO) ou pela atribuição ignora o ajuste fino.
    const porClasse: ReturnType<typeof lerAutonomiaPorAcao> = input.somenteAnalise
      ? { mensagens: "suggest", crm: "suggest", agenda: "suggest", comercial: "suggest" }
      : input.autonomia || input.atribuicaoAutonomia ? {} : lerAutonomiaPorAcao(guardrails);
    const autonomiaMensagens = autonomiaDaFerramenta("message.prepare", autonomy, porClasse);
    trace.push({ type: "autonomy", mode: autonomy, porClasse, mensagens: autonomiaMensagens });

    // Teto de permissão DESTA execução. Sem configuração na versão, o agente
    // fica sem escrita: agente que nasce podendo tudo é porta que ninguém
    // abriu de propósito.
    const { delegacaoDoRun, permissoesDoNexo } = await import("../permissao-delegada");
    // A agente é um usuário do sistema: quando ninguém a acionou, o teto também é o papel dela (interseção com a versão).
    const agenteUsuarioId = await usuarioDoAgente(selected.agent.id);
    let delegacao = await delegacaoDoRun({
      organizacaoId: input.organizacaoId,
      agentVersionId: selected.version.id,
      usuarioId: input.usuarioId ?? (input.delegarComoUsuario ? null : agenteUsuarioId),
    });
    if (input.delegarComoUsuario && input.usuarioId) {
      delegacao = { permissoes: await permissoesDoNexo({
        organizacaoId: input.organizacaoId, agentVersionId: selected.version.id,
        usuarioId: input.usuarioId, usuarioPapel: input.usuarioPapel ?? null,
      }), origem: "versao+usuario" };
    }
    // O trace guarda o teto, não o pedido: quando o agente disser "não pude",
    // o registro precisa mostrar o que ele podia.
    trace.push({
      type: "permissoes",
      origem: delegacao.origem,
      concedidas: [...delegacao.permissoes].sort(),
    });
    await assertBudget(run.id, input, selected.agent.id);
    const toolIds = Array.isArray(selected.version.tools) ? selected.version.tools.filter((value): value is string => typeof value === "string") : [];
    const tools = modelToolsForIds([...new Set([...(input.somenteFerramentasExtras ? [] : toolIds), ...(input.extraToolIds ?? [])])]);
    const allowedNames = new Set(tools.map((tool) => tool.name));
    const toolCtx = {
      organizacaoId: input.organizacaoId, agentId: selected.agent.id, runId: run.id, contatoId: input.contatoId, leadId: input.leadId,
      usuarioId: input.usuarioId, agenteUsuarioId, confirmado: input.confirmado, mode: input.mode, autonomy, permissoesDelegadas: delegacao.permissoes,
      autonomiaPorClasse: porClasse, sourceMessageId: input.sourceMessageId ?? null, atribuicaoId: input.atribuicaoId ?? null, guardrails, analise: Boolean(input.somenteAnalise),
      handoffConfig: (selected.version.handoffConfig && typeof selected.version.handoffConfig === "object" ? selected.version.handoffConfig : {}) as Record<string, unknown>,
    };
    /* Áudio vira texto aqui, no caminho por onde TODA execução passa. Antes isso
       vivia só dentro de `acionarAgente`: quem chegava pelos outros caminhos
       (agente responsável sem atribuição viva, Callpilot nativo, SDR legado)
       recebia a string crua "[Audio recebido]" e respondia no escuro. */
    const mensagemDoContato = await textoDoQueChegou({
      contatoId: input.contatoId, sourceMessageId: input.sourceMessageId, mensagem: input.message, mode: input.mode,
    }).catch(() => input.message);

    const messages: AgentMessage[] = [
      // Instruções + escopo + expressões de handoff + regras fixas: a mesma
      // função que a tela usa em "Ver prompt compilado" (lib/ai/agente-escopo).
      { role: "system", content: compilarPrompt(selected.version) },
      { role: "user", content: mensagemDoContato || `Evento ${input.eventType}: ${JSON.stringify(input.payload ?? {})}` },
    ];
    // Context Builder: o agente recebe o relacionamento inteiro, selecionado e rastreável, antes de pensar.
    let contexto: ContextoMontado | null = null;
    if (!input.delegarComoUsuario && !input.somenteFerramentasExtras && (input.contatoId || input.leadId)) {
      const t0 = Date.now();
      contexto = await construirContexto({
        organizacaoId: input.organizacaoId, agentId: selected.agent.id, contatoId: input.contatoId, leadId: input.leadId, mensagemAtual: mensagemDoContato,
        evento: input.eventType, janelaMensagens: selected.version.historyMessageWindow,
        politica: {
          memoria: (guardrails.memoria as { ativa?: boolean } | undefined)?.ativa !== false,
          conhecimento: { ativo: (selected.version.knowledgeConfig as { ativo?: boolean } | null)?.ativo !== false, categorias: ((selected.version.knowledgeConfig as { categorias?: unknown } | null)?.categorias as string[] | undefined) ?? undefined, max: (selected.version.knowledgeConfig as { maxTrechos?: number } | null)?.maxTrechos },
        },
        motivoDaExecucao: [input.objetivo ? `Objetivo da atuação: ${input.objetivo}` : null, input.motivoDaExecucao].filter(Boolean).join("\n") || null,
      });
      messages[0] = { role: "system", content: `${messages[0]!.content}\n\n${contexto.texto}` };
      await persistStep({
        organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "context", name: "context_builder", status: "completed",
        input: { eventType: input.eventType }, output: { secoes: contexto.secoes, fontes: contexto.fontes, sinais: contexto.sinais, tokensAprox: contexto.tokensAprox }, latencyMs: Date.now() - t0,
      });
      trace.push({ type: "context", secoes: contexto.secoes.map((x) => x.id), fontes: contexto.fontes.length, tokensAprox: contexto.tokensAprox });
    }
    const prepared: string[] = [];
    let finalText: string | null = null;
    let transicao: string | null = null;
    const maxSteps = Math.min(25, Math.max(1, selected.version.maxSteps));

    /* Sinais que alimentam a política de handoff da versão (`onToolFailure`,
       `onLowConfidence`). Contados aqui, no ponto por onde o resultado de TODA
       ferramenta passa, para valer igual nos dois providers. */
    /* Teto de gasto POR EXECUÇÃO ("Orçamento por execução (US$) — Aborta a execução
       ao passar"). A tela oferecia o campo, a API validava, a publicação mostrava no
       diff de versões — e NADA lia o valor: só o teto da organização, por dia e por
       mês, existia de verdade. Quem preenchesse para conter uma execução cara não
       mudava uma linha do comportamento. O texto "Orçamento" no erro é o que o catch
       abaixo usa para gravar o run como `aborted`, e não como falha. */
    const tetoDaExecucao = Number(selected.version.costBudget ?? "");
    const conferirTetoDaExecucao = () => {
      if (!Number.isFinite(tetoDaExecucao) || tetoDaExecucao <= 0) return;
      if (cost > tetoDaExecucao) throw new Error(`Orçamento da execução estourado: US$ ${cost.toFixed(4)} passou do teto de US$ ${tetoDaExecucao.toFixed(4)} desta versão`);
    };

    /* Ferramenta que só foi SIMULADA não pode ficar gravada como "concluída".
       Em modo de teste, em copiloto e em "sob aprovação", `preview()` devolve
       `ok: true` sem escrever nada — e o passo ia para o banco como `completed`,
       igualzinho a uma ação de verdade. Medido em produção (21/10/2026): o
       agente copiloto-cs tem 178 passos "concluídos" que não escreveram UMA
       linha (`activity_note` 87 simulados e 0 reais, `task_create` 89 e 0), e
       `atividades tipo='nota_agente'` está em zero no banco inteiro. Uma
       operação parada parecendo saudável no log. */
    const statusDoPasso = (r: AgentToolResult): string =>
      !r.ok ? "failed" : (r.data as { preview?: unknown } | undefined)?.preview === true ? "preview" : "completed";

    const sinais: SinaisDaExecucao = { falhasDeFerramenta: 0, confianca: null };
    const registrarSinal = (nome: string, resultado: AgentToolResult) => {
      if (!resultado.ok) { sinais.falhasDeFerramenta++; return; }
      if (nome !== "response_classify") return;
      const c = (resultado.data as { confidence?: unknown } | undefined)?.confidence;
      if (typeof c === "number" && Number.isFinite(c)) sinais.confianca = sinais.confianca === null ? c : Math.min(sinais.confianca, c);
    };

    if (provider === "claude_subscription") {
      const started = Date.now();
      const subscription = await new ClaudeSubscriptionAdapter().runAgent({
        model: selected.version.modelo,
        systemPrompt: messages[0]!.content,
        userPrompt: messages[1]!.content,
        tools,
        maxTurns: maxSteps,
        // "Tokens por execução" da tela não valia nada neste provider: o campo era
        // aplicado só no caminho de API key. O SDK não aceita teto de saída nas
        // options, mas o CLI que ele sobe respeita CLAUDE_CODE_MAX_OUTPUT_TOKENS,
        // e o adapter passa por ali.
        maxOutputTokens: selected.version.tokenBudget,
        invokeTool: (name, toolInput) => executeRegisteredTool(name, {
          ...toolCtx,
        }, toolInput),
      });
      tokensInput += subscription.tokensInput;
      tokensOutput += subscription.tokensOutput;
      finalText = subscription.text;
      // O SDK já devolve o custo da chamada. Antes ele só ia para o JSON do
      // passo e o número gravado era zero fixo — por isso o painel mostrava
      // "R$ 0,00" com centenas de execuções. Quando não vier, a tabela de
      // preços da Anthropic cobre o mesmo modelo.
      const stepCost = custoEstimadoDoSdk(subscription.estimatedCostUsd)
        ?? await calculateCost("anthropic", selected.version.modelo, subscription.tokensInput, subscription.tokensOutput);
      cost += stepCost;
      conferirTetoDaExecucao();
      await persistStep({
        organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "model_call", name: selected.version.modelo,
        status: "completed", input: { provider: "claude_subscription", messageCount: messages.length },
        output: { text: subscription.text, toolCalls: subscription.toolCalls.map((call) => call.name), estimatedCostUsd: subscription.estimatedCostUsd },
        tokensInput: subscription.tokensInput, tokensOutput: subscription.tokensOutput, cost: stepCost, latencyMs: Date.now() - started,
      });
      trace.push({ type: "model_call", provider: "claude_subscription", toolCalls: subscription.toolCalls.map((call) => call.name), hasText: Boolean(subscription.text) });

      for (const call of subscription.toolCalls) {
        await persistStep({
          organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "tool_call", name: call.name,
          status: statusDoPasso(call.result as AgentToolResult), input: call.input, output: call.result,
          errorCode: call.result.ok ? undefined : "tool_failed", errorMessage: call.result.error,
        });
        const previewData = call.result.data && typeof call.result.data === "object" ? call.result.data as Record<string, unknown> : null;
        if (input.mode === "live" && previewData?.approvalRequired) {
          await db.insert(aiAlerts).values({ organizacaoId: input.organizacaoId, kind: "approval_required", severity: "warning", title: `Aprovação necessária: ${call.name}`, body: JSON.stringify(call.input).slice(0, 2000), refKind: "run", refId: run.id });
          if (input.contatoId) await db.insert(aiCases).values({ organizacaoId: input.organizacaoId, contatoId: input.contatoId, leadId: input.leadId ?? null, agentId: selected.agent.id, runId: run.id, title: `Aprovar ação: ${call.name}`, summary: "O agente preparou uma ação e aguarda decisão humana.", blocker: "A versão está configurada no modo pedir aprovação.", source: "tool_approval", contextSnapshot: { kind: "tool_approval", toolName: call.name, toolInput: call.input } });
          handoff = true;
        }
        if (call.name === "message_prepare" && call.result.ok && call.result.data && typeof call.result.data === "object") {
          const list = (call.result.data as { messages?: unknown }).messages;
          if (Array.isArray(list)) prepared.push(...list.filter((value): value is string => typeof value === "string"));
        }
        handoff ||= Boolean(call.result.handoff);
        registrarSinal(call.name, call.result as AgentToolResult);
        if (call.name === "handoff_request" && call.result.ok) { const t = (call.result.data as { mensagemTransicao?: unknown } | undefined)?.mensagemTransicao; if (typeof t === "string") transicao = t; }
        if (call.result.ok && (call.name === "handoff_request" || (call.result as AgentToolResult).encerraAtuacao)) { pausouNesteRun = true; handoffMotivo ??= motivoDoHandoff(call.name, call.input, call.result); }
        trace.push({ type: "tool_call", name: call.name, ok: call.result.ok, handoff: Boolean(call.result.handoff) });
      }
    } else for (let iteration = 0; iteration < maxSteps; iteration++) {
      const { apiKey, baseUrl } = await resolveApiKey(selected.version);
      const started = Date.now();
      const model = await runModelCall({ provider, model: selected.version.modelo, apiKey, baseUrl, messages, tools, maxTokens: Math.min(selected.version.tokenBudget, 8192), temperature: 0.3 });
      tokensInput += model.tokensInput; tokensOutput += model.tokensOutput;
      const stepCost = await calculateCost(provider, selected.version.modelo, model.tokensInput, model.tokensOutput); cost += stepCost; conferirTetoDaExecucao();
      await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "model_call", name: selected.version.modelo, status: "completed", input: { iteration, messageCount: messages.length }, output: { text: model.text, toolCalls: model.toolCalls }, tokensInput: model.tokensInput, tokensOutput: model.tokensOutput, cost: stepCost, latencyMs: Date.now() - started });
      trace.push({ type: "model_call", iteration, toolCalls: model.toolCalls.map((call) => call.name), hasText: Boolean(model.text) });

      if (!model.toolCalls.length) { finalText = model.text; break; }
      messages.push({ role: "assistant", content: model.text ?? "", toolCalls: model.toolCalls });
      for (const call of model.toolCalls) {
        let result: Awaited<ReturnType<typeof executeRegisteredTool>>;
        if (!allowedNames.has(call.name)) result = { ok: false, error: `tool fora da allowlist: ${call.name}` };
        else {
          const startedTool = Date.now();
          try { result = await executeRegisteredTool(call.name, toolCtx, call.input); }
          catch (error) { result = { ok: false, error: error instanceof Error ? error.message : String(error) }; }
          await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "tool_call", name: call.name, status: statusDoPasso(result), input: call.input, output: result, latencyMs: Date.now() - startedTool, errorCode: result.ok ? undefined : "tool_failed", errorMessage: result.error });
        }
        const previewData = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : null;
        if (input.mode === "live" && previewData?.approvalRequired) {
          await db.insert(aiAlerts).values({ organizacaoId: input.organizacaoId, kind: "approval_required", severity: "warning", title: `Aprovação necessária: ${call.name}`, body: JSON.stringify(call.input).slice(0, 2000), refKind: "run", refId: run.id });
          if (input.contatoId) await db.insert(aiCases).values({ organizacaoId: input.organizacaoId, contatoId: input.contatoId, leadId: input.leadId ?? null, agentId: selected.agent.id, runId: run.id, title: `Aprovar ação: ${call.name}`, summary: "O agente preparou uma ação e aguarda decisão humana.", blocker: "A versão está configurada no modo pedir aprovação.", source: "tool_approval", contextSnapshot: { kind: "tool_approval", toolName: call.name, toolInput: call.input } });
          handoff = true;
        }
        if (call.name === "message_prepare" && result.ok && result.data && typeof result.data === "object") {
          const list = (result.data as { messages?: unknown }).messages;
          if (Array.isArray(list)) prepared.push(...list.filter((value): value is string => typeof value === "string"));
        }
        handoff ||= Boolean(result.handoff);
        registrarSinal(call.name, result);
        if (call.name === "handoff_request" && result.ok) { const t = (result.data as { mensagemTransicao?: unknown } | undefined)?.mensagemTransicao; if (typeof t === "string") transicao = t; }
        if (result.ok && (call.name === "handoff_request" || result.encerraAtuacao)) { pausouNesteRun = true; handoffMotivo ??= motivoDoHandoff(call.name, call.input, result); }
        messages.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: JSON.stringify(result) });
        trace.push({ type: "tool_call", name: call.name, ok: result.ok, handoff: Boolean(result.handoff) });
      }
      if (prepared.length || handoff) break;
    }

    /* Política de handoff da versão: ferramenta que falhou de forma repetida ou
       resposta de baixa confiança passam o atendimento para uma pessoa mesmo que
       o modelo não tenha pedido. Quem executa é a MESMA ferramenta que o modelo
       usaria — uma porta só para handoff. Ver politica-handoff.ts. */
    if (!handoff && input.mode === "live" && input.contatoId) {
      const motivoAutomatico = motivoDeHandoffAutomatico(selected.version.handoffConfig as ConfigDeHandoff | null, sinais);
      if (motivoAutomatico) {
        const r = await executeRegisteredTool("handoff_request", toolCtx, {
          motivo: motivoAutomatico,
          resumo: `Transferência automática pela política da versão. Sinais desta execução: ${sinais.falhasDeFerramenta} falha(s) de ferramenta, confiança ${sinais.confianca === null ? "não declarada" : sinais.confianca.toFixed(2)}.`,
          proximo_passo: "Retomar a conversa e concluir o que o agente não conseguiu.",
        });
        await persistStep({
          organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "tool_call", name: "handoff_request",
          status: statusDoPasso(r), input: { motivo: motivoAutomatico, origem: "politica_da_versao" }, output: r,
          errorCode: r.ok ? undefined : "tool_failed", errorMessage: r.error,
        });
        trace.push({ type: "tool_call", name: "handoff_request", ok: r.ok, handoff: true, origem: "politica_da_versao" });
        if (r.ok) {
          handoff = true;
          pausouNesteRun = true;
          handoffMotivo ??= sinais.falhasDeFerramenta >= FALHAS_PARA_HANDOFF ? "ferramenta_falhou" : "baixa_confianca";
          const t = (r.data as { mensagemTransicao?: unknown } | undefined)?.mensagemTransicao;
          if (typeof t === "string") transicao ??= t;
        }
      }
    }

    let outgoing = responseMessages(finalText, prepared);
    // Handoff: se o agente não escreveu nada, o contato recebe a mensagem de transição configurada (não fica no vácuo).
    if (handoff && !outgoing.length && transicao) outgoing = [sanitizeResponse(transicao)];
    await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "guardrail", name: "before_send", status: "completed", input: { count: outgoing.length }, output: { sanitized: true } });
    // Mensagem ao contato segue a autonomia da classe "mensagens": copiloto só sugere, "sob aprovação" abre caso para uma pessoa aprovar.
    if (input.mode === "live" && !input.suppressEgress && autonomiaMensagens === "approval" && outgoing.length && input.contatoId) {
      await db.insert(aiAlerts).values({ organizacaoId: input.organizacaoId, kind: "approval_required", severity: "warning", title: "Aprovação necessária: resposta ao contato", body: outgoing.join("\n---\n").slice(0, 2000), refKind: "run", refId: run.id });
      await db.insert(aiCases).values({ organizacaoId: input.organizacaoId, contatoId: input.contatoId, leadId: input.leadId ?? null, agentId: selected.agent.id, runId: run.id, title: "Aprovar resposta do agente", summary: "O agente preparou uma resposta e aguarda decisão humana.", blocker: "Mensagens estão em modo sob aprovação.", source: "tool_approval", contextSnapshot: { kind: "mensagem", mensagens: outgoing } });
      handoff = true;
    }
    const sentMessageIds = await sendMessages({ ...input, suppressEgress: input.suppressEgress || autonomiaMensagens !== "autonomous" }, run.id, outgoing, { pausaDoProprioRun: pausouNesteRun });
    if (sentMessageIds.length) await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "egress", name: "whatsapp", status: "completed", output: { messageIds: sentMessageIds } });
    const status = handoff ? "handed_off" : "completed";
    if (handoff && !handoffMotivo) {
      const [aprov] = await db.select({ id: aiCases.id }).from(aiCases).where(and(eq(aiCases.runId, run.id), eq(aiCases.source, "tool_approval"))).limit(1);
      handoffMotivo = aprov ? "aguardando_aprovacao" : null;
    }
    await db.update(aiAgentRuns).set({ status, handoffMotivo, trace, tokens: tokensInput + tokensOutput, tokensInput, tokensOutput, custo: String(cost), stepsCount: sequence, completedAt: new Date() }).where(eq(aiAgentRuns.id, run.id));
    return { runId: run.id, agentId: selected.agent.id, versionId: selected.version.id, status, responseText: outgoing.join("\n---SPLIT---\n") || null, sentMessageIds, tokensInput, tokensOutput, cost, handoff, contexto: contexto ? { secoes: contexto.secoes, fontes: contexto.fontes, sinais: contexto.sinais, tokensAprox: contexto.tokensAprox } : null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("Orçamento") ? "aborted" : "failed";
    await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "runtime", name: "failure", status: "failed", errorCode: status === "aborted" ? "budget_exceeded" : "runtime_failed", errorMessage: message });
    await db.update(aiAgentRuns).set({ status, trace: [...trace, { type: "error", message }], tokens: tokensInput + tokensOutput, tokensInput, tokensOutput, custo: String(cost), stepsCount: sequence, erro: message, errorCode: status === "aborted" ? "budget_exceeded" : "runtime_failed", completedAt: new Date() }).where(eq(aiAgentRuns.id, run.id));
    throw error;
  }
}
