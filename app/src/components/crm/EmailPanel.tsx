"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Mail,
  ChevronDown,
  ChevronUp,
  Inbox,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";

interface Email {
  id: string;
  leadId: string;
  de: string;
  para: string;
  cc: string | null;
  assunto: string;
  corpo: string;
  corpoTexto: string | null;
  direcao: "in" | "out";
  status: string;
  createdAt: string;
}

interface EmailPanelProps {
  leadId: string;
  leadNome: string;
  leadEmail: string | null;
  compact?: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Hoje ${time}`;
  if (diffDays === 1) return `Ontem ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString("pt-BR", { weekday: "short" })} ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + ` ${time}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Enviado</span>;
  if (status === "failed") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Falhou</span>;
  if (status === "draft") return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Rascunho</span>;
  return null;
}

export function EmailPanel({ leadId, leadNome, leadEmail, compact = false }: EmailPanelProps) {
  const queryClient = useQueryClient();
  const [showCompose, setShowCompose] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [to, setTo] = useState(leadEmail || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { data: emailData } = useQuery({
    queryKey: ["emails", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/email?leadId=${leadId}`);
      if (!res.ok) return { emails: [] };
      return res.json();
    },
    enabled: !!leadId,
  });

  const emails: Email[] = emailData?.emails ?? [];

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          para: to,
          cc: cc || undefined,
          assunto: subject,
          corpo: body,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao enviar email");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails", leadId] });
      setShowCompose(false);
      setSubject("");
      setBody("");
      setCc("");
    },
  });

  const height = compact ? "max-h-[400px]" : "max-h-[600px]";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Email</span>
          {emails.length > 0 && (
            <span className="text-xs text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded-full">
              {emails.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
            showCompose
              ? "bg-cyan-500/20 text-cyan-400"
              : "bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1]"
          }`}
        >
          {showCompose ? <X className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          {showCompose ? "Cancelar" : "Novo Email"}
        </button>
      </div>

      {/* Compose form */}
      {showCompose && (
        <div
          className="p-4 space-y-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Para</label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="w-40">
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">CC</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                placeholder="cc@exemplo.com"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Assunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
              placeholder="Assunto do email..."
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Mensagem</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50 resize-none"
              placeholder={`Olá ${leadNome.split(" ")[0]},\n\n`}
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-white/30">
              {process.env.NEXT_PUBLIC_SMTP_CONFIGURED === "true"
                ? "Email será enviado via SMTP"
                : "Email será registrado no CRM"}
            </p>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!to || !subject || !body || sendMutation.isPending}
              className="px-4 py-2 text-sm rounded-lg font-medium transition-all disabled:opacity-40 flex items-center gap-2"
              style={{
                background: to && subject && body
                  ? "linear-gradient(135deg, #06B6D4, #3B82F6)"
                  : "rgba(255,255,255,0.05)",
                color: "white",
              }}
            >
              <Send className="w-4 h-4" />
              {sendMutation.isPending ? "Enviando..." : "Enviar"}
            </button>
          </div>
          {sendMutation.isError && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {sendMutation.error?.message || "Erro ao enviar email"}
            </p>
          )}
        </div>
      )}

      {/* Email list */}
      <div className={`overflow-y-auto scrollbar-thin ${height}`}>
        {emails.length === 0 && !showCompose && (
          <div className="flex flex-col items-center justify-center py-8 text-white/20">
            <Inbox className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhum email registrado</p>
            <p className="text-xs mt-1">Clique em "Novo Email" para começar</p>
          </div>
        )}
        {emails.map((email) => {
          const isExpanded = expandedEmail === email.id;
          return (
            <div
              key={email.id}
              className="border-b border-white/[0.04] last:border-0"
            >
              <button
                onClick={() => setExpandedEmail(isExpanded ? null : email.id)}
                className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      email.direcao === "out"
                        ? "bg-cyan-500/15 text-cyan-400"
                        : "bg-purple-500/15 text-purple-400"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {email.assunto}
                      </span>
                      <StatusBadge status={email.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                      <span>{email.direcao === "out" ? `Para: ${email.para}` : `De: ${email.de}`}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(email.createdAt)}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-white/30 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-1">
                  <div className="bg-white/[0.03] rounded-lg p-4 text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                    {email.corpoTexto || email.corpo}
                  </div>
                  {email.cc && (
                    <p className="text-xs text-white/30 mt-2">CC: {email.cc}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
