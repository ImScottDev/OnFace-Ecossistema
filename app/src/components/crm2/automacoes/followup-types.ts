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
import { CADENCE_TRIGGER_EVENTS } from "@/lib/ai/agent-studio";

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

/**
 * O que a cadência de fato recebe: "manual" (só o follow-up aceita inscrição
 * manual/API sem evento) mais os eventos de outbox que
 * `dispatchAutomationEvent` resolve — `CADENCE_TRIGGER_EVENTS`, não o catálogo
 * inteiro do agente. Antes esta lista era `AGENT_EVENT_CATALOG` cru e oferecia
 * cinco gatilhos que nunca chegavam aqui (dois inexistentes no código, três
 * internos do runtime de agente).
 */
const EVENT_CATALOG = [{ id: "manual", nome: "Inscrição manual/API" }, ...CADENCE_TRIGGER_EVENTS.map((e) => ({ id: e.id, nome: e.nome }))];
export { EVENT_CATALOG };

/** Gatilho salvo que esta tela não oferece mais: nenhum evento chega até ele, então a cadência nunca entrou por aí. */
export function eventoDeCadenciaInvalido(id: string | null | undefined): boolean {
  return !!id && !EVENT_CATALOG.some((e) => e.id === id);
}

export const AVISO_GATILHO_INVALIDO = "Gatilho inválido: nenhum evento do sistema chega até ele, então esta cadência nunca entrou por aqui. Escolha outro e publique.";

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
  if (node.type === "action") return ({ ai_message: "Mensagem gerada por IA", template: "Template WhatsApp", create_task: "Criar tarefa", add_tag: "Adicionar tag", remove_tag: "Remover tag", update_stage: "Atualizar etapa", assign_owner: "Atribuir responsável", add_note: "Registrar nota", email: "Enviar e-mail", callface_call: "Ligação Callface AI" } as Record<string, string>)[node.config.mode] ?? node.config.mode;
  if (node.type === "end") return node.config.outcome === "converted" ? "Convertido" : node.config.outcome === "custom" ? (node.config.note || "Personalizado") : "Esgotado";
  // Gatilho salvo que não chega mais aparece marcado no próprio desenho, em vez
  // de passar por um id cru qualquer que parece um gatilho legítimo.
  return EVENT_CATALOG.find((e) => e.id === node.config.event)?.nome ?? `${node.config.event} · gatilho inválido`;
}

export function newEmptyGraphNodePosition(existing: FollowupNode[]): { x: number; y: number } {
  const col = existing.length % 3;
  const row = Math.floor(existing.length / 3);
  return { x: 60 + col * 300, y: 260 + row * 190 };
}
