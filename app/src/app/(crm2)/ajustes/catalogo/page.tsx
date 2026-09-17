import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2CatalogoWorkspace } from "@/components/crm2/ajustes/CatalogoWorkspace";

export default async function AjustesCatalogoPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Cf2CatalogoWorkspace />
      </div>
    </div>
  );
}
