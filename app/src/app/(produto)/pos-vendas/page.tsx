import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { BoardView } from "@/components/onface/pos-venda/board/BoardView";
import { ErroDeLeitura } from "@/components/onface/pos-venda/board/EstadosDoBoard";
import { lerFiltros, lerVista, type ParamsBrutos } from "@/components/onface/pos-venda/parametros";
import "@/components/onface/pos-venda/pos-venda.css";
import { lerBoard, lerEquipe } from "./fonte";

export const metadata = { title: "Pós-vendas" };
export const dynamic = "force-dynamic";

/**
 * Board do pós-venda. Server Component: o recorte inteiro vem de `searchParams`
 * (nada de estado local de filtro) e a leitura passa por `./fonte`.
 */
export default async function PosVendasPage({ searchParams }: { searchParams: Promise<ParamsBrutos> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const filtros = lerFiltros(params);
  const vista = lerVista(params);
  const [leitura, equipe] = await Promise.all([lerBoard(ctx.organizacaoId, filtros), lerEquipe(ctx.organizacaoId)]);

  return (
    <Pagina>
      {/* Uma linha, não um parágrafo. Toda tela do produto descreve a si mesma
          em meia linha junto do título ("Pipeline · Oportunidades comerciais,
          uma família por oportunidade"); só esta abria com dois períodos de
          texto explicativo antes do primeiro dado. */}
      <PaginaCabecalho titulo="Pós-vendas" descricao="Projetos de entrega: prazo, tarefas e quem está com a bola" />
      {leitura.ok ? (
        <BoardView board={leitura.dados} agora={new Date()} equipe={equipe.ok ? equipe.dados : []} vista={vista} />
      ) : (
        <div className="pv">
          <ErroDeLeitura detalhe={leitura.erro} />
        </div>
      )}
    </Pagina>
  );
}
