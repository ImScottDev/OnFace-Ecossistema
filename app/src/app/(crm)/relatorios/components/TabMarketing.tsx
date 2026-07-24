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
import { Megaphone, Users, Coins, Filter, Trophy, TrendingUp } from "lucide-react";

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
  qualificados?: number;
  clientes?: number;
  cpq?: number | null;
  cpc?: number | null;
}

interface MarketingHero {
  investimento: number;
  leadsCrm: number;
  leadsMeta: number;
  qualificados: number;
  vendasAtribuidas: number;
  receitaAtribuida: number;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
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
  hero: MarketingHero;
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
  cplq?: number | null;
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

// Paleta contida (disciplina de cor 21/07): tons neutros + 1 acento de marca.
const COLORS = [
  "#e23752",
  "rgba(255,255,255,0.85)",
  "rgba(255,255,255,0.6)",
  "rgba(255,255,255,0.42)",
  "rgba(255,255,255,0.3)",
  "rgba(255,255,255,0.2)",
  "rgba(255,255,255,0.12)",
];

// Funis em rampa de cinza — lima só no estágio final (sucesso)
const FUNNEL_PRE_VENDAS_COLORS = ["rgba(255,255,255,0.22)", "rgba(255,255,255,0.38)", "rgba(255,255,255,0.55)", "#c8ff00"];
const FUNNEL_VENDAS_COLORS = ["rgba(255,255,255,0.2)", "rgba(255,255,255,0.3)", "rgba(255,255,255,0.42)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0.7)"];

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

// Métricas de criativo derivadas do que o Meta entrega (spend/impressões/cliques).
const ctrOf = (cliques: number, impressoes: number): number | null => (impressoes > 0 ? (cliques / impressoes) * 100 : null);
const cpmOf = (gasto: number, impressoes: number): number | null => (impressoes > 0 ? (gasto / impressoes) * 1000 : null);
// CTR bom em tráfego pago B2B fica ~>1%; verde acima disso, âmbar médio, vermelho fraco.
function getCtrColor(ctr: number | null): string {
  if (ctr === null) return "text-white/40";
  if (ctr >= 1.5) return "text-emerald-400";
  if (ctr >= 0.8) return "text-amber-400";
  return "text-red-400";
}
const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}%`);
const fmtInt = (v: number) => v.toLocaleString("pt-BR");

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

// Disciplina de cor (21/07): número SEMPRE branco; accent vira tique e só quando
// é status (lima/âmbar/vermelho). min-w-0/break-words evita overlap (auditoria item 9).
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
        <p className="text-xl xl:text-2xl font-bold mt-2 tabular-nums leading-tight break-words text-white" style={{ fontFamily: "var(--font-heading)", letterSpacing: "-0.01em" }} title={big ? value : undefined}>{value}</p>
        {sub && <p className="text-[11px] text-white/35 mt-2 leading-snug">{sub}</p>}
      </div>
    </div>
  );
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

  // Map funilVendas to FunnelChart data — lima só no Ganho (sucesso)
  const funilVendasData = funilVendas.map((item, i) => {
    const isGanho = item.stage.toLowerCase().includes("ganho") || item.label.toLowerCase().includes("ganho");
    return {
      name: item.label,
      value: item.total,
      color: isGanho ? "#c8ff00" : FUNNEL_VENDAS_COLORS[i % FUNNEL_VENDAS_COLORS.length],
    };
  });

  // ── Hero executivo: calculado no BACKEND com as fontes canônicas (auditoria
  // item 8 — antes o front somava dados do /tracking e "Clientes" dava 0).
  const hero = marketing?.hero;
  const metaOn = !!marketing?.metaConfigured;

  return (
    <div className="space-y-6">
      {/* HERO EXECUTIVO — a jornada em números: investimento → lead → qualificado → venda */}
      <div>
        <SectionTitle hint="a jornada do investimento à venda">Visão geral</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-3">
          <HeroKpi label="Investimento" value={metaOn && hero ? formatCurrency(hero.investimento) : "—"} sub={metaOn ? "mídia no período" : "conecte o Meta"} big icon={Megaphone} />
          <HeroKpi label="Leads" value={hero ? fmtInt(hero.leadsCrm) : "—"} sub={metaOn && hero ? `${fmtInt(hero.leadsMeta)} pela mídia` : "no período"} icon={Users} />
          <HeroKpi label="CPL" value={hero?.cpl != null ? formatCurrency(hero.cpl) : "—"} sub="gasto ÷ leads da mídia" icon={Coins} />
          <HeroKpi label="Qualificados" value={hero ? fmtInt(hero.qualificados) : "—"} sub="negócios criados no período (inclui leads antigos)" icon={Filter} />
          <HeroKpi label="Vendas (mídia)" value={hero ? fmtInt(hero.vendasAtribuidas) : "—"} sub={hero?.cac != null ? `CAC ${formatCurrency(hero.cac)}` : "atribuídas a campanha"} accent={hero && hero.vendasAtribuidas > 0 ? "#c8ff00" : undefined} icon={Trophy} />
          <HeroKpi label="ROAS" value={hero?.roas != null ? `${hero.roas.toFixed(2)}x` : "—"} sub="receita atribuída ÷ gasto" accent={hero?.roas != null && hero.roas >= 1 ? "#c8ff00" : undefined} icon={TrendingUp} />
        </div>
        {!metaOn && (
          <div className="mt-3 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-3 text-[12px] text-white/40">
            Meta Ads não conectado — sem gasto/CPL/CPQ/CAC/ROAS. Configure o token + ad account no .env pra liberar a camada de otimização.
          </div>
        )}
      </div>

      {/* AQUISIÇÃO — de onde vem a demanda */}
      <SectionTitle hint="origem e evolução da captação">Aquisição</SectionTitle>
      {/* Row 2: Leads over time + Leads by channel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Leads ao Longo do Tempo"
            subtitle="Evolução diária de captação"
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
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={1.5}
                    fill="rgba(255,255,255,0.06)"
                    fillOpacity={1}
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

      {/* FUNIL */}
      <SectionTitle hint="pré-vendas e vendas">Funil</SectionTitle>
      {/* Row 3: Dois funis lado a lado */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funil de Pre-vendas (SDR)"
          subtitle="Coorte: só leads que ENTRARAM no período — por isso difere do card Qualificados acima, que conta todo negócio criado no período (inclui leads antigos)"
          loading={loadingMarketing}
          empty={funilPreVendas.length === 0}
          emptyText="Sem dados de pre-vendas no periodo."
        >
          <FunnelChart data={funilPreVendasData} />
        </ChartCard>

        <ChartCard
          title="Funil de Vendas"
          subtitle="Leads que atingiram cada etapa no periodo (por evento)"
          loading={loadingMarketing}
          empty={funilVendas.length === 0}
          emptyText="Sem dados de vendas no periodo."
        >
          <FunnelChart data={funilVendasData} />
        </ChartCard>
      </div>

      {/* CAMPANHAS · OTIMIZAÇÃO */}
      <SectionTitle hint="onde investir mais e onde cortar">Campanhas · otimização</SectionTitle>
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
                <span className="w-16 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Cliques ÷ impressões">
                  CTR
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
                  <span className={`w-16 text-[12px] font-medium text-right tabular-nums ${getCtrColor(ctrOf(camp.cliques, camp.impressoes))}`}>
                    {fmtPct(ctrOf(camp.cliques, camp.impressoes))}
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

      {/* CRIATIVOS · OTIMIZAÇÃO */}
      <SectionTitle hint="qual anúncio engancha e converte">Criativos · otimização</SectionTitle>
      {/* Row 5: Performance por Criativo */}
      <ChartCard
        title="Performance por Criativo"
        subtitle="Gancho e eficiência por anúncio: CTR, cliques, CPL e CPM (Meta Ads)"
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
            <div className="max-h-[440px] overflow-auto">
              <div className="min-w-[880px]">
                {/* Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06] sticky top-0 bg-[#16161c]/90 backdrop-blur">
                  <span className="flex-1 text-[10px] text-white/30 uppercase tracking-wider min-w-[160px]">Criativo</span>
                  <span className="w-24 text-[10px] text-white/30 uppercase tracking-wider text-right">Gasto</span>
                  <span className="w-16 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Cliques ÷ impressões — mede o gancho do criativo">CTR</span>
                  <span className="w-14 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Leads reportados pela Meta">Leads</span>
                  <span className="w-20 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Custo por lead (gasto ÷ leads Meta)">CPL</span>
                  <span className="w-20 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Custo por lead qualificado (movimentação no CRM)">CPLQ</span>
                  <span className="w-20 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Custo por cliente convertido (movimentação no CRM)">CAC</span>
                  <span className="w-16 text-[10px] text-white/30 uppercase tracking-wider text-right" title="Custo por mil impressões">CPM</span>
                </div>

                {/* Rows */}
                {porCriativo.map((criativo, i) => {
                  const ctr = ctrOf(criativo.cliques, criativo.impressoes);
                  const cpm = cpmOf(criativo.gasto, criativo.impressoes);
                  return (
                    <div key={i} className="flex items-center gap-2 py-2 border-b border-white/[0.04]">
                      <span className="flex-1 text-[12px] text-white/70 truncate min-w-[160px]" title={`${criativo.nome} · ${criativo.campanha}`}>
                        {criativo.nome}
                        <span className="block text-[10px] text-white/30 truncate">{criativo.campanha}</span>
                      </span>
                      <span className="w-24 text-[12px] text-white/50 text-right tabular-nums">{formatCurrency(criativo.gasto)}</span>
                      <span className={`w-16 text-[12px] font-medium text-right tabular-nums ${getCtrColor(ctr)}`}>{fmtPct(ctr)}</span>
                      <span className="w-14 text-[12px] text-white/60 text-right tabular-nums">{criativo.leads}</span>
                      <span className={`w-20 text-[12px] font-medium text-right tabular-nums ${getCplColor(criativo.cpl)}`}>{criativo.cpl !== null ? formatCurrency(criativo.cpl) : "—"}</span>
                      <span className="w-20 text-[12px] text-white/60 text-right tabular-nums" title={`${criativo.qualificados ?? 0} qualificados`}>{criativo.cpq != null ? formatCurrency(criativo.cpq) : "—"}</span>
                      <span className="w-20 text-[12px] text-white/60 text-right tabular-nums" title={`${criativo.clientes ?? 0} clientes`}>{criativo.cpc != null ? formatCurrency(criativo.cpc) : "—"}</span>
                      <span className="w-16 text-[12px] text-white/40 text-right tabular-nums">{cpm != null ? formatCurrency(cpm) : "—"}</span>
                    </div>
                  );
                })}
              </div>
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

      {/* ATRIBUIÇÃO & ORIGEM */}
      <SectionTitle hint="funil completo por campanha, origem, source e mídia">Atribuição & origem</SectionTitle>
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
        <span className={`w-14 ${head}`} title="Leads reportados pela Meta (campanhas pagas); CRM nas demais">Leads</span>
        <span className={`w-16 ${head}`}>Qualif.</span>
        <span className={`w-16 ${head}`}>Clientes</span>
        <span className={`w-16 ${head}`}>Conv.</span>
        {!compact && <span className={`w-24 ${head}`}>MRR real</span>}
        {!compact && showMeta && <span className={`w-24 ${head}`}>Gasto</span>}
        {!compact && showMeta && <span className={`w-20 ${head}`}>CPL</span>}
        {!compact && showMeta && <span className={`w-20 ${head}`} title="Custo por lead qualificado (movimentação no CRM)">CPLQ</span>}
        {!compact && showMeta && <span className={`w-20 ${head}`} title="Custo por cliente convertido (movimentação no CRM)">CAC</span>}
        {!compact && showMeta && <span className={`w-16 ${head}`}>ROAS</span>}
      </div>
      {rows.map((r, i) => {
        // Leads pagos vêm DIRETO da Meta; qualif/clientes são movimentação do CRM.
        const usaMeta = showMeta && r.leadsMeta != null;
        const leadsShown = usaMeta ? r.leadsMeta! : r.leads;
        return (
        <div key={i} className="flex items-center gap-2 py-2 border-b border-white/[0.04] min-w-max">
          <span className="flex-1 min-w-[140px] text-[12px] text-white/70 truncate" title={r.chave}>{r.chave}</span>
          <span className={`${cell} w-14 text-white/80 font-medium`} title={usaMeta ? `${r.leadsMeta} na Meta · ${r.leads} carregam a utm no CRM` : undefined}>{leadsShown}</span>
          <span className={`${cell} w-16 text-white/50`}>{r.qualificados}</span>
          <span className={`${cell} w-16`} style={{ color: "#c8ff00" }}>{r.clientes}</span>
          <span className={`${cell} w-16 ${r.taxaConversao >= 0.02 ? "text-emerald-400" : "text-white/40"}`}>{(r.taxaConversao * 100).toFixed(1)}%</span>
          {!compact && <span className={`${cell} w-24`} style={{ color: "#e23752" }}>{r.mrrReal > 0 ? formatCurrency(r.mrrReal) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-24 text-white/70`}>{r.gastoMeta != null ? formatCurrency(r.gastoMeta) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-20 text-white/60`}>{r.cpl != null ? formatCurrency(r.cpl) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-20 text-white/60`}>{r.cplq != null ? formatCurrency(r.cplq) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-20 text-white/60`}>{r.cac != null ? formatCurrency(r.cac) : "—"}</span>}
          {!compact && showMeta && <span className={`${cell} w-16 ${(r.roas ?? 0) >= 1 ? "text-emerald-400" : "text-white/40"}`}>{r.roas != null ? r.roas.toFixed(2) : "—"}</span>}
        </div>
        );
      })}
    </div>
  );
}

