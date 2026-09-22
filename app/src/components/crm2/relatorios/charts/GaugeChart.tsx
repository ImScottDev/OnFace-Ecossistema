"use client";

import { PieChart, Pie, Cell } from "recharts";

interface GaugeChartProps {
  value: number;
  label: string;
  target?: number;
}

export function GaugeChart({ value, label, target }: GaugeChartProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const data = [{ value: clamped }, { value: 100 - clamped }];

  const fillColor =
    clamped >= 30 ? "var(--cf2-success-text)" : clamped >= 15 ? "var(--cf2-warning-text)" : "var(--cf2-danger-text)";

  return (
    <div className="relative flex flex-col items-center" style={{ height: 160 }}>
      <PieChart width={200} height={120}>
        <Pie
          data={data}
          startAngle={180}
          endAngle={0}
          innerRadius={60}
          outerRadius={80}
          dataKey="value"
          stroke="none"
          cy={100}
        >
          <Cell fill={fillColor} />
          <Cell fill="var(--cf2-bg-surface-muted)" />
        </Pie>
      </PieChart>

      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 62 }}>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-[var(--cf2-text-primary)]">{clamped}%</span>
          <span className="text-[11px] text-[var(--cf2-text-tertiary)]">{label}</span>
        </div>
      </div>

      {target !== undefined && (
        <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">Meta: {target}%</p>
      )}
    </div>
  );
}
