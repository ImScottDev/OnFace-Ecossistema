/**
 * Observabilidade do agente: execuções detalhadas e indicadores calculados SÓ de fatos persistidos
 * (runs, passos, mensagens, reuniões, atribuições). Nenhum número vem de opinião do modelo.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentRunSteps, aiAgentRuns, aiAgents, aiAlerts, aiCases, aiAgentCompromissos, contatos, leads, whatsappMensagens } from "@/lib/db/schema";

type Row = Record<string, unknown>;
const q = async <R = Row>(s: ReturnType<typeof sql>) => (await db.execute<R & Row>(s)) as unknown as R[];

export interface FiltroExecucoes { agentId?: string; status?: string; modo?: string; contatoId?: string; leadId?: string; limite?: number; antesDe?: string }

export async function listarExecucoes(organizacaoId: string, f: FiltroExecucoes = {}) {
  const conds = [eq(aiAgentRuns.organizacaoId, organizacaoId)];
  if (f.agentId) conds.push(eq(aiAgentRuns.agentId, f.agentId));
  if (f.status) conds.push(eq(aiAgentRuns.status, f.status));
  if (f.modo) conds.push(eq(aiAgentRuns.modo, f.modo));
  if (f.contatoId) conds.push(eq(aiAgentRuns.contatoId, f.contatoId));
  if (f.leadId) conds.push(eq(aiAgentRuns.leadId, f.leadId));
  if (f.antesDe) conds.push(sql`${aiAgentRuns.startedAt} < ${f.antesDe}::timestamptz`);
  const linhas = await db.select({
    id: aiAgentRuns.id, agenteId: aiAgentRuns.agentId, agente: aiAgents.nome, versionId: aiAgentRuns.versionId, status: aiAgentRuns.status, modo: aiAgentRuns.modo,
    contatoId: aiAgentRuns.contatoId, leadId: aiAgentRuns.leadId, contato: contatos.nome, lead: leads.nome, evento: sql<string | null>`${aiAgentRuns.input}->>'eventType'`,
    origem: sql<string | null>`${aiAgentRuns.input}->'payload'->>'origem'`, tokens: aiAgentRuns.tokens, custo: aiAgentRuns.custo, erro: aiAgentRuns.erro,
    abortReason: aiAgentRuns.abortReason, handoff: aiAgentRuns.handoffMotivo, inicio: aiAgentRuns.startedAt, fim: aiAgentRuns.completedAt,
    passos: aiAgentRuns.stepsCount,
    versao: sql<number | null>`(SELECT versao FROM ai_agent_versions v WHERE v.id = ${aiAgentRuns.versionId})`,
    ferramentas: sql<string[]>`coalesce((SELECT array_agg(DISTINCT s.name) FROM ai_agent_run_steps s WHERE s.run_id = ${aiAgentRuns.id} AND s.kind = 'tool_call'), '{}')`,
    mensagensEnviadas: sql<number>`(SELECT count(*)::int FROM ai_agent_run_steps s WHERE s.run_id = ${aiAgentRuns.id} AND s.kind = 'egress')`,
  }).from(aiAgentRuns).innerJoin(aiAgents, eq(aiAgents.id, aiAgentRuns.agentId))
    .leftJoin(contatos, eq(contatos.id, aiAgentRuns.contatoId)).leftJoin(leads, eq(leads.id, aiAgentRuns.leadId))
    .where(and(...conds)).orderBy(desc(aiAgentRuns.startedAt)).limit(Math.min(200, f.limite ?? 50));
  return linhas.map((l) => ({
    ...l, inicio: l.inicio.toISOString(), fim: l.fim?.toISOString() ?? null,
    duracaoMs: l.fim ? l.fim.getTime() - l.inicio.getTime() : null,
    bloqueio: l.abortReason ?? null,
  }));
}

export async function detalheExecucao(organizacaoId: string, runId: string) {
  const [run] = await db.select({ run: aiAgentRuns, agente: aiAgents.nome }).from(aiAgentRuns).innerJoin(aiAgents, eq(aiAgents.id, aiAgentRuns.agentId))
    .where(and(eq(aiAgentRuns.id, runId), eq(aiAgentRuns.organizacaoId, organizacaoId))).limit(1);
  if (!run) return null;
  const passos = await db.select().from(aiAgentRunSteps).where(and(eq(aiAgentRunSteps.runId, runId), eq(aiAgentRunSteps.organizacaoId, organizacaoId))).orderBy(aiAgentRunSteps.sequence);
  const contexto = passos.find((p) => p.kind === "context");
  const [versao] = await q<{ versao: number }>(sql`SELECT versao FROM ai_agent_versions WHERE id = ${run.run.versionId}::uuid`);
  const [alertas, casos, compromissos, mensagens] = await Promise.all([
    db.select().from(aiAlerts).where(and(eq(aiAlerts.organizacaoId, organizacaoId), eq(aiAlerts.refKind, "run"), eq(aiAlerts.refId, runId))),
    db.select().from(aiCases).where(and(eq(aiCases.organizacaoId, organizacaoId), eq(aiCases.runId, runId))),
    db.select().from(aiAgentCompromissos).where(and(eq(aiAgentCompromissos.organizacaoId, organizacaoId), sql`(${aiAgentCompromissos.origemRunId} = ${runId}::uuid OR ${aiAgentCompromissos.runId} = ${runId}::uuid)`)),
    db.select({ id: whatsappMensagens.id, conteudo: whatsappMensagens.conteudo, status: whatsappMensagens.status, createdAt: whatsappMensagens.createdAt }).from(whatsappMensagens).where(sql`${whatsappMensagens.dados}->>'aiRunId' = ${runId}`),
  ]);
  const ferramentas = passos.filter((p) => p.kind === "tool_call").map((p) => {
    const out = (p.output ?? {}) as { ok?: boolean; error?: string; data?: { preview?: boolean; approvalRequired?: boolean } };
    return { sequencia: p.sequence, nome: p.name, status: p.status, entrada: p.input, resultado: p.output, erro: p.errorMessage ?? out.error ?? null, simulada: out.data?.preview === true, aguardaAprovacao: out.data?.approvalRequired === true, latenciaMs: p.latencyMs };
  });
  const trace = Array.isArray(run.run.trace) ? run.run.trace as Row[] : [];
  return {
    id: run.run.id, agente: run.agente, agenteId: run.run.agentId, versao: versao?.versao ?? null, status: run.run.status, modo: run.run.modo,
    evento: (run.run.input as { eventType?: string } | null)?.eventType ?? null, mensagemRecebida: (run.run.input as { message?: string } | null)?.message ?? null,
    contatoId: run.run.contatoId, leadId: run.run.leadId, tokensEntrada: run.run.tokensInput, tokensSaida: run.run.tokensOutput, custo: run.run.custo, erro: run.run.erro, bloqueio: run.run.abortReason,
    handoff: run.run.handoffMotivo, inicio: run.run.startedAt.toISOString(), fim: run.run.completedAt?.toISOString() ?? null,
    contexto: contexto ? { secoes: (contexto.output as Row | null)?.secoes ?? [], fontes: (contexto.output as Row | null)?.fontes ?? [], sinais: (contexto.output as Row | null)?.sinais ?? null, tokensAprox: (contexto.output as Row | null)?.tokensAprox ?? null } : null,
    permissoes: trace.find((t) => t.type === "permissoes") ?? null, autonomia: trace.find((t) => t.type === "autonomy") ?? null,
    ferramentas, passos: passos.map((p) => ({ sequencia: p.sequence, tipo: p.kind, nome: p.name, status: p.status, erro: p.errorMessage, latenciaMs: p.latencyMs, tokens: p.tokensInput + p.tokensOutput })),
    alertas, casos, compromissos, mensagens,
  };
}

export interface Indicadores {
  periodoDias: number;
  leadsTrabalhados: number;
  execucoes: number;
  falhas: number;
  tempoMedianoPrimeiraRespostaSeg: number | null;
  qualificacoesConcluidas: number;
  reunioesConfirmadas: number;
  handoffs: number;
  conversasSemProximaAcao: number;
  retomadasPendentes: number;
  retomadasBloqueadas: number;
  custoTotal: number;
  custoPorExecucao: number | null;
  custoPorResultado: number | null;
  atribuicoesPorEstado: Record<string, number>;
}

export async function indicadores(organizacaoId: string, o: { agentId?: string; dias?: number } = {}): Promise<Indicadores> {
  const dias = Math.min(180, Math.max(1, o.dias ?? 30));
  const agent = o.agentId ?? null;
  const filtroRun = agent ? sql`AND r.agent_id = ${agent}::uuid` : sql``;
  const [base] = await q<{ leads: number; execucoes: number; falhas: number; handoffs: number; custo: string | null }>(sql`
    SELECT count(DISTINCT coalesce(r.lead_id, r.contato_id))::int AS leads, count(*)::int AS execucoes,
           count(*) FILTER (WHERE r.status IN ('failed','aborted'))::int AS falhas,
           count(*) FILTER (WHERE r.status = 'handed_off' OR r.handoff_motivo IS NOT NULL)::int AS handoffs, sum(r.custo) AS custo
      FROM ai_agent_runs r
     WHERE r.organizacao_id = ${organizacaoId}::uuid AND r.modo = 'live' AND r.started_at > now() - ${dias}::int * interval '1 day' ${filtroRun}`);
  const [pr] = await q<{ mediana: number | null }>(sql`
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (o.created_at - i.created_at))) AS mediana
      FROM ai_agent_runs r
      JOIN whatsapp_mensagens i ON i.id = r.source_message_id AND i.direcao = 'in'
      JOIN whatsapp_mensagens o ON o.dados->>'aiRunId' = r.id::text AND o.direcao = 'out'
     WHERE r.organizacao_id = ${organizacaoId}::uuid AND r.modo = 'live' AND r.started_at > now() - ${dias}::int * interval '1 day' ${filtroRun}`);
  const [res] = await q<{ qualif: number; reunioes: number }>(sql`
    SELECT count(*) FILTER (WHERE s.name = 'lead_qualify')::int AS qualif,
           count(*) FILTER (WHERE s.name = 'meeting_schedule' AND coalesce(s.output->'data'->>'jaExistia','false') = 'false')::int AS reunioes
      FROM ai_agent_run_steps s JOIN ai_agent_runs r ON r.id = s.run_id
     WHERE r.organizacao_id = ${organizacaoId}::uuid AND r.modo = 'live' AND s.kind = 'tool_call' AND s.status = 'completed'
       AND coalesce(s.output->>'ok','false') = 'true' AND coalesce(s.output->'data'->>'preview','false') <> 'true'
       AND r.started_at > now() - ${dias}::int * interval '1 day' ${filtroRun}`);
  const filtroAt = agent ? sql`AND a.agent_id = ${agent}::uuid` : sql``;
  const estados = await q<{ status: string; n: number }>(sql`SELECT a.status, count(*)::int AS n FROM ai_agent_atribuicoes a WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.status <> 'encerrada' ${filtroAt} GROUP BY a.status`);
  const [sem] = await q<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM ai_agent_atribuicoes a
     WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.status = 'ativa' ${filtroAt}
       AND coalesce(a.ultima_execucao_em, a.created_at) < now() - interval '24 hours'
       AND NOT EXISTS (SELECT 1 FROM ai_agent_compromissos c WHERE c.atribuicao_id = a.id AND c.status IN ('pendente','processando'))`);
  const filtroCo = agent ? sql`AND c.agent_id = ${agent}::uuid` : sql``;
  const comp = await q<{ status: string; n: number }>(sql`SELECT c.status, count(*)::int AS n FROM ai_agent_compromissos c WHERE c.organizacao_id = ${organizacaoId}::uuid AND c.status IN ('pendente','bloqueado') ${filtroCo} GROUP BY c.status`);
  const custo = Number(base?.custo ?? 0);
  const resultados = (res?.reunioes ?? 0) + (res?.qualif ?? 0);
  return {
    periodoDias: dias, leadsTrabalhados: base?.leads ?? 0, execucoes: base?.execucoes ?? 0, falhas: base?.falhas ?? 0,
    tempoMedianoPrimeiraRespostaSeg: pr?.mediana == null ? null : Math.round(Number(pr.mediana)),
    qualificacoesConcluidas: res?.qualif ?? 0, reunioesConfirmadas: res?.reunioes ?? 0, handoffs: base?.handoffs ?? 0,
    conversasSemProximaAcao: sem?.n ?? 0,
    retomadasPendentes: comp.find((c) => c.status === "pendente")?.n ?? 0, retomadasBloqueadas: comp.find((c) => c.status === "bloqueado")?.n ?? 0,
    custoTotal: custo, custoPorExecucao: base?.execucoes ? custo / base.execucoes : null, custoPorResultado: resultados ? custo / resultados : null,
    atribuicoesPorEstado: Object.fromEntries(estados.map((e) => [e.status, e.n])),
  };
}

