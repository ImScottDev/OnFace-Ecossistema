"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePipelineConfig, usePipelines } from "@/hooks/usePipelineConfig";

interface Lead {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
}

// GET /api/leads/:id devolve { lead: {...}, empresa: {...}|null, negocios: [...], ... }
// — NÃO é o lead solto. Usar preselectedLead.lead, nunca preselectedLead direto
// (bug real: título saía "[object Object] — Negócio" por interpolar o objeto empresa).
interface LeadDetailResponse {
  lead: Lead;
}

export default function NovoNegocioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preLeadId = searchParams.get("leadId");
  const { stages, servicos } = usePipelineConfig();
  const { pipelines } = usePipelines();

  const [form, setForm] = useState({
    titulo: "",
    leadId: preLeadId || "",
    tipoReceita: "projeto" as string,
    servicosInteresse: [] as string[],
    origemNegocio: "novo" as string,
    pipelineId: "" as string,
  });

  const [leadSearch, setLeadSearch] = useState("");
  const [showLeadList, setShowLeadList] = useState(!preLeadId);

  // Fetch lead if preselected
  const { data: preselectedLeadResponse } = useQuery<LeadDetailResponse>({
    queryKey: ["lead-pre", preLeadId],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${preLeadId}`);
      return res.json();
    },
    enabled: !!preLeadId,
  });
  const preselectedLead = preselectedLeadResponse?.lead;

  // Pipeline: sem isso o negócio nasce com pipeline_id NULL e some do board
  // do Pipeline (que sempre filtra por pipelineId da aba ativa) — bug real
  // encontrado 05/08, negócio ficava só visível no drawer do contato.
  useEffect(() => {
    if (pipelines.length > 0 && !form.pipelineId) {
      const def = pipelines.find(p => p.isDefault) || pipelines[0];
      if (def) setForm(f => ({ ...f, pipelineId: def.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelines]);

  // Search leads
  const { data: leadsList } = useQuery<Lead[]>({
    queryKey: ["leads-search-neg", leadSearch],
    queryFn: async () => {
      const res = await fetch(`/api/leads?limit=10${leadSearch ? `&q=${encodeURIComponent(leadSearch)}` : ""}`);
      const data = await res.json();
      return data.leads || data || [];
    },
    enabled: showLeadList,
  });

  // Set title from preselected lead
  useEffect(() => {
    if (preselectedLead && !form.titulo) {
      setForm(f => ({ ...f, titulo: `${preselectedLead.empresa || preselectedLead.nome} — Negócio` }));
      setLeadSearch(preselectedLead.nome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedLead]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/negocios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, pipelineId: form.pipelineId || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao criar negócio");
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/negocios/${data.id}`);
    },
  });

  return (
    <div className="page-scroll space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/pipeline" className="p-2 hover:bg-white/[0.06] rounded-lg">
          <ArrowLeft className="w-5 h-5 text-white/50" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Novo Negócio</h1>
      </div>

      <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
        {/* Lead */}
        <div className="relative">
          <label className="text-xs text-white/50 mb-1 block">Lead / Contato</label>
          {preLeadId && preselectedLead ? (
            <div className="dark-input rounded-lg px-3 py-2 text-sm text-white">
              {preselectedLead.nome} {preselectedLead.empresa ? `· ${preselectedLead.empresa}` : ""}
            </div>
          ) : (
            <>
              <input
                value={leadSearch}
                onChange={e => { setLeadSearch(e.target.value); setShowLeadList(true); }}
                onFocus={() => setShowLeadList(true)}
                className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none"
                placeholder="Buscar lead..."
              />
              {form.leadId && <span className="absolute right-2 top-7 text-xs text-green-400">selecionado</span>}
              {showLeadList && leadsList && leadsList.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg max-h-40 overflow-y-auto">
                  {leadsList.map(l => (
                    <button key={l.id} type="button" onClick={() => {
                      setForm(f => ({ ...f, leadId: l.id, titulo: f.titulo || `${l.empresa || l.nome} — Negócio` }));
                      setLeadSearch(l.nome);
                      setShowLeadList(false);
                    }} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10">
                      {l.nome} {l.empresa ? <span className="text-white/40">· {l.empresa}</span> : ""}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Título */}
        <div>
          <label className="text-xs text-white/50 mb-1 block">Título do Negócio</label>
          <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm outline-none" placeholder="Ex: Agência KOKO — LP + Funil" />
        </div>

        {/* Tipo Receita */}
        <div>
          <label className="text-xs text-white/50 mb-1 block">Tipo de Receita</label>
          <select value={form.tipoReceita} onChange={e => setForm({ ...form, tipoReceita: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm">
            <option value="projeto">Projeto</option>
            <option value="recorrente">Recorrente</option>
            <option value="hibrido">Híbrido</option>
          </select>
        </div>

        {/* Origem */}
        <div>
          <label className="text-xs text-white/50 mb-1 block">Origem</label>
          <select value={form.origemNegocio} onChange={e => setForm({ ...form, origemNegocio: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm">
            <option value="novo">Novo</option>
            <option value="carteira">Carteira</option>
          </select>
        </div>

        {/* Pipeline — sem isso o negócio some do board (fica só no drawer do contato) */}
        <div>
          <label className="text-xs text-white/50 mb-1 block">Pipeline</label>
          <select value={form.pipelineId} onChange={e => setForm({ ...form, pipelineId: e.target.value })}
            className="w-full dark-input rounded-lg px-3 py-2 text-sm">
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        {/* Serviços */}
        {servicos.length > 0 && (
          <div>
            <label className="text-xs text-white/50 mb-1 block">Serviços de Interesse</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {servicos.map(s => (
                <button key={s.key} type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    servicosInteresse: f.servicosInteresse.includes(s.key)
                      ? f.servicosInteresse.filter(x => x !== s.key)
                      : [...f.servicosInteresse, s.key]
                  }))}
                  className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                    form.servicosInteresse.includes(s.key)
                      ? "bg-blue-500/30 text-blue-300"
                      : "bg-white/[0.05] text-white/50 hover:bg-white/[0.1]"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={!form.leadId || !form.titulo || createMutation.isPending}
            className="btn-primary px-6 py-2 text-sm disabled:opacity-40">
            {createMutation.isPending ? "Criando..." : "Criar Negócio"}
          </button>
          <Link href={preLeadId ? `/contatos/${preLeadId}` : "/pipeline"} className="px-4 py-2 text-sm text-white/50 hover:text-white">
            Cancelar
          </Link>
        </div>

        {createMutation.error && (
          <p className="text-red-400 text-sm">{createMutation.error.message}</p>
        )}
      </form>
    </div>
  );
}
