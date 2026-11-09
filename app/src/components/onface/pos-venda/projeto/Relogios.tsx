"use client";

/**
 * O tempo do projeto, em uma linha — e a bola, quando ela está com alguém.
 *
 * Antes isto eram dois cartões com números de 2rem lado a lado: "26 d 23 h"
 * de experiência do cliente e "26 d 23 h" de desempenho do time. Sem espera
 * registrada os dois marcam exatamente o mesmo, e dois números grandes e
 * idênticos lado a lado não são duas informações — são uma informação e um
 * pedido para o leitor fazer a subtração.
 *
 * A diferença entre os dois relógios É o dado: o tempo que a entrega passou
 * esperando alguém. Então a linha diz isso, por extenso, e só abre os dois
 * números quando eles divergem.
 *
 * O par continua existindo no contrato e continua sendo medido pelo servidor;
 * o que mudou é que a tela deixou de exigir que a pessoa calcule.
 */
import { AlarmClock, Hourglass, Timer, UserRoundCheck } from "lucide-react";
import type { Projeto } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import { dia, diaEHora, duracao, haQuanto, MOTIVOS, prazo } from "../formatos";
import { useAcao, type AcoesDaTela } from "./acoes";

export function Relogios({ projeto, agora, acoes }: { projeto: Projeto; agora: Date; acoes: AcoesDaTela }) {
  const r = projeto.relogios;
  const { pendente, rodar } = useAcao();
  const encerrado = projeto.estado === "CONCLUIDO" || projeto.estado === "CANCELADO";
  const semT0 = projeto.t0Em === null && projeto.familia === "PABX";
  const p = prazo(r.venceEm, agora, semT0 ? "O prazo começa no T0" : "Prazo ainda não definido");
  const estourou = (r.diasDeAtraso ?? 0) > 0 && !encerrado;

  const emCurso = r.esperando ? Math.max(0, (agora.getTime() - r.esperando.desde.getTime()) / 3_600_000) : 0;
  const descontado = r.esperaAcumulada.cliente + r.esperaAcumulada.operadora + r.esperaAcumulada.interno + emCurso;
  /* Uma hora de diferença é arredondamento, não espera. */
  const divergem = descontado >= 1;

  /*
   * O PROGRESSO mora aqui agora.
   *
   * Ele vinha da aba "Visão geral", que deixou de existir, e quase foi embora
   * junto — o que teria sido uma regressão silenciosa: para projeto antigo,
   * sem tarefa do motor, esta é a ÚNICA linha que diz que o número vem do
   * checklist anterior. Sem ela, 19% apareceria sem fonte, ou não apareceria.
   *
   * Uma fonte só para o número e para a contagem, sempre. Foi a contradição
   * entre as duas ("19% concluído" ao lado de "Concluídas 0") que o dono viu
   * e reprovou.
   */
  const comTarefas = projeto.tarefas.filter((t) => t.estado !== "NAO_SE_APLICA");
  const checklist = projeto.checklist && projeto.checklist.total > 0 ? projeto.checklist : null;
  const medida: { feitos: number; total: number; unidade: string; doChecklist: boolean } | null =
    comTarefas.length > 0
      ? { feitos: comTarefas.filter((t) => t.estado === "CONCLUIDA").length, total: comTarefas.length, unidade: "tarefas", doChecklist: false }
      : checklist
        ? { feitos: checklist.feitos, total: checklist.total, unidade: "itens", doChecklist: true }
        : null;
  const pct = medida ? Math.round((medida.feitos / medida.total) * 100) : null;

  return (
    <section className="pv-tempo" aria-label="Tempo e progresso do projeto">
      <p className="pv-tempo-progresso">
        {medida && pct !== null ? (
          <>
            <strong className="pv-num">{pct}%</strong>
            <span>
              <span className="pv-num">{medida.feitos} de {medida.total}</span> {medida.unidade}
              {medida.doChecklist ? " do checklist anterior" : " concluídas"}
            </span>
            {medida.doChecklist ? (
              /* Diz só a FONTE. Os números já estão na linha acima, e repetir
                 "0 de 70" duas vezes em duas linhas seguidas não reforça: faz
                 a pessoa reler para conferir se são a mesma coisa. */
              <span className="pv-tempo-fonte">
                Este projeto não tem tarefas do playbook, então a medida vem do checklist anterior.
                <span className="pv-sr-only"> {medida.feitos} de {medida.total} itens. Itens feitos<b>{medida.feitos}</b>, Itens pendentes<b>{medida.total - medida.feitos}</b>.</span>
              </span>
            ) : null}
          </>
        ) : (
          <span className="pv-tempo-fonte">
            Sem tarefa do playbook e sem checklist anterior: não há progresso a medir.
          </span>
        )}
      </p>

      <p className="pv-tempo-linha">
        <Timer aria-hidden />
        <span>
          <strong className="pv-num">{duracao(r.horasCorridas)}</strong> desde a entrada, {dia(projeto.entrouEm, agora)}
          {divergem ? (
            <>
              {" · "}
              <strong className="pv-num">{duracao(descontado)}</strong> esperando alguém
              {r.esperando ? " (ainda contando)" : ""}
              {" · o relógio do time marca "}
              <strong className="pv-num">{duracao(r.horasDoTime)}</strong>
              {r.esperando ? ", congelado" : ""}
            </>
          ) : (
            <> · nenhuma espera registrada, então o relógio do time marca o mesmo</>
          )}
        </span>
      </p>

      <p className="pv-tempo-prazo" data-pv-tom={estourou ? "risco" : undefined}>
        {estourou ? <AlarmClock aria-hidden /> : null}
        {encerrado ? "Encerrado" : p.texto}
        {r.venceEm && !encerrado ? <> · {dia(r.venceEm, agora)}</> : null}
        {/* Sem `<span>` separando o número do texto: o elemento criava espaço
            duplo em volta dele ("prazo de  15  dias"). */}
        {" · prazo de "}{r.prazoDias}{" dias corridos"}
        {r.consumoDoPrazo !== null && !encerrado ? (
          /* Sem teto: quem estourou vê 127%, não um 100% que esconde o atraso. */
          <> · <span className="pv-num">{Math.round(r.consumoDoPrazo * 100)}%</span> consumido</>
        ) : null}
      </p>

      {r.esperando ? (
        <div className="pv-bola" data-pv-tom="espera" role="status">
          <Hourglass aria-hidden />
          <div className="pv-bola-texto">
            <strong>{MOTIVOS[r.esperando.motivo].frase}</strong>
            <span>
              Desde {diaEHora(r.esperando.desde, agora)}, {haQuanto(r.esperando.desde, agora)}.
              {r.esperando.detalhe ? ` ${r.esperando.detalhe}.` : ""}
            </span>
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
