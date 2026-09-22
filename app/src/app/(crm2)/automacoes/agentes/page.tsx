import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2AgentesWorkspace } from "@/components/crm2/automacoes/AgentesWorkspace";

export const metadata = { title: "Agentes" };

export default async function AutomacoesAgentesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");


  return (
    <div className="onface-pagina">
      <Cf2AgentesWorkspace />
    </div>
  );
}
