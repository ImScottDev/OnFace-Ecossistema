"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AddNoteInlineNegocio, TarefasSectionNegocio } from "@/components/crm/NegocioSections";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, FileText, Clock, CheckCircle, XCircle, Plus, Pencil, Trash2, X, Building2, Users, Thermometer, StickyNote, MessageCircle, Phone, Briefcase, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { EmpresaDrawer } from "@/components/crm/EmpresaDrawer";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { QualificacaoSdrSection } from "@/components/crm/QualificacaoSdrSection";
import { LigacoesSection } from "@/components/crm/LigacoesSection";
import { LeadTimeline } from "@/components/crm/LeadTimeline";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import { isAdminView } from "@/lib/auth/roles";

export default function NegocioDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [showLossModal, setShowLossModal] = useState(false);
  const [lossReason, setLossReason] = useState("");
  const [lossDetail, setLossDetail] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [drawerEmpresaId, setDrawerEmpresaId] = useState<string | null>(null);
  const { stages, closedStages, allStatuses, lossReasons, getStatusInfo, servicos } = usePipelineConfig();
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  // F4/Won Evidence: gate real existe desde 09/08 (ADR-EXEC-012), mas nenhuma
  // tela oferecia a via manual (PBX/venda fora do Stripe) — sem isso, o
  // closer clicava em "Ganho", o gate rejeitava (400) e a mutation antiga
  // (sem checar res.ok) engolia o erro em silêncio.
  const [showEvidenciaModal, setShowEvidenciaModal] = useState(false);
  const [evidenciaTipo, setEvidenciaTipo] = useState<"manual_contract" | "admin_approval">("manual_contract");
  const [evidenciaNota, setEvidenciaNota] = useState("");
  const isAdmin = isAdminView(session?.user?.role);
  // true só durante a retentativa automática depois de anexar evidência —
  // distingue "1ª rejeição, oferece anexar" de "anexou e AINDA foi rejeitado"
  // (política do produto pode não aceitar manual_contract/admin_approval
  // ainda — calibração pendente, ver DECISOES-PENDENTES.md item 1). Sem essa
  // distinção o modal reabriria em loop sem explicar o motivo real.
  const retentandoAposEvidencia = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["negocio", id],
    queryFn: async () => {
      const res = await fetch(`/api/negocios/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const updateNegocio = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/negocios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = await res.json();
      // Achado real: antes disso, um 400 (ex: gate de evidência de Won
      // rejeitando) era tratado como sucesso — a mutation nunca checava
      // res.ok, então o erro do backend ficava engolido em silêncio.
      if (!res.ok) throw new Error(body.error || "Erro ao atualizar negócio");
      return body;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["negocio", id] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      if (vars.status === "ganho") {
        queryClient.invalidateQueries({ queryKey: ["carteira"] });
      }
    },
    onError: (err: Error, vars) => {
      if (vars.status !== "ganho" || !err.message.includes("evidência")) {
        toast.error(err.message);
        return;
      }
      if (retentandoAposEvidencia.current) {
        // Anexou evidência de verdade (audit trail ficou registrado), mas a
        // política do produto ainda não aceita esse tipo — não é bug, é a
        // calibração de negócio pendente (item 1 de DECISOES-PENDENTES.md).
        retentandoAposEvidencia.current = false;
        toast.error("Evidência registrada, mas a política deste produto ainda não aceita esse tipo (calibração pendente — fale com o gestor). O negócio não foi marcado como ganho.");
        return;
      }
      // Oferece a via manual (F4, ADR-EXEC-012) só quando é especificamente
      // o gate de evidência rejeitando E o usuário tem papel pra resolver isso.
      if (isAdmin) {
        setShowEvidenciaModal(true);
        return;
      }
      toast.error(err.message);
    },
  });

  const anexarEvidencia = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/negocios/${id}/evidencia-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: evidenciaTipo, nota: evidenciaNota }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao anexar evidência");
      return body;
    },
    onSuccess: () => {
      setShowEvidenciaModal(false);
      setEvidenciaNota("");
      toast.success("Evidência anexada — marcando como ganho...");
      retentandoAposEvidencia.current = true;
      updateNegocio.mutate({ status: "ganho" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteNegocio = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/negocios/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao excluir");
      }
      return res.json();
    },
    onSuccess: () => {
      router.push("/pipeline");
    },
  });

  if (isLoading) return <div className="p-8 text-white/40 text-center">Carregando...</div>;
  if (!data?.negocio) return <div className="p-8 text-white/40 text-center">Negócio não encontrado</div>;

  const { negocio, lead, empresa, leads: allLeads, propostas, contratos, atividades: activities, statusChanges: changes, reunioes } = data;
  const stageInfo = getStatusInfo(negocio.status);
  const valorTotal = parseFloat(negocio.valorTotal || "0") || 0;

  // Timeline unificada (mesmo padrão da página de lead): atividades (nota, ligação, whatsapp...) + mudanças de estágio.
  const timeline = [
    ...(activities || []).map((a: Record<string, unknown>) => ({ ...a, timelineType: "atividade" })),
    ...(changes || []).map((s: Record<string, unknown>) => ({ ...s, timelineType: "status_change" })),
  ].sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "perdido") {
      setShowLossModal(true);
      return;
    }
    updateNegocio.mutate({ status: newStatus });
  };

  const handleLoss = () => {
    if (!lossReason) return;
    updateNegocio.mutate({ status: "perdido", motivoPerda: lossReason, motivoPerdaDetalhe: lossDetail });
    setShowLossModal(false);
  };

  const openWhatsApp = async () => {
    const targetLead = lead || allLeads?.[0];
    if (!targetLead?.telefone) return;
    setWhatsappLoading(true);
    try {
      const res = await fetch(`/api/leads/${targetLead.id}/iniciar-whatsapp`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.contatoId) {
        router.push(`/whatsapp?contato=${data.contatoId}`);
      } else {
        toast.error(data.error || "Erro ao iniciar WhatsApp");
      }
    } catch {
      toast.error("Erro ao iniciar WhatsApp");
    } finally {
      setWhatsappLoading(false);
    }
  };

  const leadPhone = lead?.telefone || allLeads?.[0]?.telefone;

  return (
    <div className="page-scroll space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()} className="mt-1 p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-[#e23752]/15 flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6 text-[#e23752]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{negocio.titulo}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${stageInfo.color}20`, color: stageInfo.color }}>
                {stageInfo.label}
              </span>
              {negocio.origemNegocio === "carteira" && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-400">Carteira</span>
              )}
              {valorTotal > 0 && (
                <span className="text-sm font-medium text-[#e23752]">R$ {valorTotal.toLocaleString("pt-BR")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {leadPhone && (
              <>
                <a href={callfaceCallUrl(leadPhone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
                  <Phone className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Ligar</span>
                </a>
                <button onClick={openWhatsApp} disabled={whatsappLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                  <MessageCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">WhatsApp</span>
                </button>
              </>
            )}
            <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e23752] hover:bg-[#e23752]/10 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Editar</span>
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Excluir</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status selector */}
          <div className="card-solid p-4 overflow-hidden">
            <h3 className="text-sm font-medium text-white/50 mb-1">Etapa do Negócio</h3>
            <p className="text-[10px] text-white/25 mt-0.5 mb-3 hidden sm:block">Clique na etapa para mover o negócio no funil.</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 sm:flex-wrap sm:overflow-x-visible sm:pb-0">
              {[...stages, ...closedStages.filter(s => s.key === "ganho" || s.key === "perdido")].map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleStatusChange(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap ${
                    negocio.status === s.key ? "text-white ring-1" : "text-white/50 hover:text-white"
                  }`}
                  style={{
                    backgroundColor: negocio.status === s.key ? `${s.color}25` : "rgba(255,255,255,0.04)",
                    ...(negocio.status === s.key ? { ringColor: s.color } : {}),
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Value + Temperature */}
          <div className="card-solid p-4">
            <h3 className="text-sm font-medium text-white/50 mb-1">Valor e Temperatura</h3>
            <p className="text-[10px] text-white/25 mt-0.5 mb-3">Quente = alta chance de fechar. Morno = em andamento. Frio = risco de perda.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-white/40">Valor Total</p>
                <p className="text-lg font-bold text-[#e23752]">R$ {valorTotal.toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-1">Temperatura</p>
                <div className="flex gap-1.5">
                  {(["quente", "morno", "frio", "indefinido"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateNegocio.mutate({ temperatura: t })}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        negocio.temperatura === t
                          ? t === "quente" ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                          : t === "morno" ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                          : t === "frio" ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                          : "bg-white/10 text-white/50 ring-1 ring-white/20"
                          : "bg-white/[0.04] text-white/40 hover:text-white/60"
                      }`}
                    >
                      {t === "quente" ? "🔥 Quente" : t === "morno" ? "☀️ Morno" : t === "frio" ? "❄️ Frio" : "— Indef."}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Servicos de Interesse */}
          {negocio.servicosInteresse && negocio.servicosInteresse.length > 0 && (
            <div className="card-solid p-4">
              <h3 className="text-sm font-medium text-white/50 mb-2">Interesse</h3>
              <div className="flex flex-wrap gap-1.5">
                {negocio.servicosInteresse.map((s: string) => (
                  <span key={s} className="px-2.5 py-1 bg-blue-500/15 text-blue-400 rounded-full text-xs">
                    {servicos.find((sv) => sv.key === s)?.label || s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Necessidades constatadas */}
          {negocio.necessidadesConstatadas && negocio.necessidadesConstatadas.length > 0 && (
            <div className="card-solid p-4">
              <h3 className="text-sm font-medium text-white/50 mb-2">Necessidades Constatadas</h3>
              <div className="flex flex-wrap gap-1.5">
                {negocio.necessidadesConstatadas.map((n: string) => (
                  <span key={n} className="px-2.5 py-1 bg-[#8e27ef]/15 text-[#8e27ef] rounded-full text-xs">{n}</span>
                ))}
              </div>
            </div>
          )}

          {/* Descricao do projeto */}
          {negocio.descricao && (
            <div className="card-solid p-4">
              <h3 className="text-sm font-medium text-white/50 mb-2">Observacoes</h3>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{negocio.descricao}</p>
            </div>
          )}

          {/* Propostas */}
          <div className="card-solid p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white/50">Propostas ({propostas?.length || 0})</h3>
              <Link
                href={`/propostas/nova?negocioId=${negocio.id}`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#e23752] hover:bg-[#e23752]/10"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Proposta
              </Link>
            </div>
            {propostas && propostas.length > 0 ? (
              <div className="space-y-2">
                {propostas.map((p: { id: string; numero: number; versao: number; status: string; totalGeral: string | null; createdAt: string }) => (
                  <Link key={p.id} href={`/propostas/${p.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04]">
                    <div>
                      <span className="text-sm text-white font-medium">#P-{String(p.numero).padStart(3, "0")}-v{p.versao}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${p.status === "aceita" ? "bg-emerald-500/15 text-emerald-400" : p.status === "enviada" ? "bg-blue-500/15 text-blue-400" : "bg-white/[0.06] text-white/50"}`}>
                        {p.status}
                      </span>
                    </div>
                    <span className="text-sm text-white/50">R$ {parseFloat(p.totalGeral || "0").toLocaleString("pt-BR")}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/30">Nenhuma proposta. Crie uma para formalizar valores e serviços.</p>
            )}
          </div>

          {/* Contratos */}
          {contratos && contratos.length > 0 && (
            <div className="card-solid p-4">
              <h3 className="text-sm font-medium text-white/50 mb-3">Contratos ({contratos.length})</h3>
              <div className="space-y-2">
                {contratos.map((c: { id: string; tipo: string; status: string; mrr: string | null; inicio: string | null }) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <div>
                      <span className="text-sm text-white capitalize">{c.tipo.replace(/_/g, " ")}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${c.status === "ativo" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-white/50"}`}>
                        {c.status}
                      </span>
                    </div>
                    <span className="text-sm text-emerald-400">
                      {c.mrr ? `R$ ${parseFloat(c.mrr).toLocaleString("pt-BR")}/mês` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reunião agendada */}
          {reunioes && reunioes.length > 0 && (
            <div className="card-solid p-4">
              <h3 className="text-sm font-medium text-white/50 mb-3">Reunião agendada</h3>
              <div className="space-y-2">
                {reunioes.map((r: { id: string; titulo: string; data: string; tipo: string | null; duracao: number | null; link: string | null; responsavelNome: string | null }) => (
                  <div key={r.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-white/80">
                      <Clock className="w-3.5 h-3.5 text-[#e23752] shrink-0" />
                      <span>{new Date(r.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      {r.tipo && <span className="text-white/40">· {r.tipo}</span>}
                      {r.duracao && <span className="text-white/40">· {r.duracao}min</span>}
                    </div>
                    <p className="text-xs text-white/60">{r.titulo}</p>
                    {r.responsavelNome && <p className="text-[11px] text-white/40">Closer: {r.responsavelNome}</p>}
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline">
                        Abrir link da reunião
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ligações (telefonia Callface) — mesmas ligações do lead vinculado, filtradas pelo negócio.
              id="ligacoes": alvo do atalho que a Timeline usa pra apontar pro resumo de IA completo. */}
          <div id="ligacoes" className="card-solid p-4 scroll-mt-4">
            <LigacoesSection negocioId={String(id)} />
          </div>

          {/* Timeline — mesmo componente da página de lead: mistura nota/ligação/whatsapp/mudança de estágio. */}
          <div className="card-solid p-4">
            <h3 className="text-sm font-medium text-white/50 mb-3">Timeline</h3>
            <LeadTimeline items={timeline} />
          </div>

          {/* Notas */}
          <div className="card-solid p-4">
            <h3 className="text-sm font-medium text-white/50 mb-3">
              <StickyNote className="w-3.5 h-3.5 inline mr-1" />
              Notas ({data.notas?.length || 0})
            </h3>
            {data.notas && data.notas.length > 0 ? (
              <div className="space-y-2">
                {data.notas.map((n: { id: string; conteudo: string; autorNome: string | null; createdAt: string }) => (
                  <div key={n.id} className="p-2 rounded-lg bg-white/[0.02]">
                    <p className="text-sm text-white/70 whitespace-pre-wrap">{n.conteudo.length > 300 ? n.conteudo.slice(0, 300) + "..." : n.conteudo}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/30">{n.autorNome || "Sistema"}</span>
                      <span className="text-[10px] text-white/30">{new Date(n.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/30">Nenhuma nota. Registre observações internas sobre este negócio.</p>
            )}
            <AddNoteInlineNegocio negocioId={String(id)} />
          </div>

          {/* Tarefas do negócio (título, descrição, data/hora) → Minhas Tarefas */}
          <TarefasSectionNegocio negocioId={String(id)} leadId={lead?.id ?? null} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Empresa card */}
          {empresa && (
            <div className="card-solid p-4">
              <h3 className="text-sm font-medium text-white/50 mb-3">Empresa</h3>
              <button onClick={() => setDrawerEmpresaId(empresa.id)} className="block hover:bg-white/[0.04] p-2 rounded-lg -m-2 w-full text-left cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#e23752]/15 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#e23752]" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{empresa.nome}</p>
                    {empresa.setor && <p className="text-xs text-white/50 capitalize">{empresa.setor}</p>}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Leads / Contatos */}
          <div className="card-solid p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white/50">
                <Users className="w-3.5 h-3.5 inline mr-1" />
                Leads ({(allLeads || []).length || (lead ? 1 : 0)})
              </h3>
            </div>
            {allLeads && allLeads.length > 0 ? (
              <div className="space-y-2">
                {allLeads.map((l: { id: string; nome: string; email: string | null; telefone: string; empresa: string | null; cargo: string | null; papel: string }) => (
                  <button key={l.id} onClick={() => setDrawerLeadId(l.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] -mx-2 w-full text-left cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-[#e23752]/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-[#e23752]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{l.nome}</p>
                      <p className="text-xs text-white/40 truncate">{l.cargo || l.empresa || l.telefone}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40 capitalize shrink-0">{l.papel}</span>
                  </button>
                ))}
              </div>
            ) : lead ? (
              <button onClick={() => setDrawerLeadId(lead.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] -mx-2 w-full text-left cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-[#e23752]/20 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[#e23752]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{lead.nome}</p>
                  <p className="text-xs text-white/40 truncate">{lead.empresa || lead.telefone}</p>
                </div>
              </button>
            ) : (
              <p className="text-sm text-white/30">Nenhum lead vinculado. Associe leads para acompanhar os contatos envolvidos.</p>
            )}
          </div>

          {/* Links & Redes */}
          {(negocio.lpUrl || lead?.lpUrl || lead?.facebook || lead?.instagram || empresa?.website || empresa?.facebook || empresa?.instagram) && (
            <div className="card-solid p-4">
              <h3 className="text-sm font-medium text-white/50 mb-3">Links & Redes</h3>
              <div className="space-y-2">
                {(negocio.lpUrl || lead?.lpUrl) && (
                  <a href={negocio.lpUrl || lead?.lpUrl} target="_blank" rel="noopener" className="flex items-center gap-2 text-xs text-blue-400/70 hover:text-blue-400 p-1.5 rounded-lg hover:bg-white/[0.04] transition-all">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    <span className="truncate">{negocio.lpUrl || lead?.lpUrl}</span>
                  </a>
                )}
                {(lead?.facebook || empresa?.facebook) && (
                  <a href={lead?.facebook || empresa?.facebook} target="_blank" rel="noopener" className="flex items-center gap-2 text-xs text-blue-400/70 hover:text-blue-400 p-1.5 rounded-lg hover:bg-white/[0.04] transition-all">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                    <span className="truncate">{lead?.facebook || empresa?.facebook}</span>
                  </a>
                )}
                {(lead?.instagram || empresa?.instagram) && (
                  <a href={(lead?.instagram || empresa?.instagram || "").startsWith("http") ? (lead?.instagram || empresa?.instagram) : `https://instagram.com/${(lead?.instagram || empresa?.instagram || "").replace("@", "")}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-white/[0.04] transition-all" style={{ color: "rgba(225, 48, 108, 0.7)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                    <span className="truncate">{lead?.instagram || empresa?.instagram}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Qualificação SDR (herdada do lead, vinda da pré-vendas) — só leitura */}
          {lead?.id && (
            <div className="card-solid p-4">
              <QualificacaoSdrSection
                leadId={lead.id}
                camposCustom={(lead as Record<string, unknown>).camposCustom as Record<string, unknown> | null | undefined}
                readOnly
              />
            </div>
          )}

          {/* Details */}
          <div className="card-solid p-4">
            <h3 className="text-sm font-medium text-white/50 mb-3">Detalhes</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">Criado</span>
                <span className="text-white/70">{new Date(negocio.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
              {negocio.ganhoAt && (
                <div className="flex justify-between">
                  <span className="text-white/40">Ganho em</span>
                  <span className="text-emerald-400">{new Date(negocio.ganhoAt).toLocaleDateString("pt-BR")}</span>
                </div>
              )}
              {negocio.concorrenteAtual && (
                <div className="flex justify-between">
                  <span className="text-white/40">Concorrente</span>
                  <span className="text-white/70">{negocio.concorrenteAtual}</span>
                </div>
              )}
              {negocio.contratoVenceEm && (
                <div className="flex justify-between">
                  <span className="text-white/40">Contrato vence</span>
                  <span className="text-white/70">{negocio.contratoVenceEm}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loss modal */}
      {showLossModal && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowLossModal(false)}>
          <div className="modal-content p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-4">Marcar como Perdido</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-white/50 mb-1 block">Motivo da perda *</label>
                <p className="text-[10px] text-white/25 mt-1 mb-2">Registrar o motivo ajuda a identificar padrões e melhorar a taxa de conversão.</p>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full dark-input text-sm"
                >
                  <option value="">Selecione...</option>
                  {lossReasons.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-white/50 mb-1 block">Detalhes (opcional)</label>
                <textarea
                  value={lossDetail}
                  onChange={(e) => setLossDetail(e.target.value)}
                  className="w-full dark-input text-sm"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={() => setShowLossModal(false)} className="px-4 py-2 text-sm text-white/50 hover:text-white">
                  Cancelar
                </button>
                <button
                  onClick={handleLoss}
                  disabled={!lossReason}
                  className="px-4 py-2 text-sm font-medium bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-40"
                >
                  Confirmar Perda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* F4/Won Evidence Modal — 3ª via de evidência (PBX/venda manual, fora do Stripe/proposta) */}
      {showEvidenciaModal && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowEvidenciaModal(false)}>
          <div className="modal-content p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Anexar evidência de fechamento</h2>
            </div>
            <p className="text-xs text-white/40 mb-4">
              Este negócio não tem contrato assinado nem pagamento confirmado — sem isso não é possível marcar como ganho. Se a venda aconteceu fora do sistema (ex: PBX, fechamento manual), registre a evidência abaixo. Fica sempre auditado.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-white/50 mb-1 block">Tipo de evidência</label>
                <select
                  value={evidenciaTipo}
                  onChange={(e) => setEvidenciaTipo(e.target.value as "manual_contract" | "admin_approval")}
                  className="w-full dark-input text-sm"
                >
                  <option value="manual_contract">Contrato assinado fora do sistema</option>
                  <option value="admin_approval">Aprovação de admin/gerente</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-white/50 mb-1 block">Nota *</label>
                <p className="text-[10px] text-white/25 mb-1">Descreva a evidência (ex: nº do documento, onde o contrato está guardado).</p>
                <textarea
                  value={evidenciaNota}
                  onChange={(e) => setEvidenciaNota(e.target.value)}
                  className="w-full dark-input text-sm"
                  rows={3}
                  placeholder="Ex: Contrato PBX assinado em PDF, enviado por email em 09/08, arquivado no Drive do comercial."
                />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={() => setShowEvidenciaModal(false)} className="px-4 py-2 text-sm text-white/50 hover:text-white">
                  Cancelar
                </button>
                <button
                  onClick={() => anexarEvidencia.mutate()}
                  disabled={!evidenciaNota.trim() || anexarEvidencia.isPending}
                  className="px-4 py-2 text-sm font-medium bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 disabled:opacity-40"
                >
                  {anexarEvidencia.isPending ? "Anexando..." : "Anexar e marcar como ganho"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Negocio Modal */}
      {showEditModal && (
        <EditNegocioModal
          negocio={negocio}
          onClose={() => setShowEditModal(false)}
          onSaved={(updates) => {
            updateNegocio.mutate(updates);
            setShowEditModal(false);
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-2">Excluir Negócio</h3>
            <p className="text-sm text-white/50 mb-4">
              Tem certeza que deseja excluir <strong className="text-white/70">{negocio.titulo}</strong>?
              {negocio.status !== "novo" && (
                <span className="block mt-1 text-amber-400">Apenas negócios com status &quot;novo&quot; podem ser excluídos.</span>
              )}
            </p>
            {deleteNegocio.isError && (
              <p className="text-sm text-red-400 mb-3">{(deleteNegocio.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white">Cancelar</button>
              <button
                onClick={() => deleteNegocio.mutate()}
                disabled={deleteNegocio.isPending}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
              >
                {deleteNegocio.isPending ? "Excluindo..." : "Excluir"}
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
        onOpenLead={(lid) => { setDrawerEmpresaId(null); setDrawerLeadId(lid); }}
      />
      <LeadDrawer
        leadId={drawerLeadId}
        open={!!drawerLeadId}
        onClose={() => setDrawerLeadId(null)}
        onOpenEmpresa={(eid) => { setDrawerLeadId(null); setDrawerEmpresaId(eid); }}
      />
    </div>
  );
}

function EditNegocioModal({ negocio, onClose, onSaved }: {
  negocio: Record<string, unknown>;
  onClose: () => void;
  onSaved: (updates: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    titulo: (negocio.titulo as string) || "",
    temperatura: (negocio.temperatura as string) || "indefinido",
    concorrenteAtual: (negocio.concorrenteAtual as string) || "",
    contratoVenceEm: (negocio.contratoVenceEm as string) || "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, unknown> = {};
    if (form.titulo && form.titulo !== negocio.titulo) updates.titulo = form.titulo;
    if (form.temperatura !== (negocio.temperatura || "indefinido")) updates.temperatura = form.temperatura;
    if (form.concorrenteAtual !== (negocio.concorrenteAtual || "")) updates.concorrenteAtual = form.concorrenteAtual || null;
    if (form.contratoVenceEm !== (negocio.contratoVenceEm || "")) updates.contratoVenceEm = form.contratoVenceEm || null;
    if (Object.keys(updates).length > 0) {
      onSaved(updates);
    } else {
      onClose();
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">Editar Negócio</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.06] rounded"><X className="w-4 h-4 text-white/40" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Título *</label>
            <input required value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Valor Total (R$)</label>
              <p className="w-full dark-input rounded-lg px-3 py-2 text-sm text-white/40">R$ {parseFloat((negocio.valorTotal as string) || "0").toLocaleString("pt-BR")} <span className="text-[10px]">(auto)</span><span className="text-[10px] text-white/25 ml-1">Calculado a partir das propostas aceitas</span></p>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Temperatura</label>
              <select value={form.temperatura} onChange={e => setForm({...form, temperatura: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm">
                <option value="indefinido">Indefinido</option>
                <option value="quente">Quente</option>
                <option value="morno">Morno</option>
                <option value="frio">Frio</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Concorrente</label>
              <input value={form.concorrenteAtual} onChange={e => setForm({...form, concorrenteAtual: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Contrato vence em</label>
              <input type="date" value={form.contratoVenceEm} onChange={e => setForm({...form, contratoVenceEm: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
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
