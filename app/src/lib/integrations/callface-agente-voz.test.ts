import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hojePorExtenso, telefoneParaPlanilha } from "./callface-agente-voz";

/* A planilha da campanha espera DDD + número, sem país: a Callface prefixa o 55
   sozinha. Mandar o 55 de novo já fez ligação sair para o número errado. */

test("tira o 55 e aceita celular e fixo", () => {
  assert.equal(telefoneParaPlanilha("5511969044205"), "11969044205");
  assert.equal(telefoneParaPlanilha("+55 (11) 96904-4205"), "11969044205");
  assert.equal(telefoneParaPlanilha("11969044205"), "11969044205");
  assert.equal(telefoneParaPlanilha("1149169615"), "1149169615");
});

test("recusa o que não dá para discar", () => {
  for (const v of [null, undefined, "", "969044205", "0000", "551196904420512345"]) {
    assert.equal(telefoneParaPlanilha(v), null, String(v));
  }
});

/* O agente não sabe a data; sem ela "quarta" caiu na semana seguinte numa
   ligação real. Vai como variável, em horário de Brasília. */
test("a data de hoje vai por extenso, no fuso de São Paulo", () => {
  // 05/11/2026 00:30 UTC ainda é 04/11 em São Paulo.
  assert.equal(hojePorExtenso(new Date("2026-11-05T00:30:00Z")), "quarta-feira, 04/11/2026");
  assert.equal(hojePorExtenso(new Date("2026-11-05T12:00:00Z")), "quinta-feira, 05/11/2026");
});
