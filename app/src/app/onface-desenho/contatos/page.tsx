import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { diretorioEmpresas, diretorioPessoas } from "@/lib/vendas/consultas";
import type { RelacionamentoEmpresa } from "@/lib/vendas/dominio";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { Contatos } from "@/components/onface/vendas/Contatos";
import { Hero } from "@/components/onface/vendas/ui";
import {
  acaoBuscarEmpresas, acaoCriarEmpresa, acaoCriarLeadDaEmpresa, acaoCriarPessoa,
  acaoEmpresa360, acaoNovaOportunidade, acaoResponsaveis, acaoSalvarDadosJuridicos,
  acaoVincularPessoa,
} from "@/app/(onface-preview)/onface-preview/contatos/actions";

export const metadata = { title: "ONFACE — Contatos (dado real)" };
export const dynamic = "force-dynamic";

/**
 * Diretório relacional do ONFACE. Não é funil: é a base de identidade que
 * Vendas, Atendimento, Onboarding, CS e Financeiro compartilham.
 */
export default async function DesenhoContatos({ searchParams }: {
  searchParams: Promise<{ aba?: string; busca?: string; relacao?: string; semEmpresa?: string; empresa?: string }>;
}) {
  const [org] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1
  `);
  const params = await searchParams;
  const aba = params.aba === "pessoas" ? "pessoas" : "empresas";
  const busca = params.busca?.trim() || "";
  const relacionamento = (params.relacao || null) as RelacionamentoEmpresa | null;
  const semEmpresa = params.semEmpresa === "1";

  const [empresas, pessoas, responsaveis] = await Promise.all([
    diretorioEmpresas(org.id, { busca, relacionamento, limite: 200 }),
    aba === "pessoas" ? diretorioPessoas(org.id, { busca, semEmpresa, limite: 200 }) : Promise.resolve([]),
    acaoResponsaveis(),
  ]);

  return (
    <OnfacePage>
      <OnfacePageBand>
        <Hero
          titulo="Contatos & Empresas"
          descricao="O diretório do ONFACE. A relação de cada empresa é consequência dos processos reais, não um status editável."
          resumo={[
            { rotulo: "Empresas", valor: empresas.total },
            { rotulo: "Clientes", valor: empresas.porRelacionamento.cliente },
            { rotulo: "Em oportunidade", valor: empresas.porRelacionamento.em_oportunidade },
            { rotulo: "Em Pré-vendas", valor: empresas.porRelacionamento.em_pre_vendas },
          ]}
        />
      </OnfacePageBand>
      <OnfacePageSurface sobreposto>
        <Contatos
          aba={aba}
          empresas={empresas}
          pessoas={pessoas}
          filtro={{ busca, relacionamento, semEmpresa }}
          responsaveis={responsaveis}
          selecaoInicial={params.empresa ?? null}
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
      </OnfacePageSurface>
    </OnfacePage>
  );
}
