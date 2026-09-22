import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Suspense } from "react";
import { FinanceiroCentral } from "@/components/crm2/financeiro/Workspace";

export default async function ClientesFinanceiroPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db
    .select({ nome: organizacoes.nome })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  return (
    <div className="onface-pagina">
      <Cf2Topbar
        orgNome={org?.nome || "Callface"}
        title="Financeiro"
        subtitle="MRR, cobrança, assinaturas, churn e conciliação"
        actions={null}
      />
      {/* `fallback={null}` deixava a tela em branco enquanto o financeiro
          carregava; agora o `loading.tsx` da rota cobre o primeiro paint e
          este Suspense só precisa não piscar. */}
      <Suspense fallback={null}>
        <FinanceiroCentral />
      </Suspense>
    </div>
  );
}
