import { test } from "node:test";
import assert from "node:assert/strict";
import { grafoInicial, validarGrafo } from "@/lib/automacoes/grafo";
import { adicionarNo, anteriores, duplicar, ligar, motivoNaoLigar, remover, trocarNo } from "./operacoes";
import { MODELOS } from "./modelos";

test("adicionar depois de uma saída liga e posiciona à direita", () => {
  const { grafo, id } = adicionarNo(grafoInicial(), "condicao", { depoisDe: { noId: "n1", saida: "ok" } });
  assert.equal(id, "n2");
  assert.deepEqual(grafo.arestas.map((a) => [a.origem, a.saida, a.destino]), [["n1", "ok", "n2"]]);
  assert.ok(grafo.nos[1].posicao.x > grafo.nos[0].posicao.x);
});

test("ligar recusa laço, volta ao gatilho e troca a ligação da mesma saída", () => {
  let g = adicionarNo(grafoInicial(), "esperar", { depoisDe: { noId: "n1", saida: "ok" } }).grafo;
  g = adicionarNo(g, "parar", { depoisDe: { noId: "n2", saida: "ok" } }).grafo; // n1→n2→n3 (parar não tem saída)
  g = adicionarNo(g, "criar_tarefa", { posicao: { x: 0, y: 400 } }).grafo; // n4 solto
  assert.match(motivoNaoLigar(g, "n4", "ok", "n1") ?? "", /gatilho/);
  const comN4 = ligar(g, "n2", "ok", "n4");
  assert.deepEqual(comN4.arestas.filter((a) => a.origem === "n2").map((a) => a.destino), ["n4"]);
  assert.match(motivoNaoLigar(comN4, "n4", "ok", "n2") ?? "", /voltar/);
  assert.equal(ligar(comN4, "n4", "ok", "n2"), comN4);
});

test("remover nunca tira o gatilho e leva as ligações órfãs", () => {
  const g = adicionarNo(grafoInicial(), "esperar", { depoisDe: { noId: "n1", saida: "ok" } }).grafo;
  const r = remover(g, ["n1", "n2"]);
  assert.deepEqual(r.nos.map((n) => n.id), ["n1"]);
  assert.equal(r.arestas.length, 0);
});

test("trocarNo descarta ligação de saída que deixou de existir", () => {
  let g = adicionarNo(grafoInicial(), "roteador", { depoisDe: { noId: "n1", saida: "ok" } }).grafo;
  g = trocarNo(g, "n2", (n) => ({ ...n, config: { rotas: [{ id: "r1", rotulo: "A", regras: [] }] } }));
  g = adicionarNo(g, "parar", { depoisDe: { noId: "n2", saida: "r1" } }).grafo;
  assert.equal(g.arestas.length, 2);
  g = trocarNo(g, "n2", (n) => ({ ...n, config: { rotas: [] } }));
  assert.deepEqual(g.arestas.map((a) => a.saida), ["ok"]);
  assert.deepEqual(anteriores(g, "n2"), ["n1"]);
  assert.equal(duplicar(g, "n1"), null);
});

test("modelos só pendem do que depende da conta (tag, etapa, agente)", () => {
  for (const m of MODELOS) {
    const pend = validarGrafo(m.grafo());
    const outras = pend.filter((p) => !["tagId", "etapa", "agenteId"].includes(p.campo ?? ""));
    assert.deepEqual(outras, [], `${m.id}: ${JSON.stringify(outras)}`);
  }
});
