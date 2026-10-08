/**
 * Visões de gestão do funil que o Insights não tinha: tempo por etapa do
 * pipeline, conversão por origem e tarefas vencidas por pessoa. Somente leitura,
 * org-scoped, cada uma sobre a fonte que a tela de origem já usa.
 *
 * Quando o dado de origem não existe, a visão devolve n=0 e a tela diz "sem
 * dado"; nada é estimado.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { origemCanonica } from "@/lib/vendas/origem-canonica";

const num = (v: unknown): number => Number(v ?? 0) || 0;
const dec = (v: unknown): number => Math.round(num(v) * 10) / 10;

/** Etapa do funil a que cada status de `status_changes` pertence (de-para de 05/10). */
const ETAPA_DO_STATUS = sql`CASE sc.para_status
  WHEN 'entrada' THEN 'entrada' WHEN 'reuniao_agendada' THEN 'entrada'
  WHEN 'diagnostico' THEN 'diagnostico' WHEN 'reuniao_realizada' THEN 'diagnostico' WHEN 'trial' THEN 'diagnostico'
  WHEN 'proposta' THEN 'proposta' WHEN 'proposta_apresentada' THEN 'proposta'
  WHEN 'negociacao' THEN 'negociacao' WHEN 'negociacao_iniciada' THEN 'negociacao'
  WHEN 'ganho' THEN 'fim' WHEN 'perdido' THEN 'fim' WHEN 'outra_data' THEN 'fim'
  WHEN 'sem_retorno' THEN 'fim' WHEN 'trava_negociacao' THEN 'fim' WHEN 'trava_assinatura' THEN 'fim'
END`;

export interface TempoEtapa {
  etapa: string;
  /** Passagens que COMEÇARAM na janela e já terminaram (o negócio saiu da etapa). */
  encerradas: { n: number; medianaDias: number; mediaDias: number };
  /** Negócios que estão na etapa agora, com a idade da permanência. */
  abertas: { n: number; medianaDias: number; maisAntigaDias: number };
}

export async function getTempoPorEtapa(orgId: string, since: Date, until: Date): Promise<TempoEtapa[]> {
  const rows = await db.execute<Record<string, string | null>>(sql`
    WITH ev AS (
      SELECT sc.negocio_id, sc.created_at AS desde, ${ETAPA_DO_STATUS} AS etapa
        FROM status_changes sc JOIN negocios n ON n.id = sc.negocio_id
       WHERE n.organizacao_id = ${orgId}::uuid AND sc.negocio_id IS NOT NULL
    ),
    mapeado AS (SELECT * FROM ev WHERE etapa IS NOT NULL),
    seq AS (
      SELECT *, lag(etapa) OVER w AS anterior, lead(desde) OVER w AS ate
        FROM mapeado WINDOW w AS (PARTITION BY negocio_id ORDER BY desde)
    ),
    passagens AS (
      -- repete a mesma etapa em sequência = continua na etapa; só conta a entrada.
      SELECT negocio_id, etapa, desde,
             (SELECT min(m2.desde) FROM mapeado m2
               WHERE m2.negocio_id = seq.negocio_id AND m2.desde > seq.desde AND m2.etapa <> seq.etapa) AS ate
        FROM seq WHERE anterior IS DISTINCT FROM etapa AND etapa <> 'fim'
    )
    SELECT etapa,
      count(*) FILTER (WHERE ate IS NOT NULL AND desde >= ${since.toISOString()}::timestamptz AND desde < ${until.toISOString()}::timestamptz) AS enc_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ate - desde) / 86400.0)
        FILTER (WHERE ate IS NOT NULL AND desde >= ${since.toISOString()}::timestamptz AND desde < ${until.toISOString()}::timestamptz) AS enc_mediana,
      avg(EXTRACT(EPOCH FROM ate - desde) / 86400.0)
        FILTER (WHERE ate IS NOT NULL AND desde >= ${since.toISOString()}::timestamptz AND desde < ${until.toISOString()}::timestamptz) AS enc_media
    FROM passagens GROUP BY etapa`);
  // Negócios na etapa AGORA: `negocios.etapa/etapa_desde` (a fonte do Pipeline,
  // completa), não o histórico, que não existe para todo negócio.
  const abertas = await db.execute<Record<string, string | null>>(sql`
    SELECT etapa, count(*)::text AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM now() - etapa_desde) / 86400.0) AS mediana,
           max(EXTRACT(EPOCH FROM now() - etapa_desde) / 86400.0) AS antiga
      FROM negocios
     WHERE organizacao_id = ${orgId}::uuid AND etapa IN ('entrada','diagnostico','proposta','negociacao') AND etapa_desde IS NOT NULL
     GROUP BY etapa`);
  return ["entrada", "diagnostico", "proposta", "negociacao"].map((etapa) => {
    const r = rows.find((x) => x.etapa === etapa);
    const ab = abertas.find((x) => x.etapa === etapa);
    return {
      etapa,
      encerradas: { n: num(r?.enc_n), medianaDias: dec(r?.enc_mediana), mediaDias: dec(r?.enc_media) },
      abertas: { n: num(ab?.n), medianaDias: dec(ab?.mediana), maisAntigaDias: dec(ab?.antiga) },
    };
  });
}

export interface ConversaoOrigem {
  origem: string;
  leads: number;
  comOportunidade: number;
  ganhos: number;
  /** ganhos ÷ leads da coorte (leads criados na janela). */
  conversaoPct: number;
}

export async function getConversaoPorOrigem(orgId: string, since: Date, until: Date): Promise<ConversaoOrigem[]> {
  const rows = await db.execute<{ origem: string | null; leads: string; com_opp: string; ganhos: string }>(sql`
    SELECT l.origem, count(*)::text AS leads,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id))::text AS com_opp,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = l.id AND n.status = 'ganho'))::text AS ganhos
      FROM leads l
     WHERE l.organizacao_id = ${orgId}::uuid
       AND l.created_at >= ${since.toISOString()}::timestamptz AND l.created_at < ${until.toISOString()}::timestamptz
     GROUP BY l.origem`);
  const por = new Map<string, ConversaoOrigem>();
  for (const r of rows) {
    const o = origemCanonica(r.origem) ?? "Sem origem";
    const cur = por.get(o) ?? { origem: o, leads: 0, comOportunidade: 0, ganhos: 0, conversaoPct: 0 };
    cur.leads += num(r.leads); cur.comOportunidade += num(r.com_opp); cur.ganhos += num(r.ganhos);
    por.set(o, cur);
  }
  return [...por.values()]
    .map((c) => ({ ...c, conversaoPct: c.leads > 0 ? dec((c.ganhos / c.leads) * 100) : 0 }))
    .sort((a, b) => b.leads - a.leads);
}

export interface TarefasVencidasPessoa {
  usuarioId: string | null;
  nome: string;
  abertas: number;
  vencidas: number;
  maisAntigaDias: number;
}

/** Mesmo critério da tela de Atividades (onface-atividades.ts): aberta = status fora de concluída/declinada. */
export async function getTarefasVencidasPorPessoa(orgId: string): Promise<TarefasVencidasPessoa[]> {
  const rows = await db.execute<Record<string, string | null>>(sql`
    SELECT t.usuario_id::text AS usuario_id, COALESCE(u.nome, 'Sem responsável') AS nome,
           count(*)::text AS abertas,
           count(*) FILTER (WHERE COALESCE(t.vence_em::date, t.data_vencimento) < CURRENT_DATE)::text AS vencidas,
           max(CURRENT_DATE - COALESCE(t.vence_em::date, t.data_vencimento)) FILTER (WHERE COALESCE(t.vence_em::date, t.data_vencimento) < CURRENT_DATE)::text AS antiga
      FROM tarefas t LEFT JOIN usuarios u ON u.id = t.usuario_id
     WHERE t.organizacao_id = ${orgId}::uuid AND t.status NOT IN ('concluida','declinada')
     GROUP BY 1, 2
    HAVING count(*) FILTER (WHERE COALESCE(t.vence_em::date, t.data_vencimento) < CURRENT_DATE) > 0
     ORDER BY 4 DESC`);
  return rows.map((r) => ({
    usuarioId: r.usuario_id, nome: String(r.nome), abertas: num(r.abertas), vencidas: num(r.vencidas), maisAntigaDias: num(r.antiga),
  }));
}
