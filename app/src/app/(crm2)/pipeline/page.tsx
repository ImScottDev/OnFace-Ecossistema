import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPipeline } from "@/lib/vendas/consultas";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
/* A tela é o desenho do handoff, convertido por máquina. `vendas/Pipeline`
   era a versão recriada à mão e sai da rota — ver docs/design/PLANO-HANDOFF.md. */
import { PipelineProto } from "@/components/onface/proto/PipelineProto";
import { type RotaBaseVendas } from "@/components/onface/vendas/ui";
import { moeda } from "@/components/onface/vendas/formato";
import {
  acaoAgendarReuniao, acaoAlterarFamilia, acaoBuscarEmpresas, acaoCriarOportunidade,
  acaoDefinirProximaAcao, acaoDetalhe, acaoMarcarEstagnacao, acaoMoverEtapa,
  acaoNoShow, acaoPerder, acaoReagendar, acaoTentarGanhar, acaoTrial,
} from "./actions";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

type Aba = "abertas" | "ganhas" | "perdidas";

/** Rota OFICIAL do produto. A implementação mudou de casa em 18/09 (F1, lote 2):
 * morava em `/onface-preview/pipeline` e agora é daqui. O preview virou um espelho
 * fino que chama esta mesma função com outro `rotaBase` — sem ele, um clique
 * numa tela irmã devolvia o usuário para dentro do preview. */
export async function PipelinePage({ searchParams, rotaBase = "" }: {
  searchParams: Promise<{ aba?: string; busca?: string; responsavel?: string; familia?: string; oportunidade?: string; loop?: string }>;
  rotaBase?: RotaBaseVendas;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  // Sem aba na URL o board é ÚNICO: as seis colunas na mesma linha, com
  // Ganho e Perdido fechadas. A aba só sobrevive para link antigo salvo.
  const aba: Aba | null =
    params.aba === "ganhas" || params.aba === "perdidas" || params.aba === "abertas" ? params.aba : null;
  const busca = params.busca?.trim() || "";
  const responsavelId = params.responsavel || null;
  const familia = params.familia || null;
  // Next Step Invariant: o número de "sem próxima ação" deixou de ser enfeite
  // no topo e virou um recorte do board.
  const semProximaAcao = params.loop === "sem-proxima-acao";

  const dados = await boardPipeline(ctx.organizacaoId, { aba, busca, responsavelId, familia, semProximaAcao });

  // Só quando o recorte está ativo: a fila é uma pergunta a mais no banco, e
  // não faz sentido pagá-la para quem está olhando o board inteiro.
  const { resumoDeLoops } = await import("@/lib/vendas/loops-abertos");
  const loops = semProximaAcao ? await resumoDeLoops(ctx.organizacaoId, responsavelId) : null;

  return (
    <PipelineProto
      dados={dados}
      acoes={{
        moverEtapa: acaoMoverEtapa,
        perder: acaoPerder,
        tentarGanhar: acaoTentarGanhar,
      }}
    />
  );
}

export default PipelinePage;
