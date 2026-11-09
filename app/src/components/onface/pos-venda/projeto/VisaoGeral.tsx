"use client";

import { useState } from "react";
import { AlarmClock, ArrowRight, CornerDownRight, History } from "lucide-react";
import type { Projeto, TarefaDoProjeto } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import { dia, haQuanto, percentual, prazo, type Tom } from "../formatos";
import { Avatar } from "../pecas";
import { useAcao, type AcoesDaTela } from "./acoes";
import { EventoLinha } from "./LinhaDoTempo";

const FATIAS: Array<{ estado: TarefaDoProjeto["estado"]; rotulo: string; tom: Tom }> = [
  { estado: "CONCLUIDA", rotulo: "Concluídas", tom: "ok" },
  { estado: "EM_ANDAMENTO", rotulo: "Em andamento", tom: "andamento" },
  { estado: "AGUARDANDO", rotulo: "Aguardando", tom: "espera" },
  { estado: "A_FAZER", rotulo: "A fazer", tom: "neutro" },
];
const R = 40;
const CIRC = 2 * Math.PI * R;

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

  // Início de cada fatia da rosca: soma do comprimento das anteriores.
  const comprimentos = contagem.map((c) => (base > 0 ? (c.n / base) * CIRC : 0));
  const inicios = comprimentos.map((_, i) => comprimentos.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className="pv-painel">
      {projeto.herdadoDe ? (
        <div className="pv-aviso" data-pv-tom="validacao">
          <History aria-hidden />
          <span>
            Este projeto herdou {projeto.herdadoDe.passosHerdados.length} {projeto.herdadoDe.passosHerdados.length === 1 ? "passo" : "passos"} de uma jornada anterior
            {projeto.herdadoDe.concluidoEm ? `, concluída em ${dia(projeto.herdadoDe.concluidoEm, agora)}` : ""}. Eles não precisam ser refeitos.
          </span>
        </div>
      ) : null}

      <div className="pv-visao">
        <section className="pv-bloco" aria-label="Distribuição das tarefas">
          <h2 className="pv-secao-titulo">Progresso</h2>
          <div className="pv-rosca-linha">
            <div className="pv-rosca" role="img" aria-label={fonte === "vazia" ? "Sem tarefas neste projeto" : `${percentual(fracao)}% concluído, ${contagem.map((c) => `${c.n} ${c.rotulo.toLowerCase()}`).join(", ")}`}>
              <svg viewBox="0 0 100 100" aria-hidden>
                <circle className="pv-rosca-trilho" cx="50" cy="50" r={R} />
                {contagem.map((c, i) =>
                  c.n > 0 ? (
                    <circle key={c.estado} className="pv-rosca-fatia" data-pv-tom={c.tom} cx="50" cy="50" r={R}
                      strokeDasharray={`${comprimentos[i]} ${CIRC - comprimentos[i]}`} strokeDashoffset={-inicios[i]} />
                  ) : null,
                )}
              </svg>
              <div className="pv-rosca-centro">
                <strong>{fonte === "vazia" ? "—" : `${percentual(fracao)}%`}</strong>
                <span>{fonte === "vazia" ? "sem tarefas" : "concluído"}</span>
              </div>
            </div>
            {contagem.length > 0 ? (
              <ul className="pv-legenda">
                {contagem.map((c) => (
                  <li key={c.estado} data-pv-tom={c.tom}><i aria-hidden />{c.rotulo}<b>{c.n}</b></li>
                ))}
              </ul>
            ) : null}
          </div>
          {fonte === "checklist" && checklist ? (
            <p className="pv-secao-nota">
              Este projeto não tem tarefas do playbook. O progresso mede o checklist anterior: {checklist.feitos} de {checklist.total} {checklist.total === 1 ? "item" : "itens"}.
            </p>
          ) : null}
          {fonte === "vazia" ? (
            <p className="pv-secao-nota">Este projeto não tem tarefas nem checklist, então não há progresso a medir.</p>
          ) : null}
        </section>

        <section className="pv-bloco" aria-label="Próximos passos">
          <h2 className="pv-secao-titulo">Próximos passos</h2>
          {proximas.length > 0 ? (
            <ul className="pv-pessoas">
              {proximas.map((t) => {
                const p = prazo(t.venceEm, agora);
                return (
                  <li key={t.id} className="pv-pessoa">
                    <span className="pv-evento-ponto" data-pv-tom={t.atrasada ? "risco" : "neutro"} aria-hidden>
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
            <p className="pv-secao-nota">Todas as tarefas aplicáveis foram concluídas.</p>
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
