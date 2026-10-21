import assert from "node:assert/strict";
import { test } from "node:test";
import { cortarPorTokens, tokensDe } from "./builder";

/**
 * "Janela em tokens" era rótulo sem efeito: o builder só cortava por número de
 * mensagens e o `tokensAprox` era apenas reportado. Em produção o teto estava
 * 8.000 e a entrada média era ~11,3k tokens. Agora o teto corta de verdade.
 */

const linhas = (quantidade: number, tamanho = 360) =>
  Array.from({ length: quantidade }, (_, i) => `${i}`.padEnd(tamanho, "x"));

test("sem teto, nada é cortado", () => {
  const todas = linhas(30);
  assert.deepEqual(cortarPorTokens(todas, null), todas);
  assert.deepEqual(cortarPorTokens(todas, 0), todas);
});

test("o teto corta as mais antigas e mantém as mais recentes", () => {
  const todas = linhas(30);
  const mantidas = cortarPorTokens(todas, 1000);
  assert.ok(mantidas.length < todas.length, "deveria ter cortado alguma coisa");
  assert.equal(mantidas.at(-1), todas.at(-1), "a última mensagem é a mais importante");
  assert.deepEqual(mantidas, todas.slice(todas.length - mantidas.length), "mantém o fim contíguo");
  assert.ok(tokensDe(mantidas.join("\n")) <= 1000, "o resultado respeita o teto");
});

test("teto minúsculo não deixa o contexto vazio", () => {
  const mantidas = cortarPorTokens(linhas(30), 1);
  assert.equal(mantidas.length, 3, "mínimo de mensagens recentes preservado");
});

test("o mínimo é configurável para o histórico antigo, que pode sair inteiro", () => {
  assert.deepEqual(cortarPorTokens(linhas(5), 1, 0), []);
});
