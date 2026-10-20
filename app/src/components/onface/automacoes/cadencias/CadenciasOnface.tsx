"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Cadências — tela ONFACE.
 *
 * Sequência de follow-up no tempo: a lista das cadências, a fila de
 * inscrições e o editor de passos (`EditorCadencia`). Tudo pelas MESMAS
 * rotas Hono de sempre (`api-server/routes/automacoes-cadencias.ts`):
 * listar, criar, salvar rascunho, publicar, pausar, reverter versão;
 * inscrever um registro; pausar/retomar/cancelar inscrição; histórico.
 *
 * O que mudou nesta volta: saiu o CSS próprio `of-cad-*` e saiu o véu escuro
 * com o canvas do CRM2 (`data-cf2-theme="builder"`). A tela agora usa o
 * mesmo vocabulário das outras abas de Automações — `automacoes.css` e
 * `fluxos/fluxos.css`, os mesmos arquivos que Fluxos, Agentes e Execuções —
 * e o editor é uma lista de passos, não um grafo.
 * ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, CirclePause, Clock, History, Info, Pencil, Play, Plus, Search, Send, UserPlus, X, XCircle,
} from "lucide-react";
import { AVISO_GATILHO_INVALIDO, EVENT_CATALOG, type FollowupGraph } from "@/components/crm2/automacoes/followup-types";
import { createEmptyFollowupGraph } from "@/lib/ai-platform/followup/graph";
import { legacyStepsToFollowupGraph } from "@/lib/ai-platform/followup/legacy";
import type { CadenceStep } from "@/lib/cadencia/cadence-engine";
import { PaginaCabecalho, PaginaResumo } from "@/components/onface/shell/Pagina";
import { BotaoMotivo, Tablist } from "@/components/onface/ds/escolha";
import { AbasAutomacoes } from "../Abas";
import { ENTIDADE, STATUS_EXECUCAO } from "../formato";
import { EditorCadencia, type CadenciaEditavel } from "./EditorCadencia";
import { NovaCadencia } from "./NovaCadencia";
import { passosParaGrafo } from "./passos";
import "../automacoes.css";
import "../fluxos/fluxos.css";
import "./cadencias.css";

type Cadencia = {
  id: string; nome: string; entityType: string; visibility: "personal" | "shared"; ownerId: string | null; ownerName?: string | null; ativo: boolean; status: string; versao: number; publishedAt: string | null;
  triggerConfig: { event?: string } | null;
  draftSteps: CadenceStep[] | null; steps: CadenceStep[]; draftGraph: FollowupGraph | null; publishedGraph: FollowupGraph | null;
  draftVersionId: string | null; publishedVersionId: string | null; totalPassos: number; enrollmentsPorStatus: Record<string, number>;
};
type FlowData = { cadencias: Cadencia[]; mecanismosParalelos: { cadenciaSdrInboundExecucoes: number } };
type QueueItem = { id: string; status: string; entityType: string; entityName: string; entityDetail: string | null; definitionName: string; currentStep: string; nextFireAt: string | null };
type QueueData = { items: QueueItem[]; total: number; definitions: Array<{ id: string; nome: string }> };
type Version = { id: string; versionNumber: number; status: string; publishedAt: string | null };
type Candidato = { id: string; nome: string; detalhe: string | null; jaInscrito: boolean };

const STATUS_INSCRICAO: Record<string, [string, "ok" | "aviso" | "erro" | ""]> = {
  active: ["Ativo", "ok"], waiting: ["Aguardando", ""], waiting_reply: ["Aguardando resposta", ""], paused: ["Pausado", "aviso"],
  completed: ["Concluído", ""], cancelled: ["Cancelado", ""], failed: ["Falhou", "erro"],
};
// Espelha ENTIDADES_INSCREVIVEIS da rota Hono: só estes tipos têm tabela
// resolvível no tenant para a inscrição manual.
const INSCREVIVEL = new Set(["lead", "contato", "negocio"]);
const EVENTO = new Map(EVENT_CATALOG.map((e) => [e.id, e.nome]));
const SEM_PERMISSAO = "Sua função não tem a permissão automation.manage";
const fmtData = (iso: string, hora = false) => new Intl.DateTimeFormat("pt-BR", hora ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(new Date(iso));

async function request(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) { const b = await r.json().catch(() => null); throw new Error(b?.error ?? "Não foi possível concluir a ação."); }
  return r.json();
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** O rascunho é a fonte; cadência antiga sem grafo é lida dos steps. */
function grafoDaCadencia(cd: Cadencia): FollowupGraph {
  if (cd.draftGraph) return cd.draftGraph;
  const legado = cd.draftSteps?.length ? cd.draftSteps : cd.steps;
  return legado?.length ? legacyStepsToFollowupGraph(legado) : createEmptyFollowupGraph();
}

function estadoCadencia(cd: Cadencia): [string, "ok" | "aviso" | ""] {
  if (cd.ativo) return ["Publicada", "ok"];
  if (cd.publishedAt) return ["Pausada", "aviso"];
  return ["Rascunho", ""];
}

export function CadenciasOnface({ podeGerenciar }: { podeGerenciar: boolean }) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<"cadencias" | "inscricoes">("cadencias");
  const [editor, setEditor] = useState<CadenciaEditavel | null>(null);
  const [nova, setNova] = useState(false);
  const [historico, setHistorico] = useState<Cadencia | null>(null);
  const [inscrever, setInscrever] = useState<Cadencia | null>(null);
  const [eventosDe, setEventosDe] = useState<string | null>(null);
  // Abre em "em_curso" para a lista bater com o contador da aba.
  const [status, setStatus] = useState("em_curso"); const [fluxo, setFluxo] = useState("all"); const [busca, setBusca] = useState("");

  const flows = useQuery<FlowData>({ queryKey: ["cf2-followups"], queryFn: () => request("/api/automacoes/cadencias") });
  const queue = useQuery<QueueData>({
    queryKey: ["cf2-followups-queue", status, fluxo, busca],
    queryFn: () => request(`/api/automacoes/cadencias/fila?status=${status}&definitionId=${fluxo}&q=${encodeURIComponent(busca)}`),
    enabled: aba === "inscricoes",
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["cf2-followups"] }); void qc.invalidateQueries({ queryKey: ["cf2-followups-queue"] }); };

  const acaoInscricao = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "pause" | "resume" | "cancel" }) => request(`/api/automacoes/cadencias/enrollments/${id}/action`, json("POST", { action })),
    onSuccess: (_, v) => { toast.success(v.action === "pause" ? "Inscrição pausada." : v.action === "resume" ? "Inscrição retomada." : "Inscrição cancelada."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const patch = async (cd: Cadencia, body: Record<string, unknown>, ok: string) => {
    try { await request(`/api/automacoes/cadencias/${cd.id}`, json("PATCH", body)); toast.success(ok); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação."); }
  };

  /** Salvar rascunho e publicar pela mesma porta de sempre: publicar passa
   *  pelo rascunho, porque a rota publica a versão-rascunho apontada. */
  const salvar = async (corpo: { nome: string; entityType: string; visibility: "personal" | "shared"; grafo: unknown }, publicar: boolean) => {
    const atual = editor;
    if (!atual) return;
    try {
      let id = atual.id;
      if (id) {
        await request(`/api/automacoes/cadencias/${id}`, json("PATCH", { action: "save_draft", nome: corpo.nome, entityType: corpo.entityType, visibility: corpo.visibility, graph: corpo.grafo }));
      } else {
        const criado = await request("/api/automacoes/cadencias", json("POST", { nome: corpo.nome, entityType: corpo.entityType, visibility: corpo.visibility, graph: corpo.grafo }));
        id = criado.cadencia.id as string;
        // Guarda o id criado: se o publish falhar, a nova tentativa salva na
        // mesma cadência em vez de criar uma duplicada.
        //
        // E guarda TAMBÉM o que acabou de ser salvo: o editor é remontado
        // pela troca da `key` (de "nova" para o id), e remontar com o grafo
        // de abertura jogava fora os passos que a pessoa tinha acabado de
        // salvar — a tela voltava ao fluxo vazio depois de um salvamento
        // bem-sucedido.
        setEditor({ ...atual, id, nome: corpo.nome, entityType: corpo.entityType, visibility: corpo.visibility, grafo: corpo.grafo as CadenciaEditavel["grafo"] });
      }
      if (publicar) await request(`/api/automacoes/cadencias/${id}`, json("PATCH", { action: "publish" }));
      toast.success(publicar ? "Cadência publicada." : "Rascunho salvo.");
      refresh();
      if (publicar) setEditor(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      refresh();
    }
  };

  const cadencias = useMemo(() => flows.data?.cadencias ?? [], [flows.data]);
  // Totais saem das contagens que a rota já agrega no banco — nada recontado
  // nem estimado no cliente.
  const totais = useMemo(() => cadencias.reduce((acc, cd) => {
    const s = cd.enrollmentsPorStatus;
    acc.publicadas += cd.ativo ? 1 : 0;
    acc.rascunhos += cd.ativo ? 0 : 1;
    acc.emCurso += (s.active ?? 0) + (s.waiting ?? 0) + (s.waiting_reply ?? 0);
    acc.falhas += s.failed ?? 0;
    return acc;
  }, { publicadas: 0, rascunhos: 0, emCurso: 0, falhas: 0 }), [cadencias]);
  const legado = flows.data?.mecanismosParalelos.cadenciaSdrInboundExecucoes ?? 0;

  const verInscricoes = (st: string) => { setAba("inscricoes"); setStatus(st); setFluxo("all"); };

  if (editor) {
    return (
      <EditorCadencia
        key={editor.id ?? "nova"}
        cadencia={editor}
        podeGerenciar={podeGerenciar}
        aoFechar={() => { setEditor(null); refresh(); }}
        aoSalvar={salvar}
      />
    );
  }

  return (
    <>
      {/* Única tela do grupo sem as abas: daqui só se voltava pela sidebar. */}
      <div className="oa-barra"><AbasAutomacoes atual="/automacoes/cadencias" /></div>
      <PaginaCabecalho
        titulo="Cadências"
        descricao="Sequências de follow-up no tempo. Cada inscrição é rastreável até concluir, pausar ou cancelar."
        acoes={
          <BotaoMotivo type="button" className="oa-btn oa-btn-primario" motivo={podeGerenciar ? null : SEM_PERMISSAO} onClick={() => setNova(true)}>
            <Plus size={14} /> Nova cadência
          </BotaoMotivo>
        }
      />
      <PaginaResumo itens={[
        { rotulo: "Cadências", valor: flows.isLoading ? "—" : cadencias.length, destaque: true, detalhe: flows.isLoading ? undefined : `${totais.publicadas} publicada(s)` },
        { rotulo: "Não publicadas", valor: flows.isLoading ? "—" : totais.rascunhos, detalhe: "rascunho ou pausada" },
        { rotulo: "Em curso", valor: flows.isLoading ? "—" : totais.emCurso, detalhe: "ativas ou aguardando", aoSelecionar: () => verInscricoes("em_curso"), ativo: aba === "inscricoes" && status === "em_curso" },
        { rotulo: "Falhas", valor: flows.isLoading ? "—" : totais.falhas, sinal: true, aoSelecionar: () => verInscricoes("failed"), ativo: aba === "inscricoes" && status === "failed" },
      ]} />

      {/* Honestidade sobre execução: o motor roda no worker (job
          cadence-sweep), mas só o que estiver publicado e inscrito anda. */}
      <div className="ofx-aviso" role="note">
        <Info size={14} aria-hidden />
        <span>
          <strong>Como executa.</strong> Só cadência <strong>publicada</strong> recebe inscrição. Gatilho “Inscrição manual/API” só anda quando alguém inscreve; gatilho de evento inscreve quando o evento acontece no CRM. Os passos rodam na varredura periódica do worker, então a próxima execução pode levar alguns minutos.
        </span>
      </div>
      {legado > 0 ? (
        <div className="ofx-aviso" role="note">
          <AlertTriangle size={14} aria-hidden />
          <span><strong>Legado separado.</strong> Existem {legado.toLocaleString("pt-BR")} execuções da cadência de SDR inbound fora deste motor. Elas não aparecem aqui porque ainda não foram migradas.</span>
        </div>
      ) : null}

      <div className="oa-barra">
        {/* Aba de verdade (troca a lista inteira): cada botão aponta o painel
            por `aria-controls`, o painel diz de qual aba é, e a seta anda
            entre as duas. */}
        <Tablist className="oa-abas" rotulo="Visão">
          <button type="button" role="tab" className="oa-aba" id="ofc-aba-cadencias" aria-current={aba === "cadencias" ? "page" : undefined} aria-selected={aba === "cadencias"} aria-controls={aba === "cadencias" ? "ofc-painel-aba" : undefined} onClick={() => setAba("cadencias")}>
            Cadências <span className="oa-selo">{cadencias.length}</span>
          </button>
          <button type="button" role="tab" className="oa-aba" id="ofc-aba-inscricoes" aria-current={aba === "inscricoes" ? "page" : undefined} aria-selected={aba === "inscricoes"} aria-controls={aba === "inscricoes" ? "ofc-painel-aba" : undefined} onClick={() => setAba("inscricoes")}>
            Inscrições <span className="oa-selo">{flows.isLoading ? "—" : totais.emCurso}</span>
          </button>
        </Tablist>
      </div>

      <div className="oa-painel-aba" role="tabpanel" id="ofc-painel-aba" aria-labelledby={`ofc-aba-${aba}`}>
      {aba === "cadencias" ? (
        <ListaCadencias
          cadencias={cadencias} loading={flows.isLoading} error={flows.isError} podeGerenciar={podeGerenciar}
          onNova={() => setNova(true)}
          onEditar={(cd) => setEditor({ id: cd.id, nome: cd.nome, entityType: cd.entityType, visibility: cd.visibility, ownerId: cd.ownerId, ativo: cd.ativo, publishedAt: cd.publishedAt, grafo: grafoDaCadencia(cd) })}
          onHistorico={setHistorico} onInscrever={setInscrever}
          onPausar={(cd) => void patch(cd, { action: "pause" }, "Cadência pausada.")}
        />
      ) : (
        <ListaInscricoes
          data={queue.data} loading={queue.isLoading} error={queue.isError} podeGerenciar={podeGerenciar} busy={acaoInscricao.isPending}
          status={status} fluxo={fluxo} busca={busca} onStatus={setStatus} onFluxo={setFluxo} onBusca={setBusca}
          onAcao={(id, action) => acaoInscricao.mutate({ id, action })} onEventos={setEventosDe}
        />
      )}
      </div>

      {nova ? (
        <NovaCadencia
          aoFechar={() => setNova(false)}
          aoCriar={({ nome, entityType, visibility, passos }) => {
            setNova(false);
            /* `visibility` vem da escolha de quem cria. Era fixo em "shared"
               aqui, então o campo existia no banco e na listagem e NUNCA podia
               valer "personal": não havia como fazer uma cadência só sua. */
            setEditor({ id: null, nome, entityType, visibility, ownerId: null, ativo: false, publishedAt: null, grafo: passosParaGrafo(passos) });
          }}
        />
      ) : null}
      {historico ? <Historico cd={historico} podeGerenciar={podeGerenciar} onClose={() => setHistorico(null)} onRollback={(v) => { void patch(historico, { action: "rollback", versionId: v }, "Revertido para a versão selecionada."); setHistorico(null); }} /> : null}
      {inscrever ? <Inscrever cd={inscrever} onClose={() => setInscrever(null)} onDone={refresh} /> : null}
      {eventosDe ? <Eventos enrollmentId={eventosDe} onClose={() => setEventosDe(null)} /> : null}
    </>
  );
}

function ListaCadencias({ cadencias, loading, error, podeGerenciar, onNova, onEditar, onHistorico, onInscrever, onPausar }: {
  cadencias: Cadencia[]; loading: boolean; error: boolean; podeGerenciar: boolean;
  onNova: () => void; onEditar: (cd: Cadencia) => void; onHistorico: (cd: Cadencia) => void; onInscrever: (cd: Cadencia) => void; onPausar: (cd: Cadencia) => void;
}) {
  if (loading) return <p className="ofx-lista-aviso">Carregando cadências…</p>;
  if (error) return <div className="ofx-lista-erro"><AlertTriangle size={16} aria-hidden /><span>Não foi possível carregar as cadências.</span></div>;
  if (!cadencias.length) return (
    <div className="ofx-vazio">
      <span className="ofx-vazio-icone"><Clock size={20} /></span>
      <h2>Nenhuma cadência configurada</h2>
      <p>Uma cadência é uma sequência no tempo: espera tanto, fala isso, por este canal. Monte os passos, publique e inscreva leads, contatos ou negócios.</p>
      <BotaoMotivo type="button" className="oa-btn oa-btn-primario" motivo={podeGerenciar ? null : SEM_PERMISSAO} onClick={onNova}>
        <Plus size={14} /> Criar a primeira
      </BotaoMotivo>
    </div>
  );
  return (
    <ul className="ofx-tabela ofc-tabela">
      <li className="ofc-cab" aria-hidden="true">
        <span>Cadência</span><span>Entra quando</span><span>Estado</span><span>Passos</span><span>Em curso</span><span>Falhas</span><span>Ações</span>
      </li>
      {cadencias.map((cd) => {
        const s = cd.enrollmentsPorStatus;
        const emCurso = (s.active ?? 0) + (s.waiting ?? 0) + (s.waiting_reply ?? 0);
        const [rotulo, tom] = estadoCadencia(cd);
        const evento = cd.triggerConfig?.event ?? "manual";
        // Motivo visível em vez de botão que falha: inscrição só faz sentido em
        // cadência publicada e de um tipo que a rota sabe resolver.
        const motivoInscrever = !podeGerenciar ? SEM_PERMISSAO : !cd.ativo ? "Publique a cadência antes de inscrever." : !INSCREVIVEL.has(cd.entityType) ? "Inscrição manual só para lead, contato ou negócio." : null;
        return (
          <li key={cd.id} className="ofx-linha">
            <BotaoMotivo type="button" className="ofx-linha-nome" onClick={() => onEditar(cd)} title={podeGerenciar ? "Abrir os passos" : undefined} motivo={podeGerenciar ? null : SEM_PERMISSAO}>
              <strong>{cd.nome}</strong>
              <span>{ENTIDADE[cd.entityType] ?? cd.entityType} · {cd.visibility === "personal" ? "Pessoal" : "Equipe"}{cd.ownerName ? ` · ${cd.ownerName}` : ""} · versão {cd.versao}{cd.publishedAt ? ` · publicada ${fmtData(cd.publishedAt)}` : ""}</span>
            </BotaoMotivo>
            {/* Gatilho morto é dito na lista, não só no editor: quem olha a
                lista precisa saber que aquela cadência nunca entrou. */}
            <span className="ofx-linha-exec">{EVENTO.get(evento) ?? <span className="oa-dica oa-alerta" title={AVISO_GATILHO_INVALIDO}>{evento} · gatilho inválido</span>}</span>
            <span className="ofx-linha-estado"><span className={`oa-selo ${tom ? `oa-${tom}` : ""}`}>{rotulo}</span></span>
            <span className="ofx-linha-num">{cd.totalPassos === 1 ? "1 passo" : `${cd.totalPassos} passos`}</span>
            <span className="ofx-linha-num" title="Inscrições ativas ou aguardando">{emCurso} em curso</span>
            <span className="ofx-linha-num" data-sinal={(s.failed ?? 0) > 0 ? "true" : undefined}>{s.failed ?? 0} falha(s)</span>
            <span className="ofx-linha-esq ofc-acoes">
              <BotaoMotivo type="button" className="oa-btn oa-btn-secundario" title={motivoInscrever ? undefined : "Inscrever um registro"} motivo={motivoInscrever} onClick={() => onInscrever(cd)}>
                <UserPlus size={13} /> Inscrever
              </BotaoMotivo>
              <BotaoMotivo type="button" className="oa-icone" aria-label="Editar os passos" title={podeGerenciar ? "Editar os passos" : undefined} motivo={podeGerenciar ? null : SEM_PERMISSAO} onClick={() => onEditar(cd)}><Pencil size={14} /></BotaoMotivo>
              {cd.publishedVersionId ? <button type="button" className="oa-icone" aria-label="Versões publicadas" title="Versões publicadas" onClick={() => onHistorico(cd)}><History size={14} /></button> : null}
              {cd.ativo
                ? <BotaoMotivo type="button" className="oa-icone" aria-label="Pausar" title={podeGerenciar ? "Pausar: novas inscrições param; as em curso seguem" : undefined} motivo={podeGerenciar ? null : SEM_PERMISSAO} onClick={() => onPausar(cd)}><CirclePause size={14} /></BotaoMotivo>
                : <BotaoMotivo type="button" className="oa-icone" aria-label="Abrir para publicar" title={podeGerenciar ? "Abrir para revisar e publicar" : undefined} motivo={podeGerenciar ? null : SEM_PERMISSAO} onClick={() => onEditar(cd)}><Send size={14} /></BotaoMotivo>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ListaInscricoes({ data, loading, error, podeGerenciar, busy, status, fluxo, busca, onStatus, onFluxo, onBusca, onAcao, onEventos }: {
  data?: QueueData; loading: boolean; error: boolean; podeGerenciar: boolean; busy: boolean; status: string; fluxo: string; busca: string;
  onStatus: (x: string) => void; onFluxo: (x: string) => void; onBusca: (x: string) => void; onAcao: (id: string, a: "pause" | "resume" | "cancel") => void; onEventos: (id: string) => void;
}) {
  const motivo = podeGerenciar ? undefined : SEM_PERMISSAO;
  const filtrado = status !== "all" || fluxo !== "all" || busca.trim() !== "";
  return (
    <>
      <div className="ofx-lista-barra">
        <label className="oa-campo ofx-lista-busca">
          <span className="ofc-busca">
            <Search size={14} aria-hidden />
            <input className="oa-input" value={busca} onChange={(e) => onBusca(e.target.value)} placeholder="Buscar pessoa, empresa ou cadência" aria-label="Buscar pessoa, empresa ou cadência" />
          </span>
        </label>
        <select className="oa-input ofc-filtro" value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Status">
          <option value="all">Todos os status</option>
          <option value="em_curso">Em curso (ativas ou aguardando)</option>
          {Object.entries(STATUS_INSCRICAO).map(([k, [v]]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="oa-input ofc-filtro" value={fluxo} onChange={(e) => onFluxo(e.target.value)} aria-label="Cadência">
          <option value="all">Todas as cadências</option>
          {data?.definitions.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        {data ? <span className="ofx-lista-total oa-dica">{data.total.toLocaleString("pt-BR")} no total</span> : null}
      </div>
      {loading ? <p className="ofx-lista-aviso">Carregando inscrições…</p>
        : error ? <div className="ofx-lista-erro"><AlertTriangle size={16} aria-hidden /><span>Não foi possível carregar as inscrições.</span></div>
        : !data?.items.length ? (
          <div className="ofx-vazio">
            <span className="ofx-vazio-icone"><UserPlus size={20} /></span>
            <h2>{filtrado ? "Nenhuma inscrição com estes filtros" : "Nenhuma inscrição ainda"}</h2>
            <p>Inscreva um registro a partir de uma cadência publicada, ou aguarde o gatilho de evento.</p>
            {/* O vazio com filtro ligado precisa de saída: antes dizia "com
                estes filtros" e deixava a pessoa procurar qual era. */}
            {filtrado ? (
              <button type="button" className="oa-btn oa-btn-secundario" onClick={() => { onStatus("all"); onFluxo("all"); onBusca(""); }}>
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="ofx-tabela ofc-tabela-fila">
            <li className="ofc-cab" aria-hidden="true">
              <span>Registro</span><span>Cadência</span><span>Passo atual</span><span>Próxima execução</span><span>Status</span><span>Ações</span>
            </li>
            {data.items.map((it) => {
              const [rotulo, tom] = STATUS_INSCRICAO[it.status] ?? [it.status, ""];
              return (
                <li key={it.id} className="ofx-linha">
                  <button type="button" className="ofx-linha-nome" onClick={() => onEventos(it.id)} title="Ver o histórico desta inscrição">
                    <strong>{it.entityName}</strong>
                    <span>{it.entityDetail ?? ENTIDADE[it.entityType] ?? it.entityType}</span>
                  </button>
                  <span className="ofx-linha-exec">{it.definitionName}</span>
                  <span className="ofx-linha-exec">{it.currentStep}</span>
                  <span className="ofx-linha-num ofx-mono">{it.nextFireAt ? fmtData(it.nextFireAt, true) : "—"}</span>
                  <span className="ofx-linha-estado"><span className={`oa-selo ${tom ? `oa-${tom}` : ""}`}>{rotulo}</span></span>
                  <span className="ofx-linha-esq ofc-acoes">
                    {it.status === "active" || it.status === "waiting" || it.status === "waiting_reply"
                      ? <BotaoMotivo type="button" className="oa-icone" disabled={busy} title={motivo ? undefined : "Pausar"} motivo={motivo} aria-label="Pausar" onClick={() => onAcao(it.id, "pause")}><CirclePause size={14} /></BotaoMotivo>
                      : it.status === "paused" ? <BotaoMotivo type="button" className="oa-icone" disabled={busy} title={motivo ? undefined : "Retomar"} motivo={motivo} aria-label="Retomar" onClick={() => onAcao(it.id, "resume")}><Play size={14} /></BotaoMotivo> : null}
                    {/* Cancelar tira o registro da cadência no servidor e não
                        volta: retomar só existe para quem está pausado. */}
                    {!["completed", "cancelled"].includes(it.status)
                      ? <BotaoMotivo type="button" className="oa-icone ofx-menu-perigo" disabled={busy} title={motivo ? undefined : "Cancelar a inscrição"} motivo={motivo} aria-label="Cancelar a inscrição"
                          onClick={() => { if (window.confirm(`Cancelar a inscrição de ${it.entityName} em “${it.definitionName}”? Os passos que faltam não serão enviados, e não há como retomar.`)) onAcao(it.id, "cancel"); }}><XCircle size={14} /></BotaoMotivo> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
    </>
  );
}

function Modal({ titulo, children, onClose }: { titulo: string; children: React.ReactNode; onClose: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  // Esc fecha: listener só no efeito, nunca no corpo (SSR).
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  // Sem isto o foco ficava no botão ATRÁS do véu: quem usa teclado abria
  // Versões e seguia tabulando a lista escondida embaixo.
  useEffect(() => {
    if (caixa.current?.contains(document.activeElement)) return;
    caixa.current?.focus();
  }, []);
  return (
    <div className="oa-veu" onMouseDown={onClose}>
      <div ref={caixa} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} className="oa-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="oa-modal-topo">
          <h2 className="oa-modal-titulo">{titulo}</h2>
          <button type="button" className="oa-icone" aria-label="Fechar" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
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
      void qc.invalidateQueries({ queryKey: ["cf2-followup-candidatos", cd.id] }); onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tipo = (ENTIDADE[cd.entityType] ?? cd.entityType).toLowerCase();
  return (
    <Modal titulo={`Inscrever em “${cd.nome}”`} onClose={onClose}>
      <label className="oa-campo">
        <span className="ofc-busca">
          <Search size={14} aria-hidden />
          <input autoFocus className="oa-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${tipo} por nome, empresa ou e-mail`} aria-label={`Buscar ${tipo}`} />
        </span>
      </label>
      <ul className="oa-lista">
        {cand.isLoading ? <li className="oa-dica">Buscando…</li> : null}
        {cand.isError ? <li className="ofx-campo-erro">Não foi possível buscar.</li> : null}
        {cand.data && !cand.data.candidatos.length ? <li className="oa-dica">Nenhum {tipo} encontrado.</li> : null}
        {cand.data?.candidatos.map((c) => (
          <li key={c.id} className="oa-item">
            <span className="oa-item-corpo">
              <span className="oa-item-titulo">{c.nome}</span>
              {c.detalhe ? <span className="oa-item-meta">{c.detalhe}</span> : null}
            </span>
            {c.jaInscrito
              ? <span className="oa-selo oa-ok">Já inscrito</span>
              : <button type="button" className="oa-btn oa-btn-secundario" disabled={inscrever.isPending} onClick={() => inscrever.mutate(c.id)}><UserPlus size={13} /> Inscrever</button>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function Historico({ cd, podeGerenciar, onClose, onRollback }: { cd: Cadencia; podeGerenciar: boolean; onClose: () => void; onRollback: (versionId: string) => void }) {
  const q = useQuery<{ versions: Version[] }>({ queryKey: ["cf2-followup-versions", cd.id], queryFn: () => request(`/api/automacoes/cadencias/${cd.id}`) });
  const publicadas = (q.data?.versions ?? []).filter((v) => v.status !== "draft");
  return (
    <Modal titulo={`Versões · ${cd.nome}`} onClose={onClose}>
      <ul className="oa-lista">
        {q.isLoading ? <li className="oa-dica">Carregando…</li> : !publicadas.length ? <li className="oa-dica">Nenhuma versão publicada.</li> : null}
        {publicadas.map((v) => (
          <li key={v.id} className="oa-item">
            <span className="ofx-versao-num">v{v.versionNumber}</span>
            <span className="oa-item-corpo">
              <span className="oa-item-meta">{v.status === "published" ? "publicada" : "substituída"}{v.publishedAt ? ` · ${fmtData(v.publishedAt)}` : ""}</span>
            </span>
            {v.id === cd.publishedVersionId
              ? <span className="oa-selo oa-ok">Atual</span>
              : <BotaoMotivo type="button" className="oa-btn oa-btn-secundario" motivo={podeGerenciar ? null : SEM_PERMISSAO} onClick={() => onRollback(v.id)}>Reverter</BotaoMotivo>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function Eventos({ enrollmentId, onClose }: { enrollmentId: string; onClose: () => void }) {
  const q = useQuery<{ events: Array<{ id: string; stepId: string; status: string; resultado: unknown; attempt: number; createdAt: string }> }>({
    queryKey: ["cf2-followup-events", enrollmentId], queryFn: () => request(`/api/automacoes/cadencias/enrollments/${enrollmentId}/events`),
  });
  return (
    <Modal titulo="Histórico da inscrição" onClose={onClose}>
      <ul className="oa-lista">
        {q.isLoading ? <li className="oa-dica">Carregando…</li> : null}
        {!q.isLoading && !q.data?.events.length ? <li className="oa-dica">Sem eventos ainda. O primeiro aparece quando o worker executar o passo inicial.</li> : null}
        {q.data?.events.map((ev) => {
          const meta = STATUS_EXECUCAO[ev.status];
          return (
            <li key={ev.id} className="oa-item ofc-evento">
              <span className="oa-item-corpo">
                <span className="oa-item-titulo">
                  {meta?.l ?? ev.status} <span className={`oa-selo ${meta?.tom === "ok" ? "oa-ok" : meta?.tom === "erro" ? "oa-erro" : meta?.tom === "aviso" ? "oa-aviso" : ""}`}>{ev.stepId}</span>
                </span>
                <span className="oa-item-meta">{fmtData(ev.createdAt, true)}{ev.attempt ? ` · tentativa ${ev.attempt}` : ""}</span>
                {ev.resultado ? <pre className="ofx-json">{JSON.stringify(ev.resultado, null, 2)}</pre> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
