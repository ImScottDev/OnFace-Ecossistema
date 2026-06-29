"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Handshake } from "lucide-react";

const VARS = ["{{empresa}}", "{{titulo}}", "{{contato}}", "{{leadNome}}", "{{leadEmail}}", "{{leadTelefone}}", "{{valor}}", "{{propostaLinha}}"];

export default function HandoverConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [destinatarios, setDestinatarios] = useState("");
  const [prefixo, setPrefixo] = useState("[Ganho]");
  const [template, setTemplate] = useState("<p>Novo cliente fechado: <b>{{empresa}}</b></p>\n<p>Negócio: {{titulo}} — {{valor}}</p>\n<p>Contato: {{contato}} ({{leadEmail}} / {{leadTelefone}})</p>");

  useEffect(() => {
    fetch("/api/configuracoes/settings").then(r => r.json()).then((s) => {
      const h = s.handover || {};
      if (h.destinatarios) setDestinatarios(h.destinatarios);
      if (h.prefixo) setPrefixo(h.prefixo);
      if (h.template) setTemplate(h.template);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/configuracoes/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "handover", value: { destinatarios, prefixo, template } }),
    });
    setSaving(false);
    if (res.ok) toast.success("Handover salvo"); else toast.error("Erro ao salvar");
  };

  if (loading) return <div className="text-white/40 text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="w-5 h-5 text-[#e23752]" />
          <div>
            <h2 className="text-lg font-semibold text-white">Handover ao ganhar negócio</h2>
            <p className="text-xs text-white/40">Email disparado automaticamente quando um negócio vira Ganho</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">{saving ? "Salvando..." : "Salvar"}</button>
      </div>

      <div className="card-solid p-4 space-y-2">
        <label className="text-sm font-medium text-white/70">Destinatários padrão</label>
        <p className="text-[11px] text-white/30">Separe por vírgula. Editável na hora do envio.</p>
        <input className="dark-input w-full" value={destinatarios} onChange={e => setDestinatarios(e.target.value)} placeholder="ops@callface.ai, cs@callface.ai" />
      </div>

      <div className="card-solid p-4 space-y-2">
        <label className="text-sm font-medium text-white/70">Prefixo do assunto</label>
        <input className="dark-input w-full" value={prefixo} onChange={e => setPrefixo(e.target.value)} />
      </div>

      <div className="card-solid p-4 space-y-2">
        <label className="text-sm font-medium text-white/70">Template do corpo (HTML)</label>
        <textarea className="dark-input w-full font-mono text-xs" rows={6} value={template} onChange={e => setTemplate(e.target.value)} />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {VARS.map(v => <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[#8e27ef]">{v}</code>)}
        </div>
      </div>
    </div>
  );
}
