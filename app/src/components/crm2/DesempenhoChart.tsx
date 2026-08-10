"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Ponto { dia: number; valorAcumulado: number }

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function DesempenhoChart({ atual, anterior }: { atual: Ponto[]; anterior: Ponto[] }) {
  const data = atual.map((p, i) => ({
    dia: p.dia,
    atual: p.valorAcumulado,
    anterior: anterior[i]?.valorAcumulado ?? null,
  }));

  const semDadoNenhum = atual.every((p) => p.valorAcumulado === 0) && anterior.every((p) => p.valorAcumulado === 0);

  return (
    <div className="w-full h-[380px] flex flex-col">
      <div className="flex items-center gap-4 px-2 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--cf2-accent-border)" }} />
          <span className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>Mês Atual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--cf2-text-tertiary)" }} />
          <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Mês Anterior</span>
        </div>
      </div>
      {semDadoNenhum ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum negócio ganho registrado nesses 2 meses ainda.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--cf2-border-default)" />
            <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#4b5563" }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`}
              tick={{ fontSize: 10, fill: "#4b5563" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip formatter={(v) => brl(Number(v) || 0)} labelFormatter={(d) => `Dia ${d}`} />
            <Area type="monotone" dataKey="anterior" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.06} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Area type="monotone" dataKey="atual" stroke="#88d600" fill="#aaff00" fillOpacity={0.18} strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
