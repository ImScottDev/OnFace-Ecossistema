"use client";

import { useQuery } from "@tanstack/react-query";
import { HeroBand, Stat, Secao } from "../../relatorios/components/kit";
import { fmt, fmtData } from "./fin";

const CATEGORIA: Record<string, { label: string; cls: string }> = {
  involuntario: { label: "Cartão recusado", cls: "bg-red-500/15 text-red-400" },
  voluntario: { label: "Cliente cancelou", cls: "bg-amber-500/15 text-amber-400" },
  sem_motivo: { label: "Sem motivo", cls: "bg-white/10 text-white/40" },
};

/**
 * Churn & Cancelamentos (F14): quem cancelou, motivo, MRR perdido,
 * voluntário × involuntário, tendência mês a mês. Involuntário = problema de
 * COBRANÇA (dunning); voluntário = problema de PRODUTO/valor. Decisões diferentes.
 */
export function TabChurn({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fin-churn"],
    queryFn: () => fetch("/api/financeiro/churn?meses=6").then((r) => r.json()),
  });

  if (isLoading || !data) {
    return <p className="text-xs text-white/25 py-10 text-center">Carregando churn...</p>;
  }

  const mesAtual = new Date().toISOString().slice(0, 7);
  const doMes = data.tendencia.find((t: { mes: string }) => t.mes === mesAtual) || { logos: 0, mrr: 0, voluntarios: 0, involuntarios: 0, semMotivo: 0 };
  const maxMes = Math.max(...data.tendencia.map((t: { logos: number }) => t.logos), 1);

  return (
    <div className="space-y-4">
      <HeroBand label="MRR perdido no mês" value={fmt(doMes.mrr)} cor="critico" sub={`${doMes.logos} assinaturas canceladas em ${mesAtual}`}>
        <Stat label="Involuntário (cartão)" value={doMes.involuntarios} sub="recuperável com dunning/retry" cor="critico" />
        <Stat label="Voluntário" value={doMes.voluntarios} sub="cliente pediu — conversa de produto" cor="atencao" />
        <Stat label="Sem motivo registrado" value={doMes.semMotivo} sub="cancelamentos antigos, pré-captura" />
        <Stat label="Total 6 meses" value={data.tendencia.reduce((a: number, t: { logos: number }) => a + t.logos, 0)} sub={fmt(data.tendencia.reduce((a: number, t: { mrr: number }) => a + t.mrr, 0)) + " de MRR"} />
      </HeroBand>

      <Secao cor="critico" hint="cancelamentos por mês — vermelho = cartão recusado, âmbar = voluntário">Tendência mensal</Secao>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
        <div className="flex items-end gap-3 h-36">
          {data.tendencia.map((t: { mes: string; logos: number; mrr: number; voluntarios: number; involuntarios: number; semMotivo: number }) => (
            <div key={t.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] text-white/60 tabular-nums">{t.logos}</span>
              <div className="w-full max-w-14 flex flex-col justify-end" style={{ height: "96px" }}>
                <div style={{ height: `${(t.involuntarios / maxMes) * 96}px`, background: "#EF4444cc" }} className="w-full rounded-t-sm" />
                <div style={{ height: `${(t.voluntarios / maxMes) * 96}px`, background: "#F59E0Bcc" }} className="w-full" />
                <div style={{ height: `${(t.semMotivo / maxMes) * 96}px`, background: "rgba(255,255,255,0.15)" }} className="w-full rounded-b-sm" />
              </div>
              <span className="text-[9px] text-white/30">{t.mes.slice(5)}/{t.mes.slice(2, 4)}</span>
              <span className="text-[9px] text-white/40 tabular-nums">{fmt(t.mrr)}</span>
            </div>
          ))}
        </div>
      </div>

      <Secao cor="atencao" hint="motivo vem do Stripe (cancellation_details) — captura ligada em 21/07">Cancelamentos</Secao>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] text-white/35 uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium text-right">MRR perdido</th>
              <th className="px-4 py-3 font-medium text-center">Cancelou em</th>
              <th className="px-4 py-3 font-medium text-right">Vida (meses)</th>
              <th className="px-4 py-3 font-medium text-right">Total pago</th>
              <th className="px-4 py-3 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {data.lista.map((r: { id: string; leadId: string | null; nome: string | null; empresa: string | null; plano: string; mrr: number; canceladaEm: string; mesesDeVida: number; totalPago: number; motivo: string | null; categoria: string }) => {
              const cat = CATEGORIA[r.categoria] || CATEGORIA.sem_motivo;
              return (
                <tr
                  key={r.id}
                  onClick={() => r.leadId && onOpenLead(r.leadId)}
                  className={`border-b border-white/[0.03] transition-colors ${r.leadId ? "hover:bg-white/[0.03] cursor-pointer" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <p className="text-xs text-white/90">{r.empresa || r.nome || "cliente sem lead"}</p>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-white/50 truncate max-w-[160px]">{r.plano}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-red-400 font-medium tabular-nums">{fmt(r.mrr)}</td>
                  <td className="px-4 py-2.5 text-center text-xs text-white/60">{fmtData(r.canceladaEm)}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-white/60 tabular-nums">{r.mesesDeVida.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums" style={{ color: "#c8ff00" }}>{fmt(r.totalPago)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.cls}`} title={r.motivo || undefined}>{cat.label}</span>
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
