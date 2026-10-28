/* ─────────────────────────────────────────────────────────────────────────
 * Onde um menu ancorado cabe na tela.
 *
 * O menu é `position:fixed` logo abaixo do botão, então quem limita a altura
 * dele é o espaço até a borda da janela — não a janela inteira. Com
 * `max-height` da janela inteira, uma lista longa (a equipe toda, no seletor
 * de responsável) descia para fora da tela sem nunca atingir o limite: o
 * `overflow-y:auto` não ligava, e como o menu é fixo a página também não
 * rolava. Só diminuir o zoom fazia aparecer o resto.
 * ───────────────────────────────────────────────────────────────────────── */

/** Retângulo do botão que ancora o menu, em coordenadas de viewport. */
export interface AncoraDoMenu {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface CaixaDoMenu {
  paraCima: boolean;
  /** Altura máxima do menu: o espaço que sobra do lado escolhido. */
  altura: number;
}

/** Folga entre o botão e o menu, e entre o menu e a borda da janela. */
const FOLGA_ANCORA = 6;
const FOLGA_BORDA = 12;

/**
 * Escolhe o lado com mais espaço quando o de baixo não cabe o menu inteiro, e
 * devolve a altura REAL disponível desse lado. O menu nunca passa da borda:
 * o que não couber rola dentro dele.
 */
export function caixaDoMenu(ancora: AncoraDoMenu, alturaDaJanela: number, alturaDesejada: number): CaixaDoMenu {
  const abaixo = alturaDaJanela - ancora.bottom - FOLGA_ANCORA - FOLGA_BORDA;
  const acima = ancora.top - FOLGA_ANCORA - FOLGA_BORDA;
  const paraCima = abaixo < alturaDesejada && acima > abaixo;
  return { paraCima, altura: Math.max(0, paraCima ? acima : abaixo) };
}

/** O CSS do menu posicionado — `max-height` pelo espaço real, para o scroll funcionar. */
export function estiloDoMenu(ancora: AncoraDoMenu, alturaDaJanela: number, alturaDesejada: number, larguraMinima = 236): string {
  const { paraCima, altura } = caixaDoMenu(ancora, alturaDaJanela, alturaDesejada);
  const vertical = paraCima
    ? "bottom:" + (alturaDaJanela - ancora.top + FOLGA_ANCORA) + "px;"
    : "top:" + (ancora.bottom + FOLGA_ANCORA) + "px;";
  return vertical
    + "left:" + ancora.left + "px;"
    + "width:" + Math.max(larguraMinima, ancora.width) + "px;"
    + "max-height:" + altura + "px;";
}
