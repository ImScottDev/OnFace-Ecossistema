/**
 * Envio de proposta pro cliente: gera o checkout Stripe (assinatura mensal) com
 * o email do cliente pré-preenchido + metadata (pra cruzar no webhook), envia o
 * email branded via Resend com resumo + CTA, e atualiza a proposta.
 *
 * Compartilhado entre a rota Next (local) e a rota Hono (prod) pra manter paridade.
 */
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, atividades, servicosCatalogo } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { createSubscriptionCheckout } from "@/lib/integrations/stripe-checkout";
import { sendResendEmail } from "@/lib/email/resend";
import { buildPropostaEmail } from "@/lib/email/proposta-email";

type PropostaRow = typeof propostas.$inferSelect;

export type EnviarPropostaResult =
  | {
      ok: true;
      proposta: PropostaRow;
      checkoutUrl: string;
      emailSent: boolean;
      emailSkipped: boolean;
      emailError: string | null;
    }
  | { ok: false; status: number; error: string };

export async function enviarPropostaComCheckout(opts: {
  propostaId: string;
  organizacaoId: string;
  userId: string;
  userName?: string | null;
}): Promise<EnviarPropostaResult> {
  const { propostaId, organizacaoId, userId, userName } = opts;

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, propostaId), eq(propostas.organizacaoId, organizacaoId)))
    .limit(1);

  if (!proposta) return { ok: false, status: 404, error: "Proposta não encontrada" };
  if (!["rascunho", "enviada"].includes(proposta.status)) {
    return { ok: false, status: 400, error: "Só dá pra enviar propostas em rascunho ou já enviadas" };
  }

  const [lead] = await db
    .select({ nome: leads.nome, sobrenome: leads.sobrenome, empresa: leads.empresa, email: leads.email })
    .from(leads)
    .where(eq(leads.id, proposta.leadId))
    .limit(1);

  if (!lead?.email) {
    return { ok: false, status: 400, error: "O lead não tem email cadastrado. Preencha o email do cliente antes de enviar." };
  }

  const itens = await db
    .select({
      nome: propostaItens.nome,
      tipo: propostaItens.tipo,
      subtotal: propostaItens.subtotal,
      stripeProductId: servicosCatalogo.stripeProductId,
    })
    .from(propostaItens)
    .leftJoin(servicosCatalogo, eq(propostaItens.servicoCatalogoId, servicosCatalogo.id))
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(asc(propostaItens.ordem));

  const recorrentes = itens.filter((i) => i.tipo === "recorrente");
  const checkoutItens = recorrentes.map((i) => ({
    nome: i.nome,
    valorUnitario: parseFloat(i.subtotal || "0"),
    quantidade: 1,
    stripeProductId: i.stripeProductId, // produto real do Stripe (mantém produto + aplica preço/desconto da proposta)
  }));
  const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");

  if (checkoutItens.length === 0 && totalRecorrente <= 0) {
    return { ok: false, status: 400, error: "Proposta sem valor recorrente. O checkout de assinatura precisa de um valor mensal." };
  }

  const base = process.env.NEXTAUTH_URL || "https://crm.callface.io";
  const clienteNome = [lead.nome, lead.sobrenome].filter(Boolean).join(" ") || lead.nome;

  // 1) Checkout Stripe (assinatura) com email do cliente + metadata
  let checkoutUrl: string;
  let stripeSessionId: string;
  try {
    const checkout = await createSubscriptionCheckout({
      propostaId: proposta.id,
      negocioId: proposta.negocioId,
      organizacaoId,
      moeda: proposta.moeda || "BRL",
      itens: checkoutItens,
      totalRecorrente,
      customerEmail: lead.email,
      successUrl: process.env.CHECKOUT_SUCCESS_URL || `${base}/obrigado`,
      cancelUrl: process.env.CHECKOUT_CANCEL_URL || base,
    });
    checkoutUrl = checkout.url;
    stripeSessionId = checkout.sessionId;
  } catch (err) {
    return { ok: false, status: 502, error: `Falha ao gerar o checkout no Stripe: ${String(err)}` };
  }

  // 2) Email branded via Resend
  const { subject, html } = buildPropostaEmail({
    clienteNome,
    empresa: lead.empresa,
    numero: proposta.numero,
    versao: proposta.versao,
    moeda: proposta.moeda || "BRL",
    itens: itens.map((i) => ({ nome: i.nome, tipo: i.tipo, subtotal: parseFloat(i.subtotal || "0") })),
    totalRecorrente,
    checkoutUrl,
    validade: proposta.dataValidade,
    remetenteNome: userName ?? null,
  });
  const emailResult = await sendResendEmail({ to: lead.email, subject, html });

  // 3) Atualiza a proposta
  const today = new Date().toISOString().split("T")[0];
  const [updated] = await db
    .update(propostas)
    .set({
      status: "enviada",
      dataEmissao: proposta.dataEmissao || today,
      checkoutUrl,
      stripeSessionId,
      enviadaEm: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(propostas.id, propostaId))
    .returning();

  // 4) Timeline
  await db.insert(atividades).values({
    organizacaoId,
    leadId: proposta.leadId,
    usuarioId: userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} enviada por email`,
    descricao: `Enviada para ${lead.email}. Valor mensal: R$ ${totalRecorrente.toLocaleString("pt-BR")}. Checkout gerado.`,
    dados: { propostaId: proposta.id, checkoutUrl, emailId: emailResult.id ?? null },
  });

  return {
    ok: true,
    proposta: updated,
    checkoutUrl,
    emailSent: emailResult.sent,
    emailSkipped: emailResult.skipped ?? false,
    emailError: emailResult.error ?? null,
  };
}
