"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Cf2NotificationBell } from "@/components/crm2/NotificationBell";
import { trilhaAtual } from "../navegacao";

/**
 * Topbar do ONFACE — UX-EXECUTION-SPEC §1.2.
 *
 * Com a navegação na coluna, sobra o que a spec nomeia: trilha curta, busca
 * global, NEXO e notificações.
 *
 * O menu de usuário SAIU daqui em 22/09, junto com a adoção do bloco
 * `sidebar-08`: o bloco põe a conta no rodapé da coluna, e eram os mesmos
 * quatro destinos (perfil, ajustes, sair) em dois lugares da mesma casca. Ele
 * vive agora em `SidebarOnface`. Com ele saiu o `id` fixo do trigger, que
 * existia só para calar um erro de hidratação do Radix.
 *
 * A trilha é deliberadamente curta e NÃO repete o título da página. A spec é
 * explícita ("Não repetir título de página na Topbar e no body"), e o efeito
 * prático é que a faixa superior responde "onde estou" sem roubar a linha que
 * o conteúdo usa para dizer "o que é isto".
 */
export function TopbarOnface() {
  const pathname = usePathname();
  const trilha = trilhaAtual(pathname);

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

        {/* O §1.5 pede um botão NEXO persistente aqui, e ele NÃO está montado
            de propósito.

            Bloqueio real: `/automacoes/nexo` não existe, e o painel do §1.5
            também não — os componentes em `ds/nexo.tsx` são spec do Design
            System, sem rota, sem conversa e sem runtime ligado. Um botão
            coral levando a 404 seria pior que a ausência dele. Quando o
            workspace existir, o botão volta aqui e o item volta à árvore. */}

        <Cf2NotificationBell variant="onface" />
      </div>
    </header>
  );
}
