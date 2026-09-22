import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { AjustesNav, AjustesTitulo } from "./Nav";

/**
 * Shell de Ajustes. A topbar vive aqui e não em cada uma das 17 telas —
 * repeti-la por página era o que o layout legado fazia e o que fazia cada
 * tela migrada nascer sem cabeçalho.
 */
export default async function AjustesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title={<AjustesTitulo />} compactTitle actions={null} />
      <div className="pt-3 flex gap-5 items-start">
        <AjustesNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
