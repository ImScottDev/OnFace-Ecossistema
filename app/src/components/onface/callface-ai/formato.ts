/** Formatação pt-BR das telas de uso. Puro, sem estado. */

export const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");

export const compacto = (n: number) =>
  n.toLocaleString("pt-BR", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 });

export const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n).toLocaleString("pt-BR")}%`;

/** "há 4 min", "há 3 h", "há 2 dias", "em 12/09/2026". */
export function haQuanto(iso: string | null | undefined, agora = new Date()): string {
  if (!iso) return "nunca";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (agora.getTime() - t) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  return `em ${new Date(t).toLocaleDateString("pt-BR")}`;
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** "seg, 12/10" a partir de "2026-10-12", sem o fuso puxar para o dia anterior. */
export function diaCurto(dia: string): string {
  const d = new Date(dia + "T12:00:00");
  return `${SEMANA[d.getDay()]}, ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}
