"use client";

/**
 * Pipeline / Oportunidades (Bloco 02).
 *
 * Quatro etapas abertas e só elas. Reunião, trial e no-show aparecem como
 * badge e evento, nunca como coluna — é a regra que a spec repete três vezes.
 *
 * Ganho não tem botão de "marcar como ganho". Existe "Tentar fechar", que
 * pergunta ao gate de evidência se há base para fechar e, quando não há, diz o
 * que falta. Isso não é rigidez: é o que impede o board de dizer que a venda
 * aconteceu antes de o dinheiro ou o contrato existirem.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, CalendarClock, FileText, Plus, Trophy, Users,
} from "lucide-react";
import type { BoardPipeline, CardPipeline, DetalheOportunidade } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import {
  ETAPAS_PIPELINE, FAMILIAS, MOTIVOS_ESTAGNACAO, MOTIVOS_PERDA,
  ROTULO_ETAPA_PIPELINE, ROTULO_FAMILIA,
  type EtapaPipelineAberta, type Familia, type MotivoEstagnacao, type MotivoPerda,
} from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";
import {
  Abas, AvisoBloqueio, Board, Busca, Campo, Coluna, ColunaVazia, ComPainel,
  Dialogo, Painel, Secao, Tag, dataCurta, dataHora, moeda, moedaExata, useAcao,
  type RotaBaseVendas,
} from "./ui";
import { rotuloAtor, rotuloEvento } from "./PreVendas";

type Aba = "abertas" | "ganhas" | "perdidas";

export interface AcoesPipeline {
  moverEtapa: (id: string, para: EtapaPipelineAberta) => Promise<Resultado>;
  definirProximaAcao: (id: string, descricao: string | null, quando: string | null) => Promise<Resultado>;
  marcarEstagnacao: (id: string, motivo: MotivoEstagnacao | null) => Promise<Resultado>;
  alterarFamilia: (id: string, familia: Familia, motivo: string | null) => Promise<Resultado<{ propostasIncompativeis: number }>>;
  perder: (id: string, motivo: MotivoPerda, detalhe: string | null) => Promise<Resultado>;
  tentarGanhar: (id: string) => Promise<Resultado<{ ganhou: boolean; motivo: string }>>;
  agendarReuniao: (id: string, data: string, tipo: "call" | "presencial" | "video") => Promise<Resultado>;
  noShow: (id: string, reuniaoId: string | null) => Promise<Resultado>;
  reagendar: (id: string, data: string) => Promise<Resultado>;
  trial: (id: string, iniciar: boolean) => Promise<Resultado>;
  criarOportunidade: (e: {
    empresaId: string; familias: Familia[]; responsavelId: string;
    titulo?: string | null; valorEstimado?: string | null;
  }) => Promise<Resultado<{ ids: string[] }>>;
  buscarEmpresas: (termo: string) => Promise<Array<{ id: string; nome: string; apoio: string | null }>>;
  detalhe: (id: string) => Promise<Resultado<{ oportunidade: DetalheOportunidade | null; timeline: LinhaDoTempo[] }>>;
}

export function Pipeline({ dados, aba, filtro, selecaoInicial, rotaBase, acoes }: {
  dados: BoardPipeline;
  aba: Aba;
  filtro: { busca: string; responsavelId: string | null; familia: string | null };
  selecaoInicial?: string | null;
  rotaBase: RotaBaseVendas;
  acoes: AcoesPipeline;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [busca, setBusca] = useState(filtro.busca);
  const [selecionado, setSelecionado] = useState<string | null>(selecaoInicial ?? null);
  const [detalhe, setDetalhe] = useState<{ oportunidade: DetalheOportunidade | null; timeline: LinhaDoTempo[] } | null>(null);
  const [modal, setModal] = useState<null | "perder" | "familia" | "proxima" | "reuniao" | "nova">(null);
  const [resultadoGanho, setResultadoGanho] = useState<string | null>(null);
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();

  function navegar(mudancas: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") url.searchParams.delete(chave);
      else url.searchParams.set(chave, valor);
    }
    iniciarNavegacao(() => router.push(`${url.pathname}${url.search}`));
  }

  async function abrir(id: string) {
    setSelecionado(id);
    limparBloqueio();
    setResultadoGanho(null);
    setDetalhe(null);
    const r = await acoes.detalhe(id);
    if (r.ok && r.dados) setDetalhe(r.dados);
  }

  // O CTA "Gerenciar" chega pela URL; carregar após o mount evita um painel
  // vazio quando a rota já nasce com `?oportunidade=`.
  useEffect(() => {
    if (!selecaoInicial) return;
    let ativa = true;
    setSelecionado(selecaoInicial);
    setDetalhe(null);
    setResultadoGanho(null);
    void acoes.detalhe(selecaoInicial).then((resultado) => {
      if (ativa && resultado.ok && resultado.dados) setDetalhe(resultado.dados);
    });
    return () => { ativa = false; };
  }, [selecaoInicial]);

  async function recarregar() {
    if (!selecionado) return;
    const r = await acoes.detalhe(selecionado);
    if (r.ok && r.dados) setDetalhe(r.dados);
  }

  async function rodar(fn: () => Promise<Resultado<unknown>>, fecharModal = true) {
    const desfecho = await executar(async () => (await fn()) as Resultado<unknown>);
    if (desfecho.ok) {
      if (fecharModal) setModal(null);
      await recarregar();
      router.refresh();
    }
    return desfecho.ok;
  }

  async function tentarGanhar() {
    const desfecho = await executar(async () => acoes.tentarGanhar(selecionado!));
    // Esta ação SEMPRE devolve dado (ganhou/motivo); `dados` nulo aqui seria
    // contrato quebrado, não "deu certo sem resposta".
    if (desfecho.ok && desfecho.dados) {
      setResultadoGanho(desfecho.dados.ganhou ? null : desfecho.dados.motivo);
      await recarregar();
      router.refresh();
    }
    return true;
  }

  const op = detalhe?.oportunidade ?? null;

  return (
    <>
      <div className="ov-controles">
        <Abas<Aba>
          ativa={aba}
          aoTrocar={(nova) => navegar({ aba: nova === "abertas" ? null : nova })}
          abas={[
            { chave: "abertas", rotulo: "Abertas", contagem: dados.resumo.abertas },
            { chave: "ganhas", rotulo: "Ganhas", contagem: dados.resumo.ganhas },
            { chave: "perdidas", rotulo: "Perdidas", contagem: dados.resumo.perdidas },
          ]}
        />
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar empresa ou oportunidade" />
        <button type="button" className="ov-botao" data-variante="neutro" onClick={() => navegar({ busca })}>Buscar</button>
        <select className="ov-select" value={filtro.familia ?? ""} aria-label="Filtrar por família"
          onChange={(e) => navegar({ familia: e.target.value || null })}>
          <option value="">Todas as famílias</option>
          {dados.filtros.familias.map((f) => (
            <option key={f} value={f}>{ROTULO_FAMILIA[f as keyof typeof ROTULO_FAMILIA] ?? f}</option>
          ))}
        </select>
        <select className="ov-select" value={filtro.responsavelId ?? ""} aria-label="Filtrar por responsável"
          onChange={(e) => navegar({ responsavel: e.target.value || null })}>
          <option value="">Todos os responsáveis</option>
          {dados.filtros.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <button type="button" className="ov-botao" onClick={() => { limparBloqueio(); setModal("nova"); }}>
          <Plus aria-hidden />Nova oportunidade
        </button>
      </div>

      {bloqueio && !modal ? (
        <div style={{ marginBottom: "calc(14 * var(--onface-u))" }}><AvisoBloqueio bloqueio={bloqueio} /></div>
      ) : null}

      <ComPainel
        aberto={Boolean(selecionado)}
        painel={
          <PainelOportunidade
            op={op}
            timeline={detalhe?.timeline ?? []}
            pendente={pendente}
            bloqueio={bloqueio}
            motivoGanhoPendente={resultadoGanho}
            rotaBase={rotaBase}
            aoFechar={() => { setSelecionado(null); setDetalhe(null); limparBloqueio(); setResultadoGanho(null); }}
            aoAgir={(tipo) => { if (tipo === "criar_proposta") router.push(`${rotaBase}/propostas?oportunidade=${op?.id ?? ""}`); }}
            acoes={{
              mover: (para) => rodar(() => acoes.moverEtapa(op!.id, para), false),
              trial: (iniciar) => rodar(() => acoes.trial(op!.id, iniciar), false),
              noShow: () => rodar(() => acoes.noShow(op!.id, op!.reunioes[0]?.id ?? null), false),
              estagnar: (motivo) => rodar(() => acoes.marcarEstagnacao(op!.id, motivo), false),
              ganhar: tentarGanhar,
              abrirModal: setModal,
            }}
          />
        }
      >
        <Board>
          {dados.colunas.map((coluna) => (
            <Coluna
              key={coluna.chave}
              titulo={coluna.rotulo}
              total={coluna.total}
              carregados={coluna.cards.length}
              extra={coluna.valorTotal > 0 ? <span> · {moeda(coluna.valorTotal)}</span> : null}
            >
              {coluna.cards.length === 0 ? (
                <ColunaVazia>Nenhuma oportunidade nesta etapa.</ColunaVazia>
              ) : (
                coluna.cards.map((card) => (
                  <CardOportunidade key={card.id} card={card} selecionado={card.id === selecionado} aoAbrir={() => abrir(card.id)} />
                ))
              )}
            </Coluna>
          ))}
        </Board>
      </ComPainel>

      <DialogoPerder
        aberto={modal === "perder"} pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(motivo, detalhe) => rodar(() => acoes.perder(op!.id, motivo, detalhe))}
      />
      <DialogoFamilia
        aberto={modal === "familia"} atual={op?.familia ?? null} pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(familia, motivo) => rodar(() => acoes.alterarFamilia(op!.id, familia, motivo))}
      />
      <DialogoProximaAcao
        aberto={modal === "proxima"} atual={op?.proximaAcao ?? null} pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(descricao, quando) => rodar(() => acoes.definirProximaAcao(op!.id, descricao, quando))}
      />
      <DialogoReuniao
        aberto={modal === "reuniao"} temNoShow={Boolean(op?.noShow.em)} pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(data, tipo, reagendar) =>
          rodar(() => (reagendar ? acoes.reagendar(op!.id, data) : acoes.agendarReuniao(op!.id, data, tipo)))}
      />
      <DialogoNovaOportunidade
        aberto={modal === "nova"} responsaveis={dados.filtros.responsaveis}
        pendente={pendente} bloqueio={bloqueio}
        buscarEmpresas={acoes.buscarEmpresas}
        aoFechar={() => setModal(null)}
        aoConfirmar={(e) => rodar(() => acoes.criarOportunidade(e))}
      />
    </>
  );
}

/* ── Card ──────────────────────────────────────────────────────────────── */

function CardOportunidade({ card, selecionado, aoAbrir }: {
  card: CardPipeline; selecionado: boolean; aoAbrir: () => void;
}) {
  return (
    <button type="button" className="ov-card" data-selecionado={selecionado} onClick={aoAbrir}>
      <span className="ov-card-empresa">{card.empresa}</span>
      <span className="ov-card-pessoa">{card.familiaRotulo}</span>

      {/* O card mostra VALOR, não MRR: nem toda venda é recorrente. */}
      <span className="ov-card-valor">{moeda(card.valor)}</span>

      {card.proximaAcao ? (
        <span className="ov-card-pessoa">
          {card.proximaAcao}
          {card.proximaAcaoEm ? ` · ${dataCurta(card.proximaAcaoEm)}` : ""}
        </span>
      ) : null}

      {card.badges.length > 0 ? (
        <span className="ov-card-meta">
          {card.badges.map((b) => (
            <Tag key={b} tom={
              b === "No-show" || b === "Atrasado" || b === "Sem próxima ação" ? "alerta"
              : b === "Proposta aceita" ? "sucesso"
              : b === "Trial ativo" ? "info" : undefined
            }>{b}</Tag>
          ))}
        </span>
      ) : null}

      <span className="ov-card-rodape">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "calc(6 * var(--onface-u))" }}>
          {card.responsavelIniciais ? <span className="ov-avatar" aria-hidden>{card.responsavelIniciais}</span> : null}
          {card.responsavel ? card.responsavel.split(" ")[0] : "Sem responsável"}
        </span>
        <span>{card.diasNaEtapa === null ? "—" : `${card.diasNaEtapa}d na etapa`}</span>
      </span>
    </button>
  );
}

/* ── Painel ────────────────────────────────────────────────────────────── */

function PainelOportunidade({ op, timeline, pendente, bloqueio, motivoGanhoPendente, rotaBase, aoFechar, aoAgir, acoes }: {
  op: DetalheOportunidade | null;
  timeline: LinhaDoTempo[];
  pendente: boolean;
  bloqueio: { mensagem: string; acao?: { rotulo: string; tipo: string } } | null;
  motivoGanhoPendente: string | null;
  rotaBase: RotaBaseVendas;
  aoFechar: () => void;
  aoAgir: (tipo: string) => void;
  acoes: {
    mover: (para: EtapaPipelineAberta) => Promise<boolean>;
    trial: (iniciar: boolean) => Promise<boolean>;
    noShow: () => Promise<boolean>;
    estagnar: (motivo: MotivoEstagnacao | null) => Promise<boolean>;
    ganhar: () => Promise<boolean>;
    abrirModal: (m: "perder" | "familia" | "proxima" | "reuniao") => void;
  };
}) {
  if (!op) {
    return <Painel titulo="Carregando" aoFechar={aoFechar}><p className="ov-nota">Buscando a oportunidade…</p></Painel>;
  }

  const aberta = op.etapa !== "ganho" && op.etapa !== "perdido";
  const q = (op.qualificacaoHerdada ?? {}) as Record<string, string | undefined>;
  const emTrial = Boolean(op.trial.iniciadoEm && !op.trial.encerradoEm);

  return (
    <Painel titulo={op.titulo} subtitulo={`${op.empresa.nome} · ${op.familiaRotulo}`} aoFechar={aoFechar}>
      <div className="ov-card-meta">
        <Tag tom="coral">{op.etapaRotulo}</Tag>
        {op.motion ? <Tag>{op.motion === "EXPANSION" ? "Expansão" : "Novo negócio"}</Tag> : null}
        {op.badges.map((b) => <Tag key={b} tom="alerta">{b}</Tag>)}
      </div>
      <div className="ov-acoes">
        <Link className="ov-botao" data-variante="contorno" href={`${rotaBase}/pipeline/${op.id}`}>
          Abrir oportunidade
        </Link>
      </div>

      {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} aoAgir={aoAgir} /> : null}

      {motivoGanhoPendente ? (
        <AvisoBloqueio
          bloqueio={{
            mensagem: `Ainda não dá para fechar: ${motivoGanhoPendente}`,
            acao: op.propostas.length === 0 ? { rotulo: "Criar proposta", tipo: "criar_proposta" } : undefined,
          }}
          aoAgir={aoAgir}
        />
      ) : null}

      <Secao titulo="Números">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Valor">{moedaExata(op.valor)}</Campo>
          <Campo rotulo="Previsão">{dataCurta(op.previsaoFechamento)}</Campo>
          <Campo rotulo="Responsável">{op.responsavel.nome}</Campo>
          <Campo rotulo="Origem">{rotuloProcesso(op.sourceProcess)}</Campo>
        </dl>
      </Secao>

      {aberta ? (
        <Secao titulo="Mover para">
          <div className="ov-acoes">
            {ETAPAS_PIPELINE.filter((e) => e !== op.etapa).map((etapa) => (
              <button key={etapa} type="button" className="ov-botao" data-variante="contorno"
                disabled={pendente} onClick={() => acoes.mover(etapa)}>
                {ROTULO_ETAPA_PIPELINE[etapa]}
              </button>
            ))}
          </div>
          <p className="ov-nota">
            Proposta e Negociação exigem proposta vinculada. Ganho não se alcança movendo o card: ele depende da evidência de fechamento da família.
          </p>
        </Secao>
      ) : null}

      {aberta ? (
        <Secao titulo="Fechamento">
          <div className="ov-acoes">
            <button type="button" className="ov-botao" disabled={pendente} onClick={acoes.ganhar}>
              <Trophy aria-hidden />Tentar fechar como ganho
            </button>
            <button type="button" className="ov-botao" data-variante="perigo" disabled={pendente}
              onClick={() => acoes.abrirModal("perder")}>
              Marcar como perdida
            </button>
          </div>
        </Secao>
      ) : (
        <Secao titulo="Fechamento">
          <dl style={{ margin: 0 }}>
            <Campo rotulo="Resultado">{op.etapaRotulo}</Campo>
            {op.motivoPerda ? <Campo rotulo="Motivo">{rotuloPerda(op.motivoPerda)}</Campo> : null}
          </dl>
        </Secao>
      )}

      <Secao titulo="Próxima ação">
        {op.proximaAcao.descricao ? (
          <p className="ov-nota">
            <CalendarClock aria-hidden style={{ width: "calc(12 * var(--onface-u))", height: "calc(12 * var(--onface-u))", verticalAlign: "-2px" }} />
            {" "}{op.proximaAcao.descricao} · {dataHora(op.proximaAcao.quando)}
          </p>
        ) : (
          <p className="ov-nota">Sem próxima ação definida.</p>
        )}
        <div className="ov-acoes">
          <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
            onClick={() => acoes.abrirModal("proxima")}>Definir próxima ação</button>
        </div>
      </Secao>

      {aberta ? (
        <Secao titulo="Contexto">
          <div className="ov-acoes">
            <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
              onClick={() => acoes.abrirModal("reuniao")}>
              {op.noShow.em ? "Reagendar reunião" : "Agendar reunião"}
            </button>
            {op.reunioes.length > 0 && !op.noShow.em ? (
              <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
                onClick={acoes.noShow}>Registrar no-show</button>
            ) : null}
            <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
              onClick={() => acoes.trial(!emTrial)}>
              {emTrial ? "Encerrar trial" : "Iniciar trial"}
            </button>
            <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
              onClick={() => acoes.abrirModal("familia")}>Alterar família</button>
          </div>
          <select className="ov-select" value={op.motivoEstagnacao ?? ""} disabled={pendente}
            aria-label="Motivo de estagnação"
            onChange={(e) => acoes.estagnar((e.target.value || null) as MotivoEstagnacao | null)}>
            <option value="">Sem estagnação</option>
            {MOTIVOS_ESTAGNACAO.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
          </select>
        </Secao>
      ) : null}

      <Secao titulo="Propostas">
        {op.propostas.length === 0 ? (
          <>
            <p className="ov-nota">Nenhuma proposta vinculada.</p>
            <Link className="ov-botao" href={`${rotaBase}/propostas?oportunidade=${op.id}`}>
              <FileText aria-hidden />Criar proposta
            </Link>
          </>
        ) : (
          op.propostas.map((p) => (
            <Link key={p.id} className="ov-botao" data-variante="contorno"
              href={`${rotaBase}/propostas?proposta=${p.id}`}>
              #{p.numero} v{p.versao} · {p.status} · {moeda(p.total)}
            </Link>
          ))
        )}
      </Secao>

      {Object.keys(q).length > 0 ? (
        <Secao titulo="Qualificação herdada">
          <dl style={{ margin: 0 }}>
            <Campo rotulo="Dor">{q.dor}</Campo>
            <Campo rotulo="Necessidade">{q.necessidade}</Campo>
            <Campo rotulo="Urgência">{q.urgencia}</Campo>
            <Campo rotulo="Budget">{q.budget}</Campo>
            <Campo rotulo="Decisor">{q.decisor}</Campo>
            <Campo rotulo="Timing">{q.timing}</Campo>
          </dl>
        </Secao>
      ) : null}

      {op.irmas.length > 0 ? (
        <Secao titulo="Oportunidades relacionadas">
          <p className="ov-nota">Mesma negociação, ciclos independentes.</p>
          {op.irmas.map((i) => (
            <Link key={i.id} className="ov-botao" data-variante="contorno" href={`${rotaBase}/pipeline?oportunidade=${i.id}`}>
              <Users aria-hidden />{i.titulo}
            </Link>
          ))}
        </Secao>
      ) : null}

      {op.evidencias.length > 0 ? (
        <Secao titulo="Evidências de fechamento">
          <dl style={{ margin: 0 }}>
            {op.evidencias.map((e) => <Campo key={`${e.tipo}-${e.em}`} rotulo={e.tipo}>{dataCurta(e.em)}</Campo>)}
          </dl>
        </Secao>
      ) : null}

      <Secao titulo="Histórico">
        {timeline.length === 0 ? (
          <p className="ov-nota">Nenhum evento registrado.</p>
        ) : (
          <div className="ov-timeline">
            {timeline.map((e) => (
              <div className="ov-timeline-item" key={e.id}>
                <span className="ov-timeline-marca" aria-hidden />
                <div>
                  <strong>{rotuloEvento(e.tipo)}</strong>
                  <span>
                    {dataHora(e.ocorridoEm)}
                    {e.usuarioNome ? ` · ${e.usuarioNome}` : e.atorTipo !== "HUMAN" ? ` · ${rotuloAtor(e.atorTipo)}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>
    </Painel>
  );
}

/* ── Diálogos ──────────────────────────────────────────────────────────── */

function DialogoPerder({ aberto, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean; pendente: boolean; bloqueio: { mensagem: string } | null;
  aoFechar: () => void; aoConfirmar: (motivo: MotivoPerda, detalhe: string | null) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState<MotivoPerda>("sem_retorno");
  const [detalhe, setDetalhe] = useState("");
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Marcar oportunidade como perdida"
      descricao="O motivo estruturado é o que permite responder depois por que o pipeline perde, e em qual etapa.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label>
          <span>Motivo</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoPerda)}>
            {MOTIVOS_PERDA.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
          </select>
        </label>
        <label><span>Detalhe</span><textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} /></label>
        {motivo === "timing" ? (
          <p className="ov-nota">
            Perder por timing não apaga a conta: a oportunidade fica no histórico e a retomada é uma decisão futura, não automática.
          </p>
        ) : null}
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" data-variante="perigo" disabled={pendente}
            onClick={() => aoConfirmar(motivo, detalhe.trim() || null)}>Marcar como perdida</button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoFamilia({ aberto, atual, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean; atual: string | null; pendente: boolean; bloqueio: { mensagem: string } | null;
  aoFechar: () => void; aoConfirmar: (familia: Familia, motivo: string | null) => Promise<boolean>;
}) {
  const [familia, setFamilia] = useState<Familia>("CALLFACE_AI");
  const [motivo, setMotivo] = useState("");
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Alterar família"
      descricao="A família define o catálogo das próximas propostas. Propostas já enviadas não são reescritas.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <p className="ov-nota">Atual: {atual ? (ROTULO_FAMILIA[atual as keyof typeof ROTULO_FAMILIA] ?? atual) : "não classificada"}</p>
        <div className="ov-familias">
          {FAMILIAS.map((f) => (
            <button key={f} type="button" className="ov-familia" data-marcada={familia === f} onClick={() => setFamilia(f)}>
              {ROTULO_FAMILIA[f]}
            </button>
          ))}
        </div>
        <label><span>Motivo (opcional)</span><input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente}
            onClick={() => aoConfirmar(familia, motivo.trim() || null)}>Alterar família</button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoProximaAcao({ aberto, atual, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean; atual: { descricao: string | null; quando: string | null } | null;
  pendente: boolean; bloqueio: { mensagem: string } | null;
  aoFechar: () => void; aoConfirmar: (descricao: string | null, quando: string | null) => Promise<boolean>;
}) {
  const [descricao, setDescricao] = useState(atual?.descricao ?? "");
  const [quando, setQuando] = useState("");
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Próxima ação"
      descricao="Oportunidade sem próxima ação é o primeiro sinal de estagnação — por isso ela aparece no card.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label><span>O que vem agora</span><input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Enviar proposta revisada" /></label>
        <label><span>Quando</span><input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro"
            onClick={() => aoConfirmar(null, null)}>Limpar</button>
          <button type="button" className="ov-botao" disabled={pendente || !descricao.trim()}
            onClick={() => aoConfirmar(descricao.trim(), quando || null)}>Salvar</button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoReuniao({ aberto, temNoShow, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean; temNoShow: boolean; pendente: boolean; bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (data: string, tipo: "call" | "presencial" | "video", reagendar: boolean) => Promise<boolean>;
}) {
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState<"call" | "presencial" | "video">("call");
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar}
      titulo={temNoShow ? "Reagendar reunião" : "Agendar reunião"}
      descricao={temNoShow
        ? "O reagendamento reutiliza a MESMA oportunidade: no-show não abre um processo comercial novo."
        : "Reunião é evento da oportunidade, não etapa do pipeline."}>
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label><span>Data e hora</span><input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label>
          <span>Formato</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="call">Call</option>
            <option value="video">Vídeo</option>
            <option value="presencial">Presencial</option>
          </select>
        </label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !data}
            onClick={() => aoConfirmar(data, tipo, temNoShow)}>
            {temNoShow ? "Reagendar" : "Agendar"}
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoNovaOportunidade({ aberto, responsaveis, pendente, bloqueio, buscarEmpresas, aoFechar, aoConfirmar }: {
  aberto: boolean;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  buscarEmpresas: (termo: string) => Promise<Array<{ id: string; nome: string; apoio: string | null }>>;
  aoFechar: () => void;
  aoConfirmar: (e: { empresaId: string; familias: Familia[]; responsavelId: string; titulo?: string | null; valorEstimado?: string | null }) => Promise<boolean>;
}) {
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<Array<{ id: string; nome: string; apoio: string | null }>>([]);
  const [empresa, setEmpresa] = useState<{ id: string; nome: string } | null>(null);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [responsavelId, setResponsavelId] = useState("");
  const [valor, setValor] = useState("");

  async function procurar(v: string) {
    setTermo(v);
    setEmpresa(null);
    setOpcoes(v.trim().length >= 2 ? await buscarEmpresas(v) : []);
  }

  function alternar(f: Familia) {
    setFamilias((a) => a.includes(f) ? a.filter((x) => x !== f) : [...a, f]);
  }

  const pronto = Boolean(empresa) && familias.length > 0 && Boolean(responsavelId);

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Nova oportunidade"
      descricao="Pode nascer sem lead de Pré-vendas, mas nunca sem Empresa e sem Família." largura="larga">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label>
          <span>Empresa</span>
          <input value={empresa?.nome ?? termo} onChange={(e) => procurar(e.target.value)} placeholder="Buscar empresa existente" />
        </label>
        {opcoes.length > 0 && !empresa ? (
          <div className="ov-familias">
            {opcoes.map((o) => (
              <button key={o.id} type="button" className="ov-familia"
                onClick={() => { setEmpresa({ id: o.id, nome: o.nome }); setOpcoes([]); }}>
                {o.nome}{o.apoio ? ` · ${o.apoio}` : ""}
              </button>
            ))}
          </div>
        ) : null}

        <div>
          <span style={{ display: "block", marginBottom: "calc(6 * var(--onface-u))", color: "var(--text-muted, #666e7d)", fontSize: "calc(10.5 * var(--onface-u))", fontWeight: 700, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" }}>
            Família comercial
          </span>
          <div className="ov-familias">
            {FAMILIAS.map((f) => (
              <button key={f} type="button" className="ov-familia" data-marcada={familias.includes(f)} onClick={() => alternar(f)}>
                {ROTULO_FAMILIA[f]}
              </button>
            ))}
          </div>
          {familias.length > 1 ? (
            <p className="ov-nota" style={{ marginTop: "calc(6 * var(--onface-u))" }}>
              {familias.length} oportunidades irmãs, com fechamento independente.
            </p>
          ) : null}
        </div>

        <div className="ov-form-linha">
          <label>
            <span>Responsável comercial</span>
            <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              <option value="">Escolha</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
          <label><span>Valor estimado</span><input type="number" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
        </div>

        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !pronto}
            onClick={() => aoConfirmar({
              empresaId: empresa!.id, familias, responsavelId,
              valorEstimado: valor ? Number(valor).toFixed(2) : null,
            })}>
            <ArrowRight aria-hidden />Criar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

/* ── Rótulos ───────────────────────────────────────────────────────────── */

/**
 * Rótulo de origem do processo comercial.
 *
 * Exportado porque a página da oportunidade mostrava `sourceProcess` cru, e o
 * banco chegou a guardar `BACKFILL_07` nessa coluna: lia-se "Origem:
 * BACKFILL_07" na tela. O dado foi corrigido na migration 0079, e o valor cru
 * deixou de aparecer em tela para o próximo valor inesperado não vazar também.
 */
export function rotuloProcesso(processo: string | null): string {
  switch (processo) {
    case "PRE_SALES": return "Pré-vendas";
    case "OUTBOUND_DIRECT": return "Prospecção direta";
    case "MANUAL": return "Criação manual";
    case "EXPANSION": return "Carteira / expansão";
    default: return "—";
  }
}

function rotuloPerda(chave: string): string {
  return MOTIVOS_PERDA.find((m) => m.chave === chave)?.rotulo ?? chave;
}
