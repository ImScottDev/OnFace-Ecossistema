/**
 * Paleta dos gráficos de Insights no tema claro.
 *
 * O módulo legado usava uma rampa de branco translúcido (`rgba(255,255,255,
 * 0.16 → 0.68)`) sobre fundo escuro. Traduzir isso por opacidade daria
 * cinza-claro sobre branco — série invisível. Aqui a rampa é reconstruída em
 * tons sólidos de ardósia, mantendo a MESMA leitura: quanto mais escuro,
 * mais avançado no funil.
 *
 * Os acentos semânticos (ganho, alerta, perda) não mudam: já eram cores
 * sólidas e legíveis nos dois temas.
 */

/** Rampa sequencial, do topo do funil (claro) pro fundo (escuro). */
export const ESCALA_FUNIL = [
  "#dfe3ea",
  "#c9cfda",
  "#aab3c3",
  "#8b95a8",
  "#6b768c",
  "#4d5871",
] as const;

/** Marca-passo / tique neutro de eixo. */
export const TIQUE_NEUTRO = "var(--cf2-border-default)";

/** Barra ou faixa neutra de destaque discreto. */
export const FAIXA_NEUTRA = "#c9cfda";

/**
 * Paleta categórica dos donuts. Marca primeiro, depois a rampa de ardósia —
 * mesma ordem de leitura do módulo legado, só que legível no claro.
 */
export const CATEGORICA = [
  "var(--cf2-accent)",
  "#4d5871",
  "#6b768c",
  "#8b95a8",
  "#aab3c3",
  "#c9cfda",
  "#dfe3ea",
] as const;
