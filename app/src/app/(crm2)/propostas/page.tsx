import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2PropostasWorkspace } from "@/components/crm2/propostas/Workspace";

/**
 * 10/09/2026 — a página desenhava o próprio header dentro de uma superfície
 * dark que cobria a tela inteira, sem usar `Cf2Topbar` (o único módulo do
 * CRM2 nessa situação). Agora segue o mesmo contrato de Clientes/Financeiro:
 * topo claro do app shell + workspace com pulso escuro só como faixa.
 */
export default async function PropostasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db
    .select({ nome: organizacoes.nome })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div
        className="-m-6 mb-0 relative flex flex-col px-6 py-3.5 rounded-tl-2xl border-b"
        style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}
      >
        <Cf2Topbar
          orgNome={org?.nome || "Callface"}
          variant="light"
          title="Propostas"
          subtitle="Gerencie, acompanhe e converta suas propostas comerciais."
          compactTitle
          ctaLabel="Nova proposta"
          ctaHref="/propostas/novo"
        />
      </div>
      <div className="pt-6">
        <Cf2PropostasWorkspace />
      </div>
    </div>
  );
}
