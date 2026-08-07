/**
 * Stripe Sync — fonte da verdade de billing do Callface AI.
 *
 * Roda no worker (job "stripe-sync", a cada 30 min) e é disparado pelo webhook
 * (/api/webhooks/stripe) em tempo real. Estrutura em duas fases:
 *
 *  FASE 1 (fetch, fora de transação): puxa da API do Stripe
 *    - subscriptions status=all (+ catálogo de products p/ nome do plano)
 *    - invoices dos últimos 60 dias (novas/retries)
 *    - invoices open/uncollectible SEM janela (fatura antiga não congela)
 *    - "heal": fatura aberta no CRM que sumiu dos fetches é buscada por id
 *      (pode ter sido paga/voided depois de sair da janela de 60d)
 *
 *  FASE 2 (write, transação única com pg_advisory_xact_lock): serializa syncs
 *  concorrentes (webhook + worker no mesmo instante) — mata a corrida que
 *  duplicava contrato — e grava:
 *    1. Assinaturas: status, MRR, plano (price/product), cancellation_details
 *    2. Contratos espelho: ativo/churned com MOTIVO real do cancelamento
 *    3. Faturas: status + vencimento (due_date) + hosted_invoice_url
 *    4. mrr_movimentos: diff de MRR vira novo/expansão/contração/churn/reativação
 *
 * Requer STRIPE_API_KEY no .env (restricted key, read-only).
 */
import { db } from "../db";
import { assinaturas, contratos, faturas, leads, mrrMovimentos, organizacoes, notificacoes, usuarios } from "../db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";

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

async function stripeGetOne<T>(path: string): Promise<T | null> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) return null;
  const r = await fetch(`${STRIPE_API}/${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return null;
  return r.json();
}

/**
 * Status de pagamento de uma checkout session (pro de-para de 5 dias).
 * Retorna null se não der pra consultar (sem key / erro). payment_status:
 * "paid" | "unpaid" | "no_payment_required".
 */
export async function getCheckoutSessionStatus(
  sessionId: string,
): Promise<{ status: string; payment_status: string } | null> {
  const d = await stripeGetOne<{ status?: string; payment_status?: string }>(`checkout/sessions/${sessionId}`);
  if (!d) return null;
  return { status: d.status || "", payment_status: d.payment_status || "" };
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
  customer: string | { id: string; email?: string | null; name?: string | null };
  status: string;
  start_date?: number;
  canceled_at?: number | null;
  current_period_end?: number;
  cancellation_details?: { reason?: string | null; feedback?: string | null; comment?: string | null } | null;
  items?: { data: { quantity?: number; price: { id: string; unit_amount: number | null; product?: string; recurring?: { interval: string; interval_count?: number } | null } }[] };
}

function custId(c: StripeSubscription["customer"]): string {
  return typeof c === "string" ? c : c.id;
}
function custEmail(c: StripeSubscription["customer"]): string | null {
  return typeof c === "string" ? null : (c.email || null);
}

interface StripeInvoice {
  id: string;
  customer: string;
  status: string;
  amount_due: number;
  created: number;
  due_date?: number | null;
  hosted_invoice_url?: string | null;
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

// Status que contam como "gerando receita" pro diff de MRR.
const BILLABLE = new Set(["active", "past_due", "trialing"]);

/** "payment_failed" | "cancellation_requested (too_expensive): comentário" */
function motivoCancelamento(s: StripeSubscription): string | null {
  const cd = s.cancellation_details;
  if (!cd?.reason) return null;
  let m = cd.reason;
  if (cd.feedback) m += ` (${cd.feedback})`;
  if (cd.comment) m += `: ${cd.comment}`;
  return m.slice(0, 500);
}

export async function syncStripe(): Promise<{ subs: number; faturas: number; churns: number; movimentos: number; semLead: number }> {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  if (!org) throw new Error("organização não encontrada");

  // ── FASE 1: FETCH (sem transação aberta) ──────────────────────────────────

  // expand[]=data.customer traz o e-mail do cliente junto (sem N+1 fetch) — usado
  // como fallback pra achar o lead quando o customer_id ainda não foi vinculado
  // (achado real 04/08: 47 assinaturas ativas, R$15.9k/mês, ficavam de fora do
  // espelho local pra sempre porque só existia o match por stripeCustomerId).
  const subs = await paginate<StripeSubscription>("subscriptions", { status: "all", "expand[]": "data.customer" });

  // Catálogo price.product -> nome do plano (1 fetch, habilita LTV por plano)
  const products = await paginate<{ id: string; name?: string }>("products", {});
  const productName = new Map(products.map((p) => [p.id, p.name || p.id]));

  // Faturas: janela de 60d (novas + retries) + TODAS open/uncollectible (sem janela)
  const since = Math.floor(Date.now() / 1000) - 60 * 24 * 3600;
  const invoiceMap = new Map<string, StripeInvoice>();
  for (const inv of await paginate<StripeInvoice>("invoices", { "created[gte]": String(since) })) invoiceMap.set(inv.id, inv);
  for (const st of ["open", "uncollectible"]) {
    for (const inv of await paginate<StripeInvoice>("invoices", { status: st })) invoiceMap.set(inv.id, inv);
  }

  // Heal: fatura aberta/uncollectible no CRM que não veio em nenhum fetch mudou de
  // status no Stripe depois de envelhecer (paga tarde / void). Busca por id.
  const abertasNoCrm = await db
    .select({ externalId: faturas.externalId })
    .from(faturas)
    .where(and(eq(faturas.origem, "stripe"), inArray(faturas.status, ["aberta", "uncollectible"])));
  let healed = 0;
  for (const row of abertasNoCrm) {
    const extId = row.externalId;
    if (!extId || invoiceMap.has(extId)) continue;
    const inv = await stripeGetOne<StripeInvoice>(`invoices/${extId}`);
    if (inv) {
      invoiceMap.set(inv.id, inv);
      healed++;
    }
  }

  // mapa customer -> lead (preenchido pela importação/webhook; novos clientes entram aqui)
  const leadRows = await db
    .select({ id: leads.id, stripeCustomerId: leads.stripeCustomerId, empresaId: leads.empresaId })
    .from(leads)
    .where(sql`${leads.stripeCustomerId} IS NOT NULL`);
  const leadByCustomer = new Map(leadRows.map((l) => [l.stripeCustomerId as string, l]));

  // Fallback por e-mail: cliente Stripe cujo customer_id nunca foi vinculado ao
  // lead (2ª compra com customer novo, importação antiga, etc.) — sem isso a
  // assinatura fica invisível pro sync pra sempre (achado real 04/08, 47 casos).
  const leadEmailRows = await db
    .select({ id: leads.id, email: leads.email, stripeCustomerId: leads.stripeCustomerId, empresaId: leads.empresaId })
    .from(leads)
    .where(sql`${leads.email} IS NOT NULL`);
  const leadByEmail = new Map(leadEmailRows.map((l) => [(l.email as string).toLowerCase(), l]));

  // ── FASE 2: WRITE (transação única, serializada por advisory lock) ────────

  let churns = 0;
  let movimentos = 0;
  let nFat = 0;
  const semLead: { subId: string; mrr: number; email: string | null; nome?: string }[] = [];

  await db.transaction(async (tx) => {
    // Serializa com o outro sync (webhook x worker): sem isso a corrida duplica
    // contrato espelho e movimento de MRR. Lock solto no commit/rollback.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('stripe-sync'))`);

    for (const s of subs) {
      const sCustId = custId(s.customer);
      let lead = leadByCustomer.get(sCustId);
      let precisaVincularCustomerId = false;
      if (!lead) {
        const email = custEmail(s.customer);
        if (email) {
          lead = leadByEmail.get(email.toLowerCase());
          if (lead && !lead.stripeCustomerId) precisaVincularCustomerId = true;
        }
      }
      if (lead && precisaVincularCustomerId) {
        await tx.update(leads).set({ stripeCustomerId: sCustId, updatedAt: sql`updated_at` }).where(eq(leads.id, lead.id));
        leadByCustomer.set(sCustId, lead); // próxima assinatura do mesmo customer já acha direto
      }
      const mrr = mrrOf(s);
      const canceladaEm = s.canceled_at ? new Date(s.canceled_at * 1000) : null;
      const motivo = motivoCancelamento(s);
      const item0 = s.items?.data?.[0];
      const planoNome = item0?.price?.product ? productName.get(item0.price.product) || null : null;

      const [existing] = await tx
        .select({ id: assinaturas.id, status: assinaturas.status, contratoId: assinaturas.contratoId, mrr: assinaturas.mrr, leadId: assinaturas.leadId })
        .from(assinaturas)
        .where(eq(assinaturas.stripeSubscriptionId, s.id));

      const registrarMovimento = async (
        tipo: string,
        delta: number,
        antes: number,
        depois: number,
        assinaturaId: string,
        contratoId: string | null,
        leadId: string | null,
        ocorridoEm: Date,
      ) => {
        if (Math.abs(delta) < 0.005) return;
        await tx.insert(mrrMovimentos).values({
          organizacaoId: org.id,
          leadId,
          assinaturaId,
          contratoId,
          produto: "ai",
          tipo,
          delta: delta.toFixed(2),
          mrrAntes: antes.toFixed(2),
          mrrDepois: depois.toFixed(2),
          ocorridoEm,
          origem: "stripe_sync",
        });
        movimentos++;
      };

      if (existing) {
        await tx
          .update(assinaturas)
          .set({
            status: s.status,
            mrr: String(mrr),
            canceladaEm,
            motivoCancelamento: motivo,
            produto: planoNome,
            stripePriceId: item0?.price?.id || null,
            currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
            syncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(assinaturas.id, existing.id));

        // Diff -> movimento de MRR
        const mrrAntes = Number(existing.mrr) || 0;
        const wasB = BILLABLE.has(existing.status);
        const isB = BILLABLE.has(s.status);
        if (wasB && !isB) {
          await registrarMovimento("churn", -mrrAntes, mrrAntes, 0, existing.id, existing.contratoId, existing.leadId, canceladaEm || new Date());
        } else if (!wasB && isB) {
          await registrarMovimento("reativacao", mrr, 0, mrr, existing.id, existing.contratoId, existing.leadId, new Date());
        } else if (wasB && isB && Math.abs(mrr - mrrAntes) >= 0.005) {
          await registrarMovimento(mrr > mrrAntes ? "expansao" : "contracao", mrr - mrrAntes, mrrAntes, mrr, existing.id, existing.contratoId, existing.leadId, new Date());
        }

        // transição de status -> reflete no contrato espelho (Carteira)
        if (existing.contratoId) {
          if (s.status === "canceled" && existing.status !== "canceled") {
            await tx
              .update(contratos)
              .set({
                status: "churned",
                motivoChurn: motivo || "Assinatura cancelada no Stripe (sync automático)",
                finalizadoAt: canceladaEm || new Date(),
                updatedAt: new Date(),
              })
              .where(eq(contratos.id, existing.contratoId));
            churns++;
          } else if (s.status === "active" && existing.status !== "active") {
            await tx
              .update(contratos)
              .set({ status: "ativo", updatedAt: new Date() })
              .where(eq(contratos.id, existing.contratoId));
          }
        }
      } else if (lead) {
        // assinatura nova de cliente conhecido
        const [contrato] = await tx
          .insert(contratos)
          .values({
            organizacaoId: org.id,
            leadId: lead.id,
            tipo: "assinatura",
            descricao: planoNome ? `Assinatura Stripe — ${planoNome}` : "Assinatura Stripe (sync automático)",
            mrr: String(mrr),
            status: s.status === "canceled" ? "churned" : "ativo",
            motivoChurn: s.status === "canceled" ? motivo : null,
            produto: "ai",
            stripeSubscriptionId: s.id,
            renovacaoAuto: true,
            inicio: s.start_date ? new Date(s.start_date * 1000).toISOString().slice(0, 10) : null,
            finalizadoAt: canceladaEm,
          })
          .returning({ id: contratos.id });
        const [novaAss] = await tx
          .insert(assinaturas)
          .values({
            organizacaoId: org.id,
            leadId: lead.id,
            empresaId: lead.empresaId,
            contratoId: contrato?.id,
            stripeSubscriptionId: s.id,
            stripeCustomerId: sCustId,
            produto: planoNome,
            stripePriceId: item0?.price?.id || null,
            quantidade: s.items?.data?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 1,
            mrr: String(mrr),
            status: s.status,
            motivoCancelamento: motivo,
            iniciadaEm: s.start_date ? new Date(s.start_date * 1000) : null,
            canceladaEm,
            currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
            syncedAt: new Date(),
          })
          .returning({ id: assinaturas.id });
        if (novaAss && BILLABLE.has(s.status)) {
          await registrarMovimento("novo", mrr, 0, mrr, novaAss.id, contrato?.id || null, lead.id, s.start_date ? new Date(s.start_date * 1000) : new Date());
        }
      } else if (BILLABLE.has(s.status)) {
        // Cliente pagante SEM nenhum lead correspondente (nem por customer_id, nem
        // por e-mail) — fica de fora do espelho local pra sempre até alguém revisar
        // à mão (achado real 04/08: 14 casos, R$4.1k/mês). Rastreado pra alertar,
        // não fica mais silencioso.
        semLead.push({ subId: s.id, mrr, email: custEmail(s.customer), nome: (typeof s.customer !== "string" ? s.customer.name : null) || undefined });
      }
    }

    // Faturas (upsert por origem+external_id)
    for (const inv of invoiceMap.values()) {
      const lead = leadByCustomer.get(inv.customer);
      if (!lead) continue;
      const subId =
        inv.parent?.subscription_details?.subscription ||
        (typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id);
      const [ass] = subId
        ? await tx.select({ id: assinaturas.id }).from(assinaturas).where(eq(assinaturas.stripeSubscriptionId, subId))
        : [undefined];
      const comp = new Date((inv.period_start || inv.created) * 1000);
      const paidAt = inv.status_transitions?.paid_at;
      const vencimento = inv.due_date ? new Date(inv.due_date * 1000) : null;
      await tx
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
          vencimento,
          hostedInvoiceUrl: inv.hosted_invoice_url || null,
          pagaEm: paidAt ? new Date(paidAt * 1000) : null,
          tentativas: inv.attempt_count || 0,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [faturas.origem, faturas.externalId],
          set: {
            status: INVOICE_STATUS[inv.status] || inv.status,
            vencimento,
            hostedInvoiceUrl: inv.hosted_invoice_url || null,
            pagaEm: paidAt ? new Date(paidAt * 1000) : null,
            tentativas: inv.attempt_count || 0,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      nFat++;
    }
  });

  // Alerta de divergência: clientes pagantes sem NENHUM lead correspondente ficam
  // fora do espelho local pra sempre (achado real 04/08 — antes disso o gap só
  // aparecia comparando print do Stripe com o CRM na mão). Notifica admin/gerente
  // 1x por dia (não spama a cada 30min enquanto ninguém resolver).
  if (semLead.length > 0) {
    const umDiaAtras = new Date(Date.now() - 24 * 3600 * 1000);
    const [jaAvisado] = await db
      .select({ id: notificacoes.id })
      .from(notificacoes)
      .where(and(eq(notificacoes.tipo, "stripe_sem_lead"), sql`${notificacoes.createdAt} > ${umDiaAtras}`))
      .limit(1);
    if (!jaAvisado) {
      const mrrSemLead = semLead.reduce((a, s) => a + s.mrr, 0);
      const gestores = await db
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(and(eq(usuarios.organizacaoId, org.id), inArray(usuarios.role, ["admin", "gerente", "super_admin"]), eq(usuarios.ativo, true)));
      const lista = semLead.slice(0, 10).map((s) => `${s.nome || s.email || s.subId}: R$${s.mrr.toFixed(2)}`).join("; ");
      for (const g of gestores) {
        await db.insert(notificacoes).values({
          usuarioId: g.id,
          tipo: "stripe_sem_lead",
          titulo: `${semLead.length} cliente(s) pagante(s) sem lead no CRM`,
          mensagem: `R$${mrrSemLead.toFixed(2)}/mês de MRR real no Stripe sem nenhum lead correspondente (nem por customer_id, nem por e-mail). Precisa de revisão manual. Exemplos: ${lista}`,
          link: "/financeiro",
        }).catch((e) => console.error("[StripeSync] falha ao notificar sem-lead:", e));
      }
    }
  }

  console.log(
    `[StripeSync] ${subs.length} assinaturas, ${nFat} faturas (${healed} healed), ${churns} churns, ${movimentos} movimentos de MRR, ${semLead.length} sem lead`,
  );
  return { subs: subs.length, faturas: nFat, churns, movimentos, semLead: semLead.length };
}
