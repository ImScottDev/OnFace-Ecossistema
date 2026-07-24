"use client";

interface FunnelData {
  name: string;
  value: number;
  color: string;
}

// Cor do % de conversão em relação à etapa anterior — sinaliza onde o funil "vaza" rápido.
function corConversao(pct: number | null): string {
  if (pct == null) return "rgba(255,255,255,0.3)";
  if (pct >= 50) return "#10B981";
  if (pct >= 20) return "#F59E0B";
  return "#EF4444";
}

export function FunnelChart({ data }: { data: FunnelData[] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      {data.map((item, index) => {
        // Largura proporcional ao maior valor, centralizada — a barra afunilando visualmente
        // conforme os números caem é o "desenho de funil".
        const widthPercent = Math.max((item.value / maxValue) * 100, 12);
        const anterior = index > 0 ? data[index - 1].value : null;
        const pctDoAnterior = anterior != null && anterior > 0 ? (item.value / anterior) * 100 : null;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-24 text-sm text-white/50 text-right shrink-0">{item.name}</span>
            <div className="flex-1 flex justify-center">
              <div
                className="h-9 rounded-md flex items-center justify-center px-3 transition-all"
                style={{ width: `${widthPercent}%`, backgroundColor: item.color, minWidth: "56px" }}
              >
                <span className="text-white text-sm font-semibold tabular-nums">{item.value.toLocaleString("pt-BR")}</span>
              </div>
            </div>
            <span className="w-14 text-right text-xs font-medium tabular-nums shrink-0" style={{ color: corConversao(pctDoAnterior) }} title={pctDoAnterior != null ? `${pctDoAnterior.toFixed(1)}% da etapa anterior` : "primeira etapa"}>
              {pctDoAnterior == null ? "—" : `${pctDoAnterior.toFixed(0)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
