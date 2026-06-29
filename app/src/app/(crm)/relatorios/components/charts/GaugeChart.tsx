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
    clamped >= 30 ? "#10B981" : clamped >= 15 ? "#F59E0B" : "#EF4444";

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
          <Cell fill="rgba(255,255,255,0.05)" />
        </Pie>
      </PieChart>

      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 62 }}>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-white">{clamped}%</span>
          <span className="text-[11px] text-white/40">{label}</span>
        </div>
      </div>

      {target !== undefined && (
        <p className="text-[10px] text-white/25 mt-1">Meta: {target}%</p>
      )}
    </div>
  );
}
