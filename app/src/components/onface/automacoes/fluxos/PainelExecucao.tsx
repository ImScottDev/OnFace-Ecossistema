"use client";

/* Aba Testar do painel direito: Ensaiar (percorre o rascunho sem gravar nem
 * enviar nada) e Rodar de verdade (roda a versão publicada), mais a lista das
 * execuções reais. O resultado pinta o caminho no canvas pelo editor. */
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Clock, FlaskConical, Play, X } from "lucide-react";
import {
  CATALOGO_NOS, ROTULO_ENTIDADE, gatilhoTemEntidade,
  type DetalheExecucao, type ExecucaoResumo, type GrafoFluxo, type PassoEnsaio, type PassoExecucao, type ResultadoEnsaio, type TipoEntidade,
} from "@/lib/automacoes/grafo";
import { MODO_EXECUCAO, STATUS_EXECUCAO, quandoRelativo } from "../formato";
import { apiFluxos } from "./api";
import { EscolherRegistro, type RegistroEscolhido } from "./EscolherRegistro";
import type { DocFluxo } from "./useEditorFluxo";

export type ModoTeste = "ensaiar" | "rodar";

const STATUS_ENSAIO: Record<PassoEnsaio["status"], { rotulo: string; tom: string }> = {
  ok: { rotulo: "Avaliado", tom: "ok" },
  simulado: { rotulo: "Simulado", tom: "neutro" },
  esperaria: { rotulo: "Esperaria", tom: "aviso" },
  erro: { rotulo: "Erro", tom: "erro" },
  pendencia: { rotulo: "Pendência", tom: "erro" },
};
const FINAL_ENSAIO: Record<ResultadoEnsaio["final"], string> = {
  sucesso: "Chegou ao fim sem erro.", erro: "Parou com erro.", parado: "Parou num bloco Parar.", pendencia: "Parou num bloco com pendência.",
};
const STATUS_PASSO: Record<PassoExecucao["status"], { rotulo: string; tom: string }> = {
  DONE: { rotulo: "Feito", tom: "ok" }, FAILED: { rotulo: "Falhou", tom: "erro" }, SKIPPED: { rotulo: "Pulado", tom: "neutro" },
  WAITING: { rotulo: "Aguardando", tom: "aviso" }, RUNNING: { rotulo: "Rodando", tom: "aviso" }, PENDING: { rotulo: "Na fila", tom: "neutro" },
};

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function Json({ valor }: { valor: Record<string, unknown> }) {
  const chaves = Object.keys(valor ?? {});
  if (!chaves.length) return <span className="oa-dica">vazio</span>;
  return <pre className="ofx-json">{JSON.stringify(valor, null, 2)}</pre>;
}

function nomeNo(grafo: GrafoFluxo, noId: string) {
  const no = grafo.nos.find((n) => n.id === noId);
  return no ? (no.rotulo?.trim() || CATALOGO_NOS[no.tipo].rotulo) : noId;
}

export function PainelExecucao({
  fluxoId, doc, entidade, publicada, alteracoesNaoPublicadas, podeGerir, modo, setModo,
  ensaio, aoEnsaiar, execucao, aoAbrirExecucao, aoFecharExecucao, noSelecionado, aoSelecionarNo,
}: {
  fluxoId: string;
  doc: DocFluxo;
  entidade: TipoEntidade | null;
  publicada: { versao: number } | null;
  alteracoesNaoPublicadas: boolean;
  podeGerir: boolean;
  modo: ModoTeste;
  setModo: (m: ModoTeste) => void;
  ensaio: ResultadoEnsaio | null;
  aoEnsaiar: (r: ResultadoEnsaio | null) => void;
  execucao: DetalheExecucao | null;
  aoAbrirExecucao: (execId: string) => void;
  aoFecharExecucao: () => void;
  noSelecionado: string | null;
  aoSelecionarNo: (noId: string) => void;
}) {
  const qc = useQueryClient();
  const gatilho = doc.grafo.nos.find((n) => n.tipo === "gatilho");
  const precisaRegistro = gatilhoTemEntidade(gatilho) && entidade !== null;
  const [registro, setRegistro] = useState<RegistroEscolhido | null>(null);
  const [payload, setPayload] = useState("");
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  // Trocou o tipo de registro do gatilho: o escolhido antes não serve mais.
  useEffect(() => { if (registro && registro.tipo !== entidade) setRegistro(null); }, [entidade, registro]);

  const classificadores = doc.grafo.nos.filter((n) => n.tipo === "ia_classificar");
  const modoGatilho = gatilho?.config.modo;
  const aceitaPayload = modoGatilho === "evento" || modoGatilho === "webhook";

  const pedido = () => {
    let corpo: Record<string, unknown> | undefined;
    if (payload.trim()) {
      try { corpo = JSON.parse(payload); } catch { throw new Error("Os dados do evento não são um JSON válido."); }
      if (modoGatilho === "webhook") corpo = { body: corpo };
    }
    return {
      entidade: registro ? { tipo: registro.tipo, id: registro.id } : undefined,
      payload: corpo,
    };
  };

  const ensaiar = useMutation({
    mutationFn: () => apiFluxos.ensaiar(fluxoId, { ...pedido(), escolhas, grafo: doc.grafo, config: doc.config }),
    onSuccess: (r) => aoEnsaiar(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const rodar = useMutation({
    mutationFn: () => apiFluxos.rodar(fluxoId, pedido()),
    onSuccess: (r) => {
      toast.success(r.execucao.status === "aguardando" ? "Execução iniciada; está esperando o próximo passo." : "Execução concluída.");
      void qc.invalidateQueries({ queryKey: ["fluxo-execucoes", fluxoId] });
      aoAbrirExecucao(r.execucao.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const execs = useInfiniteQuery({
    queryKey: ["fluxo-execucoes", fluxoId],
    queryFn: ({ pageParam }) => apiFluxos.execucoes(fluxoId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.proximo,
  });
  const itens = execs.data?.pages.flatMap((p) => p.itens) ?? [];

  const cancelar = useMutation({
    mutationFn: (execId: string) => apiFluxos.cancelarExecucao(execId),
    onSuccess: (e) => { toast.success("Execução cancelada"); void qc.invalidateQueries({ queryKey: ["fluxo-execucoes", fluxoId] }); aoAbrirExecucao(e.id); },
    onError: (e: Error) => toast.error(e.message),
  });

  const faltaRegistro = precisaRegistro && !registro;
  const ocupado = ensaiar.isPending || rodar.isPending;

  if (execucao) {
    return <DetalheExec detalhe={execucao} noSelecionado={noSelecionado} aoSelecionarNo={aoSelecionarNo} aoVoltar={aoFecharExecucao}
      podeCancelar={podeGerir} cancelando={cancelar.isPending} aoCancelar={() => cancelar.mutate(execucao.execucao.id)} />;
  }

  return (
    <div className="ofx-teste">
      <div className="ofx-segmentos ofx-segmentos-largo" role="tablist" aria-label="Tipo de teste">
        <button type="button" role="tab" aria-checked={modo === "ensaiar"} onClick={() => setModo("ensaiar")}><FlaskConical size={13} /> Ensaiar</button>
        <button type="button" role="tab" aria-checked={modo === "rodar"} onClick={() => setModo("rodar")}><Play size={13} /> Rodar de verdade</button>
      </div>

      {modo === "ensaiar" ? (
        <p className="ofx-teste-explica">Percorre o <b>rascunho</b> com dados reais do registro, avalia condições de verdade e mostra o que cada ação faria. <b>Nada é enviado nem gravado.</b></p>
      ) : !publicada ? (
        <div className="ofx-aviso">
          <AlertTriangle size={14} aria-hidden />
          <span>Publique para rodar de verdade. Para testar o rascunho, use Ensaiar.</span>
          <button type="button" className="oa-btn oa-btn-secundario" onClick={() => setModo("ensaiar")}>Ensaiar</button>
        </div>
      ) : (
        <p className="ofx-teste-explica ofx-teste-alerta">
          Roda a <b>versão {publicada.versao} publicada</b>{alteracoesNaoPublicadas ? " (não o rascunho, que tem alterações)" : ""}. <b>As ações acontecem de verdade:</b> mensagens saem, tarefas são criadas.
        </p>
      )}

      {precisaRegistro && entidade && (
        <div className="ofx-campo">
          <span className="ofx-campo-rotulo">{ROTULO_ENTIDADE[entidade]} usado no teste</span>
          <EscolherRegistro tipo={entidade} valor={registro} aoEscolher={setRegistro} />
        </div>
      )}
      {!precisaRegistro && <p className="oa-dica">O gatilho não traz registro: o teste roda sem lead, negócio ou contato.</p>}

      {aceitaPayload && (
        <div className="ofx-campo">
          <label className="ofx-campo-rotulo" htmlFor="teste-payload">{modoGatilho === "webhook" ? "Corpo da chamada (JSON, opcional)" : "Dados do evento (JSON, opcional)"}</label>
          <textarea id="teste-payload" className="oa-input ofx-mono" rows={3} value={payload} onChange={(e) => setPayload(e.target.value)} placeholder={modoGatilho === "webhook" ? '{ "lead_id": "..." }' : '{ "tag": "cliente-vip" }'} />
        </div>
      )}

      {modo === "ensaiar" && classificadores.length > 0 && (
        <div className="ofx-campo">
          <span className="ofx-campo-rotulo">No ensaio a IA não é chamada. Escolha a saída:</span>
          {classificadores.map((n) => {
            const classes = (n.config.classes as { id: string; rotulo: string }[] | undefined) ?? [];
            return (
              <label key={n.id} className="ofx-escolha">
                <span>{nomeNo(doc.grafo, n.id)}</span>
                <select className="oa-input" value={escolhas[n.id] ?? "outra"} onChange={(e) => setEscolhas((x) => ({ ...x, [n.id]: e.target.value }))}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.rotulo || c.id}</option>)}
                  <option value="outra">Nenhuma das classes</option>
                </select>
              </label>
            );
          })}
        </div>
      )}

      {modo === "ensaiar" ? (
        <button type="button" className="oa-btn oa-btn-primario ofx-teste-acao" disabled={ocupado || faltaRegistro} onClick={() => ensaiar.mutate()}
          title={faltaRegistro ? "Escolha o registro primeiro" : undefined}>
          <FlaskConical size={14} /> {ensaiar.isPending ? "Ensaiando…" : faltaRegistro ? "Escolha o registro para ensaiar" : "Ensaiar agora"}
        </button>
      ) : publicada && (
        <button type="button" className="oa-btn oa-btn-primario ofx-teste-acao" disabled={ocupado || faltaRegistro || !podeGerir}
          title={!podeGerir ? "Sua função não tem a permissão automation.manage" : undefined}
          onClick={() => { if (window.confirm("Rodar de verdade? As ações deste fluxo vão acontecer.")) rodar.mutate(); }}>
          <Play size={14} /> {rodar.isPending ? "Rodando…" : faltaRegistro ? "Escolha o registro para rodar" : "Rodar agora"}
        </button>
      )}

      {modo === "ensaiar" && ensaio && (
        <ResultadoEnsaioView ensaio={ensaio} grafo={doc.grafo} noSelecionado={noSelecionado} aoSelecionarNo={aoSelecionarNo} aoLimpar={() => aoEnsaiar(null)} />
      )}

      <section className="ofx-execs" aria-labelledby="execs-titulo">
        <h3 id="execs-titulo" className="ofx-insp-subtitulo">Execuções reais</h3>
        {execs.isLoading && <p className="oa-dica">Carregando execuções…</p>}
        {execs.isError && (
          <div className="ofx-aviso">
            <AlertTriangle size={14} aria-hidden />
            <span>{(execs.error as Error).message}</span>
            <button type="button" className="oa-btn oa-btn-secundario" onClick={() => execs.refetch()}>Tentar de novo</button>
          </div>
        )}
        {!execs.isLoading && !execs.isError && itens.length === 0 && (
          <p className="oa-dica">{publicada ? "Nenhuma execução ainda. Quando o gatilho disparar ou você rodar à mão, aparece aqui." : "Nenhuma execução. Só a versão publicada roda de verdade."}</p>
        )}
        <ul className="ofx-execs-lista">
          {itens.map((e) => <LinhaExecucao key={e.id} e={e} aoAbrir={() => aoAbrirExecucao(e.id)} />)}
        </ul>
        {execs.hasNextPage && (
          <button type="button" className="oa-btn oa-btn-secundario" disabled={execs.isFetchingNextPage} onClick={() => execs.fetchNextPage()}>
            {execs.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </button>
        )}
      </section>
    </div>
  );
}

function LinhaExecucao({ e, aoAbrir }: { e: ExecucaoResumo; aoAbrir: () => void }) {
  const s = STATUS_EXECUCAO[e.status] ?? { l: e.status, tom: "neutro" as const };
  return (
    <li>
      <button type="button" className="ofx-exec" onClick={aoAbrir}>
        <span className={`oa-ponto oa-${s.tom}`} aria-hidden />
        <span className="ofx-exec-corpo">
          <strong>{e.entidade?.nome ?? (e.entidade ? ROTULO_ENTIDADE[e.entidade.tipo] : MODO_EXECUCAO[e.modo] ?? e.modo)}</strong>
          <span>{s.l} · {MODO_EXECUCAO[e.modo] ?? e.modo}{e.versao ? ` · v${e.versao}` : ""}</span>
        </span>
        <span className="ofx-exec-quando" title={fmt(e.iniciadaEm)}>{quandoRelativo(e.iniciadaEm)}</span>
        <ChevronRight size={14} aria-hidden />
      </button>
    </li>
  );
}

function ResultadoEnsaioView({ ensaio, grafo, noSelecionado, aoSelecionarNo, aoLimpar }: {
  ensaio: ResultadoEnsaio; grafo: GrafoFluxo; noSelecionado: string | null; aoSelecionarNo: (id: string) => void; aoLimpar: () => void;
}) {
  const registro = ensaio.contexto.registro as { tipo?: string; nome?: string } | undefined;
  const aberto = useMemo(() => ensaio.passos.find((p) => p.noId === noSelecionado) ?? null, [ensaio, noSelecionado]);
  return (
    <section className="ofx-resultado" aria-label="Resultado do ensaio">
      <div className="ofx-faixa-ensaio">
        <FlaskConical size={14} aria-hidden />
        <span><b>Ensaio:</b> nada foi enviado nem gravado.</span>
        <button type="button" className="oa-icone" onClick={aoLimpar} aria-label="Limpar ensaio" title="Limpar o caminho do desenho"><X size={13} /></button>
      </div>
      {registro?.nome && <p className="oa-dica">Registro usado: <b>{registro.nome}</b></p>}
      <p className="ofx-resultado-final" data-final={ensaio.final}>{FINAL_ENSAIO[ensaio.final]}</p>
      <ol className="ofx-passos">
        {ensaio.passos.map((p, i) => {
          const s = STATUS_ENSAIO[p.status];
          return (
            <li key={`${p.noId}-${i}`} data-aberto={aberto === p ? "true" : undefined}>
              <button type="button" className="ofx-passo" onClick={() => aoSelecionarNo(p.noId)}>
                <span className="ofx-passo-num">{i + 1}</span>
                <span className="ofx-passo-corpo">
                  <strong>{nomeNo(grafo, p.noId)} <span className={`oa-selo oa-${s.tom === "neutro" ? "" : s.tom}`}>{s.rotulo}</span></strong>
                  <span>{p.previa}</span>
                </span>
              </button>
              {aberto === p && (
                <div className="ofx-passo-detalhe">
                  <span className="ofx-campo-rotulo">Entrada (com as variáveis resolvidas)</span>
                  <Json valor={p.entrada} />
                  {Object.keys(p.resultado ?? {}).length > 0 && <><span className="ofx-campo-rotulo">Saída</span><Json valor={p.resultado} /></>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DetalheExec({ detalhe, noSelecionado, aoSelecionarNo, aoVoltar, podeCancelar, cancelando, aoCancelar }: {
  detalhe: DetalheExecucao; noSelecionado: string | null; aoSelecionarNo: (id: string) => void; aoVoltar: () => void;
  podeCancelar: boolean; cancelando: boolean; aoCancelar: () => void;
}) {
  const { execucao: e, passos, grafo } = detalhe;
  const s = STATUS_EXECUCAO[e.status] ?? { l: e.status, tom: "neutro" as const };
  return (
    <div className="ofx-teste">
      <button type="button" className="ofx-voltar" onClick={aoVoltar}><ArrowLeft size={13} /> Voltar ao teste e às execuções</button>
      <header className="ofx-exec-cab">
        <span className={`oa-ponto oa-${s.tom}`} aria-hidden />
        <div>
          <strong>{s.l}</strong>
          <span>{MODO_EXECUCAO[e.modo] ?? e.modo}{e.versao ? ` · versão ${e.versao}` : ""} · {fmt(e.iniciadaEm)}</span>
          {e.entidade && <span>{ROTULO_ENTIDADE[e.entidade.tipo]}: {e.entidade.nome ?? e.entidade.id}</span>}
        </div>
      </header>
      {e.status === "aguardando" && (
        <div className="ofx-aviso">
          <Clock size={14} aria-hidden />
          <span>{e.retomarEm ? `Retoma ${fmt(e.retomarEm)}` : "Aguardando o próximo passo"}{e.noAtual ? `, em “${nomeNo(grafo, e.noAtual)}”` : ""}.</span>
          {podeCancelar && <button type="button" className="oa-btn oa-btn-secundario" disabled={cancelando} onClick={() => { if (window.confirm("Cancelar esta execução? Os próximos passos não vão rodar.")) aoCancelar(); }}>{cancelando ? "Cancelando…" : "Cancelar"}</button>}
        </div>
      )}
      {e.erro && <p className="ofx-erro-exec"><AlertTriangle size={13} aria-hidden /> {e.erro}</p>}
      {passos.length === 0 ? (
        <p className="oa-dica">Nenhum passo registrado nesta execução.</p>
      ) : (
        <ol className="ofx-passos">
          {passos.map((p) => {
            const st = STATUS_PASSO[p.status];
            const aberto = p.noId === noSelecionado;
            return (
              <li key={`${p.noId}-${p.ordem}`} data-aberto={aberto ? "true" : undefined}>
                <button type="button" className="ofx-passo" onClick={() => aoSelecionarNo(p.noId)}>
                  <span className="ofx-passo-num">{p.status === "DONE" ? <Check size={11} strokeWidth={3} /> : p.ordem}</span>
                  <span className="ofx-passo-corpo">
                    <strong>{nomeNo(grafo, p.noId)} <span className={`oa-selo oa-${st.tom === "neutro" ? "" : st.tom}`}>{st.rotulo}</span></strong>
                    <span>{p.saida ? `Saiu por “${p.saida}”` : ""}{p.terminadoEm ? ` · ${fmt(p.terminadoEm)}` : ""}</span>
                  </span>
                </button>
                {aberto && (
                  <div className="ofx-passo-detalhe">
                    {p.erro && <p className="ofx-erro-exec"><AlertTriangle size={13} aria-hidden /> {p.erro}</p>}
                    <span className="ofx-campo-rotulo">Entrada</span>
                    <Json valor={p.entrada} />
                    <span className="ofx-campo-rotulo">Saída</span>
                    <Json valor={p.resultado} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

