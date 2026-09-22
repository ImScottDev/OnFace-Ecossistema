"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

/**
 * Adaptadores de select do CRM 2.0 sobre o `Select` do shadcn.
 *
 * Era a mesma composição do `select.tsx` da biblioteca, sobre o mesmo Radix,
 * com borda e fundo inline. 2 consumidores.
 *
 * O que vem de graça: os botões de rolagem quando a lista passa da viewport,
 * o indicador de item escolhido posicionado pelo componente, e o `z-popover`,
 * que faz o select abrir acima de modal — antes, em `z-50`, ele abria atrás
 * dos modais feitos à mão.
 */

export const Cf2Select = Select;
export const Cf2SelectGroup = SelectGroup;
export const Cf2SelectValue = SelectValue;

export function Cf2SelectTrigger({ className, ...props }: React.ComponentProps<typeof SelectTrigger>) {
  return <SelectTrigger className={cn("text-[13px]", className)} {...props} />;
}

export function Cf2SelectContent({ className, ...props }: React.ComponentProps<typeof SelectContent>) {
  return <SelectContent className={cn("text-[13px]", className)} {...props} />;
}

export function Cf2SelectItem({ className, ...props }: React.ComponentProps<typeof SelectItem>) {
  return <SelectItem className={cn("text-[13px]", className)} {...props} />;
}
