"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Lead — a lógica da tela.
 *
 * `LeadDesenho` é o markup (copiado e adaptado da Oportunidade) e `LeadProto`
 * o adaptador de dados. Este arquivo fica no meio: estado de tela (aba, menu,
 * rascunho da qualificação, nota em edição) e a tradução do que o usuário faz
 * para uma chamada de `acoes`.
 *
 * Diferente da Liga da Oportunidade (gerada do protótipo, que guarda a lista
 * inteira no estado e persiste por diferença), aqui NADA é guardado só no
 * cliente: cada gesto chama o command e a tela relê do servidor. O único
 * estado local que sobrevive é o rascunho do que se está digitando, e ele
 * volta ao valor do servidor quando a gravação falha.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { toast } from "sonner";
import { avatarDe } from "./avatar-do-proto";

import type { Resultado } from "@/lib/vendas/resultado";
import { LeadDesenho } from "./LeadDesenho";
import {
  OPCOES_FIT, OPCOES_INTERESSE, faixaDeTamanho, qualMudou, qualPreenchidos,
  type BannerDoLead, type QualDaTela, type TileDeSla,
} from "./lead-da-tela";

/* ── O que a Liga recebe ───────────────────────────────────────────────── */

export interface AtividadeDaTela {
  id: string; tarefaId: string; reuniaoId?: string; tipo: string; titulo: string; desc: string;
  autor: string; quando: string; situacao: string; feita: boolean;
}
export interface NotaDaTela { id: string; autor: string; texto: string; quando: string; sistema: boolean }
export interface EventoDaTela { t: string; quando: string; autor: string }
export interface RelacaoDaTela { id: string; tipo: string; titulo: string; sub: string; status: string; tom: string; href: string }

export interface LeadDaTela {
  id: string;
  moduloRotulo: string;
  titulo: string;
  empresa: { id: string | null; nome: string; sub: string; temEmpresa: boolean };
  pessoa: { nome: string; cargo: string; email: string | null; telefone: string | null; whatsapp: string | null };
  etapa: string;
  etapaRotulo: string;
  diasTexto: string;
  resp: { id: string | null; nome: string | null };
  equipe: string[];
  criadoEm: string;
  origem: { selo: string; titulo: string; sub: string; linhas: Array<{ label: string; valor: string; destaque?: boolean }> };
  tags: string[];
  sla: TileDeSla[];
  banner: BannerDoLead | null;
  qual: QualDaTela;
  proxima: { titulo: string; sub: string; atrasada: boolean; tarefaId: string | null } | null;
  cadencia: { nome: string; pausada: boolean } | null;
  respostas: Array<{ pergunta: string; resposta: string }>;
  relacoes: RelacaoDaTela[];
  relacoesVazio: string;
  atividades: AtividadeDaTela[];
  notas: NotaDaTela[];
  eventos: EventoDaTela[];
}

type Acao<T = unknown> = Promise<Resultado<T>>;

/** O que a tela pode FAZER. Cada função grava (ou recusa) e devolve o resultado. */
export interface AcoesDoLead {
  moverEtapa: (para: "novo" | "em_contato" | "qualificacao") => Acao;
  reativar: () => Acao;
  salvarQualificacao: (rascunho: QualDaTela) => Acao;
  atribuir: (nome: string | null) => Acao;
  criarNota: (texto: string) => Acao;
  excluirNota: (id: string) => Acao;
  pausarCadencia: (pausar: boolean) => Acao;
  removerDaCadencia: () => Acao;
  /** Peça do protótipo por cima da tela (qualificar, nutrir, desqualificar, oportunidade, cadência, tags…). */
  abrirPeca: (peca: string, id?: string | null, contexto?: Record<string, unknown>) => void;
  ir: (rota: string) => void;
  ligar: () => void;
  falar: (canal: "whatsapp" | "email") => void;
  /** Volta para a lista do módulo (o board de Pré-vendas). */
  voltar: () => void;
}

interface Props { l: LeadDaTela | null; acoes: AcoesDoLead }

/* ── Estilos do desenho (mesma gramática de strings da Oportunidade) ───── */

const ICONE = {
  ligacao: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39",
  email: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  mensagem: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
  tarefa: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  movido: "M5 12h14M13 6l6 6-6 6",
  proposta: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  reuniao: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  empresa: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4",
  pessoa: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  origem: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20",
  campanha: "M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6",
  nutrir: "M12 22V12M12 12C12 7 8 4 3 4c0 5 3 8 9 8zM12 12c0-4 3-7 9-7 0 5-3 8-9 8",
  descartar: "M18 6 6 18M6 6l12 12",
  oportunidade: "M12 2a10 10 0 1 0 10 10M12 6a6 6 0 1 0 6 6M12 10a2 2 0 1 0 2 2M22 2l-10 10M16 2h6v6",
  qualificar: "M20 6 9 17l-5-5",
  empresaMais: "M12 5v14M5 12h14",
};

const COR_ETAPA: Record<string, string> = {
  novo: "#4a5560", em_contato: "#2c5f9e", qualificacao: "#9c7a2e", qualificado: "#1f7256",
  oportunidade: "#fe4f2b", nutricao: "#2c5f9e", desqualificado: "#8b949e",
};

const iconeDoEvento = (t: string): [string, string, string] => {
  const IC = {
    reuniao: [ICONE.reuniao, "#fff6f4", "#c2330f"], ligacao: [ICONE.ligacao, "#e6f4ee", "#1f7256"],
    email: [ICONE.email, "#e8f0fb", "#2c5f9e"], mensagem: [ICONE.mensagem, "#e6f4ee", "#1f7256"],
    proposta: [ICONE.proposta, "#fdeeea", "#c2330f"], movido: [ICONE.movido, "#eeeff3", "#4a5560"],
    tarefa: [ICONE.tarefa, "#eeeff3", "#4a5560"],
  } as Record<string, [string, string, string]>;
  return /proposta/i.test(t) ? IC.proposta : /reuni/i.test(t) ? IC.reuniao : /liga/i.test(t) ? IC.ligacao
    : /e-?mail/i.test(t) ? IC.email : /whats|mensagem/i.test(t) ? IC.mensagem
    : /etapa|movid|reativ|nutri|desqual|qualific|oportunidade/i.test(t) ? IC.movido : IC.tarefa;
};

const iniciais = (n: string | null | undefined) =>
  (n ?? "").split(/\s+/).filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "—";

const itemDeMenu = (label: string, onClick: () => void, extra: Record<string, unknown> = {}) => ({
  label, onClick, atual: false, dot: "display:none",
  style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 10px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:500;color:#12171d",
  ...extra,
});

const TOM_TILE: Record<string, string> = { ok: "#1f7256", aviso: "#9c7a2e", erro: "#c2330f", neutro: "#12171d" };
const TOM_RELACAO: Record<string, string> = {
  verde: "background:#e6f4ee;color:#1f7256", coral: "background:#fff6f4;color:#9c3210",
  azul: "background:#e8f0fb;color:#2c5f9e", cinza: "background:#eeeff3;color:#4a5560",
};
const TOM_BANNER: Record<string, string> = {
  azul: "background:#e8f0fb;color:#2c5f9e", cinza: "background:#f3f4f4;color:#4a5560", verde: "background:#e6f4ee;color:#1f7256",
};

/* ── A tela ────────────────────────────────────────────────────────────── */

export function LeadLiga({ l, acoes }: Props) {
  const [aba, setAba] = React.useState<"geral" | "atv" | "tl">("geral");
  const [menu, setMenu] = React.useState<null | "nova" | "etapas" | "mais" | "qual">(null);
  const [atvF, setAtvF] = React.useState<"todas" | "abertas" | "concluidas">("todas");
  const [nota, setNota] = React.useState("");
  const [notaAtiva, setNotaAtiva] = React.useState(false);
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const notaRef = React.useRef<HTMLTextAreaElement>(null);

  /* Rascunho da qualificação: só o que se digita, e só vale para a versão do
     servidor contra a qual foi editado. Quando o servidor muda (gravou, ou outra
     pessoa mexeu) o rascunho deixa de valer e a tela mostra o que ficou gravado. */
  const servidor = l?.qual;
  const chaveDoServidor = JSON.stringify(servidor ?? null);
  const [edicao, setEdicao] = React.useState<{ chave: string; q: QualDaTela } | null>(null);
  const rascunho = servidor ? (edicao?.chave === chaveDoServidor ? edicao.q : servidor) : null;
  const setRascunho = (q: QualDaTela | null) => setEdicao(q ? { chave: chaveDoServidor, q } : null);
  const [qualErro, setQualErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);

  const roda = async (chave: string, fn: () => Acao, ok?: string): Promise<boolean> => {
    if (ocupado) return false;
    setOcupado(chave);
    try {
      const r = await fn();
      if (!r.ok) { toast.error(r.erro ?? "Não consegui gravar."); return false; }
      if (ok) toast.success(ok);
      return true;
    } catch {
      toast.error("Não consegui gravar. Tente de novo.");
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const vals = React.useMemo(() => {
    if (!l) return null;
    const ctxPeca = { tela: "lead", leadId: l.id, empresaId: l.empresa.id, empresa: l.empresa.nome, pessoa: l.pessoa.nome };
    const fecharMenus = () => setMenu(null);
    const abrirPeca = (peca: string, id: string | null = l.id, extra: Record<string, unknown> = {}) => {
      setMenu(null);
      acoes.abrirPeca(peca, id, { ...ctxPeca, ...extra });
    };

    /* ── cabeçalho ── */
    const etapaMovivel = ["novo", "em_contato", "qualificacao", "qualificado"].includes(l.etapa);
    const cor = COR_ETAPA[l.etapa] ?? "#4a5560";
    const tel = l.pessoa.telefone || l.pessoa.whatsapp;
    const temTel = !!(tel && tel.replace(/\D/g, "").length >= 10);
    const metaBtn = (link: boolean) => "display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;font-size:12.5px;white-space:nowrap;max-width:100%;min-width:0;cursor:" + (link ? "pointer" : "default");
    const meta = [
      [ICONE.empresa, "Empresa:", l.empresa.temEmpresa ? l.empresa.nome : "Sem empresa", l.empresa.temEmpresa ? () => acoes.ir(`/empresas/${l.empresa.id}`) : () => abrirPeca("vincular"), true],
      [ICONE.pessoa, "Contato:", l.pessoa.cargo ? `${l.pessoa.nome} (${l.pessoa.cargo})` : l.pessoa.nome, () => acoes.ir(`/pessoas/${l.id}`), true],
      ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "Responsável:", l.resp.nome ?? "Sem responsável", null, !!l.resp.nome],
      [ICONE.origem, "Origem:", l.origem.titulo, null, true],
    ].map(([d, label, valor, onClick, tem]) => ({
      d, label, valor, onClick: (onClick as (() => void) | null) ?? (() => {}), style: metaBtn(!!onClick),
      valorStyle: "min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:600;color:" + (onClick ? "#c2330f" : tem ? "#12171d" : "#c2330f"),
    }));
    const tagsCab = l.tags.slice(0, 4).map((nome) => ({
      nome, style: "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:9999px;font-size:11.5px;font-weight:600;background:#eeeff3;color:#1f252c",
    })).concat(l.tags.length > 4 ? [{ nome: `+${l.tags.length - 4}`, style: "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:9999px;font-size:11.5px;font-weight:600;background:#fff;color:#67787c;box-shadow:inset 0 0 0 1px #dbdede" }] : []);

    const o = {
      moduloRotulo: l.moduloRotulo,
      titulo: l.titulo, empresa: l.empresa.nome, pessoa: l.pessoa.nome, cargo: l.pessoa.cargo || "—",
      empIni: iniciais(l.empresa.nome), pesIni: iniciais(l.pessoa.nome), empSub: l.empresa.sub,
      resp: l.resp.nome ?? "Sem responsável", respIni: avatarDe(l.resp.nome, iniciais(l.resp.nome)),
      etapaLabel: l.etapaRotulo, etapaPonto: "width:7px;height:7px;border-radius:9999px;background:" + cor,
      etapaChip: "display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:9999px;border:0;font-size:12px;font-weight:600;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:" + cor + ";cursor:" + (etapaMovivel ? "pointer" : "default"),
      etapaDica: etapaMovivel ? "Mover de etapa" : "Esta etapa muda pelo banner abaixo",
      etapaMovivel, diasTexto: l.diasTexto,
      meta, tagsCab,
      empresaAcao: l.empresa.temEmpresa ? "Ver empresa" : "Vincular empresa",
      mostrarSaidas: ["novo", "em_contato", "qualificacao", "qualificado"].includes(l.etapa),
      temBanner: !!l.banner,
      bannerStyle: "display:flex;align-items:center;gap:10px;margin-top:12px;padding:11px 12px;border-radius:11px;" + (l.banner ? TOM_BANNER[l.banner.tom] : ""),
      bannerIco: l.banner?.tom === "verde" ? ICONE.qualificar : l.banner?.tom === "azul" ? ICONE.nutrir : ICONE.descartar,
      bannerTitulo: l.banner?.titulo ?? "", bannerSub: l.banner?.sub ?? "",
      bannerAcaoLabel: l.banner?.acaoLabel ?? null,
      bannerAcao: () => {
        const b = l.banner;
        if (!b) return;
        if (b.acao === "reativar") void roda("reativar", acoes.reativar, "Lead reativado em Em contato");
        else if (b.acao === "abrir-oportunidade" && b.oportunidadeId) acoes.ir(`/pipeline/${b.oportunidadeId}`);
      },
    };

    const contatoAcoes = [
      { label: "Ligar", d: ICONE.ligacao, off: !temTel, dica: temTel ? "Ligar pelo Callface" : "Sem telefone cadastrado", onClick: () => (temTel ? acoes.ligar() : toast.warning("Sem telefone cadastrado para ligar.")) },
      { label: "WhatsApp", d: ICONE.mensagem, off: !temTel, dica: temTel ? "Abrir a conversa no Atendimento" : "Sem telefone ou WhatsApp cadastrado", onClick: () => (temTel ? acoes.falar("whatsapp") : toast.warning("Sem telefone ou WhatsApp cadastrado.")) },
      { label: "E-mail", d: ICONE.email, off: !l.pessoa.email, dica: l.pessoa.email ?? "Sem e-mail cadastrado", onClick: () => (l.pessoa.email ? acoes.falar("email") : toast.warning("Sem e-mail cadastrado.")) },
    ];

    const registrar = () => abrirPeca("novaAtividade", null);
    const focarNota = () => {
      setMenu(null); setAba("geral"); setNotaAtiva(true);
      setTimeout(() => {
        const el = notaRef.current;
        if (!el) return;
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    };

    const novaItens = [
      { label: "Atividade", sub: "Ligação, reunião, e-mail, tarefa…", d: ICONE.tarefa, onClick: registrar },
      { label: "Nota interna", sub: "Registro para o time, com @menção", d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5", onClick: focarNota },
    ];

    const semEmpresaMotivo = "Lead sem empresa: vincule uma empresa antes de criar a oportunidade.";
    const criarOpp = {
      label: "Criar oportunidade", sub: l.empresa.temEmpresa ? "Leva o lead para o Pipeline" : semEmpresaMotivo, d: ICONE.oportunidade,
      off: !l.empresa.temEmpresa, dica: l.empresa.temEmpresa ? "Cria a oportunidade no Pipeline" : semEmpresaMotivo,
      icoStyle: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:#fff6f4;color:#c2330f",
      onClick: () => (l.empresa.temEmpresa ? abrirPeca("oportunidade", l.id, {
        /* Criou: a tela segue o lead para a oportunidade (o handoff do Pré-vendas). */
        aoCriarOportunidade: (ids: string[]) => { if (ids[0]) acoes.ir(`/pipeline/${ids[0]}`); },
      }) : toast.warning(semEmpresaMotivo)),
    };
    const qualItens = [
      { label: "Nutrir", sub: "Pausar com motivo e data de retomada", d: ICONE.nutrir, icoStyle: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:#e8f0fb;color:#2c5f9e", onClick: () => abrirPeca("nutrir") },
      { label: "Descartar", sub: "Desqualifica, com motivo obrigatório", d: ICONE.descartar, icoStyle: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:#fdeeea;color:#c2330f", onClick: () => abrirPeca("desqualificar") },
      criarOpp,
      ...(l.empresa.temEmpresa ? [] : [{ label: "Vincular empresa", sub: "Associa a empresa a este lead", d: ICONE.empresaMais, icoStyle: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:#eeeff3;color:#4a5560", onClick: () => abrirPeca("vincular") }]),
    ];
    const qualPrincipal = l.etapa === "qualificado"
      ? { label: "Criar oportunidade", dica: criarOpp.dica, onClick: criarOpp.onClick }
      : { label: "Qualificar", dica: "Marca o lead como qualificado", onClick: () => abrirPeca("qualificar") };

    const etapasItens = (["novo", "em_contato", "qualificacao"] as const).map((k) =>
      itemDeMenu(({ novo: "Novo", em_contato: "Em contato", qualificacao: "Qualificação" })[k], () => {
        setMenu(null);
        if (k !== l.etapa) void roda("etapa", () => acoes.moverEtapa(k), `Movido para ${({ novo: "Novo", em_contato: "Em contato", qualificacao: "Qualificação" })[k]}`);
      }, { atual: k === l.etapa, dot: "flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:" + COR_ETAPA[k] }));

    const maisItens = [
      itemDeMenu("Abrir contato", () => acoes.ir(`/pessoas/${l.id}`)),
      itemDeMenu(l.empresa.temEmpresa ? "Abrir empresa" : "Vincular empresa", () => (l.empresa.temEmpresa ? acoes.ir(`/empresas/${l.empresa.id}`) : abrirPeca("vincular"))),
      itemDeMenu("Tags", () => abrirPeca("tagslead")),
      itemDeMenu(l.cadencia ? "Trocar cadência" : "Inserir em cadência", () => abrirPeca("cadencia")),
      itemDeMenu("Ver no board de Pré-vendas", acoes.voltar),
    ];

    /* ── abas ── */
    const abertas = l.atividades.filter((a) => !a.feita);
    const ordenadas = abertas.concat(l.atividades.filter((a) => a.feita));
    const filtradas = ordenadas.filter((a) => atvF === "todas" || (atvF === "abertas" ? !a.feita : a.feita));
    const abas = ([["geral", "Visão geral", 0], ["atv", "Atividades", ordenadas.length], ["tl", "Timeline", l.eventos.length]] as const).map(([k, label, n]) => ({
      label, n, temN: n > 0, onClick: () => setAba(k),
      style: "flex:0 0 auto;display:flex;align-items:center;gap:6px;height:38px;padding:0 12px;border:0;background:transparent;cursor:pointer;font-size:13px;white-space:nowrap;margin-bottom:-1px;" + (aba === k ? "font-weight:600;color:#12171d;box-shadow:inset 0 -2px 0 #fe4f2b" : "font-weight:500;color:#67787c"),
      nStyle: "font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:" + (aba === k ? "#c2330f" : "#8b949e"),
    }));

    const atvs = filtradas.map((a, n) => ({
      titulo: a.titulo, meta: [a.tipo, a.autor, a.desc].filter(Boolean).join(" · "), quando: a.quando, situacao: a.situacao,
      d: ICONE.tarefa,
      ver: () => (a.reuniaoId ? abrirPeca("reuniao", a.reuniaoId, { leadId: l.id }) : abrirPeca("verAtividade", `p:${a.tarefaId}`)),
      seloStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;" + (a.situacao === "Feita" ? "background:#e6f4ee;color:#1f7256" : a.situacao === "Declinada" ? "background:#eeeff3;color:#67787c" : a.situacao === "Em andamento" ? "background:#e8f0fb;color:#2c5f9e" : "background:#fff6f4;color:#9c3210"),
      marca: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (a.feita ? "background:#eeeff3;color:#4a5560" : "background:#fff6f4;color:#c2330f"),
      linhaStyle: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 8px;border:0;background:transparent;cursor:pointer;text-align:left;border-radius:8px;" + (n ? "border-top:1px solid #f3f5f5" : ""),
    }));
    const atvFiltros = ([["todas", "Todas"], ["abertas", "Abertas"], ["concluidas", "Concluídas"]] as const).map(([k, label]) => ({
      label: `${label} · ${ordenadas.filter((a) => k === "todas" || (k === "abertas" ? !a.feita : a.feita)).length}`,
      style: "height:28px;padding:0 11px;border-radius:7px;border:0;font-size:12px;white-space:nowrap;cursor:pointer;font-weight:" + (atvF === k ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
      onClick: () => setAtvF(k),
    }));

    const tl = l.eventos;
    const tlResumo = tl.slice(0, 5).map((ev, i, arr) => {
      const ic = iconeDoEvento(ev.t);
      return {
        t: ev.t, autor: ev.autor, quando: ev.quando, d: ic[0],
        bolha: "flex:0 0 auto;width:30px;height:30px;border-radius:9999px;display:grid;place-items:center;background:" + ic[1] + ";color:" + ic[2],
        linha: "flex:1;width:1.5px;margin:3px 0;background:" + (i < arr.length - 1 ? "#e3e7e8" : "transparent"),
      };
    });
    const tlTudo = tl.map((ev, i, arr) => ({
      t: ev.t, autor: ev.autor, quando: ev.quando,
      dot: "flex:0 0 auto;width:9px;height:9px;border-radius:9999px;margin-top:6px;box-sizing:border-box;" + (i === 0 ? "background:#fe4f2b" : "background:#fff;border:1.5px solid #b8bdbb"),
      linhaFina: "flex:1;width:1.5px;margin-top:5px;background:" + (i < arr.length - 1 ? "#e3e7e8" : "transparent"),
    }));

    /* ── nota rápida com @menção ── */
    const TIME = l.equipe;
    const mm = /(^|\s)@([^\s@]{0,20})$/.exec(nota);
    const menc = mm ? TIME.filter((n) => n.toLowerCase().includes(mm[2].toLowerCase()) || n.toLowerCase().split(" ").some((p) => p.startsWith(mm[2].toLowerCase()))) : [];
    const partesDe = (txt: string) => {
      if (!TIME.length) return [{ txt, style: "" }];
      const re = new RegExp("@(" + TIME.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g");
      const out: Array<{ txt: string; style: string }> = [];
      let ultimo = 0; let x: RegExpExecArray | null;
      while ((x = re.exec(txt))) {
        if (x.index > ultimo) out.push({ txt: txt.slice(ultimo, x.index), style: "" });
        out.push({ txt: x[0], style: "font-weight:600;color:#c2330f;background:#fff6f4;border-radius:4px;padding:0 3px" });
        ultimo = x.index + x[0].length;
      }
      if (ultimo < txt.length) out.push({ txt: txt.slice(ultimo), style: "" });
      return out.length ? out : [{ txt, style: "" }];
    };
    const podeSalvarNota = !!nota.trim() && ocupado !== "nota";
    const salvarNota = async () => {
      if (!nota.trim()) return;
      const ok = await roda("nota", () => acoes.criarNota(nota.trim()), "Nota adicionada");
      if (ok) { setNota(""); setNotaAtiva(false); }
    };
    const ativa = notaAtiva || !!nota;
    const ntLista = l.notas.map((n, k) => ({
      autor: n.sistema ? "Sistema · Callface" : n.autor, ini: n.sistema ? iniciais(n.autor) : avatarDe(n.autor, iniciais(n.autor)), quando: n.quando, sistema: n.sistema, humano: !n.sistema,
      fixada: false, temTag: false, tag: "", partes: partesDe(n.texto), temAnexos: false, anexos: [],
      linha: "display:flex;align-items:flex-start;gap:10px;padding:10px 2px;" + (k ? "border-top:1px solid #f3f5f5" : ""),
      tagStyle: "", fixarTitulo: "", fixarStyle: "display:none",
      remover: () => { void roda("nota-excluir", () => acoes.excluirNota(n.id), "Nota excluída"); },
    }));
    const nt = {
      conta: l.notas.length ? `${l.notas.length} ${l.notas.length > 1 ? "notas" : "nota"}` : "",
      texto: nota, ativa, linhas: ativa ? 3 : 1,
      temMencao: menc.length > 0,
      mencoes: menc.map((n) => ({
        nome: n, ini: avatarDe(n, iniciais(n)),
        escolher: (e: React.SyntheticEvent) => { e.preventDefault(); setNota(nota.slice(0, nota.length - (mm?.[2].length ?? 0) - 1) + "@" + n + " "); },
      })),
      caixa: "border-radius:10px;background:" + (ativa ? "#fff" : "#fafafa") + ";box-shadow:inset 0 0 0 1px " + (ativa ? "#a9b1b4" : "#e3e7e8"),
      set: (e: React.ChangeEvent<HTMLTextAreaElement>) => setNota(e.target.value),
      foco: () => setNotaAtiva(true),
      tecla: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void salvarNota(); }
        if (e.key === "Escape") { setNota(""); setNotaAtiva(false); e.currentTarget.blur(); }
      },
      cancelar: () => { setNota(""); setNotaAtiva(false); },
      salvar: () => { void salvarNota(); },
      btn: "flex:0 0 auto;height:28px;padding:0 12px;border-radius:7px;border:0;font-size:12px;font-weight:600;cursor:" + (podeSalvarNota ? "pointer;background:#12171d;color:#fff" : "default;background:#eeeff3;color:#a3a8a4"),
      temAnexos: false, anexos: [], anexar: () => {},
      vazia: !l.notas.length, lista: ntLista,
    };

    /* ── tags ── */
    const tg = {
      tags: l.tags.map((nome) => ({ nome, auto: false, style: "display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:600;white-space:nowrap;background:#eeeff3;color:#1f252c" })),
      abrirTags: () => abrirPeca("tagslead"),
      nota: "",
    };

    /* ── qualificação (rascunho local, gravada por blur ou pelo botão) ── */
    const R = rascunho ?? l.qual;
    const mudou = qualMudou(l.qual, R);
    const sujoAgora = mudou.qualificacao || mudou.observacao;
    const gravarQual = async (proximo: QualDaTela = R) => {
      if (salvando) return;
      const m = qualMudou(l.qual, proximo);
      if (!m.qualificacao && !m.observacao) return;
      setSalvando(true); setQualErro(null);
      try {
        const r = await acoes.salvarQualificacao(proximo);
        if (!r.ok) {
          /* Rollback: o rascunho volta ao que está gravado, e a tela diz por quê. */
          setEdicao(null); setQualErro(r.erro ?? "Não consegui salvar a qualificação.");
          toast.error(r.erro ?? "Não consegui salvar a qualificação.");
        } else {
          toast.success("Qualificação salva");
        }
      } catch {
        setEdicao(null); setQualErro("Não consegui salvar a qualificação. Tente de novo.");
        toast.error("Não consegui salvar a qualificação.");
      } finally {
        setSalvando(false);
      }
    };
    const mudar = (parcial: Partial<QualDaTela>, gravarJa = false) => {
      const proximo = { ...R, ...parcial };
      setRascunho(proximo); setQualErro(null);
      if (gravarJa) void gravarQual(proximo);
    };
    const chip = (on: boolean) => "height:28px;padding:0 11px;border-radius:9999px;font-size:12px;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;font-weight:" + (on ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #dbdede");
    const campoStyle = "width:100%;padding:8px 10px;border-radius:8px;border:0;outline:0;background:#fff;font-size:13px;line-height:1.5;color:#12171d;box-shadow:inset 0 0 0 1px #dbdede;resize:vertical";
    const faixa = faixaDeTamanho(R.tamanho);
    const TOM_FAIXA: Record<string, string> = { neutro: "background:#eeeff3;color:#4a5560", azul: "background:#e8f0fb;color:#2c5f9e", verde: "background:#e6f4ee;color:#1f7256", coral: "background:#fff6f4;color:#9c3210" };
    const linha = (i: number) => "display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr);gap:14px;align-items:start;padding:10px 0;" + (i ? "border-top:1px solid #f3f5f5" : "");
    const prog = qualPreenchidos(R);
    const qual = {
      progresso: `${prog} de 4 campos`,
      seloStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;" + (prog === 4 ? "background:#e6f4ee;color:#1f7256" : prog === 0 ? "background:#f7edd8;color:#6e5420" : "background:#eeeff3;color:#4a5560"),
      salvar: () => { void gravarQual(); },
      salvarOff: !sujoAgora || salvando,
      salvarDica: salvando ? "Salvando…" : sujoAgora ? "Salvar as alterações" : "Nada a salvar",
      salvarLabel: salvando ? "Salvando…" : sujoAgora ? "Salvar" : "Salvo",
      salvarStyle: "display:flex;align-items:center;height:28px;padding:0 12px;border-radius:7px;border:0;font-size:11.5px;font-weight:600;white-space:nowrap;" + (sujoAgora && !salvando ? "cursor:pointer;background:#12171d;color:#fff" : "cursor:default;background:#eeeff3;color:#a3a8a4"),
      erro: qualErro,
      campos: [
        { label: "Interesse", ehChips: true, ehNumero: false, ehTexto: false, linha: linha(0),
          opcoes: OPCOES_INTERESSE.map((op) => {
            const on = R.interesse.includes(op);
            return { label: op, on, style: chip(on), onClick: () => mudar({ interesse: on ? R.interesse.filter((x) => x !== op) : R.interesse.concat(op) }, true) };
          }) },
        { label: "Tamanho da operação", ehChips: false, ehNumero: true, ehTexto: false, linha: linha(1), valor: R.tamanho, dica: "Nº de agentes",
          set: (e: React.ChangeEvent<HTMLInputElement>) => mudar({ tamanho: e.target.value.replace(/[^0-9]/g, "") }), blur: () => { void gravarQual(); },
          inputStyle: "width:150px;height:32px;padding:0 10px;border-radius:8px;border:0;outline:0;background:#fff;font-size:13px;color:#12171d;box-shadow:inset 0 0 0 1px #dbdede",
          temSelo: !!faixa, selo: faixa?.rotulo ?? "", seloStyle: "font-size:10.5px;font-weight:700;border-radius:5px;padding:2px 7px;white-space:nowrap;" + (faixa ? TOM_FAIXA[faixa.tom] : "") },
        { label: "Dor principal", ehChips: false, ehNumero: false, ehTexto: true, linha: linha(2), valor: R.dor, dica: "Ex: atendimento manual não escala",
          set: (e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ dor: e.target.value }), blur: () => { void gravarQual(); }, inputStyle: campoStyle },
        { label: "Fit", ehChips: true, ehNumero: false, ehTexto: false, linha: linha(3),
          opcoes: OPCOES_FIT.map((op) => {
            const on = R.fit === op;
            return { label: op, on, style: chip(on), onClick: () => mudar({ fit: on ? "" : op }, true) };
          }) },
        { label: "Observação", ehChips: false, ehNumero: false, ehTexto: true, linha: linha(4), valor: R.observacao, dica: `Contexto sobre ${l.pessoa.nome.split(" ")[0]} para o time`,
          set: (e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ observacao: e.target.value }), blur: () => { void gravarQual(); }, inputStyle: campoStyle },
      ],
    };

    /* ── próxima ação ── */
    const prox = {
      tem: !!l.proxima, sem: !l.proxima,
      titulo: l.proxima?.titulo ?? "", sub: l.proxima?.sub ?? "",
      subStyle: "display:block;font-size:11.5px;margin-top:2px;font-weight:" + (l.proxima?.atrasada ? "600;color:#c2330f" : "400;color:#67787c"),
      marca: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (l.proxima?.atrasada ? "background:#fdeeea;color:#c2330f" : "background:#fff6f4;color:#c2330f"),
      acaoLabel: l.proxima ? "Nova" : "Criar",
      acao: () => abrirPeca("novaAtividade", null),
      ver: () => (l.proxima?.tarefaId ? abrirPeca("verAtividade", `p:${l.proxima.tarefaId}`) : abrirPeca("novaAtividade", null)),
    };

    /* ── cadência ── */
    const cad = {
      tem: !!l.cadencia, sem: !l.cadencia,
      nome: l.cadencia?.nome ?? "", estado: l.cadencia ? (l.cadencia.pausada ? "Pausada" : "Ativa: os toques seguem o calendário") : "",
      acaoPrincipalLabel: l.cadencia ? "Trocar" : "Inserir",
      acaoPrincipal: () => abrirPeca("cadencia"),
      pausarLabel: l.cadencia?.pausada ? "Retomar" : "Pausar",
      pausar: () => { void roda("cad", () => acoes.pausarCadencia(!l.cadencia?.pausada), l.cadencia?.pausada ? "Cadência retomada" : "Cadência pausada"); },
      remover: () => { void roda("cad", acoes.removerDaCadencia, "Lead fora da cadência"); },
    };

    const formulario = {
      tem: l.respostas.length > 0, conta: `${l.respostas.length} ${l.respostas.length === 1 ? "resposta" : "respostas"}`, linhas: l.respostas,
    };

    const rel = {
      itens: l.relacoes.map((r, i) => ({
        tipo: r.tipo, titulo: r.titulo, sub: r.sub, status: r.status, onClick: () => acoes.ir(r.href),
        statusStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;" + (TOM_RELACAO[r.tom] ?? TOM_RELACAO.cinza),
        linha: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;background:#fff;cursor:pointer;text-align:left;" + (i ? "border-top:1px solid #eef1f1" : ""),
      })),
      vazio: l.relacoes.length === 0, vazioTxt: l.relacoesVazio,
    };

    /* ── responsável ── */
    const SEM = "Sem responsável";
    const setResp = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      if (v === (l.resp.nome ?? SEM)) return;
      void roda("resp", () => acoes.atribuir(v === SEM ? null : v), v === SEM ? "Responsável removido" : `Responsável: ${v}`);
    };
    const equipe = [SEM, ...l.equipe.filter((n) => n !== SEM)];

    return {
      temL: true, semL: false,
      abaAtv: aba === "atv", abaGeral: aba === "geral", abaTl: aba === "tl", abas,
      abrirEmpresa: () => (l.empresa.temEmpresa ? acoes.ir(`/empresas/${l.empresa.id}`) : abrirPeca("vincular")),
      abrirPessoa: () => acoes.ir(`/pessoas/${l.id}`),
      atvFiltros, atvMaisGeral: filtradas.length > 5, atvVazia: atvF === "abertas" ? "Nenhuma atividade aberta" : atvF === "concluidas" ? "Nenhuma atividade concluída" : "Nenhuma atividade ainda",
      atvs, atvsGeral: atvs.slice(0, 5), cad, contatoAcoes, equipe,
      etapasAberto: menu === "etapas" && etapaMovivel, etapasItens, fecharMenus, formulario,
      irAtividades: () => setAba("atv"), irTimeline: () => setAba("tl"),
      maisAberto: menu === "mais", maisItens, menuAberto: !!menu, notaRef,
      novaAberto: menu === "nova", novaItens, nt, o, orig: {
        selo: l.origem.selo, d: l.origem.selo === "Manual" ? "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" : "M22 12h-4l-3 9L9 3l-3 9H2",
        titulo: l.origem.titulo, sub: l.origem.sub,
        linhas: l.origem.linhas.map((x) => ({ label: x.label, valor: x.valor, valorStyle: "min-width:0;font-size:13px;font-weight:500;overflow-wrap:anywhere;color:" + (x.destaque ? "#c2330f" : "#12171d") })),
      },
      prox, qual, qualAberto: menu === "qual", qualItens, qualPrincipal,
      registrar, rel, semAtvs: !filtradas.length, setResp, sla: l.sla.map((t) => ({ ...t, valorStyle: "font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:700;overflow-wrap:anywhere;color:" + TOM_TILE[t.tom] })),
      tg, tlResumo, tlTudo,
      toggleEtapas: () => etapaMovivel && setMenu(menu === "etapas" ? null : "etapas"),
      toggleMais: () => setMenu(menu === "mais" ? null : "mais"),
      toggleNova: () => setMenu(menu === "nova" ? null : "nova"),
      toggleQual: () => setMenu(menu === "qual" ? null : "qual"),
      voltar: acoes.voltar,
    };
  }, [l, acoes, aba, menu, atvF, nota, notaAtiva, ocupado, rascunho, qualErro, salvando]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!vals) {
    return <LeadDesenho {...(semLead(acoes.voltar) as React.ComponentProps<typeof LeadDesenho>)} />;
  }
  return <LeadDesenho {...(vals as unknown as React.ComponentProps<typeof LeadDesenho>)} />;
}

/** Sem lead (id que não existe): a tela diz isso em vez de quebrar. */
function semLead(voltar: () => void) {
  return { temL: false, semL: true, voltar, menuAberto: false, fecharMenus: () => {} };
}
