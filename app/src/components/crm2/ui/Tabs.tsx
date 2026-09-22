"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/cn";

/**
 * Adaptadores de abas do CRM 2.0 sobre as `Tabs` do shadcn.
 *
 * Eram quatro wrappers do `@radix-ui/react-tabs` cru, com trilho e pílula
 * desenhados inline — ou seja, a mesma composição que o `tabs.tsx` do shadcn
 * já fazia no repo, escrita de novo. 6 consumidores, migrados pelo miolo.
 *
 * Um importador a menos do `@radix-ui/react-*` individual: o shadcn importa o
 * pacote unificado `radix-ui`, e o repo carrega os dois, que é dívida
 * conhecida.
 *
 * A altura fica em 13px por `className` porque é a densidade que as seis telas
 * já usam. O resto (trilho, estado ativo, foco, teclado) é da biblioteca.
 */

export const Cf2Tabs = Tabs;

export function Cf2TabsList({ className, ...props }: React.ComponentProps<typeof TabsList>) {
  return <TabsList className={className} {...props} />;
}

export function Cf2TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
  return <TabsTrigger className={cn("text-[13px]", className)} {...props} />;
}

export function Cf2TabsContent({ className, ...props }: React.ComponentProps<typeof TabsContent>) {
  return <TabsContent className={cn("mt-3 outline-none", className)} {...props} />;
}
