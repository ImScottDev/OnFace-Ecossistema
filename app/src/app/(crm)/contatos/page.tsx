"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  UserRound, Search, Plus, X, Trash2, ArrowRightLeft, ListPlus,
  Sparkles, ChevronLeft, ChevronRight, Check, Loader2, Settings2, MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { isCelular } from "@/lib/utils/phone";
import { toast } from "sonner";

/* ─── Types ─── */
interface Contato {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  cargo: string | null;
  origem: string | null;
  canais: string[];
  listas: { id: string; nome: string; cor: string }[];
  createdAt: string;
}

interface ContatosResponse {
  contatos: Contato[];
  total: number;
  page: number;
  totalPages: number;
}

interface Lista {
  id: string;
  nome: string;
  cor: string;
  count: number;
}

/* ─── Constants ─── */
const CANAL_OPTIONS = [
  { value: "", label: "Todos os Canais" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "apollo", label: "Apollo" },
];

const ORIGEM_OPTIONS = [
  { value: "", label: "Todas as Origens" },
  { value: "manual", label: "Manual" },
  { value: "apollo", label: "Apollo" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
];

const CANAL_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  whatsapp: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "WhatsApp" },
  email: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Email" },
  apollo: { bg: "bg-purple-500/15", text: "text-purple-400", label: "Apollo" },
};

const LISTA_PALETTE = [
  "#e23752", "#e23752", "#3B82F6", "#10B981",
  "#F59E0B", "#EF4444", "#EC4899", "#06B6D4",
];

/* ─── Helpers ─── */
function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ─── Component ─── */
export default function ContatosPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [canalFilter, setCanalFilter] = useState("");
  const [listaFilter, setListaFilter] = useState("");
  const [origemFilter, setOrigemFilter] = useState("");
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [showNewContact, setShowNewContact] = useState(false);
  const [showListasPanel, setShowListasPanel] = useState(false);
  const [showAddToLista, setShowAddToLista] = useState(false);

  // New contact form
  const [newForm, setNewForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    empresa: "",
    cargo: "",
    origem: "manual",
  });

  // New lista form
  const [newListaForm, setNewListaForm] = useState({ nome: "", cor: LISTA_PALETTE[0] });

  // Debounce search
  const debounceRef = useRef<NodeJS.Timeout>(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [canalFilter, listaFilter, origemFilter]);

  /* ─── Queries ─── */
  const { data, isLoading, refetch } = useQuery<ContatosResponse>({
    queryKey: ["contatos", debouncedSearch, canalFilter, listaFilter, origemFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (canalFilter) params.set("canal", canalFilter);
      if (listaFilter) params.set("lista", listaFilter);
      if (origemFilter) params.set("origem", origemFilter);
      const res = await fetch(`/api/contatos-unified?${params}`);
      if (!res.ok) throw new Error("Erro ao carregar contatos");
      return res.json();
    },
  });

  const { data: listas = [], refetch: refetchListas } = useQuery<Lista[]>({
    queryKey: ["contatos-listas"],
    queryFn: async () => {
      const res = await fetch("/api/contatos-unified/listas");
      if (!res.ok) return [];
      return res.json();
    },
  });

  /* ─── Mutations ─── */
  const createContato = useMutation({
    mutationFn: async (payload: typeof newForm) => {
      const res = await fetch("/api/contatos-unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar contato");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Contato criado com sucesso");
      setShowNewContact(false);
      setNewForm({ nome: "", email: "", telefone: "", empresa: "", cargo: "", origem: "manual" });
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createLista = useMutation({
    mutationFn: async (payload: { nome: string; cor: string }) => {
      const res = await fetch("/api/contatos-unified/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: payload.nome, cor: payload.cor, descricao: "" }),
      });
      if (!res.ok) throw new Error("Erro ao criar lista");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Lista criada");
      setNewListaForm({ nome: "", cor: LISTA_PALETTE[0] });
      refetchListas();
    },
    onError: () => toast.error("Erro ao criar lista"),
  });

  const deleteLista = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contatos-unified/listas?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir lista");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Lista excluída");
      refetchListas();
      refetch();
    },
    onError: () => toast.error("Erro ao excluir lista"),
  });

  const addToLista = useMutation({
    mutationFn: async (listaId: string) => {
      const res = await fetch("/api/contatos-unified/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", listaId, leadIds: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("Erro ao adicionar à lista");
      return res.json();
    },
    onSuccess: () => {
      toast.success(`${selected.size} contato(s) adicionado(s) à lista`);
      setShowAddToLista(false);
      setSelected(new Set());
      refetch();
      refetchListas();
    },
    onError: () => toast.error("Erro ao adicionar à lista"),
  });

  /* ─── Batch actions ─── */
  const handleConvertSelected = useCallback(async () => {
    if (!confirm(`Converter ${selected.size} contato(s) em lead?`)) return;
    let ok = 0;
    for (const id of selected) {
      try {
        const res = await fetch(`/api/contatos-unified/${id}/converter`, { method: "POST" });
        if (res.ok) ok++;
      } catch { /* skip */ }
    }
    toast.success(`${ok} contato(s) convertido(s) em lead`);
    setSelected(new Set());
    refetch();
  }, [selected, refetch]);

  const handleEnrichSelected = useCallback(async () => {
    let creditMsg = `${selected.size} crédito(s)`;
    try {
      const creditsRes = await fetch("/api/apollo/credits");
      const creditsData = await creditsRes.json();
      if (!creditsData.configured) {
        toast.error("Apollo API key não configurada. Configure em Configurações > Integrações.");
        return;
      }
      creditMsg = `~${selected.size} créditos de ${creditsData.credits_remaining ?? "?"} disponíveis`;
    } catch { /* proceed with basic confirm */ }
    if (!confirm(`Enriquecer ${selected.size} contato(s) via Apollo?\n\nIrá consumir ${creditMsg}.`)) return;
    let ok = 0;
    for (const id of selected) {
      try {
        const res = await fetch(`/api/leads/${id}/enrich`, { method: "POST" });
        if (res.ok) ok++;
        else if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          if (data.error?.includes("API key")) {
            toast.error("Apollo API key não configurada. Configure em Admin > Organizações > Integrações.");
            break;
          }
        }
      } catch { /* skip */ }
    }
    toast.success(`${ok} contato(s) enriquecido(s)`);
    setSelected(new Set());
    refetch();
  }, [selected, refetch]);

  const handleDeleteSelected = useCallback(async () => {
    if (!confirm(`Excluir permanentemente ${selected.size} contato(s)?`)) return;
    let ok = 0;
    for (const id of selected) {
      try {
        const res = await fetch(`/api/contatos-unified/${id}`, { method: "DELETE" });
        if (res.ok) ok++;
      } catch { /* skip */ }
    }
    toast.success(`${ok} contato(s) excluído(s)`);
    setSelected(new Set());
    refetch();
  }, [selected, refetch]);

  /* ─── Selection helpers ─── */
  const contatos = data?.contatos ?? [];
  const allOnPageSelected = contatos.length > 0 && contatos.every(c => selected.has(c.id));

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contatos.map(c => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="page-scroll space-y-5">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#e23752] to-[#e23752] shrink-0">
            <UserRound className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Contatos Unificados</h1>
            <p className="text-sm text-white/40 mt-0.5 hidden sm:block">
              Todos os contatos de WhatsApp, Email e Apollo em um só lugar
            </p>
            <p className="text-[12px] text-white/40 hidden lg:block">Base unificada de contatos — reúne leads, clientes e prospects em um só lugar.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowListasPanel(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/70 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] transition-colors"
          >
            <Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">Gerenciar</span> Listas
          </button>
          <button
            onClick={() => setShowNewContact(true)}
            className="flex items-center gap-2 px-4 py-2 btn-primary rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo</span> Contato
          </button>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, telefone, empresa..."
            className="dark-input w-full pl-9"
          />
        </div>
        <select
          value={canalFilter}
          onChange={e => setCanalFilter(e.target.value)}
          className="dark-input text-sm"
        >
          {CANAL_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={listaFilter}
          onChange={e => setListaFilter(e.target.value)}
          className="dark-input text-sm"
        >
          <option value="">Todas as Listas</option>
          {listas.map(l => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
        <select
          value={origemFilter}
          onChange={e => setOrigemFilter(e.target.value)}
          className="dark-input text-sm"
        >
          {ORIGEM_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {data && (
          <span className="text-xs text-white/40 ml-auto">{data.total} contato(s)</span>
        )}
      </div>

      {/* ─── Batch Actions Bar ─── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <span className="text-sm font-medium text-purple-300">
            {selected.size} selecionado(s)
          </span>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <button
            onClick={handleConvertSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 bg-white/[0.06] hover:bg-white/[0.10] transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Converter em Lead</span><span className="sm:hidden">Converter</span>
          </button>
          <button
            onClick={() => setShowAddToLista(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 bg-white/[0.06] hover:bg-white/[0.10] transition-colors"
          >
            <ListPlus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Adicionar à Lista</span><span className="sm:hidden">Lista</span>
          </button>
          <button
            onClick={handleEnrichSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> <span title="Busca dados públicos via Apollo.io — 1 crédito por contato">Enriquecer</span>
          </button>
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors sm:ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        </div>
      )}

      {/* ─── Table ─── */}
      {isLoading ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-12 text-center text-white/30 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Carregando contatos...
        </div>
      ) : contatos.length === 0 ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-12 text-center">
          <UserRound className="w-12 h-12 text-white/15 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Nenhum contato encontrado</p>
          <p className="text-white/30 text-xs mt-1">Ajuste os filtros ou crie um novo contato</p>
          <p className="text-[10px] text-white/25 mt-1">Contatos são criados automaticamente a partir de leads, ou podem ser adicionados manualmente.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="accent-purple-500 rounded"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">
                    Telefone
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">
                    Empresa
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">
                    Canais
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">
                    Listas
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden xl:table-cell">
                    Origem
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden xl:table-cell">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {contatos.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    onClick={() => router.push(`/leads/${c.id}`)}
                  >
                    <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="accent-purple-500 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e23752]/30 to-[#e23752]/30 flex items-center justify-center text-xs font-bold text-purple-300 shrink-0">
                          {getInitials(c.nome)}
                        </div>
                        <span className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors truncate max-w-[200px]">
                          {c.nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/50 hidden md:table-cell truncate max-w-[180px]">
                      {c.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/50 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span>{c.telefone || "—"}</span>
                        {isCelular(c.telefone) && (
                          <Link
                            href={`/whatsapp?leadId=${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded hover:bg-emerald-500/15 text-emerald-400 transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/50 hidden lg:table-cell truncate max-w-[150px]">
                      {c.empresa || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(c.canais ?? []).map(canal => {
                          const badge = CANAL_BADGE[canal];
                          if (!badge) return null;
                          return (
                            <span
                              key={canal}
                              className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(c.listas ?? []).map(lista => (
                          <span
                            key={lista.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-white/60"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: lista.cor }}
                            />
                            {lista.nome}
                          </span>
                        ))}
                        {(!c.listas || c.listas.length === 0) && (
                          <span className="text-white/20 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40 hidden xl:table-cell capitalize">
                      {c.origem || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40 hidden xl:table-cell whitespace-nowrap">
                      {formatDate(c.createdAt)}
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
                Página {data.page} de {data.totalPages} ({data.total} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg text-white/50 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (data.totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= data.totalPages - 3) {
                    pageNum = data.totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        pageNum === page
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "text-white/50 hover:bg-white/[0.06]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
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

      {/* ═══════════════════════════════════════════
          NEW CONTACT MODAL
          ═══════════════════════════════════════════ */}
      {showNewContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-[#1a1b23] border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">Novo Contato</h2>
              <button onClick={() => setShowNewContact(false)} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!newForm.nome.trim()) { toast.error("Nome é obrigatório"); return; }
                createContato.mutate(newForm);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Nome *</label>
                <input
                  value={newForm.nome}
                  onChange={e => setNewForm(f => ({ ...f, nome: e.target.value }))}
                  className="dark-input w-full"
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
                  <input
                    value={newForm.email}
                    onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                    className="dark-input w-full"
                    placeholder="email@exemplo.com"
                    type="email"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Telefone</label>
                  <input
                    value={newForm.telefone}
                    onChange={e => setNewForm(f => ({ ...f, telefone: e.target.value }))}
                    className="dark-input w-full"
                    placeholder="+55 11 99999-0000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Empresa</label>
                  <input
                    value={newForm.empresa}
                    onChange={e => setNewForm(f => ({ ...f, empresa: e.target.value }))}
                    className="dark-input w-full"
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Cargo</label>
                  <input
                    value={newForm.cargo}
                    onChange={e => setNewForm(f => ({ ...f, cargo: e.target.value }))}
                    className="dark-input w-full"
                    placeholder="Cargo / Título"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Origem</label>
                <select
                  value={newForm.origem}
                  onChange={e => setNewForm(f => ({ ...f, origem: e.target.value }))}
                  className="dark-input w-full"
                >
                  <option value="manual">Manual</option>
                  <option value="apollo">Apollo</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="website">Website</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewContact(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 bg-white/[0.06] hover:bg-white/[0.10] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createContato.isPending}
                  className="flex items-center gap-2 px-4 py-2 btn-primary rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {createContato.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar Contato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          ADD TO LISTA DROPDOWN
          ═══════════════════════════════════════════ */}
      {showAddToLista && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-2xl bg-[#1a1b23] border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">Adicionar à Lista</h3>
              <button onClick={() => setShowAddToLista(false)} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 max-h-60 overflow-y-auto space-y-1">
              {listas.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-4">
                  Nenhuma lista criada. Use "Gerenciar Listas" para criar.
                </p>
              ) : (
                listas.map(l => (
                  <button
                    key={l.id}
                    onClick={() => addToLista.mutate(l.id)}
                    disabled={addToLista.isPending}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: l.cor }} />
                    <span className="flex-1">{l.nome}</span>
                    <span className="text-xs text-white/30">{l.count}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          LISTAS MANAGEMENT PANEL (slide-over)
          ═══════════════════════════════════════════ */}
      {showListasPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowListasPanel(false)} />
          <div className="relative w-full max-w-md bg-[#13141b] border-l border-white/[0.06] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">Gerenciar Listas</h2>
              <button onClick={() => setShowListasPanel(false)} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Create new */}
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <p className="text-xs font-medium text-white/50 mb-3">Nova Lista</p>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <input
                    value={newListaForm.nome}
                    onChange={e => setNewListaForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Nome da lista"
                    className="dark-input w-full text-sm"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!newListaForm.nome.trim()) { toast.error("Nome é obrigatório"); return; }
                    createLista.mutate(newListaForm);
                  }}
                  disabled={createLista.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 btn-primary rounded-lg text-sm font-medium shrink-0 disabled:opacity-50"
                >
                  {createLista.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Criar
                </button>
              </div>
              {/* Color picker */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-white/40">Cor:</span>
                {LISTA_PALETTE.map(cor => (
                  <button
                    key={cor}
                    onClick={() => setNewListaForm(f => ({ ...f, cor }))}
                    className={`w-6 h-6 rounded-full transition-all ${
                      newListaForm.cor === cor ? "ring-2 ring-white ring-offset-2 ring-offset-[#13141b] scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>

            {/* Listas list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {listas.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-white/30">Nenhuma lista criada ainda</p>
                  <p className="text-[10px] text-white/25 mt-1">Listas ajudam a organizar contatos por segmento, campanha ou interesse.</p>
                </div>
              ) : (
                listas.map(l => (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] group"
                  >
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: l.cor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{l.nome}</p>
                      <p className="text-xs text-white/30">{l.count} contato(s)</p>
                    </div>
                    <button
                      onClick={() => {
                        if (!confirm(`Excluir lista "${l.nome}"?`)) return;
                        deleteLista.mutate(l.id);
                      }}
                      className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
