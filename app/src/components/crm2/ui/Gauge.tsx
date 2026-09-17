"use client";

/**
 * Gauge circular via SVG (stroke-dasharray) — mesmo espírito visual do arco
 * do Figma (progresso circular com % no centro), mas implementado com
 * geometria real de círculo em vez de clonar os clip-paths pixel a pixel
 * do frame. Escolha deliberada: SVG resolve nativo, sem posicionamento
 * absoluto frágil.
 *
 * `variante` (09/09/2026): o gauge nasceu só pro chrome escuro — trilho em
 * `rgba(255,255,255,0.12)` e rótulo em `--cf2-chrome-text-primary`, ambos
 * invisíveis sobre card claro. A variante "clara" veio quando o resumo da
 * chamada passou a mostrar a chance de fechamento, que vive num card branco.
 */
export function Cf2Gauge({
  pct, size = 80, label, variante = "escura", cor,
}: {
  pct: number;
  size?: number;
  label: string;
  variante?: "escura" | "clara";
  /** Sobrescreve a cor do arco (ex: faixa de risco). Default é o verde de sucesso. */
  cor?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  const claro = variante === "clara";
  const trilho = claro ? "var(--cf2-bg-surface-muted)" : "rgba(255,255,255,0.12)";
  const corTexto = claro ? "var(--cf2-text-primary)" : "var(--cf2-chrome-text-primary)";
  const corArco = cor ?? (claro ? "var(--cf2-success-fill)" : "#4ade80");

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label} de ${clamped}%`}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trilho} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={corArco}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[18px] font-bold" style={{ color: corTexto, fontFamily: "var(--cf2-font-heading)" }}>
          {label}
        </span>
      </div>
    </div>
  );
}
