import { db } from "@/lib/db";
import { negocios, propostas, propostaItens } from "@/lib/db/schema";
import { eq, and, notInArray, sql } from "drizzle-orm";

/**
 * Recalculates negocio financial fields (mrrEstimado, valorProjeto, valorTotal)
 * from all non-rejected propostas linked to it.
 *
 * "expirada" NÃO entra na exclusão (achado real 25/08, Kauã): expirar é só
 * a proposta ter passado da validade sem resposta — o negócio continua
 * aberto e o valor estimado continua valendo pra pipeline/forecast. Excluir
 * junto com "recusada" zerava mrrEstimado/valorTotal de negócios cuja única
 * proposta expirou, quebrando o cálculo mostrado no board. Só "recusada" é
 * sinal real de que o cliente disse não àquele valor.
 *
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
        notInArray(propostas.status, ["recusada"]),
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
