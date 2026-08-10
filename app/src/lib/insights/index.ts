import { HeuristicInsightProvider } from "./heuristic-provider";
import type { InsightInput, Insight } from "./types";

export type { Insight, InsightInput, VendedorMetaInput, InsightProvider } from "./types";

// Provider ativo — troca de heurística pra IA (quando a Groq estiver
// disponível e a decisão for tomada) é UMA linha aqui, zero mudança na UI
// que consome gerarInsights().
const provider = new HeuristicInsightProvider();

export function gerarInsights(input: InsightInput): Insight[] {
  return provider.gerar(input);
}
