import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2PipelineWorkspace } from "@/components/crm2/pipeline/Workspace";
import { PipelineTopbarActions } from "@/components/crm2/pipeline/TopbarActions";

export default async function PipelinePage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const org = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org[0]?.nome || "Callface";

  return (
    <div className="-m-6 h-[calc(100%+3rem)] flex flex-col min-h-0">
      <header className="shrink-0 flex flex-col gap-5 px-8 pt-7 pb-5" style={{ background: "var(--cf2-chrome-bg-alt)", borderBottom: "1px solid var(--cf2-chrome-border-subtle)" }}>
        <Cf2Topbar orgNome={orgNome} variant="dark" title="Vendas" subtitle="Workspace dos closers — oportunidades de Entrada até Negociação" actions={<PipelineTopbarActions />} />
      </header>

      <div
        className="flex flex-col flex-1 min-h-0 gap-4 px-6 pt-5 pb-6"
        style={{
          background: "var(--cf2-chrome-bg-alt)",
          backgroundImage: "repeating-linear-gradient(to right, rgba(255,255,255,0.035) 0 1px, transparent 1px 60px), repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0 1px, transparent 1px 60px)",
          backgroundSize: "60px 60px",
        }}
      >
        <div className="shrink-0">
          <p className="text-[18px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Pipeline</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Entrada → Diagnóstico → Proposta → Negociação. Reunião, trial e no-show são estados da oportunidade, não etapas do board.</p>
        </div>
        <div className="flex-1 min-h-0">
          <Cf2PipelineWorkspace />
        </div>
      </div>
    </div>
  );
}
