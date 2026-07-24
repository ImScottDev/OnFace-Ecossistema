/**
 * Checklist de conclusão do onboarding — DOIS conjuntos distintos, não um
 * genérico parametrizado, porque AI e PABX são processos de negócio
 * diferentes (decisão do Scott, ver callface/onboarding-cs.md):
 *
 * AI: já cai no ambiente automatizado (pagamento via Stripe antes de chegar
 *   aqui) — o checklist é sobre ATIVAÇÃO/CONTEXTUALIZAÇÃO de uso.
 * PABX: processo de implementação física (contrato → time Wevy → pagamento
 *   confirmado/retornado → implantação de infra telefônica) — não tem nada
 *   a ver com "contextualizar plataforma".
 *
 * "ai_pabx" (venda combinada) exige os dois conjuntos completos.
 */
export type ProdutoOnboarding = "ai" | "pabx" | "ai_pabx";

export const ITENS_POR_PRODUTO: Record<ProdutoOnboarding, string[]> = {
  ai: ["acessos_liberados", "contextualizacao_plataforma", "primeiro_uso_real"],
  pabx: ["contrato_enviado_wevy", "pagamento_confirmado", "implementacao_concluida"],
  ai_pabx: [
    "acessos_liberados",
    "contextualizacao_plataforma",
    "primeiro_uso_real",
    "contrato_enviado_wevy",
    "pagamento_confirmado",
    "implementacao_concluida",
  ],
};

export function itensParaProduto(produto: string | null | undefined): string[] {
  return ITENS_POR_PRODUTO[(produto as ProdutoOnboarding) in ITENS_POR_PRODUTO ? (produto as ProdutoOnboarding) : "ai"];
}

export const CHECKLIST_LABEL: Record<string, string> = {
  acessos_liberados: "Acessos liberados",
  contextualizacao_plataforma: "Contextualização",
  primeiro_uso_real: "1º uso real",
  contrato_enviado_wevy: "Contrato → Wevy",
  pagamento_confirmado: "Pagamento confirmado",
  implementacao_concluida: "Implementação",
};

// Itens confirmados automaticamente pelo sistema (não aceitam toggle manual).
// Hoje só "primeiro_uso_real" (via tabela ligacoes) — generalizar aqui conforme
// novos sinais de uso real forem ficando disponíveis (ver Onda 2/Mixpanel).
export const ITENS_AUTOMATICOS = new Set(["primeiro_uso_real"]);

// Janela de TTV (Time to Value) pro item automático — usada só pra métrica de
// Ativação/TTV do painel de CS, NÃO bloqueia a conclusão se vier depois disso.
export const JANELA_TTV_DIAS = 7;
