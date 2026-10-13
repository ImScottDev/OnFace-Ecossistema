/**
 * Resolve UUIDs que vazam no texto da linha do tempo para nomes.
 *
 * O histórico já gravado traz `de`/`para` com id de usuário (troca de
 * responsável) e o escritor pode gravar id em qualquer chave de contexto. Em vez
 * de reescrever o passado, a leitura troca todo UUID de valor do contexto pelo
 * nome da entidade, filtrando por organização. Id sem entidade vira
 * "(removido)": nunca o UUID cru.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const REMOVIDO = "(removido)";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_SOLTO = /(?<![\w/=-])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![\w-])/gi;

/** Ids (únicos) em valores de primeiro nível do contexto. */
export function idsDoContexto(contextos: Array<Record<string, unknown> | null>): string[] {
  const ids = new Set<string>();
  for (const c of contextos) for (const v of Object.values(c ?? {})) if (typeof v === "string" && UUID.test(v)) ids.add(v.toLowerCase());
  return [...ids];
}

/** Cópia do contexto com cada UUID trocado pelo nome (ou "(removido)"). */
export function contextoComNomes(c: Record<string, unknown> | null, nomes: Map<string, string>): Record<string, unknown> | null {
  if (!c) return c;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) out[k] = typeof v === "string" && UUID.test(v) ? (nomes.get(v.toLowerCase()) ?? REMOVIDO) : v;
  return out;
}

/** Último filtro: UUID que sobrou num texto pronto (não toca em URL). */
export function semUuidCru(texto: string | null): string | null {
  return texto == null ? texto : texto.replace(UUID_SOLTO, REMOVIDO);
}

/** Nome de cada id em lote: uma consulta por tipo de entidade, sempre por organização. */
export async function resolverNomes(organizacaoId: string, ids: string[]): Promise<Map<string, string>> {
  const nomes = new Map<string, string>();
  if (ids.length === 0) return nomes;
  const lista = sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `);
  const org = sql`organizacao_id = ${organizacaoId}::uuid`;
  const consultas = [
    sql`SELECT id::text, nome FROM usuarios WHERE ${org} AND id IN (${lista})`,
    sql`SELECT id::text, nome FROM empresas WHERE ${org} AND id IN (${lista})`,
    sql`SELECT id::text, nome FROM pessoas WHERE ${org} AND id IN (${lista})`,
    sql`SELECT id::text, nome FROM leads WHERE ${org} AND id IN (${lista})`,
    sql`SELECT id::text, 'Proposta #' || numero AS nome FROM propostas WHERE ${org} AND id IN (${lista})`,
    sql`SELECT id::text, titulo AS nome FROM negocios WHERE ${org} AND id IN (${lista})`,
    sql`SELECT id::text, titulo AS nome FROM oportunidades WHERE ${org} AND id IN (${lista})`,
  ];
  const resultados = await Promise.all(consultas.map((q) => db.execute<{ id: string; nome: string | null }>(q)));
  for (const linhas of resultados) for (const l of linhas) if (l.nome && !nomes.has(l.id)) nomes.set(l.id, l.nome);
  return nomes;
}
