import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { RESPONSAVEL_TODOS } from "@/lib/vendas/recorte-padrao";
import { boardPipeline } from "@/lib/vendas/consultas";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
/* A tela é o desenho do handoff, convertido por máquina
   (ver docs/design/COMO-LIGAR-UMA-TELA.md). */
import { PipelineProto } from "@/components/onface/proto/PipelineProto";
import { moeda } from "@/components/onface/vendas/formato";
import {
  acaoAgendarReuniao, acaoAlterarFamilia, acaoBuscarEmpresas, acaoCriarOportunidade,
  acaoDefinirProximaAcao, acaoDetalhe, acaoMarcarEstagnacao, acaoMoverEtapa,
  acaoNoShow, acaoPerder, acaoReagendar, acaoRegistrarNota, acaoTentarGanhar, acaoTrial,
} from "./actions";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

type Aba = "abertas" | "ganhas" | "perdidas";

/** Pipeline de oportunidades (Módulo 01, Bloco 02). */
export async function PipelinePage({ searchParams }: {
  searchParams: Promise<{ aba?: string; busca?: string; responsavel?: string; familia?: string; oportunidade?: string; loop?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  // Sem aba na URL o board é ÚNICO: as seis colunas na mesma linha, com
  // Ganho e Perdido fechadas. A aba só sobrevive para link antigo salvo.
  const aba: Aba | null =
    params.aba === "ganhas" || params.aba === "perdidas" || params.aba === "abertas" ? params.aba : null;
  const busca = params.busca?.trim() || "";
  /* O recorte de dono NÃO é feito aqui, e isso é deliberado.
     
     O filtro "Responsável" desta tela é do lado do cliente: ele recorta os
     cartões que o board entregou. Quando o servidor TAMBÉM recortava em
     "meus", escolher outra pessoa no filtro buscava dentro de um conjunto que
     já só tinha os seus, e a tela ficava vazia — foi o que o Scott viu em
     19/10. Quem abre a tela nos seus é o filtro, que já vem marcado com você
     (PipelineLiga): limpar ou trocar a pessoa mostra o que deve mostrar.
     
     Um `?responsavel=` explícito (link salvo, KPI) continua valendo, porque aí
     é escolha de quem está olhando e vem de fora da tela. */
  const responsavelId = params.responsavel && params.responsavel !== RESPONSAVEL_TODOS ? params.responsavel : null;
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
      abrirNosMeus={!params.responsavel}
      acoes={{
        moverEtapa: acaoMoverEtapa,
        perder: acaoPerder,
        tentarGanhar: acaoTentarGanhar,
        noShow: acaoNoShow,
        registrarNota: acaoRegistrarNota,
        detalhe: acaoDetalhe,
      }}
    />
  );
}

export default PipelinePage;
