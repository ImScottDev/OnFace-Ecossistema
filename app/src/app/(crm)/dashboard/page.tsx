import { db } from "@/lib/db";
import { leads, negocios, tarefas, atividades, contratos, npsRespostas, statusChanges, reunioes } from "@/lib/db/schema";
import { count, eq, sql, and, gte, lte, desc, or, isNull, notInArray, inArray } from "drizzle-orm";
import { getPipelineConfig } from "@/lib/crm/getPipelineConfig";
import { getTenantContext } from "@/lib/auth/tenant";
import Link from "next/link";
import { MeuDiaClient } from "@/components/crm/MeuDiaClient";
import { AlertasUrgentes } from "@/components/crm/AlertasUrgentes";
import { TrendingUp, TrendingDown, Search, FilePlus2, UserPlus } from "lucide-react";

async function getDashboardData(organizacaoId: string, userId: string, role: string) {
  // Decisão Scott (25/jun): o time vê os MESMOS números gerais que o admin (visão
  // da empresa, não por pessoa). Os agregados (MRR, pipeline, leads, fechado) são
  // company-wide pra todos. Tarefas/Agenda continuam pessoais (usam userId direto).
  void role;
  const soMeu = false;
  const meusLeadIds = db.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.organizacaoId, organizacaoId), eq(leads.responsavelId, userId)));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [negociosNovosAntigos, negociosPropSemResposta, npsDetratores, contratosVencendo] = await Promise.all([
    db.select({ id: negocios.id, titulo: negocios.titulo, leadId: negocios.leadId, createdAt: negocios.createdAt })
      .from(negocios)
      .where(and(eq(negocios.organizacaoId, organizacaoId), eq(negocios.responsavelId, userId), eq(negocios.status, "novo"), lte(negocios.createdAt, twoHoursAgo)))
      .limit(20),
    db.select({ id: negocios.id, titulo: negocios.titulo, leadId: negocios.leadId, updatedAt: negocios.updatedAt })
      .from(negocios)
      .where(and(eq(negocios.organizacaoId, organizacaoId), eq(negocios.responsavelId, userId), eq(negocios.status, "proposta_apresentada"), lte(negocios.updatedAt, threeDaysAgo)))
      .limit(20),
    db.select({ id: npsRespostas.id, leadId: npsRespostas.leadId, score: npsRespostas.score })
      .from(npsRespostas)
      .where(and(eq(npsRespostas.organizacaoId, organizacaoId), lte(npsRespostas.score, 6), gte(npsRespostas.respondidoEm, thisWeekStart), soMeu ? inArray(npsRespostas.leadId, meusLeadIds) : undefined))
      .limit(20),
    db.select({ id: contratos.id, leadId: contratos.leadId, vencimento: contratos.vencimento, mrr: contratos.mrr })
      .from(contratos)
      .where(and(eq(contratos.organizacaoId, organizacaoId), eq(contratos.status, "ativo"), lte(contratos.vencimento, sixtyDaysFromNow.toISOString().split("T")[0]), soMeu ? inArray(contratos.leadId, meusLeadIds) : undefined))
      .limit(20),
  ]);

  const [
    tarefasDoDia,
    [leadsThisWeek],
    [leadsLastWeek],
    [propostasAbertas],
    [mrrFechadoMes],
    [mrrAtivo],
    [projetosFechadosMes],
    [receitaTotalPipeline],
    pipelineCounts,
    ultimasAtividades,
  ] = await Promise.all([
    db.select()
      .from(tarefas)
      .where(and(
        eq(tarefas.organizacaoId, organizacaoId),
        eq(tarefas.usuarioId, userId),
        eq(tarefas.concluida, false),
        or(
          lte(tarefas.dataVencimento, today.toISOString().split("T")[0]),
          isNull(tarefas.dataVencimento)
        )
      ))
      .orderBy(tarefas.dataVencimento, tarefas.createdAt)
      .limit(20),
    db.select({ count: count() }).from(leads)
      .where(and(eq(leads.organizacaoId, organizacaoId), eq(leads.tipo, "lead"), gte(leads.createdAt, thisWeekStart), soMeu ? eq(leads.responsavelId, userId) : undefined)),
    db.select({ count: count() }).from(leads)
      .where(and(eq(leads.organizacaoId, organizacaoId), eq(leads.tipo, "lead"), gte(leads.createdAt, lastWeekStart), lte(leads.createdAt, thisWeekStart), soMeu ? eq(leads.responsavelId, userId) : undefined)),
    db.select({
      count: count(),
      mrrTotal: sql<string>`COALESCE(SUM(mrr_estimado::numeric), 0)`,
      pabxCount: sql<string>`COUNT(*) FILTER (WHERE campos_custom->>'produto' = 'pabx')`,
      aiCount: sql<string>`COUNT(*) FILTER (WHERE campos_custom->>'produto' IN ('ai','ai_pabx'))`,
    }).from(negocios).where(and(eq(negocios.organizacaoId, organizacaoId), inArray(negocios.status, ["proposta_apresentada", "negociacao_iniciada", "em_fechamento"]), soMeu ? eq(negocios.responsavelId, userId) : undefined)),
    db.select({
      total: sql<string>`COALESCE(SUM(mrr_fechado::numeric), 0)`,
      pabx: sql<string>`COALESCE(SUM(mrr_fechado::numeric) FILTER (WHERE campos_custom->>'produto' = 'pabx'), 0)`,
      ai: sql<string>`COALESCE(SUM(mrr_fechado::numeric) FILTER (WHERE campos_custom->>'produto' IN ('ai','ai_pabx')), 0)`,
    }).from(negocios).where(and(eq(negocios.organizacaoId, organizacaoId), eq(negocios.status, "ganho"), gte(negocios.ganhoAt, thisMonthStart), soMeu ? eq(negocios.responsavelId, userId) : undefined)),
    db.select({
      total: sql<string>`COALESCE(SUM(mrr::numeric), 0)`,
      pabx: sql<string>`COALESCE(SUM(mrr::numeric) FILTER (WHERE produto = 'pabx'), 0)`,
      ai: sql<string>`COALESCE(SUM(mrr::numeric) FILTER (WHERE produto = 'ai'), 0)`,
    }).from(contratos).where(and(eq(contratos.organizacaoId, organizacaoId), eq(contratos.status, "ativo"), soMeu ? inArray(contratos.leadId, meusLeadIds) : undefined)),
    db.select({
      total: sql<string>`COALESCE(SUM(valor_projeto::numeric), 0)`,
      count: count(),
    }).from(negocios).where(and(eq(negocios.organizacaoId, organizacaoId), eq(negocios.status, "ganho"), gte(negocios.ganhoAt, thisMonthStart), soMeu ? eq(negocios.responsavelId, userId) : undefined)),
    db.select({
      total: sql<string>`COALESCE(SUM(COALESCE(mrr_estimado::numeric, 0) + COALESCE(valor_projeto::numeric, 0)), 0)`,
      mrrTotal: sql<string>`COALESCE(SUM(mrr_estimado::numeric), 0)`,
      pabx: sql<string>`COALESCE(SUM(COALESCE(mrr_estimado::numeric, 0) + COALESCE(valor_projeto::numeric, 0)) FILTER (WHERE campos_custom->>'produto' = 'pabx'), 0)`,
      ai: sql<string>`COALESCE(SUM(COALESCE(mrr_estimado::numeric, 0) + COALESCE(valor_projeto::numeric, 0)) FILTER (WHERE campos_custom->>'produto' IN ('ai','ai_pabx')), 0)`,
    }).from(negocios).where(and(eq(negocios.organizacaoId, organizacaoId), notInArray(negocios.status, ["ganho", "perdido", "sem_retorno", "trava_negociacao", "trava_assinatura", "outra_data"]), soMeu ? eq(negocios.responsavelId, userId) : undefined)),

    db.select({
      status: negocios.status,
      count: count(),
      valorProjeto: sql<string>`COALESCE(SUM(valor_projeto::numeric), 0)`,
      mrrEstimado: sql<string>`COALESCE(SUM(mrr_estimado::numeric), 0)`,
    }).from(negocios).where(and(eq(negocios.organizacaoId, organizacaoId), soMeu ? eq(negocios.responsavelId, userId) : undefined)).groupBy(negocios.status),
    db.select()
      .from(atividades)
      .where(and(eq(atividades.organizacaoId, organizacaoId), soMeu ? eq(atividades.usuarioId, userId) : undefined))
      .orderBy(desc(atividades.createdAt))
      .limit(5),
  ]);

  const pipelineMap: Record<string, number> = {};
  const pipelineValorProjeto: Record<string, number> = {};
  const pipelineMrr: Record<string, number> = {};
  for (const row of pipelineCounts) {
    pipelineMap[row.status] = Number(row.count);
    pipelineValorProjeto[row.status] = parseFloat(row.valorProjeto) || 0;
    pipelineMrr[row.status] = parseFloat(row.mrrEstimado) || 0;
  }

  // Hero MRR: contratos vigentes + série mensal de fechamento (mini-gráfico)
  const [[contratosAtivosCount], mrrSerieRows] = await Promise.all([
    db.select({ c: count() }).from(contratos).where(and(eq(contratos.organizacaoId, organizacaoId), eq(contratos.status, "ativo"), soMeu ? inArray(contratos.leadId, meusLeadIds) : undefined)),
    db.execute(sql`
      SELECT to_char(date_trunc('month', ganho_at), 'YYYY-MM') AS mes, COALESCE(SUM(mrr_fechado::numeric), 0) AS total
      FROM negocios WHERE organizacao_id = ${organizacaoId} AND status = 'ganho' AND ganho_at >= GREATEST(now() - interval '14 months', DATE '2026-06-25') ${soMeu ? sql`AND responsavel_id = ${userId}` : sql``}
      GROUP BY 1 ORDER BY 1
    `),
  ]);
  const mrrSerie = (mrrSerieRows as unknown as Record<string, unknown>[]).map((r) => ({ mes: String(r.mes), total: Number(r.total) }));

  // Agenda do dia em diante: reuniões agendadas do usuário (clicar abre o negócio)
  const agenda = await db
    .select({
      id: reunioes.id,
      titulo: reunioes.titulo,
      data: reunioes.data,
      duracao: reunioes.duracao,
      tipo: reunioes.tipo,
      link: reunioes.link,
      negocioId: reunioes.negocioId,
      leadId: reunioes.leadId,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
    })
    .from(reunioes)
    .leftJoin(leads, eq(reunioes.leadId, leads.id))
    .where(and(
      eq(reunioes.organizacaoId, organizacaoId),
      eq(reunioes.responsavelId, userId),
      eq(reunioes.status, "agendada"),
      gte(reunioes.data, today),
    ))
    .orderBy(reunioes.data)
    .limit(8);

  return {
    agenda,
    alertas: { negociosNovosAntigos, negociosPropSemResposta, npsDetratores, contratosVencendo },
    contratosAtivos: Number(contratosAtivosCount.c),
    mrrSerie,
    tarefasDoDia,
    cards: {
      leadsThisWeek: Number(leadsThisWeek.count),
      leadsLastWeek: Number(leadsLastWeek.count),
      propostasAbertas: Number(propostasAbertas.count),
      propostasPabx: Number(propostasAbertas.pabxCount) || 0,
      propostasAi: Number(propostasAbertas.aiCount) || 0,
      propostasMrr: parseFloat(receitaTotalPipeline.mrrTotal) || 0,
      mrrFechadoMes: parseFloat(mrrFechadoMes.total) || 0,
      fechadoPabx: parseFloat(mrrFechadoMes.pabx) || 0,
      fechadoAi: parseFloat(mrrFechadoMes.ai) || 0,
      mrrAtivo: parseFloat(mrrAtivo.total) || 0,
      mrrAtivoPabx: parseFloat(mrrAtivo.pabx) || 0,
      mrrAtivoAi: parseFloat(mrrAtivo.ai) || 0,
      projetosFechadosMes: parseFloat(projetosFechadosMes.total) || 0,
      projetosFechadosCount: Number(projetosFechadosMes.count),
      receitaTotalPipeline: parseFloat(receitaTotalPipeline.total) || 0,
      pipelinePabx: parseFloat(receitaTotalPipeline.pabx) || 0,
      pipelineAi: parseFloat(receitaTotalPipeline.ai) || 0,
    },
    pipelineMap,
    pipelineValorProjeto,
    pipelineMrr,
    ultimasAtividades,
  };
}

export default async function DashboardPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <div className="p-8 text-white/30">Não autorizado</div>;
  const [data, pipelineConfig] = await Promise.all([
    getDashboardData(ctx.organizacaoId, ctx.userId, ctx.userRole),
    getPipelineConfig(ctx.organizacaoId),
  ]);
  const userName = ctx.userName.split(" ")[0] || "Usuário";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const _now = new Date();
  const semana = Math.ceil(((_now.getTime() - new Date(_now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(_now.getFullYear(), 0, 1).getDay() + 1) / 7);
  const dataHeader = `${_now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Semana ${semana}`;

  const totalAlertas =
    data.alertas.negociosNovosAntigos.length +
    data.alertas.negociosPropSemResposta.length +
    data.alertas.npsDetratores.length +
    data.alertas.contratosVencendo.length;

  const leadsDiff = data.cards.leadsThisWeek - data.cards.leadsLastWeek;
  const leadsUp = leadsDiff >= 0;

  return (
    <div className="page-scroll space-y-6">
      {/* Header com ações no topo direito (estilo Murilo) */}
      <div className="flex flex-wrap items-start justify-between gap-4" style={{ animation: "fadeUp 0.3s ease-out" }}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-medium">{dataHeader}</p>
          <h1 className="text-3xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-heading)" }}>
            {greeting}, {userName}.
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/contatos" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/70 bg-white/[0.03] border border-white/[0.06] hover:border-[#e23752]/40 hover:text-white transition-colors">
            <Search className="w-4 h-4 text-[#e23752]" />Buscar contato
          </Link>
          <Link href="/propostas/nova" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/70 bg-white/[0.03] border border-white/[0.06] hover:border-[#e23752]/40 hover:text-white transition-colors">
            <FilePlus2 className="w-4 h-4 text-[#e23752]" />Nova proposta
          </Link>
          <Link href="/leads" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#e23752]/15 border border-[#e23752]/40 hover:bg-[#e23752]/25 transition-colors">
            <UserPlus className="w-4 h-4 text-[#e23752]" />Adicionar lead
          </Link>
        </div>
      </div>

      {/* Hero MRR + KPIs (estilo Murilo) */}
      <div className="grid gap-4 lg:grid-cols-3" style={{ animation: "fadeUp 0.3s ease-out 0.05s both" }}>
        {/* Hero: MRR (receita recorrente ativa) */}
        <div className="lg:col-span-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 flex flex-col justify-between min-h-[200px]">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium">MRR · Receita recorrente mensal</p>
            <p className="font-semibold text-white mt-2" style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(1.9rem,3.8vw,3rem)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>
              R$ {data.cards.mrrAtivo.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm text-white/40 mt-2">{data.contratosAtivos} contrato{data.contratosAtivos !== 1 ? "s" : ""} vigente{data.contratosAtivos !== 1 ? "s" : ""}</p>
          </div>
          {data.mrrSerie.length > 1 && (
            <div className="flex items-end gap-1 h-16 mt-5">
              {data.mrrSerie.map((m, i) => {
                const max = Math.max(...data.mrrSerie.map((x) => x.total), 1);
                const h = Math.max((m.total / max) * 100, 3);
                const isLast = i === data.mrrSerie.length - 1;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all"
                    style={{ height: `${h}%`, background: isLast ? "linear-gradient(to top,#e23752,#8e27ef)" : "rgba(255,255,255,0.07)" }}
                    title={`${m.mes}: R$ ${m.total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* KPIs 2x2 (direita) */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 grid grid-cols-2 gap-x-5 gap-y-6 content-center">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Leads (semana)</p>
            <p className="text-2xl font-bold text-white mt-1">{data.cards.leadsThisWeek}</p>
            {data.cards.leadsLastWeek > 0 ? (
              <p className={`text-[11px] mt-0.5 flex items-center gap-0.5 ${leadsUp ? "text-[#c8ff00]" : "text-red-400"}`}>
                {leadsUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{leadsUp ? "+" : ""}{leadsDiff} vs anterior
              </p>
            ) : <p className="text-[11px] text-white/25 mt-0.5">sem dados anteriores</p>}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Propostas abertas</p>
            <p className="text-2xl font-bold text-white mt-1">{data.cards.propostasAbertas}</p>
            <p className="text-[11px] text-white/30 mt-0.5">R$ {data.cards.receitaTotalPipeline.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} em pipeline</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Fechado (mês)</p>
            <p className="text-2xl font-bold text-[#c8ff00] mt-1">R$ {(data.cards.mrrFechadoMes + data.cards.projetosFechadosMes).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
            <p className="text-[11px] text-white/30 mt-0.5">{data.cards.projetosFechadosCount} negócio{data.cards.projetosFechadosCount !== 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Conversão</p>
            <p className="text-2xl font-bold text-[#e23752] mt-1">{data.cards.leadsThisWeek > 0 ? Math.round((data.cards.projetosFechadosCount / Math.max(data.cards.leadsThisWeek, 1)) * 100) : 0}%</p>
            <p className="text-[11px] text-white/30 mt-0.5">{data.cards.projetosFechadosCount} fechado{data.cards.projetosFechadosCount !== 1 ? "s" : ""} este mês</p>
          </div>
        </div>
      </div>

      {/* Requer atenção (recolhível) */}
      <AlertasUrgentes
        negociosNovosAntigos={data.alertas.negociosNovosAntigos}
        negociosPropSemResposta={data.alertas.negociosPropSemResposta}
        contratosVencendo={data.alertas.contratosVencendo}
        total={totalAlertas}
      />

      {/* Tarefas + Últimas atividades (2 colunas, estilo Murilo) */}
      <div className="grid gap-4 lg:grid-cols-2" style={{ animation: "fadeUp 0.3s ease-out 0.35s both" }}>
        <MeuDiaClient tarefasIniciais={data.tarefasDoDia} agenda={data.agenda} />

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <h2 className="text-sm font-semibold text-white/70 mb-3">Últimas atividades</h2>
          {data.ultimasAtividades.length === 0 ? (
            <>
              <p className="text-sm text-white/40">Nenhuma atividade registrada</p>
              <p className="text-[10px] text-white/25 mt-1">As atividades registradas (ligações, emails, reuniões) aparecerão aqui.</p>
            </>
          ) : (
            <div className="space-y-2">
              {data.ultimasAtividades.map((a) => {
                const icons: Record<string, string> = {
                  ligacao: "📞", email: "📧", nota: "📝", reuniao: "🤝",
                  proposta_enviada: "📄", follow_up: "📋", diagnostico: "🔍",
                  whatsapp: "💬", tarefa: "⏰",
                };
                const mins = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 60000);
                const timeStr = mins < 60 ? `há ${mins}min` : mins < 1440 ? `há ${Math.floor(mins / 60)}h` : `há ${Math.floor(mins / 1440)}d`;
                return (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="text-lg">{icons[a.tipo] || "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{a.titulo || a.descricao || a.tipo}</p>
                      <p className="text-xs text-white/30">{timeStr}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
