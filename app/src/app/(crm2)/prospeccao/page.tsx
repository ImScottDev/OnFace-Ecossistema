import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { listaProspeccao } from "@/lib/vendas/consultas";
import type { EstadoProspeccao } from "@/lib/vendas/dominio";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";
import { Prospeccao } from "@/components/onface/vendas/Prospeccao";
import { type RotaBaseVendas } from "@/components/onface/vendas/ui";
import {
  acaoAdicionarProspect, acaoAtribuirEmMassa, acaoCadencias, acaoDescartar, acaoImportarProspects,
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

  const [dados, cadencias, responsaveis, chaveApollo] = await Promise.all([
    listaProspeccao(ctx.organizacaoId, { busca, estado, responsavelId, lista }),
    acaoCadencias(),
    acaoResponsaveis(),
    getOrgApolloKey(ctx.organizacaoId),
  ]);
  // Enriquecer enfileira um job que só o Apollo resolve, e o endpoint é de
  // admin: sem chave ou sem papel o botão vira mentira, então a tela recebe o
  // motivo em vez do botão.
  const admin = ctx.userRole === "admin" || ctx.userRole === "super_admin";
  const motivoSemEnriquecer = !chaveApollo
    ? "Apollo não configurado para esta organização."
    : !admin ? "Enriquecer é restrito a administradores." : null;

  // Sem `Pagina`/`PaginaResumo`: arquétipo B (Contatos) pinta o papel até a
  // borda e leva os contadores de estado para as abas da própria lista — o
  // resumo em caixas repetia os mesmos números duas vezes na tela.
  return (
    <div data-workspace="desenho">
      <Prospeccao
        dados={dados}
        filtro={{ busca, estado, responsavelId, lista }}
        visao={visao}
        cadencias={cadencias}
        responsaveis={responsaveis}
        motivoSemEnriquecer={motivoSemEnriquecer}
        acoes={{
          adicionar: acaoAdicionarProspect,
          importar: acaoImportarProspects,
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
    </div>
  );
}

export default ProspeccaoPage;
