"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Wallet, AlertTriangle, TrendingDown, FileCheck2 } from "lucide-react";
import { LeadDrawer } from "@/components/crm/LeadDrawer";

/**
 * FINANCEIRO — Vendas + Inadimplência (inspirado no CRM KOKO, decisão Scott 12/jun).
 * AI alimentado automático pelo Stripe sync; PABX pela carga mensal da Wevy.
 */

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtData = (v: unknown) => (v ? new Date(v as string).toLocaleDateString("pt-BR") : "—");

const STATUS_CLIENTE: Record<string, { label: string; cls: string }> = {
  em_dia: { label: "Em dia", cls: "bg-emerald-500/15 text-emerald-400" },
  atrasado: { label: "Atrasado", cls: "bg-red-500/15 text-red-400" },
  desistente: { label: "Desistente", cls: "bg-white/10 text-white/40" },
  pendencia_antiga: { label: "Pendência antiga", cls: "bg-amber-500/15 text-amber-400" },
  em_aberto: { label: "Em aberto", cls: "bg-[#8e27ef]/15 text-[#a855f7]" },
  pago: { label: "Pago (mês)", cls: "bg-emerald-500/15 text-emerald-400" },
  a_faturar: { label: "A faturar", cls: "bg-sky-500/15 text-sky-400" },
  completa: { label: "Completa", cls: "bg-emerald-500/15 text-emerald-400" },
  parcial: { label: "Parcial", cls: "bg-amber-500/15 text-amber-400" },
};

const STATUS_FATURA: Record<string, { label: string; cls: string }> = {
  paga: { label: "Paga", cls: "bg-emerald-500/15 text-emerald-400" },
  aberta: { label: "Em aberto", cls: "bg-red-500/15 text-red-400" },
  emitida: { label: "Emitida (Wevy)", cls: "bg-[#8e27ef]/15 text-[#a855f7]" },
  uncollectible: { label: "Incobrável", cls: "bg-red-500/25 text-red-300" },
  void: { label: "Cancelada", cls: "bg-white/10 text-white/40" },
};

function ProdutoBadge({ produto }: { produto: string | null }) {
  const ps = (produto || "").split(",").filter(Boolean);
  return (
    <span className="flex gap-1">
      {ps.map((p) => (
        <span
          key={p}
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
            p === "pabx" ? "bg-[#8e27ef]/15 text-[#a855f7]" : "bg-[#e23752]/15 text-[#e23752]"
          }`}
        >
          {p === "pabx" ? "PABX" : "AI"}
        </span>
      ))}
    </span>
  );
}

export default function FinanceiroPage() {
  // Fluxos separados (decisao Scott 12/jun): Callface AI = Stripe automatico
  // (receita prevista x recebido x falhas); Inadimplencia = regua do PABX/Wevy.
  const [tab, setTab] = useState<"ai" | "pabx" | "vendas">("ai");
  const visao = "fatura"; // extrato de faturas (visão "por cliente" removida — redundante com as tabs AI/PABX)
  const [busca, setBusca] = useState("");
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const produto = tab === "vendas" ? "todos" : tab;

  const { data: inad, isLoading: loadingInad } = useQuery({
    queryKey: ["financeiro-inadimplencia", produto],
    queryFn: () => fetch(`/api/financeiro/inadimplencia?produto=${produto}`).then((r) => r.json()),
    enabled: tab !== "vendas",
  });

  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ["financeiro-vendas", produto, visao, busca],
    queryFn: () =>
      fetch(`/api/financeiro/vendas?produto=${produto}&visao=${visao}&q=${encodeURIComponent(busca)}`).then((r) => r.json()),
    enabled: tab === "vendas",
  });

  const filtroLocal = (rows: Record<string, unknown>[]) => {
    if (!busca.trim()) return rows;
    const q = busca.toLowerCase();
    return rows.filter((r) =>
      [r.nome, r.email, r.empresa, r.contrato].some((s) => String(s || "").toLowerCase().includes(q))
    );
  };

  const k = inad?.kpis;

  return (
    <div className="page-scroll space-y-4 p-4 lg:p-6" style={{ animation: "fadeUp 0.3s ease-out both" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#e23752]" />
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
              Financeiro
            </h1>
            <p className="text-[12px] text-white/40 hidden sm:block">
              Vendas e inadimplência — AI sincroniza via Stripe; PABX entra com a planilha mensal da Wevy.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, email ou empresa..."
              className="pl-9 pr-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/50 w-56"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {([["ai", "Callface AI"], ["vendas", "Faturas"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? `bg-white/[0.06] text-white border-b-2 ${key === "pabx" ? "border-[#8e27ef]" : "border-[#e23752]"}`
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══ CALLFACE AI (Stripe) / INADIMPLÊNCIA PABX (Wevy) ═══ */}
      {tab !== "vendas" && (
        <>
          <div className={`grid grid-cols-2 gap-3 ${tab === "ai" ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            {tab === "ai" ? (
              <>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><FileCheck2 className="w-3.5 h-3.5 text-[#e23752]" />Receita Prevista (mês)</div>
                  <p className="text-2xl font-bold text-white mt-2">{loadingInad ? "..." : fmt(k?.receitaPrevista)}</p>
                  <p className="text-[10px] text-white/25 mt-1">{k?.contratosAtivos ?? "—"} assinaturas ativas</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><Wallet className="w-3.5 h-3.5 text-[#c8ff00]" />Recebido no Mês</div>
                  <p className="text-2xl font-bold text-[#c8ff00] mt-2">{loadingInad ? "..." : fmt(k?.recebidoMes)}</p>
                  <p className="text-[10px] text-white/25 mt-1">faturas pagas via Stripe</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><FileCheck2 className="w-3.5 h-3.5 text-sky-400" />A Receber (mês)</div>
                  <p className="text-2xl font-bold text-sky-400 mt-2">{loadingInad ? "..." : fmt(Math.max(0, (k?.receitaPrevista || 0) - (k?.recebidoMes || 0) - (k?.valorEmAtraso || 0)))}</p>
                  <p className="text-[10px] text-white/25 mt-1">cobranças que ainda vencem este mês</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><AlertTriangle className="w-3.5 h-3.5 text-red-400" />Em Atraso</div>
                  <p className="text-2xl font-bold text-red-400 mt-2">{loadingInad ? "..." : fmt(k?.valorEmAtraso)}</p>
                  <p className="text-[10px] text-white/25 mt-1">{k?.clientesEmAtraso ?? 0} clientes · histórico: {fmt(k?.naoCobradoHistorico)}</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><TrendingDown className="w-3.5 h-3.5 text-red-400" />Cancelamentos no Mês</div>
                  <p className="text-2xl font-bold text-white mt-2">{loadingInad ? "..." : k?.churnsMes}</p>
                  <p className="text-[10px] text-white/25 mt-1">assinaturas canceladas</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><FileCheck2 className="w-3.5 h-3.5 text-[#a855f7]" />Contratos Ativos</div>
                  <p className="text-2xl font-bold text-white mt-2">{loadingInad ? "..." : k?.contratosAtivos}</p>
                  <p className="text-[10px] text-white/25 mt-1">{k?.contratosTotal ?? "—"} no total</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><Wallet className="w-3.5 h-3.5 text-[#a855f7]" />Receita Prevista (mês)</div>
                  <p className="text-2xl font-bold text-white mt-2">{loadingInad ? "..." : fmt(k?.receitaPrevista)}</p>
                  <p className="text-[10px] text-white/25 mt-1">soma das mensalidades ativas</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><AlertTriangle className="w-3.5 h-3.5 text-[#a855f7]" />Em Aberto (Wevy)</div>
                  <p className="text-2xl font-bold text-[#a855f7] mt-2">{loadingInad ? "..." : fmt(k?.emAbertoWevy)}</p>
                  <p className="text-[10px] text-white/25 mt-1">faturado aguardando confirmação de pagamento</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 text-[11px] text-white/40 uppercase tracking-wider"><TrendingDown className="w-3.5 h-3.5 text-red-400" />Cancelamentos no Mês</div>
                  <p className="text-2xl font-bold text-white mt-2">{loadingInad ? "..." : k?.churnsMes}</p>
                  <p className="text-[10px] text-white/25 mt-1">contratos churned</p>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-white/35 uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Contrato / Produto</th>
                  <th className="px-4 py-3 font-medium text-right">Mensalidade</th>
                  <th className="px-4 py-3 font-medium text-right">Total Pago</th>
                  <th className="px-4 py-3 font-medium text-center">{tab === "ai" ? "Últ. Pagamento" : "Faturas"}</th>
                  <th className="px-4 py-3 font-medium text-right">Em Atraso</th>
                  <th className="px-4 py-3 font-medium text-right">Não Cobrado</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Última Ativ.</th>
                </tr>
              </thead>
              <tbody>
                {loadingInad && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-white/25">Carregando...</td></tr>
                )}
                {filtroLocal(inad?.contratos || []).map((c: Record<string, unknown>) => {
                  const st = STATUS_CLIENTE[c.status as string] || STATUS_CLIENTE.em_dia;
                  return (
                    <tr
                      key={c.contratoId as string}
                      onClick={() => setDrawerLeadId(c.leadId as string)}
                      className="border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-white/90">{(c.empresa || c.nome) as string}</p>
                        <p className="text-[10px] text-white/30">{(c.email || c.nome) as string}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <ProdutoBadge produto={c.produto as string} />
                          <span className="text-[11px] text-white/50 truncate max-w-[220px]">{c.contrato as string}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-white/90 font-medium">{Number(c.valor) > 0 ? fmt(c.valor as number) : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-xs font-medium" style={{ color: "#c8ff00" }}>{Number(c.totalPago) > 0 ? fmt(c.totalPago as number) : "—"}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-white/70">
                        {tab === "ai" ? fmtData(c.ultimoPagamento) : `${c.faturasFeitas}/${c.faturasTotal}`}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs ${Number(c.emAtraso) > 0 ? "text-red-400 font-semibold" : "text-white/30"}`}>{Number(c.emAtraso) > 0 ? fmt(c.emAtraso as number) : "—"}</td>
                      <td className={`px-4 py-2.5 text-right text-xs ${Number(c.naoCobrado) > 0 ? "text-amber-400/80" : "text-white/30"}`}>{Number(c.naoCobrado) > 0 ? fmt(c.naoCobrado as number) : "—"}</td>
                      <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span></td>
                      <td className="px-4 py-2.5 text-[11px] text-white/40">{fmtData(c.ultimaAtividade)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══ VENDAS ═══ */}
      {tab === "vendas" && (
        <>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-white/35 uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  {visao === "cliente" ? (
                    <>
                      <th className="px-4 py-3 font-medium text-right">Valor Total</th>
                      <th className="px-4 py-3 font-medium text-center">Faturas</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Última Fatura</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 font-medium text-right">Valor</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Competência</th>
                      <th className="px-4 py-3 font-medium">Pagamento</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {loadingVendas && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-white/25">Carregando...</td></tr>
                )}
                {(vendas?.rows || []).map((r: Record<string, unknown>, idx: number) => {
                  const st = visao === "cliente"
                    ? STATUS_CLIENTE[r.status as string] || STATUS_CLIENTE.parcial
                    : STATUS_FATURA[r.status as string] || { label: r.status as string, cls: "bg-white/10 text-white/40" };
                  return (
                    <tr
                      key={(r.id as string) || `${r.lead_id}-${idx}`}
                      onClick={() => setDrawerLeadId(r.lead_id as string)}
                      className="border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-white/90">{(r.empresa || r.nome) as string}</p>
                        <p className="text-[10px] text-white/30">{(r.email || "") as string}</p>
                      </td>
                      <td className="px-4 py-2.5"><ProdutoBadge produto={r.produto as string} /></td>
                      {visao === "cliente" ? (
                        <>
                          <td className="px-4 py-2.5 text-right text-xs text-white/90 font-medium">{fmt(r.valor_total as number)}</td>
                          <td className="px-4 py-2.5 text-center text-xs text-white/70">{r.pagas as number}/{r.emitidas as number}</td>
                          <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span></td>
                          <td className="px-4 py-2.5 text-[11px] text-white/40">{fmtData(r.ultima_fatura)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 text-right text-xs text-white/90 font-medium">{fmt(r.valor as number)}</td>
                          <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span></td>
                          <td className="px-4 py-2.5 text-[11px] text-white/40">{fmtData(r.competencia)}</td>
                          <td className="px-4 py-2.5 text-[11px] text-white/40">{fmtData(r.paga_em)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <LeadDrawer leadId={drawerLeadId} open={!!drawerLeadId} onClose={() => setDrawerLeadId(null)} />
    </div>
  );
}
