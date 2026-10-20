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
import { MOTIVO_NUMERO_PRIVADO, numeroAceitaAutomacao, sessaoEhPrivada } from "@/lib/whatsapp/uso-automatico";
import { condicaoConversaNaoPrivada } from "@/lib/whatsapp/acesso";
import { createHash } from "node:crypto";
import { contataOCliente, dentroDaJanela, proximoHorarioDeContato } from "./janela-de-contato";
import { db } from "@/lib/db";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";
import { moverEtapa as moverEtapaPreVendas } from "@/lib/vendas/pre-vendas";
import { ETAPAS_PRE_VENDAS, ETAPAS_FECHADAS, type EtapaPreVendas, type Ator } from "@/lib/vendas/dominio";
import { aiAgentRunSteps, aiAgentVersions, cadenceDefinitions, cadenceDefinitionPointers, cadenceVersions, cadenceEnrollments, cadenceEnrollmentEvents, leads, contatos, negocios, oportunidades, clientes, servicosCanonicos, whatsappTemplates, whatsappMensagens, whatsappSessao, atividades, tarefas, entityLabels, labels, leadLabels, contatoLabels, empresas, pessoas, notificacoes, usuarios } from "@/lib/db/schema";
import { eq, and, lte, inArray, notInArray, asc, desc, or, isNull, lt, sql } from "drizzle-orm";
import { avaliarCondicao, type Condicao } from "@/lib/crm/condicao";
import { resultadoCondicaoCadencia } from "./cadence-conditions";
import { whatsappOutgoingQueue } from "@/lib/queue";
import { executeAgent } from "@/lib/ai-platform/runtime/execute-agent";
import { optOutAtivo } from "@/lib/ai-platform/operacao/politica-canal";
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
  esperaMilissegundos?: number; // precisão para intervalos em segundos
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
  /**
   * Quem está executando, quando o chamador sabe.
   *
   * O motor é compartilhado: a cadência roda por conta própria, e o agente de
   * IA usa a MESMA porta via `executarAcaoAvulsa`. Sem este campo, o adapter
   * fixava `SYSTEM` para os dois, e o registro de eventos perdia a única coisa
   * que os distingue — `vendas_eventos` tinha 41 linhas e todas diziam SYSTEM.
   *
   * O domínio já previa isso: `ATORES` inclui `AI_AGENT`, com o comentário
   * "humano e IA usam o MESMO motor; a diferença é só quem executou, e é isso
   * que este tipo carrega por todo comando de negócio". O tipo existia e nada
   * o usava.
   *
   * Ausente continua sendo `SYSTEM`: cadência de verdade não tem pessoa atrás.
   */
  ator?: Ator;
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
  ctx: Omit<CadenceActionContext, "step" | "enrollmentId" | "attempt"> & {
    config?: Record<string, unknown>;
    /**
     * Identidade da execução quando o chamador tem uma (o executor de Fluxos
     * passa `fluxo:<execucao>:<no>:<tentativa>`). Sem ela, a chave sai só de
     * entidade + config, e uma automação semanal nunca criaria de novo a mesma
     * tarefa na mesma entidade: a segunda semana caía no ON CONFLICT da primeira.
     */
    chaveExecucao?: string;
  },
): Promise<CadenceActionResult> {
  const adapter = adapters.get(adapterNome);
  if (!adapter) return { sucesso: false, erro: `adapter "${adapterNome}" não registrado` };

  // O identificador da execução avulsa precisa carregar QUAL entidade e QUAL
  // configuração — senão a chave de idempotência dos adapters fica igual para
  // todo mundo.
  //
  // O bug que isto conserta, encontrado ao auditar o outbox: com
  // `enrollmentId` vazio, `actionKey` produzia `cadence::avulso:crm_update_stage:0`
  // para TODA automação que movesse etapa, de qualquer negócio. O evento
  // `StageChanged` é publicado com `ON CONFLICT DO NOTHING` nessa chave, então
  // **só a primeira mudança de etapa do sistema inteiro publicava evento**. A
  // automação funcionava (a etapa mudava) e nada a jusante reagia.
  //
  // Com entidade e config na chave: repetir a MESMA ação na MESMA entidade é
  // idempotente, que é o desejado; ações diferentes, ou na mesma entidade com
  // configuração diferente, são fatos diferentes e cada uma publica o seu.
  const assinatura = createHash("sha256")
    .update(JSON.stringify({ e: ctx.entityType, i: ctx.entityId, c: ctx.config ?? {} }))
    .digest("hex")
    .slice(0, 16);

  return adapter({
    organizacaoId: ctx.organizacaoId,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    vars: ctx.vars,
    // O contexto é remontado campo a campo aqui, então cada campo novo precisa
    // ser repassado à mão. `ator` ficou de fora na primeira tentativa: o campo
    // existia na interface, as ferramentas do agente o preenchiam, e ele morria
    // nesta linha — o adapter continuava vendo SYSTEM.
    ator: ctx.ator,
    step: { id: `avulso:${adapterNome}`, tipo: "action", adapter: adapterNome, config: ctx.config ?? {}, branches: [] },
    enrollmentId: ctx.chaveExecucao ?? `avulso:${assinatura}`,
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

/**
 * Substituição de `{{chave}}` — UMA função para template, WhatsApp e e-mail.
 *
 * Só o template substituía. Os adapters de texto livre mandavam
 * `config.mensagem` cru, e por isso os 10 passos de e-mail publicados começam
 * com "Olá, tudo bem?" sem o nome de ninguém: escrever `{{nome}}` ali não
 * adiantaria. Com a substituição na saída dos três, escrever passa a valer.
 *
 * `primeiro_nome` e `empresa` são derivados: não precisam estar em `vars`.
 * Chave desconhecida fica literal (era o comportamento do template) — melhor
 * ver `{{cargo}}` na mensagem do que apagar um dado em silêncio.
 */
export function aplicarVariaveis(texto: string, vars: Record<string, unknown>): string {
  const nome = String(vars.nome ?? "").trim();
  const todas: Record<string, unknown> = {
    ...vars,
    nome,
    primeiro_nome: vars.primeiro_nome ?? nome.split(/\s+/)[0] ?? "",
    empresa: vars.empresa ?? vars.empresa_nome ?? "",
  };
  return texto.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (bruto, chave: string) => {
    const valor = todas[chave];
    return typeof valor === "string" || typeof valor === "number" ? String(valor) : bruto;
  });
}

/**
 * Adapter real — envia WhatsApp de texto livre. `step.config.mensagem` é obrigatório.
 *
 * O número que envia é o ESCOLHIDO (`config.sessao_id` do nó, senão o do
 * responsável do lead), nunca "o primeiro que o worker achar": sem `sessaoId`
 * na fila o worker caía no token global e a mensagem saía por um número que
 * ninguém escolheu, sem linha em `whatsapp_mensagens` (a conversa não mostrava
 * o que a automação mandou).
 */
registrarAdapter("whatsapp", async (ctx) => {
  const bruta = (ctx.step.config?.mensagem as string | undefined)?.trim();
  if (!bruta) return { sucesso: false, erro: 'step de ação "whatsapp" sem config.mensagem' };
  const mensagem = aplicarVariaveis(bruta, ctx.vars);
  // Telefone do lead existe em vars para personalização; NÃO torna o envio avulso.
  // Só um telefone escrito explicitamente no nó pode desviar da conversa do CRM.
  const telefoneAvulso = ((ctx.step.config?.telefone as string | null | undefined) ?? "").replace(/\D/g, "") || null;
  const preferida = (ctx.step.config?.sessao_id as string | undefined) || (ctx.vars.cadencia_sessao_id as string | undefined) || null;
  // A BullMQ recusa jobId com ":" (salvo o formato antigo de 3 partes).
  const jobId = `cadence-${ctx.enrollmentId}-${ctx.step.id}-${ctx.attempt}`.replace(/:/g, "-");
  try {
    if (telefoneAvulso) {
      // Número digitado no nó: não é o contato do registro, então não há conversa para registrar.
      const { id: sessaoId } = await escolherSessao(ctx.organizacaoId, { preferidaId: preferida, entidade: { tipo: ctx.entityType, id: ctx.entityId } });
      const job = await whatsappOutgoingQueue.add("send", { phone: telefoneAvulso, conteudo: mensagem, tipo: "text", sessaoId }, { jobId });
      return { sucesso: true, resultado: { jobId: job.id, sessaoId } };
    }
    const contato = await resolverContatoCompleto(ctx.entityType, ctx.entityId, ctx.organizacaoId, { sessaoPreferidaId: preferida });
    if (!contato) return { sucesso: false, erro: "sem telefone resolvido pra esta entidade" };
    if (contato.botSilencedUntil && contato.botSilencedUntil > new Date()) return { sucesso: false, erro: "contato com bot silenciado (handoff em curso)" };
    return await enfileirarWhatsapp({ contato, texto: mensagem, jobId });
  } catch (err) {
    return { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
  }
});

/** Adapter real — envia e-mail via Resend (mesmo provider do motor de automação). `step.config.mensagem` é obrigatório; `step.config.assunto` é opcional. */
registrarAdapter("email", async (ctx) => {
  const bruta = (ctx.step.config?.mensagem as string | undefined)?.trim();
  if (!bruta) return { sucesso: false, erro: 'step de ação "email" sem config.mensagem' };
  const mensagem = aplicarVariaveis(bruta, ctx.vars);
  const assunto = aplicarVariaveis((ctx.step.config?.assunto as string | undefined)?.trim() || "Callface", ctx.vars);
  let email = (ctx.vars.email as string | null | undefined) ?? null;
  if (!email) {
    email = (await resolverContatoDaEntidade(ctx.entityType, ctx.entityId, ctx.organizacaoId)).email;
  }
  if (!email) return { sucesso: false, erro: "sem e-mail resolvido pra esta entidade" };
  const resultado = await sendResendEmail({ to: email, subject: assunto, html: mensagem });
  if (!resultado.sent) return { sucesso: false, erro: "envio não confirmado pelo Resend", resultado: { resendConfigurado: isResendConfigured(), ...resultado } };
  return { sucesso: true, resultado: { resendConfigurado: isResendConfigured(), ...resultado } };
});

/**
 * Número (sessão WhatsApp) pelo qual a automação fala. Ordem: o escolhido no nó
 * ou no agente; o número do responsável do registro; só então o padrão da
 * organização. Sessão desconectada nunca é usada em silêncio: o motivo volta
 * como erro para aparecer em Execuções.
 */
export async function escolherSessao(
  organizacaoId: string,
  opts: { preferidaId?: string | null; entidade?: { tipo: string; id: string } },
): Promise<{ id: string }> {
  const sessoes = await db.select().from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, organizacaoId));
  if (opts.preferidaId) {
    const s = sessoes.find((x) => x.id === opts.preferidaId);
    if (!s) throw new Error("a sessão de WhatsApp escolhida não existe mais nesta organização");
    if (s.status !== "connected") throw new Error(`a sessão de WhatsApp escolhida (${s.label ?? s.sessionName}) está desconectada`);
    return { id: s.id };
  }
  // Escolha AUTOMÁTICA nunca cai em número privado (WhatsApp pessoal). Quem quiser falar pelo
  // próprio número privado escolhe ele no passo (preferidaId, acima). Ver lib/whatsapp/uso-automatico.ts.
  const conectadas = sessoes.filter((x) => x.status === "connected" && numeroAceitaAutomacao(x));
  if (!conectadas.length) throw new Error(sessoes.some((x) => x.status === "connected") ? "só há números privados conectados: escolha o número no passo" : "nenhuma sessão de WhatsApp conectada nesta organização");
  let responsavelId: string | null = null;
  if (opts.entidade) {
    const leadId = opts.entidade.tipo === "lead" ? opts.entidade.id
      : opts.entidade.tipo === "negocio" ? (await db.select({ leadId: negocios.leadId }).from(negocios).where(eq(negocios.id, opts.entidade.id)).limit(1))[0]?.leadId ?? null
      : null;
    if (leadId) responsavelId = (await db.select({ r: leads.responsavelId }).from(leads).where(eq(leads.id, leadId)).limit(1))[0]?.r ?? null;
    else if (opts.entidade.tipo === "contato") responsavelId = (await db.select({ r: contatos.responsavelId }).from(contatos).where(eq(contatos.id, opts.entidade.id)).limit(1))[0]?.r ?? null;
  }
  const doResponsavel = responsavelId ? conectadas.filter((x) => x.usuarioId === responsavelId) : [];
  const escolhida = doResponsavel.find((x) => x.isDefault) ?? doResponsavel[0] ?? conectadas.find((x) => x.isDefault);
  // Sem critério, `conectadas[0]` era a primeira linha de um SELECT sem ORDER
  // BY: a organização tem 3 números conectados e `is_default` em nenhum, então
  // a mensagem saía por um número sorteado. Erro na tela de Execuções é melhor
  // que o cliente receber de quem não devia.
  if (!escolhida && conectadas.length > 1) throw new SessaoAmbiguaError(`há ${conectadas.length} números de WhatsApp conectados e nada decide qual usar: escolha o número no passo, defina o responsável do registro ou marque um número como padrão`);
  return { id: (escolhida ?? conectadas[0]).id };
}

/** Mais de um número conectado e nenhum critério: o motor para em vez de sortear. */
export class SessaoAmbiguaError extends Error {
  override name = "SessaoAmbiguaError";
}

/** Número configurado no agente (versão publicada). Sem agente explícito ou sem número no agente: null (vale a ordem de `escolherSessao`). */
async function sessaoDoAgente(organizacaoId: string, agentId?: string | null): Promise<string | null> {
  if (!agentId) return null;
  const [v] = await db.select({ sessao: aiAgentVersions.channelSessionId }).from(aiAgentVersions)
    .where(and(eq(aiAgentVersions.agentId, agentId), eq(aiAgentVersions.organizacaoId, organizacaoId), eq(aiAgentVersions.status, "published"))).limit(1);
  return v?.sessao ?? null;
}

/**
 * Igual a `resolverContatoDaEntidade`, mas devolve o registro completo do
 * contato (necessário pra egress via ai_agent_message/whatsapp_template, que
 * precisam de sessaoId/leadId/botSilencedUntil, não só telefone/nome).
 *
 * Com `sessaoPreferidaId`, só vale conversa DESSE número; se o lead ainda não
 * tem contato nele, cria um nele (um contato por número, como o resto do CRM).
 * Pode lançar quando não há número utilizável (ver `escolherSessao`).
 */
async function resolverContatoCompleto(
  entityType: string, entityId: string, organizacaoId: string, opts: { sessaoPreferidaId?: string | null } = {},
): Promise<typeof contatos.$inferSelect | null> {
  const preferida = opts.sessaoPreferidaId ?? null;
  // Sem número escolhido, a conversa existente só vale se NÃO for de número privado.
  const daSessao = preferida ? [eq(contatos.sessaoId, preferida)] : [condicaoConversaNaoPrivada(contatos.sessaoId)];
  if (entityType === "contato") {
    const [row] = await db.select().from(contatos).where(and(eq(contatos.id, entityId), eq(contatos.organizacaoId, organizacaoId))).limit(1);
    // Conversa de número privado só é usada quando o passo escolheu ESSE número de propósito.
    if (row && row.sessaoId !== preferida && await sessaoEhPrivada(organizacaoId, row.sessaoId)) throw new Error(MOTIVO_NUMERO_PRIVADO);
    return row ?? null;
  }
  if (entityType === "lead") {
    const [row] = await db.select().from(contatos).where(and(eq(contatos.leadId, entityId), eq(contatos.organizacaoId, organizacaoId), ...daSessao)).orderBy(desc(contatos.ultimaMsgAt)).limit(1);
    if (row) return row;
    const [lead] = await db.select({ nome: leads.nome, telefone: leads.telefone, email: leads.email, responsavelId: leads.responsavelId }).from(leads).where(and(eq(leads.id, entityId), eq(leads.organizacaoId, organizacaoId))).limit(1);
    if (!lead?.telefone) return null;
    const sessao = await escolherSessao(organizacaoId, { preferidaId: preferida, entidade: { tipo: "lead", id: entityId } });
    const [created] = await db.insert(contatos).values({ organizacaoId, canal: "whatsapp", nome: lead.nome, telefone: lead.telefone.replace(/\D/g, ""), email: lead.email, sessaoId: sessao.id, responsavelId: lead.responsavelId, leadId: entityId }).returning();
    return created;
  }
  if (entityType === "negocio") {
    const [row] = await db.select({ contato: contatos }).from(negocios)
      .innerJoin(leads, eq(leads.id, negocios.leadId))
      .innerJoin(contatos, eq(contatos.leadId, leads.id))
      .where(and(eq(negocios.id, entityId), eq(negocios.organizacaoId, organizacaoId), ...daSessao))
      .orderBy(desc(contatos.ultimaMsgAt)).limit(1);
    if (row) return row.contato;
    // Sem conversa no número escolhido: resolve pelo lead do negócio, que cria o contato nele.
    if (preferida) {
      const [neg] = await db.select({ leadId: negocios.leadId }).from(negocios).where(and(eq(negocios.id, entityId), eq(negocios.organizacaoId, organizacaoId))).limit(1);
      if (neg?.leadId) return resolverContatoCompleto("lead", neg.leadId, organizacaoId, opts);
    }
    return null;
  }
  return null;
}

/** Cria a mensagem em `whatsapp_mensagens` (a conversa passa a mostrá-la) e a põe na fila já amarrada à sessão do contato. */
async function enfileirarWhatsapp(args: { contato: typeof contatos.$inferSelect; texto: string; templateNome?: string; jobId?: string }): Promise<CadenceActionResult> {
  const { contato, texto } = args;
  if (!contato.telefone) return { sucesso: false, erro: "contato sem telefone" };
  // Opt-out vale para TODA mensagem automática ao contato, inclusive a que uma
  // pessoa escreveu no passo da cadência ou no bloco do fluxo. Só o agente
  // conferia (política de canal): quem pediu para sair continuava recebendo a
  // régua de texto pronto. Passam por aqui WhatsApp, modelo e o modelo de
  // reserva do passo de IA.
  if (await optOutAtivo(contato.organizacaoId, contato.id)) return { sucesso: false, erro: "opt-out: o contato pediu para não receber mensagens — nada foi enviado" };
  if (!contato.sessaoId) return { sucesso: false, erro: "contato sem sessão de WhatsApp" };
  // Fila para número desconectado só gera mensagem "pendente" para sempre: melhor falhar já, com o motivo visível em Execuções.
  const [sessao] = await db.select({ status: whatsappSessao.status, nome: whatsappSessao.label }).from(whatsappSessao).where(eq(whatsappSessao.id, contato.sessaoId)).limit(1);
  if (!sessao || sessao.status !== "connected") return { sucesso: false, erro: `a sessão de WhatsApp desta conversa${sessao?.nome ? ` (${sessao.nome})` : ""} está desconectada` };
  const [row] = await db.insert(whatsappMensagens).values({
    contatoId: contato.id, leadId: contato.leadId, sessaoId: contato.sessaoId, telefone: contato.telefone,
    direcao: "out", tipo: "text", conteudo: texto, status: "pending", templateNome: args.templateNome ?? null,
  }).returning({ id: whatsappMensagens.id });
  const job = await whatsappOutgoingQueue.add("send", { messageId: row.id, phone: contato.telefone, conteudo: texto, tipo: "text", sessaoId: contato.sessaoId }, args.jobId ? { jobId: args.jobId } : undefined);
  await db.update(contatos).set({ ultimaMsg: texto.slice(0, 100), ultimaMsgAt: new Date(), updatedAt: new Date() }).where(eq(contatos.id, contato.id));
  return { sucesso: true, resultado: { jobId: job.id, messageId: row.id, sessaoId: contato.sessaoId } };
}

function resolveLeadId(entityType: string, entityId: string, contato: typeof contatos.$inferSelect | null): string | null {
  if (entityType === "lead") return entityId;
  return contato?.leadId ?? null;
}

async function enviarWhatsappTemplate(args: { organizacaoId: string; contato: typeof contatos.$inferSelect; templateId: string; vars: Record<string, unknown> }): Promise<CadenceActionResult> {
  const [template] = await db.select().from(whatsappTemplates)
    .where(and(eq(whatsappTemplates.id, args.templateId), eq(whatsappTemplates.organizacaoId, args.organizacaoId), eq(whatsappTemplates.ativo, true)))
    .limit(1);
  if (!template) return { sucesso: false, erro: "template não encontrado ou inativo" };

  // O nome do contato continua vencendo o do snapshot: é o dado do número que
  // vai receber a mensagem.
  const texto = aplicarVariaveis(template.conteudo, { ...args.vars, nome: args.contato.nome || args.vars.nome || "" });

  return enfileirarWhatsapp({ contato: args.contato, texto, templateNome: template.nome });
}

/**
 * Mensagens que um run do agente de fato enfileirou (passo `egress` do run).
 * Fonte do "o que foi enviado" para cadência e fluxo: o resultado do ciclo do
 * agente traz só a contagem.
 */
export async function mensagensEnviadasPeloRun(organizacaoId: string, runId: string): Promise<{ id: string; texto: string }[]> {
  const passos = await db.select({ output: aiAgentRunSteps.output }).from(aiAgentRunSteps)
    .where(and(eq(aiAgentRunSteps.organizacaoId, organizacaoId), eq(aiAgentRunSteps.runId, runId), eq(aiAgentRunSteps.kind, "egress")))
    .orderBy(asc(aiAgentRunSteps.sequence));
  const ids = passos.flatMap((p) => {
    const v = (p.output as { messageIds?: unknown } | null)?.messageIds;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  });
  if (!ids.length) return [];
  const rows = await db.select({ id: whatsappMensagens.id, texto: whatsappMensagens.conteudo }).from(whatsappMensagens).where(inArray(whatsappMensagens.id, ids));
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is { id: string; texto: string | null } => Boolean(r)).map((r) => ({ id: r.id, texto: r.texto ?? "" }));
}

/**
 * IA que só LÊ e devolve texto (classificar, gerar): sem nenhuma ferramenta e
 * sem envio. Antes rodava com o conjunto inteiro de ferramentas da versão e só
 * o envio suprimido — uma classificação podia mover etapa, criar tarefa ou
 * atribuir dono se o modelo resolvesse chamar uma ferramenta.
 *
 * Contato e lead vão no run para rastreio (Execuções mostra de quem era). Se o
 * contato já tem um run vivo (um por contato, `uq_ai_agent_runs_one_live_per_contact`),
 * a leitura roda sem o contato em vez de falhar: ela não fala com ninguém.
 */
export async function executarIaSemFerramentas(p: {
  organizacaoId: string; agentId?: string | null; eventType: string; message: string; contatoId?: string | null; leadId?: string | null;
}) {
  const base = {
    organizacaoId: p.organizacaoId, agentId: p.agentId || undefined, eventType: p.eventType, message: p.message, leadId: p.leadId ?? null,
    mode: "live" as const, suppressEgress: true, somenteFerramentasExtras: true, extraToolIds: [] as string[],
  };
  try {
    return await executeAgent({ ...base, contatoId: p.contatoId ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (p.contatoId && /uq_ai_agent_runs_one_live_per_contact|duplicate key/i.test(msg)) return executeAgent({ ...base, contatoId: null });
    throw err;
  }
}

/** Motivos de "agente indisponível" em que o modelo de reserva do passo vale (antes eram exceção do runtime). */
const AGENTE_INDISPONIVEL = ["agente_sem_versao_publicada", "agente_nao_encontrado", "agente_pausado_globalmente", "agente_nao_elegivel"];

/** Por que o passo de IA não falou com o contato, em texto para Execuções. */
function motivoDeNaoEnviar(r: { resultado: string; motivo?: string }): string {
  const m = r.motivo ?? "";
  if (m === "humano_responsavel" || m === "humano_respondeu_na_conversa" || m === "humano_em_andamento") return "o atendimento está com uma pessoa: o agente não fala por cima — nada foi enviado";
  if (m === "agente_pausado" || m === "ia_pausada") return "o agente está pausado neste atendimento — nada foi enviado";
  if (m === "opt_out") return "opt-out: o contato pediu para não receber mensagens — nada foi enviado";
  if (m === "aguardando_aprovacao") return "há uma ação do agente aguardando aprovação neste atendimento — nada foi enviado";
  if (r.resultado === "respondeu" || r.resultado === "sem_resposta") return `o agente terminou sem enviar mensagem — confira a autonomia dele (em "aprovação" ele escreve mas não envia) e o escopo permitido`;
  if (r.resultado === "handover") return `o agente passou o atendimento para uma pessoa sem enviar mensagem${m ? ` (${m})` : ""}`;
  return `o agente não enviou mensagem (${r.resultado}${m ? `: ${m}` : ""})`;
}

/**
 * Adapter real — o agente publicado escolhido no nó escreve e envia.
 *
 * Passa pelo CICLO do agente (`acionarAgente`), o mesmo da conversa ao vivo e
 * das automações: atribuição (humano assumiu, agente pausado, outro agente),
 * política de canal (opt-out, IA pausada na conversa, número autorizado para o
 * agente, número privado), horário e limite de mensagens do agente. Antes
 * chamava o runtime direto e nada disso era lido: um contato que uma pessoa
 * tinha assumido recebia a mensagem da IA da cadência mesmo assim.
 *
 * A cadência NÃO cria atribuição: o passo pede uma mensagem, não entrega o
 * atendimento ao agente. Se falhar por indisponibilidade do agente e houver
 * `fallback_template_id`, tenta o modelo antes de reportar erro; bloqueio por
 * pessoa/opt-out/pausa nunca cai no modelo.
 */
registrarAdapter("ai_agent_message", async (ctx) => {
  const config = ctx.step.config as { agent_id?: string; prompt_hint?: string; fallback_template_id?: string; sessao_id?: string };
  // O agente fala pelo número que foi configurado nele (canal da versão publicada); `sessao_id` do nó vence.
  let contato: typeof contatos.$inferSelect | null;
  try {
    const sessaoPreferidaId = config.sessao_id || (ctx.vars.cadencia_sessao_id as string | undefined) || await sessaoDoAgente(ctx.organizacaoId, config.agent_id);
    contato = await resolverContatoCompleto(ctx.entityType, ctx.entityId, ctx.organizacaoId, { sessaoPreferidaId });
  } catch (err) {
    return { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
  }
  if (!contato) return { sucesso: false, erro: "sem contato resolvido para esta entidade" };
  if (contato.botSilencedUntil && contato.botSilencedUntil > new Date()) return { sucesso: false, erro: "contato com bot silenciado (handoff em curso)" };
  /* Sem agente escolhido no nó, `executeAgent` resolve pelo de MAIOR
     PRIORIDADE que escuta `cadence.step_due` — e em produção isso é o
     "Organizador de Pipeline", cujo próprio guardrail diz que ele não trata
     "mensagem ao cliente", e que roda em modo `approval` (escreve e espera
     aprovação, não envia). A publicação já recusa nó assim desde 16/10, mas as
     cadências publicadas ANTES seguem no ar com o defeito: uma rodou em
     19/10/2026 e o lead nunca recebeu nada. Recusar aqui também, que é onde a
     mensagem sairia. */
  if (!config.agent_id) return { sucesso: false, erro: "passo de IA sem agente escolhido — abra a cadência, escolha quem escreve e republique" };

  const reserva = async (erro: string): Promise<CadenceActionResult> => {
    if (config.fallback_template_id) {
      const fallback = await enviarWhatsappTemplate({ organizacaoId: ctx.organizacaoId, contato: contato!, templateId: config.fallback_template_id, vars: ctx.vars });
      if (fallback.sucesso) return { sucesso: true, resultado: { fallbackTemplate: true, motivoDaReserva: erro, ...fallback.resultado } };
    }
    return { sucesso: false, erro };
  };

  let res: Awaited<ReturnType<typeof import("@/lib/ai-platform/operacao/acionar").acionarAgente>>;
  try {
    const { acionarAgente } = await import("@/lib/ai-platform/operacao/acionar");
    res = await acionarAgente({
      organizacaoId: ctx.organizacaoId,
      agentId: config.agent_id,
      evento: "cadence.step_due",
      mensagem: config.prompt_hint ?? "",
      motivoDaExecucao: `Passo "${ctx.step.id}" de uma cadência: escrever a próxima mensagem ao contato.`,
      contatoId: contato.id,
      leadId: resolveLeadId(ctx.entityType, ctx.entityId, contato),
      proativo: true,
      origem: `cadencia:${ctx.enrollmentId}`,
      chaveIdempotencia: actionKey(ctx),
    });
  } catch (err) {
    return reserva(err instanceof Error ? err.message : String(err));
  }
  /* Passo que não falou com ninguém NÃO é passo cumprido.
     O agente pode terminar sem enviar nada — autonomia em `approval`
     (escreve e espera aprovação humana), handoff, bloqueio do ciclo (pessoa
     assumiu, opt-out, fora do horário) ou recusa do guardrail. O adapter
     devolvia `sucesso: true` nesses casos, e a inscrição avançava para o
     próximo passo como se o cliente tivesse sido abordado: em 19/10/2026 uma
     cadência pulou do Dia 0 para o Dia 3 com `sentMessageIds: []`. Falhar
     aqui mantém a inscrição parada e aciona o aviso ao responsável, em vez
     de fingir que a conversa começou. */
  const enviadas = res.runId ? await mensagensEnviadasPeloRun(ctx.organizacaoId, res.runId) : [];
  if (enviadas.length) {
    return { sucesso: true, resultado: { runId: res.runId, status: res.resultado, sentMessageIds: enviadas.map((m) => m.id), mensagens: enviadas.map((m) => m.texto) } };
  }
  if (res.resultado === "falhou" || AGENTE_INDISPONIVEL.includes(res.motivo ?? "")) return reserva(res.motivo ?? "o agente falhou");
  return { sucesso: false, erro: motivoDeNaoEnviar(res), resultado: { runId: res.runId ?? null, status: res.resultado, motivo: res.motivo ?? null } };
});

/** Adapter real — envia template WhatsApp cadastrado (`whatsapp_templates`), com substituição de `{{variavel}}` a partir de `vars` do enrollment. */
registrarAdapter("whatsapp_template", async (ctx) => {
  const config = ctx.step.config as { template_id?: string; sessao_id?: string };
  if (!config.template_id) return { sucesso: false, erro: 'step de ação "whatsapp_template" sem config.template_id' };
  let contato: typeof contatos.$inferSelect | null;
  try {
    contato = await resolverContatoCompleto(ctx.entityType, ctx.entityId, ctx.organizacaoId, { sessaoPreferidaId: config.sessao_id || (ctx.vars.cadencia_sessao_id as string | undefined) || null });
  } catch (err) {
    return { sucesso: false, erro: err instanceof Error ? err.message : String(err) };
  }
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
  let contatoId: string | null = null;
  if (config.target === "summary") {
    inputText = typeof ctx.vars.summary === "string" ? ctx.vars.summary : "";
  } else {
    const contato = await resolverContatoCompleto(ctx.entityType, ctx.entityId, ctx.organizacaoId);
    contatoId = contato?.id ?? null;
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
    // Classificar só lê: sem ferramenta nenhuma (ver executarIaSemFerramentas).
    const { leadId } = await entityLinks(ctx);
    const result = await executarIaSemFerramentas({
      organizacaoId: ctx.organizacaoId,
      agentId: config.agent_id,
      eventType: "cadence.step_due",
      message: `Classifique a mensagem do contato em exatamente uma destas classes: ${classIds.join(", ")}.${config.hint ? ` Contexto: ${config.hint}.` : ""} Responda apenas com o id da classe, sem mais nada.\n\nMensagem do contato: """${inputText}"""`,
      contatoId,
      leadId,
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

async function entityLinks(ctx: Pick<CadenceActionContext, "organizacaoId" | "entityType" | "entityId">): Promise<{ leadId: string | null; negocioId: string | null; empresaId: string | null; servicoId: string | null }> {
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
  // Sem responsável explícito a tarefa nascia sem dono e sumia de "Minhas Tarefas" de todo mundo
  // (medido: regra de tag criava a tarefa com usuario_id NULL). Cai no responsável do lead, como o
  // executor de Fluxos já faz (`responsavel()` em lib/automacoes/executor.ts).
  let donoId = config.owner_id ?? null;
  if (!donoId && links.leadId) {
    const [l] = await db.select({ r: leads.responsavelId }).from(leads).where(and(eq(leads.id, links.leadId), eq(leads.organizacaoId, ctx.organizacaoId))).limit(1);
    donoId = l?.r ?? null;
  }
  // `enrollmentId` de execução avulsa (regra/fluxo) é uma chave técnica ("avulso:ab12..."), não motivo legível.
  const motivo = /^(avulso|fluxo):/.test(ctx.enrollmentId) ? "Automação" : `Cadência ${ctx.enrollmentId}`;
  const [row] = await db.insert(tarefas).values({ organizacaoId: ctx.organizacaoId, leadId: links.leadId, negocioId: links.negocioId, empresaId: links.empresaId, servicoCanonicoId: links.servicoId, usuarioId: donoId, titulo: config.title.trim(), descricao: config.description ?? null, tipo: "follow_up", prioridade: config.priority ?? "media", venceEm, dataVencimento: venceEm.toISOString().slice(0, 10), origem: "AUTOMACAO", motivo, chaveIdempotencia: actionKey(ctx) }).onConflictDoNothing().returning({ id: tarefas.id });
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

/**
 * Mover etapa pela automação usa as MESMAS portas da tela.
 *
 * Antes esta ação escrevia na tabela por conta própria, e para lead escrevia em
 * `leads.crm2_pre_vendas_stage` — uma coluna com **zero linhas preenchidas em
 * todo o banco**, que nenhuma leitura consulta. A automação movia a etapa,
 * reportava sucesso e nada acontecia no produto. Para negócio escrevia
 * `negocios.status` sem chamar o espelho, então o board de pipeline, que lê
 * `oportunidades`, continuava na etapa antiga.
 *
 * Hoje não há automação ativa, então isso nunca queimou ninguém. Queimaria na
 * primeira que alguém ligasse, e em silêncio, que é o pior formato.
 *
 * O SPEC §16 diz a regra direto: automação chama comando de domínio, não
 * escreve no banco. As portas já validam a transição, registram o evento e
 * propagam para o canônico; duplicar isso aqui é como o campo morto apareceu.
 */
registrarAdapter("crm_update_stage", async (ctx) => {
  const stage = String(ctx.step.config?.stage ?? "").trim();
  if (!stage) return { sucesso: false, erro: "nova etapa não informada" };
  if (["ganho", "won", "closed_won"].includes(stage.toLowerCase())) return { sucesso: false, erro: "Won exige o gate comercial de pagamento/assinatura" };

  // Automação age como sistema: não há pessoa por trás da regra. Mas quando o
  // chamador sabe quem é — o agente de IA, por exemplo — o ator vem no contexto
  // e é ele que entra no evento.
  const ator: Ator = ctx.ator
    ?? { tipo: "SYSTEM", usuarioId: null, ref: `automacao:${ctx.entityType}` };

  try {
    if (ctx.entityType === "lead") {
      if (!ETAPAS_PRE_VENDAS.includes(stage as EtapaPreVendas)) {
        return { sucesso: false, erro: `etapa de pré-vendas desconhecida: ${stage}` };
      }
      await moverEtapaPreVendas({
        organizacaoId: ctx.organizacaoId, leadId: ctx.entityId,
        para: stage as EtapaPreVendas, ator,
      });
    } else if (ctx.entityType === "negocio") {
      // `negocios.status` e `negocios.etapa` são campos DIFERENTES, com
      // vocabulários diferentes: `status` é o estado comercial legado
      // (reuniao_agendada, proposta_apresentada, negociacao...) e `etapa` é a
      // coluna do board CRM2 (entrada, diagnostico, proposta, negociacao).
      //
      // Cheguei a rotear isto para a porta de `etapa` e quebrei o smoke do
      // motor, que é exatamente o trabalho dele: a automação mexe em `status`,
      // e trocar o campo mudaria o significado da ação para quem já a usa.
      //
      // O defeito real aqui nunca foi o campo, foi a falta de propagação: o
      // board de pipeline lê `oportunidades`, e escrever só no legado deixava a
      // etapa antiga na tela.
      await db.update(negocios).set({ status: stage, updatedAt: new Date() })
        .where(and(eq(negocios.id, ctx.entityId), eq(negocios.organizacaoId, ctx.organizacaoId)));
      const { syncOportunidadeFromNegocio } = await import("@/lib/crm/sync-domain-model");
      await syncOportunidadeFromNegocio(ctx.entityId);
    } else if (ctx.entityType === "oportunidade") {
      // A oportunidade canônica ainda não tem porta própria de etapa: a etapa
      // vive no processo comercial legado (fase 25). Escrever direto aqui é o
      // que existe hoje, e está dito em vez de parecer desenho.
      await db.update(oportunidades).set({ stage, updatedAt: new Date() })
        .where(and(eq(oportunidades.id, ctx.entityId), eq(oportunidades.organizacaoId, ctx.organizacaoId)));
    } else {
      return { sucesso: false, erro: "esta entidade não possui etapa comercial editável" };
    }
  } catch (e) {
    // A porta recusa transição inválida com regra de negócio nomeada. Devolver
    // a mensagem dela é melhor do que "falhou": quem montou a automação precisa
    // saber que a etapa exige um comando próprio, não que houve erro.
    const msg = e instanceof Error ? e.message : String(e);
    return { sucesso: false, erro: msg };
  }

  await publicarEvento({ organizacaoId: ctx.organizacaoId, eventType: "StageChanged", aggregateType: ctx.entityType as "lead", aggregateId: ctx.entityId, payload: { entityType: ctx.entityType, entityId: ctx.entityId, toStage: stage }, idempotencyKey: `${actionKey(ctx)}:stage` });
  return { sucesso: true, varsAtualizadas: { stage, lead_stage: stage }, resultado: { stage } };
});

/**
 * Atribuir responsável pela automação passa pela MESMA porta da tela.
 *
 * Antes esta ação escrevia direto na tabela. Duas consequências, as duas
 * medidas: a aquisição canônica não acompanhava, então o board de pré-vendas
 * continuava contando o lead como "sem responsável" depois de a automação ter
 * dado um dono a ele; e a troca não deixava rastro nenhum, então a pergunta
 * "quem colocou isso na minha carteira" não tinha resposta quando a resposta
 * era "uma regra".
 *
 * `actorId` vai nulo de propósito: não foi pessoa. `source: "automation"` é o
 * que separa, na auditoria, o que alguém fez do que uma regra fez.
 */
registrarAdapter("crm_assign_owner", async (ctx) => {
  const ownerId = String(ctx.step.config?.owner_id ?? "");
  if (!ownerId) return { sucesso: false, erro: "responsável não informado" };

  const donoAtual = async (): Promise<string | null> => {
    const [r] = await db.execute<{ id: string | null }>(sql`
      SELECT responsavel_id::text AS id FROM ${sql.raw(
        ctx.entityType === "lead" ? "leads"
          : ctx.entityType === "negocio" ? "negocios"
          : ctx.entityType === "oportunidade" ? "oportunidades" : "clientes")}
       WHERE id = ${ctx.entityId}::uuid`);
    return r?.id ?? null;
  };

  if (!["lead", "negocio", "oportunidade", "cliente"].includes(ctx.entityType)) {
    return { sucesso: false, erro: "esta entidade não aceita responsável" };
  }
  const anterior = await donoAtual();

  if (ctx.entityType === "lead") await db.update(leads).set({ responsavelId: ownerId, updatedAt: new Date() }).where(and(eq(leads.id, ctx.entityId), eq(leads.organizacaoId, ctx.organizacaoId)));
  else if (ctx.entityType === "negocio") await db.update(negocios).set({ responsavelId: ownerId, updatedAt: new Date() }).where(and(eq(negocios.id, ctx.entityId), eq(negocios.organizacaoId, ctx.organizacaoId)));
  else if (ctx.entityType === "oportunidade") await db.update(oportunidades).set({ responsavelId: ownerId, updatedAt: new Date() }).where(and(eq(oportunidades.id, ctx.entityId), eq(oportunidades.organizacaoId, ctx.organizacaoId)));
  else await db.update(clientes).set({ responsavelId: ownerId, updatedAt: new Date() }).where(and(eq(clientes.id, ctx.entityId), eq(clientes.organizacaoId, ctx.organizacaoId)));

  await registrarMudancaResponsavel({
    organizacaoId: ctx.organizacaoId,
    entityType: ctx.entityType as "lead" | "negocio" | "cliente",
    entityId: ctx.entityId,
    previousOwnerId: anterior,
    newOwnerId: ownerId,
    actorId: null,
    source: "automation",
  });

  return { sucesso: true, varsAtualizadas: { owner_id: ownerId }, resultado: { ownerId } };
});

/**
 * Nota por automação, que agora aparece para quem lê a conta.
 *
 * A nota era gravada só em `atividades`. A linha do tempo canônica lê
 * `timeline_events` e `communications`, então a nota existia no banco e não
 * aparecia na tela da pessoa: escrita invisível, que é o formato de bug que este
 * refactor mais encontrou.
 *
 * O evento é publicado DEPOIS do insert: se a nota não foi gravada, não há fato
 * a anunciar. A projeção é quem decide como ela aparece (`projecao-timeline`),
 * e não este adapter, para o vocabulário da tela viver num lugar só.
 */
registrarAdapter("crm_add_note", async (ctx) => {
  const config = ctx.step.config as { title?: string; description?: string };
  if (!config.title?.trim()) return { sucesso: false, erro: "nota sem título" };
  const links = await entityLinks(ctx);
  const [row] = await db.insert(atividades).values({ organizacaoId: ctx.organizacaoId, leadId: links.leadId, negocioId: links.negocioId, empresaId: links.empresaId, tipo: "nota_automacao", titulo: config.title.trim(), descricao: config.description ?? null, dados: { cadenceEnrollmentId: ctx.enrollmentId, stepId: ctx.step.id } }).returning({ id: atividades.id });

  await publicarEvento({
    organizacaoId: ctx.organizacaoId,
    eventType: "NoteAdded",
    aggregateType: ctx.entityType as "lead",
    aggregateId: ctx.entityId,
    payload: {
      titulo: config.title.trim(), descricao: config.description ?? null,
      atividadeId: row.id, entityType: ctx.entityType, entityId: ctx.entityId,
    },
    idempotencyKey: `${actionKey(ctx)}:nota`,
  });

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
  /** Necessário para usar uma cadência pessoal; entradas de sistema só usam compartilhadas. */
  actorId?: string | null;
}): Promise<string | null> {
  // Autorize ANTES de retornar inscrição existente ou replay idempotente:
  // caso contrário outro usuário poderia descobrir o ID de uma inscrição pessoal.
  const [definicao] = await db.select().from(cadenceDefinitions)
    .where(and(eq(cadenceDefinitions.id, opts.cadenceDefinitionId), eq(cadenceDefinitions.organizacaoId, opts.organizacaoId))).limit(1);
  if (!definicao || !definicao.ativo) return null;
  if (definicao.visibility === "personal" && definicao.ownerId !== opts.actorId) return null;

  const idempotencyKey = opts.idempotencyKey ?? (opts.sourceEventId ? `event:${opts.cadenceDefinitionId}:${opts.sourceEventId}` : null);
  if (idempotencyKey) {
    const [replay] = await db.select({ id: cadenceEnrollments.id }).from(cadenceEnrollments)
      .where(and(eq(cadenceEnrollments.organizacaoId, opts.organizacaoId), eq(cadenceEnrollments.idempotencyKey, idempotencyKey))).limit(1);
    if (replay) return replay.id;
  }
  const [existente] = await db
    .select({ id: cadenceEnrollments.id })
    .from(cadenceEnrollments)
    .where(and(
      eq(cadenceEnrollments.organizacaoId, opts.organizacaoId),
      eq(cadenceEnrollments.cadenceDefinitionId, opts.cadenceDefinitionId),
      eq(cadenceEnrollments.entityType, opts.entityType),
      eq(cadenceEnrollments.entityId, opts.entityId),
      inArray(cadenceEnrollments.status, ["active", "waiting", "waiting_reply", "paused"]),
    ))
    .limit(1);
  if (existente) return existente.id;

  // Tipo errado nunca matricula. Os passos foram pensados para UM tipo de
  // registro e leem campos dele: um lead numa cadência de negócio executa um
  // grafo que não é o dele. `acoes-em-massa` inscreve com "lead" fixo e foi
  // assim que aconteceu em produção. A guarda fica na porta porque são 10
  // chamadores — `prospeccao.exigirCadenciaValida` já tinha a sua cópia.
  if (definicao.entityType !== opts.entityType) {
    throw new Error(`a cadência "${definicao.nome}" é de ${definicao.entityType} e este registro é ${opts.entityType}`);
  }

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
      eq(cadenceEnrollments.organizacaoId, opts.organizacaoId),
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
  const vars: Record<string, unknown> = { ...((enrollment.vars as Record<string, unknown>) ?? {}), entity_type: enrollment.entityType, has_replied: Boolean(enrollment.lastInboundAt) };
  if (enrollment.entityType === "lead") {
    const [lead, tagsRows] = await Promise.all([
      // `crm2PreVendasStage` é o retrato do De/Para legado; depois de uma
      // automação mover o lead ele não acompanha mais a etapa operacional.
      // Condições da cadência precisam ler a mesma coluna que a porta canônica
      // escreve, ou um passo seguinte decide usando o estado anterior.
      db.select({ status: leads.status, sdrStatus: leads.sdrStatus, stage: leads.estagioPreVendas, origem: leads.origem, responsavelId: leads.responsavelId, empresaId: leads.empresaId })
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
  // `nome` e `empresa` saem daqui para que `{{nome}}`/`{{primeiro_nome}}`/
  // `{{empresa}}` funcionem em qualquer passo, não só no template: antes só o
  // caminho de Prospecção punha `empresa` no snapshot inicial, e `nome` nenhum.
  const [contato, links] = await Promise.all([
    resolverContatoDaEntidade(enrollment.entityType, enrollment.entityId, enrollment.organizacaoId),
    entityLinks(enrollment),
  ]);
  if (contato.nome) vars.nome = contato.nome;
  if (contato.email && !vars.email) vars.email = contato.email;
  if (contato.telefone && !vars.telefone) vars.telefone = contato.telefone;
  if (!vars.empresa && links.empresaId) {
    const [empresa] = await db.select({ nome: empresas.nome }).from(empresas).where(and(eq(empresas.id, links.empresaId), eq(empresas.organizacaoId, enrollment.organizacaoId))).limit(1);
    if (empresa?.nome) vars.empresa = empresa.nome;
  }
  return vars;
}

/**
 * Negócios e oportunidades ABERTOS do lead.
 *
 * `registrarRespostaEmCadencias` só olhava `entity_id IN (contato, lead)`:
 * inscrição de `negocio`/`oportunidade` nunca parava quando o lead respondia —
 * e a cadência pós-proposta é justamente de negócio, então o cliente que
 * respondia continuava recebendo a régua.
 */
async function entidadesRelacionadasDoLead(organizacaoId: string, leadId: string): Promise<string[]> {
  const [negs, pessoasDoLead] = await Promise.all([
    db.select({ id: negocios.id }).from(negocios).where(and(
      eq(negocios.organizacaoId, organizacaoId), eq(negocios.leadId, leadId), notInArray(negocios.status, [...ETAPAS_FECHADAS]),
    )),
    db.select({ id: pessoas.id }).from(pessoas).where(and(
      eq(pessoas.organizacaoId, organizacaoId), eq(pessoas.leadIdLegado, leadId),
    )),
  ]);
  const negocioIds = negs.map((n) => n.id);
  const pessoaIds = pessoasDoLead.map((p) => p.id);
  // Oportunidade liga ao lead por `pessoa_id` (canônico) ou por
  // `negocio_id_legado` (ponte da migração): as duas pontes valem.
  const vinculo = [
    ...(negocioIds.length ? [inArray(oportunidades.negocioIdLegado, negocioIds)] : []),
    ...(pessoaIds.length ? [inArray(oportunidades.pessoaId, pessoaIds)] : []),
  ];
  const opps = vinculo.length
    ? await db.select({ id: oportunidades.id }).from(oportunidades).where(and(
        eq(oportunidades.organizacaoId, organizacaoId), or(...vinculo), notInArray(oportunidades.stage, [...ETAPAS_FECHADAS]),
      ))
    : [];
  return [...negocioIds, ...opps.map((o) => o.id)];
}

/**
 * Aviso ao responsável do lead quando a cadência muda de estado sozinha.
 *
 * Pausou por resposta, esgotou e falhou eram transições silenciosas: ninguém
 * ficava sabendo que havia um lead quente parado, ou uma régua morta.
 *
 * Idempotente pela chave única de `cadence_enrollment_events` — a reentrega
 * não insere o evento e, portanto, não reavisa. É o mesmo cadeado que o motor
 * já usa para não repetir envio.
 */
async function avisarResponsavel(
  enrollment: typeof cadenceEnrollments.$inferSelect,
  motivo: "pausado_por_resposta" | "esgotada" | "falhou",
  titulo: string,
  mensagem: string,
): Promise<void> {
  const [marca] = await db.insert(cadenceEnrollmentEvents).values({
    enrollmentId: enrollment.id, stepId: enrollment.currentStepId ?? "-", status: "responsavel_avisado",
    resultado: { motivo }, idempotencyKey: `aviso:${enrollment.id}:${motivo}`,
  }).onConflictDoNothing().returning({ id: cadenceEnrollmentEvents.id });
  if (!marca) return;
  const { leadId, negocioId } = await entityLinks(enrollment);
  if (!leadId) return;
  const [lead] = await db.select({ nome: leads.nome, responsavelId: leads.responsavelId }).from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, enrollment.organizacaoId))).limit(1);
  if (!lead?.responsavelId) return;
  // Dono que é uma agente de IA (usuarios.tipo = 'agente') não lê notificação:
  // "a conversa é sua agora" ia para a caixa de quem não tem caixa, e o lead
  // quente ficava sem ninguém. O aviso vai para a pessoa que receberia o
  // atendimento de volta da agente (mesma regra do handover); sem ninguém, não avisa.
  let destino: string | null = lead.responsavelId;
  const [dono] = await db.select({ tipo: usuarios.tipo }).from(usuarios)
    .where(and(eq(usuarios.id, lead.responsavelId), eq(usuarios.organizacaoId, enrollment.organizacaoId))).limit(1);
  if (dono?.tipo === "agente") {
    const { resolverHumanoDeDevolucao } = await import("@/lib/agentes/handover");
    destino = (await resolverHumanoDeDevolucao({ organizacaoId: enrollment.organizacaoId, agenteUsuarioId: lead.responsavelId, leadId, negocioId })).id;
  }
  if (!destino) return;
  await db.insert(notificacoes).values({
    usuarioId: destino, tipo: "cadencia",
    titulo, mensagem: `${lead.nome ?? "Lead"}: ${mensagem}`, link: `/pre-vendas/${leadId}`,
  });
}

/** Uma resposta recebida encerra ou acorda follow-ups conforme a política da
 * versão pinada. É chamada depois que a mensagem inbound foi persistida. */
export async function registrarRespostaEmCadencias(input: { organizacaoId: string; contatoId: string; leadId?: string | null; recebidaEm?: Date }): Promise<number> {
  const ids = [input.contatoId, input.leadId].filter((id): id is string => Boolean(id));
  if (input.leadId) ids.push(...await entidadesRelacionadasDoLead(input.organizacaoId, input.leadId));
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
    await db.insert(cadenceEnrollmentEvents).values({ enrollmentId: row.id, stepId: row.currentStepId ?? "-", status: pause ? "pausado_por_resposta" : "resposta_recebida", resultado: { contatoId: input.contatoId }, // `recebidaEm` é o instante em que a resposta CHEGOU, e como fato externo
      // ele é estável: a mesma resposta reentregue traz a mesma data. O problema
      // era o fallback `?? new Date()`, que trocava o fato pelo relógio — sem a
      // data, cada reentrega virava um evento novo. Uma resposta sem data é "a
      // resposta que pausou esta inscrição", e a inscrição só pausa uma vez.
      idempotencyKey: `reply:${row.id}:${input.recebidaEm?.toISOString() ?? "sem-data"}` }).onConflictDoNothing();
    if (pause) await avisarResponsavel(row, "pausado_por_resposta", "Lead respondeu — cadência pausada", "respondeu e a cadência parou. A conversa é sua agora.");
    atualizados++;
  }
  // Fluxos (Automações) esperando pelo MESMO registro decidem pela configuração
  // deles (`aoResponder`). Entra aqui porque é esta a função que o canal chama
  // a cada resposta: os fluxos não tinham parada por resposta e retomavam no
  // `retomar_em` como se o lead não tivesse falado. Best-effort: falha nos
  // fluxos nunca impede a cadência de pausar.
  try {
    const { registrarRespostaEmFluxos } = await import("@/lib/automacoes/executor");
    await registrarRespostaEmFluxos({ organizacaoId: input.organizacaoId, contatoId: input.contatoId, entidadeIds: ids, recebidaEm: input.recebidaEm });
  } catch (err) {
    console.error("[cadence-engine] resposta registrada nas cadências, mas os fluxos falharam (best-effort):", err);
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
/** O worker nunca desfaz pausa, cancelamento ou conclusão feitos por outra transação. */
const aindaEmCurso = (id: string) => and(
  eq(cadenceEnrollments.id, id),
  inArray(cadenceEnrollments.status, ["active", "waiting"]),
);

export async function avancarEnrollment(enrollmentId: string): Promise<void> {
  const now = new Date();
  const [enrollment] = await db.update(cadenceEnrollments).set({ claimedUntil: new Date(now.getTime() + 2 * 60_000), updatedAt: now }).where(and(
    eq(cadenceEnrollments.id, enrollmentId),
    inArray(cadenceEnrollments.status, ["active", "waiting"]),
    lte(cadenceEnrollments.scheduledAt, now),
    or(isNull(cadenceEnrollments.claimedUntil), lt(cadenceEnrollments.claimedUntil, now)),
  )).returning();
  if (!enrollment) return;

  const [definicao] = await db.select().from(cadenceDefinitions).where(eq(cadenceDefinitions.id, enrollment.cadenceDefinitionId)).limit(1);
  if (!definicao) {
    await db.update(cadenceEnrollments).set({ status: "failed", claimedUntil: null, updatedAt: new Date() }).where(aindaEmCurso(enrollmentId));
    return;
  }

  // Pausar a definição também interrompe inscrições já iniciadas.
  if (!definicao.ativo) {
    await db.update(cadenceEnrollments).set({
      status: "paused", cancelReason: "definicao_pausada",
      scheduledAt: null, claimedUntil: null, updatedAt: new Date(),
    }).where(aindaEmCurso(enrollmentId));
    return;
  }
  const [pinnedVersion] = enrollment.cadenceVersionId
    ? await db.select().from(cadenceVersions).where(and(eq(cadenceVersions.id, enrollment.cadenceVersionId), eq(cadenceVersions.organizacaoId, enrollment.organizacaoId))).limit(1)
    : [];
  const steps = (pinnedVersion?.compiledSteps ?? definicao.steps) as CadenceStep[];
  const step = enrollment.currentStepId === null ? steps[0] : steps.find((s) => s.id === enrollment.currentStepId);
  if (!step) {
    await db.update(cadenceEnrollments).set({ status: "completed", completedAt: new Date(), claimedUntil: null, updatedAt: new Date() }).where(aindaEmCurso(enrollmentId));
    return;
  }

  // A primeira ação de uma inscrição também obedece à janela comercial.
  if (step.tipo === "action" && contataOCliente(step.adapter) && !dentroDaJanela(now)) {
    const proximoHorario = proximoHorarioDeContato(now);
    await db.update(cadenceEnrollments).set({
      scheduledAt: proximoHorario, nextEvalAt: proximoHorario, claimedUntil: null,
      updatedAt: new Date(),
    }).where(aindaEmCurso(enrollmentId));
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
    // Sim/Não dependem de condition.<nodeId>, calculado do snapshot VIVO.
    const config = step.config as Parameters<typeof resultadoCondicaoCadencia>[0] | undefined;
    if (config?.branching === "combined") {
      vars[`condition.${step.id}`] = resultadoCondicaoCadencia(config, vars);
    }
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
    await db.update(cadenceEnrollments).set({ status: "failed", claimedUntil: null, updatedAt: new Date() }).where(aindaEmCurso(enrollmentId));
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
    await db.update(cadenceEnrollments).set({ status: "failed", claimedUntil: null, cancelReason: "execução interrompida com efeito externo incerto; revisão humana necessária", updatedAt: new Date() }).where(aindaEmCurso(enrollmentId));
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
      await db.update(cadenceEnrollments).set({ attempt: tentativaAtual, status: "waiting", scheduledAt: retryAt, nextEvalAt: retryAt, claimedUntil: null, updatedAt: new Date() }).where(aindaEmCurso(enrollmentId));
      return;
    }
    await db.update(cadenceEnrollmentEvents).set({ status: "erro", resultado: { erro: resultado.erro } }).where(eq(cadenceEnrollmentEvents.id, execution.id));
    await db.update(cadenceEnrollments).set({ status: "failed", claimedUntil: null, updatedAt: new Date() }).where(aindaEmCurso(enrollmentId));
    await avisarResponsavel(enrollment, "falhou", "Cadência falhou", `a cadência parou no passo "${step.id}": ${resultado.erro ?? "erro sem detalhe"}`);
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
    const [concluido] = await db.update(cadenceEnrollments).set({ status: "completed", completedAt: new Date(), vars, attempt: 0, claimedUntil: null, updatedAt: new Date() }).where(aindaEmCurso(enrollmentId)).returning();
    if (concluido && !concluido.lastInboundAt) await avisarResponsavel(concluido, "esgotada", "Cadência esgotada sem resposta", "passou por todos os passos e não respondeu. Decida o próximo movimento.");
    return;
  }

  const esperaMs = stepAtual.tipo === "wait" ? (stepAtual.esperaMilissegundos ?? (stepAtual.esperaMinutos ?? 0) * 60_000) : 0;
  const quandoBruto = new Date(Date.now() + esperaMs);
  const quando = contataOCliente(proximo.adapter) ? proximoHorarioDeContato(quandoBruto) : quandoBruto;
  await db.update(cadenceEnrollments).set({
    currentStepId: proximo.id,
    currentNodeId: proximo.id,
    status: "active",
    scheduledAt: quando,
    nextEvalAt: quando,
    vars,
    attempt: 0,
    claimedUntil: null,
    updatedAt: new Date(),
  }).where(aindaEmCurso(enrollmentId));
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
