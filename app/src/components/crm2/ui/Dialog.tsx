"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

/**
 * Adaptadores de diálogo do CRM 2.0 sobre o `Dialog` do shadcn.
 *
 * Era uma reimplementação do `dialog.tsx` do shadcn sobre o
 * `@radix-ui/react-dialog` cru: mesmo portal, mesmo overlay, mesmo
 * `showCloseButton`, com cor e sombra inline em vez de token. 9 consumidores,
 * migrados pelo miolo.
 *
 * **O que impedia a troca era o empilhamento**, e foi resolvido antes: o
 * shadcn põe todo overlay em `z-50` e o produto tinha nove números soltos
 * entre 60 e 1100, então trocar direto mandaria o diálogo para trás de meia
 * dúzia de camadas. Agora a biblioteca lê `--z-modal`/`--z-popover`
 * (`onface.css`), acima de tudo que existe hoje, com menu acima de modal
 * porque menu abre dentro de modal.
 *
 * `sm:max-w-md` continua por `className`: o shadcn abre em `sm:max-w-lg` e os
 * 9 diálogos do produto foram desenhados na largura menor. Tem que ser no
 * mesmo breakpoint — `max-w-md` puro perde para `sm:max-w-lg`, que vem depois
 * na folha e o tailwind-merge não deduplica entre breakpoints. Medido: abria
 * em 512px em vez de 448. Largura é decisão de
 * cada diálogo; superfície e comportamento são da biblioteca.
 */

export const Cf2Dialog = Dialog;
export const Cf2DialogTrigger = DialogTrigger;
export const Cf2DialogClose = DialogClose;

export function Cf2DialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return <DialogContent className={cn("sm:max-w-md", className)} {...props} />;
}

export function Cf2DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <DialogHeader className={cn("gap-1.5", className)} {...props} />;
}

export function Cf2DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle className={cn("text-base", className)} {...props} />;
}

export function Cf2DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription className={cn("text-[13px]", className)} {...props} />;
}

export function Cf2DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <DialogFooter className={cn("mt-2", className)} {...props} />;
}
