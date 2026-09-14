import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2ContatosWorkspace } from "@/components/crm2/contatos/Workspace";

export default async function ContatosPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const org = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org[0]?.nome || "Callface";

  return (
    <div className="flex flex-col gap-6">
      <div className="-m-6 mb-0 relative flex flex-col px-6 py-3.5 rounded-tl-2xl border-b" style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
        <Cf2Topbar orgNome={orgNome} variant="light" title="Contatos" subtitle="Diretório unificado de pessoas e empresas da base comercial" compactTitle actions={null} />
      </div>

      <div className="pt-6">
        <Cf2ContatosWorkspace />
      </div>
    </div>
  );
}
