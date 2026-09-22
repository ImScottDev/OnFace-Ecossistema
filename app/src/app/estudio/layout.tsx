import type { Metadata } from "next";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

import { AppSidebar } from "./AppSidebar";
import { Cabecalho } from "./Cabecalho";
import "./estudio.css";

export const metadata: Metadata = {
  title: "Estúdio ONFACE",
  robots: { index: false, follow: false },
};

/**
 * Casca do estúdio: preview isolado da nova estrutura, para o Scott ver antes
 * de decidir. NÃO substitui nada.
 *
 * O que muda em relação à casca de hoje:
 *  - navegação vira barra lateral colapsável, no lugar do topbar horizontal;
 *  - a árvore continua saindo de `MENU_ONFACE`, que está congelada;
 *  - os tokens ONFACE são aplicados só aqui, por `.estudio-root`, então o
 *    `globals.css` e as 80 telas do produto seguem intocados.
 *
 * Esta rota fica fora do `matcher` do middleware, logo abre sem sessão em
 * desenvolvimento, que é o que permite olhar a tela sem login.
 */
export default function EstudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="estudio-root">
      <TooltipProvider delayDuration={200}>
        {/* O provider escreve `--sidebar-width` inline, então declarar no CSS
            não adianta: com 15rem o rótulo "Contatos & Empresas" truncava.
            O item mais longo da árvore congelada é quem dita a largura. */}
        <SidebarProvider style={{ "--sidebar-width": "16.75rem" } as React.CSSProperties}>
          <AppSidebar />
          {/* `variant="inset"`: o conteúdo é um cartão branco apoiado no papel
              de parede, e a barra lateral abraça em vez de encostar. */}
          <SidebarInset className="estudio-conteudo">
            <Cabecalho />
            <main className="min-w-0 flex-1 px-5 py-7 md:px-9 md:py-10">{children}</main>
            {/* O aviso de mudança de etapa precisa de um alvo montado na casca. */}
            <Toaster position="bottom-right" />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
