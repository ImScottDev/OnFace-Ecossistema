import { test } from "node:test";
import assert from "node:assert/strict";
import { projecaoDoMes, sinaisComplementares, variacao } from "./sinais-de-uso";

const agora = new Date(2026, 9, 13, 10); // 13/10, mês de 31 dias
const base = { agora, flags: [] as string[], minutosMes: 0, minutos30d: 0, minutosContratados: null, licencasContratadas: 0, licencasEmUso: 0 };
const chaves = (x: Parameters<typeof sinaisComplementares>[0]) => sinaisComplementares(x).map((s) => s.chave);

test("projeção linear e variação sem base", () => {
  assert.equal(projecaoDoMes(130, agora), 310);
  assert.equal(variacao(10, 0), null);
  assert.equal(variacao(50, 100), -50);
});

test("ritmo acima do plano vira expansão, mas não repete o flag de limite", () => {
  const e = { ...base, minutosMes: 1000, minutos30d: 2000, minutosContratados: 2000 };
  assert.deepEqual(chaves(e), ["ritmo"]);
  assert.deepEqual(chaves({ ...e, flags: ["no_teto"] }), []);
});

test("adoção baixa só para conta que está usando", () => {
  const e = { ...base, minutos30d: 300, licencasContratadas: 10, licencasEmUso: 2 };
  assert.deepEqual(chaves(e), ["adocao"]);
  assert.deepEqual(chaves({ ...e, flags: ["silencio"] }), []);
});

test("licença ociosa já dita pelo semáforo não repete como adoção", () => {
  const e = { ...base, minutos30d: 300, licencasContratadas: 10, licencasEmUso: 2 };
  assert.deepEqual(chaves({ ...e, flags: ["licenca_ociosa"] }), []);
});

test("sem flag e com uso: constante; sem uso: nada", () => {
  assert.deepEqual(chaves({ ...base, minutos30d: 50 }), ["constante"]);
  assert.deepEqual(chaves(base), []);
});
