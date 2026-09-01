/**
 * Cobrança pontual via Stripe Invoice API (25/08, billing avançado — pedido
 * do Kauã). Duas capacidades novas, GREENFIELD (nenhuma menção prévia no
 * projeto, confirmado antes de escrever isto):
 *
 *  - Cobrança avulsa: cobrar um valor fora do ciclo de uma assinatura já
 *    ativa (ex.: setup extra, ajuste pontual) num cliente que já existe no
 *    Stripe (`stripeCustomerId`).
 *  - Parcelamento (boleto parcelado): ao contrário de uma assinatura
 *    recorrente (MRR), aqui são N cobranças FINITAS e avulsas, cada uma com
 *    seu próprio vencimento — por isso usa Invoice avulsa (não Subscription
 *    Item, que exigiria a granularidade de `subscription_items` ainda não
 *    modelada no schema — ver crm2-decisoes-pendentes.md item 8).
 *
 * Mesmo padrão REST cru (fetch + Bearer) já usado em stripe-checkout.ts/
 * stripe-sync.ts — sem SDK, sem inventar 2º jeito de chamar o Stripe.
 *
 * Fluxo do Invoice: cria o Invoice Item (o valor), depois o Invoice
 * (collection_method=send_invoice, days_until_due=vencimento), e finaliza
 * (finalize) — o Stripe manda o boleto/link de pagamento pro e-mail do
 * cliente automaticamente quando finalizado com send_invoice.
 */
const STRIPE_API = "https://api.stripe.com/v1";

function requireKey(): string {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada no .env");
  return key;
}

async function stripePost<T>(path: string, form: URLSearchParams): Promise<T> {
  const key = requireKey();
  const res = await fetch(`${STRIPE_API}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

export interface CobrancaAvulsaParams {
  stripeCustomerId: string;
  descricao: string;
  /** valor em reais (ex.: 199.90) */
  valor: number;
  moeda: string;
  /** dias até o vencimento — vira o vencimento do boleto/link enviado */
  diasVencimento: number;
  metadata?: Record<string, string>;
}

export interface CobrancaResult {
  invoiceId: string;
  hostedInvoiceUrl: string | null;
  status: string;
}

/**
 * Cria e finaliza UMA cobrança avulsa (Invoice Item + Invoice) num cliente
 * Stripe já existente. `send_invoice` faz o Stripe mandar o e-mail com o
 * boleto/link pro cliente sozinho — não precisa hospedar nada no CRM.
 */
export async function criarCobrancaAvulsa(params: CobrancaAvulsaParams): Promise<CobrancaResult> {
  const currency = (params.moeda || "BRL").toLowerCase();

  const itemForm = new URLSearchParams();
  itemForm.append("customer", params.stripeCustomerId);
  itemForm.append("description", params.descricao);
  itemForm.append("amount", String(Math.round(params.valor * 100)));
  itemForm.append("currency", currency);
  await stripePost("invoiceitems", itemForm);

  const invoiceForm = new URLSearchParams();
  invoiceForm.append("customer", params.stripeCustomerId);
  invoiceForm.append("collection_method", "send_invoice");
  invoiceForm.append("days_until_due", String(Math.max(1, Math.min(60, params.diasVencimento || 3))));
  invoiceForm.append("auto_advance", "true");
  if (params.metadata) {
    for (const [k, v] of Object.entries(params.metadata)) invoiceForm.append(`metadata[${k}]`, v);
  }
  const invoice = await stripePost<{ id: string }>("invoices", invoiceForm);

  const finalized = await stripePost<{ id: string; status: string; hosted_invoice_url: string | null }>(
    `invoices/${invoice.id}/finalize`,
    new URLSearchParams()
  );

  return { invoiceId: finalized.id, hostedInvoiceUrl: finalized.hosted_invoice_url, status: finalized.status };
}

export interface PlanoParcelasParams {
  stripeCustomerId: string;
  descricaoBase: string;
  /** valor de CADA parcela em reais */
  valorParcela: number;
  moeda: string;
  /** quantas parcelas gerar (ex.: se a proposta tem 6 parcelas e a 1ª já saiu no checkout, passar 5) */
  quantidade: number;
  diasVencimento: number;
  metadata?: Record<string, string>;
}

/**
 * Gera N cobranças avulsas espaçadas por mês (parcela 2, 3, 4...) — cada uma
 * com vencimento próprio a partir da data de criação (`days_until_due`
 * conta da criação de CADA invoice, então a invoice da parcela N só deveria
 * ser criada quando a N-1 já tiver sido cobrada de verdade; por ora todas
 * nascem juntas com `days_until_due` cumulativo — ação manual/auditada, não
 * automática, então o vendedor vê e confirma antes).
 */
export async function criarPlanoDeParcelas(params: PlanoParcelasParams): Promise<CobrancaResult[]> {
  const resultados: CobrancaResult[] = [];
  for (let i = 0; i < params.quantidade; i++) {
    const numeroParcela = i + 1;
    resultados.push(
      await criarCobrancaAvulsa({
        stripeCustomerId: params.stripeCustomerId,
        descricao: `${params.descricaoBase} — parcela ${numeroParcela}/${params.quantidade}`,
        valor: params.valorParcela,
        moeda: params.moeda,
        diasVencimento: params.diasVencimento + i * 30,
        metadata: { ...params.metadata, parcela: String(numeroParcela), totalParcelas: String(params.quantidade) },
      })
    );
  }
  return resultados;
}
