"use client";

/**
 * Reexporta o `Command` do shadcn com os nomes do CRM 2.0.
 *
 * Tinha ZERO consumidores: 117 linhas duplicando o `command.tsx` que já
 * estava instalado. Vira reexportação em vez de sumir porque remover arquivo
 * de legado depende de autorização, e reexportar é risco zero. Nada novo deve
 * importar daqui.
 */
export {
  Command as Cf2Command,
  CommandDialog as Cf2CommandDialog,
  CommandEmpty as Cf2CommandEmpty,
  CommandGroup as Cf2CommandGroup,
  CommandInput as Cf2CommandInput,
  CommandItem as Cf2CommandItem,
  CommandList as Cf2CommandList,
  CommandSeparator as Cf2CommandSeparator,
} from "@/components/ui/command";
