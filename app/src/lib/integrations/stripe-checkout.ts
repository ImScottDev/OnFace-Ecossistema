import { fetchComPrazo } from "@/lib/rede/fetch-com-prazo";
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
  const response = await fetchComPrazo(`${STRIPE_API}/${path}`, {
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
  const response = await fetchComPrazo(`${STRIPE_API}/${path}`, {
    headers: { Authorization: `Bearer ${stripeKey()}`, "Stripe-Version": STRIPE_API_VERSION },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Stripe ${path}: HTTP ${response.status} ${body.slice(0, 400)}`);
  }
  return response.json() as Promise<T>;
}

export interface StripeCustomerParams {
  /** Ignorado: o Customer vem do banco/Stripe pelo resolver canônico, nunca de um id solto do chamador. */
  customerId?: string | null;
  /** Organização, empresa e contato; quando ausentes saem da metadata (`crm_organization_id`, `crm_company_id`, `crm_lead_id`). */
  organizacaoId?: string | null;
  empresaId?: string | null;
  leadId?: string | null;
  cnpj?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: { line1?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null };
  metadata: Record<string, string>;
}

/**
 * O Customer do Stripe para cobrar esta empresa.
 *
 * Não resolve nada sozinho: delega a `garantirCustomerDaEmpresa`
 * (stripe-customer.ts), o ÚNICO resolver — vínculo no banco, depois metadata,
 * CNPJ e e-mail no Stripe (sem nunca pegar Customer do SaaS Callface, que divide
 * esta conta), e só então cria, sob trava por empresa. Antes esta função
 * buscava só por e-mail e podia cobrar um Customer do SaaS ou duplicar o da
 * empresa (37 empresas com mais de um Customer).
 *
 * O import é dinâmico de propósito: stripe-customer.ts importa deste arquivo
 * (`getStripeCheckoutMode`) e o banco não deve entrar em quem só quer o modo.
 */
export async function createStripeCustomer(params: StripeCustomerParams): Promise<{ id: string; mocked: boolean }> {
  const organizacaoId = params.organizacaoId || params.metadata.crm_organization_id || params.metadata.organizacaoId;
  if (!organizacaoId) throw new Error("Customer do Stripe sem organização: o vínculo é sempre por organização.");
  const { garantirCustomerDaEmpresa } = await import("./stripe-customer");
  const r = await garantirCustomerDaEmpresa({
    organizacaoId,
    empresaId: params.empresaId || params.metadata.crm_company_id || params.metadata.empresaId || null,
    leadId: params.leadId || params.metadata.crm_lead_id || null,
    nome: params.name,
    email: params.email,
    cnpj: params.cnpj,
    telefone: params.phone,
    endereco: params.address,
    metadata: params.metadata,
  });
  for (const aviso of r.avisos) console.warn(`[stripe-customer] ${aviso}`);
  return { id: r.id, mocked: r.mocked };
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
  /**
   * Prazo, em meses, do desconto sobre a mensalidade, quando o vendedor marcou
   * "desconto com prazo" na proposta. Ausente ou 0 = o preço negociado vale
   * enquanto a assinatura durar. Ver `duracaoDoDescontoRecorrente`.
   */
  descontoRecorrenteMeses?: number | null;
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
export type DuracaoCupom =
  | { duration: "once" }
  | { duration: "forever" }
  | { duration: "repeating"; duration_in_months: number };

/**
 * Quanto tempo o desconto de um item RECORRENTE dura no Stripe.
 *
 * `once` aqui é cobrança errada, e silenciosa: o Stripe desconta só a primeira
 * fatura e cobra o preço de tabela de todas as outras. Medido na proposta
 * #1570 (LIVA, 23/10/2026) — vendida a R$ 719,40/mês com contrato de 24 meses
 * assinado, o checkout cobraria R$ 1.079,40 a partir do 2º mês, R$ 360 a mais
 * por mês, sem erro nenhum aparecer em lugar nenhum.
 *
 * O preço negociado de um recorrente vale enquanto a assinatura valer:
 * `forever`. Só tem prazo quando o vendedor marcou "desconto com prazo" na
 * proposta — e aí o prazo é o que ele marcou.
 */
export function duracaoDoDescontoRecorrente(meses: number | null | undefined): DuracaoCupom {
  const n = Math.trunc(meses ?? 0);
  return n > 0 ? { duration: "repeating", duration_in_months: n } : { duration: "forever" };
}

async function createCoupon(amount: number, currency: string, metadata: Record<string, string>, attemptKey: string, duracao: DuracaoCupom): Promise<string | null> {
  if (amount <= 0) return null;
  const form = new URLSearchParams();
  form.append("amount_off", String(amountInCents(amount)));
  form.append("currency", currency.toLowerCase());
  for (const [chave, valor] of Object.entries(duracao)) form.append(chave, String(valor));
  appendMetadata(form, { ...metadata, crm_discount_type: "proposal_negotiated_discount" });
  // A duração entra na chave: um cupom `once` já criado não pode ser devolvido
  // no lugar do `forever` só porque o valor bate.
  const assinatura = "duration_in_months" in duracao ? `${duracao.duration}-${duracao.duration_in_months}` : duracao.duration;
  const coupon = await stripePost<{ id: string }>("coupons", form, { idempotencyKey: stableIdempotencyKey(`crm-coupon-${metadata.crm_group_id || "group"}-${attemptKey}-${amountInCents(amount)}-${assinatura}`) });
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
  const negocioId = params.metadata.crm_negocio_id || params.metadata.negocioId || params.negocioId || "";
  const empresaId = params.metadata.crm_company_id || params.metadata.empresaId || "";
  /* Metadata de identidade nas DUAS grafias (definição §13): `organizacaoId`,
     `empresaId`, `negocioId`, `propostaId` e os `crm_*` que a reconciliação já lê.
     Chave sem valor não entra — string vazia APAGA a chave no Stripe. */
  const metadata: Record<string, string> = {
    ...params.metadata,
    crm_proposal_id: params.propostaId,
    crm_group_id: params.grupoComercialId,
    organizacaoId: params.organizacaoId,
    propostaId: params.propostaId,
    // O sync de MRR lê `crm_negocio_id`; antes só `crm_opportunity_id` ia (com o
    // negócio dentro quando não havia oportunidade). Emite os dois: a oportunidade
    // v2 quando existe, o negócio legado como fallback, e o negócio na sua chave.
    crm_opportunity_id: params.metadata.crm_opportunity_id || params.negocioId || "",
    ...(negocioId ? { crm_negocio_id: negocioId, negocioId } : {}),
    ...(empresaId ? { empresaId } : {}),
  };
  /* Recorrente e avulso têm durações de desconto diferentes, e uma Checkout
     Session aceita UM cupom só. Separar é o que impede o desconto do setup de
     virar desconto eterno na mensalidade (e vice-versa). Nenhuma proposta da
     base tem desconto nos dois ao mesmo tempo; se aparecer, é melhor recusar
     com o caminho manual do que cobrar errado calado. */
  const descontoRecorrente = discountTotal(recorrentes);
  const descontoAvulso = discountTotal(avulsos);
  if (descontoRecorrente > 0 && descontoAvulso > 0) {
    throw new Error("Esta proposta tem desconto no item recorrente E no avulso. O Stripe aceita um cupom por checkout, e os dois precisam de durações diferentes — concentre o desconto em um dos dois ou cobre o setup à parte.");
  }

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
  /* Pix: a conta da Callface é brasileira, e lá o Pix só existe em pagamento
     ÚNICO (Pix Automático não está disponível no Brasil). Em modo subscription
     o Stripe simplesmente não oferece Pix, e não passamos `payment_method_types`
     de propósito: a lista dinâmica da conta decide. O QR vale 24 h (o default
     de 4 h vence antes de o cliente do financeiro pagar). */
  if (stripeMode === "payment") appendNested(form, "payment_method_options", { pix: { expires_after_seconds: 86400 } });
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

  const couponId = descontoRecorrente > 0
    ? await createCoupon(descontoRecorrente, params.moeda, metadata, params.attemptKey || "initial", duracaoDoDescontoRecorrente(params.descontoRecorrenteMeses))
    : await createCoupon(descontoAvulso, params.moeda, metadata, params.attemptKey || "initial", { duration: "once" });
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

/**
 * Assinatura FATURADA — o caminho de quem vende por contrato.
 *
 * Callface AI, PABX e White Label por contrato são pós-pagos: o contrato
 * assinado é a evidência de fechamento, o serviço é ativado, e a mensalidade
 * é faturada por boleto no dia combinado. Antes disto esse caminho não
 * existia — o contrato assinado gerava um Checkout Session PRÉ-PAGO, isto é,
 * o cliente tinha que pagar antes para a assinatura nascer, contradizendo o
 * próprio contrato que ele acabara de assinar.
 *
 * Medido em 23/10/2026: as sete propostas por contrato da base TÊM o dia de
 * vencimento combinado (`dia_vencimento_mes`: 17, 20, 20, 30...), ele sai
 * escrito no contrato ("Mensalidade com vencimento todo dia 20") e nunca
 * chegava ao Stripe. Dos dois contratos assinados, ZERO viraram assinatura.
 *
 * Mecânica (decisões do Scott, 23/10/2026):
 *  - `collection_method=send_invoice`: o Stripe emite a fatura e manda o
 *    boleto, em vez de debitar um cartão que o cliente nunca cadastrou.
 *  - `billing_cycle_anchor_config[day_of_month]`: o ciclo vira no dia
 *    combinado, todo mês, para sempre.
 *  - `proration_behavior=none`: o pedaço quebrado entre a vigência e o
 *    primeiro vencimento NÃO é cobrado. A primeira fatura é um MÊS CHEIO, com
 *    o mesmo valor de todas as outras — é o que o contrato diz e o que o
 *    financeiro consegue conferir.
 *
 * Setup/implantação não entra aqui: vai em boleto separado, emitido na
 * assinatura do contrato (`criarCobrancaAvulsa`).
 */
export async function createFaturadaSubscription(params: CreateGroupCheckoutParams & {
  /** Dia do mês do vencimento, combinado na proposta. */
  diaVencimentoMes?: number | null;
  /** Quando o primeiro ciclo começa: a próxima ocorrência do dia combinado. */
  inicioDoCiclo?: Date | null;
  /** Dias para pagar depois que a fatura é emitida. 0 = vence no próprio dia do ciclo. */
  diasParaPagar?: number | null;
}): Promise<{ subscriptionId: string; faturaId: string | null; faturaUrl: string | null; mocked: boolean }> {
  const mode = getStripeCheckoutMode();
  const recorrentes = params.itensRecorrentes.filter((item) => item.valorUnitario > 0);
  if (recorrentes.length === 0) throw new Error("Assinatura faturada exige ao menos um item recorrente.");
  if (recorrentes.some((item) => item.moeda.toUpperCase() !== params.moeda.toUpperCase())) {
    throw new Error("A moeda de um Price oficial não coincide com a moeda da proposta.");
  }

  if (mode === "mock") {
    return { subscriptionId: `sub_mock_${params.grupoComercialId.replace(/-/g, "")}`, faturaId: null, faturaUrl: null, mocked: true };
  }

  const form = new URLSearchParams();
  form.append("customer", params.customerId);
  form.append("collection_method", "send_invoice");
  /* Antecedência: a fatura é emitida quando o ciclo abre e vence `days_until_due`
     dias depois. Trinta dias é o que faz o boleto existir cedo o bastante para
     ser registrado e APARECER NO DDA do cliente — boleto emitido no dia do
     vencimento não aparece em DDA nenhum, chega como cobrança de última hora.
     Também é o que torna a venda pós-paga de verdade: o cliente usa o mês e
     paga no fim dele, no dia combinado. */
  const diasParaPagar = Math.min(60, Math.max(1, Math.trunc(params.diasParaPagar || 30)));
  form.append("days_until_due", String(diasParaPagar));
  // Sem o pedaço quebrado: a primeira fatura é um mês cheio, como o contrato diz.
  form.append("proration_behavior", "none");
  /* Boleto e cartão nas faturas desta assinatura.
     `payment_method_options[boleto]` NÃO existe aqui: o Stripe recusa com
     `parameter_unknown` (medido em produção, 23/10/2026, ativando a
     assinatura da LIVA). Esse campo é de Checkout Session, e eu o trouxe de
     um para o outro sem conferir.
     A validade da guia é a configurada na conta (Dashboard › Formas de
     pagamento › Boleto) e conta a partir de quando o cliente gera o boleto na
     fatura, não da emissão dela — por isso não precisa cobrir os 30 dias de
     antecedência. */
  appendNested(form, "payment_settings", { payment_method_types: ["boleto", "card"] });
  /* O ciclo começa na PRÓXIMA ocorrência do dia combinado, e o trecho entre a
     ativação e essa data não é cobrado.
     `billing_cycle_anchor_config` sozinho não resolvia: ele ancora o ciclo no
     dia certo, mas o primeiro período — da ativação até a âncora — continuava
     sendo faturado como mês cheio. Na LIVA seriam R$ 719,40 por sete dias.
     `trial_end` na mesma data não cobra esse trecho E ancora o ciclo ali, que
     é o que "mês cheio, vencendo no dia combinado" quer dizer. */
  if (params.inicioDoCiclo) {
    form.append("trial_end", String(Math.floor(params.inicioDoCiclo.getTime() / 1000)));
    // Sem forma de pagamento salva no fim do teste a assinatura seria cancelada;
    // aqui o pagamento é boleto por fatura, então ela segue e o Stripe fatura.
    form.append("trial_settings[end_behavior][missing_payment_method]", "create_invoice");
  }

  /* O preço NEGOCIADO vai no item, não num cupom à parte.
   *
   * Usar o Price de tabela e jogar a diferença num cupom fecha o total da
   * fatura, mas mente para todo o resto: o item da assinatura fica com o valor
   * cheio, e quem lê a assinatura — o MRR, o serviço canônico, o Cliente 360,
   * a própria tela do Stripe e a linha que o cliente vê na fatura — enxerga o
   * preço de tabela. Medido na LIVA (23/10/2026): contrato de R$ 719,40/mês,
   * assinatura mostrando "6 × R$ 179,90 = R$ 1.079,40", serviço canônico
   * gravado com R$ 1.079,40 e o Cliente 360 somando R$ 2.159 de MRR.
   *
   * `price_data` cria o preço desta venda sobre o MESMO produto oficial do
   * catálogo — o produto continua sendo o do catálogo, e o valor continua
   * conferido contra a tabela antes de chegar aqui (`mapItem` recusa item
   * acima do Price oficial). */
  recorrentes.forEach((item, i) => {
    if (!item.stripeProductId) throw new Error(`Item '${item.nome}' não tem produto oficial no Stripe.`);
    form.append(`items[${i}][price_data][product]`, item.stripeProductId);
    form.append(`items[${i}][price_data][currency]`, params.moeda.toLowerCase());
    form.append(`items[${i}][price_data][unit_amount]`, String(amountInCents(item.valorUnitario)));
    form.append(`items[${i}][price_data][recurring][interval]`, "month");
    form.append(`items[${i}][quantity]`, String(item.quantidade));
  });

  /* Aqui NÃO entra cupom: o desconto já está no preço do item, acima. Cupom
     por cima do preço negociado descontaria duas vezes.
     O desconto COM PRAZO (`descontoRecorrenteMeses`) continua precisando de
     cupom, porque é temporário por natureza — e aí ele incide sobre o preço
     já negociado, pelos meses combinados. */
  const metadata: Record<string, string> = {
    ...params.metadata,
    crm_proposal_id: params.propostaId,
    crm_group_id: params.grupoComercialId,
    organizacaoId: params.organizacaoId,
    propostaId: params.propostaId,
    crm_billing_mode: "pos_pago_contrato",
    ...(params.negocioId ? { crm_negocio_id: params.negocioId, negocioId: params.negocioId } : {}),
  };
  const mesesDeDesconto = Math.trunc(params.descontoRecorrenteMeses ?? 0);
  if (mesesDeDesconto > 0) {
    const temporario = discountTotal(recorrentes);
    const couponId = await createCoupon(temporario, params.moeda, metadata, params.attemptKey || "initial", duracaoDoDescontoRecorrente(mesesDeDesconto));
    if (couponId) appendNested(form, "discounts", [{ coupon: couponId }]);
  }
  appendMetadata(form, metadata);

  /* A chave de idempotência é o grupo: retomada do aceite, clique duplo ou
     webhook repetido devolvem a MESMA assinatura em vez de criar uma segunda
     e cobrar o cliente duas vezes pelo mesmo contrato. */
  const sub = await stripePost<{ id: string; latest_invoice?: string | { id?: string; hosted_invoice_url?: string | null } | null }>(
    "subscriptions", form,
    /* O QUE SE COBRA entra na chave, não só o grupo.
       Sem isso, re-gerar a cobrança do mesmo grupo com preço, quantidade ou
       vencimento diferentes era recusado pelo Stripe com `idempotency_error`:
       a chave já existia, amarrada aos parâmetros antigos, e a venda ficava
       impossível de corrigir. Mesma venda com os mesmos valores continua
       devolvendo a MESMA assinatura, que é o ponto da chave. */
    { idempotencyKey: stableIdempotencyKey(
        `crm-sub-faturada-${params.grupoComercialId}-${params.attemptKey || "initial"}`
        + `-${recorrentes.map((i) => `${i.stripeProductId}x${i.quantidade}@${amountInCents(i.valorUnitario)}`).sort().join("|")}`
        + `-d${params.diaVencimentoMes ?? 0}-p${diasParaPagar}`) },
  );

  const faturaId = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id ?? null;
  let faturaUrl = typeof sub.latest_invoice === "object" ? sub.latest_invoice?.hosted_invoice_url ?? null : null;
  if (faturaId && !faturaUrl) {
    const f = await stripeGet<{ hosted_invoice_url?: string | null }>(`invoices/${encodeURIComponent(faturaId)}`)
      .catch(() => null);
    faturaUrl = f?.hosted_invoice_url ?? null;
  }
  return { subscriptionId: sub.id, faturaId, faturaUrl, mocked: false };
}
