"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import {
  Send,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  ExternalLink,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Building2,
  Phone as PhoneIcon,
  Mail,
  Briefcase,
  MessageCircle,
  Film,
  Mic,
  MapPin,
  Download,
  X,
  Plus,
  Camera,
  File,
  User,
  Trash2,
  Reply,
  Copy,
  Smile,
  MicOff,
  Tag,
  Bot,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface Message {
  id: string;
  leadId: string;
  telefone: string;
  direcao: "in" | "out";
  tipo: string;
  conteudo: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaFilename: string | null;
  status: string;
  statusAt: string | null;
  templateNome: string | null;
  enviadoPorId: string | null;
  uazapiMessageId: string | null;
  replyToId: string | null;
  reactions: { emoji: string; sender: string }[] | null;
  dados: { aiGenerated?: boolean } | null;
  createdAt: string;
}

interface ChatPanelProps {
  leadId: string;
  contatoId?: string; // If provided, send API uses contatoId instead of leadId
  leadNome: string;
  leadTelefone: string;
  leadStatus: string;
  leadEmpresa?: string | null;
  compact?: boolean;
  readOnly?: boolean;
  onStatusChange?: (newStatus: string) => void;
  /** Render prop: extra actions to show in the header right side */
  headerActions?: React.ReactNode;
  /** Called when clicking on the contact name (e.g., to open info sidebar) */
  onNameClick?: () => void;
  /** Texto pré-preenchido no compositor (ex.: template vindo do pós-venda) */
  initialText?: string;
}

// ─── Constants ───────────────────────────────────────────

// Fallback color map for components outside hook scope (e.g., ContactAvatar)
const STATUS_COLORS_MAP: Record<string, string> = {
  novo: "#3B82F6", contatado: "#8B5CF6", diagnostico: "#F59E0B", respondeu: "#10B981",
  proposta: "#EC4899", negociacao: "#8e27ef", fechado: "#10B981",
  implantacao: "#14B8A6", ativo: "#10B981", perdido: "#EF4444", churned: "#6B7280",
  lead: "#3B82F6", cliente: "#10B981",
};

function getInitials(nome: string) {
  return nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Convert URLs in text to clickable links */
function Linkify({ children }: { children: string }) {
  const parts = children.split(/(https?:\/\/[^\s<]+)/g);
  if (parts.length === 1) return <>{children}</>;
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 hover:underline break-all">{part}</a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function ChatHeaderAvatar({ phone, nome, status }: { phone: string; nome: string; status: string }) {
  const [imgError, setImgError] = useState(false);
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

  const avatarUrl = data?.url;
  const showImage = avatarUrl && !imgError;
  const color = STATUS_COLORS_MAP[status] || "#e23752";

  useEffect(() => { setImgError(false); }, [avatarUrl]);

  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt={nome}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}80)` }}
    >
      {getInitials(nome)}
    </div>
  );
}

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

const EMOJI_LIST = [
  "😀", "😂", "🥰", "😍", "😊", "😎", "🤩", "😇", "😋", "🤗", "😴", "😱", "🤔", "🙄", "😤", "😡",
  "👍", "👎", "👏", "🙏", "🤝", "✌️", "🤞", "👌", "🤙", "💪", "🎉", "🎊",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "🔥", "⭐", "✅", "❌", "⚡", "💰", "📎",
];

// ─── Helper Components ───────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Clock className="w-3 h-3 text-white/20" />;
    case "sent":
      return <Check className="w-3 h-3 text-white/30" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 text-white/30" />;
    case "read":
      return <CheckCheck className="w-3 h-3 text-blue-400" />;
    case "failed":
      return <AlertCircle className="w-3 h-3 text-red-400" />;
    default:
      return <Check className="w-3 h-3 text-white/20" />;
  }
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Ontem ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString("pt-BR", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

/** Image with fallback for expired CDN URLs */
function ImageWithFallback({ src, onOpenLightbox }: { src: string; onOpenLightbox?: (url: string, tipo: string) => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="rounded-lg mb-1.5 w-[200px] h-[120px] flex items-center justify-center bg-white/[0.05] border border-white/[0.08] text-white/30 text-xs">
        Imagem indisponível
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="rounded-lg mb-1.5 max-w-[260px] max-h-[200px] object-cover cursor-pointer"
      loading="lazy"
      onClick={() => onOpenLightbox?.(src, "image")}
      onError={() => setFailed(true)}
    />
  );
}

/** Render media content based on message type */
function MediaContent({ msg, onOpenLightbox }: { msg: Message; onOpenLightbox?: (url: string, tipo: string) => void }) {
  const { tipo, mediaUrl, mediaFilename, conteudo } = msg;

  if (tipo === "image" && mediaUrl) {
    return <ImageWithFallback src={mediaUrl} onOpenLightbox={onOpenLightbox} />;
  }

  if (tipo === "video" && mediaUrl) {
    return (
      <div
        className="relative rounded-lg mb-1.5 max-w-[260px] overflow-hidden cursor-pointer"
        onClick={() => onOpenLightbox?.(mediaUrl, "video")}
      >
        <video
          src={mediaUrl}
          className="rounded-lg max-w-[260px] max-h-[200px]"
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[16px] border-l-white ml-1" />
          </div>
        </div>
      </div>
    );
  }

  if (tipo === "audio" && mediaUrl) {
    return (
      <div className="flex items-center gap-2 mb-1.5 min-w-[200px]">
        <audio src={mediaUrl} controls className="h-8 w-full" style={{ maxWidth: 240 }} />
      </div>
    );
  }

  if (tipo === "document" && mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 mb-1.5 px-3 py-2 rounded-lg text-xs transition-colors"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <FileText className="w-5 h-5 text-blue-400 shrink-0" />
        <span className="flex-1 min-w-0 text-white/70 truncate">{mediaFilename || "Documento"}</span>
        <Download className="w-4 h-4 text-white/40 shrink-0" />
      </a>
    );
  }

  if (tipo === "sticker" && mediaUrl) {
    return (
      <img
        src={mediaUrl}
        alt="Sticker"
        className="max-w-[150px] max-h-[150px] mb-1"
        loading="lazy"
      />
    );
  }

  if (tipo === "location" && conteudo) {
    const parts = conteudo.split(",").map(Number);
    const lat = parts[0];
    const lng = parts[1];
    if (lat && lng) {
      return (
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 mb-1.5 px-3 py-2.5 rounded-lg text-xs transition-colors hover:bg-white/[0.08]"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <MapPin className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <span className="text-white/70 font-medium">Localização</span>
            <span className="text-white/30 block text-[10px]">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
          </div>
          <ExternalLink className="w-3 h-3 text-white/40 shrink-0" />
        </a>
      );
    }
  }

  if (tipo === "contact" && conteudo) {
    let name = conteudo;
    let phone = "";
    try {
      const parsed = JSON.parse(conteudo);
      name = parsed.name || conteudo;
      const vcardMatch = parsed.vcard?.match(/TEL[^:]*:(.+)/);
      phone = vcardMatch?.[1] || "";
    } catch { /* raw text */ }
    return (
      <div
        className="flex items-center gap-2 mb-1.5 px-3 py-2.5 rounded-lg text-xs"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <User className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="flex-1">
          <span className="text-white/70 font-medium">{name}</span>
          {phone && <span className="text-white/30 block text-[10px]">{phone}</span>}
        </div>
      </div>
    );
  }

  return null;
}

/** File to base64 data URI */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Emoji Picker ────────────────────────────────────────

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  return (
    <div
      className="absolute bottom-full mb-2 left-0 z-50 rounded-xl p-3 shadow-xl"
      style={{ background: "rgba(30,30,40,0.98)", border: "1px solid rgba(255,255,255,0.1)", width: 280 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40">Emojis</span>
        <button onClick={onClose} className="p-0.5 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.08] text-base transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

export function ChatPanel({
  leadId,
  contatoId,
  leadNome,
  leadTelefone,
  leadStatus,
  leadEmpresa,
  compact = false,
  readOnly = false,
  onStatusChange,
  headerActions,
  onNameClick,
  initialText,
}: ChatPanelProps) {
  // State
  const [text, setText] = useState(initialText ?? "");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachPreview, setAttachPreview] = useState<{ file: File; type: string; previewUrl: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; tipo: string } | null>(null);

  // Dynamic pipeline stages from org config
  const pipelineCfg = usePipelineConfig();
  const pipelineStagesForChat = useMemo(() =>
    [...pipelineCfg.stages, ...pipelineCfg.closedStages].map(s => ({ value: s.key, label: s.label, color: s.color })),
    [pipelineCfg.stages, pipelineCfg.closedStages]
  );

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  // Template vindo de outra tela: só preenche o compositor se ele estiver
  // vazio — nunca sobrescreve o que o usuário já digitou.
  const lastInitialTextRef = useRef<string | undefined>(initialText);
  useEffect(() => {
    if (initialText === lastInitialTextRef.current) return;
    lastInitialTextRef.current = initialText;
    if (initialText) setText((atual) => (atual.trim() ? atual : initialText));
  }, [initialText]);

  // ─── Queries ─────────────────────────────────────────

  const { data: msgData } = useQuery({
    queryKey: ["whatsapp-messages", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/messages/${leadId}?limit=100`);
      if (!res.ok) return { messages: [], total: 0 };
      return res.json();
    },
    refetchInterval: 3000,
    enabled: !!leadId,
  });

  const messages: Message[] = msgData?.messages ?? [];
  const reversedMessages = [...messages].reverse();

  const { data: templates } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/templates");
      if (!res.ok) return [];
      // Achado real 19/08: a rota devolve { templates: [...] }, não array
      // bare — o picker ficava sempre vazio mesmo com template cadastrado.
      const body = await res.json();
      return body?.templates ?? [];
    },
    staleTime: 60000,
  });

  const { data: waStatus } = useQuery({
    queryKey: ["whatsapp-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) return { sessions: [] };
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: allLabels } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const res = await fetch("/api/labels");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: leadLabelsData } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["lead-labels", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/labels`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!leadId,
  });


  // ─── Mutations ───────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: async (payload: {
      conteudo?: string; tipo?: string; mediaData?: string; fileName?: string;
      templateId?: string; latitude?: number; longitude?: number; replyToId?: string;
    }) => {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(contatoId ? { contatoId } : { leadId }), ...payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[ChatPanel] Send failed:", res.status, err);
        throw new Error(err?.error || "Falha ao enviar");
      }
      return res.json();
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["whatsapp-messages", leadId] });
      const previous = queryClient.getQueryData(["whatsapp-messages", leadId]);
      queryClient.setQueryData(["whatsapp-messages", leadId], (old: { messages: Message[]; total: number } | undefined) => {
        const optimistic: Message = {
          id: `optimistic-${Date.now()}`,
          leadId,
          telefone: leadTelefone,
          direcao: "out",
          tipo: payload.tipo || "text",
          conteudo: payload.conteudo || null,
          mediaUrl: null,
          mediaType: null,
          mediaFilename: payload.fileName || null,
          status: "pending",
          statusAt: null,
          templateNome: null,
          enviadoPorId: null,
          uazapiMessageId: null,
          replyToId: payload.replyToId || null,
          reactions: [],
          dados: null,
          createdAt: new Date().toISOString(),
        };
        return { messages: [optimistic, ...(old?.messages || [])], total: (old?.total || 0) + 1 };
      });
      setText("");
      setAttachPreview(null);
      setReplyTo(null);
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["whatsapp-messages", leadId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["pre-vendas-leads"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  const moveStageMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Falha ao mover");
      return res.json();
    },
    onSuccess: (_, newStatus) => {
      onStatusChange?.(newStatus);
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
    },
  });

  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leadDetail } = useQuery<any>({
    queryKey: ["lead-detail", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!leadId && showLeadPanel,
    staleTime: 30_000,
  });

  const toggleLabelMutation = useMutation({
    mutationFn: async ({ labelId, action }: { labelId: string; action: "add" | "remove" }) => {
      const res = await fetch(`/api/leads/${leadId}/labels`, {
        method: action === "add" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-labels", leadId] });
    },
  });

  // ─── Effects ─────────────────────────────────────────

  const connected = waStatus?.sessions?.some((s: { status: string }) => s.status === "connected") ?? false;

  // Mark messages as read when viewing chat
  useEffect(() => {
    const unreadIncoming = reversedMessages.filter(m => m.direcao === "in" && m.uazapiMessageId);
    if (unreadIncoming.length > 0 && connected) {
      const ids = unreadIncoming.slice(-5).map(m => m.uazapiMessageId!);
      fetch("/api/whatsapp/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markread", messageIds: ids, chatPhone: leadTelefone }),
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, reversedMessages.length]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [reversedMessages.length]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // ─── Typing indicator ───────────────────────────────

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (e.target.value.trim()) {
      fetch("/api/whatsapp/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "presence", phone: leadTelefone, state: "composing" }),
      }).catch(() => {});
      typingTimeoutRef.current = setTimeout(() => {
        fetch("/api/whatsapp/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "presence", phone: leadTelefone, state: "paused" }),
        }).catch(() => {});
      }, 3000);
    }
  }, [leadTelefone]);

  // ─── Send handlers ──────────────────────────────────

  const handleSend = async () => {
    if (sendMutation.isPending) return;

    const basePayload = replyTo ? { replyToId: replyTo.id } : {};

    if (attachPreview) {
      const base64 = await fileToBase64(attachPreview.file);
      sendMutation.mutate({
        ...basePayload,
        conteudo: text.trim() || "",
        tipo: attachPreview.type,
        mediaData: base64,
        fileName: attachPreview.file.name,
      });
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;
    sendMutation.mutate({ ...basePayload, conteudo: trimmed });
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setReplyTo(null);
      setShowEmojiPicker(false);
      setShowAttachMenu(false);
      setShowTemplates(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type = "document";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";
    else if (file.type.startsWith("audio/")) type = "audio";

    const previewUrl = type === "image" ? URL.createObjectURL(file) : "";
    setAttachPreview({ file, type, previewUrl });
    setShowAttachMenu(false);
    textareaRef.current?.focus();
    e.target.value = "";
  };

  const handleTemplateSelect = (tpl: { id: string; conteudo: string; nome: string }) => {
    const interpolated = tpl.conteudo
      .replace(/\{\{nome\}\}/g, leadNome || "")
      .replace(/\{\{empresa\}\}/g, leadEmpresa || "");
    setText(interpolated);
    setShowTemplates(false);
    textareaRef.current?.focus();
  };

  // ─── Audio Recording ───────────────────────────────

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick best supported MIME type
      const mimeTypes = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || "";

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(1000); // collect chunks every 1s
      setIsRecording(true);
      setRecordingTime(0);

      // Use a stable interval ref
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Send recording presence
      fetch("/api/whatsapp/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "presence", phone: leadTelefone, state: "composing", media: "audio" }),
      }).catch(() => {});
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = (send: boolean) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      setRecordingTime(0);

      fetch("/api/whatsapp/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "presence", phone: leadTelefone, state: "paused" }),
      }).catch(() => {});

      if (send && audioChunksRef.current.length > 0) {
        const mimeType = recorder.mimeType || "audio/ogg";
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          sendMutation.mutate({
            conteudo: "",
            tipo: "audio",
            mediaData: base64,
            fileName: "audio.ogg",
          });
        };
        reader.readAsDataURL(blob);
      }
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
    };

    recorder.stop();
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ─── Location Sharing ──────────────────────────────

  const handleLocationShare = () => {
    setShowAttachMenu(false);
    setLocationLoading(true);
    setShowLocationPicker(true);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLoading(false);
        },
        () => {
          setLocationLoading(false);
          toast.error("Não foi possível obter sua localização. Verifique as permissões.");
          setShowLocationPicker(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationLoading(false);
      toast.error("Geolocalização não suportada neste navegador.");
      setShowLocationPicker(false);
    }
  };

  const sendLocationMsg = () => {
    if (!locationCoords) return;
    sendMutation.mutate({
      conteudo: "",
      tipo: "location",
      latitude: locationCoords.lat,
      longitude: locationCoords.lng,
    });
    setShowLocationPicker(false);
    setLocationCoords(null);
  };

  // ─── Contact Sharing ───────────────────────────────

  const handleContactShare = () => {
    setShowAttachMenu(false);
    const name = prompt("Nome do contato:");
    if (!name) return;
    const phone = prompt("Telefone do contato (com DDD):");
    if (!phone) return;

    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL:${phone}\nEND:VCARD`;
    sendMutation.mutate({
      conteudo: JSON.stringify({ name, vcard }),
      tipo: "contact",
    });
  };

  // ─── Message Actions ───────────────────────────────

  const handleReact = (msg: Message, emoji: string) => {
    if (!msg.uazapiMessageId) return;
    // Optimistic update
    queryClient.setQueryData(["whatsapp-messages", leadId], (old: { pages: { messages: Message[] }[] } | undefined) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: page.messages.map((m) => {
            if (m.id !== msg.id) return m;
            const existing = (m.reactions || []).filter((r) => r.sender !== "me");
            return { ...m, reactions: [...existing, { emoji, sender: "me" }] };
          }),
        })),
      };
    });
    fetch("/api/whatsapp/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "react", phone: leadTelefone, messageId: msg.uazapiMessageId, emoji }),
    }).catch(() => {});
    setShowReactionPicker(null);
    setHoveredMsgId(null);
  };

  const handleReply = (msg: Message) => {
    setReplyTo(msg);
    setHoveredMsgId(null);
    setShowReactionPicker(null);
    textareaRef.current?.focus();
  };

  const handleCopyMessage = (msg: Message) => {
    const text = msg.conteudo || "";
    navigator.clipboard.writeText(text).catch(() => {});
    setHoveredMsgId(null);
  };

  const handleDeleteMessage = (msg: Message) => {
    if (!msg.uazapiMessageId || msg.direcao !== "out") return;
    if (!confirm("Apagar esta mensagem?")) return;
    fetch("/api/whatsapp/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", phone: leadTelefone, messageId: msg.uazapiMessageId }),
    }).catch(() => {});
    setHoveredMsgId(null);
  };

  const handleDoubleClick = (msg: Message) => {
    // Double-click to react with ❤️
    if (msg.uazapiMessageId) {
      handleReact(msg, "❤️");
    }
  };

  // ─── Emoji Insert ──────────────────────────────────

  const handleEmojiInsert = (emoji: string) => {
    setText(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  // ─── Find reply-to message ─────────────────────────

  const findMessage = (id: string | null) => {
    if (!id) return null;
    return messages.find(m => m.id === id) || null;
  };

  // ─── Render ────────────────────────────────────────

  const height = "h-full";
  const borderStyle = compact ? { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" } : {};

  return (
    <div className={`flex ${height} ${compact ? "rounded-2xl" : ""} overflow-hidden`} style={borderStyle}>
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Row 1: Name + buttons */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div
            className={`flex items-center gap-3 flex-1 min-w-0 ${onNameClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
            onClick={onNameClick}
          >
            <ChatHeaderAvatar phone={leadTelefone} nome={leadNome} status={leadStatus} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white truncate">{leadNome}</span>
                {leadEmpresa && (
                  <span className="text-xs text-white/40 truncate hidden sm:inline">· {leadEmpresa}</span>
                )}
                {/* Inline label dots */}
                {leadLabelsData && leadLabelsData.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {leadLabelsData.map(l => (
                      <span
                        key={l.id}
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: l.cor }}
                        title={l.nome}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span>{leadTelefone}</span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: connected ? "#34D399" : "#EF4444" }}
                  />
                  {connected ? "Conectado" : "Desconectado"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Label picker — only show when contato has a linked lead */}
            {leadId && (
              <div className="relative">
                <button
                  onClick={() => setShowLabelPicker(!showLabelPicker)}
                  className={`p-1.5 rounded-lg transition-colors ${showLabelPicker ? "text-amber-400 bg-amber-500/10" : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"}`}
                  title="Etiquetas"
                >
                  <Tag className="w-4 h-4" />
                </button>
              {showLabelPicker && allLabels && (
                <div className="absolute right-0 top-full mt-1 z-50 rounded-xl shadow-xl min-w-[180px] max-h-[280px] overflow-y-auto"
                  style={{ background: "rgba(30,30,40,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {/* Assigned labels with remove */}
                  {leadLabelsData && leadLabelsData.length > 0 && (
                    <div className="p-2 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-[10px] text-white/40 px-1 mb-1">Atribuídas</p>
                      <div className="flex flex-wrap gap-1">
                        {leadLabelsData.map(l => (
                          <span key={l.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: l.cor + "20", color: l.cor, border: `1px solid ${l.cor}30` }}>
                            {l.nome}
                            <button onClick={() => toggleLabelMutation.mutate({ labelId: l.id, action: "remove" })} className="hover:opacity-70">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* All labels to toggle */}
                  <div className="p-2">
                    <p className="text-[10px] text-white/40 px-1 mb-1">Todas</p>
                    {allLabels.map(label => {
                      const isAssigned = leadLabelsData?.some(l => l.id === label.id);
                      return (
                        <button key={label.id}
                          onClick={() => toggleLabelMutation.mutate({ labelId: label.id, action: isAssigned ? "remove" : "add" })}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-white/[0.06] transition-colors">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: label.cor }} />
                          <span className="flex-1 text-left text-white/70">{label.nome}</span>
                          {isAssigned && <Check className="w-3 h-3 text-emerald-400" />}
                        </button>
                      );
                    })}
                    {allLabels.length === 0 && <p className="text-[10px] text-white/30 px-1 py-1">Nenhuma etiqueta criada</p>}
                  </div>
                </div>
              )}
            </div>
          )}
          {!compact && (
            <button
              onClick={() => setShowLeadPanel(!showLeadPanel)}
              className={`text-xs flex items-center gap-1 transition-colors ${showLeadPanel ? "text-purple-400" : "text-white/40 hover:text-white"}`}
            >
              Ver lead <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
        </div>
        {/* Row 2: Injected header actions (pipeline stages, etc.) */}
        {headerActions && (
          <div className="overflow-x-auto scrollbar-none px-4 pb-2" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
            {headerActions}
          </div>
        )}
      </div>

      {/* Collapsible Quick Actions Bar — above messages */}
      {!compact && (
        <div className="shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <button
            onClick={() => setShowActions(!showActions)}
            className="w-full flex items-center justify-between px-3 py-1 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30">Ações</span>
              {!showActions && (
                <span
                  className="px-1.5 py-0 rounded text-[10px] font-medium"
                  style={{
                    background: `${pipelineStagesForChat.find(s => s.value === leadStatus)?.color || STATUS_COLORS_MAP[leadStatus] || "#e23752"}20`,
                    color: pipelineStagesForChat.find(s => s.value === leadStatus)?.color || STATUS_COLORS_MAP[leadStatus] || "#e23752",
                  }}
                >
                  {pipelineStagesForChat.find(s => s.value === leadStatus)?.label || leadStatus}
                </span>
              )}
            </div>
            {showActions ? <ChevronUp className="w-3 h-3 text-white/30" /> : <ChevronDown className="w-3 h-3 text-white/30" />}
          </button>
          {showActions && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-thin">
              {pipelineStagesForChat.map((stage) => (
                <button
                  key={stage.value}
                  onClick={() => {
                    if (leadStatus !== stage.value) moveStageMutation.mutate(stage.value);
                  }}
                  disabled={moveStageMutation.isPending}
                  className={`chat-quick-action ${leadStatus === stage.value ? "active" : ""}`}
                  style={leadStatus === stage.value ? { borderColor: stage.color + "40", color: stage.color } : {}}
                >
                  <ChevronRight className="w-3 h-3 inline mr-0.5" />
                  {stage.label}
                </button>
              ))}
              {/* "Nota", "Tarefa" e "MRR" saíram daqui.
                *
                * Eram três `<button>` com um `title` e nada mais: sem
                * `onClick`, sem mutation, sem capacidade no componente. Nunca
                * foram ligados, e ficavam ao lado dos botões de etapa, que
                * funcionam — o que fazia parecer que o grupo inteiro
                * funcionava.
                *
                * A capacidade não se perde: o §17.5 põe Task e Meeting no
                * CABEÇALHO da conversa, e o painel de contexto (§17.8) já
                * lista as tarefas abertas da pessoa. O lugar delas é lá,
                * ligado ao domínio, não aqui como chip decorativo. */}
            </div>
          )}
        </div>
      )}

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-thin"
        onClick={() => { setShowReactionPicker(null); setHoveredMsgId(null); }}
      >
        {reversedMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-white/20 text-sm">
            Nenhuma mensagem ainda
          </div>
        )}
        {reversedMessages.map((msg) => {
          const isOut = msg.direcao === "out";
          const isHovered = hoveredMsgId === msg.id;
          const replyMsg = findMessage(msg.replyToId);
          const isContactOrLocation = msg.tipo === "contact" || msg.tipo === "location";
          const shouldHideText = msg.tipo === "location" || (msg.tipo === "contact");

          return (
            <div
              key={msg.id}
              className={`flex ${isOut ? "justify-end" : "justify-start"} group relative`}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => { if (showReactionPicker !== msg.id) setHoveredMsgId(null); }}
              onDoubleClick={() => handleDoubleClick(msg)}
            >
              {/* Message actions toolbar */}
              {isHovered && !msg.id.startsWith("optimistic") && (
                <div
                  className={`absolute top-0 z-10 flex items-center gap-0.5 px-1 py-0.5 rounded-lg shadow-lg ${
                    isOut ? "right-2 -translate-y-full" : "left-2 -translate-y-full"
                  }`}
                  style={{ background: "rgba(30,30,40,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReply(msg); }}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/[0.08] rounded transition-colors"
                    title="Responder"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id); }}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/[0.08] rounded transition-colors"
                    title="Reagir"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  {msg.conteudo && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                      className="p-1.5 text-white/40 hover:text-white hover:bg-white/[0.08] rounded transition-colors"
                      title="Copiar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isOut && msg.uazapiMessageId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg); }}
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Apagar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Reaction quick picker */}
              {showReactionPicker === msg.id && (
                <div
                  className={`absolute z-20 flex items-center gap-1 px-2 py-1.5 rounded-full shadow-lg ${
                    isOut ? "right-2" : "left-2"
                  }`}
                  style={{ top: -48, background: "rgba(30,30,40,0.98)", border: "1px solid rgba(255,255,255,0.1)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {QUICK_REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(msg, emoji)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/[0.1] text-sm transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`chat-bubble ${isOut ? "chat-bubble-out" : "chat-bubble-in"}`}
              >
                {/* Reply quote */}
                {replyMsg && (
                  <div
                    className="mb-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border-l-2"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderColor: replyMsg.direcao === "out" ? "#e23752" : "#34D399",
                    }}
                  >
                    <span className="text-white/50 font-medium">
                      {replyMsg.direcao === "out" ? "Você" : leadNome}
                    </span>
                    <p className="text-white/30 truncate mt-0.5">
                      {replyMsg.tipo === "audio" ? "🎤 Áudio" :
                       replyMsg.tipo === "image" ? "📷 Imagem" :
                       replyMsg.tipo === "video" ? "🎥 Vídeo" :
                       replyMsg.tipo === "document" ? "📎 Documento" :
                       replyMsg.tipo === "location" ? "📍 Localização" :
                       replyMsg.tipo === "contact" ? "👤 Contato" :
                       replyMsg.conteudo || ""}
                    </p>
                  </div>
                )}
                {/* Media content */}
                <MediaContent msg={msg} onOpenLightbox={(url, tipo) => setLightbox({ url, tipo })} />
                {/* Text content */}
                {msg.conteudo && !shouldHideText && (
                  <p className="whitespace-pre-wrap"><Linkify>{msg.conteudo}</Linkify></p>
                )}
                {/* Type badge for audio/video without URL */}
                {!msg.mediaUrl && ["audio", "video", "sticker"].includes(msg.tipo) && (
                  <div className="flex items-center gap-1.5 text-xs text-white/40 py-1">
                    {msg.tipo === "audio" && <><Mic className="w-3.5 h-3.5" /> Áudio</>}
                    {msg.tipo === "video" && <><Film className="w-3.5 h-3.5" /> Vídeo</>}
                    {msg.tipo === "sticker" && "Sticker"}
                  </div>
                )}
                {/* Time + status + AI badge */}
                <div className={`chat-bubble-time ${isOut ? "justify-end" : "justify-start"}`}>
                  {msg.dados?.aiGenerated && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-[#e23752]/70 font-medium">
                      <Bot className="w-3 h-3" />
                      AI
                    </span>
                  )}
                  <span>{formatTime(msg.createdAt)}</span>
                  {isOut && <StatusIcon status={msg.status} />}
                </div>
              </div>
              {/* Reactions */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div className={`flex gap-1 mt-[-4px] ${isOut ? "justify-end mr-1" : "justify-start ml-1"}`}>
                  {msg.reactions.map((r, i) => (
                    <span
                      key={i}
                      className="text-sm px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {r.emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions Bar was moved above messages */}

      {/* Template picker dropdown */}
      {showTemplates && templates && templates.length > 0 && (
        <div
          className="mx-3 mb-2 rounded-xl overflow-hidden max-h-48 overflow-y-auto"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {(templates as { id: string; nome: string; categoria: string; conteudo: string }[]).map(
            (tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleTemplateSelect(tpl)}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition-colors"
              >
                <div className="text-xs text-white/40 mb-0.5">{tpl.categoria}</div>
                <div className="text-sm text-white/80 line-clamp-2">{tpl.conteudo}</div>
              </button>
            )
          )}
        </div>
      )}

      {/* Location picker */}
      {showLocationPicker && (
        <div
          className="mx-3 mb-2 flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <MapPin className="w-5 h-5 text-red-400 shrink-0" />
          {locationLoading ? (
            <div className="flex-1 text-xs text-white/50">Obtendo localização...</div>
          ) : locationCoords ? (
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80">Sua localização</p>
              <p className="text-[10px] text-white/40">{locationCoords.lat.toFixed(6)}, {locationCoords.lng.toFixed(6)}</p>
            </div>
          ) : null}
          {locationCoords && (
            <button
              onClick={sendLocationMsg}
              className="px-3 py-1.5 rounded-lg text-xs text-white font-medium"
              style={{ background: "linear-gradient(135deg, #10B981, #34D399)" }}
            >
              Enviar
            </button>
          )}
          <button
            onClick={() => { setShowLocationPicker(false); setLocationCoords(null); }}
            className="p-1 text-white/40 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachPreview && (
        <div
          className="mx-3 mb-2 flex items-center gap-3 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {attachPreview.type === "image" && attachPreview.previewUrl ? (
            <img src={attachPreview.previewUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              {attachPreview.type === "video" && <Film className="w-5 h-5 text-purple-400" />}
              {attachPreview.type === "audio" && <Mic className="w-5 h-5 text-emerald-400" />}
              {attachPreview.type === "document" && <FileText className="w-5 h-5 text-blue-400" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/80 truncate">{attachPreview.file.name}</p>
            <p className="text-[10px] text-white/40">
              {(attachPreview.file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            onClick={() => { setAttachPreview(null); if (attachPreview.previewUrl) URL.revokeObjectURL(attachPreview.previewUrl); }}
            className="p-1 text-white/40 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment menu — uses <label htmlFor> for reliable file picker */}
      {showAttachMenu && (
        <div
          className="mx-3 mb-2 rounded-xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="grid grid-cols-4 gap-1 p-3">
            <label
              htmlFor="chat-file-input"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(168,85,247,0.15)" }}>
                <Camera className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-[10px] text-white/50">Foto/Vídeo</span>
            </label>
            <label
              htmlFor="chat-file-input"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)" }}>
                <File className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-[10px] text-white/50">Documento</span>
            </label>
            <button
              onClick={handleLocationShare}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
                <MapPin className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-[10px] text-white/50">Localização</span>
            </button>
            <button
              onClick={handleContactShare}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                <User className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-white/50">Contato</span>
            </button>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div
          className="mx-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: "3px solid #e23752" }}
        >
          <Reply className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-purple-400 font-medium">
              {replyTo.direcao === "out" ? "Você" : leadNome}
            </p>
            <p className="text-xs text-white/40 truncate">
              {replyTo.tipo === "audio" ? "🎤 Áudio" :
               replyTo.tipo === "image" ? "📷 Imagem" :
               replyTo.tipo === "video" ? "🎥 Vídeo" :
               replyTo.tipo === "document" ? "📎 Documento" :
               replyTo.tipo === "location" ? "📍 Localização" :
               replyTo.conteudo || ""}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 text-white/30 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden file input — uses id for <label htmlFor> (more reliable than ref.click()) */}
      <input
        id="chat-file-input"
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
        onChange={handleFileSelect}
      />

      {/* Input area */}
      {readOnly ? (
        <div className="chat-input-area shrink-0 flex items-center justify-center py-3">
          <span className="text-xs text-white/30">Modo leitura — apenas visualizacao</span>
        </div>
      ) : (
      <div className="chat-input-area shrink-0">
        {/* Recording UI */}
        {isRecording ? (
          <div className="flex items-center gap-3 py-1">
            <button
              onClick={() => stopRecording(false)}
              className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Cancelar gravação"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-400 font-mono tabular-nums">{formatRecordingTime(recordingTime)}</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full bg-red-400/60 transition-all duration-1000"
                  style={{ width: `${Math.min((recordingTime / 120) * 100, 100)}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => stopRecording(true)}
              className="p-2.5 rounded-lg transition-all"
              style={{ background: "linear-gradient(135deg, #10B981, #34D399)" }}
              title="Enviar áudio"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            {/* Emoji button + picker */}
            <div className="relative">
              <button
                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowTemplates(false); setShowAttachMenu(false); }}
                className={`p-2 rounded-lg transition-colors ${
                  showEmojiPicker ? "text-amber-400 bg-amber-500/10" : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
                title="Emojis"
              >
                <Smile className="w-5 h-5" />
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={(emoji) => { handleEmojiInsert(emoji); }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
            {/* Attach button */}
            <button
              onClick={() => { setShowAttachMenu(!showAttachMenu); setShowTemplates(false); setShowEmojiPicker(false); }}
              className={`p-2 rounded-lg transition-all duration-200 ${
                showAttachMenu
                  ? "text-emerald-400 bg-emerald-500/10 rotate-45"
                  : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              title="Anexar"
            >
              <Plus className="w-5 h-5" />
            </button>
            {/* Templates button */}
            <button
              onClick={() => { setShowTemplates(!showTemplates); setShowAttachMenu(false); setShowEmojiPicker(false); }}
              className={`p-2 rounded-lg transition-colors ${
                showTemplates ? "text-purple-400 bg-purple-500/10" : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
              }`}
              title="Templates"
            >
              <FileText className="w-5 h-5" />
            </button>
            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  !connected ? "WhatsApp desconectado"
                  : attachPreview ? "Adicione uma legenda..."
                  : "Digite uma mensagem..."
                }
                disabled={!connected}
                rows={1}
                className="w-full resize-none bg-transparent border-none outline-none text-sm text-white/90 placeholder:text-white/25 py-2 max-h-[120px]"
                style={{ lineHeight: "1.5" }}
              />
            </div>
            {/* Send or Mic button */}
            {text.trim() || attachPreview ? (
              <button
                onClick={handleSend}
                disabled={sendMutation.isPending || !connected}
                className="p-2 rounded-lg transition-all disabled:opacity-30"
                style={{ background: "linear-gradient(135deg, #e23752, #e23752)" }}
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={!connected}
                className="p-2 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-30"
                title="Gravar áudio"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <a
            href={lightbox.url}
            download
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-16 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Download"
          >
            <Download className="w-6 h-6" />
          </a>
          <div onClick={(e) => e.stopPropagation()} className="max-w-[90vw] max-h-[90vh]">
            {lightbox.tipo === "image" ? (
              <img
                src={lightbox.url}
                alt=""
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={lightbox.url}
                className="max-w-[90vw] max-h-[90vh] rounded-lg"
                controls
                autoPlay
              />
            )}
          </div>
        </div>
      )}
    </div>

    {/* Lead Sidebar Drawer */}
    {showLeadPanel && !compact && (
      <div
        className="w-[340px] shrink-0 flex flex-col overflow-y-auto"
        style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-semibold text-white">Resumo do Lead</span>
          <button onClick={() => setShowLeadPanel(false)} className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/[0.06]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {leadDetail?.lead ? (
          <div className="px-4 py-3 space-y-4">
            {/* Name + tipo badge */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{leadDetail.lead.nome}</h3>
                {leadDetail.lead.tipo && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: `${STATUS_COLORS_MAP[leadDetail.lead.tipo] || "#e23752"}20`, color: STATUS_COLORS_MAP[leadDetail.lead.tipo] || "#e23752" }}>
                    {leadDetail.lead.tipo.toUpperCase()}
                  </span>
                )}
              </div>
              {leadDetail.lead.empresa && (
                <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" />{leadDetail.lead.empresa}</p>
              )}
            </div>

            {/* Contact info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <PhoneIcon className="w-3 h-3 text-white/30" /> {leadDetail.lead.telefone}
              </div>
              {leadDetail.lead.email && (
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Mail className="w-3 h-3 text-white/30" /> {leadDetail.lead.email}
                </div>
              )}
              {leadDetail.lead.cargo && (
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Briefcase className="w-3 h-3 text-white/30" /> {leadDetail.lead.cargo}
                </div>
              )}
            </div>

            {/* Lead Score */}
            {leadDetail.lead.leadScore != null && (
              <div>
                <p className="text-[10px] text-white/30 mb-1">Lead Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(leadDetail.lead.leadScore, 100)}%`,
                      background: leadDetail.lead.leadScore >= 70 ? "#10B981" : leadDetail.lead.leadScore >= 40 ? "#F59E0B" : "#EF4444",
                    }} />
                  </div>
                  <span className="text-xs font-bold text-white">{leadDetail.lead.leadScore}</span>
                </div>
              </div>
            )}

            {/* Labels */}
            {leadLabelsData && leadLabelsData.length > 0 && (
              <div>
                <p className="text-[10px] text-white/30 mb-1">Etiquetas</p>
                <div className="flex flex-wrap gap-1">
                  {leadLabelsData.map(l => (
                    <span key={l.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: l.cor + "20", color: l.cor }}>
                      {l.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Negocios */}
            {leadDetail.negocios && leadDetail.negocios.length > 0 && (
              <div>
                <p className="text-[10px] text-white/30 mb-1">Negócios</p>
                <div className="space-y-1.5">
                  {leadDetail.negocios.map((n: { id: string; titulo: string; status: string; mrrEstimado?: string; valorProjeto?: string }) => (
                    <a key={n.id} href={`/negocios/${n.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="min-w-0">
                        <p className="text-xs text-white truncate">{n.titulo}</p>
                        <span className="px-1.5 py-0 rounded text-[9px] font-medium"
                          style={{ background: `${STATUS_COLORS_MAP[n.status] || "#e23752"}20`, color: STATUS_COLORS_MAP[n.status] || "#e23752" }}>
                          {n.status}
                        </span>
                      </div>
                      {(n.mrrEstimado || n.valorProjeto) && (
                        <span className="text-[10px] text-emerald-400 shrink-0 ml-2">
                          R$ {n.mrrEstimado || n.valorProjeto}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Recent activities */}
            {leadDetail.atividades && leadDetail.atividades.length > 0 && (
              <div>
                <p className="text-[10px] text-white/30 mb-1">Atividades recentes</p>
                <div className="space-y-1">
                  {leadDetail.atividades.slice(0, 5).map((a: { id: string; tipo: string; titulo?: string; descricao?: string; createdAt: string }) => (
                    <div key={a.id} className="flex items-start gap-2 p-1.5 rounded text-xs">
                      <span className="px-1 py-0 rounded text-[9px] bg-white/[0.06] text-white/40 shrink-0">{a.tipo}</span>
                      <span className="text-white/50 truncate">{a.titulo || a.descricao || "—"}</span>
                      <span className="text-[10px] text-white/20 shrink-0 ml-auto">
                        {new Date(a.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open full page link */}
            <a href={`/contatos/${leadId}`}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              Abrir página completa <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/20 text-xs">Carregando...</div>
        )}
      </div>
    )}

    </div>
  );
}
