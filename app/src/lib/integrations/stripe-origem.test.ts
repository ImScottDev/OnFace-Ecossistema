import test from "node:test";
import assert from "node:assert/strict";
import { origemDoObjetoStripe, origemDaFatura, ehDoSaas, ignorarNoSync } from "./stripe-origem";

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

test("o sync só ignora quando a marca do SaaS está na própria assinatura", () => {
  // Medido na conta real em 14/10: 88 assinaturas trazem a marca no objeto e 94 são
  // "do SaaS" só porque o Customer tem user_name/user_cnpj. Ignorar essas 94 era o que
  // deixava cliente cancelado ACTIVE no portfólio, contando MRR, sem nenhuma rodada do
  // sync conseguir encerrar — o CRM contava dinheiro de assinatura que não gerenciava.
  const doObjeto = origemDoObjetoStripe({ organization_id: "org_1" }, undefined);
  assert.equal(doObjeto.origem, "saas");
  assert.equal(doObjeto.evidencia, "objeto");
  assert.equal(ignorarNoSync(doObjeto), true, "marca na assinatura: fora do sync");

  const soDoCliente = origemDoObjetoStripe({}, { user_name: "Ana" });
  assert.equal(soDoCliente.origem, "saas");
  assert.equal(soDoCliente.evidencia, "cliente");
  assert.equal(ignorarNoSync(soDoCliente), false, "marca só no cliente: o sync OLHA, senão some receita");

  assert.equal(ignorarNoSync(origemDoObjetoStripe({ negocioId: "n1" }, { user_name: "Ana" })), false,
    "cliente do SaaS que comprou pelo CRM é do CRM");
  assert.equal(ignorarNoSync(origemDoObjetoStripe({}, {})), false, "sem marca nenhuma nunca é descartado");
});
