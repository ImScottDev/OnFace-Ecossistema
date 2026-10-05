/**
 * Cor semântica só pode sair do dado.
 *
 * O frame do Figma da Visão Geral trazia os quatro cards de KPI com o MESMO selo
 * verde, porque no desenho todos os números eram inventados e positivos. Ligado
 * ao banco real, isso virou, em 22/09, "Receita do mês R$ 10.143,60 [− 78%]"
 * pintado de verde: a tela afirmando o contrário do que o número diz, no
 * primeiro lugar em que a pessoa olha.
 *
 * O Início que está no ar é `VisaoGeral` alimentado por `montarVisaoGeral`. A
 * trava é dupla de propósito: o tom tem que sair de uma função do sinal (com os
 * três caminhos) E o selo tem que ler esse tom do dado. Só o segundo assert
 * passaria também se alguém fixasse `tendencia: "alta"` nos quatro cards.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "..", "..", "..");
const CONSULTA = path.join(RAIZ, "src", "lib", "analytics", "onface-visao-geral.ts");
const TELA = path.join(RAIZ, "src", "components", "onface", "visao-geral", "VisaoGeral.tsx");

/** Tira comentários de bloco e de linha, para o assert olhar só o que roda. */
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("o tom da métrica é função do sinal, com os três caminhos", () => {
  const consulta = semComentarios(fs.readFileSync(CONSULTA, "utf8"));
  const fn = consulta.match(/const tendencia = \([^)]*\) =>[^;]+;/)?.[0];
  assert.ok(fn, "sumiu a função que deriva o tom do delta");
  assert.match(fn, /"baixa"/, "falta o caminho de queda: sem ele, número negativo volta a ficar verde");
  assert.match(fn, /"neutra"/, "falta o caminho sem base: delta nulo não é bom nem ruim");
  assert.match(fn, /"alta"/, "falta o caminho de alta");
  assert.ok((consulta.match(/tendencia: tendencia\(/g) ?? []).length >= 2,
    "as métricas com delta precisam passar o delta pela função, não fixar o tom");
});

test("o selo lê o tom do dado, não da marcação", () => {
  const tela = semComentarios(fs.readFileSync(TELA, "utf8"));
  assert.match(tela, /data-tendencia=\{metrica\.tendencia\}/,
    "o selo não lê o tom da métrica: está fixo na marcação");
  assert.doesNotMatch(tela, /data-tendencia="(alta|baixa|neutra)"/,
    "tom escrito à mão no selo decide o resultado antes de olhar o número");
});
