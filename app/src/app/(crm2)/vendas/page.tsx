import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2TarefasWorkspace } from "@/components/crm2/tarefas/Workspace";

export const metadata = { title: "Vendas" };

/**
 * Central de Trabalho Comercial. Mostra a única entidade de atividade
 * (`tarefas`) já usada pelo produto, limitada aos vínculos de lead e
 * oportunidade. Pipeline continua sendo a visão de negociação; esta rota é
 * onde o time começa o dia e executa o próximo passo.
 */
export default async function VendasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="Vendas" compactTitle actions={null} />
      <Cf2TarefasWorkspace foco="comercial" />
    </div>
  );
}
