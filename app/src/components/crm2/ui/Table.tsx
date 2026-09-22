"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

/**
 * Adaptadores de tabela do CRM 2.0 sobre a `Table` do shadcn.
 *
 * Eram seis wrappers de `<table>`/`<tr>`/`<td>` com borda e cor inline,
 * enquanto a `Table` do shadcn estava instalada no repo e usada por UM
 * arquivo. São 7 consumidores aqui; trocar o miolo migra os 7.
 *
 * O que vem de graça da biblioteca: `data-slot` em cada parte (o CSS alcança
 * sem depender da tag), linha selecionada por `data-[state=selected]`,
 * tratamento de célula com checkbox, e o `hover` por token em vez de hex.
 *
 * A densidade do CRM 2.0 é mantida por `className`: a célula do shadcn é
 * `p-2` e aqui é `px-3 py-2.5`, que é o ritmo que as tabelas do produto já
 * têm. Densidade é decisão de produto; superfície e comportamento são da
 * biblioteca.
 */

export function Cf2Table({ className, ...props }: React.ComponentProps<"table">) {
  return <Table className={cn("border-collapse", className)} {...props} />;
}

export function Cf2TableHeader(props: React.ComponentProps<"thead">) {
  return <TableHeader {...props} />;
}

export function Cf2TableBody(props: React.ComponentProps<"tbody">) {
  return <TableBody {...props} />;
}

export function Cf2TableRow(props: React.ComponentProps<"tr">) {
  return <TableRow {...props} />;
}

export function Cf2TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <TableHead className={cn("px-3 text-xs font-semibold text-muted-foreground", className)} {...props} />;
}

export function Cf2TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <TableCell className={cn("px-3 py-2.5", className)} {...props} />;
}
