"use client";

import { useQuery } from "@tanstack/react-query";
import { GitBranch, AlertTriangle } from "lucide-react";

interface Cadencia {
  id: string;
  nome: string;
  entityType: string;
  ativo: boolean;
  totalPassos: number;
  enrollmentsPorStatus: Record<string, number>;
}

const STATUS_LABEL: Record<string, string> = { active: "Ativas", waiting: "Aguardando", completed: "Concluídas", cancelled: "Canceladas", failed: "Falharam" };

/**
 * Automações → Cadências (19/08) — motor genérico real
 * (lib/cadencia/cadence-engine.ts: steps, branches, retry/backoff), hoje
 * com 1 consumidor real (Prospecção outbound). Achado de arquitetura
 * explícito (não escondido): existem 2 outros mecanismos de "sequência no
 * tempo" ainda não unificados a este motor — mostrado abaixo, não
 * fabricado como se já fosse tudo 1 engine só.
 */
export function Cf2CadenciasWorkspace() {
  const { data, isLoading } = useQuery<{ cadencias: Cadencia[]; mecanismosParalelos: { cadenciaSdrInboundExecucoes: number; aiSdrRetrySweep: string } }>({
    queryKey: ["cf2-automacoes-cadencias"],
    queryFn: async () => {
      const r = await fetch("/api/automacoes/cadencias");
      if (!r.ok) return { cadencias: [], mecanismosParalelos: { cadenciaSdrInboundExecucoes: 0, aiSdrRetrySweep: "" } };
      return r.json();
    },
  });

  const cadencias = data?.cadencias ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Cadências</p>
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Motor genérico de sequência no tempo (steps/branches/retry) — hoje usado pela Prospecção outbound.</p>
      </div>

      {isLoading ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
      ) : cadencias.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma cadência configurada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cadencias.map((cd) => (
            <div key={cd.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: "var(--cf2-bg-inverse)" }}>
                  <GitBranch className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{cd.nome}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{cd.totalPassos} passos · entidade: {cd.entityType} · {cd.ativo ? "ativa" : "inativa"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {Object.entries(cd.enrollmentsPorStatus).map(([status, n]) => (
                  <div key={status} className="text-center">
                    <p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{n}</p>
                    <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{STATUS_LABEL[status] || status}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.mecanismosParalelos && (data.mecanismosParalelos.cadenciaSdrInboundExecucoes > 0) && (
        <div className="p-4 rounded-2xl flex items-start gap-3" style={{ background: "var(--cf2-warning-bg)", border: "1px solid var(--cf2-warning-border)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--cf2-warning-text)" }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-warning-text)" }}>Mecanismos paralelos ainda não unificados a este motor</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
              Cadência SDR inbound (legado): {data.mecanismosParalelos.cadenciaSdrInboundExecucoes} execuções registradas em `cadencia_execucoes`.
              <br />
              Retry do AI SDR: {data.mecanismosParalelos.aiSdrRetrySweep}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
