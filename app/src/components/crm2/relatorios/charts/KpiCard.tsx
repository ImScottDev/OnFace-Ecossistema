"use client";

import { LineChart, Line, Area, ComposedChart, ResponsiveContainer } from "recharts";

interface KpiCardProps {
  label: string;
  value: string;
  delta: number | null;
  trend: number[];
  color: string;
  delay?: number;
}

export function KpiCard({ label, value, delta, trend, color, delay = 0 }: KpiCardProps) {
  // delta null = base pequena/zero → "n/a" (evita variação absurda tipo +3800%)
  const hasDelta = delta != null && Number.isFinite(delta);
  const isPositive = (delta ?? 0) >= 0;
  const sparkData = trend.map((v, i) => ({ v, i }));

  return (
    <div
      className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4"
      style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: `${delay}s` }}
    >
      <p className="text-[11px] text-[var(--cf2-text-tertiary)] uppercase tracking-wider font-medium">
        {label}
      </p>

      <div className="flex items-center justify-between mt-2">
        <span className="text-2xl font-bold text-[var(--cf2-text-primary)]">{value}</span>
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
        {hasDelta ? (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
              isPositive
                ? "bg-emerald-500/10 text-[var(--cf2-success-text)]"
                : "bg-red-500/10 text-[var(--cf2-danger-text)]"
            }`}
          >
            {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}
            {delta!.toFixed(1)}%
          </span>
        ) : (
          <span className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-tertiary)]">
            n/a
          </span>
        )}
      </div>
    </div>
  );
}
