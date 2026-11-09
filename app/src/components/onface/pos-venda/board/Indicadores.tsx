/**
 * Faixa de indicadores do board.
 *
 * Uma faixa só, dividida em seis, e não seis cartões: o fundo tinge pelo
 * estado que o número descreve, mas só quando há o que olhar. Zero apaga o
 * tom: um "0 atrasados" em vermelho ensina o time a ignorar o vermelho.
 *
 * Cada número é um recorte: clicar liga o filtro, clicar de novo desliga. São
 * links porque o recorte vive na URL.
 *
 * Ausência diz o motivo. "Tempo mediano" sem amostra mostra "—" e a razão,
 * nunca um 0 dias que pareceria fato.
 */
import Link from "next/link";
import { Activity, AlarmClock, CheckCheck, Gauge, Hourglass, Smile } from "lucide-react";
import type { FiltrosDoBoard, IndicadoresDoBoard } from "@/lib/pos-venda/contrato";
import type { Tom } from "../formatos";
import { hrefDoBoard, type Vista } from "../parametros";

type Alvo = Pick<FiltrosDoBoard, "estado" | "recorte" | "familia">;

export function Indicadores({ indicadores, filtros, vista }: { indicadores: IndicadoresDoBoard; filtros: FiltrosDoBoard; vista: Vista }) {
  const i = indicadores;
  const sem = (n: number, tom: Tom): Tom => (n > 0 ? tom : "neutro");

  const itens: Array<{
    chave: string;
    rotulo: string;
    icone: typeof Activity;
    tom: Tom;
    valor: string | null;
    unidade?: string;
    detalhe: string;
    alvo: Alvo;
    limpa: Partial<FiltrosDoBoard>;
  }> = [
    { chave: "andamento", rotulo: "Em andamento", icone: Activity, tom: sem(i.emAndamento, "andamento"), valor: String(i.emAndamento), detalhe: i.emAndamento > 0 ? "com o time trabalhando" : "ninguém executando agora", alvo: { estado: "EM_ANDAMENTO", recorte: null, familia: filtros.familia }, limpa: { estado: null, recorte: null } },
    { chave: "aguardando", rotulo: "Aguardando cliente", icone: Hourglass, tom: sem(i.aguardandoCliente, "espera"), valor: String(i.aguardandoCliente), detalhe: i.aguardandoCliente > 0 ? "relógio do time pausado" : "nenhum projeto parado no cliente", alvo: { estado: null, recorte: "aguardando_cliente", familia: filtros.familia }, limpa: { estado: null, recorte: null } },
    { chave: "atrasados", rotulo: "Atrasados", icone: AlarmClock, tom: sem(i.atrasados, "risco"), valor: String(i.atrasados), detalhe: i.atrasados > 0 ? "passaram do prazo contratado" : "nenhum projeto fora do prazo", alvo: { estado: null, recorte: "atrasados", familia: filtros.familia }, limpa: { estado: null, recorte: null } },
    { chave: "concluidos", rotulo: "Concluídos no mês", icone: CheckCheck, tom: sem(i.concluidosNoMes, "ok"), valor: String(i.concluidosNoMes), detalhe: i.concluidosNoMes > 0 ? "entregues neste mês" : "nenhuma entrega neste mês", alvo: { estado: null, recorte: "concluidos_mes", familia: filtros.familia }, limpa: { estado: null, recorte: null } },
    { chave: "mediano", rotulo: "Tempo mediano", icone: Gauge, tom: "neutro", valor: i.tempoMedianoDias === null ? null : String(Math.round(i.tempoMedianoDias)), unidade: "dias", detalhe: i.tempoMedianoDias === null ? "poucas entregas nos últimos 90 dias" : "até concluir, últimos 90 dias", alvo: { estado: "CONCLUIDO", recorte: null, familia: filtros.familia }, limpa: { estado: null, recorte: null } },
    { chave: "nps", rotulo: "NPS médio", icone: Smile, tom: i.npsMedio === null ? "neutro" : "validacao", valor: i.npsMedio === null ? null : i.npsMedio.toFixed(1).replace(".", ","), detalhe: i.npsMedio === null ? "sem resposta nos últimos 90 dias" : "Callface AI, últimos 90 dias", alvo: { estado: "CONCLUIDO", recorte: null, familia: "CALLFACE_AI" }, limpa: { estado: null, recorte: null, familia: null } },
  ];

  return (
    <section className="pv-faixa" aria-label="Indicadores do pós-venda">
      {itens.map((it) => {
        const ativo = filtros.estado === it.alvo.estado && filtros.recorte === it.alvo.recorte && filtros.familia === it.alvo.familia;
        const Icone = it.icone;
        return (
          <Link
            key={it.chave}
            href={ativo ? hrefDoBoard(filtros, it.limpa, vista) : hrefDoBoard(filtros, it.alvo, vista)}
            className="pv-kpi"
            data-pv-tom={it.tom}
            data-ativo={ativo || undefined}
            aria-current={ativo ? "true" : undefined}
            aria-label={`${it.rotulo}: ${it.valor ?? "sem dado"}. ${ativo ? "Filtro ligado, clique para limpar" : "Clique para filtrar"}`}
          >
            <span className="pv-kpi-topo">
              <Icone aria-hidden />
              {it.rotulo}
            </span>
            <span className="pv-kpi-valor" data-vazio={it.valor === null || undefined}>
              {it.valor ?? <span className="pv-kpi-vazio">—</span>}
              {it.valor !== null && it.unidade ? <span className="pv-kpi-unidade">{it.unidade}</span> : null}
            </span>
            <span className="pv-kpi-detalhe">{it.detalhe}</span>
          </Link>
        );
      })}
    </section>
  );
}
