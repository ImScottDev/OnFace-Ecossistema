/**
 * O responsável de um lead tem que ser usuário da própria organização.
 *
 * O defeito: `atribuirResponsavel` e `criarLead` gravavam `responsavel_id` com
 * o id vindo do cliente, sem conferir a organização. Um id de usuário de OUTRA
 * empresa era aceito, e o lead saía das listas da equipe e passava a aparecer
 * para o outro cliente (vazamento de tenant, P0).
 *
 * Esta trava lê o código, não o banco: garante que a guarda exista e filtre por
 * `organizacao_id`, e que os dois caminhos de escrita a chamem. Um teste de
 * banco não a pegaria sem antes montar duas organizações.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(import.meta.dirname, "pre-vendas.ts"), "utf8",
);
const semComentarios = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a guarda filtra o usuário por organizacao_id e exige ativo", () => {
  const i = semComentarios.indexOf("export async function exigirResponsavelDaOrg");
  assert.ok(i > 0, "a guarda exigirResponsavelDaOrg sumiu: sem ela o responsável cruza tenant");
  const corpo = semComentarios.slice(i, i + 600);
  assert.match(corpo, /FROM usuarios/, "a guarda tem que consultar a tabela de usuários");
  assert.match(corpo, /organizacao_id = \$\{organizacaoId\}/, "a guarda tem que casar a organização");
  assert.match(corpo, /throw new (Error|RegraDeNegocio)/, "id de fora da organização tem que ser recusado, não ignorado");
  assert.match(corpo, /if \(!responsavelId\) return/, "null é válido: lead sem dono não pode quebrar");
});

test("os dois caminhos de escrita chamam a guarda antes de gravar", () => {
  for (const fn of ["atribuirResponsavel", "criarLead"]) {
    const i = semComentarios.indexOf(`export async function ${fn}`);
    assert.ok(i > 0, `${fn} mudou de forma: revise esta trava`);
    const corpo = semComentarios.slice(i, i + 1400);
    assert.match(corpo, /exigirResponsavelDaOrg\(/,
      `${fn} grava responsavel_id sem passar pela guarda de organização`);
  }
});
