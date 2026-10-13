/**
 * Período de cobrança dos itens da proposta e total por período (PURO).
 *
 * Uma proposta mistura recorrências: mensalidade, anuidade e itens únicos. Somar
 * tudo num número só engana, e dizer "/mês" sobre uma anuidade é pior. A fonte
 * do período é o PRICE do catálogo (`catalogo_precos.periodo`: mensal | anual |
 * unico), a mesma que a página pública e o PDF já liam. Não há segunda fonte.
 *
 * Só a linha LEGADA, sem Price, cai no que o `tipo` diz: recorrente era sempre
 * mensal; o resto é pagamento único. Essas linhas voltam em `deduzidos`, para a
 * tela poder dizer que o período delas não veio do catálogo.
 *
 * Módulo sem banco: Client Component pode importar.
 */

export type PeriodoDeCobranca = "mensal" | "anual" | "unico";

export interface ItemParaPeriodo {
  subtotal: number | string;
  /** `catalogo_precos.periodo` do Price da linha; null quando a linha não tem Price. */
  periodo?: string | null;
  tipo: string;
  natureza?: string | null;
}

const PERIODOS: readonly string[] = ["mensal", "anual", "unico"];

/** O período de uma linha: o do Price; sem ele, o que o tipo da linha legada diz. */
export function periodoDoItem(i: Pick<ItemParaPeriodo, "periodo" | "tipo" | "natureza">): { periodo: PeriodoDeCobranca; doPreco: boolean } {
  if (i.periodo && PERIODOS.includes(i.periodo)) return { periodo: i.periodo as PeriodoDeCobranca, doPreco: true };
  const recorrente = i.tipo === "recorrente" || i.natureza === "MRR";
  return { periodo: recorrente ? "mensal" : "unico", doPreco: false };
}

export interface TotaisPorPeriodo {
  mensal: number;
  anual: number;
  unico: number;
  /** Quantas linhas tiveram o período deduzido do tipo (linha legada, sem Price). */
  deduzidos: number;
}

/** Soma em centavos: 0,1 + 0,2 fecha em 0,3. */
export function totaisPorPeriodo(itens: ItemParaPeriodo[]): TotaisPorPeriodo {
  const c = { mensal: 0, anual: 0, unico: 0 };
  let deduzidos = 0;
  for (const i of itens) {
    const { periodo, doPreco } = periodoDoItem(i);
    if (!doPreco) deduzidos++;
    c[periodo] += Math.round((Number(i.subtotal) || 0) * 100);
  }
  return { mensal: c.mensal / 100, anual: c.anual / 100, unico: c.unico / 100, deduzidos };
}

/** Quantos meses de cobrança anual cabem no prazo (12 meses = 1 anuidade, 18 = 1,5). */
export function anuidadesNoPrazo(prazoMeses: number): number {
  return prazoMeses > 0 ? prazoMeses / 12 : 0;
}

/** Valor contratado no prazo: mensalidade × meses + anuidade × (meses/12) + únicos. Sem prazo, sem total. */
export function totalNoPrazo(t: TotaisPorPeriodo, prazoMeses: number | null): number | null {
  if (!prazoMeses || prazoMeses <= 0) return null;
  const centavos = Math.round(t.mensal * 100) * prazoMeses + Math.round(Math.round(t.anual * 100) * anuidadesNoPrazo(prazoMeses)) + Math.round(t.unico * 100);
  return Math.round(centavos) / 100;
}

export const ROTULO_PERIODO: Record<PeriodoDeCobranca, string> = {
  mensal: "Mensal", anual: "Anual", unico: "Único",
};

/** Sufixo do valor: "/mês", "/ano" ou nada. */
export const SUFIXO_PERIODO: Record<PeriodoDeCobranca, string> = {
  mensal: "/mês", anual: "/ano", unico: "",
};
