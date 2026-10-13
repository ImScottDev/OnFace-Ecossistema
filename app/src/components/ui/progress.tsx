"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils/cn"

/* Tom de DOMÍNIO, variante do próprio componente (não um medidor paralelo):
 * o preenchimento carrega a gravidade — consumo perto do teto é `atencao`,
 * estourado é `perigo`. `neutro` é o medidor que só informa proporção. */
const TOM_INDICADOR = {
  padrao: "bg-primary",
  neutro: "bg-tinta",
  atencao: "bg-atencao",
  perigo: "bg-negativo",
} as const

function Progress({
  className,
  value,
  tom = "padrao",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { tom?: keyof typeof TOM_INDICADOR }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 transition-all", TOM_INDICADOR[tom])}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
