import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2ClientesWorkspace } from "@/components/crm2/clientes/Workspace";

export default async function ClientesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org?.nome || "Callface";

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={orgNome} variant="light" title="Carteira" subtitle="Empresas com serviço ativo" compactTitle actions={null} />
      <Cf2ClientesWorkspace />
    </div>
  );
}
