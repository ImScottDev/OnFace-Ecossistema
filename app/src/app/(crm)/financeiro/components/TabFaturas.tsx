"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fmt, fmtData, STATUS_FATURA, ProdutoBadge } from "./fin";

const FILTROS = [
  { key: "", label: "Todas" },
  { key: "paga", label: "Pagas" },
  { key: "aberta", label: "Em aberto" },
  { key: "uncollectible", label: "Incobráveis" },
  { key: "void", label: "Canceladas" },
] as const;

/**
 * Faturas (F15): lista bruta com filtro por status REAL do Stripe,
 * vencimento, dias em atraso e link da fatura hospedada.
 */
export function TabFaturas({ busca, onOpenLead }: { busca: string; onOpenLead: (leadId: string) => void }) {
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["fin-vendas", status, busca],
    queryFn: () =>
      fetch(`/api/financeiro/vendas?produto=todos&visao=fatura&status=${status}&q=${encodeURIComponent(busca)}`).then((r) => r.json()),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-colors ${
              status === f.key ? "bg-[#e23752]/20 text-[#e23752] border border-[#e23752]/40" : "bg-white/[0.05] text-white/50 border border-white/[0.06] hover:text-white/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] text-white/35 uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium text-right">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Competência</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Pagamento</th>
              <th className="px-4 py-3 font-medium text-right">Dias atraso</th>
              <th className="px-4 py-3 font-medium text-right">Fatura</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-white/25">Carregando...</td></tr>
            )}
            {(data?.rows || []).map((r: Record<string, unknown>, idx: number) => {
              const st = STATUS_FATURA[r.status as string] || { label: r.status as string, cls: "bg-white/10 text-white/40" };
              const dias = Number(r.dias_atraso) || 0;
              return (
                <tr
                  key={(r.id as string) || `${r.lead_id}-${idx}`}
                  onClick={() => onOpenLead(r.lead_id as string)}
                  className="border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <p className="text-xs text-white/90">{(r.empresa || r.nome) as string}</p>
                    <p className="text-[10px] text-white/30">{(r.email || "") as string}</p>
                  </td>
                  <td className="px-4 py-2.5"><ProdutoBadge produto={r.produto as string} /></td>
                  <td className="px-4 py-2.5 text-right text-xs text-white/90 font-medium tabular-nums">{fmt(r.valor as number)}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-2.5 text-[11px] text-white/40">{fmtData(r.competencia)}</td>
                  <td className="px-4 py-2.5 text-[11px] text-white/40">{fmtData(r.vencimento || r.emitida_em)}</td>
                  <td className="px-4 py-2.5 text-[11px] text-white/40">{fmtData(r.paga_em)}</td>
                  <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${dias > 30 ? "text-red-400" : dias > 0 ? "text-amber-400" : "text-white/25"}`}>{dias > 0 ? dias : "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.hosted_invoice_url ? (
                      <a
                        href={r.hosted_invoice_url as string}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.1] transition-colors"
                      >
                        Abrir
                      </a>
                    ) : (
                      <span className="text-[10px] text-white/20">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
