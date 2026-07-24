/**
 * Fonte ÚNICA das métricas do relatório Comercial.
 * Topo (KpiBar/resumo) e aba (TabComercial) consomem as MESMAS funções daqui —
 * impossível um win rate / pipeline divergir do outro.
 *
 * Regras (decisões Scott 30/jun):
 * - Pipeline = snapshot da operação AGORA (negócios abertos). NÃO reage ao filtro de período.
 * - Win rate, fechado, motivos, ciclo = respeitam o período selecionado.
 * - Valor = `valorTotal` (atual). Recorrente/avulso = `tipoReceita`. (mrr_estimado/valor_projeto são legacy.)
 * - Produto: só Callface (sem dimensão de produto).
 * - Papel: closer recebe responsavelId = ele mesmo; admin/gerente/leitor = org inteira.
 */
import { db } from "@/lib/db";
import { negocios, leads } from "@/lib/db/schema";
import { and, eq, not, inArray, gte, lt, count, sum, sql, isNotNull, asc, type SQL } from "drizzle-orm";
import { DEFAULT_STAGES } from "@/lib/crm/pipeline";

// Etapas ATIVAS do pipeline (negócio aberto, em andamento). Estagnados e fechados ficam fora.
export const PIPELINE_ATIVO_STATUSES = DEFAULT_STAGES.map((s) => s.key);

// Probabilidade de fechamento por etapa — usada no forecast ponderado.
// Defaults; ajustável depois com o head comercial.
export const STAGE_PROB: Record<string, number> = {
  reuniao_agendada: 0.1,
  reuniao_realizada: 0.25,
  trial: 0.4,
  proposta_apresentada: 0.5,
  negociacao_iniciada: 0.7,
};

const num = (v: unknown): number => Number(v ?? 0) || 0;

/** Escopo por responsável: closer vê só os negócios dele; admin/etc vê tudo. */
function scopeResp(responsavelId?: string | null): SQL | undefined {
  return responsavelId ? eq(negocios.responsavelId, responsavelId) : undefined;
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
export async function getPipelineAtual(orgId: string, responsavelId?: string | null): Promise<PipelineAtual> {
  const rows = await db
    .select({
      status: negocios.status,
      tipoReceita: negocios.tipoReceita,
      total: count(),
      valor: sum(negocios.valorTotal),
    })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      inArray(negocios.status, PIPELINE_ATIVO_STATUSES),
      scopeResp(responsavelId),
    ))
    .groupBy(negocios.status, negocios.tipoReceita);

  const etapas: EtapaPipeline[] = PIPELINE_ATIVO_STATUSES.map((st) => {
    const recRows = rows.filter((r) => r.status === st);
    const recorrente = recRows.filter((r) => r.tipoReceita !== "avulso").reduce((s, r) => s + num(r.valor), 0);
    const avulso = recRows.filter((r) => r.tipoReceita === "avulso").reduce((s, r) => s + num(r.valor), 0);
    const c = recRows.reduce((s, r) => s + num(r.total), 0);
    return { status: st, count: c, recorrente, avulso, valor: recorrente + avulso };
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
 * Win rate no período = ganho / (ganho + perdido), só negócios "novo" (sem clones de carteira).
 * Expõe a amostra `n` pra sinalizar base pequena.
 */
export async function getWinRate(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
): Promise<WinRate> {
  const rows = await db
    .select({ status: negocios.status, total: count() })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      inArray(negocios.status, ["ganho", "perdido"]),
      eq(negocios.origemNegocio, "novo"),
      gte(negocios.createdAt, since),
      lt(negocios.createdAt, until),
      scopeResp(responsavelId),
    ))
    .groupBy(negocios.status);

  const ganhos = num(rows.find((r) => r.status === "ganho")?.total);
  const perdidos = num(rows.find((r) => r.status === "perdido")?.total);
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
): Promise<MotivosPerda> {
  const rows = await db
    .select({ motivo: negocios.motivoPerda, total: count() })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "perdido"),
      gte(negocios.createdAt, since),
      lt(negocios.createdAt, until),
      scopeResp(responsavelId),
    ))
    .groupBy(negocios.motivoPerda);

  const total = rows.reduce((s, r) => s + num(r.total), 0);
  const isSemClass = (m: string | null) => !m || m === "outro" || m === "nao_respondeu";
  const semClassificacao = rows.filter((r) => isSemClass(r.motivo)).reduce((s, r) => s + num(r.total), 0);

  const itens = rows
    .map((r) => ({
      motivo: r.motivo && !isSemClass(r.motivo) ? r.motivo : "Sem motivo classificado",
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
): Promise<FechadoPeriodo> {
  const rows = await db
    .select({
      tipoReceita: negocios.tipoReceita,
      total: count(),
      mrr: sum(negocios.mrrFechado),
      valor: sum(negocios.valorTotal),
    })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "ganho"),
      gte(negocios.ganhoAt, since),
      lt(negocios.ganhoAt, until),
      scopeResp(responsavelId),
    ))
    .groupBy(negocios.tipoReceita);

  // recorrente = MRR (mensalidade) dos ganhos, NÃO valor_total (que é o total do
  // contrato e inflava). avulso continua sendo o valor cheio do projeto/one-time.
  const recorrente = rows.filter((r) => r.tipoReceita !== "avulso").reduce((s, r) => s + num(r.mrr), 0);
  const avulso = rows.filter((r) => r.tipoReceita === "avulso").reduce((s, r) => s + num(r.valor), 0);
  const ganhos = rows.reduce((s, r) => s + num(r.total), 0);
  return { ganhos, receita: recorrente + avulso, recorrente, avulso };
}

export interface FechadoResponsavel {
  responsavelId: string;
  ganhos: number;
  receita: number; // MESMA regra do total (recorrente = mrr_fechado; avulso = valor_total)
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
      mrr: sum(negocios.mrrFechado),
      valor: sum(negocios.valorTotal),
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
    if (r.tipoReceita === "avulso") cur.avulso += num(r.valor);
    else cur.recorrente += num(r.mrr);
    cur.receita = cur.recorrente + cur.avulso;
    // média ponderada do ciclo entre os grupos (recorrente/avulso) do mesmo responsável
    if (r.ciclo != null) {
      const atual = cur.cicloMedio != null ? cur.cicloMedio : 0;
      const pesoAtual = cur.ganhos - n;
      cur.cicloMedio = Math.round(((atual * pesoAtual + Number(r.ciclo) * n) / cur.ganhos) * 100) / 100;
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
): Promise<{ etapas: FunilEtapa[] }> {
  const abertos = await db
    .select({ status: negocios.status, total: count() })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      inArray(negocios.status, PIPELINE_ATIVO_STATUSES),
      scopeResp(responsavelId),
    ))
    .groupBy(negocios.status);

  const [g] = await db
    .select({ total: count() })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, orgId),
      eq(negocios.status, "ganho"),
      gte(negocios.ganhoAt, since),
      lt(negocios.ganhoAt, until),
      scopeResp(responsavelId),
    ));

  const countByStatus = new Map(abertos.map((r) => [r.status, num(r.total)]));
  const ganhos = num(g?.total);
  const labelOf = (k: string) => DEFAULT_STAGES.find((s) => s.key === k)?.label ?? (k === "ganho" ? "Ganho" : k);
  const ordem = [...PIPELINE_ATIVO_STATUSES, "ganho"];

  const etapas: FunilEtapa[] = ordem.map((st, i) => {
    if (st === "ganho") return { status: st, label: "Ganho", atingiu: ganhos, taxaDoAnterior: null };
    // cumulativo: quem está nesta etapa ou em qualquer posterior, + os que ganharam
    let atingiu = ganhos;
    for (let j = i; j < PIPELINE_ATIVO_STATUSES.length; j++) {
      atingiu += countByStatus.get(PIPELINE_ATIVO_STATUSES[j]) ?? 0;
    }
    return { status: st, label: labelOf(st), atingiu, taxaDoAnterior: null };
  });

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
    ));
  return rows.length;
}

/** Ticket médio dos ganhos no período. null se não há ganhos. */
export async function getTicketMedio(
  orgId: string,
  since: Date,
  until: Date,
  responsavelId?: string | null,
): Promise<number | null> {
  const f = await getFechadoPeriodo(orgId, since, until, responsavelId);
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
