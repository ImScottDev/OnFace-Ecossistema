/**
 * Auditoria Stripe × CRM — estritamente read-only.
 *
 * Uso (executar onde DATABASE_URL e uma STRIPE_API_KEY somente leitura existam):
 *   npx tsx src/scripts/auditar-stripe-crm-billing.ts --out /caminho/auditoria
 *
 * Não importa nem chama funções de correção. Não cria billing identity, alias,
 * caso ou ledger: a saída é o insumo revisável para o lote CRM-only aprovado.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { empresas, leads, propostas, negocios, contratos, assinaturas, faturas } from "../lib/db/schema";
import { normalizeCnpj, normalizeEmail } from "../lib/integrations/billing-identity";

const STRIPE_API = "https://api.stripe.com/v1";
const outIndex = process.argv.indexOf("--out");
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : null;
if (!outDir || outDir.startsWith("-")) throw new Error("Use --out /diretório/para/os-artefatos");
const auditOutputDir: string = outDir;
if (!process.env.STRIPE_API_KEY) throw new Error("STRIPE_API_KEY não configurada (use chave restricted read-only)");

type StripeList<T> = { data: T[]; has_more: boolean };
type Customer = { id: string; name?: string | null; email?: string | null; phone?: string | null; metadata?: Record<string, string>; created: number; delinquent?: boolean; balance?: number };
type Subscription = {
  id: string; customer: string | Customer; status: string; created: number;
  cancel_at_period_end?: boolean; current_period_end?: number;
  items?: { data?: Array<{
    id: string; quantity?: number;
    price?: { id?: string; unit_amount?: number | null; currency?: string; recurring?: { interval?: string; interval_count?: number } | null; product?: string };
  }> };
};
type Invoice = { id: string; customer?: string; subscription?: string | { id: string } | null; status?: string | null; amount_due?: number; amount_paid?: number; currency?: string; created: number; due_date?: number | null; hosted_invoice_url?: string | null; payment_intent?: string | null; metadata?: Record<string, string> };
type PaymentMethod = { id: string; type?: string; card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number }; created: number };
type Refund = { id: string; payment_intent?: string | null; amount?: number; currency?: string; status?: string; created: number; metadata?: Record<string, string> };
type Dispute = { id: string; payment_intent?: string | null; amount?: number; currency?: string; status?: string; reason?: string; created: number };
type CustomerBalanceTransaction = { id: string; amount?: number; currency?: string; type?: string; created: number; description?: string | null };

async function stripeGet<T>(resource: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${STRIPE_API}/${resource}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.STRIPE_API_KEY}` } });
  if (!response.ok) throw new Error(`Stripe GET ${resource}: ${response.status} ${(await response.text()).slice(0, 400)}`);
  return response.json() as Promise<T>;
}

async function listAll<T extends { id: string }>(resource: string, params: Record<string, string> = {}): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  do {
    const page = await stripeGet<StripeList<T>>(resource, { ...params, limit: "100", ...(after ? { starting_after: after } : {}) });
    rows.push(...page.data);
    after = page.has_more && page.data.length ? page.data[page.data.length - 1].id : undefined;
  } while (after);
  return rows;
}

function customerCnpj(customer: Customer): string | null {
  const metadata = customer.metadata || {};
  return normalizeCnpj(metadata.crm_cnpj || metadata.user_cnpj || metadata.cnpj);
}

function mrr(subscription: Subscription): number {
  let total = 0;
  for (const item of subscription.items?.data || []) {
    const recurring = item.price?.recurring;
    const unit = item.price?.unit_amount;
    if (!recurring || unit == null) continue;
    const intervalMonths: Record<string, number> = { month: 1, year: 12, week: 0.25, day: 1 / 30 };
    total += (unit / 100) * (item.quantity || 1) / ((intervalMonths[recurring.interval || "month"] || 1) * (recurring.interval_count || 1));
  }
  return Math.round(total * 100) / 100;
}

function stripeCustomerId(customer: Subscription["customer"]): string {
  return typeof customer === "string" ? customer : customer.id;
}

function queueFor(group: { customerIds: string[]; cnpj?: string | null; email?: string | null; crmCompanies: unknown[]; crmLeads: unknown[]; metadataCrmIds: string[] }): "CONFIRMED" | "REVIEW" | "CONFLICT" {
  const cnpjStrong = !!group.cnpj && group.crmCompanies.length === 1;
  const metadataStrong = group.metadataCrmIds.length > 0;
  if ((cnpjStrong || metadataStrong) && group.crmLeads.length === 1) return "CONFIRMED";
  if (group.crmCompanies.length > 1 || group.crmLeads.length > 1) return "CONFLICT";
  if (group.customerIds.length > 1 || !!group.email || !!group.cnpj) return "REVIEW";
  return "CONFLICT";
}

async function main() {
  const [crmEmpresas, crmLeads, crmPropostas, crmNegocios, crmContratos, crmAssinaturas, crmFaturas] = await Promise.all([
    db.select().from(empresas), db.select().from(leads), db.select().from(propostas), db.select().from(negocios),
    db.select().from(contratos), db.select().from(assinaturas), db.select().from(faturas),
  ]);

  const [customers, subscriptions, invoices, refunds, disputes] = await Promise.all([
    listAll<Customer>("customers"),
    listAll<Subscription>("subscriptions", { status: "all", "expand[]": "data.customer" }),
    listAll<Invoice>("invoices"),
    listAll<Refund>("refunds"),
    listAll<Dispute>("disputes"),
  ]);

  // These calls intentionally retain only payment-method summaries: no secrets,
  // no payment intent payloads and no customer address data leave the audit.
  const paymentMethods: Record<string, PaymentMethod[]> = {};
  const credits: Record<string, CustomerBalanceTransaction[]> = {};
  for (const customer of customers) {
    paymentMethods[customer.id] = await listAll<PaymentMethod>("payment_methods", { customer: customer.id, type: "card" });
    credits[customer.id] = await listAll<CustomerBalanceTransaction>(`customers/${customer.id}/balance_transactions`);
  }

  const byCnpj = new Map<string, typeof crmEmpresas>();
  for (const empresa of crmEmpresas) {
    const key = normalizeCnpj(empresa.cnpj);
    if (key) byCnpj.set(key, [...(byCnpj.get(key) || []), empresa]);
  }
  const byEmail = new Map<string, typeof crmLeads>();
  for (const lead of crmLeads) {
    const key = normalizeEmail(lead.email);
    if (key) byEmail.set(key, [...(byEmail.get(key) || []), lead]);
  }

  const subscriptionsByCustomer = new Map<string, Subscription[]>();
  const invoicesByCustomer = new Map<string, Invoice[]>();
  for (const subscription of subscriptions) {
    const id = stripeCustomerId(subscription.customer);
    subscriptionsByCustomer.set(id, [...(subscriptionsByCustomer.get(id) || []), subscription]);
  }
  for (const invoice of invoices) if (invoice.customer) invoicesByCustomer.set(invoice.customer, [...(invoicesByCustomer.get(invoice.customer) || []), invoice]);

  // Group only when a safe discovery signal exists. Name and phone are emitted
  // as context but never participate in grouping.
  const groups = new Map<string, Customer[]>();
  for (const customer of customers) {
    const cnpj = customerCnpj(customer);
    const email = normalizeEmail(customer.email);
    const key = cnpj ? `cnpj:${cnpj}` : email ? `email:${email}` : `customer:${customer.id}`;
    groups.set(key, [...(groups.get(key) || []), customer]);
  }

  const dossiers = [...groups.entries()].map(([key, groupCustomers]) => {
    const cnpj = customerCnpj(groupCustomers[0]);
    const email = normalizeEmail(groupCustomers[0].email);
    const customerIds = groupCustomers.map((customer) => customer.id);
    const companyMatches = cnpj ? (byCnpj.get(cnpj) || []) : [];
    const leadMatches = [
      ...(email ? (byEmail.get(email) || []) : []),
      ...crmLeads.filter((lead) => companyMatches.some((empresa) => empresa.id === lead.empresaId)),
    ].filter((lead, index, all) => all.findIndex((item) => item.id === lead.id) === index);
    const metadataCrmIds = groupCustomers.flatMap((customer) => [customer.metadata?.crm_lead_id, customer.metadata?.crm_empresa_id].filter(Boolean) as string[]);
    const queue = queueFor({ customerIds, cnpj, email, crmCompanies: companyMatches, crmLeads: leadMatches, metadataCrmIds });
    const groupSubscriptions = customerIds.flatMap((id) => subscriptionsByCustomer.get(id) || []);
    const groupInvoices = customerIds.flatMap((id) => invoicesByCustomer.get(id) || []);
    const activeMrr = groupSubscriptions.filter((sub) => ["active", "past_due", "trialing"].includes(sub.status)).reduce((total, sub) => total + mrr(sub), 0);
    const canonical = groupCustomers.slice().sort((a, b) => a.created - b.created)[0];
    return {
      key, queue,
      identityEvidence: { cnpj, email, metadataCrmIds, customerIds, crmEmpresaIds: companyMatches.map((x) => x.id), crmLeadIds: leadMatches.map((x) => x.id) },
      currentState: {
        canonicalCustomerCandidate: canonical.id,
        customers: groupCustomers.map((customer) => ({ id: customer.id, created: customer.created, name: customer.name || null, email: customer.email || null, metadata: customer.metadata || {}, paymentMethods: (paymentMethods[customer.id] || []).map((pm) => ({ id: pm.id, type: pm.type, card: pm.card || null })), credits: credits[customer.id] || [] })),
        subscriptions: groupSubscriptions.map((sub) => ({ id: sub.id, customerId: stripeCustomerId(sub.customer), status: sub.status, mrr: mrr(sub), cancelAtPeriodEnd: !!sub.cancel_at_period_end, items: sub.items?.data || [] })),
        invoices: groupInvoices.map((invoice) => ({ id: invoice.id, customer: invoice.customer, subscription: typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null, status: invoice.status, amountDue: invoice.amount_due, amountPaid: invoice.amount_paid, currency: invoice.currency, dueDate: invoice.due_date, paymentIntent: invoice.payment_intent })),
        refunds: refunds.filter((refund) => groupInvoices.some((invoice) => invoice.payment_intent && invoice.payment_intent === refund.payment_intent)),
        disputes: disputes.filter((dispute) => groupInvoices.some((invoice) => invoice.payment_intent && invoice.payment_intent === dispute.payment_intent)),
        mrr: Math.round(activeMrr * 100) / 100,
      },
      crm: {
        empresas: companyMatches,
        leads: leadMatches,
        propostas: crmPropostas.filter((proposal) => leadMatches.some((lead) => lead.id === proposal.leadId)),
        negocios: crmNegocios.filter((deal) => leadMatches.some((lead) => lead.id === deal.leadId)),
        contratos: crmContratos.filter((contract) => leadMatches.some((lead) => lead.id === contract.leadId)),
        assinaturas: crmAssinaturas.filter((subscription) => customerIds.includes(subscription.stripeCustomerId || "") || groupSubscriptions.some((stripeSub) => stripeSub.id === subscription.stripeSubscriptionId)),
        faturas: crmFaturas.filter((invoice) => leadMatches.some((lead) => lead.id === invoice.leadId)),
      },
      recommendedCrmAction: queue === "CONFIRMED"
        ? { action: "CREATE_OR_UPDATE_BILLING_IDENTITY", canonicalCustomerId: canonical.id, aliases: customerIds.filter((id) => id !== canonical.id), requiresLedger: true, stripeAction: "NONE" }
        : { action: "HUMAN_REVIEW", stripeAction: "NONE", reason: queue === "CONFLICT" ? "evidências divergentes ou múltiplos candidatos" : "prova insuficiente para correção automática" },
      proposedStripeFuture: groupCustomers.length > 1
        ? "Não executar: analisar assinatura por assinatura. Manter vendas legítimas; migrar apenas com plano aprovado que evite dupla cobrança."
        : "Nenhuma ação Stripe proposta.",
    };
  });

  const queues = { CONFIRMED: dossiers.filter((x) => x.queue === "CONFIRMED"), REVIEW: dossiers.filter((x) => x.queue === "REVIEW"), CONFLICT: dossiers.filter((x) => x.queue === "CONFLICT") };
  const report = {
    generatedAt: new Date().toISOString(), readOnly: true,
    scope: { customers: customers.length, subscriptions: subscriptions.length, invoices: invoices.length, refunds: refunds.length, disputes: disputes.length, crm: { empresas: crmEmpresas.length, leads: crmLeads.length, propostas: crmPropostas.length, negocios: crmNegocios.length, contratos: crmContratos.length, assinaturas: crmAssinaturas.length, faturas: crmFaturas.length } },
    queues,
  };
  await mkdir(auditOutputDir, { recursive: true });
  await writeFile(path.join(auditOutputDir, "stripe-crm-audit.json"), JSON.stringify(report, null, 2));
  const markdown = [
    "# Auditoria Stripe × CRM", "", `Gerada em ${report.generatedAt}. Execução read-only: Stripe e CRM não foram alterados.`, "",
    "## Cobertura", "", `- Customers Stripe: ${customers.length}`, `- Assinaturas Stripe: ${subscriptions.length}`, `- Faturas Stripe: ${invoices.length}`, `- Confirmados: ${queues.CONFIRMED.length}`, `- Revisão humana: ${queues.REVIEW.length}`, `- Conflitos: ${queues.CONFLICT.length}`, "",
    "## Regras", "", "CNPJ e metadata CRM comprovada podem confirmar; e-mail só é complementar; nome e telefone não agrupam nem autorizam consolidação. Toda proposta Stripe permanece somente como proposta.", "",
    ...Object.entries(queues).flatMap(([queue, items]) => [
      `## ${queue}`, "", ...items.map((item) => `- ${item.key}: Customers ${item.identityEvidence.customerIds.join(", ")}; MRR R$ ${item.currentState.mrr.toFixed(2)}; ação CRM: ${item.recommendedCrmAction.action}.`), "",
    ]),
  ].join("\n");
  await writeFile(path.join(auditOutputDir, "stripe-crm-audit.md"), markdown);
  console.log(JSON.stringify({ outDir: auditOutputDir, scope: report.scope, queues: Object.fromEntries(Object.entries(queues).map(([key, value]) => [key, value.length])) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
