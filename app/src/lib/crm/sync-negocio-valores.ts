import { db } from "@/lib/db";
import { negocios, propostas, propostaItens } from "@/lib/db/schema";
import { eq, and, notInArray, sql } from "drizzle-orm";

/**
 * Recalculates negocio financial fields (mrrEstimado, valorProjeto, valorTotal)
 * from all non-rejected/expired propostas linked to it.
 * Call this after any proposta mutation (create, update, delete, accept, reject).
 */
export async function syncNegocioValoresFromPropostas(negocioId: string) {
  const [totals] = await db
    .select({
      totalRecorrente: sql<string>`COALESCE(SUM(CASE WHEN ${propostaItens.tipo} = 'recorrente' THEN ${propostaItens.subtotal} ELSE 0 END), 0)`,
      totalAvulso: sql<string>`COALESCE(SUM(CASE WHEN ${propostaItens.tipo} IN ('avulso', 'setup') THEN ${propostaItens.subtotal} ELSE 0 END), 0)`,
      totalGeral: sql<string>`COALESCE(SUM(${propostaItens.subtotal}), 0)`,
    })
    .from(propostaItens)
    .innerJoin(propostas, eq(propostaItens.propostaId, propostas.id))
    .where(
      and(
        eq(propostas.negocioId, negocioId),
        notInArray(propostas.status, ["recusada", "expirada"]),
      )
    );

  await db
    .update(negocios)
    .set({
      mrrEstimado: totals.totalRecorrente,
      valorProjeto: totals.totalAvulso,
      valorTotal: totals.totalGeral,
      updatedAt: new Date(),
    })
    .where(eq(negocios.id, negocioId));
}
