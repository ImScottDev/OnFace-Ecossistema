"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus, Building2, X, Users, Briefcase, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  setor: string | null;
  porte: string | null;
  cidade: string | null;
  estado: string | null;
  website: string | null;
  numUsuariosTi: number | null;
  numFiliais: number | null;
  createdAt: string;
  updatedAt: string;
  logoUrl?: string | null;
  enrichStatus?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  apolloDescription?: string | null;
}

export default function EmpresasPage() {
  const { setores } = usePipelineConfig();
  const [search, setSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ progress: number; enriched: number; total: number; state: string } | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ empresas: Empresa[]; total: number; totalPages: number }>({
    queryKey: ["empresas", search, setorFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (setorFilter) params.set("setor", setorFilter);
      const res = await fetch(`/api/empresas?${params}`);
      return res.json();
    },
  });

  return (
    <div className="page-scroll space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Empresas</h1>
          <p className="text-[12px] text-white/40 hidden sm:block">Cadastro de empresas vinculadas aos seus leads e negócios.</p>
        </div>
        <div className="flex items-center gap-2">
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
                setEnrichingAll(true);
                try {
                  const dryRunRes = await fetch("/api/empresas/enrich-batch?dryRun=true", { method: "POST" });
                  const dryData = await dryRunRes.json();
                  if (dryData.pendingCount === 0 && dryData.enriched === 0) {
                    toast.info("Todas as empresas já foram enriquecidas");
                    setEnrichingAll(false);
                    return;
                  }
                  const creditsRes = await fetch("/api/apollo/credits");
                  const creditsData = await creditsRes.json();
                  const pending = dryData.pendingCount ?? 0;
                  const estimated = dryData.estimatedCredits ?? pending;
                  const remaining = creditsData.credits_remaining ?? "?";
                  if (!creditsData.configured) {
                    toast.error("Apollo API key não configurada. Configure em Configurações > Integrações.");
                    setEnrichingAll(false);
                    return;
                  }
                  if (!confirm(`Você tem certeza?\n\nIrá consumir ~${estimated} créditos de um total de ${remaining} disponíveis.\n(${pending} empresas pendentes)\n\nIsso pode levar alguns minutos.`)) {
                    setEnrichingAll(false);
                    return;
                  }
                  const res = await fetch("/api/empresas/enrich-batch", { method: "POST" });
                  const data = await res.json();
                  if (res.ok) {
                    setEnrichProgress({ progress: 0, enriched: 0, total: data.total, state: "active" });
                    // Poll — empresas enrich-batch is synchronous, so show result immediately
                    setEnrichProgress(null);
                    setEnrichingAll(false);
                    toast.success(`${data.enriched} de ${data.total} empresas enriquecidas${data.errors ? ` (${data.errors} erros)` : ""}`);
                    refetch();
                  } else if (res.status === 400 && data.error?.includes("API key")) {
                    toast.error("Apollo API key não configurada. Configure em Configurações > Integrações.");
                    setEnrichingAll(false);
                  } else {
                    toast.error(data.error || "Erro");
                    setEnrichingAll(false);
                  }
                } catch { toast.error("Erro de conexão"); setEnrichingAll(false); }
              }}
              disabled={enrichingAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-colors disabled:opacity-40"
            >
              <Sparkles className="w-4 h-4" /> <span title="Busca dados públicos (setor, tamanho, LinkedIn) via Apollo.io — 1 crédito por empresa">{enrichingAll ? "Consultando..." : "Enriquecer Todos"}</span>
            </button>
          )}
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 btn-primary rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Nova Empresa
          </button>
        </div>
      </div>

      {data && (
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-white/[0.06] rounded-full text-white/70">{data.total} empresas</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar empresa ou CNPJ..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 dark-input rounded-lg text-sm outline-none"
          />
        </div>
        <select
          value={setorFilter}
          onChange={(e) => { setSetorFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 dark-input rounded-lg text-sm outline-none"
        >
          <option value="">Todos os setores</option>
          {setores.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="text-white/40 col-span-full text-center py-8">Carregando...</p>}
        {data?.empresas.map((emp) => (
          <div
            key={emp.id}
            onClick={() => setDrawerEmpresaId(emp.id)}
            className="cursor-pointer rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 hover:bg-white/[0.04] transition-colors space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#e23752]/15 flex items-center justify-center shrink-0 overflow-hidden">
                {emp.logoUrl ? (
                  <img src={emp.logoUrl} alt={emp.nome} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                ) : (
                  <Building2 className="w-5 h-5 text-[#e23752]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">{emp.nome}</h3>
                  {emp.enrichStatus === "enriched" && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400 shrink-0">Apollo</span>
                  )}
                </div>
                <p className="text-xs text-white/40">
                  {[
                    emp.industry || setores.find(s => s.key === emp.setor)?.label,
                    emp.employeeCount ? `${emp.employeeCount.toLocaleString("pt-BR")} func.` : (emp.porte && emp.porte.charAt(0).toUpperCase() + emp.porte.slice(1)),
                    emp.cidade && emp.estado ? `${emp.cidade}/${emp.estado}` : emp.estado,
                  ].filter(Boolean).join(" · ") || "Sem detalhes"}
                </p>
              </div>
            </div>
            {emp.apolloDescription && (
              <p className="text-xs text-white/30 line-clamp-2">{emp.apolloDescription}</p>
            )}
          </div>
        ))}
        {data && data.empresas.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-white/40">Nenhuma empresa encontrada</p>
            <p className="text-[10px] text-white/25 mt-1">Empresas são criadas automaticamente ao cadastrar leads, ou podem ser adicionadas manualmente.</p>
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/50">{data.total} empresas</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border border-white/[0.06] rounded-lg text-sm text-white/50 disabled:opacity-50">Anterior</button>
            <span className="px-3 py-1 text-sm text-white/70">{page} / {data.totalPages}</span>
            <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-white/[0.06] rounded-lg text-sm text-white/50 disabled:opacity-50">Próximo</button>
          </div>
        </div>
      )}

      {showNew && <NewEmpresaModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); refetch(); }} />}

      <EmpresaDrawer
        empresaId={drawerEmpresaId}
        open={!!drawerEmpresaId}
        onClose={() => setDrawerEmpresaId(null)}
        onOpenLead={(id) => { setDrawerEmpresaId(null); setDrawerLeadId(id); }}
        onOpenNegocio={(id) => { setDrawerEmpresaId(null); setDrawerNegocioId(id); }}
      />
      <LeadDrawer
        leadId={drawerLeadId}
        open={!!drawerLeadId}
        onClose={() => setDrawerLeadId(null)}
        onOpenEmpresa={(id) => { setDrawerLeadId(null); setDrawerEmpresaId(id); }}
        onOpenNegocio={(id) => { setDrawerLeadId(null); setDrawerNegocioId(id); }}
      />
      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenLead={(id) => { setDrawerNegocioId(null); setDrawerLeadId(id); }}
        onOpenEmpresa={(id) => { setDrawerNegocioId(null); setDrawerEmpresaId(id); }}
      />
    </div>
  );
}

function NewEmpresaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { setores } = usePipelineConfig();
  const [form, setForm] = useState({ nome: "", cnpj: "", setor: "", porte: "", cidade: "", estado: "", website: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome) return;
    setSaving(true);
    try {
      const res = await fetch("/api/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          cnpj: form.cnpj || null,
          setor: form.setor || null,
          porte: form.porte || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
          website: form.website || null,
        }),
      });
      if (res.ok) onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">Nova Empresa</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.06] rounded"><X className="w-4 h-4 text-white/40" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Nome da empresa *" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          <input placeholder="CNPJ" value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} className="dark-input rounded-lg px-3 py-2 text-sm">
              <option value="">Setor</option>
              {setores.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <div>
              <select value={form.porte} onChange={e => setForm({...form, porte: e.target.value})} className="dark-input rounded-lg px-3 py-2 text-sm w-full">
                <option value="">Porte</option>
                <option value="pequena">Pequena</option>
                <option value="media">Média</option>
                <option value="grande">Grande</option>
              </select>
              <p className="text-[10px] text-white/25 mt-0.5">Pequena: até 50 funcionários. Média: 50-500. Grande: 500+.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Cidade" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})}
              className="dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            <input placeholder="Estado" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}
              className="dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <input placeholder="Website" value={form.website} onChange={e => setForm({...form, website: e.target.value})}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/70">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm btn-primary rounded-lg disabled:opacity-50">
              {saving ? "Salvando..." : "Criar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
