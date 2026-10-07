import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { getFluxoMes } from "@/lib/financeiro/metricas";

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

  // E9: a aba lê a tabela `assinaturas` (assinatura Stripe NÃO é contrato).
  // Assinatura é sempre Stripe/AI; PABX não tem assinatura, então a aba PABX
  // fica vazia em vez de mostrar contrato como se fosse assinatura.
  const prodAss = produto === "pabx" ? sql` AND false` : sql``;
  const prodFat = produto === "pabx" ? sql` AND f.origem = 'pabx'`
    : produto === "ai" ? sql` AND f.origem = 'stripe'` : sql``;

  // MRR e caixa pela porta única; o resto dos KPIs é específico desta tela.
  const fluxo = await getFluxoMes(orgId, produto === "todos" ? undefined : produto);

  // KPIs (faturas = fonte de atraso; contratos = base ativa)
  const kpis = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM assinaturas a WHERE a.organizacao_id = ${orgId} AND a.status IN ('active', 'trialing', 'past_due')${prodAss})::int AS ativos,
      (SELECT count(*) FROM assinaturas a WHERE a.organizacao_id = ${orgId}${prodAss})::int AS total,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status IN ('aberta', 'uncollectible') AND f.emitida_em >= date_trunc('month', now())${prodFat})::float AS valor_atraso,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status IN ('aberta', 'uncollectible') AND f.emitida_em < date_trunc('month', now())${prodFat})::float AS nao_cobrado,
      (SELECT count(DISTINCT f.lead_id) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status IN ('aberta', 'uncollectible') AND f.emitida_em >= date_trunc('month', now())${prodFat})::int AS clientes_atraso,
      (SELECT count(*) FROM assinaturas a WHERE a.organizacao_id = ${orgId} AND a.status = 'canceled' AND a.cancelada_em >= date_trunc('month', now())${prodAss})::int AS churns_mes,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE (f.organizacao_id = ${orgId} OR f.organizacao_id IS NULL) AND f.status = 'emitida' AND f.competencia >= (date_trunc('month', now()) - interval '1 month')${prodFat})::float AS em_aberto_wevy
  `)) as unknown as {
    ativos: number; total: number; valor_atraso: number; nao_cobrado: number; clientes_atraso: number; churns_mes: number;
    em_aberto_wevy: number;
  }[];

  // UMA LINHA POR ASSINATURA (a chave segue se chamando contratoId no JSON
  // para não quebrar a tela; o valor é o id da assinatura).
  const contratosRows = (await db.execute(sql`
    SELECT
      a.id AS contrato_id,
      l.id AS lead_id, l.nome, l.email, e.nome AS empresa,
      'ai' AS produto,
      COALESCE(NULLIF(a.produto, ''), 'Assinatura Callface AI') AS contrato,
      a.mrr::float AS valor,
      a.status AS contrato_status,
      a.current_period_end AS vencimento,
      NULL::int AS prazo_meses,
      fat.pagas, fat.emitidas, fat.em_atraso, fat.nao_cobrado, fat.em_aberto_wevy, fat.pago_mes, fat.total_pago, fat.ultimo_pagamento, fat.ultima_atividade, fat.dias_atraso
    FROM assinaturas a
    LEFT JOIN leads l ON l.id = a.lead_id
    LEFT JOIN empresas e ON e.id = COALESCE(a.empresa_id, l.empresa_id)
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE f.status = 'paga')::int AS pagas,
        count(*)::int AS emitidas,
        COALESCE(sum(f.valor) FILTER (WHERE f.status IN ('aberta', 'uncollectible') AND f.emitida_em >= date_trunc('month', now())), 0)::float AS em_atraso,
        COALESCE(sum(f.valor) FILTER (WHERE f.status IN ('aberta', 'uncollectible') AND f.emitida_em < date_trunc('month', now())), 0)::float AS nao_cobrado,
        0::int AS em_aberto_wevy,
        count(*) FILTER (WHERE f.status = 'paga' AND f.paga_em >= date_trunc('month', now()))::int AS pago_mes,
        COALESCE(sum(f.valor) FILTER (WHERE f.status = 'paga'), 0)::float AS total_pago,
        max(f.paga_em) AS ultimo_pagamento,
        max(GREATEST(COALESCE(f.paga_em, 'epoch'), COALESCE(f.emitida_em, 'epoch'))) AS ultima_atividade,
        COALESCE(max(EXTRACT(day FROM now() - COALESCE(f.vencimento, f.emitida_em))) FILTER (WHERE f.status IN ('aberta', 'uncollectible')), 0)::int AS dias_atraso
      FROM faturas f
      WHERE f.assinatura_id = a.id
    ) fat ON true
    WHERE a.organizacao_id = ${orgId}${prodAss}
      AND a.status IN ('active', 'trialing', 'past_due', 'unpaid')
    ORDER BY COALESCE(fat.em_atraso, 0) DESC, COALESCE(fat.nao_cobrado, 0) DESC, a.mrr DESC NULLS LAST
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
      contratosAtivos: fluxo.assinaturasAtivas,
      contratosTotal: k?.total ?? 0,
      valorEmAtraso: k?.valor_atraso ?? 0,
      naoCobradoHistorico: k?.nao_cobrado ?? 0,
      clientesEmAtraso: k?.clientes_atraso ?? 0,
      // Denominador precisa ser do MESMO segmento que o numerador: com a
      // contagem de contratos, a aba PABX dividia por zero e a aba AI
      // dividia pelos 598 contratos da empresa inteira.
      taxaInadimplencia: fluxo.assinaturasAtivas
        ? Math.round(((k.clientes_atraso as number) / fluxo.assinaturasAtivas) * 1000) / 10
        : 0,
      churnsMes: k?.churns_mes ?? 0,
      // MRR e caixa vêm da porta única (`getFluxoMes`). Até 21/09 estavam
      // reescritos aqui: `contratos.mrr` (base não canônica, e com o filtro de
      // produto que nunca casa 'pabx') e valor de face de fatura paga (que
      // conta como caixa 10 faturas sem pagamento nenhum).
      receitaPrevista: fluxo.receitaPrevista,
      recebidoMes: fluxo.recebidoMes,
      faturadoMes: fluxo.faturadoMes,
      reconciliar: fluxo.reconciliar,
      emAbertoWevy: k?.em_aberto_wevy ?? 0,
    },
    contratos: linhas,
  });
}
