"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { TIPO_TAREFA_OPTIONS } from "@/components/crm/tarefas/TarefaFormModal";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";

/**
 * Criação de tarefa EM MASSA para oportunidades selecionadas (01/09, Frente 2A).
 *
 * Regra do Kauã, literal: "se eu selecionar 10 oportunidades e criar uma tarefa
 * de follow-up, o sistema deve criar 10 tarefas, uma vinculada a cada
 * oportunidade/negócio". Então é 1 POST por negócio — nunca uma tarefa só
 * apontando pra várias, que é o erro fácil aqui.
 *
 * Não reusei `TarefaFormModal` porque ele é single-entity por contrato
 * (`defaultNegocioId` singular, com busca de vínculo e edição). Forçar
 * multiplicidade nele mexeria num componente usado em 7+ lugares. Aqui só
 * reaproveito `TIPO_TAREFA_OPTIONS` (mesma taxonomia, sem duplicar lista) e o
 * mesmo endpoint `POST /api/tarefas`.
 */
export function BulkTarefaModal({
  open, negocioIds, onClose, onDone,
}: {
  open: boolean;
  negocioIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { usuarios } = useOrgUsuarios();
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("follow_up");
  const [dataVencimento, setDataVencimento] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [descricao, setDescricao] = useState("");

  function reset() {
    setTitulo(""); setTipo("follow_up"); setDataVencimento(""); setResponsavelId(""); setDescricao("");
  }

  const criar = useMutation({
    mutationFn: async () => {
      const resultados = await Promise.all(
        negocioIds.map(async (negocioId) => {
          try {
            const r = await fetch("/api/tarefas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                negocioId,
                titulo: titulo.trim(),
                tipo,
                descricao: descricao.trim() || undefined,
                dataVencimento: dataVencimento || undefined,
                responsavelId: responsavelId || undefined,
              }),
            });
            return r.ok;
          } catch {
            return false;
          }
        })
      );
      return resultados.filter(Boolean).length;
    },
    onSuccess: (criadas) => {
      const falhas = negocioIds.length - criadas;
      if (falhas === 0) toast.success(`${criadas} tarefa${criadas === 1 ? "" : "s"} criada${criadas === 1 ? "" : "s"}, uma por oportunidade.`);
      else toast.error(`${criadas} criadas, ${falhas} falharam.`);
      reset();
      onDone();
      onClose();
    },
    onError: () => toast.error("Não foi possível criar as tarefas"),
  });

  if (!open) return null;

  const podeCriar = titulo.trim().length > 0 && negocioIds.length > 0 && !criar.isPending;
  function handleClose() { reset(); onClose(); }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={handleClose}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold" style={{ color: "var(--cf2-text-primary)" }}>Criar tarefa em massa</p>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
              Vai criar <strong>{negocioIds.length}</strong> tarefa{negocioIds.length === 1 ? "" : "s"}, uma para cada oportunidade selecionada.
            </p>
          </div>
          <button onClick={handleClose} aria-label="Fechar"><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>

        <Campo label="Título *">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Follow-up de proposta" className={INPUT} style={INPUT_STYLE} />
        </Campo>

        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={INPUT} style={INPUT_STYLE}>
            {TIPO_TAREFA_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Campo>

        <Campo label="Vencimento">
          <input type="date" aria-label="Data" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} className={INPUT} style={INPUT_STYLE} />
        </Campo>

        <Campo label="Responsável">
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className={INPUT} style={INPUT_STYLE}>
            <option value="">Quem está criando</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Campo>

        <Campo label="Descrição">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Contexto que vale pra todas as tarefas" aria-label="Contexto que vale pra todas as tarefas" className={`${INPUT} resize-y`} style={INPUT_STYLE} />
        </Campo>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={handleClose} className="px-3 py-2 text-[13px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
          <button onClick={() => podeCriar && criar.mutate()} disabled={!podeCriar} className="px-4 py-2 rounded-xl text-[13px] font-bold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            {criar.isPending ? "Criando..." : `Criar ${negocioIds.length} tarefa${negocioIds.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

const INPUT = "px-3 py-2 rounded-lg text-[13px] outline-none w-full";
const INPUT_STYLE: React.CSSProperties = {
  background: "var(--cf2-bg-canvas)",
  border: "1px solid var(--cf2-border-default)",
  color: "var(--cf2-text-primary)",
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{label}</span>
      {children}
    </div>
  );
}
