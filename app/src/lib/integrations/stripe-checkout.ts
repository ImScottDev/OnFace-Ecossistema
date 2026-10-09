/**
 * Stripe Checkout da 2C.2.
 *
 * O CRM envia somente Prices oficiais do catálogo. Desconto negociado é
 * aplicado como Coupon de uso único na sessão, nunca como Product/Price novo.
 * Em desenvolvimento, sem chave de teste, o módulo entra em mock explícito e
 * não faz nenhuma chamada externa.
 */

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || "2026-08-26.dahlia";

export type StripeCheckoutMode = "mock" | "test" | "live";

function keyFromEnv(): string | null {
  return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || null;
}

export function getStripeCheckoutMode(): StripeCheckoutMode {
  const explicit = process.env.STRIPE_CHECKOUT_MODE;
  const key = keyFromEnv();

  if (explicit === "mock") return "mock";
  if (explicit === "live") {
    if (process.env.NODE_ENV !== "production" || process.env.ALLOW_STRIPE_LIVE_CHECKOUT !== "true") {
      throw new Error("Checkout live bloqueado: exige produção e ALLOW_STRIPE_LIVE_CHECKOUT=true.");
    }
    return "live";
  }

  if (!key) return "mock";
  if (key.includes("_live_")) throw new Error("Chave Stripe live detectada fora do checkout live explicitamente habilitado.");
  if (!key.includes("_test_")) throw new Error("A chave Stripe precisa ser uma chave test para Checkout local.");
  return "test";
}

export function isStripeMockMode(): boolean {
  return getStripeCheckoutMode() === "mock";
}

function stripeKey(): string {
  const key = keyFromEnv();
  if (!key) throw new Error("STRIPE_SECRET_KEY ou STRIPE_API_KEY não configurada");
  return key;
}

function stableIdempotencyKey(prefix: string): string {
  return prefix.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 255);
}

async function stripePost<T>(path: string, form: URLSearchParams, opts: { idempotencyKey?: string } = {}): Promise<T> {
  const response = await fetch(`${STRIPE_API}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: form.toString(),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Stripe ${path}: HTTP ${response.status} ${body.slice(0, 400)}`);
  }
  return response.json() as Promise<T>;
}

async function stripeGet<T>(path: string): Promise<T> {
  const response = await fetch(`${STRIPE_API}/${path}`, {
    headers: { Authorization: `Bearer ${stripeKey()}`, "Stripe-Version": STRIPE_API_VERSION },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Stripe ${path}: HTTP ${response.status} ${body.slice(0, 400)}`);
  }
  return response.json() as Promise<T>;
}

export interface StripeCustomerParams {
  customerId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: { line1?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null };
  metadata: Record<string, string>;
}

/**
 * Procura um Customer que já exista no Stripe para este e-mail.
 *
 * Por que `customers?email=` e NÃO `customers/search`: o list é consistente na
 * hora, e o search tem indexação atrasada — normalmente menos de um minuto, mas
 * a própria documentação avisa que em incidente pode ficar até uma hora para
 * trás. Num fluxo que acabou de criar o cliente, o search devolveria vazio e a
 * gente criaria a duplicata que ele deveria evitar.
 *
 * O filtro é exato e sensível a maiúscula, então o e-mail é normalizado antes.
 * Devolve `null` quando não acha, quando não há e-mail, ou quando a busca
 * falha — nunca derruba o checkout por causa disto.
 */
async function acharCustomerPorEmail(email: string | null | undefined): Promise<string | null> {
  const alvo = email?.trim().toLowerCase();
  if (!alvo) return null;
  try {
    const r = await stripeGet<{ data: { id: string; email: string | null; deleted?: boolean }[] }>(
      `customers?limit=100&email=${encodeURIComponent(alvo)}`,
    );
    /* Mais de um resultado significa que a duplicata já existe. Pega o primeiro
       não apagado, que é o mais antigo — assim duas rodadas convergem para o
       MESMO cliente em vez de alternarem. */
    const achado = (r.data ?? []).filter((c) => !c.deleted).at(-1);
    return achado?.id ?? null;
  } catch {
    return null;
  }
}

export async function createStripeCustomer(params: StripeCustomerParams): Promise<{ id: string; mocked: boolean }> {
  const mode = getStripeCheckoutMode();
  if (params.customerId) return { id: params.customerId, mocked: mode === "mock" };
  if (mode === "mock") {
    return { id: `cus_mock_${params.metadata.crm_company_id || params.metadata.crm_lead_id || "billing"}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80), mocked: true };
  }

  /* Antes de criar, procura. O CRM já tenta reaproveitar o id que tem gravado
     (lib/crm/checkout.ts), mas isso só cobre quem o CRM criou: cliente que já
     existia no Stripe antes, ou criado por outro caminho, passava direto e
     virava duplicata. A chave de idempotência não cobre esse caso porque o
     Stripe só a guarda por 24 h — a segunda proposta no dia seguinte criava
     outro cliente. Medido em 01/10: 30 empresas com mais de um customer. */
  const existente = await acharCustomerPorEmail(params.email);
  if (existente) return { id: existente, mocked: false };

  const form = new URLSearchParams();
  form.append("name", params.name.slice(0, 250));
  if (params.email) form.append("email", params.email);
  if (params.phone) form.append("phone", params.phone);
  if (params.address?.line1) form.append("address[line1]", params.address.line1);
  if (params.address?.city) form.append("address[city]", params.address.city);
  if (params.address?.state) form.append("address[state]", params.address.state);
  if (params.address?.postalCode) form.append("address[postal_code]", params.address.postalCode);
  if (params.address?.country) form.append("address[country]", params.address.country);
  for (const [key, value] of Object.entries(params.metadata)) form.append(`metadata[${key}]`, value.slice(0, 500));
  const customer = await stripePost<{ id: string }>("customers", form, { idempotencyKey: stableIdempotencyKey(`crm-customer-${params.metadata.crm_company_id || params.metadata.crm_lead_id || "billing"}`) });
  return { id: customer.id, mocked: false };
}

export interface CheckoutItem {
  nome: string;
  quantidade: number;
  /** Valor final negociado por unidade, já sem desconto percentual/nominal. */
  valorUnitario: number;
  /** Valor oficial de tabela por unidade. */
  valorTabela: number;
  stripePriceId: string;
  stripeProductId?: string | null;
  moeda: string;
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

/** Compatibilidade com os providers legados de billing. */
export interface CheckoutResult {
  sessionId: string;
  url: string;
}

export interface CreateGroupCheckoutParams {
  propostaId: string;
  negocioId?: string | null;
  grupoComercialId: string;
  organizacaoId: string;
  moeda: string;
  itensRecorrentes: CheckoutItem[];
  itensAvulsos: CheckoutItem[];
  customerId: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  /** Identifica uma nova tentativa depois que a sessão anterior foi expirada. */
  attemptKey?: string;
  /**
   * Vencimento do boleto em dias a partir de hoje (payment_method_options.boleto.
   * expires_after_days). Sem isso a Stripe usa o default da conta — 3 dias —
   * independente da "Validade" escolhida na proposta. Range aceito pela Stripe: 0–60.
   */
  boletoExpiresAfterDays?: number;
  /** Dias de teste antes da primeira cobrança. Ausente ou 0 = sem teste. */
  trialDias?: number | null;
}

function appendNested(form: URLSearchParams, key: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendNested(form, `${key}[${index}]`, item));
    return;
  }
  if (typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) appendNested(form, `${key}[${childKey}]`, childValue);
    return;
  }
  form.append(key, String(value));
}

function appendMetadata(form: URLSearchParams, metadata: Record<string, string>): void {
  for (const [key, value] of Object.entries(metadata)) form.append(`metadata[${key}]`, String(value).slice(0, 500));
}

function amountInCents(value: number): number {
  return Math.max(0, Math.round(value * 100));
}

function discountTotal(items: CheckoutItem[]): number {
  return items.reduce((total, item) => {
    const quantity = Math.max(1, Math.round(item.quantidade || 1));
    return total + Math.max(0, item.valorTabela * quantity - item.valorUnitario * quantity);
  }, 0);
}

/**
 * `attemptKey` entra na chave de idempotência DE PROPÓSITO.
 *
 * A chave era só `crm-coupon-<grupo>`. Como o Stripe guarda o resultado da
 * primeira chamada por 24 h, re-gerar o checkout do mesmo grupo com um desconto
 * RENEGOCIADO fazia ele devolver o cupom antigo — e o cliente pagava o desconto
 * errado, sem erro nenhum aparecer. O valor também entra na chave: dois
 * descontos diferentes nunca podem compartilhar cupom.
 */
async function createOneTimeCoupon(amount: number, currency: string, metadata: Record<string, string>, attemptKey: string): Promise<string | null> {
  if (amount <= 0) return null;
  const form = new URLSearchParams();
  form.append("amount_off", String(amountInCents(amount)));
  form.append("currency", currency.toLowerCase());
  form.append("duration", "once");
  appendMetadata(form, { ...metadata, crm_discount_type: "proposal_negotiated_discount" });
  const coupon = await stripePost<{ id: string }>("coupons", form, { idempotencyKey: stableIdempotencyKey(`crm-coupon-${metadata.crm_group_id || "group"}-${attemptKey}-${amountInCents(amount)}`) });
  return coupon.id;
}

/**
 * As linhas que vão para o Stripe: uma por Price, com as quantidades somadas.
 *
 * A proposta pode ter o mesmo Price em várias linhas (o mesmo produto lançado
 * três vezes, cada uma com sua quantidade e seu desconto). O Price já carrega o
 * valor unitário, então juntar as quantidades cobra o mesmo total, e o
 * desconto negociado não se perde: ele sai do cupom, calculado linha a linha
 * ANTES de juntar. A ordem é a da primeira aparição de cada Price.
 */
export function linhasDoCheckout(itens: CheckoutItem[]): Array<{ stripePriceId: string; quantidade: number }> {
  const porPrice = new Map<string, number>();
  for (const item of itens) {
    if (!item.stripePriceId) throw new Error(`Item '${item.nome}' não tem stripe_price_id oficial.`);
    porPrice.set(item.stripePriceId, (porPrice.get(item.stripePriceId) ?? 0) + Math.max(1, Math.round(item.quantidade || 1)));
  }
  return [...porPrice].map(([stripePriceId, quantidade]) => ({ stripePriceId, quantidade }));
}

export async function createGroupCheckout(params: CreateGroupCheckoutParams): Promise<{ sessionId: string; url: string; mocked: boolean }> {
  const mode = getStripeCheckoutMode();
  const recorrentes = params.itensRecorrentes.filter((item) => item.valorUnitario > 0);
  const avulsos = params.itensAvulsos.filter((item) => item.valorUnitario > 0);
  const allItems = [...recorrentes, ...avulsos];
  if (allItems.length === 0) throw new Error("Grupo comercial sem itens com valor para gerar checkout");
  if (allItems.some((item) => item.moeda.toUpperCase() !== params.moeda.toUpperCase())) throw new Error("A moeda de um Price oficial não coincide com a moeda da proposta.");

  const stripeMode = recorrentes.length > 0 ? "subscription" : "payment";
  const metadata = {
    ...params.metadata,
    crm_proposal_id: params.propostaId,
    crm_group_id: params.grupoComercialId,
    // `crm_opportunity_id` é o ID da oportunidade v2 quando o helper já o
    // resolveu. O negócio legado só é fallback, nunca substituição silenciosa.
    crm_opportunity_id: params.metadata.crm_opportunity_id || params.negocioId || "",
  };
  const discount = discountTotal(allItems);

  if (mode === "mock") {
    return { sessionId: `cs_test_mock_${params.grupoComercialId.replace(/-/g, "")}`, url: `mock://stripe-checkout/${params.grupoComercialId}`, mocked: true };
  }

  const form = new URLSearchParams();
  form.append("mode", stripeMode);
  form.append("customer", params.customerId);
  form.append("success_url", params.successUrl);
  form.append("cancel_url", params.cancelUrl);
  form.append("billing_address_collection", "required");
  appendNested(form, "phone_number_collection", { enabled: true });
  appendNested(form, "tax_id_collection", { enabled: true });
  appendNested(form, "name_collection", { business: { enabled: true }, individual: { enabled: true } });
  // Stripe Checkout aceita atualização automática de nome/endereço do Customer,
  // mas não expõe `customer_update[phone]`. O telefone continua coletado na
  // sessão acima e o webhook preenche o CRM sem invalidar a criação do checkout.
  appendNested(form, "customer_update", { name: "auto", address: "auto" });
  appendNested(form, "custom_fields", [{ key: "cpfcnpj", label: { type: "custom", custom: "CPF ou CNPJ" }, type: "text", optional: false }]);
  // Sem isso a Stripe usa o default da conta pro boleto (3 dias) e ignora a
  // "Validade" da proposta — fix de produção a4ef701. Vale pra assinatura e
  // pra pagamento único.
  if (params.boletoExpiresAfterDays) {
    appendNested(form, "payment_method_options", { boleto: { expires_after_days: params.boletoExpiresAfterDays } });
  }
  appendMetadata(form, metadata);
  /* `integration_identifier` saiu daqui.
   *
   * Ele carregava um sufixo ALEATÓRIO no corpo, enquanto a chave de
   * idempotência logo abaixo é determinística. O Stripe recusa a mesma chave
   * com corpo diferente — então retentar a criação do checkout do mesmo grupo
   * dentro de 24 h falhava POR CONSTRUÇÃO, justo quando mais importa (rede
   * instável, timeout). O campo também não é parâmetro documentado de Checkout
   * Session. Quem identifica a origem é a metadata `crm_*`, que já vai acima. */

  /* Recorrente e avulso nunca dividem Price (o Price é de um tipo só), então juntar por Price em cada
     lista dá o mesmo resultado que juntar tudo; a ordem (recorrentes primeiro) fica como era. */
  [...linhasDoCheckout(recorrentes), ...linhasDoCheckout(avulsos)].forEach((linha, index) => {
    form.append(`line_items[${index}][price]`, linha.stripePriceId);
    form.append(`line_items[${index}][quantity]`, String(linha.quantidade));
  });

  const couponId = await createOneTimeCoupon(discount, params.moeda, metadata, params.attemptKey || "initial");
  if (couponId) appendNested(form, "discounts", [{ coupon: couponId }]);
  if (stripeMode === "subscription") {
    /* Período de teste, quando o vendedor marcou na proposta.
     *
     * O cartão CONTINUA sendo coletado (o default do Checkout em modo
     * subscription é `payment_method_collection=always`): o cliente cadastra
     * agora e a primeira cobrança só sai no fim do teste. Deixar de coletar
     * daria um teste que termina sem forma de pagamento e morre em cobrança
     * falha.
     *
     * `missing_payment_method=cancel` é a rede de segurança para o caso raro
     * de a forma de pagamento sumir no meio: melhor a assinatura encerrar do
     * que virar fatura vencida que ninguém vai pagar.
     *
     * O teto de 730 é o limite do Stripe; o piso de 1 evita `trial=0`, que
     * ele recusa. */
    const dias = Math.trunc(params.trialDias ?? 0);
    const trial = dias > 0 ? Math.min(730, Math.max(1, dias)) : 0;
    appendNested(form, "subscription_data", {
      metadata,
      ...(trial
        ? {
            trial_period_days: trial,
            trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
          }
        : {}),
    });
  }
  if (stripeMode === "payment") {
    appendNested(form, "payment_intent_data", { metadata });
    appendNested(form, "invoice_creation", { enabled: true, invoice_data: { metadata } });
  }

  const session = await stripePost<{ id: string; url: string }>("checkout/sessions", form, { idempotencyKey: stableIdempotencyKey(`crm-session-${params.grupoComercialId}-${params.attemptKey || "initial"}`) });
  return { sessionId: session.id, url: session.url, mocked: false };
}

export async function expireCheckoutSession(sessionId: string): Promise<void> {
  if (getStripeCheckoutMode() === "mock") return;
  await stripePost(`checkout/sessions/${sessionId}/expire`, new URLSearchParams());
}

export async function retrieveCheckoutSession(sessionId: string): Promise<{ id: string; status?: string; payment_status?: string; customer?: string | null } | null> {
  if (getStripeCheckoutMode() === "mock") return { id: sessionId, status: "open", payment_status: "unpaid" };
  return stripeGet(`checkout/sessions/${sessionId}`);
}
