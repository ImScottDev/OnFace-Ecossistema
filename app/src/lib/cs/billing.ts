/**
 * Visão de billing do CS, por Service.
 *
 * Só leitura, e só do que existe de verdade no banco. Auditado em 08/09/2026
 * sobre a base real (311 assinaturas, 792 faturas):
 *
 *   TEM  — stripe_customer_id, stripe_subscription_id, stripe_price_id,
 *          produto, quantidade, mrr, status, faturas com hosted_invoice_url
 *          (425/792), data de pagamento (498/792).
 *   NÃO TEM — forma de pagamento (`raw` é um snapshot fino).
 *   CORRIGIDO em 13/10/2026 — `current_period_end` e `assinatura_itens` estavam
 *          vazios porque a API basil move o período para o ITEM e o sync lia só o
 *          topo; agora o sync grava os dois e a "próxima cobrança" vem daqui, pelas
 *          regras de `lib/clientes/financeiro-regras.ts` (preenche no próximo sync).
 *
 * Esses campos são declarados como indisponíveis em vez de estimados. Ver
 * `INDISPONIVEL` abaixo — a UI mostra o motivo, não um traço mudo.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  assinaturaFinanceira, classificarFatura, rotuloMesCobranca,
  type EstadoFatura, type ItemFinanceiro, type PeriodoAssinatura, type StatusAssinatura,
} from "@/lib/clientes/financeiro-regras";

/** `to_json(timestamptz|date)` → Date. Data "só dia" vira meio-dia UTC, para o fuso não mudar o dia. */
const paraData = (s: unknown): Date | null => {
  if (typeof s !== "string" || !s) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T12:00:00Z" : s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Campo que a spec pede e a base não permite hoje, com o porquê. */
export const INDISPONIVEL: Record<string, string> = {
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
  /** Estado financeiro (regras únicas de `financeiro-regras`): vencida, a_receber, recebida... */
  estado: EstadoFatura;
  /** Dia de cobrança (ISO): vencimento, ou emissão quando o Stripe não dá vencimento (cobrança no cartão). */
  dataCobranca: string | null;
  /** "YYYY-MM" do dia de cobrança — o mês em que a fatura aparece, nunca o início do ciclo. */
  mesCobranca: string | null;
  rotuloMes: string;
  /** A cobrança foi tentada e não passou (linha FAILED, ou aberta com tentativa já feita). */
  pagamentoFalhou: boolean;
  falhouEm: string | null;
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
    /** Status em português e a visão financeira (mesma regra para toda tela). */
    statusFin: StatusAssinatura;
    statusRotulo: string;
    /** Nome do produto como o Stripe o nomeia (itens), não a família do ONFACE. */
    produtoReal: string | null;
    itens: ItemFinanceiro[];
    periodo: PeriodoAssinatura;
    /** ISO. Próxima fatura agendada; null se não cobra mais ou o espelho ainda não tem o fim do período. */
    proximaCobranca: { data: string; valor: number } | null;
    fimDoPeriodo: string | null;
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
<<<<<<< Updated upstream
           COALESCE((a.raw->>'cancela_no_fim')::boolean, (a.raw->>'cancel_at_period_end')::boolean) AS cancela_no_fim
=======
           to_json(a.current_period_end)#>>'{}' AS periodo_fim,
           (a.raw->>'cancel_at_period_end')::boolean AS cancela_no_fim
>>>>>>> Stashed changes
      FROM assinaturas a
     WHERE a.organizacao_id = ${organizacaoId} AND a.empresa_id = ${empresaId}
     ORDER BY a.status = 'active' DESC, a.updated_at DESC`);

  const itensRows = await db.execute<Record<string, string | number | null>>(sql`
    SELECT i.assinatura_id, i.produto, i.stripe_price_id, i.quantidade, i.preco_unitario::float8 AS preco,
           i.recurring_interval, i.status, to_json(i.current_period_end)#>>'{}' AS periodo_fim
      FROM assinatura_itens i
     WHERE i.organizacao_id = ${organizacaoId}
       AND i.assinatura_id IN (SELECT id FROM assinaturas WHERE organizacao_id = ${organizacaoId} AND empresa_id = ${empresaId})`);

  const pagRows = await db.execute<Record<string, string | number | null>>(sql`
    SELECT fatura_id,
           bool_or(status = 'FAILED') AS falhou,
           to_json(max(failed_at) FILTER (WHERE status = 'FAILED'))#>>'{}' AS falhou_em,
           COALESCE(sum(amount) FILTER (WHERE status = 'REFUNDED'), 0)::float8 AS estornado
      FROM pagamentos
     WHERE organizacao_id = ${organizacaoId} AND empresa_id = ${empresaId} AND fatura_id IS NOT NULL
     GROUP BY fatura_id`);

  const faturasRows = await db.execute<Record<string, string | number | null>>(sql`
    SELECT f.id, f.servico_canonico_id, f.assinatura_id, f.external_id, f.valor::text, f.status,
           f.competencia::text, f.vencimento::text, f.paga_em::text, f.tentativas,
           f.hosted_invoice_url, f.origem,
           to_json(f.emitida_em)#>>'{}' AS emitida_em, to_json(f.vencimento)#>>'{}' AS vencimento_iso
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
    const agora = new Date();
    const faturas: FaturaResumo[] = faturasDoBloco.map((f) => {
      const pg = pagRows.find((p) => String(p.fatura_id) === String(f.id));
      const c = classificarFatura({
        id: String(f.id), origem: String(f.origem ?? "stripe"), externalId: (f.external_id as string) ?? null,
        status: String(f.status), valor: Number(f.valor ?? 0), emitidaEm: paraData(f.emitida_em),
        vencimento: paraData(f.vencimento_iso), pagaEm: paraData(f.paga_em), competencia: (f.competencia as string) ?? null,
        hostedInvoiceUrl: (f.hosted_invoice_url as string) ?? null, tentativas: Number(f.tentativas ?? 0),
        assinaturaId: (f.assinatura_id as string) ?? null,
        valorEstornado: Number(pg?.estornado ?? 0), pagamentoFalhou: !!pg?.falhou, falhouEm: paraData(pg?.falhou_em),
      }, agora);
      return {
        id: String(f.id),
        externalId: (f.external_id as string) ?? null,
        valor: String(f.valor ?? "0"),
        status: String(f.status),
        competencia: (f.competencia as string) ?? null,
        vencimento: (f.vencimento as string) ?? null,
        pagaEm: (f.paga_em as string) ?? null,
        tentativas: Number(f.tentativas ?? 0),
        hostedInvoiceUrl: (f.hosted_invoice_url as string) ?? null,
        diasAtraso: f.status === "aberta" ? (c.diasAtraso ?? 0) : null,
        estado: c.estado,
        dataCobranca: c.dataCobranca?.toISOString() ?? null,
        mesCobranca: c.mesCobranca,
        rotuloMes: rotuloMesCobranca(c.mesCobranca),
        pagamentoFalhou: c.pagamentoFalhou,
        falhouEm: c.falhouEm?.toISOString() ?? null,
      };
    });

    const emAberto = faturas
      .filter((f) => f.status === "aberta")
      .reduce((soma, f) => soma + Number(f.valor || 0), 0);

    const pagas = faturas.filter((f) => f.pagaEm).sort((a, b) => (b.pagaEm! > a.pagaEm! ? 1 : -1));

    return {
      servicoId, serviceFamily: familia, produtoCanonico: produto,
      mrrServico: mrr, revenueNature: natureza,
      assinatura: assinaturaRow ? (() => {
        const fin = assinaturaFinanceira({
          id: String(assinaturaRow.id), stripeSubscriptionId: String(assinaturaRow.stripe_subscription_id),
          produto: (assinaturaRow.produto as string) ?? null, status: String(assinaturaRow.status),
          cancelaNoFim: !!assinaturaRow.cancela_no_fim,
          mrr: assinaturaRow.mrr == null ? null : Number(assinaturaRow.mrr),
          iniciadaEm: paraData(assinaturaRow.iniciada_em), canceladaEm: paraData(assinaturaRow.cancelada_em),
          periodoFim: paraData(assinaturaRow.periodo_fim),
          itens: itensRows.filter((i) => String(i.assinatura_id) === String(assinaturaRow.id)).map((i) => ({
            precoUnitario: i.preco == null ? null : Number(i.preco), quantidade: Number(i.quantidade ?? 1),
            intervalo: (i.recurring_interval as string) ?? null, periodoCatalogo: null, status: (i.status as string) ?? null,
            periodoFim: paraData(i.periodo_fim), produto: (i.produto as string) ?? null,
            stripePriceId: (i.stripe_price_id as string) ?? null,
          })),
        });
        return {
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
        statusFin: fin.status, statusRotulo: fin.statusRotulo, produtoReal: fin.produtoReal, itens: fin.itens, periodo: fin.periodo,
        proximaCobranca: fin.proximaCobranca ? { data: fin.proximaCobranca.data.toISOString(), valor: fin.proximaCobranca.valor } : null,
        fimDoPeriodo: fin.fimDoPeriodo?.toISOString() ?? null,
        };
      })() : null,
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
