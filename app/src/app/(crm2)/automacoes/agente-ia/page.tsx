import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2AgenteIAHub } from "@/components/crm2/automacoes/AgenteIAHub";

export const metadata = { title: "Agente IA" };

export default async function AutomacoesAgenteIAPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const orgNome = org?.nome || "Callface";

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={orgNome} variant="light" title="Agente de IA" subtitle="Callpilot e follow-ups automáticos — o que já roda e o que ainda é conceito de produto" compactTitle actions={null} />
      <Cf2AgenteIAHub />
    </div>
  );
}
