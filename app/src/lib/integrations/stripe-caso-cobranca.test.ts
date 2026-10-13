/**
 * Bug de produção de 13/10/2026: o reprocesso do invoice.paid de 14/09 falhava com
 * `billing_resolution_cases_queue_check` (fila PAGAMENTO_SEM_NEGOCIO inexistente) e o caso
 * ia com organizacao_id NULL. Estes testes pegam os dois, mais o envio da organização do evento.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { FILAS_DE_CASO, montarCaso } from "./stripe-caso-cobranca";
import { negocioIdDaMetadata } from "./stripe-financeiro";
import { processarEventoStripe, type DepsProcessamento } from "./stripe-webhook-processor";

const ORG = "320a9052-dd43-4edb-9b74-34be53c5c419";
const base = {
  motivo: "PAGAMENTO_SEM_NEGOCIO" as const, stripeCustomerId: "cus_VGAm3hKUahQpyQ", stripeSubscriptionId: "sub_1UFeRLEd4dqxpSBfLCpR8rd7",
  evidence: { valor: 69.9 }, recommendedAction: { acao: "x" },
};

test("a fila gravada é uma das três que o CHECK do banco aceita; o motivo vai na evidência", () => {
  const c = montarCaso({ ...base, organizacaoId: ORG });
  assert.ok((FILAS_DE_CASO as readonly string[]).includes(c.queue));
  assert.equal(c.queue, "REVIEW");
  assert.equal(c.evidence.motivo, "PAGAMENTO_SEM_NEGOCIO");
  assert.deepEqual([...FILAS_DE_CASO], ["CONFIRMED", "REVIEW", "CONFLICT"]);
});

test("fila com valor inválido é recusada antes de chegar ao banco", () => {
  assert.throws(() => montarCaso({ ...base, organizacaoId: ORG, fila: "PAGAMENTO_SEM_NEGOCIO" }), /fila de caso inválida/);
  assert.throws(() => montarCaso({ ...base, organizacaoId: ORG, fila: "RECONCILIACAO_STRIPE" }), /fila de caso inválida/);
});

test("caso sem organização não se abre: o tenant vem do evento", () => {
  assert.throws(() => montarCaso({ ...base, organizacaoId: null }), /sem organização/);
  assert.throws(() => montarCaso({ ...base, organizacaoId: undefined }), /sem organização/);
  assert.throws(() => montarCaso({ ...base, organizacaoId: "" }), /sem organização/);
});

test("nenhum insert em billing_resolution_cases usa fila fora do CHECK (varre o código)", () => {
  const dir = __dirname;
  for (const f of fs.readdirSync(dir).filter((x) => /\.ts$/.test(x) && !/\.test\./.test(x))) {
    const txt = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of txt.matchAll(/\bqueue:\s*"([A-Z_]+)"/g)) {
      assert.ok((FILAS_DE_CASO as readonly string[]).includes(m[1]), `${f}: queue "${m[1]}" viola billing_resolution_cases_queue_check`);
    }
    for (const m of txt.matchAll(/billing_resolution_cases[\s\S]{0,300}?VALUES[\s\S]{0,200}?'([A-Z_]+)'/g)) {
      assert.ok((FILAS_DE_CASO as readonly string[]).includes(m[1]), `${f}: fila SQL "${m[1]}" inválida`);
    }
  }
});

test("o processador entrega ao handler a organização do EVENTO (invoice.paid e checkout)", async () => {
  const vistos: string[] = [];
  const f = (n: string) => async (_o: unknown, org?: string) => { vistos.push(`${n}:${org}`); return "ok"; };
  const deps = {
    paymentConfirmed: f("pay"), invoicePaid: f("inv"), asyncPaymentFailed: async () => "", checkoutExpired: async () => "", invoicePaymentFailed: async () => "",
    chargeRefunded: async () => "", dispute: async () => "", subscriptionCanceled: async () => "", subscriptionLink: async () => "",
    mockMode: () => false, sync: async () => ({}), automacao: async () => {}, timeline: async () => "", pagamento: async () => "",
    recebivel: async () => "", recalcular: async () => "", avisar: async () => "", cadastro: async () => ({ resumo: "", divergencias: [] }),
  } as unknown as DepsProcessamento;
  await processarEventoStripe({ id: "evt_1UFeRNEd4dqxpSBfIFt2GQ03", type: "invoice.paid", created: 1757800000, data: { object: { id: "in_1", object: "invoice", customer: "cus_VGAm3hKUahQpyQ", amount_paid: 6990, amount_due: 6990, currency: "brl" } } }, { organizacaoId: ORG, inboxId: "i" }, deps);
  await processarEventoStripe({ type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid" } } }, { organizacaoId: ORG, inboxId: "i" }, deps);
  assert.deepEqual(vistos, [`inv:${ORG}`, `pay:${ORG}`]);
});

test("a metadata do invoice de 14/09 aponta o negócio (a evidência do caso o leva junto)", () => {
  const invoice = { id: "in_x", object: "invoice", metadata: {}, parent: { subscription_details: { metadata: { negocioId: "0585944f-1a9e-4e4e-b3b8-229f6a360ad5", organizacaoId: ORG } } } };
  assert.equal(negocioIdDaMetadata(invoice), "0585944f-1a9e-4e4e-b3b8-229f6a360ad5");
});
