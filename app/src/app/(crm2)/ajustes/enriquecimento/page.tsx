"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export default function EnriquecimentoConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [stage, setStage] = useState("qualquer");

  useEffect(() => {
    fetch("/api/configuracoes/settings").then(r => r.json()).then((s) => {
      const e = s.enriquecimento || {};
      setAtivo(!!e.ativo);
      if (e.stage) setStage(e.stage);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/configuracoes/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "enriquecimento", value: { ativo, stage } }),
    });
    setSaving(false);
    if (res.ok) toast.success("Enriquecimento salvo"); else toast.error("Erro ao salvar");
  };

  if (loading) return <div className="text-[var(--cf2-text-tertiary)] text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--cf2-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Enriquecimento Automático</h2>
            <p className="text-xs text-[var(--cf2-text-tertiary)]">Enriquece leads via Apollo.io automaticamente ao entrarem no pipeline</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="cf2-btn-primary px-4 py-1.5 text-sm">{saving ? "Salvando..." : "Salvar"}</button>
      </div>

      <div className="card-solid p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--cf2-text-primary)]">Ativar enriquecimento automático</p>
          <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Consome créditos Apollo a cada lead enriquecido</p>
        </div>
        <button onClick={() => setAtivo(!ativo)} className={`relative w-11 h-6 rounded-full transition-colors ${ativo ? "bg-[var(--cf2-accent)]" : "bg-[var(--cf2-bg-surface-muted)]"}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[var(--cf2-accent)] transition-transform ${ativo ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <div className="card-solid p-4 space-y-2">
        <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Stage de gatilho</label>
        <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Em qual etapa o lead é enriquecido</p>
        <select className="cf2-input w-full" value={stage} onChange={e => setStage(e.target.value)}>
          <option value="qualquer">Qualquer stage</option>
          <option value="novo">Novo</option>
          <option value="qualificacao">Qualificação</option>
          <option value="contato_feito">Contato Feito</option>
        </select>
      </div>
    </div>
  );
}
