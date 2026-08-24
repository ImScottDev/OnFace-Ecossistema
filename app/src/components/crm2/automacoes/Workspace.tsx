"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Copy,
  X,
  ChevronDown,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  History,
} from "lucide-react";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { Cf2Badge } from "../ui/Badge";
import { Cf2EmptyState } from "../ui/States";

/**
 * Builder de Automações do cf2 — motor real por trás (lib/crm/automacao-engine.ts):
 * 7 gatilhos × 6 ações já rodando em produção, 1 condição + 1 ação por regra
 * (não é um grafo arbitrário). O card de referência do Kauã (Opero) inspirou
 * o formato visual de "fluxo" (gatilho → condição → ação, ligados por
 * conectores), mas adaptado ao que o motor de fato suporta — não um canvas
 * multi-nó que a engine não executaria.
 */

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
  tag?: string;
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

interface Execucao {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  erro: string | null;
  executedAt: string;
}

// Gatilhos e ações reais que dispararAutomacoes() de fato executa —
// mesmos rótulos amigáveis já validados no builder legado.
const GATILHO_OPTIONS = [
  { value: "novo_lead", label: "Novo lead criado" },
  { value: "novo_negocio", label: "Novo negócio criado" },
  { value: "mudanca_status", label: "Negócio mudou de status" },
  { value: "whatsapp_recebido", label: "WhatsApp recebido" },
  { value: "contrato_vencendo", label: "Contrato vencendo" },
  { value: "lead_inativo", label: "Lead inativo" },
  { value: "nps_recebido", label: "NPS recebido" },
  { value: "pagamento_falhou", label: "Pagamento falhou no Stripe" },
  { value: "fatura_atrasada", label: "Fatura ficou atrasada" },
  { value: "fatura_paga", label: "Fatura foi paga" },
  { value: "assinatura_status_alterado", label: "Status da assinatura mudou" },
];

const ACAO_OPTIONS = [
  { value: "criar_tarefa", label: "Criar tarefa" },
  { value: "notificar_usuario", label: "Notificar usuário" },
  { value: "atribuir_responsavel", label: "Atribuir responsável" },
  { value: "mudar_status", label: "Mudar status" },
  { value: "enviar_email", label: "Enviar e-mail" },
  { value: "enviar_whatsapp", label: "Enviar WhatsApp" },
  { value: "adicionar_tag_empresa", label: "Adicionar tag à empresa" },
  { value: "remover_tag_empresa", label: "Remover tag da empresa" },
];

const OPERADOR_OPTIONS = [
  { value: "igual", label: "é igual a" },
  { value: "diferente", label: "é diferente de" },
  { value: "contem", label: "contém" },
  { value: "maior_que", label: "é maior que" },
  { value: "menor_que", label: "é menor que" },
];

const EXEC_STATUS: Record<string, { label: string; icon: typeof CheckCircle2; variant: "success" | "danger" | "neutral" }> = {
  sucesso: { label: "Sucesso", icon: CheckCircle2, variant: "success" },
  erro: { label: "Erro", icon: XCircle, variant: "danger" },
  condicao_nao_atendida: { label: "Condição não atendida", icon: MinusCircle, variant: "neutral" },
};

const emptyForm = {
  nome: "",
  gatilho: "novo_lead",
  acao: "criar_tarefa",
  temCondicao: false,
  condicaoCampo: "",
  condicaoOperador: "igual" as NonNullable<Condicao["operador"]>,
  condicaoValor: "",
  usuarioId: "",
  tituloTarefa: "",
  prioridade: "media" as NonNullable<AcaoConfig["prioridade"]>,
  novoStatus: "",
  mensagem: "",
  tag: "",
};

function gatilhoLabel(v: string) {
  return GATILHO_OPTIONS.find((g) => g.value === v)?.label || v;
}
function acaoLabel(v: string) {
  return ACAO_OPTIONS.find((a) => a.value === v)?.label || v;
}
function operadorLabel(v?: string) {
  return OPERADOR_OPTIONS.find((o) => o.value === v)?.label || v || "";
}

function FlowStep({
  icone,
  eyebrow,
  titulo,
  subtitulo,
  cor,
}: {
  icone: React.ReactNode;
  eyebrow: string;
  titulo: string;
  subtitulo?: string;
  cor: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl min-w-0" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8" style={{ background: `${cor}1a`, color: cor }}>
        {icone}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>{eyebrow}</p>
        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{titulo}</p>
        {subtitulo && <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{subtitulo}</p>}
      </div>
    </div>
  );
}

function RuleHistory({ automacaoId }: { automacaoId: string }) {
  const { data, isLoading } = useQuery<Execucao[]>({
    queryKey: ["automacoes", automacaoId, "execucoes"],
    queryFn: async () => {
      const r = await fetch(`/api/automacoes/${automacaoId}/execucoes`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  if (isLoading) return <p className="text-[12px] px-1" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando histórico...</p>;
  if (!data || data.length === 0) return <p className="text-[12px] px-1" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma execução registrada ainda.</p>;

  return (
    <div className="flex flex-col gap-1.5">
      {data.map((e) => {
        const s = EXEC_STATUS[e.status] || { label: e.status, icon: MinusCircle, variant: "neutral" as const };
        const Icon = s.icon;
        return (
          <div key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "var(--cf2-bg-surface)" }}>
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: s.variant === "success" ? "var(--cf2-success-text)" : s.variant === "danger" ? "var(--cf2-danger-text)" : "var(--cf2-text-tertiary)" }} />
            <span className="text-[12px] flex-1 truncate" style={{ color: "var(--cf2-text-primary)" }}>
              {e.entityType} · {s.label}{e.erro ? ` — ${e.erro}` : ""}
            </span>
            <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(e.executedAt).toLocaleString("pt-BR")}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Cf2AutomacoesWorkspace() {
  const queryClient = useQueryClient();
  const { usuarios } = useOrgUsuarios();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery<Automacao[]>({
    queryKey: ["automacoes"],
    queryFn: async () => {
      const r = await fetch("/api/automacoes");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: execucoesResumo } = useQuery<Record<string, { total: number; ultima: string }>>({
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
    condicao: form.temCondicao && form.condicaoCampo ? { campo: form.condicaoCampo, operador: form.condicaoOperador, valor: form.condicaoValor } : null,
    acao: form.acao,
    acaoConfig: {
      ...(form.usuarioId ? { usuarioId: form.usuarioId } : {}),
      ...(form.tituloTarefa ? { tituloTarefa: form.tituloTarefa } : {}),
      ...(form.acao === "criar_tarefa" ? { prioridade: form.prioridade } : {}),
      ...(form.novoStatus ? { novoStatus: form.novoStatus } : {}),
      ...(form.mensagem ? { mensagem: form.mensagem } : {}),
      ...((form.acao === "adicionar_tag_empresa" || form.acao === "remover_tag_empresa") && form.tag ? { tag: form.tag } : {}),
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

  const duplicateRule = useMutation({
    mutationFn: async (rule: Automacao) => {
      const res = await fetch("/api/automacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: `${rule.nome} (cópia)`,
          gatilho: rule.gatilho,
          condicao: rule.condicao,
          acao: rule.acao,
          acaoConfig: rule.acaoConfig,
          ativo: false,
        }),
      });
      if (!res.ok) throw new Error("Erro ao duplicar automação");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Automação duplicada — revise e ative quando quiser");
      queryClient.invalidateQueries({ queryKey: ["automacoes"] });
    },
    onError: () => toast.error("Erro ao duplicar automação"),
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
      temCondicao: !!rule.condicao?.campo,
      condicaoCampo: rule.condicao?.campo || "",
      condicaoOperador: rule.condicao?.operador || "igual",
      condicaoValor: rule.condicao?.valor || "",
      usuarioId: rule.acaoConfig?.usuarioId || "",
      tituloTarefa: rule.acaoConfig?.tituloTarefa || "",
      prioridade: rule.acaoConfig?.prioridade || "media",
      novoStatus: rule.acaoConfig?.novoStatus || "",
      mensagem: rule.acaoConfig?.mensagem || "",
      tag: rule.acaoConfig?.tag || "",
    });
    setShowForm(true);
  };

  const inputStyle = { background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };

  return (
    <div className="page-scroll space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Automações</h1>
          <p className="text-xs mt-1" style={{ color: "var(--cf2-text-secondary)" }}>Motor real: 7 gatilhos × 6 ações já rodando em produção. Crie ou edite regras aqui.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
        >
          <Plus className="w-4 h-4" /> Nova Automação
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>
      ) : rules.length === 0 ? (
        <Cf2EmptyState title="Nenhuma automação configurada ainda" description={'O motor já roda de verdade (7 gatilhos ligados) — clique em "Nova Automação" pra cadastrar a 1ª regra.'} />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const exec = execucoesResumo?.[rule.id];
            const historyOpen = openHistoryId === rule.id;
            return (
              <div key={rule.id} className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "var(--cf2-shadow-card-sm)" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: "var(--cf2-accent)" }}>
                      <Zap className="w-4 h-4" style={{ color: "var(--cf2-text-on-accent)" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{rule.nome}</p>
                      <p className="text-[12px] truncate flex items-center gap-1" style={{ color: "var(--cf2-text-secondary)" }}>
                        {gatilhoLabel(rule.gatilho)}
                        {rule.condicao?.campo && <span className="opacity-70">· se {rule.condicao.campo} {operadorLabel(rule.condicao.operador)} &quot;{rule.condicao.valor}&quot;</span>}
                        <ArrowRight className="w-3 h-3 shrink-0" /> {acaoLabel(rule.acao)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setOpenHistoryId(historyOpen ? null : rule.id)}
                      className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full font-medium"
                      style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}
                    >
                      <History className="w-3 h-3" />
                      {exec ? `${exec.total} execução${exec.total === 1 ? "" : "ões"}` : "sem execuções"}
                      <ChevronDown className={`w-3 h-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                    </button>
                    <button
                      onClick={() => toggleAtivo.mutate({ id: rule.id, ativo: !rule.ativo })}
                      className="text-[11px] px-2.5 py-1.5 rounded-full font-semibold"
                      style={{ background: rule.ativo ? "var(--cf2-success-bg)" : "var(--cf2-bg-surface-muted)", color: rule.ativo ? "var(--cf2-success-text)" : "var(--cf2-text-secondary)" }}
                    >
                      {rule.ativo ? "Ativa" : "Inativa"}
                    </button>
                    <button onClick={() => duplicateRule.mutate(rule)} title="Duplicar" className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}>
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(rule)} title="Editar" className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Excluir a automação "${rule.nome}"?`)) deleteRule.mutate(rule.id); }}
                      title="Excluir"
                      className="p-1.5 rounded-lg"
                      style={{ color: "var(--cf2-danger-text)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {exec?.ultima && !historyOpen && (
                  <p className="text-[11px] mt-2 pl-12" style={{ color: "var(--cf2-text-tertiary)" }}>última execução {new Date(exec.ultima).toLocaleString("pt-BR")}</p>
                )}
                {historyOpen && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                    <RuleHistory automacaoId={rule.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={closeForm}>
          <div
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl p-5"
            style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{editingId ? "Editar Automação" : "Nova Automação"}</h2>
              <button onClick={closeForm} style={{ color: "var(--cf2-text-tertiary)" }}><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: "var(--cf2-text-secondary)" }}>Nome *</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} placeholder="Ex: Notificar gestor quando negócio for ganho" />
              </div>

              {/* Fluxo visual: gatilho → condição (opcional) → ação, ligados por
                  conectores verticais — mesma linguagem do card de referência,
                  simplificada pro que o motor real suporta (1 condição + 1 ação). */}
              <div className="flex flex-col gap-0">
                <FlowStep icone={<Zap className="w-4 h-4" />} eyebrow="Quando (gatilho)" titulo={gatilhoLabel(form.gatilho)} cor="#e23752" />
                <select value={form.gatilho} onChange={(e) => setForm({ ...form, gatilho: e.target.value })} className="text-[12px] px-3 py-1.5 rounded-lg outline-none mt-1.5" style={inputStyle}>
                  {GATILHO_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>

                <div className="flex justify-center py-1"><ChevronDown className="w-4 h-4" style={{ color: "var(--cf2-border-default)" }} /></div>

                <div className="p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                  <label className="flex items-center gap-2 text-[12px] font-medium mb-2" style={{ color: "var(--cf2-text-secondary)" }}>
                    <input type="checkbox" checked={form.temCondicao} onChange={(e) => setForm({ ...form, temCondicao: e.target.checked })} />
                    <GitBranch className="w-3.5 h-3.5" /> Adicionar condição (senão, dispara sempre)
                  </label>
                  {form.temCondicao && (
                    <div className="grid grid-cols-3 gap-2">
                      <input value={form.condicaoCampo} onChange={(e) => setForm({ ...form, condicaoCampo: e.target.value })} className="text-[12px] px-2.5 py-1.5 rounded-lg outline-none" style={inputStyle} placeholder="campo (ex: status)" />
                      <select value={form.condicaoOperador} onChange={(e) => setForm({ ...form, condicaoOperador: e.target.value as NonNullable<Condicao["operador"]> })} className="text-[12px] px-2.5 py-1.5 rounded-lg outline-none" style={inputStyle}>
                        {OPERADOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input value={form.condicaoValor} onChange={(e) => setForm({ ...form, condicaoValor: e.target.value })} className="text-[12px] px-2.5 py-1.5 rounded-lg outline-none" style={inputStyle} placeholder="valor (ex: ganho)" />
                    </div>
                  )}
                </div>

                <div className="flex justify-center py-1"><ChevronDown className="w-4 h-4" style={{ color: "var(--cf2-border-default)" }} /></div>

                <FlowStep icone={<ArrowRight className="w-4 h-4" />} eyebrow="Então (ação)" titulo={acaoLabel(form.acao)} cor="#8e27ef" />
                <select value={form.acao} onChange={(e) => setForm({ ...form, acao: e.target.value })} className="text-[12px] px-3 py-1.5 rounded-lg outline-none mt-1.5" style={inputStyle}>
                  {ACAO_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              {/* Campos condicionais por ação — todos têm executor real no motor */}
              <div className="space-y-2">
                {form.acao === "criar_tarefa" && (
                  <>
                    <input value={form.tituloTarefa} onChange={(e) => setForm({ ...form, tituloTarefa: e.target.value })} className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} placeholder="Título da tarefa" />
                    <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value as NonNullable<AcaoConfig["prioridade"]> })} className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle}>
                      <option value="baixa">Prioridade baixa</option>
                      <option value="media">Prioridade média</option>
                      <option value="alta">Prioridade alta</option>
                    </select>
                  </>
                )}
                {(form.acao === "notificar_usuario" || form.acao === "atribuir_responsavel" || form.acao === "criar_tarefa") && (
                  <select value={form.usuarioId} onChange={(e) => setForm({ ...form, usuarioId: e.target.value })} className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle}>
                    <option value="">{form.acao === "criar_tarefa" ? "Sem responsável específico" : "Selecione o usuário *"}</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                )}
                {form.acao === "mudar_status" && (
                  <input value={form.novoStatus} onChange={(e) => setForm({ ...form, novoStatus: e.target.value })} className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} placeholder="Novo status (ex: qualifying, reuniao_agendada)" />
                )}
                {(form.acao === "adicionar_tag_empresa" || form.acao === "remover_tag_empresa") && (
                  <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} className="w-full text-sm px-3 py-2 rounded-lg outline-none" style={inputStyle} placeholder="Tag (ex: financeiro_em_aberto)" />
                )}
                {(form.acao === "notificar_usuario" || form.acao === "enviar_email" || form.acao === "enviar_whatsapp") && (
                  <textarea value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-y" style={inputStyle} rows={3} placeholder="Mensagem" />
                )}
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button onClick={closeForm} className="px-4 py-2 text-sm font-medium" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
                <button
                  onClick={() => saveRule.mutate()}
                  disabled={!form.nome.trim() || saveRule.isPending}
                  className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
                  style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
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
