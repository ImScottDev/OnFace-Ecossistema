import test from "node:test";
import assert from "node:assert/strict";
import { mensalidadeDaAssinatura } from "./stripe-mensalidade";

const mensal = (valor: number, qtd = 1) => ({ price: { unit_amount: valor, recurring: { interval: "month" } }, quantity: qtd });

test("mensal é o próprio valor, e quantidade multiplica", () => {
  assert.equal(mensalidadeDaAssinatura([mensal(8990)]), 89.9);
  assert.equal(mensalidadeDaAssinatura([mensal(8990, 2)]), 179.8);
});

test("vários itens somam (foi o caso da SMOV: Starter + Full)", () => {
  assert.equal(mensalidadeDaAssinatura([mensal(8990), mensal(17990)]), 269.8);
});

test("anual vira mensalidade equivalente, não o valor cheio", () => {
  assert.equal(mensalidadeDaAssinatura([{ price: { unit_amount: 179990, recurring: { interval: "year" } }, quantity: 1 }]), 149.99);
});

test("item sem recorrência (setup) não entra na mensalidade", () => {
  assert.equal(mensalidadeDaAssinatura([mensal(8990), { price: { unit_amount: 164990, recurring: null }, quantity: 1 }]), 89.9);
});

test("sem itens não inventa valor", () => {
  assert.equal(mensalidadeDaAssinatura([]), 0);
  assert.equal(mensalidadeDaAssinatura(null), 0);
});
