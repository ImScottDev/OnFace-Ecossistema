"use client";

/**
 * Visão geral do projeto.
 *
 * "A visão geral está totalmente desorganizada" — e estava, por duas razões.
 *
 * A primeira é a ORDEM. Ela abria pelo progresso, que é leitura, e deixava os
 * próximos passos em segundo. Quem abre um projeto de entrega quer saber o que
 * fazer agora; o quanto já andou vem depois. A ordem passa a ser a da decisão:
 * o que fazer, onde estamos, o que aconteceu, o que ficou escrito.
 *
 * A segunda é a FORMA. Eram quatro cartões numa grade, dentro de uma aba,
 * dentro da página: caixa dentro de caixa dentro de caixa. Agora são seções
 * separadas por fio e espaço. E o anel de progresso virou barra — anel é um
 * dos recursos que o piso de qualidade recusa por nome, porque gasta a área de
 * um gráfico para dizer um número que cabe em duas palavras.
 */
import { useState } from "react";
import { AlarmClock, ArrowRight, CornerDownRight, History } from "lucide-react";
import type { Projeto, TarefaDoProjeto } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import { dia, haQuanto, percentual, prazo, type Tom } from "../formatos";
import { Avatar, Barra } from "../pecas";
import { useAcao, type AcoesDaTela } from "./acoes";
import { EventoLinha } from "./LinhaDoTempo";

const FATIAS: Array<{ estado: TarefaDoProjeto["estado"]; rotulo: string; tom: Tom }> = [
  { estado: "CONCLUIDA", rotulo: "Concluídas", tom: "ok" },
  { estado: "EM_ANDAMENTO", rotulo: "Em andamento", tom: "andamento" },
  { estado: "AGUARDANDO", rotulo: "Aguardando", tom: "espera" },
  { estado: "A_FAZER", rotulo: "A fazer", tom: "neutro" },
];

export function VisaoGeral({ projeto, agora, acoes, aoVerTudo }: { projeto: Projeto; agora: Date; acoes: AcoesDaTela; aoVerTudo: () => void }) {
  const aplicaveis = projeto.tarefas.filter((t) => t.estado !== "NAO_SE_APLICA");
  const total = aplicaveis.length;
  const pendentes = aplicaveis.filter((t) => t.estado !== "CONCLUIDA");
  const proximas = pendentes.slice(0, 3);
  const recentes = projeto.timeline.slice(0, 4);

  // Uma só fonte para a rosca, a legenda e o percentual: nunca um número de cada lugar.
  //  - com tarefa do motor: as tarefas;
  //  - sem tarefa, mas com checklist legado (`fulfillment_itens`): o checklist, que é de onde o progresso já vinha;
  //  - sem nenhum dos dois: não há o que medir, e a tela diz isso em vez de mostrar 0% ou 19% soltos.
  const checklist = projeto.checklist && projeto.checklist.total > 0 ? projeto.checklist : null;
  const fonte: "tarefas" | "checklist" | "vazia" = total > 0 ? "tarefas" : checklist ? "checklist" : "vazia";
  const contagem: Array<{ estado: string; rotulo: string; tom: Tom; n: number }> =
    fonte === "tarefas"
      ? FATIAS.map((f) => ({ ...f, n: aplicaveis.filter((t) => t.estado === f.estado).length }))
      : fonte === "checklist" && checklist
        ? [
            { estado: "ITEM_FEITO", rotulo: "Itens feitos", tom: "ok", n: checklist.feitos },
            { estado: "ITEM_PENDENTE", rotulo: "Itens pendentes", tom: "neutro", n: checklist.total - checklist.feitos },
          ]
        : [];
  const base = contagem.reduce((a, c) => a + c.n, 0);
  const fracao = fonte === "tarefas" ? projeto.progresso : checklist ? checklist.feitos / checklist.total : 0;
  const feitos = fonte === "tarefas" ? aplicaveis.filter((t) => t.estado === "CONCLUIDA").length : (checklist?.feitos ?? 0);

  return (
    <div className="pv-painel">
      {projeto.herdadoDe && projeto.herdadoDe.passosHerdados.length > 0 ? (
        <div className="pv-aviso" data-pv-tom="validacao">
          <History aria-hidden />
          <span>
            Este projeto herdou {projeto.herdadoDe.passosHerdados.length} {projeto.herdadoDe.passosHerdados.length === 1 ? "passo" : "passos"} de uma jornada anterior
            {projeto.herdadoDe.concluidoEm ? `, concluída em ${dia(projeto.herdadoDe.concluidoEm, agora)}` : ""}. Eles não precisam ser refeitos.
          </span>
        </div>
      ) : null}

      <div className="pv-visao">
        {/* O que fazer agora vem PRIMEIRO. */}
        <section className="pv-bloco" aria-label="Próximos passos">
          <h2 className="pv-secao-titulo">Próximos passos</h2>
          {proximas.length > 0 ? (
            <ul className="pv-pessoas">
              {proximas.map((t) => {
                const p = prazo(t.venceEm, agora);
                return (
                  <li key={t.id} className="pv-pessoa">
                    {/* Ícone nu, não dentro de um círculo colorido: a lista é
                        de três itens e o ícone diz "atrasada" ou "a seguir",
                        não precisa de medalha. */}
                    <span className="pv-passo-icone" data-pv-tom={t.atrasada ? "risco" : "neutro"} aria-hidden>
                      {t.atrasada ? <AlarmClock /> : <CornerDownRight />}
                    </span>
                    <span className="pv-pessoa-texto">
                      <span className="pv-pessoa-nome">{t.titulo}</span>
                      <span className="pv-pessoa-sub" data-pv-tom={t.atrasada ? "risco" : undefined}>
                        {p.texto}{t.venceEm ? ` · ${dia(t.venceEm, agora)}` : ""}
                      </span>
                    </span>
                    {t.responsavel ? <Avatar quem={t.responsavel} tamanho="sm" /> : null}
                  </li>
                );
              })}
            </ul>
          ) : total === 0 ? (
            <p className="pv-secao-nota">
              {fonte === "checklist" ? "Este projeto não tem tarefas, só o checklist anterior. Não há próximo passo para mostrar." : "Este projeto ainda não tem tarefas."}
            </p>
          ) : (
            <p className="pv-secao-nota">{total === 0 ? "Nenhuma tarefa para fazer ainda." : "Todas as tarefas aplicáveis foram concluídas."}</p>
          )}
        </section>

        {/* Onde estamos. Barra e contagem saem da MESMA fonte: quando não há
            tarefa do playbook, o progresso vem do checklist anterior e a tela
            diz isso. Antes aparecia "0 de 0 tarefas" ao lado de uma barra em
            100% — o tipo de contradição que faz o time parar de confiar no
            número. */}
        <section className="pv-bloco" aria-label="Progresso do projeto">
          <h2 className="pv-secao-titulo">Progresso</h2>
          {fonte === "vazia" ? (
            <p className="pv-secao-nota">
              Este projeto ainda não tem tarefas no fluxo novo e não tem checklist anterior, então não há progresso a medir.
              As tarefas aparecem aqui quando o playbook da família for aplicado.
            </p>
          ) : (
            <>
              <p className="pv-progresso-leitura">
                <strong className="pv-num">{feitos}/{base}</strong>
                <span>{fonte === "checklist" ? "itens do checklist anterior" : "tarefas concluídas"}</span>
                <span className="pv-num pv-progresso-pct">{percentual(fracao)}%</span>
              </p>
              <Barra
                fracao={fracao}
                tom={fracao >= 1 ? "ok" : "andamento"}
                rotulo={`${percentual(fracao)}% concluído`}
              />
              <ul className="pv-legenda">
                {contagem.map((c) => (
                  <li key={c.estado} data-pv-tom={c.tom}><i aria-hidden />{c.rotulo}<b className="pv-num">{c.n}</b></li>
                ))}
              </ul>
              {fonte === "checklist" && checklist ? (
                <p className="pv-secao-nota">
                  Este projeto não tem tarefas do playbook, então o progresso mede o checklist anterior.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="pv-bloco" data-largo="true" aria-label="Atividade recente">
          <div className="pv-secao-cab">
            <h2 className="pv-secao-titulo">Atividade recente</h2>
            <Button variant="subtle" size="sm" onClick={aoVerTudo}>Ver linha do tempo <ArrowRight aria-hidden /></Button>
          </div>
          {recentes.length > 0 ? (
            <ol className="pv-linha">{recentes.map((e) => <EventoLinha key={e.id} e={e} />)}</ol>
          ) : (
            <p className="pv-secao-nota">Nada aconteceu ainda neste projeto.</p>
          )}
        </section>

        <Notas projeto={projeto} agora={agora} acoes={acoes} />
      </div>
    </div>
  );
}

function Notas({ projeto, agora, acoes }: { projeto: Projeto; agora: Date; acoes: AcoesDaTela }) {
  const [texto, setTexto] = useState("");
  const { pendente, rodar } = useAcao();
  return (
    <section className="pv-bloco" data-largo="true" aria-label="Notas">
      <h2 className="pv-secao-titulo">Notas</h2>
      <div className="pv-nota-nova">
        <label className="pv-sr-only" htmlFor="pv-nota">Nova nota</label>
        <textarea id="pv-nota" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva algo que o próximo a abrir este projeto precisa saber" maxLength={4000} />
        <Button
          size="sm"
          variant="outline"
          disabled={!texto.trim()}
          loading={pendente}
          onClick={() => rodar(() => acoes.adicionarNota(texto), "Nota salva.", (ok) => ok && setTexto(""))}
        >
          Salvar nota
        </Button>
      </div>
      {projeto.notas.length > 0 ? (
        <ul className="pv-notas">
          {projeto.notas.map((n) => (
            <li key={n.id} className="pv-nota">
              <span className="pv-nota-cab"><b>{n.por ?? "Alguém do time"}</b> · {haQuanto(n.em, agora)}</span>
              <p>{n.texto}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pv-secao-nota">Nenhuma nota ainda. As notas também aparecem no Cliente 360.</p>
      )}
    </section>
  );
}
