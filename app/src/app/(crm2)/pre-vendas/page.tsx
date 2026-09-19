import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPreVendas } from "@/lib/vendas/consultas";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { PreVendas } from "@/components/onface/vendas/PreVendas";
import { Hero, type RotaBaseVendas } from "@/components/onface/vendas/ui";
import {
  acaoAssociarEmpresa, acaoAtribuir, acaoCriarLead, acaoCriarOportunidade,
  acaoDesqualificar, acaoDetalhe, acaoMoverEtapa, acaoNutrir, acaoQualificar,
  acaoReativar, acaoRegistrarContato, acaoSalvarQualificacao,
} from "./actions";

export const metadata = { title: "Pré-vendas | Callface" };
export const dynamic = "force-dynamic";

type Aba = "ativos" | "nutricao" | "desqualificados";

/**
 * Pré-vendas — rota OFICIAL do produto (`/pre-vendas`).
 *
 * A leitura vem de `boardPreVendas`; a escrita, das server actions ao lado,
 * que entram no motor em `lib/vendas`. A página só amarra as duas pontas.
 *
 * Mudou de casa em 18/09 (F1, lote 2): a implementação morava em
 * `/onface-preview/pre-vendas` e a rota oficial servia a tela antiga do CRM
 * 2.0. Agora é o contrário — aqui é a fonte, e o preview é um espelho fino
 * que chama esta mesma função com outro `rotaBase`. Era o preview que
 * segurava o produto; inverter foi o ponto todo de matar o rascunho.
 *
 * `rotaBase` existe porque a tela linka para as irmãs do módulo (abrir a
 * empresa em Contatos, a oportunidade no Pipeline). Sem ele, um clique na
 * rota oficial devolvia o usuário para dentro do preview.
 */
export async function PreVendasPage({ searchParams, rotaBase = "" }: {
  searchParams: Promise<{ aba?: string; busca?: string; responsavel?: string }>;
  rotaBase?: RotaBaseVendas;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const aba: Aba = params.aba === "nutricao" || params.aba === "desqualificados" ? params.aba : "ativos";
  const busca = params.busca?.trim() || "";
  const responsavelId = params.responsavel || null;

  const dados = await boardPreVendas(ctx.organizacaoId, { aba, busca, responsavelId });

  return (
    <OnfacePage>
      <OnfacePageBand>
        <Hero
          titulo="Pré-vendas"
          descricao="Empresas em qualificação. A empresa é o objeto de trabalho; a pessoa é o contato através do qual ela é trabalhada."
          resumo={[
            { rotulo: "Em jogo", valor: dados.resumo.ativos },
            { rotulo: "Sem responsável", valor: dados.resumo.semResponsavel, alerta: dados.resumo.semResponsavel > 0 },
            { rotulo: "Sem 1º contato", valor: dados.resumo.semPrimeiroContato, alerta: dados.resumo.semPrimeiroContato > 0 },
            { rotulo: "Em nutrição", valor: dados.resumo.nutricao },
          ]}
        />
      </OnfacePageBand>

      <OnfacePageSurface sobreposto>
        <PreVendas
          rotaBase={rotaBase}
          dados={dados}
          aba={aba}
          filtro={{ busca, responsavelId }}
          acoes={{
            moverEtapa: acaoMoverEtapa,
            qualificar: acaoQualificar,
            salvarQualificacao: acaoSalvarQualificacao,
            nutrir: acaoNutrir,
            desqualificar: acaoDesqualificar,
            reativar: acaoReativar,
            registrarContato: acaoRegistrarContato,
            atribuir: acaoAtribuir,
            criarOportunidade: acaoCriarOportunidade,
            criarLead: acaoCriarLead,
            associarEmpresa: acaoAssociarEmpresa,
            detalhe: acaoDetalhe,
          }}
        />
      </OnfacePageSurface>
    </OnfacePage>
  );
}

export default PreVendasPage;
