"use client";

import { useQuery } from "@tanstack/react-query";
import { Stat } from "../../relatorios/components/kit";
import { fmt, fmtData, ProdutoBadge } from "./fin";

/**
 * Clientes & Assinaturas (F13) — evolução da antiga aba "Callface AI".
 * As dimensões que antes viviam num enum só agora são COLUNAS separadas:
 * mensalidade × total pago (LTV realizado) × último pagamento × em atraso × dias.
 */
export function TabClientes({ busca, onOpenLead, produto = "ai" }: { busca: string; onOpenLead: (leadId: string) => void; produto?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fin-inadimplencia", produto],
    queryFn: () => fetch(`/api/financeiro/inadimplencia?produto=${produto}`).then((r) => r.json()),
  });

  const k = data?.kpis;
  const rows = (data?.contratos || []).filter((c: Record<string, unknown>) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return [c.nome, c.email, c.empresa, c.contrato].some((s) => String(s || "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Assinaturas ativas" value={isLoading ? "..." : k?.contratosAtivos ?? 0} sub={`${k?.contratosTotal ?? "—"} no total`} />
        <Stat label="Receita prevista (mês)" value={isLoading ? "..." : fmt(k?.receitaPrevista)} cor="dinheiro" />
        <Stat label="Recebido no mês" value={isLoading ? "..." : fmt(k?.recebidoMes)} cor="ganho" />
        <Stat label="Em atraso" value={isLoading ? "..." : fmt(k?.valorEmAtraso)} sub={`${k?.clientesEmAtraso ?? 0} clientes · histórico ${fmt(k?.naoCobradoHistorico)}`} cor="critico" />
        <Stat label="Cancelamentos no mês" value={isLoading ? "..." : k?.churnsMes ?? 0} cor="atencao" />
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] text-white/35 uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Contrato / Produto</th>
              <th className="px-4 py-3 font-medium text-right">Mensalidade</th>
              <th className="px-4 py-3 font-medium text-right">Total pago (LTV)</th>
              <th className="px-4 py-3 font-medium text-center">Últ. pagamento</th>
              <th className="px-4 py-3 font-medium text-right">Em atraso</th>
              <th className="px-4 py-3 font-medium text-right">Dias</th>
              <th className="px-4 py-3 font-medium text-right">Pendência antiga</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-white/25">Carregando...</td></tr>
            )}
            {rows.map((c: Record<string, unknown>) => (
              <tr
                key={c.contratoId as string}
                onClick={() => onOpenLead(c.leadId as string)}
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
                <td className="px-4 py-2.5 text-right text-xs text-white/90 font-medium tabular-nums">{Number(c.valor) > 0 ? fmt(c.valor as number) : "—"}</td>
                <td className="px-4 py-2.5 text-right text-xs font-medium tabular-nums" style={{ color: "#c8ff00" }}>{Number(c.totalPago) > 0 ? fmt(c.totalPago as number) : "—"}</td>
                <td className="px-4 py-2.5 text-center text-xs text-white/70">{fmtData(c.ultimoPagamento)}</td>
                <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${Number(c.emAtraso) > 0 ? "text-red-400 font-semibold" : "text-white/30"}`}>{Number(c.emAtraso) > 0 ? fmt(c.emAtraso as number) : "—"}</td>
                <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${Number(c.diasAtraso) > 30 ? "text-red-400" : Number(c.diasAtraso) > 0 ? "text-amber-400" : "text-white/30"}`}>{Number(c.diasAtraso) > 0 ? c.diasAtraso as number : "—"}</td>
                <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${Number(c.naoCobrado) > 0 ? "text-amber-400/80" : "text-white/30"}`}>{Number(c.naoCobrado) > 0 ? fmt(c.naoCobrado as number) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
