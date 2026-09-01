"use client";

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { Activity } from "lucide-react";
import { Cf2ChartContainer, Cf2ChartTooltip, Cf2ChartTooltipContent } from "@/components/crm2/ui/Chart";
import type { PontoMovimento } from "@/lib/analytics/vendas-visao-geral";

/**
 * Movimento comercial ao longo do período (30/08) — 4 séries reais por semana.
 *
 * "Pararam" NÃO está aqui de propósito: é um estado do agora (negócio sem
 * movimento há 5+ dias), não um evento datado — não existe "quantos pararam
 * na semana 3". Esse número aparece como sinal único em "Atenção comercial".
 *
 * Usa as primitivas `Cf2Chart*` (recharts) já criadas pra Home, então o
 * tooltip/hover é o mesmo padrão do resto do CRM2.
 */

/** Formato exigido por `Cf2ChartContainer` (alimenta o tooltip compartilhado). */
const SERIES = [
  { key: "entraram", label: "Entraram", color: "var(--cf2-home-lime)" },
  { key: "avancaram", label: "Avançaram", color: "var(--cf2-home-info)" },
  { key: "ganhos", label: "Ganhos", color: "var(--cf2-home-positive)" },
  { key: "perdidos", label: "Perdidos", color: "var(--cf2-home-danger)" },
];

export function Cf2MovimentoComercial({ serie }: { serie: PontoMovimento[] }) {
  const vazio = serie.every((p) => p.entraram + p.avancaram + p.ganhos + p.perdidos === 0);

  return (
    <section
      className="rounded-[28px] pt-4 px-5 pb-5 flex flex-col gap-3 h-full"
      style={{ background: "#ffffff", border: "1px solid var(--cf2-home-panel-border)" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <Activity className="size-4 shrink-0" style={{ color: "var(--cf2-home-ink-soft)" }} />
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-[14px]" style={{ color: "var(--cf2-home-ink)", letterSpacing: "-0.5px" }}>
              Movimento comercial
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[11px]" style={{ color: "var(--cf2-home-ink-soft)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {vazio ? (
        <p className="text-[13px] py-12 text-center" style={{ color: "var(--cf2-home-ink-soft)" }}>
          Sem movimentação de pipeline no período filtrado.
        </p>
      ) : (
        <Cf2ChartContainer series={SERIES} className="h-[240px] w-full">
          <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--cf2-home-grid-line)" strokeDasharray="3 3" />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--cf2-home-ink-soft)", fontSize: 11 }}
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--cf2-home-ink-soft)", fontSize: 11 }}
              allowDecimals={false}
              width={44}
            />
            <Cf2ChartTooltip content={<Cf2ChartTooltipContent />} />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </Cf2ChartContainer>
      )}
    </section>
  );
}
