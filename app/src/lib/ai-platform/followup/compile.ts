import type { Condicao } from "@/lib/crm/condicao";
import type { CadenceStep, CadenceStepBranch } from "@/lib/cadencia/cadence-engine";
import { edgeBranchId, type FollowupEdge, type FollowupGraph, type FollowupNode } from "./graph";

function conditionForBranch(node: FollowupNode, branchId: string): Condicao | null {
  if (branchId === "else") return null;
  if (node.type === "condition") {
    if (node.config.branching === "per_check") {
      const check = node.config.checks.find((item) => item.id === branchId);
      if (!check) return { campo: "__never", operador: "igual", valor: true };
      const operator = { eq: "igual", neq: "diferente", gte: "maior_igual", lte: "menor_igual", contains: "contem" }[check.op];
      return { campo: check.field, operador: operator, valor: check.value } as Condicao;
    }
    return { campo: `condition.${node.id}`, operador: "igual", valor: branchId === "true" };
  }
  if (node.type === "ai_classify") return { campo: `classification.${node.id}`, operador: "igual", valor: branchId } as Condicao;
  return null;
}

function branchesFor(node: FollowupNode, edges: FollowupEdge[]): CadenceStepBranch[] {
  return edges
    .filter((edge) => edge.source === node.id)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .map((edge) => ({ condicao: conditionForBranch(node, edgeBranchId(edge)), proximoStepId: edge.target }));
}

function topological(graph: FollowupGraph): FollowupNode[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  const queue = graph.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
  const result: FollowupNode[] = [];
  while (queue.length) {
    const node = queue.shift()!;
    result.push(node);
    for (const edge of graph.edges.filter((item) => item.source === node.id)) {
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) - 1);
      if (indegree.get(edge.target) === 0) queue.push(byId.get(edge.target)!);
    }
    queue.sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
  }
  return result;
}

export function compileFollowupGraph(graph: FollowupGraph): CadenceStep[] {
  return topological(graph).filter((node) => node.type !== "trigger").map((node): CadenceStep => {
    const branches = branchesFor(node, graph.edges).map((branch) => node.type === "end" ? { ...branch, proximoStepId: null } : branch);
    if (node.type === "wait") return { id: node.id, tipo: "wait", esperaMinutos: (node.config.mode === "fixed" ? node.config.duration_ms : node.config.max_ms) / 60_000, esperaMilissegundos: (node.config.mode === "fixed" ? node.config.duration_ms : node.config.max_ms), config: node.config, branches };
    if (node.type === "condition") return { id: node.id, tipo: "condition", config: node.config, branches };
    if (node.type === "ai_classify") return { id: node.id, tipo: "action", adapter: "ai_classify", config: node.config, retry: { maxTentativas: 3, backoffMinutos: [1, 5, 15] }, branches };
    if (node.type === "action") {
      const adapter = node.config.mode === "ai_message" ? "ai_agent_message"
        : node.config.mode === "template" ? "whatsapp_template"
        : node.config.mode === "email" ? "email"
        : node.config.mode === "whatsapp" ? "whatsapp"
        : `crm_${node.config.mode}`;
      // Os adapters de texto livre leem `mensagem` (e o e-mail, `assunto`):
      // é o nome que o motor usa desde a cadência legada, não o do grafo.
      const config = node.config.mode === "email"
        ? { assunto: node.config.subject, mensagem: node.config.message }
        : node.config.mode === "whatsapp"
        ? { mensagem: node.config.message, sessao_id: node.config.sessao_id }
        : node.config;
      return { id: node.id, tipo: "action", adapter, config, retry: { maxTentativas: 3, backoffMinutos: [1, 5, 15] }, branches };
    }
    return { id: node.id, tipo: "action", adapter: "noop", config: node.config, branches: [{ condicao: null, proximoStepId: null }] };
  });
}
