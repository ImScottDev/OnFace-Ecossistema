/**
 * Stripe Sync — fonte da verdade de billing do Callface AI.
 *
 * Roda no worker (job "stripe-sync", a cada 30 min) e também pode ser chamado
 * manualmente. Faz polling da API do Stripe (funciona em localhost — conexão
 * de saída; quando o CRM for publicado, dá pra trocar por webhook):
 *
 *  1. Assinaturas: upsert em `assinaturas` (status, MRR, cancelamento)
 *  2. Contratos espelho: assinatura ativa/past_due → contrato ativo na Carteira;
 *     cancelada → contrato churned (churn AI registrado SEM depender de humano)
 *  3. Faturas: upsert em `faturas` (paga/aberta/falhou — visão de inadimplência)
 *
 * Requer STRIPE_API_KEY no .env (restricted key, read-only).
 */
import { db } from "../db";
import { assinaturas, contratos, faturas, leads, organizacoes } from "../db/schema";
import { eq, sql } from "drizzle-orm";

const STRIPE_API = "https://api.stripe.com/v1";

type StripeList<T> = { data: T[]; has_more: boolean };

async function stripeGet<T>(path: string, params: Record<string, string> = {}): Promise<StripeList<T>> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada no .env");
  const url = new URL(`${STRIPE_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Stripe ${path}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function paginate<T extends { id: string }>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const items: T[] = [];
  let startingAfter: string | undefined;
  for (let i = 0; i < 50; i++) {
    const p = { ...params, limit: "100" };
    if (startingAfter) (p as Record<string, string>).starting_after = startingAfter;
    const page = await stripeGet<T>(path, p);
    items.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return items;
}

function mrrOf(sub: StripeSubscription): number {
  let mrr = 0;
  for (const it of sub.items?.data || []) {
    const p = it.price;
    if (!p?.recurring || !p.unit_amount) continue;
    const months =
      ({ month: 1, year: 12, week: 0.25, day: 1 / 30 } as Record<string, number>)[p.recurring.interval] *
      (p.recurring.interval_count || 1);
    mrr += (p.unit_amount / 100) * (it.quantity || 1) / months;
  }
  return Math.round(mrr * 100) / 100;
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  start_date?: number;
  canceled_at?: number | null;
  current_period_end?: number;
  items?: { data: { quantity?: number; price: { id: string; unit_amount: number | null; recurring?: { interval: string; interval_count?: number } | null } }[] };
}

interface StripeInvoice {
  id: string;
  customer: string;
  status: string;
  amount_due: number;
  created: number;
  period_start?: number;
  attempt_count?: number;
  status_transitions?: { paid_at?: number | null };
  parent?: { subscription_details?: { subscription?: string } };
  subscription?: string | { id: string };
}

const INVOICE_STATUS: Record<string, string> = {
  paid: "paga",
  open: "aberta",
  void: "void",
  uncollectible: "uncollectible",
  draft: "rascunho",
};

export async function syncStripe(): Promise<{ subs: number; faturas: number; churns: number }> {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  if (!org) throw new Error("organização não encontrada");

  // mapa customer -> lead (preenchido pela importação; novos clientes entram aqui)
  const leadRows = await db
    .select({ id: leads.id, stripeCustomerId: leads.stripeCustomerId, empresaId: leads.empresaId })
    .from(leads)
    .where(sql`${leads.stripeCustomerId} IS NOT NULL`);
  const leadByCustomer = new Map(leadRows.map((l) => [l.stripeCustomerId as string, l]));

  const subs = await paginate<StripeSubscription>("subscriptions", { status: "all" });
  let churns = 0;

  for (const s of subs) {
    const lead = leadByCustomer.get(s.customer);
    const mrr = mrrOf(s);
    const canceladaEm = s.canceled_at ? new Date(s.canceled_at * 1000) : null;

    const [existing] = await db
      .select({ id: assinaturas.id, status: assinaturas.status, contratoId: assinaturas.contratoId })
      .from(assinaturas)
      .where(eq(assinaturas.stripeSubscriptionId, s.id));

    if (existing) {
      await db
        .update(assinaturas)
        .set({
          status: s.status,
          mrr: String(mrr),
          canceladaEm,
          currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
          syncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(assinaturas.id, existing.id));

      // transição de status -> reflete no contrato espelho (Carteira)
      if (existing.contratoId) {
        if (s.status === "canceled" && existing.status !== "canceled") {
          await db
            .update(contratos)
            .set({
              status: "churned",
              motivoChurn: "Assinatura cancelada no Stripe (sync automático)",
              finalizadoAt: canceladaEm || new Date(),
              updatedAt: new Date(),
            })
            .where(eq(contratos.id, existing.contratoId));
          churns++;
        } else if (s.status === "active" && existing.status !== "active") {
          await db
            .update(contratos)
            .set({ status: "ativo", updatedAt: new Date() })
            .where(eq(contratos.id, existing.contratoId));
        }
      }
    } else if (lead) {
      // assinatura nova de cliente conhecido
      const [contrato] = await db
        .insert(contratos)
        .values({
          organizacaoId: org.id,
          leadId: lead.id,
          tipo: "assinatura",
          descricao: "Assinatura Stripe (sync automático)",
          mrr: String(mrr),
          status: s.status === "canceled" ? "churned" : "ativo",
          produto: "ai",
          stripeSubscriptionId: s.id,
          renovacaoAuto: true,
          inicio: s.start_date ? new Date(s.start_date * 1000).toISOString().slice(0, 10) : null,
          finalizadoAt: canceladaEm,
        })
        .returning({ id: contratos.id });
      await db.insert(assinaturas).values({
        organizacaoId: org.id,
        leadId: lead.id,
        empresaId: lead.empresaId,
        contratoId: contrato?.id,
        stripeSubscriptionId: s.id,
        stripeCustomerId: s.customer,
        quantidade: s.items?.data?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 1,
        mrr: String(mrr),
        status: s.status,
        iniciadaEm: s.start_date ? new Date(s.start_date * 1000) : null,
        canceladaEm,
        currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
        syncedAt: new Date(),
      });
    }
    // cliente totalmente novo (sem lead): fica pro próximo import/clientes — logado abaixo
  }

  // faturas dos últimos 60 dias (cobre retries de cobrança)
  const since = Math.floor(Date.now() / 1000) - 60 * 24 * 3600;
  const invoices = await paginate<StripeInvoice>("invoices", { "created[gte]": String(since) });
  let nFat = 0;
  for (const inv of invoices) {
    const lead = leadByCustomer.get(inv.customer);
    if (!lead) continue;
    const subId =
      inv.parent?.subscription_details?.subscription ||
      (typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id);
    const [ass] = subId
      ? await db.select({ id: assinaturas.id }).from(assinaturas).where(eq(assinaturas.stripeSubscriptionId, subId))
      : [undefined];
    const comp = new Date((inv.period_start || inv.created) * 1000);
    const paidAt = inv.status_transitions?.paid_at;
    await db
      .insert(faturas)
      .values({
        organizacaoId: org.id,
        leadId: lead.id,
        empresaId: lead.empresaId,
        assinaturaId: ass?.id,
        origem: "stripe",
        externalId: inv.id,
        valor: String(inv.amount_due / 100),
        status: INVOICE_STATUS[inv.status] || inv.status,
        competencia: new Date(comp.getFullYear(), comp.getMonth(), 1).toISOString().slice(0, 10),
        emitidaEm: new Date(inv.created * 1000),
        pagaEm: paidAt ? new Date(paidAt * 1000) : null,
        tentativas: inv.attempt_count || 0,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [faturas.origem, faturas.externalId],
        set: {
          status: INVOICE_STATUS[inv.status] || inv.status,
          pagaEm: paidAt ? new Date(paidAt * 1000) : null,
          tentativas: inv.attempt_count || 0,
          syncedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    nFat++;
  }

  console.log(`[StripeSync] ${subs.length} assinaturas, ${nFat} faturas, ${churns} churns detectados`);
  return { subs: subs.length, faturas: nFat, churns };
}
