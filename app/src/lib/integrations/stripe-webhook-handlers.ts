/**
 * Handlers de negócio dos eventos do Stripe.
 *
 * Moram aqui (e não na rota) porque a rota HTTP e o worker precisam rodar
 * EXATAMENTE o mesmo processamento: reprocessar um evento falho pela fila tem
 * de fazer o que a primeira entrega fazia. Um arquivo `route.ts` do Next não
 * pode exportar nada além dos verbos HTTP, então o código não podia ser
 * importado pelo worker enquanto vivia lá.
 *
 * Todos são idempotentes: o Stripe reentrega, e a fila reprocessa.
 */
import { db } from "@/lib/db";
import { propostas, leads, empresas, checkouts, notificacoes, usuarios, billingResolutionCases } from "@/lib/db/schema";
import { eq, and, isNull, or, sql, desc, gt } from "drizzle-orm";
import { subscriptionIdDe } from "./stripe-financeiro";
import { buscarCheckoutPorSessionId } from "@/lib/crm/checkout";
import { concluirGrupo, marcarPagamentoFalhouNoGrupo } from "@/lib/crm/grupo-comercial";
import { registrarEvidencia, marcarNegocioGanhoSeAindaNao } from "@/lib/crm/won-evidence";
import { registrarPagamentoDoGrupo } from "@/lib/crm/grupo-comercial";
import { resolverFamiliaDoGrupo, trilhaPosGanho } from "@/lib/crm/politica-familia";
import { quitarPendenciaFinanceira } from "@/lib/crm/pendencia-financeira";
import { notificarPagamentoConfirmado } from "@/lib/crm/notificar";
import { publicarEvento } from "@/lib/events/outbox";
import { appUrl } from "@/lib/app-url";

/**
 * Notificação sem repetir: o reprocesso (fila, admin) e a reentrega do Stripe re-rodam os handlers, e
 * a mesma mensagem para o mesmo usuário nos últimos 3 dias não deve virar uma segunda notificação
 * (QA 06/10: 12 avisos para 1 evento). Com isto o evento pode FALHAR e ser refeito sem barulho.
 */
export async function inserirNotificacaoUmaVez(valores: typeof notificacoes.$inferInsert): Promise<void> {
  if (valores.usuarioId && valores.mensagem) {
    const desde = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    const [ja] = await db.select({ id: notificacoes.id }).from(notificacoes)
      .where(and(eq(notificacoes.usuarioId, valores.usuarioId), eq(notificacoes.tipo, valores.tipo), eq(notificacoes.mensagem, valores.mensagem), gt(notificacoes.createdAt, desde)))
      .limit(1);
    if (ja) return;
  }
  await db.insert(notificacoes).values(valores);
}

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
export async function handlePaymentConfirmed(session: Record<string, unknown>, checkoutOverride?: typeof checkouts.$inferSelect): Promise<string> {
  const stripeSessionId = typeof session.id === "string" ? session.id : null;
  if (!stripeSessionId) return "session sem id";

  const checkout = checkoutOverride || await buscarCheckoutPorSessionId(stripeSessionId);
  if (!checkout) {
    await abrirCasoDePagamentoOrfao({
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
      referencia: stripeSessionId,
      tipo: "checkout.session",
      valor: typeof session.amount_total === "number" ? session.amount_total / 100 : null,
    });
    return `checkout não rastreado pra session ${stripeSessionId} — caso aberto para conciliação`;
  }
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
  const invoiceId = typeof object.id === "string" && (object.object === "invoice" || typeof object.subscription !== "undefined") ? object.id : null;
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

export async function handleInvoicePaid(invoice: Record<string, unknown>): Promise<string> {
  const checkout = await findCheckoutForBillingObject(invoice);
  if (!checkout) {
    await abrirCasoDePagamentoOrfao({
      stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
      stripeSubscriptionId: subscriptionIdDe(invoice),
      referencia: typeof invoice.id === "string" ? invoice.id : "(sem id)",
      tipo: "invoice.paid",
      valor: typeof invoice.amount_paid === "number" ? invoice.amount_paid / 100 : null,
    });
    return "invoice.paid sem checkout rastreado — caso aberto para conciliação";
  }
  const session: Record<string, unknown> = {
    id: checkout.stripeSessionId || `invoice_${String(invoice.id || "unknown")}`,
    customer: invoice.customer,
    subscription: subscriptionIdDe(invoice),
    invoice: typeof invoice.id === "string" ? invoice.id : null,
    payment_intent: typeof invoice.payment_intent === "string" ? invoice.payment_intent : null,
    payment_status: "paid",
  };
  return handlePaymentConfirmed(session, checkout);
}

export async function handleSubscriptionLink(subscription: Record<string, unknown>): Promise<string> {
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
export async function handleCheckoutExpired(session: Record<string, unknown>): Promise<string> {
  const stripeSessionId = typeof session.id === "string" ? session.id : null;
  if (!stripeSessionId) return "session sem id";
  const checkout = await buscarCheckoutPorSessionId(stripeSessionId);
  if (!checkout) return `checkout não rastreado pra session ${stripeSessionId}`;
  if (checkout.status === "pago") return "checkout já pago antes de expirar, ignorando";
  if (checkout.status === "expirado") return "checkout já estava expirado (idempotente)";

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
export async function handleAsyncPaymentFailed(session: Record<string, unknown>): Promise<string> {
  const stripeSessionId = typeof session.id === "string" ? session.id : null;
  if (!stripeSessionId) return "session sem id";

  const checkout = await buscarCheckoutPorSessionId(stripeSessionId);
  if (!checkout) return `checkout não rastreado pra session ${stripeSessionId}`;
  if (checkout.status === "pago") return "checkout já pago, ignorando falha antiga (boleto duplicado)";
  if (checkout.status === "falhou") return "falha do boleto já registrada (idempotente)";

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
    await inserirNotificacaoUmaVez({
      usuarioId: proposta.criadoPorId,
      tipo: "pagamento_falhou",
      titulo: `Boleto não compensou — ${quem}`,
      mensagem: `O boleto da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} venceu sem pagamento. O link ${appUrl()}/p/${proposta.id} já gera um checkout novo automaticamente — combine com o cliente uma nova forma de pagamento.`,
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
/* Dono da conta = responsável do lead ou, sem ele, o dono da carteira (clientes.responsavel_id).
   Só o lead deixava quase todo aviso de cobrança/cancelamento cair em TODOS os admins. */
const responsavelDaContaSql = sql<string | null>`COALESCE(${leads.responsavelId}, (SELECT cl.responsavel_id FROM clientes cl WHERE cl.empresa_id = ${leads.empresaId} AND cl.responsavel_id IS NOT NULL LIMIT 1))`;

export async function handleInvoicePaymentFailed(invoice: Record<string, unknown>): Promise<string> {
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
    .select({ id: leads.id, nome: leads.nome, empresa: leads.empresa, responsavelId: responsavelDaContaSql })
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
    await inserirNotificacaoUmaVez({
      usuarioId,
      tipo: "pagamento_falhou",
      titulo: `Pagamento falhou — ${quem}`,
      mensagem,
      link: `/financeiro`,
    }).catch((e) => console.error("[StripeWebhook] falha ao notificar pagamento falho:", e));
  }
  return `pagamento falhou de ${quem} — ${destinatarios.length} notificado(s)`;
}

/**
 * Dinheiro que entrou sem passar pelo CRM vira CASO, não silêncio.
 *
 * Os dois handlers de pagamento saíam com uma string quando não achavam linha
 * em `checkouts`, e o evento era marcado como processado com sucesso. O
 * `syncStripe` depois criava assinatura, contrato e fatura — então o dinheiro
 * aparecia no Financeiro e o negócio ficava aberto no pipeline para sempre.
 * É o "signup direto nunca dá ganho automático".
 *
 * Marcar ganho automaticamente seria pior: sem saber qual negócio o pagamento
 * fecha, o sistema escolheria errado. Então o fato fica registrado na fila que
 * já existe para isto (`billing_resolution_cases`, até hoje vazia) com a
 * evidência, e uma pessoa decide.
 *
 * `onConflictDoNothing` na chave do objeto: o Stripe reentrega evento, e abrir
 * o mesmo caso três vezes transformaria a fila em ruído.
 */
async function abrirCasoDePagamentoOrfao(params: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  referencia: string;
  tipo: string;
  valor: number | null;
}): Promise<void> {
  const lead = await leadDoCustomer(params.stripeCustomerId);
  await db.insert(billingResolutionCases).values({
    organizacaoId: lead?.organizacaoId ?? null,
    queue: "PAGAMENTO_SEM_NEGOCIO",
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    crmEntityType: lead ? "lead" : null,
    crmEntityId: lead?.id ?? null,
    evidence: {
      tipo: params.tipo,
      referencia: params.referencia,
      valor: params.valor,
      cliente: lead?.empresa || lead?.nome || null,
      detectadoEm: new Date().toISOString(),
    },
    recommendedAction: {
      acao: "vincular_a_negocio_ou_registrar_venda",
      porque: "pagamento confirmado no Stripe sem checkout correspondente no CRM; o negócio não foi marcado ganho",
    },
  }).catch((e) => console.error("[StripeWebhook] falha ao abrir caso de pagamento órfão:", e));

  if (lead) {
    const quem = lead.empresa || lead.nome || "cliente";
    for (const usuarioId of await destinatariosDaConta(lead.responsavelId)) {
      await inserirNotificacaoUmaVez({
        usuarioId,
        tipo: "pagamento_sem_negocio",
        titulo: `Pagamento sem negócio — ${quem}`,
        mensagem:
          `${quem} pagou${params.valor ? ` R$ ${params.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""} ` +
          `e não há checkout do CRM correspondente. O dinheiro entra no Financeiro, mas nenhum negócio foi marcado ganho — registre a venda.`,
        link: `/clientes${lead.empresaId ? `/${lead.empresaId}` : ""}`,
      }).catch(() => {});
    }
  }
}

/* ── Risco pós-venda: estorno, contestação e cancelamento ──────────────── */

/** Quem avisar sobre esta conta: o responsável; sem ele, os admins ativos. */
export async function destinatariosDaConta(responsavelId: string | null): Promise<string[]> {
  if (responsavelId) return [responsavelId];
  const admins = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.role, "admin"), eq(usuarios.ativo, true)));
  return admins.map((a) => a.id);
}

/** O lead ligado a um customer do Stripe, com o responsável da conta. */
export async function leadDoCustomer(customerId: string | null) {
  if (!customerId) return null;
  const [lead] = await db
    .select({ id: leads.id, nome: leads.nome, empresa: leads.empresa, empresaId: leads.empresaId, responsavelId: responsavelDaContaSql, organizacaoId: leads.organizacaoId })
    .from(leads)
    .where(eq(leads.stripeCustomerId, customerId))
    .limit(1);
  return lead ?? null;
}

/**
 * `charge.refunded` — dinheiro devolvido.
 *
 * Sem isto, um negócio estornado continuava `ganho` com MRR vivo: o Financeiro
 * mostrava receita que voltou para o cliente. O reembolso pode ser PARCIAL, e
 * aí a decisão é comercial, não automática — por isso o handler registra e
 * chama gente, em vez de reverter o ganho sozinho.
 */
export async function handleChargeRefunded(charge: Record<string, unknown>): Promise<string> {
  const customerId = typeof charge.customer === "string" ? charge.customer : null;
  const lead = await leadDoCustomer(customerId);
  const total = typeof charge.amount === "number" ? charge.amount / 100 : 0;
  const devolvido = typeof charge.amount_refunded === "number" ? charge.amount_refunded / 100 : 0;
  const parcial = devolvido > 0 && devolvido < total;
  const quem = lead?.empresa || lead?.nome || customerId || "cliente";
  const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  if (!lead) return `estorno de R$ ${reais(devolvido)} do customer ${customerId} sem lead no CRM`;

  for (const usuarioId of await destinatariosDaConta(lead.responsavelId)) {
    await inserirNotificacaoUmaVez({
      usuarioId,
      tipo: "estorno",
      titulo: `${parcial ? "Estorno parcial" : "Estorno"} — ${quem}`,
      mensagem:
        `R$ ${reais(devolvido)}${parcial ? ` de R$ ${reais(total)}` : ""} devolvidos a ${quem}. ` +
        `Confira se o negócio deve sair de ganho e se a entrega continua.`,
      link: `/clientes${lead.empresaId ? `/${lead.empresaId}` : ""}`,
    }).catch((e) => console.error("[StripeWebhook] falha ao notificar estorno:", e));
  }

  await publicarEvento({
    organizacaoId: lead.organizacaoId,
    eventType: "PaymentRefunded",
    aggregateType: "lead",
    aggregateId: lead.id,
    payload: { customerId, valorDevolvido: devolvido, valorTotal: total, parcial },
  }).catch(() => {});

  return `estorno de R$ ${reais(devolvido)} de ${quem} registrado`;
}

/**
 * `charge.dispute.*` — o cliente contestou no cartão.
 *
 * Tem prazo: a janela de resposta ao emissor é curta, e perder por silêncio é
 * o pior desfecho. Por isso avisa na criação e no encerramento, dizendo quem
 * ganhou. Boleto não tem contestação, então isto é caminho de cartão.
 */
export async function handleDispute(dispute: Record<string, unknown>, encerrada: boolean): Promise<string> {
  const customerId = typeof dispute.customer === "string" ? dispute.customer : null;
  const lead = await leadDoCustomer(customerId);
  const valor = typeof dispute.amount === "number" ? dispute.amount / 100 : 0;
  const status = typeof dispute.status === "string" ? dispute.status : "desconhecido";
  const quem = lead?.empresa || lead?.nome || customerId || "cliente";
  const reais = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  if (!lead) return `contestação de R$ ${reais} sem lead no CRM`;

  const ganhamos = status === "won";
  const titulo = encerrada
    ? `Contestação ${ganhamos ? "ganha" : "perdida"} — ${quem}`
    : `Contestação aberta — ${quem}`;
  const mensagem = encerrada
    ? `A contestação de R$ ${reais} de ${quem} foi encerrada como "${status}".` +
      (ganhamos ? "" : " O valor foi devolvido ao cliente.")
    : `${quem} contestou R$ ${reais} no cartão. Há prazo para responder ao emissor — ` +
      `junte comprovante de entrega e contrato no painel do Stripe.`;

  for (const usuarioId of await destinatariosDaConta(lead.responsavelId)) {
    await inserirNotificacaoUmaVez({
      usuarioId, tipo: "contestacao", titulo, mensagem,
      link: `/clientes${lead.empresaId ? `/${lead.empresaId}` : ""}`,
    }).catch((e) => console.error("[StripeWebhook] falha ao notificar contestação:", e));
  }
  return encerrada ? `contestação de ${quem} encerrada (${status})` : `contestação de ${quem} aberta`;
}

/**
 * `customer.subscription.deleted` — a assinatura acabou.
 *
 * O cancelamento costuma ser feito direto no Stripe, e o CRM ficava sem saber:
 * cliente aparecia ativo numa carteira que já não existia. O espelho é
 * atualizado pelo `syncStripe` logo depois deste handler, então aqui o trabalho
 * é o que o sync NÃO faz — avisar gente e abrir a pendência do motivo.
 *
 * O motivo importa: sem ele não há como auditar churn. O Stripe só traz
 * `cancellation_details` quando o cancelamento passou pelo portal com o motivo
 * ligado; cancelado à mão no Dashboard vem vazio, e aí alguém precisa
 * preencher.
 */
export async function handleSubscriptionCanceled(subscription: Record<string, unknown>): Promise<string> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const lead = await leadDoCustomer(customerId);
  const detalhes = subscription.cancellation_details as Record<string, unknown> | undefined;
  const motivoStripe = [detalhes?.reason, detalhes?.feedback, detalhes?.comment]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(" · ");
  const quem = lead?.empresa || lead?.nome || customerId || "cliente";
  if (!lead) return `cancelamento do customer ${customerId} sem lead no CRM`;

  const temMotivo = motivoStripe.length > 0;
  for (const usuarioId of await destinatariosDaConta(lead.responsavelId)) {
    await inserirNotificacaoUmaVez({
      usuarioId,
      tipo: temMotivo ? "cancelamento" : "cancelamento_sem_motivo",
      titulo: `Assinatura cancelada — ${quem}`,
      mensagem: temMotivo
        ? `${quem} cancelou. Motivo informado: ${motivoStripe}.`
        : `${quem} cancelou e o Stripe não trouxe motivo — provavelmente foi cancelado à mão. ` +
          `Registre o motivo para o churn ficar auditável.`,
      link: `/clientes${lead.empresaId ? `/${lead.empresaId}` : ""}`,
    }).catch((e) => console.error("[StripeWebhook] falha ao notificar cancelamento:", e));
  }

  await publicarEvento({
    organizacaoId: lead.organizacaoId,
    eventType: "SubscriptionCanceled",
    aggregateType: "lead",
    aggregateId: lead.id,
    payload: { customerId, subscriptionId: subscription.id, motivo: motivoStripe || null, motivoPendente: !temMotivo },
  }).catch(() => {});

  return `cancelamento de ${quem} registrado${temMotivo ? "" : " (motivo pendente)"}`;
}
