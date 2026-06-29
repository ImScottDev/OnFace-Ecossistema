"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Pause, Trash2, Plus, X, Save, ChevronDown, Clock, Mail, GitBranch } from "lucide-react";

interface Passo {
  id: string;
  ordem: number;
  tipo: string;
  templateId: string | null;
  delayMinutos: number;
  condicao: Record<string, unknown> | null;
}

interface Sequencia {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  gatilho: string;
  gatilhoConfig: Record<string, unknown> | null;
  passos: Passo[];
  createdAt: string;
}

interface Template {
  id: string;
  nome: string;
}

export default function SequenciasPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    gatilho: "manual" as "manual" | "novo_lead" | "mudanca_status",
    passos: [{ ordem: 0, tipo: "email", templateId: "", delayMinutos: 0 }] as Array<{
      ordem: number; tipo: string; templateId: string; delayMinutos: number;
    }>,
  });

  const { data: sequencias = [] } = useQuery<Sequencia[]>({
    queryKey: ["email-sequencias"],
    queryFn: async () => {
      const res = await fetch("/api/email/sequencias");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["email-templates-list"],
    queryFn: async () => {
      const res = await fetch("/api/email/templates");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleCreate = async () => {
    const res = await fetch("/api/email/sequencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        passos: form.passos.map((p) => ({
          ...p,
          templateId: p.templateId || undefined,
        })),
      }),
    });
    if (res.ok) {
      setCreating(false);
      setForm({ nome: "", descricao: "", gatilho: "manual", passos: [{ ordem: 0, tipo: "email", templateId: "", delayMinutos: 0 }] });
      queryClient.invalidateQueries({ queryKey: ["email-sequencias"] });
    }
  };

  const handleToggle = async (seq: Sequencia) => {
    await fetch(`/api/email/sequencias/${seq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !seq.ativo }),
    });
    queryClient.invalidateQueries({ queryKey: ["email-sequencias"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta sequência?")) return;
    try {
      const res = await fetch(`/api/email/sequencias/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Falha ao excluir" }));
        toast.error(err.error || "Falha ao excluir sequência");
        return;
      }
      toast.success("Sequência excluída");
      queryClient.invalidateQueries({ queryKey: ["email-sequencias"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  };

  const addStep = () => {
    setForm({
      ...form,
      passos: [...form.passos, { ordem: form.passos.length, tipo: "email", templateId: "", delayMinutos: 60 }],
    });
  };

  const removeStep = (idx: number) => {
    setForm({
      ...form,
      passos: form.passos.filter((_, i) => i !== idx).map((p, i) => ({ ...p, ordem: i })),
    });
  };

  const updateStep = (idx: number, updates: Partial<typeof form.passos[0]>) => {
    const newPassos = [...form.passos];
    newPassos[idx] = { ...newPassos[idx], ...updates };
    setForm({ ...form, passos: newPassos });
  };

  const gatilhoLabel = (g: string) => {
    if (g === "manual") return "Manual";
    if (g === "novo_lead") return "Novo lead";
    if (g === "mudanca_status") return "Mudança de status";
    return g;
  };

  const stepIcon = (tipo: string) => {
    if (tipo === "email") return <Mail className="w-3.5 h-3.5 text-blue-400" />;
    if (tipo === "espera") return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    if (tipo === "condicao") return <GitBranch className="w-3.5 h-3.5 text-purple-400" />;
    return <Mail className="w-3.5 h-3.5" />;
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-white/90">Sequências de Email</h1>
          <p className="text-[12px] text-white/40 mt-0.5">Automações multi-passo com emails e condições</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
            style={{ background: "#3B82F6" }}
          >
            <Plus className="w-3.5 h-3.5" /> Nova sequência
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-medium text-white/80">Nova sequência</h3>
            <button onClick={() => setCreating(false)} className="text-white/30 hover:text-white/50">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-white/40 block mb-1">Nome</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Prospecção inicial"
                  className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              </div>
              <div>
                <label className="text-[11px] text-white/40 block mb-1">Gatilho</label>
                <select
                  value={form.gatilho}
                  onChange={(e) => setForm({ ...form, gatilho: e.target.value as typeof form.gatilho })}
                  className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <option value="manual">Manual</option>
                  <option value="novo_lead">Novo lead</option>
                  <option value="mudanca_status">Mudança de status</option>
                </select>
                <p className="text-[10px] text-white/25 mt-0.5">
                  {form.gatilho === "manual" && "Executada sob demanda em leads selecionados."}
                  {form.gatilho === "novo_lead" && "Dispara automaticamente quando um novo lead é criado."}
                  {form.gatilho === "mudanca_status" && "Dispara quando o status de um lead muda no funil."}
                </p>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-white/40 block mb-1">Descrição (opcional)</label>
              <input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            </div>

            {/* Steps editor */}
            <div>
              <label className="text-[11px] text-white/40 block mb-2">Passos</label>
              <div className="space-y-2">
                {form.passos.map((passo, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <span className="text-[10px] text-white/30 w-5">{idx + 1}.</span>
                    <select
                      value={passo.tipo}
                      onChange={(e) => updateStep(idx, { tipo: e.target.value })}
                      className="px-2 py-1 rounded text-[11px] text-white/70 outline-none"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <option value="email">Email</option>
                      <option value="espera">Espera</option>
                      <option value="condicao">Condição</option>
                    </select>

                    {passo.tipo === "email" && (
                      <select
                        value={passo.templateId}
                        onChange={(e) => updateStep(idx, { templateId: e.target.value })}
                        className="flex-1 px-2 py-1 rounded text-[11px] text-white/70 outline-none"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <option value="">Selecionar template...</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-white/20" />
                      <input
                        type="number"
                        value={passo.delayMinutos}
                        onChange={(e) => updateStep(idx, { delayMinutos: parseInt(e.target.value) || 0 })}
                        className="w-16 px-2 py-1 rounded text-[11px] text-white/70 outline-none"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      />
                      <span className="text-[10px] text-white/30">min</span>
                    </div>

                    {form.passos.length > 1 && (
                      <button onClick={() => removeStep(idx)} className="p-1 rounded hover:bg-white/5">
                        <X className="w-3 h-3 text-red-400/50" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addStep}
                className="mt-2 flex items-center gap-1 px-2 py-1 rounded text-[11px] text-white/40 hover:text-white/60 hover:bg-white/5"
              >
                <Plus className="w-3 h-3" /> Adicionar passo
              </button>
            </div>

            <button
              onClick={handleCreate}
              disabled={!form.nome || form.passos.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white disabled:opacity-40"
              style={{ background: "#3B82F6" }}
            >
              <Save className="w-3 h-3" /> Criar sequência
            </button>
          </div>
        </div>
      )}

      {/* Sequence list */}
      {sequencias.length === 0 && !creating ? (
        <div className="text-center py-12 text-white/30 text-[13px]">
          <GitBranch className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhuma sequência criada</p>
          <p className="text-[10px] text-white/25 mt-1">Sequências automatizam follow-ups e nutrição de leads com emails programados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequencias.map((seq) => (
            <div
              key={seq.id}
              className="p-4 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[14px] font-medium ${seq.ativo ? "text-white/80" : "text-white/40"}`}>
                    {seq.nome}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0 rounded ${seq.ativo ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-white/30"}`}>
                    {seq.ativo ? "Ativa" : "Inativa"}
                  </span>
                  <span className="text-[10px] text-white/30 px-1.5 py-0 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
                    {gatilhoLabel(seq.gatilho)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggle(seq)} className="p-1.5 rounded hover:bg-white/5" title={seq.ativo ? "Desativar" : "Ativar"}>
                    {seq.ativo ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <button onClick={() => handleDelete(seq.id)} className="p-1.5 rounded hover:bg-white/5">
                    <Trash2 className="w-3.5 h-3.5 text-red-400/50" />
                  </button>
                </div>
              </div>
              {seq.descricao && <p className="text-[11px] text-white/40 mt-1">{seq.descricao}</p>}

              {/* Steps timeline */}
              <div className="mt-3 flex items-center gap-1 flex-wrap">
                {seq.passos.map((passo, idx) => (
                  <div key={passo.id} className="flex items-center gap-1">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>
                      {stepIcon(passo.tipo)}
                      <span className="text-[10px] text-white/50">
                        {passo.tipo === "email" ? "Email" : passo.tipo === "espera" ? `${passo.delayMinutos}min` : "Condição"}
                      </span>
                    </div>
                    {idx < seq.passos.length - 1 && <span className="text-[10px] text-white/20">→</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
