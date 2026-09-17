import assert from "node:assert/strict";
import test from "node:test";
import { compileFollowupGraph } from "./compile";
import { createEmptyFollowupGraph, followupGraphSchema, type FollowupGraph } from "./graph";
import { validateFollowupForPublish } from "./validate";

test("grafo vazio canônico é válido e compila para fim", () => {
  const graph = createEmptyFollowupGraph();
  assert.equal(followupGraphSchema.safeParse(graph).success, true);
  assert.deepEqual(validateFollowupForPublish(graph), { ok: true, errors: [] });
  const compiled = compileFollowupGraph(graph);
  assert.equal(compiled.length, 1);
  assert.equal(compiled[0]?.adapter, "noop");
});

test("publicação rejeita saída de classificação desconectada", () => {
  const graph: FollowupGraph = {
    schema_version: 2,
    nodes: [
      { id: "trigger", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: { event: "manual", filters: {} } },
      { id: "classify", type: "ai_classify", label: "Classificar", position: { x: 0, y: 100 }, config: { classes: [{ id: "hot", label: "Quente" }], grace_timeout_ms: 900_000, target: "last_reply" } },
      { id: "end", type: "end", label: "Fim", position: { x: 0, y: 200 }, config: { outcome: "custom" } },
    ],
    edges: [
      { id: "a", source: "trigger", target: "classify", priority: 0, condition: { type: "always" } },
      { id: "b", source: "classify", target: "end", priority: 0, condition: { type: "branch", branch_id: "hot" } },
    ],
  };
  const result = validateFollowupForPublish(graph);
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.errors.filter((error) => error.code === "missing_branch_edge").map((error) => error.branchId).sort(), ["else", "no_reply"]);
});

test("compilador preserva IDs estáveis de ramos", () => {
  const graph: FollowupGraph = {
    schema_version: 2,
    nodes: [
      { id: "trigger", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: { event: "manual", filters: {} } },
      { id: "cond", type: "condition", label: "Condição", position: { x: 0, y: 100 }, config: { combinator: "and", branching: "per_check", checks: [{ id: "vip", label: "VIP", field: "tag", op: "contains", value: "vip" }] } },
      { id: "yes", type: "end", label: "VIP", position: { x: -100, y: 200 }, config: { outcome: "converted" } },
      { id: "no", type: "end", label: "Normal", position: { x: 100, y: 200 }, config: { outcome: "custom" } },
    ],
    edges: [
      { id: "a", source: "trigger", target: "cond", priority: 0, condition: { type: "always" } },
      { id: "b", source: "cond", target: "yes", priority: 10, condition: { type: "branch", branch_id: "vip" } },
      { id: "c", source: "cond", target: "no", priority: 0, condition: { type: "always" } },
    ],
  };
  const condition = compileFollowupGraph(graph).find((step) => step.id === "cond");
  assert.equal(condition?.branches[0]?.proximoStepId, "yes");
  assert.equal(condition?.branches[1]?.proximoStepId, "no");
});

test("compilador transforma ações operacionais nos adapters duráveis", () => {
  const graph: FollowupGraph = {
    schema_version: 2,
    nodes: [
      { id: "trigger", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: { event: "LeadCreated", filters: {} } },
      { id: "task", type: "action", label: "Criar tarefa", position: { x: 0, y: 100 }, config: { mode: "create_task", title: "Contatar lead", priority: "alta", due_minutes: 30 } },
      { id: "stage", type: "action", label: "Mover etapa", position: { x: 0, y: 200 }, config: { mode: "update_stage", stage: "em_contato" } },
      { id: "end", type: "end", label: "Fim", position: { x: 0, y: 300 }, config: { outcome: "custom" } },
    ],
    edges: [
      { id: "a", source: "trigger", target: "task", priority: 0, condition: { type: "always" } },
      { id: "b", source: "task", target: "stage", priority: 0, condition: { type: "always" } },
      { id: "c", source: "stage", target: "end", priority: 0, condition: { type: "always" } },
    ],
  };
  assert.equal(followupGraphSchema.safeParse(graph).success, true);
  const compiled = compileFollowupGraph(graph);
  assert.equal(compiled.find((step) => step.id === "task")?.adapter, "crm_create_task");
  assert.equal(compiled.find((step) => step.id === "stage")?.adapter, "crm_update_stage");
});
