"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils/cn";

/**
 * Primitivas de gráfico do CRM2 (30/08) — equivalente ao `ui/chart.tsx` do
 * shadcn, portado à mão pra convenção `Cf2*` do projeto (que não usa o
 * shadcn CLI / `components.json`).
 *
 * Existe pra que todo gráfico do produto tenha o MESMO tooltip, o mesmo
 * cursor de hover e o mesmo container responsivo — em vez de cada tela
 * reinventar o seu. Usa `recharts` (já era dependência) e os tokens
 * `--cf2-*`, então trocar tema não exige tocar em gráfico nenhum.
 */

export interface Cf2ChartSerie {
  key: string;
  label: string;
  color: string;
}

const CtxSeries = React.createContext<Cf2ChartSerie[]>([]);

export function Cf2ChartContainer({
  series, className, children,
}: {
  series: Cf2ChartSerie[];
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <CtxSeries.Provider value={series}>
      <div className={cn("w-full", className)}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </CtxSeries.Provider>
  );
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

/**
 * Conteúdo do tooltip — card claro com o rótulo do ponto e uma linha por
 * série (bolinha da cor + nome + valor formatado). `formatarValor` deixa a
 * tela decidir o formato (moeda, inteiro, %) sem duplicar o componente.
 */
export function Cf2ChartTooltipContent({
  active, payload, label, formatarValor,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatarValor?: (v: number) => string;
}) {
  const series = React.useContext(CtxSeries);
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl px-3 py-2.5 min-w-[168px]"
      style={{
        background: "var(--cf2-bg-surface)",
        border: "1px solid var(--cf2-border-default)",
        boxShadow: "0px 4px 16px rgba(17,19,24,0.12)",
      }}
    >
      {label !== undefined && (
        <p className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--cf2-text-primary)" }}>{label}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item) => {
          const s = series.find((x) => x.key === String(item.dataKey));
          const valor = typeof item.value === "number" ? item.value : Number(item.value ?? 0);
          return (
            <div key={String(item.dataKey)} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s?.color ?? item.color }} />
                {s?.label ?? item.name}:
              </span>
              <span className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
                {formatarValor ? formatarValor(valor) : valor}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tooltip com o cursor de coluna cinza do padrão de referência. */
export function Cf2ChartTooltip(props: React.ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip
      cursor={{ fill: "var(--cf2-bg-surface-muted)", radius: 8 }}
      wrapperStyle={{ outline: "none" }}
      {...props}
    />
  );
}

/**
 * Barra "segmentada" (tracinhos empilhados) do desenho da Home. Recharts não
 * tem isso nativo: é um `shape` customizado que preenche o retângulo da
 * barra com um pattern de traço+vão, respeitando o raio das pontas.
 */
export function Cf2BarraSegmentada(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string;
  /** altura do traço + do vão, em px */
  passo?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = "currentColor", passo = 6 } = props;
  if (height <= 0 || width <= 0) return null;

  const traco = Math.max(2, Math.round(passo / 2));
  const n = Math.max(1, Math.floor(height / passo));
  const segmentos = Array.from({ length: n }, (_, i) => {
    const sy = y + height - (i + 1) * passo + (passo - traco);
    return <rect key={i} x={x} y={sy} width={width} height={traco} rx={1} fill={fill} />;
  });
  return <g>{segmentos}</g>;
}
