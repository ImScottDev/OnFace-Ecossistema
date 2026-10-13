import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { periodoDoItem, totaisPorPeriodo, totalNoPrazo } from "./periodo-cobranca";

describe("periodoDoItem", () => {
  it("o período do Price manda, inclusive sobre o tipo", () => {
    assert.deepEqual(periodoDoItem({ periodo: "anual", tipo: "recorrente" }), { periodo: "anual", doPreco: true });
    // locação de hardware: natureza HARDWARE, cobrada todo mês
    assert.deepEqual(periodoDoItem({ periodo: "mensal", tipo: "avulso", natureza: "HARDWARE" }), { periodo: "mensal", doPreco: true });
    assert.deepEqual(periodoDoItem({ periodo: "unico", tipo: "recorrente" }), { periodo: "unico", doPreco: true });
  });
  it("sem Price, a linha legada cai no tipo e avisa que deduziu", () => {
    assert.deepEqual(periodoDoItem({ tipo: "recorrente" }), { periodo: "mensal", doPreco: false });
    assert.deepEqual(periodoDoItem({ tipo: "setup" }), { periodo: "unico", doPreco: false });
    assert.deepEqual(periodoDoItem({ periodo: "trimestral", tipo: "avulso" }), { periodo: "unico", doPreco: false });
  });
});

describe("totaisPorPeriodo", () => {
  it("separa mensal, anual e único (Callface AI + PABX + White Label)", () => {
    const t = totaisPorPeriodo([
      { subtotal: "1799.90", periodo: "anual", tipo: "recorrente" },
      { subtotal: 179.9, periodo: "mensal", tipo: "recorrente" },
      { subtotal: "29.9", periodo: "mensal", tipo: "recorrente" },
      { subtotal: 500, periodo: "unico", tipo: "setup" },
    ]);
    assert.deepEqual(t, { mensal: 209.8, anual: 1799.9, unico: 500, deduzidos: 0 });
  });
  it("anuidade nunca entra na mensalidade", () => {
    assert.equal(totaisPorPeriodo([{ subtotal: 1200, periodo: "anual", tipo: "recorrente" }]).mensal, 0);
  });
  it("soma em centavos", () => {
    assert.equal(totaisPorPeriodo([{ subtotal: 0.1, periodo: "mensal", tipo: "recorrente" }, { subtotal: 0.2, periodo: "mensal", tipo: "recorrente" }]).mensal, 0.3);
  });
  it("conta as linhas deduzidas", () => {
    assert.equal(totaisPorPeriodo([{ subtotal: 10, tipo: "recorrente" }, { subtotal: 5, periodo: "unico", tipo: "setup" }]).deduzidos, 1);
  });
});

describe("totalNoPrazo", () => {
  const t = { mensal: 100, anual: 1200, unico: 500, deduzidos: 0 };
  it("12 meses: 12 mensalidades, 1 anuidade, os únicos", () => assert.equal(totalNoPrazo(t, 12), 2900));
  it("24 meses: 2 anuidades", () => assert.equal(totalNoPrazo(t, 24), 5300));
  it("sem prazo não inventa total", () => { assert.equal(totalNoPrazo(t, null), null); assert.equal(totalNoPrazo(t, 0), null); });
});
