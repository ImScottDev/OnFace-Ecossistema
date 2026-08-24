import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { FinanceiroWorkspace } from "@/components/crm2/clientes/FinanceiroWorkspace";

export default async function ClientesFinanceiroPage() {
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
        className="-m-6 mb-0 relative flex flex-col gap-6 px-8 pt-7 pb-10 rounded-tl-2xl"
        style={{ background: "var(--cf2-bg-canvas)" }}
      >
        <Cf2Topbar
          orgNome={org?.nome || "Callface"}
          variant="light"
          title="Clientes"
          subtitle="Financeiro operacional — Services, billing e conciliação"
        />
      </div>
      <div className="pt-6">
        <FinanceiroWorkspace />
      </div>
    </div>
  );
}
