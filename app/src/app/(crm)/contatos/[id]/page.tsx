"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Phone, Mail, Building2, MapPin, Globe, Star, MessageCircle, FileText, Plus, ClipboardList, Pencil, Trash2, X, User, Sparkles, Linkedin, Github, Twitter, Facebook, Briefcase, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONTATO_TIPOS, getContatoTipoInfo, getNegocioStatusInfo } from "@/lib/crm/pipeline";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { LeadTimeline } from "@/components/crm/LeadTimeline";
import { LigacoesSection } from "@/components/crm/LigacoesSection";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import { ChatPanel } from "@/components/crm/ChatPanel";
import { EmailPanel } from "@/components/crm/EmailPanel";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";
import { SdrStageControl } from "@/components/crm/SdrStageControl";
import { CadenciaPanel } from "@/components/crm/CadenciaPanel";
import { isCelular } from "@/lib/utils/phone";

const ACTIVITY_TYPES = [
  { key: "nota", label: "Nota" },
  { key: "ligacao", label: "Ligação" },
  { key: "email", label: "Email" },
  { key: "reuniao", label: "Reunião" },
  { key: "proposta_enviada", label: "Proposta Enviada" },
  { key: "follow_up", label: "Follow-up" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "whatsapp", label: "WhatsApp" },
];

export default function LeadDetailPage() {
  const { origens, setores, servicos } = usePipelineConfig();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activityType, setActivityType] = useState("nota");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityText, setActivityText] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState({ titulo: "", servicosInteresse: [] as string[] });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichMenuOpen, setEnrichMenuOpen] = useState(false);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${id}`);
      if (!res.ok) throw new Error("Lead não encontrado");
      return res.json();
    },
  });

  const { data: notasData = [] } = useQuery<{ id: string; conteudo: string; autorNome: string | null; createdAt: string }[]>({
    queryKey: ["notas", "lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/notas?leadId=${id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateLead = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao salvar");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lead", id] }),
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: activityType,
          titulo: activityTitle || undefined,
          descricao: activityText,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      setActivityText("");
      setActivityTitle("");
    },
  });

  const deleteLead = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao excluir");
      }
      return res.json();
    },
    onSuccess: () => {
      router.push("/contatos");
    },
  });

  const convertContato = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contatos/${id}/converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: convertForm.titulo || `${lead?.nome || "Contato"} - Negócio`,
          servicosInteresse: convertForm.servicosInteresse.length > 0 ? convertForm.servicosInteresse : undefined,
        }),
      });
      if (!res.ok) throw new Error("Erro ao converter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      setShowConvertModal(false);
      setConvertForm({ titulo: "", servicosInteresse: [] });
    },
  });

  if (isLoading) return <div className="text-white/40 p-8">Carregando...</div>;
  if (!data?.lead) return <div className="text-red-500 p-8">Lead não encontrado</div>;

  const { lead, atividades, statusChanges: changes, eventos, tarefas: leadTarefas, contratos: leadContratos, propostas: leadPropostas, negocios: leadNegocios } = data;
  const ti = getContatoTipoInfo(lead.tipo || "lead");

  // Merge timeline
  const timeline = [
    ...(atividades || []).map((a: Record<string, unknown>) => ({ ...a, timelineType: "atividade" })),
    ...(changes || []).map((s: Record<string, unknown>) => ({ ...s, timelineType: "status_change" })),
    ...(eventos || []).map((e: Record<string, unknown>) => ({ ...e, timelineType: "evento" })),
  ].sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

  const daysInFunnel = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  function toggleChat() {
    setShowChat(!showChat);
  }

  return (
    <div className="page-scroll space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()} className="mt-1 p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#e23752]/15 flex items-center justify-center shrink-0 overflow-hidden">
                {lead.avatarUrl ? (
                  <img src={lead.avatarUrl} alt={lead.nome} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-[#e23752]" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">{lead.nome}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${ti.color}20`, color: ti.color }}>
                    {ti.label}
                  </span>
                  <span className={`flex items-center gap-1 text-sm font-bold ${lead.leadScore >= 70 ? "text-[#c8ff00]" : lead.leadScore >= 40 ? "text-amber-400" : "text-white/40"}`}>
                    <Star className="w-3.5 h-3.5" /> {lead.leadScore}
                  </span>
                  <span className="text-xs text-white/40">{daysInFunnel}d no funil</span>
                  {lead.enrichStatus === "enriched" && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400">Apollo</span>}
                  {lead.enrichStatus === "not_found" && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-white/40">Não encontrado</span>}
                </div>
              </div>
            </div>
            {lead.empresa && <p className="text-sm text-white/40 mt-1 ml-15">{lead.empresa} {lead.cargo ? `· ${lead.cargo}` : ""}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={callfaceCallUrl(lead.telefone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
            <Phone className="w-3.5 h-3.5" /> Ligar
          </a>
          <button onClick={toggleChat} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showChat ? "bg-emerald-500/15 text-emerald-400" : "text-emerald-400 hover:bg-emerald-500/10"}`}>
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </button>
          <button onClick={() => setShowEmail(!showEmail)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showEmail ? "bg-cyan-500/15 text-cyan-400" : "text-cyan-400 hover:bg-cyan-500/10"}`}>
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          <div className="relative">
            <button
              onClick={() => {
                if (lead.enrichStatus === "enriched") return;
                setEnrichMenuOpen(!enrichMenuOpen);
              }}
              disabled={enriching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {enriching ? "Enriquecendo..." : lead.enrichStatus === "enriched" ? "Enriquecido" : "Enriquecer"}
              {!enriching && lead.enrichStatus !== "enriched" && <ChevronDown className="w-3 h-3" />}
            </button>
            {enrichMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-[#1A1D26] border border-white/[0.08] shadow-xl z-30 py-1">
                {[
                  { label: "Básico (1 crédito)", desc: "Dados públicos", opts: {} },
                  { label: "+ Email pessoal (+1 crédito)", desc: "Revelar email pessoal", opts: { revealEmail: true } },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    className="w-full text-left px-3 py-2 hover:bg-white/[0.06] transition-colors"
                    onClick={async () => {
                      setEnrichMenuOpen(false);
                      setEnriching(true);
                      try {
                        const res = await fetch(`/api/leads/${id}/enrich`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(opt.opts),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          if (res.status === 400 && data.error?.includes("API key")) {
                            alert("Apollo API key não configurada.\nPeça ao administrador para configurar em Admin > Organizações > Integrações.");
                          } else {
                            alert(data.error || "Erro ao enriquecer");
                          }
                        } else {
                          queryClient.invalidateQueries({ queryKey: ["lead", id] });
                        }
                      } catch { alert("Erro de conexão"); } finally { setEnriching(false); }
                    }}
                  >
                    <p className="text-xs font-medium text-white/80">{opt.label}</p>
                    <p className="text-[10px] text-white/40">{opt.desc}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e23752] hover:bg-[#e23752]/10 transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        </div>
      </div>

      {/* WhatsApp Chat Panel */}
      {showChat && (
        <div className="h-[420px]">
          <ChatPanel
            leadId={lead.id}
            leadNome={lead.nome}
            leadTelefone={lead.telefone}
            leadStatus={lead.status}
            leadEmpresa={lead.empresa as string | null}
            compact
          />
        </div>
      )}

      {/* Email Panel */}
      {showEmail && (
        <EmailPanel
          leadId={lead.id}
          leadNome={lead.nome}
          leadEmail={lead.email as string | null}
          compact
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Pré-vendas: estágio + avançar no funil (mesmo fluxo do board) */}
          {lead.tipo === "lead" && (
            <SdrStageControl
              leadId={lead.id}
              nome={lead.nome}
              empresa={lead.empresa as string | null}
              sdrStatus={lead.sdrStatus as string | null}
              responsavelId={lead.responsavelId as string | null}
              negocios={(leadNegocios || []).map((n: Record<string, unknown>) => ({ id: n.id as string, status: n.status as string }))}
            />
          )}
          {/* Negócios */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white/50">Negócios</h2>
              {(lead.tipo === "lead" || lead.tipo === "cliente") && (
                <Link href={`/negocios/novo?leadId=${lead.id}`} className="text-[10px] text-purple-400 hover:text-purple-300">+ Novo Negócio</Link>
              )}
            </div>
            {leadNegocios && leadNegocios.length > 0 ? (
              leadNegocios.map((n: Record<string, unknown>) => {
                const nsi = getNegocioStatusInfo(n.status as string);
                const mrr = parseFloat(n.mrrEstimado as string || "0") || 0;
                const proj = parseFloat(n.valorProjeto as string || "0") || 0;
                return (
                  <button key={n.id as string} onClick={() => setDrawerNegocioId(n.id as string)} className="block w-full text-left border border-white/[0.06] rounded-lg p-3 text-sm space-y-1 hover:bg-white/[0.03] transition-colors cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-white">{n.titulo as string}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: nsi.color + "20", color: nsi.color }}>{nsi.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/50">
                      {mrr > 0 && <span>MRR: R$ {mrr.toLocaleString("pt-BR")}</span>}
                      {proj > 0 && <span>Projeto: R$ {proj.toLocaleString("pt-BR")}</span>}
                      {n.origemNegocio === "carteira" && <span className="text-cyan-400">Carteira</span>}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-white/40">
                Nenhum negócio vinculado
              </p>
            )}
          </div>

          {/* Contact Info */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
            <h2 className="text-sm font-medium text-white/50">Contato</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-white/70">
                <Phone className="w-4 h-4" />
                <span>{lead.telefone}</span>
                {isCelular(lead.telefone) && (
                  <button onClick={toggleChat} className="p-1 rounded hover:bg-emerald-500/15 text-emerald-400 transition-colors" title="WhatsApp">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {lead.whatsapp && String(lead.whatsapp).replace(/\D/g, "") !== String(lead.telefone || "").replace(/\D/g, "") && (
                <a href={`https://wa.me/${String(lead.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/70 hover:text-white">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>{lead.whatsapp}</span>
                  <span className="text-[10px] text-emerald-400/60">WhatsApp</span>
                </a>
              )}
              {lead.email && <p className="flex items-center gap-2 text-white/70"><Mail className="w-4 h-4" />{lead.email}</p>}
              {lead.linkedin && (
                <a href={lead.linkedin.startsWith('http') ? lead.linkedin : `https://linkedin.com/in/${lead.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                  <span className="text-xs">LinkedIn</span>
                  <span className="truncate">{lead.linkedin}</span>
                </a>
              )}
            </div>
          </div>

          {/* Apollo Insights */}
          {lead.enrichStatus === "enriched" && (lead.apolloSeniority || lead.apolloHeadline || lead.twitter || lead.github || lead.facebook || lead.apolloEmploymentHistory?.length > 0 || lead.apolloLikelyEngage !== null) && (
            <div className="rounded-xl bg-purple-500/[0.04] border border-purple-500/[0.12] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <h2 className="text-sm font-medium text-purple-400">Apollo Insights</h2>
              </div>

              {/* Photo + headline */}
              <div className="flex items-start gap-3">
                {lead.apolloPhotoUrl && (
                  <img src={lead.apolloPhotoUrl} alt={lead.nome} className="w-12 h-12 rounded-full object-cover border border-white/[0.1]" />
                )}
                <div className="min-w-0 flex-1">
                  {lead.apolloHeadline && <p className="text-xs text-white/60 italic">{lead.apolloHeadline}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {lead.apolloSeniority && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/15 text-purple-300 capitalize">{lead.apolloSeniority}</span>
                    )}
                    {lead.apolloDepartments && (lead.apolloDepartments as string[]).map((d: string) => (
                      <span key={d} className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] text-white/50 capitalize">{d.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Location */}
              {(lead.apolloCity || lead.apolloState || lead.apolloCountry) && (
                <p className="flex items-center gap-1.5 text-xs text-white/50">
                  <MapPin className="w-3 h-3" />
                  {[lead.apolloCity, lead.apolloState, lead.apolloCountry].filter(Boolean).join(", ")}
                </p>
              )}

              {/* Engagement Score */}
              {lead.apolloLikelyEngage !== null && lead.apolloLikelyEngage !== undefined && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className={`text-xs font-medium ${lead.apolloLikelyEngage ? "text-emerald-400" : "text-white/40"}`}>
                    {lead.apolloLikelyEngage ? "Provável engajamento" : "Baixo engajamento"}
                  </span>
                </div>
              )}

              {/* Social Links */}
              {(lead.twitter || lead.github || lead.facebook || lead.linkedin) && (
                <div className="flex items-center gap-2 pt-1">
                  {lead.linkedin && (
                    <a href={String(lead.linkedin).startsWith("http") ? String(lead.linkedin) : `https://linkedin.com/in/${lead.linkedin}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors" title="LinkedIn">
                      <Linkedin className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {lead.twitter && (
                    <a href={String(lead.twitter).startsWith("http") ? String(lead.twitter) : `https://twitter.com/${lead.twitter}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors" title="Twitter/X">
                      <Twitter className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {lead.github && (
                    <a href={String(lead.github).startsWith("http") ? String(lead.github) : `https://github.com/${lead.github}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/[0.06] text-white/60 hover:bg-white/[0.1] transition-colors" title="GitHub">
                      <Github className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {lead.facebook && (
                    <a href={String(lead.facebook).startsWith("http") ? String(lead.facebook) : `https://facebook.com/${lead.facebook}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors" title="Facebook">
                      <Facebook className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Employment History */}
              {lead.apolloEmploymentHistory && (lead.apolloEmploymentHistory as Array<Record<string, unknown>>).length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">Histórico</p>
                  {(lead.apolloEmploymentHistory as Array<Record<string, unknown>>).slice(0, 4).map((job, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Briefcase className="w-3 h-3 text-white/20 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-white/70">{job.title as string || "—"}</span>
                        <span className="text-white/30"> @ {job.organization_name as string}</span>
                        {job.current ? <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Atual</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Company Info */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
            <h2 className="text-sm font-medium text-white/50">Empresa</h2>
            <div className="space-y-2 text-sm text-white/70">
              {lead.empresa && <p className="flex items-center gap-2"><Building2 className="w-4 h-4" />{lead.empresa}</p>}
              {lead.empresaSetor && <p>Setor: {setores.find(s => s.key === lead.empresaSetor)?.label || lead.empresaSetor}</p>}
              {lead.empresaPorte && <p>Porte: {lead.empresaPorte}</p>}
              {(lead.empresaCidade || lead.empresaEstado) && (
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4" />{[lead.empresaCidade, lead.empresaEstado].filter(Boolean).join(", ")}</p>
              )}
              {lead.numUsuariosTi && <p>Usuários TI: {lead.numUsuariosTi}</p>}
              {lead.numFiliais > 1 && <p>Filiais: {lead.numFiliais}</p>}
              {lead.concorrenteAtual && <p>Concorrente: {lead.concorrenteAtual}</p>}
              {lead.contratoVenceEm && <p>Contrato vence: {lead.contratoVenceEm}</p>}
            </div>
            {lead.servicosInteresse && lead.servicosInteresse.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {lead.servicosInteresse.map((s: string) => (
                  <span key={s} className="px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full text-xs">
                    {servicos.find(sv => sv.key === s)?.label || s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sobre o Projeto */}
          {lead.comoConheceu && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
              <h2 className="text-sm font-medium text-white/50">Sobre o Projeto</h2>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{lead.comoConheceu}</p>
            </div>
          )}

          {/* Tipo do Contato */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
            <h2 className="text-sm font-medium text-white/50">Tipo</h2>
            <select
              value={lead.tipo || "lead"}
              onChange={(e) => updateLead.mutate({ tipo: e.target.value })}
              className="dark-input w-full"
            >
              {CONTATO_TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          {/* Tracking */}
          {(lead.origem || lead.utmSource || lead.utmCampaign || lead.utmMedium || lead.gclid || lead.fbclid || lead.landingPage || (lead.camposCustom as Record<string, unknown> | undefined)?.segmento) && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
              <h2 className="text-sm font-medium text-white/50">Origem &amp; Tracking</h2>
              <div className="space-y-1 text-xs text-white/50">
                <p>Origem: <span className="text-white/70">{origens.find(o => o.key === lead.origem)?.label || lead.origem || "Direto"}</span></p>
                {(lead.camposCustom as Record<string, unknown> | undefined)?.segmento ? (
                  <p>Segmento: <span className="text-white/70">{String((lead.camposCustom as Record<string, unknown>).segmento)}</span></p>
                ) : null}
                {lead.utmCampaign && <p>Campanha: <span className="px-1.5 py-0.5 rounded text-[11px]" style={{ background: "rgba(142,39,239,0.15)", color: "#c4a3f5" }}>{lead.utmCampaign}</span></p>}
                {lead.utmSource && <p>Source: <span className="text-white/70">{lead.utmSource}</span></p>}
                {lead.utmMedium && <p>Mídia: <span className="text-white/70">{lead.utmMedium}</span></p>}
                {lead.utmContent && <p>Conteúdo: <span className="text-white/70">{lead.utmContent}</span></p>}
                {lead.utmTerm && <p>Palavra-chave: <span className="text-white/70">{lead.utmTerm}</span></p>}
                {lead.landingPage && <p className="truncate" title={lead.landingPage}>Landing/Referrer: <span className="text-white/70">{lead.landingPage}</span></p>}
                {lead.indicadoPor && <p>Indicado por: {lead.indicadoPor}</p>}
                {lead.gclid && <p>GCLID: <span className="text-white/40">{lead.gclid.substring(0, 16)}…</span></p>}
                {lead.fbclid && <p>FBCLID: <span className="text-white/40">{lead.fbclid.substring(0, 16)}…</span></p>}
                <p>Entrada: {new Date(lead.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          )}

          {/* Contratos */}
          {leadContratos && leadContratos.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
              <h2 className="text-sm font-medium text-white/50">Contratos</h2>
              {leadContratos.map((c: Record<string, unknown>) => (
                <div key={c.id as string} className="border border-white/[0.06] rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium text-white">{c.tipo as string}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "ativo" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.05] text-white/70"}`}>
                      {c.status as string}
                    </span>
                  </div>
                  {c.mrr ? <p className="text-white/70">MRR: R$ {parseFloat(c.mrr as string).toLocaleString("pt-BR")}</p> : null}
                  {c.servicos && (c.servicos as string[]).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {(c.servicos as string[]).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded text-xs">{s}</span>
                      ))}
                    </div>
                  ) : null}
                  {c.inicio ? <p className="text-xs text-white/40">Início: {c.inicio as string}</p> : null}
                </div>
              ))}
            </div>
          )}

          {/* Propostas */}
          {leadPropostas && leadPropostas.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-white/50">Propostas</h2>
                <Link href={`/propostas/novo?leadId=${lead.id}`} className="text-[10px] text-purple-400 hover:text-purple-300">+ Nova</Link>
              </div>
              {leadPropostas.map((p: Record<string, unknown>) => {
                const statusColors: Record<string, string> = { rascunho: "#6B7280", enviada: "#3B82F6", aceita: "#10B981", recusada: "#EF4444", expirada: "#F59E0B" };
                const color = statusColors[p.status as string] || "#6B7280";
                return (
                  <Link key={p.id as string} href={`/propostas/${p.id}`} className="block border border-white/[0.06] rounded-lg p-3 text-sm space-y-1 hover:bg-white/[0.03] transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-white/70 text-xs">#P-{String(p.numero).padStart(3, "0")}-v{p.versao as number}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: color + "20", color }}>{p.status as string}</span>
                    </div>
                    <p className="text-white font-medium">R$ {parseFloat(p.totalGeral as string || "0").toLocaleString("pt-BR")}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column - Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add Activity */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <h2 className="text-sm font-medium text-white/50 mb-3">Registrar Atividade</h2>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="dark-input">
                  {ACTIVITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <input type="text" value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="Título (opcional)" className="dark-input flex-1" />
              </div>
              <div className="flex gap-2">
                <input type="text" value={activityText} onChange={(e) => setActivityText(e.target.value)}
                  placeholder="Descrição..." className="dark-input flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && activityText.trim()) addActivity.mutate(); }} />
                <button onClick={() => activityText.trim() && addActivity.mutate()} disabled={!activityText.trim() || addActivity.isPending}
                  className="btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50">
                  Salvar
                </button>
              </div>
            </div>
          </div>

          {/* Tarefas pendentes */}
          {leadTarefas && leadTarefas.filter((t: Record<string, unknown>) => !t.concluida).length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <h2 className="font-semibold text-white mb-3 text-sm">Tarefas Pendentes</h2>
              <div className="space-y-2">
                {leadTarefas.filter((t: Record<string, unknown>) => !t.concluida).map((t: Record<string, unknown>) => (
                  <div key={t.id as string} className="flex items-center gap-2 text-sm p-2 bg-white/[0.05] rounded-lg">
                    <span className="text-white/70">{t.titulo as string}</span>
                    {t.dataVencimento ? (
                      <span className="ml-auto text-xs text-white/40">{t.dataVencimento as string}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cadência SDR — régua de 13 toques (pré-vendas) */}
          {lead.tipo === "lead" && (
            <CadenciaPanel leadId={lead.id} />
          )}

          {/* Ligações (telefonia Callface) — sempre visível. id="ligacoes": alvo do atalho que a Timeline usa
              pra apontar pro resumo de IA completo em vez de duplicar o texto inteiro ali. */}
          <div id="ligacoes" className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 scroll-mt-4">
            <LigacoesSection leadId={lead.id} enviarDiscagem />
          </div>

          {/* Timeline */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <h2 className="text-sm font-medium text-white/50 mb-3">Timeline</h2>
            <LeadTimeline items={timeline} />
          </div>

          {/* Notas */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <h3 className="text-sm font-medium text-white/50 mb-3">Notas ({notasData.length})</h3>
            <div className="space-y-2 mb-3">
              {notasData.slice(0, 5).map((n) => (
                <div key={n.id} className="p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-xs text-white/70 whitespace-pre-wrap">{n.conteudo.length > 200 ? n.conteudo.slice(0, 200) + "..." : n.conteudo}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-white/30">{n.autorNome || "Sistema"}</span>
                    <span className="text-[10px] text-white/30">{new Date(n.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              ))}
              {notasData.length === 0 && <p className="text-xs text-white/30">Nenhuma nota</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Convert to Lead Modal */}
      {showConvertModal && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50">
          <div className="modal-content p-6 w-full max-w-md">
            <h3 className="font-semibold text-white mb-4">Converter para Lead</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Título do Negócio</label>
                <input type="text" value={convertForm.titulo} onChange={(e) => setConvertForm({ ...convertForm, titulo: e.target.value })}
                  className="dark-input w-full" placeholder={`${lead.empresa || lead.nome} - Negócio`} />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Serviços de Interesse</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {servicos.map((s) => (
                    <button key={s.key} type="button"
                      onClick={() => setConvertForm(f => ({
                        ...f,
                        servicosInteresse: f.servicosInteresse.includes(s.key)
                          ? f.servicosInteresse.filter(x => x !== s.key)
                          : [...f.servicosInteresse, s.key]
                      }))}
                      className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                        convertForm.servicosInteresse.includes(s.key)
                          ? "bg-blue-500/30 text-blue-300"
                          : "bg-white/[0.05] text-white/50 hover:bg-white/[0.1]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowConvertModal(false)} className="px-4 py-2 text-sm text-white/70">Cancelar</button>
              <button onClick={() => convertContato.mutate()} disabled={convertContato.isPending}
                className="px-4 py-2 text-sm bg-amber-500/80 hover:bg-amber-500 text-white rounded-lg disabled:opacity-50">
                {convertContato.isPending ? "Convertendo..." : "Converter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditModal && (
        <EditLeadModal
          lead={lead}
          onClose={() => setShowEditModal(false)}
          onSaved={(updates) => {
            updateLead.mutate(updates);
            setShowEditModal(false);
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-2">Excluir Lead</h3>
            <p className="text-sm text-white/50 mb-4">
              Tem certeza que deseja excluir <strong className="text-white/70">{lead.nome}</strong>? Esta ação não pode ser desfeita. Todos os dados relacionados (mensagens, atividades, etc.) serão removidos.
            </p>
            {deleteLead.isError && (
              <p className="text-sm text-red-400 mb-3">{(deleteLead.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white">Cancelar</button>
              <button
                onClick={() => deleteLead.mutate()}
                disabled={deleteLead.isPending}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
              >
                {deleteLead.isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entity Drawers */}
      <EmpresaDrawer
        empresaId={drawerEmpresaId}
        open={!!drawerEmpresaId}
        onClose={() => setDrawerEmpresaId(null)}
        onOpenNegocio={(nid) => { setDrawerEmpresaId(null); setDrawerNegocioId(nid); }}
      />
      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenEmpresa={(eid) => { setDrawerNegocioId(null); setDrawerEmpresaId(eid); }}
      />
    </div>
  );
}

function EditLeadModal({ lead, onClose, onSaved }: {
  lead: Record<string, unknown>;
  onClose: () => void;
  onSaved: (updates: Record<string, unknown>) => void;
}) {
  const { origens, setores } = usePipelineConfig();
  const [form, setForm] = useState({
    nome: (lead.nome as string) || "",
    telefone: (lead.telefone as string) || "",
    email: (lead.email as string) || "",
    empresa: (lead.empresa as string) || "",
    empresaId: (lead.empresaId as string) || "",
    cargo: (lead.cargo as string) || "",
    empresaSetor: (lead.empresaSetor as string) || "",
    empresaPorte: (lead.empresaPorte as string) || "",
    empresaCidade: (lead.empresaCidade as string) || "",
    empresaEstado: (lead.empresaEstado as string) || "",
    origem: (lead.origem as string) || "",
    concorrenteAtual: (lead.concorrenteAtual as string) || "",
    linkedin: (lead.linkedin as string) || "",
  });

  // Empresa search/autocomplete
  const [empresaSearch, setEmpresaSearch] = useState((lead.empresa as string) || "");
  const [showEmpresaList, setShowEmpresaList] = useState(false);
  const { data: empresasList } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ["empresas-search", empresaSearch],
    queryFn: async () => {
      const res = await fetch(`/api/empresas?limit=10${empresaSearch ? `&q=${encodeURIComponent(empresaSearch)}` : ""}`);
      const data = await res.json();
      return data.empresas || data || [];
    },
    enabled: showEmpresaList,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      const leadVal = lead[k] ?? "";
      if (v !== leadVal) updates[k] = v || null;
    }
    // Always include nome/telefone if present
    if (form.nome) updates.nome = form.nome;
    if (form.telefone) updates.telefone = form.telefone;
    // Clean up: remove empty strings for UUID fields
    if (updates.empresaId === "" || updates.empresaId === null) delete updates.empresaId;
    if (updates.responsavelId === "" || updates.responsavelId === null) delete updates.responsavelId;
    if (Object.keys(updates).length > 0) {
      onSaved(updates);
    } else {
      onClose();
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">Editar Lead</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.06] rounded"><X className="w-4 h-4 text-white/40" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Nome *</label>
              <input required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Telefone *</label>
              <input required value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Email</label>
            <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">LinkedIn</label>
            <input value={form.linkedin || ""} onChange={e => setForm({...form, linkedin: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" placeholder="URL ou username" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <label className="text-xs text-white/50 mb-1 block">Empresa</label>
              <input
                value={empresaSearch}
                onChange={e => { setEmpresaSearch(e.target.value); setShowEmpresaList(true); setForm({...form, empresa: e.target.value, empresaId: ""}); }}
                onFocus={() => setShowEmpresaList(true)}
                className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none"
                placeholder="Buscar empresa..."
              />
              {form.empresaId && <span className="absolute right-2 top-7 text-xs text-green-400">vinculada</span>}
              {showEmpresaList && empresasList && empresasList.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg max-h-40 overflow-y-auto">
                  {empresasList.map(emp => (
                    <button key={emp.id} type="button" onClick={() => { setForm({...form, empresa: emp.nome, empresaId: emp.id}); setEmpresaSearch(emp.nome); setShowEmpresaList(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors">
                      {emp.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Cargo</label>
              <input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Setor</label>
              <select value={form.empresaSetor} onChange={e => setForm({...form, empresaSetor: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm">
                <option value="">—</option>
                {setores.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Porte</label>
              <select value={form.empresaPorte} onChange={e => setForm({...form, empresaPorte: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm">
                <option value="">—</option>
                <option value="pequena">Pequena</option>
                <option value="media">Média</option>
                <option value="grande">Grande</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Cidade</label>
              <input value={form.empresaCidade} onChange={e => setForm({...form, empresaCidade: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Estado</label>
              <input value={form.empresaEstado} onChange={e => setForm({...form, empresaEstado: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" placeholder="SP" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Origem</label>
              <select value={form.origem} onChange={e => setForm({...form, origem: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm">
                <option value="">—</option>
                {origens.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Concorrente</label>
              <input value={form.concorrenteAtual} onChange={e => setForm({...form, concorrenteAtual: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-white/70 hover:text-white">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm btn-primary rounded-lg">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
