"use client";

import { useQuery } from "@tanstack/react-query";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { ChartCard } from "./charts/ChartCard";
import { DonutChart } from "./charts/DonutChart";
import { FunnelChart } from "@/components/crm/FunnelChart";

interface TabMarketingProps {
  periodo: string;
}

interface LeadsPorCanal {
  origem: string;
  total: number;
}

interface FunilPreVendasItem {
  stage: string;
  label: string;
  total: number;
}

interface FunilVendasItem {
  stage: string;
  label: string;
  total: number;
}

interface CplCampanha {
  nome: string;
  gasto: number;
  leads: number;
  cpl: number | null;
  cliques: number;
  impressoes: number;
  qualificados?: number;
  clientes?: number;
  cpq?: number | null;
  cpc?: number | null;
}

interface PorCriativo {
  nome: string;
  campanha: string;
  gasto: number;
  leads: number;
  cpl: number | null;
  cliques: number;
  impressoes: number;
}

interface MarketingData {
  periodo: string;
  leads_por_canal: LeadsPorCanal[];
  funilPreVendas: FunilPreVendasItem[];
  funilVendas: FunilVendasItem[];
  cpl_por_campanha: CplCampanha[];
  por_criativo: PorCriativo[];
  metaConfigured: boolean;
  metaErro?: string;
  totalQualificados: number;
}

interface TendenciaItem {
  periodo: string;
  total: number;
  origens: Record<string, number>;
}

interface TendenciasData {
  data: TendenciaItem[];
}

interface TrackingLinha {
  chave: string;
  leads: number;
  qualificados: number;
  clientes: number;
  mrrReal: number;
  oportunidades: number;
  ganhos: number;
  taxaQualificacao: number;
  taxaConversao: number;
  gastoMeta?: number;
  leadsMeta?: number;
  cpl?: number | null;
  cac?: number | null;
  roas?: number | null;
}

interface MetaResumo {
  configured: boolean;
  totalGasto: number;
  totalLeads: number;
  naoCasadas: { campanha: string; gasto: number; leads: number }[];
  erro?: string;
}

interface Atribuicao {
  mrrTotal: number;
  mrrAtribuido: number;
  clientesTotal: number;
  clientesAtribuidos: number;
  pctAtribuido: number;
}

interface TrackingData {
  totalLeads: number;
  leadsRastreados: number;
  atribuicao?: Atribuicao;
  porCampanha: TrackingLinha[];
  porSource: TrackingLinha[];
  porMedium: TrackingLinha[];
  porOrigem: TrackingLinha[];
  meta?: MetaResumo;
}

const COLORS = [
  "#e23752",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#06B6D4",
  "#EC4899",
];

// Degradê azul→verde para pré-vendas (4 estágios)
const FUNNEL_PRE_VENDAS_COLORS = ["#3B82F6", "#06B6D4", "#22C55E", "#10B981"];

// Degradê carmim→verde para vendas
const FUNNEL_VENDAS_COLORS = ["#e23752", "#F59E0B", "#8B5CF6", "#3B82F6", "#10B981"];

const darkTooltip = {
  contentStyle: {
    background: "#1a1b23",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#fff",
  },
  itemStyle: { color: "rgba(255,255,255,0.8)" },
  labelStyle: { color: "rgba(255,255,255,0.6)" },
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    return `${day}/${months[d.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

function getCplColor(cpl: number | null): string {
  if (cpl === null) return "text-white/40";
  if (cpl < 50) return "text-emerald-400";
  if (cpl < 100) return "text-amber-400";
  return "text-red-400";
}

export default function TabMarketing({ periodo }: TabMarketingProps) {
  const {
    data: marketing,
    isLoading: loadingMarketing,
  } = useQuery<MarketingData>({
    queryKey: ["relatorios-marketing-v3", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/relatorios/marketing?periodo=${periodo}`);
      return res.json();
    },
  });

  const {
    data: tendencias,
    isLoading: loadingTendencias,
  } = useQuery<TendenciasData>({
    queryKey: ["relatorios-tendencias-leads", periodo],
    queryFn: async () => {
      const res = await fetch(
        `/api/relatorios/tendencias?periodo=${periodo}&tipo=leads`
      );
      return res.json();
    },
  });

  const { data: tracking, isLoading: loadingTracking } = useQuery<TrackingData>({
    queryKey: ["relatorios-tracking-campanha", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/relatorios/tracking?periodo=${periodo}`);
      return res.json();
    },
  });

  const leadsPorCanal = marketing?.leads_por_canal ?? [];
  const funilPreVendas = marketing?.funilPreVendas ?? [];
  const funilVendas = marketing?.funilVendas ?? [];
  const cplCampanhas = marketing?.cpl_por_campanha ?? [];
  const porCriativo = marketing?.por_criativo ?? [];
  const metaConfigured = marketing?.metaConfigured ?? false;
  const metaErro = marketing?.metaErro;

  const totalLeads = leadsPorCanal.reduce((sum, c) => sum + c.total, 0);

  // Top 3 origins across all weeks for stacked areas
  const originTotals: Record<string, number> = {};
  for (const item of tendencias?.data ?? []) {
    for (const [key, val] of Object.entries(item.origens)) {
      originTotals[key] = (originTotals[key] ?? 0) + val;
    }
  }
  const topOrigins = Object.entries(originTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);

  const hasOrigens = topOrigins.length > 1;

  // Tendencias chart data — flatten origens to top-level keys for Recharts
  const tendenciasData = (tendencias?.data ?? []).map((item) => ({
    total: item.total,
    label: formatShortDate(item.periodo),
    ...item.origens,
  }));

  // Map funilPreVendas to FunnelChart data
  const funilPreVendasData = funilPreVendas.map((item, i) => ({
    name: item.label,
    value: item.total,
    color: FUNNEL_PRE_VENDAS_COLORS[i % FUNNEL_PRE_VENDAS_COLORS.length],
  }));

  // Map funilVendas to FunnelChart data — Ganho always gets green
  const funilVendasData = funilVendas.map((item, i) => {
    const isGanho = item.stage.toLowerCase().includes("ganho") || item.label.toLowerCase().includes("ganho");
    return {
      name: item.label,
      value: item.total,
      color: isGanho ? "#10B981" : FUNNEL_VENDAS_COLORS[i % (FUNNEL_VENDAS_COLORS.length - 1)],
    };
  });

  return (
    <div className="space-y-4">
      {/* Row 1: Mini KPIs (dados reais) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi
          label="Total Leads"
          value={(tracking?.totalLeads ?? 0).toString()}
          hint="Leads no periodo"
          loading={loadingTracking}
        />
        <MiniKpi
          label="Leads rastreados"
          value={(tracking?.leadsRastreados ?? 0).toString()}
          hint="Com utm_campaign"
          loading={loadingTracking}
        />
        <MiniKpi
          label="Gasto Meta"
          value={tracking?.meta?.configured ? formatCurrency(tracking.meta.totalGasto) : "—"}
          hint={tracking?.meta?.configured ? "Investimento no periodo" : "Conecte o Meta"}
          loading={loadingTracking}
        />
        <MiniKpi
          label="CPL Meta"
          value={tracking?.meta?.configured && (tracking.meta.totalLeads ?? 0) > 0 ? formatCurrency(tracking.meta.totalGasto / tracking.meta.totalLeads) : "—"}
          hint="Gasto / leads Meta"
          loading={loadingTracking}
        />
      </div>

      {/* Row 2: Leads over time + Leads by channel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Leads ao Longo do Tempo"
            subtitle="Evolucao semanal de captacao"
            loading={loadingTendencias}
            empty={tendenciasData.length === 0}
            emptyText="Dados aparecerao conforme leads forem captados."
          >
            <ResponsiveContainer width="100%" height={260}>
              {hasOrigens ? (
                <AreaChart data={tendenciasData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                    allowDecimals={false}
                  />
                  <Tooltip {...darkTooltip} />
                  {topOrigins.map((origin, i) => (
                    <Area
                      key={origin}
                      type="monotone"
                      dataKey={origin}
                      name={origin}
                      stackId="1"
                      stroke={COLORS[i % COLORS.length]}
                      fill={COLORS[i % COLORS.length]}
                      fillOpacity={0.2}
                    />
                  ))}
                </AreaChart>
              ) : (
                <AreaChart data={tendenciasData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }}
                    allowDecimals={false}
                  />
                  <Tooltip {...darkTooltip} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#e23752"
                    fill="#e23752"
                    fillOpacity={0.2}
                    name="Leads"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="lg:col-span-1">
          <ChartCard
            title="Leads por Canal"
            loading={loadingMarketing}
            empty={leadsPorCanal.length === 0}
            emptyText="Nenhum lead captado no periodo."
          >
            <DonutChart
              data={leadsPorCanal.map((item, i) => ({
                name: item.origem || "Desconhecido",
                value: item.total,
                color: COLORS[i % COLORS.length],
              }))}
              centerValue={totalLeads.toString()}
              centerLabel="leads"
            />
          </ChartCard>
        </div>
      </div>

      {/* Row 3: Dois funis lado a lado */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funil de Pre-vendas (SDR)"
          subtitle="Novo → Em contato → Qualificando → Qualificado"
          loading={loadingMarketing}
          empty={funilPreVendas.length === 0}
          emptyText="Sem dados de pre-vendas no periodo."
        >
          <FunnelChart data={funilPreVendasData} />
        </ChartCard>

        <ChartCard
          title="Funil de Vendas"
          subtitle="Reuniao agendada → Proposta → Negociacao → Ganho"
          loading={loadingMarketing}
          empty={funilVendas.length === 0}
          emptyText="Sem dados de vendas no periodo."
        >
          <FunnelChart data={funilVendasData} />
        </ChartCard>
      </div>

      {/* Row 4: CPL por Campanha */}
      <ChartCard
        title="CPL por Campanha"
        subtitle="Custo por lead das campanhas ativas (Meta Ads)"
        loading={loadingMarketing}
        empty={!metaConfigured || cplCampanhas.length === 0}
        emptyText={
          !metaConfigured
            ? "Conecte a Meta Ads pra ver gasto e CPL."
            : "Nenhuma campanha com dados no periodo."
        }
      >
        <>
          {metaErro && (
            <p className="text-[10px] text-amber-400/70 mb-3">
              Aviso Meta Ads: {metaErro}
            </p>
          )}
          {metaConfigured && cplCampanhas.length > 0 && (
            <div>
              {/* Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
                <span className="flex-1 text-[10px] text-white/30 uppercase tracking-wider">
                  Campanha
                </span>
                <span className="w-24 text-[10px] text-white/30 uppercase tracking-wider text-right">
                  Gasto
                </span>
                <span className="w-14 text-[10px] text-white/30 uppercase tracking-wider text-right">
                  Leads
                </span>
                <span className="w-20 text-[10px] text-white/30 uppercase tracking-wider text-right">
                  CPL
                </span>
                <span className="w-20 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Custo por lead qualificado (foi pro pipeline do closer)">
                  CPQ
                </span>
                <span className="w-20 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Custo por cliente (closer ganhou)">
                  CPC
                </span>
              </div>

              {/* Rows */}
              {cplCampanhas.map((camp, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 py-2 border-b border-white/[0.04]"
                >
                  <span className="flex-1 text-[12px] text-white/60 truncate" title={camp.nome}>
                    {camp.nome}
                  </span>
                  <span className="w-24 text-[12px] text-white/50 text-right tabular-nums">
                    {formatCurrency(camp.gasto)}
                  </span>
                  <span className="w-14 text-[12px] text-white/60 text-right tabular-nums">
                    {camp.leads}
                  </span>
                  <span
                    className={`w-20 text-[12px] font-medium text-right tabular-nums ${getCplColor(camp.cpl)}`}
                  >
                    {camp.cpl !== null ? formatCurrency(camp.cpl) : "—"}
                  </span>
                  <span className="w-20 text-[12px] text-right tabular-nums text-white/60" title={`${camp.qualificados ?? 0} qualificados`}>
                    {camp.cpq != null ? formatCurrency(camp.cpq) : "—"}
                  </span>
                  <span className="w-20 text-[12px] text-right tabular-nums text-white/60" title={`${camp.clientes ?? 0} clientes`}>
                    {camp.cpc != null ? formatCurrency(camp.cpc) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!metaConfigured && (
            <div className="flex items-center justify-center h-[120px]">
              <p className="text-[13px] text-white/40 text-center">
                Conecte a Meta Ads pra ver gasto e CPL
              </p>
            </div>
          )}
        </>
      </ChartCard>

      {/* Row 5: Performance por Criativo */}
      <ChartCard
        title="Performance por Criativo"
        subtitle="Gasto, leads e CPL por criativo (Meta Ads)"
        loading={loadingMarketing}
        empty={!metaConfigured || porCriativo.length === 0}
        emptyText={
          !metaConfigured
            ? "Conecte a Meta Ads pra ver gasto e CPL."
            : "Nenhum criativo com dados no periodo."
        }
      >
        <>
          {metaErro && (
            <p className="text-[10px] text-amber-400/70 mb-3">
              Aviso Meta Ads: {metaErro}
            </p>
          )}
          {metaConfigured && porCriativo.length > 0 && (
            <div className="max-h-[420px] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06] sticky top-0 bg-transparent">
                <span className="flex-1 text-[10px] text-white/30 uppercase tracking-wider min-w-[140px]">
                  Criativo
                </span>
                <span className="w-32 text-[10px] text-white/30 uppercase tracking-wider truncate">
                  Campanha
                </span>
                <span className="w-24 text-[10px] text-white/30 uppercase tracking-wider text-right">
                  Gasto
                </span>
                <span className="w-14 text-[10px] text-white/30 uppercase tracking-wider text-right">
                  Leads
                </span>
                <span className="w-20 text-[10px] text-white/30 uppercase tracking-wider text-right">
                  CPL
                </span>
              </div>

              {/* Rows */}
              {porCriativo.map((criativo, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 py-2 border-b border-white/[0.04]"
                >
                  <span
                    className="flex-1 text-[12px] text-white/60 truncate min-w-[140px]"
                    title={criativo.nome}
                  >
                    {criativo.nome}
                  </span>
                  <span
                    className="w-32 text-[11px] text-white/35 truncate"
                    title={criativo.campanha}
                  >
                    {criativo.campanha}
                  </span>
                  <span className="w-24 text-[12px] text-white/50 text-right tabular-nums">
                    {formatCurrency(criativo.gasto)}
                  </span>
                  <span className="w-14 text-[12px] text-white/60 text-right tabular-nums">
                    {criativo.leads}
                  </span>
                  <span
                    className={`w-20 text-[12px] font-medium text-right tabular-nums ${getCplColor(criativo.cpl)}`}
                  >
                    {criativo.cpl !== null ? formatCurrency(criativo.cpl) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!metaConfigured && (
            <div className="flex items-center justify-center h-[120px]">
              <p className="text-[13px] text-white/40 text-center">
                Conecte a Meta Ads pra ver gasto e CPL
              </p>
            </div>
          )}
        </>
      </ChartCard>

      {/* Atribuicao: quanto da receita ativa liga a alguma campanha */}
      {tracking?.atribuicao && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Atribuicao de receita (MRR ativo)</p>
            <p className="text-[12px]" style={{ color: tracking.atribuicao.pctAtribuido >= 0.3 ? "#c8ff00" : "#f5a623" }}>
              {(tracking.atribuicao.pctAtribuido * 100).toFixed(0)}% atribuido a campanha
            </p>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-white/[0.05] mb-2">
            <div className="h-full rounded-full" style={{ width: `${Math.max(tracking.atribuicao.pctAtribuido * 100, 2)}%`, background: "#e23752" }} />
          </div>
          <p className="text-[11px] text-white/40">
            {formatCurrency(tracking.atribuicao.mrrAtribuido)} de {formatCurrency(tracking.atribuicao.mrrTotal)} ·{" "}
            {tracking.atribuicao.clientesAtribuidos}/{tracking.atribuicao.clientesTotal} clientes pagantes ligados a uma campanha.{" "}
            {tracking.atribuicao.pctAtribuido < 0.5 ? "O resto nao tem utm (anterior ao tracking ou a utm nao persistiu ate o checkout Stripe)." : ""}
          </p>
        </div>
      )}

      {/* Meta Ads: faixa de gasto/CPL ou convite pra conectar */}
      {tracking?.meta?.configured ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniKpi label="Gasto Meta" value={formatCurrency(tracking.meta.totalGasto)} hint="Investimento no periodo" loading={loadingTracking} />
          <MiniKpi label="Leads Meta" value={String(tracking.meta.totalLeads)} hint="Leads reportados pelo Meta" loading={loadingTracking} />
          <MiniKpi label="CPL Meta" value={tracking.meta.totalLeads > 0 ? formatCurrency(tracking.meta.totalGasto / tracking.meta.totalLeads) : "—"} hint="Gasto / leads Meta" loading={loadingTracking} />
          <MiniKpi label="Campanhas s/ match" value={String(tracking.meta.naoCasadas?.length ?? 0)} hint="Meta sem campanha no CRM" loading={loadingTracking} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-3 text-[12px] text-white/40">
          Conecte o <span className="text-white/70">Meta Ads</span> pra ver gasto, CPL, CAC e ROAS por campanha aqui (basta o token + ad account no .env).
        </div>
      )}

      {/* Row: TRACKING POR CAMPANHA (funil completo + Meta) */}
      <ChartCard
        title="Tracking por Campanha"
        subtitle={`Funil por utm_campaign · ${tracking?.leadsRastreados ?? 0}/${tracking?.totalLeads ?? 0} leads rastreados no periodo`}
        loading={loadingTracking}
        empty={(tracking?.porCampanha?.length ?? 0) === 0}
        emptyText="Sem leads com utm_campaign no periodo. Amplie o periodo."
      >
        <TrackingTable rows={tracking?.porCampanha ?? []} colLabel="Campanha" showMeta={tracking?.meta?.configured} />
      </ChartCard>

      {/* Por origem / source / medium */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Por Origem" loading={loadingTracking} empty={(tracking?.porOrigem?.length ?? 0) === 0} emptyText="—">
          <TrackingTable rows={tracking?.porOrigem ?? []} colLabel="Origem" compact />
        </ChartCard>
        <ChartCard title="Por Source (utm_source)" loading={loadingTracking} empty={(tracking?.porSource?.length ?? 0) === 0} emptyText="—">
          <TrackingTable rows={tracking?.porSource ?? []} colLabel="Source" compact />
        </ChartCard>
        <ChartCard title="Por Midia (utm_medium)" loading={loadingTracking} empty={(tracking?.porMedium?.length ?? 0) === 0} emptyText="—">
          <TrackingTable rows={tracking?.porMedium ?? []} colLabel="Midia" compact />
        </ChartCard>
      </div>
    </div>
  );
}

function TrackingTable({ rows, colLabel, compact, showMeta }: { rows: TrackingLinha[]; colLabel: string; compact?: boolean; showMeta?: boolean }) {
  const cell = "text-[12px] text-right tabular-nums";
  const head = "text-[10px] text-white/30 uppercase tracking-wider text-right";
  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06] min-w-max">
        <span className="flex-1 min-w-[140px] text-[10px] text-white/30 uppercase tracking-wider">{colLabel}</span>
        <span className={`w-14 ${head}`}>Leads</span>
        <span className={`w-16 ${head}`}>Qualif.</span>
        <span className={`w-16 ${head}`}>Clientes</span>
        <span className={`w-16 ${head}`}>Conv.</span>
        {!compact && <span className={`w-24 ${head}`}>MRR real</span>}
        {!compact && showMeta && <span className={`w-24 ${head}`}>Gasto</span>}
        {!compact && showMeta && <span className={`w-20 ${head}`}>CPL</span>}
        {!compact && showMeta && <span className={`w-20 ${head}`}>CAC</span>}
        {!compact && showMeta && <span className={`w-16 ${head}`}>ROAS</span>}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 py-2 border-b border-white/[0.04] min-w-max">
          <span className="flex-1 min-w-[140px] text-[12px] text-white/70 truncate" title={r.chave}>{r.chave}</span>
          <span className={`${cell} w-14 text-white/80 font-medium`}>{r.leads}</span>
          <span className={`${cell} w-16 text-white/50`}>{r.qualificados}</span>
          <span className={`${cell} w-16`} style={{ color: "#c8ff00" }}>{r.clientes}</span>
          <span className={`${cell} w-16 ${r.taxaConversao >= 0.02 ? "text-emerald-400" : "text-white/40"}`}>{(r.taxaConversao * 100).toFixed(1)}%</span>
          {!compact && <span className={`${cell} w-24`} style={{ color: "#e23752" }}>{r.mrrReal > 0 ? formatCurrency(r.mrrReal) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-24 text-white/70`}>{r.gastoMeta != null ? formatCurrency(r.gastoMeta) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-20 text-white/60`}>{r.cpl != null ? formatCurrency(r.cpl) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-20 text-white/60`}>{r.cac != null ? formatCurrency(r.cac) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-16 ${(r.roas ?? 0) >= 1 ? "text-emerald-400" : "text-white/40"}`}>{r.roas != null ? r.roas.toFixed(2) : "—"}</span>}
        </div>
      ))}
    </div>
  );
}

function MiniKpi({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-24 rounded bg-white/[0.04] animate-pulse mt-1" />
      ) : (
        <p className="text-xl font-bold text-white mt-1">{value}</p>
      )}
      <p className="text-[10px] text-white/25 mt-1">{hint}</p>
    </div>
  );
}
