import { test } from "node:test";
import assert from "node:assert/strict";
import { ehAgenteUsuario, pessoasPrimeiro, SQL_EH_AGENTE } from "./eh-agente";

test("agente é tipo 'agente' ou agente_id preenchido; humano e nulo não", () => {
  assert.equal(ehAgenteUsuario({ tipo: "agente" }), true);
  assert.equal(ehAgenteUsuario({ tipo: "humano", agenteId: "a1" }), true);
  assert.equal(ehAgenteUsuario({ tipo: "humano", agenteId: null }), false);
  assert.equal(ehAgenteUsuario({}), false);
  assert.equal(ehAgenteUsuario(null), false);
});

test("pessoas primeiro, agentes depois, ordem preservada", () => {
  const l = [{ n: "Lia", a: true }, { n: "Ana", a: false }, { n: "NEXO", a: true }, { n: "Bia", a: false }];
  assert.deepEqual(pessoasPrimeiro(l, (x) => x.a).map((x) => x.n), ["Ana", "Bia", "Lia", "NEXO"]);
});

test("fragmento SQL cobre as duas condições", () => {
  assert.match(SQL_EH_AGENTE("x"), /x\.tipo = 'agente' OR x\.agente_id IS NOT NULL/);
});
