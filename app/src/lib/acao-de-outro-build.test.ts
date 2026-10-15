/**
 * As três formas do erro de deploy-com-a-página-aberta.
 *
 *   node --import tsx --test src/lib/acao-de-outro-build.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ehAcaoDeOutroBuild } from "./acao-de-outro-build";

test("reconhece as três mensagens que o Next entrega", () => {
  // A que apareceu na tela em 15/10/2026, no envio de uma proposta.
  assert.ok(ehAcaoDeOutroBuild(new Error('Server Action "4098a364647685272e567145e7d551f647bdce0343" was not found on the server')));
  assert.ok(ehAcaoDeOutroBuild(new Error('Failed to find Server Action "7f3c". This request might be from an older or newer deployment.')));
  assert.ok(ehAcaoDeOutroBuild("An action was called from an older or newer deployment"));
});

test("não confunde com erro de rede ou de regra", () => {
  assert.ok(!ehAcaoDeOutroBuild(new Error("Não consegui falar com o servidor.")));
  assert.ok(!ehAcaoDeOutroBuild(new Error("O prazo de validade desta proposta terminou.")));
  assert.ok(!ehAcaoDeOutroBuild(new Error("fetch failed")));
  assert.ok(!ehAcaoDeOutroBuild(null));
  assert.ok(!ehAcaoDeOutroBuild(undefined));
});
