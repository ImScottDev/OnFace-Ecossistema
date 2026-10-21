/**
 * Auditoria agregado/anonimizada CRM versus Stripe. SELECT somente leitura.
 * Executar com DATABASE_URL explícita. NUNCA considera a conta Stripe inteira
 * equivalente ao MRR da ONFACE: aplicar filtro fora_do_espelho_em.
 */
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não definida");
const connection = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });

async function main() {
  try {
    const dados = await connection.begin("read only", async (db) => {
      const assinaturas = await db`
        SELECT
          status, (fora_do_espelho_em IS NULL) AS dentro_do_crm,
          count(*)::int AS linhas,
          count(DISTINCT stripe_subscription_id)::int AS subscriptions,
          count(*) FILTER (WHERE empresa_id IS NULL)::int AS sem_empresa,
          count(*) FILTER (WHERE servico_id IS NULL)::int AS sem_servico,
          COALESCE(sum(mrr),0)::text AS mrr_espelho
        FROM assinaturas GROUP BY 1,2 ORDER BY 1,2
      `;
      const faturas = await db`
        SELECT
          f.status, (f.fora_do_espelho_em IS NULL) AS dentro_do_crm,
          count(*)::int AS linhas,
          count(*) FILTER (WHERE f.paga_em IS NOT NULL)::int AS com_data_paga,
          count(*) FILTER (WHERE p.fatura_id IS NOT NULL)::int AS com_pagamentos,
          count(*) FILTER (WHERE p.fatura_id IS NULL AND f.status IN ('paga','paid'))::int AS pagas_sem_pagamento,
          COALESCE(sum(f.valor),0)::text AS valor_face
        FROM faturas f
        LEFT JOIN (SELECT DISTINCT fatura_id FROM pagamentos WHERE fatura_id IS NOT NULL) p
          ON p.fatura_id=f.id
        GROUP BY 1,2 ORDER BY 1,2
      `;
      const pagamentos = await db`
        SELECT
          to_char(paid_at,'YYYY-MM') AS mes_do_pagamento,
          status, count(*)::int AS linhas,
          count(*) FILTER (WHERE fatura_id IS NULL)::int AS sem_fatura,
          COALESCE(sum(amount),0)::text AS valor_total
        FROM pagamentos WHERE paid_at IS NOT NULL
        GROUP BY 1,2 ORDER BY 1 DESC,2 LIMIT 25
      `;
      const idempotencia = await db`
        SELECT count(*)::int AS duplicidades
        FROM (SELECT provider,external_payment_id FROM pagamentos
          WHERE external_payment_id IS NOT NULL
          GROUP BY 1,2 HAVING count(*) > 1) d
      `;
      return { assinaturas, faturas, pagamentos, pagamentosDuplicados: Number(idempotencia[0]?.duplicidades ?? 0) };
    });
    console.log(JSON.stringify({
      classe: "AUDITORIA_LOCAL_SOMENTE_LEITURA",
      aviso: "A cópia do banco não é leitura atual da produção nem prova de caixa bancário.",
      instante: new Date().toISOString(), ...dados,
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Falha na auditoria de billing:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
