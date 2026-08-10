/**
 * Insight Engine — camada desacoplada entre dado real e texto de
 * recomendação exibido na UI (Command Center, "Callface AI - Insights de
 * Gestão"). Decisão explícita do Kauã (09/08): V1 usa heurística (regra
 * matemática clara sobre dado real), NÃO IA — mas a interface já é
 * desenhada pra um provider de IA substituir o heurístico depois SEM
 * mudar nada na UI.
 *
 *   Dados → Insight Engine → Insight → UI                 (hoje)
 *   Dados → AI Insight Engine → Insight → UI               (futuro)
 */
export interface Insight {
  id: string;
  texto: string;
  acaoLabel?: string;
  acaoHref?: string;
  /** só estilístico (cor do texto de ação) — nunca decisão de negócio */
  tom: "atencao" | "destaque";
}

export interface VendedorMetaInput {
  id: string;
  nome: string;
  valorAlvo: number;
  realizado: number;
  pct: number;
}

export interface InsightInput {
  vendedores: VendedorMetaInput[];
}

export interface InsightProvider {
  gerar(input: InsightInput): Insight[];
}
