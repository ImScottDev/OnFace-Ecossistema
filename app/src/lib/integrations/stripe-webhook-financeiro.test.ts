/**
 * Webhooks do Stripe: payload falso, sem banco, sem Redis, sem chave.
 * Cobre: objeto do SaaS ignorado, timeline com valor formatado, pagamentos FAILED/REFUNDED,
 * recebível, idempotência, falha → `failed` + fila, e o processador de ponta a ponta com dependências falsas.
 * (A escrita real no Postgres não é exercida aqui: ver o relatório.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  descreverEventoFinanceiro, estadoDoRecebivel, eventoDoSaaS, formatarValor, pagamentoDoEvento, subscriptionIdDe,
  EVENTOS_ESPERADOS, EVENTOS_NOVOS,
} from "./stripe-financeiro";
import { executarComPortas, type LinhaInbox, type PortasInbox } from "./stripe-webhook-inbox";
import { processarEventoStripe, type DepsProcessamento, type StripeEventPayload } from "./stripe-webhook-processor";
import { normalizarStatusInbox, statusIgual } from "./stripe-webhook-status";

const NEGOCIO = "3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192";

/** invoice no formato `2025-06-30.basil`: sem `subscription`/`payment_intent` soltos. */
const invoiceBasil = (extra: Record<string, unknown> = {}) => ({
  id: "in_1", object: "invoice", customer: "cus_1", currency: "brl", amount_due: 123456, amount_paid: 123456,
  status: "paid", attempt_count: 1, hosted_invoice_url: "https://invoice.stripe.com/i/x",
  parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { crm_negocio_id: NEGOCIO } } },
  status_transitions: { paid_at: 1760000000 },
  ...extra,
});
const evento = (type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}): StripeEventPayload =>
  ({ id: `evt_${type}`, type, created: 1760000100, data: { object }, ...extra });

test("objeto do SaaS Callface é ignorado; o do ONFACE não", () => {
  assert.equal(eventoDoSaaS({ metadata: { organization_id: "o", plan_id: "p", user_id: "u" } }), true);
  assert.equal(eventoDoSaaS({ metadata: { user_id: "u" } }), true);
  assert.equal(eventoDoSaaS({ parent: { subscription_details: { metadata: { plan_id: "p" } } } }), true);
  assert.equal(eventoDoSaaS({ metadata: { organization_id: "o", crm_organization_id: "x" } }), false, "crm_* prova que é ONFACE");
  assert.equal(eventoDoSaaS({ metadata: { crm_negocio_id: NEGOCIO } }), false);
  assert.equal(eventoDoSaaS({ metadata: {} }), false);
  assert.equal(eventoDoSaaS({}), false);
});

test("formatarValor e vocabulário de status", () => {
  assert.equal(formatarValor(123456, "brl"), "R$ 1.234,56");
  assert.equal(formatarValor(null), "valor não informado");
  assert.equal(normalizarStatusInbox("PENDING"), "pending");
  assert.equal(normalizarStatusInbox(" Processed "), "processed");
  assert.equal(normalizarStatusInbox("lixo"), null);
  assert.ok(statusIgual("FAILED", "failed"));
  assert.ok(!statusIgual("lixo", "lixo"));
});

test("invoice.paid no basil: assinatura, negócio e valor saem do lugar novo", () => {
  const f = descreverEventoFinanceiro(evento("invoice.paid", invoiceBasil()))!;
  assert.equal(f.tipo, "InvoicePaid");
  assert.match(f.titulo, /R\$ 1\.234,56/);
  assert.equal(f.subscriptionId, "sub_1");
  assert.equal(f.negocioId, NEGOCIO);
  assert.equal(f.customerId, "cus_1");
  assert.equal(subscriptionIdDe(invoiceBasil()), "sub_1");
  assert.equal(f.chave, "invoice-paid:in_1");
});

test("fatura emitida: created+finalized contam UM fato; rascunho não conta", () => {
  const fin = descreverEventoFinanceiro(evento("invoice.finalized", invoiceBasil({ status: "open", due_date: 1762000000 })))!;
  const cri = descreverEventoFinanceiro(evento("invoice.created", invoiceBasil({ status: "open" })))!;
  assert.equal(fin.tipo, "InvoiceIssued");
  assert.equal(fin.chave, cri.chave, "mesma chave → a timeline grava uma linha só");
  assert.match(fin.titulo, /vence \d{2}\/\d{2}\/\d{4}/);
  assert.equal(descreverEventoFinanceiro(evento("invoice.created", invoiceBasil({ status: "draft" }))), null);
});

test("fatura falhou, venceu e exige ação", () => {
  const falhou = descreverEventoFinanceiro(evento("invoice.payment_failed", invoiceBasil({ status: "open", attempt_count: 2, next_payment_attempt: 1762000000 })))!;
  assert.equal(falhou.tipo, "InvoicePaymentFailed");
  assert.match(falhou.titulo, /tentativa 2/);
  assert.equal(descreverEventoFinanceiro(evento("invoice.overdue", invoiceBasil({ status: "open" })))!.tipo, "InvoiceOverdue");
  assert.equal(descreverEventoFinanceiro(evento("invoice.payment_action_required", invoiceBasil({ status: "open" })))!.tipo, "InvoiceActionRequired");
});

const item = (centavos: number, qtd = 1) => ({ data: [{ quantity: qtd, price: { unit_amount: centavos, currency: "brl", nickname: "Pro", recurring: { interval: "month" } } }] });

test("assinatura: criada, upgrade, downgrade, cancelamento agendado, cancelada", () => {
  const sub = { id: "sub_1", object: "subscription", customer: "cus_1", status: "active", items: item(19900) };
  assert.match(descreverEventoFinanceiro(evento("customer.subscription.created", sub))!.titulo, /Assinatura criada — Pro · R\$ 199,00\/mês/);

  const up = descreverEventoFinanceiro(evento("customer.subscription.updated", sub, { data: { object: sub, previous_attributes: { items: item(9900) } } }))!;
  assert.equal(up.tipo, "SubscriptionUpgraded");
  assert.match(up.titulo, /R\$ 99,00 → R\$ 199,00\/mês/);
  const down = descreverEventoFinanceiro(evento("customer.subscription.updated", { ...sub, items: item(9900) }, { data: { object: { ...sub, items: item(9900) }, previous_attributes: { items: item(19900) } } }))!;
  assert.equal(down.tipo, "SubscriptionDowngraded");

  const agendado = descreverEventoFinanceiro(evento("customer.subscription.updated", { ...sub, cancel_at_period_end: true, cancel_at: 1765000000 }, { data: { object: { ...sub, cancel_at_period_end: true, cancel_at: 1765000000 }, previous_attributes: { cancel_at_period_end: false } } }))!;
  assert.equal(agendado.tipo, "SubscriptionCancelScheduled");
  assert.match(agendado.titulo, /para \d{2}\/\d{2}\/\d{4}/);

  const cancelada = descreverEventoFinanceiro(evento("customer.subscription.deleted", { ...sub, status: "canceled", cancellation_details: { reason: "payment_failed" } }))!;
  assert.equal(cancelada.tipo, "SubscriptionCanceled");
  assert.match(cancelada.titulo, /falha de pagamento/);

  // renovação de período (ruído) não vira linha na timeline
  assert.equal(descreverEventoFinanceiro(evento("customer.subscription.updated", sub, { data: { object: sub, previous_attributes: { latest_invoice: "in_0" } } })), null);
  assert.equal(descreverEventoFinanceiro(evento("customer.subscription.trial_will_end", { ...sub, trial_end: 1765000000 }))!.tipo, "SubscriptionTrialEnding");
});

test("forma de pagamento (inclusive detached, com customer nulo) e customer.updated", () => {
  const pm = { id: "pm_1", object: "payment_method", type: "card", customer: "cus_1", card: { brand: "visa", last4: "4242" } };
  assert.match(descreverEventoFinanceiro(evento("payment_method.attached", pm))!.titulo, /adicionada — Visa final 4242/);
  const det = descreverEventoFinanceiro(evento("payment_method.detached", { ...pm, customer: null }, { data: { object: { ...pm, customer: null }, previous_attributes: { customer: "cus_1" } } }))!;
  assert.equal(det.tipo, "PaymentMethodDetached");
  assert.equal(det.customerId, "cus_1");
  assert.equal(descreverEventoFinanceiro(evento("customer.updated", { id: "cus_1", object: "customer" })), null);
});

test("pagamentos: PAID, FAILED por tentativa e REFUNDED", () => {
  const pago = pagamentoDoEvento(evento("invoice.paid", invoiceBasil()))!;
  assert.equal(pago.status, "PAID");
  assert.equal(pago.valorCentavos, 123456);
  assert.equal(pago.idempotencyKey, "stripe:paid:in_1");

  const f1 = pagamentoDoEvento(evento("invoice.payment_failed", invoiceBasil({ status: "open", attempt_count: 1 })))!;
  const f2 = pagamentoDoEvento(evento("invoice.payment_failed", invoiceBasil({ status: "open", attempt_count: 2 })))!;
  assert.equal(f1.status, "FAILED");
  assert.notEqual(f1.idempotencyKey, f2.idempotencyKey, "cada tentativa é uma linha");
  assert.equal(pagamentoDoEvento(evento("invoice.payment_failed", invoiceBasil({ status: "open", attempt_count: 2 })))!.idempotencyKey, f2.idempotencyKey, "reentrega = mesma chave");

  const est = pagamentoDoEvento(evento("charge.refunded", { id: "ch_1", object: "charge", customer: "cus_1", currency: "brl", amount: 10000, amount_refunded: 4000 }))!;
  assert.equal(est.status, "REFUNDED");
  assert.equal(est.valorCentavos, 4000);
  assert.equal(est.valorOriginalCentavos, 10000);
  assert.match(descreverEventoFinanceiro(evento("charge.refunded", { id: "ch_1", customer: "cus_1", currency: "brl", amount: 10000, amount_refunded: 4000 }))!.titulo, /Estorno parcial — R\$ 40,00 de R\$ 100,00/);
  assert.equal(pagamentoDoEvento(evento("customer.updated", {})), null);
});

test("recebível: open/paid/overdue/uncollectible/void", () => {
  const ontem = new Date(Date.now() - 86400000), amanha = new Date(Date.now() + 86400000);
  assert.equal(estadoDoRecebivel("paga", null), "paid");
  assert.equal(estadoDoRecebivel("aberta", amanha), "open");
  assert.equal(estadoDoRecebivel("aberta", null), "open");
  assert.equal(estadoDoRecebivel("aberta", ontem), "overdue");
  assert.equal(estadoDoRecebivel("uncollectible", null), "uncollectible");
  assert.equal(estadoDoRecebivel("void", null), "void");
  assert.equal(estadoDoRecebivel("rascunho", null), null);
});

test("o endpoint passa de 20 para 31 eventos, e os 11 novos (8 do lote 4 + 3 do documento fiscal) estão todos na lista", () => {
  assert.equal(EVENTOS_NOVOS.length, 11);
  assert.equal(EVENTOS_ESPERADOS.length, 31);
  for (const e of EVENTOS_NOVOS) assert.ok((EVENTOS_ESPERADOS as readonly string[]).includes(e), e);
});

/* ── processador com dependências falsas ───────────────────────────────── */

function depsFalsas(chamadas: string[], falhaEm?: string): DepsProcessamento {
  const f = (nome: string, ret = "ok") => async () => { chamadas.push(nome); if (nome === falhaEm) throw new Error(`boom em ${nome}`); return ret; };
  return {
    paymentConfirmed: f("paymentConfirmed"), invoicePaid: f("invoicePaid"), asyncPaymentFailed: f("asyncPaymentFailed"),
    checkoutExpired: f("checkoutExpired"), invoicePaymentFailed: f("invoicePaymentFailed"), chargeRefunded: f("chargeRefunded"),
    dispute: f("dispute"), subscriptionCanceled: f("subscriptionCanceled"), subscriptionLink: f("subscriptionLink"),
    mockMode: () => false,
    sync: async () => { chamadas.push("sync"); if (falhaEm === "sync") throw new Error("boom em sync"); return { subs: 1 }; },
    automacao: async (a) => { chamadas.push(`automacao:${String(a.gatilho)}`); },
    timeline: async (_o, fato) => { chamadas.push(`timeline:${fato.tipo}`); return "gravado"; },
    pagamento: async (_o, p) => { chamadas.push(`pagamento:${p.status}`); return "gravado"; },
    recebivel: async () => { chamadas.push("recebivel"); return "ok"; },
    recalcular: async () => { chamadas.push("recalcular"); return "0"; },
    avisar: async (a) => { chamadas.push(`avisar:${a.tipo}`); return "1 notificado(s)"; },
    cadastro: async (_o, _c, m) => { chamadas.push(`cadastro:${m.rotulos.join("+")}`); return { resumo: "ok", divergencias: [] }; },
  };
}
const ctx = { organizacaoId: "org-1", inboxId: "inbox-1" };

test("invoice.paid: handler, sync, automação, timeline, pagamento PAID e recebível — nessa ordem", async () => {
  const c: string[] = [];
  await processarEventoStripe(evento("invoice.paid", invoiceBasil()), ctx, depsFalsas(c));
  assert.deepEqual(c, ["invoicePaid", "sync", "automacao:fatura_paga", "timeline:InvoicePaid", "pagamento:PAID", "recebivel", "recalcular"]);
});

test("invoice.payment_failed grava pagamento FAILED; charge.refunded grava REFUNDED", async () => {
  const c1: string[] = [];
  await processarEventoStripe(evento("invoice.payment_failed", invoiceBasil({ status: "open" })), ctx, depsFalsas(c1));
  assert.ok(c1.includes("pagamento:FAILED") && c1.includes("timeline:InvoicePaymentFailed") && c1.includes("invoicePaymentFailed"));
  const c2: string[] = [];
  await processarEventoStripe(evento("charge.refunded", { id: "ch_1", customer: "cus_1", currency: "brl", amount: 100, amount_refunded: 100 }), ctx, depsFalsas(c2));
  assert.ok(c2.includes("pagamento:REFUNDED") && c2.includes("timeline:PaymentRefunded") && c2.includes("chargeRefunded"));
});

test("eventos novos: aviso + timeline; os de cliente não disparam o sync completo", async () => {
  const c: string[] = [];
  await processarEventoStripe(evento("invoice.overdue", invoiceBasil({ status: "open" })), ctx, depsFalsas(c));
  assert.ok(c.includes("avisar:fatura_vencida") && c.includes("timeline:InvoiceOverdue") && c.includes("automacao:fatura_atrasada") && c.includes("sync"));
  const pm: string[] = [];
  await processarEventoStripe(evento("payment_method.attached", { id: "pm_1", type: "card", customer: "cus_1", card: { brand: "visa", last4: "4242" } }), ctx, depsFalsas(pm));
  assert.deepEqual(pm, ["timeline:PaymentMethodAttached"]);
  const cu: string[] = [];
  const r = await processarEventoStripe(evento("customer.updated", { id: "cus_1", object: "customer" }), ctx, depsFalsas(cu));
  assert.deepEqual(cu, []);
  assert.match(r.passos.join(" "), /customer\.updated registrado/);
  const tr: string[] = [];
  await processarEventoStripe(evento("customer.subscription.trial_will_end", { id: "sub_1", object: "subscription", customer: "cus_1", trial_end: 1765000000 }), ctx, depsFalsas(tr));
  assert.ok(tr.includes("avisar:trial_terminando") && tr.includes("timeline:SubscriptionTrialEnding") && !tr.includes("sync"));
});

test("falha em qualquer passo LANÇA (é isso que vira failed + fila)", async () => {
  await assert.rejects(processarEventoStripe(evento("invoice.paid", invoiceBasil()), ctx, depsFalsas([], "invoicePaid")), /boom em invoicePaid/);
  await assert.rejects(processarEventoStripe(evento("invoice.paid", invoiceBasil()), ctx, depsFalsas([], "sync")), /boom em sync/);
});

/* ── ciclo do inbox com portas em memória ──────────────────────────────── */

function portasEmMemoria(opcoes: { falhar?: boolean; filaFora?: boolean; statusInicial?: string } = {}) {
  const linha: LinhaInbox = { id: "i1", eventId: "evt_1", eventType: "invoice.paid", status: opcoes.statusInicial ?? "PENDING", organizacaoId: "org-1", attempts: 0, payload: evento("invoice.paid", invoiceBasil()) };
  const estado = { status: linha.status, erro: null as string | null, tentativas: 0, processou: 0, fila: [] as string[], auditoria: [] as string[] };
  const portas: PortasInbox = {
    async claim() {
      const s = normalizarStatusInbox(estado.status);
      if (s === "processed") return null;
      estado.status = "processing"; estado.tentativas++;
      return { ...linha, attempts: estado.tentativas };
    },
    async situacao() { return { status: estado.status }; },
    async resolverOrganizacao() { return "org-1"; },
    async definirOrganizacao() {},
    async devolverUnresolved() { estado.status = "unresolved"; },
    async marcarProcessado() { estado.status = "processed"; estado.erro = null; },
    async marcarFalho(_id, erro) { estado.status = "failed"; estado.erro = erro; },
    async auditar(_o, acao) { estado.auditoria.push(acao); },
    async enfileirar(eventId) { if (opcoes.filaFora) throw new Error("redis fora"); estado.fila.push(eventId); },
    async processar() { estado.processou++; if (opcoes.falhar) throw new Error("sync fora do ar"); return { passos: ["ok"] }; },
  };
  return { portas, estado };
}

test("idempotência: evento PROCESSED (maiúscula, como a produção gravou) não reprocessa", async () => {
  const { portas, estado } = portasEmMemoria({ statusInicial: "PROCESSED" });
  const r = await executarComPortas(portas, "i1", { enfileirarSeFalhar: true });
  assert.equal(r.estado, "ja_processado");
  assert.equal(estado.processou, 0);
});

test("idempotência: reentrega depois de processar não refaz nada", async () => {
  const { portas, estado } = portasEmMemoria();
  assert.equal((await executarComPortas(portas, "i1", { enfileirarSeFalhar: true })).estado, "processado");
  assert.equal((await executarComPortas(portas, "i1", { enfileirarSeFalhar: true })).estado, "ja_processado");
  assert.equal(estado.processou, 1);
  assert.deepEqual(estado.auditoria, ["stripe.webhook_processado"]);
});

test("falha vira `failed` com o erro, audit stripe.webhook_falhou e entra na fila", async () => {
  const { portas, estado } = portasEmMemoria({ falhar: true });
  const r = await executarComPortas(portas, "i1", { enfileirarSeFalhar: true });
  assert.equal(r.estado, "falhou");
  assert.equal(estado.status, "failed");
  assert.match(estado.erro ?? "", /sync fora do ar/);
  assert.deepEqual(estado.fila, ["evt_1"]);
  assert.deepEqual(estado.auditoria, ["stripe.webhook_falhou"]);
  assert.ok(r.estado === "falhou" && r.enfileirado);
  // e o worker (sem re-enfileirar) consegue refazer depois: failed é retomável
  const { portas: p2, estado: e2 } = portasEmMemoria({ statusInicial: "FAILED" });
  assert.equal((await executarComPortas(p2, "i1", { enfileirarSeFalhar: false })).estado, "processado");
  assert.equal(e2.status, "processed");
});

test("fila fora do ar: a falha é reportada como NÃO enfileirada (a rota responde 500 e o Stripe reentrega)", async () => {
  const { portas } = portasEmMemoria({ falhar: true, filaFora: true });
  const r = await executarComPortas(portas, "i1", { enfileirarSeFalhar: true });
  assert.ok(r.estado === "falhou" && r.enfileirado === false);
});

test("worker: falha não re-enfileira (o BullMQ refaz com backoff)", async () => {
  const { portas, estado } = portasEmMemoria({ falhar: true });
  await executarComPortas(portas, "i1", { enfileirarSeFalhar: false });
  assert.deepEqual(estado.fila, []);
});
