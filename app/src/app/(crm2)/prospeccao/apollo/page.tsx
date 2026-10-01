import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { BuscaApollo } from "./_busca";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";

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
  const chave = await getOrgApolloKey(ctx.organizacaoId);
  // Busca E import do Apollo são restritos a admin no Hono (403 para os
  // demais, routes/apollo.ts): o motivo desabilita os dois botões.
  const admin = ctx.userRole === "admin" || ctx.userRole === "super_admin";

  return (
    <div className="onface-pagina">
      <BuscaApollo
        semChave={chave ? null : "Apollo não configurado para esta organização: a busca fica desligada até um administrador cadastrar a chave da API em Ajustes › Integrações."}
        semPermissao={admin ? null : "Buscar e importar do Apollo é restrito a administradores."}
      />
    </div>
  );
}
