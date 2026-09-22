"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  NAVEGACAO,
  NAVEGACAO_RODAPE,
  destinoAtivo,
  type ItemNav,
} from "../navegacao";

/**
 * Sidebar do ONFACE — UX-EXECUTION-SPEC §1.2.
 *
 * A casca era uma barra horizontal com os grupos escondidos atrás de hover. A
 * spec pede coluna à esquerda, e o motivo é operacional antes de estético: com
 * 20 destinos em seis grupos, a barra horizontal só cabia porque escondia
 * cinco sextos da árvore. Na coluna a operação inteira fica visível e o custo
 * de trocar de módulo cai de "passar o mouse, esperar, mirar" para um clique.
 *
 * Construída sobre o `Sidebar` do shadcn em vez de CSS próprio: ele já traz
 * colapso persistido em cookie, atalho de teclado, a variante offcanvas no
 * mobile e o `SidebarRail` para arrastar. Reimplementar isso seria uma
 * segunda biblioteca dentro do produto.
 *
 * Por que `collapsible="icon"` e não `offcanvas`: o usuário fica horas aqui, e
 * esconder a navegação por completo obriga a reabrir a cada troca de módulo. O
 * modo ícone mantém o mapa espacial — o item continua na mesma altura — e
 * devolve 13rem ao conteúdo, que é o que importa num board de pipeline.
 */
export function SidebarOnface() {
  const pathname = usePathname();
  const ativo = destinoAtivo(pathname);

  const item = (nav: ItemNav) => {
    const Icone = nav.icon;
    const selecionado = ativo === nav.href;
    return (
      <SidebarMenuItem key={nav.href}>
        <SidebarMenuButton
          asChild
          isActive={selecionado}
          tooltip={nav.label}
          className="onface-nav-linha"
        >
          <Link href={nav.href} aria-current={selecionado ? "page" : undefined}>
            <Icone aria-hidden />
            <span>{nav.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="onface-sidebar">
      <SidebarHeader className="onface-sidebar-header">
        <Link href="/inicio" className="onface-sidebar-marca" aria-label="ONFACE, ir para o início">
          {/* Lockup completo quando há largura; a marca sozinha no modo ícone.
              Dois arquivos em vez de um SVG que encolhe: o lockup ilegível a
              3rem é pior que o símbolo. */}
          <img
            className="onface-sidebar-lockup"
            src="/onface/onface-lockup-negativa.svg"
            alt="ONFACE"
          />
          <img
            className="onface-sidebar-simbolo"
            src="/onface/figma-logo.svg"
            alt="ONFACE"
            aria-hidden
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="onface-sidebar-corpo">
        {NAVEGACAO.map((grupo, indice) => (
          <SidebarGroup key={grupo.label ?? `topo-${indice}`}>
            {grupo.label ? (
              <SidebarGroupLabel className="onface-sidebar-grupo">
                {grupo.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>{grupo.itens.map(item)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="onface-sidebar-rodape">
        <SidebarMenu>{NAVEGACAO_RODAPE.map(item)}</SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
