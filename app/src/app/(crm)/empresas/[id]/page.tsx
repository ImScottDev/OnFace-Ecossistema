"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, User, Briefcase, Pencil, Trash2, X, Plus, Globe, MapPin, Phone, Instagram, Sparkles } from "lucide-react";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import { LeadDrawer } from "@/components/crm/LeadDrawer";
import { NegocioDrawer } from "@/components/crm/NegocioDrawer";

export default function EmpresaDetailPage() {
  const { setores } = usePipelineConfig();
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerNegocioId, setDrawerNegocioId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["empresa", id],
    queryFn: async () => {
      const res = await fetch(`/api/empresas/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const updateEmpresa = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao atualizar");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa", id] });
    },
  });

  const deleteEmpresa = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/empresas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao excluir");
      }
      return res.json();
    },
    onSuccess: () => {
      router.push("/empresas");
    },
  });

  if (isLoading) return <div className="p-8 text-white/40 text-center">Carregando...</div>;
  if (!data?.empresa) return <div className="p-8 text-white/40 text-center">Empresa não encontrada</div>;

  const { empresa, leads, negocios } = data;
  const setorLabel = setores.find((s) => s.key === empresa.setor)?.label;

  return (
    <div className="page-scroll space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#e23752]/15 flex items-center justify-center shrink-0 overflow-hidden">
              {empresa.logoUrl ? (
                <img src={empresa.logoUrl} alt={empresa.nome} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="w-6 h-6 text-[#e23752]" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white truncate">{empresa.nome}</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-white/40">
                  {[setorLabel, empresa.porte && empresa.porte.charAt(0).toUpperCase() + empresa.porte.slice(1)].filter(Boolean).join(" · ") || "Empresa"}
                </p>
                {empresa.enrichStatus === "enriched" && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400">Apollo</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              setEnriching(true);
              try {
                const res = await fetch(`/api/empresas/${id}/enrich`, { method: "POST" });
                const data = await res.json();
                if (!res.ok) {
                  if (res.status === 400 && data.error?.includes("API key")) {
                    alert("Apollo API key não configurada.\nPeça ao administrador para configurar em Admin > Organizações > Integrações.");
                  } else {
                    alert(data.error || "Erro ao enriquecer");
                  }
                } else if (data.status === "enriched" || data.status === "not_found") {
                  queryClient.invalidateQueries({ queryKey: ["empresa", id] });
                }
              } catch { alert("Erro de conexão"); } finally { setEnriching(false); }
            }}
            disabled={enriching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" /> {enriching ? "Enriquecendo..." : empresa.enrichStatus === "enriched" ? "Re-enriquecer (1 crédito)" : "Enriquecer (1 crédito)"}
          </button>
          <p className="text-[10px] text-white/25 mt-1">Adiciona informações públicas: setor, tamanho, redes sociais e descrição.</p>
          <button onClick={() => setShowEditModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e23752] hover:bg-[#e23752]/10 transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Leads */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white/50">Leads ({leads?.length || 0})</h3>
            </div>
            {leads && leads.length > 0 ? (
              <div className="space-y-2">
                {leads.map((l: { id: string; nome: string; email: string | null; telefone: string; cargo: string | null; tipo: string; leadScore: number }) => (
                  <button key={l.id} onClick={() => setDrawerLeadId(l.id)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/[0.04] w-full text-left cursor-pointer">
                    <div className="w-9 h-9 rounded-full bg-[#e23752]/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-[#e23752]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{l.nome}</p>
                      <p className="text-xs text-white/40 truncate">{l.cargo || l.email || l.telefone}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${l.tipo === "cliente" ? "bg-emerald-500/15 text-emerald-400" : l.tipo === "lead" ? "bg-blue-500/15 text-blue-400" : "bg-white/[0.06] text-white/40"}`}>
                        {l.tipo}
                      </span>
                      <span className="text-xs font-medium" style={{ color: l.leadScore >= 70 ? "#10B981" : l.leadScore >= 40 ? "#F59E0B" : "rgba(255,255,255,0.3)" }}>
                        {l.leadScore}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/30 py-4 text-center">Nenhum contato vinculado. Crie leads associados a esta empresa.</p>
            )}
          </div>

          {/* Negócios */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white/50">Negócios ({negocios?.length || 0})</h3>
            </div>
            {negocios && negocios.length > 0 ? (
              <div className="space-y-2">
                {negocios.map((n: { id: string; titulo: string; status: string; mrrEstimado: string | null; valorProjeto: string | null; createdAt: string }) => {
                  const mrr = parseFloat(n.mrrEstimado || "0") || 0;
                  const proj = parseFloat(n.valorProjeto || "0") || 0;
                  const total = mrr + proj;

                  return (
                    <button key={n.id} onClick={() => setDrawerNegocioId(n.id)} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] w-full text-left cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <Briefcase className="w-4 h-4 text-white/30 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{n.titulo}</p>
                          <p className="text-xs text-white/40">{new Date(n.createdAt).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          n.status === "ganho" ? "bg-emerald-500/15 text-emerald-400" :
                          n.status === "perdido" ? "bg-red-500/15 text-red-400" :
                          "bg-white/[0.06] text-white/50"
                        }`}>
                          {n.status}
                        </span>
                        {total > 0 && <span className="text-xs text-[#e23752] font-medium">R$ {total.toLocaleString("pt-BR")}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/30 py-4 text-center">Nenhum negócio vinculado. Converta um lead desta empresa em negócio.</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info card */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <h3 className="text-sm font-medium text-white/50 mb-3">Informações</h3>
            <div className="space-y-3 text-sm">
              {empresa.cnpj && (
                <div>
                  <p className="text-xs text-white/40">CNPJ</p>
                  <p className="text-white/70 font-mono">{empresa.cnpj}</p>
                </div>
              )}
              {setorLabel && (
                <div>
                  <p className="text-xs text-white/40">Setor</p>
                  <p className="text-white/70">{setorLabel}</p>
                </div>
              )}
              {empresa.porte && (
                <div>
                  <p className="text-xs text-white/40">Porte</p>
                  <p className="text-white/70 capitalize">{empresa.porte}</p>
                </div>
              )}
              {(empresa.cidade || empresa.estado) && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <p className="text-white/70">{[empresa.cidade, empresa.estado].filter(Boolean).join(" / ")}</p>
                </div>
              )}
              {empresa.website && (
                <div className="flex items-start gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <a href={empresa.website.startsWith("http") ? empresa.website : `https://${empresa.website}`} target="_blank" rel="noopener noreferrer" className="text-[#e23752] hover:underline truncate">
                    {empresa.website}
                  </a>
                </div>
              )}
              {empresa.instagram && (
                <div className="flex items-start gap-1.5">
                  <Instagram className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <a href={`https://instagram.com/${(empresa.instagram as string).replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-[#e23752] hover:underline truncate">
                    @{(empresa.instagram as string).replace(/^@/, "")}
                  </a>
                </div>
              )}
              {empresa.tiktok && (
                <div className="flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52V6.8a4.84 4.84 0 01-1-.11z"/></svg>
                  <a href={`https://tiktok.com/@${(empresa.tiktok as string).replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-[#e23752] hover:underline truncate">
                    @{(empresa.tiktok as string).replace(/^@/, "")}
                  </a>
                </div>
              )}
              {empresa.telefone && (
                <div className="flex items-start gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <p className="text-white/70">{empresa.telefone as string}</p>
                </div>
              )}
              {empresa.numUsuariosTi && (
                <div>
                  <p className="text-xs text-white/40">Usuários de TI</p>
                  <p className="text-white/70">{empresa.numUsuariosTi}</p>
                </div>
              )}
              {empresa.numFiliais && (
                <div>
                  <p className="text-xs text-white/40">Filiais</p>
                  <p className="text-white/70">{empresa.numFiliais}</p>
                </div>
              )}
              {empresa.industry && (
                <div>
                  <p className="text-xs text-white/40">Setor (Apollo)</p>
                  <p className="text-white/70">{empresa.industry}</p>
                </div>
              )}
              {empresa.employeeCount && (
                <div>
                  <p className="text-xs text-white/40">Funcionários</p>
                  <p className="text-white/70">{empresa.employeeCount.toLocaleString("pt-BR")}</p>
                </div>
              )}
              {empresa.annualRevenue && (
                <div>
                  <p className="text-xs text-white/40">Receita Anual</p>
                  <p className="text-white/70">{empresa.annualRevenue}</p>
                </div>
              )}
              {empresa.foundedYear && (
                <div>
                  <p className="text-xs text-white/40">Fundada em</p>
                  <p className="text-white/70">{empresa.foundedYear}</p>
                </div>
              )}
            </div>
          </div>

          {/* Apollo Insights */}
          {(() => {
            const techStack = (empresa.techStack as string[]) || [];
            const keywords = (empresa.apolloKeywords as string[]) || [];
            const desc = empresa.apolloDescription as string | undefined;
            const hasFunding = empresa.totalFunding || empresa.fundingStage;
            const hasGrowth = empresa.growth6m || empresa.growth12m;
            const hasSocial = empresa.linkedin || empresa.twitter || empresa.facebook;
            if (!techStack.length && !desc && !hasFunding && !hasGrowth && !hasSocial) return null;
            return (
              <div className="rounded-xl border border-purple-500/20 p-4 space-y-3" style={{ background: "rgba(167,139,250,0.04)" }}>
                <h3 className="text-sm font-medium text-purple-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Apollo Insights
                </h3>
                {desc && (
                  <p className="text-xs text-white/50 leading-relaxed">{desc.length > 400 ? desc.slice(0, 400) + "..." : desc}</p>
                )}
                {/* Funding & Growth */}
                {(hasFunding || hasGrowth) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {empresa.totalFunding && (
                      <div>
                        <p className="text-[10px] text-white/30 uppercase">Funding Total</p>
                        <p className="text-sm text-white/70 font-medium">{empresa.totalFunding}</p>
                        {empresa.fundingStage && <p className="text-[10px] text-purple-400/60 capitalize">{String(empresa.fundingStage).replace(/-/g, " ")}</p>}
                      </div>
                    )}
                    {hasGrowth && (
                      <div>
                        <p className="text-[10px] text-white/30 uppercase">Crescimento</p>
                        {empresa.growth6m && (
                          <p className="text-xs text-white/60">
                            6m: <span className={parseFloat(empresa.growth6m) >= 0 ? "text-emerald-400" : "text-red-400"}>{parseFloat(empresa.growth6m) >= 0 ? "+" : ""}{(parseFloat(empresa.growth6m) * 100).toFixed(1)}%</span>
                          </p>
                        )}
                        {empresa.growth12m && (
                          <p className="text-xs text-white/60">
                            12m: <span className={parseFloat(empresa.growth12m) >= 0 ? "text-emerald-400" : "text-red-400"}>{parseFloat(empresa.growth12m) >= 0 ? "+" : ""}{(parseFloat(empresa.growth12m) * 100).toFixed(1)}%</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {techStack.length > 0 && (
                  <div>
                    <p className="text-[10px] text-white/30 uppercase mb-1.5">Tech Stack</p>
                    <div className="flex flex-wrap gap-1.5">
                      {techStack.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#e23752]/10 text-[#e23752] border border-[#e23752]/20">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {keywords.length > 0 && (
                  <div>
                    <p className="text-[10px] text-white/30 uppercase mb-1.5">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {keywords.map((k: string) => (
                        <span key={k} className="px-1.5 py-0.5 rounded text-[10px] text-white/30 bg-white/[0.04]">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Social links */}
                {hasSocial && (
                  <div className="flex items-center gap-2 pt-1 border-t border-purple-500/10">
                    {empresa.linkedin && (
                      <a href={String(empresa.linkedin).startsWith("http") ? String(empresa.linkedin) : `https://linkedin.com/company/${empresa.linkedin}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="LinkedIn">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </a>
                    )}
                    {empresa.twitter && (
                      <a href={String(empresa.twitter).startsWith("http") ? String(empresa.twitter) : `https://twitter.com/${empresa.twitter}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="Twitter/X">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                    )}
                    {empresa.facebook && (
                      <a href={String(empresa.facebook).startsWith("http") ? String(empresa.facebook) : `https://facebook.com/${empresa.facebook}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="Facebook">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Stats */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <h3 className="text-sm font-medium text-white/50 mb-3">Resumo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-white/40">Leads</p>
                <p className="text-lg font-bold text-white">{leads?.length || 0}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Negócios</p>
                <p className="text-lg font-bold text-white">{negocios?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">Criada em</span>
                <span className="text-white/70">{new Date(empresa.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Atualizada em</span>
                <span className="text-white/70">{new Date(empresa.updatedAt).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditEmpresaModal
          empresa={empresa}
          onClose={() => setShowEditModal(false)}
          onSaved={(updates) => {
            updateEmpresa.mutate(updates);
            setShowEditModal(false);
          }}
        />
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-white mb-2">Excluir Empresa</h3>
            <p className="text-sm text-white/50 mb-4">
              Tem certeza que deseja excluir <strong className="text-white/70">{empresa.nome}</strong>?
              {(leads?.length > 0 || negocios?.length > 0) && (
                <span className="block mt-1 text-amber-400">Esta empresa possui leads ou negócios vinculados. Desvincule-os primeiro.</span>
              )}
            </p>
            {deleteEmpresa.isError && (
              <p className="text-sm text-red-400 mb-3">{(deleteEmpresa.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-white/70 hover:text-white">Cancelar</button>
              <button
                onClick={() => deleteEmpresa.mutate()}
                disabled={deleteEmpresa.isPending}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
              >
                {deleteEmpresa.isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entity Drawers */}
      <LeadDrawer
        leadId={drawerLeadId}
        open={!!drawerLeadId}
        onClose={() => setDrawerLeadId(null)}
        onOpenNegocio={(nid) => { setDrawerLeadId(null); setDrawerNegocioId(nid); }}
      />
      <NegocioDrawer
        negocioId={drawerNegocioId}
        open={!!drawerNegocioId}
        onClose={() => setDrawerNegocioId(null)}
        onOpenLead={(lid) => { setDrawerNegocioId(null); setDrawerLeadId(lid); }}
      />
    </div>
  );
}

function EditEmpresaModal({ empresa, onClose, onSaved }: {
  empresa: Record<string, unknown>;
  onClose: () => void;
  onSaved: (updates: Record<string, unknown>) => void;
}) {
  const { setores } = usePipelineConfig();
  const [form, setForm] = useState({
    nome: (empresa.nome as string) || "",
    cnpj: (empresa.cnpj as string) || "",
    setor: (empresa.setor as string) || "",
    porte: (empresa.porte as string) || "",
    cidade: (empresa.cidade as string) || "",
    estado: (empresa.estado as string) || "",
    website: (empresa.website as string) || "",
    instagram: (empresa.instagram as string) || "",
    tiktok: (empresa.tiktok as string) || "",
    telefone: (empresa.telefone as string) || "",
    numUsuariosTi: empresa.numUsuariosTi != null ? String(empresa.numUsuariosTi) : "",
    numFiliais: empresa.numFiliais != null ? String(empresa.numFiliais) : "",
    observacoes: (empresa.observacoes as string) || "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, unknown> = {};
    if (form.nome && form.nome !== empresa.nome) updates.nome = form.nome;
    if (form.cnpj !== (empresa.cnpj || "")) updates.cnpj = form.cnpj || null;
    if (form.setor !== (empresa.setor || "")) updates.setor = form.setor || null;
    if (form.porte !== (empresa.porte || "")) updates.porte = form.porte || null;
    if (form.cidade !== (empresa.cidade || "")) updates.cidade = form.cidade || null;
    if (form.estado !== (empresa.estado || "")) updates.estado = form.estado || null;
    if (form.website !== (empresa.website || "")) updates.website = form.website || null;
    if (form.instagram !== (empresa.instagram || "")) updates.instagram = form.instagram || null;
    if (form.tiktok !== (empresa.tiktok || "")) updates.tiktok = form.tiktok || null;
    if (form.telefone !== (empresa.telefone || "")) updates.telefone = form.telefone || null;
    if (form.numUsuariosTi !== (empresa.numUsuariosTi != null ? String(empresa.numUsuariosTi) : "")) updates.numUsuariosTi = form.numUsuariosTi ? parseInt(form.numUsuariosTi) : null;
    if (form.numFiliais !== (empresa.numFiliais != null ? String(empresa.numFiliais) : "")) updates.numFiliais = form.numFiliais ? parseInt(form.numFiliais) : null;
    if (form.observacoes !== (empresa.observacoes || "")) updates.observacoes = form.observacoes || null;
    if (Object.keys(updates).length > 0) {
      onSaved(updates);
    } else {
      onClose();
    }
  }

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-content p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white">Editar Empresa</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.06] rounded"><X className="w-4 h-4 text-white/40" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Nome *</label>
            <input required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">CNPJ</label>
            <input value={form.cnpj} onChange={e => setForm({...form, cnpj: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Setor</label>
              <select value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm">
                <option value="">—</option>
                {setores.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Porte</label>
              <select value={form.porte} onChange={e => setForm({...form, porte: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm">
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
              <input value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Estado</label>
              <input value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Website</label>
            <input value={form.website} onChange={e => setForm({...form, website: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Instagram</label>
              <input value={form.instagram} onChange={e => setForm({...form, instagram: e.target.value})} placeholder="@perfil" className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">TikTok</label>
              <input value={form.tiktok} onChange={e => setForm({...form, tiktok: e.target.value})} placeholder="@perfil" className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Telefone</label>
            <input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(XX) XXXXX-XXXX" className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Usuários TI</label>
              <input type="number" value={form.numUsuariosTi} onChange={e => setForm({...form, numUsuariosTi: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Filiais</label>
              <input type="number" value={form.numFiliais} onChange={e => setForm({...form, numFiliais: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Observações</label>
            <textarea value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" rows={3} />
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
