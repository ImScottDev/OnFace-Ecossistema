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
import { eq, and, asc } from "drizzle-orm";
import {
  checkouts, propostas, propostaGrupoComercial, propostaGrupoComercialItens, propostaItens, servicosCatalogo, leads,
} from "@/lib/db/schema";
import { createGroupCheckout, expireCheckoutSession, type CheckoutItem } from "@/lib/integrations/stripe-checkout";
import { publicarEvento } from "@/lib/events/outbox";
import { vincularCheckoutAoGrupo } from "@/lib/crm/grupo-comercial";

export type CriarCheckoutResult =
  | { ok: true; checkoutId: string; url: string }
  | { ok: false; error: string };

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

  const itensDoGrupo = await db
    .select({
      nome: propostaItens.nome, tipo: propostaItens.tipo, quantidade: propostaItens.quantidade,
      subtotal: propostaItens.subtotal, servicoCatalogoId: propostaItens.servicoCatalogoId,
      stripeProductId: servicosCatalogo.stripeProductId,
    })
    .from(propostaGrupoComercialItens)
    .innerJoin(propostaItens, eq(propostaGrupoComercialItens.propostaItemId, propostaItens.id))
    .leftJoin(servicosCatalogo, eq(propostaItens.servicoCatalogoId, servicosCatalogo.id))
    .where(eq(propostaGrupoComercialItens.grupoId, opts.grupoId))
    .orderBy(asc(propostaItens.ordem));

  if (itensDoGrupo.length === 0) return { ok: false, error: "Grupo comercial sem itens" };

  const [lead] = await db.select({ email: leads.email }).from(leads).where(eq(leads.id, proposta.leadId)).limit(1);

  const mapItem = (i: (typeof itensDoGrupo)[number]): CheckoutItem => {
    const quantidade = Math.max(1, Math.round(parseFloat(i.quantidade || "1") || 1));
    const subtotal = parseFloat(i.subtotal || "0");
    return { nome: i.nome, valorUnitario: quantidade > 0 ? subtotal / quantidade : subtotal, quantidade, stripeProductId: i.stripeProductId };
  };
  const itensRecorrentes = itensDoGrupo.filter((i) => i.tipo === "recorrente").map(mapItem);
  const itensAvulsos = itensDoGrupo.filter((i) => i.tipo !== "recorrente").map(mapItem);

  // Re-geração: expira o checkout anterior desse grupo (valores podem ter mudado).
  if (grupo.checkoutId) {
    const [checkoutAnterior] = await db.select().from(checkouts).where(eq(checkouts.id, grupo.checkoutId)).limit(1);
    if (checkoutAnterior?.stripeSessionId && checkoutAnterior.status === "criado") {
      await expireCheckoutSession(checkoutAnterior.stripeSessionId).catch((e) => console.error(`[checkout] falha ao expirar sessão anterior do grupo ${opts.grupoId}:`, e));
    }
  }

  const base = process.env.NEXTAUTH_URL || "https://crm.callface.io";
  let sessionId: string, url: string;
  try {
    const session = await createGroupCheckout({
      propostaId: proposta.id, negocioId: proposta.negocioId, grupoComercialId: opts.grupoId, organizacaoId: proposta.organizacaoId,
      moeda: proposta.moeda || "BRL", itensRecorrentes, itensAvulsos, customerEmail: lead?.email || undefined,
      successUrl: process.env.CHECKOUT_SUCCESS_URL || `${base}/obrigado`,
      cancelUrl: process.env.CHECKOUT_CANCEL_URL || base,
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
    status: "criado",
  }).returning();

  await vincularCheckoutAoGrupo(opts.grupoId, checkout.id);

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
