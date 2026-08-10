import { Hono } from "hono";
import { db } from "@/lib/db";
import { negocios, tarefas, reunioes, contatos, propostas, leads, empresas } from "@/lib/db/schema";
import { eq, and, ne, lt, gte, sql, inArray, desc, asc } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { getPipelineAtual, getFechadoPeriodo } from "@/lib/relatorios/comercial";
import {
  PrioridadeItem, scoreNegocioParado, motivosNegocioParado, scoreTarefaAtrasada,
  scoreReuniaoProxima, scoreAguardandoResposta, scorePropostaSemFollowup, urgenciaPorScore, brl,
} from "@/lib/carol/priority-engine";

const app = new Hono();

/**
 * Carol — Sales Copilot operacional (V1 heurística, sem IA). Tudo aqui é
 * escopado ao próprio usuário (ctx.userId) — Carol é pessoal, não uma visão
 * de gestão. Ver lib/carol/priority-engine.ts pra regra de score.
 */

async function coletarCandidatos(userId: string, orgId: string): Promise<PrioridadeItem[]> {
  const agora = new Date();
  const itens: PrioridadeItem[] = [];

  // ─── Negócios parados ───
  const negociosAbertos = await db
    .select({ id: negocios.id, titulo: negocios.titulo, valorTotal: negocios.valorTotal, status: negocios.status, updatedAt: negocios.updatedAt, empresaId: negocios.empresaId })
    .from(negocios)
    .where(and(eq(negocios.organizacaoId, orgId), eq(negocios.responsavelId, userId), sql`${negocios.status} NOT IN ('ganho', 'perdido')`));

  const negocioIds = negociosAbertos.map((n) => n.id);
  const reunioesFuturas = negocioIds.length
    ? await db.select({ negocioId: reunioes.negocioId, data: reunioes.data }).from(reunioes)
        .where(and(inArray(reunioes.negocioId, negocioIds), eq(reunioes.status, "agendada"), gte(reunioes.data, agora)))
        .orderBy(asc(reunioes.data))
    : [];
  const proximaReuniaoPorNegocio = new Map<string, Date>();
  for (const r of reunioesFuturas) if (r.negocioId && !proximaReuniaoPorNegocio.has(r.negocioId)) proximaReuniaoPorNegocio.set(r.negocioId, new Date(r.data));

  const empresaIds = [...new Set(negociosAbertos.map((n) => n.empresaId).filter((v): v is string => !!v))];
  const empresasMap = new Map<string, string>();
  if (empresaIds.length) {
    const rows = await db.select({ id: empresas.id, nome: empresas.nome }).from(empresas).where(inArray(empresas.id, empresaIds));
    for (const e of rows) empresasMap.set(e.id, e.nome);
  }

  for (const n of negociosAbertos) {
    const diasSemAtividade = Math.floor((agora.getTime() - new Date(n.updatedAt).getTime()) / 86400000);
    if (diasSemAtividade < 2) continue; // só entra como "parado" com 2+ dias reais sem tocar
    const valor = parseFloat(n.valorTotal || "0") || 0;
    const proxima = proximaReuniaoPorNegocio.get(n.id) || null;
    const horasAteReuniao = proxima ? (proxima.getTime() - agora.getTime()) / 3600000 : null;
    const score = scoreNegocioParado(diasSemAtividade, valor, horasAteReuniao);
    itens.push({
      id: `negocio-${n.id}`,
      tipo: "negocio_parado",
      titulo: n.empresaId ? (empresasMap.get(n.empresaId) || n.titulo) : n.titulo,
      subtitulo: `${n.titulo} · ${brl(valor)}`,
      score,
      urgencia: urgenciaPorScore(score),
      motivos: motivosNegocioParado(diasSemAtividade, valor, horasAteReuniao, n.status),
      link: `/negocios/${n.id}`,
    });
  }

  // ─── Tarefas atrasadas ───
  const tarefasAtrasadas = await db
    .select({ id: tarefas.id, titulo: tarefas.titulo, venceEm: tarefas.venceEm, dataVencimento: tarefas.dataVencimento, negocioId: tarefas.negocioId })
    .from(tarefas)
    .where(and(eq(tarefas.organizacaoId, orgId), eq(tarefas.usuarioId, userId), eq(tarefas.concluida, false), lt(tarefas.venceEm, agora)));

  for (const t of tarefasAtrasadas) {
    const diasAtraso = Math.max(1, Math.floor((agora.getTime() - new Date(t.venceEm!).getTime()) / 86400000));
    const score = scoreTarefaAtrasada(diasAtraso);
    itens.push({
      id: `tarefa-${t.id}`,
      tipo: "tarefa_atrasada",
      titulo: t.titulo,
      subtitulo: `Atrasada há ${diasAtraso} dia${diasAtraso === 1 ? "" : "s"}`,
      score,
      urgencia: urgenciaPorScore(score),
      motivos: [`Vencimento: ${new Date(t.venceEm!).toLocaleDateString("pt-BR")}`, `${diasAtraso} dia${diasAtraso === 1 ? "" : "s"} de atraso`],
      link: t.negocioId ? `/negocios/${t.negocioId}` : "/tarefas",
    });
  }

  // ─── Reuniões próximas (hoje) ───
  const fimDoDia = new Date(agora); fimDoDia.setHours(23, 59, 59, 999);
  const reunioesHoje = await db
    .select({ id: reunioes.id, titulo: reunioes.titulo, data: reunioes.data, negocioId: reunioes.negocioId, leadId: reunioes.leadId })
    .from(reunioes)
    .where(and(eq(reunioes.organizacaoId, orgId), eq(reunioes.responsavelId, userId), eq(reunioes.status, "agendada"), gte(reunioes.data, agora), lt(reunioes.data, fimDoDia)));

  const negocioIdsReuniao = [...new Set(reunioesHoje.map((r) => r.negocioId).filter((v): v is string => !!v))];
  const valoresNegocio = new Map<string, number>();
  if (negocioIdsReuniao.length) {
    const rows = await db.select({ id: negocios.id, valorTotal: negocios.valorTotal }).from(negocios).where(inArray(negocios.id, negocioIdsReuniao));
    for (const r of rows) valoresNegocio.set(r.id, parseFloat(r.valorTotal || "0") || 0);
  }

  for (const r of reunioesHoje) {
    const horas = (new Date(r.data).getTime() - agora.getTime()) / 3600000;
    const valor = r.negocioId ? valoresNegocio.get(r.negocioId) ?? null : null;
    const score = scoreReuniaoProxima(horas, valor);
    itens.push({
      id: `reuniao-${r.id}`,
      tipo: "reuniao_proxima",
      titulo: r.titulo,
      subtitulo: `Hoje às ${new Date(r.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      score,
      urgencia: urgenciaPorScore(score),
      motivos: [`Em ${horas <= 1 ? "menos de 1h" : `${Math.round(horas)}h`}`, valor ? `Negócio de ${brl(valor)}` : "Sem negócio vinculado"],
      link: r.negocioId ? `/negocios/${r.negocioId}` : r.leadId ? `/leads/${r.leadId}` : "/calendario",
    });
  }

  // ─── Aguardando resposta (WhatsApp) ───
  const aguardando = await db
    .select({ id: contatos.id, nome: contatos.nome, ultimaMsgAt: contatos.ultimaMsgAt, ultimaMsg: contatos.ultimaMsg })
    .from(contatos)
    .where(and(eq(contatos.organizacaoId, orgId), eq(contatos.responsavelId, userId), eq(contatos.canal, "whatsapp"), sql`${contatos.naoLidas} > 0`));

  for (const c of aguardando) {
    if (!c.ultimaMsgAt) continue;
    const horas = (agora.getTime() - new Date(c.ultimaMsgAt).getTime()) / 3600000;
    if (horas < 1) continue; // menos de 1h ainda não é prioridade
    const score = scoreAguardandoResposta(horas);
    itens.push({
      id: `contato-${c.id}`,
      tipo: "aguardando_resposta",
      titulo: c.nome,
      subtitulo: c.ultimaMsg ? c.ultimaMsg.slice(0, 60) : "Aguardando retorno",
      score,
      urgencia: urgenciaPorScore(score),
      motivos: [`Sem resposta há ${horas < 24 ? `${Math.round(horas)}h` : `${Math.round(horas / 24)} dia(s)`}`],
      link: `/atendimento`,
    });
  }

  // ─── Propostas enviadas sem follow-up ───
  const propostasEnviadas = await db
    .select({ id: propostas.id, numero: propostas.numero, totalGeral: propostas.totalGeral, dataEmissao: propostas.dataEmissao, createdAt: propostas.createdAt, leadId: propostas.leadId })
    .from(propostas)
    .where(and(eq(propostas.organizacaoId, orgId), eq(propostas.criadoPorId, userId), eq(propostas.status, "enviada")));

  const leadIds = [...new Set(propostasEnviadas.map((p) => p.leadId).filter((v): v is string => !!v))];
  const leadsMap = new Map<string, string>();
  if (leadIds.length) {
    const rows = await db.select({ id: leads.id, nome: leads.nome }).from(leads).where(inArray(leads.id, leadIds));
    for (const l of rows) leadsMap.set(l.id, l.nome);
  }

  for (const p of propostasEnviadas) {
    const referencia = p.dataEmissao ? new Date(p.dataEmissao) : new Date(p.createdAt);
    const dias = Math.floor((agora.getTime() - referencia.getTime()) / 86400000);
    if (dias < 3) continue;
    const valor = parseFloat(p.totalGeral || "0") || 0;
    const score = scorePropostaSemFollowup(dias, valor);
    itens.push({
      id: `proposta-${p.id}`,
      tipo: "proposta_sem_followup",
      titulo: p.leadId ? (leadsMap.get(p.leadId) || `Proposta #${p.numero}`) : `Proposta #${p.numero}`,
      subtitulo: `Proposta enviada há ${dias} dias · ${brl(valor)}`,
      score,
      urgencia: urgenciaPorScore(score),
      motivos: [`Enviada há ${dias} dias`, `${brl(valor)} em jogo`, "Nenhum follow-up registrado"],
      link: `/propostas/${p.id}`,
    });
  }

  return itens.sort((a, b) => b.score - a.score);
}

app.get("/carol/prioridades", async (c) => {
  const ctx = await getCtx(c);
  const itens = await coletarCandidatos(ctx.userId, ctx.organizacaoId);
  return c.json({ itens: itens.slice(0, parseInt(c.req.query("limit") || "5")) });
});

app.get("/carol/em-risco", async (c) => {
  const ctx = await getCtx(c);
  const itens = await coletarCandidatos(ctx.userId, ctx.organizacaoId);
  return c.json({ itens: itens.filter((i) => (i.tipo === "negocio_parado" || i.tipo === "proposta_sem_followup") && i.urgencia !== "baixa") });
});

app.get("/carol/contatar-hoje", async (c) => {
  const ctx = await getCtx(c);
  const itens = await coletarCandidatos(ctx.userId, ctx.organizacaoId);
  return c.json({ itens: itens.filter((i) => i.tipo === "reuniao_proxima" || i.tipo === "aguardando_resposta") });
});

app.get("/carol/atrasados", async (c) => {
  const ctx = await getCtx(c);
  const itens = await coletarCandidatos(ctx.userId, ctx.organizacaoId);
  return c.json({ itens: itens.filter((i) => i.tipo === "tarefa_atrasada") });
});

app.get("/carol/negocios-atencao", async (c) => {
  const ctx = await getCtx(c);
  const itens = await coletarCandidatos(ctx.userId, ctx.organizacaoId);
  return c.json({ itens: itens.filter((i) => i.tipo === "negocio_parado" || i.tipo === "proposta_sem_followup").sort((a, b) => b.score - a.score) });
});

app.get("/carol/performance", async (c) => {
  const ctx = await getCtx(c);
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const [pipeline, fechadoMes, fechadoMesAnterior] = await Promise.all([
    getPipelineAtual(ctx.organizacaoId, ctx.userId),
    getFechadoPeriodo(ctx.organizacaoId, inicioMes, hoje, ctx.userId),
    getFechadoPeriodo(ctx.organizacaoId, inicioMesAnterior, inicioMes, ctx.userId),
  ]);
  return c.json({ pipeline, fechadoMes, fechadoMesAnterior });
});

app.get("/carol/semana", async (c) => {
  const ctx = await getCtx(c);
  const hoje = new Date();
  const inicioSemana = new Date(hoje.getTime() - 7 * 86400000);
  const fechado = await getFechadoPeriodo(ctx.organizacaoId, inicioSemana, hoje, ctx.userId);
  return c.json({ fechado, periodo: { inicio: inicioSemana.toISOString(), fim: hoje.toISOString() } });
});

app.get("/carol/briefing", async (c) => {
  const ctx = await getCtx(c);
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 86400000);
  const inicioOntem = new Date(ontem); inicioOntem.setHours(0, 0, 0, 0);
  const fimOntem = new Date(ontem); fimOntem.setHours(23, 59, 59, 999);

  const [itens, pipeline, fechadoOntem, reunioesHojeCount] = await Promise.all([
    coletarCandidatos(ctx.userId, ctx.organizacaoId),
    getPipelineAtual(ctx.organizacaoId, ctx.userId),
    getFechadoPeriodo(ctx.organizacaoId, inicioOntem, fimOntem, ctx.userId),
    db.select({ n: sql<number>`count(*)` }).from(reunioes).where(and(
      eq(reunioes.organizacaoId, ctx.organizacaoId), eq(reunioes.responsavelId, ctx.userId), eq(reunioes.status, "agendada"),
      gte(reunioes.data, new Date(new Date().setHours(0, 0, 0, 0))), lt(reunioes.data, new Date(new Date().setHours(23, 59, 59, 999))),
    )),
  ]);

  return c.json({
    prioridades: itens.slice(0, 5).length,
    reunioesHoje: Number(reunioesHojeCount[0]?.n ?? 0),
    negociosAtencao: itens.filter((i) => i.tipo === "negocio_parado" && i.urgencia !== "baixa").length,
    tarefasAtrasadas: itens.filter((i) => i.tipo === "tarefa_atrasada").length,
    pipelineAtivo: pipeline.total,
    fechadoOntem: fechadoOntem.receita,
  });
});

export const carolRoutes = app;
