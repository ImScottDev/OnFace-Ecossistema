import test from "node:test";
import assert from "node:assert/strict";
import { candidatosAResponder } from "./autonomia";

/**
 * Regressão de 19/10/2026: a agente calava quando o lead tinha dono humano.
 *
 * O responsável do LEAD sobrescrevia o da CONVERSA, então um contato cuja
 * conversa era da Lia, num lead do Kauã, recebeu duas mensagens e não gerou
 * execução nenhuma — nem um run bloqueado, porque o código concluía "não é
 * agente" antes de tentar. Pôr a agente como responsável do número é dizer que
 * ela atende ali; o dono humano do lead é de quem é o NEGÓCIO. Convivem.
 */

const CONVERSA = "11111111-1111-1111-1111-111111111111";
const LEAD = "22222222-2222-2222-2222-222222222222";

test("a conversa é perguntada antes do lead, e os dois são perguntados", () => {
  assert.deepEqual(candidatosAResponder(CONVERSA, LEAD), [CONVERSA, LEAD]);
});

test("lead com dono humano não cala quem responde pela conversa", () => {
  // O caso real: conversa da agente, lead de uma pessoa. Antes sobrava só o
  // lead na lista e a agente nunca era considerada.
  const ordem = candidatosAResponder(CONVERSA, LEAD);
  assert.equal(ordem[0], CONVERSA, "a conversa tem que vir primeiro");
  assert.ok(ordem.includes(LEAD), "o lead continua valendo quando a conversa não tem agente");
});

test("sem responsável na conversa, o do lead ainda vale", () => {
  assert.deepEqual(candidatosAResponder(null, LEAD), [LEAD]);
});

test("mesmo responsável nos dois lugares é perguntado uma vez só", () => {
  assert.deepEqual(candidatosAResponder(CONVERSA, CONVERSA), [CONVERSA]);
});

test("sem responsável nenhum, ninguém a perguntar", () => {
  assert.deepEqual(candidatosAResponder(null, null), []);
});
