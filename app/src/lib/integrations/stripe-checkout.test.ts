import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { adicionarLinhasDoCheckout, produtosDoDesconto, validarValorDoItem, duracaoDoDescontoRecorrente, linhasDoCheckout, type CheckoutItem } from "./stripe-checkout";

it("desconto da mensalidade não reduz o setup negociado", () => {
  const plano = { ...item("price_plano", 1), stripeProductId: "prod_plano", valorTabela: 200, valorUnitario: 100 };
  const setup = { ...item("price_setup", 1), stripeProductId: "prod_setup", valorPersonalizado: true };
  assert.deepEqual(produtosDoDesconto([plano], [setup]), ["prod_plano"]);
  assert.throws(() => produtosDoDesconto([plano], [{ ...setup, stripeProductId: "prod_plano" }]), /Separe/);
});

it("setup de valor escolhido cobra os R$ 1.649,90 negociados sobre o produto oficial", () => {
  const setup = { ...item("price_setup", 1, "PABX - Setup"), stripeProductId: "prod_setup", valorTabela: 0, valorUnitario: 1649.9, valorPersonalizado: true };
  const form = new URLSearchParams();
  adicionarLinhasDoCheckout(form, [item("price_mensal", 1)], [setup], "BRL");
  assert.equal(form.get("line_items[0][price]"), "price_mensal");
  assert.equal(form.get("line_items[1][price_data][unit_amount]"), "164990");
  assert.equal(form.get("line_items[1][price_data][product]"), "prod_setup");
  assert.equal(form.get("line_items[1][price]"), null);
  assert.throws(() => validarValorDoItem({ ...setup, valorMaximoCentavos: 100000 }), /limites/);
  assert.throws(() => validarValorDoItem({ ...setup, valorMinimoCentavos: 200000 }), /limites/);
  assert.throws(() => validarValorDoItem({ ...setup, valorPersonalizado: false }), /excede/);
});

const item = (stripePriceId: string, quantidade: number, nome = "Item"): CheckoutItem =>
  ({ nome, quantidade, valorUnitario: 10, valorTabela: 10, stripePriceId, moeda: "BRL" });

describe("linhasDoCheckout", () => {
  it("o mesmo Price em três linhas vira uma linha com a soma das quantidades", () => {
    assert.deepEqual(
      linhasDoCheckout([item("price_a", 5), item("price_a", 2), item("price_b", 1), item("price_a", 3)]),
      [{ stripePriceId: "price_a", quantidade: 10 }, { stripePriceId: "price_b", quantidade: 1 }],
    );
  });

  it("Prices diferentes ficam separados, na ordem em que aparecem", () => {
    assert.deepEqual(
      linhasDoCheckout([item("price_b", 1), item("price_a", 1)]).map((l) => l.stripePriceId),
      ["price_b", "price_a"],
    );
  });

  it("quantidade inválida vale 1, como na linha única", () => {
    assert.deepEqual(linhasDoCheckout([item("price_a", 0), item("price_a", 2.4)]), [{ stripePriceId: "price_a", quantidade: 3 }]);
  });

  it("item sem Price oficial falha em voz alta em vez de sumir do checkout", () => {
    assert.throws(() => linhasDoCheckout([item("", 1, "Ramal")]), /Ramal/);
  });
});

describe("duracaoDoDescontoRecorrente", () => {
  it("preço negociado sem prazo dura o que a assinatura durar", () => {
    assert.deepEqual(duracaoDoDescontoRecorrente(null), { duration: "forever" });
    assert.deepEqual(duracaoDoDescontoRecorrente(0), { duration: "forever" });
  });

  it("desconto com prazo dura os meses marcados na proposta", () => {
    assert.deepEqual(duracaoDoDescontoRecorrente(6), { duration: "repeating", duration_in_months: 6 });
  });

  // O bug da LIVA #1570: R$ 719,40/mês no contrato e R$ 1.079,40 a partir do
  // 2º mês, porque o cupom do recorrente saía com duration "once".
  it("nunca devolve 'once' para desconto de recorrente", () => {
    for (const meses of [null, 0, 1, 24]) {
      assert.notEqual(duracaoDoDescontoRecorrente(meses).duration, "once");
    }
  });
});
