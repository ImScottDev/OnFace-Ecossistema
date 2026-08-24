import { Cf2UnavailableMetric } from "@/components/crm2/ui/States";
import type { PulsoPreVendas } from "@/lib/analytics/pre-vendas";

export function Cf2PreVendasPulse({ pulso, pulsoAnterior }: { pulso: PulsoPreVendas; pulsoAnterior: PulsoPreVendas }) {
  const deltaTaxaPct = pulso.taxaQualificacao !== null && pulsoAnterior.taxaQualificacao !== null && pulsoAnterior.taxaQualificacao > 0
    ? ((pulso.taxaQualificacao - pulsoAnterior.taxaQualificacao) / pulsoAnterior.taxaQualificacao) * 100
    : null;

  return (
    <div className="rounded-3xl p-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[18px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Pulso da Pré-Venda</p>
          <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Desempenho do funil de qualificação de leads no período</p>
        </div>
        {deltaTaxaPct !== null ? (
          <div className="px-2 py-1 rounded-md" style={{ background: "#153723" }}>
            <p className="text-[11px] font-bold" style={{ color: "#4ade80" }}>{deltaTaxaPct >= 0 ? "+" : ""}{deltaTaxaPct.toFixed(1)}% conversão vs mês anterior</p>
          </div>
        ) : <Cf2UnavailableMetric reason="Sem taxa de qualificação no mês anterior pra comparar" />}
      </div>
      <div className="flex items-center gap-6">
        <MetricGroup label="Leads no Período" valor={String(pulso.leadsNoPeriodo)} sub="Total inbound e outbound" />
        <Divider />
        <MetricGroup label="Em Qualificação" valor={String(pulso.emQualificacao)} sub="Triagem ativa pelos SDRs" subTom="accent" />
        <Divider />
        <MetricGroup label="Qualificados (SQL)" valor={String(pulso.qualificadosSQL)} sub="Prontos para executivos" subTom="accent" />
        <Divider />
        {pulso.taxaQualificacao !== null ? <MetricGroup label="Taxa de Qualificação" valor={`${pulso.taxaQualificacao.toFixed(0)}%`} sub="Conversão interna do período" subTom="accent" /> : (
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Taxa de Qualificação</p>
            <Cf2UnavailableMetric reason="Sem leads no período pra calcular taxa" />
          </div>
        )}
        <Divider />
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <SubStat label="Tempo Quali:" valor={pulso.tempoQualificacaoDias !== null ? `${pulso.tempoQualificacaoDias.toFixed(1)} dias` : undefined} indisponivel={pulso.tempoQualificacaoDias === null ? "Nenhum lead qualificado (com negócio criado) no período" : undefined} />
          <SubStat label="1º Contato SLA:" valor={pulso.primeiroContatoSlaMinutos !== null ? formatMinutos(pulso.primeiroContatoSlaMinutos) : undefined} indisponivel={pulso.primeiroContatoSlaMinutos === null ? "Sem registro de contato no período" : undefined} />
          <SubStat label="Sem Contato:" valor={`${pulso.semContato} leads`} />
        </div>
      </div>
    </div>
  );
}

function formatMinutos(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${(min / 60).toFixed(1)} h`;
  return `${(min / 1440).toFixed(1)} d`;
}

function Divider() {
  return <div className="w-px self-stretch" style={{ background: "var(--cf2-chrome-border-subtle)" }} />;
}

function MetricGroup({ label, valor, sub, subTom }: { label: string; valor: string; sub: string; subTom?: "accent" }) {
  return <div className="flex-1 flex flex-col gap-1.5 min-w-0">
    <p className="text-[11px] font-bold uppercase" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</p>
    <p className="text-[28px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</p>
    <p className="text-xs" style={{ color: subTom === "accent" ? "var(--cf2-accent-border)" : "var(--cf2-chrome-text-secondary)" }}>{sub}</p>
  </div>;
}

function SubStat({ label, valor, indisponivel }: { label: string; valor?: string; indisponivel?: string }) {
  return <div className="flex items-center justify-between w-full gap-3">
    <span className="text-xs" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{label}</span>
    {valor !== undefined ? <span className="text-sm font-bold whitespace-nowrap" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{valor}</span> : <Cf2UnavailableMetric reason={indisponivel || "Sem dado suficiente"} />}
  </div>;
}

/**
 * Variante "5 cards discretos lado a lado" (Figma node do board Pré-vendas,
 * 23/08) — mesmo `getPulsoPreVendas` do card único acima (`Cf2PreVendasPulse`,
 * usado em /vendas "Visão Geral"), só o layout muda: um card por métrica em
 * vez de um card com divisores internos. Nenhum número novo é calculado além
 * do delta de `leadsNoPeriodo` (mesma fórmula já usada pra `deltaTaxaPct`,
 * aplicada aqui também à contagem bruta de leads). "Tempo médio 1º contato"
 * usa só `semContato` como detalhe real — o Figma mostra também "N fora do
 * SLA", mas essa contagem não existe agregada em `getPulsoPreVendas` (SLA
 * hoje só é calculado por lead, no client, dentro do Kanban); omitido em vez
 * de fabricado.
 */
export function Cf2PreVendasPulseCards({ pulso, pulsoAnterior }: { pulso: PulsoPreVendas; pulsoAnterior: PulsoPreVendas }) {
  const deltaLeadsPct = pulsoAnterior.leadsNoPeriodo > 0
    ? ((pulso.leadsNoPeriodo - pulsoAnterior.leadsNoPeriodo) / pulsoAnterior.leadsNoPeriodo) * 100
    : null;
  const deltaTaxaPp = pulso.taxaQualificacao !== null && pulsoAnterior.taxaQualificacao !== null
    ? pulso.taxaQualificacao - pulsoAnterior.taxaQualificacao
    : null;

  const cards: { label: string; valor: string; sub: React.ReactNode }[] = [
    {
      label: "Leads no Período",
      valor: String(pulso.leadsNoPeriodo),
      sub: deltaLeadsPct !== null
        ? <span style={{ color: deltaLeadsPct >= 0 ? "#4ade80" : "#f87171" }}>{deltaLeadsPct >= 0 ? "↑" : "↓"} {Math.abs(deltaLeadsPct).toFixed(1)}% vs mês anterior</span>
        : <Cf2UnavailableMetric reason="Sem leads no mês anterior pra comparar" />,
    },
    {
      label: "Em Qualificação",
      valor: String(pulso.emQualificacao),
      sub: "Triagem ativa pelos SDRs",
    },
    {
      label: "Qualificados (SQL)",
      valor: String(pulso.qualificadosSQL),
      sub: "Prontos para executivos",
    },
    {
      label: "Taxa de Qualificação",
      valor: pulso.taxaQualificacao !== null ? `${pulso.taxaQualificacao.toFixed(0)}%` : "—",
      sub: pulso.taxaQualificacao === null
        ? <Cf2UnavailableMetric reason="Sem leads no período pra calcular taxa" />
        : deltaTaxaPp !== null
          ? <span style={{ color: deltaTaxaPp >= 0 ? "#4ade80" : "#f87171" }}>{deltaTaxaPp >= 0 ? "↑" : "↓"} {Math.abs(deltaTaxaPp).toFixed(1)}pp vs mês anterior</span>
          : <Cf2UnavailableMetric reason="Sem taxa do mês anterior pra comparar" />,
    },
    {
      label: "Tempo Médio 1º Contato",
      valor: pulso.primeiroContatoSlaMinutos !== null ? formatMinutos(pulso.primeiroContatoSlaMinutos) : "—",
      sub: pulso.primeiroContatoSlaMinutos === null
        ? <Cf2UnavailableMetric reason="Sem registro de contato no período" />
        : `${pulso.semContato} sem contato`,
    },
  ];

  return (
    <div className="flex gap-4">
      {cards.map((c) => (
        <div key={c.label} className="flex-1 min-w-0 flex flex-col gap-1.5 p-4 rounded-2xl" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
          <p className="text-[11px] font-bold uppercase truncate" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{c.label}</p>
          <p className="text-[28px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{c.valor}</p>
          <div className="text-xs truncate" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
