import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyFollowupGraph, followupGraphSchema, type FollowupGraph } from "@/lib/ai-platform/followup/graph";
import { compileFollowupGraph } from "@/lib/ai-platform/followup/compile";
import { validateFollowupForPublish } from "@/lib/ai-platform/followup/validate";
import { resultadoCondicaoCadencia } from "./cadence-conditions";

const regras = [
  { id: "fit", field: "fit", op: "eq" as const, value: "alto" },
  { id: "interesse", field: "interesse", op: "contains" as const, value: "PABX" },
];

test("condição E/OU é calculada dos dados vivos, não de flag inexistente", () => {
  assert.equal(resultadoCondicaoCadencia({ combinator: "and", branching: "combined", checks: regras }, { fit: "alto", interesse: "PABX e IA" }), true);
  assert.equal(resultadoCondicaoCadencia({ combinator: "and", branching: "combined", checks: regras }, { fit: "baixo", interesse: "PABX" }), false);
  assert.equal(resultadoCondicaoCadencia({ combinator: "or", branching: "combined", checks: regras }, { fit: "baixo", interesse: "PABX" }), true);
  assert.equal(resultadoCondicaoCadencia({ combinator: "or", branching: "combined", checks: regras }, { fit: "baixo", interesse: "Outro" }), false);
});

function caminho(condicaoPorRegra: boolean): FollowupGraph {
  const inicial = createEmptyFollowupGraph();
  return {
    ...inicial,
    nodes: [
      inicial.nodes[0],
      { id: "cond", type: "condition", label: "Tem interesse?", position: { x: 400, y: 210 }, config: { combinator: "and", branching: condicaoPorRegra ? "per_check" : "combined", checks: regras.slice(0, 1) } },
      { id: "chamar", type: "action", label: "Ligar", position: { x: 650, y: 390 }, config: { mode: "callface_call" } },
      inicial.nodes[1],
    ],
    edges: [
      { id: "trigger-cond", source: "trigger", target: "cond", priority: 0, condition: { type: "always" } },
      condicaoPorRegra
        ? { id: "z-r1", source: "cond", target: "chamar", priority: 0, condition: { type: "branch", branch_id: "fit" } }
        : { id: "z-true", source: "cond", target: "chamar", priority: 0, condition: { type: "cond_result", value: true } },
      condicaoPorRegra
        ? { id: "a-else", source: "cond", target: "end", priority: 0, condition: { type: "always" } }
        : { id: "a-false", source: "cond", target: "end", priority: 0, condition: { type: "cond_result", value: false } },
      { id: "chamar-end", source: "chamar", target: "end", priority: 0, condition: { type: "always" } },
    ],
  } as FollowupGraph;
}

test("grafo ramificado Sim/Não valida e compila ambas as saídas", () => {
  const graph = caminho(false);
  assert.equal(followupGraphSchema.safeParse(graph).success, true);
  assert.deepEqual(validateFollowupForPublish(graph), { ok: true, errors: [] });
  const steps = compileFollowupGraph(graph);
  const branch = steps.find((s) => s.id === "cond")!;
  assert.equal(branch.branches.length, 2);
  const sim = branch.branches.find((b) => b.condicao?.valor === true);
  const nao = branch.branches.find((b) => b.condicao?.valor === false);
  assert.equal(sim?.proximoStepId, "chamar");
  assert.equal(nao?.proximoStepId, "end");
  assert.equal(steps.find((s) => s.id === "chamar")?.adapter, "crm_callface_call");
});

test("fallback sempre vem DEPOIS da condição, mesmo com id lexicamente anterior", () => {
  const graph = caminho(true);
  assert.equal(followupGraphSchema.safeParse(graph).success, true);
  assert.equal(validateFollowupForPublish(graph).ok, true);
  const branches = compileFollowupGraph(graph).find((s) => s.id === "cond")!.branches;
  assert.equal(branches[0].proximoStepId, "chamar");
  assert.equal(branches[1].proximoStepId, "end");
  assert.equal(branches[1].condicao, null);
});
