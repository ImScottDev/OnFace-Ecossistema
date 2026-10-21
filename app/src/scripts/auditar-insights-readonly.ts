/**
 * Inventário de integridade para Insights: SOMENTE SELECT, em transação READ ONLY.
 * Execução: pnpm exec tsx --env-file=.env src/scripts/auditar-insights-readonly.ts
 * Nunca faz UPDATE, migração, commit, exportação de PII ou chamada Stripe.
 * O ambiente é o da DATABASE_URL explicitamente configurada pelo operador.
 */
import postgres from "postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { mrrOficialLinhas } from "@/lib/metricas/mrr-oficial";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente");
const connection = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });

async function main() {
  try {
    const resultado = await connection.begin("read only", async (db) => {
      const [competencia] = await db`
        SELECT max(competencia)::text AS ultima, count(*)::int AS linhas,
               count(DISTINCT organizacao_id)::int AS organizacoes
        FROM cliente_receita_mensal
      `;
      const [mes] = await db`
        WITH ultimo AS (SELECT max(competencia) competencia FROM cliente_receita_mensal)
        SELECT
          count(*)::int AS linhas,
          count(DISTINCT empresa_id)::int AS empresas_identificadas,
          count(*) FILTER (WHERE empresa_id IS NULL)::int AS linhas_sem_empresa,
          COALESCE(sum(valor),0)::numeric(16,2)::text AS faturamento_total,
          COALESCE(sum(valor) FILTER (WHERE revenue_nature = 'MRR'),0)::numeric(16,2)::text AS receita_mrr,
          COALESCE(sum(valor) FILTER (WHERE revenue_nature <> 'MRR'),0)::numeric(16,2)::text AS receita_nao_mrr,
          COALESCE(sum(valor) FILTER (WHERE empresa_id IS NULL AND revenue_nature = 'MRR'),0)::numeric(16,2)::text AS mrr_sem_empresa,
          count(*) FILTER (WHERE revenue_nature='UNKNOWN')::int AS linhas_natureza_indefinida,
          count(*) FILTER (WHERE service_family='UNKNOWN')::int AS linhas_familia_indefinida
        FROM cliente_receita_mensal r, ultimo
        WHERE r.competencia = ultimo.competencia
      `;
      const [lacunas] = await db`
        WITH ultimo AS (SELECT max(competencia) competencia FROM cliente_receita_mensal),
        pagantes AS (
          SELECT r.organizacao_id, r.empresa_id, sum(r.valor) AS valor
          FROM cliente_receita_mensal r, ultimo
          WHERE r.competencia=ultimo.competencia AND r.revenue_nature='MRR' AND r.empresa_id IS NOT NULL
          GROUP BY 1,2
        ), ligadas AS (
          SELECT p.*, EXISTS (
            SELECT 1 FROM contratos c WHERE c.empresa_id=p.empresa_id AND c.organizacao_id=p.organizacao_id
          ) AS tem_contrato
          FROM pagantes p
        )
        SELECT count(*)::int AS empresas_pagantes_identificadas,
               count(*) FILTER (WHERE NOT tem_contrato)::int AS pagantes_sem_contrato,
               COALESCE(sum(valor) FILTER (WHERE NOT tem_contrato),0)::numeric(16,2)::text AS mrr_pagantes_sem_contrato
        FROM ligadas
      `;
      const [contratos] = await db`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE zoho_id IS NOT NULL)::int AS com_id_zoho,
               count(*) FILTER (WHERE empresa_id IS NULL)::int AS sem_empresa,
               count(*) FILTER (WHERE signature_status='signed' OR assinatura_status='assinado')::int AS marcados_assinados,
               count(*) FILTER (WHERE documento_final_url IS NOT NULL)::int AS com_documento_final_url,
               count(*) FILTER (WHERE assinatura_status='assinado' AND signature_provider_ref IS NULL)::int AS assinado_sem_referencia_provider
        FROM contratos
      `;
      const lotes = await db`
        SELECT status, count(*)::int AS lotes, COALESCE(sum(row_count),0)::int AS linhas,
               COALESCE(sum(imported_total),0)::numeric(16,2)::text AS valor
        FROM service_ledger_batches GROUP BY status ORDER BY status
      `;
      const inconsistencias = await db`
        SELECT b.status, count(*) FILTER (WHERE e.confidence <> 'CONFIRMED' OR e.revenue_nature='UNKNOWN')::int AS linhas_pendentes
        FROM service_ledger_batches b JOIN service_ledger_entries e ON e.batch_id=b.id
        GROUP BY b.status ORDER BY b.status
      `;
      const [contratosStatus] = await db`
        SELECT count(*) FILTER (WHERE status='ativo')::int AS ativos,
               COALESCE(sum(mrr) FILTER (WHERE status='ativo'),0)::numeric(16,2)::text AS total_bruto_contratos_ativos
        FROM contratos
      `;
      // Indicador de possível subcontagem: assinatura de outra família ativa em
      // empresa que já faturou MRR de um serviço diferente na competência.
      const [assinaturasFamiliaNova] = await db`
        WITH uc AS (SELECT organizacao_id, max(competencia) AS competencia
          FROM cliente_receita_mensal GROUP BY organizacao_id),
        pagas AS (SELECT DISTINCT r.organizacao_id, r.empresa_id,
          COALESCE(r.service_family, 'UNKNOWN') AS familia
          FROM cliente_receita_mensal r JOIN uc ON uc.organizacao_id=r.organizacao_id
            AND uc.competencia=r.competencia
          WHERE r.revenue_nature='MRR' AND r.empresa_id IS NOT NULL),
        ativas AS (SELECT a.organizacao_id, a.empresa_id, a.mrr,
            COALESCE(sc.service_family,'UNKNOWN') AS familia
          FROM assinaturas a LEFT JOIN servicos_canonicos sc ON sc.id=a.servico_id
          WHERE a.status='active' AND a.fora_do_espelho_em IS NULL
            AND a.empresa_id IN (SELECT empresa_id FROM clientes
                                  WHERE organizacao_id=a.organizacao_id))
        SELECT count(*)::int AS assinaturas_ativas_familia_sem_faturamento,
          COALESCE(sum(a.mrr),0)::numeric(16,2)::text AS valor_potencial_em_discussao,
          count(*) FILTER (WHERE a.familia='UNKNOWN')::int AS sem_familia_confirmada,
          COALESCE(sum(a.mrr) FILTER (WHERE a.familia='UNKNOWN'),0)::numeric(16,2)::text AS valor_sem_familia,
          count(*) FILTER (WHERE a.familia='CALLFACE_AI')::int AS callface_ai,
          count(*) FILTER (WHERE a.familia='PABX')::int AS pabx,
          count(*) FILTER (WHERE a.familia='WHITE_LABEL')::int AS white_label
        FROM ativas a
        WHERE EXISTS (SELECT 1 FROM pagas p WHERE p.organizacao_id=a.organizacao_id
           AND p.empresa_id=a.empresa_id)
          AND NOT EXISTS (SELECT 1 FROM pagas p WHERE p.organizacao_id=a.organizacao_id
           AND p.empresa_id=a.empresa_id AND p.familia=a.familia)
      `;
      const [org] = await db`
        SELECT organizacao_id::text FROM cliente_receita_mensal ORDER BY competencia DESC LIMIT 1
      `;
      // Renderiza a SQL de produção do Catálogo, mas executa a consulta somente
      // sobre este snapshot local dentro da transação READ ONLY.
      const fonteOficial = org ? new PgDialect().sqlToQuery(mrrOficialLinhas(org.organizacao_id)) : null;
      const familiasMrr = fonteOficial ? await db.unsafe(
        `SELECT familia, origem, count(*)::int AS linhas,
                COALESCE(sum(valor),0)::numeric(16,2)::text AS total
           FROM (${fonteOficial.sql}) linhas GROUP BY familia, origem ORDER BY familia, origem`,
        fonteOficial.params as Array<string | number | boolean | null>,
      ) : [];
      return { competencia, mes, lacunas, contratos, contratosStatus, lotes, inconsistencias, assinaturasFamiliaNova, familiasMrr };
    });
    console.log(JSON.stringify({
      tipo: "AUDITORIA_SOMENTE_LEITURA",
      fonte: "DATABASE_URL configurada no ambiente, sem inferir que é PROD",
      horario: new Date().toISOString(),
      ...resultado,
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error("Falha na auditoria read-only:", e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
