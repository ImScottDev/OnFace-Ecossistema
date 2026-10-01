"use client";

/**
 * Prospecção (Bloco 04).
 *
 * Workspace de outbound, não um segundo Pipeline. Duas visualizações da MESMA
 * base — lista para operar em massa, kanban para ler o estado — e duas saídas
 * que nunca se confundem:
 *
 *   Pré-qualificado    → cria Lead em Pré-vendas / Novo
 *   Oportunidade direta → cria Opportunity em Pipeline / Entrada
 *
 * A correção conceitual do bloco é justamente essa: ter oportunidade deixou de
 * significar que o prospect foi qualificado.
 */

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus, Search, Send, Upload, Users, X } from "lucide-react";
import type { LinhaProspeccao } from "@/lib/vendas/consultas";
import {
  ESTADOS_PROSPECCAO, FAMILIAS, MOTIVOS_DESCARTE, ROTULO_ESTADO_PROSPECCAO, ROTULO_FAMILIA,
  type EstadoProspeccao, type Familia, type MotivoDescarte,
} from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";
import {
  Abas, AvisoBloqueio, Board, Busca, Coluna, ColunaVazia, Dialogo, Tag, dataCurta, useAcao,
} from "./ui";
import {
  acoesEmMassaDisponiveis, lerCsvProspects, montarPayloadMassa, montarUrlProspeccao,
  resumirExecucaoEmMassa, type LinhaCsvProspect, type OperacaoMassa,
} from "./prospeccao-acoes";
import "./prospeccao.css";

export interface AcoesProspeccao {
  adicionar: (e: EntradaProspect) => Promise<Resultado<{ leadId: string; jaExistia: boolean }>>;
  /** Opcional: o espelho em /onface-desenho não liga importação. */
  importar?: (linhas: LinhaCsvProspect[], comum: { lista?: string | null; responsavelId?: string | null; fonte?: string | null }) => Promise<Resultado<{ criados: number; jaExistiam: number; falhas: number }>>;
  inscreverEmCadencia: (leadId: string, cadenciaId: string) => Promise<Resultado>;
  pausarCadencia: (leadId: string, motivo: string) => Promise<Resultado>;
  registrarResposta: (leadId: string, canal: string | null) => Promise<Resultado>;
  marcarSemResposta: (leadId: string) => Promise<Resultado>;
  preQualificar: (leadId: string) => Promise<Resultado>;
  oportunidadeDireta: (leadId: string, familias: Familia[], responsavelId: string) => Promise<Resultado<{ ids: string[] }>>;
  descartar: (leadId: string, motivo: MotivoDescarte) => Promise<Resultado>;
  atribuirEmMassa: (leadIds: string[], responsavelId: string | null) => Promise<Resultado<{ aplicados: number; falhas: number }>>;
}

export interface EntradaProspect {
  empresa: string;
  cnpj?: string | null;
  website?: string | null;
  pessoaNome?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  fonte?: string | null;
  lista?: string | null;
  responsavelId?: string | null;
}

const COLUNAS_OPERACIONAIS: EstadoProspeccao[] = ["novo", "em_cadencia", "respondeu"];

/* Abas de estado sempre visíveis: as três operacionais + as duas saídas. Os
 * desfechos de cauda (sem resposta, descartado) só ganham aba quando existem,
 * para a barra não virar uma régua de zeros. */
/** Estados em que o outbound ainda opera; os demais são desfechos gravados. */
const ESTADOS_ATIVOS: EstadoProspeccao[] = ["novo", "em_cadencia", "respondeu", "sem_resposta"];
const SAIDA_TEXTO: Partial<Record<EstadoProspeccao, string>> = {
  pre_qualificado: "Já foi entregue a Pré-vendas. Daqui em diante ela segue a jornada de qualificação lá.",
  oportunidade: "Virou oportunidade direta e está no Pipeline. A prospecção desta empresa terminou.",
  descartado: "Foi descartada da prospecção. O motivo fica no histórico do lead.",
};

const ABAS_FIXAS: EstadoProspeccao[] = ["novo", "em_cadencia", "respondeu", "pre_qualificado", "oportunidade"];

function iniciais(nome: string): string {
  // Só letras e dígitos: "Iasbeck & Co" virava "I&" e "BCORP | O Sistema", "B|".
  return nome.split(/\s+/).map((p) => p.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean)
    .slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "—";
}

/** Tom do selo por estado, no vocabulário de etapas do DS (--of-etapa-*). */
const TOM_ESTADO: Record<EstadoProspeccao, string> = {
  novo: "novo", em_cadencia: "contato", respondeu: "oportunidade", pre_qualificado: "qualificado",
  oportunidade: "oportunidade", sem_resposta: "nutricao", descartado: "desqualificado",
};

/** Motivo pelo qual uma ação em massa não pode rodar agora, ou null. */
function motivoMassaIndisponivel(
  chave: OperacaoMassa, cadencias: number, selecionadasEmCadencia: number, motivoSemEnriquecer: string | null,
): string | null {
  if (chave === "cadencia" && cadencias === 0) return "Nenhuma cadência ativa. Crie uma em Automações › Cadências.";
  if (chave === "pausar" && selecionadasEmCadencia === 0) return "Nenhuma empresa selecionada está em cadência.";
  if (chave === "enriquecer" && motivoSemEnriquecer) return motivoSemEnriquecer;
  return null;
}

export function Prospeccao({ dados, filtro, visao, cadencias, responsaveis, acoes, motivoSemEnriquecer = null }: {
  dados: {
    linhas: LinhaProspeccao[];
    resumo: Record<EstadoProspeccao, number>;
    filtros: { responsaveis: Array<{ id: string; nome: string }>; listas: string[] };
  };
  filtro: { busca: string; estado: EstadoProspeccao | null; responsavelId: string | null; lista: string | null };
  visao: "lista" | "kanban";
  cadencias: Array<{ id: string; nome: string }>;
  responsaveis: Array<{ id: string; nome: string }>;
  acoes: AcoesProspeccao;
  /** null = enriquecer disponível; texto = por que não. */
  motivoSemEnriquecer?: string | null;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [busca, setBusca] = useState(filtro.busca);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [alvo, setAlvo] = useState<LinhaProspeccao | null>(null);
  const [modal, setModal] = useState<null | "novo" | "importar" | "cadencia" | "oportunidade" | "descartar" | "massa">(null);
  const [operacaoMassa, setOperacaoMassa] = useState<OperacaoMassa | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();
  // O comando grava o NOME DA EMPRESA no lead quando o prospect entra sem
  // pessoa (a coluna é obrigatória). Mostrar isso como "contato" inventaria
  // uma pessoa; aqui ele volta a ser o que é: ninguém associado ainda.
  const linhas = dados.linhas.map((l) => (l.pessoa && l.pessoa === l.empresa ? { ...l, pessoa: null } : l));

  function navegar(mudancas: Record<string, string | null>) {
    iniciarNavegacao(() => router.push(montarUrlProspeccao(window.location.href, mudancas)));
  }

  // `mensagem` pode ser função: a importação só sabe o que dizer ("12
  // adicionadas, 3 já estavam") depois que o servidor responde.
  async function rodar(fn: () => Promise<Resultado<unknown>>, mensagem: string | (() => string) = "Alteração salva.") {
    // O desfecho vem do próprio `executar` desde 19/09: antes a confirmação
    // era capturada numa variável por efeito colateral dentro do callback,
    // porque o retorno não distinguia sucesso sem dado de falha.
    const desfecho = await executar(async () => (await fn()) as Resultado<unknown>);
    const confirmou = desfecho.ok;
    if (confirmou) {
      setModal(null);
      setAlvo(null);
      setSucesso(typeof mensagem === "function" ? mensagem() : mensagem);
      router.refresh();
    }
    return confirmou;
  }

  async function resultadoApi(url: string, init: RequestInit): Promise<Resultado> {
    try {
      const resposta = await fetch(url, init);
      const corpo = await resposta.json().catch(() => ({}));
      return resposta.ok ? { ok: true } : { ok: false, erro: corpo.error ?? "A operação não pôde ser concluída." };
    } catch {
      return { ok: false, erro: "Não foi possível falar com o CRM. Tente novamente." };
    }
  }

  async function localizarOuCriarTag(nome: string): Promise<Resultado<{ id: string }>> {
    const existentes = await fetch("/api/labels");
    const tags = await existentes.json().catch(() => []);
    if (!existentes.ok || !Array.isArray(tags)) return { ok: false, erro: "Não foi possível carregar as tags." };
    const encontrada = tags.find((tag: { id: string; nome: string }) => tag.nome.toLowerCase() === nome.toLowerCase());
    if (encontrada) return { ok: true, dados: { id: encontrada.id } };
    const criada = await resultadoApi("/api/labels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cor: "#2563EB" }),
    });
    if (!criada.ok) return criada;
    const nova = await fetch("/api/labels");
    const novasTags = await nova.json().catch(() => []);
    const criadaAgora = Array.isArray(novasTags) && novasTags.find((tag: { id: string; nome: string }) => tag.nome.toLowerCase() === nome.toLowerCase());
    return criadaAgora ? { ok: true, dados: { id: criadaAgora.id } } : { ok: false, erro: "A tag foi criada, mas não pôde ser localizada." };
  }

  /**
   * Lista e tag compartilham a mesma tabela `labels`: a lista exibida na
   * Prospecção é a etiqueta do lead. Por isso os dois caminhos terminam aqui,
   * cada um com o nome que o usuário digitou no seu próprio campo.
   */
  async function aplicarLabelEmMassa(nome: string): Promise<Resultado> {
    const tag = await localizarOuCriarTag(nome);
    if (!tag.ok) return tag;
    if (!tag.dados) return { ok: false, erro: "A tag foi criada, mas não pôde ser localizada." };
    const labelId = tag.dados.id;
    const resultados = await Promise.all(selecionados.map((leadId) => resultadoApi(`/api/leads/${leadId}/labels`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labelId }),
    })));
    const resumo = resumirExecucaoEmMassa(resultados);
    return resumo.ok ? { ok: true } : { ok: false, erro: resumo.mensagem };
  }

  async function executarEmMassa(valor: string | null): Promise<Resultado> {
    if (!operacaoMassa) return { ok: false, erro: "Escolha uma ação em massa." };
    const payload = montarPayloadMassa(operacaoMassa, valor);
    switch (payload.tipo) {
      case "invalido":
        return { ok: false, erro: payload.erro };
      case "responsavel": {
        const resultado = await acoes.atribuirEmMassa(selecionados, payload.responsavelId);
        return resultado.ok ? { ok: true } : resultado;
      }
      case "cadencia": {
        const resultados = await Promise.all(selecionados.map((leadId) => acoes.inscreverEmCadencia(leadId, payload.cadenceDefinitionId)));
        const resumo = resumirExecucaoEmMassa(resultados);
        return resumo.ok ? { ok: true } : { ok: false, erro: resumo.mensagem };
      }
      case "pausar": {
        const resultados = await Promise.all(selecionados.map((leadId) => acoes.pausarCadencia(leadId, "Pausado em massa")));
        const resumo = resumirExecucaoEmMassa(resultados);
        return resumo.ok ? { ok: true } : { ok: false, erro: resumo.mensagem };
      }
      case "enriquecer":
        return resultadoApi("/api/leads/enrich-bulk", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filter: "selected", ids: selecionados }),
        });
      case "lista":
      case "tag":
        return aplicarLabelEmMassa(payload.nome);
    }
  }

  function alternarSelecao(id: string) {
    setSelecionados((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  }

  const totalBase = ESTADOS_PROSPECCAO.reduce((n, e) => n + (dados.resumo[e] ?? 0), 0);
  const abas = ESTADOS_PROSPECCAO.filter((e) => ABAS_FIXAS.includes(e) || (dados.resumo[e] ?? 0) > 0);
  const temFiltro = Boolean(filtro.busca || filtro.responsavelId || filtro.lista);
  const idsVisiveis = linhas.map((l) => l.leadId);
  const todasMarcadas = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.includes(id));
  const selecionadasEmCadencia = linhas.filter((l) => selecionados.includes(l.leadId) && l.estado === "em_cadencia").length;
  const tituloCartao = filtro.estado ? ROTULO_ESTADO_PROSPECCAO[filtro.estado] : "Base outbound";
  const subCartao = filtro.estado === "pre_qualificado"
    ? "entregues a Pré-vendas, na etapa Novo"
    : filtro.estado === "oportunidade"
      ? "foram direto ao Pipeline, sem passar por Pré-vendas"
      : "empresas em prospecção · pré-qualificar entrega a Pré-vendas, oportunidade vai direto ao Pipeline";
  // O corte de 400 vem da consulta; a tela diz quando ele mordeu em vez de
  // sugerir que a base acaba ali.
  const totalDoRecorte = filtro.estado ? dados.resumo[filtro.estado] ?? 0 : totalBase;
  const contaCartao = !temFiltro && linhas.length < totalDoRecorte
    ? `${linhas.length} de ${totalDoRecorte} empresas`
    : `${linhas.length} ${linhas.length === 1 ? "empresa" : "empresas"}`;

  return (
    <div className="pp">
      <div className="pp-barra">
        <form className="pp-busca" role="search" onSubmit={(e) => { e.preventDefault(); navegar({ busca: busca.trim() || null }); }}>
          <Search aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Empresa ou pessoa"
            aria-label="Buscar empresa ou pessoa" />
          {busca ? (
            <button type="button" className="pp-busca-limpar" aria-label="Limpar busca"
              onClick={() => { setBusca(""); navegar({ busca: null }); }}><X aria-hidden /></button>
          ) : null}
        </form>
        <label className="pp-filtro" data-on={Boolean(filtro.responsavelId)}>
          <Users aria-hidden />
          <select value={filtro.responsavelId ?? ""} aria-label="Filtrar por responsável"
            onChange={(e) => navegar({ responsavel: e.target.value || null })}>
            <option value="">Responsável</option>
            {dados.filtros.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <label className="pp-filtro" data-on={Boolean(filtro.lista)}>
          <List aria-hidden />
          <select value={filtro.lista ?? ""} aria-label="Filtrar por lista" disabled={dados.filtros.listas.length === 0}
            title={dados.filtros.listas.length === 0 ? "Nenhuma lista criada ainda. Listas nascem ao adicionar ou importar empresas." : undefined}
            onChange={(e) => { setSelecionados([]); navegar({ lista: e.target.value || null }); }}>
            <option value="">{dados.filtros.listas.length === 0 ? "Sem listas" : "Lista"}</option>
            {dados.filtros.listas.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {temFiltro ? (
          <button type="button" className="pp-limpar"
            onClick={() => { setBusca(""); setSelecionados([]); navegar({ busca: null, responsavel: null, lista: null }); }}>
            Limpar
          </button>
        ) : null}
        <span className="pp-mola" />
        <div className="pp-seg" role="tablist" aria-label="Visualização">
          <button type="button" role="tab" aria-selected={visao === "lista"} data-on={visao === "lista"}
            onClick={() => navegar({ visao: null })}><List aria-hidden />Lista</button>
          <button type="button" role="tab" aria-selected={visao === "kanban"} data-on={visao === "kanban"}
            onClick={() => navegar({ visao: "kanban" })}><LayoutGrid aria-hidden />Kanban</button>
        </div>
        <Link href="/prospeccao/apollo" className="pp-secundario" aria-label="Buscar no Apollo" title="Buscar pessoas no Apollo e importar para a prospecção">
          <Search aria-hidden />Apollo
        </Link>
        {acoes.importar ? (
          <button type="button" className="pp-secundario" onClick={() => { limparBloqueio(); setModal("importar"); }}>
            <Upload aria-hidden />Importar
          </button>
        ) : null}
        <button type="button" className="pp-primario" onClick={() => { limparBloqueio(); setModal("novo"); }}>
          <Plus aria-hidden />Adicionar empresa
        </button>
      </div>

      <div className="pp-abas" role="tablist" aria-label="Estado da prospecção">
        <button type="button" role="tab" aria-selected={!filtro.estado} data-on={!filtro.estado}
          onClick={() => { setSelecionados([]); navegar({ estado: null }); }}>
          Todos<span className="pp-conta">{totalBase}</span>
        </button>
        {abas.map((e) => (
          <button key={e} type="button" role="tab" aria-selected={filtro.estado === e} data-on={filtro.estado === e}
            // Quem respondeu e ninguém tocou é o lead mais quente parado do
            // funil: é o único contador que acende em coral.
            data-sinal={e === "respondeu" && (dados.resumo[e] ?? 0) > 0}
            onClick={() => { setSelecionados([]); navegar({ estado: e }); }}>
            {ROTULO_ESTADO_PROSPECCAO[e]}<span className="pp-conta">{dados.resumo[e] ?? 0}</span>
          </button>
        ))}
      </div>

      {bloqueio && !modal ? <div className="pp-aviso"><AvisoBloqueio bloqueio={bloqueio} /></div> : null}
      {sucesso ? (
        <p className="pp-ok" role="status">
          {sucesso}
          <button type="button" aria-label="Fechar aviso" onClick={() => setSucesso(null)}><X aria-hidden /></button>
        </p>
      ) : null}

      <div className="pp-corpo">
        <section className="pp-cartao" aria-label={tituloCartao}>
          <header className="pp-cartao-cab">
            <h1 className="pp-cartao-titulo">{tituloCartao}</h1>
            <span className="pp-cartao-sub">{subCartao}</span>
            <span className="pp-cartao-conta">{contaCartao}</span>
          </header>

          {visao === "kanban" ? (
            <div className="pp-kanban">
              <Board>
                {COLUNAS_OPERACIONAIS.map((estado) => {
                  const daColuna = linhas.filter((l) => l.estado === estado);
                  return (
                    <Coluna key={estado} titulo={ROTULO_ESTADO_PROSPECCAO[estado]}
                      total={dados.resumo[estado] ?? 0} carregados={daColuna.length}>
                      {daColuna.length === 0 ? (
                        <ColunaVazia>Nenhuma empresa neste estado.</ColunaVazia>
                      ) : (
                        daColuna.map((l) => (
                          <button key={l.leadId} type="button" className="ov-card" onClick={() => setAlvo(l)}>
                            <span className="ov-card-empresa">{l.empresa}</span>
                            <span className="ov-card-pessoa">
                              {l.pessoa ? `${l.pessoa}${l.cargo ? ` · ${l.cargo}` : ""}` : "Sem pessoa associada"}
                            </span>
                            <span className="ov-card-meta">
                              {l.setor ? <Tag>{l.setor}</Tag> : null}
                              {l.lista ? <Tag tom="info">{l.lista}</Tag> : null}
                              {l.preQualificado && l.estado !== "pre_qualificado" ? <Tag tom="sucesso">Pré-qualificado</Tag> : null}
                            </span>
                            {l.cadencia ? (
                              <span className="ov-card-pessoa">
                                {l.cadencia}{l.totalPassos ? ` · ${l.totalPassos} passos` : ""}
                              </span>
                            ) : null}
                            <span className="ov-card-rodape">
                              <span>{l.responsavel ?? "Sem responsável"}</span>
                              <span>{dataCurta(l.proximaAcaoEm)}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </Coluna>
                  );
                })}
              </Board>
            </div>
          ) : (
            <div className="pp-rolagem">
              <div className="pp-grade" role="table" aria-label="Empresas em prospecção">
                <div className="pp-linha pp-linha-cab" role="row">
                  <span role="columnheader">
                    <input type="checkbox" className="pp-check" checked={todasMarcadas} aria-label="Selecionar todas as visíveis"
                      disabled={idsVisiveis.length === 0}
                      onChange={() => setSelecionados(todasMarcadas ? [] : idsVisiveis)} />
                  </span>
                  <span role="columnheader">EMPRESA</span>
                  <span role="columnheader">CONTATO</span>
                  <span role="columnheader">ESTADO</span>
                  <span role="columnheader">CADÊNCIA</span>
                  <span role="columnheader">LISTA</span>
                  <span role="columnheader">RESPONSÁVEL</span>
                </div>
                {linhas.length === 0 ? (
                  <div className="pp-vazio">
                    <strong>{temFiltro || filtro.estado ? "Nada com esses filtros" : "A base outbound está vazia"}</strong>
                    <p>{temFiltro || filtro.estado
                      ? "Troque o estado ou limpe a busca para ver outras empresas."
                      : "Adicione uma empresa, importe um CSV ou busque no Apollo para começar a prospectar."}</p>
                  </div>
                ) : linhas.map((l) => (
                  <div key={l.leadId} role="row" tabIndex={0} className="pp-linha"
                    data-marcada={selecionados.includes(l.leadId)} data-aberta={alvo?.leadId === l.leadId}
                    onClick={() => setAlvo(l)}
                    onKeyDown={(e) => { if (e.key === "Enter") setAlvo(l); }}>
                    <span role="cell" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="pp-check" checked={selecionados.includes(l.leadId)}
                        onChange={() => alternarSelecao(l.leadId)} aria-label={`Selecionar ${l.empresa}`} />
                    </span>
                    <span role="cell" className="pp-nome">
                      <span className="pp-avatar" aria-hidden>{iniciais(l.empresa)}</span>
                      <span className="pp-nome-texto">
                        <span className="pp-principal">{l.empresa}</span>
                        <span className="pp-apoio">{[l.setor, l.porte].filter(Boolean).join(" · ") || "Setor não informado"}</span>
                      </span>
                    </span>
                    <span role="cell" className="pp-nome-texto">
                      <span className="pp-secundaria">{l.pessoa ?? "Sem pessoa"}</span>
                      <span className="pp-apoio">{l.cargo ?? "—"}</span>
                    </span>
                    <span role="cell">
                      <span className="pp-selo" data-tom={TOM_ESTADO[l.estado]}>
                        <span className="pp-selo-ponto" aria-hidden />{l.estadoRotulo}
                      </span>
                    </span>
                    <span role="cell" className="pp-apoio-cel">
                      {l.cadencia ? `${l.cadencia}${l.totalPassos ? ` · ${l.totalPassos} passos` : ""}` : "—"}
                    </span>
                    <span role="cell" className="pp-apoio-cel">{l.lista ?? "—"}</span>
                    <span role="cell" className="pp-resp">
                      {l.responsavel ? (
                        <><span className="pp-avatar-mini" aria-hidden>{iniciais(l.responsavel)}</span>{l.responsavel}</>
                      ) : <span className="pp-sem">Sem responsável</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Barra de seleção no rodapé, no vocabulário da barra de Pré-vendas:
          grafite, contagem em coral, ações com motivo quando indisponíveis. */}
      {selecionados.length > 0 ? (
        <div className="pp-selecao" role="toolbar" aria-label="Ações em massa">
          <span className="pp-selecao-conta">{selecionados.length}</span>
          <span className="pp-selecao-rotulo">{selecionados.length === 1 ? "selecionada" : "selecionadas"}</span>
          <span className="pp-selecao-fio" />
          {acoesEmMassaDisponiveis().map((acao) => {
            const motivo = motivoMassaIndisponivel(acao.chave, cadencias.length, selecionadasEmCadencia, motivoSemEnriquecer);
            return (
              <button key={acao.chave} type="button" className="pp-selecao-acao" disabled={Boolean(motivo)}
                title={motivo ?? undefined} aria-label={motivo ? `${acao.rotulo} — ${motivo}` : acao.rotulo}
                onClick={() => { limparBloqueio(); setOperacaoMassa(acao.chave); setModal("massa"); }}>
                {acao.rotulo}
              </button>
            );
          })}
          <button type="button" className="pp-selecao-limpar" aria-label="Limpar seleção" onClick={() => setSelecionados([])}>
            <X aria-hidden />
          </button>
        </div>
      ) : null}

      {/* Ações do prospect escolhido. Ficam num diálogo em vez de um painel
          porque a lista precisa da largura inteira para operar em massa. */}
      <Dialogo aberto={Boolean(alvo) && !modal} aoFechar={() => { setAlvo(null); limparBloqueio(); }}
        titulo={alvo?.empresa ?? ""}
        descricao={alvo?.pessoa ? `${alvo.pessoa}${alvo.cargo ? ` · ${alvo.cargo}` : ""}` : "Sem pessoa associada"}>
        <div className="ov-form">
          {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
          <div className="ov-card-meta">
            {alvo ? (
              <span className="pp-selo" data-tom={TOM_ESTADO[alvo.estado]}>
                <span className="pp-selo-ponto" aria-hidden />{alvo.estadoRotulo}
              </span>
            ) : null}
            {alvo?.lista ? <Tag tom="info">{alvo.lista}</Tag> : null}
            {/* A marca só informa algo quando o estado atual já é outro
                (ex.: pré-qualificado que depois virou oportunidade). */}
            {alvo?.preQualificado && alvo.estado !== "pre_qualificado" ? <Tag tom="sucesso">Pré-qualificado</Tag> : null}
          </div>

          {alvo && !ESTADOS_ATIVOS.includes(alvo.estado) ? (
            // Desfecho já gravado. O domínio não tem máquina de estados e
            // aceitaria "sem resposta" num pré-qualificado, tirando-o da fila de
            // Pré-vendas sem ninguém perceber; a tela não oferece o que
            // desfaria a saída e aponta para onde o registro vive agora.
            <>
              <p className="ov-nota">{SAIDA_TEXTO[alvo.estado]}</p>
              <div className="ov-acoes">
                {alvo.estado === "pre_qualificado" ? <Link className="ov-botao" href="/pre-vendas">Abrir Pré-vendas</Link> : null}
                {alvo.estado === "oportunidade" ? <Link className="ov-botao" href="/pipeline">Abrir Pipeline</Link> : null}
                {alvo.empresaId ? (
                  <Link className="ov-botao" data-variante="contorno" href={`/empresas/${alvo.empresaId}`}>Ver empresa</Link>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="ov-nota">
                Pré-qualificar entrega a empresa para a jornada de Pré-vendas, na etapa Novo.
                Criar oportunidade vai direto ao Pipeline e registra a origem como prospecção direta.
                São caminhos diferentes, e o sistema não finge que um é o outro.
              </p>

              <div className="ov-acoes">
                {/* lib/vendas/prospeccao.ts lança prospect_sem_empresa nos dois caminhos;
                    o import do Apollo traz pessoas sem organização (empresaId nulo). */}
                <button type="button" className="ov-botao" disabled={pendente || !alvo?.empresaId}
                  title={!alvo?.empresaId ? "Prospect sem empresa: vincule uma empresa antes" : undefined}
                  onClick={() => rodar(() => acoes.preQualificar(alvo!.leadId), `${alvo!.empresa} entregue a Pré-vendas, na etapa Novo.`)}>
                  <Send aria-hidden />Pré-qualificar
                </button>
                <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente || !alvo?.empresaId}
                  title={!alvo?.empresaId ? "Prospect sem empresa: vincule uma empresa antes" : undefined}
                  onClick={() => setModal("oportunidade")}>
                  Criar oportunidade
                </button>
                <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente || cadencias.length === 0}
                  title={cadencias.length === 0 ? "Nenhuma cadência ativa. Crie uma em Automações › Cadências." : undefined}
                  onClick={() => setModal("cadencia")}>
                  Adicionar à cadência
                </button>
                {alvo?.estado === "em_cadencia" ? (
                  <>
                    <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
                      onClick={() => rodar(() => acoes.registrarResposta(alvo.leadId, null), "Resposta registrada.")}>
                      Registrar resposta
                    </button>
                    <button type="button" className="ov-botao" data-variante="neutro" disabled={pendente}
                      onClick={() => rodar(() => acoes.pausarCadencia(alvo.leadId, "Pausado manualmente"), "Cadência pausada.")}>
                      Pausar cadência
                    </button>
                  </>
                ) : null}
                {alvo?.estado !== "sem_resposta" ? (
                  <button type="button" className="ov-botao" data-variante="neutro" disabled={pendente}
                    onClick={() => rodar(() => acoes.marcarSemResposta(alvo!.leadId), "Marcada como sem resposta.")}>
                    Sem resposta
                  </button>
                ) : null}
                <button type="button" className="ov-botao" data-variante="perigo" disabled={pendente}
                  onClick={() => setModal("descartar")}>
                  Descartar
                </button>
              </div>
              {cadencias.length === 0 ? (
                <p className="ov-nota">Nenhuma cadência ativa: crie uma em Automações › Cadências para inscrever empresas.</p>
              ) : null}
              {alvo?.empresaId ? (
                <Link className="pp-link" href={`/empresas/${alvo.empresaId}`}>Ver empresa 360</Link>
              ) : null}
            </>
          )}
        </div>
      </Dialogo>

      <DialogoNovoProspect
        aberto={modal === "novo"} listas={dados.filtros.listas} responsaveis={responsaveis}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(e) => {
          let msg = `${e.empresa.trim()} adicionada à base outbound.`;
          return rodar(async () => {
            const r = await acoes.adicionar(e);
            // Empresa repetida não é erro: o comando reaproveita, e a tela diz.
            if (r.ok && r.dados?.jaExistia) msg = `${e.empresa.trim()} já estava na base; nada foi duplicado.`;
            return r;
          }, () => msg);
        }}
      />

      <Dialogo aberto={modal === "cadencia"} aoFechar={() => setModal(null)} titulo="Adicionar à cadência"
        descricao="A Prospecção consome o motor de cadências; a configuração dos passos vive em Automações.">
        <div className="ov-form">
          {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
          <div className="ov-familias">
            {cadencias.map((c) => (
              <button key={c.id} type="button" className="ov-familia" disabled={pendente}
                onClick={() => rodar(() => acoes.inscreverEmCadencia(alvo!.leadId, c.id))}>
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </Dialogo>

      <DialogoOportunidadeDireta
        aberto={modal === "oportunidade"} responsaveis={responsaveis}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(familias, responsavelId) => rodar(() => acoes.oportunidadeDireta(alvo!.leadId, familias, responsavelId), `Oportunidade de ${alvo!.empresa} criada no Pipeline, etapa Entrada.`)}
      />

      <Dialogo aberto={modal === "descartar"} aoFechar={() => setModal(null)} titulo="Descartar prospect"
        descricao="Em Prospecção é descarte, não desqualificação: nem todo prospect descartado passou por qualificação comercial formal.">
        <div className="ov-form">
          {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
          <div className="ov-familias">
            {MOTIVOS_DESCARTE.map((m) => (
              <button key={m.chave} type="button" className="ov-familia" disabled={pendente}
                onClick={() => rodar(() => acoes.descartar(alvo!.leadId, m.chave))}>
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>
      </Dialogo>

      {/* `key` pela operação: trocar de ação remonta o diálogo e descarta o
          valor anterior, para que um id de responsável não vire nome de tag. */}
      <DialogoMassa
        key={operacaoMassa ?? "nenhuma"}
        aberto={modal === "massa"} quantidade={selecionados.length} operacao={operacaoMassa} responsaveis={responsaveis}
        listas={dados.filtros.listas} cadencias={cadencias}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => { setModal(null); setOperacaoMassa(null); }}
        aoConfirmar={async (valor) => {
          const rotulo = operacaoMassa === "enriquecer" ? "Enriquecimento enfileirado." : "Ação em massa aplicada.";
          const ok = await rodar(() => executarEmMassa(valor), rotulo);
          if (ok) setSelecionados([]);
          return ok;
        }}
      />

      {acoes.importar ? (
        <DialogoImportar
          key={modal === "importar" ? "aberto" : "fechado"}
          aberto={modal === "importar"} listas={dados.filtros.listas} responsaveis={responsaveis}
          pendente={pendente} bloqueio={bloqueio}
          aoFechar={() => setModal(null)}
          aoConfirmar={async (linhasCsv, comum) => {
            let msg = "Importação concluída.";
            const ok = await rodar(async () => {
              const r = await acoes.importar!(linhasCsv, comum);
              if (r.ok && r.dados) {
                const { criados, jaExistiam, falhas } = r.dados;
                msg = `${criados} ${criados === 1 ? "empresa adicionada" : "empresas adicionadas"}`
                  + (jaExistiam ? `, ${jaExistiam} já estavam na base` : "")
                  + (falhas ? `, ${falhas} com erro` : "") + ".";
              }
              return r;
            }, () => msg);
            return ok;
          }}
        />
      ) : null}
    </div>
  );
}

function DialogoNovoProspect({ aberto, listas, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  listas: string[];
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (e: EntradaProspect) => Promise<boolean>;
}) {
  const [form, setForm] = useState<EntradaProspect>({ empresa: "" });
  const campo = (chave: keyof EntradaProspect) => ({
    value: (form[chave] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Adicionar empresa ao outbound"
      descricao="Empresa já existente é reaproveitada, não duplicada. Pessoa é opcional: em outbound, enriquecer depois é parte do processo."
      largura="larga">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-form-linha">
          <label><span>Empresa *</span><input {...campo("empresa")} /></label>
          <label><span>CNPJ</span><input {...campo("cnpj")} /></label>
          <label><span>Site</span><input {...campo("website")} /></label>
          <label><span>Fonte</span><input {...campo("fonte")} placeholder="Apollo, CSV, manual…" /></label>
          <label><span>Contato</span><input {...campo("pessoaNome")} /></label>
          <label><span>Cargo</span><input {...campo("cargo")} /></label>
          <label><span>E-mail</span><input type="email" {...campo("email")} /></label>
          <label><span>Telefone</span><input {...campo("telefone")} /></label>
          <label>
            <span>Lista</span>
            <input list="listas-prospeccao" {...campo("lista")} />
            <datalist id="listas-prospeccao">
              {listas.map((l) => <option key={l} value={l} />)}
            </datalist>
          </label>
          <label>
            <span>Responsável</span>
            <select {...campo("responsavelId")}>
              <option value="">Sem responsável</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !form.empresa.trim()}
            onClick={() => aoConfirmar(form)}>Adicionar</button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoOportunidadeDireta({ aberto, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (familias: Familia[], responsavelId: string) => Promise<boolean>;
}) {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [responsavelId, setResponsavelId] = useState("");

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Oportunidade direta"
      descricao="Vai direto para o Pipeline, sem criar Lead de Pré-vendas. A origem fica registrada como prospecção direta.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-familias">
          {FAMILIAS.map((f) => (
            <button key={f} type="button" className="ov-familia" data-marcada={familias.includes(f)}
              onClick={() => setFamilias((a) => a.includes(f) ? a.filter((x) => x !== f) : [...a, f])}>
              {ROTULO_FAMILIA[f]}
            </button>
          ))}
        </div>
        {familias.length > 1 ? (
          <p className="ov-nota">{familias.length} oportunidades irmãs, mesmo bundle, fechamento independente.</p>
        ) : null}
        <label>
          <span>Responsável comercial</span>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Escolha</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || familias.length === 0 || !responsavelId}
            onClick={() => aoConfirmar(familias, responsavelId)}>Criar oportunidade</button>
        </div>
      </div>
    </Dialogo>
  );
}

/**
 * Importar CSV. O arquivo é lido no navegador (nada sobe antes da pessoa ver o
 * que vai entrar) e cada linha vai ao servidor pelo mesmo comando do
 * "Adicionar empresa". A prévia diz quantas linhas entram e quais foram
 * recusadas, pelo número da linha no arquivo.
 */
function DialogoImportar({ aberto, listas, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  listas: string[];
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (linhas: LinhaCsvProspect[], comum: { lista: string | null; responsavelId: string | null; fonte: string | null }) => Promise<boolean>;
}) {
  const [leitura, setLeitura] = useState<ReturnType<typeof lerCsvProspects> & { arquivo: string } | null>(null);
  const [lista, setLista] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [fonte, setFonte] = useState("CSV");
  const arquivoRef = useRef<HTMLInputElement>(null);

  async function ler(arquivo: File | undefined) {
    if (!arquivo) return;
    const texto = await arquivo.text();
    setLeitura({ ...lerCsvProspects(texto), arquivo: arquivo.name });
  }

  const linhas = leitura?.linhas ?? [];
  const excede = linhas.length > 500;

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Importar empresas (CSV)" largura="larga"
      descricao="Colunas reconhecidas: empresa (obrigatória), cnpj, site, contato, cargo, e-mail, telefone. Separador ; ou ,. Empresa que já está na base é reaproveitada, não duplicada.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label>
          <span>Arquivo</span>
          <input ref={arquivoRef} type="file" accept=".csv,text/csv" onChange={(e) => ler(e.target.files?.[0])} />
        </label>
        {leitura?.erro ? <p className="ov-nota" role="alert">{leitura.erro}</p> : null}
        {leitura && !leitura.erro ? (
          <p className="ov-nota" role="status">
            {leitura.arquivo}: {linhas.length} {linhas.length === 1 ? "linha pronta" : "linhas prontas"} para importar
            {leitura.recusadas.length
              ? `; ${leitura.recusadas.length} sem empresa (linha ${leitura.recusadas.slice(0, 8).join(", ")}${leitura.recusadas.length > 8 ? "…" : ""})`
              : ""}.
            {excede ? " Acima de 500 linhas: divida o arquivo em lotes." : ""}
          </p>
        ) : null}
        {linhas.length > 0 ? (
          <div className="pp-previa">
            {linhas.slice(0, 5).map((l, i) => (
              <div key={i}><strong>{l.empresa}</strong>{l.pessoaNome ? ` · ${l.pessoaNome}` : ""}{l.email ? ` · ${l.email}` : ""}</div>
            ))}
            {linhas.length > 5 ? <div className="pp-apoio">e mais {linhas.length - 5}…</div> : null}
          </div>
        ) : null}
        <div className="ov-form-linha">
          <label>
            <span>Lista (opcional)</span>
            <input list="listas-importar" value={lista} onChange={(e) => setLista(e.target.value)} placeholder="Ex.: Feira SP outubro" />
            <datalist id="listas-importar">{listas.map((l) => <option key={l} value={l} />)}</datalist>
          </label>
          <label>
            <span>Responsável</span>
            <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
              <option value="">Sem responsável</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
          <label>
            <span>Fonte</span>
            <input value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="CSV, feira, LinkedIn…" />
          </label>
        </div>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || linhas.length === 0 || excede}
            onClick={() => aoConfirmar(linhas, { lista: lista || null, responsavelId: responsavelId || null, fonte: fonte || null })}>
            {pendente ? "Importando…" : `Importar ${linhas.length || ""}`.trim()}
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

/** Título, texto de apoio e rótulo do botão de cada ação em massa. */
const TEXTO_MASSA: Record<OperacaoMassa, { titulo: string; descricao: string; confirmar: string }> = {
  responsavel: {
    titulo: "Atribuir responsável",
    descricao: "Cada atribuição registra seu próprio evento: uma ação em massa não apaga o histórico individual.",
    confirmar: "Atribuir",
  },
  cadencia: {
    titulo: "Adicionar à cadência",
    descricao: "A Prospecção consome o motor de cadências; a configuração dos passos vive em Automações.",
    confirmar: "Inscrever",
  },
  lista: {
    titulo: "Adicionar à lista",
    descricao: "Escolha uma lista existente para reaproveitar, ou digite um nome novo para criar.",
    confirmar: "Adicionar",
  },
  tag: {
    titulo: "Adicionar tag",
    descricao: "A tag é criada se ainda não existir, e aplicada a todas as empresas selecionadas.",
    confirmar: "Adicionar",
  },
  enriquecer: {
    titulo: "Enriquecer empresas",
    descricao: "O enriquecimento roda em segundo plano. Os dados aparecem conforme cada empresa é processada.",
    confirmar: "Enfileirar",
  },
  pausar: {
    titulo: "Pausar cadência",
    descricao: "As empresas selecionadas saem da fila de envio. Os passos já executados permanecem no histórico.",
    confirmar: "Pausar",
  },
};

function DialogoMassa({ aberto, quantidade, operacao, responsaveis, listas, cadencias, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  quantidade: number;
  operacao: OperacaoMassa | null;
  responsaveis: Array<{ id: string; nome: string }>;
  listas: string[];
  cadencias: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (valor: string | null) => Promise<boolean>;
}) {
  const [valor, setValor] = useState("");
  if (!operacao) return null;

  const texto = TEXTO_MASSA[operacao];
  const exigeValor = operacao === "cadencia" || operacao === "lista" || operacao === "tag";

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar}
      titulo={`${texto.titulo} · ${quantidade} ${quantidade === 1 ? "empresa" : "empresas"}`}
      descricao={texto.descricao}>
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        {operacao === "responsavel" ? (
          <label>
            <span>Responsável</span>
            <select value={valor} onChange={(e) => setValor(e.target.value)}>
              <option value="">Sem responsável</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
        ) : null}
        {operacao === "cadencia" ? (
          <label>
            <span>Cadência</span>
            <select value={valor} onChange={(e) => setValor(e.target.value)}>
              <option value="">Escolha a cadência</option>
              {cadencias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
        ) : null}
        {operacao === "lista" ? (
          <label>
            <span>Lista</span>
            <input list="listas-massa" value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder="Nome da lista" />
            <datalist id="listas-massa">
              {listas.map((l) => <option key={l} value={l} />)}
            </datalist>
          </label>
        ) : null}
        {operacao === "tag" ? (
          <label>
            <span>Tag</span>
            <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Nome da tag" />
          </label>
        ) : null}
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || (exigeValor && !valor.trim())}
            onClick={() => aoConfirmar(valor || null)}>{texto.confirmar}</button>
        </div>
      </div>
    </Dialogo>
  );
}

/** Ícones reexportados para a página, que monta o cabeçalho. */
export const IconesProspeccao = { List, LayoutGrid };
