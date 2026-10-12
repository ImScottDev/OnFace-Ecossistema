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

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Filter, LayoutGrid, List, MoreHorizontal, Plus, Search, Send, Upload, Users, X } from "lucide-react";
import type {
  FilaProspeccao, LinhaProspeccao, OperacaoProspeccao, OrdemProspeccao,
} from "@/lib/vendas/consultas";
import type { DetalheDoProspect } from "@/lib/vendas/prospeccao-detalhe";
import type { ResultadoDoMovimento } from "@/lib/vendas/prospeccao";
import {
  ESTADOS_PROSPECCAO, FAMILIAS, POR_PAGINA_PROSPECCAO, MOTIVOS_DESCARTE, ROTULO_ESTADO_PROSPECCAO, ROTULO_FAMILIA,
  type EstadoProspeccao, type Familia, type MotivoDescarte,
} from "@/lib/vendas/dominio";
import { destinosPermitidos, transicao } from "@/lib/vendas/prospeccao-transicoes";
import type { Resultado } from "@/lib/vendas/resultado";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AvisoBloqueio, Board, ComPainel, Coluna, ColunaVazia, Dialogo, FALHA_DE_COMUNICACAO, Tag, dataCurta, useAcao,
} from "./ui";
import {
  acoesEmMassaDisponiveis, lerCsvProspects, montarPayloadMassa, montarUrlProspeccao,
  resumirExecucaoEmMassa, type LinhaCsvProspect, type OperacaoMassa,
} from "./prospeccao-acoes";
import { ProspectDrawer } from "./prospeccao-drawer";
import { VisaoCampanhas, VisaoInteligencia, VisaoOperacao } from "./prospeccao-visoes";
import "./prospeccao.css";

export type Visao = "operacao" | "kanban" | "lista" | "campanhas" | "inteligencia";

export interface DadosLista {
  linhas: LinhaProspeccao[];
  resumo: Record<EstadoProspeccao, number>;
  paginacao: { total: number; pagina: number; porPagina: number; paginas: number };
}
export interface DadosKanban {
  colunas: Array<{ estado: EstadoProspeccao; total: number; cards: LinhaProspeccao[] }>;
  resumo: Record<EstadoProspeccao, number>;
}
export interface FiltroUrl {
  busca: string; estado: EstadoProspeccao | null; responsavelId: string | null; lista: string | null;
  cadenciaId: string | null; fila: FilaProspeccao | null; ordem: OrdemProspeccao | null; direcao: "asc" | "desc" | null;
}

export interface AcoesProspeccao {
  adicionar: (e: EntradaProspect) => Promise<Resultado<{ leadId: string; jaExistia: boolean }>>;
  /** Opcional: o espelho em /onface-desenho não liga importação. */
  importar?: (linhas: LinhaCsvProspect[], comum: { lista?: string | null; responsavelId?: string | null; fonte?: string | null }) => Promise<Resultado<{ criados: number; jaExistiam: number; falhas: number }>>;
  inscreverEmCadencia: (leadId: string, cadenciaId: string) => Promise<Resultado>;
  pausarCadencia: (leadId: string, motivo: string) => Promise<Resultado>;
  retomarCadencia: (leadId: string) => Promise<Resultado>;
  /** A porta única do arrastar-e-soltar: o backend valida e executa. */
  mover: (leadId: string, para: EstadoProspeccao, dados?: {
    cadenceDefinitionId?: string | null;
    confirmacaoManual?: { canal: string; observacao: string } | null;
    motivoDescarte?: MotivoDescarte | null;
    familias?: Familia[];
    responsavelId?: string | null;
  }) => Promise<Resultado<ResultadoDoMovimento>>;
  detalhe: (leadId: string) => Promise<Resultado<DetalheDoProspect>>;
  atribuir: (leadId: string, responsavelId: string | null) => Promise<Resultado>;
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

type AlvoMov = { leadId: string; empresa: string; estado: EstadoProspeccao; empresaId: string | null };
type Aviso = { mensagem: string; acao?: { rotulo: string; tipo: string } };
type Sucesso = { texto: string; href?: string; rotulo?: string };

const VISOES: Array<{ chave: Visao; rotulo: string }> = [
  { chave: "operacao", rotulo: "Operação" }, { chave: "kanban", rotulo: "Kanban" }, { chave: "lista", rotulo: "Lista" },
  { chave: "campanhas", rotulo: "Campanhas" }, { chave: "inteligencia", rotulo: "Inteligência" },
];
const FILAS: Array<{ chave: FilaProspeccao; rotulo: string }> = [
  { chave: "sem_responsavel", rotulo: "Sem responsável" }, { chave: "sem_contato", rotulo: "Sem contato" },
  { chave: "cadencia_pausada", rotulo: "Cadência pausada" }, { chave: "cadencia_com_falha", rotulo: "Cadência com falha" },
];
const CANAIS_RESPOSTA = ["WhatsApp", "E-mail", "Telefone", "LinkedIn", "Presencial", "Outro"];
const DESFECHOS: EstadoProspeccao[] = ["pre_qualificado", "oportunidade", "sem_resposta", "descartado"];
const ROTULO_DESFECHO: Record<string, string> = {
  pre_qualificado: "Pré-qualificado", oportunidade: "Oportunidade direta", sem_resposta: "Sem resposta", descartado: "Descartado",
};
const ROTULO_ACAO: Record<string, string> = {
  em_cadencia: "Adicionar à cadência", respondeu: "Registrar resposta", sem_resposta: "Marcar sem resposta",
  pre_qualificado: "Pré-qualificar", oportunidade: "Criar oportunidade", descartado: "Descartar",
};

function textoDoMovimento(para: EstadoProspeccao, empresa: string): string {
  switch (para) {
    case "em_cadencia": return `${empresa} entrou em cadência.`;
    case "respondeu": return `${empresa} marcada como respondeu.`;
    case "sem_resposta": return `${empresa} marcada como sem resposta.`;
    case "pre_qualificado": return `${empresa} entregue a Pré-vendas, na etapa Novo.`;
    case "oportunidade": return `Oportunidade de ${empresa} criada no Pipeline, etapa Entrada.`;
    case "descartado": return `${empresa} descartada. O histórico foi preservado.`;
    default: return "Alteração salva.";
  }
}

export function Prospeccao({
  visao, dados, kanban, operacao, filtro, opcoes, cadencias, responsaveis, acoes, abertoId, porColuna, motivoSemEnriquecer = null,
}: {
  visao: Visao;
  dados: DadosLista | null;
  kanban: DadosKanban | null;
  operacao: OperacaoProspeccao | null;
  filtro: FiltroUrl;
  opcoes: { responsaveis: Array<{ id: string; nome: string }>; listas: string[]; cadencias: Array<{ id: string; nome: string }> };
  cadencias: Array<{ id: string; nome: string }>;
  responsaveis: Array<{ id: string; nome: string }>;
  acoes: AcoesProspeccao;
  /** Prospect aberto no drawer (`?lead=`): sobrevive ao F5. */
  abertoId: string | null;
  porColuna: number;
  /** null = enriquecer disponível; texto = por que não. */
  motivoSemEnriquecer?: string | null;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [busca, setBusca] = useState(filtro.busca);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [alvo, setAlvo] = useState<AlvoMov | null>(null);
  const [modal, setModal] = useState<null | "novo" | "importar" | "cadencia" | "oportunidade" | "descartar" | "resposta" | "massa">(null);
  const [operacaoMassa, setOperacaoMassa] = useState<OperacaoMassa | null>(null);
  const [sucesso, setSucesso] = useState<Sucesso | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [versao, setVersao] = useState(0);
  const [arrastando, setArrastando] = useState<{ id: string; estado: EstadoProspeccao } | null>(null);
  const [sobre, setSobre] = useState<EstadoProspeccao | null>(null);
  const [pendenteId, setPendenteId] = useState<string | null>(null);
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();

  /* Movimentos otimistas valem só para a leitura em que foram feitos: quando o
     servidor devolve dados novos (`fonte` muda de identidade) eles caducam e a
     tela passa a mostrar o que ficou gravado. */
  const fonte = kanban ?? dados;
  const [mov, setMov] = useState<{ fonte: unknown; mapa: Record<string, EstadoProspeccao> }>({ fonte: null, mapa: {} });
  const movidos = mov.fonte === fonte ? mov.mapa : {};
  const marcarMovido = (id: string, para: EstadoProspeccao | null) =>
    setMov((m) => {
      const base = m.fonte === fonte ? m.mapa : {};
      const proximo = { ...base };
      if (para) proximo[id] = para; else delete proximo[id];
      return { fonte, mapa: proximo };
    });

  function navegar(mudancas: Record<string, string | null>) {
    iniciarNavegacao(() => router.push(montarUrlProspeccao(window.location.href, mudancas)));
  }
  const abrir = (id: string | null) => navegar({ lead: id });

  async function rodar(fn: () => Promise<Resultado<unknown>>, mensagem: string | (() => string) = "Alteração salva.", aoOk?: () => void) {
    const desfecho = await executar(async () => (await fn()) as Resultado<unknown>);
    if (desfecho.ok) {
      setModal(null);
      setAlvo(null);
      setAviso(null);
      const destino = (desfecho.dados as { destino?: { rota: string; rotulo: string } | null } | null)?.destino;
      setSucesso({ texto: typeof mensagem === "function" ? mensagem() : mensagem, href: destino?.rota, rotulo: destino?.rotulo });
      setVersao((v) => v + 1);
      aoOk?.();
      router.refresh();
    }
    return desfecho.ok;
  }

  /** Movimento direto (sem diálogo): otimista, com reversão se o backend recusar. */
  async function mover(a: AlvoMov, para: EstadoProspeccao, extra: Parameters<AcoesProspeccao["mover"]>[2] = {}) {
    setAviso(null); setSucesso(null);
    marcarMovido(a.leadId, para);
    setPendenteId(a.leadId);
    let r: Awaited<ReturnType<AcoesProspeccao["mover"]>>;
    try { r = await acoes.mover(a.leadId, para, extra); } catch { r = { ok: false, erro: FALHA_DE_COMUNICACAO }; }
    setPendenteId(null);
    if (!r.ok) {
      marcarMovido(a.leadId, null);
      if (r.acao?.tipo === "confirmar_resposta") { setAlvo(a); limparBloqueio(); setModal("resposta"); }
      else setAviso({ mensagem: r.erro, acao: r.acao });
      if (r.codigo === "prospect_mudou") router.refresh();
      return false;
    }
    const destino = r.dados?.destino;
    setSucesso({ texto: textoDoMovimento(para, a.empresa), href: destino?.rota, rotulo: destino?.rotulo });
    setVersao((v) => v + 1);
    router.refresh();
    return true;
  }

  /** Decide, pela mesma regra que o backend aplica, o que precisa ser perguntado. */
  function pedirMovimento(a: AlvoMov, para: EstadoProspeccao) {
    const t = transicao(a.estado, para);
    if (!t.permitida) { if (!t.igual) setAviso({ mensagem: t.motivo }); return; }
    if ((para === "pre_qualificado" || para === "oportunidade") && !a.empresaId) {
      setAviso({ mensagem: "Prospect sem empresa: vincule uma empresa antes de entregar ou criar oportunidade." });
      return;
    }
    limparBloqueio(); setAviso(null);
    if (t.exige === "cadencia") { setAlvo(a); setModal("cadencia"); return; }
    if (t.exige === "motivo") { setAlvo(a); setModal("descartar"); return; }
    if (t.exige === "familia_e_responsavel") { setAlvo(a); setModal("oportunidade"); return; }
    void mover(a, para);
  }

  async function atribuir(leadId: string, responsavelId: string | null) {
    const r = await acoes.atribuir(leadId, responsavelId);
    if (!r.ok) { setAviso({ mensagem: r.erro }); return false; }
    setSucesso({ texto: "Responsável atualizado." }); setVersao((v) => v + 1); router.refresh();
    return true;
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

  /** Lista e tag compartilham a tabela `labels`: a lista exibida é a etiqueta do lead. */
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

  const mostraFiltros = visao === "lista" || visao === "kanban";
  const temFiltro = Boolean(filtro.busca || filtro.responsavelId || filtro.lista || filtro.cadenciaId || filtro.fila);
  const limparTudo = () => { setBusca(""); setSelecionados([]); navegar({ busca: null, responsavel: null, lista: null, cadencia: null, fila: null, pagina: null, mostrar: null }); };

  /* ── Lista ── */
  const linhas = (dados?.linhas ?? []).map((l) => (l.pessoa && l.pessoa === l.empresa ? { ...l, pessoa: null } : l));
  const resumo = dados?.resumo ?? kanban?.resumo ?? null;
  const totalBase = resumo ? ESTADOS_PROSPECCAO.reduce((n, e) => n + (resumo[e] ?? 0), 0) : 0;
  const abas = ESTADOS_PROSPECCAO.filter((e) => ABAS_FIXAS.includes(e) || (resumo?.[e] ?? 0) > 0);
  const idsVisiveis = linhas.map((l) => l.leadId);
  const todasMarcadas = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.includes(id));
  const selecionadasEmCadencia = linhas.filter((l) => selecionados.includes(l.leadId) && l.estado === "em_cadencia").length;
  const pag = dados?.paginacao;
  const ordenar = (chave: OrdemProspeccao) => {
    const asc = filtro.ordem === chave && filtro.direcao === "asc";
    navegar({ ordem: chave, dir: asc ? "desc" : "asc", pagina: null });
  };
  const setaOrdem = (chave: OrdemProspeccao) => (filtro.ordem === chave ? (filtro.direcao === "asc" ? " ▲" : " ▼") : "");
  const ariaOrdem = (chave: OrdemProspeccao) => (filtro.ordem === chave ? (filtro.direcao === "asc" ? "ascending" : "descending") : "none") as "ascending" | "descending" | "none";

  /* ── Kanban (com movimentos otimistas) ── */
  const todosCards = kanban ? kanban.colunas.flatMap((c) => c.cards) : [];
  const estadoDe = (l: LinhaProspeccao) => movidos[l.leadId] ?? l.estado;
  const deltas = (estado: EstadoProspeccao) =>
    todosCards.reduce((n, l) => n + (movidos[l.leadId] === estado ? 1 : 0) - (l.estado === estado && movidos[l.leadId] && movidos[l.leadId] !== estado ? 1 : 0), 0);
  const contaDe = (estado: EstadoProspeccao) => (resumo?.[estado] ?? 0) + deltas(estado);

  function soltarEm(estado: EstadoProspeccao) {
    const a = arrastando;
    setSobre(null); setArrastando(null);
    if (!a || a.estado === estado) return;
    const card = todosCards.find((l) => l.leadId === a.id);
    if (!card) return;
    pedirMovimento({ leadId: card.leadId, empresa: card.empresa, estado: estadoDe(card), empresaId: card.empresaId }, estado);
  }

  const alvoMov = alvo;
  const empresaAlvo = alvoMov?.empresa ?? "";

  const tituloCartao = visao === "kanban" ? "Kanban de prospecção" : filtro.estado ? ROTULO_ESTADO_PROSPECCAO[filtro.estado] : "Base outbound";
  const contaCartao = visao === "lista" && pag
    ? (pag.total === 0 ? "0 empresas" : `${(pag.pagina - 1) * pag.porPagina + 1} a ${Math.min(pag.pagina * pag.porPagina, pag.total)} de ${pag.total} empresas`)
    : visao === "kanban" ? `${totalBase} empresas` : "";
  const subCartao = visao === "kanban"
    ? "arraste para mudar o estado · pré-qualificar entrega a Pré-vendas, oportunidade vai direto ao Pipeline"
    : filtro.estado === "pre_qualificado" ? "entregues a Pré-vendas, na etapa Novo"
      : filtro.estado === "oportunidade" ? "foram direto ao Pipeline, sem passar por Pré-vendas"
        : "empresas em prospecção · pré-qualificar entrega a Pré-vendas, oportunidade vai direto ao Pipeline";

  const corpoPrincipal = (
    <section className="pp-cartao" aria-label={tituloCartao}>
      <header className="pp-cartao-cab">
        <h1 className="pp-cartao-titulo">{VISOES.find((v) => v.chave === visao)?.rotulo === "Lista" || visao === "kanban" ? tituloCartao : VISOES.find((v) => v.chave === visao)?.rotulo}</h1>
        <span className="pp-cartao-sub">{visao === "lista" || visao === "kanban" ? subCartao : ""}</span>
        <span className="pp-cartao-conta">{contaCartao}</span>
      </header>

      {visao === "operacao" && operacao ? <div className="pp-rolagem"><VisaoOperacao op={operacao} /></div> : null}
      {visao === "campanhas" && operacao ? <div className="pp-rolagem"><VisaoCampanhas op={operacao} /></div> : null}
      {visao === "inteligencia" && operacao ? <div className="pp-rolagem"><VisaoInteligencia op={operacao} /></div> : null}

      {visao === "kanban" && kanban ? (
        <div className="pp-kanban">
          <Board>
            {COLUNAS_OPERACIONAIS.map((estado) => {
              const cards = todosCards.filter((l) => estadoDe(l) === estado);
              const t = arrastando ? transicao(arrastando.estado, estado) : null;
              return (
                <div key={estado} className="pp-coluna-alvo" data-estado={estado}
                  data-sobre={sobre === estado || undefined}
                  data-proibida={sobre === estado && t && !t.permitida && !t.igual ? true : undefined}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (sobre !== estado) setSobre(estado); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre((s) => (s === estado ? null : s)); }}
                  onDrop={(e) => { e.preventDefault(); soltarEm(estado); }}>
                  <Coluna titulo={ROTULO_ESTADO_PROSPECCAO[estado]} total={Math.max(contaDe(estado), cards.length)} carregados={cards.length}>
                    {cards.length === 0 ? (
                      <ColunaVazia filtrado={temFiltro}>
                        {estado === "novo" ? "Nenhuma empresa nova. Adicione, importe ou busque no Apollo." : estado === "em_cadencia" ? "Ninguém em cadência. Arraste uma empresa de Novo para iniciar." : "Ninguém respondeu ainda."}
                      </ColunaVazia>
                    ) : cards.map((l) => (
                      <CartaoProspect key={l.leadId} l={{ ...l, estado: estadoDe(l) }} aberto={abertoId === l.leadId}
                        pendente={pendenteId === l.leadId}
                        aoAbrir={() => abrir(l.leadId)}
                        aoArrastar={(on) => setArrastando(on ? { id: l.leadId, estado: estadoDe(l) } : null)}
                        aoMover={(para) => pedirMovimento({ leadId: l.leadId, empresa: l.empresa, estado: estadoDe(l), empresaId: l.empresaId }, para)} />
                    ))}
                    {(kanban.colunas.find((c) => c.estado === estado)?.cards.length ?? 0) < (resumo?.[estado] ?? 0) ? (
                      <button type="button" className="pp-ver-mais" onClick={() => navegar({ mostrar: String(porColuna + 25) })}>Ver mais</button>
                    ) : null}
                  </Coluna>
                </div>
              );
            })}
            <aside className="pp-desfechos" aria-label="Desfechos">
              <h2>Desfechos</h2>
              <p>Solte aqui para encerrar a prospecção. Clique para ver a fila.</p>
              {DESFECHOS.map((e) => {
                const t = arrastando ? transicao(arrastando.estado, e) : null;
                return (
                  <button key={e} type="button" className="pp-desfecho" data-estado={e}
                    data-sobre={sobre === e || undefined}
                    data-proibida={sobre === e && t && !t.permitida ? true : undefined}
                    onClick={() => { setSelecionados([]); navegar({ visao: null, estado: e, mostrar: null, pagina: null }); }}
                    onDragOver={(ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; if (sobre !== e) setSobre(e); }}
                    onDragLeave={() => setSobre((s) => (s === e ? null : s))}
                    onDrop={(ev) => { ev.preventDefault(); soltarEm(e); }}>
                    <span>{ROTULO_DESFECHO[e]}</span>
                    <span className="pp-conta">{contaDe(e)}</span>
                  </button>
                );
              })}
            </aside>
          </Board>
        </div>
      ) : null}

      {visao === "lista" ? (
        <>
          <div className="pp-rolagem">
            <div className="pp-grade" role="table" aria-label="Empresas em prospecção">
              <div className="pp-linha pp-linha-cab" role="row">
                <span role="columnheader">
                  <input type="checkbox" className="pp-check" checked={todasMarcadas} aria-label="Selecionar todas as visíveis"
                    disabled={idsVisiveis.length === 0}
                    onChange={() => setSelecionados(todasMarcadas ? selecionados.filter((id) => !idsVisiveis.includes(id)) : [...new Set([...selecionados, ...idsVisiveis])])} />
                </span>
                {([["EMPRESA", "empresa"], ["CONTATO", null], ["ESTADO", "estado"], ["CADÊNCIA", "cadencia"], ["LISTA", null], ["RESPONSÁVEL", "responsavel"]] as const).map(([rot, chave]) => (
                  <span key={rot} role="columnheader" aria-sort={chave ? ariaOrdem(chave) : undefined}>
                    {chave ? <button type="button" className="pp-ordena" onClick={() => ordenar(chave)}>{rot}{setaOrdem(chave)}</button> : rot}
                  </span>
                ))}
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
                  data-marcada={selecionados.includes(l.leadId)} data-aberta={abertoId === l.leadId}
                  onClick={() => abrir(l.leadId)}
                  onKeyDown={(e) => { if (e.key === "Enter") abrir(l.leadId); }}>
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
                  <span role="cell" className="pp-nome-texto">
                    <span className="pp-apoio-cel">{l.cadencia ?? "—"}</span>
                    {l.cadencia ? <span className="pp-apoio">{textoPasso(l)}</span> : null}
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
          {pag && pag.total > 0 ? (
            <footer className="pp-paginacao" aria-label="Paginação">
              <label>Por página
                <select value={pag.porPagina} onChange={(e) => navegar({ porPagina: e.target.value === "25" ? null : e.target.value, pagina: null })}>
                  {POR_PAGINA_PROSPECCAO.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <span className="pp-pag-info">Página {pag.pagina} de {pag.paginas}</span>
              <button type="button" disabled={pag.pagina <= 1} onClick={() => navegar({ pagina: pag.pagina - 1 > 1 ? String(pag.pagina - 1) : null })}>Anterior</button>
              <button type="button" disabled={pag.pagina >= pag.paginas} onClick={() => navegar({ pagina: String(pag.pagina + 1) })}>Próxima</button>
            </footer>
          ) : null}
        </>
      ) : null}
    </section>
  );

  return (
    <div className="pp">
      <div className="pp-barra">
        <nav className="pp-seg pp-nav" role="tablist" aria-label="Visão da prospecção">
          {VISOES.map((v) => (
            <button key={v.chave} type="button" role="tab" aria-selected={visao === v.chave} data-on={visao === v.chave}
              onClick={() => { setSelecionados([]); navegar({ visao: v.chave === "lista" ? null : v.chave, lead: null, estado: v.chave === "lista" ? filtro.estado : null, pagina: null, mostrar: null }); }}>
              {v.chave === "kanban" ? <LayoutGrid aria-hidden /> : v.chave === "lista" ? <List aria-hidden /> : null}{v.rotulo}
            </button>
          ))}
        </nav>
        <span className="pp-mola" />
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

      {mostraFiltros ? (
        <div className="pp-barra pp-barra-filtros">
          <form className="pp-busca" role="search" onSubmit={(e) => { e.preventDefault(); navegar({ busca: busca.trim() || null, pagina: null }); }}>
            <Search aria-hidden />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Empresa, pessoa, e-mail ou telefone"
              aria-label="Buscar empresa, pessoa, e-mail ou telefone" />
            {busca ? (
              <button type="button" className="pp-busca-limpar" aria-label="Limpar busca"
                onClick={() => { setBusca(""); navegar({ busca: null, pagina: null }); }}><X aria-hidden /></button>
            ) : null}
          </form>
          <label className="pp-filtro" data-on={Boolean(filtro.responsavelId)}>
            <Users aria-hidden />
            <select value={filtro.responsavelId ?? ""} aria-label="Filtrar por responsável"
              onChange={(e) => navegar({ responsavel: e.target.value || null, pagina: null })}>
              <option value="">Responsável</option>
              <option value="sem">Sem responsável</option>
              {opcoes.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
          <label className="pp-filtro" data-on={Boolean(filtro.lista)}>
            <List aria-hidden />
            <select value={filtro.lista ?? ""} aria-label="Filtrar por lista" disabled={opcoes.listas.length === 0}
              title={opcoes.listas.length === 0 ? "Nenhuma lista criada ainda. Listas nascem ao adicionar ou importar empresas." : undefined}
              onChange={(e) => { setSelecionados([]); navegar({ lista: e.target.value || null, pagina: null }); }}>
              <option value="">{opcoes.listas.length === 0 ? "Sem listas" : "Lista"}</option>
              {opcoes.listas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="pp-filtro" data-on={Boolean(filtro.cadenciaId)}>
            <Send aria-hidden />
            <select value={filtro.cadenciaId ?? ""} aria-label="Filtrar por cadência" onChange={(e) => navegar({ cadencia: e.target.value || null, pagina: null })}>
              <option value="">Cadência</option>
              <option value="sem">Fora de cadência</option>
              {opcoes.cadencias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="pp-filtro" data-on={Boolean(filtro.fila)}>
            <Filter aria-hidden />
            <select value={filtro.fila ?? ""} aria-label="Filtrar por fila" onChange={(e) => navegar({ fila: e.target.value || null, pagina: null })}>
              <option value="">Fila</option>
              {FILAS.map((f) => <option key={f.chave} value={f.chave}>{f.rotulo}</option>)}
            </select>
          </label>
          {temFiltro ? <button type="button" className="pp-limpar" onClick={limparTudo}>Limpar</button> : null}
        </div>
      ) : null}

      {visao === "lista" && resumo ? (
        <div className="pp-abas" role="tablist" aria-label="Estado da prospecção">
          <button type="button" role="tab" aria-selected={!filtro.estado} data-on={!filtro.estado}
            onClick={() => { setSelecionados([]); navegar({ estado: null, pagina: null }); }}>
            Todos<span className="pp-conta">{totalBase}</span>
          </button>
          {abas.map((e) => (
            <button key={e} type="button" role="tab" aria-selected={filtro.estado === e} data-on={filtro.estado === e}
              data-sinal={e === "respondeu" && (resumo[e] ?? 0) > 0}
              onClick={() => { setSelecionados([]); navegar({ estado: e, pagina: null }); }}>
              {ROTULO_ESTADO_PROSPECCAO[e]}<span className="pp-conta">{resumo[e] ?? 0}</span>
            </button>
          ))}
        </div>
      ) : null}

      {aviso ? (
        <div className="pp-aviso" role="alert">
          <AvisoBloqueio bloqueio={aviso} aoAgir={(tipo) => { if (tipo === "confirmar_resposta") setModal("resposta"); }} />
          <button type="button" className="pp-aviso-fechar" aria-label="Fechar aviso" onClick={() => setAviso(null)}><X aria-hidden /></button>
        </div>
      ) : null}
      {bloqueio && !modal ? <div className="pp-aviso"><AvisoBloqueio bloqueio={bloqueio} /></div> : null}
      {sucesso ? (
        <p className="pp-ok" role="status">
          {sucesso.texto}
          {sucesso.href ? <Link href={sucesso.href} className="pp-ok-link">{sucesso.rotulo ?? "Abrir"}</Link> : null}
          <button type="button" aria-label="Fechar aviso" onClick={() => setSucesso(null)}><X aria-hidden /></button>
        </p>
      ) : null}

      <div className="pp-corpo">
        <ComPainel aberto={Boolean(abertoId)}
          painel={abertoId ? (
            <ProspectDrawer key={abertoId} leadId={abertoId} versao={versao} responsaveis={responsaveis}
              acoes={{ detalhe: acoes.detalhe, pausar: (id) => acoes.pausarCadencia(id, "Pausado manualmente"), retomar: acoes.retomarCadencia }}
              aoFechar={() => abrir(null)}
              aoMover={(a, para) => pedirMovimento(a, para)}
              aoAtribuir={atribuir} />
          ) : null}>
          {corpoPrincipal}
        </ComPainel>
      </div>

      {/* Barra de seleção no rodapé, no vocabulário da barra de Pré-vendas. */}
      {selecionados.length > 0 && visao === "lista" ? (
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

      <DialogoNovoProspect
        aberto={modal === "novo"} listas={opcoes.listas} responsaveis={responsaveis}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(e) => {
          let msg = `${e.empresa.trim()} adicionada à base outbound.`;
          return rodar(async () => {
            const r = await acoes.adicionar(e);
            if (r.ok && r.dados?.jaExistia) msg = `${e.empresa.trim()} já estava na base; nada foi duplicado.`;
            return r;
          }, () => msg);
        }}
      />

      <Dialogo aberto={modal === "cadencia"} aoFechar={() => { setModal(null); setAlvo(null); }} titulo="Adicionar à cadência"
        descricao="A Prospecção consome o motor de cadências; a configuração dos passos vive em Automações.">
        <div className="ov-form">
          {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
          {cadencias.length === 0 ? <p className="ov-nota">Nenhuma cadência ativa para leads. Crie uma em Automações › Cadências.</p> : null}
          <div className="ov-familias">
            {cadencias.map((c) => (
              <button key={c.id} type="button" className="ov-familia" disabled={pendente}
                onClick={() => rodar(() => acoes.mover(alvo!.leadId, "em_cadencia", { cadenceDefinitionId: c.id }), textoDoMovimento("em_cadencia", empresaAlvo), () => marcarMovido(alvo!.leadId, "em_cadencia"))}>
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </Dialogo>

      <DialogoOportunidadeDireta
        aberto={modal === "oportunidade"} responsaveis={responsaveis}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => { setModal(null); setAlvo(null); }}
        aoConfirmar={(familias, responsavelId) => rodar(
          () => acoes.mover(alvo!.leadId, "oportunidade", { familias, responsavelId }),
          textoDoMovimento("oportunidade", empresaAlvo), () => marcarMovido(alvo!.leadId, "oportunidade"))}
      />

      <Dialogo aberto={modal === "descartar"} aoFechar={() => { setModal(null); setAlvo(null); }} titulo="Descartar prospect"
        descricao="Em Prospecção é descarte, não desqualificação. O motivo é obrigatório e o histórico não é apagado.">
        <div className="ov-form">
          {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
          <div className="ov-familias">
            {MOTIVOS_DESCARTE.map((m) => (
              <button key={m.chave} type="button" className="ov-familia" disabled={pendente}
                onClick={() => rodar(() => acoes.mover(alvo!.leadId, "descartado", { motivoDescarte: m.chave }), textoDoMovimento("descartado", empresaAlvo), () => marcarMovido(alvo!.leadId, "descartado"))}>
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>
      </Dialogo>

      <DialogoRespostaManual
        aberto={modal === "resposta"} pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => { setModal(null); setAlvo(null); }}
        aoConfirmar={(canal, observacao) => rodar(
          () => acoes.mover(alvo!.leadId, "respondeu", { confirmacaoManual: { canal, observacao } }),
          textoDoMovimento("respondeu", empresaAlvo), () => marcarMovido(alvo!.leadId, "respondeu"))}
      />

      {/* `key` pela operação: trocar de ação remonta o diálogo e descarta o valor anterior. */}
      <DialogoMassa
        key={operacaoMassa ?? "nenhuma"}
        aberto={modal === "massa"} quantidade={selecionados.length} operacao={operacaoMassa} responsaveis={responsaveis}
        listas={opcoes.listas} cadencias={cadencias}
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
          aberto={modal === "importar"} listas={opcoes.listas} responsaveis={responsaveis}
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

function textoPasso(l: LinhaProspeccao): string {
  if (l.passoAtual == null || !l.totalPassos) return l.cadenciaStatus === "paused" ? "pausada" : "";
  const base = l.cadenciaStatus === "completed" ? `concluída · ${l.totalPassos} passos` : `passo ${l.passoAtual} de ${l.totalPassos}`;
  const extra = l.cadenciaStatus === "paused" ? " · pausada" : l.cadenciaStatus === "failed" ? " · falhou" : l.proximaAcaoEm ? ` · próxima ${dataCurta(l.proximaAcaoEm)}` : "";
  return base + extra;
}

const semAssinatura = () => () => undefined;
/** false no servidor e na hidratação, true depois: o Radix gera ids que divergem entre os dois. */
const useMontado = () => useSyncExternalStore(semAssinatura, () => true, () => false);

/** Cartão do Kanban: arrastável com o mouse; o menu "Mover para" é o caminho de teclado e de toque. */
function CartaoProspect({ l, aberto, pendente, aoAbrir, aoArrastar, aoMover }: {
  l: LinhaProspeccao; aberto: boolean; pendente: boolean;
  aoAbrir: () => void; aoArrastar: (on: boolean) => void; aoMover: (para: EstadoProspeccao) => void;
}) {
  const destinos = destinosPermitidos(l.estado);
  const montado = useMontado();
  return (
    <div className="pp-card" draggable={!pendente} data-pendente={pendente || undefined} data-aberto={aberto || undefined}
      data-lead={l.leadId}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.leadId); aoArrastar(true); }}
      onDragEnd={() => aoArrastar(false)}>
      <button type="button" className="ov-card" onClick={aoAbrir}>
        <span className="ov-card-empresa">{l.empresa}</span>
        <span className="ov-card-pessoa">{l.pessoa ? `${l.pessoa}${l.cargo ? ` · ${l.cargo}` : ""}` : "Sem pessoa associada"}</span>
        <span className="ov-card-meta">
          {l.setor ? <Tag>{l.setor}</Tag> : null}
          {l.lista ? <Tag tom="info">{l.lista}</Tag> : null}
          {l.preQualificado && l.estado !== "pre_qualificado" ? <Tag tom="sucesso">Pré-qualificado</Tag> : null}
        </span>
        {l.cadencia ? <span className="ov-card-pessoa">{l.cadencia}{textoPasso(l) ? ` · ${textoPasso(l)}` : ""}</span> : null}
        <span className="ov-card-rodape">
          <span>{l.responsavel ?? "Sem responsável"}</span>
          <span>{dataCurta(l.proximaAcaoEm)}</span>
        </span>
      </button>
      {destinos.length > 0 && !montado ? (
        <button type="button" className="pp-card-menu" aria-label={`Mover ${l.empresa} para…`} disabled><MoreHorizontal aria-hidden /></button>
      ) : null}
      {destinos.length > 0 && montado ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="pp-card-menu" aria-label={`Mover ${l.empresa} para…`}><MoreHorizontal aria-hidden /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {destinos.map((p) => (
              <DropdownMenuItem key={p} onSelect={() => aoMover(p)}>{ROTULO_ACAO[p]}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function DialogoRespostaManual({ aberto, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean; pendente: boolean; bloqueio: { mensagem: string } | null; aoFechar: () => void;
  aoConfirmar: (canal: string, observacao: string) => Promise<boolean>;
}) {
  const [canal, setCanal] = useState("WhatsApp");
  const [observacao, setObservacao] = useState("");
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Confirmar resposta manualmente"
      descricao="Não há resposta deste prospect registrada no Atendimento nem na cadência. Se ele respondeu por outro meio, confirme aqui: a confirmação fica auditada no histórico, com o seu nome.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label><span>Canal da resposta</span>
          <select value={canal} onChange={(e) => setCanal(e.target.value)}>{CANAIS_RESPOSTA.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label><span>O que ele respondeu *</span>
          <textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: pediu proposta por telefone" />
        </label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || observacao.trim().length < 3}
            onClick={() => aoConfirmar(canal, observacao)}>Confirmar resposta</button>
        </div>
      </div>
    </Dialogo>
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

  /* Mesmo recurso do importador de Contatos: o CSV de exemplo tem exatamente as
     colunas que `lerCsvProspect` reconhece, então baixar, preencher e subir
     funciona sem renomear nada. BOM para o Excel abrir com acento certo. */
  function baixarModelo() {
    const linhasModelo = [
      ["empresa", "cnpj", "site", "contato", "cargo", "email", "telefone"],
      ["Nexa Tecnologia", "12.345.678/0001-90", "nexa.com.br", "Mariana Souza", "Head de CX", "mariana@nexa.com.br", "+55 11 99999-9999"],
      ["Vetor Log", "", "vetorlog.com.br", "Paula Reis", "Diretora de Operações", "paula@vetorlog.com.br", "+55 21 97777-6666"],
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + linhasModelo.map((l) => l.join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "onface-modelo-prospeccao.csv";
    document.body.appendChild(a); a.click(); a.remove();
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
        <button type="button" className="ov-botao" data-variante="neutro" onClick={baixarModelo}>
          <Download aria-hidden />Baixar modelo (CSV de exemplo)
        </button>
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
