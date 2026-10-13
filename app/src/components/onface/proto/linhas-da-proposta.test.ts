import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { itensParaCriar, nomeAposTrocarVariante, nomeDaLinha, precoDaNovaLinha } from "./linhas-da-proposta";
import type { PrecoDoDesenho, ProdutoDoDesenho } from "./catalogo-do-desenho";

const preco = (id: string, d: string, extra: Partial<PrecoDoDesenho> = {}): PrecoDoDesenho =>
  ({ id, v: 10, int: "mes", d, padrao: 0, min: null, max: null, ...extra });

const hardware: ProdutoDoDesenho = {
  id: "hw", nome: "PABX - Hardware", desc: "", tipo: "hardware", unidade: "un.", qtd: 1, inicial: false,
  precos: [preco("hw-basico", "Telefone IP básico", { padrao: 1 }), preco("hw-giga", "Telefone IP gigabit"), preco("hw-head", "Headset USB")],
};
const canais: ProdutoDoDesenho = {
  id: "cn", nome: "PABX - Canais", desc: "", tipo: "plano", unidade: "un.", qtd: 1, inicial: false,
  precos: [preco("cn-1", "Faixa 1", { padrao: 1, min: 1, max: 9 }), preco("cn-2", "Faixa 2", { min: 10, max: null })],
};
const unico: ProdutoDoDesenho = {
  id: "st", nome: "Instalação", desc: "", tipo: "setup", unidade: "un.", qtd: 1, inicial: false,
  precos: [preco("st-1", "Padrão", { padrao: 1 })],
};

describe("precoDaNovaLinha", () => {
  it("a primeira linha nasce no preço padrão", () => {
    assert.equal(precoDaNovaLinha(hardware, [], hardware.precos[0]).id, "hw-basico");
  });

  it("cada linha seguinte pega a próxima variante sem linha", () => {
    const linhas = [{ prod: "hw", preco: "hw-basico" }];
    assert.equal(precoDaNovaLinha(hardware, linhas, hardware.precos[0]).id, "hw-giga");
    linhas.push({ prod: "hw", preco: "hw-giga" });
    assert.equal(precoDaNovaLinha(hardware, linhas, hardware.precos[0]).id, "hw-head");
  });

  it("com todas as variantes em uso, volta ao padrão em vez de recusar", () => {
    const linhas = hardware.precos.map((p) => ({ prod: "hw", preco: p.id }));
    assert.equal(precoDaNovaLinha(hardware, linhas, hardware.precos[0]).id, "hw-basico");
  });

  it("linhas de OUTRO produto não contam", () => {
    assert.equal(precoDaNovaLinha(hardware, [{ prod: "st", preco: "hw-basico" }], hardware.precos[0]).id, "hw-basico");
  });

  it("produto com um preço só pode repetir o mesmo preço", () => {
    assert.equal(precoDaNovaLinha(unico, [{ prod: "st", preco: "st-1" }], unico.precos[0]).id, "st-1");
  });

  it("por faixa o preço é o padrão: quem manda é a quantidade", () => {
    assert.equal(precoDaNovaLinha(canais, [{ prod: "cn", preco: "cn-1" }], canais.precos[0]).id, "cn-1");
  });
});

describe("nomeDaLinha", () => {
  it("produto com variantes leva a variante no nome; o resto leva só o produto", () => {
    assert.equal(nomeDaLinha(hardware, hardware.precos[1]), "PABX - Hardware · Telefone IP gigabit");
    assert.equal(nomeDaLinha(unico, unico.precos[0]), "Instalação");
    assert.equal(nomeDaLinha(canais, canais.precos[0]), "PABX - Canais");
  });

  it("duas linhas do mesmo produto em variantes diferentes têm nomes diferentes", () => {
    assert.notEqual(nomeDaLinha(hardware, hardware.precos[0]), nomeDaLinha(hardware, hardware.precos[2]));
  });
});

describe("nomeAposTrocarVariante", () => {
  it("acompanha a troca quando o nome ainda é o automático", () => {
    assert.equal(
      nomeAposTrocarVariante(hardware, "PABX - Hardware · Telefone IP básico", hardware.precos[0], hardware.precos[2]),
      "PABX - Hardware · Headset USB",
    );
  });

  it("acompanha também uma linha antiga, que levava só o nome do produto", () => {
    assert.equal(nomeAposTrocarVariante(hardware, "PABX - Hardware", hardware.precos[0], hardware.precos[1]), "PABX - Hardware · Telefone IP gigabit");
  });

  it("não mexe no nome que o vendedor escreveu", () => {
    assert.equal(nomeAposTrocarVariante(hardware, "Aparelho da recepção", hardware.precos[0], hardware.precos[1]), "Aparelho da recepção");
  });
});

describe("itensParaCriar", () => {
  const linha = (extra: Record<string, unknown>) => ({ prod: "hw", preco: "hw-basico", nome: "PABX - Hardware", natureza: "HARDWARE", valor: 389, qtd: 1, descTipo: "pct", descVal: "", ...extra });

  it("o mesmo preço em três linhas sai como três linhas, cada uma com a sua quantidade, valor e desconto", () => {
    const { itens, semPreco } = itensParaCriar([
      linha({ qtd: 2 }),
      linha({ qtd: 5, valor: 380, descVal: "10" }),
      linha({ qtd: 3, descTipo: "valor", descVal: "50,5" }),
    ]);
    assert.deepEqual(semPreco, []);
    assert.deepEqual(itens.map((i) => i.catalogoPrecoId), ["hw-basico", "hw-basico", "hw-basico"]);
    assert.deepEqual(itens.map((i) => i.quantidade), [2, 5, 3]);
    assert.deepEqual(itens.map((i) => i.valorUnitario), [389, 380, 389]);
    assert.deepEqual(itens.map((i) => i.desconto), [0, 190, 50.5]);
  });

  it("desconto em R$ nunca passa do valor da linha", () => {
    const { itens } = itensParaCriar([linha({ qtd: 2, descTipo: "valor", descVal: "99999" }), linha({ descVal: "150" })]);
    assert.equal(itens[0].desconto, 778);
    assert.equal(itens[1].desconto, 389);
  });

  it("recorrente (mensal ou anual), setup e o resto mapeiam para os três tipos do command", () => {
    const { itens } = itensParaCriar([linha({ natureza: "MRR" }), linha({ natureza: "ARR" }), linha({ natureza: "SETUP" }), linha({ natureza: "HARDWARE" })]);
    assert.deepEqual(itens.map((i) => i.tipo), ["recorrente", "recorrente", "setup", "avulso"]);
  });

  it("linha sem preço do catálogo é devolvida, não gravada com id vazio; linha legada é mantida", () => {
    const { itens, semPreco } = itensParaCriar([linha({ preco: undefined, nome: "Digitado à mão" }), linha({ preco: "item:abc-1" })]);
    assert.deepEqual(semPreco, ["Digitado à mão"]);
    assert.equal(itens.length, 1);
    assert.equal(itens[0].itemExistenteId, "abc-1");
    assert.equal(itens[0].catalogoPrecoId, "");
  });
});

describe("itensParaCriar: descrição da linha", () => {
  it("leva a descrição editada; vazia vai null para o servidor usar a do catálogo", () => {
    const { itens } = itensParaCriar([
      { preco: "p1", nome: "PABX - Canais · 04 Canais", desc: "  Texto do vendedor ", natureza: "MRR", valor: "103", qtd: "1" },
      { preco: "p2", nome: "PABX - Ramal", desc: "", natureza: "MRR", valor: "5", qtd: "1" },
    ]);
    assert.deepEqual(itens.map((i) => i.descricao), ["Texto do vendedor", null]);
  });
});
