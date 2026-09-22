import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { FormNovoNegocio } from "./_form";

/**
 * Novo negócio. Migrada do shell legado em 08/09/2026 — é o destino do botão
 * "Novo negócio" da topbar, que aparece em TODA página do CRM2: era a saída
 * pro legado mais clicada do produto inteiro.
 */
export default async function NovoNegocioPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="onface-pagina">
      {/* `actions={null}` remove o CTA: já estamos DENTRO da criação de
          negócio, e o botão "Novo negócio" apontando pra própria tela é
          um beco. Passar ctaLabel="" deixava um "+" solto. */}
      <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="Novo negócio" compactTitle actions={null} />
      <FormNovoNegocio />
    </div>
  );
}
