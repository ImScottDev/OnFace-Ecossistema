import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { doCrm } from "@/lib/financeiro/espelho-crm";

export async function consultarQualidadeDados(org: string) {
  const [faturamento, financeiro, legado] = await Promise.all([
    db.execute<{
      competencia: string | null;
      atualizado_em: string | null;
      linhas: number;
      mrr_competencia: string;
      pagantes: number;
      pagantes_sem_contrato: number;
      valor_sem_contrato: string;
      linhas_sem_empresa: number;
      valor_sem_empresa: string;
      familia_desconhecida: number;
      valor_familia_desconhecida: string;
    }>(sql`
      WITH uc AS (
        SELECT max(competencia) AS competencia
        FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid
      ), mes AS (
        SELECT r.* FROM cliente_receita_mensal r CROSS JOIN uc
        WHERE r.organizacao_id = ${org}::uuid AND r.competencia=uc.competencia
      ), pagantes AS (
        SELECT r.empresa_id, sum(r.valor) AS valor
        FROM mes r WHERE r.revenue_nature='MRR' AND r.empresa_id IS NOT NULL
        GROUP BY r.empresa_id
      ), descobertos AS (
        SELECT p.valor FROM pagantes p WHERE NOT EXISTS (
          SELECT 1 FROM contratos c
          WHERE c.organizacao_id=${org}::uuid AND c.empresa_id=p.empresa_id
        )
      )
      SELECT (SELECT competencia::text FROM uc) AS competencia,
        (SELECT max(updated_at)::text FROM mes) AS atualizado_em,
        (SELECT count(*)::int FROM mes) AS linhas,
        (SELECT COALESCE(sum(valor),0)::text FROM mes WHERE revenue_nature='MRR') AS mrr_competencia,
        (SELECT count(*)::int FROM pagantes) AS pagantes,
        (SELECT count(*)::int FROM descobertos) AS pagantes_sem_contrato,
        (SELECT COALESCE(sum(valor),0)::text FROM descobertos) AS valor_sem_contrato,
        (SELECT count(*)::int FROM mes WHERE empresa_id IS NULL) AS linhas_sem_empresa,
        (SELECT COALESCE(sum(valor),0)::text FROM mes WHERE empresa_id IS NULL) AS valor_sem_empresa,
        (SELECT count(*)::int FROM mes WHERE service_family IS NULL OR service_family='UNKNOWN') AS familia_desconhecida,
        (SELECT COALESCE(sum(valor),0)::text FROM mes WHERE service_family IS NULL OR service_family='UNKNOWN') AS valor_familia_desconhecida
    `),
    db.execute<{
      assinaturas_ativas: number;
      assinaturas_sem_empresa: number;
      assinaturas_sem_servico: number;
      faturas_pagas: number;
      faturas_sem_pagamento: number;
      valor_faturas_sem_pagamento: string;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM assinaturas a WHERE a.organizacao_id=${org}::uuid
          AND a.status='active' AND ${doCrm("a")}) AS assinaturas_ativas,
        (SELECT count(*)::int FROM assinaturas a WHERE a.organizacao_id=${org}::uuid
          AND a.status='active' AND ${doCrm("a")} AND a.empresa_id IS NULL) AS assinaturas_sem_empresa,
        (SELECT count(*)::int FROM assinaturas a WHERE a.organizacao_id=${org}::uuid
          AND a.status='active' AND ${doCrm("a")} AND a.servico_id IS NULL) AS assinaturas_sem_servico,
        (SELECT count(*)::int FROM faturas f WHERE f.organizacao_id=${org}::uuid
          AND f.status='paga' AND ${doCrm("f")}) AS faturas_pagas,
        (SELECT count(*)::int FROM faturas f WHERE f.organizacao_id=${org}::uuid
          AND f.status='paga' AND ${doCrm("f")}
          AND NOT EXISTS (SELECT 1 FROM pagamentos p
              WHERE p.organizacao_id=${org}::uuid AND p.fatura_id=f.id)) AS faturas_sem_pagamento,
        (SELECT COALESCE(sum(f.valor),0)::text FROM faturas f
          WHERE f.organizacao_id=${org}::uuid AND f.status='paga'
          AND ${doCrm("f")} AND NOT EXISTS
          (SELECT 1 FROM pagamentos p
            WHERE p.organizacao_id=${org}::uuid AND p.fatura_id=f.id)) AS valor_faturas_sem_pagamento
    `),
    db.execute<{
      contratos_total: number;
      contratos_sem_empresa: number;
      contratos_com_anexos_legados: number;
      lotes_fechados_pendentes: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM contratos c WHERE c.organizacao_id=${org}::uuid) AS contratos_total,
        (SELECT count(*)::int FROM contratos c WHERE c.organizacao_id=${org}::uuid AND c.empresa_id IS NULL) AS contratos_sem_empresa,
        (SELECT count(DISTINCT a.entidade_id)::int FROM anexos_legado a
          WHERE a.organizacao_id=${org}::uuid AND a.entidade_tipo='contrato'
          AND a.categoria='documento_assinado') AS contratos_com_anexos_legados,
        (SELECT count(DISTINCT b.id)::int FROM service_ledger_batches b
          JOIN service_ledger_entries e ON e.batch_id=b.id
          WHERE b.organizacao_id=${org}::uuid AND e.organizacao_id=${org}::uuid
          AND b.status='CLOSED' AND (e.confidence!='CONFIRMED'
            OR e.revenue_nature='UNKNOWN' OR e.service_family='UNKNOWN'
            OR e.service_id IS NULL)) AS lotes_fechados_pendentes
    `),
  ]);

  return {
    corte: new Date().toISOString(),
    fonte: "CRM / Service Ledger da organização autenticada",
    competencia: faturamento[0]?.competencia ?? null,
    atualizadoEm: faturamento[0]?.atualizado_em ?? null,
    historico: faturamento[0] ?? null,
    financeiro: financeiro[0] ?? null,
    legado: legado[0] ?? null,
    aviso: "Valores do faturamento são por competência. Caixa só é comprovado por pagamentos; PDFs legados exigem confirmação física em cada ambiente.",
  };
}
