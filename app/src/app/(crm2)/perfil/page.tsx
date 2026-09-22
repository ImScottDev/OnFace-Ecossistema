import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { ConteudoPerfil } from "./_conteudo";

export const metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="Meu perfil" compactTitle actions={null} />
      <ConteudoPerfil />
    </div>
  );
}
