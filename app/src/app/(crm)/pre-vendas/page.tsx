"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SDR_STAGES,
  SDR_CLOSED_STAGES,
  SDR_MIRROR_STAGES,
  SDR_MIRROR_KEYS,
  SDR_STAGNATION_STAGES,
  SDR_STAGNATION_KEYS,
  SDR_SLA_HOURS,
  negocioStatusToSdrMirror,
} from "@/lib/crm/pipeline";
import { Search, X, MoreHorizontal, Tag, Briefcase, CheckCircle2, XCircle, PauseCircle, RotateCcw } from "lucide-react";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { SkeletonKanbanColumn } from "@/components/crm/Skeleton";
import { AgendarReuniaoModal, type AgendarReuniaoPayload } from "@/components/crm/AgendarReuniaoModal";
import { BoardFilters, OwnerChip, useOrgUsuarios, matchesResponsavel, matchesDateFilter, type DateFilter, type OrgUsuario } from "@/components/crm/BoardFilters";

interface Lead {
  id: string;
  nome: string;
  sobrenome?: string | null;
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  origem?: string | null;
  utmCampaign?: string | null;
  leadScore?: number | null;
  sdrStatus?: string | null;
  responsavelId?: string | null;
  tipo: string;
  negocioCount?: number;
  negocioPrincipal?: { id: string; titulo: string; status: string } | null;
  createdAt?: string;
  updatedAt?: string;
  avatarUrl?: string | null;
}

function stageAge(updatedAt: string | undefined, status: string) {
  if (!updatedAt) return null;
  const ms = Date.now() - new Date(updatedAt).getTime();
  const mins = Math.floor(ms / 60000);
  const hours = ms / (1000 * 60 * 60);
  const sla = SDR_SLA_HOURS[status] || 48;
  const ratio = hours / sla;
  let text: string;
  if (mins < 60) text = `${mins}min`;
  else if (mins < 1440) text = `${Math.floor(mins / 60)}h`;
  else text = `${Math.floor(mins / 1440)}d`;
  let color: string, bg: string;
  if (ratio < 0.5) { color = "#10B981"; bg = "rgba(16,185,129,0.15)"; }
  else if (ratio <= 1) { color = "#F59E0B"; bg = "rgba(245,158,11,0.15)"; }
  else { color = "#EF4444"; bg = "rgba(239,68,68,0.15)"; }
  return { text, color, bg, breached: ratio > 1 };
}

// Decide em qual coluna do board o lead aparece.
// Funil ativo (pending/contacted/qualifying) = sdr_status. Depois de qualificado,
// ESPELHA o status do negócio do closer (Qualificado → Reunião Realizada → Cliente Convertido).
function sdrBoardColumn(lead: Lead): string {
  const s = lead.sdrStatus || "pending";
  if (s === "disqualified") return "disqualified";
  if (lead.negocioPrincipal) return negocioStatusToSdrMirror(lead.negocioPrincipal.status);
  if (lead.negocioCount && lead.negocioCount > 0) return "m_qualified";
  return s;
}

type View = "qualificacao" | "estagnados";

export default function PreVendasPage() {
  const qc = useQueryClient();
  const { usuarios, byId: usuariosById, currentUserId } = useOrgUsuarios();
  const [searchQuery, setSearchQuery] = useState("");
  const [respFilter, setRespFilter] = useState("todos");
  const [periodo, setPeriodo] = useState<DateFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [view, setView] = useState<View>("qualificacao");
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pre-vendas-leads"],
    queryFn: async () => {
      const r = await fetch("/api/leads?tipo=lead&limit=300&sort=createdAt&order=desc");
      if (!r.ok) return { leads: [] as Lead[] };
      return (await r.json()) as { leads: Lead[] };
    },
  });

  const allLeads = useMemo(() => data?.leads || [], [data]);

  const filteredLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allLeads.filter((l) => {
      if (!matchesResponsavel(l.responsavelId, respFilter, currentUserId)) return false;
      if (!matchesDateFilter(l.createdAt || null, periodo, customFrom, customTo)) return false;
      if (!q) return true;
      return (
        l.nome.toLowerCase().includes(q) ||
        (l.empresa || "").toLowerCase().includes(q) ||
        (l.utmCampaign || "").toLowerCase().includes(q) ||
        (l.origem || "").toLowerCase().includes(q)
      );
    });
  }, [allLeads, searchQuery, respFilter, currentUserId, periodo, customFrom, customTo]);

  const isStagnant = (l: Lead) => SDR_STAGNATION_KEYS.includes(l.sdrStatus || "");
  const funnelLeads = filteredLeads.filter((l) => !isStagnant(l));
  const stagnantLeads = filteredLeads.filter(isStagnant);
  // contagem do funil = só os ativos (colunas abertas pending/contacted/qualifying)
  const openKeys = SDR_STAGES.map((s) => s.key);
  const activeCount = funnelLeads.filter((l) => openKeys.includes(sdrBoardColumn(l))).length;
  const stagnantCount = stagnantLeads.length;

  const moveStage = useMutation({
    mutationFn: async ({ id, sdrStatus }: { id: string; sdrStatus: string }) => {
      const r = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdrStatus }),
      });
      if (!r.ok) throw new Error("falha ao mover");
      return r.json();
    },
    onMutate: async ({ id, sdrStatus }) => {
      await qc.cancelQueries({ queryKey: ["pre-vendas-leads"] });
      const prev = qc.getQueryData<{ leads: Lead[] }>(["pre-vendas-leads"]);
      qc.setQueryData<{ leads: Lead[] }>(["pre-vendas-leads"], (old) =>
        old ? { leads: old.leads.map((l) => (l.id === id ? { ...l, sdrStatus } : l)) } : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pre-vendas-leads"], ctx.prev);
      toast.error("Não foi possível mover o lead");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] }),
  });

  const qualificar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload?: AgendarReuniaoPayload }) => {
      const r = await fetch(`/api/leads/${id}/converter-oportunidade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      if (!r.ok) throw new Error("falha ao qualificar");
      return r.json();
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.payload
          ? "Lead qualificado: oportunidade criada no Pipeline com reunião agendada."
          : "Lead qualificado: oportunidade criada no Pipeline. Fica aqui de espelho."
      );
      setAgendarLead(null);
      qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["negocios"] });
    },
    onError: () => toast.error("Não foi possível qualificar o lead"),
  });

  // Lead em vias de ser qualificado → abre o popup de agendamento (Fase A)
  const [agendarLead, setAgendarLead] = useState<Lead | null>(null);

  const handleMove = (leadId: string, targetStatus: string) => {
    const lead = allLeads.find((l) => l.id === leadId);
    if (!lead) return;
    // Qualificar: tanto a ação "QUALIFICAR" (qualified) quanto soltar na coluna
    // espelho "Qualificado" (m_qualified) abrem o popup de agendar reunião com o closer.
    if ((targetStatus === "qualified" || targetStatus === "m_qualified") && !lead.negocioCount) {
      setAgendarLead(lead);
      return;
    }
    // Colunas espelho (Qualificado/Reunião Realizada/Cliente Convertido) são controladas
    // pelo closer no Pipeline — a SDR não move o lead pra elas na mão.
    if (SDR_MIRROR_KEYS.includes(targetStatus)) {
      toast.info("Essa etapa é controlada pelo closer no Pipeline.");
      return;
    }
    moveStage.mutate({ id: leadId, sdrStatus: targetStatus });
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
                Pré-vendas
              </h1>
              <p className="text-[12px] text-white/40 hidden sm:block">
                A SDR qualifica os leads aqui. Arraste pro rodapé pra qualificar, desqualificar ou estagnar.
              </p>
            </div>
            <div className="flex items-baseline gap-2 shrink-0">
              <span className="text-lg font-bold text-[#e23752]">{activeCount}</span>
              <span className="text-xs text-white/30 hidden sm:inline">no funil</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar lead, empresa, campanha..."
              className="w-44 sm:w-60 pl-8 pr-7 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/40 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <BoardFilters
            usuarios={usuarios}
            currentUserId={currentUserId}
            resp={respFilter}
            setResp={setRespFilter}
            periodo={periodo}
            setPeriodo={setPeriodo}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
            accent="#8e27ef"
          />

          <div className="flex gap-1 p-0.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
            {([
              { key: "qualificacao" as const, label: "Qualificação", count: activeCount },
              { key: "estagnados" as const, label: "Estagnados", count: stagnantCount },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  view === tab.key ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
                style={view === tab.key ? { background: tab.key === "estagnados" ? "rgba(239,68,68,0.2)" : "rgba(108,92,231,0.2)" } : {}}
              >
                {tab.label}
                <span className="text-[10px] opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <SkeletonKanbanColumn count={5} />
        ) : (
          <SdrKanbanView
            leads={view === "estagnados" ? stagnantLeads : funnelLeads}
            view={view}
            usuariosById={usuariosById}
            onDrop={handleMove}
            onOpenLead={(id) => setDrawerLeadId(id)}
            onOpenNegocio={(id) => setDrawerNegocioId(id)}
          />
        )}
      </div>

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
      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenLead={(id) => { setDrawerNegocioId(null); setDrawerLeadId(id); }}
        onOpenEmpresa={(id) => { setDrawerNegocioId(null); setDrawerEmpresaId(id); }}
      />

      <AgendarReuniaoModal
        open={!!agendarLead}
        leadNome={agendarLead?.nome || ""}
        leadEmpresa={agendarLead?.empresa}
        closerSugeridoId={agendarLead?.responsavelId}
        saving={qualificar.isPending}
        onClose={() => setAgendarLead(null)}
        onConfirm={(payload) => {
          if (agendarLead) qualificar.mutate({ id: agendarLead.id, payload });
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   KANBAN VIEW
   ═══════════════════════════════════════════════════ */

function SdrKanbanView({
  leads,
  view,
  usuariosById,
  onDrop,
  onOpenLead,
  onOpenNegocio,
}: {
  leads: Lead[];
  view: View;
  usuariosById: Map<string, OrgUsuario>;
  onDrop: (id: string, sdrStatus: string) => void;
  onOpenLead: (id: string) => void;
  onOpenNegocio: (id: string) => void;
}) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverAction, setDragOverAction] = useState<string | null>(null);
  const [expandedClosed, setExpandedClosed] = useState<Set<string>>(() => new Set());

  const openCols = view === "estagnados" ? SDR_STAGNATION_STAGES : SDR_STAGES;
  const closedCols = view === "estagnados" ? [] : [...SDR_MIRROR_STAGES, ...SDR_CLOSED_STAGES];

  // Ações da barra inferior (drop zones)
  const actions =
    view === "estagnados"
      ? [{ key: "qualifying", label: "REATIVAR", icon: RotateCcw, color: "#3B82F6" }]
      : [
          { key: "sdr_sem_retorno", label: "ESTAGNAR", icon: PauseCircle, color: "#8e27ef" },
          { key: "disqualified", label: "DESQUALIFICAR", icon: XCircle, color: "#EF4444" },
          { key: "qualified", label: "QUALIFICAR", icon: CheckCircle2, color: "#22C55E" },
        ];

  const renderColumnCards = (stageKey: string) => {
    const stage = [...openCols, ...closedCols].find((s) => s.key === stageKey);
    const mirror = SDR_MIRROR_KEYS.includes(stageKey); // espelho do closer = read-only
    return leads
      .filter((l) => (view === "estagnados" ? (l.sdrStatus || "pending") === stageKey : sdrBoardColumn(l) === stageKey))
      .map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          stageColor={stage?.color || "#6B7280"}
          view={view}
          readOnly={mirror}
          owner={lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined}
          onOpenLead={onOpenLead}
          onOpenNegocio={onOpenNegocio}
          onMove={(s) => onDrop(lead.id, s)}
          onDragStart={() => setDraggingLeadId(lead.id)}
          onDragEnd={() => setDraggingLeadId(null)}
        />
      ));
  };

  return (
    <div className="relative h-full">
      <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 h-full">
        {/* Colunas abertas */}
        {openCols.map((stage, stageIdx) => {
          const cards = renderColumnCards(stage.key);
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
              onDragEnter={(e) => { e.preventDefault(); setDragOverStage(stage.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                const leadId = e.dataTransfer.getData("leadId");
                if (leadId) onDrop(leadId, stage.key);
              }}
            >
              <div className="px-3 pt-3 pb-2 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{stage.label}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
                    {cards.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0 scrollbar-thin">
                {cards}
                {cards.length === 0 && <div className="flex h-16 items-center justify-center text-[11px] text-white/15">vazio</div>}
              </div>
            </div>
          );
        })}

        {/* Separador */}
        {closedCols.length > 0 && (
          <div className="flex-shrink-0 flex items-center px-1">
            <div className="w-px h-2/3 bg-white/[0.08]" />
          </div>
        )}

        {/* Colunas fechadas (colapsadas, estilo Ganho/Perdido) */}
        {closedCols.map((stage) => {
          const cards = renderColumnCards(stage.key);
          const isExpanded = expandedClosed.has(stage.key);
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
                const leadId = e.dataTransfer.getData("leadId");
                if (leadId) onDrop(leadId, stage.key);
              }}
            >
              {isExpanded ? (
                <>
                  <button
                    onClick={() => setExpandedClosed((p) => { const s = new Set(p); s.delete(stage.key); return s; })}
                    className="px-3 pt-3 pb-2 border-b border-white/[0.04] shrink-0 text-left w-full hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full opacity-70" style={{ backgroundColor: stage.color }} />
                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{stage.label}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
                        {cards.length}
                      </span>
                    </div>
                  </button>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0 scrollbar-thin">{cards}</div>
                </>
              ) : (
                <button
                  onClick={() => setExpandedClosed((p) => { const s = new Set(p); s.add(stage.key); return s; })}
                  className="flex flex-col items-center gap-3 py-4 px-1 h-full hover:bg-white/[0.03] transition-colors rounded-2xl"
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
                    {cards.length}
                  </span>
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest" style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
                    {stage.label}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Barra de ações ao arrastar */}
      {draggingLeadId && (
        <div className="absolute bottom-0 left-0 right-0 flex gap-2 p-3 z-20" style={{ animation: "slideUp 0.2s ease-out" }}>
          {actions.map((action) => {
            const Icon = action.icon;
            const isOver = dragOverAction === action.key;
            return (
              <div
                key={action.key}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all duration-200"
                style={{
                  background: isOver ? `${action.color}33` : `${action.color}14`,
                  borderColor: isOver ? action.color : `${action.color}50`,
                  transform: isOver ? "scale(1.02)" : "scale(1)",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverAction(action.key); }}
                onDragEnter={(e) => { e.preventDefault(); setDragOverAction(action.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverAction(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverAction(null);
                  setDraggingLeadId(null);
                  const leadId = e.dataTransfer.getData("leadId");
                  if (leadId) onDrop(leadId, action.key);
                }}
              >
                <Icon className="w-4 h-4" style={{ color: action.color }} />
                <span className="text-xs font-bold tracking-wide" style={{ color: action.color }}>{action.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LEAD CARD
   ═══════════════════════════════════════════════════ */

function LeadCard({
  lead,
  stageColor,
  view,
  readOnly = false,
  owner,
  onOpenLead,
  onOpenNegocio,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  stageColor: string;
  view: View;
  readOnly?: boolean;
  owner?: OrgUsuario;
  onOpenLead: (id: string) => void;
  onOpenNegocio: (id: string) => void;
  onMove: (status: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const age = stageAge(lead.updatedAt, lead.sdrStatus || "pending");
  const nome = `${lead.nome}${lead.sobrenome ? " " + lead.sobrenome : ""}`;
  const isOportunidade = !!lead.negocioCount && lead.negocioCount > 0;

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuTriggerRef.current?.contains(t)) return;
      if (menuPortalRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen]);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuTriggerRef.current) return;
    if (menuOpen) { setMenuOpen(false); return; }
    const rect = menuTriggerRef.current.getBoundingClientRect();
    const menuWidth = 230;
    const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
    setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    setMenuOpen(true);
  }, [menuOpen]);

  const currentStatus = lead.sdrStatus || "pending";
  const funnelStages = [...SDR_STAGES, ...SDR_CLOSED_STAGES];

  return (
    <div
      draggable={!readOnly}
      onDragStart={readOnly ? undefined : (e) => { e.dataTransfer.setData("leadId", lead.id); onDragStart?.(); }}
      onDragEnd={readOnly ? undefined : () => onDragEnd?.()}
      className={`group rounded-xl p-3 transition-all duration-200 hover:-translate-y-0.5 relative ${readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: age?.breached ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.06)",
        ...(age?.breached ? { boxShadow: "0 0 12px rgba(239,68,68,0.1)" } : {}),
      }}
      onMouseEnter={(e) => { if (!age?.breached) e.currentTarget.style.borderColor = `${stageColor}40`; }}
      onMouseLeave={(e) => { if (!age?.breached) e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
    >
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
      {menuOpen && menuPos && typeof window !== "undefined" && createPortal(
        <div
          ref={menuPortalRef}
          className="fixed min-w-[230px] rounded-lg shadow-xl py-1 text-[11px]"
          style={{ top: menuPos.top, left: menuPos.left, background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isOportunidade && lead.negocioPrincipal && (
            <>
              <button
                onClick={() => { onOpenNegocio(lead.negocioPrincipal!.id); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-white/90 hover:bg-white/5 flex items-center gap-2 font-medium"
              >
                <Briefcase className="w-3 h-3 text-[#22C55E]" /> Abrir oportunidade
              </button>
              <div className="my-1 h-px bg-white/10" />
            </>
          )}
          {readOnly ? (
            <div className="px-3 py-1.5 text-[10px] text-white/30">Etapa controlada pelo closer no Pipeline.</div>
          ) : (
            <>
              {!isOportunidade && (
                <button
                  onClick={() => { onMove("qualified"); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-white/90 hover:bg-white/5 flex items-center gap-2 font-medium"
                >
                  <CheckCircle2 className="w-3 h-3 text-[#22C55E]" /> Qualificar (cria oportunidade)
                </button>
              )}
              <div className="px-3 py-1 text-[9px] uppercase tracking-wide text-white/30">Mover no funil</div>
              {funnelStages.filter((s) => s.key !== currentStatus).map((s) => (
                <button
                  key={s.key}
                  onClick={() => { onMove(s.key); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-white/70 hover:bg-white/5 flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
              <div className="my-1 h-px bg-white/10" />
              <div className="px-3 py-1 text-[9px] uppercase tracking-wide text-white/30">
                {view === "estagnados" ? "Reativar / mudar motivo" : "Marcar estagnado"}
              </div>
              {SDR_STAGNATION_STAGES.filter((s) => s.key !== currentStatus).map((s) => (
                <button
                  key={s.key}
                  onClick={() => { onMove(s.key); setMenuOpen(false); }}
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

      <div onClick={() => onOpenLead(lead.id)} className="cursor-pointer">
        <div className="min-w-0 flex-1 pr-6 flex items-center gap-1.5">
          <p className="font-medium text-[13px] text-white truncate leading-tight">{nome}</p>
          {isOportunidade && (
            <span className="shrink-0 text-[8px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold uppercase tracking-wide" title="Já é oportunidade no Pipeline">
              Opp
            </span>
          )}
        </div>

        {(lead.empresa || lead.cargo) && (
          <p className="text-[11px] text-white/40 truncate mt-1">
            {lead.empresa || ""}{lead.empresa && lead.cargo ? " · " : ""}{lead.cargo || ""}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {lead.origem && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 font-medium">{lead.origem}</span>
          )}
          {lead.utmCampaign && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(142,39,239,0.15)", color: "#b97bf0" }} title={`Campanha: ${lead.utmCampaign}`}>
              <Tag className="w-2.5 h-2.5" /> {lead.utmCampaign}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-2.5 gap-2">
          <OwnerChip nome={owner?.nome} avatarUrl={owner?.avatarUrl} color={stageColor} size={20} />
          <div className="flex items-center gap-1.5 shrink-0">
            {typeof lead.leadScore === "number" && lead.leadScore > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(200,255,0,0.18)", color: "#9bb800" }}>{lead.leadScore}</span>
            )}
            {age && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: age.bg, color: age.color }}>{age.text}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
