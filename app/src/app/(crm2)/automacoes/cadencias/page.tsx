import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2ModuleTabs } from "@/components/crm2/ModuleTabs";
import { AUTOMACOES_TABS } from "@/components/crm2/automacoes-tabs";
import { Cf2CadenciasWorkspace } from "@/components/crm2/automacoes/CadenciasWorkspace";

export default async function AutomacoesCadenciasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org?.nome || "Callface";

  return (
    <div className="flex flex-col gap-6">
      <div className="-m-6 mb-0 relative flex flex-col gap-6 px-8 pt-7 pb-10 rounded-tl-2xl" style={{ background: "var(--cf2-bg-canvas)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" title="Automações" subtitle="Fluxos, cadências, agentes e execuções — mesmo motor por trás" />
        <Cf2ModuleTabs items={AUTOMACOES_TABS} notchFillColor="var(--cf2-bg-canvas)" />
      </div>
      <div className="pt-10">
        <Cf2CadenciasWorkspace />
      </div>
    </div>
  );
}
