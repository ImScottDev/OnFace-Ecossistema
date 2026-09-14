"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Brain, Check, Gauge, KeyRound, Loader2, Plus, Puzzle, Route, Server, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Cf2Badge } from "../ui/Badge";
import { Cf2EmptyState, Cf2ErrorState, Cf2Skeleton } from "../ui/States";

export type AiPlatformModule = "roteadores" | "credenciais" | "provedores" | "conhecimento" | "memoria" | "skills" | "casos" | "alertas" | "propostas" | "uso";

const META: Record<AiPlatformModule, { title: string; description: string; endpoint: string; icon: typeof Route }> = {
  roteadores: { title: "Roteadores", description: "Classificação de intenção, stickiness e fallback entre agentes.", endpoint: "/api/automacoes/ai/routers", icon: Route },
  credenciais: { title: "Credenciais", description: "Chaves BYOK cifradas, mascaradas e validadas.", endpoint: "/api/automacoes/ai/credentials", icon: KeyRound },
  provedores: { title: "Provedores", description: "Catálogo de modelos e binding por finalidade do sistema.", endpoint: "/api/automacoes/ai/providers", icon: Server },
  conhecimento: { title: "Conhecimento", description: "Fontes versionadas e indexadas que o agente consulta.", endpoint: "/api/automacoes/ai/knowledge", icon: BookOpen },
  memoria: { title: "Memória", description: "Documento versionado e aprendizados ativos da organização.", endpoint: "/api/automacoes/ai/memory", icon: Brain },
  skills: { title: "Skills", description: "Instruções plugáveis, versões ativas e telemetria de uso.", endpoint: "/api/automacoes/ai/skills", icon: Puzzle },
  casos: { title: "Casos", description: "Loop assíncrono entre agente e equipe humana.", endpoint: "/api/automacoes/ai/cases", icon: UserRoundCheck },
  alertas: { title: "Alertas", description: "Handoffs, budgets, credenciais e falhas que exigem atenção.", endpoint: "/api/automacoes/ai/alerts", icon: AlertTriangle },
  propostas: { title: "Propostas da IA", description: "Dados e melhorias aguardando confirmação humana.", endpoint: "/api/automacoes/ai/proposals", icon: Check },
  uso: { title: "Uso e orçamento", description: "Tokens, custo e limites operacionais do mês.", endpoint: "/api/automacoes/ai/usage", icon: Gauge },
};

const fieldStyle = { background: "var(--cf2-bg-surface)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" };

async function request(endpoint: string, init?: RequestInit) {
  const response = await fetch(endpoint, init); const json = await response.json();
  if (!response.ok) throw new Error(json?.error || "Não foi possível concluir a operação.");
  return json;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>{children}</div>;
}

function JsonDetails({ value }: { value: unknown }) {
  return <details className="mt-3"><summary className="cursor-pointer text-[11px] font-semibold" style={{ color: "var(--cf2-text-tertiary)" }}>Detalhes técnicos</summary><pre className="mt-2 max-h-64 overflow-auto rounded-xl p-3 text-[10px]" style={{ background: "var(--cf2-bg-surface-muted)" }}>{JSON.stringify(value, null, 2)}</pre></details>;
}

export function Cf2AiPlatformWorkspace({ module }: { module: AiPlatformModule }) {
  const meta = META[module]; const Icon = meta.icon; const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ["ai-platform", module], queryFn: () => request(meta.endpoint) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ai-platform", module] });
  const mutation = useMutation({ mutationFn: ({ endpoint, body, method = "POST" }: { endpoint: string; body?: unknown; method?: string }) => request(endpoint, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), onSuccess: () => { toast.success("Operação concluída."); refresh(); }, onError: (error: Error) => toast.error(error.message) });
  if (query.isLoading) return <div className="space-y-3"><Cf2Skeleton className="h-24" /><Cf2Skeleton className="h-64" /></div>;
  if (query.isError) return <Cf2ErrorState message={`Não foi possível carregar ${meta.title.toLowerCase()}.`} />;
  const data = query.data as Record<string, unknown>;

  const submit = () => {
    if (module === "credenciais") mutation.mutate({ endpoint: meta.endpoint, body: { provider: form.provider || "groq", label: form.label, apiKey: form.apiKey } });
    if (module === "provedores") mutation.mutate({ endpoint: `${meta.endpoint}/bindings/${encodeURIComponent(form.purpose || "agent_runtime")}`, method: "PUT", body: { provider: form.provider || "groq", modelId: form.modelId, credentialId: form.credentialId || null, baseUrl: form.baseUrl || null, ativo: true } });
    if (module === "roteadores") mutation.mutate({ endpoint: meta.endpoint, body: { nome: form.nome, channelSessionId: form.channelSessionId, fallbackAgentId: form.fallbackAgentId || null, ativo: true, config: { classifierModel: form.classifierModel || null, sticky: true, minConfidence: Number(form.minConfidence || 0.6) }, members: [] } });
    if (module === "conhecimento") mutation.mutate({ endpoint: meta.endpoint, body: { nome: form.nome, sourceType: form.sourceType || "text", sourceUri: form.sourceUri || null, content: form.content } });
    if (module === "memoria") mutation.mutate({ endpoint: meta.endpoint, method: "PUT", body: { content: form.content } });
    if (module === "skills") mutation.mutate({ endpoint: meta.endpoint, body: { name: form.name, description: form.description, instructions: form.instructions, manifest: [] } });
    if (module === "uso") mutation.mutate({ endpoint: `${meta.endpoint}/budgets`, method: "PUT", body: { period: "monthly", tokenLimit: form.tokenLimit ? Number(form.tokenLimit) : null, costLimit: form.costLimit ? Number(form.costLimit) : null, warningPercent: Number(form.warningPercent || 80), hardStop: true, ativo: true } });
  };

  const formFields: Partial<Record<AiPlatformModule, Array<{ key: string; label: string; placeholder?: string; type?: string }>>> = {
    credenciais: [{ key: "provider", label: "Provider", placeholder: "groq" }, { key: "label", label: "Nome", placeholder: "Produção" }, { key: "apiKey", label: "API key", placeholder: "••••••••", type: "password" }],
    provedores: [{ key: "purpose", label: "Finalidade", placeholder: "agent_runtime" }, { key: "provider", label: "Provider", placeholder: "groq" }, { key: "modelId", label: "Modelo", placeholder: "llama-3.3-70b-versatile" }, { key: "credentialId", label: "Credencial (UUID)", placeholder: "Opcional" }, { key: "baseUrl", label: "Base URL", placeholder: "Opcional" }],
    roteadores: [{ key: "nome", label: "Nome", placeholder: "Roteador comercial" }, { key: "channelSessionId", label: "Sessão WhatsApp (UUID)" }, { key: "fallbackAgentId", label: "Agente fallback (UUID)" }, { key: "classifierModel", label: "Modelo classificador" }, { key: "minConfidence", label: "Confiança mínima", placeholder: "0.6" }],
    conhecimento: [{ key: "nome", label: "Nome da fonte" }, { key: "sourceType", label: "Tipo", placeholder: "text ou url" }, { key: "sourceUri", label: "URL opcional" }, { key: "content", label: "Conteúdo" }],
    memoria: [{ key: "content", label: "Documento de memória" }],
    skills: [{ key: "name", label: "Nome" }, { key: "description", label: "Descrição" }, { key: "instructions", label: "Instruções" }],
    uso: [{ key: "tokenLimit", label: "Limite mensal de tokens" }, { key: "costLimit", label: "Limite mensal de custo" }, { key: "warningPercent", label: "Avisar em %", placeholder: "80" }],
  };
  const fields = formFields[module];

  return <div className="space-y-5">
    <div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--cf2-accent)" }}><Icon className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold">{meta.title}</h1><p className="mt-1 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{meta.description}</p></div></div>
    {fields && <Card><h2 className="text-[14px] font-bold">{module === "memoria" ? "Publicar nova versão" : "Adicionar configuração"}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{fields.map((field) => <label key={field.key} className={`${field.key === "content" || field.key === "instructions" ? "md:col-span-2" : ""} text-[11px] font-semibold`}>{field.label}{field.key === "content" || field.key === "instructions" ? <textarea rows={6} value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} className="mt-1.5 w-full rounded-xl p-3 text-[12px]" style={fieldStyle} /> : <input type={field.type ?? "text"} value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} placeholder={field.placeholder} className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-[12px]" style={fieldStyle} />}</label>)}</div><button onClick={submit} disabled={mutation.isPending} className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold disabled:opacity-50" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Salvar</button></Card>}
    <ModuleData module={module} data={data} mutate={(endpoint, body, method) => mutation.mutate({ endpoint, body, method })} />
  </div>;
}

function ModuleData({ module, data, mutate }: { module: AiPlatformModule; data: Record<string, unknown>; mutate: (endpoint: string, body?: unknown, method?: string) => void }) {
  if (module === "credenciais") { const rows = (data.credentials ?? []) as Array<Record<string, unknown>>; return <div className="grid gap-3 md:grid-cols-2">{rows.map((row) => <Card key={String(row.id)}><div className="flex items-center justify-between"><div><p className="text-[13px] font-bold">{String(row.label)}</p><p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{String(row.provider)} · {String(row.masked)}</p></div><Cf2Badge variant={row.validationError ? "danger" : row.validatedAt ? "success" : "warning"}>{row.validationError ? "Falhou" : row.validatedAt ? "Validada" : "Não validada"}</Cf2Badge></div><div className="mt-3 flex gap-2"><button onClick={() => mutate(`/api/automacoes/ai/credentials/${row.id}/validate`)} className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)" }}>Validar</button><button onClick={() => mutate(`/api/automacoes/ai/credentials/${row.id}`, { ativo: !row.ativo }, "PATCH")} className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)" }}>{row.ativo ? "Desativar" : "Ativar"}</button></div></Card>)}</div>; }
  if (module === "provedores") { const models = (data.models ?? []) as Array<Record<string, unknown>>; const bindings = (data.bindings ?? []) as Array<Record<string, unknown>>; return <><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{models.map((row) => <Card key={String(row.id)}><div className="flex justify-between gap-2"><p className="text-[13px] font-bold">{String(row.displayName)}</p>{Boolean(row.isDefaultForProvider) && <Cf2Badge variant="success">Default</Cf2Badge>}</div><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{String(row.provider)} · {String(row.modelId)}</p></Card>)}</div>{bindings.length > 0 && <Card><h3 className="text-[13px] font-bold">Bindings ativos</h3><JsonDetails value={bindings} /></Card>}</>; }
  if (module === "casos") { const rows = (data.cases ?? []) as Array<Record<string, unknown>>; return <div className="space-y-3">{rows.length ? rows.map((row) => <Card key={String(row.id)}><div className="flex justify-between gap-3"><div><p className="text-[13px] font-bold">{String(row.title)}</p><p className="mt-1 text-[11px]">{String(row.summary)}</p></div><Cf2Badge variant={row.status === "resolved" ? "success" : "warning"}>{String(row.status)}</Cf2Badge></div><div className="mt-3 flex gap-2">{row.source === "tool_approval" && row.status === "awaiting_human" ? <button onClick={() => mutate(`/api/automacoes/ai/cases/${row.id}/action`, { action: "approve" })} className="rounded-lg px-3 py-2 text-[11px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Aprovar e executar</button> : <button onClick={() => mutate(`/api/automacoes/ai/cases/${row.id}/action`, { action: "resolve" })} className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)" }}>Resolver</button>}<button onClick={() => mutate(`/api/automacoes/ai/cases/${row.id}/action`, { action: row.source === "tool_approval" ? "cancel" : "escalate" })} className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)" }}>{row.source === "tool_approval" ? "Recusar" : "Escalar"}</button></div></Card>) : <Cf2EmptyState title="Nenhum caso" description="Casos abertos pelos agentes aparecerão aqui." />}</div>; }
  if (module === "alertas") { const rows = (data.alerts ?? []) as Array<Record<string, unknown>>; return <div className="space-y-3">{rows.length ? rows.map((row) => <Card key={String(row.id)}><div className="flex justify-between gap-3"><div><p className="text-[13px] font-bold">{String(row.title)}</p><p className="mt-1 text-[11px]">{String(row.body ?? "")}</p></div><Cf2Badge variant={row.severity === "critical" ? "danger" : "warning"}>{String(row.status)}</Cf2Badge></div>{row.status !== "resolved" && <button onClick={() => mutate(`/api/automacoes/ai/alerts/${row.id}`, { status: "resolved" }, "PATCH")} className="mt-3 rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)" }}>Resolver</button>}</Card>) : <Cf2EmptyState title="Nenhum alerta aberto" description="O runtime criará alertas quando houver uma ação necessária." />}</div>; }
  if (module === "propostas") { const rows = (data.fieldProposals ?? []) as Array<Record<string, unknown>>; return <div className="space-y-3">{rows.length ? rows.map((row) => <Card key={String(row.id)}><div className="flex justify-between gap-3"><div><p className="text-[13px] font-bold">Alterar {String(row.campo)}</p><p className="mt-1 text-[11px]">{String(row.valorAnterior ?? "vazio")} → {String(row.valorProposto)}</p></div><Cf2Badge variant={row.status === "pending" ? "warning" : row.status === "accepted" ? "success" : "neutral"}>{String(row.status)}</Cf2Badge></div>{row.status === "pending" && <div className="mt-3 flex gap-2"><button onClick={() => mutate(`/api/automacoes/ai/proposals/fields/${row.id}/decision`, { decision: "accept" })} className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--cf2-accent)" }}>Aceitar</button><button onClick={() => mutate(`/api/automacoes/ai/proposals/fields/${row.id}/decision`, { decision: "dismiss" })} className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ border: "1px solid var(--cf2-border-default)" }}>Recusar</button></div>}</Card>) : <Cf2EmptyState title="Nenhuma proposta pendente" description="A IA nunca altera dados pessoais diretamente; propostas aparecem aqui." />}</div>; }
  if (module === "uso") return <div className="grid gap-3 md:grid-cols-3"><Card><p className="text-[11px]">Runs no mês</p><p className="mt-2 text-2xl font-bold">{String((data.summary as Record<string, unknown> | undefined)?.runs ?? 0)}</p></Card><Card><p className="text-[11px]">Tokens</p><p className="mt-2 text-2xl font-bold">{Number((data.summary as Record<string, unknown> | undefined)?.tokensInput ?? 0) + Number((data.summary as Record<string, unknown> | undefined)?.tokensOutput ?? 0)}</p></Card><Card><p className="text-[11px]">Custo no mês</p><p className="mt-2 text-2xl font-bold">R$ {Number((data.summary as Record<string, unknown> | undefined)?.cost ?? 0).toFixed(4)}</p></Card></div>;
  const key = module === "roteadores" ? "routers" : module === "conhecimento" ? "sources" : module === "skills" ? "versions" : module === "memoria" ? "entries" : "items";
  const rows = (data[key] ?? []) as Array<Record<string, unknown>>;
  return rows.length ? <div className="grid gap-3 md:grid-cols-2">{rows.map((row, index) => <Card key={String(row.id ?? index)}><div className="flex justify-between gap-3"><p className="text-[13px] font-bold">{String(row.nome ?? row.name ?? row.title ?? `Item ${index + 1}`)}</p>{Boolean(row.status) && <Cf2Badge variant={row.status === "ready" || row.status === "active" ? "success" : "neutral"}>{String(row.status)}</Cf2Badge>}</div><JsonDetails value={row} /></Card>)}</div> : <Cf2EmptyState title="Nenhum item configurado" description="Use o formulário acima para criar o primeiro." />;
}
