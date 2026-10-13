"use client";

/**
 * Gráficos do Início.
 *
 * Três formas, cada uma escolhida pelo trabalho do dado:
 *   BarrasDeFaturamento   magnitude por mês: uma barra por mês sobre uma base
 *   AreaDeMeta    progresso acumulado contra o ritmo da meta: duas linhas
 *   Spark         tendência diária de um número: uma linha, sem eixo
 *
 * Marcas finas, base única, grade quase invisível, ponto final com anel da cor
 * da superfície, e hover em tudo que tem série (a leitura exata mora no
 * tooltip, não numa etiqueta em cada ponto). Cada gráfico tem tabela
 * equivalente para leitor de tela. Cor é token: a marca principal usa a tinta
 * do papel (`currentColor`), e o coral só marca o que pede atenção.
 */
import * as React from "react";
import { brlInteiro, caminhoDeSerie, moedaCompacta } from "@/lib/inicio/lente";
import type { MesDeFaturamento } from "@/lib/inicio/tipos";

/* ═══ Barras: faturamento por mês ═════════════════════════════════════════ */

/** Teto "redondo" para três intervalos: 0, 25 mil, 50 mil, 75 mil. */
function escalaDe(max: number) {
  const bruto = Math.max(max, 1) / 3;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = ([1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= bruto)) ?? 10 * mag;
  return { passo, teto: passo * 3 };
}

export function BarrasDeFaturamento({ meses }: { meses: MesDeFaturamento[] }) {
  const [ativo, setAtivo] = React.useState<number | null>(null);
  const { passo, teto } = escalaDe(Math.max(0, ...meses.map((m) => m.valor)));
  const ultimo = meses.length - 1;

  if (meses.every((m) => m.valor === 0)) {
    return (
      <div className="ini-grafico-vazio">
        <strong>Nada faturado nos últimos seis meses</strong>
        <span>O gráfico aparece com o primeiro negócio ganho.</span>
      </div>
    );
  }

  return (
    <figure className="ini-fat" aria-label="Faturamento por mês, últimos seis meses">
      <div className="ini-fat-quadro">
        <div className="ini-fat-eixo" aria-hidden="true">
          {[3, 2, 1, 0].map((i) => <span key={i}>{i === 0 ? "0" : moedaCompacta(passo * i).replace("R$ ", "")}</span>)}
        </div>
        <div className="ini-fat-corpo" onPointerLeave={() => setAtivo(null)}>
          {[1, 2, 3].map((i) => <i key={i} className="ini-fat-grade" style={{ bottom: `${(i / 3) * 100}%` }} aria-hidden="true" />)}
          {meses.map((m, i) => (
            <div
              key={m.rotulo + i}
              className="ini-fat-coluna"
              data-ativo={ativo === i ? "true" : undefined}
              data-atual={i === ultimo ? "true" : undefined}
              tabIndex={0}
              role="group"
              aria-label={`${m.rotulo}${i === ultimo ? " (até hoje)" : ""}: ${brlInteiro(m.valor)}`}
              onPointerEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
            >
              <div className="ini-fat-trilho">
                <span className="ini-fat-barra" style={{ height: `${Math.max(m.valor > 0 ? 2 : 0, (m.valor / teto) * 100)}%`, "--atraso": `${i * 45}ms` } as React.CSSProperties} />
              </div>
              <span className="ini-fat-mes">{m.rotulo}</span>
              {ativo === i ? (
                <div className="ini-dica ini-dica-barra" role="status" data-borda={i === 0 ? "esq" : i === ultimo ? "dir" : undefined}>
                  <b>{m.rotulo}{i === ultimo ? " (até hoje)" : ""}</b>
                  <span>Faturamento<em>{brlInteiro(m.valor)}</em></span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Faturamento por mês</caption>
        <thead><tr><th>Mês</th><th>Faturamento</th></tr></thead>
        <tbody>{meses.map((m, i) => <tr key={m.rotulo + i}><td>{m.rotulo}</td><td>{brlInteiro(m.valor)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/* ═══ Área: acumulado do mês contra o ritmo da meta ═══════════════════════ */

export function AreaDeMeta({
  acumulado, diasNoMes, alvo, mesRotulo,
}: { acumulado: number[]; diasNoMes: number; alvo: number | null; mesRotulo: string }) {
  const [ativo, setAtivo] = React.useState<number | null>(null);
  const caixa = React.useRef<HTMLDivElement>(null);
  const L = 600, A = 180;
  const hoje = acumulado.length;
  const realizado = acumulado[hoje - 1] ?? 0;
  const teto = Math.max(alvo ?? 0, realizado, 1) * 1.06;

  // x pelo dia do mês (1..n), y pelo valor, base em zero: o gráfico conta quanto
  // falta, e uma base cortada esconderia exatamente isso.
  const x = (dia: number) => ((dia - 1) / Math.max(1, diasNoMes - 1)) * L;
  const y = (v: number) => A - (v / teto) * A;
  const linha = acumulado.map((v, i) => `${i === 0 ? "M" : "L"}${x(i + 1).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = hoje > 1 ? `${linha} L${x(hoje).toFixed(1)} ${A} L${x(1).toFixed(1)} ${A} Z` : "";
  const ritmo = alvo ? `M${x(1)} ${y(alvo / diasNoMes)} L${x(diasNoMes)} ${y(alvo)}` : "";
  const ritmoNoDia = (dia: number) => (alvo ? (alvo * dia) / diasNoMes : null);

  const mover = (e: React.PointerEvent) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r || hoje === 0) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const dia = Math.round(frac * (diasNoMes - 1)) + 1;
    setAtivo(Math.min(dia, hoje) - 1);
  };

  if (acumulado.every((v) => v === 0) && !alvo) {
    return (
      <div className="ini-grafico-vazio">
        <strong>Nada fechado em {mesRotulo} ainda</strong>
        <span>O acumulado do mês aparece aqui com o primeiro negócio ganho.</span>
      </div>
    );
  }

  return (
    <figure className="ini-curva" aria-label={`Faturamento acumulado em ${mesRotulo} contra o ritmo da meta`}>
      <div className="ini-area-caixa" ref={caixa} onPointerMove={mover} onPointerLeave={() => setAtivo(null)}>
        <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((f) => <line key={f} className="ini-fio" x1="0" x2={L} y1={A * f} y2={A * f} />)}
          <line className="ini-fio" x1="0" x2={L} y1={A} y2={A} />
          {ritmo ? <path className="ini-ritmo" d={ritmo} /> : null}
          {area ? <path className="ini-area-preenche" d={area} /> : null}
          {hoje > 1 ? <path className="ini-area-linha" d={linha} /> : null}
        </svg>
        {hoje > 0 ? (
          <span
            className="ini-area-ponto"
            style={{ left: `${(x(hoje) / L) * 100}%`, top: `${(y(realizado) / A) * 100}%` }}
            aria-hidden="true"
          />
        ) : null}
        {ativo !== null ? (
          <>
            <span className="ini-area-mira" style={{ left: `${(x(ativo + 1) / L) * 100}%` }} aria-hidden="true" />
            <div className="ini-dica ini-dica-area" role="status" style={{ left: `${(x(ativo + 1) / L) * 100}%` }} data-borda={ativo > diasNoMes * 0.6 ? "dir" : "esq"}>
              <b>Dia {ativo + 1}</b>
              <span>Acumulado<em>{brlInteiro(acumulado[ativo])}</em></span>
              {ritmoNoDia(ativo + 1) !== null ? <span>Ritmo da meta<em>{brlInteiro(ritmoNoDia(ativo + 1)!)}</em></span> : null}
            </div>
          </>
        ) : null}
      </div>
      <div className="ini-area-eixo" aria-hidden="true">
        <span>1</span><span>{Math.round(diasNoMes / 2)}</span><span>{diasNoMes}</span>
      </div>
      <figcaption className="ini-legenda">
        <span><i data-lado="linha" />Acumulado</span>
        {alvo ? <span><i data-lado="ritmo" />Ritmo para bater a meta</span> : null}
      </figcaption>
      <table className="sr-only">
        <caption>Faturamento acumulado por dia</caption>
        <thead><tr><th>Dia</th><th>Acumulado</th></tr></thead>
        <tbody>{acumulado.map((v, i) => <tr key={i}><td>{i + 1}</td><td>{brlInteiro(v)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/* ═══ Spark: tendência diária ═════════════════════════════════════════════ */

const dataCurtaDe = (chave: string, deslocamento: number) => {
  const d = new Date(`${chave}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - deslocamento);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
};

export function Spark({
  serie, fim, formato, rotulo,
}: { serie: number[]; fim: string | null; formato: (n: number) => string; rotulo: string }) {
  const [ativo, setAtivo] = React.useState<number | null>(null);
  const caixa = React.useRef<HTMLDivElement>(null);
  const L = 120, A = 36;
  const c = caminhoDeSerie(serie, L, A, 3, { baseZero: true });
  if (!c || c.pontos.length < 2) return null;

  const mover = (e: React.PointerEvent) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setAtivo(Math.round(frac * (serie.length - 1)));
  };
  const p = ativo !== null ? c.pontos[ativo] : c.pontos[c.pontos.length - 1];

  return (
    <div className="ini-spark" ref={caixa} onPointerMove={mover} onPointerLeave={() => setAtivo(null)} role="img"
      aria-label={`${rotulo}, últimos ${serie.length} dias: de ${formato(serie[0])} a ${formato(serie[serie.length - 1])} por dia, máximo ${formato(c.max)}`}>
      <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
        <line className="ini-fio" x1="0" x2={L} y1={A} y2={A} />
        <path className="ini-spark-area" d={c.area} />
        <path className="ini-spark-linha" d={c.linha} />
      </svg>
      <span className="ini-spark-ponto" data-hover={ativo !== null ? "true" : undefined}
        style={{ left: `${(p.x / L) * 100}%`, top: `${(p.y / A) * 100}%` }} aria-hidden="true" />
      {ativo !== null ? (
        <span className="ini-spark-dica" role="status" data-borda={p.x > L * 0.6 ? "dir" : "esq"} style={{ left: `${(p.x / L) * 100}%` }}>
          {fim ? `${dataCurtaDe(fim, serie.length - 1 - ativo)} · ` : ""}<b>{formato(serie[ativo])}</b>
        </span>
      ) : null}
    </div>
  );
}
