import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { dadosRoteamento } from "@/lib/automacoes/roteamento-tela";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { AbasAutomacoes } from "@/components/onface/automacoes/Abas";
import { RoteamentoComercial } from "@/components/onface/automacoes/RoteamentoComercial";
import "@/components/onface/automacoes/automacoes.css";

export const metadata = { title: "Roteamento comercial" };
export const dynamic = "force-dynamic";

export default async function AutomacoesRoteamentoPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // Leitura para todos; a API exige ai.configure para escrever. A tela só desliga os botões com o motivo.
  const [dados, podeConfigurar] = await Promise.all([
    dadosRoteamento(ctx.organizacaoId),
    temPermissao({ usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" }, "ai.configure"),
  ]);

  return (
    <Pagina>
      <div className="oa-barra" style={{ marginBottom: 12 }}><AbasAutomacoes atual="/automacoes/roteamento" /></div>
      <PaginaCabecalho
        titulo="Roteamento comercial"
        descricao="Para qual closer vai cada lead, por família de produto e campanha. A Lia e a agenda usam estas mesmas regras."
      />
      <RoteamentoComercial dados={dados} podeConfigurar={podeConfigurar} />
    </Pagina>
  );
}
