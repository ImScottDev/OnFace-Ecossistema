/**
 * Automações → visão geral: uma leitura, tudo com número do banco.
 *
 * Fontes (todas filtradas por organizacao_id):
 * - automacoes / automacao_execucoes ......... regras de 1 passo (automacao-engine)
 * - cadence_definitions / enrollments / events  cadências (motor de fluxo em grafo)
 * - event_outbox ............................. fatos que alimentam o motor
 * - ai_agents / ai_agent_runs / ai_sdr_logs .. agentes de IA
 * - outreach_campanhas ....................... campanhas (worker campanha-sweep envia)
 * - cadencia_execucoes ....................... toques da cadência SDR inbound, feitos por
 *                                              pessoas — mostrado à parte para não inflar
 *                                              "execução automática".
 *
 * O dia é contado em America/Sao_Paulo: o servidor roda em UTC e a barra de
 * "hoje" começaria às 21h da véspera.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0) || 0;

export const DIAS_SERIE = 30;

export interface DiaSerie {
  dia: string; // YYYY-MM-DD
  eventos: number;
  execucoes: number;
  erros: number;
}

export interface ExecucaoRecente {
  id: string;
  tipo: "automacao" | "cadencia";
  nome: string;
  status: string; // vocabulário unificado do /api/automacoes/execucoes
  entityType: string;
  entityId: string;
  quando: string;
}

export interface VisaoGeralAutomacoes {
  regras: { total: number; ativas: number };
  cadencias: { total: number; publicadas: number; inscricoesAtivas: number };
  agentes: { total: number; publicados: number; rascunhos: number; execucoes30d: number; sdrLogs30d: number };
  campanhas: { total: number; rascunhos: number; enviados: number };
  eventos: { total30d: number; pendentes: number; pendenteMaisAntigo: string | null; falhas: number; ultimoEm: string | null };
  execucoes: { total30d: number; erros30d: number };
  toquesSdr: { total30d: number; whatsapp30d: number; ligacao30d: number; ultimoEm: string | null };
  serie: DiaSerie[];
  recentes: ExecucaoRecente[];
}

export async function visaoGeralAutomacoes(organizacaoId: string): Promise<VisaoGeralAutomacoes> {
  const [contagens, serie, recentes] = await Promise.all([
    db.execute<Row>(sql`
      SELECT
        (SELECT count(*) FROM automacoes WHERE organizacao_id = ${organizacaoId}) AS regras,
        (SELECT count(*) FROM automacoes WHERE organizacao_id = ${organizacaoId} AND ativo) AS regras_ativas,
        (SELECT count(*) FROM cadence_definitions WHERE organizacao_id = ${organizacaoId}) AS cadencias,
        (SELECT count(*) FROM cadence_definitions WHERE organizacao_id = ${organizacaoId} AND ativo AND status = 'published') AS cadencias_publicadas,
        (SELECT count(*) FROM cadence_enrollments WHERE organizacao_id = ${organizacaoId} AND status IN ('active','waiting','pending')) AS inscricoes_ativas,
        (SELECT count(*) FROM ai_agents WHERE organizacao_id = ${organizacaoId} AND archived_at IS NULL) AS agentes,
        (SELECT count(*) FROM ai_agents WHERE organizacao_id = ${organizacaoId} AND archived_at IS NULL AND published_version_id IS NOT NULL) AS agentes_publicados,
        (SELECT count(*) FROM ai_agents WHERE organizacao_id = ${organizacaoId} AND archived_at IS NULL AND status = 'draft') AS agentes_rascunho,
        (SELECT count(*) FROM ai_agent_runs WHERE organizacao_id = ${organizacaoId} AND started_at >= now() - interval '30 days') AS agente_runs,
        (SELECT count(*) FROM ai_sdr_logs WHERE organizacao_id = ${organizacaoId} AND created_at >= now() - interval '30 days') AS sdr_logs,
        (SELECT count(*) FROM outreach_campanhas WHERE organizacao_id = ${organizacaoId}) AS campanhas,
        (SELECT count(*) FROM outreach_campanhas WHERE organizacao_id = ${organizacaoId} AND status = 'rascunho') AS campanhas_rascunho,
        (SELECT coalesce(sum(total_enviados), 0) FROM outreach_campanhas WHERE organizacao_id = ${organizacaoId}) AS campanhas_enviados,
        (SELECT count(*) FROM event_outbox WHERE organizacao_id = ${organizacaoId} AND created_at >= now() - interval '30 days') AS eventos_30d,
        (SELECT count(*) FROM event_outbox WHERE organizacao_id = ${organizacaoId} AND status IN ('pending','processing')) AS eventos_pendentes,
        (SELECT min(created_at) FROM event_outbox WHERE organizacao_id = ${organizacaoId} AND status IN ('pending','processing')) AS pendente_mais_antigo,
        (SELECT count(*) FROM event_outbox WHERE organizacao_id = ${organizacaoId} AND status = 'failed') AS eventos_falhas,
        (SELECT max(created_at) FROM event_outbox WHERE organizacao_id = ${organizacaoId}) AS evento_ultimo,
        (SELECT count(*) FROM cadencia_execucoes WHERE organizacao_id = ${organizacaoId} AND enviado_em >= now() - interval '30 days') AS toques_30d,
        (SELECT count(*) FROM cadencia_execucoes WHERE organizacao_id = ${organizacaoId} AND enviado_em >= now() - interval '30 days' AND canal = 'whatsapp') AS toques_whatsapp,
        (SELECT count(*) FROM cadencia_execucoes WHERE organizacao_id = ${organizacaoId} AND enviado_em >= now() - interval '30 days' AND canal = 'ligacao') AS toques_ligacao,
        (SELECT max(enviado_em) FROM cadencia_execucoes WHERE organizacao_id = ${organizacaoId}) AS toque_ultimo
    `),
    // Série diária: eventos do outbox + execuções das duas fontes do motor.
    // generate_series garante o dia zerado (barra vazia é informação, não buraco).
    db.execute<Row>(sql`
      WITH dias AS (
        SELECT d::date AS dia
          FROM generate_series(
            (now() AT TIME ZONE 'America/Sao_Paulo')::date - ${DIAS_SERIE - 1}::int,
            (now() AT TIME ZONE 'America/Sao_Paulo')::date,
            interval '1 day') d
      ),
      ev AS (
        SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia, count(*) AS n
          FROM event_outbox
         WHERE organizacao_id = ${organizacaoId} AND created_at >= now() - interval '31 days'
         GROUP BY 1
      ),
      ex AS (
        SELECT dia, count(*) AS n, count(*) FILTER (WHERE status = 'erro') AS erros FROM (
          SELECT (executed_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia, status
            FROM automacao_execucoes
           WHERE organizacao_id = ${organizacaoId} AND executed_at >= now() - interval '31 days'
          UNION ALL
          SELECT (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date, e.status
            FROM cadence_enrollment_events e
            JOIN cadence_enrollments ce ON ce.id = e.enrollment_id
           WHERE ce.organizacao_id = ${organizacaoId} AND e.created_at >= now() - interval '31 days'
             -- Só passo executado conta como execução. enrolled/pause/resume e
             -- resposta_recebida são ciclo de vida da inscrição: contá-los
             -- inflava o número com cliques de pausar e retomar.
             AND e.status IN ('executado','executando','erro','condicao_nao_atendida','retry_agendado')
        ) t GROUP BY 1
      )
      SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia, coalesce(ev.n, 0) AS eventos,
             coalesce(ex.n, 0) AS execucoes, coalesce(ex.erros, 0) AS erros
        FROM dias d LEFT JOIN ev ON ev.dia = d.dia LEFT JOIN ex ON ex.dia = d.dia
       ORDER BY d.dia
    `),
    db.execute<Row>(sql`
      (SELECT ae.id, 'automacao' AS tipo, a.nome, ae.status, ae.entity_type, ae.entity_id, ae.executed_at AS quando
         FROM automacao_execucoes ae JOIN automacoes a ON a.id = ae.automacao_id
        WHERE ae.organizacao_id = ${organizacaoId}
        ORDER BY ae.executed_at DESC LIMIT 8)
      UNION ALL
      (SELECT e.id, 'cadencia', cd.nome,
              CASE WHEN e.status = 'executado' THEN 'sucesso' ELSE e.status END,
              ce.entity_type, ce.entity_id, e.created_at
         FROM cadence_enrollment_events e
         JOIN cadence_enrollments ce ON ce.id = e.enrollment_id
         JOIN cadence_definitions cd ON cd.id = ce.cadence_definition_id
        WHERE ce.organizacao_id = ${organizacaoId}
        ORDER BY e.created_at DESC LIMIT 8)
      ORDER BY quando DESC LIMIT 8
    `),
  ]);

  const c = (contagens as unknown as Row[])[0] ?? {};
  const linhas = serie as unknown as Row[];
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

  return {
    regras: { total: n(c.regras), ativas: n(c.regras_ativas) },
    cadencias: { total: n(c.cadencias), publicadas: n(c.cadencias_publicadas), inscricoesAtivas: n(c.inscricoes_ativas) },
    agentes: {
      total: n(c.agentes), publicados: n(c.agentes_publicados), rascunhos: n(c.agentes_rascunho),
      execucoes30d: n(c.agente_runs), sdrLogs30d: n(c.sdr_logs),
    },
    campanhas: { total: n(c.campanhas), rascunhos: n(c.campanhas_rascunho), enviados: n(c.campanhas_enviados) },
    eventos: { total30d: n(c.eventos_30d), pendentes: n(c.eventos_pendentes), pendenteMaisAntigo: iso(c.pendente_mais_antigo), falhas: n(c.eventos_falhas), ultimoEm: iso(c.evento_ultimo) },
    execucoes: {
      total30d: linhas.reduce((s, r) => s + n(r.execucoes), 0),
      erros30d: linhas.reduce((s, r) => s + n(r.erros), 0),
    },
    toquesSdr: { total30d: n(c.toques_30d), whatsapp30d: n(c.toques_whatsapp), ligacao30d: n(c.toques_ligacao), ultimoEm: iso(c.toque_ultimo) },
    serie: linhas.map((r) => ({ dia: String(r.dia), eventos: n(r.eventos), execucoes: n(r.execucoes), erros: n(r.erros) })),
    recentes: (recentes as unknown as Row[]).map((r) => ({
      id: String(r.id), tipo: r.tipo as "automacao" | "cadencia", nome: String(r.nome), status: String(r.status),
      entityType: String(r.entity_type), entityId: String(r.entity_id), quando: new Date(r.quando as string).toISOString(),
    })),
  };
}

/** Eventos do barramento por tipo (30 dias) — o que de fato chega para o motor reagir. */
export interface EventoPorTipo { tipo: string; total: number; pendentes: number; falhas: number; ultimoEm: string }

export async function eventosPorTipo(organizacaoId: string): Promise<EventoPorTipo[]> {
  const rows = (await db.execute<Row>(sql`
    SELECT event_type, count(*) AS total,
           count(*) FILTER (WHERE status IN ('pending','processing')) AS pendentes,
           count(*) FILTER (WHERE status = 'failed') AS falhas,
           max(created_at) AS ultimo
      FROM event_outbox
     WHERE organizacao_id = ${organizacaoId} AND created_at >= now() - interval '30 days'
     GROUP BY 1 ORDER BY 2 DESC
  `)) as unknown as Row[];
  return rows.map((r) => ({
    tipo: String(r.event_type), total: n(r.total), pendentes: n(r.pendentes), falhas: n(r.falhas),
    ultimoEm: new Date(r.ultimo as string).toISOString(),
  }));
}
