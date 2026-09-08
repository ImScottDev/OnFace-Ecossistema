import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { Providers } from "@/components/crm/Providers";
import { ViewAsBanner } from "@/components/crm/ViewAsBanner";

// O CRM é 100% autenticado e por-usuário: nunca prerenderizar no build (senão
// as páginas que consultam o banco quebram o build). Todas as rotas (crm) são dinâmicas.
export const dynamic = "force-dynamic";

/**
 * Resolve a sessão com teto de tempo. Se o `auth()` travar (sessão corrompida /
 * decode lento), NÃO deixamos a request pendurar até o timeout do proxy (o
 * "carregando pra sempre" / 524): cortamos em 8s e tratamos como sem sessão →
 * manda pro /login. Melhor pedir login de novo do que travar o CRM.
 */
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

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveSession();
  if (!session?.user) redirect("/login");

  // Pós-venda canônico: flag lida no servidor, a cada request. Deixa o
  // rollback do menu ser "editar .env + restart", sem rebuild de imagem.
  const posVendaAtivo = (process.env.POSVENDA_CANONICO || "").toLowerCase() === "on";

  return (
    <Providers session={session}>
      <ViewAsBanner />
      <div className="flex h-dvh overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <CrmSidebar posVendaAtivo={posVendaAtivo} />
        <main className="flex-1 overflow-hidden min-h-0 pt-12 lg:pt-0">{children}</main>
      </div>
    </Providers>
  );
}
