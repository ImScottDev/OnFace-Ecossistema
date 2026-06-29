import { Hono } from "hono";
import { db } from "@/lib/db";
import { negocios, leads, campanhas, contratos, npsRespostas, atividades, statusChanges, usuarios } from "@/lib/db/schema";
import { eq, count, sum, avg, and, inArray, sql, gte, isNotNull, lte, desc, not, between, lt, or } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { parsePeriodo } from "@/lib/relatorios/periodo";
import { fetchMetaCampaignInsights, fetchMetaAdInsights, metaConfigured, normCampanha } from "@/lib/integrations/meta-insights";

const app = new Hono();

// ─── Helpers ────────────────────────────────────────────────────

// GO-LIVE: o CRM passou a ser o sistema de registro em 25/jun/2026. O histórico
// migrado do Zoho (deals/ganhos/datas antigas) fica no banco pra contexto do lead,
// mas NÃO entra nos relatórios (senão suja os gráficos). Decisão Scott 25/jun.
const GO_LIVE = new Date("2026-06-25T00:00:00-03:00");
const floorGoLive = (d: Date) => (d.getTime() < GO_LIVE.getTime() ? new Date(GO_LIVE) : d);

// Janela do período selecionado (respeita "custom:from:to" e presets "7d/30d/...").
// Retorna since/until + a janela anterior de mesma duração (pra deltas).
// O `since` é pisado no go-live: relatórios só contam do go-live pra frente.
function periodWindow(periodo: string) {
  const parsed = parsePeriodo(periodo);
  const since = floorGoLive(parsed.since);
  const until = parsed.until;
  const span = Math.max(0, until.getTime() - since.getTime());
  return { since, until, prevSince: new Date(since.getTime() - span), prevUntil: since };
}

function getBuckets(since: Date, until: Date, count = 7) {
  const step = (until.getTime() - since.getTime()) / count;
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(since.getTime() + step * i),
    end: new Date(since.getTime() + step * (i + 1)),
  }));
}

// ─── Resumo (KPIs + sparklines) ─────────────────────────────────

// GET /relatorios/resumo?periodo=30d
app.get("/resumo", async (c) => {
  const ctx = await getCtx(c);
  const periodo = c.req.query("periodo") ?? "30d";
  const { since, until, prevSince } = periodWindow(periodo);

  const orgId = ctx.organizacaoId;
  const buckets = getBuckets(since, until, 7);

  // ── Leads KPI ──
  const [leadsCurrent] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), gte(leads.createdAt, since), lt(leads.createdAt, until)));

  const [leadsPrev] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), gte(leads.createdAt, prevSince), lt(leads.createdAt, since)));

  const leadsTrend = await Promise.all(
    buckets.map(async (b) => {
      const [r] = await db
        .select({ total: count() })
        .from(leads)
        .where(and(eq(leads.organizacaoId, orgId), gte(leads.createdAt, b.start), lt(leads.createdAt, b.end)));
      return Number(r.total);
    })
  );

  const leadsCurrentN = Number(leadsCurrent.total);
  const leadsPrevN = Number(leadsPrev.total);
  const leadsDelta = leadsPrevN > 0 ? ((leadsCurrentN - leadsPrevN) / leadsPrevN) * 100 : 0;

  // ── Pipeline KPI ──
  const [pipelineCurrent] = await db
    .select({ total: sum(negocios.valorTotal) })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      not(inArray(negocios.status, ["ganho", "perdido", "churned"]))
    ));

  const [pipelinePrev] = await db
    .select({ total: sum(negocios.valorTotal) })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      not(inArray(negocios.status, ["ganho", "perdido", "churned"])),
      gte(negocios.createdAt, prevSince),
      lt(negocios.createdAt, since)
    ));

  const pipelineTrend = await Promise.all(
    buckets.map(async (b) => {
      const [r] = await db
        .select({ total: sum(negocios.valorTotal) })
        .from(negocios)
        .where(and(
          eq(negocios.organizacaoId, orgId),
          not(inArray(negocios.status, ["ganho", "perdido", "churned"])),
          gte(negocios.createdAt, b.start),
          lt(negocios.createdAt, b.end)
        ));
      return Number(r.total) || 0;
    })
  );

  const pipelineCurrentN = Number(pipelineCurrent.total) || 0;
  const pipelinePrevN = Number(pipelinePrev.total) || 0;
  const pipelineDelta = pipelinePrevN > 0 ? ((pipelineCurrentN - pipelinePrevN) / pipelinePrevN) * 100 : 0;

  // ── Win Rate KPI ──
  const winRateRows = await db
    .select({ status: negocios.status, total: count() })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      inArray(negocios.status, ["ganho", "perdido"]),
      eq(negocios.origemNegocio, "novo"),
      gte(negocios.createdAt, since),
      lt(negocios.createdAt, until)
    ))
    .groupBy(negocios.status);

  const ganhosCurrent = Number(winRateRows.find((r) => r.status === "ganho")?.total || 0);
  const perdidosCurrent = Number(winRateRows.find((r) => r.status === "perdido")?.total || 0);
  const winRateCurrentN = (ganhosCurrent + perdidosCurrent) > 0
    ? (ganhosCurrent / (ganhosCurrent + perdidosCurrent)) * 100
    : 0;

  const winRatePrevRows = await db
    .select({ status: negocios.status, total: count() })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      inArray(negocios.status, ["ganho", "perdido"]),
      eq(negocios.origemNegocio, "novo"),
      gte(negocios.createdAt, prevSince),
      lt(negocios.createdAt, since)
    ))
    .groupBy(negocios.status);

  const ganhosPrev = Number(winRatePrevRows.find((r) => r.status === "ganho")?.total || 0);
  const perdidosPrev = Number(winRatePrevRows.find((r) => r.status === "perdido")?.total || 0);
  const winRatePrevN = (ganhosPrev + perdidosPrev) > 0
    ? (ganhosPrev / (ganhosPrev + perdidosPrev)) * 100
    : 0;

  const winRateDelta = winRatePrevN > 0 ? ((winRateCurrentN - winRatePrevN) / winRatePrevN) * 100 : 0;

  const winRateTrend = await Promise.all(
    buckets.map(async (b) => {
      const rows = await db
        .select({ status: negocios.status, total: count() })
        .from(negocios)
        .where(and(
          eq(negocios.organizacaoId, orgId),
          inArray(negocios.status, ["ganho", "perdido"]),
          eq(negocios.origemNegocio, "novo"),
          gte(negocios.createdAt, b.start),
          lt(negocios.createdAt, b.end)
        ))
        .groupBy(negocios.status);
      const g = Number(rows.find((r) => r.status === "ganho")?.total || 0);
      const p = Number(rows.find((r) => r.status === "perdido")?.total || 0);
      return (g + p) > 0 ? (g / (g + p)) * 100 : 0;
    })
  );

  // ── MRR KPI ──
  const [mrrCurrent] = await db
    .select({ total: sum(contratos.mrr) })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.status, "ativo"), eq(leads.organizacaoId, orgId)));

  const [mrrPrev] = await db
    .select({ total: sum(contratos.mrr) })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(
      eq(contratos.status, "ativo"),
      eq(leads.organizacaoId, orgId),
      lt(contratos.createdAt, since)
    ));

  const mrrCurrentN = Number(mrrCurrent.total) || 0;
  const mrrPrevN = Number(mrrPrev.total) || 0;
  const mrrDelta = mrrPrevN > 0 ? ((mrrCurrentN - mrrPrevN) / mrrPrevN) * 100 : 0;

  const mrrTrend = await Promise.all(
    buckets.map(async (b) => {
      const [r] = await db
        .select({ total: sum(contratos.mrr) })
        .from(contratos)
        .innerJoin(leads, eq(contratos.leadId, leads.id))
        .where(and(
          eq(contratos.status, "ativo"),
          eq(leads.organizacaoId, orgId),
          lt(contratos.createdAt, b.end)
        ));
      return Number(r.total) || 0;
    })
  );

  return c.json({
    leads: { total: leadsCurrentN, delta: Math.round(leadsDelta * 100) / 100, trend: leadsTrend },
    pipeline: { total: pipelineCurrentN, delta: Math.round(pipelineDelta * 100) / 100, trend: pipelineTrend },
    winRate: { total: Math.round(winRateCurrentN * 100) / 100, delta: Math.round(winRateDelta * 100) / 100, trend: winRateTrend },
    mrr: { total: mrrCurrentN, delta: Math.round(mrrDelta * 100) / 100, trend: mrrTrend },
  });
});

// ─── Tendências (time-series) ───────────────────────────────────

// GET /relatorios/tendencias?periodo=30d&tipo=leads|negocios|mrr
app.get("/tendencias", async (c) => {
  const ctx = await getCtx(c);
  const periodo = c.req.query("periodo") ?? "30d";
  const tipo = c.req.query("tipo") ?? "leads";
  const { since, until } = periodWindow(periodo);
  const orgId = ctx.organizacaoId;

  if (tipo === "leads") {
    const rows = await db
      .select({
        week: sql<string>`date_trunc('week', ${leads.createdAt})`.as("week"),
        origem: leads.origem,
        total: count(),
      })
      .from(leads)
      .where(and(eq(leads.organizacaoId, orgId), gte(leads.createdAt, since), lt(leads.createdAt, until)))
      .groupBy(sql`date_trunc('week', ${leads.createdAt})`, leads.origem)
      .orderBy(sql`date_trunc('week', ${leads.createdAt})`);

    // Pivot: group by week, origens as sub-keys
    const weekMap = new Map<string, { total: number; origens: Record<string, number> }>();
    for (const row of rows) {
      const weekKey = row.week;
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { total: 0, origens: {} });
      }
      const entry = weekMap.get(weekKey)!;
      const cnt = Number(row.total);
      entry.total += cnt;
      entry.origens[row.origem || "desconhecido"] = cnt;
    }

    const data = Array.from(weekMap.entries()).map(([periodo, vals]) => ({
      periodo,
      total: vals.total,
      origens: vals.origens,
    }));

    return c.json({ data });
  }

  if (tipo === "negocios") {
    // "Negócios ganhos ao longo do tempo" usa ganho_at (data REAL do fechamento).
    // status_changes.created_at é da importação (hoje), não serve pra série temporal.
    // Perdidos não têm data de perda preservada da migração, então a série é de ganhos.
    const rows = await db
      .select({
        week: sql<string>`date_trunc('week', ${negocios.ganhoAt})`.as("week"),
        total: count(),
        receita: sum(negocios.valorTotal),
      })
      .from(negocios)
      .where(and(
        eq(negocios.organizacaoId, orgId),
        eq(negocios.status, "ganho"),
        isNotNull(negocios.ganhoAt),
        gte(negocios.ganhoAt, since),
        lt(negocios.ganhoAt, until)
      ))
      .groupBy(sql`date_trunc('week', ${negocios.ganhoAt})`)
      .orderBy(sql`date_trunc('week', ${negocios.ganhoAt})`);

    const data = rows.map((row) => ({
      periodo: row.week,
      ganhos: Number(row.total),
      perdidos: 0,
      receita: Number(row.receita) || 0,
    }));

    return c.json({ data });
  }

  if (tipo === "mrr") {
    // MRR fechado mês a mês: usa contratos.inicio (data REAL de início), não created_at
    // (que é da importação). Mostra os últimos 12 meses, independente do seletor.
    const desde12m = new Date(until);
    desde12m.setMonth(desde12m.getMonth() - 12);
    const desde12mStr = floorGoLive(desde12m).toISOString().slice(0, 10); // piso go-live; coluna `inicio` é date
    const rows = await db
      .select({
        month: sql<string>`date_trunc('month', ${contratos.inicio})`.as("month"),
        mrr: sum(contratos.mrr),
        contratos: count(),
      })
      .from(contratos)
      .innerJoin(leads, eq(contratos.leadId, leads.id))
      .where(and(
        eq(contratos.status, "ativo"),
        eq(leads.organizacaoId, orgId),
        isNotNull(contratos.inicio),
        gte(contratos.inicio, desde12mStr)
      ))
      .groupBy(sql`date_trunc('month', ${contratos.inicio})`)
      .orderBy(sql`date_trunc('month', ${contratos.inicio})`);

    const data = rows.map((row) => ({
      periodo: row.month,
      mrr: Number(row.mrr) || 0,
      contratos: Number(row.contratos),
    }));

    return c.json({ data });
  }

  return c.json({ error: "tipo must be leads, negocios, or mrr" }, 400);
});

// ─── Equipe (team performance) ──────────────────────────────────

// GET /relatorios/equipe?periodo=30d
app.get("/equipe", async (c) => {
  const ctx = await getCtx(c);
  const periodo = c.req.query("periodo") ?? "30d";
  const { since, until } = periodWindow(periodo);
  const orgId = ctx.organizacaoId;

  // Vendedores relevantes: exclui admin/gerente/super_admin e o usuário de backup.
  const userList = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(and(
      eq(usuarios.organizacaoId, orgId),
      not(inArray(usuarios.role, ["admin", "gerente", "super_admin"])),
      not(sql`${usuarios.nome} ILIKE '%backup%'`)
    ));

  // Negocios stats per responsavel
  const negocioStats = await db
    .select({
      responsavelId: negocios.responsavelId,
      status: negocios.status,
      total: count(),
      receitaTotal: sum(negocios.valorTotal),
      cicloMedio: sql<number>`avg(CASE WHEN ${negocios.ganhoAt} >= ${negocios.createdAt} THEN extract(epoch from ${negocios.ganhoAt} - ${negocios.createdAt}) / 86400 END)`,
    })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      gte(negocios.createdAt, since),
      lt(negocios.createdAt, until),
      isNotNull(negocios.responsavelId)
    ))
    .groupBy(negocios.responsavelId, negocios.status);

  // Leads per responsavel
  const leadStats = await db
    .select({
      responsavelId: leads.responsavelId,
      total: count(),
    })
    .from(leads)
    .where(and(
      eq(leads.organizacaoId, orgId),
      gte(leads.createdAt, since),
      lt(leads.createdAt, until),
      isNotNull(leads.responsavelId)
    ))
    .groupBy(leads.responsavelId);

  // Atividades per usuario
  const atividadeStats = await db
    .select({
      usuarioId: atividades.usuarioId,
      total: count(),
    })
    .from(atividades)
    .where(and(
      eq(atividades.organizacaoId, orgId),
      gte(atividades.createdAt, since),
      lt(atividades.createdAt, until),
      isNotNull(atividades.usuarioId)
    ))
    .groupBy(atividades.usuarioId);

  // Qualificados (lado SDR) por responsável no período
  const qualifStats = await db
    .select({ responsavelId: leads.responsavelId, total: count() })
    .from(leads)
    .where(and(
      eq(leads.organizacaoId, orgId),
      gte(leads.createdAt, since),
      lt(leads.createdAt, until),
      eq(leads.sdrStatus, "qualified"),
      isNotNull(leads.responsavelId)
    ))
    .groupBy(leads.responsavelId);

  // Merge by user
  const membros = userList.map((user) => {
    const userNegocios = negocioStats.filter((n) => n.responsavelId === user.id);
    const ganhos = Number(userNegocios.find((n) => n.status === "ganho")?.total || 0);
    const perdidos = Number(userNegocios.find((n) => n.status === "perdido")?.total || 0);
    const receitaTotal = Number(userNegocios.find((n) => n.status === "ganho")?.receitaTotal || 0);
    const cicloMedio = userNegocios.find((n) => n.status === "ganho")?.cicloMedio;
    const leadsAtribuidos = Number(leadStats.find((l) => l.responsavelId === user.id)?.total || 0);
    const atividadesTotal = Number(atividadeStats.find((a) => a.usuarioId === user.id)?.total || 0);
    const qualificados = Number(qualifStats.find((q) => q.responsavelId === user.id)?.total || 0);

    return {
      usuarioId: user.id,
      nome: user.nome,
      role: user.role,
      qualificados,
      ganhos,
      perdidos,
      winRate: (ganhos + perdidos) > 0 ? Math.round((ganhos / (ganhos + perdidos)) * 10000) / 100 : 0,
      receitaTotal,
      cicloMedio: cicloMedio != null ? Math.round(Number(cicloMedio) * 100) / 100 : null,
      leadsAtribuidos,
      atividadesTotal,
    };
  });

  return c.json({ membros });
});

// ─── Comercial ───────────────────────────────────────────────────

// GET /relatorios/comercial
app.get("/comercial", async (c) => {
  const ctx = await getCtx(c);

  const orgFilter = eq(negocios.organizacaoId, ctx.organizacaoId);

  // Pipeline revenue: sum mrr_estimado + valor_projeto grouped by status
  const pipelineMrr = await db
    .select({
      status: negocios.status,
      mrrTotal: sum(negocios.mrrEstimado),
      projetoTotal: sum(negocios.valorProjeto),
      total: count(),
    })
    .from(negocios)
    .where(orgFilter)
    .groupBy(negocios.status);

  // Win rate: ganho / (ganho + perdido) — only count pipeline deals, not carteira clones
  const winRateData = await db
    .select({
      status: negocios.status,
      total: count(),
    })
    .from(negocios)
    .where(and(orgFilter, inArray(negocios.status, ["ganho", "perdido"]), eq(negocios.origemNegocio, "novo")))
    .groupBy(negocios.status);

  const ganhos = Number(winRateData.find((r) => r.status === "ganho")?.total || 0);
  const perdidos = Number(winRateData.find((r) => r.status === "perdido")?.total || 0);
  const totalDecididos = ganhos + perdidos;
  const winRate = totalDecididos > 0 ? ganhos / totalDecididos : 0;

  // Motivos de perda
  const motivosPerda = await db
    .select({
      motivoPerda: negocios.motivoPerda,
      total: count(),
    })
    .from(negocios)
    .where(and(orgFilter, eq(negocios.status, "perdido")))
    .groupBy(negocios.motivoPerda);

  // Ciclo médio (avg days from createdAt to ganhoAt for won deals)
  const [cicloResult] = await db
    .select({
      cicloMedio: sql<number>`avg(CASE WHEN ${negocios.ganhoAt} >= ${negocios.createdAt} THEN extract(epoch from ${negocios.ganhoAt} - ${negocios.createdAt}) / 86400 END)`,
    })
    .from(negocios)
    .where(and(orgFilter, eq(negocios.status, "ganho"), isNotNull(negocios.ganhoAt)));

  // Negocios abertos
  const [abertosResult] = await db
    .select({ total: count() })
    .from(negocios)
    .where(and(orgFilter, not(inArray(negocios.status, ["ganho", "perdido", "churned"]))));

  return c.json({
    pipelineMrr,
    winRate: Math.round(winRate * 1000) / 10, // % com 1 casa decimal (ex: 60.7)
    motivosPerda: motivosPerda.map((m) => ({ motivo: m.motivoPerda || "Não informado", count: Number(m.total) })),
    cicloMedio: cicloResult.cicloMedio != null ? Math.round(Number(cicloResult.cicloMedio) * 100) / 100 : null,
    negociosAbertos: Number(abertosResult.total),
  });
});

// ─── Marketing ───────────────────────────────────────────────────

// GET /relatorios/marketing
app.get("/marketing", async (c) => {
  const ctx = await getCtx(c);

  const periodo = c.req.query("periodo") ?? "30d";
  const { since, until } = periodWindow(periodo);
  const orgId = ctx.organizacaoId;
  const orgFilter = eq(leads.organizacaoId, orgId);
  const dateRange = and(gte(leads.createdAt, since), lt(leads.createdAt, until));

  // Leads por canal (origem)
  const leadsPorCanal = await db
    .select({ origem: leads.origem, total: count() })
    .from(leads)
    .where(and(orgFilter, dateRange))
    .groupBy(leads.origem);

  // ── Funil 1: pré-vendas (esteira SDR) — cumulativo ──
  const sdrRows = await db
    .select({ sdrStatus: leads.sdrStatus, total: count() })
    .from(leads)
    .where(and(orgFilter, dateRange))
    .groupBy(leads.sdrStatus);
  const sg = (s: string) => Number(sdrRows.find((r) => r.sdrStatus === s)?.total || 0);
  const sNovo = sg("pending"), sCont = sg("contacted"), sQ = sg("qualifying"), sQd = sg("qualified"), sDq = sg("disqualified");
  const totalSdr = sNovo + sCont + sQ + sQd + sDq;
  const funilPreVendas = [
    { stage: "novo", label: "Novo", total: totalSdr },
    { stage: "contacted", label: "Em contato", total: sCont + sQ + sQd },
    { stage: "qualifying", label: "Qualificando", total: sQ + sQd },
    { stage: "qualified", label: "Qualificado", total: sQd },
  ];

  // ── Funil 2: vendas (pipeline do closer) — snapshot por etapa ──
  const negRows = await db
    .select({ status: negocios.status, total: count() })
    .from(negocios)
    .where(eq(negocios.organizacaoId, orgId))
    .groupBy(negocios.status);
  const ng = (s: string) => Number(negRows.find((r) => r.status === s)?.total || 0);
  // Ganhos do PERÍODO (por ganho_at) — pra o histórico all-time não dominar o funil
  const [ganhosPeriodo] = await db
    .select({ total: count() })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "ganho"),
      isNotNull(negocios.ganhoAt),
      gte(negocios.ganhoAt, since),
      lt(negocios.ganhoAt, until)
    ));
  const funilVendas = [
    { stage: "reuniao_agendada", label: "Reunião agendada", total: ng("reuniao_agendada") },
    { stage: "reuniao_realizada", label: "Reunião realizada", total: ng("reuniao_realizada") },
    { stage: "trial", label: "Trial", total: ng("trial") },
    { stage: "proposta_apresentada", label: "Proposta", total: ng("proposta_apresentada") },
    { stage: "negociacao_iniciada", label: "Negociação", total: ng("negociacao_iniciada") },
    { stage: "ganho", label: "Ganho (período)", total: Number(ganhosPeriodo.total) },
  ];

  // ── CPL por campanha e por criativo (Meta Ads real: gasto/leads) ──
  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);
  type Linha = { nome: string; campaignId?: string; campanha?: string; gasto: number; leads: number; cpl: number | null; cliques: number; impressoes: number; qualificados?: number; clientes?: number; cpq?: number | null; cpc?: number | null };
  let cpl_por_campanha: Linha[] = [];
  let por_criativo: Linha[] = [];
  let metaErro: string | undefined;
  if (metaConfigured()) {
    try {
      const [camp, ads] = await Promise.all([
        fetchMetaCampaignInsights(sinceStr, untilStr),
        fetchMetaAdInsights(sinceStr, untilStr),
      ]);
      cpl_por_campanha = camp
        .map((m) => ({ nome: m.campaignName, campaignId: m.campaignId, gasto: Math.round(m.gasto * 100) / 100, leads: m.leads, cpl: m.cpl, cliques: m.cliques, impressoes: m.impressoes }))
        .sort((a, b) => b.gasto - a.gasto);
      por_criativo = ads
        .map((m) => ({ nome: m.adName, campanha: m.campaignName, gasto: Math.round(m.gasto * 100) / 100, leads: m.leads, cpl: m.cpl, cliques: m.cliques, impressoes: m.impressoes }))
        .sort((a, b) => b.gasto - a.gasto)
        .slice(0, 50);
    } catch (e) {
      metaErro = String(e);
    }
  }

  // ── CPQ (custo por lead qualificado) e CPC (custo por cliente) por campanha ──
  // Qualificado = lead que saiu do pré-vendas pro pipeline do closer (sdr_status='qualified'
  // ou já tem negócio vinculado). Cliente = lead que virou cliente (closer ganhou).
  // Casa o gasto Meta (campaignId) com os contadores do CRM (utm_campaign).
  if (cpl_por_campanha.length > 0) {
    const [qualRows, cliRows] = await Promise.all([
      db.select({ utm: leads.utmCampaign, total: count() }).from(leads)
        .where(and(orgFilter, dateRange, or(eq(leads.sdrStatus, "qualified"), isNotNull(leads.negocioAtivoId))))
        .groupBy(leads.utmCampaign),
      db.select({ utm: leads.utmCampaign, total: count() }).from(leads)
        .where(and(orgFilter, dateRange, eq(leads.tipo, "cliente")))
        .groupBy(leads.utmCampaign),
    ]);
    const qualMap = new Map(qualRows.map((r) => [String(r.utm ?? ""), Number(r.total)]));
    const cliMap = new Map(cliRows.map((r) => [String(r.utm ?? ""), Number(r.total)]));
    const pick = (m: Map<string, number>, id?: string, nome?: string) => m.get(id ?? "") ?? m.get(nome ?? "") ?? 0;
    cpl_por_campanha = cpl_por_campanha.map((c) => {
      const q = pick(qualMap, c.campaignId, c.nome);
      const cl = pick(cliMap, c.campaignId, c.nome);
      return {
        ...c,
        qualificados: q,
        clientes: cl,
        cpq: q > 0 ? Math.round((c.gasto / q) * 100) / 100 : null,
        cpc: cl > 0 ? Math.round((c.gasto / cl) * 100) / 100 : null,
      };
    });
  }

  // Total qualificados (esteira SDR)
  const totalQualificados = sQd;

  return c.json({
    periodo,
    leads_por_canal: leadsPorCanal,
    funilPreVendas,
    funilVendas,
    cpl_por_campanha,
    por_criativo,
    metaConfigured: metaConfigured(),
    metaErro,
    totalQualificados,
  });
});

// ─── Pós-Venda ───────────────────────────────────────────────────

// GET /relatorios/pos-venda
app.get("/pos-venda", async (c) => {
  const ctx = await getCtx(c);

  // MRR total ativo — join with leads for org filtering
  const [mrrResult] = await db
    .select({
      mrrTotal: sum(contratos.mrr),
      totalContratos: count(),
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.status, "ativo"), eq(leads.organizacaoId, ctx.organizacaoId)));

  // NPS medio — join npsRespostas -> contratos -> leads for org filtering
  const [npsResult] = await db
    .select({
      media: avg(npsRespostas.score),
      total: count(),
    })
    .from(npsRespostas)
    .innerJoin(contratos, eq(npsRespostas.contratoId, contratos.id))
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(isNotNull(npsRespostas.respondidoEm), eq(leads.organizacaoId, ctx.organizacaoId)));

  // NPS distribuicao
  const npsBase = db
    .select({
      score: npsRespostas.score,
    })
    .from(npsRespostas)
    .innerJoin(contratos, eq(npsRespostas.contratoId, contratos.id))
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(isNotNull(npsRespostas.respondidoEm), eq(leads.organizacaoId, ctx.organizacaoId)))
    .as("nps_base");

  const detratores = await db
    .select({ total: count() })
    .from(npsBase)
    .where(lte(npsBase.score, 6));

  const neutros = await db
    .select({ total: count() })
    .from(npsBase)
    .where(and(gte(npsBase.score, 7), lte(npsBase.score, 8)));

  const promotores = await db
    .select({ total: count() })
    .from(npsBase)
    .where(gte(npsBase.score, 9));

  // Churn rate: cancelados / total contratos
  const [totalContratosResult] = await db
    .select({ total: count() })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(eq(leads.organizacaoId, ctx.organizacaoId));

  const [canceladosResult] = await db
    .select({ total: count() })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.status, "cancelado"), eq(leads.organizacaoId, ctx.organizacaoId)));

  const totalContratosAll = Number(totalContratosResult.total) || 0;
  const totalCancelados = Number(canceladosResult.total) || 0;
  const churnRate = totalContratosAll > 0 ? Math.round((totalCancelados / totalContratosAll) * 10000) / 100 : 0;

  // Contratos vencendo nos próximos 90 dias
  const now = new Date();
  const in90Days = new Date(Date.now() + 90 * 86400000);
  const contratosVencendoRows = await db
    .select({
      leadNome: leads.nome,
      mrr: contratos.mrr,
      vencimento: contratos.vencimento,
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(
      eq(leads.organizacaoId, ctx.organizacaoId),
      eq(contratos.status, "ativo"),
      isNotNull(contratos.vencimento),
      gte(contratos.vencimento, sql`CURRENT_DATE`),
      lte(contratos.vencimento, sql`CURRENT_DATE + interval '90 days'`)
    ))
    .orderBy(contratos.vencimento);

  const contratosVencendo = contratosVencendoRows.map((row) => {
    const vencDate = new Date(row.vencimento!);
    const diasRestantes = Math.ceil((vencDate.getTime() - now.getTime()) / 86400000);
    return {
      leadNome: row.leadNome,
      mrr: Number(row.mrr) || 0,
      vencimento: row.vencimento,
      diasRestantes,
    };
  });

  // MRR por tipo de contrato
  const mrrPorTipoRows = await db
    .select({
      tipo: contratos.tipo,
      mrr: sum(contratos.mrr),
      count: count(),
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.status, "ativo"), eq(leads.organizacaoId, ctx.organizacaoId)))
    .groupBy(contratos.tipo);

  const mrrPorTipo = mrrPorTipoRows.map((row) => ({
    tipo: row.tipo,
    mrr: Number(row.mrr) || 0,
    count: Number(row.count),
  }));

  return c.json({
    mrr_total_ativo: Number(mrrResult.mrrTotal) || 0,
    contratos_ativos: Number(mrrResult.totalContratos) || 0,
    nps_medio: npsResult.media ? Number(npsResult.media) : null,
    nps_total_respostas: Number(npsResult.total) || 0,
    nps_distribuicao: {
      detratores: Number(detratores[0].total) || 0,
      neutros: Number(neutros[0].total) || 0,
      promotores: Number(promotores[0].total) || 0,
    },
    churnRate,
    contratosVencendo,
    mrrPorTipo,
  });
});

// ─── Tracking por campanha/origem (funil: leads→qualif→oport→ganho→MRR) ───
// GET /relatorios/tracking[?desde=YYYY-MM-DD]
app.get("/tracking", async (c) => {
  const ctx = await getCtx(c);
  const org = ctx.organizacaoId;
  // respeita o seletor de período da tela (presets ou custom). "all" = histórico.
  const periodo = c.req.query("periodo") ?? "all";
  let sinceStr: string | undefined;
  let untilStr: string | undefined;
  if (periodo && periodo !== "all") {
    const p = parsePeriodo(periodo);
    sinceStr = p.since.toISOString().slice(0, 10);
    untilStr = p.until.toISOString().slice(0, 10);
  }
  const dateFilter = sinceStr
    ? sql`AND l.created_at >= ${sinceStr}::date AND l.created_at < (${untilStr}::date + 1)`
    : sql``;

  // Atribuição CORRETA: a utm vive no lead inbound; ao converter, a MESMA linha vira
  // tipo='cliente' mantendo a utm. Então NÃO filtra por tipo. Receita real vem do
  // Stripe (assinatura ativa do próprio lead), não do negócio do Zoho.
  const dateLeadsL = sinceStr
    ? sql`AND l.created_at >= ${sinceStr}::date AND l.created_at < (${untilStr}::date + 1)`
    : sql``;
  const funilPor = async (dim: string) => {
    const colL = sql.raw(`l.${dim}`);
    const colBare = sql.raw(dim);
    const rows = await db.execute(sql`
      WITH lead_dim AS (
        SELECT DISTINCT lower(email) AS email, ${colBare} AS chave
        FROM leads
        WHERE organizacao_id = ${org}
          AND email IS NOT NULL AND email <> '' AND ${colBare} IS NOT NULL AND ${colBare} <> ''
      ),
      leads_agg AS (
        SELECT ${colL} AS chave,
          count(DISTINCT l.id) AS leads,
          count(DISTINCT l.id) FILTER (WHERE l.sdr_status IN ('qualifying','qualified')) AS qualificados,
          count(DISTINCT l.id) FILTER (WHERE a.id IS NOT NULL) AS clientes,
          COALESCE(sum(a.mrr) FILTER (WHERE a.id IS NOT NULL), 0) AS mrr_real
        FROM leads l
        LEFT JOIN assinaturas a ON a.lead_id = l.id AND a.status IN ('active','trialing','past_due')
        WHERE l.organizacao_id = ${org} AND ${colL} IS NOT NULL AND ${colL} <> ''
        ${dateLeadsL}
        GROUP BY ${colL}
      ),
      deals_agg AS (
        SELECT ld.chave,
          count(DISTINCT n.id) AS oportunidades,
          count(DISTINCT n.id) FILTER (WHERE n.status = 'ganho') AS ganhos
        FROM negocios n
        JOIN leads cont ON cont.id = n.lead_id AND cont.email IS NOT NULL
        JOIN lead_dim ld ON ld.email = lower(cont.email)
        WHERE n.organizacao_id = ${org}
        GROUP BY ld.chave
      )
      SELECT la.chave, la.leads, la.qualificados, la.clientes, la.mrr_real,
        COALESCE(da.oportunidades, 0) AS oportunidades,
        COALESCE(da.ganhos, 0) AS ganhos
      FROM leads_agg la
      LEFT JOIN deals_agg da ON da.chave = la.chave
      ORDER BY la.leads DESC
      LIMIT 200
    `);
    return (rows as unknown as Record<string, unknown>[]).map((r) => ({
      chave: r.chave as string,
      leads: Number(r.leads),
      qualificados: Number(r.qualificados),
      clientes: Number(r.clientes),
      mrrReal: Number(r.mrr_real),
      oportunidades: Number(r.oportunidades),
      ganhos: Number(r.ganhos),
      taxaQualificacao: Number(r.leads) > 0 ? Number(r.qualificados) / Number(r.leads) : 0,
      taxaConversao: Number(r.leads) > 0 ? Number(r.clientes) / Number(r.leads) : 0,
    }));
  };

  const [porCampanha, porSource, porMedium, porOrigem] = await Promise.all([
    funilPor("utm_campaign"),
    funilPor("utm_source"),
    funilPor("utm_medium"),
    funilPor("origem"),
  ]);

  const tot = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE l.tipo='lead') AS total_leads,
      count(*) FILTER (WHERE l.tipo='lead' AND l.utm_campaign IS NOT NULL AND l.utm_campaign <> '') AS leads_rastreados
    FROM leads l WHERE l.organizacao_id = ${org} ${dateFilter}
  `);
  const t = (tot as unknown as Record<string, unknown>[])[0] ?? {};

  // ── Atribuição: receita ativa total vs quanto liga a alguma campanha (utm) ──
  const atr = await db.execute(sql`
    SELECT
      COALESCE(round(sum(a.mrr)::numeric,2),0) AS mrr_total,
      COALESCE(round(sum(a.mrr) FILTER (WHERE l.utm_campaign IS NOT NULL AND l.utm_campaign <> '')::numeric,2),0) AS mrr_atribuido,
      count(DISTINCT a.lead_id) AS clientes_total,
      count(DISTINCT a.lead_id) FILTER (WHERE l.utm_campaign IS NOT NULL AND l.utm_campaign <> '') AS clientes_atribuidos
    FROM assinaturas a JOIN leads l ON l.id = a.lead_id
    WHERE a.organizacao_id = ${org} AND a.status IN ('active','trialing','past_due')
  `);
  const ar = (atr as unknown as Record<string, unknown>[])[0] ?? {};
  const atribuicao = {
    mrrTotal: Number(ar.mrr_total ?? 0),
    mrrAtribuido: Number(ar.mrr_atribuido ?? 0),
    clientesTotal: Number(ar.clientes_total ?? 0),
    clientesAtribuidos: Number(ar.clientes_atribuidos ?? 0),
    pctAtribuido: Number(ar.mrr_total ?? 0) > 0 ? Number(ar.mrr_atribuido ?? 0) / Number(ar.mrr_total ?? 0) : 0,
  };

  // ── Meta Ads: gasto/CPL/CAC/ROAS por campanha (cruza por nome normalizado) ──
  type MetaResumo = {
    configured: boolean;
    totalGasto: number;
    totalLeads: number;
    naoCasadas: { campanha: string; gasto: number; leads: number }[];
    erro?: string;
  };
  const meta: MetaResumo = { configured: metaConfigured(), totalGasto: 0, totalLeads: 0, naoCasadas: [] };
  if (meta.configured) {
    try {
      const mSince = sinceStr ?? new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      const mUntil = untilStr ?? new Date().toISOString().slice(0, 10);
      const insights = await fetchMetaCampaignInsights(mSince, mUntil);
      const map = new Map<string, { gasto: number; leads: number; cliques: number; nome: string }>();
      for (const i of insights) {
        const k = normCampanha(i.campaignName);
        const cur = map.get(k) ?? { gasto: 0, leads: 0, cliques: 0, nome: i.campaignName };
        cur.gasto += i.gasto; cur.leads += i.leads; cur.cliques += i.cliques;
        map.set(k, cur);
      }
      meta.totalGasto = Math.round(insights.reduce((s, i) => s + i.gasto, 0) * 100) / 100;
      meta.totalLeads = insights.reduce((s, i) => s + i.leads, 0);
      const casadas = new Set<string>();
      for (const row of porCampanha as Array<Record<string, unknown>>) {
        const m = map.get(normCampanha(row.chave as string));
        if (!m) continue;
        casadas.add(normCampanha(row.chave as string));
        const clientes = Number(row.clientes);
        const mrr = Number(row.mrrReal);
        const leadsCrm = Number(row.leads);
        row.gastoMeta = Math.round(m.gasto * 100) / 100;
        row.leadsMeta = m.leads;
        row.cliquesMeta = m.cliques;
        row.cpl = m.leads > 0 ? m.gasto / m.leads : (leadsCrm > 0 ? m.gasto / leadsCrm : null);
        row.cac = clientes > 0 ? m.gasto / clientes : null; // gasto / clientes pagantes
        row.roas = m.gasto > 0 ? mrr / m.gasto : null; // MRR real mensal / gasto
      }
      meta.naoCasadas = [...map.entries()]
        .filter(([k]) => !casadas.has(k))
        .map(([, v]) => ({ campanha: v.nome, gasto: Math.round(v.gasto * 100) / 100, leads: v.leads }))
        .sort((a, b) => b.gasto - a.gasto)
        .slice(0, 50);
    } catch (e) {
      meta.erro = String(e);
    }
  }

  return c.json({
    periodo,
    totalLeads: Number(t.total_leads ?? 0),
    leadsRastreados: Number(t.leads_rastreados ?? 0),
    atribuicao,
    porCampanha,
    porSource,
    porMedium,
    porOrigem,
    meta,
  });
});

// ─── Fechado mês a mês (MRR fechado + ganhos × perdidos) ─────────
// Usa datas REAIS: ganhos por ganho_at, MRR por contratos.inicio. Perdidos não têm
// data de perda preservada da migração → usa created_at do negócio como proxy.
// Produto: tudo em "AI" (PABX foi excluído na importação).
// GET /relatorios/fechado-mensal?meses=12
app.get("/fechado-mensal", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;
  const meses = Math.min(parseInt(c.req.query("meses") || "12") || 12, 36);

  // Piso go-live (25/jun/2026): não conta meses anteriores ao go-live (histórico Zoho).
  const ganhos = await db.execute(sql`
    SELECT to_char(date_trunc('month', ganho_at), 'YYYY-MM') AS mes, count(*)::int AS qtd
    FROM negocios
    WHERE organizacao_id = ${orgId} AND status = 'ganho' AND ganho_at IS NOT NULL
      AND ganho_at >= GREATEST(date_trunc('month', now()) - make_interval(months => ${meses - 1}), TIMESTAMPTZ '2026-06-25 00:00:00-03')
    GROUP BY 1 ORDER BY 1
  `);

  const mrr = await db.execute(sql`
    SELECT to_char(date_trunc('month', c.inicio), 'YYYY-MM') AS mes, COALESCE(sum(c.mrr), 0)::float AS mrr
    FROM contratos c JOIN leads l ON l.id = c.lead_id
    WHERE l.organizacao_id = ${orgId} AND c.status = 'ativo' AND c.inicio IS NOT NULL
      AND c.inicio >= GREATEST((date_trunc('month', now()) - make_interval(months => ${meses - 1}))::date, DATE '2026-06-25')
    GROUP BY 1 ORDER BY 1
  `);

  const perdidos = await db.execute(sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, count(*)::int AS qtd
    FROM negocios
    WHERE organizacao_id = ${orgId} AND status = 'perdido'
      AND created_at >= GREATEST(date_trunc('month', now()) - make_interval(months => ${meses - 1}), TIMESTAMPTZ '2026-06-25 00:00:00-03')
    GROUP BY 1 ORDER BY 1
  `);

  type Mes = {
    mes: string;
    ganhosPabx: number; ganhosAi: number; ganhosOutros: number;
    mrrPabx: number; mrrAi: number; mrrOutros: number;
    perdidos: number; fatStripe: number; fatPabx: number;
  };
  const byMes: Record<string, Mes> = {};
  const ensure = (mes: string) => (byMes[mes] ||= {
    mes, ganhosPabx: 0, ganhosAi: 0, ganhosOutros: 0,
    mrrPabx: 0, mrrAi: 0, mrrOutros: 0, perdidos: 0, fatStripe: 0, fatPabx: 0,
  });
  const rowsOf = (r: unknown) => r as unknown as Record<string, unknown>[];
  for (const r of rowsOf(ganhos)) ensure(String(r.mes)).ganhosAi += Number(r.qtd);
  for (const r of rowsOf(mrr)) ensure(String(r.mes)).mrrAi += Number(r.mrr);
  for (const r of rowsOf(perdidos)) ensure(String(r.mes)).perdidos += Number(r.qtd);

  const series = Object.values(byMes).sort((a, b) => a.mes.localeCompare(b.mes));
  return c.json({ meses, series });
});

// ─── Esteira SDR (pré-qualificação) ──────────────────────────────
// Funil da esteira do SDR: Novo → Em contato → Qualificando → Qualificado (+ Desqualificado à parte).
// GET /relatorios/sdr-esteira?periodo=30d
app.get("/sdr-esteira", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;
  const periodo = c.req.query("periodo") ?? "30d";
  const { since, until } = periodWindow(periodo);
  const dateRange = and(gte(leads.createdAt, since), lt(leads.createdAt, until));

  // Snapshot por estágio do SDR (leads que entraram no período)
  const porStatus = await db
    .select({ sdrStatus: leads.sdrStatus, total: count() })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), dateRange))
    .groupBy(leads.sdrStatus);

  const get = (s: string) => Number(porStatus.find((r) => r.sdrStatus === s)?.total || 0);
  const novo = get("pending");
  const emContato = get("contacted");
  const qualificando = get("qualifying");
  const qualificado = get("qualified");
  const desqualificado = get("disqualified");
  const totalEsteira = novo + emContato + qualificando + qualificado + desqualificado;
  const trabalhados = emContato + qualificando + qualificado + desqualificado;

  // Funil em ordem (cumulativo decrescente: cada etapa = quem chegou nela ou além)
  // "Em contato" no funil = quem avançou na esteira (sem os desqualificados, que saem).
  // Casa com o funil de pré-vendas do /marketing.
  const funil = [
    { stage: "novo", label: "Novo", total: totalEsteira },
    { stage: "contacted", label: "Em contato", total: emContato + qualificando + qualificado },
    { stage: "qualifying", label: "Qualificando", total: qualificando + qualificado },
    { stage: "qualified", label: "Qualificado", total: qualificado },
  ];

  // Por responsável (SDR)
  const porResp = await db
    .select({ responsavelId: leads.responsavelId, sdrStatus: leads.sdrStatus, total: count() })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), dateRange, isNotNull(leads.responsavelId)))
    .groupBy(leads.responsavelId, leads.sdrStatus);

  const userList = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(eq(usuarios.organizacaoId, orgId));

  const porResponsavel = userList
    .map((u) => {
      const rows = porResp.filter((r) => r.responsavelId === u.id);
      const g = (s: string) => Number(rows.find((r) => r.sdrStatus === s)?.total || 0);
      const nv = g("pending"), ec = g("contacted"), qf = g("qualifying"), qd = g("qualified"), dq = g("disqualified");
      const tot = nv + ec + qf + qd + dq;
      const trab = ec + qf + qd + dq;
      return {
        usuarioId: u.id, nome: u.nome, role: u.role,
        total: tot, novo: nv, emContato: ec, qualificando: qf, qualificado: qd, desqualificado: dq,
        taxaQualificacao: trab > 0 ? Math.round((qd / trab) * 1000) / 10 : 0,
      };
    })
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);

  return c.json({
    funil,
    desqualificado,
    totalEsteira,
    trabalhados,
    taxaContato: totalEsteira > 0 ? Math.round((trabalhados / totalEsteira) * 1000) / 10 : 0,
    taxaQualificacao: trabalhados > 0 ? Math.round((qualificado / trabalhados) * 1000) / 10 : 0,
    porResponsavel,
  });
});

export const relatoriosRoutes = app;
