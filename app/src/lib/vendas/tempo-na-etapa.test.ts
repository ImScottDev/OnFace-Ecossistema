import { test } from "node:test";
import assert from "node:assert/strict";
import { tempoNaEtapa, tempoNaEtapaPorExtenso, horasDesde } from "./tempo-na-etapa";

test("até 48 horas o quadro fala em minuto e hora; depois, em dia", () => {
  // O lead que acabou de cair mostrava `1d` no ONFACE e `0min` na produção anterior.
  assert.equal(tempoNaEtapa(0), "0min");
  assert.equal(tempoNaEtapa(1 / 60), "1min");
  assert.equal(tempoNaEtapa(45 / 60), "45min");
  assert.equal(tempoNaEtapa(0.999), "59min", "não arredonda para cima e pula a hora");

  assert.equal(tempoNaEtapa(1), "1h");
  assert.equal(tempoNaEtapa(20), "20h");
  assert.equal(tempoNaEtapa(47.9), "47h", "a última hora antes da virada ainda é hora");

  assert.equal(tempoNaEtapa(48), "2d", "48h é a virada para dia");
  assert.equal(tempoNaEtapa(71), "2d");
  assert.equal(tempoNaEtapa(72), "3d");
});

test("sem data não inventa tempo", () => {
  assert.equal(tempoNaEtapa(null), null);
  assert.equal(tempoNaEtapa(undefined), null);
  assert.equal(tempoNaEtapa(Number.NaN), null);
  assert.equal(tempoNaEtapaPorExtenso(null), "—");
  assert.equal(tempoNaEtapaPorExtenso(3), "3h na etapa");
});

test("tempo negativo (relógio torto, data futura) vira zero, nunca negativo", () => {
  assert.equal(tempoNaEtapa(-5), "0min");
  const agora = Date.parse("2026-10-14T12:00:00Z");
  assert.equal(horasDesde("2026-10-14T18:00:00Z", agora), 0);
});

test("horasDesde aceita Date e texto, e ignora data inválida", () => {
  const agora = Date.parse("2026-10-14T12:00:00Z");
  assert.equal(horasDesde(new Date("2026-10-14T09:00:00Z"), agora), 3);
  assert.equal(horasDesde("2026-10-12T12:00:00Z", agora), 48);
  assert.equal(horasDesde("nem data", agora), null);
  assert.equal(horasDesde(null, agora), null);
});
