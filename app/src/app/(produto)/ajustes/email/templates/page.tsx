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
          <h1 className="text-[18px] font-bold text-[var(--cf2-text-primary)]">Templates de Email</h1>
          <p className="text-[12px] text-[var(--cf2-text-tertiary)] mt-0.5">
            Use {"{{variável}}"} para interpolação automática (nome, empresa, cargo, etc.)
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--cf2-text-primary)]"
            style={{ background: "#3B82F6" }}
          >
            <Plus className="w-3.5 h-3.5" /> Novo template
          </button>
        )}
      </div>

      {/* Editor */}
      {isEditing && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-bg-surface-muted)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-[var(--cf2-text-primary)]">{creating ? "Novo template" : "Editar template"}</h3>
            <button onClick={() => { setEditing(null); setCreating(false); }} className="text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Nome</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Follow-up inicial" aria-label="Ex: Follow-up inicial"
                  className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Categoria</label>
                <input
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Ex: prospecção" aria-label="Ex: prospecção"
                  className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Assunto</label>
              <input
                value={form.assunto}
                onChange={(e) => setForm({ ...form, assunto: e.target.value })}
                placeholder="Olá {{nome}}, ..." aria-label="Olá {{nome}},"
                className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                style={{ background: "var(--cf2-bg-surface-muted)" }}
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Corpo (HTML)</label>
              <textarea
                value={form.corpo}
                onChange={(e) => setForm({ ...form, corpo: e.target.value })}
                placeholder="<p>Olá {{nome}},</p><p>Espero que esteja bem...</p>" aria-label="<p>Olá {{nome}},</p><p>Espero que esteja bem</p>"
                rows={8}
                className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none resize-none font-mono"
                style={{ background: "var(--cf2-bg-surface-muted)" }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={creating ? handleCreate : handleUpdate}
                disabled={!form.nome || !form.assunto || !form.corpo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-[var(--cf2-text-primary)] disabled:opacity-40"
                style={{ background: "#3B82F6" }}
              >
                <Save className="w-3 h-3" /> {creating ? "Criar" : "Salvar"}
              </button>
              <span className="text-[10px] text-[var(--cf2-text-tertiary)]">
                Variáveis disponíveis: {"{{nome}}, {{sobrenome}}, {{email}}, {{empresa}}, {{cargo}}, {{telefone}}"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 && !isEditing ? (
        <div className="text-center py-12 text-[var(--cf2-text-tertiary)] text-[13px]">
          <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum template criado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-bg-surface-muted)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[var(--cf2-text-primary)]">{t.nome}</span>
                  {t.categoria && (
                    <span className="text-[10px] px-1.5 py-0 rounded text-[var(--cf2-text-tertiary)]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      {t.categoria}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--cf2-text-secondary)] mt-0.5">{t.assunto}</p>
                {t.variaveis && t.variaveis.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {(t.variaveis as string[]).map((v) => (
                      <span key={v} className="text-[9px] px-1 py-0 rounded text-[var(--cf2-text-secondary)]/60" style={{ background: "rgba(59,130,246,0.1)" }}>
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setPreview(preview?.id === t.id ? null : t)} className="p-1 rounded hover:bg-[var(--cf2-bg-surface-muted)]" title="Preview">
                  <Eye className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                </button>
                <button onClick={() => startEdit(t)} className="p-1 rounded hover:bg-[var(--cf2-bg-surface-muted)]" title="Editar">
                  <Edit3 className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-1 rounded hover:bg-[var(--cf2-bg-surface-muted)]" title="Excluir">
                  <Trash2 className="w-3.5 h-3.5 text-[var(--cf2-danger-text)]/50" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="mt-4 p-4 rounded-lg" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[12px] font-medium text-[var(--cf2-text-secondary)]">Preview: {preview.nome}</h4>
            <button onClick={() => setPreview(null)} className="text-[var(--cf2-text-tertiary)]"><X className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[12px] text-[var(--cf2-text-secondary)] font-medium mb-2">{preview.assunto}</p>
          <div className="text-[12px] text-[var(--cf2-text-secondary)] leading-relaxed" dangerouslySetInnerHTML={{ __html: preview.corpo }} />
        </div>
      )}
    </div>
  );
}
