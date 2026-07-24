"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartCard } from "./charts/ChartCard";
import { FunnelChart } from "@/components/crm/FunnelChart";
import { Megaphone, Users, Trophy, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";

interface TabMidiaPagaProps {
  periodo: string;
}

interface MetricaDimensao {
  chave: string;
  leads: number;
  qualificados: number;
  propostas: number;
  vendas: number;
  receita: number;
  cicloMedioDias: number | null;
  ticketMedio: number | null;
  gasto: number;
  impressoes: number;
  cliques: number;
  leadsMeta: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
  cpql: number | null;
  custoPorProposta: number | null;
  cpa: number | null;
  roas: number | null;
  taxaQualificacao: number;
  taxaConversao: number;
  pago: boolean; // casou com campanha/anúncio real da Meta
  campanha?: string; // nome da campanha-mãe — em conjuntos e criativos
  conjunto?: string; // nome do conjunto-mãe — só em criativos
}

interface Alerta {
  nivel: "verde" | "amarelo" | "vermelho";
  texto: string;
  chave?: string;
}

interface FunilMidiaPaga {
  impressoes: number;
  cliques: number;
  leads: number;
  leadsMeta: number;
  qualificados: number;
  propostas: number;
  vendas: number;
  receita: number;
  gastoTotal: number;
}

interface StatusAtualEtapa { stage: string; label: string; total: number }
interface ReceitaAtribuidaLinha { chave: string; pago: boolean; vendas: number; receita: number }
interface ReceitaAtribuida { linhas: ReceitaAtribuidaLinha[]; receitaTotal: number; receitaPaga: number; vendasTotal: number; vendasPagas: number }
interface RoasCicloLinha { chave: string; gastoTotal: number; receitaTotal: number; vendasTotal: number; roasCiclo: number | null }

interface MidiaPagaData {
  periodo: string;
  metaConfigured: boolean;
  funil: FunilMidiaPaga;
  porCampanha: MetricaDimensao[];
  porConjunto: MetricaDimensao[];
  porCriativo: MetricaDimensao[];
  rankingCampanhas: MetricaDimensao[];
  rankingConjuntos: MetricaDimensao[];
  rankingCriativos: MetricaDimensao[];
  alertas: Alerta[];
  statusAtual: StatusAtualEtapa[];
  receitaAtribuida: ReceitaAtribuida;
  roasCiclo: RoasCicloLinha[];
  pipelineAberto: { total: number; negocios: number };
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const fmtInt = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const fmtMoneyOrDash = (v: number | null) => (v == null ? "—" : formatCurrency(v));
const fmtDias = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}d`);
const fmtRoas = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}x`);
const roasColor = (v: number | null) => (v == null ? "text-white/30" : v >= 1 ? "text-emerald-400" : "text-red-400");

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-3 pt-3">
      <span className="h-[3px] w-6 rounded-full" style={{ background: "#e23752" }} />
      <h3 className="text-[12px] uppercase tracking-[0.18em] text-white/60 font-semibold whitespace-nowrap">{children}</h3>
      {hint && <span className="text-[11px] text-white/25 truncate">{hint}</span>}
      <div className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
    </div>
  );
}

// Disciplina de cor (21/07): número SEMPRE branco; accent vira tique e só quando é status.
const STATUS_ACCENTS = new Set(["#c8ff00", "#F59E0B", "#EF4444", "#10B981"]);
function HeroKpi({ label, value, sub, accent, big, icon: Icon }: { label: string; value: string; sub?: string; accent?: string; big?: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  const tick = accent && STATUS_ACCENTS.has(accent) ? accent : "rgba(255,255,255,0.16)";
  return (
    <div className="relative min-w-0 rounded-2xl border border-white/[0.07] overflow-hidden transition-colors hover:border-white/[0.12]" style={{ background: "var(--surface, #121212)" }}>
      <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: tick }} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-medium leading-snug pt-1">{label}</p>
          {Icon && (
            <span className="w-7 h-7 rounded-md border border-white/[0.12] flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-white/45" />
            </span>
          )}
        </div>
        <p className={`${big ? "text-2xl lg:text-3xl" : "text-xl lg:text-2xl"} font-bold mt-2 tabular-nums leading-tight break-words text-white`} style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }}>{value}</p>
        {sub && <p className="text-[11px] text-white/35 mt-2 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

const ALERTA_COR: Record<Alerta["nivel"], string> = { verde: "#10B981", amarelo: "#F59E0B", vermelho: "#EF4444" };
const ALERTA_ICONE: Record<Alerta["nivel"], string> = { verde: "🟢", amarelo: "🟡", vermelho: "🔴" };

function AlertasList({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null;
  const ordem: Alerta["nivel"][] = ["vermelho", "amarelo", "verde"];
  const ordenados = [...alertas].sort((a, b) => ordem.indexOf(a.nivel) - ordem.indexOf(b.nivel));
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
      {ordenados.map((a, i) => (
        <div key={i} className="flex items-start gap-2 text-[12px]">
          <span>{ALERTA_ICONE[a.nivel]}</span>
          <span style={{ color: a.nivel === "verde" ? "#fff" : ALERTA_COR[a.nivel] }} className={a.nivel === "verde" ? "text-white/80" : ""}>{a.texto}</span>
        </div>
      ))}
    </div>
  );
}

function RankingList({ itens }: { itens: MetricaDimensao[] }) {
  if (itens.length === 0) {
    return <p className="text-[12px] text-white/40 text-center py-6">Sem dados no período.</p>;
  }
  return (
    <div className="space-y-1.5">
      {itens.map((item, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
          <span className="w-6 text-[12px] text-white/30 tabular-nums">{i + 1}º</span>
          <span className="flex-1 min-w-0 text-[12px] text-white/70 truncate" title={item.chave}>
            {item.chave}
            {item.campanha && <span className="block text-[10px] text-white/30 truncate">{item.campanha}</span>}
          </span>
          <span className="w-14 text-right text-[11px] text-white/40 tabular-nums">{fmtInt(item.vendas)} venda{item.vendas === 1 ? "" : "s"}</span>
          <span className={`w-16 text-right text-[15px] font-bold tabular-nums ${roasColor(item.roas)}`}>{fmtRoas(item.roas)}</span>
        </div>
      ))}
    </div>
  );
}

// Drill-down: cada nível sabe achar as linhas-filha (do nível de baixo) a partir da
// chave do pai. Campanha → Conjunto → Criativo, montado a partir do MESMO payload
// (as 3 tabelas já vêm juntas em /relatorios/midia-paga — sem chamada extra à API).
interface DrilldownLevel {
  colLabel: string;
  rowsFor: (chavePai: string) => MetricaDimensao[];
  child?: DrilldownLevel;
}

function DimensaoTable({ rows, colLabel, drilldown }: { rows: MetricaDimensao[]; colLabel: string; drilldown?: DrilldownLevel }) {
  const [abertos, setAbertos] = useState<Set<number>>(new Set());
  const head = "text-[10px] text-white/30 uppercase tracking-wider text-right";
  const cell = "text-[12px] text-right tabular-nums";
  if (rows.length === 0) return <p className="text-[12px] text-white/40 text-center py-6">Sem dados no período.</p>;

  const toggle = (i: number) =>
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1180px]">
        <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
          <span className="flex-1 min-w-[160px] text-[10px] text-white/30 uppercase tracking-wider">{colLabel}</span>
          <span className={`w-20 ${head}`}>Gasto</span>
          <span className={`w-16 ${head}`}>ROAS</span>
          <span className={`w-14 ${head}`}>CTR</span>
          <span className={`w-16 ${head}`} title="Pago: leads reportados pela Meta · Orgânico: leads do CRM">Leads</span>
          <span className={`w-14 ${head}`}>Qualif.</span>
          <span className={`w-14 ${head}`}>Propostas</span>
          <span className={`w-14 ${head}`}>Vendas</span>
          <span className={`w-20 ${head}`}>CPL</span>
          <span className={`w-20 ${head}`} title="Custo por qualificado">CPQL</span>
          <span className={`w-20 ${head}`} title="Custo por cliente">CPA</span>
          <span className={`w-16 ${head}`}>Ciclo</span>
          <span className={`w-20 ${head}`}>Ticket</span>
        </div>
        {rows.map((r, i) => {
          const filhos = drilldown ? drilldown.rowsFor(r.chave) : [];
          const aberto = abertos.has(i);
          return (
            <div key={i}>
              <div className="flex items-center gap-2 py-2 border-b border-white/[0.04]">
                <span className="flex-1 min-w-[160px] flex items-start gap-1.5">
                  {drilldown && filhos.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      className="shrink-0 mt-0.5 text-white/30 hover:text-white/70 transition-colors"
                      aria-label={aberto ? `Recolher ${drilldown.colLabel.toLowerCase()}s` : `Expandir ${drilldown.colLabel.toLowerCase()}s`}
                    >
                      {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 text-[12px] text-white/70 truncate" title={r.chave}>
                    {r.chave}
                    {!r.pago && (
                      <span className="ml-2 align-middle text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/40" title="Sem match com campanha da Meta — não entra em ROAS, funil pago nem alertas">
                        orgânico
                      </span>
                    )}
                    {r.campanha && <span className="block text-[10px] text-white/30 truncate">{r.campanha}</span>}
                  </span>
                </span>
                <span className={`w-20 ${cell} text-white/50`}>{formatCurrency(r.gasto)}</span>
                <span className={`w-16 ${cell} font-bold ${roasColor(r.roas)}`}>{fmtRoas(r.roas)}</span>
                <span className={`w-14 ${cell} text-white/60`}>{fmtPct(r.ctr)}</span>
                <span className={`w-16 ${cell} text-white/70`}>{fmtInt(r.pago ? r.leadsMeta : r.leads)}</span>
                <span className={`w-14 ${cell} text-white/60`}>{fmtInt(r.qualificados)}</span>
                <span className={`w-14 ${cell} text-white/60`}>{fmtInt(r.propostas)}</span>
                <span className={`w-14 ${cell}`} style={{ color: "#c8ff00" }}>{fmtInt(r.vendas)}</span>
                <span className={`w-20 ${cell} text-white/60`}>{fmtMoneyOrDash(r.cpl)}</span>
                <span className={`w-20 ${cell} text-white/60`}>{fmtMoneyOrDash(r.cpql)}</span>
                <span className={`w-20 ${cell} text-white/60`}>{fmtMoneyOrDash(r.cpa)}</span>
                <span className={`w-16 ${cell} text-white/40`}>{fmtDias(r.cicloMedioDias)}</span>
                <span className={`w-20 ${cell} text-white/60`}>{fmtMoneyOrDash(r.ticketMedio)}</span>
              </div>
              {aberto && filhos.length > 0 && (
                <div className="ml-5 pl-3 border-l border-white/[0.08] my-1">
                  <DimensaoTable rows={filhos} colLabel={drilldown!.colLabel} drilldown={drilldown!.child} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TabMidiaPaga({ periodo }: TabMidiaPagaProps) {
  const { data, isLoading } = useQuery<MidiaPagaData>({
    queryKey: ["relatorios-midia-paga-v2", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/relatorios/midia-paga?periodo=${periodo}`);
      return res.json();
    },
  });

  const funil = data?.funil;
  const metaOn = data?.metaConfigured ?? false;
  const roasTotal = funil && funil.gastoTotal > 0 ? funil.receita / funil.gastoTotal : null;
  // CPL pelo lead REPORTADO PELA META (mesma régua da tabela por campanha — ENG-666 item 2)
  const cplTotal = funil && funil.leadsMeta > 0 && funil.gastoTotal > 0 ? funil.gastoTotal / funil.leadsMeta : null;
  const residuoLeads = funil ? funil.leadsMeta - funil.leads : 0;

  // Funil em rampa de cinza — lima só em Vendas (sucesso). Disciplina de cor 21/07.
  const funilData = funil
    ? [
        { name: "Impressões", value: funil.impressoes, color: "rgba(255,255,255,0.16)" },
        { name: "Cliques", value: funil.cliques, color: "rgba(255,255,255,0.26)" },
        { name: "Leads", value: funil.leads, color: "rgba(255,255,255,0.38)" },
        { name: "Qualificados", value: funil.qualificados, color: "rgba(255,255,255,0.52)" },
        { name: "Propostas", value: funil.propostas, color: "rgba(255,255,255,0.68)" },
        { name: "Vendas", value: funil.vendas, color: "#c8ff00" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {!metaOn && (
        <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-3 text-[12px] text-white/40">
          Meta Ads não conectado — sem gasto/CPL/CPQL/CPA/ROAS. Só Meta é integrado hoje (sem Google Ads).
        </div>
      )}

      <SectionTitle hint="o que fazer agora, sem precisar interpretar planilha">Alertas</SectionTitle>
      {isLoading ? (
        <div className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
      ) : (
        <AlertasList alertas={data?.alertas ?? []} />
      )}

      <SectionTitle hint="números ATRIBUÍDOS À MÍDIA PAGA — cohort dos leads que entraram no período (não é o total da empresa)">Visão geral</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HeroKpi label="Investimento" value={metaOn && funil ? formatCurrency(funil.gastoTotal) : "—"} sub="mídia no período" big icon={Megaphone} />
        <HeroKpi
          label="Leads da mídia"
          value={funil ? fmtInt(funil.leadsMeta) : "—"}
          sub={funil ? `${cplTotal != null ? `CPL ${formatCurrency(cplTotal)} · ` : ""}${fmtInt(funil.leads)} no CRM${residuoLeads > 0 ? ` (${residuoLeads} dedupe/reconversão)` : ""}` : "no período"}
          icon={Users}
        />
        <HeroKpi label="Vendas do cohort" value={funil ? fmtInt(funil.vendas) : "—"} sub="leads deste período que já fecharam" accent={funil && funil.vendas > 0 ? "#c8ff00" : undefined} icon={Trophy} />
        <HeroKpi label="ROAS do cohort" value={roasTotal != null ? `${roasTotal.toFixed(2)}x` : "—"} sub="receita do cohort / gasto do período" accent={roasTotal != null && roasTotal >= 1 ? "#c8ff00" : undefined} icon={TrendingUp} />
      </div>

      <ChartCard title="Jornada do cohort" subtitle="Leads que ENTRARAM no período e até onde já chegaram · leads de ciclo longo amadurecem nos meses seguintes — a receita do mês em si está na seção abaixo" loading={isLoading} empty={!funil || funil.leads === 0} emptyText="Sem leads com UTM de campanha no período.">
        <FunnelChart data={funilData} />
      </ChartCard>

      {/* ENG-667a — onde os leads pagos do período estão AGORA */}
      <SectionTitle hint="estágio atual real de cada lead pago do período — gargalo em tempo real, não histórico">Onde estão agora</SectionTitle>
      <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: "var(--surface, #121212)" }}>
        {isLoading ? (
          <div className="h-32 rounded-xl bg-white/[0.04] animate-pulse" />
        ) : (
          <div className="space-y-1">
            {(data?.statusAtual ?? []).filter((s) => s.total > 0).map((s) => {
              const max = Math.max(...(data?.statusAtual ?? []).map((x) => x.total), 1);
              const fill = s.stage === "ganho" ? "#c8ff00" : s.stage === "perdido" || s.stage === "desqualificado" ? "rgba(255,255,255,0.18)" : s.stage === "negocio_parado" || s.stage === "estagnado_sdr" ? "#F59E0B" : "rgba(255,255,255,0.4)";
              return (
                <div key={s.stage} className="flex items-center gap-3 py-0.5">
                  <span className="text-[12px] text-white/60 w-48 truncate shrink-0">{s.label}</span>
                  <div className="flex-1 h-5 rounded-md bg-white/[0.05] overflow-hidden">
                    <div className="h-5 rounded-md" style={{ width: `${Math.max((s.total / max) * 100, 2)}%`, background: fill }} />
                  </div>
                  <span className="text-[12px] text-white/70 w-10 text-right tabular-nums shrink-0">{s.total}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ENG-667b/c/d — receita real do mês por origem + futuro do canal */}
      <SectionTitle hint="negócios GANHOS no período pela origem ORIGINAL do lead — inclui lead antigo que fechou agora">Receita do período por origem</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HeroKpi label="Receita atribuída à mídia" value={data ? formatCurrency(data.receitaAtribuida?.receitaPaga ?? 0) : "—"} sub={data ? `${data.receitaAtribuida?.vendasPagas ?? 0} de ${data.receitaAtribuida?.vendasTotal ?? 0} vendas do período` : ""} accent={data && (data.receitaAtribuida?.receitaPaga ?? 0) > 0 ? "#c8ff00" : undefined} big icon={Trophy} />
        <HeroKpi label="Receita total do período" value={data ? formatCurrency(data.receitaAtribuida?.receitaTotal ?? 0) : "—"} sub="todas as origens" icon={Megaphone} />
        <HeroKpi label="Pipeline aberto (mídia)" value={data ? formatCurrency(data.pipelineAberto?.total ?? 0) : "—"} sub={data ? `${data.pipelineAberto?.negocios ?? 0} negócios em andamento` : ""} icon={Users} />
        <HeroKpi label="% da receita vinda da mídia" value={data && (data.receitaAtribuida?.receitaTotal ?? 0) > 0 ? `${Math.round(((data.receitaAtribuida?.receitaPaga ?? 0) / data.receitaAtribuida.receitaTotal) * 100)}%` : "—"} sub="na origem do lead (first-touch)" icon={TrendingUp} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Receita ganha no período por origem" subtitle="Origem original do lead (first-touch), independente de quando ele entrou" loading={isLoading} empty={(data?.receitaAtribuida?.linhas?.length ?? 0) === 0} emptyText="Nenhuma venda no período.">
          <div className="space-y-1">
            {(data?.receitaAtribuida?.linhas ?? []).slice(0, 10).map((l, i) => {
              const max = Math.max(...(data?.receitaAtribuida?.linhas ?? []).map((x) => x.receita), 1);
              return (
                <div key={i} className="flex items-center gap-3 py-0.5">
                  <span className="text-[12px] text-white/60 w-44 truncate shrink-0" title={l.chave}>
                    {l.chave}
                    {l.pago && <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded-full bg-white/[0.08] text-white/50">mídia</span>}
                  </span>
                  <div className="flex-1 h-5 rounded-md bg-white/[0.05] overflow-hidden">
                    <div className="h-5 rounded-md" style={{ width: `${Math.max((l.receita / max) * 100, 2)}%`, background: l.pago ? "#c8ff00" : "rgba(255,255,255,0.35)" }} />
                  </div>
                  <span className="text-[12px] text-white/70 w-24 text-right tabular-nums shrink-0">{formatCurrency(l.receita)}</span>
                  <span className="text-[11px] text-white/30 w-8 text-right tabular-nums shrink-0">{l.vendas}</span>
                </div>
              );
            })}
          </div>
        </ChartCard>
        <ChartCard title="ROAS de ciclo de vida por campanha" subtitle="Toda a receita já atribuída ÷ todo o gasto da campanha — não penaliza ciclo de venda longo" loading={isLoading} empty={(data?.roasCiclo?.length ?? 0) === 0} emptyText="Sem campanhas com gasto.">
          <div className="space-y-1.5">
            {(data?.roasCiclo ?? []).slice(0, 8).map((l, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                <span className="flex-1 min-w-0 text-[12px] text-white/70 truncate" title={l.chave}>{l.chave}</span>
                <span className="w-24 text-right text-[11px] text-white/40 tabular-nums">{formatCurrency(l.gastoTotal)}</span>
                <span className="w-24 text-right text-[11px] text-white/60 tabular-nums">{formatCurrency(l.receitaTotal)}</span>
                <span className={`w-16 text-right text-[14px] font-bold tabular-nums ${roasColor(l.roasCiclo)}`}>{fmtRoas(l.roasCiclo)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <SectionTitle hint="ordenado por ROAS — sem nota composta, sem mínimo de amostra">Ranking por ROAS</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Top campanhas" loading={isLoading} empty={(data?.rankingCampanhas.length ?? 0) === 0} emptyText="Nenhuma campanha com dado no período.">
          <RankingList itens={data?.rankingCampanhas ?? []} />
        </ChartCard>
        <ChartCard title="Top conjuntos" loading={isLoading} empty={(data?.rankingConjuntos.length ?? 0) === 0} emptyText="Nenhum conjunto com dado no período.">
          <RankingList itens={data?.rankingConjuntos ?? []} />
        </ChartCard>
        <ChartCard title="Top criativos" loading={isLoading} empty={(data?.rankingCriativos.length ?? 0) === 0} emptyText="Nenhum criativo com dado no período.">
          <RankingList itens={data?.rankingCriativos ?? []} />
        </ChartCard>
      </div>

      <SectionTitle hint="todas as campanhas com atividade no período — inclusive as sem lead casado no CRM · clique na seta pra ver os conjuntos">Campanhas</SectionTitle>
      <ChartCard title="Performance por campanha" loading={isLoading} empty={(data?.porCampanha.length ?? 0) === 0} emptyText="Sem campanhas com dado no período.">
        <DimensaoTable
          rows={data?.porCampanha ?? []}
          colLabel="Campanha"
          drilldown={{
            colLabel: "Conjunto",
            rowsFor: (campanhaChave) => (data?.porConjunto ?? []).filter((cj) => cj.campanha === campanhaChave),
            child: {
              colLabel: "Criativo",
              rowsFor: (conjuntoChave) => (data?.porCriativo ?? []).filter((cr) => cr.conjunto === conjuntoChave),
            },
          }}
        />
      </ChartCard>

      <SectionTitle hint="segmentação de público e orçamento dentro de cada campanha — clique na seta pra ver os criativos">Conjuntos de Anúncios</SectionTitle>
      <ChartCard title="Performance por conjunto de anúncios" loading={isLoading} empty={(data?.porConjunto.length ?? 0) === 0} emptyText="Sem conjuntos com dado no período.">
        <DimensaoTable
          rows={data?.porConjunto ?? []}
          colLabel="Conjunto"
          drilldown={{
            colLabel: "Criativo",
            rowsFor: (conjuntoChave) => (data?.porCriativo ?? []).filter((cr) => cr.conjunto === conjuntoChave),
          }}
        />
      </ChartCard>

    </div>
  );
}
