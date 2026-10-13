import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { catalogoDoDesenho, catalogoDoSeletor } from "./catalogo-do-desenho";
import type { ItemCatalogo } from "@/lib/vendas/propostas";

/** Um item do catálogo como o banco entrega. */
function item(p: Partial<ItemCatalogo>): ItemCatalogo {
  return {
    catalogoPrecoId: "preco-1", servicoCatalogoId: "serv-1",
    nome: "Callface AI - Full", variacao: null, sku: null,
    valor: "179.90", naturezaReceita: "MRR", familia: "CALLFACE_AI",
    exigeContrato: false, ...p,
  };
}

describe("catalogoDoDesenho", () => {
  it("junta os preços do MESMO serviço num produto só", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [
      item({ catalogoPrecoId: "p1", variacao: "Callface AI - Full — Mensal" }),
      item({ catalogoPrecoId: "p2", variacao: "Callface AI - Full — Anual", valor: "1799.90" }),
    ]});
    assert.equal(c.CALLFACE_AI.length, 1);
    assert.equal(c.CALLFACE_AI[0].precos.length, 2);
  });

  it("leva o catalogoPrecoId como id do preço — é ele que acaoCriar exige", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [item({ catalogoPrecoId: "preco-real-42" })] });
    assert.equal(c.CALLFACE_AI[0].precos[0].id, "preco-real-42");
  });

  it("distingue mensal de anual pela variação, que é onde essa diferença mora", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [
      item({ catalogoPrecoId: "p1", variacao: "Mensal" }),
      item({ catalogoPrecoId: "p2", variacao: "Callface AI - Full — Anual" }),
    ]});
    const ints = c.CALLFACE_AI[0].precos.map((p) => p.int);
    assert.deepEqual(ints, ["mes", "ano"]);
  });

  it("o que não é recorrente é avulso", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [
      item({ naturezaReceita: "ONE_TIME", variacao: "Avulso" }),
    ]});
    assert.equal(c.CALLFACE_AI[0].precos[0].int, "avulso");
  });

  it("setup e hardware viram o tipo que a tela agrupa", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [
      item({ servicoCatalogoId: "s1", nome: "Setup", naturezaReceita: "SETUP" }),
      item({ servicoCatalogoId: "s2", nome: "Telefone IP", naturezaReceita: "HARDWARE" }),
    ]});
    assert.deepEqual(c.CALLFACE_AI.map((p) => p.tipo), ["setup", "hardware"]);
  });

  it("um serviço com preço recorrente é plano, mesmo vendo o avulso primeiro", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [
      item({ catalogoPrecoId: "p1", naturezaReceita: "ONE_TIME", variacao: "Avulso" }),
      item({ catalogoPrecoId: "p2", naturezaReceita: "MRR", variacao: "Mensal" }),
    ]});
    assert.equal(c.CALLFACE_AI[0].tipo, "plano");
  });

  it("marca o mensal como padrão — é o que se vende", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [
      item({ catalogoPrecoId: "p1", naturezaReceita: "ONE_TIME", variacao: "Avulso" }),
      item({ catalogoPrecoId: "p2", naturezaReceita: "MRR", variacao: "Mensal" }),
    ]});
    const padrao = c.CALLFACE_AI[0].precos.filter((p) => p.padrao === 1);
    assert.equal(padrao.length, 1);
    assert.equal(padrao[0].id, "p2");
  });

  it("sem recorrente, algum preço ainda é o padrão — cartão sem valor não fecha", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [
      item({ naturezaReceita: "ONE_TIME", variacao: "Avulso" }),
    ]});
    assert.equal(c.CALLFACE_AI[0].precos[0].padrao, 1);
  });

  it("tira do rótulo o nome do serviço que o cartão já mostra", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [
      item({ variacao: "Callface AI - Full — Mensal" }),
    ]});
    assert.equal(c.CALLFACE_AI[0].precos[0].d, "Mensal");
  });

  it("variação vazia vira Padrão, nunca string vazia", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [item({ variacao: null })] });
    assert.equal(c.CALLFACE_AI[0].precos[0].d, "Padrão");
  });

  it("converte o valor de texto para número — o desenho soma", () => {
    const c = catalogoDoDesenho({ CALLFACE_AI: [item({ valor: "1799.90" })] });
    assert.equal(c.CALLFACE_AI[0].precos[0].v, 1799.9);
  });
});

describe("variações com nome amigável", () => {
  it("a descrição do produto vai no cartão; o sku/lookup_key nunca", () => {
    const c = catalogoDoDesenho({ PABX: [item({ sku: "pabx_canais_32_canais", descricao: "Canais simultâneos" })] });
    assert.equal(c.PABX[0].desc, "Canais simultâneos");
    assert.equal(catalogoDoDesenho({ PABX: [item({ sku: "pabx_x" })] }).PABX[0].desc, "");
  });

  it("variação que é o lookup_key cru vira o período", () => {
    const c = catalogoDoDesenho({ PABX: [item({ variacao: "pabx canais 08 canais", lookupKey: "pabx_canais_08_canais", periodo: "mensal" })] });
    assert.equal(c.PABX[0].precos[0].d, "Mensal");
  });

  it("deixa a recorrência explícita e usa o período do Price", () => {
    const c = catalogoDoDesenho({ PABX: [
      item({ nome: "PABX - Canais", variacao: "PABX - Canais — 32 Canais", periodo: "anual" }),
      item({ catalogoPrecoId: "p2", nome: "PABX - Canais", variacao: "PABX - Canais — 16 Canais", periodo: "mensal" }),
    ] });
    assert.deepEqual(c.PABX[0].precos.map((x) => [x.d, x.int]), [["32 Canais · anual", "ano"], ["16 Canais · mensal", "mes"]]);
  });

  it("Prices indistinguíveis viram uma escolha só", () => {
    const c = catalogoDoDesenho({ PABX: [
      item({ catalogoPrecoId: "a", naturezaReceita: "ONE_TIME", variacao: "Avulso" }),
      item({ catalogoPrecoId: "b", naturezaReceita: "ONE_TIME", variacao: "Avulso" }),
    ] });
    assert.equal(c.PABX[0].precos.length, 1);
  });
});

describe("seletor do catálogo em sanfona", () => {
  const cat = catalogoDoDesenho({ PABX: [
    item({ servicoCatalogoId: "canais", catalogoPrecoId: "c4", nome: "PABX - Canais", variacao: "PABX - Canais — 04 Canais", periodo: "mensal", descricao: "Chamadas simultâneas" }),
    item({ servicoCatalogoId: "canais", catalogoPrecoId: "c8", nome: "PABX - Canais", variacao: "PABX - Canais — 08 Canais", periodo: "mensal" }),
    item({ servicoCatalogoId: "hw", catalogoPrecoId: "hw1", nome: "PABX - Hardware", variacao: "PABX - Hardware — Telefone Fanvil X3", naturezaReceita: "HARDWARE", periodo: "mensal" }),
    item({ servicoCatalogoId: "lin", catalogoPrecoId: "l1", nome: "PABX - Linhas", variacao: "PABX - Linha 4004 — Linha 4004 | Até 800min", periodo: "mensal" }),
  ] }).PABX;

  it("a variação aparece com nome amigável, sem repetir o produto", () => {
    const linhas = cat.find((p) => p.id === "lin")!;
    assert.equal(linhas.precos[0].variacao, "Linha 4004 · Até 800min");
    assert.equal(cat.find((p) => p.id === "canais")!.precos[0].variacao, "04 Canais");
  });

  it("locação de hardware é mensal: o período do Price manda, não a natureza", () => {
    assert.equal(cat.find((p) => p.id === "hw")!.precos[0].int, "mes");
  });

  it("sem busca: tudo fechado, agrupado pelo tipo; só o produto aberto abre", () => {
    const g = catalogoDoSeletor(cat, "", "canais");
    assert.deepEqual(g.map((x) => x.titulo), ["Planos e serviços recorrentes", "Equipamentos"]);
    const todos = g.flatMap((x) => x.produtos);
    assert.deepEqual(todos.filter((x) => x.aberto).map((x) => x.produto.id), ["canais"]);
    assert.equal(todos.find((x) => x.produto.id === "canais")!.precos.length, 2);
  });

  it("busca pela variação abre o produto só com as variações que casam", () => {
    const g = catalogoDoSeletor(cat, "08 canais", null);
    const todos = g.flatMap((x) => x.produtos);
    assert.deepEqual(todos.map((x) => [x.produto.id, x.aberto, x.precos.map((p) => p.id)]), [["canais", true, ["c8"]]]);
  });

  it("busca pelo produto ou descrição traz todas as variações, sem diferenciar acento e caixa", () => {
    const todos = catalogoDoSeletor(cat, "CHAMADAS simultaneas", null).flatMap((x) => x.produtos);
    assert.equal(todos.length, 1);
    assert.equal(todos[0].precos.length, 2);
    assert.equal(catalogoDoSeletor(cat, "ate 800", null).flatMap((x) => x.produtos)[0].produto.id, "lin");
  });

  it("busca sem resultado devolve lista vazia (o seletor mostra o estado vazio)", () => {
    assert.deepEqual(catalogoDoSeletor(cat, "geladeira", null), []);
  });
});
