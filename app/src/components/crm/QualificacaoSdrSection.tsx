"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Check, CheckCircle2, Circle } from "lucide-react";

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

// Campo trocado pra bater 1:1 com o Figma (node 230:8825, 17/08) — decisão
// explícita do Kauã, não é mockup. Substituiu o conjunto antigo (produto/
// setores/CRM atual/nº usuários) por CNPJ/Cargo/Necessidade-Dor/Tomador de
// decisão. O worker de AI SDR (`src/worker/index.ts`) ainda escreve nas
// keys antigas (produto/quemRealizaCall/crmAtual/numUsuarios) quando
// qualifica um lead pelo chat — isso continua funcionando sem erro (merge
// raso em JSON, não quebra nada), só que esses valores ficam invisíveis
// aqui agora, já que não têm campo correspondente na UI nova. Ajustar a
// extração da IA pra escrever nas keys novas é escopo separado, registrado
// como pendência.
export const TOMADOR_DECISAO_OPTIONS = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "nao_identificado", label: "Não identificado" },
];

export const SDR_FIELDS: SdrField[] = [
  { key: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { key: "cargo", label: "Cargo", placeholder: "Cargo do contato" },
  { key: "necessidadeDor", label: "Necessidade / Dor", placeholder: "Descrever a necessidade/dor identificada" },
  { key: "tomadorDecisao", label: "Tomador de decisão?", placeholder: "Sim · Não · Não identificado", type: "select", options: TOMADOR_DECISAO_OPTIONS },
];

type SdrValues = Record<string, string>;

export function QualificacaoSdrSection({
  leadId,
  camposCustom,
  readOnly = false,
  queryKeysToInvalidate = [],
  variant = "dark",
  prefill,
  hideHeader = false,
  onProgressChange,
  showFieldStatusDots = false,
}: {
  leadId: string;
  camposCustom?: Record<string, unknown> | null;
  readOnly?: boolean;
  queryKeysToInvalidate?: string[];
  /** "light" reusa a MESMA lista de campos/mutação (save no blur em
   * camposCustom.qualificacaoSdr) só com a casca visual do CRM2 — usado pelo
   * drawer novo de Pré-vendas. Default "dark" mantém 100% do visual legado
   * em todo resto do app. */
  variant?: "dark" | "light";
  /** Valores reais já conhecidos fora da qualificação (ex: CNPJ da Empresa
   * vinculada, Cargo já preenchido no lead) — usados como default só quando
   * o campo ainda não foi respondido na qualificação em si. Requisito
   * explícito do mapa mestre de produto (17/08): "CNPJ e Cargo devem vir
   * pré-preenchidos quando já existirem". Não são salvos automaticamente —
   * só populam a tela; a gravação continua acontecendo no blur, igual antes. */
  prefill?: Partial<SdrValues>;
  /** Esconde o header interno ("Qualificação SDR" + X/4) — usado quando o
   * container (ex: drawer novo de Pré-vendas, Figma 211:4/23-08) já renderiza
   * seu próprio header com barra de progresso, pra não duplicar. */
  hideHeader?: boolean;
  /** Notifica o container do progresso real (sem duplicar o cálculo de
   * `filledCount` fora daqui) — usado pra desenhar a barra de progresso e o
   * alerta de "Tomador de decisão: Não identificado" no header externo. */
  onProgressChange?: (info: { count: number; total: number; tomadorDecisao: string }) => void;
  /** Ver comentário acima do label — indicador visual opt-in de preenchido/pendente por campo. */
  showFieldStatusDots?: boolean;
}) {
  const light = variant === "light";
  const qc = useQueryClient();
  const initial = ((camposCustom?.qualificacaoSdr as SdrValues) || {}) as SdrValues;
  const [vals, setVals] = useState<SdrValues>(() =>
    Object.fromEntries(SDR_FIELDS.map((f) => [f.key, initial[f.key] || prefill?.[f.key] || ""]))
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

  useEffect(() => {
    onProgressChange?.({ count: filledCount, total: SDR_FIELDS.length, tomadorDecisao: vals.tomadorDecisao || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledCount, vals.tomadorDecisao]);

  if (readOnly) {
    const anyFilled = filledCount > 0;
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="w-3.5 h-3.5" style={{ color: light ? "#88d600" : "#c8ff00" }} />
          <h4 className={light ? "text-[11px] font-medium uppercase tracking-wider" : "text-[11px] font-medium text-white/30 uppercase tracking-wider"} style={light ? { color: "var(--cf2-text-tertiary)" } : undefined}>
            Qualificação SDR
          </h4>
        </div>
        {anyFilled ? (
          <div className="space-y-1.5">
            {SDR_FIELDS.filter((f) => vals[f.key]?.trim()).map((f) => (
              <div key={f.key} className={light ? "flex items-start justify-between gap-3 px-3 py-1.5 rounded-lg" : "flex items-start justify-between gap-3 px-3 py-1.5 rounded-lg bg-white/[0.03]"} style={light ? { background: "var(--cf2-bg-surface)" } : undefined}>
                <span className="text-[11px]" style={light ? { color: "var(--cf2-text-tertiary)" } : { color: "rgba(255,255,255,0.4)" }}>{f.label}</span>
                <span className="text-xs text-right" style={light ? { color: "var(--cf2-text-primary)" } : { color: "rgba(255,255,255,0.8)" }}>
                  {f.type === "select"
                    ? f.options?.find((o) => o.value === vals[f.key])?.label || vals[f.key]
                    : vals[f.key]}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs py-1" style={light ? { color: "var(--cf2-text-tertiary)" } : { color: "rgba(255,255,255,0.2)" }}>Lead ainda não qualificado pela SDR.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-3.5 h-3.5" style={{ color: light ? "#88d600" : "#c8ff00" }} />
            <h4 className={light ? "text-[14px] font-bold" : "text-[11px] font-medium text-white/30 uppercase tracking-wider"} style={light ? { color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" } : undefined}>
              Qualificação SDR
            </h4>
          </div>
          <span className="text-[12px]" style={light ? { color: "var(--cf2-text-tertiary)" } : { color: "rgba(255,255,255,0.3)" }}>{filledCount}/{SDR_FIELDS.length}</span>
        </div>
      )}
      <div className="space-y-2">
        {SDR_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-[12px] mb-0.5 flex items-center gap-1.5" style={light ? { color: "var(--cf2-text-secondary)" } : { color: "rgba(255,255,255,0.4)" }}>
              {/* Ponto de status (23/08, drawer novo de Pré-vendas): dá a
                  leitura de "checklist" do Figma sem virar campo read-only —
                  o critério continua editável, só ganha um indicador visual
                  de preenchido/pendente. Opt-in (`showFieldStatusDots`) pra
                  não mudar o visual dos outros 5 usos deste componente. */}
              {showFieldStatusDots && (
                vals[f.key]?.trim()
                  ? <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: "#4ade80" }} />
                  : <Circle className="w-3 h-3 shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
              )}
              {f.label}
              {savedKey === f.key && <Check className="w-2.5 h-2.5" style={{ color: light ? "#22c55e" : "#34d399" }} />}
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
                className={light ? "w-full px-3 h-9 rounded-md text-[13px] outline-none" : "w-full px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-white/[0.08] text-white outline-none focus:border-[#c8ff00]/40 transition-colors [&>option]:bg-[#16161a]"}
                style={light ? { background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" } : undefined}
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
              className={light ? "w-full px-3 h-9 rounded-md text-[13px] outline-none" : "w-full px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 outline-none focus:border-[#c8ff00]/40 transition-colors"}
              style={light ? { background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" } : undefined}
            />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
