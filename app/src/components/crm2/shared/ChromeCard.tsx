"use client";

/**
 * Card escuro pra corpo de módulo "chrome" (Pipeline, Propostas) — promovido
 * a compartilhado 25/08 (nasceu local em pipeline/NegocioDrawer.tsx, essa é
 * a 3ª vez que precisei do mesmo padrão, mesmo critério já usado pra
 * DarkFilterSelect/DrawerSection nesta sessão).
 */
export function Cf2ChromeCard({ children, className = "", padding = "20px", style }: {
  children: React.ReactNode; className?: string; padding?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border-subtle)", padding, ...style }}
    >
      {children}
    </div>
  );
}
