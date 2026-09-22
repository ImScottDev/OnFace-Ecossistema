import type { ReactNode } from "react";

/**
 * Peças das telas de diagnóstico (Qualidade de dados, Duplicidade de contratos).
 *
 * Substituem `Stat`/`Secao` do `_kit-legado`, que eram escritos em
 * `text-white/40` sobre superfície escura: usados no CRM2 (fundo claro) o texto
 * simplesmente não aparecia. Mesma composição, tokens do design system.
 */

export type TomDiagnostico = "ok" | "atencao" | "critico" | "neutro";

const COR: Record<TomDiagnostico, string> = {
  ok: "var(--cf2-success-text)",
  atencao: "var(--cf2-warning-text)",
  critico: "var(--cf2-danger-text)",
  neutro: "var(--cf2-text-primary)",
};

export function SecaoDiag({ children, dica }: { children: ReactNode; dica?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-2">
      <h2
        className="text-[11px] font-bold uppercase"
        style={{ color: "var(--cf2-text-secondary)", letterSpacing: "0.6px" }}
      >
        {children}
      </h2>
      {dica && <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{dica}</span>}
    </div>
  );
}

export function StatDiag({
  label, valor, sub, tom = "neutro", destaque = false,
}: {
  label: string;
  valor: ReactNode;
  sub?: string;
  tom?: TomDiagnostico;
  destaque?: boolean;
}) {
  return (
    <div
      className="rounded-[var(--cf2-radius-lg)] p-3.5 flex flex-col gap-1 min-w-0"
      style={{
        background: destaque ? "var(--cf2-bg-surface-muted)" : "var(--cf2-bg-surface)",
        border: "1px solid var(--cf2-border-default)",
      }}
    >
      <span className="text-[11px] font-medium truncate" style={{ color: "var(--cf2-text-tertiary)" }} title={label}>
        {label}
      </span>
      <span
        className={destaque ? "text-2xl font-bold" : "text-xl font-semibold"}
        style={{ color: COR[tom], fontFamily: "var(--cf2-font-heading)" }}
      >
        {valor}
      </span>
      {sub && <span className="text-[11px] leading-snug" style={{ color: "var(--cf2-text-tertiary)" }}>{sub}</span>}
    </div>
  );
}

export function CartaoDiag({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <div
      className="rounded-[var(--cf2-radius-lg)] p-4"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <p className="text-[12.5px] font-semibold mb-2" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

/** Cabeçalho comum das duas telas de diagnóstico.
 *
 * `h2` e não `h1`: o `h1` da seção é do layout de Ajustes. Com os dois, a
 * tela de Qualidade de dados anunciava o próprio nome duas vezes seguidas —
 * medido no HTML servido. A sub-tela de duplicidade tem nome próprio e
 * continua se apresentando, agora um nível abaixo. */
export function CabecalhoDiag({ titulo, descricao }: { titulo?: string; descricao: string }) {
  return (
    <header className="flex flex-col gap-1">
      {titulo ? <h2 className="text-lg font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</h2> : null}
      <p className="text-[12.5px] max-w-3xl leading-relaxed" style={{ color: "var(--cf2-text-tertiary)" }}>
        {descricao}
      </p>
    </header>
  );
}
