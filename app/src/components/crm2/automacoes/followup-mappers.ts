import type { Node, Edge } from "@xyflow/react";
import { branchesForNode, edgeBranchId, type FollowupEdge, type FollowupGraph, type FollowupNode, type FollowupNodeType } from "./followup-types";

/**
 * FollowupGraph ⇄ React Flow node/edge arrays. Pure, sem I/O. Modelo espelha
 * `lib/followup/graph-mappers.ts` do Deskcomm (referência) — React Flow é
 * DONO do array de nodes/edges durante a edição (via `useNodesState`/
 * `useEdgesState`); o grafo de domínio só é lido nas bordas (seed inicial,
 * salvar, validar). Recalcular o array inteiro a cada render a partir do
 * grafo (como numa versão anterior deste arquivo) perde o estado interno de
 * medição/drag do React Flow e é por isso que nada arrastava.
 */

export type RFNodeData = { label: string; config: FollowupNode["config"]; errors?: string[] };
export type RFNode = Node<RFNodeData, FollowupNodeType>;
export type RFEdgeData = { priority: number; condition: FollowupEdge["condition"] };
export type RFEdge = Edge<RFEdgeData>;

export function toReactFlow(graph: FollowupGraph): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = graph.nodes.map((n) => ({
    id: n.id, type: n.type, position: { x: n.position.x, y: n.position.y }, data: { label: n.label, config: n.config },
  }));
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const edges: RFEdge[] = graph.edges.map((e) => {
    const source = nodesById.get(e.source);
    const branches = source ? branchesForNode(source) : [];
    const branchId = edgeBranchId(e);
    return {
      id: e.id, source: e.source, target: e.target,
      ...(branches.length > 1 ? { sourceHandle: branchId } : {}),
      data: { priority: e.priority, condition: e.condition },
    };
  });
  return { nodes, edges };
}

export function toFollowupNode(n: RFNode): FollowupNode {
  return { id: n.id, type: n.type as FollowupNodeType, label: n.data.label, position: { x: n.position.x, y: n.position.y }, config: n.data.config } as FollowupNode;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export function graphsEqual(a: FollowupGraph, b: FollowupGraph): boolean {
  return stableStringify(a) === stableStringify(b);
}

export function fromReactFlow(nodes: RFNode[], edges: RFEdge[]): FollowupGraph {
  return {
    schema_version: 2,
    nodes: nodes.map(toFollowupNode),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, priority: e.data?.priority ?? 0, condition: e.data?.condition ?? { type: "always" } })),
  };
}
