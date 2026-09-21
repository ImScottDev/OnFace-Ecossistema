/**
 * A fila de loops precisa chegar na tela.
 *
 * Autoverificação: ao terminar o CP9 eu tinha criado `filaDeLoops`/
 * `resumoDeLoops` e ligado na tela apenas o FILTRO do board. A fila em si só
 * era chamada pelo smoke — ou seja, eu mesmo produzi o defeito recorrente
 * deste repo, peça pronta sem chamador, no checkpoint em que estava caçando
 * exatamente isso.
 *
 * A fila é mais rica que o filtro: mostra proposta sem resposta há 61 dias, que
 * "sem próxima ação" não alcança.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();

test("a fila de loops é lida por uma tela, não só pelo smoke", () => {
  const consumidores = [
    path.join("src", "app", "(crm2)", "pipeline", "page.tsx"),
  ];
  const quemChama = consumidores.filter((rel) =>
    /loops-abertos/.test(fs.readFileSync(path.join(raiz, rel), "utf8")));
  assert.ok(quemChama.length > 0,
    "nenhuma tela carrega a fila de loops: ela volta a existir só para o teste");
});

test("o recorte mostra a fila, e não só filtra o board", () => {
  const tela = fs.readFileSync(
    path.join(raiz, "src", "components", "onface", "vendas", "Pipeline.tsx"), "utf8");
  assert.match(tela, /loops\.porMotivo/,
    "a tela precisa mostrar os motivos do loop, senão o recorte não diz por onde começar");
  assert.match(tela, /loops\.valorParado/,
    "o dinheiro parado é o que prioriza a fila");
});
