import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { Cf2RiscoWorkspace } from "@/components/crm2/clientes/RiscoWorkspace";

export const metadata = { title: "Risco e churn" };

/** Risco / Churn (v0.13, Módulo 08).
 *
 *  Era `ModuloPendente` desde 16/09, com duas dependências listadas. As duas
 *  já estavam resolvidas quando esta tela foi escrita: `lib/cs/riscos` mantém
 *  os riscos abertos no banco, e o tipo do risco já separa cobrança de
 *  relacionamento. Faltava a leitura agregada e a tela.
 *
 *  01/10: estrutura de página ONFACE (`Pagina`), sem o Topbar do CRM2. */
export const dynamic = "force-dynamic";

export default async function ClientesRiscoPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  return (
    <Pagina>
      <PaginaCabecalho
        titulo="Risco e churn"
        descricao="Contas com sinal de saída antes do cancelamento, separadas por quem resolve."
      />
      <Cf2RiscoWorkspace />
    </Pagina>
  );
}
