"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle, Wifi, WifiOff, Plus, Star, Trash2, RefreshCw, QrCode,
} from "lucide-react";

interface WaSession {
  id: string;
  sessionName: string;
  label: string | null;
  isDefault: boolean;
  status: string;
  phoneNumber: string | null;
  qrCode: string | null;
}

export function WhatsAppSessionManager() {
  const queryClient = useQueryClient();
  const [newSessionName, setNewSessionName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{ sessions: WaSession[] }>({
    queryKey: ["whatsapp-sessions-config"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) return { sessions: [] };
      return res.json();
    },
    refetchInterval: 5000,
  });

  const sessions = data?.sessions || [];
  const connectedCount = sessions.filter(s => s.status === "connected").length;

  const action = async (actionName: string, sessionId?: string, extra?: Record<string, string>) => {
    setLoading(sessionId || "new");
    try {
      await fetch("/api/whatsapp/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, sessionId, ...extra }),
      });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-sessions"] });
      // Connect: polling rápido (1s) pra o QR aparecer NA HORA, sem esperar o ciclo de 5s
      if (actionName === "connect") {
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const res = await refetch();
          const s = res.data?.sessions?.find((x) => x.id === sessionId);
          if (s && (s.qrCode || s.status === "connected")) break;
        }
      } else {
        setTimeout(() => refetch(), 1500);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)] flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[var(--cf2-success-text)]" />
            WhatsApp
            <span className="text-xs text-[var(--cf2-text-tertiary)] font-normal ml-1">
              {connectedCount}/{sessions.length} conectadas
            </span>
          </h2>
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-0.5">Cada sessão representa um número de WhatsApp conectado ao CRM.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 text-[var(--cf2-text-secondary)] hover:text-[var(--cf2-text-primary)] hover:bg-[var(--cf2-bg-surface-muted)] rounded-lg transition-colors"
          title="Atualizar status"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {sessions.map(sess => (
          <div key={sess.id} className="rounded-lg border border-[var(--cf2-border-default)] overflow-hidden">
            {/* Session header */}
            <div className="flex items-center gap-3 p-3">
              {sess.status === "connected"
                ? <Wifi className="w-4 h-4 text-[var(--cf2-success-text)] shrink-0" />
                : sess.status === "waiting_qr"
                ? <QrCode className="w-4 h-4 text-[var(--cf2-warning-text)] shrink-0 animate-pulse" />
                : <WifiOff className="w-4 h-4 text-[var(--cf2-danger-text)] shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--cf2-text-primary)] truncate">{sess.label || sess.sessionName}</p>
                  {sess.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-[var(--cf2-warning-text)]">padrão</span>
                  )}
                </div>
                <p className="text-xs text-[var(--cf2-text-secondary)]">
                  {sess.phoneNumber || sess.sessionName}
                  {sess.status === "connected" && " — conectado"}
                  {sess.status === "waiting_qr" && " — aguardando QR"}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {sess.status !== "connected" ? (
                  <button
                    onClick={() => action("connect", sess.id)}
                    disabled={loading === sess.id}
                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/15 text-[var(--cf2-success-text)] hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    {loading === sess.id ? "Conectando..." : "Conectar"}
                  </button>
                ) : (
                  <button
                    onClick={() => action("disconnect", sess.id)}
                    disabled={loading === sess.id}
                    className="px-3 py-1.5 text-xs rounded-lg bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)] hover:bg-[var(--cf2-bg-surface-muted)] hover:text-[var(--cf2-text-primary)] transition-colors disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                )}
                {!sess.isDefault && (
                  <button
                    onClick={() => action("set-default", sess.id)}
                    className="p-1.5 text-[var(--cf2-warning-text)]/50 hover:text-[var(--cf2-warning-text)] hover:bg-amber-500/10 rounded-lg transition-colors"
                    title="Sessão usada para envios automáticos e notificações"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Excluir sessão "${sess.label || sess.sessionName}" e todo o histórico de mensagens?`)) {
                      action("delete", sess.id);
                    }
                  }}
                  className="p-1.5 text-[var(--cf2-danger-text)]/40 hover:text-[var(--cf2-danger-text)] hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Excluir sessão e histórico"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* QR Code area — shown when disconnected and QR available */}
            {sess.status !== "connected" && sess.qrCode && (
              <div className="border-t border-[var(--cf2-border-default)] p-4 bg-[var(--cf2-bg-surface)] flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-[var(--cf2-text-secondary)]">
                  <QrCode className="w-3.5 h-3.5" />
                  Escaneie o QR Code com o WhatsApp
                </div>
                <img
                  src={sess.qrCode.startsWith("data:") ? sess.qrCode : `data:image/png;base64,${sess.qrCode}`}
                  alt="QR Code"
                  className="w-48 h-48 rounded-lg bg-white p-2"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {sessions.length === 0 && !isLoading && (
        <div className="text-center py-6 text-[var(--cf2-text-tertiary)]">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma sessão WhatsApp configurada</p>
          <p className="text-xs mt-1">Adicione uma sessão abaixo para começar</p>
          <p className="text-[10px] text-[var(--cf2-text-tertiary)] mt-1">Cada sessão é vinculada a um número de WhatsApp. Escaneie o QR Code pelo app do celular.</p>
        </div>
      )}

      {/* Add new session */}
      <div className="mt-4 pt-4 border-t border-[var(--cf2-border-default)]">
        <p className="text-xs text-[var(--cf2-text-secondary)] mb-2">Adicionar nova sessão</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[var(--cf2-bg-surface-muted)] border border-[var(--cf2-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--cf2-text-primary)] placeholder:text-[var(--cf2-text-tertiary)] focus:outline-none focus:border-purple-500/50"
            placeholder="Nome da sessão (ex: Comercial, Suporte...)"
            value={newSessionName}
            onChange={e => setNewSessionName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && newSessionName.trim()) {
                action("create", undefined, {
                  sessionName: newSessionName.trim().toLowerCase().replace(/\s+/g, "-"),
                  label: newSessionName.trim(),
                });
                setNewSessionName("");
              }
            }}
          />
          <button
            onClick={() => {
              if (!newSessionName.trim()) return;
              action("create", undefined, {
                sessionName: newSessionName.trim().toLowerCase().replace(/\s+/g, "-"),
                label: newSessionName.trim(),
              });
              setNewSessionName("");
            }}
            disabled={!newSessionName.trim() || loading === "new"}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cf2-accent)]"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
