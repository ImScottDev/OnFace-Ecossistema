"use client";

import { LineChart, Line, Area, ComposedChart, ResponsiveContainer } from "recharts";

interface KpiCardProps {
  label: string;
  value: string;
  delta: number;
  trend: number[];
  color: string;
  delay?: number;
}

export function KpiCard({ label, value, delta, trend, color, delay = 0 }: KpiCardProps) {
  const isPositive = delta >= 0;
  const sparkData = trend.map((v, i) => ({ v, i }));

  return (
    <div
      className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
      style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: `${delay}s` }}
    >
      <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
        {label}
      </p>

      <div className="flex items-center justify-between mt-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        <div className="w-[80px] h-[32px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={sparkData}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                fill={`url(#spark-${label.replace(/\s/g, "")})`}
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-2">
        <span
          className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
            isPositive
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
