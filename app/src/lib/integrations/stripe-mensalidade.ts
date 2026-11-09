/**
 * A mensalidade equivalente de uma assinatura do Stripe (MRR).
 *
 * Parte pura, sem banco e sem rede, para o sync e o registro da venda de
 * autoatendimento usarem a MESMA régua: anual vira /12, semanal vira ×4,
 * quantidade multiplica, e item sem recorrência (setup, one-time) não entra.
 *
 * Duas réguas parecidas em dois lugares é como nasce número que não bate.
 */
export interface ItemDePreco {
  price?: { unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null } | null;
  quantity?: number | null;
}

const MESES_POR_INTERVALO: Record<string, number> = { month: 1, year: 12, week: 0.25, day: 1 / 30 };

export function mensalidadeDaAssinatura(itens: ItemDePreco[] | null | undefined): number {
  let mrr = 0;
  for (const it of itens ?? []) {
    const p = it?.price;
    if (!p?.recurring || !p.unit_amount) continue;
    const meses = (MESES_POR_INTERVALO[p.recurring.interval ?? "month"] ?? 1) * (p.recurring.interval_count || 1);
    if (!meses) continue;
    mrr += (p.unit_amount / 100) * (it.quantity || 1) / meses;
  }
  return Math.round(mrr * 100) / 100;
}
