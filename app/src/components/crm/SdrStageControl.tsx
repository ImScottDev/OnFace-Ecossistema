"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, PauseCircle, RotateCcw, ExternalLink } from "lucide-react";
import {
  SDR_STAGES,
  getSdrStatusInfo,
  negocioStatusToSdrMirror,
} from "@/lib/crm/pipeline";
import { AgendarReuniaoModal, type AgendarReuniaoPayload } from "@/components/crm/AgendarReuniaoModal";
import { DisqualifyReasonModal } from "@/components/crm/DisqualifyReasonModal";
import { DEFAULT_DISQUALIFY_REASONS } from "@/lib/crm/pipeline";

interface NegocioRef {
  id: string;
  status: string;
}

interface Props {
  leadId: string;
  nome: string;
  empresa?: string | null;
  sdrStatus?: string | null;
  responsavelId?: string | null;
  negocios?: NegocioRef[];
  onChanged?: () => void;
  onOpenNegocio?: (id: string) => void;
}

// Mesma decisão de coluna do board Pré-vendas: se já virou oportunidade, ESPELHA
// o status do negócio (read-only); senão usa o sdr_status.
function boardColumn(sdrStatus: string, negocioPrincipal?: NegocioRef): string {
  const s = sdrStatus || "pending";
  if (s === "disqualified") return "disqualified";
  if (negocioPrincipal) return negocioStatusToSdrMirror(negocioPrincipal.status);
  return s;
}

/**
 * Controle de estágio de Pré-vendas embutido na PÁGINA do lead (/leads/[id]).
 * Mostra em que etapa o lead está e permite avançar no funil com o MESMO fluxo do
 * board: mover Novo → Em Contato → Follow up, Qualificar (abre popup de agendamento
 * → converte em oportunidade), Desqualificar, Estagnar.
 */
export function SdrStageControl({ leadId, nome, empresa, sdrStatus, responsavelId, negocios, onChanged, onOpenNegocio }: Props) {
  const qc = useQueryClient();
  const [agendarOpen, setAgendarOpen] = useState(false);

  const negocioPrincipal = negocios?.find((n) => !["perdido", "no_show"].includes(n.status)) || negocios?.[0];
  const col = boardColumn(sdrStatus || "pending", negocioPrincipal);
  const info = getSdrStatusInfo(col);
  const isMirror = col.startsWith("m_"); // espelho do closer = read-only
  const isDisqualified = col === "disqualified";
  const isStagnant = ["sdr_sem_retorno", "sdr_sem_interesse", "sdr_retomar_depois"].includes(col);
  const isOpenFunnel = ["pending", "contacted", "qualifying"].includes(col);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["lead", leadId] });
    qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] });
    onChanged?.();
  };

  const [desqualificarOpen, setDesqualificarOpen] = useState(false);

  const mover = useMutation({
    mutationFn: async (arg: string | { status: string; motivoPerda: string; motivoPerdaDetalhe?: string }) => {
      const novoStatus = typeof arg === "string" ? arg : arg.status;
      const motivo = typeof arg === "string" ? null : arg;
      const r = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdrStatus: novoStatus,
          ...(motivo ? { motivoPerda: motivo.motivoPerda, motivoPerdaDetalhe: motivo.motivoPerdaDetalhe ?? null } : {}),
        }),
      });
      if (!r.ok) throw new Error("falha ao mover");
      return r.json();
    },
    onSuccess: () => { refetch(); toast.success("Etapa atualizada"); },
    onError: () => toast.error("Não foi possível mover o lead"),
  });

  const qualificar = useMutation({
    mutationFn: async (payload?: AgendarReuniaoPayload) => {
      const r = await fetch(`/api/leads/${leadId}/converter-oportunidade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      if (!r.ok) throw new Error("falha ao qualificar");
      return r.json();
    },
    onSuccess: () => {
      setAgendarOpen(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      toast.success("Lead qualificado: oportunidade criada no Pipeline.");
    },
    onError: () => toast.error("Não foi possível qualificar o lead"),
  });

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/50">Pré-vendas</h2>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${info.color}20`, color: info.color }}>
          {info.label}
        </span>
      </div>

      {isMirror && (
        <div className="space-y-2">
          <p className="text-[11px] text-white/40">Lead já qualificado. O avanço agora é do closer no Pipeline.</p>
          {negocioPrincipal && onOpenNegocio && (
            <button onClick={() => onOpenNegocio(negocioPrincipal.id)} className="flex items-center gap-1.5 text-xs text-[#e23752] hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Abrir oportunidade
            </button>
          )}
        </div>
      )}

      {(isDisqualified || isStagnant) && (
        <button
          onClick={() => mover.mutate("qualifying")}
          disabled={mover.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/[0.08] text-white/70 hover:text-white hover:border-[#3B82F6]/40 transition-colors disabled:opacity-40"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#3B82F6]" /> Reativar (volta pra Follow up)
        </button>
      )}

      {isOpenFunnel && (
        <>
          {/* Etapas lineares do funil */}
          <div className="flex gap-1.5">
            {SDR_STAGES.map((s) => {
              const atual = s.key === col;
              return (
                <button
                  key={s.key}
                  onClick={() => !atual && mover.mutate(s.key)}
                  disabled={mover.isPending || atual}
                  className={`flex-1 px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${atual ? "" : "text-white/60 hover:text-white border-white/[0.08] hover:border-white/20"}`}
                  style={atual ? { background: `${s.color}20`, color: s.color, borderColor: `${s.color}55` } : undefined}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Ações de saída (mesmo padrão da barra do board) */}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => setAgendarOpen(true)}
              disabled={qualificar.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E55" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Qualificar
            </button>
            <button
              onClick={() => mover.mutate("sdr_sem_retorno")}
              disabled={mover.isPending}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              style={{ background: "#8e27ef20", color: "#8e27ef", border: "1px solid #8e27ef55" }}
              title="Estagnar"
            >
              <PauseCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDesqualificarOpen(true)}
              disabled={mover.isPending}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40"
              style={{ background: "#EF444420", color: "#EF4444", border: "1px solid #EF444455" }}
              title="Desqualificar"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}

      {desqualificarOpen && (
        <DisqualifyReasonModal
          leadNome={empresa ? `${nome} — ${empresa}` : nome}
          reasons={DEFAULT_DISQUALIFY_REASONS}
          onClose={() => setDesqualificarOpen(false)}
          onConfirm={(motivoPerda, motivoPerdaDetalhe) => {
            mover.mutate({ status: "disqualified", motivoPerda, motivoPerdaDetalhe });
            setDesqualificarOpen(false);
          }}
        />
      )}

      <AgendarReuniaoModal
        open={agendarOpen}
        leadNome={nome}
        leadEmpresa={empresa}
        closerSugeridoId={responsavelId}
        onClose={() => setAgendarOpen(false)}
        onConfirm={(payload) => qualificar.mutate(payload)}
      />
    </div>
  );
}
