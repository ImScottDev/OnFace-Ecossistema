/**
 * Parte PURA de metas (tipos, constantes e helpers de data) — SEM importar `db`.
 * Pode ser usada em Client Components. As funções que tocam o banco ficam em `@/lib/metas`.
 */

export type MetaTipo =
  | "reunioes_agendadas"
  | "reunioes_outbound"
  | "mrr_fechado"
  | "leads_qualificados"
  | "contratos_fechados";

export const META_TIPOS: MetaTipo[] = [
  "reunioes_agendadas",
  "reunioes_outbound",
  "mrr_fechado",
  "leads_qualificados",
  "contratos_fechados",
];

/** Rótulos amigáveis por tipo (UI de metas + dashboards). */
export const META_LABELS: Record<MetaTipo, string> = {
  reunioes_agendadas: "Reuniões agendadas",
  reunioes_outbound: "Reuniões (outbound)",
  mrr_fechado: "MRR fechado",
  leads_qualificados: "Leads qualificados",
  contratos_fechados: "Contratos fechados",
};

/** Tipos que são valores monetários (formatados como R$). */
export const META_TIPOS_MOEDA: MetaTipo[] = ["mrr_fechado"];

/** Meta north-star por papel (usada pra pré-selecionar o tipo na UI e nos dashboards). */
export function metaTipoPorPapel(role: string): MetaTipo {
  if (role === "sdr") return "reunioes_agendadas";
  return "mrr_fechado"; // closer (e demais) → MRR fechado
}

/** Normaliza "periodo" (string YYYY-MM-DD ou Date) pro 1º dia do mês e o mês seguinte. */
export function monthRange(periodo: string | Date): { inicio: Date; fim: Date; primeiroDia: string } {
  const base = typeof periodo === "string" ? new Date(`${periodo.slice(0, 10)}T00:00:00`) : periodo;
  const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
  const fim = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const primeiroDia = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-01`;
  return { inicio, fim, primeiroDia };
}
