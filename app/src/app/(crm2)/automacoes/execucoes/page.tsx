import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2ExecucoesWorkspace } from "@/components/crm2/automacoes/ExecucoesWorkspace";

export const metadata = { title: "Execuções" };

export default async function AutomacoesExecucoesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org?.nome || "Callface";

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={orgNome} variant="light" title="Automações" subtitle="Fluxos, cadências, agentes e execuções — mesmo motor por trás" compactTitle actions={null} />
      <Cf2ExecucoesWorkspace />
    </div>
  );
}
