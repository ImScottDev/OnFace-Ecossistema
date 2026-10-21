/**
 * Fonte ÚNICA das métricas do relatório Comercial.
 * Topo (KpiBar/resumo) e aba (TabComercial) consomem as MESMAS funções daqui —
 * impossível um win rate / pipeline divergir do outro.
 *
 * Regras (decisões Scott 30/jun):
 * - Pipeline = snapshot da operação AGORA (negócios abertos). NÃO reage ao filtro de período.
 *   A FONTE é `oportunidades`, a mesma do board de Pipeline. Até 21/09 esta
 *   função lia `negocios.status` filtrando pelos 5 estágios de
 *   `DEFAULT_STAGES` — e negócio aberto tem ELEVEN status distintos no banco.
 *   Os 6 de fora somavam 411 negócios e R$ 316.402,33, entre eles
 *   R$ 188.527,84 em `ativo` e R$ 50.693,38 em `trava_negociacao`. O relatório
 *   que a liderança usa mostrava R$ 160.789,35 de um pipeline de
 *   R$ 477.191,68: 22% do real, sem nada indicando o recorte.
 * - Win rate, fechado, motivos, ciclo = respeitam o período selecionado.
 * - Valor = `valorTotal` (atual). Recorrente/avulso = `tipoReceita`. (mrr_estimado/valor_projeto são legacy.)
 * - Produto: só Callface (sem dimensão de produto).
 * - Papel: closer recebe responsavelId = ele mesmo; admin/gerente/leitor = org inteira.
 */
import { db } from "@/lib/db";
import { negocios, leads } from "@/lib/db/schema";
import { and, eq, inArray, gte, lt, count, sum, sql, isNotNull, isNull, asc, type SQL } from "drizzle-orm";
import { DEFAULT_STAGES } from "@/lib/crm/pipeline";
import { MOTIVOS_PERDA } from "@/lib/vendas/dominio";
import { VALOR_MRR_VENDIDO, VALOR_NAO_RECORRENTE_VENDIDO } from "./receita-fechada";

/**
 * Status de negócio ABERTO, por EXCLUSÃO dos fechados.
 *
 * Era `DEFAULT_STAGES.map(...)`, os 5 estágios configuráveis do pipeline. Só
 * que negócio aberto tem 11 status distintos no banco, e os 6 de fora somavam
 * **411 negócios e R$ 316.402,33** — R$ 188.527,84 em `ativo`, R$ 67.726,11 em
 * `outra_data`, R$ 50.693,38 em `trava_negociacao`. Três leituras contavam por
 * essa lista (relatório comercial, board do CRM2, analytics de vendas) e as
 * três mostravam uma fração do pipeline sem nada indicando o recorte.
 *
 * Por exclusão e não por enumeração de propósito: status novo que apareça
 * entra como aberto, que é o padrão seguro. Enumerar faz o status novo sumir
 * do relatório em silêncio, que foi exatamente o que aconteceu.
 *
 * `no_show` conta como ABERTO. É a decisão da Fase 26: no-show é estado da
 * reunião, não perda do negócio. O canônico (`oportunidades`) já contava assim,
 * e é o que faz os dois lados fecharem em 527.
 */
export const STATUS_FECHADOS = ["ganho", "perdido"] as const;
export const PIPELINE_ATIVO_STATUSES = [
  ...DEFAULT_STAGES.map((s) => s.key),
  "ativo", "outra_data", "sem_retorno", "no_show", "trava_negociacao", "trava_assinatura",
];

// Probabilidade de fechamento por etapa — usada no forecast ponderado.
// Defaults; ajustável depois com o head comercial.
// As probabilidades vieram das etapas legadas equivalentes, sem número novo
// inventado: `trial` sumiu porque no modelo canônico trial é ESTADO da
// oportunidade, não etapa do funil.
export const STAGE_PROB: Record<string, number> = {
  entrada: 0.1,
  diagnostico: 0.25,
  proposta: 0.5,
  negociacao: 0.7,
};

/** Ordem do funil, e o rótulo que a tela mostra. */
export const ETAPAS_DO_FUNIL = [
  { key: "entrada", label: "Entrada" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
] as const;

const num = (v: unknown): number => Number(v ?? 0) || 0;

/** Escopo por responsável: closer vê só os negócios dele; admin/etc vê tudo. */
function scopeResp(responsavelId?: string | null): SQL | undefined {
  return responsavelId ? eq(negocios.responsavelId, responsavelId) : undefined;
}

// Filtro de safra (COM-02): legado = migrado do Zoho (zoho_id preenchido) vs
// nativo (criado direto no CRM, pós-corte). Reaproveita zoho_id — sem campo novo.
export type Safra = "legado" | "nativo";

function scopeSafra(safra?: Safra): SQL | undefined {
  if (!safra) return undefined;
  return safra === "legado" ? isNotNull(negocios.zohoId) : isNull(negocios.zohoId);
}

/**
 * Crescimento % vs período anterior. Trata base zero/pequena:
 * retorna null ("n/a") quando a base anterior é < 3 — evita "+3800%" de base quase zero.
 */
export function crescimento(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior < 3) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

export interface EtapaPipeline {
  status: string;
  count: number;
  recorrente: number;
  avulso: number;
  valor: number;
}

export interface PipelineAtual {
  etapas: EtapaPipeline[];
  total: number;
  negociosAbertos: number;
  ponderado: number; // forecast bruto (Σ valor × probabilidade da etapa)
}

/**
 * Pipeline ATUAL (snapshot). Não filtra período. Particiona valor por tipoReceita.
 * Retorna todas as etapas ativas (inclui as zeradas, na ordem do funil).
 */
export async function getPipelineAtual(orgId: string, responsavelId?: string | null, safra?: Safra): Promise<PipelineAtual> {
  // MESMA fonte do board (`oportunidades`), para que os dois não possam
  // divergir. Agrupar por `negocios.status` significava escolher quais status
  // contam, e a escolha deixava 411 negócios abertos de fora.
  const linhas = await db.execute<{ etapa: string; tipo_receita: string | null; n: string; valor: string }>(sql`
    SELECT o.etapa, n.tipo_receita,
           count(*)::text AS n,
           COALESCE(sum(o.valor), 0)::text AS valor
      FROM oportunidades o
      LEFT JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE o.organizacao_id = ${orgId}::uuid
       AND o.ganho_at IS NULL AND o.perdido_at IS NULL
       ${responsavelId ? sql`AND o.responsavel_id = ${responsavelId}::uuid` : sql``}
       ${safra === "legado" ? sql`AND n.zoho_id IS NOT NULL`
         : safra === "nativo" ? sql`AND n.zoho_id IS NULL` : sql``}
     GROUP BY o.etapa, n.tipo_receita`);

  const etapas: EtapaPipeline[] = ETAPAS_DO_FUNIL.map(({ key }) => {
    const doGrupo = linhas.filter((r) => r.etapa === key);
    const recorrente = doGrupo.filter((r) => r.tipo_receita !== "avulso").reduce((s, r) => s + Number(r.valor), 0);
    const avulso = doGrupo.filter((r) => r.tipo_receita === "avulso").reduce((s, r) => s + Number(r.valor), 0);
    const c = doGrupo.reduce((s, r) => s + Number(r.n), 0);
    return { status: key, count: c, recorrente, avulso, valor: recorrente + avulso };
  });

  const total = etapas.reduce((s, e) => s + e.valor, 0);
  const negociosAbertos = etapas.reduce((s, e) => s + e.count, 0);
  const ponderado = etapas.reduce((s, e) => s + e.valor * (STAGE_PROB[e.status] ?? 0), 0);
  return { etapas, total, negociosAbertos, ponderado };
}

export interface WinRate {
  ganhos: number;
  perdidos: number;
  n: number; // amostra (decididos)
  taxa: number | null; // null = sem decididos no período
  amostraPequena: boolean; // n>0 && n<3 → não tratar como representativo
}

/**
 * Win rate no período = ganho / (ganho + perdido), contando a DECISÃO que caiu
 * na janela (`oportunidades.ganho_at` / `perdido_at`), só negócios "novo" (sem
 * clones de carteira). Era coorte de criação do negócio: o card do topo dizia
 * "5 decididos" ao lado de "6 ganhos" no mesmo período, porque contava coisas
 * diferentes. Agora ganhos daqui == ganhos do fechado (mesma data de decisão).
 * Expõe a amostra `n` pra sinalizar base pequena.
 */
export async function getWinRate(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
  safra?: Safra,
): Promise<WinRate> {
  const [r] = await db.execute<{ ganhos: string; perdidos: string }>(sql`
    SELECT count(*) FILTER (WHERE o.ganho_at >= ${since.toISOString()}::timestamptz AND o.ganho_at < ${until.toISOString()}::timestamptz)::text AS ganhos,
           count(*) FILTER (WHERE o.perdido_at >= ${since.toISOString()}::timestamptz AND o.perdido_at < ${until.toISOString()}::timestamptz)::text AS perdidos
      FROM oportunidades o
      LEFT JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE o.organizacao_id = ${orgId}::uuid
       AND COALESCE(n.origem_negocio, 'novo') = 'novo'
       ${responsavelId ? sql`AND o.responsavel_id = ${responsavelId}::uuid` : sql``}
       ${safra === "legado" ? sql`AND n.zoho_id IS NOT NULL` : safra === "nativo" ? sql`AND n.zoho_id IS NULL` : sql``}`);
  const ganhos = num(r?.ganhos);
  const perdidos = num(r?.perdidos);
  const n = ganhos + perdidos;
  return {
    ganhos,
    perdidos,
    n,
    taxa: n > 0 ? Math.round((ganhos / n) * 1000) / 10 : null,
    amostraPequena: n > 0 && n < 3,
  };
}

export interface MotivosPerda {
  itens: { motivo: string; count: number; pct: number }[];
  total: number;
  semClassificacao: number; // null + "outro"
  semClassificacaoPct: number;
}

/** Motivos de perda no período, com o não-classificado (null/"outro") isolado e percentuado. */
export async function getMotivosPerda(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
  safra?: Safra,
): Promise<MotivosPerda> {
  // Perda DECIDIDA na janela (`oportunidades.perdido_at`), a mesma data do win rate.
  const rows = (await db.execute<{ motivo: string | null; total: string }>(sql`
    SELECT COALESCE(o.motivo_perda, n.motivo_perda) AS motivo, count(*)::text AS total
      FROM oportunidades o
      LEFT JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE o.organizacao_id = ${orgId}::uuid
       AND o.perdido_at >= ${since.toISOString()}::timestamptz AND o.perdido_at < ${until.toISOString()}::timestamptz
       ${responsavelId ? sql`AND o.responsavel_id = ${responsavelId}::uuid` : sql``}
       ${safra === "legado" ? sql`AND n.zoho_id IS NOT NULL` : safra === "nativo" ? sql`AND n.zoho_id IS NULL` : sql``}
     GROUP BY 1`)) as unknown as { motivo: string | null; total: string }[];

  const total = rows.reduce((s, r) => s + num(r.total), 0);
  const isSemClass = (m: string | null) => !m || m === "outro" || m === "nao_respondeu";
  const semClassificacao = rows.filter((r) => isSemClass(r.motivo)).reduce((s, r) => s + num(r.total), 0);

  const itens = rows
    .map((r) => ({
      motivo: r.motivo && !isSemClass(r.motivo)
        ? (MOTIVOS_PERDA.find((m) => m.chave === r.motivo)?.rotulo ?? r.motivo.replace(/_/g, " "))
        : "Sem motivo classificado",
      count: num(r.total),
    }))
    // funde todos os "sem classificação" numa entrada só
    .reduce((acc: { motivo: string; count: number }[], cur) => {
      const ex = acc.find((a) => a.motivo === cur.motivo);
      if (ex) ex.count += cur.count;
      else acc.push({ ...cur });
      return acc;
    }, [])
    .map((i) => ({ ...i, pct: total > 0 ? Math.round((i.count / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    itens,
    total,
    semClassificacao,
    semClassificacaoPct: total > 0 ? Math.round((semClassificacao / total) * 1000) / 10 : 0,
  };
}

/**
 * Ciclo médio (dias) dos ganhos no período. Conta do momento em que o LEAD caiu no
 * CRM (leads.created_at) até o ganho — decisão Kauã 21/07 ("tem que levar em conta
 * o momento que o lead cai no CRM até o momento que é ganho"). Antes contava só da
 * criação do NEGÓCIO (pós-qualificação), subestimando o ciclo real. Fallback pro
 * created_at do negócio quando não há lead vinculado.
 */
const CICLO_LEAD_ATE_GANHO = sql<number>`avg(CASE WHEN ${negocios.ganhoAt} >= COALESCE(${leads.createdAt}, ${negocios.createdAt}) THEN extract(epoch from ${negocios.ganhoAt} - COALESCE(${leads.createdAt}, ${negocios.createdAt})) / 86400 END)`;

export async function getCicloMedio(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
  safra?: Safra,
): Promise<number | null> {
  const [r] = await db
    .select({
      ciclo: CICLO_LEAD_ATE_GANHO,
    })
    .from(negocios)
    .leftJoin(leads, eq(negocios.leadId, leads.id))
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "ganho"),
      isNotNull(negocios.ganhoAt),
      gte(negocios.ganhoAt, since),
      lt(negocios.ganhoAt, until),
      scopeResp(responsavelId),
      scopeSafra(safra),
    ));
  return r?.ciclo != null ? Math.round(Number(r.ciclo) * 10) / 10 : null;
}

export interface FechadoPeriodo {
  ganhos: number;
  receita: number; // SUM(valorTotal) dos ganhos no período
  recorrente: number;
  avulso: number;
}

/** Fechado (ganho) no período, particionado por tipoReceita. Por ganhoAt. */
export async function getFechadoPeriodo(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
  safra?: Safra,
): Promise<FechadoPeriodo> {
  const rows = await db
    .select({
      tipoReceita: negocios.tipoReceita,
      total: count(),
      mrr: sum(VALOR_MRR_VENDIDO),
      setup: sum(VALOR_NAO_RECORRENTE_VENDIDO),
    })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "ganho"),
      gte(negocios.ganhoAt, since),
      lt(negocios.ganhoAt, until),
      scopeResp(responsavelId),
      scopeSafra(safra),
    ))
    .groupBy(negocios.tipoReceita);

  // recorrente = MRR (mensalidade) dos ganhos, NÃO valor_total (que é o total do
  // contrato e inflava). avulso/projeto (sem MRR) usa o valor cheio do projeto/one-time
  // — senão negócio 100% avulso ("projeto") nunca contava em lugar nenhum.
  const recorrente = rows.reduce((s, r) => s + num(r.mrr), 0);
  const avulso = rows.reduce((s, r) => s + num(r.setup), 0);
  const ganhos = rows.reduce((s, r) => s + num(r.total), 0);
  return { ganhos, receita: recorrente + avulso, recorrente, avulso };
}

export interface FechadoResponsavel {
  responsavelId: string;
  ganhos: number;
  receita: number; // MESMA regra do total (recorrente = mrr_fechado; avulso/projeto = valor_total)
  recorrente: number;
  avulso: number;
  cicloMedio: number | null;
}

/**
 * Fechado no período POR RESPONSÁVEL — mesma janela (`ganho_at`) e mesma regra de
 * receita de `getFechadoPeriodo`, então a soma das linhas SEMPRE bate com o total.
 * (Auditoria 21/07, itens 6/7: /equipe usava janela `created_at` + `valor_total`,
 * fazendo a receita individual da closer passar da receita total do período.)
 */
export async function getFechadoPorResponsavel(
  orgId: string,
  since: Date,
  until: Date,
): Promise<Map<string, FechadoResponsavel>> {
  const rows = await db
    .select({
      responsavelId: negocios.responsavelId,
      tipoReceita: negocios.tipoReceita,
      total: count(),
      mrr: sum(VALOR_MRR_VENDIDO),
      setup: sum(VALOR_NAO_RECORRENTE_VENDIDO),
      ciclo: CICLO_LEAD_ATE_GANHO, // lead caiu no CRM → ganho (mesma régua do getCicloMedio)
    })
    .from(negocios)
    .leftJoin(leads, eq(negocios.leadId, leads.id))
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "ganho"),
      gte(negocios.ganhoAt, since),
      lt(negocios.ganhoAt, until),
      isNotNull(negocios.responsavelId),
    ))
    .groupBy(negocios.responsavelId, negocios.tipoReceita);

  const map = new Map<string, FechadoResponsavel>();
  for (const r of rows) {
    const id = r.responsavelId!;
    const cur = map.get(id) ?? { responsavelId: id, ganhos: 0, receita: 0, recorrente: 0, avulso: 0, cicloMedio: null };
    const n = num(r.total);
    cur.ganhos += n;
    cur.recorrente += num(r.mrr);
    cur.avulso += num(r.setup);
    cur.receita = cur.recorrente + cur.avulso;
    // média ponderada do ciclo entre os grupos (recorrente/avulso) do mesmo responsável
    if (r.ciclo != null) {
      const atual = cur.cicloMedio != null ? cur.cicloMedio : 0;
      const pesoAtual = cur.ganhos - n;
      cur.cicloMedio = Math.round(((atual * pesoAtual + Number(r.ciclo) * n) / cur.ganhos) * 10) / 10;
    }
    map.set(id, cur);
  }
  return map;
}

export interface FunilEtapa {
  status: string;
  label: string;
  atingiu: number; // negócios nesta etapa ou além (cumulativo) — funil decrescente
  taxaDoAnterior: number | null; // % de conversão da etapa anterior pra esta
}

/**
 * Funil de conversão do pipeline do closer: reunião agendada → realizada → proposta
 * → negociação → Ganho. Mostra onde os negócios morrem.
 * Abertos = snapshot atual por etapa; Ganho = ganhos no período (mesma pegada do funil
 * SDR e do funil de vendas do /marketing). Perdidos ficam fora (são a "morte").
 */
export async function getFunilConversao(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
  safra?: Safra,
): Promise<{ etapas: FunilEtapa[] }> {
  // Por EVENTO, nas 4 etapas canônicas: quantos negócios distintos ATINGIRAM cada
  // etapa (ou uma posterior) na janela, mais os ganhos da janela. Antes misturava
  // o snapshot de `negocios.status` com 11 status legados (aparecia "ativo",
  // "outra_data" e "trava_negociacao" como etapa do funil).
  const idx: Record<string, number> = {
    entrada: 0, reuniao_agendada: 0, diagnostico: 1, reuniao_realizada: 1, trial: 1,
    proposta: 2, proposta_apresentada: 2, negociacao: 3, negociacao_iniciada: 3,
  };
  const casos = Object.entries(idx).map(([k, v]) => `WHEN '${k}' THEN ${v}`).join(" ");
  const [rows, [g]] = await Promise.all([
    db.execute<{ nivel: string; n: string }>(sql`
      SELECT nivel::text, count(*)::text AS n FROM (
        SELECT sc.negocio_id, max(CASE sc.para_status ${sql.raw(casos)} END) AS nivel
          FROM status_changes sc JOIN negocios n ON n.id = sc.negocio_id
         WHERE n.organizacao_id = ${orgId}::uuid
           AND sc.created_at >= ${since.toISOString()}::timestamptz AND sc.created_at < ${until.toISOString()}::timestamptz
           AND sc.para_status IN (${sql.raw(Object.keys(idx).map((k) => `'${k}'`).join(","))})
           ${responsavelId ? sql`AND n.responsavel_id = ${responsavelId}::uuid` : sql``}
           ${safra === "legado" ? sql`AND n.zoho_id IS NOT NULL` : safra === "nativo" ? sql`AND n.zoho_id IS NULL` : sql``}
         GROUP BY sc.negocio_id) t
       GROUP BY nivel`),
    db.select({ total: count() }).from(negocios).where(and(
      eq(negocios.organizacaoId, orgId), eq(negocios.status, "ganho"),
      gte(negocios.ganhoAt, since), lt(negocios.ganhoAt, until), scopeResp(responsavelId), scopeSafra(safra),
    )),
  ]);
  const porNivel = [0, 0, 0, 0];
  for (const r of rows) { const i = Number(r.nivel); if (i >= 0 && i < 4) porNivel[i] = num(r.n); }
  const ganhos = num(g?.total);
  const etapas: FunilEtapa[] = ETAPAS_DO_FUNIL.map(({ key, label }, i) => ({
    status: key, label,
    // quem ganhou passou por todas as etapas, mesmo sem evento na janela (ganho
    // vindo de migração/atalho): o piso mantém o funil monotônico.
    atingiu: Math.max(porNivel.slice(i).reduce((a2, b2) => a2 + b2, 0), ganhos),
    taxaDoAnterior: null as number | null,
  }));
  etapas.push({ status: "ganho", label: "Ganho", atingiu: ganhos, taxaDoAnterior: null });
  for (let i = 1; i < etapas.length; i++) {
    const prev = etapas[i - 1].atingiu;
    etapas[i].taxaDoAnterior = prev > 0 ? Math.round((etapas[i].atingiu / prev) * 1000) / 10 : null;
  }
  return { etapas };
}

/**
 * Leads qualificados no período = leads que passaram pelo funil de pré-vendas e
 * tiveram call agendada (= viraram negócio). Conta leads DISTINTOS com negócio
 * criado no período (a criação do negócio é o ponto "reunião agendada"). Respeita o papel.
 */
export async function getLeadsQualificados(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
  safra?: Safra,
): Promise<number> {
  const rows = await db
    .selectDistinct({ leadId: negocios.leadId })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      isNotNull(negocios.leadId),
      gte(negocios.createdAt, since),
      lt(negocios.createdAt, until),
      scopeResp(responsavelId),
      scopeSafra(safra),
    ));
  return rows.length;
}

/** Ticket médio dos ganhos no período. null se não há ganhos. */
export async function getTicketMedio(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
  safra?: Safra,
): Promise<number | null> {
  const f = await getFechadoPeriodo(orgId, since, until, responsavelId, safra);
  return f.ganhos > 0 ? Math.round((f.receita / f.ganhos) * 100) / 100 : null;
}

export interface NegocioEsfriando {
  id: string;
  titulo: string;
  status: string;
  valor: number;
  diasParado: number;
}

/**
 * Negócios abertos sem movimento há >= diasMin dias (os mais parados primeiro).
 * "Esfriando" = risco de morrer no pipeline. Respeita o escopo do papel.
 */
export async function getPipelineEsfriando(
  orgId: string,
  responsavelId: string | null | undefined,
  diasMin = 5,
  limite = 15,
  safra?: Safra,
): Promise<NegocioEsfriando[]> {
  const corte = new Date(Date.now() - diasMin * 86400000);
  const rows = await db
    .select({ id: negocios.id, titulo: negocios.titulo, status: negocios.status, valor: negocios.valorTotal, updatedAt: negocios.updatedAt })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      inArray(negocios.status, PIPELINE_ATIVO_STATUSES),
      lt(negocios.updatedAt, corte),
      scopeResp(responsavelId),
      scopeSafra(safra),
    ))
    .orderBy(asc(negocios.updatedAt))
    .limit(limite);

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    status: r.status,
    valor: num(r.valor),
    diasParado: Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / 86400000),
  }));
}

export interface CoberturaEtapa {
  status: string;
  total: number;
  comValor: number;
  pct: number; // % de negócios com valorTotal > 0
}

/**
 * Cobertura de valor por etapa (COM-10/12): % de negócios abertos com valorTotal > 0
 * em cada etapa do pipeline ativo. Snapshot de agora (não filtra período — mesma
 * régua do getPipelineAtual). Serve pra medir se a trava do COM-10 (negocios.ts,
 * bloqueia avançar pra Proposta Enviada sem valor) está funcionando pra frente —
 * não mistura com a safra legada, que a Fase 0 trata à parte.
 */
export async function getCoberturaValorPorEtapa(
  orgId: string,
  responsavelId?: string | null,
  safra?: Safra,
): Promise<CoberturaEtapa[]> {
  // Mesma fonte do pipeline do topo (`oportunidades` abertas): antes lia
  // `negocios.status`, que não tem as etapas do funil canônico.
  const rows = await db.execute<{ etapa: string; total: string; com_valor: string }>(sql`
    SELECT o.etapa, count(*)::text AS total, count(*) FILTER (WHERE o.valor > 0)::text AS com_valor
      FROM oportunidades o
      LEFT JOIN negocios n ON n.id = o.negocio_id_legado
     WHERE o.organizacao_id = ${orgId}::uuid AND o.ganho_at IS NULL AND o.perdido_at IS NULL
       ${responsavelId ? sql`AND o.responsavel_id = ${responsavelId}::uuid` : sql``}
       ${safra === "legado" ? sql`AND n.zoho_id IS NOT NULL` : safra === "nativo" ? sql`AND n.zoho_id IS NULL` : sql``}
     GROUP BY o.etapa`);
  return ETAPAS_DO_FUNIL.map(({ key }) => {
    const r = rows.find((x) => x.etapa === key);
    const total = num(r?.total);
    const comValor = num(r?.com_valor);
    return { status: key, total, comValor, pct: total > 0 ? Math.round((comValor / total) * 1000) / 10 : 0 };
  });
}
