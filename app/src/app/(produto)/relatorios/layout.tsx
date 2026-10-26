import { areaEmBreve } from "@/lib/areas-em-breve";
import { getTenantContext } from "@/lib/auth/tenant";
import { EmBreve } from "@/components/onface/shell/EmBreve";

export const dynamic = "force-dynamic";

/* Mesma trava de Automações: AREAS_EM_BREVE fecha a área inteira, incluindo
   /relatorios/biblioteca e /relatorios/performance. Quem chega por link
   colado ou pelo atalho do Início também para aqui. */
export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  /* Em produção, Insights abre para admin e super admin (`AREAS_SO_ADMIN`);
     o resto do time vê "Em breve". Quem chega por link colado para aqui também.
     O papel é o EFETIVO: super admin em "ver como" enxerga o que o outro vê. */
  const papel = (await getTenantContext().catch(() => null))?.userRole ?? null;
  if (areaEmBreve("insights", papel)) return <EmBreve titulo="Insights" />;
  return children;
}
