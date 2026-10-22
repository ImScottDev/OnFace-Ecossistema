import { areaEmBreve } from "@/lib/areas-em-breve";
import { getTenantContext } from "@/lib/auth/tenant";
import { EmBreve } from "@/components/onface/shell/EmBreve";

export const dynamic = "force-dynamic";

/* Trava por ambiente (AREAS_EM_BREVE), vale para a área inteira, subrotas
   incluídas. O código das páginas fica; só o acesso é fechado. */
export default async function AutomacoesLayout({ children }: { children: React.ReactNode }) {
  const papel = (await getTenantContext().catch(() => null))?.userRole ?? null;
  if (areaEmBreve("automacoes", papel)) return <EmBreve titulo="Automações" />;
  return children;
}
