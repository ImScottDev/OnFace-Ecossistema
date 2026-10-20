import assert from "node:assert/strict";
import test from "node:test";
import { entityIdFor, eventMatches, triggerFiltersMatch } from "./event-dispatcher";

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

test("o registro da cadência sai do payload da ponte canônica", () => {
  // A ponte publica `lead_legado_id`/`negocio_legado_id`. Sem essas chaves, a
  // cadência "Follow-up pós-proposta" (publicada, gatilho Proposta enviada)
  // casava o evento e não inscrevia ninguém.
  const evento = { aggregateType: "proposta", aggregateId: "prop-1" } as never;
  const daPonte = { lead_legado_id: "lead-1", negocio_legado_id: "neg-1" };
  assert.equal(entityIdFor("lead", evento, daPonte), "lead-1");
  assert.equal(entityIdFor("negocio", evento, daPonte), "neg-1");
  // Quem já publicava no nome curto continua valendo.
  assert.equal(entityIdFor("lead", evento, { leadId: "lead-2" }), "lead-2");
  // Evento do próprio tipo não precisa de payload.
  assert.equal(entityIdFor("proposta", evento, {}), "prop-1");
  // Sem chave nenhuma, não inventa registro.
  assert.equal(entityIdFor("lead", evento, { outra: "x" }), null);
});
