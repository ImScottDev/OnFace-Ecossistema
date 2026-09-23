import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { TopbarOnface } from "@/components/onface/shell/TopbarOnface";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DesenhoProviders } from "./providers";

/**
 * Casca do banco de desenho.
 *
 * Reproduz o shell oficial (sidebar + topbar + tema) sem exigir sessão, para
 * validar as telas com dado real em desenvolvimento. Só existe fora de produção.
 *
 * A casca é montada AQUI, no server component, com a mesma forma de árvore do
 * `(crm2)/layout.tsx`. Montá-la dentro do `DesenhoProviders` (que é cliente)
 * fazia os `useId` do Radix saírem diferentes no servidor e no navegador, e o
 * React reclamava de hidratação na coluna inteira.
 */
export default async function DesenhoLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  // O mesmo cookie do layout oficial. Sem ele o servidor assume a coluna
  // aberta e o cliente reabre pelo cookie: a árvore muda entre um e outro e o
  // React acusa hidratação em toda a coluna.
  const cookieStore = await cookies();
  const abertaPorPadrao = cookieStore.get("sidebar_state")?.value !== "false";
  return (
    <DesenhoProviders>
      {/* As duas larguras são as do protótipo, escritas inline pelo provider
          pelos mesmos motivos do layout oficial. */}
      <SidebarProvider
        defaultOpen={abertaPorPadrao}
        style={
          { "--sidebar-width": "226px", "--sidebar-width-icon": "52px" } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset className="onface-conteudo">
          <TopbarOnface />
          <main className="onface-conteudo-interno flex min-w-0 flex-1 flex-col gap-5">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </DesenhoProviders>
  );
}
