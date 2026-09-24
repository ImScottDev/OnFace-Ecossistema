import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { Providers } from "@/components/crm/Providers";
import { Cf2SidebarProvider } from "@/components/crm2/ui/Sidebar";
import { Cf2ThemeRoot } from "@/components/crm2/ThemeRoot";
import { Cf2CamadaModal } from "@/components/crm2/CamadaModal";
import { OnfaceThemeRoot } from "@/components/onface/OnfaceThemeRoot";
import { CascaProto } from "@/components/onface/proto/CascaProto";
import { TopbarOnface } from "@/components/onface/shell/TopbarOnface";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

async function resolveSession() {
  try {
    return await Promise.race([
      auth(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("auth-timeout")), 8000),
      ),
    ]);
  } catch {
    return null;
  }
}

/** Marca as duas cascas no <html> ANTES do primeiro paint.
 *
 * `data-onface-theme` porque os tokens semânticos do ONFACE e a ponte
 * cf2→ONFACE moram atrás de `html[data-onface-theme]`; sem o atributo no
 * primeiro frame quem responde é o tema escuro do `:root` e a tela pisca
 * errada.
 *
 * `data-cf2-theme` continua junto, e isso é deliberado: as telas do CRM 2.0
 * leem 106 tokens `--cf2-*` distintos e a ponte reaponta 22 deles. Tirar o
 * atributo deixaria os outros 84 sem valor nenhum — a tela não ficaria "menos
 * ONFACE", ficaria quebrada. */
const TEMA_ANTES_DO_PAINT =
  `document.documentElement.setAttribute("data-onface-theme","light");` +
  `document.documentElement.setAttribute("data-cf2-theme","light")`;

/**
 * App Shell do ONFACE — sidebar + topbar (UX-EXECUTION-SPEC §1.2).
 *
 * Antes: navegação horizontal na topbar, com cinco dos seis grupos escondidos
 * atrás de hover. A árvore tem 20 destinos; a barra só cabia porque escondia
 * quase tudo. Agora a operação inteira fica visível na coluna e a topbar
 * carrega só o que a spec nomeia — trilha, busca, NEXO, notificações, usuário.
 *
 * `Cf2SidebarProvider` continua montado mesmo sem a coluna legada dentro:
 * `useSidebar()` faz `throw` quando não acha o contexto, e ele é chamado pelo
 * `Cf2SidebarTrigger` que vive dentro do `Cf2Topbar` de dezenas de telas.
 * Manter o provider mata o throw sem tocar em nenhuma delas. Ele sai junto com
 * o `Cf2Topbar`, na limpeza do legado.
 *
 * Escopo de acesso: qualquer papel autenticado da organização — decisão
 * explícita do Kauã (10/08) enquanto a fase é de construção.
 */
export default async function Crm2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSession();
  if (!session?.user) redirect("/login");

  // O estado da coluna é lido no servidor para o primeiro paint já sair na
  // largura certa. Sem isto a sidebar abre expandida e encolhe na hidratação,
  // empurrando o conteúdo de lado na frente do usuário.
  const cookieStore = await cookies();
  const abertaPorPadrao = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <Providers session={session} variant="onface">
      <script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DO_PAINT }} />
      <OnfaceThemeRoot />
      <Cf2ThemeRoot />
      <Cf2CamadaModal />
      <TooltipProvider delayDuration={200}>
        {/* As duas larguras são as do protótipo: 226px aberta, 52px recolhida.
            O provider escreve inline e ganha de qualquer CSS, então é aqui que
            elas têm de viver — declarar na folha não adianta. */}
        {/* A CASCA É A DO CLAUDE DESIGN desde 24/09.
            `AppSidebar` + `TopbarOnface` eram a versão recriada à mão, e
            comparar propriedade por propriedade não basta: a casca é sidebar
            com grupos, topo com trilha, busca ⌘K, sino, perfil e NEXO — dezenas
            de detalhes que só batem quando é o mesmo markup.
            Ver docs/design/COMO-LIGAR-UMA-TELA.md. */}
        <Cf2SidebarProvider className="h-auto min-h-0 overflow-visible">
          <CascaProto>{children}</CascaProto>
        </Cf2SidebarProvider>
      </TooltipProvider>
    </Providers>
  );
}
