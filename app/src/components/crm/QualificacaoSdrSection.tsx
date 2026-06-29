"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Check } from "lucide-react";

/**
 * Qualificação SDR — campos-chave que a SDR preenche rápido durante a
 * qualificação do lead (board Pré-vendas). Salvos em `camposCustom.qualificacaoSdr`
 * no LEAD, então aparecem tanto no fluxo do SDR quanto no negócio comercial
 * (o negócio referencia o mesmo lead). Salva no blur (sem botão).
 */

export interface SdrField {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
}

// Produto de interesse: sinalização da SDR pro closer (badge nos cards).
// A fonte da verdade do fluxo pós-ganho é a PROPOSTA aceita, não este campo.
export const PRODUTO_OPTIONS = [
  { value: "ai", label: "Callface AI" },
  { value: "pabx", label: "PABX" },
  { value: "ai_pabx", label: "AI + PABX" },
];

export const SDR_FIELDS: SdrField[] = [
  { key: "produto", label: "Produto de interesse", placeholder: "Selecionar", type: "select", options: PRODUTO_OPTIONS },
  { key: "quemRealizaCall", label: "Quem realiza as calls", placeholder: "Nome / cargo de quem liga" },
  { key: "tomadorDecisao", label: "Tomador de decisão", placeholder: "Quem decide a compra" },
  { key: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { key: "crmAtual", label: "CRM usado hoje", placeholder: "Ex: nenhum, planilha, RD..." },
  { key: "numUsuarios", label: "Nº de usuários", placeholder: "Ex: 12", type: "number" },
];

type SdrValues = Record<string, string>;

export function QualificacaoSdrSection({
  leadId,
  camposCustom,
  readOnly = false,
  queryKeysToInvalidate = [],
}: {
  leadId: string;
  camposCustom?: Record<string, unknown> | null;
  readOnly?: boolean;
  queryKeysToInvalidate?: string[];
}) {
  const qc = useQueryClient();
  const initial = ((camposCustom?.qualificacaoSdr as SdrValues) || {}) as SdrValues;
  const [vals, setVals] = useState<SdrValues>(() =>
    Object.fromEntries(SDR_FIELDS.map((f) => [f.key, initial[f.key] || ""]))
  );
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (next: SdrValues) => {
      // merge pra não apagar outras chaves de camposCustom
      const merged = { ...(camposCustom || {}), qualificacaoSdr: next };
      const r = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camposCustom: merged }),
      });
      if (!r.ok) throw new Error("falha ao salvar qualificação");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      queryKeysToInvalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: () => toast.error("Não foi possível salvar a qualificação"),
  });

  const commit = (key: string) => {
    if (initial[key] === vals[key]) return; // nada mudou
    save.mutate(vals);
    setSavedKey(key);
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1500);
  };

  const filledCount = SDR_FIELDS.filter((f) => vals[f.key]?.trim()).length;

  if (readOnly) {
    const anyFilled = filledCount > 0;
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="w-3.5 h-3.5 text-[#c8ff00]" />
          <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
            Qualificação SDR
          </h4>
        </div>
        {anyFilled ? (
          <div className="space-y-1.5">
            {SDR_FIELDS.filter((f) => vals[f.key]?.trim()).map((f) => (
              <div key={f.key} className="flex items-start justify-between gap-3 px-3 py-1.5 rounded-lg bg-white/[0.03]">
                <span className="text-[11px] text-white/40">{f.label}</span>
                <span className="text-xs text-white/80 text-right">
                  {f.type === "select"
                    ? f.options?.find((o) => o.value === vals[f.key])?.label || vals[f.key]
                    : vals[f.key]}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/20 py-1">Lead ainda não qualificado pela SDR.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-3.5 h-3.5 text-[#c8ff00]" />
          <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
            Qualificação SDR
          </h4>
        </div>
        <span className="text-[10px] text-white/30">{filledCount}/{SDR_FIELDS.length}</span>
      </div>
      <div className="space-y-2">
        {SDR_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-[10px] text-white/40 mb-0.5 flex items-center gap-1">
              {f.label}
              {savedKey === f.key && <Check className="w-2.5 h-2.5 text-emerald-400" />}
            </label>
            {f.type === "select" ? (
              <select
                value={vals[f.key]}
                onChange={(e) => {
                  const next = { ...vals, [f.key]: e.target.value };
                  setVals(next);
                  save.mutate(next);
                  setSavedKey(f.key);
                  setTimeout(() => setSavedKey((k) => (k === f.key ? null : k)), 1500);
                }}
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#c8ff00]/40 transition-colors [&>option]:bg-[#16161a]"
              >
                <option value="">{f.placeholder}</option>
                {(f.options || []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
            <input
              type={f.type === "number" ? "number" : "text"}
              value={vals[f.key]}
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
              onBlur={() => commit(f.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder={f.placeholder}
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 outline-none focus:border-[#c8ff00]/40 transition-colors"
            />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
