"use client";

import Link from "next/link";
import type { Kpi } from "@/lib/inicio/tipos";
import { brlInteiro } from "@/lib/inicio/lente";
import { Spark } from "./graficos";
import { SeloDelta, inteiro } from "./compartilhado";

/** Formata um ponto da série no mesmo idioma do valor do KPI (dinheiro ou contagem). */
const formatoDaSerie = (k: Kpi) => (k.chave === "faturamento" ? brlInteiro : inteiro);

/**
 * Faixa de indicadores: uma superfície só, quatro colunas separadas por fio.
 * Cada coluna é número, variação contra o período anterior e a série diária
 * que a sustenta. Não é um grid de cartões: é uma linha de fatos.
 */
export function FaixaDeKpis({ kpis }: { kpis: Kpi[] }) {
  return (
    <section className="ini-kpis" aria-label="Indicadores dos últimos 30 dias">
      {kpis.map((k) => {
        const corpo = (
          <>
            <span className="ini-kpi-rotulo">{k.rotulo}</span>
            <strong className="ini-kpi-valor">{k.valor}</strong>
            <span className="ini-kpi-apoio">
              {k.delta ? <SeloDelta delta={k.delta} /> : null}
              <span>{k.apoio}</span>
            </span>
            {k.serie ? (
              <Spark serie={k.serie} fim={k.serieFim} formato={formatoDaSerie(k)} rotulo={k.rotulo} />
            ) : null}
          </>
        );
        return k.href ? (
          <Link key={k.chave} href={k.href} className="ini-kpi" data-link="true">{corpo}</Link>
        ) : (
          <div key={k.chave} className="ini-kpi">{corpo}</div>
        );
      })}
    </section>
  );
}
