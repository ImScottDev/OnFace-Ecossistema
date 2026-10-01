import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getMrrAtual } from "@/lib/financeiro/metricas";

/**
 * Faixa de resumo da `/financeiro` (ONFACE). Cada número sai com a FONTE dele,
 * porque o Financeiro tem três verdades que não batem por construção:
 *
 *  - MRR ativo: `servicos_canonicos` (fonte canônica, a mesma do Início e do CS).
 *  - MRR contratado: `contratos` ativos, deduplicado por assinatura — número de
 *    conciliação, não de produto (ver `getMrrAtual`).
 *  - Cobrado: `faturas` pagas que o sync do Stripe trouxe. O CRM não reconcilia
 *    a assinatura depois do checkout, então este é o único número que diz o que
 *    de fato entrou — e só cobre Stripe: PABX é faturado pela Wevy, por planilha.
 *
 * O mês de "cobrado" é o último FECHADO: no dia 1 o mês corrente mostraria zero,
 * que é verdade inútil. A data do último sync vai junto para quem lê saber até
 * onde o número enxerga.
 */
export interface ResumoFinanceiro {
  mrrAtivo: number;
  servicosAtivos: number;
  mrrContratado: number;
  contratosAtivos: number;
  cobradoMesAnterior: number;
  faturasPagasMesAnterior: number;
  mesAnteriorInicio: string;
  ultimoSyncStripe: string | null;
  vencidoValor: number;
  vencidoFaturas: number;
}

export async function getResumoFinanceiro(orgId: string): Promise<ResumoFinanceiro> {
  const [mrr, [cobrado], [vencido], [servicos]] = await Promise.all([
    getMrrAtual(orgId),
    db.execute<{ valor: string; n: string; inicio: string; sync: string | null }>(sql`
      SELECT COALESCE(SUM(f.valor) FILTER (
               WHERE f.status = 'paga' AND f.origem = 'stripe'
                 AND f.paga_em >= date_trunc('month', now()) - interval '1 month'
                 AND f.paga_em <  date_trunc('month', now())), 0)::text AS valor,
             COUNT(*) FILTER (
               WHERE f.status = 'paga' AND f.origem = 'stripe'
                 AND f.paga_em >= date_trunc('month', now()) - interval '1 month'
                 AND f.paga_em <  date_trunc('month', now()))::text AS n,
             (date_trunc('month', now()) - interval '1 month')::date::text AS inicio,
             MAX(f.synced_at) FILTER (WHERE f.origem = 'stripe')::text AS sync
        FROM faturas f
       WHERE f.organizacao_id = ${orgId}`),
    // `origem = 'stripe'` nos dois números porque a legenda promete "só Stripe":
    // hoje as zoho_legado têm paga_em NULL e nenhuma aberta, mas não por regra.
    // Mesma regra de atraso do módulo: COALESCE(vencimento, emitida_em), nunca coluna.
    db.execute<{ valor: string; n: string }>(sql`
      SELECT COALESCE(SUM(valor), 0)::text AS valor, COUNT(*)::text AS n
        FROM faturas
       WHERE organizacao_id = ${orgId}
         AND origem = 'stripe'
         AND status IN ('aberta', 'uncollectible')
         AND COALESCE(vencimento, emitida_em) < now()`),
    db.execute<{ n: string }>(sql`
      SELECT COUNT(*)::text AS n
        FROM servicos_canonicos
       WHERE organizacao_id = ${orgId}
         AND portfolio_included = true
         AND revenue_nature = 'MRR'
         AND commercial_lifecycle = 'ACTIVE'`),
  ]);

  return {
    mrrAtivo: mrr.total,
    servicosAtivos: Number(servicos?.n ?? 0),
    mrrContratado: mrr.totalContratado,
    contratosAtivos: mrr.contratosAtivos,
    cobradoMesAnterior: Number(cobrado?.valor ?? 0),
    faturasPagasMesAnterior: Number(cobrado?.n ?? 0),
    mesAnteriorInicio: cobrado?.inicio ?? "",
    ultimoSyncStripe: cobrado?.sync ?? null,
    vencidoValor: Number(vencido?.valor ?? 0),
    vencidoFaturas: Number(vencido?.n ?? 0),
  };
}
