import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { Cf2AutomacoesWorkspace } from "@/components/crm2/automacoes/Workspace";

export default async function AutomacoesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <div className="onface-pagina">
      {/* O cabeçalho mora no workspace: a ação primária abre um formulário
          cujo estado é de cliente, e cabeçalho sem a ação deixava o botão
          numa faixa só dele entre o título e o primeiro dado. */}
      <Cf2AutomacoesWorkspace />
    </div>
  );
}
