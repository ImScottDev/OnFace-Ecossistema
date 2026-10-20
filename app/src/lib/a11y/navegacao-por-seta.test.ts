import assert from "node:assert/strict";
import { test } from "node:test";

import { direcaoDaTecla, indiceAlvo } from "./navegacao-por-seta";

test("a seta da orientação anda e a da outra passa reto", () => {
  assert.equal(direcaoDaTecla("ArrowRight", "horizontal"), "proximo");
  assert.equal(direcaoDaTecla("ArrowLeft", "horizontal"), "anterior");
  assert.equal(direcaoDaTecla("ArrowDown", "horizontal"), null);
  assert.equal(direcaoDaTecla("ArrowDown", "vertical"), "proximo");
  assert.equal(direcaoDaTecla("ArrowRight", "vertical"), null);
  assert.equal(direcaoDaTecla("ArrowUp", "ambas"), "anterior");
  assert.equal(direcaoDaTecla("ArrowRight", "ambas"), "proximo");
});

test("Home e End valem em qualquer orientação; o resto passa reto", () => {
  assert.equal(direcaoDaTecla("Home", "vertical"), "primeiro");
  assert.equal(direcaoDaTecla("End", "horizontal"), "ultimo");
  for (const tecla of ["Enter", " ", "Tab", "PageDown", "a"]) {
    assert.equal(direcaoDaTecla(tecla), null, `"${tecla}" não é tecla de navegação`);
  }
});

test("a seta é circular nas duas pontas", () => {
  assert.equal(indiceAlvo("proximo", 2, 3), 0);
  assert.equal(indiceAlvo("anterior", 0, 3), 2);
  assert.equal(indiceAlvo("proximo", 0, 3), 1);
  assert.equal(indiceAlvo("anterior", 2, 3), 1);
});

test("Home e End vão às pontas", () => {
  assert.equal(indiceAlvo("primeiro", 2, 3), 0);
  assert.equal(indiceAlvo("ultimo", 0, 3), 2);
});

test("grupo sem nada marcado começa pela primeira opção", () => {
  assert.equal(indiceAlvo("proximo", -1, 3), 1);
  assert.equal(indiceAlvo("anterior", -1, 3), 2);
  assert.equal(indiceAlvo("primeiro", -1, 3), 0);
});

test("grupo de uma opção fica onde está e grupo vazio não navega", () => {
  assert.equal(indiceAlvo("proximo", 0, 1), 0);
  assert.equal(indiceAlvo("anterior", 0, 1), 0);
  assert.equal(indiceAlvo("proximo", 0, 0), -1);
  assert.equal(indiceAlvo("primeiro", -1, 0), -1);
});
