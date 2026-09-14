"use client";

/** Formatadores compartilhados do módulo Financeiro (portados de `(crm)/financeiro/components/fin.tsx`). */

export const fmt = (v: number | null | undefined) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtK = (v: number | null | undefined) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return fmt(n);
};

export const fmtData = (v: unknown) => (v ? new Date(v as string).toLocaleDateString("pt-BR") : "—");

export const fmtPct = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

type EstiloStatus = { label: string; bg: string; texto: string };

/**
 * Status real da fatura no Stripe. Os pares fundo/texto vão em hex fixo pelo
 * mesmo motivo do `Cf2Badge`: o par precisa andar junto, sem depender de qual
 * superfície está por baixo.
 */
export const STATUS_FATURA: Record<string, EstiloStatus> = {
  paga: { label: "Paga", bg: "#dcfce7", texto: "#15803d" },
  aberta: { label: "Em aberto", bg: "#fde8e8", texto: "#b91c1c" },
  emitida: { label: "Emitida (Wevy)", bg: "#ede9fe", texto: "#6d28d9" },
  uncollectible: { label: "Incobrável", bg: "#fecaca", texto: "#991b1b" },
  void: { label: "Cancelada", bg: "#f1f5f9", texto: "#475569" },
  rascunho: { label: "Rascunho", bg: "#f1f5f9", texto: "#475569" },
};

export function PillStatus({ estilo, title }: { estilo: EstiloStatus; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: estilo.bg, color: estilo.texto }}
    >
      {estilo.label}
    </span>
  );
}

/**
 * Linha de receita do registro. "ai" e "pabx" vêm concatenados por vírgula no
 * mesmo campo quando o cliente tem as duas.
 */
export function ProdutoBadge({ produto }: { produto: string | null }) {
  const linhas = (produto || "").split(",").filter(Boolean);
  if (linhas.length === 0) return <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>—</span>;
  return (
    <span className="flex gap-1">
      {linhas.map((p) => (
        <span
          key={p}
          className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap"
          style={p === "pabx"
            ? { background: "#ede9fe", color: "#6d28d9" }
            : { background: "#dcfce7", color: "#15803d" }}
        >
          {p === "pabx" ? "PABX" : "AI"}
        </span>
      ))}
    </span>
  );
}
