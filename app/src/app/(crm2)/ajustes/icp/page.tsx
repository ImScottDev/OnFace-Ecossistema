"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";

const PORTES = ["Micro", "Pequena", "Média", "Grande"];
const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type Pesos = {
  setor: number; porte: number; localizacao: number; cargo: number; servicos: number; tamanho: number; filiais: number;
};
const DEFAULT_PESOS: Pesos = { setor: 25, porte: 20, localizacao: 10, cargo: 15, servicos: 15, tamanho: 10, filiais: 5 };

const PESO_LABELS: Record<keyof Pesos, string> = {
  setor: "Setor / Indústria", porte: "Porte da empresa", localizacao: "Localização",
  cargo: "Cargo do decisor", servicos: "Serviços de interesse", tamanho: "Tamanho (usuários TI)", filiais: "Número de filiais",
};

export default function IcpConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setores, setSetores] = useState("");
  const [portes, setPortes] = useState<string[]>([]);
  const [estados, setEstados] = useState<string[]>([]);
  const [cargos, setCargos] = useState("diretor, vp, ceo, cto, head, gerente, sócio");
  const [servicos, setServicos] = useState("");
  const [minUsuariosTi, setMinUsuariosTi] = useState("");
  const [minFiliais, setMinFiliais] = useState("");
  const [pesos, setPesos] = useState<Pesos>(DEFAULT_PESOS);

  useEffect(() => {
    fetch("/api/configuracoes/settings").then(r => r.json()).then((s) => {
      const icp = s.icp || {};
      if (icp.setores) setSetores(icp.setores);
      if (icp.portes) setPortes(icp.portes);
      if (icp.estados) setEstados(icp.estados);
      if (icp.cargos) setCargos(icp.cargos);
      if (icp.servicos) setServicos(icp.servicos);
      if (icp.minUsuariosTi != null) setMinUsuariosTi(String(icp.minUsuariosTi));
      if (icp.minFiliais != null) setMinFiliais(String(icp.minFiliais));
      if (icp.pesos) setPesos({ ...DEFAULT_PESOS, ...icp.pesos });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalPesos = Object.values(pesos).reduce((a, b) => a + Number(b || 0), 0);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const save = async () => {
    if (totalPesos !== 100) { toast.error(`Os pesos devem somar 100% (atual: ${totalPesos}%)`); return; }
    setSaving(true);
    const value = { setores, portes, estados, cargos, servicos, minUsuariosTi: Number(minUsuariosTi) || 0, minFiliais: Number(minFiliais) || 0, pesos };
    const res = await fetch("/api/configuracoes/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "icp", value }),
    });
    setSaving(false);
    if (res.ok) toast.success("ICP salvo"); else toast.error("Erro ao salvar");
  };

  const recalcular = async () => {
    const res = await fetch("/api/leads/recalcular-icp", { method: "POST" });
    if (res.ok) { const d = await res.json(); toast.success(`ICP recalculado em ${d.atualizados ?? 0} leads`); }
    else toast.error("Erro ao recalcular");
  };

  if (loading) return <div className="text-[var(--cf2-text-tertiary)] text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[var(--cf2-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Perfil de Cliente Ideal (ICP)</h2>
            <p className="text-xs text-[var(--cf2-text-tertiary)]">Configure o perfil ideal para calcular automaticamente o ICP Score de leads e empresas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={recalcular} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)] hover:bg-[var(--cf2-bg-surface-muted)]">Recalcular todos</button>
          <button onClick={save} disabled={saving} className="cf2-btn-primary px-4 py-1.5 text-sm">{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>

      <div className="card-solid p-4 space-y-2">
        <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Setores Ideais</label>
        <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Quais indústrias/setores são seu foco (separados por vírgula)</p>
        <input className="cf2-input w-full" value={setores} onChange={e => setSetores(e.target.value)} placeholder="tecnologia, saúde, varejo, indústria" aria-label="tecnologia, saúde, varejo, indústria" />
      </div>

      <div className="card-solid p-4 space-y-2">
        <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Porte Ideal</label>
        <div className="flex flex-wrap gap-2">
          {PORTES.map(p => (
            <button key={p} onClick={() => toggle(portes, p, setPortes)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${portes.includes(p) ? "bg-[var(--cf2-accent)]/20 text-[var(--cf2-accent)] border border-[var(--cf2-accent)]/30" : "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)] border border-[var(--cf2-border-default)]"}`}>{p}</button>
          ))}
        </div>
      </div>

      <div className="card-solid p-4 space-y-2">
        <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Estados / Regiões</label>
        <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Localização geográfica ideal (vazio = todos)</p>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map(uf => (
            <button key={uf} onClick={() => toggle(estados, uf, setEstados)} className={`px-2 py-1 rounded text-[11px] transition-colors ${estados.includes(uf) ? "bg-[#8e27ef]/25 text-[#c89bff]" : "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-tertiary)]"}`}>{uf}</button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card-solid p-4 space-y-2">
          <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Cargos Decisores</label>
          <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Títulos que indicam poder de decisão</p>
          <input className="cf2-input w-full" value={cargos} onChange={e => setCargos(e.target.value)} />
        </div>
        <div className="card-solid p-4 space-y-2">
          <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Serviços Prioritários</label>
          <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Serviços que indicam fit com sua oferta</p>
          <input className="cf2-input w-full" value={servicos} onChange={e => setServicos(e.target.value)} placeholder="voip, discador, ia de voz" aria-label="voip, discador, ia de voz" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card-solid p-4 space-y-2">
          <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Mín. usuários de TI</label>
          <input type="number" className="cf2-input w-full" value={minUsuariosTi} onChange={e => setMinUsuariosTi(e.target.value)} placeholder="0" />
        </div>
        <div className="card-solid p-4 space-y-2">
          <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Mín. filiais</label>
          <input type="number" className="cf2-input w-full" value={minFiliais} onChange={e => setMinFiliais(e.target.value)} placeholder="0" />
        </div>
      </div>

      <div className="card-solid p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Pesos dos Critérios</label>
          <span className={`text-xs font-bold ${totalPesos === 100 ? "text-[var(--cf2-success-text)]" : "text-[var(--cf2-warning-text)]"}`}>Total: {totalPesos}% {totalPesos === 100 ? "✓" : ""}</span>
        </div>
        {(Object.keys(pesos) as (keyof Pesos)[]).map(k => (
          <div key={k} className="flex items-center gap-3">
            <span className="text-xs text-[var(--cf2-text-secondary)] w-40 shrink-0">{PESO_LABELS[k]}</span>
            <input type="range" aria-label="Valor" min={0} max={50} value={pesos[k]} onChange={e => setPesos({ ...pesos, [k]: Number(e.target.value) })} className="flex-1 accent-[var(--cf2-accent)]" />
            <span className="text-xs text-[var(--cf2-text-secondary)] w-10 text-right tabular-nums">{pesos[k]}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
