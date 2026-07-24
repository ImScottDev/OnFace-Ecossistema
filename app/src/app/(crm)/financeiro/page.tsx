"use client";

import { useState } from "react";
import { Search, Wallet } from "lucide-react";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { TabVisaoGeral } from "./components/TabVisaoGeral";
import { TabCobranca } from "./components/TabCobranca";
import { TabClientes } from "./components/TabClientes";
import { TabChurn } from "./components/TabChurn";
import { TabFaturas } from "./components/TabFaturas";
import { TabPabx } from "./components/TabPabx";

/**
 * FINANCEIRO — central de decisão financeira do SaaS (reforma 21/07).
 * 6 abas: Visão Geral (liderança bate o olho), Cobrança & Inadimplência (fila de
 * ação), Clientes & Assinaturas, Churn & Cancelamentos, Faturas (Stripe bruto),
 * PABX (Wevy, com data da última carga visível).
 * AI sincroniza via Stripe (webhook + polling 30min); PABX entra por planilha.
 */

const TABS = [
  { key: "visao", label: "Visão Geral" },
  { key: "cobranca", label: "Cobrança & Inadimplência" },
  { key: "clientes", label: "Clientes & Assinaturas" },
  { key: "churn", label: "Churn" },
  { key: "faturas", label: "Faturas" },
  { key: "pabx", label: "PABX" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function FinanceiroPage() {
  const [tab, setTab] = useState<TabKey>("visao");
  const [busca, setBusca] = useState("");
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);

  const mostraBusca = tab === "clientes" || tab === "faturas" || tab === "pabx";

  return (
    <div className="page-scroll space-y-4 p-4 lg:p-6" style={{ animation: "fadeUp 0.3s ease-out both" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#e23752]" />
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
              Financeiro
            </h1>
            <p className="text-[12px] text-white/40 hidden sm:block">
              Central financeira — AI via Stripe (tempo real), PABX via planilha Wevy.
            </p>
          </div>
        </div>
        {mostraBusca && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, email ou empresa..."
              className="pl-9 pr-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/50 w-56"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key
                ? `bg-white/[0.06] text-white border-b-2 ${t.key === "pabx" ? "border-[#8e27ef]" : "border-[#e23752]"}`
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "visao" && <TabVisaoGeral />}
      {tab === "cobranca" && <TabCobranca onOpenLead={setDrawerLeadId} />}
      {tab === "clientes" && <TabClientes busca={busca} onOpenLead={setDrawerLeadId} produto="ai" />}
      {tab === "churn" && <TabChurn onOpenLead={setDrawerLeadId} />}
      {tab === "faturas" && <TabFaturas busca={busca} onOpenLead={setDrawerLeadId} />}
      {tab === "pabx" && <TabPabx busca={busca} onOpenLead={setDrawerLeadId} />}

      <LeadDrawer leadId={drawerLeadId} open={!!drawerLeadId} onClose={() => setDrawerLeadId(null)} />
    </div>
  );
}
