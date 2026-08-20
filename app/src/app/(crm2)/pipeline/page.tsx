import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2ModuleTabs } from "@/components/crm2/ModuleTabs";
import { VENDAS_TABS } from "@/components/crm2/vendas-tabs";
import { Cf2PipelineWorkspace } from "@/components/crm2/pipeline/Workspace";
import { PipelineTopbarActions } from "@/components/crm2/pipeline/TopbarActions";

export default async function PipelinePage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const org = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org[0]?.nome || "Callface";

  return (
    <div className="flex flex-col gap-6">
      <div className="-m-6 mb-0 relative flex flex-col gap-6 px-8 pt-7 pb-10 rounded-tl-2xl" style={{ background: "var(--cf2-bg-canvas)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" title="Vendas" subtitle="Workspace dos closers — oportunidades de Entrada até Negociação" actions={<PipelineTopbarActions />} />
        <Cf2ModuleTabs items={VENDAS_TABS} notchFillColor="var(--cf2-bg-canvas)" />
      </div>

      <div className="flex flex-col gap-4 pt-10">
        <div>
          <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Pipeline</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Entrada → Diagnóstico → Proposta → Negociação. Reunião, trial e no-show são estados da oportunidade, não etapas do board.</p>
        </div>
        <Cf2PipelineWorkspace />
      </div>
    </div>
  );
}
