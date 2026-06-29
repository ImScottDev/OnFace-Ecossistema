"use client";

interface FunnelData {
  name: string;
  value: number;
  color: string;
}

export function FunnelChart({ data }: { data: FunnelData[] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const widthPercent = Math.max((item.value / maxValue) * 100, 8);
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-24 text-sm text-white/50 text-right">{item.name}</span>
            <div className="flex-1">
              <div
                className="h-8 rounded-md flex items-center px-3 transition-all"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: item.color,
                  minWidth: "40px",
                }}
              >
                <span className="text-white text-sm font-medium">{item.value}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
