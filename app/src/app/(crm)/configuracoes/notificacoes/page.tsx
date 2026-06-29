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

  if (loading) return <div className="text-white/40 text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#e23752]" />
          <div>
            <h2 className="text-lg font-semibold text-white">Notificações</h2>
            <p className="text-xs text-white/40">Dispara quando um negócio entra num estágio</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRegras([...regras, { stage: "qualquer", whatsapp: "", email: "" }])} className="px-3 py-1.5 text-xs rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/10 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nova regra</button>
          <button onClick={save} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>

      {regras.length === 0 && <p className="text-sm text-white/30 text-center py-6">Nenhuma regra. Clique em "Nova regra".</p>}

      {regras.map((r, i) => (
        <div key={i} className="card-solid p-4 space-y-3">
          <div className="flex items-center justify-between">
            <select className="dark-input text-xs" value={r.stage} onChange={e => { const n = [...regras]; n[i].stage = e.target.value; setRegras(n); }}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setRegras(regras.filter((_, j) => j !== i))} className="p-1.5 text-white/30 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
          <input className="dark-input w-full text-xs" value={r.whatsapp} onChange={e => { const n = [...regras]; n[i].whatsapp = e.target.value; setRegras(n); }} placeholder="WhatsApp destinatários (vírgula)" />
          <input className="dark-input w-full text-xs" value={r.email} onChange={e => { const n = [...regras]; n[i].email = e.target.value; setRegras(n); }} placeholder="Email destinatários (vírgula)" />
        </div>
      ))}
    </div>
  );
}
