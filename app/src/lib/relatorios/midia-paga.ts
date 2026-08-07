/**
 * Fonte ÚNICA de métricas do relatório de Mídia Paga (aba "Mídia Paga" em /relatorios).
 * Conecta Marketing (Meta Ads) → Comercial (pipeline) numa jornada só: clique → lead →
 * qualificado → proposta → venda → receita.
 *
 * REGRA DE NEGÓCIO (decisão Scott, 15/07): "lead qualificado" = qualificado no board de
 * Pré-vendas → automaticamente cria negócio. Ou seja, qualificado e "reunião marcada" são
 * o MESMO evento (criação do negócio) — não são 2 contadores separados. Esta é a MESMA
 * definição de `getLeadsQualificados` em `comercial.ts`; os relatórios legados
 * (/marketing, /tracking) ainda usam variações (sdrStatus) — não foram migrados nesta
 * primeira entrega pra não arriscar regressão nos números que o time já usa. Ver
 * callface/relatorio-midia-paga-proposta.md seção 2.
 *
 * Abordagem de atribuição: COORTE por data de criação do LEAD (mesmo padrão de
 * `/relatorios/tracking`). Um lead criado no período conta pra campanha mesmo que a
 * qualificação/venda dele aconteça depois do fim do período — é o jeito correto de medir
 * "essa campanha gerou N leads, dos quais M converteram", em vez de picotar a jornada.
 *
 * SEM índice de qualidade (IQC removido a pedido do Scott, 15/07 — "top campanhas"/"top
 * criativos" ranqueiam por ROAS puro, sem nota composta e sem amostra mínima).
 *
 * Completude: tanto campanhas quanto criativos aparecem por DUAS pontas — tudo que tem
 * atividade na Meta (mesmo sem lead casado no CRM, pra não esconder gasto "perdido") E
 * tudo que tem lead casado no CRM (mesmo sem match na Meta, ex: utm_content preenchido
 * manualmente). Bug corrigido 15/07: criativos só mostravam o lado CRM, sumindo com
 * anúncios que geraram lead/clique real na Meta mas sem utm_content correspondente.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  metaConfigured,
  normCampanha,
  fetchMetaCampaignInsights,
  fetchMetaAdInsights,
  fetchMetaAdsetInsights,
} from "@/lib/integrations/meta-insights";

/**
 * Campanhas excluídas dos relatórios de mídia paga/comercial (decisão Kauã, 04/08):
 * captação de lançamento/evento — os leads dessa campanha NÃO entram no CRM neste
 * primeiro momento (vão pra um funil de evento externo; só quem demonstrar interesse
 * de verdade num 2º formulário entra como lead comercial de fato). Contar o
 * `leadsMeta`/gasto dela nos totais de Leads/CPL do comercial infla os números com
 * algo que não é lead de comercial. Remover o ID daqui quando a campanha passar a
 * alimentar o CRM de verdade (2ª etapa do funil).
 */
const CAMPANHAS_EXCLUIDAS_COMERCIAL = new Set<string>([
  "120252652947400170", // TRT | Leads | Masterclass
]);
// MetaCriativo (nível de anúncio) não traz campaignId, só campaignName — precisa do
// nome normalizado pra filtrar no mesmo padrão nesse nível.
const CAMPANHAS_EXCLUIDAS_COMERCIAL_NOMES = new Set<string>([
  normCampanha("TRT | Leads | Masterclass"),
]);

const num = (v: unknown): number => Number(v ?? 0) || 0;
const round2 = (v: number): number => Math.round(v * 100) / 100;

export interface MetricaDimensao {
  chave: string; // valor do utm_campaign ou utm_content (ou nome do anúncio/campanha na Meta, se só existir lá)
  // CRM (coorte de leads criados no período com essa chave)
  leads: number;
  qualificados: number; // = "reuniões marcadas" (mesmo evento, ver regra de negócio acima)
  propostas: number;
  vendas: number;
  receita: number;
  cicloMedioDias: number | null;
  ticketMedio: number | null;
  // Meta Ads (gasto real, casado por nome normalizado ou por id)
  gasto: number;
  impressoes: number;
  cliques: number;
  leadsMeta: number;
  ctr: number | null; // %
  cpc: number | null;
  cpm: number | null;
  cpl: number | null; // gasto / leadsMeta (nunca pelo lead do CRM — subestimaria)
  cpql: number | null; // gasto / qualificados (CRM)
  custoPorProposta: number | null;
  cpa: number | null; // gasto / vendas (CRM) — "custo por cliente"
  roas: number | null; // receita / gasto
  taxaQualificacao: number; // qualificados / leads
  taxaConversao: number; // vendas / leads
  /**
   * true = casou com campanha/anúncio real da Meta. false = valor de utm que NÃO é
   * campanha paga ("(direct)", "(referral)", "unknown", LP slug sem match etc.).
   * Auditoria 21/07 itens 8/10: "(direct)" com 2 vendas e R$0 de gasto entrava no
   * ranking de ROAS e nas "vendas atribuídas", inflando a leitura da mídia paga.
   * Ranking, funil agregado e alertas consideram SÓ pago; as tabelas mostram tudo.
   */
  pago: boolean;
}

export interface CriativoInfo {
  adId?: string;
  campanha?: string; // nome da campanha-mãe (Meta)
  conjunto?: string; // nome do conjunto de anúncios-mãe (Meta) — só em criativos
}

type CohortRow = { leads: number; qualificados: number; propostas: number; vendas: number; receita: number; cicloMedioDias: number | null };
type MetaAgg = { gasto: number; impressoes: number; cliques: number; leads: number; nome: string; campanha?: string; conjunto?: string; adId?: string };

/**
 * Coorte de leads + funil CRM agrupado por uma dimensão UTM (utm_campaign ou utm_content).
 * Usa SQL cru (CTE) — mesmo estilo de `/relatorios/tracking`, mais simples que Drizzle
 * aninhado pra este tipo de join com DISTINCT ON.
 */
async function coortePorDimensao(
  orgId: string,
  since: Date,
  until: Date,
  coluna: "utm_campaign" | "utm_content" | "utm_term",
  colunaId?: "meta_campaign_id" | "meta_adset_id" | "meta_ad_id",
): Promise<Map<string, CohortRow>> {
  // Se o ID real da Meta existir no lead, agrupa por ele (bate direto com o
  // idParaChaveNorm de juntarCrmComMeta — resolve SEM AMBIGUIDADE mesmo quando
  // o nome se repete entre pais diferentes, achado 22/07). Sem ID, cai no nome
  // (comportamento de sempre — maioria dos leads antigos/sem staging ainda).
  const chave = colunaId ? sql.raw(`COALESCE(NULLIF(${colunaId}, ''), ${coluna})`) : sql.raw(coluna);
  const rows = await db.execute(sql`
    WITH cohort AS (
      SELECT id, ${chave} AS chave, created_at
      FROM leads
      WHERE organizacao_id = ${orgId}
        AND ${chave} IS NOT NULL AND ${chave} <> ''
        AND created_at >= ${since.toISOString()} AND created_at < ${until.toISOString()}
    ),
    neg AS (
      SELECT DISTINCT ON (n.lead_id)
        n.lead_id, n.id AS negocio_id, n.status, n.ganho_at, n.created_at AS negocio_created_at,
        n.valor_total, n.mrr_fechado, n.tipo_receita
      FROM negocios n
      JOIN cohort c ON c.id = n.lead_id
      ORDER BY n.lead_id, n.created_at ASC
    ),
    prop AS (
      SELECT DISTINCT p.negocio_id
      FROM propostas p
      JOIN neg ON neg.negocio_id = p.negocio_id
      WHERE p.enviada_em IS NOT NULL
    )
    SELECT
      c.chave,
      count(DISTINCT c.id) AS leads,
      count(DISTINCT neg.lead_id) AS qualificados,
      count(DISTINCT prop.negocio_id) AS propostas,
      count(DISTINCT neg.negocio_id) FILTER (WHERE neg.status = 'ganho') AS vendas,
      COALESCE(sum(
        CASE WHEN neg.status = 'ganho' AND neg.tipo_receita = 'avulso' THEN neg.valor_total
             WHEN neg.status = 'ganho' THEN neg.mrr_fechado
             ELSE 0 END
      ), 0) AS receita,
      avg(
        CASE WHEN neg.status = 'ganho' AND neg.ganho_at >= c.created_at
        THEN extract(epoch FROM neg.ganho_at - c.created_at) / 86400 END
      ) AS ciclo_medio -- lead caiu no CRM → ganho (decisão Kauã 21/07), não negócio → ganho
    FROM cohort c
    LEFT JOIN neg ON neg.lead_id = c.id
    LEFT JOIN prop ON prop.negocio_id = neg.negocio_id
    GROUP BY c.chave
  `);
  const map = new Map<string, CohortRow>();
  for (const r of rows as unknown as Record<string, unknown>[]) {
    map.set(String(r.chave), {
      leads: num(r.leads),
      qualificados: num(r.qualificados),
      propostas: num(r.propostas),
      vendas: num(r.vendas),
      receita: num(r.receita),
      cicloMedioDias: r.ciclo_medio != null ? round2(Number(r.ciclo_medio)) : null,
    });
  }
  return map;
}

const COHORT_VAZIA: CohortRow = { leads: 0, qualificados: 0, propostas: 0, vendas: 0, receita: 0, cicloMedioDias: null };

function calcMetricasDerivadas(base: CohortRow & {
  chave: string; gasto: number; impressoes: number; cliques: number; leadsMeta: number; pago: boolean;
}): MetricaDimensao {
  const ctr = base.impressoes > 0 ? round2((base.cliques / base.impressoes) * 100) : null;
  const cpc = base.cliques > 0 ? round2(base.gasto / base.cliques) : null;
  const cpm = base.impressoes > 0 ? round2((base.gasto / base.impressoes) * 1000) : null;
  const cpl = base.leadsMeta > 0 ? round2(base.gasto / base.leadsMeta) : null;
  const cpql = base.qualificados > 0 ? round2(base.gasto / base.qualificados) : null;
  const custoPorProposta = base.propostas > 0 ? round2(base.gasto / base.propostas) : null;
  const cpa = base.vendas > 0 ? round2(base.gasto / base.vendas) : null;
  const roas = base.gasto > 0 ? round2(base.receita / base.gasto) : null;
  const ticketMedio = base.vendas > 0 ? round2(base.receita / base.vendas) : null;

  return {
    ...base,
    ctr, cpc, cpm, cpl, cpql, custoPorProposta, cpa, roas, ticketMedio,
    taxaQualificacao: base.leads > 0 ? round2((base.qualificados / base.leads) * 100) : 0,
    taxaConversao: base.leads > 0 ? round2((base.vendas / base.leads) * 100) : 0,
  };
}

/** Soma dois cohorts (ciclo médio ponderado por vendas). */
function somaCohort(a: CohortRow, b: CohortRow): CohortRow {
  const vendas = a.vendas + b.vendas;
  let cicloMedioDias: number | null = null;
  if (a.cicloMedioDias != null && b.cicloMedioDias != null && vendas > 0) {
    cicloMedioDias = round2((a.cicloMedioDias * a.vendas + b.cicloMedioDias * b.vendas) / vendas);
  } else {
    cicloMedioDias = a.cicloMedioDias ?? b.cicloMedioDias;
  }
  return {
    leads: a.leads + b.leads,
    qualificados: a.qualificados + b.qualificados,
    propostas: a.propostas + b.propostas,
    vendas,
    receita: round2(a.receita + b.receita),
    cicloMedioDias,
  };
}

/**
 * Junta a coorte CRM (por utm_campaign/utm_content/utm_term) com a agregação Meta (por
 * campanha, conjunto ou criativo), garantindo que TUDO apareça — casado ou não dos dois
 * lados. Núcleo compartilhado por getMetricasPorCampanha/getMetricasPorConjunto/
 * getMetricasPorCriativo.
 *
 * MERGE por chave resolvida (bug ENG-666, 22/07): o mesmo anúncio chega no CRM com
 * DUAS chaves de utm_content (nome do anúncio E ad_id) — as duas casavam com o mesmo
 * agregado da Meta e viravam duas linhas com o MESMO gasto (uma zerada em conversão),
 * duplicando o criativo na tabela. Agora cohorts que resolvem pra mesma chave Meta
 * são somados numa linha só.
 *
 * NOME AMBÍGUO ENTRE PAIS DIFERENTES (achado 22/07 testando conjunto com dado real):
 * conjunto/criativo é identificado no CRM só pelo NOME (RD Station grava
 * "{conjunto}@{anúncio}" em texto, não os IDs da Meta) — mas o MESMO nome de anúncio
 * pode existir em DOIS conjuntos diferentes (ex: "Ads_1000leads" roda em "LAL 1%" e em
 * "Mes-do-consumidor", achado real na conta da Callface). Por isso a chave em
 * `metaPorChaveNorm` pra conjunto/criativo é escopada pelo pai real (campaignId/adsetId,
 * não só o nome) — repare que agora pode haver 2+ entradas Meta com o MESMO nome (um
 * pra cada pai). Resolver a coorte CRM só pelo nome ficaria ambíguo demais pra decidir
 * qual dos dois "ganha"; a escolha aqui é DUPLICAR a coorte pros 2 (ou mais) candidatos
 * — o total de leads/vendas por CONJUNTO fica certo mesmo pros nomes ambíguos (é a Meta
 * que sabe separar), só o total por CRITATIVO nesse caso raro pode contar o mesmo lead
 * duas vezes (uma em cada conjunto-pai) — mais honesto que sumir de um dos dois.
 */
function juntarCrmComMeta(
  crm: Map<string, CohortRow>,
  metaPorChaveNorm: Map<string, MetaAgg>,
  idParaChaveNorm: Map<string, string>,
): (MetricaDimensao & CriativoInfo)[] {
  const resultado: (MetricaDimensao & CriativoInfo)[] = [];
  const chavesMetaUsadas = new Set<string>();

  // índice secundário: nome normalizado → TODAS as chaves Meta que compartilham esse nome
  // (tamanho 1 no caso normal; 2+ só quando o mesmo nome existe em pais diferentes)
  const porNomeNorm = new Map<string, string[]>();
  for (const [chaveMeta, agg] of metaPorChaveNorm.entries()) {
    const nk = normCampanha(agg.nome);
    const arr = porNomeNorm.get(nk) ?? [];
    arr.push(chaveMeta);
    porNomeNorm.set(nk, arr);
  }

  // agrupa cohorts CRM pela(s) chave(s) RESOLVIDA(s) (Meta quando casa; a própria quando não)
  const grupos = new Map<string, { cohort: CohortRow; meta?: MetaAgg; chaveDisplay: string }>();
  for (const [chaveCrm, dadosCrm] of crm.entries()) {
    const viaId = idParaChaveNorm.get(chaveCrm);
    const candidatos = viaId ? [viaId] : (porNomeNorm.get(normCampanha(chaveCrm)) ?? []);

    if (candidatos.length === 0) {
      const groupKey = `crm:${chaveCrm}`;
      const g = grupos.get(groupKey);
      if (g) g.cohort = somaCohort(g.cohort, dadosCrm);
      else grupos.set(groupKey, { cohort: { ...dadosCrm }, meta: undefined, chaveDisplay: chaveCrm });
      continue;
    }

    for (const chaveMetaNorm of candidatos) {
      const m = metaPorChaveNorm.get(chaveMetaNorm);
      const groupKey = `meta:${chaveMetaNorm}`;
      const g = grupos.get(groupKey);
      if (g) g.cohort = somaCohort(g.cohort, dadosCrm);
      else grupos.set(groupKey, { cohort: { ...dadosCrm }, meta: m, chaveDisplay: m?.nome ?? chaveCrm });
      chavesMetaUsadas.add(chaveMetaNorm);
    }
  }

  for (const g of grupos.values()) {
    const m = g.meta;
    resultado.push({
      ...calcMetricasDerivadas({
        chave: g.chaveDisplay, ...g.cohort,
        gasto: m ? round2(m.gasto) : 0, impressoes: m?.impressoes ?? 0, cliques: m?.cliques ?? 0, leadsMeta: m?.leads ?? 0,
        pago: !!m, // só é "mídia paga" se casou com a Meta
      }),
      adId: m?.adId, campanha: m?.campanha, conjunto: m?.conjunto,
    });
  }

  // Tudo que tem atividade na Meta mas não casou com nenhum lead do CRM — sem isso,
  // criativos/campanhas que geraram clique/lead reportado só na Meta (utm não persistiu,
  // ou lead entrou por outro canal sem UTM) somem do relatório. Aparecem com CRM zerado,
  // não escondemos o gasto.
  for (const [chaveMeta, m] of metaPorChaveNorm.entries()) {
    if (chavesMetaUsadas.has(chaveMeta)) continue;
    resultado.push({
      ...calcMetricasDerivadas({
        chave: m.nome, ...COHORT_VAZIA,
        gasto: round2(m.gasto), impressoes: m.impressoes, cliques: m.cliques, leadsMeta: m.leads,
        pago: true,
      }),
      adId: m.adId, campanha: m.campanha, conjunto: m.conjunto,
    });
  }

  return resultado;
}

export async function getMetricasPorCampanha(orgId: string, since: Date, until: Date): Promise<MetricaDimensao[]> {
  const crm = await coortePorDimensao(orgId, since, until, "utm_campaign", "meta_campaign_id");

  if (!metaConfigured()) {
    return [...crm.entries()]
      .map(([chave, dados]) => calcMetricasDerivadas({ chave, ...dados, gasto: 0, impressoes: 0, cliques: 0, leadsMeta: 0, pago: false }))
      .sort((a, b) => b.leads - a.leads);
  }

  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);
  const insights = await fetchMetaCampaignInsights(sinceStr, untilStr);
  const porChaveNorm = new Map<string, MetaAgg>();
  const idParaChave = new Map<string, string>();
  for (const i of insights) {
    if (i.campaignId && CAMPANHAS_EXCLUIDAS_COMERCIAL.has(i.campaignId)) continue;
    const k = normCampanha(i.campaignName);
    const cur = porChaveNorm.get(k) ?? { gasto: 0, impressoes: 0, cliques: 0, leads: 0, nome: i.campaignName };
    cur.gasto += i.gasto; cur.impressoes += i.impressoes; cur.cliques += i.cliques; cur.leads += i.leads;
    porChaveNorm.set(k, cur);
    if (i.campaignId) idParaChave.set(i.campaignId, k);
  }

  const resultado = juntarCrmComMeta(crm, porChaveNorm, idParaChave);
  return resultado.sort((a, b) => b.gasto - a.gasto || b.leads - a.leads);
}

export async function getMetricasPorCriativo(orgId: string, since: Date, until: Date): Promise<(MetricaDimensao & CriativoInfo)[]> {
  const crm = await coortePorDimensao(orgId, since, until, "utm_content", "meta_ad_id");

  if (!metaConfigured()) {
    return [...crm.entries()]
      .map(([chave, dados]) => calcMetricasDerivadas({ chave, ...dados, gasto: 0, impressoes: 0, cliques: 0, leadsMeta: 0, pago: false }))
      .sort((a, b) => b.leads - a.leads);
  }

  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);
  const ads = await fetchMetaAdInsights(sinceStr, untilStr);
  const porChaveNorm = new Map<string, MetaAgg>();
  const idParaChave = new Map<string, string>();
  // chave escopada pelo CONJUNTO (adsetId), não só pelo nome do anúncio — o mesmo nome
  // de criativo pode existir em conjuntos diferentes (achado real 22/07: "Ads_1000leads"
  // roda em 2 conjuntos da mesma campanha). Sem o escopo, os dois merjeariam numa linha
  // só, sumindo do drill-down de um dos dois conjuntos. Ver nota grande em juntarCrmComMeta.
  for (const a of ads) {
    if (a.campaignName && CAMPANHAS_EXCLUIDAS_COMERCIAL_NOMES.has(normCampanha(a.campaignName))) continue;
    const k = `${a.adsetId || normCampanha(a.adsetName)}::${normCampanha(a.adName)}`;
    const cur = porChaveNorm.get(k) ?? { gasto: 0, impressoes: 0, cliques: 0, leads: 0, nome: a.adName, campanha: a.campaignName, conjunto: a.adsetName, adId: a.adId };
    cur.gasto += a.gasto; cur.impressoes += a.impressoes; cur.cliques += a.cliques; cur.leads += a.leads;
    porChaveNorm.set(k, cur);
    if (a.adId) idParaChave.set(a.adId, k);
  }

  const resultado = juntarCrmComMeta(crm, porChaveNorm, idParaChave);
  return resultado.sort((a, b) => b.gasto - a.gasto || b.leads - a.leads);
}

/**
 * Conjunto de anúncios (adset) — nível intermediário entre campanha e criativo, onde vive
 * a segmentação de público/orçamento. Mesmo padrão exato de getMetricasPorCriativo: só troca
 * a coluna de coorte (utm_term em vez de utm_content) e a fonte Meta (level=adset). utm_term
 * já é preenchido hoje como "conjunto" pelo fluxo RD Station (webhook + backfill em
 * rd-criativo.ts) — não precisou de nenhuma coluna nova no schema.
 */
export async function getMetricasPorConjunto(orgId: string, since: Date, until: Date): Promise<(MetricaDimensao & CriativoInfo)[]> {
  const crm = await coortePorDimensao(orgId, since, until, "utm_term", "meta_adset_id");

  if (!metaConfigured()) {
    return [...crm.entries()]
      .map(([chave, dados]) => calcMetricasDerivadas({ chave, ...dados, gasto: 0, impressoes: 0, cliques: 0, leadsMeta: 0, pago: false }))
      .sort((a, b) => b.leads - a.leads);
  }

  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);
  const adsets = await fetchMetaAdsetInsights(sinceStr, untilStr);
  const porChaveNorm = new Map<string, MetaAgg>();
  const idParaChave = new Map<string, string>();
  // chave escopada pela CAMPANHA (campaignId), não só pelo nome do conjunto — mesma
  // precaução do criativo: dois nomes de conjunto idênticos em campanhas diferentes não
  // se misturam (não achamos esse caso na conta real ainda, mas o mesmo padrão de nome
  // repetido já aconteceu um nível abaixo, então blindar aqui também é barato).
  for (const a of adsets) {
    if (a.campaignId && CAMPANHAS_EXCLUIDAS_COMERCIAL.has(a.campaignId)) continue;
    const k = `${a.campaignId || normCampanha(a.campaignName)}::${normCampanha(a.adsetName)}`;
    const cur = porChaveNorm.get(k) ?? { gasto: 0, impressoes: 0, cliques: 0, leads: 0, nome: a.adsetName, campanha: a.campaignName, adId: a.adsetId };
    cur.gasto += a.gasto; cur.impressoes += a.impressoes; cur.cliques += a.cliques; cur.leads += a.leads;
    porChaveNorm.set(k, cur);
    if (a.adsetId) idParaChave.set(a.adsetId, k);
  }

  const resultado = juntarCrmComMeta(crm, porChaveNorm, idParaChave);
  return resultado.sort((a, b) => b.gasto - a.gasto || b.leads - a.leads);
}

export interface FunilMidiaPaga {
  impressoes: number;
  cliques: number;
  leads: number; // leads do CRM (cohort — pode ser menor que leadsMeta por dedupe)
  leadsMeta: number; // leads reportados pela Meta (o número que o card usa; ENG-666 item 2)
  qualificados: number;
  propostas: number;
  vendas: number;
  receita: number;
  gastoTotal: number;
}

/**
 * Funil agregado pro card de jornada — SÓ campanhas pagas (casadas com a Meta).
 * Coortes orgânicas ("(direct)" etc.) ficam fora: este é o funil da MÍDIA PAGA.
 */
export function agregarFunil(porCampanha: MetricaDimensao[]): FunilMidiaPaga {
  return porCampanha.filter((c) => c.pago).reduce((acc, c) => ({
    impressoes: acc.impressoes + c.impressoes,
    cliques: acc.cliques + c.cliques,
    leads: acc.leads + c.leads,
    leadsMeta: acc.leadsMeta + c.leadsMeta,
    qualificados: acc.qualificados + c.qualificados,
    propostas: acc.propostas + c.propostas,
    vendas: acc.vendas + c.vendas,
    receita: acc.receita + c.receita,
    gastoTotal: acc.gastoTotal + c.gasto,
  }), { impressoes: 0, cliques: 0, leads: 0, leadsMeta: 0, qualificados: 0, propostas: 0, vendas: 0, receita: 0, gastoTotal: 0 });
}

/**
 * Top N por ROAS puro (sem nota composta, sem amostra mínima — decisão Scott 15/07).
 * SÓ mídia paga com gasto real — "(direct)"/orgânico com R$0 não entra num ranking
 * de ROAS de mídia (auditoria item 10). Sem ROAS calculável vai pro fim.
 */
export function rankingPorRoas<T extends MetricaDimensao>(itens: T[], limite = 10): T[] {
  return itens.filter((i) => i.pago && i.gasto > 0)
    .sort((a, b) => {
      if (a.roas == null && b.roas == null) return b.gasto - a.gasto;
      if (a.roas == null) return 1;
      if (b.roas == null) return -1;
      return b.roas - a.roas;
    })
    .slice(0, limite);
}

// Predicado SQL de "lead de mídia paga" — MESMO critério do backfill/enriquecimento.
const LEAD_PAGO_SQL = sql.raw(`(lower(coalesce(utm_medium,'')) ~ '(cpc|ppc|paid)' OR origem IN ('Mídia Paga','meta_ads'))`);

export interface StatusAtualEtapa {
  stage: string;
  label: string;
  total: number;
}

/**
 * ENG-667a — Onde os leads PAGOS do período estão AGORA no funil (estágio atual real,
 * mesma prioridade do board de pré-vendas: negócio > sdr_status). Responde "dos N
 * leads que a mídia trouxe no mês, quantos estão travados em qual etapa hoje".
 */
export async function getStatusAtualLeadsPagos(orgId: string, since: Date, until: Date): Promise<StatusAtualEtapa[]> {
  const rows = await db.execute(sql`
    WITH cohort AS (
      SELECT id, coalesce(sdr_status,'pending') AS sdr_status
      FROM leads
      WHERE organizacao_id = ${orgId}
        AND created_at >= ${since.toISOString()} AND created_at < ${until.toISOString()}
        AND ${LEAD_PAGO_SQL}
    ),
    neg AS (
      SELECT DISTINCT ON (n.lead_id) n.lead_id, n.status
      FROM negocios n JOIN cohort c ON c.id = n.lead_id
      WHERE n.origem_negocio IS DISTINCT FROM 'carteira'
      ORDER BY n.lead_id, n.created_at DESC
    )
    SELECT CASE
      WHEN neg.status = 'ganho' THEN 'ganho'
      WHEN neg.status = 'perdido' THEN 'perdido'
      WHEN neg.status = 'negociacao_iniciada' THEN 'negociacao'
      WHEN neg.status = 'proposta_apresentada' THEN 'proposta'
      WHEN neg.status IN ('reuniao_agendada','reuniao_realizada','trial') THEN 'qualificado_pre_proposta'
      WHEN neg.status IN ('sem_retorno','trava_negociacao','trava_assinatura','outra_data','no_show') THEN 'negocio_parado'
      WHEN neg.status IS NOT NULL THEN 'negocio_parado'
      WHEN c.sdr_status = 'disqualified' THEN 'desqualificado'
      WHEN c.sdr_status IN ('sdr_sem_retorno','sdr_sem_interesse','sdr_retomar_depois') THEN 'estagnado_sdr'
      WHEN c.sdr_status = 'qualifying' THEN 'qualificando'
      WHEN c.sdr_status = 'contacted' THEN 'em_contato'
      ELSE 'novo'
    END AS stage, count(*)::int AS total
    FROM cohort c LEFT JOIN neg ON neg.lead_id = c.id
    GROUP BY 1
  `);
  const ORDEM: { stage: string; label: string }[] = [
    { stage: "novo", label: "Novo (sem 1º contato)" },
    { stage: "em_contato", label: "Em contato" },
    { stage: "qualificando", label: "Qualificando" },
    { stage: "qualificado_pre_proposta", label: "Qualificado (call/trial)" },
    { stage: "proposta", label: "Proposta enviada" },
    { stage: "negociacao", label: "Negociação" },
    { stage: "ganho", label: "Ganho" },
    { stage: "perdido", label: "Perdido" },
    { stage: "negocio_parado", label: "Negócio parado (retomar)" },
    { stage: "estagnado_sdr", label: "Estagnado na pré-venda" },
    { stage: "desqualificado", label: "Desqualificado" },
  ];
  const mapa = new Map((rows as unknown as { stage: string; total: number }[]).map((r) => [r.stage, Number(r.total)]));
  return ORDEM.map((o) => ({ ...o, total: mapa.get(o.stage) ?? 0 }));
}

export interface ReceitaAtribuidaLinha {
  chave: string;
  pago: boolean;
  vendas: number;
  receita: number;
}

export interface ReceitaAtribuida {
  linhas: ReceitaAtribuidaLinha[];
  receitaTotal: number;
  receitaPaga: number;
  vendasTotal: number;
  vendasPagas: number;
}

/**
 * ENG-667b — Receita GANHA no período atribuída pela ORIGEM ORIGINAL do lead
 * (first-touch), independente de quando o lead entrou no CRM. É a pergunta do gestor
 * de tráfego: "quanto da receita deste mês veio, na origem, de tráfego pago?" — o
 * cohort não captura venda de lead antigo. Receita na régua canônica do fechado.
 */
export async function getReceitaAtribuida(orgId: string, since: Date, until: Date): Promise<ReceitaAtribuida> {
  const rows = await db.execute(sql`
    SELECT
      coalesce(NULLIF(l.utm_campaign,''),
        CASE WHEN ${LEAD_PAGO_SQL} THEN '(mídia paga — sem campanha)' ELSE coalesce(NULLIF(l.origem,''),'(sem origem)') END
      ) AS chave,
      bool_or(${LEAD_PAGO_SQL}) AS pago,
      count(DISTINCT n.id)::int AS vendas,
      COALESCE(sum(CASE WHEN n.tipo_receita = 'avulso' THEN n.valor_total ELSE n.mrr_fechado END), 0) AS receita
    FROM negocios n
    JOIN leads l ON l.id = n.lead_id
    WHERE n.organizacao_id = ${orgId} AND n.status = 'ganho'
      AND n.ganho_at >= ${since.toISOString()} AND n.ganho_at < ${until.toISOString()}
    GROUP BY 1
    ORDER BY 4 DESC
  `);
  const linhas = (rows as unknown as Record<string, unknown>[]).map((r) => ({
    chave: String(r.chave),
    pago: !!r.pago,
    vendas: num(r.vendas),
    receita: round2(num(r.receita)),
  }));
  return {
    linhas,
    receitaTotal: round2(linhas.reduce((s, l) => s + l.receita, 0)),
    receitaPaga: round2(linhas.filter((l) => l.pago).reduce((s, l) => s + l.receita, 0)),
    vendasTotal: linhas.reduce((s, l) => s + l.vendas, 0),
    vendasPagas: linhas.filter((l) => l.pago).reduce((s, l) => s + l.vendas, 0),
  };
}

export interface RoasCicloLinha {
  chave: string;
  gastoTotal: number;
  receitaTotal: number;
  vendasTotal: number;
  roasCiclo: number | null;
}

/**
 * ENG-667c — ROAS de CICLO DE VIDA por campanha: toda a receita já atribuída à
 * campanha (qualquer data) ÷ todo o gasto dela (Meta all-time). Não penaliza
 * campanha boa com ciclo de venda longo, que parece ruim no recorte mensal.
 */
export async function getRoasCiclo(orgId: string): Promise<RoasCicloLinha[]> {
  if (!metaConfigured()) return [];
  const desde = "2025-06-01"; // início da era Meta da Callface
  const ate = new Date().toISOString().slice(0, 10);
  const insights = await fetchMetaCampaignInsights(desde, ate);
  const gastoPorChave = new Map<string, { gasto: number; nome: string }>();
  const idParaChave = new Map<string, string>();
  for (const i of insights) {
    if (i.campaignId && CAMPANHAS_EXCLUIDAS_COMERCIAL.has(i.campaignId)) continue;
    const k = normCampanha(i.campaignName);
    const cur = gastoPorChave.get(k) ?? { gasto: 0, nome: i.campaignName };
    cur.gasto += i.gasto;
    gastoPorChave.set(k, cur);
    if (i.campaignId) idParaChave.set(i.campaignId, k);
  }

  // receita ALL-TIME por utm_campaign (regra canônica do fechado)
  const rows = await db.execute(sql`
    SELECT l.utm_campaign AS chave, count(DISTINCT n.id)::int AS vendas,
      COALESCE(sum(CASE WHEN n.tipo_receita = 'avulso' THEN n.valor_total ELSE n.mrr_fechado END), 0) AS receita
    FROM negocios n JOIN leads l ON l.id = n.lead_id
    WHERE n.organizacao_id = ${orgId} AND n.status = 'ganho'
      AND l.utm_campaign IS NOT NULL AND l.utm_campaign <> ''
    GROUP BY 1
  `);
  const porCampanha = new Map<string, { receita: number; vendas: number }>();
  for (const r of rows as unknown as Record<string, unknown>[]) {
    const bruto = String(r.chave);
    const k = gastoPorChave.has(normCampanha(bruto)) ? normCampanha(bruto) : idParaChave.get(bruto);
    if (!k) continue; // não é campanha Meta
    const cur = porCampanha.get(k) ?? { receita: 0, vendas: 0 };
    cur.receita += num(r.receita);
    cur.vendas += num(r.vendas);
    porCampanha.set(k, cur);
  }

  return [...gastoPorChave.entries()]
    .map(([k, g]) => {
      const rec = porCampanha.get(k) ?? { receita: 0, vendas: 0 };
      return {
        chave: g.nome,
        gastoTotal: round2(g.gasto),
        receitaTotal: round2(rec.receita),
        vendasTotal: rec.vendas,
        roasCiclo: g.gasto > 0 ? round2(rec.receita / g.gasto) : null,
      };
    })
    .filter((l) => l.gastoTotal > 0)
    .sort((a, b) => (b.roasCiclo ?? 0) - (a.roasCiclo ?? 0));
}

/** ENG-667d — Pipeline ABERTO hoje cuja origem original é mídia paga (receita futura do canal). */
export async function getPipelineAbertoPago(orgId: string): Promise<{ total: number; negocios: number }> {
  const rows = await db.execute(sql`
    SELECT count(DISTINCT n.id)::int AS negocios, COALESCE(sum(n.valor_total), 0) AS total
    FROM negocios n JOIN leads l ON l.id = n.lead_id
    WHERE n.organizacao_id = ${orgId}
      AND n.status IN ('reuniao_agendada','reuniao_realizada','trial','proposta_apresentada','negociacao_iniciada')
      AND ${LEAD_PAGO_SQL}
  `);
  const r = (rows as unknown as Record<string, unknown>[])[0] ?? {};
  return { total: round2(num(r.total)), negocios: num(r.negocios) };
}

export interface Alerta {
  nivel: "verde" | "amarelo" | "vermelho";
  texto: string;
  chave?: string; // campanha/criativo relacionado, se aplicável
}

/**
 * Alertas determinísticos (sem "IA mágica", tudo regra fixa sobre os números já
 * calculados). V1 não compara com período anterior (exigiria 2ª consulta) — os
 * alertas de tendência ("CPL caiu") ficam pra quando tivermos histórico persistido
 * (Fase 2, ver seção 7 da proposta).
 */
export function gerarAlertas(campanhas: MetricaDimensao[], criativos: MetricaDimensao[]): Alerta[] {
  const alertas: Alerta[] = [];
  const comGasto = campanhas.filter((c) => c.pago && c.gasto > 0);
  if (comGasto.length === 0) return alertas;

  const cpaValidos = comGasto.filter((c) => c.cpa != null).map((c) => c.cpa as number);
  const cpaMedio = cpaValidos.length ? cpaValidos.reduce((s, v) => s + v, 0) / cpaValidos.length : null;
  const taxaQualMedia = comGasto.reduce((s, c) => s + c.taxaQualificacao, 0) / comGasto.length;

  const melhorRoas = [...comGasto].filter((c) => c.roas != null).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];
  if (melhorRoas) alertas.push({ nivel: "verde", texto: `Melhor ROAS do período: ${melhorRoas.chave} (${melhorRoas.roas?.toFixed(2)}x)`, chave: melhorRoas.chave });

  for (const c of comGasto) {
    if (c.leads >= 5 && c.taxaQualificacao < taxaQualMedia * 0.5) {
      alertas.push({ nivel: "amarelo", texto: `${c.chave}: muito lead, pouca qualificação (${c.taxaQualificacao.toFixed(1)}% vs média ${taxaQualMedia.toFixed(1)}%)`, chave: c.chave });
    }
    if (cpaMedio != null && c.cpa != null && c.cpa > cpaMedio * 2) {
      alertas.push({ nivel: "vermelho", texto: `${c.chave}: CPA muito acima da média (${c.cpa.toFixed(2)} vs média ${cpaMedio.toFixed(2)})`, chave: c.chave });
    }
    if (c.gasto > 200 && c.vendas === 0) {
      alertas.push({ nivel: "vermelho", texto: `${c.chave}: gastando sem converter nenhum cliente no período`, chave: c.chave });
    }
  }

  const ctrValidos = criativos.filter((cr) => cr.ctr != null).map((cr) => cr.ctr as number);
  const ctrMedio = ctrValidos.length ? ctrValidos.reduce((s, v) => s + v, 0) / ctrValidos.length : null;
  if (ctrMedio != null) {
    for (const cr of criativos) {
      if (cr.gasto > 50 && cr.ctr != null && cr.ctr < ctrMedio * 0.5) {
        alertas.push({ nivel: "vermelho", texto: `${cr.chave}: CTR bem abaixo da média dos criativos (${cr.ctr.toFixed(2)}% vs ${ctrMedio.toFixed(2)}%)`, chave: cr.chave });
      }
    }
  }

  return alertas;
}
