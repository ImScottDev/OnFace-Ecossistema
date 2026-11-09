/**
 * Os recortes da fila, como chips de filtro.
 *
 * Antes isto era uma fileira de seis cartões de KPI com número grande. O dono
 * reprovou ("parece dashboard gerado por IA"), e ele tem razão por um motivo
 * concreto: quatro dos seis números eram zero e cada um ocupava um sexto da
 * largura da tela para dizer que não havia nada. A contagem já É o indicador —
 * ela não precisa de cartão, de ícone em círculo nem de linha de apoio.
 *
 * A regra que separa os dois grupos: **indicador que não filtra é decoração**.
 * Em andamento, Atrasados, Aguardando cliente, Sem responsável e Concluídos no
 * mês recortam a lista, então viram chip clicável. Tempo mediano e NPS médio
 * não recortam nada — são leitura sobre os últimos 90 dias — então viram uma
 * frase, que é o que eles sempre foram.
 *
 * Clicar liga o recorte; clicar de novo limpa. Tudo pela URL, como o resto.
 */
import Link from "next/link";
import type { FiltrosDoBoard, IndicadoresDoBoard } from "@/lib/pos-venda/contrato";
import { hrefDoBoard, type Vista } from "../parametros";

type Alvo = Pick<FiltrosDoBoard, "estado" | "recorte">;

export function Indicadores({
  indicadores, filtros, vista, total,
}: {
  indicadores: IndicadoresDoBoard;
  filtros: FiltrosDoBoard;
  vista: Vista;
  /** Quantos projetos existem no universo atual (família e jornada já aplicadas). */
  total: number;
}) {
  const i = indicadores;

  /** `n: null` = recorte sem contagem no contrato. O chip existe, o número não. */
  const recortes: Array<{ chave: string; rotulo: string; n: number | null; alvo: Alvo; tom?: "risco" | "espera" }> = [
    { chave: "andamento", rotulo: "Em andamento", n: i.emAndamento, alvo: { estado: "EM_ANDAMENTO", recorte: null } },
    { chave: "atrasados", rotulo: "Atrasados", n: i.atrasados, alvo: { estado: null, recorte: "atrasados" }, tom: "risco" },
    { chave: "aguardando", rotulo: "Aguardando cliente", n: i.aguardandoCliente, alvo: { estado: null, recorte: "aguardando_cliente" }, tom: "espera" },
    { chave: "sem_dono", rotulo: "Sem responsável", n: null, alvo: { estado: null, recorte: "sem_responsavel" } },
    { chave: "concluidos", rotulo: "Concluídos no mês", n: i.concluidosNoMes, alvo: { estado: null, recorte: "concluidos_mes" } },
  ];

  const semRecorte = !filtros.estado && !filtros.recorte;

  return (
    <section className="pv-recortes" aria-label="Recortes da lista">
      <div className="pv-chips" role="group" aria-label="Filtrar por situação">
        <Link
          href={hrefDoBoard(filtros, { estado: null, recorte: null }, vista)}
          className="pv-chip"
          data-ativo={semRecorte || undefined}
          aria-current={semRecorte ? "true" : undefined}
          aria-label={`Todos os projetos: ${total}.${semRecorte ? "" : " Clique para limpar o recorte"}`}
        >
          Todos
          <span className="pv-chip-n pv-num">{total}</span>
        </Link>

        {recortes.map((r) => {
          const ativo = filtros.estado === r.alvo.estado && filtros.recorte === r.alvo.recorte;
          return (
            <Link
              key={r.chave}
              href={hrefDoBoard(filtros, ativo ? { estado: null, recorte: null } : r.alvo, vista)}
              className="pv-chip"
              data-ativo={ativo || undefined}
              /* O número só ganha tinta de alerta quando há o que alertar:
                 "Atrasados 0" em vermelho ensina o time a ignorar vermelho. */
              data-pv-tom={r.n !== null && r.n > 0 ? r.tom : undefined}
              aria-current={ativo ? "true" : undefined}
              aria-label={`${r.rotulo}${r.n !== null ? `: ${r.n}` : ""}. ${ativo ? "Filtro ligado, clique para limpar" : "Clique para filtrar"}`}
            >
              {r.rotulo}
              {r.n !== null ? <span className="pv-chip-n pv-num">{r.n}</span> : null}
            </Link>
          );
        })}
      </div>

      <Leitura mediano={i.tempoMedianoDias} nps={i.npsMedio} />
    </section>
  );
}

/**
 * Tempo mediano e NPS em uma frase.
 *
 * Os dois falam dos últimos 90 dias e nenhum recorta a lista. Sem amostra, a
 * frase diz que não há amostra — não mostra zero, que seria mentira: "0 dias
 * até concluir" e "NPS 0" são afirmações fortes e falsas.
 */
function Leitura({ mediano, nps }: { mediano: number | null; nps: number | null }) {
  const dias = mediano === null ? null : Math.round(mediano);
  const tempo =
    dias === null
      ? "Ainda não há entregas suficientes nos últimos 90 dias para calcular o tempo até concluir"
      : `Mediana de ${dias} ${dias === 1 ? "dia" : "dias"} até concluir, nos últimos 90 dias`;
  const pesquisa = nps === null ? "nenhuma resposta de NPS na janela" : `NPS médio ${nps.toFixed(1).replace(".", ",")} no Callface AI`;

  return <p className="pv-leitura">{tempo} · {pesquisa}.</p>;
}
