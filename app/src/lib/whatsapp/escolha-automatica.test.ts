/**
 * Escolha AUTOMÁTICA de número (`escolherNumeroAutomatico`), a regra que o
 * lembrete de reunião passou a usar em 20/10/2026: antes ele pegava o PRIMEIRO
 * número do responsável, que podia ser o WhatsApp pessoal dele.
 * Sem banco: o que decide é a lista de números e o responsável.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { escolherNumeroAutomatico } from "./uso-automatico";

const num = (id: string, p: Partial<Parameters<typeof escolherNumeroAutomatico>[0][number]> = {}) =>
  ({ id, status: "connected", ...p });

const EU = "u-responsavel";

test("prefere o número operacional do responsável, e o padrão dele", () => {
  const escolhido = escolherNumeroAutomatico([
    num("outro-operacional", { operacional: true }),
    num("meu-secundario", { usuarioId: EU, operacional: true }),
    num("meu-padrao", { usuarioId: EU, operacional: true, isDefault: true }),
  ], EU);
  assert.equal(escolhido, "meu-padrao");
});

test("responsável sem número operacional cai no pool operacional da organização", () => {
  assert.equal(escolherNumeroAutomatico([
    num("meu-nao-operacional", { usuarioId: EU }),
    num("pool", { operacional: true }),
  ], EU), "pool");
});

test("número privado nunca é escolhido automaticamente", () => {
  // Com pool operacional, o privado do responsável perde para o pool.
  assert.equal(escolherNumeroAutomatico([
    num("privado-dele", { usuarioId: EU, privado: true, isDefault: true }),
    num("pool", { operacional: true }),
  ], EU), "pool");
  // O cenário real do lembrete: o responsável só tem o WhatsApp pessoal dele e
  // não há pool. Devolve null — sai pelo token do ambiente, como já saía quando
  // o responsável não tinha número nenhum. O que não acontece é a máquina falar
  // pelo WhatsApp pessoal dele.
  assert.equal(escolherNumeroAutomatico([
    num("privado-dele", { usuarioId: EU, privado: true, isDefault: true }),
    num("compartilhado-de-ninguem", {}),
  ], EU), null);
  // Privado marcado como operacional (o CHECK do banco impede) também não passa.
  assert.equal(escolherNumeroAutomatico([num("privado", { usuarioId: EU, privado: true, operacional: true })], EU), null);
});

test("sem nenhum número operacional, o lembrete continua saindo pelo número do responsável", () => {
  // Fallback deliberado: em 20/10/2026 nenhum número de produção é operacional.
  // Lembrete que some é pior que lembrete pelo número errado.
  assert.equal(escolherNumeroAutomatico([
    num("de-outra-pessoa", { usuarioId: "u-outro" }),
    num("meu", { usuarioId: EU }),
  ], EU), "meu");
  // Nem conectado: ainda assim é o que a versão antiga escolhia.
  assert.equal(escolherNumeroAutomatico([num("meu-caido", { usuarioId: EU, status: "disconnected" })], EU), "meu-caido");
});

test("sem número utilizável devolve null (quem chama segue sem sessaoId, como antes)", () => {
  assert.equal(escolherNumeroAutomatico([], EU), null);
  assert.equal(escolherNumeroAutomatico([num("de-outra-pessoa", { usuarioId: "u-outro" })], EU), null);
  assert.equal(escolherNumeroAutomatico([num("sem-dono-nao-operacional", {})], null), null);
});
