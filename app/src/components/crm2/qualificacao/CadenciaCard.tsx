"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, X, Clock, Pause, Play, RefreshCw } from "lucide-react";

interface CadenciaDef {
  id: string;
  nome: string;
  totalSteps: number;
}

interface CadenciaAtiva {
  enrollmentId: string;
  definitionId: string;
  definitionNome: string;
  status: string;
  stepIndex: number;
  totalSteps: number;
  proximaAcaoEm: string | null;
}

/**
 * "Adicionar à cadência" (pedido do Kauã 24/08, Página Completa do lead) —
 * mesmo Cadence Engine genérico e mesmos endpoints que Prospecção já usa
 * (`/api/prospeccao/cadencia/*`, namespace por ser onde o motor ganhou seu
 * 1º consumidor real, não é exclusivo de lead outbound — `entity_type='lead'`
 * vale pra qualquer origem). As cadências em si continuam sendo construídas
 * em Automações → Cadências; este card só matricula/acompanha/pausa/retoma/
 * cancela/troca.
 *
 * Achado real 25/08: `/prospeccao/cadencia/pausar` na verdade CANCELA (nome
 * mente) — pra pause/resume de verdade uso
 * `/automacoes/cadencias/enrollments/:id/action` (existe, sem restrição de
 * papel, só nunca tinha sido consumido por UI nenhuma até agora). Também
 * corrigido: `status==="paused"` antes caía no fallback de "nenhuma
 * cadência" e escondia o enrollment pausado — agora mostra o card com
 * "Retomar" em vez de sumir.
 */
export function Cf2CadenciaCard({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState("");
  const [trocando, setTrocando] = useState(false);

  const { data: cadencias = [] } = useQuery<CadenciaDef[]>({
    queryKey: ["prospeccao-cadencias-def"],
    queryFn: async () => {
      const r = await fetch("/api/prospeccao/cadencias");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data, isLoading } = useQuery<{ cadencia: CadenciaAtiva | null }>({
    queryKey: ["lead-cadencia-status", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/prospeccao/cadencia/status?leadId=${leadId}`);
      if (!r.ok) return { cadencia: null };
      return r.json();
    },
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["lead-cadencia-status", leadId] });

  const enroll = useMutation({
    mutationFn: async (cadenceDefinitionId: string) => {
      const r = await fetch("/api/prospeccao/cadencia/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [leadId], cadenceDefinitionId }),
      });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Lead adicionado à cadência");
      setSelecionada("");
      setTrocando(false);
      invalidar();
    },
    onError: () => toast.error("Não foi possível adicionar à cadência"),
  });

  const acao = useMutation({
    mutationFn: async ({ enrollmentId, action }: { enrollmentId: string; action: "pause" | "resume" | "cancel" }) => {
      const r = await fetch(`/api/automacoes/cadencias/enrollments/${enrollmentId}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: (_data, { action }) => {
      toast.success(action === "pause" ? "Cadência pausada" : action === "resume" ? "Cadência retomada" : "Removido da cadência");
      invalidar();
    },
    onError: () => toast.error("Não foi possível atualizar a cadência"),
  });

  const cadencia = data?.cadencia;
  // "paused" também é um enrollment "atual" — só cancelled/completed cai
  // pro fallback de "escolher cadência nova".
  const temEnrollmentAtual = cadencia && ["active", "waiting", "paused"].includes(cadencia.status);

  if (isLoading) return <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>;

  if (temEnrollmentAtual && cadencia && !trocando) {
    const pausada = cadencia.status === "paused";
    const pct = cadencia.totalSteps > 0 ? (cadencia.stepIndex / cadencia.totalSteps) * 100 : 0;
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{cadencia.definitionNome}</span>
            {pausada && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}>Pausada</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pausada ? (
              <button onClick={() => acao.mutate({ enrollmentId: cadencia.enrollmentId, action: "resume" })} disabled={acao.isPending} className="flex items-center gap-1 text-[12px] font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}>
                <Play className="w-3.5 h-3.5" /> Retomar
              </button>
            ) : (
              <button onClick={() => acao.mutate({ enrollmentId: cadencia.enrollmentId, action: "pause" })} disabled={acao.isPending} className="flex items-center gap-1 text-[12px] font-semibold disabled:opacity-40" style={{ color: "var(--cf2-text-secondary)" }}>
                <Pause className="w-3.5 h-3.5" /> Pausar
              </button>
            )}
            <button onClick={() => setTrocando(true)} className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>
              <RefreshCw className="w-3.5 h-3.5" /> Trocar
            </button>
            <button onClick={() => acao.mutate({ enrollmentId: cadencia.enrollmentId, action: "cancel" })} disabled={acao.isPending} className="flex items-center gap-1 text-[12px] font-semibold disabled:opacity-40" style={{ color: "var(--cf2-danger-text)" }}>
              <X className="w-3.5 h-3.5" /> Remover
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
          <span>Etapa {cadencia.stepIndex} de {cadencia.totalSteps}</span>
          {cadencia.proximaAcaoEm && !pausada && (
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" /> {new Date(cadencia.proximaAcaoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pausada ? "var(--cf2-text-tertiary)" : "var(--cf2-accent)" }} />
        </div>
      </div>
    );
  }

  if (cadencias.length === 0) {
    return <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma cadência configurada ainda em Automações → Cadências.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {trocando && (
        <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Escolher outra cadência remove a atual (<span style={{ color: "var(--cf2-text-secondary)" }}>{cadencia?.definitionNome}</span>) e matricula na nova.
        </p>
      )}
      <div className="flex items-center gap-2">
        <select
          value={selecionada}
          onChange={(e) => setSelecionada(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg text-[13px] outline-none"
          style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
        >
          <option value="">Escolher cadência...</option>
          {cadencias.map((cd) => (
            <option key={cd.id} value={cd.id}>{cd.nome} ({cd.totalSteps} toques)</option>
          ))}
        </select>
        <button
          onClick={async () => {
            if (!selecionada) return;
            if (trocando && cadencia) await acao.mutateAsync({ enrollmentId: cadencia.enrollmentId, action: "cancel" });
            enroll.mutate(selecionada);
          }}
          disabled={!selecionada || enroll.isPending || acao.isPending}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold disabled:opacity-40"
          style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
        >
          <Send className="w-3.5 h-3.5" /> {trocando ? "Trocar" : "Adicionar"}
        </button>
        {trocando && (
          <button onClick={() => setTrocando(false)} className="shrink-0 text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
        )}
      </div>
    </div>
  );
}
