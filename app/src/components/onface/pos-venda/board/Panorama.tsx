/**
 * O painel lateral do board: três leituras do que está na lista.
 *
 * Reflete o recorte ligado (os mesmos `cartoes` da lista), e diz isso no
 * rodapé, porque gráfico que ignora o filtro desmente a lista ao lado.
 */
import Link from "next/link";
import type { CartaoDoProjeto, FiltrosDoBoard } from "@/lib/pos-venda/contrato";
import { ESTADO_DO_PROJETO } from "../formatos";
import { hrefDoBoard, type Vista } from "../parametros";
import { Avatar, AvatarVazio } from "../pecas";
import { cargaPorResponsavel, contarPorEstado, entradasPorSemana, ORDEM_DE_ESTADO } from "./analise";
import { ColunasDeEntradas, RoscaDeEstados } from "./Graficos";

export function Panorama({ cartoes, filtros, vista, agora }: { cartoes: CartaoDoProjeto[]; filtros: FiltrosDoBoard; vista: Vista; agora: Date }) {
  const carga = cargaPorResponsavel(cartoes);
  const maior = Math.max(1, ...carga.map((c) => c.total));

  return (
    <aside className="pv-panorama" aria-label="Panorama dos projetos">
      <section className="pv-painel-g" aria-labelledby="pv-g-estado">
        <h2 id="pv-g-estado" className="pv-painel-g-titulo">Por estado</h2>
        <RoscaDeEstados dados={contarPorEstado(cartoes)} filtros={filtros} vista={vista} />
      </section>

      <section className="pv-painel-g" aria-labelledby="pv-g-carga">
        <h2 id="pv-g-carga" className="pv-painel-g-titulo">Carga por responsável <span>em aberto</span></h2>
        {carga.length > 0 ? (
          <ul className="pv-carga">
            {carga.map((r) => {
              const ativo = r.id === null ? filtros.recorte === "sem_responsavel" : filtros.responsavelId === r.id;
              const href = r.id === null
                ? hrefDoBoard(filtros, { recorte: ativo ? null : "sem_responsavel", responsavelId: null }, vista)
                : hrefDoBoard(filtros, { responsavelId: ativo ? null : r.id }, vista);
              return (
                <li key={r.id ?? "sem"}>
                  <Link href={href} className="pv-carga-linha" aria-current={ativo ? "true" : undefined} aria-label={`${r.nome}: ${r.total} em aberto`}>
                    {r.id === null ? <AvatarVazio tamanho="sm" rotulo="Sem responsável" /> : <Avatar quem={{ nome: r.nome, iniciais: r.iniciais }} tamanho="sm" titulo={false} decorativo />}
                    <span className="pv-carga-nome pv-truncar" data-vazio={r.id === null || undefined}>{r.nome}</span>
                    <span className="pv-carga-trilho" data-vazio={r.id === null || undefined} style={{ width: `${(r.total / maior) * 100}%` }} aria-hidden>
                      {ORDEM_DE_ESTADO.map((e) => (r.porEstado[e] ? <i key={e} data-estado={e} style={{ flexGrow: r.porEstado[e] }} title={`${ESTADO_DO_PROJETO[e].rotulo}: ${r.porEstado[e]}`} /> : null))}
                    </span>
                    <b className="pv-num">{r.total}</b>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="pv-g-nota">Nenhum projeto em aberto neste recorte.</p>
        )}
      </section>

      <section className="pv-painel-g" aria-labelledby="pv-g-entradas">
        <h2 id="pv-g-entradas" className="pv-painel-g-titulo">Entradas <span>janelas de 7 dias</span></h2>
        <ColunasDeEntradas dados={entradasPorSemana(cartoes, agora)} />
      </section>

      <p className="pv-panorama-pe">Os gráficos acompanham os filtros ligados.</p>
    </aside>
  );
}
