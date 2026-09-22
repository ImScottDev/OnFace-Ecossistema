import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { BuscaApollo } from "./_busca";

export const metadata = { title: "Busca Apollo" };

/**
 * Busca Apollo. Era a última tela que a navegação do CRM2 mandava pro shell
 * legado (link "módulo legado" dentro de Prospecção). Migrada em 08/09/2026 e
 * colocada como sub-rota de Prospecção, que é onde ela pertence: prospectar é
 * a tarefa, o Apollo é uma das fontes.
 */
export default async function ProspeccaoApolloPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");


  return (
    <div className="onface-pagina">
      <BuscaApollo />
    </div>
  );
}
