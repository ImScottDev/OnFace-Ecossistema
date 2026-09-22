import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { diretorioEmpresas, diretorioPessoas, pessoaPorId } from "@/lib/vendas/consultas";
import type { RelacionamentoEmpresa } from "@/lib/vendas/dominio";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import { Contatos } from "@/components/onface/vendas/Contatos";
import { type RotaBaseVendas } from "@/components/onface/vendas/ui";
import {
  acaoBuscarEmpresas, acaoCriarEmpresa, acaoCriarLeadDaEmpresa, acaoCriarPessoa,
  acaoEmpresa360, acaoNovaOportunidade, acaoResponsaveis, acaoSalvarDadosJuridicos,
  acaoVincularPessoa,
} from "./actions";

export const metadata = { title: "Contatos & Empresas | Callface" };
export const dynamic = "force-dynamic";

/**
 * Diretório relacional do ONFACE. Não é funil: é a base de identidade que
 * Vendas, Atendimento, Onboarding, CS e Financeiro compartilham.
 */
/** Rota OFICIAL do produto. A implementação mudou de casa em 18/09 (F1, lote 2):
 * morava em `/onface-preview/contatos` e agora é daqui. O preview virou um espelho
 * fino que chama esta mesma função com outro `rotaBase` — sem ele, um clique
 * numa tela irmã devolvia o usuário para dentro do preview. */
export async function ContatosPage({ searchParams, rotaBase = "" }: {
  searchParams: Promise<{ aba?: string; busca?: string; relacao?: string; semEmpresa?: string; empresa?: string; pessoa?: string }>;
  rotaBase?: RotaBaseVendas;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const aba = params.aba === "pessoas" || params.pessoa ? "pessoas" : "empresas";
  const busca = params.busca?.trim() || "";
  const relacionamento = (params.relacao || null) as RelacionamentoEmpresa | null;
  const semEmpresa = params.semEmpresa === "1";

  const [empresas, pessoas, pessoaInicial, responsaveis] = await Promise.all([
    diretorioEmpresas(ctx.organizacaoId, { busca, relacionamento, limite: 200 }),
    aba === "pessoas" ? diretorioPessoas(ctx.organizacaoId, { busca, semEmpresa, limite: 200 }) : Promise.resolve([]),
    params.pessoa ? pessoaPorId(ctx.organizacaoId, params.pessoa) : Promise.resolve(null),
    acaoResponsaveis(),
  ]);
  const pessoasComAlvo = pessoaInicial && !pessoas.some((p) => p.id === pessoaInicial.id) ? [pessoaInicial, ...pessoas] : pessoas;

  return (
    <Pagina>
      <PaginaCabecalho titulo="Contatos & Empresas" />
      <PaginaResumo
        itens={[
          {
            rotulo: "Empresas",
            valor: empresas.total,
            detalhe: "no diretório",
            destaque: true,
          },
          { rotulo: "Clientes", valor: empresas.porRelacionamento.cliente },
          { rotulo: "Em oportunidade", valor: empresas.porRelacionamento.em_oportunidade },
          { rotulo: "Em pré-vendas", valor: empresas.porRelacionamento.em_pre_vendas },
        ]}
      />

        <Contatos
          aba={aba}
          empresas={empresas}
          pessoas={pessoasComAlvo}
          filtro={{ busca, relacionamento, semEmpresa }}
          responsaveis={responsaveis}
          selecaoInicial={params.empresa ?? null}
          pessoaInicial={params.pessoa ?? null}
          rotaBase={rotaBase}
          acoes={{
            criarEmpresa: acaoCriarEmpresa,
            criarPessoa: acaoCriarPessoa,
            vincularPessoa: acaoVincularPessoa,
            criarLeadDaEmpresa: acaoCriarLeadDaEmpresa,
            novaOportunidade: acaoNovaOportunidade,
            salvarDadosJuridicos: acaoSalvarDadosJuridicos,
            empresa360: acaoEmpresa360,
            buscarEmpresas: acaoBuscarEmpresas,
          }}
        />
    </Pagina>
  );
}

export default ContatosPage;
