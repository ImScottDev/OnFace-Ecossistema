/**
 * Alterar a assinatura que o cliente JÁ tem — expansão, upgrade e downgrade.
 *
 * Por que este módulo existe: o checkout do Stripe em modo `subscription`
 * sempre cria uma assinatura NOVA. Usá-lo para vender mais para quem já paga
 * deixa o cliente com duas assinaturas e duas cobranças. Por isso
 * `bloqueioNovoCheckoutDeAssinatura` barra esse caminho — só que a "alteração
 * de assinatura aprovada" que a mensagem prometia nunca existiu, e o vendedor
 * ficava sem saída. É ela.
 *
 * O caminho certo, segundo a documentação do Stripe:
 *   - vender MAIS um produto      → `POST /subscription_items`
 *   - aumentar quantidade         → `POST /subscription_items/{id}`
 *   - trocar de plano (upgrade)   → `POST /subscriptions/{id}` com `items[0][id]`
 *
 * Tudo com `proration_behavior=always_invoice`, que emite a fatura na hora. O
 * default do Stripe (`create_prorations`) só cobraria na renovação seguinte —
 * e aí a venda de hoje não vira caixa nem ganho hoje.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { assinaturas, assinaturaItens } from "../db/schema";

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || "2026-08-26.dahlia";

function chave(): string {
  const k = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY ou STRIPE_API_KEY não configurada");
  return k;
}

export async function stripe<T>(
  path: string,
  form?: URLSearchParams,
  idempotencyKey?: string,
  metodo?: "DELETE",
): Promise<T> {
  const res = await fetch(`${STRIPE_API}/${path}`, {
    method: metodo ?? (form ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${chave()}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey
        ? { "Idempotency-Key": idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 255) }
        : {}),
    },
    ...(form ? { body: form.toString() } : {}),
  });
  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`Stripe ${path}: HTTP ${res.status} ${corpo.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

/* ── O que o cliente tem hoje ─────────────────────────────────────────── */

export interface ItemDaAssinatura {
  /** `si_...` — é ele que o Stripe exige para TROCAR um item em vez de somar outro. */
  stripeSubscriptionItemId: string | null;
  stripePriceId: string | null;
  produto: string | null;
  quantidade: number;
  precoUnitario: number | null;
  intervalo: string | null;
  familia: string;
}

export interface AssinaturaAtiva {
  id: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  status: string;
  moeda: string;
  mrr: number | null;
  renovaEm: Date | null;
  itens: ItemDaAssinatura[];
}

/**
 * A assinatura viva da empresa, lida do ESPELHO local.
 *
 * O espelho é atualizado pelo `syncStripe` a cada 30 min e em todo webhook, e
 * ler dele mantém a modal instantânea. Para MUTAR, as funções abaixo falam com
 * o Stripe direto — ler do espelho e escrever no Stripe é a divisão certa.
 *
 * `trialing` entra junto com `active`: quem está em teste também pode expandir.
 */
export async function assinaturaAtivaDaEmpresa(
  organizacaoId: string,
  empresaId: string,
): Promise<AssinaturaAtiva | null> {
  /* Mais recente primeiro, e só então filtra pelas vivas: a empresa pode ter
     assinatura cancelada mais nova que a ativa (downgrade mal feito no
     passado), e expandir a cancelada seria cobrar no lugar errado. */
  const todas = await db
    .select()
    .from(assinaturas)
    .where(and(
      eq(assinaturas.organizacaoId, organizacaoId),
      eq(assinaturas.empresaId, empresaId),
    ))
    .orderBy(desc(assinaturas.currentPeriodEnd), desc(assinaturas.createdAt));
  const alvo = todas.find((x) => x.status === "active" || x.status === "trialing");
  if (!alvo) return null;

  const itens = await db
    .select()
    .from(assinaturaItens)
    .where(eq(assinaturaItens.assinaturaId, alvo.id));

  return {
    id: alvo.id,
    stripeSubscriptionId: alvo.stripeSubscriptionId,
    stripeCustomerId: alvo.stripeCustomerId,
    status: alvo.status,
    moeda: alvo.moeda,
    mrr: alvo.mrr ? Number(alvo.mrr) : null,
    renovaEm: alvo.currentPeriodEnd,
    itens: itens
      .filter((i) => i.status !== "inactive")
      .map((i) => ({
        stripeSubscriptionItemId: i.stripeSubscriptionItemId,
        stripePriceId: i.stripePriceId,
        produto: i.produto,
        quantidade: i.quantidade ?? 1,
        precoUnitario: i.precoUnitario ? Number(i.precoUnitario) : null,
        intervalo: i.recurringInterval,
        familia: i.serviceFamily,
      })),
  };
}

/* ── Prévia: o que o cliente vai pagar agora ──────────────────────────── */

export interface PreviaDeAlteracao {
  /** Em reais, já com proração. Pode ser negativo (crédito) num downgrade. */
  totalAgora: number;
  moeda: string;
  linhas: { descricao: string; valor: number }[];
}

/**
 * Quanto a alteração vai cobrar AGORA, sem alterar nada.
 *
 * `invoices/create_preview` é o endpoint que o Stripe oferece justamente para
 * isto. Mostrar ao closer antes de confirmar é o que evita a surpresa clássica
 * da proração — o cliente recebe uma cobrança quebrada que ninguém anunciou.
 */
export async function previaDeAlteracao(params: {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  /** Itens no formato do Stripe: `{ id?, price, quantity, deleted? }`. */
  itens: { id?: string; price?: string; quantity?: number; deleted?: boolean }[];
  /** `none` = vale no próximo ciclo (downgrade). Padrão: cobra a proração agora. */
  prorationBehavior?: "always_invoice" | "none";
}): Promise<PreviaDeAlteracao> {
  const form = new URLSearchParams();
  form.append("customer", params.stripeCustomerId);
  form.append("subscription", params.stripeSubscriptionId);
  form.append("subscription_details[proration_behavior]", params.prorationBehavior ?? "always_invoice");
  params.itens.forEach((it, i) => {
    if (it.id) form.append(`subscription_details[items][${i}][id]`, it.id);
    if (it.price) form.append(`subscription_details[items][${i}][price]`, it.price);
    if (it.quantity !== undefined) form.append(`subscription_details[items][${i}][quantity]`, String(it.quantity));
    if (it.deleted) form.append(`subscription_details[items][${i}][deleted]`, "true");
  });

  const prev = await stripe<{
    currency: string;
    amount_due: number;
    lines?: { data: { description: string | null; amount: number }[] };
  }>("invoices/create_preview", form);

  return {
    totalAgora: (prev.amount_due ?? 0) / 100,
    moeda: (prev.currency ?? "brl").toUpperCase(),
    linhas: (prev.lines?.data ?? []).map((l) => ({
      descricao: l.description ?? "(sem descrição)",
      valor: l.amount / 100,
    })),
  };
}

/* ── Aplicar ──────────────────────────────────────────────────────────── */

export interface ResultadoAlteracao {
  stripeSubscriptionId: string;
  /** A fatura de proração emitida agora, quando houve valor a cobrar. */
  faturaId: string | null;
  mrrAntes: number | null;
  mrrDepois: number | null;
}

/** O MRR da assinatura, calculado do objeto do Stripe (mensalizado). */
export function mrrDaAssinatura(sub: {
  items?: { data: { quantity?: number; price?: { unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null } }[] };
}): number {
  let total = 0;
  for (const it of sub.items?.data ?? []) {
    const preco = it.price;
    if (!preco?.recurring) continue; // item avulso não é MRR
    const unit = (preco.unit_amount ?? 0) / 100;
    const qtd = it.quantity ?? 1;
    const n = preco.recurring.interval_count || 1;
    const fator = preco.recurring.interval === "year" ? 1 / (12 * n)
      : preco.recurring.interval === "week" ? 52 / (12 * n)
      : preco.recurring.interval === "day" ? 365 / (12 * n)
      : 1 / n;
    total += unit * qtd * fator;
  }
  return Math.round(total * 100) / 100;
}

/**
 * EXPANSÃO: mais um produto, ou mais quantidade do que ele já tem.
 *
 * Dois caminhos, e a escolha é do Stripe, não nossa: se o preço JÁ está na
 * assinatura, o certo é aumentar a quantidade daquele item; criar um segundo
 * item com o mesmo preço deixa a fatura com duas linhas iguais.
 *
 * `crmNegocioId` vai na metadata do item E da assinatura. É o que permite, mais
 * tarde, saber que aquele dinheiro veio de uma venda com dono — sem isso a
 * expansão entra no MRR e some da atribuição.
 */
export async function expandirAssinatura(params: {
  stripeSubscriptionId: string;
  stripePriceId: string;
  quantidade: number;
  crmNegocioId: string;
  crmMetadata?: Record<string, string>;
}): Promise<ResultadoAlteracao> {
  const sub = await stripe<{
    id: string;
    items: { data: { id: string; quantity?: number; price?: { id: string; unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null } }[] };
  }>(`subscriptions/${params.stripeSubscriptionId}?expand[]=items.data.price`);

  const mrrAntes = mrrDaAssinatura(sub);
  const jaTem = sub.items.data.find((i) => i.price?.id === params.stripePriceId);

  const form = new URLSearchParams();
  form.append("proration_behavior", "always_invoice");
  for (const [k, v] of Object.entries(params.crmMetadata ?? {})) form.append(`metadata[${k}]`, v.slice(0, 500));
  form.append("metadata[crm_negocio_id]", params.crmNegocioId);
  form.append("metadata[crm_motion]", "EXPANSION");

  if (jaTem) {
    // Mesmo preço já presente: soma na quantidade, não cria linha nova.
    form.append("quantity", String((jaTem.quantity ?? 1) + params.quantidade));
    await stripe(`subscription_items/${jaTem.id}`, form, `crm-exp-${params.crmNegocioId}-${jaTem.id}`);
  } else {
    form.append("subscription", params.stripeSubscriptionId);
    form.append("price", params.stripePriceId);
    form.append("quantity", String(params.quantidade));
    await stripe("subscription_items", form, `crm-exp-${params.crmNegocioId}-${params.stripePriceId}`);
  }

  return await depoisDaAlteracao(params.stripeSubscriptionId, mrrAntes);
}

/**
 * UPGRADE: troca de plano dentro do mesmo produto.
 *
 * O `itemId` é obrigatório de propósito. A pegadinha documentada do Stripe: se
 * você manda só o preço novo, ele ADICIONA um item e o cliente passa a pagar os
 * dois planos. E trocar o preço RESETA a quantidade para 1 — cinco licenças
 * viram uma, em silêncio. Por isso a quantidade é sempre reenviada.
 */
export async function trocarPlanoDaAssinatura(params: {
  stripeSubscriptionId: string;
  /** `si_...` do item que será trocado. Sem ele, o Stripe soma em vez de trocar. */
  itemId: string;
  novoPriceId: string;
  quantidade: number;
  crmNegocioId: string;
  crmMetadata?: Record<string, string>;
}): Promise<ResultadoAlteracao> {
  if (!params.itemId?.startsWith("si_")) {
    throw new Error(
      "trocarPlanoDaAssinatura exige o id do item (si_...). Sem ele o Stripe ADICIONA o plano novo em vez de trocar, e o cliente paga os dois.",
    );
  }
  const sub = await stripe<{
    items: { data: { id: string; quantity?: number; price?: { id: string; unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null } }[] };
  }>(`subscriptions/${params.stripeSubscriptionId}?expand[]=items.data.price`);
  const mrrAntes = mrrDaAssinatura(sub);

  const form = new URLSearchParams();
  form.append("items[0][id]", params.itemId);
  form.append("items[0][price]", params.novoPriceId);
  form.append("items[0][quantity]", String(Math.max(1, params.quantidade)));
  form.append("proration_behavior", "always_invoice");
  for (const [k, v] of Object.entries(params.crmMetadata ?? {})) form.append(`metadata[${k}]`, v.slice(0, 500));
  form.append("metadata[crm_negocio_id]", params.crmNegocioId);
  form.append("metadata[crm_motion]", "EXPANSION");

  await stripe(`subscriptions/${params.stripeSubscriptionId}`, form, `crm-upg-${params.crmNegocioId}-${params.itemId}`);
  return await depoisDaAlteracao(params.stripeSubscriptionId, mrrAntes);
}

/** Relê a assinatura e acha a fatura de proração que acabou de sair. */
async function depoisDaAlteracao(subscriptionId: string, mrrAntes: number): Promise<ResultadoAlteracao> {
  const sub = await stripe<{
    id: string;
    latest_invoice?: string | null;
    items: { data: { quantity?: number; price?: { unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null } }[] };
  }>(`subscriptions/${subscriptionId}?expand[]=items.data.price`);
  return {
    stripeSubscriptionId: sub.id,
    faturaId: sub.latest_invoice ?? null,
    mrrAntes,
    mrrDepois: mrrDaAssinatura(sub),
  };
}
