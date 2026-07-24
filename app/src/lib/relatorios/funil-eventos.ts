/**
 * Fonte ÚNICA de métricas de EVENTO do funil, sobre `status_changes`.
 * (Auditoria 21/07 — AUDITORIA.md §1/§3: reuniões e no-show divergiam entre abas
 * porque cada uma lia de uma fonte: tabela `reunioes` (nunca atualizada após o
 * agendamento → "realizadas" sempre 0), snapshot de etapa do pipeline (não reage
 * ao período) e `status_changes` (a única correta). Tudo aqui é por evento,
 * distinct por lead, dentro da janela — cobertura completa desde o go-live.)
 *
 * Regras canônicas (PLANO-ACAO-RELATORIOS.md §1):
 * - Reunião agendada  = evento → 'reuniao_agendada'
 * - Reunião realizada = evento → 'reuniao_realizada'
 * - No-show           = evento → 'no_show'
 * - Perdido no período = evento → 'perdido' (negócio.created_at é coorte, não perda)
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { DEFAULT_STAGES } from "@/lib/crm/pipeline";

const num = (v: unknown): number => Number(v ?? 0) || 0;

export interface ContagemReunioes {
  agendadas: number;
  realizadas: number;
  noShow: number;
  compareceram: number; // dos AGENDADOS na janela, quantos avançaram depois (coorte)
  taxaComparecimento: number; // % compareceram/agendadas — nunca passa de 100%
}

/**
 * "Realizada" = lead que atingiu QUALQUER etapa após a entrada (reuniao_realizada,
 * trial, proposta, negociação, ganho) na janela — decisão Kauã 21/07: as closers
 * pulam a etapa "Reunião realizada" e jogam direto pra trial/proposta, então o
 * evento literal subcontava (34 vs 100 em julho). Ficam FORA: no_show (a call não
 * aconteceu), sem_retorno/outra_data (sem contato / reagendou) e perdido (se perdeu
 * após a call, o lead já contou ao avançar de etapa; se perdeu direto da entrada,
 * a call não rolou).
 */
const POS_CALL = ["reuniao_realizada", "trial", "proposta_apresentada", "negociacao_iniciada", "ganho"];
const POS_CALL_SQL = POS_CALL.map((s) => `'${s}'`).join(",");

/**
 * Reuniões por evento na janela. `agendadasPor` restringe o recorte a quem MOVEU
 * o card pra "Reunião agendada" (ex.: só as SDRs — base da meta delas). Nesse caso,
 * realizadas/no-show contam só leads agendados por essas pessoas (em qualquer data),
 * pra taxa de comparecimento comparar maçã com maçã.
 * Taxa de comparecimento é por COORTE: dos agendados NA janela, % que avançou de
 * etapa em qualquer momento depois — call de junho acontecendo em julho não estoura 100%.
 */
export async function contarReunioes(
  orgId: string,
  since: Date,
  until: Date,
  opts?: { agendadasPor?: string[] },
): Promise<ContagemReunioes> {
  const ids = opts?.agendadasPor;
  if (ids && ids.length === 0) return { agendadas: 0, realizadas: 0, noShow: 0, compareceram: 0, taxaComparecimento: 0 };

  const idList = ids ? sql.raw(`(${ids.map((i) => `'${i.replace(/'/g, "")}'`).join(",")})`) : null;
  const escopoAgendador = idList ? sql`AND sc.usuario_id IN ${idList}` : sql``;
  const escopoLead = idList
    ? sql`AND sc.lead_id IN (
        SELECT sc2.lead_id FROM status_changes sc2
        WHERE sc2.para_status = 'reuniao_agendada' AND sc2.usuario_id IN ${idList}
      )`
    : sql``;

  const rows = await db.execute(sql`
    SELECT
      count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status = 'reuniao_agendada' ${escopoAgendador}) AS agendadas,
      count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status IN (${sql.raw(POS_CALL_SQL)}) ${escopoLead}) AS realizadas,
      count(DISTINCT sc.lead_id) FILTER (WHERE sc.para_status = 'no_show' ${escopoLead}) AS no_show,
      count(DISTINCT sc.lead_id) FILTER (
        WHERE sc.para_status = 'reuniao_agendada' ${escopoAgendador}
          AND EXISTS (
            SELECT 1 FROM status_changes sc3
            WHERE sc3.lead_id = sc.lead_id
              AND sc3.para_status IN (${sql.raw(POS_CALL_SQL)})
              AND sc3.created_at >= sc.created_at
          )
      ) AS compareceram
    FROM status_changes sc
    JOIN leads l ON l.id = sc.lead_id
    WHERE l.organizacao_id = ${orgId}
      AND sc.created_at >= ${since.toISOString()} AND sc.created_at < ${until.toISOString()}
      AND sc.para_status IN ('reuniao_agendada','no_show',${sql.raw(POS_CALL_SQL)})
  `);
  const r = (rows as unknown as Record<string, unknown>[])[0] ?? {};
  const agendadas = num(r.agendadas);
  const compareceram = num(r.compareceram);
  return {
    agendadas,
    realizadas: num(r.realizadas),
    noShow: num(r.no_show),
    compareceram,
    taxaComparecimento: agendadas > 0 ? Math.round((compareceram / agendadas) * 1000) / 10 : 0,
  };
}

/** Negócios PERDIDOS por evento na janela, por responsável do negócio. */
export async function getPerdidosPorResponsavel(
  orgId: string,
  since: Date,
  until: Date,
): Promise<Map<string, number>> {
  const rows = await db.execute(sql`
    SELECT n.responsavel_id, count(DISTINCT n.id) AS perdidos
    FROM status_changes sc
    JOIN negocios n ON n.id = sc.negocio_id
    WHERE n.organizacao_id = ${orgId}
      AND sc.para_status = 'perdido'
      AND sc.created_at >= ${since.toISOString()} AND sc.created_at < ${until.toISOString()}
      AND n.responsavel_id IS NOT NULL
    GROUP BY n.responsavel_id
  `);
  const map = new Map<string, number>();
  for (const r of rows as unknown as Record<string, unknown>[]) {
    map.set(String(r.responsavel_id), num(r.perdidos));
  }
  return map;
}

export interface EtapaFunilEvento {
  stage: string;
  label: string;
  total: number; // leads distintos que ATINGIRAM a etapa (ou além) na janela
}

/**
 * Funil de vendas por EVENTO: quantos leads distintos atingiram cada etapa (ou uma
 * posterior) dentro da janela. Substitui o funil-snapshot do /marketing (AUDITORIA
 * item E6 — misturava "quem está na etapa agora" com "ganhos do período", e o % de
 * conversão entre etapas não significava nada). Monotônico por construção.
 */
export async function getFunilVendasEventos(
  orgId: string,
  since: Date,
  until: Date,
): Promise<EtapaFunilEvento[]> {
  const ordem = [...DEFAULT_STAGES.map((s) => s.key), "ganho"];
  const rows = await db.execute(sql`
    SELECT DISTINCT sc.lead_id, sc.para_status
    FROM status_changes sc
    JOIN leads l ON l.id = sc.lead_id
    WHERE l.organizacao_id = ${orgId}
      AND sc.created_at >= ${since.toISOString()} AND sc.created_at < ${until.toISOString()}
      AND sc.para_status IN ${sql.raw(`(${ordem.map((s) => `'${s}'`).join(",")})`)}
  `);

  const idx = new Map(ordem.map((s, i) => [s, i]));
  const maxPorLead = new Map<string, number>();
  for (const r of rows as unknown as { lead_id: string; para_status: string }[]) {
    const i = idx.get(r.para_status);
    if (i == null || !r.lead_id) continue;
    const cur = maxPorLead.get(r.lead_id);
    if (cur == null || i > cur) maxPorLead.set(r.lead_id, i);
  }

  const labelOf = (k: string) => (k === "ganho" ? "Ganho" : DEFAULT_STAGES.find((s) => s.key === k)?.label ?? k);
  return ordem.map((stage, i) => ({
    stage,
    label: labelOf(stage),
    total: [...maxPorLead.values()].filter((m) => m >= i).length,
  }));
}
