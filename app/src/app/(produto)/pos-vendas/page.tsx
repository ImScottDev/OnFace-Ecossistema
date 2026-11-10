import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { BoardView } from "@/components/onface/pos-venda/board/BoardView";
import { Mesa } from "@/components/onface/pos-venda/mesa/Mesa";
import { ErroDeLeitura } from "@/components/onface/pos-venda/board/EstadosDoBoard";
import { lerFiltros, lerVista, temFiltro, type ParamsBrutos } from "@/components/onface/pos-venda/parametros";
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
  // A mesa é a entrada; o arquivo (tabela com filtro e busca) só quando alguém pede um recorte.
  const ehArquivo = params.arquivo === "1" || temFiltro(filtros) || Boolean(filtros.familia);
  const leituraFiltros = ehArquivo ? filtros : { ...filtros, tipo: null };
  const [leitura, equipe] = await Promise.all([lerBoard(ctx.organizacaoId, leituraFiltros), lerEquipe(ctx.organizacaoId)]);

  return (
    <Pagina>
      <PaginaCabecalho
        titulo={ehArquivo ? "Todos os projetos" : "Pós-vendas"}
        descricao={ehArquivo
          ? "O arquivo completo: abertos e encerrados, com filtro e busca."
          : "O que precisa do time nas entregas de hoje. Os projetos nascem sozinhos quando uma venda é ganha."}
      />
      {!leitura.ok ? (
        <div className="pv">
          <ErroDeLeitura detalhe={leitura.erro} />
        </div>
      ) : ehArquivo ? (
        <BoardView board={leitura.dados} agora={new Date()} equipe={equipe.ok ? equipe.dados : []} vista={vista} />
      ) : (
        <Mesa cartoes={leitura.dados.cartoes} agora={new Date()} tipo={filtros.tipo} meu={params.quem === "eu"} usuarioId={ctx.userId} />
      )}
    </Pagina>
  );
}
