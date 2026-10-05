/**
 * Visões complementares do relatório de Pré-vendas (SDR) — validadas contra dado
 * real de prod em 22/07 (ver docs/produto/relatorios-sdr.md na raiz do repo, fonte da verdade).
 *
 * Tudo aqui é SOMENTE LEITURA e org-scoped. Regras canônicas:
 * - "Qualificado" (coorte) = lead criado na janela, não desqualificado, com negócio
 *   — a MESMA definição de lib/relatorios/esteira-sdr.ts.
 * - Modo da qualificação: negocios.origem_qualificacao quando preenchido
 *   ('reuniao'|'direta'); pra dado anterior à captura (null), proxy validado =
 *   existe reunião vinculada ao primeiro negócio do lead.
 * - Quem qualificou = usuario_id do PRIMEIRO evento status_changes
 *   para_status='reuniao_agendada' do lead (null = Agente SDR/IA). Negócio criado
 *   fora do converter (sem evento) atribui ao responsável do negócio.
 * - SLA em duas bases (divergem muito, nunca somar): coorte do mês
 *   (lead criado na janela → qualificado quando for) e fluxo do período
 *   (qualificações OCORRIDAS na janela, qualquer coorte).
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const num = (v: unknown): number => Number(v ?? 0) || 0;
const flt = (v: unknown): number => Math.round((Number(v ?? 0) || 0) * 10) / 10;

/** Lead em contato/qualificando sem atividade há N dias = parado (decisão 22/07, ajustável). */
export const ESTAGNADO_DIAS = 7;

export interface QualificacaoResponsavel {
  usuarioId: string | null; // null = Agente SDR (IA)
  nome: string;
  papel: string; // sdr | closer | ia | outro
  viaReuniao: number;
  direta: number;
  total: number;
}

export interface SlaBase {
  n: number;
  mediaHoras: number;
  medianaHoras: number;
}

export interface OrigemGrupo {
  novos: number;
  trabalhados: number;
  qualificados: number;
  taxaQualificacao: number;
}

export interface BaseParadaEstagio {
  estagio: string;
  label: string;
  total: number;
  ate7d: number;
  de7a30d: number;
  mais30d: number;
}

export interface VisoesSdr {
  qualificadosDetalhe: { viaReuniao: number; direta: number };
  qualificacoesPorResponsavel: QualificacaoResponsavel[];
  sla: { coorte: SlaBase; fluxo: SlaBase };
  origem: { inbound: OrigemGrupo; outbound: OrigemGrupo };
  /** Coorte da janela: em contato/qualificando sem negócio, parados há ESTAGNADO_DIAS+. */
  paradosCoorte: number;
  baseParada: {
    total: number; // all-time: pending/contacted/qualifying/flag sem negócio (fora desqualificados)
    porEstagio: BaseParadaEstagio[];
    /** Leads criados ANTES da janela que tiveram movimento DENTRO dela (invisíveis na coorte). */
    antigosTrabalhadosPeriodo: number;
  };
}

// CTE compartilhado: qualificados da coorte + modo + quem + timestamps.
// COALESCE(evento, criação do negócio) cobre os negócios criados fora do converter.
const qualCte = (orgId: string, sinceIso: string, untilIso: string) => sql`
  qual AS (
    SELECT l.id AS lead_id, l.created_at AS lead_em
    FROM leads l
    WHERE l.organizacao_id = ${orgId}
      AND l.created_at >= ${sinceIso} AND l.created_at < ${untilIso}
      AND COALESCE(l.sdr_status, 'pending') <> 'disqualified'
      AND EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id)
  ),
  neg AS (
    SELECT DISTINCT ON (q.lead_id) q.lead_id, q.lead_em,
      n.id AS negocio_id, n.origem_qualificacao, n.responsavel_id, n.created_at AS negocio_em
    FROM qual q JOIN negocios n ON n.lead_id = q.lead_id
    ORDER BY q.lead_id, n.created_at ASC
  ),
  ev AS (
    SELECT DISTINCT ON (sc.lead_id) sc.lead_id, sc.usuario_id, sc.created_at AS qual_em
    FROM status_changes sc JOIN qual q ON q.lead_id = sc.lead_id
    WHERE sc.para_status = 'reuniao_agendada'
    ORDER BY sc.lead_id, sc.created_at ASC
  ),
  base AS (
    SELECT nq.lead_id, nq.lead_em,
      COALESCE(ev.qual_em, nq.negocio_em) AS qual_em,
      CASE
        WHEN nq.origem_qualificacao IN ('reuniao', 'direta') THEN nq.origem_qualificacao
        WHEN EXISTS (SELECT 1 FROM reunioes r WHERE r.negocio_id = nq.negocio_id) THEN 'reuniao'
        ELSE 'direta'
      END AS modo,
      (ev.lead_id IS NOT NULL AND ev.usuario_id IS NULL) AS foi_ia,
      COALESCE(ev.usuario_id, nq.responsavel_id) AS quem_id
    FROM neg nq LEFT JOIN ev ON ev.lead_id = nq.lead_id
  )
`;

export async function getVisoesSdr(orgId: string, since: Date, until: Date): Promise<VisoesSdr> {
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();

  // ── A: split reunião/direta + SLA da coorte ──
  const [aRows, respRows, fluxoRows, origemRows, paradosRows, antigosRows] = await Promise.all([
    db.execute(sql`
      WITH ${qualCte(orgId, sinceIso, untilIso)}
      SELECT
        count(*) FILTER (WHERE modo = 'reuniao') AS via_reuniao,
        count(*) FILTER (WHERE modo = 'direta') AS direta,
        count(*) AS n,
        avg(EXTRACT(EPOCH FROM qual_em - lead_em) / 3600.0) AS media_h,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM qual_em - lead_em) / 3600.0) AS mediana_h
      FROM base
    `),
    // ── B: qualificações por responsável (quem executou, não dono do lead) ──
    db.execute(sql`
      WITH ${qualCte(orgId, sinceIso, untilIso)}
      SELECT
        CASE WHEN foi_ia THEN NULL ELSE quem_id::text END AS usuario_id,
        CASE WHEN foi_ia THEN 'Agente SDR (IA)' ELSE COALESCE(u.nome, 'Sem responsável') END AS nome,
        CASE WHEN foi_ia THEN 'ia' ELSE COALESCE(u.role, 'outro') END AS papel,
        count(*) FILTER (WHERE modo = 'reuniao') AS via_reuniao,
        count(*) FILTER (WHERE modo = 'direta') AS direta,
        count(*) AS total
      FROM base
      LEFT JOIN usuarios u ON u.id = base.quem_id AND NOT base.foi_ia
      GROUP BY 1, 2, 3
      ORDER BY total DESC
    `),
    // ── C: SLA do fluxo — qualificações ocorridas NA janela, qualquer coorte ──
    db.execute(sql`
      WITH ev AS (
        SELECT sc.lead_id, min(sc.created_at) AS qual_em
        FROM status_changes sc
        JOIN leads l ON l.id = sc.lead_id
        WHERE l.organizacao_id = ${orgId} AND sc.para_status = 'reuniao_agendada'
        GROUP BY sc.lead_id
      )
      SELECT count(*) AS n,
        avg(EXTRACT(EPOCH FROM ev.qual_em - l.created_at) / 3600.0) AS media_h,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ev.qual_em - l.created_at) / 3600.0) AS mediana_h
      FROM ev JOIN leads l ON l.id = ev.lead_id
      WHERE ev.qual_em >= ${sinceIso} AND ev.qual_em < ${untilIso}
    `),
    // ── D: Inbound × Outbound (critério canônico: leads.origem='outbound') ──
    db.execute(sql`
      SELECT
        CASE WHEN lower(coalesce(trim(l.origem), '')) = 'outbound' THEN 'outbound' ELSE 'inbound' END AS grupo,
        count(*) AS novos,
        count(*) FILTER (
          WHERE COALESCE(l.sdr_status, 'pending') <> 'pending'
             OR EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id)
        ) AS trabalhados,
        count(*) FILTER (
          WHERE COALESCE(l.sdr_status, 'pending') <> 'disqualified'
            AND EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id)
        ) AS qualificados
      FROM leads l
      WHERE l.organizacao_id = ${orgId}
        AND l.created_at >= ${sinceIso} AND l.created_at < ${untilIso}
      GROUP BY 1
    `),
    // ── E: parados (coorte, overlay do card Estagnados) + base parada all-time ──
    db.execute(sql`
      SELECT
        COALESCE(l.sdr_status, 'pending') AS estagio,
        count(*) AS total,
        count(*) FILTER (WHERE GREATEST(COALESCE(l.last_contact_at, l.created_at), l.updated_at) >= now() - make_interval(days => ${ESTAGNADO_DIAS})) AS ate_7d,
        count(*) FILTER (WHERE GREATEST(COALESCE(l.last_contact_at, l.created_at), l.updated_at) < now() - make_interval(days => ${ESTAGNADO_DIAS})
          AND GREATEST(COALESCE(l.last_contact_at, l.created_at), l.updated_at) >= now() - interval '30 days') AS de_7_a_30d,
        count(*) FILTER (WHERE GREATEST(COALESCE(l.last_contact_at, l.created_at), l.updated_at) < now() - interval '30 days') AS mais_30d,
        count(*) FILTER (
          WHERE l.created_at >= ${sinceIso} AND l.created_at < ${untilIso}
            AND COALESCE(l.sdr_status, 'pending') IN ('contacted', 'qualifying')
            AND GREATEST(COALESCE(l.last_contact_at, l.created_at), l.updated_at) < now() - make_interval(days => ${ESTAGNADO_DIAS})
        ) AS parados_coorte
      FROM leads l
      WHERE l.organizacao_id = ${orgId}
        AND COALESCE(l.sdr_status, 'pending') IN ('pending', 'contacted', 'qualifying', 'sdr_sem_retorno', 'sdr_sem_interesse', 'sdr_retomar_depois')
        AND NOT EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id)
      GROUP BY 1
    `),
    // ── F: leads antigos (pré-janela) com movimento na janela — invisíveis na coorte ──
    db.execute(sql`
      SELECT count(DISTINCT sc.lead_id) AS antigos
      FROM status_changes sc
      JOIN leads l ON l.id = sc.lead_id
      WHERE l.organizacao_id = ${orgId}
        AND l.created_at < ${sinceIso}
        AND sc.created_at >= ${sinceIso} AND sc.created_at < ${untilIso}
    `),
  ]);

  type Row = Record<string, unknown>;
  const a = ((aRows as unknown as Row[])[0] ?? {}) as Row;
  const fluxo = ((fluxoRows as unknown as Row[])[0] ?? {}) as Row;

  const qualificacoesPorResponsavel: QualificacaoResponsavel[] = (respRows as unknown as Row[]).map((r) => ({
    usuarioId: r.usuario_id ? String(r.usuario_id) : null,
    nome: String(r.nome ?? "—"),
    papel: String(r.papel ?? "outro"),
    viaReuniao: num(r.via_reuniao),
    direta: num(r.direta),
    total: num(r.total),
  }));

  const grupoVazio = (): OrigemGrupo => ({ novos: 0, trabalhados: 0, qualificados: 0, taxaQualificacao: 0 });
  const origem = { inbound: grupoVazio(), outbound: grupoVazio() };
  for (const r of origemRows as unknown as Row[]) {
    const g = String(r.grupo) === "outbound" ? origem.outbound : origem.inbound;
    g.novos = num(r.novos);
    g.trabalhados = num(r.trabalhados);
    g.qualificados = num(r.qualificados);
    g.taxaQualificacao = g.trabalhados > 0 ? flt((g.qualificados / g.trabalhados) * 100) : 0;
  }

  const LABELS: Record<string, string> = {
    pending: "Novo (sem primeiro toque)",
    contacted: "Em contato",
    qualifying: "Qualificando",
    sdr_sem_retorno: "Sem retorno (flag)",
    sdr_sem_interesse: "Sem interesse no momento (flag)",
    sdr_retomar_depois: "Retomar em outra data (flag)",
  };
  const ORDEM = ["pending", "contacted", "qualifying", "sdr_sem_retorno", "sdr_sem_interesse", "sdr_retomar_depois"];
  let paradosCoorte = 0;
  let baseTotal = 0;
  const porEstagio: BaseParadaEstagio[] = [];
  const paradoMap = new Map((paradosRows as unknown as Row[]).map((r) => [String(r.estagio), r]));
  for (const key of ORDEM) {
    const r = paradoMap.get(key);
    if (!r) continue;
    paradosCoorte += num(r.parados_coorte);
    baseTotal += num(r.total);
    porEstagio.push({
      estagio: key,
      label: LABELS[key] ?? key,
      total: num(r.total),
      ate7d: num(r.ate_7d),
      de7a30d: num(r.de_7_a_30d),
      mais30d: num(r.mais_30d),
    });
  }

  return {
    qualificadosDetalhe: { viaReuniao: num(a.via_reuniao), direta: num(a.direta) },
    qualificacoesPorResponsavel,
    sla: {
      coorte: { n: num(a.n), mediaHoras: flt(a.media_h), medianaHoras: flt(a.mediana_h) },
      fluxo: { n: num(fluxo.n), mediaHoras: flt(fluxo.media_h), medianaHoras: flt(fluxo.mediana_h) },
    },
    origem,
    paradosCoorte,
    baseParada: {
      total: baseTotal,
      porEstagio,
      antigosTrabalhadosPeriodo: num(((antigosRows as unknown as Row[])[0] ?? {}).antigos),
    },
  };
}
