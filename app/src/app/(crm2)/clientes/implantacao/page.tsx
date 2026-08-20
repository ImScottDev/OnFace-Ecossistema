import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2ModuleTabs } from "@/components/crm2/ModuleTabs";
import { CLIENTES_TABS } from "@/components/crm2/clientes-tabs";
import { Cf2EntregaWorkspace } from "@/components/crm2/clientes/EntregaWorkspace";

export default async function ClientesImplantacaoPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org?.nome || "Callface";

  return (
    <div className="flex flex-col gap-6">
      <div className="-m-6 mb-0 relative flex flex-col gap-6 px-8 pt-7 pb-10 rounded-tl-2xl" style={{ background: "var(--cf2-bg-canvas)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" title="Clientes" subtitle="Implantação — PABX pós-Won" />
        <Cf2ModuleTabs items={CLIENTES_TABS} notchFillColor="var(--cf2-bg-canvas)" />
      </div>
      <div className="pt-10">
        <Cf2EntregaWorkspace familiaFixa="PABX" />
      </div>
    </div>
  );
}
