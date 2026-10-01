"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Cadências — tela ONFACE (arquétipo B, Data List).
 *
 * Não tem protótipo próprio. É a versão ONFACE de crm2/automacoes/
 * CadenciasWorkspace, que continua existindo porque o AgenteIAHub ainda a
 * usa. Tudo que aquela tela fazia continua aqui, pelas MESMAS rotas Hono
 * (api-server/routes/automacoes-cadencias.ts):
 *  - listar, criar, salvar rascunho, publicar, pausar, reverter versão;
 *  - fila de inscrições com filtro, pausar/retomar/cancelar, histórico.
 * O que entrou de novo: inscrever um registro manualmente (POST
 * /automacoes/cadencias/:id/enrollments), que antes só existia pela
 * Prospecção e sem conferir o tenant da entidade.
 *
 * O construtor do fluxo (FollowupFlowCanvas) é reaproveitado inteiro: ele
 * ainda pinta com tokens cf2 dentro de data-cf2-theme="builder", e trocar o
 * canvas agora seria refazer o editor, não reestilizar a lista.
 * ───────────────────────────────────────────────────────────────────────── */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CirclePause, History, Info, Pencil, Play, Plus, Save, Search, Send, UserPlus, X, XCircle } from "lucide-react";
import { FollowupFlowCanvas } from "@/components/crm2/automacoes/FollowupFlowCanvas";
import { followupGraphSchema, EVENT_CATALOG, type FollowupGraph } from "@/components/crm2/automacoes/followup-types";
import { createEmptyFollowupGraph } from "@/lib/ai-platform/followup/graph";
import { legacyStepsToFollowupGraph } from "@/lib/ai-platform/followup/legacy";
import { validateFollowupForPublish, type FollowupValidationResult } from "@/lib/ai-platform/followup/validate";
import type { CadenceStep } from "@/lib/cadencia/cadence-engine";
import { PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import { AbasAutomacoes } from "../Abas";
import { STATUS_EXECUCAO } from "../formato";
import "../automacoes.css";
import "./cadencias.css";

type Cadencia = {
  id: string; nome: string; entityType: string; ativo: boolean; status: string; versao: number; publishedAt: string | null;
  triggerConfig: { event?: string } | null;
  draftSteps: CadenceStep[] | null; steps: CadenceStep[]; draftGraph: FollowupGraph | null; publishedGraph: FollowupGraph | null;
  draftVersionId: string | null; publishedVersionId: string | null; totalPassos: number; enrollmentsPorStatus: Record<string, number>;
};
type FlowData = { cadencias: Cadencia[]; mecanismosParalelos: { cadenciaSdrInboundExecucoes: number } };
type QueueItem = { id: string; status: string; entityType: string; entityName: string; entityDetail: string | null; definitionName: string; currentStep: string; nextFireAt: string | null };
type QueueData = { items: QueueItem[]; total: number; definitions: Array<{ id: string; nome: string }> };
type Version = { id: string; versionNumber: number; status: string; publishedAt: string | null };
type Candidato = { id: string; nome: string; detalhe: string | null; jaInscrito: boolean };

const STATUS_INSCRICAO: Record<string, [string, "ok" | "alerta" | "erro" | undefined]> = {
  active: ["Ativo", "ok"], waiting: ["Aguardando", undefined], waiting_reply: ["Aguardando resposta", undefined], paused: ["Pausado", "alerta"],
  completed: ["Concluído", undefined], cancelled: ["Cancelado", undefined], failed: ["Falhou", "erro"],
};
const ENTIDADE: Record<string, string> = { lead: "Lead", contato: "Contato", negocio: "Negócio", oportunidade: "Oportunidade", cliente: "Cliente", empresa: "Empresa", servico: "Serviço" };
// Espelha ENTIDADES_INSCREVIVEIS da rota Hono: só estes tipos têm tabela
// resolvível no tenant para a inscrição manual.
const INSCREVIVEL = new Set(["lead", "contato", "negocio"]);
const EVENTO = new Map(EVENT_CATALOG.map((e) => [e.id, e.nome]));
const SEM_PERMISSAO = "Seu papel não tem automation.manage.";
const fmtData = (iso: string, hora = false) => new Intl.DateTimeFormat("pt-BR", hora ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(new Date(iso));

async function request(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) { const b = await r.json().catch(() => null); throw new Error(b?.error ?? "Não foi possível concluir a ação."); }
  return r.json();
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function graphFromCadencia(cd: Cadencia | null): FollowupGraph {
  if (!cd) return createEmptyFollowupGraph();
  if (cd.draftGraph) return cd.draftGraph;
  const legacy = cd.draftSteps?.length ? cd.draftSteps : cd.steps;
  return legacy?.length ? legacyStepsToFollowupGraph(legacy) : createEmptyFollowupGraph();
}

function estadoCadencia(cd: Cadencia): [string, "ok" | "alerta" | undefined] {
  if (cd.ativo) return ["Publicada", "ok"];
  if (cd.publishedAt) return ["Pausada", "alerta"];
  return ["Rascunho", undefined];
}

export function CadenciasOnface({ podeGerenciar }: { podeGerenciar: boolean }) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<"cadencias" | "inscricoes">("cadencias");
  const [editor, setEditor] = useState<{ cd: Cadencia | null } | null>(null);
  const [historico, setHistorico] = useState<Cadencia | null>(null);
  const [inscrever, setInscrever] = useState<Cadencia | null>(null);
  const [eventosDe, setEventosDe] = useState<string | null>(null);
  // Abre em "em_curso" para a lista bater com o contador da aba (totais.emCurso).
  const [status, setStatus] = useState("em_curso"); const [fluxo, setFluxo] = useState("all"); const [busca, setBusca] = useState("");

  const flows = useQuery<FlowData>({ queryKey: ["cf2-followups"], queryFn: () => request("/api/automacoes/cadencias") });
  const queue = useQuery<QueueData>({
    queryKey: ["cf2-followups-queue", status, fluxo, busca],
    queryFn: () => request(`/api/automacoes/cadencias/fila?status=${status}&definitionId=${fluxo}&q=${encodeURIComponent(busca)}`),
    enabled: aba === "inscricoes",
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["cf2-followups"] }); qc.invalidateQueries({ queryKey: ["cf2-followups-queue"] }); };

  const acaoInscricao = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "cancel" }) => request(`/api/automacoes/cadencias/enrollments/${id}/action`, json("POST", { action })),
    onSuccess: (_, v) => { toast.success(v.action === "pause" ? "Inscrição pausada." : v.action === "resume" ? "Inscrição retomada." : "Inscrição cancelada."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const patch = async (cd: Cadencia, body: Record<string, unknown>, ok: string) => {
    try { await request(`/api/automacoes/cadencias/${cd.id}`, json("PATCH", body)); toast.success(ok); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação."); }
  };

  const cadencias = flows.data?.cadencias ?? [];
  // Totais saem das contagens por status que a rota já agrega no banco —
  // nada é recontado nem estimado no cliente.
  const totais = useMemo(() => cadencias.reduce((acc, cd) => {
    const s = cd.enrollmentsPorStatus;
    acc.publicadas += cd.ativo ? 1 : 0;
    acc.emCurso += (s.active ?? 0) + (s.waiting ?? 0) + (s.waiting_reply ?? 0);
    acc.falhas += s.failed ?? 0;
    return acc;
  }, { publicadas: 0, emCurso: 0, falhas: 0 }), [cadencias]);
  const legado = flows.data?.mecanismosParalelos.cadenciaSdrInboundExecucoes ?? 0;

  const verInscricoes = (st: string) => { setAba("inscricoes"); setStatus(st); setFluxo("all"); };

  return (
    <div className="of-cad">
      {/* Única tela do grupo sem as abas: daqui só se voltava pela sidebar. */}
      <div className="oa-barra"><AbasAutomacoes atual="/automacoes/cadencias" /></div>
      <PaginaCabecalho
        titulo="Cadências"
        descricao="Sequências de follow-up no tempo. Cada inscrição é rastreável até concluir, pausar ou cancelar."
        acoes={
          <button type="button" className="of-cad-btn" data-tom="primario" disabled={!podeGerenciar} title={podeGerenciar ? undefined : SEM_PERMISSAO} onClick={() => setEditor({ cd: null })}>
            <Plus />Nova cadência
          </button>
        }
      />
      <PaginaResumo itens={[
        { rotulo: "Cadências", valor: flows.isLoading ? "—" : cadencias.length, destaque: true, detalhe: flows.isLoading ? undefined : `${totais.publicadas} publicada(s)` },
        { rotulo: "Em curso", valor: flows.isLoading ? "—" : totais.emCurso, detalhe: "ativas ou aguardando", aoSelecionar: () => verInscricoes("em_curso"), ativo: aba === "inscricoes" && status === "em_curso" },
        { rotulo: "Falhas", valor: flows.isLoading ? "—" : totais.falhas, sinal: true, aoSelecionar: () => verInscricoes("failed"), ativo: aba === "inscricoes" && status === "failed" },
      ]} />

      {/* Honestidade sobre execução: o motor existe e roda no worker
          (job cadence-sweep), mas só o que estiver publicado e inscrito anda.
          Sem isso a pessoa cria uma cadência e acha que ela "dispara sozinha". */}
      <div className="of-cad-aviso" role="note">
        <Info />
        <span>
          <strong>Como executa.</strong> Só cadência <strong>publicada</strong> recebe inscrição. Gatilho “Inscrição manual/API” só anda quando alguém inscreve; gatilho de evento inscreve quando o evento acontece no CRM. Os passos rodam no worker (varredura periódica), então a próxima execução pode levar alguns minutos.
        </span>
      </div>
      {legado > 0 ? (
        <div className="of-cad-aviso" role="note">
          <AlertTriangle />
          <span><strong>Legado separado.</strong> Existem {legado.toLocaleString("pt-BR")} execuções da cadência de SDR inbound fora deste motor. Elas não aparecem aqui porque ainda não foram migradas.</span>
        </div>
      ) : null}

      <div className="of-cad-barra">
        <div className="of-cad-abas" role="tablist" aria-label="Visão">
          <button type="button" role="tab" className="of-cad-aba" aria-selected={aba === "cadencias"} onClick={() => setAba("cadencias")}>Cadências <span className="of-cad-cont">{cadencias.length}</span></button>
          <button type="button" role="tab" className="of-cad-aba" aria-selected={aba === "inscricoes"} onClick={() => setAba("inscricoes")}>Inscrições <span className="of-cad-cont">{flows.isLoading ? "" : totais.emCurso}</span></button>
        </div>
      </div>

      {aba === "cadencias" ? (
        <ListaCadencias
          cadencias={cadencias} loading={flows.isLoading} error={flows.isError} podeGerenciar={podeGerenciar}
          onNova={() => setEditor({ cd: null })} onEditar={(cd) => setEditor({ cd })} onHistorico={setHistorico} onInscrever={setInscrever}
          onPausar={(cd) => patch(cd, { action: "pause" }, "Cadência pausada.")}
        />
      ) : (
        <ListaInscricoes
          data={queue.data} loading={queue.isLoading} error={queue.isError} podeGerenciar={podeGerenciar} busy={acaoInscricao.isPending}
          status={status} fluxo={fluxo} busca={busca} onStatus={setStatus} onFluxo={setFluxo} onBusca={setBusca}
          onAcao={(id, action) => acaoInscricao.mutate({ id, action })} onEventos={setEventosDe}
        />
      )}

      {editor ? <Editor cd={editor.cd} onClose={() => setEditor(null)} onSaved={refresh} /> : null}
      {historico ? <Historico cd={historico} podeGerenciar={podeGerenciar} onClose={() => setHistorico(null)} onRollback={(v) => { patch(historico, { action: "rollback", versionId: v }, "Revertido para a versão selecionada."); setHistorico(null); }} /> : null}
      {inscrever ? <Inscrever cd={inscrever} onClose={() => setInscrever(null)} onDone={refresh} /> : null}
      {eventosDe ? <Eventos enrollmentId={eventosDe} onClose={() => setEventosDe(null)} /> : null}
    </div>
  );
}

function ListaCadencias({ cadencias, loading, error, podeGerenciar, onNova, onEditar, onHistorico, onInscrever, onPausar }: {
  cadencias: Cadencia[]; loading: boolean; error: boolean; podeGerenciar: boolean;
  onNova: () => void; onEditar: (cd: Cadencia) => void; onHistorico: (cd: Cadencia) => void; onInscrever: (cd: Cadencia) => void; onPausar: (cd: Cadencia) => void;
}) {
  if (loading) return <div className="of-cad-lista"><p className="of-cad-vazio">Carregando cadências…</p></div>;
  if (error) return <div className="of-cad-lista"><p className="of-cad-vazio" style={{ color: "var(--of-coral-acao-hover)" }}>Não foi possível carregar as cadências.</p></div>;
  if (!cadencias.length) return (
    <div className="of-cad-lista"><div className="of-cad-vazio">
      <h2>Nenhuma cadência configurada</h2>
      <p>Monte a sequência de passos (espera, mensagem, tarefa, condição), publique e inscreva leads, contatos ou negócios.</p>
      <button type="button" className="of-cad-btn" data-tom="primario" disabled={!podeGerenciar} title={podeGerenciar ? undefined : SEM_PERMISSAO} onClick={onNova}><Plus />Criar a primeira</button>
    </div></div>
  );
  return (
    <div className="of-cad-lista of-cad-rolagem">
      <table className="of-cad-tabela" style={{ minWidth: 880 }}>
        <thead><tr><th>Cadência</th><th>Gatilho</th><th>Estado</th><th>Etapas</th><th>Em curso</th><th>Concluídas</th><th>Falhas</th><th /></tr></thead>
        <tbody>
          {cadencias.map((cd) => {
            const s = cd.enrollmentsPorStatus;
            const emCurso = (s.active ?? 0) + (s.waiting ?? 0) + (s.waiting_reply ?? 0);
            const [rotulo, tom] = estadoCadencia(cd);
            const evento = cd.triggerConfig?.event ?? "manual";
            // Motivo visível em vez de botão que falha: inscrição só faz sentido
            // em cadência publicada e de um tipo que a rota sabe resolver.
            const motivoInscrever = !podeGerenciar ? SEM_PERMISSAO : !cd.ativo ? "Publique a cadência antes de inscrever." : !INSCREVIVEL.has(cd.entityType) ? "Inscrição manual só para lead, contato ou negócio." : null;
            return (
              <tr key={cd.id}>
                <td><span className="of-cad-nome">{cd.nome}</span><span className="of-cad-sub">{ENTIDADE[cd.entityType] ?? cd.entityType} · versão {cd.versao}{cd.publishedAt ? ` · publicada ${fmtData(cd.publishedAt)}` : ""}</span></td>
                <td style={{ color: "var(--of-tinta-2)" }}>{EVENTO.get(evento) ?? evento}</td>
                <td><span className="of-cad-pilula" data-tom={tom}>{rotulo}</span></td>
                <td><span className="of-cad-num">{cd.totalPassos}</span></td>
                <td><span className="of-cad-num">{emCurso}</span></td>
                <td><span className="of-cad-num">{s.completed ?? 0}</span></td>
                <td><span className="of-cad-num" data-sinal={(s.failed ?? 0) > 0}>{s.failed ?? 0}</span></td>
                <td>
                  <div className="of-cad-acoes">
                    <button type="button" className="of-cad-btn" data-tamanho="p" disabled={!!motivoInscrever} title={motivoInscrever ?? "Inscrever um registro"} onClick={() => onInscrever(cd)}><UserPlus />Inscrever</button>
                    <button type="button" className="of-cad-btn" data-tamanho="p" disabled={!podeGerenciar} title={podeGerenciar ? "Editar fluxo" : SEM_PERMISSAO} onClick={() => onEditar(cd)}><Pencil />Editar</button>
                    {cd.publishedVersionId ? <button type="button" className="of-cad-btn" data-tamanho="p" data-tom="fantasma" title="Versões publicadas" aria-label="Versões publicadas" onClick={() => onHistorico(cd)}><History /></button> : null}
                    {cd.ativo
                      ? <button type="button" className="of-cad-btn" data-tamanho="p" data-tom="fantasma" disabled={!podeGerenciar} title={podeGerenciar ? "Pausar: novas inscrições param; as em curso seguem" : SEM_PERMISSAO} onClick={() => onPausar(cd)}><CirclePause />Pausar</button>
                      : <button type="button" className="of-cad-btn" data-tamanho="p" data-tom="fantasma" disabled={!podeGerenciar} title={podeGerenciar ? "Abrir para revisar e publicar" : SEM_PERMISSAO} onClick={() => onEditar(cd)}><Send />Publicar</button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ListaInscricoes({ data, loading, error, podeGerenciar, busy, status, fluxo, busca, onStatus, onFluxo, onBusca, onAcao, onEventos }: {
  data?: QueueData; loading: boolean; error: boolean; podeGerenciar: boolean; busy: boolean; status: string; fluxo: string; busca: string;
  onStatus: (x: string) => void; onFluxo: (x: string) => void; onBusca: (x: string) => void; onAcao: (id: string, a: "pause" | "resume" | "cancel") => void; onEventos: (id: string) => void;
}) {
  const motivo = podeGerenciar ? undefined : SEM_PERMISSAO;
  return (
    <div className="of-cad-lista">
      <div className="of-cad-barra" style={{ padding: 10 }}>
        <label className="of-cad-busca"><Search size={14} color="var(--of-tinta-3)" aria-hidden /><input className="of-cad-campo" value={busca} onChange={(e) => onBusca(e.target.value)} placeholder="Buscar pessoa, empresa ou cadência" aria-label="Buscar pessoa, empresa ou cadência" /></label>
        <select className="of-cad-campo" value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Status"><option value="all">Todos os status</option><option value="em_curso">Em curso (ativas ou aguardando)</option>{Object.entries(STATUS_INSCRICAO).map(([k, [v]]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="of-cad-campo" value={fluxo} onChange={(e) => onFluxo(e.target.value)} aria-label="Cadência"><option value="all">Todas as cadências</option>{data?.definitions.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select>
      </div>
      {loading ? <p className="of-cad-vazio">Carregando inscrições…</p>
        : error ? <p className="of-cad-vazio" style={{ color: "var(--of-coral-acao-hover)" }}>Não foi possível carregar as inscrições.</p>
        : !data?.items.length ? <div className="of-cad-vazio"><h2>Nenhuma inscrição com estes filtros</h2><p>Inscreva um registro a partir de uma cadência publicada, ou aguarde o gatilho de evento.</p></div>
        : (
          <div className="of-cad-rolagem">
            <table className="of-cad-tabela" style={{ minWidth: 840 }}>
              <thead><tr><th>Registro</th><th>Cadência</th><th>Etapa atual</th><th>Próxima execução</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.items.map((it) => {
                  const [rotulo, tom] = STATUS_INSCRICAO[it.status] ?? [it.status, undefined];
                  return (
                    <tr key={it.id} data-clicavel="true" onClick={() => onEventos(it.id)}>
                      <td><span className="of-cad-nome">{it.entityName}</span><span className="of-cad-sub">{it.entityDetail ?? ENTIDADE[it.entityType] ?? it.entityType}</span></td>
                      <td style={{ color: "var(--of-tinta-2)" }}>{it.definitionName}</td>
                      <td style={{ color: "var(--of-tinta-2)" }}>{it.currentStep}</td>
                      <td style={{ color: "var(--of-tinta-2)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5 }}>{it.nextFireAt ? fmtData(it.nextFireAt, true) : "—"}</td>
                      <td><span className="of-cad-pilula" data-tom={tom}>{rotulo}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="of-cad-acoes">
                          {it.status === "active" || it.status === "waiting" || it.status === "waiting_reply"
                            ? <button type="button" className="of-cad-btn" data-tamanho="p" data-tom="fantasma" disabled={busy || !podeGerenciar} title={motivo ?? "Pausar"} aria-label="Pausar" onClick={() => onAcao(it.id, "pause")}><CirclePause /></button>
                            : it.status === "paused" ? <button type="button" className="of-cad-btn" data-tamanho="p" data-tom="fantasma" disabled={busy || !podeGerenciar} title={motivo ?? "Retomar"} aria-label="Retomar" onClick={() => onAcao(it.id, "resume")}><Play /></button> : null}
                          {!["completed", "cancelled"].includes(it.status)
                            ? <button type="button" className="of-cad-btn" data-tamanho="p" data-tom="fantasma" disabled={busy || !podeGerenciar} title={motivo ?? "Cancelar"} aria-label="Cancelar" onClick={() => onAcao(it.id, "cancel")}><XCircle /></button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function Veu({ children, onClose, lado }: { children: React.ReactNode; onClose: () => void; lado?: "direita" }) {
  // Esc fecha: listener só no efeito, nunca no corpo (SSR).
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return <div className="of-cad-veu" data-lado={lado} role="dialog" aria-modal="true" onClick={onClose}><div onClick={(e) => e.stopPropagation()} style={{ display: "contents" }}>{children}</div></div>;
}

function Inscrever({ cd, onClose, onDone }: { cd: Cadencia; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => { const t = setTimeout(() => setTermo(q), 250); return () => clearTimeout(t); }, [q]);
  const qc = useQueryClient();
  const cand = useQuery<{ suportado: boolean; candidatos: Candidato[] }>({
    queryKey: ["cf2-followup-candidatos", cd.id, termo],
    queryFn: () => request(`/api/automacoes/cadencias/${cd.id}/candidatos?q=${encodeURIComponent(termo)}`),
  });
  const inscrever = useMutation({
    mutationFn: (entityId: string) => request(`/api/automacoes/cadencias/${cd.id}/enrollments`, json("POST", { entityId })),
    onSuccess: (r: { jaExistia: boolean }) => {
      toast.success(r.jaExistia ? "Este registro já estava nesta cadência." : "Inscrito. O primeiro passo roda na próxima varredura do worker.");
      qc.invalidateQueries({ queryKey: ["cf2-followup-candidatos", cd.id] }); onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tipo = (ENTIDADE[cd.entityType] ?? cd.entityType).toLowerCase();
  return (
    <Veu onClose={onClose}>
      <div className="of-cad-modal">
        <div className="of-cad-modal-topo"><h2>Inscrever em “{cd.nome}”</h2><button type="button" className="of-cad-x" aria-label="Fechar" onClick={onClose}><X size={16} /></button></div>
        <div className="of-cad-modal-corpo">
          <label className="of-cad-busca"><Search size={14} color="var(--of-tinta-3)" aria-hidden /><input autoFocus className="of-cad-campo" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${tipo} por nome, empresa ou e-mail`} aria-label={`Buscar ${tipo}`} /></label>
          {cand.isLoading ? <p className="of-cad-sub">Buscando…</p> : null}
          {cand.isError ? <p className="of-cad-sub" style={{ color: "var(--of-coral-acao-hover)" }}>Não foi possível buscar.</p> : null}
          {cand.data && !cand.data.candidatos.length ? <p className="of-cad-sub">Nenhum {tipo} encontrado.</p> : null}
          {cand.data?.candidatos.map((c) => (
            <div key={c.id} className="of-cad-item">
              <div><span className="of-cad-nome">{c.nome}</span>{c.detalhe ? <span className="of-cad-sub">{c.detalhe}</span> : null}</div>
              {c.jaInscrito
                ? <span className="of-cad-pilula" data-tom="ok">Já inscrito</span>
                : <button type="button" className="of-cad-btn" data-tamanho="p" data-tom="primario" disabled={inscrever.isPending} onClick={() => inscrever.mutate(c.id)}><UserPlus />Inscrever</button>}
            </div>
          ))}
        </div>
      </div>
    </Veu>
  );
}

function Historico({ cd, podeGerenciar, onClose, onRollback }: { cd: Cadencia; podeGerenciar: boolean; onClose: () => void; onRollback: (versionId: string) => void }) {
  const q = useQuery<{ versions: Version[] }>({ queryKey: ["cf2-followup-versions", cd.id], queryFn: () => request(`/api/automacoes/cadencias/${cd.id}`) });
  const publicadas = (q.data?.versions ?? []).filter((v) => v.status !== "draft");
  return (
    <Veu onClose={onClose}>
      <div className="of-cad-modal">
        <div className="of-cad-modal-topo"><h2>Versões · {cd.nome}</h2><button type="button" className="of-cad-x" aria-label="Fechar" onClick={onClose}><X size={16} /></button></div>
        <div className="of-cad-modal-corpo">
          {q.isLoading ? <p className="of-cad-sub">Carregando…</p> : !publicadas.length ? <p className="of-cad-sub">Nenhuma versão publicada.</p> : null}
          {publicadas.map((v) => (
            <div key={v.id} className="of-cad-item">
              <div><span className="of-cad-nome">v{v.versionNumber}</span><span className="of-cad-sub">{v.status === "published" ? "publicada" : "substituída"}{v.publishedAt ? ` · ${fmtData(v.publishedAt)}` : ""}</span></div>
              {v.id === cd.publishedVersionId
                ? <span className="of-cad-pilula" data-tom="ok">Atual</span>
                : <button type="button" className="of-cad-btn" data-tamanho="p" disabled={!podeGerenciar} title={podeGerenciar ? undefined : SEM_PERMISSAO} onClick={() => onRollback(v.id)}>Reverter</button>}
            </div>
          ))}
        </div>
      </div>
    </Veu>
  );
}

function Eventos({ enrollmentId, onClose }: { enrollmentId: string; onClose: () => void }) {
  const q = useQuery<{ events: Array<{ id: string; stepId: string; status: string; resultado: unknown; attempt: number; createdAt: string }> }>({
    queryKey: ["cf2-followup-events", enrollmentId], queryFn: () => request(`/api/automacoes/cadencias/enrollments/${enrollmentId}/events`),
  });
  return (
    <Veu onClose={onClose} lado="direita">
      <aside className="of-cad-gaveta">
        <div className="of-cad-modal-topo"><h2>Histórico da inscrição</h2><button type="button" className="of-cad-x" aria-label="Fechar" onClick={onClose}><X size={16} /></button></div>
        <div className="of-cad-modal-corpo">
          {q.isLoading ? <p className="of-cad-sub">Carregando…</p> : null}
          {!q.isLoading && !q.data?.events.length ? <p className="of-cad-sub">Sem eventos ainda. O primeiro aparece quando o worker executar o passo inicial.</p> : null}
          {q.data?.events.map((ev) => (
            <div key={ev.id} className="of-cad-item" style={{ alignItems: "flex-start" }}>
              <div>
                <span className="of-cad-nome">{STATUS_EXECUCAO[ev.status]?.l ?? ev.status}</span>
                <span className="of-cad-sub">{fmtData(ev.createdAt, true)} · nó {ev.stepId}{ev.attempt ? ` · tentativa ${ev.attempt}` : ""}</span>
                {ev.resultado ? <pre className="of-cad-pre">{JSON.stringify(ev.resultado, null, 2)}</pre> : null}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </Veu>
  );
}

function Editor({ cd, onClose, onSaved }: { cd: Cadencia | null; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(cd?.nome ?? "Nova cadência");
  const [entityType, setEntityType] = useState(cd?.entityType ?? "lead");
  const [graph, setGraph] = useState<FollowupGraph>(() => graphFromCadencia(cd));
  const [salvando, setSalvando] = useState(false);
  const [idSalvo, setIdSalvo] = useState<string | null>(null);
  const estrutura = useMemo(() => followupGraphSchema.safeParse(graph), [graph]);
  const validacao: FollowupValidationResult | null = useMemo(() => (estrutura.success ? validateFollowupForPublish(graph) : null), [estrutura, graph]);
  const podePublicar = estrutura.success && Boolean(validacao?.ok);
  const pendencias = validacao && !validacao.ok ? validacao.errors.length : estrutura.success ? 0 : 1;

  const salvar = async (action: "save_draft" | "publish") => {
    if (!nome.trim()) { toast.error("Dê um nome à cadência."); return; }
    if (!estrutura.success) { toast.error(`Fluxo inválido: ${estrutura.error.issues[0]?.message ?? "verifique os nós."}`); return; }
    if (action === "publish" && validacao && !validacao.ok) { toast.error(validacao.errors[0]?.message ?? "Fluxo não pode ser publicado."); return; }
    setSalvando(true);
    try {
      // Publicar sempre passa pelo rascunho: a rota publica a versão-rascunho
      // apontada, então o grafo editado precisa ser gravado antes.
      // idSalvo guarda o id criado pelo POST: se o publish falhar depois, a
      // nova tentativa cai no PATCH em vez de criar uma cadência duplicada.
      const id = cd?.id ?? idSalvo;
      if (id) {
        await request(`/api/automacoes/cadencias/${id}`, json("PATCH", { action: "save_draft", nome: nome.trim(), entityType, graph }));
        if (action === "publish") await request(`/api/automacoes/cadencias/${id}`, json("PATCH", { action: "publish" }));
      } else {
        const criado = await request("/api/automacoes/cadencias", json("POST", { nome: nome.trim(), entityType, graph }));
        setIdSalvo(criado.cadencia.id);
        if (action === "publish") await request(`/api/automacoes/cadencias/${criado.cadencia.id}`, json("PATCH", { action: "publish" }));
      }
      toast.success(action === "publish" ? "Cadência publicada." : "Rascunho salvo.");
      onSaved(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); onSaved(); }
    finally { setSalvando(false); }
  };

  return (
    <div data-cf2-theme="builder" className="fixed inset-0 z-[1000] flex flex-col" style={{ background: "var(--of-papel-tela)" }}>
      <header className="flex h-[68px] shrink-0 items-center gap-3 px-6" style={{ background: "var(--of-papel)", boxShadow: "inset 0 -1px 0 var(--of-linha)" }}>
        <div className="min-w-0">
          <p style={{ fontSize: 11, color: "var(--of-tinta-3)" }}>Automações / Cadências</p>
          <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome da cadência" maxLength={120} className="bg-transparent outline-none" style={{ width: "min(360px, 40vw)", fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 16, fontWeight: 700, color: "var(--of-tinta-forte)" }} />
        </div>
        <select className="of-cad-campo" value={entityType} onChange={(e) => setEntityType(e.target.value)} aria-label="Tipo de registro">
          {Object.entries(ENTIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="of-cad-pilula" data-tom={cd?.ativo ? "ok" : undefined}>{cd?.ativo ? "Publicada" : "Rascunho"}</span>
        <button type="button" className="of-cad-btn ml-auto" data-tom="fantasma" onClick={onClose}>Fechar</button>
      </header>
      <main className="min-h-0 flex-1 p-5"><FollowupFlowCanvas key={cd?.id ?? "nova"} graph={graph} onGraphChange={setGraph} validation={validacao} /></main>
      <footer className="flex h-[64px] shrink-0 items-center gap-2 px-6" style={{ background: "var(--of-papel)", boxShadow: "inset 0 1px 0 var(--of-linha)" }}>
        <span style={{ fontSize: 11.5, color: "var(--of-tinta-3)" }}>{graph.nodes.length} nós · {pendencias > 0 ? `${pendencias} pendência(s) para publicar` : "pronto para publicar"}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" className="of-cad-btn" disabled={salvando} onClick={() => salvar("save_draft")}><Save />Salvar rascunho</button>
          <button type="button" className="of-cad-btn" data-tom="primario" disabled={salvando || !podePublicar} title={podePublicar ? undefined : "Resolva as pendências do fluxo para publicar."} onClick={() => salvar("publish")}><Send />Publicar</button>
        </div>
      </footer>
    </div>
  );
}
