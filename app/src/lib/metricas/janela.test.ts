import { test } from "node:test";
import assert from "node:assert/strict";
import { janelaDoPeriodo, janelaAnterior, diaSP, calendarioSP } from "./janela";

const iso = (d: Date) => d.toISOString();

test("mês atual: do dia 1 às 00:00 de São Paulo até o começo de amanhã, parcial", () => {
  const agora = new Date("2026-10-12T15:00:00Z"); // 12:00 em SP
  const j = janelaDoPeriodo("mes_atual", agora);
  assert.equal(iso(j.de), "2026-10-01T03:00:00.000Z");
  assert.equal(iso(j.ate), "2026-10-13T03:00:00.000Z");
  assert.equal(j.parcial, true);
});

test("fronteira de fuso: 01/10 02:30 UTC ainda é 30/09 em São Paulo", () => {
  const agora = new Date("2026-10-01T02:30:00Z");
  assert.deepEqual(calendarioSP(agora), { ano: 2026, mes: 9, dia: 30 });
  assert.equal(iso(janelaDoPeriodo("mes_atual", agora).de), "2026-09-01T03:00:00.000Z");
});

test("mês passado é fechado e [início, fim) pega o dia 1 do mês seguinte só como limite", () => {
  const j = janelaDoPeriodo("mes_passado", new Date("2026-10-12T15:00:00Z"));
  assert.equal(iso(j.de), "2026-09-01T03:00:00.000Z");
  assert.equal(iso(j.ate), "2026-10-01T03:00:00.000Z");
  assert.equal(j.parcial, false);
});

test("virada de ano e janeiro: mês passado de janeiro é dezembro", () => {
  const j = janelaDoPeriodo("mes_passado", new Date("2027-01-10T15:00:00Z"));
  assert.equal(iso(j.de), "2026-12-01T03:00:00.000Z");
  assert.equal(iso(j.ate), "2027-01-01T03:00:00.000Z");
});

test("custom é inclusivo nas duas pontas do calendário e exclusivo no instante final", () => {
  const j = janelaDoPeriodo("custom:2026-02-01:2026-02-28", new Date("2026-10-12T15:00:00Z"));
  assert.equal(iso(j.de), "2026-02-01T03:00:00.000Z");
  assert.equal(iso(j.ate), "2026-03-01T03:00:00.000Z");
  assert.equal(j.parcial, false);
});

test("comparação de mês parcial é MTD contra MTD, não contra o mês anterior inteiro", () => {
  const agora = new Date("2026-10-12T15:00:00Z");
  const j = janelaDoPeriodo("mes_atual", agora);
  const a = janelaAnterior(j, "mes_atual", agora);
  assert.equal(iso(a.de), "2026-09-01T03:00:00.000Z");
  assert.equal(iso(a.ate), "2026-09-13T03:00:00.000Z");
});

test("comparação de mês parcial no dia 31 não passa do fim do mês anterior curto", () => {
  const agora = new Date("2026-10-31T15:00:00Z"); // setembro tem 30 dias
  const a = janelaAnterior(janelaDoPeriodo("mes_atual", agora), "mes_atual", agora);
  assert.equal(iso(a.ate), "2026-10-01T03:00:00.000Z");
});

test("N dias: janela do tamanho exato e anterior colada, sem sobreposição", () => {
  const agora = new Date("2026-10-12T15:00:00Z");
  const j = janelaDoPeriodo("30d", agora);
  assert.equal((j.ate.getTime() - j.de.getTime()) / 86_400_000, 30);
  const a = janelaAnterior(j, "30d", agora);
  assert.equal(a.ate.getTime(), j.de.getTime());
});

test("período inválido cai no mês atual e diaSP normaliza mês 13", () => {
  assert.equal(janelaDoPeriodo("lixo", new Date("2026-10-12T15:00:00Z")).rotulo, "Mês atual");
  assert.equal(iso(diaSP(2026, 13, 1)), "2027-01-01T03:00:00.000Z");
});
