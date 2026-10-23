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
import { assinaturaItens, assinaturas, clientes, contratos, faturas, leads, mrrMovimentos, organizacoes, notificacoes, servicosCanonicos, usuarios } from "../db/schema";
import { eq, gt, sql, and, inArray, isNotNull } from "drizzle-orm";
import { resolveBillingCustomer, type BillingResolution } from "./billing-identity";
import { negocioDaMetadataStripe } from "../crm/metadata-comercial";
import { resumoDeCancelamento } from "./stripe-portal-retorno";
import { periodoCorrente } from "./stripe-financeiro";
import { ehDoSaas, ignorarNoSync, origemDaAssinatura, origemDaFatura } from "./stripe-origem";
import { empresaCarimbadaNoCustomer, reconhecerClienteDoSaas } from "./cliente-do-saas";
import { MARCA_AUTOMATICA, produtoDaSubscriptionDoSync } from "./stripe-produto-do-servico";
import { fetchComPrazo } from "@/lib/rede/fetch-com-prazo";

const seg = (n: number | null | undefined) => (n ? new Date(n * 1000) : null);

const STRIPE_API = "https://api.stripe.com/v1";

type StripeList<T> = { data: T[]; has_more: boolean };

async function stripeGet<T>(path: string, params: Record<string, string> = {}): Promise<StripeList<T>> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada no .env");
  const url = new URL(`${STRIPE_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetchComPrazo(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Stripe ${path}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function stripeGetOne<T>(path: string): Promise<T | null> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) return null;
  const r = await fetchComPrazo(`${STRIPE_API}/${path}`, { headers: { Authorization: `Bearer ${key}` } });
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

const PAGINAS_MAXIMAS = 1000;

async function paginate<T extends { id: string }>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const items: T[] = [];
  let startingAfter: string | undefined;
  /* Teto de segurança contra laço infinito, NÃO limite de negócio. Era 50 páginas (5.000 itens) e cortava em
     silêncio: o sync seguia "com sucesso" sobre um espelho incompleto. Agora 1.000 páginas (100.000 itens) e, se
     ainda sobrar página, falha ALTO — um sync que não viu tudo não pode se passar por completo. */
  for (let i = 0; i < PAGINAS_MAXIMAS; i++) {
    const p = { ...params, limit: "100" };
    if (startingAfter) (p as Record<string, string>).starting_after = startingAfter;
    const page = await stripeGet<T>(path, p);
    items.push(...page.data);
    if (!page.has_more) return items;
    startingAfter = page.data[page.data.length - 1].id;
  }
  throw new Error(`Stripe ${path}: mais de ${PAGINAS_MAXIMAS} páginas — a paginação foi interrompida e o espelho ficaria incompleto`);
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
  customer: string | { id: string; email?: string | null; name?: string | null; metadata?: Record<string, string> | null };
  status: string;
  start_date?: number;
  canceled_at?: number | null;
  /** Cancelamento agendado (portal ou Dashboard): classic usa `cancel_at_period_end`, flexible usa `cancel_at`. */
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  current_period_start?: number;
  current_period_end?: number;
  cancellation_details?: { reason?: string | null; feedback?: string | null; comment?: string | null } | null;
  /** `crm_negocio_id` aparece aqui quando a alteração passou pelo CRM. */
  metadata?: Record<string, string> | null;
  items?: { data: {
    id: string;
    quantity?: number;
    current_period_start?: number;
    current_period_end?: number;
    price: {
      id: string;
      unit_amount: number | null;
      product?: string | { id: string };
      recurring?: { interval: string; interval_count?: number } | null;
    };
  }[] };
}

function custId(c: StripeSubscription["customer"]): string {
  return typeof c === "string" ? c : c.id;
}
function custEmail(c: StripeSubscription["customer"]): string | null {
  return typeof c === "string" ? null : (c.email || null);
}

interface StripeInvoice {
  id: string;
  /** Objeto quando buscado com `expand[]=customer` (para ler a metadata); `fatura()` devolve ao id. */
  customer: string | { id: string; metadata?: Record<string, string> | null };
  metadata?: Record<string, string> | null;
  status: string;
  amount_due: number;
  created: number;
  due_date?: number | null;
  hosted_invoice_url?: string | null;
  period_start?: number;
  attempt_count?: number;
  status_transitions?: { paid_at?: number | null };
  parent?: { subscription_details?: { subscription?: string; metadata?: Record<string, string> | null } };
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

/**
 * Reconciliação de ESTADO do serviço da carteira a partir do estado da assinatura.
 *
 * Regra única, nos dois sentidos — por estado, nunca por transição:
 *  - assinatura morta (`canceled`/`unpaid`) -> o serviço encerra (CHURNED, fora do portfólio);
 *  - assinatura viva (`active`/`trialing`/`past_due`) -> serviço CHURNED volta a ACTIVE.
 *
 * O sentido "volta" existe porque o estado errado também chega do outro lado: a carga do marco
 * zero churnou 37 serviços com assinatura viva (19 empresas, R$ 15.936,10/mês cobrados de fato e
 * fora do MRR, medido em 14/10/2026) só porque a empresa não aparecia no fechamento de set/26.
 * Sem reconciliar, nenhum sync tiraria esses serviços do churn — a borda nunca mais acontece.
 *
 * Qualquer outro estado (`incomplete`, `incomplete_expired`, `paused`) não diz nada: não mexe.
 */
export function reconciliacaoDoServico(statusStripe: string): "encerrar" | "reativar" | null {
  if (statusStripe === "canceled" || statusStripe === "unpaid") return "encerrar";
  if (BILLABLE.has(statusStripe)) return "reativar";
  return null;
}

/** "payment_failed" | "cancellation_requested (too_expensive): comentário" */
function motivoCancelamento(s: StripeSubscription): string | null {
  const cd = s.cancellation_details;
  if (!cd?.reason) return null;
  let m = cd.reason;
  if (cd.feedback) m += ` (${cd.feedback})`;
  if (cd.comment) m += `: ${cd.comment}`;
  return m.slice(0, 500);
}

export async function syncStripe(organizacaoId?: string): Promise<{ subs: number; faturas: number; churns: number; movimentos: number; semLead: number }> {
  const orgs = await db
    .select({ id: organizacoes.id })
    .from(organizacoes)
    .where(organizacaoId ? eq(organizacoes.id, organizacaoId) : undefined)
    .limit(2);
  if (orgs.length === 0) throw new Error("organização não encontrada");
  if (!organizacaoId && orgs.length > 1) throw new Error("syncStripe exige organizacaoId quando há mais de uma organização");
  const org = orgs[0];

  // ── FASE 1: FETCH (sem transação aberta) ──────────────────────────────────

  // expand[]=data.customer traz o e-mail do cliente junto (sem N+1 fetch) — usado
  // como fallback pra achar o lead quando o customer_id ainda não foi vinculado
  // (achado real 04/08: 47 assinaturas ativas, R$15.9k/mês, ficavam de fora do
  // espelho local pra sempre porque só existia o match por stripeCustomerId).
  /* A conta Stripe é COMPARTILHADA com o SaaS Callface: `subscriptions` e `invoices` trazem os objetos dos
     dois. Só o que não é do SaaS entra no espelho (regra e marcas em stripe-origem.ts). É o único filtro: tudo
     abaixo (lead, MRR, faturas, heal) trabalha sobre `subs` e `invoiceMap` já filtrados. Sem marca ou com marca
     dos dois lados FICA (e é contado no log), nunca é descartado em silêncio. */
  const subsDoStripe = await paginate<StripeSubscription>("subscriptions", { status: "all", "expand[]": "data.customer" });
  /* A assinatura da plataforma entra no espelho como qualquer outra (decisão do
     Scott, 21/10/2026). Antes era descartada aqui, e o efeito aparecia na ficha:
     o cliente pagava R$ 89,90 por mês, a ficha achava o Customer e dizia
     "Assinaturas · 0, sem assinatura no Stripe" — porque a assinatura não
     existia no banco do CRM.

     Entra inteira: assinatura, faturas e MRR. Quem não tem lead resolvido
     continua de fora (o `continue` lá embaixo), então só entra cobrança com
     dono conhecido. `ignorarNoSync` fica no código e segue valendo para o que
     o CRM não deve tocar; o que mudou é que cobrança de cliente não é isso. */
  const subs = subsDoStripe;
  const subsDoSaas = subsDoStripe.length - subs.length;

  const subsSemMarca = subs.filter((s) => origemDaAssinatura(s).origem !== "crm").length;

  // Catálogo price.product -> nome do plano (1 fetch, habilita LTV por plano)
  const products = await paginate<{ id: string; name?: string }>("products", {});
  const productName = new Map(products.map((p) => [p.id, p.name || p.id]));

  /* A assinatura do SaaS continua FORA de tudo que é receita (não entra em
     `subs`, não vira fatura, contrato nem MRR). Mas quando o Customer dela foi
     carimbado pelo próprio CRM com uma empresa, o cliente é o mesmo — e o 360
     mostrava "Contato · Desqualificado" para quem paga a plataforma em dia,
     porque "quem é cliente" se lê do serviço canônico. Isto materializa só o
     serviço, fora do portfólio. Ver lib/integrations/cliente-do-saas.ts. */
  for (const s of subsDoStripe) {
    if (!ignorarNoSync(origemDaAssinatura(s))) continue;
    const c = s.customer;
    const empresaId = typeof c === "string" ? null : empresaCarimbadaNoCustomer(c?.metadata);
    if (!empresaId) continue;
    const primeiro = s.items?.data?.[0]?.price?.product;
    const produtoId = typeof primeiro === "string" ? primeiro : primeiro?.id ?? null;
    await reconhecerClienteDoSaas(org.id, {
      id: s.id, status: s.status, empresaId,
      produto: produtoId ? productName.get(produtoId) ?? null : null,
    }).catch((e) => console.error(`[StripeSync] cliente do SaaS ${s.id}:`, e instanceof Error ? e.message : e));
  }

  // Faturas: janela de 60d (novas + retries) + TODAS open/uncollectible (sem janela)
  const since = Math.floor(Date.now() / 1000) - 60 * 24 * 3600;
  const invoiceMap = new Map<string, StripeInvoice>();
  // A fatura acompanha a assinatura: se a cobrança entra, o comprovante dela também.
  const fatura = (inv: StripeInvoice) => { invoiceMap.set(inv.id, { ...inv, customer: typeof inv.customer === "string" ? inv.customer : inv.customer.id }); };
  for (const inv of await paginate<StripeInvoice>("invoices", { "created[gte]": String(since), "expand[]": "data.customer" })) fatura(inv);
  for (const st of ["open", "uncollectible"]) {
    for (const inv of await paginate<StripeInvoice>("invoices", { status: st, "expand[]": "data.customer" })) fatura(inv);
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
    const inv = await stripeGetOne<StripeInvoice>(`invoices/${extId}?expand[]=customer`);
    if (inv) {
      fatura(inv);
      healed++;
    }
  }

  // mapa customer -> lead (preenchido pela importação/webhook; novos clientes entram aqui)
  const leadRows = await db
    .select({ id: leads.id, stripeCustomerId: leads.stripeCustomerId, empresaId: leads.empresaId })
    .from(leads)
    .where(sql`${leads.stripeCustomerId} IS NOT NULL`);
  // Um customer pode estar errado em mais de um lead legado. Nunca use Map
  // simples aqui: ele escolheria silenciosamente a última linha retornada.
  const customerLeadCandidates = new Map<string, typeof leadRows>();
  for (const row of leadRows) {
    const id = row.stripeCustomerId as string;
    customerLeadCandidates.set(id, [...(customerLeadCandidates.get(id) || []), row]);
  }
  const leadByCustomer = new Map<string, (typeof leadRows)[number]>();
  for (const [customerId, candidates] of customerLeadCandidates) {
    if (candidates.length === 1) leadByCustomer.set(customerId, candidates[0]);
  }
  const resolutionCache = new Map<string, BillingResolution>();

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
      const periodo = periodoCorrente(s as unknown as Record<string, unknown>);
      let lead = leadByCustomer.get(sCustId);
      let precisaVincularCustomerId = false;
      if (!lead) {
        /* A metadata da ASSINATURA vai junto: é nela que o CRM grava
           `negocioId`/`propostaId` ao vender, e é a prova de quem é a empresa.
           Sem isso, assinatura cujo e-mail de cobrança difere do contato da
           proposta ficava fora do espelho para sempre. */
        const customer = typeof s.customer === "string"
          ? { id: s.customer, assinaturaMetadata: s.metadata }
          : { id: s.customer.id, email: s.customer.email, metadata: s.customer.metadata, assinaturaMetadata: s.metadata };
        /* O cache é por Customer, mas a evidência agora pode vir da ASSINATURA:
           guardar um fracasso faria a segunda assinatura do mesmo Customer —
           justamente a que talvez tenha `negocioId` — nem ser tentada. Só o
           resultado confirmado é reaproveitado. */
        let resolution = resolutionCache.get(sCustId);
        if (!resolution) {
          resolution = await resolveBillingCustomer(org.id, customer);
          if (resolution.kind === "CONFIRMED") resolutionCache.set(sCustId, resolution);
        }
        if (resolution.kind === "CONFIRMED" && resolution.leadId) {
          lead = { id: resolution.leadId, empresaId: resolution.empresaId || null, stripeCustomerId: null };
          // Alias, CRM metadata and CNPJ prove a durable customer link. E-mail
          // único é intentionally read-only: it may mirror the subscription,
          // but cannot mutate the CRM relationship by itself.
          precisaVincularCustomerId = resolution.source !== "UNIQUE_EMAIL";
        }
      }
      if (lead && precisaVincularCustomerId) {
        await tx.update(leads).set({ stripeCustomerId: sCustId, updatedAt: sql`updated_at` }).where(eq(leads.id, lead.id));
      }
      // O mapa é só deste ciclo de reconciliação. Mesmo o fallback de e-mail
      // único pode trazer suas invoices para o espelho sem criar um vínculo
      // permanente em leads.stripe_customer_id.
      if (lead) leadByCustomer.set(sCustId, lead);
      const mrr = mrrOf(s);
      const canceladaEm = s.canceled_at ? new Date(s.canceled_at * 1000) : null;
      /* Cancelamento AGENDADO: o cliente já pediu para sair, a assinatura segue
         cobrando até o fim do período. O dado chegava (`cancelada_em` e o motivo
         ficam gravados) e nenhuma tela dizia nada — o cliente sumia no fim do mês
         sem ninguém tentar reter. Medido em 21/10/2026: 8 contas, R$ 1.919,10/mês,
         com motivo declarado ("muito caro", "não usei", "vou retomar").
         Clássico usa `cancel_at_period_end`; flexible usa `cancel_at`. */
      const vaiCancelar = Boolean(s.cancel_at_period_end || s.cancel_at || (canceladaEm && s.status === "active"));
      const motivo = motivoCancelamento(s);
      const item0 = s.items?.data?.[0];
      const item0ProductId = typeof item0?.price?.product === "string"
        ? item0.price.product
        : item0?.price?.product?.id || null;
      const planoNome = item0ProductId ? productName.get(item0ProductId) || null : null;
      const quantidadeTotal = s.items?.data?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 1;

      const [existing] = await tx
        .select({ id: assinaturas.id, status: assinaturas.status, contratoId: assinaturas.contratoId, mrr: assinaturas.mrr, leadId: assinaturas.leadId, servicoId: assinaturas.servicoId })
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
        /* O negócio que originou a alteração, quando ela veio do CRM. Vem da
           metadata `crm_negocio_id` que `stripe-assinatura.ts` carimba na
           assinatura ao expandir ou trocar plano.

           Quando é `null` num movimento de expansão/contração, significa que
           alguém alterou a assinatura DIRETO no Stripe — o caso que fazia a
           venda sumir: o MRR subia certo e nenhum closer era creditado. O
           movimento fica marcado para a fila de revisão em vez de se perder. */
        negocioId: string | null = null,
      ) => {
        if (Math.abs(delta) < 0.005) return;
        const foraDoCrm = !negocioId && (tipo === "expansao" || tipo === "contracao");
        await tx.insert(mrrMovimentos).values({
          organizacaoId: org.id,
          leadId,
          assinaturaId,
          negocioId,
          detectadoForaDoCrm: foraDoCrm,
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

      // Subscription pode carregar vários itens (MRR, setup, capacidade etc.).
      // O resumo em assinaturas continua útil para compatibilidade, mas a fonte
      // operacional de preço/quantidade é esta tabela. Família fica UNKNOWN
      // quando o catálogo não declarou explicitamente a semântica do item.
      const sincronizarItens = async (assinaturaId: string, servicoCanonicoId: string | null) => {
        const itens = s.items?.data || [];
        const ids = itens.map((item) => item.id).filter(Boolean);
        if (ids.length > 0) {
          await tx
            .update(assinaturaItens)
            .set({ status: "inactive", updatedAt: new Date() })
            .where(and(
              eq(assinaturaItens.assinaturaId, assinaturaId),
              sql`NOT (${assinaturaItens.stripeSubscriptionItemId} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}))`,
            ));
        } else {
          await tx
            .update(assinaturaItens)
            .set({ status: "inactive", updatedAt: new Date() })
            .where(eq(assinaturaItens.assinaturaId, assinaturaId));
        }

        for (const item of itens) {
          const productId = typeof item.price.product === "string"
            ? item.price.product
            : item.price.product?.id || null;
          const itemStatus = BILLABLE.has(s.status) ? "active" : s.status;
          await tx
            .insert(assinaturaItens)
            .values({
              organizacaoId: org.id,
              assinaturaId,
              stripeSubscriptionItemId: item.id,
              stripeProductId: productId,
              stripePriceId: item.price.id,
              produto: productId ? productName.get(productId) || productId : null,
              quantidade: item.quantity || 1,
              precoUnitario: item.price.unit_amount == null ? null : String(item.price.unit_amount / 100),
              moeda: "BRL",
              recurringInterval: item.price.recurring?.interval || null,
              serviceFamily: "UNKNOWN",
              revenueNature: item.price.recurring ? "MRR" : "ONE_TIME",
              servicoCanonicoId,
              currentPeriodStart: seg(item.current_period_start ?? periodo.inicio),
              currentPeriodEnd: seg(item.current_period_end ?? periodo.fim),
              status: itemStatus,
              raw: item,
              syncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: assinaturaItens.stripeSubscriptionItemId,
              // O índice único de stripe_subscription_item_id é parcial
              // (só valores não nulos). O alvo do upsert precisa declarar a
              // mesma condição para o PostgreSQL conseguir inferi-lo.
              targetWhere: isNotNull(assinaturaItens.stripeSubscriptionItemId),
              set: {
                organizacaoId: org.id,
                assinaturaId,
                stripeProductId: productId,
                stripePriceId: item.price.id,
                produto: productId ? productName.get(productId) || productId : null,
                quantidade: item.quantity || 1,
                precoUnitario: item.price.unit_amount == null ? null : String(item.price.unit_amount / 100),
                moeda: "BRL",
                recurringInterval: item.price.recurring?.interval || null,
                revenueNature: item.price.recurring ? "MRR" : "ONE_TIME",
                servicoCanonicoId,
                currentPeriodStart: seg(item.current_period_start ?? periodo.inicio),
                currentPeriodEnd: seg(item.current_period_end ?? periodo.fim),
                status: itemStatus,
                raw: item,
                syncedAt: new Date(),
                updatedAt: new Date(),
              },
            });
        }

        // Produto do serviço canônico: o nome do produto desta subscription, pela regra única de
        // stripe-produto-do-servico.ts (era a coluna que ficava vazia e a tela mostrava a FAMÍLIA).
        // Só grava quando TODOS os itens têm nome (produto apagado no Stripe não vem em `productName`),
        // só onde está vazio ou foi escrito por esta mesma regra, e nunca por cima de valor humano/bom.
        const nomeProduto = produtoDaSubscriptionDoSync(
          itens.map((item) => ({
            productId: typeof item.price.product === "string" ? item.price.product : item.price.product?.id || null,
            priceId: item.price.id,
            quantidade: item.quantity || 1,
            precoUnitario: item.price.unit_amount == null ? null : item.price.unit_amount / 100,
          })),
          productName,
        );
        if (nomeProduto) {
          const marca = JSON.stringify({ [MARCA_AUTOMATICA]: true, fonte: "stripe_sync", regra: "stripe-produto-do-servico" });
          await tx.update(servicosCanonicos)
            .set({
              canonicalProduct: nomeProduto,
              evidence: sql`coalesce(${servicosCanonicos.evidence}, '{}'::jsonb) || jsonb_build_object('produto_canonico', ${marca}::jsonb)`,
            })
            .where(and(
              eq(servicosCanonicos.organizacaoId, org.id),
              servicoCanonicoId
                ? sql`(${servicosCanonicos.id} = ${servicoCanonicoId} OR ${servicosCanonicos.currentSubscriptionId} = ${s.id})`
                : eq(servicosCanonicos.currentSubscriptionId, s.id),
              sql`(${servicosCanonicos.canonicalProduct} IS NULL OR ${servicosCanonicos.evidence} -> 'produto_canonico' ->> 'automatico' = 'true')`,
              sql`${servicosCanonicos.canonicalProduct} IS DISTINCT FROM ${nomeProduto}`,
            ));
        }
      };

      if (existing) {
        await tx
          .update(assinaturas)
          .set({
            /* O vínculo que FALTA, nunca o que já existe. O update não mexia em
               lead/empresa, então assinatura que nasceu antes de o cliente ter
               empresa ficava órfã para sempre — medido em produção em
               15/10/2026: 13 assinaturas ativas, R$ 3.538,51 de MRR, cujo lead
               JÁ tem empresa. COALESCE porque corrigir à mão (mesclar empresa,
               reatribuir) é decisão humana que o sync não pode desfazer. */
            ...(lead ? { leadId: sql`COALESCE(${assinaturas.leadId}, ${lead.id}::uuid)` } : {}),
            /* A empresa-BALDE ("Unresolved billing identity") conta como
               AUSÊNCIA, não como empresa: a carga de billing a usou para
               juntar dezenas de Customers sem dono, e `ehEmpresaBalde` já diz
               isso no saneamento. Sem esta ressalva o COALESCE respeitaria o
               balde como se fosse o cliente, e a assinatura ficava presa nele
               para sempre — 16 ativas, R$ 10.304,10, em 15/10/2026. */
            ...(lead?.empresaId ? { empresaId: sql`CASE
                WHEN ${assinaturas.empresaId} IS NULL THEN ${lead.empresaId}::uuid
                WHEN EXISTS (SELECT 1 FROM empresas b WHERE b.id = ${assinaturas.empresaId} AND b.nome ~* '^unresolved billing identity') THEN ${lead.empresaId}::uuid
                ELSE ${assinaturas.empresaId} END` } : {}),
            status: s.status,
            mrr: String(mrr),
            canceladaEm,
            motivoCancelamento: motivo,
            produto: planoNome,
            stripePriceId: item0?.price?.id || null,
            quantidade: quantidadeTotal,
            currentPeriodEnd: seg(periodo.fim),
            // Mescla (não substitui): outros escritores podem ter guardado evidência no mesmo jsonb.
            raw: sql`COALESCE(${assinaturas.raw}, '{}'::jsonb) || ${JSON.stringify(resumoDeCancelamento(s))}::jsonb`,
            syncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(assinaturas.id, existing.id));

        await sincronizarItens(existing.id, existing.servicoId || null);

        // Diff -> movimento de MRR
        const mrrAntes = Number(existing.mrr) || 0;
        const wasB = BILLABLE.has(existing.status);
        const isB = BILLABLE.has(s.status);
        if (wasB && !isB) {
          await registrarMovimento("churn", -mrrAntes, mrrAntes, 0, existing.id, existing.contratoId, existing.leadId, canceladaEm || new Date());
        } else if (!wasB && isB) {
          await registrarMovimento("reativacao", mrr, 0, mrr, existing.id, existing.contratoId, existing.leadId, new Date());
        } else if (wasB && isB && Math.abs(mrr - mrrAntes) >= 0.005) {
          /* `crm_negocio_id` só existe quando a alteração passou pelo CRM
             (lib/integrations/stripe-assinatura.ts). Alteração feita à mão no
             Dashboard do Stripe chega aqui sem dono. */
          const donoDaAlteracao = await negocioDaMetadataStripe(tx, org.id, s.metadata);
          await registrarMovimento(mrr > mrrAntes ? "expansao" : "contracao", mrr - mrrAntes, mrrAntes, mrr, existing.id, existing.contratoId, existing.leadId, new Date(), donoDaAlteracao);
        }

        /*
         * Cancelamento no Stripe também encerra o SERVIÇO da carteira. Sem isto (QA 06/10)
         * a assinatura ia a canceled, o contrato a churned e o churn entrava no MRR, mas o
         * serviço seguia ACTIVE/portfolio_included e o cliente nunca ia pra aba Cancelados.
         * Mesma regra do cs/cancelamento.ts: cliente só vira 'churned' se não sobrar serviço.
         *
         * Condição por ESTADO, não por transição. Era `existing.status !== "canceled"`, e quem
         * perdesse a borda ficava preso para sempre: medido em produção 14/10, **12 serviços de
         * cliente cancelado seguiam ACTIVE e dentro do portfólio**, contando MRR (BUCCO,
         * MERITUM, PONTUA, Fluari, Grupo Royal, Two Solution, JURIS EXPRESS, Knoa Rio...). É o
         * rastro dos avisos do Stripe que voltaram 499 antes da correção de hoje: o status da
         * assinatura chegou pelo sync, a borda já tinha passado, e o serviço nunca encerrou.
         * Por estado é idempotente — se já está encerrado, o UPDATE não acha linha.
         *
         * `unpaid` entra junto: assinatura que o Stripe desistiu de cobrar não é cliente ativo.
         * O MOVIMENTO de churn continua só na borda (acima), senão o MRR contaria duas vezes.
         */
        const reconciliacao = reconciliacaoDoServico(s.status);
        // O serviço desta assinatura: por `servico_id` da assinatura ou por `current_subscription_id`.
        const servicoDestaAssinatura = existing.servicoId
          ? sql`(${servicosCanonicos.id} = ${existing.servicoId} OR ${servicosCanonicos.currentSubscriptionId} = ${s.id})`
          : eq(servicosCanonicos.currentSubscriptionId, s.id);
        if (reconciliacao === "encerrar") {
          const encerrados = await tx.update(servicosCanonicos)
            .set({ commercialLifecycle: "CHURNED", portfolioIncluded: false, billingStatus: "CANCELED", updatedAt: new Date() })
            .where(and(
              eq(servicosCanonicos.organizacaoId, org.id),
              servicoDestaAssinatura,
              /* Só o que ainda não está no estado de encerrado COMPLETO. A condição roda a
                 cada sync, então sem ela a mesma linha seria reescrita de 30 em 30 minutos e
                 o `updated_at` diria "mexido agora" para sempre.

                 Mas olhar só o `commercial_lifecycle` deixava um buraco: quem já chegou a
                 CHURNED por OUTRA via (a carga do marco zero) nunca era tocado, e ficava com
                 o `billing_status` velho para sempre. Medido em produção 21/10/2026: **47
                 serviços CHURNED com `billing_status = 'ACTIVE'`, R$ 15.106,30/mês** — todos
                 com a assinatura canceled ou unpaid no Stripe. A ficha do cliente lia esse
                 ACTIVE e mostrava produto ativo para quem o Stripe parou de cobrar.

                 Comparar os TRÊS campos mantém a idempotência (alinhado não é reescrito) e
                 fecha o buraco. */
              sql`(${servicosCanonicos.commercialLifecycle} IS DISTINCT FROM 'CHURNED'
                   OR ${servicosCanonicos.billingStatus} IS DISTINCT FROM 'CANCELED'
                   OR ${servicosCanonicos.portfolioIncluded} IS DISTINCT FROM false)`,
            ))
            .returning({ empresaId: servicosCanonicos.empresaId });
          for (const empresaId of new Set(encerrados.map((e) => e.empresaId).filter((e): e is string => !!e))) {
            const [restante] = await tx.select({ n: sql<number>`count(*)::int` }).from(servicosCanonicos)
              .where(and(eq(servicosCanonicos.empresaId, empresaId), eq(servicosCanonicos.portfolioIncluded, true)));
            if (!restante?.n) {
              await tx.update(clientes).set({ statusFinanceiro: "churned", updatedAt: new Date() })
                .where(and(eq(clientes.empresaId, empresaId), eq(clientes.organizacaoId, org.id)));
            }
          }
        } else if (reconciliacao === "reativar") {
          /* ASSINATURA VIVA QUE O CRM NÃO CONHECE COMO SERVIÇO.

             Serviço canônico só nascia no Won do negócio (lib/crm/servico-canonico.ts). Quem
             assinou por fora desse caminho — assinatura recriada depois de uma falha de
             cobrança, venda que não passou pelo CRM, cliente que voltou — ficava com a
             assinatura espelhada e NENHUM serviço. E "quem é cliente" se lê do serviço: a
             ficha mostrava "Ex-cliente" para quem estava pagando em dia.

             Medido em produção 21/10/2026: **50 assinaturas ACTIVE sem serviço nenhum,
             R$ 18.766,16/mês**.

             Nasce igual ao que o Won criaria: ACTIVE, no portfólio, MRR pelo valor da
             assinatura e família pelo nome do produto (senão a ficha diz "Não classificado"
             com "Callface AI - Starter" escrito ao lado). Só com empresa: serviço sem empresa
             não vira ficha de cliente, e a identidade duvidosa é decisão humana. */
          if (lead?.empresaId && mrr !== null && Number(mrr) > 0) {
            const { classificarProdutoPorNome } = await import("@/lib/crm/classificar-produto");
            // O nome do produto que este mesmo ciclo acabou de gravar nos itens da assinatura.
            const [itemDaAssinatura] = await tx.select({ produto: assinaturaItens.produto })
              .from(assinaturaItens).where(eq(assinaturaItens.assinaturaId, existing.id)).limit(1);
            const nomeDoProduto = itemDaAssinatura?.produto ?? null;
            await tx.insert(servicosCanonicos).values({
              organizacaoId: org.id,
              empresaId: lead.empresaId,
              leadId: lead.id,
              canonicalKey: `STRIPE:${s.id}`,
              serviceFamily: classificarProdutoPorNome(nomeDoProduto),
              canonicalProduct: nomeDoProduto,
              revenueNature: "MRR",
              billingSource: "STRIPE",
              commercialLifecycle: "ACTIVE",
              billingStatus: "ACTIVE",
              currentRecurringValue: String(mrr),
              currentSubscriptionId: s.id,
              portfolioIncluded: true,
              confidence: "CONFIRMED",
              evidence: { origem: "stripe_sync_assinatura_viva", status_stripe: s.status, em: new Date().toISOString() },
            }).onConflictDoNothing();
          }
          /* O inverso do bloco acima: a assinatura está viva no Stripe e o serviço está CHURNED.
             Acontece quando o churn veio de fora do Stripe (carga do marco zero, cancelamento
             manual desfeito). Volta ACTIVE e ao portfólio, senão o MRR fica faltando dinheiro
             que está sendo cobrado. O estado anterior fica em `evidence.reconciliacao_stripe`.
             Idempotente pelo mesmo motivo do outro lado: só pega quem está CHURNED. */
          const revividos = await tx.update(servicosCanonicos)
            .set({
              commercialLifecycle: "ACTIVE", portfolioIncluded: true,
              billingStatus: vaiCancelar ? "ACTIVE_CANCEL_SCHEDULED" : "ACTIVE", updatedAt: new Date(),
              evidence: sql`coalesce(${servicosCanonicos.evidence}, '{}'::jsonb) || jsonb_build_object('reconciliacao_stripe', jsonb_build_object(
                'em', now(), 'status_stripe', ${s.status}::text, 'commercial_lifecycle_antes', ${servicosCanonicos.commercialLifecycle},
                'portfolio_included_antes', ${servicosCanonicos.portfolioIncluded}, 'billing_status_antes', ${servicosCanonicos.billingStatus}))`,
            })
            .where(and(
              eq(servicosCanonicos.organizacaoId, org.id),
              servicoDestaAssinatura,
              eq(servicosCanonicos.commercialLifecycle, "CHURNED"),
            ))
            .returning({ empresaId: servicosCanonicos.empresaId });
          for (const empresaId of new Set(revividos.map((e) => e.empresaId).filter((e): e is string => !!e))) {
            await tx.update(clientes).set({ statusFinanceiro: "ativo", updatedAt: new Date() })
              .where(and(eq(clientes.empresaId, empresaId), eq(clientes.organizacaoId, org.id),
                sql`${clientes.statusFinanceiro} IS DISTINCT FROM 'ativo'`));
          }
        }

        /* O aviso de saída, para quem JÁ está ativo. O bloco de reativação acima
           só toca quem está CHURNED, então sem isto o cancelamento agendado nunca
           chegava ao serviço de um cliente ativo — que é justamente o caso que
           interessa ao CS: ainda dá tempo de reter. Vale nos dois sentidos, porque
           cliente que volta atrás tem de sair do aviso. */
        if (s.status === "active") {
          await tx.update(servicosCanonicos)
            .set({ billingStatus: vaiCancelar ? "ACTIVE_CANCEL_SCHEDULED" : "ACTIVE", updatedAt: new Date() })
            .where(and(
              eq(servicosCanonicos.organizacaoId, org.id),
              servicoDestaAssinatura,
              eq(servicosCanonicos.commercialLifecycle, "ACTIVE"),
              sql`${servicosCanonicos.billingStatus} IS DISTINCT FROM ${vaiCancelar ? "ACTIVE_CANCEL_SCHEDULED" : "ACTIVE"}`,
            ));

          /* O VALOR do serviço também acompanha a assinatura, não só o status.

             O serviço canônico nascia no Won (ou aqui, na reconciliação) e
             ficava congelado no valor daquele dia. Quem mudasse de plano ou
             ganhasse mais um usuário continuava no 360 com o preço antigo —
             e o MRR da carteira se lê do serviço, não da assinatura.

             Medido em 23/10/2026 na Maíra cred: assinatura em 2 × R$ 179,90 =
             R$ 359,80 depois da expansão, serviço parado em 1 × R$ 179,90.

             Só MRR do portfólio cobrado pelo Stripe, e nunca para zero: valor
             ausente é falha de leitura, não cliente que parou de pagar — quem
             cancela passa pelo bloco de encerramento, que é outro caminho. */
          if (mrr !== null && Number(mrr) > 0) {
            await tx.update(servicosCanonicos)
              .set({ currentRecurringValue: String(mrr), quantidade: String(quantidadeTotal), updatedAt: new Date() })
              .where(and(
                eq(servicosCanonicos.organizacaoId, org.id),
                servicoDestaAssinatura,
                eq(servicosCanonicos.commercialLifecycle, "ACTIVE"),
                eq(servicosCanonicos.revenueNature, "MRR"),
                eq(servicosCanonicos.portfolioIncluded, true),
                sql`(${servicosCanonicos.currentRecurringValue} IS DISTINCT FROM ${String(mrr)}::numeric
                     OR ${servicosCanonicos.quantidade} IS DISTINCT FROM ${String(quantidadeTotal)}::numeric)`,
              ));
          }
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
        // F4 (09/08) — FIX DA CAUSA RAIZ do bug de MRR duplicado confirmado
        // na auditoria (36 pares, R$17.449,30/mês de excesso): antes deste
        // fix, este branch SEMPRE inseria um contrato novo pra qualquer
        // assinatura que `syncStripe()` visse por 1ª vez — mesmo quando
        // `marcarPropostaAceita` já tinha criado um contrato pra essa MESMA
        // assinatura (com `stripeSubscriptionId` estampado) segundos antes,
        // via o webhook do checkout. Agora checa por `stripeSubscriptionId`
        // ANTES de decidir criar vs. reaproveitar.
        const [contratoJaExistente] = await tx
          .select({ id: contratos.id })
          .from(contratos)
          .where(eq(contratos.stripeSubscriptionId, s.id))
          .limit(1);

        let contrato: { id: string } | undefined = contratoJaExistente;
        if (contratoJaExistente) {
          // Contrato já existe (veio do aceite de proposta) — só garante que
          // reflete o status real do Stripe agora, nunca duplica.
          await tx
            .update(contratos)
            .set({
              status: s.status === "canceled" ? "churned" : "ativo",
              motivoChurn: s.status === "canceled" ? motivo : null,
              updatedAt: new Date(),
            })
            .where(eq(contratos.id, contratoJaExistente.id));
        }
        // D8: assinatura Stripe NÃO é contrato (decisão do Scott, marco zero).
        // Sem contrato pré-existente (aceite de proposta) o sync só grava a
        // assinatura; contratoId fica null. Carteira/MRR leem de assinaturas
        // e cliente_receita_mensal, não de contratos espelho.
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
            quantidade: quantidadeTotal,
            mrr: String(mrr),
            status: s.status,
            motivoCancelamento: motivo,
            iniciadaEm: s.start_date ? new Date(s.start_date * 1000) : null,
            canceladaEm,
            currentPeriodEnd: seg(periodo.fim),
            raw: resumoDeCancelamento(s),
            syncedAt: new Date(),
          })
          .returning({ id: assinaturas.id });
        if (novaAss) await sincronizarItens(novaAss.id, null);
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
      const lead = leadByCustomer.get(inv.customer as string);
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
      .where(and(eq(notificacoes.tipo, "stripe_sem_lead"), gt(notificacoes.createdAt, umDiaAtras)))
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
    `[StripeSync] ${subs.length} assinaturas (${subsDoSaas} do SaaS ignoradas, ${subsSemMarca} sem marca do CRM mantidas), ${nFat} faturas (${healed} healed), ${churns} churns, ${movimentos} movimentos de MRR, ${semLead.length} sem lead`,
  );
  return { subs: subs.length, faturas: nFat, churns, movimentos, semLead: semLead.length };
}
