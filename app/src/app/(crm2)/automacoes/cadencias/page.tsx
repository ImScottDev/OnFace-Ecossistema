import { getTenantContext } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { redirect } from "next/navigation";
import { CadenciasOnface } from "@/components/onface/automacoes/cadencias/CadenciasOnface";

export const metadata = { title: "Cadências" };

export default async function AutomacoesCadenciasPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // A rota Hono já barra a escrita sem automation.manage. Calcular aqui só
  // serve para a tela desabilitar os botões com o motivo, em vez de deixar a
  // pessoa clicar e tomar 403.
  const podeGerenciar = await temPermissao(
    { usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" },
    "automation.manage",
  );

  return (
    <div className="onface-pagina">
      <CadenciasOnface podeGerenciar={podeGerenciar} />
    </div>
  );
}
