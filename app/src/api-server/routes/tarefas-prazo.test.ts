/**
 * O prazo da tarefa tem de chegar ao banco como Date.
 *
 * `vence_em` é `timestamp` e o Drizzle chama `.toISOString()` no valor. Com a
 * string crua do JSON, remarcar a data de qualquer atividade estourava
 * `value.toISOString is not a function` e a tela mostrava só "Internal server
 * error" (relatado pela Jenifer em 27/10/2026).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { prazoParaOBanco, diaDoPrazo } from "./tarefas";

test("prazo vira Date — é isso que o Drizzle exige da coluna timestamp", () => {
  const d = prazoParaOBanco("2026-11-03T14:00:00.000Z");
  assert.ok(d instanceof Date, "precisa ser Date, não string");
  assert.equal(d!.toISOString(), "2026-11-03T14:00:00.000Z");
});

test("null limpa o prazo; undefined não mexe; data ilegível é recusada", () => {
  assert.equal(prazoParaOBanco(null), null);
  assert.equal(prazoParaOBanco(undefined), undefined);
  // undefined aqui é o sinal de "recuse com 400", nunca de "não mexe no campo"
  assert.equal(prazoParaOBanco("quando der"), undefined);
  assert.equal(prazoParaOBanco(""), undefined);
});

test("o dia do prazo acompanha a data, senão a tarefa some do dashboard do dia", () => {
  assert.equal(diaDoPrazo(new Date("2026-11-03T14:00:00.000Z")), "2026-11-03");
  assert.equal(diaDoPrazo(null), null);
});
