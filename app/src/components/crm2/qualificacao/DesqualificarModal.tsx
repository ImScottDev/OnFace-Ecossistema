"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";

/**
 * Modal de desqualificação / pausa de lead (01/09, spec do Kauã).
 *
 * Antes disso, desqualificar era um clique seco no menu do drawer: gravava
 * `sdr_status='disqualified'` e pronto — sem motivo, sem tag, sem observação e
 * sem nenhuma forma de o lead voltar. Motivo de perda ficava em branco, o que
 * torna qualquer análise de "por que perdemos" impossível.
 *
 * O motivo é que DECIDE o destino, em vez de existir uma coluna nova por
 * motivo (item 8 da spec: "não criar novas colunas principais agora"). Os três
 * buckets de destino já existiam no domínio e são reaproveitados como estão.
 *
 * Data de retomada NÃO virou coluna nova: vira uma `tarefas` real com
 * vencimento na data escolhida. Assim ela aparece na lista de tarefas da SDR e
 * na timeline do lead, em vez de ficar num campo que ninguém olha.
 */

export interface MotivoDesqualificacao {
  value: string;
  label: string;
  /** sdr_status de destino — todos já existentes no board. */
  destino: "disqualified" | "sdr_sem_retorno" | "sdr_retomar_depois";
  /** Motivo que pede data de retomada obrigatória. */
  pedeRetomada?: boolean;
}

export const MOTIVOS_DESQUALIFICACAO: MotivoDesqualificacao[] = [
  { value: "sem_resposta", label: "Sem resposta após tentativas", destino: "sdr_sem_retorno" },
  { value: "nutricao", label: "Nutrição / retomar depois", destino: "sdr_retomar_depois", pedeRetomada: true },
  { value: "sem_fit", label: "Sem fit (fora do ICP)", destino: "disqualified" },
  { value: "sem_budget", label: "Sem budget", destino: "disqualified" },
  { value: "sem_interesse", label: "Sem interesse", destino: "disqualified" },
  { value: "concorrente", label: "Ficou com concorrente", destino: "disqualified" },
  { value: "contato_invalido", label: "Contato inválido / duplicado", destino: "disqualified" },
];

interface Label { id: string; nome: string; cor: string }

export function Cf2DesqualificarModal({
  leadId, leadNome, open, onClose, onDone,
}: {
  leadId: string | null;
  leadNome?: string | null;
  open: boolean;
  onClose: () => void;
  /** Chamado após sucesso — o board revalida a lista por fora. */
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [retomarEm, setRetomarEm] = useState("");
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);

  const motivoDef = MOTIVOS_DESQUALIFICACAO.find((m) => m.value === motivo) || null;
  const pedeRetomada = !!motivoDef?.pedeRetomada;

  const { data: labels = [] } = useQuery<Label[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const r = await fetch("/api/labels");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open,
  });

  function reset() {
    setMotivo(""); setObservacao(""); setRetomarEm(""); setTagsSelecionadas([]);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!leadId || !motivoDef) throw new Error("Motivo obrigatório");

      // 1) etapa + motivo + detalhe. `motivoPerda`/`motivoPerdaDetalhe` já
      //    existiam como colunas de `leads` e nunca eram preenchidas no fluxo
      //    de pré-vendas — só no de negócio perdido.
      const r = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sdrStatus: motivoDef.destino,
          motivoPerda: motivoDef.label,
          motivoPerdaDetalhe: observacao.trim() || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || "Não foi possível registrar");
      }

      // 2) tags — endpoint que a Página Completa já usa, um POST por tag.
      for (const labelId of tagsSelecionadas) {
        await fetch(`/api/leads/${leadId}/labels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labelId }),
        }).catch(() => null);
      }

      // 3) retomada como tarefa real, não como campo escondido.
      if (pedeRetomada && retomarEm) {
        await fetch("/api/tarefas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId,
            titulo: `Retomar lead${leadNome ? `: ${leadNome}` : ""}`,
            descricao: observacao.trim() || motivoDef.label,
            // `tipo` é obrigatório no createTarefaSchema — follow_up é o que
            // descreve retomada de nutrição.
            tipo: "follow_up",
            dataVencimento: retomarEm,
          }),
        }).catch(() => null);
      }
    },
    onSuccess: () => {
      toast.success(pedeRetomada ? "Lead pausado para retomada." : "Lead desqualificado.");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      reset();
      onDone?.();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao registrar"),
  });

  if (!open || !leadId) return null;

  const podeSalvar = !!motivoDef && (!pedeRetomada || !!retomarEm) && !salvar.isPending;

  function handleClose() { reset(); onClose(); }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={handleClose}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)" }}>Desqualificar lead</p>
          <button onClick={handleClose} aria-label="Fechar"><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Motivo *</span>
          <select
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setRetomarEm(""); }}
            className="px-3 py-2 rounded-lg text-[13px] outline-none"
            style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          >
            <option value="">Selecionar...</option>
            {MOTIVOS_DESQUALIFICACAO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {motivoDef && (
            <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
              {motivoDef.destino === "disqualified" && "Vai para Desqualificado."}
              {motivoDef.destino === "sdr_sem_retorno" && "Vai para Sem resposta, continua no funil auxiliar."}
              {motivoDef.destino === "sdr_retomar_depois" && "Vai para Nutrição/Retomar depois e gera tarefa na data escolhida."}
            </p>
          )}
        </div>

        {pedeRetomada && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Retomar em *</span>
            <input
              type="date" aria-label="Data"
              value={retomarEm}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setRetomarEm(e.target.value)}
              className="px-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            />
          </div>
        )}

        {labels.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => {
                const ativa = tagsSelecionadas.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={ativa}
                    onClick={() => setTagsSelecionadas((prev) => ativa ? prev.filter((x) => x !== l.id) : [...prev, l.id])}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{
                      background: ativa ? l.cor : "var(--cf2-bg-canvas)",
                      color: ativa ? "#fff" : "var(--cf2-text-secondary)",
                      border: `1px solid ${ativa ? l.cor : "var(--cf2-border-default)"}`,
                    }}
                  >
                    {l.nome}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Observação</span>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="O que aconteceu, o que a pessoa disse, o que checar na retomada"
            className="px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
            style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={handleClose} className="px-3 py-2 text-[13px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button
            onClick={() => podeSalvar && salvar.mutate()}
            disabled={!podeSalvar}
            className="px-4 py-2 rounded-xl text-[13px] font-bold disabled:opacity-40"
            style={{ background: "var(--cf2-danger, #dc2626)", color: "#fff" }}
          >
            {salvar.isPending ? "Registrando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
