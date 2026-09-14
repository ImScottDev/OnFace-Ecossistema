import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import {
  getMrrAtual,
  getComponentesMrr,
  getMrrNoInicio,
  getChurnStats,
  getUnitEconomics,
  getForecast,
  getCalendarioRenovacao,
  getFluxoMes,
} from "@/lib/financeiro/metricas";
import { getMetricasPorCampanha, agregarFunil } from "@/lib/relatorios/midia-paga";
import { getMrrAtivo } from "@/lib/analytics/command-center";

/**
 * GET /api/financeiro/metricas?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 *
 * Payload da aba "Visão Geral" — o bate o olho da liderança:
 * MRR (5 componentes), ARR, NRR, churn logo/receita, LTV:CAC, forecast,
 * calendário de renovação. Receita sempre segmentada ai × pabx.
 */
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const orgId = ctx.organizacaoId;
  const sp = request.nextUrl.searchParams;

  const hoje = new Date();
  const inicio = sp.get("inicio") ? new Date(sp.get("inicio") + "T00:00:00") : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = sp.get("fim") ? new Date(sp.get("fim") + "T23:59:59") : hoje;
  const p = { inicio, fim };

  // CAC do período vem da Mídia Paga (fonte canônica de gasto) — falha não derruba a página
  let gastoMidia: number | null = null;
  let vendasMidia: number | null = null;
  try {
    const campanhas = await getMetricasPorCampanha(orgId, inicio, fim);
    const funil = agregarFunil(campanhas);
    gastoMidia = funil.gastoTotal;
    vendasMidia = funil.vendas;
  } catch (e) {
    console.error("[FinMetricas] CAC indisponível (Meta):", e);
  }

  const [mrr, componentes, mrrInicio, churn, unitEconomics, forecast, renovacoes, fluxoAi, fluxoPabx, canonico] = await Promise.all([
    getMrrAtual(orgId),
    getComponentesMrr(orgId, p),
    getMrrNoInicio(orgId, inicio),
    getChurnStats(orgId, p),
    getUnitEconomics(orgId, p, gastoMidia, vendasMidia),
    getForecast(orgId, 3),
    getCalendarioRenovacao(orgId, 90),
    getFluxoMes(orgId, "ai"),
    getFluxoMes(orgId, "pabx"),
    // Mesma função que a Home usa. O Financeiro soma `contratos` (545 linhas,
    // com as duplicidades que o próprio relatório de duplicidade aponta) e a
    // Home soma `servicos_canonicos` (337 linhas, fonte canônica do pós-venda).
    // Os dois números convivem no produto e não batem; em vez de escolher um
    // à revelia — mexer na base do Financeiro muda NRR, churn e forecast
    // juntos —, a divergência passa a ser mostrada.
    getMrrAtivo(orgId).catch(() => null),
  ]);

  return NextResponse.json({
    periodo: { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) },
    mrr: {
      atual: mrr.total,
      inicioPeriodo: mrrInicio,
      arr: Math.round(mrr.total * 12 * 100) / 100,
      porProduto: mrr.porProduto,
      componentes,
      canonico: canonico ? canonico.atual : null,
    },
    churn,
    unitEconomics,
    forecast,
    renovacoes,
    fluxo: { ai: fluxoAi, pabx: fluxoPabx },
    midia: { gasto: gastoMidia, vendas: vendasMidia },
  });
}
