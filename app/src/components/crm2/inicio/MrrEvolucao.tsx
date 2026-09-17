"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { MrrSeries, PontoSerie } from "@/lib/analytics/inicio";
import {
  Cf2ChartContainer, Cf2ChartTooltip, Cf2ChartTooltipContent, Cf2BarraSegmentada,
  type Cf2ChartSerie,
} from "@/components/crm2/ui/Chart";

/**
 * "Evolução do MRR" (Figma 559:2952) — duas séries reais por período: MRR
 * fechado no bucket e MRR novo do ledger. O toggle 7D/30D/90D/12M é de
 * verdade: as 4 janelas já vêm calculadas do server (2 queries), então
 * trocar de período é instantâneo, sem round-trip.
 *
 * Migrado pra `recharts` + primitivas `Cf2Chart` (30/08, pedido do Kauã: o
 * gráfico anterior era estático, sem hover). Agora tem tooltip com os
 * valores das 2 séries e cursor destacando a coluna, no padrão de
 * referência. As barras "segmentadas" do desenho continuam — via `shape`
 * customizado (`Cf2BarraSegmentada`), que recharts não tem nativo.
 */

const JANELAS = ["7D", "30D", "90D", "12M"] as const;
type Janela = (typeof JANELAS)[number];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compacto = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

const SERIES: Cf2ChartSerie[] = [
  { key: "mrr", label: "MRR do Período", color: "var(--cf2-home-serie-mrr)" },
  { key: "novo", label: "Novo MRR", color: "var(--cf2-home-serie-novo)" },
];

const ROTULO_JANELA: Record<Janela, string> = {
  "7D": "nos últimos 7 dias",
  "30D": "nos últimos 30 dias",
  "90D": "nos últimos 90 dias",
  "12M": "nos últimos 12 meses",
};

export function Cf2MrrEvolucao({
  series, variacaoPct,
}: {
  series: MrrSeries;
  variacaoPct: number | null;
}) {
  const [janela, setJanela] = useState<Janela>("12M");
  const dados: PontoSerie[] = useMemo(() => series[janela] ?? [], [series, janela]);

  // O total acompanha a janela escolhida. Antes vinha fixo do mês corrente,
  // então em 12M o gráfico mostrava um ano de barras com o total de setembro
  // embaixo — e no dia 8 do mês esse total era R$ 0,00 sob barras cheias.
  const totalJanela = useMemo(() => dados.reduce((soma, p) => soma + (p.mrr ?? 0), 0), [dados]);

  // Em janelas longas o eixo X não cabe todo — mostra 1 a cada N.
  const intervaloEixo = dados.length > 24 ? Math.ceil(dados.length / 12) - 1 : 0;
  const positivo = (variacaoPct ?? 0) >= 0;

  return (
    <div
      className="flex flex-col rounded-[28px] overflow-hidden"
      style={{ background: "#ffffff", boxShadow: "0px 1px 2px rgba(17,19,24,0.03), 0px 6px 20px -8px rgba(17,19,24,0.08)" }}
    >
      <div
        className="flex items-center justify-between gap-3 pt-5 px-5 sm:px-6 pb-3"
        style={{ borderBottom: "1px solid var(--cf2-home-grid-line)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 shrink-0" style={{ color: "#737373" }} />
          <p className="text-[14px] truncate" style={{ color: "var(--cf2-home-ink)", letterSpacing: "-0.5px" }}>Evolução do MRR</p>
        </div>
        {variacaoPct !== null && (
          <div className="flex items-center gap-1 shrink-0">
            {positivo
              ? <ArrowUpRight className="w-[11px] h-[11px]" style={{ color: "var(--cf2-home-positive-alt)" }} />
              : <ArrowDownRight className="w-[11px] h-[11px]" style={{ color: "var(--cf2-home-danger)" }} />}
            <span
              className="text-[11px] font-medium"
              style={{ color: positivo ? "var(--cf2-home-positive-alt)" : "var(--cf2-home-danger)" }}
            >
              {positivo ? "+" : ""}{variacaoPct.toFixed(1)}%
            </span>
            <span className="text-[11px] hidden sm:inline" style={{ color: "#737373" }}>vs mesmo período do mês passado</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px]" style={{ color: "#737373" }}>MRR fechado {ROTULO_JANELA[janela]}</p>
            <p
              className="text-[20px] font-semibold leading-none"
              style={{ color: "#0a0a0a", letterSpacing: "-0.7px", fontFamily: "var(--cf2-font-heading)" }}
            >
              {brl(totalJanela)}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
            <div className="flex items-center gap-1 p-1 rounded-[10px] self-start sm:self-auto" style={{ background: "#f5f5f5" }}>
              {JANELAS.map((j) => {
                const ativo = j === janela;
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setJanela(j)}
                    aria-pressed={ativo}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
                    style={{
                      background: ativo ? "#ffffff" : "transparent",
                      color: "#0a0a0a",
                      boxShadow: ativo ? "0px 1.5px 1.5px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {j}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              {SERIES.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5 text-[9.5px]" style={{ color: "#737373" }}>
                  <span className="w-[5px] h-[5px] rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {dados.length === 0 ? (
          <p className="h-[200px] flex items-center justify-center text-[12px]" style={{ color: "#737373" }}>
            Sem dado no período.
          </p>
        ) : (
          <Cf2ChartContainer series={SERIES} className="h-[200px]">
            <BarChart data={dados} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--cf2-home-grid-line)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label" tickLine={false} axisLine={false} interval={intervaloEixo}
                tick={{ fontSize: 9, fill: "#737373" }} tickMargin={8}
              />
              <YAxis
                tickLine={false} axisLine={false} width={44}
                tick={{ fontSize: 9, fill: "#737373" }} tickFormatter={compacto}
              />
              <Cf2ChartTooltip content={<Cf2ChartTooltipContent formatarValor={brl} />} />
              <Bar dataKey="mrr" fill="var(--cf2-home-serie-mrr)" shape={<Cf2BarraSegmentada />} maxBarSize={16} />
              <Bar dataKey="novo" fill="var(--cf2-home-serie-novo)" shape={<Cf2BarraSegmentada />} maxBarSize={16} />
            </BarChart>
          </Cf2ChartContainer>
        )}
      </div>
    </div>
  );
}
