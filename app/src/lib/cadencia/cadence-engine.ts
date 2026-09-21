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
import { cadenceDefinitions, cadenceDefinitionPointers, cadenceVersions, cadenceEnrollments, cadenceEnrollmentEvents, leads, contatos, negocios, oportunidades, clientes, servicosCanonicos, whatsappTemplates, whatsappMensagens, whatsappSessao, atividades, tarefas, entityLabels, labels, leadLabels, contatoLabels } from "@/lib/db/schema";
import { eq, and, lte, inArray, desc, or, isNull, lt } from "drizzle-orm";
import { avaliarCondicao, type Condicao } from "@/lib/crm/condicao";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { executeAgent } from "@/lib/ai-platform/runtime/execute-agent";
import { sendResendEmail, isResendConfigured } from "@/lib/email/resend";
import { enviarParaDiscagem } from "@/lib/integrations/callface";
import { publicarEvento } from "@/lib/events/outbox";

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
  enrollmentId: string;
  attempt: number;
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

/**
 * Executa UMA ação pelo adapter, fora de um fluxo (SPEC §18, motor único).
 *
 * Existe porque uma regra de automação simples — gatilho, condição, uma ação —
 * é um fluxo de um passo só. Sem isto, o motor de regras precisaria de
 * implementação própria de cada ação, e passaria a existir dois lugares que
 * sabem criar tarefa, mover etapa e mandar mensagem. Foi exatamente o que
 * aconteceu: `crm/automacao-engine.ts` tinha a segunda cópia.
 *
 * Quem precisa de espera, ramificação ou estado usa `iniciarCadencia`; quem
 * precisa de uma ação usa isto. Os adapters são os mesmos.
 */
export async function executarAcaoAvulsa(
  adapterNome: string,
  ctx: Omit<CadenceActionContext, "step" | "enrollmentId" | "attempt"> & { config?: Record<string, unknown> },
): Promise<CadenceActionResult> {
  const adapter = adapters.get(adapterNome);
  if (!adapter) return { sucesso: false, erro: `adapter "${adapterNome}" não registrado` };
  return adapter({
    organizacaoId: ctx.organizacaoId,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    vars: ctx.vars,
    step: { id: `avulso:${adapterNome}`, tipo: "action", adapter: adapterNome, config: ctx.config ?? {}, branches: [] },
    enrollmentId: "",
    attempt: 0,
  });
}

/** Nomes de adapter registrados — usado por testes e pela tela de automação. */
export function adaptersRegistrados(): string[] {
  return [...adapters.keys()].sort();
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
  const job = await whatsappOutgoingQueue.add("send", { phone: telefone, conteudo: mensagem, tipo: "text" }, { jobId: `cadence:${ctx.enrollmentId}:${ctx.step.id}:${ctx.attempt}` });
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

/** Igual a `resolverContatoDaEntidade`, mas devolve o registro completo do contato (necessário pra egress via ai_agent_message/whatsapp_template, que precisam de sessaoId/leadId/botSilencedUntil, não só telefone/nome). */
async function resolverContatoCompleto(entityType: string, entityId: string, organizacaoId: string): Promise<typeof contatos.$inferSelect | null> {
  if (entityType === "contato") {
    const [row] = await db.select().from(contatos).where(and(eq(contatos.id, entityId), eq(contatos.organizacaoId, organizacaoId))).limit(1);
    return row ?? null;
  }
  if (entityType === "lead") {
    const [row] = await db.select().from(contatos).where(and(eq(contatos.leadId, entityId), eq(contatos.organizacaoId, organizacaoId))).orderBy(desc(contatos.ultimaMsgAt)).limit(1);
    if (row) return row;
    const [lead] = await db.select({ nome: leads.nome, telefone: leads.telefone, email: leads.email, responsavelId: leads.responsavelId }).from(leads).where(and(eq(leads.id, entityId), eq(leads.organizacaoId, organizacaoId))).limit(1);
    if (!lead?.telefone) return null;
    const sessions = await db.select().from(whatsappSessao).where(and(eq(whatsappSessao.organizacaoId, organizacaoId), eq(whatsappSessao.status, "connected")));
    const session = sessions.find((item) => item.isDefault) ?? sessions[0];
    if (!session) return null;
    const [created] = await db.insert(contatos).values({ organizacaoId, canal: "whatsapp", nome: lead.nome, telefone: lead.telefone.replace(/\D/g, ""), email: lead.email, sessaoId: session.id, responsavelId: lead.responsavelId, leadId: entityId }).returning();
    return created;
  }
  if (entityType === "negocio") {
    const [row] = await db.select({ contato: contatos }).from(negocios)
      .innerJoin(leads, eq(leads.id, negocios.leadId))
      .innerJoin(contatos, eq(contatos.leadId, leads.id))
      .where(and(eq(negocios.id, entityId), eq(negocios.organizacaoId, organizacaoId)))
      .orderBy(desc(contatos.ultimaMsgAt)).limit(1);
    return row?.contato ?? null;
  }
  return null;
}

function resolveLeadId(entityType: string, entityId: string, contato: typeof contatos.$inferSelect | null): string | null {
  if (entityType === "lead") return entityId;
  return contato?.leadId ?? null;
}

async function enviarWhatsappTemplate(args: { organizacaoId: string; contato: typeof contatos.$inferSelect; templateId: string; vars: Record<string, unknown> }): Promise<CadenceActionResult> {
  if (!args.contato.telefone) return { sucesso: false, erro: "contato sem telefone" };
  const [template] = await db.select().from(whatsappTemplates)
    .where(and(eq(whatsappTemplates.id, args.templateId), eq(whatsappTemplates.organizacaoId, args.organizacaoId), eq(whatsappTemplates.ativo, true)))
    .limit(1);
  if (!template) return { sucesso: false, erro: "template não encontrado ou inativo" };

  let texto = template.conteudo.replace(/\{\{nome\}\}/g, args.contato.nome || "");
  for (const [chave, valor] of Object.entries(args.vars)) {
    if (typeof valor === "string" || typeof valor === "number") texto = texto.replace(new RegExp(`\\{\\{${chave}\\}\\}`, "g"), String(valor));
  }

  const [row] = await db.insert(whatsappMensagens).values({
    contatoId: args.contato.id, leadId: args.contato.leadId, sessaoId: args.contato.sessaoId, telefone: args.contato.telefone,
    direcao: "out", tipo: "text", conteudo: texto, status: "pending", templateNome: template.nome,
  }).returning({ id: whatsappMensagens.id });
  const job = await whatsappOutgoingQueue.add("send", { messageId: row.id, phone: args.contato.telefone, conteudo: texto, tipo: "text", sessaoId: args.contato.sessaoId ?? undefined });
  await db.update(contatos).set({ ultimaMsg: texto.slice(0, 100), ultimaMsgAt: new Date(), updatedAt: new Date() }).where(eq(contatos.id, args.contato.id));
  return { sucesso: true, resultado: { jobId: job.id, messageId: row.id } };
}

/** Adapter real — chama o agente publicado configurado no nó (mesmo runtime do chat ao vivo). Egress passa pela fila/ledger do próprio `executeAgent`, não duplica envio aqui. Se falhar e houver `fallback_template_id`, tenta o template antes de reportar erro. */
registrarAdapter("ai_agent_message", async (ctx) => {
  const config = ctx.step.config as { agent_id?: string; prompt_hint?: string; fallback_template_id?: string };
  const contato = await resolverContatoCompleto(ctx.entityType, ctx.entityId, ctx.organizacaoId);
  if (!contato) return { sucesso: false, erro: "sem contato resolvido para esta entidade" };
  if (contato.botSilencedUntil && contato.botSilencedUntil > new Date()) return { sucesso: false, erro: "contato com bot silenciado (handoff em curso)" };

  try {
    const result = await executeAgent({
      organizacaoId: ctx.organizacaoId,
      agentId: config.agent_id ?? undefined,
      eventType: "cadence.step_due",
      message: config.prompt_hint ?? "",
      contatoId: contato.id,
      leadId: resolveLeadId(ctx.entityType, ctx.entityId, contato),
      mode: "live",
      suppressEgress: false,
    });
    return { sucesso: true, resultado: { runId: result.runId, status: result.status, sentMessageIds: result.sentMessageIds } };
  } catch (err) {
    const erro = err instanceof Error ? err.message : String(err);
    if (config.fallback_template_id) {
      const fallback = await enviarWhatsappTemplate({ organizacaoId: ctx.organizacaoId, contato, templateId: config.fallback_template_id, vars: ctx.vars });
      if (fallback.sucesso) return { sucesso: true, resultado: { fallbackTemplate: true, ...fallback.resultado } };
    }
    return { sucesso: false, erro };
  }
});

/** Adapter real — envia template WhatsApp cadastrado (`whatsapp_templates`), com substituição de `{{variavel}}` a partir de `vars` do enrollment. */
registrarAdapter("whatsapp_template", async (ctx) => {
  const config = ctx.step.config as { template_id?: string };
  if (!config.template_id) return { sucesso: false, erro: 'step de ação "whatsapp_template" sem config.template_id' };
  const contato = await resolverContatoCompleto(ctx.entityType, ctx.entityId, ctx.organizacaoId);
  if (!contato) return { sucesso: false, erro: "sem contato resolvido para esta entidade" };
  if (contato.botSilencedUntil && contato.botSilencedUntil > new Date()) return { sucesso: false, erro: "contato com bot silenciado (handoff em curso)" };
  return enviarWhatsappTemplate({ organizacaoId: ctx.organizacaoId, contato, templateId: config.template_id, vars: ctx.vars });
});

/**
 * Adapter real — classifica a última resposta do contato (ou `vars.summary`, se
 * `target: "summary"`) usando o agente configurado no nó. Sem resposta ainda →
 * "no_reply" direto, sem chamar modelo (o tempo de espera real é responsabilidade
 * de um nó "wait" anterior no grafo, este nó só decide com o que já existe agora).
 */
registrarAdapter("ai_classify", async (ctx) => {
  const config = ctx.step.config as { classes: Array<{ id: string; label: string }>; target?: "last_reply" | "summary"; hint?: string; agent_id?: string };
  const varKey = `classification.${ctx.step.id}`;
  const classIds = config.classes.map((item) => item.id);

  let inputText = "";
  if (config.target === "summary") {
    inputText = typeof ctx.vars.summary === "string" ? ctx.vars.summary : "";
  } else {
    const contato = await resolverContatoCompleto(ctx.entityType, ctx.entityId, ctx.organizacaoId);
    if (contato) {
      const [reply] = await db.select({ conteudo: whatsappMensagens.conteudo }).from(whatsappMensagens)
        .where(and(eq(whatsappMensagens.contatoId, contato.id), eq(whatsappMensagens.direcao, "in")))
        .orderBy(desc(whatsappMensagens.createdAt)).limit(1);
      inputText = reply?.conteudo ?? "";
    }
  }

  if (!inputText.trim()) return { sucesso: true, varsAtualizadas: { [varKey]: "no_reply" }, resultado: { classId: "no_reply" } };
  if (!config.agent_id) return { sucesso: false, erro: "nó de classificação sem agente configurado" };

  try {
    const result = await executeAgent({
      organizacaoId: ctx.organizacaoId,
      agentId: config.agent_id,
      eventType: "cadence.step_due",
      message: `Classifique a mensagem do contato em exatamente uma destas classes: ${classIds.join(", ")}.${config.hint ? ` Contexto: ${config.hint}.` : ""} Responda apenas com o id da classe, sem mais nada.\n\nMensagem do contato: """${inputText}"""`,
      mode: "live",
      suppressEgress: true,
    });
    const raw = (result.responseText ?? "").trim().toLowerCase();
    const classId = classIds.find((id) => raw === id.toLowerCase() || raw.includes(id.toLowerCase())) ?? "else";
    return { sucesso: true, varsAtualizadas: { [varKey]: classId }, resultado: { classId, raw: result.responseText } };
  } catch (err) {
    return { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
  }
});

function actionKey(ctx: CadenceActionContext): string {
  return `cadence:${ctx.enrollmentId}:${ctx.step.id}:${ctx.attempt}`;
}

async function entityLinks(ctx: CadenceActionContext): Promise<{ leadId: string | null; negocioId: string | null; empresaId: string | null; servicoId: string | null }> {
  if (ctx.entityType === "lead") {
    const [row] = await db.select({ empresaId: leads.empresaId }).from(leads).where(and(eq(leads.id, ctx.entityId), eq(leads.organizacaoId, ctx.organizacaoId))).limit(1);
    return { leadId: ctx.entityId, negocioId: null, empresaId: row?.empresaId ?? null, servicoId: null };
  }
  if (ctx.entityType === "negocio") {
    const [row] = await db.select({ leadId: negocios.leadId, empresaId: negocios.empresaId }).from(negocios).where(and(eq(negocios.id, ctx.entityId), eq(negocios.organizacaoId, ctx.organizacaoId))).limit(1);
    return { leadId: row?.leadId ?? null, negocioId: ctx.entityId, empresaId: row?.empresaId ?? null, servicoId: null };
  }
  if (ctx.entityType === "oportunidade") {
    const [row] = await db.select({ negocioId: oportunidades.negocioIdLegado, empresaId: oportunidades.empresaId }).from(oportunidades).where(and(eq(oportunidades.id, ctx.entityId), eq(oportunidades.organizacaoId, ctx.organizacaoId))).limit(1);
    const [negocio] = row?.negocioId ? await db.select({ leadId: negocios.leadId }).from(negocios).where(eq(negocios.id, row.negocioId)).limit(1) : [];
    return { leadId: negocio?.leadId ?? null, negocioId: row?.negocioId ?? null, empresaId: row?.empresaId ?? null, servicoId: null };
  }
  if (ctx.entityType === "cliente") {
    const [row] = await db.select({ leadId: clientes.leadIdLegado, empresaId: clientes.empresaId }).from(clientes).where(and(eq(clientes.id, ctx.entityId), eq(clientes.organizacaoId, ctx.organizacaoId))).limit(1);
    return { leadId: row?.leadId ?? null, negocioId: null, empresaId: row?.empresaId ?? null, servicoId: null };
  }
  if (ctx.entityType === "servico") {
    const [row] = await db.select({ leadId: servicosCanonicos.leadId, empresaId: servicosCanonicos.empresaId }).from(servicosCanonicos).where(and(eq(servicosCanonicos.id, ctx.entityId), eq(servicosCanonicos.organizacaoId, ctx.organizacaoId))).limit(1);
    return { leadId: row?.leadId ?? null, negocioId: null, empresaId: row?.empresaId ?? null, servicoId: ctx.entityId };
  }
  return { leadId: null, negocioId: null, empresaId: ctx.entityType === "empresa" ? ctx.entityId : null, servicoId: null };
}

registrarAdapter("crm_create_task", async (ctx) => {
  const config = ctx.step.config as { title?: string; description?: string; priority?: string; due_minutes?: number; owner_id?: string };
  if (!config.title?.trim()) return { sucesso: false, erro: "tarefa sem título" };
  const links = await entityLinks(ctx);
  const venceEm = new Date(Date.now() + Math.max(0, config.due_minutes ?? 1440) * 60_000);
  const [row] = await db.insert(tarefas).values({ organizacaoId: ctx.organizacaoId, leadId: links.leadId, negocioId: links.negocioId, empresaId: links.empresaId, servicoCanonicoId: links.servicoId, usuarioId: config.owner_id ?? null, titulo: config.title.trim(), descricao: config.description ?? null, tipo: "follow_up", prioridade: config.priority ?? "media", venceEm, dataVencimento: venceEm.toISOString().slice(0, 10), origem: "AUTOMACAO", motivo: `Cadência ${ctx.enrollmentId}`, chaveIdempotencia: actionKey(ctx) }).onConflictDoNothing().returning({ id: tarefas.id });
  return { sucesso: true, resultado: { tarefaId: row?.id ?? null, deduplicated: !row } };
});

async function mutateTag(ctx: CadenceActionContext, remove: boolean): Promise<CadenceActionResult> {
  const labelId = String(ctx.step.config?.label_id ?? "");
  const [label] = await db.select({ id: labels.id, nome: labels.nome }).from(labels).where(and(eq(labels.id, labelId), eq(labels.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!label) return { sucesso: false, erro: "tag não encontrada nesta organização" };
  if (remove) {
    const [removed] = await db.delete(entityLabels).where(and(eq(entityLabels.organizacaoId, ctx.organizacaoId), eq(entityLabels.entityType, ctx.entityType), eq(entityLabels.entityId, ctx.entityId), eq(entityLabels.labelId, label.id))).returning({ id: entityLabels.id });
    if (ctx.entityType === "lead") await db.delete(leadLabels).where(and(eq(leadLabels.leadId, ctx.entityId), eq(leadLabels.labelId, label.id)));
    if (ctx.entityType === "contato") await db.delete(contatoLabels).where(and(eq(contatoLabels.contatoId, ctx.entityId), eq(contatoLabels.labelId, label.id)));
    if (removed) await publicarEvento({ organizacaoId: ctx.organizacaoId, eventType: "TagRemoved", aggregateType: ctx.entityType as "lead", aggregateId: ctx.entityId, payload: { entityType: ctx.entityType, entityId: ctx.entityId, labelId: label.id, tag: label.nome }, idempotencyKey: `tag:remove:${removed.id}` });
    return { sucesso: true, resultado: { removed: Boolean(removed), labelId: label.id } };
  }
  const [assignment] = await db.insert(entityLabels).values({ organizacaoId: ctx.organizacaoId, entityType: ctx.entityType, entityId: ctx.entityId, labelId: label.id }).onConflictDoNothing().returning({ id: entityLabels.id });
  if (ctx.entityType === "lead") await db.insert(leadLabels).values({ leadId: ctx.entityId, labelId: label.id }).onConflictDoNothing();
  if (ctx.entityType === "contato") await db.insert(contatoLabels).values({ contatoId: ctx.entityId, labelId: label.id }).onConflictDoNothing();
  if (assignment) await publicarEvento({ organizacaoId: ctx.organizacaoId, eventType: "TagAdded", aggregateType: ctx.entityType as "lead", aggregateId: ctx.entityId, payload: { entityType: ctx.entityType, entityId: ctx.entityId, labelId: label.id, tag: label.nome }, idempotencyKey: `tag:add:${assignment.id}` });
  return { sucesso: true, resultado: { assignmentId: assignment?.id ?? null, deduplicated: !assignment, labelId: label.id } };
}
registrarAdapter("crm_add_tag", (ctx) => mutateTag(ctx, false));
registrarAdapter("crm_remove_tag", (ctx) => mutateTag(ctx, true));

registrarAdapter("crm_update_stage", async (ctx) => {
  const stage = String(ctx.step.config?.stage ?? "").trim();
  if (!stage) return { sucesso: false, erro: "nova etapa não informada" };
  if (["ganho", "won", "closed_won"].includes(stage.toLowerCase())) return { sucesso: false, erro: "Won exige o gate comercial de pagamento/assinatura" };
  if (ctx.entityType === "lead") await db.update(leads).set({ crm2PreVendasStage: stage, updatedAt: new Date() }).where(and(eq(leads.id, ctx.entityId), eq(leads.organizacaoId, ctx.organizacaoId)));
  else if (ctx.entityType === "negocio") await db.update(negocios).set({ status: stage, updatedAt: new Date() }).where(and(eq(negocios.id, ctx.entityId), eq(negocios.organizacaoId, ctx.organizacaoId)));
  else if (ctx.entityType === "oportunidade") await db.update(oportunidades).set({ stage, updatedAt: new Date() }).where(and(eq(oportunidades.id, ctx.entityId), eq(oportunidades.organizacaoId, ctx.organizacaoId)));
  else return { sucesso: false, erro: "esta entidade não possui etapa comercial editável" };
  await publicarEvento({ organizacaoId: ctx.organizacaoId, eventType: "StageChanged", aggregateType: ctx.entityType as "lead", aggregateId: ctx.entityId, payload: { entityType: ctx.entityType, entityId: ctx.entityId, toStage: stage }, idempotencyKey: `${actionKey(ctx)}:stage` });
  return { sucesso: true, varsAtualizadas: { stage, lead_stage: stage }, resultado: { stage } };
});

registrarAdapter("crm_assign_owner", async (ctx) => {
  const ownerId = String(ctx.step.config?.owner_id ?? "");
  if (!ownerId) return { sucesso: false, erro: "responsável não informado" };
  if (ctx.entityType === "lead") await db.update(leads).set({ responsavelId: ownerId, updatedAt: new Date() }).where(and(eq(leads.id, ctx.entityId), eq(leads.organizacaoId, ctx.organizacaoId)));
  else if (ctx.entityType === "negocio") await db.update(negocios).set({ responsavelId: ownerId, updatedAt: new Date() }).where(and(eq(negocios.id, ctx.entityId), eq(negocios.organizacaoId, ctx.organizacaoId)));
  else if (ctx.entityType === "oportunidade") await db.update(oportunidades).set({ responsavelId: ownerId, updatedAt: new Date() }).where(and(eq(oportunidades.id, ctx.entityId), eq(oportunidades.organizacaoId, ctx.organizacaoId)));
  else if (ctx.entityType === "cliente") await db.update(clientes).set({ responsavelId: ownerId, updatedAt: new Date() }).where(and(eq(clientes.id, ctx.entityId), eq(clientes.organizacaoId, ctx.organizacaoId)));
  else return { sucesso: false, erro: "esta entidade não aceita responsável" };
  return { sucesso: true, varsAtualizadas: { owner_id: ownerId }, resultado: { ownerId } };
});

registrarAdapter("crm_add_note", async (ctx) => {
  const config = ctx.step.config as { title?: string; description?: string };
  if (!config.title?.trim()) return { sucesso: false, erro: "nota sem título" };
  const links = await entityLinks(ctx);
  const [row] = await db.insert(atividades).values({ organizacaoId: ctx.organizacaoId, leadId: links.leadId, negocioId: links.negocioId, empresaId: links.empresaId, tipo: "nota_automacao", titulo: config.title.trim(), descricao: config.description ?? null, dados: { cadenceEnrollmentId: ctx.enrollmentId, stepId: ctx.step.id } }).returning({ id: atividades.id });
  return { sucesso: true, resultado: { atividadeId: row.id } };
});

registrarAdapter("crm_callface_call", async (ctx) => {
  const contato = await resolverContatoDaEntidade(ctx.entityType, ctx.entityId, ctx.organizacaoId);
  if (!contato.telefone) return { sucesso: false, erro: "entidade sem telefone" };
  const result = await enviarParaDiscagem({ nome: contato.nome || "Contato", telefone: contato.telefone });
  return result.ok ? { sucesso: true, resultado: { detalhe: result.detalhe } } : { sucesso: false, erro: result.detalhe };
});

// ─── Engine ─────────────────────────────────────────────────────────────────

/** Inicia uma cadência pra uma entidade (lead/negocio/contato). Idempotente por (definição, entidade) — não duplica enrollment ativo. */
export async function iniciarCadencia(opts: {
  cadenceDefinitionId: string;
  organizacaoId: string;
  entityType: string;
  entityId: string;
  varsIniciais?: Record<string, unknown>;
  sourceEventId?: string | null;
  idempotencyKey?: string | null;
}): Promise<string | null> {
  const idempotencyKey = opts.idempotencyKey ?? (opts.sourceEventId ? `event:${opts.cadenceDefinitionId}:${opts.sourceEventId}` : null);
  if (idempotencyKey) {
    const [replay] = await db.select({ id: cadenceEnrollments.id }).from(cadenceEnrollments)
      .where(eq(cadenceEnrollments.idempotencyKey, idempotencyKey)).limit(1);
    if (replay) return replay.id;
  }
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

  const [pointer] = await db.select().from(cadenceDefinitionPointers)
    .where(and(eq(cadenceDefinitionPointers.cadenceDefinitionId, definicao.id), eq(cadenceDefinitionPointers.organizacaoId, opts.organizacaoId)))
    .limit(1);
  const [pinnedVersion] = pointer?.publishedVersionId
    ? await db.select().from(cadenceVersions).where(and(eq(cadenceVersions.id, pointer.publishedVersionId), eq(cadenceVersions.organizacaoId, opts.organizacaoId))).limit(1)
    : [];
  const steps = (pinnedVersion?.compiledSteps ?? definicao.steps) as CadenceStep[];
  if (steps.length === 0) return null;

  const [enrollment] = await db.insert(cadenceEnrollments).values({
    organizacaoId: opts.organizacaoId,
    cadenceDefinitionId: opts.cadenceDefinitionId,
    cadenceVersionId: pinnedVersion?.id ?? null,
    entityType: opts.entityType,
    entityId: opts.entityId,
    sourceEventId: opts.sourceEventId ?? null,
    idempotencyKey,
    currentStepId: null,
    currentNodeId: null,
    status: "active",
    scheduledAt: new Date(), // 1º step roda já no próximo sweep
    nextEvalAt: new Date(),
    vars: opts.varsIniciais ?? {},
  }).onConflictDoNothing().returning({ id: cadenceEnrollments.id });

  if (!enrollment) {
    const [concorrente] = await db.select({ id: cadenceEnrollments.id }).from(cadenceEnrollments).where(and(
      eq(cadenceEnrollments.cadenceDefinitionId, opts.cadenceDefinitionId),
      eq(cadenceEnrollments.entityType, opts.entityType),
      eq(cadenceEnrollments.entityId, opts.entityId),
      inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply", "paused"]),
    )).limit(1);
    return concorrente?.id ?? null;
  }

  // Timeline semântica (25/08, achado real: página da Pessoa precisa
  // mostrar "cadência iniciada") — só pra lead (atividades.leadId é
  // NOT NULL, não dá pra logar aqui pra negocio/contato). Único ponto de
  // entrada real de todo enroll (Prospecção, automação via
  // ação "iniciar_cadencia", etc.) — nunca duplicado por caller.
  if (opts.entityType === "lead") {
    await db.insert(atividades).values({
      leadId: opts.entityId, organizacaoId: opts.organizacaoId,
      tipo: "cadencia_iniciada", titulo: definicao.nome,
    });
  }

  return enrollment.id;
}

/** Atualiza fatos vivos usados pelas condições. O snapshot inicial continua em
 * `vars`, mas status/tags/resposta são relidos antes de cada passo. */
async function hidratarVars(enrollment: typeof cadenceEnrollments.$inferSelect): Promise<Record<string, unknown>> {
  const vars = { ...((enrollment.vars as Record<string, unknown>) ?? {}), entity_type: enrollment.entityType, has_replied: Boolean(enrollment.lastInboundAt) };
  if (enrollment.entityType === "lead") {
    const [lead, tagsRows] = await Promise.all([
      db.select({ status: leads.status, sdrStatus: leads.sdrStatus, stage: leads.crm2PreVendasStage, origem: leads.origem, responsavelId: leads.responsavelId, empresaId: leads.empresaId })
        .from(leads).where(and(eq(leads.id, enrollment.entityId), eq(leads.organizacaoId, enrollment.organizacaoId))).limit(1).then((rows) => rows[0] ?? null),
      db.select({ nome: labels.nome }).from(leadLabels).innerJoin(labels, eq(labels.id, leadLabels.labelId)).where(eq(leadLabels.leadId, enrollment.entityId)),
    ]);
    Object.assign(vars, { status: lead?.status ?? null, lead_stage: lead?.stage ?? lead?.sdrStatus ?? null, stage: lead?.stage ?? lead?.sdrStatus ?? null, origin: lead?.origem ?? null, owner_id: lead?.responsavelId ?? null, empresa_id: lead?.empresaId ?? null, tag: tagsRows.map((row) => row.nome), tags: tagsRows.map((row) => row.nome) });
  } else {
    const tagsRows = await db.select({ nome: labels.nome }).from(entityLabels).innerJoin(labels, eq(labels.id, entityLabels.labelId)).where(and(
      eq(entityLabels.organizacaoId, enrollment.organizacaoId), eq(entityLabels.entityType, enrollment.entityType), eq(entityLabels.entityId, enrollment.entityId),
    ));
    Object.assign(vars, { tag: tagsRows.map((row) => row.nome), tags: tagsRows.map((row) => row.nome) });
  }
  return vars;
}

/** Uma resposta recebida encerra ou acorda follow-ups conforme a política da
 * versão pinada. É chamada depois que a mensagem inbound foi persistida. */
export async function registrarRespostaEmCadencias(input: { organizacaoId: string; contatoId: string; leadId?: string | null; recebidaEm?: Date }): Promise<number> {
  const ids = [input.contatoId, input.leadId].filter((id): id is string => Boolean(id));
  if (!ids.length) return 0;
  const rows = await db.select().from(cadenceEnrollments).where(and(
    eq(cadenceEnrollments.organizacaoId, input.organizacaoId),
    inArray(cadenceEnrollments.entityId, ids),
    inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply"]),
  ));
  let atualizados = 0;
  for (const row of rows) {
    const [version] = row.cadenceVersionId ? await db.select({ handoffPolicy: cadenceVersions.handoffPolicy }).from(cadenceVersions).where(eq(cadenceVersions.id, row.cadenceVersionId)).limit(1) : [];
    const policy = (version?.handoffPolicy ?? {}) as Record<string, unknown>;
    const pause = policy.mode !== "continue_on_reply";
    const vars = { ...((row.vars as Record<string, unknown>) ?? {}), has_replied: true, last_reply_at: (input.recebidaEm ?? new Date()).toISOString() };
    await db.update(cadenceEnrollments).set({
      lastInboundAt: input.recebidaEm ?? new Date(), vars,
      status: pause ? "paused" : "active",
      cancelReason: pause ? "resposta recebida" : row.cancelReason,
      scheduledAt: pause ? null : new Date(), nextEvalAt: pause ? null : new Date(), updatedAt: new Date(),
    }).where(eq(cadenceEnrollments.id, row.id));
    await db.insert(cadenceEnrollmentEvents).values({ enrollmentId: row.id, stepId: row.currentStepId ?? "-", status: pause ? "pausado_por_resposta" : "resposta_recebida", resultado: { contatoId: input.contatoId }, idempotencyKey: `reply:${row.id}:${(input.recebidaEm ?? new Date()).toISOString()}` }).onConflictDoNothing();
    atualizados++;
  }
  return atualizados;
}

/** Cancela um enrollment em andamento — nunca decide sozinho um cancelamento de negócio real, só executa o pedido de quem chamou. Sempre motivado (audit). */
export async function cancelarCadencia(enrollmentId: string, motivo: string): Promise<void> {
  await db.update(cadenceEnrollments).set({
    status: "cancelled",
    cancelledAt: new Date(),
    cancelReason: motivo,
    claimedUntil: null,
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
  const now = new Date();
  const [enrollment] = await db.update(cadenceEnrollments).set({ claimedUntil: new Date(now.getTime() + 2 * 60_000), updatedAt: now }).where(and(
    eq(cadenceEnrollments.id, enrollmentId),
    inArray(cadenceEnrollments.status, ["active", "waiting"]),
    or(isNull(cadenceEnrollments.claimedUntil), lt(cadenceEnrollments.claimedUntil, now)),
  )).returning();
  if (!enrollment) return;

  const [definicao] = await db.select().from(cadenceDefinitions).where(eq(cadenceDefinitions.id, enrollment.cadenceDefinitionId)).limit(1);
  if (!definicao) {
    await db.update(cadenceEnrollments).set({ status: "failed", claimedUntil: null, updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  const [pinnedVersion] = enrollment.cadenceVersionId
    ? await db.select().from(cadenceVersions).where(and(eq(cadenceVersions.id, enrollment.cadenceVersionId), eq(cadenceVersions.organizacaoId, enrollment.organizacaoId))).limit(1)
    : [];
  const steps = (pinnedVersion?.compiledSteps ?? definicao.steps) as CadenceStep[];
  const step = enrollment.currentStepId === null ? steps[0] : steps.find((s) => s.id === enrollment.currentStepId);
  if (!step) {
    await db.update(cadenceEnrollments).set({ status: "completed", completedAt: new Date(), claimedUntil: null, updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  const vars = await hidratarVars(enrollment);

  if (step.tipo === "wait") {
    // Wait não executa nada — só existe pra dar nome/observabilidade ao
    // intervalo. A espera de verdade é o próximo `scheduledAt`.
    await avancarParaProximoStep(enrollment.id, steps, step, vars);
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
    await avancarParaProximoStep(enrollment.id, steps, step, vars);
    return;
  }

  // tipo === "action"
  const adapter = step.adapter ? adapters.get(step.adapter) : undefined;
  if (!adapter) {
    await db.insert(cadenceEnrollmentEvents).values({ enrollmentId, stepId: step.id, status: "erro", resultado: { erro: `adapter "${step.adapter}" não registrado` }, attempt: enrollment.attempt });
    await db.update(cadenceEnrollments).set({ status: "failed", claimedUntil: null, updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  // Reserva persistente ANTES do side effect. Se o worker cair depois de
  // enviar e antes de confirmar, a próxima execução vira falha ambígua
  // visível em vez de repetir mensagem/ligação silenciosamente.
  const executionKey = `step:${enrollment.id}:${step.id}:${enrollment.attempt}`;
  const [execution] = await db.insert(cadenceEnrollmentEvents).values({ enrollmentId, stepId: step.id, status: "executando", resultado: { adapter: step.adapter }, attempt: enrollment.attempt, idempotencyKey: executionKey }).onConflictDoNothing().returning({ id: cadenceEnrollmentEvents.id });
  if (!execution) {
    const [existingExecution] = await db.select().from(cadenceEnrollmentEvents).where(eq(cadenceEnrollmentEvents.idempotencyKey, executionKey)).limit(1);
    if (existingExecution?.status === "executado") {
      const saved = (existingExecution.resultado && typeof existingExecution.resultado === "object" ? existingExecution.resultado : {}) as Record<string, unknown>;
      const varsAtualizadas = saved.__varsAtualizadas && typeof saved.__varsAtualizadas === "object" ? saved.__varsAtualizadas as Record<string, unknown> : {};
      await avancarParaProximoStep(enrollment.id, steps, step, { ...vars, ...varsAtualizadas });
      return;
    }
    await db.update(cadenceEnrollments).set({ status: "failed", claimedUntil: null, cancelReason: "execução interrompida com efeito externo incerto; revisão humana necessária", updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  let resultado: CadenceActionResult;
  try {
    resultado = await adapter({ organizacaoId: enrollment.organizacaoId, entityType: enrollment.entityType, entityId: enrollment.entityId, vars, step, enrollmentId, attempt: enrollment.attempt });
  } catch (err) {
    resultado = { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
  }

  if (!resultado.sucesso) {
    const retry = step.retry;
    const tentativaAtual = enrollment.attempt + 1;
    if (retry && tentativaAtual < retry.maxTentativas) {
      const backoffMin = retry.backoffMinutos[Math.min(tentativaAtual - 1, retry.backoffMinutos.length - 1)] ?? 60;
      await db.update(cadenceEnrollmentEvents).set({ status: "retry_agendado", resultado: { erro: resultado.erro, proximaTentativaEm: backoffMin } }).where(eq(cadenceEnrollmentEvents.id, execution.id));
      const retryAt = new Date(Date.now() + backoffMin * 60_000);
      await db.update(cadenceEnrollments).set({ attempt: tentativaAtual, status: "waiting", scheduledAt: retryAt, nextEvalAt: retryAt, claimedUntil: null, updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
      return;
    }
    await db.update(cadenceEnrollmentEvents).set({ status: "erro", resultado: { erro: resultado.erro } }).where(eq(cadenceEnrollmentEvents.id, execution.id));
    await db.update(cadenceEnrollments).set({ status: "failed", claimedUntil: null, updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  await db.update(cadenceEnrollmentEvents).set({ status: "executado", resultado: { ...(resultado.resultado ?? {}), __varsAtualizadas: resultado.varsAtualizadas ?? {} } }).where(eq(cadenceEnrollmentEvents.id, execution.id));

  const varsAtualizadas = { ...vars, ...(resultado.varsAtualizadas ?? {}) };
  await avancarParaProximoStep(enrollment.id, steps, step, varsAtualizadas);
}

async function avancarParaProximoStep(enrollmentId: string, steps: CadenceStep[], stepAtual: CadenceStep, vars: Record<string, unknown>): Promise<void> {
  const branchDestino = resolverBranch(stepAtual, vars);
  const proximo = branchDestino !== undefined
    ? (branchDestino === null ? null : steps.find((s) => s.id === branchDestino) ?? null)
    : proximoStep(steps, stepAtual.id);

  if (!proximo) {
    await db.update(cadenceEnrollments).set({ status: "completed", completedAt: new Date(), vars, attempt: 0, claimedUntil: null, updatedAt: new Date() }).where(eq(cadenceEnrollments.id, enrollmentId));
    return;
  }

  const esperaMs = (stepAtual.tipo === "wait" ? stepAtual.esperaMinutos ?? 0 : 0) * 60_000;
  await db.update(cadenceEnrollments).set({
    currentStepId: proximo.id,
    currentNodeId: proximo.id,
    status: "active",
    scheduledAt: new Date(Date.now() + esperaMs),
    nextEvalAt: new Date(Date.now() + esperaMs),
    vars,
    attempt: 0,
    claimedUntil: null,
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
