import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils/cn"

/**
 * Button — base do shadcn, adaptada ao Callface UI System.
 *
 * ATENÇÃO: `npx shadcn add <qualquer-coisa-que-dependa-de-button>` SOBRESCREVE
 * este arquivo (aconteceu em 31/08 ao instalar o lote de charts/blocks). Se o
 * botão voltar a ficar preto-no-preto ou perder o `loading`, foi isso — o
 * conteúdo correto está aqui e no git.
 *
 * O que muda em relação ao que o CLI entrega:
 *  - CORRIGE contraste: `outline`/`ghost` usavam `bg-background`, que no shell
 *    claro resolvia pro preto do tema escuro legado — botão preto com texto
 *    preto, "aparecendo" só no hover.
 *  - HIERARQUIA de 5 degraus (primary → secondary → tertiary → subtle → ghost),
 *    na linha do Once UI. Com dois níveis tudo vira "primário ou nada".
 *  - VARIANTES SEMÂNTICAS (success/warning/destructive): ação com consequência
 *    carrega a cor do significado.
 *  - `loading` embutido: bloqueia interação e impede duplo-envio.
 *  - Raio, foco e alvo de toque (44px no mobile) do design system.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-control font-medium cf2-transicao cf2-alvo-toque outline-none",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "bg-marca text-marca-tinta hover:brightness-105 active:brightness-95",
        secondary: "bg-tinta text-white hover:opacity-90",
        tertiary: "bg-superficie-alt text-tinta hover:brightness-95",
        outline: "border border-linha bg-superficie text-tinta hover:bg-superficie-alt",
        subtle: "bg-transparent text-tinta-suave hover:bg-superficie-alt hover:text-tinta",
        ghost: "bg-transparent text-tinta hover:bg-superficie-alt",
        link: "bg-transparent text-tinta underline-offset-4 hover:underline p-0 h-auto",
        destructive: "bg-negativo text-white hover:brightness-105",
        success: "bg-positivo-solido text-white hover:brightness-105",
        warning: "bg-atencao text-atencao-tinta hover:brightness-105",
      },
      size: {
        xs: "h-6 gap-1 px-2 text-micro rounded-chip [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-corpo",
        default: "h-9 px-4 text-corpo",
        lg: "h-11 px-6 text-item",
        icon: "size-9",
        "icon-xs": "size-6 rounded-chip [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
      fillWidth: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "default", size: "default", fillWidth: false },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  fillWidth,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Mostra spinner e bloqueia interação. Impede duplo-envio. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size, fillWidth, className }))}
      {...props}
    >
      {/* asChild recebe um único filho: não dá pra injetar o spinner sem
          quebrar o Slot, então nesse caso o botão passa o children direto. */}
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
