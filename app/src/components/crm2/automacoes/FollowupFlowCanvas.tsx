"use client";

import { useEffect, useMemo, useState } from "react";
import { Background, Controls, Handle, Position, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeProps, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Brain, Clock, Flag, GitBranch, PlayCircle, Send, Trash2 } from "lucide-react";
import type { Branch, Step, StepTipo } from "./cadence-types";
import { novoStep, stepLabel } from "./cadence-types";

type FlowNodeData = { title: string; subtitle: string; kind: "trigger" | StepTipo | "end"; selected?: boolean };
type FlowNode = Node<FlowNodeData>;
const START = "__followup_start__";
const END = "__followup_end__";
const accentByKind: Record<FlowNodeData["kind"], { color: string; icon: typeof Clock }> = {
  trigger: { color: "#81ad73", icon: PlayCircle }, wait: { color: "#70b7d5", icon: Clock }, condition: { color: "#c99855", icon: GitBranch }, action: { color: "#88aa75", icon: Send }, end: { color: "#c56d5e", icon: Flag },
};

function FlowCard({ data }: NodeProps<FlowNode>) {
  const visual = accentByKind[data.kind]; const Icon = visual.icon;
  return <div className="min-w-[238px] rounded-xl border border-[#3b3a34] bg-[#22221d] px-4 py-3 text-[#eeeeea] shadow-[0_8px_22px_rgba(0,0,0,.22)]" style={{ borderLeft: `4px solid ${visual.color}`, outline: data.selected ? "2px solid #aaff00" : "none" }}><Handle type="target" position={Position.Top} className="!size-2 !border-2 !border-[#d8d8d0] !bg-[#1e1e19]" /><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full" style={{ background: `${visual.color}2b`, color: visual.color }}><Icon className="size-4" /></span><div className="min-w-0"><p className="truncate text-[15px] font-semibold">{data.title}</p><p className="mt-0.5 truncate text-[12px] text-[#9d9c91]">{data.subtitle}</p></div></div><Handle type="source" position={Position.Bottom} className="!size-2 !border-2 !border-[#d8d8d0] !bg-[#1e1e19]" /></div>;
}
const nodeTypes: NodeTypes = { flow: FlowCard };

interface Props { steps: Step[]; onStepsChange: (steps: Step[]) => void; nome: string; entityType: string; onNomeChange: (value: string) => void; onEntityTypeChange: (value: string) => void; }
export function FollowupFlowCanvas(props: Props) { return <ReactFlowProvider><FlowCanvasInner {...props} /></ReactFlowProvider>; }

function FlowCanvasInner({ steps, onStepsChange, nome, entityType, onNomeChange, onEntityTypeChange }: Props) {
  const [selected, setSelected] = useState<string>(START);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => { setPositions((prev) => { const next: Record<string, { x: number; y: number }> = { ...prev, [START]: prev[START] ?? { x: 300, y: 60 }, [END]: prev[END] ?? { x: 300, y: 180 + steps.length * 160 } }; steps.forEach((step, index) => { next[step.id] ??= { x: 300, y: 180 + index * 160 }; }); return next; }); }, [steps]);
  const nodes = useMemo<FlowNode[]>(() => {
    const make = (id: string, kind: FlowNodeData["kind"], title: string, subtitle: string): FlowNode => ({ id, type: "flow", position: positions[id] ?? { x: 300, y: 60 }, data: { kind, title, subtitle, selected: selected === id }, draggable: true });
    return [make(START, "trigger", "Início do fluxo", `${entityType === "lead" ? "Lead" : entityType === "contato" ? "Contato" : "Negócio"} entra no follow-up`), ...steps.map(step => make(step.id, step.tipo, step.tipo === "wait" ? "Aguardar" : step.tipo === "condition" ? "Condição" : "Ação", stepLabel(step))), make(END, "end", "Fim do fluxo", "Encerra o follow-up")];
  }, [steps, positions, selected, entityType]);
  const edges = useMemo<Edge[]>(() => {
    const all = [{ id: "start", source: START, target: steps[0]?.id ?? END, label: "Sempre" }];
    steps.forEach((step, index) => { const fallback = steps[index + 1]?.id ?? END; if (step.tipo === "condition" && step.branches.length) step.branches.forEach((branch, branchIndex) => all.push({ id: `${step.id}-${branchIndex}`, source: step.id, target: branch.proximoStepId ?? END, label: branch.condicao ? "Se corresponder" : "Senão" })); else all.push({ id: `${step.id}-next`, source: step.id, target: fallback, label: "Sempre" }); });
    return all.map(edge => ({ ...edge, type: "smoothstep", animated: false, labelStyle: { fill: "#e8e7df", fontSize: 11 }, labelBgStyle: { fill: "#f4f4ef", fillOpacity: 1 }, labelBgPadding: [5, 3], style: { stroke: "#bbb9ae", strokeWidth: 1.4 } }));
  }, [steps]);
  const selectedStep = steps.find(step => step.id === selected);
  const add = (type: StepTipo) => { const step = novoStep(type); onStepsChange([...steps, step]); setSelected(step.id); };
  const update = (patch: Partial<Step>) => selectedStep && onStepsChange(steps.map(step => step.id === selectedStep.id ? { ...step, ...patch } : step));
  const remove = () => { if (!selectedStep) return; const nextTarget = steps[steps.findIndex(step => step.id === selectedStep.id) + 1]?.id ?? null; onStepsChange(steps.filter(step => step.id !== selectedStep.id).map(step => ({ ...step, branches: step.branches.map(branch => branch.proximoStepId === selectedStep.id ? { ...branch, proximoStepId: nextTarget } : branch) }))); setSelected(START); };
  return <div className="flex h-full min-h-[600px] overflow-hidden rounded-xl border border-[#393831] bg-[#171714]">
    <aside className="flex w-56 shrink-0 flex-col gap-2 border-r border-[#393831] bg-[#20201b] p-3"><p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#aaa89c]">Adicionar nó</p><PaletteButton icon={Clock} color="#70b7d5" onClick={() => add("wait")}>Aguardar</PaletteButton><PaletteButton icon={GitBranch} color="#c99855" onClick={() => add("condition")}>Condição</PaletteButton><PaletteButton icon={Send} color="#88aa75" onClick={() => add("action")}>Ação</PaletteButton><div className="mt-auto rounded-lg border border-[#393831] bg-[#191914] p-3 text-[11px] leading-5 text-[#98978d]"><Brain className="mb-2 size-4 text-[#aaff00]" />Classificar com IA será habilitado quando houver executor de IA real para este motor.</div></aside>
    <section className="relative min-w-0 flex-1" onClick={() => setSelected("")}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, node) => setSelected(node.id)} onNodesChange={(changes) => changes.forEach(change => { if (change.type === "position" && change.position) setPositions(prev => ({ ...prev, [change.id]: change.position! })); })} fitView fitViewOptions={{ padding: 0.24 }} proOptions={{ hideAttribution: true }}><Background color="#55564f" gap={24} size={1} /><Controls showInteractive={false} /></ReactFlow><p className="absolute bottom-3 left-4 rounded-md bg-[#22221d] px-2 py-1 text-[10px] text-[#9d9c91]">A posição organiza o mapa. A ordem de execução permanece a ordem das etapas.</p></section>
    <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-[#393831] bg-[#20201b] p-5"><Inspector selected={selected} step={selectedStep} steps={steps} nome={nome} entityType={entityType} onNome={onNomeChange} onEntity={onEntityTypeChange} onUpdate={update} onRemove={remove} /></aside>
  </div>;
}
function PaletteButton({ icon: Icon, color, onClick, children }: { icon: typeof Clock; color: string; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className="flex items-center gap-2 rounded-lg border border-[#3b3a34] bg-[#292923] px-3 py-2.5 text-left text-[13px] font-medium text-[#e8e7df] hover:bg-[#303029]"><span className="flex size-6 items-center justify-center rounded-full" style={{ background: `${color}25`, color }}><Icon className="size-3.5" /></span>{children}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[#d5d4cc]">{label}{children}</label>; }
const input = "rounded-lg border border-[#3c3b34] bg-[#1b1b17] px-3 py-2.5 text-[13px] text-[#e8e7df] outline-none focus:border-[#aaff00]";
function Inspector({ selected, step, steps, nome, entityType, onNome, onEntity, onUpdate, onRemove }: { selected: string; step?: Step; steps: Step[]; nome: string; entityType: string; onNome: (v: string) => void; onEntity: (v: string) => void; onUpdate: (v: Partial<Step>) => void; onRemove: () => void }) {
  if (!selected) return <p className="pt-4 text-[13px] text-[#a5a399]">Selecione um nó ou uma conexão para configurar o fluxo.</p>;
  if (selected === START) return <div className="space-y-5"><PanelTitle icon={PlayCircle} color="#81ad73" title="Gatilho" description="Define qual entidade entra neste follow-up." /><Field label="Nome do follow-up"><input className={input} value={nome} onChange={e => onNome(e.target.value)} /></Field><Field label="Entidade"><select className={input} value={entityType} onChange={e => onEntity(e.target.value)}><option value="lead">Lead</option><option value="contato">Contato</option><option value="negocio">Negócio</option></select></Field><p className="border-t border-[#393831] pt-4 text-[12px] leading-5 text-[#aaa89c]">A entrada é feita por uma inscrição no motor existente. Gatilhos automáticos adicionais ainda não estão conectados a este fluxo.</p></div>;
  if (selected === END) return <div className="space-y-4"><PanelTitle icon={Flag} color="#c56d5e" title="Fim" description="O follow-up é encerrado quando chega neste nó." /><p className="text-[12px] leading-5 text-[#aaa89c]">Este nó é visual. No motor, chegar ao fim grava a inscrição como concluída.</p></div>;
  if (!step) return null;
  const kind = accentByKind[step.tipo]; const Icon = kind.icon;
  return <div className="space-y-5"><PanelTitle icon={Icon} color={kind.color} title={step.tipo === "wait" ? "Aguardar" : step.tipo === "condition" ? "Condição" : "Ação"} description="Alterações ficam no rascunho até salvar e publicar." /><Field label="Rótulo"><input className={input} value={(step.config?.label as string | undefined) ?? ""} placeholder={stepLabel(step)} onChange={e => onUpdate({ config: { ...step.config, label: e.target.value } })} /></Field>{step.tipo === "wait" ? <Field label="Aguardar por (minutos)"><input className={input} type="number" min={0} value={step.esperaMinutos ?? 60} onChange={e => onUpdate({ esperaMinutos: Number(e.target.value) })} /></Field> : null}{step.tipo === "action" ? <>
    <Field label="Tipo de ação">
      <select className={input} value={step.adapter ?? "noop"} onChange={e => onUpdate({ adapter: e.target.value })}>
        <option value="noop">Registrar etapa interna</option>
        <option value="whatsapp">Enviar WhatsApp</option>
        <option value="email">Enviar e-mail</option>
      </select>
    </Field>
    {step.adapter === "whatsapp" || step.adapter === "email" ? <>
      {step.adapter === "email" ? <Field label="Assunto"><input className={input} value={(step.config?.assunto as string | undefined) ?? ""} placeholder="Callface" onChange={e => onUpdate({ config: { ...step.config, assunto: e.target.value } })} /></Field> : null}
      <Field label="Mensagem"><textarea className={input + " min-h-[96px] resize-none"} value={(step.config?.mensagem as string | undefined) ?? ""} placeholder="Mensagem enviada quando esta etapa executar." onChange={e => onUpdate({ config: { ...step.config, mensagem: e.target.value } })} /></Field>
    </> : <p className="rounded-lg border border-[#5d5631] bg-[#2a281c] p-3 text-[11px] leading-5 text-[#c8bc85]">Classificar com IA será habilitado quando houver executor de IA real para este motor.</p>}
  </> : null}{step.tipo === "condition" ? <ConditionEditor step={step} steps={steps} onUpdate={onUpdate} /> : null}<button onClick={onRemove} className="flex items-center gap-2 text-[12px] font-semibold text-[#e17a6e]"><Trash2 className="size-3.5" />Remover nó</button></div>;
}
function PanelTitle({ icon: Icon, color, title, description }: { icon: typeof Clock; color: string; title: string; description: string }) { return <div><h2 className="flex items-center gap-2 text-[18px] font-semibold text-[#eeeeea]"><span className="flex size-8 items-center justify-center rounded-full" style={{ background: `${color}25`, color }}><Icon className="size-4" /></span>{title}</h2><p className="mt-2 text-[12px] leading-5 text-[#a5a399]">{description}</p></div>; }
function ConditionEditor({ step, steps, onUpdate }: { step: Step; steps: Step[]; onUpdate: (v: Partial<Step>) => void }) { const branches = step.branches; const updateBranch = (index: number, patch: Partial<Branch>) => onUpdate({ branches: branches.map((branch, i) => i === index ? { ...branch, ...patch } : branch) }); return <div className="space-y-3 border-t border-[#393831] pt-4"><p className="text-[12px] font-semibold text-[#d5d4cc]">Ramificações</p>{branches.map((branch, index) => <div key={index} className="space-y-2 rounded-lg border border-[#3c3b34] bg-[#1b1b17] p-3"><input className={input + " w-full"} placeholder="Campo (ex.: origem)" value={(branch.condicao as { campo?: string } | null)?.campo ?? ""} onChange={e => updateBranch(index, { condicao: { ...(branch.condicao ?? {}), campo: e.target.value } })} /><select className={input + " w-full"} value={branch.proximoStepId ?? "__end"} onChange={e => updateBranch(index, { proximoStepId: e.target.value === "__end" ? null : e.target.value })}><option value="__end">Fim</option>{steps.filter(candidate => candidate.id !== step.id).map(candidate => <option key={candidate.id} value={candidate.id}>{stepLabel(candidate)}</option>)}</select></div>)}<button onClick={() => onUpdate({ branches: [...branches, { condicao: { campo: "", operador: "igual", valor: "" }, proximoStepId: null }] })} className="text-[12px] font-semibold text-[#aaff00]">+ Adicionar ramificação</button></div>; }
