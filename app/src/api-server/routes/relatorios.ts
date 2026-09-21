import { Hono } from "hono";
import { db } from "@/lib/db";
import { negocios, leads, campanhas, contratos, npsRespostas, atividades, statusChanges, usuarios, reunioes, notas, ligacoes, tarefas, whatsappMensagens } from "@/lib/db/schema";
import { eq, count, sum, avg, and, inArray, sql, gte, isNotNull, lte, desc, not, between, lt, or } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { parsePeriodo, clampDesdeGoLive, GO_LIVE_ISO } from "@/lib/relatorios/periodo";
import { fetchMetaCampaignInsights, fetchMetaAdInsights, metaConfigured, normCampanha } from "@/lib/integrations/meta-insights";
import { isPersonalView, isAdminView } from "@/lib/auth/roles";
import {
  getPipelineAtual, getWinRate, getMotivosPerda, getCicloMedio,
  getFechadoPeriodo, getTicketMedio, getFunilConversao, getPipelineEsfriando,
  getLeadsQualificados, getFechadoPorResponsavel, crescimento,
} from "@/lib/relatorios/comercial";
import { contarReunioes, getPerdidosPorResponsavel, getFunilVendasEventos } from "@/lib/relatorios/funil-eventos";
import { getEsteiraSdr } from "@/lib/relatorios/esteira-sdr";
import { getVisoesSdr, ESTAGNADO_DIAS } from "@/lib/relatorios/sdr-visoes";
import { getLeadsPorCanal } from "@/lib/relatorios/canais";
import { getMetaComercialAgregada } from "@/lib/metas";
import { CLOSER_EXTRA_IDS } from "@/lib/metas-shared";
import {
  getMetricasPorCampanha, getMetricasPorCriativo, getMetricasPorConjunto, agregarFunil, gerarAlertas, rankingPorRoas,
  getStatusAtualLeadsPagos, getReceitaAtribuida, getRoasCiclo, getPipelineAbertoPago,
} from "@/lib/relatorios/midia-paga";
import { listarVendasFechadas, listarAgendasRealizadas, listarVendasAtribuidasSdr } from "@/lib/relatorios/fechamento-comercial";
import ExcelJS from "exceljs";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// F6/Analytics: lê o snapshot pré-computado (metricas_diarias), não recalcula
// nada aqui — o cálculo roda no worker (job "snapshot-diario", a cada 1h).
// Se ainda não rodou hoje pra essa org, calcula na hora (fallback, mesma
// função do worker) em vez de devolver vazio — evita a UI ficar sem dado
// só porque o job agendado ainda não passou.
app.get("/snapshot-diario", async (c) => {
  const ctx = await getCtx(c);
  const { metricasDiarias } = await import("@/lib/db/schema");
  const hoje = new Date().toISOString().split("T")[0];

  let [snapshot] = await db
    .select()
    .from(metricasDiarias)
    .where(and(eq(metricasDiarias.organizacaoId, ctx.organizacaoId), eq(metricasDiarias.data, hoje)))
    .limit(1);

  if (!snapshot) {
    const { calcularSnapshotDiario } = await import("@/lib/analytics/snapshot-diario");
    const calculado = await calcularSnapshotDiario(ctx.organizacaoId);
    return c.json({ ...calculado, calculadoAgora: true });
  }

  return c.json(snapshot);
});

// ─── Helpers ────────────────────────────────────────────────────

// Janela do período selecionado (respeita "custom:from:to" e presets "7d/30d/...").
// Retorna since/until + a janela anterior de mesma duração (pra deltas).
// O piso de go-live já é aplicado dentro de parsePeriodo (lib/relatorios/periodo).
function periodWindow(periodo: string) {
  const { since, until } = parsePeriodo(periodo);
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
  const periodo = c.req.query("periodo") ?? "mes_atual";
  const { since, until, prevSince } = periodWindow(periodo);

  const orgId = ctx.organizacaoId;
  // Papel: closer vê só o dele; admin/gerente/leitor veem a org. (Win rate/pipeline batem com a aba.)
  const responsavelId = isPersonalView(ctx.userRole) ? ctx.userId : undefined;
  const leadResp = responsavelId ? eq(leads.responsavelId, responsavelId) : undefined;
  const buckets = getBuckets(since, until, 7);

  // ── Leads (período) ──
  const [leadsCurrent] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), leadResp, gte(leads.createdAt, since), lt(leads.createdAt, until)));
  const [leadsPrev] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), leadResp, gte(leads.createdAt, prevSince), lt(leads.createdAt, since)));
  const leadsTrend = await Promise.all(
    buckets.map(async (b) => {
      const [r] = await db
        .select({ total: count() })
        .from(leads)
        .where(and(eq(leads.organizacaoId, orgId), leadResp, gte(leads.createdAt, b.start), lt(leads.createdAt, b.end)));
      return Number(r.total);
    })
  );
  const leadsCurrentN = Number(leadsCurrent.total);

  // ── Pipeline = snapshot da operação AGORA (fonte única; NÃO reage ao período) ──
  const pipelineSnap = await getPipelineAtual(orgId, responsavelId);

  // ── Win rate = MESMA função da aba Comercial → topo e aba não divergem ──
  const wrCurrent = await getWinRate(orgId, since, until, responsavelId);
  const wrPrev = await getWinRate(orgId, prevSince, since, responsavelId);

  // ── MRR ativo ──
  const [mrrCurrent] = await db
    .select({ total: sum(contratos.mrr) })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.status, "ativo"), eq(leads.organizacaoId, orgId), leadResp));
  const [mrrPrev] = await db
    .select({ total: sum(contratos.mrr) })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.status, "ativo"), eq(leads.organizacaoId, orgId), leadResp, lt(contratos.createdAt, since)));
  const mrrCurrentN = Number(mrrCurrent.total) || 0;

  return c.json({
    leads: { total: leadsCurrentN, delta: crescimento(leadsCurrentN, Number(leadsPrev.total)), trend: leadsTrend },
    // Pipeline é estoque (snapshot), não série temporal → sem delta de período.
    pipeline: { total: pipelineSnap.total, delta: null, trend: [] },
    winRate: { total: wrCurrent.taxa, delta: crescimento(wrCurrent.taxa ?? 0, wrPrev.taxa ?? 0), trend: [] },
    mrr: { total: mrrCurrentN, delta: crescimento(mrrCurrentN, Number(mrrPrev.total) || 0), trend: [] },
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
    // DIÁRIO (pedido Kauã 22/07 — antes era semanal e escondia a variação do dia a dia)
    const rows = await db
      .select({
        week: sql<string>`date_trunc('day', ${leads.createdAt})`.as("week"),
        origem: leads.origem,
        total: count(),
      })
      .from(leads)
      .where(and(eq(leads.organizacaoId, orgId), gte(leads.createdAt, since), lt(leads.createdAt, until)))
      .groupBy(sql`date_trunc('day', ${leads.createdAt})`, leads.origem)
      .orderBy(sql`date_trunc('day', ${leads.createdAt})`);

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
    const desde12mStr = clampDesdeGoLive(desde12m).toISOString().slice(0, 10); // piso go-live; coluna `inicio` é date
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

  // Desempenho por Vendedor = só CLOSERS (papel), decisão Scott 30/jun.
  // Filtro por PAPEL (não por nome): role IN (closer, vendedor) + ativos. A SDR
  // (Jenifer, papel sdr) sai sozinha e tem o relatório próprio na aba Pré-vendas.
  // BLINDAGEM por papel: closer/sdr (personal view) só pode ver A SI MESMO — nunca
  // a equipe inteira (vale também em view-as). Admin/gerente veem todos.
  const soEu = isPersonalView(ctx.userRole) ? ctx.userId : null;
  const userList = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(and(
      eq(usuarios.organizacaoId, orgId),
      or(inArray(usuarios.role, ["closer", "vendedor"]), inArray(usuarios.id, CLOSER_EXTRA_IDS)),
      eq(usuarios.ativo, true),
      soEu ? eq(usuarios.id, soEu) : undefined,
    ));

  // Fechado por responsável = fonte única (janela ganho_at + receita na regra do
  // total). Antes: janela created_at + valor_total → Σ vendedores ≠ card do período
  // e receita individual maior que a receita total (auditoria itens 6/7).
  // Perdidos = EVENTO de perda na janela (status_changes), não coorte de criação.
  const [fechadoPorResp, perdidosPorResp] = await Promise.all([
    getFechadoPorResponsavel(orgId, since, until),
    getPerdidosPorResponsavel(orgId, since, until),
  ]);

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
    const fechado = fechadoPorResp.get(user.id);
    const ganhos = fechado?.ganhos ?? 0;
    const perdidos = perdidosPorResp.get(user.id) ?? 0;
    const receitaTotal = fechado?.receita ?? 0;
    const cicloMedio = fechado?.cicloMedio ?? null;
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
      cicloMedio,
      leadsAtribuidos,
      atividadesTotal,
    };
  });

  // Esconde inativos sem nenhum movimento no período (ex: Alisson zerado).
  // Mantém quem teve leads, atividades, qualificados ou negócios.
  const ativos = membros.filter(
    (m) => m.leadsAtribuidos > 0 || m.atividadesTotal > 0 || m.ganhos > 0 || m.perdidos > 0 || m.qualificados > 0
  );

  return c.json({ membros: ativos });
});

// ─── Atividade do Time (esforço, não resultado) ──────────────────
// Pedido do Kauã 27/07: /equipe e /sdr-esteira mostram RESULTADO (ganhos,
// qualificados). Isso aqui mostra ESFORÇO real por pessoa dia a dia — ligação,
// nota, mensagem, mudança de estágio, tarefa concluída — pra saber quem de fato
// está trabalhando, não só quem está performando. Cobre TODOS os papéis
// (inclui SDR/CDR, que fica de fora do /equipe). Só admin/gerente: é visão de
// gestão do time, não faz sentido em personal view (closer/SDR olhando a si
// mesmo já tem /equipe e /sdr-esteira).

// GET /relatorios/atividade-time?dias=14 — grid pessoa × dia
app.get("/atividade-time", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;

  if (isPersonalView(ctx.userRole)) return c.json({ error: "Sem permissão" }, 403);

  const dias = Math.min(Math.max(Number(c.req.query("dias")) || 14, 1), 31);
  const until = new Date();
  until.setUTCHours(0, 0, 0, 0);
  until.setUTCDate(until.getUTCDate() + 1); // fim exclusivo = amanhã 00:00 UTC
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - dias);

  const userList = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, orgId), eq(usuarios.ativo, true)));
  const userIds = userList.map((u) => u.id);
  if (userIds.length === 0) return c.json({ dias: [], membros: [] });

  const diaKey = (col: unknown) => sql<string>`to_char(date_trunc('day', ${col}), 'YYYY-MM-DD')`;

  const [ligacoesPorDia, notasPorDia, mensagensPorDia, mudancasPorDia, tarefasPorDia] = await Promise.all([
    db.select({
      usuarioId: ligacoes.usuarioId, dia: diaKey(ligacoes.createdAt), total: count(),
      duracao: sql<number>`coalesce(sum(${ligacoes.duracaoSegundos}), 0)`,
    }).from(ligacoes)
      .where(and(eq(ligacoes.organizacaoId, orgId), gte(ligacoes.createdAt, since), lt(ligacoes.createdAt, until), inArray(ligacoes.usuarioId, userIds)))
      .groupBy(ligacoes.usuarioId, diaKey(ligacoes.createdAt)),
    db.select({ usuarioId: notas.autorId, dia: diaKey(notas.createdAt), total: count() }).from(notas)
      .where(and(eq(notas.organizacaoId, orgId), gte(notas.createdAt, since), lt(notas.createdAt, until), inArray(notas.autorId, userIds)))
      .groupBy(notas.autorId, diaKey(notas.createdAt)),
    db.select({ usuarioId: whatsappMensagens.enviadoPorId, dia: diaKey(whatsappMensagens.createdAt), total: count() }).from(whatsappMensagens)
      .where(and(eq(whatsappMensagens.direcao, "out"), gte(whatsappMensagens.createdAt, since), lt(whatsappMensagens.createdAt, until), inArray(whatsappMensagens.enviadoPorId, userIds)))
      .groupBy(whatsappMensagens.enviadoPorId, diaKey(whatsappMensagens.createdAt)),
    db.select({ usuarioId: statusChanges.usuarioId, dia: diaKey(statusChanges.createdAt), total: count() }).from(statusChanges)
      .where(and(gte(statusChanges.createdAt, since), lt(statusChanges.createdAt, until), inArray(statusChanges.usuarioId, userIds)))
      .groupBy(statusChanges.usuarioId, diaKey(statusChanges.createdAt)),
    db.select({ usuarioId: tarefas.usuarioId, dia: diaKey(tarefas.concluidaEm), total: count() }).from(tarefas)
      .where(and(eq(tarefas.organizacaoId, orgId), eq(tarefas.concluida, true), gte(tarefas.concluidaEm, since), lt(tarefas.concluidaEm, until), inArray(tarefas.usuarioId, userIds)))
      .groupBy(tarefas.usuarioId, diaKey(tarefas.concluidaEm)),
  ]);

  const diasList: string[] = [];
  for (let d = new Date(since); d < until; d.setUTCDate(d.getUTCDate() + 1)) {
    diasList.push(d.toISOString().slice(0, 10));
  }

  type DiaStats = { ligacoes: number; duracaoLigacoesSegundos: number; notas: number; mensagens: number; mudancasEstagio: number; tarefasConcluidas: number; total: number };
  const vazio = (): DiaStats => ({ ligacoes: 0, duracaoLigacoesSegundos: 0, notas: 0, mensagens: 0, mudancasEstagio: 0, tarefasConcluidas: 0, total: 0 });

  const membros = userList.map((u) => {
    const porDia: Record<string, DiaStats> = {};
    for (const dia of diasList) porDia[dia] = vazio();

    for (const r of ligacoesPorDia) if (r.usuarioId === u.id && porDia[r.dia]) { porDia[r.dia].ligacoes = Number(r.total); porDia[r.dia].duracaoLigacoesSegundos = Number(r.duracao); }
    for (const r of notasPorDia) if (r.usuarioId === u.id && porDia[r.dia]) porDia[r.dia].notas = Number(r.total);
    for (const r of mensagensPorDia) if (r.usuarioId === u.id && porDia[r.dia]) porDia[r.dia].mensagens = Number(r.total);
    for (const r of mudancasPorDia) if (r.usuarioId === u.id && porDia[r.dia]) porDia[r.dia].mudancasEstagio = Number(r.total);
    for (const r of tarefasPorDia) if (r.usuarioId === u.id && porDia[r.dia]) porDia[r.dia].tarefasConcluidas = Number(r.total);

    let diasAtivos = 0;
    const totais = vazio();
    for (const dia of diasList) {
      const d = porDia[dia];
      d.total = d.ligacoes + d.notas + d.mensagens + d.mudancasEstagio + d.tarefasConcluidas;
      if (d.total > 0) diasAtivos++;
      totais.ligacoes += d.ligacoes;
      totais.duracaoLigacoesSegundos += d.duracaoLigacoesSegundos;
      totais.notas += d.notas;
      totais.mensagens += d.mensagens;
      totais.mudancasEstagio += d.mudancasEstagio;
      totais.tarefasConcluidas += d.tarefasConcluidas;
      totais.total += d.total;
    }

    return { usuarioId: u.id, nome: u.nome, role: u.role, porDia, totais, diasAtivos };
  })
    // Quem trabalhou menos primeiro — é exatamente quem o gestor quer ver de cara.
    .sort((a, b) => a.totais.total - b.totais.total);

  return c.json({ dias: diasList, membros });
});

// GET /relatorios/atividade-time/:usuarioId/:dia — feed do dia (drill-down)
app.get("/atividade-time/:usuarioId/:dia", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;
  if (isPersonalView(ctx.userRole)) return c.json({ error: "Sem permissão" }, 403);

  const usuarioId = c.req.param("usuarioId");
  const diaStr = c.req.param("dia");
  if (!UUID_RE.test(usuarioId) || !/^\d{4}-\d{2}-\d{2}$/.test(diaStr)) {
    return c.json({ error: "Parâmetros inválidos" }, 400);
  }
  const diaInicio = new Date(`${diaStr}T00:00:00.000Z`);
  const diaFim = new Date(diaInicio);
  diaFim.setUTCDate(diaFim.getUTCDate() + 1);

  const [ligacoesDia, notasDia, mensagensDia, mudancasDia, tarefasDia] = await Promise.all([
    db.select({
      id: ligacoes.id, createdAt: ligacoes.createdAt, duracaoSegundos: ligacoes.duracaoSegundos,
      callStatus: ligacoes.callStatus, leadId: ligacoes.leadId, negocioId: ligacoes.negocioId,
      leadNome: leads.nome, negocioTitulo: negocios.titulo,
    }).from(ligacoes)
      .leftJoin(leads, eq(ligacoes.leadId, leads.id))
      .leftJoin(negocios, eq(ligacoes.negocioId, negocios.id))
      .where(and(eq(ligacoes.organizacaoId, orgId), eq(ligacoes.usuarioId, usuarioId), gte(ligacoes.createdAt, diaInicio), lt(ligacoes.createdAt, diaFim))),
    db.select({
      id: notas.id, createdAt: notas.createdAt, conteudo: notas.conteudo, leadId: notas.leadId, negocioId: notas.negocioId,
      leadNome: leads.nome, negocioTitulo: negocios.titulo,
    }).from(notas)
      .leftJoin(leads, eq(notas.leadId, leads.id))
      .leftJoin(negocios, eq(notas.negocioId, negocios.id))
      .where(and(eq(notas.organizacaoId, orgId), eq(notas.autorId, usuarioId), gte(notas.createdAt, diaInicio), lt(notas.createdAt, diaFim))),
    db.select({
      id: whatsappMensagens.id, createdAt: whatsappMensagens.createdAt, conteudo: whatsappMensagens.conteudo,
      leadId: whatsappMensagens.leadId, leadNome: leads.nome,
    }).from(whatsappMensagens)
      .leftJoin(leads, eq(whatsappMensagens.leadId, leads.id))
      .where(and(eq(whatsappMensagens.enviadoPorId, usuarioId), eq(whatsappMensagens.direcao, "out"), gte(whatsappMensagens.createdAt, diaInicio), lt(whatsappMensagens.createdAt, diaFim))),
    db.select({
      id: statusChanges.id, createdAt: statusChanges.createdAt, deStatus: statusChanges.deStatus, paraStatus: statusChanges.paraStatus,
      leadId: statusChanges.leadId, negocioId: statusChanges.negocioId, leadNome: leads.nome, negocioTitulo: negocios.titulo,
    }).from(statusChanges)
      .leftJoin(leads, eq(statusChanges.leadId, leads.id))
      .leftJoin(negocios, eq(statusChanges.negocioId, negocios.id))
      .where(and(eq(statusChanges.usuarioId, usuarioId), gte(statusChanges.createdAt, diaInicio), lt(statusChanges.createdAt, diaFim))),
    db.select({
      id: tarefas.id, createdAt: tarefas.concluidaEm, titulo: tarefas.titulo,
      leadId: tarefas.leadId, negocioId: tarefas.negocioId, leadNome: leads.nome, negocioTitulo: negocios.titulo,
    }).from(tarefas)
      .leftJoin(leads, eq(tarefas.leadId, leads.id))
      .leftJoin(negocios, eq(tarefas.negocioId, negocios.id))
      .where(and(eq(tarefas.organizacaoId, orgId), eq(tarefas.usuarioId, usuarioId), eq(tarefas.concluida, true), gte(tarefas.concluidaEm, diaInicio), lt(tarefas.concluidaEm, diaFim))),
  ]);

  const CALL_STATUS_LABEL: Record<string, string> = {
    FINISHED: "finalizada", ANSWERED: "finalizada", COMPLETED: "finalizada",
    MISSED: "perdida", NOT_ANSWERED: "perdida", NO_ANSWER: "perdida",
    NOT_COMPLETED: "não completada", FAILED: "não completada", BUSY: "não completada",
  };
  const truncar = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

  const itens = [
    ...ligacoesDia.map((l) => ({
      tipo: "ligacao" as const,
      titulo: `Ligação ${CALL_STATUS_LABEL[String(l.callStatus || "").toUpperCase()] || "registrada"}${l.duracaoSegundos ? ` (${Math.floor(l.duracaoSegundos / 60)}m${String(l.duracaoSegundos % 60).padStart(2, "0")}s)` : ""}`,
      contexto: l.leadNome || l.negocioTitulo || null,
      leadId: l.leadId, negocioId: l.negocioId,
      createdAt: l.createdAt,
    })),
    ...notasDia.map((n) => ({
      tipo: "nota" as const,
      titulo: truncar(n.conteudo, 140),
      contexto: n.leadNome || n.negocioTitulo || null,
      leadId: n.leadId, negocioId: n.negocioId,
      createdAt: n.createdAt,
    })),
    ...mensagensDia.map((m) => ({
      tipo: "whatsapp" as const,
      titulo: m.conteudo ? truncar(m.conteudo, 140) : "(mídia)",
      contexto: m.leadNome || null,
      leadId: m.leadId, negocioId: null as string | null,
      createdAt: m.createdAt,
    })),
    ...mudancasDia.map((s) => ({
      tipo: "status_change" as const,
      titulo: `${s.deStatus || "—"} → ${s.paraStatus}`,
      contexto: s.leadNome || s.negocioTitulo || null,
      leadId: s.leadId, negocioId: s.negocioId,
      createdAt: s.createdAt,
    })),
    ...tarefasDia.map((t) => ({
      tipo: "tarefa" as const,
      titulo: `Tarefa concluída: ${t.titulo}`,
      contexto: t.leadNome || t.negocioTitulo || null,
      leadId: t.leadId, negocioId: t.negocioId,
      createdAt: t.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt as unknown as string).getTime() - new Date(a.createdAt as unknown as string).getTime());

  const resumo = {
    ligacoes: ligacoesDia.length,
    notas: notasDia.length,
    mensagens: mensagensDia.length,
    mudancasEstagio: mudancasDia.length,
    tarefasConcluidas: tarefasDia.length,
    total: itens.length,
  };

  return c.json({ resumo, itens });
});

// ─── Comercial ───────────────────────────────────────────────────

// GET /relatorios/comercial
app.get("/comercial", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;
  const periodo = c.req.query("periodo") ?? "mes_atual";
  const { since, until } = periodWindow(periodo);
  // Papel: closer vê só os negócios DELE; admin/gerente/leitor veem a org inteira.
  const responsavelId = isPersonalView(ctx.userRole) ? ctx.userId : undefined;

  const [pipeline, winRate, motivos, ciclo, fechado, ticket, funilConversao, esfriando, leadsQualificados] = await Promise.all([
    getPipelineAtual(orgId, responsavelId),              // snapshot — NÃO filtra período (decisão Scott)
    getWinRate(orgId, since, until, responsavelId),
    getMotivosPerda(orgId, since, until, responsavelId),
    getCicloMedio(orgId, since, until, responsavelId),
    getFechadoPeriodo(orgId, since, until, responsavelId),
    getTicketMedio(orgId, since, until, responsavelId),
    getFunilConversao(orgId, since, until, responsavelId),
    getPipelineEsfriando(orgId, responsavelId),
    getLeadsQualificados(orgId, since, until, responsavelId), // passou pré-vendas + call agendada
  ]);

  // Meta comercial = soma das metas das closers (visão de gestão). Meta é MENSAL:
  // usa o mês do início do período selecionado (antes havia um ternário no-op que
  // sempre caía no mês corrente, ignorando o seletor — auditoria item 12).
  const metaComercial = isAdminView(ctx.userRole)
    ? await getMetaComercialAgregada(orgId, since)
    : null;

  // INSIGHTS DE META. `getMetasPorVendedor` devolve exatamente o
  // `VendedorMetaInput` que `gerarInsights` pede — as duas metades foram
  // escritas para encaixar e ficaram sem ninguém encaixando: as duas tinham
  // ZERO chamadores até 21/09, enquanto o banco guarda 13 metas de 4
  // vendedores. O provider é heurístico (meta menos realizado), sem IA e sem
  // credencial.
  //
  // Só para quem vê a equipe: o insight nomeia pessoas, e closer em visão
  // pessoal enxerga apenas a si mesmo (mesma regra do bloco de equipe acima).
  let insights: import("@/lib/insights").Insight[] = [];
  if (isAdminView(ctx.userRole)) {
    try {
      const [{ getMetasPorVendedor }, { gerarInsights }] = await Promise.all([
        import("@/lib/metas"), import("@/lib/insights"),
      ]);
      const vendedores = await getMetasPorVendedor(orgId);
      insights = gerarInsights({ vendedores });
    } catch (e) {
      // Insight é leitura acessória: falhar aqui não derruba o relatório.
      console.error("[Relatorios] insights de meta indisponíveis:", e);
    }
  }

  // Histórico do que foi de fato fechado no período (drill-down: abre o negócio ganho).
  const ganhosList = await db
    .select({
      id: negocios.id,
      titulo: negocios.titulo,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      mrrFechado: negocios.mrrFechado,
      valorTotal: negocios.valorTotal,
      tipoReceita: negocios.tipoReceita,
      ganhoAt: negocios.ganhoAt,
    })
    .from(negocios)
    .leftJoin(leads, eq(negocios.leadId, leads.id))
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "ganho"),
      gte(negocios.ganhoAt, since),
      lt(negocios.ganhoAt, until),
      responsavelId ? eq(negocios.responsavelId, responsavelId) : undefined,
    ))
    .orderBy(desc(negocios.ganhoAt))
    .limit(200);

  return c.json({
    ganhosList,            // [{id,titulo,leadNome,leadEmpresa,mrrFechado,valorTotal,tipoReceita,ganhoAt}]
    // ─── Fonte única (o /resumo usa as MESMAS funções → topo e aba não divergem) ───
    pipeline,              // { etapas:[{status,count,recorrente,avulso,valor}], total, negociosAbertos, ponderado }
    winRateInfo: winRate,  // { ganhos, perdidos, n, taxa, amostraPequena }
    motivosInfo: motivos,  // { itens:[{motivo,count,pct}], total, semClassificacao, semClassificacaoPct }
    fechado,               // { ganhos, receita, recorrente, avulso }
    ticketMedio: ticket,
    funilConversao,        // { etapas:[{status,label,atingiu,taxaDoAnterior}] }
    pipelineEsfriando: esfriando, // [{id,titulo,status,valor,diasParado}]
    leadsQualificados,     // nº de leads que passaram pré-vendas + call agendada (período, escopo do papel)
    metaComercial,         // { valorAlvo, realizado, closers } | null  (soma das closers; só admin/gerente)
    insights,              // Insight[] — heurística sobre meta por vendedor; [] fora da visão de gestão
    forecast: pipeline.ponderado,
    // ─── compat com o TabComercial atual (até o front ser refatorado) ───
    pipelineMrr: pipeline.etapas.map((e) => ({ status: e.status, mrrTotal: e.recorrente, projetoTotal: e.avulso, total: e.count })),
    winRate: winRate.taxa ?? 0,
    motivosPerda: motivos.itens.map((i) => ({ motivo: i.motivo, count: i.count })),
    cicloMedio: ciclo,
    negociosAbertos: pipeline.negociosAbertos,
  });
});

// ─── Growth (visão CEO/estratégia — relatório completo) ──────────
// Agrega aquisição + funil + receita + pipeline + retenção + time num payload só.
// Respeita o filtro de período (este é o ÚNICO relatório com filtro). admin/gerente.
// GET /relatorios/growth?periodo=mes_atual
app.get("/growth", async (c) => {
  const ctx = await getCtx(c);
  if (!isAdminView(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  const orgId = ctx.organizacaoId;
  const periodo = c.req.query("periodo") ?? "mes_atual";
  const { since, until, prevSince } = periodWindow(periodo);
  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);
  const sixtyDaysFromNow = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  const [
    leadsCur, leadsPrev, leadsCanal,
    pipeline, winRate, fechado, ticket, ciclo, funilConversao, esfriando, leadsQualificados,
    mrrAtivoRow, contratosAtivosRow, npsRow, npsDistRow, vencendoRow,
    reunioesPeriodo,
    metaComercial,
  ] = await Promise.all([
    // Aquisição
    db.select({ c: count() }).from(leads).where(and(eq(leads.organizacaoId, orgId), gte(leads.createdAt, since), lt(leads.createdAt, until))),
    db.select({ c: count() }).from(leads).where(and(eq(leads.organizacaoId, orgId), gte(leads.createdAt, prevSince), lt(leads.createdAt, since))),
    // canal normalizado = MESMA fonte do /marketing (lib/relatorios/canais)
    getLeadsPorCanal(orgId, since, until),
    // Comercial (fonte única)
    getPipelineAtual(orgId),
    getWinRate(orgId, since, until),
    getFechadoPeriodo(orgId, since, until),
    getTicketMedio(orgId, since, until),
    getCicloMedio(orgId, since, until),
    getFunilConversao(orgId, since, until),
    getPipelineEsfriando(orgId, undefined),
    getLeadsQualificados(orgId, since, until),
    // Retenção (snapshot)
    db.select({ total: sum(contratos.mrr) }).from(contratos).innerJoin(leads, eq(contratos.leadId, leads.id)).where(and(eq(contratos.status, "ativo"), eq(leads.organizacaoId, orgId))),
    db.select({ c: count() }).from(contratos).innerJoin(leads, eq(contratos.leadId, leads.id)).where(and(eq(contratos.status, "ativo"), eq(leads.organizacaoId, orgId))),
    db.select({ media: avg(npsRespostas.score), total: count() }).from(npsRespostas).innerJoin(contratos, eq(npsRespostas.contratoId, contratos.id)).innerJoin(leads, eq(contratos.leadId, leads.id)).where(and(isNotNull(npsRespostas.respondidoEm), eq(leads.organizacaoId, orgId))),
    db.select({
      promotores: sql<number>`COUNT(*) FILTER (WHERE ${npsRespostas.score} >= 9)`,
      neutros: sql<number>`COUNT(*) FILTER (WHERE ${npsRespostas.score} BETWEEN 7 AND 8)`,
      detratores: sql<number>`COUNT(*) FILTER (WHERE ${npsRespostas.score} <= 6)`,
    }).from(npsRespostas).innerJoin(contratos, eq(npsRespostas.contratoId, contratos.id)).innerJoin(leads, eq(contratos.leadId, leads.id)).where(and(isNotNull(npsRespostas.respondidoEm), eq(leads.organizacaoId, orgId))),
    db.select({ c: count(), mrr: sum(contratos.mrr) }).from(contratos).innerJoin(leads, eq(contratos.leadId, leads.id)).where(and(eq(contratos.status, "ativo"), eq(leads.organizacaoId, orgId), lte(contratos.vencimento, sixtyDaysFromNow))),
    // Reuniões por EVENTO (status_changes), org toda no período. Antes: agendadas
    // contava linhas da tabela `reunioes` (82 vs 31 da aba SDR), realizadas era
    // sempre 0 (ninguém atualiza `reunioes.status`) e no-show era snapshot all-time
    // (auditoria itens 1/2/E1).
    contarReunioes(orgId, since, until),
    // Metas — mês do início do período selecionado (consistente com a aba Comercial)
    getMetaComercialAgregada(orgId, since),
  ]);

  // Closers (papel) com desempenho no período
  const closers = await db
    .select({ id: usuarios.id, nome: usuarios.nome })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, orgId), or(inArray(usuarios.role, ["closer", "vendedor"]), inArray(usuarios.id, CLOSER_EXTRA_IDS)), eq(usuarios.ativo, true)));
  // Fonte única por responsável (ganho_at + regra de receita do fechado) — os MESMOS
  // números da tabela "Desempenho por Vendedor" da aba Comercial. Antes cada aba
  // calculava diferente (created_at aqui, valor_total lá) e a mesma closer aparecia
  // com 3 receitas distintas (auditoria itens 6/7).
  const [fechadoResp, perdidosResp] = await Promise.all([
    getFechadoPorResponsavel(orgId, since, until),
    getPerdidosPorResponsavel(orgId, since, until),
  ]);
  const time = closers.map((u) => {
    const f = fechadoResp.get(u.id);
    const ganhos = f?.ganhos ?? 0;
    const perdidos = perdidosResp.get(u.id) ?? 0;
    const receita = f?.receita ?? 0;
    return { nome: u.nome, ganhos, perdidos, receita, winRate: ganhos + perdidos > 0 ? Math.round((ganhos / (ganhos + perdidos)) * 1000) / 10 : null };
  }).filter((m) => m.ganhos > 0 || m.perdidos > 0).sort((a, b) => b.receita - a.receita);

  // Mídia paga (Meta) no período
  let midia = { gasto: 0, leadsPagos: 0, cpl: null as number | null, configurado: metaConfigured() };
  if (metaConfigured()) {
    try {
      const camp = await fetchMetaCampaignInsights(sinceStr, untilStr);
      const gasto = camp.reduce((s, m) => s + (m.gasto || 0), 0);
      const leadsPagos = camp.reduce((s, m) => s + (m.leads || 0), 0);
      midia = { gasto: Math.round(gasto * 100) / 100, leadsPagos, cpl: leadsPagos > 0 ? Math.round((gasto / leadsPagos) * 100) / 100 : null, configurado: true };
    } catch { /* mantém zerado */ }
  }

  const leadsTotal = Number(leadsCur[0].c);
  const leadsAnt = Number(leadsPrev[0].c);
  const mrrAtivo = Number(mrrAtivoRow[0]?.total) || 0;
  const ganhosCount = fechado.ganhos;
  const cac = ganhosCount > 0 && midia.gasto > 0 ? Math.round((midia.gasto / ganhosCount) * 100) / 100 : null;
  const npsTotal = Number(npsDistRow[0]?.promotores || 0) + Number(npsDistRow[0]?.neutros || 0) + Number(npsDistRow[0]?.detratores || 0);
  const nps = npsTotal > 0 ? Math.round(((Number(npsDistRow[0].promotores) - Number(npsDistRow[0].detratores)) / npsTotal) * 100) : null;

  return c.json({
    periodo,
    aquisicao: {
      leads: leadsTotal,
      leadsDelta: crescimento(leadsTotal, leadsAnt),
      porCanal: leadsCanal,
      midia,
      cac,
    },
    funil: {
      leads: leadsTotal,
      qualificados: leadsQualificados,
      reunioesAgendadas: reunioesPeriodo.agendadas,
      reunioesRealizadas: reunioesPeriodo.realizadas,
      noShow: reunioesPeriodo.noShow,
      ganhos: ganhosCount,
      taxaQualificacao: leadsTotal > 0 ? Math.round((leadsQualificados / leadsTotal) * 1000) / 10 : null,
      taxaFechamento: leadsQualificados > 0 ? Math.round((ganhosCount / leadsQualificados) * 1000) / 10 : null,
      etapas: funilConversao.etapas,
    },
    receita: {
      mrrNovoFechado: fechado.recorrente,
      receitaFechada: fechado.receita,
      mrrAtivo,
      ticketMedio: ticket,
      cicloMedio: ciclo,
      winRate: winRate.taxa,
      winN: winRate.n,
      winAmostraPequena: winRate.amostraPequena,
    },
    pipeline: {
      total: pipeline.total,
      ponderado: pipeline.ponderado,
      negociosAbertos: pipeline.negociosAbertos,
      etapas: pipeline.etapas,
      esfriando,
    },
    retencao: {
      mrrAtivo,
      contratosAtivos: Number(contratosAtivosRow[0]?.c || 0),
      npsMedia: npsRow[0]?.media != null ? Math.round(Number(npsRow[0].media) * 10) / 10 : null,
      nps,
      npsDistrib: { promotores: Number(npsDistRow[0]?.promotores || 0), neutros: Number(npsDistRow[0]?.neutros || 0), detratores: Number(npsDistRow[0]?.detratores || 0) },
      contratosVencendo: { count: Number(vencendoRow[0]?.c || 0), mrr: Number(vencendoRow[0]?.mrr || 0) },
    },
    time: {
      sdr: { agendadas: reunioesPeriodo.agendadas, realizadas: reunioesPeriodo.realizadas, noShow: reunioesPeriodo.noShow },
      closers: time,
    },
    metaComercial,
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

  // Leads por CANAL normalizado — fonte única em lib/relatorios/canais (compartilhada
  // com o /growth, pra rótulo e número baterem entre as abas — auditoria item 5).
  const leadsPorCanal = await getLeadsPorCanal(orgId, since, until);

  // ── Funil 1: pré-vendas — MESMO cálculo da aba SDR (lib/relatorios/esteira-sdr).
  // Antes este funil usava sdr_status puro e mostrava "Qualificado" diferente da aba
  // SDR na mesma tela do sistema (68 vs 77 — auditoria item 3).
  const esteira = await getEsteiraSdr(orgId, since, until);
  const funilPreVendas = esteira.funil;

  // ── Funil 2: vendas por EVENTO — leads que ATINGIRAM cada etapa na janela.
  // Antes era snapshot ("quem está na etapa AGORA", sem período) misturado com
  // "Ganho (período)": o % de conversão entre etapas não significava nada
  // (auditoria itens 1/2/E6).
  const funilVendas = await getFunilVendasEventos(orgId, since, until);

  // ── CPL por campanha e por criativo (Meta Ads real: gasto/leads) ──
  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);
  type Linha = { nome: string; campaignId?: string; adId?: string; campanha?: string; gasto: number; leads: number; cpl: number | null; cliques: number; impressoes: number; qualificados?: number; clientes?: number; cpq?: number | null; cpc?: number | null };
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
        .map((m) => ({ nome: m.adName, adId: m.adId, campanha: m.campaignName, gasto: Math.round(m.gasto * 100) / 100, leads: m.leads, cpl: m.cpl, cliques: m.cliques, impressoes: m.impressoes }))
        .filter((m) => m.gasto > 0 || m.leads > 0 || m.cliques > 0) // só criativos com movimento (tira os desativados/zerados)
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

  // ── CPQ/CPC por CRIATIVO — mesma lógica, casando por utm_content (adId ou adName) ──
  if (por_criativo.length > 0) {
    const [qualAds, cliAds] = await Promise.all([
      db.select({ utm: leads.utmContent, total: count() }).from(leads)
        .where(and(orgFilter, dateRange, or(eq(leads.sdrStatus, "qualified"), isNotNull(leads.negocioAtivoId))))
        .groupBy(leads.utmContent),
      db.select({ utm: leads.utmContent, total: count() }).from(leads)
        .where(and(orgFilter, dateRange, eq(leads.tipo, "cliente")))
        .groupBy(leads.utmContent),
    ]);
    const qualAdMap = new Map(qualAds.map((r) => [String(r.utm ?? ""), Number(r.total)]));
    const cliAdMap = new Map(cliAds.map((r) => [String(r.utm ?? ""), Number(r.total)]));
    const pickAd = (m: Map<string, number>, id?: string, nome?: string) => m.get(id ?? "") ?? m.get(nome ?? "") ?? 0;
    por_criativo = por_criativo.map((c) => {
      const q = pickAd(qualAdMap, c.adId, c.nome);
      const cl = pickAd(cliAdMap, c.adId, c.nome);
      return {
        ...c,
        qualificados: q,
        clientes: cl,
        cpq: q > 0 ? Math.round((c.gasto / q) * 100) / 100 : null,
        cpc: cl > 0 ? Math.round((c.gasto / cl) * 100) / 100 : null,
      };
    });
  }

  // Qualificados = definição canônica (lead distinto que criou negócio no período —
  // decisão Scott 15/07). Antes: sdr_status='qualified' puro (definição divergente).
  const totalQualificados = await getLeadsQualificados(orgId, since, until);

  // ── Hero executivo calculado no SERVIDOR com as fontes canônicas.
  // Antes o front somava dados do /tracking (qualificados = sdr_status IN
  // qualifying/qualified; clientes = assinatura Stripe ativa → dava 0) e mostrava
  // números que não batiam com nenhuma outra aba (auditoria item 8).
  const [totalLeadsPeriodo] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(orgFilter, dateRange));
  const campPagas = await getMetricasPorCampanha(orgId, since, until);
  const funilPago = agregarFunil(campPagas); // só campanhas casadas com a Meta
  const hero = {
    investimento: Math.round(funilPago.gastoTotal * 100) / 100,
    leadsCrm: Number(totalLeadsPeriodo.total),
    leadsMeta: campPagas.filter((cp) => cp.pago).reduce((s, cp) => s + cp.leadsMeta, 0),
    qualificados: totalQualificados,
    // atribuído à mídia paga = negócio ganho de lead com UTM casada com campanha Meta
    vendasAtribuidas: funilPago.vendas,
    receitaAtribuida: Math.round(funilPago.receita * 100) / 100,
    cpl: null as number | null,
    cac: null as number | null,
    roas: null as number | null,
  };
  if (hero.leadsMeta > 0 && hero.investimento > 0) hero.cpl = Math.round((hero.investimento / hero.leadsMeta) * 100) / 100;
  if (hero.vendasAtribuidas > 0 && hero.investimento > 0) hero.cac = Math.round((hero.investimento / hero.vendasAtribuidas) * 100) / 100;
  if (hero.investimento > 0) hero.roas = Math.round((hero.receitaAtribuida / hero.investimento) * 100) / 100;

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
    hero,
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
        -- LIMITACAO MEDIDA, nao bug: este relatorio e dimensionado por E-MAIL do
        -- lead, entao 159 dos 1.562 negocios ficam de fora — 64 sem lead nenhum
        -- e 95 cujo lead nao tem e-mail. Tentei resolver pela pessoa canonica e
        -- o ganho foi ZERO: quem tem e-mail no lead tem na pessoa, e quem nao
        -- tem, nao tem nos dois. Dimensionar por empresa em vez de e-mail e
        -- outro relatorio, nao um ajuste deste.
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
      // "Cliente" = negócio GANHO (mesma régua da aba Mídia Paga). Antes era
      // "assinatura Stripe ativa vinculada" → venda ganha aparecia como 0 cliente
      // até o pagamento compensar (validação Kauã 22/07).
      clientes: Number(r.ganhos),
      mrrReal: Number(r.mrr_real),
      oportunidades: Number(r.oportunidades),
      ganhos: Number(r.ganhos),
      taxaQualificacao: Number(r.leads) > 0 ? Number(r.qualificados) / Number(r.leads) : 0,
      taxaConversao: Number(r.leads) > 0 ? Number(r.ganhos) / Number(r.leads) : 0,
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

  // ── Atribuição: receita ativa (Stripe) × mídia paga. "Atribuído a campanha" agora
  // exige a utm do lead casar com campanha REAL da Meta — "(direct)", "(referral)",
  // "unknown" etc. não são campanha (auditoria itens 8/10). Sem Meta configurada,
  // degrada pro critério antigo (qualquer utm_campaign não-vazio).
  // Linhas por assinatura ativa (calculado depois do bloco Meta, que dá as chaves pagas).
  // A atribuicao vem em cadeia, e o JOIN em leads deixou de ser obrigatorio.
  //
  // Medido no banco: das 355 assinaturas, 72 nao tem lead, e 47 delas estao
  // ATIVAS. O JOIN interno as descartava, entao este relatorio calculava CAC e
  // ROAS sobre R$ 40.231,65 de um MRR ativo de R$ 61.769,55 — **35% da receita
  // fora da conta que decide quanto investir em midia**.
  //
  // As 47 tem empresa. A campanha delas vem do primeiro ponto de contato
  // canonico, que e onde a atribuicao mora desde o backfill da fase 06.
  const assinaturasAtivas = (await db.execute(sql`
    SELECT a.lead_id,
           COALESCE(l.utm_campaign, pc_lead.campaign, pc_empresa.campaign) AS utm_campaign,
           a.mrr
      FROM assinaturas a
      LEFT JOIN leads l ON l.id = a.lead_id
      LEFT JOIN LATERAL (
        SELECT t.campaign FROM pontos_contato t
         WHERE t.lead_id_legado = a.lead_id AND t.campaign IS NOT NULL
         ORDER BY t.is_first_touch DESC, t.ocorrido_em ASC LIMIT 1
      ) pc_lead ON TRUE
      LEFT JOIN LATERAL (
        SELECT t.campaign FROM pontos_contato t
         WHERE t.empresa_id = a.empresa_id AND t.campaign IS NOT NULL
         ORDER BY t.is_first_touch DESC, t.ocorrido_em ASC LIMIT 1
      ) pc_empresa ON TRUE
     WHERE a.organizacao_id = ${org} AND a.status IN ('active','trialing','past_due')
  `)) as unknown as { lead_id: string; utm_campaign: string | null; mrr: unknown }[];

  // ── Meta Ads: gasto/CPL/CAC/ROAS por campanha (cruza por nome normalizado) ──
  type MetaResumo = {
    configured: boolean;
    totalGasto: number;
    totalLeads: number;
    naoCasadas: { campanha: string; gasto: number; leads: number }[];
    erro?: string;
  };
  const meta: MetaResumo = { configured: metaConfigured(), totalGasto: 0, totalLeads: 0, naoCasadas: [] };
  let chavesPagas: Set<string> | null = null; // nomes normalizados de campanhas Meta
  let idsPagos: Set<string> | null = null; // campaignIds da Meta
  if (meta.configured) {
    try {
      const mSince = sinceStr ?? new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
      const mUntil = untilStr ?? new Date().toISOString().slice(0, 10);
      const insights = await fetchMetaCampaignInsights(mSince, mUntil);
      const map = new Map<string, { gasto: number; leads: number; cliques: number; nome: string }>();
      const byId = new Map<string, string>(); // campaignId → chave normalizada (casa utm=ID)
      for (const i of insights) {
        const k = normCampanha(i.campaignName);
        const cur = map.get(k) ?? { gasto: 0, leads: 0, cliques: 0, nome: i.campaignName };
        cur.gasto += i.gasto; cur.leads += i.leads; cur.cliques += i.cliques;
        map.set(k, cur);
        if (i.campaignId) byId.set(i.campaignId, k);
      }
      meta.totalGasto = Math.round(insights.reduce((s, i) => s + i.gasto, 0) * 100) / 100;
      meta.totalLeads = insights.reduce((s, i) => s + i.leads, 0);
      chavesPagas = new Set(map.keys());
      idsPagos = new Set(byId.keys());
      const casadas = new Set<string>();
      for (const row of porCampanha as Array<Record<string, unknown>>) {
        const chave = String(row.chave ?? "");
        // casa por nome normalizado OU por id da campanha (quando a utm é o id numérico)
        const key = map.has(normCampanha(chave)) ? normCampanha(chave) : byId.get(chave);
        const m = key ? map.get(key) : undefined;
        if (!m || !key) continue;
        casadas.add(key);
        const clientes = Number(row.clientes);
        const qualificados = Number(row.qualificados);
        const mrr = Number(row.mrrReal);
        row.gastoMeta = Math.round(m.gasto * 100) / 100;
        row.leadsMeta = m.leads;
        row.cliquesMeta = m.cliques;
        // CPL = gasto / leads ATRIBUÍDOS pela Meta (BM). NUNCA dividir pelos leads do CRM
        // (utm cola em lead que não veio do clique pago → CPL falso, subestimado).
        row.cpl = m.leads > 0 ? m.gasto / m.leads : null;
        row.cplq = qualificados > 0 ? m.gasto / qualificados : null; // custo por lead qualificado
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

  // utm do lead casa com campanha paga real? (nome normalizado ou id). Sem Meta
  // configurada, mantém o critério antigo (qualquer utm não-vazia).
  const utmEhPaga = (utm: string | null | undefined): boolean => {
    if (!utm) return false;
    if (!chavesPagas || !idsPagos) return true;
    return chavesPagas.has(normCampanha(utm)) || idsPagos.has(utm);
  };
  let mrrTotal = 0, mrrAtribuido = 0;
  const clientesTotalSet = new Set<string>(), clientesAtribuidosSet = new Set<string>();
  for (const a of assinaturasAtivas) {
    const mrr = Number(a.mrr ?? 0) || 0;
    mrrTotal += mrr;
    clientesTotalSet.add(a.lead_id);
    if (utmEhPaga(a.utm_campaign)) {
      mrrAtribuido += mrr;
      clientesAtribuidosSet.add(a.lead_id);
    }
  }
  const atribuicao = {
    mrrTotal: Math.round(mrrTotal * 100) / 100,
    mrrAtribuido: Math.round(mrrAtribuido * 100) / 100,
    clientesTotal: clientesTotalSet.size,
    clientesAtribuidos: clientesAtribuidosSet.size,
    pctAtribuido: mrrTotal > 0 ? mrrAtribuido / mrrTotal : 0,
  };

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

// ─── Mídia Paga (funil clique→receita) ────────────────────────────
// GET /relatorios/midia-paga?periodo=30d
// Fonte única em lib/relatorios/midia-paga.ts. Ver callface/relatorio-midia-paga-proposta.md.
// Sem índice de qualidade composto — ranking é ROAS puro (decisão Scott 15/07).
app.get("/midia-paga", async (c) => {
  const ctx = await getCtx(c);
  const periodo = c.req.query("periodo") ?? "30d";
  const { since, until } = periodWindow(periodo);

  const [porCampanha, porConjunto, porCriativo, statusAtual, receitaAtribuida, roasCiclo, pipelineAberto] = await Promise.all([
    getMetricasPorCampanha(ctx.organizacaoId, since, until),
    getMetricasPorConjunto(ctx.organizacaoId, since, until),
    getMetricasPorCriativo(ctx.organizacaoId, since, until),
    getStatusAtualLeadsPagos(ctx.organizacaoId, since, until),   // ENG-667a
    getReceitaAtribuida(ctx.organizacaoId, since, until),        // ENG-667b
    getRoasCiclo(ctx.organizacaoId),                             // ENG-667c
    getPipelineAbertoPago(ctx.organizacaoId),                    // ENG-667d
  ]);
  const funil = agregarFunil(porCampanha);
  const alertas = gerarAlertas(porCampanha, porCriativo);
  const rankingCampanhas = rankingPorRoas(porCampanha);
  const rankingConjuntos = rankingPorRoas(porConjunto);
  const rankingCriativos = rankingPorRoas(porCriativo);

  return c.json({
    periodo,
    metaConfigured: metaConfigured(),
    funil,
    porCampanha,
    porConjunto,
    porCriativo,
    rankingCampanhas,
    rankingConjuntos,
    rankingCriativos,
    alertas,
    statusAtual,
    receitaAtribuida,
    roasCiclo,
    pipelineAberto,
  });
});

// ─── Faturamento fechado por categoria ───────────────────────────
// Pedido do Kauã (09/09/2026): a meta virou uma só ("faturamento fechado"),
// mas o relatório precisa mostrar de QUE o time vendeu — mensalidade ou
// setup/avulso — mês a mês e por pessoa.
//
// Mesma expressão da meta (`lib/metas.ts`): mensalidade + setup, nunca
// `valor_total` (diverge da composição em 174 dos 309 ganhos) e nunca somando
// `valor_projeto`, que é cópia literal de `valor_setup`.
// GET /relatorios/faturamento-categoria?meses=12
app.get("/faturamento-categoria", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;
  const meses = Math.min(parseInt(c.req.query("meses") || "12") || 12, 24);

  const series = await db.execute(sql`
    SELECT to_char(date_trunc('month', ganho_at), 'YYYY-MM')            AS mes,
           COALESCE(SUM(COALESCE(mrr_fechado, 0)), 0)::float            AS mrr,
           COALESCE(SUM(COALESCE(valor_setup, 0)), 0)::float            AS setup,
           COUNT(*)::int                                                AS negocios
      FROM negocios
     WHERE organizacao_id = ${orgId} AND status = 'ganho' AND ganho_at IS NOT NULL
       AND ganho_at >= GREATEST(date_trunc('month', now()) - make_interval(months => ${meses - 1}), ${GO_LIVE_ISO}::timestamptz)
     GROUP BY 1, 2 ORDER BY 1`);

  const porPessoa = await db.execute(sql`
    -- CUTOVER DE LEITURA (fase 17): a fonte passou a ser oportunidades.
    --
    -- So foi possivel depois da migration 0073 criar a coluna de setup: o
    -- canonico tinha valor e mrr juntos, e migrar sem o campo perderia a
    -- distincao entre receita recorrente e de implantacao, que sao coisas
    -- diferentes para quem decide onde investir.
    SELECT COALESCE(u.nome, 'Sem responsável')                     AS nome,
           COALESCE(SUM(COALESCE(o.mrr, 0)), 0)::float             AS mrr,
           COALESCE(SUM(COALESCE(o.setup_estimado, 0)), 0)::float  AS setup,
           COUNT(*)::int                                           AS negocios
      FROM oportunidades o
      LEFT JOIN usuarios u ON u.id = o.responsavel_id
     WHERE o.organizacao_id = ${orgId} AND o.ganho_at IS NOT NULL
       AND o.ganho_at >= GREATEST(date_trunc('month', now()) - make_interval(months => ${meses - 1}), ${GO_LIVE_ISO}::timestamptz)
     GROUP BY 1
     HAVING COALESCE(SUM(COALESCE(o.mrr, 0) + COALESCE(o.setup_estimado, 0)), 0) > 0
     ORDER BY 2 + 3 DESC`);

  // Ganho sem valor nenhum não é erro de query: é cadastro incompleto, e o
  // relatório diz quantos são em vez de deixar o total silenciosamente menor.
  const [semValor] = await db.execute<{ qtd: string }>(sql`
    SELECT COUNT(*)::text AS qtd FROM negocios
     WHERE organizacao_id = ${orgId} AND status = 'ganho' AND ganho_at IS NOT NULL
       AND ganho_at >= GREATEST(date_trunc('month', now()) - make_interval(months => ${meses - 1}), ${GO_LIVE_ISO}::timestamptz)
       AND COALESCE(mrr_fechado, 0) + COALESCE(valor_setup, 0) <= 0`);

  const comTotal = <T extends { mrr: number; setup: number }>(r: T) => ({ ...r, total: r.mrr + r.setup });
  return c.json({
    series: (series as unknown as { mrr: number; setup: number }[]).map(comTotal),
    porPessoa: (porPessoa as unknown as { mrr: number; setup: number }[]).map(comTotal),
    negociosSemValor: Number(semValor?.qtd ?? 0),
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
  // R7/R8 (Scott 30/jun): granularidade SEMANAL. `semanas` é o nº de semanas exibidas
  // (fallback `meses` por compat com chamadas antigas). Label = 'DD/MM' do início da semana.
  const semanas = Math.min(parseInt(c.req.query("semanas") || c.req.query("meses") || "12") || 12, 52);

  // Piso go-live (lib/relatorios/periodo GO_LIVE): não conta nada anterior ao go-live (histórico Zoho).
  const ganhos = await db.execute(sql`
    SELECT to_char(date_trunc('week', ganho_at), 'YYYY-MM-DD') AS wk, to_char(date_trunc('week', ganho_at), 'DD/MM') AS mes, count(*)::int AS qtd
    FROM negocios
    WHERE organizacao_id = ${orgId} AND status = 'ganho' AND ganho_at IS NOT NULL
      AND ganho_at >= GREATEST(date_trunc('week', now()) - make_interval(weeks => ${semanas - 1}), ${GO_LIVE_ISO}::timestamptz)
    GROUP BY 1, 2 ORDER BY 1
  `);

  const mrr = await db.execute(sql`
    SELECT to_char(date_trunc('week', c.inicio), 'YYYY-MM-DD') AS wk, to_char(date_trunc('week', c.inicio), 'DD/MM') AS mes, COALESCE(sum(c.mrr), 0)::float AS mrr
    FROM contratos c JOIN leads l ON l.id = c.lead_id
    WHERE l.organizacao_id = ${orgId} AND c.status = 'ativo' AND c.inicio IS NOT NULL
      AND c.inicio >= GREATEST((date_trunc('week', now()) - make_interval(weeks => ${semanas - 1}))::date, ${GO_LIVE_ISO}::date)
    GROUP BY 1, 2 ORDER BY 1
  `);

  const perdidos = await db.execute(sql`
    SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS wk, to_char(date_trunc('week', created_at), 'DD/MM') AS mes, count(*)::int AS qtd
    FROM negocios
    WHERE organizacao_id = ${orgId} AND status = 'perdido'
      AND created_at >= GREATEST(date_trunc('week', now()) - make_interval(weeks => ${semanas - 1}), ${GO_LIVE_ISO}::timestamptz)
    GROUP BY 1, 2 ORDER BY 1
  `);

  type Mes = {
    wk: string; mes: string;
    ganhosPabx: number; ganhosAi: number; ganhosOutros: number;
    mrrPabx: number; mrrAi: number; mrrOutros: number;
    perdidos: number; fatStripe: number; fatPabx: number;
  };
  const byMes: Record<string, Mes> = {};
  const ensure = (wk: string, mes: string) => (byMes[wk] ||= {
    wk, mes, ganhosPabx: 0, ganhosAi: 0, ganhosOutros: 0,
    mrrPabx: 0, mrrAi: 0, mrrOutros: 0, perdidos: 0, fatStripe: 0, fatPabx: 0,
  });
  const rowsOf = (r: unknown) => r as unknown as Record<string, unknown>[];
  for (const r of rowsOf(ganhos)) ensure(String(r.wk), String(r.mes)).ganhosAi += Number(r.qtd);
  for (const r of rowsOf(mrr)) ensure(String(r.wk), String(r.mes)).mrrAi += Number(r.mrr);
  for (const r of rowsOf(perdidos)) ensure(String(r.wk), String(r.mes)).perdidos += Number(r.qtd);

  // Ordena cronologicamente pela semana (wk = 'YYYY-MM-DD', ordenável lexicograficamente).
  const series = Object.values(byMes).sort((a, b) => a.wk.localeCompare(b.wk));
  return c.json({ semanas, series });
});

// ─── Esteira SDR (pré-qualificação) ──────────────────────────────
// Funil da esteira do SDR: Novo → Em contato → Qualificando → Qualificado (+ Desqualificado à parte).
// GET /relatorios/sdr-esteira?periodo=30d
app.get("/sdr-esteira", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;
  const periodo = c.req.query("periodo") ?? "30d";
  const { since, until } = periodWindow(periodo);

  // Esteira = fonte única (lib/relatorios/esteira-sdr) — o MESMO cálculo do funil
  // de pré-vendas do /marketing, então as duas abas nunca mais divergem (item 3).
  const esteira = await getEsteiraSdr(orgId, since, until);
  const { qualificado, desqualificado, estagnados } = esteira.geral;
  const { totalEsteira, trabalhados, funil } = esteira;

  const userList = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(eq(usuarios.organizacaoId, orgId));

  // Relatório SDR = só responsáveis com PAPEL sdr (não por nome). BLINDAGEM: se quem
  // acessa é personal view (a própria SDR), só vê A SI MESMA. Admin/gerente veem todas.
  const soEuSdr = isPersonalView(ctx.userRole) ? ctx.userId : null;
  const vazio = { novo: 0, emContato: 0, qualificando: 0, qualificado: 0, desqualificado: 0, estagnados: 0 };
  const porResponsavel = userList
    // personal view (SDR ou closer que acumula SDR) vê só a si; admin/gerente veem todas as SDR.
    .filter((u) => (soEuSdr ? u.id === soEuSdr : u.role === "sdr"))
    .map((u) => {
      const m = esteira.porResponsavel.get(u.id) ?? vazio;
      const tot = m.novo + m.emContato + m.qualificando + m.qualificado + m.desqualificado;
      const trab = m.emContato + m.qualificando + m.qualificado + m.desqualificado;
      return {
        usuarioId: u.id, nome: u.nome, role: u.role,
        total: tot, novo: m.novo, emContato: m.emContato, qualificando: m.qualificando,
        qualificado: m.qualificado, desqualificado: m.desqualificado,
        taxaQualificacao: trab > 0 ? Math.round((m.qualificado / trab) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  // R3 — Reuniões por EVENTO (status_changes), recorte da meta da SDR: agendadas =
  // quem A SDR moveu pra "Reunião agendada"; realizadas/no-show = desses mesmos
  // leads. Antes, "realizadas" lia da tabela `reunioes` (nunca atualizada → sempre 0)
  // e no-show era snapshot all-time (auditoria itens 2/E1/E2).
  const sdrIds = userList.filter((u) => u.role === "sdr").map((u) => u.id);
  const escopoSdr = soEuSdr ? [soEuSdr] : sdrIds;
  const [reunioesSdr, visoes] = await Promise.all([
    contarReunioes(orgId, since, until, { agendadasPor: escopoSdr }),
    // Visões da auditoria 22/07 (LOGICA-SDR.md): split reunião/direta, quem qualificou,
    // SLA em duas bases, inbound×outbound, parados por tempo e base parada fora da coorte.
    getVisoesSdr(orgId, since, until),
  ]);

  // Reuniões agendadas na janela por CLOSERS (contexto da meta da SDR — closers
  // cobrindo SDR agendam por fora e o card sozinho parecia a atividade toda).
  const closerIds = userList.filter((u) => u.role === "closer" || u.role === "vendedor").map((u) => u.id);
  const reunioesClosers = soEuSdr
    ? null
    : await contarReunioes(orgId, since, until, { agendadasPor: closerIds });

  // BLINDAGEM personal view: a visão "quem qualificou" segue a mesma regra da
  // tabela Por SDR — quem tem visão pessoal só enxerga a própria linha.
  const qualificacoesPorResponsavel = soEuSdr
    ? visoes.qualificacoesPorResponsavel.filter((q) => q.usuarioId === soEuSdr)
    : visoes.qualificacoesPorResponsavel;

  return c.json({
    funil,
    desqualificado,
    // Card Estagnados = flags manuais da coorte + leads da coorte em contato/
    // qualificando sem atividade há ESTAGNADO_DIAS+ (a esteira/funil NÃO muda —
    // estagnado por tempo é overlay, o lead continua contado onde está no board).
    estagnados: estagnados + visoes.paradosCoorte,
    estagnadosFlag: estagnados,
    estagnadosParados: visoes.paradosCoorte,
    estagnadoDias: ESTAGNADO_DIAS,
    // Estado REAL "qualificando" da coorte (o funil é cumulativo; o card usava o
    // valor do funil e mostrava qualificando+qualificado — auditoria 22/07).
    qualificandoAtual: esteira.geral.qualificando,
    novosLeads: esteira.totalLeads, // leads que chegaram pra SDR no período
    totalEsteira,
    trabalhados,
    taxaContato: totalEsteira > 0 ? Math.round((trabalhados / totalEsteira) * 1000) / 10 : 0,
    taxaQualificacao: trabalhados > 0 ? Math.round((qualificado / trabalhados) * 1000) / 10 : 0,
    reunioes: reunioesSdr,
    reunioesClosers,
    porResponsavel,
    qualificadosDetalhe: visoes.qualificadosDetalhe,
    qualificacoesPorResponsavel,
    sla: visoes.sla,
    origem: visoes.origem,
    baseParada: soEuSdr ? null : visoes.baseParada,
  });
});

// ─── Fechamento Comercial (20/08, URGENTE — Financeiro fechando julho/2026) ──
// Read-only/reporting: nunca escreve em `negocios`/`leads`/`contratos`/etc.
// Ver lib/relatorios/fechamento-comercial.ts pra regras e achados de auditoria.
// admin/gerente/leitor apenas — mesmo gate de acesso das outras abas de gestão.
app.get("/fechamento-comercial", async (c) => {
  const ctx = await getCtx(c);
  if (!isAdminView(ctx.userRole) && ctx.userRole !== "leitor") return c.json({ error: "Sem acesso" }, 403);

  const periodo = c.req.query("periodo") ?? "mes_passado";
  const { since, until } = parsePeriodo(periodo);
  const orgId = ctx.organizacaoId;

  // Filtros (pedido explícito: Período/Closer/SDR/Família/Empresa). Aplicados
  // em memória sobre o resultado do período — volume mensal é baixo (dezenas/
  // centenas de linhas), não vale complicar as 3 funções com N params opcionais
  // cada. "Status" não é filtro aqui de propósito: Bloco 1 é definicionalmente
  // Won (`status='ganho'`), filtrar por outro status contradiria a premissa.
  const closerId = c.req.query("closerId") || null;
  const sdrId = c.req.query("sdrId") || null;
  const familia = c.req.query("familia") || null;
  const empresaId = c.req.query("empresaId") || null;

  const [vendasTodas, agendasTodas, atribuidasTodas] = await Promise.all([
    listarVendasFechadas(orgId, since, until),
    listarAgendasRealizadas(orgId, since, until),
    listarVendasAtribuidasSdr(orgId, since, until),
  ]);

  // Opções reais pros dropdowns — derivadas do próprio período (nunca lista
  // fixa; se alguém não vendeu no mês, não aparece no filtro daquele mês).
  const closersDisponiveis = [...new Map(vendasTodas.filter((v) => v.closerId).map((v) => [v.closerId!, v.closerNome ?? "—"])).entries()];
  const sdrsDisponiveis = [...new Map(agendasTodas.map((a) => [a.sdrId ?? "ia", a.sdrNome ?? "—"])).entries()];
  const familiasDisponiveis = [...new Set(vendasTodas.map((v) => v.serviceFamily).filter((f): f is string => !!f))];
  const empresasDisponiveis = [...new Map(vendasTodas.filter((v) => v.empresaId).map((v) => [v.empresaId!, v.empresaNome ?? "—"])).entries()];

  const filtros = { closerId, sdrId, familia, empresaId };
  const vendas = aplicarFiltrosFechamento(vendasTodas, filtros);
  const agendas = aplicarFiltrosFechamento(agendasTodas, filtros, { sdrComoAgendaKey: true });
  const atribuidas = aplicarFiltrosFechamento(atribuidasTodas, filtros);

  const totalVendido = vendas.reduce((s, v) => s + ((v.tipoReceita === "avulso" || v.tipoReceita === "projeto") ? v.valorTotal : v.mrrFechado), 0);
  const porCloser = new Map<string, { nome: string; total: number; qtd: number }>();
  for (const v of vendas) {
    if (!v.closerId) continue;
    const cur = porCloser.get(v.closerId) ?? { nome: v.closerNome ?? "—", total: 0, qtd: 0 };
    cur.total += (v.tipoReceita === "avulso" || v.tipoReceita === "projeto") ? v.valorTotal : v.mrrFechado;
    cur.qtd += 1;
    porCloser.set(v.closerId, cur);
  }
  const porSdr = new Map<string, { nome: string; agendadas: number; realizadas: number }>();
  for (const a of agendas) {
    const key = a.sdrId ?? "ia";
    const cur = porSdr.get(key) ?? { nome: a.sdrNome ?? "—", agendadas: 0, realizadas: 0 };
    cur.agendadas += 1;
    if (a.realizadaEm) cur.realizadas += 1;
    porSdr.set(key, cur);
  }

  return c.json({
    periodo: { since: since.toISOString(), until: until.toISOString() },
    filtrosAplicados: { closerId, sdrId, familia, empresaId },
    opcoes: {
      closers: closersDisponiveis.map(([id, nome]) => ({ id, nome })),
      sdrs: sdrsDisponiveis.map(([id, nome]) => ({ id, nome })),
      familias: familiasDisponiveis,
      empresas: empresasDisponiveis.map(([id, nome]) => ({ id, nome })),
    },
    resumo: {
      totalVendido,
      quantidadeVendas: vendas.length,
      porCloser: [...porCloser.entries()].map(([id, v]) => ({ closerId: id, ...v })),
      porSdr: [...porSdr.entries()].map(([id, v]) => ({ sdrId: id, ...v })),
      vendasComSdrIdentificavel: vendas.filter((v) => v.sdrId).length,
      vendasComStripe: vendas.filter((v) => v.stripeSubscriptionId || v.stripeCustomerId || v.faturaHostedUrl || v.contratoZohoId).length,
      vendasComComprovante: vendas.filter((v) => v.faturaHostedUrl).length,
      vendasComContrato: vendas.filter((v) => v.contratoId).length,
      vendasComEmpresa: vendas.filter((v) => v.empresaId || v.empresaNome).length,
      vendasComInformacaoIncompleta: vendas.filter((v) => !v.sdrId || (!v.stripeSubscriptionId && !v.stripeCustomerId && !v.faturaHostedUrl && !v.contratoZohoId)).length,
    },
    vendas,
    agendas,
    atribuidas,
  });
});

// Filtro compartilhado entre a tela e a exportação — ÚNICO lugar que decide
// "essa linha entra ou não" pros 3 blocos, pra nunca divergir (pedido
// explícito: exportação não pode vir de query diferente da tela).
function aplicarFiltrosFechamento<T extends { closerId?: string | null; sdrId: string | null; serviceFamily?: string | null; empresaId?: string | null }>(
  itens: T[],
  filtros: { closerId: string | null; sdrId: string | null; familia: string | null; empresaId: string | null },
  opts?: { sdrComoAgendaKey?: boolean },
): T[] {
  return itens.filter((v) => {
    if (filtros.closerId && v.closerId !== filtros.closerId) return false;
    if (filtros.familia && v.serviceFamily !== filtros.familia) return false;
    if (filtros.empresaId && v.empresaId !== filtros.empresaId) return false;
    if (filtros.sdrId) {
      // Bloco 2 (agendas): "ia" é inequívoco (usuario_id null ali só pode ser
      // IA, já que sempre houve evento). Fora daí, `sdrId: null` também
      // cobre "sem evento encontrado" — ambíguo com IA, então "ia" nesses
      // blocos honestamente não bate com nada (0 resultados), nunca
      // devolve tudo por engano.
      const chave = opts?.sdrComoAgendaKey ? (v.sdrId ?? "ia") : v.sdrId;
      if (chave !== filtros.sdrId) return false;
    }
    return true;
  });
}

// Achado real do time comercial (20/08): das vendas de julho sem
// evidência Stripe, várias nunca passaram por Stripe de propósito --
// foram lançadas como Sales Order no Zoho (fluxo legado). contrato_zoho_id
// passa a contar como evidência real de pagamento, não só Stripe.
const ZOHO_ORG_URL = "https://one.zoho.com/zohoone/callface40/home/cxapp/crm/org830405635/tab/SalesOrders";

function linkComprovante(v: { faturaHostedUrl: string | null; stripeSubscriptionId: string | null; stripeCustomerId: string | null; contratoZohoId: string | null }): string {
  if (v.faturaHostedUrl) return v.faturaHostedUrl;
  if (v.stripeSubscriptionId) return `https://dashboard.stripe.com/subscriptions/${v.stripeSubscriptionId}`;
  if (v.stripeCustomerId) return `https://dashboard.stripe.com/customers/${v.stripeCustomerId}`;
  if (v.contratoZohoId) return `${ZOHO_ORG_URL}/${v.contratoZohoId}`;
  return "Não disponível";
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });
}

function addSheet(wb: ExcelJS.Workbook, nome: string, headers: string[], rows: (string | number | null)[][]) {
  const sheet = wb.addWorksheet(nome);
  sheet.addRow(headers).font = { bold: true };
  for (const r of rows) sheet.addRow(r);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoWidth(sheet);
  return sheet;
}

// GET /relatorios/fechamento-comercial/export?periodo=mes_passado&closerId=...
// Um único .xlsx com as 3 abas (Vendas Fechadas / Agendas Realizadas /
// Atribuídas a SDR), sempre com o link do comprovante Stripe — pedido
// explícito do Kauã (18/08): "a planilha que eu exporto já tem que exportar
// todas as abas... organizado... e com o link do stripe também". Mesma fonte
// de dado da tela (listarVendasFechadas/listarAgendasRealizadas/
// listarVendasAtribuidasSdr) — nunca uma query paralela, pra exportação e tela
// nunca divergirem (pedido explícito anterior, ainda válido).
app.get("/fechamento-comercial/export", async (c) => {
  const ctx = await getCtx(c);
  if (!isAdminView(ctx.userRole) && ctx.userRole !== "leitor") return c.json({ error: "Sem acesso" }, 403);

  const periodo = c.req.query("periodo") ?? "mes_passado";
  const { since, until } = parsePeriodo(periodo);
  const orgId = ctx.organizacaoId;
  // Mesmos filtros da tela — nunca uma exportação com escopo diferente do
  // que o Financeiro está vendo (pedido explícito).
  const filtros = {
    closerId: c.req.query("closerId") || null,
    sdrId: c.req.query("sdrId") || null,
    familia: c.req.query("familia") || null,
    empresaId: c.req.query("empresaId") || null,
  };

  const [vendasTodas, agendasTodas, atribuidasTodas] = await Promise.all([
    listarVendasFechadas(orgId, since, until),
    listarAgendasRealizadas(orgId, since, until),
    listarVendasAtribuidasSdr(orgId, since, until),
  ]);
  const vendas = aplicarFiltrosFechamento(vendasTodas, filtros);
  const agendas = aplicarFiltrosFechamento(agendasTodas, filtros, { sdrComoAgendaKey: true });
  const atribuidas = aplicarFiltrosFechamento(atribuidasTodas, filtros);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Callface CRM — Fechamento Comercial";
  wb.created = since;

  addSheet(
    wb,
    "Vendas Fechadas",
    [
      "negocio_id", "ganho_em", "empresa", "contato", "contato_email", "closer", "sdr", "sdr_evidencia",
      "origem", "familia", "produtos", "tipo_receita", "mrr_fechado", "valor_total", "valor_setup", "status",
      "proposta_numero", "proposta_status", "contrato_id", "contrato_status", "contrato_zoho_id",
      "stripe_subscription_id", "stripe_customer_id", "link_comprovante_pagamento",
    ],
    vendas.map((v) => [
      v.negocioId, v.ganhoAt, v.empresaNome ?? "Não disponível", v.contatoNome, v.contatoEmail, v.closerNome, v.sdrNome ?? "Não disponível", v.sdrEvidencia,
      v.origem, v.serviceFamily, v.produtos.join(", "), v.tipoReceita, v.mrrFechado, v.valorTotal, v.valorSetup, v.status,
      v.propostaNumero, v.propostaStatus, v.contratoId ?? "Não disponível", v.contratoStatus, v.contratoZohoId ?? "Não disponível",
      v.stripeSubscriptionId ?? "Não disponível", v.stripeCustomerId ?? "Não disponível", linkComprovante(v),
    ]),
  );

  addSheet(
    wb,
    "Agendas Realizadas",
    ["lead_id", "lead_nome", "empresa", "sdr", "agendada_em", "realizada_em", "tipo_evento", "negocio_id", "negocio_titulo", "closer", "resultado_atual", "venda_relacionada"],
    agendas.map((a) => [a.leadId, a.leadNome, a.empresaNome ?? "Não disponível", a.sdrNome, a.agendadaEm, a.realizadaEm, a.tipoEvento, a.negocioId, a.negocioTitulo, a.closerNome, a.resultadoAtual, a.vendaRelacionada ? "sim" : "não"]),
  );

  addSheet(
    wb,
    "Atribuídas a SDR",
    ["negocio_id", "sdr", "closer", "empresa", "ganho_em", "valor", "familia", "evidencia_atribuicao"],
    atribuidas.map((v) => [v.negocioId, v.sdrNome, v.closerNome, v.empresaNome ?? "Não disponível", v.ganhoAt, v.valor, v.serviceFamily, v.origemAtribuicao]),
  );

  const buffer = await wb.xlsx.writeBuffer();
  const sufixoFiltro = Object.values(filtros).some((v) => v) ? "-filtrado" : "";
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fechamento-comercial-${periodo}${sufixoFiltro}.xlsx"`,
    },
  });
});

export const relatoriosRoutes = app;
