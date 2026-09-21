import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2RiscoWorkspace } from "@/components/crm2/clientes/RiscoWorkspace";

/** Risco / Churn (v0.13, Módulo 08).
 *
 *  Era `ModuloPendente` desde 16/09, com duas dependências listadas. As duas
 *  já estavam resolvidas quando esta tela foi escrita: `lib/cs/riscos` mantém
 *  491 riscos abertos no banco, e o tipo do risco já separa cobrança de
 *  relacionamento. Faltava a leitura agregada e a tela. */
export const dynamic = "force-dynamic";

export default async function ClientesRiscoPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div className="-m-6 mb-0 relative flex flex-col px-6 py-3.5 rounded-tl-2xl border-b"
        style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
        <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="Clientes"
          subtitle="Risco / Churn — contas com sinal de saída antes do cancelamento" compactTitle actions={null} />
      </div>
      <div className="pt-6"><Cf2RiscoWorkspace /></div>
    </div>
  );
}
