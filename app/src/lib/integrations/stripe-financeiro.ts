/**
 * O que um evento do Stripe VIRA no ONFACE — parte pura, sem banco.
 *
 * Fica separada de `stripe-financeiro-efeitos.ts` (que escreve) por um motivo
 * prático: a leitura do payload é onde mora a maior parte do risco (a conta de
 * produção está em `2025-06-30.basil`, o código novo fala `2026-08-26.dahlia`,
 * e o shape do invoice mudou entre as duas). Sendo pura, esta parte tem teste
 * com payload falso, sem Redis, sem Postgres e sem chave do Stripe.
 *
 * Três decisões moram aqui:
 *   1. o evento é do ONFACE ou do SaaS Callface? (a conta live é compartilhada)
 *   2. que fato financeiro ele conta na timeline, com valor já formatado;
 *   3. em que estado fica o recebível e o pagamento.
 */

type Obj = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asObj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const asStr = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const asNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* ── Identificação do objeto ───────────────────────────────────────────── */

/** `cus_…` do objeto: string, objeto expandido, ou (payment_method.detached) o valor anterior. */
export function customerIdDe(event: { data?: { object?: Obj; previous_attributes?: Obj } }): string | null {
  const o = event.data?.object ?? {};
  const direto = o.customer;
  if (typeof direto === "string") return direto;
  const expandido = asObj(direto);
  if (expandido && typeof expandido.id === "string") return expandido.id;
  // payment_method.detached chega com customer = null; o vínculo está no valor anterior.
  const anterior = event.data?.previous_attributes?.customer;
  if (typeof anterior === "string") return anterior;
  // customer.updated: o próprio objeto é o customer.
  if (o.object === "customer" && typeof o.id === "string") return o.id;
  return null;
}

/** `sub_…` — no basil o invoice não tem mais `subscription` solto; vem em `parent.subscription_details`. */
export function subscriptionIdDe(o: Obj): string | null {
  if (o.object === "subscription" && typeof o.id === "string") return o.id;
  const direto = o.subscription;
  if (typeof direto === "string") return direto;
  const expandido = asObj(direto);
  if (expandido && typeof expandido.id === "string") return expandido.id;
  const detalhes = asObj(asObj(o.parent)?.subscription_details) ?? asObj(o.subscription_details);
  const sub = detalhes?.subscription;
  if (typeof sub === "string") return sub;
  return asStr(asObj(sub)?.id);
}

/** `in_…` quando o objeto é um invoice. */
export function invoiceIdDe(o: Obj): string | null {
  if (o.object === "invoice" && typeof o.id === "string") return o.id;
  return typeof o.invoice === "string" ? o.invoice : null;
}

/* ── Metadata: SaaS x ONFACE ───────────────────────────────────────────── */

/** Todas as metadatas que o objeto pode carregar (objeto, assinatura embutida, linhas). */
export function metadatasDe(o: Obj): Obj[] {
  const out: Obj[] = [];
  const push = (v: unknown) => { const m = asObj(v); if (m) out.push(m); };
  push(o.metadata);
  push(asObj(asObj(o.parent)?.subscription_details)?.metadata);
  push(asObj(o.subscription_details)?.metadata);
  const linhas = asObj(o.lines)?.data;
  if (Array.isArray(linhas)) for (const l of linhas.slice(0, 5)) {
    push(asObj(l)?.metadata);
    push(asObj(asObj(asObj(l)?.parent)?.subscription_item_details)?.metadata);
  }
  return out;
}

const CHAVES_DO_SAAS = ["organization_id", "plan_id", "user_id"];

/**
 * A conta Stripe live é COMPARTILHADA com o SaaS Callface. Objeto do SaaS carrega
 * `organization_id`/`plan_id`/`user_id` na metadata e NENHUMA chave `crm_*` /
 * `negocioId`/`propostaId`. Sem esta guarda, o fallback "só existe uma
 * organização" do `resolveWebhookOrganization` atribuiria fatura do SaaS ao ONFACE.
 *
 * Vínculo persistido (checkout/assinatura/fatura do ONFACE) vence: a guarda só
 * olha a metadata, e quem decide usar ou não o resultado é o chamador.
 */
export function eventoDoSaaS(object: Obj): boolean {
  const metas = metadatasDe(object);
  if (metas.length === 0) return false;
  const temSaaS = metas.some((m) => CHAVES_DO_SAAS.some((k) => k in m && m[k] != null && m[k] !== ""));
  if (!temSaaS) return false;
  const temOnface = metas.some((m) =>
    Object.keys(m).some((k) => k.startsWith("crm_") || k === "negocioId" || k === "propostaId" || k === "empresaId" || k === "onfaceEmpresaId"));
  return !temOnface;
}

/** O negócio que a metadata aponta (qualquer grafia), só se for UUID. */
export function negocioIdDaMetadata(o: Obj): string | null {
  for (const m of metadatasDe(o)) {
    for (const k of ["crm_negocio_id", "negocioId"]) {
      const v = m[k];
      if (typeof v === "string" && UUID_RE.test(v)) return v;
    }
  }
  return null;
}

/* ── Formatação ────────────────────────────────────────────────────────── */

/** Valor em unidade mínima (centavos) → "R$ 1.234,56". Moeda desconhecida cai em BRL. */
export function formatarValor(centavos: number | null | undefined, moeda?: string | null): string {
  if (centavos == null || !Number.isFinite(centavos)) return "valor não informado";
  const codigo = (moeda || "brl").toUpperCase();
  let texto: string;
  try {
    texto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: codigo }).format(centavos / 100);
  } catch {
    texto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
  }
  return texto.replace(/ /g, " ");
}

/** epoch (segundos) → "dd/mm/aaaa" no fuso de São Paulo. */
export function formatarData(segundos: number | null | undefined): string | null {
  if (segundos == null || !Number.isFinite(segundos)) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(segundos * 1000));
}

/** Fim do período corrente: no basil mudou de lugar (passou para o item), então olha os dois. */
function fimDoPeriodo(o: Obj): number | null {
  const direto = asNum(o.current_period_end);
  if (direto != null) return direto;
  const itens = asObj(o.items)?.data;
  return Array.isArray(itens) ? asNum(asObj(itens[0])?.current_period_end) : null;
}

const INTERVALO: Record<string, string> = { month: "mês", year: "ano", week: "semana", day: "dia" };

/** Soma dos itens de uma assinatura, em centavos por período, e o intervalo. */
export function totalDosItens(itens: unknown): { centavos: number; intervalo: string | null; moeda: string | null; plano: string | null } | null {
  const lista = Array.isArray(asObj(itens)?.data) ? (asObj(itens)!.data as unknown[]) : null;
  if (!lista || lista.length === 0) return null;
  let centavos = 0;
  let intervalo: string | null = null;
  let moeda: string | null = null;
  const nomes: string[] = [];
  for (const it of lista) {
    const item = asObj(it);
    if (!item) continue;
    const preco = asObj(item.price) ?? asObj(item.plan);
    const unit = asNum(preco?.unit_amount) ?? asNum(preco?.amount) ?? 0;
    const qtd = asNum(item.quantity) ?? 1;
    centavos += unit * qtd;
    intervalo = intervalo ?? asStr(asObj(preco?.recurring)?.interval) ?? asStr(preco?.interval);
    moeda = moeda ?? asStr(preco?.currency);
    const nome = asStr(preco?.nickname) ?? asStr(asObj(preco?.product)?.name);
    if (nome) nomes.push(nome);
  }
  return { centavos, intervalo, moeda, plano: nomes.length ? nomes.join(" + ") : null };
}

const STATUS_ASSINATURA: Record<string, string> = {
  active: "ativa", trialing: "em teste", past_due: "em atraso", canceled: "cancelada", unpaid: "não paga",
  paused: "pausada", incomplete: "incompleta", incomplete_expired: "expirada",
};

const MOTIVO_CANCELAMENTO: Record<string, string> = {
  cancellation_requested: "pedido do cliente", payment_failed: "falha de pagamento", payment_disputed: "contestação",
};

/* ── Fato financeiro que vai para a timeline ───────────────────────────── */

export type TipoFinanceiro =
  | "SubscriptionCreated" | "SubscriptionUpdated" | "SubscriptionCancelScheduled" | "SubscriptionCanceled"
  | "SubscriptionUpgraded" | "SubscriptionDowngraded" | "SubscriptionTrialEnding"
  | "InvoiceIssued" | "InvoicePaid" | "InvoiceOverdue" | "InvoicePaymentFailed" | "InvoiceActionRequired"
  | "InvoiceVoided" | "InvoiceUncollectible"
  | "PaymentReceived" | "PaymentFailed" | "PaymentRefunded"
  | "PaymentMethodAttached" | "PaymentMethodUpdated" | "PaymentMethodDetached";

export interface FatoFinanceiro {
  tipo: TipoFinanceiro;
  titulo: string;
  descricao: string | null;
  /** Chave de idempotência do FATO (não do evento): dois eventos do mesmo fato dão uma linha só. */
  chave: string;
  customerId: string | null;
  invoiceId: string | null;
  subscriptionId: string | null;
  negocioId: string | null;
  /** Em unidade mínima (centavos), quando o fato tem valor. */
  valorCentavos: number | null;
  moeda: string | null;
  ocorridoEm: Date;
  contexto: Record<string, unknown>;
}

interface EventoStripe {
  id?: string;
  type?: string;
  created?: number;
  data?: { object?: Obj; previous_attributes?: Obj };
}

function base(event: EventoStripe, o: Obj): Pick<FatoFinanceiro, "customerId" | "invoiceId" | "subscriptionId" | "negocioId" | "ocorridoEm"> {
  return {
    customerId: customerIdDe(event),
    invoiceId: invoiceIdDe(o),
    subscriptionId: subscriptionIdDe(o),
    negocioId: negocioIdDaMetadata(o),
    ocorridoEm: typeof event.created === "number" ? new Date(event.created * 1000) : new Date(),
  };
}

function nomeDoMetodo(pm: Obj): string {
  const card = asObj(pm.card);
  if (card) {
    const marca = asStr(card.brand);
    const final = asStr(card.last4);
    const m = marca ? marca.charAt(0).toUpperCase() + marca.slice(1) : "Cartão";
    return final ? `${m} final ${final}` : m;
  }
  const tipo = asStr(pm.type);
  return tipo === "boleto" ? "Boleto" : tipo === "pix" ? "Pix" : tipo ? tipo : "forma de pagamento";
}

/**
 * Converte um evento do Stripe no fato que a timeline conta, ou `null` quando
 * o evento não é fato financeiro (customer.updated, ruído de `subscription.updated`).
 */
export function descreverEventoFinanceiro(event: EventoStripe): FatoFinanceiro | null {
  const type = event.type ?? "";
  const o = event.data?.object ?? {};
  const prev = event.data?.previous_attributes ?? {};
  const eid = event.id ?? "sem-id";
  const b = base(event, o);

  /* ── Assinatura ── */
  if (type === "customer.subscription.created") {
    const t = totalDosItens(o.items);
    const valor = t ? `${formatarValor(t.centavos, t.moeda)}/${INTERVALO[t.intervalo ?? "month"] ?? t.intervalo}` : null;
    const emTeste = o.status === "trialing";
    return {
      ...b, tipo: "SubscriptionCreated", chave: `sub-created:${asStr(o.id) ?? eid}`,
      titulo: `Assinatura criada${t?.plano ? ` — ${t.plano}` : ""}${valor ? ` · ${valor}` : ""}${emTeste ? " (em teste)" : ""}`,
      descricao: null, valorCentavos: t?.centavos ?? null, moeda: t?.moeda ?? null,
      contexto: { status: asStr(o.status), plano: t?.plano ?? null },
    };
  }

  if (type === "customer.subscription.deleted") {
    const det = asObj(o.cancellation_details);
    const motivoRaw = asStr(det?.reason);
    const motivo = motivoRaw ? (MOTIVO_CANCELAMENTO[motivoRaw] ?? motivoRaw) : null;
    const comentario = asStr(det?.comment) ?? asStr(det?.feedback);
    return {
      ...b, tipo: "SubscriptionCanceled", chave: `sub-canceled:${asStr(o.id) ?? eid}`,
      titulo: `Assinatura cancelada${motivo ? ` — ${motivo}` : ""}`,
      descricao: comentario, valorCentavos: null, moeda: null,
      contexto: { motivo: motivoRaw, comentario },
    };
  }

  if (type === "customer.subscription.paused" || type === "customer.subscription.resumed") {
    const pausada = type.endsWith("paused");
    return {
      ...b, tipo: "SubscriptionUpdated", chave: `sub-${pausada ? "paused" : "resumed"}:${eid}`,
      titulo: pausada ? "Assinatura pausada" : "Assinatura retomada",
      descricao: null, valorCentavos: null, moeda: null, contexto: {},
    };
  }

  if (type === "customer.subscription.trial_will_end") {
    const fim = formatarData(asNum(o.trial_end));
    return {
      ...b, tipo: "SubscriptionTrialEnding", chave: `trial-will-end:${asStr(o.id) ?? eid}:${asNum(o.trial_end) ?? ""}`,
      titulo: `Período de teste termina${fim ? ` em ${fim}` : " em breve"}`,
      descricao: "Sem cartão ou forma de pagamento válida, a cobrança do primeiro ciclo pode falhar.",
      valorCentavos: null, moeda: null, contexto: { trialEnd: asNum(o.trial_end) },
    };
  }

  if (type === "customer.subscription.updated") {
    // 1) cancelamento agendado / revertido
    if ("cancel_at_period_end" in prev || "cancel_at" in prev) {
      const agora = o.cancel_at_period_end === true || asNum(o.cancel_at) != null;
      const antes = prev.cancel_at_period_end === true || (prev.cancel_at != null && prev.cancel_at !== 0);
      if (agora && !antes) {
        const quando = formatarData(asNum(o.cancel_at) ?? fimDoPeriodo(o));
        return {
          ...b, tipo: "SubscriptionCancelScheduled", chave: `sub-cancel-sched:${eid}`,
          titulo: `Cancelamento agendado${quando ? ` para ${quando}` : ""}`,
          descricao: "A assinatura segue ativa até o fim do período já pago.", valorCentavos: null, moeda: null,
          contexto: { cancelAt: asNum(o.cancel_at) },
        };
      }
      if (!agora && antes) {
        return {
          ...b, tipo: "SubscriptionUpdated", chave: `sub-cancel-reverted:${eid}`,
          titulo: "Cancelamento agendado foi desfeito", descricao: null, valorCentavos: null, moeda: null, contexto: {},
        };
      }
    }
    // 2) troca de plano / valor
    if (prev.items) {
      const novo = totalDosItens(o.items);
      const antigo = totalDosItens(prev.items);
      if (novo && antigo && novo.centavos !== antigo.centavos) {
        const sobe = novo.centavos > antigo.centavos;
        const per = INTERVALO[novo.intervalo ?? "month"] ?? novo.intervalo ?? "mês";
        return {
          ...b, tipo: sobe ? "SubscriptionUpgraded" : "SubscriptionDowngraded", chave: `sub-plan:${eid}`,
          titulo: `${sobe ? "Upgrade" : "Downgrade"} de assinatura: ${formatarValor(antigo.centavos, antigo.moeda ?? novo.moeda)} → ${formatarValor(novo.centavos, novo.moeda)}/${per}`,
          descricao: novo.plano ? `Plano: ${novo.plano}` : null, valorCentavos: novo.centavos, moeda: novo.moeda,
          contexto: { valorAnteriorCentavos: antigo.centavos, valorNovoCentavos: novo.centavos },
        };
      }
      if (novo) {
        return {
          ...b, tipo: "SubscriptionUpdated", chave: `sub-items:${eid}`,
          titulo: "Itens da assinatura alterados", descricao: novo.plano ? `Plano: ${novo.plano}` : null,
          valorCentavos: novo.centavos, moeda: novo.moeda, contexto: {},
        };
      }
    }
    // 3) mudança de status
    if (typeof prev.status === "string" && typeof o.status === "string" && prev.status !== o.status) {
      const de = STATUS_ASSINATURA[prev.status] ?? prev.status;
      const para = STATUS_ASSINATURA[o.status] ?? o.status;
      return {
        ...b, tipo: "SubscriptionUpdated", chave: `sub-status:${eid}`,
        titulo: `Assinatura: ${de} → ${para}`, descricao: null, valorCentavos: null, moeda: null,
        contexto: { de: prev.status, para: o.status },
      };
    }
    return null; // renovação de período, latest_invoice etc.: ruído
  }

  /* ── Fatura ── */
  if (type.startsWith("invoice.")) {
    const moeda = asStr(o.currency);
    const devido = asNum(o.amount_due);
    const pago = asNum(o.amount_paid);
    const iid = asStr(o.id) ?? eid;
    const venc = formatarData(asNum(o.due_date));

    if (type === "invoice.finalized" || (type === "invoice.created" && o.status !== "draft")) {
      return {
        ...b, tipo: "InvoiceIssued", chave: `invoice-issued:${iid}`,
        titulo: `Fatura emitida — ${formatarValor(devido, moeda)}${venc ? ` · vence ${venc}` : ""}`,
        descricao: asStr(o.hosted_invoice_url), valorCentavos: devido, moeda, contexto: { status: asStr(o.status) },
      };
    }
    if (type === "invoice.created") return null; // rascunho: ainda não é fato para o cliente
    if (type === "invoice.paid") {
      return {
        ...b, tipo: "InvoicePaid", chave: `invoice-paid:${iid}`,
        titulo: `Pagamento recebido — ${formatarValor(pago ?? devido, moeda)} (fatura paga)`,
        descricao: null, valorCentavos: pago ?? devido, moeda, contexto: {},
      };
    }
    if (type === "invoice.payment_failed") {
      const tent = asNum(o.attempt_count);
      const retry = asNum(o.next_payment_attempt);
      return {
        ...b, tipo: "InvoicePaymentFailed", chave: `invoice-failed:${eid}`,
        titulo: `Pagamento falhou — ${formatarValor(devido, moeda)}${tent ? ` (tentativa ${tent})` : ""}`,
        descricao: retry ? `Nova tentativa automática em ${formatarData(retry)}.` : "Sem nova tentativa automática.",
        valorCentavos: devido, moeda, contexto: { tentativa: tent },
      };
    }
    if (type === "invoice.overdue") {
      return {
        ...b, tipo: "InvoiceOverdue", chave: `invoice-overdue:${iid}`,
        titulo: `Fatura vencida — ${formatarValor(devido, moeda)}${venc ? ` · venceu em ${venc}` : ""}`,
        descricao: asStr(o.hosted_invoice_url), valorCentavos: devido, moeda, contexto: {},
      };
    }
    if (type === "invoice.payment_action_required") {
      return {
        ...b, tipo: "InvoiceActionRequired", chave: `invoice-action:${eid}`,
        titulo: `Pagamento exige ação do cliente — ${formatarValor(devido, moeda)}`,
        descricao: asStr(o.hosted_invoice_url), valorCentavos: devido, moeda, contexto: {},
      };
    }
    if (type === "invoice.voided") {
      return { ...b, tipo: "InvoiceVoided", chave: `invoice-void:${iid}`, titulo: `Fatura anulada — ${formatarValor(devido, moeda)}`, descricao: null, valorCentavos: devido, moeda, contexto: {} };
    }
    if (type === "invoice.marked_uncollectible") {
      return { ...b, tipo: "InvoiceUncollectible", chave: `invoice-uncollectible:${iid}`, titulo: `Fatura marcada como incobrável — ${formatarValor(devido, moeda)}`, descricao: null, valorCentavos: devido, moeda, contexto: {} };
    }
    return null;
  }

  /* ── Checkout avulso (sem fatura → invoice.paid não vai cobrir) ── */
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    if (o.payment_status !== "paid") return null;
    if (typeof o.invoice === "string" && o.invoice) return null; // a fatura paga já conta o fato
    const total = asNum(o.amount_total);
    return {
      ...b, tipo: "PaymentReceived", chave: `payment-received:${asStr(o.id) ?? eid}`,
      titulo: `Pagamento recebido — ${formatarValor(total, asStr(o.currency))}`,
      descricao: null, valorCentavos: total, moeda: asStr(o.currency), contexto: {},
    };
  }
  if (type === "checkout.session.async_payment_failed") {
    const total = asNum(o.amount_total);
    return {
      ...b, tipo: "PaymentFailed", chave: `payment-failed:${asStr(o.id) ?? eid}`,
      titulo: `Pagamento falhou — boleto não compensou (${formatarValor(total, asStr(o.currency))})`,
      descricao: null, valorCentavos: total, moeda: asStr(o.currency), contexto: {},
    };
  }

  /* ── Estorno ── */
  if (type === "charge.refunded") {
    const total = asNum(o.amount);
    const devolvido = asNum(o.amount_refunded);
    const parcial = devolvido != null && total != null && devolvido > 0 && devolvido < total;
    return {
      ...b, tipo: "PaymentRefunded", chave: `refund:${asStr(o.id) ?? eid}:${devolvido ?? ""}`,
      titulo: `${parcial ? "Estorno parcial" : "Estorno"} — ${formatarValor(devolvido, asStr(o.currency))}${parcial ? ` de ${formatarValor(total, asStr(o.currency))}` : ""}`,
      descricao: null, valorCentavos: devolvido, moeda: asStr(o.currency), contexto: { parcial },
    };
  }

  /* ── Forma de pagamento ── */
  if (type === "payment_method.attached" || type === "payment_method.updated" || type === "payment_method.detached") {
    const tipo: TipoFinanceiro = type.endsWith("attached") ? "PaymentMethodAttached" : type.endsWith("updated") ? "PaymentMethodUpdated" : "PaymentMethodDetached";
    const rotulo = tipo === "PaymentMethodAttached" ? "adicionada" : tipo === "PaymentMethodUpdated" ? "atualizada" : "removida";
    return {
      ...b, tipo, chave: `pm:${eid}`,
      titulo: `Forma de pagamento ${rotulo} — ${nomeDoMetodo(o)}`,
      descricao: null, valorCentavos: null, moeda: null, contexto: { metodo: asStr(o.type) },
    };
  }

  return null;
}

/* ── Recebível e pagamento ─────────────────────────────────────────────── */

export type EstadoRecebivel = "open" | "paid" | "overdue" | "uncollectible" | "void";

/**
 * Estado do recebível a partir do que a fatura é HOJE (status local + vencimento).
 * `null` = não é recebível (rascunho). É a mesma regra do backfill da migration 0113.
 */
export function estadoDoRecebivel(
  status: string | null | undefined, vencimento: Date | null | undefined, agora: Date = new Date(),
): EstadoRecebivel | null {
  switch ((status ?? "").toLowerCase()) {
    case "paga": case "paid": return "paid";
    case "void": return "void";
    case "uncollectible": return "uncollectible";
    case "aberta": case "open":
      return vencimento && vencimento.getTime() < agora.getTime() ? "overdue" : "open";
    case "falhou": case "failed": return "overdue";
    default: return null; // rascunho / desconhecido
  }
}

/** Efeito do evento sobre o recebível, quando o evento já diz tudo (não depende de reler a fatura). */
export function estadoPorEvento(type: string): EstadoRecebivel | null {
  switch (type) {
    case "invoice.paid": return "paid";
    case "invoice.overdue": return "overdue";
    case "invoice.voided": return "void";
    case "invoice.marked_uncollectible": return "uncollectible";
    default: return null;
  }
}

export type StatusPagamento = "PAID" | "FAILED" | "REFUNDED";

export interface PagamentoDoEvento {
  status: StatusPagamento;
  invoiceId: string | null;
  chargeId: string | null;
  valorCentavos: number | null;
  moeda: string | null;
  /** Chave única por provedor: a reentrega do Stripe não vira segundo pagamento. */
  idempotencyKey: string;
  externalPaymentId: string | null;
  quando: Date;
  metodo: string | null;
  /** Só no estorno: o valor da cobrança original (para achar a fatura sem o vínculo que o basil removeu). */
  valorOriginalCentavos?: number | null;
}

/**
 * Quando o evento é um pagamento (PAID/FAILED/REFUNDED), devolve o registro que `pagamentos` recebe.
 * A constraint `ck_pagamentos_status` já admite os três; até aqui só PAID era gravado (pelo backfill).
 */
export function pagamentoDoEvento(event: EventoStripe): PagamentoDoEvento | null {
  const type = event.type ?? "";
  const o = event.data?.object ?? {};
  const quando = typeof event.created === "number" ? new Date(event.created * 1000) : new Date();

  if (type === "invoice.paid") {
    const iid = asStr(o.id);
    if (!iid) return null;
    return {
      status: "PAID", invoiceId: iid, chargeId: null, valorCentavos: asNum(o.amount_paid) ?? asNum(o.amount_due),
      moeda: asStr(o.currency), idempotencyKey: `stripe:paid:${iid}`, externalPaymentId: iid,
      quando: new Date(((asNum(asObj(o.status_transitions)?.paid_at) ?? (event.created ?? Date.now() / 1000))) * 1000), metodo: null,
    };
  }
  if (type === "invoice.payment_failed") {
    const iid = asStr(o.id);
    if (!iid) return null;
    const tent = asNum(o.attempt_count) ?? 1;
    return {
      status: "FAILED", invoiceId: iid, chargeId: null, valorCentavos: asNum(o.amount_due), moeda: asStr(o.currency),
      // uma linha por TENTATIVA: o cartão pode falhar três vezes e isso é o histórico de cobrança.
      idempotencyKey: `stripe:failed:${iid}:${tent}`, externalPaymentId: null, quando, metodo: null,
    };
  }
  if (type === "charge.refunded") {
    const cid = asStr(o.id);
    if (!cid) return null;
    const devolvido = asNum(o.amount_refunded);
    return {
      status: "REFUNDED", invoiceId: typeof o.invoice === "string" ? o.invoice : null, chargeId: cid, valorCentavos: devolvido,
      moeda: asStr(o.currency), idempotencyKey: `stripe:refunded:${cid}:${devolvido ?? 0}`, externalPaymentId: null, quando,
      metodo: asStr(asObj(o.payment_method_details)?.type), valorOriginalCentavos: asNum(o.amount),
    };
  }
  return null;
}

/** Tipos de evento que o endpoint tem de ouvir para o ONFACE funcionar por inteiro. */
export const EVENTOS_ESPERADOS = [
  "invoice.paid", "invoice.payment_failed", "invoice.finalized", "invoice.updated", "invoice.voided",
  "invoice.marked_uncollectible", "invoice.created", "invoice.overdue", "invoice.payment_action_required",
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
  "customer.subscription.paused", "customer.subscription.resumed", "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired", "customer.subscription.trial_will_end",
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed",
  "checkout.session.expired", "charge.refunded", "charge.dispute.created", "charge.dispute.closed",
  "customer.updated", "payment_method.attached", "payment_method.updated", "payment_method.detached",
] as const;

/** Os 8 que faltavam no endpoint de crm.callface.io (que ouve 20). */
export const EVENTOS_NOVOS = [
  "invoice.created", "invoice.overdue", "invoice.payment_action_required", "customer.updated",
  "payment_method.attached", "payment_method.updated", "payment_method.detached",
  "customer.subscription.trial_will_end",
] as const;
