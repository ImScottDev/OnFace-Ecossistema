"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { CustomFieldsSection } from "@/components/crm/CustomFieldsSection";
import { Building2, User, Briefcase, Globe, MapPin, Phone, Instagram, Pencil, StickyNote, Plus, Send } from "lucide-react";
import { usePipelineConfig } from "@/hooks/usePipelineConfig";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

interface EmpresaDrawerProps {
  empresaId: string | null;
  open: boolean;
  onClose: () => void;
  onOpenLead?: (id: string) => void;
  onOpenNegocio?: (id: string) => void;
}

function AddNoteInlineEmpresa({ empresaId }: { empresaId: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const addNota = useMutation({
    mutationFn: async (conteudo: string) => {
      const res = await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo, empresaId }) });
      if (!res.ok) throw new Error("Falha");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] }); setText(""); setOpen(false); },
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
      <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma nota..." className="w-full text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-white/70 placeholder:text-white/20 outline-none focus:border-[#e23752]/30 resize-y" rows={4}
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

export function EmpresaDrawer({ empresaId, open, onClose, onOpenLead, onOpenNegocio }: EmpresaDrawerProps) {
  const { setores } = usePipelineConfig();
  const queryClient = useQueryClient();

  const updateEmpresaCustomFields = useMutation({
    mutationFn: async (camposCustom: Record<string, unknown>) => {
      await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camposCustom }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["empresa", empresaId],
    queryFn: async () => {
      const res = await fetch(`/api/empresas/${empresaId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!empresaId && open,
  });

  const empresa = data?.empresa;
  const leads = data?.leads;
  const negocios = data?.negocios;
  const notas: Array<{ id: string; conteudo: string; autorNome: string | null; createdAt: string }> = data?.notas || [];
  const setorLabel = empresa ? setores.find((s) => s.key === empresa.setor)?.label : undefined;

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={empresa?.nome || "Empresa"}
      subtitle={[setorLabel, empresa?.porte && empresa.porte.charAt(0).toUpperCase() + empresa.porte.slice(1)].filter(Boolean).join(" · ") || undefined}
      fullPageHref={empresaId ? `/empresas/${empresaId}` : undefined}
    >
      {isLoading ? (
        <div className="p-8 text-white/40 text-center text-sm">Carregando...</div>
      ) : !empresa ? (
        <div className="p-8 text-white/40 text-center text-sm">Empresa nao encontrada</div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Header icon / logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#e23752]/15 flex items-center justify-center shrink-0 overflow-hidden">
              {empresa.logoUrl ? (
                <img src={empresa.logoUrl} alt={empresa.nome} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="w-5 h-5 text-[#e23752]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white truncate">{empresa.nome}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {setorLabel && <span className="text-xs text-white/40">{setorLabel}</span>}
                {empresa.industry && empresa.industry !== setorLabel && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">{empresa.industry}</span>
                )}
                {empresa.employeeCount && (
                  <span className="text-[10px] text-white/30">{Number(empresa.employeeCount).toLocaleString("pt-BR")} func.</span>
                )}
              </div>
            </div>
          </div>

          {/* Apollo description */}
          {empresa.apolloDescription && (
            <p className="text-xs text-white/40 leading-relaxed">{String(empresa.apolloDescription).length > 200 ? String(empresa.apolloDescription).slice(0, 200) + "..." : empresa.apolloDescription}</p>
          )}

          {/* Info section */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <h3 className="text-xs font-medium text-white/50 mb-2.5">Informacoes</h3>
            <div className="space-y-2.5 text-sm">
              {empresa.cnpj && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">CNPJ</p>
                  <p className="text-white/70 font-mono text-xs">{empresa.cnpj}</p>
                </div>
              )}
              {empresa.porte && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">Porte</p>
                  <p className="text-white/70 text-xs capitalize">{empresa.porte}</p>
                </div>
              )}
              {(empresa.cidade || empresa.estado) && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <p className="text-white/70 text-xs">{[empresa.cidade, empresa.estado].filter(Boolean).join(" / ")}</p>
                </div>
              )}
              {empresa.telefone && (
                <div className="flex items-start gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <p className="text-white/70 text-xs">{empresa.telefone}</p>
                </div>
              )}
              {empresa.website && (
                <div className="flex items-start gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <a
                    href={empresa.website.startsWith("http") ? empresa.website : `https://${empresa.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e23752] hover:underline text-xs truncate"
                  >
                    {empresa.website}
                  </a>
                </div>
              )}
              {empresa.instagram && (
                <div className="flex items-start gap-1.5">
                  <Instagram className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <a
                    href={`https://instagram.com/${(empresa.instagram as string).replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e23752] hover:underline text-xs truncate"
                  >
                    @{(empresa.instagram as string).replace(/^@/, "")}
                  </a>
                </div>
              )}
              {empresa.tiktok && (
                <div className="flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52V6.8a4.84 4.84 0 01-1-.11z" />
                  </svg>
                  <a
                    href={`https://tiktok.com/@${(empresa.tiktok as string).replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e23752] hover:underline text-xs truncate"
                  >
                    @{(empresa.tiktok as string).replace(/^@/, "")}
                  </a>
                </div>
              )}
              {empresa.linkedin && (
                <div className="flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  <a href={String(empresa.linkedin).startsWith("http") ? String(empresa.linkedin) : `https://linkedin.com/company/${empresa.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-[#e23752] hover:underline text-xs truncate">LinkedIn</a>
                </div>
              )}
              {/* Apollo metrics row */}
              {(empresa.annualRevenue || empresa.foundedYear) && (
                <div className="flex items-center gap-3 pt-1 border-t border-white/[0.04]">
                  {empresa.annualRevenue && (
                    <div>
                      <p className="text-[10px] text-white/30">Receita</p>
                      <p className="text-xs text-white/60">{empresa.annualRevenue}</p>
                    </div>
                  )}
                  {empresa.foundedYear && (
                    <div>
                      <p className="text-[10px] text-white/30">Fundada</p>
                      <p className="text-xs text-white/60">{empresa.foundedYear}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Leads */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <h3 className="text-xs font-medium text-white/50 mb-2.5">Leads ({leads?.length || 0})</h3>
            {leads && leads.length > 0 ? (
              <div className="space-y-1.5">
                {leads.map((l: { id: string; nome: string; email: string | null; telefone: string; cargo: string | null; tipo: string; leadScore: number }) => (
                  <button
                    key={l.id}
                    onClick={() => onOpenLead?.(l.id)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#e23752]/20 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-[#e23752]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{l.nome}</p>
                      <p className="text-[10px] text-white/40 truncate">{l.cargo || l.email || l.telefone}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                          l.tipo === "cliente"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : l.tipo === "lead"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-white/[0.06] text-white/40"
                        }`}
                      >
                        {l.tipo}
                      </span>
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: l.leadScore >= 70 ? "#10B981" : l.leadScore >= 40 ? "#F59E0B" : "rgba(255,255,255,0.3)" }}
                      >
                        {l.leadScore}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/30 py-2 text-center">Nenhum lead vinculado</p>
            )}
          </div>

          {/* Negocios */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <h3 className="text-xs font-medium text-white/50 mb-2.5">Negocios ({negocios?.length || 0})</h3>
            {negocios && negocios.length > 0 ? (
              <div className="space-y-1.5">
                {negocios.map((n: { id: string; titulo: string; status: string; mrrEstimado: string | null; valorProjeto: string | null; valorTotal: string | null; createdAt: string }) => {
                  const total = parseFloat(n.valorTotal || "0") || (parseFloat(n.mrrEstimado || "0") || 0) + (parseFloat(n.valorProjeto || "0") || 0);

                  return (
                    <button
                      key={n.id}
                      onClick={() => onOpenNegocio?.(n.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] text-left transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Briefcase className="w-3.5 h-3.5 text-white/30 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate">{n.titulo}</p>
                          <p className="text-[10px] text-white/40">{new Date(n.createdAt).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            n.status === "ganho"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : n.status === "perdido"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-white/[0.06] text-white/50"
                          }`}
                        >
                          {n.status}
                        </span>
                        {total > 0 && (
                          <span className="text-[10px] text-[#e23752] font-medium">
                            R$ {total.toLocaleString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/30 py-2 text-center">Nenhum negocio vinculado</p>
            )}
          </div>

          {/* Custom Fields */}
          <CustomFieldsSection
            entidade="empresa"
            valores={empresa?.camposCustom as Record<string, unknown> | null | undefined}
            onUpdate={(campos) => updateEmpresaCustomFields.mutate(campos)}
          />

          {/* Notas */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5">
            <h3 className="text-xs font-medium text-white/50 mb-2.5">
              <StickyNote className="w-3 h-3 inline mr-1" />
              Notas {notas.length > 0 && `(${notas.length})`}
            </h3>
            {notas.length > 0 && (
              <div className="space-y-1.5">
                {notas.slice(0, 3).map((n) => (
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
                {notas.length > 3 && (
                  <p className="text-[10px] text-white/30 text-center pt-1">+{notas.length - 3} notas</p>
                )}
              </div>
            )}
            {empresaId && <AddNoteInlineEmpresa empresaId={empresaId} />}
          </div>

          {/* Editar button */}
          <div className="pt-1">
            <Link
              href={`/empresas/${empresaId}`}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium text-[#e23752] hover:bg-[#e23752]/10 transition-colors border border-[#e23752]/20"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Link>
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
