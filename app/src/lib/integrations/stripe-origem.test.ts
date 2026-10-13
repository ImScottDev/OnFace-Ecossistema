import test from "node:test";
import assert from "node:assert/strict";
import { origemDoObjetoStripe, origemDaFatura, ehDoSaas } from "./stripe-origem";

test("organization_id, plan_id ou user_id na assinatura: é do SaaS", () => {
  for (const k of ["organization_id", "plan_id", "user_id"]) {
    assert.deepEqual(origemDoObjetoStripe({ [k]: "x" }), { origem: "saas", evidencia: "objeto" });
  }
});

test("negocioId (ou crm_*) na assinatura: é do CRM, mesmo com Customer do SaaS", () => {
  const cli = { user_name: "Fulano", user_cnpj: "123" };
  assert.equal(origemDoObjetoStripe({ negocioId: "n" }, cli).origem, "crm");
  assert.equal(origemDoObjetoStripe({ crm_organization_id: "o" }, cli).origem, "crm");
});

test("sem marca no objeto, Customer do SaaS desempata como inferência", () => {
  assert.deepEqual(origemDoObjetoStripe({}, { user_name: "F" }), { origem: "saas", evidencia: "cliente" });
});

test("sem marca nenhuma: NÃO é descartado, fica sinalizado", () => {
  const d = origemDoObjetoStripe({}, {});
  assert.equal(d.origem, "sem_marca");
  assert.equal(ehDoSaas(d), false);
  assert.equal(ehDoSaas(origemDoObjetoStripe(null, null)), false);
});

test("marca dos dois lados: conflito, mantido", () => {
  const d = origemDoObjetoStripe({ plan_id: "p", negocioId: "n" });
  assert.equal(d.origem, "conflito");
  assert.equal(ehDoSaas(d), false);
});

test("valor vazio não conta como marca", () => {
  assert.equal(origemDoObjetoStripe({ organization_id: " ", negocioId: "" }).origem, "sem_marca");
});

test("fatura herda a origem da assinatura", () => {
  assert.equal(origemDaFatura({ parent: { subscription_details: { metadata: { organization_id: "o" } } } }).origem, "saas");
  assert.equal(origemDaFatura({ parent: { subscription_details: { metadata: { negocioId: "n" } } }, customer: { id: "c", metadata: { user_name: "F" } } }).origem, "crm");
});
