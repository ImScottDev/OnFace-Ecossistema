/**
 * Parte PURA de metas (tipos, constantes e helpers de data) — SEM importar `db`.
 * Pode ser usada em Client Components. As funções que tocam o banco ficam em `@/lib/metas`.
 */

export type MetaTipo =
  | "reunioes_agendadas"
  | "reunioes_outbound"
  | "faturamento_fechado"
  | "mrr_fechado"
  | "leads_qualificados"
  | "contratos_fechados";

export const META_TIPOS: MetaTipo[] = [
  "reunioes_agendadas",
  "reunioes_outbound",
  "faturamento_fechado",
  "mrr_fechado",
  "leads_qualificados",
  "contratos_fechados",
];

/** Rótulos amigáveis por tipo (UI de metas + dashboards). */
export const META_LABELS: Record<MetaTipo, string> = {
  reunioes_agendadas: "Reuniões agendadas",
  reunioes_outbound: "Reuniões (outbound)",
  faturamento_fechado: "Faturamento fechado",
  mrr_fechado: "MRR fechado (legado)",
  leads_qualificados: "Leads qualificados",
  contratos_fechados: "Contratos fechados",
};

/** Tipos que são valores monetários (formatados como R$). */
export const META_TIPOS_MOEDA: MetaTipo[] = ["faturamento_fechado", "mrr_fechado"];

/**
 * Papéis cujas metas de `mrr_fechado` somam no total comercial da Home
 * (`getMetaComercialAgregada`). "vendedor" é o nome legado de "closer" e
 * ainda existe no banco.
 */
export const PAPEIS_QUE_SOMAM_NA_META: string[] = ["closer", "vendedor"];

/** Usuários que fecham negócio de verdade mas o `role` não é closer/vendedor
 * (reorg interno mudou o cargo, mas a atividade comercial continuou). Kauã
 * confirmou (31/08/2026): Jenifer Matos (role "gerente") vende de verdade e
 * deve contar nos agregados/relatórios de closer mesmo assim — pontual, por
 * ID, NÃO amplia o bucket de role (outros "gerente" da org não vendem). */
export const CLOSER_EXTRA_IDS: string[] = ["6418d02b-d45c-4d49-8b29-b96f8f136795"]; // Jenifer Matos

/**
 * Meta north-star por papel (pré-seleciona o tipo na UI e nos dashboards).
 *
 * Closer passou de `mrr_fechado` pra `faturamento_fechado` em 09/09/2026:
 * medir só MRR deixava 33% do valor fechado (R$ 95,7 mil em 12 meses) fora de
 * qualquer meta — 37 negócios ganhos, alguns 100% setup, fecharam com zero no
 * painel de quem vendeu. `mrr_fechado` continua existindo porque há metas
 * históricas cadastradas nele; não se define meta nova assim.
 */
export function metaTipoPorPapel(role: string): MetaTipo {
  if (role === "sdr") return "reunioes_agendadas";
  return "faturamento_fechado";
}

/** Tipo aposentado: só aparece pra ler histórico, nunca como sugestão. */
export const META_TIPOS_LEGADOS: MetaTipo[] = ["mrr_fechado"];

/** Normaliza "periodo" (string YYYY-MM-DD ou Date) pro 1º dia do mês e o mês seguinte. */
export function monthRange(periodo: string | Date): { inicio: Date; fim: Date; primeiroDia: string } {
  const base = typeof periodo === "string" ? new Date(`${periodo.slice(0, 10)}T00:00:00`) : periodo;
  const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
  const fim = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const primeiroDia = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-01`;
  return { inicio, fim, primeiroDia };
}
