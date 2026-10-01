import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarErroEnvio, htmlParaTexto, personalizar } from "./campanhas-texto";

test("personalizar usa o primeiro nome e não deixa variável crua", () => {
  assert.equal(personalizar("Oi {{nome}}, da {{ empresa }}", { nome: "Ana Paula", empresa: "Acme" }), "Oi Ana, da Acme");
  assert.equal(personalizar("Oi {{nome}}", { nome: null }), "Oi ");
});

test("htmlParaTexto mantém parágrafos e tira tags", () => {
  assert.equal(htmlParaTexto("<p>Olá {{nome}},</p>\n<p>A &amp; B<br>linha</p>"), "Olá {{nome}},\n\nA & B\nlinha");
});

test("erro da allowlist vira bloqueado, o resto falhou", () => {
  assert.equal(classificarErroEnvio(new Error("WhatsApp bloqueado pela allowlist do ambiente: 55 nao esta")).status, "bloqueado");
  assert.equal(classificarErroEnvio(new Error("fetch failed")).status, "falhou");
});
