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
import { syncOportunidadeItensFromProposta } from "@/lib/crm/composicao-comercial";
import { formarGruposComerciais, vincularContratoPreparadoAoGrupo } from "@/lib/crm/grupo-comercial";
import { exigeContrato } from "@/lib/crm/commercial-model";
import { gerarContratoDeTemplate } from "@/lib/crm/contrato-template";

type PropostaRow = typeof propostas.$inferSelect;

function validadePadraoIso(): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + 10);
  return data.toISOString().slice(0, 10);
}

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
    .select({ nome: propostaItens.nome, tipo: propostaItens.tipo, subtotal: propostaItens.subtotal, commercialModel: propostaItens.commercialModel })
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(asc(propostaItens.ordem));

  const propostaExigeContrato = itens.some((item) => item.commercialModel !== "PAGAMENTO_DIRETO");
  const signatarios = Array.isArray(proposta.signatarios) ? proposta.signatarios : [];
  if (propostaExigeContrato && signatarios.length === 0) {
    return { ok: false, status: 400, error: "Informe ao menos um signatário antes de enviar esta proposta contratual." };
  }
  if (propostaExigeContrato && (!proposta.prazoContratoMeses || proposta.prazoContratoMeses < 1)) {
    return { ok: false, status: 400, error: "Informe o prazo do contrato em meses antes de enviar esta proposta." };
  }

  // Prepara grupos e contratos ANTES de tornar a proposta pública. Nenhuma
  // assinatura é distribuída aqui; isso só ocorre depois de ProposalAccepted.
  // Assim não existe a tarefa manual "gerar contrato" após o aceite.
  if (propostaExigeContrato) {
    await syncOportunidadeItensFromProposta(propostaId);
    const grupos = await formarGruposComerciais(propostaId);
    for (const grupo of grupos) {
      if (!exigeContrato(grupo.commercialModel) || grupo.contratoId) continue;
      const { contratoId } = await gerarContratoDeTemplate(grupo.id);
      await vincularContratoPreparadoAoGrupo(grupo.id, contratoId);
      await publicarEvento({ organizacaoId, eventType: "ContractGenerated", aggregateType: "contrato", aggregateId: contratoId, payload: { propostaId, negocioId: proposta.negocioId, grupoComercialId: grupo.id, preparadoAntesDoEnvio: true }, idempotencyKey: `contract-generated:${contratoId}` });
    }
  }

  const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");
  // O PDF/email histórico já informava "10 dias após o recebimento" quando
  // o vendedor não preenchia uma data. Materializamos essa regra no registro
  // no momento do envio para que exibição, worker e aceite usem a mesma data.
  const dataValidadeEfetiva = proposta.dataValidade || validadePadraoIso();
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
      validade: dataValidadeEfetiva,
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
      dataValidade: dataValidadeEfetiva,
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
