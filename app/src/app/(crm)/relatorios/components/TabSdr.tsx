"use client";

import { useQuery } from "@tanstack/react-query";
import { ChartCard } from "./charts/ChartCard";
import { FunnelChart } from "@/components/crm/FunnelChart";

interface FunilStage {
  stage: string;
  label: string;
  total: number;
}

interface PorResponsavel {
  usuarioId: string;
  nome: string;
  role: string;
  total: number;
  novo: number;
  emContato: number;
  qualificando: number;
  qualificado: number;
  desqualificado: number;
  taxaQualificacao: number;
}

interface SdrEsteiraData {
  funil: FunilStage[];
  desqualificado: number;
  totalEsteira: number;
  trabalhados: number;
  taxaContato: number;
  taxaQualificacao: number;
  porResponsavel: PorResponsavel[];
}

const FUNIL_COLORS: Record<string, string> = {
  Novo: "#6B7280",
  "Em contato": "#3B82F6",
  Qualificando: "#F59E0B",
  Qualificado: "#10B981",
};

function getFunilColor(label: string): string {
  return FUNIL_COLORS[label] ?? "#6B7280";
}

export default function TabSdr({ periodo }: { periodo: string }) {
  const { data, isLoading } = useQuery<SdrEsteiraData>({
    queryKey: ["sdr-esteira", periodo],
    queryFn: () =>
      fetch(`/api/relatorios/sdr-esteira?periodo=${periodo}`).then((r) => r.json()),
  });

  const funilChartData =
    data?.funil.map((f) => ({
      name: f.label,
      value: f.total,
      color: getFunilColor(f.label),
    })) ?? [];

  const qualificados =
    data?.funil.find((f) => f.label === "Qualificado")?.total ??
    data?.funil[data.funil.length - 1]?.total ??
    0;

  const isEmpty = !isLoading && (data?.totalEsteira ?? 0) === 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Mini KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
          style={{ animation: "fadeUp 0.3s ease-out both" }}
        >
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
            Na esteira
          </p>
          <p className="text-2xl font-bold text-white mt-2" style={{ fontFamily: "var(--font-heading)" }}>
            {isLoading ? "..." : data?.totalEsteira ?? 0}
          </p>
          <p className="text-[10px] text-white/25 mt-1">Total de leads na pré-venda</p>
        </div>

        <div
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
          style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.05s" }}
        >
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
            Trabalhados
          </p>
          <p className="text-2xl font-bold text-white mt-2" style={{ fontFamily: "var(--font-heading)" }}>
            {isLoading ? "..." : data?.trabalhados ?? 0}
          </p>
          <p className="text-[10px] text-white/25 mt-1">
            {isLoading ? "" : `${data?.taxaContato ?? 0}% contatados`}
          </p>
        </div>

        <div
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
          style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.1s" }}
        >
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
            Qualificados
          </p>
          <p className="text-2xl font-bold mt-2" style={{ color: "#10B981", fontFamily: "var(--font-heading)" }}>
            {isLoading ? "..." : qualificados}
          </p>
          <p className="text-[10px] text-white/25 mt-1">
            {isLoading ? "" : `${data?.taxaQualificacao ?? 0}% de qualificação`}
          </p>
        </div>

        <div
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
          style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.15s" }}
        >
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
            Desqualificados
          </p>
          <p className="text-2xl font-bold mt-2" style={{ color: "#EF4444", fontFamily: "var(--font-heading)" }}>
            {isLoading ? "..." : data?.desqualificado ?? 0}
          </p>
          <p className="text-[10px] text-white/25 mt-1">Fora do processo</p>
        </div>
      </div>

      {/* Row 2: Funil de pré-qualificação */}
      <ChartCard
        title="Funil de pré-qualificação"
        subtitle="Volume de leads por estágio da esteira SDR"
        loading={isLoading}
        empty={isEmpty || funilChartData.length === 0}
        emptyText="Nenhum lead na esteira no período selecionado"
        delay={0.18}
      >
        <FunnelChart data={funilChartData} />
      </ChartCard>

      {/* Row 3: Por SDR / responsável */}
      <div
        className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
        style={{ animation: "fadeUp 0.3s ease-out both", animationDelay: "0.24s" }}
      >
        <div className="px-4 pt-4 pb-2">
          <h3
            className="text-sm font-semibold text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Por SDR / responsável
          </h3>
          <p className="text-[11px] text-white/40">Distribuição de leads e taxa de qualificação por agente</p>
        </div>

        {isLoading ? (
          <div className="px-4 py-8 text-center text-white/30 text-sm">Carregando...</div>
        ) : isEmpty || (data?.porResponsavel ?? []).length === 0 ? (
          <div className="px-4 py-8 text-center text-white/30 text-sm">
            Nenhum responsável encontrado no período
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-y border-white/[0.06] text-[10px] uppercase tracking-wider text-white/40">
                  <th className="text-left font-medium px-4 py-2.5">Responsável</th>
                  <th className="text-right font-medium px-3 py-2.5">Na esteira</th>
                  <th className="text-right font-medium px-3 py-2.5">Em contato</th>
                  <th className="text-right font-medium px-3 py-2.5">Qualificando</th>
                  <th className="text-right font-medium px-3 py-2.5">Qualificado</th>
                  <th className="text-right font-medium px-3 py-2.5">Desqualificado</th>
                  <th className="text-right font-medium px-4 py-2.5">Taxa qualif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(data?.porResponsavel ?? []).map((r) => (
                  <tr key={r.usuarioId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-white/80 font-medium truncate max-w-[160px]">
                      {r.nome}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white/70">{r.total}</td>
                    <td className="px-3 py-2.5 text-right" style={{ color: "#3B82F6" }}>
                      {r.emContato}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ color: "#F59E0B" }}>
                      {r.qualificando}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold" style={{ color: "#10B981" }}>
                      {r.qualificado}
                    </td>
                    <td className="px-3 py-2.5 text-right text-white/40">{r.desqualificado}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className="font-semibold"
                        style={{
                          color:
                            r.taxaQualificacao >= 30
                              ? "#10B981"
                              : r.taxaQualificacao > 0
                              ? "#F59E0B"
                              : "rgba(255,255,255,0.3)",
                        }}
                      >
                        {r.taxaQualificacao}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
