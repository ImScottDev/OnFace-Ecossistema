import { doCrm } from "@/lib/financeiro/espelho-crm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";

/**
 * GET /api/financeiro/vendas?visao=cliente|fatura&produto=todos|pabx|ai&status=&q=
 *
 * Visão de vendas/faturamento (inspirada no CRM KOKO — "Por aluno"/"Por parcela"):
 *  - visao=cliente: agregado por cliente (total, faturas x/y, status consolidado)
 *  - visao=fatura: cada fatura individual
 */
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  // Gate por PERMISSÃO, não por cargo (SPEC §31). `isAdminView` responde
  // "é gestão?"; esta pergunta é "pode fazer isto?", que é o que permite
  // separar leitura de escrita e delegar para agente sem dar tudo.
  if (!(await temPermissao({ usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" }, "finance.read"))) {
    return forbiddenResponse();
  }
  const orgId = ctx.organizacaoId;
  const sp = request.nextUrl.searchParams;
  const visao = sp.get("visao") || "cliente";
  const produto = sp.get("produto") || "todos";
  const status = sp.get("status") || "";
  const q = (sp.get("q") || "").trim();

  const prodFat = produto === "pabx" ? sql` AND f.origem = 'pabx'`
    : produto === "ai" ? sql` AND f.origem = 'stripe'` : sql``;
  const statusFat = status ? sql` AND f.status = ${status}` : sql``;
  const buscaSql = q
    ? sql` AND (l.nome ILIKE ${"%" + q + "%"} OR l.email ILIKE ${"%" + q + "%"} OR e.nome ILIKE ${"%" + q + "%"})`
    : sql``;

  if (visao === "fatura") {
    const rows = (await db.execute(sql`
      SELECT f.id, l.id AS lead_id, l.nome, l.email, e.nome AS empresa,
        CASE WHEN f.origem = 'stripe' THEN 'ai' ELSE 'pabx' END AS produto,
        f.valor::float, f.status, f.competencia, f.emitida_em, f.paga_em, f.tentativas,
        f.vencimento, f.hosted_invoice_url,
        CASE WHEN f.status IN ('aberta', 'uncollectible')
             THEN GREATEST(0, EXTRACT(day FROM now() - COALESCE(f.vencimento, f.emitida_em)))::int
             ELSE 0 END AS dias_atraso
      FROM faturas f
      JOIN leads l ON l.id = f.lead_id
      LEFT JOIN empresas e ON e.id = l.empresa_id
      WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND ${doCrm("f")}${prodFat}${statusFat}${buscaSql}
      ORDER BY f.emitida_em DESC NULLS LAST
      LIMIT 1000
    `)) as unknown as Record<string, unknown>[];
    return NextResponse.json({ visao, rows });
  }

  const rows = (await db.execute(sql`
    SELECT l.id AS lead_id, l.nome, l.email, e.nome AS empresa,
      CASE WHEN f.origem = 'stripe' THEN 'ai' ELSE 'pabx' END AS produto,
      COALESCE(sum(f.valor), 0)::float AS valor_total,
      COALESCE(sum(f.valor) FILTER (WHERE f.status = 'paga'), 0)::float AS valor_pago,
      count(*) FILTER (WHERE f.status = 'paga')::int AS pagas,
      count(*)::int AS emitidas,
      CASE
        WHEN count(*) FILTER (WHERE f.status IN ('aberta', 'uncollectible')) > 0 THEN 'atrasado'
        WHEN count(*) FILTER (WHERE f.status = 'paga') = count(*) THEN 'completa'
        ELSE 'parcial'
      END AS status,
      max(f.emitida_em) AS ultima_fatura
    FROM faturas f
    JOIN leads l ON l.id = f.lead_id
    LEFT JOIN empresas e ON e.id = l.empresa_id
    WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND ${doCrm("f")}${prodFat}${statusFat}${buscaSql}
    GROUP BY l.id, l.nome, l.email, e.nome, f.origem
    ORDER BY valor_total DESC
    LIMIT 1000
  `)) as unknown as Record<string, unknown>[];
  return NextResponse.json({ visao, rows });
}
