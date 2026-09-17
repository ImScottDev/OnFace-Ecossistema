/**
 * Cálculos reais do módulo Vendas → Pré-vendas (Figma node 211:4, 17/08).
 * CORREÇÃO 01/09 — antes as métricas liam `crm2_pre_vendas_stage`, que é um
 * SNAPSHOT do backfill de 17/08 e NUNCA é reescrito quando o lead se move no
 * board. Dois efeitos reais: (1) a coluna está NULL em 2.368 dos 3.651 leads
 * do banco de dev, (2) qualquer qualificação feita depois de 17/08 era
 * invisível aqui. O board (`qualificacao/shared.ts`) já derivava a etapa ao
 * vivo e documentava explicitamente "nunca usar a coluna pra isso" — este
 * arquivo era o último lugar que ainda lia o snapshot, então KPI e board
 * divergiam na mesma organização.
 *
 * Agora as duas fontes são a MESMA: `sdr_status` + existência de oportunidade,
 * exatamente o critério de `sdrBoardColumn`. Mesma disciplina das outras telas
 * do CRM2: métrica sem fonte confiável não entra aqui, fica pendência
 * documentada no relatório.
 */
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq, and, gte, lt, sql, isNull, isNotNull } from "drizzle-orm";

export interface PulsoPreVendas {
  leadsNoPeriodo: number;
  emQualificacao: number;
  qualificadosSQL: number;
  taxaQualificacao: number | null;
  tempoQualificacaoDias: number | null;
  primeiroContatoSlaMinutos: number | null;
  semContato: number;
}

/**
 * "Tempo de Qualificação" = dias entre a criação do lead e a criação do
 * PRIMEIRO negócio vinculado a ele (via negocio_leads) — é o evento real que
 * a conversão em oportunidade dispara (converter-oportunidade.ts), não uma
 * transição de sdr_status (essa nunca é logada em status_changes pra
 * 'qualified', achado da auditoria de 17/08). Só entra na média quem tem
 * negócio vinculado.
 */
export async function getPulsoPreVendas(orgId: string, inicio: Date, fim: Date): Promise<PulsoPreVendas> {
  const [leadsNoPeriodoRows, emQualificacaoRows, qualificadosRows, semContatoRows, tempoQualiRows, slaRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(leads)
      .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"), gte(leads.createdAt, inicio), lt(leads.createdAt, fim))),
    db.select({ total: sql<number>`count(*)` }).from(leads)
      .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"), eq(leads.sdrStatus, "qualifying"))),
    db.select({ total: sql<number>`count(*)` }).from(leads)
      .where(and(
        eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"),
        // Os DOIS caminhos de qualificação contam: marcado 'qualified' pela SDR
        // (SQL sem reunião, 01/09) ou já com oportunidade viva no closer.
        sql`(${leads.sdrStatus} = 'qualified' OR EXISTS (SELECT 1 FROM negocio_leads nl JOIN negocios n ON n.id = nl.negocio_id WHERE nl.lead_id = ${leads.id} AND n.status NOT IN ('perdido','churned')))`,
        gte(leads.createdAt, inicio), lt(leads.createdAt, fim))),
    db.select({ total: sql<number>`count(*)` }).from(leads)
      .where(and(
        eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"),
        sql`COALESCE(${leads.sdrStatus}, 'pending') = 'pending'`,
        isNull(leads.lastContactAt), gte(leads.createdAt, inicio), lt(leads.createdAt, fim))),
    db.execute(sql`
      SELECT avg(EXTRACT(epoch FROM (primeiro_negocio.created_at - l.created_at)) / 86400) AS media_dias
      FROM leads l
      JOIN LATERAL (
        SELECT n.created_at FROM negocio_leads nl JOIN negocios n ON n.id = nl.negocio_id
        WHERE nl.lead_id = l.id ORDER BY n.created_at ASC LIMIT 1
      ) primeiro_negocio ON true
      WHERE l.organizacao_id = ${orgId} AND l.tipo = 'lead' AND COALESCE(l.sdr_status, 'pending') = 'qualified'
        AND l.created_at >= ${inicio.toISOString()} AND l.created_at < ${fim.toISOString()}
    `),
    // outreachStartedAt existe no schema mas está 100% nulo nos dados reais
    // (0/1169 leads, confirmado em 17/08) — usamos lastContactAt, que tem
    // preenchimento real (292/1169), como sinal de "1º contato" de fato.
    db.select({ media: sql<string>`avg(EXTRACT(epoch FROM (${leads.lastContactAt} - ${leads.createdAt})) / 60)` }).from(leads)
      .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead"), isNotNull(leads.lastContactAt), gte(leads.createdAt, inicio), lt(leads.createdAt, fim))),
  ]);

  const leadsNoPeriodo = Number(leadsNoPeriodoRows[0]?.total || 0);
  const qualificadosSQL = Number(qualificadosRows[0]?.total || 0);
  const tempoQualiRaw = (tempoQualiRows as unknown as { media_dias: string | null }[])[0]?.media_dias;

  return {
    leadsNoPeriodo,
    emQualificacao: Number(emQualificacaoRows[0]?.total || 0),
    qualificadosSQL,
    taxaQualificacao: leadsNoPeriodo > 0 ? (qualificadosSQL / leadsNoPeriodo) * 100 : null,
    tempoQualificacaoDias: tempoQualiRaw ? Number(tempoQualiRaw) : null,
    primeiroContatoSlaMinutos: slaRows[0]?.media ? Number(slaRows[0].media) : null,
    semContato: Number(semContatoRows[0]?.total || 0),
  };
}

export interface DistribuicaoItem { key: string; label: string; total: number }

const ORIGEM_LABELS: Record<string, string> = {
  inbound: "Inbound", outbound: "Outbound", indicacao: "Indicação", parceiro: "Parceiro",
  google_ads: "Google Ads", meta_ads: "Meta Ads", organico: "Orgânico", linkedin: "LinkedIn",
  evento: "Evento", site_institucional: "Site Institucional", direto: "Direto",
};

export async function getDistribuicaoPorOrigem(orgId: string): Promise<DistribuicaoItem[]> {
  const rows = await db
    .select({ origem: leads.origem, total: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.organizacaoId, orgId), eq(leads.tipo, "lead")))
    .groupBy(leads.origem)
    .orderBy(sql`count(*) desc`);
  return rows.map((r) => {
    const key = r.origem || "nao_informado";
    return { key, label: ORIGEM_LABELS[key] || (r.origem ? r.origem : "Não informado"), total: Number(r.total) };
  });
}

export const CRM2_STAGE_LABELS: Record<string, string> = {
  novo: "Novo", em_contato: "Em contato", qualificacao: "Qualificação", qualificado: "Qualificado",
  desqualificado: "Desqualificado", sem_resposta: "Sem resposta", nutricao_retomar: "Nutrição/Retomar depois",
};

/**
 * Distribuição por etapa — derivada ao vivo (01/09), mesma ordem de decisão de
 * `sdrBoardColumn`: desqualificado > oportunidade viva > SQL > buckets de
 * estagnação > qualificação > em contato > novo. Antes agrupava pela coluna
 * snapshot, o que produzia um bucket "sem_stage" com 2.368 leads (65% da base)
 * que não significava nada operacionalmente.
 */
export async function getDistribuicaoPorStatus(orgId: string): Promise<DistribuicaoItem[]> {
  const rows = await db.execute(sql`
    SELECT etapa, count(*)::int AS total
    FROM (
      SELECT CASE
        WHEN COALESCE(l.sdr_status, 'pending') = 'disqualified' THEN 'desqualificado'
        WHEN EXISTS (SELECT 1 FROM negocio_leads nl JOIN negocios n ON n.id = nl.negocio_id
                     WHERE nl.lead_id = l.id AND n.status NOT IN ('perdido','churned')) THEN 'qualificado'
        WHEN COALESCE(l.sdr_status, 'pending') = 'qualified' THEN 'qualificado'
        WHEN COALESCE(l.sdr_status, 'pending') = 'sdr_sem_retorno' THEN 'sem_resposta'
        WHEN COALESCE(l.sdr_status, 'pending') IN ('sdr_sem_interesse','sdr_retomar_depois') THEN 'nutricao_retomar'
        WHEN COALESCE(l.sdr_status, 'pending') = 'qualifying' THEN 'qualificacao'
        WHEN COALESCE(l.sdr_status, 'pending') = 'contacted' THEN 'em_contato'
        ELSE 'novo'
      END AS etapa
      FROM leads l
      WHERE l.organizacao_id = ${orgId} AND l.tipo = 'lead'
    ) t
    GROUP BY etapa
    ORDER BY total DESC
  `);
  return (rows as unknown as { etapa: string; total: number }[]).map((r) => ({
    key: r.etapa,
    label: CRM2_STAGE_LABELS[r.etapa] || r.etapa,
    total: Number(r.total),
  }));
}

/** Fatos históricos preservados no De/Para (crm2_reuniao_realizada_em/crm2_cliente_convertido_em/crm2_no_show_em) — usado só pra badge informativa no card do lead, nunca pra recalcular a etapa atual. */
export async function getFatosHistoricosCount(orgId: string): Promise<{ reuniaoRealizada: number; clienteConvertido: number; noShow: number }> {
  const rows = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE crm2_reuniao_realizada_em IS NOT NULL) AS reuniao,
      count(*) FILTER (WHERE crm2_cliente_convertido_em IS NOT NULL) AS convertido,
      count(*) FILTER (WHERE crm2_no_show_em IS NOT NULL) AS no_show
    FROM leads WHERE organizacao_id = ${orgId} AND tipo = 'lead'
  `);
  const r = (rows as unknown as { reuniao: string; convertido: string; no_show: string }[])[0];
  return { reuniaoRealizada: Number(r?.reuniao || 0), clienteConvertido: Number(r?.convertido || 0), noShow: Number(r?.no_show || 0) };
}
