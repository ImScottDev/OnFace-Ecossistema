import { test } from "node:test";
import assert from "node:assert/strict";
import { corpoDaMudanca, corpoDaNova, prazoDoBanco, prazoParaOBanco, tipoDoBanco } from "./atividade-tarefa";

const ids = (n: string) => ({ "Ana": "u-ana" } as Record<string, string>)[n];

test("mudança vira só o que o domínio tem", () => {
  const antes = { titulo: "A", situacao: "A fazer", prioridade: "Média", resp: "Bia", fimD: "2026-10-01", fimH: null, sub: [] };
  const { corpo, naoGravado } = corpoDaMudanca(antes, { ...antes, situacao: "Feita", prioridade: "Alta", resp: "Ana", anexos: [], sub: [{ t: "x" }] }, ids);
  assert.deepEqual(corpo, { status: "concluida", prioridade: "alta", responsavelId: "u-ana" });
  assert.deepEqual(naoGravado, ["subtarefas"]);
});

test("reagendar só com data não inventa hora", () => {
  assert.deepEqual(prazoParaOBanco("2026-10-02", ""), { dataVencimento: "2026-10-02", venceEm: null });
  const { corpo } = corpoDaMudanca({ fimD: "2026-10-01", fimH: "09:00" }, { fimD: "2026-10-03", fimH: "09:00" }, ids);
  assert.equal(corpo.dataVencimento, "2026-10-03");
  assert.equal(prazoDoBanco(corpo.venceEm, null).fimH, "09:00");
});

test("tipo sem par no domínio é avisado, não gravado", () => {
  const { corpo, naoGravado } = corpoDaMudanca({ tipo: "Tarefa" }, { tipo: "E-mail" }, ids);
  assert.deepEqual(corpo, {});
  assert.equal(naoGravado.length, 1);
  assert.equal(corpoDaNova({ titulo: " x ", tipo: "Ligação", prioridade: "Baixa", resp: "Zé" }, ids).tipo, "ligar");
});

test("data sem hora do banco fica sem hora", () => {
  assert.deepEqual(prazoDoBanco(null, "2026-10-05"), { fimD: "2026-10-05", fimH: "" });
});

test("tarefa de agendar/confirmar reunião é Tarefa, não Reunião (reunião de verdade mora em `reunioes`)", () => {
  assert.equal(tipoDoBanco("onboarding_agendar_reuniao"), "Tarefa");
  assert.equal(tipoDoBanco("confirmar_reuniao_outlook"), "Tarefa");
  assert.equal(tipoDoBanco("reuniao"), "Reunião");
});
