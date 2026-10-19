"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * O desenho do fluxo da cadência.
 *
 * É a mesma superfície React Flow de Fluxos, com os rótulos e os tokens da
 * cadência. As arestas são a fonte da verdade dos ramos; não há lista
 * achatada por trás deste canvas.
 *
 * O que esta volta consertou, porque o editor estava ilegível:
 *  - o passo novo entrava sempre no mesmo X, uma coluna alta e estreita, e o
 *    enquadramento automático afastava a câmera até o cartão virar um
 *    carimbo no meio de uma área vazia. Agora o passo novo entra na COLUNA
 *    SEGUINTE ao passo de referência e já sai LIGADO nele, e o botão
 *    Organizar redistribui o desenho em camadas (`organizarGrafo`);
 *  - o enquadramento tem piso de zoom: antes de encolher o texto além do
 *    legível, o canvas prefere deixar a pessoa deslizar;
 *  - soltar um passo arrastado cai onde o cursor soltou, não num ponto fixo;
 *  - passo com pendência de publicação é marcado no próprio cartão, não só
 *    num aviso no pé da página.
 * ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Background, BackgroundVariant, BaseEdge, Controls, EdgeLabelRenderer, Handle, MiniMap, Position,
  ReactFlow, ReactFlowProvider, getBezierPath, useNodesInitialized, useReactFlow,
  type Connection, type Edge, type EdgeProps, type Node, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import {
  AlertTriangle, Clock, Crosshair, GitBranch, LayoutGrid, MessageCircle, Plus, Rocket, Sparkles, Square, X,
} from "lucide-react";
import { branchesForNode, edgeBranchId, type FollowupEdge, type FollowupGraph, type FollowupNode, type FollowupNodeType } from "@/lib/ai-platform/followup/graph";
import { ALTURA_LINHA, LARGURA_COLUNA, organizarGrafo } from "./passos";
import "@xyflow/react/dist/style.css";

type DadosNo = { no: FollowupNode; selecionado: boolean; somenteLeitura: boolean; erro?: string; aoSelecionar: () => void };
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

/** Zoom mínimo do enquadramento automático. Abaixo disso o cartão perde o
 *  texto, e um desenho ilegível enquadrado é pior que um desenho que pede
 *  para deslizar. */
const ZOOM_MINIMO_LEGIVEL = 0.6;

const PARA_ADICIONAR: FollowupNodeType[] = ["wait", "action", "condition", "ai_classify", "end"];

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
  const { no, selecionado, somenteLeitura, erro, aoSelecionar } = data;
  const meta = META[no.type];
  const Icon = meta.Icon;
  const branches = branchesForNode(no);
  return <div className="ofc-rf-no" data-tipo={no.type} data-selecionado={selecionado ? "true" : undefined} data-erro={erro ? "true" : undefined} onClick={aoSelecionar}>
    {no.type !== "trigger" && <Handle type="target" position={Position.Left} className="ofc-rf-porta" isConnectable={!somenteLeitura} />}
    <div className="ofc-rf-cab"><span className="ofc-rf-icone"><Icon size={15} /></span><span>{meta.categoria}</span></div>
    <strong>{no.label}</strong><p>{resumo(no)}</p>
    {erro && <p className="ofc-rf-pend"><AlertTriangle size={11} aria-hidden /> {erro}</p>}
    {branches.length > 0 && <ul className="ofc-rf-saidas">{branches.map((branch) => <li key={branch.id}><span>{branch.label}</span><Handle type="source" position={Position.Right} id={branch.id} className="ofc-rf-porta" isConnectable={!somenteLeitura} /></li>)}</ul>}
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

/** A saída livre do nó de referência, se houver: é por ela que o passo novo
 *  entra já ligado, em vez de nascer solto esperando a pessoa descobrir que
 *  precisa arrastar uma linha. */
function saidaLivre(grafo: FollowupGraph, no: FollowupNode): string | null {
  const usadas = new Set(grafo.edges.filter((e) => e.source === no.id).map((e) => edgeBranchId(e)));
  return branchesForNode(no).find((b) => !usadas.has(b.id))?.id ?? null;
}

export type PropsCanvas = {
  graph: FollowupGraph;
  selectedId: string | null;
  somenteLeitura: boolean;
  /** Pendência de publicação por nó, para o cartão dizer o que falta nele. */
  erros?: Record<string, string>;
  onChange: (graph: FollowupGraph) => void;
  onSelect: (id: string | null) => void;
};

export function FollowupCanvas(props: PropsCanvas) {
  return <ReactFlowProvider><Lona {...props} /></ReactFlowProvider>;
}

function Lona({ graph, selectedId, somenteLeitura, erros, onChange, onSelect }: PropsCanvas) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const graphRef = useRef(graph); graphRef.current = graph;
  const selecaoRef = useRef(selectedId); selecaoRef.current = selectedId;

  const nodes = useMemo<NoRF[]>(() => graph.nodes.map((no) => ({
    id: no.id, type: "cadencia-no", position: no.position,
    data: { no, selecionado: no.id === selectedId, somenteLeitura, erro: erros?.[no.id], aoSelecionar: () => onSelect(no.id) },
    selected: no.id === selectedId,
    deletable: !somenteLeitura && no.type !== "trigger",
  })), [graph.nodes, selectedId, somenteLeitura, erros, onSelect]);

  // Aresta que aponta para nó que não existe mais é descartada no desenho em
  // vez de derrubar a tela: antes a origem era buscada com `!`.
  const edges = useMemo<ArestaRF[]>(() => {
    const porId = new Map(graph.nodes.map((n) => [n.id, n]));
    return graph.edges.filter((e) => porId.has(e.source) && porId.has(e.target)).map((edge) => ({
      id: edge.id, source: edge.source, target: edge.target, sourceHandle: edgeBranchId(edge), type: "cadencia-aresta" as const,
      data: {
        label: branchesForNode(porId.get(edge.source)!).find((b) => b.id === edgeBranchId(edge))?.label ?? edgeBranchId(edge),
        somenteLeitura,
        aoRemover: () => onChange({ ...graph, edges: graph.edges.filter((e) => e.id !== edge.id) }),
      },
    }));
  }, [graph, somenteLeitura, onChange]);

  // O primeiro enquadramento espera o nó ter medida, senão sai torto — a
  // mesma correção que o canvas de Fluxos já carrega.
  const medidos = useNodesInitialized();
  const enquadrado = useRef(false);
  useEffect(() => {
    if (!medidos || enquadrado.current) return;
    enquadrado.current = true;
    requestAnimationFrame(() => void fitView({ padding: 0.2, minZoom: ZOOM_MINIMO_LEGIVEL, maxZoom: 1 }));
  }, [medidos, fitView]);

  const enquadrar = useCallback(() => void fitView({ padding: 0.2, minZoom: ZOOM_MINIMO_LEGIVEL, maxZoom: 1, duration: 200 }), [fitView]);

  const organizar = useCallback(() => {
    if (somenteLeitura) return;
    onChange(organizarGrafo(graphRef.current));
    requestAnimationFrame(enquadrar);
  }, [enquadrar, onChange, somenteLeitura]);

  /** Acrescenta um passo.
   *
   *  Com posição (passo arrastado e solto) ele cai onde o cursor soltou, e
   *  ligar é com a pessoa.
   *
   *  Sem posição (clique no botão) ele ENTRA NA SEQUÊNCIA do passo de
   *  referência — o selecionado, ou o último que ainda tem saída: usa uma
   *  saída livre, e se não houver, entra NO MEIO (o que vinha depois do
   *  passo de referência passa a vir depois do novo). É o que a cadência
   *  recém-criada precisa: ela já nasce com Início ligado ao Fim, e antes
   *  disso o passo novo caía solto à direita do Fim, sem linha nenhuma.
   *  Depois de ligar, o desenho é redistribuído em colunas. */
  const adicionar = useCallback((type: FollowupNodeType, posicao?: { x: number; y: number }) => {
    if (somenteLeitura || type === "trigger") return;
    const atual = graphRef.current;
    const porProfundidade = [...atual.nodes].sort((a, b) => b.position.x - a.position.x || b.position.y - a.position.y);
    const referencia = atual.nodes.find((n) => n.id === selecaoRef.current)
      ?? porProfundidade.find((n) => branchesForNode(n).length > 0)
      ?? porProfundidade[0];

    const ocupado = (p: { x: number; y: number }) => atual.nodes.some((n) => Math.abs(n.position.x - p.x) < 60 && Math.abs(n.position.y - p.y) < 60);
    let destino = posicao ?? (referencia ? { x: referencia.position.x + LARGURA_COLUNA, y: referencia.position.y } : { x: 0, y: 0 });
    while (ocupado(destino)) destino = { x: destino.x, y: destino.y + ALTURA_LINHA };
    const no = novoNo(type, destino);

    const liga = (origem: FollowupNode, branch: string, alvo: string): FollowupEdge =>
      ({ id: `${origem.id}-${branch}-${alvo}`, source: origem.id, target: alvo, priority: 0, condition: conditionFor(origem, branch) });

    let edges = atual.edges;
    const livre = referencia && !posicao ? saidaLivre(atual, referencia) : null;
    if (referencia && livre) {
      edges = [...edges, liga(referencia, livre, no.id)];
    } else if (referencia && !posicao && type !== "end") {
      const antiga = atual.edges.find((e) => e.source === referencia.id);
      const saidaDoNovo = branchesForNode(no)[0];
      if (antiga && saidaDoNovo) {
        edges = [
          ...edges.filter((e) => e.id !== antiga.id),
          { ...antiga, id: `${referencia.id}-${edgeBranchId(antiga)}-${no.id}`, target: no.id },
          liga(no, saidaDoNovo.id, antiga.target),
        ];
      }
    }

    const proximo = { ...atual, nodes: [...atual.nodes, no], edges };
    onChange(posicao ? proximo : organizarGrafo(proximo));
    onSelect(no.id);
    if (!posicao) requestAnimationFrame(enquadrar);
  }, [enquadrar, onChange, onSelect, somenteLeitura]);

  const onNodesChange = useCallback((changes: NodeChange<NoRF>[]) => {
    const next = graphRef.current.nodes.map((node) => {
      const c = changes.find((x) => "id" in x && x.id === node.id);
      return c?.type === "position" && c.position ? { ...node, position: c.position } : node;
    });
    const selected = changes.find((x) => x.type === "select");
    if (selected && "id" in selected) onSelect(selected.selected ? selected.id : null);
    if (changes.some((c) => c.type === "position") && !somenteLeitura) onChange({ ...graphRef.current, nodes: next });
  }, [onChange, onSelect, somenteLeitura]);

  const onEdgesChange = useCallback((changes: EdgeChange<ArestaRF>[]) => {
    if (!somenteLeitura && changes.some((c) => c.type === "remove")) {
      onChange({ ...graphRef.current, edges: graphRef.current.edges.filter((e) => !changes.some((c) => c.type === "remove" && c.id === e.id)) });
    }
  }, [onChange, somenteLeitura]);

  const onConnect = useCallback((connection: Connection) => {
    if (somenteLeitura || !connection.source || !connection.target || !connection.sourceHandle || connection.source === connection.target) return;
    const source = graphRef.current.nodes.find((n) => n.id === connection.source);
    if (!source) return;
    const edge: FollowupEdge = {
      id: `${connection.source}-${connection.sourceHandle}-${connection.target}`,
      source: connection.source, target: connection.target, priority: 0,
      condition: conditionFor(source, connection.sourceHandle),
    };
    onChange({ ...graphRef.current, edges: [...graphRef.current.edges.filter((e) => !(e.source === edge.source && edgeBranchId(e) === connection.sourceHandle)), edge] });
  }, [onChange, somenteLeitura]);

  const onDelete = useCallback(({ nodes: ns, edges: es }: { nodes: NoRF[]; edges: ArestaRF[] }) => {
    if (somenteLeitura) return;
    const ids = new Set(ns.map((n) => n.id));
    onChange({
      ...graphRef.current,
      nodes: graphRef.current.nodes.filter((n) => !ids.has(n.id)),
      edges: graphRef.current.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target) && !es.some((x) => x.id === e.id)),
    });
    onSelect(null);
  }, [onChange, onSelect, somenteLeitura]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const type = event.dataTransfer.getData("application/x-onface-cadencia-no") as FollowupNodeType;
    if (!type) return;
    // Centro do cartão no cursor (268 × ~130), não o canto.
    const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    adicionar(type, { x: Math.round(p.x - 134), y: Math.round(p.y - 60) });
  };

  return <div className="ofc-rf-wrap" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
    <div className="ofc-rf-toolbar" role="toolbar" aria-label="Montar o fluxo">
      <span className="ofc-rf-toolbar-rotulo">Adicionar</span>
      {PARA_ADICIONAR.map((type) => {
        const Icon = META[type].Icon;
        return <button key={type} type="button" draggable={!somenteLeitura} disabled={somenteLeitura}
          title={somenteLeitura ? undefined : "Entra ligado ao passo selecionado — ou arraste para soltar onde quiser"}
          onDragStart={(e) => e.dataTransfer.setData("application/x-onface-cadencia-no", type)}
          onClick={() => adicionar(type)}>
          <Icon size={13} aria-hidden /> {META[type].titulo}
        </button>;
      })}
      <span className="ofc-rf-toolbar-espaco" />
      <button type="button" disabled={somenteLeitura} title="Redistribuir os passos em colunas, da esquerda para a direita" onClick={organizar}>
        <LayoutGrid size={13} aria-hidden /> Organizar
      </button>
      <button type="button" title="Enquadrar o fluxo inteiro" onClick={enquadrar}>
        <Crosshair size={13} aria-hidden /> Enquadrar
      </button>
    </div>
    <div className={`ofc-rf-canvas${dragging ? " ofc-rf-drop" : ""}`} aria-label="Fluxo visual ramificado">
      <ReactFlow<NoRF, ArestaRF>
        nodes={nodes}
        edges={edges}
        nodeTypes={{ "cadencia-no": NoCadencia }}
        edgeTypes={{ "cadencia-aresta": ArestaCadencia }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        onPaneClick={() => onSelect(null)}
        nodesDraggable={!somenteLeitura}
        nodesConnectable={!somenteLeitura}
        deleteKeyCode={somenteLeitura ? null : ["Delete", "Backspace"]}
        minZoom={0.3}
        maxZoom={1.6}
        snapToGrid
        snapGrid={[16, 16]}
        connectionRadius={28}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1.2} />
        <Controls showInteractive={false} className="ofc-rf-controles" position="bottom-left" />
        <MiniMap pannable zoomable className="ofc-rf-minimapa" nodeBorderRadius={8} nodeClassName={(n) => `ofc-rf-mini ofc-rf-mini-${(n as NoRF).data.no.type}`} />
      </ReactFlow>
    </div>
  </div>;
}
