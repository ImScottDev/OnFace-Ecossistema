/**
 * A regra de comprovante do fechamento.
 *
 * Regra do Scott (09/11/2026): o ganho só existe com contrato assinado ou
 * pagamento confirmado, então toda venda tem que ter um dos dois no relatório.
 * Linha sem nada é defeito a investigar, não linha normal.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { escolherComprovante } from "./fechamento-comercial";

test("o recibo do contrato da venda vem primeiro", () => {
  const c = escolherComprovante({
    reciboDoContrato: "https://invoice/contrato",
    reciboDoLead: "https://invoice/lead",
    contratoAssinado: "https://doc/pdf",
    reciboDaEmpresa: "https://invoice/empresa",
  });
  assert.equal(c?.url, "https://invoice/contrato");
  assert.equal(c?.tipo, "recibo");
});

test("sem recibo da venda, o contrato assinado é o comprovante", () => {
  const c = escolherComprovante({ contratoAssinado: "https://doc/pdf", stripeCustomerId: "cus_1" });
  assert.equal(c?.url, "https://doc/pdf");
  assert.equal(c?.rotulo, "Contrato assinado");
});

test("recibo achado pela empresa vale, e é rotulado como tal", () => {
  // Foi o caso de Chatpro e MENOLIFT: fatura paga presa a outro lead da mesma empresa.
  const c = escolherComprovante({ reciboDaEmpresa: "https://invoice/empresa" });
  assert.equal(c?.tipo, "recibo_da_empresa");
  assert.equal(c?.rotulo, "Recibo (da empresa)");
});

test("o painel do Stripe é o último recurso, nunca o preferido", () => {
  const c = escolherComprovante({ stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_1" });
  assert.equal(c?.tipo, "stripe");
  assert.match(c!.url, /subscriptions\/sub_1$/);
});

test("sem nenhuma fonte, não inventa comprovante", () => {
  assert.equal(escolherComprovante({}), null);
  assert.equal(escolherComprovante({ reciboDoContrato: null, contratoAssinado: undefined }), null);
});
