import type { Insight, InsightInput, InsightProvider } from "./types";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Provider heurístico — regra matemática direta sobre dado real (meta -
 * realizado = restante), sem IA. Ver ADR do Insight Engine.
 */
export class HeuristicInsightProvider implements InsightProvider {
  gerar(input: InsightInput): Insight[] {
    const insights: Insight[] = [];
    const comMeta = input.vendedores.filter((v) => v.valorAlvo > 0);

    // 1) Quem já bateu a meta (destaque) — o de maior % primeiro.
    const bateram = comMeta.filter((v) => v.pct >= 100).sort((a, b) => b.pct - a.pct);
    if (bateram[0]) {
      const v = bateram[0];
      insights.push({
        id: `bateu-meta-${v.id}`,
        texto: `${v.nome} atingiu a meta individual de ${brl(v.valorAlvo)}.`,
        acaoLabel: "Destacar",
        tom: "destaque",
      });
    }

    // 2) Quem está mais perto de bater sem ainda ter batido (atenção) — menor valor restante primeiro.
    const emAndamento = comMeta
      .filter((v) => v.pct < 100)
      .map((v) => ({ ...v, restante: v.valorAlvo - v.realizado }))
      .sort((a, b) => a.restante - b.restante);
    if (emAndamento[0]) {
      const v = emAndamento[0];
      insights.push({
        id: `falta-meta-${v.id}`,
        texto: `${v.nome} precisa de ${brl(v.restante)} para atingir a meta mensal.`,
        acaoLabel: "Analisar",
        tom: "atencao",
      });
    }

    return insights;
  }
}
