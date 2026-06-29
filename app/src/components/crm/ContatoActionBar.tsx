"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Link2, Unlink, Building2, Briefcase,
  ChevronDown, Search, Loader2, HandMetal, Bot, BotOff,
} from "lucide-react";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";

// ─── Types ───────────────────────────────────────────────

export interface ContatoData {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  canal: string;
  leadId?: string | null;
  responsavelId?: string | null;
  leadNome?: string | null;
  leadStatus?: string | null;
  empresaId?: string | null;
  empresaNome?: string | null;
  negocioAtivoId?: string | null;
  negocioTitulo?: string | null;
  negocioStatus?: string | null;
}

interface ContatoActionBarProps {
  contato: ContatoData;
  currentUserId: string;
  userRole: string;
  onUpdate?: () => void;
  /** When true, renders as inline buttons (no wrapping bar) for embedding in a header */
  inline?: boolean;
}

// ─── Sub-components ─────────────────────────────────────

function LeadSearchDropdown({
  onSelect,
  onClose,
}: {
  onSelect: (leadId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data: results, isLoading } = useQuery({
    queryKey: ["lead-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const res = await fetch(`/api/leads?search=${encodeURIComponent(search)}&limit=10`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.leads || [];
    },
    enabled: search.length >= 2,
    staleTime: 5000,
  });

  return (
    <div className="absolute top-full left-0 mt-1 w-72 rounded-lg shadow-xl border border-white/[0.08] z-50 p-2" style={{ background: "var(--bg-elevated)" }}>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md mb-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Search size={14} className="text-white/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar lead por nome..."
          className="flex-1 text-sm outline-none bg-transparent text-white placeholder:text-white/30"
          autoFocus
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {isLoading && <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-white/30" /></div>}
        {results?.map((lead: { id: string; nome: string; email?: string; telefone?: string }) => (
          <button
            key={lead.id}
            onClick={() => { onSelect(lead.id); onClose(); }}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-white/[0.06] text-sm"
          >
            <div className="font-medium text-white/80">{lead.nome}</div>
            <div className="text-xs text-white/40">{lead.email || lead.telefone || ""}</div>
          </button>
        ))}
        {search.length >= 2 && !isLoading && results?.length === 0 && (
          <div className="text-xs text-white/30 text-center py-2">Nenhum lead encontrado</div>
        )}
      </div>
      <button onClick={onClose} className="w-full text-xs text-white/30 mt-1 hover:text-white/50">Fechar</button>
    </div>
  );
}

function EmpresaSearchDropdown({
  onSelectExisting,
  onCreateNew,
  onClose,
}: {
  onSelectExisting: (empresaId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data: results, isLoading } = useQuery({
    queryKey: ["empresa-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const res = await fetch(`/api/empresas?search=${encodeURIComponent(search)}&limit=10`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.empresas || data || [];
    },
    enabled: search.length >= 2,
    staleTime: 5000,
  });

  return (
    <div className="absolute top-full right-0 mt-1 w-72 rounded-lg shadow-xl border border-white/[0.08] z-50 p-2" style={{ background: "var(--bg-elevated)" }}>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md mb-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Search size={14} className="text-white/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa..."
          className="flex-1 text-sm outline-none bg-transparent text-white placeholder:text-white/30"
          autoFocus
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {isLoading && <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-white/30" /></div>}
        {results?.map((emp: { id: string; nome: string; setor?: string }) => (
          <button
            key={emp.id}
            onClick={() => { onSelectExisting(emp.id); onClose(); }}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-white/[0.06] text-sm"
          >
            <div className="font-medium text-white/80">{emp.nome}</div>
            {emp.setor && <div className="text-xs text-white/40">{emp.setor}</div>}
          </button>
        ))}
      </div>
      <button
        onClick={() => { onCreateNew(); onClose(); }}
        className="w-full text-left px-2 py-1.5 text-sm text-purple-400 hover:bg-purple-500/10 rounded mt-1 border-t border-white/[0.06]"
      >
        + Criar nova empresa
      </button>
      <button onClick={onClose} className="w-full text-xs text-white/30 mt-1 hover:text-white/50">Fechar</button>
    </div>
  );
}

// ─── Pipeline Stages ─────────────────────────────────────

function PipelineStages({
  negocioId,
  currentStatus,
  onUpdate,
}: {
  negocioId: string;
  currentStatus: string;
  onUpdate?: () => void;
}) {
  const queryClient = useQueryClient();
  const { stages } = usePipelineConfig();
  const currentIndex = stages.findIndex(s => s.key === currentStatus);

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["negocio", negocioId] });
      onUpdate?.();
    },
  });

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none max-w-full">
      {stages.map((stage, idx) => {
        const isActive = stage.key === currentStatus;
        const isPast = idx < currentIndex;
        return (
          <button
            key={stage.key}
            onClick={() => updateStatus.mutate(stage.key)}
            disabled={updateStatus.isPending}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-all shrink-0 whitespace-nowrap ${
              isActive
                ? "text-white shadow-sm"
                : "text-white/30 hover:bg-white/[0.08]"
            }`}
            style={isActive ? { backgroundColor: stage.color } : { backgroundColor: isPast ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)" }}
            title={stage.label}
          >
            {stage.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export function ContatoActionBar({ contato, currentUserId, userRole, onUpdate, inline = false }: ContatoActionBarProps) {
  const queryClient = useQueryClient();
  const [showLeadSearch, setShowLeadSearch] = useState(false);
  const [showEmpresaSearch, setShowEmpresaSearch] = useState(false);
  const [showCreateEmpresa, setShowCreateEmpresa] = useState(false);
  const [newEmpresaNome, setNewEmpresaNome] = useState("");

  const isUnassigned = !contato.responsavelId;
  const hasLead = !!contato.leadId;
  const hasEmpresa = !!contato.empresaId;
  const hasNegocio = !!contato.negocioAtivoId;

  // ─── Mutations ─────────────────────────────────────

  const criarLead = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contatos/${contato.id}/criar-lead`, { method: "POST" });
      if (!res.ok) throw new Error("Falha ao criar lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      onUpdate?.();
    },
  });

  const vincularLead = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(`/api/contatos/${contato.id}/vincular-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (!res.ok) throw new Error("Falha ao vincular lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      onUpdate?.();
    },
  });

  const desvincular = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contatos/${contato.id}/desvincular`, { method: "POST" });
      if (!res.ok) throw new Error("Falha ao desvincular");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      onUpdate?.();
    },
  });

  const atribuir = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contatos/${contato.id}/atribuir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: currentUserId }),
      });
      if (!res.ok) throw new Error("Falha ao atribuir");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      onUpdate?.();
    },
  });

  const vincularEmpresa = useMutation({
    mutationFn: async (empresaId: string) => {
      const res = await fetch(`/api/leads/${contato.leadId}/vincular-empresa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId }),
      });
      if (!res.ok) throw new Error("Falha ao vincular empresa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      onUpdate?.();
    },
  });

  const criarEmpresa = useMutation({
    mutationFn: async (nome: string) => {
      const res = await fetch(`/api/leads/${contato.leadId}/vincular-empresa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criar: true, nome }),
      });
      if (!res.ok) throw new Error("Falha ao criar empresa");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      setShowCreateEmpresa(false);
      setNewEmpresaNome("");
      onUpdate?.();
    },
  });

  const [negocioCriado, setNegocioCriado] = useState(false);

  const criarNegocio = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/leads/${contato.leadId}/vincular-negocio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criar: true, titulo: `Negocio - ${contato.leadNome || contato.nome}` }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao criar negocio");
      }
      return res.json();
    },
    onSuccess: () => {
      setNegocioCriado(true);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      onUpdate?.();
    },
  });

  // ─── AI SDR Toggle ────────────────────────────────

  const { data: aiState } = useQuery({
    queryKey: ["ai-sdr-state", contato.id],
    queryFn: async () => {
      const res = await fetch(`/api/ai-sdr/contatos/${contato.id}/state`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.state as { aiAtivo: boolean } | null;
    },
    staleTime: 10000,
  });

  const toggleAi = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ai-sdr/contatos/${contato.id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiAtivo: !(aiState?.aiAtivo ?? false) }),
      });
      if (!res.ok) throw new Error("Falha ao alternar AI");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sdr-state", contato.id] });
    },
  });

  const aiAtivo = aiState?.aiAtivo ?? false;

  const AiToggleButton = () => (
    <button
      onClick={(e) => { e.stopPropagation(); toggleAi.mutate(); }}
      disabled={toggleAi.isPending}
      className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-all ${
        aiAtivo
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
          : "bg-white/[0.04] text-white/40 border border-white/[0.08]"
      }`}
      title={aiAtivo ? "AI SDR ativo — clique para desativar" : "AI SDR desativado — clique para ativar"}
    >
      {aiAtivo ? <Bot size={12} /> : <BotOff size={12} />}
      {aiAtivo ? "AI On" : "AI Off"}
    </button>
  );

  // ─── Wrapper helper ────────────────────────────────

  const barClass = inline
    ? "flex items-center gap-2 min-w-0 relative"
    : "flex items-center gap-2 px-3 py-2 min-w-0 relative";
  const barBorder = inline ? {} : { borderBottom: "1px solid rgba(255,255,255,0.06)" };

  // ─── Render: Unassigned ────────────────────────────

  if (isUnassigned) {
    return (
      <div className={barClass} style={{ ...barBorder, ...(inline ? {} : { background: "rgba(245,158,11,0.08)" }) }}>
        <button
          onClick={() => atribuir.mutate()}
          disabled={atribuir.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-md hover:bg-amber-600 transition-colors"
        >
          <HandMetal size={13} />
          {atribuir.isPending ? "..." : "Assumir"}
        </button>
        <AiToggleButton />
      </div>
    );
  }

  // ─── Render: No lead linked ────────────────────────

  if (!hasLead) {
    return (
      <div className={barClass} style={barBorder}>
        <button
          onClick={() => criarLead.mutate()}
          disabled={criarLead.isPending}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md transition-colors"
          style={{ background: "rgba(99,102,241,0.15)", color: "#e23752", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          <UserPlus size={12} />
          {criarLead.isPending ? "..." : "Criar Lead"}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowLeadSearch(!showLeadSearch)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Link2 size={12} />
            Vincular Lead
            <ChevronDown size={10} />
          </button>
          {showLeadSearch && (
            <LeadSearchDropdown
              onSelect={(id) => vincularLead.mutate(id)}
              onClose={() => setShowLeadSearch(false)}
            />
          )}
        </div>
        <AiToggleButton />
      </div>
    );
  }

  // ─── Render: Has lead + negocio ativo → pipeline stages

  if (hasNegocio && contato.negocioStatus) {
    return (
      <div className={barClass} style={barBorder}>
        <PipelineStages
          negocioId={contato.negocioAtivoId!}
          currentStatus={contato.negocioStatus}
          onUpdate={onUpdate}
        />
        <AiToggleButton />
      </div>
    );
  }

  // ─── Render: Has lead, no negocio → empresa/negocio actions

  return (
    <div className={barClass} style={barBorder}>
      <div className="flex items-center gap-1.5">
        {!hasEmpresa && (
          <div className="relative">
            <button
              onClick={() => setShowEmpresaSearch(!showEmpresaSearch)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Building2 size={11} />
              Empresa
              <ChevronDown size={10} />
            </button>
            {showEmpresaSearch && (
              <EmpresaSearchDropdown
                onSelectExisting={(id) => vincularEmpresa.mutate(id)}
                onCreateNew={() => { setShowEmpresaSearch(false); setShowCreateEmpresa(true); }}
                onClose={() => setShowEmpresaSearch(false)}
              />
            )}
            {showCreateEmpresa && (
              <div className="absolute top-full right-0 mt-1 w-72 rounded-lg shadow-xl border border-white/[0.08] z-50 p-3" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-xs text-white/50 mb-2">Nova Empresa</p>
                <input
                  type="text"
                  value={newEmpresaNome}
                  onChange={(e) => setNewEmpresaNome(e.target.value)}
                  placeholder="Nome da empresa..."
                  className="w-full text-sm outline-none bg-white/[0.05] border border-white/[0.08] rounded-md px-2 py-1.5 text-white placeholder:text-white/30 mb-2"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && newEmpresaNome.trim()) criarEmpresa.mutate(newEmpresaNome.trim()); }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { if (newEmpresaNome.trim()) criarEmpresa.mutate(newEmpresaNome.trim()); }}
                    disabled={!newEmpresaNome.trim() || criarEmpresa.isPending}
                    className="flex-1 text-xs py-1.5 rounded-md bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-40"
                  >
                    {criarEmpresa.isPending ? "Criando..." : "Criar"}
                  </button>
                  <button onClick={() => { setShowCreateEmpresa(false); setNewEmpresaNome(""); }} className="text-xs text-white/30 hover:text-white/50 px-2">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!negocioCriado && (
          <button
            onClick={() => criarNegocio.mutate()}
            disabled={criarNegocio.isPending}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors"
            style={{ background: "rgba(16,185,129,0.1)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <Briefcase size={11} />
            {criarNegocio.isPending ? "..." : "Criar Negocio"}
          </button>
        )}
      </div>
      <AiToggleButton />
    </div>
  );
}
