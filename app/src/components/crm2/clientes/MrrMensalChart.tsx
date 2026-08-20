"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PontoMensal { mes: string; valor: number }

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * MRR mensal por cliente (Cliente 360, 19/08) — série real de
 * mrr_movimentos.mrrDepois, nunca fabricada. Mesmo padrão visual do
 * DesempenhoChart do Início, só que por conta em vez de agregado da org.
 */
export function Cf2MrrMensalChart({ dados }: { dados: PontoMensal[] }) {
  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
        <AreaChart data={dados} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--cf2-border-default)" />
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--cf2-text-secondary)" }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`}
            tick={{ fontSize: 10, fill: "var(--cf2-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip formatter={(v) => brl(Number(v) || 0)} />
          <Area type="monotone" dataKey="valor" stroke="var(--cf2-success-text)" fill="var(--cf2-success-bg)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
