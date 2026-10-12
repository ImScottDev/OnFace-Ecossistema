import assert from "node:assert/strict";
import test from "node:test";
import { passoDaCadencia } from "./consultas";

test("passoAtual: ativa mostra a próxima ação (executadas + 1), limitada ao total", () => {
  assert.deepEqual(passoDaCadencia("active", 0, 7), { passoAtual: 1, passosExecutados: 0 });
  assert.deepEqual(passoDaCadencia("waiting", 2, 7), { passoAtual: 3, passosExecutados: 2 });
  assert.deepEqual(passoDaCadencia("active", 9, 7), { passoAtual: 7, passosExecutados: 7 });
});

test("passoAtual: pausada mantém o ponto; encerrada mostra só o que foi executado", () => {
  assert.deepEqual(passoDaCadencia("paused", 3, 7), { passoAtual: 4, passosExecutados: 3 });
  assert.deepEqual(passoDaCadencia("cancelled", 2, 7), { passoAtual: 2, passosExecutados: 2 });
  assert.deepEqual(passoDaCadencia("failed", 0, 7), { passoAtual: 0, passosExecutados: 0 });
});

test("passoAtual: concluída é total de total; sem matrícula é nulo (nunca 0 inventado)", () => {
  assert.deepEqual(passoDaCadencia("completed", 5, 7), { passoAtual: 7, passosExecutados: 7 });
  assert.deepEqual(passoDaCadencia(null, null, null), { passoAtual: null, passosExecutados: null });
});
