"use client";

/* Editor de uma automação (contrato §7.2): barra do topo, canvas e painel
 * direito com três abas (Bloco/Automação, Testar, Versões).
 *
 * O documento vive em useEditorFluxo (desfazer + autosave). O canvas pode
 * mostrar três coisas: o rascunho (editável), uma versão publicada (leitura,
 * com Restaurar) ou o grafo da versão em que uma execução rodou (leitura, com
 * o caminho pintado). Mostrar o grafo certo importa: pintar o caminho de uma
 * execução da v2 sobre o rascunho de hoje apontaria para blocos que mudaram. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Eye, FlaskConical, History, Play, Plus, Redo2, RefreshCw, Rocket, Undo2,
} from "lucide-react";
import {
  CATALOGO_NOS, validarGrafo,
  type ConfigFluxo, type DetalheExecucao, type FluxoDetalhe, type GrafoFluxo, type Pendencia, type ResultadoEnsaio, type TipoNo,
} from "@/lib/automacoes/grafo";
import { quandoRelativo } from "../formato";
import { apiFluxos, ErroApi } from "./api";
import { Canvas, type Selecao, type TrilhaCanvas } from "./Canvas";
import { Historico } from "./Historico";
import { Inspetor, entidadeDoGatilho } from "./Inspetor";
import type { MarcaTrilha } from "./NoCanvas";
import { adicionarNo, duplicar, remover } from "./operacoes";
import { PainelExecucao, type ModoTeste } from "./PainelExecucao";
import { Paleta } from "./Paleta";
import { Pendencias } from "./Pendencias";
import { useEditorFluxo, type DocFluxo, type OpcoesMudanca } from "./useEditorFluxo";
import "../automacoes.css";
import "./fluxos.css";

type Aba = "inspetor" | "testar" | "versoes";
type Visao =
  | { tipo: "rascunho" }
  | { tipo: "versao"; id: string; versao: number; grafo: GrafoFluxo; config: ConfigFluxo }
  | { tipo: "execucao"; detalhe: DetalheExecucao };

const SEM_PERMISSAO = "Sua função não tem a permissão automation.manage";

/** Carrega o detalhe e cobre os estados de carga, erro e 404 (contrato §7.3). */
export function EditorFluxo({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["fluxo", id], queryFn: () => apiFluxos.detalhe(id), retry: (n, e) => !(e instanceof ErroApi && e.status < 500) && n < 2, refetchOnWindowFocus: false, staleTime: Infinity });

  if (q.isLoading) return <EsqueletoEditor />;
  if (q.isError) {
    const e = q.error as Error;
    const nao = e instanceof ErroApi && e.status === 404;
    return (
      <div data-workspace="desenho">
        <div className="ofx-estado">
          <AlertTriangle size={22} aria-hidden />
          <strong>{nao ? "Automação não encontrada" : "Não foi possível abrir a automação"}</strong>
          <span>{nao ? "Ela pode ter sido excluída, ou o endereço está errado." : e.message}</span>
          <div className="ofx-estado-acoes">
            <Link href="/automacoes/fluxos" className="oa-btn oa-btn-secundario"><ArrowLeft size={14} /> Voltar aos fluxos</Link>
            {!nao && <button type="button" className="oa-btn oa-btn-primario" onClick={() => q.refetch()}><RefreshCw size={14} /> Tentar de novo</button>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <EditorCarregado detalhe={q.data!} />
    </ReactFlowProvider>
  );
}

function EsqueletoEditor() {
  return (
    <div data-workspace="desenho" className="ofx-editor" aria-busy="true" aria-label="Carregando automação">
      <div className="ofx-topo"><span className="ofx-esq ofx-esq-titulo" /><span className="ofx-espaco" /><span className="ofx-esq ofx-esq-botao" /><span className="ofx-esq ofx-esq-botao" /></div>
      <div className="ofx-corpo">
        <div className="ofx-palco ofx-palco-esqueleto"><span className="ofx-esq ofx-esq-no" /><span className="ofx-esq ofx-esq-no" /></div>
        <aside className="ofx-painel"><span className="ofx-esq ofx-esq-linha" /><span className="ofx-esq ofx-esq-linha" /><span className="ofx-esq ofx-esq-linha" /></aside>
      </div>
    </div>
  );
}

function trilhaDoEnsaio(e: ResultadoEnsaio): TrilhaCanvas {
  const nos: TrilhaCanvas["nos"] = {};
  for (const p of e.passos) nos[p.noId] = { marca: p.status as MarcaTrilha, saida: p.saida };
  return { nos, arestas: e.arestas };
}

function trilhaDaExecucao(d: DetalheExecucao): TrilhaCanvas {
  const MARCA: Record<string, MarcaTrilha> = { DONE: "ok", FAILED: "erro", WAITING: "aguardando", RUNNING: "aguardando", SKIPPED: "pulado", PENDING: "aguardando" };
  const nos: TrilhaCanvas["nos"] = {};
  for (const p of d.passos) nos[p.noId] = { marca: MARCA[p.status] ?? "ok", saida: p.saida };
  if (d.execucao.status === "aguardando" && d.execucao.noAtual && !nos[d.execucao.noAtual]) nos[d.execucao.noAtual] = { marca: "aguardando", saida: null };
  // Aresta percorrida = saiu de um nó do caminho pela saída registrada e chegou a outro nó do caminho.
  const arestas = d.grafo.arestas.filter((a) => nos[a.origem]?.saida === a.saida && nos[a.destino]).map((a) => a.id);
  return { nos, arestas };
}

/* Chave do que muda o PERCURSO (tudo menos posição): ensaio velho some quando
   ela muda, para o caminho pintado nunca mentir sobre o grafo de agora. */
function chaveEstrutura(g: GrafoFluxo) {
  return JSON.stringify([g.nos.map((n) => [n.id, n.tipo, n.config, n.falha, n.desativado]), g.arestas]);
}

function EditorCarregado({ detalhe }: { detalhe: FluxoDetalhe }) {
  const params = useSearchParams();
  const qc = useQueryClient();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const podeGerir = detalhe.podeGerir;
  const ed = useEditorFluxo(detalhe, !podeGerir);
  const { doc } = ed;

  const [meta, setMeta] = useState({ ativo: detalhe.ativo, estado: detalhe.estado, publicada: detalhe.publicada, alteracoes: detalhe.alteracoesNaoPublicadas });
  const [selecao, setSelecao] = useState<Selecao>({ nos: [], arestas: [] });
  const [aba, setAba] = useState<Aba>("inspetor");
  const [modoTeste, setModoTeste] = useState<ModoTeste>("ensaiar");
  const [paleta, setPaleta] = useState<null | { depoisDe?: { noId: string; saida: string } }>(null);
  const [pendAberto, setPendAberto] = useState(false);
  const [foco, setFoco] = useState<{ noId: string; campo?: string; n: number } | null>(null);
  const [ensaio, setEnsaio] = useState<ResultadoEnsaio | null>(null);
  const [visao, setVisao] = useState<Visao>({ tipo: "rascunho" });
  const [publicando, setPublicando] = useState(false);
  const [, setRelogio] = useState(0);
  const palcoRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(() => setRelogio((n) => n + 1), 10_000); return () => clearInterval(t); }, []);

  const opcoesQ = useQuery({ queryKey: ["fluxos-opcoes"], queryFn: apiFluxos.opcoes, staleTime: 60_000 });
  const listaQ = useQuery({ queryKey: ["fluxos"], queryFn: apiFluxos.listar, staleTime: 60_000, enabled: podeGerir && aba === "inspetor" && selecao.nos.length === 0 });
  const opcoes = opcoesQ.data;

  const pendencias = useMemo(() => validarGrafo(doc.grafo), [doc.grafo]);
  const gatilho = doc.grafo.nos.find((n) => n.tipo === "gatilho");
  const entidade = entidadeDoGatilho(gatilho);

  const estrutura = chaveEstrutura(doc.grafo);
  const estruturaAnterior = useRef(estrutura);
  // Edição do usuário depois de publicar = alterações não publicadas (o
  // servidor confirma no próximo GET). Marca no gesto, não num efeito sobre
  // `doc`: o StrictMode roda o efeito duas vezes e acendia o selo ao abrir.
  const marcarAlteracao = useCallback(() => setMeta((m) => (m.publicada && !m.alteracoes ? { ...m, alteracoes: true } : m)), []);
  const mudarDoc = useCallback((fn: (d: DocFluxo) => DocFluxo, o?: OpcoesMudanca) => { ed.mudar(fn, o); marcarAlteracao(); }, [ed, marcarAlteracao]);
  const desfazer = useCallback(() => { ed.desfazer(); marcarAlteracao(); }, [ed, marcarAlteracao]);
  const refazer = useCallback(() => { ed.refazer(); marcarAlteracao(); }, [ed, marcarAlteracao]);
  useEffect(() => {
    if (estruturaAnterior.current !== estrutura) { estruturaAnterior.current = estrutura; setEnsaio(null); }
  }, [estrutura]);

  const emRascunho = visao.tipo === "rascunho";
  const grafoVisivel = visao.tipo === "rascunho" ? doc.grafo : visao.tipo === "versao" ? visao.grafo : visao.detalhe.grafo;
  const somenteLeituraCanvas = !podeGerir || !emRascunho;
  const trilha = useMemo<TrilhaCanvas | null>(() => (
    visao.tipo === "execucao" ? trilhaDaExecucao(visao.detalhe) : visao.tipo === "rascunho" && ensaio ? trilhaDoEnsaio(ensaio) : null
  ), [visao, ensaio]);

  const mudarGrafo = useCallback((fn: (g: GrafoFluxo) => GrafoFluxo, o?: OpcoesMudanca) => mudarDoc((d) => {
    const g = fn(d.grafo);
    return g === d.grafo ? d : { ...d, grafo: g };
  }, o), [mudarDoc]);

  const noSelecionado = selecao.nos.length === 1 ? grafoVisivel.nos.find((n) => n.id === selecao.nos[0]) ?? null : null;

  const selecionarNo = useCallback((id: string | null) => setSelecao({ nos: id ? [id] : [], arestas: [] }), []);

  const adicionar = useCallback((tipo: TipoNo) => {
    let novo = "";
    const depoisDe = paleta?.depoisDe;
    mudarGrafo((g) => {
      let posicao: { x: number; y: number } | undefined;
      if (!depoisDe) {
        const r = palcoRef.current?.getBoundingClientRect();
        const centro = r ? screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 };
        posicao = { x: centro.x - 136, y: centro.y - 50 };
      }
      const res = adicionarNo(g, tipo, { posicao, depoisDe });
      novo = res.id;
      return res.grafo;
    });
    setPaleta(null);
    if (novo) { selecionarNo(novo); setAba("inspetor"); }
    // Pelo "+" de uma saída o bloco nasce ao lado, muitas vezes fora da tela: reenquadra.
    if (novo && depoisDe) setTimeout(() => void fitView({ duration: 250, padding: 0.25, maxZoom: 1 }), 60);
  }, [mudarGrafo, paleta, screenToFlowPosition, selecionarNo, fitView]);

  const duplicarNo = useCallback((id: string) => {
    let novo = "";
    mudarGrafo((g) => { const r = duplicar(g, id); if (!r) return g; novo = r.id; return r.grafo; });
    if (novo) selecionarNo(novo);
  }, [mudarGrafo, selecionarNo]);

  const excluirNo = useCallback((id: string) => { mudarGrafo((g) => remover(g, [id])); selecionarNo(null); }, [mudarGrafo, selecionarNo]);

  // Atalhos de teclado. Dentro de campo de texto, Ctrl+Z é do campo.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const digitando = alvo.closest("input, textarea, select, [contenteditable='true']");
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape" && !digitando) { setPaleta(null); setPendAberto(false); return; }
      if (digitando || !mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); if (emRascunho) desfazer(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); if (emRascunho) refazer(); }
      else if (k === "d" && selecao.nos.length === 1 && emRascunho && podeGerir) { e.preventDefault(); duplicarNo(selecao.nos[0]); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [desfazer, refazer, selecao, duplicarNo, emRascunho, podeGerir]);

  const irPendencia = (p: Pendencia) => {
    if (!p.noId) return;
    setVisao({ tipo: "rascunho" });
    selecionarNo(p.noId);
    setAba("inspetor");
    setPendAberto(false);
    setFoco((f) => ({ noId: p.noId!, campo: p.campo, n: (f?.n ?? 0) + 1 }));
    const no = doc.grafo.nos.find((n) => n.id === p.noId);
    if (no) void fitView({ nodes: [{ id: no.id }], duration: 300, maxZoom: 1.1, padding: 0.6 });
  };

  const publicar = async () => {
    if (pendencias.length) { setPendAberto(true); return; }
    setPublicando(true);
    try {
      const salvo = await ed.salvarAgora();
      if (!salvo) { toast.error("O rascunho não salvou; publique de novo quando o salvamento voltar."); return; }
      const r = await apiFluxos.publicar(detalhe.id);
      setMeta({ ativo: r.fluxo.ativo, estado: r.fluxo.estado, publicada: r.fluxo.publicada, alteracoes: false });
      void qc.invalidateQueries({ queryKey: ["fluxos"] });
      if (r.fluxo.ativo) toast.success(`Versão ${r.versao.versao} publicada e já em uso.`);
      else toast.success(`Versão ${r.versao.versao} publicada`, { description: "A automação está desligada.", action: { label: "Ativar agora", onClick: () => void alternarAtivo(true) }, duration: 8000 });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 422) { setPendAberto(true); toast.error(e.message); }
      else toast.error((e as Error).message);
    } finally { setPublicando(false); }
  };

  const alternarAtivo = async (ativo: boolean) => {
    try {
      const f = await apiFluxos.atualizar(detalhe.id, { ativo });
      setMeta((m) => ({ ...m, ativo: f.ativo, estado: f.estado }));
      void qc.invalidateQueries({ queryKey: ["fluxos"] });
      toast.success(f.ativo ? "Automação ativada" : "Automação desligada");
    } catch (e) { toast.error((e as Error).message); }
  };

  const verVersao = async (versaoId: string) => {
    try {
      const v = await apiFluxos.versao(detalhe.id, versaoId);
      setVisao({ tipo: "versao", id: versaoId, versao: v.versao.versao, grafo: v.grafo, config: v.config });
      setSelecao({ nos: [], arestas: [] });
      requestAnimationFrame(() => void fitView({ duration: 250, padding: 0.25, maxZoom: 1 }));
    } catch (e) { toast.error((e as Error).message); }
  };

  const restaurar = async () => {
    if (visao.tipo !== "versao") return;
    if (!window.confirm(`Copiar a versão ${visao.versao} para o rascunho? O rascunho atual é substituído (nada é publicado).`)) return;
    try {
      await ed.salvarAgora();
      const f = await apiFluxos.restaurar(detalhe.id, visao.id);
      ed.substituir(f);
      setMeta({ ativo: f.ativo, estado: f.estado, publicada: f.publicada, alteracoes: f.alteracoesNaoPublicadas });
      setVisao({ tipo: "rascunho" });
      setAba("inspetor");
      toast.success(`Versão ${visao.versao} copiada para o rascunho. Publique para colocar em uso.`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const abrirExecucao = useCallback(async (execId: string) => {
    try {
      const d = await apiFluxos.execucao(execId);
      setVisao({ tipo: "execucao", detalhe: d });
      setAba("testar");
      setSelecao({ nos: [], arestas: [] });
      const u = new URL(window.location.href);
      u.searchParams.set("execucao", execId);
      window.history.replaceState(null, "", u);
      requestAnimationFrame(() => void fitView({ duration: 250, padding: 0.25, maxZoom: 1 }));
    } catch (e) { toast.error((e as Error).message); }
  }, [fitView]);

  const voltarAoRascunho = () => {
    setVisao({ tipo: "rascunho" });
    setSelecao({ nos: [], arestas: [] });
    const u = new URL(window.location.href);
    if (u.searchParams.has("execucao")) { u.searchParams.delete("execucao"); window.history.replaceState(null, "", u); }
  };

  // ?execucao=<id> vindo da tela Execuções abre direto.
  const execInicial = params.get("execucao");
  useEffect(() => { if (execInicial) void abrirExecucao(execInicial); }, [execInicial, abrirExecucao]);

  const regenerarWebhook = async () => {
    if (!window.confirm("Gerar outro endereço? O atual para de funcionar na hora.")) return;
    try { const r = await apiFluxos.regenerarWebhook(detalhe.id); ed.setWebhookUrl(r.webhookUrl); toast.success("Endereço novo gerado. Atualize quem chama o antigo."); }
    catch (e) { toast.error((e as Error).message); }
  };

  const recarregar = async () => {
    try { const f = await apiFluxos.detalhe(detalhe.id); ed.substituir(f); setMeta({ ativo: f.ativo, estado: f.estado, publicada: f.publicada, alteracoes: f.alteracoesNaoPublicadas }); toast.success("Recarregado com a versão mais nova do rascunho."); }
    catch (e) { toast.error((e as Error).message); }
  };

  const textoSalvar = (() => {
    if (!podeGerir) return "Somente leitura";
    switch (ed.salvar.tipo) {
      case "salvando": return "Salvando…";
      case "pendente": return "Salvando em instantes…";
      case "erro": return `Não salvo: ${ed.salvar.mensagem}`;
      case "conflito": return "Não salvo: alterada em outra aba";
      default: return `Salvo ${quandoRelativo(ed.salvoEm)}`;
    }
  })();

  const contextoPaleta = paleta?.depoisDe ? (() => {
    const no = doc.grafo.nos.find((n) => n.id === paleta.depoisDe!.noId);
    if (!no) return null;
    const nome = no.rotulo?.trim() || (no.tipo === "gatilho" ? "o gatilho" : CATALOGO_NOS[no.tipo].rotulo);
    return `Depois de ${nome}${paleta.depoisDe!.saida !== "ok" ? ` › ${paleta.depoisDe!.saida}` : ""}`;
  })() : null;

  return (
    <div data-workspace="desenho" className="ofx-editor">
      <header className="ofx-topo">
        <Link href="/automacoes/fluxos" className="oa-icone ofx-voltar-topo" aria-label="Voltar aos fluxos" title="Voltar aos fluxos"><ArrowLeft size={16} /></Link>
        <input
          className="ofx-nome"
          value={doc.nome}
          onChange={(e) => mudarDoc((d: DocFluxo) => ({ ...d, nome: e.target.value }), { agrupar: "nome" })}
          disabled={!podeGerir}
          maxLength={100}
          placeholder="Automação sem nome"
          aria-label="Nome da automação"
        />
        <span className={`oa-selo ${meta.estado === "ativa" ? "oa-ok" : meta.estado === "publicada" ? "" : "oa-aviso"}`}>
          {meta.estado === "ativa" ? "Ativa" : meta.estado === "publicada" ? "Publicada, desligada" : "Rascunho"}
        </span>
        {meta.publicada && meta.alteracoes && <span className="oa-selo ofx-selo-alteracao" title="O rascunho difere da versão em uso">Alterações não publicadas</span>}
        {podeGerir && (
          <label className="ofx-interruptor ofx-interruptor-topo" title={meta.publicada ? (meta.ativo ? "Desligar" : "Ligar") : "Publique primeiro"}>
            <input type="checkbox" checked={meta.ativo} disabled={!meta.publicada} onChange={(e) => void alternarAtivo(e.target.checked)} aria-label={meta.ativo ? "Desligar automação" : "Ligar automação"} />
            <span aria-hidden />
          </label>
        )}

        <span className="ofx-espaco" />

        {podeGerir && (
          <div className="ofx-grupo" role="group" aria-label="Desfazer e refazer">
            <button type="button" className="oa-icone" onClick={desfazer} disabled={!ed.podeDesfazer || !emRascunho} aria-label="Desfazer" title="Desfazer (Ctrl+Z)"><Undo2 size={15} /></button>
            <button type="button" className="oa-icone" onClick={refazer} disabled={!ed.podeRefazer || !emRascunho} aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)"><Redo2 size={15} /></button>
          </div>
        )}
        <button type="button" className="oa-icone ofx-icone-topo" aria-pressed={aba === "versoes"} onClick={() => setAba("versoes")} aria-label="Histórico de versões" title="Histórico de versões"><History size={15} /></button>
        <button type="button" className="oa-btn oa-btn-secundario" aria-pressed={aba === "testar" && modoTeste === "ensaiar"} onClick={() => { voltarAoRascunho(); setAba("testar"); setModoTeste("ensaiar"); }}><FlaskConical size={14} /> Ensaiar</button>
        <button type="button" className="oa-btn oa-btn-secundario" aria-pressed={aba === "testar" && modoTeste === "rodar"} onClick={() => { setAba("testar"); setModoTeste("rodar"); }}><Play size={14} /> Rodar agora</button>
        <span className="ofx-salvo" data-estado={ed.salvar.tipo} title={ed.salvar.tipo === "salvo" ? new Date(ed.salvoEm).toLocaleString("pt-BR") : undefined}>
          {textoSalvar}
          {ed.salvar.tipo === "erro" && <button type="button" className="oa-link" onClick={() => void ed.salvarAgora()}>Tentar de novo</button>}
        </span>
        {podeGerir && (
          <div className="ofx-publicar">
            <button type="button" className="oa-btn oa-btn-primario" data-abre-pendencias onClick={() => void publicar()} disabled={publicando || ed.salvar.tipo === "conflito"}>
              <Rocket size={14} /> {publicando ? "Publicando…" : "Publicar"}
              {pendencias.length > 0 && <span className="ofx-contador" title={`${pendencias.length} pendência(s)`}>{pendencias.length}</span>}
            </button>
            {pendAberto && pendencias.length > 0 && <Pendencias pendencias={pendencias} grafo={doc.grafo} aoIr={irPendencia} aoFechar={() => setPendAberto(false)} />}
          </div>
        )}
      </header>

      {!podeGerir && <div className="ofx-faixa" data-tom="neutro"><Eye size={14} aria-hidden /> Somente leitura: {SEM_PERMISSAO.toLowerCase()}.</div>}
      {ed.salvar.tipo === "conflito" && (
        <div className="ofx-faixa" data-tom="erro">
          <AlertTriangle size={14} aria-hidden /> Esta automação mudou em outra aba. Para não sobrescrever, parei de salvar aqui.
          <button type="button" className="oa-btn oa-btn-secundario" onClick={() => void recarregar()}><RefreshCw size={13} /> Recarregar</button>
        </div>
      )}
      {visao.tipo === "versao" && (
        <div className="ofx-faixa" data-tom="coral">
          <History size={14} aria-hidden /> Vendo a versão {visao.versao}, só leitura.
          {podeGerir && <button type="button" className="oa-btn oa-btn-secundario" onClick={() => void restaurar()}>Restaurar no rascunho</button>}
          <button type="button" className="oa-btn oa-btn-secundario" onClick={voltarAoRascunho}>Voltar ao rascunho</button>
        </div>
      )}
      {visao.tipo === "execucao" && (
        <div className="ofx-faixa" data-tom="coral">
          <Play size={14} aria-hidden /> Caminho da execução de {new Date(visao.detalhe.execucao.iniciadaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          {visao.detalhe.execucao.versao ? ` (versão ${visao.detalhe.execucao.versao})` : ""}. Clique num bloco para ver entrada e saída.
          <button type="button" className="oa-btn oa-btn-secundario" onClick={voltarAoRascunho}>Voltar ao rascunho</button>
        </div>
      )}

      <div className="ofx-corpo">
        <div className="ofx-palco" ref={palcoRef}>
          <Canvas
            grafo={grafoVisivel}
            pendencias={emRascunho ? pendencias : []}
            opcoes={opcoes}
            selecao={selecao}
            trilha={trilha}
            somenteLeitura={somenteLeituraCanvas}
            mudar={mudarGrafo}
            marcar={ed.marcar}
            selecionar={(s) => { setSelecao(s); if (s.nos.length === 1 && aba === "versoes") setAba("inspetor"); }}
            aoMais={(noId, saida) => setPaleta({ depoisDe: { noId, saida } })}
            aoRecusar={(m) => toast.error(m)}
          />
          {!somenteLeituraCanvas && (
            <div className="ofx-palco-topo">
              <button type="button" className="ofx-botao-mais" onClick={() => setPaleta(paleta ? null : {})} aria-expanded={Boolean(paleta)} aria-label="Adicionar bloco" title="Adicionar bloco">
                <Plus size={16} strokeWidth={2.4} />
              </button>
              {!paleta && <span className="ofx-palco-dica">Clique num bloco para editar. Arraste da bolinha de uma saída até outro bloco para ligar.</span>}
            </div>
          )}
          {paleta && !somenteLeituraCanvas && <Paleta contexto={contextoPaleta} aoEscolher={adicionar} aoFechar={() => setPaleta(null)} />}
        </div>

        <aside className="ofx-painel" aria-label="Painel da automação">
          <div className="oa-abas ofx-abas" role="tablist">
            <button type="button" role="tab" className="oa-aba" aria-current={aba === "inspetor" ? "page" : undefined} onClick={() => setAba("inspetor")}>
              {noSelecionado ? "Bloco" : "Automação"}
            </button>
            <button type="button" role="tab" className="oa-aba" aria-current={aba === "testar" ? "page" : undefined} onClick={() => setAba("testar")}>Testar</button>
            <button type="button" role="tab" className="oa-aba" aria-current={aba === "versoes" ? "page" : undefined} onClick={() => setAba("versoes")}>Versões</button>
          </div>
          <div className="ofx-painel-rolagem">
            {aba === "inspetor" && (
              <Inspetor
                doc={visao.tipo === "rascunho" ? doc : { ...doc, grafo: grafoVisivel, config: visao.tipo === "versao" ? visao.config : doc.config }}
                no={noSelecionado}
                pendencias={emRascunho ? pendencias : []}
                opcoes={opcoes}
                ensaio={ensaio?.contexto ?? null}
                somenteLeitura={somenteLeituraCanvas}
                webhookUrl={ed.webhookUrl}
                pastas={listaQ.data?.pastas ?? []}
                foco={foco}
                mudar={mudarDoc}
                aoDuplicar={duplicarNo}
                aoExcluir={excluirNo}
                aoRegenerarWebhook={() => void regenerarWebhook()}
              />
            )}
            {aba === "testar" && (
              <PainelExecucao
                fluxoId={detalhe.id}
                doc={doc}
                entidade={entidade}
                publicada={meta.publicada}
                alteracoesNaoPublicadas={meta.alteracoes}
                podeGerir={podeGerir}
                modo={modoTeste}
                setModo={setModoTeste}
                ensaio={ensaio}
                aoEnsaiar={setEnsaio}
                execucao={visao.tipo === "execucao" ? visao.detalhe : null}
                aoAbrirExecucao={(id) => void abrirExecucao(id)}
                aoFecharExecucao={voltarAoRascunho}
                noSelecionado={noSelecionado?.id ?? null}
                aoSelecionarNo={(id) => selecionarNo(id)}
              />
            )}
            {aba === "versoes" && (
              <Historico fluxoId={detalhe.id} versaoVista={visao.tipo === "versao" ? visao.id : null} aoVer={(id) => void verVersao(id)} publicadaEm={meta.publicada?.publicadaEm ?? null} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
