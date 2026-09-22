import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils/cn"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",

        /* Variantes de DOMÍNIO, no componente do shadcn e não num alerta
         * paralelo. Lêem o par semântico por token, então continuam legíveis
         * dentro de uma ilha `[data-cf2-superficie="escura"]`, onde o escopo
         * reescreve os dois lados do par.
         *
         * `warning` é "não deu para carregar, tente de novo": a leitura
         * falhou mas nada quebrou. `destructive` continua sendo o que o
         * shadcn diz que é, consequência destrutiva. */
        warning:
          "border-transparent bg-[var(--cf2-warning-bg)] text-[var(--cf2-warning-text)] *:data-[slot=alert-description]:text-current [&>svg]:text-current",
        info:
          "border-transparent bg-[var(--cf2-informativo-bg)] text-[var(--cf2-informativo-fg)] *:data-[slot=alert-description]:text-current [&>svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
