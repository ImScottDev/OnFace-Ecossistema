"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, X, Check, GripVertical } from "lucide-react";

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  valorSugerido: string | null;
  unidade: string;
  ativo: boolean;
  ordem: number;
}

const TIPOS = [
  { value: "recorrente", label: "Recorrente", color: "#3B82F6" },
  { value: "avulso", label: "Avulso", color: "#F59E0B" },
  { value: "setup", label: "Setup", color: "#8B5CF6" },
];

const UNIDADES = [
  { value: "mensal", label: "Mensal" },
  { value: "hora", label: "Por hora" },
  { value: "unidade", label: "Por unidade" },
  { value: "projeto", label: "Por projeto" },
];

export function ServiceCatalogManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", tipo: "recorrente", valorSugerido: "", unidade: "mensal" });

  const { data: servicos, isLoading } = useQuery<Servico[]>({
    queryKey: ["servicos-catalogo"],
    queryFn: async () => {
      const res = await fetch("/api/servicos-catalogo?all=true");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/servicos-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, valorSugerido: data.valorSugerido || undefined }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      setShowAdd(false);
      setForm({ nome: "", descricao: "", tipo: "recorrente", valorSugerido: "", unidade: "mensal" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Servico>) => {
      const res = await fetch(`/api/servicos-catalogo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      setEditingId(null);
    },
  });

  const toggleAtivo = (s: Servico) => updateMutation.mutate({ id: s.id, ativo: !s.ativo });

  return (
    <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Catálogo de Serviços</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-500/15 text-blue-400 rounded-lg hover:bg-blue-500/25 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do serviço" className="dark-input" />
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="dark-input">
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={form.valorSugerido} onChange={e => setForm({ ...form, valorSugerido: e.target.value })} placeholder="Valor sugerido (R$)" className="dark-input" type="number" step="0.01" />
            <select value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} className="dark-input">
              {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição (opcional)" className="dark-input" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancelar</button>
            <button onClick={() => form.nome && createMutation.mutate(form)} disabled={!form.nome || createMutation.isPending}
              className="px-3 py-1.5 text-xs bg-blue-500/80 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-white/30">Carregando...</p>
      ) : (
        <div className="space-y-1">
          {servicos?.map(s => {
            const tipoInfo = TIPOS.find(t => t.value === s.tipo);
            const unidadeInfo = UNIDADES.find(u => u.value === s.unidade);
            return (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors ${!s.ativo ? "opacity-40" : ""}`}>
                <GripVertical className="w-3.5 h-3.5 text-white/20" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{s.nome}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: (tipoInfo?.color || "#666") + "20", color: tipoInfo?.color }}>
                      {tipoInfo?.label}
                    </span>
                  </div>
                  {s.descricao && <p className="text-xs text-white/40 truncate">{s.descricao}</p>}
                </div>
                <div className="text-right shrink-0">
                  {s.valorSugerido ? (
                    <span className="text-sm text-white/70">R$ {parseFloat(s.valorSugerido).toLocaleString("pt-BR")}</span>
                  ) : (
                    <span className="text-xs text-white/20">Sem preço</span>
                  )}
                  <p className="text-[10px] text-white/30">{unidadeInfo?.label}</p>
                </div>
                <button onClick={() => toggleAtivo(s)} className={`w-8 h-4 rounded-full transition-colors relative ${s.ativo ? "bg-emerald-500" : "bg-white/10"}`}>
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${s.ativo ? "right-0.5" : "left-0.5"}`} />
                </button>
              </div>
            );
          })}
          {(!servicos || servicos.length === 0) && <p className="text-sm text-white/30 py-2">Nenhum serviço no catálogo</p>}
        </div>
      )}
    </div>
  );
}
