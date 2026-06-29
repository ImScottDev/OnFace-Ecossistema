"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail, Trash2, Play, Pause, CheckCircle, AlertCircle, Plus, X,
  TestTube, Save, Edit3, Eye, Settings, Download, RefreshCw,
} from "lucide-react";

/* ─── Types ─── */
interface EmailConta {
  id: string;
  tipo: string;
  email: string;
  nome: string | null;
  syncStatus: string;
  syncMode: string;
  syncFiltroLabel: string | null;
  backfillStatus: string | null;
  backfillProgress: number | null;
  lastSyncAt: string | null;
  lastError: string | null;
  isDefault: boolean;
  assinatura: string | null;
  envioComo: string | null;
  createdAt: string;
}

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

/* ─── Sub-tabs ─── */
const subTabs = [
  { key: "contas", label: "Contas" },
  { key: "templates", label: "Templates" },
] as const;

type SubTab = (typeof subTabs)[number]["key"];

/* ─── Main Page ─── */
export default function EmailSettingsPage() {
  const [activeTab, setActiveTab] = useState<SubTab>("contas");

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "contas" ? <ContasSection /> : <TemplatesSection />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONTAS SECTION
   ═══════════════════════════════════════════════════════════════════ */
function ContasSection() {
  const queryClient = useQueryClient();
  const [showImapForm, setShowImapForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; error?: string } | null>(null);
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [backfillDate, setBackfillDate] = useState(
    new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  const [imapForm, setImapForm] = useState({
    email: "", nome: "",
    imapHost: "", imapPort: 993,
    smtpHost: "", smtpPort: 587,
    imapUser: "", smtpUser: "",
    imapPass: "", smtpPass: "",
  });

  const { data: contas = [], isLoading } = useQuery<EmailConta[]>({
    queryKey: ["email-contas"],
    queryFn: async () => {
      const res = await fetch("/api/email/contas");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.some((c) => c.backfillStatus === "running") ? 3000 : false;
    },
  });

  const handleCreateImap = async () => {
    const res = await fetch("/api/email/contas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(imapForm),
    });
    if (res.ok) {
      setShowImapForm(false);
      setImapForm({ email: "", nome: "", imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 587, imapUser: "", smtpUser: "", imapPass: "", smtpPass: "" });
      queryClient.invalidateQueries({ queryKey: ["email-contas"] });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta conta de email?")) return;
    await fetch(`/api/email/contas/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["email-contas"] });
  };

  const handleToggleStatus = async (conta: EmailConta) => {
    const newStatus = conta.syncStatus === "active" ? "paused" : "active";
    await fetch(`/api/email/contas/${conta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncStatus: newStatus }),
    });
    queryClient.invalidateQueries({ queryKey: ["email-contas"] });
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/email/contas/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({ id, success: data.success, error: data.error });
    } catch {
      setTestResult({ id, success: false, error: "Erro de conexão" });
    }
    setTesting(null);
  };

  const handleSaveConfig = async (
    conta: EmailConta,
    syncMode: string,
    syncFiltroLabel: string | null,
    assinatura: string | null,
    envioComo: string | null,
  ) => {
    setSavingConfig(true);
    await fetch(`/api/email/contas/${conta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        syncMode,
        syncFiltroLabel: syncFiltroLabel || null,
        assinatura: assinatura || null,
        envioComo: envioComo || null,
      }),
    });
    setSavingConfig(false);
    queryClient.invalidateQueries({ queryKey: ["email-contas"] });
  };

  const handleBackfill = async (contaId: string) => {
    if (!backfillDate) return;
    await fetch(`/api/email/contas/${contaId}/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sinceDate: backfillDate }),
    });
    queryClient.invalidateQueries({ queryKey: ["email-contas"] });
  };

  const [syncing, setSyncing] = useState<string | null>(null);
  const handleSyncNow = async (contaId: string) => {
    setSyncing(contaId);
    await fetch(`/api/email/contas/${contaId}/sync`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["email-contas"] });
    setTimeout(() => setSyncing(null), 2000);
  };

  const providerLabel = (tipo: string) => {
    if (tipo === "google") return "Google";
    if (tipo === "microsoft") return "Microsoft";
    return "IMAP/SMTP";
  };

  const providerColor = (tipo: string) => {
    if (tipo === "google") return "#EA4335";
    if (tipo === "microsoft") return "#00A4EF";
    return "#6B7280";
  };

  const statusIcon = (status: string) => {
    if (status === "active") return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    if (status === "paused") return <Pause className="w-3.5 h-3.5 text-amber-400" />;
    return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <p className="text-[12px] text-white/40">Conecte suas contas de email para centralizar envio, recebimento e histórico de conversas no CRM.</p>
        <p className="text-[10px] text-white/25 mt-1">A sincronização ocorre automaticamente a cada 5 minutos. Você pode configurar filtros por conta.</p>
      </div>

      {/* Connect buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => { window.location.href = "/api/email/auth/microsoft"; }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white/90 transition-colors hover:opacity-90"
          style={{ background: "#00A4EF" }}
        >
          <Mail className="w-4 h-4" />
          Conectar Microsoft
        </button>
        <button
          onClick={() => { window.location.href = "/api/email/auth/google"; }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white/90 transition-colors hover:opacity-90"
          style={{ background: "#EA4335" }}
        >
          <Mail className="w-4 h-4" />
          Conectar Google
        </button>
        <button
          onClick={() => setShowImapForm(!showImapForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white/60 hover:text-white/80 transition-colors"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <Plus className="w-4 h-4" />
          IMAP/SMTP
        </button>
      </div>
      <p className="text-[10px] text-white/25 -mt-4 mb-4">Google e Microsoft conectam via OAuth — não armazenamos sua senha. IMAP/SMTP requer as credenciais do servidor.</p>

      {/* IMAP Form */}
      {showImapForm && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-medium text-white/80">Adicionar conta IMAP/SMTP</h3>
            <button onClick={() => setShowImapForm(false)} className="text-white/30 hover:text-white/50">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-white/25 mt-0.5 mb-3">Consulte seu provedor de email para obter host, porta e credenciais.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Email", key: "email" as const, placeholder: "user@empresa.com" },
              { label: "Nome (opcional)", key: "nome" as const, placeholder: "Nome exibição" },
              { label: "IMAP Host", key: "imapHost" as const, placeholder: "imap.empresa.com" },
              { label: "IMAP Porta", key: "imapPort" as const, type: "number" },
              { label: "SMTP Host", key: "smtpHost" as const, placeholder: "smtp.empresa.com" },
              { label: "SMTP Porta", key: "smtpPort" as const, type: "number" },
              { label: "IMAP Usuário", key: "imapUser" as const },
              { label: "SMTP Usuário", key: "smtpUser" as const },
              { label: "IMAP Senha", key: "imapPass" as const, type: "password" },
              { label: "SMTP Senha", key: "smtpPass" as const, type: "password" },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-[11px] text-white/40 block mb-1">{field.label}</label>
                <input
                  type={field.type || "text"}
                  value={imapForm[field.key]}
                  onChange={(e) => setImapForm({ ...imapForm, [field.key]: field.type === "number" ? parseInt(e.target.value) : e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleCreateImap}
            disabled={!imapForm.email || !imapForm.imapHost || !imapForm.smtpHost}
            className="mt-3 px-4 py-1.5 rounded text-[12px] font-medium text-white disabled:opacity-40"
            style={{ background: "#3B82F6" }}
          >
            Adicionar conta
          </button>
        </div>
      )}

      {/* Account list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : contas.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-[13px]">
          <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhuma conta conectada</p>
          <p className="text-[10px] text-white/25 mt-1">Conecte Google, Microsoft ou IMAP para enviar e receber emails pelo CRM.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contas.map((conta) => (
            <div key={conta.id}>
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: configOpen === conta.id ? "8px 8px 0 0" : undefined }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${providerColor(conta.tipo)}20` }}
                >
                  <Mail className="w-4 h-4" style={{ color: providerColor(conta.tipo) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-white/80">{conta.email}</span>
                    <span className="text-[10px] px-1.5 py-0 rounded" style={{ background: `${providerColor(conta.tipo)}20`, color: providerColor(conta.tipo) }}>
                      {providerLabel(conta.tipo)}
                    </span>
                    {conta.isDefault && <span className="text-[10px] text-emerald-400">padrão</span>}
                    <span className="text-[10px] px-1.5 py-0 rounded text-white/30" style={{ background: "rgba(255,255,255,0.04)" }}>
                      {conta.syncMode === "sync_all" ? "Todos" : conta.syncMode === "leads_only" ? "Só leads" : `Label: ${conta.syncFiltroLabel || "—"}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {statusIcon(conta.syncStatus)}
                    <span className="text-[11px] text-white/40">
                      {conta.syncStatus === "active" ? "Ativo" : conta.syncStatus === "paused" ? "Pausado" : "Erro"}
                    </span>
                    {conta.lastSyncAt && (
                      <span className="text-[10px] text-white/25">
                        Último sync: {new Date(conta.lastSyncAt).toLocaleString("pt-BR")}
                      </span>
                    )}
                    {conta.lastError && (
                      <span className="text-[10px] text-red-400 truncate max-w-[200px]">{conta.lastError}</span>
                    )}
                  </div>
                  {testResult?.id === conta.id && (
                    <p className={`text-[10px] mt-1 ${testResult.success ? "text-emerald-400" : "text-red-400"}`}>
                      {testResult.success ? "Conexão OK!" : `Erro: ${testResult.error}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSyncNow(conta.id)} disabled={syncing === conta.id} className="p-1.5 rounded hover:bg-white/5" title="Sincronizar agora">
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing === conta.id ? "animate-spin text-blue-400" : "text-white/30"}`} />
                  </button>
                  <button onClick={() => setConfigOpen(configOpen === conta.id ? null : conta.id)} className={`p-1.5 rounded hover:bg-white/5 ${configOpen === conta.id ? "bg-white/5" : ""}`} title="Configurações de sync">
                    <Settings className="w-3.5 h-3.5 text-white/30" />
                  </button>
                  <button onClick={() => handleTest(conta.id)} disabled={testing === conta.id} className="p-1.5 rounded hover:bg-white/5" title="Testar conexão">
                    <TestTube className={`w-3.5 h-3.5 ${testing === conta.id ? "animate-spin text-blue-400" : "text-white/30"}`} />
                  </button>
                  <button onClick={() => handleToggleStatus(conta)} className="p-1.5 rounded hover:bg-white/5" title={conta.syncStatus === "active" ? "Pausar" : "Ativar"}>
                    {conta.syncStatus === "active" ? <Pause className="w-3.5 h-3.5 text-white/30" /> : <Play className="w-3.5 h-3.5 text-white/30" />}
                  </button>
                  <button onClick={() => handleDelete(conta.id)} className="p-1.5 rounded hover:bg-white/5" title="Remover">
                    <Trash2 className="w-3.5 h-3.5 text-red-400/50" />
                  </button>
                </div>
              </div>

              {/* Sync Config Panel */}
              {configOpen === conta.id && (
                <SyncConfigPanel
                  conta={conta}
                  onSave={handleSaveConfig}
                  saving={savingConfig}
                  backfillDate={backfillDate}
                  onBackfillDateChange={setBackfillDate}
                  onBackfill={handleBackfill}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SYNC CONFIG PANEL (per account)
   ═══════════════════════════════════════════════════════════════════ */
function SyncConfigPanel({
  conta, onSave, saving, backfillDate, onBackfillDateChange, onBackfill,
}: {
  conta: EmailConta;
  onSave: (conta: EmailConta, syncMode: string, syncFiltroLabel: string | null, assinatura: string | null, envioComo: string | null) => Promise<void>;
  saving: boolean;
  backfillDate: string;
  onBackfillDateChange: (v: string) => void;
  onBackfill: (contaId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState(conta.syncMode || "sync_all");
  const [label, setLabel] = useState(conta.syncFiltroLabel || "");
  const [assinatura, setAssinatura] = useState(conta.assinatura || "");
  const [envioComo, setEnvioComo] = useState(conta.envioComo || "");

  const labelPlaceholder = conta.tipo === "google"
    ? "Nome do label (ex: CRM, IMPORTANT)"
    : conta.tipo === "microsoft"
    ? "ID ou nome da pasta (ex: Inbox, Archive)"
    : "Nome da pasta IMAP (ex: INBOX, Sent)";

  const syncModeLabel = (m: string) => {
    if (m === "sync_all") return "Todos os emails";
    if (m === "leads_only") return "Apenas de leads existentes";
    return "Por label/pasta";
  };

  return (
    <div
      className="p-4 rounded-b-lg space-y-4"
      style={{ background: "rgba(255,255,255,0.02)", borderLeft: "1px solid rgba(255,255,255,0.06)", borderRight: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Sync Mode */}
      <div>
        <label className="text-[11px] text-white/40 block mb-1.5">Modo de sincronização</label>
        <div className="flex gap-2">
          {(["sync_all", "leads_only", "label"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
                mode === m
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-white/40 hover:text-white/60 border border-transparent"
              }`}
              style={{ background: mode === m ? undefined : "rgba(255,255,255,0.04)" }}
            >
              {syncModeLabel(m)}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/25 mt-1.5">
          {mode === "sync_all" && "Importa todos os emails. Ideal para visibilidade completa."}
          {mode === "leads_only" && "Importa apenas emails de remetentes que já são leads. Evita poluir com newsletters."}
          {mode === "label" && "Importa apenas emails com um label ou pasta específica. Você controla pela sua caixa de email."}
        </p>
      </div>

      {/* Label input (only for "label" mode) */}
      {mode === "label" && (
        <div>
          <label className="text-[11px] text-white/40 block mb-1">Label / Pasta</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={labelPlaceholder}
            className="w-full max-w-sm px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          {conta.tipo === "google" && (
            <p className="text-[10px] text-white/25 mt-1">Crie um label no Gmail e aplique nos emails, ou configure um filtro automático.</p>
          )}
          {conta.tipo === "microsoft" && (
            <p className="text-[10px] text-white/25 mt-1">Use o nome da pasta do Outlook (ex: Inbox, CRM).</p>
          )}
          {conta.tipo === "imap" && (
            <p className="text-[10px] text-white/25 mt-1">Informe o nome exato da pasta no servidor. Case-sensitive.</p>
          )}
        </div>
      )}

      {/* Enviar como (alias) */}
      <div>
        <label className="text-[11px] text-white/40 block mb-1">Enviar como (alias)</label>
        <p className="text-[10px] text-white/25 mb-1.5">
          Email usado no campo &quot;De&quot; ao enviar. Deixe vazio pra usar <span className="text-white/50">{conta.email}</span>. Precisa ser um alias verificado na sua conta Gmail/Workspace (&quot;Enviar e-mail como&quot;).
        </p>
        <input
          type="email"
          value={envioComo}
          onChange={(e) => setEnvioComo(e.target.value)}
          placeholder={`ex: contato@${conta.email.split("@")[1] || "empresa.com"}`}
          className="w-full max-w-sm px-3 py-1.5 rounded text-[12px] text-white/80 outline-none"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      </div>

      {/* Signature */}
      <div>
        <label className="text-[11px] text-white/40 block mb-1.5">Assinatura</label>
        <p className="text-[10px] text-white/25 mb-1.5">Texto adicionado automaticamente ao final de cada email enviado. Suporta HTML.</p>
        <textarea
          value={assinatura}
          onChange={(e) => setAssinatura(e.target.value)}
          placeholder={"--\nSeu Nome\nCargo | Empresa\n+55 00 00000-0000"}
          rows={4}
          className="w-full max-w-lg px-3 py-2 rounded text-[12px] text-white/80 outline-none resize-y"
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      </div>

      {/* Save button */}
      <button
        onClick={() => onSave(conta, mode, mode === "label" ? label : null, assinatura || null, envioComo || null)}
        disabled={saving || (mode === "label" && !label)}
        className="px-3 py-1.5 rounded text-[11px] font-medium text-white disabled:opacity-40"
        style={{ background: "#3B82F6" }}
      >
        {saving ? "Salvando..." : "Salvar configuração"}
      </button>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} className="pt-4">
        <label className="text-[11px] text-white/40 block mb-1.5">Importar histórico</label>
        <p className="text-[10px] text-white/25 mt-0.5 mb-1.5">Traz emails anteriores à data de conexão. Respeita o modo de sync configurado.</p>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-[10px] text-white/30 block mb-0.5">Desde:</label>
            <input
              type="date"
              value={backfillDate}
              onChange={(e) => onBackfillDateChange(e.target.value)}
              className="px-2 py-1 rounded text-[11px] text-white/70 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", colorScheme: "dark" }}
            />
          </div>
          <button
            onClick={() => onBackfill(conta.id)}
            disabled={conta.backfillStatus === "running"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium text-white disabled:opacity-40 mt-3"
            style={{ background: "#10B981" }}
          >
            <Download className="w-3 h-3" />
            {conta.backfillStatus === "running" ? "Importando..." : "Iniciar backfill"}
          </button>
        </div>

        {/* Backfill progress */}
        {conta.backfillStatus === "running" && (
          <div className="mt-2">
            <div className="w-full max-w-sm h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${conta.backfillProgress || 0}%`, background: "#10B981" }}
              />
            </div>
            <p className="text-[10px] text-white/30 mt-0.5">{conta.backfillProgress || 0}% concluído</p>
          </div>
        )}
        {conta.backfillStatus === "completed" && (
          <p className="text-[10px] text-emerald-400 mt-2">Backfill concluído</p>
        )}
        {conta.backfillStatus === "error" && (
          <p className="text-[10px] text-red-400 mt-2">Erro no backfill: {conta.lastError}</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TEMPLATES SECTION
   ═══════════════════════════════════════════════════════════════════ */
function TemplatesSection() {
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
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-white/40">
          Modelos reutilizáveis para agilizar o envio. Use {"{{variável}}"} para personalizar cada mensagem.
        </p>
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
              <p className="text-[10px] text-white/25 mb-1">HTML ou texto simples. Variáveis são substituídas automaticamente ao enviar.</p>
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
                Variáveis: {"{{nome}}, {{sobrenome}}, {{email}}, {{empresa}}, {{cargo}}, {{telefone}}"}
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
          <p className="text-[10px] text-white/25 mt-1">Templates aceleram follow-ups, propostas e boas-vindas.</p>
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

      {/* Preview */}
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
