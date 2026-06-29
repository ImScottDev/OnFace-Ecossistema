"use client";

import { useState } from "react";
import PeriodSelector from "./components/PeriodSelector";
import KpiBar from "./components/KpiBar";
import TabMarketing from "./components/TabMarketing";
import TabComercial from "./components/TabComercial";
import TabSdr from "./components/TabSdr";

const TABS = [
  { key: "sdr", label: "Pré-vendas (SDR)" },
  { key: "comercial", label: "Comercial" },
  { key: "marketing", label: "Marketing" },
];

const PRODUTOS = [
  { value: "todos", label: "Todos" },
  { value: "ai", label: "Callface AI" },
];

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState("30d");
  const [produto, setProduto] = useState("todos");
  const [tab, setTab] = useState("sdr");

  return (
    <div
      className="page-scroll space-y-6 p-4 lg:p-6"
      style={{ animation: "fadeUp 0.3s ease-out both" }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Relatórios
          </h1>
          <p className="text-[12px] text-white/40 hidden sm:block">
            Métricas de desempenho por período. Selecione o intervalo para ajustar os dados.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div
            className="inline-flex rounded-lg p-0.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {PRODUTOS.map((p) => (
              <button
                key={p.value}
                onClick={() => setProduto(p.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  produto === p.value
                    ? p.value === "pabx" ? "bg-[#8e27ef]/20 text-[#a855f7]"
                      : p.value === "ai" ? "bg-[#e23752]/20 text-[#e23752]"
                      : "bg-white/[0.08] text-white"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <PeriodSelector value={periodo} onChange={setPeriodo} />
        </div>
      </div>

      {/* KPI cards */}
      <KpiBar periodo={periodo} produto={produto} />

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-white/[0.06] text-white border-b-2 border-purple-500"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "sdr" && <TabSdr periodo={periodo} />}
      {tab === "comercial" && <TabComercial periodo={periodo} produto={produto} />}
      {tab === "marketing" && <TabMarketing periodo={periodo} />}
    </div>
  );
}
