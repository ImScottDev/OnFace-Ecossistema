import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { descricaoDoProduto, rotuloDaRecorrencia, sufixoDoValor, variacaoAmigavel } from "./rotulos";

describe("variacaoAmigavel: o apelido do Price sem repetir o produto", () => {
  const casos: Array<[string, string, string]> = [
    ["PABX - Canais", "PABX - Canais — 04 Canais", "04 Canais"],
    ["PABX - Canais", "PABX - Canais - 1 Canal", "1 Canal"],
    ["PABX - BINA Inteligente", "PABX - BINA Inteligente — Bina Inteligente 1000 Minutos", "1000 Minutos"],
    ["PABX - Linhas", "PABX - Linha 4004 — Linha 4004 | Até 800min", "Linha 4004 · Até 800min"],
    ["PABX - Linhas", "PABX - Linha SIP — Linha Sip", "Linha SIP"],
    ["PABX - Linhas", "PABX - Adicional de Canais | Linha Sip (5 canais aditivos)", "Adicional de Canais · Linha Sip (5 canais aditivos)"],
    ["PABX - Hardware", "PABX - Hardware — Telefone Fanvil X3", "Telefone Fanvil X3"],
    ["Callface AI White Label - Licença", "Callface AI White Label - Licença — Faixa 1 — 1 a 99 licenças", "Faixa 1 · 1 a 99 licenças"],
    ["Callface AI - Full", "Callface AI - Full — Mensal", "Mensal"],
    ["Callface AI - Full", "Avulso", "Avulso"],
  ];
  for (const [produto, variacao, esperado] of casos) {
    it(`${variacao} → ${esperado}`, () => assert.equal(variacaoAmigavel(produto, variacao), esperado));
  }

  it("corta o nome do produto só em palavra inteira", () => {
    assert.equal(variacaoAmigavel("PABX - Ramal", "PABX - Ramal Interno"), "Interno");
    assert.equal(variacaoAmigavel("PABX - Linhas", "PABX - Linhas Especiais"), "Especiais");
  });

  it("vazio continua vazio", () => assert.equal(variacaoAmigavel("PABX - Canais", null), ""));
});

describe("descricaoDoProduto: precedência", () => {
  it("a comercial do ONFACE ganha da description do Stripe", () => {
    assert.equal(descricaoDoProduto({ comercial: "Comercial", stripe: "Stripe" }), "Comercial");
  });
  it("sem comercial, vale a do Stripe; comercial em branco não conta", () => {
    assert.equal(descricaoDoProduto({ comercial: "  ", stripe: "Stripe" }), "Stripe");
    assert.equal(descricaoDoProduto({}), "");
  });
});

describe("recorrência em palavras de cliente", () => {
  it("mensal, anual, setup e avulso", () => {
    assert.equal(rotuloDaRecorrencia("recorrente", "mensal"), "Cobrança mensal");
    assert.equal(rotuloDaRecorrencia("recorrente", "anual"), "Cobrança anual");
    assert.equal(rotuloDaRecorrencia("setup", "unico"), "Setup, pagamento único");
    assert.equal(rotuloDaRecorrencia("avulso", "unico"), "Pagamento único");
    assert.equal(sufixoDoValor("recorrente", "anual"), "/ano");
    assert.equal(sufixoDoValor("recorrente", null), "/mês");
    assert.equal(sufixoDoValor("avulso", null), "");
  });
});
