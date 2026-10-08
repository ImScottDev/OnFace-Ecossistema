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
import { executeRegisteredTool, modelToolsForIds } from "../tools/registry";
import { runModelCall, type AgentMessage, type AiProvider } from "./provider-gateway";
import { ClaudeSubscriptionAdapter } from "./claude-subscription-adapter";
import { usuarioDoAgente } from "@/lib/agentes/usuario-do-agente";
import { versaoAtendeSessao } from "@/lib/atendimento/ia-conversa";

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
  if (input.mode === "live" && !input.agentId && input.contatoId) {
    const [ct] = await db.select({ sessaoId: contatos.sessaoId }).from(contatos).where(eq(contatos.id, input.contatoId)).limit(1);
    sessaoDoContato = ct?.sessaoId ?? null;
  }

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

function sanitizeResponse(raw: string): string {
  return raw
    .replace(/<function=[^>]+>[\s\S]*?<\/function>/gi, "")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|gsk_[A-Za-z0-9_-]{12,})\b/g, "[credencial removida]")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 12_000);
}

function responseMessages(text: string | null, prepared: string[]): string[] {
  if (prepared.length) return prepared.map(sanitizeResponse).filter(Boolean).slice(0, 8);
  if (!text) return [];
  return text.split("\n---SPLIT---\n").map(sanitizeResponse).filter(Boolean).slice(0, 8);
}

async function calculateCost(provider: string, model: string, tokensInput: number, tokensOutput: number): Promise<number> {
  const [pricing] = await db.select().from(aiModels).where(and(eq(aiModels.provider, provider), eq(aiModels.modelId, model))).limit(1);
  if (!pricing) return 0;
  return (tokensInput / 1_000_000) * Number(pricing.inputPricePerMillion ?? 0) + (tokensOutput / 1_000_000) * Number(pricing.outputPricePerMillion ?? 0);
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

async function sendMessages(input: ExecuteAgentInput, runId: string, messages: string[]): Promise<string[]> {
  if (input.mode !== "live" || input.suppressEgress || !input.contatoId || !messages.length) return [];
  const [contact] = await db.select().from(contatos).where(and(eq(contatos.id, input.contatoId), eq(contatos.organizacaoId, input.organizacaoId))).limit(1);
  if (!contact?.telefone || !contact.sessaoId) throw new Error("Contato sem telefone/sessão para egress");
  const sentIds: string[] = [];
  for (let sequence = 0; sequence < messages.length; sequence++) {
    const body = messages[sequence]!;
    const bodyHash = createHash("sha256").update(body).digest("hex");
    const [ledger] = await db.insert(aiSendLedger).values({ organizacaoId: input.organizacaoId, runId, sequence, bodyHash, channel: "whatsapp" }).onConflictDoNothing().returning();
    if (!ledger) continue;
    const [row] = await db.insert(whatsappMensagens).values({ contatoId: contact.id, leadId: input.leadId ?? contact.leadId ?? null, sessaoId: contact.sessaoId, telefone: contact.telefone, direcao: "out", tipo: "text", conteudo: body, status: "pending", dados: { aiGenerated: true, aiRunId: runId } }).returning({ id: whatsappMensagens.id });
    await whatsappOutgoingQueue.add("send", { messageId: row.id, phone: contact.telefone, conteudo: body, tipo: "text", sessaoId: contact.sessaoId }, { jobId: `ai:${runId}:${sequence}` });
    await db.update(aiSendLedger).set({ status: "queued", externalMessageId: row.id, attempts: 1 }).where(eq(aiSendLedger.id, ledger.id));
    sentIds.push(row.id);
  }
  const last = messages.at(-1);
  if (last) await db.update(contatos).set({ ultimaMsg: last.slice(0, 100), ultimaMsgAt: new Date(), updatedAt: new Date() }).where(eq(contatos.id, contact.id));
  return sentIds;
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
  const trace: Array<Record<string, unknown>> = [{ type: "selected", agentId: selected.agent.id, versionId: selected.version.id, provider, model: selected.version.modelo }];
  try {
    const guardrails = selected.version.guardrailConfig && typeof selected.version.guardrailConfig === "object" ? selected.version.guardrailConfig as Record<string, unknown> : {};
    // A tela persiste `autonomia`; `autonomy` é aceito para versões já
    // gravadas por integrações em inglês. Sem essa normalização o agente
    // sempre caía silenciosamente em suggest.
    const configuredAutonomy = guardrails.autonomia ?? guardrails.autonomy;
    const autonomy = input.autonomia ?? ((["suggest", "approval", "autonomous"] as const).includes(configuredAutonomy as "suggest") ? configuredAutonomy as "suggest" | "approval" | "autonomous" : "suggest");
    trace.push({ type: "autonomy", mode: autonomy });

    // Teto de permissão DESTA execução. Sem configuração na versão, o agente
    // fica sem escrita: agente que nasce podendo tudo é porta que ninguém
    // abriu de propósito.
    const { delegacaoDoRun } = await import("../permissao-delegada");
    let delegacao = await delegacaoDoRun({
      organizacaoId: input.organizacaoId,
      agentVersionId: selected.version.id,
      usuarioId: input.usuarioId ?? null,
    });
    if (input.delegarComoUsuario && input.usuarioId) {
      const { permissoesEfetivas } = await import("@/lib/auth/permissoes");
      const doUsuario = await permissoesEfetivas({ usuarioId: input.usuarioId, organizacaoId: input.organizacaoId, role: input.usuarioPapel ?? null });
      const teto = delegacao.origem === "nenhuma" ? doUsuario : new Set([...doUsuario].filter((c) => delegacao.permissoes.has(c)));
      delegacao = { permissoes: teto, origem: "versao+usuario" };
    }
    // O trace guarda o teto, não o pedido: quando o agente disser "não pude",
    // o registro precisa mostrar o que ele podia.
    trace.push({
      type: "permissoes",
      origem: delegacao.origem,
      concedidas: [...delegacao.permissoes].sort(),
    });
    await assertBudget(run.id, input, selected.agent.id);
    // A agente é um usuário do sistema: o que ela faz nas ferramentas sai assinado por ele na timeline.
    const agenteUsuarioId = await usuarioDoAgente(selected.agent.id);
    const toolIds = Array.isArray(selected.version.tools) ? selected.version.tools.filter((value): value is string => typeof value === "string") : [];
    const tools = modelToolsForIds([...new Set([...(input.somenteFerramentasExtras ? [] : toolIds), ...(input.extraToolIds ?? [])])]);
    const allowedNames = new Set(tools.map((tool) => tool.name));
    const messages: AgentMessage[] = [
      // Instruções + escopo + expressões de handoff + regras fixas: a mesma
      // função que a tela usa em "Ver prompt compilado" (lib/ai/agente-escopo).
      { role: "system", content: compilarPrompt(selected.version) },
      { role: "user", content: input.message || `Evento ${input.eventType}: ${JSON.stringify(input.payload ?? {})}` },
    ];
    const prepared: string[] = [];
    let finalText: string | null = null;
    const maxSteps = Math.min(25, Math.max(1, selected.version.maxSteps));

    if (provider === "claude_subscription") {
      const started = Date.now();
      const subscription = await new ClaudeSubscriptionAdapter().runAgent({
        model: selected.version.modelo,
        systemPrompt: messages[0]!.content,
        userPrompt: messages[1]!.content,
        tools,
        maxTurns: maxSteps,
        invokeTool: (name, toolInput) => executeRegisteredTool(name, {
          organizacaoId: input.organizacaoId,
          agentId: selected.agent.id,
          runId: run.id,
          contatoId: input.contatoId,
          leadId: input.leadId,
          usuarioId: input.usuarioId,
          agenteUsuarioId,
          confirmado: input.confirmado,
          mode: input.mode,
          autonomy,
          permissoesDelegadas: delegacao.permissoes,
        }, toolInput),
      });
      tokensInput += subscription.tokensInput;
      tokensOutput += subscription.tokensOutput;
      finalText = subscription.text;
      await persistStep({
        organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "model_call", name: selected.version.modelo,
        status: "completed", input: { provider: "claude_subscription", messageCount: messages.length },
        output: { text: subscription.text, toolCalls: subscription.toolCalls.map((call) => call.name), estimatedCostUsd: subscription.estimatedCostUsd },
        tokensInput: subscription.tokensInput, tokensOutput: subscription.tokensOutput, cost: 0, latencyMs: Date.now() - started,
      });
      trace.push({ type: "model_call", provider: "claude_subscription", toolCalls: subscription.toolCalls.map((call) => call.name), hasText: Boolean(subscription.text) });

      for (const call of subscription.toolCalls) {
        await persistStep({
          organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "tool_call", name: call.name,
          status: call.result.ok ? "completed" : "failed", input: call.input, output: call.result,
          errorCode: call.result.ok ? undefined : "tool_failed", errorMessage: call.result.error,
        });
        const previewData = call.result.data && typeof call.result.data === "object" ? call.result.data as Record<string, unknown> : null;
        if (input.mode === "live" && autonomy === "approval" && previewData?.approvalRequired) {
          await db.insert(aiAlerts).values({ organizacaoId: input.organizacaoId, kind: "approval_required", severity: "warning", title: `Aprovação necessária: ${call.name}`, body: JSON.stringify(call.input).slice(0, 2000), refKind: "run", refId: run.id });
          if (input.contatoId) await db.insert(aiCases).values({ organizacaoId: input.organizacaoId, contatoId: input.contatoId, leadId: input.leadId ?? null, agentId: selected.agent.id, runId: run.id, title: `Aprovar ação: ${call.name}`, summary: "O agente preparou uma ação e aguarda decisão humana.", blocker: "A versão está configurada no modo pedir aprovação.", source: "tool_approval", contextSnapshot: { kind: "tool_approval", toolName: call.name, toolInput: call.input } });
          handoff = true;
        }
        if (call.name === "message_prepare" && call.result.ok && call.result.data && typeof call.result.data === "object") {
          const list = (call.result.data as { messages?: unknown }).messages;
          if (Array.isArray(list)) prepared.push(...list.filter((value): value is string => typeof value === "string"));
        }
        handoff ||= Boolean(call.result.handoff);
        trace.push({ type: "tool_call", name: call.name, ok: call.result.ok, handoff: Boolean(call.result.handoff) });
      }
    } else for (let iteration = 0; iteration < maxSteps; iteration++) {
      const { apiKey, baseUrl } = await resolveApiKey(selected.version);
      const started = Date.now();
      const model = await runModelCall({ provider, model: selected.version.modelo, apiKey, baseUrl, messages, tools, maxTokens: Math.min(selected.version.tokenBudget, 8192), temperature: 0.3 });
      tokensInput += model.tokensInput; tokensOutput += model.tokensOutput;
      const stepCost = await calculateCost(provider, selected.version.modelo, model.tokensInput, model.tokensOutput); cost += stepCost;
      await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "model_call", name: selected.version.modelo, status: "completed", input: { iteration, messageCount: messages.length }, output: { text: model.text, toolCalls: model.toolCalls }, tokensInput: model.tokensInput, tokensOutput: model.tokensOutput, cost: stepCost, latencyMs: Date.now() - started });
      trace.push({ type: "model_call", iteration, toolCalls: model.toolCalls.map((call) => call.name), hasText: Boolean(model.text) });

      if (!model.toolCalls.length) { finalText = model.text; break; }
      messages.push({ role: "assistant", content: model.text ?? "", toolCalls: model.toolCalls });
      for (const call of model.toolCalls) {
        let result: Awaited<ReturnType<typeof executeRegisteredTool>>;
        if (!allowedNames.has(call.name)) result = { ok: false, error: `tool fora da allowlist: ${call.name}` };
        else {
          const startedTool = Date.now();
          try { result = await executeRegisteredTool(call.name, { organizacaoId: input.organizacaoId, agentId: selected.agent.id, runId: run.id, contatoId: input.contatoId, leadId: input.leadId, usuarioId: input.usuarioId, agenteUsuarioId, confirmado: input.confirmado, mode: input.mode, autonomy, permissoesDelegadas: delegacao.permissoes }, call.input); }
          catch (error) { result = { ok: false, error: error instanceof Error ? error.message : String(error) }; }
          await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "tool_call", name: call.name, status: result.ok ? "completed" : "failed", input: call.input, output: result, latencyMs: Date.now() - startedTool, errorCode: result.ok ? undefined : "tool_failed", errorMessage: result.error });
        }
        const previewData = result.data && typeof result.data === "object" ? result.data as Record<string, unknown> : null;
        if (input.mode === "live" && autonomy === "approval" && previewData?.approvalRequired) {
          await db.insert(aiAlerts).values({ organizacaoId: input.organizacaoId, kind: "approval_required", severity: "warning", title: `Aprovação necessária: ${call.name}`, body: JSON.stringify(call.input).slice(0, 2000), refKind: "run", refId: run.id });
          if (input.contatoId) await db.insert(aiCases).values({ organizacaoId: input.organizacaoId, contatoId: input.contatoId, leadId: input.leadId ?? null, agentId: selected.agent.id, runId: run.id, title: `Aprovar ação: ${call.name}`, summary: "O agente preparou uma ação e aguarda decisão humana.", blocker: "A versão está configurada no modo pedir aprovação.", source: "tool_approval", contextSnapshot: { kind: "tool_approval", toolName: call.name, toolInput: call.input } });
          handoff = true;
        }
        if (call.name === "message_prepare" && result.ok && result.data && typeof result.data === "object") {
          const list = (result.data as { messages?: unknown }).messages;
          if (Array.isArray(list)) prepared.push(...list.filter((value): value is string => typeof value === "string"));
        }
        handoff ||= Boolean(result.handoff);
        messages.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: JSON.stringify(result) });
        trace.push({ type: "tool_call", name: call.name, ok: result.ok, handoff: Boolean(result.handoff) });
      }
      if (prepared.length || handoff) break;
    }

    const outgoing = responseMessages(finalText, prepared);
    await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "guardrail", name: "before_send", status: "completed", input: { count: outgoing.length }, output: { sanitized: true } });
    const sentMessageIds = await sendMessages({ ...input, suppressEgress: input.suppressEgress || autonomy !== "autonomous" }, run.id, outgoing);
    if (sentMessageIds.length) await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "egress", name: "whatsapp", status: "completed", output: { messageIds: sentMessageIds } });
    const status = handoff ? "handed_off" : "completed";
    await db.update(aiAgentRuns).set({ status, trace, tokens: tokensInput + tokensOutput, tokensInput, tokensOutput, custo: String(cost), stepsCount: sequence, completedAt: new Date() }).where(eq(aiAgentRuns.id, run.id));
    return { runId: run.id, agentId: selected.agent.id, versionId: selected.version.id, status, responseText: outgoing.join("\n---SPLIT---\n") || null, sentMessageIds, tokensInput, tokensOutput, cost, handoff };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("Orçamento") ? "aborted" : "failed";
    await persistStep({ organizacaoId: input.organizacaoId, runId: run.id, sequence: sequence++, kind: "runtime", name: "failure", status: "failed", errorCode: status === "aborted" ? "budget_exceeded" : "runtime_failed", errorMessage: message });
    await db.update(aiAgentRuns).set({ status, trace: [...trace, { type: "error", message }], tokens: tokensInput + tokensOutput, tokensInput, tokensOutput, custo: String(cost), stepsCount: sequence, erro: message, errorCode: status === "aborted" ? "budget_exceeded" : "runtime_failed", completedAt: new Date() }).where(eq(aiAgentRuns.id, run.id));
    throw error;
  }
}
