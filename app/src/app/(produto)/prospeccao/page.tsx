import { redirect } from "next/navigation";
import { responsavelPadrao } from "@/lib/vendas/recorte-padrao";
import { getTenantContext } from "@/lib/auth/tenant";
import {
  FILAS_PROSPECCAO, ORDENS_PROSPECCAO, kanbanProspeccao, listaProspeccao, operacaoProspeccao,
  type FilaProspeccao, type OrdemProspeccao,
} from "@/lib/vendas/consultas";
import { ESTADOS_PROSPECCAO, POR_PAGINA_PROSPECCAO, type EstadoProspeccao } from "@/lib/vendas/dominio";
import { getOrgApolloKey } from "@/lib/apollo/tenant-key";
import { ProspeccaoProto, type Visao } from "@/components/onface/proto/ProspeccaoProto";
import {
  acaoAdicionarProspect, acaoAtribuirEmMassa, acaoAtribuirProspect, acaoCadencias, acaoDetalheProspect, acaoImportarProspects,
  acaoInscreverEmCadencia, acaoMoverProspect, acaoPausarCadencia, acaoResponsaveis, acaoRetomarCadencia,
} from "./actions";

export const metadata = { title: "Prospecção" };
export const dynamic = "force-dynamic";

const VISOES: Visao[] = ["operacao", "kanban", "lista", "campanhas", "inteligencia"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prospecção (Módulo 01, Bloco 04).
 *
 * Todo recorte vive na URL (visão, estado, busca, filtros, ordem, página,
 * prospect aberto): F5, link compartilhado e volta do detalhe devolvem a mesma
 * tela. Só a visão aberta consulta o que precisa.
 */
export async function ProspeccaoPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const p = await searchParams;
  const visao: Visao = VISOES.includes(p.visao as Visao) ? (p.visao as Visao) : "lista";
  const estado = (ESTADOS_PROSPECCAO as readonly string[]).includes(p.estado ?? "") ? (p.estado as EstadoProspeccao) : null;
  const filtro = {
    busca: p.busca?.trim() || "",
    estado,
    /* Abre nos meus, como Pré-vendas e Pipeline. "sem" (sem dono) e um id
       continuam valendo; `responsavel=todos` e qualquer outro recorte na URL
       devolvem a lista inteira. */
    responsavelId: p.responsavel === "sem" || UUID.test(p.responsavel ?? "")
      ? p.responsavel!
      : responsavelPadrao(ctx.userId, p.responsavel, [p.busca, p.estado, p.lista, p.cadencia, p.fila, p.pagina]),
    lista: p.lista?.trim() || null,
    cadenciaId: p.cadencia === "sem" || UUID.test(p.cadencia ?? "") ? p.cadencia! : null,
    fila: (FILAS_PROSPECCAO as readonly string[]).includes(p.fila ?? "") ? (p.fila as FilaProspeccao) : null,
    ordem: (ORDENS_PROSPECCAO as readonly string[]).includes(p.ordem ?? "") ? (p.ordem as OrdemProspeccao) : null,
    direcao: p.dir === "asc" || p.dir === "desc" ? p.dir : null,
  } as const;
  const consulta = {
    busca: filtro.busca, estado, responsavelId: filtro.responsavelId, lista: filtro.lista,
    cadenciaId: filtro.cadenciaId, fila: filtro.fila, ordem: filtro.ordem, direcao: filtro.direcao,
  };
  const pagina = Number.parseInt(p.pagina ?? "", 10);
  const porPagina = Number.parseInt(p.porPagina ?? "", 10);
  const mostrar = Number.parseInt(p.mostrar ?? "", 10);
  const porColuna = Number.isFinite(mostrar) ? Math.min(Math.max(mostrar, 25), 500) : 25;
  const abertoId = UUID.test(p.lead ?? "") ? p.lead! : null;

  const [lista, kanban, operacao, cadencias, responsaveis, chaveApollo] = await Promise.all([
    visao === "lista"
      ? listaProspeccao(ctx.organizacaoId, ctx.userId, { ...consulta, pagina: Number.isFinite(pagina) ? pagina : 1, porPagina: (POR_PAGINA_PROSPECCAO as readonly number[]).includes(porPagina) ? porPagina : 25 })
      : null,
    visao === "kanban" ? kanbanProspeccao(ctx.organizacaoId, ctx.userId, consulta, porColuna) : null,
    visao === "operacao" || visao === "campanhas" || visao === "inteligencia" ? operacaoProspeccao(ctx.organizacaoId) : null,
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

  const opcoes = (lista ?? kanban)?.filtros ?? { responsaveis, listas: [], cadencias: [] };

  return (
    <div data-workspace="desenho">
      <ProspeccaoProto
        visao={visao}
        dados={lista}
        kanban={kanban}
        operacao={operacao}
        filtro={filtro}
        opcoes={opcoes}
        cadencias={cadencias}
        responsaveis={responsaveis}
        abertoId={abertoId}
        porColuna={porColuna}
        motivoSemEnriquecer={motivoSemEnriquecer}
        acoes={{
          adicionar: acaoAdicionarProspect,
          importar: acaoImportarProspects,
          inscreverEmCadencia: acaoInscreverEmCadencia,
          pausarCadencia: acaoPausarCadencia,
          retomarCadencia: acaoRetomarCadencia,
          mover: acaoMoverProspect,
          detalhe: acaoDetalheProspect,
          atribuir: acaoAtribuirProspect,
          atribuirEmMassa: acaoAtribuirEmMassa,
        }}
      />
    </div>
  );
}

export default ProspeccaoPage;
