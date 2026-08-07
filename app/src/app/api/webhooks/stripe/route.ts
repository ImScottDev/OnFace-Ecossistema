import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { syncStripe } from "@/lib/integrations/stripe-sync";
import { db } from "@/lib/db";
import { propostas, leads, empresas, contratos, notificacoes, usuarios } from "@/lib/db/schema";
import { eq, and, inArray, isNull, or } from "drizzle-orm";
import { marcarPropostaAceita } from "@/lib/crm/aceitar-proposta";

/**
 * Pagamento CONFIRMADO (payment_status === "paid"): acha a proposta pela metadata
 * (gravada na criação do checkout) e marca como aceita → negócio ganho +
 * contrato + cliente.
 *
 * Hardening da auditoria Stripe 21/07:
 * - CLAIM ATÔMICO: `UPDATE ... WHERE status IN (...) RETURNING` — duas entregas
 *   concorrentes do mesmo evento (retry do Stripe) não geram contrato duplicado.
 * - Aceita também proposta EXPIRADA/RECUSADA: boleto compensa em ~1 dia útil e podia
 *   chegar DEPOIS do job de validade marcar "expirada" — antes o pagamento era
 *   ignorado e a assinatura ficava cobrando no Stripe sem contrato no CRM.
 * - Em falha, o status é revertido e o handler estoura → resposta 500 → o Stripe
 *   REENVIA o evento (antes: log + 200 = pagamento confirmado perdido pra sempre).
 * - Captura session.customer → leads.stripe_customer_id e session.subscription →
 *   contratos.stripe_subscription_id: sem isso, a venda feita pelo checkout ficava
 *   fora do espelho de billing (churn/inadimplência cegos pra vendas novas).
 */
async function handlePaymentConfirmed(session: Record<string, unknown>): Promise<string> {
  const metadata = (session.metadata as Record<string, string> | undefined) || {};
  const propostaId = metadata.propostaId;
  if (!propostaId) return "sem propostaId na metadata";

  // Status anterior (informativo, pra notificação de "pagou depois de expirar").
  const [antes] = await db.select({ status: propostas.status }).from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  const statusAnterior = antes?.status ?? null;

  // Claim atômico: só UMA execução consegue mover pra 'aceita'.
  const ACEITAVEIS = ["enviada", "expirada", "recusada"];
  const [claimed] = await db
    .update(propostas)
    .set({ status: "aceita", updatedAt: new Date() })
    .where(and(eq(propostas.id, propostaId), inArray(propostas.status, ACEITAVEIS)))
    .returning();

  if (!claimed) {
    if (!antes) return `proposta ${propostaId} não encontrada`;
    if (statusAnterior === "aceita") return "proposta já estava aceita (idempotente)";
    return `proposta em status '${statusAnterior}', ignorando`;
  }

  let contratoId: string;
  try {
    const r = await marcarPropostaAceita({
      proposta: claimed,
      organizacaoId: claimed.organizacaoId,
      userId: claimed.criadoPorId, // ator: quem criou a proposta
    });
    contratoId = r.contratoId;
  } catch (e) {
    // Reverte o claim pra o retry do Stripe reprocessar do zero.
    // (Risco residual documentado: falha no MEIO do marcarPropostaAceita pode deixar
    // contrato parcial — follow-up: transacionar o aceite. Ainda assim é estritamente
    // melhor que o comportamento antigo, que engolia o erro e perdia o pagamento.)
    await db.update(propostas).set({ status: statusAnterior ?? "enviada", updatedAt: new Date() }).where(eq(propostas.id, propostaId)).catch(() => {});
    throw e;
  }

  // Espelho de billing: liga o cliente e o contrato ao Stripe (dados já vêm no evento).
  const stripeCustomer = typeof session.customer === "string" ? session.customer : null;
  const stripeSubscription = typeof session.subscription === "string" ? session.subscription : null;
  if (stripeCustomer) {
    await db.update(leads)
      .set({ stripeCustomerId: stripeCustomer, updatedAt: new Date() })
      .where(and(eq(leads.id, claimed.leadId), or(isNull(leads.stripeCustomerId), eq(leads.stripeCustomerId, ""))))
      .catch((e) => console.error("[StripeWebhook] falha ao gravar stripeCustomerId:", e));

    // O custom_field de CPF/CNPJ coletado no checkout não é copiado pro Customer
    // sozinho (é só da sessão) — sem isso, a NF sai sem documento fiscal de novo.
    // Best-effort: se a key da API não tiver escopo de escrita em Customers, só loga.
    await gravarDocumentoFiscalNoCustomer(session, stripeCustomer).catch((e) =>
      console.error("[StripeWebhook] falha ao gravar CPF/CNPJ no Customer:", e)
    );
  }

  // Devolve os mesmos dados (documento, endereço, telefone) pro lead/empresa do
  // CRM — não fica só espelhado no Stripe. Só preenche campo vazio, nunca
  // sobrescreve o que já existe (pedido do time: nada de perder dado editado à mão).
  await gravarDadosFiscaisNoCRM(session, claimed.leadId).catch((e) =>
    console.error("[StripeWebhook] falha ao gravar dados fiscais no CRM:", e)
  );
  if (stripeSubscription) {
    await db.update(contratos)
      .set({ stripeSubscriptionId: stripeSubscription })
      .where(eq(contratos.id, contratoId))
      .catch((e) => console.error("[StripeWebhook] falha ao gravar stripeSubscriptionId:", e));
  }

  // Pagamento que chegou DEPOIS da proposta expirar/ser recusada: humano precisa saber
  // (o boleto compensou tarde — conferir valor/condições com o cliente).
  if (statusAnterior && statusAnterior !== "enviada" && claimed.criadoPorId) {
    await db.insert(notificacoes).values({
      usuarioId: claimed.criadoPorId,
      tipo: "pagamento_pos_expiracao",
      titulo: `Pagamento recebido de proposta ${statusAnterior}`,
      mensagem: `A proposta #P-${String(claimed.numero).padStart(3, "0")}-v${claimed.versao} estava '${statusAnterior}' e o pagamento compensou agora (boleto). Contrato criado — confira valor e condições com o cliente.`,
      link: `/propostas/${claimed.id}`,
    }).catch((e) => console.error("[StripeWebhook] falha ao notificar pagamento pós-expiração:", e));
  }
  return `proposta ${propostaId} aceita via pagamento, contrato ${contratoId}`;
}

/**
 * Copia o custom_field `cpfcnpj` (coletado no checkout, ver stripe-checkout.ts)
 * pra metadata do Customer no Stripe — sem isso o documento fiscal fica preso
 * na sessão e some, igual ao problema real da planilha de NFs de 03/08.
 * Detecta CPF (11 dígitos) vs CNPJ (14) pelo tamanho e grava na chave certa
 * (`user_cpf`/`user_cnpj`, mesmo padrão já usado nos clientes antigos).
 */
async function gravarDocumentoFiscalNoCustomer(session: Record<string, unknown>, customerId: string): Promise<string> {
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
 * Boleto NÃO compensou (venceu sem pagamento): antes o evento era ignorado e a
 * proposta ficava "enviada" pra sempre, com um checkout morto. Agora notifica o
 * dono da proposta pra reenviar/regenerar o link (o /p/[id] também regenera sozinho).
 */
async function handleAsyncPaymentFailed(session: Record<string, unknown>): Promise<string> {
  const metadata = (session.metadata as Record<string, string> | undefined) || {};
  const propostaId = metadata.propostaId;
  if (!propostaId) return "sem propostaId na metadata";

  const [proposta] = await db.select().from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  if (!proposta) return `proposta ${propostaId} não encontrada`;
  if (proposta.status === "aceita") return "proposta já aceita, ignorando falha antiga";

  const [lead] = await db.select({ nome: leads.nome, empresa: leads.empresa }).from(leads).where(eq(leads.id, proposta.leadId)).limit(1);
  const quem = lead?.empresa || lead?.nome || "cliente";
  if (proposta.criadoPorId) {
    await db.insert(notificacoes).values({
      usuarioId: proposta.criadoPorId,
      tipo: "pagamento_falhou",
      titulo: `Boleto não compensou — ${quem}`,
      mensagem: `O boleto da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} venceu sem pagamento. O link ${process.env.NEXTAUTH_URL || "https://crm.callface.io"}/p/${proposta.id} já gera um checkout novo automaticamente — combine com o cliente uma nova forma de pagamento.`,
      link: `/propostas/${proposta.id}`,
    }).catch((e) => console.error("[StripeWebhook] falha ao notificar boleto falhado:", e));
  }
  return `boleto falhou na proposta ${propostaId} — responsável notificado`;
}

/**
 * Cobrança recorrente FALHOU (cartão recusado — 62% do churn é isso): notifica o
 * responsável do lead (ou os admins) na hora, com valor e o hosted_invoice_url do
 * Stripe — página onde o cliente paga a fatura e atualiza o cartão sem login.
 * A recuperação automática (retries) continua com o Stripe; isso aqui é a fila
 * HUMANA agir em paralelo enquanto o atraso é recente e recuperável.
 */
async function handleInvoicePaymentFailed(invoice: Record<string, unknown>): Promise<string> {
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
//            checkout.session.async_payment_failed
//   Copiar o "Signing secret" (whsec_...) -> STRIPE_WEBHOOK_SECRET no .env.
export const dynamic = "force-dynamic";

const RELEVANT = new Set([
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
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

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = request.headers.get("stripe-signature");

  // FAIL-CLOSED (auditoria item 8): sem secret configurado, o endpoint público
  // aceitava QUALQUER payload forjado — um POST com metadata.propostaId gerava
  // contrato e promovia lead a cliente sem pagamento.
  if (!secret) {
    console.error("[StripeWebhook] STRIPE_WEBHOOK_SECRET não configurado — recusando evento (fail-closed)");
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }
  if (!verify(payload, sig, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: { type?: string; id?: string };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const type = event.type || "";
  if (!RELEVANT.has(type)) {
    return NextResponse.json({ received: true, ignored: type });
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

  // Sync incremental (idempotente: upsert por stripe id). Reconcilia assinaturas/faturas/churn.
  try {
    const r = await syncStripe();
    console.log(`[StripeWebhook] ${type} -> sync: ${r.subs} subs, ${r.faturas} faturas, ${r.churns} churns`);
    return NextResponse.json({ received: true, type, synced: r });
  } catch (e) {
    console.error("[StripeWebhook] erro no sync:", e);
    // 200 mesmo assim p/ o Stripe não ficar reenviando; o polling de 30min cobre.
    return NextResponse.json({ received: true, type, syncError: String(e) });
  }
}
