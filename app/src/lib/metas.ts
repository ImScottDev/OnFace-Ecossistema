import { db } from "@/lib/db";
import { metas, negocios, leads, reunioes, contratos, usuarios, statusChanges } from "@/lib/db/schema";
import { and, eq, gte, lt, count, sql, isNotNull, inArray } from "drizzle-orm";
import { monthRange, metaTipoPorPapel, type MetaTipo, PAPEIS_QUE_SOMAM_NA_META } from "@/lib/metas-shared";

// Reexporta a parte pura pra quem importa de "@/lib/metas" no servidor.
export { META_TIPOS, metaTipoPorPapel, monthRange } from "@/lib/metas-shared";
export type { MetaTipo } from "@/lib/metas-shared";

/**
 * Valor fechado de um negócio: mensalidade + setup.
 *
 * NÃO usa `valor_total`, que diverge da composição em 174 dos 309 negócios
 * ganhos (tem linha com total preenchido e componentes zerados, total zerado
 * com MRR preenchido, e até total negativo). A soma dos componentes é a única
 * leitura que se sustenta.
 *
 * `valor_projeto` fica de fora de propósito: é cópia literal de `valor_setup`
 * (175 de 175 linhas idênticas) — somar os dois contaria o setup duas vezes.
 */
const VALOR_FECHADO = sql<string>`COALESCE(SUM(COALESCE(mrr_fechado,0)::numeric + COALESCE(valor_setup,0)::numeric), 0)`;

// Papéis considerados "closer" (fechamento) pra meta comercial agregada.
// Fonte única com a UI de metas — ver `metas-shared.ts`.
const CLOSER_ROLES = PAPEIS_QUE_SOMAM_NA_META;

/**
 * Metas do mês corrente de todos os vendedores ativos (closer/sdr) da org.
 * Movido de dashboard/page.tsx (09/08) pra ser reusado pelo Command Center
 * novo (ranking + Insight Engine) sem duplicar a mesma query — mesmo
 * princípio de Data Governance já aplicado no resto do projeto.
 */
export async function getMetasPorVendedor(organizacaoId: string) {
  const now = new Date();
  const periodo = new Date(now.getFullYear(), now.getMonth(), 1);
  const vendedores = await db
    .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role })
    .from(usuarios)
    .where(and(
      eq(usuarios.organizacaoId, organizacaoId),
      eq(usuarios.ativo, true),
      inArray(usuarios.role, ["closer", "sdr", "vendedor"]),
    ))
    .orderBy(usuarios.nome);

  return Promise.all(vendedores.map(async (u) => {
    const tipo = metaTipoPorPapel(u.role);
    const [metasUsuario, realizado] = await Promise.all([
      getMetasDoUsuario(organizacaoId, u.id, periodo),
      getRealizadoMeta(organizacaoId, u.id, periodo, tipo),
    ]);
    const metaRow = metasUsuario.find((m) => m.tipo === tipo);
    const valorAlvo = metaRow ? parseFloat(String(metaRow.valorAlvo)) || 0 : 0;
    const pct = valorAlvo > 0 ? Math.round((realizado / valorAlvo) * 100) : 0;
    return { id: u.id, nome: u.nome, role: u.role, tipo, valorAlvo, realizado, pct };
  }));
}

/**
 * Meta comercial do mês AGREGADA = soma das metas de MRR fechado de todas as closers
 * + realizado somado (MRR recorrente fechado no mês pelas closers). Visão de gestão.
 */
export async function getMetaComercialAgregada(organizacaoId: string, periodo: string | Date) {
  const { primeiroDia, inicio, fim } = monthRange(periodo);
  const closers = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(
      eq(usuarios.organizacaoId, organizacaoId),
      inArray(usuarios.role, CLOSER_ROLES),
      eq(usuarios.ativo, true),
    ));
  const ids = closers.map((c) => c.id);
  if (ids.length === 0) return { valorAlvo: 0, realizado: 0, closers: 0 };

  // Soma as metas de faturamento do mês. Meses anteriores a 09/09/2026 só têm
  // metas do tipo antigo (`mrr_fechado`): sem o fallback, o histórico da Home
  // passaria a exibir "nenhuma meta definida" retroativamente.
  const metaRows = await db
    .select({ v: metas.valorAlvo, tipo: metas.tipo })
    .from(metas)
    .where(and(
      eq(metas.organizacaoId, organizacaoId),
      eq(metas.periodo, primeiroDia),
      inArray(metas.tipo, ["faturamento_fechado", "mrr_fechado"]),
      inArray(metas.usuarioId, ids),
    ));
  const doTipoNovo = metaRows.filter((r) => r.tipo === "faturamento_fechado");
  const usadas = doTipoNovo.length > 0 ? doTipoNovo : metaRows;
  const valorAlvo = usadas.reduce((s, r) => s + (parseFloat(String(r.v)) || 0), 0);

  const [r] = await db
    .select({ total: VALOR_FECHADO })
    .from(negocios)
    .where(and(
      eq(negocios.organizacaoId, organizacaoId),
      inArray(negocios.responsavelId, ids),
      eq(negocios.status, "ganho"),
      gte(negocios.ganhoAt, inicio),
      lt(negocios.ganhoAt, fim),
    ));
  return { valorAlvo, realizado: parseFloat(r?.total ?? "0") || 0, closers: ids.length };
}

/** Metas do usuário num mês. */
export async function getMetasDoUsuario(organizacaoId: string, usuarioId: string, periodo: string | Date) {
  const { primeiroDia } = monthRange(periodo);
  return db
    .select()
    .from(metas)
    .where(and(
      eq(metas.organizacaoId, organizacaoId),
      eq(metas.usuarioId, usuarioId),
      eq(metas.periodo, primeiroDia),
    ));
}

/**
 * Realizado de uma meta no mês. Usa as mesmas fontes que o dashboard:
 * - reunioes_agendadas: reuniões do usuário (responsavel) com data no mês.
 * - faturamento_fechado: mensalidade + setup dos negócios "ganho" do usuário no mês.
 * - mrr_fechado (legado): só a mensalidade — mantido pra ler metas antigas.
 * - leads_qualificados: leads do usuário (responsavel) que viraram negócio no mês.
 * - contratos_fechados: contratos criados no mês cujo negócio é do usuário.
 */
export async function getRealizadoMeta(
  organizacaoId: string,
  usuarioId: string,
  periodo: string | Date,
  tipo: MetaTipo,
): Promise<number> {
  const { inicio, fim } = monthRange(periodo);

  if (tipo === "reunioes_agendadas") {
    // "Reunião agendada" = a SDR qualificou o lead e ele virou oportunidade (handover →
    // status reuniao_agendada). Contamos pelo status_change (SEMPRE criado na qualificação,
    // por quem qualificou = a SDR), não pela tabela `reunioes` (que só existe se preencheu
    // data). Assim toda qualificação da SDR conta a meta — casa com "leads qualificados".
    //
    // ATRIBUIÇÃO (Scott, jul/26): só conta pra SDR que é DONA do card E marcou a reunião.
    // Se ela marcou a call de um lead que NÃO é dela (alocado a outra SDR), não entra na
    // meta dela. Por isso o join exige leads.responsavelId = usuarioId.
    const [r] = await db
      .select({ c: sql<number>`count(distinct ${statusChanges.leadId})` })
      .from(statusChanges)
      .innerJoin(leads, eq(statusChanges.leadId, leads.id))
      .where(and(
        eq(statusChanges.usuarioId, usuarioId),
        eq(leads.responsavelId, usuarioId),
        eq(statusChanges.paraStatus, "reuniao_agendada"),
        gte(statusChanges.createdAt, inicio),
        lt(statusChanges.createdAt, fim),
      ));
    return Number(r?.c ?? 0);
  }

  if (tipo === "reunioes_outbound") {
    // Reuniões agendadas SÓ de leads que vieram do OUTBOUND (origem='outbound').
    // Mesma lógica do reunioes_agendadas, filtrando o lead por origem.
    const [r] = await db
      .select({ c: sql<number>`count(distinct ${statusChanges.leadId})` })
      .from(statusChanges)
      .innerJoin(leads, eq(statusChanges.leadId, leads.id))
      .where(and(
        eq(statusChanges.usuarioId, usuarioId),
        eq(leads.responsavelId, usuarioId),
        eq(statusChanges.paraStatus, "reuniao_agendada"),
        eq(leads.origem, "outbound"),
        gte(statusChanges.createdAt, inicio),
        lt(statusChanges.createdAt, fim),
      ));
    return Number(r?.c ?? 0);
  }

  if (tipo === "faturamento_fechado") {
    // Tudo que a pessoa fechou no mês: mensalidade + setup/avulso.
    const [r] = await db
      .select({ total: VALOR_FECHADO })
      .from(negocios)
      .where(and(
        eq(negocios.organizacaoId, organizacaoId),
        eq(negocios.responsavelId, usuarioId),
        eq(negocios.status, "ganho"),
        gte(negocios.ganhoAt, inicio),
        lt(negocios.ganhoAt, fim),
      ));
    return parseFloat(r?.total ?? "0") || 0;
  }

  if (tipo === "mrr_fechado") {
    // MRR (mensalidade) novo fechado no mês. Soma mrr_fechado — NÃO valor_total,
    // que é o valor total do contrato (pode ser anual/setup) e inflava a meta.
    // Bate exatamente com o card "Fechado (mês)" do dashboard.
    const [r] = await db
      .select({ total: sql<string>`COALESCE(SUM(mrr_fechado::numeric), 0)` })
      .from(negocios)
      .where(and(
        eq(negocios.organizacaoId, organizacaoId),
        eq(negocios.responsavelId, usuarioId),
        eq(negocios.status, "ganho"),
        gte(negocios.ganhoAt, inicio),
        lt(negocios.ganhoAt, fim),
      ));
    return parseFloat(r?.total ?? "0") || 0;
  }

  if (tipo === "leads_qualificados") {
    const rows = await db
      .selectDistinct({ leadId: negocios.leadId })
      .from(negocios)
      .innerJoin(leads, eq(negocios.leadId, leads.id))
      .where(and(
        eq(negocios.organizacaoId, organizacaoId),
        eq(leads.responsavelId, usuarioId),
        isNotNull(negocios.leadId),
        gte(negocios.createdAt, inicio),
        lt(negocios.createdAt, fim),
      ));
    return rows.length;
  }

  // contratos_fechados
  const [r] = await db
    .select({ c: count() })
    .from(contratos)
    .innerJoin(negocios, eq(contratos.negocioId, negocios.id))
    .where(and(
      eq(contratos.organizacaoId, organizacaoId),
      eq(negocios.responsavelId, usuarioId),
      gte(contratos.createdAt, inicio),
      lt(contratos.createdAt, fim),
    ));
  return Number(r?.c ?? 0);
}

/** Upsert de meta (insert on conflict update no índice único org+user+periodo+tipo). */
export async function upsertMeta(params: {
  organizacaoId: string;
  usuarioId: string;
  periodo: string | Date;
  tipo: MetaTipo;
  valorAlvo: number | string;
  criadoPor: string;
}) {
  const { primeiroDia } = monthRange(params.periodo);
  const valor = String(params.valorAlvo);
  const [row] = await db
    .insert(metas)
    .values({
      organizacaoId: params.organizacaoId,
      usuarioId: params.usuarioId,
      periodo: primeiroDia,
      tipo: params.tipo,
      valorAlvo: valor,
      criadoPor: params.criadoPor,
    })
    .onConflictDoUpdate({
      target: [metas.organizacaoId, metas.usuarioId, metas.periodo, metas.tipo],
      set: { valorAlvo: valor, criadoPor: params.criadoPor, updatedAt: new Date() },
    })
    .returning();
  return row;
}
