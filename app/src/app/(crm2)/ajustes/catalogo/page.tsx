import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { Cf2CatalogoWorkspace } from "@/components/crm2/ajustes/CatalogoWorkspace";

export default async function AjustesCatalogoPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <Cf2Topbar orgNome="Callface" variant="light" title="Catálogo" subtitle="Produtos por família comercial — nunca inferido por nome, sempre declarado" compactTitle />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Cf2CatalogoWorkspace />
      </div>
    </div>
  );
}
