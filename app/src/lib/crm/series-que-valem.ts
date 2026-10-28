/* ─────────────────────────────────────────────────────────────────────────
 * Quais propostas de um negócio entram no valor dele.
 *
 * Um negócio pode ter várias SÉRIES de proposta (números diferentes), cada
 * uma com suas versões. Enquanto a venda está em aberto, toda série que não
 * foi recusada conta: são caminhos possíveis, e o forecast quer o total.
 *
 * Fechada a venda, não. O que o cliente aceitou é o que foi vendido; as
 * outras séries eram alternativas que não viraram dinheiro. Somar as duas
 * punha no fechamento valor de proposta que ninguém aceitou — a BC Genera
 * aparecia com R$ 2.098,60 (a aceita, R$ 1.139,20, mais uma expirada de
 * R$ 959,40) no relatório, contra R$ 1.139,20 na própria oportunidade.
 * ───────────────────────────────────────────────────────────────────────── */

export interface SerieDeProposta {
  id: string;
  status: string;
  recorrente: number;
  avulso: number;
  geral: number;
}

export interface TotaisDoNegocio {
  totalRecorrente: number;
  totalAvulso: number;
  totalGeral: number;
}

/**
 * As séries que formam o valor: só as aceitas quando existe aceite, todas as
 * vigentes enquanto não existe. Duas séries aceitas no mesmo negócio somam —
 * é uma venda em duas propostas, não duplicação.
 */
export function seriesQueValem(series: SerieDeProposta[]): SerieDeProposta[] {
  const aceitas = series.filter((s) => s.status === "aceita");
  return aceitas.length > 0 ? aceitas : series;
}

export function totaisDoNegocio(series: SerieDeProposta[]): TotaisDoNegocio {
  return seriesQueValem(series).reduce<TotaisDoNegocio>(
    (soma, s) => ({
      totalRecorrente: soma.totalRecorrente + s.recorrente,
      totalAvulso: soma.totalAvulso + s.avulso,
      totalGeral: soma.totalGeral + s.geral,
    }),
    { totalRecorrente: 0, totalAvulso: 0, totalGeral: 0 },
  );
}
