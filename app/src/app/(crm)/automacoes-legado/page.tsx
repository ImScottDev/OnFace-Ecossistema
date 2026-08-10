"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Plus, Pencil, Trash2, X } from "lucide-react";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";

interface Condicao {
  campo?: string;
  operador?: "igual" | "diferente" | "contem" | "maior_que" | "menor_que";
  valor?: string;
}

interface AcaoConfig {
  usuarioId?: string;
  tituloTarefa?: string;
  tipoTarefa?: string;
  prioridade?: "baixa" | "media" | "alta";
  novoStatus?: string;
  mensagem?: string;
}

interface Automacao {
  id: string;
  nome: string;
  gatilho: string;
  condicao: Condicao | null;
  acao: string;
  acaoConfig: AcaoConfig | null;
  ativo: boolean;
}

// Só os 7 gatilhos/6 ações reais que o motor (`automacao-engine.ts`) já
// executa de verdade — nenhum aqui é aspiracional, todos já disparam em
// produção (dispararAutomacoes ligado nos 7 call sites reais).
const GATILHOS = [
  { value: "novo_lead", label: "Novo lead criado" },
  { value: "novo_negocio", label: "Novo negócio criado" },
  { value: "mudanca_status", label: "Negócio mudou de status" },
  { value: "whatsapp_recebido", label: "WhatsApp recebido" },
  { value: "contrato_vencendo", label: "Contrato vencendo" },
  { value: "lead_inativo", label: "Lead inativo" },
  { value: "nps_recebido", label: "NPS recebido" },
];

const ACOES = [
  { value: "criar_tarefa", label: "Criar tarefa" },
  { value: "notificar_usuario", label: "Notificar usuário" },
  { value: "atribuir_responsavel", label: "Atribuir responsável" },
  { value: "mudar_status", label: "Mudar status" },
  { value: "enviar_email", label: "Enviar e-mail" },
  { value: "enviar_whatsapp", label: "Enviar WhatsApp" },
];

const OPERADORES = [
  { value: "igual", label: "é igual a" },
  { value: "diferente", label: "é diferente de" },
  { value: "contem", label: "contém" },
  { value: "maior_que", label: "é maior que" },
  { value: "menor_que", label: "é menor que" },
];

const emptyForm = {
  nome: "",
  gatilho: "novo_lead",
  acao: "criar_tarefa",
  condicaoCampo: "",
  condicaoOperador: "igual" as Condicao["operador"],
  condicaoValor: "",
  usuarioId: "",
  tituloTarefa: "",
  prioridade: "media" as AcaoConfig["prioridade"],
  novoStatus: "",
  mensagem: "",
};

export default function AutomacoesPage() {
  const queryClient = useQueryClient();
  const { usuarios } = useOrgUsuarios();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: rules = [], isLoading } = useQuery<Automacao[]>({
    queryKey: ["automacoes"],
    queryFn: async () => {
      const r = await fetch("/api/automacoes");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: execucoes } = useQuery<Record<string, { total: number; ultima: string }>>({
    queryKey: ["automacoes-execucoes"],
    queryFn: async () => {
      const r = await fetch("/api/automacoes/execucoes-resumo");
      if (!r.ok) return {};
      return r.json();
    },
    enabled: rules.length > 0,
  });

  const buildPayload = () => ({
    nome: form.nome,
    gatilho: form.gatilho,
    condicao: form.condicaoCampo ? { campo: form.condicaoCampo, operador: form.condicaoOperador, valor: form.condicaoValor } : null,
    acao: form.acao,
    acaoConfig: {
      ...(form.usuarioId ? { usuarioId: form.usuarioId } : {}),
      ...(form.tituloTarefa ? { tituloTarefa: form.tituloTarefa } : {}),
      ...(form.acao === "criar_tarefa" ? { prioridade: form.prioridade } : {}),
      ...(form.novoStatus ? { novoStatus: form.novoStatus } : {}),
      ...(form.mensagem ? { mensagem: form.mensagem } : {}),
    },
  });

  const saveRule = useMutation({
    mutationFn: async () => {
      const url = editingId ? `/api/automacoes/${editingId}` : "/api/automacoes";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao salvar automação");
      return body;
    },
    onSuccess: () => {
      toast.success(editingId ? "Automação atualizada" : "Automação criada");
      queryClient.invalidateQueries({ queryKey: ["automacoes"] });
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const res = await fetch(`/api/automacoes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar automação");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automacoes"] }),
    onError: () => toast.error("Erro ao atualizar automação"),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/automacoes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir automação");
    },
    onSuccess: () => {
      toast.success("Automação excluída");
      queryClient.invalidateQueries({ queryKey: ["automacoes"] });
    },
    onError: () => toast.error("Erro ao excluir automação"),
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (rule: Automacao) => {
    setEditingId(rule.id);
    setForm({
      nome: rule.nome,
      gatilho: rule.gatilho,
      acao: rule.acao,
      condicaoCampo: rule.condicao?.campo || "",
      condicaoOperador: rule.condicao?.operador || "igual",
      condicaoValor: rule.condicao?.valor || "",
      usuarioId: rule.acaoConfig?.usuarioId || "",
      tituloTarefa: rule.acaoConfig?.tituloTarefa || "",
      prioridade: rule.acaoConfig?.prioridade || "media",
      novoStatus: rule.acaoConfig?.novoStatus || "",
      mensagem: rule.acaoConfig?.mensagem || "",
    });
    setShowForm(true);
  };

  const gatilhoLabel = (v: string) => GATILHOS.find((g) => g.value === v)?.label || v;
  const acaoLabel = (v: string) => ACOES.find((a) => a.value === v)?.label || v;

  return (
    <div className="page-scroll space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automações</h1>
          <p className="text-xs text-white/40 mt-1">Motor real: 7 gatilhos × 6 ações já rodando em produção. Crie ou edite regras aqui.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: "#e23752" }}
        >
          <Plus className="w-4 h-4" /> Nova Automação
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-white/40">Carregando...</p>
      ) : rules.length === 0 ? (
        <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-12 border border-white/[0.06] text-center">
          <Zap className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-white/70">Nenhuma automação configurada ainda</h2>
          <p className="text-sm text-white/40 mt-1">
            O motor já roda de verdade (7 gatilhos ligados) — clique em &quot;Nova Automação&quot; pra cadastrar a 1ª regra.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const exec = execucoes?.[rule.id];
            return (
              <div key={rule.id} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-5 border border-white/[0.06]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-white">{rule.nome}</h3>
                    <p className="text-sm text-white/50">
                      Gatilho: {gatilhoLabel(rule.gatilho)} → Ação: {acaoLabel(rule.acao)}
                    </p>
                    <p className="text-xs text-white/30 mt-1">
                      {exec ? `${exec.total} execução${exec.total === 1 ? "" : "ões"} · última ${new Date(exec.ultima).toLocaleString("pt-BR")}` : "nenhuma execução registrada ainda"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleAtivo.mutate({ id: rule.id, ativo: !rule.ativo })}
                      className={`text-xs px-2 py-1 rounded-full transition-colors ${rule.ativo ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1]"}`}
                    >
                      {rule.ativo ? "Ativa" : "Inativa"}
                    </button>
                    <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Excluir a automação "${rule.nome}"?`)) deleteRule.mutate(rule.id); }}
                      className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={closeForm}>
          <div className="modal-content p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editingId ? "Editar Automação" : "Nova Automação"}</h2>
              <button onClick={closeForm} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-white/50 mb-1 block">Nome *</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full dark-input text-sm" placeholder="Ex: Notificar gestor quando negócio for ganho" />
              </div>
              <div>
                <label className="text-sm text-white/50 mb-1 block">Quando (gatilho)</label>
                <select value={form.gatilho} onChange={(e) => setForm({ ...form, gatilho: e.target.value })} className="w-full dark-input text-sm">
                  {GATILHOS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40 mb-2">Condição (opcional — deixe em branco pra disparar sempre)</p>
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.condicaoCampo} onChange={(e) => setForm({ ...form, condicaoCampo: e.target.value })} className="dark-input text-sm" placeholder="campo (ex: status)" />
                  <select value={form.condicaoOperador} onChange={(e) => setForm({ ...form, condicaoOperador: e.target.value as Condicao["operador"] })} className="dark-input text-sm">
                    {OPERADORES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={form.condicaoValor} onChange={(e) => setForm({ ...form, condicaoValor: e.target.value })} className="dark-input text-sm" placeholder="valor (ex: ganho)" />
                </div>
              </div>

              <div>
                <label className="text-sm text-white/50 mb-1 block">Então (ação)</label>
                <select value={form.acao} onChange={(e) => setForm({ ...form, acao: e.target.value })} className="w-full dark-input text-sm">
                  {ACOES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              {/* Campos condicionais por ação — só os que o motor (automacao-engine.ts) de fato lê */}
              {(form.acao === "criar_tarefa") && (
                <>
                  <input value={form.tituloTarefa} onChange={(e) => setForm({ ...form, tituloTarefa: e.target.value })} className="w-full dark-input text-sm" placeholder="Título da tarefa" />
                  <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value as AcaoConfig["prioridade"] })} className="w-full dark-input text-sm">
                    <option value="baixa">Prioridade baixa</option>
                    <option value="media">Prioridade média</option>
                    <option value="alta">Prioridade alta</option>
                  </select>
                </>
              )}
              {(form.acao === "notificar_usuario" || form.acao === "atribuir_responsavel" || form.acao === "criar_tarefa") && (
                <select value={form.usuarioId} onChange={(e) => setForm({ ...form, usuarioId: e.target.value })} className="w-full dark-input text-sm">
                  <option value="">
                    {form.acao === "criar_tarefa" ? "Sem responsável específico" : "Selecione o usuário *"}
                  </option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              )}
              {form.acao === "mudar_status" && (
                <input value={form.novoStatus} onChange={(e) => setForm({ ...form, novoStatus: e.target.value })} className="w-full dark-input text-sm" placeholder="Novo status (ex: qualifying, reuniao_agendada)" />
              )}
              {(form.acao === "notificar_usuario" || form.acao === "enviar_email" || form.acao === "enviar_whatsapp") && (
                <textarea value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} className="w-full dark-input text-sm" rows={3} placeholder="Mensagem" />
              )}

              <div className="flex gap-2 justify-end mt-4">
                <button onClick={closeForm} className="px-4 py-2 text-sm text-white/50 hover:text-white">Cancelar</button>
                <button
                  onClick={() => saveRule.mutate()}
                  disabled={!form.nome.trim() || saveRule.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-40"
                  style={{ background: "#e23752" }}
                >
                  {saveRule.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Criar automação"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
