"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlayCircle, Flag, GitFork, Clock, Zap, ChevronUp, ChevronDown, Trash2, Plus, Info,
} from "lucide-react";
import type { Branch, Condicao, Step, StepTipo } from "./cadence-types";
import { novoStep, stepLabel, condicaoResumo, OPERADOR_LABEL } from "./cadence-types";

// ─── Layout ─────────────────────────────────────────────────────────────────
// Grafo de nós real (Trigger → steps → Fim), não uma lista com nome bonito:
// cada nó tem posição própria (drag livre, só cosmético — a ORDEM de
// execução é sempre a ordem do array `steps`, nunca a posição na tela) e as
// arestas são desenhadas via SVG a partir do dado real (`branches` de cada
// step, com fallback sequencial quando não há branch explícito). Trigger e
// Fim são nós sintéticos só de UI — não existem no `Step[]` persistido, o
// motor já trata "antes do 1º step" e "depois do último/branch nulo" como
// início/fim implícitos (ver cadence-engine.ts).
const NODE_W = 238;
const NODE_H = 96;
const ROW_GAP = 148;
const COL_X = 132;
const TRIGGER_ID = "__trigger__";
const END_ID = "__end__";

type NodeId = string;
type Pos = { x: number; y: number };

interface CanvasNode {
  id: NodeId;
  kind: "trigger" | StepTipo | "end";
  step?: Step;
  index?: number; // índice real no array `steps`, só pra steps reais
}

interface Edge {
  id: string;
  from: NodeId;
  to: NodeId;
  label?: string;
  kind: "seq" | "branch" | "default";
}

function defaultLayout(steps: Step[]): Record<NodeId, Pos> {
  const pos: Record<NodeId, Pos> = {};
  pos[TRIGGER_ID] = { x: COL_X, y: 56 };
  steps.forEach((s, i) => {
    pos[s.id] = { x: COL_X, y: 56 + (i + 1) * ROW_GAP };
  });
  pos[END_ID] = { x: COL_X, y: 56 + (steps.length + 1) * ROW_GAP };
  return pos;
}

function buildNodes(steps: Step[]): CanvasNode[] {
  return [
    { id: TRIGGER_ID, kind: "trigger" },
    ...steps.map((s, i) => ({ id: s.id, kind: s.tipo, step: s, index: i })),
    { id: END_ID, kind: "end" as const },
  ];
}

/** Espelha a resolução real do engine (resolverBranch + fallback sequencial) pra desenhar exatamente as arestas que o motor de fato percorre. */
function buildEdges(steps: Step[]): Edge[] {
  const edges: Edge[] = [];
  if (steps.length === 0) {
    edges.push({ id: "trigger-end", from: TRIGGER_ID, to: END_ID, kind: "seq" });
    return edges;
  }
  edges.push({ id: "trigger-first", from: TRIGGER_ID, to: steps[0].id, kind: "seq" });

  steps.forEach((s, i) => {
    const proximoSequencial = steps[i + 1]?.id ?? END_ID;
    const branches = s.branches ?? [];
    branches.forEach((b, bi) => {
      edges.push({
        id: `${s.id}-branch-${bi}`,
        from: s.id,
        to: b.proximoStepId ?? END_ID,
        label: condicaoResumo(b.condicao),
        kind: b.condicao ? "branch" : "default",
      });
    });
    const temDefaultExplicito = branches.some((b) => !b.condicao);
    if (!temDefaultExplicito) {
      edges.push({
        id: `${s.id}-seq`,
        from: s.id,
        to: proximoSequencial,
        label: branches.length > 0 ? "senão (nenhum branch bateu)" : undefined,
        kind: branches.length > 0 ? "default" : "seq",
      });
    }
  });
  return edges;
}

function edgeColor(kind: Edge["kind"]): string {
  if (kind === "branch") return "var(--cf2-accent)";
  if (kind === "default") return "var(--cf2-warning-text)";
  return "var(--cf2-text-tertiary)";
}

const ICON_BY_KIND: Record<CanvasNode["kind"], typeof Clock> = {
  trigger: PlayCircle,
  wait: Clock,
  action: Zap,
  condition: GitFork,
  end: Flag,
};

const TITLE_BY_KIND: Record<CanvasNode["kind"], string> = {
  trigger: "Início",
  wait: "Aguardar",
  action: "Ação",
  condition: "Condição",
  end: "Fim",
};

interface CadenceCanvasProps {
  steps: Step[];
  onStepsChange: (steps: Step[]) => void;
  nome: string;
  entityType: string;
  onNomeChange: (nome: string) => void;
  onEntityTypeChange: (entityType: string) => void;
}

export function CadenceCanvas({ steps, onStepsChange, nome, entityType, onNomeChange, onEntityTypeChange }: CadenceCanvasProps) {
  const [positions, setPositions] = useState<Record<NodeId, Pos>>(() => defaultLayout(steps));
  // Abre já com o nó Início selecionado — é onde nome/entidade da cadência
  // são editados, então precisa estar visível de cara, não escondido atrás
  // de um clique extra no canvas.
  const [selecionado, setSelecionado] = useState<NodeId | null>(TRIGGER_ID);
  const dragRef = useRef<{ id: NodeId; offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Novo step aparece na lista sem posição ainda -> ganha layout automático
  // na próxima etapa (embaixo da anterior); posições já existentes (inclui
  // as que o usuário arrastou) não são tocadas. Steps removidos limpam sua
  // entrada pra não acumular lixo no state.
  useEffect(() => {
    setPositions((prev) => {
      const auto = defaultLayout(steps);
      const next: Record<NodeId, Pos> = {};
      for (const id of Object.keys(auto)) {
        next[id] = prev[id] ?? auto[id];
      }
      return next;
    });
  }, [steps]);

  const nodes = useMemo(() => buildNodes(steps), [steps]);
  const edges = useMemo(() => buildEdges(steps), [steps]);

  const bounds = useMemo(() => {
    let maxX = 600;
    let maxY = 400;
    for (const n of nodes) {
      const p = positions[n.id];
      if (!p) continue;
      maxX = Math.max(maxX, p.x + NODE_W + 260); // espaço pro painel de inspeção não é aqui, só folga visual
      maxY = Math.max(maxY, p.y + NODE_H + 60);
    }
    return { width: maxX, height: maxY };
  }, [nodes, positions]);

  function onPointerDownNode(e: React.PointerEvent, id: NodeId) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const p = positions[id] ?? { x: COL_X, y: 24 };
    dragRef.current = { id, offsetX: e.clientX - rect.left - p.x, offsetY: e.clientY - rect.top - p.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(8, e.clientX - rect.left - drag.offsetX);
    const y = Math.max(8, e.clientY - rect.top - drag.offsetY);
    setPositions((prev) => ({ ...prev, [drag.id]: { x, y } }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function centerOf(id: NodeId): Pos {
    const p = positions[id] ?? { x: COL_X, y: 24 };
    return { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 };
  }

  function anchorOut(id: NodeId): Pos {
    const p = positions[id] ?? { x: COL_X, y: 24 };
    return { x: p.x + NODE_W / 2, y: p.y + NODE_H };
  }

  function anchorIn(id: NodeId): Pos {
    const p = positions[id] ?? { x: COL_X, y: 24 };
    return { x: p.x + NODE_W / 2, y: p.y };
  }

  function pathFor(edge: Edge): string {
    const from = anchorOut(edge.from);
    const to = anchorIn(edge.to);
    const dy = Math.max(40, Math.abs(to.y - from.y) / 2);
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + dy}, ${to.x} ${to.y - dy}, ${to.x} ${to.y}`;
  }

  function midPoint(edge: Edge): Pos {
    const from = anchorOut(edge.from);
    const to = anchorIn(edge.to);
    return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  }

  // ── Mutações no dado real (Step[]) ────────────────────────────────────────

  function adicionarStep(tipo: StepTipo) {
    const s = novoStep(tipo);
    onStepsChange([...steps, s]);
    setSelecionado(s.id);
  }

  function atualizarStep(id: NodeId, patch: Partial<Step>) {
    onStepsChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removerStep(id: NodeId) {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1) return;
    // Referências (branches de qualquer outro step) que apontavam pro step
    // removido passam a apontar pro que viria depois dele — senão sobra
    // `proximoStepId` fantasma apontando pra um step que não existe mais.
    const substituto = steps[idx + 1]?.id ?? null;
    const restante = steps
      .filter((s) => s.id !== id)
      .map((s) => ({
        ...s,
        branches: s.branches.map((b) => (b.proximoStepId === id ? { ...b, proximoStepId: substituto } : b)),
      }));
    onStepsChange(restante);
    setPositions((prev) => {
      const { [id]: _removido, ...resto } = prev;
      return resto;
    });
    if (selecionado === id) setSelecionado(null);
  }

  function moverStep(id: NodeId, direcao: -1 | 1) {
    const idx = steps.findIndex((s) => s.id === id);
    const destino = idx + direcao;
    if (idx === -1 || destino < 0 || destino >= steps.length) return;
    const copia = [...steps];
    [copia[idx], copia[destino]] = [copia[destino], copia[idx]];
    onStepsChange(copia);
    // Posições dos dois nós trocados de lugar ficam obsoletas (senão o
    // layout automático da nova posição não se aplica a quem já tinha
    // coordenada salva) — remove as duas pra recalcular no próximo layout.
    setPositions((prev) => {
      const { [copia[idx].id]: _a, [copia[destino].id]: _b, ...resto } = prev;
      return resto;
    });
  }

  const stepSelecionado = steps.find((s) => s.id === selecionado) ?? null;

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <div className="flex-1 min-h-0 flex gap-4 items-stretch">
        <aside className="w-[184px] shrink-0 rounded-2xl p-3 flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface-subtle)", border: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] px-1" style={{ color: "var(--cf2-text-tertiary)" }}>Adicionar nó</p>
          <button onClick={() => adicionarStep("wait")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold text-left" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}><Clock className="w-4 h-4" style={{ color: "var(--cf2-accent)" }} /> Aguardar</button>
          <button onClick={() => adicionarStep("action")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold text-left" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}><Zap className="w-4 h-4" style={{ color: "#9fe870" }} /> Ação</button>
          <button onClick={() => adicionarStep("condition")} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-semibold text-left" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}><GitFork className="w-4 h-4" style={{ color: "#f3b75f" }} /> Condição</button>
          <div className="mt-auto p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <Info className="w-3.5 h-3.5 mb-2" style={{ color: "var(--cf2-accent)" }} />
            <p className="text-[10px] leading-[15px]" style={{ color: "var(--cf2-text-tertiary)" }}>A ordem de execução segue a lista. Arraste para organizar o mapa e use as setas do nó para reordenar.</p>
          </div>
        </aside>

        <div
          ref={containerRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative rounded-2xl overflow-auto flex-1 min-w-0"
          style={{
            backgroundColor: "var(--cf2-bg-canvas)",
            backgroundImage: "radial-gradient(var(--cf2-border-grid) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            border: "1px solid var(--cf2-border-default)",
            minHeight: 520,
          }}
        >
          <div className="relative" style={{ width: bounds.width, height: bounds.height }}>
            <svg
              width={bounds.width}
              height={bounds.height}
              className="absolute top-0 left-0 pointer-events-none"
              style={{ zIndex: 0 }}
            >
              <defs>
                <marker id="cf2-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="var(--cf2-text-tertiary)" />
                </marker>
              </defs>
              {edges.map((edge) => (
                <path
                  key={edge.id}
                  d={pathFor(edge)}
                  fill="none"
                  stroke={edgeColor(edge.kind)}
                  strokeWidth={1.75}
                  strokeDasharray={edge.kind === "default" ? "5 4" : undefined}
                  markerEnd="url(#cf2-arrow)"
                  opacity={0.85}
                />
              ))}
            </svg>

            {edges.filter((e) => e.label).map((edge) => {
              const m = midPoint(edge);
              return (
                <div
                  key={`label-${edge.id}`}
                  className="absolute px-1.5 py-0.5 rounded text-[9.5px] font-medium whitespace-nowrap"
                  style={{
                    left: m.x, top: m.y, transform: "translate(-50%, -50%)",
                    background: "var(--cf2-bg-surface)", color: edgeColor(edge.kind),
                    border: `1px solid ${edgeColor(edge.kind)}`, zIndex: 1, maxWidth: 180,
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}
                  title={edge.label}
                >
                  {edge.label}
                </div>
              );
            })}

            {nodes.map((node) => {
              const p = positions[node.id] ?? { x: COL_X, y: 24 };
              const Icon = ICON_BY_KIND[node.kind];
              const isSelected = selecionado === node.id;
              const isSynthetic = node.kind === "trigger" || node.kind === "end";
              return (
                <div
                  key={node.id}
                  onPointerDown={(e) => onPointerDownNode(e, node.id)}
                  onClick={() => setSelecionado(node.id)}
                  className="absolute rounded-xl p-2.5 cursor-grab select-none flex flex-col gap-1"
                  style={{
                    left: p.x, top: p.y, width: NODE_W, minHeight: NODE_H, zIndex: 2,
                    background: "var(--cf2-bg-surface)",
                    border: isSelected ? "2px solid var(--cf2-accent)" : "1px solid var(--cf2-border-default)",
                    boxShadow: "var(--cf2-shadow-card-sm)",
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex items-center justify-center rounded-md shrink-0 w-6 h-6"
                      style={{ background: isSynthetic ? "var(--cf2-bg-inverse)" : "var(--cf2-accent)" }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-on-accent)" }} />
                    </div>
                    <p className="text-[11px] font-bold truncate flex-1" style={{ color: "var(--cf2-text-primary)" }}>
                      {TITLE_BY_KIND[node.kind]}
                    </p>
                    {node.step && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); moverStep(node.id, -1); }}
                          disabled={node.index === 0}
                          className="p-0.5 rounded disabled:opacity-30"
                          title="Mover pra cima"
                        >
                          <ChevronUp className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />
                        </button>
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); moverStep(node.id, 1); }}
                          disabled={node.index === steps.length - 1}
                          className="p-0.5 rounded disabled:opacity-30"
                          title="Mover pra baixo"
                        >
                          <ChevronDown className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />
                        </button>
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); removerStep(node.id); }}
                          className="p-0.5 rounded"
                          title="Remover etapa"
                        >
                          <Trash2 className="w-3 h-3" style={{ color: "var(--cf2-danger-text)" }} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-medium truncate" style={{ color: "var(--cf2-text-secondary)" }}>
                    {node.kind === "trigger" ? `${entityType} · início` : node.kind === "end" ? "encerra a cadência" : stepLabel(node.step!)}
                  </p>
                  {node.step?.tipo === "condition" && (
                    <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{node.step.branches.length} branch(es)</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="rounded-2xl p-4 flex flex-col gap-3 shrink-0 overflow-y-auto"
          style={{ width: 332, background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", minHeight: 520 }}
        >
          {selecionado === TRIGGER_ID ? (
            <TriggerInspector nome={nome} entityType={entityType} onNomeChange={onNomeChange} onEntityTypeChange={onEntityTypeChange} />
          ) : selecionado === END_ID ? (
            <div>
              <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Fim</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
                Nó terminal — não existe no dado salvo, é só a representação visual de "follow-up encerrado" (`status: completed`). Qualquer branch com destino "Fim" ou o fim da lista de etapas chega aqui.
              </p>
            </div>
          ) : stepSelecionado ? (
            <StepInspector
              step={stepSelecionado}
              todosSteps={steps}
              onChange={(patch) => atualizarStep(stepSelecionado.id, patch)}
            />
          ) : (
            <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              Clique em um nó no canvas pra editar. Início e Fim são automáticos — Início dispara quando algo chama `iniciarCadencia` pra essa definição (inscrição já existente, nenhum novo mecanismo de disparo).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inspetores ─────────────────────────────────────────────────────────────

function fieldLabelStyle(): React.CSSProperties {
  return { color: "var(--cf2-text-secondary)" };
}

function inputStyle(): React.CSSProperties {
  return { border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)", color: "var(--cf2-text-primary)" };
}

function TriggerInspector({ nome, entityType, onNomeChange, onEntityTypeChange }: {
  nome: string; entityType: string; onNomeChange: (v: string) => void; onEntityTypeChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Início</p>
      <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>
        Único ponto de entrada do follow-up. Dispara para uma entidade quando algum código chama <code>iniciarCadencia</code> com esta definição — mesmo mecanismo de inscrição que já existe hoje, nenhum gatilho automático novo nesta rodada.
      </p>
      <label className="text-[11px] font-semibold" style={fieldLabelStyle()}>Nome do follow-up</label>
      <input value={nome} onChange={(e) => onNomeChange(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none" style={inputStyle()} />
      <label className="text-[11px] font-semibold" style={fieldLabelStyle()}>Entidade inscrita</label>
      <select value={entityType} onChange={(e) => onEntityTypeChange(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none" style={inputStyle()}>
        <option value="lead">Lead</option>
        <option value="negocio">Negócio</option>
        <option value="contato">Contato</option>
      </select>
    </div>
  );
}

function StepInspector({ step, todosSteps, onChange }: { step: Step; todosSteps: Step[]; onChange: (patch: Partial<Step>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{TITLE_BY_KIND[step.tipo]}</p>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold" style={fieldLabelStyle()}>Nome (opcional, só visual)</label>
        <input
          value={(step.config?.label as string | undefined) ?? ""}
          onChange={(e) => onChange({ config: { ...step.config, label: e.target.value } })}
          placeholder={stepLabel(step)}
          className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none"
          style={inputStyle()}
        />
      </div>

      {step.tipo === "wait" && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold" style={fieldLabelStyle()}>Esperar (minutos)</label>
          <input
            type="number" min={0}
            value={step.esperaMinutos ?? 60}
            onChange={(e) => onChange({ esperaMinutos: Number(e.target.value) })}
            className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none"
            style={inputStyle()}
          />
        </div>
      )}

      {step.tipo === "action" && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={fieldLabelStyle()}>Adapter</label>
            <input
              value={step.adapter ?? "noop"}
              onChange={(e) => onChange({ adapter: e.target.value })}
              className="px-2.5 py-1.5 rounded-lg text-[12px] outline-none"
              style={inputStyle()}
            />
            <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>Hoje só "noop" está registrado de verdade no engine — outros nomes ficam salvos, mas falham em runtime até alguém registrar o adapter.</p>
          </div>
          <ConfigEditor config={step.config ?? {}} onChange={(config) => onChange({ config })} excluirChave="label" />
        </>
      )}

      {step.tipo === "condition" && (
        <BranchEditor step={step} todosSteps={todosSteps} onChange={onChange} />
      )}
    </div>
  );
}

function ConfigEditor({ config, onChange, excluirChave }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void; excluirChave?: string }) {
  const entries = Object.entries(config).filter(([k]) => k !== excluirChave);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold" style={fieldLabelStyle()}>Config (passada pro adapter)</label>
      {entries.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
          <input
            value={k}
            onChange={(e) => {
              const novo: Record<string, unknown> = {};
              entries.forEach(([kk, vv], j) => { novo[j === i ? e.target.value : kk] = vv; });
              if (excluirChave && config[excluirChave] !== undefined) novo[excluirChave] = config[excluirChave];
              onChange(novo);
            }}
            placeholder="chave" className="px-2 py-1 rounded text-[11px] outline-none" style={inputStyle()}
          />
          <input
            value={String(v ?? "")}
            onChange={(e) => {
              const novo = { ...config, [k]: e.target.value };
              onChange(novo);
            }}
            placeholder="valor" className="px-2 py-1 rounded text-[11px] outline-none" style={inputStyle()}
          />
          <button
            onClick={() => {
              const novo = { ...config };
              delete novo[k];
              onChange(novo);
            }}
            className="p-1"
          >
            <Trash2 className="w-3 h-3" style={{ color: "var(--cf2-danger-text)" }} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange({ ...config, [`campo${entries.length + 1}`]: "" })}
        className="self-start flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded"
        style={{ background: "var(--cf2-bg-surface-muted)" }}
      >
        <Plus className="w-3 h-3" /> Campo
      </button>
    </div>
  );
}

function BranchEditor({ step, todosSteps, onChange }: { step: Step; todosSteps: Step[]; onChange: (patch: Partial<Step>) => void }) {
  const outrosSteps = todosSteps.filter((s) => s.id !== step.id);
  const idx = todosSteps.findIndex((s) => s.id === step.id);
  const proximoSequencial = todosSteps[idx + 1]?.id ?? null;
  const branchesCondicionais = step.branches.filter((b) => b.condicao);
  const branchDefault = step.branches.find((b) => !b.condicao) ?? null;

  function setBranches(branches: Branch[]) {
    onChange({ branches });
  }

  function atualizarBranch(i: number, patch: Partial<Branch>) {
    setBranches(step.branches.map((b, bi) => (bi === i ? { ...b, ...patch } : b)));
  }

  function atualizarCondicao(i: number, patch: Partial<Condicao>) {
    const atual = step.branches[i]?.condicao ?? { campo: "", operador: "igual", valor: "" };
    atualizarBranch(i, { condicao: { ...atual, ...patch } });
  }

  function removerBranch(i: number) {
    setBranches(step.branches.filter((_, bi) => bi !== i));
  }

  function adicionarBranchCondicional() {
    const semDefault = step.branches.filter((b) => b.condicao);
    const def = step.branches.find((b) => !b.condicao);
    const novaLista = [...semDefault, { condicao: { campo: "", operador: "igual" as const, valor: "" }, proximoStepId: null }, ...(def ? [def] : [])];
    setBranches(novaLista);
  }

  function setFallback(destino: string | null) {
    const semDefault = step.branches.filter((b) => b.condicao);
    if (destino === proximoSequencial) {
      // Igual ao que já aconteceria por padrão -> não precisa de branch explícito.
      setBranches(semDefault);
    } else {
      setBranches([...semDefault, { condicao: null, proximoStepId: destino }]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>
        Avaliadas em ordem — a 1ª condição que bater decide o próximo nó. Usa a mesma gramática de <code>lib/crm/condicao.ts</code> já usada em Fluxos.
      </p>

      {branchesCondicionais.map((b, i) => {
        const iReal = step.branches.indexOf(b);
        return (
          <div key={iReal} className="rounded-lg p-2 flex flex-col gap-1.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>Branch {i + 1}</span>
              <button onClick={() => removerBranch(iReal)}><Trash2 className="w-3 h-3" style={{ color: "var(--cf2-danger-text)" }} /></button>
            </div>
            <input
              value={b.condicao?.campo ?? ""}
              onChange={(e) => atualizarCondicao(iReal, { campo: e.target.value })}
              placeholder="campo (ex: origem)"
              className="px-2 py-1 rounded text-[11px] outline-none" style={inputStyle()}
            />
            <select
              value={b.condicao?.operador ?? "igual"}
              onChange={(e) => atualizarCondicao(iReal, { operador: e.target.value as Condicao["operador"] })}
              className="px-2 py-1 rounded text-[11px] outline-none" style={inputStyle()}
            >
              {Object.entries(OPERADOR_LABEL).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
            </select>
            <input
              value={b.condicao?.valor ?? ""}
              onChange={(e) => atualizarCondicao(iReal, { valor: e.target.value })}
              placeholder="valor"
              className="px-2 py-1 rounded text-[11px] outline-none" style={inputStyle()}
            />
            <label className="text-[10px] font-semibold mt-0.5" style={fieldLabelStyle()}>Vai para</label>
            <select
              value={b.proximoStepId ?? "__fim__"}
              onChange={(e) => atualizarBranch(iReal, { proximoStepId: e.target.value === "__fim__" ? null : e.target.value })}
              className="px-2 py-1 rounded text-[11px] outline-none" style={inputStyle()}
            >
              <option value="__fim__">Fim</option>
              {outrosSteps.map((s) => <option key={s.id} value={s.id}>{stepLabel(s)}</option>)}
            </select>
          </div>
        );
      })}

      <button onClick={adicionarBranchCondicional} className="self-start flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        <Plus className="w-3 h-3" /> Branch
      </button>

      <div className="rounded-lg p-2 flex flex-col gap-1.5" style={{ background: "var(--cf2-warning-bg)" }}>
        <label className="text-[10px] font-bold" style={{ color: "var(--cf2-warning-text)" }}>Senão (se nenhum branch bater)</label>
        <select
          value={branchDefault?.proximoStepId ?? proximoSequencial ?? "__fim__"}
          onChange={(e) => setFallback(e.target.value === "__fim__" ? null : e.target.value)}
          className="px-2 py-1 rounded text-[11px] outline-none" style={inputStyle()}
        >
          <option value="__fim__">Fim</option>
          {outrosSteps.map((s) => <option key={s.id} value={s.id}>{stepLabel(s)}</option>)}
        </select>
      </div>
    </div>
  );
}
