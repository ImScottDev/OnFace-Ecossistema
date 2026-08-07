import { db } from "@/lib/db";
import { leads, negocios, tarefas, atividades, contratos, npsRespostas, statusChanges, reunioes, usuarios } from "@/lib/db/schema";
import { count, eq, sql, and, gte, lte, desc, or, isNull, notInArray, inArray } from "drizzle-orm";
import { getPipelineConfig } from "@/lib/crm/getPipelineConfig";
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView, isPersonalView, isReader } from "@/lib/auth/roles";
import { getMetasDoUsuario, getRealizadoMeta, getMetaComercialAgregada, metaTipoPorPapel, type MetaTipo } from "@/lib/metas";
import { META_LABELS } from "@/lib/metas-shared";
import { MetaProgress } from "@/app/(crm)/relatorios/components/MetaProgress";
import Link from "next/link";
import { MeuDiaClient } from "@/components/crm/MeuDiaClient";
import { AlertasUrgentes } from "@/components/crm/AlertasUrgentes";
import { TrendingUp, TrendingDown, Search, FilePlus2, UserPlus, Lock, Wallet, FileText, Users, Filter, CalendarCheck, Trophy, Snowflake, Zap, CalendarX } from "lucide-react";
import { AlertasCard, type AlertaUi } from "@/app/(crm)/relatorios/components/AlertasCard";
import { Stat, Secao, BarraLinha, DOMINIO } from "@/app/(crm)/relatorios/components/kit";
import { getPipelineEsfriando, getLeadsQualificados, getFechadoPeriodo, getPipelineAtual, type NegocioEsfriando } from "@/lib/relatorios/comercial";
import { contarReunioes } from "@/lib/relatorios/funil-eventos";
import { NEGOCIO_STAGES } from "@/lib/crm/pipeline";

async function getDashboardData(organizacaoId: string, userId: string, role: string) {
  // Ramificação por papel (30/jun): admin/gerente veem o agregado da empresa;
  // closer/sdr (isPersonalView) veem os números DELES (filtro por responsavelId).
  // Tarefas/Agenda sempre pessoais (usam userId direto).
  const soMeu = isPersonalView(role);
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
  const [[contratosAtivosCount], [contratosNovosMesRow], mrrSerieRows] = await Promise.all([
    db.select({ c: count() }).from(contratos).where(and(eq(contratos.organizacaoId, organizacaoId), eq(contratos.status, "ativo"), soMeu ? inArray(contratos.leadId, meusLeadIds) : undefined)),
    db.select({ c: count() }).from(contratos).where(and(eq(contratos.organizacaoId, organizacaoId), eq(contratos.status, "ativo"), gte(contratos.inicio, thisMonthStart.toISOString().split("T")[0]), soMeu ? inArray(contratos.leadId, meusLeadIds) : undefined)),
    db.execute(sql`
      SELECT to_char(date_trunc('month', ganho_at), 'YYYY-MM') AS mes, COALESCE(SUM(mrr_fechado::numeric), 0) AS total
      FROM negocios WHERE organizacao_id = ${organizacaoId} AND status = 'ganho' AND ganho_at >= GREATEST(now() - interval '14 months', DATE '2026-06-25') ${soMeu ? sql`AND responsavel_id = ${userId}` : sql``}
      GROUP BY 1 ORDER BY 1
    `),
  ]);
  const mrrSerie = (mrrSerieRows as unknown as Record<string, unknown>[]).map((r) => ({ mes: String(r.mes), total: Number(r.total) }));

  // Metas do mês do usuário — pode ter VÁRIAS (ex: SDR = reuniões + reuniões outbound + MRR).
  // Sempre mostra a north-star do papel + qualquer outra meta cadastrada pro usuário.
  let meta: { tipo: MetaTipo; valorAlvo: number; realizado: number } | null = null;
  let metas: { tipo: MetaTipo; valorAlvo: number; realizado: number }[] = [];
  if (soMeu) {
    const northStar = metaTipoPorPapel(role);
    const metasUsuario = await getMetasDoUsuario(organizacaoId, userId, thisMonthStart);
    const tipos = Array.from(new Set<MetaTipo>([northStar, ...metasUsuario.map((m) => m.tipo as MetaTipo)]));
    metas = await Promise.all(
      tipos.map(async (tipo) => {
        const metaRow = metasUsuario.find((m) => m.tipo === tipo);
        const realizado = await getRealizadoMeta(organizacaoId, userId, thisMonthStart, tipo);
        return { tipo, valorAlvo: metaRow ? parseFloat(String(metaRow.valorAlvo)) || 0 : 0, realizado };
      }),
    );
    meta = metas.find((m) => m.tipo === northStar) ?? metas[0] ?? null;
  }

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

  // ── Esteira SDR (acúmulo do MÊS) — escopo pela responsável do LEAD (a SDR), não
  //    do negócio (que vira o closer no handoff). Qualificado = ela marcou a call
  //    (lead virou negócio); cliente = negócio ganho; no-show = não compareceu. ──
  const meusLeadsFilter = soMeu ? eq(leads.responsavelId, userId) : undefined;
  const [[leadsMesRow], [qualifMesRow], [clientesMesRow], [noShowRow]] = await Promise.all([
    db.select({ c: count() }).from(leads)
      .where(and(eq(leads.organizacaoId, organizacaoId), gte(leads.createdAt, thisMonthStart), meusLeadsFilter)),
    db.select({ c: sql<number>`COUNT(DISTINCT ${negocios.leadId})` }).from(negocios)
      .innerJoin(leads, eq(negocios.leadId, leads.id))
      .where(and(eq(negocios.organizacaoId, organizacaoId), gte(negocios.createdAt, thisMonthStart), meusLeadsFilter)),
    db.select({ c: sql<number>`COUNT(DISTINCT ${negocios.leadId})` }).from(negocios)
      .innerJoin(leads, eq(negocios.leadId, leads.id))
      .where(and(eq(negocios.organizacaoId, organizacaoId), eq(negocios.status, "ganho"), gte(negocios.ganhoAt, thisMonthStart), meusLeadsFilter)),
    db.select({ c: count() }).from(negocios)
      .innerJoin(leads, eq(negocios.leadId, leads.id))
      .where(and(eq(negocios.organizacaoId, organizacaoId), eq(negocios.status, "no_show"), meusLeadsFilter)),
  ]);

  // Fontes CANÔNICAS (mesmas dos relatórios — validação Kauã 22/07):
  // - Fechado do mês = getFechadoPeriodo (recorrente=mrr_fechado; avulso=valor_total
  //   só de tipo 'avulso'). Antes o card somava mrr + valor_projeto e dava R$27.270
  //   quando a meta mostrava R$18.177 (o projeto de um híbrido entrava dobrado).
  // - Pipeline aberto = getPipelineAtual (soma valorTotal das etapas ativas).
  // - MRR "real" = espelho do STRIPE (assinaturas ativas), não a soma de contratos
  //   do CRM (que inclui boleto pendente/migração sem espelho).
  const [pipelineAtual, fechadoMesCanon, mrrStripeRows, mrrRiscoRows] = await Promise.all([
    getPipelineAtual(organizacaoId, soMeu ? userId : undefined),
    getFechadoPeriodo(organizacaoId, thisMonthStart, now, soMeu ? userId : undefined),
    db.execute(sql`
      SELECT COALESCE(sum(mrr::numeric),0) AS mrr, count(DISTINCT lead_id) AS clientes
      FROM assinaturas WHERE organizacao_id = ${organizacaoId} AND status IN ('active','trialing','past_due')
    `),
    // MRR "em risco": venda já feita, contrato vivo (não cancelado), mas as
    // tentativas automáticas de cobrança (past_due, já contado no MRR ativo acima)
    // já se esgotaram sem sucesso (unpaid) — precisa de ação manual, achado real
    // 04/08 (escondia parte real do crescimento de MRR atrás do número isolado).
    db.execute(sql`
      SELECT COALESCE(sum(mrr::numeric),0) AS mrr, count(*) AS qtd
      FROM assinaturas WHERE organizacao_id = ${organizacaoId} AND status = 'unpaid'
    `),
  ]);
  const mrrStripeRow = (mrrStripeRows as unknown as { mrr: unknown; clientes: unknown }[])[0] ?? { mrr: 0, clientes: 0 };
  const mrrRiscoRow = (mrrRiscoRows as unknown as { mrr: unknown; qtd: unknown }[])[0] ?? { mrr: 0, qtd: 0 };

  // Leads aguardando PRIMEIRO contato (esteira SDR) + negócios esfriando (closer)
  const [[pendentesRow], esfriando] = await Promise.all([
    db.select({ c: count() }).from(leads)
      .where(and(
        eq(leads.organizacaoId, organizacaoId),
        eq(leads.tipo, "lead"),
        or(isNull(leads.sdrStatus), eq(leads.sdrStatus, "pending")),
        soMeu ? eq(leads.responsavelId, userId) : undefined,
      )),
    soMeu ? getPipelineEsfriando(organizacaoId, userId, 5, 8) : Promise.resolve([] as NegocioEsfriando[]),
  ]);

  return {
    agenda,
    meta,
    metas,
    pendentesPrimeiroContato: Number(pendentesRow.c),
    esfriando,
    pipelineAtual: { total: pipelineAtual.total, negociosAbertos: pipelineAtual.negociosAbertos },
    fechadoMesCanon,
    mrrStripe: Number(mrrStripeRow.mrr) || 0,
    clientesStripe: Number(mrrStripeRow.clientes) || 0,
    mrrEmRisco: Number(mrrRiscoRow.mrr) || 0,
    qtdEmRisco: Number(mrrRiscoRow.qtd) || 0,
    alertas: { negociosNovosAntigos, negociosPropSemResposta, npsDetratores, contratosVencendo },
    contratosAtivos: Number(contratosAtivosCount.c),
    contratosNovosMes: Number(contratosNovosMesRow.c),
    mrrSerie,
    tarefasDoDia,
    cards: {
      leadsThisWeek: Number(leadsThisWeek.count),
      leadsLastWeek: Number(leadsLastWeek.count),
      // Esteira SDR (mês)
      leadsMes: Number(leadsMesRow.c),
      leadsQualificadosMes: Number(qualifMesRow.c),
      clientesGanhosMes: Number(clientesMesRow.c),
      noShowMes: Number(noShowRow.c),
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

/** Metas do mês corrente de todos os vendedores ativos (closer/sdr) da org — bloco do gestor. */
async function getMetasPorVendedor(organizacaoId: string) {
  const now = new Date();
  const periodo = new Date(now.getFullYear(), now.getMonth(), 1);
  const vendedores = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(and(
      eq(usuarios.organizacaoId, organizacaoId),
      eq(usuarios.ativo, true),
      inArray(usuarios.role, ["closer", "sdr", "vendedor"]),
    ))
    .orderBy(usuarios.nome);

  return Promise.all(vendedores.map(async (u) => {
    const tipo = metaTipoPorPapel(u.role);
    const [metasUsuario, realizado] = await Promise.all([
      getMetasDoUsuario(organizacaoId, u.id, periodo),
      getRealizadoMeta(organizacaoId, u.id, periodo, tipo),
    ]);
    const metaRow = metasUsuario.find((m) => m.tipo === tipo);
    const valorAlvo = metaRow ? parseFloat(String(metaRow.valorAlvo)) || 0 : 0;
    const pct = valorAlvo > 0 ? Math.round((realizado / valorAlvo) * 100) : 0;
    return { id: u.id, nome: u.nome, role: u.role, tipo, valorAlvo, realizado, pct };
  }));
}

function fmtMeta(tipo: string, v: number): string {
  if (tipo === "mrr_fechado") return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(Math.round(v));
}

function papelLabel(role: string): string {
  if (role === "sdr") return "SDR";
  if (role === "closer" || role === "vendedor") return "Closer";
  if (role === "gerente") return "Gerente";
  if (role === "admin" || role === "super_admin") return "Admin";
  return role;
}

const brl = (v: number, frac = 2) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: frac, maximumFractionDigits: frac });

/** Meta em risco pelo ritmo do mês (pró-rata) — versão server-safe. */
function alertaMetaRitmo(valorAlvo: number, realizado: number): AlertaUi | null {
  if (valorAlvo <= 0) return null;
  const agora = new Date();
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const pctMes = agora.getDate() / diasNoMes;
  const pctMeta = realizado / valorAlvo;
  if (pctMeta >= 1) return { nivel: "verde", texto: `Meta do mês batida (${Math.round(pctMeta * 100)}%).` };
  if (pctMeta >= pctMes * 0.85) return null;
  return {
    nivel: pctMeta < pctMes * 0.5 ? "vermelho" : "amarelo",
    texto: `Meta em risco: ${Math.round(pctMeta * 100)}% realizado com ${Math.round(pctMes * 100)}% do mês decorrido — faltam ${brl(valorAlvo - realizado)}.`,
  };
}

export default async function DashboardPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <div className="p-8 text-white/30">Não autorizado</div>;

  const role = ctx.userRole;
  const adminView = isAdminView(role);
  const personalView = isPersonalView(role);
  const readerView = isReader(role);

  const [data, pipelineConfig] = await Promise.all([
    getDashboardData(ctx.organizacaoId, ctx.userId, role),
    getPipelineConfig(ctx.organizacaoId),
  ]);
  void pipelineConfig;
  const metasVendedores = adminView ? await getMetasPorVendedor(ctx.organizacaoId) : [];
  // Meta mensal AGREGADA da empresa (soma das metas de MRR fechado das closers) —
  // visão do gestor no Meu Dia: quanto a empresa precisa fechar e o quanto já fechou.
  const metaEmpresa = adminView ? await getMetaComercialAgregada(ctx.organizacaoId, new Date()) : null;

  // Funil do MÊS pro panorama do gestor — mesmas fontes canônicas dos relatórios
  // (lib/relatorios), então dashboard e aba Growth nunca divergem.
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const agora = new Date();
  const [reunioesMes, qualificadosMes, fechadoCanon] = adminView
    ? await Promise.all([
        contarReunioes(ctx.organizacaoId, inicioMes, agora),
        getLeadsQualificados(ctx.organizacaoId, inicioMes, agora),
        getFechadoPeriodo(ctx.organizacaoId, inicioMes, agora),
      ])
    : [null, null, null];

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
  // Régua canônica (mesma da meta e dos relatórios) — NÃO somar valor_projeto aqui.
  const fechadoMes = data.fechadoMesCanon.receita;
  const fechadoGanhos = data.fechadoMesCanon.ganhos;
  const hoje = new Date();
  const reunioesHoje = data.agenda.filter((a) => {
    const d = new Date(a.data);
    return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();
  });

  const leadsSub = data.cards.leadsLastWeek > 0 ? (
    <span className={`flex items-center gap-0.5 ${leadsUp ? "text-[#c8ff00]" : "text-red-400"}`}>
      {leadsUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{leadsUp ? "+" : ""}{leadsDiff} vs anterior
    </span>
  ) : <span className="text-white/25">sem dados anteriores</span>;

  // ── Radar por papel: o que fazer AGORA, antes de qualquer número ──
  const radar: AlertaUi[] = [];
  if (role === "closer" || role === "vendedor") {
    if (reunioesHoje.length > 0) radar.push({ nivel: "verde", texto: `${reunioesHoje.length} reuni${reunioesHoje.length === 1 ? "ão" : "ões"} hoje — confirmar presença com o lead.` });
    if (data.alertas.negociosNovosAntigos.length > 0) radar.push({ nivel: "vermelho", texto: `${data.alertas.negociosNovosAntigos.length} negócio(s) novo(s) sem primeiro toque há 2h+ — velocidade de resposta fecha venda.` });
    if (data.alertas.negociosPropSemResposta.length > 0) radar.push({ nivel: "amarelo", texto: `${data.alertas.negociosPropSemResposta.length} proposta(s) sem resposta há 3+ dias — hora do follow-up.` });
    if (data.esfriando.length >= 2) radar.push({ nivel: data.esfriando.length >= 5 ? "vermelho" : "amarelo", texto: `${data.esfriando.length} negócios seus parados há 5+ dias (${brl(data.esfriando.reduce((s, n) => s + n.valor, 0), 0)}) — lista abaixo.` });
    const m = data.meta;
    const mr = m ? alertaMetaRitmo(m.valorAlvo, m.realizado) : null;
    if (mr) radar.push(mr);
  } else if (role === "sdr") {
    if (data.pendentesPrimeiroContato > 0) radar.push({ nivel: data.pendentesPrimeiroContato >= 15 ? "vermelho" : "amarelo", texto: `${data.pendentesPrimeiroContato} lead(s) aguardando o PRIMEIRO contato — começar por eles.` });
    if (reunioesHoje.length > 0) radar.push({ nivel: "verde", texto: `${reunioesHoje.length} reuni${reunioesHoje.length === 1 ? "ão" : "ões"} hoje — confirmar presença na véspera evita no-show.` });
    const m = data.meta;
    const mr = m ? alertaMetaRitmo(m.valorAlvo, m.realizado) : null;
    if (mr) radar.push(mr);
  } else if (adminView) {
    const mr = metaEmpresa ? alertaMetaRitmo(metaEmpresa.valorAlvo, metaEmpresa.realizado) : null;
    if (mr) radar.push(mr);
    if (data.alertas.contratosVencendo.length > 0) {
      const mrrRisco = data.alertas.contratosVencendo.reduce((s, c2) => s + (Number(c2.mrr) || 0), 0);
      radar.push({ nivel: "amarelo", texto: `${data.alertas.contratosVencendo.length} contrato(s) vencendo em 60 dias (${brl(mrrRisco, 0)} de MRR) — renovação é retenção.` });
    }
    if (reunioesMes && reunioesMes.agendadas >= 10 && reunioesMes.noShow / reunioesMes.agendadas > 0.25) {
      radar.push({ nivel: "vermelho", texto: `No-show em ${Math.round((reunioesMes.noShow / reunioesMes.agendadas) * 100)}% das reuniões do mês — reforçar confirmação.` });
    }
    // Contratos no CRM sem espelho no Stripe (boleto pendente, migração) inflam o MRR
    const mrrContratos = data.cards.mrrAtivo;
    if (data.mrrStripe > 0 && mrrContratos > data.mrrStripe * 1.1) {
      radar.push({ nivel: "amarelo", texto: `Contratos no CRM somam ${brl(mrrContratos, 0)}, mas o Stripe cobra ${brl(data.mrrStripe, 0)} — ${brl(mrrContratos - data.mrrStripe, 0)} sem espelho de cobrança (boleto pendente / fora do Stripe). Conferir na aba Financeiro.` });
    }
  }

  // Hero MRR (gestor): série mensal + pulso lima
  const heroMrr = (
    <div
      className="lg:col-span-2 relative rounded-2xl border border-white/[0.09] p-6 flex flex-col justify-between min-h-[200px] overflow-hidden"
      style={{ background: "var(--surface-2, #1A1A1A)" }}
    >
      <span className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full" style={{ background: "rgba(255,255,255,0.16)" }} />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 font-medium pt-1.5">MRR · Receita recorrente mensal (Stripe)</p>
          <span className="w-9 h-9 rounded-lg border border-white/[0.12] flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-white/45" />
          </span>
        </div>
        <p className="font-bold text-white mt-2 tabular-nums" style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(1.9rem,3.8vw,3rem)", lineHeight: 1.05, letterSpacing: "-0.015em" }}>
          R$ {data.mrrStripe.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
        <p className="text-sm text-white/40 mt-2">
          {data.clientesStripe} cliente{data.clientesStripe !== 1 ? "s" : ""} pagante{data.clientesStripe !== 1 ? "s" : ""} no Stripe
          {data.mrrEmRisco > 0 && (
            <> · <span className="text-amber-400/80">{brl(data.mrrEmRisco, 0)} em risco</span> ({data.qtdEmRisco} contrato{data.qtdEmRisco !== 1 ? "s" : ""} sem cobrança há semanas)</>
          )}
        </p>
      </div>
      {/* Série mensal só quando há histórico suficiente pra ler tendência (4+ meses).
          Com 2 meses virava um retângulo gigante sem significado (feedback Kauã 21/07) —
          até lá, o rodapé traz informação de verdade: contratos novos e ticket médio. */}
      {data.mrrSerie.length >= 4 ? (
        <div className="flex items-end gap-1 h-16 mt-5 pl-2">
          {data.mrrSerie.map((m, i) => {
            const max = Math.max(...data.mrrSerie.map((x) => x.total), 1);
            const h = Math.max((m.total / max) * 100, 3);
            const isLast = i === data.mrrSerie.length - 1;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all"
                style={{ height: `${h}%`, background: isLast ? "#c8ff00" : "rgba(255,255,255,0.08)" }}
                title={`${m.mes}: R$ ${m.total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pl-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/35 font-medium">Contratos novos no mês</p>
            <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: "#c8ff00", fontFamily: "var(--font-heading)" }}>
              {data.contratosNovosMes > 0 ? `+${data.contratosNovosMes}` : "0"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/35 font-medium">Ticket médio por contrato</p>
            <p className="text-lg font-bold tabular-nums mt-0.5 text-white/90" style={{ fontFamily: "var(--font-heading)" }}>
              {data.contratosAtivos > 0 ? brl(data.cards.mrrAtivo / data.contratosAtivos, 0) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/35 font-medium">MRR novo no mês</p>
            <p className="text-lg font-bold tabular-nums mt-0.5 text-white/90" style={{ fontFamily: "var(--font-heading)" }}>
              {brl(data.cards.mrrFechadoMes, 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // KPIs do gestor ao lado do hero
  const kpisComReceita = (
    <div className="grid grid-cols-1 gap-3 content-stretch">
      <Stat label="Fechado (mês)" value={brl(fechadoMes)} sub={`${fechadoGanhos} negócio${fechadoGanhos !== 1 ? "s" : ""} · MRR novo${data.fechadoMesCanon.avulso > 0 ? ` + ${brl(data.fechadoMesCanon.avulso, 0)} avulso` : ""}`} cor="ganho" icon={Trophy} />
      <Stat label="Pipeline aberto" value={brl(data.pipelineAtual.total, 0)} sub={`${data.pipelineAtual.negociosAbertos} negócios em andamento`} icon={FileText} />
      <Stat label="Leads (semana)" value={data.cards.leadsThisWeek} sub={leadsSub} icon={Users} />
    </div>
  );

  // Faixa do closer: fechado no mês + operação do dia
  const faixaCloser = (
    <div className="grid gap-3 lg:grid-cols-3">
      <div
        className="relative min-w-0 rounded-2xl border border-white/[0.09] p-5 lg:p-6 overflow-hidden"
        style={{ background: "var(--surface-2, #1A1A1A)" }}
      >
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: "rgba(255,255,255,0.16)" }} />
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 font-medium pl-2">Fechado no mês</p>
        <p className="font-bold tabular-nums mt-2 pl-2 break-words" style={{ color: "#fff", fontFamily: "var(--font-heading)", fontSize: "clamp(1.8rem,3vw,2.6rem)", lineHeight: 1.05 }}>
          {brl(fechadoMes)}
        </p>
        <p className="text-[11px] text-white/40 mt-2 pl-2">{fechadoGanhos} negócio{fechadoGanhos !== 1 ? "s" : ""} ganho{fechadoGanhos !== 1 ? "s" : ""} · MRR novo</p>
      </div>
      <div className="lg:col-span-2 grid grid-cols-2 xl:grid-cols-4 gap-3 content-stretch">
        <Stat label="Reuniões hoje" value={reunioesHoje.length} sub="na sua agenda" icon={CalendarCheck} />
        <Stat label="Pipeline aberto" value={brl(data.pipelineAtual.total, 0)} sub={`${data.pipelineAtual.negociosAbertos} negócios em jogo`} icon={FileText} />
        <Stat label="Sem 1º toque" value={data.alertas.negociosNovosAntigos.length} sub="negócios novos parados" cor={data.alertas.negociosNovosAntigos.length > 0 ? "critico" : "neutro"} icon={Zap} />
        <Stat label="Esfriando" value={data.esfriando.length} sub="parados há 5+ dias" cor={data.esfriando.length >= 5 ? "critico" : "atencao"} icon={Snowflake} />
      </div>
    </div>
  );

  // Faixa da SDR: esteira do mês + hoje
  const faixaSdr = (
    <div className="grid gap-3 lg:grid-cols-3">
      <div
        className="relative min-w-0 rounded-2xl border border-white/[0.09] p-5 lg:p-6 overflow-hidden"
        style={{ background: "var(--surface-2, #1A1A1A)" }}
      >
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: "rgba(255,255,255,0.16)" }} />
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 font-medium pl-2">Aguardando 1º contato</p>
        <p className="font-bold tabular-nums mt-2 pl-2" style={{ color: "#fff", fontFamily: "var(--font-heading)", fontSize: "clamp(1.8rem,3vw,2.6rem)", lineHeight: 1.05 }}>
          {data.pendentesPrimeiroContato}
        </p>
        <p className="text-[11px] text-white/40 mt-2 pl-2">é por aqui que o dia começa</p>
      </div>
      <div className="lg:col-span-2 grid grid-cols-2 xl:grid-cols-4 gap-3 content-stretch">
        <Stat label="Leads (mês)" value={data.cards.leadsMes} sub="entraram na esteira" icon={Users} />
        <Stat label="Qualificados" value={data.cards.leadsQualificadosMes} sub="marcaram a call" cor="ganho" icon={Filter} />
        <Stat label="Viraram clientes" value={data.cards.clientesGanhosMes} sub="ganhos no mês" cor="ganho" icon={Trophy} />
        <Stat label="No-show" value={data.cards.noShowMes} sub="não compareceram" cor={data.cards.noShowMes > 0 ? "atencao" : "neutro"} icon={CalendarX} />
      </div>
    </div>
  );

  // Lista de negócios esfriando (closer)
  const listaEsfriando = data.esfriando.length > 0 && (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <h2 className="text-sm font-semibold text-white/70 mb-3">Negócios esfriando — retomar antes que morram</h2>
      <div className="space-y-1.5">
        {data.esfriando.map((n) => (
          <Link key={n.id} href={`/negocios/${n.id}`} className="flex items-center gap-3 py-1 rounded-lg px-2 hover:bg-white/[0.04] transition-colors">
            <span className="text-[12.5px] text-white/70 flex-1 truncate">{n.titulo}</span>
            <span className="text-[11px] text-white/40 tabular-nums">{brl(n.valor, 0)}</span>
            <span
              className="text-[11px] font-medium px-1.5 py-0.5 rounded-full tabular-nums"
              style={{ background: n.diasParado >= 14 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)", color: n.diasParado >= 14 ? "#EF4444" : "#F59E0B" }}
            >
              {n.diasParado}d
            </span>
          </Link>
        ))}
      </div>
    </div>
  );

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
        {readerView ? (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 bg-white/[0.03] border border-white/[0.06]">
            <Lock className="w-3.5 h-3.5" />Somente leitura
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Link href="/contatos" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/70 bg-white/[0.03] border border-white/[0.06] hover:border-[#e23752]/40 hover:text-white transition-colors">
              <Search className="w-4 h-4 text-[#e23752]" />Buscar contato
            </Link>
            <Link href="/propostas/nova" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/70 bg-white/[0.03] border border-white/[0.06] hover:border-[#e23752]/40 hover:text-white transition-colors">
              <FilePlus2 className="w-4 h-4 text-[#e23752]" />Nova proposta
            </Link>
            <Link href="/contatos?tipo=lead" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#e23752]/15 border border-[#e23752]/40 hover:bg-[#e23752]/25 transition-colors">
              <UserPlus className="w-4 h-4 text-[#e23752]" />Adicionar lead
            </Link>
          </div>
        )}
      </div>

      {/* Visão pessoal (closer/sdr): metas do mês no topo (pode ter várias) */}
      {personalView && data.metas && data.metas.length > 0 && (
        <div
          style={{ animation: "fadeUp 0.3s ease-out 0.05s both" }}
          className={data.metas.length > 1 ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : ""}
        >
          {data.metas.map((m) => (
            <MetaProgress
              key={m.tipo}
              tipo={m.tipo}
              valorAlvo={m.valorAlvo}
              realizado={m.realizado}
              label={`Minha meta do mês (${META_LABELS[m.tipo].toLowerCase()})`}
            />
          ))}
        </div>
      )}

      {/* Gestor: meta mensal da empresa (MRR fechado agregado) com ritmo */}
      {adminView && metaEmpresa && metaEmpresa.valorAlvo > 0 && (
        <div style={{ animation: "fadeUp 0.3s ease-out 0.05s both" }}>
          <MetaProgress
            tipo="mrr_fechado"
            valorAlvo={metaEmpresa.valorAlvo}
            realizado={metaEmpresa.realizado}
            label={`Meta da empresa · mês (MRR fechado · ${metaEmpresa.closers} closer${metaEmpresa.closers !== 1 ? "s" : ""})`}
          />
        </div>
      )}

      {/* Radar: o que fazer agora (por papel) */}
      {!readerView && radar.length > 0 && (
        <div style={{ animation: "fadeUp 0.3s ease-out 0.08s both" }}>
          <AlertasCard alertas={radar} />
        </div>
      )}

      {/* KPIs — variam por papel */}
      {role === "closer" || role === "vendedor" ? (
        <div style={{ animation: "fadeUp 0.3s ease-out 0.1s both" }}>{faixaCloser}</div>
      ) : role === "sdr" ? (
        <div style={{ animation: "fadeUp 0.3s ease-out 0.1s both" }}>{faixaSdr}</div>
      ) : (
        // admin/gerente/leitor: agregado da empresa (hero global + KPIs)
        <div className="grid gap-4 lg:grid-cols-3" style={{ animation: "fadeUp 0.3s ease-out 0.05s both" }}>
          {heroMrr}
          {kpisComReceita}
        </div>
      )}

      {/* Gestor: funil do mês (fontes canônicas — bate com a aba Growth) + pipeline agora */}
      {adminView && reunioesMes && fechadoCanon && (
        <div className="space-y-3" style={{ animation: "fadeUp 0.3s ease-out 0.15s both" }}>
          <Secao cor="funil" hint="mês corrente · mesmas fontes dos relatórios">Funil do mês</Secao>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Leads" value={data.cards.leadsMes} sub="entraram no mês" icon={Users} />
            <Stat label="Qualificados" value={qualificadosMes ?? 0} sub="criaram negócio" icon={Filter} />
            <Stat label="Reuniões realizadas" value={reunioesMes.realizadas} sub={`${reunioesMes.agendadas} agendadas · ${reunioesMes.taxaComparecimento}% avançaram`} icon={CalendarCheck} />
            <Stat label="Ganhos" value={fechadoCanon.ganhos} sub="negócios fechados" cor="ganho" icon={Trophy} />
            <Stat label="Receita fechada" value={brl(fechadoCanon.receita, 0)} sub={`recorrente ${brl(fechadoCanon.recorrente, 0)}`} cor="ganho" icon={Wallet} />
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <h2 className="text-sm font-semibold text-white/70 mb-3">Pipeline agora · negócios abertos por etapa</h2>
            <div className="space-y-1">
              {NEGOCIO_STAGES.map((s) => {
                const c2 = data.pipelineMap[s.key] ?? 0;
                const max = Math.max(...NEGOCIO_STAGES.map((x) => data.pipelineMap[x.key] ?? 0), 1);
                return <BarraLinha key={s.key} label={s.label} valor={c2} max={max} direita={String(c2)} cor="pipeline" />;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Gestor: metas por vendedor */}
      {adminView && metasVendedores.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5" style={{ animation: "fadeUp 0.3s ease-out 0.2s both" }}>
          <h2 className="text-sm font-semibold text-white/70 mb-4">Metas por vendedor · mês corrente</h2>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
                  <th className="text-left font-medium pb-2">Vendedor</th>
                  <th className="text-left font-medium pb-2">Papel</th>
                  <th className="text-right font-medium pb-2">Meta</th>
                  <th className="text-right font-medium pb-2">Realizado</th>
                  <th className="text-right font-medium pb-2">% atingido</th>
                </tr>
              </thead>
              <tbody>
                {metasVendedores.map((v) => (
                  <tr key={v.id} className="border-b border-white/[0.03]">
                    <td className="py-2.5 text-white">{v.nome}</td>
                    <td className="py-2.5 text-white/50">{papelLabel(v.role)}</td>
                    <td className="py-2.5 text-right text-white/70 tabular-nums">{v.valorAlvo > 0 ? fmtMeta(v.tipo, v.valorAlvo) : <span className="text-white/25">sem meta</span>}</td>
                    <td className="py-2.5 text-right text-white tabular-nums">{fmtMeta(v.tipo, v.realizado)}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {v.valorAlvo > 0 ? (
                        <span style={{ color: v.pct >= 100 ? "#10B981" : v.pct >= 60 ? "#c8ff00" : "#F59E0B" }}>{v.pct}%</span>
                      ) : <span className="text-white/25">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Requer atenção (recolhível) — não na visão de leitor */}
      {!readerView && (
        <AlertasUrgentes
          negociosNovosAntigos={data.alertas.negociosNovosAntigos}
          negociosPropSemResposta={data.alertas.negociosPropSemResposta}
          contratosVencendo={data.alertas.contratosVencendo}
          total={totalAlertas}
        />
      )}

      {/* Tarefas + Últimas atividades (2 colunas) — não na visão de leitor */}
      {!readerView && (
        <div className="grid gap-4 lg:grid-cols-2" style={{ animation: "fadeUp 0.3s ease-out 0.35s both" }}>
          <MeuDiaClient tarefasIniciais={data.tarefasDoDia} agenda={data.agenda.map((a) => ({ ...a, data: new Date(a.data).toISOString() }))} />

          <div className="space-y-4">
          {(role === "closer" || role === "vendedor") && listaEsfriando}
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
      )}
    </div>
  );
}
