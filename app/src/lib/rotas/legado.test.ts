import assert from "node:assert/strict";
import { test } from "node:test";
import { destinoLegado } from "./legado";

test("id vai para o detalhe e a query segue junto", () => {
  assert.equal(destinoLegado("/pipeline", ["abc"], { aba: "propostas" }, "/pipeline"), "/pipeline/abc?aba=propostas");
});

test("sem detalhe ou sem id, cai na lista com a query", () => {
  assert.equal(destinoLegado("/atendimento", ["x"], {}), "/atendimento");
  assert.equal(destinoLegado("/contatos", undefined, { busca: "a b", tag: ["1", "2"] }, "/contatos/pessoas"), "/contatos?busca=a+b&tag=1&tag=2");
});
