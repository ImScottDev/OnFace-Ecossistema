import test from "node:test";
import assert from "node:assert/strict";
import { avaliarRegras, grafoInicial, novoNo, resolverExpressao, saidasDoNo, validarGrafo, type GrafoFluxo } from "./grafo";

test("expressão: caminho, padrão e valor cru", () => {
  const ctx = { lead: { nome: "Ana", tags: ["vip", "sp"] }, nos: { n2: { valor: 10 } } };
  assert.equal(resolverExpressao("Oi {{ lead.nome }}!", ctx), "Oi Ana!");
  assert.equal(resolverExpressao("{{ lead.email || \"sem e-mail\" }}", ctx), "sem e-mail");
  assert.equal(resolverExpressao("{{ nos.n2.valor }}", ctx), 10);
  assert.equal(resolverExpressao("Tags: {{ lead.tags }}", ctx), "Tags: vip, sp");
  assert.equal(resolverExpressao("{{ constructor.prototype }}", ctx), undefined);
});

test("regras: lista, número, vazio", () => {
  const ctx = { lead: { tags: ["VIP"], valor: "1500", email: "" } };
  assert.equal(avaliarRegras([{ campo: "lead.tags", operador: "igual", valor: "vip" }], "e", ctx), true);
  assert.equal(avaliarRegras([{ campo: "lead.valor", operador: "maior", valor: "1000" }, { campo: "lead.email", operador: "vazio" }], "e", ctx), true);
  assert.equal(avaliarRegras([{ campo: "lead.valor", operador: "menor", valor: "10" }, { campo: "lead.email", operador: "preenchido" }], "ou", ctx), false);
});

test("validação: grafo inicial não publica; grafo completo publica", () => {
  assert.ok(validarGrafo(grafoInicial()).length > 0);
  const g: GrafoFluxo = grafoInicial();
  g.nos[0].config = { modo: "evento", evento: "lead.criado" };
  const tarefa = novoNo("criar_tarefa", "n2", { x: 0, y: 120 });
  tarefa.config.titulo = "Ligar para {{ lead.nome }}";
  g.nos.push(tarefa);
  g.arestas.push({ id: "a1", origem: "n1", saida: "ok", destino: "n2" });
  assert.deepEqual(validarGrafo(g), []);
  // Gatilho manual sem registro não pode criar tarefa.
  g.nos[0].config = { modo: "manual", entidade: "nenhuma" };
  assert.ok(validarGrafo(g).some((p) => p.noId === "n2"));
});

test("validação: ciclo e saída duplicada", () => {
  const g: GrafoFluxo = grafoInicial();
  g.nos[0].config = { modo: "manual" };
  g.nos.push(novoNo("definir_variavel", "n2", { x: 0, y: 0 }), novoNo("definir_variavel", "n3", { x: 0, y: 0 }));
  g.nos[1].config.pares = [{ chave: "a", valor: "1" }];
  g.nos[2].config.pares = [{ chave: "b", valor: "2" }];
  g.arestas.push({ id: "a1", origem: "n1", saida: "ok", destino: "n2" }, { id: "a2", origem: "n2", saida: "ok", destino: "n3" }, { id: "a3", origem: "n3", saida: "ok", destino: "n2" });
  assert.ok(validarGrafo(g).some((p) => p.mensagem.includes("Laços")));
  g.arestas.push({ id: "a4", origem: "n1", saida: "ok", destino: "n3" });
  assert.ok(validarGrafo(g).some((p) => p.mensagem.includes("único")));
});

test("saídas dinâmicas e de erro", () => {
  const r = novoNo("roteador", "n2", { x: 0, y: 0 });
  r.config.rotas = [{ id: "quente", rotulo: "Quente", regras: [] }];
  assert.deepEqual(saidasDoNo(r).map((s) => s.id), ["quente", "senao"]);
  const w = novoNo("enviar_whatsapp", "n3", { x: 0, y: 0 });
  w.falha = { politica: "saida_erro", timeoutSeg: 30, tentativas: 0 };
  assert.deepEqual(saidasDoNo(w).map((s) => s.id), ["ok", "erro"]);
});
