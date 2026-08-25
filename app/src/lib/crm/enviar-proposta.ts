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
import { createSubscriptionCheckout, createOneTimeCheckout, boletoExpiresAfterDaysFromValidade } from "@/lib/integrations/stripe-checkout";
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
  skipEmail?: boolean; // "Salvar": gera link + ativa (enviada) SEM disparar email
}): Promise<EnviarPropostaResult> {
  const { propostaId, organizacaoId, userId, userName, skipEmail } = opts;

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

  // Email só é obrigatório quando vamos ENVIAR o email. No "Salvar" (skipEmail) o
  // link é gerado mesmo sem email do lead (o Stripe coleta no checkout).
  if (!skipEmail && !lead?.email) {
    return { ok: false, status: 400, error: "O lead não tem email cadastrado. Preencha o email do cliente antes de enviar." };
  }

  const itens = await db
    .select({
      nome: propostaItens.nome,
      tipo: propostaItens.tipo,
      quantidade: propostaItens.quantidade,
      subtotal: propostaItens.subtotal,
      stripeProductId: servicosCatalogo.stripeProductId,
    })
    .from(propostaItens)
    .leftJoin(servicosCatalogo, eq(propostaItens.servicoCatalogoId, servicosCatalogo.id))
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(asc(propostaItens.ordem));

  // subtotal já é quantidade × valor unitário (com desconto aplicado). O Stripe
  // precisa da quantidade real na sessão (senão a liberação de acesso do lado do
  // produto, que provavelmente lê `quantity`, ativa 1 usuário em vez de N).
  const paraCheckoutItem = (i: (typeof itens)[number]) => {
    const quantidade = Math.max(1, Math.round(parseFloat(i.quantidade || "1") || 1));
    const subtotal = parseFloat(i.subtotal || "0");
    return {
      nome: i.nome,
      valorUnitario: quantidade > 0 ? subtotal / quantidade : subtotal,
      quantidade,
      stripeProductId: i.stripeProductId, // produto real do Stripe (mantém produto + aplica preço/desconto da proposta)
    };
  };

  const recorrentes = itens.filter((i) => i.tipo === "recorrente");
  const checkoutItens = recorrentes.map(paraCheckoutItem);
  const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");
  const totalAvulso = parseFloat(proposta.totalAvulso || "0");
  const temRecorrente = checkoutItens.length > 0 || totalRecorrente > 0;

  // Proposta 100% avulso/setup (ex.: WHITE LABEL só com setup fee, sem plano
  // mensal junto): sem item recorrente não há o que assinar, então o checkout
  // vira pagamento único pelos itens avulsos/setup em vez de assinatura.
  const naoRecorrentes = itens.filter((i) => i.tipo !== "recorrente");
  const oneTimeItens = naoRecorrentes.map(paraCheckoutItem);

  if (!temRecorrente && oneTimeItens.length === 0) {
    return { ok: false, status: 400, error: "Proposta sem itens. Adicione ao menos um item antes de salvar/enviar." };
  }

  const base = process.env.NEXTAUTH_URL || "https://crm.callface.io";
  const clienteNome = [lead.nome, lead.sobrenome].filter(Boolean).join(" ") || lead.nome;

  // 1) Checkout Stripe (assinatura) com email do cliente + metadata
  // Boleto vence junto com a "Validade" da proposta — sem isso a Stripe usa o
  // default da conta (3 dias), ignorando a data que o closer escolheu.
  const boletoExpiresAfterDays = boletoExpiresAfterDaysFromValidade(proposta.dataValidade);
  let checkoutUrl: string;
  let stripeSessionId: string;
  try {
    const checkout = temRecorrente
      ? await createSubscriptionCheckout({
          propostaId: proposta.id,
          negocioId: proposta.negocioId,
          organizacaoId,
          moeda: proposta.moeda || "BRL",
          itens: checkoutItens,
          totalRecorrente,
          customerEmail: lead?.email || undefined,
          successUrl: process.env.CHECKOUT_SUCCESS_URL || `${base}/obrigado`,
          cancelUrl: process.env.CHECKOUT_CANCEL_URL || base,
          boletoExpiresAfterDays,
        })
      : await createOneTimeCheckout({
          propostaId: proposta.id,
          negocioId: proposta.negocioId,
          organizacaoId,
          moeda: proposta.moeda || "BRL",
          itens: oneTimeItens,
          customerEmail: lead?.email || undefined,
          successUrl: process.env.CHECKOUT_SUCCESS_URL || `${base}/obrigado`,
          cancelUrl: process.env.CHECKOUT_CANCEL_URL || base,
          boletoExpiresAfterDays,
        });
    checkoutUrl = checkout.url;
    stripeSessionId = checkout.sessionId;
  } catch (err) {
    return { ok: false, status: 502, error: `Falha ao gerar o checkout no Stripe: ${String(err)}` };
  }

  // Reenvio/edição de proposta já enviada: a sessão anterior fica com valores
  // desatualizados (itens/preço mudaram) e não pode continuar aberta pro cliente
  // pagar o valor errado. Expira ela no Stripe (best-effort, não trava o fluxo).
  if (proposta.stripeSessionId && proposta.stripeSessionId !== stripeSessionId) {
    const { expireCheckoutSession } = await import("@/lib/integrations/stripe-checkout");
    await expireCheckoutSession(proposta.stripeSessionId).catch((e) => {
      console.error(`[Proposta] falha ao expirar sessão anterior ${proposta.stripeSessionId}:`, e);
    });
  }

  // 2) Email branded via Resend — pulado no "Salvar" (skipEmail): só gera o link.
  let emailResult: { sent: boolean; skipped?: boolean; error?: string | null; id?: string | null } = {
    sent: false, skipped: true, error: null, id: null,
  };
  if (!skipEmail && lead?.email) {
    // Link curto e branded (não a URL crua do Stripe): se a proposta for editada
    // depois e o checkout regenerado, esse link continua funcionando pro cliente
    // que só tem o email antigo (o /p/[id] sempre resolve pro checkoutUrl atual).
    const linkPagamentoCurto = `${base}/p/${proposta.id}`;
    const { subject, html } = buildPropostaEmail({
      clienteNome,
      empresa: lead.empresa,
      numero: proposta.numero,
      versao: proposta.versao,
      moeda: proposta.moeda || "BRL",
      itens: itens.map((i) => ({ nome: i.nome, tipo: i.tipo, subtotal: parseFloat(i.subtotal || "0") })),
      totalRecorrente,
      totalAvulso,
      checkoutUrl: linkPagamentoCurto,
      validade: proposta.dataValidade,
      remetenteNome: userName ?? null,
    });
    emailResult = await sendResendEmail({ to: lead.email, subject, html });
  }

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
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} ${skipEmail ? "ativada (link gerado)" : "enviada por email"}`,
    descricao: temRecorrente
      ? (skipEmail
          ? `Link de pagamento gerado. Valor mensal: R$ ${totalRecorrente.toLocaleString("pt-BR")}. Email não disparado (Salvar).`
          : `Enviada para ${lead?.email}. Valor mensal: R$ ${totalRecorrente.toLocaleString("pt-BR")}. Checkout gerado.`)
      : (skipEmail
          ? `Link de pagamento único gerado. Valor: R$ ${totalAvulso.toLocaleString("pt-BR")}. Email não disparado (Salvar).`
          : `Enviada para ${lead?.email}. Valor: R$ ${totalAvulso.toLocaleString("pt-BR")}. Checkout de pagamento único gerado.`),
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
