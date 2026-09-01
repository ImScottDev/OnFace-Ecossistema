"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CirclePause, GitBranch, History, ListChecks, Pencil, Play, Plus, Save, Search, Send, X, XCircle } from "lucide-react";
import { FollowupFlowCanvas } from "./FollowupFlowCanvas";
import { followupGraphSchema, type FollowupGraph } from "./followup-types";
import { createEmptyFollowupGraph } from "@/lib/ai-platform/followup/graph";
import { legacyStepsToFollowupGraph } from "@/lib/ai-platform/followup/legacy";
import { validateFollowupForPublish, type FollowupValidationResult } from "@/lib/ai-platform/followup/validate";
import type { CadenceStep } from "@/lib/cadencia/cadence-engine";

type Cadencia = {
  id: string; nome: string; entityType: string; ativo: boolean; status: string; versao: number; publishedAt: string | null;
  draftSteps: CadenceStep[] | null; steps: CadenceStep[]; draftGraph: FollowupGraph | null; publishedGraph: FollowupGraph | null;
  draftVersionId: string | null; publishedVersionId: string | null; totalPassos: number; enrollmentsPorStatus: Record<string, number>;
};
type FlowData = { cadencias: Cadencia[]; mecanismosParalelos: { cadenciaSdrInboundExecucoes: number; aiSdrRetrySweep: string } };
type QueueItem = { id: string; status: string; entityType: string; entityName: string; entityDetail: string | null; definitionName: string; currentStep: string; nextFireAt: string | null };
type QueueData = { items: QueueItem[]; total: number; definitions: Array<{ id: string; nome: string }> };
type Version = { id: string; versionNumber: number; status: string; publishedAt: string | null; supersededAt: string | null };
const statusLabel: Record<string, string> = { active: "Ativo", waiting: "Aguardando", paused: "Pausado", completed: "Concluído", cancelled: "Cancelado", failed: "Falhou" };
const entityLabel: Record<string, string> = { lead: "Lead", contato: "Contato", negocio: "Negócio" };
async function request(url: string, init?: RequestInit) { const r = await fetch(url, init); if (!r.ok) { const b = await r.json().catch(() => null); throw new Error(b?.error ?? "Não foi possível concluir a ação."); } return r.json(); }

function graphFromCadencia(cd: Cadencia | null): FollowupGraph {
  if (!cd) return createEmptyFollowupGraph();
  if (cd.draftGraph) return cd.draftGraph;
  const legacySteps = cd.draftSteps?.length ? cd.draftSteps : cd.steps;
  return legacySteps?.length ? legacyStepsToFollowupGraph(legacySteps) : createEmptyFollowupGraph();
}

/** Produto chama Follow-ups. O motor interno permanece cadence_* para não criar um sistema paralelo. */
export function Cf2CadenciasWorkspace() {
  const qc = useQueryClient();
  const [view, setView] = useState<"flows" | "queue">("flows");
  const [editando, setEditando] = useState<Cadencia | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [nome, setNome] = useState(""); const [entityType, setEntityType] = useState("lead"); const [graph, setGraph] = useState<FollowupGraph>(createEmptyFollowupGraph());
  const [openEventsFor, setOpenEventsFor] = useState<string | null>(null);
  const [status, setStatus] = useState("all"); const [flow, setFlow] = useState("all"); const [search, setSearch] = useState("");
  const flows = useQuery<FlowData>({ queryKey: ["cf2-followups"], queryFn: () => request("/api/automacoes/cadencias") });
  const queue = useQuery<QueueData>({ queryKey: ["cf2-followups-queue", status, flow, search], queryFn: () => request(`/api/automacoes/cadencias/fila?status=${status}&definitionId=${flow}&q=${encodeURIComponent(search)}`), enabled: view === "queue" });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["cf2-followups"] }); qc.invalidateQueries({ queryKey: ["cf2-followups-queue"] }); };
  const enrollmentAction = useMutation({ mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "cancel" }) => request(`/api/automacoes/cadencias/enrollments/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }), onSuccess: (_, v) => { toast.success(v.action === "pause" ? "Follow-up pausado." : v.action === "resume" ? "Follow-up retomado." : "Follow-up cancelado."); refresh(); }, onError: (e: Error) => toast.error(e.message) });

  const open = (cd?: Cadencia) => { setEditando(cd ?? null); setIsNew(!cd); setNome(cd?.nome ?? "Novo follow-up"); setEntityType(cd?.entityType ?? "lead"); setGraph(graphFromCadencia(cd ?? null)); };
  const close = () => { setEditando(null); setIsNew(false); setNome(""); };

  const structuralError = useMemo(() => followupGraphSchema.safeParse(graph), [graph]);
  const validation: FollowupValidationResult | null = useMemo(() => (structuralError.success ? validateFollowupForPublish(graph) : null), [structuralError, graph]);

  const save = async (action: "save_draft" | "publish") => {
    if (!structuralError.success) { toast.error(`Grafo inválido: ${structuralError.error.issues[0]?.message ?? "verifique os nós."}`); return; }
    if (action === "publish" && validation && !validation.ok) { toast.error(validation.errors[0]?.message ?? "Fluxo não pode ser publicado."); return; }
    try {
      const created = await request(editando ? `/api/automacoes/cadencias/${editando.id}` : "/api/automacoes/cadencias", { method: editando ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editando ? { action, nome, entityType, graph } : { nome, entityType, graph }) });
      if (!editando && action === "publish") await request(`/api/automacoes/cadencias/${created.cadencia.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
      toast.success(action === "publish" ? "Follow-up publicado." : "Rascunho salvo.");
      close(); refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
  };
  const pauseFlow = async (cd: Cadencia) => { try { await request(`/api/automacoes/cadencias/${cd.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pause" }) }); toast.success("Fluxo pausado."); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível pausar."); } };
  const rollback = async (cd: Cadencia, versionId: string) => { try { await request(`/api/automacoes/cadencias/${cd.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rollback", versionId }) }); toast.success("Revertido para a versão selecionada."); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível reverter."); } };

  const cadencias = flows.data?.cadencias ?? [];
  return <div className="flex flex-col gap-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[24px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Follow-ups</h1><p className="mt-1 text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Fluxos de retomada e acompanhamento, com cada inscrição rastreável até concluir, pausar ou cancelar.</p></div><button onClick={() => open()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Plus className="size-3.5" />Novo follow-up</button></header>
    <nav className="flex w-fit gap-1 rounded-xl p-1" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}><Tab active={view === "flows"} onClick={() => setView("flows")} icon={GitBranch}>Fluxos</Tab><Tab active={view === "queue"} onClick={() => setView("queue")} icon={ListChecks}>Fila</Tab></nav>
    {view === "flows" ? <Flows cadencias={cadencias} loading={flows.isLoading} error={flows.isError} onEdit={open} onPause={pauseFlow} onRollback={rollback} /> : <Queue data={queue.data} loading={queue.isLoading} error={queue.isError} status={status} flow={flow} search={search} onStatus={setStatus} onFlow={setFlow} onSearch={setSearch} onAction={(id, action) => enrollmentAction.mutate({ id, action })} onOpenEvents={setOpenEventsFor} busy={enrollmentAction.isPending} />}
    {flows.data?.mecanismosParalelos.cadenciaSdrInboundExecucoes ? <div className="flex gap-3 rounded-xl p-4" style={{ background: "var(--cf2-warning-bg)", border: "1px solid var(--cf2-warning-border)" }}><AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--cf2-warning-text)" }} /><p className="text-[12px] leading-5" style={{ color: "var(--cf2-text-secondary)" }}><strong style={{ color: "var(--cf2-warning-text)" }}>Legado separado.</strong> Existem {flows.data.mecanismosParalelos.cadenciaSdrInboundExecucoes} execuções de SDR inbound fora deste motor. Elas seguem visíveis para não fingir que já foram migradas.</p></div> : null}
    {editando !== null || isNew ? <Editor nome={nome} entityType={entityType} graph={graph} validation={validation} structurallyValid={structuralError.success} existing={editando} onClose={close} onSave={save} onNome={setNome} onEntity={setEntityType} onGraph={setGraph} /> : null}
    {openEventsFor ? <EventsDrawer enrollmentId={openEventsFor} onClose={() => setOpenEventsFor(null)} /> : null}
  </div>;
}

function Tab({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof GitBranch; children: React.ReactNode }) { return <button onClick={onClick} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold" style={{ background: active ? "var(--cf2-bg-surface)" : "transparent", color: active ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)" }}><Icon className="size-3.5" />{children}</button>; }
function FlowStatus({ cd }: { cd: Cadencia }) { const x = cd.ativo ? ["Ativo", "var(--cf2-success-bg)", "var(--cf2-success-text)"] : cd.publishedAt ? ["Pausado", "var(--cf2-warning-bg)", "var(--cf2-warning-text)"] : ["Rascunho", "var(--cf2-bg-surface-muted)", "var(--cf2-text-secondary)"]; return <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: x[1], color: x[2] }}>{x[0]}</span>; }

function Flows({ cadencias, loading, error, onEdit, onPause, onRollback }: { cadencias: Cadencia[]; loading: boolean; error: boolean; onEdit: (cd: Cadencia) => void; onPause: (cd: Cadencia) => void; onRollback: (cd: Cadencia, versionId: string) => void }) {
  const [historyFor, setHistoryFor] = useState<Cadencia | null>(null);
  if (loading) return <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando fluxos…</p>;
  if (error) return <p className="text-[13px]" style={{ color: "var(--cf2-danger-text)" }}>Não foi possível carregar os follow-ups.</p>;
  if (!cadencias.length) return <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: "var(--cf2-border-default)" }}><GitBranch className="mx-auto mb-3 size-5" style={{ color: "var(--cf2-text-tertiary)" }} /><p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>Nenhum follow-up configurado</p><p className="mt-1 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>Crie o primeiro fluxo para acompanhar leads, contatos ou negócios.</p></div>;
  return <>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cadencias.map((cd) => { const queued = (cd.enrollmentsPorStatus.active ?? 0) + (cd.enrollmentsPorStatus.waiting ?? 0); return <article key={cd.id} className="rounded-2xl p-4" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{cd.nome}</p><p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{entityLabel[cd.entityType] ?? cd.entityType} · versão {cd.versao}</p></div><FlowStatus cd={cd} /></div><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Etapas" value={cd.totalPassos} /><Mini label="Na fila" value={queued} /><Mini label="Falhas" value={cd.enrollmentsPorStatus.failed ?? 0} /></div><div className="mt-4 flex gap-2"><button onClick={() => onEdit(cd)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}><Pencil className="size-3" />Editar</button>{cd.publishedVersionId ? <button onClick={() => setHistoryFor(cd)} title="Versões / reverter" className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}><History className="size-3" /></button> : null}{cd.ativo ? <button onClick={() => onPause(cd)} className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}><CirclePause className="size-3" />Pausar</button> : <button onClick={() => onEdit(cd)} className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Send className="size-3" />Publicar</button>}</div></article>; })}</div>
    {historyFor ? <VersionHistory cd={historyFor} onClose={() => setHistoryFor(null)} onRollback={(versionId) => { onRollback(historyFor, versionId); setHistoryFor(null); }} /> : null}
  </>;
}

function VersionHistory({ cd, onClose, onRollback }: { cd: Cadencia; onClose: () => void; onRollback: (versionId: string) => void }) {
  const q = useQuery<{ versions: Version[] }>({ queryKey: ["cf2-followup-versions", cd.id], queryFn: () => request(`/api/automacoes/cadencias/${cd.id}`) });
  return <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5" style={{ background: "var(--cf2-bg-surface)" }}>
      <div className="flex items-center justify-between"><h3 className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Versões · {cd.nome}</h3><button onClick={onClose}><X className="size-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button></div>
      <div className="mt-4 space-y-2">{(q.data?.versions ?? []).filter((v) => v.status !== "draft").map((v) => <div key={v.id} className="flex items-center justify-between rounded-lg p-2.5 text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)" }}><span>v{v.versionNumber} · {v.status === "published" ? "publicada" : "substituída"} {v.publishedAt ? `· ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(v.publishedAt))}` : ""}</span>{v.id !== cd.publishedVersionId ? <button onClick={() => onRollback(v.id)} className="rounded-md px-2 py-1 text-[11px] font-semibold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Reverter</button> : <span className="text-[10px] font-bold" style={{ color: "var(--cf2-success-text)" }}>Atual</span>}</div>)}
      {!q.data?.versions.length ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando…</p> : null}</div>
    </div>
  </div>;
}

function Mini({ label, value }: { label: string; value: number }) { return <div><p className="text-[16px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{value}</p><p className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{label}</p></div>; }

function Queue({ data, loading, error, status, flow, search, onStatus, onFlow, onSearch, onAction, onOpenEvents, busy }: { data?: QueueData; loading: boolean; error: boolean; status: string; flow: string; search: string; onStatus: (x: string) => void; onFlow: (x: string) => void; onSearch: (x: string) => void; onAction: (id: string, a: "pause" | "resume" | "cancel") => void; onOpenEvents: (id: string) => void; busy: boolean }) {
  return <div className="rounded-2xl" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
    <div className="flex flex-wrap gap-2 border-b p-3" style={{ borderColor: "var(--cf2-border-default)" }}><label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg px-2.5" style={{ background: "var(--cf2-bg-surface-muted)" }}><Search className="size-3.5" style={{ color: "var(--cf2-text-tertiary)" }} /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar pessoa, empresa ou fluxo" className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none" style={{ color: "var(--cf2-text-primary)" }} /></label><select value={status} onChange={(e) => onStatus(e.target.value)} className="rounded-lg px-2 text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}><option value="all">Todos os status</option>{Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><select value={flow} onChange={(e) => onFlow(e.target.value)} className="rounded-lg px-2 text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}><option value="all">Todos os fluxos</option>{data?.definitions.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></div>
    {loading ? <p className="p-6 text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando fila…</p> : error ? <p className="p-6 text-[13px]" style={{ color: "var(--cf2-danger-text)" }}>Não foi possível carregar a fila.</p> : !data?.items.length ? <p className="p-10 text-center text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Nenhuma inscrição encontrada com estes filtros.</p> : <div className="overflow-x-auto"><table className="min-w-[840px] w-full text-left"><thead><tr className="text-[10px] uppercase tracking-wide" style={{ color: "var(--cf2-text-tertiary)", background: "var(--cf2-bg-surface-subtle)" }}><th className="px-4 py-3">Pessoa / registro</th><th className="px-4 py-3">Follow-up</th><th className="px-4 py-3">Etapa atual</th><th className="px-4 py-3">Próxima execução</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody>{data.items.map((item) => <tr key={item.id} className="cursor-pointer border-t text-[12px]" style={{ borderColor: "var(--cf2-border-default)" }} onClick={() => onOpenEvents(item.id)}><td className="px-4 py-3"><p className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{item.entityName}</p><p className="mt-0.5 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{item.entityDetail ?? entityLabel[item.entityType] ?? item.entityType}</p></td><td className="px-4 py-3" style={{ color: "var(--cf2-text-secondary)" }}>{item.definitionName}</td><td className="px-4 py-3" style={{ color: "var(--cf2-text-secondary)" }}>{item.currentStep}</td><td className="px-4 py-3" style={{ color: "var(--cf2-text-secondary)" }}>{item.nextFireAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.nextFireAt)) : "—"}</td><td className="px-4 py-3"><span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}>{statusLabel[item.status] ?? item.status}</span></td><td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-1">{(item.status === "active" || item.status === "waiting") ? <button disabled={busy} onClick={() => onAction(item.id, "pause")} title="Pausar" className="rounded p-1.5" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}><CirclePause className="size-3.5" /></button> : item.status === "paused" ? <button disabled={busy} onClick={() => onAction(item.id, "resume")} title="Retomar" className="rounded p-1.5" style={{ background: "var(--cf2-success-bg)", color: "var(--cf2-success-text)" }}><Play className="size-3.5" /></button> : null}{!["completed", "cancelled"].includes(item.status) ? <button disabled={busy} onClick={() => onAction(item.id, "cancel")} title="Cancelar" className="rounded p-1.5" style={{ background: "var(--cf2-danger-bg)", color: "var(--cf2-danger-text)" }}><XCircle className="size-3.5" /></button> : null}</div></td></tr>)}</tbody></table></div>}
  </div>;
}

function EventsDrawer({ enrollmentId, onClose }: { enrollmentId: string; onClose: () => void }) {
  const q = useQuery<{ events: Array<{ id: string; stepId: string; status: string; resultado: unknown; attempt: number; createdAt: string }> }>({ queryKey: ["cf2-followup-events", enrollmentId], queryFn: () => request(`/api/automacoes/cadencias/enrollments/${enrollmentId}/events`) });
  return <div className="fixed inset-0 z-[1100] flex justify-end bg-black/40" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto p-5" style={{ background: "var(--cf2-bg-surface)" }}>
      <div className="flex items-center justify-between"><h3 className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Histórico da inscrição</h3><button onClick={onClose}><X className="size-4" style={{ color: "var(--cf2-text-tertiary)" }} /></button></div>
      <div className="mt-4 space-y-2">
        {q.isLoading ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando…</p> : null}
        {!q.isLoading && !q.data?.events.length ? <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem eventos ainda.</p> : null}
        {q.data?.events.map((ev) => <div key={ev.id} className="rounded-lg p-3 text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)" }}>
          <div className="flex items-center justify-between"><span className="font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{ev.status}</span><span className="text-[10px]" style={{ color: "var(--cf2-text-tertiary)" }}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(ev.createdAt))}</span></div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>nó: {ev.stepId}{ev.attempt ? ` · tentativa ${ev.attempt}` : ""}</p>
          {ev.resultado ? <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-md p-2 text-[10px]" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>{JSON.stringify(ev.resultado, null, 2)}</pre> : null}
        </div>)}
      </div>
    </div>
  </div>;
}

function Editor({ nome, entityType, graph, validation, structurallyValid, existing, onClose, onSave, onNome, onEntity, onGraph }: {
  nome: string; entityType: string; graph: FollowupGraph; validation: FollowupValidationResult | null; structurallyValid: boolean; existing: Cadencia | null;
  onClose: () => void; onSave: (a: "save_draft" | "publish") => void; onNome: (x: string) => void; onEntity: (x: string) => void; onGraph: (x: FollowupGraph) => void;
}) {
  const canPublish = structurallyValid && Boolean(validation?.ok);
  const pendencias = validation && !validation.ok ? validation.errors.length : structurallyValid ? 0 : 1;
  return <div data-cf2-theme="builder" className="fixed inset-0 z-[1000] flex flex-col" style={{ background: "var(--cf2-bg-page)" }}>
    <header className="flex h-[72px] shrink-0 items-center gap-4 border-b px-7" style={{ borderColor: "var(--cf2-border-default)" }}>
      <div><p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Automações / Follow-ups</p><input value={nome} onChange={(e) => onNome(e.target.value)} className="mt-1 bg-transparent text-[16px] font-bold outline-none" style={{ color: "var(--cf2-text-primary)" }} /></div>
      <select value={entityType} onChange={(e) => onEntity(e.target.value)} className="rounded-lg px-2 py-1.5 text-[12px]" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}><option value="lead">Lead</option><option value="contato">Contato</option><option value="negocio">Negócio</option></select>
      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase" style={{ background: existing?.ativo ? "var(--cf2-success-bg)" : "var(--cf2-warning-bg)", color: existing?.ativo ? "var(--cf2-success-text)" : "var(--cf2-warning-text)" }}>{existing?.ativo ? "Publicado" : "Rascunho"}</span>
      <button onClick={onClose} className="ml-auto rounded-lg px-3 py-2 text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Fechar</button>
    </header>
    <main className="min-h-0 flex-1 p-5 lg:p-6"><FollowupFlowCanvas key={existing?.id ?? "new"} graph={graph} onGraphChange={onGraph} validation={validation} /></main>
    <footer className="flex h-[68px] shrink-0 items-center px-7" style={{ borderTop: "1px solid var(--cf2-border-default)", background: "var(--cf2-bg-surface-subtle)" }}>
      <span className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>{graph.nodes.length} nós · {pendencias > 0 ? `${pendencias} pendência(s) para publicar` : "pronto para publicar"}</span>
      <div className="ml-auto flex gap-2">
        <button onClick={() => onSave("save_draft")} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-border-default)" }}><Save className="size-3.5" />Salvar</button>
        <button onClick={() => onSave("publish")} disabled={!canPublish} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold disabled:opacity-40" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}><Send className="size-3.5" />Publicar</button>
      </div>
    </footer>
  </div>;
}
