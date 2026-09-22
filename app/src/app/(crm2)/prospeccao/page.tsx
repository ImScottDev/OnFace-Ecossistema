import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { listaProspeccao } from "@/lib/vendas/consultas";
import type { EstadoProspeccao } from "@/lib/vendas/dominio";
import { Pagina, PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import { Prospeccao } from "@/components/onface/vendas/Prospeccao";
import { type RotaBaseVendas } from "@/components/onface/vendas/ui";
import {
  acaoAdicionarProspect, acaoAtribuirEmMassa, acaoCadencias, acaoDescartar,
  acaoInscreverEmCadencia, acaoMarcarSemResposta, acaoOportunidadeDireta,
  acaoPausarCadencia, acaoPreQualificar, acaoRegistrarResposta, acaoResponsaveis,
} from "./actions";

export const metadata = { title: "Prospecção" };
export const dynamic = "force-dynamic";

/** Rota OFICIAL do produto. A implementação mudou de casa em 18/09 (F1, lote 2):
 * morava em `/onface-preview/prospeccao` e agora é daqui. O preview virou um espelho
 * fino que chama esta mesma função com outro `rotaBase` — sem ele, um clique
 * numa tela irmã devolvia o usuário para dentro do preview. */
export async function ProspeccaoPage({ searchParams, rotaBase = "" }: {
  searchParams: Promise<{ visao?: string; busca?: string; estado?: string; responsavel?: string; lista?: string }>;
  rotaBase?: RotaBaseVendas;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const visao = params.visao === "kanban" ? "kanban" : "lista";
  const busca = params.busca?.trim() || "";
  const estado = (params.estado || null) as EstadoProspeccao | null;
  const responsavelId = params.responsavel || null;
  const lista = params.lista?.trim() || null;

  const [dados, cadencias, responsaveis] = await Promise.all([
    listaProspeccao(ctx.organizacaoId, { busca, estado, responsavelId, lista }),
    acaoCadencias(),
    acaoResponsaveis(),
  ]);

  return (
    <Pagina>
      <PaginaCabecalho titulo="Prospecção" />
      <PaginaResumo
        itens={[
          {
            rotulo: "Em cadência",
            valor: dados.resumo.em_cadencia,
            detalhe: `${dados.resumo.novo} novos aguardando`,
            destaque: true,
          },
          // Quem respondeu e ninguém tocou é o lead mais quente parado do
          // funil: é o único sinal desta tela.
          { rotulo: "Responderam", valor: dados.resumo.respondeu, sinal: true },
          { rotulo: "Pré-qualificados", valor: dados.resumo.pre_qualificado },
        ]}
      />

        <Prospeccao
          dados={dados}
          filtro={{ busca, estado, responsavelId, lista }}
          visao={visao}
          cadencias={cadencias}
          responsaveis={responsaveis}
          acoes={{
            adicionar: acaoAdicionarProspect,
            inscreverEmCadencia: acaoInscreverEmCadencia,
            pausarCadencia: acaoPausarCadencia,
            registrarResposta: acaoRegistrarResposta,
            marcarSemResposta: acaoMarcarSemResposta,
            preQualificar: acaoPreQualificar,
            oportunidadeDireta: acaoOportunidadeDireta,
            descartar: acaoDescartar,
            atribuirEmMassa: acaoAtribuirEmMassa,
          }}
        />
    </Pagina>
  );
}

export default ProspeccaoPage;
