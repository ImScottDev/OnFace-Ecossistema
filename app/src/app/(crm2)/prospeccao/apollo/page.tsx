import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { BuscaApollo } from "./_busca";

/**
 * Busca Apollo. Era a última tela que a navegação do CRM2 mandava pro shell
 * legado (link "módulo legado" dentro de Prospecção). Migrada em 08/09/2026 e
 * colocada como sub-rota de Prospecção, que é onde ela pertence: prospectar é
 * a tarefa, o Apollo é uma das fontes.
 */
export default async function ProspeccaoApolloPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="flex flex-col gap-3">
      <div className="-m-6 mb-0 relative flex flex-col px-6 py-3.5 rounded-tl-2xl border-b" style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
        <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="Prospecção · Busca Apollo" compactTitle actions={null} />
      </div>
      <div className="pt-3">
        <BuscaApollo />
      </div>
    </div>
  );
}
