import { strict as assert } from "node:assert";
import { test } from "node:test";
import { descreverFaltando } from "./registry";

/* As três falhas reais de produção nos 30 dias até 21/10/2026: `lead_tag` sem
   `acao`/`tag`, `alert_create` sem `title`, `nexo_buscar` sem `termo`. O modelo
   recebia só o nome do campo e não acertava na volta seguinte. */

test("campo com lista de valores diz quais são", () => {
  const tool = { parameters: { properties: { acao: { type: "string", enum: ["adicionar", "remover"] } } } };
  assert.equal(descreverFaltando(tool, ["acao"]), "acao (um de: adicionar|remover)");
});

test("campo de texto diz o tipo e a descrição", () => {
  const tool = { parameters: { properties: { tag: { type: "string", description: "Nome da tag" } } } };
  assert.equal(descreverFaltando(tool, ["tag"]), "tag (texto — Nome da tag)");
});

test("vários campos saem numa lista só", () => {
  const tool = { parameters: { properties: { acao: { type: "string", enum: ["adicionar", "remover"] }, tag: { type: "string", description: "Nome da tag" } } } };
  assert.equal(descreverFaltando(tool, ["acao", "tag"]), "acao (um de: adicionar|remover), tag (texto — Nome da tag)");
});

test("campo sem schema não quebra nem inventa", () => {
  assert.equal(descreverFaltando({ parameters: {} }, ["termo"]), "termo");
  assert.equal(descreverFaltando({ parameters: { properties: {} } }, ["termo"]), "termo");
});

test("campo sem tipo nem descrição devolve só o nome", () => {
  assert.equal(descreverFaltando({ parameters: { properties: { x: {} } } }, ["x"]), "x");
});

test("tipo não-texto aparece como está", () => {
  const tool = { parameters: { properties: { quantidade: { type: "number", description: "Quantas" } } } };
  assert.equal(descreverFaltando(tool, ["quantidade"]), "quantidade (number — Quantas)");
});
