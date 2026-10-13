"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"
import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils/cn"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

/* ---------- Usuário (pessoa ou agente de IA) ---------- */

/** Nomes dos agentes de IA da organização, fornecidos pela casca. Serve às telas
 *  que só têm o NOME do usuário (os desenhos do Claude Design passam strings). */
export const AgentesDaOrgContexto = React.createContext<ReadonlySet<string>>(new Set())

export const ROTULO_AGENTE_IA = "Agente de IA"

export function useEhAgente(nome?: string | null, ehAgente?: boolean) {
  const nomes = React.useContext(AgentesDaOrgContexto)
  return ehAgente ?? (!!nome && nomes.has(nome))
}

/** Selo de IA: o mesmo em qualquer tela. Cor por token. */
function SeloIA({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="selo-ia"
      role="img"
      title={ROTULO_AGENTE_IA}
      aria-label={ROTULO_AGENTE_IA}
      className={cn("inline-flex shrink-0 items-center justify-center align-middle text-primary", className)}
      {...props}
    >
      <Sparkles className="size-[1em]" aria-hidden />
    </span>
  )
}

/** Conteúdo de um avatar de usuário: iniciais; agente de IA mostra o selo no lugar. */
function IniciaisUsuario({ nome, iniciais, ehAgente }: { nome?: string | null; iniciais?: string; ehAgente?: boolean }) {
  const ia = useEhAgente(nome, ehAgente)
  if (ia) return <SeloIA className="size-[1.25em]" />
  return <>{iniciais ?? iniciaisDoNome(nome)}</>
}

/** Nome com selo de IA ao lado quando for agente. */
function NomeUsuario({ nome, ehAgente, className }: { nome: string; ehAgente?: boolean; className?: string }) {
  const ia = useEhAgente(nome, ehAgente)
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className="truncate">{nome}</span>
      {ia ? <SeloIA className="size-3" /> : null}
    </span>
  )
}

function iniciaisDoNome(nome?: string | null) {
  return (nome ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => [...p][0]).join("").toUpperCase() || "—"
}

/** Avatar de usuário: variante `agente` sobrepõe o selo de IA no canto. */
function AvatarUsuario({
  nome, ehAgente, size, className, src,
}: { nome: string; ehAgente?: boolean; size?: "default" | "sm" | "lg"; className?: string; src?: string | null }) {
  const ia = useEhAgente(nome, ehAgente)
  return (
    <Avatar size={size} className={cn("overflow-visible", className)} title={ia ? `${nome} · ${ROTULO_AGENTE_IA}` : nome}>
      {src ? <AvatarImage src={src} alt="" className="rounded-full" /> : null}
      <AvatarFallback>{iniciaisDoNome(nome)}</AvatarFallback>
      {ia ? (
        <AvatarBadge title={ROTULO_AGENTE_IA} aria-label={ROTULO_AGENTE_IA} className="!size-3.5 [&>svg]:!block [&>svg]:!size-2.5">
          <Sparkles aria-hidden />
        </AvatarBadge>
      ) : null}
    </Avatar>
  )
}

export {
  SeloIA,
  IniciaisUsuario,
  NomeUsuario,
  AvatarUsuario,
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
}
