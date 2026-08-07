"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PipelineStage } from "@/lib/crm/pipeline";
import { usePipelineConfig, usePipelines } from "@/hooks/usePipelineConfig";
import { Kanban, List, Search, ChevronRight, AlertTriangle, X, Trash2, XCircle, Trophy, Plus, MoreHorizontal, CalendarClock } from "lucide-react";
import { STAGNATION_REASONS } from "@/lib/crm/pipeline";
import { ButtonSpinner } from "@/components/crm/ButtonSpinner";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { SkeletonKanbanColumn } from "@/components/crm/Skeleton";
import { EmptyState } from "@/components/crm/EmptyState";
import { Briefcase } from "lucide-react";
import { BoardFilters, OwnerChip, useOrgUsuarios, matchesResponsavel } from "@/components/crm/BoardFilters";

interface Negocio {
  id: string;
  leadId: string;
  titulo: string;
  status: string;
  tipoReceita: string | null;
  mrrEstimado: string | null;
  valorProjeto: string | null;
  mrrFechado: string | null;
  valorSetup: string | null;
  origemNegocio: string;
  servicosInteresse: string[] | null;
  createdAt: string;
  updatedAt: string;
  ganhoAt: string | null;
  leadNome: string;
  leadEmpresa: string | null;
  leadTelefone: string;
  leadEmail: string | null;
  leadScore: number;
  leadTipo: string;
  empresaId: string | null;
  empresaNome: string | null;
  temperatura: string | null;
  valorTotal: string | null;
  previsaoFechamento: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  responsavelAvatar: string | null;
  pipelineId: string | null;
  origemQualificacao?: string | null;
  proximaReuniaoData?: string | null;
  proximaReuniaoLink?: string | null;
  proximaReuniaoConvidado?: string | null;
  cipaScore: number | null;
  lpUrl: string | null;
  pipelineNome: string | null;
}

/** Returns time in stage as { text, ratio } where ratio = elapsed/SLA */
function stageAge(status: string, updatedAt: string, slaMap: Record<string, number> = {}) {
  const ms = Date.now() - new Date(updatedAt).getTime();
  const mins = Math.floor(ms / 60000);
  const hours = ms / (1000 * 60 * 60);
  const sla = slaMap[status] || 48;
  const ratio = hours / sla;

  let text: string;
  if (mins < 60) text = `${mins}min`;
  else if (mins < 1440) text = `${Math.floor(mins / 60)}h`;
  else text = `${Math.floor(mins / 1440)}d`;

  // green < 50%, yellow 50-100%, red > 100%
  let color: string;
  let bg: string;
  if (ratio < 0.5) {
    color = "#10B981";
    bg = "rgba(16,185,129,0.15)";
  } else if (ratio <= 1) {
    color = "#F59E0B";
    bg = "rgba(245,158,11,0.15)";
  } else {
    color = "#EF4444";
    bg = "rgba(239,68,68,0.15)";
  }

  return { text, ratio, color, bg, breached: ratio > 1 };
}

/** Check if deal has missing important fields */
function hasIncompleteData(n: Negocio) {
  const total = parseFloat(n.valorTotal || "0") || 0;
  return total === 0 || !n.temperatura || n.temperatura === "indefinido" || !n.empresaId;
}

function formatBRL(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const { stages: defaultStages, closedStages: defaultClosedStages, slaHours, getStatusInfo } = usePipelineConfig();
  const { pipelines } = usePipelines();
  const { usuarios, currentUserId } = useOrgUsuarios();
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [respFilter, setRespFilter] = useState("todos");
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [showNewNegocio, setShowNewNegocio] = useState(false);
  const [newNegocioStage, setNewNegocioStage] = useState<string | undefined>(undefined);
  const [pipelineView, setPipelineView] = useState<"novos" | "carteira" | "estagnados">("novos");

  // Stagnation stages (shown when pipelineView === "estagnados")
  const stagnationStages: PipelineStage[] = [
    { key: "sem_retorno", label: "Sem Retorno de Contato", color: "#8e27ef" },
    { key: "trava_negociacao", label: "Trava na Negociação", color: "#EAB308" },
    { key: "trava_assinatura", label: "Trava na Assinatura do Contrato", color: "#EAB308" },
    { key: "outra_data", label: "Quer Negociar em Outra Data", color: "#8B5CF6" },
  ];

  // Determine active pipeline and its stages
  const hasPipelines = pipelines.length > 0;
  const activePipeline = hasPipelines
    ? (selectedPipelineId ? pipelines.find((p) => p.id === selectedPipelineId) : pipelines.find((p) => p.isDefault) || pipelines[0])
    : null;
  const stages: PipelineStage[] = activePipeline ? (activePipeline.stages as PipelineStage[]) : defaultStages;
  const closedStages: PipelineStage[] = activePipeline ? (activePipeline.closedStages as PipelineStage[]) : defaultClosedStages;

  // Determine which stages to show based on view
  const displayStages = pipelineView === "estagnados" ? stagnationStages : stages;
  const displayClosedStages = pipelineView === "estagnados" ? [] : closedStages;
  const origemFilter = pipelineView === "carteira" ? "carteira" : "novo";

  // Filtro de responsável aplicado NO SERVIDOR (senão a API só traz 500 e o
  // filtro client-side fica "ilusório"). "meu" vira o id do usuário atual.
  const applyServerFilters = useCallback((params: URLSearchParams) => {
    const r = respFilter === "meu" ? (currentUserId || "") : respFilter;
    if (r && r !== "todos") params.set("responsavelId", r);
  }, [respFilter, currentUserId]);
  const filterKey = [respFilter, currentUserId];

  // Fetch open deals
  const { data, isLoading } = useQuery({
    queryKey: ["pipeline", activePipeline?.id || "default", displayStages, pipelineView, filterKey],
    queryFn: async () => {
      if (pipelineView === "estagnados") {
        // Estagnados: fetch deals with stagnation status
        const params = new URLSearchParams({ limit: "500" });
        params.set("status", stagnationStages.map((s) => s.key).join(","));
        applyServerFilters(params);
        const res = await fetch(`/api/negocios?${params}`);
        return res.json();
      }
      const params = new URLSearchParams({ limit: "500", origemNegocio: origemFilter });
      params.set("status", stages.map((s) => s.key).join(","));
      if (activePipeline?.id) params.set("pipelineId", activePipeline.id);
      applyServerFilters(params);
      const res = await fetch(`/api/negocios?${params}`);
      return res.json();
    },
  });

  // Fetch closed deals (not for estagnados)
  const { data: closedData } = useQuery({
    queryKey: ["pipeline-closed", activePipeline?.id || "default", displayClosedStages, pipelineView, filterKey],
    queryFn: async () => {
      if (pipelineView === "estagnados" || displayClosedStages.length === 0) return { negocios: [] };
      const params = new URLSearchParams({ limit: "1000", origemNegocio: origemFilter });
      params.set("status", displayClosedStages.map((s) => s.key).join(","));
      if (activePipeline?.id) params.set("pipelineId", activePipeline.id);
      applyServerFilters(params);
      const res = await fetch(`/api/negocios?${params}`);
      return res.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, motivoPerda, motivoPerdaDetalhe }: { id: string; status: string; motivoPerda?: string; motivoPerdaDetalhe?: string }) => {
      const res = await fetch(`/api/negocios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(motivoPerda ? { motivoPerda } : {}), ...(motivoPerdaDetalhe ? { motivoPerdaDetalhe } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao mover negócio" }));
        throw new Error(err.error || "Erro ao mover negócio");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      const stageName = getStatusInfo(vars.status).label;
      toast.success(`Movido para ${stageName}`);
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      if (vars.status === "contrato" || vars.status === "ganho") {
        queryClient.invalidateQueries({ queryKey: ["carteira"] });
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao mover negócio"),
  });

  const deleteNegocio = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/negocios/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Negócio excluído");
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: () => toast.error("Erro ao excluir negócio"),
  });

  const allNegocios: Negocio[] = data?.negocios || [];
  const closedNegocios: Negocio[] = closedData?.negocios || [];

  // Client-side filters: busca + responsável
  const matchNegocio = useCallback((n: Negocio, q: string) => {
    if (!matchesResponsavel(n.responsavelId, respFilter, currentUserId)) return false;
    if (!q) return true;
    return (
      n.titulo.toLowerCase().includes(q) ||
      n.leadNome.toLowerCase().includes(q) ||
      (n.empresaNome || "").toLowerCase().includes(q) ||
      (n.leadEmpresa || "").toLowerCase().includes(q)
    );
  }, [respFilter, currentUserId]);

  const filteredNegocios = useMemo(
    () => allNegocios.filter((n) => matchNegocio(n, searchQuery.trim().toLowerCase())),
    [allNegocios, searchQuery, matchNegocio]
  );

  const filteredClosedNegocios = useMemo(
    () => closedNegocios.filter((n) => matchNegocio(n, searchQuery.trim().toLowerCase())),
    [closedNegocios, searchQuery, matchNegocio]
  );

  const totalPipelineValue = filteredNegocios.reduce(
    (sum, n) => sum + (parseFloat(n.mrrEstimado || "0") || 0) + (parseFloat(n.valorProjeto || "0") || 0),
    0
  );

  const [lossModalNegocioId, setLossModalNegocioId] = useState<string | null>(null);

  const handleDrop = (negocioId: string, newStatus: string) => {
    if (newStatus === "perdido") {
      // Fluxo decidido pelo Scott (12/jun): "Perdido" abre escolha — estagnar
      // (4 motivos do board Estagnados) OU perda real com motivo + detalhe.
      setLossModalNegocioId(negocioId);
      return;
    }
    updateStatus.mutate({ id: negocioId, status: newStatus });
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 shrink-0">
        {/* Row 1: Title + Value + New button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>Pipeline</h1>
              <p className="text-[12px] text-white/40 hidden sm:block">Arraste os cards entre as etapas para avançar negócios no funil.</p>
            </div>
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="text-lg font-bold text-white tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
                {formatBRL(totalPipelineValue)}
              </span>
              <span className="text-xs text-white/30 hidden sm:inline">
                {filteredNegocios.length} negócio{filteredNegocios.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowNewNegocio(true)}
            className="flex items-center gap-2 px-4 py-2 btn-primary rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo</span> Negócio
          </button>
        </div>

        {/* Row 2: Search + Tabs + View toggle */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar negócio..."
              className="w-36 sm:w-44 pl-8 pr-7 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/40 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <BoardFilters
            usuarios={usuarios}
            currentUserId={currentUserId}
            resp={respFilter}
            setResp={setRespFilter}
            showPeriodo={false}
            accent="#8e27ef"
          />

          {/* Pipeline view tabs (Novos / Carteira / Estagnados) */}
          <div className="flex gap-1 p-0.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
            {([
              { key: "novos" as const, label: "Novos" },
              { key: "carteira" as const, label: "Carteira" },
              { key: "estagnados" as const, label: "Estagnados" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPipelineView(tab.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  pipelineView === tab.key ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
                style={pipelineView === tab.key ? { background: pipelineView === "estagnados" ? "rgba(239,68,68,0.2)" : "rgba(108,92,231,0.2)" } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Pipeline tabs */}
          {hasPipelines && pipelineView !== "estagnados" && (
            <div className="flex gap-1 p-0.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
              {pipelines.filter((p) => p.ativo).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPipelineId(p.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    (activePipeline?.id === p.id) ? "text-white" : "text-white/40 hover:text-white/70"
                  }`}
                  style={(activePipeline?.id === p.id) ? { background: "rgba(108,92,231,0.2)" } : {}}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          )}

          {/* View toggle */}
          <div className="flex gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "kanban" ? "text-white bg-white/10" : "text-white/40"}`}
              title="Kanban"
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("lista")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "lista" ? "text-white bg-white/10" : "text-white/40"}`}
              title="Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <SkeletonKanbanColumn count={5} />
        ) : viewMode === "kanban" ? (
          <KanbanView negocios={filteredNegocios} closedNegocios={filteredClosedNegocios} closedStages={displayClosedStages} onDrop={handleDrop} onOpenNegocio={(id) => setDrawerNegocioId(id)} stages={displayStages} slaHours={slaHours} onDeleteNegocio={(id) => deleteNegocio.mutate(id)} onAddNegocio={(stageKey) => { setNewNegocioStage(stageKey); setShowNewNegocio(true); }} />
        ) : (
          <ListView negocios={filteredNegocios} onOpenNegocio={(id) => setDrawerNegocioId(id)} stages={displayStages} slaHours={slaHours} getStatusInfo={getStatusInfo} />
        )}
      </div>

            {lossModalNegocioId && (
        <LossOrStagnateModal
          onClose={() => setLossModalNegocioId(null)}
          onStagnate={(reason) => {
            updateStatus.mutate({ id: lossModalNegocioId, status: reason });
            setLossModalNegocioId(null);
          }}
          onLose={(motivo, detalhe) => {
            updateStatus.mutate({ id: lossModalNegocioId, status: "perdido", motivoPerda: motivo, motivoPerdaDetalhe: detalhe });
            setLossModalNegocioId(null);
          }}
        />
      )}
      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenLead={(id) => { setDrawerNegocioId(null); setDrawerLeadId(id); }}
        onOpenEmpresa={(id) => { setDrawerNegocioId(null); setDrawerEmpresaId(id); }}
      />
      <LeadDrawer
        leadId={drawerLeadId}
        open={!!drawerLeadId}
        onClose={() => setDrawerLeadId(null)}
        onOpenEmpresa={(id) => { setDrawerLeadId(null); setDrawerEmpresaId(id); }}
        onOpenNegocio={(id) => { setDrawerLeadId(null); setDrawerNegocioId(id); }}
      />
      <EmpresaDrawer
        empresaId={drawerEmpresaId}
        open={!!drawerEmpresaId}
        onClose={() => setDrawerEmpresaId(null)}
        onOpenLead={(id) => { setDrawerEmpresaId(null); setDrawerLeadId(id); }}
        onOpenNegocio={(id) => { setDrawerEmpresaId(null); setDrawerNegocioId(id); }}
      />

      {showNewNegocio && (
        <NewNegocioModal
          pipelineId={activePipeline?.id || null}
          initialStatus={newNegocioStage}
          onClose={() => { setShowNewNegocio(false); setNewNegocioStage(undefined); }}
          onCreated={(id) => {
            setShowNewNegocio(false);
            setNewNegocioStage(undefined);
            queryClient.invalidateQueries({ queryKey: ["pipeline"] });
            setDrawerNegocioId(id);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   KANBAN VIEW
   ═══════════════════════════════════════════════════ */

function KanbanView({ negocios, closedNegocios, closedStages, onDrop, onOpenNegocio, stages, slaHours, onDeleteNegocio, onAddNegocio }: { negocios: Negocio[]; closedNegocios: Negocio[]; closedStages: { key: string; label: string; color: string }[]; onDrop: (id: string, status: string) => void; onOpenNegocio: (id: string) => void; stages: { key: string; label: string; color: string }[]; slaHours: Record<string, number>; onDeleteNegocio: (id: string) => void; onAddNegocio: (stageKey: string) => void }) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingNegocioId, setDraggingNegocioId] = useState<string | null>(null);
  const [dragOverAction, setDragOverAction] = useState<string | null>(null);
  const [expandedClosed, setExpandedClosed] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Ctrl+Space pan mode
  useEffect(() => {
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      if ((e.ctrlKey || e.metaKey) && e.code === "Space") {
        e.preventDefault();
        setIsPanMode(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
      if (e.code === "Space" || e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "MetaLeft" || e.code === "MetaRight") {
        if (!keys.has("Space") || (!keys.has("ControlLeft") && !keys.has("ControlRight") && !keys.has("MetaLeft") && !keys.has("MetaRight"))) {
          setIsPanMode(false);
          setIsPanning(false);
        }
      }
    };
    const onBlur = () => { keys.clear(); setIsPanMode(false); setIsPanning(false); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur); };
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isPanMode || !containerRef.current) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
  }, [isPanMode]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !containerRef.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    containerRef.current.scrollLeft = panStart.current.scrollLeft - dx;
    containerRef.current.scrollTop = panStart.current.scrollTop - dy;
  }, [isPanning]);

  const onMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div className="relative h-full">
      {isPanMode && (
        <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-medium pointer-events-none">
          Modo navegar
        </div>
      )}
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 h-full"
        style={{
          cursor: isPanMode ? (isPanning ? "grabbing" : "grab") : "default",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {stages.map((stage, stageIdx) => {
          const stageNegocios = negocios.filter((n) => n.status === stage.key);
          const totalMrr = stageNegocios.reduce((sum, n) => sum + (parseFloat(n.mrrEstimado || "0") || 0), 0);
          const totalProj = stageNegocios.reduce((sum, n) => sum + (parseFloat(n.valorProjeto || "0") || 0), 0);
          const totalStage = totalMrr + totalProj;
          const isDragOver = dragOverStage === stage.key;

          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-[260px] sm:w-[280px] rounded-2xl flex flex-col max-h-full"
              style={{
                background: isDragOver ? `${stage.color}08` : "rgba(255,255,255,0.02)",
                border: isDragOver ? `2px dashed ${stage.color}` : "1px solid rgba(255,255,255,0.06)",
                animation: `fadeUp 0.3s ease-out ${stageIdx * 0.05}s both`,
                transition: "background 0.2s ease, border 0.2s ease",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverStage(stage.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverStage(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                const negocioId = e.dataTransfer.getData("negocioId");
                if (negocioId) onDrop(negocioId, stage.key);
              }}
            >
              {/* Column header */}
              <div className="px-3 pt-3 pb-2 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{stage.label}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${stage.color}15`, color: stage.color }}
                  >
                    {stageNegocios.length}
                  </span>
                </div>
                <p className="text-sm font-bold mt-1.5 ml-[18px]" style={{ color: stage.color }}>
                  {totalStage > 0 ? formatBRL(totalStage) : "R$ 0"}
                </p>
                {totalMrr > 0 && totalProj > 0 && (
                  <p className="text-[10px] text-white/25 ml-[18px]">
                    Rec {((totalMrr / totalStage) * 100).toFixed(0)}% / Avulso {((totalProj / totalStage) * 100).toFixed(0)}%
                  </p>
                )}
              </div>

              {/* Cards — independent vertical scroll per column */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0 scrollbar-thin">
                {stageNegocios.map((neg) => (
                  <NegocioCard key={neg.id} negocio={neg} stageColor={stage.color} onOpenNegocio={onOpenNegocio} slaHours={slaHours} onDragStart={() => setDraggingNegocioId(neg.id)} onDragEnd={() => setDraggingNegocioId(null)} onChangeStatus={(newStatus) => onDrop(neg.id, newStatus)} stages={stages} />
                ))}
              </div>

              {/* Add negocio button */}
              <button
                onClick={() => onAddNegocio(stage.key)}
                className="shrink-0 mx-2 mb-2 py-1.5 rounded-lg border border-dashed border-white/[0.08] hover:border-white/20 text-white/25 hover:text-white/50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Adicionar</span>
              </button>
            </div>
          );
        })}

        {/* Separator */}
        {closedStages.length > 0 && closedNegocios.length > 0 && (
          <div className="flex-shrink-0 flex items-center px-1">
            <div className="w-px h-2/3 bg-white/[0.08]" />
          </div>
        )}

        {/* Closed stages — collapsible columns */}
        {closedStages.map((stage) => {
          const stageNegocios = closedNegocios.filter((n) => n.status === stage.key);
          // No-show sempre visível (mesmo vazio) pra o closer poder arrastar pra ela; demais fechadas só com itens
          if (stageNegocios.length === 0 && stage.key !== "no_show") return null;
          const isExpanded = expandedClosed.has(stage.key);
          const totalValue = stageNegocios.reduce((sum, n) => sum + (parseFloat(n.mrrEstimado || "0") || 0) + (parseFloat(n.valorProjeto || "0") || 0), 0);
          const isDragOver = dragOverStage === stage.key;

          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 rounded-2xl flex flex-col max-h-full transition-all duration-300 ${isExpanded ? "w-[260px]" : "w-[52px]"}`}
              style={{
                background: isDragOver ? `${stage.color}08` : "rgba(255,255,255,0.015)",
                border: isDragOver ? `2px dashed ${stage.color}` : "1px solid rgba(255,255,255,0.04)",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => { e.preventDefault(); setDragOverStage(stage.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                const negocioId = e.dataTransfer.getData("negocioId");
                if (negocioId) onDrop(negocioId, stage.key);
              }}
            >
              {isExpanded ? (
                <>
                  {/* Expanded header */}
                  <button
                    onClick={() => setExpandedClosed((prev) => { const s = new Set(prev); s.delete(stage.key); return s; })}
                    className="px-3 pt-3 pb-2 border-b border-white/[0.04] shrink-0 text-left w-full hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full opacity-60" style={{ backgroundColor: stage.color }} />
                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{stage.label}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${stage.color}10`, color: `${stage.color}99` }}>
                        {stageNegocios.length}
                      </span>
                    </div>
                    {totalValue > 0 && (
                      <p className="text-xs font-medium mt-1 ml-[18px] text-white/30">{formatBRL(totalValue)}</p>
                    )}
                  </button>
                  {/* Cards */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0 scrollbar-thin">
                    {stageNegocios.map((neg) => (
                      <NegocioCard key={neg.id} negocio={neg} stageColor={stage.color} onOpenNegocio={onOpenNegocio} slaHours={slaHours} onDragStart={() => setDraggingNegocioId(neg.id)} onDragEnd={() => setDraggingNegocioId(null)} onChangeStatus={(newStatus) => onDrop(neg.id, newStatus)} stages={stages} />
                    ))}
                  </div>
                </>
              ) : (
                /* Collapsed — vertical label */
                <button
                  onClick={() => setExpandedClosed((prev) => { const s = new Set(prev); s.add(stage.key); return s; })}
                  className="flex flex-col items-center gap-3 py-4 px-1 h-full hover:bg-white/[0.03] transition-colors rounded-2xl"
                >
                  <div className="w-2.5 h-2.5 rounded-full opacity-50" style={{ backgroundColor: stage.color }} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${stage.color}10`, color: `${stage.color}80` }}>
                    {stageNegocios.length}
                  </span>
                  <span
                    className="text-[10px] font-semibold text-white/30 uppercase tracking-widest"
                    style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                  >
                    {stage.label}
                  </span>
                  {totalValue > 0 && (
                    <span className="text-[9px] text-white/20 mt-auto" style={{ writingMode: "vertical-rl" }}>
                      {formatBRL(totalValue)}
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Action Bar — appears when dragging */}
      {draggingNegocioId && (
        <div
          className="absolute bottom-0 left-0 right-0 flex gap-2 p-3 z-20"
          style={{ animation: "slideUp 0.2s ease-out" }}
        >
          {[
            { key: "excluir", label: "EXCLUIR", icon: Trash2, color: "#EF4444", bg: "rgba(239,68,68,0.08)", hoverBg: "rgba(239,68,68,0.2)" },
            { key: "perdido", label: "PERDIDO", icon: XCircle, color: "#EF4444", bg: "rgba(239,68,68,0.08)", hoverBg: "rgba(239,68,68,0.2)" },
            { key: "ganho", label: "GANHO", icon: Trophy, color: "#10B981", bg: "rgba(16,185,129,0.08)", hoverBg: "rgba(16,185,129,0.2)" },
          ].map((action) => {
            const Icon = action.icon;
            const isOver = dragOverAction === action.key;
            return (
              <div
                key={action.key}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all duration-200"
                style={{
                  background: isOver ? action.hoverBg : action.bg,
                  borderColor: isOver ? action.color : `${action.color}30`,
                  transform: isOver ? "scale(1.02)" : "scale(1)",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverAction(action.key); }}
                onDragEnter={(e) => { e.preventDefault(); setDragOverAction(action.key); }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverAction(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverAction(null);
                  const negId = e.dataTransfer.getData("negocioId");
                  if (!negId) return;
                  if (action.key === "excluir") {
                    if (confirm("Tem certeza que deseja excluir este negócio?")) {
                      onDeleteNegocio(negId);
                    }
                  } else {
                    onDrop(negId, action.key);
                  }
                  setDraggingNegocioId(null);
                }}
              >
                <Icon className="w-4 h-4" style={{ color: action.color }} />
                <span className="text-xs font-semibold tracking-wider" style={{ color: action.color }}>{action.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   NEGOCIO CARD (Pipedrive-inspired)
   ═══════════════════════════════════════════════════ */

function NegocioCard({ negocio, stageColor, onOpenNegocio, slaHours, onDragStart, onDragEnd, onChangeStatus, stages }: { negocio: Negocio; stageColor: string; onOpenNegocio: (id: string) => void; slaHours: Record<string, number>; onDragStart?: () => void; onDragEnd?: () => void; onChangeStatus?: (status: string) => void; stages?: { key: string; label: string; color: string }[] }) {
  const age = stageAge(negocio.status, negocio.updatedAt, slaHours);
  const mrr = parseFloat(negocio.mrrEstimado || "0") || 0;
  const proj = parseFloat(negocio.valorProjeto || "0") || 0;
  const total = mrr + proj;
  const incomplete = hasIncompleteData(negocio);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const isStagnation = (STAGNATION_REASONS as readonly { key: string }[]).some((s) => s.key === negocio.status);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuTriggerRef.current?.contains(target)) return;
      if (menuPortalRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onScrollOrResize = () => setMenuOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [menuOpen]);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuTriggerRef.current) return;
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = menuTriggerRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const viewportWidth = window.innerWidth;
    const left = Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 8);
    setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    setMenuOpen(true);
  }, [menuOpen]);

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("negocioId", negocio.id); onDragStart?.(); }}
      onDragEnd={() => onDragEnd?.()}
      className="group rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-200 hover:-translate-y-0.5 relative"
      style={{
        // Disciplina de cor (22/07): SLA estourado sinaliza SÓ no pill vermelho de idade —
        // a borda vermelha em card ficava em quase todos (tudo além do SLA) e virava ruído.
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {/* Actions menu trigger (top-right) — dropdown renders via portal to avoid clipping */}
      {onChangeStatus && (
        <button
          ref={menuTriggerRef}
          onClick={toggleMenu}
          onMouseDown={(e) => e.stopPropagation()}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="absolute top-2 right-2 z-10 p-1 rounded opacity-0 group-hover:opacity-70 hover:opacity-100 hover:bg-white/10 transition-opacity"
          title="Ações"
        >
          <MoreHorizontal className="w-3.5 h-3.5 text-white/60" />
        </button>
      )}
      {menuOpen && menuPos && typeof window !== "undefined" && createPortal(
        <div
          ref={menuPortalRef}
          className="fixed min-w-[220px] rounded-lg shadow-xl py-1 text-[11px]"
          style={{ top: menuPos.top, left: menuPos.left, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          {!isStagnation ? (
            <>
              <div className="px-3 py-1 text-[9px] uppercase tracking-wide text-white/30">Mover pra estagnado</div>
              {STAGNATION_REASONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => { onChangeStatus(r.key); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/5 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  {r.label}
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="px-3 py-1 text-[9px] uppercase tracking-wide text-white/30">Reativar pra</div>
              {(stages || []).map((s) => (
                <button
                  key={s.key}
                  onClick={() => { onChangeStatus(s.key); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/5 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body
      )}

      <div onClick={() => onOpenNegocio(negocio.id)} className="cursor-pointer">
        {/* Row 1: Title + chevron */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1 pr-6">
            <p className="font-medium text-[13px] text-white truncate leading-tight">{negocio.titulo}</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 shrink-0 mt-0.5 transition-colors opacity-0 group-hover:opacity-0" />
        </div>

        {/* Row 2: Company/contact + temperatura */}
        <div className="flex items-center gap-1.5 mt-1">
          <p className="text-[11px] text-white/40 truncate flex-1">
            {negocio.empresaNome || negocio.leadEmpresa || ""}{negocio.empresaNome || negocio.leadEmpresa ? ", " : ""}{negocio.leadNome}
          </p>
          {negocio.temperatura && negocio.temperatura !== "indefinido" && (
            <span
              className={`text-[9px] px-1 rounded shrink-0 ${
                negocio.temperatura === "quente" ? "bg-red-500/15 text-red-400" :
                negocio.temperatura === "morno" ? "bg-amber-500/15 text-amber-400" :
                "bg-blue-500/15 text-blue-400"
              }`}
              title="Quente: alta probabilidade de fechar. Morno: em andamento. Frio: risco de perda."
            >
              {negocio.temperatura === "quente" ? "\uD83D\uDD25" : negocio.temperatura === "morno" ? "\u2600\uFE0F" : "\u2744\uFE0F"}
            </span>
          )}
        </div>

        {/* Previsão de fechamento badge */}
        {negocio.previsaoFechamento && (() => {
          const days = Math.ceil((new Date(negocio.previsaoFechamento + "T12:00:00").getTime() - Date.now()) / 86400000);
          if (days > 14) return null;
          const isLate = days < 0;
          return (
            <div className={`flex items-center gap-1 mt-1.5 text-[9px] font-medium ${isLate ? "text-red-400" : "text-amber-400"}`}>
              <span>{isLate ? `⚠ ${Math.abs(days)}d atrasado` : `📅 ${days}d p/ fechar`}</span>
            </div>
          );
        })()}

        {/* Reunião agendada: data/hora + link Teams + convidado — visível sem clique extra */}
        {negocio.proximaReuniaoData && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] min-w-0">
            <CalendarClock className="w-3 h-3 text-[#8e27ef] shrink-0" />
            <span className="text-white/60 tabular-nums shrink-0">
              {new Date(negocio.proximaReuniaoData).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
            </span>
            {negocio.proximaReuniaoLink && (
              <a
                href={negocio.proximaReuniaoLink}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[#8e27ef] hover:text-[#a855f7] font-medium shrink-0"
              >
                Entrar
              </a>
            )}
            {negocio.proximaReuniaoConvidado && (
              <span className="text-white/25 truncate">{negocio.proximaReuniaoConvidado}</span>
            )}
          </div>
        )}

        {/* Row 3: Owner (avatar + nome) + value + badges */}
        <div className="flex items-center justify-between mt-2.5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Responsavel: avatar + primeiro nome */}
            <OwnerChip nome={negocio.responsavelNome} avatarUrl={negocio.responsavelAvatar} color={stageColor} size={22} />

            {/* Value */}
            {total > 0 ? (
              <span className="text-xs font-semibold text-white/85 tabular-nums shrink-0">
                {formatBRL(total)}
              </span>
            ) : (
              <span className="text-xs text-white/20 shrink-0">R$ 0</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Incomplete warning */}
            {incomplete && (
              <AlertTriangle className="w-3 h-3 text-amber-400/60" />
            )}

            {/* Carteira badge */}
            {negocio.origemNegocio === "carteira" && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">UP</span>
            )}

            {/* Qualificação direta (closer atuando como SDR, sem reunião) — discreto */}
            {negocio.origemQualificacao === "direta" && (
              <span
                className="text-[8px] px-1 py-0.5 rounded bg-white/[0.06] text-white/40 font-medium"
                title="Qualificado sem reunião (negociação direta)"
              >
                DIR
              </span>
            )}

            {/* Age badge */}
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: age.bg, color: age.color }}
            >
              {age.text}
            </span>
          </div>
        </div>

        {/* Revenue breakdown (only when both types) */}
        {mrr > 0 && proj > 0 && (
          <div className="flex items-center gap-3 text-[9px] text-white/25 mt-1.5 ml-8">
            <span className="text-emerald-400/60">Rec {formatBRL(mrr)}</span>
            <span className="text-[#8e27ef]/70">Avulso {formatBRL(proj)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   NEW NEGOCIO MODAL
   ═══════════════════════════════════════════════════ */

function NewNegocioModal({ pipelineId, initialStatus, onClose, onCreated }: { pipelineId: string | null; initialStatus?: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [titulo, setTitulo] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<{ id: string; nome: string; empresa: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: searchResults } = useQuery({
    queryKey: ["lead-search", leadSearch],
    queryFn: async () => {
      if (leadSearch.length < 2) return [];
      const res = await fetch(`/api/leads?search=${encodeURIComponent(leadSearch)}&limit=8`);
      const json = await res.json();
      return json.leads || [];
    },
    enabled: leadSearch.length >= 2,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { titulo };
      if (selectedLead) body.leadId = selectedLead.id;
      if (pipelineId) body.pipelineId = pipelineId;
      if (initialStatus) body.status = initialStatus;
      const res = await fetch("/api/negocios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao criar");
      }
      const negocio = await res.json();
      toast.success("Negócio criado");
      onCreated(negocio.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-white mb-4">Novo Negócio</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Título *</label>
            <input
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Empresa X - Projeto Y"
              className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Lead / Contato</label>
            {selectedLead ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                <span className="text-sm text-white flex-1">{selectedLead.nome}{selectedLead.empresa ? ` — ${selectedLead.empresa}` : ""}</span>
                <button type="button" onClick={() => setSelectedLead(null)} className="text-white/30 hover:text-white/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder="Buscar lead por nome..."
                  className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none"
                />
                {searchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-[#1a1f2e] border border-white/10 shadow-xl z-10 max-h-48 overflow-y-auto">
                    {searchResults.map((lead: { id: string; nome: string; empresa: string | null }) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => {
                          setSelectedLead(lead);
                          setLeadSearch("");
                          if (!titulo) setTitulo(lead.empresa ? `${lead.empresa} - Novo negócio` : `${lead.nome} - Novo negócio`);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] transition-colors"
                      >
                        {lead.nome}{lead.empresa ? <span className="text-white/30 ml-1">— {lead.empresa}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-white/25 mt-1">Opcional — pode associar depois</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/70 hover:text-white">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm btn-primary rounded-lg disabled:opacity-50 flex items-center gap-2">
              {saving ? <><ButtonSpinner /> Criando...</> : "Criar Negócio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LIST VIEW
   ═══════════════════════════════════════════════════ */

function ListView({ negocios, onOpenNegocio, slaHours, getStatusInfo }: { negocios: Negocio[]; onOpenNegocio: (id: string) => void; stages: { key: string; label: string; color: string }[]; slaHours: Record<string, number>; getStatusInfo: (s: string) => { key: string; label: string; color: string } }) {
  return (
    <div className="bg-[rgba(255,255,255,0.03)] rounded-xl border border-white/[0.06] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Negócio</th>
            <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Contato</th>
            <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Etapa</th>
            <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Valor</th>
            <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider hidden md:table-cell">Temp.</th>
            <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider hidden lg:table-cell">Score</th>
            <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider hidden lg:table-cell">Tempo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {negocios.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState icon={Briefcase} title="Nenhum negócio no pipeline" description="Converta leads em negócios pela página de Leads, ou crie um negócio diretamente." />
              </td>
            </tr>
          )}
          {negocios.map((neg) => {
            const stageInfo = getStatusInfo(neg.status);
            const mrr = parseFloat(neg.mrrEstimado || "0") || 0;
            const proj = parseFloat(neg.valorProjeto || "0") || 0;
            const total = mrr + proj;
            const age = stageAge(neg.status, neg.updatedAt, slaHours);

            return (
              <tr
                key={neg.id}
                className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                onClick={() => onOpenNegocio(neg.id)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden"
                      style={{ backgroundColor: `${stageInfo.color}20`, color: stageInfo.color }}
                      title={neg.responsavelNome || undefined}
                    >
                      {neg.responsavelAvatar ? (
                        <img src={neg.responsavelAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        (neg.responsavelNome || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">{neg.titulo}</p>
                      {neg.origemNegocio === "carteira" && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">UPSELL</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white/70 text-sm truncate">{neg.empresaNome || neg.leadEmpresa || neg.leadNome}</p>
                  {(neg.empresaNome || neg.leadEmpresa) && <p className="text-[11px] text-white/35 truncate">{neg.leadNome}</p>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ backgroundColor: `${stageInfo.color}20`, color: stageInfo.color }}
                  >
                    {stageInfo.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {total > 0 ? (
                    <div>
                      <span className="font-semibold text-white/85 text-sm tabular-nums">{formatBRL(total)}</span>
                      {mrr > 0 && proj > 0 && (
                        <div className="flex gap-2 text-[9px] mt-0.5">
                          <span className="text-white/45">Rec {formatBRL(mrr)}</span>
                          <span className="text-white/30">Av {formatBRL(proj)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {neg.temperatura && neg.temperatura !== "indefinido" ? (
                    <span className={`text-xs ${
                      neg.temperatura === "quente" ? "text-red-400" :
                      neg.temperatura === "morno" ? "text-amber-400" :
                      "text-blue-400"
                    }`}>
                      {neg.temperatura === "quente" ? "\uD83D\uDD25" : neg.temperatura === "morno" ? "\u2600\uFE0F" : "\u2744\uFE0F"} {neg.temperatura}
                    </span>
                  ) : (
                    <span className="text-white/15">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium" style={{ color: neg.leadScore >= 70 ? "#10B981" : neg.leadScore >= 40 ? "#F59E0B" : "rgba(255,255,255,0.3)" }}>
                      {neg.leadScore}
                    </span>
                    {neg.cipaScore != null && (
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        neg.cipaScore >= 70 ? "bg-emerald-500/20 text-emerald-400" :
                        neg.cipaScore >= 40 ? "bg-amber-500/20 text-amber-400" :
                        "bg-red-500/20 text-red-400"
                      }`} title={`CIPA Score: ${neg.cipaScore}/100`}>
                        CIPA {neg.cipaScore}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: age.bg, color: age.color }}
                  >
                    {age.text}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LOSS OR STAGNATE MODAL
   Fluxo Scott (12/jun): um gesto só ("Perdido"); a decisão
   acontece no motivo. Motivo de estagnação → board Estagnados.
   Perda real → status perdido + motivo + detalhe livre.
   ═══════════════════════════════════════════════════ */
const PIPELINE_LOSS_REASONS = [
  { key: "preco_alto", label: "Preço alto" },
  { key: "escolheu_concorrente", label: "Escolheu concorrente" },
  { key: "sem_budget", label: "Sem orçamento" },
  { key: "vai_internalizar", label: "Vai internalizar" },
  { key: "nao_respondeu", label: "Não respondeu" },
  { key: "fora_perfil", label: "Fora do perfil" },
  { key: "outro", label: "Outro" },
];

function LossOrStagnateModal({ onClose, onStagnate, onLose }: {
  onClose: () => void;
  onStagnate: (reasonKey: string) => void;
  onLose: (motivo: string, detalhe?: string) => void;
}) {
  const [motivo, setMotivo] = useState<string>("");
  const [detalhe, setDetalhe] = useState("");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl bg-[#16161a] border border-white/[0.08] p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-heading)" }}>
            Esse negócio está perdido?
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">
            Ainda dá pra trabalhar — mover pra Estagnados
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STAGNATION_REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => onStagnate(r.key)}
                className="px-3 py-2.5 rounded-xl text-xs text-left border border-white/[0.08] bg-white/[0.04] text-white/80 hover:border-[#8e27ef]/60 hover:bg-[#8e27ef]/10 transition-colors"
              >
                <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: r.color }} />
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">Perda real — qual o motivo?</p>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#EF4444]/50 [&>option]:bg-[#16161a]"
          >
            <option value="">Selecionar motivo...</option>
            {PIPELINE_LOSS_REASONS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
          <textarea
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="Detalhe o que aconteceu (opcional, mas ajuda o time)"
            rows={2}
            className="mt-2 w-full px-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#EF4444]/50 resize-none"
          />
          <button
            disabled={!motivo}
            onClick={() => onLose(motivo, detalhe.trim() || undefined)}
            className="mt-2 w-full py-2.5 rounded-xl text-xs font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar perda
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
