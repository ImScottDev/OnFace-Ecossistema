import assert from "node:assert/strict";
import test from "node:test";
import { areaEmBreve } from "./areas-em-breve";

test("sem AREAS_EM_BREVE a área está aberta; com a variável, bloqueada", () => {
  delete process.env.AREAS_EM_BREVE;
  assert.equal(areaEmBreve("automacoes"), false);
  process.env.AREAS_EM_BREVE = "";
  assert.equal(areaEmBreve("automacoes"), false);
  process.env.AREAS_EM_BREVE = " Automacoes ,outra";
  assert.equal(areaEmBreve("automacoes"), true);
  delete process.env.AREAS_EM_BREVE;
});
