"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus, FileText, Send, Check, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { PropostaDrawer } from "@/components/crm/PropostaDrawer";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { getMoedaInfo } from "@/components/crm/proposta-utils";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";

interface Proposta {
  id: string;
  numero: number;
  versao: number;
  status: string;
  moeda: string;
  leadId: string;
  leadNome: string;
  leadEmpresa: string | null;
  totalRecorrente: string;
  totalAvulso: string;
  totalGeral: string;
  dataEmissao: string | null;
  dataValidade: string | null;
  criadoPorNome: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  rascunho: { label: "Rascunho", color: "#6B7280", icon: FileText },
  enviada: { label: "Enviada", color: "#3B82F6", icon: Send },
  aceita: { label: "Aceita", color: "#10B981", icon: Check },
  recusada: { label: "Recusada", color: "#EF4444", icon: X },
  expirada: { label: "Expirada", color: "#F59E0B", icon: AlertTriangle },
};

function formatCurrency(value: string | number) {
  return parseFloat(String(value) || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export default function PropostasPage() {
  const { usuarios, currentUserId } = useOrgUsuarios();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [respFilter, setRespFilter] = useState("minhas"); // "minhas" | "todas" | userId
  const [periodoFilter, setPeriodoFilter] = useState("mes"); // "mes" | "todos"

  // Drawer state
  const [drawerPropostaId, setDrawerPropostaId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);

  // "minhas" resolve pro usuário logado; enquanto ele não carrega, segura a query
  // pra não piscar a lista de todo mundo.
  const respParam = respFilter === "minhas" ? currentUserId : respFilter;
  const { data: propostas, isLoading } = useQuery<Proposta[]>({
    queryKey: ["propostas", statusFilter, search, respParam, periodoFilter],
    enabled: respFilter !== "minhas" || !!currentUserId,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "1000" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("q", search);
      if (respParam && respFilter !== "todas") params.set("responsavel", respParam);
      if (periodoFilter === "mes") params.set("periodo", "mes");
      const res = await fetch(`/api/propostas?${params}`);
      return res.json();
    },
  });

  // Stats
  const abertas = propostas?.filter(p => p.status === "rascunho" || p.status === "enviada") || [];
  const aceitas = propostas?.filter(p => p.status === "aceita") || [];
  const totalAbertasRecorrente = abertas.reduce((s, p) => s + parseFloat(p.totalRecorrente || "0"), 0);
  const totalAbertasAvulso = abertas.reduce((s, p) => s + parseFloat(p.totalAvulso || "0"), 0);
  const totalEnviadas = (propostas?.filter(p => ["enviada", "aceita", "recusada"].includes(p.status)) || []).length;
  // Only show % when we have at least 3 proposals finalized — otherwise the number is misleading (e.g. 1/1 = 100%).
  const taxaAceite = totalEnviadas >= 3 ? Math.round((aceitas.length / totalEnviadas) * 100) : null;

  return (
    <div className="page-scroll space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Propostas</h1>
          <p className="text-[12px] text-white/40 hidden sm:block">Formalize condições comerciais e acompanhe aceites. Cada proposta pode ter múltiplas versões.</p>
        </div>
        <Link href="/propostas/nova" className="flex items-center gap-2 px-4 py-2 btn-primary rounded-lg text-sm font-medium transition-colors w-fit">
          <Plus className="w-4 h-4" /> Nova Proposta
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1">Propostas Abertas</p>
          <p className="text-2xl font-bold text-white">{abertas.length}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1" title="Valor mensal (MRR) das propostas abertas">Recorrente em Proposta</p>
          <p className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>R$ {formatCurrency(totalAbertasRecorrente)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1" title="Valor único de projetos nas propostas abertas">Avulso em Proposta</p>
          <p className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>R$ {formatCurrency(totalAbertasAvulso)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1" title="Propostas aceitas / total de propostas enviadas. Requer ao menos 3 propostas finalizadas.">Taxa de Aceite</p>
          <p className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>{taxaAceite === null ? <span className="text-white/30">—</span> : `${taxaAceite}%`}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por lead..."
            className="dark-input w-full pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="dark-input">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select value={respFilter} onChange={e => setRespFilter(e.target.value)} className="dark-input" title="Responsável">
          <option value="minhas">Minhas</option>
          <option value="todas">Todas as pessoas</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select value={periodoFilter} onChange={e => setPeriodoFilter(e.target.value)} className="dark-input" title="Período">
          <option value="mes">Este mês</option>
          <option value="todos">Todo o histórico</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-8 text-center text-white/30 text-sm">Carregando...</div>
      ) : (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Número</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Lead / Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Recorrente</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">Avulso</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">Validade</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">Criado por</th>
              </tr>
            </thead>
            <tbody>
              {propostas?.map(p => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.rascunho;
                const isExpiring = p.dataValidade && new Date(p.dataValidade) < new Date(Date.now() + 3 * 86400000) && p.status === "enviada";
                const mi = getMoedaInfo(p.moeda || "BRL");
                return (
                  <tr key={p.id}
                    onClick={() => setDrawerPropostaId(p.id)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-mono text-white/70 text-xs">
                      #P-{String(p.numero).padStart(3, "0")}-v{p.versao}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white text-sm">{p.leadNome}</p>
                      {p.leadEmpresa && <p className="text-xs text-white/40 mt-0.5">{p.leadEmpresa}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: sc.color + "20", color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 text-xs">
                      {parseFloat(p.totalRecorrente) > 0 ? `${mi.symbol} ${formatCurrency(p.totalRecorrente)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 text-xs hidden md:table-cell">
                      {parseFloat(p.totalAvulso) > 0 ? `${mi.symbol} ${formatCurrency(p.totalAvulso)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-white text-sm">
                      {mi.symbol} {formatCurrency(p.totalGeral)}
                    </td>
                    <td className={`px-4 py-3 text-xs hidden lg:table-cell ${isExpiring ? "text-amber-400" : "text-white/40"}`}>
                      {p.dataValidade ? new Date(p.dataValidade + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40 hidden lg:table-cell">{p.criadoPorNome || "—"}</td>
                  </tr>
                );
              })}
              {(!propostas || propostas.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-white/30">
                    Nenhuma proposta encontrada
                    <p className="text-[10px] text-white/25 mt-1">Crie propostas a partir da página de um negócio, ou diretamente aqui.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawers */}
      <PropostaDrawer
        propostaId={drawerPropostaId}
        open={!!drawerPropostaId}
        onClose={() => setDrawerPropostaId(null)}
        onOpenLead={(id) => { setDrawerPropostaId(null); setDrawerLeadId(id); }}
      />
      <LeadDrawer
        leadId={drawerLeadId}
        open={!!drawerLeadId}
        onClose={() => setDrawerLeadId(null)}
        onOpenNegocio={(id) => { setDrawerLeadId(null); setDrawerNegocioId(id); }}
        onOpenEmpresa={(id) => { setDrawerLeadId(null); setDrawerEmpresaId(id); }}
      />
      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenLead={(id) => { setDrawerNegocioId(null); setDrawerLeadId(id); }}
        onOpenEmpresa={(id) => { setDrawerNegocioId(null); setDrawerEmpresaId(id); }}
      />
      <EmpresaDrawer
        empresaId={drawerEmpresaId}
        open={!!drawerEmpresaId}
        onClose={() => setDrawerEmpresaId(null)}
        onOpenLead={(id) => { setDrawerEmpresaId(null); setDrawerLeadId(id); }}
        onOpenNegocio={(id) => { setDrawerEmpresaId(null); setDrawerNegocioId(id); }}
      />
    </div>
  );
}
