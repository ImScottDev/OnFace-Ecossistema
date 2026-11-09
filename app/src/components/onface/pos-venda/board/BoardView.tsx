/**
 * O miolo do board: indicadores, abas, filtros e a grade.
 *
 * Server Component. Recebe o `Board` já lido e `agora` do servidor — as
 * contas de "vence em N dias" saem dele, então o HTML do servidor e o do
 * navegador são idênticos.
 */
import type { Board, Usuario } from "@/lib/pos-venda/contrato";
import { hrefDoBoard, temFiltro } from "../parametros";
import { AbasDeFamilia } from "./AbasDeFamilia";
import { BarraDeFiltros } from "./BarraDeFiltros";
import { CartaoDoProjetoView } from "./CartaoDoProjeto";
import { BoardSemProjetos, BoardSemResultado } from "./EstadosDoBoard";
import { Indicadores } from "./Indicadores";

export function BoardView({ board, agora, equipe }: { board: Board; agora: Date; equipe: Usuario[] }) {
  const { filtros } = board;
  const totalGeral = board.porFamilia.CALLFACE_AI + board.porFamilia.PABX + board.porFamilia.WHITE_LABEL;
  const nadaExiste = totalGeral === 0 && !temFiltro(filtros) && !filtros.familia;

  return (
    <div className="pv">
      <Indicadores indicadores={board.indicadores} filtros={filtros} />
      <AbasDeFamilia porFamilia={board.porFamilia} filtros={filtros} />
      <BarraDeFiltros filtros={filtros} responsaveis={equipe} total={board.total} />

      {board.cartoes.length > 0 ? (
        <div className="pv-grade">
          {board.cartoes.map((c) => (
            <CartaoDoProjetoView key={c.id} c={c} agora={agora} />
          ))}
        </div>
      ) : nadaExiste ? (
        <BoardSemProjetos />
      ) : (
        <BoardSemResultado limpar={hrefDoBoard({ ...filtros, estado: null, recorte: null, responsavelId: null, busca: null })} busca={filtros.busca} />
      )}
    </div>
  );
}
