import assert from "node:assert/strict";
import test from "node:test";
import { formDaConfiguracao } from "./stripe-portal";

/* O portal existe para UMA coisa: o cliente que paga no boleto trocar para
   cartão sozinho. Se `payment_method_update` cair (um refactor, um merge, uma
   configuração "simplificada"), o portal continua abrindo e mostrando faturas —
   parece funcionando e não resolve nada. Por isso o teste é desta feature, e não
   do formato do form. */
test("a configuração do portal liga a troca de forma de pagamento", () => {
  const form = formDaConfiguracao();
  assert.equal(form.get("features[payment_method_update][enabled]"), "true");
  assert.equal(form.get("features[invoice_history][enabled]"), "true");
});

/* Cancelamento sem motivo registrado é churn que ninguém aprende — e o modo
   imediato geraria reembolso de mês já pago. */
test("cancelamento é no fim do período e pergunta o motivo", () => {
  const form = formDaConfiguracao();
  assert.equal(form.get("features[subscription_cancel][enabled]"), "true");
  assert.equal(form.get("features[subscription_cancel][mode]"), "at_period_end");
  assert.equal(form.get("features[subscription_cancel][cancellation_reason][enabled]"), "true");
  // O Stripe recusa o motivo ligado sem opções.
  assert.ok(form.get("features[subscription_cancel][cancellation_reason][options][0]"));
});

test("o cliente edita cadastro de cobrança, mas não o e-mail que casa o webhook", () => {
  const form = formDaConfiguracao();
  assert.equal(form.get("features[customer_update][enabled]"), "true");
  const campos = [...form.entries()]
    .filter(([k]) => k.startsWith("features[customer_update][allowed_updates]"))
    .map(([, v]) => v);
  assert.deepEqual(campos.sort(), ["address", "name", "phone", "tax_id"]);
});
