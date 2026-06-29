"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Paperclip, X, ChevronDown } from "lucide-react";

interface EmailComposerProps {
  contaId: string;
  leadId?: string;
  to?: string;
  cc?: string;
  subject?: string;
  inReplyTo?: string;
  threadId?: string;
  assinatura?: string;
  onSent?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function EmailComposer({
  contaId,
  leadId,
  to = "",
  cc: initialCc = "",
  subject = "",
  inReplyTo,
  threadId,
  assinatura,
  onSent,
  onCancel,
  compact = false,
}: EmailComposerProps) {
  const [para, setPara] = useState(to);
  const [cc, setCc] = useState(initialCc);
  const [bcc, setBcc] = useState("");
  const [assunto, setAssunto] = useState(subject);
  const [corpo, setCorpo] = useState("");
  const [showCc, setShowCc] = useState(!!initialCc);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [fromAlias, setFromAlias] = useState("");
  const [fromInitialized, setFromInitialized] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/email/templates");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: contas } = useQuery({
    queryKey: ["email-contas"],
    queryFn: async () => {
      const res = await fetch("/api/email/contas");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const conta = (contas as Array<{ id: string; email: string; envioComo: string | null }> | undefined)?.find((c) => c.id === contaId);

  // Initialize fromAlias with the account's default alias (envioComo) or its own email
  if (!fromInitialized && conta) {
    setFromAlias(conta.envioComo || conta.email);
    setFromInitialized(true);
  }

  const handleSend = async () => {
    if (!para || !assunto || !corpo) {
      setError("Preencha destinatário, assunto e corpo");
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contaId,
          para,
          cc: cc || undefined,
          bcc: bcc || undefined,
          assunto,
          corpo: `<div>${corpo.replace(/\n/g, "<br>")}</div>${assinatura ? `<br><div style="color:#888;font-size:12px">${assinatura.includes("<") ? assinatura : assinatura.replace(/\n/g, "<br>")}</div>` : ""}`,
          inReplyTo,
          threadId,
          leadId,
          fromAlias: fromAlias && fromAlias !== conta?.email ? fromAlias : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao enviar");
      }

      onSent?.();
      // Reset form
      if (!inReplyTo) {
        setPara("");
        setAssunto("");
      }
      setCorpo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar email");
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (template: { assunto: string; corpo: string }) => {
    setAssunto(template.assunto);
    setCorpo(template.corpo.replace(/<[^>]*>/g, ""));
    setShowTemplates(false);
  };

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} p-3`} style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {/* From field */}
      {conta && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/40 w-10 shrink-0">De:</span>
          <input
            value={fromAlias}
            onChange={(e) => setFromAlias(e.target.value)}
            placeholder={conta.email}
            title={`Conta: ${conta.email}${conta.envioComo ? ` · Padrão: ${conta.envioComo}` : ""}`}
            className="flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/20"
          />
        </div>
      )}

      {/* To field */}
      {!inReplyTo && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/40 w-10 shrink-0">Para:</span>
          <input
            value={para}
            onChange={(e) => setPara(e.target.value)}
            placeholder="email@exemplo.com"
            className="flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/20"
          />
          <div className="flex gap-1">
            {!showCc && (
              <button onClick={() => setShowCc(true)} className="text-[10px] text-white/30 hover:text-white/50">Cc</button>
            )}
            {!showBcc && (
              <button onClick={() => setShowBcc(true)} className="text-[10px] text-white/30 hover:text-white/50">Bcc</button>
            )}
          </div>
        </div>
      )}

      {/* CC field */}
      {showCc && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/40 w-10 shrink-0">Cc:</span>
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="cc@exemplo.com"
            className="flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/20"
          />
          <button onClick={() => { setShowCc(false); setCc(""); }} className="text-white/30 hover:text-white/50">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* BCC field */}
      {showBcc && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/40 w-10 shrink-0">Bcc:</span>
          <input
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            placeholder="bcc@exemplo.com"
            className="flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/20"
          />
          <button onClick={() => { setShowBcc(false); setBcc(""); }} className="text-white/30 hover:text-white/50">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Subject */}
      {!inReplyTo && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/40 w-10 shrink-0">Assunto:</span>
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Assunto do email"
            className="flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/20"
          />
        </div>
      )}

      {/* Body */}
      <textarea
        value={corpo}
        onChange={(e) => setCorpo(e.target.value)}
        placeholder={inReplyTo ? "Escreva sua resposta..." : "Escreva o corpo do email..."}
        rows={compact ? 3 : 6}
        className="w-full bg-transparent text-[13px] text-white/90 outline-none resize-none placeholder:text-white/20"
        style={{ minHeight: compact ? 60 : 120 }}
      />

      {/* Error */}
      {error && <p className="text-[11px] text-red-400">{error}</p>}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Template selector */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-white/40 hover:text-white/60 hover:bg-white/5"
            >
              Template <ChevronDown className="w-3 h-3" />
            </button>
            {showTemplates && templates?.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg overflow-hidden shadow-xl z-50"
                   style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {(templates as Array<{ id: string; nome: string; assunto: string; corpo: string }>).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left px-3 py-2 text-[12px] text-white/70 hover:bg-white/5 truncate"
                  >
                    {t.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 rounded text-[11px] text-white/40 hover:text-white/60 hover:bg-white/5"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={sending || !para || !assunto || !corpo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40"
            style={{ background: "#3B82F6", color: "white" }}
          >
            <Send className="w-3 h-3" />
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
