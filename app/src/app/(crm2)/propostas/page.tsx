import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2ModuleTabs } from "@/components/crm2/ModuleTabs";
import { VENDAS_TABS } from "@/components/crm2/vendas-tabs";
import { Cf2PropostasWorkspace } from "@/components/crm2/propostas/Workspace";

export default async function PropostasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const org = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org[0]?.nome || "Callface";

  return (
    <div className="flex flex-col gap-6">
      {/* Mesmo padrão de App Shell de Vendas/Pré-vendas (17/08) — só o topo
          escapa o padding do shell, o corpo fica em fluxo normal herdando
          o fundo claro+grid do layout. Antes desta rodada esta página não
          tinha Topbar/ModuleTabs — quem chegava aqui pelas abas de Vendas
          ficava sem navegação de módulo, dívida de UX real (mapa mestre,
          regra 14). */}
      <div className="-m-6 mb-0 relative flex flex-col gap-6 px-8 pt-7 pb-10 rounded-tl-2xl" style={{ background: "var(--cf2-bg-canvas)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" title="Vendas" subtitle="Do rascunho ao pagamento/contrato — ciclo de vida completo da proposta" />
        <Cf2ModuleTabs items={VENDAS_TABS} notchFillColor="var(--cf2-bg-canvas)" />
      </div>

      <div className="pt-10">
        <Cf2PropostasWorkspace />
      </div>
    </div>
  );
}
