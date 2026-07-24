"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { CHECKLIST_LABEL } from "@/lib/onboarding/checklist-config";

/**
 * Board de ONBOARDING (pós-ganho) — layout idêntico ao Pipeline (pedido Scott 12/jun).
 *   AI:   Aguardando Pagamento → Em Andamento → Concluído (sem Setup)
 *   PABX: Faturamento (Wevy) → Setup → Concluído
 * Card abre o NEGÓCIO no drawer (mesmo do Pipeline). O sync do Stripe move
 * "Aguardando Pagamento" sozinho quando o pagamento cai.
 */

const COLUNAS = [
  { key: "aguardando_pagamento", label: "Aguardando Pagamento", hint: "AI · checkout Stripe", color: "#EAB308" },
  { key: "faturamento", label: "Faturamento", hint: "PABX · financeiro Wevy", color: "#8e27ef" },
  { key: "setup", label: "Setup", hint: "PABX · montagem técnica", color: "#06B6D4" },
  { key: "em_andamento", label: "Em Andamento", hint: "AI · implantação", color: "#e23752" },
  { key: "concluido", label: "Concluído", hint: "vira Carteira", color: "#c8ff00" },
];

interface ChecklistItem {
  item: string;
  concluido: boolean;
  automatico?: boolean;
  dentroDoPrazo?: boolean;
}

interface Item {
  id: string;
  titulo: string;
  valorTotal: string | null;
  leadId: string | null;
  leadNome: string | null;
  empresaNome: string | null;
  stage: string;
  produto: string;
  checklist: ChecklistItem[];
}

const formatBRL = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: v >= 100000 ? 0 : 1 })}k`
    : `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

function initials(nome: string): string {
  const parts = nome.replace(/[|—-].*$/, "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export default function OnboardingPage() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ items: Item[] }>({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const r = await fetch("/api/onboarding?concluidos=1");
      if (!r.ok) throw new Error("falha ao carregar onboarding");
      return r.json();
    },
  });

  const mover = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const r = await fetch(`/api/onboarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!r.ok) throw new Error("falha ao mover");
      return r.json();
    },
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["onboarding"] });
      const prev = qc.getQueryData<{ items: Item[] }>(["onboarding"]);
      qc.setQueryData<{ items: Item[] }>(["onboarding"], (old) =>
        old ? { items: old.items.map((i) => (i.id === id ? { ...i, stage } : i)) } : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["onboarding"], ctx.prev);
      toast.error("Não foi possível mover o card");
    },
    onSuccess: (_d, vars) => {
      const col = COLUNAS.find((c) => c.key === vars.stage);
      toast.success(`Movido para ${col?.label || vars.stage}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const toggleChecklist = useMutation({
    mutationFn: async ({ id, item, concluido }: { id: string; item: string; concluido: boolean }) => {
      const r = await fetch(`/api/onboarding/${id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, concluido }),
      });
      if (!r.ok) throw new Error("falha ao atualizar checklist");
      return r.json();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const items = (data?.items || []).filter((i) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return [i.titulo, i.leadNome, i.empresaNome].some((s) => s?.toLowerCase().includes(q));
  });

  const ativos = items.filter((i) => i.stage !== "concluido").length;

  return (
    <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-hidden">
      {/* Header — mesmo padrão do Pipeline */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
              Onboarding
            </h1>
            <p className="text-[12px] text-white/40 hidden sm:block">
              Pós-venda: pagamento, faturamento e implantação. AI move sozinho via Stripe.
            </p>
          </div>
          <div className="flex items-baseline gap-2 shrink-0">
            <span className="text-lg font-bold text-[#e23752]">{ativos}</span>
            <span className="text-xs text-white/30 hidden sm:inline">em andamento</span>
          </div>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente..."
            className="pl-9 pr-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 outline-none focus:border-[#e23752]/50 w-44 sm:w-56"
          />
        </div>
      </div>

      {/* Board — colunas idênticas ao Pipeline */}
      <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-4 flex-1 min-h-0">
        {COLUNAS.map((col, colIdx) => {
          const cards = items.filter((i) => i.stage === col.key);
          const totalCol = cards.reduce((s, i) => s + (parseFloat(i.valorTotal || "0") || 0), 0);
          const isDragOver = dragOverStage === col.key;
          return (
            <div
              key={col.key}
              className="flex-shrink-0 w-[260px] sm:w-[280px] rounded-2xl flex flex-col max-h-full"
              style={{
                background: isDragOver ? `${col.color}08` : "rgba(255,255,255,0.02)",
                border: isDragOver ? `2px dashed ${col.color}` : "1px solid rgba(255,255,255,0.06)",
                animation: `fadeUp 0.3s ease-out ${colIdx * 0.05}s both`,
                transition: "background 0.2s ease, border 0.2s ease",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => { e.preventDefault(); setDragOverStage(col.key); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                const id = e.dataTransfer.getData("onboardingId");
                if (!id) return;
                if (col.key === "concluido") {
                  const item = items.find((i) => i.id === id);
                  const faltando = item?.checklist.filter((c) => !c.concluido) || [];
                  if (faltando.length > 0) {
                    toast.error(`Falta concluir: ${faltando.map((f) => CHECKLIST_LABEL[f.item] || f.item).join(", ")}`);
                    return;
                  }
                }
                mover.mutate({ id, stage: col.key });
              }}
            >
              {/* Column header */}
              <div className="px-3 pt-3 pb-2 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{col.label}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${col.color}15`, color: col.color }}
                  >
                    {cards.length}
                  </span>
                </div>
                <p className="text-sm font-bold mt-1.5 ml-[18px]" style={{ color: col.color }}>
                  {totalCol > 0 ? formatBRL(totalCol) : "R$ 0"}
                </p>
                <p className="text-[10px] text-white/25 ml-[18px]">{col.hint}</p>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0 scrollbar-thin">
                {isLoading && <p className="text-xs text-white/20 px-1">Carregando...</p>}
                {cards.map((i) => {
                  const valor = parseFloat(i.valorTotal || "0") || 0;
                  const nomeExib = i.empresaNome || i.leadNome || i.titulo;
                  return (
                    <div
                      key={i.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("onboardingId", i.id)}
                      onClick={() => setDrawerNegocioId(i.id)}
                      className="rounded-xl p-3 cursor-pointer group"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        transition: "border 0.15s ease, background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.border = `1px solid ${col.color}50`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)"; }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                          style={{ backgroundColor: `${col.color}18`, color: col.color }}
                        >
                          {initials(nomeExib)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/90 leading-snug truncate group-hover:text-white">
                            {i.titulo}
                          </p>
                          {(i.empresaNome || i.leadNome) && (
                            <p className="text-[11px] text-white/40 truncate mt-0.5">{i.empresaNome || i.leadNome}</p>
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                            i.produto === "pabx"
                              ? "bg-[#8e27ef]/15 text-[#a855f7]"
                              : i.produto === "ai_pabx"
                              ? "bg-[#06B6D4]/15 text-[#06B6D4]"
                              : "bg-[#e23752]/15 text-[#e23752]"
                          }`}
                        >
                          {i.produto === "pabx" ? "PABX" : i.produto === "ai_pabx" ? "AI+PABX" : "AI"}
                        </span>
                      </div>
                      {valor > 0 && (
                        <p className="text-[11px] text-[#c8ff00] mt-2 font-medium ml-[42px]">
                          R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      {col.key !== "concluido" && (
                        <div className="flex items-center gap-1.5 mt-2 ml-[42px] flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {i.checklist.map((c) => (
                            <button
                              key={c.item}
                              type="button"
                              disabled={c.automatico}
                              title={
                                c.automatico
                                  ? `${CHECKLIST_LABEL[c.item] || c.item} — automático (via ligações)${c.concluido && c.dentroDoPrazo === false ? ", fora do prazo de TTV" : ""}`
                                  : CHECKLIST_LABEL[c.item] || c.item
                              }
                              onClick={() => !c.automatico && toggleChecklist.mutate({ id: i.id, item: c.item, concluido: !c.concluido })}
                              className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${c.automatico ? "cursor-default" : "cursor-pointer"}`}
                              style={{
                                backgroundColor: c.concluido ? "#c8ff0022" : "rgba(255,255,255,0.05)",
                                color: c.concluido ? "#c8ff00" : "rgba(255,255,255,0.35)",
                                border: `1px solid ${c.concluido ? "#c8ff0044" : "rgba(255,255,255,0.08)"}${c.automatico ? "" : ""}`,
                                outline: c.automatico ? "1px dotted rgba(255,255,255,0.15)" : "none",
                                outlineOffset: 1,
                              }}
                            >
                              {CHECKLIST_LABEL[c.item] || c.item}{c.automatico ? " ⚡" : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!isLoading && cards.length === 0 && (
                  <p className="text-[11px] text-white/15 text-center py-6">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawers — mesmos do Pipeline */}
      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenLead={(id) => { setDrawerNegocioId(null); setDrawerLeadId(id); }}
        onOpenEmpresa={(id) => { setDrawerNegocioId(null); setDrawerEmpresaId(id); }}
      />
      <LeadDrawer
        leadId={drawerLeadId}
        open={!!drawerLeadId}
        onClose={() => setDrawerLeadId(null)}
      />
      <EmpresaDrawer
        empresaId={drawerEmpresaId}
        open={!!drawerEmpresaId}
        onClose={() => setDrawerEmpresaId(null)}
      />
    </div>
  );
}
