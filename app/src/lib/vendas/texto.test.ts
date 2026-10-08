import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { textoSimples } from "./texto";

describe("textoSimples", () => {
  it("devolve o texto puro intocado, sem alocar nada", () => {
    const puro = "Ligação por Callface: objetivo da ligação";
    assert.equal(textoSimples(puro), puro);
  });

  it("transforma <br> em quebra de linha — o caso real do Zoho", () => {
    assert.equal(
      textoSimples("todas acompanhadas de ligação primeiramente. <br>Cliente desistiu"),
      "todas acompanhadas de ligação primeiramente. \nCliente desistiu",
    );
  });

  it("fecha parágrafo com quebra e remove a tag de abertura", () => {
    assert.equal(textoSimples("<p>Primeira</p><p>Segunda</p>"), "Primeira\nSegunda");
  });

  it("resolve as entidades que aparecem no dado importado", () => {
    assert.equal(textoSimples("Cliente&nbsp;A &amp; Cliente B"), "Cliente A & Cliente B");
  });

  it("preserva entidade desconhecida em vez de comê-la", () => {
    assert.equal(textoSimples("preço &euro;100"), "preço &euro;100");
  });

  it("não deixa buraco quando o editor gera quebra em série", () => {
    assert.equal(textoSimples("A<br><br><br><br>B"), "A\n\nB");
  });

  it("passa null adiante — ausência não é string vazia", () => {
    assert.equal(textoSimples(null), null);
    assert.equal(textoSimples(undefined), null);
  });
});

import { nomeCompleto } from "./texto";
describe("nomeCompleto", () => { it("não repete o nome que a carga já trouxe no sobrenome", () => {
  assert.equal(nomeCompleto("Lucas", "Lucas Oliveira"), "Lucas Oliveira");
  assert.equal(nomeCompleto("Lucas Oliveira", "Oliveira"), "Lucas Oliveira");
  assert.equal(nomeCompleto("Ana", "Souza"), "Ana Souza");
  assert.equal(nomeCompleto("Ana", null), "Ana");
  assert.equal(nomeCompleto(null, "Souza"), "Souza");
}); });

import { nomeEmpresaExibivel } from "./texto";
describe("nomeEmpresaExibivel", () => {
  it("tira a base do CNPJ do MEI e preserva o resto", () => {
    assert.equal(nomeEmpresaExibivel("63.638.421 Anne Camille Beatriz de Almeida"), "Anne Camille Beatriz de Almeida");
    assert.equal(nomeEmpresaExibivel("Suitable"), "Suitable");
    assert.equal(nomeEmpresaExibivel("63.638.421"), "63.638.421");
    assert.equal(nomeEmpresaExibivel(null), "");
  });
});
