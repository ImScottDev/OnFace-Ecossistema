// Página autenticada: o board lê a sessão do usuário para filtrar por
// responsável. Prerender estático não tem sessão, e o build quebrava em
// `useSession()` retornando undefined. Renderiza sob demanda.
export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2OnboardingWorkspace } from "@/components/crm2/clientes/OnboardingWorkspace";

export default async function ClientesOnboardingPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org?.nome || "Callface";

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={orgNome} variant="light" title="Onboarding" subtitle="Serviços ganhos aguardando ativação" compactTitle actions={null} />
      <Cf2OnboardingWorkspace />
    </div>
  );
}
