"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCheck, ListChecks, Phone, Rocket, Video } from "lucide-react";
import type { Agenda, Atalho, Atencao, ItemAgenda, Severidade } from "@/lib/inicio/tipos";
import { abrirNexo } from "@/lib/nexo/cliente";
import { TopoDeCartao, Vazio, inteiro } from "./compartilhado";

const ROTULO_SEVERIDADE: Record<Severidade, string> = { critico: "Crítico", alto: "Alto", moderado: "Moderado" };

/* ═══ Precisa de você agora ═══════════════════════════════════════════════ */

/**
 * Fila priorizada. Cada linha inteira é o clique: abre o registro (lead,
 * proposta, conversa) ou a lista que resolve o sinal. A severidade é forma e
 * texto, nunca só cor: o marcador muda de forma, e o rótulo existe para leitor
 * de tela.
 */
export function PrecisaDeVoce({ a }: { a: Atencao }) {
  const sub = a.escopo === "pessoal" ? "Do mais urgente ao menos" : "Do mais urgente ao menos";
  const resumo = (["critico", "alto", "moderado"] as const)
    .filter((s) => a.porSeveridade[s] > 0)
    .map((s) => `${inteiro(a.porSeveridade[s])} ${s === "critico" ? (a.porSeveridade[s] === 1 ? "crítico" : "críticos") : s === "alto" ? (a.porSeveridade[s] === 1 ? "alto" : "altos") : (a.porSeveridade[s] === 1 ? "moderado" : "moderados")}`);

  return (
    <section className="ini-cartao ini-atencao" aria-labelledby="ini-h-atencao">
      <TopoDeCartao id="ini-h-atencao" titulo="Precisa de você agora" />
      {a.itens.length === 0 ? (
        <Vazio icone={<CheckCheck />} titulo="Nada pedindo você agora" texto="Nenhum sinal de atenção aberto para o seu escopo." />
      ) : (
        <>
          <p className="ini-sub">{resumo.length ? `${resumo.join(" · ")}. ` : ""}{sub}</p>
          <ul className="ini-fila-lista">
            {a.itens.map((i) => (
              <li key={i.id}>
                <Link href={i.href} className="ini-item" data-severidade={i.severidade}>
                  <span className="ini-marca" aria-hidden="true" />
                  <span className="ini-item-texto">
                    <span className="sr-only">{ROTULO_SEVERIDADE[i.severidade]}. </span>
                    <strong>{i.titulo}</strong>
                    <small><span className="ini-item-tipo">{i.tipo}</span>{i.detalhe}</small>
                  </span>
                  <span className="ini-item-lado">
                    {i.peso ? <span className="ini-item-peso">{i.peso}</span> : null}
                    <span className="ini-item-acao">{i.acao}<ArrowRight aria-hidden="true" /></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {a.total > a.itens.length ? (
            <p className="ini-rodape-nota">{inteiro(a.total - a.itens.length)} {a.total - a.itens.length === 1 ? "item a mais" : "itens a mais"} {a.escopo === "pessoal" ? "nas suas listas" : "de prioridade menor, nas telas de cada área"}.</p>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ═══ Agenda do dia ═══════════════════════════════════════════════════════ */

const ICONE_AGENDA: Record<ItemAgenda["tipo"], React.ComponentType<{ "aria-hidden"?: boolean }>> = {
  reuniao: Video, ligacao: Phone, tarefa: ListChecks, onboarding: Rocket,
};

export function AgendaDoDia({ a }: { a: Agenda }) {
  const resumo = [
    a.reunioes > 0 ? `${inteiro(a.reunioes)} ${a.reunioes === 1 ? "reunião" : "reuniões"}` : null,
    a.tarefasHoje > 0 ? `${inteiro(a.tarefasHoje)} ${a.tarefasHoje === 1 ? "tarefa" : "tarefas"} hoje` : null,
  ].filter(Boolean).join(" · ");
  return (
    <section className="ini-cartao ini-agenda" aria-labelledby="ini-h-agenda">
      <TopoDeCartao id="ini-h-agenda" titulo="Agenda de hoje" direita={resumo ? <span className="ini-topo-nota">{resumo}</span> : null} />
      {a.itens.length === 0 ? (
        <Vazio icone={<CalendarDays />} titulo="Nada marcado para hoje"
          texto={a.tarefasHoje > 0 ? `${inteiro(a.tarefasHoje)} tarefas vencem hoje, sem horário.` : "Sem reunião nem tarefa com vencimento hoje."}
          href="/calendario" acao="Abrir calendário" />
      ) : (
        <ol className="ini-agenda-lista">
          {a.itens.map((i) => {
            const Icone = ICONE_AGENDA[i.tipo];
            const semDesfecho = i.tipo === "reuniao" && i.grupo === "atrasada";
            return (
              <li key={i.id}>
                <Link href={i.href} className="ini-agenda-item" data-grupo={i.grupo}>
                  <time className="ini-agenda-hora">{i.hora}</time>
                  <span className="ini-agenda-texto">
                    <strong>{i.titulo}</strong>
                    <small><Icone aria-hidden />{i.detalhe}</small>
                  </span>
                  {i.grupo === "agora" ? <span className="ini-chip" data-tom="acento">Agora</span> : null}
                  {semDesfecho ? <span className="ini-chip" data-tom="acento">Registrar desfecho</span> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <footer className="ini-agenda-rodape">
        {a.atrasadas > 0 ? (
          <Link href="/tarefas" className="ini-link" data-tom="risco">
            {inteiro(a.atrasadas)} {a.atrasadas === 1 ? "tarefa em atraso" : "tarefas em atraso"}<ArrowRight aria-hidden="true" />
          </Link>
        ) : <span className="ini-rodape-nota">Nenhuma tarefa em atraso</span>}
        <Link href="/calendario" className="ini-link">Calendário<ArrowRight aria-hidden="true" /></Link>
      </footer>
    </section>
  );
}

/* ═══ Atalhos e NEXO ══════════════════════════════════════════════════════ */

/**
 * O NEXO abre pelo mesmo ⌘J que a casca escuta no documento: o atalho
 * alterna o painel, e este botão o dispara. Não há outra porta para ele: a
 * casca é dona do estado do painel.
 */
export function Atalhos({ atalhos, comNexo }: { atalhos: Atalho[]; comNexo: boolean }) {
  return (
    <nav className="ini-atalhos" aria-label="Atalhos">
      <ul>
        {atalhos.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="ini-atalho">
              <span>{a.rotulo}</span>
              {a.contagem ? <b>{inteiro(a.contagem)}</b> : null}
              <ArrowRight aria-hidden="true" />
            </Link>
          </li>
        ))}
        {comNexo ? (
          <li>
            <button type="button" className="ini-atalho" onClick={() => abrirNexo()}>
              <span>Perguntar ao NEXO</span>
              <kbd>⌘J</kbd>
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
