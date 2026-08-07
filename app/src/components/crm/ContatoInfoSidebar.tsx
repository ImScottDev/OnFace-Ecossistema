"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Briefcase, Target, ExternalLink, Pencil,
  CheckCircle2, Circle, Clock, StickyNote, Plus, Send,
  Phone, Mail, ChevronRight, CalendarDays, AlertCircle,
  User, ArrowRight, DollarSign,
} from "lucide-react";
import { getNegocioStatusInfo } from "../../lib/crm/pipeline";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import type { ContatoData } from "./ContatoActionBar";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface ContatoInfoSidebarProps {
  contato: ContatoData & { avatarUrl?: string | null };
}

// ─── Helpers ──────────────────────────────────────────────
function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}min atrás`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h atrás`;
  return `${Math.floor(mins / 1440)}d atrás`;
}

const prioridadeConfig: Record<string, { color: string; label: string }> = {
  urgente: { color: "#EF4444", label: "Urgente" },
  alta: { color: "#8e27ef", label: "Alta" },
  media: { color: "#EAB308", label: "Media" },
  baixa: { color: "#6B7280", label: "Baixa" },
};

// ─── Tarefa Item ───────────────────────────────────────────
function TarefaItem({ tarefa, onToggle }: {
  tarefa: { id: string; titulo: string; tipo: string; prioridade: string; dataVencimento?: string | null; concluida: boolean };
  onToggle: (id: string, concluida: boolean) => void;
}) {
  const prio = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;
  const isOverdue = tarefa.dataVencimento && !tarefa.concluida && new Date(tarefa.dataVencimento) < new Date();

  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors group">
      <button onClick={() => onToggle(tarefa.id, !tarefa.concluida)} className="mt-0.5 shrink-0">
        {tarefa.concluida
          ? <CheckCircle2 size={14} className="text-emerald-500" />
          : <Circle size={14} className="text-white/20 group-hover:text-white/40" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-tight ${tarefa.concluida ? "line-through text-white/25" : "text-white/70"}`}>
          {tarefa.titulo}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${prio.color}15`, color: prio.color }}>
            {prio.label}
          </span>
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

// ─── Add Note Inline ───────────────────────────────────────
function AddNoteInline({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const res = await fetch("/api/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo, leadId }),
      });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-notas", leadId] });
      setText("");
      setOpen(false);
    },
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.03] rounded-lg transition-colors mt-1.5"
      >
        <Plus size={11} /> Adicionar nota
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva uma nota..."
        className="w-full text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white/70 placeholder:text-white/20 outline-none focus:border-[#e23752]/30 resize-y"
        rows={4}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) addNota.mutate(text.trim());
          if (e.key === "Escape") { setOpen(false); setText(""); }
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/15">Cmd+Enter para salvar</span>
        <div className="flex gap-1.5">
          <button onClick={() => { setOpen(false); setText(""); }} className="text-[10px] text-white/25 hover:text-white/40 px-2 py-1">Cancelar</button>
          <button
            onClick={() => text.trim() && addNota.mutate(text.trim())}
            disabled={!text.trim() || addNota.isPending}
            className="text-[10px] text-[#e23752] hover:text-[#f06d82] px-2 py-1 disabled:opacity-30 flex items-center gap-1"
          >
            <Send size={9} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Sidebar ──────────────────────────────────────────
export function ContatoInfoSidebar({ contato }: ContatoInfoSidebarProps) {
  const { setores, origens } = usePipelineConfig();
  const queryClient = useQueryClient();

  // ─── Data fetching ──────────────────────────────
  const { data: leadData } = useQuery({
    queryKey: ["lead-detail", contato.leadId],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${contato.leadId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!contato.leadId,
    staleTime: 30000,
  });

  const resolvedLead = leadData?.lead ?? leadData;
  const empresaId = resolvedLead?.empresaId || contato.empresaId;

  const { data: empresaData } = useQuery({
    queryKey: ["empresa-detail", empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/empresas/${empresaId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!empresaId,
    staleTime: 30000,
  });

  const { data: negociosData } = useQuery({
    queryKey: ["lead-negocios", contato.leadId],
    queryFn: async () => {
      const res = await fetch(`/api/negocios?leadId=${contato.leadId}&limit=10`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.negocios || data || [];
    },
    enabled: !!contato.leadId,
    staleTime: 30000,
  });

  const { data: tarefasData } = useQuery({
    queryKey: ["lead-tarefas", contato.leadId],
    queryFn: async () => {
      const res = await fetch(`/api/tarefas?leadId=${contato.leadId}&concluida=false`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.tarefas || data || [];
    },
    enabled: !!contato.leadId,
    staleTime: 15000,
  });

  const { data: notasData } = useQuery({
    queryKey: ["lead-notas", contato.leadId],
    queryFn: async () => {
      const res = await fetch(`/api/notas?leadId=${contato.leadId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!contato.leadId,
    staleTime: 15000,
  });

  // Fetch WhatsApp avatar from API (downloads and persists if not cached)
  const { data: waAvatarData } = useQuery<{ url: string }>({
    queryKey: ["whatsapp-avatar", contato.telefone],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/avatar?phone=${encodeURIComponent(contato.telefone!)}`);
      if (!res.ok) return { url: "" };
      return res.json();
    },
    enabled: !!contato.telefone,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const res = await fetch(`/api/tarefas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concluida }),
      });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-tarefas", contato.leadId] });
    },
  });

  // ─── Resolved data ─────────────────────────────
  const lead = leadData?.lead ?? leadData;
  const empresa = empresaData?.empresa ?? empresaData;
  const negocios = negociosData || [];
  const tarefas = tarefasData || [];
  const notas = (notasData || []).slice(0, 5);
  const negocioAtivo = negocios.find((n: { id: string }) => n.id === (lead?.negocioAtivoId || contato.negocioAtivoId));
  const outrosNegocios = negocios.filter((n: { id: string }) => n.id !== (lead?.negocioAtivoId || contato.negocioAtivoId));

  const fullName = lead ? [lead.nome, lead.sobrenome].filter(Boolean).join(" ") : contato.nome;
  const avatarUrl = contato.avatarUrl || lead?.avatarUrl || waAvatarData?.url || "";
  const [avatarError, setAvatarError] = useState(false);
  useEffect(() => { setAvatarError(false); }, [avatarUrl]);
  const origemLabel = lead?.origem ? (origens.find((o) => o.key === lead.origem)?.label || lead.origem) : null;

  return (
    <div className="w-full h-full overflow-y-auto scrollbar-thin" style={{ background: "var(--bg-card, #141519)" }}>
      {/* ─── Hero Section ────────────────────── */}
      <div className="p-5 space-y-3">
        <div className="flex flex-col items-center text-center gap-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden"
            style={{ backgroundColor: "rgba(167,139,250,0.15)", color: "#e23752" }}
          >
            {avatarUrl && !avatarError ? (
              <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" onError={() => setAvatarError(true)} referrerPolicy="no-referrer" />
            ) : (
              getInitials(fullName)
            )}
          </div>
          <div className="min-w-0 w-full">
            <h3 className="text-base font-semibold text-white truncate">{fullName}</h3>
            {(contato.empresaNome || empresa?.nome) && (
              <p className="text-xs text-white/40 truncate mt-0.5">{contato.empresaNome || empresa?.nome}</p>
            )}
          </div>
        </div>

        {/* Quick contact */}
        <div className="space-y-1.5">
          {contato.telefone && (
            <a href={callfaceCallUrl(contato.telefone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group">
              <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-sm text-white/70 group-hover:text-white truncate">{contato.telefone}</span>
            </a>
          )}
          {contato.email && (
            <a href={`mailto:${contato.email}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group">
              <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-sm text-white/70 group-hover:text-white truncate">{contato.email}</span>
            </a>
          )}
        </div>

        {/* Edit lead button */}
        {lead && (
          <Link
            href={`/contatos/${lead.id}`}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-white/[0.06] text-xs text-white/50 hover:text-white hover:border-white/[0.12] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Abrir Lead Completo <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* ─── Lead Info ───────────────────────── */}
      {lead && (
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2.5">Lead</h4>
            <div className="space-y-1.5">
              {lead.cargo && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03]">
                  <Briefcase className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <span className="text-sm text-white/50">{lead.cargo}</span>
                </div>
              )}
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-2.5 rounded-lg bg-white/[0.03]">
                  <p className="text-[10px] text-white/30 uppercase tracking-wide">Tipo</p>
                  <p className="text-xs text-white/70 mt-0.5 capitalize">{lead.tipo || "lead"}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03]">
                  <p className="text-[10px] text-white/30 uppercase tracking-wide">Status</p>
                  <p className="text-xs text-white/70 mt-0.5 capitalize">{lead.status || "—"}</p>
                </div>
                {origemLabel && (
                  <div className="p-2.5 rounded-lg bg-white/[0.03]">
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Origem</p>
                    <p className="text-xs text-white/70 mt-0.5">{origemLabel}</p>
                  </div>
                )}
                {lead.leadScore > 0 && (
                  <div className="p-2.5 rounded-lg bg-white/[0.03]">
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Score</p>
                    <p className="text-xs font-bold mt-0.5" style={{ color: lead.leadScore >= 70 ? "#10B981" : lead.leadScore >= 40 ? "#F59E0B" : "rgba(255,255,255,0.4)" }}>
                      {lead.leadScore}
                    </p>
                  </div>
                )}
                {lead.createdAt && (
                  <div className="p-2.5 rounded-lg bg-white/[0.03]">
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Criado em</p>
                    <p className="text-xs text-white/70 mt-0.5">{new Date(lead.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                )}
              </div>
            </div>
            {lead.labels?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {lead.labels.map((l: { id: string; nome: string; cor: string }) => (
                  <span key={l.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white/90" style={{ backgroundColor: `${l.cor}` }}>
                    {l.nome}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Empresa ─────────────────────────── */}
      {empresa && (
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2.5">Empresa</h4>
            <Link
              href={`/empresas/${empresa.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(59,130,246,0.1)" }}>
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{empresa.nome}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {[
                    empresa.setor ? (setores.find((s) => s.key === empresa.setor)?.label || empresa.setor) : null,
                    empresa.porte,
                    empresa.cidade && empresa.estado ? `${empresa.cidade}/${empresa.estado}` : null,
                  ].filter(Boolean).join(" · ") || empresa.cnpj || "—"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0" />
            </Link>
          </div>
        </div>
      )}

      {/* ─── Negocio Ativo ───────────────────── */}
      {negocioAtivo && (
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2.5">Negocio Ativo</h4>
            <Link
              href={`/negocios/${negocioAtivo.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors group"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: getNegocioStatusInfo(negocioAtivo.status).color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate">{negocioAtivo.titulo}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px]" style={{ color: getNegocioStatusInfo(negocioAtivo.status).color }}>
                    {getNegocioStatusInfo(negocioAtivo.status).label}
                  </span>
                  {negocioAtivo.valorTotal && (
                    <span className="text-[11px] text-white/30">
                      R$ {Number(negocioAtivo.valorTotal).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0" />
            </Link>
          </div>
        </div>
      )}

      {/* ─── Tarefas ─────────────────────────── */}
      {lead && (
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                Tarefas {tarefas.length > 0 && `(${tarefas.length})`}
              </h4>
            </div>
            {tarefas.length > 0 ? (
              <div className="space-y-1.5">
                {tarefas.slice(0, 5).map((t: { id: string; titulo: string; tipo: string; prioridade: string; dataVencimento?: string | null; concluida: boolean }) => (
                  <TarefaItem
                    key={t.id}
                    tarefa={t}
                    onToggle={(id, concluida) => toggleTarefa.mutate({ id, concluida })}
                  />
                ))}
                {tarefas.length > 5 && (
                  <Link href={`/contatos/${lead.id}`} className="block text-center text-[11px] text-[#e23752] hover:text-[#f06d82] pt-1">
                    +{tarefas.length - 5} tarefas
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/20 py-1">Nenhuma tarefa pendente</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Notas ───────────────────────────── */}
      {lead && (
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
                Notas {notas.length > 0 && `(${notas.length})`}
              </h4>
              {notas.length > 3 && (
                <Link href={`/contatos/${lead.id}`} className="text-[11px] text-[#e23752] hover:text-[#f06d82] font-medium">
                  Ver todas
                </Link>
              )}
            </div>
            {notas.length > 0 && (
              <div className="space-y-1.5">
                {notas.slice(0, 3).map((n: { id: string; conteudo: string; autorNome?: string | null; createdAt: string }) => (
                  <div key={n.id} className="px-3 py-2.5 rounded-lg bg-white/[0.03]">
                    <p className="text-sm text-white/60 line-clamp-2 whitespace-pre-wrap">{n.conteudo}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {n.autorNome && <span className="text-[11px] text-white/30">{n.autorNome}</span>}
                      <span className="text-[11px] text-white/20">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <AddNoteInline leadId={lead.id} />
          </div>
        </div>
      )}

      {/* ─── Outros Negocios ─────────────────── */}
      {outrosNegocios.length > 0 && (
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2.5">
              Outros Negocios ({outrosNegocios.length})
            </h4>
            <div className="space-y-1.5">
              {outrosNegocios.map((n: { id: string; titulo: string; status: string; valorTotal?: string }) => (
                <Link
                  key={n.id}
                  href={`/negocios/${n.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getNegocioStatusInfo(n.status).color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{n.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px]" style={{ color: getNegocioStatusInfo(n.status).color }}>
                        {getNegocioStatusInfo(n.status).label}
                      </span>
                      {n.valorTotal && <span className="text-[11px] text-white/30">R$ {Number(n.valorTotal).toLocaleString("pt-BR")}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Empty State ─────────────────────── */}
      {!lead && (
        <div className="px-5 py-8 text-center">
          <div className="w-11 h-11 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
            <User size={20} className="text-white/15" />
          </div>
          <p className="text-xs text-white/25">Nenhum lead vinculado.</p>
          <p className="text-[11px] text-white/15 mt-1">Use a barra acima para criar ou vincular.</p>
        </div>
      )}
    </div>
  );
}
