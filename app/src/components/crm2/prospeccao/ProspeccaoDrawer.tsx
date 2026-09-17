"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, Plus, Calendar, ChevronDown, Check, Send, Clock, X } from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import { LigacoesSection } from "@/components/crm/LigacoesSection";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";
import { digitsForDialer } from "@/lib/utils/callface-call";
import { corAvatarEmpresa, iniciaisEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";
import { OwnerPicker } from "./OwnerPicker";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Tabs, Cf2TabsList, Cf2TabsTrigger } from "@/components/crm2/ui/Tabs";
import {
  Cf2DropdownMenu, Cf2DropdownMenuContent, Cf2DropdownMenuItem, Cf2DropdownMenuTrigger,
} from "@/components/crm2/ui/DropdownMenu";
import { Section, PropertyRow } from "@/components/crm2/shared/DrawerSection";
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

  /**
   * Qualificar prospect (01/09, spec do Kauã) — o handoff outbound tem DOIS
   * destinos possíveis e é o usuário que escolhe, não o sistema:
   *
   *  - `pre_vendas`: vira SQL em Pré-vendas (`sdr_status='qualified'`), SEM
   *    criar oportunidade. Alguém ainda vai trabalhar a qualificação.
   *  - `oportunidade`: vai direto pro Pipeline via `converter-oportunidade`,
   *    pulando Pré-vendas — o trabalho de pré-venda já aconteceu aqui dentro.
   *
   * Antes desta data só o 2º caminho existia: o botão dizia "Enviar para
   * Pré-vendas" mas na prática criava oportunidade direto no Pipeline.
   */
  const qualificar = useMutation({
    mutationFn: async (destino: "pre_vendas" | "oportunidade") => {
      if (destino === "pre_vendas") {
        const r = await fetch(`/api/leads/${leadId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdrStatus: "qualified" }),
        });
        if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || "falha"); }
        return { destino };
      }
      const r = await fetch(`/api/leads/${leadId}/converter-oportunidade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ semReuniao: true }) });
      if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || "falha"); }
      return { destino };
    },
    onSuccess: (res) => {
      toast.success(res.destino === "pre_vendas"
        ? "Prospect enviado para Qualificado (SQL) em Pré-vendas."
        : "Oportunidade criada no Pipeline.");
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

  const usuariosArray = useMemo(
    () => Array.from(usuariosById.entries()).map(([id, u]) => ({ id, nome: u.nome })),
    [usuariosById]
  );

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
        <Cf2DropdownMenu open={moveMenuOpen} onOpenChange={setMoveMenuOpen}>
          <Cf2DropdownMenuTrigger asChild>
            <Cf2Button variant="secondary" className="gap-2">
              Mover etapa <ChevronDown className="w-3.5 h-3.5" />
            </Cf2Button>
          </Cf2DropdownMenuTrigger>
          <Cf2DropdownMenuContent align="start" className="min-w-[180px]">
            {MOVE_OPTIONS.map((s) => (
              <Cf2DropdownMenuItem key={s.key} onClick={() => patchLead.mutate({ sdrStatus: s.key })}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
              </Cf2DropdownMenuItem>
            ))}
          </Cf2DropdownMenuContent>
        </Cf2DropdownMenu>
        <Cf2Button variant="ghost" className="font-bold" style={{ color: "var(--cf2-danger-text)" }} onClick={() => patchLead.mutate({ sdrStatus: "disqualified" })}>
          Desqualificar
        </Cf2Button>
      </div>
      <Cf2DropdownMenu>
        <Cf2DropdownMenuTrigger asChild>
          <Cf2Button variant="primary" loading={qualificar.isPending} className="gap-2">
            <Check className="w-4 h-4" /> Qualificar
          </Cf2Button>
        </Cf2DropdownMenuTrigger>
        <Cf2DropdownMenuContent align="end">
          <Cf2DropdownMenuItem
            onClick={() => criteriosFaltando.length > 0
              ? toast.error(`Faltam: ${criteriosFaltando.join(", ")}`)
              : qualificar.mutate("pre_vendas")}
          >
            Enviar para Pré-vendas
          </Cf2DropdownMenuItem>
          <Cf2DropdownMenuItem
            onClick={() => criteriosFaltando.length > 0
              ? toast.error(`Faltam: ${criteriosFaltando.join(", ")}`)
              : qualificar.mutate("oportunidade")}
          >
            Criar oportunidade
          </Cf2DropdownMenuItem>
        </Cf2DropdownMenuContent>
      </Cf2DropdownMenu>
    </div>
  );

  return (
    <>
    <DetailDrawer open={open && !!leadId} onClose={onClose} bare panelBg="#ffffff" width="w-full sm:w-[620px]" footer={footer}>
      {isLoading && <div className="space-y-3 p-6" aria-label="Carregando prospect">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)" }} />)}</div>}
      {isError && <div className="flex flex-col items-center gap-2 p-10 text-center"><p className="text-sm font-bold" style={{ color: "var(--cf2-text-primary)" }}>Não foi possível abrir o prospect</p><p className="text-xs" style={{ color: "var(--cf2-text-tertiary)" }}>Feche o painel e tente novamente.</p></div>}
      {lead && (
        <div className="flex flex-col gap-7 px-6 py-7">
          {/* Header — sem card, título grande solto (padrão Circle: issue-details.tsx
              renderiza <h1> direto no fundo da página, sem moldura). */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--cf2-text-tertiary)" }}>Perfil outbound</p>
                <h1 className="truncate text-[22px] font-semibold leading-tight mt-1" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{fullName}</h1>
                <p className="text-[13px] mt-1" style={{ color: "var(--cf2-text-tertiary)" }}>{[lead.empresa, lead.cargo].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <button onClick={onClose} aria-label="Fechar perfil do prospect" className="rounded-md p-1.5 shrink-0 hover:bg-[var(--cf2-bg-surface-muted)]" style={{ color: "var(--cf2-text-tertiary)" }}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-medium" style={{ color: status.color }}>● {status.label}</span>
              {boardLead?.listaNome && <span className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>· {boardLead.listaNome}</span>}
              {boardLead?.labels?.filter((label) => label.nome.toLowerCase() !== "outbound").slice(0, 3).map((label) => <span key={label.id} className="text-[12px]" style={{ color: label.cor }}>· {label.nome}</span>)}
            </div>
          </div>

          {/* Ações rápidas — logo abaixo do título, sem seção própria (Circle
              coloca reação/anexo direto sob a descrição, mesma ideia). */}
          <div className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              <QuickAction icon={Phone} label="Ligar" href={lead.telefone ? `/atendimento?leadId=${lead.id}&canal=ligacao&telefone=${digitsForDialer(lead.telefone)}` : undefined} />
              <QuickAction icon={MessageCircle} label="WhatsApp" href={lead.telefone ? `/atendimento?leadId=${lead.id}&canal=whatsapp&telefone=${digitsForDialer(lead.telefone)}` : undefined} />
              <QuickAction icon={Mail} label="E-mail" href={lead.email ? `/atendimento?leadId=${lead.id}&canal=email` : undefined} />
              <QuickAction icon={Plus} label="Tarefa" onClick={() => setTarefaModalOpen(true)} />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
                {proximaTarefa ? <>Próxima ação: {proximaTarefa.titulo}, {new Date(proximaTarefa.dataVencimento!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</> : "Sem próxima ação agendada"}
              </p>
            </div>
          </div>

          <Section title="Propriedades">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-sm">
                <OwnerPicker
                  ownerId={boardLead?.responsavelId}
                  ownerName={owner?.nome}
                  usuarios={usuariosArray}
                  onAssign={(userId) => patchLead.mutate({ responsavelId: userId })}
                  size={20}
                  align="start"
                />
                <span style={{ color: "var(--cf2-text-primary)" }}>{owner?.nome || "Sem responsável"}</span>
              </div>
              <PropertyRow label="Telefone" value={lead.telefone || "—"} />
              <PropertyRow label="E-mail" value={lead.email || "—"} />
              <PropertyRow label="Empresa" value={lead.empresa || "—"} />
              <PropertyRow label="Cargo" value={lead.cargo || "—"} />
              <PropertyRow label="Entrou em" value={new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} />
            </div>
          </Section>

          {/* Cadência — Cadence Engine real (lib/cadencia/cadence-engine.ts), 1º consumidor sendo Prospecção */}
          <Section
            title="Follow-up"
            action={cadencia && ["active", "waiting"].includes(cadencia.status) ? { label: "Pausar", onClick: () => pausar.mutate() } : undefined}
          >
            {cadencia ? (
              <div className="flex flex-col gap-2 text-[13px]">
                <PropertyRow label="Follow-up atual" value={cadencia.definitionNome} />
                <PropertyRow label="Etapa atual" value={`${cadencia.stepIndex} de ${cadencia.totalSteps}`} />
                <PropertyRow label="Status" value={cadencia.status} />
                {cadencia.proximaAcaoEm && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" style={{ color: "var(--cf2-text-tertiary)" }} />
                    <span style={{ color: "var(--cf2-text-secondary)" }}>Próximo toque: {new Date(cadencia.proximaAcaoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select value={enrollSelect} onChange={(e) => setEnrollSelect(e.target.value)} className="flex-1 px-3 py-1.5 rounded-[var(--cf2-radius-sm)] text-[12px] outline-none" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
                  <option value="">Sem follow-up ativo — selecionar...</option>
                  {cadencias.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.totalSteps} toques)</option>)}
                </select>
                <Cf2Button size="sm" onClick={() => enrollSelect && enroll.mutate(enrollSelect)} disabled={!enrollSelect} loading={enroll.isPending}>Adicionar</Cf2Button>
              </div>
            )}
          </Section>

          <Section title="Prontidão para o handoff" description="Dados que acompanham o prospect ao entrar em Qualificado de Pré-vendas.">
            <QualificacaoSdrSection leadId={leadId!} camposCustom={lead.camposCustom} variant="light" queryKeysToInvalidate={["prospeccao-board"]} prefill={{ cnpj: detail?.empresa?.cnpj || lead.empresaCnpj || "", cargo: lead.cargo || "" }} />
          </Section>

          <Section title="Timeline unificada">
            <div className="flex flex-col gap-3">
              <Cf2Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
                <Cf2TabsList className="w-full flex-wrap justify-start overflow-x-auto">
                  {TABS.map((t) => (
                    <Cf2TabsTrigger key={t} value={t} className="whitespace-nowrap">{t}</Cf2TabsTrigger>
                  ))}
                </Cf2TabsList>
              </Cf2Tabs>
              {tab === "Ligações" ? (
                <LigacoesSection leadId={leadId!} enviarDiscagem />
              ) : tab === "Tarefas" ? (
                tarefasAbertas.length > 0 ? (
                  <div className="flex flex-col border-t" style={{ borderColor: "var(--cf2-border-default)" }}>
                    {tarefasAbertas.map((t) => (
                      <div key={t.id} className="flex items-center gap-2.5 h-10 border-b" style={{ borderColor: "var(--cf2-border-default)" }}>
                        <button onClick={() => toggleTarefa.mutate({ id: t.id, concluida: true })} className="w-3.5 h-3.5 rounded-full shrink-0" style={{ border: "1px solid var(--cf2-border-default)" }} />
                        <p className="flex-1 text-[13px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{t.titulo}</p>
                        {t.dataVencimento && <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(t.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma tarefa em aberto.</p>
                )
              ) : (
                <div className="flex flex-col">
                  {feedFiltrado.length === 0 && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nada por aqui ainda.</p>}
                  {feedFiltrado.map((e) => (
                    <div key={e.id} className="flex flex-col gap-1.5 py-3 border-b" style={{ borderColor: "var(--cf2-border-default)" }}>
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center rounded-full text-[10px] font-bold shrink-0" style={{ width: 22, height: 22, background: corAvatarEmpresa(e.usuarioNome || e.id), color: TEXTO_SOBRE_AVATAR }}>{iniciaisEmpresa(e.usuarioNome || "?")}</span>
                        <p className="flex-1 min-w-0 text-[12px] font-medium" style={{ color: "var(--cf2-text-primary)" }}>{timeAgoShort(e.createdAt)} atrás</p>
                        <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{TIPO_LABEL[e.tipo] || e.tipo}</span>
                      </div>
                      <p className="text-[13px] pl-[30px]" style={{ color: "var(--cf2-text-primary)" }}>{e.usuarioNome ? `${e.usuarioNome} — ` : ""}{e.titulo}</p>
                    </div>
                  ))}
                  {tab === "Notas" && (
                    <div className="pt-3">
                      {noteOpen ? (
                        <div className="flex flex-col gap-1.5">
                          <textarea ref={noteRef} value={noteText} onChange={(ev) => setNoteText(ev.target.value)} placeholder="Escreva uma nota..." aria-label="Escreva uma nota" rows={3} className="w-full text-[13px] rounded-[var(--cf2-radius-sm)] px-3 py-2 outline-none resize-y" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && noteText.trim()) addNota.mutate(noteText.trim()); if (ev.key === "Escape") { setNoteOpen(false); setNoteText(""); } }} />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setNoteOpen(false); setNoteText(""); }} className="text-[12px] px-2 py-1" style={{ color: "var(--cf2-text-tertiary)" }}>Cancelar</button>
                            <button onClick={() => noteText.trim() && addNota.mutate(noteText.trim())} disabled={!noteText.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}><Send className="w-3 h-3" /> Salvar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1.5 text-[12px] hover:text-[var(--cf2-text-primary)]" style={{ color: "var(--cf2-text-tertiary)" }}><Plus className="w-3.5 h-3.5" /> Adicionar nota</button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>
        </div>
      )}
    </DetailDrawer>
    {leadId && <TarefaFormModal open={tarefaModalOpen} onClose={() => setTarefaModalOpen(false)} defaultLeadId={leadId} defaultLeadLabel={fullName || null} invalidateKeys={[["lead", leadId], ["tarefas"]]} />}
    </>
  );
}

function QuickAction({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const cls = "flex-1 flex items-center justify-center gap-1.5 h-10 rounded-[var(--cf2-radius-md)] text-[13px] font-semibold transition-colors";
  const style = { border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)", opacity: disabled ? 0.4 : 1 };
  // Navegação INTERNA pro Atendimento (não abre fora do CRM) — requisito
  // original do Kauã, mesmo padrão já usado no drawer de Pré-vendas
  // (qualificacao/Workspace.tsx): /atendimento?leadId=X&canal=Y&telefone=Z.
  if (href && !disabled) return <Link href={href} className={`${cls} hover:bg-[var(--cf2-bg-surface-muted)]`} style={style}><Icon className="w-4 h-4" /> {label}</Link>;
  return <button onClick={onClick} disabled={disabled} className={`${cls} hover:bg-[var(--cf2-bg-surface-muted)]`} style={style}><Icon className="w-4 h-4" /> {label}</button>;
}

