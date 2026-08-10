"use client";

type Variant = "success" | "warning" | "danger" | "neutral" | "accent";

const VARIANT_STYLE: Record<Variant, { bg: string; text: string }> = {
  success: { bg: "var(--cf2-success-bg)", text: "var(--cf2-success-text)" },
  warning: { bg: "var(--cf2-warning-bg)", text: "var(--cf2-warning-text)" },
  danger: { bg: "#fde8e8", text: "var(--cf2-danger-text)" },
  neutral: { bg: "var(--cf2-bg-surface-muted)", text: "var(--cf2-text-secondary)" },
  accent: { bg: "var(--cf2-accent)", text: "var(--cf2-text-on-accent)" },
};

export function Cf2Badge({ children, variant = "neutral" }: { children: React.ReactNode; variant?: Variant }) {
  const s = VARIANT_STYLE[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap"
      style={{ background: s.bg, color: s.text }}
    >
      {children}
    </span>
  );
}
