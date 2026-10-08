"use client";

import { useQuery } from "@tanstack/react-query";
import { Secao, Stat, BarraLinha } from "./kit";

interface PosVendaData {
  mrr_total_ativo: number;
  contratos_ativos: number;
  clientes_ativos: number;
  nps_medio: number | null;
  nps_total_respostas: number;
  nps_distribuicao: { detratores: number; neutros: number; promotores: number };
  churnRate: number;
  contratosVencendo: { leadNome: string | null; mrr: number; vencimento: string; diasRestantes: number }[];
  mrrPorTipo: { tipo: string | null; mrr: number; count: number }[];
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function TabPosVenda() {
  const { data, isLoading } = useQuery<PosVendaData>({
    queryKey: ["relatorios-pos-venda"],
    queryFn: () => fetch("/api/relatorios/pos-venda").then((r) => r.json()),
  });

  if (isLoading || !data) {
    return <p className="text-xs text-[var(--cf2-text-tertiary)] py-10 text-center">Carregando…</p>;
  }

  const npsTotal = data.nps_distribuicao.detratores + data.nps_distribuicao.neutros + data.nps_distribuicao.promotores;
  const maxNps = Math.max(npsTotal, 1);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="MRR ativo" value={brl(data.mrr_total_ativo)} sub={`${data.clientes_ativos} clientes ativos`} cor="dinheiro" destaque />
        <Stat label="NPS médio" value={data.nps_medio != null ? data.nps_medio.toFixed(1) : "—"} sub={`${data.nps_total_respostas} respostas`} cor={data.nps_medio != null && data.nps_medio >= 50 ? "ganho" : "atencao"} />
        <Stat
          label="Churn histórico"
          value={`${data.churnRate}%`}
          sub="contratos cancelados / total já criados (acumulado, não é o churn do mês — ver aba Financeiro pra churn mensal)"
          cor={data.churnRate > 10 ? "critico" : "atencao"}
        />
        <Stat label="Vencendo em 90 dias" value={data.contratosVencendo.length} sub={`${brl(data.contratosVencendo.reduce((s, c) => s + c.mrr, 0))} em risco`} cor={data.contratosVencendo.length > 0 ? "atencao" : "ganho"} />
      </div>

      <Secao hint={`${npsTotal} respostas de NPS`}>Distribuição de NPS</Secao>
      <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4 space-y-1">
        <BarraLinha label="Promotores (9-10)" valor={data.nps_distribuicao.promotores} max={maxNps} direita={String(data.nps_distribuicao.promotores)} cor="ganho" />
        <BarraLinha label="Neutros (7-8)" valor={data.nps_distribuicao.neutros} max={maxNps} direita={String(data.nps_distribuicao.neutros)} cor="atencao" />
        <BarraLinha label="Detratores (0-6)" valor={data.nps_distribuicao.detratores} max={maxNps} direita={String(data.nps_distribuicao.detratores)} cor="critico" />
      </div>

      <Secao hint="MRR oficial por família de serviço (mesma competência do total)">MRR por tipo</Secao>
      <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4 space-y-1">
        {data.mrrPorTipo.map((t) => (
          <BarraLinha key={t.tipo ?? "sem-tipo"} label={t.tipo || "(sem tipo)"} valor={t.mrr} max={Math.max(...data.mrrPorTipo.map((x) => x.mrr), 1)} direita={brl(t.mrr)} extra={`${t.count}`} />
        ))}
        {data.mrrPorTipo.length === 0 && <p className="text-[12px] text-[var(--cf2-text-tertiary)]">Sem MRR no último fechamento.</p>}
      </div>

      <Secao hint="próximos 90 dias, ordenado por urgência">Contratos vencendo</Secao>
      <div className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] divide-y divide-white/[0.06]">
        {data.contratosVencendo.map((c, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[13px] text-[var(--cf2-text-secondary)] truncate">{c.leadNome || "(sem nome)"}</span>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-[12px] text-[var(--cf2-text-tertiary)]">{brl(c.mrr)}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${c.diasRestantes <= 15 ? "bg-[#fceded] text-[var(--cf2-danger-text)]" : c.diasRestantes <= 45 ? "bg-[var(--cf2-warning-bg)] text-[var(--cf2-warning-text)]" : "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-tertiary)]"}`}>
                {c.diasRestantes}d
              </span>
            </div>
          </div>
        ))}
        {data.contratosVencendo.length === 0 && <p className="text-[12px] text-[var(--cf2-text-tertiary)] px-4 py-3">Nenhum contrato vencendo nos próximos 90 dias.</p>}
      </div>
    </div>
  );
}
