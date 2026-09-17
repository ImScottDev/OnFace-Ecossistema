import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { listaProspeccao } from "@/lib/vendas/consultas";
import type { EstadoProspeccao } from "@/lib/vendas/dominio";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { Prospeccao } from "@/components/onface/vendas/Prospeccao";
import { Hero } from "@/components/onface/vendas/ui";
import {
  acaoAdicionarProspect, acaoAtribuirEmMassa, acaoCadencias, acaoDescartar,
  acaoInscreverEmCadencia, acaoMarcarSemResposta, acaoOportunidadeDireta,
  acaoPausarCadencia, acaoPreQualificar, acaoRegistrarResposta, acaoResponsaveis,
} from "@/app/(onface-preview)/onface-preview/prospeccao/actions";

export const metadata = { title: "ONFACE — Prospecção (dado real)" };
export const dynamic = "force-dynamic";

export default async function DesenhoProspeccao({ searchParams }: {
  searchParams: Promise<{ visao?: string; busca?: string; estado?: string; responsavel?: string; lista?: string }>;
}) {
  const [org] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1
  `);
  const params = await searchParams;
  const visao = params.visao === "kanban" ? "kanban" : "lista";
  const busca = params.busca?.trim() || "";
  const estado = (params.estado || null) as EstadoProspeccao | null;
  const responsavelId = params.responsavel || null;
  const lista = params.lista?.trim() || null;

  const [dados, cadencias, responsaveis] = await Promise.all([
    listaProspeccao(org.id, { busca, estado, responsavelId, lista }),
    acaoCadencias(),
    acaoResponsaveis(),
  ]);

  return (
    <OnfacePage>
      <OnfacePageBand>
        <Hero
          titulo="Prospecção"
          descricao="Operação outbound. Duas saídas: pré-qualificar entrega a empresa a Pré-vendas; criar oportunidade vai direto ao Pipeline."
          resumo={[
            { rotulo: "Novos", valor: dados.resumo.novo },
            { rotulo: "Em cadência", valor: dados.resumo.em_cadencia },
            { rotulo: "Responderam", valor: dados.resumo.respondeu },
            { rotulo: "Pré-qualificados", valor: dados.resumo.pre_qualificado },
          ]}
        />
      </OnfacePageBand>
      <OnfacePageSurface sobreposto>
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
      </OnfacePageSurface>
    </OnfacePage>
  );
}
