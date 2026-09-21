import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2EntregaWorkspace } from "@/components/crm2/clientes/EntregaWorkspace";

/** Implantação PABX — recorte da família no board de entregas.
 *
 *  Era `ModuloPendente`, com a dependência "falta definir as etapas próprias
 *  dessa família". Elas foram definidas no CP8: as cinco fases saem de FASE_PABX_POR_WORKSTREAM, derivadas do processo real de Delivery PABX.
 *
 *  NÃO É TELA NOVA. O board de entregas já aceita `familiaFixa` e já sabe
 *  desenhar a fase de cada família; duas implementações do mesmo recorte
 *  divergiriam. Esta rota existe porque o menu aponta para ela, e entrega o
 *  mesmo board com o filtro travado. */
export const dynamic = "force-dynamic";

export default async function ClientesImplantacaoPabxPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="flex flex-col gap-6">
      <div className="-m-6 mb-0 relative flex flex-col px-6 py-3.5 rounded-tl-2xl border-b"
        style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
        <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="Clientes"
          subtitle="Implantação PABX — pós-fechamento" compactTitle actions={null} />
      </div>
      <div className="pt-6"><Cf2EntregaWorkspace familiaFixa="PABX" /></div>
    </div>
  );
}
