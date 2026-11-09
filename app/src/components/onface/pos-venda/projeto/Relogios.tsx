"use client";

/**
 * Os dois relógios do projeto, lado a lado.
 *
 * Um mede a EXPERIÊNCIA do cliente (corre direto), o outro mede a OPERAÇÃO
 * (pausa quando a bola está com o cliente ou a operadora). Nunca se mostra só
 * um: o par é a informação — a diferença entre eles é exatamente o tempo que
 * foi gasto esperando alguém.
 *
 * Quando há espera em curso, a faixa abaixo diz QUEM segura a bola e desde
 * quando, e oferece o encerramento. O relógio do time aparece congelado.
 */
import { Hourglass, Play, Timer, UserRoundCheck } from "lucide-react";
import type { MotivoDaEspera, Projeto } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import { dia, diaEHora, duracao, haQuanto, MOTIVOS, prazo } from "../formatos";
import { Barra } from "../pecas";
import { useAcao, type AcoesDaTela } from "./acoes";

const ORDEM: MotivoDaEspera[] = ["cliente", "operadora", "interno"];

export function Relogios({ projeto, agora, acoes }: { projeto: Projeto; agora: Date; acoes: AcoesDaTela }) {
  const r = projeto.relogios;
  const { pendente, rodar } = useAcao();
  const encerrado = projeto.estado === "CONCLUIDO" || projeto.estado === "CANCELADO";
  const semT0 = projeto.t0Em === null && projeto.familia === "PABX";
  const prazoTexto = prazo(r.venceEm, agora, semT0 ? "O prazo começa no T0" : "Prazo ainda não definido");
  const estourou = (r.diasDeAtraso ?? 0) > 0 && !encerrado;
  const horasDoPrazo = r.prazoDias * 24;
  // Divisão simples para a barra: não é conta de data, é formatação do que o backend já mediu.
  const consumoDoTime = horasDoPrazo > 0 ? r.horasDoTime / horasDoPrazo : null;
  const emCurso = r.esperando ? Math.max(0, (agora.getTime() - r.esperando.desde.getTime()) / 3_600_000) : 0;
  const descontado = r.esperaAcumulada.cliente + r.esperaAcumulada.operadora + r.esperaAcumulada.interno + emCurso;

  return (
    <section aria-label="Relógios do projeto" className="pv-secao">
      <div className="pv-relogios">
        <article className="pv-relogio">
          <header className="pv-relogio-topo">
            <div className="pv-relogio-nome">
              <strong>Experiência do cliente</strong>
              <span>Corre direto, sem descontar espera</span>
            </div>
            <Timer aria-hidden className="size-4 pv-suave" />
          </header>
          <div className="pv-relogio-valor">
            {duracao(r.horasCorridas)}
            <small>desde a entrada, {dia(projeto.entrouEm, agora)}</small>
          </div>
          {r.consumoDoPrazo !== null ? (
            <Barra fracao={r.consumoDoPrazo} tom="andamento" estouro={estourou} rotulo="Prazo consumido pelo relógio do cliente" />
          ) : null}
          <div className="pv-relogio-rodape">
            <span data-pv-tom={estourou ? "risco" : undefined}>
              {encerrado ? "Encerrado" : prazoTexto.texto}
              {r.venceEm && !encerrado ? <> · {dia(r.venceEm, agora)}</> : null}
            </span>
            <span>
              {/* Sem teto: quem estourou o prazo vê 127%, não um 100% que esconde o atraso. */}
              {r.consumoDoPrazo !== null ? <strong className="pv-num">{Math.round(r.consumoDoPrazo * 100)}% </strong> : null}
              de {r.prazoDias} dias corridos
            </span>
          </div>
        </article>

        <article className="pv-relogio" data-pausado={r.esperando ? "true" : undefined}>
          <header className="pv-relogio-topo">
            <div className="pv-relogio-nome">
              <strong>Desempenho do time</strong>
              <span>{r.esperando ? "Pausado enquanto espera" : "Pausa quando a bola não está com a gente"}</span>
            </div>
            {r.esperando ? <Hourglass aria-hidden className="size-4" /> : <Play aria-hidden className="size-4 pv-suave" />}
          </header>
          <div className="pv-relogio-valor">
            {duracao(r.horasDoTime)}
            <small>{r.esperando ? "congelado" : "trabalhado pelo time"}</small>
          </div>
          {consumoDoTime !== null ? (
            <Barra fracao={consumoDoTime} tom={r.esperando ? "espera" : "andamento"} rotulo="Prazo consumido pelo relógio do time" />
          ) : null}
          <div className="pv-relogio-rodape">
            <span>
              Descontado: <strong className="pv-num">{duracao(descontado)}</strong>
            </span>
            <span className="pv-num">
              cliente {duracao(r.esperaAcumulada.cliente)} · operadora {duracao(r.esperaAcumulada.operadora)} · interno {duracao(r.esperaAcumulada.interno)}
            </span>
          </div>
        </article>
      </div>

      {r.esperando ? (
        <div className="pv-bola" data-pv-tom="espera" role="status">
          <div className="pv-bola-texto">
            <strong>{MOTIVOS[r.esperando.motivo].frase}</strong>
            <span>
              Desde {diaEHora(r.esperando.desde, agora)}, {haQuanto(r.esperando.desde, agora)}.
              {r.esperando.detalhe ? ` ${r.esperando.detalhe}.` : ""}
            </span>
          </div>
          <div className="pv-bola-quem" aria-hidden>
            {ORDEM.map((m) => (
              <span key={m} data-ativo={r.esperando?.motivo === m || undefined}>
                {MOTIVOS[m].rotulo}
              </span>
            ))}
          </div>
          {projeto.permissoes.podeMarcarEspera ? (
            <Button
              variant="outline"
              size="sm"
              loading={pendente}
              onClick={() => rodar(() => acoes.encerrarEspera(), "Espera encerrada. O relógio do time voltou a correr.")}
            >
              <UserRoundCheck aria-hidden /> Encerrar espera
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
