/**
 * Cor semântica só pode sair do dado.
 *
 * O frame do Figma da Visão Geral trazia os quatro cards de KPI com o MESMO selo
 * verde, porque no desenho todos os números eram inventados e positivos. Ligado
 * ao banco real, isso virou, em 22/09, "Receita do mês R$ 10.143,60 [− 78%]"
 * pintado de verde: a tela afirmando o contrário do que o número diz.
 *
 * O Início novo (`lib/inicio` + `components/onface/inicio`) guarda a mesma
 * regra em dois pontos: o tom nasce de uma função do sinal (`deltaDe`, com os
 * caminhos de alta, queda e sem base) e o selo lê esse tom do dado. Só o segundo
 * assert passaria também se alguém fixasse `data-tom="ok"` nos quatro cards.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "..", "..", "..");
const LENTE = path.join(RAIZ, "src", "lib", "inicio", "lente.ts");
const PASTA_TELA = path.join(RAIZ, "src", "components", "onface", "inicio");

/** Tira comentários de bloco e de linha, para o assert olhar só o que roda. */
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("o tom do delta é função do sinal, com os três caminhos", () => {
  const fonte = semComentarios(fs.readFileSync(LENTE, "utf8"));
  const fn = fonte.match(/export function deltaDe\([\s\S]*?\n}\n/)?.[0];
  assert.ok(fn, "sumiu a função que deriva o tom do delta");
  assert.match(fn, /tom: "neutro"/, "falta o caminho sem base: delta nulo não é bom nem ruim");
  assert.match(fn, /"ok" : "risco"/, "falta a escolha entre ok e risco pelo sinal e pelo 'mais é melhor'");
  assert.match(fn, /pct === 0/, "falta o caminho de variação zero");
});

test("o selo lê o tom do dado, não da marcação", () => {
  const arquivos = fs.readdirSync(PASTA_TELA).filter((f) => f.endsWith(".tsx"));
  assert.ok(arquivos.length >= 6, "a varredura não alcançou os arquivos da tela");
  const compartilhado = semComentarios(fs.readFileSync(path.join(PASTA_TELA, "compartilhado.tsx"), "utf8"));
  assert.match(compartilhado, /data-tom=\{delta\.tom\}/, "o selo não lê o tom do delta: está fixo na marcação");
  for (const a of arquivos) {
    const tela = semComentarios(fs.readFileSync(path.join(PASTA_TELA, a), "utf8"));
    assert.doesNotMatch(tela, /<SeloDelta[^>]*tom=/, `${a}: tom escrito à mão no selo`);
    assert.doesNotMatch(tela, /className="ini-delta"[^>]*data-tom="(ok|risco)"/, `${a}: tom fixo no selo`);
  }
});
