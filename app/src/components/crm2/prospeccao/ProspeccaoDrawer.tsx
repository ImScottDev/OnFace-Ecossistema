"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, Plus, Calendar, ChevronDown, Check, Send, Clock, X } from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import { LigacoesSection } from "@/components/crm/LigacoesSection";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import type { OrgUsuario } from "@/components/crm/BoardFilters";
import { resolveProspeccaoStatus, PROSPECCAO_STATUS, type ProspeccaoLead } from "./shared";

interface Negocio { id: string; titulo: string; status: string; createdAt: string }
interface Atividade { id: string; tipo: string; titulo?: string | null; descricao?: string | null; createdAt: string; usuarioNome?: string | null }
interface Nota { id: string; conteudo: string; autorNome?: string | null; createdAt: string }
interface Tarefa { id: string; titulo: string; prioridade: string; dataVencimento?: string | null; concluida: boolean }
interface CadenciaDef { id: string; nome: string; totalSteps: number }

interface LeadDetail {
  id: string;
  nome: string;
  sobrenome?: string | null;
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  empresaId?: string | null;
  empresaCnpj?: string | null;
  cargo?: string | null;
  sdrStatus?: string | null;
  camposCustom?: Record<string, unknown> | null;
  createdAt: string;
}

const TABS = ["Tudo", "Ligações", "WhatsApp", "E-mails", "Notas", "Tarefas"] as const;
type Tab = (typeof TABS)[number];
const TIPO_LABEL: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", nota: "Nota", tarefa: "Tarefa" };

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

/**
 * Workspace lateral dedicado ao prospect outbound. O foco é histórico da
 * abordagem, cadência, prontidão do handoff e ações operacionais. Ao
 * qualificar, a oportunidade é criada e o registro passa a aparecer em
 * "Qualificado" de Pré-vendas, com origem e histórico outbound preservados.
 */
export function ProspeccaoDrawer({
  leadId, open, onClose, usuariosById, cadencias, onChanged,
}: {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
  usuariosById: Map<string, OrgUsuario>;
  cadencias: CadenciaDef[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Tudo");
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [enrollSelect, setEnrollSelect] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadId}`);
      if (!r.ok) throw new Error("Lead não encontrado");
      return r.json() as Promise<{ lead: LeadDetail; empresa: { cnpj?: string | null } | null; negocios: Negocio[]; atividades: Atividade[]; tarefas: Tarefa[] }>;
    },
    enabled: !!leadId && open,
  });

  // Board summary (lista/cadência) — reaproveita o dado que a tabela já
  // buscou em /api/prospeccao/board (`enabled: false` = nunca dispara
  // fetch própria, só lê o cache existente). Bug real reportado pelo Kauã:
  // sem `queryFn`, o react-query lança erro de console mesmo com
  // `enabled: false` — precisa de uma função válida (mesmo que nunca
  // execute), não um valor undefined.
  const { data: boardData } = useQuery<{ leads: ProspeccaoLead[] }>({
    queryKey: ["prospeccao-board"],
    queryFn: () => qc.getQueryData<{ leads: ProspeccaoLead[] }>(["prospeccao-board"]) ?? { leads: [] },
    enabled: false,
  });
  const boardLead = boardData?.leads.find((l) => l.id === leadId) || null;

  const { data: notas = [] } = useQuery<Nota[]>({
    queryKey: ["notas", "lead", leadId],
    queryFn: async () => { const r = await fetch(`/api/notas?leadId=${leadId}`); return r.ok ? r.json() : []; },
    enabled: !!leadId && open,
  });

  const patchLead = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", leadId] }); onChanged(); },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const qualificar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/leads/${leadId}/converter-oportunidade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ semReuniao: true }) });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || "falha"); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Prospect enviado para Qualificado em Pré-vendas.");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      onChanged();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível qualificar"),
  });

  const enroll = useMutation({
    mutationFn: async (cadenceDefinitionId: string) => {
      const r = await fetch("/api/prospeccao/cadencia/enroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: [leadId], cadenceDefinitionId }) });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => { toast.success("Follow-up iniciado."); onChanged(); setEnrollSelect(""); },
    onError: () => toast.error("Não foi possível iniciar o follow-up"),
  });

  const pausar = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/prospeccao/cadencia/pausar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadIds: [leadId] }) });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => { toast.success("Follow-up pausado."); onChanged(); },
    onError: () => toast.error("Não foi possível pausar"),
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const r = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida }) });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", leadId] }),
  });

  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const r = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, leadId }) });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notas", "lead", leadId] }); setNoteText(""); setNoteOpen(false); },
    onError: () => toast.error("Não foi possível salvar a nota"),
  });

  useEffect(() => { if (noteOpen) noteRef.current?.focus(); }, [noteOpen]);

  const lead = detail?.lead;
  if (!lead && !isLoading) return null;

  const atividades = detail?.atividades || [];
  const tarefasAbertas = (detail?.tarefas || []).filter((t) => !t.concluida);
  const proximaTarefa = [...tarefasAbertas].filter((t) => t.dataVencimento).sort((a, b) => new Date(a.dataVencimento!).getTime() - new Date(b.dataVencimento!).getTime())[0];
  const fullName = lead ? `${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}` : "";
  const owner = lead && boardLead?.responsavelId ? usuariosById.get(boardLead.responsavelId) : undefined;
  const status = lead ? resolveProspeccaoStatus({ ...(lead as unknown as ProspeccaoLead), negocioPrincipal: boardLead?.negocioPrincipal, negocioCount: boardLead?.negocioCount }) : PROSPECCAO_STATUS[0];
  const cadencia = boardLead?.cadencia;

  const qualif = ((lead?.camposCustom?.qualificacaoSdr as Record<string, string>) || {});
  const criteriosFaltando: string[] = [];
  if (lead && !lead.telefone && !lead.email) criteriosFaltando.push("contato (telefone ou e-mail)");
  if (lead && !lead.empresa) criteriosFaltando.push("empresa");
  if (!qualif.necessidadeDor?.trim()) criteriosFaltando.push("necessidade/dor identificada");

  const feed = [
    ...atividades.filter((a) => a.tipo !== "ligacao").map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo || TIPO_LABEL[a.tipo] || a.tipo, createdAt: a.createdAt, usuarioNome: a.usuarioNome })),
    ...notas.map((n) => ({ id: `nota-${n.id}`, tipo: "nota", titulo: n.conteudo, createdAt: n.createdAt, usuarioNome: n.autorNome })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const feedFiltrado = tab === "Tudo" ? feed : tab === "WhatsApp" ? feed.filter((e) => e.tipo === "whatsapp") : tab === "E-mails" ? feed.filter((e) => e.tipo === "email") : tab === "Notas" ? feed.filter((e) => e.tipo === "nota") : [];

  const MOVE_OPTIONS = [
    { key: "contacted", label: "Em prospecção", color: "#EAB308" },
    { key: "qualifying", label: "Respondeu", color: "#0EA5E9" },
    { key: "sdr_sem_retorno", label: "Sem resposta", color: "#8e27ef" },
  ];

  const footer = lead && (
    <div className="p-3 flex items-center justify-between flex-wrap gap-2" style={{ background: "var(--cf2-bg-surface)", borderTop: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center gap-3 relative">
        <button onClick={() => setMoveMenuOpen((v) => !v)} className="flex items-center gap-2 h-10 px-3 rounded-xl text-[13px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          Mover etapa <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {moveMenuOpen && (
          <div className="absolute bottom-12 left-0 min-w-[180px] rounded-xl py-1 z-10" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.12)" }}>
            {MOVE_OPTIONS.map((s) => (
              <button key={s.key} onClick={() => { patchLead.mutate({ sdrStatus: s.key }); setMoveMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => patchLead.mutate({ sdrStatus: "disqualified" })} className="text-[13px] font-bold" style={{ color: "#dc2626" }}>Desqualificar</button>
      </div>
      <button
        onClick={() => criteriosFaltando.length > 0 ? toast.error(`Faltam: ${criteriosFaltando.join(", ")}`) : qualificar.mutate()}
        disabled={qualificar.isPending}
        className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold disabled:opacity-60"
        style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
      >
        <Check className="w-4 h-4" /> Enviar para Pré-vendas
      </button>
    </div>
  );

  return (
    <>
    <DetailDrawer open={open && !!leadId} onClose={onClose} bare panelBg="#ffffff" width="w-full sm:w-[620px]" footer={footer}>
      {isLoading && <div className="space-y-3 p-6" aria-label="Carregando prospect">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }} />)}</div>}
      {isError && <div className="flex flex-col items-center gap-2 p-10 text-center"><p className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Não foi possível abrir o prospect</p><p className="text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Feche o painel e tente novamente.</p></div>}
      {lead && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--cf2-text-tertiary)" }}>Perfil outbound</p>
              <p className="truncate text-[20px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{fullName}</p>
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>{[lead.empresa, lead.cargo].filter(Boolean).join(" · ") || "—"}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: `${status.color}18`, color: status.color }}>{status.label}</span>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>Outbound</span>
                {boardLead?.listaNome && <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{boardLead.listaNome}</span>}
                {boardLead?.labels?.filter((label) => label.nome.toLowerCase() !== "outbound").slice(0, 3).map((label) => <span key={label.id} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${label.cor}16`, color: label.cor }}>{label.nome}</span>)}
              </div>
              </div>
              <button onClick={onClose} aria-label="Fechar perfil do prospect" className="rounded-lg p-2" style={{ color: "var(--cf2-text-tertiary)" }}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0" style={{ width: 28, height: 28, background: "var(--cf2-text-tertiary)", color: "var(--cf2-text-on-accent)" }}>{initials(owner?.nome)}</span>
                <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{owner?.nome || "Sem responsável"}</span>
              </div>
              <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{cadencia ? `${cadencia.definitionNome} · etapa ${cadencia.stepIndex}/${cadencia.totalSteps}` : "Fora de follow-up"}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Ações rápidas</p>
            <div className="flex gap-2">
              <QuickAction icon={Phone} label="Ligar" href={lead.telefone ? callfaceCallUrl(lead.telefone) : undefined} />
              <QuickAction icon={MessageCircle} label="WhatsApp" href={lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : undefined} />
              <QuickAction icon={Mail} label="E-mail" href={lead.email ? `mailto:${lead.email}` : undefined} />
              <QuickAction icon={Plus} label="Tarefa" onClick={() => setTarefaModalOpen(true)} />
            </div>
            {proximaTarefa ? (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                <p className="text-[12px] flex-1" style={{ color: "var(--cf2-text-secondary)" }}>Próxima ação: {proximaTarefa.titulo}, {new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem próxima ação agendada</p>
              </div>
            )}
          </div>

          {/* Cadência — Cadence Engine real (lib/cadencia/cadence-engine.ts), 1º consumidor sendo Prospecção */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Follow-up</p>
              {cadencia && ["active", "waiting"].includes(cadencia.status) && (
                <button onClick={() => pausar.mutate()} className="text-[12px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>Pausar</button>
              )}
            </div>
            {cadencia ? (
              <div className="flex flex-col gap-2 text-[12px]">
                <KV label="Follow-up atual" value={cadencia.definitionNome} />
                <KV label="Etapa atual" value={`${cadencia.stepIndex} de ${cadencia.totalSteps}`} />
                <KV label="Status" value={cadencia.status} />
                {cadencia.proximaAcaoEm && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />
                    <span style={{ color: "var(--cf2-text-secondary)" }}>Próximo toque: {new Date(cadencia.proximaAcaoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select value={enrollSelect} onChange={(e) => setEnrollSelect(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                  <option value="">Sem follow-up ativo — selecionar...</option>
                  {cadencias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.totalSteps} toques)</option>)}
                </select>
                <button onClick={() => enrollSelect && enroll.mutate(enrollSelect)} disabled={!enrollSelect || enroll.isPending} className="px-3 py-1.5 rounded-lg text-[12px] font-bold disabled:opacity-40 shrink-0" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Adicionar</button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Dados de contato</p>
            <div className="flex flex-col gap-2.5 text-[12px]">
              <KV label="Telefone" value={lead.telefone || "—"} />
              <KV label="E-mail" value={lead.email || "—"} />
              <KV label="Empresa" value={lead.empresa || "—"} />
              <KV label="Cargo" value={lead.cargo || "—"} />
              <KV label="Data de entrada" value={new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} />
            </div>
          </div>

          <div className="p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="mb-3"><p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Prontidão para o handoff</p><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Dados que acompanham o prospect ao entrar em Qualificado de Pré-vendas.</p></div>
            <QualificacaoSdrSection leadId={leadId!} camposCustom={lead.camposCustom} variant="light" queryKeysToInvalidate={["prospeccao-board"]} prefill={{ cnpj: detail?.empresa?.cnpj || lead.empresaCnpj || "", cargo: lead.cargo || "" }} />
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Timeline unificada</p>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0" style={{ background: tab === t ? "var(--cf2-text-primary)" : "var(--cf2-bg-surface)", color: tab === t ? "#ffffff" : "var(--cf2-text-secondary)", border: tab === t ? "none" : "1px solid var(--cf2-border-default)" }}>{t}</button>
              ))}
            </div>
            {tab === "Ligações" ? (
              <LigacoesSection leadId={leadId!} enviarDiscagem />
            ) : tab === "Tarefas" ? (
              tarefasAbertas.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {tarefasAbertas.map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                      <button onClick={() => toggleTarefa.mutate({ id: t.id, concluida: true })} className="w-4 h-4 rounded-full shrink-0" style={{ border: "1px solid var(--cf2-border-default)" }} />
                      <p className="flex-1 text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{t.titulo}</p>
                      {t.dataVencimento && <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(t.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma tarefa em aberto.</p>
              )
            ) : (
              <div className="flex flex-col gap-2">
                {feedFiltrado.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nada por aqui ainda.</p>}
                {feedFiltrado.map((e) => (
                  <div key={e.id} className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0" style={{ width: 28, height: 28, background: "var(--cf2-text-tertiary)", color: "var(--cf2-text-on-accent)" }}>{initials(e.usuarioNome)}</span>
                      <div className="flex-1 min-w-0"><p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{timeAgoShort(e.createdAt)} atrás</p></div>
                      <span className="px-2 py-1 rounded-full text-[11px] font-bold shrink-0" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{TIPO_LABEL[e.tipo] || e.tipo}</span>
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{e.usuarioNome ? `${e.usuarioNome} — ` : ""}{e.titulo}</p>
                  </div>
                ))}
                {tab === "Notas" && (
                  <div className="pt-1">
                    {noteOpen ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea ref={noteRef} value={noteText} onChange={(ev) => setNoteText(ev.target.value)} placeholder="Escreva uma nota..." rows={3} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && noteText.trim()) addNota.mutate(noteText.trim()); if (ev.key === "Escape") { setNoteOpen(false); setNoteText(""); } }} />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setNoteOpen(false); setNoteText(""); }} className="text-[12px] px-2 py-1" style={{ color: "var(--cf2-text-tertiary)" }}>Cancelar</button>
                          <button onClick={() => noteText.trim() && addNota.mutate(noteText.trim())} disabled={!noteText.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}><Send className="w-3 h-3" /> Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setNoteOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] rounded-lg" style={{ color: "var(--cf2-text-tertiary)", border: "1px dashed var(--cf2-border-default)" }}><Plus className="w-3.5 h-3.5" /> Adicionar nota</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </DetailDrawer>
    {leadId && <TarefaFormModal open={tarefaModalOpen} onClose={() => setTarefaModalOpen(false)} defaultLeadId={leadId} defaultLeadLabel={fullName || null} invalidateKeys={[["lead", leadId], ["tarefas"]]} />}
    </>
  );
}

function QuickAction({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const cls = "flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[13px] font-semibold";
  const style = { border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)", opacity: disabled ? 0.4 : 1 };
  if (href && !disabled) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}><Icon className="w-4 h-4" /> {label}</a>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={style}><Icon className="w-4 h-4" /> {label}</button>;
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--cf2-text-tertiary)" }}>{label}</span>
      <span className="font-semibold truncate max-w-[220px]" style={{ color: "var(--cf2-text-primary)" }}>{value}</span>
    </div>
  );
}
