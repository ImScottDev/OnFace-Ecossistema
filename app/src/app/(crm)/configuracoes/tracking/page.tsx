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

  if (loading) return <div className="text-white/40 text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChart className="w-5 h-5 text-[#e23752]" />
          <div>
            <h2 className="text-lg font-semibold text-white">Tracking &amp; Conversões</h2>
            <p className="text-xs text-white/40">Eventos server-side de funil para Meta CAPI, GA4 e Google Ads</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">{saving ? "Salvando..." : "Salvar"}</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card-solid p-4 space-y-2">
          <p className="text-sm font-medium text-white/80">Meta CAPI</p>
          <input className="dark-input w-full text-xs" value={metaPixel} onChange={e => setMetaPixel(e.target.value)} placeholder="Pixel ID" />
          <input className="dark-input w-full text-xs" value={metaToken} onChange={e => setMetaToken(e.target.value)} placeholder="Access Token" type="password" />
        </div>
        <div className="card-solid p-4 space-y-2">
          <p className="text-sm font-medium text-white/80">GA4</p>
          <input className="dark-input w-full text-xs" value={ga4Id} onChange={e => setGa4Id(e.target.value)} placeholder="Measurement ID" />
          <input className="dark-input w-full text-xs" value={ga4Secret} onChange={e => setGa4Secret(e.target.value)} placeholder="API Secret" type="password" />
        </div>
        <div className="card-solid p-4 space-y-2">
          <p className="text-sm font-medium text-white/80">Google Ads</p>
          <input className="dark-input w-full text-xs" value={adsCustomer} onChange={e => setAdsCustomer(e.target.value)} placeholder="Customer ID" />
        </div>
      </div>

      <div className="card-solid p-4 space-y-3">
        <p className="text-sm font-medium text-white/70">Mapeamento de Eventos por Etapa</p>
        <p className="text-[11px] text-white/30">Qual evento de conversão cada etapa dispara (ex: Lead, Schedule, Purchase)</p>
        {STAGES.map(s => (
          <div key={s} className="flex items-center gap-3">
            <span className="text-xs text-white/60 w-44 shrink-0">{s}</span>
            <input className="dark-input flex-1 text-xs" value={eventos[s] || ""} onChange={e => setEventos({ ...eventos, [s]: e.target.value })} placeholder="ex: Lead / Schedule / Purchase" />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-amber-400/70">Envio real depende das credenciais e do developer token do Google Ads (a configurar). A estrutura já fica pronta.</p>
    </div>
  );
}
