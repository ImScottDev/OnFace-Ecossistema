import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { syncStripe } from "@/lib/integrations/stripe-sync";
import { propostas, leads, empresas, checkouts, notificacoes, usuarios, assinaturas, faturas, stripeWebhookEvents, organizacoes, auditLog } from "@/lib/db/schema";
import { eq, and, isNull, or, sql, desc } from "drizzle-orm";
import { buscarCheckoutPorSessionId } from "@/lib/crm/checkout";
import { concluirGrupo, marcarPagamentoFalhouNoGrupo } from "@/lib/crm/grupo-comercial";
import { registrarEvidencia, marcarNegocioGanhoSeAindaNao } from "@/lib/crm/won-evidence";
import { registrarPagamentoDoGrupo } from "@/lib/crm/grupo-comercial";
import { resolverFamiliaDoGrupo, trilhaPosGanho } from "@/lib/crm/politica-familia";
import { quitarPendenciaFinanceira } from "@/lib/crm/pendencia-financeira";
import { notificarPagamentoConfirmado } from "@/lib/crm/notificar";
import { publicarEvento } from "@/lib/events/outbox";
import { dispararAutomacoesFinanceiras } from "@/lib/crm/automacao-engine";
import { isStripeMockMode } from "@/lib/integrations/stripe-checkout";

/**
 * Pagamento CONFIRMADO (payment_status === "paid") — Commercial Core v2
 * (ADR-EXEC-021): o checkout já nasce vinculado a um GRUPO COMERCIAL
 * específico (criado no aceite ou manualmente pelo vendedor), então este
 * handler não "aceita a proposta" mais — a proposta JÁ estava aceita antes
 * do checkout existir. Aqui só: confirma o pagamento do checkout, registra
 * evidência (escopada ao grupo), marca Won se ainda não, e conclui o grupo
 * (o que dispara a materialização do serviço canônico via Event Outbox —
 * ver consumer.ts, nunca inline best-effort).
 *
 * Idempotente: checkout.status='pago' já setado é um no-op (Stripe reenvia
 * o mesmo evento por retry/duplicidade).
 */
async function handlePaymentConfirmed(session: Record<string, unknown>, checkoutOverride?: typeof checkouts.$inferSelect): Promise<string> {
  const stripeSessionId = typeof session.id === "string" ? session.id : null;
  if (!stripeSessionId) return "session sem id";

  const checkout = checkoutOverride || await buscarCheckoutPorSessionId(stripeSessionId);
  if (!checkout) return `checkout não rastreado pra session ${stripeSessionId} — fora do fluxo atual, ignorado`;
  if (checkout.status === "pago") return "checkout já estava pago (idempotente)";

  const stripeCustomer = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscription = typeof session.subscription === "string" ? session.subscription : null;

  const pagoEm = new Date();
  const stripeInvoice = typeof session.invoice === "string" ? session.invoice : null;
  const stripePaymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;

  await db.update(checkouts).set({
    status: "pago", completadoEm: pagoEm, stripeSubscriptionId: stripeSubscription,
    // Frente 2C.1 — o que a 2C.2 vai precisar ler sem reabrir o payload bruto.
    stripeCustomerId: stripeCustomer, stripeInvoiceId: stripeInvoice, stripePaymentIntentId: stripePaymentIntent,
    paymentStatus: "confirmado", paidAt: pagoEm,
  }).where(eq(checkouts.id, checkout.id));

  // Frente 2C.1 — a família do grupo é o que decide a política de evidência
  // aplicável. Sem essa dica o gate cai no produto legado do negócio, que não
  // tem política nenhuma configurada.
  let familia: string | null = null;
  if (checkout.grupoComercialId) {
    familia = await resolverFamiliaDoGrupo(checkout.grupoComercialId).catch(() => null);
    await registrarPagamentoDoGrupo(checkout.grupoComercialId, "confirmado", { confirmadoEm: pagoEm });
    await quitarPendenciaFinanceira(checkout.grupoComercialId, pagoEm);
  }

  if (checkout.negocioId) {
    await registrarEvidencia({
      negocioId: checkout.negocioId,
      organizacaoId: checkout.organizacaoId,
      tipo: stripeSubscription ? "stripe_subscription" : "stripe_payment",
      sourceRef: stripeSessionId,
      grupoComercialId: checkout.grupoComercialId,
      metadata: { checkoutId: checkout.id, stripeInvoiceId: stripeInvoice, stripePaymentIntentId: stripePaymentIntent },
    });
    await marcarNegocioGanhoSeAindaNao(checkout.negocioId, checkout.organizacaoId, { familiaHint: familia });
    await notificarPagamentoConfirmado({ negocioId: checkout.negocioId, valor: null }).catch(() => {});
  }

  if (checkout.grupoComercialId) {
    await concluirGrupo(checkout.grupoComercialId);
    const trilha = trilhaPosGanho(familia);
    await publicarEvento({
      organizacaoId: checkout.organizacaoId, eventType: "FulfillmentCreated", aggregateType: "grupo_comercial", aggregateId: checkout.grupoComercialId,
      payload: { checkoutId: checkout.id, negocioId: checkout.negocioId, serviceFamily: familia, trilha, origem: "pagamento_confirmado" },
      idempotencyKey: `fulfillment-created:${checkout.grupoComercialId}`,
    });
  }

  // Espelho de billing / dados fiscais (igual antes, agora resolvido via checkout->proposta).
  const [propostaRow] = await db.select({ leadId: propostas.leadId }).from(propostas).where(eq(propostas.id, checkout.propostaId)).limit(1);
  if (propostaRow) {
    if (stripeCustomer) {
      await db.update(leads)
        .set({ stripeCustomerId: stripeCustomer, updatedAt: new Date() })
        .where(and(eq(leads.id, propostaRow.leadId), or(isNull(leads.stripeCustomerId), eq(leads.stripeCustomerId, ""))))
        .catch((e) => console.error("[StripeWebhook] falha ao gravar stripeCustomerId:", e));

      await gravarDocumentoFiscalNoCustomer(session, stripeCustomer).catch((e) =>
        console.error("[StripeWebhook] falha ao gravar CPF/CNPJ no Customer:", e)
      );
    }
    await gravarDadosFiscaisNoCRM(session, propostaRow.leadId).catch((e) =>
      console.error("[StripeWebhook] falha ao gravar dados fiscais no CRM:", e)
    );
  }

  await publicarEvento({
    organizacaoId: checkout.organizacaoId, eventType: "PaymentCompleted", aggregateType: "checkout", aggregateId: checkout.id,
    payload: { propostaId: checkout.propostaId, negocioId: checkout.negocioId, grupoComercialId: checkout.grupoComercialId, stripeSessionId },
    idempotencyKey: `payment-completed:${checkout.id}`,
  });

  return `checkout ${checkout.id} pago, grupo ${checkout.grupoComercialId ?? "—"} concluído`;
}

async function findCheckoutForBillingObject(object: Record<string, unknown>) {
  const invoiceId = typeof object.id === "string" && typeof object.subscription !== "undefined" ? object.id : null;
  const subscriptionId = typeof object.subscription === "string"
    ? object.subscription
    : typeof object.parent === "object" && object.parent && typeof (object.parent as Record<string, unknown>).subscription_details === "object"
      ? ((object.parent as Record<string, unknown>).subscription_details as Record<string, unknown>)?.subscription
      : null;
  const customerId = typeof object.customer === "string" ? object.customer : null;

  if (invoiceId) {
    const [byInvoice] = await db.select().from(checkouts).where(eq(checkouts.stripeInvoiceId, invoiceId)).limit(1);
    if (byInvoice) return byInvoice;
  }
  if (typeof subscriptionId === "string") {
    const [bySubscription] = await db.select().from(checkouts).where(eq(checkouts.stripeSubscriptionId, subscriptionId)).limit(1);
    if (bySubscription) return bySubscription;
  }
  const metadata = object.metadata as Record<string, unknown> | undefined;
  const groupId = typeof metadata?.crm_group_id === "string" ? metadata.crm_group_id : null;
  if (groupId) {
    const [byGroup] = await db.select().from(checkouts).where(eq(checkouts.grupoComercialId, groupId)).orderBy(desc(checkouts.criadoEm)).limit(1);
    if (byGroup) return byGroup;
  }
  if (customerId) {
    const [byCustomer] = await db.select().from(checkouts).where(eq(checkouts.stripeCustomerId, customerId)).orderBy(desc(checkouts.criadoEm)).limit(1);
    if (byCustomer) return byCustomer;
  }
  return null;
}

async function handleInvoicePaid(invoice: Record<string, unknown>): Promise<string> {
  const checkout = await findCheckoutForBillingObject(invoice);
  if (!checkout) return "invoice.paid sem checkout rastreado (fica pro sync)";
  const session: Record<string, unknown> = {
    id: checkout.stripeSessionId || `invoice_${String(invoice.id || "unknown")}`,
    customer: invoice.customer,
    subscription: typeof invoice.subscription === "string" ? invoice.subscription : null,
    invoice: typeof invoice.id === "string" ? invoice.id : null,
    payment_intent: typeof invoice.payment_intent === "string" ? invoice.payment_intent : null,
    payment_status: "paid",
  };
  return handlePaymentConfirmed(session, checkout);
}

async function handleSubscriptionLink(subscription: Record<string, unknown>): Promise<string> {
  const metadata = subscription.metadata as Record<string, unknown> | undefined;
  const checkout = await findCheckoutForBillingObject(subscription);
  const checkoutByMetadata = typeof metadata?.crm_group_id === "string"
    ? (await db.select().from(checkouts).where(eq(checkouts.grupoComercialId, metadata.crm_group_id)).orderBy(desc(checkouts.criadoEm)).limit(1))[0]
    : null;
  const target = checkout || checkoutByMetadata;
  if (!target) return "subscription sem checkout rastreado (fica pro sync)";
  const subscriptionId = typeof subscription.id === "string" ? subscription.id : null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  await db.update(checkouts).set({
    stripeSubscriptionId: subscriptionId || target.stripeSubscriptionId,
    stripeCustomerId: customerId || target.stripeCustomerId,
  }).where(eq(checkouts.id, target.id));
  return `subscription vinculada ao checkout ${target.id}`;
}

/** checkout.session.expired — não configurado no Stripe Dashboard ainda (confirmar assinatura do webhook antes de depender disso em produção). */
async function handleCheckoutExpired(session: Record<string, unknown>): Promise<string> {
  const stripeSessionId = typeof session.id === "string" ? session.id : null;
  if (!stripeSessionId) return "session sem id";
  const checkout = await buscarCheckoutPorSessionId(stripeSessionId);
  if (!checkout) return `checkout não rastreado pra session ${stripeSessionId}`;
  if (checkout.status === "pago") return "checkout já pago antes de expirar, ignorando";

  await db.update(checkouts).set({ status: "expirado" }).where(eq(checkouts.id, checkout.id));
  if (checkout.grupoComercialId) await marcarPagamentoFalhouNoGrupo(checkout.grupoComercialId).catch(() => {});

  await publicarEvento({
    organizacaoId: checkout.organizacaoId, eventType: "CheckoutExpired", aggregateType: "checkout", aggregateId: checkout.id,
    payload: { propostaId: checkout.propostaId, grupoComercialId: checkout.grupoComercialId },
  });
  return `checkout ${checkout.id} expirado`;
}

/**
 * Copia o custom_field `cpfcnpj` (coletado no checkout, ver stripe-checkout.ts)
 * pra metadata do Customer no Stripe — sem isso o documento fiscal fica preso
 * na sessão e some, igual ao problema real da planilha de NFs de 03/08.
 * Detecta CPF (11 dígitos) vs CNPJ (14) pelo tamanho e grava na chave certa
 * (`user_cpf`/`user_cnpj`, mesmo padrão já usado nos clientes antigos).
 */
async function gravarDocumentoFiscalNoCustomer(session: Record<string, unknown>, customerId: string): Promise<string> {
  // A auditoria e o lote CRM-only não podem alterar Stripe. Metadata writeback
  // passa a ser opt-in explícito no ambiente, depois de aprovação do plano.
  if (process.env.STRIPE_WRITEBACK_ENABLED !== "true") return "writeback Stripe desabilitado";
  const customFields = (session.custom_fields as Array<{ key?: string; text?: { value?: string } }> | undefined) || [];
  const campo = customFields.find((f) => f.key === "cpfcnpj");
  const valor = campo?.text?.value;
  if (!valor) return "sem custom_field cpfcnpj na sessão";

  const digitos = valor.replace(/\D/g, "");
  if (digitos.length !== 11 && digitos.length !== 14) return `valor de documento inválido (${digitos.length} dígitos)`;
  const chave = digitos.length === 14 ? "user_cnpj" : "user_cpf";

  const key = process.env.STRIPE_API_KEY;
  if (!key) return "STRIPE_API_KEY não configurada";

  const form = new URLSearchParams();
  form.append(`metadata[${chave}]`, digitos);

  const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe update customer metadata: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  return `${chave} gravado no customer ${customerId}`;
}

/**
 * Devolve pro CRM os dados que o checkout coletou (documento, endereço,
 * telefone) — sem isso eles ficam só no Stripe e o time volta a caçar
 * cliente por cliente na próxima auditoria de NF. Só PREENCHE campo vazio,
 * nunca sobrescreve dado que já existe (editado à mão tem prioridade).
 * CNPJ (14 dígitos) vai pra empresa vinculada; CPF (11 dígitos) não tem
 * coluna própria pra pessoa física — grava em `leads.camposCustom.cpf`.
 */
async function gravarDadosFiscaisNoCRM(session: Record<string, unknown>, leadId: string): Promise<string> {
  const details = (session.customer_details as
    | { phone?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string } }
    | undefined) || {};
  const customFields = (session.custom_fields as Array<{ key?: string; text?: { value?: string } }> | undefined) || [];
  const documento = customFields.find((f) => f.key === "cpfcnpj")?.text?.value;
  const digitos = documento ? documento.replace(/\D/g, "") : "";
  const endereco = [details.address?.line1, details.address?.line2].filter(Boolean).join(", ") || null;

  const [lead] = await db
    .select({ empresaId: leads.empresaId, telefone: leads.telefone, camposCustom: leads.camposCustom })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!lead) return `lead ${leadId} não encontrado`;

  const patchLead: Record<string, unknown> = {};
  if (!lead.telefone && details.phone) patchLead.telefone = details.phone;
  if (digitos.length === 11 && !(lead.camposCustom as Record<string, unknown> | null)?.cpf) {
    patchLead.camposCustom = { ...(lead.camposCustom as Record<string, unknown> | null), cpf: digitos };
  }
  if (Object.keys(patchLead).length > 0) {
    patchLead.updatedAt = new Date();
    await db.update(leads).set(patchLead).where(eq(leads.id, leadId));
  }

  if (!lead.empresaId) return "lead sem empresa vinculada, só atualizou dados pessoais";

  const [empresa] = await db
    .select({ cnpj: empresas.cnpj, endereco: empresas.endereco, cep: empresas.cep, cidade: empresas.cidade, estado: empresas.estado, telefone: empresas.telefone })
    .from(empresas)
    .where(eq(empresas.id, lead.empresaId))
    .limit(1);
  if (!empresa) return "empresa vinculada não encontrada";

  const patchEmpresa: Record<string, unknown> = {};
  if (digitos.length === 14 && !empresa.cnpj) patchEmpresa.cnpj = digitos;
  if (!empresa.endereco && endereco) patchEmpresa.endereco = endereco;
  if (!empresa.cep && details.address?.postal_code) patchEmpresa.cep = details.address.postal_code;
  if (!empresa.cidade && details.address?.city) patchEmpresa.cidade = details.address.city;
  if (!empresa.estado && details.address?.state) patchEmpresa.estado = details.address.state;
  if (!empresa.telefone && details.phone) patchEmpresa.telefone = details.phone;

  if (Object.keys(patchEmpresa).length === 0) return "empresa já estava completa, nada a atualizar";
  patchEmpresa.updatedAt = new Date();
  await db.update(empresas).set(patchEmpresa).where(eq(empresas.id, lead.empresaId));
  return `empresa ${lead.empresaId} atualizada: ${Object.keys(patchEmpresa).join(", ")}`;
}

/**
 * Boleto NÃO compensou (venceu sem pagamento): notifica o dono da proposta
 * e marca o checkout/grupo como falhou — o grupo volta pra
 * aguardando_checkout (a página pública /p/[id] regenera um novo sozinha).
 */
async function handleAsyncPaymentFailed(session: Record<string, unknown>): Promise<string> {
  const stripeSessionId = typeof session.id === "string" ? session.id : null;
  if (!stripeSessionId) return "session sem id";

  const checkout = await buscarCheckoutPorSessionId(stripeSessionId);
  if (!checkout) return `checkout não rastreado pra session ${stripeSessionId}`;
  if (checkout.status === "pago") return "checkout já pago, ignorando falha antiga (boleto duplicado)";

  await db.update(checkouts).set({ status: "falhou" }).where(eq(checkouts.id, checkout.id));
  if (checkout.grupoComercialId) await marcarPagamentoFalhouNoGrupo(checkout.grupoComercialId);

  await publicarEvento({
    organizacaoId: checkout.organizacaoId, eventType: "PaymentFailed", aggregateType: "checkout", aggregateId: checkout.id,
    payload: { propostaId: checkout.propostaId, grupoComercialId: checkout.grupoComercialId, motivo: "boleto_nao_compensou" },
  });

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, checkout.propostaId)).limit(1);
  if (proposta?.criadoPorId && proposta.leadId) {
    const [lead] = await db.select({ nome: leads.nome, empresa: leads.empresa }).from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
    const quem = lead?.empresa || lead?.nome || "cliente";
    await db.insert(notificacoes).values({
      usuarioId: proposta.criadoPorId,
      tipo: "pagamento_falhou",
      titulo: `Boleto não compensou — ${quem}`,
      mensagem: `O boleto da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} venceu sem pagamento. O link ${process.env.NEXTAUTH_URL || "https://crm.callface.io"}/p/${proposta.id} já gera um checkout novo automaticamente — combine com o cliente uma nova forma de pagamento.`,
      link: `/propostas/${proposta.id}`,
    }).catch((e) => console.error("[StripeWebhook] falha ao notificar boleto falhado:", e));
  }
  return `boleto falhou no checkout ${checkout.id} — responsável notificado`;
}

/**
 * Cobrança recorrente FALHOU (cartão recusado — 62% do churn é isso): notifica o
 * responsável do lead (ou os admins) na hora, com valor e o hosted_invoice_url do
 * Stripe — página onde o cliente paga a fatura e atualiza o cartão sem login.
 * A recuperação automática (retries) continua com o Stripe; isso aqui é a fila
 * HUMANA agir em paralelo enquanto o atraso é recente e recuperável.
 */
async function handleInvoicePaymentFailed(invoice: Record<string, unknown>): Promise<string> {
  const checkout = await findCheckoutForBillingObject(invoice);
  if (checkout && checkout.status !== "pago" && checkout.status !== "concluido") {
    await db.update(checkouts).set({
      status: "falhou",
      paymentStatus: "falhou",
      stripeInvoiceId: typeof invoice.id === "string" ? invoice.id : checkout.stripeInvoiceId,
    }).where(eq(checkouts.id, checkout.id));
    if (checkout.grupoComercialId) await marcarPagamentoFalhouNoGrupo(checkout.grupoComercialId);
    await publicarEvento({
      organizacaoId: checkout.organizacaoId,
      eventType: "PaymentFailed",
      aggregateType: "checkout",
      aggregateId: checkout.id,
      payload: { propostaId: checkout.propostaId, grupoComercialId: checkout.grupoComercialId, motivo: "invoice_payment_failed" },
      idempotencyKey: `payment-failed:${checkout.id}:${String(invoice.id || "invoice")}`,
    });
  }
  const customer = typeof invoice.customer === "string" ? invoice.customer : null;
  if (!customer) return "invoice sem customer";

  const [lead] = await db
    .select({ id: leads.id, nome: leads.nome, empresa: leads.empresa, responsavelId: leads.responsavelId })
    .from(leads)
    .where(eq(leads.stripeCustomerId, customer))
    .limit(1);
  if (!lead) return `customer ${customer} sem lead no CRM (fica pro sync)`;

  const valor = typeof invoice.amount_due === "number" ? invoice.amount_due / 100 : 0;
  const tentativa = typeof invoice.attempt_count === "number" ? invoice.attempt_count : 1;
  const urlFatura = typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null;
  const temRetry = !!invoice.next_payment_attempt;
  const quem = lead.empresa || lead.nome || "cliente";

  // Destinatários: responsável da conta; sem responsável, todos os admins ativos.
  let destinatarios: string[] = lead.responsavelId ? [lead.responsavelId] : [];
  if (destinatarios.length === 0) {
    const admins = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.role, "admin"), eq(usuarios.ativo, true)));
    destinatarios = admins.map((a) => a.id);
  }

  const mensagem =
    `Cobrança de R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de ${quem} falhou ` +
    `(tentativa ${tentativa}${temRetry ? ", Stripe vai retentar" : ", SEM nova tentativa automática — régua esgotada"}).` +
    (urlFatura ? ` Link pro cliente pagar/atualizar cartão: ${urlFatura}` : "");

  for (const usuarioId of destinatarios) {
    await db.insert(notificacoes).values({
      usuarioId,
      tipo: "pagamento_falhou",
      titulo: `Pagamento falhou — ${quem}`,
      mensagem,
      link: `/financeiro`,
    }).catch((e) => console.error("[StripeWebhook] falha ao notificar pagamento falho:", e));
  }
  return `pagamento falhou de ${quem} — ${destinatarios.length} notificado(s)`;
}

// POST /api/webhooks/stripe
// Recebe eventos do Stripe em TEMPO REAL (pagamento, assinatura, cancelamento,
// checkout) e dispara um sync incremental. Configurar no painel Stripe:
//   Developers > Webhooks > Add endpoint: https://crm.callface.io/api/webhooks/stripe
//   Eventos: invoice.paid, invoice.payment_failed, customer.subscription.*,
//            checkout.session.completed, checkout.session.async_payment_succeeded,
//            checkout.session.async_payment_failed, checkout.session.expired
//   Copiar o "Signing secret" (whsec_...) -> STRIPE_WEBHOOK_SECRET no .env.
//   IMPORTANTE (Commercial Core v2): checkout.session.expired precisa estar
//   marcado no painel Stripe pra CheckoutExpired disparar de verdade — não
//   dá pra confirmar isso por código, só no Dashboard da conta.
export const dynamic = "force-dynamic";

const RELEVANT = new Set([
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
  "invoice.updated",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

// Tolerância de timestamp (doc Stripe: proteger contra replay) + suporte a múltiplos
// v1 no header (acontece durante rotação do signing secret).
const TOLERANCIA_SEGUNDOS = 5 * 60;

function verify(payload: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader) return false;
  let t: string | null = null;
  const v1s: string[] = [];
  for (const parte of sigHeader.split(",")) {
    const [k, v] = parte.split("=");
    if (k === "t") t = v;
    if (k === "v1" && v) v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;
  const idade = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(idade) || idade > TOLERANCIA_SEGUNDOS) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return v1s.some((v1) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
    } catch {
      return false;
    }
  });
}

type StripeEventPayload = {
  id?: string;
  type?: string;
  api_version?: string | null;
  livemode?: boolean;
  data?: { object?: Record<string, unknown> };
};

/** Resolve o tenant por vínculos persistidos antes de rodar qualquer sync. */
async function resolveWebhookOrganization(event: StripeEventPayload): Promise<string | null> {
  const object = event.data?.object || {};
  const customerId = typeof object.customer === "string" ? object.customer : null;
  const subscriptionId = typeof object.subscription === "string"
    ? object.subscription
    : typeof object.id === "string" && event.type?.startsWith("customer.subscription.")
      ? object.id
      : null;
  const invoiceId = typeof object.id === "string" && event.type?.startsWith("invoice.") ? object.id : null;
  const sessionId = typeof object.id === "string" && event.type?.startsWith("checkout.session.") ? object.id : null;
  const candidates = new Set<string>();

  if (customerId) {
    const rows = await db.select({ organizacaoId: assinaturas.organizacaoId })
      .from(assinaturas).where(eq(assinaturas.stripeCustomerId, customerId)).limit(3);
    rows.forEach((row) => candidates.add(row.organizacaoId));
  }
  if (subscriptionId) {
    const rows = await db.select({ organizacaoId: assinaturas.organizacaoId })
      .from(assinaturas).where(eq(assinaturas.stripeSubscriptionId, subscriptionId)).limit(3);
    rows.forEach((row) => candidates.add(row.organizacaoId));
  }
  if (invoiceId) {
    const rows = await db.select({ organizacaoId: faturas.organizacaoId })
      .from(faturas).where(and(eq(faturas.origem, "stripe"), eq(faturas.externalId, invoiceId))).limit(3);
    rows.forEach((row) => candidates.add(row.organizacaoId));
  }
  if (sessionId) {
    const rows = await db.select({ organizacaoId: checkouts.organizacaoId })
      .from(checkouts).where(eq(checkouts.stripeSessionId, sessionId)).limit(3);
    rows.forEach((row) => candidates.add(row.organizacaoId));
  }
  if (candidates.size === 1) return [...candidates][0];
  if (candidates.size > 1) return null;

  // Instalação atual de uma organização: fallback explícito e seguro. Quando
  // houver mais de uma, o evento permanece unresolved e não faz sync global.
  const orgs = await db.select({ id: organizacoes.id }).from(organizacoes).limit(2);
  return orgs.length === 1 ? orgs[0].id : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // FAIL-CLOSED (auditoria item 8): sem secret configurado, o endpoint público
  // aceitava QUALQUER payload forjado — um POST com metadata.propostaId gerava
  // contrato e promovia lead a cliente sem pagamento.
  if (!secret) {
    console.error("[StripeWebhook] STRIPE_WEBHOOK_SECRET não configurado — recusando evento (fail-closed)");
    // 503 diz ao Stripe que esta porta está temporariamente indisponível e que
    // deve haver reentrega depois da configuração. 500 parece bug do handler.
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!verify(payload, sig, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEventPayload;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const type = event.type || "";
  if (!RELEVANT.has(type)) {
    return NextResponse.json({ received: true, ignored: type });
  }

  if (!event.id) {
    return NextResponse.json({ error: "event id missing" }, { status: 400 });
  }

  const organizacaoId = await resolveWebhookOrganization(event);
  const [inserido] = await db.insert(stripeWebhookEvents).values({
    // `event_id` é a coluna canônica convergida no merge de 20/09 (o banco
    // carregado de produção só tem essa; `stripe_event_id` não existe lá).
    eventId: event.id,
    organizacaoId,
    eventType: type,
    apiVersion: event.api_version || null,
    livemode: event.livemode ?? null,
    status: organizacaoId ? "pending" : "unresolved",
    payload: event,
    receivedAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing({ target: stripeWebhookEvents.eventId }).returning({ id: stripeWebhookEvents.id });

  // ORDEM IMPORTA. A reentrega do Stripe NÃO pode parar aqui: o inbox é trilha
  // de auditoria/reprocesso, nunca trava. Quando a 1ª entrega morreu no meio
  // (sync fora do ar, 500), o retry é a única chance do pagamento virar aceite,
  // e os handlers abaixo são idempotentes (checkout já pago sai na hora, claim
  // atômico no grupo/proposta). Era o contrário até 17/09/2026 e isso travou
  // vendas PAGAS: o `return duplicate` vinha antes do tratamento de negócio.
  let inboxEvent = inserido;
  if (!inboxEvent) {
    [inboxEvent] = await db
      .select({ id: stripeWebhookEvents.id })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.eventId, event.id))
      .limit(1);
  }
  if (!inboxEvent) {
    // Nem inseriu nem achou: o inbox está inacessível. 500 pra o Stripe reenviar.
    return NextResponse.json({ error: "webhook inbox unavailable" }, { status: 500 });
  }

  if (!organizacaoId) {
    return NextResponse.json({ received: true, unresolved: true, eventId: event.id }, { status: 202 });
  }

  await db.update(stripeWebhookEvents)
    .set({ status: "processing", attempts: sql`${stripeWebhookEvents.attempts} + 1`, updatedAt: new Date() })
    .where(eq(stripeWebhookEvents.id, inboxEvent.id));

  const finishInboxEvent = async (status: "processed" | "failed", lastError?: string) => {
    await db.update(stripeWebhookEvents).set({
      status,
      lastError: lastError ? lastError.slice(0, 2000) : null,
      processedAt: status === "processed" ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(stripeWebhookEvents.id, inboxEvent.id));
    try {
      await db.insert(auditLog).values({
        organizacaoId,
        actorId: null,
        action: status === "processed" ? "stripe.webhook_processado" : "stripe.webhook_falhou",
        entityType: "stripe_event",
        entityId: inboxEvent.id,
        before: { status: "processing", eventId: event.id, eventType: type },
        after: { status, eventId: event.id, eventType: type, error: lastError || null },
        source: "webhook",
      });
    } catch (auditError) {
      console.error("[StripeWebhook] evento processado, mas auditoria falhou:", auditError);
    }
  };

  let checkoutMockMode = false;
  try {
    checkoutMockMode = isStripeMockMode();
  } catch (e) {
    await finishInboxEvent("failed", String(e));
    return NextResponse.json({ error: "stripe checkout mode blocked" }, { status: 500 });
  }

  // checkout.session.completed dispara quando o cliente TERMINA o checkout, não quando
  // ele PAGA — pra métodos assíncronos (boleto), a sessão fica "complete" com
  // payment_status "unpaid" até o boleto compensar. Só marcar aceita se payment_status
  // já vier "paid" aqui (caso comum: cartão). Boleto vira aceita só no async_payment_succeeded.
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const session = (event as { data?: { object?: Record<string, unknown> } }).data?.object || {};
    if (session.payment_status === "paid") {
      try {
        const r = await handlePaymentConfirmed(session);
        console.log(`[StripeWebhook] ${type} (payment_status=paid) -> ${r}`);
      } catch (e) {
        // 500 de propósito: o Stripe reenvia o evento e o aceite é retentado.
        // (Antes: log + 200 = pagamento confirmado sem contrato, pra sempre.)
        console.error("[StripeWebhook] erro ao aceitar proposta (Stripe vai retentar):", e);
        await finishInboxEvent("failed", String(e));
        return NextResponse.json({ error: "accept failed, retry" }, { status: 500 });
      }
    } else {
      console.log(`[StripeWebhook] ${type} ignorado, payment_status=${session.payment_status} (aguardando compensação, ex: boleto)`);
    }
  }

  if (type === "checkout.session.async_payment_failed") {
    try {
      const session = (event as { data?: { object?: Record<string, unknown> } }).data?.object || {};
      const r = await handleAsyncPaymentFailed(session);
      console.log(`[StripeWebhook] ${type} -> ${r}`);
    } catch (e) {
      console.error("[StripeWebhook] erro ao tratar boleto falhado:", e);
    }
  }

  if (type === "checkout.session.expired") {
    try {
      const session = (event as { data?: { object?: Record<string, unknown> } }).data?.object || {};
      const r = await handleCheckoutExpired(session);
      console.log(`[StripeWebhook] ${type} -> ${r}`);
    } catch (e) {
      console.error("[StripeWebhook] erro ao tratar checkout expirado:", e);
    }
  }

  if (type === "invoice.payment_failed") {
    try {
      const invoice = (event as { data?: { object?: Record<string, unknown> } }).data?.object || {};
      const r = await handleInvoicePaymentFailed(invoice);
      console.log(`[StripeWebhook] ${type} -> ${r}`);
    } catch (e) {
      // Não retorna 500: a notificação interna não pode travar o retry do Stripe;
      // o sync abaixo mantém o dado consistente de qualquer jeito.
      console.error("[StripeWebhook] erro ao notificar pagamento falho:", e);
    }
  }

  if (type === "invoice.paid") {
    try {
      const invoice = event.data?.object || {};
      const r = await handleInvoicePaid(invoice);
      console.log(`[StripeWebhook] ${type} -> ${r}`);
    } catch (e) {
      console.error("[StripeWebhook] erro ao tratar invoice.paid:", e);
      await finishInboxEvent("failed", String(e));
      return NextResponse.json({ error: "invoice paid handling failed, retry" }, { status: 500 });
    }
  }

  if (type.startsWith("customer.subscription.")) {
    try {
      const subscription = event.data?.object || {};
      const r = await handleSubscriptionLink(subscription);
      console.log(`[StripeWebhook] ${type} -> ${r}`);
    } catch (e) {
      console.error("[StripeWebhook] erro ao vincular subscription:", e);
      await finishInboxEvent("failed", String(e));
      return NextResponse.json({ error: "subscription handling failed, retry" }, { status: 500 });
    }
  }

  if (checkoutMockMode) {
    await finishInboxEvent("processed");
    return NextResponse.json({ received: true, type, mode: "mock" });
  }

  // Sync incremental (idempotente: upsert por stripe id). Reconcilia assinaturas/faturas/churn.
  try {
    const r = await syncStripe(organizacaoId);
    console.log(`[StripeWebhook] ${type} -> sync: ${r.subs} subs, ${r.faturas} faturas, ${r.churns} churns`);

    // Só disparamos regras financeiras depois da materialização local. Assim a
    // automação de tag/tarefa enxerga a mesma Empresa/Service que o Financeiro.
    const object = event.data?.object || {};
    const customerId = typeof object.customer === "string" ? object.customer : null;
    const invoiceId = type.startsWith("invoice.") && typeof object.id === "string" ? object.id : null;
    const subscriptionId = typeof object.subscription === "string"
      ? object.subscription
      : type.startsWith("customer.subscription.") && typeof object.id === "string" ? object.id : null;
    let gatilho: "pagamento_falhou" | "fatura_atrasada" | "fatura_paga" | "assinatura_status_alterado" | null = null;
    if (type === "invoice.payment_failed") gatilho = "pagamento_falhou";
    else if (type === "invoice.paid") gatilho = "fatura_paga";
    else if (type === "invoice.updated") {
      const status = typeof object.status === "string" ? object.status : null;
      const dueDate = typeof object.due_date === "number" ? object.due_date * 1000 : null;
      if (status === "paid") gatilho = "fatura_paga";
      else if (status === "open" && dueDate != null && dueDate < Date.now()) gatilho = "fatura_atrasada";
    } else if (type.startsWith("customer.subscription.")) gatilho = "assinatura_status_alterado";
    if (gatilho) {
      await dispararAutomacoesFinanceiras({
        gatilho,
        organizacaoId,
        stripeCustomerId: customerId,
        stripeInvoiceId: invoiceId,
        stripeSubscriptionId: subscriptionId,
        campos: {
          stripeEvent: type,
          stripeCustomerId: customerId,
          stripeInvoiceId: invoiceId,
          stripeSubscriptionId: subscriptionId,
          status: typeof object.status === "string" ? object.status : null,
          amountDue: typeof object.amount_due === "number" ? object.amount_due / 100 : null,
          attemptCount: typeof object.attempt_count === "number" ? object.attempt_count : null,
          nextPaymentAttempt: typeof object.next_payment_attempt === "number" ? new Date(object.next_payment_attempt * 1000).toISOString() : null,
        },
      });
    }
    await finishInboxEvent("processed");
    return NextResponse.json({ received: true, type, synced: r });
  } catch (e) {
    console.error("[StripeWebhook] erro no sync:", e);
    await finishInboxEvent("failed", String(e));
    // 200 mesmo assim p/ o Stripe não ficar reenviando; o polling de 30min cobre.
    return NextResponse.json({ received: true, type, syncError: String(e) });
  }
}
