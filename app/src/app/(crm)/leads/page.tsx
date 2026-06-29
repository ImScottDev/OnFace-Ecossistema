"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { Search, Plus, Phone, MessageCircle, FileEdit, X, FileText, StickyNote, Clock, ArrowRight, ExternalLink, Briefcase, Users, Sparkles, Mail, Globe, MapPin, Linkedin, Building2, DollarSign, CalendarDays, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CONTATO_TIPOS, getContatoTipoInfo, ALL_NEGOCIO_STATUSES, getNegocioStatusInfo } from "@/lib/crm/pipeline";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { SkeletonRow, SkeletonDetailPanel } from "@/components/crm/Skeleton";
import { ButtonSpinner } from "@/components/crm/ButtonSpinner";
import { EmptyState } from "@/components/crm/EmptyState";

interface Lead {
  id: string;
  nome: string;
  email: string | null;
  telefone: string;
  empresa: string | null;
  empresaSetor: string | null;
  origem: string | null;
  status: string;
  leadScore: number;
  mrrEstimado: string | null;
  cargo: string | null;
  valorProjeto: string | null;
  tipoReceita: string | null;
  createdAt: string;
  updatedAt: string;
  negocioCount?: number;
  negocioPrincipal?: { id: string; titulo: string; status: string } | null;
  negocioAtivoStatus?: string | null;
  contatoId?: string | null;
  avatarUrl?: string | null;
  apolloPhotoUrl?: string | null;
  enrichStatus?: string | null;
  whatsappUltimaMsg?: string | null;
  whatsappNaoLidas?: number | null;
  whatsappUltimaMsgAt?: string | null;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
  segmentCounts?: { lead: number; qualificado: number; cliente: number };
}

type Segmento = "lead" | "qualificado" | "cliente";
const SEGMENTOS: { key: Segmento; label: string; color: string; hint: string }[] = [
  { key: "lead", label: "Leads", color: "#3B82F6", hint: "Ainda na pré-venda (SDR), sem oportunidade aberta" },
  { key: "qualificado", label: "Qualificados", color: "#8e27ef", hint: "Já viraram oportunidade no Pipeline do closer" },
  { key: "cliente", label: "Clientes", color: "#10B981", hint: "Convertidos e pagantes" },
];

interface LeadDetail {
  lead: Lead & Record<string, unknown>;
  empresa: Record<string, unknown> | null;
  negocios: Array<Record<string, unknown>>;
  atividades: Array<Record<string, unknown>>;
  statusChanges: Array<Record<string, unknown>>;
  eventos: Array<Record<string, unknown>>;
  tarefas: Array<Record<string, unknown>>;
  contratos: Array<Record<string, unknown>>;
  propostas: Array<Record<string, unknown>>;
}

// Templates now stored in DB (whatsapp_templates table)

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `há ${mins}min`;
  if (mins < 1440) return `há ${Math.floor(mins / 60)}h`;
  return `há ${Math.floor(mins / 1440)}d`;
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "rgba(255,255,255,0.2)";
  return (
    <span className="score-bar">
      <span className="score-bar-track">
        <span className="score-bar-fill" style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }} />
      </span>
      <span className="text-xs font-bold" style={{ color }}>{score}</span>
    </span>
  );
}

function getActivityIcon(tipo: string) {
  switch (tipo) {
    case "ligacao": return <Phone className="w-3.5 h-3.5 text-blue-400" />;
    case "whatsapp": return <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case "nota": return <StickyNote className="w-3.5 h-3.5 text-yellow-400" />;
    case "proposta_enviada": return <FileText className="w-3.5 h-3.5 text-purple-400" />;
    case "email": return <FileEdit className="w-3.5 h-3.5 text-cyan-400" />;
    default: return <Clock className="w-3.5 h-3.5 text-white/30" />;
  }
}

export default function LeadsPage() {
  const { origens, setores } = usePipelineConfig();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [segmento, setSegmento] = useState<Segmento>("lead");
  const [origemFilter, setOrigemFilter] = useState("");
  const [estagioFilter, setEstagioFilter] = useState("");
  const [sortCol, setSortCol] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showNewLead, setShowNewLead] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ progress: number; enriched: number; total: number; state: string } | null>(null);
  const [convertModal, setConvertModal] = useState<{ leadId: string; nome: string; empresa: string | null } | null>(null);
  const [noteModal, setNoteModal] = useState<{ leadId: string; nome: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<LeadsResponse>({
    queryKey: ["leads", search, segmento, origemFilter, estagioFilter, sortCol, sortOrder, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      // Segmento do ciclo de vida: lead (SDR) | qualificado (oportunidade) | cliente
      params.set("segmento", segmento);
      if (origemFilter) params.set("origem", origemFilter);
      if (estagioFilter) params.set("estagio", estagioFilter);
      params.set("sort", sortCol);
      params.set("order", sortOrder);
      const res = await fetch(`/api/leads?${params}`);
      return res.json();
    },
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<LeadDetail>({
    queryKey: ["lead-detail", detailId],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${detailId}`);
      if (!res.ok) throw new Error("Lead não encontrado");
      return res.json();
    },
    enabled: !!detailId,
  });

  const clearFilters = () => {
    setSearch(""); setOrigemFilter(""); setEstagioFilter(""); setPage(1);
  };
  const hasFilters = search || origemFilter || estagioFilter;

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortOrder(o => o === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortOrder("desc");
    }
    setPage(1);
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <span className="text-white/20 ml-1">↕</span>;
    return <span className="text-[#e23752] ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  }

  const [savingNote, setSavingNote] = useState(false);

  async function saveNote() {
    if (!noteModal || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/leads/${noteModal.leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "nota", titulo: "Nota rápida", descricao: noteText }),
      });
      if (!res.ok) throw new Error();
      toast.success("Nota salva");
      setNoteModal(null);
      setNoteText("");
    } catch {
      toast.error("Erro ao salvar nota");
    } finally {
      setSavingNote(false);
    }
  }

  const router = useRouter();

  const [whatsappLoading, setWhatsappLoading] = useState<string | null>(null);

  async function openWhatsApp(lead: Lead) {
    if (lead.contatoId) {
      router.push(`/whatsapp?contato=${lead.contatoId}`);
      return;
    }
    if (!lead.telefone) return;

    // Create contato via API, then navigate
    setWhatsappLoading(lead.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/iniciar-whatsapp`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.contatoId) {
        router.push(`/whatsapp?contato=${data.contatoId}`);
      } else {
        toast.error(data.error || "Erro ao iniciar WhatsApp");
      }
    } catch {
      toast.error("Erro ao iniciar WhatsApp");
    } finally {
      setWhatsappLoading(null);
    }
  }

  function canWhatsApp(lead: Lead): boolean {
    return !!lead.telefone;
  }

  function renderRevenueCell(lead: Lead) {
    const tipo = lead.tipoReceita;
    if (tipo === "projeto") {
      if (lead.valorProjeto) {
        return (
          <span className="text-sm text-white/70">
            <span className="text-[10px] text-white/40 mr-1">Proj</span>
            R$ {parseFloat(lead.valorProjeto).toLocaleString("pt-BR")}
          </span>
        );
      }
      return <span className="text-white/30">—</span>;
    }
    if (tipo === "hibrido") {
      return (
        <span className="text-sm text-white/70">
          {lead.mrrEstimado && (
            <span>
              <span className="text-[10px] text-white/40 mr-1">MRR</span>
              R$ {parseFloat(lead.mrrEstimado).toLocaleString("pt-BR")}
            </span>
          )}
          {lead.mrrEstimado && lead.valorProjeto && <span className="text-white/20 mx-1">+</span>}
          {lead.valorProjeto && (
            <span>
              <span className="text-[10px] text-white/40 mr-1">Proj</span>
              R$ {parseFloat(lead.valorProjeto).toLocaleString("pt-BR")}
            </span>
          )}
          {!lead.mrrEstimado && !lead.valorProjeto && <span className="text-white/30">—</span>}
        </span>
      );
    }
    // Default: recorrente or null — show MRR
    if (lead.mrrEstimado) {
      return (
        <span className="text-sm text-white/70">
          R$ {parseFloat(lead.mrrEstimado).toLocaleString("pt-BR")}
        </span>
      );
    }
    return <span className="text-white/30">—</span>;
  }

  // Detail panel data
  const dl = detailData?.lead as (Lead & Record<string, unknown> & { tipo?: string; linkedin?: string; sobrenome?: string; empresaCidade?: string; empresaEstado?: string; enrichStatus?: string; responsavelId?: string; labels?: Array<{ id: string; nome: string; cor: string }> }) | undefined;
  const dlEmpresa = detailData?.empresa as Record<string, unknown> | null;
  const dlNegocios = detailData?.negocios || [];
  const dlPropostas = detailData?.propostas || [];
  const dlContratos = detailData?.contratos || [];
  const dlTarefas = detailData?.tarefas || [];
  const dlTi = dl ? getContatoTipoInfo(dl.tipo || "lead") : null;
  const daysInFunnel = dl ? Math.floor((Date.now() - new Date(dl.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const recentActivities = detailData?.atividades?.slice(0, 4) || [];

  const statusColors: Record<string, string> = {
    novo: "#6B7280", contatado: "#3B82F6", diagnostico: "#8B5CF6", respondeu: "#10B981", proposta: "#F59E0B",
    negociacao: "#8e27ef", fechado: "#10B981", implantacao: "#06B6D4", ativo: "#10B981",
    perdido: "#EF4444", churned: "#EF4444",
  };

  const propostaStatusColors: Record<string, string> = {
    rascunho: "#6B7280", enviada: "#3B82F6", aceita: "#10B981", recusada: "#EF4444", expirada: "#F59E0B",
  };

  return (
    <div className="page-scroll space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-[12px] text-white/40 hidden sm:block">Gerencie seus potenciais clientes desde o primeiro contato até a conversão em negócio.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {enrichProgress && enrichProgress.state === "active" ? (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-purple-400 border border-purple-500/30 bg-purple-500/5">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${enrichProgress.progress}%` }} />
                </div>
                <span className="text-xs text-white/50">{enrichProgress.enriched}/{enrichProgress.total} ({enrichProgress.progress}%)</span>
              </div>
            </div>
          ) : (
            <button
              onClick={async () => {
                if (!confirm(`Enriquecer todos os leads pendentes via Apollo.io?\n\nIsso pode levar alguns minutos.`)) return;
                setEnrichingAll(true);
                try {
                  const res = await fetch("/api/leads/enrich-bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filter: "pending" }) });
                  const result = await res.json();
                  if (res.ok) {
                    toast.success(`Enriquecimento iniciado: ${result.total} leads`);
                    // Poll progress
                    const jobId = result.jobId;
                    const poll = setInterval(async () => {
                      try {
                        const sr = await fetch(`/api/enrichment/status?jobId=${jobId}`);
                        const status = await sr.json();
                        setEnrichProgress({ progress: status.progress || 0, enriched: status.enriched || 0, total: status.total || 0, state: status.state });
                        if (status.state === "completed") {
                          clearInterval(poll);
                          setEnrichProgress(null);
                          setEnrichingAll(false);
                          toast.success(`Concluído: ${status.enriched} enriquecidos, ${status.notFound} não encontrados, ${status.errors} erros`);
                          refetch();
                        } else if (status.state === "failed") {
                          clearInterval(poll);
                          setEnrichProgress(null);
                          setEnrichingAll(false);
                          toast.error(`Falha: ${status.failedReason || "Erro desconhecido"}`);
                        }
                      } catch { /* ignore poll errors */ }
                    }, 3000);
                    setEnrichProgress({ progress: 0, enriched: 0, total: result.total, state: "active" });
                  } else {
                    toast.error(result.error || "Erro");
                    setEnrichingAll(false);
                  }
                } catch { toast.error("Erro de conexão"); setEnrichingAll(false); }
              }}
              disabled={enrichingAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-colors disabled:opacity-40"
              title="Busca dados públicos (cargo, empresa, LinkedIn) via Apollo.io — 1 crédito por lead"
            >
              <Sparkles className="w-4 h-4" /> {enrichingAll ? "Iniciando..." : "Enriquecer Todos"}
            </button>
          )}
          <button
            onClick={() => setShowNewLead(true)}
            className="flex items-center gap-2 px-4 py-2 btn-primary rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Lead
          </button>
        </div>
      </div>

      {/* Segmentos do ciclo de vida (lead → qualificado → cliente) */}
      <div className="flex flex-wrap items-center gap-2">
        {SEGMENTOS.map((seg) => {
          const active = segmento === seg.key;
          const cnt = data?.segmentCounts?.[seg.key];
          return (
            <button
              key={seg.key}
              onClick={() => { setSegmento(seg.key); setPage(1); }}
              title={seg.hint}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? `${seg.color}1a` : "rgba(255,255,255,0.03)",
                color: active ? seg.color : "rgba(255,255,255,0.5)",
                border: `1px solid ${active ? `${seg.color}55` : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
              {seg.label}
              {typeof cnt === "number" && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: active ? `${seg.color}25` : "rgba(255,255,255,0.06)", color: active ? seg.color : "rgba(255,255,255,0.4)" }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar nome, email, empresa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 dark-input rounded-lg text-sm outline-none"
          />
        </div>
        <select
          value={estagioFilter}
          onChange={(e) => { setEstagioFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 dark-input rounded-lg text-sm outline-none"
        >
          <option value="">Todos os estágios</option>
          {ALL_NEGOCIO_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select
          value={origemFilter}
          onChange={(e) => { setOrigemFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 dark-input rounded-lg text-sm outline-none"
        >
          <option value="">Todas as origens</option>
          {origens.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-white/50 hover:text-white/70">
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl border border-white/[0.06] overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-[rgba(255,255,255,0.05)] border-b border-white/[0.06]">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-white/50 cursor-pointer select-none" onClick={() => toggleSort("nome")}>
                Nome / Empresa<SortIcon col="nome" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Negócio</th>
              <th className="text-left px-4 py-3 font-medium text-white/50 cursor-pointer select-none" onClick={() => toggleSort("leadScore")}>
                Score<SortIcon col="leadScore" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Origem</th>
              <th className="text-left px-4 py-3 font-medium text-white/50 hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort("mrrEstimado")}>
                Receita<SortIcon col="mrrEstimado" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-white/50 hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("updatedAt")}>
                Último contato<SortIcon col="updatedAt" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-white/50 hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort("whatsappUltimaMsgAt")}>
                WhatsApp<SortIcon col="whatsappUltimaMsgAt" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-white/50">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {isLoading && <SkeletonRow count={6} />}
            {data?.leads.map((lead) => {
              const leadAny = lead as Lead & { tipo?: string };
              const ti = getContatoTipoInfo(leadAny.tipo || "lead");
              return (
                <tr
                  key={lead.id}
                  className="hover:bg-white/[0.06] cursor-pointer"
                  onClick={() => setDetailId(lead.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const photo = lead.apolloPhotoUrl || lead.avatarUrl;
                        const isPlaceholder = photo && photo.includes("static.licdn.com");
                        if (photo && !isPlaceholder) {
                          return <img src={photo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />;
                        }
                        return <div className="avatar-sm">{getInitials(lead.nome)}</div>;
                      })()}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{lead.nome}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${ti.color}15`, color: ti.color }}>
                            {ti.label}
                          </span>
                          {lead.enrichStatus === "enriched" && (
                            <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400">Apollo</span>
                          )}
                        </div>
                        <p className="text-xs text-white/50">
                          {[lead.cargo, lead.empresa].filter(Boolean).join(" · ") || lead.empresa || ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {lead.negocioPrincipal ? (() => {
                      const si = getNegocioStatusInfo(lead.negocioPrincipal.status);
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDrawerNegocioId(lead.negocioPrincipal!.id); }}
                          className="text-left group"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: si.color }} />
                            <span className="text-xs text-white/80 group-hover:text-white truncate max-w-[140px]">
                              {lead.negocioPrincipal.titulo}
                            </span>
                            {(lead.negocioCount || 0) > 1 && (
                              <span className="text-[10px] text-white/40 flex-shrink-0">+{(lead.negocioCount || 0) - 1}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-white/40">{si.label}</span>
                        </button>
                      );
                    })() : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBar score={lead.leadScore} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white/70">
                      {origens.find((o) => o.key === lead.origem)?.label || lead.origem || "Direto"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {renderRevenueCell(lead)}
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs hidden md:table-cell">
                    {timeAgo(lead.updatedAt)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {lead.whatsappUltimaMsgAt ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(lead); }}
                        className="text-left group max-w-[160px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="text-xs text-white/60 truncate group-hover:text-white">
                            {lead.whatsappUltimaMsg
                              ? (lead.whatsappUltimaMsg.length > 30 ? lead.whatsappUltimaMsg.slice(0, 30) + "..." : lead.whatsappUltimaMsg)
                              : "Conversa ativa"}
                          </span>
                          {(lead.whatsappNaoLidas || 0) > 0 && (
                            <span className="ml-auto flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                              {lead.whatsappNaoLidas}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-white/30">{timeAgo(lead.whatsappUltimaMsgAt)}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {lead.telefone ? (
                        <a href={`tel:${lead.telefone}`} title="Ligar" className="p-1.5 rounded hover:bg-blue-500/15 text-blue-400">
                          <Phone className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="p-1.5 text-white/15 cursor-not-allowed" title="Sem telefone">
                          <Phone className="w-4 h-4" />
                        </span>
                      )}
                      <button
                        onClick={() => openWhatsApp(lead)}
                        title={canWhatsApp(lead) ? "WhatsApp" : "Sem telefone"}
                        disabled={!canWhatsApp(lead) || whatsappLoading === lead.id}
                        className={`p-1.5 rounded ${canWhatsApp(lead) ? "hover:bg-emerald-500/15 text-emerald-400" : "text-white/15 cursor-not-allowed"}`}
                      >
                        {whatsappLoading === lead.id ? (
                          <span className="w-4 h-4 block border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4" />
                        )}
                      </button>
                      <button onClick={() => { setNoteModal({ leadId: lead.id, nome: lead.nome }); setNoteText(""); }} title="Nota" className="p-1.5 rounded hover:bg-yellow-500/15 text-yellow-400">
                        <FileEdit className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="text-[11px] text-[#e23752] hover:text-[#f06d82] font-medium ml-1"
                        title="Abrir página completa"
                      >
                        Abrir
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {data && data.leads.length === 0 && (
              <tr><td colSpan={8}>
                <EmptyState
                  icon={Users}
                  title="Nenhum lead encontrado"
                  description={hasFilters ? "Tente ajustar os filtros" : "Crie seu primeiro lead para começar. Leads podem ser criados manualmente, importados de formulários, ou gerados via WhatsApp."}
                  action={hasFilters ? { label: "Limpar filtros", onClick: clearFilters } : { label: "Novo Lead", onClick: () => setShowNewLead(true) }}
                />
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/50">{data.total} leads</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border border-white/[0.06] rounded-lg text-sm text-white/50 disabled:opacity-50">Anterior</button>
            <span className="px-3 py-1 text-sm text-white/70">{page} / {data.totalPages}</span>
            <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border border-white/[0.06] rounded-lg text-sm text-white/50 disabled:opacity-50">Próximo</button>
          </div>
        </div>
      )}

      {/* Lead Detail Panel (slide-in) */}
      {detailId && (
        <div
          className="fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
          onClick={() => setDetailId(null)}
        >
          <div
            className="detail-slide fixed top-12 lg:top-0 right-0 h-[calc(100%-3rem)] lg:h-full overflow-y-auto"
            style={{
              width: "480px",
              maxWidth: "100vw",
              background: "#16181F",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setDetailId(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {detailLoading && <SkeletonDetailPanel />}

            {dl && dlTi && (
              <div className="p-6 space-y-5">
                {/* Header with avatar */}
                <div className="flex items-start gap-3 pr-8">
                  <div className="shrink-0">
                    {dl.avatarUrl ? (
                      <img src={dl.avatarUrl as string} alt={dl.nome} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: "linear-gradient(135deg, #e23752, #8e27ef)" }}>
                        {getInitials(dl.nome)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">{dl.nome}</h2>
                    {dl.cargo && <p className="text-sm text-white/50">{dl.cargo as string}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="badge badge-dot" style={{ backgroundColor: `${dlTi.color}15`, color: dlTi.color }}>
                        {dlTi.label}
                      </span>
                      <ScoreBar score={dl.leadScore} />
                      {dl.enrichStatus === "enriched" && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400">Apollo</span>}
                      {dl.labels && (dl.labels as Array<{ id: string; nome: string; cor: string }>).map((lb) => (
                        <span key={lb.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${lb.cor}20`, color: lb.cor }}>
                          {lb.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${dl.telefone}`} className="action-chip" style={{ "--ac": "#3B82F6" } as React.CSSProperties}>
                    <Phone className="w-3.5 h-3.5" /> Ligar
                  </a>
                  <button onClick={() => openWhatsApp(dl as Lead)} disabled={!canWhatsApp(dl as Lead)} className={`action-chip ${!canWhatsApp(dl as Lead) ? "opacity-30 cursor-not-allowed" : ""}`} style={{ "--ac": "#34D399" } as React.CSSProperties}>
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  {dl.email && (
                    <a href={`mailto:${dl.email}`} className="action-chip" style={{ "--ac": "#06B6D4" } as React.CSSProperties}>
                      <Mail className="w-3.5 h-3.5" /> Email
                    </a>
                  )}
                  <button onClick={() => { setNoteModal({ leadId: dl.id, nome: dl.nome }); setNoteText(""); setDetailId(null); }} className="action-chip" style={{ "--ac": "#FBBF24" } as React.CSSProperties}>
                    <StickyNote className="w-3.5 h-3.5" /> Nota
                  </button>
                </div>

                {/* Contact info */}
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2.5">
                  <span className="label-sm">Contato</span>
                  {dl.telefone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      <a href={`tel:${dl.telefone}`} className="text-white/70 hover:text-white">{dl.telefone}</a>
                    </div>
                  )}
                  {dl.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      <a href={`mailto:${dl.email}`} className="text-white/70 hover:text-white truncate">{dl.email}</a>
                    </div>
                  )}
                  {dl.linkedin && (
                    <div className="flex items-center gap-2 text-sm">
                      <Linkedin className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      <a href={String(dl.linkedin).startsWith("http") ? String(dl.linkedin) : `https://${dl.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-[#e23752] hover:underline truncate">{String(dl.linkedin).replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")}</a>
                    </div>
                  )}
                  {(dl.empresaCidade || dl.empresaEstado) && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      <span className="text-white/70">{[dl.empresaCidade, dl.empresaEstado].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                </div>

                {/* Empresa card */}
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <span className="label-sm">Empresa</span>
                  {dl.empresa ? (
                    <div className="mt-2">
                      <button
                        onClick={() => { if (dlEmpresa?.id) { setDrawerEmpresaId(dlEmpresa.id as string); } }}
                        className="flex items-center gap-2 text-sm font-medium text-white hover:text-[#e23752] transition-colors"
                      >
                        <Building2 className="w-4 h-4 text-[#e23752]" />
                        {dl.empresa}
                      </button>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/40">
                        {dl.empresaSetor ? <span>{setores.find((s) => s.key === dl.empresaSetor)?.label || dl.empresaSetor}</span> : null}
                        {dlEmpresa?.porte ? <span>{String(dlEmpresa.porte).charAt(0).toUpperCase() + String(dlEmpresa.porte).slice(1)}</span> : null}
                        {dlEmpresa?.website ? (
                          <a href={String(dlEmpresa.website).startsWith("http") ? String(dlEmpresa.website) : `https://${dlEmpresa.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#e23752] hover:underline">
                            <Globe className="w-3 h-3" /> {String(dlEmpresa.website).replace(/https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                          </a>
                        ) : null}
                        {dlEmpresa?.industry ? <span>{String(dlEmpresa.industry)}</span> : null}
                        {dlEmpresa?.employeeCount ? <span>{Number(dlEmpresa.employeeCount).toLocaleString("pt-BR")} func.</span> : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/30 mt-2">Sem empresa vinculada</p>
                  )}
                </div>

                {/* Origem + Funil + Valores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="info-card">
                    <span className="label-sm">Origem</span>
                    <p className="text-sm text-white mt-1">
                      {origens.find((o) => o.key === dl.origem)?.label || dl.origem || "Direto"}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{new Date(dl.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="info-card">
                    <span className="label-sm">No funil há</span>
                    <p className="text-xl font-bold text-white mt-1">{daysInFunnel} <span className="text-sm font-normal text-white/40">dias</span></p>
                  </div>
                </div>

                {/* Financial summary */}
                {(dl.mrrEstimado || dl.valorProjeto) && (
                  <div className="mrr-highlight">
                    <div className="flex items-baseline justify-between">
                      {dl.mrrEstimado && (
                        <div>
                          <span className="label-sm">MRR Estimado</span>
                          <p className="text-2xl font-bold mt-1" style={{ color: "#e23752" }}>
                            R$ {parseFloat(dl.mrrEstimado as string).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      )}
                      {dl.valorProjeto && (
                        <div className={dl.mrrEstimado ? "text-right" : ""}>
                          <span className="label-sm">Valor Projeto</span>
                          <p className="text-lg font-bold text-white mt-0.5">
                            R$ {parseFloat(dl.valorProjeto as string).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Negócios */}
                {dlNegocios.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="label-sm">Negócios ({dlNegocios.length})</span>
                    </div>
                    <div className="space-y-2">
                      {dlNegocios.slice(0, 5).map((neg) => {
                        const st = String(neg.status || "novo");
                        const stInfo = getNegocioStatusInfo(st);
                        return (
                          <button
                            key={neg.id as string}
                            onClick={() => setDrawerNegocioId(neg.id as string)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left"
                          >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColors[st] || "#6B7280" }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{String(neg.titulo)}</p>
                              <p className="text-xs text-white/40">{stInfo.label}</p>
                            </div>
                            {neg.valorTotal ? (
                              <span className="text-xs font-medium text-white/60 shrink-0">
                                R$ {parseFloat(String(neg.valorTotal)).toLocaleString("pt-BR")}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Propostas */}
                {dlPropostas.length > 0 && (
                  <div>
                    <span className="label-sm">Propostas ({dlPropostas.length})</span>
                    <div className="space-y-1.5 mt-2">
                      {dlPropostas.slice(0, 4).map((p) => (
                        <Link
                          key={p.id as string}
                          href={`/propostas/${p.id}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: propostaStatusColors[String(p.status)] || "#6B7280" }} />
                            <span className="text-xs text-white/70 truncate">{String(p.titulo || p.numero || "Proposta")}</span>
                          </div>
                          <span className="text-xs text-white/40 shrink-0 capitalize">{String(p.status)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contratos */}
                {dlContratos.length > 0 && (
                  <div>
                    <span className="label-sm">Contratos ({dlContratos.length})</span>
                    <div className="space-y-1.5 mt-2">
                      {dlContratos.slice(0, 3).map((c) => (
                        <Link
                          key={c.id as string}
                          href={`/contratos/${c.id}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-white/30" />
                            <span className="text-xs text-white/70">{String(c.tipo || "Contrato")}</span>
                          </div>
                          <span className={`text-xs ${c.status === "ativo" ? "text-emerald-400" : "text-white/40"}`}>{String(c.status)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tarefas pendentes */}
                {dlTarefas.filter((t) => !t.concluida).length > 0 && (
                  <div>
                    <span className="label-sm">Tarefas pendentes ({dlTarefas.filter((t) => !t.concluida).length})</span>
                    <div className="space-y-1.5 mt-2">
                      {dlTarefas.filter((t) => !t.concluida).slice(0, 4).map((t) => (
                        <div key={t.id as string} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-xs text-white/70 truncate">{String(t.titulo)}</span>
                          {t.venceEm ? (
                            <span className="text-[10px] text-white/30 shrink-0">{new Date(t.venceEm as string).toLocaleDateString("pt-BR")}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent activities */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="label-sm">Atividades recentes</span>
                    <Link href={`/leads/${dl.id}`} className="text-[11px] text-[#e23752] hover:text-[#f06d82] font-medium flex items-center gap-1">
                      Ver tudo <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  {recentActivities.length === 0 && (
                    <p className="text-xs text-white/30">Nenhuma atividade registrada</p>
                  )}
                  <div className="space-y-2">
                    {recentActivities.map((act) => (
                      <div key={act.id as string} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.02]">
                        <div className="mt-0.5">{getActivityIcon(act.tipo as string)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white/70 capitalize">{(act.tipo as string).replace("_", " ")}</span>
                            <span className="text-[10px] text-white/30">{timeAgo(act.createdAt as string)}</span>
                          </div>
                          {act.descricao ? <p className="text-xs text-white/40 mt-0.5 truncate">{String(act.descricao)}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full page link */}
                <Link
                  href={`/leads/${dl.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-white/[0.06] text-sm text-white/50 hover:text-white hover:border-white/[0.12] transition-colors"
                >
                  Abrir página completa <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50" onClick={() => setNoteModal(null)}>
          <div className="modal-content p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-2">Nota rápida — {noteModal.nome}</h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Escreva sua nota..."
              className="w-full dark-input rounded-lg p-3 text-sm outline-none resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setNoteModal(null)} className="px-4 py-2 text-sm text-white/70 hover:text-white">Cancelar</button>
              <button onClick={saveNote} disabled={savingNote} className="px-4 py-2 text-sm btn-primary rounded-lg disabled:opacity-50 flex items-center gap-2">
                {savingNote ? <><ButtonSpinner /> Salvando...</> : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Modal */}
      {convertModal && (
        <ConvertModal
          leadId={convertModal.leadId}
          nome={convertModal.nome}
          empresa={convertModal.empresa}
          onClose={() => setConvertModal(null)}
          onConverted={() => { setConvertModal(null); refetch(); }}
        />
      )}

      {/* New Lead Modal */}
      {showNewLead && <NewLeadModal onClose={() => setShowNewLead(false)} onCreated={() => { setShowNewLead(false); refetch(); }} />}

      {/* Cross-entity drawers */}
      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenEmpresa={(id) => { setDrawerNegocioId(null); setDrawerEmpresaId(id); }}
      />
      <EmpresaDrawer
        empresaId={drawerEmpresaId}
        open={!!drawerEmpresaId}
        onClose={() => setDrawerEmpresaId(null)}
        onOpenNegocio={(id) => { setDrawerEmpresaId(null); setDrawerNegocioId(id); }}
      />
    </div>
  );
}

function ConvertModal({ leadId, nome, empresa, onClose, onConverted }: { leadId: string; nome: string; empresa: string | null; onClose: () => void; onConverted: () => void }) {
  const [titulo, setTitulo] = useState(empresa ? `${empresa} - Novo negócio` : `${nome} - Novo negócio`);
  const [saving, setSaving] = useState(false);

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contatos/${leadId}/converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo }),
      });
      if (!res.ok) throw new Error();
      toast.success("Convertido com sucesso");
      onConverted();
    } catch {
      toast.error("Erro ao converter");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-white mb-2">Converter para Lead</h3>
        <p className="text-sm text-white/40 mb-4">Crie um negócio para <strong className="text-white/70">{nome}</strong></p>
        <form onSubmit={handleConvert} className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Título do Negócio *</label>
            <input
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/70 hover:text-white">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 flex items-center gap-2">
              {saving ? <><ButtonSpinner /> Convertendo...</> : "Converter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { origens } = usePipelineConfig();
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", empresa: "", origem: "direto", lpUrl: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.telefone) return;
    setSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Lead criado");
      onCreated();
    } catch {
      toast.error("Erro ao criar lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-white mb-4">Novo Lead</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          <input required placeholder="Telefone *" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          <input placeholder="Empresa" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          <select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm">
            {origens.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {form.origem === "biblioteca_de_anuncios" && (
            <input placeholder="URL da Landing Page" value={form.lpUrl} onChange={(e) => setForm({ ...form, lpUrl: e.target.value })}
              className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/70 hover:text-white">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm btn-primary rounded-lg disabled:opacity-50 flex items-center gap-2">
              {saving ? <><ButtonSpinner /> Salvando...</> : "Criar Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
