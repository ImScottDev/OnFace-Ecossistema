"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { CustomFieldsSection } from "@/components/crm/CustomFieldsSection";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import {
  Mail,
  Phone,
  User,
  Linkedin,
  Briefcase,
  Building2,
  Clock,
  StickyNote,
  FileText,
  MessageCircle,
  ArrowRight,
  ChevronRight,
  DollarSign,
  CheckCircle2,
  Circle,
  CalendarDays,
  AlertCircle,
  Plus,
  Send,
} from "lucide-react";
import { getContatoTipoInfo, getNegocioStatusInfo } from "@/lib/crm/pipeline";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

interface LeadDrawerProps {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenEmpresa?: (id: string) => void;
  onOpenNegocio?: (id: string) => void;
}

interface LeadData {
  id: string;
  nome: string;
  sobrenome?: string | null;
  email?: string | null;
  telefone: string;
  cargo?: string | null;
  linkedin?: string | null;
  empresa?: string | null;
  empresaId?: string | null;
  empresaSetor?: string | null;
  empresaPorte?: string | null;
  empresaCidade?: string | null;
  empresaEstado?: string | null;
  status: string;
  tipo: string;
  leadScore: number;
  origem?: string | null;
  mrrEstimado?: string | null;
  valorProjeto?: string | null;
  tipoReceita?: string | null;
  responsavelId?: string | null;
  createdAt: string;
  convertidoAt?: string | null;
  updatedAt: string;
  [key: string]: unknown;
}

interface Negocio {
  id: string;
  titulo: string;
  status: string;
  mrrEstimado?: string | null;
  valorTotal?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

interface Nota {
  id: string;
  conteudo: string;
  autorNome?: string | null;
  createdAt: string;
}

interface Atividade {
  id: string;
  tipo: string;
  titulo?: string | null;
  descricao?: string | null;
  createdAt: string;
  usuarioNome?: string | null;
  usuarioAvatar?: string | null;
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}min atrás`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h atrás`;
  return `${Math.floor(mins / 1440)}d atrás`;
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "rgba(255,255,255,0.2)";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative h-1.5 w-12 rounded-full bg-white/[0.06] overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }}
        />
      </span>
      <span className="text-xs font-bold" style={{ color }}>{score}</span>
    </span>
  );
}

function getActivityIcon(tipo: string) {
  switch (tipo) {
    case "ligacao": return <Phone className="w-3.5 h-3.5 text-blue-400" />;
    case "whatsapp": return <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case "nota": return <StickyNote className="w-3.5 h-3.5 text-yellow-400" />;
    case "proposta_enviada": return <FileText className="w-3.5 h-3.5 text-purple-400" />;
    case "email": return <Mail className="w-3.5 h-3.5 text-cyan-400" />;
    case "reuniao": return <CalendarDays className="w-3.5 h-3.5 text-[#f06d82]" />;
    default: return <Clock className="w-3.5 h-3.5 text-white/30" />;
  }
}

// ─── Priority config ──────────────────────────────────────
const prioridadeConfig: Record<string, { color: string; label: string }> = {
  urgente: { color: "#EF4444", label: "Urgente" },
  alta: { color: "#8e27ef", label: "Alta" },
  media: { color: "#EAB308", label: "Media" },
  baixa: { color: "#6B7280", label: "Baixa" },
};

function TarefaItem({ tarefa, onToggle }: {
  tarefa: { id: string; titulo: string; prioridade: string; dataVencimento?: string | null; concluida: boolean };
  onToggle: (id: string, concluida: boolean) => void;
}) {
  const prio = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;
  const isOverdue = tarefa.dataVencimento && !tarefa.concluida && new Date(tarefa.dataVencimento) < new Date();
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors group">
      <button onClick={() => onToggle(tarefa.id, !tarefa.concluida)} className="mt-0.5 shrink-0">
        {tarefa.concluida
          ? <CheckCircle2 size={14} className="text-emerald-500" />
          : <Circle size={14} className="text-white/20 group-hover:text-white/40" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-tight ${tarefa.concluida ? "line-through text-white/25" : "text-white/70"}`}>{tarefa.titulo}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${prio.color}15`, color: prio.color }}>{prio.label}</span>
          {tarefa.dataVencimento && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-red-400" : "text-white/30"}`}>
              {isOverdue ? <AlertCircle size={9} /> : <CalendarDays size={9} />}
              {new Date(tarefa.dataVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AddNoteInline({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const res = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, leadId }) });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["notas", "lead", leadId] }); setText(""); setOpen(false); },
  });

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.03] rounded-lg transition-colors mt-1.5">
        <Plus size={11} /> Adicionar nota
      </button>
    );
  }
  return (
    <div className="mt-1.5 space-y-1.5">
      <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma nota..." className="w-full text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white/70 placeholder:text-white/20 outline-none focus:border-[#e23752]/30 resize-none" rows={2}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) addNota.mutate(text.trim()); if (e.key === "Escape") { setOpen(false); setText(""); } }} />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/15">Cmd+Enter para salvar</span>
        <div className="flex gap-1.5">
          <button onClick={() => { setOpen(false); setText(""); }} className="text-[10px] text-white/25 hover:text-white/40 px-2 py-1">Cancelar</button>
          <button onClick={() => text.trim() && addNota.mutate(text.trim())} disabled={!text.trim() || addNota.isPending} className="text-[10px] text-[#e23752] hover:text-[#f06d82] px-2 py-1 disabled:opacity-30 flex items-center gap-1"><Send size={9} /> Salvar</button>
        </div>
      </div>
    </div>
  );
}

export function LeadDrawer({ leadId, open, onClose, onOpenEmpresa, onOpenNegocio }: LeadDrawerProps) {
  const { setores, origens, servicos } = usePipelineConfig();
  const queryClient = useQueryClient();

  // Fetch lead detail (includes negocios, atividades, tarefas, etc.)
  const { data: leadDetail, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error("Lead não encontrado");
      return res.json() as Promise<{
        lead: LeadData & { labels?: Array<{ id: string; nome: string; cor: string }>; contatoId?: string | null };
        empresa?: { id: string; nome: string; setor?: string | null; porte?: string | null; cidade?: string | null; estado?: string | null; cnpj?: string | null } | null;
        negocios: Negocio[];
        atividades: Atividade[];
        statusChanges: Array<Record<string, unknown>>;
        tarefas: Array<{ id: string; titulo: string; prioridade: string; dataVencimento?: string | null; concluida: boolean }>;
        contratos: Array<Record<string, unknown>>;
        propostas: Array<Record<string, unknown>>;
      }>;
    },
    enabled: !!leadId && open,
  });

  // Fetch notes separately
  const { data: notas = [] } = useQuery<Nota[]>({
    queryKey: ["notas", "lead", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/notas?leadId=${leadId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!leadId && open,
  });

  const updateLeadCustomFields = useMutation({
    mutationFn: async (camposCustom: Record<string, unknown>) => {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camposCustom }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead", leadId] }),
  });

  // Usuários (p/ dropdown de responsável)
  const { data: usuariosList = [] } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ["usuarios-ativos"],
    queryFn: async () => {
      const res = await fetch("/api/usuarios");
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : (d.usuarios ?? []);
    },
    enabled: open,
  });

  const setResponsavel = useMutation({
    mutationFn: async (responsavelId: string) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsavelId: responsavelId || null }),
      });
      if (!res.ok) throw new Error("falha ao trocar responsável");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["pre-vendas-leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const res = await fetch(`/api/tarefas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concluida }) });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["lead", leadId] }); },
  });

  const lead = leadDetail?.lead;
  const negocios = leadDetail?.negocios || [];
  const tarefas = (leadDetail?.tarefas || []).filter(t => !t.concluida);
  const atividades = leadDetail?.atividades || [];
  const recentActivities = atividades.slice(0, 4);

  const tipoInfo = lead ? getContatoTipoInfo(lead.tipo) : null;

  const fullName = lead ? [lead.nome, lead.sobrenome].filter(Boolean).join(" ") : "";

  return (
    <DetailDrawer
      open={open && !!leadId}
      onClose={onClose}
      title={fullName || "Lead"}
      subtitle={lead ? [lead.cargo, lead.empresa || leadDetail?.empresa?.nome].filter(Boolean).join(" · ") || undefined : undefined}
      fullPageHref={leadId ? `/leads/${leadId}` : undefined}
    >
      {isLoading && (
        <div className="flex items-center justify-center h-64 text-white/40 text-sm">
          Carregando...
        </div>
      )}

      {lead && (
        <div className="p-5 space-y-5">
          {/* Avatar + Name + Badges */}
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden"
              style={{ backgroundColor: "rgba(167,139,250,0.15)", color: "#e23752" }}
            >
              {(lead.apolloPhotoUrl || lead.avatarUrl) && typeof (lead.apolloPhotoUrl || lead.avatarUrl) === "string" ? (
                <img src={String(lead.apolloPhotoUrl || lead.avatarUrl)} alt={fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                getInitials(fullName)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-white truncate">{fullName}</h3>
              {/* Apollo headline */}
              {lead.apolloHeadline ? (
                <p className="text-xs text-white/40 italic truncate mt-0.5">{lead.apolloHeadline as string}</p>
              ) : null}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Status badge */}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${getNegocioStatusInfo(lead.status).color}15`,
                    color: getNegocioStatusInfo(lead.status).color,
                  }}
                >
                  {getNegocioStatusInfo(lead.status).label}
                </span>
                {/* Tipo badge */}
                {tipoInfo && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{
                      backgroundColor: `${tipoInfo.color}15`,
                      color: tipoInfo.color,
                    }}
                  >
                    {tipoInfo.label}
                  </span>
                )}
                {/* Seniority badge */}
                {lead.apolloSeniority ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/15 text-purple-400 capitalize">
                    {(lead.apolloSeniority as string).replace("_", " ")}
                  </span>
                ) : null}
                {/* Lead Score */}
                {lead.leadScore > 0 && <ScoreBar score={lead.leadScore} />}
                {/* Labels */}
                {lead.labels && lead.labels.length > 0 && lead.labels.map((l) => (
                  <span key={l.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white/90" style={{ backgroundColor: l.cor }}>
                    {l.nome}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">Contato</h4>

            {lead.telefone && (
              <a
                href={`tel:${lead.telefone}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group"
              >
                <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-sm text-white/70 group-hover:text-white truncate">{lead.telefone}</span>
              </a>
            )}

            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-sm text-white/70 group-hover:text-white truncate">{lead.email}</span>
              </a>
            )}

            {lead.cargo && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03]">
                <Briefcase className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <span className="text-sm text-white/50">{lead.cargo}</span>
              </div>
            )}

            {lead.linkedin && (
              <a
                href={lead.linkedin.startsWith("http") ? lead.linkedin : `https://linkedin.com/in/${lead.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group"
              >
                <Linkedin className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                <span className="text-sm text-white/70 group-hover:text-white truncate">LinkedIn</span>
              </a>
            )}

            {/* Apollo location */}
            {(() => {
              const loc = [lead.apolloCity, lead.apolloState, lead.apolloCountry].filter(Boolean).map(String).join(", ");
              if (!loc) return null;
              return (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03]">
                  <svg className="w-3.5 h-3.5 text-white/30 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span className="text-sm text-white/50">{loc}</span>
                </div>
              );
            })()}

            {/* Social links row */}
            {(() => {
              const tw = lead.twitter ? String(lead.twitter) : null;
              const gh = lead.github ? String(lead.github) : null;
              const fb = lead.facebook ? String(lead.facebook) : null;
              if (!tw && !gh && !fb) return null;
              return (
                <div className="flex items-center gap-2 px-3 py-2">
                  {tw && (
                    <a href={tw.startsWith("http") ? tw : `https://twitter.com/${tw}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="Twitter/X">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                  )}
                  {gh && (
                    <a href={gh.startsWith("http") ? gh : `https://github.com/${gh}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="GitHub">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                    </a>
                  )}
                  {fb && (
                    <a href={fb.startsWith("http") ? fb : `https://facebook.com/${fb}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="Facebook">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Empresa Section */}
          {(lead.empresa || lead.empresaId) && (
            <div>
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">Empresa</h4>
              <button
                onClick={() => lead.empresaId && onOpenEmpresa?.(lead.empresaId)}
                disabled={!lead.empresaId || !onOpenEmpresa}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group disabled:cursor-default disabled:hover:bg-white/[0.03]"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(59,130,246,0.1)" }}
                >
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{lead.empresa || leadDetail?.empresa?.nome || "Empresa"}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {[
                      (leadDetail?.empresa?.setor || lead.empresaSetor) ? (setores.find((s) => s.key === (leadDetail?.empresa?.setor || lead.empresaSetor))?.label || leadDetail?.empresa?.setor || lead.empresaSetor) : null,
                      leadDetail?.empresa?.porte || lead.empresaPorte,
                      (leadDetail?.empresa?.cidade || lead.empresaCidade) && (leadDetail?.empresa?.estado || lead.empresaEstado) ? `${leadDetail?.empresa?.cidade || lead.empresaCidade}/${leadDetail?.empresa?.estado || lead.empresaEstado}` : (leadDetail?.empresa?.estado || lead.empresaEstado),
                    ].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {lead.empresaId && onOpenEmpresa && (
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0" />
                )}
              </button>
            </div>
          )}

          {/* Servicos de Interesse */}
          {lead.servicosInteresse && (lead.servicosInteresse as string[]).length > 0 && (
            <div>
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">Interesse</h4>
              <div className="flex flex-wrap gap-1.5">
                {(lead.servicosInteresse as string[]).map((s: string) => (
                  <span key={s} className="px-2.5 py-1 bg-blue-500/15 text-blue-400 rounded-full text-xs">
                    {servicos.find((sv) => sv.key === s)?.label || s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sobre o Projeto (comoConheceu) */}
          {lead.comoConheceu && (
            <div>
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">Sobre o Projeto</h4>
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <p className="text-sm text-white/70 whitespace-pre-wrap">{String(lead.comoConheceu)}</p>
              </div>
            </div>
          )}

          {/* Landing Page */}
          {lead.landingPage && (
            <div>
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider mb-2">Landing Page</h4>
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <a href={String(lead.landingPage)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline break-all">
                  {String(lead.landingPage)}
                </a>
              </div>
            </div>
          )}

          {/* Info Grid: Origem + MRR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.03]">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-wider">Origem</span>
              <p className="text-sm text-white mt-1">
                {origens.find((o) => o.key === lead.origem)?.label || lead.origem || "Direto"}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-white/[0.03]">
              <span className="text-[11px] font-medium text-white/30 uppercase tracking-wider">MRR Estimado</span>
              <p className="text-sm font-semibold mt-1" style={{ color: "#e23752" }}>
                {lead.mrrEstimado
                  ? `R$ ${parseFloat(lead.mrrEstimado).toLocaleString("pt-BR")}`
                  : "—"}
              </p>
              {lead.valorProjeto && (
                <p className="text-xs text-white/30 mt-0.5">
                  Projeto: R$ {parseFloat(lead.valorProjeto).toLocaleString("pt-BR")}
                </p>
              )}
              <p className="text-[11px] text-white/30 mt-1">
                No funil há {Math.max(1, Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000))} {Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000) <= 1 ? "dia" : "dias"}
              </p>
            </div>
          </div>

          {/* Responsavel (settável) */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03]">
            <User className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-white/30">Responsável</span>
              <select
                value={lead.responsavelId ?? ""}
                onChange={(e) => setResponsavel.mutate(e.target.value)}
                className="block w-full bg-transparent text-sm text-white/80 outline-none cursor-pointer -ml-0.5"
              >
                <option value="" className="bg-[#1a1b23]">Sem responsável</option>
                {usuariosList.map((u) => (
                  <option key={u.id} value={u.id} className="bg-[#1a1b23]">{u.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Negocios Section */}
          {negocios.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                  Negócios ({negocios.length})
                </h4>
              </div>
              <div className="space-y-1.5">
                {negocios.slice(0, 5).map((n) => {
                  const statusInfo = getNegocioStatusInfo(n.status);
                  return (
                    <button
                      key={n.id}
                      onClick={() => onOpenNegocio?.(n.id)}
                      disabled={!onOpenNegocio}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group disabled:cursor-default disabled:hover:bg-white/[0.03]"
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: statusInfo.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate">{n.titulo}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px]" style={{ color: statusInfo.color }}>
                            {statusInfo.label}
                          </span>
                          {(n.mrrEstimado || n.valorTotal) && (
                            <span className="text-[11px] text-white/30">
                              R$ {parseFloat(String(n.mrrEstimado || n.valorTotal)).toLocaleString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      {onOpenNegocio && (
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Propostas Section */}
          {leadDetail?.propostas && leadDetail.propostas.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                  Propostas ({leadDetail.propostas.length})
                </h4>
                <Link href={`/propostas/nova?leadId=${leadId}`} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">
                  + Nova
                </Link>
              </div>
              <div className="space-y-1.5">
                {leadDetail.propostas.slice(0, 5).map((p: Record<string, unknown>) => {
                  const statusColors: Record<string, string> = { rascunho: "#6B7280", enviada: "#3B82F6", aceita: "#10B981", recusada: "#EF4444", expirada: "#F59E0B" };
                  const color = statusColors[p.status as string] || "#6B7280";
                  return (
                    <Link
                      key={p.id as string}
                      href={`/propostas/${p.id}`}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-white font-medium font-mono">#P-{String(p.numero).padStart(3, "0")}-v{p.versao as number}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: color + "20", color }}
                        >
                          {p.status as string}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/50">
                        R$ {parseFloat(p.totalGeral as string || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </Link>
                  );
                })}
                {leadDetail.propostas.length > 5 && (
                  <Link href={`/leads/${leadId}`} className="block text-center text-[11px] text-[#e23752] hover:text-[#f06d82] pt-1">
                    +{leadDetail.propostas.length - 5} propostas
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Tarefas Section */}
          {tarefas.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                  Tarefas ({tarefas.length})
                </h4>
              </div>
              <div className="space-y-1.5">
                {tarefas.slice(0, 5).map((t) => (
                  <TarefaItem key={t.id} tarefa={t} onToggle={(id, concluida) => toggleTarefa.mutate({ id, concluida })} />
                ))}
                {tarefas.length > 5 && (
                  <Link href={`/leads/${leadId}`} className="block text-center text-[11px] text-[#e23752] hover:text-[#f06d82] pt-1">
                    +{tarefas.length - 5} tarefas
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Qualificação SDR — campos-chave de pré-vendas */}
          {leadId && (
            <QualificacaoSdrSection
              leadId={leadId}
              camposCustom={lead?.camposCustom as Record<string, unknown> | null | undefined}
              queryKeysToInvalidate={["pre-vendas-leads", "pipeline"]}
            />
          )}

          {/* Custom Fields */}
          <CustomFieldsSection
            entidade="lead"
            valores={lead?.camposCustom as Record<string, unknown> | null | undefined}
            onUpdate={(campos) => updateLeadCustomFields.mutate(campos)}
          />

          {/* Notas Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Notas {notas.length > 0 && `(${notas.length})`}
              </h4>
              {notas.length > 3 && (
                <Link
                  href={`/leads/${leadId}`}
                  className="text-[11px] text-[#e23752] hover:text-[#f06d82] font-medium"
                >
                  Ver todas
                </Link>
              )}
            </div>
            {notas.length > 0 && (
              <div className="space-y-1.5">
                {notas.slice(0, 3).map((nota) => (
                  <div key={nota.id} className="px-3 py-2.5 rounded-lg bg-white/[0.03]">
                    <p className="text-sm text-white/60 line-clamp-2">{nota.conteudo}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {nota.autorNome && (
                        <span className="text-[11px] text-white/30">{nota.autorNome}</span>
                      )}
                      <span className="text-[11px] text-white/20">{timeAgo(nota.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {leadId && <AddNoteInline leadId={leadId} />}
          </div>

          {/* Recent Activities */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Atividades recentes
              </h4>
              {recentActivities.length > 0 && (
                <Link
                  href={`/leads/${leadId}`}
                  className="text-[11px] text-[#e23752] hover:text-[#f06d82] font-medium flex items-center gap-1"
                >
                  Ver tudo <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            {recentActivities.length > 0 ? (
              <div className="space-y-1.5">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03]">
                    <div className="mt-0.5">{getActivityIcon(act.tipo)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-white/70">
                          {act.titulo || act.tipo.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-white/30">{timeAgo(act.createdAt)}</span>
                      </div>
                      {act.descricao && (
                        <p className="text-xs text-white/40 mt-0.5 truncate">{act.descricao}</p>
                      )}
                      {act.usuarioNome && (
                        <p className="text-[10px] text-white/30 mt-0.5 flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {act.usuarioNome}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/20 py-1">Nenhuma atividade registrada</p>
            )}
          </div>

          {/* Dates */}
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs text-white/30">
              <span>Criado em {new Date(lead.createdAt).toLocaleDateString("pt-BR")}</span>
              {lead.convertidoAt && (
                <span>Convertido em {new Date(lead.convertidoAt).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
          </div>

          {/* Full page link */}
          <Link
            href={`/leads/${leadId}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-white/[0.06] text-sm text-white/50 hover:text-white hover:border-white/[0.12] transition-colors"
          >
            Abrir página completa <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </DetailDrawer>
  );
}
