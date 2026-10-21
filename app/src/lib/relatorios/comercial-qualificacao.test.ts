import { test } from "node:test";
import assert from "node:assert/strict";
import { taxaQualificacaoDaSafra } from "./comercial-qualificacao";
test("qualificação usa mesma safra de leads e produz 0–100%", () => {
  assert.equal(taxaQualificacaoDaSafra(10, 20), 50);
  assert.equal(taxaQualificacaoDaSafra(1, 3), 33.3);
  assert.equal(taxaQualificacaoDaSafra(0, 3), 0);
  assert.equal(taxaQualificacaoDaSafra(3, 3), 100);
});
test("sem denominador e contagens inconsistentes não inventam taxas", () => {
  assert.equal(taxaQualificacaoDaSafra(0, 0), null);
  assert.equal(taxaQualificacaoDaSafra(9, 2), null);
  assert.equal(taxaQualificacaoDaSafra(-1, 10), null);
  assert.equal(taxaQualificacaoDaSafra(NaN, 5), null);
});
