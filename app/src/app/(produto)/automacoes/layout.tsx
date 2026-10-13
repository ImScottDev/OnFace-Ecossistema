import { areaEmBreve } from "@/lib/areas-em-breve";
import { EmBreve } from "@/components/onface/shell/EmBreve";

export const dynamic = "force-dynamic";

/* Trava por ambiente (AREAS_EM_BREVE), vale para a área inteira, subrotas
   incluídas. O código das páginas fica; só o acesso é fechado. */
export default function AutomacoesLayout({ children }: { children: React.ReactNode }) {
  if (areaEmBreve("automacoes")) return <EmBreve titulo="Automações" />;
  return children;
}
