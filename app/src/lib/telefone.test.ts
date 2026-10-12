import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarE164, chaveTelefone, mascararTelefone, formatarTelefone } from "./telefone";

test("normaliza para E.164, +55 por padrão", () => {
  assert.equal(normalizarE164("(11) 99999-0001"), "+5511999990001");
  assert.equal(normalizarE164("11 3333-4444"), "+551133334444");
  assert.equal(normalizarE164("+55 11 99999-0001"), "+5511999990001");
  assert.equal(normalizarE164("5511999990001"), "+5511999990001");
  assert.equal(normalizarE164("55 99999-0001"), "+5555999990001", "DDD 55 sem país não é confundido com o país");
});

test("internacional mantém o código do país", () => {
  assert.equal(normalizarE164("+1 415 555 0100"), "+14155550100");
  assert.equal(normalizarE164("+351 912 345 678"), "+351912345678");
  assert.equal(normalizarE164("0044 20 7946 0958"), "+442079460958");
});

test("lixo vira null", () => {
  for (const v of ["", null, undefined, "abc", "1199", "undefined", "012345678901", "+55 11 999"]) {
    assert.equal(normalizarE164(v as string), null, String(v));
  }
});

test("formatos mistos da base dão a mesma chave", () => {
  const chaves = ["(11) 99999-0001", "11999990001", "+55 11 99999-0001", "5511999990001", "+5511999990001"].map(chaveTelefone);
  assert.deepEqual(new Set(chaves), new Set(["5511999990001"]));
});

test("máscara de digitação BR e internacional", () => {
  assert.equal(mascararTelefone(""), "");
  assert.equal(mascararTelefone("1"), "(1");
  assert.equal(mascararTelefone("11"), "(11");
  assert.equal(mascararTelefone("119"), "(11) 9");
  assert.equal(mascararTelefone("1133334444"), "(11) 3333-4444");
  assert.equal(mascararTelefone("11999990001"), "(11) 99999-0001");
  assert.equal(mascararTelefone("119999900019999"), "(11) 99999-0001", "corta no máximo de 11 dígitos");
  assert.equal(mascararTelefone("+"), "+");
  assert.equal(mascararTelefone("+5511999990001"), "+55 (11) 99999-0001");
  assert.equal(mascararTelefone("+14155550100"), "+14155550100");
});

test("a máscara de um número é aceita pelo normalizador (ida e volta)", () => {
  for (const v of ["11999990001", "1133334444", "+5511999990001", "+14155550100"]) {
    assert.equal(normalizarE164(mascararTelefone(v)), normalizarE164(v));
  }
});

test("formatar para exibição", () => {
  assert.equal(formatarTelefone("+5511999990001"), "+55 (11) 99999-0001");
  assert.equal(formatarTelefone("11999990001"), "+55 (11) 99999-0001");
  assert.equal(formatarTelefone("ramal 12"), "ramal 12");
  assert.equal(formatarTelefone(null), "");
});
