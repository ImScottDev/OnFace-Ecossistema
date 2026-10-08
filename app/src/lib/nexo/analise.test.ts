import { test } from "node:test";
import assert from "node:assert/strict";
import { lerJson, normalizarAnalise } from "./analise";
import { destinoDaProposta } from "./cliente";

test("lerJson aceita JSON cercado de texto ou de cerca de código", () => {
  assert.deepEqual(lerJson('```json\n{"resumo":"ok"}\n```'), { resumo: "ok" });
  assert.equal(lerJson("sem json aqui"), null);
  assert.equal(lerJson("{quebrado"), null);
});

test("normalizarAnalise recusa resposta sem o campo essencial (nunca fabrica)", () => {
  assert.equal(normalizarAnalise("resumo", { pedidos: ["a"] }, "r").ok, false);
  assert.equal(normalizarAnalise("sentimento", { tom: "feliz", motivo: "x" }, "r").ok, false);
  assert.equal(normalizarAnalise("sugestao", {}, "r").ok, false);
  const r = normalizarAnalise("resumo", { resumo: "Cliente quer proposta.", pedidos: ["proposta", " "], proximo_passo: "Enviar proposta" }, "r");
  assert.ok(r.ok && r.tipo === "resumo");
  if (r.ok && r.tipo === "resumo") { assert.deepEqual(r.pedidos, ["proposta"]); assert.equal(r.proximoPasso, "Enviar proposta"); }
  const s = normalizarAnalise("sentimento", { tom: "Negativo", motivo: "Reclamou do prazo", sinais: ["demora"] }, "r");
  assert.ok(s.ok && s.tipo === "sentimento" && s.tom === "negativo");
});

test("destinoDaProposta leva a tarefa para o formulário único de Atividades", () => {
  assert.equal(destinoDaProposta({ kind: "criar_tarefa", rotulo: "x", titulo: "Ligar para Ana", venceEm: "2026-10-10T12:00:00Z" }), "/tarefas?nova=Ligar+para+Ana&data=2026-10-10");
  assert.equal(destinoDaProposta({ kind: "abrir_tela", rotulo: "x", href: "/pipeline" }), "/pipeline");
});
