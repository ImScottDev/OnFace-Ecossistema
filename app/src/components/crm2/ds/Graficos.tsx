"use client";

/**
 * Família de gráficos do Callface UI System (31/08).
 *
 * Construída sobre o `chart` do shadcn (que é um wrapper de recharts), com as
 * variações que o Kauã pediu: área, barra, linha, pizza, radar e radial.
 *
 * Decisão de forma: em vez de 30 componentes fixos (um por variação da galeria
 * do shadcn), são 6 componentes PARAMETRIZADOS. O motivo é prático — quando
 * ele disser "esse não, quero empilhado", a mudança é trocar uma prop, não
 * trocar de componente e reescrever o call site. Era esse o pedido: "pra
 * quando você criar e eu não gostar a gente conseguir mudar de forma fácil".
 *
 * Regras que a família impõe, para dois dashboards nunca brigarem:
 *  - paleta única (--cf2-serie-1..5), série 1 sempre a principal;
 *  - grade horizontal apenas — linha vertical só polui leitura temporal;
 *  - eixo sem linha e sem tick, o dado é que desenha a forma;
 *  - moeda abreviada no eixo (R$ 42 mil), completa no tooltip;
 *  - altura vem de fora, o gráfico nunca fixa a própria altura.
 */
import * as React from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, RadialBar, RadialBarChart, XAxis, YAxis, LabelList,
} from "recharts";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils/cn";

export type { ChartConfig };

/** Paleta padrão por posição. Série 1 é a principal (marca). */
export const SERIES = [
  "var(--cf2-serie-1)", "var(--cf2-serie-2)", "var(--cf2-serie-3)",
  "var(--cf2-serie-4)", "var(--cf2-serie-5)",
];

/** Monta o ChartConfig atribuindo a paleta na ordem — evita cada tela
 *  escolher cor no olho, que é como nasce dashboard arco-íris. */
export function configDeSeries(series: { chave: string; rotulo: string }[]): ChartConfig {
  return Object.fromEntries(
    series.map((s, i) => [s.chave, { label: s.rotulo, color: SERIES[i % SERIES.length] }])
  );
}

/** Abrevia moeda no eixo: "R$ 42 mil" em vez de "R$ 42.000,00". */
export function moedaCurta(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`;
  return `R$ ${v}`;
}

const EIXO = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  style: { fontSize: 11, fill: "var(--cf2-text-tertiary)" },
} as const;

function Grade() {
  // Só horizontal: linha vertical compete com a forma do dado numa série
  // temporal e não ajuda a ler valor.
  return <CartesianGrid vertical={false} stroke="var(--cf2-grid-line)" strokeDasharray="3 3" />;
}

type BaseProps = {
  dados: Record<string, unknown>[];
  /** Chave do eixo X / categoria. */
  eixo: string;
  series: { chave: string; rotulo: string }[];
  altura?: number;
  className?: string;
  /** Formata o valor no tooltip. Padrão: número puro. */
  formatarValor?: (v: number) => string;
  legenda?: boolean;
};

/* ── ÁREA ───────────────────────────────────────────────────────────────
   simples · empilhado · gradiente (a mais usada em evolução de MRR) */
export function Cf2GraficoArea({
  dados, eixo, series, altura = 220, variante = "gradiente", className,
  formatarValor, legenda = false, eixoY = false,
}: BaseProps & { variante?: "simples" | "empilhado" | "gradiente"; eixoY?: boolean }) {
  const config = configDeSeries(series);
  const idGrad = React.useId();

  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height: altura }}>
      <AreaChart data={dados} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.chave} id={`${idGrad}-${s.chave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <Grade />
        <XAxis dataKey={eixo} {...EIXO} />
        {eixoY && <YAxis {...EIXO} width={56} tickFormatter={(v) => moedaCurta(Number(v))} />}
        <ChartTooltip
          cursor={{ stroke: "var(--cf2-grid-line)" }}
          content={<ChartTooltipContent formatter={formatarValor ? (v) => formatarValor(Number(v)) : undefined} />}
        />
        {legenda && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Area
            key={s.chave}
            dataKey={s.chave}
            type="monotone"
            stackId={variante === "empilhado" ? "a" : undefined}
            stroke={SERIES[i % SERIES.length]}
            strokeWidth={2}
            fill={variante === "simples" ? "transparent" : `url(#${idGrad}-${s.chave})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--cf2-bg-surface)" }}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}

/* ── BARRA ──────────────────────────────────────────────────────────────
   vertical · horizontal · agrupado · empilhado · com rótulo */
export function Cf2GraficoBarra({
  dados, eixo, series, altura = 220, className, formatarValor, legenda = false,
  orientacao = "vertical", variante = "agrupado", rotulos = false,
}: BaseProps & {
  orientacao?: "vertical" | "horizontal";
  variante?: "agrupado" | "empilhado";
  /** Valor escrito na ponta da barra — bom em ranking curto, ruim em série longa. */
  rotulos?: boolean;
}) {
  const config = configDeSeries(series);
  const horizontal = orientacao === "horizontal";

  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height: altura }}>
      <BarChart
        data={dados}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ left: horizontal ? 4 : 4, right: rotulos ? 32 : 8, top: 8, bottom: 0 }}
      >
        <CartesianGrid
          vertical={horizontal}
          horizontal={!horizontal}
          stroke="var(--cf2-grid-line)"
          strokeDasharray="3 3"
        />
        {horizontal ? (
          <>
            <XAxis type="number" {...EIXO} hide />
            <YAxis type="category" dataKey={eixo} {...EIXO} width={96} />
          </>
        ) : (
          <XAxis dataKey={eixo} {...EIXO} />
        )}
        <ChartTooltip
          cursor={{ fill: "var(--cf2-bg-surface-muted)" }}
          content={<ChartTooltipContent formatter={formatarValor ? (v) => formatarValor(Number(v)) : undefined} />}
        />
        {legenda && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Bar
            key={s.chave}
            dataKey={s.chave}
            stackId={variante === "empilhado" ? "a" : undefined}
            fill={SERIES[i % SERIES.length]}
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            maxBarSize={horizontal ? 20 : 44}
          >
            {rotulos && (
              <LabelList
                position={horizontal ? "right" : "top"}
                offset={6}
                className="fill-tinta-suave"
                style={{ fontSize: 11 }}
                formatter={formatarValor ? (v) => formatarValor(Number(v)) : undefined}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/* ── LINHA ──────────────────────────────────────────────────────────────
   simples · múltipla · tracejada · com pontos */
export function Cf2GraficoLinha({
  dados, eixo, series, altura = 220, className, formatarValor, legenda = false,
  pontos = false, tracejada = false, eixoY = false,
}: BaseProps & { pontos?: boolean; tracejada?: boolean; eixoY?: boolean }) {
  const config = configDeSeries(series);

  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height: altura }}>
      <LineChart data={dados} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <Grade />
        <XAxis dataKey={eixo} {...EIXO} />
        {eixoY && <YAxis {...EIXO} width={48} />}
        <ChartTooltip
          cursor={{ stroke: "var(--cf2-grid-line)" }}
          content={<ChartTooltipContent formatter={formatarValor ? (v) => formatarValor(Number(v)) : undefined} />}
        />
        {legenda && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Line
            key={s.chave}
            dataKey={s.chave}
            type="monotone"
            stroke={SERIES[i % SERIES.length]}
            strokeWidth={2}
            strokeDasharray={tracejada && i > 0 ? "5 4" : undefined}
            dot={pontos ? { r: 3, strokeWidth: 0, fill: SERIES[i % SERIES.length] } : false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--cf2-bg-surface)" }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

/* ── PIZZA / ROSCA ──────────────────────────────────────────────────────
   pizza · rosca · rosca com total no centro */
export function Cf2GraficoPizza({
  dados, chaveRotulo, chaveValor, altura = 220, className, variante = "rosca",
  total, rotuloTotal, formatarValor, legenda = true,
}: {
  dados: Record<string, unknown>[];
  chaveRotulo: string;
  chaveValor: string;
  altura?: number;
  className?: string;
  variante?: "pizza" | "rosca" | "rosca-total";
  total?: number | string;
  rotuloTotal?: string;
  formatarValor?: (v: number) => string;
  legenda?: boolean;
}) {
  const config: ChartConfig = Object.fromEntries(
    dados.map((d, i) => [
      String(d[chaveRotulo]),
      { label: String(d[chaveRotulo]), color: SERIES[i % SERIES.length] },
    ])
  );
  const raioInterno = variante === "pizza" ? 0 : Math.round(altura * 0.22);

  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height: altura }}>
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey={chaveRotulo} formatter={formatarValor ? (v) => formatarValor(Number(v)) : undefined} />}
        />
        <Pie
          data={dados}
          dataKey={chaveValor}
          nameKey={chaveRotulo}
          innerRadius={raioInterno}
          strokeWidth={2}
          stroke="var(--cf2-bg-surface)"
        >
          {dados.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        {legenda && <ChartLegend content={<ChartLegendContent nameKey={chaveRotulo} />} />}
        {/* Total no miolo: a rosca sozinha responde "proporção", mas quase
            sempre a pergunta seguinte é "de quanto?". */}
        {variante === "rosca-total" && total !== undefined && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            <tspan x="50%" dy="-0.3em" className="fill-tinta" style={{ fontSize: 20, fontWeight: 600 }}>
              {total}
            </tspan>
            {rotuloTotal && (
              <tspan x="50%" dy="1.5em" className="fill-tinta-fraca" style={{ fontSize: 11 }}>
                {rotuloTotal}
              </tspan>
            )}
          </text>
        )}
      </PieChart>
    </ChartContainer>
  );
}

/* ── RADAR ──────────────────────────────────────────────────────────────
   Comparar um perfil em vários eixos (ex.: skills de um vendedor). */
export function Cf2GraficoRadar({
  dados, eixo, series, altura = 260, className, legenda = false, preenchido = true, maximo,
}: BaseProps & { preenchido?: boolean; maximo?: number }) {
  const config = configDeSeries(series);
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height: altura }}>
      <RadarChart data={dados} outerRadius="70%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <ChartTooltip content={<ChartTooltipContent />} />
        <PolarGrid stroke="var(--cf2-grid-line)" radialLines={false} />
        <PolarAngleAxis
          dataKey={eixo}
          tick={{ fontSize: 11, fill: "var(--cf2-text-secondary)" }}
        />
        {/* Escala explícita e domínio fixo (31/08): sem isto o recharts
            normaliza pelo maior valor de CADA render, então dois radares lado
            a lado ficavam com escalas diferentes e a comparação — que é a
            única razão de existir um radar — mentia. */}
        <PolarRadiusAxis
          domain={[0, maximo ?? 100]}
          tick={false}
          axisLine={false}
          tickCount={5}
        />
        {series.map((s, i) => (
          <Radar
            key={s.chave}
            name={s.rotulo}
            dataKey={s.chave}
            stroke={SERIES[i % SERIES.length]}
            fill={SERIES[i % SERIES.length]}
            // Opacidade baixa e uniforme: com duas séries sobrepostas, 0.2 já
            // somava para uma mancha opaca que escondia a de baixo.
            fillOpacity={preenchido ? 0.12 : 0}
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fillOpacity: 1 }}
            isAnimationActive={false}
          />
        ))}
        {legenda && <ChartLegend content={<ChartLegendContent />} />}
      </RadarChart>
    </ChartContainer>
  );
}

/* ── RADIAL / GAUGE ─────────────────────────────────────────────────────
   Progresso contra meta. É o formato certo pra "quanto da meta bati". */
export function Cf2GraficoRadial({
  valor, maximo = 100, rotulo, altura = 200, className, tom = "marca", legenda,
}: {
  valor: number;
  maximo?: number;
  /** Texto grande no centro. Se ausente, mostra a porcentagem. */
  rotulo?: string;
  altura?: number;
  className?: string;
  tom?: "marca" | "positivo" | "atencao" | "negativo";
  /** Texto pequeno abaixo do valor. */
  legenda?: string;
}) {
  const pct = Math.max(0, Math.min(100, (valor / maximo) * 100));
  const cor = {
    marca: "var(--cf2-brand)",
    positivo: "var(--cf2-positivo)",
    atencao: "var(--cf2-atencao)",
    negativo: "var(--cf2-negativo)",
  }[tom];

  return (
    <ChartContainer
      config={{ v: { label: rotulo ?? "Progresso", color: cor } }}
      className={cn("w-full", className)}
      style={{ height: altura }}
    >
      <RadialBarChart
        data={[{ name: "v", value: pct, fill: cor }]}
        startAngle={90}
        // Sentido horário a partir do topo — o gauge tem que "encher" como
        // um relógio, senão a leitura de progresso inverte.
        endAngle={90 - (pct / 100) * 360}
        innerRadius="68%"
        outerRadius="100%"
        barSize={14}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar dataKey="value" background={{ fill: "var(--cf2-bg-surface-muted)" }} cornerRadius={8} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
          <tspan x="50%" dy={legenda ? "-0.25em" : "0"} className="fill-tinta" style={{ fontSize: 24, fontWeight: 600 }}>
            {rotulo ?? `${Math.round(pct)}%`}
          </tspan>
          {legenda && (
            <tspan x="50%" dy="1.6em" className="fill-tinta-fraca" style={{ fontSize: 11 }}>
              {legenda}
            </tspan>
          )}
        </text>
      </RadialBarChart>
    </ChartContainer>
  );
}

/* ── SPARKLINE ──────────────────────────────────────────────────────────
   Tendência dentro de um KPI. Sem eixo, sem grade, sem tooltip: é forma,
   não leitura de valor. */
export function Cf2Sparkline({
  dados, chave, altura = 36, tom = "marca", className,
}: {
  dados: Record<string, unknown>[];
  chave: string;
  altura?: number;
  tom?: "marca" | "positivo" | "negativo" | "neutro";
  className?: string;
}) {
  const cor = {
    marca: "var(--cf2-brand)",
    positivo: "var(--cf2-positivo)",
    negativo: "var(--cf2-negativo)",
    neutro: "var(--cf2-text-tertiary)",
  }[tom];
  const id = React.useId();

  return (
    <ChartContainer
      config={{ [chave]: { label: chave, color: cor } }}
      className={cn("w-full [&_.recharts-surface]:overflow-visible", className)}
      style={{ height: altura }}
    >
      <AreaChart data={dados} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area dataKey={chave} type="monotone" stroke={cor} strokeWidth={1.5} fill={`url(#${id})`} dot={false} />
      </AreaChart>
    </ChartContainer>
  );
}
