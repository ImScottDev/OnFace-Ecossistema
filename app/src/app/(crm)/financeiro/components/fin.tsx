/** Helpers compartilhados das abas do Financeiro. */

export const fmt = (v: number | null | undefined) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export const fmtK = (v: number | null | undefined) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return fmt(n);
};

export const fmtData = (v: unknown) => (v ? new Date(v as string).toLocaleDateString("pt-BR") : "—");

export const fmtPct = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const STATUS_FATURA: Record<string, { label: string; cls: string }> = {
  paga: { label: "Paga", cls: "bg-emerald-500/15 text-emerald-400" },
  aberta: { label: "Em aberto", cls: "bg-red-500/15 text-red-400" },
  emitida: { label: "Emitida (Wevy)", cls: "bg-[#8e27ef]/15 text-[#a855f7]" },
  uncollectible: { label: "Incobrável", cls: "bg-red-500/25 text-red-300" },
  void: { label: "Cancelada", cls: "bg-white/10 text-white/40" },
  rascunho: { label: "Rascunho", cls: "bg-white/10 text-white/40" },
};

export function ProdutoBadge({ produto }: { produto: string | null }) {
  const ps = (produto || "").split(",").filter(Boolean);
  return (
    <span className="flex gap-1">
      {ps.map((p) => (
        <span
          key={p}
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
            p === "pabx" ? "bg-[#8e27ef]/15 text-[#a855f7]" : "bg-[#e23752]/15 text-[#e23752]"
          }`}
        >
          {p === "pabx" ? "PABX" : "AI"}
        </span>
      ))}
    </span>
  );
}
