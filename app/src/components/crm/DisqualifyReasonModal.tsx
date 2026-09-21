"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { X } from "lucide-react";

interface Reason {
  key: string;
  label: string;
}

/**
 * Fonte única do fluxo de "desqualificar lead" no board Pré-vendas.
 *
 * Mesmo padrão do LossReasonModal (motivo estruturado + detalhe obrigatório
 * quando o motivo é "outro"), mas com a lista de motivos DE LEAD, que é outra
 * coisa: perder um negócio é "preço alto"/"escolheu concorrente"; desqualificar
 * um lead é "fora do ICP"/"contato inválido". Misturar as duas listas inutiliza
 * os dois relatórios — por isso são componentes e configs separados.
 *
 * Grava em `leads.motivoPerda` (a chave) e `leads.motivoPerdaDetalhe` (o texto),
 * colunas que já existiam e que o PATCH /api/leads/:id já aceita.
 */
export function DisqualifyReasonModal({
  leadNome,
  reasons,
  onClose,
  onConfirm,
}: {
  leadNome?: string | null;
  reasons: Reason[];
  onClose: () => void;
  onConfirm: (motivo: string, detalhe?: string) => void;
}) {
  const [motivo, setMotivo] = useState<string>("");
  const [detalhe, setDetalhe] = useState("");

  // "Outro" sem detalhe é genérico demais pra virar dado útil no relatório —
  // mesma regra já aplicada no motivo de perda de negócio.
  const precisaDetalhe = motivo === "outro";
  const podeConfirmar = !!motivo && (!precisaDetalhe || detalhe.trim().length > 0);

  const conteudo = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.08] p-5"
        style={{ background: "#141518" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">Desqualificar lead</h2>
            {leadNome && <p className="text-xs text-white/40 truncate mt-0.5">{leadNome}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-xs font-medium text-white/60 mb-1.5">
          Motivo <span className="text-[#EF4444]">*</span>
        </label>
        <select
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.05] border border-white/[0.1] text-white outline-none focus:border-[#EF4444]/50 mb-4"
        >
          <option value="" disabled>
            Selecione o motivo...
          </option>
          {reasons.map((r) => (
            <option key={r.key} value={r.key} style={{ background: "#141518" }}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="block text-xs font-medium text-white/60 mb-1.5">
          Detalhe {precisaDetalhe ? <span className="text-[#EF4444]">*</span> : <span className="text-white/25">(opcional)</span>}
        </label>
        <textarea
          value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
          rows={3}
          placeholder={precisaDetalhe ? "Descreva o motivo..." : "Contexto adicional..."}
          className="w-full px-3 py-2 rounded-xl text-sm bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/25 outline-none focus:border-[#EF4444]/50 resize-none"
        />
        {precisaDetalhe && detalhe.trim().length === 0 && (
          <p className="text-[11px] text-white/35 mt-1.5">
            Com &ldquo;Outro&rdquo;, o detalhe é obrigatório — senão o motivo não serve pro relatório.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs font-medium text-white/50 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={!podeConfirmar}
            onClick={() => onConfirm(motivo, detalhe.trim() || undefined)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Desqualificar
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(conteudo, document.body) : null;
}
