"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Background, BackgroundVariant, BaseEdge, Controls, EdgeLabelRenderer, Handle, MiniMap, Position,
  ReactFlow, ReactFlowProvider, getBezierPath, type Connection, type Edge, type EdgeProps, type Node,
  type NodeChange, type EdgeChange,
} from "@xyflow/react";
import { Check, Clock, GitBranch, MessageCircle, Plus, Rocket, Sparkles, Square, Trash2, X } from "lucide-react";
import { branchesForNode, edgeBranchId, type FollowupEdge, type FollowupGraph, type FollowupNode, type FollowupNodeType } from "@/lib/ai-platform/followup/graph";
import "@xyflow/react/dist/style.css";

type DadosNo = { no: FollowupNode; selecionado: boolean; somenteLeitura: boolean; aoSelecionar: () => void };
type DadosAresta = { label: string; aoRemover: () => void; somenteLeitura: boolean };
type NoRF = Node<DadosNo, "cadencia-no">;
type ArestaRF = Edge<DadosAresta, "cadencia-aresta">;

const META: Record<FollowupNodeType, { titulo: string; categoria: string; Icon: typeof Rocket }> = {
  trigger: { titulo: "Gatilho", categoria: "Quando", Icon: Rocket },
  wait: { titulo: "Aguardar", categoria: "Tempo", Icon: Clock },
  condition: { titulo: "Condição", categoria: "Lógica", Icon: GitBranch },
  ai_classify: { titulo: "Classificar resposta", categoria: "IA", Icon: Sparkles },
  action: { titulo: "Ação", categoria: "Plataforma", Icon: MessageCircle },
  end: { titulo: "Fim", categoria: "Encerramento", Icon: Square },
};

function resumo(no: FollowupNode): string {
  if (no.type === "trigger") return no.config.event;
  if (no.type === "wait") return no.config.mode === "fixed" ? no.config.duration_ms < 60000 ? `${Math.round(no.config.duration_ms / 1000)} segundos` : `${Math.round(no.config.duration_ms / 60000)} min` : "intervalo inteligente";
  if (no.type === "condition") return `${no.config.checks.length} regra(s) · ${no.config.combinator.toUpperCase()}`;
  if (no.type === "ai_classify") return `${no.config.classes.length} classe(s)`;
  if (no.type === "end") return no.config.outcome;
  if (no.config.mode === "whatsapp") return no.config.message;
  if (no.config.mode === "email") return no.config.subject;
  if (no.config.mode === "ai_message") return no.config.prompt_hint;
  return no.config.mode.replaceAll("_", " ");
}

function conditionFor(node: FollowupNode, branchId: string): FollowupEdge["condition"] {
  if (branchId === "else") return { type: "always" };
  if (node.type === "condition") return node.config.branching === "per_check"
    ? { type: "branch", branch_id: branchId }
    : { type: "cond_result", value: branchId === "true" };
  if (node.type === "ai_classify") return branchId === "no_reply" ? { type: "branch", branch_id: branchId } : { type: "class_match", value: branchId };
  return { type: "always" };
}

function NoCadencia({ data }: { data: DadosNo }) {
  const { no, selecionado, somenteLeitura, aoSelecionar } = data;
  const meta = META[no.type];
  const Icon = meta.Icon;
  const branches = branchesForNode(no);
  return <div className="ofc-rf-no" data-tipo={no.type} data-selecionado={selecionado ? "true" : undefined} onClick={aoSelecionar}>
    {no.type !== "trigger" && <Handle type="target" position={Position.Left} className="ofc-rf-porta" isConnectable={!somenteLeitura} />}
    <div className="ofc-rf-cab"><span className="ofc-rf-icone"><Icon size={14} /></span><span>{meta.categoria}</span><small>{no.id}</small></div>
    <strong>{no.label}</strong><p>{resumo(no)}</p>
    {branches.length > 0 && <ul className="ofc-rf-saidas">{branches.map((branch, i) => <li key={branch.id}><span>{branch.label}</span><Handle type="source" position={Position.Right} id={branch.id} className="ofc-rf-porta" style={{ top: `${54 + i * 28}px` }} isConnectable={!somenteLeitura} /></li>)}</ul>}
  </div>;
}

function ArestaCadencia({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<ArestaRF>) {
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return <><BaseEdge id={id} path={path} markerEnd={markerEnd} className="ofc-rf-aresta" interactionWidth={18} />
    {data?.label && <EdgeLabelRenderer><span className="ofc-rf-label" style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)` }}>{data.label}{!data.somenteLeitura && <button type="button" onClick={data.aoRemover} aria-label={`Remover saída ${data.label}`}><X size={11} /></button>}</span></EdgeLabelRenderer>}
  </>;
}

function novoNo(type: FollowupNodeType, position: { x: number; y: number }): FollowupNode {
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
  if (type === "wait") return { id, type, label: "Aguardar", position, config: { mode: "fixed", duration_ms: 60_000 } };
  if (type === "condition") return { id, type, label: "Verificar condição", position, config: { combinator: "and", branching: "combined", checks: [{ field: "status", op: "eq", value: "" }] } };
  if (type === "ai_classify") return { id, type, label: "Classificar resposta", position, config: { classes: [{ id: "positivo", label: "Positivo" }, { id: "negativo", label: "Negativo" }], grace_timeout_ms: 86_400_000, target: "last_reply" } };
  if (type === "action") return { id, type, label: "Enviar WhatsApp", position, config: { mode: "whatsapp", message: "Oi {{primeiro_nome}}, tudo bem?" } };
  if (type === "end") return { id, type, label: "Fim do fluxo", position, config: { outcome: "exhausted" } };
  return { id, type: "trigger", label: "Início do fluxo", position, config: { event: "manual", filters: {} } };
}

export function FollowupCanvas({ graph, selectedId, somenteLeitura, onChange, onSelect }: { graph: FollowupGraph; selectedId: string | null; somenteLeitura: boolean; onChange: (graph: FollowupGraph) => void; onSelect: (id: string | null) => void }) {
  const [dragging, setDragging] = useState(false);
  const graphRef = useRef(graph); graphRef.current = graph;
  const nodes = useMemo<NoRF[]>(() => graph.nodes.map((no) => ({ id: no.id, type: "cadencia-no", position: no.position, data: { no, selecionado: no.id === selectedId, somenteLeitura, aoSelecionar: () => onSelect(no.id) }, deletable: !somenteLeitura && no.type !== "trigger" })), [graph.nodes, selectedId, somenteLeitura, onSelect]);
  const edges = useMemo<ArestaRF[]>(() => graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edgeBranchId(edge), type: "cadencia-aresta", data: { label: branchesForNode(graph.nodes.find((n) => n.id === edge.source)!).find((b) => b.id === edgeBranchId(edge))?.label ?? edgeBranchId(edge), somenteLeitura, aoRemover: () => onChange({ ...graph, edges: graph.edges.filter((e) => e.id !== edge.id) }) } })), [graph, somenteLeitura, onChange]);

  const add = useCallback((type: FollowupNodeType) => { if (somenteLeitura || type === "trigger") return; const y = Math.max(...graphRef.current.nodes.map((n) => n.position.y), 80) + 180; onChange({ ...graphRef.current, nodes: [...graphRef.current.nodes, novoNo(type, { x: 420, y })] }); }, [onChange, somenteLeitura]);
  const onNodesChange = useCallback((changes: NodeChange<NoRF>[]) => { const next = graphRef.current.nodes.map((node) => { const c = changes.find((x) => "id" in x && x.id === node.id); return c?.type === "position" && c.position ? { ...node, position: c.position } : node; }); const selected = changes.find((x) => x.type === "select"); if (selected && "id" in selected) onSelect(selected.selected ? selected.id : null); if (changes.some((c) => c.type === "position") && !somenteLeitura) onChange({ ...graphRef.current, nodes: next }); }, [onChange, onSelect, somenteLeitura]);
  const onEdgesChange = useCallback((changes: EdgeChange<ArestaRF>[]) => { if (!somenteLeitura && changes.some((c) => c.type === "remove")) onChange({ ...graphRef.current, edges: graphRef.current.edges.filter((e) => !changes.some((c) => c.type === "remove" && c.id === e.id)) }); }, [onChange, somenteLeitura]);
  const onConnect = useCallback((connection: Connection) => { if (somenteLeitura || !connection.source || !connection.target || !connection.sourceHandle || connection.source === connection.target) return; const source = graphRef.current.nodes.find((n) => n.id === connection.source); if (!source) return; const edge: FollowupEdge = { id: `${connection.source}-${connection.sourceHandle}-${connection.target}`, source: connection.source, target: connection.target, priority: 0, condition: conditionFor(source, connection.sourceHandle) }; onChange({ ...graphRef.current, edges: [...graphRef.current.edges.filter((e) => !(e.source === edge.source && edgeBranchId(e) === connection.sourceHandle)), edge] }); }, [onChange, somenteLeitura]);
  const onDelete = useCallback(({ nodes: ns, edges: es }: { nodes: NoRF[]; edges: ArestaRF[] }) => { if (somenteLeitura) return; const ids = new Set(ns.map((n) => n.id)); onChange({ ...graphRef.current, nodes: graphRef.current.nodes.filter((n) => !ids.has(n.id)), edges: graphRef.current.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target) && !es.some((x) => x.id === e.id)) }); onSelect(null); }, [onChange, onSelect, somenteLeitura]);
  const onDrop = (event: DragEvent) => { event.preventDefault(); const type = event.dataTransfer.getData("application/x-onface-cadencia-no") as FollowupNodeType; if (type) add(type); setDragging(false); };
  return <div className="ofc-rf-wrap" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
    <div className="ofc-rf-toolbar" role="toolbar" aria-label="Adicionar passo">{(["wait", "action", "condition", "ai_classify", "end"] as FollowupNodeType[]).map((type) => <button key={type} type="button" draggable={!somenteLeitura} disabled={somenteLeitura} onDragStart={(e) => e.dataTransfer.setData("application/x-onface-cadencia-no", type)} onClick={() => add(type)}><Plus size={12} /> {META[type].titulo}</button>)}</div>
    <div className={`ofc-rf-canvas${dragging ? " ofc-rf-drop" : ""}`} aria-label="Fluxo visual ramificado"><ReactFlowProvider><ReactFlow<NoRF, ArestaRF> nodes={nodes} edges={edges} nodeTypes={{ "cadencia-no": NoCadencia }} edgeTypes={{ "cadencia-aresta": ArestaCadencia }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onDelete={onDelete} onPaneClick={() => onSelect(null)} nodesDraggable={!somenteLeitura} nodesConnectable={!somenteLeitura} deleteKeyCode={somenteLeitura ? null : ["Delete", "Backspace"]} fitView minZoom={0.2} maxZoom={1.8} snapToGrid snapGrid={[16, 16]} proOptions={{ hideAttribution: true }}><Background variant={BackgroundVariant.Dots} gap={16} size={1.2} /><Controls showInteractive={false} /><MiniMap nodeClassName={(n) => `ofc-rf-mini ofc-rf-mini-${(n as NoRF).data.no.type}`} /></ReactFlow></ReactFlowProvider></div>
  </div>;
}
