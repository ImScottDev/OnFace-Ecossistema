"use client";

import { Badge } from "@/components/ui/badge";

/**
 * Adaptador do badge do CRM 2.0 sobre o `Badge` do shadcn.
 *
 * Este arquivo era um badge PARALELO: um `<span>` próprio com duas tabelas de
 * hex, uma para fundo claro e outra para fundo escuro, e um prop `dark` para
 * escolher entre elas. O shadcn já traz `Badge` instalado no repo, e a
 * biblioteca é o contrato: o que faltava nele era semântica de status, que
 * agora vive lá como variante (`success`/`warning`/`danger`/`info`), lendo
 * token, não hex.
 *
 * Fica como adaptador em vez de sumir porque são 33 arquivos chamando
 * `Cf2Badge` com cinco nomes de variante próprios. Trocar o MIOLO migra os 33
 * de uma vez; trocar as chamadas seria 33 diffs para o mesmo resultado. Quando
 * o último consumidor migrar para `Badge`, este arquivo sai.
 *
 * As duas tabelas de hex saíram por inteiro. A razão delas era real (dentro de
 * uma ilha escura o escopo reescrevia a metade `-text` de cada par semântico e
 * deixava a `-bg` clara, e "Ganho" saía verde-claro sobre verde-claro, 1,6:1,
 * achado do Kauã em 25/08), mas o contorno estava no componente e a causa
 * estava no token: o escopo `[data-cf2-superficie="escura"]` agora reescreve
 * os dois lados, medido em 7,65:1 (verde), 7,48:1 (âmbar) e 4,94:1
 * (vermelho) sobre os dois fundos escuros do produto.
 *
 * O que muda na tela: o badge passa a ter a forma do shadcn, pílula de
 * `rounded-full` com 12px, no lugar do `rounded-md` de 10px em negrito. É a
 * forma da biblioteca, que é o ponto.
 */

type Variant = "success" | "warning" | "danger" | "neutral" | "accent";

/** Os cinco nomes do CRM 2.0 para as variantes do shadcn. `neutral` é o
 * `secondary` do shadcn e `accent` é o `default`, que já é o coral da marca. */
const PARA_SHADCN = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "secondary",
  accent: "default",
} as const;

export function Cf2Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: Variant;
  /** Aceito e ignorado. O único chamador que passava `dark` estava dentro de
   * uma superfície CLARA (`--cf2-bg-surface-muted` resolve para #EEEFF3), ou
   * seja, pintava o verde de alto brilho sobre quase-branco. O prop não era
   * necessidade, era defeito. Fica na assinatura para não quebrar chamada. */
  dark?: boolean;
}) {
  return <Badge variant={PARA_SHADCN[variant]}>{children}</Badge>;
}
