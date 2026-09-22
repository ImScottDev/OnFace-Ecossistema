"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  Gauge,
  Headphones,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  NAVEGACAO,
  NAVEGACAO_RODAPE,
  destinoAtivo,
} from "@/components/onface/navegacao"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/**
 * Casca do ONFACE — bloco `sidebar-08` do shadcn, com os dados reais.
 *
 * O bloco é a base acordada para a casca (22/09) e a composição dele fica
 * intacta: `variant="inset"`, cabeçalho em `SidebarMenuButton size="lg"`,
 * `NavMain` com grupos colapsáveis, `NavSecondary` ancorada com `mt-auto` e
 * `NavUser` no rodapé. O que muda é só o `data`, que no bloco vem com
 * "Acme Inc" e "shadcn / m@example.com".
 *
 * Três adaptações, todas obrigatórias, nenhuma estética:
 *
 * 1. `<a href>` vira `Link`. O bloco é uma demo estática; com `<a>` cada
 *    clique no menu recarrega o app inteiro.
 * 2. Os seis grupos de `navegacao.ts` viram os itens-pai do `NavMain`, e os
 *    destinos viram os sub-itens. A árvore continua morando em `navegacao.ts`,
 *    que é a fonte única e tem teste próprio.
 * 3. O pai aponta para o PRIMEIRO destino do grupo, não para `#`. Item de menu
 *    que não leva a lugar nenhum é UI cenográfica, e o repo tem teste que
 *    reprova (`link-nao-leva-pro-vazio`).
 *
 * `nav-projects` do bloco não foi montado: o ONFACE não tem o conceito de
 * "Projects" e uma lista vazia com menu "More" seria cromo sem função.
 */

/** Ícone de família para o item-pai. Os grupos de `navegacao.ts` não têm
 * ícone porque na coluna anterior eram só rótulos de seção; no `NavMain` o pai
 * é uma linha clicável e precisa de um. */
const ICONE_DO_GRUPO: Record<string, LucideIcon> = {
  Comercial: TrendingUp,
  Clientes: Building2,
  Operação: Headphones,
  Automação: Zap,
  Gestão: Gauge,
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const ativo = destinoAtivo(pathname)

  const navMain = NAVEGACAO.flatMap((grupo) => {
    // O grupo sem rótulo (Início) é um destino solto, sem filhos.
    if (!grupo.label) {
      return grupo.itens.map((item) => ({
        title: item.label,
        url: item.href,
        icon: item.icon,
        isActive: ativo === item.href,
      }))
    }
    const contemOAtivo = grupo.itens.some((item) => item.href === ativo)
    return [
      {
        title: grupo.label,
        url: grupo.itens[0].href,
        icon: ICONE_DO_GRUPO[grupo.label] ?? grupo.itens[0].icon,
        // Abre o grupo onde a pessoa está: sem isto ela chega numa coluna
        // fechada e precisa reabrir o próprio contexto a cada navegação.
        isActive: contemOAtivo,
        items: grupo.itens.map((item) => ({
          title: item.label,
          url: item.href,
          isActive: item.href === ativo,
        })),
      },
    ]
  })

  return (
    <Sidebar variant="inset" className="onface-sidebar" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/inicio" aria-label="ONFACE, ir para o início">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <img src="/onface/figma-logo.svg" alt="" className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">ONFACE</span>
                  <span className="truncate text-xs">Operação comercial</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary
          items={NAVEGACAO_RODAPE.map((item) => ({
            title: item.label,
            url: item.href,
            icon: item.icon,
            isActive: ativo === item.href,
          }))}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
