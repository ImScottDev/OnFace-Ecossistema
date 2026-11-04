/**
 * Venda no valor de tabela tem que sair com o Price OFICIAL, e só a negociada
 * cria preço novo. Quem libera o produto do outro lado casa pelo price_id: em
 * 03/11/2026 duas vendas do mesmo plano a R$ 89,90 saíram com ids diferentes.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { adicionarLinhasDoCheckout, linhaUsaPrecoOficial, type CheckoutItem } from "./stripe-checkout";

const STARTER: CheckoutItem = {
  nome: "Callface AI - Starter · Mensal",
  quantidade: 1,
  valorUnitario: 89.9,
  valorTabela: 89.9,
  stripePriceId: "price_1TH7JZEd4dqxpSBfw2pBKJdI",
  stripeProductId: "prod_UFcYI8riFCtqdq",
  moeda: "BRL",
  recurringInterval: "month",
};
const campos = (recorrentes: CheckoutItem[], avulsos: CheckoutItem[] = []) => {
  const f = new URLSearchParams();
  adicionarLinhasDoCheckout(f, recorrentes, avulsos, "BRL");
  return f;
};

test("valor de tabela sai pelo Price oficial, com id estável", () => {
  const f = campos([STARTER]);
  assert.equal(f.get("line_items[0][price]"), "price_1TH7JZEd4dqxpSBfw2pBKJdI");
  assert.equal(f.get("line_items[0][price_data][product]"), null, "não pode criar preço novo");
  assert.equal(f.get("line_items[0][quantity]"), "1");
});

test("valor negociado continua criando preço próprio", () => {
  for (const valor of [59.9, 120]) {
    const f = campos([{ ...STARTER, valorUnitario: valor }]);
    assert.equal(f.get("line_items[0][price]"), null, `R$ ${valor} não pode usar o Price de tabela`);
    assert.equal(f.get("line_items[0][price_data][unit_amount]"), String(Math.round(valor * 100)));
    assert.equal(f.get("line_items[0][price_data][recurring][interval]"), "month");
  }
});

test("sem tabela registrada, ou sem price oficial, não arrisca o Price fixo", () => {
  assert.equal(linhaUsaPrecoOficial({ ...STARTER, valorTabela: 0 }, true), false);
  assert.equal(linhaUsaPrecoOficial({ ...STARTER, stripePriceId: "" }, true), false);
  assert.equal(linhaUsaPrecoOficial({ ...STARTER, recurringInterval: null }, true), false, "recorrente sem intervalo");
});

test("avulso de valor escolhido pelo cliente nunca usa Price fixo", () => {
  const avulso: CheckoutItem = { ...STARTER, recurringInterval: null, valorPersonalizado: true };
  assert.equal(linhaUsaPrecoOficial(avulso, false), false);
  const f = campos([], [avulso]);
  assert.equal(f.get("line_items[0][price]"), null);
});

test("venda mista: a linha de tabela usa o oficial, a negociada não", () => {
  const f = campos([STARTER, { ...STARTER, valorUnitario: 59.9 }]);
  assert.equal(f.get("line_items[0][price]"), "price_1TH7JZEd4dqxpSBfw2pBKJdI");
  assert.equal(f.get("line_items[1][price]"), null);
  assert.equal(f.get("line_items[1][price_data][unit_amount]"), "5990");
});
