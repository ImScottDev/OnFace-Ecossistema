"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { X } from "lucide-react";
import { STAGNATION_REASONS } from "@/lib/crm/pipeline";

interface LossReason {
  key: string;
  label: string;
}

/**
 * Fonte única do fluxo de "negócio perdido" — select estruturado (fonte única de
 * motivos vem de usePipelineConfig().lossReasons, configurável por org em
 * Configurações → Pipeline) + campo de detalhe (opcional, exceto quando o motivo
 * é "outro" — aí é obrigatório, senão o motivo fica genérico demais pro relatório,
 * achado Kauã 28/07). Extraído do pipeline kanban (28/07) porque o Drawer usava
 * window.prompt() puro, deixando o motivo de perda em texto livre sem categoria —
 * poluindo o relatório Comercial.
 *
 * onStagnate é opcional: quando presente, mostra a seção "mover pra Estagnados"
 * (fluxo decidido pelo Scott 12/jun). Telas que já resolvem estagnação por outro
 * caminho (ex: NegocioDrawer, que tem "Estagnado" como optgroup do próprio select
 * de status) não precisam passar essa prop.
 */
export function LossReasonModal({
  lossReasons,
  onClose,
  onLose,
  onStagnate,
}: {
  lossReasons: LossReason[];
  onClose: () => void;
  onLose: (motivo: string, detalhe?: string) => void;
  onStagnate?: (reasonKey: string) => void;
}) {
  const [motivo, setMotivo] = useState<string>("");
  const [detalhe, setDetalhe] = useState("");
  // "Outro" sem detalhe é motivo genérico demais pra virar dado útil no relatório
  // (achado Kauã 28/07) — só nesse caso o detalhe deixa de ser opcional.
  const detalheObrigatorio = motivo === "outro";
  const podeConfirmar = !!motivo && (!detalheObrigatorio || detalhe.trim().length > 0);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl bg-[#16161a] border border-white/[0.08] p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-heading)" }}>
            Esse negócio está perdido?
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {onStagnate && (
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">
              Ainda dá pra trabalhar — mover pra Estagnados
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STAGNATION_REASONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => onStagnate(r.key)}
                  className="px-3 py-2.5 rounded-xl text-xs text-left border border-white/[0.08] bg-white/[0.04] text-white/80 hover:border-[#8e27ef]/60 hover:bg-[#8e27ef]/10 transition-colors"
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: r.color }} />
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={onStagnate ? "border-t border-white/[0.06] pt-4" : ""}>
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">Perda real — qual o motivo?</p>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#EF4444]/50 [&>option]:bg-[#16161a]"
          >
            <option value="">Selecionar motivo...</option>
            {lossReasons.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
          <textarea
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder={detalheObrigatorio ? "Qual foi o motivo? (obrigatório pra 'Outro')" : "Detalhe o que aconteceu (opcional, mas ajuda o time)"}
            rows={2}
            className={`mt-2 w-full px-3 py-2 rounded-xl text-xs bg-white/[0.05] border text-white placeholder:text-white/25 outline-none focus:border-[#EF4444]/50 resize-none ${detalheObrigatorio ? "border-[#EF4444]/40" : "border-white/[0.08]"}`}
          />
          <button
            disabled={!podeConfirmar}
            onClick={() => onLose(motivo, detalhe.trim() || undefined)}
            className="mt-2 w-full py-2.5 rounded-xl text-xs font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar perda
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
