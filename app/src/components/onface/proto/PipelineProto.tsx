"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Pipeline — o adaptador.
 *
 * `PipelineDesenho` é o markup convertido do handoff e `PipelineLiga` é a
 * lógica dele, portada. Este arquivo é o que fica entre os dois e o produto:
 * traduz a oportunidade canônica para a forma que o desenho consome e liga
 * cada ação no command correspondente.
 *
 * É o único dos três escrito à mão, e de propósito — decidir qual campo do
 * domínio corresponde a qual campo do desenho é julgamento, e julgamento não
 * se automatiza.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Resultado } from "@/lib/vendas/resultado";
import type { BoardPipeline, CardPipeline } from "@/lib/vendas/consultas";
import { PipelineLiga } from "./PipelineLiga";
import { levarParametros } from "./rota-do-desenho";
import { persistirEtapa, type CommandsDeEtapa } from "./persistencia";
import { usePecas } from "./pecas-host";
import { DelegarAgenteHost } from "./DelegarAgenteHost";
import { quandoBR } from "@/lib/datas-br";
import { oportunidadeParaODesenho } from "./oportunidade-para-o-desenho";
import type { DetalheOportunidade } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";

/** Os commands que a tela precisa. A página é quem os passa. */
export type AcoesPipeline = CommandsDeEtapa & {
  /** No-show: devolve o lead ao Pre-vendas. Sem isto o botao avisa que nao grava. */
  noShow?: (negocioId: string, reuniaoId: string | null) => Promise<Resultado>;
  /** Detalhe completo (atividades, notas, timeline) carregado ao abrir o drawer. */
  detalhe?: (id: string) => Promise<Resultado<{ oportunidade: DetalheOportunidade | null; timeline: LinhaDoTempo[] }>>;
};

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/**
 * Os itens que o desenho soma para mostrar o valor.
 *
 * O quadro não desdobra a composição da proposta — só soma. Reproduzir o
 * total com dois itens agregados dá o número CERTO sem carregar item a item
 * para mais de mil cartões.
 */
function itensAgregados(total: number | null, recorrente: number | null) {
  const mrr = recorrente ?? 0;
  const avulso = (total ?? 0) - mrr;
  const itens: Array<{ nome: string; natureza: string; valor: number; qtd: number }> = [];
  if (mrr) itens.push({ nome: "Recorrente", natureza: "MRR", valor: mrr, qtd: 1 });
  if (avulso) itens.push({ nome: "Avulso", natureza: "ONE_TIME", valor: avulso, qtd: 1 });
  return itens;
}

/**
 * A oportunidade na forma do protótipo.
 *
 * O desenho nasceu sobre um mock com campos próprios (`resp`, `dias`, `atvs`,
 * `eventos`). Traduzir aqui, num lugar só, é o que mantém o markup intocado:
 * ele continua lendo os nomes que sempre leu.
 *
 * `atvs` e `eventos` ficam vazios de propósito. O mock trazia atividades e
 * timeline embutidas em cada oportunidade; no produto elas vivem em `tarefas`
 * e em `vendas_eventos`, e a tela carrega sob demanda ao abrir o drawer.
 * Preencher com array vazio é honesto — inventar linha para a timeline parecer
 * cheia seria o mock fingindo produção.
 */
/* O Tipo do desenho (Nova venda / Expansão) vem de commercial_motion. */
const TIPO_DO_MOTION: Record<string, string> = {
  NEW_BUSINESS: "nova", EXPANSION: "expansao", RENEWAL: "renovacao", REACTIVATION: "reativacao",
};

/* Campos que o card canônico traz e o CardPipeline da consulta ainda não declara. */
type CardComValores = CardPipeline & { mrr?: number | null; setup?: number | null; motion?: string | null };

function paraODesenho(card: CardPipeline) {
  const c = card as CardComValores;
  // Sem proposta o cartão ainda mostra o que a oportunidade já sabe, separando
  // MRR de setup/avulso. Com proposta, quem manda é `proposta.itens`.
  const itensProp: Array<{ nome: string; natureza: string; valor: number; qtd: number }> = [];
  if (c.mrr) itensProp.push({ nome: "Recorrente", natureza: "MRR", valor: c.mrr, qtd: 1 });
  const avulso = c.setup ?? ((c.valor ?? 0) - (c.mrr ?? 0));
  if (avulso > 0) itensProp.push({ nome: "Setup / avulso", natureza: "SETUP", valor: avulso, qtd: 1 });
  return {
    itensProp,
    tipo: TIPO_DO_MOTION[c.motion ?? ""] ?? "nova",
    id: c.id,
    empresa: c.empresa,
    empresaId: c.empresaId,
    pessoa: c.pessoa ?? "",
    cargo: c.cargo ?? "",
    familia: c.familia,
    familiaRotulo: c.familiaRotulo,
    etapa: c.etapa,
    resp: c.responsavel,
    iniciais: c.responsavelIniciais,
    // O cartão do Pipeline mostra VALOR, não MRR — regra do Bloco 02 §14.
    valor: c.valor,
    dias: c.diasNaEtapa ?? 0,
    titulo: c.titulo,
    acao: c.proximaAcao,
    acaoEm: c.proximaAcaoEm,
    badges: c.badges ?? [],
    /* O desenho quer a LISTA — `propostas.slice()`, `p.status`, `#codigo-vN`.
       Passar a contagem derrubava a tela inteira com "props.slice is not a
       function". `codigo` é o número da proposta no banco, não um `P-1540`
       inventado como no mock.

       Sem `itens`: o quadro não carrega item de proposta (seria uma varredura
       por cartão) e o cartão não mostra soma. Quem mostra é o detalhe. */
    propostas: c.propostasLista.map((p) => ({
      codigo: String(p.numero),
      versao: p.versao,
      status: p.status,
      enviadaEm: p.enviadaEm ? quandoBR(p.enviadaEm) : null,
      total: p.total,
      /* `somas()` no desenho percorre `proposta.itens` — é daí que saem o
         "R$ 1.950/mês" do cartão e o total no cabeçalho da coluna. Com a
         lista vazia, TODA coluna anunciava "Valor definido na proposta" e
         nenhum cartão mostrava valor, mesmo com proposta fechada.

         Dois itens agregados reproduzem exatamente `total_geral` e
         `total_recorrente` do banco. A composição real não entra aqui: o
         quadro não a desdobra, e carregá-la seria uma varredura por cartão. */
      itens: itensAgregados(p.total, p.totalRecorrente),
    })),
    leadId: c.leadId,
    motivoPerda: c.motivoPerda,
    tags: c.tags ?? [],
    pessoas: [],
    atvs: [],
    eventos: [],
    itens: [],
    // `base()` escolhe a vigente e preenche este campo; começar nulo é o certo.
    proposta: null,
  };
}

/* ── Persistência ──────────────────────────────────────────────────────── */


/**
 * O protótipo com as gravações ligadas.
 *
 * `gravarOpp` é o ponto ÚNICO por onde passam as onze mutações do desenho —
 * mover, ganhar, perder, editar proposta, atividade, reunião. Interceptar aqui
 * é o que permite ligar tudo sem encostar no arquivo gerado, que é regerado a
 * cada versão do handoff e portanto não se edita.
 *
 * O `super` continua fazendo o movimento otimista (o cartão anda na hora); o
 * servidor confirma depois, e quando recusa a tela relê e o cartão volta.
 */
class PipelineLigado extends PipelineLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }

  /* Mutacao sem command nao grava: o `persistir` avisa e a tela relê. O toast de sucesso que o
     desenho dispara logo depois seria mentira; fica calado ate o fim do tick. */
  private naoGrava = false;

  /* O cartão do quadro vem resumido (sem atividades, notas, timeline). Ao abrir o
     drawer, carrega o detalhe completo e mescla por cima, com o MESMO mapeamento
     da página /pipeline/[id]. Enquanto carrega, a timeline avisa. */
  componentDidUpdate(prevProps?: any, prevState?: any) {
    (super.componentDidUpdate as any)?.call(this, prevProps, prevState);
    const id = (this as any).state?.aberto;
    if (id && id !== prevState?.aberto) this.carregarDetalhe(id);
  }

  carregarDetalhe(id: string) {
    const carregar = (this as any).props?.carregarDetalhe;
    if (typeof carregar !== "function" || this.detalhes[id]) return;
    this.detalhes[id] = { eventos: [{ t: "Carregando histórico…", quando: "", autor: "" }], carregando: true };
    this.forceUpdate();
    void Promise.resolve(carregar(id)).then((r: any) => {
      if (r?.ok && r.dados?.oportunidade) {
        const d = oportunidadeParaODesenho(r.dados.oportunidade, r.dados.timeline ?? []);
        this.detalhes[id] = { propostas: d.propostas, atvs: d.atvs, notas: d.notas, eventos: d.eventos, arquivos: d.arquivos, pessoas: d.pessoas };
      } else delete this.detalhes[id];
      this.forceUpdate();
    }).catch(() => { delete this.detalhes[id]; this.forceUpdate(); });
  }

  private detalhes: Record<string, any> = {};

  base() {
    return (super.base() as any[]).map((o) => (this.detalhes[o.id] ? { ...o, ...this.detalhes[o.id] } : o));
  }

  gravarOpp(o: any, evento: string) {
    const antes = ((this as any).state.opps || []).find((x: any) => x.id === o.id);
    const novo = super.gravarOpp(o, evento);
    this.naoGrava = !antes || antes.etapa === novo.etapa;
    if (this.naoGrava) queueMicrotask(() => { this.naoGrava = false; });
    (this as any).props.persistir?.(antes, novo, evento || "Esta alteração");
    return novo;
  }

  /* super.diz recursava infinito (Liga: diz -> E.avisar -> this.diz -> override
     -> super.diz ...). Toast direto, igual aos outros protos. */
  diz(t: string, tom?: string) {
    if (this.naoGrava) return;
    if (tom === "erro") toast.error(t);
    else if (tom === "aviso") toast.warning(t);
    else toast.success(t);
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function PipelineProto({ dados, acoes }: { dados: BoardPipeline; acoes: AcoesPipeline }) {
  const router = useRouter();

  /* O protótipo guarda as oportunidades no PRÓPRIO estado, semeado uma vez no
     construtor. Sem remontar, a tela fica presa no que ela mesma escreveu e
     nunca mais enxerga o servidor — o cartão movido continuaria na coluna nova
     mesmo se o command tivesse recusado.

     `dados` é uma referência nova a cada resposta do servidor, então bumpar a
     chave quando ela muda faz a tela renascer sobre a verdade. O `ref` evita a
     remontagem à toa na primeira renderização. */
  const [geracao, setGeracao] = React.useState(0);
  const primeira = React.useRef(true);
  React.useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    setGeracao((n) => n + 1);
  }, [dados]);

  /* O catálogo estático do protótipo, agora vindo do domínio: a equipe é a
     lista real de responsáveis da organização.

     `EQUIPE` é uma lista de NOMES, não de objetos — o protótipo compara
     `F.resp.indexOf(o.resp)` com o nome que está no cartão. Passar `{id, nome}`
     faria o filtro nunca casar e o chip escrever "[object Object]".

     `LEADS` e `OPORTUNIDADES` ficam vazios de propósito: eram o mock, e o dado
     real entra por `dados`, logo abaixo. */
  const catalogo = React.useMemo(() => ({
    EQUIPE: dados.filtros.responsaveis.map((r) => r.nome),
    LEADS: [],
    OPORTUNIDADES: [],
  }), [dados.filtros.responsaveis]);

  const opps = React.useMemo(
    () => dados.colunas.flatMap((col) => col.cards).map(paraODesenho),
    [dados.colunas],
  );

  /* Total REAL da coluna (agregação do servidor). O cabeçalho usava a lista
     carregada, que é cortada por coluna e anunciava menos do que existe. */
  const totais = React.useMemo(() => Object.fromEntries(dados.colunas.map((col) => [
    col.chave,
    { n: col.total, valor: col.valorTotal, mrr: (col as { mrrTotal?: number }).mrrTotal ?? null },
  ])), [dados.colunas]);

  /**
   * As peças que o desenho pede abrir.
   *
   * O protótipo abre tudo por um barramento; aqui cada uma vira navegação ou
   * um aviso honesto. Peça sem destino real NÃO é aberta em silêncio: o
   * usuário fica sabendo que aquilo ainda não existe, em vez de clicar num
   * modal que não grava.
   */
  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "oportunidade" && id) { router.push(`/pipeline/${id}`); return; }
    if (peca === "empresa" && id) { router.push(`/empresas/${id}`); return; }
    abrirPeca(peca, id, { tela: "pipeline" });
  }, [router, abrirPeca]);

  /**
   * Toda mutação do desenho, traduzida para o command certo.
   *
   * O desenho mexe em onze coisas; o domínio tem command para três delas hoje
   * (mover, perder, ganhar). O resto NÃO grava — e o certo é dizer isso e
   * desfazer, não deixar a tela parecendo que gravou. Foi esse silêncio que
   * custou caro em Pré-vendas: o cartão andava, o toast dizia "ok", e no
   * reload estava tudo como antes.
   */
  /**
   * O CTA que o domínio manda junto com a recusa.
   *
   * "Defina a família antes de avançar" sem um caminho para definir a família
   * deixa o operador sabendo o problema e não a saída. O detalhe da
   * oportunidade é onde os dois se resolvem.
   */
  const destravar = React.useCallback((tipo: string, id: string) => {
    // Família faltando (legado): abre o seletor de família já na entrada do detalhe.
    if (tipo === "alterar_familia") { router.push(`/pipeline/${id}?definir=familia`); return; }
    router.push(`/pipeline/${id}`);
  }, [router]);

  const persistir = React.useCallback(async (antes: any, depois: any, evento: string) => {
    const d = await persistirEtapa(antes, depois, evento, acoes);
    if (d.tipo === "gravou") { router.refresh(); return; }

    /* Recusa e "não tem command" desfazem do mesmo jeito: a tela reléem do
       servidor e o cartão volta para onde estava de verdade. O que muda é a
       mensagem — e, quando o domínio manda um CTA, o botão que destrava. */
    toast.error(d.motivo, d.tipo === "recusado" && d.acao
      ? { action: { label: d.acao.rotulo, onClick: () => destravar(d.acao!.tipo, depois.id) } }
      : undefined);
    router.refresh();
  }, [acoes, router, destravar]);

  const registrarNoShow = React.useCallback(async (id: string) => {
    if (!acoes.noShow) { toast.error("Registrar no-show ainda não é gravado por esta tela."); return; }
    const r = await acoes.noShow(id, null);
    if (!r.ok) toast.error(r.erro); else toast.success("No-show registrado. O lead voltou ao Pré-vendas.");
    router.refresh();
  }, [acoes, router]);

  return (
    <div data-workspace="desenho">
      <PipelineLigado
        key={geracao}
        dados={{ opps, leads: [], totais }}
        catalogo={catalogo}
        abrir={abrir}
        persistir={persistir}
        registrarNoShow={registrarNoShow}
        carregarDetalhe={acoes.detalhe}
        ir={(href: string) => router.push(href)}
      />
      <DelegarAgenteHost />
    </div>
  );
}
