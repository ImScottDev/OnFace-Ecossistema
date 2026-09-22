import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2CadenciasWorkspace } from "@/components/crm2/automacoes/CadenciasWorkspace";

export const metadata = { title: "Cadências" };

export default async function AutomacoesCadenciasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");


  return (
    <div className="onface-pagina">
      <Cf2CadenciasWorkspace />
    </div>
  );
}
