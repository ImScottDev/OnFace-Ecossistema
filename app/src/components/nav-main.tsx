"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"

import type { AreaNav } from "@/components/onface/navegacao"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

/**
 * Árvore da coluna — `nav-main` do bloco `sidebar-08`, com três adaptações que
 * vêm do handoff de 22/09 e não de preferência.
 *
 * 1. **O clique no pai abre o grupo; ele não navega.** O bloco põe um `Link` no
 *    pai e um `SidebarMenuAction` separado só para o chevron, o que dá dois
 *    alvos na mesma linha fazendo coisas diferentes — e o de fora leva para o
 *    primeiro filho, escondendo os outros cinco. No handoff a linha inteira é
 *    o gatilho do grupo. Área SEM filhos continua sendo um link normal.
 * 2. **Rótulo de seção acima da área**, quando `secao` está preenchido. É o que
 *    separa o bloco de inteligência do resto sem inventar um segundo menu.
 * 3. **O grupo que contém a página aberta nasce aberto.** `defaultOpen` só vale
 *    na montagem e o layout não remonta em navegação client-side, então sem a
 *    chave a área abre na primeira visita e nunca mais. A chave muda quando a
 *    área entra ou sai de ativa: remonta só ela e preserva o que a pessoa
 *    abriu à mão nas outras.
 */
/** Quebra a lista plana em blocos: um bloco novo começa em toda área que
 *  declara `secao`. É o que permite o rótulo de seção ser um
 *  `SidebarGroupLabel` de verdade, irmão da lista, em vez de um rótulo
 *  enfiado dentro de um `<li>`. */
function emBlocos(areas: AreaNav[]): Array<{ secao: string | null; areas: AreaNav[] }> {
  const blocos: Array<{ secao: string | null; areas: AreaNav[] }> = []
  for (const area of areas) {
    if (!blocos.length || area.secao) blocos.push({ secao: area.secao ?? null, areas: [] })
    blocos[blocos.length - 1].areas.push(area)
  }
  return blocos
}

export function NavMain({
  areas,
  destinoAtivo,
}: {
  areas: AreaNav[]
  destinoAtivo: string | null
}) {
  return (
    <>
      {emBlocos(areas).map((bloco, i) => (
    <SidebarGroup key={bloco.secao ?? `bloco-${i}`} className="onface-sidebar-corpo">
      {bloco.secao && (
        <SidebarGroupLabel className="onface-sidebar-grupo">{bloco.secao}</SidebarGroupLabel>
      )}
      <SidebarMenu>
        {bloco.areas.map((area) => {
          const filhos = area.itens ?? []
          const contemOAtivo = filhos.some((f) => f.href === destinoAtivo)
          const ehOAtivo = !filhos.length && area.href === destinoAtivo

          if (!filhos.length) {
            return (
              <SidebarMenuItem key={area.label}>
                <SidebarMenuButton asChild tooltip={area.label} isActive={ehOAtivo} className="onface-nav">
                  <Link href={area.href} aria-current={ehOAtivo ? "page" : undefined}>
                    <area.icon />
                    <span>{area.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          return (
            <Collapsible
              key={`${area.label}-${contemOAtivo}`}
              asChild
              defaultOpen={contemOAtivo}
              className="group/area"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={area.label} isActive={contemOAtivo} className="onface-nav">
                    <area.icon />
                    <span>{area.label}</span>
                    {/* Chevron desce quando abre. Quem gira é o CSS, pelo
                        `data-state` que o próprio Collapsible escreve no
                        botão — o valor da rotação é o do protótipo. */}
                    <ChevronDown className="onface-sidebar-chevron" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="onface-sidebar-submenu">
                    {filhos.map((filho) => {
                      const ativo = filho.href === destinoAtivo
                      return (
                        <SidebarMenuSubItem key={filho.label}>
                          <SidebarMenuSubButton asChild isActive={ativo} className="onface-nav-sub">
                            <Link href={filho.href} aria-current={ativo ? "page" : undefined}>
                              <span>{filho.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
      ))}
    </>
  )
}
