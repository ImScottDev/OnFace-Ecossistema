"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AddNoteInlineNegocio, TarefasSectionNegocio } from "@/components/crm/NegocioSections";
import { toast } from "sonner";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { Building2, User, FileText, Clock, Pencil, StickyNote, Plus, Send, CalendarClock, Tag, X, Phone, Mail, MessageCircle, ChevronDown, ChevronRight, Video, Users, FileAudio, Trash2, XCircle, Trophy } from "lucide-react";
import { usePipelineConfig, usePipelines } from "@/hooks/usePipelineConfig";
import { STAGNATION_REASONS, DEFAULT_STAGES, DEFAULT_CLOSED_STAGES, type PipelineStage } from "@/lib/crm/pipeline";
import { CustomFieldsSection } from "@/components/crm/CustomFieldsSection";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import { LigacoesSection } from "@/components/crm/LigacoesSection";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import { isCelular } from "@/lib/utils/phone";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

interface NegocioDrawerProps {
  negocioId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenLead?: (id: string) => void;
  onOpenEmpresa?: (id: string) => void;
}

interface LeadItem {
  id: string;
  nome: string;
  email: string | null;
  telefone: string;
  empresa: string | null;
  cargo: string | null;
  papel: string;
}

interface PropostaItem {
  id: string;
  numero: number;
  versao: number;
  status: string;
  totalGeral: string | null;
  totalRecorrente: string | null;
  totalAvulso: string | null;
  createdAt: string;
  itens?: { id: string; nome: string; tipo: string; quantidade: string; valorUnitario: string; subtotal: string }[];
}

interface ReuniaoItem {
  id: string;
  titulo: string;
  data: string;
  duracao: number | null;
  tipo: string;
  status: string;
  participantes: string[] | null;
  notas: string | null;
  transcript: string | null;
  resumoTranscript: string | null;
  responsavelNome: string | null;
  createdAt: string;
}

function TemperaturaBadge({ temp }: { temp: string | null }) {
  if (!temp || temp === "indefinido") return null;
  const config: Record<string, { bg: string; text: string; label: string }> = {
    quente: { bg: "bg-red-500/20", text: "text-red-400", label: "Quente" },
    morno: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Morno" },
    frio: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Frio" },
  };
  const c = config[temp];
  if (!c) return null;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

function AddReuniaoInline({ negocioId }: { negocioId: string }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("call");
  const queryClient = useQueryClient();

  const addReuniao = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/reunioes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId, titulo, data: new Date(data).toISOString(), tipo }),
      });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negocio", negocioId] });
      setTitulo(""); setData(""); setTipo("call"); setOpen(false);
    },
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.03] rounded-lg transition-colors mt-1.5">
        <Plus size={11} /> Nova reuniao
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Titulo da reuniao" className="w-full text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white/70 placeholder:text-white/20 outline-none focus:border-[#e23752]/30" />
      <div className="flex gap-2">
        <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} className="flex-1 text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white/70 outline-none focus:border-[#e23752]/30" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-2 text-white/70 outline-none">
          <option value="call">Call</option>
          <option value="video">Video</option>
          <option value="presencial">Presencial</option>
        </select>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button onClick={() => { setOpen(false); setTitulo(""); setData(""); }} className="text-[10px] text-white/25 hover:text-white/40 px-2 py-1">Cancelar</button>
        <button onClick={() => titulo.trim() && data && addReuniao.mutate()} disabled={!titulo.trim() || !data || addReuniao.isPending} className="text-[10px] text-[#e23752] hover:text-[#f06d82] px-2 py-1 disabled:opacity-30 flex items-center gap-1">
          <Send size={9} /> Agendar
        </button>
      </div>
    </div>
  );
}

export function NegocioDrawer({ negocioId, open, onClose, onOpenLead, onOpenEmpresa }: NegocioDrawerProps) {
  const queryClient = useQueryClient();
  const { getStatusInfo: getGlobalStatusInfo, servicos } = usePipelineConfig();
  const { pipelines } = usePipelines();
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [expandedPropostaId, setExpandedPropostaId] = useState<string | null>(null);
  const [expandedReuniaoId, setExpandedReuniaoId] = useState<string | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["negocio", negocioId],
    queryFn: async () => {
      const res = await fetch(`/api/negocios/${negocioId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!negocioId && open,
  });

  // Fetch labels for this negocio
  const { data: negocioLabels = [] } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["negocio-labels", negocioId],
    queryFn: async () => {
      const res = await fetch(`/api/negocios/${negocioId}/labels`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!negocioId && open,
  });

  // Fetch all available labels for the org
  const { data: allLabels = [] } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const res = await fetch("/api/labels");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showLabelPicker,
  });

  const assignLabel = useMutation({
    mutationFn: async (labelId: string) => {
      await fetch(`/api/negocios/${negocioId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["negocio-labels", negocioId] }),
  });

  const removeLabel = useMutation({
    mutationFn: async (labelId: string) => {
      await fetch(`/api/negocios/${negocioId}/labels`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["negocio-labels", negocioId] }),
  });

  const updateCustomFields = useMutation({
    mutationFn: async (camposCustom: Record<string, unknown>) => {
      await fetch(`/api/negocios/${negocioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camposCustom }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["negocio", negocioId] }),
  });

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
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsavelId: responsavelId || null }),
      });
      if (!res.ok) throw new Error("falha ao trocar responsável");
      return res.json();
    },
    onSuccess: () => {
      // Atualiza o detalhe E os boards (pipeline/pré-vendas) pro card refletir o novo dono.
      queryClient.invalidateQueries({ queryKey: ["negocio", negocioId] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["negocios"] });
      queryClient.invalidateQueries({ queryKey: ["pre-vendas-leads"] });
      toast.success("Responsável atualizado");
    },
    onError: () => toast.error("Não foi possível trocar o responsável"),
  });

  const negocio = data?.negocio;
  const empresa = data?.empresa;
  const lead = data?.lead;
  const allLeads: LeadItem[] = data?.leads || [];
  const propostas: PropostaItem[] = data?.propostas || [];
  const reunioesData: ReuniaoItem[] = data?.reunioes || [];
  const notasData = data?.notas;
  const statusChanges = data?.statusChanges;

  // Resolve status from the deal's specific pipeline, falling back to global config
  const getStatusInfo = (status: string) => {
    if (negocio?.pipelineId) {
      const pipeline = pipelines.find((p) => p.id === negocio.pipelineId);
      if (pipeline) {
        const allStages = [...(pipeline.stages || []), ...(pipeline.closedStages || [])];
        const found = allStages.find((s) => s.key === status);
        if (found) return found;
      }
    }
    return getGlobalStatusInfo(status);
  };
  const stageInfo = negocio ? getStatusInfo(negocio.status) : null;
  const valorTotal = negocio ? parseFloat(negocio.valorTotal || "0") || 0 : 0;
  const assignedLabelIds = new Set(negocioLabels.map((l) => l.id));
  const availableLabels = allLabels.filter((l) => !assignedLabelIds.has(l.id));

  // Auto-expand the main proposta (aceita > enviada > first)
  const mainProposta = propostas.find((p) => p.status === "aceita") || propostas.find((p) => p.status === "enviada") || propostas[0];

  const tipoIcons: Record<string, typeof Phone> = { call: Phone, video: Video, presencial: Users };
  const reuniaoStatusColors: Record<string, string> = { agendada: "#3B82F6", realizada: "#10B981", cancelada: "#EF4444", no_show: "#F59E0B" };

  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const handleDelete = async () => {
    if (isDeleting) return;
    if (!confirm("Tem certeza que deseja excluir este negócio?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/negocios/${negocioId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Negócio excluído");
        queryClient.invalidateQueries({ queryKey: ["pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["negocios"] });
        onClose();
      } else {
        const err = await res.json().catch(() => ({ error: "Erro ao excluir" }));
        toast.error(err.error || "Erro ao excluir");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (status: string, motivoPerda?: string) => {
    if (isChangingStatus) return;
    setIsChangingStatus(true);
    try {
      const body: Record<string, string> = { status };
      if (motivoPerda) body.motivoPerda = motivoPerda;
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("Status atualizado");
        queryClient.invalidateQueries({ queryKey: ["pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["negocio", negocioId] });
        queryClient.invalidateQueries({ queryKey: ["negocio-labels", negocioId] });
        queryClient.invalidateQueries({ queryKey: ["carteira"] });
        queryClient.invalidateQueries({ queryKey: ["negocios-count"] });
      } else {
        const err = await res.json().catch(() => ({ error: "Erro ao atualizar status" }));
        toast.error(err.error || "Erro ao atualizar status");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status");
    } finally {
      setIsChangingStatus(false);
    }
  };

  const labelsHeader = negocio ? (
    <div className="flex items-center gap-1.5 flex-wrap">
      {negocioLabels.map((label) => (
        <span key={label.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: label.cor + "20", color: label.cor }}>
          {label.nome}
          <button onClick={() => removeLabel.mutate(label.id)} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
        </span>
      ))}
      <div className="relative">
        <button onClick={() => setShowLabelPicker(!showLabelPicker)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] text-white/30 hover:text-white/60 border border-dashed border-white/10 hover:border-white/20 transition-colors">
          <Tag className="w-2.5 h-2.5" /> +
        </button>
        {showLabelPicker && availableLabels.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl p-1 min-w-[140px]">
            {availableLabels.map((label) => (
              <button
                key={label.id}
                onClick={() => { assignLabel.mutate(label.id); setShowLabelPicker(false); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/[0.06] rounded-md transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: label.cor }} />
                {label.nome}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : undefined;

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={negocio?.titulo || "Negocio"}
      subtitle={stageInfo ? stageInfo.label : undefined}
      subtitleColor={stageInfo?.color}
      fullPageHref={negocioId ? `/negocios/${negocioId}` : undefined}
      headerExtra={labelsHeader}
    >
      {isLoading ? (
        <div className="p-8 text-white/40 text-center text-sm">Carregando...</div>
      ) : !negocio ? (
        <div className="p-8 text-white/40 text-center text-sm">Negocio nao encontrado</div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Status selector */}
          {negocio && (() => {
            const pipeline = negocio.pipelineId ? pipelines.find((p) => p.id === negocio.pipelineId) : null;
            const pipelineStages = (pipeline?.stages as PipelineStage[] | undefined) ?? DEFAULT_STAGES;
            const pipelineClosed = (pipeline?.closedStages as PipelineStage[] | undefined) ?? DEFAULT_CLOSED_STAGES;
            return (
              <div className="card-solid p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-white/40 font-medium">Status</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: stageInfo?.color || "#6B7280" }}
                    />
                    <select
                      value={negocio.status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        if (newStatus === "perdido") {
                          const motivo = prompt("Motivo da perda:");
                          if (motivo) handleStatusChange(newStatus, motivo);
                          return;
                        }
                        handleStatusChange(newStatus);
                      }}
                      className="flex-1 max-w-[220px] bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1 text-xs text-white/80 outline-none focus:border-[#e23752]/40 cursor-pointer"
                    >
                      <optgroup label="Pipeline">
                        {pipelineStages.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Fechamento">
                        {pipelineClosed.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Estagnado">
                        {STAGNATION_REASONS.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Valor */}
          {valorTotal > 0 && (
            <div className="card-solid p-3.5">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[#e23752]">R$ {valorTotal.toLocaleString("pt-BR")}</span>
                <TemperaturaBadge temp={negocio.temperatura} />
              </div>
              {(negocio.mrrEstimado && parseFloat(negocio.mrrEstimado) > 0 || negocio.valorProjeto && parseFloat(negocio.valorProjeto) > 0) && (
                <div className="flex gap-4 mt-1.5">
                  {negocio.mrrEstimado && parseFloat(negocio.mrrEstimado) > 0 && (
                    <div>
                      <p className="text-[10px] text-white/40">MRR Estimado</p>
                      <p className="text-xs text-white/70">R$ {parseFloat(negocio.mrrEstimado).toLocaleString("pt-BR")}/mes</p>
                    </div>
                  )}
                  {negocio.valorProjeto && parseFloat(negocio.valorProjeto) > 0 && (
                    <div>
                      <p className="text-[10px] text-white/40">Projeto</p>
                      <p className="text-xs text-white/70">R$ {parseFloat(negocio.valorProjeto).toLocaleString("pt-BR")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Previsão de fechamento */}
          {negocio.previsaoFechamento && (() => {
            const d = new Date(negocio.previsaoFechamento + "T12:00:00");
            const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
            const isLate = days < 0;
            const isUrgent = days >= 0 && days <= 7;
            return (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isLate ? "bg-red-500/10 text-red-400" : isUrgent ? "bg-amber-500/10 text-amber-400" : "bg-white/[0.03] text-white/50"}`}>
                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                <span>Previsão: {d.toLocaleDateString("pt-BR")}</span>
                {isLate && <span className="font-medium ml-auto">{Math.abs(days)}d atrasado</span>}
                {isUrgent && <span className="font-medium ml-auto">{days}d restantes</span>}
              </div>
            );
          })()}

          {/* Responsável (closer) */}
          <div className="card-solid p-3.5">
            <h3 className="text-xs font-medium text-white/50 mb-2">Responsável</h3>
            <select
              value={negocio?.responsavelId ?? ""}
              onChange={(e) => setResponsavel.mutate(e.target.value)}
              className="w-full bg-white/[0.04] rounded-lg px-2.5 py-2 text-sm text-white/80 outline-none cursor-pointer border border-white/[0.06]"
            >
              <option value="" className="bg-[#1a1b23]">Sem responsável</option>
              {usuariosList.map((u) => (
                <option key={u.id} value={u.id} className="bg-[#1a1b23]">{u.nome}</option>
              ))}
            </select>
          </div>

          {/* Empresa */}
          {empresa && (
            <div className="card-solid p-3.5">
              <h3 className="text-xs font-medium text-white/50 mb-2">Empresa</h3>
              <button
                onClick={() => onOpenEmpresa?.(empresa.id)}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors -m-1"
              >
                <div className="w-9 h-9 rounded-lg bg-[#e23752]/15 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-[#e23752]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{empresa.nome}</p>
                  {empresa.setor && <p className="text-[10px] text-white/40 capitalize">{empresa.setor}</p>}
                </div>
              </button>
            </div>
          )}

          {/* Servicos de Interesse */}
          {negocio.servicosInteresse && negocio.servicosInteresse.length > 0 && (
            <div className="card-solid p-3.5">
              <h3 className="text-xs font-medium text-white/50 mb-2">Interesse</h3>
              <div className="flex flex-wrap gap-1.5">
                {negocio.servicosInteresse.map((s: string) => (
                  <span key={s} className="px-2.5 py-1 bg-blue-500/15 text-blue-400 rounded-full text-xs">
                    {servicos.find((sv) => sv.key === s)?.label || s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Descricao do projeto */}
          {negocio.descricao && (
            <div className="card-solid p-3.5">
              <h3 className="text-xs font-medium text-white/50 mb-2">Sobre o Projeto</h3>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{negocio.descricao}</p>
            </div>
          )}

          {/* Leads (expandable) */}
          <div className="card-solid p-3.5">
            <h3 className="text-xs font-medium text-white/50 mb-2.5">
              Leads ({allLeads.length || (lead ? 1 : 0)})
            </h3>
            {allLeads.length > 0 ? (
              <div className="space-y-1">
                {allLeads.map((l) => {
                  const isExpanded = expandedLeadId === l.id;
                  return (
                    <div key={l.id} className="rounded-lg hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2.5 p-2">
                        <button
                          onClick={() => setExpandedLeadId(isExpanded ? null : l.id)}
                          className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => onOpenLead?.(l.id)}
                          className="w-7 h-7 rounded-full bg-[#e23752]/20 flex items-center justify-center shrink-0"
                        >
                          <User className="w-3.5 h-3.5 text-[#e23752]" />
                        </button>
                        <button
                          onClick={() => onOpenLead?.(l.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-xs font-medium text-white truncate">{l.nome}</p>
                          <p className="text-[10px] text-white/40 truncate">{l.cargo || l.empresa || l.telefone}</p>
                        </button>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40 capitalize shrink-0">
                          {l.papel}
                        </span>
                      </div>
                      {/* Expanded lead details */}
                      {isExpanded && (
                        <div className="pl-[52px] pr-2 pb-2.5 space-y-1.5">
                          {l.cargo && (
                            <p className="text-[10px] text-white/50">{l.cargo}</p>
                          )}
                          {l.email && (
                            <a href={`mailto:${l.email}`} className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors">
                              <Mail className="w-3 h-3" /> {l.email}
                            </a>
                          )}
                          {l.telefone && (
                            <div className="flex items-center gap-2">
                              <a href={callfaceCallUrl(l.telefone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                                <Phone className="w-3 h-3" /> {l.telefone}
                              </a>
                              {isCelular(l.telefone) && (
                                <Link
                                  href={`/whatsapp?lead=${l.id}`}
                                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                                >
                                  <MessageCircle className="w-3 h-3" /> WhatsApp
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : lead ? (
              <div className="rounded-lg hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2.5 p-2">
                  <button
                    onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                    className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {expandedLeadId === lead.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => onOpenLead?.(lead.id)}
                    className="w-7 h-7 rounded-full bg-[#e23752]/20 flex items-center justify-center shrink-0"
                  >
                    <User className="w-3.5 h-3.5 text-[#e23752]" />
                  </button>
                  <button onClick={() => onOpenLead?.(lead.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium text-white truncate">{lead.nome}</p>
                    <p className="text-[10px] text-white/40 truncate">{lead.empresa || lead.telefone}</p>
                  </button>
                </div>
                {expandedLeadId === lead.id && (
                  <div className="pl-[52px] pr-2 pb-2.5 space-y-1.5">
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors">
                        <Mail className="w-3 h-3" /> {lead.email}
                      </a>
                    )}
                    {lead.telefone && (
                      <div className="flex items-center gap-2">
                        <a href={callfaceCallUrl(lead.telefone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                          <Phone className="w-3 h-3" /> {lead.telefone}
                        </a>
                        {isCelular(lead.telefone) && (
                          <Link href={`/whatsapp?leadId=${lead.id}`} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/30 py-2 text-center">Nenhum lead vinculado</p>
            )}
          </div>

          {/* Propostas (with expandable items) */}
          <div className="card-solid p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-medium text-white/50">
                <FileText className="w-3 h-3 inline mr-1" />
                Propostas ({propostas.length})
              </h3>
              {negocioId && (
                <Link href={`/propostas/nova?negocioId=${negocioId}`} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">
                  + Nova
                </Link>
              )}
            </div>
            {propostas.length > 0 ? (
              <div className="space-y-1.5">
                {propostas.map((p) => {
                  const statusColors: Record<string, string> = { rascunho: "#6B7280", enviada: "#3B82F6", aceita: "#10B981", recusada: "#EF4444", expirada: "#F59E0B" };
                  const color = statusColors[p.status] || "#6B7280";
                  const isExpanded = expandedPropostaId === p.id || (expandedPropostaId === null && mainProposta?.id === p.id);
                  const hasItens = p.itens && p.itens.length > 0;
                  return (
                    <div key={p.id} className="rounded-lg">
                      <div
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
                        onClick={() => setExpandedPropostaId(isExpanded ? "__none__" : p.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          {hasItens && (isExpanded ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />)}
                          <span className="text-xs text-white font-medium font-mono">#P-{String(p.numero).padStart(3, "0")}-v{p.versao}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: color + "20", color }}
                          >
                            {p.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/50">
                          R$ {parseFloat(p.totalGeral || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {/* Expanded proposta items */}
                      {isExpanded && hasItens && (
                        <div className="px-2 pb-2">
                          <div className="bg-white/[0.02] rounded-lg p-2 space-y-1">
                            {p.itens!.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-[10px]">
                                <span className="text-white/60 truncate flex-1">{item.nome}</span>
                                <span className="text-white/40 ml-2 shrink-0">
                                  {parseFloat(item.quantidade) > 1 ? `${parseFloat(item.quantidade)}x ` : ""}
                                  R$ {parseFloat(item.subtotal || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-white/[0.06] pt-1 mt-1 flex items-center justify-between text-[10px]">
                              {parseFloat(p.totalRecorrente || "0") > 0 && (
                                <span className="text-white/40">Rec: R$ {parseFloat(p.totalRecorrente!).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/m</span>
                              )}
                              {parseFloat(p.totalAvulso || "0") > 0 && (
                                <span className="text-white/40">Avulso: R$ {parseFloat(p.totalAvulso!).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              )}
                              <span className="text-white font-medium ml-auto">
                                Total: R$ {parseFloat(p.totalGeral || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                          <Link href={`/propostas/${p.id}`} className="block text-[10px] text-purple-400 hover:text-purple-300 text-center mt-1.5 transition-colors">
                            Ver proposta completa
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/30 py-2 text-center">Nenhuma proposta</p>
            )}
          </div>

          {/* Reuniões */}
          <div className="card-solid p-3.5">
            <h3 className="text-xs font-medium text-white/50 mb-2.5">
              <Video className="w-3 h-3 inline mr-1" />
              Reunioes ({reunioesData.length})
            </h3>
            {reunioesData.length > 0 ? (
              <div className="space-y-1.5">
                {reunioesData.map((r) => {
                  const TipoIcon = tipoIcons[r.tipo] || Phone;
                  const statusColor = reuniaoStatusColors[r.status] || "#6B7280";
                  const isExpanded = expandedReuniaoId === r.id;
                  const hasTranscript = !!r.transcript || !!r.resumoTranscript;
                  return (
                    <div key={r.id} className="rounded-lg">
                      <div
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
                        onClick={() => setExpandedReuniaoId(isExpanded ? null : r.id)}
                      >
                        <TipoIcon className="w-3.5 h-3.5 shrink-0" style={{ color: statusColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate">{r.titulo}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/40">
                              {new Date(r.data).toLocaleDateString("pt-BR")} {new Date(r.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {r.duracao && <span className="text-[10px] text-white/30">{r.duracao}min</span>}
                          </div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: statusColor + "20", color: statusColor }}>
                          {r.status}
                        </span>
                        {hasTranscript && <FileAudio className="w-3 h-3 text-emerald-400/60 shrink-0" />}
                      </div>
                      {/* Expanded reunião */}
                      {isExpanded && (
                        <div className="px-2 pb-2 space-y-2">
                          {r.notas && (
                            <div className="bg-white/[0.02] rounded-lg p-2">
                              <p className="text-[10px] text-white/40 mb-0.5">Notas</p>
                              <p className="text-xs text-white/70 whitespace-pre-wrap">{r.notas}</p>
                            </div>
                          )}
                          {r.resumoTranscript && (
                            <div className="bg-emerald-500/5 rounded-lg p-2 border border-emerald-500/10">
                              <p className="text-[10px] text-emerald-400/70 mb-0.5">Resumo da reuniao</p>
                              <p className="text-xs text-white/70 whitespace-pre-wrap">{r.resumoTranscript}</p>
                            </div>
                          )}
                          {r.transcript && (
                            <div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowFullTranscript(showFullTranscript === r.id ? null : r.id); }}
                                className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                              >
                                {showFullTranscript === r.id ? "Ocultar transcript" : "Ver transcript completo"}
                              </button>
                              {showFullTranscript === r.id && (
                                <div className="mt-1.5 bg-white/[0.02] rounded-lg p-2 max-h-[200px] overflow-y-auto">
                                  <p className="text-[10px] text-white/60 whitespace-pre-wrap font-mono leading-relaxed">{r.transcript}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {r.participantes && r.participantes.length > 0 && (
                            <p className="text-[10px] text-white/30">Participantes: {r.participantes.join(", ")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/30 py-2 text-center">Nenhuma reuniao agendada</p>
            )}
            {negocioId && <AddReuniaoInline negocioId={negocioId} />}
          </div>

          {/* Ligações (telefonia Callface) — sempre visível */}
          {negocioId && (
            <div className="card-solid p-3.5">
              <LigacoesSection negocioId={negocioId} />
            </div>
          )}

          {/* Qualificação SDR (herdada do lead, vem da pré-vendas) */}
          {lead?.id && (
            <div className="card-solid p-3.5">
              <QualificacaoSdrSection
                leadId={lead.id}
                camposCustom={(lead as Record<string, unknown>).camposCustom as Record<string, unknown> | null | undefined}
                readOnly
              />
            </div>
          )}

          {/* Custom Fields */}
          <div className="card-solid p-3.5">
            <CustomFieldsSection
              entidade="negocio"
              valores={negocio.camposCustom as Record<string, unknown> | null | undefined}
              onUpdate={(campos) => updateCustomFields.mutate(campos)}
            />
          </div>

          {/* Notas */}
          <div className="card-solid p-3.5">
            <h3 className="text-xs font-medium text-white/50 mb-2.5">
              <StickyNote className="w-3 h-3 inline mr-1" />
              Notas {notasData && notasData.length > 0 && `(${notasData.length})`}
            </h3>
            {notasData && notasData.length > 0 && (
              <div className="space-y-1.5">
                {notasData.slice(0, 3).map((n: { id: string; conteudo: string; autorNome: string | null; createdAt: string }) => (
                  <div key={n.id} className="p-2 rounded-lg bg-white/[0.02]">
                    <p className="text-xs text-white/70 whitespace-pre-wrap">
                      {n.conteudo.length > 150 ? n.conteudo.slice(0, 150) + "..." : n.conteudo}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/30">{n.autorNome || "Sistema"}</span>
                      <span className="text-[10px] text-white/30">{new Date(n.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                ))}
                {notasData.length > 3 && (
                  <p className="text-[10px] text-white/30 text-center pt-1">+{notasData.length - 3} notas</p>
                )}
              </div>
            )}
            {negocioId && <AddNoteInlineNegocio negocioId={negocioId} />}
          </div>

          {/* Tarefas do negócio (título, descrição, data/hora) → Minhas Tarefas */}
          {negocioId && <TarefasSectionNegocio negocioId={negocioId} leadId={lead?.id ?? null} />}

          {/* Timeline (last 3 status changes) */}
          {statusChanges && statusChanges.length > 0 && (
            <div className="card-solid p-3.5">
              <h3 className="text-xs font-medium text-white/50 mb-2.5">Timeline</h3>
              <div className="space-y-2">
                {statusChanges.slice(0, 3).map((sc: { id: string; deStatus: string | null; paraStatus: string; createdAt: string }) => {
                  const from = sc.deStatus ? getStatusInfo(sc.deStatus) : null;
                  const to = getStatusInfo(sc.paraStatus);
                  return (
                    <div key={sc.id} className="flex items-center gap-2.5 text-xs">
                      <Clock className="w-3 h-3 text-white/30 shrink-0" />
                      <span className="text-[10px] text-white/40">{new Date(sc.createdAt).toLocaleDateString("pt-BR")}</span>
                      <span className="text-xs text-white/70">
                        {from ? (
                          <>
                            <span style={{ color: from.color }}>{from.label}</span>
                            {" → "}
                          </>
                        ) : null}
                        <span style={{ color: to.color }}>{to.label}</span>
                      </span>
                    </div>
                  );
                })}
                {statusChanges.length > 3 && (
                  <p className="text-[10px] text-white/30 text-center pt-1">+{statusChanges.length - 3} mudancas</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-1 space-y-2">
            <Link
              href={`/negocios/${negocioId}`}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium text-[#e23752] hover:bg-[#e23752]/10 transition-colors border border-[#e23752]/20"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange("ganho")}
                disabled={isChangingStatus}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors border border-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trophy className="w-3.5 h-3.5" /> Ganho
              </button>
              <button
                onClick={() => {
                  const motivo = prompt("Motivo da perda:");
                  if (motivo) handleStatusChange("perdido", motivo);
                }}
                disabled={isChangingStatus}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors border border-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle className="w-3.5 h-3.5" /> Perdido
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
