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

function randomSuffix(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += letters[Math.floor(Math.random() * letters.length)];
  return suffix;
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

export async function createStripeCustomer(params: StripeCustomerParams): Promise<{ id: string; mocked: boolean }> {
  const mode = getStripeCheckoutMode();
  if (params.customerId) return { id: params.customerId, mocked: mode === "mock" };
  if (mode === "mock") {
    return { id: `cus_mock_${params.metadata.crm_company_id || params.metadata.crm_lead_id || "billing"}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80), mocked: true };
  }

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

async function createOneTimeCoupon(amount: number, currency: string, metadata: Record<string, string>): Promise<string | null> {
  if (amount <= 0) return null;
  const form = new URLSearchParams();
  form.append("amount_off", String(amountInCents(amount)));
  form.append("currency", currency.toLowerCase());
  form.append("duration", "once");
  appendMetadata(form, { ...metadata, crm_discount_type: "proposal_negotiated_discount" });
  const coupon = await stripePost<{ id: string }>("coupons", form, { idempotencyKey: stableIdempotencyKey(`crm-coupon-${metadata.crm_group_id || "group"}`) });
  return coupon.id;
}

function appendOfficialLineItem(form: URLSearchParams, index: number, item: CheckoutItem): void {
  if (!item.stripePriceId) throw new Error(`Item '${item.nome}' não tem stripe_price_id oficial.`);
  form.append(`line_items[${index}][price]`, item.stripePriceId);
  form.append(`line_items[${index}][quantity]`, String(Math.max(1, Math.round(item.quantidade || 1))));
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
  appendNested(form, "customer_update", { name: "auto", address: "auto", phone: "auto" });
  appendNested(form, "custom_fields", [{ key: "cpfcnpj", label: { type: "custom", custom: "CPF ou CNPJ" }, type: "text", optional: false }]);
  // Sem isso a Stripe usa o default da conta pro boleto (3 dias) e ignora a
  // "Validade" da proposta — fix de produção a4ef701. Vale pra assinatura e
  // pra pagamento único.
  if (params.boletoExpiresAfterDays) {
    appendNested(form, "payment_method_options", { boleto: { expires_after_days: params.boletoExpiresAfterDays } });
  }
  appendMetadata(form, metadata);
  form.append("integration_identifier", `callface_crm_${randomSuffix()}`);

  let index = 0;
  for (const item of recorrentes) appendOfficialLineItem(form, index++, item);
  for (const item of avulsos) appendOfficialLineItem(form, index++, item);

  const couponId = await createOneTimeCoupon(discount, params.moeda, metadata);
  if (couponId) appendNested(form, "discounts", [{ coupon: couponId }]);
  if (stripeMode === "subscription") appendNested(form, "subscription_data", { metadata });
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
