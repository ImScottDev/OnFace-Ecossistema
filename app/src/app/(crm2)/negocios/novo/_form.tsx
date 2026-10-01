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

export function FormNovoNegocio() {
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
      setForm(f => ({ ...f, titulo: `${preselectedLead.empresa || preselectedLead.nome} — Oportunidade` }));
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
        throw new Error(err.error || "Não foi possível criar a oportunidade. Tente de novo.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/pipeline/${data.id}`);
    },
  });

  return (
    <div className="max-w-[560px]">
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold mb-3"
        style={{ color: "var(--cf2-text-tertiary)" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao pipeline
      </Link>

      {/* Cartão único: o formulário tem 6 campos e não justifica seções.
          Largura travada em 560px porque campo de formulário largo demais
          piora a leitura — a tela inteira de largura era espaço morto. */}
      <form
        onSubmit={e => { e.preventDefault(); createMutation.mutate(); }}
        className="space-y-4 p-5 rounded-2xl"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        {/* Lead */}
        <div className="relative">
          <label className="text-[12px] font-medium text-[var(--cf2-text-secondary)] mb-1.5 block">Lead / Contato</label>
          {preLeadId && preselectedLead ? (
            <div className="cf2-input rounded-lg px-3 py-2 text-sm text-[var(--cf2-text-primary)]">
              {preselectedLead.nome} {preselectedLead.empresa ? `· ${preselectedLead.empresa}` : ""}
            </div>
          ) : (
            <>
              <input
                value={leadSearch}
                onChange={e => { setLeadSearch(e.target.value); setShowLeadList(true); }}
                onFocus={() => setShowLeadList(true)}
                className="w-full cf2-input rounded-lg px-3 py-2 text-sm outline-none"
                placeholder="Buscar lead..." aria-label="Buscar lead"
              />
              {form.leadId && <span className="absolute right-2 top-7 text-xs font-semibold text-[var(--cf2-success-text)]">selecionado</span>}
              {showLeadList && leadsList && leadsList.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--cf2-bg-surface)] border border-[var(--cf2-border-default)] rounded-xl max-h-56 overflow-y-auto shadow-lg">
                  {leadsList.map(l => (
                    <button key={l.id} type="button" onClick={() => {
                      setForm(f => ({ ...f, leadId: l.id, titulo: f.titulo || `${l.empresa || l.nome} — Oportunidade` }));
                      setLeadSearch(l.nome);
                      setShowLeadList(false);
                    }} className="w-full text-left px-3 py-2 text-sm text-[var(--cf2-text-primary)] hover:bg-[var(--cf2-bg-surface-muted)]">
                      {l.nome} {l.empresa ? <span className="text-[var(--cf2-text-tertiary)]">· {l.empresa}</span> : ""}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Título */}
        <div>
          <label className="text-[12px] font-medium text-[var(--cf2-text-secondary)] mb-1.5 block">Título da oportunidade</label>
          <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
            className="w-full cf2-input rounded-lg px-3 py-2 text-sm outline-none" placeholder="Ex: Agência KOKO — LP + Funil" aria-label="Ex: Agência KOKO — LP + Funil" />
        </div>

        {/* Tipo Receita */}
        <div>
          <label className="text-[12px] font-medium text-[var(--cf2-text-secondary)] mb-1.5 block">Tipo de Receita</label>
          <select value={form.tipoReceita} onChange={e => setForm({ ...form, tipoReceita: e.target.value })}
            className="w-full cf2-input rounded-lg px-3 py-2 text-sm">
            <option value="projeto">Projeto</option>
            <option value="recorrente">Recorrente</option>
            <option value="hibrido">Híbrido</option>
          </select>
        </div>

        {/* Origem */}
        <div>
          <label className="text-[12px] font-medium text-[var(--cf2-text-secondary)] mb-1.5 block">Origem</label>
          <select value={form.origemNegocio} onChange={e => setForm({ ...form, origemNegocio: e.target.value })}
            className="w-full cf2-input rounded-lg px-3 py-2 text-sm">
            <option value="novo">Novo</option>
            <option value="carteira">Carteira</option>
          </select>
        </div>

        {/* Pipeline — sem isso o negócio some do board (fica só no drawer do contato) */}
        <div>
          <label className="text-[12px] font-medium text-[var(--cf2-text-secondary)] mb-1.5 block">Pipeline</label>
          <select value={form.pipelineId} onChange={e => setForm({ ...form, pipelineId: e.target.value })}
            className="w-full cf2-input rounded-lg px-3 py-2 text-sm">
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        {/* Serviços */}
        {servicos.length > 0 && (
          <div>
            <label className="text-[12px] font-medium text-[var(--cf2-text-secondary)] mb-1.5 block">Serviços de Interesse</label>
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
                      ? "bg-[var(--cf2-accent)] text-[var(--cf2-text-on-accent)]"
                      : "bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)] hover:bg-[var(--cf2-bg-surface-muted)]"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-2 pt-3 mt-1" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
          <button type="submit" disabled={!form.leadId || !form.titulo || createMutation.isPending}
            className="cf2-btn-primary text-[13px]">
            {createMutation.isPending ? "Criando…" : "Criar oportunidade"}
          </button>
          <Link href={preLeadId ? `/contatos/${preLeadId}` : "/pipeline"} className="px-4 py-2 text-sm text-[var(--cf2-text-secondary)] hover:text-[var(--cf2-text-primary)]">
            Cancelar
          </Link>
        </div>

        {createMutation.error && (
          <p className="text-[var(--cf2-danger-text)] text-sm">{createMutation.error.message}</p>
        )}
      </form>
    </div>
  );
}
