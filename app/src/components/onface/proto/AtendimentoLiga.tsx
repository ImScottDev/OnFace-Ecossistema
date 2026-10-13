// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Atendimento — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * AtendimentoDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `AtendimentoDesenho.tsx`, convertido por máquina e intocável.
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

import { AtendimentoDesenho } from "./AtendimentoDesenho";
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

  state = { reagir: null, painel: true, rev: 0, sel: null, aba: "todos", canal: "todos", busca: "", texto: "", modo: "msg", pop: null, digitando: null, nexo: null, enc: null, hov: null, cit: null, play: null, novas: null, dispensadas: {}, w: (typeof window !== "undefined" ? window.innerWidth : 1440) };

  constructor(props: any) {
    super(props);
    const d: any = props.dados ?? {};
    for (const k of Object.keys(this.state ?? {})) {
      if ((this.state as any)[k] === null && d[k] != null) {
        (this.state as any) = { ...(this.state as any), [k]: d[k] };
      }
    }
  }
  chatRef = React.createRef();
  fileRef = React.createRef();
  tplRef = React.createRef();
  composerRef = React.createRef();
  painelRef = React.createRef();
  convRef = React.createRef();
  ajustarComposer() { const el = this.composerRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(Math.max(el.scrollHeight, 76), 260) + "px"; }

  componentDidMount() {
    this._esc = (e) => { if (e.key !== "Escape") return; const fn = this.__abertos && this.__abertos(); if (fn) { e.stopPropagation(); fn(); } };
    document.addEventListener("keydown", this._esc);
    const assinar = () => {
      const Es = this.E;
      if (!Es || this._off) return !!this._off;
      this._off = Es.assinar(() => this.setState(s => ({ rev: s.rev + 1 })));
      this.setState(s => ({ rev: s.rev + 1 }));
      return true;
    };
    if (!assinar()) this._assinarT = setInterval(() => { if (assinar()) clearInterval(this._assinarT); }, 50);
    this._fora = (e) => {
      if (this.state.pop && !(e.target.closest && e.target.closest("[data-of-atpop]"))) this.setState({ pop: null });
      if (this.state.reagir && !(e.target.closest && e.target.closest("[data-of-reagir]"))) this.setState({ reagir: null });
    };
    this._rs = () => this.setState({ w: (typeof window !== "undefined" ? window.innerWidth : 1440), pop: null });
    this._esc = (e) => { if (e.key === "Escape") this.setState(s => s.pop ? { pop: null } : s.cit ? { cit: null } : null); };
    document.addEventListener("mousedown", this._fora);
    document.addEventListener("keydown", this._esc);
    window.addEventListener("resize", this._rs);
    this.rolar();
  }
  ligPlay(id, dur, forcar) {
    clearInterval(this._ligI);
    const cur = this.state.lp && this.state.lp.id === id ? this.state.lp : { id, t: 0, on: false, v: 1 };
    if (cur.on && !forcar) return this.setState({ lp: Object.assign({}, cur, { on: false }) });
    const ini = cur.t >= dur ? 0 : cur.t;
    this.setState({ lp: Object.assign({}, cur, { t: ini, on: true }) });
    this._ligI = setInterval(() => {
      const s = this.state.lp;
      if (!s || s.id !== id || !s.on) return clearInterval(this._ligI);
      const t = s.t + 0.25 * (s.v || 1);
      if (t >= dur) { clearInterval(this._ligI); return this.setState({ lp: Object.assign({}, s, { t: dur, on: false }) }); }
      this.setState({ lp: Object.assign({}, s, { t }) });
    }, 250);
  }
  prepararImg(file, id) {
    const kb = file.size / 1024;
    const tam = kb > 1024 ? (kb / 1024).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(kb)) + " KB";
    const nome = file.name && file.name !== "image.png" ? file.name : "Imagem colada.png";
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      this.setState({ colado: { id, src: cv.toDataURL("image/jpeg", 0.82), nome, tam } });
      const t = this.composerRef && this.composerRef.current; if (t) t.focus();
    };
    img.onerror = () => { URL.revokeObjectURL(url); this.E && this.E.avisar("Não consegui ler essa imagem", "aviso"); };
    img.src = url;
  }
  componentWillUnmount() {
    document.removeEventListener("keydown", this._esc);
    clearInterval(this._ligI); clearInterval(this._gravI); if (this._stream) this._stream.getTracks().forEach(t => t.stop());
    clearInterval(this._assinarT); clearInterval(this._playI); (this._timers || []).forEach(clearTimeout);
    if (this._off) this._off();
    document.removeEventListener("mousedown", this._fora);
    document.removeEventListener("keydown", this._esc);
    window.removeEventListener("resize", this._rs);
  }
  componentDidUpdate(pp, ps) {
    if (ps && ps.texto !== this.state.texto) this.ajustarComposer();
    const k = (this._selAtual || "") + ":" + (this._nMsgs || 0) + ":" + (this.state.digitando ? 1 : 0);
    if (k !== this._rolado) { this._rolado = k; this.rolar(); }
  }
  rolar() { requestAnimationFrame(() => { const el = this.chatRef.current; if (el) el.scrollTop = this._ehLig ? 0 : el.scrollHeight; }); }
  depois(fn, ms) { this._timers = this._timers || []; this._timers.push(setTimeout(fn, ms)); }
  tocar(k, secs) {
    clearInterval(this._playI);
    if (this.state.play && this.state.play.k === k) return this.setState({ play: null });
    this.setState({ play: { k, p: 0 } });
    this._playI = setInterval(() => this.setState(s => {
      if (!s.play) return null;
      const p = s.play.p + 0.25 / secs;
      if (p >= 1) { clearInterval(this._playI); return { play: null }; }
      return { play: { k: s.play.k, p } };
    }), 250);
  }

  renderVals() {
    const v = this.__rv();
    const K = ["nova", "nl", "lib", "reu", "ret", "iaM", "tr", "enc"];
    v.fora = {};
    K.forEach(k => { v.fora[k] = (e) => { if (e.target === e.currentTarget && v[k] && v[k].fechar) v[k].fechar(); }; });
    this.__abertos = () => {
      if (v.lig && v.lig.relAberto) return v.lig.fecharRel;
      const k = K.slice().reverse().find(x => v[x] && v[x].aberto && v[x].fechar);
      return k ? v[k].fechar : null;
    };
    return v;
  }
  __rv() {
    const S = this.state;
    const D = this.dadosDoProto || {};
    const Es0 = this.E;
    const est = () => this.E;
    const diz = (t, tom) => est() && est().avisar(t, tom);
    const ini = (n) => avatarDe(n, (D.iniciais || ((n) => (n || "").split(" ").slice(0, 2).map(p => [...p][0] || "").join("").toUpperCase()))(n));
    const slug = D.slug || ((s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""));
    const leads = (Es0 && Es0.ler("leads", null)) || D.LEADS || [];
    const EXTRA = [{ id: "c9", lead: null, contato: { nome: "Marcos", tel: "+55 11 98888-1234" }, canal: "WhatsApp", numero: "Pré-vendas · (11) 97700-4410", status: "novo", resp: null, prioridade: "Média", naoLidas: 1, hora: "09:52", msgs: [
      { de: "in", t: "Bom dia! Peguei o contato de vocês com um amigo. Vocês fazem URA com IA para clínica?", h: "09:52", dia: "Hoje" }
    ] }];
    EXTRA.push({ id: "c10", lead: "l11", canal: "WhatsApp", numero: "Atendimento automático · (11) 4003-1040", status: "atendimento", resp: "Diego Nunes", prioridade: "Média", naoLidas: 0, hora: "10:48",
      ia: { ate: "pedido", objetivos: ["Qualificar o lead", "Agendar reunião"], tom: "Como eu", limites: { humano: true, preco: true, prazo: true }, instr: "", agente: "NEXO · Qualificação" },
      msgs: [
        { de: "sis", t: "NEXO assumiu a conversa · número Atendimento automático", h: "10:31", dia: "Hoje" },
        { de: "in", t: "Oi! Vi o anúncio de white label. Como funciona?", h: "10:31", dia: "Hoje" },
        { de: "out", ia: true, t: "Oi, Thiago! Tudo bem? Com o white label você revende a plataforma com a marca da Rede Vivace. Para eu te passar o melhor formato: quantas unidades vocês têm hoje?", h: "10:32", dia: "Hoje", lido: true },
        { de: "in", t: "Somos 14 lojas, queremos oferecer atendimento por WhatsApp para os franqueados", h: "10:40", dia: "Hoje" },
        { de: "nota", ia: true, autor: "NEXO", t: "Qualificação em andamento · 14 unidades (franquia), interesse White Label, canal principal WhatsApp. Decisor provável: diretor de expansão. Falta confirmar volume de atendimentos.", h: "10:40", dia: "Hoje" },
        { de: "out", ia: true, t: "Perfeito! Para 14 unidades o modelo de franquia funciona muito bem. Quantos atendimentos por mês cada loja faz, mais ou menos?", h: "10:41", dia: "Hoje", lido: true },
        { de: "in", t: "Uns 800 por loja. Consegue me mandar valores?", h: "10:47", dia: "Hoje" },
        { de: "out", ia: true, t: "Consigo sim! Os valores dependem do escopo, então o Diego, do nosso time comercial, monta a proposta com você. Posso marcar 30 min amanhã às 10h ou às 15h?", h: "10:48", dia: "Hoje", lido: true },
        { de: "nota", ia: true, autor: "NEXO", t: "Fit alto: 14 lojas × ~800 atendimentos/mês (≈11 mil). Pediu preço — não informei (limite ativo) e ofereci reunião com @Diego Nunes. Próximo passo: confirmar horário.", h: "10:48", dia: "Hoje" }
      ] });
    const juntar = (base) => base.concat(EXTRA.filter(x => !base.some(c => c.id === x.id)));
    const convs = juntar((Es0 && Es0.ler("conversas", null)) || D.CONVERSAS || []).map(c => c.canal === "Instagram" ? Object.assign({}, c, { canal: "WhatsApp", numero: (c.numero || "").indexOf("callface") >= 0 ? "Suporte · (11) 4003-1030" : "Comercial · (11) 4003-1020" }) : c);
    /* ANTES: sem equipe vinda do adaptador, caía em três nomes do protótipo
       (Camila Reis, Diego Nunes, Ana Vitória) que não existem na organização. */
    const EQUIPE = D.EQUIPE || [];
    const EU = EQUIPE[0];
    if (!this._pedidoLido && Es0) {
      this._pedidoLido = true;
      const pl = Es0.parametro && Es0.parametro("lead"), pc = Es0.parametro && Es0.parametro("canal");
      const prel = Es0.parametro && Es0.parametro("relatorio");
      if (pl && prel) setTimeout(() => {
        let alvo = convs.find(c => c.lead === pl && c.canal === "Telefone");
        if (!alvo) {
          const base = (Es0.ler("conversas", null) || D.CONVERSAS || []).slice();
          const agora = new Date(), hh = String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0");
          alvo = { id: "cl-" + pl, lead: pl, canal: "Telefone", numero: "Telefone", status: "atendimento", resp: EU, prioridade: "Média", naoLidas: 0, hora: hh, msgs: [{ de: "sis", t: "Ligação registrada", h: hh, dia: "Hoje" }] };
          Es0.gravar({ conversas: base.concat(alvo) });
        }
        this.setState({ sel: alvo.id, pop: null });
        setTimeout(() => Es0.abrir("relatorio", pl), 50);
      }, 0);
      else if (pl && pc) setTimeout(() => {
        const ja = convs.find(c => c.lead === pl && c.canal === pc && c.status !== "resolvida");
        if (ja) this.setState({ sel: ja.id, modo: "msg", pop: null });
        else this.setState({ pop: null, nova: { canal: pc, modoPara: "buscar", digito: "", busca: "", alvo: pl, livre: "", de: pc === "E-mail" ? "email" : "principal", modoMsg: "escrever", tpl: "t1", assunto: "", texto: "" } });
      }, 0);
    }
    const gravarC = (id, fn) => {
      const E = est(); if (!E) return;
      const lista = juntar(E.ler("conversas", null) || D.CONVERSAS || []).map(c => c.id === id ? Object.assign({}, c, fn(c)) : c);
      E.gravar({ conversas: lista });
    };
    const agora = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    const minDe = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(h || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; };
    const fmtDur = (n) => n == null ? "—" : n < 1 ? "< 1 min" : n < 60 ? n + " min" : Math.floor(n / 60) + "h " + String(n % 60).padStart(2, "0") + "min";

    const ico = {
      "WhatsApp": "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
      "Instagram": "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zM16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4zM17.5 6.5h.01",
      "E-mail": "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
      "Telefone": "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39"
    };
    const icoCopiar = "M8 8h12v12H8zM4 16V4h12";
    const corCanal = { "WhatsApp": "#1f7256", "Instagram": "#4f3fa8", "E-mail": "#4a5560", "Telefone": "#12171d" };
    const badge = (canal) => "position:absolute;right:-2px;bottom:-2px;width:18px;height:18px;border-radius:9999px;background:#fff;color:" + (corCanal[canal] || "#4a5560") + ";display:grid;place-items:center;box-shadow:0 0 0 2px #fff,inset 0 0 0 1px #e3e7e8";

    const TINTS = [["#eeeff3", "#4a5560"], ["#fff6f4", "#c2330f"], ["#e6f4ee", "#1f7256"], ["#efecfa", "#4f3fa8"], ["#e8f0fb", "#2c5f9e"], ["#1f252c", "#fff"]];
    const tint = (n) => { let h = 0; for (const ch of (n || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; };
    const av = (n, px, fs) => "flex:0 0 auto;width:" + px + "px;height:" + px + "px;border-radius:9999px;background:linear-gradient(180deg,#f6f6f3,#eceeee);color:#1f252c;box-shadow:inset 0 0 0 1px #e3e7e8;font-family:'Plus Jakarta Sans',sans-serif;font-size:" + fs + "px;font-weight:700;letter-spacing:.01em;display:grid;place-items:center";
    const avP = (n) => "flex:0 0 auto;width:20px;height:20px;border-radius:9999px;font-size:8.5px;font-weight:700;display:grid;place-items:center;" + (n ? "background:#12171d;color:#fff" : "background:#fff;color:#a3a8a4;box-shadow:inset 0 0 0 1px #dbdede");

    const ST = {
      novo: ["Novo", "#4c8fe0", "Chegou e ninguém assumiu ainda"],
      atendimento: ["Em atendimento", "#fe4f2b", "Alguém do time está conversando"],
      aguardando: ["Aguardando cliente", "#c8a86a", "A resposta depende do cliente"],
      interno: ["Aguardando time", "#9b8bd8", "Depende de outra área: técnico, financeiro, proposta"],
      retornar: ["Retornar depois", "#4a5560", "Sai da fila e volta no horário marcado"],
      resolvida: ["Resolvida", "#1f7256", "Encerrada com motivo"]
    };
    const GRUPO_AGUARD = ["aguardando", "interno", "retornar"];
    const pill = (st) => "display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:9999px;font-size:10.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;"
      + (st === "resolvida" ? "background:#e6f4ee;color:#1f7256" : st === "atendimento" ? "background:#fff6f4;color:#c2330f" : st === "interno" ? "background:#efecfa;color:#4f3fa8" : "background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #e3e7e8");
    const dot = (st) => "flex:0 0 auto;width:6px;height:6px;border-radius:9999px;background:" + (ST[st] || ST.novo)[1];

    const balao = (m) => !!m && (m.de === "in" || m.de === "out");
    const ultimoB = (c) => (c.msgs || []).filter(balao).slice(-1)[0] || null;
    const ultima = (c) => (c.msgs || []).filter(x => x.de !== "nota").slice(-1)[0] || {};
    const ESP = { c1: 3, c2: 26, c4: 41, c5: 12, c6: 900 };
    const esperando = (c) => c.status !== "resolvida" && (ultimoB(c) || {}).de === "in";
    const espMin = (c) => c.espera != null ? c.espera : (ESP[c.id] != null ? ESP[c.id] : 1);
    const leadDe = (c) => leads.find(l => l.id === c.lead) || (c.contato ? { pessoa: c.contato.nome || c.contato.tel || c.contato.email, cargo: "", empresa: null, desconhecido: true, tel: c.contato.tel, email: c.contato.email } : {});

    const q = slug(S.busca);
    const noFiltro = (c, aba) => aba === "todos" ? true : aba === "abertas" ? c.status !== "resolvida" : c.status === aba;
    const TIPOS = { msg: ["Mensagens", ["WhatsApp"]], tel: ["Ligações", ["Telefone"]], email: ["E-mails", ["E-mail"]] };
    const CAIXAS = [
      { k: "principal", nome: "Principal", num: "(11) 97700-4410 · WhatsApp", canal: "WhatsApp", match: "97700-4410" },
      { k: "comercial", nome: "Comercial", num: "(11) 4003-1020 · WhatsApp", canal: "WhatsApp", match: "Comercial" },
      { k: "suporte", nome: "Suporte", num: "(11) 4003-1030 · WhatsApp", canal: "WhatsApp", match: "4003-1030" },
      { k: "ia", nome: "Atendimento automático", num: "(11) 4003-1040 · respondido pelo NEXO", canal: "WhatsApp", match: "4003-1040", ia: true },
      { k: "disparos", nome: "Disparos", num: "(11) 4003-1050 · campanhas e cadências", canal: "WhatsApp", match: "4003-1050" }
    ];
    const caixaDe = (c) => {
      const cx = CAIXAS.find(x => x.canal === c.canal && (!x.match || (c.numero || "").indexOf(x.match) >= 0));
      return cx ? cx.k : null;
    };
    const viaDe = (c) => {
      const cx = CAIXAS.find(x => x.k === caixaDe(c));
      if (cx) return { nome: cx.nome, num: cx.num.split(" · ")[0] };
      const partes = (c.numero || "").split(" · ");
      return { nome: c.canal === "E-mail" ? "E-mail" : c.canal === "Telefone" ? "PABX" : partes[0] || c.canal, num: partes.length > 1 ? partes.slice(1).join(" · ") : (c.numero || "") };
    };
    const naCaixa = (c) => !S.caixa || S.caixa === "todas" || caixaDe(c) === S.caixa;
    const noCanal = (c) => naCaixa(c) && (S.canal === "todos" || !TIPOS[S.canal] || TIPOS[S.canal][1].indexOf(c.canal) >= 0);
    const bate = (c) => {
      if (!q) return true;
      const L = leadDe(c);
      return [L.pessoa, L.empresa].concat((c.msgs || []).map(m => m.t)).some(t => slug(t).indexOf(q) >= 0);
    };
    const visiveis = convs.filter(c => noFiltro(c, S.aba) && noCanal(c) && bate(c) && (!S.soNaoLidas || c.naoLidas > 0));
    const selId = S.sel && convs.some(c => c.id === S.sel) ? S.sel : (visiveis[0] || convs[0] || {}).id;
    const C = convs.find(c => c.id === selId) || {};
    const L = leadDe(C);
    const arr = C.msgs || [];
    this._selAtual = selId; this._nMsgs = arr.length;
    const primeiro = (L.pessoa || "").split(" ")[0];
    const aberta = C.status !== "resolvida";

    const selecionar = (c) => {
      this.setState({ mPane: "chat", sel: c.id, pop: null, nexo: null, texto: "", modo: "msg", cit: null, hov: null, novas: c.naoLidas ? { id: c.id, desde: (c.msgs || []).length - c.naoLidas } : null });
      if (c.naoLidas) gravarC(c.id, () => ({ naoLidas: 0 }));
    };

    const abrirPop = (tipo) => (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      this.setState(s => ({ pop: s.pop && s.pop.tipo === tipo ? null : { tipo, r: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } } }));
    };
    const sis = (t) => ({ de: "sis", t, h: agora(), dia: "Hoje" });
    const verPessoa = () => est() && est().irPara("/onface-preview/pessoa", L.pessoa, { pessoa: slug(L.pessoa), lead: L.id });
    const verEmpresa = () => L.empresa ? (est() && est().irPara("/onface-preview/empresa", L.empresa, { lead: L.id })) : diz("Sem empresa associada", "aviso");
    const copiar = (txt, rot) => {
      const ok = () => diz(rot + " copiado", "ok");
      try { navigator.clipboard.writeText(txt).then(ok, () => { this.copiarVelho(txt); ok(); }); } catch (e) { this.copiarVelho && this.copiarVelho(txt); ok(); }
    };
    this.copiarVelho = this.copiarVelho || ((t) => { const a = document.createElement("textarea"); a.value = t; a.style.position = "fixed"; a.style.opacity = "0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch (e) {} a.remove(); });

    const TAGS = { "Inbound": "Dispara cadência Primeiro contato", "Lead quente": "Dispara cadência Pós-proposta", "Enterprise": "Avisa o time de contas grandes", "Proposta": "Cria atividade de follow-up em 2 dias", "Retornar": "Sem fluxo automático" };
    const tagsL = ((Es0 && (Es0.ler("tagsLead", {}) || {})[L.id]) || (L.tag ? [L.tag] : [])).filter(Boolean);
    const alternarTag = (n) => {
      const E = est(); if (!E) return;
      const todas = Object.assign({}, E.ler("tagsLead", {}) || {});
      const atual = (todas[L.id] || (L.tag ? [L.tag] : [])).filter(Boolean);
      const tem = atual.indexOf(n) >= 0;
      todas[L.id] = tem ? atual.filter(x => x !== n) : atual.concat(n);
      E.gravar({ tagsLead: todas });
      diz(tem ? "Tag “" + n + "” removida" : "Tag “" + n + "” adicionada" + (TAGS[n] && TAGS[n] !== "Sem fluxo automático" ? " · " + TAGS[n].toLowerCase() : ""), "ok");
    };
    const criarTag = () => {
      const n = (this.state.novaTag || "").trim(); if (!n) return;
      const E = est(); if (!E) return;
      const criadas = (E.ler("tagsCriadas", null) || []).slice();
      if (!criadas.some(x => (typeof x === "string" ? x : x.nome) === n) && !TAGS[n]) criadas.push(n);
      E.gravar({ tagsCriadas: criadas });
      this.setState({ novaTag: "" });
      if (tagsL.indexOf(n) < 0) alternarTag(n);
    };
    const VARS = [
      ["primeiro_nome", "Primeiro nome", primeiro || "Ana"],
      ["nome", "Nome completo", L.pessoa || ""],
      ["empresa", "Empresa", L.empresa || "sua empresa"],
      ["cargo", "Cargo", L.cargo || ""],
      ["produto", "Produto de interesse", L.interesse || "Callface AI"],
      ["meu_nome", "Meu nome", EU.split(" ")[0]],
      ["protocolo", "Protocolo", "#" + (48000 + (+((C.id || "c1").replace(/\D/g, "")) || 1) * 37)]
    ];
    const preencher = (t) => VARS.reduce((acc, v) => acc.split("{" + v[0] + "}").join(v[2]), t || "");
    const TPL_PADRAO = [
      { id: "t1", nome: "Saudação inbound", time: "Vendas", cat: "Primeiro contato", escopo: "todos", autor: "Camila Reis", texto: "Olá, {primeiro_nome}! Aqui é {meu_nome}, da OnFace. Vi que você se interessou por {produto}. Posso te fazer duas perguntas rápidas para entender o cenário da {empresa}?" },
      { id: "t2", nome: "Envio de proposta", time: "Vendas", cat: "Proposta", escopo: "todos", autor: "Diego Nunes", texto: "{primeiro_nome}, segue a proposta atualizada com os ajustes que conversamos. Qualquer dúvida, estou por aqui." },
      { id: "t3", nome: "Agendar reunião", time: "Vendas", cat: "Reunião", escopo: "todos", autor: "Camila Reis", texto: "{primeiro_nome}, que tal uma conversa de 30 min para alinharmos os próximos passos? Tenho horário amanhã às 10h ou às 15h." },
      { id: "t4", nome: "Sem retorno", time: "Vendas", cat: "Follow-up", escopo: "todos", autor: "Ana Vitória", texto: "Oi, {primeiro_nome}! Passando para saber se conseguiu ver a mensagem anterior." },
      { id: "t5", nome: "Pós-reunião", time: "Vendas", cat: "Follow-up", escopo: "meu", autor: "Camila Reis", texto: "{primeiro_nome}, obrigado pela conversa hoje! Resumindo o que combinamos:\n\n1. \n2. \n\nTe envio a proposta até amanhã." },
      { id: "t6", nome: "Boas-vindas", time: "CS", cat: "Onboarding", escopo: "todos", autor: "Diego Nunes", texto: "Bem-vindo(a) à OnFace, {primeiro_nome}! Sou {meu_nome} e vou acompanhar a implantação da {empresa} de perto." },
      { id: "t7", nome: "Check-in mensal", time: "CS", cat: "Relacionamento", escopo: "todos", autor: "Diego Nunes", texto: "Oi, {primeiro_nome}! Como está a experiência com o {produto} por aí? Tem algo que eu possa ajudar a melhorar?" },
      { id: "t8", nome: "Chamado recebido", time: "Suporte", cat: "Atendimento", escopo: "todos", autor: "Ana Vitória", texto: "Recebemos sua solicitação, {primeiro_nome}. Protocolo {protocolo}. Retornamos em até 2 horas úteis." },
      { id: "t9", nome: "Problema resolvido", time: "Suporte", cat: "Encerramento", escopo: "todos", autor: "Ana Vitória", texto: "{primeiro_nome}, o ajuste foi concluído. Pode testar e me confirmar se ficou tudo certo?" },
      { id: "t10", nome: "Fora do horário", time: "Geral", cat: "Atendimento", escopo: "todos", autor: "Camila Reis", texto: "Oi, {primeiro_nome}! Nosso horário é de segunda a sexta, das 8h às 18h. Respondemos assim que voltarmos." }
    ];
    const TPLS = ((Es0 && Es0.ler("templates", null)) || TPL_PADRAO).filter(t => t.escopo === "todos" || t.autor === EU);
    const popItens = (() => {
      if (!S.pop) return { titulo: "", itens: [], w: 240 };
      const t = S.pop.tipo;
      if (t === "canal") return { titulo: "ENVIAR POR · " + (C.canal || "").toUpperCase(), w: 290, itens: ((D.NUMEROS || {})[C.canal] || [C.numero]).map(n => ({
        label: n, on: n === C.numero, nota: n === C.numero ? "Número desta conversa" : "",
        fn: () => { if (n === C.numero) return; gravarC(C.id, c => ({ numero: n, msgs: (c.msgs || []).concat(sis("Canal de envio: " + n)) })); diz("Respondendo por " + n, "ok"); }
      })) };
      if (t === "tags") {
        const criadas = (Es0 && Es0.ler("tagsCriadas", null)) || [];
        const nomes = Object.keys(TAGS).concat(criadas.map(x => typeof x === "string" ? x : x.nome).filter(n => n && !TAGS[n]));
        return { titulo: "TAGS DO CONTATO", w: 290, criar: true, itens: nomes.map(n => ({
          label: n, on: tagsL.indexOf(n) >= 0, nota: TAGS[n] ? TAGS[n] : "Sem fluxo automático",
          manter: true,
          fn: () => alternarTag(n)
        })) };
      }
      if (t === "vincular") {
        const E = est();
        const ls = ((E && E.ler("leads", null)) || D.LEADS || []).slice(0, 10);
        return { titulo: "VINCULAR A UM LEAD", w: 300, itens: ls.map(l => ({ label: l.pessoa, nota: [l.empresa, l.cargo].filter(Boolean).join(" · "),
          fn: () => { gravarC(C.id, c => ({ lead: l.id, contato: null, msgs: (c.msgs || []).concat(sis("Contato vinculado ao lead por " + EU)) })); diz("Conversa vinculada a " + l.pessoa, "ok"); } })) };
      }
      if (t === "conduz") return { titulo: "QUEM CONDUZ", w: 220, itens: EQUIPE.map(n => ({ label: n, nota: n === EU ? "Você" : "", on: S.reu && S.reu.resp === n, fn: () => this.setState(s => ({ reu: Object.assign({}, s.reu, { resp: n }) })) })) };
      if (t === "caixas") return { titulo: "NÚMEROS", w: 330, caixas: true, itens: [], _: [{ k: "todas", nome: "Todos os números", num: CAIXAS.length + " números" }].concat(CAIXAS).map(x => {
        const doX = convs.filter(c => x.k === "todas" || caixaDe(c) === x.k);
        const nl = doX.filter(c => c.naoLidas > 0).length;
        return { label: x.nome + " · " + doX.length + (nl ? " · " + nl + " não lida" + (nl > 1 ? "s" : "") : ""), nota: x.num, on: (S.caixa || "todas") === x.k, fn: () => this.setState({ caixa: x.k }) };
      }) };
      if (t === "abas") return { titulo: "STATUS", w: 260, itens: [["todos", "Todas as conversas", "#12171d"], ["abertas", "Abertas", "#a3a8a4"]].concat(["novo", "atendimento", "aguardando", "interno", "retornar", "resolvida"].map(k => [k, ST[k][0], ST[k][1]])).map(([k, l, cor]) => ({
        label: l + " · " + convs.filter(c => noFiltro(c, k) && noCanal(c)).length, on: S.aba === k, dot: cor,
        fn: () => this.setState({ aba: k })
      })) };
      if (t === "filtro") return { titulo: "TIPO DE CONVERSA", w: 230, itens: [["todos", "Todas", "Todos os canais"], ["msg", "Mensagens", "WhatsApp"], ["tel", "Ligações", "Telefone"], ["email", "E-mails", "E-mail"]].map(([k, l, n]) => ({
        label: l + " · " + convs.filter(c => k === "todos" || TIPOS[k][1].indexOf(c.canal) >= 0).length, nota: n, on: S.canal === k,
        fn: () => this.setState({ canal: k })
      })) };
      if (t === "transferir") return { titulo: "TRANSFERIR PARA", w: 240, itens: EQUIPE.filter(n => n !== C.resp).map(n => ({
        label: n, nota: n === EU ? "Você" : "",
        fn: () => { gravarC(C.id, c => ({ resp: n, msgs: (c.msgs || []).concat(sis("Transferido para " + n)) })); diz("Conversa transferida para " + n, "ok"); }
      })) };
      if (t === "status") return { titulo: "STATUS DA CONVERSA", w: 290, itens: ["novo", "atendimento", "aguardando", "interno", "retornar", "resolvida"].map(k => ({
        label: ST[k][0] + (k === "retornar" && C.status === "retornar" && C.retorno ? " · " + C.retorno : ""), nota: ST[k][2], on: C.status === k, dot: ST[k][1],
        fn: () => {
          if (C.status === k) return;
          if (k === "resolvida") return this.setState({ enc: { motivo: null, obs: "", tentou: false } });
          if (k === "retornar") return this.setState({ ret: { quando: "amanha", data: "", hora: "09:00", atv: true, tipo: "Follow up", titulo: "Retornar para " + primeiro, desc: "" } });
          const extra = k === "retornar" ? { retorno: "amanhã, 09:00" } : {};
          gravarC(C.id, c => Object.assign({ status: k, msgs: (c.msgs || []).concat(sis("Status: " + ST[k][0] + (k === "retornar" ? " · volta amanhã, 09:00" : ""))) }, extra));
          diz(k === "retornar" ? "Conversa volta para a fila amanhã às 09:00" : "Status: " + ST[k][0], "ok");
        }
      })) };
      if (t === "resp") return { titulo: "RESPONSÁVEL", w: 230, itens: EQUIPE.concat([null]).map(n => ({
        label: n || "Sem responsável", on: (C.resp || null) === n, nota: n === EU ? "Você" : "",
        fn: () => { gravarC(C.id, () => ({ resp: n })); diz(n ? "Responsável: " + n : "Conversa sem responsável", "ok"); }
      })) };
      if (t === "template") return { titulo: "MAIS USADOS", w: 340, itens: TPLS.slice(0, 4).map(tp => ({ label: tp.nome, nota: preencher(tp.texto), fn: () => this.setState({ texto: preencher(tp.texto) }) }))
        .concat([{ label: "Ver todos os templates · " + TPLS.length, nota: "Por time e categoria · criar novo", rodape: true, fn: () => this.setState({ lib: { time: "Todos", cat: null, busca: "", sel: null, form: null } }) }]) };
      if (t === "mais" && L.desconhecido) return { titulo: "CONTATO NOVO", w: 230, itens: [
        { label: "Criar lead", fn: () => this.setState({ nl: { id: C.id, nome: (C.contato && C.contato.nome) || "", cargo: "", tel: (C.contato && C.contato.tel) || "", email: (C.contato && C.contato.email) || "", empresa: "", interesse: "Não identificado", resp: C.resp || EU } }) },
        { label: "Vincular a lead existente", fn: () => this.setState({ pop: { tipo: "vincular", r: S.pop.r } }) },
        { label: "Marcar como não lida", fn: () => { gravarC(C.id, c => ({ naoLidas: Math.max(1, c.naoLidas || 0) })); diz("Marcada como não lida", "ok"); } }
      ] };
      if (t === "mais") return { titulo: "", w: 230, itens: [
        { label: "Ver pessoa", fn: verPessoa },
        { label: "Ver empresa", fn: verEmpresa },
        { label: "Abrir lead", fn: () => est() && est().abrir("detalhe", L.id) },
        { label: "Registrar atividade", fn: () => est() && est().abrir("atividade-nova", L.id) },
        { label: "Marcar como não lida", fn: () => { gravarC(C.id, c => ({ naoLidas: Math.max(1, c.naoLidas || 0) })); diz("Marcada como não lida", "ok"); } }
      ] };
      return { titulo: "", itens: [], w: 240 };
    })();
    const popStyle = (() => {
      if (!S.pop) return "";
      const r = S.pop.r, w = popItens.w;
      const alto = Math.min(480, 16 + (popItens.caixas ? CAIXAS.length + 1 : popItens.itens.length) * (S.pop.tipo === "template" ? 70 : S.pop.tipo === "status" || S.pop.tipo === "tags" || S.pop.tipo === "caixas" ? 50 : S.pop.tipo === "vincular" ? 54 : 36) + (popItens.titulo ? 28 : 0) + (popItens.criar ? 48 : 0));
      const cabeBaixo = r.bottom + 6 + alto < (typeof window !== "undefined" ? window.innerHeight : 900) - 8;
      const left = Math.max(8, Math.min(r.left, (typeof window !== "undefined" ? window.innerWidth : 1440) - w - 8));
      return "position:fixed;left:" + left + "px;" + (cabeBaixo ? "top:" + (r.bottom + 6) + "px;" : "bottom:" + ((typeof window !== "undefined" ? window.innerHeight : 900) - r.top + 6) + "px;")
        + "width:" + w + "px;max-height:" + alto + "px;overflow:auto;z-index:95;background:#fff;border-radius:12px;padding:5px;box-shadow:0 12px 32px -8px rgba(18,23,29,.22),inset 0 0 0 1px #e3e7e8";
    })();

    const ultimaInTxt = (arr.filter(m => m.de === "in" && m.t).slice(-1)[0] || {}).t || "";
    const sugTexto = /proposta/i.test(ultimaInTxt)
      ? "Claro, " + primeiro + "! Envio a proposta atualizada ainda hoje até as 18h, já com o escopo de automações e o cronograma de onboarding."
      : /ligar|demonstra/i.test(ultimaInTxt) ? primeiro + ", consigo te ligar amanhã às 10h. Fica bom para você?"
      : /prazo/i.test(ultimaInTxt) ? primeiro + ", a implementação leva de 7 a 15 dias úteis, com acompanhamento do nosso time no onboarding."
      : /integra/i.test(ultimaInTxt) ? "Temos sim, " + primeiro + "! Integramos via API e webhooks. Qual ERP vocês usam?"
      : "Oi, " + primeiro + "! Obrigado pelo retorno. Posso te ajudar com mais alguma coisa sobre " + (L.interesse || "a solução") + "?";
    const sugChave = C.id + ":" + arr.length;

    const RESPOSTAS = ["Perfeito, obrigado!", "Ótimo, vou olhar com o time e te retorno.", "Pode mandar, fico no aguardo.", "Combinado!"];
    const pushOut = (msg) => {
      const id = C.id;
      gravarC(id, c => ({
        status: c.status === "atendimento" ? c.status : "atendimento",
        resp: c.resp || EU, hora: agora(),
        msgs: (c.msgs || []).concat(Object.assign({ de: "out", h: agora(), dia: "Hoje", lido: false }, msg))
      }));
      if (C.canal === "Telefone") return;
      this.depois(() => gravarC(id, c => ({ msgs: (c.msgs || []).map((m, i, a) => i === a.length - 1 && m.de === "out" ? Object.assign({}, m, { lido: true }) : m) })), 900);
      this.depois(() => this.setState({ digitando: id }), 1300);
      this.depois(() => {
        this.setState({ digitando: null });
        gravarC(id, c => ({ hora: agora(), espera: 0, naoLidas: (this.state.sel || selId) === id ? 0 : (c.naoLidas || 0) + 1,
          msgs: (c.msgs || []).concat({ de: "in", t: RESPOSTAS[(c.msgs || []).length % RESPOSTAS.length], h: agora(), dia: "Hoje" }) }));
      }, 3600);
    };
    const enviar = () => {
      const txt = (S.texto || "").trim();
      const CL = S.colado && S.colado.id === C.id ? S.colado : null;
      if (CL && S.modo !== "nota") {
        pushOut(Object.assign({ img: CL.src, arq: CL.nome, tam: CL.tam }, txt ? { t: txt } : {}));
        this.setState({ texto: "", colado: null, cit: null, novas: null });
        return;
      }
      if (!txt) return;
      if (S.modo === "nota") {
        gravarC(C.id, c => ({ msgs: (c.msgs || []).concat({ de: "nota", t: txt, h: agora(), dia: "Hoje", autor: EU }) }));
        this.setState({ texto: "" });
        return diz("Nota interna salva · só o time vê", "ok");
      }
      const cit = S.cit && S.cit.id === C.id ? { quem: S.cit.quem, t: S.cit.t } : null;
      if (C.ia && C.ia.ate === "humano") { gravarC(C.id, c => ({ ia: null, msgs: (c.msgs || []).concat(sis(EU + " respondeu · NEXO saiu da conversa")) })); }
      pushOut(cit ? { t: txt, cit } : { t: txt });
      this.setState({ texto: "", cit: null, novas: null });
    };

    const dots = (cor) => React.createElement("span", { style: { display: "inline-flex", gap: 3, alignItems: "center" } },
      [0, 1, 2].map(i => React.createElement("span", { key: i, style: { width: 5, height: 5, borderRadius: 9999, background: cor, animation: "ofDot 1.1s " + (i * 0.15) + "s infinite ease-in-out" } })));

    const nexoRodar = (tipo) => {
      this.setState({ nexo: { tipo, carregando: true, id: C.id } });
      setTimeout(() => { const p = this.painelRef.current; if (p) p.scrollTo({ top: p.scrollHeight, behavior: "smooth" }); }, 80);
      this.depois(() => {
        if (!this.state.nexo || this.state.nexo.id !== C.id) return;
        const todos = arr.map(m => m.t || "").join(" ");
        const res = tipo === "resumo"
          ? { titulo: "RESUMO", texto: primeiro + " (" + (L.cargo || "contato") + ", " + (L.empresa || "sem empresa") + ") chegou por " + (L.origem || C.canal) + " com interesse em " + (L.interesse || "—") + ". Pediu por último: “" + ultimaInTxt + "”. Próximo passo sugerido: " + (L.acao || "definir próxima ação") + "." }
          : { titulo: "SENTIMENTO", texto: /obrigad|ótimo|perfeito|seria ótimo/i.test(todos) ? "Positivo · interesse alto. Tom cordial e pedidos objetivos — bom momento para avançar." : "Neutro · aguardando informação. Responda com um próximo passo claro." };
        this.setState({ nexo: Object.assign({ tipo, id: C.id }, res) });
        setTimeout(() => { const p = this.painelRef.current; if (p) p.scrollTo({ top: p.scrollHeight, behavior: "smooth" }); }, 80);
      }, 900);
    };
    const NX = S.nexo && S.nexo.id === C.id ? S.nexo : null;

    const novasDesde = S.novas && S.novas.id === C.id ? S.novas.desde : (C.naoLidas > 0 ? arr.length - C.naoLidas : -1);
    const nNovas = novasDesde >= 0 ? arr.length - novasDesde : 0;
    const iniEU = ini(C.resp || EU);
    /* ANTES: e-mail do lead montado como nome@empresa.com.br quando o lead existia. Falso: ninguém cadastrou esse endereço. Usa só o e-mail real. */
      const email = L.email || "Sem e-mail";
    const nId = +((L.id || "l1").replace(/\D/g, "")) || 1;
    const tel = L.desconhecido ? (L.tel || "Sem telefone") : "+55 11 9" + String(1000 + (nId * 739) % 9000) + "-" + String(1000 + (nId * 311) % 9000);
    const ligarCallface = () => {
      let num = String(L.telefone || tel || "").replace(/\D/g, "");
      if (num.length > 11 && num.indexOf("55") === 0) num = num.slice(2);
      if (num.length < 10) { diz("Contato sem telefone cadastrado", "erro"); return false; }
      (this.E ? this.E.abrirExterno("https://app.callface.ai/calls?call_to=" + num) : window.open("https://app.callface.ai/calls?call_to=" + num, "_blank"));
      diz("Abrindo o Callface para ligar para " + primeiro, "ok");
      return true;
    };
    const ehMail = C.canal === "E-mail";
    const assuntoBase = C.assunto || ((L.interesse || "Proposta") + " · " + (L.empresa || L.pessoa || ""));
    const msgs = arr.map((m, i) => {
      const prev = arr[i - 1], next = arr[i + 1];
      const temDia = !prev || prev.dia !== m.dia;
      const temNovas = i === novasDesde && nNovas > 0;
      const ehIn = m.de === "in", ehOut = m.de === "out";
      const ehMailM = ehMail && (ehIn || ehOut);
      const inicio = temDia || temNovas || !balao(prev) || prev.de !== m.de;
      const fim = !balao(next) || next.de !== m.de || next.dia !== m.dia || (i + 1 === novasDesde);
      const k = C.id + ":" + i;
      const hov = S.hov === k || S.reagir === k;
      const tocando = S.play && S.play.k === k;
      const secs = m.audio ? (+(m.audio.split(":")[0]) * 60 + +(m.audio.split(":")[1] || 0)) : 0;
      const p = tocando ? S.play.p : 0;
      const raio = ehIn ? (inicio ? 14 : 6) + "px 14px 14px " + (fim ? 4 : 6) + "px" : "14px " + (inicio ? 14 : 6) + "px " + (fim ? 4 : 6) + "px 14px";
      return {
        temDia, dia: m.dia, temNovas, novasLabel: nNovas === 1 ? "1 MENSAGEM NOVA" : nNovas + " MENSAGENS NOVAS",
        t: m.apagada ? "Você apagou esta mensagem" : (m.t || ""), h: m.h, autor: m.autor || "",
        ehSis: m.de === "sis", ehNota: m.de === "nota", ehBalao: (ehIn || ehOut) && !ehMail, ehEmailCard: ehMailM, ehIn, ehOut,
        mailNome: ehIn ? (L.pessoa || "") : (C.resp || EU), /* ANTES: remetente do e-mail enviado montado como <nome>@onface.com.br. Falso: o e-mail do usuário não chega aqui; vazio. */ mailEnd: ehIn ? email : "",
        /* ANTES: destinatário "comercial@onface.com.br" inventado. Sem e-mail real do usuário, só o nome. */ mailPara: ehIn ? (C.resp || EU) : (L.pessoa || "") + " <" + email + ">",
        mailAv: ehIn ? av(L.pessoa, 32, 11) : "flex:0 0 auto;width:32px;height:32px;border-radius:9999px;background:#12171d;color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center",
        mailCorpo: "font-size:13.5px;line-height:1.6;color:#1f252c;white-space:pre-wrap;text-wrap:pretty;" + (m.apagada ? "font-style:italic;color:#67787c" : ""),
        /* ANTES: assinatura com <nome>@onface.com.br e telefone (11) 4003-1020 inventados. Agora só nome. */ assinatura: (C.resp || EU) + " · OnFace",
        imgWa: m.img ? React.createElement("img", { src: m.img, alt: m.arq || "", onClick: () => { const w = window.open(); if (w) w.document.write('<body style="margin:0;background:#12171d;display:grid;place-items:center;min-height:100vh"><img src="' + m.img + '" style="max-width:100%;max-height:100vh">'); }, style: { display: "block", maxWidth: 260, maxHeight: 260, borderRadius: 10, margin: "0 0 4px", cursor: "zoom-in", background: "#eeeff3" } }) : null,
        imgMail: m.img ? React.createElement("img", { src: m.img, alt: m.arq || "", onClick: () => { const w = window.open(); if (w) w.document.write('<body style="margin:0;background:#12171d;display:grid;place-items:center;min-height:100vh"><img src="' + m.img + '" style="max-width:100%;max-height:100vh">'); }, style: { display: "block", maxWidth: 320, maxHeight: 260, borderRadius: 10, marginTop: 12, cursor: "zoom-in", boxShadow: "inset 0 0 0 1px #e3e7e8" } }) : null,
        temImg: !!m.img, img: m.img || "", verImg: () => { const w = window.open(); if (w) w.document.write('<title>' + (m.arq || 'Imagem') + '</title><body style="margin:0;background:#12171d;display:grid;place-items:center;min-height:100vh"><img src="' + m.img + '" style="max-width:100%;max-height:100vh">'); },
        temArq: !!m.arq && !m.img, arq: m.arq, tam: m.tam, ext: m.arq ? (m.arq.split(".").pop() || "").toUpperCase().slice(0, 4) : "",
        temTexto: !!m.t || !!m.apagada,
        temAudio: !!m.audio, playD: tocando ? "M7 4h4v16H7zM13 4h4v16h-4z" : "M7 4v16l13-8z", playTitulo: tocando ? "Pausar" : "Ouvir",
        tempoAudio: tocando ? "0:" + String(Math.floor(p * secs)).padStart(2, "0") : m.audio,
        tocar: () => this.tocar(k, secs || 10),
        barras: m.audio ? Array.from({ length: 30 }, (_, j) => ({
          style: "flex:1;min-width:2px;border-radius:9999px;height:" + Math.round(5 + 17 * Math.abs(Math.sin(j * 1.37 + 0.6) * Math.cos(j * 0.41))) + "px;background:" + (tocando && j / 30 < p ? "#12171d" : "#c4c9cb")
        })) : [],
        temCit: !!m.cit, citQuem: m.cit ? m.cit.quem : "", citT: m.cit ? m.cit.t : "",
        citStyle: "margin:0 0 6px;padding:6px 9px;border-radius:8px;min-width:0;max-width:100%;" + (ehOut ? "background:rgba(255,255,255,.65);box-shadow:inset 0 0 0 1px #cfe5da" : "background:#f6f6f3;box-shadow:inset 0 0 0 1px #e3e7e8"),
        tickCor: m.lido ? "#1f7256" : "#a3a8a4",
        avIni: ehIn ? ini(L.pessoa) : iniEU,
        avSlot: (ehIn ? av(L.pessoa, 28, 10) : "flex:0 0 auto;width:28px;height:28px;border-radius:9999px;background:#12171d;color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center") + ";align-self:flex-end" + (fim ? "" : ";visibility:hidden"),
        linha: "display:flex;align-items:flex-end;gap:8px;animation:ofIn .2s ease both;margin-top:" + (temDia || temNovas ? 4 : inicio ? 12 : 2) + "px;" + (ehOut ? "justify-content:flex-end;padding-left:56px" : "padding-right:56px"),
        coluna: "position:relative;display:flex;flex-direction:column;min-width:0;max-width:560px;" + (ehOut ? "align-items:flex-end" : "align-items:flex-start"),
        barraStyle: "position:absolute;bottom:-20px;" + (ehOut ? "right:10px" : "left:10px") + ";z-index:4;display:flex;align-items:center;gap:2px;padding:3px;border-radius:11px;background:#fff;box-shadow:0 10px 24px -8px rgba(18,23,29,.28),inset 0 0 0 1px #e3e7e8;animation:ofIn .12s ease both",
        hov,
        notaIa: m.de === "nota" && m.ia, notaHumana: m.de === "nota" && !m.ia,
        notaStyle: "width:100%;max-width:540px;margin:10px auto 2px;padding:9px 12px 10px;border-radius:11px;" + (m.ia ? "background:#fff;box-shadow:inset 0 0 0 1px #dbdede" : "background:#fff6f4;box-shadow:inset 0 0 0 1px #fadfd8"),
        notaTopo: "display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.06em;margin-bottom:3px;color:" + (m.ia ? "#12171d" : "#9c3210"),
        ehIa: !!m.ia,
        podeApagar: ehOut && !m.apagada,
        apagar: () => { this.setState({ hov: null }); gravarC(C.id, c => ({ msgs: (c.msgs || []).map((x, j) => j === i ? Object.assign({}, x, { apagada: true, t: "", arq: null, audio: null, cit: null, reacao: null }) : x) })); diz("Mensagem apagada para todos", "ok"); },
        txtStyle: "white-space:pre-wrap;" + (m.apagada ? "font-style:italic;color:#67787c" : ""),
        balao: "padding:8px 12px 6px;font-size:13.5px;line-height:1.45;color:#12171d;text-wrap:pretty;max-width:100%;border-radius:" + raio + ";"
          + (ehOut ? "background:#e6f4ee;box-shadow:inset 0 0 0 1px #d2e9df" : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8"),
        meta: "display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:10.5px;color:#67787c;margin-top:2px",
        enter: () => { if (this.state.hov !== k) this.setState({ hov: k }); },
        leave: () => { if (this.state.hov === k) this.setState({ hov: null }); },
        reagindo: S.reagir === k,
        abrirReagir: () => this.setState(s => ({ reagir: s.reagir === k ? null : k })),
        pickerStyle: "position:absolute;top:-50px;" + (ehOut ? "right:0" : "left:0") + ";z-index:3;display:flex;gap:2px;padding:4px;border-radius:9999px;background:#fff;box-shadow:0 10px 24px -8px rgba(18,23,29,.25),inset 0 0 0 1px #e3e7e8;animation:ofIn .14s ease both",
        reacoes: [["👍", "Curtir"], ["❤️", "Amei"], ["😂", "Haha"], ["😮", "Uau"], ["🙏", "Obrigado"], ["✅", "Feito"]].map(([emo, tit]) => ({
          emoji: emo, titulo: tit,
          style: "width:34px;height:34px;border-radius:9999px;border:0;cursor:pointer;font-size:18px;line-height:1;display:grid;place-items:center;transition:transform .12s;" + (m.reacao === emo ? "background:#eeeff3" : "background:transparent"),
          onClick: () => {
            this.setState({ reagir: null, hov: null });
            gravarC(C.id, c => ({ msgs: (c.msgs || []).map((x, j) => j === i ? Object.assign({}, x, { reacao: x.reacao === emo ? null : emo }) : x) }));
          }
        })),
        temReacao: !!m.reacao, reacao: m.reacao || "",
        reacaoStyle: "margin-top:-6px;" + (ehOut ? "margin-right:8px" : "margin-left:8px") + ";position:relative;z-index:1;height:24px;min-width:30px;padding:0 7px;border-radius:9999px;border:0;background:#fff;box-shadow:0 1px 2px rgba(18,23,29,.08),inset 0 0 0 1px #e3e7e8;cursor:pointer;display:inline-flex;align-items:center;justify-content:center",
        tirarReacao: () => gravarC(C.id, c => ({ msgs: (c.msgs || []).map((x, j) => j === i ? Object.assign({}, x, { reacao: null }) : x) })),
        responder: () => this.setState({ cit: { id: C.id, quem: ehIn ? primeiro : "Você", t: m.t || m.arq || "Áudio " + (m.audio || "") }, modo: "msg" }),
        copiar: () => copiar(m.t || m.arq || "", "Texto"),
        atividade: () => est() && est().abrir("atividade-nova", L.id)
      };
    });

    const hojeMs = arr.filter(m => m.dia === "Hoje" && m.de !== "nota");
    const dur = hojeMs.length ? (minDe(hojeMs[hojeMs.length - 1].h) - minDe(hojeMs[0].h)) : null;
    const iIn = arr.findIndex(m => m.de === "in");
    const iOut = iIn >= 0 ? arr.findIndex((m, i) => i > iIn && m.de === "out") : -1;
    const primResp = iIn >= 0 && iOut >= 0 && arr[iIn].dia === arr[iOut].dia ? minDe(arr[iOut].h) - minDe(arr[iIn].h) : null;
    const espC = esperando(C);
    const espCm = espMin(C);

    const qual = (Es0 && (Es0.ler("qual", {}) || {})[L.id]) || {};
    const atv = (Es0 && (Es0.ler("atvs", {}) || {})[L.id]) || null;
    const ET = D.ETAPAS || {};
    const corEt = { novo: "#4a5560", em_contato: "#4c8fe0", qualificacao: "#9b8bd8", qualificado: "#2f9e7a", oportunidade: "#fe4f2b", nutricao: "#c8a86a", desqualificado: "#4a5560" };
    const TRILHA = ["novo", "em_contato", "qualificacao", "qualificado", "oportunidade"];
    const posEt = TRILHA.indexOf(L.etapa);
    const numCurto = (C.numero || "").split(" · ").slice(-1)[0];

    const podeEnviar = !!(S.texto || "").trim() || !!(S.colado && S.colado.id === C.id && S.modo !== "nota");
    const abertas = convs.filter(c => c.status !== "resolvida");
    const fila = abertas.filter(esperando);
    const estourado = fila.filter(c => espMin(c) > 15);

    const itemDe = (c) => {
      const Lc = leadDe(c), u = ultima(c), on = c.id === selId, nl = c.naoLidas > 0, esp = esperando(c), m = espMin(c), dig = S.digitando === c.id;
      return {
        nome: Lc.pessoa || "—", empresa: Lc.empresa || "Sem empresa", iniciais: ini(Lc.pessoa), hora: c.hora,
        horaStyle: "flex:0 0 auto;font-size:11px;white-space:nowrap;" + (nl ? "color:#c2330f;font-weight:600" : "color:#67787c"),
        avStyle: av(Lc.pessoa, 42, 12.5),
        previa: dig ? "digitando…" : (u.de === "out" ? "Você: " : "") + (u.t || (u.arq ? "Arquivo · " + u.arq : u.audio ? "Áudio · " + u.audio : "")),
        previaStyle: "flex:1;min-width:0;font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" + (dig ? "color:#1f7256;font-weight:500" : nl ? "color:#12171d;font-weight:500" : "color:#4a5560"),
        nomeStyle: "flex:1;min-width:0;font-size:13px;color:#12171d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:" + (nl ? "700" : "600"),
        canalD: ico[c.canal], badgeStyle: badge(c.canal),
        temNaoLidas: nl, naoLidas: String(c.naoLidas),
        statusLabel: ST[c.status][0], statusStyle: pill(c.status), statusDot: dot(c.status),
        via: viaDe(c).nome, viaTitulo: viaDe(c).nome + " · " + viaDe(c).num,
        esperando: esp, espera: fmtDur(m),
        esperaStyle: "display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:9999px;font-size:10.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;" + (m > 15 ? "background:#c2330f;color:#fff" : "background:#eeeff3;color:#4a5560"),
        resp: c.resp || "Sem responsável", respIni: c.resp ? ini(c.resp) : "—", respAv: avP(c.resp),
        style: "display:flex;align-items:flex-start;gap:11px;width:100%;padding:11px 10px;border:0;border-radius:12px;cursor:pointer;text-align:left;margin-bottom:2px;"
          + (on ? "background:#fff6f4;box-shadow:inset 0 0 0 1px #fadfd8" : "background:transparent"),
        onClick: () => selecionar(c)
      };
    };
    const gEsp = visiveis.filter(esperando).sort((a, b) => espMin(b) - espMin(a));
    const gAnd = visiveis.filter(c => c.status !== "resolvida" && !esperando(c));
    const gRes = visiveis.filter(c => c.status === "resolvida");
    const grupos = [["AGUARDANDO RESPOSTA", gEsp], ["EM ANDAMENTO", gAnd], ["RESOLVIDAS", gRes]]
      .filter(g => g[1].length).map(([t, l]) => ({ titulo: t, conta: String(l.length), itens: l.map(itemDe) }));

    const metricaCel = (i) => "display:flex;flex-direction:column;gap:3px;min-width:0;padding:9px 11px;" + (i ? "border-left:1px solid #e3e7e8" : "");
    const valorM = (cor) => "font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:700;letter-spacing:-.02em;line-height:1.1;font-variant-numeric:tabular-nums;color:" + cor;

    return {
      metricas: [
        { label: "NA FILA", valor: String(fila.length), alerta: false, style: metricaCel(0), valorStyle: valorM("#12171d") },
        { label: "SLA ESTOURADO", valor: String(estourado.length), alerta: estourado.length > 0, style: metricaCel(1), valorStyle: valorM(estourado.length ? "#c2330f" : "#12171d") },
        { label: "1ª RESP. MÉDIA", valor: "3m 40s", alerta: false, style: metricaCel(2), valorStyle: valorM("#12171d") }
      ],
      busca: S.busca,
      setBusca: (e) => this.setState({ busca: e.target.value }),
      canaisF: ["todos", "WhatsApp", "Instagram", "E-mail", "Telefone"].map(k => {
        const on = S.canal === k;
        const n = convs.filter(c => k === "todos" || c.canal === k).length;
        return {
          label: k === "todos" ? "Todos" : String(n), titulo: k === "todos" ? "Todos os canais" : k,
          temIco: k !== "todos", d: ico[k] || "",
          style: "flex:0 0 auto;display:flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;"
            + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #dbdede"),
          onClick: () => this.setState({ canal: k })
        };
      }),
      abas: [["todos", "Todos"], ["naolidas", "Não lidas"], ["aguardando", "Aguardando"], ["atendimento", "Em atendimento"], ["resolvida", "Resolvidas"]].map(([k, l]) => {
        const on = S.aba === k;
        return {
          label: l, conta: String(convs.filter(c => noFiltro(c, k) && noCanal(c)).length),
          style: "flex:0 0 auto;display:flex;align-items:center;gap:6px;height:38px;padding:0 8px;border:0;background:transparent;cursor:pointer;font-size:12.5px;white-space:nowrap;margin-bottom:-1px;"
            + (on ? "font-weight:600;color:#12171d;box-shadow:inset 0 -2px 0 #fe4f2b" : "font-weight:500;color:#67787c"),
          contaStyle: "font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:9999px;" + (on ? "background:#fff6f4;color:#c2330f" : "background:#eeeff3;color:#67787c"),
          onClick: () => this.setState({ aba: k })
        };
      }),
      lista: visiveis.map(itemDe),
      listaVazia: visiveis.length === 0,

      cv: {
        nome: L.pessoa || "—", iniciais: ini(L.pessoa), cargo: [L.cargo, L.empresa].filter(Boolean).join(" · ") || (L.desconhecido ? "Contato sem cadastro" : "—"),
        avStyle: av(L.pessoa, 42, 13), avMini: av(L.pessoa, 28, 10), avGrande: av(L.pessoa, 48, 15),
        sub: [L.empresa, L.cargo].filter(Boolean).join(" · "),
        canal: C.canal, canalD: ico[C.canal], canalCor: corCanal[C.canal] || "#4a5560", badgeStyle: badge(C.canal), numero: C.numero, numeroCurto: numCurto,
        desconhecido: !!L.desconhecido, conhecido: !L.desconhecido,
        desconhecidoInfo: (L.tel || L.email || "Este número") + " ainda não está no OnFace",
        ehEmail: ehMail, assunto: assuntoBase,
        threadInfo: arr.filter(balao).length + " e-mails · entre " + (L.pessoa || "") + " e " + (C.resp || EU),
        avChip: av(L.pessoa, 18, 8),
        via: viaDe(C).nome, viaNum: viaDe(C).num, viaTitulo: "Conversando pelo número " + viaDe(C).nome + " · " + viaDe(C).num,
        statusLabel: (ST[C.status] || ST.novo)[0] + (C.status === "retornar" && C.retorno ? " · " + C.retorno : ""), statusDot: dot(C.status),
        resp: C.resp || "Sem responsável", respIni: C.resp ? ini(C.resp) : "—", respAv: avP(C.resp),
        encerrarLabel: aberta ? "Encerrar" : "Reabrir",
        encerrarStyle: "display:flex;align-items:center;gap:6px;height:34px;padding:0 13px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;"
          + (aberta ? "background:#fe4f2b;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
        sla: !aberta ? "Resolvida" : espC ? "Cliente aguardando · " + fmtDur(espCm) : "Respondida",
        slaD: !aberta || !espC ? "M20 6 9 17l-5-5" : "M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
        slaStyle: "flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;"
          + (!aberta ? "background:#e6f4ee;color:#1f7256" : espC ? (espCm > 15 ? "background:#c2330f;color:#fff" : "background:#fff6f4;color:#c2330f") : "background:#e6f4ee;color:#1f7256"),
        verPessoa, verEmpresa,
        dados: [
          { d: ico["E-mail"], valor: email, titulo: "Copiar e-mail", acaoD: icoCopiar, onClick: () => copiar(email, "E-mail") },
          { d: ico.Telefone, valor: tel, titulo: "Copiar telefone", acaoD: icoCopiar, onClick: () => copiar(tel, "Telefone") }
        ],
        stats: [
          { label: "DURAÇÃO", valor: fmtDur(dur) },
          { label: "1ª RESPOSTA", valor: fmtDur(primResp), ok: primResp != null && primResp <= 5 },
          { label: "MENSAGENS", valor: String(arr.filter(balao).length) },
          { label: "PRIORIDADE", valor: C.prioridade || "Média", alta: C.prioridade === "Alta" }
        ].map(s => Object.assign(s, { valorStyle: "font-family:Inter,system-ui,sans-serif;font-size:14px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums;color:" + (s.ok ? "#1f7256" : s.alta ? "#c2330f" : "#12171d") })),
        temEmpresa: !!L.empresa, empresa: L.empresa, empIni: ini(L.empresa),
        segmento: (D.SEGMENTOS || {})[L.empresa] || "Serviços",
        ...(() => {
          const REL = {
            l13: { tipo: "cliente", plano: "Callface AI · 40 ramais", mrr: "R$ 4.890/mês", desde: "mar/2025", saude: "Boa", csm: "Diego Nunes", chamados: "1 aberto" },
            l9: { tipo: "cliente", plano: "PABX em nuvem · 25 ramais", mrr: "R$ 2.150/mês", desde: "ago/2024", saude: "Atenção", csm: "Ana Vitória", chamados: "2 abertos" },
            l12: { tipo: "oportunidade", fase: 1, valor: "R$ 53.154", previsao: "30/10", prob: "60%" },
            l7: { tipo: "oportunidade", fase: 0, valor: "R$ 27.800", previsao: "15/11", prob: "35%" }
          };
          const R = REL[L.id] || (L.etapa === "oportunidade" ? { tipo: "oportunidade", fase: 0, valor: "A definir", previsao: "—", prob: "20%" } : { tipo: "lead" });
          const chip = (bg, cor) => "flex:0 0 auto;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;background:" + bg + ";color:" + cor;
          const pillBase = "flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:9999px;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;font-size:11.5px;font-weight:600;color:#12171d;white-space:nowrap";
          const bar = (on, atual, cor) => "flex:1;height:4px;border-radius:9999px;background:" + (on ? "#12171d" : atual ? cor : "#e3e7e8");
          if (R.tipo === "cliente") {
            const cs = R.saude === "Boa" ? "#1f7256" : "#c8a86a";
            return {
              relTitulo: "Cliente", relArea: "CS", relChip: chip("#e6f4ee", "#1f7256"), relBtn: "Abrir cliente",
              etapa: "Ativo desde " + R.desde, etapaStyle: pillBase, etapaDot: "width:6px;height:6px;border-radius:9999px;background:#1f7256",
              temTrilha: false, trilha: [],
              campos: [
                { label: "Plano", valor: R.plano }, { label: "Valor", valor: R.mrr }, { label: "Saúde", valor: R.saude },
                { label: "Chamados", valor: R.chamados }, { label: "CSM", valor: R.csm }
              ],
              abrirRel: () => L.empresa ? est() && est().irPara("/onface-preview/empresa", L.empresa, { lead: L.id }) : diz("Sem empresa", "aviso")
            };
          }
          if (R.tipo === "oportunidade") {
            const FASES = ["Descoberta", "Proposta", "Negociação", "Fechamento"];
            return {
              relTitulo: "Oportunidade", relArea: "Vendas", relChip: chip("#fff6f4", "#c2330f"), relBtn: "Abrir oportunidade",
              etapa: FASES[R.fase], etapaStyle: pillBase, etapaDot: "width:6px;height:6px;border-radius:9999px;background:#fe4f2b",
              temTrilha: true, trilha: FASES.map((k, i) => ({ label: k, style: bar(i < R.fase, i === R.fase, "#fe4f2b") })),
              campos: [
                { label: "Valor", valor: R.valor }, { label: "Produto", valor: L.interesse || "—" }, { label: "Previsão", valor: R.previsao },
                { label: "Chance", valor: R.prob }, { label: "Closer", valor: L.resp || "—" }
              ],
              abrirRel: () => diz("Oportunidade em Vendas · tela em construção", "aviso")
            };
          }
          return {
            relTitulo: "Lead", relArea: "Pré-vendas", relChip: chip("#eeeff3", "#4a5560"), relBtn: "Abrir lead",
            etapa: (ET[L.etapa] && ET[L.etapa].label) || L.etapa || "—",
            etapaStyle: pillBase, etapaDot: "width:6px;height:6px;border-radius:9999px;background:" + (corEt[L.etapa] || "#4a5560"),
            temTrilha: posEt >= 0,
            trilha: TRILHA.map((k, i) => ({ label: (ET[k] && ET[k].label) || k, style: bar(i < posEt, i === posEt, corEt[k] || "#12171d") })),
            campos: [
              { label: "Origem", valor: L.origem || "—" },
              { label: "Campanha", valor: L.campanha || "—" },
              { label: "Entrada", valor: (arr[0] ? arr[0].dia + ", " + arr[0].h : "—") },
              { label: "Interesse", valor: (qual.interesses && qual.interesses.join(", ")) || (qual.interesse ? String(qual.interesse).split("|").filter(Boolean).join(", ") : "") || L.interesse || "—" },
              { label: "Dono", valor: L.resp || "—" }
            ],
            abrirRel: () => est() && est().abrir("detalhe", L.id)
          };
        })(),
        etapaAntiga: (ET[L.etapa] && ET[L.etapa].label) || L.etapa || "—",
        abrirLead: () => {},
        acao: (atv && atv.titulo) || L.acao || "Nenhuma ação marcada",
        acaoQuando: (atv && atv.hora) || L.venceEm || "Sem data",
        acaoIco: "flex:0 0 auto;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;" + ((atv || L.acao) ? "background:#fff6f4;color:#c2330f" : "background:#eeeff3;color:#67787c"),
        acaoBtnLabel: (atv || L.acao) ? "Ver" : "Criar",
        acaoBtn: () => est() && est().abrir((atv || L.acao) ? "atividade-ver" : "atividade-nova", L.id),
        tags: tagsL.map(t => ({ label: t, remover: () => alternarTag(t) })), semTags: !tagsL.length
      },
      contatoAcoes: [
        { canal: "WhatsApp", label: "WhatsApp", d: ico.WhatsApp, onClick: () => {
          const ja = convs.find(c => c.canal === "WhatsApp" && L.id && c.lead === L.id && c.status !== "resolvida");
          if (ja && ja.id !== C.id) { this.setState({ sel: ja.id, pop: null, lrel: null }); return diz("Abrindo o WhatsApp com " + primeiro, "ok"); }
          if (C.canal === "WhatsApp") { this.setState({ modo: "msg", pop: null }); return diz("Você já está no WhatsApp com " + primeiro, "ok"); }
          if (L.desconhecido && !L.tel) return diz("Contato sem telefone · crie o lead para cadastrar", "aviso");
          this.setState({ pop: null, lrel: null, nova: { canal: "WhatsApp", modoPara: L.desconhecido ? "digitar" : "buscar", digito: L.desconhecido ? String(L.tel || "") : "", busca: "", alvo: L.desconhecido ? null : L.id, livre: "", de: "principal", modoMsg: "escrever", tpl: "t1", assunto: "", texto: "" } });
        } },
        { canal: "Telefone", label: "Ligar", d: ico.Telefone, onClick: () => { ligarCallface(); } },
        { canal: "E-mail", label: "E-mail", d: ico["E-mail"], onClick: () => {
          const ja = convs.find(c => c.canal === "E-mail" && L.id && c.lead === L.id && c.status !== "resolvida");
          if (ja && ja.id !== C.id) { this.setState({ sel: ja.id, pop: null }); return diz("Abrindo o e-mail com " + primeiro, "ok"); }
          if (ehMail) { this.setState({ modo: "msg" }); return diz("Você já está no e-mail com " + primeiro, "ok"); }
          if (L.desconhecido && !L.email) return diz("Contato sem e-mail · crie o lead para cadastrar", "aviso");
          this.setState({ pop: null, nova: { canal: "E-mail", modoPara: L.desconhecido ? "digitar" : "buscar", digito: "", busca: "", alvo: L.desconhecido ? null : L.id, livre: L.desconhecido ? L.email : "", de: "email", modoMsg: "escrever", tpl: "t1", assunto: assuntoBase, texto: "" } });
        } },
        { canal: "reuniao", label: "Reunião", d: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", onClick: () => {
          const d = new Date(); d.setDate(d.getDate() + 1);
          const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
          this.setState({ reu: { data: iso, hora: "10:00", dur: "30 min", tipo: "Vídeo", resp: C.resp || EU, convidados: [], conv: "", titulo: (L.empresa || L.pessoa || "Cliente") + " x OnFace", desc: "", enviar: true, tentou: false } });
        } }
      ].filter(a => a.canal !== C.canal),

      filtroBtn: {
        label: S.canal !== "todos" && TIPOS[S.canal] ? TIPOS[S.canal][0] : "Filtro",
        style: "flex:0 0 auto;display:flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;"
          + (S.canal !== "todos" ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede")
      },
      cad: (() => {
        const cads = (Es0 && Es0.ler("cadencias", null)) || {};
        const reg = cads[L.id];
        const nome = reg === null ? null : (reg && (reg.nome || reg.cadencia || (typeof reg === "string" ? reg : null))) || (reg === undefined && D.cadenciaPadrao ? D.cadenciaPadrao(L) : null);
        const pausada = !!(reg && reg.pausada);
        const passo = (reg && reg.passo) || 2, total = (reg && reg.total) || 5;
        return {
          tem: !!nome, vazio: !nome, nome: nome || "",
          passo: (pausada ? "Pausada · " : "") + "Passo " + passo + " de " + total + " · próximo toque " + (L.venceEm || "amanhã"),
          barras: Array.from({ length: total }, (_, i) => ({ style: "flex:1;height:4px;border-radius:9999px;background:" + (i < passo - 1 ? "#1f7256" : i === passo - 1 ? (pausada ? "#c8a86a" : "#2f9e7a") : "#e3e7e8") })),
          btn: nome ? "Trocar" : "Incluir",
          onClick: () => est() && est().abrir("cadencia", L.id),
          pausarLabel: pausada ? "Retomar" : "Pausar",
          pausarD: pausada ? "M7 4v16l13-8z" : "M7 4h4v16H7zM13 4h4v16h-4z",
          pausar: () => {
            const E = est(); if (!E) return;
            const todas = Object.assign({}, E.ler("cadencias", null) || {});
            const atual = todas[L.id] && typeof todas[L.id] === "object" ? todas[L.id] : { nome, passo, total };
            todas[L.id] = Object.assign({}, atual, { nome: atual.nome || nome, pausada: !pausada });
            E.gravar({ cadencias: todas });
            diz(pausada ? "Cadência retomada" : "Cadência pausada · nenhum toque sai até retomar", "ok");
          },
          remover: () => {
            const E = est(); if (!E) return;
            const todas = Object.assign({}, E.ler("cadencias", null) || {});
            todas[L.id] = null;
            E.gravar({ cadencias: todas });
            diz("Lead removido da cadência " + nome, "ok");
          }
        };
      })(),
      caixa: (() => {
        const k = S.caixa || "todas";
        const x = k === "todas" ? { nome: "Todos os números", num: CAIXAS.length + " números", canal: null } : CAIXAS.find(y => y.k === k);
        const nl = convs.filter(c => c.naoLidas > 0 && (k === "todas" || caixaDe(c) === k)).length;
        return {
          nome: x.nome, num: x.num, ehIa: !!x.ia, temNaoLidas: nl > 0, naoLidas: String(nl),
          d: x.canal ? ico[x.canal] : "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
          icoStyle: "flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;" + (x.ia ? "background:#12171d;color:#fff" : "background:#fff;color:" + (x.canal ? (corCanal[x.canal] || "#4a5560") : "#12171d") + ";box-shadow:inset 0 0 0 1px #e3e7e8")
        };
      })(),
      abaAtual: (() => {
        const k = S.aba;
        const label = k === "todos" ? "Todas" : k === "abertas" ? "Abertas" : (ST[k] || ST.novo)[0];
        const cor = k === "todos" ? "#12171d" : k === "abertas" ? "#a3a8a4" : (ST[k] || ST.novo)[1];
        return { label, conta: String(convs.filter(c => noFiltro(c, k) && noCanal(c)).length), dot: "flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:" + cor };
      })(),
      naoLidasBtn: (() => {
        const n = convs.filter(c => c.naoLidas > 0 && noFiltro(c, S.aba) && noCanal(c)).length;
        const on = !!S.soNaoLidas;
        return {
          conta: String(n), onClick: () => this.setState(s => ({ soNaoLidas: !s.soNaoLidas })),
          style: "flex:0 0 auto;display:flex;align-items:center;gap:6px;height:34px;padding:0 8px 0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
          contaStyle: "font-size:11px;font-weight:700;min-width:20px;height:20px;padding:0 6px;border-radius:9999px;display:grid;place-items:center;" + (n ? "background:#fe4f2b;color:#fff" : on ? "background:#2a323b;color:#a3a8a4" : "background:#eeeff3;color:#67787c")
        };
      })(),
      pops: { tags: abrirPop("tags"), vincular: abrirPop("vincular"), conduz: abrirPop("conduz"), caixas: abrirPop("caixas"), abas: abrirPop("abas"), filtro: abrirPop("filtro"), canal: abrirPop("canal"), transferir: abrirPop("transferir"), status: abrirPop("status"), resp: abrirPop("resp"), template: abrirPop("template"), mais: abrirPop("mais") },
      pop: {
        aberto: !!S.pop, style: popStyle, titulo: popItens.titulo, temTitulo: !!popItens.titulo,
        ehCaixas: !!popItens.caixas,
        caixas: popItens.caixas ? [{ k: "todas", nome: "Todos os números", num: CAIXAS.length + " números conectados" }].concat(CAIXAS).map((x, i) => {
          const doX = convs.filter(c => x.k === "todas" || caixaDe(c) === x.k);
          const nl = doX.filter(c => c.naoLidas > 0).length;
          const on = (S.caixa || "todas") === x.k;
          return {
            nome: x.nome, num: x.num, ia: !!x.ia, naoIa: !x.ia, d: x.k === "todas" ? "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" : ico.WhatsApp,
            total: String(doX.length), temNl: nl > 0, nl: String(nl),
            icoStyle: "flex:0 0 auto;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;overflow:hidden;" + (x.ia ? "background:#12171d" : x.k === "todas" ? "background:#fff;color:#12171d;box-shadow:inset 0 0 0 1px #e3e7e8" : "background:#e6f4ee;color:#1f7256"),
            checkStyle: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:#12171d" : "background:transparent"),
            style: "display:flex;align-items:center;gap:10px;width:100%;padding:8px 9px;border-radius:9px;border:0;cursor:pointer;text-align:left;" + (on ? "background:#f6f6f3" : "background:transparent") + (i === 0 ? ";margin-bottom:4px;box-shadow:0 1px 0 #eef1f1" : ""),
            onClick: () => this.setState({ pop: null, caixa: x.k })
          };
        }) : [],
        temCriar: !!popItens.criar, novaTag: S.novaTag || "",
        setNovaTag: (e) => this.setState({ novaTag: e.target.value }),
        teclaTag: (e) => { if (e.key === "Enter") { e.preventDefault(); criarTag(); } },
        criarTag: () => criarTag(),
        criarStyle: "flex:0 0 auto;height:32px;padding:0 12px;border-radius:9999px;border:0;font-size:12px;font-weight:600;" + ((S.novaTag || "").trim() ? "background:#12171d;color:#fff;cursor:pointer" : "background:#eeeff3;color:#a3a8a4;cursor:not-allowed"),
        itens: popItens.itens.map(i => ({
          label: i.label, nota: i.nota || "", temNota: !!i.nota, on: !!i.on,
          temDot: !!i.dot, dot: "flex:0 0 auto;width:8px;height:8px;margin-top:5px;border-radius:9999px;background:" + (i.dot || "transparent"),
          style: "display:flex;align-items:" + (i.nota ? "flex-start" : "center") + ";gap:9px;width:100%;min-height:34px;padding:7px 9px;border-radius:8px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:" + (i.on || i.rodape ? "600" : "500") + ";color:" + (i.rodape ? "#c2330f" : "#1f252c") + (i.rodape ? ";border-top:1px solid #eef1f1;border-radius:0 0 8px 8px;margin-top:4px" : ""),
          onClick: () => { if (!i.manter) this.setState({ pop: null }); i.fn(); }
        }))
      },

      prioridades: ["Baixa", "Média", "Alta"].map(p => {
        const on = (C.prioridade || "Média") === p;
        return { label: p, onClick: () => gravarC(C.id, () => ({ prioridade: p })),
          style: "height:24px;padding:0 10px;border-radius:9999px;border:0;cursor:pointer;font-size:11.5px;white-space:nowrap;"
            + (on ? "font-weight:600;background:#fff;color:" + (p === "Alta" ? "#c2330f" : "#12171d") + ";box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560") };
      }),

      chatRef: this.chatRef,
      fileRef: this.fileRef,
      msgs,
      digitando: S.digitando === selId,
      pontos: dots("#67787c"),
      pontosClaros: dots("#a3a8a4"),

      sug: {
        carregando: !!(S.sug && S.sug.k === sugChave && S.sug.carregando),
        visivel: !!(S.sug && S.sug.k === sugChave && !S.sug.carregando) && S.modo === "msg",
        texto: sugTexto,
        pedir: () => {
          if (S.sug && S.sug.k === sugChave) return;
          this.setState({ sug: { k: sugChave, carregando: true } });
          this.depois(() => this.setState(s => s.sug && s.sug.k === sugChave ? { sug: { k: sugChave, carregando: false } } : null), 900);
        },
        btnStyle: "display:flex;align-items:center;gap:6px;height:30px;padding:0 10px 0 7px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;" + (S.sug && S.sug.k === sugChave ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
        usar: () => { this.setState({ texto: sugTexto, sug: null }); diz("Sugestão no campo · revise antes de enviar", "ok"); },
        dispensar: () => this.setState({ sug: null })
      },
      cit: {
        ativo: !!(S.cit && S.cit.id === C.id && S.modo === "msg"),
        quem: S.cit ? (S.cit.quem === "Você" ? "a você" : "a " + S.cit.quem) : "", t: S.cit ? S.cit.t : "",
        cancelar: () => this.setState({ cit: null })
      },

      modos: [["msg", "Mensagem"], ["nota", "Nota interna"], ["hist", "Histórico"]].map(([k, l]) => ({
        label: l, onClick: () => this.setState({ modo: k }),
        style: "height:38px;padding:0 10px;border:0;background:transparent;cursor:pointer;font-size:12.5px;white-space:nowrap;"
          + (S.modo === k ? "font-weight:600;color:#12171d;box-shadow:inset 0 -2px 0 " + (k === "nota" ? "#c2330f" : "#fe4f2b") : "font-weight:500;color:#67787c")
      })),
      lig: (() => {
        /* ANTES: o painel da ligação mostrava um relatório pronto (duração 3:12, urgência Alta, orçamento ≈ R$ 1.2xx, citações) copiado de ANALISES.c4 para qualquer ligação. Falso: não há transcrição/análise ligada; ninguém disse nada disso. Agora cai no estado "sem análise" (lig.nao). */
        const A = null;
        this._ehLig = !!A;
        if (!A) return { ativo: false, nao: true };
        const TIPOS = { "Dor": "#fe4f2b", "Objeção": "#d93c1a", "Preço": "#c8a86a", "Sinal de compra": "#1f7256", "Próximo passo": "#12171d", "Decisor": "#67787c" };
        const LP = S.lp && S.lp.id === C.id ? S.lp : { id: C.id, t: 0, on: false, v: 1 };
        const setLP = (p) => this.setState(s => ({ lp: Object.assign({}, (s.lp && s.lp.id === C.id) ? s.lp : { id: C.id, t: 0, on: false, v: 1 }, p) }));
        const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
        const seekTo = (t) => { setLP({ t: Math.max(0, Math.min(A.dur, t)) }); };
        const tocarDe = (t) => { setLP({ t, on: false }); setTimeout(() => this.ligPlay(C.id, A.dur, true), 0); };
        const falaAtual = A.falas.reduce((acc, x, i) => x[0] <= LP.t ? i : acc, 0);
        const atNome = (C.resp || EU).split(" ")[0];
        const clNome = (L.pessoa || "Cliente").replace(/^Dr\.?\s+/, "Dr. ").split(" ").slice(0, 2).join(" ");
        const N = 88;
        const quemEm = (t) => { let q = "at"; A.falas.forEach(x => { if (x[0] <= t) q = x[1]; }); return q; };
        const onda = Array.from({ length: N }, (_, i) => {
          const t = (i / N) * A.dur;
          const q = quemEm(t);
          const pert = A.falas.some(x => Math.abs(x[0] - t) < 1.2);
          const h = pert ? 5 : Math.round(7 + 25 * Math.abs(Math.sin(i * 1.93 + 0.4) * Math.cos(i * 0.37)));
          const tocado = t <= LP.t;
          const cor = q === "at" ? (tocado ? "#12171d" : "#c9ced1") : (tocado ? "#fe4f2b" : "#fbc9bc");
          return { style: "flex:1;min-width:1px;border-radius:9999px;height:" + h + "px;background:" + cor + ";transition:background .15s" };
        });
        const sx = (i) => (i / (A.sent.length - 1)) * 160, sy = (v) => 24 - v * 19;
        const linha = A.sent.map((v, i) => (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1)).join(" ");
        const C26 = 2 * Math.PI * 26;
        const q = slug(S.lbusca || "");
        const falasF = A.falas.map((x, i) => ({ x, i })).filter(o => !q || slug(o.x[2]).indexOf(q) >= 0);
        const feitos = (S.lpassos && S.lpassos[C.id]) || {};
        const aba = S.laba || "resumo";
        const ESEG = (on) => "height:30px;padding:0 14px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;" + (on ? "background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(18,23,29,.08)" : "background:transparent;color:#4a5560");
        const criarAtvDe = (titulo, tipo, quando) => {
          const E = est(); if (!E) return;
          const d = new Date(); if (quando === "Amanhã") d.setDate(d.getDate() + 1);
          const atvs = Object.assign({}, E.ler("atvs", {}) || {});
          atvs[L.id] = { titulo, tipo: tipo || "Follow up", desc: "Criada a partir da análise da ligação de " + A.quando.toLowerCase(), data: d.toISOString().slice(0, 10), hora: quando === "Amanhã" ? "10:00" : "16:00", situacao: "A fazer", resp: C.resp || EU };
          E.gravar({ atvs });
        };
        const textoWa = "Olá, Dr. " + ((L.pessoa || "").split(" ").slice(-1)[0] || "") + "! Como combinamos, segue o resumo: Callface AI atendendo 24h, agendando direto na agenda da clínica e confirmando pelo WhatsApp. Modelo por minuto, sem fidelidade e sem setup — perto de R$ 1.200/mês para o volume de vocês. Demo marcada para quinta, 15h. Qualquer dúvida, é só chamar!";
        const abrirWa = () => this.setState({ pop: null, lrel: null, nova: { canal: "WhatsApp", modoPara: "buscar", digito: "", busca: "", alvo: L.id, livre: "", de: "principal", modoMsg: "escrever", tpl: "t1", assunto: "", texto: textoWa } });
        const marcar = (k) => this.setState(s => { const all = Object.assign({}, s.lpassos || {}); const cur = Object.assign({}, all[C.id] || {}); cur[k] = true; all[C.id] = cur; return { lpassos: all }; });
        const nFeitos = A.passos.filter(p => feitos[p.k]).length;
        const bantOk = A.bant.filter(b => b.st === "Confirmado").length;
        return {
          ativo: true, nao: false,
          titulo: A.tipo + " de " + (L.pessoa || "contato"), status: "Atendida",
          quando: A.quando, numero: tel, duracao: mmss(A.dur), atendente: "Atendida por " + (C.resp || EU),
          geradoEm: A.geradoEm,
          baixar: () => {
            const sr = 8000, n = sr * A.dur, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
            const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
            w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
            v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
            for (let i = 0; i < n; i++) { const t = i / sr, env = Math.max(0, Math.sin(t * 2.3)) * (0.5 + 0.5 * Math.sin(t * 7.1)); v.setUint8(44 + i, 128 + Math.round(env * 38 * Math.sin(2 * Math.PI * (180 + 60 * Math.sin(t * 3)) * t))); }
            const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
            const a = document.createElement("a"); a.href = url; a.download = "ligacao-" + slug(L.pessoa || "contato") + "-" + new Date().toISOString().slice(0, 10) + ".wav";
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
            diz("Áudio da ligação baixado (" + mmss(A.dur) + ")", "ok");
          },
          abrirCallface: () => {
            const callId = A.callId || C.callId || "da659265-2876-4101-b735-7c35253f4c8c";
            (this.E ? this.E.abrirExterno("https://app.callface.ai/calls/" + encodeURIComponent(callId)) : window.open("https://app.callface.ai/calls/" + encodeURIComponent(callId), "_blank"));
            diz("Abrindo a ligação no Callface", "ok");
          },
          arco: (() => {
            const n = 34, on = Math.round(n * A.chance / 100), out = [];
            for (let i = 0; i < n; i++) {
              const a = Math.PI - (i / (n - 1)) * Math.PI;
              const c = Math.cos(a), sn = Math.sin(a);
              out.push({ x1: (100 + 72 * c).toFixed(2), y1: (100 - 72 * sn).toFixed(2), x2: (100 + 94 * c).toFixed(2), y2: (100 - 94 * sn).toFixed(2), cor: i < on ? "#fe4f2b" : "#eceef0" });
            }
            return out;
          })(),
          chanceSub: "Média de clínicas: " + (A.chance - 22) + "%",
          sentCurto: A.sent[A.sent.length - 1] > 0.3 ? "Positivo" : A.sent[A.sent.length - 1] < -0.2 ? "Negativo" : "Neutro",
          clPct: (100 - A.falaAt) + "%",
          ...(() => {
            const EIX = [["Descoberta", 8.6, 6.8], ["Escuta", 7.9, 7.2], ["Valor", 8.2, 6.4], ["Objeções", 6.4, 6.9], ["Fechamento", 8.8, 6.1]];
            const cx = 100, cy = 104, R = 80;
            const pt = (i, v, k) => { const a = -Math.PI / 2 + i * 2 * Math.PI / EIX.length; return [cx + Math.cos(a) * R * v / 10 * (k || 1), cy + Math.sin(a) * R * v / 10 * (k || 1)]; };
            const media = (EIX.reduce((s, x) => s + x[1], 0) / EIX.length).toFixed(1).replace(".", ",");
            const melhor = EIX.reduce((b, x) => (x[1] - x[2]) > (b[1] - b[2]) ? x : b);
            return {
              notaGeral: media,
              radarPts: EIX.map((x, i) => pt(i, x[1]).map(n => n.toFixed(1)).join(",")).join(" "),
              radarTime: EIX.map((x, i) => pt(i, x[2]).map(n => n.toFixed(1)).join(",")).join(" "),
              radarEixos: EIX.map((x, i) => {
                const [px, py] = pt(i, x[1]);
                const [lx0, ly0] = pt(i, 10, 1.1);
                const ang = -Math.PI / 2 + i * 2 * Math.PI / EIX.length, co = Math.cos(ang);
                return { nome: x[0], val: String(x[1]).replace(".", ","), px: px.toFixed(1), py: py.toFixed(1), lx: lx0.toFixed(1), ly: (ly0 + (i === 0 ? -6 : 2)).toFixed(1), ly2: (ly0 + (i === 0 ? 8 : 16)).toFixed(1), anc: "", pos: "position:absolute;left:" + ((lx0 + 56) / 312 * 100).toFixed(2) + "%;top:" + ((ly0 + 22) / 244 * 100).toFixed(2) + "%;transform:translate(" + (Math.abs(co) < 0.2 ? "-50%" : co > 0 ? "0" : "-100%") + "," + (i === 0 ? "-100%" : "-35%") + ");text-align:" + (Math.abs(co) < 0.2 ? "center" : co > 0 ? "left" : "right") };
              }),
              radarQuem: ((C.resp || EU).split(" ")[0]),
              radarDestaque: melhor[0] + " +" + (melhor[1] - melhor[2]).toFixed(1).replace(".", ",") + " vs. time"
            };
          })(),
          chance: A.chance, chanceNota: A.chanceNota, chanceCor: A.chance >= 60 ? "#1f7256" : A.chance >= 35 ? "#c8a86a" : "#d93c1a",
          chanceDash: (C26 * A.chance / 100).toFixed(1) + " " + C26.toFixed(1),
          urgencia: A.urgencia, urgNota: A.urgNota,
          urgBarras: [1, 2, 3].map(n => ({ style: "width:5px;height:" + (5 + n * 3) + "px;border-radius:2px;align-self:flex-end;background:" + (n <= A.urg ? "#d93c1a" : "#eef1f1") })),
          sentLabel: A.sentLabel, sentVirada: A.sentVirada, sentLinha: linha, sentArea: linha + " L160 48 L0 48 Z",
          falaAt: "flex:0 0 " + A.falaAt + "%;background:#12171d;border-radius:9999px",
          falaCl: "flex:1;background:#fe4f2b;border-radius:9999px",
          falaAtLabel: atNome + " " + A.falaAt + "%", falaClLabel: clNome + " " + (100 - A.falaAt) + "%",
          falaNota: "Cliente falou mais · " + A.interrup + " interrupção · maior fala " + A.maiorFala,
          atNome: atNome + " (OnFace)", clNome,
          play: () => this.ligPlay(C.id, A.dur),
          playTitulo: LP.on ? "Pausar" : "Ouvir ligação",
          playD: LP.on ? "M7 4h4v16H7zM13 4h4v16h-4z" : "M7 4v16l13-8z",
          tempo: mmss(LP.t) + " / " + mmss(A.dur),
          velLabel: LP.v + "×",
          trocarVel: () => setLP({ v: LP.v === 1 ? 1.5 : LP.v === 1.5 ? 2 : 1 }),
          seek: (e) => { const rc = e.currentTarget.getBoundingClientRect(); seekTo(((e.clientX - rc.left) / rc.width) * A.dur); },
          onda,
          marcas: A.momentos.map(m => ({
            titulo: mmss(m[0]) + " · " + m[1] + ": " + m[2],
            onClick: () => tocarDe(m[0]),
            style: "position:absolute;top:1px;left:" + ((m[0] / A.dur) * 100).toFixed(2) + "%;transform:translateX(-50%);width:12px;height:12px;padding:0;border-radius:9999px;border:0;cursor:pointer;box-shadow:0 0 0 2px #fff;background:" + TIPOS[m[1]]
          })),
          legenda: Object.keys(TIPOS).filter(k => A.momentos.some(m => m[1] === k)).map(k => ({ label: k, dot: "width:8px;height:8px;border-radius:9999px;background:" + TIPOS[k] })),
          abas: [["resumo", "Resumo"], ["mom", "Momentos · " + A.momentos.length]].map(([k, l]) => ({ label: l, style: ESEG(aba === k), onClick: () => this.setState({ laba: k }) })),
          abaResumo: aba !== "mom", abaTrans: false, abaMom: aba === "mom",
          tipo: A.tipo,
          passoPrincipal: "Próximo passo: " + A.passos[0].t,
          relAberto: false,
          abrirRel: () => { const E = est(); if (E) E.abrir("relatorio", L.id); },
          fecharRel: () => this.setState({ lrel: null }),
          objetivo: A.objetivo,
          blocos: [
            { titulo: "INTERESSES", d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", cor: "#1f7256", bg: "#e6f4ee", itens: A.interesses.map(t => ({ t })) },
            { titulo: "DORES", d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01", cor: "#c2330f", bg: "#fff6f4", itens: A.dores.map(t => ({ t })) },
            { titulo: "OBJEÇÕES", d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", cor: "#4a5560", bg: "#eeeff3", itens: A.objecoes.map(o => ({ t: o.t, r: o.r, temR: true })) }
          ].map(b => ({ titulo: b.titulo, d: b.d, n: String(b.itens.length), itens: b.itens.map(i => Object.assign({ temR: false, r: "" }, i)),
            icoStyle: "flex:0 0 auto;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:" + b.bg + ";color:" + b.cor,
            bullet: "flex:0 0 auto;width:5px;height:5px;border-radius:9999px;margin-top:7px;background:" + b.cor })),
          bantResumo: bantOk + " de " + A.bant.length + " critérios confirmados",
          bant: A.bant.map(b => ({ k: b.k, st: b.st, ev: b.ev,
            pill: "flex:0 0 auto;height:20px;padding:0 7px;border-radius:6px;display:inline-flex;align-items:center;font-size:10.5px;font-weight:700;" + (b.st === "Confirmado" ? "background:#e6f4ee;color:#1f7256" : b.st === "Parcial" ? "background:#f6f1e6;color:#8a6a2a" : "background:#eeeff3;color:#67787c") })),
          levarQual: () => { this.setState({ lrel: null, pop: null }); const E = est(); if (E) setTimeout(() => E.abrir("qualificar", L.id), 0); },
          resumo: A.resumo.map(t => ({ t })),
          chaves: A.chaves.map(([t, n]) => ({ t, n: "×" + n, style: "display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:9999px;font-size:" + (n >= 3 ? "13px;font-weight:600;background:#12171d;color:#fff" : n === 2 ? "12.5px;font-weight:600;background:#fff;color:#12171d;box-shadow:inset 0 0 0 1px #dbdede" : "12px;font-weight:500;background:#fafafa;color:#4a5560;box-shadow:inset 0 0 0 1px #eef1f1") })),
          passosFeitos: nFeitos + " de " + A.passos.length + " feitos",
          passos: A.passos.map(p => {
            const ok = !!feitos[p.k];
            return {
              t: p.t, meta: p.meta, acao: ok ? "Feito" : p.acao,
              tStyle: "font-size:13px;font-weight:600;" + (ok ? "color:#67787c;text-decoration:line-through" : "color:#12171d"),
              checkTitulo: ok ? "Desmarcar" : "Marcar como feito",
              check: "flex:0 0 auto;width:20px;height:20px;border-radius:6px;border:0;padding:0;display:grid;place-items:center;cursor:pointer;" + (ok ? "background:#1f7256;color:#fff" : "background:#fff;color:transparent;box-shadow:inset 0 0 0 1.5px #c9ced1"),
              alternar: () => this.setState(s => { const all = Object.assign({}, s.lpassos || {}); const cur = Object.assign({}, all[C.id] || {}); cur[p.k] = !cur[p.k]; all[C.id] = cur; return { lpassos: all }; }),
              btnStyle: "flex:0 0 auto;height:30px;padding:0 12px;border-radius:9999px;border:0;font-size:12px;font-weight:600;white-space:nowrap;" + (ok ? "background:#e6f4ee;color:#1f7256;cursor:default" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede;cursor:pointer"),
              onClick: () => {
                if (ok) return;
                if (p.wa) { marcar(p.k); return abrirWa(); }
                criarAtvDe(p.t, p.tipo, p.quando); marcar(p.k);
                diz("Atividade criada · " + p.t, "ok");
              }
            };
          }),
          busca: S.lbusca || "", setBusca: (e) => this.setState({ lbusca: e.target.value }),
          buscaInfo: q ? falasF.length + " trecho" + (falasF.length === 1 ? "" : "s") : A.falas.length + " falas",
          falas: falasF.map(({ x, i }) => {
            const at = x[1] === "at", on = i === falaAtual && (LP.on || LP.t > 0);
            return {
              h: mmss(x[0]), t: x[2], quem: at ? (C.resp || EU) : (L.pessoa || "Cliente"), ini: at ? ini(C.resp || EU) : ini(L.pessoa),
              av: "flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:10px;font-weight:700;" + (at ? "background:#12171d;color:#fff" : "background:#fff6f4;color:#c2330f"),
              style: "display:flex;align-items:flex-start;gap:10px;padding:9px 8px;border-radius:10px;cursor:pointer;transition:background .15s;" + (on ? "background:#fff6f4" : "background:transparent"),
              onClick: () => tocarDe(x[0])
            };
          }),
          momentos: A.momentos.map(m => ({
            h: mmss(m[0]), tipo: m[1], t: m[2], fala: (A.falas[m[3]] || [0, "", ""])[2],
            chip: "flex:0 0 auto;height:22px;padding:0 8px;border-radius:6px;display:inline-flex;align-items:center;font-size:11px;font-weight:700;white-space:nowrap;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:" + TIPOS[m[1]],
            onClick: () => tocarDe(m[0])
          })),
          rodape: "Análise gerada pelo Callface AI ao fim da ligação · " + nFeitos + "/" + A.passos.length + " próximos passos feitos",
          criarAtv: () => { this.setState({ lrel: null, pop: null }); const E = est(); if (E) setTimeout(() => E.abrir("atividade-nova", L.id), 0); },
          enviarWa: abrirWa,
          religar: () => {
            if (!ligarCallface()) return;
            this.setState({ lrel: null, pop: null });
            gravarC(C.id, c => ({ msgs: (c.msgs || []).concat(sis("Ligação iniciada no Callface para " + (L.pessoa || "contato"))) }));
          }
        };
      })(),
      modoHist: S.modo === "hist",
      modoEscrever: S.modo !== "hist",
      modoMsg: S.modo === "msg",
      historico: [
        { titulo: "Atendimento atual · " + (ST[C.status] || ST.novo)[0], meta: C.canal + " · " + (C.resp || "Sem responsável") + " · " + arr.filter(balao).length + " mensagens", quando: "Hoje", d: ico[C.canal] || "" },
        { titulo: "Encerrado · Resolvido", meta: "E-mail · " + (C.resp || EQUIPE[1]) + " · dúvida sobre contrato", quando: "12 set", d: ico["E-mail"] },
        { titulo: "Ligação de primeiro contato · 4:21", meta: "Telefone · " + EQUIPE[1], quando: "2 set", d: ico.Telefone }
      ],
      texto: S.texto,
      setTexto: (e) => this.setState({ texto: e.target.value }),
      teclaTexto: (e) => { if (e.key !== "Enter") return; if (ehMail && S.modo === "msg") { if (e.metaKey || e.ctrlKey) { e.preventDefault(); enviar(); } return; } if (!e.shiftKey) { e.preventDefault(); enviar(); } },
      atalhoEnviar: ehMail && S.modo === "msg" ? "⌘ Enter" : "Enter",
      atalhoLinha: ehMail && S.modo === "msg" ? "Enter" : "⇧ Enter",
      mail: {
        ativo: ehMail && S.modo === "msg",
        para: email,
        comCc: !!(S.mailCc && S.mailCc.id === C.id), semCc: !(S.mailCc && S.mailCc.id === C.id),
        mostrarCc: () => this.setState({ mailCc: { id: C.id, v: "" } }),
        cc: (S.mailCc && S.mailCc.id === C.id && S.mailCc.v) || "",
        setCc: (e) => this.setState({ mailCc: { id: C.id, v: e.target.value } }),
        assunto: S.mailAssunto && S.mailAssunto.id === C.id ? S.mailAssunto.v : "Re: " + assuntoBase,
        setAssunto: (e) => this.setState({ mailAssunto: { id: C.id, v: e.target.value } })
      },
      placeholder: S.modo === "nota" ? "Nota interna — só o time vê" : ehMail ? "Escreva sua resposta para " + primeiro : C.canal === "Telefone" ? "Registre o que foi falado na ligação" : "Mensagem para " + primeiro + " pelo " + (C.canal || ""),
      composerRef: this.composerRef,
      painelRef: this.painelRef,
      convRef: this.convRef,
      composerStyle: "border-radius:14px;" + (S.modo === "nota" ? "background:#fff6f4;box-shadow:inset 0 0 0 1px #fadfd8" : "background:#fff;box-shadow:inset 0 0 0 1px #dbdede,0 1px 2px rgba(18,23,29,.04)"),
      anexar: () => { const el = this.fileRef.current; if (el) el.click(); },
      colar: (e) => {
        const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(x => x.type && x.type.indexOf("image/") === 0);
        if (!it) return;
        const file = it.getAsFile(); if (!file) return;
        e.preventDefault();
        if (S.modo === "nota") return diz("Notas internas não aceitam imagem colada", "aviso");
        this.prepararImg(file, C.id);
      },
      colado: (() => {
        const CL = S.colado && S.colado.id === C.id ? S.colado : null;
        return { tem: !!CL, thumb: CL ? React.createElement("img", { src: CL.src, alt: "", style: { flex: "0 0 auto", width: 44, height: 44, borderRadius: 7, objectFit: "cover", background: "#eeeff3" } }) : null, src: CL ? CL.src : "", nome: CL ? CL.nome : "", info: CL ? CL.tam + " · Enter para enviar" : "", remover: () => this.setState({ colado: null }) };
      })(),
      grav: (() => {
        const G = S.grav && S.grav.id === C.id ? S.grav : null;
        const seg = G ? Math.floor((Date.now() - G.ini) / 1000) : 0;
        const tempo = Math.floor(seg / 60) + ":" + String(seg % 60).padStart(2, "0");
        /* `pararComAudio` devolve o arquivo gravado. O protótipo descartava os
           pedaços e mandava só a duração: o balão aparecia e nada saía para o
           WhatsApp. */
        const pararComAudio = () => new Promise((resolve) => {
          clearInterval(this._gravI);
          const encerrar = () => {
            if (this._stream) this._stream.getTracks().forEach(t => t.stop());
            this._rec = null; this._stream = null;
          };
          const rec = this._rec;
          if (!rec || rec.state === "inactive") { encerrar(); return resolve(null); }
          rec.onstop = () => {
            const pedacos = this._gravPedacos || [];
            this._gravPedacos = [];
            encerrar();
            if (!pedacos.length) return resolve(null);
            const blob = new Blob(pedacos, { type: rec.mimeType || "audio/webm" });
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result || "") || null);
            fr.onerror = () => resolve(null);
            fr.readAsDataURL(blob);
          };
          try { rec.stop(); } catch (x) { encerrar(); resolve(null); }
        });
        const parar = () => { clearInterval(this._gravI); if (this._rec) { try { this._rec.stop(); } catch (x) {} } if (this._stream) this._stream.getTracks().forEach(t => t.stop()); this._rec = null; this._stream = null; this._gravPedacos = []; };
        return {
          ativo: !!G, parado: !G,
          pode: S.modo !== "nota" && !ehMail && C.canal !== "Telefone",
          tempo,
          ponto: React.createElement("span", { style: { flex: "0 0 auto", width: 9, height: 9, borderRadius: 9999, background: "#d93c1a", animation: "ofRec 1s infinite ease-in-out" } }),
          barras: Array.from({ length: 34 }, (_, j) => {
            const h = G ? 4 + Math.round(Math.abs(Math.sin((seg * 3 + j) * 1.7)) * 16) : 4;
            return { style: "flex:0 0 3px;width:3px;border-radius:9999px;height:" + h + "px;background:" + (j < 34 - Math.min(34, seg * 2) ? "#dbdede" : "#12171d") };
          }),
          iniciar: () => {
            this.setState({ grav: { id: C.id, ini: Date.now() }, colado: null });
            clearInterval(this._gravI); this._gravI = setInterval(() => this.forceUpdate(), 250);
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) {
              navigator.mediaDevices.getUserMedia({ audio: true }).then(st => {
                if (!this.state.grav) { st.getTracks().forEach(t => t.stop()); return; }
                this._stream = st;
                this._gravPedacos = [];
                this._rec = new MediaRecorder(st);
                this._rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) (this._gravPedacos = this._gravPedacos || []).push(ev.data); };
                this._rec.start();
              }).catch(() => {});
            }
          },
          cancelar: () => { parar(); this.setState({ grav: null }); diz("Áudio descartado", "aviso"); },
          enviar: () => {
            if (seg < 1) { parar(); this.setState({ grav: null }); return diz("Áudio curto demais", "aviso"); }
            pararComAudio().then((dados) => {
              this.setState({ grav: null, novas: null });
              if (!dados) return diz("Não consegui gravar o áudio. Confira a permissão do microfone.", "erro");
              pushOut({ audio: tempo, audioData: dados, audioSeg: seg });
            });
          }
        };
      })(),
      arquivoEscolhido: (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.type && f.type.indexOf("image/") === 0 && S.modo !== "nota") { e.target.value = ""; return this.prepararImg(f, C.id); }
        const kb = f.size / 1024;
        const tam = kb > 1024 ? (kb / 1024).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(kb)) + " KB";
        e.target.value = "";
        /* O protótipo só mostrava o balão com nome e tamanho; o arquivo não
           saía. Agora o conteúdo vai junto e o aviso de sucesso só aparece
           depois que o envio é aceito (quem avisa é o adaptador). */
        const fr = new FileReader();
        fr.onload = () => pushOut({ arq: f.name, tam, arqData: String(fr.result || ""), mime: f.type || "" });
        fr.onerror = () => diz("Não consegui ler o arquivo.", "erro");
        fr.readAsDataURL(f);
      },
      enviar,
      enviarTitulo: S.modo === "nota" ? "Salvar nota" : "Enviar",
      enviarStyle: "flex:0 0 auto;width:36px;height:36px;margin-left:6px;border-radius:9999px;border:0;display:grid;place-items:center;transition:background .15s;"
        + (podeEnviar ? (S.modo === "nota" ? "background:#12171d;color:#fff;cursor:pointer" : "background:#fe4f2b;color:#fff;cursor:pointer") : "background:#eeeff3;color:#a3a8a4;cursor:not-allowed"),

      largo: S.w >= 1100,
      podePainel: true,
      mPane: S.mPane || "lista",
      voltarLista: () => this.setState({ mPane: "lista" }),
      painelR: (S.w < 1180 ? S.painelMob : true) ? "at-painel" : "at-painel-off",
      painelTitulo: (S.w < 1180 ? S.painelMob : S.painel) ? "Ocultar painel" : "Mostrar painel",
      painelBtnStyle: "width:34px;height:34px;border-radius:9999px;border:0;cursor:pointer;display:grid;place-items:center;" + (S.painel ? "background:#12171d;color:#fff" : "background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #dbdede"),
      alternarPainel: () => this.setState(s => s.w < 1180 ? { painelMob: !s.painelMob } : { painel: !s.painel }),
      painelStyle: "flex:0 0 " + (S.w >= 1180 && S.painel ? 340 : 0) + "px;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;background:#f6f6f3;transition:flex-basis .28s cubic-bezier(.2,.8,.2,1);" + (S.w >= 1180 && S.painel ? "border-left:1px solid #e3e7e8" : "border-left:0"),
      listaStyle: "flex:0 0 " + (S.w >= 1100 ? 350 : 272) + "px;min-width:0;display:flex;flex-direction:column;background:#fff;border-right:1px solid #e3e7e8",

      nexoAcoes: [
        ["resumo", "Resumir conversa", "Contexto, pedidos e próximo passo", "M4 6h16M4 12h16M4 18h10"],
        ["sentimento", "Ler sentimento", "Tom do cliente e momento da conversa", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"]
      ].map(([k, l, desc, d]) => {
        const on = !!(NX && NX.tipo === k);
        return {
          label: l, desc, d, onClick: () => nexoRodar(k),
          style: "display:flex;align-items:center;gap:10px;width:100%;padding:8px;border-radius:9px;border:0;cursor:pointer;text-align:left;" + (on ? "background:#f6f6f3" : "background:transparent"),
          icoStyle: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (on ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#1f252c")
        };
      }),
      nexo: {
        carregando: !!(NX && NX.carregando), n: String(arr.length),
        temTexto: !!(NX && NX.texto), titulo: NX ? NX.titulo : "", texto: NX ? NX.texto || "" : "",
        copiar: () => NX && NX.texto && copiar(NX.texto, "Texto"),
        fechar: () => this.setState({ nexo: null })
      },

      encerrarAbrir: () => {
        if (!aberta) { gravarC(C.id, c => ({ status: "atendimento", msgs: (c.msgs || []).concat(sis("Atendimento reaberto")) })); return diz("Atendimento reaberto", "ok"); }
        this.setState({ enc: { motivo: null, obs: "", tentou: false } });
      },
      ...(() => {
        const IA = C.ia || null;
        const X = S.iaCfg;
        const set = (p) => this.setState(s => ({ iaCfg: Object.assign({}, s.iaCfg, p) }));
        const ATES = [
          ["humano", "Até alguém do time responder", "Quando você mandar mensagem, o NEXO sai"],
          ["1h", "Por 1 hora", "Volta para você às " + (() => { const d = new Date(Date.now() + 36e5); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); })()],
          ["expediente", "Até o fim do expediente", "Até as 18:00 de hoje"],
          ["hora", "Até um horário", "Escolha a hora"],
          ["pedido", "Até o cliente pedir uma pessoa", "Sem prazo — sai quando pedirem atendimento humano"]
        ];
        const OBJ = ["Tirar dúvidas", "Qualificar o lead", "Fazer follow-up", "Agendar reunião", "Coletar dados", "Enviar materiais"];
        const TONS = ["Como eu", "Cordial", "Formal", "Direto"];
        const TOM_NOTA = { "Como eu": "Imita seu jeito de escrever nesta conversa: tamanho das frases, saudação e emojis", "Cordial": "Próximo e educado", "Formal": "Linguagem corporativa, sem gírias", "Direto": "Mensagens curtas e objetivas" };
        const LIM = [
          ["humano", "Passar para uma pessoa se pedirem", "Avisa o responsável na hora"],
          ["preco", "Não falar de preço ou desconto", "Responde que o time comercial envia a proposta"],
          ["prazo", "Não prometer prazos", "Encaminha perguntas de prazo para o time"]
        ];
        const rotuloAte = (c) => c.ate === "hora" ? "até " + (c.hora || "18:00") : c.ate === "expediente" ? "até 18:00" : c.ate === "1h" ? "por 1 hora" : c.ate === "pedido" ? "até pedirem uma pessoa" : "até alguém do time responder";
        const abrirCfg = () => this.setState({ pop: null, iaCfg: IA ? Object.assign({ editando: true }, IA) : { ate: "humano", hora: "18:00", objetivos: ["Tirar dúvidas", "Qualificar o lead"], tom: "Como eu", limites: { humano: true, preco: true, prazo: false }, instr: "" } });
        const ok = !!(X && (X.objetivos || []).length);
        return {
          ia: {
            ativa: !!IA,
            btnLabel: IA ? "NEXO ativo" : "Ativar NEXO",
            btnTitulo: IA ? "NEXO respondendo " + rotuloAte(IA) : "Deixar o NEXO responder",
            btnStyle: "display:flex;align-items:center;gap:7px;height:34px;padding:0 12px 0 8px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;" + (IA ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
            btnClick: abrirCfg,
            editar: abrirCfg,
            resumo: IA ? [rotuloAte(IA)].concat(IA.objetivos || []).join(" · ") + " · " + (IA.tom === "Como eu" ? "no seu tom" : "tom " + (IA.tom || "cordial").toLowerCase()) : "",
            assumir: () => { gravarC(C.id, c => ({ ia: null, msgs: (c.msgs || []).concat(sis(EU + " assumiu a conversa · NEXO desativado")) })); diz("Você assumiu a conversa", "ok"); }
          },
          iaM: {
            aberto: !!X, editando: !!(X && X.editando),
            sub: (L.pessoa || "") + " · " + (C.canal || ""),
            ates: ATES.map(([k, l, n], i) => {
              const on = !!(X && X.ate === k);
              return { label: l, nota: n, temHora: on && k === "hora", onClick: () => set({ ate: k }),
                linha: (i ? "border-top:1px solid #eef1f1;" : "") + (on ? "background:#f6f6f3" : "background:#fff"),
                radio: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;" + (on ? "box-shadow:inset 0 0 0 5px #12171d" : "box-shadow:inset 0 0 0 1.5px #c4c9cb") };
            }),
            hora: (X && X.hora) || "18:00", setHora: (e) => set({ hora: e.target.value }),
            objetivos: OBJ.map(o => {
              const on = !!(X && (X.objetivos || []).indexOf(o) >= 0);
              return { label: o, onClick: () => set({ objetivos: on ? X.objetivos.filter(x => x !== o) : (X.objetivos || []).concat(o) }),
                style: "height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (on ? "font-weight:600;background:#12171d;color:#fff" : "font-weight:500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") };
            }),
            tons: TONS.map(t => ({ label: t, onClick: () => set({ tom: t }),
              style: "display:grid;place-items:center;height:30px;padding:0;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;" + (X && X.tom === t ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560") })),
            limites: LIM.map(([k, l, n], i) => {
              const on = !!(X && X.limites && X.limites[k]);
              return { label: l, nota: n, onClick: () => set({ limites: Object.assign({}, X.limites, { [k]: !on }) }),
                linha: "display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;background:#fff;cursor:pointer;text-align:left;" + (i ? "border-top:1px solid #eef1f1" : ""),
                trilho: "flex:0 0 auto;width:36px;height:20px;border-radius:9999px;padding:2px;display:flex;" + (on ? "background:#12171d;justify-content:flex-end" : "background:#dbdede;justify-content:flex-start") };
            }),
            tomNota: TOM_NOTA[(X && X.tom) || "Como eu"] || "",
            contexto: [
              { label: "Conversa", valor: arr.filter(balao).length + " mensagens" },
              { label: "Lead", valor: [((D.ETAPAS || {})[L.etapa] || {}).label, L.interesse].filter(Boolean).join(" · ") || "—" },
              { label: "Empresa", valor: L.empresa || "sem empresa" },
              { label: "Notas internas", valor: String(arr.filter(m => m.de === "nota").length) }
            ].concat(L.acao ? [{ label: "Próxima ação", valor: L.acao }] : []),
            instr: (X && X.instr) || "", setInstr: (e) => set({ instr: e.target.value }),
            instrDica: "Ex: se perguntarem de integração, dizer que temos API e oferecer uma call técnica.",
            fechar: () => this.setState({ iaCfg: null }),
            desativar: () => { this.setState({ iaCfg: null }); gravarC(C.id, c => ({ ia: null, msgs: (c.msgs || []).concat(sis("NEXO desativado por " + EU)) })); diz("NEXO desativado nesta conversa", "ok"); },
            btnLabel: X && X.editando ? "Salvar" : "Ativar NEXO",
            btnStyle: "height:36px;padding:0 16px;border-radius:9999px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (ok ? "background:#fe4f2b;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
            confirmar: () => {
              if (!ok) return;
              const cfg = { ate: X.ate, hora: X.hora, objetivos: X.objetivos, tom: X.tom, limites: X.limites, instr: X.instr };
              const editando = X.editando;
              const id = C.id;
              this.setState({ iaCfg: null });
              gravarC(id, c => ({ ia: cfg, msgs: (c.msgs || []).concat(sis(editando ? "NEXO ajustado · " + rotuloAte(cfg) : "NEXO assumiu a conversa · " + rotuloAte(cfg)))
                .concat(editando ? [] : [{ de: "nota", ia: true, autor: "NEXO", t: "Li " + arr.filter(balao).length + " mensagens e o contexto do lead: " + [L.empresa, ((D.ETAPAS || {})[L.etapa] || {}).label, L.interesse].filter(Boolean).join(" · ") + ". Último pedido: “" + (ultimaInTxt || "—") + "”. Vou seguir com " + (cfg.objetivos || []).join(", ").toLowerCase() + ".", h: agora(), dia: "Hoje" }]) }));
              diz(editando ? "Configuração do NEXO salva" : "NEXO respondendo " + rotuloAte(cfg), "ok");
              if (!editando && (ultimoB(C) || {}).de === "in") {
                this.depois(() => this.setState({ digitandoIa: id }), 700);
                this.depois(() => {
                  this.setState({ digitandoIa: null });
                  gravarC(id, c => c.ia ? ({ hora: agora(), msgs: (c.msgs || []).concat({ de: "out", ia: true, t: sugTexto, h: agora(), dia: "Hoje", lido: true }, { de: "nota", ia: true, autor: "NEXO", t: "Respondi o último pedido de " + primeiro + ". Objetivo: " + (cfg.objetivos || []).join(", ").toLowerCase() + ". Aguardando retorno do cliente.", h: agora(), dia: "Hoje" }) }) : ({}));
                }, 2400);
                this.depois(() => gravarC(id, c => c.ia ? ({ hora: agora(), msgs: (c.msgs || []).concat({ de: "in", t: "Pode ser amanhã às 10h então", h: agora(), dia: "Hoje" }) }) : ({})), 6000);
                this.depois(() => gravarC(id, c => c.ia ? ({ hora: agora(), msgs: (c.msgs || []).concat(
                  { de: "out", ia: true, t: "Combinado, " + primeiro + "! Reservei amanhã às 10h e vou te mandar o convite. Até lá!", h: agora(), dia: "Hoje", lido: true },
                  { de: "nota", ia: true, autor: "NEXO", t: "Reunião combinada para amanhã às 10h com " + (c.resp || EU) + ". Criei a atividade e sigo acompanhando.", h: agora(), dia: "Hoje" }) }) : ({})), 8500);
                this.depois(() => { const E = est(); if (!E) return; const atvs = Object.assign({}, E.ler("atvs", {}) || {}); const d = new Date(); d.setDate(d.getDate() + 1); atvs[L.id] = { titulo: "Reunião com " + primeiro, tipo: "Reunião", desc: "Agendada pelo NEXO no atendimento", data: d.toISOString().slice(0, 10), hora: "10:00", situacao: "A fazer", resp: C.resp || EU }; E.gravar({ atvs }); }, 8600);
              }
            }
          }
        };
      })(),
      tplRef: this.tplRef,
      ...(() => {
        const E = est();
        const ESTILO_PILL = (on) => "height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (on ? "font-weight:600;background:#12171d;color:#fff" : "font-weight:500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
        const ESTILO_SEG = (on) => "display:grid;place-items:center;height:30px;padding:0;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;" + (on ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560");
        const leadsArr = (E && E.ler("leads", null)) || D.LEADS || [];
        const buscarLeads = (q) => { const s = slug(q); return leadsArr.filter(l => !s || slug((l.pessoa || "") + " " + (l.empresa || "")).indexOf(s) >= 0).slice(0, 6); };
        /* Vincular só aceita LEAD de verdade: contato sem cadastro entra na lista do desenho (id da conversa) e vincular a ele não grava nada. */
        const buscarLeadsReais = (q) => { const s = slug(q); return leadsArr.filter(l => !l.desconhecido && (!s || slug((l.pessoa || "") + " " + (l.empresa || "")).indexOf(s) >= 0)).slice(0, 6); };
        const vincularA = (convId, leadId) => { gravarC(convId, c => ({ lead: leadId, contato: null, msgs: (c.msgs || []).concat(sis("Contato vinculado ao lead por " + EU)) })); };

        // Nova conversa
        const N = S.nova;
        const setN = (p) => this.setState(s => ({ nova: Object.assign({}, s.nova, p) }));
        const alvoL = N && N.alvo ? leadsArr.find(l => l.id === N.alvo) : null;
        const alvoPrimeiro = alvoL ? (alvoL.pessoa || "").split(" ")[0] : "";
        const encherPara = (t) => VARS.reduce((acc, v) => acc.split("{" + v[0] + "}").join(v[0] === "primeiro_nome" ? (alvoPrimeiro || "tudo bem") : v[0] === "nome" ? (alvoL ? alvoL.pessoa : "") : v[0] === "empresa" ? ((alvoL && alvoL.empresa) || "sua empresa") : v[0] === "produto" ? ((alvoL && alvoL.interesse) || "Callface AI") : v[2]), t || "");
        const tplsWa = N && N.canal === "E-mail" ? TPLS.filter(t => ["t1", "t2", "t3", "t6"].indexOf(t.id) >= 0) : TPLS.filter(t => ["t1", "t4", "t10", "t7"].indexOf(t.id) >= 0);
        const numsWa = CAIXAS.filter(x => !x.ia);
        const ehWaN = !N || N.canal !== "E-mail";
        const digitoOk0 = !!(N && (ehWaN ? (N.digito || "").replace(/\D/g, "").length >= 10 : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((N.digito || "").trim())));
        const livreDigitado = N && !N.livre && N.modoPara === "digitar" && digitoOk0 ? (ehWaN ? "+55 " + N.digito.trim() : N.digito.trim()) : "";
        const ehContatoLivre = N && !alvoL && (N.livre || "");
        const livreFinal = (N && N.livre) || livreDigitado;
        const msgOkWa = N && ((N.modoMsg || "escrever") === "template" ? !!N.tpl : !!(N.texto || "").trim());
        const okN = !!(N && (alvoL || livreFinal) && msgOkWa && (ehWaN || (N.assunto || "").trim()));
        const digitoOk = !!(N && (ehWaN ? (N.digito || "").replace(/\D/g, "").length >= 10 : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((N.digito || "").trim())));
        const usarDigito = () => { if (!digitoOk) return; setN({ livre: ehWaN ? "+55 " + N.digito.trim() : N.digito.trim(), alvo: null }); };
        const nova = {
          aberto: !!N,
          abrir: () => this.setState({ pop: null, nova: { canal: "WhatsApp", modoPara: "buscar", digito: "", busca: "", alvo: null, livre: "", de: "principal", modoMsg: "escrever", tpl: "t1", assunto: "", texto: "" } }),
          modosPara: [["buscar", "Buscar contato"], ["digitar", ehWaN ? "Digitar número" : "Digitar e-mail"]].map(([k, l]) => ({ label: l, style: ESTILO_SEG(((N && N.modoPara) || "buscar") === k), onClick: () => setN({ modoPara: k }) })),
          buscando: !!(N && !(alvoL || ehContatoLivre) && (N.modoPara || "buscar") === "buscar"),
          digitando: !!(N && !(alvoL || ehContatoLivre) && N.modoPara === "digitar"),
          digito: (N && N.digito) || "",
          setDigito: (e) => setN({ digito: ehWaN ? e.target.value.replace(/[^0-9 ()-]/g, "") : e.target.value }),
          digitoDica: ehWaN ? "(11) 90000-0000" : "nome@empresa.com.br",
          teclaDigito: (e) => { if (e.key === "Enter") { e.preventDefault(); usarDigito(); } },
          usarDigito: () => usarDigito(),
          usarStyle: "flex:0 0 auto;height:36px;padding:0 14px;border-radius:9999px;border:0;font-size:12.5px;font-weight:600;" + (digitoOk ? "background:#12171d;color:#fff;cursor:pointer" : "background:#eeeff3;color:#a3a8a4;cursor:not-allowed"),
          modosMsg: [["escrever", "Escrever"], ["template", "Usar template"]].map(([k, l]) => ({ label: l, style: ESTILO_SEG(((N && N.modoMsg) || "escrever") === k), onClick: () => setN({ modoMsg: k }) })),
          escrevendo: !!(N && (N.modoMsg || "escrever") === "escrever"),
          msgRotulo: ehWaN ? "Primeira mensagem" : "Mensagem",
          comTemplate: !!(N && N.modoMsg === "template"),
          textoDica: "Oi" + (alvoPrimeiro ? ", " + alvoPrimeiro : "") + "! Aqui é " + EU.split(" ")[0] + ", da OnFace…",
          fechar: () => this.setState({ nova: null }),
          canais: ["WhatsApp", "E-mail"].map(c => ({ label: c, style: ESTILO_SEG(N && N.canal === c), onClick: () => setN({ canal: c, de: c === "E-mail" ? "email" : "principal" }) })),
          temAlvo: !!(alvoL || ehContatoLivre), semAlvo: !(alvoL || ehContatoLivre),
          alvoNome: alvoL ? alvoL.pessoa : (N && N.livre) || "", alvoSub: alvoL ? [alvoL.empresa, alvoL.cargo].filter(Boolean).join(" · ") || "Lead" : "Novo contato · crie o lead depois",
          alvoIni: alvoL ? ini(alvoL.pessoa) : "+", alvoAv: av(alvoL ? alvoL.pessoa : "?", 32, 11),
          limparAlvo: () => setN({ alvo: null, livre: "", busca: "" }),
          busca: (N && N.busca) || "", setBusca: (e) => setN({ busca: e.target.value }),
          buscaDica: ehWaN ? "Buscar lead ou digitar um número" : "Buscar lead ou digitar um e-mail",
          resultados: (() => {
            if (!N) return [];
            const lista = buscarLeads(N.busca).map(l => ({ nome: l.pessoa, sub: [l.empresa, ((D.ETAPAS || {})[l.etapa] || {}).label].filter(Boolean).join(" · "), ini: ini(l.pessoa), av: av(l.pessoa, 28, 10), onClick: () => setN({ alvo: l.id, livre: "" }) }));
            const q = (N.busca || "").trim();
            const pareceContato = ehWaN ? q.replace(/\D/g, "").length >= 10 : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q);
            return (pareceContato ? [{ nome: "Usar " + q, sub: "Novo contato · sem lead ainda", ini: "+", av: "flex:0 0 auto;width:28px;height:28px;border-radius:9999px;background:#12171d;color:#fff;font-size:13px;font-weight:700;display:grid;place-items:center", onClick: () => setN({ livre: q, alvo: null }) }] : []).concat(lista);
          })(),
          origens: (ehWaN ? numsWa : [{ k: "email", nome: "E-mail" /* ANTES: "comercial@onface.com.br" inventado como caixa de saída; o e-mail real do usuário não chega aqui. */, num: "E-mail" }]).map(x => ({
            label: x.nome, titulo: x.num, style: ESTILO_PILL(N && N.de === x.k), onClick: () => setN({ de: x.k })
          })),
          ehWa: ehWaN, ehMail: !ehWaN,
          tpls: tplsWa.map(t => {
            const on = N && N.tpl === t.id;
            return { nome: t.nome, previa: encherPara(t.texto), onClick: () => setN(Object.assign({ tpl: t.id }, !ehWaN && !(N.assunto || "").trim() ? { assunto: t.nome + ((alvoL && alvoL.empresa) ? " · " + alvoL.empresa : "") } : {})),
              style: "display:flex;align-items:flex-start;gap:11px;width:100%;padding:10px 12px;border:0;border-top:1px solid #eef1f1;margin-top:-1px;cursor:pointer;text-align:left;" + (on ? "background:#f6f6f3" : "background:#fff"),
              radio: "flex:0 0 auto;width:16px;height:16px;margin-top:2px;border-radius:9999px;" + (on ? "box-shadow:inset 0 0 0 5px #12171d" : "box-shadow:inset 0 0 0 1.5px #c4c9cb") };
          }),
          assunto: (N && N.assunto) || "", setAssunto: (e) => setN({ assunto: e.target.value }),
          texto: (N && N.texto) || "", setTexto: (e) => setN({ texto: e.target.value }),
          btnLabel: ehWaN ? "Enviar e abrir conversa" : "Enviar e-mail",
          btnStyle: "height:36px;padding:0 16px;border-radius:9999px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (okN ? "background:#fe4f2b;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          criar: () => {
            if (!okN || !E) return;
            const cx = CAIXAS.find(x => x.k === N.de);
            const numero = ehWaN ? (cx ? (cx.k === "principal" ? "Pré-vendas · (11) 97700-4410" : cx.nome + " · " + cx.num.split(" · ")[0]) : "Pré-vendas · (11) 97700-4410") : "E-mail"; /* ANTES: remetente gravado como comercial@onface.com.br (inventado). */
            const tp = TPLS.find(t => t.id === N.tpl);
            const txt = N.modoMsg === "template" ? encherPara(tp ? tp.texto : "") : N.texto.trim();
            const id = "c" + Date.now();
            const conv = { id, lead: alvoL ? alvoL.id : null, contato: alvoL ? null : (ehWaN ? { nome: "", tel: livreFinal } : { nome: "", email: livreFinal }), canal: ehWaN ? "WhatsApp" : "E-mail", numero, assunto: ehWaN ? null : N.assunto.trim(), status: "aguardando", resp: EU, prioridade: "Média", naoLidas: 0, hora: agora(),
              msgs: [{ de: "sis", t: "Conversa iniciada por " + EU, h: agora(), dia: "Hoje" }, { de: "out", t: txt, h: agora(), dia: "Hoje", lido: false }] };
            E.gravar({ conversas: [conv].concat(juntar(E.ler("conversas", null) || D.CONVERSAS || [])) });
            this.setState({ nova: null, sel: id, aba: "todos", caixa: "todas", canal: "todos", busca: "", soNaoLidas: false });
            diz(ehWaN ? "Conversa iniciada com " + (alvoL ? alvoPrimeiro : livreFinal) : "E-mail enviado", "ok");
          }
        };

        // Vincular
        const V = S.vinc && S.vinc.id === C.id ? S.vinc : null;
        const vinc = {
          aberto: !!V,
          alternar: () => this.setState({ vinc: V ? null : { id: C.id, busca: "" } }),
          btnStyle: "min-width:0;display:flex;align-items:center;justify-content:center;height:34px;padding:0 8px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" + (V ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
          busca: (V && V.busca) || "", setBusca: (e) => this.setState({ vinc: { id: C.id, busca: e.target.value } }),
          itens: V ? buscarLeadsReais(V.busca).map(l => ({ nome: l.pessoa, sub: [l.empresa, l.cargo].filter(Boolean).join(" · "), ini: ini(l.pessoa), av: av(l.pessoa, 28, 10),
            onClick: () => { vincularA(C.id, l.id); this.setState({ vinc: null }); diz("Conversa vinculada a " + l.pessoa, "ok"); } })) : []
        };

        // Criar lead
        const NL = S.nl && S.nl.id === C.id ? S.nl : null;
        const setNL = (p) => this.setState(s => ({ nl: Object.assign({}, s.nl, p) }));
        const empresas = Array.from(new Set(leadsArr.map(l => l.empresa).filter(Boolean)));
        const qEmp = slug(NL && NL.empresa);
        const sugestoes = NL && qEmp ? empresas.filter(e => slug(e).indexOf(qEmp) >= 0 && e !== NL.empresa).slice(0, 4) : [];
        const existe = NL && NL.empresa && empresas.indexOf(NL.empresa.trim()) >= 0;
        const okNL = !!(NL && (NL.nome || "").trim());
        const nl = {
          aberto: !!NL,
          abrir: () => this.setState({ nl: { id: C.id, nome: (C.contato && C.contato.nome) || "", cargo: "", tel: (C.contato && C.contato.tel) || "", email: (C.contato && C.contato.email) || "", empresa: "", interesse: "Não identificado", resp: C.resp || EU } }),
          fechar: () => this.setState({ nl: null }),
          sub: "A partir da conversa · " + (C.canal || ""),
          nome: (NL && NL.nome) || "", setNome: (e) => setNL({ nome: e.target.value }),
          cargo: (NL && NL.cargo) || "", setCargo: (e) => setNL({ cargo: e.target.value }),
          tel: (NL && NL.tel) || "", setTel: (e) => setNL({ tel: e.target.value }),
          email: (NL && NL.email) || "", setEmail: (e) => setNL({ email: e.target.value }),
          empresa: (NL && NL.empresa) || "", setEmpresa: (e) => setNL({ empresa: e.target.value }),
          temSugestoes: sugestoes.length > 0,
          sugestoes: sugestoes.map(n => ({ nome: n, onClick: () => setNL({ empresa: n }) })),
          empresaInfo: !NL || !(NL.empresa || "").trim() ? "Opcional · dá para associar depois" : existe ? "Vincula à empresa existente" : "Cria a empresa “" + NL.empresa.trim() + "”",
          interesses: ["White Label", "Callface AI", "PABX", "Não identificado"].map(i => ({ label: i, titulo: i, style: ESTILO_PILL(NL && NL.interesse === i), onClick: () => setNL({ interesse: i }) })),
          resps: EQUIPE.map(n => ({ label: n + (n === EU ? " (você)" : ""), titulo: n, style: ESTILO_PILL(NL && NL.resp === n), onClick: () => setNL({ resp: n }) })),
          origem: C.canal === "E-mail" ? "Formulário" : "WhatsApp",
          btnStyle: "height:36px;padding:0 16px;border-radius:9999px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (okNL ? "background:#fe4f2b;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          criar: () => {
            if (!okNL || !E) return;
            const id = "l" + Date.now();
            const novo = { id, etapa: "novo", empresa: (NL.empresa || "").trim() || null, pessoa: NL.nome.trim(), cargo: (NL.cargo || "").trim(), origem: C.canal === "E-mail" ? "Formulário" : "WhatsApp", interesse: NL.interesse, resp: NL.resp, acao: null, dias: 0, tel: NL.tel, email: NL.email };
            E.gravar({ leads: [novo].concat(leadsArr) });
            vincularA(C.id, id);
            gravarC(C.id, c => ({ resp: c.resp || NL.resp }));
            this.setState({ nl: null });
            diz("Lead " + novo.pessoa + " criado em Pré-vendas", "ok");
          }
        };
        return { nova, vinc, nl };
      })(),
      lib: (() => {
        const X = S.lib;
        const set = (p) => this.setState(s => ({ lib: Object.assign({}, s.lib, p) }));
        const gravarT = (lista) => { const E = est(); if (E) E.gravar({ templates: lista }); };
        const TODOS = (Es0 && Es0.ler("templates", null)) || TPL_PADRAO;
        const vis = TODOS.filter(t => t.escopo === "todos" || t.autor === EU);
        const time = (X && X.time) || "Todos";
        const qb = slug(X && X.busca);
        const doTime = vis.filter(t => time === "Todos" ? true : time === "Meus" ? t.autor === EU : t.time === time);
        const lista = doTime.filter(t => (!X || !X.cat || t.cat === X.cat) && (!qb || slug(t.nome + " " + t.texto).indexOf(qb) >= 0));
        const selT = X && X.sel ? vis.find(t => t.id === X.sel) : null;
        const cur = selT || lista[0] || null;
        const cats = Array.from(new Set(doTime.map(t => t.cat))).sort();
        const lado = (on) => "display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border-radius:8px;border:0;cursor:pointer;text-align:left;font-size:12.5px;" + (on ? "font-weight:600;color:#12171d;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8" : "font-weight:500;color:#4a5560;background:transparent");
        const varsDe = (txt) => VARS.filter(v => (txt || "").indexOf("{" + v[0] + "}") >= 0).map(v => ({ nome: "{" + v[0] + "}" }));
        const F = X && X.form;
        const setF = (p) => this.setState(s => ({ lib: Object.assign({}, s.lib, { form: Object.assign({}, s.lib.form, p) }) }));
        const inserir = (v) => {
          const el = this.tplRef.current;
          const txt = (this.state.lib && this.state.lib.form && this.state.lib.form.texto) || "";
          const a = el ? el.selectionStart : txt.length, b = el ? el.selectionEnd : txt.length;
          const tok = "{" + v + "}";
          setF({ texto: txt.slice(0, a) + tok + txt.slice(b) });
          requestAnimationFrame(() => { const e2 = this.tplRef.current; if (e2) { e2.focus(); e2.selectionStart = e2.selectionEnd = a + tok.length; } });
        };
        const okF = !!(F && (F.nome || "").trim() && (F.texto || "").trim());
        return {
          aberto: !!X,
          sub: vis.length + " templates · " + vis.filter(t => t.autor === EU).length + " seus",
          busca: (X && X.busca) || "", setBusca: (e) => set({ busca: e.target.value }),
          fechar: () => this.setState({ lib: null }),
          novo: () => set({ form: { id: null, nome: "", time: "Vendas", cat: "", escopo: "meu", texto: "" } }),
          times: [["Todos", "Todos os times"], ["Vendas", "Vendas"], ["CS", "CS"], ["Suporte", "Suporte"], ["Geral", "Geral"], ["Meus", "Meus templates"]].map(([k, l]) => ({
            label: l, conta: String(vis.filter(t => k === "Todos" ? true : k === "Meus" ? t.autor === EU : t.time === k).length),
            style: lado(time === k), onClick: () => set({ time: k, cat: null, sel: null, form: null })
          })),
          cats: [{ k: null, l: "Todas" }].concat(cats.map(c => ({ k: c, l: c }))).map(c => ({
            label: c.l, conta: String(doTime.filter(t => !c.k || t.cat === c.k).length),
            style: lado((X && X.cat || null) === c.k), onClick: () => set({ cat: c.k, sel: null, form: null })
          })),
          catsNomes: Array.from(new Set(TODOS.map(t => t.cat))).map(c => ({ nome: c })),
          modoLista: !F, modoForm: !!F,
          vazio: !lista.length,
          itens: lista.map(t => {
            const on = cur && cur.id === t.id;
            return {
              nome: t.nome, time: t.time, cat: t.cat, previa: preencher(t.texto),
              escopo: t.escopo === "meu" ? "Só eu" : "Time todo",
              escopoStyle: "flex:0 0 auto;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:600;display:inline-flex;align-items:center;" + (t.escopo === "meu" ? "background:#fff6f4;color:#9c3210" : "background:#eeeff3;color:#4a5560"),
              style: "display:block;width:100%;padding:11px 12px;margin-bottom:6px;border-radius:12px;border:0;cursor:pointer;text-align:left;" + (on ? "background:#fff;box-shadow:inset 0 0 0 1.5px #12171d" : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8"),
              onClick: () => set({ sel: t.id })
            };
          }),
          temSel: !!cur, semSel: !cur,
          sel: cur ? {
            nome: cur.nome, meta: cur.time + " · " + cur.cat + " · " + (cur.escopo === "meu" ? "só você vê" : "todo o time vê") + " · por " + (cur.autor === EU ? "você" : cur.autor),
            para: (primeiro || "O CONTATO").toUpperCase(), previa: preencher(cur.texto),
            vars: varsDe(cur.texto), temVars: varsDe(cur.texto).length > 0,
            meu: cur.autor === EU,
            usar: () => { this.setState({ lib: null, texto: preencher(cur.texto), modo: "msg" }); diz("Template “" + cur.nome + "” no campo", "ok"); },
            editar: () => set({ form: Object.assign({}, cur) }),
            excluir: () => { gravarT(TODOS.filter(t => t.id !== cur.id)); set({ sel: null }); diz("Template excluído", "ok"); }
          } : {},
          form: F ? {
            titulo: F.id ? "Editar template" : "Novo template",
            nome: F.nome || "", setNome: (e) => setF({ nome: e.target.value }),
            time: F.time || "Vendas", setTime: (e) => setF({ time: e.target.value }),
            cat: F.cat || "", setCat: (e) => setF({ cat: e.target.value }),
            times: ["Vendas", "CS", "Suporte", "Geral"].map(t => ({ label: t, onClick: () => setF({ time: t }),
              style: "display:grid;place-items:center;height:30px;padding:0;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;" + ((F.time || "Vendas") === t ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560") })),
            cats: Array.from(new Set(TODOS.map(t => t.cat))).sort().map(c => {
              const on = F.cat === c && !F.catLivre;
              return { label: c, onClick: () => setF({ cat: c, catLivre: false }),
                style: "height:30px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (on ? "font-weight:600;background:#12171d;color:#fff" : "font-weight:500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") };
            }),
            catNova: F.catLivre ? (F.cat || "") : "",
            setCatNova: (e) => setF({ cat: e.target.value, catLivre: true }),
            catNovaStyle: "height:30px;width:150px;padding:0 12px;border-radius:9999px;border:0;outline:0;font-size:12.5px;" + (F.catLivre && F.cat ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
            escopos: [["meu", "Só para mim", "Aparece só na sua lista"], ["todos", "Para todo o time", "Todo mundo pode usar"]].map(([k, l, n]) => {
              const on = (F.escopo || "meu") === k;
              return { label: l, nota: n, onClick: () => setF({ escopo: k }),
                style: "display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:10px 12px;border-radius:11px;border:0;cursor:pointer;text-align:left;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#12171d;box-shadow:inset 0 0 0 1px #dbdede"),
                notaStyle: "display:block;font-size:11.5px;" + (on ? "color:#a3a8a4" : "color:#67787c") };
            }),
            vars: VARS.map(v => ({ nome: "{" + v[0] + "}", label: v[1], inserir: () => inserir(v[0]) })),
            texto: F.texto || "", setTexto: (e) => setF({ texto: e.target.value }),
            para: (primeiro || "O CONTATO").toUpperCase(),
            previa: preencher(F.texto) || "A prévia aparece aqui.",
            cancelar: () => set({ form: null }),
            btnLabel: F.id ? "Salvar alterações" : "Criar template",
            btnStyle: "flex:1;height:36px;padding:0 16px;border-radius:9999px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (okF ? "background:#12171d;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
            salvar: () => {
              if (!okF) return;
              const novo = { id: F.id || "t" + Date.now(), nome: F.nome.trim(), time: F.time || "Vendas", cat: (F.cat || "").trim() || "Geral", escopo: F.escopo || "meu", autor: F.autor || EU, texto: F.texto };
              gravarT(F.id ? TODOS.map(t => t.id === F.id ? novo : t) : TODOS.concat(novo));
              set({ form: null, sel: novo.id, time: novo.escopo === "meu" ? "Meus" : novo.time, cat: null });
              diz(F.id ? "Template atualizado" : "Template criado" + (novo.escopo === "todos" ? " para todo o time" : " · só você vê"), "ok");
            }
          } : {}
        };
      })(),
      reu: (() => {
        const X = S.reu;
        const set = (p) => this.setState(s => ({ reu: Object.assign({}, s.reu, p) }));
        const addConv = () => {
          const e = ((X && X.conv) || "").trim();
          if (!e) return;
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return set({ erroConv: true });
          set({ convidados: (X.convidados || []).concat(e), conv: "", erroConv: false });
          setTimeout(() => { const el = this.convRef.current; if (el) el.focus(); }, 60);
        };
        const ok = !!(X && X.data && X.hora && (X.titulo || "").trim());
        const dataBR = X && X.data ? X.data.split("-").reverse().slice(0, 2).join("/") : "";
        return {
          aberto: !!X, sub: (L.pessoa || "") + (L.empresa ? " · " + L.empresa : ""),
          email, titulo: (X && X.titulo) || "", setTitulo: (e) => set({ titulo: e.target.value }),
          data: (X && X.data) || "", setData: (e) => set({ data: e.target.value }),
          hora: (X && X.hora) || "", setHora: (e) => set({ hora: e.target.value }),
          dur: (X && X.dur) || "30 min", setDur: (e) => set({ dur: e.target.value }),
          durs: ["15 min", "30 min", "45 min", "1 hora"].map(d => ({ label: d === "1 hora" ? "60" : d.replace(" min", ""), onClick: () => set({ dur: d }),
            style: "display:grid;place-items:center;height:30px;padding:0;border-radius:9999px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (((X && X.dur) || "30 min") === d ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560") })),
          tipos: ["Vídeo", "Ligação", "Presencial"].map(t => ({ label: t, onClick: () => set({ tipo: t }),
            style: "display:grid;place-items:center;height:30px;padding:0;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;" + (X && X.tipo === t ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560") })),
          resp: (X && X.resp) || EU, respIni: ini((X && X.resp) || EU), setResp: (e) => set({ resp: e.target.value }),
          equipe: EQUIPE.map(n => ({ nome: n })),
          convidados: ((X && X.convidados) || []).map((g, i) => ({ email: g, remover: () => set({ convidados: X.convidados.filter((_, j) => j !== i) }) })),
          conv: (X && X.conv) || "", setConv: (e) => set({ conv: e.target.value, erroConv: false }),
          teclaConv: (e) => { if (e.key === "Enter") { e.preventDefault(); addConv(); } if (e.key === "Escape") { e.stopPropagation(); set({ addAberto: false, conv: "" }); } },
          addConv, erroConv: !!(X && X.erroConv),
          addAberto: !!(X && X.addAberto), addFechado: !(X && X.addAberto),
          abrirAdd: () => { set({ addAberto: true, conv: "", erroConv: false }); setTimeout(() => { const el = this.convRef.current; if (el) el.focus(); }, 60); },
          fecharAdd: () => set({ addAberto: false, conv: "", erroConv: false }),
          convStyle: "flex:1;min-width:0;height:32px;padding:0 12px;border-radius:9999px;border:0;outline:0;background:#fff;font-size:12.5px;box-shadow:inset 0 0 0 1px " + (X && X.erroConv ? "#d93c1a" : "#dbdede"),
          desc: (X && X.desc) || "", setDesc: (e) => set({ desc: e.target.value }),
          alternarEnviar: () => set({ enviar: !X.enviar }),
          enviarNota: C.canal === "E-mail" ? "Responde este e-mail com o convite e o link" : "Envia o convite pelo " + (C.canal || "canal") + " e o link por e-mail",
          trilho: "flex:0 0 auto;width:36px;height:20px;border-radius:9999px;padding:2px;display:flex;" + (X && X.enviar ? "background:#12171d;justify-content:flex-end" : "background:#dbdede;justify-content:flex-start"),
          fechar: () => this.setState({ reu: null }),
          btnStyle: "height:36px;padding:0 16px;border-radius:9999px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (ok ? "background:#fe4f2b;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          confirmar: () => {
            if (!ok) return;
            const E = est();
            if (E) {
              const atvs = Object.assign({}, E.ler("atvs", {}) || {});
              atvs[L.id] = { titulo: X.titulo.trim(), tipo: "Reunião", desc: [X.desc, X.tipo + " · " + X.dur, (X.convidados || []).length ? "Convidados: " + X.convidados.join(", ") : ""].filter(Boolean).join("\n"), data: X.data, hora: X.hora, situacao: "A fazer", resp: X.resp };
              E.gravar({ atvs });
            }
            gravarC(C.id, c => ({ msgs: (c.msgs || []).concat(sis("Reunião agendada · " + dataBR + ", " + X.hora + " · " + X.tipo + " com " + X.resp)) }));
            if (X.enviar && C.canal !== "Telefone") pushOut({ t: primeiro + ", agendei nossa conversa para " + dataBR + " às " + X.hora + " (" + X.dur + ", " + X.tipo.toLowerCase() + "). Te mandei o convite por e-mail. Até lá!" });
            this.setState({ reu: null });
            diz("Reunião agendada para " + dataBR + " às " + X.hora, "ok");
          }
        };
      })(),
      ret: (() => {
        const X = S.ret;
        const set = (p) => this.setState(s => ({ ret: Object.assign({}, s.ret, p) }));
        const d0 = new Date();
        const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        const mais = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
        const seg = (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; })();
        const h1 = new Date(Date.now() + 36e5);
        const hh = (d) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        const OP = [
          ["1h", "Em 1 hora", "Hoje, " + hh(h1), iso(h1), hh(h1)],
          ["tarde", "Hoje à tarde", "Hoje, 17:00", iso(d0), "17:00"],
          ["amanha", "Amanhã cedo", "Amanhã, 09:00", iso(mais(1)), "09:00"],
          ["segunda", "Segunda-feira", seg.getDate() + "/" + String(seg.getMonth() + 1).padStart(2, "0") + ", 09:00", iso(seg), "09:00"],
          ["escolher", "Escolher data", "Data e hora", "", ""]
        ];
        const q = X && X.quando;
        const esc = OP.find(o => o[0] === q) || OP[2];
        const data = q === "escolher" ? (X.data || "") : esc[3];
        const hora = q === "escolher" ? (X.hora || "09:00") : esc[4];
        const rotulo = q === "escolher" ? (data ? data.split("-").reverse().slice(0, 2).join("/") + ", " + hora : "") : esc[2].replace("Hoje, ", "hoje, ").replace("Amanhã, ", "amanhã, ");
        const ok = !!(X && data && hora && (!X.atv || (X.titulo || "").trim()));
        return {
          aberto: !!X, escolher: q === "escolher", data: (X && X.data) || "", hora: (X && X.hora) || "09:00",
          setData: (e) => set({ data: e.target.value }), setHora: (e) => set({ hora: e.target.value }),
          opcoes: OP.map(([k, l, n], i) => {
            const on = q === k;
            return { label: l, nota: n, onClick: () => set({ quando: k }),
              style: "display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:9px 12px;border-radius:11px;border:0;cursor:pointer;text-align:left;" + (i === OP.length - 1 ? "grid-column:span 2;" : "") + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#12171d;box-shadow:inset 0 0 0 1px #dbdede"),
              notaStyle: "display:block;font-size:11.5px;" + (on ? "color:#a3a8a4" : "color:#67787c") };
          }),
          atv: !!(X && X.atv), alternarAtv: () => set({ atv: !X.atv }),
          trilho: "flex:0 0 auto;width:36px;height:20px;border-radius:9999px;padding:2px;display:flex;" + (X && X.atv ? "background:#12171d;justify-content:flex-end" : "background:#dbdede;justify-content:flex-start"),
          tipos: ["Follow up", "Mensagem", "Ligação", "Reunião"].map(t => ({ label: t, onClick: () => set({ tipo: t }),
            style: "height:30px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (X && X.tipo === t ? "font-weight:600;background:#12171d;color:#fff" : "font-weight:500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") })),
          titulo: (X && X.titulo) || "", setTitulo: (e) => set({ titulo: e.target.value }),
          desc: (X && X.desc) || "", setDesc: (e) => set({ desc: e.target.value }),
          fechar: () => this.setState({ ret: null }),
          btnLabel: X && X.atv ? "Marcar retorno e criar atividade" : "Marcar retorno",
          btnStyle: "height:36px;padding:0 16px;border-radius:9999px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (ok ? "background:#12171d;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          confirmar: () => {
            if (!ok) return;
            gravarC(C.id, c => ({ status: "retornar", retorno: rotulo, msgs: (c.msgs || []).concat(sis("Status: Retornar depois · volta " + rotulo)) }));
            if (X.atv) {
              const E = est();
              if (E) {
                const atvs = Object.assign({}, E.ler("atvs", {}) || {});
                atvs[L.id] = { titulo: X.titulo.trim(), tipo: X.tipo, desc: (X.desc || "").trim(), data, hora, situacao: "A fazer", resp: C.resp || EU };
                E.gravar({ atvs });
              }
            }
            this.setState({ ret: null });
            diz("Conversa volta " + rotulo + (X.atv ? " · atividade criada" : ""), "ok");
          }
        };
      })(),
      tr: (() => {
        const X = S.tr;
        const set = (p) => this.setState(s => ({ tr: Object.assign({}, s.tr, p) }));
        const PRES = { "Camila Reis": ["Online", "#1f7256"], "Diego Nunes": ["Online", "#1f7256"], "Ana Vitória": ["Ausente · volta às 14h", "#c8a86a"] };
        const abertasDe = (n) => convs.filter(c => c.resp === n && c.status !== "resolvida").length;
        const DIAS7 = ["Hoje", "Ontem", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
        const conta = (p) => arr.filter(m => m.de !== "sis" && (p === "hoje" ? m.dia === "Hoje" : p === "7d" ? DIAS7.indexOf(m.dia) >= 0 : true)).length;
        const anteriores = (p) => p === "30d" ? 1 : p === "todo" ? 2 : 0;
        const PER = [["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["todo", "Tudo"]];
        const per = (X && X.periodo) || "7d";
        const comHist = !X || X.hist !== false;
        const descr = (p) => conta(p) + " mensage" + (conta(p) === 1 ? "m" : "ns") + (anteriores(p) ? " + " + anteriores(p) + " atendimento" + (anteriores(p) > 1 ? "s" : "") + " anterior" + (anteriores(p) > 1 ? "es" : "") : "");
        const para = X && X.para;
        const aba = (X && X.aba) || "pessoas";
        const AGENTES = [
          { k: "qualif", nome: "NEXO · Qualificação", desc: "Faz as perguntas de qualificação e marca o fit", obj: ["Qualificar o lead", "Tirar dúvidas"] },
          { k: "agenda", nome: "NEXO · Agendamento", desc: "Oferece horários e marca a reunião com o closer", obj: ["Agendar reunião"] },
          { k: "follow", nome: "NEXO · Follow-up", desc: "Retoma o contato e mantém a conversa aquecida", obj: ["Fazer follow-up"] },
          { k: "suporte", nome: "NEXO · Suporte N1", desc: "Resolve dúvidas comuns e abre chamado se precisar", obj: ["Tirar dúvidas", "Coletar dados"] }
        ];
        const rotDe = (p) => !p ? "" : p === "fila" ? "a fila do time" : p.indexOf("num:") === 0 ? "o número " + ((CAIXAS.find(x => "num:" + x.k === p) || {}).nome || "") : p.indexOf("ag:") === 0 ? ((AGENTES.find(g => "ag:" + g.k === p) || {}).nome || "") : p;
        const curto = (p) => !p ? "" : p === "fila" ? "a fila" : p.indexOf("num:") === 0 ? ((CAIXAS.find(x => "num:" + x.k === p) || {}).nome || "") : p.indexOf("ag:") === 0 ? "o NEXO" : p.split(" ")[0];
        return {
          aberto: !!X,
          abrir: () => this.setState({ tr: { para: null, nota: "", hist: true, periodo: "7d", tentou: false }, pop: null }),
          sub: (L.pessoa || "") + " · " + (C.canal || "") + " · hoje com " + (C.resp || "ninguém"),
          abas: [["pessoas", "Pessoas"], ["numeros", "Meus números"], ["agentes", "Agentes NEXO"]].map(([k, l]) => ({
            label: l, onClick: () => set({ aba: k, para: null }),
            style: "display:grid;place-items:center;height:30px;padding:0;border-radius:9999px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (aba === k ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560")
          })),
          temDica: aba !== "pessoas",
          dica: aba === "numeros" ? "A conversa passa a sair por outro número seu. O cliente recebe um aviso e o histórico continua junto." : "Um agente do NEXO assume a conversa com o contexto do lead e devolve para uma pessoa quando precisar.",
          pessoas: aba === "numeros" ? CAIXAS.filter(x => x.k !== caixaDe(C)).map(x => {
            const on = para === "num:" + x.k;
            return {
              nome: x.nome, info: x.num, temImg: !!x.ia, temIco: !x.ia, temIni: false, d: ico.WhatsApp, ini: "",
              av: "width:32px;height:32px;border-radius:9px;display:grid;place-items:center;overflow:hidden;" + (x.ia ? "background:#12171d" : "background:#e6f4ee;color:#1f7256"),
              presenca: "display:none",
              style: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:0;cursor:pointer;text-align:left;" + (on ? "background:#f6f6f3" : "background:#fff") + ";border-top:1px solid #eef1f1;margin-top:-1px",
              check: "flex:0 0 auto;width:18px;height:18px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c4c9cb"),
              onClick: () => set({ para: "num:" + x.k })
            };
          }) : aba === "agentes" ? AGENTES.map(g => {
            const on = para === "ag:" + g.k;
            return {
              nome: g.nome, info: g.desc, temImg: true, temIco: false, temIni: false, d: "", ini: "",
              av: "width:32px;height:32px;border-radius:9px;overflow:hidden;background:#12171d",
              presenca: "position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:9999px;background:#2f9e7a;box-shadow:0 0 0 2px #fff",
              style: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:0;cursor:pointer;text-align:left;" + (on ? "background:#f6f6f3" : "background:#fff") + ";border-top:1px solid #eef1f1;margin-top:-1px",
              check: "flex:0 0 auto;width:18px;height:18px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c4c9cb"),
              onClick: () => set({ para: "ag:" + g.k })
            };
          }) : EQUIPE.filter(n => n !== C.resp).concat(["fila"]).map(n => {
            const on = para === n;
            const ehFila = n === "fila";
            const pr = ehFila ? ["Quem estiver livre assume", "#4a5560"] : (PRES[n] || ["Online", "#1f7256"]);
            return {
              temImg: false, temIco: false, temIni: true, d: "",
              nome: ehFila ? "Fila do time" : n + (n === EU ? " (você)" : ""),
              ini: ehFila ? "TF" : ini(n),
              info: ehFila ? pr[0] : pr[0] + " · " + abertasDe(n) + (abertasDe(n) === 1 ? " conversa aberta" : " conversas abertas"),
              av: ehFila ? "width:32px;height:32px;border-radius:9999px;background:#fff;color:#4a5560;font-size:10.5px;font-weight:700;display:grid;place-items:center;box-shadow:inset 0 0 0 1px #dbdede" : av(n, 32, 11),
              presenca: ehFila ? "display:none" : "position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:9999px;background:" + pr[1] + ";box-shadow:0 0 0 2px #fff",
              style: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:0;cursor:pointer;text-align:left;" + (on ? "background:#f6f6f3" : "background:#fff") + ";border-top:1px solid #eef1f1;margin-top:-1px",
              check: "flex:0 0 auto;width:18px;height:18px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c4c9cb"),
              onClick: () => set({ para: n })
            };
          }),
          erroPessoa: !!(X && X.tentou && !para),
          nota: (X && X.nota) || "",
          setNota: (e) => set({ nota: e.target.value }),
          notaDica: "Ex: " + primeiro + " pediu a proposta atualizada até hoje às 18h. Já mandei o material de onboarding.",
          comHist,
          alternarHist: () => set({ hist: !comHist }),
          histResumo: comHist ? descr(per) + " vão junto" : "Só a nota e os dados do lead",
          switchTrilho: "flex:0 0 auto;width:36px;height:20px;border-radius:9999px;padding:2px;display:flex;transition:background .15s;" + (comHist ? "background:#12171d;justify-content:flex-end" : "background:#dbdede;justify-content:flex-start"),
          switchBola: "width:16px;height:16px;border-radius:9999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)",
          periodos: PER.map(([k, l]) => ({
            label: l, onClick: () => set({ periodo: k }),
            style: "display:grid;place-items:center;height:28px;padding:0;border-radius:9999px;border:0;cursor:pointer;font-size:12px;text-align:center;white-space:nowrap;" + (per === k ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560")
          })),
          rodape: para ? "Vai para " + rotDe(para) + (comHist ? " · com histórico de " + PER.find(p => p[0] === per)[1].toLowerCase() : " · sem histórico") : "",
          fechar: () => this.setState({ tr: null }),
          btnLabel: para ? "Transferir para " + curto(para) : "Transferir",
          btnStyle: "height:36px;padding:0 16px;border-radius:9999px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (para ? "background:#12171d;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          confirmar: () => {
            if (!para) return set({ tentou: true });
            const rot = rotDe(para);
            const hTxt0 = comHist ? "histórico de " + PER.find(p => p[0] === per)[1].toLowerCase() : "sem histórico";
            const nota0 = (X.nota || "").trim();
            const notaMsg = nota0 ? [{ de: "nota", t: nota0, h: agora(), dia: "Hoje", autor: EU + " → " + rot }] : [];
            if (para.indexOf("num:") === 0) {
              const cx = CAIXAS.find(x => "num:" + x.k === para);
              const numero = cx.nome + " · " + cx.num.split(" · ")[0];
              gravarC(C.id, c => Object.assign({ numero, msgs: (c.msgs || []).concat([sis("Transferido por " + EU + " para o número " + cx.nome + " · " + hTxt0)]).concat(notaMsg) },
                cx.ia ? { ia: { ate: "pedido", objetivos: ["Tirar dúvidas", "Qualificar o lead"], tom: "Como eu", limites: { humano: true, preco: true, prazo: false }, instr: nota0 } } : {}));
              this.setState({ tr: null });
              return diz("Conversa passou para o número " + cx.nome, "ok");
            }
            if (para.indexOf("ag:") === 0) {
              const g = AGENTES.find(x => "ag:" + x.k === para);
              gravarC(C.id, c => ({ ia: { ate: "pedido", objetivos: g.obj, tom: "Como eu", limites: { humano: true, preco: true, prazo: true }, instr: nota0, agente: g.nome }, msgs: (c.msgs || []).concat([sis("Transferido por " + EU + " para " + g.nome + " · " + hTxt0)]).concat(notaMsg) }));
              this.setState({ tr: null });
              return diz(g.nome + " assumiu a conversa", "ok");
            }
            const destino = para === "fila" ? null : para;
            const hTxt = comHist ? "histórico de " + PER.find(p => p[0] === per)[1].toLowerCase() : "sem histórico";
            const nota = (X.nota || "").trim();
            gravarC(C.id, c => ({
              resp: destino, status: destino ? c.status : "aguardando",
              msgs: (c.msgs || []).concat([sis("Transferido por " + EU + " para " + rot + " · " + hTxt)])
                .concat(nota ? [{ de: "nota", t: nota, h: agora(), dia: "Hoje", autor: EU + " → " + rot }] : [])
            }));
            this.setState({ tr: null });
            diz("Conversa transferida para " + rot + (nota ? " com nota" : ""), "ok");
          }
        };
      })(),
      enc: (() => {
        const X = S.enc;
        const motivos = ["Resolvido", "Sem retorno do cliente", "Encaminhado para outro time", "Engano ou spam", "Outro"];
        const precisaObs = !!(X && X.motivo === "Outro");
        const ok = !!(X && X.motivo && (!precisaObs || (X.obs || "").trim()));
        const set = (p) => this.setState(s => ({ enc: Object.assign({}, s.enc, p) }));
        return {
          aberto: !!X, sub: (L.pessoa || "") + " · " + (C.canal || ""),
          motivos: motivos.map(m => {
            const on = !!(X && X.motivo === m);
            return { label: m, onClick: () => set({ motivo: m }),
              style: "display:flex;align-items:center;gap:10px;width:100%;height:38px;padding:0 12px;border-radius:9px;border:0;cursor:pointer;text-align:left;font-size:13px;background:#fff;"
                + (on ? "font-weight:600;color:#12171d;box-shadow:inset 0 0 0 1.5px #12171d" : "font-weight:500;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
              radio: "flex:0 0 auto;width:15px;height:15px;border-radius:9999px;" + (on ? "box-shadow:inset 0 0 0 4.5px #12171d" : "box-shadow:inset 0 0 0 1.5px #c4c9cb") };
          }),
          obs: (X && X.obs) || "", obsLabel: precisaObs ? "OBSERVAÇÃO *" : "OBSERVAÇÃO",
          obsStyle: "width:100%;min-height:70px;padding:10px 12px;border-radius:9px;outline:0;resize:vertical;font-size:13px;background:#fff;border:1px solid " + (precisaObs && X.tentou && !(X.obs || "").trim() ? "#d93c1a" : "#dbdede"),
          setObs: (e) => set({ obs: e.target.value }),
          fechar: () => this.setState({ enc: null }),
          btnStyle: "height:36px;padding:0 16px;border-radius:9999px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (ok ? "background:#fe4f2b;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          confirmar: () => {
            if (!ok) return set({ tentou: true });
            const txt = "Atendimento encerrado · " + X.motivo + ((X.obs || "").trim() ? " — " + X.obs.trim() : "");
            gravarC(C.id, c => ({ status: "resolvida", naoLidas: 0, msgs: (c.msgs || []).concat(sis(txt)) }));
            this.setState({ enc: null });
            diz("Atendimento com " + primeiro + " encerrado", "ok");
          }
        };
      })()
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <AtendimentoDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as AtendimentoLiga };
