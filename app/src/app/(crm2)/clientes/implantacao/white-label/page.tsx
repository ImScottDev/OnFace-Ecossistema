import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2EntregaWorkspace } from "@/components/crm2/clientes/EntregaWorkspace";

export const metadata = { title: "Implantação White Label" };

/** Implantação White Label — recorte da família no board de entregas.
 *
 *  Era `ModuloPendente`, com a dependência "falta definir as etapas próprias
 *  dessa família". Elas foram definidas no CP8: as fases saem de FASE_WHITE_LABEL_POR_WORKSTREAM, derivadas da ordem do checklist real (CP8).
 *
 *  NÃO É TELA NOVA. O board de entregas já aceita `familiaFixa` e já sabe
 *  desenhar a fase de cada família; duas implementações do mesmo recorte
 *  divergiriam. Esta rota existe porque o menu aponta para ela, e entrega o
 *  mesmo board com o filtro travado. */
export const dynamic = "force-dynamic";

export default async function ClientesImplantacaoWhiteLabelPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="Implantação White Label" actions={null} />
      <Cf2EntregaWorkspace familiaFixa="WHITE_LABEL" />
    </div>
  );
}
