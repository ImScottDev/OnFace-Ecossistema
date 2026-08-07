"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ListTodo } from "lucide-react";
import { HeroBand, Stat, Secao, BarraLinha } from "../../relatorios/components/kit";
import { fmt, fmtPct } from "./fin";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";

/**
 * Cobrança & Inadimplência (F12): aging em faixas, fila de ação (quem cobrar
 * primeiro), taxa de recuperação, clientes em risco. Atraso ≤30d = janela boa
 * de recuperação; 60+ é quase perda — a fila prioriza o recuperável.
 */
export function TabCobranca({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [tarefaAlvo, setTarefaAlvo] = useState<{ leadId: string; label: string; titulo: string } | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["fin-cobranca"],
    queryFn: () => fetch("/api/financeiro/cobranca").then((r) => r.json()),
  });

  const toggleAcionado = useMutation({
    mutationFn: async ({ faturaId, acionado }: { faturaId: string; acionado: boolean }) => {
      const r = await fetch(`/api/financeiro/cobranca/${faturaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acionado }),
      });
      if (!r.ok) throw new Error("Falha ao atualizar acionamento");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fin-cobranca"] }),
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
              <th className="px-4 py-3 font-medium text-center w-10">Acionado</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium text-right">Valor</th>
              <th className="px-4 py-3 font-medium text-right">Dias em atraso</th>
              <th className="px-4 py-3 font-medium text-right">Tentativas</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.fila.map((f: { faturaId: string; leadId: string; nome: string | null; empresa: string | null; valor: number; diasAtraso: number; tentativas: number; temRetryAgendado: boolean; hostedInvoiceUrl: string | null; status: string; acionado: boolean; acionadoEm: string | null; acionadoPorNome: string | null }) => (
              <tr key={f.faturaId} className={`border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors ${f.acionado ? "opacity-50" : ""}`}>
                <td className="px-4 py-2.5 text-center" title={f.acionado && f.acionadoPorNome ? `Acionado por ${f.acionadoPorNome}` : "Marcar como já acionado"}>
                  <input
                    type="checkbox"
                    checked={f.acionado}
                    onChange={(e) => toggleAcionado.mutate({ faturaId: f.faturaId, acionado: e.target.checked })}
                    className="w-3.5 h-3.5 rounded accent-[#e23752] cursor-pointer"
                  />
                </td>
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
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() =>
                        setTarefaAlvo({
                          leadId: f.leadId,
                          label: f.empresa || f.nome || "Cliente",
                          titulo: `Cobrar ${f.empresa || f.nome} — ${fmt(f.valor)} vencido há ${f.diasAtraso}d`,
                        })
                      }
                      className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.1] transition-colors flex items-center gap-1"
                      title="Criar tarefa de cobrança"
                    >
                      <ListTodo size={10} /> Tarefa
                    </button>
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
                  </div>
                </td>
              </tr>
            ))}
            {data.fila.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-white/25">Nenhuma fatura em aberto.</td></tr>
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

      <TarefaFormModal
        open={!!tarefaAlvo}
        onClose={() => setTarefaAlvo(null)}
        defaultLeadId={tarefaAlvo?.leadId ?? null}
        defaultLeadLabel={tarefaAlvo?.label ?? null}
        defaultTitulo={tarefaAlvo?.titulo ?? ""}
        defaultTipo="follow_up"
        invalidateKeys={[["tarefas"], ["lead", tarefaAlvo?.leadId ?? null]]}
      />
    </div>
  );
}
