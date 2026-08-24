/**
 * F5 (Automação) — Cadence Engine.
 *
 * Motivo de existir: a cadência real do AI SDR (retentativa de follow-up,
 * hoje ~2 tiers hardcoded direto em `runAiSdrRetrySweep` no worker) e a
 * cadência de 13 toques do SDR inbound (hoje array estático em
 * `cadencia/sdr-inbound.ts`, disparado manualmente) são as mesmas ideias
 * repetidas de formas diferentes: uma sequência de passos no tempo, com
 * condição pra pular/ramificar, e uma ação por passo. Cada uma reimplementa
 * sua própria lógica de "quando é a próxima tentativa" — exatamente o
 * padrão de regra duplicada que já causou o bug de MRR nesse projeto.
 *
 * Este módulo é a arquitetura genérica (pedida explicitamente 09/08, "não
 * espere a Groq pra construir"): state machine + steps + condições +
 * scheduling + retries + branching + cancelamento + audit. NENHUMA
 * dependência de provedor de IA — "chamar a IA" é só mais um adapter,
 * registrado como qualquer outro (whatsapp/email/wait). Trocar Groq por
 * outro provedor no futuro não toca este arquivo.
 *
 * O que este módulo NÃO faz ainda: migrar a cadência real do AI SDR ou do
 * SDR inbound pra rodar em cima disso (isso muda comportamento em produção
 * de fluxo de receita — é o tipo de mudança que merece validação antes de
 * cortar o que já funciona, não decisão unilateral). O motor existe,
 * testado com dado real, pronto pra receber a migração quando decidido.
 *
 * Ver ADR-EXEC-013.
 */
import { db } from "@/lib/db";
import { cadenceDefinitions, cadenceEnrollments, cadenceEnrollmentEvents, leads, contatos, negocios } from "@/lib/db/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { avaliarCondicao, type Condicao } from "@/lib/crm/condicao";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { sendResendEmail, isResendConfigured } from "@/lib/email/resend";

// ─── Tipos do grafo de steps (armazenado em cadence_definitions.steps) ─────

export interface CadenceStepRetry {
  maxTentativas: number;
  backoffMinutos: number[]; // ex: [60, 240, 1440] — tentativa 1 espera 60min, 2 espera 240min, etc. Última repete o último valor.
}

export interface CadenceStepBranch {
  condicao: Condicao | null; // null = branch default (sempre casa se nada antes casou)
  proximoStepId: string | null; // null = encerra a cadência (completed)
}

export interface CadenceStep {
  id: string;
  tipo: "wait" | "action" | "condition";
  /** Só pra tipo="wait": quanto esperar antes do PRÓXIMO step (minutos). */
  esperaMinutos?: number;
  /** Só pra tipo="action": nome do adapter registrado (ver ADAPTERS abaixo). */
  adapter?: string;
  /** Config livre passada pro adapter (ex: template de mensagem, canal). */
  config?: Record<string, unknown>;
  retry?: CadenceStepRetry;
  /** Avaliadas em ordem depois do step executar (ou pro wait, imediatamente) — 1ª que casar decide o próximo step. */
  branches: CadenceStepBranch[];
}

// ─── Adapters — ação desacoplada de canal/provider ─────────────────────────

export interface CadenceActionContext {
  organizacaoId: string;
  entityType: string;
  entityId: string;
  vars: Record<string, unknown>;
  step: CadenceStep;
}

export interface CadenceActionResult {
  sucesso: boolean;
  erro?: string;
  /** Mesclado no `vars` do enrollment pra próximos steps/branches poderem usar. */
  varsAtualizadas?: Record<string, unknown>;
  resultado?: Record<string, unknown>;
}

export type CadenceAdapter = (ctx: CadenceActionContext) => Promise<CadenceActionResult>;

const adapters = new Map<string, CadenceAdapter>();

/** Registra um adapter novo — chamado uma vez na inicialização (worker/rota), nunca precisa mudar o engine pra adicionar um canal/provider novo. */
export function registrarAdapter(nome: string, fn: CadenceAdapter): void {
  adapters.set(nome, fn);
}

/** Adapter builtin — não faz nada, só existe pra steps de espera pura sem ação (equivalente a um "no-op" explícito). */
registrarAdapter("noop", async () => ({ sucesso: true }));

/**
 * Resolve telefone/email/nome de uma entidade genérica do motor. Só usado
 * como fallback quando o enrollment não trouxe essa info em `vars`
 * (`iniciarCadencia({ varsIniciais })`) — pontos de entrada antigos
 * (matrícula em massa/import da Prospecção) não passam `varsIniciais`, então
 * os adapters de canal precisam saber buscar por conta própria.
 */
async function resolverContatoDaEntidade(
  entityType: string,
  entityId: string,
  organizacaoId: string,
): Promise<{ telefone: string | null; email: string | null; nome: string | null }> {
  const vazio = { telefone: null, email: null, nome: null };
  if (entityType === "lead") {
    const [row] = await db
      .select({ telefone: leads.telefone, email: leads.email, nome: leads.nome })
      .from(leads)
      .where(and(eq(leads.id, entityId), eq(leads.organizacaoId, organizacaoId)))
      .limit(1);
    return row ?? vazio;
  }
  if (entityType === "contato") {
    const [row] = await db
      .select({ telefone: contatos.telefone, email: contatos.email, nome: contatos.nome })
      .from(contatos)
      .where(and(eq(contatos.id, entityId), eq(contatos.organizacaoId, organizacaoId)))
      .limit(1);
    return row ?? vazio;
  }
  if (entityType === "negocio") {
    const [row] = await db
      .select({ telefone: leads.telefone, email: leads.email, nome: leads.nome })
      .from(negocios)
      .innerJoin(leads, eq(leads.id, negocios.leadId))
      .where(and(eq(negocios.id, entityId), eq(negocios.organizacaoId, organizacaoId)))
      .limit(1);
    return row ?? vazio;
  }
  return vazio;
}

/** Adapter real — envia WhatsApp via a mesma fila usada pelo motor de automação (`enviar_whatsapp`). `step.config.mensagem` é obrigatório. */
registrarAdapter("whatsapp", async (ctx) => {
  const mensagem = (ctx.step.config?.mensagem as string | undefined)?.trim();
  if (!mensagem) return { sucesso: false, erro: 'step de ação "whatsapp" sem config.mensagem' };
  let telefone = (ctx.vars.telefone as string | null | undefined) ?? null;
  if (!telefone) {
    telefone = (await resolverContatoDaEntidade(ctx.entityType, ctx.entityId, ctx.organizacaoId)).telefone;
  }
  if (!telefone) return { sucesso: false, erro: "sem telefone resolvido pra esta entidade" };
  const job = await whatsappOutgoingQueue.add("send", { phone: telefone, conteudo: mensagem, tipo: "text" });
  return { sucesso: true, resultado: { jobId: job.id } };
});

/** Adapter real — envia e-mail via Resend (mesmo provider do motor de automação). `step.config.mensagem` é obrigatório; `step.config.assunto` é opcional. */
registrarAdapter("email", async (ctx) => {
  const mensagem = (ctx.step.config?.mensagem as string | undefined)?.trim();
  if (!mensagem) return { sucesso: false, erro: 'step de ação "email" sem config.mensagem' };
  const assunto = (ctx.step.config?.assunto as string | undefined)?.trim() || "Callface";
  let email = (ctx.vars.email as string | null | undefined) ?? null;
  if (!email) {
    email = (await resolverContatoDaEntidade(ctx.entityType, ctx.entityId, ctx.organizacaoId)).email;
  }
  if (!email) return { sucesso: false, erro: "sem e-mail resolvido pra esta entidade" };
  const resultado = await sendResendEmail({ to: email, subject: assunto, html: mensagem });
  if (!resultado.sent) return { sucesso: false, erro: "envio não confirmado pelo Resend", resultado: { resendConfigurado: isResendConfigured(), ...resultado } };
  return { sucesso: true, resultado: { resendConfigurado: isResendConfigured(), ...resultado } };
});

// ─── Engine ─────────────────────────────────────────────────────────────────

/** Inicia uma cadência pra uma entidade (lead/negocio/contato). Idempotente por (definição, entidade) — não duplica enrollment ativo. */
export async function iniciarCadencia(opts: {
  cadenceDefinitionId: string;
  organizacaoId: string;
  entityType: string;
  entityId: string;
  varsIniciais?: Record<string, unknown>;
}): Promise<string | null> {
  const [existente] = await db
    .select({ id: cadenceEnrollments.id })
    .from(cadenceEnrollments)
    .where(and(
      eq(cadenceEnrollments.cadenceDefinitionId, opts.cadenceDefinitionId),
      eq(cadenceEnrollments.entityType, opts.entityType),
      eq(cadenceEnrollments.entityId, opts.entityId),
      inArray(cadenceEnrollments.status, ["active", "waiting"]),
    ))
    .limit(1);
  if (existente) return existente.id;

  const [definicao] = await db.select().from(cadenceDefinitions).where(eq(cadenceDefinitions.id, opts.cadenceDefinitionId)).limit(1);
  if (!definicao || !definicao.ativo) return null;

  const steps = definicao.steps as CadenceStep[];
  if (steps.length === 0) return null;

  const [enrollment] = await db.insert(cadenceEnrollments).values({
    organizacaoId: opts.organizacaoId,
    cadenceDefinitionId: opts.cadenceDefinitionId,
    entityType: opts.entityType,
    entityId: opts.entityId,
    currentStepId: null,
    status: "active",
    scheduledAt: new Date(), // 1º step roda já no próximo sweep
    vars: opts.varsIniciais ?? {},
  }).returning({ id: cadenceEnrollments.id });

  return enrollment.id;
}

/** Cancela um enrollment em andamento — nunca decide sozinho um cancelamento de negócio real, só executa o pedido de quem chamou. Sempre motivado (audit). */
export async function cancelarCadencia(enrollmentId: string, motivo: string): Promise<void> {
  await db.update(cadenceEnrollments).set({
    status: "cancelled",
    cancelledAt: new Date(),
    cancelReason: motivo,
    updatedAt: new Date(),
  }).where(eq(cadenceEnrollments.id, enrollmentId));

  await db.insert(cadenceEnrollmentEvents).values({
    enrollmentId,
    stepId: "-",
    status: "cancelado",
    resultado: { motivo },
  });
}

function proximoStep(steps: CadenceStep[], atualId: string | null): CadenceStep | null {
  if (atualId === null) return steps[0] ?? null;
  const idx = steps.findIndex((s) => s.id === atualId);
  if (idx === -1 || idx + 1 >= steps.length) return null;
  return steps[idx + 1];
}

function resolverBranch(step: CadenceStep, vars: Record<string, unknown>): string | null | undefined {
  for (const branch of step.branches) {
    if (avaliarCondicao(branch.condicao, vars)) return branch.proximoStepId;
  }
  return undefined; // nenhuma branch casou — segue pro próximo step na ordem (comportamento default)
}

/**
 * Avança UM enrollment que já está devido (`scheduledAt <= now`). Chamado
 * pelo sweep periódico (worker) — cada chamada processa exatamente um
 * step, nunca laça vários de uma vez (facilita retry/observabilidade por
 * step). Best-effort: erro de adapter nunca derruba o sweep todo, só marca
 * esse enrollment pra retry ou failed.
 */
export async function avancarEnrollment(enrollmentId: string): Promise<void> {
  const [enrollment] = await db.select().from(cadenceEnrollments).where(eq(cadenceEnrollments.id, enrollmentId)).limit(1);
  if (!enrollment || enrollment.status !== "active" && enrollment.status !== "waiting") return;

  const [definicao] = await db.select().from(cadenceDefinitions).where(eq(cadenceDefinitions.id, enrollment.cadenceDefinitionId)).limit(1);
  if (!definicao) {
    await db.update(cadenceEnrollments).set({ status: "failed", updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  const steps = definicao.steps as CadenceStep[];
  const step = enrollment.currentStepId === null ? steps[0] : steps.find((s) => s.id === enrollment.currentStepId);
  if (!step) {
    await db.update(cadenceEnrollments).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  const vars = (enrollment.vars as Record<string, unknown>) ?? {};

  if (step.tipo === "wait") {
    // Wait não executa nada — só existe pra dar nome/observabilidade ao
    // intervalo. A espera de verdade é o próximo `scheduledAt`.
    await avancarParaProximoStep(enrollment.id, steps, step, vars, {});
    return;
  }

  if (step.tipo === "condition") {
    // Condition não executa ação nem espera — só avalia `branches` (mesma
    // `avaliarCondicao` de lib/crm/condicao.ts, via `resolverBranch` já
    // existente neste módulo, sem duplicar a gramática de condição) e
    // avança direto pro branch resolvido. Registra evento pra aparecer na
    // fila de Execuções (vocabulário já previsto no schema:
    // "executado" quando um branch bateu, "condicao_nao_atendida" quando
    // nenhum bateu e a cadência seguiu pelo fallback sequencial/branch
    // default).
    const branchResolvido = resolverBranch(step, vars);
    await db.insert(cadenceEnrollmentEvents).values({
      enrollmentId,
      stepId: step.id,
      status: branchResolvido !== undefined ? "executado" : "condicao_nao_atendida",
      resultado: { branchResolvido: branchResolvido ?? null },
      attempt: enrollment.attempt,
    });
    await avancarParaProximoStep(enrollment.id, steps, step, vars, {});
    return;
  }

  // tipo === "action"
  const adapter = step.adapter ? adapters.get(step.adapter) : undefined;
  if (!adapter) {
    await db.insert(cadenceEnrollmentEvents).values({ enrollmentId, stepId: step.id, status: "erro", resultado: { erro: `adapter "${step.adapter}" não registrado` }, attempt: enrollment.attempt });
    await db.update(cadenceEnrollments).set({ status: "failed", updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  let resultado: CadenceActionResult;
  try {
    resultado = await adapter({ organizacaoId: enrollment.organizacaoId, entityType: enrollment.entityType, entityId: enrollment.entityId, vars, step });
  } catch (err) {
    resultado = { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
  }

  if (!resultado.sucesso) {
    const retry = step.retry;
    const tentativaAtual = enrollment.attempt + 1;
    if (retry && tentativaAtual < retry.maxTentativas) {
      const backoffMin = retry.backoffMinutos[Math.min(tentativaAtual - 1, retry.backoffMinutos.length - 1)] ?? 60;
      await db.insert(cadenceEnrollmentEvents).values({ enrollmentId, stepId: step.id, status: "retry_agendado", resultado: { erro: resultado.erro, proximaTentativaEm: backoffMin }, attempt: tentativaAtual });
      await db.update(cadenceEnrollments).set({ attempt: tentativaAtual, status: "waiting", scheduledAt: new Date(Date.now() + backoffMin * 60_000), updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
      return;
    }
    await db.insert(cadenceEnrollmentEvents).values({ enrollmentId, stepId: step.id, status: "erro", resultado: { erro: resultado.erro }, attempt: tentativaAtual });
    await db.update(cadenceEnrollments).set({ status: "failed", updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  await db.insert(cadenceEnrollmentEvents).values({ enrollmentId, stepId: step.id, status: "executado", resultado: resultado.resultado ?? {}, attempt: enrollment.attempt });

  const varsAtualizadas = { ...vars, ...(resultado.varsAtualizadas ?? {}) };
  await avancarParaProximoStep(enrollment.id, steps, step, varsAtualizadas, resultado.varsAtualizadas ?? {});
}

async function avancarParaProximoStep(enrollmentId: string, steps: CadenceStep[], stepAtual: CadenceStep, vars: Record<string, unknown>, _novasVars: Record<string, unknown>): Promise<void> {
  const branchDestino = resolverBranch(stepAtual, vars);
  const proximo = branchDestino !== undefined
    ? (branchDestino === null ? null : steps.find((s) => s.id === branchDestino) ?? null)
    : proximoStep(steps, stepAtual.id);

  if (!proximo) {
    await db.update(cadenceEnrollments).set({ status: "completed", completedAt: new Date(), vars, attempt: 0, updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  const esperaMs = (stepAtual.tipo === "wait" ? stepAtual.esperaMinutos ?? 0 : 0) * 60_000;
  await db.update(cadenceEnrollments).set({
    currentStepId: proximo.id,
    status: "active",
    scheduledAt: new Date(Date.now() + esperaMs),
    vars,
    attempt: 0,
    updatedAt: new Date(),
  }).where(eq(cadenceEnrollments.id, enrollmentId));
}

/** Sweep periódico — busca todos os enrollments devidos e avança um a um. Best-effort por enrollment. Chamado pelo worker. */
export async function sweepCadenciasDevidas(limite = 100): Promise<{ processados: number }> {
  const devidos = await db
    .select({ id: cadenceEnrollments.id })
    .from(cadenceEnrollments)
    .where(and(inArray(cadenceEnrollments.status, ["active", "waiting"]), lte(cadenceEnrollments.scheduledAt, new Date())))
    .limit(limite);

  let processados = 0;
  for (const e of devidos) {
    try {
      await avancarEnrollment(e.id);
      processados++;
    } catch (err) {
      console.error(`[cadence-engine] falha ao avançar enrollment ${e.id} (best-effort):`, err);
    }
  }
  return { processados };
}
