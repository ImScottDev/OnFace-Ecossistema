import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dadosDeCriacaoDaCadencia,
  podeGerenciarCadencia,
  podeUsarCadencia,
  podeVerCadencia,
  visibilidadeDaCadencia,
} from "./acesso";

const dono = "00000000-0000-0000-0000-000000000001";
const outro = "00000000-0000-0000-0000-000000000002";

test("cadência legada sem visibilidade é compartilhada", () => {
  assert.equal(visibilidadeDaCadencia({ visibility: null, ownerId: null }), "shared");
  assert.equal(podeVerCadencia({ visibility: null, ownerId: null }, { userId: outro }), true);
});

test("cadência pessoal fecha leitura, uso e edição para o proprietário", () => {
  const pessoal = { visibility: "personal", ownerId: dono };
  assert.equal(podeVerCadencia(pessoal, { userId: dono }), true);
  assert.equal(podeVerCadencia(pessoal, { userId: outro }), false);
  assert.equal(podeUsarCadencia(pessoal, { userId: dono, canManage: true }), true);
  assert.equal(podeUsarCadencia(pessoal, { userId: outro, canManage: true }), false);
  assert.equal(podeGerenciarCadencia(pessoal, { userId: outro, canManage: true }), false);
});

test("cadência compartilhada mantém o gate de permissão existente", () => {
  const compartilhada = { visibility: "shared", ownerId: dono };
  assert.equal(podeVerCadencia(compartilhada, { userId: outro }), true);
  assert.equal(podeUsarCadencia(compartilhada, { userId: outro, canManage: false }), false);
  assert.equal(podeGerenciarCadencia(compartilhada, { userId: outro, canManage: true }), true);
});

test("criação sempre grava o usuário autenticado como proprietário", () => {
  assert.deepEqual(dadosDeCriacaoDaCadencia(dono, "personal"), { ownerId: dono, visibility: "personal" });
});
