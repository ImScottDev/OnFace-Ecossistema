/**
 * Helpers de UI do editor visual de Follow-ups. Nenhuma regra de negócio
 * duplicada aqui — tipos, `branchesForNode`, `edgeBranchId` e
 * `validateFollowupForPublish` vêm direto de `lib/ai-platform/followup/*`
 * (mesmos módulos usados pelo servidor pra compilar/validar o grafo).
 */
import {
  branchesForNode, edgeBranchId, followupGraphSchema,
  type FollowupBranch, type FollowupEdge, type FollowupEdgeCondition, type FollowupGraph, type FollowupNode, type FollowupNodeType,
} from "@/lib/ai-platform/followup/graph";
import { AGENT_EVENT_CATALOG } from "@/lib/ai/agent-studio";

export { branchesForNode, edgeBranchId, followupGraphSchema };
export type { FollowupBranch, FollowupEdge, FollowupEdgeCondition, FollowupGraph, FollowupNode, FollowupNodeType };

export function uid(prefix: string): string {
  return `${prefix}-${(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 8)}`;
}

/** Condição do lado do cliente pra uma edge que sai da `branchId` do nó — inverso de `conditionForBranch` no compilador do servidor (compile.ts). Nunca persistimos edge sem essa condição coerente com a branch escolhida na handle. */
export function conditionForBranch(node: FollowupNode, branchId: string): FollowupEdgeCondition {
  if (branchId === "else") return { type: "always" };
  if (node.type === "condition" && node.config.branching !== "per_check") return { type: "cond_result", value: branchId === "true" };
  if (node.type === "condition") return { type: "branch", branch_id: branchId };
  if (node.type === "ai_classify") return { type: "class_match", value: branchId };
  return { type: "always" };
}

/** Branch declarada resolve antes da de fallback ("else"/"no_reply") — sem isso o "else" (que compila pra condição sempre-verdadeira) venceria a corrida no motor. */
export function priorityForBranch(branch: FollowupBranch): number {
  return branch.kind === "fallback" ? -1 : 10;
}

export const NODE_TYPE_META: Record<FollowupNodeType, { label: string; color: string; addable: boolean }> = {
  trigger: { label: "Gatilho", color: "#81ad73", addable: false },
  wait: { label: "Aguardar", color: "#70b7d5", addable: true },
  condition: { label: "Condição", color: "#c99855", addable: true },
  ai_classify: { label: "Classificar com IA", color: "#9b7fd4", addable: true },
  action: { label: "Ação", color: "#88aa75", addable: true },
  end: { label: "Fim", color: "#c56d5e", addable: true },
};

/** Mesmo catálogo usado no gatilho dos agentes (agent-studio.ts) — "manual" é o único acréscimo, já que só o follow-up aceita inscrição manual/API sem evento. */
const EVENT_CATALOG = [{ id: "manual", nome: "Inscrição manual/API" }, ...AGENT_EVENT_CATALOG.map((e) => ({ id: e.id, nome: e.nome }))];
export { EVENT_CATALOG };

export function defaultConfigFor(type: FollowupNodeType): FollowupNode["config"] {
  switch (type) {
    case "trigger": return { event: "manual", filters: {} };
    case "wait": return { mode: "fixed", duration_ms: 3_600_000 };
    case "condition": return { combinator: "and", branching: "per_check", checks: [{ id: uid("regra"), label: "Regra 1", field: "last_outcome", op: "eq", value: "true" }] };
    case "ai_classify": return { classes: [{ id: "positivo", label: "Positivo" }, { id: "negativo", label: "Negativo" }], grace_timeout_ms: 3_600_000, target: "last_reply" };
    case "action": return { mode: "ai_message", prompt_hint: "Escreva a próxima mensagem do follow-up considerando o histórico da conversa." };
    case "end": return { outcome: "exhausted" };
  }
}

export function makeNode(type: FollowupNodeType, position: { x: number; y: number }): FollowupNode {
  return { id: uid(type), type, label: NODE_TYPE_META[type].label, position, config: defaultConfigFor(type) } as FollowupNode;
}

export function nodeSubtitle(node: FollowupNode): string {
  if (node.type === "wait") return node.config.mode === "fixed" ? `${Math.round(node.config.duration_ms / 60_000)} min` : `${Math.round(node.config.min_ms / 60_000)}–${Math.round(node.config.max_ms / 60_000)} min (IA decide)`;
  if (node.type === "condition") return node.config.branching === "per_check" ? `${node.config.checks.length} regra(s), 1 saída cada` : `${node.config.checks.length} regra(s) combinadas (${node.config.combinator === "and" ? "E" : "OU"})`;
  if (node.type === "ai_classify") return `${node.config.classes.length} classe(s) · ${node.config.target === "summary" ? "resumo" : "última resposta"}`;
  if (node.type === "action") return node.config.mode === "ai_message" ? "Mensagem gerada por IA" : "Template WhatsApp";
  if (node.type === "end") return node.config.outcome === "converted" ? "Convertido" : node.config.outcome === "custom" ? (node.config.note || "Personalizado") : "Esgotado";
  return EVENT_CATALOG.find((e) => e.id === node.config.event)?.nome ?? node.config.event;
}

export function newEmptyGraphNodePosition(existing: FollowupNode[]): { x: number; y: number } {
  const col = existing.length % 3;
  const row = Math.floor(existing.length / 3);
  return { x: 60 + col * 300, y: 260 + row * 190 };
}
