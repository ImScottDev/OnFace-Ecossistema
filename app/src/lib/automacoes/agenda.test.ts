/**
 * Relógio dos Fluxos (agenda.ts). 01/10/2026 é quinta-feira; São Paulo é
 * UTC-3 sem horário de verão, então 09:00 local = 12:00Z.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dentroDoExpediente, formatarNoFuso, proximaExecucao, proximoHorarioDoNo } from "./agenda";

const SP = "America/Sao_Paulo";
const qui10h = new Date("2026-10-01T13:00:00Z"); // quinta 10:00 em SP

test("todo dia: hoje já passou das 09:00, então amanhã às 09:00", () => {
  assert.equal(proximaExecucao({ frequencia: "diaria", horarios: ["09:00"] }, SP, qui10h)?.toISOString(), "2026-10-02T12:00:00.000Z");
  // Com um horário ainda por vir hoje, é hoje.
  assert.equal(proximaExecucao({ frequencia: "diaria", horarios: ["09:00", "14:30"] }, SP, qui10h)?.toISOString(), "2026-10-01T17:30:00.000Z");
});

test("dias da semana: de quinta, só segunda serve → segunda 05/10", () => {
  assert.equal(proximaExecucao({ frequencia: "semanal", horarios: ["08:00"], diasSemana: [1] }, SP, qui10h)?.toISOString(), "2026-10-05T11:00:00.000Z");
  assert.equal(proximaExecucao({ frequencia: "semanal", horarios: ["08:00"], diasSemana: [] }, SP, qui10h), null, "sem dia = agenda incompleta");
});

test("todo mês no dia 1: já passou hoje, então 01/11", () => {
  assert.equal(proximaExecucao({ frequencia: "mensal", horarios: ["09:00"], diaMes: 1 }, SP, qui10h)?.toISOString(), "2026-11-01T12:00:00.000Z");
});

test("intervalo respeita o piso de 15 minutos", () => {
  assert.equal(proximaExecucao({ frequencia: "intervalo", intervaloMinutos: 1 }, SP, qui10h)?.toISOString(), "2026-10-01T13:15:00.000Z");
});

test("aguardar até horário e horário comercial no fuso da automação", () => {
  assert.equal(proximoHorarioDoNo("09:00", [1, 2, 3, 4, 5], SP, qui10h)?.toISOString(), "2026-10-02T12:00:00.000Z");
  const exp = { dias: [1, 2, 3, 4, 5], inicio: "09:00", fim: "18:00" };
  assert.equal(dentroDoExpediente(qui10h, SP, exp), true);
  assert.equal(dentroDoExpediente(new Date("2026-10-01T21:00:00Z"), SP, exp), false, "18:00 é fim exclusivo");
  assert.equal(dentroDoExpediente(new Date("2026-10-03T13:00:00Z"), SP, exp), false, "sábado");
  assert.equal(formatarNoFuso(qui10h, SP), "01/10 10:00");
});
