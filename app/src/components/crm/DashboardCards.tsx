"use client";

import { Users, Trophy, DollarSign, TrendingUp } from "lucide-react";

interface DashboardCardsProps {
  totalLeads: number;
  leadsGanhos: number;
  ticketMedio: number;
  receitaTotal: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function DashboardCards({ totalLeads, leadsGanhos, ticketMedio, receitaTotal }: DashboardCardsProps) {
  const cards = [
    { label: "Leads (30 dias)", value: totalLeads.toString(), icon: Users, gradient: "from-blue-500/20 to-blue-600/20", text: "text-blue-400" },
    { label: "Negócios Ganhos", value: leadsGanhos.toString(), icon: Trophy, gradient: "from-emerald-500/20 to-emerald-600/20", text: "text-emerald-400" },
    { label: "Ticket Médio", value: formatCurrency(ticketMedio), icon: DollarSign, gradient: "from-amber-500/20 to-amber-600/20", text: "text-amber-400" },
    { label: "Receita Total", value: formatCurrency(receitaTotal), icon: TrendingUp, gradient: "from-purple-500/20 to-purple-600/20", text: "text-purple-400" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5"
          style={{ animation: `fadeUp 0.3s ease-out ${i * 0.05}s both` }}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${card.gradient}`}>
              <card.icon className={`w-5 h-5 ${card.text}`} />
            </div>
            <div>
              <p className="text-xs text-white/40">{card.label}</p>
              <p className="text-xl font-bold text-white">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
