/**
 * Commercial Core v2 (ADR-EXEC-021) — Checkout como entidade própria.
 *
 * Correção do comportamento legado: criar/enviar proposta NÃO gera mais
 * checkout automaticamente (isso presumia que o cliente já tinha decidido
 * comprar). Checkout só nasce quando existe intenção comercial suficiente:
 *  - automático, logo após o cliente ACEITAR a proposta (grupo sem contrato
 *    exigido — ver aceitarPropostaPublica);
 *  - manual, quando o vendedor já tem o aceite verbal/em reunião e só
 *    precisa formalizar + entregar o link de pagamento (ação explícita,
 *    auditada, nunca marca Won sozinha).
 *
 * Tecnicamente: Stripe Checkout HOSTED (redirect) via API REST — mesma
 * integração já usada e comprovada (sem SDK, Bearer token). Decisão
 * consciente de NÃO migrar pra Embedded Checkout/Elements agora: não há
 * publishable key nem @stripe/stripe-js no projeto (verificado antes de
 * escrever este módulo) — trocar exigiria nova infra de chave pública +
 * dependência client-side, fora do escopo "não invente, use o que já existe
 * e está provado". Fica registrado como possível evolução futura.
 */
import { db } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import {
  checkouts, propostas, propostaGrupoComercial, propostaGrupoComercialItens, propostaItens, servicosCatalogo, catalogoPrecos, leads, empresas, negocios,
} from "@/lib/db/schema";
import { createGroupCheckout, createStripeCustomer, expireCheckoutSession, getStripeCheckoutMode, type CheckoutItem } from "@/lib/integrations/stripe-checkout";
import { publicarEvento } from "@/lib/events/outbox";
import { vincularCheckoutAoGrupo } from "@/lib/crm/grupo-comercial";
import { montarMetadataComercial } from "@/lib/crm/metadata-comercial";

export type CriarCheckoutResult =
  | { ok: true; checkoutId: string; url: string }
  | { ok: false; error: string };

/**
 * Checkout em modo subscription sempre cria uma assinatura nova no Stripe.
 * Portanto ele serve para aquisição; expansão recorrente precisa alterar a
 * assinatura existente de forma explícita, com a política de proration e
 * cobrança aprovada. Nunca usamos o checkout de aquisição como atalho.
 */
export function bloqueioNovoCheckoutDeAssinatura(
  commercialMotion: string | null | undefined,
  temItemRecorrente: boolean,
): string | null {
  if (!temItemRecorrente || !commercialMotion || commercialMotion === "NEW_BUSINESS") return null;
  return "Esta venda altera uma assinatura existente. O checkout de nova assinatura foi bloqueado para evitar cobrança duplicada; conclua pela alteração de assinatura aprovada.";
}

/**
 * Cria (ou re-gera, expirando o anterior) um checkout Stripe pro grupo
 * comercial informado. `origem` distingue o gatilho automático (pós-aceite)
 * do manual (vendedor) — nunca marca Won, nunca presume pagamento.
 */
export async function criarCheckoutParaGrupo(opts: {
  grupoId: string;
  origem: "automatico_pos_aceite" | "manual_vendedor";
  criadoPorId?: string | null;
}): Promise<CriarCheckoutResult> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, opts.grupoId)).limit(1);
  if (!grupo) return { ok: false, error: "Grupo comercial não encontrado" };
  if (!["aguardando_checkout", "checkout_gerado"].includes(grupo.status)) {
    return { ok: false, error: `Este grupo está em '${grupo.status}' — checkout só pode ser gerado quando o requisito anterior (ex: contrato assinado) já foi cumprido.` };
  }

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, grupo.propostaId)).limit(1);
  if (!proposta) return { ok: false, error: "Proposta não encontrada" };
  const [negocio] = proposta.negocioId
    ? await db.select({ commercialMotion: negocios.commercialMotion }).from(negocios).where(eq(negocios.id, proposta.negocioId)).limit(1)
    : [undefined];

  const itensDoGrupo = await db
    .select({
      nome: propostaItens.nome, tipo: propostaItens.tipo, quantidade: propostaItens.quantidade,
      subtotal: propostaItens.subtotal, servicoCatalogoId: propostaItens.servicoCatalogoId,
      stripePriceId: catalogoPrecos.stripePriceId,
      stripeProductId: servicosCatalogo.stripeProductId,
      valorTabela: catalogoPrecos.valor,
      moeda: catalogoPrecos.moeda,
      recorrente: catalogoPrecos.recorrente,
      precoAtivo: catalogoPrecos.ativo,
      produtoAtivo: servicosCatalogo.ativo,
      origemCatalogo: servicosCatalogo.origemCatalogo,
    })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaItens, eq(propostaGrupoComercialItens.propostaItemId, propostaItens.id))
    .leftJoin(servicosCatalogo, eq(propostaItens.servicoCatalogoId, servicosCatalogo.id))
    .leftJoin(catalogoPrecos, eq(propostaItens.catalogoPrecoId, catalogoPrecos.id))
    .where(eq(propostaGrupoComercialItens.grupoId, opts.grupoId))
    .orderBy(asc(propostaItens.ordem));

  if (itensDoGrupo.length === 0) return { ok: false, error: "Grupo comercial sem itens" };
  const bloqueioAssinatura = bloqueioNovoCheckoutDeAssinatura(
    negocio?.commercialMotion,
    itensDoGrupo.some((item) => item.tipo === "recorrente"),
  );
  if (bloqueioAssinatura) return { ok: false, error: bloqueioAssinatura };

  const [lead] = await db.select({
    id: leads.id, nome: leads.nome, sobrenome: leads.sobrenome, email: leads.email, telefone: leads.telefone,
    empresa: leads.empresa, empresaId: leads.empresaId, empresaCnpj: leads.empresaCnpj, stripeCustomerId: leads.stripeCustomerId,
  }).from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
  const [empresa] = lead?.empresaId
    ? await db.select({ id: empresas.id, nome: empresas.nome, cnpj: empresas.cnpj, telefone: empresas.telefone, endereco: empresas.endereco, cep: empresas.cep, cidade: empresas.cidade, estado: empresas.estado, pais: empresas.pais, stripeCustomerId: empresas.stripeCustomerId })
      .from(empresas).where(eq(empresas.id, lead.empresaId)).limit(1)
    : [undefined];

  let modoStripe: ReturnType<typeof getStripeCheckoutMode>;
  try {
    modoStripe = getStripeCheckoutMode();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  const customerIdsBrutos = [empresa?.stripeCustomerId, lead?.stripeCustomerId].filter((id): id is string => !!id);
  const customerIds = customerIdsBrutos.filter((id) => {
    if (modoStripe === "mock") return id.startsWith("cus_mock_");
    if (modoStripe === "test") return id.startsWith("cus_test_");
    return !id.startsWith("cus_test_") && !id.startsWith("cus_mock_");
  });
  if (new Set(customerIds).size > 1) return { ok: false, error: "Empresa e contato possuem Stripe Customers diferentes. Resolva o vínculo manualmente antes de cobrar." };

  const metadata = await montarMetadataComercial(opts.grupoId);
  if (!metadata) return { ok: false, error: "Não foi possível montar a metadata comercial do grupo." };
  let customerId: string;
  try {
    const customer = await createStripeCustomer({
      customerId: customerIds[0] || null,
      name: empresa?.nome || [lead?.nome, lead?.sobrenome].filter(Boolean).join(" ") || lead?.empresa || "Cliente Callface",
      email: lead?.email,
      phone: empresa?.telefone || lead?.telefone,
      address: {
        line1: empresa?.endereco,
        city: empresa?.cidade,
        state: empresa?.estado,
        postalCode: empresa?.cep,
        country: empresa?.pais || "BR",
      },
      metadata,
    });
    customerId = customer.id;
    if (!empresa?.stripeCustomerId && empresa?.id) await db.update(empresas).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(empresas.id, empresa.id));
    if (!lead?.stripeCustomerId && lead?.id) await db.update(leads).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(leads.id, lead.id));
  } catch (err) {
    return { ok: false, error: `Falha ao preparar Stripe Customer: ${String(err)}` };
  }

  const mapItem = (i: (typeof itensDoGrupo)[number]): CheckoutItem => {
    const quantidade = Math.max(1, Math.round(parseFloat(i.quantidade || "1") || 1));
    const subtotal = parseFloat(i.subtotal || "0");
    if (!i.stripePriceId || !i.stripeProductId || !i.moeda || i.valorTabela == null || !i.precoAtivo || !i.produtoAtivo || i.origemCatalogo !== "oficial_stripe") {
      throw new Error(`O item '${i.nome}' não está vinculado a um Price oficial ativo do catálogo.`);
    }
    const valorUnitario = quantidade > 0 ? subtotal / quantidade : subtotal;
    if (valorUnitario > parseFloat(i.valorTabela) + 0.01) throw new Error(`O valor negociado do item '${i.nome}' excede o Price oficial; revise a proposta.`);
    const esperadoRecorrente = i.tipo === "recorrente";
    if (Boolean(i.recorrente) !== esperadoRecorrente) throw new Error(`O Price oficial do item '${i.nome}' não corresponde ao tipo ${i.tipo}.`);
    return { nome: i.nome, valorUnitario, valorTabela: parseFloat(i.valorTabela), quantidade, stripePriceId: i.stripePriceId, stripeProductId: i.stripeProductId, moeda: i.moeda };
  };
  let itensRecorrentes: CheckoutItem[];
  let itensAvulsos: CheckoutItem[];
  try {
    itensRecorrentes = itensDoGrupo.filter((i) => i.tipo === "recorrente").map(mapItem);
    itensAvulsos = itensDoGrupo.filter((i) => i.tipo !== "recorrente").map(mapItem);
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  // Re-geração: expira qualquer sessão ainda aberta desse grupo (valores podem ter mudado).
  if (grupo.checkoutId) {
    const [checkoutAnterior] = await db.select().from(checkouts).where(eq(checkouts.id, grupo.checkoutId)).limit(1);
    if (checkoutAnterior?.stripeSessionId && ["criado", "aberto"].includes(checkoutAnterior.status)) {
      await expireCheckoutSession(checkoutAnterior.stripeSessionId).catch((e) => console.error(`[checkout] falha ao expirar sessão anterior do grupo ${opts.grupoId}:`, e));
    }
  }

  const base = process.env.NEXTAUTH_URL || "https://crm.callface.io";
  let sessionId: string, url: string;
  try {
    const session = await createGroupCheckout({
      propostaId: proposta.id, negocioId: proposta.negocioId, grupoComercialId: opts.grupoId, organizacaoId: proposta.organizacaoId,
      moeda: proposta.moeda || "BRL", itensRecorrentes, itensAvulsos, customerId, metadata,
      attemptKey: grupo.checkoutId || "initial",
      successUrl: process.env.CHECKOUT_SUCCESS_URL || `${base}/p/${proposta.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: process.env.CHECKOUT_CANCEL_URL || `${base}/p/${proposta.id}?checkout=cancelled`,
    });
    sessionId = session.sessionId;
    url = session.url;
  } catch (err) {
    return { ok: false, error: `Falha ao gerar checkout no Stripe: ${String(err)}` };
  }

  const [checkout] = await db.insert(checkouts).values({
    organizacaoId: proposta.organizacaoId,
    propostaId: proposta.id,
    negocioId: proposta.negocioId,
    grupoComercialId: opts.grupoId,
    origem: opts.origem,
    criadoPorId: opts.criadoPorId ?? null,
    stripeSessionId: sessionId,
    stripeCheckoutUrl: url,
    stripeCustomerId: customerId,
    status: "criado",
    paymentStatus: "pendente",
    metadata,
    expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).returning();

  await vincularCheckoutAoGrupo(opts.grupoId, checkout.id);

  // Compatibilidade de leitura: propostas antigas e telas que ainda olham o
  // campo raiz passam a apontar para a bridge desta tentativa. O valor real
  // do Stripe continua em checkouts.stripeCheckoutUrl.
  await db.update(propostas).set({
    checkoutUrl: `${base}/checkout/${checkout.id}`,
    stripeSessionId: sessionId,
    updatedAt: new Date(),
  }).where(eq(propostas.id, proposta.id));

  await publicarEvento({
    organizacaoId: proposta.organizacaoId,
    eventType: "CheckoutCreated",
    aggregateType: "checkout",
    aggregateId: checkout.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, grupoComercialId: opts.grupoId, origem: opts.origem, criadoPorId: opts.criadoPorId ?? null },
  });

  return { ok: true, checkoutId: checkout.id, url };
}

/** Chamado no GET da página pública /checkout/{id} — best-effort, não bloqueia a navegação. */
export async function registrarAberturaCheckout(checkoutId: string): Promise<void> {
  const [checkout] = await db.select().from(checkouts).where(eq(checkouts.id, checkoutId)).limit(1);
  if (!checkout) return;
  if (!checkout.aberturaEm) {
    await db.update(checkouts).set({ aberturaEm: new Date(), status: checkout.status === "criado" ? "aberto" : checkout.status }).where(eq(checkouts.id, checkoutId));
  }
  await publicarEvento({
    organizacaoId: checkout.organizacaoId,
    eventType: "CheckoutOpened",
    aggregateType: "checkout",
    aggregateId: checkoutId,
    payload: { propostaId: checkout.propostaId, grupoComercialId: checkout.grupoComercialId },
  });
}

export async function buscarCheckoutPorSessionId(stripeSessionId: string) {
  const [checkout] = await db.select().from(checkouts).where(eq(checkouts.stripeSessionId, stripeSessionId)).limit(1);
  return checkout ?? null;
}
