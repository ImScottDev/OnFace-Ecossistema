import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { catalogoDoDesenho } from "./catalogo-do-desenho";
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
