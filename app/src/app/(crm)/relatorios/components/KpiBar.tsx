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
            className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 h-[108px] animate-pulse"
            style={{ animationDelay: `${delay}s` }}
          >
            <div className="h-3 w-16 bg-white/[0.06] rounded mb-3" />
            <div className="h-7 w-24 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: "Novos Leads",
      value: String(data?.leads?.total ?? 0),
      delta: data?.leads?.delta ?? 0,
      trend: data?.leads?.trend ?? [],
      color: "#e23752",
    },
    {
      label: "Pipeline",
      value: `R$ ${(data?.pipeline?.total ?? 0).toLocaleString("pt-BR")}`,
      delta: data?.pipeline?.delta ?? 0,
      trend: data?.pipeline?.trend ?? [],
      color: "#8e27ef",
    },
    {
      label: "Win Rate",
      value: `${data?.winRate?.total ?? 0}%`,
      delta: data?.winRate?.delta ?? 0,
      trend: data?.winRate?.trend ?? [],
      color: "#c8ff00",
    },
    {
      label: "MRR",
      value: `R$ ${(data?.mrr?.total ?? 0).toLocaleString("pt-BR")}`,
      delta: data?.mrr?.delta ?? 0,
      trend: data?.mrr?.trend ?? [],
      color: "#e23752",
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
