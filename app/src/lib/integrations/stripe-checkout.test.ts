import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { adicionarLinhasDoCheckout, validarValorDoItem, duracaoDoDescontoRecorrente, linhasDoCheckout, type CheckoutItem } from "./stripe-checkout";

it("cada linha cobra o valor combinado sobre o produto oficial, nunca o Price de tabela", () => {
  const setup = { ...item("price_setup", 1, "PABX - Setup"), stripeProductId: "prod_setup", valorTabela: 0, valorUnitario: 1649.9, valorPersonalizado: true };
  const mensal = { ...item("price_mensal", 1), stripeProductId: "prod_mensal" };
  const form = new URLSearchParams();
  adicionarLinhasDoCheckout(form, [mensal], [setup], "BRL");
  // recorrente: produto oficial + valor combinado + intervalo
  assert.equal(form.get("line_items[0][price_data][product]"), "prod_mensal");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "1000");
  assert.equal(form.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(form.get("line_items[0][price"), null);
  // avulso: sem intervalo
  assert.equal(form.get("line_items[1][price_data][unit_amount]"), "164990");
  assert.equal(form.get("line_items[1][price_data][product]"), "prod_setup");
  assert.equal(form.get("line_items[1][price_data][recurring][interval]"), null);
  // o min/max do preço de valor escolhido continua valendo
  assert.throws(() => validarValorDoItem({ ...setup, valorMaximoCentavos: 100000 }), /limites/);
  assert.throws(() => validarValorDoItem({ ...setup, valorMinimoCentavos: 200000 }), /limites/);
});

/* O vendedor fecha pelo valor combinado, para mais ou para menos: o checkout
   cobrava pelo Price de tabela e tirava a diferença com cupom, então vender
   acima era recusado (visto em 27/10/2026, Agente IA a R$ 5.000 sobre tabela
   de R$ 500). */
it("valor acima e abaixo da tabela passam, e viram o preço da linha", () => {
  const acima = { ...item("price_x", 1, "Agente IA"), stripeProductId: "prod_x", valorTabela: 500, valorUnitario: 5000 };
  const abaixo = { ...item("price_y", 1, "Plano"), stripeProductId: "prod_y", valorTabela: 200, valorUnitario: 150 };
  assert.doesNotThrow(() => validarValorDoItem(acima));
  assert.doesNotThrow(() => validarValorDoItem(abaixo));
  const form = new URLSearchParams();
  adicionarLinhasDoCheckout(form, [abaixo], [acima], "BRL");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "15000");
  assert.equal(form.get("line_items[1][price_data][unit_amount]"), "500000");
});

it("valor negativo continua recusado", () => {
  assert.throws(() => validarValorDoItem({ ...item("price_z", 1), stripeProductId: "prod_z", valorUnitario: -1 }), /inválido/);
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
