"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Phone, MessageCircle, Mail, Plus, Calendar, ChevronDown, Send, Briefcase,
  X, AlertTriangle, ClipboardCheck,
} from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import { LigacoesSection } from "@/components/crm/LigacoesSection";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";
import { digitsForDialer } from "@/lib/utils/callface-call";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { SDR_STAGES } from "@/lib/crm/pipeline";
import { stageAge, resolveDisplayStage, resolveContextoCliente, type Lead as KanbanLead } from "./shared";
import type { OrgUsuario } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";

interface Negocio { id: string; titulo: string; status: string; createdAt: string }
interface Atividade { id: string; tipo: string; titulo?: string | null; descricao?: string | null; createdAt: string; usuarioNome?: string | null }
interface Nota { id: string; conteudo: string; autorNome?: string | null; createdAt: string }
interface Tarefa { id: string; titulo: string; prioridade: string; dataVencimento?: string | null; concluida: boolean }
interface LigacaoResumo { id: string; createdAt: string; callDate?: string | null; callStatus?: string | null }

interface LeadDetail extends KanbanLead {
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  empresaId?: string | null;
  empresaCnpj?: string | null;
  cargo?: string | null;
  utmCampaign?: string | null;
  camposCustom?: Record<string, unknown> | null;
  createdAt: string;
}

const TABS = ["Tudo", "Ligações", "WhatsApp", "E-mails", "Notas", "Tarefas"] as const;
type Tab = (typeof TABS)[number];

function initials(nome?: string | null): string {
  const parts = (nome || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function timeAgoShort(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

/** Data/hora absoluta (24/08, pedido do Kauã: a Timeline só mostrava
 * "Xd atrás", sem data/hora real) — sempre junto do relativo, nunca no lugar. */
function formatDataHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** "há 2h" / "ontem 15:32" / "12 ago" — formato da seção compacta
 * "Atendimento Recente" (Figma 230:8825, 23/08); a Timeline unificada
 * completa (mais abaixo) continua usando `timeAgoShort`, sem mudar. */
function formatQuando(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const mesmodia = d.toDateString() === now.toDateString();
  const ontemRef = new Date(now); ontemRef.setDate(now.getDate() - 1);
  const ontem = d.toDateString() === ontemRef.toDateString();
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (mesmodia) {
    const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
    return mins < 60 ? `há ${Math.max(mins, 0)}min` : `há ${Math.floor(mins / 60)}h`;
  }
  if (ontem) return `ontem ${hhmm}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ${hhmm}`;
}

function callStatusInfo(status?: string | null): { label: string; color: string } {
  const s = String(status || "").toUpperCase();
  if (["FINISHED", "ANSWERED", "COMPLETED"].includes(s)) return { label: "Ligação atendida", color: "#4ade80" };
  if (["MISSED", "NOT_ANSWERED", "NO_ANSWER"].includes(s)) return { label: "Ligação não atendida", color: "#f59e0b" };
  if (["NOT_COMPLETED", "FAILED", "BUSY"].includes(s)) return { label: "Ligação não completada", color: "#f87171" };
  return { label: "Ligação registrada", color: "var(--cf2-chrome-text-secondary)" };
}

interface Tokens {
  bg: string; bgAlt: string; surface: string; surfaceAlt: string; border: string;
  textPrimary: string; textSecondary: string; success: string; warningBg: string; warningText: string; danger: string;
}

const TIPO_LABEL: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", nota: "Nota", reuniao: "Reunião", proposta_enviada: "Proposta" };
const TIPO_DOT: Record<string, string> = { whatsapp: "#4ade80", email: "var(--cf2-chrome-text-secondary)", nota: "var(--cf2-chrome-text-secondary)", reuniao: "#8e27ef", proposta_enviada: "#22C55E" };
const EMPTY_USUARIOS = new Map<string, OrgUsuario>();

/**
 * Drawer novo de lead (Figma node 230:8825, reskin dark 23/08) — substitui o
 * LeadDrawer legado (dark, `(crm)`) SÓ no board de Pré-vendas do CRM2.
 * Reaproveita 100% da lógica real que já existia: fetch `/api/leads/:id`
 * (mesma query key `["lead", leadId]` do drawer legado, cache compartilhado),
 * `/api/notas`, `/api/ligacoes` (mesma fonte real da LigacoesSection),
 * `QualificacaoSdrSection` (campos CNPJ/Cargo/Necessidade-Dor/Tomador de
 * decisão) e `TarefaFormModal`. Mover etapa/Qualificar/Desqualificar chamam
 * `onMove`, a MESMA função (`handleMove`) que os cards do Kanban já usam —
 * nenhuma regra de negócio nova. "Ligar"/"WhatsApp"/"E-mail" navegam pra
 * `/atendimento?leadId=X&canal=...` (mesmo deep link que o Negócio já usa),
 * com `telefone` extra pra pré-preencher o discador na aba Ligar.
 */
export function Cf2LeadDrawer({
  leadId, open, onClose, onOpenEmpresa, onOpenNegocio, onMove, usuariosById = EMPTY_USUARIOS, dark = false,
}: {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenEmpresa?: (id: string) => void;
  onOpenNegocio?: (id: string) => void;
  /** Footer (mover etapa/desqualificar/qualificar) só aparece quando isso é
   * passado — fora do Kanban (ex: diretório de Contatos & Empresas) não
   * existe um `handleMove` de board pra chamar, então o footer some em vez
   * de fingir uma ação que não faz nada. */
  onMove?: (id: string, status: string) => void;
  usuariosById?: Map<string, OrgUsuario>;
  /** Reskin dark (23/08, Figma node 230:8825) — só o board de Pré-vendas
   * (`qualificacao/Workspace.tsx`) passa `dark`. Contatos & Empresas,
   * Prospecção e a Página Completa do lead continuam no tema claro
   * original (default `false`) — mesmo drawer, zero regressão visual nas
   * outras 3 telas que já usam este componente. */
  dark?: boolean;
}) {
  const T: Tokens = dark
    ? {
        bg: "var(--cf2-chrome-bg-alt)", bgAlt: "var(--cf2-chrome-bg-alt)", surface: "var(--cf2-chrome-surface-active)", surfaceAlt: "var(--cf2-chrome-bg)",
        border: "var(--cf2-chrome-border-subtle)", textPrimary: "var(--cf2-chrome-text-primary)", textSecondary: "var(--cf2-chrome-text-secondary)",
        success: "#4ade80", warningBg: "rgba(245,158,11,0.12)", warningText: "#f3b75f", danger: "#f87171",
      }
    : {
        bg: "#ffffff", bgAlt: "#ffffff", surface: "var(--cf2-bg-canvas)", surfaceAlt: "var(--cf2-bg-surface)",
        border: "var(--cf2-border-default)", textPrimary: "var(--cf2-text-primary)", textSecondary: "var(--cf2-text-tertiary)",
        success: "var(--cf2-success-text)", warningBg: "var(--cf2-warning-bg)", warningText: "var(--cf2-warning-text)", danger: "var(--cf2-danger-text)",
      };
  const qc = useQueryClient();
  const { origens } = usePipelineConfig();
  const [tab, setTab] = useState<Tab>("Tudo");
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [qualProgress, setQualProgress] = useState({ count: 0, total: 4, tomadorDecisao: "" });

  const { data: detail, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}`);
      if (!r.ok) throw new Error("Lead não encontrado");
      return r.json() as Promise<{
        lead: LeadDetail;
        empresa: { cnpj?: string | null } | null;
        negocios: Negocio[];
        atividades: Atividade[];
        tarefas: Tarefa[];
        contratos?: { status: string }[];
      }>;
    },
    enabled: !!leadId && open,
  });

  const { data: notas = [] } = useQuery<Nota[]>({
    queryKey: ["notas", "lead", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/notas?leadId=${leadId}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!leadId && open,
  });

  // Mesma fonte real da LigacoesSection (`/api/ligacoes`) — só usada aqui pra
  // alimentar o preview compacto "Atendimento Recente" com o status REAL da
  // ligação (atendida/não atendida), sem fabricar esse sinal a partir de
  // `atividades` (que não guarda call_status).
  const { data: ligacoes = [] } = useQuery<LigacaoResumo[]>({
    queryKey: ["ligacoes-resumo", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/ligacoes?leadId=${leadId}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!leadId && open,
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", leadId] }),
  });

  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const r = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, leadId }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notas", "lead", leadId] });
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["pre-vendas-leads"] });
      setNoteText("");
      setNoteOpen(false);
    },
    onError: () => toast.error("Não foi possível salvar a nota"),
  });

  useEffect(() => { if (noteOpen) noteRef.current?.focus(); }, [noteOpen]);

  const lead = detail?.lead;
  const atividades = detail?.atividades || [];
  const tarefasAbertas = (detail?.tarefas || []).filter((t) => !t.concluida);
  const proximaTarefa = [...tarefasAbertas].filter((t) => t.dataVencimento).sort((a, b) => new Date(a.dataVencimento!).getTime() - new Date(b.dataVencimento!).getTime())[0];

  if (!lead && !isLoading) return null;

  const fullName = lead ? `${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}` : "";
  const owner = lead?.responsavelId ? usuariosById.get(lead.responsavelId) : undefined;
  const stage = lead ? resolveDisplayStage(lead) : { label: "", color: "#6B7280" };
  const age = lead ? stageAge(lead.updatedAt, lead.sdrStatus || "pending") : null;
  const contextoCliente = lead ? resolveContextoCliente(lead, detail?.contratos) : null;
  const origemLabel = lead?.origem ? origens.find((o) => o.key === lead.origem)?.label || lead.origem : "—";
  const isOportunidade = !!lead?.negocioCount && lead.negocioCount > 0;

  const feed = [
    ...atividades.filter((a) => a.tipo !== "ligacao").map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo || TIPO_LABEL[a.tipo] || a.tipo, sub: a.descricao || undefined, createdAt: a.createdAt, usuarioNome: a.usuarioNome })),
    ...notas.map((n) => ({ id: `nota-${n.id}`, tipo: "nota", titulo: n.conteudo, sub: undefined, createdAt: n.createdAt, usuarioNome: n.autorNome })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const feedFiltrado = tab === "Tudo" ? feed
    : tab === "WhatsApp" ? feed.filter((e) => e.tipo === "whatsapp")
    : tab === "E-mails" ? feed.filter((e) => e.tipo === "email")
    : tab === "Notas" ? feed.filter((e) => e.tipo === "nota")
    : [];

  // Preview "Atendimento Recente" (Figma) — merge de feed (whatsapp/email/
  // reunião/nota) + ligações reais, só os 3 mais recentes.
  const atendimentoRecente = [
    ...feed.map((e) => ({ id: e.id, createdAt: e.createdAt, label: e.titulo, color: TIPO_DOT[e.tipo] || T.textSecondary })),
    ...ligacoes.map((l) => { const info = callStatusInfo(l.callStatus); return { id: l.id, createdAt: l.callDate || l.createdAt, label: info.label, color: info.color }; }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);

  const telefoneDialer = lead?.telefone ? digitsForDialer(lead.telefone) : "";
  const atendimentoHref = (canal: "whatsapp" | "email" | "ligacao") => {
    const params = new URLSearchParams({ leadId: leadId || "", canal });
    // Telefone vai em qualquer canal (não só ligação) — é o que a tela de
    // Atendimento usa pra achar a conversa certa quando `contatos.leadId`
    // não está preenchido no banco (achado real 24/08).
    if (telefoneDialer) params.set("telefone", telefoneDialer);
    return `/atendimento?${params.toString()}`;
  };

  // Atribuição de origem — mesmos campos reais usados em clientes-crm2.ts
  // (origemAquisicao): "criativo" é utm_content (nome legível) quando existe,
  // senão o ID real do anúncio da Meta; nunca um nome inventado.
  const criativo = lead?.utmContent || lead?.metaAdId || null;
  const utmQuery = lead ? [
    lead.utmSource ? `utm_source=${lead.utmSource}` : null,
    lead.utmMedium ? `utm_medium=${lead.utmMedium}` : null,
    lead.utmCampaign ? `utm_campaign=${lead.utmCampaign}` : null,
  ].filter(Boolean).join("&") : "";

  const footer = lead && onMove && (
    <div className="p-3 flex flex-col gap-2" style={{ background: T.surfaceAlt, borderTop: `1px solid ${T.border}` }}>
      {isOportunidade ? (
        lead.negocioPrincipal && onOpenNegocio && (
          <button onClick={() => onOpenNegocio(lead.negocioPrincipal!.id)} className="flex items-center justify-center gap-2 h-11 rounded-xl text-[13px] font-bold" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textPrimary }}>
            <Briefcase className="w-4 h-4" style={{ color: T.success }} /> Abrir oportunidade
          </button>
        )
      ) : (
        <>
          <button onClick={() => onMove(leadId!, "qualified")} className="flex items-center justify-center gap-2 h-11 rounded-xl text-[13px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
            <Calendar className="w-4 h-4" /> Agendar reunião
          </button>
          <div className="relative">
            <button onClick={() => setMoveMenuOpen((v) => !v)} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-semibold" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>
              Qualificar <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {moveMenuOpen && (
              <div className="absolute bottom-11 left-0 right-0 rounded-xl py-1 z-10" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 8px 16px rgba(0,0,0,0.35)" }}>
                <div className="px-3 py-1 text-[9px] uppercase tracking-wide" style={{ color: T.textSecondary }}>Mover etapa</div>
                {SDR_STAGES.filter((s) => s.key !== (lead.sdrStatus || "pending")).map((s) => (
                  <button key={s.key} onClick={() => { onMove(leadId!, s.key); setMoveMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2" style={{ color: T.textPrimary }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
                  </button>
                ))}
                <div className="my-1 h-px" style={{ background: T.border }} />
                <button onClick={() => { onMove(leadId!, "disqualified"); setMoveMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-[13px] font-bold" style={{ color: T.danger }}>Desqualificar</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
    <DetailDrawer open={open && !!leadId} onClose={onClose} bare panelBg={T.bgAlt} borderColor={T.border} width="w-full sm:w-[500px]" footer={footer}>
      {isLoading && <div className="p-6 text-sm" style={{ color: T.textSecondary }}>Carregando...</div>}
      {lead && (
        <div className="flex flex-col gap-4 p-5">
          {/* header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <p className="text-[18px] font-bold" style={{ color: T.textPrimary, fontFamily: "var(--cf2-font-heading)" }}>{fullName}</p>
                  {typeof lead.leadScore === "number" && lead.leadScore > 0 && (
                    <span className="flex items-center justify-center rounded-full text-[12px] font-extrabold shrink-0" style={{ width: 26, height: 26, background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{lead.leadScore}</span>
                  )}
                  {/* Contexto atual (cliente/oportunidade) é sempre o badge PRIMÁRIO —
                      correção 19/08: o estágio de SDR é processo histórico, nunca a
                      identidade atual da pessoa. */}
                  {contextoCliente ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide" style={{ background: contextoCliente.bg, color: contextoCliente.color }}>{contextoCliente.label}</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide" style={{ background: `${stage.color}22`, color: stage.color }}>{stage.label}</span>
                  )}
                </div>
                <p className="text-[13px]" style={{ color: T.textSecondary }}>{[lead.empresa, lead.cargo].filter(Boolean).join(" · ") || "—"}</p>
                {contextoCliente && <span className="text-[11px]" style={{ color: T.textSecondary }}>Lead histórico: {stage.label}</span>}
                {age && !contextoCliente && <span className="text-[11px]" style={{ color: T.textSecondary }}>Tempo na etapa: {age.text}{age.breached ? " · SLA vencido" : ""}</span>}
              </div>
              <button onClick={onClose} className="p-1 rounded shrink-0" style={{ color: T.textSecondary }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0" style={{ width: 26, height: 26, background: T.surface, color: T.textPrimary }}>{initials(owner?.nome)}</span>
                {/* Responsável trocável direto aqui (24/08, pedido do Kauã:
                    "às vezes muda") — única superfície editável no drawer,
                    a linha duplicada que só mostrava texto foi removida. */}
                <AssignOwnerControl
                  entityType="lead"
                  entityId={leadId!}
                  currentOwnerId={lead.responsavelId}
                  usuarios={Array.from(usuariosById.values())}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["lead", leadId] })}
                />
              </div>
              <a href={`/contatos/${leadId}`} className="text-[12px] font-semibold" style={{ color: T.success }}>Abrir página completa →</a>
            </div>
          </div>

          {/* ações rápidas — Ligar/WhatsApp/E-mail navegam pro Atendimento
              (mesmo deep link `?leadId=X` que o Negócio já usa), sem inventar
              um fluxo de discagem paralelo. */}
          <div className="flex gap-2">
            <QuickPill icon={Phone} label="Ligar" href={lead.telefone ? atendimentoHref("ligacao") : undefined}  T={T} />
            <QuickPill icon={MessageCircle} label="WhatsApp" href={lead.telefone || lead.whatsapp ? atendimentoHref("whatsapp") : undefined}  T={T} />
            <QuickPill icon={Mail} label="E-mail" href={lead.email ? atendimentoHref("email") : undefined}  T={T} />
          </div>

          {/* próxima ação + responsável SDR */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-4 h-4 shrink-0" style={{ color: T.textSecondary }} />
              {proximaTarefa ? (
                <p className="text-[12px] truncate" style={{ color: T.textPrimary }}>
                  <span style={{ color: T.textSecondary }}>Próxima ação: </span>
                  {proximaTarefa.titulo} · {new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </p>
              ) : (
                <p className="text-[12px]" style={{ color: T.textSecondary }}>Sem próxima ação agendada</p>
              )}
            </div>
            <button onClick={() => setTarefaModalOpen(true)} title="Agendar próxima ação" className="p-1 rounded shrink-0" style={{ color: T.success }}>
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* resumo do lead */}
          <Section title="Resumo do lead" T={T} defaultOpen>
            <div className="flex flex-col gap-2.5 text-[12px]">
              <KV label="Telefone" value={lead.telefone || "—"}  T={T} />
              <KV label="E-mail" value={lead.email || "—"}  T={T} />
              <KV label="Empresa" value={lead.empresa || "—"} onClick={lead.empresaId ? () => onOpenEmpresa?.(lead.empresaId!) : undefined} T={T} />
              <KV label="Cargo" value={lead.cargo || "—"}  T={T} />
              <KV label="Data de entrada" value={new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}  T={T} />
            </div>
          </Section>

          {/* QUALIFICAÇÃO (SDR) — Critérios atingidos X/4 + barra + checklist */}
          <Section
            title="Qualificação (SDR)"
            T={T}
            defaultOpen
            icon={<ClipboardCheck className="w-3.5 h-3.5" style={{ color: "var(--cf2-accent-border)" }} />}
            right={<span className="text-[12px] font-semibold" style={{ color: T.textSecondary }}>{qualProgress.count}/{qualProgress.total}</span>}
          >
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(qualProgress.count / qualProgress.total) * 100}%`, background: T.success }} />
            </div>
            {leadId && (
              <QualificacaoSdrSection
                leadId={leadId}
                camposCustom={lead.camposCustom}
                // Bug real 25/08 (achado do Kauã: "no de pessoas tudo
                // bugado" — campos de Qualificação SDR invisíveis, texto
                // branco em fundo branco): este componente vem em 2
                // temas (`variant="dark"|"light"`), mas aqui estava
                // fixo em "dark" mesmo quando o próprio drawer (prop
                // `dark`, default false) está renderizando claro nas
                // outras 3 telas que o usam (Contatos & Empresas,
                // Prospecção, Página Completa) — só Pré-vendas é
                // realmente escuro. Precisa acompanhar a MESMA prop.
                variant={dark ? "dark" : "light"}
                hideHeader
                showFieldStatusDots
                queryKeysToInvalidate={["pre-vendas-leads"]}
                prefill={{ cnpj: detail?.empresa?.cnpj || lead.empresaCnpj || "", cargo: lead.cargo || "" }}
                onProgressChange={setQualProgress}
              />
            )}
            {(qualProgress.tomadorDecisao === "" || qualProgress.tomadorDecisao === "nao_identificado") && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: T.warningBg }}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#f59e0b" }} />
                <p className="text-[11px]" style={{ color: T.warningText }}>Tomador de decisão: Não identificado</p>
              </div>
            )}
          </Section>

          {/* ATRIBUIÇÃO DE ORIGEM */}
          <Section title="Atribuição de Origem" T={T}>
            <div className="flex flex-col gap-2 text-[12px]">
              <KV label="Fonte" value={origemLabel}  T={T} />
              <KV label="Campanha" value={lead.utmCampaign || "—"}  T={T} />
              <KV label="Criativo" value={criativo || "—"}  T={T} />
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: T.textSecondary }}>UTM</span>
                <span className="font-semibold truncate max-w-[220px]" title={utmQuery || undefined} style={{ color: T.textPrimary }}>{utmQuery || "—"}</span>
              </div>
            </div>
            {lead.empresaId ? (
              <button onClick={() => onOpenEmpresa?.(lead.empresaId!)} className="text-[12px] font-semibold text-left" style={{ color: T.success }}>Ver detalhes da origem →</button>
            ) : (
              <span className="text-[11px]" style={{ color: T.textSecondary }}>Sem empresa vinculada pra detalhar a origem.</span>
            )}
          </Section>

          {/* ATENDIMENTO RECENTE — preview compacto (3 últimos, mistura real
              de whatsapp/e-mail/ligação com status real); histórico completo
              com filtros continua na Timeline unificada, mais abaixo. */}
          <div className="flex flex-col gap-2.5 p-4 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: T.textSecondary }}>Atendimento Recente</p>
            {atendimentoRecente.length === 0 ? (
              <p className="text-[12px]" style={{ color: T.textSecondary }}>Nenhum atendimento registrado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {atendimentoRecente.map((item) => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <p className="flex-1 text-[12px] truncate" style={{ color: T.textPrimary }}>{item.label}</p>
                    <span className="text-[11px] shrink-0" style={{ color: T.textSecondary }}>{formatQuando(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* negócios vinculados */}
          {detail && detail.negocios.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: T.textSecondary }}>Negócios ({detail.negocios.length})</p>
              {detail.negocios.slice(0, 5).map((n) => (
                <button key={n.id} onClick={() => onOpenNegocio?.(n.id)} disabled={!onOpenNegocio} className="text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2" style={{ border: `1px solid ${T.border}` }}>
                  <span className="text-[13px] truncate" style={{ color: T.textPrimary }}>{n.titulo}</span>
                  <span className="text-[11px] shrink-0" style={{ color: T.textSecondary }}>{n.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* timeline unificada (histórico completo, com filtro por canal) */}
          <Section title="Timeline unificada" T={T}>
            <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0" style={{ background: tab === t ? "var(--cf2-accent)" : T.bgAlt, color: tab === t ? "var(--cf2-text-on-accent)" : T.textSecondary, border: tab === t ? "none" : `1px solid ${T.border}` }}>
                  {t}
                </button>
              ))}
            </div>

            {tab === "Ligações" ? (
              leadId && <LigacoesSection leadId={leadId} enviarDiscagem />
            ) : tab === "Tarefas" ? (
              tarefasAbertas.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {tarefasAbertas.map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: T.bgAlt, border: `1px solid ${T.border}` }}>
                      <button onClick={() => toggleTarefa.mutate({ id: t.id, concluida: true })} className="w-4 h-4 rounded-full shrink-0" style={{ border: `1px solid ${T.border}` }} />
                      <p className="flex-1 text-[13px]" style={{ color: T.textPrimary }}>{t.titulo}</p>
                      {t.dataVencimento && <span className="text-[11px] shrink-0" style={{ color: T.textSecondary }}>{new Date(t.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: T.textSecondary }}>Nenhuma tarefa em aberto.</p>
              )
            ) : (
              <div className="flex flex-col gap-2">
                {feedFiltrado.length === 0 && <p className="text-[12px]" style={{ color: T.textSecondary }}>Nada por aqui ainda.</p>}
                {feedFiltrado.map((e) => (
                  <div key={e.id} className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: T.bgAlt, border: `1px solid ${T.border}` }}>
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0" style={{ width: 26, height: 26, background: T.surfaceAlt, color: T.textPrimary }}>{initials(e.usuarioNome)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold" style={{ color: T.textPrimary }}>{timeAgoShort(e.createdAt)} atrás <span className="font-normal" style={{ color: T.textSecondary }}>· {formatDataHora(e.createdAt)}</span></p>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[11px] font-bold shrink-0" style={{ background: T.surfaceAlt, color: T.textSecondary }}>{TIPO_LABEL[e.tipo] || e.tipo}</span>
                    </div>
                    <p className="text-[13px]" style={{ color: T.textPrimary }}>{e.usuarioNome ? `${e.usuarioNome} — ` : ""}{e.titulo}</p>
                  </div>
                ))}
                {tab === "Notas" && (
                  <div className="pt-1">
                    {noteOpen ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea ref={noteRef} value={noteText} onChange={(ev) => setNoteText(ev.target.value)} placeholder="Escreva uma nota..." rows={3}
                          className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y" style={{ background: T.bgAlt, border: `1px solid ${T.border}`, color: T.textPrimary }}
                          onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && noteText.trim()) addNota.mutate(noteText.trim()); if (ev.key === "Escape") { setNoteOpen(false); setNoteText(""); } }} />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setNoteOpen(false); setNoteText(""); }} className="text-[12px] px-2 py-1" style={{ color: T.textSecondary }}>Cancelar</button>
                          <button onClick={() => noteText.trim() && addNota.mutate(noteText.trim())} disabled={!noteText.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: T.success }}><Send className="w-3 h-3" /> Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setNoteOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] rounded-lg" style={{ color: T.textSecondary, border: `1px dashed ${T.border}` }}>
                        <Plus className="w-3.5 h-3.5" /> Adicionar nota
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>
      )}
    </DetailDrawer>
    {leadId && (
      <TarefaFormModal open={tarefaModalOpen} onClose={() => setTarefaModalOpen(false)} defaultLeadId={leadId} defaultLeadLabel={fullName || null} invalidateKeys={[["lead", leadId], ["tarefas"]]} />
    )}
    </>
  );
}

/** Seção sanfona (24/08, pedido do Kauã: "abre e fecha... pra não ficar
 * mostrando tudo") — usada em Resumo do lead/Qualificação/Atribuição de
 * Origem/Timeline unificada. `right` (contador/badge) fica sempre visível no
 * cabeçalho, mesmo fechada, pra não perder o resumo ao colapsar. */
function Section({ title, icon, right, defaultOpen = false, T, children }: {
  title: string; icon?: React.ReactNode; right?: React.ReactNode; defaultOpen?: boolean; T: Tokens; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center justify-between gap-3 p-4 text-left">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <p className="text-[12px] font-bold uppercase tracking-wide truncate" style={{ color: T.textSecondary }}>{title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ color: T.textSecondary, transform: open ? "rotate(180deg)" : undefined }} />
        </div>
      </button>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

function QuickPill({ icon: Icon, label, href, T }: { icon: typeof Phone; label: string; href?: string; T: Tokens }) {
  const cls = "flex-1 flex items-center justify-center gap-1.5 h-10 rounded-full text-[13px] font-semibold";
  if (!href) {
    return <span className={cls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgAlt, opacity: 0.4 }}><Icon className="w-4 h-4" /> {label}</span>;
  }
  return (
    <Link href={href} className={cls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgAlt }}>
      <Icon className="w-4 h-4" /> {label}
    </Link>
  );
}

function KV({ label, value, onClick, T }: { label: string; value: string; onClick?: () => void; T: Tokens }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: T.textSecondary }}>{label}</span>
      {onClick ? (
        <button onClick={onClick} className="font-semibold underline truncate max-w-[220px]" style={{ color: T.textPrimary }}>{value}</button>
      ) : (
        <span className="font-semibold truncate max-w-[220px]" style={{ color: T.textPrimary }}>{value}</span>
      )}
    </div>
  );
}
