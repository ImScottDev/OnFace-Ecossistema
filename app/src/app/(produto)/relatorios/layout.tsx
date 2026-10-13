import { areaEmBreve } from "@/lib/areas-em-breve";
import { EmBreve } from "@/components/onface/shell/EmBreve";

export const dynamic = "force-dynamic";

/* Mesma trava de Automações: AREAS_EM_BREVE fecha a área inteira, incluindo
   /relatorios/biblioteca e /relatorios/performance. Quem chega por link
   colado ou pelo atalho do Início também para aqui. */
export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  if (areaEmBreve("insights")) return <EmBreve titulo="Insights" />;
  return children;
}
