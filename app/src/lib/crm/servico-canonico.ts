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
import { eq, and, sql } from "drizzle-orm";
import { negocios, oportunidades, oportunidadeItens, servicosCanonicos, propostaGrupoComercial, checkouts } from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { chaveCanonicaDoItem, valoresDoServico } from "@/lib/crm/regras-pos-ganho";
import { efeitoDaVenda, servicosSubstituidos, servicoRenovado, type EfeitoDaVenda } from "@/lib/crm/upgrade-cross-sell";

type OportunidadeItemRow = typeof oportunidadeItens.$inferSelect;

/** Upsert de UM item -> serviço canônico. Compartilhado pelos dois pontos de materialização (manual e via grupo). */
async function materializarItem(item: OportunidadeItemRow, ctx: { organizacaoId: string; empresaId: string | null; leadId: string | null; negocioId: string; contratoId: string | null; wonAt: Date; stripeSubscriptionId: string | null; itensMrrNoLote: number; efeito?: EfeitoDaVenda }): Promise<string> {
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
    .select({ id: servicosCanonicos.id, produto: servicosCanonicos.canonicalProduct, valor: servicosCanonicos.currentRecurringValue, evidence: servicosCanonicos.evidence })
    .from(servicosCanonicos)
    .where(and(eq(servicosCanonicos.organizacaoId, ctx.organizacaoId), eq(servicosCanonicos.canonicalKey, canonicalKey)))
    .limit(1);

  let servicoId: string;
  if (existente) {
    servicoId = existente.id;
    // Upgrade/downgrade que cai na MESMA linha (mesma assinatura, um item recorrente): o serviço passa a refletir
    // o que o cliente tem hoje, e o que ele tinha fica registrado aqui, nunca perdido.
    const prev = (existente.evidence ?? {}) as { historico?: unknown[] };
    const mudou = existente.produto !== valores.canonicalProduct || parseFloat(existente.valor ?? "0") !== parseFloat(valores.currentRecurringValue ?? "0");
    if ((ctx.efeito === "UPGRADE" || ctx.efeito === "DOWNGRADE") && mudou) {
      valores.evidence = { ...valores.evidence, historico: [...(prev.historico ?? []), { produto: existente.produto, valor: existente.valor, ate: ctx.wonAt.toISOString(), efeito: ctx.efeito }] } as typeof valores.evidence;
    }
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


type CtxLote = Parameters<typeof materializarItem>[1];

/** O que a venda É para o serviço: soma, substitui ou renova. Uma só leitura, usada por todos os pontos pós-Ganho. */
export async function contextoDaVenda(negocioId: string, propostaId?: string | null) {
  const [n] = await db.execute<{ organizacao_id: string; empresa_id: string | null; motion: string | null; tipo_venda: string | null; servico_origem_id: string | null }>(sql`
    SELECT organizacao_id::text, empresa_id::text, commercial_motion AS motion, campos_custom->>'tipo_venda' AS tipo_venda, servico_origem_id::text
      FROM negocios WHERE id = ${negocioId}::uuid`);
  if (!n) return null;
  const [p] = await db.execute<{ tipo_contratual: string | null; contrato_base_id: string | null }>(sql`
    SELECT tipo_contratual, contrato_base_id::text FROM propostas
     WHERE organizacao_id = ${n.organizacao_id}::uuid
       AND ${propostaId ? sql`id = ${propostaId}::uuid` : sql`negocio_id = ${negocioId}::uuid AND status = 'aceita'`}
     ORDER BY updated_at DESC LIMIT 1`);
  const efeito = efeitoDaVenda({ motion: n.motion, tipoVenda: n.tipo_venda, tipoContratual: p?.tipo_contratual ?? null });
  return { organizacaoId: n.organizacao_id, empresaId: n.empresa_id, efeito, origemId: n.servico_origem_id, contratoBaseId: p?.contrato_base_id ?? null };
}

/** Renovação ganha NÃO cria serviço, entrega nem recebível. Usado pelos guardas de pós-venda e pendência. */
export async function ehRenovacao(negocioId: string | null | undefined, propostaId?: string | null): Promise<boolean> {
  if (!negocioId) return false;
  return (await contextoDaVenda(negocioId, propostaId))?.efeito === "RENOVACAO";
}

const listaDeIds = (ids: string[]) => sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);

/**
 * Materializa o lote da venda (um serviço por item, em série: select-then-insert em paralelo para a mesma
 * chave estourava o índice único) aplicando o efeito da venda:
 *  - RENOVACAO: item cuja família o cliente já tem ATIVA não vira serviço novo (só se liga ao existente);
 *  - UPGRADE/DOWNGRADE: depois de criar o novo, o serviço recorrente que ele troca vira SUPERSEDED.
 */
async function materializarLote(itens: OportunidadeItemRow[], ctx: CtxLote, propostaId?: string | null): Promise<{ servicoIds: string[]; renovacao?: boolean }> {
  const venda = await contextoDaVenda(ctx.negocioId, propostaId);
  const efeito = venda?.efeito ?? "SOMA";
  let aMaterializar = itens;

  if (efeito === "RENOVACAO" && ctx.empresaId) {
    const ativos = await db.execute<{ id: string; family: string; produto: string | null; contrato_id: string | null }>(sql`
      SELECT id::text, service_family AS family, canonical_product AS produto, contrato_id::text
        FROM servicos_canonicos
       WHERE organizacao_id = ${ctx.organizacaoId}::uuid AND empresa_id = ${ctx.empresaId}::uuid AND commercial_lifecycle = 'ACTIVE'`);
    aMaterializar = [];
    for (const item of itens) {
      const cobre = servicoRenovado(item.produto, ativos.filter((a) => a.family === item.serviceFamily).map((a) => ({ id: a.id, canonicalProduct: a.produto, contratoId: a.contrato_id })));
      if (!cobre) { aMaterializar.push(item); continue; }
      if (!item.servicoCanonicoId) await db.update(oportunidadeItens).set({ servicoCanonicoId: cobre, updatedAt: new Date() }).where(eq(oportunidadeItens.id, item.id));
    }
  }

  const feitos: { item: OportunidadeItemRow; servicoId: string }[] = [];
  for (const item of aMaterializar) feitos.push({ item, servicoId: await materializarItem(item, { ...ctx, efeito }) });

  if ((efeito === "UPGRADE" || efeito === "DOWNGRADE") && venda?.empresaId) {
    await substituirServicos({ ...venda, empresaId: venda.empresaId, efeito, ctx, feitos });
  }
  return { servicoIds: feitos.map((f) => f.servicoId), renovacao: efeito === "RENOVACAO" };
}

async function substituirServicos(p: {
  organizacaoId: string; empresaId: string; efeito: "UPGRADE" | "DOWNGRADE"; origemId: string | null; contratoBaseId: string | null;
  ctx: CtxLote; feitos: { item: OportunidadeItemRow; servicoId: string }[];
}) {
  const mrr = p.feitos.filter((f) => f.item.revenueNature === "MRR");
  const familias = [...new Set(mrr.map((f) => f.item.serviceFamily))];
  const novosIds = p.feitos.map((f) => f.servicoId);
  for (const familia of familias) {
    const dosNovos = mrr.filter((f) => f.item.serviceFamily === familia);
    const candidatos = await db.execute<{ id: string; canonical_product: string | null; contrato_id: string | null }>(sql`
      SELECT id::text, canonical_product, contrato_id::text FROM servicos_canonicos
       WHERE organizacao_id = ${p.organizacaoId}::uuid AND empresa_id = ${p.empresaId}::uuid
         AND service_family = ${familia} AND revenue_nature = 'MRR' AND commercial_lifecycle = 'ACTIVE'
         AND id NOT IN (${listaDeIds(novosIds)})`);
    const { ids, motivo } = servicosSubstituidos({
      origemId: p.origemId, contratoBaseId: p.contratoBaseId,
      produtosNovos: dosNovos.map((f) => f.item.produto),
      candidatos: candidatos.map((c) => ({ id: c.id, canonicalProduct: c.canonical_product, contratoId: c.contrato_id })),
    });
    const novoId = dosNovos[0].servicoId;
    const marca = { efeito: p.efeito, motivo, em: p.ctx.wonAt.toISOString(), negocioId: p.ctx.negocioId };
    if (ids.length === 0) {
      // Sem vínculo inequívoco não se adivinha: o novo soma e a pendência fica visível para decisão humana.
      if (motivo === "ambiguo") {
        console.warn(`[servico-canonico] ${p.efeito} do negócio ${p.ctx.negocioId}: ${candidatos.length} serviços recorrentes de ${familia}, nenhum declarado; nada foi encerrado.`);
        await db.execute(sql`UPDATE servicos_canonicos SET evidence = evidence || ${JSON.stringify({ substituicao_pendente: { ...marca, candidatos: candidatos.map((c) => c.id) } })}::jsonb WHERE id = ${novoId}::uuid`);
      }
      continue;
    }
    await db.execute(sql`
      UPDATE servicos_canonicos
         SET commercial_lifecycle = 'SUPERSEDED', portfolio_included = false,
             evidence = COALESCE(evidence, '{}'::jsonb) || ${JSON.stringify({ substituido_por: novoId, substituicao: marca })}::jsonb,
             updated_at = now()
       WHERE organizacao_id = ${p.organizacaoId}::uuid AND commercial_lifecycle = 'ACTIVE' AND id IN (${listaDeIds(ids)})`);
    await db.execute(sql`UPDATE servicos_canonicos SET evidence = COALESCE(evidence, '{}'::jsonb) || ${JSON.stringify({ substitui: ids, substituicao: marca })}::jsonb WHERE id = ${novoId}::uuid`);
  }
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
): Promise<{ servicoIds: string[]; renovacao?: boolean }> {
  try {
    const [negocio] = await db.select({ empresaId: negocios.empresaId, leadId: negocios.leadId }).from(negocios).where(eq(negocios.id, opts.negocioId)).limit(1);
    if (!negocio) return { servicoIds: [] };

    const [oportunidade] = await db.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, opts.negocioId)).limit(1);
    if (!oportunidade) return { servicoIds: [] };

    const itens = await db.select().from(oportunidadeItens).where(eq(oportunidadeItens.oportunidadeId, oportunidade.id));
    if (itens.length === 0) return { servicoIds: [] };

    const ctx = { organizacaoId: opts.organizacaoId, empresaId: negocio.empresaId, leadId: negocio.leadId, negocioId: opts.negocioId, contratoId: opts.contratoId ?? null, wonAt: opts.wonAt, stripeSubscriptionId: opts.stripeSubscriptionId ?? null, itensMrrNoLote: itens.filter((i) => i.revenueNature === "MRR").length };
    return await materializarLote(itens, ctx);
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
export async function materializarServicosCanonicosDoGrupo(grupoComercialId: string): Promise<{ servicoIds: string[]; renovacao?: boolean }> {
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
  return materializarLote(itens, ctx, grupo.propostaId);
}
