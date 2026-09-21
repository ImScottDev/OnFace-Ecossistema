import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";

/**
 * GET /api/financeiro/inadimplencia?produto=todos|pabx|ai
 *
 * Inadimplência POR CONTRATO (decisão Scott 12/jun): cada linha é um contrato
 * (cliente com AI + PABX = duas linhas, cobranças diferentes não se misturam).
 *  - Valor = mensalidade do contrato (não existe coluna MRR separada)
 *  - AI:   faturas = pagas/emitidas da assinatura Stripe
 *  - PABX: faturas = registradas/prazo do contrato (ex: 1/36); status "Em aberto"
 *          enquanto a Wevy não confirma o pagamento (carga mensal da planilha)
 *  - "Em Atraso" = faturas abertas do ciclo corrente | "Não Cobrado" = histórico
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
  const produto = request.nextUrl.searchParams.get("produto") || "todos";

  // COALESCE: contrato antigo sem produto é venda AI (backfill 21/07 zerou, mas fica defensivo)
  const prodCtr = produto === "pabx" ? sql` AND COALESCE(c.produto, 'ai') = 'pabx'`
    : produto === "ai" ? sql` AND COALESCE(c.produto, 'ai') = 'ai'` : sql``;
  const prodFat = produto === "pabx" ? sql` AND f.origem = 'pabx'`
    : produto === "ai" ? sql` AND f.origem = 'stripe'` : sql``;

  // KPIs (faturas = fonte de atraso; contratos = base ativa)
  const kpis = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM contratos c WHERE (c.organizacao_id = ${orgId} OR c.organizacao_id IS NULL) AND c.status = 'ativo'${prodCtr})::int AS ativos,
      (SELECT count(*) FROM contratos c WHERE (c.organizacao_id = ${orgId} OR c.organizacao_id IS NULL)${prodCtr})::int AS total,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status IN ('aberta', 'uncollectible') AND f.emitida_em >= date_trunc('month', now())${prodFat})::float AS valor_atraso,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status IN ('aberta', 'uncollectible') AND f.emitida_em < date_trunc('month', now())${prodFat})::float AS nao_cobrado,
      (SELECT count(DISTINCT f.lead_id) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status IN ('aberta', 'uncollectible') AND f.emitida_em >= date_trunc('month', now())${prodFat})::int AS clientes_atraso,
      (SELECT count(*) FROM contratos c WHERE (c.organizacao_id = ${orgId} OR c.organizacao_id IS NULL) AND c.status = 'churned' AND c.finalizado_at >= date_trunc('month', now())${prodCtr})::int AS churns_mes,
      (SELECT COALESCE(sum(c.mrr), 0) FROM contratos c WHERE (c.organizacao_id = ${orgId} OR c.organizacao_id IS NULL) AND c.status = 'ativo'${prodCtr})::float AS receita_prevista,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status = 'paga' AND f.paga_em >= date_trunc('month', now())${prodFat})::float AS recebido_mes,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status = 'emitida' AND f.competencia >= (date_trunc('month', now()) - interval '1 month')${prodFat})::float AS em_aberto_wevy
  `)) as unknown as {
    ativos: number; total: number; valor_atraso: number; nao_cobrado: number; clientes_atraso: number; churns_mes: number;
    receita_prevista: number; recebido_mes: number; em_aberto_wevy: number;
  }[];

  // UMA LINHA POR CONTRATO
  const contratosRows = (await db.execute(sql`
    SELECT
      c.id AS contrato_id,
      l.id AS lead_id, l.nome, l.email, e.nome AS empresa,
      c.produto,
      COALESCE(NULLIF(c.descricao, ''), CASE WHEN c.produto = 'pabx' THEN 'Contrato PABX' ELSE 'Assinatura Callface AI' END) AS contrato,
      c.mrr::float AS valor,
      c.status AS contrato_status,
      c.vencimento,
      (substring(c.descricao from 'prazo (\\d+)'))::int AS prazo_meses,
      fat.pagas, fat.emitidas, fat.em_atraso, fat.nao_cobrado, fat.em_aberto_wevy, fat.pago_mes, fat.total_pago, fat.ultimo_pagamento, fat.ultima_atividade, fat.dias_atraso
    FROM contratos c
    JOIN leads l ON l.id = c.lead_id
    LEFT JOIN empresas e ON e.id = l.empresa_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE f.status = 'paga')::int AS pagas,
        count(*)::int AS emitidas,
        COALESCE(sum(f.valor) FILTER (WHERE f.status IN ('aberta', 'uncollectible') AND f.emitida_em >= date_trunc('month', now())), 0)::float AS em_atraso,
        COALESCE(sum(f.valor) FILTER (WHERE f.status IN ('aberta', 'uncollectible') AND f.emitida_em < date_trunc('month', now())), 0)::float AS nao_cobrado,
        count(*) FILTER (WHERE f.status = 'emitida' AND f.competencia >= (date_trunc('month', now()) - interval '1 month'))::int AS em_aberto_wevy,
        count(*) FILTER (WHERE f.status = 'paga' AND f.paga_em >= date_trunc('month', now()))::int AS pago_mes,
        COALESCE(sum(f.valor) FILTER (WHERE f.status = 'paga'), 0)::float AS total_pago,
        max(f.paga_em) AS ultimo_pagamento,
        max(GREATEST(COALESCE(f.paga_em, 'epoch'), COALESCE(f.emitida_em, 'epoch'))) AS ultima_atividade,
        COALESCE(max(EXTRACT(day FROM now() - COALESCE(f.vencimento, f.emitida_em))) FILTER (WHERE f.status IN ('aberta', 'uncollectible')), 0)::int AS dias_atraso
      FROM faturas f
      WHERE f.lead_id = c.lead_id
        AND ((COALESCE(c.produto, 'ai') = 'pabx' AND f.origem = 'pabx') OR (COALESCE(c.produto, 'ai') <> 'pabx' AND f.origem = 'stripe'))
        AND (c.stripe_subscription_id IS NULL OR f.assinatura_id IS NULL OR f.assinatura_id IN (
          SELECT a.id FROM assinaturas a WHERE a.stripe_subscription_id = c.stripe_subscription_id
        ))
    ) fat ON true
    WHERE (c.organizacao_id = ${orgId} OR c.organizacao_id IS NULL)${prodCtr}
      AND c.status = 'ativo'
    ORDER BY COALESCE(fat.em_atraso, 0) DESC, COALESCE(fat.nao_cobrado, 0) DESC, c.mrr DESC NULLS LAST
    LIMIT 1000
  `)) as unknown as Record<string, unknown>[];

  const linhas = contratosRows.map((r) => {
    const emAtraso = Number(r.em_atraso) || 0;
    const naoCobrado = Number(r.nao_cobrado) || 0;
    const emAbertoWevy = Number(r.em_aberto_wevy) || 0;
    const pagoMes = Number(r.pago_mes) || 0;
    let status: string;
    if (emAtraso > 0) status = "atrasado";
    else if (naoCobrado > 0) status = "pendencia_antiga";
    else if (r.produto === "pabx") status = emAbertoWevy > 0 ? "em_aberto" : "em_dia";
    else status = pagoMes > 0 ? "pago" : "a_faturar";
    // PABX: x/prazo do contrato | AI: pagas/emitidas
    const registradas = Number(r.emitidas) || 0;
    const faturasTotal = r.produto === "pabx" ? (Number(r.prazo_meses) || registradas || 1) : registradas;
    const faturasFeitas = r.produto === "pabx" ? registradas : Number(r.pagas) || 0;
    return {
      contratoId: r.contrato_id,
      leadId: r.lead_id,
      nome: r.nome,
      email: r.email,
      empresa: r.empresa,
      produto: r.produto,
      contrato: String(r.contrato || "").slice(0, 80),
      valor: Number(r.valor) || 0,
      totalPago: Number(r.total_pago) || 0,
      faturasFeitas,
      faturasTotal,
      emAtraso,
      naoCobrado,
      diasAtraso: Number(r.dias_atraso) || 0,
      status,
      pagoMes,
      ultimoPagamento: r.ultimo_pagamento,
      ultimaAtividade: r.ultima_atividade,
    };
  });

  const k = kpis[0];
  return NextResponse.json({
    kpis: {
      contratosAtivos: k?.ativos ?? 0,
      contratosTotal: k?.total ?? 0,
      valorEmAtraso: k?.valor_atraso ?? 0,
      naoCobradoHistorico: k?.nao_cobrado ?? 0,
      clientesEmAtraso: k?.clientes_atraso ?? 0,
      taxaInadimplencia: k?.ativos ? Math.round(((k.clientes_atraso as number) / (k.ativos as number)) * 1000) / 10 : 0,
      churnsMes: k?.churns_mes ?? 0,
      receitaPrevista: k?.receita_prevista ?? 0,
      recebidoMes: k?.recebido_mes ?? 0,
      emAbertoWevy: k?.em_aberto_wevy ?? 0,
    },
    contratos: linhas,
  });
}
