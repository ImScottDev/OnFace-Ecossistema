import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Providers } from "@/components/crm/Providers";
import { OnfaceThemeRoot } from "@/components/onface/OnfaceThemeRoot";
import { OnfaceTopbar } from "@/components/onface/OnfaceTopbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

/** Marca o tema ONFACE no <html> ANTES do primeiro paint.
 *
 * `OnfaceThemeRoot` faz o mesmo num `useEffect`, e isso chega tarde demais: os
 * 42 tokens semânticos do `onface.css` estão atrás de `html[data-onface-theme]`
 * e, sem o atributo, quem responde é o tema escuro legado do `:root` do
 * `globals.css`. Resultado visível: Switch saindo lima em vez de coral, rótulo
 * de navegação em branco sobre canvas branco, aba de entidade sem texto. O
 * componente continua existindo para cuidar do desmonte e de navegação entre
 * cascas; este script só garante que o primeiro frame já esteja certo. */
const TEMA_ANTES_DO_PAINT = `document.documentElement.setAttribute("data-onface-theme","light")`;

export default async function OnfacePreviewLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <Providers session={session} variant="onface">
      <script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DO_PAINT }} />
      <OnfaceThemeRoot />
      <TooltipProvider delayDuration={200}>
        <div className="onface-app-shell">
          <OnfaceTopbar />
          {children}
        </div>
      </TooltipProvider>
    </Providers>
  );
}
