"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export default function EnriquecimentoConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [stage, setStage] = useState("qualquer");
  /* A chave do Apollo é por organização (organizacoes.apollo_api_key) e a rota
     já existia — faltava o campo: não havia onde cadastrar a chave pela tela,
     e sem ela todo enriquecimento falha com "Apollo API key não configurada". */
  const [chaveSalva, setChaveSalva] = useState("");
  const [chaveNova, setChaveNova] = useState("");
  const [salvandoChave, setSalvandoChave] = useState(false);

  useEffect(() => {
    fetch("/api/configuracoes/settings").then(r => r.json()).then((s) => {
      const e = s.enriquecimento || {};
      setAtivo(!!e.ativo);
      if (e.stage) setStage(e.stage);
      setLoading(false);
    }).catch(() => setLoading(false));
    fetch("/api/configuracoes/integracoes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setChaveSalva(d.apolloApiKey || ""); })
      .catch(() => undefined);
  }, []);

  const salvarChave = async () => {
    const valor = chaveNova.trim();
    if (!valor) return;
    setSalvandoChave(true);
    const res = await fetch("/api/configuracoes/integracoes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apolloApiKey: valor }),
    });
    setSalvandoChave(false);
    if (!res.ok) {
      toast.error(res.status === 403 ? "Só um administrador pode guardar a chave" : "Não consegui guardar a chave");
      return;
    }
    const d = await fetch("/api/configuracoes/integracoes").then((r) => r.json()).catch(() => null);
    setChaveSalva(d?.apolloApiKey || "");
    setChaveNova("");
    toast.success("Chave do Apollo guardada");
  };

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
      {/* Nenhum processo lê esta chave de organizacoes.settings (medido
          01/10/2026; ver `semEfeito` em ../Nav). Salvar grava, e só. */}
      <p className="aj-aviso" role="status">
        <strong>Ainda sem efeito:</strong> a escolha fica gravada, mas nenhum processo a lê: ligar aqui não enriquece lead nem consome crédito. O enriquecimento manual segue no lead.
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--cf2-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Enriquecimento Automático</h2>
            <p className="text-xs text-[var(--cf2-text-tertiary)]">Enriquecimento de leads via Apollo.io ao entrarem no pipeline</p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="cf2-btn-primary px-4 py-1.5 text-sm">{saving ? "Salvando..." : "Salvar"}</button>
      </div>

      <div className="card-solid p-4 space-y-2">
        <label className="text-sm font-medium text-[var(--cf2-text-secondary)]">Chave da API do Apollo</label>
        <p className="text-[11px] text-[var(--cf2-text-tertiary)]">
          Guardada por organização. Sem ela, Enriquecer e Prospecção não conseguem
          consultar o Apollo. A chave fica no servidor e a tela só mostra o começo e o fim dela.
        </p>
        {chaveSalva ? (
          <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Guardada: <span className="aj-mono">{chaveSalva}</span></p>
        ) : (
          <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Nenhuma chave guardada.</p>
        )}
        <div className="flex gap-2">
          <input
            className="cf2-input w-full"
            type="password"
            autoComplete="off"
            placeholder={chaveSalva ? "Colar uma chave nova para substituir" : "Colar a chave do Apollo"}
            value={chaveNova}
            onChange={(e) => setChaveNova(e.target.value)}
          />
          <button className="cf2-btn-primary px-4 py-1.5 text-sm whitespace-nowrap" onClick={salvarChave} disabled={!chaveNova.trim() || salvandoChave}>
            {salvandoChave ? "Guardando…" : "Guardar"}
          </button>
        </div>
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
