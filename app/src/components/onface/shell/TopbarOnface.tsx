"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, LogOut, Search, Settings2, Sparkles } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Cf2NotificationBell } from "@/components/crm2/NotificationBell";
import { trilhaAtual } from "../navegacao";

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

/**
 * Topbar do ONFACE — UX-EXECUTION-SPEC §1.2.
 *
 * Com a navegação na coluna, sobra o que a spec nomeia: trilha curta, busca
 * global, NEXO, notificações e usuário. Nada mais entra aqui.
 *
 * A trilha é deliberadamente curta e NÃO repete o título da página. A spec é
 * explícita ("Não repetir título de página na Topbar e no body"), e o efeito
 * prático é que a faixa superior responde "onde estou" sem roubar a linha que
 * o conteúdo usa para dizer "o que é isto".
 *
 * A altura caiu de 4.5rem para 3.25rem: a barra antiga carregava marca,
 * descritor, seis áreas e utilitários. A marca foi para a sidebar e a
 * navegação também, então manter a altura seria pagar 20px de cromo por linha
 * em cada tela do produto.
 */
export function TopbarOnface() {
  const pathname = usePathname();
  const trilha = trilhaAtual(pathname);
  const { data: session } = useSession();
  const nome = session?.user?.name || "Usuário";

  const abrirBusca = () =>
    window.dispatchEvent(new CustomEvent("open-command-palette"));

  return (
    <header className="onface-topbar-v2">
      <div className="onface-topbar-v2-esq">
        <SidebarTrigger className="onface-topbar-v2-toggle" />
        {trilha ? (
          <nav aria-label="Trilha" className="onface-trilha">
            {trilha.grupo ? (
              <>
                <span className="onface-trilha-grupo">{trilha.grupo}</span>
                <span className="onface-trilha-sep" aria-hidden>
                  /
                </span>
              </>
            ) : null}
            <span className="onface-trilha-atual">{trilha.item}</span>
          </nav>
        ) : null}
      </div>

      <div className="onface-topbar-v2-dir">
        {/* A busca nomeia a ação e mostra o atalho em vez de se esconder atrás
            de uma lupa. Colapsa para o círculo quando falta largura. */}
        <button
          type="button"
          className="onface-busca"
          onClick={abrirBusca}
          aria-label="Buscar no ONFACE"
        >
          <Search aria-hidden />
          <span className="onface-busca-label">Buscar</span>
          <kbd className="onface-busca-kbd" aria-hidden>
            ⌘K
          </kbd>
        </button>

        {/* NEXO é a única ação coral da casca: é o copiloto, não um utilitário
            a mais. Ainda sem painel — enquanto não existir, o botão leva ao
            workspace em vez de abrir um vazio. */}
        <Link href="/automacoes/nexo" className="onface-nexo">
          <Sparkles aria-hidden />
          <span>NEXO</span>
        </Link>

        <Cf2NotificationBell variant="onface" />

        <span className="onface-topbar-v2-regua" aria-hidden />

        {/* `modal={false}`: no modo modal o Radix trava o scroll do body e
            compensa a barra, o que desloca a página inteira ao abrir. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            className="onface-perfil"
            aria-label={`Abrir menu de ${nome}`}
          >
            <span className="onface-perfil-avatar" aria-hidden>
              {iniciais(nome)}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="onface-menu">
            <div className="onface-menu-perfil-topo">
              <span className="onface-perfil-avatar" aria-hidden>
                {iniciais(nome)}
              </span>
              <span>
                <strong>{nome}</strong>
                <small>{session?.user?.email}</small>
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/perfil">
                  <BadgeCheck aria-hidden />
                  Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/ajustes">
                  <Settings2 aria-hidden />
                  Ajustes
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(evento) => {
                evento.preventDefault();
                void signOut({ callbackUrl: "/login" });
              }}
            >
              <LogOut aria-hidden />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
