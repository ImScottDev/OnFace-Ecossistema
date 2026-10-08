"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Trash2, Edit3, X, Save } from "lucide-react";
import { toast } from "sonner";

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: "recorrente" | "avulso" | "setup";
  valorSugerido: string | null;
  unidade: "mensal" | "hora" | "unidade" | "projeto";
  serviceFamily?: string;
  precosOficiais?: number;
  ativo: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

const tipoBadge: Record<string, string> = {
  recorrente: "bg-emerald-500/15 text-[var(--cf2-success-text)]",
  avulso: "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)]",
  setup: "bg-[var(--cf2-warning-bg)] text-[var(--cf2-warning-text)]",
};

const unidadeLabel: Record<string, string> = {
  mensal: "Mensal",
  hora: "Por hora",
  unidade: "Por unidade",
  projeto: "Por projeto",
};

function formatCurrency(value: string | null): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ServicosCatalogoPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Servico | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    tipo: "recorrente" as string,
    valorSugerido: "",
    unidade: "mensal" as string,
    serviceFamily: "UNKNOWN" as string,
  });

  const { data: servicos = [] } = useQuery<Servico[]>({
    queryKey: ["servicos-catalogo"],
    queryFn: async () => {
      // incluirNaoClassificados: o que se cria aqui nasce sem família e sumiria desta própria lista.
      const res = await fetch("/api/servicos-catalogo?incluirNaoClassificados=true");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleCreate = async () => {
    const res = await fetch("/api/servicos-catalogo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        descricao: form.descricao || undefined,
        tipo: form.tipo,
        valorSugerido: form.valorSugerido || undefined,
        unidade: form.unidade,
        serviceFamily: form.serviceFamily,
      }),
    });
    if (res.ok) {
      toast.success("Serviço criado");
      setCreating(false);
      setForm({ nome: "", descricao: "", tipo: "recorrente", valorSugerido: "", unidade: "mensal", serviceFamily: "UNKNOWN" });
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
    } else {
      toast.error("Não foi possível criar o serviço");
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const res = await fetch(`/api/servicos-catalogo/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        descricao: form.descricao || null,
        tipo: form.tipo,
        valorSugerido: form.valorSugerido || null,
        unidade: form.unidade,
        serviceFamily: form.serviceFamily,
      }),
    });
    if (!res.ok) { toast.error("Não foi possível salvar o serviço"); return; }
    toast.success("Serviço salvo");
    setEditing(null);
    setForm({ nome: "", descricao: "", tipo: "recorrente", valorSugerido: "", unidade: "mensal", serviceFamily: "UNKNOWN" });
    queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este serviço?")) return;
    const res = await fetch(`/api/servicos-catalogo/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Não foi possível excluir o serviço"); return; }
    toast.success("Serviço excluído");
    queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
  };

  const startEdit = (s: Servico) => {
    setEditing(s);
    setCreating(false);
    setForm({
      nome: s.nome,
      descricao: s.descricao || "",
      tipo: s.tipo,
      valorSugerido: s.valorSugerido || "",
      unidade: s.unidade,
      serviceFamily: s.serviceFamily || "UNKNOWN",
    });
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ nome: "", descricao: "", tipo: "recorrente", valorSugerido: "", unidade: "mensal", serviceFamily: "UNKNOWN" });
  };

  const isEditing = editing || creating;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[12px] text-[var(--cf2-text-tertiary)] mt-0.5">
            Gerencie os serviços oferecidos pela sua organização
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--cf2-text-primary)]"
            style={{ background: "#3B82F6" }}
          >
            <Plus className="w-3.5 h-3.5" /> Novo serviço
          </button>
        )}
      </div>

      {/* Editor */}
      {isEditing && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-bg-surface-muted)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-[var(--cf2-text-primary)]">{creating ? "Novo serviço" : "Editar serviço"}</h3>
            <button onClick={() => { setEditing(null); setCreating(false); }} className="text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Nome *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Monitoramento SOC" aria-label="Ex: Monitoramento SOC"
                  className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Descrição</label>
                <input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Breve descrição do serviço" aria-label="Breve descrição do serviço"
                  className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                >
                  <option value="recorrente">Recorrente</option>
                  <option value="avulso">Avulso</option>
                  <option value="setup">Setup</option>
                </select>
                <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-0.5">Recorrente: cobrado mensalmente. Avulso: valor único. Setup: taxa de implementação.</p>
              </div>
              <div>
                <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Valor Sugerido</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorSugerido}
                  onChange={(e) => setForm({ ...form, valorSugerido: e.target.value })}
                  placeholder="0,00" aria-label="0,00"
                  className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                />
                <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-0.5">Pré-preenchido ao adicionar este serviço em propostas.</p>
              </div>
              <div>
                <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Unidade</label>
                <select
                  value={form.unidade}
                  onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                  className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                  style={{ background: "var(--cf2-bg-surface-muted)" }}
                >
                  <option value="mensal">Mensal</option>
                  <option value="hora">Por hora</option>
                  <option value="unidade">Por unidade</option>
                  <option value="projeto">Por projeto</option>
                </select>
              </div>
            </div>
            <div className="max-w-xs">
              <label className="text-[11px] text-[var(--cf2-text-tertiary)] block mb-1">Família</label>
              <select
                value={form.serviceFamily}
                onChange={(e) => setForm({ ...form, serviceFamily: e.target.value })}
                className="w-full px-3 py-1.5 rounded text-[12px] text-[var(--cf2-text-primary)] outline-none"
                style={{ background: "var(--cf2-bg-surface-muted)" }}
              >
                <option value="UNKNOWN">Sem família</option>
                <option value="PABX">PABX</option>
                <option value="CALLFACE_AI">Callface AI</option>
                <option value="WHITE_LABEL">White Label</option>
              </select>
              <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-0.5">A proposta só lista serviços da família da oportunidade, e só os que têm preço no catálogo oficial.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={creating ? handleCreate : handleUpdate}
                disabled={!form.nome}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-[var(--cf2-text-primary)] disabled:opacity-40"
                style={{ background: "#3B82F6" }}
              >
                <Save className="w-3 h-3" /> {creating ? "Criar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service list */}
      {servicos.length === 0 && !isEditing ? (
        <div className="text-center py-12 text-[var(--cf2-text-tertiary)] text-[13px]">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum serviço cadastrado</p>
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">O seletor da proposta lê o catálogo oficial: serviço com família e preço cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {servicos.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-bg-surface-muted)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[var(--cf2-text-primary)]">{s.nome}</span>
                  <span className={`text-[10px] px-1.5 py-0 rounded ${tipoBadge[s.tipo]}`}>
                    {s.tipo}
                  </span>
                  {s.serviceFamily && s.serviceFamily !== "UNKNOWN" ? (
                    <span className="text-[10px] px-1.5 py-0 rounded text-[var(--cf2-text-tertiary)]" style={{ background: "var(--cf2-bg-surface-muted)" }}>{s.serviceFamily.replace("_", " ")}</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0 rounded text-[var(--cf2-warning-text)]" style={{ background: "var(--cf2-bg-surface-muted)" }}>sem família</span>
                  )}
                  {s.serviceFamily && s.serviceFamily !== "UNKNOWN" && s.precosOficiais === 0 && (
                    <span className="text-[10px] px-1.5 py-0 rounded text-[var(--cf2-warning-text)]" style={{ background: "var(--cf2-bg-surface-muted)" }} title="A proposta só lista serviços com preço no catálogo oficial (Ajustes > Catálogo).">fora das propostas: sem preço oficial</span>
                  )}
                  {!s.ativo && <span className="text-[10px] text-[var(--cf2-text-tertiary)]">inativo</span>}
                </div>
                {s.descricao && (
                  <p className="text-[11px] text-[var(--cf2-text-secondary)] mt-0.5">{s.descricao}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-[var(--cf2-text-secondary)] font-medium">
                    {formatCurrency(s.valorSugerido)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0 rounded text-[var(--cf2-text-tertiary)]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                    {unidadeLabel[s.unidade]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => startEdit(s)} className="p-1 rounded hover:bg-[var(--cf2-bg-surface-muted)]" title="Editar">
                  <Edit3 className="w-3.5 h-3.5 text-[var(--cf2-text-tertiary)]" />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1 rounded hover:bg-[var(--cf2-bg-surface-muted)]" title="Excluir">
                  <Trash2 className="w-3.5 h-3.5 text-[var(--cf2-danger-text)]/50" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
