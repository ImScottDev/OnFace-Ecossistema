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
export async function syncNegocioValoresFromPropostas(
  negocioId: string,
  { tocarRelogio = true }: { tocarRelogio?: boolean } = {},
) {
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
        // "substituida" fora: a revisão copia os itens da versão anterior, e contar as
        // duas dobrava o valor do negócio a cada nova versão enviada.
        notInArray(propostas.status, ["recusada", "substituida"]),
      )
    );

  await db
    .update(negocios)
    .set({
      mrrEstimado: totals.totalRecorrente,
      valorProjeto: totals.totalAvulso,
      valorTotal: totals.totalGeral,
      // O relógio só anda quando há trabalho por trás da chamada.
      //
      // As rotas chamam este sync DENTRO de uma ação real (mudar o status do
      // negócio, criar ou excluir proposta), e nesses casos bumpar está certo.
      // O lote é outra história: `repair-negocios-valor-expirada` recalcula
      // todos os negócios com proposta expirada, e medido em 22/09 são **372
      // negócios, 107 deles abertos**, com datas de 20/07 a 22/09. Rodar o
      // reparo com o bump ligado jogaria os 107 para o topo do Pipeline de uma
      // vez e apagaria a ordem real — o mesmo defeito que já custou 216 leads
      // no board de Pré-vendas.
      ...(tocarRelogio ? { updatedAt: new Date() } : {}),
    })
    .where(eq(negocios.id, negocioId));

  // O board lê `oportunidades`, não `negocios`: sem o espelho o card seguia com o
  // valor antigo até a próxima mudança de etapa (proposta criada/revisada e o
  // total do card e da coluna não mexiam). Best-effort: o valor já está gravado.
  // Lote de reparo (tocarRelogio=false) não espelha: o espelho também bumpa o relógio.
  if (tocarRelogio) await import("@/lib/crm/sync-domain-model")
    .then((m) => m.syncOportunidadeFromNegocio(negocioId))
    .catch((e) => console.error("[sync-negocio-valores] espelho do valor falhou:", e));
}
