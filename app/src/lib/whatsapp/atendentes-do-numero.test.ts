/**
 * Quem entra no rodízio de um número COMPARTILHADO (`podeAtenderPeloNumero`).
 * Até 20/10/2026 o worker sorteava entre TODOS os usuários ativos da
 * organização: agente de IA e gente sem acesso ao número recebiam conversa.
 * Sem banco: o que decide são os fatos do usuário e o vínculo com o número.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { podeAtenderPeloNumero } from "./acesso";

const pessoa = { ativo: true, tipo: "humano" };
const SEM_VINCULO = { ehDono: false, temAcesso: false };

test("atende quem é dono do número ou recebeu acesso a ele", () => {
  assert.equal(podeAtenderPeloNumero(pessoa, { ehDono: true, temAcesso: false }), true);
  assert.equal(podeAtenderPeloNumero(pessoa, { ehDono: false, temAcesso: true }), true);
});

test("pessoa ativa da organização SEM acesso ao número fica fora do rodízio", () => {
  // Recebia conversa que a porta não deixa ela abrir.
  assert.equal(podeAtenderPeloNumero(pessoa, SEM_VINCULO), false);
});

test("agente de IA nunca entra no rodízio, nem com acesso ao número", () => {
  const agente = { ativo: true, tipo: "agente" };
  assert.equal(podeAtenderPeloNumero(agente, { ehDono: true, temAcesso: true }), false);
});

test("inativo não entra", () => {
  assert.equal(podeAtenderPeloNumero({ ativo: false, tipo: "humano" }, { ehDono: true, temAcesso: true }), false);
});
