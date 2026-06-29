"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Reply, ReplyAll, Forward, MoreHorizontal, ChevronDown, ChevronUp, User } from "lucide-react";
import { useState } from "react";
import { EmailComposer } from "./EmailComposer";

/** CSS to force dark mode on email HTML content */
const emailDarkCss = `
  .email-dark-body, .email-dark-body * { color: rgba(255,255,255,0.7) !important; background-color: transparent !important; border-color: rgba(255,255,255,0.1) !important; }
  .email-dark-body img { filter: brightness(0.9); max-width: 100%; height: auto; }
  .email-dark-body a { color: #60a5fa !important; }
  .email-dark-body table { border-color: rgba(255,255,255,0.08) !important; }
  .email-dark-body td, .email-dark-body th { border-color: rgba(255,255,255,0.08) !important; }
  .email-dark-body blockquote { border-left: 2px solid rgba(255,255,255,0.15) !important; padding-left: 8px; opacity: 0.7; }
  .email-dark-body hr { border-color: rgba(255,255,255,0.1) !important; }
`;

/** Strip dangerous HTML tags/attributes to prevent XSS */
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove event handlers (onclick, onerror, onload, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');
  clean = clean.replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'src=""');
  // Remove iframe, object, embed, form tags
  clean = clean.replace(/<(iframe|object|embed|form|meta|link)\b[^>]*\/?>/gi, "");
  clean = clean.replace(/<\/(iframe|object|embed|form)>/gi, "");
  return clean;
}

interface Email {
  id: string;
  de: string;
  para: string;
  cc: string | null;
  assunto: string;
  corpo: string;
  corpoTexto: string | null;
  direcao: string;
  status: string;
  lido: boolean;
  messageId: string | null;
  threadId: string | null;
  createdAt: string;
}

interface EmailThreadViewProps {
  leadId?: string;
  leadNome: string;
  leadEmail: string | null;
  contaId: string;
  threadId?: string;
  emailId?: string;
  assinatura?: string;
  onClose?: () => void;
}

export function EmailThreadView({ leadId, leadNome, leadEmail, contaId, threadId, emailId, assinatura, onClose }: EmailThreadViewProps) {
  const queryClient = useQueryClient();
  const [showComposer, setShowComposer] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [replyAllCc, setReplyAllCc] = useState("");
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  // Build query params — prefer threadId for thread view, fall back to leadId or emailId
  const queryParam = threadId
    ? `threadId=${threadId}`
    : leadId
    ? `leadId=${leadId}`
    : emailId
    ? `emailId=${emailId}`
    : null;

  const queryKeyId = threadId || leadId || emailId || "none";

  const { data, isLoading } = useQuery({
    queryKey: ["email-thread", queryKeyId],
    queryFn: async () => {
      if (!queryParam) return { emails: [] };
      const res = await fetch(`/api/email?${queryParam}`);
      if (!res.ok) return { emails: [] };
      return res.json();
    },
    enabled: !!queryParam,
  });

  const emailList: Email[] = data?.emails || [];

  // Auto-expand last 3 emails
  const visibleExpanded = new Set(expandedEmails);
  emailList.slice(-3).forEach((e) => visibleExpanded.add(e.id));

  const toggleExpand = (id: string) => {
    const next = new Set(expandedEmails);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedEmails(next);
  };

  const handleReply = (email: Email) => {
    setReplyTo(email);
    setReplyAllCc("");
    setShowComposer(true);
  };

  const handleReplyAll = (email: Email) => {
    setReplyTo(email);
    // Collect all recipients (To + Cc) except the current account email
    const allAddrs = [email.para, email.cc].filter(Boolean).join(", ");
    const addrs = allAddrs.split(",").map(a => a.trim()).filter(Boolean);
    // Remove the sender (who becomes the "To") and remove duplicates
    const sender = email.de.replace(/.*<(.+)>.*/, "$1").toLowerCase();
    const ccList = addrs
      .map(a => a.replace(/.*<(.+)>.*/, "$1").toLowerCase())
      .filter(a => a !== sender && a.includes("@"));
    setReplyAllCc([...new Set(ccList)].join(", "));
    setShowComposer(true);
  };

  const handleNewEmail = () => {
    setReplyTo(null);
    setReplyAllCc("");
    setShowComposer(true);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const extractName = (email: string) => {
    const match = email.match(/^(.+?)\s*</);
    return match ? match[1].replace(/"/g, "") : email.split("@")[0];
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <h3 className="text-[14px] font-medium text-white/90">{leadNome}</h3>
          <p className="text-[11px] text-white/40">{leadEmail || "sem email"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewEmail}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/5"
          >
            Novo email
          </button>
        </div>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {emailList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 text-[13px]">
            <p>Nenhum email ainda</p>
            <button
              onClick={handleNewEmail}
              className="mt-2 px-3 py-1 rounded text-[12px] text-blue-400 hover:bg-blue-400/10"
            >
              Enviar primeiro email
            </button>
          </div>
        ) : (
          emailList.map((email) => {
            const isExpanded = visibleExpanded.has(email.id);
            const isOut = email.direcao === "out";

            return (
              <div
                key={email.id}
                className="rounded-lg overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
              >
                {/* Email header (always visible) */}
                <button
                  onClick={() => toggleExpand(email.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02] transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-medium"
                    style={{ background: isOut ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.06)", color: isOut ? "#60a5fa" : "rgba(255,255,255,0.5)" }}
                  >
                    {extractName(email.de).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-white/80 truncate">{extractName(email.de)}</span>
                      <span className="text-[10px] text-white/30">{formatDate(email.createdAt)}</span>
                    </div>
                    {!isExpanded && (
                      <p className="text-[11px] text-white/40 truncate">{email.corpoTexto || email.assunto}</p>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
                </button>

                {/* Email body (expanded) */}
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <div className="text-[11px] text-white/40 mb-2">
                      <span>De: {email.de}</span> &middot; <span>Para: {email.para}</span>
                      {email.cc && <span> &middot; Cc: {email.cc}</span>}
                    </div>
                    <div className="mb-2 px-2 py-1.5 rounded" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <p className="text-[12px] font-medium text-white/70 mb-1">{email.assunto}</p>
                      <style dangerouslySetInnerHTML={{ __html: emailDarkCss }} />
                      <div
                        className="email-dark-body text-[12px] leading-relaxed break-words"
                        style={{ maxHeight: 400, overflow: "auto" }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.corpo) }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReply(email); }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/40 hover:text-white/60 hover:bg-white/5"
                      >
                        <Reply className="w-3 h-3" /> Responder
                      </button>
                      {(email.cc || email.para.includes(",")) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReplyAll(email); }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/40 hover:text-white/60 hover:bg-white/5"
                        >
                          <ReplyAll className="w-3 h-3" /> Responder a todos
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      {showComposer && (
        <EmailComposer
          contaId={contaId}
          leadId={leadId || undefined}
          to={replyTo ? replyTo.de : leadEmail || ""}
          cc={replyAllCc || undefined}
          subject={replyTo ? `Re: ${replyTo.assunto}` : ""}
          inReplyTo={replyTo?.messageId || undefined}
          threadId={replyTo?.threadId || undefined}
          assinatura={assinatura}
          compact
          onSent={() => {
            setShowComposer(false);
            setReplyTo(null);
            queryClient.invalidateQueries({ queryKey: ["email-thread", queryKeyId] });
          }}
          onCancel={() => { setShowComposer(false); setReplyTo(null); }}
        />
      )}
    </div>
  );
}
