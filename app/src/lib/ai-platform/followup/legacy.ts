import type { CadenceStep } from "@/lib/cadencia/cadence-engine";
import type { FollowupEdge, FollowupGraph, FollowupNode } from "./graph";

function nodeFromStep(step: CadenceStep, index: number): FollowupNode {
  const position = { x: 420, y: 220 + index * 180 };
  if (step.tipo === "wait") {
    return { id: step.id, type: "wait", label: String(step.config?.label ?? "Aguardar"), position, config: { mode: "fixed", duration_ms: Math.max(300_000, (step.esperaMinutos ?? 5) * 60_000) } };
  }
  if (step.tipo === "condition") {
    return {
      id: step.id, type: "condition", label: String(step.config?.label ?? "Condição"), position,
      config: { combinator: "and", branching: "combined", checks: [{ field: "last_outcome", op: "eq", value: String(step.config?.value ?? "true") }] },
    };
  }
  if (step.adapter === "ai_agent_message") {
    return { id: step.id, type: "action", label: String(step.config?.label ?? "Mensagem com IA"), position, config: { mode: "ai_message", prompt_hint: String(step.config?.prompt_hint ?? step.config?.mensagem ?? "Gere a próxima mensagem do follow-up.") } };
  }
  const templateId = typeof step.config?.template_id === "string" && /^[0-9a-f-]{36}$/i.test(step.config.template_id) ? step.config.template_id : "00000000-0000-0000-0000-000000000000";
  return { id: step.id, type: "action", label: String(step.config?.label ?? "Enviar mensagem"), position, config: { mode: "template", template_id: templateId } };
}

export function legacyStepsToFollowupGraph(steps: CadenceStep[]): FollowupGraph {
  const nodes: FollowupNode[] = [
    { id: "trigger", type: "trigger", label: "Início do fluxo", position: { x: 420, y: 40 }, config: { event: "manual", filters: {} } },
    ...steps.map(nodeFromStep),
    { id: "end", type: "end", label: "Fim do fluxo", position: { x: 420, y: 220 + steps.length * 180 }, config: { outcome: "exhausted" } },
  ];
  const edges: FollowupEdge[] = [];
  const first = steps[0]?.id ?? "end";
  edges.push({ id: `trigger-${first}`, source: "trigger", target: first, priority: 0, condition: { type: "always" } });
  steps.forEach((step, index) => {
    const fallback = steps[index + 1]?.id ?? "end";
    if (step.tipo === "condition" && step.branches.length > 0) {
      step.branches.forEach((branch, branchIndex) => edges.push({
        id: `${step.id}-${branchIndex}`,
        source: step.id,
        target: branch.proximoStepId ?? "end",
        priority: step.branches.length - branchIndex,
        condition: branchIndex === 0 ? { type: "cond_result", value: true } : { type: "cond_result", value: false },
      }));
      if (step.branches.length === 1) edges.push({ id: `${step.id}-fallback`, source: step.id, target: fallback, priority: 0, condition: { type: "cond_result", value: false } });
    } else {
      const explicit = step.branches.find((branch) => branch.condicao === null)?.proximoStepId;
      edges.push({ id: `${step.id}-next`, source: step.id, target: explicit ?? fallback, priority: 0, condition: { type: "always" } });
    }
  });
  return { schema_version: 2, nodes, edges };
}
