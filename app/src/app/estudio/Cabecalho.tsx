"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { resolverPagina } from "./paginas";

/**
 * Barra do topo do cartão de conteúdo.
 *
 * Ela carrega o nome da página, que antes gastava uma faixa inteira de altura
 * dentro do conteúdo só para repetir o que o menu já dizia. À direita ficam
 * busca e notificações, as duas únicas ações que não pertencem a uma tela
 * específica; ajustes desceu para o menu do usuário, junto de sair.
 */
export function Cabecalho() {
  const pathname = usePathname();
  const pagina = resolverPagina(pathname);

  return (
    <header className="estudio-cabecalho">
      <SidebarTrigger className="-ml-1.5 shrink-0 text-[var(--tinta-fraca)]" />
      <Separator orientation="vertical" className="h-4 shrink-0 bg-[var(--fio)]" />

      <div className="flex min-w-0 items-baseline gap-2.5">
        <h1 className="shrink-0 text-sm font-semibold tracking-tight text-[var(--tinta-forte)]">
          {pagina.titulo}
        </h1>
        {pagina.apoio && (
          <p className="hidden truncate text-xs text-[var(--tinta-fraca)] sm:block">
            {pagina.apoio}
          </p>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 text-[var(--tinta-fraca)]" aria-label="Buscar">
              <Search className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Buscar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative size-8 text-[var(--tinta-fraca)]" aria-label="Notificações, 3 não lidas">
              <Bell className="size-4" aria-hidden />
              {/* Ponto, não número: o contador exato vive no painel. Aqui só
                  precisa dizer que existe algo novo. */}
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--coral-marca)] ring-2 ring-[var(--card)]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>3 notificações</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
