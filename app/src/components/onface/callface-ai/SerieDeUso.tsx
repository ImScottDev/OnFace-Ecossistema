"use client";

/**
 * Série diária de uso — minutos ou ligações por dia, recorte 7/30/90.
 *
 * Coluna por dia, não área: o dia é a unidade discreta do uso (fim de semana
 * zera, e a área desenharia uma rampa que não existiu). Uma série, uma cor —
 * coral é o que a pessoa veio ver, e o título já diz o que está plotado, então
 * não há legenda. A média do recorte é o único texto sobre o gráfico.
 *
 * Hover/foco: o cursor ocupa a faixa inteira do dia (alvo maior que a barra)
 * e o tooltip dá data, valor e o outro indicador do mesmo dia.
 */

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DiaDeUso } from "./tipos";
import { compacto, diaCurto, inteiro } from "./formato";

type Indicador = "minutos" | "chamadas";
const RECORTES = [7, 30, 90] as const;

const CONFIG = {
  minutos: { label: "Minutos", color: "var(--cf2-serie-1)" },
  chamadas: { label: "Ligações", color: "var(--cf2-serie-1)" },
} satisfies ChartConfig;

/** Recharts não lê var() em medida; mesmas constantes de ds/graficos.tsx. */
const SVG = { raioBarra: 4, barraMax: 24, espacoTick: 8 } as const;

function Dica({ active, payload }: { active?: boolean; payload?: Array<{ payload?: DiaDeUso }> }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-control border border-linha bg-superficie px-3 py-2 text-apoio shadow-[var(--shadow-flutuante)]">
      <p className="font-semibold text-tinta">{diaCurto(p.dia)}</p>
      <p className="mt-1 tabular-nums text-tinta">
        <strong>{inteiro(p.minutos)}</strong> min · <strong>{inteiro(p.chamadas)}</strong> {p.chamadas === 1 ? "ligação" : "ligações"}
      </p>
    </div>
  );
}

export function SerieDeUso({ serie, rodape }: { serie: DiaDeUso[]; rodape?: React.ReactNode }) {
  const reduzido = useReducedMotion();
  const [indicador, setIndicador] = React.useState<Indicador>("minutos");
  const [recorte, setRecorte] = React.useState<(typeof RECORTES)[number]>(30);

  const dados = React.useMemo(() => serie.slice(-recorte), [serie, recorte]);
  const total = dados.reduce((a, p) => a + p[indicador], 0);
  const media = dados.length ? total / dados.length : 0;
  const pico = dados.reduce<DiaDeUso | null>((m, p) => (!m || p[indicador] > m[indicador] ? p : m), null);
  const unidade = indicador === "minutos" ? "min" : "ligações";
  const vazio = total === 0;

  return (
    <figure className="flex flex-col gap-3" aria-label={`${CONFIG[indicador].label} por dia, últimos ${recorte} dias`}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="mr-auto min-w-0">
          <figcaption className="text-corpo font-semibold text-tinta">
            {CONFIG[indicador].label} por dia
          </figcaption>
          <p className="text-apoio text-tinta-suave tabular-nums">
            {inteiro(total)} {unidade} em {recorte} dias · média {inteiro(media)}/dia
            {pico && pico[indicador] > 0 ? ` · pico ${inteiro(pico[indicador])} em ${diaCurto(pico.dia)}` : ""}
          </p>
        </div>
        <ToggleGroup type="single" size="sm" variant="outline" value={indicador}
          onValueChange={(v) => v && setIndicador(v as Indicador)} aria-label="Indicador">
          <ToggleGroupItem value="minutos">Minutos</ToggleGroupItem>
          <ToggleGroupItem value="chamadas">Ligações</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" size="sm" variant="outline" value={String(recorte)}
          onValueChange={(v) => v && setRecorte(Number(v) as (typeof RECORTES)[number])} aria-label="Período">
          {RECORTES.map((r) => <ToggleGroupItem key={r} value={String(r)}>{r}d</ToggleGroupItem>)}
        </ToggleGroup>
      </div>

      {vazio ? (
        <div className="grid h-[calc(220*var(--onface-u))] place-items-center rounded-control bg-superficie-alt px-6 text-center">
          <p className="max-w-[48ch] text-apoio text-tinta-suave">
            Nenhuma {indicador === "minutos" ? "ligação com duração" : "ligação"} registrada nos últimos {recorte} dias.
            {recorte < 90 ? " Amplie o período para ver o histórico." : ""}
          </p>
        </div>
      ) : (
        <ChartContainer config={CONFIG} className="aspect-auto h-[calc(220*var(--onface-u))] w-full">
          <BarChart data={dados} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="dia" tickLine={false} axisLine={false} tickMargin={SVG.espacoTick}
              minTickGap={24} tickFormatter={(d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)} />
            <YAxis width="auto" tickLine={false} axisLine={false} allowDecimals={false}
              tickFormatter={(v: number) => compacto(v)} />
            <ChartTooltip cursor={{ fill: "var(--color-superficie-alt)" }} content={<Dica />} />
            <ReferenceLine y={media} stroke="var(--cf2-serie-3)" strokeDasharray="4 4"
              label={{ value: `média ${inteiro(media)}`, position: "insideTopRight", fill: "var(--cf2-text-secondary)", fontSize: 11 }} />
            <Bar dataKey={indicador} fill={`var(--color-${indicador})`} radius={[SVG.raioBarra, SVG.raioBarra, 0, 0]}
              maxBarSize={SVG.barraMax} isAnimationActive={!reduzido} />
          </BarChart>
        </ChartContainer>
      )}

      {rodape ? <p className="text-micro text-tinta-suave">{rodape}</p> : null}

      {/* Visão em tabela para leitor de tela: o gráfico é imagem para ele. */}
      <table className="sr-only">
        <caption>{CONFIG[indicador].label} por dia</caption>
        <thead><tr><th>Dia</th><th>Minutos</th><th>Ligações</th></tr></thead>
        <tbody>
          {dados.map((p) => <tr key={p.dia}><td>{diaCurto(p.dia)}</td><td>{p.minutos}</td><td>{p.chamadas}</td></tr>)}
        </tbody>
      </table>
    </figure>
  );
}
