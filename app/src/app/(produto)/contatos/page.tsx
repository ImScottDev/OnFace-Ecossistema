import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { linhasDeContato } from "@/lib/contatos/tela-contatos";
/* A tela é o desenho do handoff, convertido por máquina. `vendas/Contatos`
   era a versão recriada à mão e sai da rota — mesmo caminho do Pipeline. */
import { ContatosProto } from "@/components/onface/proto/ContatosProto";
import { acaoCadastrarContato, acaoCriarEmpresa, acaoCriarPessoa, acaoExcluirVisao, acaoResponsaveis, acaoSalvarVisao, acaoVisoesSalvas } from "./actions";
import { acaoAtribuirEmMassa, acaoCriarLead } from "../pre-vendas/actions";

export const metadata = { title: "Contatos & Empresas" };
export const dynamic = "force-dynamic";

/**
 * Diretório relacional do ONFACE. Não é funil: é a base de identidade que
 * Vendas, Atendimento, Onboarding, CS e Financeiro compartilham.
 *
 * A lista é uma FATIA de 500 pessoas (as de interação mais recente). O
 * desenho renderiza tudo de uma vez e refaz a árvore empresa→pessoas a cada
 * hover; com as ~4 mil pessoas da base a tela travava. A busca vai ao banco
 * (?busca=), então nada fica inalcançável, e a tela diz o tamanho do corte.
 */
export async function ContatosPage({ searchParams }: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const busca = params.busca?.trim() || "";

  const [{ linhas, empresasSemPessoas, totais, porRelacionamento }, responsaveis, visoes] = await Promise.all([
    linhasDeContato(ctx.organizacaoId, { busca }),
    acaoResponsaveis(),
    acaoVisoesSalvas("contatos"),
  ]);

  return (
    <ContatosProto
      linhas={linhas}
      empresasSemPessoas={empresasSemPessoas}
      totais={totais}
      porRelacionamento={porRelacionamento}
      responsaveis={responsaveis}
      visoes={visoes}
      busca={busca}
      agora={Date.now()}
      acoes={{
        cadastrar: acaoCadastrarContato,
        criarEmpresa: acaoCriarEmpresa,
        criarPessoa: acaoCriarPessoa,
        criarLead: acaoCriarLead,
        atribuirEmMassa: acaoAtribuirEmMassa,
        salvarVisao: acaoSalvarVisao,
        excluirVisao: acaoExcluirVisao,
      }}
    />
  );
}

export default ContatosPage;
