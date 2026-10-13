import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { familiaDoItem, gravarFamiliaDoGanho, type DepsGravarFamilia } from "./gravar-familia";
import { familiaDaOportunidade } from "./classificar-produto";

function fake(resolvida: "PABX" | "UNKNOWN" | "CALLFACE_AI") {
  const gravados: { familia: string; organizacaoId: string }[] = [];
  const deps: DepsGravarFamilia = {
    resolver: async () => resolvida,
    gravar: async ({ familia, organizacaoId }) => { gravados.push({ familia, organizacaoId }); },
  };
  return { deps, gravados };
}

describe("família gravada no Ganho", () => {
  it("oportunidade de PABX ganha grava família PABX", async () => {
    const { deps, gravados } = fake("PABX");
    assert.equal(await gravarFamiliaDoGanho({ negocioId: "n1", organizacaoId: "o1" }, deps), "PABX");
    assert.deepEqual(gravados, [{ familia: "PABX", organizacaoId: "o1" }]);
    // e o resolvedor real daria PABX para uma oportunidade com item de PABX no catálogo
    assert.equal(familiaDaOportunidade({ itens: [{ familiaDoCatalogo: "PABX", valor: 10 }] }).familia, "PABX");
  });
  it("família desconhecida grava UNKNOWN em vez de nulo", async () => {
    const { deps, gravados } = fake("UNKNOWN");
    assert.equal(await gravarFamiliaDoGanho({ negocioId: "n1", organizacaoId: "o1" }, deps), "UNKNOWN");
    assert.equal(gravados[0].familia, "UNKNOWN");
  });
  it("a família que o gatilho do Ganho já resolveu vale sobre a leitura", async () => {
    const { deps, gravados } = fake("CALLFACE_AI");
    await gravarFamiliaDoGanho({ negocioId: "n1", organizacaoId: "o1", familiaHint: "PABX" }, deps);
    assert.equal(gravados[0].familia, "PABX");
  });
  it("falha na gravação não derruba o Ganho (devolve null, com log)", async () => {
    const deps: DepsGravarFamilia = { resolver: async () => "PABX", gravar: async () => { throw new Error("banco fora"); } };
    const antes = console.error; console.error = () => {};
    try { assert.equal(await gravarFamiliaDoGanho({ negocioId: "n1", organizacaoId: "o1" }, deps), null); }
    finally { console.error = antes; }
  });
});

describe("família do item da oportunidade", () => {
  it("item criado do catálogo herda a família do preço", () => {
    assert.equal(familiaDoItem({ familiaDoItem: null, familiaDoPreco: "PABX", familiaDoServico: null }), "PABX");
    // "UNKNOWN" no item não esconde a família do catálogo
    assert.equal(familiaDoItem({ familiaDoItem: "UNKNOWN", familiaDoPreco: "WHITE_LABEL" }), "WHITE_LABEL");
    assert.equal(familiaDoItem({ familiaDoItem: "UNKNOWN", familiaDoPreco: "UNKNOWN", familiaDoServico: "PABX" }), "PABX");
    assert.equal(familiaDoItem({}), "UNKNOWN");
  });
});
