"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Adaptador do botão do CRM 2.0 sobre o `Button` do shadcn.
 *
 * Este arquivo era um botão PARALELO, e um duplicado sem nada a mais: o
 * `Button` do shadcn no repo já tem `asChild`, `loading` com spinner e
 * bloqueio de duplo-envio, `disabled`, dez variantes e oito tamanhos. O que
 * havia aqui era um subconjunto disso, escrito de novo com `style` inline
 * em vez de variante.
 *
 * São 75 chamadas em 17 arquivos. Trocar o miolo migra as 75 de uma vez.
 * Quando o último consumidor chamar `Button` direto, este arquivo sai.
 *
 * `React.forwardRef` saiu junto: nenhum consumidor passa `ref`, e no React 19
 * `ref` chega como prop normal.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

/** Os quatro nomes do CRM 2.0 para o vocabulário do shadcn.
 *
 * `secondary` daqui era superfície + borda + tinta, que é o `outline` do
 * shadcn, não o `secondary` dele (que é preenchimento escuro sólido). Traduzir
 * pelo NOME em vez de pelo desenho teria invertido 25 botões.
 *
 * `danger` era um contorno vermelho; vira `destructive`, que é sólido. São
 * três usos, todos em Propostas, e todos são a confirmação destrutiva de
 * verdade ("Recusar Proposta", "Excluir") ou o gatilho dela. Sólido no botão
 * que confirma é a convenção do shadcn e não esconde o peso da ação. */
const PARA_SHADCN = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
} as const;

/** `md` do CRM 2.0 é h-9, que é o `default` do shadcn. Os outros três batem. */
const TAMANHO = {
  sm: "sm",
  md: "default",
  lg: "lg",
  icon: "icon",
} as const;

export interface Cf2ButtonProps extends React.ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
}

export function Cf2Button({
  variant = "primary",
  size = "md",
  ...props
}: Cf2ButtonProps) {
  return <Button variant={PARA_SHADCN[variant]} size={TAMANHO[size]} {...props} />;
}
