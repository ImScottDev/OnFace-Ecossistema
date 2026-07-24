"use client";

import { useQuery } from "@tanstack/react-query";
import { HeroBand, Stat, Secao, BarraLinha, DOMINIO } from "../../relatorios/components/kit";
import { fmt, fmtK, fmtPct } from "./fin";

/**
 * Visão Geral — o "bate o olho" da liderança (F11).
 * MRR com 5 componentes, ARR, NRR, churn logo/receita, LTV:CAC, forecast.
 * Receita SEMPRE segmentada AI × PABX.
 */
export function TabVisaoGeral() {
  const { data, isLoading } = useQuery({
    queryKey: ["fin-metricas"],
    queryFn: () => fetch("/api/financeiro/metricas").then((r) => r.json()),
  });

  if (isLoading || !data) {
    return <p className="text-xs text-white/25 py-10 text-center">Carregando métricas...</p>;
  }

  const m = data.mrr;
  const c = data.churn;
  const ue = data.unitEconomics;
  const comp = m.componentes;
  const maxComp = Math.max(comp.novo, comp.expansao, comp.reativacao, comp.contracao, comp.churn, 1);

  return (
    <div className="space-y-4">
      <HeroBand
        label="MRR ativo"
        value={fmt(m.atual)}
        cor="dinheiro"
        sub={
          <>
            ARR {fmtK(m.arr)} · início do mês {fmtK(m.inicioPeriodo)} ·{" "}
            {m.porProduto.map((p: { produto: string; mrr: number; contratos: number }) => `${p.produto.toUpperCase()} ${fmtK(p.mrr)} (${p.contratos})`).join(" · ")}
          </>
        }
      >
        <Stat label="Net MRR growth (mês)" value={fmt(comp.netGrowth)} cor={comp.netGrowth >= 0 ? "ganho" : "critico"} />
        <Stat label="NRR" value={fmtPct(c.nrr)} sub="acima de 100% = expansão supera perdas" cor={c.nrr >= 100 ? "ganho" : "atencao"} />
        <Stat label="Churn de receita (mês)" value={fmtPct(c.churnReceitaPct)} sub={`${fmt(c.mrrChurned)} perdidos`} cor="critico" />
        <Stat label="Churn de logo (mês)" value={fmtPct(c.churnLogoPct)} sub={`${c.logosChurned} de ${c.logosAtivosInicio} clientes`} cor="atencao" />
      </HeroBand>

      <Secao cor="dinheiro" hint="movimentos do mês — soma dos deltas reconstrói o MRR">Componentes do MRR</Secao>
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-1">
        <BarraLinha label="Novo" valor={comp.novo} max={maxComp} direita={fmt(comp.novo)} cor="ganho" />
        <BarraLinha label="Expansão" valor={comp.expansao} max={maxComp} direita={fmt(comp.expansao)} cor="ganho" />
        <BarraLinha label="Reativação" valor={comp.reativacao} max={maxComp} direita={fmt(comp.reativacao)} cor="pipeline" />
        <BarraLinha label="Contração" valor={comp.contracao} max={maxComp} direita={`− ${fmt(comp.contracao)}`} cor="atencao" />
        <BarraLinha label="Churn" valor={comp.churn} max={maxComp} direita={`− ${fmt(comp.churn)}`} cor="critico" />
      </div>

      <Secao cor="funil" hint="LTV e CAC cruzados com a Mídia Paga">Unit economics</Secao>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="ARPU" value={fmt(ue.arpu)} sub="receita média por cliente ativo" />
        <Stat label="LTV médio" value={ue.ltvMedio ? fmtK(ue.ltvMedio) : "—"} sub="ARPU ÷ churn de receita (média 3m)" cor="ganho" />
        <Stat
          label="LTV : CAC"
          value={ue.ltvCac ? `${ue.ltvCac.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "—"}
          sub={ue.cac ? `CAC ${fmt(ue.cac)} (Meta, período)` : "sem gasto de mídia casado no período"}
          cor={ue.ltvCac == null ? "neutro" : ue.ltvCac >= 3 ? "ganho" : "atencao"}
        />
        <Stat label="CAC payback" value={ue.cacPaybackMeses ? `${ue.cacPaybackMeses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses` : "—"} sub="meses até o cliente pagar a aquisição" />
      </div>

      <Secao cor="pipeline" hint="base + média do crescimento líquido dos últimos 3 meses — projeção honesta, sem mágica">Forecast de MRR</Secao>
      <div className="grid grid-cols-3 gap-3">
        {data.forecast.map((f: { mes: string; projetado: number; netHistorico: number }) => (
          <Stat
            key={f.mes}
            label={f.mes}
            value={fmtK(f.projetado)}
            sub={`${f.netHistorico >= 0 ? "+" : ""}${fmt(f.netHistorico)}/mês histórico`}
            cor={f.netHistorico >= 0 ? "ganho" : "atencao"}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <Secao cor="dinheiro" hint="mês corrente">Fluxo por linha de receita</Secao>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden mt-2">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-white/35 uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-medium">Linha</th>
                  <th className="px-4 py-2.5 font-medium text-right">Prevista</th>
                  <th className="px-4 py-2.5 font-medium text-right">Recebida</th>
                  <th className="px-4 py-2.5 font-medium text-right">Em aberto</th>
                </tr>
              </thead>
              <tbody>
                {(["ai", "pabx"] as const).map((linha) => {
                  const f = data.fluxo[linha];
                  return (
                    <tr key={linha} className="border-b border-white/[0.03]">
                      <td className="px-4 py-2.5 text-xs text-white/80 font-medium uppercase">{linha === "ai" ? "Callface AI (Stripe)" : "PABX (Wevy)"}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-white/70 tabular-nums">{fmt(f.receitaPrevista)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums" style={{ color: DOMINIO.ganho }}>{fmt(f.recebidoMes)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs tabular-nums ${f.emAberto > 0 ? "text-red-400" : "text-white/30"}`}>{fmt(f.emAberto)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <Secao cor="atencao" hint="próximos 90 dias — contratos com vencimento e anuais renovando">Renovações no radar</Secao>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden mt-2 max-h-72 overflow-y-auto">
            {data.renovacoes.length === 0 && <p className="text-[11px] text-white/25 p-4">Nenhuma renovação nos próximos 90 dias.</p>}
            {data.renovacoes.map((r: { contratoId: string; empresa: string | null; nome: string | null; produto: string; mrr: number; vencimento: string | null; proximaCobranca: string | null }) => (
              <div key={r.contratoId} className="flex items-center justify-between px-4 py-2 border-b border-white/[0.03]">
                <div className="min-w-0">
                  <p className="text-xs text-white/80 truncate">{r.empresa || r.nome}</p>
                  <p className="text-[10px] text-white/30">
                    {r.produto.toUpperCase()} · {r.vencimento ? `vence ${new Date(r.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}` : r.proximaCobranca ? `renova ${new Date(r.proximaCobranca).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <span className="text-xs tabular-nums text-white/70 shrink-0">{fmt(r.mrr)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
