"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CircleAlert, Minus } from "lucide-react";
import type { Bloco, Delta } from "@/lib/inicio/tipos";

/**
 * O selo de variação lê o tom do DADO (`delta.tom`, calculado por `deltaDe`).
 * Nunca há tom escrito na marcação: com número real, a queda de 58% já saiu
 * verde uma vez por causa disso.
 */
export function SeloDelta({ delta, sufixo }: { delta: Delta; sufixo?: string }) {
  const Seta = delta.pct === null || delta.pct === 0 ? Minus : delta.pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="ini-delta" data-tom={delta.tom}>
      <Seta aria-hidden="true" />
      <span>{delta.texto}</span>
      {sufixo ? <span className="ini-delta-sufixo">{sufixo}</span> : null}
    </span>
  );
}

/** Um card cujo bloco não carregou: diz que falhou, nunca mostra zero no lugar. */
export function BlocoComErro({ titulo, aoTentar }: { titulo: string; aoTentar: () => void }) {
  return (
    <div className="ini-erro" role="alert">
      <CircleAlert aria-hidden="true" />
      <div>
        <strong>Não consegui carregar {titulo}.</strong>
        <span>O resto do Início segue de pé.</span>
      </div>
      <button type="button" className="ini-link-botao" onClick={aoTentar}>Tentar de novo</button>
    </div>
  );
}

export function Vazio({ icone, titulo, texto, href, acao }: {
  icone: React.ReactNode; titulo: string; texto?: string; href?: string; acao?: string;
}) {
  return (
    <div className="ini-vazio">
      <span className="ini-vazio-icone" aria-hidden="true">{icone}</span>
      <strong>{titulo}</strong>
      {texto ? <p>{texto}</p> : null}
      {href && acao ? <Link href={href} className="ini-link">{acao}</Link> : null}
    </div>
  );
}

/** Cabeçalho de card: título à esquerda, ação/contexto à direita. O título é h2
 *  (a página só tem um h1, a saudação). */
export function TopoDeCartao({ id, titulo, direita }: { id: string; titulo: string; direita?: React.ReactNode }) {
  return (
    <header className="ini-topo">
      <h2 id={id}>{titulo}</h2>
      {direita ? <div className="ini-topo-direita">{direita}</div> : null}
    </header>
  );
}

export function useBloco<T>(b: Bloco<T> | null): T | null {
  return b && b.ok ? b.dados : null;
}

export const inteiro = (n: number) => n.toLocaleString("pt-BR");

/** "51 min", "15 h", "3 d": a mediana em horas, na unidade que não mente. */
export function horasLegivel(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
}
