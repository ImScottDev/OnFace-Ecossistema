"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { ChartCard } from "./charts/ChartCard";
import { DonutChart } from "./charts/DonutChart";
import { GaugeChart } from "./charts/GaugeChart";

interface TabComercialProps {
  produto?: string;
  periodo: string;
}

const COLORS = ["#e23752", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#06B6D4", "#EC4899"];

const darkTooltip = {
  contentStyle: {
    background: "rgba(15,15,20,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    fontSize: 12,
    color: "#fff",
  },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
};

interface PipelineMrrItem {
  status: string;
  mrrTotal: string | number;
  projetoTotal: string | number;
  total: number;
}

interface MotivoPerda {
  motivo: string;
  count: number;
}

interface ComercialData {
  pipelineMrr: PipelineMrrItem[];
  winRate: number;
  motivosPerda: MotivoPerda[];
  cicloMedio: number | null;
  negociosAbertos: number;
}

interface TendenciaItem {
  periodo: string;
  ganhos: number;
  perdidos: number;
  receita: number;
}

interface EquipeMembro {
  usuarioId: string;
  nome: string;
  ganhos: number;
  perdidos: number;
  winRate: number;
  receitaTotal: number;
  cicloMedio: number | null;
  leadsAtribuidos: number;
  atividadesTotal: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function TabComercial({ periodo, produto = "todos" }: TabComercialProps) {
  const { data: comercial, isLoading: loadingComercial } = useQuery<ComercialData>({
    queryKey: ["relatorios", "comercial", periodo, produto],
    queryFn: () => fetch(`/api/relatorios/comercial?periodo=${periodo}&produto=${produto}`).then((r) => r.json()),
  });

  const { data: tendencias, isLoading: loadingTendencias } = useQuery<{ data: TendenciaItem[] }>({
    queryKey: ["relatorios", "tendencias", "negocios", periodo],
    queryFn: () => fetch(`/api/relatorios/tendencias?periodo=${periodo}&tipo=negocios&produto=${produto}`).then((r) => r.json()),
  });

  interface FechadoMes {
    mes: string;
    ganhosPabx: number; ganhosAi: number; ganhosOutros: number;
    mrrPabx: number; mrrAi: number; mrrOutros: number;
    perdidos: number; fatStripe: number; fatPabx: number;
  }
  const { data: fechadoMensal, isLoading: loadingFechado } = useQuery<{ series: FechadoMes[] }>({
    queryKey: ["relatorios", "fechado-mensal", produto],
    queryFn: () => fetch(`/api/relatorios/fechado-mensal?meses=12&produto=${produto}`).then((r) => r.json()),
  });
  const fechadoSeries = fechadoMensal?.series ?? [];

  const { data: equipe, isLoading: loadingEquipe } = useQuery<{ membros: EquipeMembro[] }>({
    queryKey: ["relatorios", "equipe", periodo],
    queryFn: () => fetch(`/api/relatorios/equipe?periodo=${periodo}`).then((r) => r.json()),
  });

  // Derived values
  // Só o funil aberto do closer, na ordem do pipeline (estagnados/fechados ficam fora do gráfico)
  const openStatuses = ["reuniao_agendada", "reuniao_realizada", "proposta_apresentada", "negociacao_iniciada", "em_fechamento"];
  const pipelineTotal = comercial?.pipelineMrr
    ?.filter((item) => openStatuses.includes(item.status.toLowerCase()))
    .reduce((sum, item) => sum + (Number(item.mrrTotal) || 0) + (Number(item.projetoTotal) || 0), 0) ?? 0;

  const pipelineChartData = openStatuses
    .map((st) => comercial?.pipelineMrr?.find((item) => item.status.toLowerCase() === st))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      status: item.status,
      mrrTotal: Number(item.mrrTotal) || 0,
      projetoTotal: Number(item.projetoTotal) || 0,
    }));

  const motivosDonut = comercial?.motivosPerda?.map((m, i) => ({
    name: m.motivo,
    value: m.count,
    color: COLORS[i % COLORS.length],
  })) ?? [];

  const totalPerdidos = comercial?.motivosPerda?.reduce((sum, m) => sum + m.count, 0) ?? 0;

  const membrosOrdenados = [...(equipe?.membros ?? [])].sort((a, b) => b.ganhos - a.ganhos);
  const maxGanhos = membrosOrdenados.length > 0 ? Math.max(...membrosOrdenados.map((m) => m.ganhos), 1) : 1;

  const tendenciasData = tendencias?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Row 1: Mini KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
          style={{ animation: "fadeUp 0.3s ease-out both" }}
        >
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Pipeline Total</p>
          <p className="text-2xl font-bold text-white mt-2">
            {loadingComercial ? "..." : formatCurrency(pipelineTotal)}
          </p>
          <p className="text-[10px] text-white/25 mt-1">Soma dos negócios abertos</p>
        </div>

        <div
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
          style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.05s" }}
        >
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Negócios Abertos</p>
          <p className="text-2xl font-bold text-white mt-2">
            {loadingComercial ? "..." : comercial?.negociosAbertos ?? 0}
          </p>
          <p className="text-[10px] text-white/25 mt-1">Em andamento no pipeline</p>
        </div>

        <div
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
          style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.1s" }}
        >
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Win Rate</p>
          <p className="text-2xl font-bold text-white mt-2">
            {loadingComercial ? "..." : `${comercial?.winRate ?? 0}%`}
          </p>
          <p className="text-[10px] text-white/25 mt-1">Taxa de conversão geral</p>
        </div>

        <div
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
          style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.15s" }}
        >
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Ciclo Médio</p>
          <p className="text-2xl font-bold text-white mt-2">
            {loadingComercial ? "..." : comercial?.cicloMedio != null ? `${comercial.cicloMedio} dias` : "\u2014"}
          </p>
          <p className="text-[10px] text-white/25 mt-1">Tempo médio até fechamento</p>
        </div>
      </div>

      {/* Row 2: Pipeline + Win Rate */}
      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard
          title="Faturamento por Etapa"
          subtitle="Receita recorrente e avulsa por estágio do pipeline"
          loading={loadingComercial}
          empty={pipelineChartData.length === 0}
          className="lg:col-span-2"
          delay={0.1}
        >
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineChartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="status"
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`}
                />
                <Tooltip
                  {...darkTooltip}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    formatCurrency(Number(value)),
                    name === "mrrTotal" ? "Recorrente" : "Avulso",
                  ]}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-[11px] text-white/50">
                      {value === "mrrTotal" ? "Recorrente" : "Avulso"}
                    </span>
                  )}
                />
                <Bar
                  dataKey="mrrTotal"
                  stackId="a"
                  fill="#10B981"
                  radius={[0, 0, 0, 0]}
                  name="mrrTotal"
                />
                <Bar
                  dataKey="projetoTotal"
                  stackId="a"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                  name="projetoTotal"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Win Rate"
          loading={loadingComercial}
          empty={!comercial}
          className="lg:col-span-1"
          delay={0.15}
        >
          <GaugeChart
            value={comercial?.winRate ?? 0}
            label="taxa de conversão"
            target={30}
          />
        </ChartCard>
      </div>

      {/* Row 2.5: Fechado mês a mês — PABX × AI (pedido Scott 12/jun) */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="MRR Fechado Mês a Mês"
          subtitle="Negócios ganhos por produto — PABX × Callface AI"
          loading={loadingFechado}
          empty={fechadoSeries.length === 0}
          delay={0.18}
        >
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fechadoSeries} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="mes" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                <Tooltip
                  {...darkTooltip}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [
                    formatCurrency(Number(value)),
                    name === "mrrPabx" ? "PABX" : name === "mrrAi" ? "Callface AI" : "Outros",
                  ]}
                />
                <Legend formatter={(v: string) => (
                  <span className="text-[11px] text-white/50">{v === "mrrPabx" ? "PABX" : v === "mrrAi" ? "Callface AI" : "Outros"}</span>
                )} />
                <Bar dataKey="mrrPabx" stackId="m" fill="#8e27ef" name="mrrPabx" />
                <Bar dataKey="mrrAi" stackId="m" fill="#e23752" name="mrrAi" />
                <Bar dataKey="mrrOutros" stackId="m" fill="#6B7280" radius={[4, 4, 0, 0]} name="mrrOutros" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Ganhos × Perdidos por Mês"
          subtitle="Volume de fechamento — inclui faturamento real (faturas)"
          loading={loadingFechado}
          empty={fechadoSeries.length === 0}
          delay={0.18}
        >
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fechadoSeries.map((m) => ({ ...m, ganhos: m.ganhosPabx + m.ganhosAi + m.ganhosOutros }))} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="mes" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  {...darkTooltip}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [value, name === "ganhos" ? "Ganhos" : "Perdidos"]}
                />
                <Legend formatter={(v: string) => (
                  <span className="text-[11px] text-white/50">{v === "ganhos" ? "Ganhos" : "Perdidos"}</span>
                )} />
                <Bar dataKey="ganhos" fill="#c8ff00" radius={[4, 4, 0, 0]} name="ganhos" />
                <Bar dataKey="perdidos" fill="#EF4444" radius={[4, 4, 0, 0]} name="perdidos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Motivos de Perda + Performance Vendedor */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="Motivos de Perda"
          subtitle="Por que negócios são perdidos"
          loading={loadingComercial}
          empty={motivosDonut.length === 0}
          emptyText="Nenhum negócio perdido no período"
          delay={0.2}
        >
          <DonutChart
            data={motivosDonut}
            centerValue={String(totalPerdidos)}
            centerLabel="perdidos"
          />
        </ChartCard>

        <ChartCard
          title="Performance por Vendedor"
          subtitle="Negócios ganhos no período"
          loading={loadingEquipe}
          empty={membrosOrdenados.length === 0}
          emptyText="Nenhum membro da equipe encontrado"
          delay={0.25}
        >
          <div className="space-y-1">
            {membrosOrdenados.map((membro) => (
              <div key={membro.usuarioId}>
                <div className="flex items-center gap-3 py-2">
                  <span className="text-[12px] text-white/60 w-24 truncate">{membro.nome}</span>
                  <div className="flex-1 h-5 rounded-full bg-purple-500/20 overflow-hidden">
                    <div
                      className="h-5 rounded-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${(membro.ganhos / maxGanhos) * 100}%` }}
                    />
                  </div>
                  <span className="text-[12px] text-white/40 w-8 text-right">{membro.ganhos}</span>
                </div>
                <p className="text-[10px] text-white/25 pl-[108px]">
                  Win rate: {membro.winRate}%
                </p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 3.5: Desempenho detalhado por vendedor (pedido Scott) */}
      <div
        className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
        style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.27s" }}
      >
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-heading)" }}>Desempenho por Vendedor</h3>
          <p className="text-[11px] text-white/40">Leads recebidos, conversão e fechamento no período</p>
        </div>
        {loadingEquipe ? (
          <div className="px-4 py-8 text-center text-white/30 text-sm">Carregando...</div>
        ) : membrosOrdenados.length === 0 ? (
          <div className="px-4 py-8 text-center text-white/30 text-sm">Nenhum membro da equipe encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-y border-white/[0.06] text-[10px] uppercase tracking-wider text-white/40">
                  <th className="text-left font-medium px-4 py-2.5">Vendedor</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Leads atribuídos ao vendedor no período">Leads recebidos</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Negócios ganhos">Convertidos</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Convertidos ÷ leads recebidos">Conversão</th>
                  <th className="text-right font-medium px-3 py-2.5">Perdidos</th>
                  <th className="text-right font-medium px-3 py-2.5" title="Ganhos ÷ (ganhos + perdidos)">Win Rate</th>
                  <th className="text-right font-medium px-3 py-2.5">Receita</th>
                  <th className="text-right font-medium px-3 py-2.5 hidden md:table-cell">Ciclo médio</th>
                  <th className="text-right font-medium px-4 py-2.5 hidden lg:table-cell" title="Atividades registradas (ligações, emails, notas...)">Atividades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {membrosOrdenados.map((m) => {
                  const conversao = m.leadsAtribuidos > 0 ? Math.round((m.ganhos / m.leadsAtribuidos) * 1000) / 10 : null;
                  return (
                    <tr key={m.usuarioId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 text-white/80 font-medium truncate max-w-[160px]">{m.nome}</td>
                      <td className="px-3 py-2.5 text-right text-white/70">{m.leadsAtribuidos}</td>
                      <td className="px-3 py-2.5 text-right text-[#c8ff00] font-semibold">{m.ganhos}</td>
                      <td className="px-3 py-2.5 text-right text-white/70">{conversao != null ? `${conversao}%` : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-white/40">{m.perdidos}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span style={{ color: m.winRate >= 30 ? "#10B981" : m.winRate > 0 ? "#F59E0B" : "rgba(255,255,255,0.3)" }} className="font-semibold">
                          {m.winRate}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#e23752] font-semibold">{formatCurrency(m.receitaTotal)}</td>
                      <td className="px-3 py-2.5 text-right text-white/50 hidden md:table-cell">{m.cicloMedio != null ? `${m.cicloMedio}d` : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-white/50 hidden lg:table-cell">{m.atividadesTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 4: Negócios ao longo do tempo */}
      <ChartCard
        title="Negócios Ganhos ao Longo do Tempo"
        subtitle="Volume de fechamentos e receita por semana"
        loading={loadingTendencias}
        empty={tendenciasData.length === 0}
        emptyText="Dados insuficientes para o período selecionado"
        delay={0.3}
      >
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tendenciasData}>
              <defs>
                <linearGradient id="gradGanhos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPerdidos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e23752" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#e23752" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="periodo"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`}
              />
              <Tooltip
                {...darkTooltip}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  if (name === "receita") return [formatCurrency(Number(value)), "Receita"];
                  if (name === "ganhos") return [value, "Ganhos"];
                  return [value, "Perdidos"];
                }}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-[11px] text-white/50">
                    {value === "ganhos" ? "Ganhos" : value === "perdidos" ? "Perdidos" : "Receita"}
                  </span>
                )}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="ganhos"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#gradGanhos)"
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="perdidos"
                stroke="#EF4444"
                strokeWidth={1.5}
                fill="url(#gradPerdidos)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="receita"
                stroke="#e23752"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                fill="url(#gradReceita)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
