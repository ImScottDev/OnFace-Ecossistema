import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2CsDetalhe } from "@/components/crm2/clientes/CsDetalhe";

/**
 * Tela dedicada de CS por conta — 10/09/2026, criada porque todo clique feito
 * de dentro do módulo de CS (fila, blocos, carteira) caía em `/clientes/:id`
 * (Cliente 360 inteiro), que nem sequer lê `?aba=` da URL. Ver
 * `CsDetalhe.tsx` para o achado completo.
 */
export default async function ClienteCsDetalhePage({
  params, searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ marco?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  const { empresaId } = await params;
  const { marco } = await searchParams;

  const [org] = await db.select({ nome: organizacoes.nome }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);

  return (
    <div className="onface-pagina">
      <Cf2Topbar orgNome={org?.nome || "Callface"} variant="light" title="CS" compactTitle actions={null} />
      <Cf2CsDetalhe empresaId={empresaId} marcoInicialId={marco ?? null} />
    </div>
  );
}
