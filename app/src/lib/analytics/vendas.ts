/**
 * Cálculos reais do módulo Vendas → Visão Geral (Figma node 206:4, 17/08).
 * Mesma disciplina de Data Governance do Command Center da Home: cada
 * função documenta a fonte exata; métrica sem fonte confiável não entra
 * aqui — fica pendência registrada no relatório da implementação.
 */
import { db } from "@/lib/db";
import { negocios, propostas, reunioes } from "@/lib/db/schema";
import { eq, and, gte, lt, sql, inArray, isNull } from "drizzle-orm";
import { PIPELINE_ATIVO_STATUSES } from "@/lib/relatorios/comercial";

// `= ANY(${array})` do postgres-js interpola como tupla `($1,$2,...)`, não
// como array real — Postgres rejeita ("op ANY/ALL (array) requires array on
// right side"). `IN (...)` via `sql.join` funciona com o mesmo formato de
// tupla, então é o jeito seguro de fazer isso em SQL raw aqui.
const statusAtivosIn = sql.join(PIPELINE_ATIVO_STATUSES.map((s) => sql`${s}`), sql`, `);

export interface MovimentoPipelineStep { total: number; valor: number }
export interface MovimentoPipeline {
  entraram: MovimentoPipelineStep;
  avancaram: MovimentoPipelineStep;
  paradas: MovimentoPipelineStep;
  ganhas: MovimentoPipelineStep;
  perdidas: MovimentoPipelineStep;
}

/**
 * "Movimento do Pipeline" no período — 5 estágios reais (Figma
 * "flow-card"). ENTRARAM = negócios criados no período. AVANÇARAM =
 * negócios cuja etapa mudou pra uma etapa ativa (`status_changes.para_status`
 * em `PIPELINE_ATIVO_STATUSES`) dentro do período — DISTINCT por negócio,
 * pra não contar 2x se ele mudou de etapa mais de uma vez. PERDIDAS = mesmo
 * padrão confiável já usado em `getPerdidosPorResponsavel`
 * (`status_changes.para_status = 'perdido'`, NUNCA `negocios.updatedAt` —
 * achado da investigação de 17/08: updatedAt não garante que a mudança pra
 * perdido aconteceu dentro da janela, risco real de falso positivo).
 * PARADAS reusa o mesmo threshold de 5 dias de `getNegociosTravadosResumo`
 * (Command Center da Home) — é o mesmo conceito, não uma regra nova.
 */
export async function getMovimentoPipeline(orgId: string, since: Date, until: Date): Promise<MovimentoPipeline> {
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();
  const corteParadas = new Date(Date.now() - 5 * 86_400_000);

  const [entraramRows, avancaramRows, perdidasRows, ganhoRows, paradasRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${negocios.valorTotal}), 0)` })
      .from(negocios)
      .where(and(eq(negocios.organizacaoId, orgId), gte(negocios.createdAt, since), lt(negocios.createdAt, until))),
    db.execute(sql`
      SELECT count(*) AS total, COALESCE(sum(valor_total), 0) AS valor
      FROM (
        SELECT DISTINCT n.id, n.valor_total
        FROM status_changes sc
        JOIN negocios n ON n.id = sc.negocio_id
        WHERE n.organizacao_id = ${orgId}
          AND sc.para_status IN (${statusAtivosIn})
          AND sc.created_at >= ${sinceIso} AND sc.created_at < ${untilIso}
      ) t
    `),
    db.execute(sql`
      SELECT count(*) AS total, COALESCE(sum(valor_total), 0) AS valor
      FROM (
        SELECT DISTINCT n.id, n.valor_total
        FROM status_changes sc
        JOIN negocios n ON n.id = sc.negocio_id
        WHERE n.organizacao_id = ${orgId}
          AND sc.para_status = 'perdido'
          AND sc.created_at >= ${sinceIso} AND sc.created_at < ${untilIso}
      ) t
    `),
    db.select({ total: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${negocios.valorTotal}), 0)` })
      .from(negocios)
      .where(and(eq(negocios.organizacaoId, orgId), eq(negocios.status, "ganho"), gte(negocios.ganhoAt, since), lt(negocios.ganhoAt, until))),
    db.select({ total: sql<number>`count(*)`, valor: sql<string>`coalesce(sum(${negocios.valorTotal}), 0)` })
      .from(negocios)
      .where(and(eq(negocios.organizacaoId, orgId), inArray(negocios.status, PIPELINE_ATIVO_STATUSES), lt(negocios.updatedAt, corteParadas))),
  ]);

  const linha = (r: { total: unknown; valor: unknown }): MovimentoPipelineStep => ({ total: Number(r.total) || 0, valor: Number(r.valor) || 0 });
  const avanRow = (avancaramRows as unknown as Record<string, unknown>[])[0] ?? { total: 0, valor: 0 };
  const perdRow = (perdidasRows as unknown as Record<string, unknown>[])[0] ?? { total: 0, valor: 0 };

  return {
    entraram: linha(entraramRows[0]),
    avancaram: linha(avanRow as { total: unknown; valor: unknown }),
    paradas: linha(paradasRows[0]),
    ganhas: linha(ganhoRows[0]),
    perdidas: linha(perdRow as { total: unknown; valor: unknown }),
  };
}

/**
 * Propostas enviadas sem resposta do cliente — `status = 'enviada' AND
 * cliente_respondeu_em IS NULL` (o schema documenta explicitamente que
 * `clienteRespondeuEm` é o sinal real de reação do cliente, distinto de
 * `status='aceita'`). Contagem simples, sem valor — o Figma só pede count.
 */
export async function getPropostasPendentesCount(orgId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(propostas)
    .where(and(eq(propostas.organizacaoId, orgId), eq(propostas.status, "enviada"), isNull(propostas.clienteRespondeuEm)));
  return Number(rows[0]?.total || 0);
}

/**
 * Negócios abertos sem nenhuma reunião futura com status "agendada" —
 * conceito real e DISTINTO de "parado" (updatedAt): aqui é especificamente
 * ausência de próximo passo marcado no calendário, não falta de update no
 * registro. `reunioes.data`/`status` são as colunas reais.
 */
export async function getNegociosSemAgendamentoCount(orgId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT count(*) AS total
    FROM negocios n
    WHERE n.organizacao_id = ${orgId}
      AND n.status IN (${statusAtivosIn})
      AND NOT EXISTS (
        SELECT 1 FROM reunioes r
        WHERE r.negocio_id = n.id AND r.status = 'agendada' AND r.data > now()
      )
  `);
  return Number((rows as unknown as Record<string, unknown>[])[0]?.total || 0);
}

/**
 * Negócios abertos com `previsaoFechamento` (coluna real, `negocios.
 * previsao_fechamento`) já vencida — "previsão expirada" no sentido literal
 * da coluna, não um cálculo probabilístico novo.
 */
export async function getPrevisoesExpiradasCount(orgId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT count(*) AS total
    FROM negocios n
    WHERE n.organizacao_id = ${orgId}
      AND n.status IN (${statusAtivosIn})
      AND n.previsao_fechamento IS NOT NULL
      AND n.previsao_fechamento < CURRENT_DATE
  `);
  return Number((rows as unknown as Record<string, unknown>[])[0]?.total || 0);
}
