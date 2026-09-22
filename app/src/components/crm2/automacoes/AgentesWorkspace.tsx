"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Bot, Plus, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AGENT_PRESETS, AGENT_PURPOSES, DEFAULT_HANDOFF_CONFIG } from "@/lib/ai/agent-studio";
import { Cf2Badge } from "../ui/Badge";
import { Cf2EmptyState, Cf2ErrorState, Cf2Skeleton } from "../ui/States";
import { PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { Button } from "@/components/ui/button";

interface AgenteResumo {
  id: string; tipo: string; nome: string; descricao: string; ativo: boolean;
  modelo: string | null; status: string; versao: number | null; execucoes: number;
  configHref: string;
}
interface AgentesResponse { agentes: AgenteResumo[] }

const fieldStyle = { background: "var(--cf2-bg-surface)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" };

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

function NovoAgenteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [finalidade, setFinalidade] = useState("prospeccao");
  const preset = AGENT_PRESETS[finalidade] ?? AGENT_PRESETS.atendimento;

  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/automacoes/agentes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(), slug: `${slugify(nome)}-${Date.now().toString(36)}`,
          descricao: descricao.trim() || null, finalidade, prioridade: 100,
          versao: {
            systemPrompt: preset.prompt, provider: null, modelo: null, tools: preset.tools,
            triggerConfig: { events: preset.events, filters: { ignoreGroups: true, ignoreSelf: true, keywordRegex: null, businessHours: null }, concurrency: "one_per_conversation" },
            handoffConfig: DEFAULT_HANDOFF_CONFIG, knowledgeConfig: { sources: [] },
            maxSteps: 8, tokenBudget: 4000, costBudget: null,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Não foi possível criar o agente");
      return json as { agent: { id: string } };
    },
    onSuccess: ({ agent }) => {
      toast.success("Agente criado como rascunho.");
      qc.invalidateQueries({ queryKey: ["automacoes", "agentes"] });
      router.push(`/automacoes/agentes/${agent.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(9,12,18,.64)" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "0 28px 80px rgba(0,0,0,.28)" }}>
        <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
          <div><p className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ color: "var(--cf2-accent-text)" }}>Novo agente</p><h2 className="mt-1 text-xl font-bold">Defina o papel antes da inteligência</h2><p className="mt-1 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Nasce em rascunho e não executa ações externas.</p></div>
          <button onClick={onClose} className="rounded-xl p-2" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-[12px] font-semibold">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Agente Outbound" maxLength={120} className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none" style={fieldStyle} autoFocus /></label>
            <label className="space-y-1.5 text-[12px] font-semibold">Papel na operação<select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none" style={fieldStyle}>{AGENT_PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
          </div>
          <label className="block space-y-1.5 text-[12px] font-semibold">Descrição<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que ele resolve e onde deve parar." aria-label="O que ele resolve e onde deve parar." maxLength={500} rows={3} className="w-full resize-none rounded-xl px-3 py-2.5 text-[13px] outline-none" style={fieldStyle} /></label>
          <div className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" style={{ color: "var(--cf2-accent-text)" }} /><p className="text-[12px] font-bold">Base inicial de {AGENT_PURPOSES.find((p) => p.id === finalidade)?.nome}</p></div>
            <p className="mt-2 text-[12px] leading-5" style={{ color: "var(--cf2-text-secondary)" }}>{preset.prompt}</p>
            <p className="mt-2 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{preset.tools.length} capacidades pré-selecionadas e editáveis</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface-muted)" }}>
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-[12px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)" }}>Cancelar</button>
          <button onClick={() => create.mutate()} disabled={!nome.trim() || create.isPending} className="rounded-xl px-4 py-2.5 text-[12px] font-bold disabled:opacity-50" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{create.isPending ? "Criando..." : "Criar agente"}</button>
        </div>
      </div>
    </div>
  );
}

function AgenteCard({ agente }: { agente: AgenteResumo }) {
  const purpose = AGENT_PURPOSES.find((p) => p.id === agente.tipo)?.nome ?? agente.tipo;
  return (
    <Link href={agente.configHref} className="group rounded-2xl p-5 transition-transform hover:-translate-y-0.5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", boxShadow: "var(--cf2-shadow-card-sm)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: agente.ativo ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)" }}><Bot className="h-4 w-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-[15px] font-bold">{agente.nome}</h3><Cf2Badge variant={agente.ativo ? "success" : "neutral"}>{agente.ativo ? "Publicado" : "Rascunho"}</Cf2Badge></div><p className="mt-1 line-clamp-2 text-[12px] leading-5" style={{ color: "var(--cf2-text-secondary)" }}>{agente.descricao}</p></div></div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: "var(--cf2-text-tertiary)" }} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4" style={{ borderColor: "var(--cf2-border-default)" }}>
        <div><p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>Papel</p><p className="mt-1 truncate text-[12px] font-semibold">{purpose}</p></div>
        <div><p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>Versão</p><p className="mt-1 text-[12px] font-semibold">{agente.versao ? `v${agente.versao}` : "Não publicada"}</p></div>
        <div><p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)" }}>Execuções</p><p className="mt-1 text-[12px] font-semibold">{agente.execucoes}</p></div>
      </div>
    </Link>
  );
}

export function Cf2AgentesWorkspace() {
  const [criando, setCriando] = useState(false);
  const { data, isLoading, isError } = useQuery<AgentesResponse>({ queryKey: ["automacoes", "agentes"], queryFn: async () => { const r = await fetch("/api/automacoes/agentes"); if (!r.ok) throw new Error(); return r.json(); } });
  const published = useMemo(() => data?.agentes.filter((a) => a.ativo).length ?? 0, [data]);
  const runs = useMemo(() => data?.agentes.reduce((sum, a) => sum + a.execucoes, 0) ?? 0, [data]);
  return (
    <div className="space-y-5">
      {/* Saíram três coisas: o micro-label coral "Agentes IA" (a trilha já diz
          Automação / Agentes, e coral é reservado para o que exige atenção), o
          título "Equipe digital da operação" — que é frase de marketing, não
          nome de tela — e o segundo cabeçalho que a rota desenhava dizendo
          "Automações". O nome é o do menu e o da spec: Agentes. */}
      <PaginaCabecalho
        titulo="Agentes"
        descricao="Configure comportamento, capacidades, limites e handoff. Toda versão é rastreável e exige publicação explícita."
        acoes={<Button size="sm" onClick={() => setCriando(true)}><Plus data-icon="inline-start" /> Novo agente</Button>}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[[Bot, data?.agentes.length ?? 0, "agentes configurados"], [ShieldCheck, published, "versões publicadas"], [Activity, runs, "execuções registradas"]].map(([Icon, value, label]) => { const C = Icon as typeof Bot; return <div key={String(label)} className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><C className="h-4 w-4" style={{ color: "var(--cf2-text-tertiary)" }} /><p className="mt-3 text-xl font-bold">{String(value)}</p><p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{String(label)}</p></div>; })}</div>
      {isLoading ? <div className="grid gap-3 md:grid-cols-2"><Cf2Skeleton className="h-48" /><Cf2Skeleton className="h-48" /></div> : isError ? <Cf2ErrorState message="Não foi possível carregar os agentes." /> : !data?.agentes.length ? <Cf2EmptyState title="Nenhum agente configurado" description="Crie o primeiro agente. Ele nascerá como rascunho e poderá ser testado antes da publicação." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.agentes.map((a) => <AgenteCard key={a.id} agente={a} />)}</div>}
      {criando && <NovoAgenteModal onClose={() => setCriando(false)} />}
    </div>
  );
}
