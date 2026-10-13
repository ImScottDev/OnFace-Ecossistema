import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classificarProdutoPorNome, familiaDoContrato, familiaDaOportunidade } from "../crm/classificar-produto";
import { produtoParaExibir } from "./rotulos";

describe("cliente de PABX nunca vira Callface AI", () => {
  it("o prefixo PABX do catálogo manda sobre termo solto no nome", () => {
    assert.equal(classificarProdutoPorNome("PABX - Integração Callface AI"), "PABX");
    assert.equal(classificarProdutoPorNome("PABX - Linhas"), "PABX");
    assert.equal(classificarProdutoPorNome("Callface AI - Full"), "CALLFACE_AI");
    assert.equal(classificarProdutoPorNome("Callface AI White Label - Full"), "WHITE_LABEL");
  });
  it("contratos.produto='ai' (valor padrão da gravação) não classifica contrato de PABX", () => {
    assert.equal(familiaDoContrato({ produto: "ai", tipo: "RAMAL CALLFACE", servicos: [] }), "PABX");
    assert.equal(familiaDoContrato({ produto: "ai", tipo: "STARTER YEASTAR" }), "PABX");
    assert.notEqual(familiaDoContrato({ produto: "ai", tipo: "legado_zoho", servicos: [] }), "CALLFACE_AI"); // sem nome: UNKNOWN, não palpite
    assert.equal(familiaDoContrato({ produto: "pabx" }), "PABX");
    assert.equal(familiaDoContrato({ produto: "ai", tipo: "Callface AI - Full" }), "CALLFACE_AI");
  });
});

describe("a família vem da oportunidade ganha", () => {
  it("oportunidade de PABX ⇒ PABX, mesmo com contratos.produto='ai' e funil Callface AI", () => {
    const r = familiaDaOportunidade({
      itens: [{ familia: "PABX", valor: 900 }],
      contrato: { produto: "ai", tipo: "Callface AI - Full" }, titulo: "Fulano | Callface AI",
    });
    assert.deepEqual(r, { familia: "PABX", fonte: "itens_da_oportunidade" });
  });
  it("a família do catálogo do preço do item vale quando o item não traz", () => {
    assert.equal(familiaDaOportunidade({ itens: [{ familia: "UNKNOWN", familiaDoCatalogo: "PABX", valor: 1 }], contrato: { produto: "ai" } }).familia, "PABX");
  });
  it("declarada no negócio vence tudo", () => {
    assert.equal(familiaDaOportunidade({ familiaDoNegocio: "PABX", itens: [{ familia: "CALLFACE_AI", valor: 9 }] }).familia, "PABX");
  });
  it("contratos.produto='ai' sozinho nunca vira Callface AI", () => {
    assert.equal(familiaDaOportunidade({ contrato: { produto: "ai" } }).familia, "UNKNOWN");
  });
});

describe("nome do produto exibido", () => {
  it("o nome do Stripe ganha do gravado", () => {
    assert.deepEqual(produtoParaExibir({ produtoReal: "PABX - Linhas", produto: "x", billingSource: "STRIPE" }), { nome: "PABX - Linhas", historico: false });
  });
  it("rótulo de família não é nome de produto", () => {
    for (const f of ["Callface AI", "PABX", "White Label", "CALLFACE_AI", "WHITE_LABEL"]) {
      assert.equal(produtoParaExibir({ produto: f, produtoReal: f }).nome, null, f);
    }
    assert.equal(produtoParaExibir({ produto: "prod_UlpQkZB4dLK7x3" }).nome, null);
  });
  it("produto legado sem par no catálogo mantém o nome e vira histórico", () => {
    assert.deepEqual(produtoParaExibir({ produto: "RAMAL FACILITA", billingSource: "LEDGER_JULHO" }), { nome: "RAMAL FACILITA", historico: true });
    assert.deepEqual(produtoParaExibir({ produto: "Callface AI - Cold Calling", billingSource: "MARCO_ZERO" }), { nome: "Callface AI - Cold Calling", historico: true });
  });
  it("sem nome em lugar nenhum: nulo, não família", () => {
    assert.deepEqual(produtoParaExibir({ billingSource: "LEDGER_JULHO" }), { nome: null, historico: false });
  });
});
