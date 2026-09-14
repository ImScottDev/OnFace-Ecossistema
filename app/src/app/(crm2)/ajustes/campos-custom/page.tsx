"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { toast } from "sonner";

interface CustomField {
  id: string;
  entidade: string;
  nome: string;
  label: string;
  tipo: string;
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
}

const ENTIDADES = [
  { key: "lead", label: "Lead" },
  { key: "empresa", label: "Empresa" },
  { key: "negocio", label: "Negócio" },
];

const TIPOS = [
  { key: "text", label: "Texto" },
  { key: "number", label: "Número" },
  { key: "date", label: "Data" },
  { key: "daterange", label: "Período" },
  { key: "enum", label: "Lista/Opções" },
  { key: "boolean", label: "Sim/Não" },
  { key: "url", label: "URL" },
];

export default function CamposCustomPage() {
  const queryClient = useQueryClient();
  const [selectedEntidade, setSelectedEntidade] = useState("negocio");
  const [adding, setAdding] = useState(false);
  const [newField, setNewField] = useState({ nome: "", label: "", tipo: "text", opcoes: "" });

  const { data: fields = [], isLoading } = useQuery<CustomField[]>({
    queryKey: ["custom-fields", selectedEntidade],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields?entidade=${selectedEntidade}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const slugify = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const handleAdd = async () => {
    if (!newField.label.trim()) { toast.error("Preencha o nome do campo"); return; }

    const nome = newField.nome || slugify(newField.label);
    const opcoes = newField.tipo === "enum" ? newField.opcoes.split(",").map((s) => s.trim()).filter(Boolean) : null;

    const res = await fetch("/api/custom-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entidade: selectedEntidade,
        nome,
        label: newField.label,
        tipo: newField.tipo,
        opcoes,
        ordem: fields.length,
      }),
    });

    if (res.ok) {
      toast.success("Campo criado");
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      setAdding(false);
      setNewField({ nome: "", label: "", tipo: "text", opcoes: "" });
    } else {
      const err = await res.json();
      toast.error(err.error || "Erro ao criar campo");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Campo removido");
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[var(--cf2-text-primary)]">Campos Personalizados</h2>
        <p className="text-xs text-[var(--cf2-text-tertiary)] mt-0.5">Crie campos adicionais para leads, empresas e negócios</p>
      </div>

      {/* Entidade tabs */}
      <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        {ENTIDADES.map((e) => (
          <button
            key={e.key}
            onClick={() => setSelectedEntidade(e.key)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedEntidade === e.key ? "text-[var(--cf2-text-primary)] bg-[var(--cf2-bg-surface-muted)]" : "text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Fields list */}
      <div className="bg-[var(--cf2-bg-surface)] rounded-xl border border-[var(--cf2-border-default)] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[var(--cf2-text-tertiary)] text-sm">Carregando...</div>
        ) : fields.length === 0 && !adding ? (
          <div className="p-8 text-center text-[var(--cf2-text-tertiary)] text-sm">
            Nenhum campo personalizado para {ENTIDADES.find((e) => e.key === selectedEntidade)?.label}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--cf2-border-default)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--cf2-text-secondary)] uppercase">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--cf2-text-secondary)] uppercase" title="Gerado automaticamente. Usado internamente para identificar o campo.">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--cf2-text-secondary)] uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--cf2-text-secondary)] uppercase">Opções</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-b border-[var(--cf2-border-default)]">
                  <td className="px-4 py-3 text-[var(--cf2-text-primary)] font-medium">{field.label}</td>
                  <td className="px-4 py-3 text-[var(--cf2-text-tertiary)] font-mono text-xs" title="Gerado automaticamente. Usado internamente para identificar o campo.">{field.nome}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)] text-xs">
                      {TIPOS.find((t) => t.key === field.tipo)?.label || field.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--cf2-text-tertiary)] text-xs">
                    {field.opcoes?.join(", ") || "—"}
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => handleDelete(field.id)} className="p-1 text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-danger-text)] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add new field form */}
        {adding && (
          <div className="p-4 border-t border-[var(--cf2-border-default)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--cf2-text-secondary)] mb-1 block">Nome de exibição</label>
                <input
                  type="text"
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value, nome: slugify(e.target.value) })}
                  className="cf2-input w-full text-sm"
                  placeholder="Ex: Período de Contrato" aria-label="Ex: Período de Contrato"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-[var(--cf2-text-secondary)] mb-1 block">Tipo</label>
                <select
                  value={newField.tipo}
                  onChange={(e) => setNewField({ ...newField, tipo: e.target.value })}
                  className="cf2-input w-full text-sm"
                >
                  {TIPOS.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                {newField.tipo === "daterange" && (
                  <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-0.5">Intervalo de datas (início e fim). Use &apos;Data&apos; para uma data única.</p>
                )}
              </div>
            </div>
            {newField.tipo === "enum" && (
              <div>
                <label className="text-xs text-[var(--cf2-text-secondary)] mb-1 block">Opções (separadas por vírgula)</label>
                <input
                  type="text"
                  value={newField.opcoes}
                  onChange={(e) => setNewField({ ...newField, opcoes: e.target.value })}
                  className="cf2-input w-full text-sm"
                  placeholder="opção 1, opção 2, opção 3" aria-label="opção 1, opção 2, opção 3"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={handleAdd} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)] hover:brightness-110 transition-colors">
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
              <button onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--cf2-text-secondary)] hover:text-[var(--cf2-text-primary)] border border-dashed border-[var(--cf2-border-default)] hover:border-[var(--cf2-border-default)] rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Adicionar campo
        </button>
      )}
    </div>
  );
}
