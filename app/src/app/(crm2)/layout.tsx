import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Providers } from "@/components/crm/Providers";
import { Cf2Sidebar } from "@/components/crm2/Sidebar";

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
 * App Shell novo do CRM 2.0 (tema claro, contrato visual do Figma — 09/08).
 * Route group próprio (strangler pattern aplicado no frontend, mesmo
 * princípio já usado no backend a sessão inteira): convive com o `(crm)`
 * legado (dark) sem tocar nele. Rotas migram uma a uma pra aqui.
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
    <Providers session={session}>
      <div className="flex h-dvh overflow-hidden" data-cf2-theme="light">
        <Cf2Sidebar />
        <main
          className="flex-1 overflow-y-auto rounded-tl-2xl rounded-bl-2xl"
          style={{
            backgroundColor: "var(--cf2-bg-canvas)",
            boxShadow: "var(--cf2-shadow-shell)",
            // Grid de fundo do Figma (bg-grid-effect): linhas a cada 60px, opacity 50%.
            backgroundImage:
              "repeating-linear-gradient(to right, var(--cf2-border-grid) 0 1px, transparent 1px 60px), repeating-linear-gradient(to bottom, var(--cf2-border-grid) 0 1px, transparent 1px 60px)",
            backgroundSize: "60px 60px",
          }}
        >
          {/* h-full aqui é o que permite telas como /atendimento terem scroll
              interno próprio (lista/conversa) em vez de esticar a página —
              main continua scrollando normalmente quando o conteúdo é mais
              alto que isso (ex: /inicio), então não quebra nada existente. */}
          <div className="p-6 flex flex-col gap-5 relative h-full min-h-0">{children}</div>
        </main>
      </div>
    </Providers>
  );
}
