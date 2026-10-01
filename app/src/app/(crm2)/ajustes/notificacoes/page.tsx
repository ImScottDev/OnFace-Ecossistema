"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Bell, Plus, Trash2 } from "lucide-react";

const STAGES = ["qualquer", "reuniao_agendada", "reuniao_realizada", "proposta_apresentada", "negociacao_iniciada", "em_fechamento", "ganho", "perdido"];

type Regra = { stage: string; whatsapp: string; email: string };

export default function NotificacoesConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regras, setRegras] = useState<Regra[]>([]);

  useEffect(() => {
    fetch("/api/configuracoes/settings").then(r => r.json()).then((s) => {
      setRegras(s.notificacoes || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/configuracoes/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "notificacoes", value: regras }),
    });
    setSaving(false);
    if (res.ok) toast.success("Notificações salvas"); else toast.error("Erro ao salvar");
  };

  if (loading) return <div className="text-[var(--cf2-text-tertiary)] text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Nenhum processo lê esta chave de organizacoes.settings (medido
          01/10/2026; ver `semEfeito` em ../Nav). Salvar grava, e só. */}
      <p className="aj-aviso" role="status">
        <strong>Ainda sem efeito:</strong> as regras ficam gravadas, mas nenhum processo do ONFACE as lê. Nenhum WhatsApp ou e-mail é enviado por elas.
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[var(--cf2-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Notificações</h2>
            <p className="text-xs text-[var(--cf2-text-tertiary)]">Destinatários avisados quando um negócio entra num estágio</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRegras([...regras, { stage: "qualquer", whatsapp: "", email: "" }])} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)] hover:bg-[var(--cf2-bg-surface-muted)] flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nova regra</button>
          <button onClick={save} disabled={saving} className="cf2-btn-primary px-4 py-1.5 text-sm">{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>

      {regras.length === 0 && <p className="text-sm text-[var(--cf2-text-tertiary)] text-center py-6">Nenhuma regra. Clique em "Nova regra".</p>}

      {regras.map((r, i) => (
        <div key={i} className="card-solid p-4 space-y-3">
          <div className="flex items-center justify-between">
            <select className="cf2-input text-xs" value={r.stage} onChange={e => { const n = [...regras]; n[i].stage = e.target.value; setRegras(n); }}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setRegras(regras.filter((_, j) => j !== i))} className="p-1.5 text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-danger-text)]"><Trash2 className="w-4 h-4" /></button>
          </div>
          <input className="cf2-input w-full text-xs" value={r.whatsapp} onChange={e => { const n = [...regras]; n[i].whatsapp = e.target.value; setRegras(n); }} placeholder="WhatsApp destinatários (vírgula)" aria-label="WhatsApp destinatários (vírgula)" />
          <input className="cf2-input w-full text-xs" value={r.email} onChange={e => { const n = [...regras]; n[i].email = e.target.value; setRegras(n); }} placeholder="Email destinatários (vírgula)" aria-label="Email destinatários (vírgula)" />
        </div>
      ))}
    </div>
  );
}
