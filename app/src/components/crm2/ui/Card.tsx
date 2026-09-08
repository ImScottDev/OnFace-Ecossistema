"use client";

export function Cf2Card({
  children,
  className = "",
  padding = "20px",
  highlight,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  /** "success" | "danger" — borda colorida com significado (não decorativa) */
  highlight?: "success" | "danger";
  style?: React.CSSProperties;
}) {
  const borderColor =
    highlight === "success" ? "var(--cf2-accent-border)" : highlight === "danger" ? "var(--cf2-danger-border)" : "var(--cf2-border-default)";
  const borderWidth = highlight ? "1.5px" : "1px";
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: "var(--cf2-bg-surface)",
        border: `${borderWidth} solid ${borderColor}`,
        boxShadow: "var(--cf2-shadow-card-sm)",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Cf2SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{title}</p>
      {subtitle && <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>{subtitle}</p>}
    </div>
  );
}

export function Cf2Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-text-secondary)", fontFamily: "var(--cf2-font-heading)" }}>
      {children}
    </p>
  );
}
