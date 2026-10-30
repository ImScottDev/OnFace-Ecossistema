// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";
import { perguntarAoNexo, conversasRecentes, mensagensDaConversa as mensagensDaConversaNexo, novaConversaId, botoesDaResposta, confirmarAcaoDoNexo } from "@/lib/nexo/cliente";

/* ─────────────────────────────────────────────────────────────────────────
 * Atividades — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * AtividadesDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `AtividadesDesenho.tsx`, convertido por máquina e intocável.
 * Aqui ficam as mesmas contas do protótipo — filtros, estilos calculados,
 * estados — com três trocas: o aviso vira toast, a navegação vira rota real e
 * os dados de exemplo dão lugar às props.
 *
 * ── Por que `@ts-nocheck` ─────────────────────────────────────────────
 *
 * O protótipo é JavaScript sem anotação de tipo, e sob `strict` cada
 * parâmetro dele vira um erro. Anotar um por um significa reescrever o arquivo
 * à mão — exatamente a transcrição que este caminho existe para eliminar.
 * A fronteira continua tipada: `Props` abaixo e o contrato de valores no
 * markup. O miolo é apresentação; se estiver errado, a tela mostra.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { avatarDe } from "./avatar-do-proto";
import { abrirUrlExterna } from "@/lib/callface-ligar";
import { toast } from "sonner";

import { AtividadesDesenho } from "./AtividadesDesenho";
import { UsuarioDoProtoContexto } from "./usuario-do-proto";

interface Props {
  /** O que o protótipo lia do store. Preencher com dado real. */
  dados?: Record<string, any>;
  ir: (href: string) => void;
  abrir?: (peca: string, id?: string | null) => void;
  abrirExterno?: (url: string) => void;
  children?: React.ReactNode;
  /* Cada tela recebe as suas: a Casca quer rota e titulo, Pre-vendas quer
     falar. Nomear todas aqui obrigaria a editar o arquivo gerado a cada
     regeracao, e arquivo gerado nao se edita. As props que a ligacao de fato
     usa ficam tipadas no adaptador, que e escrito a mao. */
  [extra: string]: any;
}


class Logica extends React.Component<any, any> {
  /**
   * O store do protótipo, ligado ao produto.
   *
   * `assinar`/`gravar` não fazem nada: no protótipo o estado atravessava
   * páginas pelo localStorage; aqui o servidor é a verdade e a página relê
   * sozinha. O que atravessa de verdade — aviso, navegação e as peças —
   * chega nas props.
   */
  /**
   * O catálogo do domínio, no lugar do catálogo estático do protótipo.
   *
   * O nome NAO e "catalogo": a tela de Proposta ja tem um metodo catalogo()
   * — o catalogo comercial dela — e um getter com o mesmo nome o sobrescreve.
   * A colisao nao da erro de tipo: da "catalogo is not a function" em runtime,
   * no meio do Builder.
   */
  get dadosDoProto(): any {
    return this.props.catalogo ?? {};
  }

  /**
   * Quem está usando — no protótipo, o Scott fixo como autor de nota,
   * evento e atividade. Vem do contexto que a casca fornece com a sessão;
   * `props.usuario` ganha quando o adaptador quer forçar.
   */
  static contextType = UsuarioDoProtoContexto;
  get eu(): string {
    return this.props.usuario?.nome ?? (this.context as any)?.nome ?? "Você";
  }

  E = {
    tudo: () => this.props.dados ?? {},
    ler: (k: string, alt?: any) => (this.props.dados as any)?.[k] ?? alt,
    /* O store do protótipo gravava no localStorage. Aqui ele CHAMA A TELA:
       quem sabe traduzir o patch em command é o adaptador, escrito à mão.
       Engolir a chamada — como esta linha fazia — é o que mantinha
       Pré-vendas parecendo que gravava sem gravar nada. */
    gravar: (patch: any) => this.props.gravar?.(patch),
    assinar: () => null,
    assinarPecas: () => null,
    assinarAviso: () => null,
    avisar: (texto: string, tom?: string) => this.diz(texto, tom),
    abrir: (peca: string, id?: string | null) => this.props.abrir?.(peca, id),
    abrirExterno: (url: string) => abrirUrlExterna(url, this.props.abrirExterno),
    /* A PROP, e nao o metodo ir() da classe.
     *
     * As telas do handoff definem ir(href, label) chamando E.irPara(...).
     * Apontar irPara de volta para this.ir fecha o ciclo ir -> irPara -> ir,
     * e o clique morre com "Maximum call stack size exceeded" — foi o que
     * deixou o sidebar inteiro sem navegar. */
    irPara: (href: string) => this.props.ir?.(href),
    parametro: (nome: string) =>
      typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(nome),
  };

  state = { larg: typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1400, v: 0, escopo: "minhas", busca: "", visao: "geral", comentario: "", nexoPlano: false, agrupar: "prazo", sel: { rap: [], tipo: [], area: [], prio: [], emp: [] }, rapido: null, filtroAberto: null, filtroRect: null, fechados: {}, declinadas: false, aberta: null, ed: null, novaSub: "" };

  constructor(props: any) {
    super(props);
    const d: any = props.dados ?? {};
    for (const k of Object.keys(this.state ?? {})) {
      if ((this.state as any)[k] === null && d[k] != null) {
        (this.state as any) = { ...(this.state as any), [k]: d[k] };
      }
    }
  }

  componentDidMount() {
    const E = this.E;
    if (E) this._off = E.assinar(() => this.setState(s => ({ v: s.v + 1 })));
    this._rs = () => this.setState({ larg: (typeof window !== "undefined" ? window.innerWidth : 1440) }); window.addEventListener("resize", this._rs);
    this._fora = (e) => { if ((this.state.filtroAberto || this.state.pjMenu) && !(e.target.closest && e.target.closest("[data-at-filtro]"))) this.setState({ filtroAberto: null, pjMenu: null }); };
    this._esc = (e) => { if (e.key === "Escape") this.setState(s => s.nexoChat ? { nexoChat: null } : s.kpiPop ? { kpiPop: null } : s.pj ? { pj: null } : s.ed ? { ed: null } : s.aberta ? { aberta: null } : { filtroAberto: null, pjMenu: null }); };
    document.addEventListener("mousedown", this._fora); document.addEventListener("keydown", this._esc);
    const pAtv = E && E.parametro && E.parametro("atv"), pNova = E && E.parametro && E.parametro("nova");
    const pPrj = E && E.parametro && E.parametro("projeto"); if (pPrj) this.setState({ visao: "quadro", projeto: pPrj }); if (pAtv) this.setState({ aberta: pAtv }); else if (pNova) setTimeout(() => { const lid = E.parametro("lead"), L = lid ? ((E.ler("leads", null) || (this.dadosDoProto || {}).LEADS || []).find(l => l.id === lid)) : null, emp = E.parametro("empresa"), pes = E.parametro("pessoa"); this.abrirEditor(null, Object.assign({ fimD: E.parametro("data") || this.fmtIso(this.hoje()) }, pNova !== "1" ? { titulo: pNova } : {}, L && L.pessoa ? { vincTipo: "pessoa", vinc: L.pessoa } : pes ? { vincTipo: "pessoa", vinc: pes } : (L && L.empresa) || emp ? { vincTipo: "empresa", vinc: (L && L.empresa) || emp } : {})); }, 60);
  }
  componentWillUnmount() { if (this._off) this._off(); window.removeEventListener("resize", this._rs); document.removeEventListener("mousedown", this._fora); document.removeEventListener("keydown", this._esc); }

  hoje() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  rel(s) { if (!s) return null; const m = String(s).match(/^([+-]\d+)(?:\s+(\d{1,2}):(\d{2}))?$/); if (!m) return null; const d = this.hoje(); d.setDate(d.getDate() + (+m[1])); if (m[2]) d.setHours(+m[2], +m[3]); else d.setHours(23, 59); d._h = !!m[2]; return d; }
  parseQuando(q) {
    const t = String(q || "").toLowerCase().trim(); if (!t) return null;
    const hm = t.match(/(\d{1,2})[:h](\d{2})?/); const h = hm ? +hm[1] : null, mi = hm && hm[2] ? +hm[2] : 0;
    let d = null;
    const dm = t.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))?/);
    if (dm) d = new Date(dm[3] ? +dm[3] : new Date().getFullYear(), +dm[2] - 1, +dm[1]);
    else if (t.indexOf("hoje") >= 0) d = this.hoje();
    else if (t.indexOf("amanhã") >= 0 || t.indexOf("amanha") >= 0) { d = this.hoje(); d.setDate(d.getDate() + 1); }
    else if (t.indexOf("ontem") >= 0) { d = this.hoje(); d.setDate(d.getDate() - 1); }
    else { const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]; const i = dias.findIndex(x => t.indexOf(x) === 0); if (i >= 0) { d = this.hoje(); let dif = (i - d.getDay() + 7) % 7; d.setDate(d.getDate() + dif); } else { const em = t.match(/em (\d+) dias?/); if (em) { d = this.hoje(); d.setDate(d.getDate() + +em[1]); } } }
    if (!d) return null;
    if (h != null && (dm || hm)) { d.setHours(h, mi); d._h = true; } else d.setHours(23, 59);
    return d;
  }
  fmtIso(d) { return d ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") : ""; }
  fmtH(d) { return d && d._h ? String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : ""; }

  proprias() { const E = this.E; const s = E && E.ler("atividadesV2", null); const l = s || (this.dadosDoProto.AtividadesSeed || []); const pj = this.dadosDoProto.ProjetosSeed || []; return l; }
  gravarProprias(lista) { const E = this.E; if (E) E.gravar({ atividadesV2: lista }); }

  todas() {
    const E = this.E, D = this.dadosDoProto || {};
    const out = [];
    this.proprias().forEach((a, i) => { const ini = a.iniD ? this.deIso(a.iniD, a.iniH) : this.rel(a.inicio), fim = a.fimD ? this.deIso(a.fimD, a.fimH) : this.rel(a.fim);
      out.push(Object.assign({}, a, { key: "p:" + a.id, src: "p", idx: i, ini, fim, sub: (a.sub || []).map(s => Object.assign({}, s, { fimX: s.fimD ? this.deIso(s.fimD) : this.rel(s.fim) })), assignees: a.assignees || (a.resp ? [a.resp] : []), comentarios: a.comentarios || [] })); });
    const opps = (E && E.ler("opps", null)) || D.OPORTUNIDADES || [];
    const FAM = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
    opps.forEach(o => (o.atvs || []).forEach((a, i) => { const fim = a.fimD ? this.deIso(a.fimD, a.fimH) : this.parseQuando(a.quando); const ini = a.iniD ? this.deIso(a.iniD, a.iniH) : null;
      out.push({ key: "o:" + o.id + ":" + i, src: "o", oppId: o.id, idx: i, titulo: a.titulo || "Atividade", desc: a.desc || "", tipo: a.tipo || "Tarefa", situacao: a.situacao || (a.feita ? "Feita" : "A fazer"), prioridade: a.prioridade || (a.auto ? "Alta" : "Média"),
        resp: a.autor || o.resp, area: o.etapa === "ganho" ? "Onboarding" : "Comercial", ini, fim, empresa: o.empresa, pessoa: o.pessoa, oppRot: (FAM[o.familia] || "") + " · " + o.empresa, sub: a.sub || [], reuniao: a.reuniao }); }));
    const leads = (E && E.ler("leads", null)) || D.LEADS || [];
    leads.filter(l => l.acao && ["nutricao", "desqualificado", "oportunidade"].indexOf(l.etapa) < 0).forEach(l => {
      const fim = this.parseQuando(l.venceEm) || null;
      out.push({ key: "l:" + l.id, src: "l", leadId: l.id, titulo: l.acao, desc: "", tipo: /lig/i.test(l.acao) ? "Ligação" : /e-?mail/i.test(l.acao) ? "E-mail" : /reuni/i.test(l.acao) ? "Reunião" : /whats|mensag/i.test(l.acao) ? "Mensagem" : "Follow up",
        situacao: "A fazer", prioridade: l.venceEm === "hoje" ? "Alta" : "Média", resp: l.resp, area: "SDR", ini: null, fim, empresa: l.empresa, pessoa: l.pessoa, sub: [], leadEtapa: l.etapa }); });
    return out;
  }
  deIso(d, h) { if (!d) return null; const [a, m, dd] = d.split("-").map(Number); const x = new Date(a, m - 1, dd); if (h) { const [hh, mi] = h.split(":").map(Number); x.setHours(hh, mi); x._h = true; } else x.setHours(23, 59); return x; }

  salvarItem(it, patch, msg) {
    const E = this.E; if (!E) return;
    if (patch.sub) patch = Object.assign({}, patch, { sub: patch.sub.map(s => { const c = Object.assign({}, s); delete c.fimX; return c; }) });
    if (it.src === "p") { const l = this.proprias().slice(); const cur = l[it.idx] || {};
      if (msg && !patch.log && !patch.comentarios) { const d = new Date(); patch = Object.assign({}, patch, { log: (cur.log || []).concat([{ autor: this.eu, texto: msg.replace(/^./, c => c.toLowerCase()), quando: "Hoje, " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") }]) }); }
      l[it.idx] = Object.assign({}, cur, patch); this.gravarProprias(l); }
    else if (it.src === "o") { const opps = (E.ler("opps", null) || (this.dadosDoProto || {}).OPORTUNIDADES || []).slice(); const i = opps.findIndex(o => o.id === it.oppId); if (i < 0) return;
      const atvs = (opps[i].atvs || []).slice(); const p2 = Object.assign({}, patch); if (p2.situacao) p2.feita = p2.situacao === "Feita" || p2.situacao === "Declinada"; if (p2.resp) { p2.autor = p2.resp; delete p2.resp; }
      if (p2.fimD !== undefined) p2.quando = p2.fimD ? p2.fimD.split("-").reverse().slice(0, 2).join("/") + (p2.fimH ? " · " + p2.fimH : "") : "Sem data";
      atvs[it.idx] = Object.assign({}, atvs[it.idx], p2); opps[i] = Object.assign({}, opps[i], { atvs, eventos: msg ? [{ t: msg, quando: "Hoje", autor: this.eu }].concat(opps[i].eventos || []) : opps[i].eventos }); E.gravar({ opps }); }
    else if (it.src === "l") { if (patch.situacao === "Feita" || patch.situacao === "Declinada") { const leads = (E.ler("leads", null) || (this.dadosDoProto || {}).LEADS || []).map(l => l.id === it.leadId ? Object.assign({}, l, { acao: null, venceEm: null }) : l); E.gravar({ leads }); } }
    if (msg) E.avisar(msg, "ok");
  }

  renderVals() {
    const S = this.state, E = this.E, D = this.dadosDoProto || {};
    const ini = (n, ia) => avatarDe(n, (D.iniciais || ((n) => (n || "").split(" ").map(x => [...x][0]).slice(0, 2).join("").toUpperCase()))(n), ia);
    const EU = this.eu, equipe = (D.EQUIPE || [] /* ANTES: sem equipe real, listava Camila Reis / Diego Nunes / Ana Vitória como colegas. Nomes inventados. */).concat([EU]).filter((x, i, a) => a.indexOf(x) === i);
    const H0 = this.hoje(), H1 = new Date(H0.getTime() + 864e5), H2 = new Date(H0.getTime() + 2 * 864e5), agora = new Date();
    const fimSem = new Date(H0); fimSem.setDate(fimSem.getDate() + (7 - fimSem.getDay()) % 7 + 1);
    const TIPOS = { "Ligação": ["M13.8 16.6a1 1 0 0 0 1.2-.3l.4-.5A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.4z", "#1f7256", "#e6f4ee"],
      "Mensagem": ["M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", "#1f7256", "#e6f4ee"], "E-mail": ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6", "#2c5f9e", "#e8f0fb"],
      "Follow up": ["M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5", "#c2330f", "#fff6f4"], "Reunião": ["M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "#c2330f", "#fff6f4"],
      "Proposta": ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", "#4f3fa8", "#efecfa"], "Tarefa": ["M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", "#4a5560", "#eeeff3"] };
    const criados = ((E && E.ler("tiposAtv", [])) || []);
    criados.forEach(n => { if (!TIPOS[n]) TIPOS[n] = ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v8M8 12h8", "#6e5420", "#f7edd8"]; });
    const tipoDe = (t) => TIPOS[t] || TIPOS.Tarefa;
    const SIT = [["A fazer", "A fazer", "M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "#4a5560", "#eeeff3"], ["Em andamento", "Em andamento", "M21 12a9 9 0 1 1-6.2-8.6", "#2c5f9e", "#e8f0fb"], ["Aguardando", "Aguardando", "M10 15V9M14 15V9M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "#6e5420", "#f7edd8"], ["Feita", "Feito", "M20 6 9 17l-5-5", "#1f7256", "#e6f4ee"], ["Declinada", "Declinada", "M18 6 6 18M6 6l12 12", "#c2330f", "#fdeeea"]];
    const sitDe = (s) => SIT.find(x => x[0] === s) || SIT[0];
    const PRIO = { Alta: "#d93c1a", "Média": "#c9a45c", Baixa: "#8b949e" };
    const AREAS = ["Comercial", "SDR", "CS", "Onboarding", "Implantação", "Suporte"];
    const aberta2 = (x) => x.situacao !== "Feita" && x.situacao !== "Declinada";
    const atrasada = (x) => aberta2(x) && x.fim && x.fim < agora;

    const todasR = this.todas(), projs = todasR.filter(x => x.projeto), todas = todasR.filter(x => !x.projeto);
    const q = S.busca.trim().toLowerCase(), F = S.sel;
    const noEscopo = (x) => S.escopo === "minhas" ? ((x.assignees && x.assignees.length) ? x.assignees.indexOf(EU) >= 0 : x.resp === EU) : S.escopo === "equipe" ? !!x.resp || !!x.fila : true;
    const passa = (x) => noEscopo(x) && (!q || [x.titulo, x.empresa, x.pessoa, x.desc].join(" ").toLowerCase().indexOf(q) >= 0)
      && (!S.projeto || S.visao === "geral" || x.projetoId === S.projeto) && (!F.tipo.length || F.tipo.indexOf(x.tipo) >= 0) && (!F.area.length || F.area.indexOf(x.area) >= 0) && (!F.prio.length || F.prio.indexOf(x.prioridade) >= 0) && (!F.emp.length || F.emp.indexOf(x.empresa || "—") >= 0);
    const RAP = { atrasadas: atrasada, hoje: (x) => aberta2(x) && x.fim && x.fim >= H0 && x.fim < H1, semResp: (x) => aberta2(x) && !x.resp, aguardando: (x) => x.situacao === "Aguardando" };
    const base = todas.filter(passa);
    const FR = F.rap || [], vis0 = S.rapido ? base.filter(RAP[S.rapido]) : base, vis = FR.length ? vis0.filter(x => FR.some(k => RAP[k](x))) : vis0;

    const prazoTxt = (x) => { if (!x.fim) return "Sem data"; const d = x.fim, h = this.fmtH(d);
      if (d < H0) { const n = Math.round((H0 - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return (n <= 1 ? "Ontem" : "Há " + n + " dias") + (h ? ", " + h : ""); }
      if (d < H1) return "Hoje" + (h ? ", " + h : ""); if (d < H2) return "Amanhã" + (h ? ", " + h : "");
      return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") + (h ? ", " + h : ""); };
    const card = (x) => { const T = tipoDe(x.tipo), sx = sitDe(x.situacao), subF = x.sub.filter(s => s.feita).length, subN = x.sub.length, late = atrasada(x), on = S.aberta === x.key;
      const RC = { "Camila Reis": ["#fff6f4", "#c2330f"], "Diego Nunes": ["#e8f0fb", "#2c5f9e"], "Ana Vitória": ["#efecfa", "#4f3fa8"], [this.eu]: ["#12171d", "#fff"] }[x.resp] || ["#eeeff3", "#67787c"];
      const nComsX = (x.comentarios || []).length;
      return { key: x.key, titulo: x.titulo, tipo: x.tipo, tipoD: T[0],
        tipoK: "display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:500;white-space:nowrap;color:" + T[1],
        temAlta: x.prioridade === "Alta", vincK: [x.empresa, x.pessoa].filter(Boolean).join(" · "), temComs: nComsX > 0, nComs: String(nComsX),
        deOutro: !!x.resp && x.resp !== EU,
        prazoK: "display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums;" + (late ? "background:#fdeeea;color:#c2330f" : x.fim && x.fim < H1 && aberta2(x) ? "background:#12171d;color:#fff" : "background:#f3f4f4;color:#4a5560"),
        tipoStyle: "display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:500;white-space:nowrap;background:" + T[2] + ";color:" + T[1],
        temPrio: x.prioridade === "Alta" || x.prioridade === "Baixa", prioDica: "Prioridade " + (x.prioridade || "").toLowerCase(), prioStyle: "display:inline-flex;color:" + (PRIO[x.prioridade] || "#8b949e"),
        prazo: prazoTxt(x), prazoStyle: "font-size:11.5px;font-weight:500;white-space:nowrap;color:" + (late ? "#c2330f" : x.fim && x.fim < H1 && aberta2(x) ? "#12171d" : "#8b949e"),
        temVinc: !!(x.empresa || x.pessoa), vinc: [x.empresa, x.pessoa].filter(Boolean).join(" · ") + (x.oppRot ? " · oportunidade" : x.leadId ? " · lead" : ""),
        temSub: subN > 0, subTxt: subF + "/" + subN, subBarra: "display:block;height:100%;border-radius:9999px;width:" + Math.round(subF / Math.max(1, subN) * 100) + "%;background:" + (subF === subN ? "#1f7256" : "#fe4f2b") + ";transition:width .5s cubic-bezier(.16,1,.3,1)",
        resp: x.fila && !(x.assignees || []).length ? "Fila de " + x.fila : (x.resp || "Sem responsável") + ((x.assignees || []).length > 1 ? " +" + (x.assignees.length - 1) : ""), respIni: x.resp ? ini(x.resp) : "?", respAv: "flex:0 0 auto;width:24px;height:24px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:500;background:" + RC[0] + ";color:" + RC[1],
        area: x.area || "", areaStyle: "flex:0 0 auto;font-size:11px;font-weight:500;color:#8b949e;white-space:nowrap",
        sitDot: "width:10px;height:10px;border-radius:9999px;justify-self:center;box-shadow:inset 0 0 0 2.5px " + sx[3] + (x.situacao === "Em andamento" ? ";background:" + sx[4] : ""),
        sit: sx[1], sitStyle: "justify-self:start;display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:500;white-space:nowrap;background:" + sx[4] + ";color:" + sx[3],
        feita: x.situacao === "Feita", checkDica: x.situacao === "Feita" ? "Reabrir" : "Marcar como feito",
        check: "width:18px;height:18px;border-radius:6px;display:grid;place-items:center;cursor:pointer;" + (x.situacao === "Feita" ? "background:#1f7256" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4"),
        concluir: (e) => { e.stopPropagation(); const nv = x.situacao === "Feita" ? "A fazer" : "Feita"; this.salvarItem(x, { situacao: nv, concluidaEm: nv === "Feita" ? "+0 " + this.fmtH(Object.assign(new Date(), { _h: true })) : null }, nv === "Feita" ? "Feito: " + x.titulo : "Reaberta: " + x.titulo); },
        prioTxt: x.prioridade || "Média", prioPill: "flex:0 0 auto;height:22px;padding:0 8px;border-radius:6px;display:inline-flex;align-items:center;font-size:11.5px;font-weight:500;white-space:nowrap;" + ({ Alta: "background:#fdeeea;color:#c2330f", "Média": "background:#f7edd8;color:#6e5420", Baixa: "background:#e8f0fb;color:#2c5f9e" }[x.prioridade] || "background:#eeeff3;color:#4a5560"),
        tituloStyle: "font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (x.situacao === "Feita" ? "#8b949e;text-decoration:line-through" : "#12171d"),
        abrir: () => this.setState({ aberta: x.key, novaSub: "", subAberta: null }),
        style: "display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:12px;border-radius:12px;border:0;cursor:pointer;background:#fff;box-shadow:" + (on ? "0 0 0 1.5px #d93c1a" : late ? "0 0 0 1px #f6d3c9" : "0 0 0 1px #e3e7e8") + ",0 1px 2px rgba(18,23,29,.04);transition:transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s ease",
        hover: "transform:translateY(-2px);box-shadow:0 0 0 1px #d0d5d6,0 10px 22px -14px rgba(18,23,29,.35)" }; };

    // quadro
    const COLS = SIT.filter(s => s[0] !== "Declinada" || S.declinadas);
    const ordena = (a2) => a2.slice().sort((a, b) => (atrasada(b) ? 1 : 0) - (atrasada(a) ? 1 : 0) || (a.fim ? a.fim.getTime() : 9e15) - (b.fim ? b.fim.getTime() : 9e15));
    const colunas = COLS.map(([k, l, d, c, bg]) => { let lst = vis.filter(x => x.situacao === k); if (k === "Feita") lst = lst.slice(-12);
      return { l: k === "Feita" ? "Concluídas" : l, n: String(lst.length), d, ico: "width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;background:" + bg + ";color:" + c,
        vazia: !lst.length, vazioTxt: k === "Aguardando" ? "Nada esperando retorno de alguém" : k === "Feita" ? "Nada concluído ainda" : "Nenhuma atividade aqui",
        box: "flex:0 0 292px;min-width:0;display:flex;flex-direction:column;min-height:0;border-radius:14px;padding:8px;transition:background-color .15s ease,box-shadow .15s ease;" + (S.sobreCol === k && S.arrastando ? "background:#fff6f4;box-shadow:inset 0 0 0 2px #fe4f2b" : "background:#eeeff3"),
        sobre: (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; if (this.state.sobreCol !== k) this.setState({ sobreCol: k }); },
        sair: (e) => { if (e.currentTarget.contains(e.relatedTarget)) return; if (this.state.sobreCol === k) this.setState({ sobreCol: null }); },
        soltar: (e) => { e.preventDefault(); const key = (e.dataTransfer && e.dataTransfer.getData("text/plain")) || this._drag; const X = todas.find(y => y.key === key); this._drag = null; this.setState({ arrastando: null, sobreCol: null });
          if (!X || X.situacao === k) return; if (X.src === "l" && k !== "Feita" && k !== "Declinada") return E && E.avisar("Próxima ação de lead só pode ser concluída ou declinada. Abra o lead para mudar a etapa.", "aviso");
          this.salvarItem(X, { situacao: k }, "“" + X.titulo + "” → " + (k === "Feita" ? "Concluída" : l)); },
        cards: ordena(lst).map(x => { const c = card(x), ar = S.arrastando === x.key; return Object.assign(c, { style: c.style + (ar ? ";opacity:.4;transform:scale(.98)" : "") + ";cursor:grab",
          arrastar: (e) => { try { e.dataTransfer.setData("text/plain", x.key); e.dataTransfer.effectAllowed = "move"; } catch (er) {} this._drag = x.key; setTimeout(() => this.setState({ arrastando: x.key }), 0); },
          fimArraste: () => { this._drag = null; this.setState({ arrastando: null, sobreCol: null }); } }); }), nova: () => this.abrirEditor(null, S.projeto ? { situacao: k, projetoId: S.projeto } : { situacao: k }) }; });
    // lista
    const GR = S.agrupar;
    const chaveG = (x) => GR === "empresa" ? (x.empresa || "Sem empresa") : GR === "tipo" ? (x.tipo || "Tarefa") : GR === "resp" ? (x.resp || "Sem responsável") : GR === "area" ? (x.area || "Sem área")
      : !aberta2(x) ? "zConcluídas" : !x.fim ? "fSem data" : x.fim < agora ? "aAtrasadas" : x.fim < H1 ? "bHoje" : x.fim < H2 ? "cAmanhã" : x.fim < fimSem ? "dEsta semana" : "eDepois";
    const DOTG = { aAtrasadas: "#d93c1a", bHoje: "#fe4f2b", cAmanhã: "#c9a45c", "dEsta semana": "#2c5f9e", eDepois: "#8b949e", "fSem data": "#c4c9ca", zConcluídas: "#1f7256" };
    const mapG = {}; vis.forEach(x => { const k = chaveG(x); (mapG[k] = mapG[k] || []).push(x); });
    const grupos = Object.keys(mapG).sort().map(k => { const itens = ordena(mapG[k]), ab = !S.fechados[k]; const lbl = GR === "prazo" ? k.slice(1) : k;
      const nOpp = itens.filter(x => x.oppRot).length, nLead = itens.filter(x => x.leadId).length, nPes = itens.filter(x => x.pessoa).length;
      return { l: lbl === "Sem data" ? "Sem data · backlog" : lbl, n: String(itens.length), aberto: ab,
        sub: GR === "empresa" ? [nOpp ? nOpp + " de oportunidade" : null, nLead ? nLead + " de lead" : null, nPes ? nPes + " com pessoa" : null].filter(Boolean).join(" · ") : itens.filter(atrasada).length ? itens.filter(atrasada).length + " atrasadas" : "",
        dot: "width:8px;height:8px;border-radius:3px;background:" + (DOTG[k] || "#8b949e"), chev: "flex:0 0 auto;transition:transform .15s;transform:rotate(" + (ab ? 0 : -90) + "deg)",
        alternar: () => this.setState(s => ({ fechados: Object.assign({}, s.fechados, { [k]: ab }) })), itens: itens.map(card) }; });

    // filtros
    const empresasTodas = todas.map(x => x.empresa || "—").filter((v, i, a) => a.indexOf(v) === i).sort();
    const defs = [
      { k: "rap", label: "Prazo", titulo: "PRAZO E SITUAÇÃO", icone: "M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", opcoes: [["atrasadas", "Atrasadas"], ["hoje", "Vencem hoje"], ["semResp", "Sem responsável"], ["aguardando", "Aguardando retorno"]] },
      { k: "tipo", label: "Tipo", titulo: "TIPO", icone: "M4 6h16M4 12h16M4 18h10", opcoes: Object.keys(TIPOS).map(t => [t, t]) },
      { k: "prio", label: "Prioridade", titulo: "PRIORIDADE", icone: "M5 21V4h11l-2 4 2 4H7", opcoes: [["Alta", "Alta"], ["Média", "Média"], ["Baixa", "Baixa"]] }
    ];
    const campo = { tipo: x => x.tipo, area: x => x.area, prio: x => x.prioridade, emp: x => x.empresa || "—" };
    const filtros = defs.map(f => { const sel = F[f.k] || [], ativo = sel.length > 0, aberto = S.filtroAberto === f.k;
      return { label: f.label, icone: f.icone, aberto, temSel: ativo, conta: String(sel.length), titulo: f.titulo,
        grupo: "display:flex;align-items:stretch;height:34px;border-radius:9px;overflow:hidden;background:" + (ativo ? "#d93c1a" : "#fff") + ";box-shadow:inset 0 0 0 1px " + (ativo ? "#c2330f" : aberto ? "#b8bfc0" : "#dbdede"),
        corpo: "display:flex;align-items:center;gap:7px;padding:0 11px;font-size:13px;font-weight:" + (ativo ? "600" : "500") + ";white-space:nowrap;color:" + (ativo ? "#fff" : "#1f252c") + ";background:transparent;border:0;cursor:pointer",
        seta: "display:grid;place-items:center;width:28px;padding:0;color:" + (ativo ? "#fff" : "#4a5560") + ";background:transparent;border:0;cursor:pointer",
        hover: ativo ? "background:rgba(255,255,255,.12)" : "background:#f6f7f7", div: "flex:0 0 auto;width:1px;background:" + (ativo ? "rgba(255,255,255,.34)" : "#e3e7e8"),
        contaStyle: "min-width:17px;height:17px;padding-inline:4px;border-radius:9999px;font-size:10px;font-weight:500;display:grid;place-items:center;background:rgba(255,255,255,.22);color:#fff",
        abrir: (e) => { const el = e.currentTarget.closest("[data-at-filtro]"); const r = el ? el.getBoundingClientRect() : null; this.setState(s => ({ filtroAberto: s.filtroAberto === f.k ? null : f.k, filtroRect: r ? { top: r.top, bottom: r.bottom, left: r.left } : null })); },
        limpar: () => this.setState(s => ({ sel: Object.assign({}, s.sel, { [f.k]: [] }), filtroAberto: null })),
        opcoes: f.opcoes.map(([v, l]) => { const on = sel.indexOf(v) >= 0; return { label: l, on, n: String(f.k === "rap" ? base.filter(RAP[v]).length : todas.filter(x => noEscopo(x) && campo[f.k](x) === v && aberta2(x)).length),
          caixa: "flex:0 0 auto;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4"),
          onClick: () => this.setState(s => ({ sel: Object.assign({}, s.sel, { [f.k]: on ? sel.filter(x => x !== v) : sel.concat(v) }) })) }; }) }; });
    const fAb = filtros.find(x => x.aberto);
    const fd2 = !fAb ? { aberto: false, opcoes: [] } : (() => { const r = S.filtroRect || { top: 100, bottom: 134, left: 20 }, vh = (typeof window !== "undefined" ? window.innerHeight : 900), vw = (typeof window !== "undefined" ? window.innerWidth : 1440); const abaixo = vh - r.bottom - 12, acima = r.top - 12, cima = abaixo < 240 && acima > abaixo;
      return Object.assign({}, fAb, { pos: "position:fixed;z-index:70;min-width:230px;left:" + Math.max(8, Math.min(vw - 260, r.left)) + "px;" + (cima ? "bottom:" + (vh - r.top + 5) : "top:" + (r.bottom + 5)) + "px;max-height:" + Math.max(160, Math.min(380, cima ? acima : abaixo)) + "px;overflow-y:auto;border-radius:10px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 10px 26px -6px rgba(0,0,0,.2);padding:5px" }); })();

    // lateral
    const semIni = new Date(H0); semIni.setDate(semIni.getDate() - ((semIni.getDay() + 6) % 7));
    const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const noDia = (x, d) => x.fim && x.fim >= d && x.fim < new Date(d.getTime() + 864e5);
    const conc = (x) => x.situacao === "Feita";
    const diasSem = DIAS.map((l, i) => { const d = new Date(semIni.getTime() + i * 864e5); const lst = base.filter(x => noDia(x, d)); return { l, d, ab: lst.filter(aberta2).length, fe: lst.filter(conc).length }; });
    const maxD = Math.max(1, Math.max.apply(null, diasSem.map(x => x.ab + x.fe)));
    const abertasBase = base.filter(aberta2);
    const porTipo = Object.keys(TIPOS).map(t => [t, abertasBase.filter(x => x.tipo === t).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    const totT = Math.max(1, abertasBase.length);
    const sem = { periodo: semIni.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " – " + new Date(semIni.getTime() + 6 * 864e5).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      kpis: [[String(abertasBase.length), "em aberto", "#fff"], [String(diasSem.reduce((a, x) => a + x.fe, 0)), "feitas na semana", "#3ecf8e"], [String(base.filter(atrasada).length), "atrasadas", "#ff8a70"]].map(([v, l, c]) => ({ v, l, vStyle: "display:block;font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;font-weight:800;letter-spacing:-.03em;line-height:1;color:" + c })),
      dias: diasSem.map(x => { const hj = x.d.getTime() === H0.getTime(); return { l: x.l, dica: x.l + ": " + x.ab + " em aberto, " + x.fe + " feitas",
        feitas: "display:block;width:100%;height:" + (x.fe / maxD * 100) + "%;background:#3ecf8e;transition:height .6s cubic-bezier(.16,1,.3,1)", abertas: "display:block;width:100%;height:" + (x.ab / maxD * 100) + "%;background:#fe4f2b;transition:height .6s cubic-bezier(.16,1,.3,1)",
        lblStyle: "font-size:10.5px;font-weight:" + (hj ? "700;color:#fff" : "500;color:#67787c") }; }),
      tipos: porTipo.map(([t, n]) => ({ l: t, n: String(n), dica: t + ": " + n, dot: "width:8px;height:8px;border-radius:2px;background:" + tipoDe(t)[1], style: "flex:" + (n / totT) + " 0 0;background:" + tipoDe(t)[1] })) };
    const agendaLst = base.filter(x => aberta2(x) && noDia(x, H0) && x.fim._h).sort((a, b) => a.fim - b.fim);
    const agenda = agendaLst.map(x => { const T = tipoDe(x.tipo), passou = x.fim < agora; return { hora: this.fmtH(x.fim), t: x.titulo, s: [x.empresa, x.resp].filter(Boolean).join(" · "), d: T[0], abrir: () => this.setState({ aberta: x.key }),
      horaStyle: "flex:0 0 auto;width:42px;font-size:12.5px;font-weight:500;font-variant-numeric:tabular-nums;color:" + (passou ? "#c2330f" : "#12171d"),
      ico: "flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:" + T[2] + ";color:" + T[1],
      style: "display:flex;align-items:center;gap:10px;width:100%;padding:8px 6px;border:0;border-radius:10px;background:transparent;cursor:pointer;" + (passou ? "box-shadow:inset 2px 0 0 #fe4f2b" : "") }; });
    const opps = (E && E.ler("opps", null)) || D.OPORTUNIDADES || [];
    const feedRaw = [];
    opps.forEach(o => (o.notas || []).forEach(n => { if ((n.texto || "").indexOf("@" + EU) >= 0 || n.sistema) feedRaw.push({ quem: n.sistema ? "Sistema" : n.autor, acao: n.sistema ? "registrou " + (n.tag || "uma atualização").toLowerCase() : "mencionou você", onde: o.empresa + " · oportunidade", trecho: (n.texto || "").replace(/@[A-ZÀ-Ú][\wÀ-ú]+ [A-ZÀ-Ú][\wÀ-ú]+/g, "").trim().slice(0, 140), quando: n.quando || "", ir: () => E && E.irPara("/onface-preview/oportunidade", o.empresa, { opp: o.id, ver: "" }) }); }));
    todas.filter(conc).slice(-4).forEach(x => feedRaw.push({ quem: x.resp || "Alguém", acao: "concluiu “" + x.titulo + "”", onde: [x.empresa, x.area].filter(Boolean).join(" · "), trecho: "", quando: "recente", ir: () => this.setState({ aberta: x.key }) }));
    const feed = feedRaw.slice(0, 7).map((f, i, a) => ({ quem: f.quem, acao: f.acao, onde: f.onde, temTrecho: !!f.trecho, trecho: f.trecho, quando: f.quando, abrir: f.ir, ini: f.quem === "Sistema" ? "OF" : ini(f.quem),
      av: "position:relative;z-index:1;flex:0 0 auto;width:28px;height:28px;border-radius:9999px;display:grid;place-items:center;font-size:10px;font-weight:500;" + (f.quem === "Sistema" ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#4a5560"),
      linha: i < a.length - 1 ? "position:absolute;left:17.5px;top:36px;bottom:-4px;width:1px;background:#eef1f1" : "display:none" }));

    // detalhe
    const X = S.aberta ? todas.find(x => x.key === S.aberta) : null;
    let dt = { aberto: false, sits: [], fatos: [], subs: [], vinculos: [] };
    if (X) { const T = tipoDe(X.tipo), sx = sitDe(X.situacao), subF = X.sub.filter(s => s.feita).length, subN = X.sub.length;
      const setSubs = (sub, msg) => this.salvarItem(X, { sub }, msg);
      const janela = X.ini && X.fim ? { ini: X.ini, fim: X.fim } : null;
      const asg = X.assignees && X.assignees.length ? X.assignees : (X.resp ? [X.resp] : []);
      const setAsg = (lista, msg) => this.salvarItem(X, { assignees: lista, resp: lista[0] || null }, msg);
      const av = (n, sz) => "flex:0 0 auto;width:" + (sz || 22) + "px;height:" + (sz || 22) + "px;border-radius:9999px;display:grid;place-items:center;font-size:" + ((sz || 22) < 24 ? 9 : 10) + "px;font-weight:700;" + (n === EU ? "background:#12171d;color:#fff" : n === "NEXO" ? "background:#fe4f2b;color:#fff" : n ? "background:#e3e7e8;color:#4a5560" : "background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#a3a8a4");
      /* ANTES: "NEXO" entrava na lista de pessoas/responsáveis como se fosse gente da equipe. Falso: é o assistente, não um usuário atribuível. */
      const TEAM = equipe.slice();
      const partes = (t) => { const out = []; const re = new RegExp("@(" + equipe.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g"); let last = 0, m; while ((m = re.exec(t || ""))) { if (m.index > last) out.push({ t: t.slice(last, m.index), s: "" }); out.push({ t: m[0], s: "font-weight:600;color:#c2330f;background:#fff6f4;border-radius:4px;padding:0 3px" }); last = m.index + m[0].length; } if (last < (t || "").length) out.push({ t: t.slice(last), s: "" }); return out.length ? out : [{ t: t || "", s: "" }]; };
      const coms = X.comentarios || [];
      const seguidores = X.seguidores || asg.concat(X.criadoPor && X.criadoPor !== "Sistema" && X.criadoPor !== "NEXO" ? [X.criadoPor] : []);
      const segue = seguidores.indexOf(EU) >= 0;
      const eventos = [{ ehAgente: X.criadoPorEhAgente || undefined, autor: X.criadoPor || (X.src === "o" ? X.resp : "Sistema"), texto: X.src === "o" ? "criou a atividade na oportunidade " + (X.oppRot || "") : X.src === "l" ? "próxima ação do lead no Pré-vendas" : (X.fila && !asg.length ? "enviou para a fila de " + X.fila : "criou a atividade" + (asg.length ? " para " + asg.join(", ") : "")), quando: "Criada", ev: true }];
      if (X.origem === "nexo") eventos[0] = { autor: "NEXO", texto: X.nexoMotivo || "criou esta atividade", quando: "Automático", ev: true };
      const mq = /(^|\s)@([^\s@]{0,20})$/.exec(S.comentario || "");
      const SI = S.subAberta != null && X.sub[S.subAberta] ? S.subAberta : null, SB = SI != null ? X.sub[SI] : null;
      const setSb = (p, msg) => setSubs(X.sub.map((y, j) => Object.assign({}, y, j === SI ? p : {})), msg);
      const anxL = S.comAnx || [];
      const extraDt = {
        naSub: !!SB, naMae: !SB, voltarMae: () => this.setState({ subAberta: null }), maeTxt: "Voltar para " + X.titulo, sbPos: SB ? (SI + 1) + " de " + X.sub.length : "",
        sbT: SB ? SB.t : "", sbSetT: (e) => setSb({ t: e.target.value }), sbDesc: SB ? SB.desc || "" : "", sbSetDesc: (e) => setSb({ desc: e.target.value }),
        sbDescRef: (el) => { if (!el) return; this._sbDesc = el; if (document.activeElement === el) return; const h = SB ? (SB.descHtml || String(SB.desc || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]).replace(/\n/g, "<br>")) : ""; if (el._h !== h) { el.innerHTML = h; el._h = h; } },
        sbSalvarDesc: () => { const el = this._sbDesc; if (!el || !SB) return; const h = el.innerHTML; if (h === (SB.descHtml || "")) return; el._h = h; setSb({ descHtml: h, desc: el.innerText.trim() }); },
        fmtSb: [["Negrito", "M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z", "bold"], ["Itálico", "M19 4h-9M14 20H5M15 4 9 20", "italic"], ["Sublinhado", "M6 3v7a6 6 0 0 0 12 0V3M4 21h16", "underline"], ["Lista", "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", "insertUnorderedList"], ["Lista numerada", "M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1", "insertOrderedList"], ["Link", "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7", "createLink"], ["Limpar formatação", "M4 7V4h16v3M9 20h6M12 4v16M3 3l18 18", "removeFormat"]]
          .map(([l, d, cmd]) => ({ l, d, onClick: (e) => { e.preventDefault(); const el = this._sbDesc; if (el) el.focus(); if (cmd === "createLink") { const u = window.prompt("Endereço do link", "https://"); if (!u) return; document.execCommand("createLink", false, u); } else document.execCommand(cmd, false, null); } })),
        sbResp: SB && SB.resp ? SB.resp : "Atribuir", sbRespV: SB ? SB.resp || "" : "", sbIni: SB && SB.resp ? ini(SB.resp) : "+", sbAv: av(SB && SB.resp, 24), sbSetResp: (e) => setSb({ resp: e.target.value || null }, SB ? "subtarefa “" + SB.t + "” atribuída a " + (e.target.value || "ninguém") : null),
        sbFim: SB ? (SB.fimD || this.fmtIso(SB.fimX)) : "", sbSetFim: (e) => setSb({ fimD: e.target.value, fim: null }, null),
        sbSt: SB && SB.feita ? "Feita · reabrir" : "Marcar como feita", sbStStyle: "display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:500;" + (SB && SB.feita ? "background:#1f7256;color:#fff" : "background:#e6f4ee;color:#1f7256"),
        sbTog: () => setSb({ feita: !(SB && SB.feita) }, SB ? (SB.feita ? "reabriu a subtarefa “" : "concluiu a subtarefa “") + SB.t + "”" : null),
        temAnx: anxL.length > 0, colar: (e) => { const its = Array.from((e.clipboardData && e.clipboardData.files) || []); if (!its.length) return; e.preventDefault(); its.forEach(fl => { const r = new FileReader(); r.onload = () => this.setState(s => ({ comAnx: (s.comAnx || []).concat([{ nome: fl.name || "imagem.png", url: /^image\//.test(fl.type) ? r.result : null }]) })); r.readAsDataURL(fl); }); },
        anx: anxL.map((x, i) => ({ nome: x.nome, temImg: !!x.url, thumb: "display:block;width:26px;height:26px;border-radius:5px;background:center/cover no-repeat url(" + (x.url || "") + ")", remover: () => this.setState(s => ({ comAnx: (s.comAnx || []).filter((_, j) => j !== i) })) })),
        anexar: (e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; fs.forEach(fl => { if (/^image\//.test(fl.type)) { const r = new FileReader(); r.onload = () => this.setState(s => ({ comAnx: (s.comAnx || []).concat([{ nome: fl.name, url: r.result }]) })); r.readAsDataURL(fl); } else this.setState(s => ({ comAnx: (s.comAnx || []).concat([{ nome: fl.name }]) })); }); },
        arroba: () => this.setState(s => ({ comentario: (s.comentario || "") + ((s.comentario || "").match(/\s$|^$/) ? "@" : " @") })),
        temNexo: X.origem === "nexo", nexoMotivo: X.nexoMotivo || "",
        naFila: !!X.fila && !asg.length && aberta2(X), fila: X.fila || "", criadoPor: X.criadoPor || (X.src === "o" ? X.resp : X.src === "l" ? "Pré-vendas" : "—"),
        pegar: () => setAsg([EU], "Você pegou “" + X.titulo + "” da fila de " + X.fila),
        seguirTxt: segue ? "Seguindo" : "Seguir", toggleSeguir: () => this.salvarItem(X, { seguidores: segue ? seguidores.filter(n => n !== EU) : seguidores.concat(EU) }, segue ? "Você deixou de seguir" : "Você vai receber avisos desta atividade"),
        seguirStyle: "display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:500;" + (segue ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
        assignees: asg.map(n => ({ nome: n, ini: ini(n), av: av(n, 22), remover: () => setAsg(asg.filter(x => x !== n), n + " removido da atividade") })),
        equipeOpc: [{ v: "", l: "Adicionar pessoa" }].concat(equipe.filter(n => asg.indexOf(n) < 0).map(n => ({ v: n, l: n }))),
        addResp: (e) => { const n = e.target.value; if (!n) return; setAsg(asg.concat(n), n + " adicionado à atividade"); },
        iniIso: this.fmtIso(X.ini), fimIso: this.fmtIso(X.fim),
        setIni: (e) => X.src === "l" ? null : this.salvarItem(X, { iniD: e.target.value, iniH: this.fmtH(X.ini), inicio: null }, "Início: " + (e.target.value ? e.target.value.split("-").reverse().join("/") : "removido")),
        setFim: (e) => X.src === "l" ? null : this.salvarItem(X, { fimD: e.target.value, fimH: this.fmtH(X.fim), fim: null }, "Prazo: " + (e.target.value ? e.target.value.split("-").reverse().join("/") : "removido")),
        iniTxt: X.ini ? prazoTxt({ fim: X.ini }) : "Definir início", fimTxt: X.fim ? prazoTxt(X) : "Definir prazo",
        iniStyle: "flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;height:30px;padding:0 11px;border-radius:9px;background:#f3f4f4;font-size:12.5px;font-weight:500;color:" + (X.ini ? "#12171d" : "#a3a8a4"),
        fimStyle: "flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;height:30px;padding:0 11px;border-radius:9px;font-size:12.5px;font-weight:500;" + (atrasada(X) ? "background:#fdeeea;color:#c2330f" : "background:#f3f4f4;color:" + (X.fim ? "#12171d" : "#a3a8a4")),
        prios: ["Baixa", "Média", "Alta"].map(p => ({ l: p, onClick: () => this.salvarItem(X, { prioridade: p }, "Prioridade: " + p.toLowerCase()), style: "display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:500;" + (X.prioridade === p ? "background:" + PRIO[p] + ";color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") })),
        areaTxt: (X.area || "—") + (X.fila ? " · fila de " + X.fila : ""),
        equipeSub: [{ v: "", l: "Sem responsável" }].concat(equipe.map(n => ({ v: n, l: n }))),
        subs: X.sub.map((s, i) => ({ abrir: () => this.setState({ subAberta: i }), t: s.t, temDesc: !!s.desc, desc: s.desc || "", feita: !!s.feita, resp: s.resp || "Atribuir", respV: s.resp || "", ini: s.resp ? ini(s.resp) : "+", av: av(s.resp, 22),
          prazo: s.fimX ? prazoTxt({ fim: s.fimX }) : "—", prazoStyle: "font-size:12px;font-weight:500;white-space:nowrap;color:" + (!s.feita && s.fimX && s.fimX < agora ? "#c2330f" : "#8b949e"),
          check: "flex:0 0 auto;width:18px;height:18px;border-radius:6px;border:0;padding:0;display:grid;place-items:center;cursor:pointer;" + (s.feita ? "background:#1f7256" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4"),
          tStyle: "display:block;font-size:13px;font-weight:500;line-height:1.4;color:" + (s.feita ? "#8b949e;text-decoration:line-through" : "#12171d"),
          setResp: (e) => setSubs(X.sub.map((y, j) => j === i ? Object.assign({}, y, { resp: e.target.value || null, fimX: undefined }) : Object.assign({}, y, { fimX: undefined })), null),
          tog: () => { const nv = X.sub.map((y, j) => Object.assign({}, y, { fimX: undefined }, j === i ? { feita: !y.feita } : {})); const tudo = nv.every(y => y.feita); setSubs(nv, null); if (tudo && aberta2(X)) this.salvarItem(X, { situacao: "Feita" }, "Todas as subtarefas feitas · “" + X.titulo + "” concluída"); else if (X.situacao === "A fazer") this.salvarItem(X, { situacao: "Em andamento" }, null); },
          remover: () => setSubs(X.sub.filter((_, j) => j !== i).map(y => Object.assign({}, y, { fimX: undefined })), null) })),
        teclaSub: (e) => { if (e.key === "Enter" && S.novaSub.trim()) { setSubs(X.sub.map(y => Object.assign({}, y, { fimX: undefined })).concat([{ t: S.novaSub.trim(), feita: false, resp: asg[0] || null }]), null); this.setState({ novaSub: "" }); } },
        feedN: coms.length ? coms.length + (coms.length > 1 ? " comentários" : " comentário") : "",
        feed: eventos.concat((X.log || []).map(l => Object.assign({ ev: true }, l)), coms).map(c => ({ temAnx: !!(c.anexos && c.anexos.length), anx: (c.anexos || []).map(a2 => ({ nome: a2.nome, temImg: !!a2.url, big: "display:block;width:220px;height:150px;border-radius:9px;box-shadow:0 0 0 1px #eef1f1;background:#fafaf8 center/cover no-repeat url(" + (a2.url || "") + ")", chip: a2.url ? "display:none" : "display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 9px 0 4px;border-radius:7px;background:#f3f4f4;font-size:11.5px;font-weight:500;color:#1f252c", ext: ((a2.nome || "").split(".").pop() || "").slice(0, 4).toUpperCase() })), autor: c.autor, ini: c.autor === "Sistema" ? "OF" : c.autor === "NEXO" ? "NX" : ini(c.autor, c.ehAgente), quando: c.quando || "", av: av(c.autor === "Sistema" ? null : c.autor, 24), partes: c.ev ? [{ t: c.texto, s: "" }] : partes(c.texto || ""),
          box: c.ev ? "padding:4px 2px" : "padding:12px 14px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px #eef1f1",
          txtStyle: "display:block;margin-top:6px;font-size:" + (c.ev ? "12px;color:#8b949e" : "13px;color:#1f252c") + ";line-height:1.55;white-space:pre-wrap;text-wrap:pretty" })),
        comentario: S.comentario, setComentario: (e) => this.setState({ comentario: e.target.value }),
        temMencao: !!mq, mencoes: mq ? equipe.filter(n => n.toLowerCase().indexOf(mq[2].toLowerCase()) >= 0 || n.toLowerCase().split(" ").some(p => p.indexOf(mq[2].toLowerCase()) === 0)).map(n => ({ nome: n, ini: ini(n), escolher: (e) => { e.preventDefault(); this.setState({ comentario: S.comentario.slice(0, S.comentario.length - mq[2].length - 1) + "@" + n + " " }); } })) : [],
        enviarStyle: "height:30px;padding:0 13px;border-radius:9999px;border:0;font-size:12px;font-weight:500;cursor:pointer;" + (S.comentario.trim() ? "background:#fe4f2b;color:#fff" : "background:#eeeff3;color:#a3a8a4"),
        enviar: () => { const t = S.comentario.trim(); if ((!t && !anxL.length) || X.src === "l") return; const d = new Date(); const menc = equipe.filter(n => t.indexOf("@" + n) >= 0);
          this.salvarItem(X, { comentarios: coms.concat([{ autor: EU, texto: t, anexos: anxL, quando: "Hoje, " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") }]), seguidores: seguidores.concat(menc.filter(n => seguidores.indexOf(n) < 0)).concat(segue ? [] : [EU]) }, menc.length ? "Comentário enviado · " + menc.join(", ") + " vai ser avisado" : "Comentário enviado");
          this.setState({ comentario: "", comAnx: [] }); },
        teclaCom: (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); extraDt.enviar(); } }
      };
      dt = { aberto: true, fechar: () => this.setState({ aberta: null }),
        sit: sx[1], sitSelo: "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:9999px;font-size:11.5px;font-weight:500;background:" + sx[4] + ";color:" + sx[3],
        tipo: X.tipo, tipoD: T[0], tipoStyle: "display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:500;background:" + T[2] + ";color:" + T[1],
        prio: X.prioridade || "Média", prioSelo: "display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:9999px;font-size:11.5px;font-weight:500;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:" + (PRIO[X.prioridade] || "#8b949e"),
        titulo: X.titulo, origem: X.src === "o" ? "Da oportunidade " + X.oppRot : X.src === "l" ? "Próxima ação do lead no Pré-vendas" : (X.area ? "Atividade de " + X.area : "Atividade avulsa"),
        sits: SIT.map(([k, l, d, c, bg]) => ({ l, d, onClick: () => this.salvarItem(X, { situacao: k }, "“" + X.titulo + "” · " + l),
          style: "display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:500;white-space:nowrap;" + (X.situacao === k ? "background:" + c + ";color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") })),
        fatos: [["Prazo", X.fim ? prazoTxt(X) : "Sem data · backlog", atrasada(X) ? "#c2330f" : "#12171d"], ["Responsável", X.resp || "Sem responsável", X.resp ? "#12171d" : "#c2330f"], ["Área", X.area || "—", "#12171d"], ["Aguardando", X.situacao === "Aguardando" ? (X.aguardando || "Retorno") : "—", "#12171d"]]
          .map(([l, v, c]) => ({ l, v, vStyle: "display:block;margin-top:3px;font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + c })),
        temJanela: !!janela, jIni: janela ? "Início " + prazoTxt({ fim: janela.ini }) : "", jFim: janela ? "Fim " + prazoTxt({ fim: janela.fim }) : "",
        jBarra: janela ? "position:absolute;left:0;top:0;bottom:0;border-radius:9999px;width:" + Math.round(Math.max(0, Math.min(1, (agora - janela.ini) / Math.max(1, janela.fim - janela.ini))) * 100) + "%;background:" + (agora > janela.fim && aberta2(X) ? "#d93c1a" : "#2c5f9e") : "",
        jTxt: janela ? (agora < janela.ini ? "Janela ainda não começou" : agora > janela.fim ? "Janela encerrada" : Math.round((agora - janela.ini) / Math.max(1, janela.fim - janela.ini) * 100) + "% da janela de trabalho já passou") : "",
        temDesc: !!(X.desc || X.descHtml), desc: X.desc, descVazia: !(S.dtDescTxt != null ? S.dtDescTxt : (X.desc || "")).trim(),
        descRef: (el) => { if (!el) return; this._dtDesc = el; if (document.activeElement === el) return; const h = X.descHtml || String(X.desc || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]).replace(/\n/g, "<br>"); if (el._h !== h) { el.innerHTML = h; el._h = h; } },
        digitaDesc: (e) => this.setState({ dtDescTxt: e.currentTarget.innerText }),
        salvarDesc: () => { const el = this._dtDesc; if (!el) return; const h = el.innerHTML, t = el.innerText.trim(); if (h === (X.descHtml || "") || (!X.descHtml && t === (X.desc || "").trim())) return; el._h = h; this.salvarItem(X, { descHtml: h, desc: t }, null); this.setState({ dtDescTxt: null }); },
        fmt: [["Negrito", "M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z", "bold"], ["Itálico", "M19 4h-9M14 20H5M15 4 9 20", "italic"], ["Sublinhado", "M6 3v7a6 6 0 0 0 12 0V3M4 21h16", "underline"], ["Lista", "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", "insertUnorderedList"], ["Lista numerada", "M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1", "insertOrderedList"], ["Link", "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7", "createLink"], ["Limpar formatação", "M4 7V4h16v3M9 20h6M12 4v16M3 3l18 18", "removeFormat"]]
          .map(([l, d, cmd]) => ({ l, d, onClick: (e) => { e.preventDefault(); const el = this._dtDesc; if (el) el.focus(); if (cmd === "createLink") { const u = window.prompt("Endereço do link", "https://"); if (!u) return; document.execCommand("createLink", false, u); } else document.execCommand(cmd, false, null); } })),
        temAnexos: !!(X.anexos && X.anexos.length), anexos: ((ax2, rem) => ax2.map((a2, i) => ({ nome: a2.nome, url: a2.url || "#", temImg: !!(a2.url && /^data:image/.test(a2.url)), semImg: !(a2.url && /^data:image/.test(a2.url)), ext: ((a2.nome || "").split(".").pop() || "").slice(0, 4).toUpperCase(), thumb: "display:block;width:26px;height:26px;border-radius:6px;background:center/cover no-repeat url(" + (a2.url || "") + ")", remover: rem ? () => rem(i) : null })))(X.anexos || [], null),
        temSub: subN > 0, subPct: subN ? Math.round(subF / subN * 100) + "% · " + subF + " de " + subN : "Nenhuma", subBarra: "display:block;height:100%;border-radius:9999px;width:" + Math.round(subF / Math.max(1, subN) * 100) + "%;background:" + (subF === subN && subN ? "#1f7256" : "#fe4f2b") + ";transition:width .5s cubic-bezier(.16,1,.3,1)",
        subs: X.sub.map((s, i) => ({ abrir: () => this.setState({ subAberta: i }), t: s.t, temDesc: !!s.desc, desc: s.desc || "", feita: !!s.feita,
          check: "flex:0 0 auto;width:18px;height:18px;margin-top:1px;border-radius:6px;border:0;padding:0;display:grid;place-items:center;cursor:pointer;" + (s.feita ? "background:#1f7256" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4"),
          tStyle: "display:block;font-size:13px;font-weight:500;line-height:1.4;color:" + (s.feita ? "#8b949e;text-decoration:line-through" : "#12171d"),
          tog: () => { const nv = X.sub.map((y, j) => j === i ? Object.assign({}, y, { feita: !y.feita }) : y); const tudo = nv.every(y => y.feita); setSubs(nv, null); if (tudo && aberta2(X)) this.salvarItem(X, { situacao: "Feita" }, "Todas as subtarefas feitas · “" + X.titulo + "” concluída"); else if (X.situacao === "A fazer") this.salvarItem(X, { situacao: "Em andamento" }, null); },
          remover: () => setSubs(X.sub.filter((_, j) => j !== i), null) })),
        novaSub: S.novaSub, setNovaSub: (e) => this.setState({ novaSub: e.target.value }),
        teclaSub: (e) => { if (e.key === "Enter" && S.novaSub.trim()) { setSubs(X.sub.concat([{ t: S.novaSub.trim(), feita: false }]), null); this.setState({ novaSub: "" }); } },
        temVinculos: !!(X.empresa || X.pessoa || X.oppRot || X.leadId),
        vinculos: [X.empresa ? ["Empresa", X.empresa, "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4", () => E && E.irPara("/onface-preview/empresa", X.empresa, {})] : null,
          X.pessoa ? ["Contato", X.pessoa, "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", () => E && E.irPara("/onface-preview/pessoa", X.pessoa, {})] : null,
          X.oppRot ? ["Oportunidade", X.oppRot, "M12 2v20M17 6H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6", () => E && E.irPara("/onface-preview/oportunidade", X.empresa, { opp: X.oppId, ver: "" })] : null,
          X.leadId ? ["Lead", "Pré-vendas · " + X.pessoa, "M22 12h-4l-3 9L9 3l-3 9H2", () => { this.setState({ aberta: null }); E && E.abrir("detalhe", X.leadId); }] : null].filter(Boolean).map(([l, v, d, ir]) => ({ l, v, d, ir })),
        concluirTxt: X.situacao === "Feita" ? "Reabrir" : "Marcar como feito",
        concluirStyle: "flex:0 0 auto;white-space:nowrap;display:flex;align-items:center;gap:7px;height:38px;padding:0 15px;border-radius:9px;border:0;font-size:13px;font-weight:500;cursor:pointer;" + (X.situacao === "Feita" ? "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede" : "background:#e6f4ee;color:#1f7256"),
        concluir: () => this.salvarItem(X, { situacao: X.situacao === "Feita" ? "A fazer" : "Feita" }, (X.situacao === "Feita" ? "Reaberta: " : "Feito: ") + X.titulo),
        editar: () => X.src === "l" ? (this.setState({ aberta: null }), E && E.abrir("detalhe", X.leadId)) : this.abrirEditor(X), ...extraDt }; }

    // editor
    const ED = S.ed;
    let ed = { aberto: false, destinos: [], tiposOpc: [], sitsOpc: [], priosOpc: [], pessoas: [], filasOpc: [], vincTiposOpc: [], vincOpc: [], subs: [], equipeSub: [] };
    if (ED) { const F2 = ED.f, up = (p) => this.setState(s => ({ ed: Object.assign({}, s.ed, { f: Object.assign({}, s.ed.f, p), erro: null }) }));
      const lerArq = (fs) => fs.forEach(fl => { const r = new FileReader(); r.onload = () => this.setState(s => ({ ed: Object.assign({}, s.ed, { f: Object.assign({}, s.ed.f, { anexos: (s.ed.f.anexos || []).concat([{ nome: fl.name || "arquivo", url: r.result, tipo: fl.type }]) }) }) })); r.readAsDataURL(fl); });
      const outro = F2.dest === "outro";
      const oppsL = (E && E.ler("opps", null)) || D.OPORTUNIDADES || [];
      const FAMr = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
      const pessoasL = todas.map(x => x.pessoa).filter(Boolean).filter((v, i, a2) => a2.indexOf(v) === i).sort();
      const VT = { nenhum: "Sem vínculo", empresa: "Empresa", pessoa: "Pessoa", opp: "Oportunidade" };
      const alvos = F2.vincTipo === "empresa" ? empresasTodas.filter(x => x !== "—").map(x => ({ v: x, l: x })) : F2.vincTipo === "pessoa" ? pessoasL.map(x => ({ v: x, l: x })) : F2.vincTipo === "opp" ? oppsL.filter(o => o.etapa !== "perdido").map(o => ({ v: o.id, l: (FAMr[o.familia] || "") + " · " + o.empresa })) : [];
      const nomeTipo = (ED.novoTipo || "").trim();
      const criarTipo = () => { if (!nomeTipo) return; if (E && !TIPOS[nomeTipo]) E.gravar({ tiposAtv: criados.concat(nomeTipo) }); this.setState(s => ({ ed: Object.assign({}, s.ed, { novoTipo: null, f: Object.assign({}, s.ed.f, { tipo: nomeTipo }) }) })); };
      const sxE = sitDe(F2.situacao);
      const setSub = (i, p) => up({ sub: F2.sub.map((y, j) => j === i ? Object.assign({}, y, p) : y) });
      ed = { aberto: true, fechar: () => this.setState({ ed: null }), sub: ED.it ? "Editando" : F2.projetoId ? "Nova subtarefa de projeto" : "Nova atividade",
        destinos: [["mim", "Para mim", "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"], ["outro", "Para outra pessoa ou área", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"]].map(([k, l, d]) => ({ l, d, onClick: () => up(k === "mim" ? { dest: k, assignees: [EU], fila: null } : { dest: k, assignees: (F2.assignees || []).filter(n => n !== EU) }),
          style: "display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + ((F2.dest || "mim") === k ? "background:#fff;color:#12171d;font-weight:700;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:#4a5560;font-weight:500") })),
        tipo: F2.tipo, tipoD: tipoDe(F2.tipo)[0], tiposOpc: Object.keys(TIPOS).filter(t => t !== "Reunião").map(t => ({ v: t, l: t })).concat([{ v: "__novo", l: "+ Criar outro tipo" }]),
        naturezas: [["tarefa", "Tarefa", "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"], ["reuniao", "Reunião", "m16 10 5-3v10l-5-3zM4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"]].map(([k, l, d]) => { const on = k === "tarefa"; return { l, d,
          onClick: () => { if (on) return; const oppV = F2.vincTipo === "opp" ? F2.vinc : "", emp = F2.vincTipo === "empresa" ? F2.vinc : "", pes = F2.vincTipo === "pessoa" ? F2.vinc : ""; this.setState({ ed: null }); E && E.abrir("novaReuniao", { data: F2.fimD || this.fmtIso(H0), hora: F2.fimH || "14:00", titulo: F2.titulo, oppId: oppV, empresa: emp, pessoa: pes }); },
          style: "display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:7px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (on ? "background:#fff;color:#12171d;font-weight:700;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:#4a5560;font-weight:500") }; }),
        setTipo: (e) => e.target.value === "__novo" ? this.setState(s => ({ ed: Object.assign({}, s.ed, { novoTipo: "" }) })) : up({ tipo: e.target.value }),
        criandoTipo: ED.novoTipo != null, novoTipo: ED.novoTipo || "", setNovoTipo: (e) => this.setState(s => ({ ed: Object.assign({}, s.ed, { novoTipo: e.target.value }) })),
        salvarTipo: criarTipo, teclaTipo: (e) => { if (e.key === "Enter") { e.preventDefault(); criarTipo(); } },
        sit: F2.situacao, sitL: sxE[1], sitDot: "width:8px;height:8px;border-radius:9999px;background:" + sxE[3], sitsOpc: SIT.map(s => ({ v: s[0], l: s[1] })), setSit: (e) => up({ situacao: e.target.value }),
        tit: F2.titulo, setTit: (e) => up({ titulo: e.target.value }),
        titInp: "width:100%;margin-top:14px;padding:4px 0;border:0;outline:0;background:transparent;font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;font-weight:800;letter-spacing:-.03em;color:#12171d;box-shadow:inset 0 -1.5px 0 " + (ED.tentou && !F2.titulo.trim() ? "#d93c1a" : "transparent"),
        desc: F2.desc, setDesc: (e) => up({ desc: e.target.value }),
        descVazia: !(F2.desc || "").trim() && !/<(img|li|hr)/i.test(F2.descHtml || ""),
        descRef: (el) => { if (el) this._edDesc = el; if (!el || el._tk === ED.tk) return; el._tk = ED.tk; el.innerHTML = F2.descHtml || String(F2.desc || "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]).replace(/\n/g, "<br>"); },
        setDescHtml: (e) => { const el = e.currentTarget; up({ descHtml: el.innerHTML, desc: el.innerText }); },
        colarDesc: (e) => { const fs = Array.from((e.clipboardData && e.clipboardData.files) || []); if (!fs.length) return; e.preventDefault(); lerArq(fs); },
        fmt: [["Negrito", "M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z", "bold"], ["Itálico", "M19 4h-9M14 20H5M15 4 9 20", "italic"], ["Sublinhado", "M6 3v7a6 6 0 0 0 12 0V3M4 21h16", "underline"], ["Tachado", "M16 4H9a3 3 0 0 0-2.8 4M14 12a4 4 0 0 1 0 8H6M4 12h16", "strikeThrough"],
          ["Lista", "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", "insertUnorderedList", 1], ["Lista numerada", "M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1", "insertOrderedList"], ["Citação", "M3 21c3 0 7-1 7-8V5H3v8h4c0 4-2 6-4 6zM14 21c3 0 7-1 7-8V5h-7v8h4c0 4-2 6-4 6z", "formatBlock:blockquote"],
          ["Link", "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7", "createLink", 1], ["Limpar formatação", "M4 7V4h16v3M9 20h6M12 4v16M3 3l18 18", "removeFormat"]]
          .map(([l, d, cmd, sep]) => ({ l, d, sep: !!sep, onClick: (e) => { e.preventDefault(); const el = this._edDesc; if (el) el.focus();
            if (cmd === "createLink") { const u = window.prompt("Endereço do link", "https://"); if (!u) return; document.execCommand("createLink", false, u); }
            else if (cmd.indexOf("formatBlock:") === 0) document.execCommand("formatBlock", false, cmd.split(":")[1]); else document.execCommand(cmd, false, null);
            if (el) up({ descHtml: el.innerHTML, desc: el.innerText }); } })),
        anexar: (e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; lerArq(fs); },
        temAnexos: !!(F2.anexos && F2.anexos.length), anexos: ((ax2, rem) => ax2.map((a2, i) => ({ nome: a2.nome, url: a2.url || "#", temImg: !!(a2.url && /^data:image/.test(a2.url)), semImg: !(a2.url && /^data:image/.test(a2.url)), ext: ((a2.nome || "").split(".").pop() || "").slice(0, 4).toUpperCase(), thumb: "display:block;width:26px;height:26px;border-radius:6px;background:center/cover no-repeat url(" + (a2.url || "") + ")", remover: rem ? () => rem(i) : null })))(F2.anexos || [], (i) => up({ anexos: F2.anexos.filter((_, j) => j !== i) })),
        iniD: F2.iniD, fimD: F2.fimD, fimH: F2.fimH, setIniD: (e) => up({ iniD: e.target.value }), setFimD: (e) => up({ fimD: e.target.value }), setFimH: (e) => up({ fimH: e.target.value }),
        prio: F2.prioridade, priosOpc: ["Baixa", "Média", "Alta"].map(p => ({ v: p, l: p })), setPrio: (e) => up({ prioridade: e.target.value }), prioCor: "color:" + PRIO[F2.prioridade],
        paraOutro: outro,
        buscaPessoa: ED.buscaPessoa || "", setBuscaPessoa: (e) => this.setState(s => ({ ed: Object.assign({}, s.ed, { buscaPessoa: e.target.value }) })),
        pessoas: equipe.filter(n => n !== EU).filter(n => { const q = (ED.buscaPessoa || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); return !q || n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").indexOf(q) >= 0 || (F2.assignees || []).indexOf(n) >= 0; }).map(n => { const on = (F2.assignees || []).indexOf(n) >= 0; return { l: n, ini: ini(n), onClick: () => up({ fila: null, assignees: on ? F2.assignees.filter(x => x !== n) : (F2.assignees || []).concat(n) }),
          style: "flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 4px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:500;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
          av: "width:24px;height:24px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:500;" + (on ? "background:#fe4f2b;color:#fff" : "background:#eeeff3;color:#4a5560") }; }),
        filaV: F2.fila || "", filaL: F2.fila ? "Fila de " + F2.fila : "Escolher setor", filasOpc: [{ v: "", l: "Nenhuma fila" }].concat(AREAS.map(x => ({ v: x, l: x }))), setFila: (e) => up({ fila: e.target.value || null, assignees: e.target.value ? [] : F2.assignees }),
        paraTxt: (F2.assignees || []).length ? (F2.assignees.length > 1 ? "Todos recebem e acompanham juntos." : F2.assignees[0] + " recebe aviso na hora.") : "Escolha uma ou mais pessoas, ou uma fila.",
        vincTipo: F2.vincTipo || "nenhum", vincTipoL: VT[F2.vincTipo || "nenhum"], vincTiposOpc: Object.keys(VT).map(k => ({ v: k, l: VT[k] })), setVincTipo: (e) => up({ vincTipo: e.target.value, vinc: "" }),
        temVincAlvo: !!F2.vincTipo && F2.vincTipo !== "nenhum", vincV: F2.vinc || "", vincL: F2.vinc ? ((alvos.find(x => x.v === F2.vinc) || {}).l || F2.vinc) : "Escolher", vincOpc: [{ v: "", l: "Escolher" }].concat(alvos), setVinc: (e) => up({ vinc: e.target.value }),
        subsN: F2.sub.length ? String(F2.sub.length) : "",
        equipeSub: [{ v: "", l: "Sem responsável" }].concat(equipe.map(n => ({ v: n, l: n }))),
        subs: F2.sub.map((s, i) => ({ t: s.t, desc: s.desc || "", respV: s.resp || "", respL: s.resp || "Responsável", fimD: s.fimD || "", ini: s.resp ? ini(s.resp) : "+", av: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:500;" + (s.resp === EU ? "background:#12171d;color:#fff" : s.resp ? "background:#e3e7e8;color:#4a5560" : "background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#a3a8a4"), fimTxt: s.fimD ? s.fimD.split("-").reverse().slice(0, 2).join("/") : "Prazo", fimStyle: "position:relative;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9999px;background:#f3f4f4;cursor:pointer;font-size:12.5px;font-weight:500;white-space:nowrap;color:" + (s.fimD ? "#12171d" : "#8b949e"),
          set: (e) => setSub(i, { t: e.target.value }), setDesc: (e) => setSub(i, { desc: e.target.value }), setResp: (e) => setSub(i, { resp: e.target.value || null }), setFim: (e) => setSub(i, { fimD: e.target.value }),
          remover: () => up({ sub: F2.sub.filter((_, j) => j !== i) }) })),
        addSub: () => { if (!(ED.novaSub || "").trim()) return; this.setState(s => ({ ed: Object.assign({}, s.ed, { novaSub: "", f: Object.assign({}, s.ed.f, { sub: s.ed.f.sub.concat([{ t: s.ed.novaSub.trim(), desc: "", feita: false, resp: outro ? ((s.ed.f.assignees || [])[0] || null) : EU, fimD: s.ed.f.fimD || "" }]) }) }) })); },
        novaSub: ED.novaSub || "", setNovaSub: (e) => this.setState(s => ({ ed: Object.assign({}, s.ed, { novaSub: e.target.value }) })),
        teclaSub: (e) => { if (e.key === "Enter" && (ED.novaSub || "").trim()) { e.preventDefault(); this.setState(s => ({ ed: Object.assign({}, s.ed, { novaSub: "", f: Object.assign({}, s.ed.f, { sub: s.ed.f.sub.concat([{ t: s.ed.novaSub.trim(), desc: "", feita: false, resp: outro ? ((s.ed.f.assignees || [])[0] || null) : EU, fimD: s.ed.f.fimD || "" }]) }) }) })); } },
        temErro: !!ED.erro, erro: ED.erro || "",
        salvarTxt: ED.it ? "Salvar" : outro ? "Enviar atividade" : "Criar atividade",
        salvar: () => {
          const erro = !F2.titulo.trim() ? "Dê um nome para a atividade." : outro && !F2.fila && !(F2.assignees || []).length ? "Escolha para quem vai ou uma fila." : F2.vincTipo && F2.vincTipo !== "nenhum" && !F2.vinc ? "Escolha o vínculo ou marque sem vínculo." : "";
          if (erro) return this.setState(s => ({ ed: Object.assign({}, s.ed, { tentou: true, erro }) }));
          const asg = outro ? (F2.fila ? [] : F2.assignees) : [EU], fila = outro ? F2.fila : null;
          const O2 = F2.vincTipo === "opp" ? oppsL.find(o => o.id === F2.vinc) : null;
          const vinc = F2.vincTipo === "empresa" ? { empresa: F2.vinc, pessoa: null, oppId: null, oppRot: null } : F2.vincTipo === "pessoa" ? { pessoa: F2.vinc, empresa: (todas.find(x => x.pessoa === F2.vinc) || {}).empresa || null, oppId: null, oppRot: null }
            : O2 ? { empresa: O2.empresa, pessoa: O2.pessoa, oppId: O2.id, oppRot: (FAMr[O2.familia] || "") + " · " + O2.empresa } : { empresa: null, pessoa: null, oppId: null, oppRot: null };
          const d = new Date(), hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
          const dados = Object.assign({ titulo: F2.titulo.trim(), desc: F2.desc.trim(), descHtml: F2.descHtml || "", anexos: F2.anexos || [], tipo: F2.tipo, situacao: F2.situacao, prioridade: F2.prioridade, resp: asg[0] || null, assignees: asg, fila, area: fila || (outro ? "Comercial" : "Pessoal"),
            iniD: F2.iniD, iniH: "", fimD: F2.fimD, fimH: F2.fimH, inicio: null, fim: null, projetoId: F2.projetoId || (ED.it && ED.it.projetoId) || null, vincTipo: F2.vincTipo || "nenhum", sub: F2.sub.filter(s => (s.t || "").trim()).map(s => Object.assign({}, s, { fim: null })) }, vinc);
          if (ED.it) { this.salvarItem(ED.it, Object.assign({}, dados, { log: (ED.it.log || []).concat([{ autor: EU, texto: "editou a atividade", quando: "Hoje, " + hh }]) }), "Atividade salva"); this.setState({ ed: null, aberta: ED.it.key }); }
          else { const nova = Object.assign({ id: "a" + Date.now().toString(36), criadoPor: EU, comentarios: [], log: [{ autor: EU, texto: fila ? "enviou para a fila de " + fila : outro ? "criou para " + asg.join(", ") : "criou a atividade", quando: "Hoje, " + hh }] }, dados);
            this.gravarProprias(this.proprias().concat([nova])); E && E.avisar(fila ? "Enviada para a fila de " + fila : outro ? "Atividade enviada para " + asg.join(", ") : "Atividade criada", "ok"); this.setState({ ed: null, aberta: "p:" + nova.id }); }
        } };
    }
    const meu = (x) => (x.assignees && x.assignees.length ? x.assignees.indexOf(EU) >= 0 : x.resp === EU);
    const mes0 = new Date(H0.getFullYear(), H0.getMonth(), 1), mes1 = new Date(H0.getFullYear(), H0.getMonth() + 1, 1);
    const noMes = (x) => x.fim && x.fim >= mes0 && x.fim < mes1;
    const meus = todas.filter(meu), abertosM = meus.filter(aberta2), feitosM = meus.filter(x => x.situacao === "Feita" && (noMes(x) || !x.fim));
    const atrasM = meus.filter(atrasada), marcos = meus.filter(x => aberta2(x) && noMes(x) && (x.tipo === "Reunião" || x.tipo === "Proposta"));
    const pesoP = { Alta: 0, "Média": 1, Baixa: 2 };
    const prios = abertosM.slice().sort((a, b) => (atrasada(b) ? 1 : 0) - (atrasada(a) ? 1 : 0) || (pesoP[a.prioridade] || 1) - (pesoP[b.prioridade] || 1) || (a.fim ? a.fim.getTime() : 9e15) - (b.fim ? b.fim.getTime() : 9e15));
    const totMes = feitosM.length + meus.filter(x => aberta2(x) && noMes(x)).length;
    const pctMes = totMes ? Math.round(feitosM.length / totMes * 100) : 0;
    const nexoIt = todas.filter(x => x.origem === "nexo" && aberta2(x));
    const semIniO = new Date(H0); semIniO.setDate(semIniO.getDate() - ((semIniO.getDay() + 6) % 7));
    const DSEM = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const plano = (() => { const dias = [0, 1, 2, 3, 4].map(i => new Date(semIniO.getTime() + i * 864e5)).filter(dd => dd >= H0); const mapa = dias.map(dd => ({ dd, it: [] })); if (!mapa.length) return [];
      prios.forEach((x, i) => { const alvo = x.fim && x.fim >= H0 ? mapa.find(m => m.dd.toDateString() === x.fim.toDateString()) : null; (alvo && alvo.it.length < 3 ? alvo : mapa.reduce((a, b) => b.it.length < a.it.length ? b : a)).it.push(x); });
      return mapa.map(m => ({ dia: DSEM[(m.dd.getDay() + 6) % 7], dd: m.dd, it: m.it })); })();
    const FILAS = [["Suporte", "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z", "#2c5f9e", "#e8f0fb"], ["Onboarding", "M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z", "#1f7256", "#e6f4ee"], ["Implantação", "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z", "#6e5420", "#f7edd8"], ["CS", "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z", "#c2330f", "#fff6f4"], ["SDR", "M22 12h-4l-3 9L9 3l-3 9H2", "#4f3fa8", "#efecfa"], ["Comercial", "M12 2v20M17 6H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6", "#4a5560", "#eeeff3"]];
    const ov = {
      c7: "grid-column:" + (S.larg >= 1180 ? "span 7" : "1 / -1"), c5: "grid-column:" + (S.larg >= 1180 ? "span 5" : "1 / -1"),
      saud: (agora.getHours() < 12 ? "Bom dia" : agora.getHours() < 18 ? "Boa tarde" : "Boa noite") + ", " + (this.eu || "").split(" ")[0],
      frase: atrasM.length ? atrasM.length + (atrasM.length > 1 ? " atividades atrasadas" : " atividade atrasada") + " e " + prios.filter(x => x.fim && x.fim >= H0 && x.fim < H1).length + " para hoje." : prios.filter(x => x.fim && x.fim < H1).length ? prios.filter(x => x.fim && x.fim < H1).length + (prios.filter(x => x.fim && x.fim < H1).length > 1 ? " atividades" : " atividade") + " para hoje. Nada atrasado." : "Dia limpo. Nada vencendo hoje.",
      pct: pctMes + "%", anel: pctMes + " 100",
      kpis: [[String(abertosM.length), "em aberto", "#fff", () => this.setState({ visao: "lista", escopo: "minhas", rapido: null })], [String(feitosM.length), "feitas no mês", "#3ecf8e", () => this.setState({ visao: "quadro", escopo: "minhas" })], [String(atrasM.length), "atrasadas", atrasM.length ? "#ff8a70" : "#fff", () => this.setState({ visao: "lista", escopo: "minhas", rapido: "atrasadas" })], [String(marcos.length), "marcos", "#fff", () => this.setState({ visao: "lista", escopo: "minhas" })]]
        .map(([v, l, c, on]) => ({ v, l, onClick: on, vStyle: "display:block;font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums;color:" + c })),
      semPrio: !prios.length, prioridades: prios.slice(0, 6).map(card), verTodas: () => this.setState({ visao: "lista", escopo: "minhas" }),
      nexoSub: nexoIt.length ? nexoIt.length + (nexoIt.length > 1 ? " atividades que eu criei para você" : " atividade que eu criei para você") : "Estou de olho nas suas contas",
      nexo: nexoIt.map(x => { const c = card(x); const amanha = new Date(H0.getTime() + 864e5);
        const acao = x.tipo === "Mensagem" ? ["Abrir conversa", () => E && E.irPara("/atendimento", "Atendimento", {})] : x.tipo === "Proposta" ? ["Renovar proposta", () => E && E.irPara("/onface-preview/propostas", "Propostas", {})] : x.tipo === "Follow up" ? ["Criar follow up agora", () => { this.salvarItem(x, { situacao: "Em andamento" }, "NEXO: follow up iniciado"); this.setState({ aberta: x.key }); }] : ["Começar", () => { this.salvarItem(x, { situacao: "Em andamento" }, "Em andamento: " + x.titulo); this.setState({ aberta: x.key }); }];
        return { titulo: x.titulo, motivo: x.nexoMotivo || x.desc || "", d: c.tipoD, prazo: c.prazo, prazoStyle: c.prazoStyle + ";flex:0 0 auto", abrir: c.abrir, acaoTxt: acao[0], acao: acao[1],
          adiar: () => this.salvarItem(x, { fimD: this.fmtIso(x.fim && x.fim > H0 ? new Date(x.fim.getTime() + 864e5) : amanha), fimH: this.fmtH(x.fim), fim: null }, "Adiada para amanhã: " + x.titulo),
          dispensar: () => this.salvarItem(x, { situacao: "Declinada" }, "Dispensada: " + x.titulo) }; }),
      comandos: [["Reorganizar minha semana", "M3 12h18M3 6h18M3 18h12", () => { plano.forEach(p => p.it.forEach(x => { if (x.src === "l") return; const iso = this.fmtIso(p.dd); if (this.fmtIso(x.fim) !== iso) this.salvarItem(x, { fimD: iso, fimH: this.fmtH(x.fim) || "", fim: null }, null); })); E && E.avisar("NEXO redistribuiu seus prazos da semana por prioridade", "ok"); }],
        ["Priorizar atrasadas", "M5 21V4h11l-2 4 2 4H7", () => { atrasM.forEach(x => { if (x.prioridade !== "Alta" && x.src !== "l") this.salvarItem(x, { prioridade: "Alta" }, null); }); E && E.avisar(atrasM.length ? atrasM.length + " atrasadas viraram prioridade alta" : "Nada atrasado", "ok"); }],
        ["Empurrar o que é baixa para amanhã", "M5 12h14M13 6l6 6-6 6", () => { const hj = prios.filter(x => x.prioridade === "Baixa" && x.fim && x.fim < H1 && x.src !== "l"); hj.forEach(x => this.salvarItem(x, { fimD: this.fmtIso(H1), fimH: this.fmtH(x.fim), fim: null }, null)); E && E.avisar(hj.length ? hj.length + " atividades de baixa prioridade foram para amanhã" : "Nada de baixa prioridade para hoje", "ok"); }]]
        .map(([l, d, onClick]) => ({ l, d, onClick })), semNexo: !nexoIt.length,
      reorgTxt: "Perguntar ao NEXO", reorganizar: () => this.nexo(""),
      temPlano: !!S.nexoPlano && plano.length > 0, plano: plano.map(p => ({ dia: p.dia, itens: p.it.length ? p.it.map(x => x.titulo).join(" · ") : "Livre para foco" })),
      aplicarPlano: () => { plano.forEach(p => p.it.forEach(x => { if (x.src === "l") return; const iso = this.fmtIso(p.dd); if (this.fmtIso(x.fim) !== iso) this.salvarItem(x, { fimD: iso, fimH: this.fmtH(x.fim) || "" }, null); })); E && E.avisar("Semana reorganizada pelo NEXO: prazos redistribuídos por prioridade", "ok"); this.setState({ nexoPlano: false }); },
      semanaTxt: semIniO.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + " – " + new Date(semIniO.getTime() + 6 * 864e5).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      calendario: () => E && E.irPara("/calendario", "Calendário", {}),
      dias: DSEM.map((l, i) => { const dd = new Date(semIniO.getTime() + i * 864e5), hj = dd.getTime() === H0.getTime(), passou = dd < H0;
        const its = meus.filter(x => x.fim && x.fim.toDateString() === dd.toDateString()).sort((a, b) => a.fim - b.fim);
        return { num: String(dd.getDate()), sem: l, n: String(its.length), temN: its.length > 0, temMais: its.length > 4, mais: "+" + (its.length - 4) + " atividades",
          numStyle: "font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:800;letter-spacing:-.03em;color:" + (hj ? "#fe4f2b" : passou ? "#a3a8a4" : "#12171d"),
          box: "min-width:0;min-height:130px;padding:10px;border-radius:12px;background:" + (hj ? "#fff8f5;box-shadow:inset 0 0 0 1.5px #fe4f2b" : "#fafaf8;box-shadow:inset 0 0 0 1px #eef1f1"),
          itens: its.slice(0, 4).map(x => { const T = tipoDe(x.tipo), feito = !aberta2(x); return { titulo: x.titulo, h: this.fmtH(x.fim) || "dia", abrir: () => this.setState({ aberta: x.key }),
            hStyle: "flex:0 0 auto;font-size:10.5px;font-weight:500;font-variant-numeric:tabular-nums;color:" + T[1],
            style: "display:flex;align-items:center;gap:6px;width:100%;min-width:0;padding:5px 7px;border-radius:7px;border:0;cursor:pointer;text-align:left;font-size:11.5px;font-weight:500;background:" + T[2] + ";color:#12171d;" + (feito ? "opacity:.55;text-decoration:line-through" : "") }; }) }; }),
      filas: FILAS.map(([l, d, c, bg]) => { const naFila = todas.filter(x => aberta2(x) && x.fila === l && !(x.assignees && x.assignees.length)); const emAnd = todas.filter(x => aberta2(x) && x.area === l && x.assignees && x.assignees.length);
        const prox = naFila.slice().sort((a, b) => (pesoP[a.prioridade] || 1) - (pesoP[b.prioridade] || 1))[0];
        return { l, d, n: String(naFila.length), ico: "flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:" + bg + ";color:" + c,
          nStyle: "min-width:24px;height:22px;padding:0 7px;border-radius:9999px;display:grid;place-items:center;font-size:12px;font-weight:500;" + (naFila.length ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#8b949e"),
          box: "min-width:0;padding:12px;border-radius:12px;background:#fafaf8;box-shadow:inset 0 0 0 1px #eef1f1",
          prox: prox ? "Próxima: " + prox.titulo : "Fila vazia", meta: (prox ? "enviada por " + (prox.criadoPor || "—") + " · " : "") + emAnd.length + " em andamento no setor",
          temPegar: !!prox, pegar: () => { this.salvarItem(prox, { assignees: [EU], resp: EU, situacao: "Em andamento" }, "Você pegou “" + prox.titulo + "” da fila de " + l); this.setState({ aberta: prox.key }); } }; }),
      temAgenda: S.larg >= 1180,
      ...(() => { const dias = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(H0.getTime() + i * 864e5)); const dSel = S.diaSel ? this.deIso(S.diaSel) : new Date(H0), ds = Math.round((new Date(dSel.getFullYear(), dSel.getMonth(), dSel.getDate()) - H0) / 864e5);
        const reu = todas.concat(D.REUNIOES || []).filter(x => x.tipo === "Reunião" && (x.ini || x.fim));
        const doDia = (d) => reu.filter(x => (x.ini || x.fim).toDateString() === d.toDateString()).sort((a, b) => (a.ini || a.fim) - (b.ini || b.fim));
        const SEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const lst = doDia(dSel);
        return { reuTxt: reu.filter(x => x.fim < new Date(H0.getTime() + 7 * 864e5)).length + " nos próximos 7 dias",
          diasR: dias.map((d, i) => { const on = i === ds, n = doDia(d).length; return { sem: i === 0 ? "Hoje" : SEM[d.getDay()], num: String(d.getDate()), onClick: () => this.setState({ diaReu: i }),
            style: "display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0 6px;border-radius:10px;border:0;cursor:pointer;" + (on ? "background:#12171d;color:#fff" : "background:transparent;color:#1f252c"),
            dot: "width:5px;height:5px;border-radius:9999px;background:" + (n ? (on ? "#fe4f2b" : "#fe4f2b") : "transparent") }; }),
          reuN: String(lst.length), reuResumo: lst.length ? lst.length + (lst.length === 1 ? " reunião" : " reuniões") : "livre", diaSelTxt: ds === 0 ? "Hoje" : ds === 1 ? "Amanhã" : dSel.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }), semReu: !lst.length,
          reunioes: lst.map(x => { const ini2 = x.ini || x.fim, fim2 = x.ini ? x.fim : null, RE = x.reuniao || {}; const RES = { realizada: "Realizada", noshow: "Não compareceu", cancelada: "Cancelada" }[RE.resultado] || (x.situacao === "Feita" ? "Realizada" : x.situacao === "Declinada" ? "Cancelada" : x.situacao === "Não compareceu" ? "Não compareceu" : null); const agoraNela = !RES && ini2 <= agora && (!fim2 || fim2 >= agora);
            const parts = (RE.participantes && RE.participantes.length ? RE.participantes.map(p => p.split("@")[0]) : [x.resp].concat(x.pessoa ? [x.pessoa] : [])).filter(Boolean).slice(0, 4);
            const FMD = { Vídeo: "m22 8-6 4 6 4V8zM2 6h14v12H2z", Ligação: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z", Presencial: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" };
            const mins = fim2 && ini2 && ini2._h ? Math.round((fim2 - ini2) / 6e4) : RE.duracao || null, durC = RES || (mins ? (mins >= 60 && mins % 60 === 0 ? mins / 60 + "h" : mins > 60 ? Math.floor(mins / 60) + "h" + String(mins % 60).padStart(2, "0") : mins + " min") : "");
            const fimR = fim2 && fim2._h ? fim2 : new Date(ini2.getTime() + (RE.duracao || 30) * 6e4), passou = !RES && fimR < agora;
            return { durC, icoD: FMD[RE.formato || "Vídeo"] || FMD["Vídeo"], _ini: ini2, _fim: fimR, _res: RES, _passou: passou, _parts: parts, _fmt: RE.formato || "Vídeo",
              row: "display:flex;align-items:center;gap:12px;width:100%;padding:11px 6px;border:0;border-radius:10px;cursor:pointer;text-align:left;box-shadow:inset 0 -1px 0 #f1f3f3;background:" + (agoraNela ? "#fff8f5" : "transparent"),
              hStyle: "flex:0 0 auto;width:40px;font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;color:" + (agoraNela ? "#c2330f" : "#4a5560"),
              icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;" + (RES ? "background:#f3f4f4;color:#a3a8a4" : "background:#fff6f4;color:#c2330f"),
              tStyle: "display:block;font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (RES ? "#8b949e" : "#12171d"),
              durStyle: "flex:0 0 auto;max-width:72px;text-align:right;font-size:12px;line-height:1.3;color:" + (RES === "Realizada" ? "#1f7256;font-weight:600" : RES ? "#c2330f;font-weight:600" : "#67787c"),
              h: this.fmtH(ini2) || "Dia", dur: fim2 ? "até " + this.fmtH(fim2) : RE.duracao ? RE.duracao + " min" : "", titulo: x.titulo, sub: [x.empresa, x.resp].filter(Boolean).join(" · "),
              fmt: RES || RE.formato || "Vídeo", fmtStyle: "font-size:11px;font-weight:500;padding:2px 7px;border-radius:9999px;white-space:nowrap;" + (RES === "Realizada" ? "background:#e6f4ee;color:#1f7256" : RES ? "background:#fdeeea;color:#c2330f" : "background:#f3f4f4;color:#4a5560"),
              part: parts.map(n => ({ n, ini: ini(n), av: "width:24px;height:24px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:500;margin-left:-4px;box-shadow:0 0 0 2px #fff;background:" + (n === EU ? "#12171d;color:#fff" : "#e3e7e8;color:#4a5560") })),
              temEntrar: !RES && (RE.formato || "Vídeo") === "Vídeo", entrar: () => E && E.abrirExterno ? E.abrirExterno(RE.link || "https://teams.microsoft.com") : window.open(RE.link || "https://teams.microsoft.com", "_blank"),
              abrir: () => x.src === "o" ? E && E.abrir("reuniao", { src: "o", oppId: x.oppId, i: x.idx }) : x.src === "p" ? E && E.abrir("reuniao", { src: "p", id: x.id }) : this.setState({ aberta: x.key, subAberta: null }),
              box: "padding:12px;border-radius:12px;" + (agoraNela ? "background:#fff8f5;box-shadow:inset 0 0 0 1.5px #fe4f2b" : "background:#fafaf8;box-shadow:inset 0 0 0 1px #eef1f1") }; }) }; })(),
      enviadas: todas.filter(x => x.criadoPor === EU && (x.fila || (x.assignees || []).some(n => n !== EU))).slice(-6).reverse().map(card),
      semEnv: !todas.some(x => x.criadoPor === EU && (x.fila || (x.assignees || []).some(n => n !== EU))),
      carga: equipe.map(p => { const ab = todas.filter(x => aberta2(x) && (x.assignees && x.assignees.length ? x.assignees.indexOf(p) >= 0 : x.resp === p)); const lt = ab.filter(atrasada).length; return { p, ab: ab.length, lt }; })
        .sort((a, b) => b.ab - a.ab).map((x, i, arr) => { const mx = Math.max(1, arr[0].ab); return { nome: x.p, ini: ini(x.p), txt: x.ab + (x.lt ? " · " + x.lt + " atras." : ""),
          av: "width:28px;height:28px;border-radius:9999px;display:grid;place-items:center;font-size:10px;font-weight:500;background:" + (x.p === EU ? "#12171d;color:#fff" : "#eeeff3;color:#4a5560"),
          barA: "display:block;height:100%;width:" + ((x.ab - x.lt) / mx * 100) + "%;background:#12171d;transition:width .7s cubic-bezier(.16,1,.3,1)", barL: "display:block;height:100%;width:" + (x.lt / mx * 100) + "%;background:#fe4f2b;transition:width .7s cubic-bezier(.16,1,.3,1)" }; })
    };
    Object.assign(ov, (() => {
      const N = 30, dia = (i) => new Date(H0.getTime() - (N - 1 - i) * 864e5), mesma = (a2, b2) => a2 && a2.toDateString() === b2.toDateString();
      const base2 = todas.filter(noEscopo);
      const criadas = Array.from({ length: N }, (_, i) => base2.filter(x => mesma(x.ini || x.fim, dia(i))).length);
      const conc = Array.from({ length: N }, (_, i) => base2.filter(x => x.situacao === "Feita" && mesma(x.fim, dia(i))).length);
      const mx = Math.max(4, Math.max.apply(null, criadas.concat(conc))) * 1.15;
      const X = (i) => i / (N - 1) * 600, Y = (v) => 168 - v / mx * 160;
      const liso = (arr) => arr.map((v, i) => i ? "C" + ((X(i - 1) + X(i)) / 2).toFixed(1) + " " + Y(arr[i - 1]).toFixed(1) + " " + ((X(i - 1) + X(i)) / 2).toFixed(1) + " " + Y(v).toFixed(1) + " " + X(i).toFixed(1) + " " + Y(v).toFixed(1) : "M0 " + Y(v).toFixed(1)).join(" ");
      const spark = (arr) => { const m = Math.max(1, Math.max.apply(null, arr)); return arr.map((v, i) => (i ? "L" : "M") + (i / (arr.length - 1) * 100).toFixed(1) + " " + (24 - v / m * 20).toFixed(1)).join(" "); };
      const sem = (fn) => Array.from({ length: 8 }, (_, w) => base2.filter(x => fn(x) && x.fim && x.fim >= new Date(H0.getTime() - (7 - w + 1) * 7 * 864e5) && x.fim < new Date(H0.getTime() - (7 - w) * 7 * 864e5 + 864e5)).length);
      const dPct = (arr) => { const a3 = arr[arr.length - 1], b3 = arr[arr.length - 2]; return b3 ? Math.round((a3 / b3 - 1) * 100) : (a3 ? 100 : 0); };
      const K = [["Em aberto", String(abertosM.length), "minhas pendentes", "M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "#4a5560", "#eeeff3", sem(x => aberta2(x) && meu(x)), () => this.setState({ visao: "lista", escopo: "minhas", rapido: null })],
        ["Concluídas na semana", String(meus.filter(x => x.situacao === "Feita" && x.fim && x.fim >= new Date(H0.getTime() - 6 * 864e5)).length), "vs. semana anterior", "M20 6 9 17l-5-5", "#1f7256", "#e6f4ee", sem(x => x.situacao === "Feita" && meu(x)), () => this.setState({ visao: "quadro", escopo: "minhas" })],
        ["Atrasadas", String(atrasM.length), atrasM.length ? "precisam de atenção" : "nada atrasado", "M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "#c2330f", "#fdeeea", sem(x => atrasada(x) && meu(x)), () => this.setState({ visao: "lista", escopo: "minhas", rapido: "atrasadas" })],
        ["Feitas no mês", String(feitosM.length), pctMes + "% do mês concluído", "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "#2c5f9e", "#e8f0fb", sem(x => x.situacao === "Feita" && meu(x)), () => this.setState({ visao: "quadro", escopo: "minhas" })],
        ["Em andamento", String(meus.filter(x => x.situacao === "Em andamento").length), "com você agora", "M21 12a9 9 0 1 1-6.2-8.6", "#4f3fa8", "#efecfa", sem(x => x.situacao === "Em andamento" && meu(x)), () => this.setState({ visao: "quadro", escopo: "minhas" })],
        ["Marcos no mês", String(marcos.length), "reuniões e propostas", "M5 21V4h11l-2 4 2 4H7", "#6e5420", "#f7edd8", sem(x => (x.tipo === "Reunião" || x.tipo === "Proposta") && meu(x)), () => this.setState({ visao: "lista", escopo: "minhas" })]];
      const TPS = Object.keys(TIPOS).map(t => [t, abertosM.filter(x => x.tipo === t).length]).filter(x => x[1]).sort((a2, b2) => b2[1] - a2[1]);
      const totD = Math.max(1, abertosM.length); let acc = 0;
      const VNC = [["Sem vínculo", x => !x.empresa && !x.pessoa && !x.oppRot && !x.leadId, "M18 6 6 18M6 6l12 12"], ["Oportunidade", x => !!x.oppRot, "M12 2v20M17 6H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"], ["Lead", x => !!x.leadId, "M22 12h-4l-3 9L9 3l-3 9H2"], ["Pessoa", x => !!x.pessoa && !x.oppRot && !x.leadId, "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"], ["Empresa", x => !!x.empresa && !x.pessoa && !x.oppRot, "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4"]].map(([l, fn, d]) => [l, abertosM.filter(fn).length, d]);
      const mxV = Math.max(1, Math.max.apply(null, VNC.map(v => v[1])));
      const mv = S.mesCal || 0, m0 = new Date(H0.getFullYear(), H0.getMonth() + mv, 1), off = m0.getDay(), nd = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate();
      const dSel = S.diaSel ? this.deIso(S.diaSel) : H0;
      const cel = Array.from({ length: Math.ceil((off + nd) / 7) * 7 }, (_, i) => { const d = new Date(m0.getFullYear(), m0.getMonth(), i - off + 1); const fora = d.getMonth() !== m0.getMonth(), hj = mesma(d, H0), sel = mesma(d, dSel);
        const tem = meus.some(x => mesma(x.fim, d) && aberta2(x)), reu = todas.concat(D.REUNIOES || []).some(x => x.tipo === "Reunião" && mesma(x.ini || x.fim, d));
        return { n: String(d.getDate()), onClick: () => this.setState({ diaSel: this.fmtIso(d) }),
          style: "justify-self:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:38px;height:38px;border-radius:9999px;border:0;cursor:pointer;font-size:13px;font-variant-numeric:tabular-nums;font-weight:" + (hj || sel ? "700" : "500") + ";" + (hj ? "background:#fe4f2b;color:#fff" : sel ? "background:#12171d;color:#fff" : "background:transparent;color:" + (fora ? "#c4c9ca" : "#1f252c")),
          dot: "width:4px;height:4px;border-radius:9999px;background:" + (reu ? (hj || sel ? "#fff" : "#fe4f2b") : tem ? (hj || sel ? "rgba(255,255,255,.7)" : "#a3a8a4") : "transparent") }; });
      const larg2 = S.larg >= 1180;
      return {
        kpis2: K.map(([l, v, sub, d, c2, bg, arr, on]) => { const dp = dPct(arr); return { l, v, sub, d, onClick: on, spark: spark(arr), cor: c2, ico: "flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:" + bg + ";color:" + c2,
          delta: (dp > 0 ? "↑ " : dp < 0 ? "↓ " : "") + Math.abs(dp) + "%", dStyle: "font-size:11px;font-weight:500;padding:2px 6px;border-radius:9999px;" + (dp > 0 ? "background:#e6f4ee;color:#1f7256" : dp < 0 ? "background:#fdeeea;color:#c2330f" : "background:#eeeff3;color:#8b949e") }; }),
        cVol: "grid-column:" + (larg2 ? "span 7" : "1 / -1"), cDon: "grid-column:" + (larg2 ? "span 5" : "1 / -1"),
        volLinhaA: liso(criadas), volAreaA: liso(criadas) + " L600 170 L0 170 Z", volLinhaB: liso(conc), volAreaB: liso(conc) + " L600 170 L0 170 Z",
        volEixo: [0, 7, 14, 21, 29].map(i => dia(i).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")),
        donTot: String(abertosM.length),
        donut: TPS.map(([t, n]) => { const pc = n / totD * 100, o = { l: t, n: String(n), p: Math.round(pc) + "%", cor: tipoDe(t)[1], da: Math.max(0.01, pc - 1) + " " + (100 - pc + 1), off: String(-acc), dot: "width:9px;height:9px;border-radius:3px;background:" + tipoDe(t)[1] }; acc += pc; return o; }),
        vincs: VNC.map(([l, n, d]) => ({ l, n: String(n), d, bar: "display:block;height:100%;border-radius:9999px;background:#fe4f2b;width:" + (n / mxV * 100) + "%;transition:width .6s cubic-bezier(.16,1,.3,1)" })),
        pergunta: S.pergunta || "", setPergunta: (e) => this.setState({ pergunta: e.target.value }),
        perguntar: () => { const q2 = (S.pergunta || "").trim(); this.nexo(q2); this.setState({ pergunta: "" }); },
        teclaPergunta: (e) => { if (e.key === "Enter") { e.preventDefault(); const q2 = (S.pergunta || "").trim(); this.nexo(q2); this.setState({ pergunta: "" }); } },
        sugestoes: [atrasM.length ? ["Você tem " + atrasM.length + (atrasM.length > 1 ? " atividades atrasadas" : " atividade atrasada") + ". Quer que eu reorganize a agenda?", "Redistribui os prazos pela prioridade", "M3 12h18M3 6h18M3 18h12", () => ov.comandos[0].onClick()] : null,
          ["Priorizar o que está vencendo", "Passa as atrasadas para prioridade alta", "M5 21V4h11l-2 4 2 4H7", () => ov.comandos[1].onClick()],
          ["Empurrar o que é baixa prioridade para amanhã", "Libera o seu dia de hoje", "M5 12h14M13 6l6 6-6 6", () => ov.comandos[2].onClick()],
          nexoIt.length ? [nexoIt[0].titulo, nexoIt[0].nexoMotivo || "Criada pelo NEXO", "M13 2 3 14h9l-1 8 10-12h-9z", () => this.setState({ aberta: nexoIt[0].key, subAberta: null })] : null].filter(Boolean).map(([t, s2, d, onClick]) => ({ t, s: s2, d, onClick })),
        mesTxt: m0.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, c3 => c3.toUpperCase()),
        mesAnt: () => this.setState({ mesCal: mv - 1 }), mesProx: () => this.setState({ mesCal: mv + 1 }),
        semCab: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], cal: cel
      };
    })());

    const FAMp = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
    const meuX = (x) => (x.assignees && x.assignees.length ? x.assignees.indexOf(EU) >= 0 : x.resp === EU);
    const filhosDe = (p) => todas.filter(x => x.projetoId === p.id);
    const progDe = (p) => { const f = filhosDe(p), d = f.filter(x => x.situacao === "Feita").length; return { n: f.length, d, pct: f.length ? Math.round(d / f.length * 100) : 0, late: f.filter(atrasada).length }; };
    const avP = (n) => "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:500;margin-left:-5px;box-shadow:0 0 0 2px #fff;" + (n === EU ? "background:#12171d;color:#fff" : "background:#e3e7e8;color:#4a5560");
    const dCurta = (d) => d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "";
    const barraP = (pct) => "display:block;height:100%;border-radius:9999px;width:" + pct + "%;background:" + (pct === 100 ? "#1f7256" : "#fe4f2b") + ";transition:width .6s cubic-bezier(.16,1,.3,1)";
    const respsP = (p) => (p.assignees && p.assignees.length ? p.assignees : [p.resp]).filter(Boolean).slice(0, 4).map(n => ({ n, ini: ini(n), av: avP(n) }));
    const projVis = projs.filter(p => p.situacao !== "Declinada" && (S.escopo !== "minhas" || (p.assignees || [p.resp]).indexOf(EU) >= 0 || filhosDe(p).some(meuX)));
    const novoProjeto = () => { const d = new Date(H0); d.setDate(d.getDate() + 14); this.setState({ pj: { passo: 1, filtro: "todos", busca: "", sel: [], oppId: "", titulo: "", desc: "", resps: [EU], iniD: this.fmtIso(H0), fimD: this.fmtIso(d), prioridade: "Média", tipoSub: "Tarefa", prefixo: "", subs: [], erro: null } }); };
    Object.assign(ov, {
      pjN: String(projVis.length), semPj: !projVis.length,
      projetos: projVis.map(p => { const g = progDe(p); return { titulo: p.titulo, txt: g.d + "/" + g.n, barra: barraP(g.pct),
        prazo: p.fim ? "até " + dCurta(p.fim) : "Sem prazo", prazoStyle: "flex:0 0 auto;font-size:11.5px;font-weight:500;white-space:nowrap;color:" + (p.fim && p.fim < agora && g.pct < 100 ? "#c2330f" : "#8b949e"),
        resps: respsP(p), sub: g.pct + "% concluído", temAtraso: g.late > 0, atraso: g.late + (g.late > 1 ? " atrasadas" : " atrasada"),
        abrir: () => this.setState({ visao: "quadro", projeto: p.id, rapido: null }) }; }),
      novaReu: () => E && E.abrir("novaReuniao", { data: S.diaSel && S.diaSel >= this.fmtIso(H0) ? S.diaSel : this.fmtIso(H0) })
    });

    const radar = (id, eixos, series, dicaS) => {
      const n = eixos.length, C = 120, R = 74, ang = (i) => -Math.PI / 2 + i * 2 * Math.PI / n;
      const pt = (i, r) => [C + Math.cos(ang(i)) * r, C + Math.sin(ang(i)) * r], f1 = (v) => v.toFixed(1);
      const caminho = (ps) => ps.map((p, i) => (i ? "L" : "M") + f1(p[0]) + " " + f1(p[1])).join(" ") + "Z";
      const linha = (i, r) => { const p = pt(i, r); return "M120 120L" + f1(p[0]) + " " + f1(p[1]); };
      const off = (S.rdOff || {})[id] || {}, vivas = series.filter(x => !off[x.k]);
      const mx = Math.max(1, Math.max.apply(null, series.reduce((a, x) => a.concat(x.v), [0])));
      const hv = S.rdHv && S.rdHv.id === id ? S.rdHv.i : null;
      const raio = (v) => v ? 8 + Math.sqrt(v / mx) * (R - 8) : 4;
      const pts = (x) => x.v.map((v, i) => pt(i, raio(v)));
      const dot = (c, o) => "flex:0 0 auto;width:9px;height:9px;border-radius:3px;background:" + c + (o ? ";opacity:" + o : "");
      const ph = hv != null ? pt(hv, R + 2) : null;
      return {
        grade: [1 / 3, 2 / 3, 1].map(f => caminho(eixos.map((_, i) => pt(i, R * f)))).join(" "),
        raios: eixos.map((_, i) => linha(i, R)).join(" "), raioOn: hv != null ? linha(hv, R) : "M120 120",
        series: vivas.map(x => ({ d: caminho(pts(x)), cor: x.cor, fo: x.fo, so: x.so })),
        pontos: vivas.filter(x => x.dots).reduce((a, x) => a.concat(pts(x).map((p, i) => ({ x: f1(p[0]), y: f1(p[1]), r: hv === i ? "5" : "3.5", cor: x.cor }))), []),
        rotulos: eixos.map((e, i) => { const p = pt(i, R + 11), c = Math.cos(ang(i)); return { t: e.l, s: "position:absolute;pointer-events:none;white-space:nowrap;font-size:11.5px;line-height:1;left:" + (p[0] / 240 * 100).toFixed(1) + "%;top:" + (p[1] / 240 * 100).toFixed(1) + "%;transform:translate(" + (Math.abs(c) < 0.2 ? "-50%" : c > 0 ? "0" : "-100%") + ",-50%);font-weight:" + (hv === i ? "600;color:#12171d" : "500;color:#8b949e") }; }),
        alvos: eixos.map((_, i) => { const a1 = pt(i - 0.5, R + 30), a2 = pt(i + 0.5, R + 30), tp = pt(i, R + 34);
          return { d: "M120 120L" + f1(a1[0]) + " " + f1(a1[1]) + "L" + f1(tp[0]) + " " + f1(tp[1]) + "L" + f1(a2[0]) + " " + f1(a2[1]) + "Z", entrar: () => { if (!S.rdHv || S.rdHv.id !== id || S.rdHv.i !== i) this.setState({ rdHv: { id, i } }); } }; }),
        sair: () => this.setState({ rdHv: null }),
        temDica: hv != null, dicaT: hv != null ? eixos[hv].t : "", dica: hv != null ? dicaS.map(x => ({ l: x.l, v: String(x.v[hv]), dot: dot(x.cor, x.op) })) : [],
        dicaPos: ph ? "position:absolute;z-index:3;pointer-events:none;left:" + (ph[0] / 240 * 100).toFixed(1) + "%;top:" + (ph[1] / 240 * 100).toFixed(1) + "%;transform:translate(" + (ph[0] > 125 ? "calc(-100% - 8px)" : ph[0] < 115 ? "8px" : "-50%") + "," + (ph[1] > 150 ? "calc(-100% - 8px)" : ph[1] < 90 ? "8px" : "-50%") + ");min-width:160px;padding:9px 11px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px #e3e7e8,0 14px 30px -14px rgba(18,23,29,.4)" : "display:none",
        legenda: series.map(x => { const des = !!off[x.k]; return { l: x.l, dot: dot(des ? "#c4c9ca" : x.cor, des ? null : x.lo),
          onClick: () => this.setState(st => { const o = Object.assign({}, st.rdOff || {}); o[id] = Object.assign({}, o[id] || {}, { [x.k]: !des }); return { rdOff: o }; }),
          style: "display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;cursor:pointer;font-size:12px;white-space:nowrap;color:" + (des ? "#a3a8a4;text-decoration:line-through" : "#4a5560") }; })
      };
    };
    const dRef = S.diaSel ? this.deIso(S.diaSel) : H0, sIni = new Date(dRef.getFullYear(), dRef.getMonth(), dRef.getDate()); sIni.setDate(sIni.getDate() - ((sIni.getDay() + 6) % 7));
    const mesmoD = (a2, b2) => a2 && a2.toDateString() === b2.toDateString();
    const dW = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(sIni.getTime() + i * 864e5));
    const SER = [["and", "Em andamento", "#12171d", false, (x) => aberta2(x) && !atrasada(x)], ["con", "Concluídas", "#1f7256", true, (x) => x.situacao === "Feita"], ["atr", "Atrasadas", "#fe4f2b", false, atrasada]];
    const mvR = S.mesCal || 0, mI = new Date(H0.getFullYear(), H0.getMonth() + mvR, 1), mF = new Date(H0.getFullYear(), H0.getMonth() + mvR + 1, 1);
    const TX = ["Ligação", "Mensagem", "E-mail", "Follow up", "Reunião", "Proposta", "Tarefa"], DSL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const valS = (fn) => dW.map(d => base.filter(x => mesmoD(x.fim, d) && fn(x)).length);
    const valM = (fn) => TX.map(t => base.filter(x => x.tipo === t && x.fim && x.fim >= mI && x.fim < mF && fn(x)).length);
    const dicaDe = (val) => SER.map(([k, l, cor, , fn]) => ({ k, l, cor, v: val(fn) }));
    const desenho = (val) => [{ k: "tot", l: "Planejadas", cor: "#fe4f2b", fo: ".2", so: ".45", lo: ".35", v: val(() => true) }, { k: "con", l: "Concluídas", cor: "#fe4f2b", fo: ".85", so: "1", dots: true, v: val((x) => x.situacao === "Feita") }];
    const soma = (arr) => arr.reduce((a, b) => a + b, 0);
    const escT = S.escopo === "minhas" ? ["Minha semana", "Meu mês"] : S.escopo === "equipe" ? ["Semana da equipe", "Mês da equipe"] : ["Semana de todos", "Mês de todos"];
    const UP = "M22 7l-8.5 8.5-5-5L2 17M16 7h6v6", DN = "M22 17l-8.5-8.5-5 5L2 7M16 17h6v-6";
    const mk = (id, eixos, val, titulo, desc, periodo) => { const tot = soma(val(() => true)), con = soma(val((x) => x.situacao === "Feita")), atr = soma(val(atrasada)), pc = tot ? Math.round(con / tot * 100) : 0;
      return Object.assign(radar(id, eixos, desenho(val), dicaDe(val)), { titulo, desc, periodo,
        rodape: con + " de " + tot + " concluídas · " + pc + "%" + (atr ? " · " + atr + (atr > 1 ? " atrasadas" : " atrasada") : ""),
        trendD: atr ? DN : UP, trendStyle: "display:inline-flex;color:" + (atr ? "#c2330f" : "#fe4f2b") }); };
    const cap = (t) => t.replace(/^./, c => c.toUpperCase());
    (() => { const L = ov.reunioes || [], hojeSel = !S.diaSel || S.diaSel === this.fmtIso(H0);
      const D0 = hojeSel ? L.find(r => !r._res && r._fim >= agora) : null;
      ov.temDestaque = !!D0;
      if (D0) { const mins = Math.round((D0._ini - agora) / 6e4), ja = mins <= 0;
        ov.dst = { titulo: D0.titulo, sub: [D0.sub, D0._fmt].filter(Boolean).join(" · "), faixa: this.fmtH(D0._ini) + " – " + this.fmtH(Object.assign(new Date(D0._fim), { _h: true })), abrir: D0.abrir, entrar: D0.entrar, temEntrar: D0._fmt === "Vídeo",
          quando: ja ? "Acontecendo agora" : mins < 60 ? "Em " + mins + " min" : "Próxima · " + this.fmtH(D0._ini), part: (D0.part || []).slice(0, 4),
          pill: "display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:9999px;font-size:11px;font-weight:500;" + (ja ? "background:#fe4f2b;color:#fff" : "background:rgba(255,255,255,.1);color:#fff") }; }
      else ov.dst = { part: [] };
      ov.reuLista = L.filter(r => r !== D0).map(r => ({ abrir: r.abrir, titulo: r.titulo, h: this.fmtH(r._ini) || "Dia", fimH: r._fim ? this.fmtH(Object.assign(new Date(r._fim), { _h: true })) : "", sub2: [r.sub, r._fmt].filter(Boolean).join(" · "), temRes: !!r._res, res: r._res || "",
        resStyle: "flex:0 0 auto;align-self:center;height:20px;padding:0 7px;border-radius:9999px;display:inline-flex;align-items:center;font-size:10.5px;font-weight:500;" + (r._res === "Realizada" ? "background:#e6f4ee;color:#1f7256" : "background:#fdeeea;color:#c2330f"),
        hStyle: "font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;color:" + (r._passou || r._res ? "#a3a8a4" : "#12171d"),
        barra: "flex:0 0 3px;width:3px;border-radius:9999px;background:" + (r._res || r._passou ? "#e3e7e8" : "#fe4f2b"),
        tStyle: "display:block;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (r._passou || r._res ? "#8b949e" : "#12171d") })); })();
    ov.radares = [
      mk("sem", dW.map((d, i) => ({ l: DSL[i], t: cap(d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).replace(".", "")) })), valS, escT[0], "Atividades com prazo em cada dia", dCurta(dW[0]) + " – " + dCurta(dW[6])),
      mk("mes", TX.map(t => ({ l: t, t })), valM, escT[1], "Atividades do mês por tipo", cap(mI.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })))
    ];

    (() => { const r1 = ov.radares[1]; r1.ehRadar = false; r1.ehLista = true;
      const offL = (S.rdOff || {}).mesl || {}, SM = dicaDe(valM).map(x => Object.assign({}, x, { off: !!offL[x.k] }));
      const g = (k) => SM.find(x => x.k === k), tot = TX.map((_, i) => SM.reduce((a, x) => a + (x.off ? 0 : x.v[i]), 0)), soma = tot.reduce((a, b) => a + b, 0), mxL = Math.max(1, Math.max.apply(null, tot));
      const w = (k, i) => { const x = g(k); return x.off ? 0 : x.v[i] / mxL * 100; };
      const seg = (c, n) => "flex:" + n + " 0 0;background:" + c + ";transition:flex .5s cubic-bezier(.16,1,.3,1)" + (n ? "" : ";display:none");
      r1.seg = ["con", "and", "atr"].map(k => { const x = g(k), n = x.off ? 0 : x.v.reduce((a, b) => a + b, 0); return { t: x.l + ": " + n, s: seg(x.cor, n) }; });
      r1.linhas = TX.map((t, i) => ({ t, i })).filter(o => tot[o.i] > 0).sort((a, b) => tot[b.i] - tot[a.i]).map(({ t, i }) => ({ l: t, d: tipoDe(t)[0], txt: g("con").v[i] + "/" + tot[i], pct: Math.round(tot[i] / Math.max(1, soma) * 100) + "%",
        bCon: "display:block;height:100%;width:" + w("con", i) + "%;background:#fe4f2b;transition:width .5s", bAnd: "display:block;height:100%;width:" + w("and", i) + "%;background:#12171d;transition:width .5s", bAtr: "display:block;height:100%;width:" + w("atr", i) + "%;background:#c2330f;transition:width .5s" }));
      r1.semLinhas = !r1.linhas.length; r1.desc = "Total do mês por situação e por tipo";
      const noM = base.filter(x => x.fim && x.fim >= mI && x.fim < mF), totR = noM.length, hvR = S.rosHv;
      const RS = [["A fazer", "A fazer", "#c4c9ca"], ["Em andamento", "Em andamento", "#12171d"], ["Aguardando", "Aguardando", "#67787c"], ["Feita", "Concluídas", "#fe4f2b"], ["Declinada", "Declinadas", "#f0c3b6"]];
      let accR = 0;
      r1.ros = RS.map(([k, l, cor], i) => { const n = noM.filter(x => x.situacao === k).length, pc = totR ? n / totR * 100 : 0, len = Math.max(0, pc - (n && n < totR ? 1 : 0)), o = { l, n: String(n), p: Math.round(pc) + "%", cor,
          sw: hvR === i ? "6.6" : "5.2", da: len.toFixed(2) + " " + (100 - len).toFixed(2), off: String(-accR), entrar: () => { if (this.state.rosHv !== i) this.setState({ rosHv: i }); },
          dot: "flex:0 0 auto;width:9px;height:9px;border-radius:3px;background:" + cor,
          row: "display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:7px;cursor:default;background:" + (hvR === i ? "#f6f6f3" : "transparent") + ";opacity:" + (hvR != null && hvR !== i ? ".55" : "1") }; accR += pc; return o; });
      r1.rosN = hvR != null ? r1.ros[hvR].n : String(totR); r1.rosL = hvR != null ? r1.ros[hvR].l : (totR === 1 ? "atividade no mês" : "atividades no mês");
      r1.rosSair = () => this.setState({ rosHv: null });
      r1.legenda = SM.map(x => ({ l: x.l, dot: "flex:0 0 auto;width:9px;height:9px;border-radius:3px;background:" + (x.off ? "#c4c9ca" : x.cor),
        onClick: () => this.setState(st => { const o = Object.assign({}, st.rdOff || {}); o.mesl = Object.assign({}, o.mesl || {}, { [x.k]: !x.off }); return { rdOff: o }; }),
        style: "display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;cursor:pointer;font-size:12px;white-space:nowrap;color:" + (x.off ? "#a3a8a4;text-decoration:line-through" : "#4a5560") }));
    })();
    (() => { const r0 = ov.radares[0]; r0.ehBarra = true; r0.desc = "Planejadas x concluídas por dia"; r0.legenda = [];
      const plan = valS(() => true), conc = valS((x) => x.situacao === "Feita"), atr = valS(atrasada), and = valS((x) => aberta2(x) && !atrasada(x));
      const mx = Math.max(2, Math.max.apply(null, plan)) * 1.15, X = (i) => 50 + i * 100, Y = (v) => 160 - v / mx * 140;
      const curva = (arr) => arr.map((v, i) => i ? "C" + (X(i - 1) + 50) + " " + Y(arr[i - 1]).toFixed(1) + " " + (X(i) - 50) + " " + Y(v).toFixed(1) + " " + X(i) + " " + Y(v).toFixed(1) : "M" + X(0) + " " + Y(v).toFixed(1)).join(" ");
      const area = (arr) => "M0 " + Y(arr[0]).toFixed(1) + " L" + curva(arr).slice(1) + " L700 " + Y(arr[6]).toFixed(1) + " L700 170 L0 170 Z";
      r0.planL = "M0 " + Y(plan[0]).toFixed(1) + " L" + curva(plan).slice(1) + " L700 " + Y(plan[6]).toFixed(1); r0.planA = area(plan);
      r0.concL = "M0 " + Y(conc[0]).toFixed(1) + " L" + curva(conc).slice(1) + " L700 " + Y(conc[6]).toFixed(1); r0.concA = area(conc);
      const hv = S.rdHv && S.rdHv.id === "sem" ? S.rdHv.i : null, hi = dW.findIndex(d => d.toDateString() === H0.toDateString());
      const pct = (y) => (y / 180 * 170 / 190 * 100).toFixed(2) + "%";
      const pt = (i, v, cor, big) => "position:absolute;z-index:2;pointer-events:none;left:" + ((i + .5) / 7 * 100).toFixed(2) + "%;top:calc(" + pct(Y(v)) + " - " + (big ? 6 : 4) + "px);width:" + (big ? 12 : 8) + "px;height:" + (big ? 12 : 8) + "px;margin-left:-" + (big ? 6 : 4) + "px;border-radius:9999px;background:" + cor + ";box-shadow:0 0 0 " + (big ? 3 : 2) + "px #fff";
      r0.pts = [].concat(conc.map((v, i) => ({ s: pt(i, v, "#fe4f2b", hv === i) })), atr.map((v, i) => v ? { s: pt(i, plan[i], "#c2330f", hv === i) } : null).filter(Boolean), hv != null ? [{ s: pt(hv, plan[hv], "#12171d", true) }] : []);
      r0.cruz = hv != null ? "position:absolute;z-index:1;top:0;height:170px;width:1px;background:#12171d;opacity:.25;left:" + ((hv + .5) / 7 * 100).toFixed(2) + "%" : "display:none";
      r0.hojeBand = hi >= 0 ? "position:absolute;top:0;height:170px;border-radius:10px;background:#fff6f4;left:" + (hi / 7 * 100).toFixed(2) + "%;width:" + (100 / 7).toFixed(2) + "%" : "display:none";
      r0.cols = dW.map((d, i) => ({ l: DSL[i] + " " + d.getDate(), entrar: () => { if (!S.rdHv || S.rdHv.id !== "sem" || S.rdHv.i !== i) this.setState({ rdHv: { id: "sem", i } }); },
        lStyle: "flex:1;min-width:0;text-align:center;font-size:11.5px;white-space:nowrap;font-weight:" + (i === hi ? "700;color:#c2330f" : hv === i ? "700;color:#12171d" : "500;color:#8b949e") }));
      const dot = (c) => "flex:0 0 auto;width:8px;height:8px;border-radius:3px;background:" + c;
      r0.dica = hv != null ? [["Planejadas", plan[hv], "#12171d"], ["Concluídas", conc[hv], "#fe4f2b"], ["Em andamento", and[hv], "#67787c"], ["Atrasadas", atr[hv], "#c2330f"]].map(([l, v, c]) => ({ l, v: String(v), dot: dot(c) })) : [];
      r0.dicaPos = hv != null ? "position:absolute;z-index:3;pointer-events:none;top:6px;left:" + ((hv + .5) / 7 * 100).toFixed(2) + "%;transform:translateX(" + (hv <= 1 ? "12px" : hv >= 5 ? "calc(-100% - 12px)" : "12px") + ");min-width:170px;padding:9px 11px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px #e3e7e8,0 14px 30px -14px rgba(18,23,29,.4)" : "display:none";
      const sum = (a) => a.reduce((p, q) => p + q, 0), vS = (c) => "display:block;margin-top:4px;font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums;color:" + c;
      r0.stats = [["Concluídas", sum(conc), "#fe4f2b", "#12171d"], ["Planejadas", sum(plan), "#12171d", "#12171d"], ["Atrasadas", sum(atr), "#c2330f", sum(atr) ? "#c2330f" : "#12171d"]].map(([l, v, c, vc]) => ({ l, v: String(v), dot: dot(c), vStyle: vS(vc) }));
      const r1 = ov.radares[1]; r1.legenda = []; r1.desc = "Situação das atividades do mês";
      const fe = r1.ros.find(x => x.l === "Concluídas"), totM2 = r1.ros.reduce((a, x) => a + (+x.n), 0), hvR = S.rosHv;
      let acc2 = 0; r1.arcos = r1.ros.map((ro, i) => { const n = +ro.n, pc = totM2 ? n / totM2 * 100 : 0, len = Math.max(0, pc - (n && n < totM2 ? 1.2 : 0)), o = { cor: ro.cor, sw: hvR === i ? "24" : "20", da: len.toFixed(2) + " " + (100 - len + 1).toFixed(2), off: String(-acc2), entrar: ro.entrar }; acc2 += pc; return o; });
      r1.gN = hvR != null ? r1.ros[hvR].n : (totM2 ? Math.round((+fe.n) / totM2 * 100) : 0) + "%"; r1.gL = hvR != null ? r1.ros[hvR].l + " · " + r1.ros[hvR].p : (fe ? fe.n : 0) + " de " + totM2 + " concluídas";
      r1.linhas = r1.linhas.slice(0, 5);
    })();
    const PS = S.projeto ? projs.find(p => p.id === S.projeto) : null, gS = PS ? progDe(PS) : null;
    const pjSel = { on: !!PS, v: PS ? PS.id : "", valor: PS ? PS.titulo : "Todas as atividades", resps: PS ? respsP(PS) : [],
      opcoes: [{ v: "", l: "Todas as atividades" }].concat(projs.map(p => ({ v: p.id, l: p.titulo }))),
      set: (e) => this.setState({ projeto: e.target.value || null, rapido: null }), limpar: () => this.setState({ projeto: null }),
      anel: "inset 0 0 0 1px " + (S.pjMenu ? "#b8bfc0" : "#dbdede"),
      abrir: (e) => { const el = e.currentTarget.closest("[data-at-filtro]"), r = el ? el.getBoundingClientRect() : null; this.setState(s => ({ pjMenu: s.pjMenu ? null : (r ? { top: r.top, bottom: r.bottom, left: r.left } : { top: 100, bottom: 134, left: 20 }), filtroAberto: null })); },
      menu: !!S.pjMenu,
      pos: (() => { const r = S.pjMenu || { top: 100, bottom: 134, left: 20 }, vh = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerHeight : 900) : 800, vw = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1200, abx = vh - r.bottom - 12, acm = r.top - 12, cima = abx < 260 && acm > abx;
        return "position:fixed;z-index:70;width:300px;left:" + Math.max(8, Math.min(vw - 308, r.left)) + "px;" + (cima ? "bottom:" + (vh - r.top + 5) : "top:" + (r.bottom + 5)) + "px;max-height:" + Math.max(180, Math.min(440, cima ? acm : abx)) + "px;overflow-y:auto;border-radius:10px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 10px 26px -6px rgba(0,0,0,.2);padding:5px"; })(),
      nTodas: String(todas.filter(x => noEscopo(x) && aberta2(x)).length),
      todasCaixa: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;" + (!PS ? "background:#fff;box-shadow:inset 0 0 0 5px #12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4"),
      todas: () => this.setState({ projeto: null, pjMenu: null }),
      semProj: !projs.length,
      itens: projs.map(p => { const g = progDe(p), on = PS && PS.id === p.id; return { l: p.titulo, txt: g.d + "/" + g.n, barra: barraP(g.pct), onClick: () => this.setState({ projeto: p.id, pjMenu: null, rapido: null }),
        caixa: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;align-self:flex-start;margin-top:1px;" + (on ? "background:#fff;box-shadow:inset 0 0 0 5px #12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4") }; }),
      novo: () => { this.setState({ pjMenu: null }); novoProjeto(); },
      pill: "position:relative;flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 11px;border-radius:9px;cursor:pointer;max-width:100%;" + (PS ? "background:#12171d;color:#fff" : "background:#fff;color:#12171d;box-shadow:inset 0 0 0 1px #dbdede"),
      lbl: "font-size:12.5px;font-weight:500;white-space:nowrap;color:" + (PS ? "#a3aab0" : "#67787c"),
      titulo: PS ? PS.titulo : "", sub: PS ? [PS.ini && PS.fim ? dCurta(PS.ini) + " – " + dCurta(PS.fim) : PS.fim ? "até " + dCurta(PS.fim) : null, gS.n + (gS.n === 1 ? " subtarefa" : " subtarefas"), gS.late ? gS.late + (gS.late > 1 ? " atrasadas" : " atrasada") : null].filter(Boolean).join(" · ") : "",
      pct: gS ? gS.pct + "%" : "", txt: gS ? gS.d + " de " + gS.n + " feitas" : "", barra: barraP(gS ? gS.pct : 0),
      addSub: () => PS && this.abrirEditor(null, { projetoId: PS.id, prioridade: PS.prioridade || "Média", fimD: this.fmtIso(PS.fim) || this.fmtIso(H0) }) };

    let pj = { aberto: false, passos: [], tiposAlvo: [], alvos: [], oppsOpc: [], equipe: [], prios: [], subs: [], tiposOpc: [], selChips: [], equipeOpc: [] };
    if (S.pj) { const PJ = S.pj, upP = (p) => this.setState(s => ({ pj: Object.assign({}, s.pj, { erro: null }, p) }));
      const AL = this.alvos(), byK = {}; AL.forEach(a => { byK[a.k] = a; });
      const FT = [["todos", "Todos", () => true], ["empresa", "Empresas", a => a.tipo === "empresa"], ["contato", "Contatos", a => a.tipo === "contato"], ["Lead", "Leads", a => a.rel === "Lead"], ["Cliente", "Clientes", a => a.rel === "Cliente"]];
      const fnF = (FT.find(f => f[0] === PJ.filtro) || FT[0])[2], qq = (PJ.busca || "").trim().toLowerCase();
      const visA = AL.filter(a => fnF(a) && (!qq || (a.nome + " " + a.sub).toLowerCase().indexOf(qq) >= 0));
      const togSel = (k) => upP({ sel: PJ.sel.indexOf(k) >= 0 ? PJ.sel.filter(x => x !== k) : PJ.sel.concat(k) });
      const oppsP = ((E && E.ler("opps", null)) || D.OPORTUNIDADES || []).filter(o => o.etapa !== "perdido");
      const REL = { Contato: ["#eeeff3", "#4a5560"], Prospect: ["#e8f0fb", "#2c5f9e"], Lead: ["#fff6f4", "#c2330f"], Cliente: ["#e6f4ee", "#1f7256"] };
      const IE = "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4", IC = "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z";
      const nomeSub = (a) => ((PJ.prefixo || PJ.titulo || "Projeto").trim()) + " · " + a.nome;
      const rsP = PJ.resps.length ? PJ.resps : [EU];
      const gerar = () => PJ.sel.filter(k => byK[k]).map((k, i) => ({ k, t: nomeSub(byK[k]), resp: rsP[i % rsP.length], fimD: PJ.fimD }));
      const avE = (n, on) => "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:500;" + (on ? "background:#fe4f2b;color:#fff" : n === EU ? "background:#12171d;color:#fff" : n ? "background:#e3e7e8;color:#4a5560" : "background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#a3a8a4");
      const erroDe = (n) => n === 1 ? (!PJ.sel.length ? "Selecione ao menos uma empresa ou contato." : "")
        : n === 2 ? (!PJ.titulo.trim() ? "Dê um nome para o projeto." : !PJ.resps.length ? "Escolha ao menos um responsável." : !PJ.fimD ? "Defina a data de fim." : PJ.iniD && PJ.fimD < PJ.iniD ? "O fim precisa ser depois do início." : "")
        : !PJ.subs.length ? "Nenhuma subtarefa para criar." : "";
      const criar = () => { const d = new Date(), hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"), id = "pj" + Date.now().toString(36), O = PJ.oppId ? oppsP.find(o => o.id === PJ.oppId) : null;
        const mae = { id, projeto: true, titulo: PJ.titulo.trim(), desc: (PJ.desc || "").trim(), tipo: "Projeto", area: "Comercial", situacao: "Em andamento", prioridade: PJ.prioridade, resp: PJ.resps[0], assignees: PJ.resps.slice(), criadoPor: EU, iniD: PJ.iniD, iniH: "", fimD: PJ.fimD, fimH: "", inicio: null, fim: null, sub: [], comentarios: [], oppId: O ? O.id : null, log: [{ autor: EU, texto: "criou o projeto com " + PJ.subs.length + " subtarefas", quando: "Hoje, " + hh }] };
        const fs = PJ.subs.map((sx, i) => { const a = byK[sx.k] || {}, naOpp = O && a.empresa === O.empresa;
          return { id: id + "-" + i, projetoId: id, titulo: (sx.t || "").trim() || nomeSub(a), desc: "", tipo: PJ.tipoSub, area: "Comercial", situacao: "A fazer", prioridade: PJ.prioridade, resp: sx.resp || null, assignees: sx.resp ? [sx.resp] : [], criadoPor: EU,
            iniD: PJ.iniD, iniH: "", fimD: sx.fimD || PJ.fimD, fimH: "", inicio: null, fim: null, empresa: a.empresa || null, pessoa: a.pessoa || null, vincTipo: a.tipo === "contato" ? "pessoa" : "empresa",
            oppId: naOpp ? O.id : null, oppRot: naOpp ? (FAMp[O.familia] || "") + " · " + O.empresa : null, sub: [], comentarios: [], log: [{ autor: EU, texto: "criou pelo projeto " + mae.titulo, quando: "Hoje, " + hh }] }; });
        this.gravarProprias(this.proprias().concat([mae], fs)); E && E.avisar("Projeto criado · " + fs.length + (fs.length > 1 ? " subtarefas" : " subtarefa"), "ok");
        this.setState({ pj: null, visao: "quadro", projeto: id, rapido: null }); };
      const avanca = () => { const er = erroDe(PJ.passo); if (er) return this.setState(s => ({ pj: Object.assign({}, s.pj, { erro: er }) })); if (PJ.passo === 1) return upP({ passo: 2 }); if (PJ.passo === 2) return upP({ passo: 3, subs: gerar() }); criar(); };
      const setSubP = (i, p) => upP({ subs: PJ.subs.map((x, j) => j === i ? Object.assign({}, x, p) : x) });
      const todosVis = visA.length > 0 && visA.every(a => PJ.sel.indexOf(a.k) >= 0);
      const O1 = PJ.oppId ? oppsP.find(o => o.id === PJ.oppId) : null;
      pj = { aberto: true, fechar: () => this.setState({ pj: null }), p1: PJ.passo === 1, p2: PJ.passo === 2, p3: PJ.passo === 3,
        passos: [["1", "Para quem"], ["2", "Dados"], ["3", "Subtarefas"]].map(([nn, l], i) => { const at = PJ.passo === i + 1, ok = PJ.passo > i + 1; return { n: ok ? "✓" : nn, l,
          dot: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:500;" + (at ? "background:#12171d;color:#fff" : ok ? "background:#1f7256;color:#fff" : "background:#eeeff3;color:#8b949e"),
          lStyle: "font-size:12.5px;white-space:nowrap;font-weight:" + (at ? "700;color:#12171d" : "500;color:#67787c"),
          linha: i < 2 ? "flex:1 1 24px;min-width:12px;max-width:64px;height:1.5px;background:" + (ok ? "#1f7256" : "#e3e7e8") : "display:none",
          onClick: () => { if (i + 1 < PJ.passo) upP({ passo: i + 1 }); } }; }),
        tiposAlvo: FT.map(([k, l, fn]) => { const on = (PJ.filtro || "todos") === k; return { l, n: String(AL.filter(fn).length), onClick: () => upP({ filtro: k }),
          style: "display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 6px 0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:500;white-space:nowrap;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
          nStyle: "min-width:20px;height:18px;padding:0 5px;border-radius:9999px;display:grid;place-items:center;font-size:10.5px;font-weight:500;" + (on ? "background:rgba(255,255,255,.18);color:#fff" : "background:#eeeff3;color:#67787c") }; }),
        busca: PJ.busca || "", setBusca: (e) => upP({ busca: e.target.value }),
        nVis: visA.length + (visA.length === 1 ? " encontrado" : " encontrados"), todosTxt: todosVis ? "Limpar visíveis" : "Selecionar visíveis",
        todos: () => upP({ sel: todosVis ? PJ.sel.filter(k => !visA.some(a => a.k === k)) : PJ.sel.concat(visA.map(a => a.k).filter(k => PJ.sel.indexOf(k) < 0)) }),
        alvos: visA.slice(0, 100).map(a => { const on = PJ.sel.indexOf(a.k) >= 0, rc = REL[a.rel] || REL.Contato; return { nome: a.nome, sub: a.sub, rel: a.rel, on, ico: a.tipo === "empresa" ? IE : IC, onClick: () => togSel(a.k),
          caixa: "flex:0 0 auto;width:18px;height:18px;border-radius:6px;display:grid;place-items:center;" + (on ? "background:#d93c1a" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4"),
          relStyle: "flex:0 0 auto;height:22px;padding:0 8px;border-radius:9999px;display:inline-flex;align-items:center;font-size:11px;font-weight:500;background:" + rc[0] + ";color:" + rc[1],
          style: "display:flex;align-items:center;gap:12px;width:100%;padding:9px 12px;border-radius:11px;border:0;cursor:pointer;text-align:left;" + (on ? "background:#fff6f4;box-shadow:inset 0 0 0 1px #f6d3c9" : "background:#fff;box-shadow:inset 0 0 0 1px #eef1f1") }; }),
        vazioA: !visA.length,
        oppV: PJ.oppId || "", oppL: O1 ? (FAMp[O1.familia] || "") + " · " + O1.empresa : "Partir de uma oportunidade",
        oppsOpc: [{ v: "", l: "Nenhuma oportunidade" }].concat(oppsP.map(o => ({ v: o.id, l: (FAMp[o.familia] || "") + " · " + o.empresa }))),
        setOpp: (e) => { const O = oppsP.find(o => o.id === e.target.value); if (!O) return upP({ oppId: "" }); const ks = ["e:" + O.empresa].concat((O.pessoas && O.pessoas.length ? O.pessoas : [{ nome: O.pessoa }]).map(p => "c:" + p.nome)).filter(k => byK[k]);
          upP({ oppId: O.id, sel: PJ.sel.concat(ks.filter(k => PJ.sel.indexOf(k) < 0)), titulo: PJ.titulo || "Plano de conta · " + O.empresa }); },
        temSel: PJ.sel.length > 0, selChips: PJ.sel.slice(0, 8).map(k => ({ l: (byK[k] || {}).nome || k, remover: () => togSel(k) })), temMaisSel: PJ.sel.length > 8, maisSel: "+" + (PJ.sel.length - 8),
        titulo: PJ.titulo, setTitulo: (e) => upP({ titulo: e.target.value }), desc: PJ.desc, setDesc: (e) => upP({ desc: e.target.value }),
        titInp: "width:100%;padding:4px 0;border:0;outline:0;background:transparent;font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;font-weight:800;letter-spacing:-.03em;color:#12171d;box-shadow:inset 0 -1.5px 0 " + (PJ.erro && !PJ.titulo.trim() ? "#d93c1a" : "#eef1f1"),
        equipe: equipe.map(nm => { const on = PJ.resps.indexOf(nm) >= 0; return { l: nm, ini: ini(nm), av: avE(nm, on), onClick: () => upP({ resps: on ? PJ.resps.filter(x => x !== nm) : PJ.resps.concat(nm) }),
          style: "flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 5px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:500;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") }; }),
        iniD: PJ.iniD, fimD: PJ.fimD, setIniD: (e) => upP({ iniD: e.target.value }), setFimD: (e) => upP({ fimD: e.target.value }),
        prios: ["Baixa", "Média", "Alta"].map(p => ({ l: p, onClick: () => upP({ prioridade: p }), style: "display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:500;" + (PJ.prioridade === p ? "background:" + PRIO[p] + ";color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") })),
        tipoSub: PJ.tipoSub, setTipoSub: (e) => upP({ tipoSub: e.target.value }), tiposOpc: Object.keys(TIPOS).map(t => ({ v: t, l: t })),
        prefixo: PJ.prefixo, setPrefixo: (e) => upP({ prefixo: e.target.value }), prefixoPh: PJ.titulo || "Ex.: Upsell",
        exemplo: "Vai ficar: " + nomeSub(byK[PJ.sel[0]] || { nome: "Empresa XPTO" }) + (PJ.sel.length > 1 ? " e mais " + (PJ.sel.length - 1) : ""),
        nSubs: PJ.subs.length + (PJ.subs.length === 1 ? " subtarefa" : " subtarefas"), tituloP: PJ.titulo,
        equipeOpc: [{ v: "", l: "Sem responsável" }].concat(equipe.map(nm => ({ v: nm, l: nm }))),
        subs: PJ.subs.map((sx, i) => { const a = byK[sx.k] || { nome: sx.k, tipo: "empresa" }; return { n: String(i + 1), t: sx.t, set: (e) => setSubP(i, { t: e.target.value }), alvo: a.nome + (a.tipo === "contato" && a.empresa ? " · " + a.empresa : ""), alvoD: a.tipo === "empresa" ? IE : IC,
          respV: sx.resp || "", respL: sx.resp || "Sem responsável", ini: sx.resp ? ini(sx.resp) : "+", av: avE(sx.resp, false), setResp: (e) => setSubP(i, { resp: e.target.value || null }),
          fimD: sx.fimD || "", fimTxt: sx.fimD ? sx.fimD.split("-").reverse().slice(0, 2).join("/") : "Prazo", setFim: (e) => setSubP(i, { fimD: e.target.value }), remover: () => upP({ subs: PJ.subs.filter((_, j) => j !== i) }) }; }),
        distribuir: () => { upP({ subs: PJ.subs.map((x, i) => Object.assign({}, x, { resp: rsP[i % rsP.length] })) }); E && E.avisar("Subtarefas distribuídas entre " + rsP.map(nm => nm.split(" ")[0]).join(", "), "ok"); },
        mesmoPrazo: () => upP({ subs: PJ.subs.map(x => Object.assign({}, x, { fimD: PJ.fimD })) }),
        temErro: !!PJ.erro, semErro: !PJ.erro, erro: PJ.erro || "",
        rodape: PJ.passo === 1 ? (PJ.sel.length ? PJ.sel.length + (PJ.sel.length > 1 ? " selecionados" : " selecionado") : "Escolha empresas, contatos, leads ou clientes") : PJ.passo === 2 ? PJ.sel.length + (PJ.sel.length > 1 ? " subtarefas serão geradas" : " subtarefa será gerada") : "Cada subtarefa fica vinculada ao seu alvo.",
        temVoltar: PJ.passo > 1, voltar: () => upP({ passo: PJ.passo - 1 }), avancar: avanca,
        avancarTxt: PJ.passo < 3 ? "Continuar" : "Criar projeto · " + PJ.subs.length + (PJ.subs.length === 1 ? " subtarefa" : " subtarefas") };
    }

    const dash = (() => {
      const Tp = (k) => (TIPOS[k] || TIPOS.Tarefa)[0];
      const TL = { ligacao: [Tp("Ligação"), "#1f7256", "#e6f4ee"], whatsapp: [Tp("Mensagem"), "#1f7256", "#e6f4ee"], email: [Tp("E-mail"), "#2c5f9e", "#e8f0fb"], etapa: ["M5 12h14M13 6l6 6-6 6", "#c2330f", "#fff6f4"], reuniao: [Tp("Reunião"), "#12171d", "#eeeff3"], proposta: [Tp("Proposta"), "#4f3fa8", "#efecfa"], concluiu: ["M20 6 9 17l-5-5", "#fff", "#1f7256"], nota: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", "#4a5560", "#eeeff3"], edicao: ["M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z", "#4a5560", "#eeeff3"] };
      const evs = [];
      (this.dadosDoProto.HistoricoSeed || []).forEach((h, i) => { const d = this.rel(h.quando); if (d && d <= agora) evs.push(Object.assign({}, h, { d, id: "s" + i })); });
      const hojeHM = (q) => { const m = /^Hoje,\s*(\d{1,2}):(\d{2})/.exec(q || ""); if (!m) return null; const d = new Date(H0); d.setHours(+m[1], +m[2]); return d; };
      todasR.forEach(x => (x.log || []).forEach((l, i) => { if (l.autor !== EU) return; const d = hojeHM(l.quando); if (!d || d > agora) return; const tx = String(l.texto || "");
        const t = /^(feito|concluiu|todas as subtarefas)/i.test(tx) ? "concluiu" : /reuni/i.test(tx) ? "reuniao" : /prazo|prioridade|início|editou/i.test(tx) ? "edicao" : "nota";
        evs.push({ t, acao: tx.replace(/^./, c => c.toUpperCase()), alvo: x.empresa && x.titulo.indexOf(x.empresa) < 0 ? x.titulo + " · " + x.empresa : x.titulo, d, key: x.key, id: "l" + x.key + i }); }));
      ((E && E.ler("opps", null)) || D.OPORTUNIDADES || []).forEach(o => (o.eventos || []).forEach((ev, i) => { if (ev.autor !== EU || ev.quando !== "Hoje") return; const tx = ev.t || "";
        evs.push({ t: /Movido|Ganho|Perdido|etapa/i.test(tx) ? "etapa" : /Reuni/i.test(tx) ? "reuniao" : /Proposta/i.test(tx) ? "proposta" : "nota", acao: tx, alvo: o.empresa + " · oportunidade", d: new Date(agora.getTime() - i * 6e4), empresa: o.empresa, opp: o.id, id: "o" + o.id + i }); }));
      const rotDia = (d) => { const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()), n = Math.round((H0 - dd) / 864e5); return n === 0 ? "Hoje" : n === 1 ? "Ontem" : cap(d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).replace(".", "")); };
      const FT = S.tlFiltro || "todos", GRP = { ligacao: ["ligacao"], etapa: ["etapa"], msg: ["whatsapp", "email"], reuniao: ["reuniao", "proposta"] };
      const lst = evs.filter(e => FT === "todos" || (GRP[FT] || []).indexOf(e.t) >= 0).sort((a, b) => b.d - a.d);
      const grupos = []; lst.forEach(e => { const l = rotDia(e.d); let g = grupos[grupos.length - 1]; if (!g || g.l !== l) { g = { l, it: [] }; grupos.push(g); } g.it.push(e); });
      const hm = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      const tl = grupos.map(g => ({ l: g.l, itens: g.it.map((e, i) => { const V = TL[e.t] || TL.nota; return { hora: hm(e.d), acao: e.acao, alvo: e.alvo || "", temMeta: !!e.meta, meta: e.meta || "", ico: V[0],
        icoStyle: "position:relative;z-index:1;width:30px;height:30px;border-radius:9999px;display:grid;place-items:center;background:" + V[2] + ";color:" + V[1] + ";box-shadow:0 0 0 3px #fff",
        linha: i < g.it.length - 1 ? "position:absolute;left:50%;top:30px;bottom:-20px;width:1.5px;margin-left:-.75px;background:#e3e7e8" : "display:none",
        ir: () => e.key ? this.setState({ aberta: e.key, subAberta: null }) : e.opp ? (E && E.irPara("/onface-preview/oportunidade", e.empresa, { opp: e.opp, ver: "" })) : (e.empresa && E ? E.irPara("/onface-preview/empresa", e.empresa, {}) : null) }; }) }));
      const hj = evs.filter(e => rotDia(e.d) === "Hoje"), cnt = (ts) => hj.filter(e => ts.indexOf(e.t) >= 0).length;
      const partes = [[cnt(["ligacao"]), "ligação", "ligações"], [cnt(["etapa"]), "avanço de etapa", "avanços de etapa"], [cnt(["whatsapp", "email"]), "mensagem", "mensagens"], [cnt(["concluiu"]), "entrega", "entregas"]].filter(p => p[0]).map(p => p[0] + " " + (p[0] > 1 ? p[2] : p[1]));
      const tlResumo = partes.length ? "Hoje você fez " + (partes.length > 1 ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1] : partes[0]) + "." : "Suas ligações, mensagens e avanços de etapa aparecem aqui.";
      const pill = (on) => "height:28px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;" + (on ? "background:#12171d;color:#fff" : "background:#f3f4f4;color:#4a5560");
      const tlFiltros = [["todos", "Tudo"], ["ligacao", "Ligações"], ["etapa", "Etapas"], ["msg", "Mensagens"], ["reuniao", "Reuniões"]].map(([k, l]) => ({ l, onClick: () => this.setState({ tlFiltro: k }), style: pill(FT === k) }));

      const late = base.filter(atrasada).sort((a, b) => a.fim - b.fim);
      const hojeAb = base.filter(x => aberta2(x) && !atrasada(x) && x.fim && x.fim < H1).sort((a, b) => a.fim - b.fim);
      const hojeFe = base.filter(x => x.situacao === "Feita" && x.fim && x.fim >= H0 && x.fim < H1);
      const d8 = new Date(H0.getTime() + 8 * 864e5);
      const prox = base.filter(x => aberta2(x) && x.fim && x.fim >= H1 && x.fim < d8).sort((a, b) => a.fim - b.fim);
      const ABAS = [["atrasadas", "Atrasadas", late], ["hoje", "Hoje", hojeAb], ["prox", "Próximos 7 dias", prox]];
      const aba = S.focoAba || (late.length ? "atrasadas" : "hoje"), lstF = (ABAS.find(a => a[0] === aba) || ABAS[1])[2];
      const leadsL = (E && E.ler("leads", null)) || D.LEADS || [];
      const refReu = (x) => x.src === "o" ? { src: "o", oppId: x.oppId, i: x.idx } : x.src === "p" ? { src: "p", id: x.id } : null;
      const acaoDe = (x) => {
        if (x.tipo === "Ligação") return ["Ligar", () => { const L = leadsL.find(l => l.id === x.leadId || (x.pessoa && l.pessoa === x.pessoa)); const tel = L && (L.tel || L.telefone); if (tel && E && E.abrirExterno) E.abrirExterno("https://app.callface.ai/calls?call_to=" + String(tel).replace(/\D/g, "")); else this.setState({ aberta: x.key, subAberta: null }); }];
        if (x.tipo === "Mensagem") return ["Abrir conversa", () => E && E.irPara("/atendimento", "Atendimento", {})];
        if (x.tipo === "Reunião" && refReu(x)) return ["Ver reunião", () => E && E.abrir("reuniao", refReu(x))];
        if (x.src === "l") return ["Abrir lead", () => E && E.abrir("detalhe", x.leadId)];
        return ["Abrir", () => this.setState({ aberta: x.key, subAberta: null })]; };
      const linha = (x) => { const c = card(x), T2 = tipoDe(x.tipo), lt = atrasada(x), ac = acaoDe(x);
        return Object.assign({}, c, { vincTxt: [x.tipo, c.temVinc ? c.vinc : null].filter(Boolean).join(" · "), acaoTxt: ac[0], acao: ac[1],
          icoBox: "flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:" + T2[2] + ";color:" + T2[1],
          check2: "flex:0 0 auto;width:20px;height:20px;border-radius:7px;border:0;padding:0;display:grid;place-items:center;cursor:pointer;" + (x.situacao === "Feita" ? "background:#1f7256" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4"),
          prazoPill: "flex:0 0 auto;font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums;" + (lt ? "color:#c2330f;font-weight:700" : x.fim && x.fim < H1 ? "color:#12171d;font-weight:700" : "color:#67787c;font-weight:500") }); };
      const foco = lstF.slice(0, 7).map(linha);
      const semDataL = base.filter(x => aberta2(x) && !x.fim);
      const GR = [["atr", "Atrasadas", late, "#d93c1a", "atrasadas"], ["hoje", "Hoje", hojeAb, "#fe4f2b", "hoje"], ["sem", "Próximos 7 dias", prox, "#12171d", null], ["sd", "Sem data", semDataL, "#c4c9ca", null]].filter(g => g[2].length);
      const fech = S.focoFech || {};
      const gruposF = GR.map(([k, l, arr, cor, rap]) => { const ab = !fech[k], lim = k === "sd" ? 3 : 5;
        return { l, n: String(arr.length), aberto: ab, alternar: () => this.setState(s2 => ({ focoFech: Object.assign({}, s2.focoFech || {}, { [k]: ab }) })),
          chev: "flex:0 0 auto;transition:transform .15s;transform:rotate(" + (ab ? 0 : -90) + "deg)", dot: "flex:0 0 auto;width:8px;height:8px;border-radius:3px;background:" + cor,
          nStyle: "min-width:20px;height:18px;padding:0 6px;border-radius:9999px;display:grid;place-items:center;font-size:10.5px;font-weight:500;" + (k === "atr" ? "background:#fdeeea;color:#c2330f" : "background:#eeeff3;color:#4a5560"),
          itens: arr.slice(0, lim).map(linha), temMais: arr.length > lim, mais: "Ver mais " + (arr.length - lim), verMais: () => this.setState({ visao: "lista", rapido: rap }) }; });
      const abas = ABAS.map(([k, l, arr]) => { const on = aba === k; return { l, n: String(arr.length), onClick: () => this.setState({ focoAba: k }),
        style: "display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 6px 0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (on ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:#4a5560;font-weight:500"),
        nStyle: "min-width:20px;height:18px;padding:0 5px;border-radius:9999px;display:grid;place-items:center;font-size:10.5px;font-weight:500;" + (k === "atrasadas" && arr.length ? "background:#d93c1a;color:#fff" : "background:#e3e7e8;color:#4a5560") }; });

      const ticks = (n, k, cor) => Array.from({ length: n }, (_, i) => "flex:1 1 0;min-width:1px;max-width:3px;height:20px;border-radius:2px;background:" + (i < k ? cor : "#e3e7e8"));
      const totHoje = hojeAb.length + hojeFe.length;
      const semI = new Date(H0); semI.setDate(semI.getDate() - ((semI.getDay() + 6) % 7)); const semAntI = new Date(semI.getTime() - 7 * 864e5);
      const feitaEntre = (a, b) => base.filter(x => x.situacao === "Feita" && x.fim && x.fim >= a && x.fim < b).length;
      const fSem = feitaEntre(semI, H1), fAnt = feitaEntre(semAntI, semI);
      const porDia = [0, 1, 2, 3, 4, 5, 6].map(i => { const a = new Date(semI.getTime() + i * 864e5); return { n: feitaEntre(a, new Date(a.getTime() + 864e5)), fut: a > H0, hj: a.getTime() === H0.getTime() }; });
      const mxD = Math.max(1, Math.max.apply(null, porDia.map(p => p.n)));
      const iniR = (x) => x.ini || x.fim;
      const reuH = todas.concat(D.REUNIOES || []).filter(x => x.tipo === "Reunião" && x.situacao !== "Declinada" && iniR(x) && iniR(x).toDateString() === H0.toDateString()).sort((a, b) => iniR(a) - iniR(b));
      const proxR = reuH.find(x => iniR(x) >= agora);
      const slots = Array.from({ length: 36 }, (_, i) => { const s0 = new Date(H0); s0.setHours(8, 0); const a = new Date(s0.getTime() + i * 12e5), b = new Date(a.getTime() + 12e5);
        const oc = reuH.some(x => { const ri = iniR(x), rf = x.ini && x.fim && x.fim > x.ini ? x.fim : new Date(ri.getTime() + 18e5); return ri < b && rf > a; }), now = agora >= a && agora < b;
        return "flex:1 1 0;min-width:1px;max-width:3px;border-radius:2px;height:" + (oc || now ? 20 : 10) + "px;background:" + (now ? "#fe4f2b" : oc ? "#12171d" : "#e3e7e8"); });
      const oldest = late[0] ? Math.max(1, Math.round((H0 - new Date(late[0].fim.getFullYear(), late[0].fim.getMonth(), late[0].fim.getDate())) / 864e5)) : 0;
      const nAb = base.filter(aberta2).length, dlt = fAnt ? Math.round((fSem / fAnt - 1) * 100) : fSem ? 100 : 0;
      const vS = (c) => "font-family:'Plus Jakarta Sans',sans-serif;font-size:30px;font-weight:800;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums;color:" + c;
      const kpis = [
        { l: "Para hoje", v: String(totHoje), vStyle: vS("#12171d"), sub: totHoje ? hojeFe.length + " feitas · " + hojeAb.length + " em aberto" : "Nada com prazo hoje", barras: ticks(36, totHoje ? Math.round(hojeFe.length / totHoje * 36) : 0, "#12171d"), onClick: () => this.setState({ focoAba: "hoje" }) },
        { l: "Atrasadas", v: String(late.length), vStyle: vS(late.length ? "#c2330f" : "#12171d"), sub: late.length ? "A mais antiga há " + oldest + (oldest > 1 ? " dias" : " dia") : "Nada atrasado", barras: ticks(36, nAb ? Math.max(late.length ? 1 : 0, Math.round(late.length / nAb * 36)) : 0, "#fe4f2b"), onClick: () => this.setState({ focoAba: "atrasadas" }) },
        { l: "Concluídas na semana", v: String(fSem), vStyle: vS("#12171d"), temDelta: true, delta: (dlt > 0 ? "↑ " : dlt < 0 ? "↓ " : "") + Math.abs(dlt) + "%", dStyle: "font-size:11px;font-weight:500;padding:2px 7px;border-radius:9999px;white-space:nowrap;" + (dlt > 0 ? "background:#e6f4ee;color:#1f7256" : dlt < 0 ? "background:#fdeeea;color:#c2330f" : "background:#eeeff3;color:#67787c"),
          sub: "vs. " + fAnt + " na semana passada", barras: porDia.map(p => "flex:1 1 0;min-width:4px;max-width:12px;border-radius:3px;height:" + (p.fut ? 3 : Math.max(3, Math.round(p.n / mxD * 20))) + "px;background:" + (p.fut ? "#e3e7e8" : p.hj ? "#fe4f2b" : "#12171d")), onClick: () => this.setState({ visao: "quadro" }) },
        { l: "Reuniões hoje", v: String(reuH.length), vStyle: vS("#12171d"), sub: proxR ? "Próxima às " + (this.fmtH(iniR(proxR)) || "—") + (proxR.empresa ? " · " + proxR.empresa : "") : reuH.length ? "Todas já passaram" : "Agenda livre das 8h às 20h", barras: slots,
          onClick: () => proxR ? (refReu(proxR) ? E && E.abrir("reuniao", refReu(proxR)) : this.setState({ aberta: proxR.key })) : E && E.abrir("novaReuniao", { data: this.fmtIso(H0) }) }
      ];
      kpis.forEach((kp, n) => { kp.onClick = () => this.setState({ kpiPop: ["hoje", "late", "sem", "reu"][n] }); });
      const semFe = base.filter(x => x.situacao === "Feita" && x.fim && x.fim >= semI && x.fim < H1).sort((a, b) => b.fim - a.fim);
      const POP = { hoje: ["Para hoje", totHoje ? totHoje + " com prazo hoje · " + hojeFe.length + " feitas · " + hojeAb.length + " em aberto" : "Nada com prazo hoje", hojeAb.concat(hojeFe), "hoje", "Nada com prazo para hoje."],
        late: ["Atrasadas", late.length ? late.length + (late.length > 1 ? " atividades passaram do prazo" : " atividade passou do prazo") : "Nada atrasado", late, "atrasadas", "Nada atrasado. Bom trabalho."],
        sem: ["Concluídas na semana", fSem + " feitas desde segunda · " + fAnt + " na semana passada", semFe, null, "Nada concluído nesta semana ainda."],
        reu: ["Reuniões hoje", reuH.length ? reuH.length + (reuH.length > 1 ? " reuniões" : " reunião") + " na agenda" + (proxR ? " · próxima às " + (this.fmtH(iniR(proxR)) || "—") : "") : "Agenda livre", reuH, null, "Nenhuma reunião hoje."] };
      const KP = S.kpiPop && POP[S.kpiPop], fechaPop = () => this.setState({ kpiPop: null });
      const pop = !KP ? { aberto: false, itens: [], reus: [] } : { aberto: true, titulo: KP[0], sub: KP[1], ehReu: S.kpiPop === "reu", naoReu: S.kpiPop !== "reu", fechar: fechaPop, vazio: !KP[2].length, vazioTxt: KP[4],
        itens: S.kpiPop === "reu" ? [] : KP[2].map(x => { const l = linha(x); return Object.assign({}, l, { abrir: () => { fechaPop(); l.abrir(); }, acao: () => { fechaPop(); l.acao(); } }); }),
        reus: S.kpiPop !== "reu" ? [] : reuH.map(x => { const t0 = iniR(x), passou = t0 < agora, RE = x.reuniao || {}; return { h: this.fmtH(t0) || "Dia", titulo: x.titulo, sub: [x.empresa, x.pessoa].filter(Boolean).join(" · ") || "Reunião interna", fmt: RE.formato || "Vídeo",
          hStyle: "flex:0 0 auto;width:48px;font-size:13.5px;font-weight:500;font-variant-numeric:tabular-nums;color:" + (passou ? "#a3a8a4" : "#12171d"),
          tag: passou ? "Passou" : x === proxR ? "Próxima" : "", temTag: passou || x === proxR, tagStyle: "flex:0 0 auto;height:22px;padding:0 8px;border-radius:9999px;display:inline-flex;align-items:center;font-size:11px;font-weight:500;" + (passou ? "background:#f3f4f4;color:#8b949e" : "background:#fff6f4;color:#c2330f"),
          abrir: () => { fechaPop(); if (refReu(x)) E && E.abrir("reuniao", refReu(x)); else this.setState({ aberta: x.key, subAberta: null }); } }; }),
        lista: () => this.setState({ kpiPop: null, visao: "lista", rapido: KP[3] }), novaReu: () => { fechaPop(); E && E.abrir("novaReuniao", { data: this.fmtIso(H0) }); } };
      const totDia = totHoje + late.length, pct = totDia ? Math.round(hojeFe.length / totDia * 100) : 100, hh = agora.getHours();
      return { dataTxt: cap(agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })), saud: (hh < 12 ? "Bom dia" : hh < 18 ? "Boa tarde" : "Boa noite") + ", " + (this.eu || "").split(" ")[0],
        frase: late.length ? "Você tem " + late.length + (late.length > 1 ? " atividades atrasadas" : " atividade atrasada") + " e " + hojeAb.length + " para hoje. Vale começar pelas atrasadas." : hojeAb.length ? hojeAb.length + (hojeAb.length > 1 ? " atividades" : " atividade") + " para hoje e nada atrasado." : "Nada vencendo hoje. Bom momento para adiantar a semana.",
        pctDia: pct + "%", anel: pct + " 100", diaSeg: [["Feitas", hojeFe.length, "#1f7256"], ["Em aberto", hojeAb.length, "#12171d"], ["Atrasadas", late.length, "#fe4f2b"]].map(([l, n, c]) => ({ l, n: String(n), cor: l === "Atrasadas" && n ? "#c2330f" : "#12171d", s: "flex:" + n + " 0 0;background:" + c + (n ? "" : ";display:none"), dot: "width:8px;height:8px;border-radius:3px;background:" + c })),
        nx: { late, hojeAb, reuH, fSem, proxH: proxR ? this.fmtH(iniR(proxR)) : "" }, grupos: gruposF, focoResumo: (late.length + hojeAb.length + prox.length + semDataL.length) + " em aberto", kpis, pop, abas, foco, focoVazio: !gruposF.length, focoVazioTxt: false ? "" : aba === "hoje" ? "Nada vencendo hoje." : "Semana livre por enquanto.",
        verLista: () => this.setState({ visao: "lista", rapido: aba === "atrasadas" ? "atrasadas" : aba === "hoje" ? "hoje" : null }), verListaTxt: lstF.length > 7 ? "Ver as " + lstF.length + " na lista" : "Abrir na lista",
        tl, tlVazio: !tl.length, tlResumo, tlFiltros,
        nexoInsight: late.length ? "“" + late[0].titulo + "” está atrasada há " + oldest + (oldest > 1 ? " dias" : " dia") + "." : hojeAb.length ? "Seu dia tem " + hojeAb.length + (hojeAb.length > 1 ? " entregas" : " entrega") + ". Quer que eu ordene por prioridade?" : "Tudo em dia. Posso adiantar os follow-ups da semana?",
        nexoSub: late.length > 1 ? "E mais " + (late.length - 1) + " na fila de atrasadas. Posso reorganizar seus prazos." : "Analiso suas atividades e sugiro o próximo passo.",
        sugestoes: (ov.sugestoes || []).slice(0, 3), nexoCol: "grid-column:" + (S.larg >= 1180 || S.larg < 700 ? "auto" : "1 / -1"), linhaCols: "grid-template-columns:" + (S.larg >= 1180 ? "repeat(3,minmax(0,1fr))" : S.larg >= 700 ? "repeat(2,minmax(0,1fr))" : "minmax(0,1fr)") };
    })();
    const escopos = [["minhas", "Minhas"], ["equipe", "Equipe"], ["todas", "Todas"]].map(([k, l]) => ({ l, onClick: () => this.setState({ escopo: k }), style: "padding:0 12px;border-radius:7px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (S.escopo === k ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:#4a5560;font-weight:500") }));
    const RAPS = [["atrasadas", "Atrasadas", "M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "#d93c1a", "#fdeeea"], ["hoje", "Hoje", "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "#c2330f", "#fff6f4"], ["semResp", "Sem responsável", "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "#4a5560", "#eeeff3"], ["aguardando", "Aguardando retorno", "M10 15V9M14 15V9M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "#6e5420", "#f7edd8"]];
    return {
      nx: (() => { this._nx = Object.assign({}, dash.nx, { comandos: ov.comandos }); const NC = S.nexoChat; if (!NC) return { aberto: false, msgs: [], cards: [], recentes: [] };
        const upN = (p) => this.setState(s => ({ nexoChat: Object.assign({}, s.nexoChat, p) }));
        const diz = (t) => this.setState(s => s.nexoChat ? { nexoChat: Object.assign({}, s.nexoChat, { msgs: s.nexoChat.msgs.concat([{ de: "nexo", t }]) }) } : null);
        const fazer = (k) => { if (k === "reorg") { /* ANTES: o chat respondia "Pronto. Redistribuí seus prazos" como se a IA tivesse executado. Falso: era regex + um clique no botão local. Agora só avisa que não está ligado. */ diz("Ainda não está ligado: não mexi em nenhum prazo. Use o botão de reorganizar a semana no painel."); }
          else if (k === "verAtrasadas") this.setState({ nexoChat: null, kpiPop: "late" }); else if (k === "verHoje") this.setState({ nexoChat: null, kpiPop: "hoje" });
          else if (k === "pipeline") E && E.irPara("/onface-preview/pipeline", "Pipeline", {});
          else if (k.indexOf("tarefa:") === 0) { this.setState({ nexoChat: null }); this.abrirEditor(null, { titulo: k.slice(7) }); }
          else if (k.indexOf("tarefaD:") === 0) { const [d0, ...tt] = k.slice(8).split("|"); this.setState({ nexoChat: null }); this.abrirEditor(null, { titulo: tt.join("|"), fimD: d0 }); }
          else if (k.indexOf("rota:") === 0) { this.setState({ nexoChat: null }); E && E.irPara(k.slice(5)); }
          else if (k.indexOf("conf:") === 0) { const [, runId, passo] = k.split(":"); confirmarAcaoDoNexo({ runId, passo: Number(passo) }).then(r => diz(r.texto)); }
          else if (k.indexOf("p:") === 0) this.enviarNexo(k.slice(2)); };
        /* ANTES: "Conversas recentes" com 5 conversas que nunca aconteceram (Resumo da semana · Hoje, 09:12, Campos Engenharia...). Não há histórico de chat gravado: lista vazia. */
        const REC = (S.nexoRec || []).map(c => [c.titulo, c.id]);
        const qb = (NC.busca || "").toLowerCase();
        const CARDS = [["Resumir minha semana", "Mostra seus principais avanços e pendências.", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5", "#fff6f4", "#c2330f"], ["Reorganizar minha agenda", "Prioriza o que realmente importa hoje.", "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "#eeeff3", "#12171d"], ["Criar uma tarefa", "Transforma o que você pedir em tarefa.", "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", "#e6f4ee", "#1f7256"], ["Analisar oportunidades", "Ajuda a definir a próxima ação.", "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", "#efecfa", "#4f3fa8"]];
        const msgs = NC.msgs || [];
        return { aberto: true, fechar: () => this.setState({ nexoChat: null }), novo: () => upN({ msgs: [], rasc: "", pensando: false, ativo: null }), busca: NC.busca || "", setBusca: (e) => upN({ busca: e.target.value }),
          intro: "Seu assistente de produtividade na ONFACE. " + (dash.nx.late.length ? "Vi " + dash.nx.late.length + (dash.nx.late.length > 1 ? " atividades atrasadas" : " atividade atrasada") + " — quer começar por elas?" : "Como posso te ajudar hoje?"),
          recentes: REC.filter(r => !qb || r[0].toLowerCase().indexOf(qb) >= 0).map(([t, q]) => ({ t, q, onClick: () => this.abrirConversaNexo(q, t),
            style: "display:block;width:100%;padding:9px 12px;border-radius:10px;border:0;cursor:pointer;text-align:left;" + (NC.ativo === t ? "background:#fff;box-shadow:inset 2px 0 0 #fe4f2b,0 0 0 1px #eef1f1" : "background:transparent;box-shadow:inset 2px 0 0 #f0c3b6") })),
          cards: CARDS.map(([t, s2, d, bg, c]) => ({ t, s: s2, d, ico: "width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:" + bg + ";color:" + c, onClick: () => { upN({ ativo: t }); this.enviarNexo(t === "Criar uma tarefa" ? "Criar uma tarefa" : t); } })),
          vazio: !msgs.length && !NC.pensando, temMsgs: !!msgs.length || !!NC.pensando, pensando: !!NC.pensando, ref: (el) => { this._nxEl = el; },
          msgs: msgs.map(m => { const eu = m.de === "eu"; return { t: m.t, ehNexo: !eu, temAcoes: !eu && !!(m.acoes && m.acoes.length), acoes: (m.acoes || []).map(([k, l]) => ({ l, onClick: () => fazer(k) })),
            linha: "display:flex;align-items:flex-end;gap:10px;" + (eu ? "justify-content:flex-end" : "justify-content:flex-start"),
            bolha: "display:block;padding:11px 14px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;text-wrap:pretty;" + (m.erro ? "border-radius:14px 14px 14px 4px;background:var(--of-aviso-fundo);color:var(--of-aviso-tinta);box-shadow:inset 0 0 0 1px var(--of-aviso-tinta)" : eu ? "border-radius:14px 14px 4px 14px;background:#12171d;color:#fff" : "border-radius:14px 14px 14px 4px;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #eef1f1") }; }),
          rasc: NC.rasc || "", setRasc: (e) => upN({ rasc: e.target.value }), tecla: (e) => { if (e.key === "Enter") { e.preventDefault(); this.enviarNexo(NC.rasc); } },
          enviar: () => this.enviarNexo(NC.rasc),
          enviarStyle: "width:40px;height:40px;border-radius:9999px;border:0;color:#fff;display:grid;place-items:center;cursor:pointer;background:" + ((NC.rasc || "").trim() ? "#fe4f2b" : "#f5a38f") };
      })(),
      dash, novoProjeto, pjSel, pj, escopos, busca: S.busca, setBusca: (e) => this.setState({ busca: e.target.value }), filtros, fd2,
      visoes: [["geral", "Visão geral"], ["quadro", "Quadro"], ["lista", "Lista"]].map(([k, l]) => ({ l, onClick: () => this.setState({ visao: k }), style: "padding:0 12px;border-radius:7px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (S.visao === k ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:#4a5560;font-weight:500") })),
      novaAtv: () => this.abrirEditor(null, {}),
      rapidos: RAPS.map(([k, l, d, c, bg]) => { const on = S.rapido === k, n = base.filter(RAP[k]).length; return { l, d, n: String(n), onClick: () => this.setState({ rapido: on ? null : k }),
        style: "display:flex;align-items:center;gap:10px;height:46px;padding:0 12px;border-radius:12px;border:0;cursor:pointer;color:#12171d;background:" + (on ? bg : "#fff") + ";box-shadow:" + (on ? "inset 0 0 0 1.5px " + c : "0 0 0 1px #e6e9e9"),
        hover: on ? "" : "box-shadow:0 0 0 1px #c9cfd0", ico: "flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:" + bg + ";color:" + c,
        nStyle: "flex:0 0 auto;min-width:24px;height:22px;padding:0 7px;border-radius:9999px;display:grid;place-items:center;font-size:12px;font-weight:500;font-variant-numeric:tabular-nums;" + (n && k === "atrasadas" ? "background:#d93c1a;color:#fff" : "background:#eeeff3;color:#4a5560") }; }),
      ehQuadro: S.visao === "quadro", ehLista: S.visao === "lista", colunas,
      toggleDeclinadas: () => this.setState(s => ({ declinadas: !s.declinadas })), declinadasLbl: (S.declinadas ? "Ocultar" : "Declinadas · " + vis.filter(x => x.situacao === "Declinada").length), declinadasDica: S.declinadas ? "Ocultar declinadas" : "Mostrar a coluna de declinadas",
      agrupos: [["prazo", "Prazo"], ["empresa", "Empresa"], ["tipo", "Tipo"]].map(([k, l]) => ({ l, onClick: () => this.setState({ agrupar: k, fechados: {} }), style: "height:28px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;font-weight:500;" + (S.agrupar === k ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") })),
      grupos, listaVazia: !grupos.length,
      temLateral: false, ehGeral: S.visao === "geral", naoGeral: S.visao !== "geral", ov, sem, agenda, agendaVazia: !agenda.length, agendaN: String(agenda.length), agendaData: H0.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }), feed,
      abrirPicker: (e) => { try { e.currentTarget.showPicker && e.currentTarget.showPicker(); } catch (x) {} },
      colStyle: "flex:1 1 auto;min-width:0;min-height:0;display:flex;flex-direction:column;" + (S.visao === "geral" ? "overflow-y:auto" : "overflow:hidden"),
      dt, ed, parar: (e) => e.stopPropagation(),
      lbl: "display:flex;gap:4px;align-items:baseline;margin-bottom:7px;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4a5560"
    };
  }

  alvos() {
    const E = this.E, D = this.dadosDoProto || {};
    const RK = { Contato: 0, Prospect: 1, Lead: 2, Cliente: 3 }, map = {};
    const put = (o) => { const cur = map[o.k]; if (!cur) map[o.k] = o; else if ((RK[o.rel] || 0) > (RK[cur.rel] || 0)) cur.rel = o.rel; };
    const txt = (v) => typeof v === "string" ? v : "";
    const L = (E && E.ler("leads", null)) || D.LEADS || [], OP = (E && E.ler("opps", null)) || D.OPORTUNIDADES || [];
    L.forEach(l => { const rel = ["nutricao", "desqualificado"].indexOf(l.etapa) >= 0 ? "Contato" : "Lead";
      if (l.empresa) put({ k: "e:" + l.empresa, tipo: "empresa", nome: l.empresa, sub: txt(l.segmento) || "Empresa", rel, empresa: l.empresa });
      if (l.pessoa) put({ k: "c:" + l.pessoa, tipo: "contato", nome: l.pessoa, sub: [txt(l.cargo), l.empresa].filter(Boolean).join(" · "), rel, empresa: l.empresa || null, pessoa: l.pessoa }); });
    OP.forEach(o => { const rel = o.etapa === "ganho" ? "Cliente" : o.etapa === "perdido" ? "Contato" : "Lead";
      put({ k: "e:" + o.empresa, tipo: "empresa", nome: o.empresa, sub: "Empresa", rel, empresa: o.empresa });
      (o.pessoas && o.pessoas.length ? o.pessoas : [{ nome: o.pessoa }]).forEach(p => { if (p.nome) put({ k: "c:" + p.nome, tipo: "contato", nome: p.nome, sub: [p.papel, o.empresa].filter(Boolean).join(" · "), rel, empresa: o.empresa, pessoa: p.nome }); }); });
    ["empresas", "pessoas"].forEach(ch => { const arr = E && E.ler(ch, null); if (!Array.isArray(arr)) return; arr.forEach(x => { const n = x && txt(x.nome || (ch === "empresas" ? x.empresa : x.pessoa)); if (!n) return; const rel = RK[x.relacionamento] != null ? x.relacionamento : "Contato";
      put(ch === "empresas" ? { k: "e:" + n, tipo: "empresa", nome: n, sub: txt(x.segmento) || "Empresa", rel, empresa: n } : { k: "c:" + n, tipo: "contato", nome: n, sub: [txt(x.cargo), txt(x.empresa)].filter(Boolean).join(" · "), rel, empresa: txt(x.empresa) || null, pessoa: n }); }); });
    return Object.keys(map).map(k => map[k]).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  /* O chat do NEXO é UM só no produto: servidor (agente real, contexto da tela, ferramentas com o escopo do usuário), via lib/nexo/cliente. Sem resposta fabricada aqui: erro do provedor aparece como erro. */
  nexo(q) { this.setState({ nexoChat: { msgs: [], rasc: "", pensando: false, ativo: null } }); this._nxConv = null; this.carregarRecentesNexo(); if (q) this.enviarNexo(q); }
  carregarRecentesNexo() { conversasRecentes().then(d => this.setState({ nexoRec: d.conversas || [] })).catch(() => this.setState({ nexoRec: [] })); }
  abrirConversaNexo(id, titulo) { this._nxConv = id; this.setState(s => ({ nexoChat: Object.assign({}, s.nexoChat, { msgs: [], ativo: titulo, pensando: true }) }));
    mensagensDaConversaNexo(id).then(d => this.setState(s => s.nexoChat ? { nexoChat: Object.assign({}, s.nexoChat, { pensando: false, msgs: (d.mensagens || []).map(m => m.de === "eu" ? { de: "eu", t: m.texto } : { de: "nexo", t: m.texto }) }) } : null))
      .catch(e => this.setState(s => s.nexoChat ? { nexoChat: Object.assign({}, s.nexoChat, { pensando: false, msgs: [{ de: "nexo", t: "Não consegui abrir a conversa (" + e.message + ").", erro: true }] }) } : null)); }
  enviarNexo(q) { const t = String(q || "").trim(); if (!t) return;
    if (!this._nxConv) this._nxConv = novaConversaId();
    this.setState(s => ({ nexoChat: Object.assign({}, s.nexoChat || { msgs: [] }, { msgs: ((s.nexoChat || {}).msgs || []).concat([{ de: "eu", t }]), rasc: "", pensando: true }) }));
    const acaoDe = (b) => b.confirmar ? ["conf:" + b.confirmar.runId + ":" + b.confirmar.passo, b.rotulo] : ["rota:" + b.href, b.rotulo];
    const push = (m) => this.setState(s => s.nexoChat ? { nexoChat: Object.assign({}, s.nexoChat, { msgs: s.nexoChat.msgs.concat([Object.assign({ de: "nexo" }, m)]), pensando: false }) } : null);
    perguntarAoNexo({ conversaId: this._nxConv, pergunta: t, rota: "/tarefas", area: "Atividades" })
      .then(d => { this._nxConv = d.conversaId || this._nxConv; const rr = botoesDaResposta(d); push({ t: rr.texto, erro: !!d.falhou, acoes: rr.botoes.map(acaoDe) }); if (d.configurada && !d.falhou) this.carregarRecentesNexo(); })
      .catch(e => push({ t: "Não consegui falar com o NEXO (" + e.message + ").", erro: true, acoes: [] })); }
  componentDidUpdate() { if (this._nxEl && this._nxN !== ((this.state.nexoChat || {}).msgs || []).length + (this.state.nexoChat && this.state.nexoChat.pensando ? 1 : 0)) { this._nxN = ((this.state.nexoChat || {}).msgs || []).length + (this.state.nexoChat && this.state.nexoChat.pensando ? 1 : 0); this._nxEl.scrollTop = this._nxEl.scrollHeight; } }

  abrirEditor(it, pre) {
    const EU = this.eu;
    const asg = it ? (it.assignees && it.assignees.length ? it.assignees : (it.resp ? [it.resp] : [])) : [EU];
    const vt = it ? (it.oppId ? "opp" : it.vincTipo === "pessoa" ? "pessoa" : it.empresa ? "empresa" : "nenhum") : "nenhum";
    const f = it ? { titulo: it.titulo, desc: it.desc || "", descHtml: it.descHtml || "", anexos: it.anexos || [], tipo: it.tipo, situacao: it.situacao, prioridade: it.prioridade || "Média", assignees: asg.slice(), fila: it.fila || null,
        dest: it.fila || (asg.length && asg.indexOf(EU) < 0) ? "outro" : "mim", vincTipo: vt, vinc: vt === "opp" ? it.oppId : vt === "pessoa" ? it.pessoa : vt === "empresa" ? it.empresa : "",
        projetoId: it.projetoId || null, iniD: this.fmtIso(it.ini), fimD: this.fmtIso(it.fim), fimH: this.fmtH(it.fim), sub: (it.sub || []).map(s => { const c = Object.assign({}, s); if (!c.fimD && s.fimX) c.fimD = this.fmtIso(s.fimX); delete c.fimX; return c; }) }
      : Object.assign({ titulo: "", desc: "", descHtml: "", anexos: [], tipo: "Tarefa", situacao: "A fazer", prioridade: "Média", assignees: [EU], fila: null, dest: "mim", vincTipo: "nenhum", vinc: "", iniD: "", fimD: this.fmtIso(this.hoje()), fimH: "", sub: [] }, pre || {});
    this.setState({ ed: { it, f, tk: Date.now() + Math.random(), novaSub: "", novoTipo: null, tentou: false, erro: null } });
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <AtividadesDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as AtividadesLiga };
