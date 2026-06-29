"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  centerValue?: string;
  centerLabel?: string;
  height?: number;
}

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  height = 220,
}: DonutChartProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center" style={{ minHeight: height }}>
      <div className="relative w-full sm:w-[60%]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={55}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue && (
              <span className="text-xl font-bold text-white">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-white/40">{centerLabel}</span>
            )}
          </div>
        )}
      </div>

      <div className="w-full sm:w-[40%] flex flex-row sm:flex-col flex-wrap gap-2 pl-0 sm:pl-2 mt-2 sm:mt-0">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-white/60 truncate">{entry.name}</span>
              <span className="text-[11px] text-white/40">{entry.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
