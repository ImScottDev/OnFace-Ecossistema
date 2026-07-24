"use client";

import { useState } from "react";
import TabMarketing from "./components/TabMarketing";
import TabMidiaPaga from "./components/TabMidiaPaga";
import TabComercial from "./components/TabComercial";
import TabComercialCloser from "./components/TabComercialCloser";
import TabSdr from "./components/TabSdr";
import TabGrowth from "./components/TabGrowth";
import PeriodSelector from "./components/PeriodSelector";
import { useMe } from "@/lib/useMe";
import { isAdminView } from "@/lib/auth/roles";

const TABS = [
  { key: "sdr", label: "Pré-vendas (SDR)" },
  { key: "comercial", label: "Comercial" },
  { key: "growth", label: "Growth" },
  { key: "marketing", label: "Marketing" },
  { key: "midia-paga", label: "Mídia Paga" },
];

export default function RelatoriosPage() {
  // Papel EFETIVO (respeita view-as) decide a visão. Segurança real é no backend.
  const { data: me, isLoading: meLoading } = useMe();
  const role = me?.role ?? "";
  const isSdr = role === "sdr";
  const isCloser = role === "closer" || role === "vendedor";
  const fullView = isAdminView(role) || role === "leitor";

  // Período compartilhado por todas as abas (trocar de aba mantém o range escolhido).
  // Trava em HISTORICO_CONFIAVEL_DESDE (lib/relatorios/periodo.ts) — dados anteriores
  // à migração do Zoho (12/06/2026) não são confiáveis.
  const [periodo, setPeriodo] = useState("mes_atual");
  const [tab, setTab] = useState("comercial");
  // Visão pessoal (closer/sdr): aba própria; SDR abre em pré-vendas, closer em desempenho.
  const [ptab, setPtab] = useState<string | null>(null);
  const isPersonal = isCloser || isSdr;
  const personalTab = ptab ?? (isSdr ? "sdr" : "comercial");

  return (
    <div className="page-scroll space-y-6 p-4 lg:p-6" style={{ animation: "fadeUp 0.3s ease-out both" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
            {isCloser ? "Meu desempenho" : "Relatórios"}
          </h1>
          <p className="text-[12px] text-white/40 hidden sm:block">
            {isCloser
              ? "Sua meta, seu funil e seus números no período."
              : "Métricas de desempenho por período. Selecione o intervalo para ajustar os dados."}
          </p>
        </div>
        {!meLoading && <PeriodSelector value={periodo} onChange={setPeriodo} />}
      </div>

      {meLoading ? (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-8 text-center text-[12px] text-white/40">
          Carregando…
        </div>
      ) : isPersonal ? (
        /* Closer e SDR acumulam os dois papéis: Meu desempenho (fechamento) + Pré-vendas (SDR) */
        <>
          <div className="flex overflow-x-auto border-b border-white/[0.06]">
            {[{ key: "comercial", label: "Meu desempenho" }, { key: "sdr", label: "Pré-vendas (SDR)" }].map((t) => (
              <button
                key={t.key}
                onClick={() => setPtab(t.key)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                  personalTab === t.key
                    ? "bg-white/[0.06] text-white border-b-2 border-purple-500"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {personalTab === "sdr" ? <TabSdr periodo={periodo} /> : <TabComercialCloser periodo={periodo} />}
        </>
      ) : (
        /* Admin / gerente / leitor: relatório completo */
        fullView && (
          <>
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
            {tab === "sdr" && <TabSdr periodo={periodo} />}
            {tab === "comercial" && <TabComercial periodo={periodo} />}
            {tab === "growth" && <TabGrowth periodo={periodo} />}
            {tab === "marketing" && <TabMarketing periodo={periodo} />}
            {tab === "midia-paga" && <TabMidiaPaga periodo={periodo} />}
          </>
        )
      )}
    </div>
  );
}
