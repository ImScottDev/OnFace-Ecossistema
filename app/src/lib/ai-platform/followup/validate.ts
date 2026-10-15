import { branchesForNode, edgeBranchId, type FollowupEdge, type FollowupGraph, type FollowupNode } from "./graph";

export type FollowupValidationError = {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  branchId?: string;
};

export type FollowupValidationResult = { ok: true; errors: [] } | { ok: false; errors: FollowupValidationError[] };

function outgoingMap(edges: FollowupEdge[]) {
  const map = new Map<string, FollowupEdge[]>();
  for (const edge of edges) map.set(edge.source, [...(map.get(edge.source) ?? []), edge]);
  return map;
}

function reachableFrom(start: string, outgoing: Map<string, FollowupEdge[]>) {
  const result = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of outgoing.get(current) ?? []) if (!result.has(edge.target)) { result.add(edge.target); queue.push(edge.target); }
  }
  return result;
}

function nodesThatReachEnd(nodes: FollowupNode[], edges: FollowupEdge[]) {
  const reverse = new Map<string, string[]>();
  for (const edge of edges) reverse.set(edge.target, [...(reverse.get(edge.target) ?? []), edge.source]);
  const result = new Set(nodes.filter((node) => node.type === "end").map((node) => node.id));
  const queue = [...result];
  while (queue.length) {
    const current = queue.shift()!;
    for (const source of reverse.get(current) ?? []) if (!result.has(source)) { result.add(source); queue.push(source); }
  }
  return result;
}

function hasCycle(start: string, outgoing: Map<string, FollowupEdge[]>) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const edge of outgoing.get(id) ?? []) if (walk(edge.target)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return walk(start);
}

export function validateFollowupForPublish(graph: FollowupGraph): FollowupValidationResult {
  const errors: FollowupValidationError[] = [];
  const triggers = graph.nodes.filter((node) => node.type === "trigger");
  if (triggers.length !== 1) errors.push({ code: triggers.length === 0 ? "no_trigger" : "multiple_triggers", message: "O fluxo precisa ter exatamente um gatilho." });
  const trigger = triggers[0];
  if (!trigger) return { ok: false, errors };
  const outgoing = outgoingMap(graph.edges);
  const reachable = reachableFrom(trigger.id, outgoing);
  const reachesEnd = nodesThatReachEnd(graph.nodes, graph.edges);

  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) errors.push({ code: "unreachable_node", message: `O nó “${node.label}” não é alcançável.`, nodeId: node.id });
    if (!reachesEnd.has(node.id)) errors.push({ code: "no_end_path", message: `O nó “${node.label}” não possui caminho até um fim.`, nodeId: node.id });
    const edges = outgoing.get(node.id) ?? [];
    for (const branch of branchesForNode(node)) {
      if (!edges.some((edge) => edgeBranchId(edge) === branch.id)) errors.push({ code: "missing_branch_edge", message: `A saída “${branch.label}” de “${node.label}” não está conectada.`, nodeId: node.id, branchId: branch.id });
    }
    if (node.type === "wait" && node.config.mode === "smart" && node.config.min_ms > node.config.max_ms) {
      errors.push({ code: "invalid_smart_wait", message: `A espera “${node.label}” possui intervalo inválido.`, nodeId: node.id });
    }
    // Em runtime, quem escreve ao cliente sem `agent_id` é o agente de maior
    // prioridade que escuta `cadence.step_due` — em produção o "Organizador de
    // Pipeline", não o SDR. Publicar sem escolher é publicar no escuro.
    if (node.type === "action" && node.config.mode === "ai_message" && !node.config.agent_id) {
      errors.push({ code: "ai_message_sem_agente", message: `A mensagem de IA “${node.label}” precisa de um agente escolhido.`, nodeId: node.id });
    }
    if (node.type === "ai_classify" && node.config.grace_timeout_ms < 900_000) {
      errors.push({ code: "grace_too_short", message: `A classificação “${node.label}” precisa aguardar pelo menos 15 minutos.`, nodeId: node.id });
    }
  }

  if (hasCycle(trigger.id, outgoing)) errors.push({ code: "cycle", message: "O fluxo possui ciclo; ciclos não podem ser publicados." });
  if (reachable.size > 30) errors.push({ code: "max_steps_exceeded", message: "O fluxo ultrapassa o limite de 30 nós alcançáveis." });

  return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
}
