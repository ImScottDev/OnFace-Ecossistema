// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * RelatorioLigacao — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * RelatorioLigacaoDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `RelatorioLigacaoDesenho.tsx`, convertido por máquina e intocável.
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

import { RelatorioLigacaoDesenho } from "./RelatorioLigacaoDesenho";
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

  state = { aberto: false, leadId: null, convId: null, laba: "resumo", lbusca: "", lp: null, wa: null, rev: 0 };

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
    const tentar = () => {
      const E = this.E;
      if (!E) return false;
      if (!this._off) this._off = E.assinar(() => this.setState(s => ({ rev: s.rev + 1 })));
      if (!this._offP) this._offP = E.assinarPecas((peca, id) => { if (peca === "relatorio") this.abrir(id); });
      return true;
    };
    if (!tentar()) this._t = setInterval(() => { if (tentar()) clearInterval(this._t); }, 50);
    this._esc = (e) => { if (e.key !== "Escape" || !this.state.aberto) return; e.stopPropagation(); if (this.state.wa) this.setState({ wa: null }); else this.fechar(); };
    document.addEventListener("keydown", this._esc, true);
  }
  componentWillUnmount() {
    if (this._off) this._off(); if (this._offP) this._offP();
    clearInterval(this._t); clearInterval(this._ligI);
    document.removeEventListener("keydown", this._esc, true);
  }
  convs() { const E = this.E, D = this.dadosDoProto || {}; return (E && E.ler("conversas", null)) || D.CONVERSAS || []; }
  hora() { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  abrir(leadId) {
    const E = this.E; if (!E || !leadId) return;
    let alvo = this.convs().find(c => c.lead === leadId && c.canal === "Telefone");
    if (!alvo) {
      const D = this.dadosDoProto || {};
      const hh = this.hora();
      alvo = { id: "cl-" + leadId, lead: leadId, canal: "Telefone", numero: "PABX · (11) 4003-1020", status: "atendimento", resp: (D.EQUIPE || ["Camila Reis"])[0], prioridade: "Média", naoLidas: 0, hora: hh, msgs: [{ de: "sis", t: "Ligação realizada · 3:12", h: hh, dia: "Hoje" }] };
      E.gravar({ conversas: this.convs().concat(alvo) });
    }
    clearInterval(this._ligI);
    this.setState({ aberto: true, leadId, convId: alvo.id, laba: "resumo", lbusca: "", lp: { id: alvo.id, t: 0, on: false, v: 1 }, wa: null });
  }
  fechar() { clearInterval(this._ligI); this.setState({ aberto: false, wa: null, lp: null }); }
  play(dur, forcar) {
    const id = this.state.convId;
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
  gravarPassos(fn) { const E = this.E; if (!E) return; E.gravar({ ligPassos: fn(E.ler("ligPassos", {}) || {}) }); }
  renderVals() {
    const S0 = this.state;
    if (!S0.aberto) return { aberto: false, r: {}, w: { aberto: false }, fora: () => {} };
    const Es = this.E, D = this.dadosDoProto || {};
    const S = Object.assign({}, S0, { lpassos: (Es && Es.ler("ligPassos", {})) || {} });
    const est = () => this.E;
    const diz = (t, tom) => est() && est().avisar(t, tom);
    const ini = (n) => avatarDe(n, (D.iniciais || ((n) => (n || "").split(" ").slice(0, 2).map(p => [...p][0] || "").join("").toUpperCase()))(n));
    const slug = D.slug || ((s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""));
    const leads = (Es && Es.ler("leads", null)) || D.LEADS || [];
    const L = leads.find(x => x.id === S.leadId) || {};
    const C = this.convs().find(c => c.id === S.convId) || { id: S.convId, canal: "Telefone", resp: null, msgs: [] };
    const EU = (D.EQUIPE || ["Camila Reis"])[0];
    const nId = +((L.id || "l1").replace(/\D/g, "")) || 1;
    const tel = L.desconhecido ? (L.tel || "Sem telefone") : "+55 11 9" + String(1000 + (nId * 739) % 9000) + "-" + String(1000 + (nId * 311) % 9000);
    const primeiro = (L.pessoa || "").replace(/^Dr\.?\s+/, "").split(" ")[0];
    const ICO_TEL = "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39";
    const ICO_WA = "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z";
    const sis = (t) => ({ de: "sis", t, h: this.hora(), dia: "Hoje" });
    const gravarC = (id, fn) => { const E = est(); if (!E) return; E.gravar({ conversas: this.convs().map(c => c.id === id ? Object.assign({}, c, fn(c)) : c) }); };
    const registrar = (titulo, d) => {
      const E = est(); if (!E) return;
      const emp = L.empresa || "Sem empresa";
      const todas = Object.assign({}, E.ler("empresas", {}) || {});
      const X = todas[emp] || {};
      todas[emp] = Object.assign({}, X, { eventos: [{ titulo, autor: L.pessoa || "", quando: "Hoje, " + this.hora(), d, ts: Date.now() }].concat(X.eventos || []) });
      E.gravar({ empresas: todas });
      gravarC(C.id, c => ({ msgs: (c.msgs || []).concat(sis(titulo)) }));
    };
    const ligarCallface = () => {
      let num = String(tel || "").replace(/\D/g, "");
      if (num.length > 11 && num.indexOf("55") === 0) num = num.slice(2);
      if (num.length < 10) { diz("Contato sem telefone cadastrado", "erro"); return false; }
      const u = "https://app.callface.ai/calls?call_to=" + num;
      if (est() && est().abrirExterno) est().abrirExterno(u); else window.open(u, "_blank");
      diz("Abrindo o Callface para ligar para " + primeiro, "ok");
      return true;
    };
    const r = (() => {
        const ANALISES = {
          c4: {
            dur: 192, quando: "Hoje, 11:40", tipo: "Ligação recebida", geradoEm: "11:44",
            chance: 68, chanceNota: "↑ 22 pts vs. média de clínicas",
            urg: 3, urgencia: "Alta", urgNota: "Quer implantar antes de dezembro",
            sent: [-0.1, 0.1, -0.35, -0.4, 0.05, -0.2, -0.3, 0.25, 0.4, 0.55, 0.6, 0.72], sentLabel: "Positivo no fim", sentVirada: "Virou no preço",
            falaAt: 41, interrup: 1, maiorFala: "0:14",
            objetivo: "Entender a perda de ligações fora do horário e marcar uma demonstração do Callface AI com a agenda da clínica.",
            interesses: ["Atendimento 24h com agendamento direto na agenda", "Confirmação de consulta pelo WhatsApp", "Transbordo para humano quando a IA não resolver"],
            dores: ["Cerca de 40 ligações perdidas por semana depois das 18h", "Sábado sem ninguém na recepção", "Agendamento perdido vira paciente na concorrência"],
            objecoes: [
              { t: "Dúvida se a IA entende paciente idoso, que fala devagar e repete perguntas.", r: "Mostrar na demo uma ligação lenta sendo resolvida sem transbordo." },
              { t: "Não quer contrato longo.", r: "Reforçar: sem fidelidade e sem taxa de setup." }
            ],
            bant: [
              { k: "Orçamento", st: "Confirmado", ev: "≈ R$ 1.200/mês — “cabe”" },
              { k: "Autoridade", st: "Parcial", ev: "Decide junto com o Dr. Paulo (financeiro)" },
              { k: "Necessidade", st: "Confirmado", ev: "40 ligações perdidas por semana" },
              { k: "Prazo", st: "Confirmado", ev: "Colocar no ar antes de dezembro" }
            ],
            resumo: [
              "Dr. Marcos chegou pelo anúncio de atendimento 24h. A clínica tem duas recepcionistas até as 18h; depois disso ninguém atende e ele estima perder umas 40 ligações por semana, com o sábado sendo o pior dia.",
              "A Camila apresentou o Callface AI atendendo, agendando direto na agenda da clínica e confirmando pelo WhatsApp. A principal dúvida foi se a IA entende pacientes idosos; ela explicou o transbordo para humano quando a IA não resolve.",
              "No preço, ele rejeitou contrato longo e reagiu bem ao modelo por minuto, sem fidelidade e sem setup (≈ R$ 1.200/mês). Aceitou uma demonstração na quinta às 15h e pediu convite por e-mail e um resumo no WhatsApp para mostrar ao Dr. Paulo, sócio do financeiro."
            ],
            chaves: [["atendimento 24h", 4], ["agendamento", 3], ["WhatsApp", 2], ["sem fidelidade", 2], ["demonstração", 2], ["paciente idoso", 1], ["preço por minuto", 1], ["sócios", 1]],
            passos: [
              { k: "p1", t: "Enviar convite da demonstração · qui, 15h", meta: "E-mail · Dr. Marcos", acao: "Criar atividade", tipo: "Reunião", quando: "Hoje" },
              { k: "p2", t: "Mandar resumo e valores pelo WhatsApp", meta: "WhatsApp · para mostrar ao Dr. Paulo", acao: "Enviar agora", wa: true },
              { k: "p3", t: "Incluir o Dr. Paulo (financeiro) na proposta", meta: "Contato novo · decisor", acao: "Criar atividade", tipo: "Follow up", quando: "Amanhã" }
            ],
            falas: [
              [0, "at", "Cliniface Saúde, bom dia? Aqui é a Camila, da OnFace. Falo com o Dr. Marcos?"],
              [6, "cl", "Isso, sou eu. Vi o anúncio de vocês sobre atendimento 24 horas."],
              [13, "at", "Que bom! Me conta como funciona o atendimento da clínica hoje."],
              [19, "cl", "Temos duas recepcionistas até as 18h. Depois disso o telefone toca e ninguém atende. Perdemos agendamento todo dia."],
              [33, "at", "Vocês têm ideia de quantas ligações ficam sem resposta?"],
              [38, "cl", "Umas 40 por semana, fácil. E no sábado é pior."],
              [46, "at", "O Callface AI atende, agenda direto na agenda da clínica e manda a confirmação no WhatsApp."],
              [58, "cl", "Mas ele entende paciente idoso? Muita gente liga, fala devagar, pergunta a mesma coisa duas vezes."],
              [70, "at", "Entende, e quando não consegue resolver transfere para uma pessoa ou deixa recado."],
              [80, "cl", "E quanto custa isso? Não quero um contrato de dois anos."],
              [88, "at", "É por minuto falado, sem fidelidade e sem taxa de setup. Para o volume de vocês fica perto de R$ 1.200 por mês."],
              [103, "cl", "Hum, cabe. Mas preciso ver funcionando antes de levar para os sócios."],
              [115, "at", "Podemos fazer uma demonstração com a agenda de vocês. Quinta às 15h funciona?"],
              [124, "cl", "Quinta eu consigo. Manda o convite pro meu e-mail e um resumo no WhatsApp pra eu mostrar pro Dr. Paulo."],
              [140, "at", "Combinado, te mando hoje ainda. Quem mais participa da decisão?"],
              [148, "cl", "Eu e o Dr. Paulo, que cuida do financeiro. A ideia é colocar antes de dezembro, que a agenda lota."],
              [166, "at", "Perfeito, então já deixo a proposta pronta para vocês dois."],
              [174, "cl", "Ótimo. Obrigado, Camila."],
              [180, "at", "Eu que agradeço, doutor. Até quinta!"]
            ],
            momentos: [
              [19, "Dor", "Ligações sem resposta depois das 18h", 3],
              [58, "Objeção", "Dúvida se a IA entende pacientes idosos", 7],
              [80, "Preço", "Pediu valor e rejeitou contrato longo", 9],
              [103, "Sinal de compra", "Disse que o valor cabe", 11],
              [124, "Próximo passo", "Aceitou demo na quinta às 15h", 13],
              [148, "Decisor", "Dr. Paulo, do financeiro, decide junto", 15]
            ]
          }
        };
        let A = ANALISES[C.id];
        if (!A) {
          const pn = L.pessoa || "Contato", p1 = pn.replace(/^Dr\.?\s+/, "").split(" ")[0], emp = L.empresa || "a empresa";
          A = JSON.parse(JSON.stringify(ANALISES.c4).split("Dr. Marcos Beltrão").join(pn).split("Dr. Marcos").join(p1).split("Marcos").join(p1).split("Cliniface Saúde").join(emp).split("Cliniface").join(emp));
        }
        const TIPOS = { "Dor": "#fe4f2b", "Objeção": "#d93c1a", "Preço": "#c8a86a", "Sinal de compra": "#1f7256", "Próximo passo": "#12171d", "Decisor": "#67787c" };
        const LP = S.lp && S.lp.id === C.id ? S.lp : { id: C.id, t: 0, on: false, v: 1 };
        const setLP = (p) => this.setState(s => ({ lp: Object.assign({}, (s.lp && s.lp.id === C.id) ? s.lp : { id: C.id, t: 0, on: false, v: 1 }, p) }));
        const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
        const seekTo = (t) => { setLP({ t: Math.max(0, Math.min(A.dur, t)) }); };
        const tocarDe = (t) => { setLP({ t, on: false }); setTimeout(() => this.play(A.dur, true), 0); };
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
        const textoWa = "Olá, " + (/^Dr\.?\s/.test(L.pessoa || "") ? "Dr. " + ((L.pessoa || "").split(" ").slice(-1)[0] || "") : primeiro) + "! Como combinamos, segue o resumo: Callface AI atendendo 24h, agendando direto na agenda da clínica e confirmando pelo WhatsApp. Modelo por minuto, sem fidelidade e sem setup — perto de R$ 1.200/mês para o volume de vocês. Demo marcada para quinta, 15h. Qualquer dúvida, é só chamar!";
        const abrirWa = () => this.setState({ wa: { texto: textoWa, de: 0 } });
        const marcar = (k) => this.gravarPassos(s0 => { const all = Object.assign({}, s0 || {}); const cur = Object.assign({}, all[C.id] || {}); cur[k] = true; all[C.id] = cur; return all; });
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
          play: () => this.play(A.dur),
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
          relAberto: true,
          abrirRel: () => {},
          fecharRel: () => this.fechar(),
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
          levarQual: () => { this.fechar(); const E = est(); if (E) setTimeout(() => E.abrir("qualificar", L.id), 0); },
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
              alternar: () => this.gravarPassos(s0 => { const all = Object.assign({}, s0 || {}); const cur = Object.assign({}, all[C.id] || {}); cur[p.k] = !cur[p.k]; all[C.id] = cur; return all; }),
              btnStyle: "flex:0 0 auto;height:30px;padding:0 12px;border-radius:9999px;border:0;font-size:12px;font-weight:600;white-space:nowrap;" + (ok ? "background:#e6f4ee;color:#1f7256;cursor:default" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede;cursor:pointer"),
              onClick: () => {
                if (ok) return;
                if (p.wa) { marcar(p.k); return abrirWa(); }
                criarAtvDe(p.t, p.tipo, p.quando); marcar(p.k); registrar("Atividade criada · " + p.t, "M9 11l3 3L22 4");
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
          criarAtv: () => { this.fechar(); const E = est(); if (E) setTimeout(() => E.abrir("atividade-nova", L.id), 0); },
          tAtual: mmss(LP.t), tTotal: mmss(A.dur),
          cabeca: "position:absolute;top:2px;bottom:2px;width:2px;border-radius:2px;background:#12171d;pointer-events:none;transform:translateX(-1px);left:" + (LP.t / A.dur * 100).toFixed(2) + "%",
          vels: [1, 1.5, 2].map(v => ({ label: String(v).replace(".", ",") + "×", onClick: () => setLP({ v }), style: "height:24px;min-width:38px;padding:0 8px;border-radius:9999px;border:0;cursor:pointer;font-size:11.5px;font-weight:700;" + (LP.v === v ? "background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(18,23,29,.1)" : "background:transparent;color:#67787c") })),
          falando: (LP.on || LP.t > 0) ? (quemEm(LP.t) === "at" ? atNome : clNome) + " falando" : "Clique na onda ou num momento para ouvir",
          falandoDot: "flex:0 0 auto;width:7px;height:7px;border-radius:9999px;background:" + ((LP.on || LP.t > 0) ? (quemEm(LP.t) === "at" ? "#12171d" : "#fe4f2b") : "#c9ced1") + (LP.on ? ";animation:ofPulse 1.4s ease-out infinite" : ""),
          speakers: [[atNome, A.falaAt, "#12171d"], [clNome, 100 - A.falaAt, "#fe4f2b"]].map(([nome, pct, cor]) => ({ nome, pct: pct + "%", dot: "flex:0 0 auto;width:8px;height:8px;border-radius:2px;background:" + cor, bar: "height:100%;border-radius:9999px;background:" + cor + ";width:" + pct + "%" })),
          momChips: A.momentos.map(m => {
            const on = (LP.on || LP.t > 0) && LP.t >= m[0] && LP.t < m[0] + 8;
            return { h: mmss(m[0]), tipo: m[1], titulo: m[2], onClick: () => tocarDe(m[0]),
              dot: "flex:0 0 auto;width:6px;height:6px;border-radius:9999px;background:" + TIPOS[m[1]],
              style: "flex:0 0 auto;display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:9999px;border:0;cursor:pointer;font-size:11.5px;white-space:nowrap;" + (on ? "background:#12171d;color:#fff" : "background:#fafafa;color:#1f252c;box-shadow:inset 0 0 0 1px #e3e7e8") };
          }),
          pinos: A.momentos.map(m => ({ titulo: mmss(m[0]) + " · " + m[1] + ": " + m[2], onClick: () => tocarDe(m[0]),
            style: "position:absolute;top:0;left:" + ((m[0] / A.dur) * 100).toFixed(2) + "%;transform:translateX(-50%);width:10px;height:10px;padding:0;border:0;border-radius:3px 3px 3px 0;rotate:-45deg;cursor:pointer;box-shadow:0 0 0 2px #fff;background:" + TIPOS[m[1]] })),
          enviarWa: abrirWa,
          religar: () => {
            if (!ligarCallface()) return;
            registrar("Ligação iniciada no Callface", ICO_TEL);
            this.fechar();
          }
        };
    })();
    const W = S.wa;
    const nums = (D.NUMEROS || {}).WhatsApp || ["Comercial · (11) 4003-1020"];
    const w = !W ? { aberto: false } : {
      aberto: true,
      para: (L.pessoa || "contato") + " · " + tel,
      numeros: nums.map((n, i) => ({ label: n, onClick: () => this.setState({ wa: Object.assign({}, W, { de: i }) }),
        style: "display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;border-radius:10px;border:0;cursor:pointer;text-align:left;" + (W.de === i ? "background:#fff;box-shadow:inset 0 0 0 1.5px #12171d" : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8"),
        radio: "flex:0 0 auto;width:14px;height:14px;border-radius:9999px;" + (W.de === i ? "box-shadow:inset 0 0 0 4px #12171d" : "box-shadow:inset 0 0 0 1.5px #c9ced1") })),
      texto: W.texto, setTexto: (e) => this.setState({ wa: Object.assign({}, W, { texto: e.target.value }) }),
      contagem: (W.texto || "").length + " caracteres",
      cancelar: () => this.setState({ wa: null }),
      fora: (e) => { if (e.target === e.currentTarget) this.setState({ wa: null }); },
      enviar: () => {
        const E = est(); if (!E) return;
        const txt = (W.texto || "").trim();
        if (!txt) return diz("Escreva a mensagem antes de enviar", "erro");
        const lista = this.convs();
        let cw = lista.find(c => c.lead === L.id && c.canal === "WhatsApp" && c.status !== "resolvida");
        const msg = { de: "out", t: txt, h: this.hora(), dia: "Hoje", lido: false };
        if (cw) E.gravar({ conversas: lista.map(c => c.id === cw.id ? Object.assign({}, c, { numero: nums[W.de] || c.numero, hora: msg.h, msgs: (c.msgs || []).concat(msg) }) : c) });
        else E.gravar({ conversas: lista.concat({ id: "cw-" + L.id, lead: L.id, canal: "WhatsApp", numero: nums[W.de] || nums[0], status: "atendimento", resp: C.resp || EU, prioridade: "Média", naoLidas: 0, hora: msg.h, msgs: [msg] }) });
        registrar("WhatsApp enviado · resumo da ligação", ICO_WA);
        this.gravarPassos(s0 => { const all = Object.assign({}, s0 || {}); const cur = Object.assign({}, all[C.id] || {}); cur.p2 = true; all[C.id] = cur; return all; });
        this.setState({ wa: null });
        diz("Resumo enviado para " + primeiro + " no WhatsApp", "ok");
      }
    };
    return { aberto: true, r, w, fora: (e) => { if (e.target === e.currentTarget) this.fechar(); } };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <RelatorioLigacaoDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as RelatorioLigacaoLiga };
