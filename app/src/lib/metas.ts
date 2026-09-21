import { db } from "@/lib/db";
import { metas, negocios, leads, reunioes, contratos, usuarios, statusChanges } from "@/lib/db/schema";
import { and, eq, gte, lt, count, sql, isNotNull, inArray, or } from "drizzle-orm";
import { monthRange, type MetaTipo, CLOSER_EXTRA_IDS } from "@/lib/metas-shared";

// Reexporta a parte pura pra quem importa de "@/lib/metas" no servidor.
export { META_TIPOS, metaTipoPorPapel, monthRange } from "@/lib/metas-shared";
export type { MetaTipo } from "@/lib/metas-shared";

// Papéis considerados "closer" (fechamento) pra meta comercial agregada.
const CLOSER_ROLES = ["closer", "vendedor"];

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
      or(inArray(usuarios.role, CLOSER_ROLES), inArray(usuarios.id, CLOSER_EXTRA_IDS)),
      eq(usuarios.ativo, true),
    ));
  const ids = closers.map((c) => c.id);
  if (ids.length === 0) return { valorAlvo: 0, realizado: 0, closers: 0 };

  const metaRows = await db
    .select({ v: metas.valorAlvo })
    .from(metas)
    .where(and(
      eq(metas.organizacaoId, organizacaoId),
      eq(metas.periodo, primeiroDia),
      eq(metas.tipo, "mrr_fechado"),
      inArray(metas.usuarioId, ids),
    ));
  const valorAlvo = metaRows.reduce((s, r) => s + (parseFloat(String(r.v)) || 0), 0);

  const [r] = await db
    .select({ total: sql<string>`COALESCE(SUM(CASE WHEN tipo_receita IN ('avulso','projeto') THEN valor_total ELSE mrr_fechado END::numeric), 0)` })
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
 * - mrr_fechado: SUM(mrr_fechado) de negócios "ganho" do usuário no mês (card "Fechado mês").
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

  if (tipo === "mrr_fechado") {
    // MRR (mensalidade) novo fechado no mês. Recorrente/híbrido soma mrr_fechado
    // (NÃO valor_total, que é o total do contrato e inflava a meta). Projeto/avulso
    // (sem MRR) soma valor_total, senão venda 100% avulsa nunca contava pra ninguém.
    // Bate exatamente com o card "Fechado (mês)" do dashboard.
    const [r] = await db
      .select({ total: sql<string>`COALESCE(SUM(CASE WHEN tipo_receita IN ('avulso','projeto') THEN valor_total ELSE mrr_fechado END::numeric), 0)` })
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
