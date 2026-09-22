/**
 * Reprocessa mrrEstimado/valorProjeto/valorTotal dos negócios afetados pelo
 * bug de sync-negocio-valores.ts (achado real 25/08, Kauã): antes desta
 * correção, `syncNegocioValoresFromPropostas` excluía propostas "expirada"
 * do somatório junto com "recusada" — quando a proposta expirava, o valor
 * do negócio zerava no board de Pipeline mesmo o negócio continuando aberto.
 *
 * Roda UMA vez (idempotente: reusa a função já corrigida, só recalcula os
 * negócios que têm ao menos 1 proposta "expirada" — população exatamente
 * afetada pelo bug antigo).
 *
 * NÃO TOCA O RELÓGIO. Medido em 22/09: o reparo alcança 372 negócios, 107 deles
 * abertos, com `updated_at` espalhado entre 20/07 e 22/09. Com o bump ligado,
 * os 107 iriam para o topo do Pipeline de uma vez e a ordem real se perderia —
 * o mesmo defeito que já custou 216 leads no board de Pré-vendas. Corrigir um
 * valor calculado errado não é trabalho feito no negócio.
 *
 *   npx tsx src/scripts/repair-negocios-valor-expirada.ts
 */
import { db } from "../lib/db";
import { propostas } from "../lib/db/schema";
import { isNotNull, sql } from "drizzle-orm";
import { syncNegocioValoresFromPropostas } from "../lib/crm/sync-negocio-valores";

async function main() {
  const afetados = await db
    .select({ negocioId: propostas.negocioId })
    .from(propostas)
    .where(sql`${propostas.status} = 'expirada' AND ${isNotNull(propostas.negocioId)}`)
    .groupBy(propostas.negocioId);

  console.log(`[repair-negocios-valor-expirada] ${afetados.length} negócio(s) com proposta expirada — recalculando...`);

  let ok = 0;
  let falhas = 0;
  for (const { negocioId } of afetados) {
    if (!negocioId) continue;
    try {
      await syncNegocioValoresFromPropostas(negocioId, { tocarRelogio: false });
      ok++;
    } catch (e) {
      falhas++;
      console.error(`[repair-negocios-valor-expirada] falha no negócio ${negocioId}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`[repair-negocios-valor-expirada] concluído: ${ok} recalculado(s), ${falhas} falha(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[repair-negocios-valor-expirada] erro fatal:", e);
  process.exit(1);
});
