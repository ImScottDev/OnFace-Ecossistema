"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import {
  Phone, MessageCircle, Mail, Plus, Calendar, ChevronDown, ArrowRight, Check, Send, ChevronRight, Pencil,
  CheckCircle2, Circle, Clock, MoreHorizontal,
} from "lucide-react";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import { TarefaFormModal, type Tarefa as TarefaCompleta } from "@/components/crm/tarefas/TarefaFormModal";
import { Cf2AgendarReuniaoModal, type AgendarReuniaoPayload } from "@/components/crm2/qualificacao/AgendarReuniaoModal";
import { Cf2CadenciaCard } from "@/components/crm2/qualificacao/CadenciaCard";
import { Cf2Topbar } from "@/components/crm2/Topbar";
import { digitsForDialer } from "@/lib/utils/callface-call";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { SDR_STAGES, SDR_MIRROR_KEYS, SDR_SLA_HOURS } from "@/lib/crm/pipeline";
import { stageAge, resolveDisplayStage, resolveContextoCliente, type Lead as KanbanLead } from "@/components/crm2/qualificacao/shared";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";

interface Negocio { id: string; titulo: string; status: string; createdAt: string }
interface Atividade { id: string; tipo: string; titulo?: string | null; descricao?: string | null; createdAt: string; usuarioNome?: string | null }
interface Nota { id: string; conteudo: string; autorNome?: string | null; createdAt: string }
interface LigacaoResumo { id: string; createdAt: string; callDate?: string | null; callStatus?: string | null }
interface EmpresaDetail { nome: string; cnpj: string | null; setor: string | null; porte: string | null; cidade: string | null; estado: string | null; website: string | null }
interface LeadDetail extends KanbanLead {
  email?: string | null; telefone?: string | null; empresa?: string | null; empresaId?: string | null;
  empresaCnpj?: string | null; cargo?: string | null; utmCampaign?: string | null; utmMedium?: string | null;
  utmContent?: string | null; metaAdId?: string | null; landingPage?: string | null;
  camposCustom?: Record<string, unknown> | null; createdAt: string;
}

const TIPO_LABEL: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", nota: "Nota", reuniao: "Reunião", proposta_enviada: "Proposta" };
const TIPO_ICON: Record<string, typeof Phone> = { ligacao: Phone, whatsapp: MessageCircle, email: Mail, nota: Pencil, reuniao: Calendar, proposta_enviada: Send };
const TIPO_COR: Record<string, string> = { ligacao: "#3B82F6", whatsapp: "#10B981", email: "#06B6D4", nota: "#94a3b8", reuniao: "#8e27ef", proposta_enviada: "#22C55E" };

// "Meta: Xh pra <o que importa nesta etapa>" — mesma SLA real que já
// alimenta o badge do Kanban (SDR_SLA_HOURS), só com a frase contextual por
// etapa (24/08, referência visual do Kauã: "SLA · Meta: 2h para 1º contato").
const SLA_META_LABEL: Record<string, string> = {
  pending: "1º contato", contacted: "qualificar", qualifying: "agendar reunião",
};

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
 * Página completa do lead — reconstruída (24/08) na referência visual que o
 * Kauã mandou: KPIs de topo (Responsável/Entrou há/Tempo no estágio/SLA/
 * Última interação — os DOIS tempos distintos que ele pediu, um pro estágio
 * e outro pra ação real), stepper horizontal de etapas, 2 fileiras de 3
 * cards (Próxima ação/Qualificação/Reunião — Contato/Empresa/Aquisição) e
 * Últimas interações com ação direta ("Abrir conversa"/"Ver detalhes").
 * Mesma lógica de negócio de sempre (fetch/mutations reaproveitados do
 * drawer), só a informação foi reorganizada — nenhuma regra nova.
 */
export function Cf2LeadPaginaCompleta({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { origens } = usePipelineConfig();
  const { byId: usuariosById, usuarios: orgUsuarios } = useOrgUsuarios();
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<TarefaCompleta | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
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
        empresa: EmpresaDetail | null;
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

  // Mesma fonte real do drawer (`/api/ligacoes`) — só pra "Última interação"
  // e "Últimas interações" saberem de ligação também, não só whatsapp/e-mail/nota.
  const { data: ligacoes = [] } = useQuery<LigacaoResumo[]>({
    queryKey: ["ligacoes-resumo", leadId],
    queryFn: async () => {
      const r = await fetch(`/api/ligacoes?leadId=${leadId}`);
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
      setSidebarNoteText("");
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
  const reuniaoAgendada = !!lead?.temReuniaoAgendada;

  if (isLoading) return <div className="p-8 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</div>;
  if (!lead) return <div className="p-8 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Lead não encontrado.</div>;

  const fullName = `${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}`;
  const owner = lead.responsavelId ? usuariosById.get(lead.responsavelId) : undefined;
  const stage = resolveDisplayStage(lead);
  const currentStatus = lead.sdrStatus || "pending";
  // 2 tempos distintos (24/08, pedido do Kauã) — "tempo no estágio" (SLA,
  // já existia) vs "última interação" (nota/ligação/mensagem/e-mail real,
  // pode ser bem mais recente que a troca de etapa).
  const tempoEstagio = stageAge(lead.updatedAt, currentStatus);
  const contextoCliente = resolveContextoCliente(lead, detail?.contratos);
  const origemLabel = lead.origem ? origens.find((o) => o.key === lead.origem)?.label || lead.origem : "—";
  const empresaDetail = detail?.empresa || null;

  // Ligar/WhatsApp/E-mail abrem em Atendimento (não link externo tel:/wa.me/
  // mailto:) — achado real 24/08: o telefone vai em qualquer canal, é o que
  // permite a tela de Atendimento achar a conversa certa quando
  // `contatos.leadId` não está preenchido no banco.
  const telefoneDialer = lead.telefone ? digitsForDialer(lead.telefone) : "";
  const atendimentoHref = (canal: "whatsapp" | "email" | "ligacao") => {
    const params = new URLSearchParams({ leadId, canal });
    if (telefoneDialer) params.set("telefone", telefoneDialer);
    return `/atendimento?${params.toString()}`;
  };

  const feed = [
    ...atividades.map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo || TIPO_LABEL[a.tipo] || a.tipo, createdAt: a.createdAt, usuarioNome: a.usuarioNome })),
    ...notas.map((n) => ({ id: `nota-${n.id}`, tipo: "nota", titulo: n.conteudo, createdAt: n.createdAt, usuarioNome: n.autorNome })),
    ...ligacoes.map((l) => ({ id: `ligacao-${l.id}`, tipo: "ligacao", titulo: l.callStatus === "FINISHED" || l.callStatus === "ANSWERED" ? "Ligação atendida" : "Ligação registrada", createdAt: l.callDate || l.createdAt, usuarioNome: null as string | null })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const ultimaInteracao = feed[0] || null;

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

        <div className="px-8 py-6 flex flex-col gap-5" style={{ background: "var(--cf2-chrome-bg-alt)" }}>
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
            <div className="flex gap-2">
              <HeaderAction icon={Phone} label="Ligar" href={lead.telefone ? atendimentoHref("ligacao") : undefined} />
              <HeaderAction icon={MessageCircle} label="WhatsApp" href={lead.telefone ? atendimentoHref("whatsapp") : undefined} />
              <HeaderAction icon={Mail} label="E-mail" href={lead.email ? atendimentoHref("email") : undefined} />
              <HeaderAction icon={Plus} label="Criar tarefa" onClick={() => { setTarefaEditando(null); setTarefaModalOpen(true); }} />
            </div>
          </div>

          {/* KPIs de topo (24/08, referência do Kauã): responsável trocável +
              os 2 tempos distintos (estágio vs. ação real) + SLA + última
              interação real (whatsapp/ligação/e-mail/nota, o que for mais
              recente de fato). */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 rounded-2xl p-4" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <KpiField label="Responsável">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center justify-center rounded-full text-[10px] font-extrabold shrink-0" style={{ width: 22, height: 22, background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>{initials(owner?.nome)}</span>
                <AssignOwnerControl entityType="lead" entityId={leadId} currentOwnerId={lead.responsavelId} usuarios={orgUsuarios} onChanged={() => qc.invalidateQueries({ queryKey: ["lead", leadId] })} />
              </div>
            </KpiField>
            <KpiField label="Entrou há">
              <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{timeAgoShort(lead.createdAt)}</p>
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
            </KpiField>
            <KpiField label="Tempo no estágio">
              <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{tempoEstagio?.text || "—"}</p>
              <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Desde {new Date(lead.updatedAt || lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
            </KpiField>
            <KpiField label="SLA">
              <p className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: tempoEstagio?.breached ? "var(--cf2-danger-text)" : "var(--cf2-success-text)" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "currentColor" }} /> {tempoEstagio?.breached ? "Fora do prazo" : "Dentro do prazo"}
              </p>
              {SDR_SLA_HOURS[currentStatus] && (
                <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Meta: {SDR_SLA_HOURS[currentStatus]}h {SLA_META_LABEL[currentStatus] ? `para ${SLA_META_LABEL[currentStatus]}` : "nesta etapa"}</p>
              )}
            </KpiField>
            <KpiField label="Última interação">
              {ultimaInteracao ? (
                <>
                  <p className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: TIPO_COR[ultimaInteracao.tipo] || "var(--cf2-text-primary)" }}>
                    <TipoIcon tipo={ultimaInteracao.tipo} /> {TIPO_LABEL[ultimaInteracao.tipo] || ultimaInteracao.tipo}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>há {timeAgoShort(ultimaInteracao.createdAt)}</p>
                </>
              ) : (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma ainda</p>
              )}
            </KpiField>
          </div>

          {/* Stepper de etapa — mesmo funil de sempre (SDR_STAGES + Agenda
              Confirmada), só agora visual de trilha em vez de um botão
              dropdown solto. Clique no passo já FUTURO move direto pra ele
              (mesma regra de handleMove, sem novo caminho de escrita). */}
          <div className="flex items-center gap-4 flex-wrap relative">
            <div className="flex items-center gap-1 flex-wrap">
              {[...SDR_STAGES.map((s) => ({ key: s.key, label: s.label, color: s.color })), { key: "m_qualified", label: "Qualificado (SQL)", color: "#22C55E" }, { key: "m_qualified_agenda", label: "Agenda confirmada", color: "#0EA5E9" }].map((s, i, arr) => {
                const isCurrent = s.key === currentStatus || (s.key === "m_qualified_agenda" && currentStatus === "m_qualified" && reuniaoAgendada) || (s.key === "m_qualified" && currentStatus === "m_qualified" && !reuniaoAgendada);
                return (
                  <div key={s.key} className="flex items-center gap-1">
                    <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: isCurrent ? `${s.color}1f` : "transparent", color: isCurrent ? s.color : "var(--cf2-text-tertiary)" }}>
                      {isCurrent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />} {s.label}
                    </span>
                    {i < arr.length - 1 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 ml-auto relative">
              <button onClick={() => setMoveMenuOpen((v) => !v)} className="flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-semibold" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                <ArrowRight className="w-3.5 h-3.5" /> Mover etapa <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {moveMenuOpen && (
                <div className="absolute top-11 right-0 min-w-[180px] rounded-xl py-1 z-10" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.2)" }}>
                  {SDR_STAGES.map((s) => (
                    <button key={s.key} onClick={() => { handleMove(s.key); setMoveMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => handleMove("qualified")} className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
                <Check className="w-4 h-4" /> Qualificar lead
              </button>
              <button onClick={() => handleMove("disqualified")} className="h-9 px-3 rounded-xl text-[13px] font-bold" style={{ color: "var(--cf2-danger-text)", border: "1px solid rgba(239,68,68,0.3)" }}>Desqualificar</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 pt-8">
        <div className="flex flex-col gap-5 min-w-0">
          {/* Próxima ação / Qualificação SDR / Reunião — 3 cards lado a lado
              (referência do Kauã), cada um respondendo 1 pergunta operacional
              direta em vez de empilhar tudo numa lista só. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card title="Próxima ação" compact>
              {proximaTarefa ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{proximaTarefa.titulo}</p>
                  <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {new Date(proximaTarefa.dataVencimento!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {owner?.nome || "—"}</p>
                  <button onClick={() => { setTarefaEditando(proximaTarefa); setTarefaModalOpen(true); }} className="self-start text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Reagendar</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma ação mapeada.</p>
                  <button onClick={() => { setTarefaEditando(null); setTarefaModalOpen(true); }} className="self-start text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>+ Criar tarefa</button>
                </div>
              )}
            </Card>

            <Card title="Qualificação SDR" compact>
              <QualificacaoSdrSection
                leadId={leadId}
                camposCustom={lead.camposCustom}
                variant="light"
                hideHeader
                showFieldStatusDots
                queryKeysToInvalidate={["pre-vendas-leads"]}
                prefill={{ cnpj: empresaDetail?.cnpj || lead.empresaCnpj || "", cargo: lead.cargo || "" }}
              />
            </Card>

            <Card title="Reunião" compact>
              {reuniaoAgendada ? (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-primary)" }}>Reunião confirmada com o closer.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma reunião agendada.</p>
                  <button onClick={() => setAgendarAberto(true)} className="self-start flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
                    <Calendar className="w-3.5 h-3.5" /> Agendar reunião
                  </button>
                </div>
              )}
            </Card>
          </div>

          {/* Contato / Empresa / Aquisição — mesma info que já existia
              (Resumo do Lead), reorganizada em 3 cards temáticos. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card title="Contato" action={<button className="text-[11px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Editar</button>}>
              <div className="flex flex-col gap-2.5 text-[13px]">
                <Field label="Telefone" value={lead.telefone || "—"} />
                <Field label="E-mail" value={lead.email || "—"} />
                <Field label="Cargo" value={lead.cargo || "—"} />
              </div>
            </Card>

            <Card title="Empresa" action={lead.empresaId ? <Link href={`/empresas/${lead.empresaId}`} className="text-[11px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Abrir empresa</Link> : undefined}>
              {lead.empresa || empresaDetail ? (
                <div className="flex flex-col gap-2.5 text-[13px]">
                  <Field label="Nome" value={empresaDetail?.nome || lead.empresa || "—"} />
                  <Field label="CNPJ" value={empresaDetail?.cnpj || lead.empresaCnpj || "—"} />
                  <Field label="Segmento" value={empresaDetail?.setor || "—"} />
                  <Field label="Cidade" value={[empresaDetail?.cidade, empresaDetail?.estado].filter(Boolean).join(", ") || "—"} />
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem empresa vinculada ainda.</p>
              )}
            </Card>

            <Card title="Aquisição">
              <div className="flex flex-col gap-2.5 text-[13px]">
                <Field label="Origem" value={origemLabel} />
                <Field label="Campanha" value={lead.utmCampaign || "—"} />
                <Field label="Criativo" value={lead.utmContent || lead.metaAdId || "—"} />
                <Field label="Landing page" value={lead.landingPage || "—"} />
              </div>
            </Card>
          </div>

          {/* Últimas interações — versão compacta (24/08, referência do
              Kauã): mistura whatsapp/ligação/e-mail/nota de verdade, com
              ação direta pra abrir a conversa em Atendimento em vez de só
              descrever o que aconteceu. */}
          <Card title="Últimas interações">
            {feed.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma interação registrada ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {feed.slice(0, 6).map((e) => {
                  const cor = TIPO_COR[e.tipo] || "var(--cf2-text-tertiary)";
                  const abreConversa = e.tipo === "whatsapp" || e.tipo === "email" || e.tipo === "ligacao";
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                      <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 30, height: 30, background: `${cor}18`, color: cor }}>
                        <TipoIcon tipo={e.tipo} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{TIPO_LABEL[e.tipo] || e.tipo}</p>
                        <p className="text-[12px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{e.usuarioNome ? `${e.tipo === "nota" ? "Nota interna" : "Enviada"} por ${e.usuarioNome}` : e.titulo}</p>
                      </div>
                      <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{timeAgoShort(e.createdAt)}</span>
                      {abreConversa && (
                        <Link href={atendimentoHref(e.tipo as "whatsapp" | "email" | "ligacao")} className="text-[12px] font-semibold shrink-0 px-2.5 py-1 rounded-lg" style={{ color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}>
                          {e.tipo === "ligacao" ? "Ver detalhes" : "Abrir conversa"}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--cf2-chrome-bg)", border: "1px solid var(--cf2-chrome-border)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-chrome-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Jornada do lead</p>
            <div className="flex flex-col gap-3">
              {jornada.map((j) => (
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

          <Card
            title="Tarefas"
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

          <Card title="Cadência">
            <Cf2CadenciaCard leadId={leadId} />
          </Card>

          <Card title="Notas internas">
            <textarea value={sidebarNoteText} onChange={(e) => setSidebarNoteText(e.target.value)} placeholder="Digite uma nova anotação interna..." rows={2}
              className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y mb-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && sidebarNoteText.trim()) addNota.mutate(sidebarNoteText.trim()); }} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>⌘+Enter pra salvar</span>
              <button onClick={() => sidebarNoteText.trim() && addNota.mutate(sidebarNoteText.trim())} disabled={!sidebarNoteText.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}><Send className="w-3 h-3" /> Salvar</button>
            </div>
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

function TipoIcon({ tipo }: { tipo: string }) {
  const Icon = TIPO_ICON[tipo] || MoreHorizontal;
  return <Icon className="w-3.5 h-3.5" />;
}

function KpiField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1" style={{ color: "var(--cf2-text-tertiary)" }}><Clock className="w-2.5 h-2.5" /> {label}</span>
      {children}
    </div>
  );
}

function HeaderAction({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const cls = "flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-semibold";
  const style = { background: "rgba(255,255,255,0.08)", color: "var(--cf2-chrome-text-primary)", opacity: disabled ? 0.4 : 1 };
  if (href && !disabled) return <Link href={href} className={cls} style={style}><Icon className="w-3.5 h-3.5" /> {label}</Link>;
  return <button onClick={onClick} disabled={disabled} className={cls} style={style}><Icon className="w-3.5 h-3.5" /> {label}</button>;
}

function Card({ title, action, children, compact = false }: { title: string; action?: React.ReactNode; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-2xl p-4 flex flex-col gap-2" : "rounded-2xl p-5"} style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <div className={compact ? "flex items-center justify-between" : "flex items-center justify-between mb-3.5"}>
        <p className={compact ? "text-[12px] font-bold uppercase tracking-wide" : "text-[15px] font-bold"} style={{ color: compact ? "var(--cf2-text-tertiary)" : "var(--cf2-text-primary)", fontFamily: compact ? undefined : "var(--cf2-font-heading)" }}>{title}</p>
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
        <p className="font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{value}</p>
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
