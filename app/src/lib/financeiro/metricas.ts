/**
 * Camada ÚNICA de métricas financeiras do SaaS (F8 do PLANO-ACAO-FINANCEIRO).
 *
 * Regras de ouro:
 *  - Receita SEMPRE segmentável por produto (ai = Stripe, pabx = planilha Wevy).
 *  - MRR por componente vem de `mrr_movimentos` (diff do sync + backfill),
 *    nunca recalculado de formas diferentes por aba.
 *  - Dias em atraso são derivados de COALESCE(vencimento, emitida_em) — nunca coluna.
 *  - Churn voluntário × involuntário: prefixo de motivo_cancelamento
 *    ("payment_failed" = involuntário; "cancellation_requested" = voluntário).
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Filtro de org no padrão do módulo (dados de sync antigos têm organizacao_id NULL)
const orgFilter = (col: string, orgId: string) => sql`(${sql.raw(col)} = ${orgId} OR ${sql.raw(col)} IS NULL)`;

export interface PeriodoFin {
  inicio: Date;
  fim: Date;
}

// ─── MRR atual e componentes ────────────────────────────────────────────────

export interface MrrAtual {
  total: number;
  porProduto: { produto: string; mrr: number; contratos: number }[];
}

export async function getMrrAtual(orgId: string): Promise<MrrAtual> {
  const rows = (await db.execute(sql`
    SELECT COALESCE(c.produto, 'ai') AS produto, COALESCE(sum(c.mrr), 0)::float AS mrr, count(*)::int AS contratos
    FROM contratos c
    WHERE ${orgFilter("c.organizacao_id", orgId)} AND c.status = 'ativo'
    GROUP BY 1 ORDER BY 2 DESC
  `)) as unknown as { produto: string; mrr: number; contratos: number }[];
  return {
    total: round2(rows.reduce((a, r) => a + r.mrr, 0)),
    porProduto: rows.map((r) => ({ ...r, mrr: round2(r.mrr) })),
  };
}

export interface ComponentesMrr {
  novo: number;
  expansao: number;
  contracao: number; // positivo (valor absoluto)
  churn: number; // positivo (valor absoluto)
  reativacao: number;
  netGrowth: number; // novo + expansao + reativacao − contracao − churn
}

export async function getComponentesMrr(orgId: string, p: PeriodoFin, produto?: string): Promise<ComponentesMrr> {
  const prodSql = produto ? sql` AND m.produto = ${produto}` : sql``;
  const rows = (await db.execute(sql`
    SELECT m.tipo, COALESCE(sum(m.delta), 0)::float AS delta
    FROM mrr_movimentos m
    WHERE ${orgFilter("m.organizacao_id", orgId)}
      AND m.ocorrido_em >= ${p.inicio.toISOString()} AND m.ocorrido_em < ${p.fim.toISOString()}${prodSql}
    GROUP BY m.tipo
  `)) as unknown as { tipo: string; delta: number }[];
  const por = Object.fromEntries(rows.map((r) => [r.tipo, r.delta]));
  const novo = round2(por.novo || 0);
  const expansao = round2(por.expansao || 0);
  const contracao = round2(Math.abs(por.contracao || 0));
  const churn = round2(Math.abs(por.churn || 0));
  const reativacao = round2(por.reativacao || 0);
  return { novo, expansao, contracao, churn, reativacao, netGrowth: round2(novo + expansao + reativacao - contracao - churn) };
}

/** MRR no início do período = MRR atual − Σ movimentos desde o início do período. */
export async function getMrrNoInicio(orgId: string, inicio: Date): Promise<number> {
  const atual = await getMrrAtual(orgId);
  const [row] = (await db.execute(sql`
    SELECT COALESCE(sum(m.delta), 0)::float AS delta
    FROM mrr_movimentos m
    WHERE ${orgFilter("m.organizacao_id", orgId)} AND m.ocorrido_em >= ${inicio.toISOString()}
  `)) as unknown as { delta: number }[];
  return round2(atual.total - (row?.delta || 0));
}

// ─── Retenção e churn ───────────────────────────────────────────────────────

export interface ChurnStats {
  logosChurned: number;
  logosAtivosInicio: number;
  churnLogoPct: number; // % de clientes que cancelaram no período
  mrrChurned: number;
  churnReceitaPct: number; // % do MRR do início perdido
  voluntario: { count: number; mrr: number };
  involuntario: { count: number; mrr: number };
  semMotivo: { count: number; mrr: number };
  nrr: number; // Net Revenue Retention (%) — >100 = expansão supera perdas
  motivos: { motivo: string; count: number }[]; // feedback agregado (pesquisa de cancelamento)
}

export async function getChurnStats(orgId: string, p: PeriodoFin): Promise<ChurnStats> {
  const canceladas = (await db.execute(sql`
    SELECT
      count(*)::int AS logos,
      COALESCE(sum(a.mrr), 0)::float AS mrr,
      count(*) FILTER (WHERE a.motivo_cancelamento LIKE 'payment_failed%')::int AS invol_n,
      COALESCE(sum(a.mrr) FILTER (WHERE a.motivo_cancelamento LIKE 'payment_failed%'), 0)::float AS invol_mrr,
      count(*) FILTER (WHERE a.motivo_cancelamento LIKE 'cancellation_requested%')::int AS vol_n,
      COALESCE(sum(a.mrr) FILTER (WHERE a.motivo_cancelamento LIKE 'cancellation_requested%'), 0)::float AS vol_mrr
    FROM assinaturas a
    WHERE ${orgFilter("a.organizacao_id", orgId)} AND a.status = 'canceled'
      AND a.cancelada_em >= ${p.inicio.toISOString()} AND a.cancelada_em < ${p.fim.toISOString()}
  `)) as unknown as { logos: number; mrr: number; invol_n: number; invol_mrr: number; vol_n: number; vol_mrr: number }[];
  const c = canceladas[0] || { logos: 0, mrr: 0, invol_n: 0, invol_mrr: 0, vol_n: 0, vol_mrr: 0 };

  // Base de logos no início: ativos agora − novos no período + churned no período
  const [base] = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM contratos c WHERE ${orgFilter("c.organizacao_id", orgId)} AND c.status = 'ativo')::int AS ativos_agora,
      (SELECT count(*) FROM contratos c WHERE ${orgFilter("c.organizacao_id", orgId)} AND c.created_at >= ${p.inicio.toISOString()} AND c.created_at < ${p.fim.toISOString()})::int AS novos,
      (SELECT count(*) FROM contratos c WHERE ${orgFilter("c.organizacao_id", orgId)} AND c.status = 'churned' AND c.finalizado_at >= ${p.inicio.toISOString()} AND c.finalizado_at < ${p.fim.toISOString()})::int AS churned
  `)) as unknown as { ativos_agora: number; novos: number; churned: number }[];
  const logosInicio = Math.max(0, (base?.ativos_agora || 0) - (base?.novos || 0) + (base?.churned || 0));

  const mrrInicio = await getMrrNoInicio(orgId, p.inicio);
  const comp = await getComponentesMrr(orgId, p);
  const nrr = mrrInicio > 0 ? round2(((mrrInicio + comp.expansao - comp.contracao - comp.churn) / mrrInicio) * 100) : 100;

  // Pesquisa de cancelamento agregada (feedback dentro do motivo: "reason (feedback): comment")
  const motivos = (await db.execute(sql`
    SELECT COALESCE(substring(a.motivo_cancelamento from '\\((.*?)\\)'),
                    CASE WHEN a.motivo_cancelamento LIKE 'payment_failed%' THEN 'cartão recusado'
                         WHEN a.motivo_cancelamento IS NULL THEN 'sem motivo'
                         ELSE 'não informado' END) AS motivo,
           count(*)::int AS count
    FROM assinaturas a
    WHERE ${orgFilter("a.organizacao_id", orgId)} AND a.status = 'canceled'
      AND a.cancelada_em >= ${p.inicio.toISOString()} AND a.cancelada_em < ${p.fim.toISOString()}
    GROUP BY 1 ORDER BY 2 DESC
  `)) as unknown as { motivo: string; count: number }[];

  return {
    logosChurned: c.logos,
    logosAtivosInicio: logosInicio,
    churnLogoPct: logosInicio > 0 ? round2((c.logos / logosInicio) * 100) : 0,
    mrrChurned: round2(c.mrr),
    churnReceitaPct: mrrInicio > 0 ? round2((c.mrr / mrrInicio) * 100) : 0,
    voluntario: { count: c.vol_n, mrr: round2(c.vol_mrr) },
    involuntario: { count: c.invol_n, mrr: round2(c.invol_mrr) },
    semMotivo: { count: c.logos - c.vol_n - c.invol_n, mrr: round2(c.mrr - c.vol_mrr - c.invol_mrr) },
    nrr,
    motivos,
  };
}

// ─── Unit economics ─────────────────────────────────────────────────────────

export interface UnitEconomics {
  arpu: number;
  ltvMedio: number | null; // ARPU / churn de receita mensal (média 3m); null se churn 0
  ltvPorPlano: { plano: string; clientes: number; ltvMedio: number; mrrMedio: number }[];
  cac: number | null; // gasto mídia / vendas no período (Meta)
  ltvCac: number | null;
  cacPaybackMeses: number | null; // CAC / ARPU
}

export async function getUnitEconomics(orgId: string, p: PeriodoFin, gastoMidia: number | null, vendasMidia: number | null): Promise<UnitEconomics> {
  const mrr = await getMrrAtual(orgId);
  const clientesAtivos = mrr.porProduto.reduce((a, r) => a + r.contratos, 0);
  const arpu = clientesAtivos > 0 ? round2(mrr.total / clientesAtivos) : 0;

  // churn de receita mensal médio dos últimos 3 meses (base do LTV)
  const tresMesesAtras = new Date(p.fim);
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
  const [churn3m] = (await db.execute(sql`
    SELECT COALESCE(sum(abs(m.delta)), 0)::float / 3 AS churn_mensal
    FROM mrr_movimentos m
    WHERE ${orgFilter("m.organizacao_id", orgId)} AND m.tipo = 'churn'
      AND m.ocorrido_em >= ${tresMesesAtras.toISOString()} AND m.ocorrido_em < ${p.fim.toISOString()}
  `)) as unknown as { churn_mensal: number }[];
  const mrrInicio3m = await getMrrNoInicio(orgId, tresMesesAtras);
  const churnReceitaMensalPct = mrrInicio3m > 0 ? (churn3m?.churn_mensal || 0) / mrrInicio3m : 0;
  const ltvMedio = churnReceitaMensalPct > 0 ? round2(arpu / churnReceitaMensalPct) : null;

  // LTV realizado por plano (total efetivamente pago por assinatura, agrupado pelo plano do Stripe)
  const ltvPorPlano = (await db.execute(sql`
    SELECT COALESCE(a.produto, 'sem plano') AS plano,
           count(DISTINCT a.id)::int AS clientes,
           round((COALESCE(sum(f.valor) FILTER (WHERE f.status = 'paga'), 0) / GREATEST(count(DISTINCT a.id), 1))::numeric, 2)::float AS ltv_medio,
           round(avg(a.mrr)::numeric, 2)::float AS mrr_medio
    FROM assinaturas a
    LEFT JOIN faturas f ON f.assinatura_id = a.id
    WHERE ${orgFilter("a.organizacao_id", orgId)}
    GROUP BY 1 ORDER BY 3 DESC
  `)) as unknown as { plano: string; clientes: number; ltv_medio: number; mrr_medio: number }[];

  const cac = gastoMidia != null && vendasMidia != null && vendasMidia > 0 ? round2(gastoMidia / vendasMidia) : null;
  return {
    arpu,
    ltvMedio,
    ltvPorPlano: ltvPorPlano.map((r) => ({ plano: r.plano, clientes: r.clientes, ltvMedio: r.ltv_medio, mrrMedio: r.mrr_medio })),
    cac,
    ltvCac: cac && cac > 0 && ltvMedio ? round2(ltvMedio / cac) : null,
    cacPaybackMeses: cac && arpu > 0 ? round2(cac / arpu) : null,
  };
}

// ─── Cobrança e inadimplência ───────────────────────────────────────────────

export interface AgingFaixa {
  faixa: string; // 0-15 | 16-30 | 31-60 | 60+
  count: number;
  valor: number;
}

export async function getAging(orgId: string, produto?: string): Promise<{ faixas: AgingFaixa[]; total: number }> {
  const prodSql = produto === "pabx" ? sql` AND f.origem = 'pabx'` : produto === "ai" ? sql` AND f.origem = 'stripe'` : sql``;
  const rows = (await db.execute(sql`
    SELECT CASE
      WHEN now() - COALESCE(f.vencimento, f.emitida_em) <= interval '15 days' THEN '0-15'
      WHEN now() - COALESCE(f.vencimento, f.emitida_em) <= interval '30 days' THEN '16-30'
      WHEN now() - COALESCE(f.vencimento, f.emitida_em) <= interval '60 days' THEN '31-60'
      ELSE '60+' END AS faixa,
      count(*)::int AS count, COALESCE(sum(f.valor), 0)::float AS valor
    FROM faturas f
    WHERE ${orgFilter("f.organizacao_id", orgId)} AND f.status IN ('aberta', 'uncollectible')${prodSql}
    GROUP BY 1
  `)) as unknown as AgingFaixa[];
  const ordem = ["0-15", "16-30", "31-60", "60+"];
  const faixas = ordem.map((fx) => {
    const r = rows.find((x) => x.faixa === fx);
    return { faixa: fx, count: r?.count || 0, valor: round2(r?.valor || 0) };
  });
  return { faixas, total: round2(faixas.reduce((a, f) => a + f.valor, 0)) };
}

export interface FilaCobrancaItem {
  faturaId: string;
  leadId: string;
  nome: string | null;
  empresa: string | null;
  valor: number;
  diasAtraso: number;
  tentativas: number;
  temRetryAgendado: boolean; // sincronizado indiretamente: tentativas < 9 aproxima; UI mostra dias/tentativas
  hostedInvoiceUrl: string | null;
  status: string;
  acionado: boolean;
  acionadoEm: string | null;
  acionadoPorNome: string | null;
}

/** Fila de ação: quem cobrar primeiro (valor alto × atraso recente = mais recuperável). */
export async function getFilaCobranca(orgId: string, limite = 100): Promise<FilaCobrancaItem[]> {
  const rows = (await db.execute(sql`
    SELECT f.id AS fatura_id, l.id AS lead_id, l.nome, e.nome AS empresa,
      f.valor::float, f.status, f.tentativas,
      f.hosted_invoice_url,
      f.acionado_cobranca, f.acionado_em, u.nome AS acionado_por_nome,
      GREATEST(0, EXTRACT(day FROM now() - COALESCE(f.vencimento, f.emitida_em)))::int AS dias_atraso
    FROM faturas f
    JOIN leads l ON l.id = f.lead_id
    LEFT JOIN empresas e ON e.id = l.empresa_id
    LEFT JOIN usuarios u ON u.id = f.acionado_por
    WHERE ${orgFilter("f.organizacao_id", orgId)} AND f.status IN ('aberta', 'uncollectible')
    ORDER BY
      -- prioridade: atraso recente (recuperável) com valor alto primeiro; 60+ vai pro fim
      CASE WHEN EXTRACT(day FROM now() - COALESCE(f.vencimento, f.emitida_em)) <= 30 THEN 0 ELSE 1 END,
      f.valor DESC
    LIMIT ${limite}
  `)) as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    faturaId: r.fatura_id as string,
    leadId: r.lead_id as string,
    nome: r.nome as string | null,
    empresa: r.empresa as string | null,
    valor: round2(Number(r.valor) || 0),
    diasAtraso: Number(r.dias_atraso) || 0,
    tentativas: Number(r.tentativas) || 0,
    temRetryAgendado: (Number(r.tentativas) || 0) < 9 && r.status === "aberta",
    hostedInvoiceUrl: (r.hosted_invoice_url as string) || null,
    status: r.status as string,
    acionado: !!r.acionado_cobranca,
    acionadoEm: r.acionado_em ? new Date(r.acionado_em as string).toISOString() : null,
    acionadoPorNome: (r.acionado_por_nome as string) || null,
  }));
}

export interface Recuperacao {
  falhadas: number; // faturas que tiveram >=2 tentativas no período
  recuperadas: number; // dessas, quantas terminaram pagas
  taxaPct: number;
  valorRecuperado: number;
}

export async function getRecuperacao(orgId: string, p: PeriodoFin): Promise<Recuperacao> {
  const [row] = (await db.execute(sql`
    SELECT
      count(*)::int AS falhadas,
      count(*) FILTER (WHERE f.status = 'paga')::int AS recuperadas,
      COALESCE(sum(f.valor) FILTER (WHERE f.status = 'paga'), 0)::float AS valor_recuperado
    FROM faturas f
    WHERE ${orgFilter("f.organizacao_id", orgId)} AND f.origem = 'stripe' AND f.tentativas >= 2
      AND f.emitida_em >= ${p.inicio.toISOString()} AND f.emitida_em < ${p.fim.toISOString()}
  `)) as unknown as { falhadas: number; recuperadas: number; valor_recuperado: number }[];
  const r = row || { falhadas: 0, recuperadas: 0, valor_recuperado: 0 };
  return {
    falhadas: r.falhadas,
    recuperadas: r.recuperadas,
    taxaPct: r.falhadas > 0 ? round2((r.recuperadas / r.falhadas) * 100) : 0,
    valorRecuperado: round2(r.valor_recuperado),
  };
}

// ─── Forecast e calendário ──────────────────────────────────────────────────

export interface ForecastMes {
  mes: string; // YYYY-MM
  base: number; // MRR carregado do mês anterior
  netHistorico: number; // média de crescimento líquido dos últimos 3 meses
  projetado: number;
}

/** Projeção simples e honesta: base atual + média do net growth 3m. Sem mágica. */
export async function getForecast(orgId: string, meses = 3): Promise<ForecastMes[]> {
  const atual = await getMrrAtual(orgId);
  const fim = new Date();
  const inicio3m = new Date(fim);
  inicio3m.setMonth(inicio3m.getMonth() - 3);
  const comp3m = await getComponentesMrr(orgId, { inicio: inicio3m, fim });
  const netMensal = round2(comp3m.netGrowth / 3);

  const out: ForecastMes[] = [];
  let base = atual.total;
  for (let i = 1; i <= meses; i++) {
    const d = new Date(fim.getFullYear(), fim.getMonth() + i, 1);
    const projetado = round2(base + netMensal);
    out.push({ mes: d.toISOString().slice(0, 7), base: round2(base), netHistorico: netMensal, projetado });
    base = projetado;
  }
  return out;
}

export interface RenovacaoItem {
  contratoId: string;
  leadId: string;
  nome: string | null;
  empresa: string | null;
  produto: string;
  mrr: number;
  vencimento: string | null; // contratos.vencimento (anuais/prazo)
  proximaCobranca: string | null; // assinaturas.current_period_end
}

export async function getCalendarioRenovacao(orgId: string, dias = 90): Promise<RenovacaoItem[]> {
  const rows = (await db.execute(sql`
    SELECT c.id AS contrato_id, l.id AS lead_id, l.nome, e.nome AS empresa,
      COALESCE(c.produto, 'ai') AS produto, c.mrr::float, c.vencimento,
      a.current_period_end AS proxima_cobranca
    FROM contratos c
    JOIN leads l ON l.id = c.lead_id
    LEFT JOIN empresas e ON e.id = l.empresa_id
    LEFT JOIN assinaturas a ON a.contrato_id = c.id
    WHERE ${orgFilter("c.organizacao_id", orgId)} AND c.status = 'ativo'
      AND (
        (c.vencimento IS NOT NULL AND c.vencimento <= (now() + make_interval(days => ${dias}))::date)
        OR (a.current_period_end IS NOT NULL AND a.current_period_end <= now() + make_interval(days => ${dias})
            AND a.current_period_end - COALESCE(a.iniciada_em, a.created_at) > interval '300 days')
      )
    ORDER BY COALESCE(c.vencimento::timestamptz, a.current_period_end) ASC
    LIMIT 200
  `)) as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    contratoId: r.contrato_id as string,
    leadId: r.lead_id as string,
    nome: r.nome as string | null,
    empresa: r.empresa as string | null,
    produto: r.produto as string,
    mrr: round2(Number(r.mrr) || 0),
    vencimento: r.vencimento ? String(r.vencimento) : null,
    proximaCobranca: r.proxima_cobranca ? new Date(r.proxima_cobranca as string).toISOString() : null,
  }));
}

// ─── Clientes em risco ──────────────────────────────────────────────────────

export interface ClienteRisco {
  leadId: string;
  nome: string | null;
  empresa: string | null;
  mrr: number;
  motivos: string[]; // ["past_due", "atraso recorrente (3 faturas c/ retry em 90d)"]
}

export async function getClientesRisco(orgId: string): Promise<ClienteRisco[]> {
  const rows = (await db.execute(sql`
    WITH retries_90d AS (
      SELECT f.lead_id, count(*)::int AS n
      FROM faturas f
      WHERE f.origem = 'stripe' AND f.tentativas >= 2 AND f.emitida_em >= now() - interval '90 days'
      GROUP BY f.lead_id
    )
    SELECT l.id AS lead_id, l.nome, e.nome AS empresa,
      COALESCE(a.mrr, 0)::float AS mrr,
      (a.status = 'past_due') AS past_due,
      COALESCE(r.n, 0) AS retries
    FROM assinaturas a
    JOIN leads l ON l.id = a.lead_id
    LEFT JOIN empresas e ON e.id = l.empresa_id
    LEFT JOIN retries_90d r ON r.lead_id = l.id
    WHERE ${orgFilter("a.organizacao_id", orgId)}
      AND a.status IN ('active', 'past_due')
      AND (a.status = 'past_due' OR COALESCE(r.n, 0) >= 2)
    ORDER BY (a.status = 'past_due') DESC, COALESCE(a.mrr, 0) DESC
    LIMIT 100
  `)) as unknown as Record<string, unknown>[];
  return rows.map((r) => {
    const motivos: string[] = [];
    if (r.past_due) motivos.push("pagamento em atraso (past_due)");
    if (Number(r.retries) >= 2) motivos.push(`atraso recorrente (${r.retries} faturas c/ retry em 90d)`);
    return {
      leadId: r.lead_id as string,
      nome: r.nome as string | null,
      empresa: r.empresa as string | null,
      mrr: round2(Number(r.mrr) || 0),
      motivos,
    };
  });
}

// ─── Receita recebida/prevista (mantém paridade com a visão atual) ──────────

export interface FluxoMes {
  receitaPrevista: number;
  recebidoMes: number;
  emAberto: number;
}

export async function getFluxoMes(orgId: string, produto?: string): Promise<FluxoMes> {
  const prodFat = produto === "pabx" ? sql` AND f.origem = 'pabx'` : produto === "ai" ? sql` AND f.origem = 'stripe'` : sql``;
  const prodCtr = produto ? sql` AND COALESCE(c.produto, 'ai') = ${produto}` : sql``;
  const [row] = (await db.execute(sql`
    SELECT
      (SELECT COALESCE(sum(c.mrr), 0) FROM contratos c WHERE ${orgFilter("c.organizacao_id", orgId)} AND c.status = 'ativo'${prodCtr})::float AS prevista,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE ${orgFilter("f.organizacao_id", orgId)} AND f.status = 'paga' AND f.paga_em >= date_trunc('month', now())${prodFat})::float AS recebido,
      (SELECT COALESCE(sum(f.valor), 0) FROM faturas f WHERE ${orgFilter("f.organizacao_id", orgId)} AND f.status IN ('aberta', 'uncollectible')${prodFat})::float AS aberto
  `)) as unknown as { prevista: number; recebido: number; aberto: number }[];
  return {
    receitaPrevista: round2(row?.prevista || 0),
    recebidoMes: round2(row?.recebido || 0),
    emAberto: round2(row?.aberto || 0),
  };
}
