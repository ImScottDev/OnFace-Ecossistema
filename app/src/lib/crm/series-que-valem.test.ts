import { test } from "node:test";
import assert from "node:assert/strict";
import { seriesQueValem, totaisDoNegocio } from "./series-que-valem";

const serie = (id: string, status: string, recorrente: number, avulso = 0): Parameters<typeof seriesQueValem>[0][number] =>
  ({ id, status, recorrente, avulso, geral: recorrente + avulso });

test("venda fechada vale só o que o cliente aceitou", () => {
  // BC Genera: a aceita #1568 e a expirada #1474, que o relatório somava.
  const totais = totaisDoNegocio([serie("1474", "expirada", 959.4), serie("1568", "aceita", 1139.2)]);
  assert.equal(totais.totalGeral, 1139.2);
  assert.equal(totais.totalRecorrente, 1139.2);
});

test("sem aceite, toda série vigente conta para o forecast", () => {
  const totais = totaisDoNegocio([serie("1474", "expirada", 959.4), serie("1568", "enviada", 1139.2)]);
  assert.equal(totais.totalGeral, 2098.6);
});

test("duas séries aceitas somam: é venda em duas propostas", () => {
  const totais = totaisDoNegocio([serie("1", "aceita", 100), serie("2", "aceita", 50)]);
  assert.equal(totais.totalGeral, 150);
});

test("setup entra no avulso e no geral, não no recorrente", () => {
  const totais = totaisDoNegocio([serie("1", "aceita", 359.8, 1200)]);
  assert.deepEqual(totais, { totalRecorrente: 359.8, totalAvulso: 1200, totalGeral: 1559.8 });
});

test("negócio sem proposta não quebra", () => {
  assert.deepEqual(totaisDoNegocio([]), { totalRecorrente: 0, totalAvulso: 0, totalGeral: 0 });
  assert.deepEqual(seriesQueValem([]), []);
});
