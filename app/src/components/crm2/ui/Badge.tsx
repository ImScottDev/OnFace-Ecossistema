"use client";

type Variant = "success" | "warning" | "danger" | "neutral" | "accent";

const VARIANT_STYLE: Record<Variant, { bg: string; text: string }> = {
  success: { bg: "var(--cf2-success-bg)", text: "var(--cf2-success-text)" },
  warning: { bg: "var(--cf2-warning-bg)", text: "var(--cf2-warning-text)" },
  danger: { bg: "#fde8e8", text: "var(--cf2-danger-text)" },
  neutral: { bg: "var(--cf2-bg-surface-muted)", text: "var(--cf2-text-secondary)" },
  accent: { bg: "var(--cf2-accent)", text: "var(--cf2-text-on-accent)" },
};

// Achado real 25/08 (Kauã: "fundo branco do nada" na tela de Propostas, que
// é escura/chrome) — VARIANT_STYLE acima só tem cor LIGHT (--cf2-success-bg
// etc são tons claros); usado sem querer dentro do drawer/tabela escuros.
// `dark` troca pra fundo translúcido sobre chrome + mesmas 3 cores
// dark-safe já usadas em Pipeline/Propostas (#4ade80/#fbbf24/#f87171).
const VARIANT_STYLE_DARK: Record<Variant, { bg: string; text: string }> = {
  success: { bg: "color-mix(in srgb, #4ade80 18%, transparent)", text: "#4ade80" },
  warning: { bg: "color-mix(in srgb, #fbbf24 18%, transparent)", text: "#fbbf24" },
  danger: { bg: "color-mix(in srgb, #f87171 18%, transparent)", text: "#f87171" },
  neutral: { bg: "rgba(255,255,255,0.08)", text: "var(--cf2-chrome-text-secondary)" },
  accent: { bg: "var(--cf2-accent)", text: "var(--cf2-text-on-accent)" },
};

export function Cf2Badge({ children, variant = "neutral", dark = false }: { children: React.ReactNode; variant?: Variant; dark?: boolean }) {
  const s = dark ? VARIANT_STYLE_DARK[variant] : VARIANT_STYLE[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap"
      style={{ background: s.bg, color: s.text }}
    >
      {children}
    </span>
  );
}
