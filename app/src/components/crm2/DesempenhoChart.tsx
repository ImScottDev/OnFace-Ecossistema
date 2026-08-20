"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

interface PontoMensal { mes: string; valor: number }

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Correção de 17/08 (fidelidade Figma node 172:1259): a legenda mora no
// cabeçalho da seção ("Desempenho Mensal"), não dentro do card — quem
// renderiza esse pedaço agora é a própria página. Este componente só
// desenha o gráfico: série MENSAL real (não diária) + linha de Meta.
export function DesempenhoChart({ dados, meta }: { dados: PontoMensal[]; meta?: number }) {
  const semDadoNenhum = dados.every((p) => p.valor === 0);
  const ultimo = dados[dados.length - 1];

  return (
    <div className="w-full h-[380px]">
      {semDadoNenhum ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum negócio ganho registrado nesse período ainda.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
          <AreaChart data={dados} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--cf2-border-default)" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "var(--cf2-text-secondary)" }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10, fill: "var(--cf2-text-secondary)" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip formatter={(v) => brl(Number(v) || 0)} />
            {meta !== undefined && meta > 0 && (
              <ReferenceLine y={meta} stroke="var(--cf2-text-tertiary)" strokeDasharray="4 3" label={{ value: "Meta", position: "insideTopRight", fontSize: 10, fill: "var(--cf2-text-tertiary)" }} />
            )}
            <Area
              type="monotone"
              dataKey="valor"
              stroke="var(--cf2-accent-border)"
              fill="var(--cf2-accent)"
              fillOpacity={0.18}
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; payload: PontoMensal }) => {
                const { cx, cy, payload } = props;
                const isLast = payload.mes === ultimo?.mes;
                if (!isLast || cx === undefined || cy === undefined) return <circle key={payload.mes} cx={cx ?? 0} cy={cy ?? 0} r={0} />;
                return (
                  <g key="ultimo-ponto">
                    <circle cx={cx} cy={cy} r={4} fill="var(--cf2-accent-border)" stroke="#fff" strokeWidth={2} />
                    <rect x={cx - 34} y={cy - 28} width={68} height={20} rx={6} fill="var(--cf2-accent)" stroke="var(--cf2-accent-border)" />
                    <text x={cx} y={cy - 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--cf2-text-on-accent)">
                      {`R$${(ultimo.valor / 1000).toFixed(1)}k`}
                    </text>
                  </g>
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
