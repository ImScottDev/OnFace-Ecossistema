"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Send, MoreHorizontal, Reply, Smile, Trash2, Check, CheckCheck, Clock,
  AlertCircle, Paperclip, Camera, File as FileIcon, MapPin, User, UserCheck, X, FileText,
  Bot, UserCog, Loader2, MessageSquareOff, FileSpreadsheet, FileArchive,
  Sparkles, ChevronDown, Archive, Clock3, RotateCcw, Tag,
  Copy, UserRound, MessageSquareText,
} from "lucide-react";
import { ConversaItem, Contexto, iniciais, nomeExibicao } from "./types";
import { Cf2Badge } from "../ui/Badge";
import { WhatsappTemplatesModal } from "./WhatsappTemplatesModal";

type Mensagem = {
  id: string;
  direcao: "in" | "out";
  conteudo: string | null;
  tipo: string;
  mediaUrl: string | null;
  mediaFilename: string | null;
  status: string | null;
  uazapiMessageId: string | null;
  replyToId: string | null;
  createdAt: string;
  sessaoUsuarioNome: string | null;
  enviadoPorNome: string | null;
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Card de anexo (20/08, referência de UX) — antes era um link cru "📎
// Documento" sem nome nem tipo. Ícone/cor por extensão real do nome do
// arquivo (whatsapp_mensagens.media_filename já chega com nome real, ex:
// "Callface_White_Label.pdf"); tamanho em bytes NÃO existe no schema —
// não é mostrado (não inventar um número).
const FILE_KIND: Record<string, { Icon: typeof FileText; color: string; bg: string; label: string }> = {
  pdf: { Icon: FileText, color: "#ef4444", bg: "#ef444426", label: "PDF" },
  doc: { Icon: FileText, color: "#3b82f6", bg: "#3b82f626", label: "DOC" },
  docx: { Icon: FileText, color: "#3b82f6", bg: "#3b82f626", label: "DOC" },
  xls: { Icon: FileSpreadsheet, color: "#22c55e", bg: "#22c55e26", label: "XLS" },
  xlsx: { Icon: FileSpreadsheet, color: "#22c55e", bg: "#22c55e26", label: "XLS" },
  csv: { Icon: FileSpreadsheet, color: "#22c55e", bg: "#22c55e26", label: "CSV" },
  zip: { Icon: FileArchive, color: "#a855f7", bg: "#a855f726", label: "ZIP" },
  rar: { Icon: FileArchive, color: "#a855f7", bg: "#a855f726", label: "RAR" },
};
const FILE_KIND_DEFAULT = { Icon: FileIcon, color: "#64748b", bg: "#64748b26", label: "Arquivo" };

function fileKindFor(filename: string | null): typeof FILE_KIND_DEFAULT {
  const ext = filename?.split(".").pop()?.toLowerCase();
  return (ext && FILE_KIND[ext]) || FILE_KIND_DEFAULT;
}

function FileAttachmentCard({ url, filename }: { url: string | null; filename: string | null }) {
  const { Icon, color, bg, label } = fileKindFor(filename);
  const content = (
    <div className="flex items-center gap-2.5 p-2 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: bg }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold truncate max-w-[180px]" style={{ color: "var(--cf2-text-primary)" }}>{filename || "Documento"}</p>
        <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
      </div>
    </div>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="hover:opacity-80">{content}</a>
  ) : content;
}

// F3/Human Handoff (19/08): estado real existe no backend desde 09/08
// (aiSdrContatoState.handoffStatus), mas nunca teve superfície em
// nenhuma tela — inbox é onde faz sentido materializar. Sem isso, "IA
// respondendo" e "precisa de humano" são indistinguíveis pro atendente.
const HANDOFF_INFO: Record<string, { label: string; icon: typeof Bot; variant: "neutral" | "warning" | "success" }> = {
  ai_handling: { label: "IA atendendo", icon: Bot, variant: "neutral" },
  human_required: { label: "Precisa de humano", icon: AlertCircle, variant: "warning" },
  human_assigned: { label: "Você está atendendo", icon: UserCog, variant: "success" },
};

function StatusIcon({ status }: { status: string | null }) {
  switch (status) {
    case "pending":
      return <Clock className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />;
    case "sent":
      return <Check className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />;
    case "delivered":
      return <CheckCheck className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />;
    case "read":
      return <CheckCheck className="w-3 h-3" style={{ color: "#3b82f6" }} />;
    case "failed":
      return <AlertCircle className="w-3 h-3" style={{ color: "var(--cf2-danger-text)" }} />;
    default:
      return <Check className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />;
  }
}

export function Cf2ChatThread({
  conversa,
  contexto,
  onAtribuir,
}: {
  conversa: ConversaItem;
  contexto: Contexto | null;
  onAtribuir: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const meuUsuarioId = session?.user?.id ?? null;
  const [texto, setTexto] = useState("");
  const [replyTo, setReplyTo] = useState<Mensagem | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [gerenciarTemplates, setGerenciarTemplates] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  // Correção 19/08 (Atendimento): template já existia real (backend +
  // gestão no legado ChatPanel.tsx), só não estava ligado no inbox novo do
  // CRM2 — mesma rota, mesmo dado, sem duplicar.
  const { data: templates } = useQuery<{ id: string; nome: string; categoria: string; conteudo: string }[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/templates");
      if (!r.ok) return [];
      // GET /whatsapp/templates devolve envelope { templates: [...] }, não
      // array bare — achado real (19/08): o legado ChatPanel.tsx tratava
      // como array direto, então o picker ficava sempre vazio mesmo com
      // template real cadastrado. Corrigido aqui e lá.
      const body = await r.json();
      return body?.templates ?? [];
    },
  });
  const { data: tagsData, refetch: refetchTags } = useQuery<{ tags: { id: string; nome: string; cor: string }[] }>({
    queryKey: ["cf2-conversation-tags", conversa.id],
    queryFn: async () => {
      const r = await fetch(`/api/atendimento/conversas/${conversa.id}/tags`);
      return r.ok ? r.json() : { tags: [] };
    },
  });
  const { data: labels = [] } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const r = await fetch("/api/labels");
      return r.ok ? r.json() : [];
    },
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cf2-whatsapp-messages", conversa.id],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/messages/${conversa.id}?limit=100`);
      if (!res.ok) return { messages: [] };
      return res.json();
    },
    refetchInterval: 4000,
  });

  const toggleAiMutation = useMutation({
    mutationFn: async (aiAtivo: boolean) => {
      const res = await fetch(`/api/ai-sdr/contatos/${conversa.id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiAtivo }),
      });
      if (!res.ok) throw new Error("Falha ao mudar o atendimento");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] }),
  });

  // Mensagens reais de sucesso/erro por ação (23/08) — antes essa mutation
  // não dava nenhum retorno visível: clique em "Atribuir a mim"/"Devolver
  // pra fila" (ícone de pessoa no cabeçalho) parecia não fazer nada além de
  // o próprio botão mudar de estado. `acao` já vem tipado pelo backend
  // (claim/transfer/release/snooze/unsnooze/close/reopen).
  const ACAO_SUCESSO: Record<string, string> = {
    claim: "Conversa atribuída a você",
    release: "Conversa devolvida pra fila",
    snooze: "Conversa adiada",
    close: "Conversa marcada como resolvida",
    reopen: "Conversa reaberta",
  };
  const conversationActionMutation = useMutation({
    mutationFn: async ({ acao, minutos }: { acao: string; minutos?: number }) => {
      const res = await fetch(`/api/atendimento/conversas/${conversa.id}/acao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, minutos }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar a conversa");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] });
      const msg = ACAO_SUCESSO[variables.acao];
      if (msg) toast.success(msg);
    },
    onError: () => toast.error("Falha ao atualizar a conversa. Tente novamente."),
  });

  const tagMutation = useMutation({
    mutationFn: async ({ labelId, remove }: { labelId: string; remove?: boolean }) => {
      const r = await fetch(`/api/atendimento/conversas/${conversa.id}/tags${remove ? `/${labelId}` : ""}`, {
        method: remove ? "DELETE" : "POST",
        headers: remove ? undefined : { "Content-Type": "application/json" },
        body: remove ? undefined : JSON.stringify({ labelId }),
      });
      if (!r.ok) throw new Error("Falha ao atualizar tag");
    },
    onSuccess: () => refetchTags(),
  });

  const snooze = () => {
    const value = window.prompt("Adiar por quantos minutos?", "60");
    if (!value) return;
    const minutos = Number(value);
    if (Number.isFinite(minutos) && minutos > 0) conversationActionMutation.mutate({ acao: "snooze", minutos });
  };

  const copiarTelefone = () => {
    if (!conversa.telefone) return;
    navigator.clipboard.writeText(conversa.telefone)
      .then(() => toast.success("Telefone copiado"))
      .catch(() => toast.error("Não foi possível copiar o telefone"));
    setMenuAberto(false);
  };

  const mensagens: Mensagem[] = [...(data?.messages ?? [])].reverse();
  const findMsg = (id: string | null) => (id ? mensagens.find((m) => m.id === id) : undefined);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["cf2-whatsapp-messages", conversa.id] });
    queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] });
  };

  const sendMutation = useMutation({
    mutationFn: async (payload: { conteudo?: string; tipo?: string; mediaData?: string; fileName?: string; latitude?: number; longitude?: number }) => {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contatoId: conversa.id, tipo: "text", ...payload, replyToId: replyTo?.id }),
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      return res.json();
    },
    onSuccess: () => {
      setTexto("");
      setReplyTo(null);
      invalidateAll();
    },
  });

  const handleSendText = () => {
    if (!texto.trim()) return;
    sendMutation.mutate({ conteudo: texto.trim(), tipo: "text" });
  };

  const handleTemplateSelect = (tpl: { conteudo: string }) => {
    const interpolado = tpl.conteudo
      .replace(/\{\{nome\}\}/g, conversa.nome.split(" ")[0] || "")
      .replace(/\{\{empresa\}\}/g, conversa.empresaNome || "");
    setTexto(interpolado);
    setShowTemplates(false);
  };

  const templatesVisiveis = (templates ?? []).filter((tpl) => {
    const termo = texto.startsWith("/") ? texto.slice(1).trim().toLowerCase() : "";
    return !termo || tpl.nome.toLowerCase().includes(termo) || tpl.categoria.toLowerCase().includes(termo);
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let tipo = "document";
    if (file.type.startsWith("image/")) tipo = "image";
    else if (file.type.startsWith("video/")) tipo = "video";
    const reader = new FileReader();
    reader.onload = () => {
      sendMutation.mutate({ conteudo: "", tipo, mediaData: reader.result as string, fileName: file.name });
    };
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
  };

  const handleLocationShare = () => {
    setShowAttachMenu(false);
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      sendMutation.mutate({ conteudo: "", tipo: "location", latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    });
  };

  const handleContactShare = () => {
    setShowAttachMenu(false);
    const name = prompt("Nome do contato:");
    if (!name) return;
    const phone = prompt("Telefone do contato (com DDD):");
    if (!phone) return;
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL:${phone}\nEND:VCARD`;
    sendMutation.mutate({ conteudo: JSON.stringify({ name, vcard }), tipo: "contact" });
  };

  const handleReact = (msg: Mensagem, emoji: string) => {
    if (!msg.uazapiMessageId || !conversa.telefone) return;
    fetch("/api/whatsapp/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "react", phone: conversa.telefone, messageId: msg.uazapiMessageId, emoji }),
    }).then(invalidateAll).catch(() => {});
    setReactionPickerId(null);
    setHoveredId(null);
  };

  const handleDelete = (msg: Mensagem) => {
    if (!msg.uazapiMessageId || !conversa.telefone || msg.direcao !== "out") return;
    if (!confirm("Apagar esta mensagem?")) return;
    fetch("/api/whatsapp/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", phone: conversa.telefone, messageId: msg.uazapiMessageId }),
    }).then(invalidateAll).catch(() => {});
    setHoveredId(null);
  };

  const ultimaSessaoNome = [...mensagens].reverse().find((m) => m.sessaoUsuarioNome)?.sessaoUsuarioNome;

  return (
    <div
      className="flex-1 flex flex-col h-full min-w-0 rounded-3xl overflow-hidden"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      <div
        className="flex items-center justify-between p-4 shrink-0"
        style={{ background: "var(--cf2-bg-page)", borderBottom: "1px solid var(--cf2-border-default)" }}
      >
        <div className="flex gap-3 items-center min-w-0">
          <div className="flex items-center justify-center rounded-[20px] shrink-0 w-10 h-10" style={{ background: "var(--cf2-accent)" }}>
            <p className="text-[14px] font-extrabold" style={{ color: "var(--cf2-text-on-accent)" }}>{/^\d+$/.test(conversa.nome) ? "#" : iniciais(conversa.nome)}</p>
          </div>
          <div className="min-w-0">
            <div className="flex gap-1.5 items-center">
              <p className="text-[16px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{nomeExibicao(conversa.nome, conversa.telefone)}</p>
              {conversa.empresaNome && <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>· {conversa.empresaNome}</p>}
              {contexto && <Cf2Badge variant={contexto.isCliente ? "success" : "neutral"}>{contexto.isCliente ? "Cliente" : "Lead"}</Cf2Badge>}
              {conversa.handoffStatus && HANDOFF_INFO[conversa.handoffStatus] && (
                <Cf2Badge variant={HANDOFF_INFO[conversa.handoffStatus].variant}>
                  {HANDOFF_INFO[conversa.handoffStatus].label}
                </Cf2Badge>
              )}
              {tagsData?.tags.map((tag) => (
                <button key={tag.id} onClick={() => tagMutation.mutate({ labelId: tag.id, remove: true })} title="Remover tag" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ color: tag.cor, background: `${tag.cor}18` }}>
                  <Tag className="w-2.5 h-2.5" />{tag.nome}
                </button>
              ))}
              {labels.filter((label) => !tagsData?.tags.some((tag) => tag.id === label.id)).length > 0 && (
                <select
                  aria-label="Adicionar tag à conversa"
                  value=""
                  onChange={(e) => { if (e.target.value) tagMutation.mutate({ labelId: e.target.value }); }}
                  className="max-w-[110px] rounded px-1 py-0.5 text-[10px] outline-none"
                  style={{ color: "var(--cf2-text-secondary)", background: "var(--cf2-bg-surface-muted)" }}
                >
                  <option value="">+ tag</option>
                  {labels.filter((label) => !tagsData?.tags.some((tag) => tag.id === label.id)).map((label) => <option key={label.id} value={label.id}>{label.nome}</option>)}
                </select>
              )}
            </div>
            <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>
              {ultimaSessaoNome ? `via WhatsApp de ${ultimaSessaoNome}` : "WhatsApp"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center shrink-0">
          {conversa.tipo === "whatsapp" && conversa.handoffStatus !== "human_assigned" ? (
            <button
              onClick={() => toggleAiMutation.mutate(false)}
              disabled={toggleAiMutation.isPending}
              title="Pausa a IA e assume a conversa você mesmo"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
              style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
            >
              {toggleAiMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCog className="w-3.5 h-3.5" />}
              Assumir conversa
            </button>
          ) : conversa.tipo === "whatsapp" && conversa.handoffStatus === "human_assigned" ? (
            <button
              onClick={() => toggleAiMutation.mutate(true)}
              disabled={toggleAiMutation.isPending}
              title="Devolve a conversa pra IA responder"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
              style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}
            >
              {toggleAiMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              Devolver pra IA
            </button>
          ) : null}
          <button onClick={onAtribuir} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>
            Atribuir
          </button>
          {/* Responsável pela conversa (contatos.responsavelId) — correção
              23/08: antes só existia como botão "Devolver para a fila"
              (acao=release), visível apenas quando JÁ havia responsável;
              clicar zerava responsavelId e o próprio botão desaparecia sem
              nenhum retorno visível ("ícone que some sem fazer nada útil").
              Vira toggle real de 3 estados usando as ações que o backend já
              suporta (claim/release em atendimento.ts) — mesmo padrão do
              toggle IA/Humano acima, dimensão diferente (dono da conversa,
              não quem está respondendo). */}
          {conversa.status !== "closed" && (
            meuUsuarioId && conversa.responsavelId === meuUsuarioId ? (
              <button
                onClick={() => conversationActionMutation.mutate({ acao: "release" })}
                disabled={conversationActionMutation.isPending}
                title="Você está com esta conversa. Clique para devolver pra fila."
                className="p-1.5 rounded-lg disabled:opacity-50"
                style={{ background: "var(--cf2-accent)" }}
              >
                {conversationActionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--cf2-text-on-accent)" }} />
                ) : (
                  <UserCheck className="w-4 h-4" style={{ color: "var(--cf2-text-on-accent)" }} />
                )}
              </button>
            ) : conversa.responsavelId ? (
              <button
                disabled
                title="Atribuída a outro atendente"
                className="p-1.5 rounded-lg opacity-50 cursor-not-allowed"
                style={{ background: "var(--cf2-bg-surface-muted)" }}
              >
                <User className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} />
              </button>
            ) : (
              <button
                onClick={() => conversationActionMutation.mutate({ acao: "claim" })}
                disabled={conversationActionMutation.isPending}
                title="Assumir esta conversa para você"
                className="p-1.5 rounded-lg disabled:opacity-50"
                style={{ background: "var(--cf2-bg-surface-muted)" }}
              >
                {conversationActionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--cf2-text-secondary)" }} />
                ) : (
                  <User className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} />
                )}
              </button>
            )
          )}
          {conversa.status === "closed" ? (
            <button
              onClick={() => conversationActionMutation.mutate({ acao: "reopen" })}
              disabled={conversationActionMutation.isPending}
              title="Reabrir conversa"
              className="p-1.5 rounded-lg disabled:opacity-50"
              style={{ background: "var(--cf2-bg-surface-muted)" }}
            >
              <RotateCcw className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} />
            </button>
          ) : (
            <>
              <button
                onClick={snooze}
                disabled={conversationActionMutation.isPending}
                title="Adiar conversa"
                className="p-1.5 rounded-lg disabled:opacity-50"
                style={{ background: "var(--cf2-bg-surface-muted)" }}
              >
                <Clock3 className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} />
              </button>
              <button
                onClick={() => conversationActionMutation.mutate({ acao: "close" })}
                disabled={conversationActionMutation.isPending}
                title="Fechar conversa"
                className="p-1.5 rounded-lg disabled:opacity-50"
                style={{ background: "var(--cf2-bg-surface-muted)" }}
              >
                <Archive className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} />
              </button>
            </>
          )}
          {/* Menu "..." (correção 23/08): antes não tinha onClick, botão
              morto. Populado só com ações reais que já têm dado/rota pronta
              — perfil do contato (mesma rota já usada em Cliente360/
              PaginaCompleta) e copiar telefone (dado já disponível em
              conversa.telefone). Marcar resolvido/reabrir/adiar já têm
              botão dedicado no cabeçalho, não duplicados aqui. Sem
              leadId/telefone reais, a opção correspondente nem aparece —
              não fabrica ação sem dado por trás. */}
          <div className="relative">
            <button
              onClick={() => setMenuAberto((v) => !v)}
              className="p-1.5 rounded-lg"
              style={{ background: menuAberto ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)" }}
            >
              <MoreHorizontal className="w-4 h-4" style={{ color: menuAberto ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }} />
            </button>
            {menuAberto && (
              <div
                className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl overflow-hidden shadow-md"
                style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
              >
                {conversa.leadId ? (
                  <Link
                    href={`/contatos/${conversa.leadId}`}
                    onClick={() => setMenuAberto(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-[12px] font-semibold hover:bg-[var(--cf2-bg-surface-muted)]"
                    style={{ color: "var(--cf2-text-primary)" }}
                  >
                    <UserRound className="w-3.5 h-3.5" /> Ver perfil do contato
                  </Link>
                ) : (
                  <p className="px-3 py-2.5 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                    Sem lead vinculado — sem perfil pra abrir.
                  </p>
                )}
                {conversa.telefone && (
                  <button
                    onClick={copiarTelefone}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] font-semibold text-left hover:bg-[var(--cf2-bg-surface-muted)]"
                    style={{ color: "var(--cf2-text-primary)", borderTop: "1px solid var(--cf2-border-default)" }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar telefone
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-1 p-5" style={{ background: "var(--cf2-bg-canvas)" }}>
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--cf2-text-tertiary)" }} />
            <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando conversa...</p>
          </div>
        )}
        {!isLoading && mensagens.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
            <MessageSquareOff className="w-6 h-6" style={{ color: "var(--cf2-text-tertiary)" }} />
            <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma mensagem ainda nesta conversa.</p>
          </div>
        )}

        {/* Resumo por IA (20/08, referência UX) — só aparece quando existe
            dado real em ai_sdr_contato_state.conversation_summary (o Agente
            SDR já processou essa conversa). Sem dado, não renderiza nada:
            não fabricar resumo nem chamar IA nova aqui. */}
        {conversa.conversationSummary && (
          <div className="self-center flex flex-col gap-2 max-w-[85%] my-2">
            <button
              onClick={() => setResumoAberto((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold self-center"
              style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)" }}
            >
              <Sparkles className="w-3 h-3" /> Carol AI resumiu esta conversa
              <ChevronDown className="w-3 h-3 transition-transform" style={{ transform: resumoAberto ? "rotate(180deg)" : "none" }} />
            </button>
            {resumoAberto && (
              <div className="p-3 rounded-xl text-[12px] whitespace-pre-wrap" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}>
                {conversa.conversationSummary}
              </div>
            )}
          </div>
        )}

        {mensagens.map((m) => {
          const isOut = m.direcao === "out";
          const isHovered = hoveredId === m.id;
          const replyMsg = findMsg(m.replyToId);
          return (
            <div
              key={m.id}
              className={`flex ${isOut ? "justify-end" : "justify-start"} relative py-1`}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => { if (reactionPickerId !== m.id) setHoveredId(null); }}
            >
              {isHovered && (
                <div
                  className={`absolute top-0 z-10 flex items-center gap-0.5 px-1 py-0.5 rounded-lg shadow-md ${isOut ? "right-2 -translate-y-full" : "left-2 -translate-y-full"}`}
                  style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
                >
                  <button onClick={() => setReplyTo(m)} title="Responder" className="p-1.5 rounded hover:bg-[var(--cf2-bg-surface-muted)]">
                    <Reply className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} />
                  </button>
                  <button onClick={() => setReactionPickerId(reactionPickerId === m.id ? null : m.id)} title="Reagir" className="p-1.5 rounded hover:bg-[var(--cf2-bg-surface-muted)]">
                    <Smile className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} />
                  </button>
                  {isOut && m.uazapiMessageId && (
                    <button onClick={() => handleDelete(m)} title="Apagar" className="p-1.5 rounded hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--cf2-danger-text)" }} />
                    </button>
                  )}
                </div>
              )}

              {reactionPickerId === m.id && (
                <div
                  className={`absolute z-20 flex items-center gap-1 px-2 py-1.5 rounded-full shadow-md ${isOut ? "right-2" : "left-2"}`}
                  style={{ top: -44, background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
                >
                  {QUICK_REACTIONS.map((emoji) => (
                    <button key={emoji} onClick={() => handleReact(m, emoji)} className="w-6 h-6 flex items-center justify-center hover:scale-125 transition-transform">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div
                className="max-w-[70%] p-3 rounded-2xl flex flex-col gap-1"
                style={{
                  background: isOut ? "var(--cf2-success-bg)" : "var(--cf2-bg-surface-muted)",
                  border: isOut ? "0.5px solid var(--cf2-success-fill)" : "0.5px solid var(--cf2-border-default)",
                }}
              >
                {isOut && m.enviadoPorNome && (
                  <p className="text-[10px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>{m.enviadoPorNome}</p>
                )}
                {replyMsg && (
                  <div className="px-2 py-1.5 rounded-lg text-[11px] border-l-2" style={{ background: "rgba(0,0,0,0.03)", borderColor: "var(--cf2-accent-border)" }}>
                    <p className="truncate" style={{ color: "var(--cf2-text-secondary)" }}>{replyMsg.conteudo || "Mensagem"}</p>
                  </div>
                )}
                {m.mediaUrl && m.tipo === "image" && <img src={m.mediaUrl} alt="" className="rounded-lg max-w-full" />}
                {m.mediaUrl && m.tipo === "audio" && <audio controls src={m.mediaUrl} className="max-w-full" />}
                {m.tipo === "document" && (m.mediaUrl || m.mediaFilename) && (
                  <FileAttachmentCard url={m.mediaUrl} filename={m.mediaFilename} />
                )}
                {m.conteudo && m.tipo !== "location" && m.tipo !== "contact" && (
                  <p className="text-[13px] leading-[18px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-primary)" }}>{m.conteudo}</p>
                )}
                <div className="flex items-center gap-1 justify-end">
                  <p className="text-[10px]" style={{ color: "var(--cf2-text-secondary)" }}>
                    {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {/* Retry só cobre texto: mensagens com mídia falhas não têm
                      o arquivo original guardado no cliente pra reenviar. */}
                  {isOut && m.status === "failed" && m.tipo === "text" ? (
                    <button
                      onClick={() => sendMutation.mutate({ conteudo: m.conteudo || "", tipo: "text" })}
                      disabled={sendMutation.isPending}
                      title="Falhou ao entregar. Clique para tentar novamente."
                      className="disabled:opacity-50"
                    >
                      <StatusIcon status={m.status} />
                    </button>
                  ) : (
                    isOut && <StatusIcon status={m.status} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showAttachMenu && (
        <div className="mx-4 mb-2 rounded-xl p-3 grid grid-cols-4 gap-1" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
          <label className="flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer hover:bg-[var(--cf2-bg-surface)]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#a855f726" }}>
              <Camera className="w-4 h-4" style={{ color: "#a855f7" }} />
            </div>
            <span className="text-[10px]" style={{ color: "var(--cf2-text-secondary)" }}>Foto/Vídeo</span>
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
          </label>
          <label className="flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer hover:bg-[var(--cf2-bg-surface)]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#3b82f626" }}>
              <FileIcon className="w-4 h-4" style={{ color: "#3b82f6" }} />
            </div>
            <span className="text-[10px]" style={{ color: "var(--cf2-text-secondary)" }}>Documento</span>
            <input type="file" className="hidden" onChange={handleFileSelect} />
          </label>
          <button onClick={handleLocationShare} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[var(--cf2-bg-surface)]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--cf2-danger-text)26" }}>
              <MapPin className="w-4 h-4" style={{ color: "var(--cf2-danger-text)" }} />
            </div>
            <span className="text-[10px]" style={{ color: "var(--cf2-text-secondary)" }}>Localização</span>
          </button>
          <button onClick={handleContactShare} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[var(--cf2-bg-surface)]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--cf2-success-fill)26" }}>
              <User className="w-4 h-4" style={{ color: "var(--cf2-success-fill)" }} />
            </div>
            <span className="text-[10px]" style={{ color: "var(--cf2-text-secondary)" }}>Contato</span>
          </button>
        </div>
      )}

      {showTemplates && (
        <div className="mx-4 mb-2 rounded-xl overflow-hidden max-h-48 overflow-y-auto" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
          {templatesVisiveis.length > 0 ? templatesVisiveis.map((tpl) => (
            <button key={tpl.id} onClick={() => handleTemplateSelect(tpl)} className="w-full text-left px-4 py-2.5 hover:bg-[var(--cf2-bg-surface)]">
              <div className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{tpl.categoria}</div>
              <div className="text-[13px] line-clamp-2" style={{ color: "var(--cf2-text-primary)" }}>{tpl.conteudo}</div>
            </button>
          )) : (
            <p className="px-4 py-3 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum template cadastrado ainda.</p>
          )}
          <button
            onClick={() => { setGerenciarTemplates(true); setShowTemplates(false); }}
            className="w-full text-left px-4 py-2.5 text-[12px] font-semibold"
            style={{ color: "var(--cf2-accent)", borderTop: "1px solid var(--cf2-border-default)" }}
          >
            + Gerenciar templates
          </button>
        </div>
      )}
      {gerenciarTemplates && <WhatsappTemplatesModal onClose={() => setGerenciarTemplates(false)} />}

      <div className="p-4 shrink-0 flex flex-col gap-2" style={{ background: "var(--cf2-bg-page)", borderTop: "1px solid var(--cf2-border-default)" }}>
        {replyTo && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>Respondendo: {replyTo.conteudo || "mensagem"}</p>
            <button onClick={() => setReplyTo(null)}><X className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} /></button>
          </div>
        )}
        <div className="flex gap-3 items-center">
          <button
            onClick={() => { setShowAttachMenu(!showAttachMenu); setShowTemplates(false); }}
            className="p-2 rounded-lg shrink-0"
            style={{ background: showAttachMenu ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)" }}
          >
            <Paperclip className="w-4 h-4" style={{ color: showAttachMenu ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }} />
          </button>
          <button
            onClick={() => { setShowTemplates(!showTemplates); setShowAttachMenu(false); }}
            title="Usar template"
            className="p-2 rounded-lg shrink-0"
            style={{ background: showTemplates ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)" }}
          >
            <MessageSquareText className="w-4 h-4" style={{ color: showTemplates ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)" }} />
          </button>
          <div
            className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
          >
            <input
              value={texto}
              onChange={(e) => {
                const value = e.target.value;
                setTexto(value);
                setShowTemplates(value.startsWith("/") && value.length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && showTemplates && templatesVisiveis[0]) {
                  e.preventDefault();
                  handleTemplateSelect(templatesVisiveis[0]);
                } else if (e.key === "Enter") {
                  handleSendText();
                }
              }}
              placeholder={`Escrever uma mensagem para ${conversa.nome.split(" ")[0]}...`}
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--cf2-text-primary)" }}
            />
          </div>
          <button
            onClick={handleSendText}
            disabled={!texto.trim() || sendMutation.isPending}
            className="flex items-center justify-center rounded-[20px] shrink-0 w-10 h-10 disabled:opacity-50"
            style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)" }}
          >
            <Send className="w-4 h-4" style={{ color: "var(--cf2-text-on-accent)" }} />
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" className="hidden" />
    </div>
  );
}
