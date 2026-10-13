// Ponto único da regra da migration 0119: `assinaturas` e `faturas` espelham a conta Stripe
// COMPARTILHADA com o SaaS Callface. Linha com `fora_do_espelho_em` preenchida NÃO é do CRM e
// não entra em MRR, carteira, cobrança, Cliente 360 nem total nenhum.
//
// Toda LEITURA dessas duas tabelas usa um destes. O teste `espelho-crm.test.ts` falha se um
// arquivo ler as tabelas sem passar por aqui. Escritas, o sync do Stripe e os scripts de
// saneamento NÃO usam: eles precisam enxergar a linha marcada.
import { isNull, sql, type SQL } from "drizzle-orm";
import { assinaturas, faturas } from "@/lib/db/schema";

const ALIAS = /^[a-z_][a-z0-9_]*$/i;

/** SQL cru: `AND ${doCrm("f")}` vira `f.fora_do_espelho_em IS NULL`. Alias é identificador, nunca dado do usuário. */
export function doCrm(alias: string): SQL {
  if (!ALIAS.test(alias)) throw new Error(`alias inválido: ${alias}`);
  return sql.raw(`${alias}.fora_do_espelho_em IS NULL`);
}

/** Drizzle builder: `.where(and(..., assinaturaDoCrm))`. */
export const assinaturaDoCrm: SQL = isNull(assinaturas.foraDoEspelhoEm);
export const faturaDoCrm: SQL = isNull(faturas.foraDoEspelhoEm);
