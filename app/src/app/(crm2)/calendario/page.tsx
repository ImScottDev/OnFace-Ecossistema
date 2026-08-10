import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2CalendarioWorkspace } from "@/components/crm2/calendario/Workspace";

export default async function CalendarioPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <Cf2Topbar orgNome={org?.nome || "Callface"} />
      <div className="flex-1 min-h-0">
        <Cf2CalendarioWorkspace isAdmin={isAdminView(ctx.userRole)} />
      </div>
    </div>
  );
}
