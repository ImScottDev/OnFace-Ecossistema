"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Bot, Check, ChevronDown, ChevronUp, Clock, FlaskConical, History, Loader2, Play, Save, Send, Shield, SlidersHorizontal, Wrench, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AGENT_EVENT_CATALOG, AGENT_PURPOSES, AGENT_TOOL_CATALOG, DEFAULT_HANDOFF_CONFIG, DEFAULT_TRIGGER_CONFIG } from "@/lib/ai/agent-studio";
import { Cf2Badge } from "../ui/Badge";
import { Cf2EmptyState, Cf2ErrorState, Cf2Skeleton } from "../ui/States";

interface Agent { id: string; nome: string; slug: string; descricao: string | null; finalidade: string; prioridade: number; status: string; updatedAt: string }
interface Version { id: string; versao: number; status: string; systemPrompt: string; provider: string | null; modelo: string | null; tools: string[]; triggerConfig: Record<string, unknown>; handoffConfig: Record<string, unknown>; knowledgeConfig: Record<string, unknown>; maxSteps: number; tokenBudget: number; costBudget: string | null; publishedAt: string | null; createdAt: string }
interface Run { id: string; versionId: string | null; modo: string; status: string; input: unknown; trace: Array<Record<string, unknown>>; tokens: number; custo: string | null; erro: string | null; handoffMotivo: string | null; startedAt: string; completedAt: string | null }
interface Detail { agent: Agent; versions: Version[]; runs: Run[] }

type Tab = "configuration" | "test" | "capabilities" | "runs" | "history";
interface FormState { nome: string; descricao: string; finalidade: string; prioridade: number; systemPrompt: string; provider: string; modelo: string; tools: string[]; events: string[]; ignoreGroups: boolean; ignoreSelf: boolean; keywordRegex: string; concurrency: string; handoffEnabled: boolean; handoffKeywords: string[]; onLowConfidence: boolean; onToolFailure: boolean; confidenceThreshold: number; maxSteps: number; tokenBudget: number; costBudget: string }

const fieldStyle = { background: "var(--cf2-bg-surface)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" };
const tabs: Array<{ id: Tab; label: string; icon: typeof Bot }> = [
  { id: "configuration", label: "Configuração", icon: SlidersHorizontal },
  { id: "test", label: "Teste", icon: FlaskConical },
  { id: "capabilities", label: "Capacidades", icon: Wrench },
  { id: "runs", label: "Execuções", icon: Play },
  { id: "history", label: "Histórico", icon: History },
];

function configEvents(config: Record<string, unknown>) {
  const raw = Array.isArray(config.events) ? config.events : Array.isArray(config.eventTypes) ? config.eventTypes : [];
  return raw.filter((event): event is string => typeof event === "string");
}

function buildForm(agent: Agent, version: Version): FormState {
  const trigger = version.triggerConfig ?? DEFAULT_TRIGGER_CONFIG;
  const filters = typeof trigger.filters === "object" && trigger.filters ? trigger.filters as Record<string, unknown> : {};
  const handoff = version.handoffConfig ?? DEFAULT_HANDOFF_CONFIG;
  return {
    nome: agent.nome, descricao: agent.descricao ?? "", finalidade: agent.finalidade, prioridade: agent.prioridade,
    systemPrompt: version.systemPrompt, provider: version.provider ?? "", modelo: version.modelo ?? "", tools: Array.isArray(version.tools) ? version.tools : [],
    events: configEvents(trigger), ignoreGroups: filters.ignoreGroups !== false, ignoreSelf: filters.ignoreSelf !== false,
    keywordRegex: typeof filters.keywordRegex === "string" ? filters.keywordRegex : "", concurrency: typeof trigger.concurrency === "string" ? trigger.concurrency : "one_per_conversation",
    handoffEnabled: handoff.enabled !== false, handoffKeywords: Array.isArray(handoff.keywords) ? handoff.keywords.filter((v): v is string => typeof v === "string") : [],
    onLowConfidence: handoff.onLowConfidence !== false, onToolFailure: handoff.onToolFailure !== false,
    confidenceThreshold: typeof handoff.confidenceThreshold === "number" ? handoff.confidenceThreshold : 0.65,
    maxSteps: version.maxSteps, tokenBudget: version.tokenBudget, costBudget: version.costBudget ?? "",
  };
}

function payload(form: FormState) {
  return {
    systemPrompt: form.systemPrompt, provider: form.provider.trim() || null, modelo: form.modelo.trim() || null, tools: form.tools,
    triggerConfig: { events: form.events, filters: { ignoreGroups: form.ignoreGroups, ignoreSelf: form.ignoreSelf, keywordRegex: form.keywordRegex.trim() || null, businessHours: null }, concurrency: form.concurrency },
    handoffConfig: { enabled: form.handoffEnabled, keywords: form.handoffKeywords, onLowConfidence: form.onLowConfidence, onToolFailure: form.onToolFailure, confidenceThreshold: form.confidenceThreshold },
    knowledgeConfig: { sources: [] }, maxSteps: form.maxSteps, tokenBudget: form.tokenBudget, costBudget: form.costBudget.trim() ? Number(form.costBudget) : null,
  };
}

function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-xl p-3 text-left" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}><span><span className="block text-[12px] font-semibold">{label}</span>{description && <span className="mt-0.5 block text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{description}</span>}</span><span className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: checked ? "var(--cf2-accent)" : "var(--cf2-border-strong)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: checked ? 18 : 2 }} /></span></button>;
}

function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  return <div className="overflow-hidden rounded-2xl" style={{ border: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface)" }}><button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>{run.status === "completed" ? <Check className="h-4 w-4" /> : run.status === "failed" ? <XCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}</span><span className="flex-1"><span className="flex flex-wrap gap-2"><Cf2Badge variant={run.modo === "dry_run" ? "neutral" : "accent"}>{run.modo === "dry_run" ? "Dry-run" : "Live"}</Cf2Badge><Cf2Badge variant={run.status === "completed" ? "success" : run.status === "failed" ? "danger" : "warning"}>{run.status}</Cf2Badge></span></span><span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(run.startedAt).toLocaleString("pt-BR")}</span>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>{open && <pre className="max-h-80 overflow-auto border-t p-4 text-[11px]" style={{ borderColor: "var(--cf2-border-default)", background: "var(--cf2-bg-surface-muted)" }}>{JSON.stringify({ input: run.input, trace: run.trace, erro: run.erro }, null, 2)}</pre>}</div>;
}

export function Cf2AgenteDetalheWorkspace({ agentId }: { agentId: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("configuration");
  const [form, setForm] = useState<FormState | null>(null);
  const [baseline, setBaseline] = useState("");
  const [keyword, setKeyword] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<Run | null>(null);
  const query = useQuery<Detail>({ queryKey: ["automacoes", "agente-detalhe", agentId], queryFn: async () => { const r = await fetch(`/api/automacoes/agentes/${agentId}`); if (!r.ok) throw new Error(); return r.json(); } });
  const versions = query.data?.versions ?? [];
  const draft = versions.find((v) => v.status === "draft") ?? null;
  const published = versions.find((v) => v.status === "published") ?? null;
  const workingVersion = draft ?? published ?? versions[0] ?? null;

  useEffect(() => {
    if (!query.data || !workingVersion) return;
    const next = buildForm(query.data.agent, workingVersion);
    setForm(next); setBaseline(JSON.stringify(next));
  }, [query.data, workingVersion?.id]);

  const dirty = form ? JSON.stringify(form) !== baseline : false;
  const publishReady = Boolean(draft && form && !dirty && form.provider.trim() && form.modelo.trim() && form.systemPrompt.trim().length >= 20 && form.events.length > 0);
  const selectedToolDefs = useMemo(() => AGENT_TOOL_CATALOG.filter((tool) => form?.tools.includes(tool.id)), [form?.tools]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form || !workingVersion) throw new Error("Configuração indisponível");
      if (form.systemPrompt.trim().length < 20) throw new Error("Escreva instruções mais completas para o agente.");
      if (form.events.length === 0) throw new Error("Escolha pelo menos um gatilho.");
      const meta = await fetch(`/api/automacoes/agentes/${agentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: form.nome, descricao: form.descricao || null, finalidade: form.finalidade, prioridade: form.prioridade }) });
      if (!meta.ok) throw new Error("Não foi possível salvar os dados do agente.");
      const endpoint = draft ? `/api/automacoes/agentes/${agentId}/versions/${draft.id}` : `/api/automacoes/agentes/${agentId}/versions`;
      const version = await fetch(endpoint, { method: draft ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(form)) });
      const json = await version.json();
      if (!version.ok) throw new Error(json?.error || "Não foi possível salvar o rascunho.");
      return json as Version;
    },
    onSuccess: () => { toast.success(draft ? `Rascunho v${draft.versao} salvo.` : "Nova versão em rascunho criada."); qc.invalidateQueries({ queryKey: ["automacoes", "agente-detalhe", agentId] }); qc.invalidateQueries({ queryKey: ["automacoes", "agentes"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const publish = useMutation({
    mutationFn: async () => { if (!draft || !form) throw new Error("Salve um rascunho antes de publicar."); if (dirty) throw new Error("Salve as alterações antes de publicar."); if (!form.provider.trim() || !form.modelo.trim()) throw new Error("Defina provider e modelo antes de publicar."); const r = await fetch(`/api/automacoes/agentes/${agentId}/versions/${draft.id}/publish`, { method: "POST" }); const json = await r.json(); if (!r.ok) throw new Error(json?.error || "Não foi possível publicar."); return json; },
    onSuccess: () => { toast.success("Versão publicada."); qc.invalidateQueries({ queryKey: ["automacoes", "agente-detalhe", agentId] }); qc.invalidateQueries({ queryKey: ["automacoes", "agentes"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: async () => { if (!workingVersion || !testMessage.trim()) throw new Error("Digite uma mensagem de teste."); const r = await fetch(`/api/automacoes/agentes/${agentId}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: workingVersion.id, sampleMessage: testMessage.trim(), requestedTools: form?.tools ?? [] }) }); const json = await r.json(); if (!r.ok) throw new Error(json?.error || "Teste falhou."); return json as { run: Run }; },
    onSuccess: ({ run }) => { setTestResult(run); toast.success("Dry-run registrado. Nenhuma mensagem foi enviada."); qc.invalidateQueries({ queryKey: ["automacoes", "agente-detalhe", agentId] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <div className="page-scroll space-y-4"><Cf2Skeleton className="h-16" /><Cf2Skeleton className="h-96" /></div>;
  if (query.isError || !query.data || !workingVersion || !form) return <div className="page-scroll"><Cf2ErrorState message="Não foi possível carregar este agente." /></div>;
  const agent = query.data.agent;

  return <div className="page-scroll space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3"><Link href="/automacoes/agentes" className="rounded-xl p-2" style={{ border: "1px solid var(--cf2-border-default)" }}><ArrowLeft className="h-4 w-4" /></Link><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--cf2-accent)" }}><Bot className="h-4 w-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-bold">{agent.nome}</h1><Cf2Badge variant={published ? "success" : "neutral"}>{published ? `Publicado v${published.versao}` : "Não publicado"}</Cf2Badge>{draft && <Cf2Badge variant="warning">Rascunho v{draft.versao}</Cf2Badge>}</div><p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{agent.descricao || "Sem descrição"}</p></div></div>
      <div className="flex gap-2"><button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold disabled:opacity-50" style={{ border: "1px solid var(--cf2-border-default)" }}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar rascunho</button><button onClick={() => publish.mutate()} disabled={!publishReady || publish.isPending} title={!publishReady ? "Salve o rascunho e defina provider, modelo e gatilho" : "Publicar versão"} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold disabled:opacity-50" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Send className="h-4 w-4" /> Publicar</button></div>
    </div>

    <div className="flex gap-1 overflow-x-auto rounded-2xl p-1.5" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-semibold" style={{ background: tab === item.id ? "var(--cf2-bg-surface)" : "transparent", color: tab === item.id ? "var(--cf2-text-primary)" : "var(--cf2-text-tertiary)", boxShadow: tab === item.id ? "var(--cf2-shadow-card-sm)" : "none" }}><Icon className="h-3.5 w-3.5" />{item.label}</button>; })}</div>

    {tab === "configuration" && <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <section className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><h2 className="text-[14px] font-bold">Identidade e papel</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-semibold">Nome<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px]" style={fieldStyle} /></label><label className="text-[11px] font-semibold">Papel<select value={form.finalidade} onChange={(e) => setForm({ ...form, finalidade: e.target.value })} className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px]" style={fieldStyle}>{AGENT_PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label className="sm:col-span-2 text-[11px] font-semibold">Descrição<textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="mt-1.5 w-full resize-none rounded-xl px-3 py-2.5 text-[13px]" style={fieldStyle} /></label></div></section>
        <section className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><h2 className="text-[14px] font-bold">Instruções do agente</h2><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Defina objetivo, limites, tom, quando agir e quando parar.</p><textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={13} className="mt-4 w-full resize-y rounded-xl p-4 text-[13px] leading-6" style={fieldStyle} /><p className="mt-2 text-right text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{form.systemPrompt.length} caracteres</p></section>
        <section className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><h2 className="text-[14px] font-bold">Quando ele entra</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{AGENT_EVENT_CATALOG.map((event) => { const checked = form.events.includes(event.id); return <button key={event.id} onClick={() => setForm({ ...form, events: checked ? form.events.filter((id) => id !== event.id) : [...form.events, event.id] })} className="rounded-xl p-3 text-left" style={{ border: `1px solid ${checked ? "var(--cf2-accent)" : "var(--cf2-border-default)"}`, background: checked ? "var(--cf2-accent-subtle)" : "var(--cf2-bg-surface-muted)" }}><span className="text-[12px] font-semibold">{event.nome}</span><span className="mt-1 block text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{event.descricao}</span></button>; })}</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Switch checked={form.ignoreGroups} onChange={(value) => setForm({ ...form, ignoreGroups: value })} label="Ignorar grupos" /><Switch checked={form.ignoreSelf} onChange={(value) => setForm({ ...form, ignoreSelf: value })} label="Ignorar mensagens próprias" /></div></section>
      </div>
      <aside className="space-y-4">
        <section className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><h2 className="text-[14px] font-bold">Inteligência</h2><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Provider desacoplado. Conecte a credencial depois.</p><label className="mt-4 block text-[11px] font-semibold">Provider<input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="anthropic, openai..." className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px]" style={fieldStyle} /></label><label className="mt-3 block text-[11px] font-semibold">Modelo<input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="modelo configurável" className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px]" style={fieldStyle} /></label></section>
        <section className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><div className="flex items-center gap-2"><Shield className="h-4 w-4" /><h2 className="text-[14px] font-bold">Handoff</h2></div><div className="mt-4 space-y-2"><Switch checked={form.handoffEnabled} onChange={(value) => setForm({ ...form, handoffEnabled: value })} label="Permitir handoff" /><Switch checked={form.onLowConfidence} onChange={(value) => setForm({ ...form, onLowConfidence: value })} label="Baixa confiança" /><Switch checked={form.onToolFailure} onChange={(value) => setForm({ ...form, onToolFailure: value })} label="Falha de capacidade" /></div><div className="mt-4 flex flex-wrap gap-1.5">{form.handoffKeywords.map((word) => <button key={word} onClick={() => setForm({ ...form, handoffKeywords: form.handoffKeywords.filter((item) => item !== word) })} className="rounded-full px-2.5 py-1 text-[10px]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>{word} ×</button>)}</div><div className="mt-2 flex gap-2"><input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && keyword.trim()) { e.preventDefault(); setForm({ ...form, handoffKeywords: [...new Set([...form.handoffKeywords, keyword.trim().toLowerCase()])] }); setKeyword(""); } }} placeholder="Expressão de handoff" className="min-w-0 flex-1 rounded-xl px-3 py-2 text-[12px]" style={fieldStyle} /><button onClick={() => { if (keyword.trim()) { setForm({ ...form, handoffKeywords: [...new Set([...form.handoffKeywords, keyword.trim().toLowerCase()])] }); setKeyword(""); } }} className="rounded-xl px-3 text-[12px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)" }}>Adicionar</button></div></section>
        <section className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><h2 className="text-[14px] font-bold">Limites por execução</h2><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-[11px] font-semibold">Passos<input type="number" min={1} max={30} value={form.maxSteps} onChange={(e) => setForm({ ...form, maxSteps: Number(e.target.value) })} className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px]" style={fieldStyle} /></label><label className="text-[11px] font-semibold">Tokens<input type="number" min={1} max={100000} value={form.tokenBudget} onChange={(e) => setForm({ ...form, tokenBudget: Number(e.target.value) })} className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px]" style={fieldStyle} /></label><label className="col-span-2 text-[11px] font-semibold">Custo máximo por run (R$)<input value={form.costBudget} onChange={(e) => setForm({ ...form, costBudget: e.target.value })} placeholder="Sem limite" className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[13px]" style={fieldStyle} /></label></div></section>
      </aside>
    </div>}

    {tab === "capabilities" && <div><div className="mb-4"><h2 className="text-lg font-bold">O que este agente pode fazer</h2><p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Capacidades são permissões. As marcadas como simulação ainda não executam efeitos externos.</p></div><div className="grid gap-3 md:grid-cols-2">{AGENT_TOOL_CATALOG.map((tool) => { const checked = form.tools.includes(tool.id); return <button key={tool.id} onClick={() => setForm({ ...form, tools: checked ? form.tools.filter((id) => id !== tool.id) : [...form.tools, tool.id] })} className="rounded-2xl p-4 text-left" style={{ background: checked ? "var(--cf2-accent-subtle)" : "var(--cf2-bg-surface)", border: `1px solid ${checked ? "var(--cf2-accent)" : "var(--cf2-border-default)"}` }}><div className="flex items-start justify-between gap-3"><div><p className="text-[13px] font-bold">{tool.nome}</p><p className="mt-1 text-[11px] leading-5" style={{ color: "var(--cf2-text-secondary)" }}>{tool.descricao}</p></div><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ background: checked ? "var(--cf2-accent)" : "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>{checked && <Check className="h-3 w-3" />}</span></div><div className="mt-3 flex gap-2"><Cf2Badge variant="neutral">{tool.categoria}</Cf2Badge><Cf2Badge variant={tool.disponibilidade === "live" ? "success" : "warning"}>{tool.disponibilidade === "live" ? "Leitura disponível" : "Somente simulação"}</Cf2Badge></div></button>; })}</div></div>}

    {tab === "test" && <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><h2 className="text-[14px] font-bold">Teste seguro</h2><p className="mt-1 text-[11px] leading-5" style={{ color: "var(--cf2-text-secondary)" }}>Valida versão e políticas. Não chama LLM, não envia WhatsApp e não executa ferramentas.</p><textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={6} placeholder="Mensagem simulada do contato" className="mt-4 w-full resize-y rounded-xl p-3 text-[13px]" style={fieldStyle} /><div className="mt-3 flex flex-wrap gap-1.5">{selectedToolDefs.map((tool) => <Cf2Badge key={tool.id} variant="neutral">{tool.nome}</Cf2Badge>)}</div><button onClick={() => test.mutate()} disabled={!testMessage.trim() || test.isPending} className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold disabled:opacity-50" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Executar dry-run</button></section><section className="rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><h2 className="text-[14px] font-bold">Trace do teste</h2>{testResult ? <pre className="mt-4 max-h-[440px] overflow-auto rounded-xl p-4 text-[11px]" style={{ background: "var(--cf2-bg-surface-muted)" }}>{JSON.stringify(testResult.trace, null, 2)}</pre> : <div className="mt-6"><Cf2EmptyState title="Nenhum teste nesta sessão" description="Execute um dry-run para inspecionar versão, limites e capacidades permitidas." /></div>}</section></div>}

    {tab === "runs" && <div className="space-y-3">{query.data.runs.length ? query.data.runs.map((run) => <RunRow key={run.id} run={run} />) : <Cf2EmptyState title="Nenhuma execução registrada" description="Os testes e execuções futuras aparecem aqui com trace e resultado." />}</div>}
    {tab === "history" && <div className="space-y-3">{versions.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><div><div className="flex items-center gap-2"><p className="text-[13px] font-bold">Versão {version.versao}</p><Cf2Badge variant={version.status === "published" ? "success" : version.status === "draft" ? "warning" : "neutral"}>{version.status}</Cf2Badge></div><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{version.provider || "sem provider"} · {version.modelo || "sem modelo"} · {version.tools.length} capacidades</p></div><p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Date(version.createdAt).toLocaleString("pt-BR")}</p></div>)}</div>}
  </div>;
}
