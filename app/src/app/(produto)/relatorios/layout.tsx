import { areaEmBreve } from "@/lib/areas-em-breve";
import { getTenantContext } from "@/lib/auth/tenant";
import { EmBreve } from "@/components/onface/shell/EmBreve";

export const dynamic = "force-dynamic";

/* Mesma trava de Automações: AREAS_EM_BREVE fecha a área inteira, incluindo
   /relatorios/biblioteca e /relatorios/performance. Quem chega por link
   colado ou pelo atalho do Início também para aqui. */
export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  /* Em produção, Insights abre só para o super admin (AREAS_SO_SUPERADMIN):
     quem chega por link colado também passa por aqui. */
  const papel = (await getTenantContext().catch(() => null))?.userRole ?? null;
  if (areaEmBreve("insights", papel)) return <EmBreve titulo="Insights" />;
  return children;
}
