import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Providers } from "@/components/crm/Providers";
import { Cf2Sidebar } from "@/components/crm2/Sidebar";
import { Cf2SidebarProvider } from "@/components/crm2/ui/Sidebar";
import { Cf2ThemeRoot } from "@/components/crm2/ThemeRoot";
import { Cf2CamadaModal } from "@/components/crm2/CamadaModal";
import { TooltipProvider } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

async function resolveSession() {
  try {
    return await Promise.race([
      auth(),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("auth-timeout")), 8000)),
    ]);
  } catch {
    return null;
  }
}

/**
 * App Shell novo do CRM 2.0 (tema claro, contrato visual do Figma — node
 * 197:4831, conferido 17/08). Route group próprio (strangler pattern
 * aplicado no frontend, mesmo princípio já usado no backend a sessão
 * inteira): convive com o `(crm)` legado (dark) sem tocar nele. Rotas
 * migram uma a uma pra aqui.
 *
 * Estrutura (17/08, corrigida): sidebar numa coluna, `main` na outra —
 * a barra da Carol é o RODAPÉ de dentro de `main` (mesma caixa
 * arredondada/clipada do conteúdo), não uma linha separada por fora que
 * esticava por baixo do próprio sidebar. É exatamente a hierarquia real
 * do Figma: "bottom-bar" é o último filho de "main-content", não um
 * irmão de "sidebar" no nível mais externo.
 *
 * Escopo de acesso: qualquer papel autenticado da organização — fase de
 * construção, decisão explícita do Kauã (10/08) de deixar tudo visível por
 * enquanto em vez de manter um gate fino por papel a cada tela nova. RBAC
 * por tela fica pra quando a IA de navegação estiver mais assentada.
 */
export default async function Crm2Layout({ children }: { children: React.ReactNode }) {
  const session = await resolveSession();
  if (!session?.user) redirect("/login");

  return (
    <Providers session={session} variant="cf2">
      <Cf2ThemeRoot />
      <Cf2CamadaModal />
      {/* background aqui (17/08) é o que faz o sidebar "abraçar" o canto
          arredondado de `main`: o corte do rounded-tl/bl-2xl revela o que
          está por trás de `main`, que é este container — se ficasse sem
          cor, mostrava o preto/branco padrão da página em vez do escuro
          contínuo do sidebar, um filete visível na costura. */}
      {/* SidebarProvider (30/08) — dá colapso real, modo mobile (Sheet) e
          atalho ⌘B. Substitui o estado local que existia dentro do próprio
          sidebar, que não tinha como ser controlado de fora (o botão de menu
          do mobile vive no header da página, não dentro da barra). */}
      <TooltipProvider delayDuration={200}>
      <Cf2SidebarProvider data-cf2-theme="light" style={{ background: "var(--cf2-chrome-bg)" }}>
        <Cf2Sidebar />
        {/* overflow-hidden aqui (não no scroll interno) é o que corrige a
            costura visual no canto arredondado: um único corte real via
            clip nos 2 cantos da esquerda (topo e base), nunca desenhado
            duas vezes por elementos filhos. */}
        <main
          className="flex-1 flex flex-col overflow-hidden rounded-tl-[var(--radius-card)] rounded-bl-[var(--radius-card)]"
          style={{ boxShadow: "var(--cf2-shadow-shell)" }}
        >
          {/* min-h-0 aqui é o que permite telas como /atendimento terem scroll
              interno próprio (lista/conversa) em vez de esticar a página. */}
          <div
            className="cf2-workspace flex-1 min-h-0 overflow-y-auto"
            style={{
              backgroundColor: "var(--cf2-bg-canvas)",
              // Achado real 24/08: passar do limite do scroll (trackpad)
              // revelava esse fundo claro por baixo do conteúdo em páginas
              // com chrome escuro (Pré-vendas, Atendimento) — `contain`
              // trava o elástico dentro desta caixa em vez de vazar.
              overscrollBehavior: "contain",
            }}
          >
            {/* min-h-full (não h-full, achado 30/08): com h-full, páginas com
                conteúdo mais alto que a viewport (ex: /inicio) transbordavam
                a própria caixa — o padding-bottom fica na borda da caixa, não
                do conteúdo, então o último item ficava colado no rodapé sem
                respiro nenhum. min-h-full preenche a tela em páginas curtas
                e cresce com o conteúdo nas longas, preservando o padding real. */}
            <div className="cf2-p-pagina cf2-workspace-content relative flex min-h-full flex-col gap-5">{children}</div>
          </div>
        </main>
      </Cf2SidebarProvider>
      </TooltipProvider>
    </Providers>
  );
}
