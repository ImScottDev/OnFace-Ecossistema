import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPipeline } from "@/lib/vendas/consultas";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { Pipeline } from "@/components/onface/vendas/Pipeline";
import { Hero, type RotaBaseVendas } from "@/components/onface/vendas/ui";
import { moeda } from "@/components/onface/vendas/formato";
import {
  acaoAgendarReuniao, acaoAlterarFamilia, acaoBuscarEmpresas, acaoCriarOportunidade,
  acaoDefinirProximaAcao, acaoDetalhe, acaoMarcarEstagnacao, acaoMoverEtapa,
  acaoNoShow, acaoPerder, acaoReagendar, acaoTentarGanhar, acaoTrial,
} from "./actions";

export const metadata = { title: "Pipeline | Callface" };
export const dynamic = "force-dynamic";

type Aba = "abertas" | "ganhas" | "perdidas";

/** Rota OFICIAL do produto. A implementação mudou de casa em 18/09 (F1, lote 2):
 * morava em `/onface-preview/pipeline` e agora é daqui. O preview virou um espelho
 * fino que chama esta mesma função com outro `rotaBase` — sem ele, um clique
 * numa tela irmã devolvia o usuário para dentro do preview. */
export async function PipelinePage({ searchParams, rotaBase = "" }: {
  searchParams: Promise<{ aba?: string; busca?: string; responsavel?: string; familia?: string; oportunidade?: string }>;
  rotaBase?: RotaBaseVendas;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const aba: Aba = params.aba === "ganhas" || params.aba === "perdidas" ? params.aba : "abertas";
  const busca = params.busca?.trim() || "";
  const responsavelId = params.responsavel || null;
  const familia = params.familia || null;

  const dados = await boardPipeline(ctx.organizacaoId, { aba, busca, responsavelId, familia });

  return (
    <OnfacePage>
      <OnfacePageBand>
        <Hero
          titulo="Pipeline"
          descricao="Oportunidades comerciais reais. Uma família por oportunidade; reunião, trial e no-show são eventos, não colunas."
          resumo={[
            { rotulo: "Em aberto", valor: dados.resumo.abertas },
            { rotulo: "Valor em aberto", valor: moeda(dados.resumo.valorEmAberto) },
            { rotulo: "Sem próxima ação", valor: dados.resumo.semProximaAcao, alerta: dados.resumo.semProximaAcao > 0 },
            { rotulo: "Ganhas", valor: dados.resumo.ganhas },
          ]}
        />
      </OnfacePageBand>
      <OnfacePageSurface sobreposto>
        <Pipeline
          dados={dados}
          aba={aba}
          filtro={{ busca, responsavelId, familia }}
          selecaoInicial={params.oportunidade ?? null}
          rotaBase={rotaBase}
          acoes={{
            moverEtapa: acaoMoverEtapa, definirProximaAcao: acaoDefinirProximaAcao,
            marcarEstagnacao: acaoMarcarEstagnacao, alterarFamilia: acaoAlterarFamilia,
            perder: acaoPerder, tentarGanhar: acaoTentarGanhar,
            agendarReuniao: acaoAgendarReuniao, noShow: acaoNoShow, reagendar: acaoReagendar,
            trial: acaoTrial, criarOportunidade: acaoCriarOportunidade,
            buscarEmpresas: acaoBuscarEmpresas, detalhe: acaoDetalhe,
          }}
        />
      </OnfacePageSurface>
    </OnfacePage>
  );
}

export default PipelinePage;
