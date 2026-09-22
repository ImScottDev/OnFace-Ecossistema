"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

/**
 * Adaptadores de campo do CRM 2.0 sobre `Input`, `Textarea` e `Label` do
 * shadcn.
 *
 * Eram três campos paralelos com borda, fundo e foco inline. O que o repo já
 * tinha instalado e não era usado por eles traz de graça o que a versão à mão
 * não tinha: anel de foco de 3px, estado `aria-invalid` com anel vermelho,
 * `data-slot` para o CSS alcançar, e o `Label` desabilitando junto com o
 * `peer`.
 *
 * São 21 `Cf2Input`, 24 `Cf2Label` e 2 `Cf2Textarea`. Trocar o miolo migra
 * todos de uma vez.
 *
 * O `Label` aqui importava `@radix-ui/react-label` direto enquanto o do
 * shadcn importa o pacote unificado `radix-ui`. O repo carrega os dois, que é
 * dívida conhecida; um importador a menos do pacote antigo.
 */

export function Cf2Input({ className, ...props }: React.ComponentProps<"input">) {
  return <Input className={className} {...props} />;
}

export function Cf2Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <Textarea className={cn("min-h-20 resize-y", className)} {...props} />;
}

/** 13px e tom de apoio: é o tamanho que as 24 chamadas já desenham ao lado de
 * campos densos, e o `Label` do shadcn vem em 14px. */
export function Cf2Label({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label className={cn("text-[13px] text-muted-foreground", className)} {...props} />;
}
