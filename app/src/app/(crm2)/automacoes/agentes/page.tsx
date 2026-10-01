import { getTenantContext } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { temPermissao } from "@/lib/auth/permissoes";
import { dadosTelaAgentes } from "@/lib/automacoes/agentes-tela";
import { AgentesTela } from "@/components/onface/automacoes/AgentesTela";

export const metadata = { title: "Agentes" };
export const dynamic = "force-dynamic";

export default async function AutomacoesAgentesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // Leitura no SSR (tenant do contexto) e permissão resolvida aqui: o botão
  // Novo agente precisa saber ANTES de renderizar se a API vai aceitar.
  const [dados, podeConfigurar] = await Promise.all([
    dadosTelaAgentes(ctx.organizacaoId),
    temPermissao({ usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" }, "ai.configure"),
  ]);

  // `desenho`: a tela pinta o próprio papel até a borda, como as do protótipo.
  return (
    <div data-workspace="desenho">
      <AgentesTela dados={dados} podeConfigurar={podeConfigurar} />
    </div>
  );
}
