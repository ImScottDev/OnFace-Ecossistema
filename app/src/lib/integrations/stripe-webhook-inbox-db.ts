/**
 * Implementação real (Postgres + BullMQ) das portas do inbox, mais a seleção e o
 * reprocesso em lote usados pela rota admin e pelo script.
 */
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assinaturas, auditLog, checkouts, faturas, leads, organizacoes, stripeWebhookEvents as T } from "@/lib/db/schema";
import { organizationIdFromStripeMetadata } from "./stripe-webhook-metadata";
import { customerIdDe, eventoDoSaaS, invoiceIdDe, subscriptionIdDe } from "./stripe-financeiro";
import { executarComPortas, type LinhaInbox, type PortasInbox, type ResultadoInbox } from "./stripe-webhook-inbox";
import { depsReais, processarEventoStripe, type StripeEventPayload } from "./stripe-webhook-processor";

/** Eventos de CLIENTE: sem vínculo persistido não há como saber de quem são (a conta é compartilhada com o SaaS). */
const ESCOPO_CLIENTE = (t: string) => t === "customer.updated" || t.startsWith("customer.tax_id.") || t.startsWith("payment_method.");

export interface DecisaoTenant { organizacaoId: string | null; ignorar: null | "saas" | "cliente_desconhecido" }

/** Resolve o tenant por vínculos persistidos; só então por metadata/instalação única. SaaS Callface é ignorado. */
export async function resolverOrganizacao(event: StripeEventPayload): Promise<DecisaoTenant> {
  const object = event.data?.object ?? {};
  const type = event.type ?? "";
  const customerId = customerIdDe(event);
  const subscriptionId = subscriptionIdDe(object);
  const invoiceId = invoiceIdDe(object);
  const sessionId = type.startsWith("checkout.session.") && typeof object.id === "string" ? object.id : null;
  const candidatos = new Set<string>();

  if (customerId) {
    (await db.select({ o: assinaturas.organizacaoId }).from(assinaturas).where(eq(assinaturas.stripeCustomerId, customerId)).limit(3)).forEach((r) => candidatos.add(r.o));
    (await db.select({ o: leads.organizacaoId }).from(leads).where(eq(leads.stripeCustomerId, customerId)).limit(3)).forEach((r) => r.o && candidatos.add(r.o));
  }
  if (subscriptionId) (await db.select({ o: assinaturas.organizacaoId }).from(assinaturas).where(eq(assinaturas.stripeSubscriptionId, subscriptionId)).limit(3)).forEach((r) => candidatos.add(r.o));
  if (invoiceId) (await db.select({ o: faturas.organizacaoId }).from(faturas).where(and(eq(faturas.origem, "stripe"), eq(faturas.externalId, invoiceId))).limit(3)).forEach((r) => candidatos.add(r.o));
  if (sessionId) (await db.select({ o: checkouts.organizacaoId }).from(checkouts).where(eq(checkouts.stripeSessionId, sessionId)).limit(3)).forEach((r) => candidatos.add(r.o));

  if (candidatos.size === 1) return { organizacaoId: [...candidatos][0], ignorar: null };
  if (candidatos.size > 1) return { organizacaoId: null, ignorar: null };

  if (eventoDoSaaS(object)) return { organizacaoId: null, ignorar: "saas" };
  if (ESCOPO_CLIENTE(type)) return { organizacaoId: null, ignorar: "cliente_desconhecido" };

  const metaOrg = organizationIdFromStripeMetadata(object);
  if (metaOrg) {
    const [o] = await db.select({ id: organizacoes.id }).from(organizacoes).where(eq(organizacoes.id, metaOrg)).limit(1);
    if (o) return { organizacaoId: o.id, ignorar: null };
  }
  const orgs = await db.select({ id: organizacoes.id }).from(organizacoes).limit(2);
  return { organizacaoId: orgs.length === 1 ? orgs[0].id : null, ignorar: null };
}

export function portasReais(): PortasInbox {
  return {
    async claim(id) {
      const rows = await db.update(T).set({
        status: "processing", attempts: sql`${T.attempts} + 1`, processingStartedAt: new Date(), lastError: null, updatedAt: new Date(),
      }).where(and(
        eq(T.id, id),
        // case-insensitive: produção gravou MAIÚSCULAS. `processing` só é retomado se parado há > 2 min.
        sql`(lower(${T.status}) IN ('pending','failed','unresolved')
             OR (lower(${T.status}) = 'processing' AND (${T.processingStartedAt} IS NULL OR ${T.processingStartedAt} < now() - interval '2 minutes')))`,
      )).returning();
      const r = rows[0];
      if (!r) return null;
      return { id: r.id, eventId: r.eventId, eventType: r.eventType, status: r.status, organizacaoId: r.organizacaoId, attempts: r.attempts, payload: r.payload as StripeEventPayload } satisfies LinhaInbox;
    },
    async situacao(id) {
      const [r] = await db.select({ status: T.status }).from(T).where(eq(T.id, id)).limit(1);
      return r ?? null;
    },
    async resolverOrganizacao(payload) { return (await resolverOrganizacao(payload)).organizacaoId; },
    async definirOrganizacao(id, organizacaoId) { await db.update(T).set({ organizacaoId, updatedAt: new Date() }).where(eq(T.id, id)); },
    async devolverUnresolved(id) { await db.update(T).set({ status: "unresolved", updatedAt: new Date() }).where(eq(T.id, id)); },
    async marcarProcessado(id) { await db.update(T).set({ status: "processed", processedAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(T.id, id)); },
    async marcarFalho(id, erro) { await db.update(T).set({ status: "failed", lastError: erro.slice(0, 2000), processedAt: null, updatedAt: new Date() }).where(eq(T.id, id)); },
    async auditar(organizacaoId, acao, inboxId, depois) {
      try {
        await db.insert(auditLog).values({ organizacaoId, actorId: null, action: acao, entityType: "stripe_event", entityId: inboxId, before: null, after: depois, source: "webhook" });
      } catch (e) { console.error("[StripeWebhook] auditoria falhou:", e); }
    },
    async enfileirar(eventId) {
      const { stripeWebhookEventsQueue } = await import("@/lib/queue");
      // jobId com timestamp: id repetido de job já concluído seria ignorado em silêncio pelo BullMQ.
      await stripeWebhookEventsQueue.add("reprocessar", { stripeEventId: eventId }, { jobId: `stripe-evt-${eventId}-${Date.now()}`, delay: 15_000 });
    },
    async processar(payload, ctx) { return processarEventoStripe(payload, ctx, await depsReais()); },
  };
}

export function executarEventoDoInbox(inboxId: string, opcoes: { enfileirarSeFalhar: boolean }): Promise<ResultadoInbox> {
  return executarComPortas(portasReais(), inboxId, opcoes);
}

/* ── Seleção e reprocesso em lote ─────────────────────────────────────── */

export interface FiltroEventos {
  organizacaoId?: string | null;
  status?: string[];
  tipos?: string[];
  eventId?: string | null;
  limite?: number;
  /** Linhas legadas sem organização (ex.: o invoice.paid PENDING de 14/09). Só com `eventId` explícito. */
  incluirSemOrganizacao?: boolean;
}

export async function selecionarEventos(f: FiltroEventos) {
  const conds = [];
  if (f.eventId) conds.push(eq(T.eventId, f.eventId));
  if (f.status?.length) conds.push(sql`lower(${T.status}) IN (${sql.join(f.status.map((s) => sql`${s.toLowerCase()}`), sql`, `)})`);
  if (f.tipos?.length) conds.push(inArray(T.eventType, f.tipos));
  if (f.organizacaoId) conds.push(f.incluirSemOrganizacao ? or(eq(T.organizacaoId, f.organizacaoId), isNull(T.organizacaoId))! : eq(T.organizacaoId, f.organizacaoId));
  return db.select({
    id: T.id, eventId: T.eventId, eventType: T.eventType, status: T.status, organizacaoId: T.organizacaoId,
    attempts: T.attempts, lastError: T.lastError, receivedAt: T.receivedAt, payload: T.payload,
  }).from(T).where(conds.length ? and(...conds) : undefined).orderBy(asc(T.receivedAt)).limit(Math.min(f.limite ?? 50, 500));
}

export interface ResultadoReprocesso { eventId: string; tipo: string; resultado: string }

export async function reprocessarSelecionados(
  rows: Awaited<ReturnType<typeof selecionarEventos>>,
  opcoes: { modo: "fila" | "inline"; organizacaoId?: string | null; usuarioId?: string | null },
): Promise<ResultadoReprocesso[]> {
  const saida: ResultadoReprocesso[] = [];
  const portas = portasReais();
  for (const r of rows) {
    // Tenant: linha sem organização só entra se o payload resolve para a organização de quem pediu.
    let org = r.organizacaoId;
    if (opcoes.organizacaoId) {
      if (!org) org = (await resolverOrganizacao(r.payload as StripeEventPayload)).organizacaoId;
      if (org !== opcoes.organizacaoId) { saida.push({ eventId: r.eventId, tipo: r.eventType, resultado: "ignorado: não pertence à organização" }); continue; }
    }
    if (opcoes.modo === "fila") {
      await portas.enfileirar(r.eventId, r.attempts);
      if (org) {
        await db.insert(auditLog).values({
          organizacaoId: org, actorId: opcoes.usuarioId ?? null, action: "stripe.webhook_reenfileirado", entityType: "stripe_event", entityId: r.id,
          before: { status: r.status }, after: { eventId: r.eventId, eventType: r.eventType }, source: "admin",
        }).catch((e) => console.error("[StripeWebhook] auditoria do reenfileiramento falhou:", e));
      }
      saida.push({ eventId: r.eventId, tipo: r.eventType, resultado: "enfileirado" });
    } else {
      const x = await executarComPortas(portas, r.id, { enfileirarSeFalhar: false });
      saida.push({ eventId: r.eventId, tipo: r.eventType, resultado: x.estado === "falhou" ? `falhou: ${x.erro}` : x.estado === "processado" ? `processado (${x.passos.length} passos)` : x.estado });
    }
  }
  return saida;
}
