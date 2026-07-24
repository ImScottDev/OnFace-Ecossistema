/**
 * Backfill HISTÓRICO da tabela mrr_movimentos a partir do espelho de assinaturas.
 * Roda UMA vez (idempotente: pula assinatura que já tem movimento).
 *
 *   npx tsx src/scripts/backfill-mrr-movimentos.ts
 *
 * Regras (mesmas do sync go-forward):
 *  - 'novo' em iniciada_em pra toda assinatura que já foi cobrável
 *    (active | past_due | trialing | canceled). incomplete/_expired NUNCA gerou
 *    receita → fica de fora.
 *  - 'churn' em cancelada_em pras canceladas (delta = -mrr).
 *  - Limitação honesta: expansão/contração histórica não é reconstruível pelo
 *    espelho (só guarda o MRR final) — o go-forward captura daqui pra frente.
 */
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const resultado = (await db.execute(sql`
    WITH elegiveis AS (
      SELECT a.id, a.organizacao_id, a.lead_id, a.contrato_id, a.mrr, a.status,
             COALESCE(a.iniciada_em, a.created_at) AS iniciada_em, a.cancelada_em
      FROM assinaturas a
      WHERE a.status IN ('active', 'past_due', 'trialing', 'canceled')
        AND COALESCE(a.mrr, 0) > 0
        AND NOT EXISTS (SELECT 1 FROM mrr_movimentos m WHERE m.assinatura_id = a.id)
    ),
    novos AS (
      INSERT INTO mrr_movimentos (organizacao_id, lead_id, assinatura_id, contrato_id, produto, tipo, delta, mrr_antes, mrr_depois, ocorrido_em, origem)
      SELECT organizacao_id, lead_id, id, contrato_id, 'ai', 'novo', mrr, 0, mrr, iniciada_em, 'backfill'
      FROM elegiveis
      RETURNING 1
    ),
    churns AS (
      INSERT INTO mrr_movimentos (organizacao_id, lead_id, assinatura_id, contrato_id, produto, tipo, delta, mrr_antes, mrr_depois, ocorrido_em, origem)
      SELECT organizacao_id, lead_id, id, contrato_id, 'ai', 'churn', -mrr, mrr, 0, COALESCE(cancelada_em, now()), 'backfill'
      FROM elegiveis WHERE status = 'canceled'
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM novos)::int AS novos, (SELECT count(*) FROM churns)::int AS churns
  `)) as unknown as { novos: number; churns: number }[];

  console.log(`[Backfill MRR] ${resultado[0]?.novos ?? 0} movimentos 'novo', ${resultado[0]?.churns ?? 0} 'churn'`);

  // Sanidade: MRR reconstruído vs MRR do espelho
  const [check] = (await db.execute(sql`
    SELECT
      (SELECT COALESCE(sum(delta), 0) FROM mrr_movimentos)::float AS reconstruido,
      (SELECT COALESCE(sum(mrr), 0) FROM assinaturas WHERE status IN ('active', 'past_due', 'trialing'))::float AS espelho
  `)) as unknown as { reconstruido: number; espelho: number }[];
  console.log(`[Backfill MRR] sanidade: reconstruído R$ ${check.reconstruido.toFixed(2)} × espelho R$ ${check.espelho.toFixed(2)} (diff ${(check.reconstruido - check.espelho).toFixed(2)})`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
