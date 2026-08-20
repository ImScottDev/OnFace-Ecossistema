"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  nome: string;
  versao: number;
  commercialModel: string | null;
  corpoTemplate: string;
  ativo: boolean;
}

const MODELOS = [
  { value: "", label: "Genérico (qualquer modelo)" },
  { value: "PAGAMENTO_DIRETO", label: "Pagamento direto" },
  { value: "CONTRATO_OBRIGATORIO", label: "Contrato obrigatório" },
  { value: "CONTRATO_FIDELIDADE_OPCIONAL", label: "Contrato com fidelidade opcional" },
];

// Dados fictícios pro preview — mesmas chaves reais que
// lib/crm/contrato-template.ts usa pra renderizar de verdade.
const PREVIEW_VARS: Record<string, string> = {
  empresa_nome: "Empresa Exemplo LTDA",
  empresa_cnpj: "12.345.678/0001-90",
  pessoa_nome: "Fulano da Silva",
  pessoa_email: "fulano@empresaexemplo.com.br",
  itens_descricao: "Callface AI - Plano Business (recorrente)",
  valor_total: "R$ 899,00",
  prazo_descricao: "conforme condições comerciais acordadas na proposta",
  condicoes_pagamento: "conforme proposta",
};

function renderizarPreview(corpo: string): string {
  return corpo.replace(/\{\{(\w+)\}\}/g, (_, chave) => PREVIEW_VARS[chave] ?? `{{${chave}}}`);
}

/**
 * Ajustes → Contratos (19/08, P0.2) — gestão real dos Contract Templates.
 * O schema/motor de render já existia (lib/crm/contrato-template.ts), só
 * não tinha CRUD nem UI — só nascia por seed/SQL direto. Não inventa
 * cláusula jurídica: o corpo é o que o time escrever, preview usa dado
 * fictício claramente rotulado como exemplo.
 */
export function Cf2ContratoTemplatesWorkspace() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Template | null>(null);
  const [criando, setCriando] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);

  const { data } = useQuery<{ templates: Template[] }>({
    queryKey: ["cf2-contrato-templates"],
    queryFn: async () => {
      const r = await fetch("/api/contrato-templates");
      if (!r.ok) return { templates: [] };
      return r.json();
    },
  });
  const templates = data?.templates ?? [];

  const salvar = useMutation({
    mutationFn: async (t: { id?: string; nome: string; commercialModel: string | null; corpoTemplate: string }) => {
      const url = t.id ? `/api/contrato-templates/${t.id}` : "/api/contrato-templates";
      const r = await fetch(url, { method: t.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: t.nome, commercialModel: t.commercialModel, corpoTemplate: t.corpoTemplate }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cf2-contrato-templates"] }); setEditando(null); setCriando(false); toast.success("Template salvo"); },
    onError: () => toast.error("Não foi possível salvar o template"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/contrato-templates/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-contrato-templates"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      {!criando && !editando && (
        <button onClick={() => setCriando(true)} className="w-fit flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
          <Plus className="w-3.5 h-3.5" /> Novo template
        </button>
      )}

      {(criando || editando) && (
        <TemplateForm inicial={editando} onSalvar={(t) => salvar.mutate({ id: editando?.id, ...t })} onCancelar={() => { setCriando(false); setEditando(null); }} salvando={salvar.isPending} />
      )}

      <div className="flex flex-col gap-2">
        {templates.length === 0 && !criando && (
          <p className="text-[13px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum template cadastrado ainda.</p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{t.nome}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>v{t.versao}</span>
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{MODELOS.find((m) => m.value === (t.commercialModel || ""))?.label}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setPreview(t)} className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}><Eye className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></button>
              <button onClick={() => setEditando(t)} className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}><Pencil className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></button>
              <button onClick={() => remover.mutate(t.id)} className="p-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}><Trash2 className="w-3.5 h-3.5" style={{ color: "var(--cf2-danger-text)" }} /></button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setPreview(null)}>
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl p-6" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-bold mb-3 px-2 py-1 rounded w-fit" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}>PREVIEW — dados fictícios de exemplo</p>
            <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-primary)" }}>{renderizarPreview(preview.corpoTemplate)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateForm({ inicial, onSalvar, onCancelar, salvando }: { inicial: Template | null; onSalvar: (t: { nome: string; commercialModel: string | null; corpoTemplate: string }) => void; onCancelar: () => void; salvando: boolean }) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [commercialModel, setCommercialModel] = useState(inicial?.commercialModel || "");
  const [corpoTemplate, setCorpoTemplate] = useState(inicial?.corpoTemplate || "");

  return (
    <div className="p-4 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do template" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
      <select value={commercialModel} onChange={(e) => setCommercialModel(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
        {MODELOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <textarea
        value={corpoTemplate}
        onChange={(e) => setCorpoTemplate(e.target.value)}
        placeholder="Corpo do contrato — use {{empresa_nome}}, {{empresa_cnpj}}, {{pessoa_nome}}, {{pessoa_email}}, {{itens_descricao}}, {{valor_total}}, {{prazo_descricao}}, {{condicoes_pagamento}}"
        rows={10}
        className="px-3 py-2 rounded-lg text-[13px] outline-none resize-none font-mono"
        style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
        <button
          onClick={() => nome.trim() && corpoTemplate.trim() && onSalvar({ nome: nome.trim(), commercialModel: commercialModel || null, corpoTemplate: corpoTemplate.trim() })}
          disabled={salvando || !nome.trim() || !corpoTemplate.trim()}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
          style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
