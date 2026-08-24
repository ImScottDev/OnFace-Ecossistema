import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Providers } from "@/components/crm/Providers";
import { Cf2Sidebar } from "@/components/crm2/Sidebar";
import { Cf2ThemeRoot } from "@/components/crm2/ThemeRoot";

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
      {/* background aqui (17/08) é o que faz o sidebar "abraçar" o canto
          arredondado de `main`: o corte do rounded-tl/bl-2xl revela o que
          está por trás de `main`, que é este container — se ficasse sem
          cor, mostrava o preto/branco padrão da página em vez do escuro
          contínuo do sidebar, um filete visível na costura. */}
      <div className="flex h-dvh overflow-hidden" data-cf2-theme="light" style={{ background: "var(--cf2-chrome-bg)" }}>
        <Cf2Sidebar />
        {/* overflow-hidden aqui (não no scroll interno) é o que corrige a
            costura visual no canto arredondado: um único corte real via
            clip nos 2 cantos da esquerda (topo e base), nunca desenhado
            duas vezes por elementos filhos. */}
        <main className="flex-1 flex flex-col overflow-hidden rounded-tl-2xl rounded-bl-2xl" style={{ boxShadow: "var(--cf2-shadow-shell)" }}>
          {/* h-full aqui é o que permite telas como /atendimento terem scroll
              interno próprio (lista/conversa) em vez de esticar a página —
              esta div continua scrollando normalmente quando o conteúdo é
              mais alto que ela (ex: /inicio), então não quebra nada existente. */}
          <div
            className="flex-1 overflow-y-auto min-h-0 cf2-hide-scrollbar"
            style={{
              backgroundColor: "var(--cf2-bg-canvas)",
              // Grid de fundo do Figma (bg-grid-effect): linhas a cada 60px, opacity 50%.
              backgroundImage:
                "repeating-linear-gradient(to right, var(--cf2-border-grid) 0 1px, transparent 1px 60px), repeating-linear-gradient(to bottom, var(--cf2-border-grid) 0 1px, transparent 1px 60px)",
              backgroundSize: "60px 60px",
            }}
          >
            <div className="p-6 flex flex-col gap-5 relative h-full min-h-0">{children}</div>
          </div>
        </main>
      </div>
    </Providers>
  );
}
