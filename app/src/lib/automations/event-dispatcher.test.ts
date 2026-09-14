import assert from "node:assert/strict";
import test from "node:test";
import { eventMatches, triggerFiltersMatch } from "./event-dispatcher";

test("aceita evento canônico e aliases estáveis", () => {
  assert.equal(eventMatches("LeadCreated", "LeadCreated"), true);
  assert.equal(eventMatches("lead.created", "LeadCreated"), true);
  assert.equal(eventMatches("PaymentFailed", "LeadCreated"), false);
});

test("filtros do gatilho aceitam campo, lista e caminho aninhado", () => {
  const facts = { origem: "Meta", tags: ["inbound", "quente"], financeiro: { status: "atrasado" } };
  assert.equal(triggerFiltersMatch({ origem: "Meta", tags: "quente", "financeiro.status": "atrasado" }, facts), true);
  assert.equal(triggerFiltersMatch({ origem: "Site" }, facts), false);
});
