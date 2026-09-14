/**
 * Visão de billing do CS, por Service.
 *
 * Só leitura, e só do que existe de verdade no banco. Auditado em 08/09/2026
 * sobre a base real (311 assinaturas, 792 faturas):
 *
 *   TEM  — stripe_customer_id, stripe_subscription_id, stripe_price_id,
 *          produto, quantidade, mrr, status, faturas com hosted_invoice_url
 *          (425/792), data de pagamento (498/792).
 *   NÃO TEM — `current_period_end` está vazio nas 311 assinaturas, então
 *          "próxima cobrança" NÃO é exibível; `assinatura_itens` tem 0 linhas,
 *          então não há detalhe por item; `raw` é um snapshot fino (status,
 *          products, cancel_at), não o objeto Stripe completo, então forma de
 *          pagamento também não existe.
 *
 * Esses campos são declarados como indisponíveis em vez de estimados. Ver
 * `INDISPONIVEL` abaixo — a UI mostra o motivo, não um traço mudo.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/** Campo que a spec pede e a base não permite hoje, com o porquê. */
export const INDISPONIVEL: Record<string, string> = {
  proximaCobranca: "Stripe sync não grava current_period_end (0 de 311 assinaturas)",
  formaPagamento: "raw da assinatura é um snapshot reduzido, sem payment method",
  itensDaAssinatura: "tabela assinatura_itens está vazia — sync não popula por item",
};

/** Deep links para o Stripe. Só leitura: abrem o painel, não alteram nada. */
export function linkStripeCustomer(customerId: string, contaStripe?: string): string {
  const base = contaStripe ? `https://dashboard.stripe.com/${contaStripe}` : "https://dashboard.stripe.com";
  return `${base}/customers/${customerId}`;
}
export function linkStripeSubscription(subscriptionId: string, contaStripe?: string): string {
  const base = contaStripe ? `https://dashboard.stripe.com/${contaStripe}` : "https://dashboard.stripe.com";
  return `${base}/subscriptions/${subscriptionId}`;
}

export interface FaturaResumo {
  id: string;
  externalId: string | null;
  valor: string;
  status: string;
  competencia: string | null;
  vencimento: string | null;
  pagaEm: string | null;
  tentativas: number;
  hostedInvoiceUrl: string | null;
  diasAtraso: number | null;
}

export interface BillingDoServico {
  servicoId: string | null;
  serviceFamily: string | null;
  produtoCanonico: string | null;
  mrrServico: string;
  revenueNature: string | null;
  assinatura: {
    id: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string | null;
    stripePriceId: string | null;
    produto: string | null;
    quantidade: number | null;
    mrr: string | null;
    moeda: string;
    status: string;
    iniciadaEm: string | null;
    canceladaEm: string | null;
    cancelaNoFimDoPeriodo: boolean | null;
  } | null;
  faturas: FaturaResumo[];
  totalEmAberto: string;
  ultimoPagamento: string | null;
}

/**
 * Billing agrupado por serviço canônico. Faturas e assinatura são ligadas ao
 * serviço quando o vínculo existe (144 de 311 assinaturas e 285 de 792
 * faturas o têm hoje); o que não está ligado a nenhum serviço aparece num
 * bloco "não atribuído", visível em vez de escondido — é dado real da conta
 * e some se filtrado.
 */
export async function billingDaConta(organizacaoId: string, empresaId: string): Promise<{
  porServico: BillingDoServico[];
  naoAtribuido: BillingDoServico | null;
  stripeCustomerId: string | null;
  indisponivel: Record<string, string>;
}> {
  const servicos = await db.execute<Record<string, string | null>>(sql`
    SELECT sc.id, sc.service_family, sc.canonical_product,
           sc.current_recurring_value::text AS mrr, sc.revenue_nature
      FROM servicos_canonicos sc
     WHERE sc.organizacao_id = ${organizacaoId} AND sc.empresa_id = ${empresaId}
       AND sc.portfolio_included = true
     ORDER BY sc.current_recurring_value DESC NULLS LAST`);

  const assinaturasRows = await db.execute<Record<string, string | number | boolean | null>>(sql`
    SELECT a.id, a.servico_id, a.stripe_subscription_id, a.stripe_customer_id, a.stripe_price_id,
           a.produto, a.quantidade, a.mrr::text, a.moeda, a.status,
           a.iniciada_em::text, a.cancelada_em::text, a.contrato_id,
           (a.raw->>'cancel_at_period_end')::boolean AS cancela_no_fim
      FROM assinaturas a
     WHERE a.organizacao_id = ${organizacaoId} AND a.empresa_id = ${empresaId}
     ORDER BY a.status = 'active' DESC, a.updated_at DESC`);

  const faturasRows = await db.execute<Record<string, string | number | null>>(sql`
    SELECT f.id, f.servico_canonico_id, f.assinatura_id, f.external_id, f.valor::text, f.status,
           f.competencia::text, f.vencimento::text, f.paga_em::text, f.tentativas,
           f.hosted_invoice_url,
           CASE WHEN f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()
                THEN EXTRACT(DAY FROM now() - COALESCE(f.vencimento, f.emitida_em))::int END AS dias_atraso
      FROM faturas f
     WHERE f.organizacao_id = ${organizacaoId} AND f.empresa_id = ${empresaId}
     ORDER BY COALESCE(f.competencia, f.emitida_em::date) DESC NULLS LAST
     LIMIT 200`);

  // Assinatura do serviço: pelo vínculo direto, com fallback pelo contrato —
  // é o mesmo encadeamento que o Cliente 360 já usa, não uma segunda regra.
  const contratoPorServico = new Map<string, string>();
  const contratos = await db.execute<{ id: string; contrato_id: string | null }>(sql`
    SELECT id, contrato_id FROM servicos_canonicos
     WHERE organizacao_id = ${organizacaoId} AND empresa_id = ${empresaId}`);
  for (const c of contratos) if (c.contrato_id) contratoPorServico.set(c.id, c.contrato_id);

  const montar = (
    servicoId: string | null,
    familia: string | null,
    produto: string | null,
    mrr: string,
    natureza: string | null,
    assinaturaRow: Record<string, string | number | boolean | null> | undefined,
    faturasDoBloco: Record<string, string | number | null>[],
  ): BillingDoServico => {
    const faturas: FaturaResumo[] = faturasDoBloco.map((f) => ({
      id: String(f.id),
      externalId: (f.external_id as string) ?? null,
      valor: String(f.valor ?? "0"),
      status: String(f.status),
      competencia: (f.competencia as string) ?? null,
      vencimento: (f.vencimento as string) ?? null,
      pagaEm: (f.paga_em as string) ?? null,
      tentativas: Number(f.tentativas ?? 0),
      hostedInvoiceUrl: (f.hosted_invoice_url as string) ?? null,
      diasAtraso: f.dias_atraso === null || f.dias_atraso === undefined ? null : Number(f.dias_atraso),
    }));

    const emAberto = faturas
      .filter((f) => f.status === "aberta")
      .reduce((soma, f) => soma + Number(f.valor || 0), 0);

    const pagas = faturas.filter((f) => f.pagaEm).sort((a, b) => (b.pagaEm! > a.pagaEm! ? 1 : -1));

    return {
      servicoId, serviceFamily: familia, produtoCanonico: produto,
      mrrServico: mrr, revenueNature: natureza,
      assinatura: assinaturaRow ? {
        id: String(assinaturaRow.id),
        stripeSubscriptionId: String(assinaturaRow.stripe_subscription_id),
        stripeCustomerId: (assinaturaRow.stripe_customer_id as string) ?? null,
        stripePriceId: (assinaturaRow.stripe_price_id as string) ?? null,
        produto: (assinaturaRow.produto as string) ?? null,
        quantidade: assinaturaRow.quantidade === null ? null : Number(assinaturaRow.quantidade),
        mrr: (assinaturaRow.mrr as string) ?? null,
        moeda: String(assinaturaRow.moeda ?? "BRL"),
        status: String(assinaturaRow.status),
        iniciadaEm: (assinaturaRow.iniciada_em as string) ?? null,
        canceladaEm: (assinaturaRow.cancelada_em as string) ?? null,
        cancelaNoFimDoPeriodo: assinaturaRow.cancela_no_fim === null ? null : Boolean(assinaturaRow.cancela_no_fim),
      } : null,
      faturas: faturas.slice(0, 12),
      totalEmAberto: emAberto.toFixed(2),
      ultimoPagamento: pagas[0]?.pagaEm ?? null,
    };
  };

  const assinaturasUsadas = new Set<string>();
  const faturasUsadas = new Set<string>();

  const porServico = servicos.map((s) => {
    const servicoId = String(s.id);
    const contratoId = contratoPorServico.get(servicoId);
    const assinatura = assinaturasRows.find((a) =>
      String(a.servico_id ?? "") === servicoId
      || (!!contratoId && String(a.contrato_id ?? "") === contratoId));
    if (assinatura) assinaturasUsadas.add(String(assinatura.id));

    const faturasDoServico = faturasRows.filter((f) =>
      String(f.servico_canonico_id ?? "") === servicoId
      || (!!assinatura && String(f.assinatura_id ?? "") === String(assinatura.id)));
    for (const f of faturasDoServico) faturasUsadas.add(String(f.id));

    return montar(servicoId, s.service_family, s.canonical_product, s.mrr ?? "0", s.revenue_nature, assinatura, faturasDoServico);
  });

  const faturasOrfas = faturasRows.filter((f) => !faturasUsadas.has(String(f.id)));
  const assinaturaOrfa = assinaturasRows.find((a) => !assinaturasUsadas.has(String(a.id)));
  const naoAtribuido = (faturasOrfas.length > 0 || assinaturaOrfa)
    ? montar(null, null, "Cobrança sem serviço vinculado", "0", null, assinaturaOrfa, faturasOrfas)
    : null;

  const stripeCustomerId = (assinaturasRows.find((a) => a.stripe_customer_id)?.stripe_customer_id as string) ?? null;

  return { porServico, naoAtribuido, stripeCustomerId, indisponivel: INDISPONIVEL };
}
