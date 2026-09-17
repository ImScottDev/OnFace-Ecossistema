import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";

/**
 * GET /api/financeiro/churn?meses=6
 *
 * Payload da aba "Churn & Cancelamentos": lista de quem cancelou (com motivo,
 * MRR perdido, voluntário × involuntário) + tendência mês a mês.
 */
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (!isAdminView(ctx.userRole)) return forbiddenResponse();
  const orgId = ctx.organizacaoId;
  const meses = Math.min(24, Math.max(1, parseInt(request.nextUrl.searchParams.get("meses") || "6", 10)));

  const lista = (await db.execute(sql`
    SELECT a.id, l.id AS lead_id, l.nome, e.nome AS empresa,
      COALESCE(a.produto, 'sem plano') AS plano,
      a.mrr::float, a.cancelada_em, a.iniciada_em,
      a.motivo_cancelamento,
      CASE
        WHEN a.motivo_cancelamento LIKE 'payment_failed%' THEN 'involuntario'
        WHEN a.motivo_cancelamento LIKE 'cancellation_requested%' THEN 'voluntario'
        ELSE 'sem_motivo' END AS categoria,
      GREATEST(0, EXTRACT(day FROM a.cancelada_em - a.iniciada_em) / 30.0)::float AS meses_de_vida,
      COALESCE((SELECT sum(f.valor) FROM faturas f WHERE f.assinatura_id = a.id AND f.status = 'paga'), 0)::float AS total_pago
    FROM assinaturas a
    LEFT JOIN leads l ON l.id = a.lead_id
    LEFT JOIN empresas e ON e.id = l.empresa_id
    WHERE (a.organizacao_id = ${orgId} OR a.organizacao_id IS NULL)
      AND a.status = 'canceled' AND a.cancelada_em IS NOT NULL
    ORDER BY a.cancelada_em DESC
    LIMIT 300
  `)) as unknown as Record<string, unknown>[];

  const tendencia = (await db.execute(sql`
    SELECT to_char(date_trunc('month', a.cancelada_em), 'YYYY-MM') AS mes,
      count(*)::int AS logos,
      COALESCE(sum(a.mrr), 0)::float AS mrr,
      count(*) FILTER (WHERE a.motivo_cancelamento LIKE 'payment_failed%')::int AS involuntarios,
      count(*) FILTER (WHERE a.motivo_cancelamento LIKE 'cancellation_requested%')::int AS voluntarios
    FROM assinaturas a
    WHERE (a.organizacao_id = ${orgId} OR a.organizacao_id IS NULL)
      AND a.status = 'canceled'
      AND a.cancelada_em >= date_trunc('month', now()) - make_interval(months => ${meses - 1})
    GROUP BY 1 ORDER BY 1
  `)) as unknown as Record<string, unknown>[];

  return NextResponse.json({
    lista: lista.map((r) => ({
      id: r.id,
      leadId: r.lead_id,
      nome: r.nome,
      empresa: r.empresa,
      plano: r.plano,
      mrr: Number(r.mrr) || 0,
      canceladaEm: r.cancelada_em,
      mesesDeVida: Math.round((Number(r.meses_de_vida) || 0) * 10) / 10,
      totalPago: Number(r.total_pago) || 0,
      motivo: r.motivo_cancelamento || null,
      categoria: r.categoria,
    })),
    tendencia: tendencia.map((r) => ({
      mes: r.mes,
      logos: Number(r.logos) || 0,
      mrr: Number(r.mrr) || 0,
      voluntarios: Number(r.voluntarios) || 0,
      involuntarios: Number(r.involuntarios) || 0,
      semMotivo: (Number(r.logos) || 0) - (Number(r.voluntarios) || 0) - (Number(r.involuntarios) || 0),
    })),
  });
}
