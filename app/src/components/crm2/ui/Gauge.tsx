"use client";

/**
 * Gauge circular via SVG (stroke-dasharray) — mesmo espírito visual do arco
 * do Figma (progresso circular com % no centro), mas implementado com
 * geometria real de círculo em vez de clonar os clip-paths pixel a pixel
 * do frame. Escolha deliberada: sustentável or Tailwind normal, sem
 * posicionamento absoluto frágil pra um efeito que SVG já resolve nativo.
 */
export function Cf2Gauge({ pct, size = 80, label }: { pct: number; size?: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--cf2-accent-border)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[18px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>
          {label}
        </span>
      </div>
    </div>
  );
}
