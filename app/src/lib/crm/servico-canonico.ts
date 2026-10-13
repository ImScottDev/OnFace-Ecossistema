/**
 * F4 (Commercial Core) — Fechamento comercial -> Serviço Canônico.
 *
 * ADR-EXEC-020: até esta entrega, NENHUM código de aplicação escrevia em
 * servicos_canonicos — só existiam as linhas importadas da reconciliação
 * histórica (Stripe/Zoho/Ledger). Este módulo é o primeiro ponto real que
 * cria/atualiza serviço canônico a partir de uma venda nova, ligando
 * oportunidade_itens -> servicos_canonicos no momento do Won.
 *
 * Regras duras (não renegociáveis, vieram do Kauã):
 *  - revenue_nature != MRR NUNCA seta current_recurring_value (SETUP e USAGE
 *    não viram MRR, nem automaticamente nem por engano).
 *  - commercial_lifecycle é sempre ACTIVE num Won novo, independente de
 *    billing_status — billing_status nunca decide lifecycle.
 *  - 1 oportunidade com N itens gera/atualiza N serviços canônicos (nunca
 *    colapsa família/natureza numa linha só).
 *
 * Idempotente por (organizacao_id, canonical_key) — select-then-branch,
 * mesmo padrão do resto do dual-write. Best-effort: falha aqui nunca
 * bloqueia o Won real (o gate de evidência já rodou antes, em won-evidence.ts
 * — isto é POSTERIOR ao negócio já estar ganho de verdade).
 */
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { negocios, oportunidades, oportunidadeItens, servicosCanonicos, propostaGrupoComercial, checkouts } from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { chaveCanonicaDoItem, valoresDoServico } from "@/lib/crm/regras-pos-ganho";

type OportunidadeItemRow = typeof oportunidadeItens.$inferSelect;

/** Upsert de UM item -> serviço canônico. Compartilhado pelos dois pontos de materialização (manual e via grupo). */
async function materializarItem(item: OportunidadeItemRow, ctx: { organizacaoId: string; empresaId: string | null; leadId: string | null; negocioId: string; contratoId: string | null; wonAt: Date; stripeSubscriptionId: string | null; itensMrrNoLote: number }): Promise<string> {
  const isMrr = item.revenueNature === "MRR";
  // STRIPE:<subscriptionId> mantém a mesma convenção da reconciliação (permite um futuro stripe-sync
  // reconciliar pela MESMA chave) quando é o único item recorrente; com vários, uma linha por item
  // (`STRIPE:<sub>:<item>`), senão o último sobrescreve os outros e o MRR vendido some. Tudo que não
  // é MRR-via-Stripe usa o prefixo CRM2:<itemId>, nunca colidindo com chaves legadas.
  const canonicalKey = chaveCanonicaDoItem({ itemId: item.id, ehMrr: isMrr, stripeSubscriptionId: ctx.stripeSubscriptionId, itensMrrNoLote: ctx.itensMrrNoLote });
  const { valorRecorrente, quantidade } = valoresDoServico(item);

  const valores = {
    organizacaoId: ctx.organizacaoId,
    empresaId: ctx.empresaId,
    leadId: ctx.leadId,
    contratoId: ctx.contratoId,
    canonicalKey,
    serviceFamily: item.serviceFamily,
    canonicalProduct: item.produto,
    revenueNature: item.revenueNature,
    billingSource: isMrr && ctx.stripeSubscriptionId ? "STRIPE" : "CRM2_COMERCIAL",
    // Lifecycle é SEMPRE ACTIVE num Won novo — não deriva de billing_status.
    commercialLifecycle: "ACTIVE",
    billingStatus: isMrr ? "ACTIVE" : "BILLED",
    // Regra dura: só MRR alimenta current_recurring_value.
    currentRecurringValue: valorRecorrente,
    quantidade,
    currentSubscriptionId: isMrr ? ctx.stripeSubscriptionId : null,
    asOfDate: ctx.wonAt.toISOString().split("T")[0],
    portfolioIncluded: true,
    confidence: "CONFIRMED" as const,
    evidence: {
      origem: "crm2_venda_nova",
      oportunidadeItemId: item.id,
      negocioId: ctx.negocioId,
      contratoId: ctx.contratoId,
      wonAt: ctx.wonAt.toISOString(),
    },
    updatedAt: new Date(),
  };

  const [existente] = await db
    .select({ id: servicosCanonicos.id })
    .from(servicosCanonicos)
    .where(and(eq(servicosCanonicos.organizacaoId, ctx.organizacaoId), eq(servicosCanonicos.canonicalKey, canonicalKey)))
    .limit(1);

  let servicoId: string;
  if (existente) {
    servicoId = existente.id;
    await db.update(servicosCanonicos).set(valores).where(eq(servicosCanonicos.id, servicoId));
  } else {
    const [novo] = await db.insert(servicosCanonicos).values(valores).returning({ id: servicosCanonicos.id });
    servicoId = novo.id;
  }

  if (item.servicoCanonicoId !== servicoId) {
    await db.update(oportunidadeItens).set({ servicoCanonicoId: servicoId, updatedAt: new Date() }).where(eq(oportunidadeItens.id, item.id));
  }

  await publicarEvento({
    organizacaoId: ctx.organizacaoId,
    eventType: "CanonicalServiceActivated",
    aggregateType: "servico",
    aggregateId: servicoId,
    payload: {
      negocioId: ctx.negocioId, oportunidadeItemId: item.id, serviceFamily: item.serviceFamily,
      revenueNature: item.revenueNature, currentRecurringValue: valores.currentRecurringValue,
    },
    idempotencyKey: `canonical-service-activated:${servicoId}:${ctx.negocioId}`,
  });

  return servicoId;
}

export interface MaterializarServicosCanonicosOpts {
  negocioId: string;
  organizacaoId: string;
  contratoId?: string | null;
  wonAt: Date;
  /** Presente só no caminho Callface AI (checkout Stripe) — ausente em PABX/White Label/manual. */
  stripeSubscriptionId?: string | null;
}

/**
 * Won 100% MANUAL (sem proposta por trás — ver garantirItemComercialManual)
 * — materializa TODOS os itens da oportunidade de uma vez, porque não existe
 * conceito de "grupo comercial" nesse caminho (não passou por proposta).
 */
export async function materializarServicosCanonicosDoNegocio(
  opts: MaterializarServicosCanonicosOpts
): Promise<{ servicoIds: string[] }> {
  try {
    const [negocio] = await db.select({ empresaId: negocios.empresaId, leadId: negocios.leadId }).from(negocios).where(eq(negocios.id, opts.negocioId)).limit(1);
    if (!negocio) return { servicoIds: [] };

    const [oportunidade] = await db.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, opts.negocioId)).limit(1);
    if (!oportunidade) return { servicoIds: [] };

    const itens = await db.select().from(oportunidadeItens).where(eq(oportunidadeItens.oportunidadeId, oportunidade.id));
    if (itens.length === 0) return { servicoIds: [] };

    const ctx = { organizacaoId: opts.organizacaoId, empresaId: negocio.empresaId, leadId: negocio.leadId, negocioId: opts.negocioId, contratoId: opts.contratoId ?? null, wonAt: opts.wonAt, stripeSubscriptionId: opts.stripeSubscriptionId ?? null, itensMrrNoLote: itens.filter((i) => i.revenueNature === "MRR").length };
    // Em série: select-then-insert em paralelo para a mesma chave estourava o índice único.
    const servicoIds: string[] = [];
    for (const item of itens) servicoIds.push(await materializarItem(item, ctx));
    return { servicoIds };
  } catch (err) {
    console.error(`[servico-canonico] falha ao materializar serviços canônicos do negócio ${opts.negocioId} (best-effort):`, err);
    return { servicoIds: [] };
  }
}

/**
 * Commercial Core v2 (ADR-EXEC-021) — materializa SÓ os itens do GRUPO
 * comercial concluído (não a oportunidade inteira): numa venda mista, o
 * grupo PABX materializa quando o SEU pagamento confirma, independente do
 * grupo Callface AI já ter materializado antes ou depois. Chamado pelo
 * consumer real do Event Outbox (FulfillmentGroupCompleted, ver
 * consumer.ts) — nunca inline best-effort na rota que confirma o pagamento.
 */
export async function materializarServicosCanonicosDoGrupo(grupoComercialId: string): Promise<{ servicoIds: string[] }> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoComercialId)).limit(1);
  if (!grupo || !grupo.negocioId) return { servicoIds: [] };

  const [negocio] = await db.select({ empresaId: negocios.empresaId, leadId: negocios.leadId }).from(negocios).where(eq(negocios.id, grupo.negocioId)).limit(1);
  if (!negocio) return { servicoIds: [] };

  // Frente 2C.1 — rede de segurança: garante família resolvida ANTES de
  // materializar. Item UNKNOWN aqui virava serviço canônico UNKNOWN, que por
  // sua vez gerava fulfillment sem checklist e fora de qualquer trilha de
  // entrega. É o último ponto onde ainda dá pra corrigir sem dado errado no
  // portfólio.
  const { calcularFamiliaDoGrupo, propagarFamiliaNosItensDoGrupo } = await import("@/lib/crm/politica-familia");
  const familiaGrupo = grupo.serviceFamily && grupo.serviceFamily !== "UNKNOWN"
    ? (grupo.serviceFamily as "PABX" | "CALLFACE_AI" | "WHITE_LABEL")
    : await calcularFamiliaDoGrupo(grupoComercialId);
  await propagarFamiliaNosItensDoGrupo(grupoComercialId, familiaGrupo);

  const itens = await db.select().from(oportunidadeItens).where(eq(oportunidadeItens.grupoComercialId, grupoComercialId));
  if (itens.length === 0) return { servicoIds: [] };

  let stripeSubscriptionId: string | null = null;
  if (grupo.checkoutId) {
    const [checkout] = await db.select({ stripeSubscriptionId: checkouts.stripeSubscriptionId }).from(checkouts).where(eq(checkouts.id, grupo.checkoutId)).limit(1);
    stripeSubscriptionId = checkout?.stripeSubscriptionId ?? null;
  }

  const ctx = {
    organizacaoId: grupo.organizacaoId, empresaId: negocio.empresaId, leadId: negocio.leadId, negocioId: grupo.negocioId,
    contratoId: grupo.contratoId, wonAt: grupo.concluidoEm ?? new Date(), stripeSubscriptionId,
    itensMrrNoLote: itens.filter((i) => i.revenueNature === "MRR").length,
  };
  const servicoIds: string[] = [];
  for (const item of itens) servicoIds.push(await materializarItem(item, ctx));
  return { servicoIds };
}
