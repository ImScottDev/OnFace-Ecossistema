"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft, Bot, Wrench, Gauge, ArrowRightLeft, PlayCircle, History,
  CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Cf2Card, Cf2SectionHeader } from "../ui/Card";
import { Cf2Badge } from "../ui/Badge";
import { Cf2EmptyState, Cf2ErrorState, Cf2Skeleton } from "../ui/States";

/**
 * Hub operacional do agente (23/08, Slice 4 do mapa de execução). O runtime
 * determinístico (catálogo/versão/dispatch-dry-run) já existia em
 * `automacoes-agentes.ts`; não existia NENHUMA UI que chamasse esses
 * endpoints — o `configHref` que o catálogo já gerava (`AgentesWorkspace`)
 * apontava pra uma rota inexistente. Esta tela fecha isso: mostra bindings/
 * ferramentas/limites/handoff reais da versão publicada, deixa disparar o
 * dispatcher real em modo dry-run e lista o histórico real de `ai_agent_runs`
 * desse agente. Nada aqui inventa dado: se um campo vier vazio, mostra
 * estado vazio honesto (ex: sem catálogo de ferramentas do sistema em lugar
 * nenhum do código — só as ferramentas que a própria versão configurou).
 */

interface Agent {
  id: string;
  organizacaoId: string;
  nome: string;
  slug: string;
  descricao: string | null;
  finalidade: string;
  prioridade: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Version {
  id: string;
  agentId: string;
  versao: number;
  status: string;
  systemPrompt: string;
  provider: string | null;
  modelo: string | null;
  tools: string[];
  triggerConfig: Record<string, unknown>;
  handoffConfig: Record<string, unknown>;
  knowledgeConfig: Record<string, unknown>;
  maxSteps: number;
  tokenBudget: number;
  costBudget: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface Run {
  id: string;
  agentId: string;
  versionId: string | null;
  contatoId: string | null;
  leadId: string | null;
  modo: string;
  status: string;
  input: unknown;
  trace: Array<Record<string, unknown>>;
  tokens: number;
  custo: string | null;
  erro: string | null;
  handoffMotivo: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface AgentDetalhe {
  agent: Agent;
  versions: Version[];
  runs: Run[];
}

interface DryRunResultado {
  ok: boolean;
  modo: string;
  selecionado: { agentId: string; nome: string; versionId: string; versao: number } | null;
  motivo?: string;
  candidatos?: number;
  policy?: { allowedTools: string[]; blockedTools: string[]; maxSteps: number; tokenBudget: number };
  run?: Run;
}

const STATUS_LABEL: Record<string, string> = { draft: "Rascunho", published: "Publicado", paused: "Pausado", archived: "Arquivado" };
const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  draft: "neutral", published: "success", paused: "warning", archived: "danger",
};

const RUN_STATUS_INFO: Record<string, { label: string; icon: typeof CheckCircle2; variant: "success" | "danger" | "warning" | "neutral" }> = {
  queued: { label: "Na fila", icon: Clock, variant: "neutral" },
  running: { label: "Em execução", icon: Loader2, variant: "warning" },
  completed: { label: "Concluído", icon: CheckCircle2, variant: "success" },
  failed: { label: "Falhou", icon: XCircle, variant: "danger" },
  handed_off: { label: "Handoff", icon: ArrowRightLeft, variant: "warning" },
};

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatCusto(v: string | null) {
  if (v == null) return null;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function extractTriggerValues(config: Record<string, unknown>): string[] {
  const raw = [
    config.eventType, config.trigger,
    ...(Array.isArray(config.events) ? config.events : []),
    ...(Array.isArray(config.eventTypes) ? config.eventTypes : []),
  ];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function KeyValueList({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-2 text-[12px]">
          <span className="font-semibold shrink-0" style={{ color: "var(--cf2-text-secondary)" }}>{k}:</span>
          <span className="break-all" style={{ color: "var(--cf2-text-primary)" }}>
            {typeof v === "string" ? v : JSON.stringify(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const [aberto, setAberto] = useState(false);
  const info = RUN_STATUS_INFO[run.status] || { label: run.status, icon: Clock, variant: "neutral" as const };
  const Icon = info.icon;
  const custoFmt = formatCusto(run.custo);
  return (
    <div className="rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full p-3.5 flex items-center gap-3 text-left"
      >
        <div className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          <Icon className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Cf2Badge variant={run.modo === "dry_run" ? "neutral" : "accent"}>{run.modo === "dry_run" ? "Dry-run" : "Live"}</Cf2Badge>
            <Cf2Badge variant={info.variant}>{info.label}</Cf2Badge>
            {run.tokens > 0 && <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{run.tokens} tokens</span>}
            {custoFmt && <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{custoFmt}</span>}
          </div>
          {run.erro && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--cf2-danger-text)" }}>{run.erro}</p>}
        </div>
        <p className="text-[11px] shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>{timeAgo(run.startedAt)}</p>
        {aberto ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />}
      </button>
      {aberto && (
        <div className="px-3.5 pb-3.5">
          <pre
            className="text-[11px] whitespace-pre-wrap break-all rounded-lg p-3"
            style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}
          >
            {JSON.stringify(run.trace, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function Cf2AgenteDetalheWorkspace({ agentId }: { agentId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ eventType: "", entityType: "lead", entityId: "", leadId: "", contatoId: "", requestedTools: "" });
  const [resultado, setResultado] = useState<DryRunResultado | null>(null);

  const { data, isLoading, isError, error } = useQuery<AgentDetalhe>({
    queryKey: ["automacoes", "agente-detalhe", agentId],
    queryFn: async () => {
      const r = await fetch(`/api/automacoes/agentes/${agentId}`);
      if (r.status === 404) throw Object.assign(new Error("Agente não encontrado"), { notFound: true });
      if (!r.ok) throw new Error("Erro ao carregar agente");
      return r.json();
    },
  });

  const dryRun = useMutation({
    mutationFn: async () => {
      const requestedTools = form.requestedTools.split(",").map((t) => t.trim()).filter(Boolean);
      const body = {
        eventType: form.eventType.trim(),
        entityType: form.entityType.trim() || "lead",
        entityId: form.entityId.trim() || null,
        leadId: form.leadId.trim() || null,
        contatoId: form.contatoId.trim() || null,
        agentId,
        requestedTools,
      };
      const r = await fetch("/api/automacoes/agentes/dispatch-dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || "Falha ao testar o dispatcher");
      return json as DryRunResultado;
    },
    onSuccess: (json) => {
      setResultado(json);
      qc.invalidateQueries({ queryKey: ["automacoes", "agente-detalhe", agentId] });
    },
    onError: (err: Error) => {
      setResultado(null);
      alert(err.message);
    },
  });

  const publishedVersion = useMemo(() => data?.versions.find((v) => v.status === "published") ?? null, [data]);
  const configuredTools = useMemo(() => (Array.isArray(publishedVersion?.tools) ? publishedVersion!.tools : []), [publishedVersion]);
  const triggerValues = useMemo(() => (publishedVersion ? extractTriggerValues(publishedVersion.triggerConfig) : []), [publishedVersion]);

  if (isLoading) {
    return (
      <div className="page-scroll space-y-4">
        <Cf2Skeleton className="h-8 w-64" />
        <Cf2Skeleton className="h-40 w-full" />
        <Cf2Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    const notFound = (error as { notFound?: boolean } | null)?.notFound;
    return (
      <div className="page-scroll space-y-4">
        <Link href="/automacoes/agentes" className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Agentes
        </Link>
        {notFound ? (
          <Cf2EmptyState title="Agente não encontrado" description="Ele não existe ou não pertence à sua organização." />
        ) : (
          <Cf2ErrorState message="Não foi possível carregar este agente." />
        )}
      </div>
    );
  }

  const { agent, runs } = data;

  return (
    <div className="page-scroll space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/automacoes/agentes" className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--cf2-text-tertiary)" }}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center justify-center rounded-lg shrink-0 w-9 h-9" style={{ background: "var(--cf2-accent)" }}>
          <Bot className="w-4 h-4" style={{ color: "var(--cf2-text-on-accent)" }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{agent.nome}</h1>
            <Cf2Badge variant={STATUS_VARIANT[agent.status] || "neutral"}>{STATUS_LABEL[agent.status] || agent.status}</Cf2Badge>
            <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{agent.finalidade}</span>
          </div>
          <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{agent.descricao || "Sem descrição."}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Cf2Card>
          <Cf2SectionHeader title="Versão publicada" subtitle={publishedVersion ? `v${publishedVersion.versao} · ${publishedVersion.modelo || "modelo não definido"}` : undefined} />
          {!publishedVersion ? (
            <div className="mt-3"><Cf2EmptyState title="Nenhuma versão publicada" description="Este agente não tem versão publicada — o dispatcher nunca vai selecioná-lo." /></div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
              <div><span className="font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Provider:</span> <span style={{ color: "var(--cf2-text-primary)" }}>{publishedVersion.provider || "não definido"}</span></div>
              <div><span className="font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Prioridade:</span> <span style={{ color: "var(--cf2-text-primary)" }}>{agent.prioridade}</span></div>
              <div><span className="font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Publicada em:</span> <span style={{ color: "var(--cf2-text-primary)" }}>{publishedVersion.publishedAt ? new Date(publishedVersion.publishedAt).toLocaleString("pt-BR") : "—"}</span></div>
              <div><span className="font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Total de versões:</span> <span style={{ color: "var(--cf2-text-primary)" }}>{data.versions.length}</span></div>
            </div>
          )}
        </Cf2Card>

        <Cf2Card>
          <Cf2SectionHeader title="Bindings / gatilho" subtitle="triggerConfig real da versão publicada" />
          {!publishedVersion || triggerValues.length === 0 ? (
            <div className="mt-3"><Cf2EmptyState title="Nenhum gatilho configurado" description="Esta versão não está vinculada a nenhum eventType — só é elegível se o dispatcher receber o agentId explícito." /></div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {triggerValues.map((v) => <Cf2Badge key={v} variant="accent">{v}</Cf2Badge>)}
              </div>
              <KeyValueList obj={publishedVersion.triggerConfig} />
            </div>
          )}
        </Cf2Card>

        <Cf2Card>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} />
            <Cf2SectionHeader title="Ferramentas" subtitle="tools configuradas na versão publicada" />
          </div>
          {!publishedVersion ? (
            <div className="mt-3"><Cf2EmptyState title="Sem versão publicada" /></div>
          ) : configuredTools.length === 0 ? (
            <div className="mt-3"><Cf2EmptyState title="Nenhuma ferramenta configurada" description="Esta versão não tem tools associadas — qualquer ferramenta solicitada em runtime seria bloqueada pela política." /></div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {configuredTools.map((t) => <Cf2Badge key={t} variant="neutral">{t}</Cf2Badge>)}
            </div>
          )}
        </Cf2Card>

        <Cf2Card>
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} />
            <Cf2SectionHeader title="Limites e custo" subtitle="reais da versão publicada" />
          </div>
          {!publishedVersion ? (
            <div className="mt-3"><Cf2EmptyState title="Sem versão publicada" /></div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{publishedVersion.maxSteps}</p>
                <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>máx. passos</p>
              </div>
              <div>
                <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{publishedVersion.tokenBudget}</p>
                <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>orçamento tokens</p>
              </div>
              <div>
                <p className="text-[18px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{formatCusto(publishedVersion.costBudget) || "sem limite"}</p>
                <p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>orçamento custo</p>
              </div>
            </div>
          )}
        </Cf2Card>

        <Cf2Card className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} />
            <Cf2SectionHeader title="Handoff" subtitle="handoffConfig real da versão publicada" />
          </div>
          {!publishedVersion || Object.keys(publishedVersion.handoffConfig || {}).length === 0 ? (
            <div className="mt-3"><Cf2EmptyState title="Nenhuma regra de handoff configurada" description="Esta versão não define quando repassar pra um humano." /></div>
          ) : (
            <div className="mt-3"><KeyValueList obj={publishedVersion.handoffConfig} /></div>
          )}
        </Cf2Card>
      </div>

      <Cf2Card>
        <div className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} />
          <Cf2SectionHeader title="Testar (dry-run)" subtitle="Chama o dispatcher real. Nunca envia mensagem nem chama provedor de IA." />
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Tipo de evento *</label>
            <input
              value={form.eventType}
              onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
              placeholder="ex: lead.mensagem_recebida"
              className="w-full text-[13px] rounded-lg px-3 py-2"
              style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}
            />
            {triggerValues.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {triggerValues.map((v) => (
                  <button key={v} onClick={() => setForm((f) => ({ ...f, eventType: v }))} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>
                    usar &quot;{v}&quot;
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Tipo de entidade</label>
            <input
              value={form.entityType}
              onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value }))}
              className="w-full text-[13px] rounded-lg px-3 py-2"
              style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Lead ID (opcional)</label>
            <input
              value={form.leadId}
              onChange={(e) => setForm((f) => ({ ...f, leadId: e.target.value }))}
              placeholder="uuid"
              className="w-full text-[13px] rounded-lg px-3 py-2"
              style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Contato ID (opcional)</label>
            <input
              value={form.contatoId}
              onChange={(e) => setForm((f) => ({ ...f, contatoId: e.target.value }))}
              placeholder="uuid"
              className="w-full text-[13px] rounded-lg px-3 py-2"
              style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Ferramentas solicitadas (separadas por vírgula, opcional)</label>
            <input
              value={form.requestedTools}
              onChange={(e) => setForm((f) => ({ ...f, requestedTools: e.target.value }))}
              placeholder={configuredTools.length > 0 ? configuredTools.join(", ") : "ex: buscar_pedido"}
              className="w-full text-[13px] rounded-lg px-3 py-2"
              style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}
            />
          </div>
        </div>

        <button
          onClick={() => dryRun.mutate()}
          disabled={!form.eventType.trim() || dryRun.isPending}
          className="mt-3 flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: "var(--cf2-bg-inverse)", color: "var(--cf2-text-on-accent)" }}
        >
          {dryRun.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
          Testar (dry-run)
        </button>

        {resultado && (
          <div className="mt-4 rounded-xl p-3.5" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            {!resultado.selecionado ? (
              <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>
                Nenhum agente selecionado. {resultado.motivo || "Nenhum agente publicado corresponde ao evento."} ({resultado.candidatos ?? 0} candidato(s) publicado(s) na organização)
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
                  Selecionado: {resultado.selecionado.nome} (versão {resultado.selecionado.versao})
                </p>
                {resultado.policy && (
                  <div className="flex flex-wrap gap-1.5 items-center text-[12px]">
                    <span style={{ color: "var(--cf2-text-secondary)" }}>Permitidas:</span>
                    {resultado.policy.allowedTools.length === 0 ? <span style={{ color: "var(--cf2-text-tertiary)" }}>nenhuma</span> : resultado.policy.allowedTools.map((t) => <Cf2Badge key={t} variant="success">{t}</Cf2Badge>)}
                    <span style={{ color: "var(--cf2-text-secondary)" }}>· Bloqueadas:</span>
                    {resultado.policy.blockedTools.length === 0 ? <span style={{ color: "var(--cf2-text-tertiary)" }}>nenhuma</span> : resultado.policy.blockedTools.map((t) => <Cf2Badge key={t} variant="danger">{t}</Cf2Badge>)}
                  </div>
                )}
              </div>
            )}
            {resultado.run && (
              <pre className="text-[11px] whitespace-pre-wrap break-all mt-2 rounded-lg p-2.5" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>
                {JSON.stringify(resultado.run.trace, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Cf2Card>

      <Cf2Card>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" style={{ color: "var(--cf2-text-tertiary)" }} />
          <Cf2SectionHeader title="Histórico de execuções" subtitle="ai_agent_runs deste agente, mais recentes primeiro" />
        </div>
        {runs.length === 0 ? (
          <div className="mt-3"><Cf2EmptyState title="Nenhuma execução ainda" description="Rode um teste (dry-run) acima ou aguarde o dispatcher real disparar este agente." /></div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {runs.map((run) => <RunRow key={run.id} run={run} />)}
          </div>
        )}
      </Cf2Card>
    </div>
  );
}
