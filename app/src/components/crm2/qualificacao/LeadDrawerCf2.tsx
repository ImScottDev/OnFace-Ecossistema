"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, Plus, Calendar, ChevronDown, ArrowRight, Check, Send, Briefcase } from "lucide-react";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import { LigacoesSection } from "@/components/crm/LigacoesSection";
import { TarefaFormModal } from "@/components/crm/tarefas/TarefaFormModal";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { SDR_STAGES } from "@/lib/crm/pipeline";
import { stageAge, resolveDisplayStage, resolveContextoCliente, type Lead as KanbanLead } from "./shared";
import type { OrgUsuario } from "@/components/crm/BoardFilters";
import { AssignOwnerControl } from "@/components/crm2/shared/AssignOwnerControl";

interface Negocio { id: string; titulo: string; status: string; createdAt: string }
interface Atividade { id: string; tipo: string; titulo?: string | null; descricao?: string | null; createdAt: string; usuarioNome?: string | null }
interface Nota { id: string; conteudo: string; autorNome?: string | null; createdAt: string }
interface Tarefa { id: string; titulo: string; prioridade: string; dataVencimento?: string | null; concluida: boolean }

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

const TIPO_LABEL: Record<string, string> = { ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", nota: "Nota", reuniao: "Reunião", proposta_enviada: "Proposta" };
const EMPTY_USUARIOS = new Map<string, OrgUsuario>();

/**
 * Drawer novo de lead (Figma node 230:8825, 17/08) — substitui o LeadDrawer
 * legado (dark, `(crm)`) SÓ no board de Pré-vendas do CRM2. Reaproveita 100%
 * da lógica real que já existia: fetch `/api/leads/:id` (mesma query key
 * `["lead", leadId]` do drawer legado, cache compartilhado), `/api/notas`,
 * `QualificacaoSdrSection` (campos CNPJ/Cargo/Necessidade-Dor/Tomador de
 * decisão, De/Para pedido pelo Kauã 17/08 — substituiu o conjunto antigo),
 * `LigacoesSection` (histórico real de ligação com gravação/transcrição/IA) e
 * `TarefaFormModal`. Mover etapa/Qualificar/Desqualificar chamam `onMove`,
 * a MESMA função (`handleMove`) que os cards do Kanban já usam — nenhuma
 * regra de negócio nova.
 */
export function Cf2LeadDrawer({
  leadId, open, onClose, onOpenEmpresa, onOpenNegocio, onMove, usuariosById = EMPTY_USUARIOS,
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
}) {
  const qc = useQueryClient();
  const { origens } = usePipelineConfig();
  const [tab, setTab] = useState<Tab>("Tudo");
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
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

  const feed = [
    ...atividades.filter((a) => a.tipo !== "ligacao").map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo || TIPO_LABEL[a.tipo] || a.tipo, sub: a.descricao || undefined, createdAt: a.createdAt, usuarioNome: a.usuarioNome })),
    ...notas.map((n) => ({ id: `nota-${n.id}`, tipo: "nota", titulo: n.conteudo, sub: undefined, createdAt: n.createdAt, usuarioNome: n.autorNome })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const feedFiltrado = tab === "Tudo" ? feed
    : tab === "WhatsApp" ? feed.filter((e) => e.tipo === "whatsapp")
    : tab === "E-mails" ? feed.filter((e) => e.tipo === "email")
    : tab === "Notas" ? feed.filter((e) => e.tipo === "nota")
    : [];

  const footer = lead && onMove && (
    <div className="p-3 flex items-center justify-between" style={{ background: "var(--cf2-bg-surface)", borderTop: "1px solid var(--cf2-border-default)" }}>
      <div className="flex items-center gap-3 relative">
        <button onClick={() => setMoveMenuOpen((v) => !v)} className="flex items-center gap-2 h-10 px-3 rounded-xl text-[13px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>
          <ArrowRight className="w-4 h-4" /> Mover etapa <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {moveMenuOpen && (
          <div className="absolute bottom-12 left-0 min-w-[180px] rounded-xl py-1 z-10" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 8px 16px rgba(15,23,42,0.12)" }}>
            {SDR_STAGES.map((s) => (
              <button key={s.key} onClick={() => { onMove(leadId!, s.key); setMoveMenuOpen(false); }} className="w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2" style={{ color: "var(--cf2-text-primary)" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => onMove(leadId!, "disqualified")} className="text-[13px] font-bold" style={{ color: "#dc2626" }}>Desqualificar</button>
      </div>
      <button onClick={() => onMove(leadId!, "qualified")} className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
        <Check className="w-4 h-4" /> Qualificar lead →
      </button>
    </div>
  );

  return (
    <>
    <DetailDrawer open={open && !!leadId} onClose={onClose} bare panelBg="#ffffff" width="w-full sm:w-[500px]" footer={footer}>
      {isLoading && <div className="p-6 text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</div>}
      {lead && (
        <div className="flex flex-col gap-4 p-5">
          {/* header */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{fullName}</p>
                {typeof lead.leadScore === "number" && lead.leadScore > 0 && (
                  <span className="flex items-center justify-center rounded-full text-[12px] font-extrabold shrink-0" style={{ width: 28, height: 28, background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{lead.leadScore}</span>
                )}
              </div>
              <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>{[lead.empresa, lead.cargo].filter(Boolean).join(" · ") || "—"}</p>
              {/* Contexto atual (cliente/oportunidade) é sempre o badge PRIMÁRIO —
                  correção 19/08: o estágio de SDR é processo histórico, nunca a
                  identidade atual da pessoa (ex: cliente ativo com um Lead antigo
                  "Desqualificado" não pode aparecer como se estivesse desqualificado). */}
              {contextoCliente && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-[12px] font-bold" style={{ background: contextoCliente.bg, color: contextoCliente.color }}>{contextoCliente.label}</span>
                  {lead.negocioPrincipal && !["ganho", "perdido"].includes(lead.negocioPrincipal.status) && (
                    <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>Oportunidade aberta</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2.5">
                {contextoCliente ? (
                  <span className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Lead histórico: {stage.label}</span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: `${stage.color}18`, color: stage.color }}>{stage.label}</span>
                )}
                {age && !contextoCliente && <span className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Tempo na etapa: {age.text}</span>}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center rounded-full text-[11px] font-extrabold shrink-0" style={{ width: 28, height: 28, background: "var(--cf2-text-tertiary)", color: "var(--cf2-text-on-accent)" }}>{initials(owner?.nome)}</span>
                <span className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{owner?.nome || "Sem responsável"}</span>
              </div>
              <a href={`/contatos/${leadId}`} className="text-[12px] font-semibold" style={{ color: "var(--cf2-success-text)" }}>Abrir página completa →</a>
            </div>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>{[origemLabel, lead.utmCampaign].filter(Boolean).join(" · ")}</p>
          </div>

          {/* ações rápidas */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Ações rápidas</p>
            <div className="flex gap-2">
              <QuickAction icon={Phone} label="Ligar" href={lead.telefone ? callfaceCallUrl(lead.telefone) : undefined} />
              <QuickAction icon={MessageCircle} label="WhatsApp" href={lead.telefone ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : undefined} />
              <QuickAction icon={Mail} label="E-mail" href={lead.email ? `mailto:${lead.email}` : undefined} />
              <QuickAction icon={Plus} label="Tarefa" onClick={() => setTarefaModalOpen(true)} />
              <QuickAction icon={Briefcase} label="Oportunidade" href={`/negocios/novo?leadId=${leadId}`} />
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

          {/* resumo do lead */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Resumo do lead</p>
            <div className="flex flex-col gap-2.5 text-[12px]">
              <KV label="Telefone" value={lead.telefone || "—"} />
              <KV label="E-mail" value={lead.email || "—"} />
              <KV label="Empresa" value={lead.empresa || "—"} onClick={lead.empresaId ? () => onOpenEmpresa?.(lead.empresaId!) : undefined} />
              <KV label="Cargo" value={lead.cargo || "—"} />
              <KV label="Origem" value={origemLabel} />
              <KV label="Campanha" value={lead.utmCampaign || "—"} />
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--cf2-text-tertiary)" }}>Responsável</span>
                <AssignOwnerControl
                  entityType="lead"
                  entityId={leadId!}
                  currentOwnerId={lead.responsavelId}
                  usuarios={Array.from(usuariosById.values())}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["lead", leadId] })}
                />
              </div>
              <KV label="Data de entrada" value={new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} />
            </div>
          </div>

          {/* qualificação SDR — CNPJ/Cargo/Necessidade-Dor/Tomador de decisão */}
          <div className="p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            {leadId && (
              <QualificacaoSdrSection
                leadId={leadId}
                camposCustom={lead.camposCustom}
                variant="light"
                queryKeysToInvalidate={["pre-vendas-leads"]}
                prefill={{ cnpj: detail?.empresa?.cnpj || lead.empresaCnpj || "", cargo: lead.cargo || "" }}
              />
            )}
          </div>

          {/* negócios vinculados */}
          {detail && detail.negocios.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Negócios ({detail.negocios.length})</p>
              {detail.negocios.slice(0, 5).map((n) => (
                <button key={n.id} onClick={() => onOpenNegocio?.(n.id)} disabled={!onOpenNegocio} className="text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2" style={{ border: "1px solid var(--cf2-border-default)" }}>
                  <span className="text-[13px] truncate" style={{ color: "var(--cf2-text-primary)" }}>{n.titulo}</span>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{n.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* timeline unificada */}
          <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: "var(--cf2-bg-canvas)", border: "1px solid var(--cf2-border-default)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Timeline unificada</p>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0" style={{ background: tab === t ? "var(--cf2-text-primary)" : "var(--cf2-bg-surface)", color: tab === t ? "#ffffff" : "var(--cf2-text-secondary)", border: tab === t ? "none" : "1px solid var(--cf2-border-default)" }}>
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
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{timeAgoShort(e.createdAt)} atrás</p>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[11px] font-bold shrink-0" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{TIPO_LABEL[e.tipo] || e.tipo}</span>
                    </div>
                    <p className="text-[13px]" style={{ color: "var(--cf2-text-primary)" }}>{e.usuarioNome ? `${e.usuarioNome} — ` : ""}{e.titulo}</p>
                  </div>
                ))}
                {tab === "Notas" && (
                  <div className="pt-1">
                    {noteOpen ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea ref={noteRef} value={noteText} onChange={(ev) => setNoteText(ev.target.value)} placeholder="Escreva uma nota..." rows={3}
                          className="w-full text-[13px] rounded-lg px-3 py-2 outline-none resize-y" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
                          onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey) && noteText.trim()) addNota.mutate(noteText.trim()); if (ev.key === "Escape") { setNoteOpen(false); setNoteText(""); } }} />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setNoteOpen(false); setNoteText(""); }} className="text-[12px] px-2 py-1" style={{ color: "var(--cf2-text-tertiary)" }}>Cancelar</button>
                          <button onClick={() => noteText.trim() && addNota.mutate(noteText.trim())} disabled={!noteText.trim() || addNota.isPending} className="text-[12px] px-2 py-1 flex items-center gap-1 font-semibold disabled:opacity-40" style={{ color: "var(--cf2-success-text)" }}><Send className="w-3 h-3" /> Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setNoteOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] rounded-lg" style={{ color: "var(--cf2-text-tertiary)", border: "1px dashed var(--cf2-border-default)" }}>
                        <Plus className="w-3.5 h-3.5" /> Adicionar nota
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </DetailDrawer>
    {leadId && (
      <TarefaFormModal open={tarefaModalOpen} onClose={() => setTarefaModalOpen(false)} defaultLeadId={leadId} defaultLeadLabel={fullName || null} invalidateKeys={[["lead", leadId], ["tarefas"]]} />
    )}
    </>
  );
}

function QuickAction({ icon: Icon, label, href, onClick }: { icon: typeof Phone; label: string; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const cls = "flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-[13px] font-semibold";
  const style = { border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)", opacity: disabled ? 0.4 : 1 };
  if (href && !disabled) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
        <Icon className="w-4 h-4" /> {label}
      </a>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls} style={style}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function KV({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--cf2-text-tertiary)" }}>{label}</span>
      {onClick ? (
        <button onClick={onClick} className="font-semibold underline truncate max-w-[220px]" style={{ color: "var(--cf2-text-primary)" }}>{value}</button>
      ) : (
        <span className="font-semibold truncate max-w-[220px]" style={{ color: "var(--cf2-text-primary)" }}>{value}</span>
      )}
    </div>
  );
}
