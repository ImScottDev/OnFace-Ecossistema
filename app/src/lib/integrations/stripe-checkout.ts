/**
 * Stripe Checkout — geração de link de pagamento a partir de uma proposta.
 *
 * Modelo: ASSINATURA MENSAL (subscription). A Callface vende MRR, então o
 * checkout cobra recorrente todo mês. Usa os itens `tipo='recorrente'` da
 * proposta (fallback: total_recorrente como linha única).
 *
 * Segue o padrão do `stripe-sync.ts`: API REST do Stripe via fetch (sem SDK),
 * `Authorization: Bearer ${STRIPE_API_KEY}`.
 *
 * ⚠️ A STRIPE_API_KEY hoje é restrita (rk_live, read-only p/ sync). Pra criar
 * checkout ela precisa de permissão de escrita em "Checkout Sessions". Se não
 * tiver, `createSubscriptionCheckout` lança erro com a mensagem do Stripe.
 */

const STRIPE_API = "https://api.stripe.com/v1";

export interface CheckoutItem {
  nome: string;
  /** valor unitário em reais (ex.: 499.90) */
  valorUnitario: number;
  quantidade: number;
  /** produto real do Stripe associado (do catálogo CRM); se ausente, cria ad-hoc pelo nome */
  stripeProductId?: string | null;
}

export interface CreateCheckoutParams {
  propostaId: string;
  negocioId?: string | null;
  organizacaoId: string;
  moeda: string; // BRL, USD...
  itens: CheckoutItem[];
  /** fallback quando não há itens recorrentes detalhados */
  totalRecorrente?: number;
  /**
   * Chave de idempotência do envio da proposta. Evita que duplo clique/retry
   * crie duas Checkout Sessions (e, quando ainda não há vínculo, dois Customers).
   */
  idempotencyKey?: string;
  /**
   * Customer canônico já vinculado ao lead/empresa no CRM. Quando existe, ele
   * TEM precedência sobre customerEmail: passar só o e-mail faz o Checkout
   * criar outro Customer e fragmenta assinaturas, faturas e meios de pagamento.
   */
  customerId?: string | null;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  /**
   * Vencimento do boleto em dias a partir de hoje (payment_method_options.boleto.
   * expires_after_days). Sem isso a Stripe usa o default da conta — 3 dias —
   * independente da "Validade" escolhida na proposta. Range aceito pela Stripe: 0–60.
   */
  boletoExpiresAfterDays?: number;
}

/**
 * Converte a data de validade da proposta (ex.: "2026-09-25") em dias a partir
 * de hoje pro boleto vencer junto — em vez do default fixo de 3 dias da Stripe.
 * Retorna undefined se a data já passou ou for inválida (deixa a Stripe usar o
 * default em vez de mandar um valor sem sentido tipo 0 ou negativo).
 */
export function boletoExpiresAfterDaysFromValidade(dataValidade?: string | null): number | undefined {
  if (!dataValidade) return undefined;
  const validade = new Date(`${dataValidade}T23:59:59-03:00`);
  if (Number.isNaN(validade.getTime())) return undefined;
  const dias = Math.ceil((validade.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return undefined;
  return Math.min(dias, 60);
}

export interface CheckoutResult {
  sessionId: string;
  url: string;
}

/**
 * Expira uma checkout session no Stripe (mata o link antes que o cliente pague).
 * Usado quando uma proposta já enviada é editada ou reenviada: a sessão antiga
 * fica com valores desatualizados e não pode continuar aberta. Só funciona em
 * sessões "open" — se já expirou ou foi paga, o Stripe retorna erro (ignorado
 * pelos chamadores, é best-effort).
 */
export async function expireCheckoutSession(sessionId: string): Promise<void> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada no .env");

  const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}/expire`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe expire session: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
}

/**
 * Codifica params aninhados no formato form-encoded que o Stripe espera
 * (ex.: line_items[0][price_data][product_data][name]=...).
 */
function appendNested(form: URLSearchParams, key: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => appendNested(form, `${key}[${i}]`, v));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      appendNested(form, `${key}[${k}]`, v);
    }
  } else {
    form.append(key, String(value));
  }
}

export async function createSubscriptionCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada no .env");

  const currency = (params.moeda || "BRL").toLowerCase();

  // Monta as linhas recorrentes. Se não vier nenhum item, usa o total recorrente.
  let itens = params.itens.filter((i) => i.valorUnitario > 0);
  if (itens.length === 0 && params.totalRecorrente && params.totalRecorrente > 0) {
    itens = [{ nome: "Plano Callface (mensal)", valorUnitario: params.totalRecorrente, quantidade: 1 }];
  }
  if (itens.length === 0) {
    throw new Error("Proposta sem valor recorrente para gerar assinatura");
  }

  const form = new URLSearchParams();
  form.append("mode", "subscription");
  form.append("success_url", params.successUrl);
  form.append("cancel_url", params.cancelUrl);
  // `customer` e `customer_email` são mutuamente exclusivos. Reutilizar o
  // Customer é obrigatório para toda venda posterior do mesmo cliente.
  if (params.customerId) form.append("customer", params.customerId);
  else if (params.customerEmail) form.append("customer_email", params.customerEmail);
  // payment_method_collection padrão; cartão habilitado pela conta Stripe.

  // Coleta obrigatória de dados de faturamento — sem isso a NF sai incompleta
  // (CNPJ/CPF e endereço ficam de fora) e vira risco de cancelamento pela
  // Receita. Padrão restaurado do checkout antigo (pré-CRM).
  appendNested(form, "phone_number_collection", { enabled: true });
  form.append("billing_address_collection", "required");
  appendNested(form, "name_collection", { business: { enabled: true } });
  appendNested(form, "custom_fields", [
    {
      key: "cpfcnpj",
      label: { type: "custom", custom: "CPF ou CNPJ" },
      type: "text",
      optional: false,
    },
  ]);
  if (params.boletoExpiresAfterDays) {
    appendNested(form, "payment_method_options", { boleto: { expires_after_days: params.boletoExpiresAfterDays } });
  }

  itens.forEach((item, idx) => {
    // Se o item tem produto real do Stripe (via catálogo CRM), usa o PRODUTO real
    // com preço customizado (valor da proposta, já com desconto). Senão, ad-hoc pelo nome.
    const priceData: Record<string, unknown> = {
      currency,
      unit_amount: Math.round(item.valorUnitario * 100), // centavos
      recurring: { interval: "month" },
    };
    if (item.stripeProductId) {
      priceData.product = item.stripeProductId;
    } else {
      priceData.product_data = { name: item.nome };
    }
    appendNested(form, `line_items[${idx}]`, {
      quantity: Math.max(1, Math.round(item.quantidade || 1)),
      price_data: priceData,
    });
  });

  // Metadata pra o webhook reconciliar o pagamento com a proposta/negócio.
  appendNested(form, "metadata", {
    propostaId: params.propostaId,
    negocioId: params.negocioId || "",
    organizacaoId: params.organizacaoId,
    origem: "callface-crm-proposta",
  });
  // Propaga a metadata pra subscription criada (útil no sync/reconciliação).
  appendNested(form, "subscription_data[metadata]", {
    propostaId: params.propostaId,
    negocioId: params.negocioId || "",
    organizacaoId: params.organizacaoId,
  });

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(params.idempotencyKey ? { "Idempotency-Key": params.idempotencyKey } : {}),
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe checkout: HTTP ${res.status} ${text.slice(0, 300)}`);
  }

  const session = (await res.json()) as { id: string; url: string };
  return { sessionId: session.id, url: session.url };
}

/**
 * Checkout de PAGAMENTO ÚNICO (mode=payment) — pra proposta 100% avulso/setup,
 * sem nenhum item recorrente (ex.: WHITE LABEL só com setup fee). A assinatura
 * mensal (`createSubscriptionCheckout`) exige valor recorrente pra existir;
 * esse caminho cobra os itens avulsos/setup de uma vez só.
 */
export async function createOneTimeCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada no .env");

  const currency = (params.moeda || "BRL").toLowerCase();

  const itens = params.itens.filter((i) => i.valorUnitario > 0);
  if (itens.length === 0) {
    throw new Error("Proposta sem itens avulsos para gerar checkout de pagamento único");
  }

  const form = new URLSearchParams();
  form.append("mode", "payment");
  form.append("success_url", params.successUrl);
  form.append("cancel_url", params.cancelUrl);
  // Também vale para cobranças avulsas: customer_creation=always com apenas
  // e-mail cria um Customer novo; com `customer` ela fica no cadastro canônico.
  if (params.customerId) form.append("customer", params.customerId);
  else if (params.customerEmail) form.append("customer_email", params.customerEmail);
  // mode=payment não cria Customer sozinho (diferente de subscription) — sem isso
  // não teria stripeCustomerId pra ligar no lead nem pra gravar CPF/CNPJ da NF.
  // A Stripe não aceita customer_creation junto com um Customer explícito.
  if (!params.customerId) form.append("customer_creation", "always");

  appendNested(form, "phone_number_collection", { enabled: true });
  form.append("billing_address_collection", "required");
  appendNested(form, "name_collection", { business: { enabled: true } });
  appendNested(form, "custom_fields", [
    {
      key: "cpfcnpj",
      label: { type: "custom", custom: "CPF ou CNPJ" },
      type: "text",
      optional: false,
    },
  ]);
  if (params.boletoExpiresAfterDays) {
    appendNested(form, "payment_method_options", { boleto: { expires_after_days: params.boletoExpiresAfterDays } });
  }

  itens.forEach((item, idx) => {
    const priceData: Record<string, unknown> = {
      currency,
      unit_amount: Math.round(item.valorUnitario * 100),
    };
    if (item.stripeProductId) {
      priceData.product = item.stripeProductId;
    } else {
      priceData.product_data = { name: item.nome };
    }
    appendNested(form, `line_items[${idx}]`, {
      quantity: Math.max(1, Math.round(item.quantidade || 1)),
      price_data: priceData,
    });
  });

  appendNested(form, "metadata", {
    propostaId: params.propostaId,
    negocioId: params.negocioId || "",
    organizacaoId: params.organizacaoId,
    origem: "callface-crm-proposta",
  });

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(params.idempotencyKey ? { "Idempotency-Key": params.idempotencyKey } : {}),
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe checkout: HTTP ${res.status} ${text.slice(0, 300)}`);
  }

  const session = (await res.json()) as { id: string; url: string };
  return { sessionId: session.id, url: session.url };
}
