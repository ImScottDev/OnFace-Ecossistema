/**
 * Avaliação do nó lógico do FollowupGraph. As saídas Sim/Não compilam para
 * condition.<id>, por isso o runtime precisa calcular esse fato ANTES de
 * resolver o branch. Reusa a gramática única do CRM.
 */
import { avaliarCondicao, type Condicao } from "@/lib/crm/condicao";
import type { FollowupNode } from "@/lib/ai-platform/followup/graph";

type ConfigCondicao = Extract<FollowupNode, { type: "condition" }>["config"];

const operadores: Record<ConfigCondicao["checks"][number]["op"], NonNullable<Condicao["operador"]>> = {
  eq: "igual",
  neq: "diferente",
  contains: "contem",
  gte: "maior_igual",
  lte: "menor_igual",
};

export function resultadoCondicaoCadencia(
  config: ConfigCondicao,
  vars: Record<string, unknown>,
): boolean {
  const verificar = (check: ConfigCondicao["checks"][number]) =>
    avaliarCondicao({ campo: check.field, operador: operadores[check.op], valor: check.value }, vars);
  return config.combinator === "or"
    ? config.checks.some(verificar)
    : config.checks.every(verificar);
}
