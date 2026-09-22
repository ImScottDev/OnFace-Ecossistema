"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut, Search, Settings2, UserRound } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Cf2NotificationBell } from "@/components/crm2/NotificationBell";
import { trilhaAtual } from "../navegacao";

/**
 * Barra do topo da casca — handoff "OnFace — Casca", 22/09/2026.
 *
 * Da esquerda para a direita: recolher a coluna, divisória, nome da página com
 * a linha de apoio, espaçador, busca, notificações, perfil.
 *
 * Duas mudanças em relação à versão de mais cedo no mesmo dia, ambas do
 * handoff:
 *
 * 1. **O nome da página volta para cá, em peso forte, com a linha de apoio ao
 *    lado.** A versão anterior mostrava só a trilha ("Comercial / Pré-vendas")
 *    para não repetir o título que o conteúdo desenhava. O handoff resolve pelo
 *    outro lado: o título mora AQUI e some do conteúdo, que é o que devolve uma
 *    faixa inteira de altura para a tela.
 * 2. **O menu do usuário volta para o canto superior direito**, porque o rodapé
 *    da coluna passou a ser do NEXO.
 *
 * A busca é um botão de ícone: o handoff desenha uma lupa de 30×30, não a
 * pílula com rótulo e atalho. O atalho continua valendo — quem o anuncia agora
 * é o tooltip, que é onde ele cabe sem gastar largura.
 */
function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export function TopbarOnface() {
  const pathname = usePathname();
  const trilha = trilhaAtual(pathname);
  const { data: session } = useSession();

  const nome = session?.user?.name || "Usuário";
  const email = session?.user?.email ?? "";

  const abrirBusca = () =>
    window.dispatchEvent(new CustomEvent("open-command-palette"));

  return (
    <header className="onface-topbar-v2">
      <div className="onface-topbar-v2-esq">
        <SidebarTrigger className="onface-topbar-v2-toggle" />
        <span className="onface-topbar-v2-regua" aria-hidden />
        {trilha ? (
          <div className="onface-titulo">
            <h1 className="onface-titulo-nome">{trilha.item}</h1>
            {trilha.apoio && <p className="onface-titulo-apoio">{trilha.apoio}</p>}
          </div>
        ) : null}
      </div>

      <div className="onface-topbar-v2-dir">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="onface-utility"
              onClick={abrirBusca}
              aria-label="Buscar no ONFACE"
            >
              <Search aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Buscar <Kbd>⌘K</Kbd>
          </TooltipContent>
        </Tooltip>

        <Cf2NotificationBell variant="onface" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="onface-perfil" aria-label={`Conta de ${nome}`}>
              <span className="onface-perfil-avatar" aria-hidden>
                {iniciais(nome)}
              </span>
              <span className="onface-perfil-texto">
                <span className="onface-perfil-nome">{nome}</span>
                <span className="onface-perfil-org">Callface</span>
              </span>
              <ChevronDown className="onface-perfil-chevron" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[17rem]">
            <DropdownMenuLabel className="onface-menu-perfil-topo">
              <strong>{nome}</strong>
              <small>{email}</small>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/perfil">
                <UserRound />
                Minha conta
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/ajustes">
                <Settings2 />
                Ajustes da organização
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(evento) => {
                evento.preventDefault();
                void signOut({ callbackUrl: "/login" });
              }}
            >
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
