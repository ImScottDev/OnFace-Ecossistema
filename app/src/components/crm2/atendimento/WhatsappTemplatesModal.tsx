"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Plus, Pencil, Trash2 } from "lucide-react";

interface Template {
  id: string;
  nome: string;
  categoria: string;
  conteudo: string;
  ativo: boolean;
}

const CATEGORIAS = [
  { value: "primeiro_contato", label: "Primeiro contato" },
  { value: "follow_up", label: "Follow-up" },
  { value: "proposta", label: "Proposta" },
  { value: "pos_venda", label: "Pós-venda" },
  { value: "geral", label: "Geral" },
];

/**
 * CRUD real de templates de WhatsApp (19/08, correção de escopo) — o
 * backend (GET/POST/PATCH/DELETE /whatsapp/templates) sempre existiu, mas
 * nenhuma tela criava/editava, só lia. Sem isso o picker de template do
 * Atendimento fica pra sempre vazio. Não escrevo o TEXTO final dos
 * templates (isso é copy de outreach real, passa pelo checkpoint de tom de
 * voz do CLAUDE.md) — só a estrutura funcional. Seed abaixo é só rótulo de
 * exemplo, marcado como tal.
 */
export function WhatsappTemplatesModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Template | null>(null);
  const [criando, setCriando] = useState(false);

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/templates");
      if (!r.ok) return [];
      const body = await r.json();
      return body?.templates ?? [];
    },
  });

  const salvar = useMutation({
    mutationFn: async (t: { id?: string; nome: string; categoria: string; conteudo: string }) => {
      const url = t.id ? `/api/whatsapp/templates/${t.id}` : "/api/whatsapp/templates";
      const r = await fetch(url, {
        method: t.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: t.nome, categoria: t.categoria, conteudo: t.conteudo }),
      });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      setEditando(null);
      setCriando(false);
      toast.success("Template salvo");
    },
    onError: () => toast.error("Não foi possível salvar o template"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/whatsapp/templates/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-templates"] }),
    onError: () => toast.error("Não foi possível remover o template"),
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--cf2-bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <p className="text-[15px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Templates de WhatsApp</p>
          <button onClick={onClose} aria-label="Fechar"><X className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {templates.length === 0 && !criando && (
            <p className="text-[13px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>
              Nenhum template cadastrado ainda. Crie o primeiro abaixo.
            </p>
          )}
          {templates.map((t) => (
            <div key={t.id} className="p-3 rounded-xl flex items-start justify-between gap-2" style={{ background: "var(--cf2-bg-surface-muted)" }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{t.nome}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>
                    {CATEGORIAS.find((c) => c.value === t.categoria)?.label || t.categoria}
                  </span>
                </div>
                <p className="text-[12px] mt-1 line-clamp-2" style={{ color: "var(--cf2-text-secondary)" }}>{t.conteudo}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setEditando(t)} className="p-1.5 rounded-lg hover:bg-[var(--cf2-bg-surface)]"><Pencil className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
                <button onClick={() => remover.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-[var(--cf2-bg-surface)]"><Trash2 className="w-3.5 h-3.5" style={{ color: "var(--cf2-danger-text)" }} /></button>
              </div>
            </div>
          ))}

          {(criando || editando) && (
            <TemplateForm
              inicial={editando}
              onSalvar={(t) => salvar.mutate({ id: editando?.id, ...t })}
              onCancelar={() => { setCriando(false); setEditando(null); }}
              salvando={salvar.isPending}
            />
          )}
        </div>

        {!criando && !editando && (
          <div className="p-4 shrink-0" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
            <button
              onClick={() => setCriando(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold"
              style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
            >
              <Plus className="w-4 h-4" /> Novo template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateForm({
  inicial, onSalvar, onCancelar, salvando,
}: {
  inicial: Template | null;
  onSalvar: (t: { nome: string; categoria: string; conteudo: string }) => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [categoria, setCategoria] = useState(inicial?.categoria || "geral");
  const [conteudo, setConteudo] = useState(inicial?.conteudo || "");

  return (
    <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do template" aria-label="Nome do template"
        className="px-3 py-2 rounded-lg text-[13px] outline-none"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
      />
      <select
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        className="px-3 py-2 rounded-lg text-[13px] outline-none"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
      >
        {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <textarea
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        placeholder="Texto da mensagem — use {{nome}} e {{empresa}} para variáveis"
        rows={4}
        className="px-3 py-2 rounded-lg text-[13px] outline-none resize-none"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
        <button
          onClick={() => nome.trim() && conteudo.trim() && onSalvar({ nome: nome.trim(), categoria, conteudo: conteudo.trim() })}
          disabled={salvando || !nome.trim() || !conteudo.trim()}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
          style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
