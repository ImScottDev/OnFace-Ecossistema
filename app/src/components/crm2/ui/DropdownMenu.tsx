"use client";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

/**
 * Adaptadores de menu do CRM 2.0 sobre o `DropdownMenu` do shadcn.
 *
 * A API era 1:1 com a da biblioteca: mesmas catorze peças, sobre o mesmo
 * Radix, com cor e raio inline em vez de token. 10 consumidores, migrados
 * pelo miolo.
 *
 * O que vem de graça: indicador de item marcado posicionado pelo componente
 * (a versão à mão desenhava o `Check` na unha em três lugares), `data-inset`,
 * atalho com `DropdownMenuShortcut`, e o submenu com a seta e o
 * posicionamento certos.
 *
 * Agora que a biblioteca lê `--z-popover` (2100), o menu abre ACIMA de
 * modal — inclusive dos modais feitos à mão, que estavam entre 60 e 1100 e
 * cobriam o menu do shadcn em `z-50`.
 */

export const Cf2DropdownMenu = DropdownMenu;
export const Cf2DropdownMenuTrigger = DropdownMenuTrigger;
export const Cf2DropdownMenuGroup = DropdownMenuGroup;
export const Cf2DropdownMenuPortal = DropdownMenuPortal;
export const Cf2DropdownMenuSub = DropdownMenuSub;
export const Cf2DropdownMenuRadioGroup = DropdownMenuRadioGroup;
export const Cf2DropdownMenuSubContent = DropdownMenuSubContent;
export const Cf2DropdownMenuSubTrigger = DropdownMenuSubTrigger;
export const Cf2DropdownMenuLabel = DropdownMenuLabel;
export const Cf2DropdownMenuSeparator = DropdownMenuSeparator;
export const Cf2DropdownMenuCheckboxItem = DropdownMenuCheckboxItem;
export const Cf2DropdownMenuRadioItem = DropdownMenuRadioItem;

export function Cf2DropdownMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return <DropdownMenuContent className={cn("text-[13px]", className)} {...props} />;
}

/** `destructive` booleano do CRM 2.0 vira `variant="destructive"`, que o
 * shadcn já tem — e que, além da cor do texto, trata o realce no foco e a cor
 * do ícone, coisas que a versão à mão não fazia. Três chamadas usam. */
export function Cf2DropdownMenuItem({
  destructive,
  ...props
}: React.ComponentProps<typeof DropdownMenuItem> & { destructive?: boolean }) {
  return <DropdownMenuItem variant={destructive ? "destructive" : "default"} {...props} />;
}
