"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search, MessageCircle, Wifi, WifiOff, Plus, Star, Trash2,
  CheckCheck, EyeOff, Eye, Loader2, Users, UserCheck, Inbox,
} from "lucide-react";
import { ChatPanel } from "@/components/crm/ChatPanel";
import { ContatoActionBar } from "@/components/crm/ContatoActionBar";
import { ContatoInfoSidebar } from "@/components/crm/ContatoInfoSidebar";
import { FilterBar, matchesDateFilter } from "@/components/crm/FilterBar";
import type { DateFilter } from "@/components/crm/FilterBar";

// ─── Types ─────────────────────────────────────────────

interface ContatoConversation {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  canal: string;
  avatarUrl: string | null;
  responsavelId: string | null;
  leadId: string | null;
  leadNome: string | null;
  leadStatus: string | null;
  empresaId: string | null;
  empresaNome: string | null;
  negocioAtivoId: string | null;
  negocioTitulo: string | null;
  negocioStatus: string | null;
  ultimaMsg: string | null;
  ultimaMsgAt: string | null;
  naoLidas: number;
  createdAt: string;
  /** true quando o lead ainda não tem contato de WhatsApp (conversa nova) */
  leadOnly?: boolean;
}

interface ConversationsPage {
  conversations: ContatoConversation[];
  nextCursor: string | null;
  totalUnread: number;
}

interface Label {
  id: string; nome: string; cor: string;
}

interface WaSession {
  id: string; sessionName: string; label: string | null; isDefault: boolean;
  status: string; phoneNumber: string | null; qrCode: string | null;
  usuarioId?: string | null; tipo?: string; assignStrategy?: string;
}

interface OrgUser {
  id: string; nome: string; email: string; role: string;
}

type InboxView = "meus" | "nao_atribuidos" | "todos";

function getInitials(nome: string) {
  return nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ─── Avatar Component ────────────────────────────────────

function WhatsAppAvatar({
  phone, nome, size = 40, hasLead,
}: {
  phone: string; nome: string; size?: number; hasLead?: boolean;
}) {
  const { data } = useQuery<{ url: string }>({
    queryKey: ["whatsapp-avatar", phone],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/avatar?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) return { url: "" };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const [imgError, setImgError] = useState(false);
  const avatarUrl = data?.url;
  const showImage = avatarUrl && !imgError;

  useEffect(() => { setImgError(false); }, [avatarUrl]);

  const color = hasLead ? "#3B82F6" : "#6B7280";

  if (showImage) {
    return (
      <img src={avatarUrl} alt={nome} className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }} onError={() => setImgError(true)} referrerPolicy="no-referrer" />
    );
  }

  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.3, background: `linear-gradient(135deg, ${color}, ${color}80)` }}>
      {getInitials(nome)}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function WhatsAppPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const preselectedContato = searchParams.get("contato");
  const preselectedLeadId = searchParams.get("lead") || searchParams.get("leadId");
  const preselectedTelefone = searchParams.get("telefone");
  const textoPronto = searchParams.get("texto") || undefined;
  const listRef = useRef<HTMLDivElement>(null);

  // Só super_admin enxerga conversa alheia — a aba "Todos" e o "ver como" são
  // dele. O backend aplica a mesma regra; isto aqui é só a UI acompanhando.
  const isAdmin = session?.user?.role === "super_admin";
  const currentUserId = (session?.user as { id?: string })?.id || "";

  const [selectedContatoId, setSelectedContatoId] = useState<string | null>(preselectedContato);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<DateFilter>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [hoverContatoId, setHoverContatoId] = useState<string | null>(null);
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [inboxView, setInboxView] = useState<InboxView>("meus");
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  // Conversa resolvida por deep link (pós-venda, negócio, cliente). Fica fora
  // da lista porque o inbox é paginado e filtrado por view — o contato pode
  // não estar carregado, estar em outra aba, ou nem existir ainda.
  const [linkedContato, setLinkedContato] = useState<ContatoConversation | null>(null);
  const [linkErro, setLinkErro] = useState<string | null>(null);

  const readOnly = !!viewAsUserId;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Org users for admin dropdown
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

  // Sessions
  const { data: sessionsData } = useQuery<{ sessions: WaSession[] }>({
    queryKey: ["whatsapp-sessions", viewAsUserId],
    queryFn: async () => {
      const params = viewAsUserId ? `?viewAs=${viewAsUserId}` : "";
      const res = await fetch(`/api/whatsapp/status${params}`);
      if (!res.ok) return { sessions: [] };
      return res.json();
    },
    refetchInterval: showSessions ? 5000 : 15000,
  });

  // Labels
  const { data: labelsData } = useQuery<Label[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const res = await fetch("/api/labels");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
  const labels = labelsData || [];

  const sessions = sessionsData?.sessions || [];
  const activeSession = selectedSessionId
    ? sessions.find(s => s.id === selectedSessionId)
    : sessions.find(s => s.isDefault) || sessions[0];
  const anyConnected = sessions.some(s => s.status === "connected");

  // ─── Infinite query for conversations (contatos) ─────────
  const {
    data: convData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: convLoading,
  } = useInfiniteQuery<ConversationsPage>({
    queryKey: ["whatsapp-conversations", debouncedSearch, filterUnread, filterTipo, filterLabels, viewAsUserId, inboxView],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterUnread) params.set("unread", "1");
      if (filterTipo !== "all") params.set("tipo", filterTipo);
      if (filterLabels.length > 0) params.set("labelIds", filterLabels.join(","));
      if (viewAsUserId) params.set("viewAs", viewAsUserId);
      params.set("view", inboxView);
      params.set("limit", "50");
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await fetch(`/api/whatsapp/conversations?${params}`);
      if (!res.ok) return { conversations: [], nextCursor: null, totalUnread: 0 };
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
  });

  const allConversations = convData?.pages.flatMap(p => p.conversations) || [];
  const totalUnread = convData?.pages[0]?.totalUnread ?? 0;

  // Client-side date filter
  const filteredConversations = allConversations.filter(c => {
    if (!matchesDateFilter(c.ultimaMsgAt, filterDate, customDateFrom, customDateTo)) return false;
    return true;
  });

  const selectedContato =
    allConversations.find((c) => c.id === selectedContatoId) ||
    (linkedContato && linkedContato.id === selectedContatoId ? linkedContato : undefined);

  // Deep link (?leadId= / ?contato= / ?telefone=): resolve no servidor, sem
  // depender da lista carregada. Cobre também o cliente que ainda não tem
  // conversa — nesse caso volta uma conversa "lead-only" pronta pro 1º envio.
  const deepLinkKey = preselectedContato || preselectedLeadId || preselectedTelefone;
  const deepLinkResolvido = useRef(false);
  /**
   * Depende SÓ dos params da URL — nunca de `allConversations` (10/09/2026).
   *
   * Bug real: com a lista nas dependências, o efeito re-rodava assim que o
   * inbox terminava de carregar. O cleanup do render anterior marcava
   * `cancelado = true` e matava o fetch em andamento; na re-execução o
   * `deepLinkResolvido` já estava `true` e retornava na primeira linha. O
   * resultado era a tela presa em "Abrindo conversa…" pra sempre — e como o
   * efeito nunca falhava, também não havia erro pra mostrar.
   *
   * Não há mais atalho pela lista carregada: resolver sempre no servidor é
   * uma requisição barata e cobre o caso que a lista não cobre (conversa de
   * outra página, de outra view, ou cliente que nunca conversou).
   */
  useEffect(() => {
    if (!deepLinkKey || deepLinkResolvido.current) return;
    deepLinkResolvido.current = true;

    let vivo = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (preselectedContato) params.set("contatoId", preselectedContato);
        if (preselectedLeadId) params.set("leadId", preselectedLeadId);
        if (preselectedTelefone) params.set("telefone", preselectedTelefone);

        const res = await fetch(`/api/whatsapp/conversations/resolve?${params}`);
        if (!vivo) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLinkErro(body?.error || "Não foi possível abrir a conversa desse contato.");
          return;
        }
        const { conversation } = await res.json();
        if (!vivo) return;
        if (!conversation) {
          setLinkErro("Não foi possível abrir a conversa desse contato.");
          return;
        }
        setLinkedContato(conversation);
        setSelectedContatoId(conversation.id);
      } catch {
        // Sem isto a tela fica em "Abrindo conversa…" indefinidamente.
        if (vivo) setLinkErro("Falha de rede ao abrir a conversa. Recarregue a página.");
      }
    })();
    return () => { vivo = false; };
  }, [deepLinkKey, preselectedContato, preselectedLeadId, preselectedTelefone]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  const sessionAction = async (action: string, sessionId?: string, extra?: Record<string, string>) => {
    await fetch("/api/whatsapp/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sessionId, ...extra }),
    });
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ["whatsapp-sessions"] }), 2000);
  };

  const toggleReadStatus = async (contatoId: string, currentUnread: number) => {
    const newValue = currentUnread > 0 ? 0 : 1;
    await fetch(`/api/contatos/${contatoId}/atribuir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naoLidas: newValue }),
    });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
  };

  const handleContatoUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
  };

  // ─── Inbox view tabs ───────────────────────────────────

  const viewTabs: { key: InboxView; label: string; icon: React.ElementType }[] = [
    { key: "meus", label: "Meus", icon: UserCheck },
    { key: "nao_atribuidos", label: "Abertos", icon: Inbox },
    ...(isAdmin ? [{ key: "todos" as InboxView, label: "Todos", icon: Users }] : []),
  ];

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Left panel — conversation list */}
      <div className={`w-full md:w-80 shrink-0 flex flex-col ${selectedContatoId ? "hidden md:flex" : "flex"}`} style={{ background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-4 pt-4 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-400" /> WhatsApp
              </h1>
              <p className="text-[10px] text-white/25">Conversas centralizadas de todas as sessões WhatsApp conectadas.</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && orgUsers.length > 1 && (
                <div className="relative">
                  <select
                    value={viewAsUserId || ""}
                    onChange={(e) => { setViewAsUserId(e.target.value || null); setSelectedContatoId(null); }}
                    className="text-[10px] pl-4 pr-1 py-0.5 rounded outline-none appearance-none cursor-pointer"
                    style={{ background: viewAsUserId ? "rgba(245,158,11,0.15)" : "transparent", color: viewAsUserId ? "#F59E0B" : "rgba(255,255,255,0.25)", border: "none" }}
                  >
                    <option value="">Meu</option>
                    {orgUsers.filter(u => u.id !== (session?.user as { id?: string })?.id).map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                  <Eye className="w-2.5 h-2.5 absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: viewAsUserId ? "#F59E0B" : "rgba(255,255,255,0.2)" }} />
                </div>
              )}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs cursor-pointer" onClick={() => setShowSessions(!showSessions)}
                style={{ background: anyConnected ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)", color: anyConnected ? "#34D399" : "#EF4444" }}>
                {anyConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {sessions.filter(s => s.status === "connected").length}/{sessions.length}
              </div>
            </div>
          </div>

          {/* Read-only banner */}
          {readOnly && viewAsUser && (
            <div className="mb-2 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span className="text-amber-400">Inbox de <strong>{viewAsUser.nome}</strong> — Leitura</span>
              <button onClick={() => setViewAsUserId(null)} className="text-amber-400/60 hover:text-amber-400 text-[10px]">Fechar</button>
            </div>
          )}

          {/* Sessions panel */}
          {showSessions && (
            <div className="mb-3 p-3 rounded-xl space-y-2" style={{ background: "rgba(255,255,255,0.05)" }}>
              <p className="text-xs text-white/40 font-medium">Sessões WhatsApp</p>
              {sessions.map(sess => (
                <div key={sess.id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${activeSession?.id === sess.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
                  onClick={() => setSelectedSessionId(sess.id)}>
                  {sess.status === "connected" ? <Wifi className="w-3 h-3 text-emerald-400 shrink-0" /> : <WifiOff className="w-3 h-3 text-red-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{sess.label || sess.sessionName}</p>
                    <p className="text-[10px] text-white/30">
                      {sess.phoneNumber || "sem numero"}
                      {sess.tipo === "compartilhada" && <span className="ml-1 text-amber-400/60">(compartilhada)</span>}
                    </p>
                  </div>
                  {sess.isDefault && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                  <div className="flex gap-1 shrink-0">
                    {sess.status !== "connected" ? (
                      <button onClick={(e) => { e.stopPropagation(); sessionAction("connect", sess.id); }}
                        className="text-[10px] text-emerald-400 hover:underline">Conectar</button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); sessionAction("disconnect", sess.id); }}
                        className="text-[10px] text-red-400 hover:underline">Desconectar</button>
                    )}
                    {!sess.isDefault && (
                      <button onClick={(e) => { e.stopPropagation(); sessionAction("set-default", sess.id); }}
                        className="text-[10px] text-amber-400 hover:underline" title="Definir padrão">
                        <Star className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Excluir sessão "${sess.label || sess.sessionName}"?`)) {
                          sessionAction("delete", sess.id);
                        }
                      }}
                      className="text-[10px] text-red-400/60 hover:text-red-400" title="Excluir sessão">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {activeSession && activeSession.status !== "connected" && activeSession.qrCode && (
                <div className="p-3 rounded-lg text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <p className="text-xs text-white/40 mb-2">QR: {activeSession.label || activeSession.sessionName}</p>
                  <img
                    src={activeSession.qrCode.startsWith("data:") ? activeSession.qrCode : `data:image/png;base64,${activeSession.qrCode}`}
                    alt="QR Code" className="w-40 h-40 mx-auto rounded-lg bg-white p-1" style={{ imageRendering: "pixelated" }}
                  />
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <input className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-white/30"
                  placeholder="Nome da sessão..." value={newSessionName} onChange={e => setNewSessionName(e.target.value)} />
                <button onClick={async () => {
                    if (!newSessionName) return;
                    await sessionAction("create", undefined, { sessionName: newSessionName, label: newSessionName });
                    setNewSessionName("");
                  }} className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30" title="Adicionar sessão">
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {sessions.length === 0 && <p className="text-xs text-white/30 text-center py-2">Nenhuma sessão configurada</p>}
            </div>
          )}

          {/* Inbox view tabs */}
          <div className="flex items-center gap-1 mb-2">
            {viewTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setInboxView(tab.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  inboxView === tab.key
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/25">Meus: suas conversas. Abertos: não atribuídos.{isAdmin ? " Todos: visão geral (super admin)." : ""}</p>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Search className="w-4 h-4 text-white/30 shrink-0" />
            <input type="text" placeholder="Buscar conversa..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white/80 placeholder:text-white/30 w-full" />
          </div>

          {/* Filters */}
          <div className="mt-2">
            <FilterBar
              filterUnread={filterUnread}
              setFilterUnread={setFilterUnread}
              filterTipo={filterTipo}
              setFilterTipo={setFilterTipo}
              filterDate={filterDate}
              setFilterDate={setFilterDate}
              customDateFrom={customDateFrom}
              setCustomDateFrom={setCustomDateFrom}
              customDateTo={customDateTo}
              setCustomDateTo={setCustomDateTo}
              labels={labels}
              filterLabels={filterLabels}
              setFilterLabels={setFilterLabels}
              accentColor="#10B981"
              totalUnread={totalUnread}
              onLabelCreated={() => queryClient.invalidateQueries({ queryKey: ["labels"] })}
            />
          </div>

          {/* Mark all as read */}
          {totalUnread > 0 && (
            <button
              onClick={async () => {
                await fetch("/api/whatsapp/mark-all-read", { method: "POST" });
                queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
                queryClient.invalidateQueries({ queryKey: ["whatsapp-unread-count"] });
              }}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar tudo como lido ({totalUnread})
            </button>
          )}
        </div>

        {/* Conversations list with infinite scroll */}
        <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scrollbar-thin">
          {convLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/20 text-sm">
              {inboxView === "nao_atribuidos" ? "Nenhuma conversa em aberto" : "Nenhuma conversa encontrada"}
              <p className="text-[10px] text-white/25 mt-1">Novas conversas aparecem automaticamente quando um contato envia mensagem.</p>
            </div>
          ) : (
            <>
              {filteredConversations.map((contato) => {
                // Use lead name when contato name is just a phone number
                const isPhoneOnly = /^[\d+\s()-]+$/.test(contato.nome);
                const displayName = (!isPhoneOnly ? contato.nome : contato.leadNome) || contato.nome;
                return (
                <div key={contato.id} onClick={() => setSelectedContatoId(contato.id)}
                  onMouseEnter={() => setHoverContatoId(contato.id)} onMouseLeave={() => setHoverContatoId(null)}
                  className={`cursor-pointer transition-colors hover:bg-white/[0.03] ${selectedContatoId === contato.id ? "bg-white/[0.05]" : ""}`}
                  style={selectedContatoId === contato.id ? { borderLeft: "2px solid #10B981" } : {}}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <WhatsAppAvatar phone={contato.telefone || ""} nome={displayName} hasLead={!!contato.leadId} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium text-white truncate">{displayName}</span>
                          {contato.leadId ? (
                            <span className="px-1 py-0 rounded text-[9px] font-bold shrink-0 leading-tight"
                              style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>
                              L
                            </span>
                          ) : (
                            <span className="px-1 py-0 rounded text-[9px] font-bold shrink-0 leading-tight"
                              style={{ background: "rgba(107,114,128,0.15)", color: "#6B7280" }}>
                              C
                            </span>
                          )}
                          {!contato.responsavelId && (
                            <span className="px-1 py-0 rounded text-[9px] shrink-0 leading-tight bg-amber-500/20 text-amber-400">
                              !
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {hoverContatoId === contato.id && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleReadStatus(contato.id, contato.naoLidas); }}
                              className="p-0.5 rounded hover:bg-white/[0.08] transition-colors"
                              title={contato.naoLidas > 0 ? "Marcar como lida" : "Marcar como não lida"}>
                              {contato.naoLidas > 0
                                ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400/70" />
                                : <EyeOff className="w-3.5 h-3.5 text-white/30" />}
                            </button>
                          )}
                          {contato.ultimaMsgAt && <span className="text-[10px] text-white/30">{timeAgo(contato.ultimaMsgAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-white/40 truncate">
                          {contato.ultimaMsg || contato.leadNome || contato.telefone}
                        </span>
                        {contato.naoLidas > 0 && <span className="unread-badge unread-badge-pulse shrink-0 ml-2">{contato.naoLidas}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Center panel — chat */}
      <div className={`flex-1 flex flex-col min-w-0 ${selectedContatoId ? "flex" : "hidden md:flex"}`}>
        {selectedContato ? (
          <div className="flex flex-col h-full">
            <button
              onClick={() => setSelectedContatoId(null)}
              className="md:hidden flex items-center gap-2 px-4 py-2 text-sm text-white/60 hover:text-white shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Voltar
            </button>

            {/* Chat panel with unified header */}
            <div className="flex-1 min-h-0 flex">
              <div className="flex-1 min-w-0">
                <ChatPanel
                  leadId={selectedContato.id}
                  contatoId={selectedContato.leadOnly ? undefined : selectedContato.id}
                  initialText={textoPronto}
                  leadNome={selectedContato.nome}
                  leadTelefone={selectedContato.telefone || ""}
                  leadStatus={selectedContato.negocioStatus || selectedContato.leadStatus || "novo"}
                  leadEmpresa={selectedContato.empresaNome}
                  readOnly={readOnly}
                  compact
                  onNameClick={() => setShowInfoSidebar(!showInfoSidebar)}
                  headerActions={
                    <ContatoActionBar
                      contato={selectedContato}
                      currentUserId={currentUserId}
                      userRole={(session?.user as { role?: string })?.role || "vendedor"}
                      onUpdate={handleContatoUpdate}
                      inline
                    />
                  }
                />
              </div>

              {/* Info sidebar */}
              {showInfoSidebar && (
                <div className="w-80 shrink-0 hidden lg:block" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                  <ContatoInfoSidebar contato={selectedContato} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">
                {linkErro || (deepLinkKey ? "Abrindo conversa…" : "Selecione uma conversa para começar")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
