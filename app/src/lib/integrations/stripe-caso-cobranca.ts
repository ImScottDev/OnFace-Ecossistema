/**
 * Caso de cobrança aberto para uma pessoa decidir (`billing_resolution_cases`) — parte PURA.
 *
 * Dois defeitos de produção (13/10/2026, reprocesso do invoice.paid de 14/09) moram aqui:
 *
 *  1. `queue` tem CHECK no banco: só `CONFIRMED`, `REVIEW` e `CONFLICT`. O código gravava
 *     `PAGAMENTO_SEM_NEGOCIO` e a inserção falhava. Decisão: `REVIEW` ("precisa de olho
 *     humano") serve, e o MOTIVO específico mora em `evidence.motivo` e `recommended_action`.
 *     Trocar o rótulo não mexe no schema de produção.
 *  2. `organizacao_id` ia NULL quando o customer não tinha lead. Caso sem dono não pertence a
 *     ninguém e vaza entre tenants. A organização vem do EVENTO (inbox/contexto), nunca do
 *     lead; sem organização o caso não se abre — lança, e o evento falha de forma visível.
 */

/** Valores aceitos por `billing_resolution_cases_queue_check`. Mudar isto exige migration. */
export const FILAS_DE_CASO = ["CONFIRMED", "REVIEW", "CONFLICT"] as const;
export type FilaDeCaso = (typeof FILAS_DE_CASO)[number];

/** Por que o caso foi aberto. É o que antes era (erradamente) o nome da fila. */
export type MotivoDoCaso = "PAGAMENTO_SEM_NEGOCIO" | "RECONCILIACAO_STRIPE";

export interface EntradaDoCaso {
  organizacaoId: string | null | undefined;
  motivo: MotivoDoCaso;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  crmEntityType?: string | null;
  crmEntityId?: string | null;
  evidence: Record<string, unknown>;
  recommendedAction: Record<string, unknown>;
  fila?: string;
}

export function montarCaso(e: EntradaDoCaso) {
  if (!e.organizacaoId) {
    throw new Error(`caso de cobrança (${e.motivo}) sem organização: o tenant vem do evento, não pode ficar nulo`);
  }
  const fila = e.fila ?? "REVIEW";
  if (!(FILAS_DE_CASO as readonly string[]).includes(fila)) {
    throw new Error(`fila de caso inválida "${fila}": o banco só aceita ${FILAS_DE_CASO.join(", ")}`);
  }
  return {
    organizacaoId: e.organizacaoId,
    queue: fila as FilaDeCaso,
    stripeCustomerId: e.stripeCustomerId,
    stripeSubscriptionId: e.stripeSubscriptionId,
    crmEntityType: e.crmEntityType ?? null,
    crmEntityId: e.crmEntityId ?? null,
    evidence: { ...e.evidence, motivo: e.motivo },
    recommendedAction: e.recommendedAction,
  };
}
