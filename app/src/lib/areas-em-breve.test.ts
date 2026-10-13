import assert from "node:assert/strict";
import test from "node:test";
import { areaEmBreve, areasEmBreve, labelsEmBreve } from "./areas-em-breve";

test("sem AREAS_EM_BREVE a área está aberta; com a variável, bloqueada", () => {
  delete process.env.AREAS_EM_BREVE;
  assert.equal(areaEmBreve("automacoes"), false);
  process.env.AREAS_EM_BREVE = "";
  assert.equal(areaEmBreve("automacoes"), false);
  process.env.AREAS_EM_BREVE = " Automacoes ,outra";
  assert.equal(areaEmBreve("automacoes"), true);
  delete process.env.AREAS_EM_BREVE;
});

test("Insights fecha como Automações, e o selo do menu acha o item pelo label", () => {
  process.env.AREAS_EM_BREVE = "automacoes,insights";
  assert.equal(areaEmBreve("insights"), true);
  assert.deepEqual(labelsEmBreve(areasEmBreve()), ["Automações", "Insights"]);
  process.env.AREAS_EM_BREVE = "insights";
  assert.equal(areaEmBreve("automacoes"), false);
  assert.deepEqual(labelsEmBreve(areasEmBreve()), ["Insights"]);
  delete process.env.AREAS_EM_BREVE;
});
