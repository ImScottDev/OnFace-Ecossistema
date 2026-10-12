"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Prospecção, a lógica de tela (Liga).
 *
 * `ProspeccaoDesenho` é o markup (derivado do board de Pré-vendas). Esta Liga
 * guarda só o estado de TELA (filtro aberto, grupo fechado, menu do cartão,
 * cartão arrastado, painel da barra em massa) e traduz o dado real para o
 * objeto que o desenho consome. Nada aqui grava: cada gesto chama um callback
 * do adaptador (`ProspeccaoProto`), que fala com os comandos de domínio.
 *
 * Os estilos são os de `PreVendasLiga` (mesmas strings, mesmos tokens): é isso
 * que mantém o cartão, a coluna, o filtro e a lista iguais aos de Pré-vendas.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";

import type { LinhaProspeccao } from "@/lib/vendas/consultas";
import {
  ESTADOS_PROSPECCAO, POR_PAGINA_PROSPECCAO, ROTULO_ESTADO_PROSPECCAO, type EstadoProspeccao,
} from "@/lib/vendas/dominio";
import { destinosPermitidos, transicao } from "@/lib/vendas/prospeccao-transicoes";
import { ProspeccaoDesenho } from "./ProspeccaoDesenho";

export type Visao = "operacao" | "kanban" | "lista" | "campanhas" | "inteligencia";
export type AlvoMov = { leadId: string; empresa: string; estado: EstadoProspeccao; empresaId: string | null };

export interface PropsDaLiga {
  visao: Visao;
  trocarVisao: (v: Visao) => void;
  navegar: (m: Record<string, string | null>) => void;
  filtro: {
    busca: string; estado: EstadoProspeccao | null; responsavelId: string | null; lista: string | null;
    cadenciaId: string | null; fila: string | null; ordem: string | null; direcao: "asc" | "desc" | null;
  };
  opcoes: { responsaveis: Array<{ id: string; nome: string }>; listas: string[]; cadencias: Array<{ id: string; nome: string }> };
  /** Lista paginada (visão Lista). */
  linhas: LinhaProspeccao[];
  paginacao: { total: number; pagina: number; porPagina: number; paginas: number } | null;
  resumo: Record<EstadoProspeccao, number> | null;
  /** Kanban: cartões por coluna, já com os movimentos otimistas aplicados. */
  colunas: Array<{ estado: EstadoProspeccao; total: number; cards: LinhaProspeccao[]; restantes: number }>;
  contaDesfecho: (e: EstadoProspeccao) => number;
  pendenteId: string | null;
  abertoId: string | null;
  selecionados: string[];
  setSelecionados: (ids: string[]) => void;
  aoAbrir: (id: string) => void;
  aoPedirMovimento: (a: AlvoMov, para: EstadoProspeccao) => void;
  aoAtribuir: (leadId: string, responsavelId: string | null) => void;
  aoVerMais: () => void;
  topo: {
    adicionar: () => void;
    importar: (() => void) | null;
    apollo: () => void;
  };
  massa: {
    responsaveis: Array<{ id: string; nome: string }>;
    cadencias: Array<{ id: string; nome: string }>;
    emCadenciaSelecionadas: number;
    motivoSemEnriquecer: string | null;
    aoResponsavel: (id: string | null) => void;
    aoCadencia: (id: string) => void;
    aoTexto: (op: "lista" | "tag") => void;
    aoPausar: () => void;
    aoEnriquecer: () => void;
    aviso: (m: string) => void;
  };
  corpoOutro: React.ReactNode;
}

const COR_ESTADO: Record<EstadoProspeccao, string> = {
  novo: "#4a5560", em_cadencia: "#4c8fe0", respondeu: "#fe4f2b", pre_qualificado: "#2f9e7a",
  oportunidade: "#fe4f2b", sem_resposta: "#c8a86a", descartado: "#8b949e",
};
const TOM_ESTADO: Record<EstadoProspeccao, [string, string]> = {
  novo: ["#eeeff3", "#4a5560"], em_cadencia: ["#e8f0fb", "#2c5f9e"], respondeu: ["#fdeae5", "#9c3210"],
  pre_qualificado: ["#e6f4ee", "#1f7256"], oportunidade: ["#fdeae5", "#9c3210"],
  sem_resposta: ["#f7edd8", "#6e5420"], descartado: ["#eef1f1", "#4a5560"],
};
const VAZIO: Record<string, { texto: string; icone: string }> = {
  novo: { texto: "Empresas que entram pela importação, pelo Apollo ou à mão aparecem aqui, antes da primeira abordagem.", icone: "M12 5v14M5 12h14" },
  em_cadencia: { texto: "Arraste uma empresa de Novo para cá para iniciar a abordagem. A cadência é escolhida na hora.", icone: "M4 14h7l-1 7 10-11h-7l1-7z" },
  respondeu: { texto: "Quando alguém responde, a empresa sobe para cá. Responder não é qualificar: decida o desfecho.", icone: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" },
};
const ROTULO_ACAO: Record<string, string> = {
  em_cadencia: "Adicionar à cadência", respondeu: "Registrar resposta", sem_resposta: "Marcar sem resposta",
  pre_qualificado: "Pré-qualificar", oportunidade: "Criar oportunidade", descartado: "Descartar",
};
const ICONES = {
  responsavel: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  lista: "M3 6h18M7 12h10M10 18h4",
  cadencia: "M4 14h7l-1 7 10-11h-7l1-7z",
  tag: "M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  fila: "M22 3H2l8 9.5V19l4 2v-8.5z",
  estado: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  mais: "M12 5v14M5 12h14",
  importar: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  busca: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3",
  pausa: "M10 4H6v16h4zM18 4h-4v16h4z",
  enriquecer: "M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z",
};
const FILAS = [
  { v: "sem_responsavel", label: "Sem responsável" }, { v: "sem_contato", label: "Sem e-mail nem telefone" },
  { v: "cadencia_pausada", label: "Cadência pausada" }, { v: "cadencia_com_falha", label: "Cadência com falha" },
];
const VISOES: Array<[Visao, string]> = [
  ["operacao", "Operação"], ["kanban", "Kanban"], ["lista", "Lista"], ["campanhas", "Campanhas"], ["inteligencia", "Inteligência"],
];

const iniciaisDe = (n: string | null) => n ? n.split(" ").filter(Boolean).slice(0, 2).map((p) => [...p][0]).join("").toUpperCase() : "—";
/** O relógio entra por argumento: a tela fixa o instante uma vez, e render não lê `Date.now()`. */
const dataCurta = (iso: string | null, agora: number) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(d) - dia(new Date(agora))) / 86_400_000);
  return dias === 0 ? "hoje" : dias === 1 ? "amanhã" : dias === -1 ? "ontem" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const diasDesde = (iso: string, agora: number) => Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 86_400_000));

function passo(l: LinhaProspeccao): string {
  if (!l.cadencia) return "";
  if (l.passoAtual == null || !l.totalPassos) return l.cadenciaStatus === "paused" ? `${l.cadencia} · pausada` : l.cadencia;
  const base = l.cadenciaStatus === "completed" ? `${l.cadencia} · concluída` : `${l.cadencia} · passo ${l.passoAtual} de ${l.totalPassos}`;
  return l.cadenciaStatus === "paused" ? `${base} · pausada` : l.cadenciaStatus === "failed" ? `${base} · falhou` : base;
}

/** O que a linha de baixo do cartão diz: a próxima ação real, ou a pendência. */
function proximaAcao(l: LinhaProspeccao, agora: number): { texto: string; urgente: boolean } {
  if (l.estado === "respondeu") return { texto: "Respondeu: decidir o próximo passo", urgente: true };
  if (l.cadenciaStatus === "failed") return { texto: "Cadência falhou: revisar o passo", urgente: true };
  if (l.proximaAcaoEm) return { texto: `Próximo toque ${dataCurta(l.proximaAcaoEm, agora)}`, urgente: false };
  if (l.estado === "novo") return { texto: "Sem cadência iniciada", urgente: false };
  if (l.estado === "sem_resposta") return { texto: "Cadência concluída sem resposta", urgente: false };
  return { texto: l.cadenciaStatus === "paused" ? "Cadência pausada" : "Sem próxima ação", urgente: l.cadenciaStatus !== "paused" };
}

export function ProspeccaoLiga(p: PropsDaLiga) {
  const [filtroAberto, setFiltroAberto] = React.useState<string | null>(null);
  const [fechadas, setFechadas] = React.useState<Record<string, boolean>>({});
  const [menuCard, setMenuCard] = React.useState<string | null>(null);
  const [menuRect, setMenuRect] = React.useState<{ top: number; bottom: number; right: number } | null>(null);
  const [respAberto, setRespAberto] = React.useState<string | null>(null);
  const [arrastando, setArrastando] = React.useState<{ id: string; estado: EstadoProspeccao } | null>(null);
  const [sobre, setSobre] = React.useState<EstadoProspeccao | null>(null);
  const [acaoMassa, setAcaoMassa] = React.useState<string | null>(null);
  const [topoMenu, setTopoMenu] = React.useState(false);
  const [busca, setBusca] = React.useState(p.filtro.busca);
  const [agora] = React.useState(() => Date.now());
  const { navegar } = p;

  /* Busca com atraso curto: a consulta é do servidor, e digitar não pode
     recarregar a tela a cada letra. */
  React.useEffect(() => {
    if (busca.trim() === p.filtro.busca) return;
    const t = setTimeout(() => navegar({ busca: busca.trim() || null, pagina: null }), 450);
    return () => clearTimeout(t);
  }, [busca, p.filtro.busca, navegar]);

  /* Clique fora fecha menus e filtros, como em Pré-vendas. */
  React.useEffect(() => {
    const fora = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (!alvo?.closest("[data-of-filtro],[data-of-cardmenu],[data-of-resp],[data-of-massa],[data-of-saida]")) {
        setFiltroAberto(null); setMenuCard(null); setRespAberto(null); setTopoMenu(false);
      }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setFiltroAberto(null); setMenuCard(null); setRespAberto(null); setAcaoMassa(null); setTopoMenu(false); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, []);

  const { visao, selecionados } = p;
  const emBoard = visao === "kanban";
  const emLista = visao === "lista";
  const alternarSelecao = (id: string) =>
    p.setSelecionados(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);

  /* ── filtros (mesma gramática dos de Pré-vendas) ── */
  const defs: Array<{ k: string; label: string; titulo: string; icone: string; atual: string | null; param: string; opcoes: Array<{ v: string; label: string }> }> = [
    { k: "responsavel", label: "Responsável", titulo: "RESPONSÁVEL", icone: ICONES.responsavel, atual: p.filtro.responsavelId, param: "responsavel",
      opcoes: [{ v: "sem", label: "Sem responsável" }, ...p.opcoes.responsaveis.map((r) => ({ v: r.id, label: r.nome }))] },
    { k: "lista", label: "Lista", titulo: "LISTA", icone: ICONES.lista, atual: p.filtro.lista, param: "lista",
      opcoes: p.opcoes.listas.map((l) => ({ v: l, label: l })) },
    { k: "cadencia", label: "Cadência", titulo: "CADÊNCIA", icone: ICONES.cadencia, atual: p.filtro.cadenciaId, param: "cadencia",
      opcoes: [{ v: "sem", label: "Fora de cadência" }, ...p.opcoes.cadencias.map((c) => ({ v: c.id, label: c.nome }))] },
    { k: "fila", label: "Fila", titulo: "FILA DE TRABALHO", icone: ICONES.fila, atual: p.filtro.fila, param: "fila", opcoes: FILAS },
  ];
  if (emLista && p.resumo) {
    defs.push({ k: "estado", label: "Estado", titulo: "ESTADO", icone: ICONES.estado, atual: p.filtro.estado, param: "estado",
      opcoes: ESTADOS_PROSPECCAO.map((e) => ({ v: e, label: `${ROTULO_ESTADO_PROSPECCAO[e]} · ${p.resumo![e] ?? 0}` })) });
  }
  const filtros = (emBoard || emLista) ? defs.map((f) => {
    const aberto = filtroAberto === f.k;
    const ativo = !!f.atual;
    const borda = ativo ? "#c2330f" : aberto ? "#b8bfc0" : "#dbdede";
    return {
      label: f.label, titulo: f.titulo, aberto, icone: f.icone, conta: ativo ? 1 : 0, temSel: ativo,
      grupoStyle: "display:flex;align-items:stretch;height:34px;border-radius:9px;overflow:hidden;background:" + (ativo ? "#d93c1a" : "#fff")
        + ";box-shadow:inset 0 0 0 1px " + borda + ";transition:box-shadow .12s cubic-bezier(0,0,.2,1)",
      corpoStyle: "display:flex;align-items:center;gap:7px;padding:0 11px;font-size:13px;font-weight:" + (ativo ? "600" : "500")
        + ";white-space:nowrap;color:" + (ativo ? "#fff" : "#1f252c") + ";background:transparent;border:0;cursor:pointer",
      setaStyle: "display:grid;place-items:center;width:28px;padding:0;color:" + (ativo ? "#fff" : "#4a5560") + ";background:transparent;border:0;cursor:pointer",
      corpoHover: ativo ? "background:rgba(255,255,255,.12)" : "background:#f6f7f7",
      divisoria: "flex:0 0 auto;width:1px;background:" + (ativo ? "rgba(255,255,255,.34)" : "#e3e7e8"),
      contaStyle: "flex:0 0 auto;min-width:17px;height:17px;padding-inline:4px;border-radius:9999px;font-size:10px;font-weight:700;display:grid;place-items:center;background:"
        + (ativo ? "rgba(255,255,255,.22);color:#fff" : "#12171d;color:#fff"),
      chevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (aberto ? 180 : 0) + "deg)",
      abrir: () => setFiltroAberto(aberto ? null : f.k),
      limpar: () => { setFiltroAberto(null); navegar({ [f.param]: null, pagina: null }); },
      opcoes: f.opcoes.length === 0
        ? [{ label: "Nada para filtrar ainda", on: false, caixa: "display:none", onClick: () => undefined }]
        : f.opcoes.map((o) => {
          const on = f.atual === o.v;
          return {
            label: o.label, on,
            caixa: "flex:0 0 auto;width:17px;height:17px;border-radius:9999px;display:grid;place-items:center;border:0;"
              + (on ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
            onClick: () => { setFiltroAberto(null); navegar({ [f.param]: on ? null : o.v, pagina: null }); },
          };
        }),
    };
  }) : [];

  const segBase = "display:flex;align-items:center;padding:0 12px;border-radius:7px;font-size:13px;font-weight:500;white-space:nowrap;flex:0 0 auto;";
  const visoes = VISOES.map(([k, label]) => ({
    label,
    style: segBase + (visao === k ? "background:#fff;color:#12171d;font-weight:600" : "color:#4a5560"),
    onClick: () => p.trocarVisao(k),
  }));

  /* Adicionar empresa é o botão principal; importar e buscar no Apollo moram no
     menu dele, como as saídas moram no botão dividido de Pré-vendas. */
  const topoAcoes = [{
    label: "Adicionar empresa", d: ICONES.mais, onClick: () => { setTopoMenu(false); p.topo.adicionar(); },
    menuAberto: topoMenu, alternarMenu: () => setTopoMenu(!topoMenu),
    menuOpcoes: [
      ...(p.topo.importar ? [{ label: "Importar CSV", nota: "Várias empresas de uma planilha, com lista e responsável", d: ICONES.importar, onClick: () => { setTopoMenu(false); p.topo.importar?.(); } }] : []),
      { label: "Buscar no Apollo", nota: "Pessoas e empresas do Apollo, para importar à prospecção", d: ICONES.busca, onClick: () => { setTopoMenu(false); p.topo.apollo(); } },
    ],
  }];

  /* ── Kanban ── */
  const moverOpcoes = (c: LinhaProspeccao) => destinosPermitidos(c.estado).map((para) => ({
    label: ROTULO_ACAO[para], perigo: para === "descartado",
    onClick: () => { setMenuCard(null); p.aoPedirMovimento({ leadId: c.leadId, empresa: c.empresa, estado: c.estado, empresaId: c.empresaId }, para); },
  }));
  const soltar = (estado: EstadoProspeccao) => {
    const a = arrastando; setSobre(null); setArrastando(null);
    if (!a || a.estado === estado) return;
    const c = p.colunas.flatMap((x) => x.cards).find((x) => x.leadId === a.id);
    if (c) p.aoPedirMovimento({ leadId: c.leadId, empresa: c.empresa, estado: c.estado, empresaId: c.empresaId }, estado);
  };
  const alvoStyle = (estado: EstadoProspeccao, base: string) => {
    const t = arrastando ? transicao(arrastando.estado, estado) : null;
    const proibida = sobre === estado && t && !t.permitida && !t.igual;
    return base + "transition:box-shadow .12s cubic-bezier(0,0,.2,1);"
      + (sobre === estado ? (proibida ? "box-shadow:inset 0 0 0 2px #b9bfc0" : "box-shadow:inset 0 0 0 2px rgba(255,77,41,.2)") : "");
  };
  const dnd = (estado: EstadoProspeccao) => ({
    sobre: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (sobre !== estado) setSobre(estado); },
    sai: () => { if (sobre === estado) setSobre(null); },
    solta: (e: React.DragEvent) => { e.preventDefault(); soltar(estado); },
  });

  const colunas = p.colunas.map((c, ci) => ({
    estado: c.estado, label: ROTULO_ESTADO_PROSPECCAO[c.estado], travada: false, confirma: false, dica: "", atrasoEntrada: String(260 + ci * 90),
    recolhivel: false, fechar: () => undefined, arrastavel: true,
    conta: c.total, vazia: c.cards.length === 0, vazioTexto: VAZIO[c.estado].texto, vazioIcone: VAZIO[c.estado].icone,
    temMais: c.restantes > 0, restantes: c.restantes, verMais: p.aoVerMais,
    ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;align-self:center;background:" + COR_ESTADO[c.estado],
    style: alvoStyle(c.estado, "flex:0 0 auto;width:288px;min-width:168px;display:flex;flex-direction:column;min-height:0;background:#eeeff3;border-radius:12px;padding:6px 8px 12px;"),
    ...dnd(c.estado),
    cards: c.cards.map((l) => {
      const sel = selecionados.includes(l.leadId);
      const acao = proximaAcao(l, agora);
      const pendente = p.pendenteId === l.leadId;
      const dest = moverOpcoes(l);
      return {
        leadId: l.leadId, empresa: l.empresa,
        pessoa: l.pessoa ? `${l.pessoa}${l.cargo ? " · " + l.cargo : ""}` : "Sem pessoa associada",
        responsavel: l.responsavel ?? "Sem responsável", iniciais: iniciaisDe(l.responsavel),
        tempo: diasDesde(l.atualizadoEm, agora) + "d",
        origem: l.lista ?? l.fonte ?? "Outbound",
        origemSelo: "display:inline-flex;align-items:center;gap:5px;max-width:100%;min-width:0;height:19px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;background:#eeeff3;color:#4a5560",
        temTag: !!l.setor, tag: l.setor,
        temCadencia: !!l.cadencia, cadencia: passo(l),
        urgente: acao.urgente, acao: acao.texto,
        acaoStyle: "flex:1;min-width:0;font-size:11.5px;font-weight:" + (acao.urgente ? "600;color:#c2330f" : "400;color:#6d747e") + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
        sel, selAttr: sel ? "1" : "0",
        checkStyle: "position:absolute;top:9px;right:9px;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;padding:0;border:0;line-height:0;cursor:pointer;z-index:2;transition:background .12s cubic-bezier(0,0,.2,1),box-shadow .12s cubic-bezier(0,0,.2,1);"
          + (sel ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
        marcar: (e: React.MouseEvent) => { e.stopPropagation(); alternarSelecao(l.leadId); },
        temMenu: dest.length > 0, menuAberto: menuCard === l.leadId, menuOpcoes: dest, menuRotulo: `Mover ${l.empresa} para…`,
        menuBtnStyle: "display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;padding:0;border:0;color:#4a5560;background:transparent;line-height:0;cursor:pointer",
        abrirMenu: (e: React.MouseEvent) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setMenuRect({ top: r.top, bottom: r.bottom, right: r.right });
          setMenuCard(menuCard === l.leadId ? null : l.leadId);
        },
        /* Fixo, e não absoluto: a lista da coluna rola e cortaria o menu do último cartão. */
        menuStyle: (() => {
          const r = menuRect;
          const vh = typeof window !== "undefined" ? window.innerHeight : 900;
          const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
          const paraCima = !!r && vh - r.bottom < 230 && r.top > vh - r.bottom;
          const pos = r
            ? (paraCima ? "bottom:" + (vh - r.top + 4) + "px;" : "top:" + (r.bottom + 4) + "px;") + "left:" + Math.max(8, Math.min(r.right - 208, vw - 216)) + "px;"
            : "top:120px;left:24px;";
          return "position:fixed;" + pos + "min-width:208px;z-index:46;border-radius:6px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 8px 20px -4px rgba(0,0,0,.18),0 2px 4px -2px rgba(0,0,0,.12);padding:4px;animation:of-rise .12s cubic-bezier(.2,0,.2,1) both";
        })(),
        style: "position:relative;border-radius:8px;background:#fff;padding:9px 12px 10px;cursor:grab;outline:none;transition:border-color .12s cubic-bezier(0,0,.2,1),box-shadow .12s cubic-bezier(0,0,.2,1);"
          + (pendente ? "opacity:.55;pointer-events:none;" : "")
          + (arrastando?.id === l.leadId
            ? "border:1px solid rgba(255,77,41,.2);box-shadow:0 2px 6px rgba(9,14,20,.12),0 18px 36px rgba(9,14,20,.26);rotate:-1.2deg;scale:1.02"
            : sel ? "border:1px solid #fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b"
              : p.abertoId === l.leadId ? "border:1px solid #fe4f2b" : "border:1px solid #dbdede"),
        pega: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.leadId); setArrastando({ id: l.leadId, estado: l.estado }); },
        larga: () => { setArrastando(null); setSobre(null); },
        abrir: () => { if (selecionados.length) alternarSelecao(l.leadId); else p.aoAbrir(l.leadId); },
      };
    }),
  }));

  /* Desfechos: as filas derivadas, como as colunas recolhidas de Pré-vendas
     (Nutrição, Desqualificado): aceitam soltar, e o clique abre a fila na Lista. */
  const recolhidas = (["pre_qualificado", "oportunidade", "sem_resposta", "descartado"] as EstadoProspeccao[]).map((e) => ({
    estado: e, label: e === "oportunidade" ? "Oportunidade direta" : ROTULO_ESTADO_PROSPECCAO[e], conta: p.contaDesfecho(e),
    ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + COR_ESTADO[e],
    style: alvoStyle(e, "flex:0 0 auto;width:46px;display:flex;flex-direction:column;align-items:center;gap:9px;padding:10px 0 12px;border-radius:12px;background:#eeeff3;cursor:pointer;border:0;"),
    abrir: () => { p.setSelecionados([]); p.navegar({ visao: null, estado: e, mostrar: null, pagina: null, lead: null }); },
    ...dnd(e),
  }));

  /* ── Lista ── */
  const colunasLista: Array<[string, string | null, boolean]> = [
    ["EMPRESA · PESSOA", "empresa", false], ["CADÊNCIA", "cadencia", false], ["RESPONSÁVEL", "responsavel", false],
    ["ESTADO", "estado", false], ["ATIVIDADE", "atividade", true],
  ];
  const ordemAtual = p.filtro.ordem ?? "atividade";
  const cabLista = colunasLista.map(([label, chave, direita]) => chave ? {
    label, direita, ativa: ordemAtual === chave,
    aria: ordemAtual === chave ? (p.filtro.direcao === "asc" ? "ascending" : "descending") : "none",
    seta: ordemAtual === chave ? (p.filtro.direcao === "asc" ? " ▲" : " ▼") : "",
    onClick: () => p.navegar({ ordem: chave, dir: ordemAtual === chave && p.filtro.direcao === "asc" ? "desc" : "asc", pagina: null }),
  } : { label, direita });

  const linha = (l: LinhaProspeccao) => {
    const sel = selecionados.includes(l.leadId);
    const acao = proximaAcao(l, agora);
    const [fundo, tinta] = TOM_ESTADO[l.estado];
    const equipe = [...p.opcoes.responsaveis.map((r) => ({ id: r.id as string | null, nome: r.nome })), { id: null, nome: null as string | null }];
    return {
      empresa: l.empresa, pessoa: l.pessoa ? `${l.pessoa}${l.cargo ? " · " + l.cargo : ""}` : "Sem pessoa associada",
      urgente: acao.urgente, acao: l.cadencia ? passo(l) : acao.texto,
      acaoStyle: "flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:" + (acao.urgente ? "600;color:#c2330f" : "400;color:#4a5560"),
      resp: l.responsavel ?? "Sem responsável",
      respStyle: "flex:1;min-width:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;" + (l.responsavel ? "color:#1f252c" : "color:#c2330f;font-weight:600"),
      respBtnStyle: "display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:32px;padding:0 8px 0 5px;border-radius:8px;border:0;cursor:pointer;transition:background 120ms cubic-bezier(0,0,.2,1);background:" + (respAberto === l.leadId ? "#f1f3f3" : "transparent"),
      respMenu: respAberto === l.leadId,
      respMenuStyle: "position:absolute;top:calc(100% + 4px);left:0;min-width:208px;max-height:240px;overflow-y:auto;z-index:46;border-radius:6px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 8px 20px -4px rgba(0,0,0,.18),0 2px 4px -2px rgba(0,0,0,.12);padding:4px;animation:of-rise .1s cubic-bezier(.2,0,.2,1) both",
      abrirResp: (e: React.MouseEvent) => { e.stopPropagation(); setRespAberto(respAberto === l.leadId ? null : l.leadId); },
      respOpcoes: equipe.map((o) => ({
        label: o.nome ?? "Sem responsável", iniciais: iniciaisDe(o.nome),
        avatar: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:700;background:" + (o.nome ? "#eeeff3;color:#616b78" : "#fdeae5;color:#9c3210"),
        style: "display:flex;align-items:center;gap:8px;width:100%;padding:5px 6px;border-radius:6px;border:0;cursor:pointer;background:transparent;" + (l.responsavelId === o.id ? "font-weight:600" : ""),
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); setRespAberto(null); if (l.responsavelId !== o.id) p.aoAtribuir(l.leadId, o.id); },
      })),
      iniciais: iniciaisDe(l.responsavel),
      avatarStyle: "flex:0 0 auto;width:24px;height:24px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:700;"
        + (l.responsavel ? "background:#eeeff3;color:#616b78" : "background:#fff;color:#c2330f;box-shadow:inset 0 0 0 1.5px #f0c8bd"),
      estado: l.estadoRotulo,
      estadoStyle: "display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;background:" + fundo + ";color:" + tinta,
      dias: diasDesde(l.atualizadoEm, agora) + "d",
      sel, selAttr: sel ? "1" : "0",
      checkStyle: "position:relative;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;padding:0;border:0;line-height:0;cursor:pointer;justify-self:center;"
        + (sel ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
      style: "display:grid;grid-template-columns:30px minmax(170px,1.7fr) minmax(180px,1.5fr) 176px 108px 66px;gap:10px;padding:10px 14px;align-items:center;border-bottom:1px solid #f3f5f5;cursor:pointer;" + (sel ? "background:#fff7f5" : ""),
      marcar: (e: React.MouseEvent) => { e.stopPropagation(); alternarSelecao(l.leadId); },
      abrir: () => { if (selecionados.length) alternarSelecao(l.leadId); else p.aoAbrir(l.leadId); },
    };
  };

  const rotuloGrupo = p.filtro.estado ? ROTULO_ESTADO_PROSPECCAO[p.filtro.estado] : "Base outbound";
  const aberto = !fechadas.base;
  const respondidas = p.linhas.filter((l) => l.estado === "respondeu").length;
  const listaGrupos = p.linhas.length === 0 ? [] : [{
    label: rotuloGrupo, conta: p.paginacao?.total ?? p.linhas.length, aberto,
    urgentes: respondidas, urgentesTexto: `${respondidas} ${respondidas === 1 ? "respondeu" : "responderam"}`, temUrgente: respondidas > 0,
    ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + (p.filtro.estado ? COR_ESTADO[p.filtro.estado] : "#8b949e"),
    chevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (aberto ? 0 : -90) + "deg)",
    cabecalhoStyle: "display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:#fbfbfb;border-bottom:1px solid #eef1f1;cursor:pointer;border-left:0;border-right:0;border-top:0",
    alternar: () => setFechadas((f) => ({ ...f, base: aberto })),
    linhas: p.linhas.map(linha),
  }];

  const pg = p.paginacao;
  const paginacao = emLista && pg && pg.total > 0 ? {
    porPagina: pg.porPagina, opcoes: POR_PAGINA_PROSPECCAO,
    mudarPorPagina: (e: React.ChangeEvent<HTMLSelectElement>) => p.navegar({ porPagina: e.target.value === "25" ? null : e.target.value, pagina: null }),
    texto: `${(pg.pagina - 1) * pg.porPagina + 1} a ${Math.min(pg.pagina * pg.porPagina, pg.total)} de ${pg.total} · página ${pg.pagina} de ${pg.paginas}`,
    temAnterior: pg.pagina > 1, temProxima: pg.pagina < pg.paginas,
    anterior: () => p.navegar({ pagina: pg.pagina - 1 > 1 ? String(pg.pagina - 1) : null }),
    proxima: () => p.navegar({ pagina: String(pg.pagina + 1) }),
    botaoStyle: (off: boolean) => "height:28px;padding:0 12px;border-radius:8px;border:0;font-size:12px;font-weight:500;background:#fff;box-shadow:inset 0 0 0 1px #dbdede;" + (off ? "color:#a3a8a4;cursor:not-allowed" : "color:#1f252c;cursor:pointer"),
  } : null;

  /* ── barra de seleção em massa (a escura de Pré-vendas) ── */
  const m = p.massa;
  const algumaFechada = !!fechadas.base;
  const acoesMassa = [
    { k: "responsavel", label: "Responsável", d: ICONES.responsavel },
    { k: "cadencia", label: "Cadência", d: ICONES.cadencia },
    { k: "lista", label: "Lista", d: ICONES.lista },
    { k: "tag", label: "Tag", d: ICONES.tag },
    { k: "pausar", label: "Pausar cadência", d: ICONES.pausa },
    { k: "enriquecer", label: "Enriquecer", d: ICONES.enriquecer },
  ].map((a) => ({
    label: a.label, d: a.d,
    style: "display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;font-size:12.5px;font-weight:500;flex:0 0 auto;color:"
      + (acaoMassa === a.k ? "#12171d;background:#eeeff3;font-weight:600" : "#d7dde2"),
    onClick: () => {
      if (a.k === "responsavel" || a.k === "cadencia") { setAcaoMassa(acaoMassa === a.k ? null : a.k); return; }
      setAcaoMassa(null);
      if (a.k === "lista" || a.k === "tag") m.aoTexto(a.k);
      else if (a.k === "pausar") { if (m.emCadenciaSelecionadas === 0) m.aviso("Nenhuma empresa selecionada está em cadência."); else m.aoPausar(); }
      else if (m.motivoSemEnriquecer) m.aviso(m.motivoSemEnriquecer);
      else m.aoEnriquecer();
    },
  }));
  const linhaPainel = "display:flex;align-items:center;gap:8px;width:100%;padding:5px 8px;border-radius:6px";
  const painelOpcoes = acaoMassa === "responsavel"
    ? [...m.responsaveis.map((r) => ({ label: r.nome, style: linhaPainel, onClick: () => { setAcaoMassa(null); m.aoResponsavel(r.id); } })),
      { label: "Remover responsável", style: linhaPainel, onClick: () => { setAcaoMassa(null); m.aoResponsavel(null); } }]
    : acaoMassa === "cadencia"
      ? (m.cadencias.length === 0
        ? [{ label: "Nenhuma cadência ativa. Crie uma em Automações › Cadências.", style: linhaPainel + ";color:#a3a8a4;cursor:not-allowed", onClick: () => undefined }]
        : m.cadencias.map((c) => ({ label: c.nome, style: linhaPainel, onClick: () => { setAcaoMassa(null); m.aoCadencia(c.id); } })))
      : [];

  return (
    <ProspeccaoDesenho
      acoesMassa={acoesMassa}
      alternarTodos={() => setFechadas(algumaFechada ? {} : { base: true })}
      alternarTodosLabel={algumaFechada ? "Abrir grupo" : "Fechar grupo"}
      busca={busca} setBusca={(e: React.ChangeEvent<HTMLInputElement>) => setBusca(e.target.value)}
      placeholderBusca="Empresa, pessoa, e-mail ou telefone"
      colunas={colunas} recolhidas={recolhidas}
      ehQuadro={emBoard} ehFila={emLista} ehOutra={!emBoard && !emLista} corpoOutro={p.corpoOutro}
      filtros={filtros} visoes={visoes} topoAcoes={topoAcoes}
      listaGrupos={listaGrupos} listaVazia={p.linhas.length === 0}
      listaVazioTitulo={p.filtro.busca || p.filtro.estado || p.filtro.responsavelId || p.filtro.lista || p.filtro.cadenciaId || p.filtro.fila ? "Nenhuma empresa com esses filtros" : "A base outbound está vazia"}
      listaVazioTexto={p.filtro.busca || p.filtro.estado || p.filtro.responsavelId || p.filtro.lista || p.filtro.cadenciaId || p.filtro.fila
        ? "Limpe a busca ou os filtros para ver a lista inteira."
        : "Adicione uma empresa, importe um CSV ou busque no Apollo para começar a prospectar."}
      tituloLista="Base outbound"
      subtituloLista={p.filtro.estado === "pre_qualificado" ? "entregues a Pré-vendas, na etapa Novo" : p.filtro.estado === "oportunidade" ? "foram direto ao Pipeline" : "clique em uma empresa para abrir; arraste no Kanban para mudar o estado"}
      totalLista={pg ? `${p.linhas.length} de ${pg.total} empresas` : ""}
      cabLista={cabLista} paginacao={paginacao}
      temSelecao={selecionados.length > 0 && (emBoard || emLista)} qtdSelecao={selecionados.length}
      rotuloSelecao={selecionados.length === 1 ? "empresa selecionada" : "empresas selecionadas"}
      limparSelecao={() => { p.setSelecionados([]); setAcaoMassa(null); }}
      painelAberto={!!acaoMassa && painelOpcoes.length > 0}
      painelTitulo={acaoMassa === "responsavel" ? "ATRIBUIR RESPONSÁVEL" : acaoMassa === "cadencia" ? "INCLUIR EM CADÊNCIA" : ""}
      painelOpcoes={painelOpcoes}
      parar={(e: React.MouseEvent) => e.stopPropagation()}
    />
  );
}

