"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, Users, UserX, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { ContratoDrawer } from "@/components/crm/ContratoDrawer";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";

interface CarteiraClient {
  contratoId: string;
  negocioId: string | null;
  tipo: string;
  descricao: string | null;
  mrr: string | null;
  valorSetup: string | null;
  servicos: string[] | null;
  inicio: string | null;
  vencimento: string | null;
  renovacaoAuto: boolean;
  status: string;
  motivoChurn: string | null;
  finalizadoAt: string | null;
  createdAt: string;
  leadId: string;
  leadNome: string | null;
  leadEmpresa: string | null;
  responsavelNome: string | null;
}

interface CarteiraData {
  clients: CarteiraClient[];
  totals: {
    totalClients: number;
    totalMrr: number;
    avgTicket: number;
    totalContratos: number;
    exClientes: number;
  };
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Status do contrato (decisão Scott #10): só 3 estados visíveis — Ativo / Encerrado /
// Cancelado. Renovação automática NÃO é status, vira badge à parte.
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "#10B981" },
  encerrado: { label: "Encerrado", color: "#6B7280" },
  concluido: { label: "Encerrado", color: "#6B7280" },
  churned: { label: "Encerrado", color: "#6B7280" },
  pausado: { label: "Encerrado", color: "#6B7280" },
  cancelado: { label: "Cancelado", color: "#EF4444" },
};
const ENCERRADO_BADGE = { label: "Encerrado", color: "#6B7280" };

export default function CarteiraPage() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"ativos" | "ex">("ativos");
  const [drawerContratoId, setDrawerContratoId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<CarteiraData>({
    queryKey: ["carteira", viewMode],
    queryFn: async () => {
      const params = viewMode === "ex" ? "?ex=true" : "";
      const res = await fetch(`/api/carteira${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const clients = data?.clients ?? [];
  const totals = data?.totals ?? { totalClients: 0, totalMrr: 0, avgTicket: 0, totalContratos: 0, exClientes: 0 };

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      c =>
        (c.leadEmpresa && c.leadEmpresa.toLowerCase().includes(q)) ||
        (c.leadNome && c.leadNome.toLowerCase().includes(q)) ||
        (c.tipo && c.tipo.toLowerCase().includes(q)) ||
        (c.responsavelNome && c.responsavelNome.toLowerCase().includes(q))
    );
  }, [clients, search]);

  return (
    <div className="page-scroll space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Carteira</h1>
        <p className="text-sm text-white/40 mt-1">
          {viewMode === "ativos"
            ? "Contratos ativos na base. Acompanhe MRR, vencimentos e serviços."
            : "Clientes que tiveram contratos finalizados ou churned. Disponíveis para reativação."}
        </p>
      </div>

      {/* Stats */}
      {viewMode === "ativos" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/40 mb-1">Clientes Ativos</p>
            <p className="text-2xl font-bold text-white">{totals.totalClients}</p>
            <p className="text-[10px] text-white/25 mt-0.5">{totals.totalContratos} contrato{totals.totalContratos !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/40 mb-1">MRR Total</p>
            <p className="text-2xl font-bold text-[#e23752]">{formatBRL(totals.totalMrr)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/40 mb-1">Ticket Médio</p>
            <p className="text-2xl font-bold text-[#c8ff00]">{formatBRL(totals.avgTicket)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/40 mb-1">Ex-Clientes</p>
            <p className="text-2xl font-bold text-white/50">{totals.exClientes}</p>
          </div>
        </div>
      )}

      {/* Toggle + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => setViewMode("ativos")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: viewMode === "ativos" ? "rgba(16,185,129,0.15)" : "transparent",
              color: viewMode === "ativos" ? "#10B981" : "rgba(255,255,255,0.4)",
            }}
          >
            <Users className="w-3.5 h-3.5" /> Ativos
          </button>
          <button
            onClick={() => setViewMode("ex")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: viewMode === "ex" ? "rgba(239,68,68,0.15)" : "transparent",
              color: viewMode === "ex" ? "#EF4444" : "rgba(255,255,255,0.4)",
            }}
          >
            <UserX className="w-3.5 h-3.5" /> Ex-Clientes
            {totals.exClientes > 0 && (
              <span className="text-[9px] px-1 rounded bg-red-500/20 text-red-400">{totals.exClientes}</span>
            )}
          </button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, tipo, responsável..."
            className="dark-input w-full pl-9" />
        </div>
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
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden md:table-cell">Serviços</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">Responsável</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider hidden lg:table-cell">
                  {viewMode === "ativos" ? "Vencimento" : "Finalizado"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const mrr = parseFloat(c.mrr || "0") || 0;
                const badge = STATUS_BADGE[c.status] || ENCERRADO_BADGE;
                const daysUntilExpiry = c.vencimento
                  ? Math.ceil((new Date(c.vencimento).getTime() - Date.now()) / 86400000)
                  : null;
                const isExpiring = daysUntilExpiry !== null && daysUntilExpiry <= 60 && daysUntilExpiry > 0 && c.status === "ativo";

                return (
                  <tr key={c.contratoId || `row-${idx}`}
                    onClick={() => setDrawerContratoId(c.contratoId)}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white text-sm">{c.leadEmpresa || c.leadNome || "—"}</p>
                      {c.leadNome && c.leadEmpresa && <p className="text-xs text-white/40 mt-0.5">{c.leadNome}</p>}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs capitalize">{c.tipo?.replace(/_/g, " ") || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: badge.color + "20", color: badge.color }}>
                        {badge.label}
                      </span>
                      {c.renovacaoAuto && c.status === "ativo" && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400" title="Renovação automática">
                          <RefreshCw className="w-2.5 h-2.5" /> Renova
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {mrr > 0 ? (
                        <span className="font-medium text-[#e23752] text-sm">{formatBRL(mrr)}</span>
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
                    <td className="px-4 py-3 text-xs text-white/60 hidden lg:table-cell">
                      {c.responsavelNome || <span className="text-white/20">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-xs hidden lg:table-cell ${isExpiring ? "text-amber-400 font-medium" : "text-white/40"}`}>
                      {viewMode === "ativos" ? (
                        c.vencimento ? (
                          <>
                            {new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                            {isExpiring && daysUntilExpiry !== null && (
                              <span className="ml-1 text-[10px]">({daysUntilExpiry}d)</span>
                            )}
                          </>
                        ) : "Indeterminado"
                      ) : (
                        c.finalizadoAt ? (
                          <div>
                            <p>{new Date(c.finalizadoAt).toLocaleDateString("pt-BR")}</p>
                            {c.motivoChurn && <p className="text-[10px] text-red-400/60 mt-0.5 truncate max-w-[120px]" title={c.motivoChurn}>{c.motivoChurn}</p>}
                          </div>
                        ) : "—"
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-white/30">
                    {clients.length === 0 ? (
                      viewMode === "ativos" ? (
                        <>Nenhum contrato ativo<p className="text-[10px] text-white/25 mt-1">Contratos são criados automaticamente quando um negócio é marcado como ganho.</p></>
                      ) : (
                        <>Nenhum ex-cliente<p className="text-[10px] text-white/25 mt-1">Clientes que tiveram contratos finalizados ou churned aparecem aqui.</p></>
                      )
                    ) : "Nenhum resultado encontrado"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {!isLoading && filtered.length > 0 && viewMode === "ativos" && (
        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-white/30">
          <span>Exibindo {filtered.length} contrato{filtered.length !== 1 ? "s" : ""}</span>
          <span>
            MRR filtrado: <strong className="text-[#e23752]/70">
              {formatBRL(filtered.reduce((s, c) => s + (parseFloat(c.mrr || "0") || 0), 0))}
            </strong>
          </span>
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
