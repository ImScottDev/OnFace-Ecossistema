"use client";

/**
 * Reexporta o `Tooltip` do shadcn com os nomes do CRM 2.0.
 *
 * Tinha ZERO consumidores: era um duplicado morto do `tooltip.tsx` que já
 * estava instalado. Vira reexportação em vez de sumir porque remover arquivo
 * de legado depende de autorização, e reexportar é risco zero. Nada novo deve
 * importar daqui.
 */
export {
  Tooltip as Cf2Tooltip,
  TooltipContent as Cf2TooltipContent,
  TooltipProvider as Cf2TooltipProvider,
  TooltipTrigger as Cf2TooltipTrigger,
} from "@/components/ui/tooltip";
