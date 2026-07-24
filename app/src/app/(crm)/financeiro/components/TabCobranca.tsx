"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HeroBand, Stat, Secao, BarraLinha } from "../../relatorios/components/kit";
import { fmt, fmtPct } from "./fin";

/**
 * Cobrança & Inadimplência (F12): aging em faixas, fila de ação (quem cobrar
 * primeiro), taxa de recuperação, clientes em risco. Atraso ≤30d = janela boa
 * de recuperação; 60+ é quase perda — a fila prioriza o recuperável.
 */
export function TabCobranca({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["fin-cobranca"],
    queryFn: () => fetch("/api/financeiro/cobranca").then((r) => r.json()),
  });

  if (isLoading || !data) {
    return <p className="text-xs text-white/25 py-10 text-center">Carregando cobrança...</p>;
  }

  const aging = data.aging;
  const rec = data.recuperacao;
  const recuperavel = aging.faixas[0].valor + aging.faixas[1].valor;
  const quaseP = aging.faixas[2].valor + aging.faixas[3].valor;
  const maxFaixa = Math.max(...aging.faixas.map((f: { valor: number }) => f.valor), 1);

  const copiarLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(id);
      setTimeout(() => setCopiado(null), 1500);
    });
  };

  return (
    <div className="space-y-4">
      <HeroBand label="Total em aberto" value={fmt(aging.total)} cor="critico" sub={`${aging.faixas.reduce((a: number, f: { count: number }) => a + f.count, 0)} faturas abertas ou incobráveis`}>
        <Stat label="Recuperável (≤30 dias)" value={fmt(recuperavel)} sub="janela boa — agir agora" cor="atencao" />
        <Stat label="Crítico (31+ dias)" value={fmt(quaseP)} sub="recuperabilidade baixa" cor="critico" />
        <Stat label="Recuperação no mês" value={fmtPct(rec.taxaPct)} sub={`${rec.recuperadas}/${rec.falhadas} faturas que falharam foram pagas`} cor={rec.taxaPct >= 50 ? "ganho" : "atencao"} />
        <Stat label="Valor recuperado" value={fmt(rec.valorRecuperado)} sub="pago após retry no mês" cor="ganho" />
      </HeroBand>

      <Secao cor="critico" hint="dias desde o vencimento (Stripe due_date; sem due_date, emissão)">Aging da inadimplência</Secao>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-1">
        {aging.faixas.map((f: { faixa: string; count: number; valor: number }) => (
          <BarraLinha
            key={f.faixa}
            label={`${f.faixa} dias`}
            valor={f.valor}
            max={maxFaixa}
            direita={fmt(f.valor)}
            extra={`${f.count}`}
            cor={f.faixa === "0-15" ? "atencao" : f.faixa === "16-30" ? "atencao" : "critico"}
          />
        ))}
      </div>

      <Secao cor="atencao" hint="ordenada por recuperabilidade: atraso recente com valor alto primeiro">Fila de cobrança</Secao>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] text-white/35 uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium text-right">Valor</th>
              <th className="px-4 py-3 font-medium text-right">Dias em atraso</th>
              <th className="px-4 py-3 font-medium text-right">Tentativas</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.fila.map((f: { faturaId: string; leadId: string; nome: string | null; empresa: string | null; valor: number; diasAtraso: number; tentativas: number; temRetryAgendado: boolean; hostedInvoiceUrl: string | null; status: string }) => (
              <tr key={f.faturaId} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-2.5 cursor-pointer" onClick={() => onOpenLead(f.leadId)}>
                  <p className="text-xs text-white/90">{f.empresa || f.nome}</p>
                </td>
                <td className="px-4 py-2.5 text-right text-xs font-semibold text-red-400 tabular-nums">{fmt(f.valor)}</td>
                <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${f.diasAtraso > 30 ? "text-red-400" : "text-amber-400"}`}>{f.diasAtraso}</td>
                <td className="px-4 py-2.5 text-right text-xs text-white/50 tabular-nums">{f.tentativas}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${f.status === "uncollectible" ? "bg-red-500/25 text-red-300" : f.temRetryAgendado ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-400"}`}>
                    {f.status === "uncollectible" ? "Incobrável" : f.temRetryAgendado ? "Stripe retentando" : "Régua esgotada — cobrar manual"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {f.hostedInvoiceUrl ? (
                    <button
                      onClick={() => copiarLink(f.hostedInvoiceUrl!, f.faturaId)}
                      className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.1] transition-colors"
                    >
                      {copiado === f.faturaId ? "Copiado" : "Copiar link de pagamento"}
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/20">sem link</span>
                  )}
                </td>
              </tr>
            ))}
            {data.fila.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-white/25">Nenhuma fatura em aberto.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Secao cor="atencao" hint="past_due no Stripe ou atraso recorrente em 90 dias">Clientes em risco</Secao>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        {data.risco.length === 0 && <p className="text-[11px] text-white/25 p-4">Nenhum cliente em risco no momento.</p>}
        {data.risco.map((r: { leadId: string; nome: string | null; empresa: string | null; mrr: number; motivos: string[] }) => (
          <div key={r.leadId} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors" onClick={() => onOpenLead(r.leadId)}>
            <div className="min-w-0">
              <p className="text-xs text-white/90 truncate">{r.empresa || r.nome}</p>
              <p className="text-[10px] text-amber-400/80">{r.motivos.join(" · ")}</p>
            </div>
            <span className="text-xs tabular-nums text-white/70 shrink-0">{fmt(r.mrr)}/mês</span>
          </div>
        ))}
      </div>
    </div>
  );
}
