"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, TrendingUp, FileText, AlertTriangle, Users, CheckCircle2, PauseCircle, XCircle, RefreshCw } from "lucide-react";
import { ContratoDrawer } from "@/components/crm/ContratoDrawer";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";

interface Contrato {
  id: string;
  leadId: string;
  tipo: string;
  descricao: string | null;
  mrr: string | null;
  valorSetup: string | null;
  servicos: string[] | null;
  inicio: string | null;
  vencimento: string | null;
  status: string;
  renovacaoAuto: boolean;
  leadNome?: string;
  leadEmpresa?: string;
}

// Status reais do negócio (decisão Scott 12/jun):
//   Ativo = vigente/faturando | Encerrado = vigência terminou ou saiu do
//   faturamento | Cancelado (churn) = cliente saiu. Legados (pausado/renovado)
//   ficam só como fallback de exibição, fora do filtro.
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  ativo: { label: "Ativo", color: "#10B981", icon: CheckCircle2 },
  concluido: { label: "Encerrado", color: "#6B7280", icon: CheckCircle2 },
  churned: { label: "Cancelado (churn)", color: "#EF4444", icon: XCircle },
};
const STATUS_FALLBACK: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  pausado: { label: "Pausado", color: "#6B7280", icon: PauseCircle },
  cancelado: { label: "Cancelado", color: "#EF4444", icon: XCircle },
  renovado: { label: "Renovado", color: "#3B82F6", icon: RefreshCw },
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

export default function ContratosPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Drawer state
  const [drawerContratoId, setDrawerContratoId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ contratos: Contrato[] }>({
    queryKey: ["contratos", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("q", search);
      const res = await fetch(`/api/contratos?${params}`);
      return res.json();
    },
  });

  const contratos = data?.contratos || [];
  const filtered = contratos.filter(c => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !(c.leadNome?.toLowerCase().includes(q)) &&
        !(c.leadEmpresa?.toLowerCase().includes(q)) &&
        !(c.tipo?.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  const ativos = contratos.filter(c => c.status === "ativo");
  const mrrTotal = ativos.reduce((sum, c) => sum + (parseFloat(c.mrr || "0") || 0), 0);
  const setupTotal = ativos.reduce((sum, c) => sum + (parseFloat(c.valorSetup || "0") || 0), 0);
  const vencendoEm60d = ativos.filter(c => {
    if (!c.vencimento) return false;
    const diff = (new Date(c.vencimento).getTime() - Date.now()) / 86400000;
    return diff <= 60 && diff > 0;
  });

  return (
    <div className="page-scroll space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Contratos</h1>
        <p className="text-[12px] text-white/40">Contratos ativos geram receita recorrente (MRR). Acompanhe renovações e vencimentos.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1" title="Soma do MRR de todos os contratos ativos">Receita Recorrente</p>
          <p className="text-2xl font-bold text-[#e23752]">R$ {formatCurrency(mrrTotal)}</p>
          {setupTotal > 0 && <p className="text-[10px] text-white/30 mt-0.5">Setup: R$ {formatCurrency(setupTotal)}</p>}
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1">Contratos Ativos</p>
          <p className="text-2xl font-bold text-white">{ativos.length}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1">Total</p>
          <p className="text-2xl font-bold text-white">{contratos.length}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <p className="text-xs text-white/40 mb-1" title="Contratos com vencimento nos próximos 60 dias">Renovação Próxima</p>
          <p className="text-2xl font-bold text-amber-400">{vencendoEm60d.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente..."
            className="dark-input w-full pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="dark-input">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
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
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">MRR</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">Setup</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">Serviços</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">Início</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const sc = STATUS_CONFIG[c.status] || STATUS_FALLBACK[c.status] || STATUS_CONFIG.ativo;
                const mrr = parseFloat(c.mrr || "0");
                const setup = parseFloat(c.valorSetup || "0");
                const daysUntilExpiry = c.vencimento
                  ? Math.ceil((new Date(c.vencimento).getTime() - Date.now()) / 86400000)
                  : null;
                const isExpiring = daysUntilExpiry !== null && daysUntilExpiry <= 60 && daysUntilExpiry > 0 && c.status === "ativo";

                return (
                  <tr key={c.id}
                    onClick={() => setDrawerContratoId(c.id)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white text-sm">{c.leadEmpresa || c.leadNome || "—"}</p>
                      {c.leadNome && c.leadEmpresa && <p className="text-xs text-white/40 mt-0.5">{c.leadNome}</p>}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs capitalize">{c.tipo?.replace(/_/g, " ") || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: sc.color + "20", color: sc.color }}>
                        {sc.label}
                      </span>

                    </td>
                    <td className="px-4 py-3 text-right">
                      {mrr > 0 ? (
                        <span className="font-medium text-[#e23752] text-sm">R$ {formatCurrency(mrr)}</span>
                      ) : (
                        <span className="text-white/30 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      {setup > 0 ? (
                        <span className="text-white/70 text-xs">R$ {formatCurrency(setup)}</span>
                      ) : (
                        <span className="text-white/30 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.servicos?.slice(0, 3).map(s => (
                          <span key={s} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] font-medium">{s}</span>
                        ))}
                        {(c.servicos?.length || 0) > 3 && (
                          <span className="text-[10px] text-white/30">+{(c.servicos?.length || 0) - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40 hidden lg:table-cell">
                      {c.inicio ? new Date(c.inicio + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className={`px-4 py-3 text-xs hidden lg:table-cell ${isExpiring ? "text-amber-400 font-medium" : "text-white/40"}`}>
                      {c.vencimento ? (
                        <>
                          {new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                          {isExpiring && daysUntilExpiry !== null && (
                            <span className="ml-1 text-[10px]">({daysUntilExpiry}d)</span>
                          )}
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-white/30">
                    Nenhum contrato encontrado
                    <p className="text-[10px] text-white/25 mt-1">Contratos são gerados a partir de propostas aceitas, ou criados manualmente.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawers */}
      <ContratoDrawer
        contratoId={drawerContratoId}
        open={!!drawerContratoId}
        onClose={() => setDrawerContratoId(null)}
        onOpenLead={(id) => { setDrawerContratoId(null); setDrawerLeadId(id); }}
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
