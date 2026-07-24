"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Search, Plus, Building2, X, Sparkles, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const ENRICH_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  enriched: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Apollo" },
  error: { bg: "bg-red-500/15", text: "text-red-400", label: "Erro" },
  not_found: { bg: "bg-white/[0.06]", text: "text-white/40", label: "Não encontrado" },
};

export default function EmpresasPage() {
  const { setores } = usePipelineConfig();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ progress: number; enriched: number; total: number; state: string } | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout>(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const { data, isLoading, refetch } = useQuery<{ empresas: Empresa[]; total: number; totalPages: number }>({
    queryKey: ["empresas", debouncedSearch, setorFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (setorFilter) params.set("setor", setorFilter);
      const res = await fetch(`/api/empresas?${params}`);
      return res.json();
    },
  });

  const empresas = data?.empresas ?? [];

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

      {/* ─── Filtros ─── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      {/* ─── Tabela ─── */}
      {isLoading ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-12 text-center text-white/30 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Carregando empresas...
        </div>
      ) : empresas.length === 0 ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-12 text-center">
          <Building2 className="w-12 h-12 text-white/15 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Nenhuma empresa encontrada</p>
          <p className="text-[10px] text-white/25 mt-1">Empresas são criadas automaticamente ao cadastrar leads, ou podem ser adicionadas manualmente.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">CNPJ</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">Setor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">Porte</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">Local</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden xl:table-cell">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => setDrawerEmpresaId(emp.id)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#e23752]/15 flex items-center justify-center shrink-0 overflow-hidden">
                          {emp.logoUrl ? (
                            <img src={emp.logoUrl} alt={emp.nome} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                          ) : (
                            <Building2 className="w-4 h-4 text-[#e23752]" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors truncate max-w-[220px]">
                          {emp.nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/50 hidden md:table-cell whitespace-nowrap">
                      {emp.cnpj || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/50 hidden md:table-cell truncate max-w-[160px]">
                      {emp.industry || setores.find((s) => s.key === emp.setor)?.label || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/50 hidden lg:table-cell">
                      {emp.employeeCount
                        ? `${emp.employeeCount.toLocaleString("pt-BR")} func.`
                        : emp.porte
                        ? emp.porte.charAt(0).toUpperCase() + emp.porte.slice(1)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/50 hidden lg:table-cell whitespace-nowrap">
                      {emp.cidade && emp.estado ? `${emp.cidade}/${emp.estado}` : emp.estado || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {emp.enrichStatus && ENRICH_BADGE[emp.enrichStatus] ? (
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ENRICH_BADGE[emp.enrichStatus].bg} ${ENRICH_BADGE[emp.enrichStatus].text}`}>
                          {ENRICH_BADGE[emp.enrichStatus].label}
                        </span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40 hidden xl:table-cell whitespace-nowrap">
                      {formatDate(emp.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
              <span className="text-xs text-white/40">
                Página {page} de {data.totalPages} ({data.total} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg text-white/50 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (data.totalPages <= 7) pageNum = i + 1;
                  else if (page <= 4) pageNum = i + 1;
                  else if (page >= data.totalPages - 3) pageNum = data.totalPages - 6 + i;
                  else pageNum = page - 3 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        pageNum === page ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-white/50 hover:bg-white/[0.06]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="p-1.5 rounded-lg text-white/50 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
