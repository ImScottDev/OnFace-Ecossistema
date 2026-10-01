"use client";

/* Canvas do construtor (React Flow 12). Os nós e arestas do React Flow são
 * DERIVADOS do grafo a cada render; o canvas só traduz gestos (arrastar,
 * ligar, soltar da paleta, apagar) em operações puras de operacoes.ts e as
 * devolve ao editor. A medida de cada nó é guardada aqui e reinjetada, senão
 * o React Flow perde o tamanho a cada derivação e esconde o nó. */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Background, BackgroundVariant, BaseEdge, Controls, EdgeLabelRenderer, MiniMap, ReactFlow, getBezierPath, useNodesInitialized, useReactFlow,
  type Connection, type Edge, type EdgeProps, type IsValidConnection, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X } from "lucide-react";
import { saidasDoNo, type GrafoFluxo, type OpcoesInspetor, type Pendencia, type TipoNo } from "@/lib/automacoes/grafo";
import { NoCanvas, type DadosNo, type MarcaTrilha, type NoRF } from "./NoCanvas";
import { adicionarNo, ligar, motivoNaoLigar, remover } from "./operacoes";
import type { OpcoesMudanca } from "./useEditorFluxo";

export const DND_TIPO = "application/x-onface-bloco";

export interface Selecao { nos: string[]; arestas: string[] }

export interface TrilhaCanvas {
  nos: Record<string, { marca: MarcaTrilha; saida: string | null }>;
  arestas: string[];
}

type DadosAresta = { percorrida: boolean; somenteLeitura: boolean; aoRemover: (id: string) => void };
type ArestaRF = Edge<DadosAresta, "aresta">;

function Aresta({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data, markerEnd }: EdgeProps<ArestaRF>) {
  const [caminho, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={caminho} markerEnd={markerEnd} className="ofx-aresta" data-percorrida={data?.percorrida ? "true" : undefined} data-selecionada={selected ? "true" : undefined} interactionWidth={18} />
      {selected && !data?.somenteLeitura && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="ofx-aresta-x nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
            onClick={() => data?.aoRemover(id)}
            aria-label="Remover ligação"
            title="Remover ligação (Delete)"
          >
            <X size={12} strokeWidth={2.6} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const TIPOS_NO = { no: NoCanvas };
const TIPOS_ARESTA = { aresta: Aresta };

export function Canvas({
  grafo, pendencias, opcoes, selecao, trilha, somenteLeitura,
  mudar, marcar, selecionar, aoMais, aoRecusar,
}: {
  grafo: GrafoFluxo;
  pendencias: Pendencia[];
  opcoes?: OpcoesInspetor;
  selecao: Selecao;
  trilha: TrilhaCanvas | null;
  somenteLeitura: boolean;
  mudar: (fn: (g: GrafoFluxo) => GrafoFluxo, opcoes?: OpcoesMudanca) => void;
  marcar: () => void;
  selecionar: (s: Selecao) => void;
  aoMais: (noId: string, saidaId: string) => void;
  aoRecusar: (motivo: string) => void;
}) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const [medidas, setMedidas] = useState<Record<string, { width: number; height: number }>>({});

  // O fitView do primeiro render roda antes de o nó ter medida (as medidas
  // voltam por estado) e enquadrava o desenho torto. Enquadra uma vez, já medido.
  const medidos = useNodesInitialized();
  const enquadrado = useRef(false);
  useEffect(() => {
    if (!medidos || enquadrado.current) return;
    enquadrado.current = true;
    requestAnimationFrame(() => void fitView({ padding: 0.25, maxZoom: 1 }));
  }, [medidos, fitView]);

  // Seleção é do editor (o inspetor depende dela). O React Flow só propõe
  // mudanças; o ref evita fechar sobre uma seleção velha entre dois eventos
  // do mesmo clique (desmarca nó + marca aresta).
  const selecaoRef = useRef(selecao);
  selecaoRef.current = selecao;
  const aplicarSelecao = useCallback((qual: "nos" | "arestas", mudancas: Map<string, boolean>) => {
    const atual = selecaoRef.current;
    const lista = new Set(atual[qual]);
    for (const [id, marcado] of mudancas) { if (marcado) lista.add(id); else lista.delete(id); }
    const proxima = { ...atual, [qual]: [...lista] };
    selecaoRef.current = proxima;
    selecionar(proxima);
  }, [selecionar]);

  const removerAresta = useCallback((id: string) => mudar((g) => remover(g, [], [id])), [mudar]);

  const nodes = useMemo<NoRF[]>(() => {
    const porNo = new Map<string, Pendencia[]>();
    for (const p of pendencias) if (p.noId) porNo.set(p.noId, [...(porNo.get(p.noId) ?? []), p]);
    const usadas = new Set(grafo.arestas.map((a) => `${a.origem}:${a.saida}`));
    return grafo.nos.map((no) => {
      const dados: DadosNo = {
        no, opcoes, somenteLeitura, aoMais,
        pendencias: porNo.get(no.id) ?? [],
        livres: saidasDoNo(no).map((s) => s.id).filter((id) => !usadas.has(`${no.id}:${id}`)),
        trilha: trilha?.nos[no.id],
      };
      return {
        id: no.id, type: "no" as const, position: no.posicao, data: dados,
        selected: selecao.nos.includes(no.id),
        deletable: !somenteLeitura && no.tipo !== "gatilho",
        measured: medidas[no.id],
      };
    });
  }, [grafo, pendencias, opcoes, selecao.nos, trilha, somenteLeitura, aoMais, medidas]);

  const edges = useMemo<ArestaRF[]>(() => grafo.arestas.map((a) => ({
    id: a.id, source: a.origem, sourceHandle: a.saida, target: a.destino, type: "aresta" as const,
    selected: selecao.arestas.includes(a.id),
    deletable: !somenteLeitura,
    data: { percorrida: Boolean(trilha?.arestas.includes(a.id)), somenteLeitura, aoRemover: removerAresta },
  })), [grafo.arestas, selecao.arestas, trilha, somenteLeitura, removerAresta]);

  const onNodesChange = useCallback((changes: NodeChange<NoRF>[]) => {
    const posicoes = new Map<string, { x: number; y: number }>();
    let novasMedidas: Record<string, { width: number; height: number }> | null = null;
    const sel = new Map<string, boolean>();
    for (const c of changes) {
      if (c.type === "select") sel.set(c.id, c.selected);
      if (c.type === "position" && c.position) posicoes.set(c.id, c.position);
      if (c.type === "dimensions" && c.dimensions) {
        novasMedidas ??= {};
        novasMedidas[c.id] = c.dimensions;
      }
    }
    if (novasMedidas) {
      const m = novasMedidas;
      setMedidas((atual) => {
        const mudou = Object.entries(m).some(([id, d]) => atual[id]?.width !== d.width || atual[id]?.height !== d.height);
        return mudou ? { ...atual, ...m } : atual;
      });
    }
    if (sel.size) aplicarSelecao("nos", sel);
    // O passo de desfazer do arraste é marcado no início (onNodeDragStart);
    // cada quadro do arraste só atualiza a posição.
    if (posicoes.size && !somenteLeitura) {
      mudar((g) => ({ ...g, nos: g.nos.map((n) => (posicoes.has(n.id) ? { ...n, posicao: posicoes.get(n.id)! } : n)) }), { historico: false });
    }
  }, [mudar, somenteLeitura, aplicarSelecao]);

  // Remoção vem por onDelete (um passo de desfazer para nós + ligações).
  const onEdgesChange = useCallback((changes: EdgeChange<ArestaRF>[]) => {
    const sel = new Map<string, boolean>();
    for (const c of changes) if (c.type === "select") sel.set(c.id, c.selected);
    if (sel.size) aplicarSelecao("arestas", sel);
  }, [aplicarSelecao]);

  const isValidConnection = useCallback<IsValidConnection>((c) => (
    !!c.source && !!c.target && !!c.sourceHandle && !motivoNaoLigar(grafo, c.source, c.sourceHandle, c.target)
  ), [grafo]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || !c.sourceHandle) return;
    const motivo = motivoNaoLigar(grafo, c.source, c.sourceHandle, c.target);
    if (motivo) { aoRecusar(motivo); return; }
    mudar((g) => ligar(g, c.source, c.sourceHandle!, c.target));
  }, [grafo, mudar, aoRecusar]);

  const onDelete = useCallback(({ nodes: n, edges: e }: { nodes: NoRF[]; edges: ArestaRF[] }) => {
    if (somenteLeitura) return;
    mudar((g) => remover(g, n.map((x) => x.id), e.map((x) => x.id)));
    selecionar({ nos: [], arestas: [] });
  }, [mudar, selecionar, somenteLeitura]);

  const onDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_TIPO)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    const tipo = e.dataTransfer.getData(DND_TIPO) as TipoNo;
    if (!tipo || somenteLeitura) return;
    e.preventDefault();
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    let id = "";
    // Centro do cartão no cursor (272 × ~110), não o canto.
    mudar((g) => { const r = adicionarNo(g, tipo, { posicao: { x: p.x - 136, y: p.y - 40 } }); id = r.id; return r.grafo; });
    if (id) selecionar({ nos: [id], arestas: [] });
  }, [mudar, screenToFlowPosition, selecionar, somenteLeitura]);

  return (
    <div className="ofx-canvas" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow<NoRF, ArestaRF>
        nodes={nodes}
        edges={edges}
        nodeTypes={TIPOS_NO}
        edgeTypes={TIPOS_ARESTA}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onDelete={onDelete}
        onNodeDragStart={marcar}
        onPaneClick={() => selecionar({ nos: [], arestas: [] })}
        nodesDraggable={!somenteLeitura}
        nodesConnectable={!somenteLeitura}
        deleteKeyCode={somenteLeitura ? null : ["Delete", "Backspace"]}
        snapToGrid
        snapGrid={[16, 16]}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.75}
        defaultEdgeOptions={{ type: "aresta" }}
        connectionRadius={28}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1.2} className="ofx-fundo" />
        <Controls showInteractive={false} className="ofx-controles" position="bottom-left" />
        <MiniMap pannable zoomable className="ofx-minimapa" nodeBorderRadius={8} nodeClassName={(n) => `ofx-mini-${(n as NoRF).data.no.tipo === "gatilho" ? "gatilho" : "no"}`} />
      </ReactFlow>
    </div>
  );
}
