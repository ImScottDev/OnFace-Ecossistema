import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Tamanhos de texto do design system (`--text-*` em cf2-design-system.css).
 *
 * O tailwind-merge precisa saber que `text-corpo` é TAMANHO, não cor. Sem isso
 * ele coloca `text-corpo` e `text-marca-tinta` no mesmo grupo de conflito e
 * mantém só o último: como o tamanho vem da variante `size` (aplicada depois da
 * variante `variant`), a COR DO TEXTO era descartada em todo botão preenchido.
 *
 * O sintoma aparecia no produto inteiro: botão coral com texto quase preto
 * (3,4:1) e botão `secondary` grafite com texto grafite, ou seja, invisível.
 * Achado no laboratório do design system em 18/09/2026. */
const TAMANHOS_DE_TEXTO = [
  "micro",
  "apoio",
  "corpo",
  "item",
  "titulo",
  "kpi",
  "destaque",
  "hero",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TAMANHOS_DE_TEXTO] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
