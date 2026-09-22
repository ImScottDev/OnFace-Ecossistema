"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronsUpDown, LogOut, Plus, Settings2, UserRound } from "lucide-react";

import { MENU_ONFACE, type OnfaceNavItem } from "@/components/onface/navigation";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** A árvore é a mesma de `MENU_ONFACE`, congelada em 16/09. Esta tela só TROCA
 *  A RENDERIZAÇÃO; ordem, rótulo e agrupamento continuam vindo de
 *  `navigation.ts`, nunca daqui. */

/** Prefixo dentro do estúdio: cada href da árvore vira `/estudio/<rota>`, para
 *  o preview não navegar para fora e não disputar rota com o produto. */
function href(item: OnfaceNavItem) {
  return `/estudio${item.href.replace("/onface-preview", "")}`;
}

function ativo(pathname: string, item: OnfaceNavItem): boolean {
  const alvo = href(item);
  return pathname === alvo || pathname.startsWith(alvo + "/");
}

/** Operação e Clientes viram um segundo bloco, com rótulo. Não é reordenar a
 *  árvore: é dar respiro a uma lista de sete, que sem corte lê como parede. */
const SEGUNDO_BLOCO = new Set(["Automações", "Insights"]);

export function AppSidebar() {
  const pathname = usePathname();
  const principais = MENU_ONFACE.filter((a) => !SEGUNDO_BLOCO.has(a.label));
  const ferramentas = MENU_ONFACE.filter((a) => SEGUNDO_BLOCO.has(a.label));

  const renderArea = (area: OnfaceNavItem) => {
    const Icone = area.icon;
    const estaAtiva = ativo(pathname, area) || (area.children ?? []).some((f) => ativo(pathname, f));

    if (!area.children?.length) {
      return (
        <SidebarMenuItem key={area.label}>
          <SidebarMenuButton asChild isActive={estaAtiva} tooltip={area.label} className="estudio-nav">
            <Link href={href(area)}>
              <Icone />
              <span>{area.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
    // `defaultOpen` só vale na montagem, e o layout não remonta em navegação
    // client-side: sem a chave, a área abre na primeira visita e nunca mais.
    // A chave muda quando a área entra ou sai de ativa, o que remonta só ela
    // e preserva o que o usuário abriu à mão nas outras.
      <Collapsible key={`${area.label}-${estaAtiva}`} asChild defaultOpen={estaAtiva} className="group/colapso">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton isActive={estaAtiva} tooltip={area.label} className="estudio-nav">
              <Icone />
              <span>{area.label}</span>
              <ChevronRight className="ml-auto size-3.5 opacity-50 transition-transform duration-200 group-data-[state=open]/colapso:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="estudio-submenu">
              {area.children.map((filho) => (
                <SidebarMenuSubItem key={filho.label}>
                  <SidebarMenuSubButton asChild isActive={ativo(pathname, filho)}>
                    <Link href={href(filho)}>
                      <span>{filho.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                  {/* Destino estrutural sem módulo construído. A árvore não muda
                      de aparência por isso; o aviso é honesto e discreto. */}
                  {filho.pendente && (
                    <SidebarMenuBadge className="text-[10px] font-normal opacity-45">
                      em breve
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar variant="inset" collapsible="icon" className="estudio-sidebar">
      <SidebarHeader>
        <Link href="/estudio" className="flex h-10 items-center px-2" aria-label="ONFACE, ir para o estúdio">
          {/* Lockup real da marca. Sobre a casca grafite vale a NEGATIVA: a positiva tem o
              texto em tinta forte e sumiria no fundo escuro. */}
          <img
            src="/onface/onface-lockup-negativa.svg"
            alt="ONFACE"
            className="h-4 w-auto group-data-[collapsible=icon]:hidden"
          />
          {/* Colapsada, sobra o símbolo. O lockup inteiro não cabe em 3rem. */}
          <img
            src="/onface/onface-lockup-negativa.svg"
            alt=""
            aria-hidden
            className="hidden h-4 w-7 object-cover object-left group-data-[collapsible=icon]:block"
          />
        </Link>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="estudio-acao" tooltip="Criar">
              <Plus />
              <span>Criar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{principais.map(renderArea)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="estudio-grupo">Inteligência</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{ferramentas.map(renderArea)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Busca e notificações subiram para a barra do topo, que é onde
                ação global pertence. Ajustes e sair moram aqui dentro: o menu
                do usuário já é o lugar que a pessoa procura para isso. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="estudio-perfil" tooltip="Scott Ferraz">
                  <Avatar className="size-7 rounded-full">
                    <AvatarFallback className="rounded-full bg-[rgba(255,255,255,0.1)] text-[10px] font-medium text-white">
                      SF
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-xs font-medium text-white">Scott Ferraz</span>
                    <span className="truncate text-[10px] text-[rgba(255,255,255,0.45)]">Callface</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5 opacity-40" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="right" align="end" sideOffset={8} className="estudio-portal w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="grid leading-tight">
                    <span className="text-sm font-medium">Scott Ferraz</span>
                    <span className="text-xs text-[var(--tinta-fraca)]">scott@callface.io</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserRound />
                  Meu perfil
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings2 />
                  Ajustes
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <LogOut />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
