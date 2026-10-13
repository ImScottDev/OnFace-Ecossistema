/**
 * O que o cliente faz no Portal e VOLTA para o ONFACE: payload falso, sem banco.
 * Cancelar, trocar cartão, corrigir cadastro e documento fiscal → fato na timeline, aviso à equipe e cadastro da empresa.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { descreverEventoFinanceiro } from "./stripe-financeiro";
import { motivoDoPortal, mudancasDoCliente, planoDeCadastro, resumoDeCancelamento } from "./stripe-portal-retorno";
import { processarEventoStripe, type DepsProcessamento, type StripeEventPayload } from "./stripe-webhook-processor";

const ev = (type: string, object: Record<string, unknown>, previous: Record<string, unknown> = {}): StripeEventPayload =>
  ({ id: `evt_${type}`, type, created: 1760000100, data: { object, previous_attributes: previous } });

test("cancelar no portal: o motivo que o cliente deu aparece no fato; sem motivo (Dashboard) não inventa", () => {
  const sub = {
    id: "sub_1", object: "subscription", customer: "cus_1", status: "active", cancel_at_period_end: true, cancel_at: 1765000000,
    cancellation_details: { reason: "cancellation_requested", feedback: "too_expensive", comment: "vamos pausar o projeto" },
  };
  const f = descreverEventoFinanceiro(ev("customer.subscription.updated", sub, { cancel_at_period_end: false, cancel_at: null }))!;
  assert.equal(f.tipo, "SubscriptionCancelScheduled");
  assert.match(f.descricao ?? "", /Motivo informado pelo cliente: preço alto — vamos pausar o projeto/);
  assert.equal(f.contexto.motivo, "preço alto — vamos pausar o projeto");

  const semMotivo = descreverEventoFinanceiro(ev("customer.subscription.updated", { ...sub, cancellation_details: { reason: null, feedback: null, comment: null } }, { cancel_at_period_end: false }))!;
  assert.doesNotMatch(semMotivo.descricao ?? "", /Motivo informado/);
  assert.equal(motivoDoPortal({ feedback: "other", comment: null }), "outro motivo");
  assert.equal(motivoDoPortal(null), null);
});

test("desfazer o cancelamento no portal vira fato, sem aviso de cancelamento", () => {
  const sub = { id: "sub_1", object: "subscription", customer: "cus_1", status: "active", cancel_at_period_end: false, cancel_at: null };
  const f = descreverEventoFinanceiro(ev("customer.subscription.updated", sub, { cancel_at_period_end: true, cancel_at: 1765000000 }))!;
  assert.match(f.titulo, /desfeito/);
});

test("customer.updated: só nome, telefone, endereço e e-mail contam; metadata e saldo são ruído", () => {
  const cus = { id: "cus_1", object: "customer", name: "Ademicon", phone: "+5545998466676", address: { line1: "Av. Pres. Vargas, 1880", line2: "Fátima", city: "Santa Maria", state: "RS", postal_code: "97015-512" } };
  const m = mudancasDoCliente(ev("customer.updated", cus, { phone: null, address: null }))!;
  assert.deepEqual(m.rotulos, ["telefone", "endereço"]);
  assert.equal(m.novo.telefone, "+5545998466676");
  assert.equal(m.novo.endereco, "Av. Pres. Vargas, 1880, Fátima");
  assert.equal(m.novo.cep, "97015-512");
  assert.equal(m.emailMudou, false);

  assert.equal(mudancasDoCliente(ev("customer.updated", cus, { metadata: {} })), null);
  assert.equal(mudancasDoCliente(ev("customer.updated", cus, { invoice_settings: { default_payment_method: null } })), null);
  assert.equal(mudancasDoCliente(ev("customer.updated", cus, { balance: 0 })), null);
  assert.equal(mudancasDoCliente(ev("customer.updated", cus)), null);
  assert.equal(mudancasDoCliente(ev("customer.updated", cus, { email: "a@b.com" }))!.emailMudou, true);

  const fato = descreverEventoFinanceiro(ev("customer.updated", cus, { phone: null }))!;
  assert.equal(fato.tipo, "CustomerBillingUpdated");
  assert.match(fato.titulo, /Cliente atualizou dados de cobrança — telefone/);
  assert.equal(fato.customerId, "cus_1");
  assert.equal(descreverEventoFinanceiro(ev("customer.updated", cus, { metadata: {} })), null);
});

test("documento fiscal corrigido no portal chega por customer.tax_id.*, não por customer.updated", () => {
  const taxid = { id: "txi_1", object: "tax_id", customer: "cus_1", type: "br_cnpj", value: "12.345.678/0001-95" };
  const m = mudancasDoCliente(ev("customer.tax_id.created", taxid))!;
  assert.equal(m.origem, "tax_id");
  assert.deepEqual(m.novo, { cnpj: "12345678000195" });
  assert.equal(m.documento?.tipo, "CNPJ");
  const fato = descreverEventoFinanceiro(ev("customer.tax_id.updated", taxid))!;
  assert.equal(fato.customerId, "cus_1");
  assert.match(fato.titulo, /documento fiscal/);
  assert.match(fato.descricao ?? "", /CNPJ 12\.345\.678\/0001-95/);
  // CPF não tem coluna na empresa: só timeline
  assert.deepEqual(mudancasDoCliente(ev("customer.tax_id.created", { ...taxid, type: "br_cpf", value: "123.456.789-09" }))!.novo, {});
  assert.equal(mudancasDoCliente(ev("customer.tax_id.deleted", taxid))!.excluido, true);
  assert.deepEqual(mudancasDoCliente(ev("customer.tax_id.deleted", taxid))!.novo, {});
});

test("plano de cadastro: só preenche vazio; valor diferente vira divergência e o CRM não é sobrescrito", () => {
  const p = planoDeCadastro(
    { telefone: "", endereco: "Rua A, 10", cep: null, cidade: "Santa Maria", estado: "RS", cnpj: "" },
    { telefone: "+5545998466676", endereco: "Av. Pres. Vargas, 1880", cep: "97015-512", cidade: "santa  maria", estado: "RS", cnpj: "12345678000195" },
  );
  assert.deepEqual(p.preencher, { telefone: "+5545998466676", cep: "97015-512", cnpj: "12345678000195" });
  assert.equal(p.divergencias.length, 1);
  assert.match(p.divergencias[0], /endereço: o CRM tem "Rua A, 10" e o cliente informou "Av\. Pres\. Vargas, 1880"/);

  // mesmo telefone em outra máscara não é divergência
  assert.deepEqual(planoDeCadastro({ telefone: "(45) 99846-6676" }, { telefone: "+55 45 99846-6676" }), { preencher: {}, divergencias: [] });
});

test("espelho da assinatura: cancelamento agendado vale para os dois modos de cobrança e some quando encerrada", () => {
  assert.equal(resumoDeCancelamento({ status: "active", cancel_at_period_end: true }).cancela_no_fim, true);
  assert.equal(resumoDeCancelamento({ status: "active", cancel_at_period_end: false, cancel_at: 1765000000 }).cancela_no_fim, true, "flexible: só cancel_at");
  assert.equal(resumoDeCancelamento({ status: "active", cancel_at_period_end: false, cancel_at: null }).cancela_no_fim, false);
  assert.equal(resumoDeCancelamento({ status: "canceled", cancel_at_period_end: true, cancel_at: 1 }).cancela_no_fim, false);
});

/* ── ponta a ponta no processador, com dependências falsas ───────────── */

function deps(c: string[], divergencias: string[] = []): DepsProcessamento {
  const f = (n: string) => async () => { c.push(n); return "ok"; };
  return {
    paymentConfirmed: f("paymentConfirmed"), invoicePaid: f("invoicePaid"), asyncPaymentFailed: f("a"), checkoutExpired: f("b"),
    invoicePaymentFailed: f("c"), chargeRefunded: f("d"), dispute: f("e"), subscriptionCanceled: f("subscriptionCanceled"), subscriptionLink: f("subscriptionLink"),
    mockMode: () => false,
    sync: async () => { c.push("sync"); return {}; },
    automacao: async () => { c.push("automacao"); },
    timeline: async (_o, fato) => { c.push(`timeline:${fato.tipo}`); return "ok"; },
    pagamento: f("pagamento"), recebivel: f("recebivel"), recalcular: f("recalcular"),
    avisar: async (a) => { c.push(`avisar:${a.tipo}`); return "1"; },
    cadastro: async (_o, _cus, m) => { c.push(`cadastro:${m.rotulos.join("+")}`); return { resumo: "ok", divergencias }; },
  };
}
const ctx = { organizacaoId: "org-1", inboxId: "i1" };

test("processador: cancelamento agendado pelo cliente sincroniza o espelho, registra na timeline E avisa a equipe", async () => {
  const c: string[] = [];
  const sub = { id: "sub_1", object: "subscription", customer: "cus_1", status: "active", cancel_at_period_end: true, cancel_at: 1765000000, cancellation_details: { feedback: "unused" } };
  await processarEventoStripe(ev("customer.subscription.updated", sub, { cancel_at_period_end: false }), ctx, deps(c));
  assert.ok(c.includes("sync"), "o sync grava cancel_at_period_end no espelho");
  assert.ok(c.includes("timeline:SubscriptionCancelScheduled"));
  assert.ok(c.includes("avisar:cancelamento_agendado"));
});

test("processador: cadastro corrigido no portal vai para a empresa; divergência com o CRM avisa a equipe; sem sync", async () => {
  const c: string[] = [];
  await processarEventoStripe(ev("customer.updated", { id: "cus_1", object: "customer", phone: "+5545998466676" }, { phone: null }), ctx, deps(c));
  assert.deepEqual(c, ["cadastro:telefone", "timeline:CustomerBillingUpdated"]);

  const d: string[] = [];
  await processarEventoStripe(ev("customer.tax_id.created", { id: "txi_1", customer: "cus_1", type: "br_cnpj", value: "12345678000195" }), ctx, deps(d, ['CNPJ: o CRM tem "9" e o cliente informou "1"']));
  assert.deepEqual(d, ["cadastro:documento fiscal", "avisar:cadastro_divergente", "timeline:CustomerBillingUpdated"]);

  const e: string[] = [];
  await processarEventoStripe(ev("customer.updated", { id: "cus_1", object: "customer" }, { metadata: {} }), ctx, deps(e));
  assert.deepEqual(e, [], "customer.updated sem mudança de cadastro não faz nada");
});

test("processador: cartão novo no portal chega como payment_method.attached e vai para a timeline sem sync completo", async () => {
  const c: string[] = [];
  await processarEventoStripe(ev("payment_method.attached", { id: "pm_1", object: "payment_method", type: "card", customer: "cus_1", card: { brand: "visa", last4: "4242" } }), ctx, deps(c));
  assert.deepEqual(c, ["timeline:PaymentMethodAttached"]);
});
