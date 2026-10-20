/**
 * Navegação por seta de grupo de escolha (WAI-ARIA): Tab entra no grupo, a
 * seta anda DENTRO dele.
 *
 * Só a aritmética, sem DOM e sem React, porque é o que tem caso de borda:
 * circular nas pontas, Home/End, e tecla que não é de navegação (que precisa
 * passar reto, senão a página deixa de rolar com PageDown dentro de um
 * segmento). Quem mexe no DOM é `components/onface/ds/escolha.tsx`, o único
 * ponto de entrada de `role="radiogroup"` e `role="tablist"` do produto.
 *
 * Orientação: um `radiogroup`/`tablist` em linha responde a ←/→ e um em
 * coluna a ↑/↓. "ambas" aceita as quatro, que é o que os segmentos do ONFACE
 * precisam — eles viram coluna no 390px sem trocar de componente.
 */

export type Direcao = "anterior" | "proximo" | "primeiro" | "ultimo";

export type Orientacao = "horizontal" | "vertical" | "ambas";

/** `null` quando a tecla não é de navegação: quem chamou deve deixar passar. */
export function direcaoDaTecla(tecla: string, orientacao: Orientacao = "ambas"): Direcao | null {
  const horizontal = orientacao !== "vertical";
  const vertical = orientacao !== "horizontal";
  if (tecla === "ArrowRight" && horizontal) return "proximo";
  if (tecla === "ArrowLeft" && horizontal) return "anterior";
  if (tecla === "ArrowDown" && vertical) return "proximo";
  if (tecla === "ArrowUp" && vertical) return "anterior";
  if (tecla === "Home") return "primeiro";
  if (tecla === "End") return "ultimo";
  return null;
}

/**
 * Índice de destino dentro do grupo. Circular: da última opção a seta
 * seguinte volta para a primeira, como manda o padrão de radiogroup.
 *
 * `atual` igual a -1 (nada marcado ainda, foco acabou de entrar) começa pela
 * primeira opção. Grupo vazio devolve -1, e quem chamou não navega.
 */
export function indiceAlvo(direcao: Direcao, atual: number, total: number): number {
  if (total <= 0) return -1;
  const de = atual < 0 ? 0 : Math.min(atual, total - 1);
  if (direcao === "primeiro") return 0;
  if (direcao === "ultimo") return total - 1;
  const passo = direcao === "proximo" ? 1 : -1;
  return (de + passo + total) % total;
}
