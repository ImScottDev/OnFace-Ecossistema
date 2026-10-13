/**
 * Regra única de "este usuário é um agente de IA?".
 *
 * Agente é um usuário (migration 0097) com `tipo = 'agente'`, ligado a
 * `ai_agents` por `agente_id`. Toda consulta que devolve usuário e toda tela que
 * mostra avatar/nome usa esta regra — nada de comparar `tipo` solto.
 */
export function ehAgenteUsuario(u: { tipo?: string | null; agenteId?: string | null } | null | undefined): boolean {
  return !!u && (u.tipo === "agente" || !!u.agenteId);
}

/** Fragmento SQL equivalente, para `SELECT ..., ${...} AS eh_agente` em consultas cruas. */
export const SQL_EH_AGENTE = (alias = "u") => `(${alias}.tipo = 'agente' OR ${alias}.agente_id IS NOT NULL)`;

/** Pessoas primeiro, depois os agentes de IA; dentro de cada grupo, a ordem de entrada. */
export function pessoasPrimeiro<T>(itens: T[], ehAgente: (i: T) => boolean): T[] {
  return [...itens.filter((i) => !ehAgente(i)), ...itens.filter(ehAgente)];
}
