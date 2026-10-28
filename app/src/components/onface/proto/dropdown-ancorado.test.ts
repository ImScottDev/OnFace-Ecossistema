import { test } from "node:test";
import assert from "node:assert/strict";
import { caixaDoMenu, estiloDoMenu } from "./dropdown-ancorado";

const janela = 900;

test("o menu nunca passa do espaço que sobra abaixo do botão", () => {
  // Botão no meio da tela, lista longa (equipe toda): cabe 882px pela janela,
  // mas só 282px abaixo do botão. Era aqui que a lista descia para fora.
  const { paraCima, altura } = caixaDoMenu({ top: 560, bottom: 600, left: 40, width: 200 }, janela, 600);
  assert.equal(paraCima, true, "com 560px acima e 282px abaixo, abre para cima");
  assert.equal(altura, 542);
  assert.ok(altura < janela, "a altura é o espaço do lado escolhido, não a janela");
});

test("cabendo abaixo, abre para baixo e limita pelo espaço", () => {
  const { paraCima, altura } = caixaDoMenu({ top: 100, bottom: 140, left: 40, width: 200 }, janela, 300);
  assert.equal(paraCima, false);
  assert.equal(altura, 742);
});

test("botão colado no rodapé abre para cima sem altura negativa", () => {
  const { paraCima, altura } = caixaDoMenu({ top: 880, bottom: 898, left: 40, width: 200 }, janela, 300);
  assert.equal(paraCima, true);
  assert.ok(altura > 0);
});

test("sem espaço nos dois lados a altura não fica negativa", () => {
  const { altura } = caixaDoMenu({ top: 4, bottom: 896, left: 0, width: 100 }, janela, 300);
  assert.ok(altura >= 0);
});

test("o estilo leva max-height do espaço real e largura mínima", () => {
  const css = estiloDoMenu({ top: 560, bottom: 600, left: 40, width: 120 }, janela, 600);
  assert.ok(css.includes("max-height:542px"), css);
  assert.ok(css.includes("width:236px"), "largura mínima quando o botão é estreito");
  assert.ok(css.includes("bottom:" + (janela - 560 + 6) + "px"), css);
});
