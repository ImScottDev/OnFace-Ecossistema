"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "./charts/KpiCard";

interface KpiBarProps {
  produto?: string;
  periodo: string;
}

export default function KpiBar({ periodo, produto = "todos" }: KpiBarProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["relatorios-resumo", periodo, produto],
    queryFn: async () => {
      const res = await fetch(`/api/relatorios/resumo?periodo=${periodo}&produto=${produto}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 0.05, 0.1, 0.15].map((delay, i) => (
          <div
            key={i}
            className="rounded-xl bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-4 h-[108px] animate-pulse"
            style={{ animationDelay: `${delay}s` }}
          >
            <div className="h-3 w-16 bg-[var(--cf2-bg-surface-muted)] rounded mb-3" />
            <div className="h-7 w-24 bg-[var(--cf2-bg-surface-muted)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: "Novos Leads",
      value: String(data?.leads?.total ?? 0),
      delta: data?.leads?.delta ?? null,
      trend: data?.leads?.trend ?? [],
      color: "var(--cf2-accent)",
    },
    {
      label: "Pipeline",
      value: `R$ ${(data?.pipeline?.total ?? 0).toLocaleString("pt-BR")}`,
      delta: data?.pipeline?.delta ?? null,
      trend: data?.pipeline?.trend ?? [],
      color: "#8e27ef",
    },
    {
      label: "Win Rate",
      value: data?.winRate?.total != null ? `${data.winRate.total}%` : "n/a",
      delta: data?.winRate?.delta ?? null,
      trend: data?.winRate?.trend ?? [],
      color: "var(--cf2-success-text)",
    },
    {
      label: "MRR",
      value: `R$ ${(data?.mrr?.total ?? 0).toLocaleString("pt-BR")}`,
      delta: data?.mrr?.delta ?? null,
      trend: data?.mrr?.trend ?? [],
      color: "var(--cf2-accent)",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => (
        <KpiCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          delta={kpi.delta}
          trend={kpi.trend}
          color={kpi.color}
          delay={i * 0.05}
        />
      ))}
    </div>
  );
}
