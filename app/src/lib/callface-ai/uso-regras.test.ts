import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarFlags, resumoLicencas } from "./uso-regras";

const base = { diasSemAtividade: 1, minutos30d: 100, minutos30dAnteriores: 100, percentualMinutos: 10, licencasEmUso: 1, licencasContratadas: 5, chamadasNaSerie: 50, temAtividade: true };
const codigos = (o: Partial<typeof base>) => avaliarFlags({ ...base, ...o }).map((f) => f.codigo);

test("cliente saudável não tem flag", () => assert.deepEqual(codigos({}), []));
test("inativo só acima de 14 dias", () => {
  assert.deepEqual(codigos({ diasSemAtividade: 14 }), []);
  assert.deepEqual(codigos({ diasSemAtividade: 15 }), ["inativo_14d"]);
});
test("queda >40% exige base mínima e comparação com 30d anteriores", () => {
  assert.deepEqual(codigos({ minutos30d: 50, minutos30dAnteriores: 100 }), ["queda_40"]);
  assert.deepEqual(codigos({ minutos30d: 70, minutos30dAnteriores: 100 }), []);
  assert.deepEqual(codigos({ minutos30d: 0, minutos30dAnteriores: 10 }), []);
});
test("perto do limite: minutos ou licenças >= 85%", () => {
  assert.deepEqual(codigos({ percentualMinutos: 85 }), ["perto_do_limite"]);
  assert.deepEqual(codigos({ licencasEmUso: 5, licencasContratadas: 5 }), ["perto_do_limite"]);
});
test("nunca usou: sem atividade e série vazia", () => {
  assert.deepEqual(codigos({ temAtividade: false, chamadasNaSerie: 0, diasSemAtividade: null }), ["sem_uso_desde_a_contratacao"]);
});
test("licenças: trial fora das contratadas; em uso limitado ao contratado", () => {
  const r = resumoLicencas([
    { motivo: "SUBSCRIPTION_PAID", licencas: 3, atribuidas: 3, minutos: 300, semLimite: false },
    { motivo: "TRIAL", licencas: 10, atribuidas: 0, minutos: 30, semLimite: false },
  ], 8);
  assert.equal(r.contratadas, 3); assert.equal(r.emUso, 3); assert.equal(r.trial, 10);
  assert.equal(r.minutosContratados, 300); assert.equal(r.percentualEmUso, 100);
});
