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

/**
 * Decide se um NOME é de agente: a marca explícita do dado (`ehAgente`) vale
 * mais; sem ela, vale a lista de nomes de agentes da organização que a casca
 * entrega. É a regra por trás do selo (`useEhAgente`) e dos seletores.
 */
export function ehAgentePorNome(
  nome: string | null | undefined,
  ehAgente: boolean | null | undefined,
  nomesDeAgentes: ReadonlySet<string>,
): boolean {
  return ehAgente ?? (!!nome && nomesDeAgentes.has(nome));
}

/** Rótulo do grupo de agentes em TODO seletor de pessoa (responsável, participante, autor, menção). */
export const ROTULO_GRUPO_AGENTES = "Agentes de IA";

/** Pessoas primeiro, depois os agentes de IA; dentro de cada grupo, a ordem de entrada. */
export function pessoasPrimeiro<T>(itens: T[], ehAgente: (i: T) => boolean): T[] {
  const { pessoas, agentes } = agruparPessoas(itens, ehAgente);
  return [...pessoas, ...agentes];
}

/** Os dois grupos do seletor: pessoas (ordem de entrada) e agentes de IA (ordem de entrada). */
export function agruparPessoas<T>(itens: readonly T[], ehAgente: (i: T) => boolean): { pessoas: T[]; agentes: T[] } {
  const pessoas: T[] = [];
  const agentes: T[] = [];
  for (const i of itens) (ehAgente(i) ? agentes : pessoas).push(i);
  return { pessoas, agentes };
}

/** Uma opção de seletor de pessoa, qualquer que seja a forma que a tela use. */
export interface PessoaOpcao {
  valor: string;
  rotulo: string;
  /** Marca explícita do dado; ausente = decidir pelo nome. */
  ehAgente?: boolean | null;
}

/**
 * Aceita as formas que os seletores do produto usam — nome puro (desenhos),
 * `{ v, l }` (desenhos), `{ id, nome }` (consultas) e `{ value, label }` — e
 * devolve sempre `PessoaOpcao`. Um lugar só para a forma do dado.
 */
export function pessoaOpcao(item: unknown): PessoaOpcao {
  if (typeof item === "string") return { valor: item, rotulo: item };
  const o = (item ?? {}) as Record<string, unknown>;
  const valor = String(o.v ?? o.value ?? o.id ?? o.nome ?? o.l ?? o.label ?? "");
  const rotulo = String(o.l ?? o.label ?? o.nome ?? valor);
  const marca = o.ehAgente;
  return { valor, rotulo, ehAgente: typeof marca === "boolean" ? marca : null };
}
