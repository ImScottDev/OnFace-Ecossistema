import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2CsWorkspace } from "@/components/crm2/clientes/CsWorkspace";

export default async function ClientesCsPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  // O hero já carrega título e contexto; a topbar aqui fica só com busca
  // global e ações. Sem o `gap-6`/`pt-6` de antes: eram ~50px de espaço morto
  // entre a topbar e a primeira informação útil da tela.
  return (
    <div className="flex flex-col gap-3">
      <div className="-m-6 mb-0 relative flex flex-col px-6 py-3.5 rounded-tl-2xl border-b" style={{ background: "var(--cf2-bg-surface)", borderColor: "var(--cf2-border-default)" }}>
        <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="CS" compactTitle actions={null} />
      </div>
      <div className="pt-3">
        <Cf2CsWorkspace />
      </div>
    </div>
  );
}
