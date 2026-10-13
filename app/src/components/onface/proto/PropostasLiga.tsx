// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Propostas — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * PropostasDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `PropostasDesenho.tsx`, convertido por máquina e intocável.
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

import { PropostasDesenho } from "./PropostasDesenho";
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

  state = { larg: typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1400, opps: null, busca: "", aba: "todas", sel: { status: [], familia: [], fech: [], resp: [] }, filtroAberto: null, aberta: null, pag: 0, nova: null };

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
    if (E) { const puxa = () => this.setState({ opps: E.ler("opps", null) }); puxa(); this._off = E.assinar(puxa); }
    this._fora = (e) => { if (this.state.filtroAberto && !(e.target.closest && e.target.closest("[data-pp-filtro]"))) this.setState({ filtroAberto: null }); };
    this._esc = (e) => { if (e.key === "Escape") this.setState(s => s.fcPop ? { fcPop: null } : s.nova ? { nova: null } : { aberta: null, filtroAberto: null }); };
    this._rs = () => this.setState({ larg: (typeof window !== "undefined" ? window.innerWidth : 1440) }); window.addEventListener("resize", this._rs);
    document.addEventListener("mousedown", this._fora);
    document.addEventListener("keydown", this._esc);
  }
  componentWillUnmount() { if (this._off) this._off(); window.removeEventListener("resize", this._rs); document.removeEventListener("mousedown", this._fora); document.removeEventListener("keydown", this._esc); }

  renderVals() {
    const S = this.state, D = this.dadosDoProto || {}, Es = this.E;
    const ini = (n) => avatarDe(n, (D.iniciais || ((n) => (n || "").split(" ").map(x => [...x][0]).slice(0, 2).join("").toUpperCase()))(n));
    const equipe = D.EQUIPE || ["Camila Reis", "Diego Nunes", "Ana Vitória"];
    const FAM = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
    const FAMC = { CALLFACE_AI: ["#fff6f4", "#c2330f"], PABX: ["#e8f0fb", "#2c5f9e"], WHITE_LABEL: ["#efecfa", "#4f3fa8"] };
    const ST = { rascunho: ["Rascunho", "#eeeff3", "#4a5560", "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"], enviada: ["Enviada", "#e8f0fb", "#2c5f9e", "M22 2 11 13M22 2l-7 20-4-9-9-4z"], visualizada: ["Visualizada", "#f7edd8", "#6e5420", "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
      ajuste_solicitado: ["Ajuste solicitado", "#fff6f4", "#c2330f", "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"], aceita: ["Aceita", "#e6f4ee", "#1f7256", "M20 6 9 17l-5-5"], recusada: ["Recusada", "#fdeeea", "#c2330f", "M18 6 6 18M6 6l12 12"],
      expirada: ["Expirada", "#eeeff3", "#67787c", "M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"], substituida: ["Substituída", "#eeeff3", "#8b949e", "M3 12a9 9 0 1 0 3-6.7L3 8"] };
    const brl = (n) => "R$ " + (+n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const selo = (st) => { const s = ST[st] || [st, "#eeeff3", "#4a5560", "M12 8v4"]; return "display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;background:" + s[1] + ";color:" + s[2]; };
    const ir = (href, rot, par) => Es && Es.irPara(href, rot, par);

    const base = S.opps || D.OPORTUNIDADES || [];
    const todas = [];
    base.forEach((o, idx) => {
      const props = o.propostas || (o.proposta ? [Object.assign({ codigo: "P-" + (1540 + idx), itens: o.itens || [] }, o.proposta)] : []);
      props.forEach((p, i) => todas.push({ o, p, i, props }));
    });
    const soma = (p) => (p.itens || []).reduce((a, it) => { const v = (+it.valor || 0) * (+it.qtd || 1); return it.natureza === "MRR" ? { mrr: a.mrr + v, un: a.un } : { mrr: a.mrr, un: a.un + v }; }, { mrr: 0, un: 0 });
    const fechDe = (o, p) => p.modo === "PREPAID" ? "Checkout Stripe" : "Contrato + Stripe";
    const q = S.busca.trim().toLowerCase();
    const F = S.sel;
    const passaBase = (x) => (!q || [x.p.codigo, x.o.empresa, x.o.pessoa, FAM[x.o.familia]].join(" ").toLowerCase().indexOf(q) >= 0)
      && (!F.familia.length || F.familia.indexOf(x.o.familia) >= 0) && (!F.fech.length || F.fech.indexOf(fechDe(x.o, x.p)) >= 0) && (!F.resp.length || F.resp.indexOf(x.o.resp) >= 0);
    const filtradas = todas.filter(passaBase);
    const ABAS = [["todas", "Todas"], ["rascunho", "Rascunho"], ["enviada", "Enviadas"], ["visualizada", "Visualizadas"], ["ajuste_solicitado", "Ajuste solicitado"], ["aceita", "Aceitas"], ["recusada", "Recusadas"], ["expirada", "Expiradas"]];
    const naAba = (x, k) => k === "todas" ? x.p.status !== "substituida" : x.p.status === k;
    const stSel = F.status || [];
    const vis = filtradas.filter(x => stSel.length ? stSel.indexOf(x.p.status) >= 0 : x.p.status !== "substituida").sort((a, b) => (a.p.status === "rascunho" ? 0 : 1) - (b.p.status === "rascunho" ? 0 : 1));
    /* Uma tela só: todas as propostas numa lista contínua, sem páginas. */
    const pagina = vis;
    const chave = (x) => x.o.id + ":" + x.i;

    const defs = [
      { k: "status", label: "Status", titulo: "STATUS DA PROPOSTA", icone: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", opcoes: ABAS.filter(a2 => a2[0] !== "todas") },
      { k: "familia", label: "Produto", titulo: "PRODUTO", icone: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", opcoes: Object.keys(FAM).map(k => [k, FAM[k]]) },
      { k: "fech", label: "Fechamento", titulo: "COMO FECHA", icone: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", opcoes: [["Contrato + Stripe", "Contrato + Stripe"], ["Checkout Stripe", "Checkout Stripe"]] },
      { k: "resp", label: "Responsável", titulo: "CLOSER", icone: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", opcoes: equipe.map(n => [n, n]) }
    ];
    const filtros = defs.map(f => {
      const sel = F[f.k], ativo = sel.length > 0, aberto = S.filtroAberto === f.k;
      return { label: f.label, titulo: f.titulo, icone: f.icone, aberto, temSel: ativo, conta: String(sel.length),
        grupo: "display:flex;align-items:stretch;height:34px;border-radius:9px;overflow:hidden;background:" + (ativo ? "#d93c1a" : "#fff") + ";box-shadow:inset 0 0 0 1px " + (ativo ? "#c2330f" : aberto ? "#b8bfc0" : "#dbdede"),
        corpo: "display:flex;align-items:center;gap:7px;padding:0 11px;font-size:13px;font-weight:" + (ativo ? "600" : "500") + ";white-space:nowrap;color:" + (ativo ? "#fff" : "#1f252c") + ";background:transparent;border:0;cursor:pointer",
        seta: "display:grid;place-items:center;width:28px;padding:0;color:" + (ativo ? "#fff" : "#4a5560") + ";background:transparent;border:0;cursor:pointer",
        hover: ativo ? "background:rgba(255,255,255,.12)" : "background:#f6f7f7",
        div: "flex:0 0 auto;width:1px;background:" + (ativo ? "rgba(255,255,255,.34)" : "#e3e7e8"),
        contaStyle: "min-width:17px;height:17px;padding-inline:4px;border-radius:9999px;font-size:10px;font-weight:700;display:grid;place-items:center;background:rgba(255,255,255,.22);color:#fff",
        chev: "flex:0 0 auto;transition:transform .12s;transform:rotate(" + (aberto ? 180 : 0) + "deg)",
        abrir: (e) => { const el = e && e.currentTarget && e.currentTarget.closest("[data-pp-filtro]"); const r = el ? el.getBoundingClientRect() : null;
          this.setState(s => ({ filtroAberto: s.filtroAberto === f.k ? null : f.k, filtroRect: r ? { top: r.top, bottom: r.bottom, left: r.left } : null })); },
        limpar: () => this.setState(s => ({ sel: Object.assign({}, s.sel, { [f.k]: [] }), filtroAberto: null, pag: 0 })),
        opcoes: f.opcoes.map(([v, l]) => { const on = sel.indexOf(v) >= 0; return { label: l, on, n: String((f.k === "status" ? filtradas : todas).filter(x => (f.k === "status" ? x.p.status : f.k === "familia" ? x.o.familia : f.k === "resp" ? x.o.resp : fechDe(x.o, x.p)) === v && x.p.status !== "substituida").length),
          caixa: "flex:0 0 auto;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4"),
          onClick: () => this.setState(s => ({ pag: 0, sel: Object.assign({}, s.sel, { [f.k]: on ? sel.filter(x => x !== v) : sel.concat(v) }) })) }; }) };
    });

    const larg = S.larg || 1400;
    const fc = (() => {
      const vivos = filtradas.filter(x => x.p.status !== "substituida");
      const mr = (x) => soma(x.p).mrr + soma(x.p).un; const un = () => 0;
      const fcTipo = S.fcTipo || "ponderado";
      const PESO = fcTipo === "completo" ? { enviada: 1, visualizada: 1, ajuste_solicitado: 1 } : { visualizada: 1, ajuste_solicitado: 1 };
      const ativas = vivos.filter(x => ["enviada", "visualizada", "ajuste_solicitado"].indexOf(x.p.status) >= 0);
      const aceitas = vivos.filter(x => x.p.status === "aceita"), recusadas = vivos.filter(x => x.p.status === "recusada");
      const modo = S.fcModo || "forecast";
      const MES = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
      const hojeD = new Date(); hojeD.setHours(12, 0, 0, 0);
      const dataDe = (s) => { const t = String(s || "").toLowerCase(); if (!t || t.indexOf("hoje") === 0) return hojeD; if (t.indexOf("ontem") === 0) return new Date(hojeD.getTime() - 864e5);
        const m = t.match(/(\d{1,2})\s+([a-zç]{3})/); if (m && MES[m[2]] != null) return new Date(hojeD.getFullYear(), MES[m[2]], +m[1], 12); return hojeD; };
      const N = Math.max(2, hojeD.getDate()), WK = 864e5;
      const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const mesAt = hojeD.getMonth(), anoAt = hojeD.getFullYear();
      const mesAnt = new Date(anoAt, mesAt - 1, 1);
      const diaNo = (d, m, a) => d.getMonth() === m && d.getFullYear() === a ? d.getDate() - 1 : -1;
      const semanaDe = (x) => { const d = diaNo(dataDe(x.p.refEm || x.p.enviadaEm), mesAt, anoAt); return d; };
      const ABERTOS = ["enviada", "visualizada", "ajuste_solicitado"];
      const vence = (x) => dataDe(x.p.refEm || x.p.enviadaEm).getTime() + (+x.p.validadeDias || 0) * 864e5;
      const acumMes = (fn, m, a, carrega) => { const ini0 = new Date(a, m, 1).getTime(); const add = Array(N).fill(0);
        vivos.forEach(x => { const dt = dataDe(x.p.refEm || x.p.enviadaEm), d = diaNo(dt, m, a);
          if (d >= 0 && d < N) add[d] += fn(x);
          else if (carrega && dt.getTime() < ini0 && ABERTOS.indexOf(x.p.status) >= 0 && vence(x) >= ini0) add[0] += fn(x); });
        const ac = []; add.reduce((s2, v, i) => (ac[i] = s2 + v), 0); return ac; };
      const herdado = vivos.filter(x => dataDe(x.p.refEm || x.p.enviadaEm).getTime() < new Date(anoAt, mesAt, 1).getTime() && ABERTOS.indexOf(x.p.status) >= 0 && vence(x) >= new Date(anoAt, mesAt, 1).getTime());
      const fF = x => (PESO[x.p.status] || 0) * mr(x), fG = x => x.p.status === "aceita" ? mr(x) : 0;
      const serie = acumMes(fF, mesAt, anoAt, true), ganho = acumMes(fG, mesAt, anoAt, false), ant = acumMes(fF, mesAnt.getMonth(), mesAnt.getFullYear(), true);
      const alvo = serie[N - 1];
      const emJogo = ativas.reduce((s2, x) => s2 + mr(x), 0);
      const bruto = Math.max.apply(null, serie.concat(ganho)) || 1000;
      const mag = Math.pow(10, Math.floor(Math.log10(bruto))), passoR = Math.ceil(bruto / 2 / (mag / 2)) * (mag / 2);
      const max = passoR * 2 / (132 / 140);
      const X = (i) => (i / Math.max(1, N - 1)) * 600, Y = (v) => 140 - (v / max) * 132;
      const liso = (arr) => arr.map((v, i) => { if (!i) return "M0 " + Y(v).toFixed(1); const x0 = X(i - 1), x1 = X(i), cx = (x0 + x1) / 2; return "C" + cx.toFixed(1) + " " + Y(arr[i - 1]).toFixed(1) + " " + cx.toFixed(1) + " " + Y(v).toFixed(1) + " " + x1.toFixed(1) + " " + Y(v).toFixed(1); }).join(" ");
      const hv = S.fcHover != null ? S.fcHover : N - 1;
      const sem = (i) => { const d = new Date(anoAt, mesAt, i + 1); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
      const k = (n) => !n ? "R$ 0" : n >= 1000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : brl(n);
      const delta = ant[N - 1] ? (serie[N - 1] / ant[N - 1] - 1) * 100 : (serie[N - 1] ? 100 : 0);
      const novasSem = vivos.filter(x => semanaDe(x) === hv && x.p.status !== "rascunho").length;
      const nEnv = vivos.filter(x => ["enviada", "visualizada", "ajuste_solicitado", "aceita", "recusada"].indexOf(x.p.status) >= 0).length;
      const nVis = vivos.filter(x => ["visualizada", "ajuste_solicitado", "aceita", "recusada"].indexOf(x.p.status) >= 0).length;
      const semVer = vivos.filter(x => x.p.status === "enviada").length, ajustes = vivos.filter(x => x.p.status === "ajuste_solicitado").length;
      const taxa = aceitas.length + recusadas.length ? Math.round(aceitas.length / (aceitas.length + recusadas.length) * 100) : 0;
      const FUN = [["Enviadas", nEnv, "#3a4550", "todas"], ["Abertas", nVis, "#8b949e", "visualizada"], ["Aceitas", aceitas.length, "#fe4f2b", "aceita"]];
      const tot = Math.max(1, nEnv);
      const filtrado = !!(S.busca.trim() || F.familia.length || F.fech.length || F.resp.length);
      const vista = S.fcVista || "receita";
      const envS = Array(N).fill(0), aceS = Array(N).fill(0);
      vivos.forEach(x => { const i = semanaDe(x); if (i < 0 || i >= N) return; if (x.p.status !== "rascunho") envS[i]++; if (x.p.status === "aceita") aceS[i]++; });
      const maxC = Math.max(2, Math.max.apply(null, envS));
      const passoY = Math.ceil(maxC / 2), topoC = passoY * 2;
      const barras = [];
      for (let i = 0; i < N; i++) [[envS[i], "#5b6b7a"], [aceS[i], "#fe4f2b"]].forEach(([v, cor], j) => { const h = v / topoC * 132; const bw = Math.max(4, Math.min(14, 600 / N / 2 - 2)); const x0 = Math.min(600 - bw * 2 - 2, Math.max(0, X(i) - bw - 1)) + j * (bw + 2);
        barras.push({ x: x0.toFixed(1), w: bw.toFixed(1), style: "fill:" + cor + ";opacity:" + (i === hv || S.fcHover == null ? 1 : .45) + ";y:" + (140 - h).toFixed(1) + "px;height:" + Math.max(0, h).toFixed(1) + "px;transition:y .6s cubic-bezier(.16,1,.3,1),height .6s cubic-bezier(.16,1,.3,1),opacity .15s" }); });
      return {
        cols: larg >= 1180 ? "minmax(220px,.9fr) minmax(0,2fr) minmax(250px,1fr)" : "minmax(200px,.8fr) minmax(0,2fr)",
        largo: larg >= 1180, gap: larg >= 1180 ? "18px 28px" : "12px 22px", pad: larg >= 1180 ? "20px 24px" : "14px 18px",
        chartBox: "position:relative;flex:1;min-height:" + (larg >= 1180 ? 124 : 92) + "px;height:" + (larg >= 1180 ? 124 : 92) + "px",
        modosBox: "display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:auto;padding-top:" + (larg >= 1180 ? 18 : 10) + "px",
        kpiGrid: "display:grid;grid-template-columns:repeat(" + (larg >= 1180 ? 2 : 4) + ",minmax(0,1fr));gap:1px;border-radius:12px;background:#2a3139;overflow:hidden;flex:" + (larg >= 1180 ? "0 0 auto" : "2 1 0") + ";min-width:0",
        chartCol: "position:relative;min-width:0;display:flex;flex-direction:column;gap:8px",
        dirCol: "position:relative;min-width:0;display:flex;flex-direction:column;gap:14px;" + (larg >= 1180 ? "" : "grid-column:1 / -1;flex-direction:row;align-items:center;gap:20px"),
        rotulo: "Forecast",
        tipos: [["ponderado", "Ponderado"], ["completo", "Completo"]].map(([v, l]) => ({ l, onClick: () => this.setState({ fcTipo: v }),
          style: "height:26px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;" + (fcTipo === v ? "background:#fff;color:#12171d" : "background:rgba(255,255,255,.08);color:#a3aab0") })),
        ganhoTxt: k(ganho[N - 1]) + " ganho em " + MESES[mesAt],
        unicoTxtX: (() => { const u = vivos.filter(x => semanaDe(x) >= 0).reduce((s2, x) => s2 + (PESO[x.p.status] || 0) * un(x), 0); return u ? "+ " + k(u) + " único" : ""; })(),
        valor: k(alvo), delta: !ant[N - 1] ? (serie[N - 1] ? "Novo" : "—") : (delta >= 0 ? "+" : "") + Math.round(delta) + "%", deltaD: delta >= 0 ? "M7 17 17 7M7 7h10v10" : "M7 7l10 10M17 7v10H7",
        deltaStyle: "display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:9999px;font-size:11.5px;font-weight:700;" + (delta >= 0 ? "background:#1f7256;color:#e6f4ee" : "background:#5a2415;color:#ffd9ce"),
        deltaTxt: "vs. mesmo dia de " + MESES[mesAnt.getMonth()] + (filtrado ? " · filtrado" : ""),
        modos: [["forecast", "Forecast"], ["ganho", "Aceita"]].map(([v, l]) => ({ l, onClick: () => this.setState({ fcModo: v, fcHover: null }),
          style: "height:28px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;font-weight:600;" + (modo === v ? "background:#fff;color:#12171d" : "background:rgba(255,255,255,.08);color:#a3aab0") })),
        barras,
        ehReceita: vista === "receita", ehVolume: vista === "volume",
        vistas: [["receita", "Receita"], ["volume", "Propostas por dia"]].map(([v, l]) => ({ l, onClick: () => this.setState({ fcVista: v }),
          style: "height:26px;padding:0 11px;border-radius:7px;border:0;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;" + (vista === v ? "background:#fff;color:#12171d" : "background:transparent;color:#a3aab0") })),
        pergunta: vista === "receita" ? (fcTipo === "completo" ? "Soma das propostas enviadas, visualizadas e com ajuste solicitado." : "Soma das propostas que o cliente já abriu ou pediu ajuste.") + " Começa com o que ficou aberto do mês passado" + (herdado.length ? " (" + herdado.length + (herdado.length > 1 ? " propostas" : " proposta") + ")" : "") + " e soma as novas. O pontilhado é o que já foi ganho no mês." : "Do dia 1 até hoje: propostas enviadas e aceitas em cada dia do mês.",
        legenda: vista === "receita" ? [{ l: "Forecast", marca: "width:14px;height:2px;border-radius:2px;background:#fe4f2b" }, { l: "Ganho", marca: "width:14px;height:0;border-top:2px dotted #3ecf8e" }] : [{ l: "Enviadas", marca: "width:8px;height:8px;border-radius:2px;background:#5b6b7a" }, { l: "Aceitas", marca: "width:8px;height:8px;border-radius:2px;background:#fe4f2b" }],
        yLabels: (vista === "receita" ? [passoR * 2, passoR, 0].map(k) : [topoC, passoY, 0].map(String)).map((t, i) => ({ t, style: "position:absolute;right:0;white-space:nowrap;top:" + ["calc(" + (8 / 140 * 100).toFixed(1) + "% - 7px)", "calc(" + (74 / 140 * 100).toFixed(1) + "% - 7px)", "calc(100% - 7px)"][i] })),
        tipLinhas: vista === "receita" ? [{ l: "Forecast", v: k(serie[hv]), dot: "width:8px;height:2px;border-radius:2px;background:#fe4f2b" }, { l: "Ganho", v: k(ganho[hv]), dot: "width:8px;height:0;border-top:2px dotted #3ecf8e" }]
          : [{ l: "Enviadas", v: String(envS[hv]), dot: "width:8px;height:8px;border-radius:2px;background:#5b6b7a" }, { l: "Aceitas", v: String(aceS[hv]), dot: "width:8px;height:8px;border-radius:2px;background:#fe4f2b" }],
        serieRotX: filtrado ? "12 semanas · filtrado" : "Últimas 12 semanas",
        dLinha: liso(serie), dArea: liso(serie) + " L600 140 L0 140 Z", dAnt: liso(ant), dGanho: liso(ganho),
        dGuia: "M" + X(hv).toFixed(1) + " 0V140",
        ponto: "position:absolute;left:calc(" + (hv / (N - 1) * 100).toFixed(2) + "% - 6px);top:calc(" + (Y(serie[hv]) / 140 * 100).toFixed(2) + "% - 6px);width:12px;height:12px;border-radius:9999px;background:#fe4f2b;box-shadow:0 0 0 4px rgba(254,79,43,.22),0 0 0 1.5px #12171d inset;pointer-events:none;transition:left .15s ease,top .7s cubic-bezier(.16,1,.3,1);animation:fcPop .6s 1.4s cubic-bezier(.16,1,.3,1) both",
        alvos: serie.map((_, i) => ({ entrar: () => this.setState({ fcHover: i }) })), sair: () => this.setState({ fcHover: null }),
        tipSem: hv === N - 1 ? "Hoje · " + sem(hv) : hv === N - 2 ? "Ontem · " + sem(hv) : sem(hv),
        tipStyle: "position:absolute;top:-4px;min-width:150px;opacity:" + (S.fcHover == null ? "0" : "1") + ";transition:opacity .15s;" + (hv > N / 2 ? "right:calc(" + ((1 - hv / (N - 1)) * 100).toFixed(2) + "% + 14px)" : "left:calc(" + (hv / (N - 1) * 100).toFixed(2) + "% + 14px)") + ";padding:8px 11px;border-radius:10px;background:#1b2229;box-shadow:0 0 0 1px #2a3139,0 10px 24px -10px rgba(0,0,0,.6);pointer-events:none;white-space:nowrap",
        eixo: [0, Math.round((N - 1) / 4), Math.round((N - 1) / 2), Math.round((N - 1) * 3 / 4)].filter((v, i2, a2) => a2.indexOf(v) === i2 && v < N - 1).map(sem).concat(["Hoje"]),
        funilTxt: nEnv + (nEnv === 1 ? " enviada" : " enviadas"),
        funilBox: larg >= 1180 ? "min-width:0" : "flex:1 1 0;min-width:0",
        funil: FUN.map(([l, n, c, aba]) => ({ l, n: String(n), dica: l + ": " + n + " · ver na lista", dot: "width:8px;height:8px;border-radius:3px;background:" + c,
          onClick: () => this.setState(s => ({ pag: 0, sel: Object.assign({}, s.sel, { status: aba === "todas" ? [] : [aba] }) })),
          chip: "display:flex;align-items:center;gap:6px;height:26px;padding:0 8px;border-radius:7px;border:0;cursor:pointer;font-size:11.5px;color:#a3aab0;" + ((aba === "todas" ? !stSel.length : stSel.length === 1 && stSel[0] === aba) ? "background:rgba(255,255,255,.1)" : "background:transparent"),
          style: "flex:" + Math.max(0.0001, n / tot) + " 0 0;min-width:" + (n ? "6px" : "0") + ";border:0;padding:0;cursor:pointer;transition:flex-grow .7s cubic-bezier(.16,1,.3,1);background:" + c })),
        kpis: [["Aceite", taxa + "%", "#fff", null], ["Enviadas no mês", String(vivos.filter(x => x.p.status !== "rascunho" && x.p.enviadaEm && semanaDe(x) >= 0).length), "#fff", null], ["Rascunhos", String(vivos.filter(x => x.p.status === "rascunho").length), vivos.some(x => x.p.status === "rascunho") ? "#ff8a70" : "#fff", "rascunho"], ["Em jogo", k(emJogo), "#fff", "todas"]]
          .map(([l, v, c, aba]) => ({ l, v, onClick: () => aba && this.setState(s => ({ pag: 0, sel: Object.assign({}, s.sel, { status: aba === "todas" ? [] : [aba] }) })), vStyle: "display:block;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:" + c }))
      };
    })();
    const fp = !S.fcPop ? { aberto: false, resumo: [], comp: [], abas: [], itens: [] } : (() => {
      const MES = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
      const hojeD = new Date(); hojeD.setHours(12, 0, 0, 0);
      const dataDe = (s) => { const t = String(s || "").toLowerCase(); if (!t || t.indexOf("hoje") === 0) return hojeD; if (t.indexOf("ontem") === 0) return new Date(hojeD.getTime() - 864e5);
        const m = t.match(/(\d{1,2})\s+([a-zç]{3})/); if (m && MES[m[2]] != null) return new Date(hojeD.getFullYear(), MES[m[2]], +m[1], 12); return hojeD; };
      const fcTipo = S.fcTipo || "ponderado";
      const PESO = fcTipo === "completo" ? { enviada: 1, visualizada: 1, ajuste_solicitado: 1 } : { visualizada: 1, ajuste_solicitado: 1 };
      const mr = (x) => soma(x.p).mrr + soma(x.p).un; const un = () => 0;
      const k = (n) => !n ? "R$ 0" : n >= 1000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : brl(n);
      const base2 = filtradas.filter(x => x.p.status !== "substituida" && x.p.status !== "rascunho").map(x => {
        const env = dataDe(x.p.refEm || x.p.enviadaEm), val = +x.p.validadeDias || 0, resta = val ? Math.ceil((env.getTime() + val * 864e5 - hojeD.getTime()) / 864e5) : 9999;
        const exp = x.p.status === "expirada" || (["enviada", "visualizada", "ajuste_solicitado"].indexOf(x.p.status) >= 0 && resta < 0);
        return Object.assign({}, x, { resta, val, exp, mr: mr(x), un: un(x), peso: exp ? 0 : (PESO[x.p.status] || 0) });
      });
      const G = {
        andamento: base2.filter(x => !x.exp && (x.p.status === "enviada" || x.p.status === "visualizada")),
        ajuste: base2.filter(x => !x.exp && x.p.status === "ajuste_solicitado"),
        aceitas: base2.filter(x => x.p.status === "aceita"),
        recusadas: base2.filter(x => x.p.status === "recusada"),
        expiradas: base2.filter(x => x.exp)
      };
      const sm = (a2, fn) => a2.reduce((s2, x) => s2 + fn(x), 0);
      const fcast = sm(G.andamento.concat(G.ajuste), x => x.peso * x.mr), fcastUn = sm(G.andamento.concat(G.ajuste, G.aceitas), x => x.peso * x.un);
      const par = (m, u) => (m ? k(m) + "/mês" : "") + (m && u ? " + " : "") + (u ? k(u) + " único" : "") || "R$ 0";
      const ABAS = [["andamento", "Em andamento", "Visualizadas entram no ponderado. Enviadas ainda não abertas só entram no completo.", "M22 2 11 13M22 2l-7 20-4-9-9-4z", "#2c5f9e"],
        ["ajuste", "Ajuste solicitado", "Cliente pediu mudanças. Criar nova versão destrava.", "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z", "#c2330f"],
        ["aceitas", "Aceitas", "Já viraram ganho. Não entram no forecast.", "M20 6 9 17l-5-5", "#1f7256"],
        ["recusadas", "Recusadas", "Não contam. Veja os motivos na oportunidade.", "M18 6 6 18M6 6l12 12", "#9c3210"],
        ["expiradas", "Expiradas", "Passaram da validade sem resposta. Não contam.", "M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "#67787c"]];
      const abaK = S.fcPop.aba || "andamento", AB = ABAS.find(a2 => a2[0] === abaK);
      const lista = G[abaK].slice().sort((a2, b2) => b2.peso * (b2.mr * 12 + b2.un) - a2.peso * (a2.mr * 12 + a2.un) || a2.resta - b2.resta);
      const COMP = [["Visualizadas", sm(G.andamento.filter(x => x.p.status === "visualizada"), x => x.mr), "#c9a45c"], ["Ajuste solicitado", sm(G.ajuste, x => x.mr), "#ff8a70"]].concat(fcTipo === "completo" ? [["Enviadas", sm(G.andamento.filter(x => x.p.status === "enviada"), x => x.mr), "#5b6b7a"]] : []);
      const totC = Math.max(1, sm(COMP, c2 => c2[1]));
      const taxa = G.aceitas.length + G.recusadas.length ? Math.round(G.aceitas.length / (G.aceitas.length + G.recusadas.length) * 100) : 0;
      return { aberto: true, fechar: () => this.setState({ fcPop: null }),
        tipos: [["ponderado", "Ponderado"], ["completo", "Completo"]].map(([v, l]) => ({ l, onClick: () => this.setState({ fcTipo: v }),
          style: "height:28px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;" + (fcTipo === v ? "background:#fff;color:#12171d" : "background:rgba(255,255,255,.08);color:#a3aab0") })),
        rotulo: (fcTipo === "completo" ? "Forecast completo" : "Forecast ponderado") + (S.busca.trim() || F.familia.length || F.fech.length || F.resp.length ? " · com filtros" : ""), valor: k(fcast),
        unico: "",
        resumo: [["Em jogo", sm(G.andamento.concat(G.ajuste), x => x.mr), sm(G.andamento.concat(G.ajuste), x => x.un), "#fff"], ["Já ganho", sm(G.aceitas, x => x.mr), sm(G.aceitas, x => x.un), "#3ecf8e"], ["Taxa de aceite", null, null, "#fff", taxa + "%"], ["Perdido ou expirado", sm(G.recusadas.concat(G.expiradas), x => x.mr), sm(G.recusadas.concat(G.expiradas), x => x.un), "#ff8a70"]]
          .map(([l, m, u, c2, txt]) => ({ l, v: txt || k(m), temSub: false, sub: u ? "+ " + k(u) + " único" : "", vStyle: "display:block;margin-top:3px;font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;color:" + c2 })),
        comp: COMP.map(([l, v, c2]) => ({ l, v: k(v), dica: l + ": " + k(v), dot: "width:8px;height:8px;border-radius:2px;background:" + c2, style: "flex:" + Math.max(0.0001, v / totC) + " 0 0;min-width:" + (v ? "4px" : "0") + ";background:" + c2 })),
        abas: ABAS.map(([kk, l, , d, c2]) => { const on = abaK === kk, a2 = G[kk]; return { l, d, n: String(a2.length), sub: k(sm(a2, x => x.mr)), temSub2: false, sub2: "+ " + k(sm(a2, x => x.un)) + " único",
          onClick: () => this.setState({ fcPop: { aba: kk } }),
          style: "display:flex;align-items:center;gap:10px;width:100%;padding:10px;border-radius:11px;border:0;cursor:pointer;color:#12171d;background:" + (on ? "#f3f4f4" : "transparent"), hover: on ? "" : "background:#fafafa",
          icoStyle: "flex:0 0 auto;color:" + c2, nStyle: "flex:0 0 auto;min-width:22px;height:20px;padding:0 6px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:700;" + (on ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#4a5560") }; }),
        abaT: AB[1], abaS: AB[2], vazia: !lista.length,
        itens: lista.map(x => { const prog = (x.val ? Math.max(0, Math.min(1, 1 - x.resta / x.val)) : 0); const urg = !x.exp && x.val && x.resta <= 3 && ["enviada", "visualizada", "ajuste_solicitado"].indexOf(x.p.status) >= 0;
          return { empresa: x.o.empresa, meta: "#" + x.p.codigo + "-v" + (x.p.versao || 1) + " · " + (FAM[x.o.familia] ? FAM[x.o.familia] + " · " : "") + x.o.resp,
            prazo: x.p.status === "aceita" ? "Aceita" : x.p.status === "recusada" ? "Recusada" : x.exp ? "Expirou há " + Math.abs(x.resta) + (Math.abs(x.resta) === 1 ? " dia" : " dias") : !x.val ? "Sem validade" : "Vence em " + x.resta + (x.resta === 1 ? " dia" : " dias"),
            prazoStyle: "font-size:12px;font-weight:600;white-space:nowrap;color:" + (urg ? "#c2330f" : x.exp ? "#8b949e" : "#4a5560"),
            barra: "display:block;height:100%;border-radius:9999px;width:" + Math.round((x.p.status === "aceita" || x.p.status === "recusada" || x.exp ? 1 : prog) * 100) + "%;background:" + (urg ? "#fe4f2b" : x.exp ? "#c4c9ca" : x.p.status === "aceita" ? "#1f7256" : "#8b949e"),
            valor: k(x.mr), valorSub: "",
            contrib: x.p.status === "aceita" ? "já ganho" : x.exp || x.p.status === "recusada" ? "fora do forecast" : x.peso ? "entra no " + (fcTipo === "completo" ? "completo" : "ponderado") : "só no completo",
            abrir: () => this.setState({ fcPop: null, aberta: chave(x) }) }; }) };
    })();
    const aberta = S.aberta ? todas.find(x => chave(x) === S.aberta) : null;
    // ANTES: sem p.log, inventava "10:14", "14:32", "No dia seguinte, 09:05" e respostas de exemplo. Agora só o que o banco registrou (PropostasProto.logReal).
    const logDe = (o, p) => p.log || [];
    const LOGT = { enviada: ["Enviada", ST.enviada[3], "#2c5f9e"], visualizada: ["Aberta pela primeira vez", ST.visualizada[3], "#6e5420"], revista: ["Vista novamente", ST.visualizada[3], "#8b949e"], ajuste: ["Ajuste solicitado", ST.ajuste_solicitado[3], "#c2330f"], aceita: ["Aceita", ST.aceita[3], "#1f7256"], recusada: ["Recusada", ST.recusada[3], "#c2330f"] };

    let p = { kpis: [], log: [], fluxo: [], versoes: [], acoes: [] };
    if (aberta) {
      const { o, p: P, i } = aberta, s = soma(P), cod = "#" + P.codigo + "-v" + (P.versao || 1), sx = ST[P.status] || ST.rascunho;
      const log = logDe(o, P), nViews = log.filter(x => x.k === "visualizada" || x.k === "revista").length;
      const resp = log.slice().reverse().find(x => x.texto);
      const vivo = ["enviada", "visualizada", "ajuste_solicitado"].indexOf(P.status) >= 0;
      // ANTES: montava "https://propostas.callface.ai/p/<codigo>-v<versao>", endereço que não existe (a rota pública real é /p/<id>), e mostrava "Ativo".
      const link = P.id && typeof window !== "undefined" ? window.location.origin + "/p/" + P.id : "";
      // ANTES: toda proposta mostrava "Validade 30 dias" e "vence em N-3 dias", número fixo sem relação com a proposta.
      // P.validade chega como data (dia()), não como prazo em dias; sem prazo real, omitimos.
      const validade = 0;
      const btn = (label, onClick, forte) => ({ label, onClick, style: "height:34px;padding:0 13px;border-radius:9px;border:0;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;" + (forte ? "background:#d93c1a;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") });
      const editor = () => ir("/onface-preview/proposta", "Proposta", { opp: o.id, ver: "" });
      const vigente = aberta.props.slice().reverse().find(x => ["recusada", "expirada", "substituida"].indexOf(x.status) < 0) === P;
      const acoes = [];
      if (vigente && P.status === "rascunho") acoes.push(btn("Continuar editando", editor, true));
      if (vigente && vivo) acoes.push(btn(P.status === "ajuste_solicitado" ? "Criar nova versão" : "Ajustar em nova versão", editor, P.status === "ajuste_solicitado"));
      const contrato = P.modo !== "PREPAID";
      // ANTES: aceita = 2 passos feitos, ganho = 4, por regra, sem olhar contrato nem pagamento. Sem dado de contrato/pagamento, nenhum passo é marcado.
      const passoAt = 0;
      const FL = contrato
        ? [["Cliente aceita a proposta", "Na página pública"], ["Contrato gerado", "Com os dados desta versão"], ["Assinatura", "Cliente assina pelo link"], ["Oportunidade ganha", "Cobrança criada no Stripe"]]
        : [["Cliente aceita a proposta", "Na página pública"], ["Checkout do Stripe", "Cartão ou boleto"], ["Pagamento confirmado", "Webhook do Stripe"], ["Oportunidade ganha", "Cliente ativado"]];
      p = { titulo: "Proposta " + (FAM[o.familia] ? FAM[o.familia] + " · " : "") + o.empresa, codigo: cod, status: sx[0], stD: sx[3], stStyle: selo(P.status),
        empresa: o.empresa, pessoa: o.pessoa + (o.cargo ? " · " + o.cargo : ""), empIni: ini(o.empresa),
        irEmpresa: () => ir("/onface-preview/empresa", o.empresa, o.leadId ? { lead: o.leadId } : {}),
        kpis: [["Valor mensal", s.mrr ? brl(s.mrr) : "—", null], ["Setup / único", s.un ? brl(s.un) : "—", null], ["Produto", FAM[o.familia] || "—", null],
          ["Responsável", o.resp, null], ["Fechamento", contrato ? "Contrato" : "Checkout", null], ["Validade", validade ? validade + " dias" : P.validade || "—", P.status === "rascunho" ? "conta a partir do envio" : null]]
          .map(([l, v, sub]) => ({ l, v, temSub: !!sub, sub: sub || "", vStyle: "display:block;margin-top:3px;font-size:13.5px;font-weight:700;color:#12171d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums",
            subStyle: "display:block;margin-top:2px;font-size:11px;font-weight:600;color:" + (vivo ? "#c2330f" : "#8b949e") })),
        temResp: !!resp || P.status === "aceita",
        respTitulo: resp ? (resp.k === "ajuste" ? "Pedido de ajuste · " : "Motivo da recusa · ") + (resp.quem || o.pessoa) : "Aceita por " + o.pessoa,
        respTxt: resp ? "“" + resp.texto + "”" : (contrato ? "Contrato enviado para assinatura." : "Pagamento pelo checkout do Stripe."),
        respBox: "padding:12px 14px;border-radius:11px;background:" + (resp ? "#fff6f4;box-shadow:inset 0 0 0 1px #f6d3c9" : "#e6f4ee;box-shadow:inset 0 0 0 1px #c9e5d8"),
        respTit: "display:block;font-size:11.5px;font-weight:700;color:" + (resp ? "#9c3210" : "#1f7256"),
        link: P.status === "rascunho" ? "Gerado quando a proposta for enviada" : link || "—", linkAtivo: vivo && !!link,
        linkEstado: vivo && link ? "Ativo" : P.status === "rascunho" ? "Ainda não gerado" : "Encerrado",
        linkSelo: "display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:9999px;font-size:11px;font-weight:600;" + (vivo ? "background:#e6f4ee;color:#1f7256" : "background:#eeeff3;color:#67787c"),
        linkUrlStyle: "display:block;margin-top:8px;font-size:12.5px;font-weight:500;word-break:break-all;color:" + (vivo ? "#c2330f" : "#8b949e"),
        linkNota: vivo ? "O cliente abre sem login. Aceite, ajuste e recusa voltam para a oportunidade." : P.status === "rascunho" ? "Envie a proposta para liberar o link." : "Este link não aceita mais respostas.",
        verProposta: () => ir("/onface-preview/proposta", "Proposta", { opp: o.id, ver: String(i) }),
        copiar: () => { if (!link) { Es && Es.avisar("Esta proposta ainda não tem link público", "info"); return; } try { navigator.clipboard.writeText(link); } catch (e) {} Es && Es.avisar("Link da proposta copiado", "ok"); },
        irOpp: () => ir("/onface-preview/oportunidade", o.empresa, { opp: o.id, ver: "", aba: "prop" }),
        temAcoes: acoes.length > 0, acoes,
        temLog: log.length > 0, logResumo: [nViews ? nViews + (nViews > 1 ? " visualizações" : " visualização") : "Ainda não aberta", log.length ? "última " + log[log.length - 1].quando.toLowerCase() : ""].filter(Boolean).join(" · "),
        log: log.map((x, k) => { const T = LOGT[x.k] || [x.k, "M12 8v4", "#67787c"]; return { t: T[0] + (x.quem ? " · por " + x.quem : ""), quando: x.quando, d: T[1],
          ico: "flex:0 0 auto;width:24px;height:24px;border-radius:9999px;display:grid;place-items:center;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:" + T[2],
          linha: k < log.length - 1 ? "position:absolute;left:11.5px;top:26px;bottom:-8px;width:1px;background:#e3e7e8" : "display:none" }; }),
        fluxo: FL.map(([t, s2], k) => { const ok = k < passoAt; return { t, s: s2, n: ok ? "✓" : String(k + 1),
          bola: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:700;" + (ok ? "background:#1f7256;color:#fff" : "background:#eeeff3;color:#67787c") }; }),
        temVersoes: aberta.props.length > 1,
        versoes: aberta.props.map((v, k) => ({ codigo: "#" + v.codigo + "-v" + (v.versao || 1), status: (ST[v.status] || [v.status])[0], stStyle: selo(v.status), valor: brl(soma(v).mrr + soma(v).un),
          abrir: () => this.setState({ aberta: o.id + ":" + k }),
          style: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;cursor:pointer;text-align:left;background:" + (k === i ? "#fafafa" : "#fff") + ";" + (k ? "box-shadow:inset 0 1px 0 #f1f3f3" : "") })) };
    }

    const N = S.nova;
    const nv = !N ? { aberto: false, passos: [], caminhos: [], itens: [], tiposCli: [], filtroBase: [], contatos: [], familias: [], equipe: [], efeitos: [] } : (() => {
      const up = (p) => this.setState(s => ({ nova: Object.assign({}, s.nova, p, { erro: null }) }));
      const leads = (Es && Es.ler("leads", null)) || D.LEADS || [];
      const extras = (Es && Es.ler("contatosExtra", [])) || [];
      const TIPO = { nova: "Nova venda", expansao: "Upsell · expansão", upgrade: "Upgrade", crosssell: "Cross-sell", renovacao: "Renovação" };
      const TIPOS_CLI = [["expansao", "Upsell · expansão", "Mais licenças, ramais ou módulos no que já tem"], ["upgrade", "Upgrade", "Troca para um plano superior"], ["crosssell", "Cross-sell", "Outro produto para o mesmo cliente"], ["renovacao", "Renovação", "Fim de vigência, prazo e reajuste"]];
      const card = (on) => "display:flex;align-items:center;gap:13px;width:100%;min-height:72px;padding:14px 16px;border-radius:16px;border:0;cursor:pointer;background:#fff;transition:transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s ease;box-shadow:0 0 0 1px #e8ebeb,0 1px 2px rgba(18,23,29,.04)";
      const chipS = (on) => "height:34px;padding:0 13px;border-radius:9999px;border:0;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
      const ico = (bg, c) => "flex:0 0 auto;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:12px;font-weight:700;background:" + bg + ";color:" + c;
      const seloS = (bg, c) => "flex:0 0 auto;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;background:" + bg + ";color:" + c;
      // base de empresas e pessoas
      const emps = {};
      const addP = (emp, nome, cargo, email, leadId) => { if (!nome) return; const k = emp || "—"; emps[k] = emps[k] || { nome: emp, pessoas: [] }; if (!emps[k].pessoas.some(p => p.nome === nome)) emps[k].pessoas.push({ nome, cargo: cargo || "", email: email || "", leadId: leadId || null }); };
      // A base vem do banco (dados.leads, uma linha por pessoa) e `empresaId` é o que a criação usa: nome de empresa não é chave.
      leads.forEach(l => { if (l.empresa) { emps[l.empresa] = emps[l.empresa] || { nome: l.empresa, pessoas: [], id: l.empresaId }; } addP(l.empresa, l.pessoa, l.cargo, l.email, l.leadId); });
      base.forEach(o => { emps[o.empresa] = emps[o.empresa] || { nome: o.empresa, pessoas: [], id: o.empresaId }; addP(o.empresa, o.pessoa, o.cargo); (o.pessoas || []).forEach(p => addP(o.empresa, p.nome, p.papel)); });
      extras.forEach(x => { if (x.tipo === "empresa" && x.nome) emps[x.nome] = emps[x.nome] || { nome: x.nome, pessoas: [] }; if (x.tipo === "pessoa") addP(x.emp || null, x.nome, x.cargo, x.email); });
      const listaEmp = Object.keys(emps).filter(k => k !== "—").map(k => emps[k]);
      const semEmp = (emps["—"] || { pessoas: [] }).pessoas;
      const clientes = base.filter(o => o.etapa === "ganho").reduce((acc, o) => { if (!acc.some(c => c.empresa === o.empresa)) acc.push({ empresa: o.empresa, empresaId: o.empresaId, pessoa: o.pessoa, familia: o.familia, contrato: (o.evidencia || "").replace(/^Contrato assinado · /, "") || "Contrato ativo" }); return acc; }, []);
      const ABERTA = ["entrada", "diagnostico", "proposta", "negociacao"];
      const vivas = todas.filter(x => ["rascunho", "enviada", "visualizada", "ajuste_solicitado"].indexOf(x.p.status) >= 0 && ABERTA.indexOf(x.o.etapa) >= 0);
      const abertas = base.filter(o => ABERTA.indexOf(o.etapa) >= 0 && o.negocioId);
      const qq = (N.q || "").trim().toLowerCase(), bate = (s) => !qq || String(s || "").toLowerCase().indexOf(qq) >= 0;
      const cam = N.cam, passo = N.passo || 0;
      const ROT = { entrada: "Entrada", diagnostico: "Diagnóstico", proposta: "Proposta", negociacao: "Negociação" };

      let itens = [], buscaPh = "Buscar";
      if (passo === 1) {
        if (cam === "opp") { buscaPh = "Buscar oportunidade por empresa ou contato";
          itens = abertas.filter(o => bate(o.empresa + " " + o.pessoa)).map(o => { const props = o.propostas || (o.proposta ? [o.proposta] : []); const vig = props.slice().reverse().find(x => ["recusada", "expirada", "substituida"].indexOf(x.status) < 0);
            return { t: (FAM[o.familia] ? FAM[o.familia] + " · " : "") + o.empresa, s: o.pessoa + " · " + o.resp + " · " + (ROT[o.etapa] || ""), ini: ini(o.empresa), ico: ico("#fff6f4", "#c2330f"),
              temSelo: true, selo: !vig ? "Sem proposta" : vig.status === "rascunho" ? "Tem rascunho" : "Proposta " + ((ST[vig.status] || [""])[0]).toLowerCase(), seloStyle: seloS(!vig ? "#e6f4ee" : "#eeeff3", !vig ? "#1f7256" : "#4a5560"),
              style: card(false), hover: "transform:translateY(-2px);box-shadow:0 0 0 1.5px #12171d,0 14px 28px -16px rgba(18,23,29,.35)", onClick: () => up({ passo: 2, alvo: { k: "opp", id: o.id } }) }; }); }
        if (cam === "subst") { buscaPh = "Buscar proposta ativa";
          itens = vivas.filter(x => bate(x.o.empresa + " " + x.o.pessoa + " " + x.p.codigo)).map(x => { const sx = ST[x.p.status]; const s2 = soma(x.p);
            return { t: "#" + x.p.codigo + "-v" + (x.p.versao || 1) + " · " + x.o.empresa, s: (FAM[x.o.familia] ? FAM[x.o.familia] + " · " : "") + brl(s2.mrr || s2.un) + (s2.mrr ? "/mês" : "") + " · " + x.o.resp, ini: ini(x.o.empresa), ico: ico("#eeeff3", "#4a5560"),
              temSelo: true, selo: sx[0], seloStyle: seloS(sx[1], sx[2]), style: card(false), hover: "transform:translateY(-2px);box-shadow:0 0 0 1.5px #12171d,0 14px 28px -16px rgba(18,23,29,.35)", onClick: () => up({ passo: 2, alvo: { k: "subst", id: x.o.id, i: x.i } }) }; }); }
        if (cam === "cli") { buscaPh = "Buscar cliente";
          itens = clientes.filter(c => bate(c.empresa + " " + c.pessoa)).map(c => ({ t: c.empresa, s: (FAM[c.familia] ? FAM[c.familia] + " · " : "") + c.contrato + " · " + c.pessoa, ini: ini(c.empresa), ico: ico("#e6f4ee", "#1f7256"),
            temSelo: true, selo: "Cliente", seloStyle: seloS("#e6f4ee", "#1f7256"), style: card(false), hover: "transform:translateY(-2px);box-shadow:0 0 0 1.5px #12171d,0 14px 28px -16px rgba(18,23,29,.35)", onClick: () => up({ passo: 2, alvo: { k: "cli", empresa: c.empresa, empresaId: c.empresaId, familiaAtual: c.familia, contrato: c.contrato }, contato: c.pessoa, familia: N.tipo === "crosssell" ? Object.keys(FAM).find(k => k !== c.familia) : c.familia }) })); }
        if (cam === "base") { buscaPh = "Buscar empresa ou pessoa";
          const fb = N.fb || "tudo";
          const E1 = fb === "pessoas" ? [] : listaEmp.filter(e => bate(e.nome + " " + e.pessoas.map(p => p.nome).join(" "))).map(e => ({ t: e.nome, s: e.pessoas.length ? e.pessoas.length + (e.pessoas.length > 1 ? " contatos · " : " contato · ") + e.pessoas[0].nome : "Sem contato cadastrado", ini: ini(e.nome), ico: ico("#12171d", "#fff"),
            temSelo: true, selo: "Empresa", seloStyle: seloS("#eeeff3", "#4a5560"), style: card(false), hover: "transform:translateY(-2px);box-shadow:0 0 0 1.5px #12171d,0 14px 28px -16px rgba(18,23,29,.35)", onClick: () => up({ passo: 2, alvo: { k: "emp", empresa: e.nome, empresaId: e.id }, contato: e.pessoas[0] ? e.pessoas[0].nome : "", nc: !e.pessoas.length }) }));
          const todasP = fb === "empresas" ? [] : listaEmp.reduce((a2, e) => a2.concat(e.pessoas.map(p => Object.assign({ emp: e.nome }, p))), []).concat(semEmp.map(p => Object.assign({ emp: null }, p)));
          const P1 = todasP.filter(p => bate(p.nome + " " + (p.emp || ""))).map(p => ({ t: p.nome, s: (p.emp || "Sem empresa") + (p.cargo ? " · " + p.cargo : ""), ini: ini(p.nome), ico: ico("#eeeff3", "#4a5560"),
            temSelo: true, selo: p.emp ? "Pessoa" : "Sem empresa", seloStyle: p.emp ? seloS("#eeeff3", "#4a5560") : seloS("#fff6f4", "#c2330f"), style: card(false), hover: "transform:translateY(-2px);box-shadow:0 0 0 1.5px #12171d,0 14px 28px -16px rgba(18,23,29,.35)",
            onClick: () => up({ passo: 2, alvo: { k: "pes", empresa: p.emp, empresaId: (emps[p.emp] || {}).id, pessoa: p.nome, leadId: p.leadId }, contato: p.nome }) }));
          itens = E1.concat(P1).slice(0, 40); }
      }
      // confirmação
      let conf = {};
      const A = N.alvo || {};
      if (passo === 2) {
        const O = A.id ? base.find(o => o.id === A.id) : null;
        const empresa = A.k === "pes" ? (A.empresa || (N.empNova || "").trim()) : (O ? O.empresa : A.empresa);
        const pessoasEmp = empresa && emps[empresa] ? emps[empresa].pessoas : [];
        const contatoNome = N.nc ? (N.ncNome || "").trim() : N.contato;
        const criaOpp = A.k === "cli" || A.k === "emp" || A.k === "pes";
        const fam = N.familia || (O && O.familia) || "CALLFACE_AI";
        const closer = N.closer || (O && O.resp) || (equipe.indexOf(this.eu) >= 0 ? this.eu : equipe[0]);
        const erro = A.k === "pes" && !A.empresa && !(N.empNova || "").trim() ? "Informe a empresa do contato." : criaOpp && !contatoNome ? "Informe o contato que recebe a proposta." : N.nc && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(N.ncEmail || "") ? "Informe um e-mail válido para o novo contato." : A.k === "cli" && N.tipo === "crosssell" && fam === A.familiaAtual ? "Cross-sell é outro produto: escolha um diferente do que o cliente já tem." : "";
        const P0 = A.k === "subst" && O ? (O.propostas || [])[A.i] : null;
        conf = {
          alvoIni: ini(empresa || contatoNome || "?"), alvoT: A.k === "opp" || A.k === "subst" ? (FAM[O.familia] ? FAM[O.familia] + " · " : "") + O.empresa : empresa || A.pessoa,
          alvoS: A.k === "opp" ? "Oportunidade em " + (ROT[O.etapa] || "") + " · " + O.resp : A.k === "subst" ? "Substituir #" + P0.codigo + "-v" + (P0.versao || 1) : A.k === "cli" ? "Cliente · " + (FAM[A.familiaAtual] ? FAM[A.familiaAtual] + " · " : "") + A.contrato : A.k === "emp" ? "Empresa da base" : (A.empresa ? "Contato de " + A.empresa : "Contato sem empresa"),
          pedeEmpresa: A.k === "pes" && !A.empresa, empNova: N.empNova || "", setEmpNova: (e) => up({ empNova: e.target.value }),
          pedeContato: criaOpp && A.k !== "pes",
          contatos: pessoasEmp.map(p => { const on = !N.nc && N.contato === p.nome; return { nome: p.nome, cargo: p.cargo || p.email || "", onClick: () => up({ contato: p.nome, nc: false }),
            style: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:11px;border:0;cursor:pointer;background:#fff;box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #e3e7e8"),
            radio: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;box-shadow:inset 0 0 0 " + (on ? "5px #12171d" : "1.5px #a9b1b4") }; }),
          semContato: !pessoasEmp.length, novoContatoAberto: !!N.nc, podeNovoContato: false, abrirNovoContato: () => up({ nc: true }),
          ncNome: N.ncNome || "", setNcNome: (e) => up({ ncNome: e.target.value }), ncEmail: N.ncEmail || "", setNcEmail: (e) => up({ ncEmail: e.target.value }),
          pedeProduto: criaOpp, familias: Object.keys(FAM).filter(k => !(A.k === "cli" && N.tipo !== "crosssell") || k === A.familiaAtual).map(k => ({ l: FAM[k], style: chipS(fam === k), onClick: () => up({ familia: k }) })),
          pedeCloser: criaOpp, closer, setCloser: (e) => up({ closer: e.target.value }), equipe: equipe.map(n => ({ v: n, l: n })),
          temSubst: A.k === "subst", substT: P0 ? "A #" + P0.codigo + "-v" + (P0.versao || 1) + " será substituída" : "", substS: P0 ? "A nova versão começa com tudo da atual. Quando você enviar, a #" + P0.codigo + "-v" + (P0.versao || 1) + " passa a Substituída e o link antigo para de aceitar respostas." : "",
          efeitos: (A.k === "opp" ? [["Proposta ligada à oportunidade", (FAM[O.familia] ? FAM[O.familia] + " · " : "") + O.empresa + ", já com empresa, contato e closer", "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"], ["Abre o editor", "Você monta itens, condições e fechamento", "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"]]
            : A.k === "subst" ? [["Nova versão v" + ((P0.versao || 1) + 1), "Copia itens e condições da versão atual", "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"], ["Histórico preservado", "A versão anterior continua visível na oportunidade", "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"]]
            : [["Cria uma oportunidade no Pipeline", (A.k === "cli" ? TIPO[N.tipo] : "Nova venda") + " de " + FAM[fam] + " para " + (empresa || "a empresa") + ", em Entrada, com " + closer, "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z"],
               A.k === "cli" ? ["Nasce como aditivo", "Ligado ao " + A.contrato + ". Altera o contrato e a assinatura atuais, sem criar outra", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"] : ["Relacionamento passa a Lead", "Até a oportunidade ser ganha", "M20 6 9 17l-5-5"],
               ["Abre o editor da proposta", "Contato " + (contatoNome || "a definir") + " já como destinatário", "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"]]
            ).map(([t, s2, d]) => ({ t, s: s2, d })),
          erroAtual: erro,
          criar: () => {
            if (erro) return this.setState(s => ({ nova: Object.assign({}, s.nova, { erro }) }));
            /* Quem cria é o adaptador (command real). Antes aqui nascia uma oportunidade
               "o<timestamp>" no store local e o editor abria numa rota que não existe. */
            const contato = (pessoasEmp.find(p => p.nome === contatoNome) || {});
            const feito = this.props.criarProposta && this.props.criarProposta({ alvo: A, O, P0, familia: fam, closer, tipo: A.k === "cli" ? N.tipo : "nova", contatoNome, leadId: contato.leadId || A.leadId || null });
            if (feito && feito.then) feito.then(m => { if (m) this.setState(s => ({ nova: Object.assign({}, s.nova, { erro: m }) })); });
          },
          criarTxt: A.k === "subst" ? "Criar nova versão" : A.k === "opp" ? "Abrir editor da proposta" : "Criar oportunidade e proposta"
        };
      }
      const PASSOS = ["Caminho", cam === "cli" ? "Cliente" : cam === "subst" ? "Proposta" : cam === "base" ? "Empresa ou pessoa" : "Oportunidade", "Confirmar"];
      const TIT = { opp: ["De uma oportunidade", "Escolha a oportunidade. A proposta herda empresa, contato e closer."], subst: ["Substituir uma proposta", "Escolha a proposta ativa que vai ganhar uma nova versão."], cli: ["Para um cliente", "Upsell, upgrade, cross-sell ou renovação. Escolha o tipo e o cliente."], base: ["Para uma empresa ou contato", "Busque na base do ONFACE. A proposta cria uma oportunidade no Pipeline."] };
      return { aberto: true, fechar: () => this.setState({ nova: null }),
        titulo: passo === 0 ? "Nova proposta" : TIT[cam][0], sub: passo === 0 ? "Por onde essa proposta começa? Toda proposta fica ligada a uma oportunidade." : passo === 2 ? "Confira os dados antes de abrir o editor." : TIT[cam][1],
        passos: PASSOS.map((l, i) => { const on = i === passo, ok = i < passo; return { n: ok ? "✓" : String(i + 1), label: l,
          wrap: "display:flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 5px;border-radius:9999px;" + (on ? "background:#12171d" : ok ? "background:#eef7f2" : "background:#f3f4f4"),
          num: "width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:700;" + (on ? "background:#fe4f2b;color:#fff" : ok ? "background:#1f7256;color:#fff" : "background:#fff;color:#8b949e"),
          lbl: "font-size:12.5px;font-weight:600;white-space:nowrap;color:" + (on ? "#fff" : ok ? "#1f7256" : "#8b949e") }; }),
        e0: passo === 0, eBusca: passo === 1, eConfirma: passo === 2,
        caminhos: [["opp", "De uma oportunidade", "Já existe no Pipeline. Empresa, contato e closer vêm junto.", "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z", abertas.length + " abertas", null, ["#fff6f4", "#c2330f"]],
          ["subst", "Substituir uma proposta", "Nova versão de uma proposta enviada ou em rascunho. O histórico fica.", "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5", vivas.length + " ativas", null, ["#eeeff3", "#1f252c"]],
          ["cli", "Para um cliente", "Upsell, upgrade, cross-sell ou renovação para quem já compra.", "M20 6 9 17l-5-5", clientes.length + (clientes.length === 1 ? " cliente" : " clientes"), "Cria oportunidade no Pipeline", ["#e6f4ee", "#1f7256"]],
          ["base", "Para uma empresa ou contato", "Qualquer empresa ou pessoa da base, mesmo sem processo aberto.", "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3", listaEmp.length + " empresas", "Cria oportunidade no Pipeline", ["#e8f0fb", "#2c5f9e"]]]
          .map(([k, l, s2, d, n, nota, c2]) => ({ l, s: s2, d, temN: !!n, n: n || "", temNota: !!nota, nota: nota || "", ico: "flex:0 0 auto;width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:" + c2[0] + ";color:" + c2[1] + ";box-shadow:inset 0 0 0 1px rgba(18,23,29,.04)",
            onClick: () => up({ cam: k, passo: 1, q: "", alvo: null, tipo: k === "cli" ? "expansao" : null, familia: null, nc: false }) })),
        temTipos: cam === "cli", tiposCli: TIPOS_CLI.map(([k, l, s2]) => ({ l, s: s2, onClick: () => up({ tipo: k }),
          style: "padding:14px 16px;border-radius:16px;border:0;cursor:pointer;text-align:left;transition:box-shadow .2s ease;" + (N.tipo === k ? "background:#12171d;color:#fff;box-shadow:0 12px 26px -16px rgba(18,23,29,.6)" : "background:#fff;color:#1f252c;box-shadow:0 0 0 1px #e3e7e8") })),
        temFiltroBase: cam === "base", filtroBase: [["tudo", "Tudo"], ["empresas", "Empresas"], ["pessoas", "Pessoas"]].map(([k, l]) => ({ l, style: chipS((N.fb || "tudo") === k), onClick: () => up({ fb: k }) })),
        q: N.q || "", setQ: (e) => up({ q: e.target.value }), buscaPh, itens, semItens: passo === 1 && !itens.length,
        ...conf, trocarAlvo: () => up({ passo: 1, alvo: null }),
        temVoltar: passo > 0, voltar: () => up({ passo: passo - 1, alvo: passo === 2 ? null : N.alvo }),
        temCriar: passo === 2, criar: conf.criar, criarTxt: conf.criarTxt || "",
        temErro: !!N.erro, erro: N.erro || "" };
    })();

    return {
      fd: (() => { const x = filtros.find(y => y.aberto); if (!x) return { aberto: false, opcoes: [] };
        const r = S.filtroRect || { top: 100, bottom: 134, left: 20 }, vh = (typeof window !== "undefined" ? window.innerHeight : 900), vw = (typeof window !== "undefined" ? window.innerWidth : 1440);
        const abaixo = vh - r.bottom - 12, acima = r.top - 12, cima = abaixo < 240 && acima > abaixo, teto = Math.max(160, Math.min(380, cima ? acima : abaixo));
        return Object.assign({}, x, { pos: "position:fixed;z-index:70;left:" + Math.max(8, Math.min(vw - 260, r.left)) + "px;" + (cima ? "bottom:" + (vh - r.top + 5) : "top:" + (r.bottom + 5)) + "px;max-height:" + teto + "px;overflow-y:auto" }); })(),
      fc: Object.assign(fc, { abrirPop: () => this.setState({ fcPop: { aba: "andamento" }, fcInfo: false }), infoOn: () => this.setState({ fcInfo: true }), infoOff: () => this.setState({ fcInfo: false }), infoAberto: !!S.fcInfo }), fp, busca: S.busca, setBusca: (e) => this.setState({ busca: e.target.value, pag: 0 }), filtros,
      novaAbrir: () => this.setState({ nova: { passo: 0 } }), nv, parar: (e) => e.stopPropagation(),
      vazio: !pagina.length,
      linhas: pagina.map((x, ix) => { const { o, p: P } = x, s = soma(P), sx = ST[P.status] || ST.rascunho, on = S.aberta === chave(x), fc = FAMC[o.familia] || FAMC.CALLFACE_AI;
        const RC = { "Camila Reis": ["#fff6f4", "#c2330f"], "Diego Nunes": ["#e8f0fb", "#2c5f9e"], "Ana Vitória": ["#efecfa", "#4f3fa8"], [this.eu]: ["#12171d", "#fff"] }[o.resp] || ["#eeeff3", "#4a5560"];
        const hoje = (P.atualizadaEm || P.enviadaEm) === "hoje" || P.enviadaEm === "Hoje";
        return { titulo: "Proposta " + (FAM[o.familia] || ""), codigo: "#" + P.codigo + "-v" + (P.versao || 1), empresa: o.empresa, pessoa: o.pessoa, familia: FAM[o.familia] || "—",
          famStyle: "justify-self:start;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:500;white-space:nowrap;color:#1f252c",
          famDot: "flex:0 0 auto;color:" + fc[1],
          famD: { CALLFACE_AI: "M12 8V4H8M4 12h16a0 0 0 0 1 0 0v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6zM2 14h2M20 14h2M15 13v2M9 13v2M6 8h12a2 2 0 0 1 2 2v2H4v-2a2 2 0 0 1 2-2z", PABX: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z", WHITE_LABEL: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" }[o.familia] || "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
          famIco: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:" + fc[0] + ";color:" + fc[1],
          empIni: ini(o.empresa),
          valor: (s.mrr || s.un) ? (s.mrr ? brl(s.mrr) : brl(s.un)) : "—", valorSuf: s.mrr ? "/mês" : "", valorSub: s.mrr ? (s.un ? "+ setup " + brl(s.un) : "recorrente") : (s.un ? "pagamento único" : "sem itens"),
          fech: P.modo === "PREPAID" ? "Checkout" : "Contrato", fechSub: P.modo === "PREPAID" ? "Stripe direto" : "Assinatura + Stripe",
          fechD: P.modo === "PREPAID" ? "M2 5h20v14H2zM2 10h20" : "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4",
          status: sx[0], stD: sx[3], stStyle: "display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px 0 8px;border-radius:9999px;font-size:12px;font-weight:500;white-space:nowrap;color:#1f252c;background:#fff;box-shadow:inset 0 0 0 1px #e6e9e9",
          stDot: "flex:0 0 auto;color:" + sx[2],
          resp: o.resp, respIni: ini(o.resp),
          respAv: "flex:0 0 auto;width:24px;height:24px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:700;background:#eeeff3;color:#4a5560",
          atualizado: P.atualizadaEm || P.enviadaEm || "—",
          atStyle: "font-size:12px;white-space:nowrap;font-weight:" + (hoje ? "700;color:#c2330f" : "500;color:#67787c"),
          abrir: () => this.setState({ aberta: on ? null : chave(x) }),
          style: "position:relative;display:grid;grid-template-columns:minmax(170px,1.5fr) minmax(140px,1.2fr) 110px 124px 118px 140px 120px 96px;gap:10px;align-items:center;width:100%;min-height:58px;padding:11px 20px;border:0;cursor:pointer;text-align:left;transition:background-color .18s ease;box-shadow:inset 0 -1px 0 #f1f3f3;background:" + (on ? "#fff6f4" : "#fff"),
          hover: on ? "" : "background:#fafaf8" }; }),
      rodape: vis.length + (vis.length === 1 ? " proposta" : " propostas"),
      temPainel: !!aberta, p, painelSobre: !!aberta,
      painelStyle: true
        ? "position:fixed;top:10px;right:10px;bottom:10px;z-index:40;width:min(440px,calc(100vw - 20px));display:flex;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 24px 60px -12px rgba(18,23,29,.35),0 0 0 1px #e3e7e8;overflow:hidden"
        : "flex:0 0 440px;max-width:100%;min-height:0;display:flex;flex-direction:column;background:#fff;box-shadow:-1px 0 0 #e3e7e8", fecharPainel: () => this.setState({ aberta: null })
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <PropostasDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as PropostasLiga };
