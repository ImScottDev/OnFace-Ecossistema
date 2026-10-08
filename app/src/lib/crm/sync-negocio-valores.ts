import { db } from "@/lib/db";
import { negocios } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

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
  /* Uma proposta é uma SÉRIE (o mesmo `numero`, versões v1, v2…): só a versão mais nova que
     não foi recusada nem substituída vale. Somar as versões dobrava o valor quando existia
     um rascunho v2 ao lado da v1 aceita, e o cartão, a lista e o detalhe passavam a
     mostrar números diferentes para a mesma venda. */
  const [totals] = await db.execute<{ totalRecorrente: string; totalAvulso: string; totalGeral: string }>(sql`
    WITH vigentes AS (
      SELECT DISTINCT ON (p.numero) p.id
        FROM propostas p
       WHERE p.negocio_id = ${negocioId}::uuid AND p.status NOT IN ('recusada', 'substituida')
       ORDER BY p.numero, p.versao DESC
    )
    SELECT COALESCE(SUM(CASE WHEN i.tipo = 'recorrente' THEN i.subtotal ELSE 0 END), 0)::text AS "totalRecorrente",
           COALESCE(SUM(CASE WHEN i.tipo IN ('avulso', 'setup') THEN i.subtotal ELSE 0 END), 0)::text AS "totalAvulso",
           COALESCE(SUM(i.subtotal), 0)::text AS "totalGeral"
      FROM proposta_itens i JOIN vigentes v ON v.id = i.proposta_id`);

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
