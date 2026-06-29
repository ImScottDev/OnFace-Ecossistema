"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Trash2, Edit3, X, Save, Eye } from "lucide-react";

interface EmailTemplate {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  variaveis: string[] | null;
  categoria: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);

  const [form, setForm] = useState({
    nome: "", assunto: "", corpo: "", categoria: "",
  });

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/email/templates");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleCreate = async () => {
    const res = await fetch("/api/email/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setCreating(false);
      setForm({ nome: "", assunto: "", corpo: "", categoria: "" });
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    await fetch(`/api/email/templates/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setEditing(null);
    setForm({ nome: "", assunto: "", corpo: "", categoria: "" });
    queryClient.invalidateQueries({ queryKey: ["email-templates"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await fetch(`/api/email/templates/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["email-templates"] });
  };

  const startEdit = (t: EmailTemplate) => {
    setEditing(t);
    setCreating(false);
    setForm({ nome: t.nome, assunto: t.assunto, corpo: t.corpo, categoria: t.categoria || "" });
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ nome: "", assunto: "", corpo: "", categoria: "" });
  };

  const isEditing = editing || creating;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-white/90">Templates de Email</h1>
          <p className="text-[12px] text-white/40 mt-0.5">
            Use {"{{variável}}"} para interpolação automática (nome, empresa, cargo, etc.)
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white"
            style={{ background: "#3B82F6" }}
          >
            <Plus className="w-3.5 h-3.5" /> Novo template
          </button>
        )}
      </div>

      {/* Editor */}
      {isEditing && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-white/80">{creating ? "Novo template" : "Editar template"}</h3>
            <button onClick={() => { setEditing(null); setCreating(false); }} className="text-white/30 hover:text-white/50">
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
                  placeholder="Ex: Follow-up inicial"
                  className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              </div>
              <div>
                <label className="text-[11px] text-white/40 block mb-1">Categoria</label>
                <input
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Ex: prospecção"
                  className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-white/40 block mb-1">Assunto</label>
              <input
                value={form.assunto}
                onChange={(e) => setForm({ ...form, assunto: e.target.value })}
                placeholder="Olá {{nome}}, ..."
                className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            </div>
            <div>
              <label className="text-[11px] text-white/40 block mb-1">Corpo (HTML)</label>
              <textarea
                value={form.corpo}
                onChange={(e) => setForm({ ...form, corpo: e.target.value })}
                placeholder="<p>Olá {{nome}},</p><p>Espero que esteja bem...</p>"
                rows={8}
                className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none resize-none font-mono"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={creating ? handleCreate : handleUpdate}
                disabled={!form.nome || !form.assunto || !form.corpo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white disabled:opacity-40"
                style={{ background: "#3B82F6" }}
              >
                <Save className="w-3 h-3" /> {creating ? "Criar" : "Salvar"}
              </button>
              <span className="text-[10px] text-white/30">
                Variáveis disponíveis: {"{{nome}}, {{sobrenome}}, {{email}}, {{empresa}}, {{cargo}}, {{telefone}}"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 && !isEditing ? (
        <div className="text-center py-12 text-white/30 text-[13px]">
          <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum template criado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-white/80">{t.nome}</span>
                  {t.categoria && (
                    <span className="text-[10px] px-1.5 py-0 rounded text-white/40" style={{ background: "rgba(255,255,255,0.05)" }}>
                      {t.categoria}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">{t.assunto}</p>
                {t.variaveis && t.variaveis.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {(t.variaveis as string[]).map((v) => (
                      <span key={v} className="text-[9px] px-1 py-0 rounded text-blue-400/60" style={{ background: "rgba(59,130,246,0.1)" }}>
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setPreview(preview?.id === t.id ? null : t)} className="p-1 rounded hover:bg-white/5" title="Preview">
                  <Eye className="w-3.5 h-3.5 text-white/30" />
                </button>
                <button onClick={() => startEdit(t)} className="p-1 rounded hover:bg-white/5" title="Editar">
                  <Edit3 className="w-3.5 h-3.5 text-white/30" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-1 rounded hover:bg-white/5" title="Excluir">
                  <Trash2 className="w-3.5 h-3.5 text-red-400/50" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="mt-4 p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[12px] font-medium text-white/60">Preview: {preview.nome}</h4>
            <button onClick={() => setPreview(null)} className="text-white/30"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[12px] text-white/70 font-medium mb-2">{preview.assunto}</p>
          <div className="text-[12px] text-white/50 leading-relaxed" dangerouslySetInnerHTML={{ __html: preview.corpo }} />
        </div>
      )}
    </div>
  );
}
