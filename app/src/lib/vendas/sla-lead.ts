/**
 * SLA do ciclo de vida do lead — A forma única de medir tempo.
 *
 * Marcos (todos com timestamp e autor gravados por `lib/vendas`):
 *   chegou        leads.created_at, ou pre_qualificado_em quando veio da Prospecção
 *                 (eventos LeadCreated / ProspectPreQualified): o prospect existia
 *                 antes de entrar em Pré-vendas e o relógio só começa na entrada
 *   1º contato    leads.primeiro_contato_at                (evento FirstContactMade)
 *   qualificado   leads.qualificado_em                     (evento LeadQualified)
 *   convertido    1ª OpportunityCreated / negócio do lead  (evento OpportunityCreated)
 *
 * Antes havia duas contas, ambas erradas: o board e o Radar mediam
 * `last_touch_at - first_touch_at`, que é "último toque menos chegada" e cresce
 * a cada mensagem. Todo relatório de tempo até contato/conversão passa por aqui.
 * Cada marco cai para o evento quando a coluna do lead está vazia.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { somenteDePreVendas } from "@onface/acquisition";

export interface MarcosSla {
  leadId: string;
  chegouEm: string;
  primeiroContatoEm: string | null;
  qualificadoEm: string | null;
  convertidoEm: string | null;
  horasAteContato: number | null;
  horasAteQualificar: number | null;
  horasAteConverter: number | null;
}

/** Fragmento SQL: uma linha por lead com os marcos. Alias `m`. */
export function marcosDoLeadSql(organizacaoId: string) {
  return sql`(
    SELECT l.id AS lead_id, COALESCE(l.pre_qualificado_em, l.created_at) AS chegou_em,
           COALESCE(l.primeiro_contato_at, (SELECT min(e.ocorrido_em) FROM vendas_eventos e
              WHERE e.lead_id = l.id AND e.tipo = 'FirstContactMade')) AS primeiro_contato_em,
           COALESCE(l.qualificado_em, (SELECT min(e.ocorrido_em) FROM vendas_eventos e
              WHERE e.lead_id = l.id AND e.tipo = 'LeadQualified')) AS qualificado_em,
           (SELECT min(t) FROM (
              SELECT e.ocorrido_em AS t FROM vendas_eventos e
               WHERE e.lead_id = l.id AND e.tipo IN ('OpportunityCreated', 'OpportunityCreatedFromProspecting')
              UNION ALL SELECT n.created_at FROM negocios n WHERE n.lead_id = l.id) x) AS convertido_em
      FROM leads l WHERE l.organizacao_id = ${organizacaoId}::uuid
  ) m`;
}

/** Horas entre dois marcos, nunca negativas (carga com data anterior à chegada). */
const horas = (de: string, ate: string) =>
  // GREATEST ignora NULL e devolveria 0 para marco inexistente: o CASE mantém o nulo.
  sql.raw(`CASE WHEN m.${ate} IS NULL THEN NULL ELSE GREATEST(EXTRACT(EPOCH FROM (m.${ate} - m.${de})) / 3600, 0) END`);

export interface ResumoSla {
  chegaram: number;
  contatados: number;
  qualificados: number;
  convertidos: number;
  /** Mediana, só de quem atingiu o marco (quem nunca foi contatado não puxa a conta). */
  horasAteContato: number | null;
  horasAteQualificar: number | null;
  horasAteConverter: number | null;
}

/**
 * Coorte por chegada (`desde` <= chegou < `ate`) do universo do board de
 * Pré-vendas. Sem janela = todo o universo.
 */
export async function resumoSlaPreVendas(organizacaoId: string, opts: {
  desde?: Date | string | null; ate?: Date | string | null; responsavelId?: string | null;
} = {}): Promise<ResumoSla> {
  const desde = opts.desde ? new Date(opts.desde).toISOString() : null;
  const ate = opts.ate ? new Date(opts.ate).toISOString() : null;
  const [r] = await db.execute<Record<string, number | null>>(sql`
    SELECT count(*)::int AS chegaram,
      count(m.primeiro_contato_em)::int AS contatados,
      count(m.qualificado_em)::int AS qualificados,
      count(m.convertido_em)::int AS convertidos,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${horas("chegou_em", "primeiro_contato_em")})
        FILTER (WHERE m.primeiro_contato_em IS NOT NULL)::float AS h_contato,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${horas("chegou_em", "qualificado_em")})
        FILTER (WHERE m.qualificado_em IS NOT NULL)::float AS h_qualificar,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ${horas("chegou_em", "convertido_em")})
        FILTER (WHERE m.convertido_em IS NOT NULL)::float AS h_converter
      FROM aquisicoes a
      LEFT JOIN leads lg ON lg.id = a.lead_legado_id
      JOIN ${marcosDoLeadSql(organizacaoId)} ON m.lead_id = a.lead_legado_id
     WHERE a.organizacao_id = ${organizacaoId}::uuid
       AND ${somenteDePreVendas(sql)}
       AND (${desde}::timestamptz IS NULL OR m.chegou_em >= ${desde}::timestamptz)
       AND (${ate}::timestamptz IS NULL OR m.chegou_em < ${ate}::timestamptz)
       AND (${opts.responsavelId ?? null}::uuid IS NULL OR a.responsavel_id = ${opts.responsavelId ?? null}::uuid)
  `);
  return {
    chegaram: r?.chegaram ?? 0, contatados: r?.contatados ?? 0,
    qualificados: r?.qualificados ?? 0, convertidos: r?.convertidos ?? 0,
    horasAteContato: r?.h_contato ?? null,
    horasAteQualificar: r?.h_qualificar ?? null,
    horasAteConverter: r?.h_converter ?? null,
  };
}

/** Marcos de UM lead (drawer, auditoria). */
export async function marcosDoLead(organizacaoId: string, leadId: string): Promise<MarcosSla | null> {
  const [m] = await db.execute<Record<string, string | number | null>>(sql`
    SELECT m.lead_id::text, m.chegou_em::text, m.primeiro_contato_em::text, m.qualificado_em::text, m.convertido_em::text,
           ${horas("chegou_em", "primeiro_contato_em")} AS h_contato,
           ${horas("chegou_em", "qualificado_em")} AS h_qualificar,
           ${horas("chegou_em", "convertido_em")} AS h_converter
      FROM ${marcosDoLeadSql(organizacaoId)} WHERE m.lead_id = ${leadId}::uuid`);
  if (!m) return null;
  return {
    leadId: String(m.lead_id), chegouEm: String(m.chegou_em),
    primeiroContatoEm: (m.primeiro_contato_em as string) ?? null,
    qualificadoEm: (m.qualificado_em as string) ?? null,
    convertidoEm: (m.convertido_em as string) ?? null,
    horasAteContato: m.h_contato == null ? null : Number(m.h_contato),
    horasAteQualificar: m.h_qualificar == null ? null : Number(m.h_qualificar),
    horasAteConverter: m.h_converter == null ? null : Number(m.h_converter),
  };
}
