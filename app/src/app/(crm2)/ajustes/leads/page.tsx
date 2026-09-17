"use client";

import { useState, useCallback } from "react";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { EditableList } from "@/components/crm2/ajustes/EditableList";
import { Save, RotateCcw } from "lucide-react";

export default function LeadsConfigPage() {
  const { config, isLoading, mutate } = usePipelineConfig();
  const [draft, setDraft] = useState<typeof config | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const current = draft || config;

  const setField = useCallback((field: string, value: unknown) => {
    setDraft((prev) => ({ ...(prev || config), [field]: value }) as typeof config);
    setMessage(null);
  }, [config]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/configuracoes/pipeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }
      setDraft(null);
      mutate();
      setMessage({ type: "ok", text: "Configurações salvas" });
    } catch (e: unknown) {
      setMessage({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(null);
    setMessage(null);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-[var(--cf2-bg-surface)] rounded" />
        <div className="h-40 bg-[var(--cf2-bg-surface)] rounded-xl" />
        <div className="h-40 bg-[var(--cf2-bg-surface)] rounded-xl" />
      </div>
    );
  }

  const hasChanges = draft !== null;

  return (
    <div className="space-y-5">
      {/* Header with save/reset */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--cf2-text-primary)]">Classificação de Leads</h2>
          <p className="text-xs text-[var(--cf2-text-tertiary)] mt-0.5">Configure setores de atuação e origens de captação</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--cf2-text-secondary)] hover:text-[var(--cf2-text-primary)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Descartar
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)] hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`text-sm px-4 py-2.5 rounded-lg ${message.type === "ok" ? "bg-emerald-500/10 text-[var(--cf2-success-text)] border border-emerald-500/20" : "bg-red-500/10 text-[var(--cf2-danger-text)] border border-red-500/20"}`}>
          {message.text}
        </div>
      )}

      {/* Setores */}
      <EditableList
        title="Setores"
        description="Segmentos de indústria / setores de atuação dos leads e empresas"
        items={current.setores}
        onChange={(items) => setField("setores", items)}
      />

      {/* Origens */}
      <EditableList
        title="Origens"
        description="De onde vêm os leads (Google Ads, indicação, evento, etc.)"
        items={current.origens}
        onChange={(items) => setField("origens", items)}
      />
    </div>
  );
}
