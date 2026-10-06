/**
 * O board de Pré-vendas não pode referenciar um `D` que não existe no escopo.
 *
 * O defeito (achado só no teste logado de 06/10): `linhaLista` usava
 * `D.EQUIPE`, mas neste arquivo a equipe vem do getter `this.dadosDoProto`, e
 * `D` nunca foi definido. Resultado: `ReferenceError: D is not defined` em
 * runtime, derrubando o board INTEIRO num error boundary. O `@ts-nocheck` do
 * topo do arquivo escondeu isso do tsc.
 *
 * Ao contrário de CsLiga/PropostasLiga, que definem `const D = this.dadosDoProto`
 * no começo do render, PreVendasLiga usa `this.dadosDoProto` direto. Esta trava
 * garante que ninguém reintroduza um `D.` solto aqui.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(import.meta.dirname, "PreVendasLiga.tsx"), "utf8",
);
const semComentarios = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("PreVendasLiga não referencia um D que não define", () => {
  // Se alguém passar a definir `const D = ...` aqui, esta trava pode ser
  // afrouxada; por ora o arquivo não define D, então qualquer `D.` é o bug.
  assert.doesNotMatch(semComentarios, /\bconst\s+D\b|\bD\s*=/,
    "PreVendasLiga passou a definir D: revise esta trava para aceitar o uso local");
  assert.doesNotMatch(semComentarios, /[^A-Za-z0-9_.]D\./,
    "PreVendasLiga referencia um D que não existe (use this.dadosDoProto): ReferenceError derruba o board");
});

test("a equipe do seletor vem do getter dadosDoProto", () => {
  assert.match(semComentarios, /this\.dadosDoProto\.EQUIPE/,
    "o seletor de responsável tem que ler a equipe real por this.dadosDoProto.EQUIPE");
});
