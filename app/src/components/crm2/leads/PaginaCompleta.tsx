"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { Phone, MessageCircle, Mail, Plus, Calendar, ChevronDown, ArrowRight, Check, Send, ChevronRight, Pencil, CheckCircle2, Circle } from "lucide-react";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import { LigacoesSection } from "@/components/crm/LigacoesSection";
import { TarefaFormModal, type Tarefa as TarefaCompleta } from "@/components/crm/tarefas/TarefaFormModal";
import { Cf2AgendarReuniaoModal, type AgendarReuniaoPayload } from "@/components/crm2/qualificacao/AgendarReuniaoModal";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { SDR_STAGES, SDR_MIRROR_KEYS } from "@/lib/crm/pipeline";
import { stageAge, resolveDisplayStage, resolveContextoCliente, type Lead as KanbanLead } from "@/components/crm2/qualificacao/shared";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";

interface Negocio { id: string; titulo: string; status: string; createdAt: string }
interface Atividade { id: string; tipo: string; titulo?: string | null; descricao?: string | null; createdAt: string; usuarioNome?: string | null }
interface Nota { id: string; conteudo: string; autorNome?: string | null; createdAt: string }
interface LeadDetail extends KanbanLead {
  email?: string | null; telefone?: string | null; empresa?: string | null; empresaId?: string | null;
  empresaCnpj?: string | null; cargo?: string | null; utmCampaign?: string | null;
  camposCustom?: Record<string, unknown> | null; createdAt: string;
}

const TABS = ["Tudo", "Ligações", "WhatsApp", "E-mails", "Notas", "Tarefas"] as const;
type Tab = (typeof TABS)[number];
const TIPO_LABEL: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", nota: "Nota", reuniao: "Reunião", proposta_enviada: "Proposta" };

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
 * Página completa do lead (Figma-like mockup do Kauã, 17/08) — antes disso
 * "Abrir página completa" caía no `/contatos/:id` legado (dark, MVP). O
 * detalhe legado foi movido pra `/contatos-legado/:id` (rota preservada,
 * link nenhum foi apagado) pra liberar `/contatos/:id` pra esta página.
 *
 * Reaproveita 100% da lógica real já validada no `Cf2LeadDrawer` (mesma
 * query `["lead", leadId]`, mesmas mutations de mover/qualificar/tarefa/
 * nota) — o que muda é o LAYOUT: aqui é página cheia em 2 colunas, com 2
 * widgets novos que o drawer (compacto) não tem: "Próxima Ação Mapeada"
 * (destaque do que já era `proximaTarefa`) e "Jornada Operacional do Lead"
 * (linha do tempo simplificada — Novo Lead/Em Contato/Qualificação SDR/
 * Apresentação/Fechamento — derivada de dados reais: etapa CRM2 atual +
 * status real do(s) negócio(s) vinculado(s), nunca um número inventado).
 */
export function Cf2LeadPaginaCompleta({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { origens } = usePipelineConfig();
  const { byId: usuariosById, usuarios: orgUsuarios } = useOrgUsuarios();
  const [tab, setTab] = useState<Tab>("Tudo");
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<TarefaCompleta | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [sidebarNoteText, setSidebarNoteText] = useState("");
  const [agendarAberto, setAgendarAberto] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

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
        tarefas: TarefaCompleta[];
        contratos?: { status: string }[];
      }>;
    },
  });

  const { data: notas = [] } = useQuery<Nota[]>({
    queryKey: ["notas", "lead", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/notas?leadId=${leadId}`);
      if (!r.ok) return [];
      return r.json();
    },
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
      setNoteText(""); setSidebarNoteText("");
    },
    onError: () => toast.error("Não foi possível salvar a nota"),
  });

  // Mover/Qualificar/Desqualificar — MESMA lógica de `handleMove` do Kanban
  // (Workspace.tsx): guarda contra escrever direto numa etapa-espelho
  // (read-only, controlada pelo closer) e abre o modal de agendar reunião
  // quando cabe. Duplicado aqui (não extraído pra hook compartilhado ainda)
  // por velocidade — mesmo comportamento, sem regra nova.
  const moveStage = useMutation({
    mutationFn: async ({ id, sdrStatus }: { id: string; sdrStatus: string }) => {
      const r = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sdrStatus }) });
      if (!r.ok) throw new Error("falha ao mover");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", leadId] }),
    onError: () => toast.error("Não foi possível mover o lead"),
  });

  const qualificar = useMutation({
    mutationFn: async (payload?: AgendarReuniaoPayload | { semReuniao: true }) => {
      const r = await fetch(`/api/leads/${leadId}/converter-oportunidade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload ?? {}) });
      if (!r.ok) throw new Error("falha ao qualificar");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Lead qualificado.");
      setAgendarAberto(false);
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
    },
    onError: () => toast.error("Não foi possível qualificar o lead"),
  });

  const handleMove = (targetStatus: string) => {
    if (!lead) return;
    const isNoShowRecovery = negocioAtivo?.status === "no_show";
    if ((targetStatus === "qualified" || targetStatus === "m_qualified") && (negocios.length === 0 || isNoShowRecovery)) {
      setAgendarAberto(true);
      return;
    }
    if (SDR_MIRROR_KEYS.includes(targetStatus)) {
      toast.info("Essa etapa é controlada pelo closer no Pipeline.");
      return;
    }
    moveStage.mutate({ id: leadId, sdrStatus: targetStatus });
  };

  useEffect(() => { if (noteRef.current) noteRef.current.focus(); }, []);

  const lead = detail?.lead;
  const negocios = detail?.negocios || [];
  const atividades = detail?.atividades || [];
  const tarefas = detail?.tarefas || [];
  const tarefasAbertas = tarefas.filter((t) => !t.concluida);
  const proximaTarefa = [...tarefasAbertas].filter((t) => t.dataVencimento).sort((a, b) => new Date(a.dataVencimento!).getTime() - new Date(b.dataVencimento!).getTime())[0];
  // Negócio ativo = mesma regra do enrichment real da API (prioriza não
  // perdido/churned, dentre esses não no_show) — replicada aqui porque o
  // detail endpoint devolve a LISTA completa, não um "principal" já resolvido.
  const activeNegs = negocios.filter((n) => !["perdido", "churned"].includes(n.status));
  const liveNegs = activeNegs.filter((n) => n.status !== "no_show");
  const negocioAtivo = liveNegs[0] || activeNegs[0] || negocios[0] || null;

  if (isLoading) return <div className="p-8 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</div>;
  if (!lead) return <div className="p-8 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Lead não encontrado.</div>;

  const fullName = `${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}`;
  const owner = lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined;
  const stage = resolveDisplayStage(lead);
  const age = stageAge(lead.updatedAt, lead.sdrStatus || "pending");
  const contextoCliente = resolveContextoCliente(lead, detail?.contratos);
  const origemLabel = lead.origem ? origens.find((o) => o.key === lead.origem)?.label || lead.origem : "—";

  const feed = [
    ...atividades.filter((a) => a.tipo !== "ligacao").map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo || TIPO_LABEL[a.tipo] || a.tipo, createdAt: a.createdAt, usuarioNome: a.usuarioNome })),
    ...notas.map((n) => ({ id: `nota-${n.id}`, tipo: "nota", titulo: n.conteudo, createdAt: n.createdAt, usuarioNome: n.autorNome })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const feedFiltrado = tab === "Tudo" ? feed
    : tab === "WhatsApp" ? feed.filter((e) => e.tipo === "whatsapp")
    : tab === "E-mails" ? feed.filter((e) => e.tipo === "email")
    : tab === "Notas" ? feed.filter((e) => e.tipo === "nota")
    : [];

  // Jornada operacional — simplificação real (não uma 6ª taxonomia nova):
  // funde o funil de Pré-vendas (Novo/Em Contato/Qualificação) com o
  // avanço real do negócio vinculado (Apresentação ~ reunião realizada ou
  // trial; Fechamento ~ ganho), pra dar 1 leitura de "onde isso está" sem
  // fabricar percentuais.
  const negStatus = negocioAtivo?.status;
  const passouApresentacao = !!negStatus && ["reuniao_realizada", "trial", "proposta_apresentada", "negociacao_iniciada", "ganho"].includes(negStatus);
  const fechou = negStatus === "ganho";
  const jornada = [
    { label: "Novo Lead", done: true, sub: `Entrada em ${new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` },
    { label: "Em Contato", done: stage.label !== "Novo", current: stage.label === "Em contato" },
    { label: "Qualificação SDR", done: ["Qualificado", "Agenda Confirmada"].includes(stage.label) || negocios.length > 0, current: stage.label === "Qualificação" },
    { label: "Apresentação", done: passouApresentacao, current: stage.label === "Agenda Confirmada" && !passouApresentacao },
    { label: "Fechamento", done: fechou, current: negStatus === "negociacao_iniciada" || negStatus === "proposta_apresentada" },
  ];

  return (
    <>
      <div className="-m-6 mb-0 flex flex-col">
        <div className="rounded-tl-2xl px-8 pt-7 pb-5" style={{ background: "var(--cf2-bg-canvas)" }}>
          <Cf2Topbar orgNome="Callface" variant="light" title="Vendas" subtitle="Gestão de pré-vendas, qualificação e distribuição de leads" />
        </div>

        <div className="px-8 py-6 flex flex-col gap-4" style={{ background: "var(--cf2-chrome-bg-alt)" }}>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
            <Link href="/vendas" className="hover:underline">Vendas</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/pre-vendas" className="hover:underline">Pré-vendas</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: "var(--cf2-chrome-text-primary)" }}>{fullName}</span>
          </div>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-[26px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{fullName}</p>
                {/* Correção 19/08: cliente atual não pode aparecer com o estágio de
                    SDR (histórico) como identidade — contexto de cliente vem primeiro. */}
                {contextoCliente ? (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-[12px] font-bold" style={{ background: "rgba(5,150,105,0.18)", color: "#059669" }}>{contextoCliente.label}</span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-secondary)" }}>Lead histórico: {stage.label}</span>
                  </>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: `${stage.color}22`, color: stage.color }}>{stage.label}</span>
                )}
                {(origemLabel !== "—" || lead.utmCampaign) && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-secondary)" }}>{[origemLabel, lead.utmCampaign].filter((v) => v && v !== "—").join(" · ")}</span>
                )}
              </div>
              <p className="text-[13px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{[lead.empresa, lead.cargo].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0" style={{ width: 30, height: 30, background: "var(--cf2-chrome-text-secondary)", color: "#0f172a" }}>{initials(owner?.nome)}</span>
                <div>
                  <p className="text-[10px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>Responsável</p>
                  <AssignOwnerControl
                    entityType="lead"
                    entityId={leadId}
                    currentOwnerId={lead.responsavelId}
                    usuarios={orgUsuarios}
                    onChanged={() => qc.invalidateQueries({ queryKey: ["lead", leadId] })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <HeaderAction icon={Phone} label="Ligar" href={lead.telefone ? callfaceCallUrl(lead.telefone) : undefined} />
                <HeaderAction icon={MessageCircle} label="WhatsApp" href={lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : undefined} />
                <HeaderAction icon={Mail} label="E-mail" href={lead.email ? `mailto:${lead.email}` : undefined} />
                <HeaderAction icon={Plus} label="Tarefa" onClick={() => { setTarefaEditando(null); setTarefaModalOpen(true); }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            <button onClick={() => setMoveMenuOpen((v) => !v)} className="flex items-center gap-2 h-10 px-3.5 rounded-xl text-[13px] font-semibold" style={{ background: "var(--cf2-bg-canvas)", color: "var(--cf2-text-primary)" }}>
              <ArrowRight className="w-4 h-4" /> Mover etapa <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {moveMenuOpen && (
              <div className="absolute top-12 left-0 min-w-[180px] rounded-xl py-1 z-10" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.2)" }}>
                {SDR_STAGES.map((s) => (
                  <button key={s.key} onClick={() => { handleMove(s.key); setMoveMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => handleMove("qualified")} className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
              <Check className="w-4 h-4" /> Qualificar lead →
            </button>
            <button onClick={() => handleMove("disqualified")} className="text-[13px] font-bold" style={{ color: "#f87171" }}>Desqualificar Lead</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 pt-8">
        <div className="flex flex-col gap-5 min-w-0">
          <Card title="Resumo do Lead">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
              <Field label="Telefone" value={lead.telefone || "—"} />
              <Field label="E-mail" value={lead.email || "—"} />
              <Field label="Empresa" value={lead.empresa || "—"} link={lead.empresaId ? `/empresas/${lead.empresaId}` : undefined} />
              <Field label="Cargo" value={lead.cargo || "—"} />
              <Field label="Origem" value={origemLabel} />
              <Field label="Campanha" value={lead.utmCampaign || "—"} />
              <Field label="Responsável" value={owner?.nome || "Sem responsável"} />
              <Field label="Data de Entrada" value={new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} />
            </div>
          </Card>

          <Card title="Qualificação SDR">
            <QualificacaoSdrSection
              leadId={leadId}
              camposCustom={lead.camposCustom}
              variant="light"
              queryKeysToInvalidate={["pre-vendas-leads"]}
              prefill={{ cnpj: detail?.empresa?.cnpj || lead.empresaCnpj || "", cargo: lead.cargo || "" }}
            />
          </Card>

          <Card title="Timeline Unificada">
            <div className="flex gap-2 overflow-x-auto pb-0.5 mb-3">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0" style={{ background: tab === t ? "var(--cf2-text-primary)" : "var(--cf2-bg-surface)", color: tab === t ? "#ffffff" : "var(--cf2-text-secondary)", border: tab === t ? "none" : "1px solid var(--cf2-border-default)" }}>
                  {t}
                </button>
              ))}
            </div>
            {tab === "Ligações" ? (
              <LigacoesSection leadId={leadId} enviarDiscagem />
            ) : tab === "Tarefas" ? (
              tarefasAbertas.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {tarefasAbertas.map((t) => (
                    <TarefaRow key={t.id} tarefa={t} onToggle={() => toggleTarefa.mutate({ id: t.id, concluida: true })} onEdit={() => { setTarefaEditando(t); setTarefaModalOpen(true); }} />
                  ))}
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma tarefa em aberto.</p>
              )
            ) : (
              <div className="flex flex-col gap-2">
                {feedFiltrado.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nada por aqui ainda.</p>}
                {feedFiltrado.map((e) => (
                  <div key={e.id} className="flex flex-col gap-1.5 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0" style={{ width: 26, height: 26, background: "var(--cf2-text-tertiary)", color: "#fff" }}>{initials(e.usuarioNome)}</span>
                      <p className="text-[12px] font-bold flex-1" style={{ color: "var(--cf2-text-primary)" }}>{timeAgoShort(e.createdAt)} atrás</p>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{TIPO_LABEL[e.tipo] || e.tipo}</span>
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{e.usuarioNome ? `${e.usuarioNome} — ` : ""}{e.titulo}</p>
                  </div>
                ))}
                {tab === "Notas" && (
                  <div className="pt-1">
                    <textarea ref={noteRef} value={noteText} onChange={(ev) => setNoteText(ev.target.value)} placeholder="Escreva uma nota..." rows={2}
                      className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
                      onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && noteText.trim()) addNota.mutate(noteText.trim()); }} />
                    <button onClick={() => noteText.trim() && addNota.mutate(noteText.trim())} disabled={!noteText.trim() || addNota.isPending} className="mt-1.5 text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}><Send className="w-3 h-3" /> Salvar</button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          {proximaTarefa && (
            <div className="rounded-2xl p-4 flex items-start justify-between gap-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div className="flex items-start gap-2.5 min-w-0">
                <Calendar className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: "#dc2626" }}>Próxima Ação Mapeada</p>
                  <p className="text-[13px] mt-1" style={{ color: "var(--cf2-text-primary)" }}>{proximaTarefa.titulo}, {new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às {new Date(proximaTarefa.dataVencimento!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
              <button onClick={() => { setTarefaEditando(proximaTarefa); setTarefaModalOpen(true); }} className="text-[12px] font-semibold shrink-0 flex items-center gap-1" style={{ color: "#dc2626" }}><Pencil className="w-3 h-3" /> Editar</button>
            </div>
          )}

          <Card
            title="Tarefas Pendentes"
            action={<button onClick={() => { setTarefaEditando(null); setTarefaModalOpen(true); }} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>+ Nova tarefa</button>}
          >
            {tarefasAbertas.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma tarefa em aberto.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {tarefasAbertas.slice(0, 6).map((t) => <TarefaRow key={t.id} tarefa={t} onToggle={() => toggleTarefa.mutate({ id: t.id, concluida: true })} onEdit={() => { setTarefaEditando(t); setTarefaModalOpen(true); }} />)}
              </div>
            )}
          </Card>

          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Jornada Operacional do Lead</p>
            <div className="flex flex-col gap-3">
              {jornada.map((j, i) => (
                <div key={j.label} className="flex items-start gap-2.5">
                  {j.done ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--cf2-accent)" }} /> : j.current ? <div className="w-4 h-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center" style={{ border: `2px solid var(--cf2-accent)` }}><div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--cf2-accent)" }} /></div> : <Circle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--cf2-chrome-border-subtle)" }} />}
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: j.done || j.current ? "var(--cf2-chrome-text-primary)" : "var(--cf2-chrome-text-secondary)" }}>{j.label}</p>
                    {j.sub && <p className="text-[11px]" style={{ color: "var(--cf2-chrome-text-secondary)" }}>{j.sub}</p>}
                    {j.current && !j.sub && <p className="text-[11px]" style={{ color: "var(--cf2-accent)" }}>Etapa atual</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card title="Notas Internas">
            <textarea value={sidebarNoteText} onChange={(e) => setSidebarNoteText(e.target.value)} placeholder="Digite uma nova anotação interna..." rows={2}
              className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y mb-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && sidebarNoteText.trim()) addNota.mutate(sidebarNoteText.trim()); }} />
            <div className="flex flex-col gap-2">
              {notas.slice(0, 4).map((n) => (
                <div key={n.id} className="p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>{n.autorNome || "—"} · {timeAgoShort(n.createdAt)}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-primary)" }}>{n.conteudo}</p>
                </div>
              ))}
              {notas.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma nota ainda.</p>}
            </div>
          </Card>
        </div>
      </div>

      <TarefaFormModal
        open={tarefaModalOpen}
        onClose={() => { setTarefaModalOpen(false); setTarefaEditando(null); }}
        tarefa={tarefaEditando}
        defaultLeadId={leadId}
        defaultLeadLabel={fullName}
        invalidateKeys={[["lead", leadId]]}
      />
      <Cf2AgendarReuniaoModal
        open={agendarAberto}
        leadNome={fullName}
        leadEmpresa={lead.empresa}
        leadEmail={lead.email}
        closerSugeridoId={lead.responsavelId}
        saving={qualificar.isPending}
        onClose={() => setAgendarAberto(false)}
        onConfirm={(payload) => qualificar.mutate(payload)}
        onQualificarSemAgendar={() => qualificar.mutate({ semReuniao: true })}
      />
    </>
  );
}

function HeaderAction({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const cls = "flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-semibold";
  const style = { background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-primary)", opacity: disabled ? 0.4 : 1 };
  if (href && !disabled) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}><Icon className="w-3.5 h-3.5" /> {label}</a>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={style}><Icon className="w-3.5 h-3.5" /> {label}</button>;
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-[15px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p>
      {link ? (
        <Link href={link} className="font-semibold underline" style={{ color: "var(--cf2-text-primary)" }}>{value}</Link>
      ) : (
        <p className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{value}</p>
      )}
    </div>
  );
}

function TarefaRow({ tarefa, onToggle, onEdit }: { tarefa: TarefaCompleta; onToggle: () => void; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
      <button onClick={onToggle} className="w-4 h-4 rounded shrink-0" style={{ border: "1px solid var(--cf2-border-default)" }} />
      <button onClick={onEdit} className="flex-1 text-left min-w-0">
        <p className="text-[13px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{tarefa.titulo}</p>
      </button>
      {tarefa.dataVencimento && <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>Vence em: {new Date(tarefa.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
    </div>
  );
}
