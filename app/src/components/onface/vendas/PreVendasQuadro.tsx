"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { BoardPreVendas, CardPreVendas } from "@/lib/vendas/consultas";
import type { EstagioPreVendas } from "@/lib/vendas/dominio";
import type { AcoesPreVendas } from "./PreVendas";
import type { DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { GavetaLead } from "./GavetaLead";
import { SaidasLead, type LeadDaSaida, type Saida } from "./SaidasLead";
import { AtividadeLead } from "./AtividadeLead";
import { ExportarLeads } from "./ExportarLeads";
import { BarraSelecao } from "./BarraSelecao";
import "./barra-selecao.css";
import "./pre-vendas-quadro.css";
import "./gaveta-lead.css";

/* ─────────────────────────────────────────────────────────────────────────
 * Pré-vendas — réplica do protótipo `OnFace Pre-vendas.dc.html`.
 *
 * Estrutura do desenho, de cima para baixo: barra de controles (busca local,
 * quatro filtros split, "Filtros" tracejado, alternador Quadro/Lista,
 * Exportar e Novo lead coral dividido), faixa de indicadores em texto puro, e
 * então o quadro ou a lista.
 *
 * **Etapa não é campo, é consequência.** O protótipo deixa arrastar livremente
 * só entre Novo, Em contato e Qualificação; Qualificado, Oportunidade,
 * Nutrição e Desqualificado PEDEM confirmação antes de gravar, e é por isso
 * que `acoes.moverEtapa` aceita só as três primeiras. Soltar numa coluna de
 * confirmação diz o que ela vai pedir em vez de mover por baixo dos panos.
 * ───────────────────────────────────────────────────────────────────────── */

type ChaveColuna = EstagioPreVendas;

const COLUNAS: Array<{
  k: ChaveColuna;
  label: string;
  cor: string;
  vazio: string;
  icone: string;
  /** Recebe arrasto sem perguntar nada. */
  livre?: boolean;
  /** Pede confirmação antes de gravar. A saída que o drop abre. */
  saida?: Saida;
  /** Confirmação que ainda não tem peça própria — anuncia o que vai pedir. */
  confirma?: string;
  recolhivel?: boolean;
}> = [
  { k: "novo", label: "Novo", cor: "#4a5560", livre: true,
    vazio: "Lead inbound cai aqui e já nasce com a tarefa de primeiro contato.",
    icone: "M12 5v14M5 12h14" },
  { k: "em_contato", label: "Em contato", cor: "#4c8fe0", livre: true,
    vazio: "Arraste um lead para cá ao registrar a primeira tentativa.",
    icone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" },
  { k: "qualificacao", label: "Qualificação", cor: "#9b8bd8", livre: true,
    vazio: "Arraste para começar a apurar critérios. Preencher campos não qualifica.",
    icone: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
  { k: "qualificado", label: "Qualificado", cor: "#2f9e7a",
    saida: "qualificar",
    confirma: "Qualificar pede os critérios antes de gravar: interesse, tamanho da operação, dor e fit.",
    vazio: "Soltar aqui abre os critérios. Qualificar grava um fato que sobrevive à etapa seguinte.",
    icone: "M4 11h16v10H4zM8 11V7a4 4 0 0 1 8 0v4" },
  { k: "oportunidade", label: "Oportunidade", cor: "#fe4f2b",
    /* Era só `confirma`: soltar aqui mostrava um toast explicando o que ia
       pedir e não pedia nada. A passagem mais importante do funil — lead vira
       negócio — era a única saída sem peça, e o próprio código dizia "peça a
       desenhar". Agora abre o mesmo modal das outras saídas. */
    saida: "oportunidade",
    vazio: "Cria uma oportunidade real no Pipeline. Bloqueado sem empresa associada.",
    icone: "M4 11h16v10H4zM8 11V7a4 4 0 0 1 8 0v4" },
  { k: "nutricao", label: "Nutrição", cor: "#c8a86a", recolhivel: true,
    saida: "nutrir",
    confirma: "Nutrição pede motivo e data de retomada — nutrição não é lixeira elegante.",
    vazio: "Soltar aqui pede motivo e data de retomada — nutrição não é lixeira elegante.",
    icone: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
  { k: "desqualificado", label: "Desqualificado", cor: "#4a5560", recolhivel: true,
    saida: "desqualificar",
    confirma: "Desqualificar pede motivo — é o que sustenta relatório de perda depois.",
    vazio: "Soltar aqui pede motivo — é o que sustenta relatório de perda depois.",
    icone: "M6 6l12 12M18 6L6 18" },
];

const numero = new Intl.NumberFormat("pt-BR");

/** Duração humana: o protótipo pede "tempo até 1º contato" numa linha só. */
function duracao(horas: number | null): string {
  if (horas == null) return "—";
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1).replace(".", ",")} h`;
  return `${(horas / 24).toFixed(1).replace(".", ",")} dias`;
}

/* Os CINCO do protótipo, nesta ordem. Antes daqui a tela mostrava outros três
   no lugar dos três últimos — os que já tinham número pronto na consulta — e
   a linha de apoio trazia o trecho de SQL que o handoff usa para dizer DE ONDE
   vem o número. No protótipo isso faz sentido: não há banco. Aqui há, e quem
   lê a tela precisa do valor, não da cláusula. */
const INDICADORES: Array<{ label: string; valor: (r: BoardPreVendas["resumo"]) => string }> = [
  { label: "Leads ativos", valor: (r) => numero.format(r.ativos) },
  { label: "Sem primeiro contato", valor: (r) => numero.format(r.semPrimeiroContato) },
  { label: "Sem próxima ação", valor: (r) => numero.format(r.semProximaAcao) },
  { label: "Qualificados no mês", valor: (r) => numero.format(r.qualificadosNoMes) },
  { label: "Tempo até 1º contato", valor: (r) => duracao(r.horasAteContato) },
];

type ChaveFiltro = "responsavel" | "origem" | "interesse" | "sla";

const FILTROS: Array<{ k: ChaveFiltro; label: string; titulo: string; icone: string }> = [
  { k: "responsavel", label: "Responsável", titulo: "RESPONSÁVEL",
    icone: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
  { k: "origem", label: "Origem", titulo: "CANAL DE ENTRADA",
    icone: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9" },
  { k: "interesse", label: "Interesse", titulo: "SERVIÇO DE INTERESSE",
    icone: "M20.6 13.4 12 22l-8.6-8.6A5 5 0 1 1 12 6.4a5 5 0 1 1 8.6 7M7 7h.01" },
  { k: "sla", label: "SLA", titulo: "RISCO OPERACIONAL",
    icone: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
];

const SLA_OPCOES = [
  { v: "sem-acao", label: "Sem próxima ação" },
  { v: "parado-7", label: "Parado há 7 dias ou mais" },
  { v: "parado-14", label: "Parado há 14 dias ou mais" },
  { v: "sem-dono", label: "Sem responsável" },
];

function dias(horas: number | null): string {
  if (horas === null) return "—";
  return `${Math.max(0, Math.floor(horas / 24))}d`;
}

/** O card do quadro no formato que o modal de saída precisa. */
function paraSaida(c: CardPreVendas): LeadDaSaida {
  return {
    id: c.leadId,
    empresa: c.empresa || "Sem empresa",
    pessoa: c.pessoa,
    cargo: c.cargo,
    iniciais: c.responsavelIniciais ?? iniciais(c.empresa),
    origem: c.origem,
    servicos: c.servicos,
    // A saída "oportunidade" recusa lead sem conta: o negócio é da empresa.
    empresaId: c.empresaId,
  };
}

function iniciais(nome: string | null) {
  if (!nome) return "—";
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function Icone({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const D = {
  lupa: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5.5 12.5 4 4",
  mais: "M12 5v14M5 12h14",
  chevronDuplo: "m7 15 5 5 5-5M7 9l5-5 5 5",
  chevronBaixo: "m6 9 6 6 6-6",
  chevronEsq: "m15 18-6-6 6-6",
  check: "M20 6 9 17l-5-5",
  exportar: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  cadeado: "M4 11h16v10H4zM8 11V7a4 4 0 0 1 8 0v4",
  origem: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9",
  visao: "M3 3h18v18H3zM3 9h18M9 21V9",
  funil: "M22 3H2l8 9.5V19l4 2v-8.5z",
  selecionar: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  x: "M6 6l12 12M18 6L6 18",
};

export function PreVendasQuadro({
  dados,
  acoes,
  usuarioId,
}: {
  dados: BoardPreVendas;
  acoes: AcoesPreVendas;
  usuarioId: string | null;
}) {
  const router = useRouter();
  const [visao, setVisao] = React.useState<"quadro" | "lista">("quadro");
  const [busca, setBusca] = React.useState("");
  const [sel, setSel] = React.useState<Record<ChaveFiltro, string[]>>({
    responsavel: [], origem: [], interesse: [], sla: [],
  });
  const [filtroAberto, setFiltroAberto] = React.useState<ChaveFiltro | null>(null);
  const [exportAberto, setExportAberto] = React.useState(false);
  /** O modal de critérios, e o modo em que a pessoa marca os cartões para
   *  exportar só eles. São dois porque o desenho separa: o modal decide O QUE
   *  sai, o modo decide QUAIS. */
  const [modalExport, setModalExport] = React.useState(false);
  const [modoSelecao, setModoSelecao] = React.useState(false);
  /** O seletor de responsável da linha da lista, com o retângulo do botão que
   *  o abriu — o menu é `fixed` porque a lista rola na horizontal e um menu
   *  absoluto seria recortado pela própria rolagem. */
  const [respAberto, setRespAberto] = React.useState<{ id: string; rect: DOMRect } | null>(null);
  const [selecao, setSelecao] = React.useState<string[]>([]);
  const [arrastando, setArrastando] = React.useState<string | null>(null);
  const [sobre, setSobre] = React.useState<ChaveColuna | null>(null);
  const [expandidas, setExpandidas] = React.useState<Record<string, boolean>>({});
  const [gruposFechados, setGruposFechados] = React.useState<Record<string, boolean>>({});
  /** Quem está aberto na gaveta, e o detalhe dele quando chega do servidor.
   *  São dois estados e não um: o id abre a gaveta na hora, o detalhe entra
   *  depois. Esperar o detalhe para abrir faria o clique parecer morto. */
  const [aberto, setAberto] = React.useState<string | null>(null);
  /** Saída pedida e o lead dela. Guardo o CARD e não só o id: o modal mostra
   *  empresa, pessoa e origem, e buscá-los de novo faria o modal abrir vazio. */
  const [saida, setSaida] = React.useState<{ tipo: Saida; lead: LeadDaSaida } | null>(null);
  /** Atividade aberta: `ver` mostra a que existe, `nova` abre em edição. */
  const [atividade, setAtividade] = React.useState<{ modo: "ver" | "nova"; lead: CardPreVendas } | null>(null);
  const [detalhe, setDetalhe] = React.useState<{ lead: DetalheLead | null; timeline: LinhaDoTempo[] } | null>(null);

  // Fechar ao clicar fora: um listener só para os dois tipos de popover, e ele
  // ignora o clique que nasceu DENTRO de um deles.
  React.useEffect(() => {
    // `pointerdown` na captura, como no protótipo: pega mouse, toque e caneta
    // com o mesmo handler, e chega antes de qualquer `stopPropagation` de quem
    // está por baixo.
    const aoClicar = (e: PointerEvent) => {
      const alvo = e.target as HTMLElement;
      if (!alvo.closest("[data-pv-popover]")) {
        setFiltroAberto(null);
        setExportAberto(false);
      }
    };
    // Os menus fixos guardam o retângulo do botão que os abriu; se a janela
    // muda de tamanho o retângulo mente, e o menu aparece descolado do botão.
    const aoRedimensionar = () => setRespAberto(null);
    document.addEventListener("pointerdown", aoClicar, true);
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      document.removeEventListener("pointerdown", aoClicar, true);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, []);

  const todos = React.useMemo(() => dados.colunas.flatMap((c) => c.cards), [dados]);

  const opcoesDe = (k: ChaveFiltro): Array<{ v: string; label: string }> => {
    if (k === "responsavel") {
      return [
        { v: "__sem__", label: "Sem responsável" },
        ...dados.filtros.responsaveis.map((r) => ({ v: r.nome, label: r.nome })),
      ];
    }
    if (k === "origem") return dados.filtros.origens.map((o) => ({ v: o, label: o }));
    if (k === "interesse") {
      const servicos = new Set<string>();
      todos.forEach((c) => (c.servicos ?? []).forEach((s) => servicos.add(s)));
      return [...servicos].sort().map((s) => ({ v: s, label: s }));
    }
    return SLA_OPCOES;
  };

  const passaNoFiltro = React.useCallback(
    (c: CardPreVendas) => {
      const q = busca.trim().toLowerCase();
      if (q && ![c.empresa, c.pessoa, c.responsavel].some((t) => t?.toLowerCase().includes(q))) return false;

      if (sel.responsavel.length) {
        const nome = c.responsavel ?? "__sem__";
        if (!sel.responsavel.includes(nome)) return false;
      }
      if (sel.origem.length && !sel.origem.includes(c.origem ?? "")) return false;
      if (sel.interesse.length && !(c.servicos ?? []).some((s) => sel.interesse.includes(s))) return false;
      if (sel.sla.length) {
        const bate = sel.sla.some((s) => {
          if (s === "sem-acao") return !c.proximaAcao;
          if (s === "sem-dono") return !c.responsavel;
          if (s === "parado-7") return (c.horasNaEtapa ?? 0) >= 24 * 7;
          if (s === "parado-14") return (c.horasNaEtapa ?? 0) >= 24 * 14;
          return false;
        });
        if (!bate) return false;
      }
      return true;
    },
    [busca, sel],
  );

  const porEtapa = React.useMemo(() => {
    const mapa = new Map<ChaveColuna, CardPreVendas[]>();
    for (const col of dados.colunas) {
      mapa.set(col.chave, col.cards.filter(passaNoFiltro));
    }
    return mapa;
  }, [dados, passaNoFiltro]);

  const visiveis = React.useMemo(() => todos.filter(passaNoFiltro), [todos, passaNoFiltro]);

  const alternarSel = (k: ChaveFiltro, v: string) =>
    setSel((s) => ({
      ...s,
      [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v],
    }));

  const marcar = (id: string) =>
    setSelecao((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const soltar = async (col: (typeof COLUNAS)[number]) => {
    const id = arrastando;
    setSobre(null);
    setArrastando(null);
    if (!id) return;
    if (col.saida) {
      const card = todos.find((c) => c.leadId === id);
      if (!card) return;
      setSaida({ tipo: col.saida, lead: paraSaida(card) });
      return;
    }
    if (col.confirma) {
      toast(col.confirma);
      return;
    }
    const r = await acoes.moverEtapa(id, col.k as "novo" | "em_contato" | "qualificacao");
    if (r.ok) {
      toast(`Lead movido para ${col.label}`);
      router.refresh();
    } else {
      toast(r.erro ?? "Não deu para mover o lead");
    }
  };

  /** Busca o detalhe e entrega para a gaveta.
   *
   *  `acoes.detalhe` é server action: ela DEVOLVE o registro, não abre nada.
   *  Chamar e descartar o resultado era o motivo de o clique no cartão não
   *  fazer nada. */
  const carregar = React.useCallback(
    async (id: string) => {
      setDetalhe(null);
      const r = await acoes.detalhe(id);
      if (r.ok) setDetalhe(r.dados ?? { lead: null, timeline: [] });
      else toast(r.erro ?? "Não deu para abrir o lead");
    },
    [acoes],
  );

  /** O recorte da tela, no formato que `/pre-vendas/exportar` espera. */
  const filtrosDaTela = React.useMemo(
    () => ({
      busca: busca.trim() || null,
      responsavel: sel.responsavel.find((v) => v !== "__sem__") ?? null,
      origem: sel.origem[0] ?? null,
    }),
    [busca, sel],
  );

  const baixarVisao = () => {
    const url = new URL("/pre-vendas/exportar", window.location.origin);
    for (const [k, v] of Object.entries(filtrosDaTela)) if (v) url.searchParams.set(k, v);
    window.location.href = url.toString();
    toast(`Gerando planilha com ${visiveis.length} leads`);
  };

  const abrir = (id: string) => {
    if (selecao.length) return marcar(id);
    setAberto(id);
    void carregar(id);
  };

  /* ── Cartão ─────────────────────────────────────────────────────────── */
  const Cartao = ({ c }: { c: CardPreVendas }) => {
    const marcado = selecao.includes(c.leadId);
    // Origem é o CANAL de entrada, como no protótipo (`L.origem`). Trazer a
    // campanha na frente enchia o chip de "TRT - CALL FACE [2026]" e escondia
    // de onde o lead veio, que é o que o filtro de origem recorta.
    const origem = c.origem ?? "Sem origem";
    // A Tag de verdade, não o serviço de interesse: decisão do Kauã. O serviço
    // já tem filtro próprio e aparece na gaveta.
    const tag = c.tag;
    return (
      <div
        className="pv-card"
        data-sel={marcado ? "1" : "0"}
        data-arrastando={arrastando === c.leadId}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", c.leadId);
          setArrastando(c.leadId);
        }}
        /* Solta os DOIS estados, como o `larga` do protótipo. Soltar o cartão
           fora de qualquer coluna não dispara `dragleave` na última coluna
           realçada, e ela ficava acesa até o arrasto seguinte. */
        onDragEnd={() => {
          setArrastando(null);
          setSobre(null);
        }}
        onClick={() => abrir(c.leadId)}
        tabIndex={0}
        role="button"
      >
        <button
          className="pv-check"
          onClick={(e) => {
            e.stopPropagation();
            marcar(c.leadId);
          }}
          title="Selecionar cartão"
          aria-pressed={marcado}
        >
          {marcado && <Icone d={D.check} />}
        </button>

        <div className="pv-card-empresa">{c.empresa || "Sem empresa"}</div>
        <div className="pv-card-pessoa">
          {[c.pessoa, c.cargo].filter(Boolean).join(" · ") || "Sem contato"}
        </div>

        <div className="pv-card-selos">
          <span className="pv-selo-origem" data-origem={c.origem ?? ""}>
            <Icone d={D.origem} />
            <span>{origem}</span>
          </span>
          {tag && <span className="pv-selo-tag">{tag}</span>}
        </div>

        <div className="pv-card-acao">
          {!c.proximaAcao && <span className="pv-card-urgente" title="Sem próxima ação" />}
          <span className="pv-card-acao-texto" data-sem={!c.proximaAcao}>
            {c.proximaAcao
              ? c.proximaAcao.venceEm
                ? `${c.proximaAcao.titulo} · ${c.proximaAcao.venceEm}`
                : c.proximaAcao.titulo
              : "Sem próxima ação"}
          </span>
        </div>

        <div className="pv-card-rodape">
          <span className="pv-avatar">{c.responsavelIniciais ?? iniciais(c.responsavel)}</span>
          <span className="pv-card-resp">{c.responsavel ?? "Sem responsável"}</span>
          <span className="pv-card-tempo">{dias(c.horasNaEtapa)}</span>
        </div>
      </div>
    );
  };

  /* ── Filtro split ───────────────────────────────────────────────────── */
  const Filtro = ({ f }: { f: (typeof FILTROS)[number] }) => {
    const escolhidos = sel[f.k];
    const ativo = escolhidos.length > 0;
    const aberto = filtroAberto === f.k;
    return (
      <div className="pv-filtro" data-pv-popover>
        <div className="pv-filtro-grupo" data-ativo={ativo} data-aberto={aberto}>
          <button className="pv-filtro-corpo" onClick={() => setFiltroAberto(aberto ? null : f.k)}>
            <Icone d={f.icone} />
            <span>{f.label}</span>
            {ativo && <span className="pv-filtro-conta">{escolhidos.length}</span>}
          </button>
          <span className="pv-filtro-divisoria" />
          <button className="pv-filtro-seta" onClick={() => setFiltroAberto(aberto ? null : f.k)} title="Abrir opções">
            <Icone d={D.chevronDuplo} />
          </button>
        </div>

        {aberto && (
          <div className="pv-filtro-menu">
            <div className="pv-filtro-titulo">{f.titulo}</div>
            <div className="pv-filtro-opcoes">
              {opcoesDe(f.k).map((o) => (
                <button key={o.v} className="pv-filtro-opcao" onClick={() => alternarSel(f.k, o.v)}>
                  <span className="pv-caixa" data-on={escolhidos.includes(o.v)}>
                    {escolhidos.includes(o.v) && <Icone d={D.check} />}
                  </span>
                  <span>{o.label}</span>
                </button>
              ))}
              {!opcoesDe(f.k).length && (
                <div className="pv-filtro-titulo" style={{ fontWeight: 400 }}>
                  Nada para filtrar aqui ainda.
                </div>
              )}
            </div>
            <div className="pv-filtro-fio" />
            <button className="pv-filtro-limpar" onClick={() => setSel((s) => ({ ...s, [f.k]: [] }))}>
              Limpar
            </button>
          </div>
        )}
      </div>
    );
  };

  const colunasAbertas = COLUNAS.filter((c) => !c.recolhivel || expandidas[c.k]);
  const colunasRecolhidas = COLUNAS.filter((c) => c.recolhivel && !expandidas[c.k]);

  /* ── Lista ──────────────────────────────────────────────────────────── */
  const gruposLista = COLUNAS.map((col) => ({
    col,
    // Urgência primeiro: quem não tem próxima ação sobe ao topo, e entre os
    // que têm, o mais parado vem antes.
    cards: (porEtapa.get(col.k) ?? []).slice().sort((a, b) => {
      const ua = a.proximaAcao ? 1 : 0;
      const ub = b.proximaAcao ? 1 : 0;
      if (ua !== ub) return ua - ub;
      return (b.horasNaEtapa ?? 0) - (a.horasNaEtapa ?? 0);
    }),
  })).filter((g) => g.cards.length);

  const todosAbertos = gruposLista.every((g) => !gruposFechados[g.col.k]);

  return (
    <div className="pv-tela" data-workspace="tela-cheia">
      <div className="pv-controles">
        <div className="pv-busca">
          <Icone d={D.lupa} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Empresa, pessoa ou e-mail"
          />
        </div>

        {FILTROS.map((f) => (
          <Filtro key={f.k} f={f} />
        ))}

        <button
          className="pv-mais-filtros"
          onClick={() => toast("Mais filtros — os quatro acima cobrem o que o board consulta hoje")}
        >
          <Icone d={D.mais} />
          <span>Filtros</span>
        </button>

        <span className="pv-espacador" />

        <div className="pv-visoes">
          <button data-ativo={visao === "quadro"} onClick={() => setVisao("quadro")}>Quadro</button>
          <button data-ativo={visao === "lista"} onClick={() => setVisao("lista")}>Lista</button>
        </div>

        <div className="pv-filtro" data-pv-popover>
          <button className="pv-exportar" onClick={() => setExportAberto((v) => !v)}>
            <Icone d={D.exportar} />
            <span>Exportar</span>
          </button>
          {exportAberto && (
            <div className="pv-filtro-menu pv-exportar-menu" style={{ left: "auto", right: 0 }}>
              <div className="pv-exportar-rotulo">EXPORTAR</div>
              <button
                className="pv-exportar-item"
                onClick={() => {
                  setExportAberto(false);
                  baixarVisao();
                }}
              >
                <Icone d={D.visao} />
                <span>
                  <strong>Exportar esta visão</strong>
                  <small>
                    {visiveis.length} leads, com os filtros que estão aplicados agora
                  </small>
                </span>
              </button>
              <button
                className="pv-exportar-item"
                onClick={() => {
                  setExportAberto(false);
                  setModalExport(true);
                }}
              >
                <Icone d={D.funil} />
                <span>
                  <strong>Escolher critérios</strong>
                  <small>Escopo, colunas e formato do arquivo</small>
                </span>
              </button>
              <button
                className="pv-exportar-item"
                onClick={() => {
                  setExportAberto(false);
                  setModoSelecao(true);
                  setSelecao([]);
                }}
              >
                <Icone d={D.selecionar} />
                <span>
                  <strong>Selecionar leads</strong>
                  <small>Marque os cartões e exporte só eles</small>
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="pv-novo">
          <button className="pv-novo-principal" onClick={() => toast("Novo lead — formulário a ligar")}>
            <Icone d={D.mais} />
            <span>Novo lead</span>
          </button>
          <span className="pv-novo-fio" />
          <button className="pv-novo-seta" title="Outras criações" onClick={() => toast("Outras criações")}>
            <Icone d={D.chevronDuplo} />
          </button>
        </div>
      </div>

      <div className="pv-indicadores">
        {INDICADORES.map((i) => (
          <div key={i.label} className="pv-indicador">
            <div className="pv-indicador-rotulo">{i.label}</div>
            <div className="pv-indicador-valor">{i.valor(dados.resumo)}</div>
          </div>
        ))}
      </div>

      {visao === "quadro" ? (
        <div className="pv-quadro">
          <div className="pv-trilho">
            {colunasAbertas.map((col) => {
              const cards = porEtapa.get(col.k) ?? [];
              return (
                <section
                  key={col.k}
                  className="pv-coluna"
                  data-sobre={sobre === col.k}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (sobre !== col.k) setSobre(col.k);
                  }}
                  onDragLeave={() => sobre === col.k && setSobre(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    void soltar(col);
                  }}
                >
                  <div className="pv-coluna-topo">
                    <span className="pv-ponto" style={{ background: col.cor }} />
                    <span className="pv-coluna-nome">{col.label}</span>
                    <span style={{ flex: 1 }} />
                    {col.confirma && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="pv-coluna-cadeado" aria-label="Pede confirmação">
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span className="pv-coluna-conta">{cards.length}</span>
                    {col.recolhivel && (
                      <button
                        className="pv-coluna-fechar"
                        title="Recolher coluna"
                        onClick={() => setExpandidas((s) => ({ ...s, [col.k]: false }))}
                      >
                        <Icone d={D.chevronEsq} />
                      </button>
                    )}
                  </div>

                  <div className="pv-coluna-lista">
                    {cards.map((c) => (
                      <Cartao key={c.leadId} c={c} />
                    ))}
                    {!cards.length && (
                      <div className="pv-coluna-vazia">
                        <Icone d={col.icone} />
                        <div>{col.vazio}</div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            {colunasRecolhidas.map((col) => (
              <button
                key={col.k}
                className="pv-recolhida"
                data-sobre={sobre === col.k}
                title={col.label}
                onClick={() => setExpandidas((s) => ({ ...s, [col.k]: true }))}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (sobre !== col.k) setSobre(col.k);
                }}
                onDragLeave={() => sobre === col.k && setSobre(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  void soltar(col);
                }}
              >
                <span className="pv-ponto" style={{ background: col.cor }} />
                <span className="pv-coluna-conta">{(porEtapa.get(col.k) ?? []).length}</span>
                <span className="pv-recolhida-nome">{col.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="pv-lista">
          <div className="pv-lista-cartao">
            <div className="pv-lista-topo">
              <span className="pv-lista-titulo">Lista de trabalho</span>
              <span className="pv-lista-explica">
                ordenada por urgência — quem não tem próxima ação sobe ao topo
              </span>
              <span style={{ flex: 1, minWidth: 0 }} />
              <button
                className="pv-lista-alternar"
                onClick={() =>
                  setGruposFechados(
                    todosAbertos ? Object.fromEntries(gruposLista.map((g) => [g.col.k, true])) : {},
                  )
                }
              >
                {todosAbertos ? "Recolher todas" : "Abrir todas"}
              </button>
              <span className="pv-lista-total">{visiveis.length} leads</span>
            </div>

            <div className="pv-lista-rolagem">
              <div className="pv-lista-largura">
                <div className="pv-lista-grade pv-lista-cabecalho">
                  <div />
                  <div>EMPRESA · PESSOA</div>
                  <div>PRÓXIMA AÇÃO</div>
                  <div>RESPONSÁVEL</div>
                  <div>ORIGEM</div>
                  <div>PARADO</div>
                </div>

                {gruposLista.map(({ col, cards }) => {
                  const aberto = !gruposFechados[col.k];
                  const semAcao = cards.filter((c) => !c.proximaAcao).length;
                  return (
                    <div key={col.k}>
                      <button
                        className="pv-grupo-cabecalho"
                        data-aberto={aberto}
                        onClick={() => setGruposFechados((s) => ({ ...s, [col.k]: aberto }))}
                      >
                        <Icone d={D.chevronBaixo} className="pv-grupo-chevron" />
                        <span className="pv-ponto" style={{ background: col.cor }} />
                        <span className="pv-grupo-nome">{col.label}</span>
                        <span className="pv-grupo-conta">{cards.length}</span>
                        {/* O espaçador joga o alerta para a direita, longe do
                            contador: ele é o aviso da faixa, não um adorno do
                            número. */}
                        <span className="pv-espacador" />
                        {semAcao > 0 && <span className="pv-grupo-alerta">{semAcao} sem ação</span>}
                      </button>

                      {aberto &&
                        cards.map((c) => (
                          <div
                            key={c.leadId}
                            className="pv-lista-grade pv-linha"
                            data-sel={selecao.includes(c.leadId) ? "1" : "0"}
                            onClick={() => abrir(c.leadId)}
                            role="button"
                            tabIndex={0}
                          >
                            <button
                              className="pv-check"
                              data-on={selecao.includes(c.leadId)}
                              title="Selecionar"
                              onClick={(e) => { e.stopPropagation(); marcar(c.leadId); }}
                            >
                              {selecao.includes(c.leadId) && <Icone d={D.check} />}
                            </button>
                            <div style={{ minWidth: 0 }}>
                              <div className="pv-linha-empresa">{c.empresa || "Sem empresa"}</div>
                              <div className="pv-linha-pessoa">
                                {[c.pessoa, c.cargo].filter(Boolean).join(" · ") || "Sem contato"}
                              </div>
                            </div>
                            <div className="pv-linha-acao">
                              {!c.proximaAcao && <span className="pv-card-urgente" />}
                              <span className="pv-linha-acao-texto" data-sem={!c.proximaAcao}>
                                {c.proximaAcao
                                  ? c.proximaAcao.venceEm
                                    ? `${c.proximaAcao.titulo} · ${c.proximaAcao.venceEm}`
                                    : c.proximaAcao.titulo
                                  : "Sem próxima ação"}
                              </span>
                            </div>
                            {/* Responsável é botão, e o menu troca de verdade.
                                Texto estático aqui obrigava a abrir a gaveta
                                para uma mudança que o desenho resolve na linha. */}
                            <div style={{ minWidth: 0, position: "relative" }}>
                              <button
                                className="pv-linha-resp"
                                data-on={respAberto?.id === c.leadId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setRespAberto((s) =>
                                    s?.id === c.leadId ? null : { id: c.leadId, rect: r },
                                  );
                                }}
                              >
                                <span className="pv-linha-resp-avatar" data-vazio={!c.responsavel}>
                                  {c.responsavel ? c.responsavelIniciais ?? iniciais(c.responsavel) : "—"}
                                </span>
                                <span className="pv-linha-resp-nome" data-vazio={!c.responsavel}>
                                  {c.responsavel ?? "Sem responsável"}
                                </span>
                                <Icone d={D.chevronBaixo} className="pv-chev" />
                              </button>
                            </div>
                            <div className="pv-linha-origem">{c.origem ?? "—"}</div>
                            <div className="pv-linha-tempo">{dias(c.horasNaEtapa)}</div>
                          </div>
                        ))}
                    </div>
                  );
                })}

                {!gruposLista.length && (
                  <div className="pv-lista-vazia">
                    <div>Nenhum lead com esses filtros</div>
                    <p>Limpe a busca ou os filtros para ver a lista inteira.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {aberto && (
        <GavetaLead
          lead={detalhe?.lead ?? null}
          timeline={detalhe?.timeline ?? []}
          responsaveis={dados.filtros.responsaveis}
          acoes={acoes}
          aoFechar={() => {
            setAberto(null);
            setDetalhe(null);
          }}
          aoRecarregar={() => {
            router.refresh();
            void carregar(aberto);
          }}
          aoPedirSaida={(tipo) => {
            const card = todos.find((c) => c.leadId === aberto);
            if (card) setSaida({ tipo, lead: paraSaida(card) });
          }}
          aoPedirAtividade={(modo) => {
            const card = todos.find((c) => c.leadId === aberto);
            if (card) setAtividade({ modo, lead: card });
          }}
        />
      )}

      {atividade && (
        <AtividadeLead
          contexto={[atividade.lead.empresa || "Sem empresa", atividade.lead.pessoa].filter(Boolean).join(" · ")}
          leadId={atividade.lead.leadId}
          atual={
            atividade.modo === "ver" && atividade.lead.proximaAcao
              ? { titulo: atividade.lead.proximaAcao.titulo, venceEm: atividade.lead.proximaAcao.venceEm }
              : null
          }
          responsaveis={dados.filtros.responsaveis}
          responsavelPadrao={{ id: usuarioId, nome: atividade.lead.responsavel }}
          acoes={acoes}
          aoFechar={() => setAtividade(null)}
          aoConcluir={() => {
            router.refresh();
            if (aberto) void carregar(aberto);
          }}
        />
      )}

      {saida && (
        <SaidasLead
          saida={saida.tipo}
          lead={saida.lead}
          acoes={acoes}
          responsaveis={dados.filtros.responsaveis}
          aoFechar={() => setSaida(null)}
          aoConcluir={() => {
            router.refresh();
            if (aberto) void carregar(aberto);
          }}
        />
      )}

      {respAberto && (
        <MenuResponsavel
          rect={respAberto.rect}
          responsaveis={dados.filtros.responsaveis}
          aoFechar={() => setRespAberto(null)}
          aoEscolher={async (id, nome) => {
            const leadId = respAberto.id;
            setRespAberto(null);
            const r = await acoes.atribuir(leadId, id);
            toast(
              r.ok
                ? nome
                  ? `Responsável alterado para ${nome}`
                  : "Responsável removido — lead volta para a fila"
                : r.erro,
            );
            if (r.ok) router.refresh();
          }}
        />
      )}

      {modalExport && (
        <ExportarLeads
          contagens={{ visao: visiveis.length, criterios: dados.resumo.ativos, selecao: selecao.length }}
          filtrosDaTela={filtrosDaTela}
          idsSelecionados={selecao}
          aoFechar={() => setModalExport(false)}
          aoPedirSelecao={() => {
            setModalExport(false);
            setModoSelecao(true);
            setSelecao([]);
          }}
        />
      )}

      {modoSelecao && (
        <div className="bs-export">
          <Icone d={D.exportar} />
          <span className="bs-export-texto">Selecione os leads na tela</span>
          <span className="bs-conta">{selecao.length}</span>
          <span className="bs-fio" />
          <button
            className="bs-export-concluir"
            disabled={!selecao.length}
            onClick={() => {
              setModoSelecao(false);
              setModalExport(true);
            }}
          >
            Concluir seleção
          </button>
          <button
            className="bs-limpar"
            title="Cancelar exportação"
            aria-label="Cancelar exportação"
            onClick={() => {
              setModoSelecao(false);
              setSelecao([]);
            }}
          >
            <Icone d={D.x} />
          </button>
        </div>
      )}

      {!modoSelecao && selecao.length > 0 && (
        <BarraSelecao
          selecao={selecao}
          responsaveis={dados.filtros.responsaveis}
          aoLimpar={() => setSelecao([])}
          aoMoverEtapa={async (para) => {
            /* Mover etapa não existe no motor de massa: aqui é lead a lead, e
               o relato conta quantos passaram. Falhar no meio não desfaz o que
               já moveu — o board recarrega e mostra o estado real. */
            const r = await Promise.all(selecao.map((id) => acoes.moverEtapa(id, para)));
            const ok = r.filter((x) => x.ok).length;
            toast(`${ok} de ${selecao.length} movidos`);
            setSelecao([]);
            router.refresh();
          }}
          aoConcluir={() => {
            setSelecao([]);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** O seletor de responsável de uma linha da lista.
 *
 * Abre para baixo do botão; quando não cabe, vira para cima — a última faixa
 * da lista fica encostada no rodapé e um menu que abre para fora da janela é
 * um menu que não existe. Os 208px de largura e a altura de 196 são os do
 * desenho. */
function MenuResponsavel({
  rect,
  responsaveis,
  aoFechar,
  aoEscolher,
}: {
  rect: DOMRect;
  responsaveis: Array<{ id: string; nome: string }>;
  aoFechar: () => void;
  aoEscolher: (id: string | null, nome: string | null) => void;
}) {
  React.useEffect(() => {
    const sair = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [aoFechar]);

  const alto = 196;
  const abaixo = window.innerHeight - rect.bottom - 12;
  const paraCima = abaixo < alto && rect.top - 12 > abaixo;
  const estilo: React.CSSProperties = {
    position: "fixed",
    left: Math.min(rect.left, window.innerWidth - 218),
    maxHeight: Math.max(140, Math.min(alto, paraCima ? rect.top - 12 : abaixo)),
    ...(paraCima
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 }),
  };

  return (
    <>
      <div className="pv-resp-fora" onClick={aoFechar} role="presentation" />
      <div className="pv-resp-menu" style={estilo}>
        {responsaveis.map((r) => (
          <button key={r.id} onClick={() => aoEscolher(r.id, r.nome)}>
            <span className="pv-resp-avatar">{iniciais(r.nome)}</span>
            <span>{r.nome}</span>
          </button>
        ))}
        <button onClick={() => aoEscolher(null, null)}>
          <span className="pv-resp-avatar" data-vazio="true">—</span>
          <span>Sem responsável</span>
        </button>
      </div>
    </>
  );
}
