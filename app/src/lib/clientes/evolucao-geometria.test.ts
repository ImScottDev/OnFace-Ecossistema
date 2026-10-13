import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { geometriaFaturamento, passoDoEixo } from "./evolucao-geometria";

const mes = (competencia: string, mrr: number, avulso = 0) =>
  // `avulso` segue sendo a soma de setup + pontual + uso; aqui o avulso entra todo como pontual.
  ({ competencia, mrr, avulso, setup: 0, pontual: avulso, uso: 0, debito: 0, semClasse: 0, total: mrr + avulso });

describe("geometria da evolução de faturamento", () => {
  it("empilha por natureza e o topo da pilha é o total faturado", () => {
    const g = geometriaFaturamento([mes("2026-08", 100, 50), mes("2026-09", 200, 0)], {}, 600, 140);
    assert.deepEqual(g.totais, [150, 200]);
    assert.deepEqual(g.camadas.map((c) => c.k), ["mrr", "avulso", "debito", "semClasse"]);
  });
  it("camada oculta sai da pilha e do total", () => {
    const g = geometriaFaturamento([mes("2026-09", 100, 50)], { avulso: true }, 600, 140);
    assert.deepEqual(g.totais, [100]);
    assert.equal(g.camadas.some((c) => c.k === "avulso"), false);
  });
  it("um mês só não divide por zero", () => {
    const g = geometriaFaturamento([mes("2026-09", 10)], {}, 1000, 220);
    assert.equal(g.X(0), 500);
    assert.ok(passoDoEixo(0) > 0);
  });
});
