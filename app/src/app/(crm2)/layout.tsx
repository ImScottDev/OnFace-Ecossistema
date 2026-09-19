import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Providers } from "@/components/crm/Providers";
import { Cf2SidebarProvider } from "@/components/crm2/ui/Sidebar";
import { Cf2ThemeRoot } from "@/components/crm2/ThemeRoot";
import { Cf2CamadaModal } from "@/components/crm2/CamadaModal";
import { OnfaceThemeRoot } from "@/components/onface/OnfaceThemeRoot";
import { OnfaceTopbar } from "@/components/onface/OnfaceTopbar";
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

/** Marca as duas cascas no <html> ANTES do primeiro paint.
 *
 * `data-onface-theme` porque os tokens semânticos do ONFACE e a ponte cf2→ONFACE
 * moram atrás de `html[data-onface-theme]`; sem o atributo no primeiro frame,
 * quem responde é o tema escuro do `:root` e a tela pisca errada (mesmo achado
 * já documentado no layout do `(onface-preview)`).
 *
 * `data-cf2-theme` continua junto, e isso é deliberado: as 75 telas do CRM 2.0
 * leem 106 tokens `--cf2-*` distintos e a ponte reaponta 22 deles. Tirar o
 * atributo deixaria os outros 84 sem valor nenhum — a tela não ficaria "menos
 * ONFACE", ficaria quebrada. Com os dois presentes, a ponte vence onde declara
 * (`html[data-onface-theme]` tem especificidade maior que `[data-cf2-theme]`) e
 * o resto continua resolvendo. Medido no navegador em 18/09.
 *
 * Os `ThemeRoot` abaixo continuam existindo: eles cuidam do desmonte ao sair
 * para outra casca. Este script só garante o primeiro frame. */
const TEMA_ANTES_DO_PAINT = `document.documentElement.setAttribute("data-onface-theme","light");` +
  `document.documentElement.setAttribute("data-cf2-theme","light")`;

/**
 * App Shell do CRM 2.0 — desde 18/09 sob a casca ONFACE (F1 · Casca Única).
 *
 * O que mudou e por quê: a navegação era uma barra lateral escura com acento
 * verde-lima; passou a ser a `OnfaceTopbar` (grafite, navegação horizontal,
 * coral como ação). As 75 telas não se mexeram de lugar — elas continuam
 * recebendo o mesmo container de conteúdo (`cf2-workspace` + `cf2-p-pagina`) e
 * os mesmos tokens. Trocou a moldura, não o quadro.
 *
 * `Cf2SidebarProvider` fica mesmo sem `Cf2Sidebar` dentro: `useSidebar()` faz
 * `throw` quando não acha o contexto (ui/Sidebar.tsx:50-53) e ele é chamado
 * pelo `Cf2SidebarTrigger` que vive dentro do `Cf2Topbar` de dezenas de telas.
 * Manter o provider mata o throw sem tocar em nenhuma das 75.
 *
 * O scroll passou para o body, que é o padrão da casca ONFACE (`min-height:
 * 100dvh` + `padding-top` da topbar fixa). Antes o scroll era interno, numa
 * caixa `h-dvh overflow-hidden`; dentro de uma casca que já desloca o conteúdo
 * pela altura da topbar isso somaria duas alturas de viewport. Telas que têm
 * rolagem interna própria (Atendimento) continuam com a delas.
 *
 * Escopo de acesso: qualquer papel autenticado da organização — decisão
 * explícita do Kauã (10/08) enquanto a fase é de construção.
 */
export default async function Crm2Layout({ children }: { children: React.ReactNode }) {
  const session = await resolveSession();
  if (!session?.user) redirect("/login");

  return (
    <Providers session={session} variant="onface">
      <script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DO_PAINT }} />
      <OnfaceThemeRoot />
      <Cf2ThemeRoot />
      <Cf2CamadaModal />
      <TooltipProvider delayDuration={200}>
        <div className="onface-app-shell">
          <OnfaceTopbar />
          {/* `h-auto`/`overflow-visible` desfazem o `h-dvh overflow-hidden` que
              o provider traz de quando ele era a coluna da barra lateral. O
              tailwind-merge do `cn` resolve o conflito a favor daqui. */}
          <Cf2SidebarProvider className="h-auto min-h-0 overflow-visible">
            <main className="flex min-w-0 flex-1 flex-col">
              {/* Sem `background` próprio aqui, de propósito: o fundo da página
                  agora é o da casca (`--surface-page` do ONFACE, no
                  `.onface-app-shell`). Pintar `--cf2-bg-canvas` nesta caixa
                  deixava dois fundos na mesma tela — o cinza-azulado do CRM 2.0
                  até onde o conteúdo alcançava e o papel ONFACE no resto, com
                  uma costura visível na horizontal em toda tela curta. */}
              <div className="cf2-workspace flex-1">
                <div className="cf2-p-pagina cf2-workspace-content relative flex min-h-full flex-col gap-5">
                  {children}
                </div>
              </div>
            </main>
          </Cf2SidebarProvider>
        </div>
      </TooltipProvider>
    </Providers>
  );
}
