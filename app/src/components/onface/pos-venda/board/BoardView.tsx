/**
 * O miolo do board.
 *
 * Server Component. Recebe o `Board` já lido e `agora` do servidor — as
 * contas de "vence em N dias" saem dele, então o HTML do servidor e o do
 * navegador são idênticos.
 *
 * A pergunta que a tela responde é "o que eu faço agora?", por isso a lista
 * não é uma grade única: ela vem agrupada por urgência (pedem ação, falta o
 * aceite, esperando alguém, em andamento, ainda não começaram) e os
 * encerrados ficam recolhidos no fim.
 */
import { ChevronRight } from "lucide-react";
import type { Board, Usuario } from "@/lib/pos-venda/contrato";
import { hrefDoBoard, temFiltro, VISTA_PADRAO, type Vista } from "../parametros";
import { AbasDeFamilia } from "./AbasDeFamilia";
import { GRUPOS, grupoDe, ordenar } from "./analise";
import { BarraDeFiltros } from "./BarraDeFiltros";
import { BoardSemProjetos, BoardSemResultado } from "./EstadosDoBoard";
import { GrupoDeProjetos } from "./GrupoDeProjetos";
import { Indicadores } from "./Indicadores";
import { Panorama } from "./Panorama";

export function BoardView({ board, agora, equipe, vista = VISTA_PADRAO }: { board: Board; agora: Date; equipe: Usuario[]; vista?: Vista }) {
  const { filtros } = board;
  const universo = filtros.familia ? board.porFamilia[filtros.familia] : board.porFamilia.CALLFACE_AI + board.porFamilia.PABX + board.porFamilia.WHITE_LABEL;
  const totalGeral = board.porFamilia.CALLFACE_AI + board.porFamilia.PABX + board.porFamilia.WHITE_LABEL;
  const nadaExiste = totalGeral === 0 && !temFiltro(filtros) && !filtros.familia && !filtros.tipo;

  // Quem vê tudo sem recorte de estado quer a fila; quem pediu "concluídos" quer ver os concluídos abertos.
  const pediuEncerrados = filtros.estado === "CONCLUIDO" || filtros.estado === "CANCELADO" || filtros.recorte === "concluidos_mes";

  const repetidos = new Map<string, number>();
  for (const c of board.cartoes) repetidos.set(c.empresa.nome, (repetidos.get(c.empresa.nome) ?? 0) + 1);

  const porGrupo = new Map(GRUPOS.map((g) => [g.id, [] as typeof board.cartoes]));
  for (const c of board.cartoes) porGrupo.get(grupoDe(c))!.push(c);

  return (
    <div className="pv">
      <AbasDeFamilia porFamilia={board.porFamilia} filtros={filtros} vista={vista} />
      <BarraDeFiltros filtros={filtros} vista={vista} responsaveis={equipe} total={board.total} universo={universo} />
      <Indicadores indicadores={board.indicadores} filtros={filtros} vista={vista} total={universo} />

      {board.cartoes.length > 0 ? (
        <>
          <div className="pv-fila">
            {GRUPOS.map((g) => {
              const lista = ordenar(porGrupo.get(g.id) ?? [], vista.ordem);
              if (lista.length === 0) return null;
              return <GrupoDeProjetos key={g.id} grupo={g} cartoes={lista} visao={vista.visao} agora={agora} repetidos={repetidos} aberto={g.id !== "encerrados" || pediuEncerrados} />;
            })}
          </div>

          {/* O panorama sai de perto da fila.
              Gráfico ao lado da lista de trabalho disputa o olho com o que
              precisa de ação — e a pergunta desta tela é "o que eu faço
              agora?", não "como estamos distribuídos?". Continua aqui, abaixo
              e recolhido, porque a leitura é útil; só não é a primeira. */}
          <details className="pv-panorama-caixa">
            <summary className="pv-panorama-cab">
              <ChevronRight className="pv-grupo-seta" aria-hidden />
              <span>Panorama</span>
              <span className="pv-panorama-nota">Distribuição, carga do time e entradas — seguem os filtros ligados</span>
            </summary>
            <Panorama cartoes={board.cartoes} filtros={filtros} vista={vista} agora={agora} />
          </details>
        </>
      ) : nadaExiste ? (
        <BoardSemProjetos />
      ) : (
        <BoardSemResultado limpar={hrefDoBoard({ ...filtros, tipo: null, estado: null, recorte: null, responsavelId: null, busca: null }, {}, vista)} busca={filtros.busca} />
      )}
    </div>
  );
}
