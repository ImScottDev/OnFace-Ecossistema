import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2RelatoriosWorkspace } from "@/components/crm2/relatorios/Workspace";

export const metadata = { title: "Insights" };

export default async function RelatoriosPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="onface-pagina">
      <Cf2Topbar
        orgNome={org?.nome || "Callface"}
        title="Insights"
        subtitle="Histórico confiável a partir de 12/06/2026, quando a base saiu do Zoho."
        actions={null}
      />
      <Cf2RelatoriosWorkspace />
    </div>
  );
}
