import assert from "node:assert/strict";
import test from "node:test";
import { aplicarTemaOnface } from "./OnfaceThemeRoot";

/** Elemento mínimo que registra o que foi feito com o atributo. */
function htmlFalso(valorInicial: string | null = null) {
  const registro: string[] = [];
  let valor = valorInicial;
  return {
    registro,
    get valor() { return valor; },
    setAttribute(nome: string, v: string) { registro.push(`set:${nome}=${v}`); valor = v; },
    removeAttribute(nome: string) { registro.push(`remove:${nome}`); valor = null; },
  };
}

test("montar marca o tema e desmontar REMOVE — nunca restaura", () => {
  const html = htmlFalso();
  const desmontar = aplicarTemaOnface(html);
  assert.equal(html.valor, "light", "a casca tem que marcar o tema ao montar");

  desmontar();
  assert.equal(html.valor, null, "ao sair da casca o atributo tem que sumir do <html>");
  assert.deepEqual(html.registro, ["set:data-onface-theme=light", "remove:data-onface-theme"]);
});

test("o atributo posto antes do paint não é tratado como estado de terceiro", () => {
  // Regressão do achado do QA em 19/09. Os layouts marcam `data-onface-theme`
  // num script inline antes do primeiro paint, então quando o efeito monta o
  // atributo JÁ está lá — escrito pelo próprio ciclo. A versão antiga lia esse
  // valor como "anterior" e o restaurava no desmonte, de modo que sair da
  // casca por navegação client-side deixava `light` grudado e os tokens ONFACE
  // vazavam para a tela seguinte.
  const html = htmlFalso("light");
  const desmontar = aplicarTemaOnface(html);
  desmontar();

  assert.equal(html.valor, null, "encontrar o atributo já posto não pode virar motivo para preservá-lo");
  assert.equal(
    html.registro.filter((e) => e.startsWith("set:")).length, 1,
    "o desmonte não pode escrever o atributo de novo",
  );
});
