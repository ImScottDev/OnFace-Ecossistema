import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2CsWorkspace } from "@/components/crm2/clientes/CsWorkspace";

export const metadata = { title: "Customer Success" };

export default async function ClientesCsPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // O cabeçalho mora no workspace: escopo e busca são estado de cliente, e um
  // cabeçalho aqui sem eles obrigaria a tela a ter dois — foi o que produziu
  // "CS" na página e "Customer Success" logo abaixo.
  return (
    <div className="onface-pagina">
      <Cf2CsWorkspace />
    </div>
  );
}
