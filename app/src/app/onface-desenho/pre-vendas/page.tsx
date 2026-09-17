import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { boardPreVendas } from "@/lib/vendas/consultas";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "@/components/onface/shell/OnfacePage";
import { PreVendas } from "@/components/onface/vendas/PreVendas";
import { Hero } from "@/components/onface/vendas/ui";
import {
  acaoAssociarEmpresa, acaoAtribuir, acaoCriarLead, acaoCriarOportunidade,
  acaoDesqualificar, acaoDetalhe, acaoMoverEtapa, acaoNutrir, acaoQualificar,
  acaoReativar, acaoRegistrarContato, acaoSalvarQualificacao,
} from "@/app/(onface-preview)/onface-preview/pre-vendas/actions";

export const metadata = { title: "ONFACE — Pré-vendas (dado real)" };
export const dynamic = "force-dynamic";

/**
 * Pré-vendas com dado real, sem exigir sessão. Só existe em desenvolvimento
 * (o layout do grupo bloqueia em produção) e serve para validar a tela com
 * volume e texto de verdade. As ações de escrita são as MESMAS da rota
 * oficial: elas resolvem o tenant no servidor e recusam sem sessão.
 */
export default async function DesenhoPreVendas({ searchParams }: {
  searchParams: Promise<{ aba?: string; busca?: string; responsavel?: string }>;
}) {
  const [org] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1
  `);
  const params = await searchParams;
  const aba = params.aba === "nutricao" || params.aba === "desqualificados" ? params.aba : "ativos";
  const busca = params.busca?.trim() || "";
  const responsavelId = params.responsavel || null;

  const dados = await boardPreVendas(org.id, { aba, busca, responsavelId });

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
          dados={dados}
          aba={aba}
          filtro={{ busca, responsavelId }}
          acoes={{
            moverEtapa: acaoMoverEtapa, qualificar: acaoQualificar,
            salvarQualificacao: acaoSalvarQualificacao, nutrir: acaoNutrir,
            desqualificar: acaoDesqualificar, reativar: acaoReativar,
            registrarContato: acaoRegistrarContato, atribuir: acaoAtribuir,
            criarOportunidade: acaoCriarOportunidade, criarLead: acaoCriarLead,
            associarEmpresa: acaoAssociarEmpresa, detalhe: acaoDetalhe,
          }}
        />
      </OnfacePageSurface>
    </OnfacePage>
  );
}
