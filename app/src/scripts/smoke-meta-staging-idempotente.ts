/**
 * Reentrega de webhook da Meta não duplica o staging.
 *
 * A Meta reentrega o webhook quando não recebe 200 a tempo. Até 22/09
 * `/api/webhooks/meta-lead-ids` inseria em `meta_lead_staging` sem marca de
 * idempotência, e a tabela só tinha PK no `id`: cada reentrega criava uma
 * linha nova para o mesmo `fb_lead_id`. A migration 0090 removeu **18
 * duplicatas reais** ao criar o índice único.
 *
 * Prova as duas metades: repetir não duplica, e repetir não vira erro — que é
 * o modo de falha novo que o índice sozinho teria criado, provocando ainda
 * mais reentrega.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-meta-staging-idempotente.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { metaLeadStaging } from "@/lib/db/schema";

const PREFIXO = "smoke-staging-";
let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

async function limpar() {
  await db.execute(sql`DELETE FROM meta_lead_staging WHERE fb_lead_id LIKE ${PREFIXO + "%"}`).catch(() => undefined);
}

async function main() {
  await limpar();
  const fbLeadId = `${PREFIXO}${Date.now()}`;
  const linha = {
    fbLeadId, email: `${fbLeadId}@exemplo.test`, telefone: "11900000000",
    adId: "ad-1", adsetId: "adset-1", campaignId: "camp-1",
    adName: "Anúncio", adsetName: "Conjunto", campaignName: "Campanha",
  };
  const contar = async () => {
    const [r] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM meta_lead_staging WHERE fb_lead_id = ${fbLeadId}`);
    return r?.n ?? 0;
  };

  console.log("═══ primeira entrega grava ═══");
  await db.insert(metaLeadStaging).values(linha).onConflictDoNothing();
  ok(await contar() === 1, "o lead da Meta entra no staging");

  console.log("\n═══ reentrega não duplica, e não falha ═══");
  let erro: unknown = null;
  try {
    await db.insert(metaLeadStaging).values(linha).onConflictDoNothing();
    await db.insert(metaLeadStaging).values(linha).onConflictDoNothing();
  } catch (e) { erro = e; }
  ok(erro === null, "reentregar não levanta erro — senão a Meta reentregaria ainda mais");
  ok(await contar() === 1, `duas reentregas mantêm 1 linha (${await contar()})`);

  console.log("\n═══ a trava é do banco, não só do código ═══");
  // Sem o `onConflict`, o índice único precisa recusar. É o que garante a
  // idempotência mesmo se outro caminho inserir direto.
  let recusou = false;
  try {
    await db.insert(metaLeadStaging).values(linha);
  } catch { recusou = true; }
  ok(recusou, "inserir sem onConflict é recusado pelo índice único");
  ok(await contar() === 1, "e a linha continua única");

  await limpar();
  const [resto] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM meta_lead_staging WHERE fb_lead_id LIKE ${PREFIXO + "%"}`);
  ok(resto.n === 0, `o smoke não deixa resíduo (${resto.n})`);

  console.log(saida === 0 ? "\nstaging da Meta idempotente: ok\n" : "\nstaging da Meta idempotente: FALHOU\n");
}

main()
  .then(() => process.exit(saida))
  .catch(async (e) => { console.error(e); await limpar(); process.exit(1); });
