import assert from "node:assert/strict";
import { test } from "node:test";
import { dataSP, inicioDiaSP, moverMesSP, diaSeguinteSP, dataISOValida } from "./calendario-sp";
import { parsePeriodo } from "./periodo";
import { monthRange } from "../metas-shared";

test("virada de mês UTC ainda é setembro em São Paulo", () => {
  const instante = new Date("2026-10-01T02:10:00.000Z");
  assert.equal(dataSP(instante), "2026-09-30");
  const janela = parsePeriodo("mes_atual", instante);
  assert.equal(janela.since.toISOString(), "2026-09-01T03:00:00.000Z");
  assert.equal(janela.until.toISOString(), instante.toISOString());
});
test("mês passado é meia-noite SP e meia-noite SP do seguinte", () => {
  const janela = parsePeriodo("mes_passado", new Date("2026-10-21T12:00:00.000Z"));
  assert.equal(janela.since.toISOString(), "2026-09-01T03:00:00.000Z");
  assert.equal(janela.until.toISOString(), "2026-10-01T03:00:00.000Z");
});
test("dia 31 custom termina no dia 1 seguinte, exclusive", () => {
  const janela = parsePeriodo("custom:2026-10-01:2026-10-31");
  assert.equal(janela.since.toISOString(), "2026-10-01T03:00:00.000Z");
  assert.equal(janela.until.toISOString(), "2026-11-01T03:00:00.000Z");
});
test("calendário impede dias inexistentes e preserva virada de ano", () => {
  assert.equal(dataISOValida("2026-02-29"), false);
  assert.equal(dataISOValida("2024-02-29"), true);
  assert.equal(diaSeguinteSP("2026-12-31"), "2027-01-01");
  assert.equal(moverMesSP("2026-01-01", -1), "2025-12-01");
});
test("meta e faturamento compartilham fronteira de competência", () => {
  const instante = new Date("2026-10-01T02:00:00.000Z");
  const janela = monthRange(instante);
  assert.equal(janela.primeiroDia, "2026-09-01");
  assert.equal(janela.inicio.toISOString(), inicioDiaSP("2026-09-01").toISOString());
  assert.equal(janela.fim.toISOString(), inicioDiaSP("2026-10-01").toISOString());
});
