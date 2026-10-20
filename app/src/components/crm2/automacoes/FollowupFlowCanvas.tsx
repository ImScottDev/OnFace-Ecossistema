"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Connection, type EdgeMouseHandler, type NodeMouseHandler, type NodeProps, type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertTriangle, Brain, Clock, Flag, GitBranch, PlayCircle, Send, Trash2 } from "lucide-react";
import {
  branchesForNode, conditionForBranch, defaultConfigFor, makeNode, nodeSubtitle, priorityForBranch,
  NODE_TYPE_META, EVENT_CATALOG, AVISO_GATILHO_INVALIDO, eventoDeCadenciaInvalido, uid,
  type FollowupNode, type FollowupNodeType,
} from "./followup-types";
import { toReactFlow, toFollowupNode, fromReactFlow, graphsEqual, type RFNode, type RFEdge, type RFNodeData } from "./followup-mappers";
import type { FollowupGraph } from "@/lib/ai-platform/followup/graph";
import type { FollowupValidationResult } from "@/lib/ai-platform/followup/validate";

const DND_MIME = "application/x-followup-node-type";

function NodeIcon({ type }: { type: FollowupNodeType }) {
  const cls = "size-4";
  if (type === "trigger") return <PlayCircle className={cls} />;
  if (type === "wait") return <Clock className={cls} />;
  if (type === "condition") return <GitBranch className={cls} />;
  if (type === "ai_classify") return <Brain className={cls} />;
  if (type === "end") return <Flag className={cls} />;
  return <Send className={cls} />;
}

/** Card compartilhado pelos 6 tipos — 1 handle por branch quando há mais de uma saída (cada linha com seu próprio conector), senão 1 handle único embaixo. Registrado sob as 6 chaves de `nodeTypes`, mesma instância. */
function FlowNodeRenderer({ id, type, data, selected }: NodeProps<RFNode>) {
  const nodeType = type as FollowupNodeType;
  const meta = NODE_TYPE_META[nodeType];
  const followupNode = useMemo(() => toFollowupNode({ id, type: nodeType, position: { x: 0, y: 0 }, data } as RFNode), [id, nodeType, data]);
  const branches = branchesForNode(followupNode);
  const hasError = (data.errors?.length ?? 0) > 0;
  const branchRows = branches.length > 1 ? branches : null;
  return (
    <div className="w-60 rounded-md border border-l-4 border-[#3b3a34] bg-[#22221d] text-[#eeeeea] shadow-[0_8px_22px_rgba(0,0,0,.22)]" style={{ borderLeftColor: meta.color, outline: selected ? "2px solid #aaff00" : hasError ? "2px solid #e17a6e" : "none" }}>
      {nodeType !== "trigger" ? <Handle type="target" position={Position.Top} className="!size-2 !border-2 !border-[#d8d8d0] !bg-[#1e1e19]" /> : null}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${meta.color}2b`, color: meta.color }}><NodeIcon type={nodeType} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{data.label}</p>
          <p className="truncate text-[11px] text-[#9d9c91]">{nodeSubtitle(followupNode)}</p>
        </div>
        {hasError ? <AlertTriangle className="size-3.5 shrink-0 text-[#e17a6e]" /> : null}
      </div>
      {hasError ? <p className="border-t border-[#e17a6e]/30 px-3 py-1.5 text-[10px] leading-snug text-[#e0a89e]">{data.errors![0]}</p> : null}
      {branchRows ? (
        <ul className="border-t border-[#3b3a34]">
          {branchRows.map((branch) => (
            <li key={branch.id} className="relative flex items-center gap-1.5 border-t border-[#3b3a34]/60 px-3 py-1.5 first:border-t-0" title={branch.label}>
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: branch.kind === "fallback" ? "#6b6a61" : meta.color }} />
              <span className={`truncate text-[11px] leading-tight ${branch.kind === "fallback" ? "italic text-[#9d9c91]" : ""}`}>{branch.label}</span>
              <Handle type="source" id={branch.id} position={Position.Right} style={{ top: "50%" }} className="!size-2 !border-2 !border-[#d8d8d0] !bg-[#1e1e19]" />
            </li>
          ))}
        </ul>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!size-2 !border-2 !border-[#d8d8d0] !bg-[#1e1e19]" />
      )}
    </div>
  );
}
const nodeTypes: NodeTypes = { trigger: FlowNodeRenderer, wait: FlowNodeRenderer, condition: FlowNodeRenderer, ai_classify: FlowNodeRenderer, action: FlowNodeRenderer, end: FlowNodeRenderer };

interface Props {
  graph: FollowupGraph;
  onGraphChange: (graph: FollowupGraph) => void;
  validation: FollowupValidationResult | null;
}
export function FollowupFlowCanvas(props: Props) {
  return <ReactFlowProvider><FlowCanvasInner {...props} /></ReactFlowProvider>;
}

async function requestJson(url: string) { const r = await fetch(url); if (!r.ok) return null; return r.json(); }

function FlowCanvasInner({ graph: initialGraph, onGraphChange, validation }: Props) {
  // Semeia o estado do React Flow UMA VEZ na montagem — não reage a mudanças
  // subsequentes de `graph` (que é o próprio grafo que ESTE componente emite
  // pra cima a cada edição). React Flow é dono de `nodes`/`edges` durante a
  // edição; recalcular o array inteiro a cada render a partir do grafo perde
  // o estado interno de medição/drag e é a causa de nó não aparecer/arrastar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => toReactFlow(initialGraph), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>(initial.edges);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const emittedOnce = useRef(false);

  const agentsQuery = useQuery<{ agentes: Array<{ id: string; nome: string; status: string }> }>({ queryKey: ["cf2-followup-agents"], queryFn: () => requestJson("/api/automacoes/agentes") });
  const templatesQuery = useQuery<{ templates: Array<{ id: string; nome: string; categoria: string; ativo: boolean }> }>({ queryKey: ["cf2-followup-templates"], queryFn: () => requestJson("/api/whatsapp/templates") });
  const labelsQuery = useQuery<Array<{ id: string; nome: string; cor: string }>>({ queryKey: ["cf2-followup-labels"], queryFn: () => requestJson("/api/labels") });
  const publishedAgents = (agentsQuery.data?.agentes ?? []).filter((a) => a.status === "published");
  const templates = (templatesQuery.data?.templates ?? []).filter((t) => t.ativo);
  const labels = labelsQuery.data ?? [];

  // Emite o grafo de domínio pra cima a cada mudança real de nodes/edges (não
  // a cada render) — o pai usa isso pra validar e salvar; nunca alimenta de
  // volta no canvas (só via a chave `key` do Editor, ao trocar de fluxo).
  const liveGraphRef = useRef(fromReactFlow(nodes, edges));
  useEffect(() => {
    const next = fromReactFlow(nodes, edges);
    if (!emittedOnce.current) { emittedOnce.current = true; liveGraphRef.current = next; return; }
    if (graphsEqual(next, liveGraphRef.current)) return;
    liveGraphRef.current = next;
    onGraphChange(next);
  }, [nodes, edges, onGraphChange]);

  const invalidNodeIds = useMemo(() => new Set(validation && !validation.ok ? validation.errors.filter((e) => e.nodeId).map((e) => e.nodeId!) : []), [validation]);
  const nodesForRender = useMemo(() => nodes.map((n) => {
    const errors = invalidNodeIds.has(n.id) ? (validation && !validation.ok ? validation.errors.filter((e) => e.nodeId === n.id).map((e) => e.message) : undefined) : undefined;
    return { ...n, deletable: n.type !== "trigger", selected: n.id === selectedNodeId, data: { ...n.data, errors } };
  }), [nodes, invalidNodeIds, validation, selectedNodeId]);
  const edgesForRender = useMemo(() => edges.map((e) => {
    const source = nodes.find((n) => n.id === e.source);
    const branch = source ? branchesForNode(toFollowupNode(source)).find((b) => b.id === (e.sourceHandle ?? "else")) : undefined;
    return { ...e, type: "smoothstep", label: branch?.label ?? "Sempre", selected: e.id === selectedEdgeId, labelStyle: { fill: "#e8e7df", fontSize: 11 }, labelBgStyle: { fill: "#2a2a24", fillOpacity: 1 }, labelBgPadding: [5, 3] as [number, number], style: { stroke: e.id === selectedEdgeId ? "#aaff00" : "#8f8d80", strokeWidth: 1.4 } };
  }), [edges, nodes, selectedEdgeId]);

  const onNodeClick = useCallback<NodeMouseHandler<RFNode>>((_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }, []);
  const onEdgeClick = useCallback<EdgeMouseHandler<RFEdge>>((_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }, []);
  const onPaneClick = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); }, []);

  const updateNodeData = useCallback((id: string, patch: Partial<RFNodeData>) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [setNodes]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const sourceNode = nodes.find((n) => n.id === connection.source);
    if (!sourceNode) return;
    const flowSource = toFollowupNode(sourceNode);
    const branchId = connection.sourceHandle ?? "else";
    const branch = branchesForNode(flowSource).find((b) => b.id === branchId);
    const condition = conditionForBranch(flowSource, branchId);
    const priority = branch ? priorityForBranch(branch) : -1;
    const newEdge: RFEdge = {
      id: uid("edge"), source: connection.source, target: connection.target,
      ...(connection.sourceHandle ? { sourceHandle: connection.sourceHandle } : {}),
      data: { priority, condition },
    };
    setEdges((eds) => [...eds.filter((e) => !(e.source === connection.source && e.sourceHandle === connection.sourceHandle)), newEdge]);
  }, [nodes, setEdges]);

  const addNodeAt = useCallback((type: FollowupNodeType, position: { x: number; y: number }) => {
    const node = makeNode(type, position);
    setNodes((nds) => nds.concat({ id: node.id, type: node.type, position: node.position, data: { label: node.label, config: node.config } }));
  }, [setNodes]);
  const onPaletteAdd = useCallback((type: FollowupNodeType) => {
    const index = nodes.length;
    addNodeAt(type, { x: 60 + (index % 4) * 250, y: 260 + Math.floor(index / 4) * 170 });
  }, [nodes.length, addNodeAt]);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData(DND_MIME) as FollowupNodeType | "";
    if (!type) return;
    addNodeAt(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [screenToFlowPosition, addNodeAt]);

  const removeSelected = () => {
    if (selectedNodeId) { setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId)); setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)); setSelectedNodeId(null); }
    else if (selectedEdgeId) { setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId)); setSelectedEdgeId(null); }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const selectedFollowupNode = selectedNode ? toFollowupNode(selectedNode) : null;
  const errorsForSelected = selectedNode && validation && !validation.ok ? validation.errors.filter((e) => e.nodeId === selectedNode.id) : [];

  return (
    <div className="flex h-full min-h-[600px] overflow-hidden rounded-xl border border-[#393831] bg-[#171714]">
      <aside className="flex w-56 shrink-0 flex-col gap-2 border-r border-[#393831] bg-[#20201b] p-3">
        <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#aaa89c]">Adicionar nó</p>
        {(["wait", "condition", "ai_classify", "action", "end"] as FollowupNodeType[]).map((type) => (
          <PaletteButton key={type} type={type} onAdd={() => onPaletteAdd(type)} />
        ))}
        {validation && !validation.ok ? (
          <div className="mt-2 space-y-1.5 rounded-lg border border-[#5d3b31] bg-[#2a1f1c] p-3 text-[11px] leading-5 text-[#e0a89e]">
            <p className="flex items-center gap-1.5 font-semibold text-[#e17a6e]"><AlertTriangle className="size-3.5" />{validation.errors.length} pendência(s)</p>
            <ul className="space-y-1">{validation.errors.slice(0, 6).map((error, i) => <li key={i} onClick={() => error.nodeId && setSelectedNodeId(error.nodeId)} className={error.nodeId ? "cursor-pointer underline-offset-2 hover:underline" : ""}>{error.message}</li>)}</ul>
          </div>
        ) : null}
        <div className="mt-auto rounded-lg border border-[#393831] bg-[#191914] p-3 text-[11px] leading-5 text-[#98978d]">Arraste um nó pro canvas, ou clique. Arraste de uma saída até o próximo nó pra conectar.</div>
      </aside>
      <section className="relative min-w-0 flex-1" data-testid="flow-canvas" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodesForRender} edges={edgesForRender} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView fitViewOptions={{ padding: 0.3 }} proOptions={{ hideAttribution: true }}
        >
          <Background color="#55564f" gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </section>
      {selectedFollowupNode ? (
        <aside className="w-[380px] shrink-0 overflow-y-auto border-l border-[#393831] bg-[#20201b] p-5">
          <NodeInspector node={selectedFollowupNode} onLabel={(v) => updateNodeData(selectedFollowupNode.id, { label: v })} onConfig={(c) => updateNodeData(selectedFollowupNode.id, { config: c })} onRemove={selectedFollowupNode.type !== "trigger" ? removeSelected : undefined} errors={errorsForSelected} agents={publishedAgents} templates={templates} labels={labels} />
        </aside>
      ) : selectedEdge ? (
        <aside className="w-[380px] shrink-0 overflow-y-auto border-l border-[#393831] bg-[#20201b] p-5">
          <div className="space-y-4">
            <PanelTitle icon={() => <GitBranch className="size-4" />} color="#8f8d80" title="Conexão" description="Liga uma saída de um nó ao próximo nó do fluxo." />
            <button onClick={removeSelected} className="flex items-center gap-2 text-[12px] font-semibold text-[#e17a6e]"><Trash2 className="size-3.5" />Remover conexão</button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function PaletteButton({ type, onAdd }: { type: FollowupNodeType; onAdd: () => void }) {
  const meta = NODE_TYPE_META[type];
  return (
    <button
      type="button" draggable onDragStart={(e) => { e.dataTransfer.setData(DND_MIME, type); e.dataTransfer.effectAllowed = "move"; }} onClick={onAdd}
      className="flex items-center gap-2 rounded-lg border border-[#3b3a34] bg-[#292923] px-3 py-2.5 text-left text-[13px] font-medium text-[#e8e7df] hover:bg-[#303029]"
    >
      <span className="flex size-6 items-center justify-center rounded-full" style={{ background: `${meta.color}25`, color: meta.color }}><NodeIcon type={type} /></span>{meta.label}
    </button>
  );
}
function PanelTitle({ icon: Icon, color, title, description }: { icon: React.ComponentType<{ className?: string }>; color: string; title: string; description: string }) {
  return <div><h2 className="flex items-center gap-2 text-[18px] font-semibold text-[#eeeeea]"><span className="flex size-8 items-center justify-center rounded-full" style={{ background: `${color}25`, color }}><Icon className="size-4" /></span>{title}</h2><p className="mt-2 text-[12px] leading-5 text-[#a5a399]">{description}</p></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[#d5d4cc]">{label}{children}</label>; }
const input = "rounded-lg border border-[#3c3b34] bg-[#1b1b17] px-3 py-2.5 text-[13px] text-[#e8e7df] outline-none focus:border-[#aaff00]";

function NodeInspector({ node, onLabel, onConfig, onRemove, errors, agents, templates, labels }: {
  node: FollowupNode; onLabel: (v: string) => void; onConfig: (c: FollowupNode["config"]) => void; onRemove?: () => void;
  errors: { message: string }[]; agents: Array<{ id: string; nome: string }>; templates: Array<{ id: string; nome: string; categoria: string }>;
  labels: Array<{ id: string; nome: string; cor: string }>;
}) {
  const meta = NODE_TYPE_META[node.type];
  return (
    <div className="space-y-5">
      <PanelTitle icon={() => <NodeIcon type={node.type} />} color={meta.color} title={meta.label} description="Alterações ficam no rascunho até salvar e publicar." />
      {errors.length ? <div className="space-y-1 rounded-lg border border-[#5d3b31] bg-[#2a1f1c] p-3 text-[11px] leading-5 text-[#e0a89e]">{errors.map((e, i) => <p key={i}>{e.message}</p>)}</div> : null}
      <Field label="Rótulo"><input className={input} value={node.label} onChange={(e) => onLabel(e.target.value)} /></Field>
      {node.type === "trigger" ? <TriggerFields node={node} onConfig={onConfig} /> : null}
      {node.type === "wait" ? <WaitFields node={node} onConfig={onConfig} /> : null}
      {node.type === "condition" ? <ConditionFields node={node} onConfig={onConfig} /> : null}
      {node.type === "ai_classify" ? <ClassifyFields node={node} onConfig={onConfig} agents={agents} /> : null}
      {node.type === "action" ? <ActionFields node={node} onConfig={onConfig} agents={agents} templates={templates} labels={labels} /> : null}
      {node.type === "end" ? <EndFields node={node} onConfig={onConfig} /> : null}
      {onRemove ? <button onClick={onRemove} className="flex items-center gap-2 border-t border-[#393831] pt-4 text-[12px] font-semibold text-[#e17a6e]"><Trash2 className="size-3.5" />Remover nó</button> : null}
    </div>
  );
}

function TriggerFields({ node, onConfig }: { node: Extract<FollowupNode, { type: "trigger" }>; onConfig: (c: FollowupNode["config"]) => void }) {
  return <>
    <Field label="Evento de entrada">
      <select className={input} value={node.config.event} onChange={(e) => onConfig({ ...node.config, event: e.target.value })}>
        {/* Gatilho salvo que não chega mais fica marcado em vez de o select
            pular calado para o primeiro item da lista. */}
        {eventoDeCadenciaInvalido(node.config.event) && <option value={node.config.event}>{node.config.event} · gatilho inválido</option>}
        {EVENT_CATALOG.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
      </select>
    </Field>
    {eventoDeCadenciaInvalido(node.config.event) ? <p className="text-[11px] leading-5 text-[#e0a89e]">{AVISO_GATILHO_INVALIDO}</p> : null}
    <p className="text-[11px] leading-5 text-[#98978d]">Ao publicar, eventos reais do CRM que correspondam a este gatilho criam uma execução idempotente. “Inscrição manual/API” continua disponível para operações iniciadas por uma pessoa.</p>
  </>;
}

function durationParts(ms: number): { value: number; unit: "min" | "h" | "d" } {
  if (ms % 86_400_000 === 0 && ms >= 86_400_000) return { value: ms / 86_400_000, unit: "d" };
  if (ms % 3_600_000 === 0 && ms >= 3_600_000) return { value: ms / 3_600_000, unit: "h" };
  return { value: Math.round(ms / 60_000), unit: "min" };
}
function toMs(value: number, unit: "min" | "h" | "d"): number {
  return value * (unit === "d" ? 86_400_000 : unit === "h" ? 3_600_000 : 60_000);
}
function DurationInput({ ms, onChange, min }: { ms: number; onChange: (ms: number) => void; min?: number }) {
  const parts = durationParts(ms);
  return <div className="flex gap-2">
    <input type="number" min={0} className={input + " flex-1"} value={parts.value} onChange={(e) => onChange(Math.max(min ?? 0, toMs(Number(e.target.value) || 0, parts.unit)))} />
    <select className={input} value={parts.unit} onChange={(e) => onChange(toMs(parts.value, e.target.value as "min" | "h" | "d"))}>
      <option value="min">minutos</option><option value="h">horas</option><option value="d">dias</option>
    </select>
  </div>;
}

function WaitFields({ node, onConfig }: { node: Extract<FollowupNode, { type: "wait" }>; onConfig: (c: FollowupNode["config"]) => void }) {
  const config = node.config;
  const modeSelect = (
    <Field label="Modo">
      <select className={input} value={config.mode} onChange={(e) => onConfig(e.target.value === "fixed" ? { mode: "fixed", duration_ms: 3_600_000 } : { mode: "smart", min_ms: 1_800_000, max_ms: 7_200_000 })}>
        <option value="fixed">Tempo fixo</option>
        <option value="smart">Janela (a IA decide dentro do intervalo)</option>
      </select>
    </Field>
  );
  if (config.mode === "fixed") return <>{modeSelect}<Field label="Esperar por"><DurationInput ms={config.duration_ms} min={300_000} onChange={(ms) => onConfig({ mode: "fixed", duration_ms: ms })} /></Field></>;
  return <>{modeSelect}
    <Field label="Mínimo"><DurationInput ms={config.min_ms} min={300_000} onChange={(ms) => onConfig({ ...config, min_ms: ms })} /></Field>
    <Field label="Máximo"><DurationInput ms={config.max_ms} min={300_000} onChange={(ms) => onConfig({ ...config, max_ms: ms })} /></Field>
    <Field label="Orientação (opcional)"><textarea className={input + " min-h-[72px] resize-none"} value={config.guidance ?? ""} onChange={(e) => onConfig({ ...config, guidance: e.target.value })} placeholder="Ex.: esperar menos se o lead demonstrou urgência." aria-label="Ex.: esperar menos se o lead demonstrou urgência." /></Field>
  </>;
}

const FIELD_OPTIONS = [["lead_stage", "Etapa do lead"], ["tag", "Tag"], ["steps_taken", "Etapas já executadas"], ["last_outcome", "Último resultado"], ["entity_type", "Tipo de entidade"], ["has_replied", "Respondeu"]] as const;
const OP_OPTIONS = [["eq", "é igual a"], ["neq", "é diferente de"], ["gte", "é maior ou igual a"], ["lte", "é menor ou igual a"], ["contains", "contém"]] as const;

function ConditionFields({ node, onConfig }: { node: Extract<FollowupNode, { type: "condition" }>; onConfig: (c: FollowupNode["config"]) => void }) {
  const perCheck = node.config.branching === "per_check";
  const updateCheck = (index: number, patch: Partial<typeof node.config.checks[number]>) => onConfig({ ...node.config, checks: node.config.checks.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  const removeCheck = (index: number) => onConfig({ ...node.config, checks: node.config.checks.filter((_, i) => i !== index) });
  const addCheck = () => onConfig({ ...node.config, checks: [...node.config.checks, { id: uid("regra"), label: `Regra ${node.config.checks.length + 1}`, field: "last_outcome", op: "eq", value: "true" }] });
  return <>
    <Field label="Modo de saída">
      <select className={input} value={node.config.branching} onChange={(e) => onConfig({ ...node.config, branching: e.target.value as "combined" | "per_check" })}>
        <option value="per_check">1 saída por regra</option>
        <option value="combined">1 saída combinada (Sim / Não)</option>
      </select>
    </Field>
    {!perCheck ? <Field label="Combinar regras com"><select className={input} value={node.config.combinator} onChange={(e) => onConfig({ ...node.config, combinator: e.target.value as "and" | "or" })}><option value="and">E (todas precisam bater)</option><option value="or">OU (qualquer uma basta)</option></select></Field> : null}
    <div className="space-y-2 border-t border-[#393831] pt-4">
      <p className="text-[12px] font-semibold text-[#d5d4cc]">Regras</p>
      {node.config.checks.map((check, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-[#3c3b34] bg-[#1b1b17] p-3">
          {perCheck ? <input className={input + " w-full"} value={check.label ?? ""} placeholder="Nome da regra (aparece como saída)" aria-label="Nome da regra (aparece como saída)" onChange={(e) => updateCheck(index, { label: e.target.value })} /> : null}
          <div className="flex gap-2">
            <select className={input + " flex-1"} value={check.field} onChange={(e) => updateCheck(index, { field: e.target.value as typeof check.field })}>{FIELD_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            <select className={input} value={check.op} onChange={(e) => updateCheck(index, { op: e.target.value as typeof check.op })}>{OP_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          </div>
          <input className={input + " w-full"} value={String(check.value)} placeholder="Valor" aria-label="Valor" onChange={(e) => updateCheck(index, { value: e.target.value })} />
          {node.config.checks.length > 1 ? <button onClick={() => removeCheck(index)} className="text-[11px] font-semibold text-[#e17a6e]">Remover regra</button> : null}
        </div>
      ))}
      {node.config.checks.length < 10 ? <button onClick={addCheck} className="text-[12px] font-semibold text-[#aaff00]">+ Adicionar regra</button> : null}
    </div>
  </>;
}

function ClassifyFields({ node, onConfig, agents }: { node: Extract<FollowupNode, { type: "ai_classify" }>; onConfig: (c: FollowupNode["config"]) => void; agents: Array<{ id: string; nome: string }> }) {
  const updateClass = (index: number, patch: Partial<typeof node.config.classes[number]>) => onConfig({ ...node.config, classes: node.config.classes.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  const removeClass = (index: number) => onConfig({ ...node.config, classes: node.config.classes.filter((_, i) => i !== index) });
  const addClass = () => onConfig({ ...node.config, classes: [...node.config.classes, { id: uid("classe"), label: `Classe ${node.config.classes.length + 1}` }] });
  return <>
    <Field label="O que classificar">
      <select className={input} value={node.config.target ?? "last_reply"} onChange={(e) => onConfig({ ...node.config, target: e.target.value as "last_reply" | "summary" })}>
        <option value="last_reply">Última resposta do contato</option>
        <option value="summary">Resumo da conversa (vars.summary)</option>
      </select>
    </Field>
    <Field label="Agente classificador"><select className={input} value={node.config.agent_id ?? ""} onChange={(e) => onConfig({ ...node.config, agent_id: e.target.value || undefined })}><option value="">Selecione um agente publicado</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
    <Field label="Aguardar resposta por até"><DurationInput ms={node.config.grace_timeout_ms} min={900_000} onChange={(ms) => onConfig({ ...node.config, grace_timeout_ms: ms })} /></Field>
    <Field label="Contexto para o classificador (opcional)"><textarea className={input + " min-h-[72px] resize-none"} value={node.config.hint ?? ""} onChange={(e) => onConfig({ ...node.config, hint: e.target.value })} /></Field>
    <div className="space-y-2 border-t border-[#393831] pt-4">
      <p className="text-[12px] font-semibold text-[#d5d4cc]">Classes (cada uma é uma saída)</p>
      {node.config.classes.map((cls, index) => (
        <div key={index} className="flex gap-2">
          <input className={input + " flex-1"} value={cls.label} placeholder="Rótulo" aria-label="Rótulo" onChange={(e) => updateClass(index, { label: e.target.value })} />
          {node.config.classes.length > 1 ? <button onClick={() => removeClass(index)} className="rounded-lg px-2 text-[11px] font-semibold text-[#e17a6e]">Remover</button> : null}
        </div>
      ))}
      {node.config.classes.length < 8 ? <button onClick={addClass} className="text-[12px] font-semibold text-[#aaff00]">+ Adicionar classe</button> : null}
      <p className="text-[11px] leading-5 text-[#98978d]">Toda classe, mais “sem resposta” e “caso contrário”, aparece como saída no nó.</p>
    </div>
  </>;
}

function ActionFields({ node, onConfig, agents, templates, labels }: { node: Extract<FollowupNode, { type: "action" }>; onConfig: (c: FollowupNode["config"]) => void; agents: Array<{ id: string; nome: string }>; templates: Array<{ id: string; nome: string; categoria: string }>; labels: Array<{ id: string; nome: string; cor: string }> }) {
  const config = node.config;
  const configForMode = (mode: string): typeof node.config => {
    if (mode === "ai_message") return defaultConfigFor("action") as typeof node.config;
    if (mode === "template") return { mode, template_id: templates[0]?.id ?? "" };
    if (mode === "create_task") return { mode, title: "Entrar em contato", priority: "media", due_minutes: 1440 };
    if (mode === "add_tag" || mode === "remove_tag") return { mode, label_id: labels[0]?.id ?? "" };
    if (mode === "update_stage") return { mode, stage: "em_contato" };
    if (mode === "assign_owner") return { mode, owner_id: "" };
    if (mode === "add_note") return { mode, title: "Registro da automação" };
    if (mode === "email") return { mode, subject: "Callface", message: "" };
    if (mode === "callface_call") return { mode };
    return { mode: "callface_call" };
  };
  const modeSelect = (
    <Field label="Tipo de ação">
      <select className={input} value={config.mode} onChange={(e) => onConfig(configForMode(e.target.value))}>
        <option value="ai_message">Mensagem gerada por IA</option>
        <option value="template">Template WhatsApp</option>
        <option value="create_task">Criar tarefa</option>
        <option value="add_tag">Adicionar tag</option>
        <option value="remove_tag">Remover tag</option>
        <option value="update_stage">Atualizar etapa/status</option>
        <option value="assign_owner">Atribuir responsável</option>
        <option value="add_note">Registrar nota na timeline</option>
        <option value="email">Enviar e-mail</option>
        <option value="callface_call">Iniciar ligação Callface AI</option>
      </select>
    </Field>
  );
  if (config.mode === "ai_message") return <>{modeSelect}
    <Field label="Orientação para a IA"><textarea className={input + " min-h-[96px] resize-none"} value={config.prompt_hint} onChange={(e) => onConfig({ ...config, prompt_hint: e.target.value })} /></Field>
    <Field label="Agente (opcional — vazio usa o agente publicado elegível)"><select className={input} value={config.agent_id ?? ""} onChange={(e) => onConfig({ ...config, agent_id: e.target.value || undefined })}><option value="">Automático</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></Field>
    <Field label="Template de fallback (se o agente falhar)"><select className={input} value={config.fallback_template_id ?? ""} onChange={(e) => onConfig({ ...config, fallback_template_id: e.target.value || undefined })}><option value="">Nenhum</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></Field>
  </>;
  if (config.mode === "template") return <>{modeSelect}
    <Field label="Template">
      <select className={input} value={config.template_id} onChange={(e) => onConfig({ mode: "template", template_id: e.target.value })}>
        <option value="" disabled>Selecione um template</option>
        {templates.map((t) => <option key={t.id} value={t.id}>{t.nome} · {t.categoria}</option>)}
      </select>
    </Field>
    {!templates.length ? <p className="text-[11px] leading-5 text-[#e0a89e]">Nenhum template ativo cadastrado em Configurações → WhatsApp.</p> : null}
  </>;
  if (config.mode === "create_task") return <>{modeSelect}<Field label="Título"><input className={input} value={config.title} onChange={(e) => onConfig({ ...config, title: e.target.value })} /></Field><Field label="Descrição"><textarea className={input} value={config.description ?? ""} onChange={(e) => onConfig({ ...config, description: e.target.value || undefined })} /></Field><Field label="Prazo em minutos"><input className={input} type="number" min={0} value={config.due_minutes} onChange={(e) => onConfig({ ...config, due_minutes: Number(e.target.value) })} /></Field><Field label="Prioridade"><select className={input} value={config.priority} onChange={(e) => onConfig({ ...config, priority: e.target.value as typeof config.priority })}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></Field></>;
  if (config.mode === "add_tag" || config.mode === "remove_tag") return <>{modeSelect}<Field label="Tag"><select className={input} value={config.label_id} onChange={(e) => onConfig({ ...config, label_id: e.target.value })}><option value="" disabled>Selecione uma tag</option>{labels.map((label) => <option key={label.id} value={label.id}>{label.nome}</option>)}</select></Field>{!labels.length ? <p className="text-[11px] leading-5 text-[#e0a89e]">Crie uma tag no CRM antes de usar esta ação.</p> : null}</>;
  if (config.mode === "update_stage") return <>{modeSelect}<Field label="Nova etapa/status"><input className={input} value={config.stage} onChange={(e) => onConfig({ ...config, stage: e.target.value })} placeholder="ex.: em_contato" aria-label="ex.: em_contato" /></Field><p className="text-[11px] leading-5 text-[#98978d]">Etapas de ganho continuam protegidas pelo gate comercial.</p></>;
  if (config.mode === "assign_owner") return <>{modeSelect}<Field label="ID do responsável"><input className={input} value={config.owner_id} onChange={(e) => onConfig({ ...config, owner_id: e.target.value })} placeholder="UUID do usuário" aria-label="UUID do usuário" /></Field></>;
  if (config.mode === "add_note") return <>{modeSelect}<Field label="Título"><input className={input} value={config.title} onChange={(e) => onConfig({ ...config, title: e.target.value })} /></Field><Field label="Descrição"><textarea className={input} value={config.description ?? ""} onChange={(e) => onConfig({ ...config, description: e.target.value || undefined })} /></Field></>;
  if (config.mode === "email") return <>{modeSelect}<Field label="Assunto"><input className={input} value={config.subject} onChange={(e) => onConfig({ ...config, subject: e.target.value })} /></Field><Field label="Mensagem"><textarea className={input + " min-h-[96px]"} value={config.message} onChange={(e) => onConfig({ ...config, message: e.target.value })} /></Field></>;
  return <>{modeSelect}<p className="text-[11px] leading-5 text-[#98978d]">Envia o contato para a fila de discagem da Callface AI e registra o resultado na execução.</p></>;
}

function EndFields({ node, onConfig }: { node: Extract<FollowupNode, { type: "end" }>; onConfig: (c: FollowupNode["config"]) => void }) {
  return <>
    <Field label="Resultado"><select className={input} value={node.config.outcome} onChange={(e) => onConfig({ ...node.config, outcome: e.target.value as typeof node.config.outcome })}><option value="converted">Convertido</option><option value="exhausted">Esgotado (sem conversão)</option><option value="custom">Personalizado</option></select></Field>
    <Field label="Nota (opcional)"><input className={input} value={node.config.note ?? ""} onChange={(e) => onConfig({ ...node.config, note: e.target.value })} /></Field>
  </>;
}
