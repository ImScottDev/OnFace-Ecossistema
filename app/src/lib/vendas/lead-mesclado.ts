import { sql } from "drizzle-orm";

/**
 * "Este registro foi mesclado em outro" é UM critério só, para toda consulta que
 * lista ou conta gente: o lead com `canonical_lead_id` é duplicata de outro lead
 * (mescla de 13/10, `scripts/mesclar-duplicados-meta-rd.sh`), e a pessoa que veio
 * dele também. Listar ou contar um desses mostra a mesma pessoa duas vezes.
 * Sem `db`: serve a qualquer consulta e ao teste.
 */

/** A pessoa `<alias>` NÃO veio de lead mesclado. `alias` é literal do código, nunca entrada. */
export const pessoaNaoMesclada = (alias: "p" | "p2") =>
  sql.raw(`NOT EXISTS (SELECT 1 FROM leads lm WHERE lm.id = ${alias}.lead_id_legado AND lm.canonical_lead_id IS NOT NULL)`);

/** O lead `<alias>` não é duplicata de outro lead. */
export const leadNaoMesclado = (alias: "l" | "l2") => sql.raw(`${alias}.canonical_lead_id IS NULL`);
