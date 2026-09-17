"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { User, Lock, Save, Check, AlertCircle, Eye, EyeOff, Camera, MessageCircle, Mail, ChevronRight, CalendarClock } from "lucide-react";

interface Profile {
  id: string;
  nome: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  orgNome: string;
  orgSlug: string;
}

const roleBadge: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)]" },
  admin: { label: "Admin", color: "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)]" },
  gerente: { label: "Gerente", color: "bg-cyan-500/15 text-cyan-400" },
  closer: { label: "Closer", color: "bg-[var(--cf2-success-bg)] text-[var(--cf2-success-text)]" },
  sdr: { label: "SDR", color: "bg-[var(--cf2-warning-bg)] text-[var(--cf2-warning-text)]" },
  leitor: { label: "Leitor", color: "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)]" },
  vendedor: { label: "Closer", color: "bg-[var(--cf2-success-bg)] text-[var(--cf2-success-text)]" },
};

export function ConteudoPerfil() {
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Name form
  const [nome, setNome] = useState("");
  const [savingNome, setSavingNome] = useState(false);
  const [nomeMsg, setNomeMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password form
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);
  const [senhaMsg, setSenhaMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setNome(data.nome || "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveNome() {
    if (!nome.trim()) return;
    setSavingNome(true);
    setNomeMsg(null);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNomeMsg({ type: "err", text: data.error || "Erro ao salvar" });
      } else {
        setNomeMsg({ type: "ok", text: "Nome atualizado com sucesso" });
        setProfile((p) => (p ? { ...p, nome: nome.trim() } : p));
        // Refresh NextAuth session so sidebar/avatar updates immediately
        await updateSession();
      }
    } catch {
      setNomeMsg({ type: "err", text: "Erro de conexão" });
    } finally {
      setSavingNome(false);
    }
  }

  async function handleChangeSenha() {
    setSenhaMsg(null);
    if (novaSenha !== confirmar) {
      setSenhaMsg({ type: "err", text: "As senhas não coincidem" });
      return;
    }
    if (novaSenha.length < 8) {
      setSenhaMsg({ type: "err", text: "A nova senha deve ter pelo menos 8 caracteres" });
      return;
    }
    setSavingSenha(true);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSenhaMsg({ type: "err", text: data.error || "Erro ao alterar senha" });
      } else {
        setSenhaMsg({ type: "ok", text: "Senha alterada com sucesso" });
        setSenhaAtual("");
        setNovaSenha("");
        setConfirmar("");
      }
    } catch {
      setSenhaMsg({ type: "err", text: "Erro de conexão" });
    } finally {
      setSavingSenha(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMsg(null);
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/perfil", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setAvatarMsg({ type: "err", text: data.error || "Erro ao enviar" });
      } else {
        setAvatarMsg({ type: "ok", text: "Foto atualizada" });
        setProfile((p) => (p ? { ...p, avatarUrl: data.avatarUrl + "?t=" + Date.now() } : p));
        await updateSession();
      }
    } catch {
      setAvatarMsg({ type: "err", text: "Erro de conexão" });
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-[var(--cf2-border-default)] border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-8 text-[var(--cf2-text-tertiary)]">Erro ao carregar perfil</div>;
  }

  const badge = roleBadge[profile.role] || roleBadge.vendedor;
  const initials = profile.nome
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--cf2-text-primary)]">Meu Perfil</h1>

      {/* Info card */}
      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative group shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.nome} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-[var(--cf2-text-primary)]"
                style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
              >
                {initials}
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 cursor-pointer transition-opacity">
              {uploadingAvatar ? (
                <div className="w-5 h-5 border-2 border-[var(--cf2-border-default)] border-t-[var(--cf2-text-primary)] rounded-full animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-[var(--cf2-text-primary)]" />
              )}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
            </label>
            <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">Clique para alterar. JPG ou PNG, máximo 2MB.</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--cf2-text-primary)]">{profile.nome}</p>
            <p className="text-sm text-[var(--cf2-text-secondary)]">{profile.email}</p>
            {avatarMsg && (
              <p className={`text-xs mt-1 ${avatarMsg.type === "ok" ? "text-[var(--cf2-success-text)]" : "text-[var(--cf2-danger-text)]"}`}>{avatarMsg.text}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[var(--cf2-text-tertiary)] text-xs mb-1">Cargo</p>
            <span className={`text-xs px-2 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
            <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-0.5">Definido pelo administrador da organização.</p>
          </div>
          <div>
            <p className="text-[var(--cf2-text-tertiary)] text-xs mb-1">Organização</p>
            <p className="text-[var(--cf2-text-primary)]">{profile.orgNome}</p>
          </div>
          <div>
            <p className="text-[var(--cf2-text-tertiary)] text-xs mb-1">Slug</p>
            <p className="text-[var(--cf2-text-secondary)]">{profile.orgSlug}</p>
          </div>
        </div>
      </div>

      {/* Edit name */}
      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-[var(--cf2-text-tertiary)]" />
          <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Dados Pessoais</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[var(--cf2-text-tertiary)] text-xs mb-1 block">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full sm:w-80 px-3 py-2 rounded-lg text-sm text-[var(--cf2-text-primary)] outline-none transition-colors"
              style={{
                background: "var(--cf2-bg-surface-muted)",
                border: "1px solid var(--cf2-border-default)",
              }}
            />
          </div>
          {nomeMsg && (
            <div className={`flex items-center gap-1.5 text-xs ${nomeMsg.type === "ok" ? "text-[var(--cf2-success-text)]" : "text-[var(--cf2-danger-text)]"}`}>
              {nomeMsg.type === "ok" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {nomeMsg.text}
            </div>
          )}
          <button
            onClick={handleSaveNome}
            disabled={savingNome || nome.trim() === profile.nome}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-[var(--cf2-text-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            <Save className="w-3.5 h-3.5" />
            {savingNome ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Conexões */}
      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)] mb-1">Conexões</h2>
        <p className="text-[12px] text-[var(--cf2-text-tertiary)] mb-4">Conecte seus canais para atender do CRM.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/ajustes/whatsapp" className="flex items-center gap-3 rounded-lg bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-3 hover:border-emerald-400/30 transition-colors">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(37,211,102,0.12)" }}>
              <MessageCircle className="w-4.5 h-4.5" style={{ color: "#25D366" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--cf2-text-primary)] font-medium">WhatsApp</p>
              <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Conectar meu número (QR)</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--cf2-text-tertiary)]" />
          </Link>
          <Link href="/ajustes/email" className="flex items-center gap-3 rounded-lg bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-3 hover:border-blue-400/30 transition-colors">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(59,130,246,0.12)" }}>
              <Mail className="w-4.5 h-4.5" style={{ color: "#3B82F6" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--cf2-text-primary)] font-medium">Email</p>
              <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Conectar minha caixa (Gmail/Outlook)</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--cf2-text-tertiary)]" />
          </Link>
          <Link href="/calendario" className="flex items-center gap-3 rounded-lg bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] p-3 hover:border-[var(--cf2-accent)]/40 transition-colors">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--cf2-accent-bg-subtle)" }}>
              <CalendarClock className="w-4.5 h-4.5" style={{ color: "var(--cf2-accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--cf2-text-primary)] font-medium">Agenda</p>
              <p className="text-[11px] text-[var(--cf2-text-tertiary)]">Configurar disponibilidade pro Agente SDR</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--cf2-text-tertiary)]" />
          </Link>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-[var(--cf2-text-tertiary)]" />
          <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)]">Alterar Senha</h2>
        </div>
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="text-[var(--cf2-text-tertiary)] text-xs mb-1 block">Senha atual</label>
            <div className="relative">
              <input
                type={showSenhaAtual ? "text" : "password"}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                className="w-full px-3 py-2 pr-9 rounded-lg text-sm text-[var(--cf2-text-primary)] outline-none transition-colors"
                style={{
                  background: "var(--cf2-bg-surface-muted)",
                  border: "1px solid var(--cf2-border-default)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]"
              >
                {showSenhaAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[var(--cf2-text-tertiary)] text-xs mb-1 block">Nova senha</label>
            <div className="relative">
              <input
                type={showNovaSenha ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres" aria-label="Mínimo 8 caracteres"
                className="w-full px-3 py-2 pr-9 rounded-lg text-sm text-[var(--cf2-text-primary)] placeholder:text-[var(--cf2-text-tertiary)] outline-none transition-colors"
                style={{
                  background: "var(--cf2-bg-surface-muted)",
                  border: "1px solid var(--cf2-border-default)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowNovaSenha(!showNovaSenha)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--cf2-text-tertiary)] hover:text-[var(--cf2-text-secondary)]"
              >
                {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[var(--cf2-text-tertiary)] text-xs mb-1 block">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-[var(--cf2-text-primary)] outline-none transition-colors"
              style={{
                background: "var(--cf2-bg-surface-muted)",
                border: "1px solid var(--cf2-border-default)",
              }}
            />
          </div>
          {senhaMsg && (
            <div className={`flex items-center gap-1.5 text-xs ${senhaMsg.type === "ok" ? "text-[var(--cf2-success-text)]" : "text-[var(--cf2-danger-text)]"}`}>
              {senhaMsg.type === "ok" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {senhaMsg.text}
            </div>
          )}
          <button
            onClick={handleChangeSenha}
            disabled={savingSenha || !senhaAtual || !novaSenha || !confirmar}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-[var(--cf2-text-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            <Lock className="w-3.5 h-3.5" />
            {savingSenha ? "Alterando..." : "Alterar Senha"}
          </button>
        </div>
      </div>
    </div>
  );
}
