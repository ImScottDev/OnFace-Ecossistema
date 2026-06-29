"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search, Mail, Plus, Inbox, Send as SendIcon, Eye, ArrowLeft, Users, MailOpen,
} from "lucide-react";
import { EmailThreadView } from "@/components/crm/EmailThreadView";
import { EmailComposer } from "@/components/crm/EmailComposer";

interface OrgUser {
  id: string; nome: string; email: string; role: string;
}

interface EmailItem {
  id: string;
  de: string;
  para: string;
  cc: string | null;
  assunto: string;
  corpoTexto: string | null;
  direcao: string;
  lido: boolean;
  leadId: string | null;
  threadId: string | null;
  providerMessageId: string | null;
  createdAt: string;
  leadNome: string | null;
  leadStatus: string | null;
  threadCount: number;
  threadUnread: number;
}

interface EmailConta {
  id: string;
  email: string;
  tipo: string;
  assinatura: string | null;
}

function extractName(emailStr: string): string {
  // "Nathan Amaral <nathan@koko.ag>" → "Nathan Amaral"
  const match = emailStr.match(/^(.+?)\s*<.+>$/);
  if (match) return match[1].replace(/"/g, "").trim();
  return emailStr.split("@")[0];
}

function extractEmail(emailStr: string): string {
  const match = emailStr.match(/<(.+?)>/);
  return match ? match[1] : emailStr;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
}

export default function EmailPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { data: sessionData } = useSession();

  const isAdmin = sessionData?.user?.role === "admin" || sessionData?.user?.role === "super_admin";

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(searchParams.get("leadId"));
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterLeads, setFilterLeads] = useState(false);
  const [viewMode, setViewMode] = useState<"emails" | "contatos">("emails");
  const [showNewEmail, setShowNewEmail] = useState(false);
  const [selectedContaId, setSelectedContaId] = useState<string>("");
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);

  const readOnly = !!viewAsUserId;

  const { data: orgUsersData } = useQuery<{ usuarios: OrgUser[] }>({
    queryKey: ["org-users"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios");
      if (!res.ok) return { usuarios: [] };
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });
  const orgUsers = orgUsersData?.usuarios || [];
  const viewAsUser = orgUsers.find(u => u.id === viewAsUserId);

  const { data, isLoading } = useQuery({
    queryKey: ["email-inbox", filterUnread, searchQuery, viewAsUserId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterUnread) params.set("lido", "false");
      if (searchQuery) params.set("search", searchQuery);
      if (viewAsUserId) params.set("viewAs", viewAsUserId);
      const res = await fetch(`/api/email?${params}`);
      if (!res.ok) return { emails: [], contas: [] };
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const emailList: EmailItem[] = data?.emails || [];
  const contas: EmailConta[] = data?.contas || [];

  useEffect(() => {
    if (contas.length > 0 && !selectedContaId) {
      setSelectedContaId(contas[0].id);
    }
  }, [contas, selectedContaId]);

  const filteredEmails = filterLeads ? emailList.filter(e => e.leadId) : emailList;
  const totalUnread = filteredEmails.filter(e => e.threadUnread > 0).length;

  // Contact-grouped view: group threads by counterpart email
  const contactGroups = (() => {
    if (viewMode !== "contatos") return [];
    const map = new Map<string, { name: string; email: string; leadNome: string | null; threads: EmailItem[]; lastAt: string; unread: number }>();
    for (const email of filteredEmails) {
      const isIn = email.direcao === "in";
      const counterpart = isIn ? email.de : email.para;
      const addr = extractEmail(counterpart).toLowerCase();
      const existing = map.get(addr);
      if (!existing) {
        map.set(addr, {
          name: extractName(counterpart),
          email: addr,
          leadNome: email.leadNome,
          threads: [email],
          lastAt: email.createdAt,
          unread: email.threadUnread,
        });
      } else {
        existing.threads.push(email);
        existing.unread += email.threadUnread;
        if (!existing.leadNome && email.leadNome) existing.leadNome = email.leadNome;
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  })();

  // Find selected email for thread view
  const selectedEmail = emailList.find(e => e.id === selectedEmailId);
  const selectedConta = contas.find(c => c.id === selectedContaId);

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Left panel — email list */}
      <div
        className={`w-full md:w-96 shrink-0 flex flex-col ${selectedEmailId || selectedLeadId || showNewEmail ? "hidden md:flex" : "flex"}`}
        style={{ background: "rgba(30, 58, 138, 0.04)", borderRight: "1px solid rgba(59, 130, 246, 0.1)" }}
      >
        <div className="px-4 pt-4 pb-3 shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" /> Email
              </h1>
              <p className="text-[10px] text-white/25">
                Emails sincronizados das suas contas conectadas. A sincronização ocorre a cada 5 minutos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && orgUsers.length > 1 && (
                <div className="relative">
                  <select
                    value={viewAsUserId || ""}
                    onChange={(e) => { setViewAsUserId(e.target.value || null); setSelectedEmailId(null); }}
                    className="text-[10px] pl-4 pr-1 py-0.5 rounded outline-none appearance-none cursor-pointer"
                    style={{ background: viewAsUserId ? "rgba(245,158,11,0.15)" : "transparent", color: viewAsUserId ? "#F59E0B" : "rgba(255,255,255,0.25)", border: "none" }}
                  >
                    <option value="">Meu</option>
                    {orgUsers.filter(u => u.id !== sessionData?.user?.id).map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                  <Eye className="w-2.5 h-2.5 absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: viewAsUserId ? "#F59E0B" : "rgba(255,255,255,0.2)" }} />
                </div>
              )}
              {!readOnly && (
                <button
                  onClick={() => { setShowNewEmail(true); setSelectedEmailId(null); setSelectedLeadId(null); }}
                  className="p-1.5 text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/[0.08] rounded-lg transition-colors"
                  title="Novo email"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Read-only banner */}
          {readOnly && viewAsUser && (
            <div className="mb-2 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span className="text-amber-400">Inbox de <strong>{viewAsUser.nome}</strong> — Leitura</span>
              <button onClick={() => setViewAsUserId(null)} className="text-amber-400/60 hover:text-amber-400 text-[10px]">Fechar</button>
            </div>
          )}

          {/* Search + filters */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.08)" }}>
            <Search className="w-4 h-4 text-blue-400/30 shrink-0" />
            <input
              type="text"
              placeholder="Buscar emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white/80 placeholder:text-white/30 w-full"
            />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => setFilterUnread(!filterUnread)}
              className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
              style={{
                background: filterUnread ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                color: filterUnread ? "#3B82F6" : "rgba(255,255,255,0.4)",
                border: `1px solid ${filterUnread ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              {filterUnread ? `Não lidas (${totalUnread})` : "Não lidas"}
            </button>
            <button
              onClick={() => setFilterLeads(!filterLeads)}
              className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
              style={{
                background: filterLeads ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                color: filterLeads ? "#10B981" : "rgba(255,255,255,0.4)",
                border: `1px solid ${filterLeads ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              Leads
            </button>
            <div className="ml-auto flex rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => setViewMode("emails")}
                className="p-1 transition-colors"
                style={{ background: viewMode === "emails" ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)" }}
                title="Por email"
              >
                <MailOpen className="w-3.5 h-3.5" style={{ color: viewMode === "emails" ? "#3B82F6" : "rgba(255,255,255,0.3)" }} />
              </button>
              <button
                onClick={() => setViewMode("contatos")}
                className="p-1 transition-colors"
                style={{ background: viewMode === "contatos" ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)" }}
                title="Por contato"
              >
                <Users className="w-3.5 h-3.5" style={{ color: viewMode === "contatos" ? "#3B82F6" : "rgba(255,255,255,0.3)" }} />
              </button>
            </div>
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            </div>
          ) : emailList.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/20 text-sm">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>{filterUnread ? "Nenhum email não lido" : "Nenhum email"}</p>
              {contas.length === 0 && (
                <a href="/configuracoes/email" className="mt-2 inline-block text-[11px] text-blue-400 hover:underline">
                  Conectar conta de email
                </a>
              )}
            </div>
          ) : viewMode === "contatos" ? (
            contactGroups.map((contact) => {
              const isSelected = selectedEmailId && contact.threads.some(t => t.id === selectedEmailId);
              const totalMsgs = contact.threads.reduce((s, t) => s + t.threadCount, 0);

              return (
                <div
                  key={contact.email}
                  onClick={() => { const first = contact.threads[0]; setSelectedEmailId(first.id); setSelectedLeadId(first.leadId); setShowNewEmail(false); }}
                  className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                  style={isSelected ? { background: "rgba(59,130,246,0.08)", borderLeft: "2px solid #3B82F6" } : {}}
                >
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5"
                      style={{ background: `linear-gradient(135deg, ${contact.leadNome ? "#3B82F6" : "#6B7280"}, ${contact.leadNome ? "#3B82F680" : "#6B728080"})`, color: "#fff" }}
                    >
                      {getInitials(contact.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-sm truncate ${contact.unread > 0 ? "font-semibold text-white" : "text-white/60"}`}>
                            {contact.name}
                          </span>
                          {contact.leadNome && (
                            <span className="text-[9px] px-1 rounded text-emerald-400/70 bg-emerald-400/10 truncate max-w-[80px]" title={contact.leadNome}>
                              {contact.leadNome}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-[9px] px-1 rounded text-white/40 bg-white/[0.06]">{totalMsgs}</span>
                          <span className="text-[10px] text-white/30">{timeAgo(contact.lastAt)}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-white/40 truncate mt-0.5">{contact.email}</p>
                      <p className="text-[11px] text-white/25 truncate mt-0.5">
                        {contact.threads[0].assunto || "(sem assunto)"}
                      </p>
                    </div>
                    {contact.unread > 0 && (
                      <div className="min-w-[18px] h-[18px] rounded-full bg-blue-500 shrink-0 mt-2 flex items-center justify-center">
                        <span className="text-[9px] text-white font-bold">{contact.unread}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            filteredEmails.map((email) => {
              const isIncoming = email.direcao === "in";
              const counterpart = isIncoming ? email.de : email.para;
              const counterpartName = extractName(counterpart);
              const isSelected = selectedEmailId === email.id;

              return (
                <div
                  key={email.id}
                  onClick={() => { setSelectedEmailId(email.id); setSelectedLeadId(email.leadId); setShowNewEmail(false); }}
                  className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                  style={isSelected ? { background: "rgba(59,130,246,0.08)", borderLeft: "2px solid #3B82F6" } : {}}
                >
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5"
                      style={{ background: `linear-gradient(135deg, ${email.leadId ? "#3B82F6" : "#6B7280"}, ${email.leadId ? "#3B82F680" : "#6B728080"})`, color: "#fff" }}
                    >
                      {getInitials(counterpartName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-sm truncate ${!email.lido ? "font-semibold text-white" : "text-white/60"}`}>
                            {counterpartName}
                          </span>
                          {!isIncoming && (
                            <span className="text-[9px] px-1 rounded text-blue-400/60 bg-blue-400/10">enviado</span>
                          )}
                          {email.leadNome && (
                            <span className="text-[9px] px-1 rounded text-emerald-400/70 bg-emerald-400/10 truncate max-w-[80px]" title={email.leadNome}>
                              {email.leadNome}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {email.threadCount > 1 && (
                            <span className="text-[9px] px-1 rounded text-white/40 bg-white/[0.06]">{email.threadCount}</span>
                          )}
                          <span className="text-[10px] text-white/30">{timeAgo(email.createdAt)}</span>
                        </div>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${!email.lido ? "text-white/70" : "text-white/40"}`}>
                        {email.assunto || "(sem assunto)"}
                      </p>
                      {email.corpoTexto && (
                        <p className="text-[11px] text-white/25 truncate mt-0.5">
                          {email.corpoTexto.slice(0, 80)}
                        </p>
                      )}
                    </div>
                    {email.threadUnread > 0 && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel — email detail or composer */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedEmailId || selectedLeadId || showNewEmail ? "flex" : "hidden md:flex"}`}>
        {(selectedEmailId || showNewEmail) && (
          <button
            onClick={() => { setSelectedEmailId(null); setSelectedLeadId(null); setShowNewEmail(false); }}
            className="md:hidden flex items-center gap-2 px-4 py-2 text-sm text-blue-400/60 hover:text-blue-400 shrink-0"
            style={{ borderBottom: "1px solid rgba(59,130,246,0.1)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        )}

        {showNewEmail && selectedContaId ? (
          <div className="flex flex-col h-full">
            <div className="shrink-0 px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(59,130,246,0.1)" }}>
              <h3 className="text-[14px] font-medium text-white/90 flex items-center gap-2">
                <SendIcon className="w-4 h-4 text-blue-400" />
                Novo Email
              </h3>
              <button onClick={() => setShowNewEmail(false)} className="text-[11px] text-white/40 hover:text-white/60">Cancelar</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EmailComposer
                contaId={selectedContaId}
                assinatura={selectedConta?.assinatura || undefined}
                onSent={() => { setShowNewEmail(false); queryClient.invalidateQueries({ queryKey: ["email-inbox"] }); }}
                onCancel={() => setShowNewEmail(false)}
              />
            </div>
          </div>
        ) : selectedEmail && selectedContaId ? (
          <EmailThreadView
            leadId={selectedEmail.leadId || undefined}
            leadNome={extractName(selectedEmail.direcao === "in" ? selectedEmail.de : selectedEmail.para)}
            leadEmail={extractEmail(selectedEmail.direcao === "in" ? selectedEmail.de : selectedEmail.para)}
            contaId={selectedContaId}
            threadId={selectedEmail.threadId || undefined}
            emailId={selectedEmail.id}
            assinatura={selectedConta?.assinatura || undefined}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Inbox className="w-12 h-12 text-blue-400/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">Selecione um email para ler</p>
              <p className="text-[11px] text-white/20 mt-1">ou clique em + para enviar novo email</p>
              {contas.length === 0 && (
                <a href="/configuracoes/email" className="inline-block mt-4 px-4 py-2 rounded-lg text-[12px] font-medium text-blue-400 hover:bg-blue-400/10">
                  Conectar conta de email
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
