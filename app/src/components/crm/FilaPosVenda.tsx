"use client";

/**
 * Fila de entrega do pós-venda — componente único das três trilhas
 * (Onboarding, Implantação PABX, Implantação White Label) e da fila de
 * validação manual. O que muda entre elas é configuração, não código: por
 * isso não existem três telas quase iguais pra manter em sincronia.
 *
 * Escrito no padrão visual do CRM atual (Tailwind + tokens já usados no
 * Pipeline/Onboarding legado) de propósito: não traz o design system do
 * CRM 2.0 nem dependência nova pra produção. Quando o CRM2 subir, esta tela
 * é substituída — as tabelas e a API continuam as mesmas.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export type Trilha = "onboarding" | "implantacao_pabx" | "implantacao_white_label" | "validacao_manual";

interface Item {
  id: string;
  status: string;
  serviceFamily: string;
  cliente: string;
  produto: string | null;
  responsavelNome: string | null;
  startedAt: string | null;
  targetAt: string | null;
  total: number;
  concluidos: number;
  bloqueados: number;
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  WAITING_CUSTOMER: "Aguardando cliente",
  BLOCKED_CUSTOMER: "Bloqueado — cliente",
  BLOCKED_INTERNAL: "Bloqueado — interno",
  BLOCKED_PROVIDER: "Bloqueado — fornecedor",
  READY_FOR_VALIDATION: "Pronto p/ validação",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};

const STATUS_COR: Record<string, string> = {
  NOT_STARTED: "#8899a6",
  IN_PROGRESS: "#06B6D4",
  WAITING_CUSTOMER: "#EAB308",
  BLOCKED_CUSTOMER: "#e23752",
  BLOCKED_INTERNAL: "#e23752",
  BLOCKED_PROVIDER: "#e23752",
  READY_FOR_VALIDATION: "#8e27ef",
  COMPLETED: "#c8ff00",
  CANCELED: "#5a6570",
};

export function FilaPosVenda({
  trilha,
  titulo,
  subtitulo,
}: {
  trilha: Trilha;
  titulo: string;
  subtitulo: string;
}) {
  const [busca, setBusca] = useState("");
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);

  const { data, isLoading } = useQuery<{ items: Item[] }>({
    queryKey: ["pos-venda", trilha, mostrarConcluidos],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillments?trilha=${trilha}${mostrarConcluidos ? "&concluidos=1" : ""}`);
      if (!r.ok) throw new Error("falha ao carregar a fila");
      return r.json();
    },
  });

  const items = (data?.items || []).filter((i) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return [i.cliente, i.produto, i.responsavelNome].some((s) => s?.toLowerCase().includes(q));
  });

  const bloqueados = items.filter((i) => i.bloqueados > 0).length;

  return (
    <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
              {titulo}
            </h1>
            <p className="text-[12px] text-white/40 hidden sm:block">{subtitulo}</p>
          </div>
          <div className="flex items-baseline gap-2 shrink-0">
            <span className="text-lg font-bold text-[#e23752]">{items.length}</span>
            <span className="text-xs text-white/30 hidden sm:inline">na fila</span>
          </div>
          {bloqueados > 0 && (
            <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg bg-[#e23752]/10">
              <AlertTriangle className="w-3.5 h-3.5 text-[#e23752]" />
              <span className="text-xs font-semibold text-[#e23752]">{bloqueados} com bloqueio</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarConcluidos((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs border transition-colors ${
              mostrarConcluidos
                ? "bg-white/[0.08] border-white/[0.15] text-white"
                : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/70"
            }`}
          >
            Concluídos
          </button>
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
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <p className="text-sm text-white/30 p-4">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <CheckCircle2 className="w-8 h-8 text-white/15" />
            <p className="text-sm text-white/30">Nenhuma entrega nesta fila.</p>
            <p className="text-xs text-white/20">
              Cada negócio ganho gera uma entrega automaticamente, roteada pela família do produto.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {items.map((i) => {
              const pct = i.total > 0 ? Math.round((i.concluidos / i.total) * 100) : 0;
              const cor = STATUS_COR[i.status] || "#8899a6";
              return (
                <Link
                  key={i.id}
                  href={`/pos-venda/${i.id}`}
                  className="block rounded-2xl p-4 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{i.cliente}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: `${cor}15`, color: cor }}
                        >
                          {STATUS_LABEL[i.status] || i.status}
                        </span>
                        {i.bloqueados > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e23752]/15 text-[#e23752] shrink-0">
                            {i.bloqueados} bloqueio{i.bloqueados > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {i.produto && <p className="text-[11px] text-white/35 mt-1 truncate">{i.produto}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-white/30">
                        <span>{i.responsavelNome || "sem responsável"}</span>
                        {i.startedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(i.startedAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right w-28">
                      <p className="text-sm font-bold text-white">
                        {i.concluidos}
                        <span className="text-white/30 font-normal">/{i.total}</span>
                      </p>
                      <p className="text-[10px] text-white/30 mb-1.5">etapas</p>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#c8ff00" : "#06B6D4" }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
