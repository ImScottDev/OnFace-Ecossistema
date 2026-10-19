"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Prospecção — o adaptador.
 *
 * Mesmo desenho de Pré-vendas e Pipeline, em três peças:
 *
 *   ProspeccaoDesenho.tsx  o markup, derivado do board de Pré-vendas
 *   ProspeccaoLiga.tsx     a lógica de TELA (menus, arrastar, seleção)
 *   ProspeccaoProto.tsx    ESTE: liga a tela aos comandos de domínio
 *
 * Aqui mora o fluxo do movimento: a tela decide a pergunta (cadência, motivo,
 * família, confirmação) pela MESMA função de transição do backend, e o backend
 * valida e executa. Feedback por toast, como em Pré-vendas; o movimento é
 * otimista e reverte se o servidor recusar.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { LinhaProspeccao, OperacaoProspeccao } from "@/lib/vendas/consultas";
import type { DetalheDoProspect } from "@/lib/vendas/prospeccao-detalhe";
import type { ResultadoDoMovimento } from "@/lib/vendas/prospeccao";
import { COR_DA_ETIQUETA_NOVA, type EstadoProspeccao, type Familia, type MotivoDescarte } from "@/lib/vendas/dominio";
import { transicao } from "@/lib/vendas/prospeccao-transicoes";
import type { Resultado } from "@/lib/vendas/resultado";
import { montarPayloadMassa, montarUrlProspeccao, resumirExecucaoEmMassa, type LinhaCsvProspect, type OperacaoMassa } from "../vendas/prospeccao-acoes";
import { ProspeccaoLiga, type AlvoMov, type Visao } from "./ProspeccaoLiga";
import { ProspeccaoGaveta } from "./ProspeccaoGavetaDesenho";
import { usePecas } from "./pecas-host";
import {
  ModalCadencia, ModalDescartar, ModalImportar, ModalMassaTexto, ModalNovoProspect, ModalOportunidade, ModalResposta,
  type EntradaProspect,
} from "./ProspeccaoModaisDesenho";
import { VisaoCampanhas, VisaoInteligencia, VisaoOperacao } from "./ProspeccaoVisoesDesenho";

export type { Visao, EntradaProspect };

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
  cadenciaId: string | null; fila: string | null; ordem: string | null; direcao: "asc" | "desc" | null;
}

export interface AcoesProspeccao {
  adicionar: (e: EntradaProspect) => Promise<Resultado<{ leadId: string; jaExistia: boolean }>>;
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

const FALHA_DE_REDE = "Não foi possível falar com o CRM. A ação não foi aplicada.";
const MENSAGEM: Record<string, (e: string) => string> = {
  em_cadencia: (e) => `${e} entrou em cadência.`, respondeu: (e) => `${e} marcada como respondeu.`,
  sem_resposta: (e) => `${e} marcada como sem resposta.`, pre_qualificado: (e) => `${e} entregue a Pré-vendas, na etapa Novo.`,
  oportunidade: (e) => `Oportunidade de ${e} criada no Pipeline, etapa Entrada.`, descartado: (e) => `${e} descartada. O histórico foi preservado.`,
};

type Fluxo = null | "novo" | "importar" | "cadencia" | "oportunidade" | "descartar" | "resposta" | "massa-texto";

export function ProspeccaoProto({
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
  abertoId: string | null;
  porColuna: number;
  motivoSemEnriquecer?: string | null;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = React.useTransition();
  const [fluxo, setFluxo] = React.useState<Fluxo>(null);
  const [alvo, setAlvo] = React.useState<AlvoMov | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [pendenteId, setPendenteId] = React.useState<string | null>(null);
  const [selecionados, setSelecionados] = React.useState<string[]>([]);
  const [opMassa, setOpMassa] = React.useState<OperacaoMassa | null>(null);
  const [versao, setVersao] = React.useState(0);

  /* A peça ÚNICA de cadência, pelo hospedeiro global da casca. O registro que
     esta tela abre é um LEAD (`leads.id`) — é o id que as ações de prospecção,
     /pessoas/<id> e `acaoInscreverEmCadencia` já usam —, então o tipo
     informado à peça é "lead". */
  const { abrir: abrirPeca } = usePecas();
  const inserirEmCadencia = React.useCallback((leadId: string, nome: string) => {
    window.__ofCadAlvo = { chave: leadId, nome, tipo: "lead" };
    abrirPeca("cadencia", leadId, { tela: "prospeccao", leadId });
  }, [abrirPeca]);

  /* Movimentos otimistas valem só para a leitura em que foram feitos: quando o
     servidor devolve dados novos (`fonte` muda de identidade) eles caducam e a
     tela passa a mostrar o que ficou gravado. */
  const fonte = kanban ?? dados;
  const [mov, setMov] = React.useState<{ fonte: unknown; mapa: Record<string, EstadoProspeccao> }>({ fonte: null, mapa: {} });
  const movidos = mov.fonte === fonte ? mov.mapa : {};
  const marcarMovido = (id: string, para: EstadoProspeccao | null) =>
    setMov((m) => {
      const base = m.fonte === fonte ? m.mapa : {};
      const proximo = { ...base };
      if (para) proximo[id] = para; else delete proximo[id];
      return { fonte, mapa: proximo };
    });

  const navegar = React.useCallback((mudancas: Record<string, string | null>) => {
    iniciarNavegacao(() => router.push(montarUrlProspeccao(window.location.href, mudancas)));
  }, [router]);

  const fechar = () => { setFluxo(null); setAlvo(null); setErro(null); setOpMassa(null); };

  /** Executa um comando dentro de um diálogo: erro fica no diálogo, sucesso fecha e avisa. */
  async function rodar(fn: () => Promise<Resultado<unknown>>, mensagem: string, aoOk?: () => void) {
    setOcupado(true); setErro(null);
    let r: Resultado<unknown>;
    try { r = await fn(); } catch { r = { ok: false, erro: FALHA_DE_REDE }; }
    setOcupado(false);
    if (!r.ok) { setErro(r.erro); return false; }
    const destino = (r.dados as { destino?: { rota: string; rotulo: string } | null } | undefined)?.destino;
    avisarOk(mensagem, destino ?? null);
    fechar(); aoOk?.(); setVersao((v) => v + 1); router.refresh();
    return true;
  }
  function avisarOk(texto: string, destino: { rota: string; rotulo: string } | null) {
    toast.success(texto, destino ? { action: { label: destino.rotulo, onClick: () => router.push(destino.rota) } } : undefined);
  }

  /** Movimento direto (sem diálogo): otimista, com reversão se o backend recusar. */
  async function mover(a: AlvoMov, para: EstadoProspeccao) {
    marcarMovido(a.leadId, para);
    setPendenteId(a.leadId);
    let r: Resultado<ResultadoDoMovimento>;
    try { r = await acoes.mover(a.leadId, para, {}); } catch { r = { ok: false, erro: FALHA_DE_REDE }; }
    setPendenteId(null);
    if (!r.ok) {
      marcarMovido(a.leadId, null);
      if (r.acao?.tipo === "confirmar_resposta") { setAlvo(a); setErro(null); setFluxo("resposta"); }
      else toast.error(r.erro);
      if (r.codigo === "prospect_mudou") router.refresh();
      return;
    }
    avisarOk(MENSAGEM[para]?.(a.empresa) ?? "Alteração salva.", r.dados?.destino ?? null);
    setVersao((v) => v + 1);
    router.refresh();
  }

  /** Decide a pergunta pela mesma regra que o backend aplica. */
  function pedirMovimento(a: AlvoMov, para: EstadoProspeccao) {
    const t = transicao(a.estado, para);
    if (!t.permitida) { if (!t.igual) toast.warning(t.motivo); return; }
    if ((para === "pre_qualificado" || para === "oportunidade") && !a.empresaId) {
      toast.warning("Prospect sem empresa: vincule uma empresa antes de entregar ou criar oportunidade.");
      return;
    }
    setErro(null);
    if (t.exige === "cadencia") { setAlvo(a); setFluxo("cadencia"); return; }
    if (t.exige === "motivo") { setAlvo(a); setFluxo("descartar"); return; }
    if (t.exige === "familia_e_responsavel") { setAlvo(a); setFluxo("oportunidade"); return; }
    void mover(a, para);
  }

  async function atribuir(leadId: string, responsavelId: string | null) {
    const r = await acoes.atribuir(leadId, responsavelId);
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success("Responsável atualizado.");
    setVersao((v) => v + 1);
    router.refresh();
  }

  /* ── ações em massa ── */
  async function resultadoApi(url: string, init: RequestInit): Promise<Resultado> {
    try {
      const resposta = await fetch(url, init);
      const corpo = await resposta.json().catch(() => ({}));
      return resposta.ok ? { ok: true } : { ok: false, erro: corpo.error ?? "A operação não pôde ser concluída." };
    } catch { return { ok: false, erro: FALHA_DE_REDE }; }
  }
  async function localizarOuCriarTag(nome: string): Promise<Resultado<{ id: string }>> {
    const existentes = await fetch("/api/labels");
    const tags = await existentes.json().catch(() => []);
    if (!existentes.ok || !Array.isArray(tags)) return { ok: false, erro: "Não foi possível carregar as tags." };
    const achada = tags.find((t: { id: string; nome: string }) => t.nome.toLowerCase() === nome.toLowerCase());
    if (achada) return { ok: true, dados: { id: achada.id } };
    const criada = await resultadoApi("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, cor: COR_DA_ETIQUETA_NOVA }) });
    if (!criada.ok) return criada;
    const nova = await (await fetch("/api/labels")).json().catch(() => []);
    const agora = Array.isArray(nova) && nova.find((t: { id: string; nome: string }) => t.nome.toLowerCase() === nome.toLowerCase());
    return agora ? { ok: true, dados: { id: agora.id } } : { ok: false, erro: "A tag foi criada, mas não pôde ser localizada." };
  }
  async function aplicarLabel(nome: string): Promise<Resultado> {
    const tag = await localizarOuCriarTag(nome);
    if (!tag.ok || !tag.dados) return tag.ok ? { ok: false, erro: "Tag não localizada." } : tag;
    const rs = await Promise.all(selecionados.map((leadId) => resultadoApi(`/api/leads/${leadId}/labels`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labelId: tag.dados!.id }),
    })));
    const resumo = resumirExecucaoEmMassa(rs);
    return resumo.ok ? { ok: true } : { ok: false, erro: resumo.mensagem };
  }
  async function massa(op: OperacaoMassa, valor: string | null, mensagem: string) {
    const payload = montarPayloadMassa(op, valor);
    let fn: () => Promise<Resultado<unknown>>;
    switch (payload.tipo) {
      case "invalido": fn = async () => ({ ok: false, erro: payload.erro }); break;
      case "responsavel": fn = () => acoes.atribuirEmMassa(selecionados, payload.responsavelId); break;
      case "cadencia": fn = async () => {
        const rs = await Promise.all(selecionados.map((id) => acoes.inscreverEmCadencia(id, payload.cadenceDefinitionId)));
        const s = resumirExecucaoEmMassa(rs); return s.ok ? { ok: true } : { ok: false, erro: s.mensagem };
      }; break;
      case "pausar": fn = async () => {
        const rs = await Promise.all(selecionados.map((id) => acoes.pausarCadencia(id, "Pausado em massa")));
        const s = resumirExecucaoEmMassa(rs); return s.ok ? { ok: true } : { ok: false, erro: s.mensagem };
      }; break;
      case "enriquecer": fn = () => resultadoApi("/api/leads/enrich-bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filter: "selected", ids: selecionados }) }); break;
      default: fn = () => aplicarLabel(payload.nome);
    }
    let r: Resultado<unknown>;
    try { r = await fn(); } catch { r = { ok: false, erro: FALHA_DE_REDE }; }
    if (!r.ok) { toast.error(r.erro); setErro(r.erro); return false; }
    toast.success(mensagem);
    setSelecionados([]); fechar(); router.refresh();
    return true;
  }

  /* ── dados da tela ── */
  const todosCards = kanban ? kanban.colunas.flatMap((c) => c.cards) : [];
  const resumo = (dados ?? kanban)?.resumo ?? null;
  const estadoDe = (l: LinhaProspeccao) => movidos[l.leadId] ?? l.estado;
  const delta = (estado: EstadoProspeccao) => todosCards.reduce((n, l) => {
    const novo = movidos[l.leadId];
    if (!novo) return n;
    return n + (novo === estado ? 1 : 0) - (l.estado === estado && novo !== estado ? 1 : 0);
  }, 0);
  const contaDe = (estado: EstadoProspeccao) => (resumo?.[estado] ?? 0) + delta(estado);

  const colunas = (kanban?.colunas ?? []).map((c) => {
    const cards = todosCards.filter((l) => estadoDe(l) === c.estado).map((l) => ({ ...l, estado: estadoDe(l) }));
    const total = Math.max(contaDe(c.estado), cards.length);
    return { estado: c.estado, total, cards, restantes: Math.max(0, total - cards.length) };
  });

  const corpoOutro = operacao
    ? visao === "campanhas" ? <VisaoCampanhas op={operacao} /> : visao === "inteligencia" ? <VisaoInteligencia op={operacao} /> : <VisaoOperacao op={operacao} />
    : null;
  const emCadenciaSelecionadas = (dados?.linhas ?? []).filter((l) => selecionados.includes(l.leadId) && l.estado === "em_cadencia").length
    + todosCards.filter((l) => selecionados.includes(l.leadId) && estadoDe(l) === "em_cadencia").length;

  const quantidade = selecionados.length;
  return (
    <>
      <ProspeccaoLiga
        visao={visao}
        trocarVisao={(v) => { setSelecionados([]); navegar({ visao: v === "lista" ? null : v, lead: null, estado: null, pagina: null, mostrar: null, ordem: null, dir: null }); }}
        navegar={navegar}
        filtro={filtro} opcoes={opcoes}
        linhas={dados?.linhas ?? []} paginacao={dados?.paginacao ?? null} resumo={resumo}
        colunas={colunas} contaDesfecho={contaDe}
        pendenteId={pendenteId} abertoId={abertoId}
        selecionados={selecionados} setSelecionados={setSelecionados}
        aoAbrir={(id) => navegar({ lead: id })}
        aoPedirMovimento={pedirMovimento}
        aoAtribuir={atribuir}
        aoVerMais={() => navegar({ mostrar: String(porColuna + 25) })}
        topo={{
          adicionar: () => { setErro(null); setFluxo("novo"); },
          importar: acoes.importar ? () => { setErro(null); setFluxo("importar"); } : null,
          apollo: () => router.push("/prospeccao/apollo"),
        }}
        massa={{
          responsaveis, cadencias, emCadenciaSelecionadas, motivoSemEnriquecer,
          aoResponsavel: (id) => { void massa("responsavel", id, "Responsável atualizado."); },
          aoCadencia: (id) => { void massa("cadencia", id, "Empresas inscritas na cadência."); },
          aoTexto: (op) => { setErro(null); setOpMassa(op); setFluxo("massa-texto"); },
          aoPausar: () => { void massa("pausar", null, "Cadências pausadas."); },
          aoEnriquecer: () => { void massa("enriquecer", null, "Enriquecimento enfileirado."); },
          aviso: (m) => toast.warning(m),
        }}
        corpoOutro={corpoOutro}
      />

      {abertoId ? (
        <DrawerCarregado key={abertoId} leadId={abertoId} versao={versao} acoes={acoes} equipe={responsaveis}
          fechar={() => navegar({ lead: null })} mover={pedirMovimento} atribuir={atribuir}
          ir={(rota) => router.push(rota)}
          inserirEmCadencia={inserirEmCadencia}
          pausar={async (retomar) => {
            const r = retomar ? await acoes.retomarCadencia(abertoId) : await acoes.pausarCadencia(abertoId, "Pausado manualmente");
            if (r.ok) { toast.success(retomar ? "Cadência retomada." : "Cadência pausada."); setVersao((v) => v + 1); router.refresh(); } else toast.error(r.erro);
          }} />
      ) : null}

      <ModalNovoProspect key={`novo-${fluxo === "novo"}`} aberto={fluxo === "novo"} fechar={fechar} listas={opcoes.listas} responsaveis={responsaveis} pendente={ocupado} erro={erro}
        confirmar={(e) => {
          setOcupado(true); setErro(null);
          acoes.adicionar(e).then((r) => {
            setOcupado(false);
            if (!r.ok) { setErro(r.erro); return; }
            toast.success(r.dados?.jaExistia ? `${e.empresa.trim()} já estava na base; nada foi duplicado.` : `${e.empresa.trim()} adicionada à base outbound.`);
            fechar(); setVersao((v) => v + 1); router.refresh();
          }, () => { setOcupado(false); setErro(FALHA_DE_REDE); });
        }} />
      {acoes.importar ? (
        <ModalImportar key={`imp-${fluxo === "importar"}`} aberto={fluxo === "importar"} fechar={fechar} listas={opcoes.listas} responsaveis={responsaveis} pendente={ocupado} erro={erro}
          confirmar={(linhas, comum) => {
            setOcupado(true); setErro(null);
            acoes.importar!(linhas, comum).then((r) => {
              setOcupado(false);
              if (!r.ok) { setErro(r.erro); return; }
              const { criados = 0, jaExistiam = 0, falhas = 0 } = r.dados ?? {};
              toast.success(`${criados} ${criados === 1 ? "empresa adicionada" : "empresas adicionadas"}${jaExistiam ? `, ${jaExistiam} já estavam na base` : ""}${falhas ? `, ${falhas} com erro` : ""}.`);
              fechar(); router.refresh();
            }, () => { setOcupado(false); setErro(FALHA_DE_REDE); });
          }} />
      ) : null}
      <ModalCadencia key={`cad-${fluxo === "cadencia"}`} aberto={fluxo === "cadencia"} fechar={fechar} cadencias={cadencias} pendente={ocupado} erro={erro}
        escolher={(id) => alvo && rodar(() => acoes.mover(alvo.leadId, "em_cadencia", { cadenceDefinitionId: id }), MENSAGEM.em_cadencia(alvo.empresa), () => marcarMovido(alvo.leadId, "em_cadencia"))} />
      <ModalDescartar key={`desc-${fluxo === "descartar"}`} aberto={fluxo === "descartar"} fechar={fechar} pendente={ocupado} erro={erro}
        confirmar={(m) => alvo && rodar(() => acoes.mover(alvo.leadId, "descartado", { motivoDescarte: m }), MENSAGEM.descartado(alvo.empresa), () => marcarMovido(alvo.leadId, "descartado"))} />
      <ModalOportunidade key={`opp-${fluxo === "oportunidade"}`} aberto={fluxo === "oportunidade"} fechar={fechar} responsaveis={responsaveis} pendente={ocupado} erro={erro}
        confirmar={(familias, responsavelId) => alvo && rodar(() => acoes.mover(alvo.leadId, "oportunidade", { familias, responsavelId }), MENSAGEM.oportunidade(alvo.empresa), () => marcarMovido(alvo.leadId, "oportunidade"))} />
      <ModalResposta key={`resp-${fluxo === "resposta"}`} aberto={fluxo === "resposta"} fechar={fechar} pendente={ocupado} erro={erro}
        confirmar={(canal, observacao) => alvo && rodar(() => acoes.mover(alvo.leadId, "respondeu", { confirmacaoManual: { canal, observacao } }), MENSAGEM.respondeu(alvo.empresa), () => marcarMovido(alvo.leadId, "respondeu"))} />
      {fluxo === "massa-texto" ? (
        <ModalMassaTexto key={opMassa ?? "x"} operacao={opMassa} quantidade={quantidade} listas={opcoes.listas} fechar={fechar} pendente={ocupado} erro={erro}
          confirmar={(v) => { if (opMassa) void massa(opMassa, v, "Ação em massa aplicada."); }} />
      ) : null}
    </>
  );
}

/** Carrega o detalhe do prospect e entrega à gaveta; relê quando algo grava. */
function DrawerCarregado({ leadId, versao, acoes, equipe, fechar, mover, atribuir, pausar, ir, inserirEmCadencia }: {
  leadId: string; versao: number; acoes: AcoesProspeccao; equipe: Array<{ id: string; nome: string }>;
  fechar: () => void; mover: (a: AlvoMov, para: EstadoProspeccao) => void; atribuir: (id: string, r: string | null) => void;
  pausar: (retomar: boolean) => void; ir: (rota: string) => void;
  inserirEmCadencia: (leadId: string, nome: string) => void;
}) {
  const chave = `${leadId}:${versao}`;
  const [estado, setEstado] = React.useState<{ chave: string; d: DetalheDoProspect | null; erro: string | null }>({ chave: "", d: null, erro: null });
  React.useEffect(() => {
    let vivo = true;
    acoes.detalhe(leadId)
      .then((r) => { if (vivo) setEstado({ chave, d: r.ok ? r.dados ?? null : null, erro: r.ok ? null : r.erro }); })
      .catch(() => { if (vivo) setEstado({ chave, d: null, erro: "Não foi possível carregar o prospect." }); });
    return () => { vivo = false; };
  }, [chave, leadId, acoes]);
  return (
    <ProspeccaoGaveta detalhe={estado.d} carregando={estado.chave !== chave} erro={estado.erro} equipe={equipe}
      fechar={fechar} mover={mover} atribuir={atribuir} pausar={pausar} ir={ir} inserirEmCadencia={inserirEmCadencia} />
  );
}

