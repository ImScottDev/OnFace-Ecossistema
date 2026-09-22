import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils/cn"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",

        /* Variantes de DOMÍNIO, adicionadas ao componente do shadcn em vez de
         * num badge paralelo. O shadcn não traz semântica de status porque ela
         * é do produto, e estender `badgeVariants` é o caminho que a própria
         * doc indica: o componente mora no repo e é nosso.
         *
         * Elas lêem o par semântico por token, nunca hex. É isso que faz o
         * badge continuar legível dentro de uma ilha
         * `[data-cf2-superficie="escura"]`, onde o escopo reescreve os dois
         * lados do par. A versão anterior, em `crm2/ui/Badge.tsx`, mantinha
         * DUAS tabelas de hex justamente porque o escopo só reescrevia o
         * texto; o escopo foi completado e as tabelas deixaram de ser
         * necessárias.
         *
         * `danger` convive com `destructive` e não o substitui: `destructive`
         * é preenchimento sólido para ação destrutiva, `danger` é o estado
         * "isto está ruim" em tinta suave. */
        success: "bg-[var(--cf2-success-bg)] text-[var(--cf2-success-text)]",
        warning: "bg-[var(--cf2-warning-bg)] text-[var(--cf2-warning-text)]",
        danger: "bg-[var(--cf2-negativo-bg)] text-[var(--cf2-negativo-fg)]",
        info: "bg-[var(--cf2-informativo-bg)] text-[var(--cf2-informativo-fg)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
