/**
 * Envio de proposta pro cliente: SÓ deixa a proposta disponível na página
 * pública (/p/{id}) + dispara o email branded via Resend. NÃO cria mais
 * checkout Stripe aqui (Commercial Core v2, ADR-EXEC-021) — criar/enviar
 * proposta não significa que o cliente decidiu comprar. Checkout só nasce
 * quando existe intenção comercial real: automaticamente após o ACEITE
 * (ver lib/crm/proposta-aceite.ts) ou manualmente pelo vendedor (ver
 * lib/crm/checkout.ts::criarCheckoutParaGrupo, origem="manual_vendedor").
 *
 * Compartilhado entre a rota Next (local) e a rota Hono (prod) pra manter paridade.
 */
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, atividades } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { sendResendEmail } from "@/lib/email/resend";
import { buildPropostaEmail } from "@/lib/email/proposta-email";
import { publicarEvento } from "@/lib/events/outbox";

type PropostaRow = typeof propostas.$inferSelect;

export type EnviarPropostaResult =
  | {
      ok: true;
      proposta: PropostaRow;
      checkoutUrl: string; // link público (/p/{id}) — não mais um link de pagamento direto
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
  skipEmail?: boolean; // "Salvar": ativa (enviada) SEM disparar email
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

  if (!skipEmail && !lead?.email) {
    return { ok: false, status: 400, error: "O lead não tem email cadastrado. Preencha o email do cliente antes de enviar." };
  }

  const itens = await db
    .select({ nome: propostaItens.nome, tipo: propostaItens.tipo, subtotal: propostaItens.subtotal })
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(asc(propostaItens.ordem));

  const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");
  const base = process.env.NEXTAUTH_URL || "https://crm.callface.io";
  const clienteNome = [lead?.nome, lead?.sobrenome].filter(Boolean).join(" ") || lead?.nome || "";
  const linkPublico = `${base}/p/${proposta.id}`;

  let emailResult: { sent: boolean; skipped?: boolean; error?: string | null; id?: string | null } = {
    sent: false, skipped: true, error: null, id: null,
  };
  if (!skipEmail && lead?.email) {
    const { subject, html } = buildPropostaEmail({
      clienteNome,
      empresa: lead.empresa,
      numero: proposta.numero,
      versao: proposta.versao,
      moeda: proposta.moeda || "BRL",
      itens: itens.map((i) => ({ nome: i.nome, tipo: i.tipo, subtotal: parseFloat(i.subtotal || "0") })),
      totalRecorrente,
      checkoutUrl: linkPublico,
      validade: proposta.dataValidade,
      remetenteNome: userName ?? null,
    });
    emailResult = await sendResendEmail({ to: lead.email, subject, html });
  }

  const today = new Date().toISOString().split("T")[0];
  const [updated] = await db
    .update(propostas)
    .set({
      status: "enviada",
      dataEmissao: proposta.dataEmissao || today,
      enviadaEm: proposta.enviadaEm || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(propostas.id, propostaId))
    .returning();

  await publicarEvento({
    organizacaoId, eventType: "ProposalSent", aggregateType: "proposta", aggregateId: proposta.id,
    payload: { propostaId: proposta.id, negocioId: proposta.negocioId, linkPublico },
  });

  await db.insert(atividades).values({
    organizacaoId,
    leadId: proposta.leadId,
    usuarioId: userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} ${skipEmail ? "ativada (link gerado)" : "enviada por email"}`,
    descricao: skipEmail
      ? "Link público gerado. Email não disparado (Salvar)."
      : `Enviada para ${lead?.email}. Cliente decide o próximo passo na página pública.`,
    dados: { propostaId: proposta.id, linkPublico, emailId: emailResult.id ?? null },
  });

  return {
    ok: true,
    proposta: updated,
    checkoutUrl: linkPublico,
    emailSent: emailResult.sent,
    emailSkipped: emailResult.skipped ?? false,
    emailError: emailResult.error ?? null,
  };
}
