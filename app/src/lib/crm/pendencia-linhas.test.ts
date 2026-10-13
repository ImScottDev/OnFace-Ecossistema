import { test } from "node:test";
import assert from "node:assert/strict";
import { linhasDoRecebivel, naturezaDoItem } from "./pendencia-linhas";

const venc = new Date("2026-10-20T12:00:00Z");
const mrr = { tipo: "recorrente", revenueNature: "MRR", subtotal: "304.90" };
const setup = { tipo: "setup", revenueNature: "SETUP", subtotal: "1.00" };

test("recebível separa mensalidade de implantação (caso P-1570: 304,90 + 1,00)", () => {
  const l = linhasDoRecebivel([mrr, setup], { vencimento: venc });
  assert.deepEqual(l.map((x) => [x.sufixo, x.natureza, x.valor]), [["MRR", "MRR", 304.9], ["SETUP", "SETUP", 1]]);
  assert.equal(l.reduce((a, x) => a + x.valor, 0), 305.9);
});

test("venda só com mensalidade ou só com implantação gera uma linha", () => {
  assert.equal(linhasDoRecebivel([mrr], { vencimento: venc }).length, 1);
  assert.equal(linhasDoRecebivel([setup], { vencimento: venc })[0].natureza, "SETUP");
});

test("implantação parcelada: N linhas, soma exata, vencimentos a cada 30 dias; mensalidade não parcela", () => {
  const l = linhasDoRecebivel([mrr, { tipo: "setup", revenueNature: "SETUP", subtotal: "100.00" }], { vencimento: venc, parcelas: 3 });
  const s = l.filter((x) => x.natureza === "SETUP");
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => x.valor), [33.34, 33.33, 33.33]);
  assert.equal(s[1].vencimento!.getTime() - s[0].vencimento!.getTime(), 30 * 24 * 3600 * 1000);
  assert.equal(l.filter((x) => x.natureza === "MRR").length, 1);
});

test("sem vencimento a linha nasce sem data, nunca com data inventada", () => {
  const l = linhasDoRecebivel([mrr, setup], { vencimento: null, parcelas: 2 });
  assert.ok(l.every((x) => x.vencimento === null));
});

test("avulso e item sem natureza: recorrente é MRR, o resto é implantação", () => {
  assert.equal(naturezaDoItem({ tipo: "avulso", revenueNature: null }), "SETUP");
  assert.equal(naturezaDoItem({ tipo: "recorrente", revenueNature: "UNKNOWN" }), "MRR");
});
