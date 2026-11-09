import test from "node:test";
import assert from "node:assert/strict";
import { nomeDoVendedor, ehAutoatendimento, ROTULO_AUTOATENDIMENTO } from "./autoatendimento";

test("quem vendeu aparece com o próprio nome", () => {
  assert.equal(nomeDoVendedor("Mayra Schincariol", "novo"), "Mayra Schincariol");
  assert.equal(nomeDoVendedor("Mayra Schincariol", "self_checkout"), "Mayra Schincariol");
});

test("venda de autoatendimento mostra o canal, não '—' nem uma pessoa inventada", () => {
  assert.equal(nomeDoVendedor(null, "self_checkout"), ROTULO_AUTOATENDIMENTO);
  assert.equal(ehAutoatendimento("self_checkout"), true);
});

test("venda sem responsável e sem ser autoatendimento continua sendo buraco de dado", () => {
  assert.equal(nomeDoVendedor(null, "novo"), null);
  assert.equal(nomeDoVendedor(undefined, null), null);
  assert.equal(ehAutoatendimento("carteira"), false);
});
