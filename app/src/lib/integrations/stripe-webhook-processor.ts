/**
 * O processamento de UM evento do Stripe — o mesmo para a rota HTTP, para o
 * worker (fila `stripe-webhook-events`) e para o reprocesso manual. Quem chama
 * cuida do inbox (status, tentativas, auditoria); aqui só se faz o trabalho e se
 * LANÇA o erro quando algo falha: o erro é o que vira `failed` + fila.
 *
 * Tudo é idempotente: o Stripe reentrega e a fila reprocessa.
 * Dependências entram por `deps` para o teste rodar sem banco, sem Redis e sem Stripe.
 */
import {
  customerIdDe, descreverEventoFinanceiro, invoiceIdDe, pagamentoDoEvento, subscriptionIdDe,
  type FatoFinanceiro, type PagamentoDoEvento,
} from "./stripe-financeiro";

type Obj = Record<string, unknown>;

export type StripeEventPayload = {
  id?: string;
  type?: string;
  created?: number;
  api_version?: string | null;
  livemode?: boolean;
  data?: { object?: Obj; previous_attributes?: Obj };
};

export interface ContextoProcessamento { organizacaoId: string; inboxId: string }

export interface DepsProcessamento {
  paymentConfirmed(session: Obj): Promise<string>;
  invoicePaid(invoice: Obj): Promise<string>;
  asyncPaymentFailed(session: Obj): Promise<string>;
  checkoutExpired(session: Obj): Promise<string>;
  invoicePaymentFailed(invoice: Obj): Promise<string>;
  chargeRefunded(charge: Obj): Promise<string>;
  dispute(dispute: Obj, encerrada: boolean): Promise<string>;
  subscriptionCanceled(sub: Obj): Promise<string>;
  subscriptionLink(sub: Obj): Promise<string>;
  mockMode(): boolean;
  sync(organizacaoId: string): Promise<unknown>;
  automacao(args: Obj): Promise<unknown>;
  timeline(organizacaoId: string, fato: FatoFinanceiro): Promise<string>;
  pagamento(organizacaoId: string, p: PagamentoDoEvento, customerId: string | null): Promise<string>;
  recebivel(organizacaoId: string, invoiceId: string, tipoEvento: string): Promise<string>;
  recalcular(organizacaoId: string): Promise<string>;
  avisar(a: { organizacaoId: string; customerId: string | null; tipo: string; titulo: string; mensagem: string }): Promise<string>;
}

/** Eventos sem efeito no espelho de assinaturas/faturas: o sync completo seria custo sem ganho. */
const SEM_SYNC = new Set([
  "customer.updated", "payment_method.attached", "payment_method.updated", "payment_method.detached",
  "customer.subscription.trial_will_end",
]);

export async function depsReais(): Promise<DepsProcessamento> {
  const h = await import("./stripe-webhook-handlers");
  const f = await import("./stripe-financeiro-efeitos");
  const { syncStripe } = await import("./stripe-sync");
  const { isStripeMockMode } = await import("./stripe-checkout");
  const { dispararAutomacoesFinanceiras } = await import("@/lib/crm/automacao-engine");
  return {
    paymentConfirmed: (o) => h.handlePaymentConfirmed(o),
    invoicePaid: h.handleInvoicePaid,
    asyncPaymentFailed: h.handleAsyncPaymentFailed,
    checkoutExpired: h.handleCheckoutExpired,
    invoicePaymentFailed: h.handleInvoicePaymentFailed,
    chargeRefunded: h.handleChargeRefunded,
    dispute: h.handleDispute,
    subscriptionCanceled: h.handleSubscriptionCanceled,
    subscriptionLink: h.handleSubscriptionLink,
    mockMode: isStripeMockMode,
    sync: (org) => syncStripe(org),
    automacao: (a) => dispararAutomacoesFinanceiras(a as never),
    timeline: f.registrarFatoNaTimeline,
    pagamento: f.gravarPagamento,
    recebivel: f.atualizarRecebivel,
    recalcular: f.recalcularRecebiveis,
    avisar: f.avisarEquipe,
  };
}

export async function processarEventoStripe(
  event: StripeEventPayload, ctx: ContextoProcessamento, deps: DepsProcessamento,
): Promise<{ passos: string[] }> {
  const type = event.type ?? "";
  const object: Obj = event.data?.object ?? {};
  const org = ctx.organizacaoId;
  const passos: string[] = [];
  const passo = async (nome: string, fn: () => Promise<string>) => { passos.push(`${nome}: ${await fn()}`); };

  const mock = deps.mockMode(); // lança se o modo for inconsistente → o evento falha, não passa calado

  // checkout.session.completed dispara quando o cliente TERMINA o checkout, não quando PAGA:
  // em boleto a sessão fica "unpaid" até compensar. Só "paid" confirma (async_payment_succeeded cobre o resto).
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    if (object.payment_status === "paid") await passo("pagamento confirmado", () => deps.paymentConfirmed(object));
    else passos.push(`${type} ignorado: payment_status=${String(object.payment_status)} (aguardando compensação)`);
  }
  if (type === "checkout.session.async_payment_failed") await passo("boleto falhou", () => deps.asyncPaymentFailed(object));
  if (type === "checkout.session.expired") await passo("checkout expirado", () => deps.checkoutExpired(object));
  if (type === "invoice.payment_failed") await passo("cobrança falhou", () => deps.invoicePaymentFailed(object));
  if (type === "invoice.paid") await passo("fatura paga", () => deps.invoicePaid(object));
  if (type === "charge.refunded") await passo("estorno", () => deps.chargeRefunded(object));
  if (type === "charge.dispute.created" || type === "charge.dispute.closed") {
    await passo("contestação", () => deps.dispute(object, type.endsWith(".closed")));
  }
  if (type === "customer.subscription.deleted") await passo("cancelamento", () => deps.subscriptionCanceled(object));
  if (type.startsWith("customer.subscription.")) await passo("vínculo da assinatura", () => deps.subscriptionLink(object));

  const customerId = customerIdDe(event);
  const fato = descreverEventoFinanceiro(event);

  // Avisos dos eventos novos (a gente precisa agir antes de o cliente virar inadimplente/churn).
  if (type === "invoice.overdue" || type === "invoice.payment_action_required" || type === "customer.subscription.trial_will_end") {
    if (fato) {
      const tipo = type === "invoice.overdue" ? "fatura_vencida" : type === "invoice.payment_action_required" ? "pagamento_exige_acao" : "trial_terminando";
      await passo("aviso", () => deps.avisar({
        organizacaoId: org, customerId, tipo, titulo: fato.titulo.split(" — ")[0],
        mensagem: [fato.titulo, fato.descricao].filter(Boolean).join(". "),
      }));
    }
  }
  if (type === "customer.updated") passos.push("customer.updated registrado no inbox (sem efeito no espelho)");

  if (mock) { passos.push("modo mock: sync e efeitos financeiros pulados"); return { passos }; }

  if (!SEM_SYNC.has(type)) {
    const r = await deps.sync(org);
    passos.push(`sync: ${JSON.stringify(r)}`);

    // Regras financeiras só depois da materialização local: a automação vê a mesma Empresa/Service do Financeiro.
    const invoiceId = type.startsWith("invoice.") && typeof object.id === "string" ? object.id : null;
    const subscriptionId = subscriptionIdDe(object);
    let gatilho: "pagamento_falhou" | "fatura_atrasada" | "fatura_paga" | "assinatura_status_alterado" | null = null;
    if (type === "invoice.payment_failed") gatilho = "pagamento_falhou";
    else if (type === "invoice.paid") gatilho = "fatura_paga";
    else if (type === "invoice.overdue") gatilho = "fatura_atrasada";
    else if (type === "invoice.updated") {
      const status = typeof object.status === "string" ? object.status : null;
      const dueDate = typeof object.due_date === "number" ? object.due_date * 1000 : null;
      if (status === "paid") gatilho = "fatura_paga";
      else if (status === "open" && dueDate != null && dueDate < Date.now()) gatilho = "fatura_atrasada";
    } else if (type.startsWith("customer.subscription.")) gatilho = "assinatura_status_alterado";
    if (gatilho) {
      await deps.automacao({
        gatilho, organizacaoId: org, stripeCustomerId: customerId, stripeInvoiceId: invoiceId, stripeSubscriptionId: subscriptionId,
        campos: {
          stripeEvent: type, stripeCustomerId: customerId, stripeInvoiceId: invoiceId, stripeSubscriptionId: subscriptionId,
          status: typeof object.status === "string" ? object.status : null,
          amountDue: typeof object.amount_due === "number" ? object.amount_due / 100 : null,
          attemptCount: typeof object.attempt_count === "number" ? object.attempt_count : null,
          nextPaymentAttempt: typeof object.next_payment_attempt === "number" ? new Date(object.next_payment_attempt * 1000).toISOString() : null,
        },
      });
    }
  }

  // Efeitos financeiros: timeline, pagamentos, recebível.
  if (fato) await passo("timeline", () => deps.timeline(org, fato));
  const pg = pagamentoDoEvento(event);
  if (pg) await passo("pagamentos", () => deps.pagamento(org, pg, customerId));
  const inv = type.startsWith("invoice.") ? invoiceIdDe(object) : null;
  if (inv) await passo("recebível", () => deps.recebivel(org, inv, type));
  if (!SEM_SYNC.has(type)) await passo("recebíveis", () => deps.recalcular(org));

  return { passos };
}
