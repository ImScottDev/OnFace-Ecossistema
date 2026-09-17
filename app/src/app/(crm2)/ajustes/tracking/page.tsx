"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LineChart } from "lucide-react";

const STAGES = ["qualificacao", "contato_feito", "reuniao_realizada", "proposta_apresentada", "negociacao_iniciada", "em_fechamento", "contrato"];

export default function TrackingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metaPixel, setMetaPixel] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [ga4Id, setGa4Id] = useState("");
  const [ga4Secret, setGa4Secret] = useState("");
  const [adsCustomer, setAdsCustomer] = useState("");
  const [eventos, setEventos] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/configuracoes/settings").then(r => r.json()).then((s) => {
      const t = s.tracking || {};
      setMetaPixel(t.metaPixel || ""); setMetaToken(t.metaToken || "");
      setGa4Id(t.ga4Id || ""); setGa4Secret(t.ga4Secret || "");
      setAdsCustomer(t.adsCustomer || ""); setEventos(t.eventos || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/configuracoes/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "tracking", value: { metaPixel, metaToken, ga4Id, ga4Secret, adsCustomer, eventos } }),
    });
    setSaving(false);
    if (res.ok) toast.success("Tracking salvo"); else toast.error("Erro ao salvar");
  };

  if (loading) return <div className="text-[var(--cf2-text-tertiary)] text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChart className="w-5 h-5 text-[var(--cf2-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Tracking &amp; Conversões</h2>
            <p className="text-xs text-[var(--cf2-text-tertiary)]">Eventos server-side de funil para Meta CAPI, GA4 e Google Ads</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="cf2-btn-primary px-4 py-1.5 text-sm">{saving ? "Salvando..." : "Salvar"}</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card-solid p-4 space-y-2">
          <p className="text-sm font-medium text-[var(--cf2-text-primary)]">Meta CAPI</p>
          <input className="cf2-input w-full text-xs" value={metaPixel} onChange={e => setMetaPixel(e.target.value)} placeholder="Pixel ID" aria-label="Pixel ID" />
          <input className="cf2-input w-full text-xs" value={metaToken} onChange={e => setMetaToken(e.target.value)} placeholder="Access Token" aria-label="Access Token" type="password" />
        </div>
        <div className="card-solid p-4 space-y-2">
          <p className="text-sm font-medium text-[var(--cf2-text-primary)]">GA4</p>
          <input className="cf2-input w-full text-xs" value={ga4Id} onChange={e => setGa4Id(e.target.value)} placeholder="Measurement ID" aria-label="Measurement ID" />
          <input className="cf2-input w-full text-xs" value={ga4Secret} onChange={e => setGa4Secret(e.target.value)} placeholder="API Secret" aria-label="API Secret" type="password" />
        </div>
        <div className="card-solid p-4 space-y-2">
          <p className="text-sm font-medium text-[var(--cf2-text-primary)]">Google Ads</p>
          <input className="cf2-input w-full text-xs" value={adsCustomer} onChange={e => setAdsCustomer(e.target.value)} placeholder="Customer ID" aria-label="Customer ID" />
        </div>
      </div>

      <div className="card-solid p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--cf2-text-secondary)]">Mapeamento de Eventos por Etapa</p>
        <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Qual evento de conversão cada etapa dispara (ex: Lead, Schedule, Purchase)</p>
        {STAGES.map(s => (
          <div key={s} className="flex items-center gap-3">
            <span className="text-xs text-[var(--cf2-text-secondary)] w-44 shrink-0">{s}</span>
            <input className="cf2-input flex-1 text-xs" value={eventos[s] || ""} onChange={e => setEventos({ ...eventos, [s]: e.target.value })} placeholder="ex: Lead / Schedule / Purchase" aria-label="ex: Lead / Schedule / Purchase" />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--cf2-warning-text)]/70">Envio real depende das credenciais e do developer token do Google Ads (a configurar). A estrutura já fica pronta.</p>
    </div>
  );
}
