"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, GitBranch, CheckCircle2, XCircle, MinusCircle, Clock, Ban } from "lucide-react";
import { Cf2Badge } from "../ui/Badge";
import { Cf2EmptyState, Cf2ErrorState, Cf2Skeleton } from "../ui/States";

type StatusUnificado = "sucesso" | "erro" | "condicao_nao_atendida" | "retry_agendado" | "cancelado";

interface Execucao {
  id: string;
  tipo: "automacao" | "cadencia";
  nome: string;
  status: StatusUnificado;
  entityType: string;
  entityId: string;
  detalhe: string | null;
  executedAt: string;
}

const STATUS_INFO: Record<StatusUnificado, { label: string; icon: typeof CheckCircle2; variant: "success" | "danger" | "warning" | "neutral" }> = {
  sucesso: { label: "Sucesso", icon: CheckCircle2, variant: "success" },
  erro: { label: "Erro", icon: XCircle, variant: "danger" },
  condicao_nao_atendida: { label: "Condição não atendida", icon: MinusCircle, variant: "warning" },
  retry_agendado: { label: "Retry agendado", icon: Clock, variant: "warning" },
  cancelado: { label: "Cancelado", icon: Ban, variant: "neutral" },
};

const FILTROS: Array<{ key: StatusUnificado | "todas"; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "sucesso", label: "Sucesso" },
  { key: "erro", label: "Erro" },
  { key: "condicao_nao_atendida", label: "Condição não atendida" },
  { key: "retry_agendado", label: "Retry agendado" },
  { key: "cancelado", label: "Cancelado" },
];

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Automações → Execuções (19/08) — 1ª tela cross-cutting de observabilidade.
 * Antes só existia histórico por-regra dentro do card de cada automação;
 * aqui juntamos `automacao_execucoes` + `cadence_enrollment_events` (dado
 * real, sem mock) num único feed ordenado por data, com filtro por status.
 */
export function Cf2ExecucoesWorkspace() {
  const [filtro, setFiltro] = useState<StatusUnificado | "todas">("todas");

  const { data, isLoading, isError } = useQuery<Execucao[]>({
    queryKey: ["cf2-automacoes-execucoes", filtro],
    queryFn: async () => {
      const url = filtro === "todas" ? "/api/automacoes/execucoes" : `/api/automacoes/execucoes?status=${filtro}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("Falha ao carregar execuções");
      return r.json();
    },
  });

  const execucoes = data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Execuções</p>
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>
          Últimas execuções de automações (Fluxos) e cadências, juntas — visão real, sem simular dado.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const ativo = filtro === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
              style={{
                background: ativo ? "var(--cf2-bg-inverse)" : "var(--cf2-bg-surface)",
                color: ativo ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)",
                border: "1px solid var(--cf2-border-default)",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Cf2Skeleton className="h-14 rounded-2xl" />
          <Cf2Skeleton className="h-14 rounded-2xl" />
          <Cf2Skeleton className="h-14 rounded-2xl" />
        </div>
      ) : isError ? (
        <Cf2ErrorState />
      ) : execucoes.length === 0 ? (
        <Cf2EmptyState title="Nenhuma execução encontrada" description="Ainda não há registros de execução para esse filtro." />
      ) : (
        <div className="flex flex-col gap-2">
          {execucoes.map((e) => {
            const s = STATUS_INFO[e.status] || { label: e.status, icon: MinusCircle, variant: "neutral" as const };
            const Icon = s.icon;
            const TipoIcon = e.tipo === "automacao" ? Zap : GitBranch;
            return (
              <div
                key={`${e.tipo}-${e.id}`}
                className="p-4 rounded-2xl flex items-center gap-3"
                style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
              >
                <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: "var(--cf2-bg-inverse)" }}>
                  <TipoIcon className="w-4 h-4 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Cf2Badge variant={e.tipo === "automacao" ? "accent" : "neutral"}>
                      {e.tipo === "automacao" ? "Automação" : "Cadência"}
                    </Cf2Badge>
                    <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{e.nome}</p>
                  </div>
                  <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--cf2-text-tertiary)" }}>
                    {e.entityType} · {e.entityId}
                    {e.detalhe ? ` — ${e.detalhe}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{
                      color: s.variant === "success" ? "var(--cf2-success-text)"
                        : s.variant === "danger" ? "var(--cf2-danger-text)"
                        : s.variant === "warning" ? "var(--cf2-warning-text)"
                        : "var(--cf2-text-tertiary)",
                    }}
                  />
                  <Cf2Badge variant={s.variant}>{s.label}</Cf2Badge>
                </div>

                <p className="text-[11px] shrink-0 w-10 text-right" style={{ color: "var(--cf2-text-tertiary)" }}>{timeAgo(e.executedAt)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
