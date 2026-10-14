"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ETAPAS_PIPELINE, ROTULO_ETAPA_PIPELINE, STATUS_LEGADO_DA_ETAPA } from "@/lib/vendas/dominio";
import {
  Bot, Save, Eye, EyeOff, Power, PowerOff,
  MessageSquare, Zap, BookOpen,
  Sparkles, BarChart3, ChevronDown, ChevronRight,
  Clock, Shield,
} from "lucide-react";

interface AiSdrConfigData {
  id: string;
  ativo: boolean;
  groqApiKey: string | null;
  modelo: string;
  systemPrompt: string | null;
  nomeAssistente: string;
  idiomaResposta: string;
  horarioComercial: { inicio: string; fim: string; diasSemana: number[]; timezone: string } | null;
  foraHorarioMsg: string | null;
  maxTokensResposta: number;
  temperaturaModelo: string;
  handoffTriggers: { keywords: string[]; sentimentoNegativo: boolean; valorAlto: boolean } | null;
  stageConfig: Record<string, StageConfigItem> | null;
  styleGuide: string | null;
  knowledgeBase: string | null;
  rateLimitMsgs: number;
  rateLimitWindowMin: number;
  delayMinMs: number;
  delayMaxMs: number;
  debounceMs: number;
}

interface StageConfigItem {
  ativo?: boolean;
  prompt?: string;
  objetivo?: string;
  criterioConcluso?: string;
  acaoAoConcluir?: "advance_and_continue" | "handoff" | "handoff_only";
}

interface Stats {
  totalMsgsAi: number;
  msgsAi24h: number;
  totalHandoffs: number;
  handoffs7d: number;
  totalTokens: number;
  activeContacts: number;
}

// Chaves = valor real de `negocios.status` que o SDR lê em lib/ai/sdr.ts
// (`stageConfig[negocio.status]`). As antigas qualificacao/respondeu/proposta_enviada
// nunca casavam com um negócio, então o prompt configurado nelas jamais entrava.
//
// A lista NÃO é escrita à mão: vem de `STATUS_LEGADO_DA_ETAPA`, a mesma tradução
// que o motor de vendas usa ao gravar o status. Assim a tela não volta a divergir
// quando uma etapa mudar. `trial` ficou fora de propósito — deixou de ser etapa
// em 06/10 (quem está em trial está em Proposta).
const PIPELINE_STAGES = [
  // Contato sem negócio: o SDR usa esta chave antes de existir oportunidade.
  { key: "em_contato", label: "Em Contato (sem negócio ainda)" },
  ...ETAPAS_PIPELINE.map((etapa) => ({
    key: STATUS_LEGADO_DA_ETAPA[etapa],
    label: ROTULO_ETAPA_PIPELINE[etapa],
  })),
];

const DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
];

type SubTab = "config" | "pipeline" | "style" | "stats";

interface LogEntry {
  id: string;
  tipo: string;
  inputContent: string | null;
  outputContent: string | null;
  intentDetectado: string | null;
  confianca: string | null;
  decisao: string | null;
  motivo: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  latenciaMs: number | null;
  createdAt: string;
}

function StatsTab({ stats }: { stats: Stats | null }) {
  const { data: logs } = useQuery({
    queryKey: ["ai-sdr-logs-recent"],
    queryFn: async () => {
      const res = await fetch("/api/ai-sdr/logs?limit=20");
      if (!res.ok) return [];
      const { logs } = await res.json();
      return logs as LogEntry[];
    },
  });

  const tipoColors: Record<string, string> = {
    resposta: "text-[var(--cf2-success-text)] bg-emerald-500/15",
    handoff: "text-[var(--cf2-warning-text)] bg-[var(--cf2-warning-bg)]",
    qualify: "text-[var(--cf2-text-secondary)] bg-[var(--cf2-bg-surface-muted)]",
    advance: "text-[var(--cf2-text-secondary)] bg-[var(--cf2-bg-surface-muted)]",
    erro: "text-[var(--cf2-danger-text)] bg-[#fceded]",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Msgs AI (24h)", value: stats?.msgsAi24h ?? "-" },
          { label: "Total Msgs AI", value: stats?.totalMsgsAi ?? "-" },
          { label: "Contatos Ativos", value: stats?.activeContacts ?? "-" },
          { label: "Handoffs (7d)", value: stats?.handoffs7d ?? "-" },
          { label: "Total Handoffs", value: stats?.totalHandoffs ?? "-" },
          { label: "Tokens Usados", value: stats?.totalTokens ? Number(stats.totalTokens).toLocaleString() : "-" },
        ].map((stat, i) => (
          <div key={i} className="bg-[var(--cf2-bg-surface)] rounded-xl p-4 border border-[var(--cf2-border-default)]">
            <p className="text-[var(--cf2-text-tertiary)] text-xs">{stat.label}</p>
            <p className="text-2xl font-bold text-[var(--cf2-text-primary)] mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent logs */}
      <div className="bg-[var(--cf2-bg-surface)] rounded-xl border border-[var(--cf2-border-default)]">
        <div className="p-4 border-b border-[var(--cf2-border-default)]">
          <h3 className="text-[var(--cf2-text-primary)] font-medium text-sm">Atividade Recente</h3>
        </div>
        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
          {logs && logs.length > 0 ? logs.map((log) => (
            <div key={log.id} className="px-4 py-3 flex items-start gap-3 text-xs">
              <span className={`px-1.5 py-0.5 rounded font-medium ${tipoColors[log.tipo] || "text-[var(--cf2-text-tertiary)] bg-[var(--cf2-bg-surface)]"}`}>
                {log.tipo}
              </span>
              <div className="flex-1 min-w-0">
                {log.inputContent && (
                  <p className="text-[var(--cf2-text-secondary)] truncate">Lead: {log.inputContent}</p>
                )}
                {log.outputContent && (
                  <p className="text-[var(--cf2-text-secondary)] truncate mt-0.5">{log.outputContent.replace(/\n---SPLIT---\n/g, " | ")}</p>
                )}
                {log.motivo && (
                  <p className="text-[var(--cf2-text-tertiary)] mt-0.5">Motivo: {log.motivo}</p>
                )}
              </div>
              <div className="text-right shrink-0 text-[var(--cf2-text-tertiary)]">
                <p>{new Date(log.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                {log.latenciaMs && <p>{log.latenciaMs}ms</p>}
                {log.tokensInput != null && log.tokensOutput != null && (
                  <p>{log.tokensInput + log.tokensOutput}tk</p>
                )}
              </div>
            </div>
          )) : (
            <div className="px-4 py-8 text-center text-[var(--cf2-text-tertiary)] text-sm">
              Nenhuma atividade registrada
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AiSdrConfigPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<SubTab>("config");
  const [showKey, setShowKey] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<Partial<AiSdrConfigData>>({});
  const [dirty, setDirty] = useState(false);

  const { data: configData, isLoading } = useQuery({
    queryKey: ["ai-sdr-config"],
    queryFn: async () => {
      const res = await fetch("/api/ai-sdr/config");
      if (!res.ok) return null;
      const { config } = await res.json();
      return config as AiSdrConfigData | null;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["ai-sdr-stats"],
    queryFn: async () => {
      const res = await fetch("/api/ai-sdr/stats");
      if (!res.ok) return null;
      return res.json() as Promise<Stats>;
    },
    enabled: activeTab === "stats",
  });

  // Initialize form from config
  const config = configData;
  const currentForm = {
    ativo: form.ativo ?? config?.ativo ?? false,
    groqApiKey: form.groqApiKey ?? config?.groqApiKey ?? "",
    modelo: form.modelo ?? config?.modelo ?? "llama-3.3-70b-versatile",
    systemPrompt: form.systemPrompt ?? config?.systemPrompt ?? "",
    nomeAssistente: form.nomeAssistente ?? config?.nomeAssistente ?? "Assistente",
    idiomaResposta: form.idiomaResposta ?? config?.idiomaResposta ?? "pt-BR",
    horarioComercial: form.horarioComercial ?? config?.horarioComercial ?? { inicio: "08:00", fim: "18:00", diasSemana: [1, 2, 3, 4, 5], timezone: "America/Sao_Paulo" },
    foraHorarioMsg: form.foraHorarioMsg ?? config?.foraHorarioMsg ?? "Oi! No momento estamos fora do horario comercial. Retornamos em breve!",
    maxTokensResposta: form.maxTokensResposta ?? config?.maxTokensResposta ?? 1024,
    temperaturaModelo: form.temperaturaModelo ?? config?.temperaturaModelo ?? "0.3",
    knowledgeBase: form.knowledgeBase ?? config?.knowledgeBase ?? "",
    rateLimitMsgs: form.rateLimitMsgs ?? config?.rateLimitMsgs ?? 10,
    rateLimitWindowMin: form.rateLimitWindowMin ?? config?.rateLimitWindowMin ?? 60,
    delayMinMs: form.delayMinMs ?? config?.delayMinMs ?? 2000,
    delayMaxMs: form.delayMaxMs ?? config?.delayMaxMs ?? 5000,
    debounceMs: form.debounceMs ?? config?.debounceMs ?? 5000,
    stageConfig: form.stageConfig ?? config?.stageConfig ?? {},
    styleGuide: form.styleGuide ?? config?.styleGuide ?? "",
  };

  const updateForm = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-sdr/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-sdr-config"] });
      setDirty(false);
      setForm({});
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-sdr/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !currentForm.ativo }),
      });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-sdr-config"] });
    },
  });

  const styleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-sdr/style/analyze", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro");
      }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ai-sdr-config"] });
      updateForm("styleGuide", data.styleGuide);
    },
  });

  if (isLoading) {
    return <div className="p-8 text-[var(--cf2-text-tertiary)]">Carregando...</div>;
  }

  const subTabs = [
    { key: "config" as const, label: "Configuração", icon: Bot },
    { key: "pipeline" as const, label: "Pipeline AI", icon: Zap },
    { key: "style" as const, label: "Estilo", icon: Sparkles },
    { key: "stats" as const, label: "Stats", icon: BarChart3 },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--cf2-text-primary)] flex items-center gap-3">
            <Bot className="w-7 h-7 text-[var(--cf2-accent)]" />
            AI SDR
          </h1>
          <p className="text-[var(--cf2-text-tertiary)] text-sm mt-1">SDR virtual com Groq (Llama 3.3 70B)</p>
        </div>
        <button
          onClick={() => toggleMutation.mutate()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            currentForm.ativo
              ? "bg-emerald-500/20 text-[var(--cf2-success-text)] border border-emerald-500/30"
              : "bg-[var(--cf2-bg-surface)] text-[var(--cf2-text-tertiary)] border border-[var(--cf2-border-default)]"
          }`}
        >
          {currentForm.ativo ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
          {currentForm.ativo ? "Ativo" : "Desativado"}
        </button>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 p-1 bg-[var(--cf2-bg-surface)] rounded-lg">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[var(--cf2-accent)]/12 text-[var(--cf2-accent)]"
                : "text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {activeTab === "config" && (
        <div className="space-y-6">
          {/* API Key */}
          <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-5 space-y-4 border border-[var(--cf2-border-default)]">
            <h3 className="text-[var(--cf2-text-primary)] font-medium flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--cf2-accent)]" />
              API Key
            </h3>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={form.groqApiKey !== undefined ? (form.groqApiKey || "") : (config?.groqApiKey || "")}
                onChange={(e) => updateForm("groqApiKey", e.target.value)}
                placeholder="gsk_..." aria-label="gsk_"
                className="flex-1 bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
              />
              <button onClick={() => setShowKey(!showKey)} className="px-3 py-2 bg-[var(--cf2-bg-surface)] rounded-lg text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-primary)]">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-4">
              <label className="text-[var(--cf2-text-tertiary)] text-xs">Modelo</label>
              <select
                value={currentForm.modelo}
                onChange={(e) => updateForm("modelo", e.target.value)}
                className="bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-1 text-[var(--cf2-text-primary)] text-sm"
              >
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B (rapido)</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
              </select>
            </div>
          </div>

          {/* Identity */}
          <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-5 space-y-4 border border-[var(--cf2-border-default)]">
            <h3 className="text-[var(--cf2-text-primary)] font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--cf2-accent)]" />
              Identidade
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Nome do Assistente</label>
                <input
                  value={currentForm.nomeAssistente}
                  onChange={(e) => updateForm("nomeAssistente", e.target.value)}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Temperatura</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={currentForm.temperaturaModelo}
                  onChange={(e) => updateForm("temperaturaModelo", e.target.value)}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Instruções Adicionais (system prompt)</label>
              <textarea
                value={currentForm.systemPrompt || ""}
                onChange={(e) => updateForm("systemPrompt", e.target.value)}
                rows={4}
                className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                placeholder="Instruções extras para o SDR..." aria-label="Instruções extras para o SDR"
              />
            </div>
            <div>
              <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Base de Conhecimento</label>
              <textarea
                value={currentForm.knowledgeBase || ""}
                onChange={(e) => updateForm("knowledgeBase", e.target.value)}
                rows={4}
                className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                placeholder="Informacoes sobre seus servicos, precos, diferenciais..." aria-label="Informacoes sobre seus servicos, precos, diferenciais"
              />
            </div>
          </div>

          {/* Business Hours */}
          <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-5 space-y-4 border border-[var(--cf2-border-default)]">
            <h3 className="text-[var(--cf2-text-primary)] font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--cf2-accent)]" />
              Horario Comercial
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Inicio</label>
                <input
                  type="time"
                  value={currentForm.horarioComercial?.inicio || "08:00"}
                  onChange={(e) => updateForm("horarioComercial", { ...currentForm.horarioComercial, inicio: e.target.value })}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Fim</label>
                <input
                  type="time"
                  value={currentForm.horarioComercial?.fim || "18:00"}
                  onChange={(e) => updateForm("horarioComercial", { ...currentForm.horarioComercial, fim: e.target.value })}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {DAYS.map((day) => {
                const selected = currentForm.horarioComercial?.diasSemana?.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => {
                      const dias = currentForm.horarioComercial?.diasSemana || [];
                      const next = selected ? dias.filter(d => d !== day.value) : [...dias, day.value];
                      updateForm("horarioComercial", { ...currentForm.horarioComercial, diasSemana: next });
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      selected ? "bg-[var(--cf2-accent)]/12 text-[var(--cf2-accent)] border border-[var(--cf2-accent)]/30" : "bg-[var(--cf2-bg-surface)] text-[var(--cf2-text-tertiary)] border border-[var(--cf2-border-default)]"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <div>
              <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Mensagem fora do horario</label>
              <input
                value={currentForm.foraHorarioMsg || ""}
                onChange={(e) => updateForm("foraHorarioMsg", e.target.value)}
                className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
              />
            </div>
          </div>

          {/* Rate Limiting */}
          <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-5 space-y-4 border border-[var(--cf2-border-default)]">
            <h3 className="text-[var(--cf2-text-primary)] font-medium">Rate Limit e Delays</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Max msgs/janela</label>
                <input
                  type="number"
                  value={currentForm.rateLimitMsgs}
                  onChange={(e) => updateForm("rateLimitMsgs", parseInt(e.target.value))}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Janela (min)</label>
                <input
                  type="number"
                  value={currentForm.rateLimitWindowMin}
                  onChange={(e) => updateForm("rateLimitWindowMin", parseInt(e.target.value))}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Debounce (ms)</label>
                <input
                  type="number"
                  value={currentForm.debounceMs}
                  onChange={(e) => updateForm("debounceMs", parseInt(e.target.value))}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Delay min entre msgs (ms)</label>
                <input
                  type="number"
                  value={currentForm.delayMinMs}
                  onChange={(e) => updateForm("delayMinMs", parseInt(e.target.value))}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
              <div>
                <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Delay max entre msgs (ms)</label>
                <input
                  type="number"
                  value={currentForm.delayMaxMs}
                  onChange={(e) => updateForm("delayMaxMs", parseInt(e.target.value))}
                  className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                />
              </div>
            </div>
          </div>

          {/* Save */}
          {dirty && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)] rounded-lg font-medium hover:opacity-90 transition-all"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Configuração"}
            </button>
          )}
        </div>
      )}

      {/* Pipeline Tab */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          <p className="text-[var(--cf2-text-tertiary)] text-sm">Configure como o SDR atua em cada estágio do pipeline.</p>
          {PIPELINE_STAGES.map((stage) => {
            const stageConf = (currentForm.stageConfig?.[stage.key] || {}) as Partial<StageConfigItem>;
            const expanded = expandedStage === stage.key;
            return (
              <div key={stage.key} className="bg-[var(--cf2-bg-surface)] rounded-xl border border-[var(--cf2-border-default)] overflow-hidden">
                <button
                  onClick={() => setExpandedStage(expanded ? null : stage.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[var(--cf2-bg-surface-muted)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${stageConf.ativo ? "bg-emerald-400" : "bg-[var(--cf2-bg-surface-muted)]"}`} />
                    <span className="text-[var(--cf2-text-primary)] font-medium">{stage.label}</span>
                  </div>
                  {expanded ? <ChevronDown className="w-4 h-4 text-[var(--cf2-text-tertiary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--cf2-text-tertiary)]" />}
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[var(--cf2-border-default)] pt-3">
                    <label className="flex items-center gap-2 text-sm text-[var(--cf2-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={stageConf.ativo || false}
                        onChange={(e) => {
                          const sc = { ...currentForm.stageConfig };
                          sc[stage.key] = { ...stageConf, ativo: e.target.checked };
                          updateForm("stageConfig", sc);
                        }}
                        className="accent-[var(--cf2-accent)]"
                      />
                      AI ativo neste estágio
                    </label>
                    <div>
                      <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Objetivo</label>
                      <input
                        value={stageConf.objetivo || ""}
                        onChange={(e) => {
                          const sc = { ...currentForm.stageConfig };
                          sc[stage.key] = { ...stageConf, objetivo: e.target.value };
                          updateForm("stageConfig", sc);
                        }}
                        className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                        placeholder="Ex: Qualificar o lead e entender necessidades" aria-label="Ex: Qualificar o lead e entender necessidades"
                      />
                    </div>
                    <div>
                      <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Criterio de Conclusao</label>
                      <input
                        value={stageConf.criterioConcluso || ""}
                        onChange={(e) => {
                          const sc = { ...currentForm.stageConfig };
                          sc[stage.key] = { ...stageConf, criterioConcluso: e.target.value };
                          updateForm("stageConfig", sc);
                        }}
                        className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                        placeholder="Ex: Lead informou empresa, cargo e demonstrou interesse" aria-label="Ex: Lead informou empresa, cargo e demonstrou interesse"
                      />
                    </div>
                    <div>
                      <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Prompt Especifico</label>
                      <textarea
                        value={stageConf.prompt || ""}
                        onChange={(e) => {
                          const sc = { ...currentForm.stageConfig };
                          sc[stage.key] = { ...stageConf, prompt: e.target.value };
                          updateForm("stageConfig", sc);
                        }}
                        rows={3}
                        className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                        placeholder="Instruções adicionais para este estágio..." aria-label="Instruções adicionais para este estágio"
                      />
                    </div>
                    <div>
                      <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-1">Acao ao Concluir</label>
                      <select
                        value={stageConf.acaoAoConcluir || "advance_and_continue"}
                        onChange={(e) => {
                          const sc = { ...currentForm.stageConfig };
                          sc[stage.key] = { ...stageConf, acaoAoConcluir: e.target.value as StageConfigItem["acaoAoConcluir"] };
                          updateForm("stageConfig", sc);
                        }}
                        className="bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm"
                      >
                        <option value="advance_and_continue">Avancar e continuar AI</option>
                        <option value="handoff">Avancar e transferir pra humano</option>
                        <option value="handoff_only">Apenas transferir (nao avanca)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {dirty && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)] rounded-lg font-medium hover:opacity-90 transition-all"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>
      )}

      {/* Style Tab */}
      {activeTab === "style" && (
        <div className="space-y-4">
          <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-5 border border-[var(--cf2-border-default)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[var(--cf2-text-primary)] font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--cf2-accent)]" />
                  Style Learning
                </h3>
                <p className="text-[var(--cf2-text-tertiary)] text-xs mt-1">Analisa suas mensagens e ensina o AI a escrever como voce</p>
              </div>
              <button
                onClick={() => styleMutation.mutate()}
                disabled={styleMutation.isPending}
                className="px-4 py-2 bg-[var(--cf2-accent)]/12 text-[var(--cf2-accent)] rounded-lg text-sm font-medium hover:opacity-90 transition-all"
              >
                {styleMutation.isPending ? "Analisando..." : "Analisar Estilo"}
              </button>
            </div>
            {styleMutation.isError && (
              <p className="text-[var(--cf2-danger-text)] text-sm">{styleMutation.error?.message}</p>
            )}
          </div>

          <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-5 border border-[var(--cf2-border-default)]">
            <label className="text-[var(--cf2-text-tertiary)] text-xs block mb-2">Guia de Estilo (gerado ou manual)</label>
            <textarea
              value={currentForm.styleGuide || ""}
              onChange={(e) => updateForm("styleGuide", e.target.value)}
              rows={12}
              className="w-full bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-[var(--cf2-text-primary)] text-sm font-mono"
              placeholder="Clique em 'Analisar Estilo' para gerar automaticamente ou escreva manualmente..."
            />
          </div>
          {dirty && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)] rounded-lg font-medium hover:opacity-90 transition-all"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <StatsTab stats={stats ?? null} />
      )}
    </div>
  );
}
