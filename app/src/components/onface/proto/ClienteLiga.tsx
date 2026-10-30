// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Cliente — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * ClienteDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `ClienteDesenho.tsx`, convertido por máquina e intocável.
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

import { ClienteDesenho } from "./ClienteDesenho";
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

  state = { aba: "geral", hv: null, v: 0, pronto: false, menu: null, resp: null, modal: null, fatF: "todas", histF: "todos", docF: "todos", graf: "total", nota: "", rem: null };

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
    const a = E && E.parametro("aba");
    if (a && ["geral", "produtos", "financeiro", "pessoas", "documentos", "historico"].indexOf(a) >= 0) this.setState({ aba: a });
    this._t = setTimeout(() => this.setState({ pronto: true }), 120);
    this._fora = (e) => { if ((this.state.menu || this.state.resp) && !(e.target.closest && e.target.closest("[data-c360-flut]"))) this.setState({ menu: null, resp: null }); };
    document.addEventListener("mousedown", this._fora);
    this._esc = (e) => { if (e.key === "Escape") this.setState({ modal: null, menu: null, resp: null }); };
    document.addEventListener("keydown", this._esc);
  }
  componentWillUnmount() { if (this._off) this._off(); clearTimeout(this._t); document.removeEventListener("mousedown", this._fora); document.removeEventListener("keydown", this._esc); }

  renderVals() {
    const S = this.state, E = this.E, D = this.dadosDoProto || {}, EU = this.eu;
    const ini = (n) => avatarDe(n, (D.iniciais || ((n) => (n || "").split(" ").filter(Boolean).slice(0, 2).map(x => [...x][0]).join("").toUpperCase()))(n));
    const slug = D.slug || ((s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""));
    const diz = (t, tom) => E && E.avisar(t, tom || "ok");
    const seed = (this.dadosDoProto.ClientesSeed || []).concat((E && E.ler("clientesExtra", [])) || []);
    const pid = E && E.parametro("cliente"), pem = E && E.parametro("empresa");
    const c = seed.find(x => x.id === pid) || seed.find(x => x.nome === pem) || seed.find(x => x.id === "c2") || seed[0];
    const X = ((E && E.ler("clientes360", {})) || {})[c.id] || {};
    const salvarX = (patch, ev) => { if (!E) return; const cur = Object.assign({}, E.ler("clientes360", {}) || {}); const x0 = cur[c.id] || {}; const p2 = Object.assign({}, x0, patch);
      if (ev) p2.eventos = [Object.assign({ id: "e" + Date.now().toString(36), quando: new Date().toISOString(), autor: EU }, ev)].concat(x0.eventos || []);
      cur[c.id] = p2; E.gravar({ clientes360: cur }); };
    let h = 7; for (let i = 0; i < c.nome.length; i++) h = (h * 31 + c.nome.charCodeAt(i)) >>> 0;
    const hs = (s) => { let x = 3; for (let i = 0; i < s.length; i++) x = (x * 33 + s.charCodeAt(i)) >>> 0; return x; };
    const hoje = new Date(), h0 = new Date(); h0.setHours(0, 0, 0, 0);
    const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const MESL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const pad = (n) => String(n).padStart(2, "0");
    const dmy = (d) => pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear();
    const dm = (d) => pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
    const dExt = (d) => d.getDate() + " " + MES[d.getMonth()].toLowerCase() + " " + d.getFullYear();
    const isoD = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const addM = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
    const mesesDe = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
    const brl = (n) => "R$ " + Math.round(n).toLocaleString("pt-BR");
    const brl2 = (n) => "R$ " + (+n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const brlK = (n) => n >= 10000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : brl(n);
    const TT = { ok: ["#e6f4ee", "#1f7256"], coral: ["#fff6f4", "#c2330f"], erro: ["#fdeeea", "#c2330f"], neutro: ["#eeeff3", "#4a5560"], escuro: ["#12171d", "#fff"] };
    const pill = (tom) => "flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;background:" + TT[tom][0] + ";color:" + TT[tom][1];
    const dotC = { ok: "#1f7256", coral: "#fe4f2b", erro: "#d93c1a", neutro: "#8b949e", escuro: "#fe4f2b" };
    const dotS = (tom) => "width:6px;height:6px;border-radius:9999px;background:" + dotC[tom];
    const I = { check: "M20 6 9 17l-5-5", alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", note: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
      send: "M22 2 11 13M22 2l-7 20-4-9-9-4z", doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", dl: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3", link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
      ext: "M7 17 17 7M9 7h8v8", user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", building: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4", trend: "M22 7 13.5 15.5l-5-5L2 17M16 7h6v6", up: "M7 17 17 7M9 7h8v8", dn: "M7 7l10 10M17 9v8H9",
      card: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4", pipe: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z", heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z",
      headset: "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z", pulse: "M22 12h-4l-3 9L9 3l-3 9H2", swap: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5", layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", plus: "M12 5v14M5 12h14",
      wa: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", mail: "M4 4h16v16H4zM4 7l8 6 8-6",
      tel: "M13.8 16.6a1 1 0 0 0 1.2-.3l.4-.5A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.4z",
      cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", video: "m16 10 5-3v10l-5-3zM4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z", clip: "M21.4 11.1 12.2 20.3a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" };
    const FAM = { CALLFACE_AI: { l: "Callface AI", cor: "#fe4f2b", d: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", tile: ["#fff6f4", "#c2330f"] },
      PABX: { l: "PABX", cor: "#ff9f85", d: I.tel, tile: ["#12171d", "#fff"] }, WHITE_LABEL: { l: "White Label", cor: "#ffd5c8", d: I.layers, tile: ["#eeeff3", "#1f252c"] } };
    const PK = ["CALLFACE_AI", "PABX", "WHITE_LABEL", "ASSISTANT"];
    const SKU = { CALLFACE_AI: [["CF-STARTER", "Callface AI Starter", "Plano", "usuários", 189, false], ["CF-FULL", "Callface AI Full", "Plano", "usuários", 349, false], ["CF-AG-ATD", "Agente de IA · Atendimento", "Agente", "agentes", 490, false], ["CF-AG-SDR", "Agente de IA · SDR", "Agente", "agentes", 690, false]],
      PABX: [["PX-ESS", "PABX Cloud Essencial", "Plano", "ramais", 39, false], ["PX-PRO", "PABX Cloud Pro", "Plano", "ramais", 59, false], ["PX-GRAV", "Gravação de chamadas", "Add-on", "pacote", 290, true], ["PX-URA", "URA inteligente", "Add-on", "pacote", 390, true]],
      WHITE_LABEL: [["WL-PLAT", "White Label · Plataforma", "Plano", "plataforma", 3900, true], ["WL-REV", "Licença de revenda", "Licença", "clientes finais", 190, false], ["WL-DOM", "Domínio e marca própria", "Add-on", "pacote", 490, true]] };
    const escolher = (k, budget, sd) => { let pk;
      if (k === "CALLFACE_AI") pk = budget > 3000 ? [1, 0, 2] : budget > 1500 ? [0, 2] : [0];
      else if (k === "PABX") pk = budget > 1500 ? [1, 2, 3] : budget > 800 ? [0, 2] : [0];
      else pk = budget > 5000 ? [0, 1, 2] : budget > 3900 ? [0, 1] : [1];
      if (sd % 2 && pk.length > 2) pk = pk.slice(0, 2);
      const its = pk.map(i => SKU[k][i]); let rest = budget; const out = [];
      its.filter(x => x[5]).forEach(x => { if (rest > x[4] * 1.2) { out.push({ s: x, qtd: 1 }); rest -= x[4]; } });
      const vr = its.filter(x => !x[5]), w = vr.map((_, i) => vr.length === 1 ? 1 : i === 0 ? .65 : .35 / (vr.length - 1));
      vr.forEach((x, i) => out.push({ s: x, qtd: Math.max(1, Math.ceil(Math.max(0, rest) * w[i] / x[4])) }));
      if (!out.length) out.push({ s: its[0], qtd: 1 });
      return out; };

    const [ay, am] = c.inicio.split("-").map(Number), ini0 = new Date(ay, am - 1, 1 + h % 27);
    const fimD = c.fim ? (() => { const [fy, fm] = c.fim.split("-").map(Number); return new Date(fy, fm - 1, 1); })() : null;
    const ativo = !c.fim, totalMeses = Math.max(0, mesesDe(ini0, fimD || hoje));
    const outros = PK.filter(k => k !== c.produto); if (h % 2) outros.reverse();
    const fks = [c.produto].concat(outros.slice(0, c.mrr < 2000 ? 0 : h % 3)), SH = fks.length === 1 ? [1] : fks.length === 2 ? [.72, .28] : [.6, .26, .14];
    const usoF = (j) => Math.min(.97, .42 + c.saude / 210 + ((h >> j) % 9) / 100);
    const fams = fks.map((k, i) => { const budget = Math.round(c.mrr * SH[i]), off = i === 0 ? 0 : Math.min(totalMeses, 2 + ((h >> (i * 3)) % 5)), start = addM(ini0, off);
      const itens = escolher(k, budget, h >> i).map((it, j) => { const sOff = j === 0 ? 0 : Math.min(Math.max(0, mesesDe(start, hoje)), 1 + ((h >> (j + i)) % 4));
        return { cod: it.s[0], nome: it.s[1], tipo: it.s[2], un: it.s[3], preco: it.s[4], fixo: it.s[5], qtd: it.qtd, inicio: addM(start, sOff), uso: it.s[5] ? null : Math.min(it.qtd, Math.max(1, Math.round(it.qtd * usoF(j + i)))) }; });
      const raw = itens.reduce((a, x) => a + x.qtd * x.preco, 0);
      const st = !ativo ? "Encerrado" : (i === 0 && c.status === "Em implantação") || (i > 0 && mesesDe(start, hoje) < 1) ? "Em implantação" : "Ativo";
      return { k, F: FAM[k], budget, mrr: ativo ? budget : 0, start, itens, raw, desc: Math.max(0, raw - budget), st }; });
    const famEm = (f, m, ult) => { const ms = mesesDe(new Date(f.start.getFullYear(), f.start.getMonth(), 1), m); if (ms < 0 || (fimD && m >= fimD)) return 0; if (ult) return f.mrr; return Math.round(f.budget * (.8 + .2 * Math.min(1, ms / 5))); };
    const W = Array.from({ length: 12 }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - 11 + i, 1));
    const serie = fams.map(f => W.map((m, i) => famEm(f, m, i === 11)));
    const tot = W.map((_, i) => serie.reduce((a, s) => a + s[i], 0));
    const mrr = fams.reduce((a, f) => a + f.mrr, 0), mrrAnt = tot[10], dM = mrrAnt ? Math.round((mrr / mrrAnt - 1) * 100) : null;
    let acum = 0; for (let k = 0; k <= totalMeses; k++) { const m = new Date(ini0.getFullYear(), ini0.getMonth() + k, 1); acum += fams.reduce((a, f) => a + famEm(f, m, mesesDe(m, hoje) === 0), 0); }
    const licT = fams.reduce((a, f) => a + f.itens.filter(x => !x.fixo).reduce((b, x) => b + x.qtd, 0), 0), licU = fams.reduce((a, f) => a + f.itens.filter(x => !x.fixo).reduce((b, x) => b + x.uso, 0), 0);
    const usoPct = licT ? Math.round(licU / licT * 100) : 100;

    // Stripe
    const b36 = (n) => Math.abs(Math.floor(n)).toString(36);
    const cus = "cus_" + (b36(h) + b36(h * 7 + 13) + "QxN").slice(0, 14), subId = "sub_" + (b36(h * 3 + 5) + b36(h >> 3) + "Lm").slice(0, 14);
    const stripeUrl = "https://dashboard.stripe.com/customers/" + cus;
    const forma = ["Boleto bancário", "Pix automático", "Cartão Visa •••• " + (1000 + h % 9000)][h % 3];
    const ext = (u) => E && E.abrirExterno(u);
    const copiar = (t, rot) => { try { navigator.clipboard.writeText(t); diz(rot + " copiado", "ok"); } catch (e) { diz("Não deu para copiar", "erro"); } };

    // Faturas
    const fb = [];
    for (let k = 0; k <= totalMeses; k++) { const m = new Date(ini0.getFullYear(), ini0.getMonth() + k, 1); if (fimD && m >= fimD) break; if (mesesDe(m, hoje) > 11) continue;
      const v = fams.reduce((a, f) => a + famEm(f, m, mesesDe(m, hoje) === 0), 0); if (v > 0) fb.push({ m, v }); }
    const fats = fb.map((f, i) => { const id = f.m.getFullYear() + "-" + pad(f.m.getMonth() + 1), venc = new Date(f.m.getFullYear(), f.m.getMonth() + 1, 10), back = fb.length - 1 - i;
      let st = back === 0 && ativo ? "Em aberto" : "Pago";
      if ((back === 1 && c.saude < 45) || (back === 2 && c.saude < 38) || (!ativo && back === 0 && c.saude < 20)) st = "Vencida";
      let pagoEm = st === "Pago" ? new Date(venc.getTime() - ((h >> (i % 8)) % 5) * 864e5) : null; const o = (X.faturas || {})[id];
      if (o) { st = o.status; pagoEm = o.pagoEm ? new Date(o.pagoEm) : pagoEm; }
      if (st !== "Pago" && venc < h0) st = "Vencida";
      const inId = "in_" + (b36(h + i * 977) + b36(h * (i + 3)) + "Fz").slice(0, 16);
      return { id, m: f.m, comp: MESL[f.m.getMonth()] + "/" + f.m.getFullYear(), v: f.v, venc, st, pagoEm, o: o || null, inId, nf: "NF-" + (4100 + (h % 700) + i * 3),
        hosted: "https://invoice.stripe.com/i/acct_1OnFaceCallface/" + inId, dash: "https://dashboard.stripe.com/invoices/" + inId }; }).reverse();
    const emAberto = fats.filter(f => f.st !== "Pago").reduce((a, f) => a + f.v, 0), vencidas = fats.filter(f => f.st === "Vencida"), vencido = vencidas.reduce((a, f) => a + f.v, 0);
    const pago12 = fats.filter(f => f.st === "Pago").reduce((a, f) => a + f.v, 0), abertas = fats.filter(f => f.st !== "Pago").sort((a, b) => a.venc - b.venc), proxF = abertas[0];
    const FST = { "Pago": "ok", "Em aberto": "neutro", "Vencida": "erro" };

    // Pessoas
    const leadsAll = (E && E.ler("leads", null)) || D.LEADS || [], opps = (E && E.ler("opps", null)) || D.OPORTUNIDADES || [];
    const leadsC = leadsAll.filter(l => l.empresa === c.nome), oppsC = opps.filter(o => o.empresa === c.nome);
    const POOL = [["Marcelo Tavares", "Gerente de TI"], ["Beatriz Lemos", "Coordenadora Financeira"], ["Rafael Cunha", "Supervisor de Atendimento"], ["Letícia Moura", "Analista de Operações"], ["Henrique Sales", "Diretor Comercial"], ["Paula Ribeiro", "Gerente de CX"], ["Caio Martins", "Head de Tecnologia"], ["Débora Nogueira", "Diretora Executiva"]];
    const dominio = slug(c.nome) + ".com.br", pes = [];
    const add = (nome, cargo, papel, ex) => { if (!nome || pes.some(p => p.nome === nome)) return; pes.push(Object.assign({ nome, cargo: cargo || "", papel: papel || "" }, ex || {})); };
    leadsC.forEach(l => add(l.pessoa, l.cargo, "Decisor", { leadId: l.id, email: l.email, tel: l.tel }));
    oppsC.forEach(o => (o.pessoas || []).forEach(p => add(p.nome, p.nome === o.pessoa ? o.cargo : "", p.papel === "Contato principal" ? "Decisor" : p.papel === "Influenciador" ? "Usuário" : p.papel)));
    for (let k = 0; pes.length < 4 && k < POOL.length; k++) { const q = POOL[(h + k * 3) % POOL.length]; add(q[0], q[1], ""); }
    (X.pessoas || []).forEach(p => add(p.nome, p.cargo, p.papel, { extra: true, email: p.email, tel: p.tel }));
    const PAP = ["Decisor", "Financeiro", "Técnico", "Usuário"];
    pes.forEach(p => { if (!p.papel || PAP.indexOf(p.papel) < 0) p.papel = PAP.find(r => r !== "Usuário" && !pes.some(o => o.papel === r)) || "Usuário"; });
    const ULT = ["Hoje", "Há 2 dias", "Há 6 dias", "Há 12 dias", "Há 21 dias", "Há 34 dias"];
    pes.forEach((p, i) => { const hp = hs(p.nome), pr = p.nome.replace(/^Dr\.?\s+/, "").split(" ");
      p.cargo = p.cargo || "Contato"; p.email = p.email || "";
      p.tel = p.tel || ("(11) 9" + (6000 + hp % 3999) + "-" + (1000 + (hp >> 3) % 8999)); p.ultimo = ULT[(i + h) % ULT.length]; });
    const principal = pes.find(p => p.nome === X.principal) || pes.find(p => p.papel === "Decisor") || pes[0] || { nome: "—", cargo: "", email: "", tel: "" };
    const finP = pes.find(p => p.papel === "Financeiro") || principal;
    pes.sort((a, b) => (b === principal) - (a === principal));
    const csm = X.csm || c.resp, closer = (oppsC[0] || {}).resp || c.resp;
    const equipe = (D.EQUIPE || ["Camila Reis", "Diego Nunes", "Ana Vitória"]).concat([EU, c.resp]).filter((x, i, a) => x && a.indexOf(x) === i);

    // Empresa
    const CID = ["São Paulo / SP", "Campinas / SP", "Curitiba / PR", "Belo Horizonte / MG", "Rio de Janeiro / RJ", "Porto Alegre / RS"];
    const nC = String(10000000 + h % 89999999), cnpj = nC.slice(0, 2) + "." + nC.slice(2, 5) + "." + nC.slice(5, 8) + "/0001-" + pad(h % 97);
    const origem = leadsC[0] ? leadsC[0].origem : ["Meta Ads", "Site", "Indicação", "Prospecção outbound", "Instagram"][h % 5];
    const cidade = CID[h % CID.length], porte = [25, 45, 80, 120, 260][h % 5] + " colaboradores";
    const garantirRegistro = () => { if (!E) return null; const ex = (E.ler("contatosExtra", []) || []).slice(), idE = "cli-" + c.id; let mudou = false;
      if (!ex.some(r => r.id === idE)) { ex.push({ id: idE, tipo: "empresa", nome: c.nome, rel: "Cliente", origem, resp: csm, segmento: c.segmento || "", cidade, site: dominio, cnpj, ultima: "Hoje" }); mudou = true; }
      pes.forEach(p => { const idP = idE + "-" + slug(p.nome); if (!ex.some(r => r.id === idP)) { ex.push({ id: idP, tipo: "pessoa", nome: p.nome, emp: c.nome, cargo: p.cargo, email: p.email, tel: p.tel, rel: "Cliente", origem, resp: csm, ultima: p.ultimo }); mudou = true; } });
      if (mudou) E.gravar({ contatosExtra: ex }); return idE; };
    const abrirEmpresa = () => { if (!E) return; if (leadsC[0]) return E.irPara("/onface-preview/empresa", c.nome, { lead: leadsC[0].id }); const id = garantirRegistro(); E.irPara("/onface-preview/empresa", c.nome, { registro: id }); };
    const abrirPessoa = (p) => { if (!E) return; if (p.leadId) return E.irPara("/onface-preview/pessoa", p.nome, { pessoa: slug(p.nome), lead: p.leadId }); const idE = garantirRegistro(); E.irPara("/onface-preview/pessoa", p.nome, { pessoa: slug(p.nome), registro: idE + "-" + slug(p.nome) }); };
    const ligar = (p) => { const num = String(p.tel || "").replace(/\D/g, ""); if (num.length < 10) return diz(p.nome + " não tem telefone cadastrado", "erro");
      ext("https://app.callface.ai/calls?call_to=" + num); salvarX({}, { t: "Ligação iniciada para " + p.nome, meta: p.tel + " · via Callface", cat: "atividades", ico: "tel" }); diz("Abrindo o Callface para ligar para " + p.nome.split(" ")[0], "ok"); };
    const atend = (p, canal) => { if (!E) return; const L = p.leadId || (leadsC[0] && leadsC[0].pessoa === p.nome ? leadsC[0].id : null);
      if (L) return E.irPara("/atendimento", "Atendimento", { lead: L, canal }); salvarX({}, { t: (canal === "WhatsApp" ? "Conversa de WhatsApp aberta com " : "E-mail para ") + p.nome, meta: canal === "WhatsApp" ? p.tel : p.email, cat: "atividades", ico: canal === "WhatsApp" ? "wa" : "mail" });
      E.irPara("/atendimento", "Atendimento", { canal, contato: p.nome }); };

    // Agenda (atividades e reuniões no layout novo)
    const AG = this.dadosDoProto.Agenda ? this.dadosDoProto.Agenda.itens().filter(x => x.empresa === c.nome) : [];
    const abrirItem = (x) => { if (!E) return; if (x.tipo === "Reunião" && x.src !== "l") return E.abrir("reuniao", x.src === "o" ? { src: "o", oppId: x.oppId, i: x.idx } : { src: "p", id: x.id }); E.abrir("verAtividade", x.key); };
    const TIPOI = { "Ligação": I.tel, "Reunião": I.video, "E-mail": I.mail, "Mensagem": I.wa, "Follow up": I.swap, "Proposta": I.doc, "Tarefa": I.check };
    const diaDe = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const n = Math.round((x - h0) / 864e5); return n < 0 ? "Atrasada" : n === 0 ? "Hoje" : n === 1 ? "Amanhã" : dm(d); };
    const abertosAG = AG.filter(x => ["Feita", "Declinada"].indexOf(x.situacao) < 0).sort((a, b) => (a.quando ? a.quando.getTime() : 9e15) - (b.quando ? b.quando.getTime() : 9e15));
    const prox = abertosAG.slice(0, 5).map(x => { const late = x.quando && x.quando < h0, hj = x.quando && diaDe(x.quando) === "Hoje";
      return { t: x.titulo, s: [x.tipo, x.pessoa, x.resp].filter(Boolean).join(" · "), d: TIPOI[x.tipo] || I.check, dia: x.quando ? diaDe(x.quando) : "Sem data", hora: x.temHora ? pad(x.quando.getHours()) + ":" + pad(x.quando.getMinutes()) : "—",
        ico: "flex:0 0 auto;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;" + (x.tipo === "Reunião" ? "background:#fff6f4;color:#c2330f" : "background:#f3f4f4;color:#1f252c"),
        data: "flex:0 0 auto;width:62px;padding:6px 0;border-radius:9px;text-align:center;" + (late ? "background:#fdeeea;color:#c2330f" : hj ? "background:#12171d;color:#fff" : "background:#f3f4f4;color:#1f252c"), onClick: () => abrirItem(x) }; });

    // Contratos
    const contratos = fams.map((f, i) => { let renov = addM(f.start, 12); while (ativo && renov <= hoje) renov = addM(renov, 12); const iniC = addM(renov, -12);
      const pct = Math.min(100, Math.max(0, (hoje - iniC) / (renov - iniC) * 100)), dias = Math.round((renov - hoje) / 864e5), cod = "CT-" + f.start.getFullYear() + "-" + (100 + (h % 800) + i * 7);
      return { f, i, renov, pct, dias, cod, modo: i === 0 ? (h % 2 ? "Contrato anual" : "Pré-pago mensal") : "Aditivo", arq: (i === 0 ? "Contrato-" : "Aditivo-") + cod + ".pdf" }; });
    const proxRen = ativo ? contratos.slice().sort((a, b) => a.renov - b.renov)[0] : null;

    // Documentos
    const baixar = (nome, conteudo, tipo) => { const a = document.createElement("a"); a.href = typeof conteudo === "string" && conteudo.indexOf("data:") === 0 ? conteudo : URL.createObjectURL(new Blob([conteudo], { type: tipo })); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); };
    const docGerado = (k) => ({ k });
    const docs = [];
    contratos.forEach(ct => docs.push({ id: "ct-" + ct.f.k, cat: "Contratos", nome: (ct.i === 0 ? "Contrato de prestação de serviços · " : "Aditivo contratual · ") + ct.f.F.l, arq: ct.arq, ext: "PDF", meta: ct.cod + " · assinado em " + dmy(ct.f.start) + " via ClickSign · " + (180 + (h >> ct.i) % 220) + " KB", d: ct.f.start, ver: { tipo: "contrato", ct } }));
    const oppG = oppsC.find(o => o.etapa === "ganho");
    docs.push({ id: "pp", cat: "Propostas", nome: "Proposta comercial aceita · " + fams[0].F.l, arq: "Proposta-" + slug(c.nome) + "-v2.pdf", ext: "PDF", meta: "Aceita em " + dmy(new Date(ini0.getTime() - 5 * 864e5)) + " · " + brl(fams[0].budget) + "/mês", d: new Date(ini0.getTime() - 5 * 864e5),
      ir: oppG ? () => E && E.irPara("/onface-preview/proposta", "Proposta", { opp: oppG.id, ver: "" }) : null, ver: { tipo: "proposta" } });
    docs.push({ id: "kick", cat: "Onboarding", nome: "Plano de implantação e kickoff", arq: "Kickoff-" + slug(c.nome) + ".pdf", ext: "PDF", meta: "Ata do kickoff · " + dmy(new Date(ini0.getTime() + 4 * 864e5)), d: new Date(ini0.getTime() + 4 * 864e5), ver: { tipo: "kickoff" } });
    fats.filter(f => f.o && f.o.comprovante).forEach(f => docs.push({ id: "cp-" + f.id, cat: "Financeiro", nome: "Comprovante · fatura " + f.comp, arq: f.o.comprovante.nome, ext: (f.o.comprovante.nome.split(".").pop() || "ARQ").slice(0, 4).toUpperCase(), meta: "Baixa manual · " + (f.o.forma || "") + " · " + dmy(new Date(f.o.pagoEm)), d: new Date(f.o.pagoEm), url: f.o.comprovante.url }));
    docs.push({ id: "nfs", cat: "Financeiro", nome: "Notas fiscais (" + fats.length + ")", arq: "NFs-" + slug(c.nome) + ".zip", ext: "ZIP", meta: "Emitidas automaticamente a cada fatura do Stripe", d: fats[0] ? fats[0].m : hoje, ir: () => this.setState({ aba: "financeiro" }) });
    (this.dadosDoProto.Relacoes ? this.dadosDoProto.Relacoes({ empresa: c.nome }).itens : []).filter(r => r.k === "proposta").forEach((r, i) => docs.push({ id: "pr" + i, cat: "Propostas", nome: "Proposta " + r.titulo, arq: r.titulo, ext: "PDF", meta: r.status + " · " + r.sub, d: hoje, ir: r.ir }));
    (X.docs || []).forEach(d => docs.push({ id: d.id, cat: d.cat || "Outros", nome: d.nome, arq: d.nome, ext: (d.nome.split(".").pop() || "ARQ").slice(0, 4).toUpperCase(), meta: "Enviado por " + d.autor + " · " + dmy(new Date(d.quando)) + " · " + d.tam, d: new Date(d.quando), url: d.url, up: true }));
    docs.sort((a, b) => b.d - a.d);
    const docHtml = (V) => { const itens = V.tipo === "contrato" ? V.ct.f.itens.map(x => x.qtd + " × " + x.nome + " — " + brl2(x.qtd * x.preco)).join("<br>") : fams.map(f => f.F.l + " — " + brl(f.budget) + "/mês").join("<br>");
      return "<html><meta charset='utf-8'><body style='font-family:Inter,Arial;padding:40px;color:#1f252c'><h2>" + (V.tipo === "contrato" ? "Contrato " + V.ct.cod : V.tipo === "proposta" ? "Proposta comercial" : "Plano de implantação") + "</h2><p>" + c.nome + " · CNPJ " + cnpj + "</p><p>" + itens + "</p><p>Callface Tecnologia · " + csm + "</p></body></html>"; };
    const abrirDoc = (d) => { if (d.ir) return d.ir(); if (d.url) return baixar(d.arq, d.url); if (d.up) return diz("Esse arquivo foi salvo só como registro (era grande demais)", "aviso"); this.setState({ modal: { k: "doc", id: d.id } }); };
    const enviarDocs = (e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (!fs.length) return; const novos = []; let pend = fs.length;
      const fim = () => { salvarX({ docs: (X.docs || []).concat(novos) }, { t: novos.length > 1 ? novos.length + " arquivos enviados" : "Arquivo enviado · " + novos[0].nome, meta: "Documentos da conta", cat: "nota", ico: "clip" }); diz(novos.length > 1 ? novos.length + " arquivos adicionados" : novos[0].nome + " adicionado", "ok"); };
      fs.forEach(fl => { const base = { id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nome: fl.name, tam: fl.size > 1048576 ? (fl.size / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(fl.size / 1024)) + " KB", quando: new Date().toISOString(), autor: EU, cat: /contrat|aditivo/i.test(fl.name) ? "Contratos" : /nf|nota|boleto|comprov/i.test(fl.name) ? "Financeiro" : "Outros" };
        if (fl.size > 1.5 * 1048576) { novos.push(base); if (!--pend) fim(); return; }
        const r = new FileReader(); r.onload = () => { novos.push(Object.assign(base, { url: r.result })); if (!--pend) fim(); }; r.readAsDataURL(fl); }); };
    const DCAT = ["todos", "Contratos", "Propostas", "Financeiro", "Onboarding", "Outros"];
    const docsF = docs.filter(d => S.docF === "todos" || d.cat === S.docF);

    // Histórico
    const ev = [], push = (d, t, meta, cat, dPath, tom) => { if (d && !isNaN(d)) ev.push({ d, t, meta: meta || "", cat, dPath, tom: tom || "neutro" }); };
    push(ini0, "Virou cliente · contrato " + contratos[0].cod + " assinado", fams[0].F.l + " · fechado por " + closer, "comercial", I.check, "coral");
    fams.slice(1).forEach(f => push(f.start, "Cross-sell: " + f.F.l + " contratado", f.itens.map(x => x.qtd + " × " + x.nome).join(" · "), "comercial", I.plus, "coral"));
    fams.forEach(f => f.itens.slice(1).forEach(x => { if (x.inicio > f.start) push(x.inicio, "Upsell: " + x.nome, x.qtd + " " + x.un + " · " + brl(x.qtd * x.preco) + "/mês", "comercial", I.trend, "coral"); }));
    if (fimD) push(fimD, "Conta encerrada (churn)", "Contrato não renovado", "comercial", I.alert, "erro");
    fats.forEach(f => { if (f.st === "Pago" && f.pagoEm && !f.o) push(f.pagoEm, "Fatura " + f.comp + " paga", brl2(f.v) + " · " + forma + " · Stripe", "financeiro", I.check, "ok"); if (f.st === "Vencida") push(new Date(f.venc.getTime() + 36e6), "Fatura " + f.comp + " venceu sem pagamento", brl2(f.v) + " · " + f.inId, "financeiro", I.alert, "erro"); });
    const HT = { ligacao: I.tel, email: I.mail, whatsapp: I.wa, reuniao: I.video, proposta: I.doc, etapa: I.trend, nota: I.note, concluiu: I.check };
    const relQ = (s) => { const m = /^([+-]\d+)(?:\s+(\d{1,2}):(\d{2}))?/.exec(s || ""); if (!m) return null; const d = new Date(); d.setHours(m[2] ? +m[2] : 9, m[3] ? +m[3] : 0, 0, 0); d.setDate(d.getDate() + (+m[1])); return d; };
    (this.dadosDoProto.HistoricoSeed || []).filter(x => x.empresa === c.nome).forEach(x => push(relQ(x.quando), x.acao, x.meta || x.alvo, x.t === "nota" ? "nota" : x.t === "etapa" || x.t === "proposta" ? "comercial" : "atividades", HT[x.t] || I.note));
    AG.filter(x => x.situacao === "Feita").forEach(x => push(x.quando || new Date(), x.tipo + " · " + x.titulo, [x.pessoa, x.resp].filter(Boolean).join(" · "), "atividades", TIPOI[x.tipo] || I.check));
    const EVI = { tel: I.tel, mail: I.mail, wa: I.wa, pag: I.check, via: I.send, pessoa: I.user, nota: I.note, clip: I.clip, opp: I.pipe, resp: I.user, link: I.link };
    (X.eventos || []).forEach(e => push(new Date(e.quando), e.t, [e.meta, e.autor].filter(Boolean).join(" · "), e.cat || "nota", EVI[e.ico] || I.note, e.cat === "financeiro" ? "ok" : e.cat === "comercial" ? "coral" : "neutro"));
    ev.sort((a, b) => b.d - a.d);
    const quando = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const n = Math.round((h0 - x) / 864e5), hm = pad(d.getHours()) + ":" + pad(d.getMinutes());
      return n === 0 ? "Hoje, " + hm : n === 1 ? "Ontem, " + hm : n > 1 && n < 7 ? "Há " + n + " dias" : dExt(d); };
    const MARCA = { coral: "background:#fff6f4;color:#c2330f", ok: "background:#e6f4ee;color:#1f7256", erro: "background:#fdeeea;color:#c2330f", neutro: "background:#f3f4f4;color:#4a5560" };
    const evRow = (arr) => arr.map((e, i) => ({ t: e.t, meta: e.meta, quando: quando(e.d), d: e.dPath,
      marca: "position:relative;z-index:1;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;box-shadow:0 0 0 3px #fff;" + MARCA[e.tom],
      linha: i < arr.length - 1 ? "position:absolute;left:11.25px;top:34px;bottom:-6px;width:1.5px;background:#eef1f1" : "display:none" }));
    const HF = [["todos", "Tudo"], ["atividades", "Atividades"], ["financeiro", "Financeiro"], ["comercial", "Comercial"], ["nota", "Notas"]];
    const evF = ev.filter(e => S.histF === "todos" || e.cat === S.histF);

    // Saúde
    const mU = /Há (\d+) dias/.exec(c.ultima || ""), diasSem = /^Hoje/.test(c.ultima) ? 0 : /^Ontem/.test(c.ultima) ? 1 : mU ? +mU[1] : 0;
    const chamados = AG.filter(x => x.area === "Suporte" && x.situacao !== "Feita").length, ultPago = fats.find(f => f.st === "Pago");
    const fat4 = [
      vencidas.length ? [I.card, vencidas.length + (vencidas.length > 1 ? " faturas vencidas" : " fatura vencida"), brl2(vencido) + " em atraso no Stripe", "erro"] : [I.card, "Pagamentos em dia", ultPago && ultPago.pagoEm ? "Última fatura paga em " + dmy(ultPago.pagoEm) : "Sem histórico de atraso", "ok"],
      [I.trend, usoPct >= 75 ? "Uso consistente" : usoPct >= 55 ? "Uso moderado" : "Uso baixo", licU + " de " + licT + " licenças em uso (" + usoPct + "%)", usoPct >= 75 ? "ok" : usoPct >= 55 ? "coral" : "erro"],
      [I.heart, diasSem <= 7 ? "Engajamento ativo" : diasSem <= 30 ? "Engajamento morno" : "Conta fria", diasSem <= 7 ? "Último contato: " + (c.ultima || "recente").toLowerCase() : "Sem contato há " + diasSem + " dias", diasSem <= 7 ? "ok" : diasSem <= 30 ? "coral" : "erro"],
      [I.headset, chamados ? chamados + (chamados > 1 ? " chamados abertos" : " chamado aberto") : "Sem chamados abertos", chamados ? "Acompanhar com o suporte" : "Suporte sem pendências", chamados ? "coral" : "ok"]];
    const sd = !ativo ? ["Inativo", "neutro", "A conta foi encerrada. Vale uma tentativa de reativação."] : c.saude >= 70 ? ["Saudável", "ok", "Conta estável e com baixo risco de churn. Boa candidata a upsell."] : c.saude >= 45 ? ["Em atenção", "coral", "Sinais mistos. Uma revisão de uso ajuda a destravar valor antes da renovação."] : ["Em risco", "erro", "Risco alto de churn. Priorize uma ligação de retenção esta semana."];

    // Gráfico (padrão do forecast de Propostas)
    const passo = (mx) => { const alvo = mx / 4, pot = Math.pow(10, Math.floor(Math.log10(Math.max(1, alvo)))), n2 = alvo / pot; return (n2 <= 1 ? 1 : n2 <= 2 ? 2 : n2 <= 2.5 ? 2.5 : n2 <= 5 ? 5 : 10) * pot; };
    const stE = passo(Math.max(1, ...tot)), topo = stE * 4, Xg = (i) => i / 11 * 600, Yg = (v) => 136 - v / topo * 128;
    const curva = (ys, rev) => { const idx = ys.map((_, i) => i); if (rev) idx.reverse();
      return idx.map((i, n) => { const x = Xg(i), y = Yg(ys[i]); if (!n) return (rev ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); const p = idx[n - 1], xp = Xg(p), yp = Yg(ys[p]), xm = ((xp + x) / 2).toFixed(1); return "C" + xm + " " + yp.toFixed(1) + " " + xm + " " + y.toFixed(1) + " " + x.toFixed(1) + " " + y.toFixed(1); }).join(" "); };
    const hv = S.hv != null ? S.hv : null, hi = hv != null ? hv : 11, modo = S.graf;
    const ant = W.map((_, i) => i ? tot[i - 1] : tot[0]);
    const cum = fams.map((_, j) => W.map((__, i) => serie.slice(0, j + 1).reduce((a, s) => a + s[i], 0)));
    const eixoK = (n) => n >= 1000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : "R$ " + Math.round(n);
    const dH = hi ? tot[hi] - tot[hi - 1] : 0;
    const g = { sair: () => this.setState({ hv: null }), ehTotal: modo === "total", ehFam: modo === "fam",
      modos: [["total", "MRR"], ["fam", "Por produto"]].map(([k, l]) => ({ l, onClick: () => this.setState({ graf: k }), style: "height:26px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (modo === k ? "background:rgba(255,255,255,.12);color:#fff;font-weight:600" : "background:transparent;color:#a3aab0;font-weight:500") })),
      legenda: modo === "total" ? [{ l: "MRR", dot: "width:14px;height:2.5px;border-radius:2px;background:#fe4f2b" }, { l: "Mês anterior", dot: "width:14px;height:0;border-top:1.6px dashed #67787c" }] : fams.map(f => ({ l: f.F.l, dot: "width:9px;height:9px;border-radius:2px;background:" + f.F.cor })),
      pergunta: modo === "total" ? "Quanto a conta paga por mês nos últimos 12 meses" : "Como o MRR se divide entre os produtos",
      yl: [4, 3, 2, 1, 0].map(k => ({ l: eixoK(stE * k), st: "position:absolute;right:0;font-size:10.5px;line-height:10px;color:#67787c;font-variant-numeric:tabular-nums;white-space:nowrap;top:calc(" + (Yg(stE * k) / 140 * 100) + "% - 5px)" })),
      dLinha: curva(tot), dArea: curva(tot) + " L600 140 L0 140 Z", dAnt: curva(ant),
      camadas: fams.map((f, j) => ({ d: curva(cum[j]) + " " + (j ? curva(cum[j - 1], true) : "L600 140 L0 140") + " Z", cor: f.F.cor, st: "transform-origin:50% 100%;animation:fcArea .9s " + (.15 + j * .12) + "s cubic-bezier(.16,1,.3,1) both" })).reverse(),
      dGuia: hv != null ? "M" + Xg(hv).toFixed(1) + " 0V140" : "M0 0",
      ponto: "position:absolute;pointer-events:none;width:12px;height:12px;border-radius:9999px;background:#fe4f2b;box-shadow:0 0 0 3px #12171d,0 0 0 5px rgba(254,79,43,.35);transition:left .15s,top .15s;left:calc(" + (hi / 11 * 100).toFixed(2) + "% - 6px);top:calc(" + (Yg(tot[hi]) / 140 * 100).toFixed(2) + "% - 6px)",
      alvos: W.map((_, i) => ({ entrar: () => { if (S.hv !== i) this.setState({ hv: i }); } })),
      tipStyle: "position:absolute;z-index:3;pointer-events:none;top:-4px;width:190px;padding:9px 11px;border-radius:10px;background:#1f252c;box-shadow:0 0 0 1px #2a3139,0 14px 30px -12px rgba(0,0,0,.6);transition:opacity .15s;opacity:" + (hv == null ? 0 : 1) + ";" + (hi > 6 ? "right:calc(" + ((1 - hi / 11) * 100).toFixed(2) + "% + 14px)" : "left:calc(" + (hi / 11 * 100).toFixed(2) + "% + 14px)"),
      tipT: MESL[W[hi].getMonth()] + " " + W[hi].getFullYear(), tipTot: brl(tot[hi]),
      tipL: fams.map((f, j) => ({ l: f.F.l, v: brl(serie[j][hi]), dot: "width:8px;height:8px;border-radius:2px;background:" + f.F.cor })),
      tipD: hi ? (dH >= 0 ? "+" : "−") + brl(Math.abs(dH)) + " vs. mês anterior" : "início da janela", tipDStyle: "display:block;margin-top:5px;font-size:11px;font-weight:600;color:" + (dH >= 0 ? "#3ecf8e" : "#ff8a70"),
      rot: W.map((m, i) => ({ l: MES[m.getMonth()], st: "position:absolute;top:0;font-size:10.5px;white-space:nowrap;color:" + (hv === i ? "#fff" : "#67787c") + ";left:" + (i / 11 * 100) + "%;transform:" + (i === 0 ? "none" : i === 11 ? "translateX(-100%)" : "translateX(-50%)") })) };

    // Oportunidade (fluxo de Propostas, para cliente)
    const FAML = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", ASSISTANT: "Callface Assistant" };
    const TIPO = { expansao: "Upsell · expansão", upgrade: "Upgrade", crosssell: "Cross-sell", renovacao: "Renovação" };
    const naoTem = PK.filter(k => fks.indexOf(k) < 0);
    const abrirOpp = (tipo, familia) => this.setState({ menu: null, resp: null, modal: { k: "opp", passo: tipo ? 1 : 0, tipo: tipo || null, familia: familia || (tipo === "crosssell" ? (naoTem[0] || fks[0]) : fks[0]), contato: principal.nome, closer, obs: "", valor: "", erro: "" } });
    const M = S.modal, upM = (p) => this.setState(s => ({ modal: Object.assign({}, s.modal, p, { erro: "" }) }));
    let nv = { aberto: false, passos: [], tipos: [], familias: [], contatos: [], equipe: [], efeitos: [] };
    if (M && M.k === "opp") {
      const chipS = (on) => "height:34px;padding:0 13px;border-radius:9999px;border:0;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
      const ctF = contratos.find(x => x.f.k === M.familia) || contratos[0];
      const famsOk = M.tipo === "crosssell" ? (naoTem.length ? naoTem : PK) : fks;
      const criar = (prop) => { if (!M.contato) return upM({ erro: "Escolha quem recebe." }); if (M.tipo === "crosssell" && fks.indexOf(M.familia) >= 0 && naoTem.length) return upM({ erro: "Cross-sell é outro produto: escolha um que o cliente ainda não tem." });
        if (!E) return; const id = "o" + Date.now().toString(36), P = pes.find(p => p.nome === M.contato) || {}, val = parseInt(M.valor || "0", 10);
        const nova = { id, empresa: c.nome, pessoa: M.contato, cargo: P.cargo || "", familia: M.familia, etapa: "entrada", resp: M.closer, dias: 0, tipo: M.tipo === "crosssell" ? "nova" : M.tipo, origem: "Cliente ativo",
          contratoOrigem: M.tipo !== "crosssell" ? { id: ctF.cod, titulo: "Contrato " + FAML[ctF.f.k] + " · " + ctF.cod } : undefined, clienteId: c.id,
          itens: val ? [{ nome: TIPO[M.tipo] + " · " + FAML[M.familia], natureza: "MRR", valor: val, qtd: 1 }] : [], propostas: [], pessoas: [{ nome: M.contato, papel: "Contato principal" }], atvs: [],
          notas: M.obs ? [{ texto: M.obs, autor: EU, quando: "Hoje" }] : [], eventos: [{ t: TIPO[M.tipo] + " criada a partir do Cliente 360", quando: "Hoje", autor: EU }] };
        E.gravar({ opps: opps.concat([nova]) });
        salvarX({}, { t: TIPO[M.tipo] + " de " + FAML[M.familia] + " aberta no Pipeline", meta: "Closer " + M.closer + " · contato " + M.contato + (val ? " · " + brl(val) + "/mês" : ""), cat: "comercial", ico: "opp" });
        this.setState({ modal: null }); diz(TIPO[M.tipo] + " criada no Pipeline" + (prop ? " · abrindo a proposta" : ""), "ok");
        setTimeout(() => prop ? E.irPara("/onface-preview/proposta", "Proposta", { opp: id, ver: "" }) : E.irPara("/onface-preview/oportunidade", c.nome, { opp: id, ver: "" }), 350); };
      const fam0 = fams[0], lic0 = fam0.itens[0];
      nv = { aberto: true, e0: M.passo === 0, e1: M.passo === 1, titulo: M.passo === 0 ? "Nova oportunidade para " + c.nome : TIPO[M.tipo], sub: M.passo === 0 ? "Que tipo de venda é essa? Toda oportunidade entra no Pipeline e pode virar proposta na hora." : "Confira os dados. A oportunidade nasce ligada ao contrato do cliente.",
        passos: ["Tipo", "Confirmar"].map((l, i) => { const on = i === M.passo, ok = i < M.passo; return { n: ok ? "✓" : String(i + 1), label: l,
          wrap: "display:flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 5px;border-radius:9999px;" + (on ? "background:#12171d" : ok ? "background:#fff6f4" : "background:#f3f4f4"),
          num: "width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:700;" + (on ? "background:#fe4f2b;color:#fff" : ok ? "background:#c2330f;color:#fff" : "background:#fff;color:#8b949e"),
          lbl: "font-size:12.5px;font-weight:600;white-space:nowrap;color:" + (on ? "#fff" : ok ? "#c2330f" : "#8b949e") }; }),
        tipos: [["expansao", "Upsell · expansão", "Mais licenças, agentes, ramais ou módulos no que ele já tem.", I.plus, lic0 ? "Hoje: " + lic0.qtd + " " + lic0.un + " no " + lic0.nome : ""],
          ["upgrade", "Upgrade", "Troca para um plano superior dentro do mesmo produto.", I.up, fam0.itens.map(x => x.nome).slice(0, 2).join(" + ")],
          ["crosssell", "Cross-sell", "Outro produto da Callface para a mesma conta.", I.layers, naoTem.length ? "Ainda não tem: " + naoTem.map(k => FAML[k]).join(", ") : "Já tem todas as famílias"],
          ["renovacao", "Renovação", "Fim de vigência, novo prazo e reajuste.", I.swap, proxRen ? "Renova em " + proxRen.dias + " dias · " + dmy(proxRen.renov) : "Conta encerrada"]]
          .map(([k, l, s2, d, ctx]) => ({ l, s: s2, d, ctx, onClick: () => upM({ passo: 1, tipo: k, familia: k === "crosssell" ? (naoTem[0] || fks[0]) : fks[0] }) })),
        tipoL: TIPO[M.tipo] || "", alvoS: "Cliente desde " + dExt(ini0) + " · " + brl(mrr) + "/mês · " + ctF.cod, voltar: () => upM({ passo: 0 }),
        familias: famsOk.map(k => ({ l: FAML[k], style: chipS(M.familia === k), onClick: () => upM({ familia: k }) })),
        contatos: pes.map(p => { const on = M.contato === p.nome; return { nome: p.nome, cargo: p.cargo + " · " + p.papel, onClick: () => upM({ contato: p.nome }),
          style: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:11px;border:0;cursor:pointer;background:#fff;box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #e3e7e8"),
          radio: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;box-shadow:inset 0 0 0 " + (on ? "5px #fe4f2b" : "1.5px #a9b1b4") }; }),
        closer: M.closer, setCloser: (e) => upM({ closer: e.target.value }), equipe,
        valor: M.valor, setValor: (e) => upM({ valor: e.target.value.replace(/\D/g, "") }), obs: M.obs, setObs: (e) => upM({ obs: e.target.value }),
        obsPh: M.tipo === "renovacao" ? "Ex: quer renovar por 24 meses com reajuste menor" : "Ex: vai abrir 2 filiais e precisa de mais 6 usuários",
        efeitos: [[I.pipe, "Entra no Pipeline em Entrada", TIPO[M.tipo] + " de " + FAML[M.familia] + " com " + M.closer + " como closer"],
          M.tipo === "crosssell" ? [I.doc, "Novo contrato ao ganhar", "Soma um produto novo à assinatura do Stripe"] : [I.doc, "Nasce como aditivo", "Ligado ao " + ctF.cod + ". Ao ganhar, altera a assinatura atual no Stripe"],
          [I.check, "Relacionamento continua Cliente", "A oportunidade aparece em Em andamento, aqui e na empresa"],
          [I.note, "Registro no histórico", "A conta ganha o evento com o contexto que você escrever"]].map(([d, t, s2]) => ({ d, t, s: s2 })),
        erro: M.erro || "", criarOpp: () => criar(false), criarProp: () => criar(true) };
    }

    // Modais simples
    const chip = (on) => "height:30px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
    const fB = M && M.k === "baixa" ? fats.find(f => f.id === M.fid) : null;
    const mB = fB ? { aberto: true, sub: "Fatura " + fB.comp + " · " + brl2(fB.v) + " · " + fB.inId,
      formas: ["Pix", "TED", "Boleto", "Dinheiro"].map(l => ({ l, onClick: () => upM({ forma: l }), style: chip(M.forma === l) })), data: M.data, setData: (e) => upM({ data: e.target.value }),
      arqTxt: M.arq ? M.arq.nome : "Anexar comprovante (imagem ou PDF)", arqStyle: "display:flex;align-items:center;gap:9px;height:40px;padding:0 12px;border-radius:9px;cursor:pointer;font-size:13px;" + (M.arq ? "background:#fff6f4;color:#9c3210;box-shadow:inset 0 0 0 1px #f6d9cf" : "background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #dbdede"),
      setArq: (e) => { const fl = (e.target.files || [])[0]; e.target.value = ""; if (!fl) return; if (fl.size > 1.5 * 1048576) return upM({ arq: { nome: fl.name } }); const r = new FileReader(); r.onload = () => upM({ arq: { nome: fl.name, url: r.result } }); r.readAsDataURL(fl); },
      motivo: M.motivo, setMotivo: (e) => upM({ motivo: e.target.value }), temErro: !!M.erro, erro: M.erro,
      salvar: () => { if (!M.arq) return upM({ erro: "Anexe o comprovante do pagamento." }); if ((M.motivo || "").trim().length < 10) return upM({ erro: "Conte em uma frase por que a baixa é manual." });
        const quando = M.data ? new Date(M.data + "T12:00:00").toISOString() : new Date().toISOString();
        salvarX({ faturas: Object.assign({}, X.faturas || {}, { [fB.id]: { status: "Pago", pagoEm: quando, manual: true, forma: M.forma, comprovante: M.arq, motivo: M.motivo.trim() } }) }, { t: "Baixa manual · fatura " + fB.comp, meta: brl2(fB.v) + " · " + M.forma + " · " + M.motivo.trim(), cat: "financeiro", ico: "pag" });
        this.setState({ modal: null }); diz("Fatura " + fB.comp + " baixada · comprovante anexado", "ok"); } } : { aberto: false, formas: [] };
    const dD = M && M.k === "doc" ? docs.find(d => d.id === M.id) : null;
    const mD = dD ? (() => { const V = dD.ver || {}, ct = V.ct;
      return { aberto: true, arq: dD.arq, meta: dD.meta, cod: ct ? ct.cod : V.tipo === "proposta" ? "P-" + (1000 + h % 900) + "-v2" : "KO-" + (100 + h % 800),
        titulo: V.tipo === "contrato" ? (ct.i === 0 ? "Contrato de prestação de serviços" : "Aditivo contratual") + " · " + ct.f.F.l : V.tipo === "proposta" ? "Proposta comercial" : "Plano de implantação e kickoff",
        partes: "Contratante: " + c.nome + ", CNPJ " + cnpj + ", " + cidade + ". Contratada: Callface Tecnologia Ltda. Representada por " + closer + ".",
        linhas: V.tipo === "contrato" ? ct.f.itens.map(x => ({ l: x.qtd + " × " + x.nome, v: brl2(x.qtd * x.preco) })).concat(ct.f.desc ? [{ l: "Desconto negociado", v: "− " + brl2(ct.f.desc) }] : []).concat([{ l: "Total mensal", v: brl2(ct.f.budget) }])
          : V.tipo === "proposta" ? fams.map(f => ({ l: f.F.l + " · " + f.itens.map(x => x.nome).join(", "), v: brl(f.budget) + "/mês" }))
          : [{ l: "Kickoff", v: dmy(new Date(ini0.getTime() + 4 * 864e5)) }, { l: "Configuração e integrações", v: "Semana 1–2" }, { l: "Treinamento da equipe", v: "Semana 3" }, { l: "Virada", v: "Semana 4" }],
        clausula: V.tipo === "contrato" ? "Vigência de 12 meses a partir de " + dmy(ct.f.start) + ", renovada automaticamente por igual período. Cobrança recorrente via Stripe (" + forma + "), vencimento todo dia 10." : V.tipo === "proposta" ? "Proposta válida por 14 dias. Valores mensais, cobrança recorrente via Stripe." : "Responsáveis: " + csm + " (Customer Success) e " + principal.nome + " (" + c.nome + ").",
        assin: [{ nome: principal.nome, papel: c.nome + " · " + principal.cargo }, { nome: closer, papel: "Callface Tecnologia" }],
        baixar: () => { baixar(dD.arq.replace(/\.pdf$/, "") + ".html", docHtml(V), "text/html;charset=utf-8"); diz(dD.arq + " baixado", "ok"); } }; })() : { aberto: false, linhas: [], assin: [] };
    const mP = M && M.k === "pes" ? { aberto: true, sub: "Vincular um contato à conta " + c.nome, nome: M.nome, setNome: (e) => upM({ nome: e.target.value }), cargo: M.cargo, setCargo: (e) => upM({ cargo: e.target.value }),
      email: M.email, setEmail: (e) => upM({ email: e.target.value }), phEmail: "nome@" + dominio, tel: M.tel, setTel: (e) => upM({ tel: e.target.value }),
      papeis: PAP.map(r => ({ l: r, onClick: () => upM({ papel: r }), style: chip(M.papel === r) })), temErro: !!M.erro, erro: M.erro,
      salvar: () => { const nome = (M.nome || "").trim(); if (!nome) return upM({ erro: "Informe o nome." }); if (pes.some(p => p.nome.toLowerCase() === nome.toLowerCase())) return upM({ erro: nome + " já está na conta." });
        salvarX({ pessoas: (X.pessoas || []).concat([{ nome, cargo: (M.cargo || "").trim(), email: (M.email || "").trim(), tel: (M.tel || "").trim(), papel: M.papel }]) }, { t: nome + " adicionado à conta", meta: [M.papel, M.cargo].filter(Boolean).join(" · "), cat: "nota", ico: "pessoa" });
        this.setState({ modal: null }); diz(nome + " agora faz parte da conta", "ok"); } } : { aberto: false, papeis: [] };

    // Financeiro
    const btnA = (dark) => "display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;" + (dark ? "background:#d93c1a;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
    const comprovante = (f) => { if (f.o && f.o.comprovante && f.o.comprovante.url) return baixar(f.o.comprovante.nome, f.o.comprovante.url);
      baixar("comprovante-" + slug(c.nome) + "-" + f.id + ".html", "<html><meta charset='utf-8'><body style='font-family:Inter,Arial;padding:40px'><h2>Comprovante de pagamento</h2><p>" + c.nome + " · CNPJ " + cnpj + "</p><p>Fatura " + f.comp + " · " + f.inId + " · " + f.nf + "</p><p>Valor: " + brl2(f.v) + "</p><p>Pago em " + (f.pagoEm ? dmy(f.pagoEm) : "—") + " · " + (f.o ? f.o.forma : forma) + "</p><p>Processado por Stripe</p></body></html>", "text/html;charset=utf-8");
      diz("Comprovante de " + f.comp + " baixado", "ok"); };
    const cobrar = (f) => { copiar(f.hosted, "Link de cobrança"); salvarX({}, { t: "Link de cobrança gerado · fatura " + f.comp, meta: brl2(f.v) + " · " + f.inId, cat: "financeiro", ico: "link" }); };
    const reenviar = (f) => { salvarX({}, { t: "Cobrança reenviada · fatura " + f.comp, meta: "Stripe enviou o link para " + finP.email, cat: "financeiro", ico: "via" }); diz("Stripe reenviou a cobrança para " + finP.email, "ok"); };
    const fatRow = (f) => ({ comp: f.comp, ids: f.inId + " · " + f.nf, venc: dmy(f.venc), vencTxt: f.st === "Pago" ? "Pago em " + (f.pagoEm ? dmy(f.pagoEm) : "—") : "Vence " + dmy(f.venc), valor: brl2(f.v),
      pago: f.st === "Pago" && f.pagoEm ? dmy(f.pagoEm) : "—", via: f.st === "Pago" ? (f.o ? "Baixa manual · " + f.o.forma : forma) : f.st === "Vencida" ? Math.round((h0 - f.venc) / 864e5) + " dias em atraso" : "",
      st: f.st, stStyle: pill(FST[f.st]), dot: dotS(FST[f.st]),
      acoes: f.st === "Pago" ? [{ l: "Comprovante", d: I.dl, dica: "Baixar comprovante", onClick: () => comprovante(f), style: btnA(false) }, { l: "Stripe", d: I.ext, dica: "Ver fatura no Stripe", onClick: () => ext(f.dash), style: btnA(false) }]
        : [{ l: "Link", d: I.link, dica: "Copiar link de pagamento", onClick: () => cobrar(f), style: btnA(false) }, { l: "Reenviar", d: I.send, dica: "Reenviar cobrança pelo Stripe", onClick: () => reenviar(f), style: btnA(false) },
           { l: "Baixa manual", d: I.check, dica: "Registrar pagamento fora do Stripe", onClick: () => this.setState({ modal: { k: "baixa", fid: f.id, forma: "Pix", data: isoD(hoje), motivo: "", arq: null, erro: "" } }), style: btnA(true) }] });
    const fatFil = fats.filter(f => S.fatF === "todas" || (S.fatF === "pagas" ? f.st === "Pago" : S.fatF === "aberto" ? f.st === "Em aberto" : f.st === "Vencida"));
    const seg = (on) => "height:26px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (on ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:#4a5560;font-weight:500");
    const exportar = () => { const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
      baixar("faturas-" + slug(c.nome) + ".csv", "\ufeff" + [["Competência", "Stripe", "NF", "Vencimento", "Valor", "Status", "Pago em"]].concat(fats.map(f => [f.comp, f.inId, f.nf, dmy(f.venc), f.v.toFixed(2).replace(".", ","), f.st, f.pagoEm && f.st === "Pago" ? dmy(f.pagoEm) : ""])).map(l => l.map(q).join(";")).join("\n"), "text/csv;charset=utf-8");
      diz(fats.length + " faturas exportadas", "ok"); };
    const tile = (l, v, s2, cor, fn) => ({ l, v, s: s2, onClick: fn, vStyle: "display:block;margin-top:5px;font-family:'Plus Jakarta Sans',sans-serif;font-size:19px;font-weight:700;letter-spacing:-.02em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;color:" + cor });
    const kpiS = (cor) => "display:block;margin-top:5px;font-family:'Plus Jakarta Sans',sans-serif;font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;color:" + cor;
    const irAba = (k) => () => this.setState({ aba: k, menu: null, resp: null });
    const ABAS = [["geral", "Visão geral"], ["produtos", "Produtos", fams.reduce((a, f) => a + f.itens.length, 0)], ["financeiro", "Financeiro", vencidas.length || null, !!vencidas.length], ["pessoas", "Pessoas", pes.length], ["documentos", "Documentos", docs.length], ["historico", "Histórico"]];
    const andR = this.dadosDoProto.Relacoes ? this.dadosDoProto.Relacoes({ empresa: c.nome }).itens.filter(r => r.k !== "cliente") : [];
    const IK = { opp: I.pipe, proposta: I.doc, aquisicao: I.pulse };
    const statusC = !ativo ? ["Churn · " + MESL[fimD.getMonth()].toLowerCase() + " " + fimD.getFullYear(), "neutro"] : c.status === "Em implantação" ? ["Em implantação", "coral"] : ["Cliente ativo", "ok"];
    const radio = (on) => "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;box-shadow:inset 0 0 0 " + (on ? "5px #fe4f2b" : "1.5px #a9b1b4");
    const pesVal = (p, i) => { const ehP = p === principal;
      return { nome: p.nome, cargo: p.cargo, papel: p.papel, cargoPapel: p.cargo + " · " + p.papel, ini: ini(p.nome.replace(/^Dr\.?\s+/, "")), email: p.email, tel: p.tel, ultimo: p.ultimo, ehPrincipal: ehP, abrir: () => abrirPessoa(p),
        linha: "display:flex;align-items:center;gap:11px;flex-wrap:wrap;padding:11px 0;" + (i === 0 ? "" : "border-top:1px solid #f3f5f5"),
        acoes: [{ titulo: "WhatsApp", d: I.wa, onClick: () => atend(p, "WhatsApp") }, { titulo: "Ligar pelo Callface", d: I.tel, onClick: () => ligar(p) }, { titulo: "E-mail", d: I.mail, onClick: () => atend(p, "E-mail") }],
        princTxt: ehP ? "Principal" : "Tornar principal", princDica: ehP ? "Contato principal da conta" : "Tornar contato principal",
        princStyle: "flex:0 0 auto;height:30px;padding:0 10px;border-radius:7px;border:0;font-size:11.5px;font-weight:600;white-space:nowrap;cursor:" + (ehP ? "default;background:#fff6f4;color:#c2330f" : "pointer;background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #e3e7e8"),
        tornarPrincipal: () => { if (ehP) return; salvarX({ principal: p.nome }, { t: p.nome + " virou o contato principal", meta: p.cargo, cat: "nota", ico: "resp" }); diz(p.nome + " agora é o contato principal", "ok"); } }; };

    return {
      topo: { titulo: c.nome, sub: "Cliente 360", trilha: [{ label: "Clientes", ir: () => E && E.irPara("/clientes", "Clientes") }] },
      cab: { ini: ini(c.nome), nome: c.nome, st: statusC[0], stStyle: pill(statusC[1]), stDot: dotS(statusC[1]), meta: [c.segmento, "Cliente desde " + dExt(ini0), cidade].filter(Boolean).join("  ·  "),
        tags: fams.map(f => ({ l: f.F.l })), csm, csmIni: ini(csm), closer, princ: principal.nome, princIni: ini(principal.nome.replace(/^Dr\.?\s+/, "")), princCargo: principal.cargo },
      resp: { aberto: !!S.resp, abrir: (e) => { const r = e.currentTarget.getBoundingClientRect(); this.setState(s => ({ menu: null, resp: s.resp ? null : { left: r.left, bottom: r.bottom } })); },
        pos: S.resp ? "position:fixed;z-index:70;width:280px;max-height:min(460px,calc(100vh - " + Math.round(S.resp.bottom + 20) + "px));overflow-y:auto;padding:6px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px #e3e7e8,0 16px 36px -12px rgba(18,23,29,.35);left:" + Math.max(8, Math.min((typeof window !== "undefined" ? window.innerWidth : 1440) - 290, S.resp.left)) + "px;top:" + (S.resp.bottom + 6) + "px" : "display:none",
        equipe: equipe.map(n => ({ nome: n, ini: ini(n), radio: radio(n === csm), onClick: () => { if (n !== csm) { salvarX({ csm: n }, { t: "Customer Success agora é " + n, meta: "antes: " + csm, cat: "nota", ico: "resp" }); diz(n + " assumiu a conta", "ok"); } this.setState({ resp: null }); } })),
        pessoas: pes.map(p => ({ nome: p.nome, cargo: p.cargo, ini: ini(p.nome.replace(/^Dr\.?\s+/, "")), radio: radio(p === principal), onClick: () => { if (p !== principal) { salvarX({ principal: p.nome }, { t: p.nome + " virou o contato principal", meta: p.cargo, cat: "nota", ico: "resp" }); diz(p.nome + " agora é o contato principal", "ok"); } this.setState({ resp: null }); } })) },
      menu: { aberto: !!S.menu, abrir: (e) => { const r = e.currentTarget.getBoundingClientRect(); this.setState(s => ({ resp: null, menu: s.menu ? null : { right: r.right, bottom: r.bottom } })); },
        pos: S.menu ? "position:fixed;z-index:70;width:236px;padding:5px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px #e3e7e8,0 12px 28px -10px rgba(18,23,29,.3);left:" + Math.max(8, S.menu.right - 236) + "px;top:" + (S.menu.bottom + 6) + "px" : "display:none",
        itens: [{ l: "Abrir no Stripe", d: I.card, onClick: () => { this.setState({ menu: null }); ext(stripeUrl); } }, { l: "Abrir empresa", d: I.building, onClick: () => { this.setState({ menu: null }); abrirEmpresa(); } },
          { l: "Exportar faturas (CSV)", d: I.dl, onClick: () => { this.setState({ menu: null }); exportar(); } }, { l: "Copiar link do cliente", d: I.link, onClick: () => { this.setState({ menu: null }); copiar(window.location.href, "Link do cliente"); } }] },
      acoes: { registrar: () => E && E.abrir("novaAtividade", { empresa: c.nome, pessoa: principal.nome }), agendar: () => { const d = new Date(hoje.getTime() + 864e5); E && E.abrir("novaReuniao", { data: isoD(d), hora: "10:00", titulo: "Alinhamento · " + c.nome, empresa: c.nome, pessoa: principal.nome }); },
        oportunidade: () => abrirOpp(null), crossSell: () => abrirOpp("crosssell"), novaPessoa: () => this.setState({ modal: { k: "pes", nome: "", cargo: "", email: "", tel: "", papel: "Usuário", erro: "" } }) },
      abas: ABAS.map(([k, l, n, alerta]) => ({ l, n: n != null ? String(n) : "", temN: n != null, onClick: irAba(k),
        nStyle: "min-width:20px;height:18px;padding:0 6px;border-radius:9999px;display:grid;place-items:center;font-size:10.5px;font-weight:700;" + (alerta ? "background:#d93c1a;color:#fff" : S.aba === k ? "background:#fe4f2b;color:#fff" : "background:#eeeff3;color:#4a5560"),
        style: "flex:0 0 auto;display:flex;align-items:center;gap:7px;height:46px;padding:0 2px;border:0;background:transparent;cursor:pointer;font-size:13px;white-space:nowrap;" + (S.aba === k ? "color:#12171d;font-weight:600;box-shadow:inset 0 -2px 0 #fe4f2b" : "color:#67787c;font-weight:500") })),
      vis: { geral: S.aba === "geral", produtos: S.aba === "produtos", financeiro: S.aba === "financeiro", pessoas: S.aba === "pessoas", documentos: S.aba === "documentos", historico: S.aba === "historico" },
      ir: { produtos: irAba("produtos"), financeiro: irAba("financeiro"), pessoas: irAba("pessoas"), documentos: irAba("documentos"), historico: irAba("historico") },
      hero: { mrr: brl(mrr), dt: dM != null && isFinite(dM) ? Math.abs(dM) + "%" : "novo", dIco: dM != null && dM < 0 ? I.dn : I.up, dTxt: "vs. mês anterior",
        dStyle: "display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:700;white-space:nowrap;" + (dM != null && dM < 0 ? "background:rgba(254,79,43,.14);color:#ff8a70" : "background:rgba(62,207,142,.12);color:#3ecf8e"),
        fams: fams.map(f => ({ l: f.F.l, v: brl(f.mrr), dot: "flex:0 0 auto;width:8px;height:8px;border-radius:2px;background:" + f.F.cor })),
        tiles: [tile("Receita acumulada", brlK(acum), "desde " + MES[ini0.getMonth()].toLowerCase() + "/" + ini0.getFullYear(), "#fff", irAba("financeiro")),
          tile("Licenças em uso", licU + "/" + licT, usoPct + "% de uso", usoPct >= 75 ? "#fff" : "#ffc56b", irAba("produtos")),
          tile("Em aberto", brl(emAberto), vencidas.length ? brl(vencido) + " vencido" : proxF ? "vence " + dm(proxF.venc) : "nada pendente", vencidas.length ? "#ff8a70" : "#fff", irAba("financeiro")),
          tile("Próxima renovação", proxRen ? dmy(proxRen.renov) : "—", proxRen ? "em " + proxRen.dias + " dias" : "conta encerrada", proxRen && proxRen.dias <= 45 ? "#ff8a70" : "#fff", () => proxRen && abrirOpp("renovacao"))] },
      g, prodSub: fams.reduce((a, f) => a + f.itens.length, 0) + " itens · " + brl(mrr) + "/mês",
      fams: fams.map((f, i) => ({ l: f.F.l, d: f.F.d, st: f.st, stStyle: pill(f.st === "Ativo" ? "ok" : f.st === "Em implantação" ? "coral" : "neutro"),
        tile: "flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:" + f.F.tile[0] + ";color:" + f.F.tile[1],
        tileG: "flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:" + f.F.tile[0] + ";color:" + f.F.tile[1],
        sub: f.itens.length + (f.itens.length > 1 ? " itens" : " item") + " · desde " + dmy(f.start), mrr: brl(f.mrr), raw: brl2(f.raw), temDesc: f.desc > 0, desc: "− " + brl2(f.desc),
        contratoTxt: contratos[i].cod + " · " + contratos[i].modo + (ativo ? " · renova " + dmy(contratos[i].renov) : " · encerrado"),
        upsell: () => abrirOpp("expansao", f.k), upgrade: () => abrirOpp("upgrade", f.k),
        itens: f.itens.map(x => { const up = x.fixo ? 100 : Math.round(x.uso / x.qtd * 100);
          return { qn: x.qtd + " × " + x.nome, nome: x.nome, sku: x.cod, tipo: x.tipo, qtd: String(x.qtd), tipoTxt: x.tipo + " · " + brl2(x.preco) + (x.fixo ? "/mês" : " por " + x.un.replace(/s$/, "").replace(/ões$/, "ão")), preco: brl2(x.preco), sub: brl(x.qtd * x.preco), desde: dmy(x.inicio),
            usoTxt: x.fixo ? "Ativo" : x.uso + "/" + x.qtd, barra: "display:block;height:100%;border-radius:9999px;background:" + (x.fixo ? "#12171d" : up < 55 ? "#d93c1a" : "#fe4f2b") + ";transition:width .9s cubic-bezier(.16,1,.3,1);width:" + (S.pronto ? up : 0) + "%" }; }) })),
      crossTxt: naoTem.length ? c.nome + " ainda não tem " + naoTem.map(k => FAML[k]).join(" nem ") + ". Abra um cross-sell no Pipeline." : "A conta já tem todas as famílias. Dá para abrir cross-sell de módulos e agentes.",
      saude: { n: ativo ? String(c.saude) : "—", da: (S.pronto && ativo ? c.saude : 0) + " 100", l: sd[0], selo: pill(sd[1]), txt: sd[2], fatores: fat4.map(([d, t, s2, tom]) => ({ d, t, s: s2, dot: "flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:" + dotC[tom] })) },
      stripe: { abrir: () => ext(stripeUrl), sync: "Sincronizado com o Stripe há 2 min · " + cus, linha: cus + " · " + subId, portal: () => copiar("https://billing.stripe.com/p/session/" + cus.replace("cus_", "live_"), "Link do portal"),
        fatos: [{ l: "Método", v: forma }, { l: "Próxima cobrança", v: proxF ? dmy(proxF.venc) : "—" }, { l: "Assinatura", v: ativo ? "Ativa · " + fams.length + (fams.length > 1 ? " produtos" : " produto") : "Cancelada" }] },
      fin: { aberto: brl2(emAberto), abertoStyle: "display:block;margin-top:3px;font-family:'Plus Jakarta Sans',sans-serif;font-size:26px;font-weight:800;letter-spacing:-.035em;line-height:1.1;font-variant-numeric:tabular-nums;color:" + (vencidas.length ? "#c2330f" : "#12171d"),
        abertoSub: vencidas.length ? vencidas.length + (vencidas.length > 1 ? " faturas vencidas" : " fatura vencida") + " · " + brl2(vencido) : proxF ? "1 fatura · vence " + dmy(proxF.venc) : "Nenhuma fatura pendente",
        abertoSubStyle: "display:block;margin-top:3px;font-size:12px;font-weight:" + (vencidas.length ? "600;color:#c2330f" : "500;color:#67787c"),
        temCobrar: !!proxF, cobrar: () => proxF && cobrar(vencidas[0] || proxF), ultimas: fats.slice(0, 4).map(fatRow),
        kpis: [["Em aberto", brl2(emAberto), proxF ? "Próximo vencimento " + dmy(proxF.venc) : "Nada pendente", "#12171d"], ["Vencido", brl2(vencido), vencidas.length ? vencidas.length + (vencidas.length > 1 ? " faturas em atraso" : " fatura em atraso") : "Nenhum atraso", vencidas.length ? "#c2330f" : "#12171d"],
          ["Pago em 12 meses", brl2(pago12), fats.filter(f => f.st === "Pago").length + " faturas pagas", "#12171d"], ["Cobrança para", finP.nome, finP.email, "#12171d"]].map(([l, v, s2, cor]) => ({ l, v, s: s2, vStyle: kpiS(cor) })),
        sub: fats.length + " faturas nos últimos 12 meses · geradas pelo Stripe no dia 1, vencimento dia 10", vazia: !fatFil.length, linhas: fatFil.map(fatRow), exportar,
        filtros: [["todas", "Todas"], ["pagas", "Pagas"], ["aberto", "Em aberto"], ["vencidas", "Vencidas"]].map(([k, l]) => ({ l, onClick: () => this.setState({ fatF: k }), style: seg(S.fatF === k) })) },
      pessoasTop: pes.slice(0, 4).map(pesVal), pessoas: pes.map(pesVal), pesVerTodas: pes.length > 4 ? "Ver todas as " + pes.length + " pessoas" : "Ver pessoas da conta",
      pesSub: pes.length + (pes.length > 1 ? " pessoas" : " pessoa") + " · contato principal: " + principal.nome + " · cobrança para " + finP.nome,
      ctr: contratos.map(ct => ({ nome: ct.f.F.l + " · " + ct.modo, cod: ct.cod + " · " + brl(ct.f.budget) + "/mês", st: ct.f.st, stStyle: pill(ct.f.st === "Ativo" ? "ok" : ct.f.st === "Em implantação" ? "coral" : "neutro"),
        barra: "display:block;height:100%;border-radius:9999px;background:" + (ct.dias <= 45 && ativo ? "#fe4f2b" : "#12171d") + ";transition:width 1s cubic-bezier(.16,1,.3,1);width:" + (S.pronto ? ct.pct : 0) + "%",
        iniTxt: "Início " + dmy(ct.f.start), renTxt: ativo ? "Renova " + dmy(ct.renov) + " · " + ct.dias + "d" : "Encerrado", renStyle: ct.dias <= 45 && ativo ? "color:#c2330f;font-weight:600" : "",
        arq: ct.arq, assin: "Assinado", abrirDoc: () => this.setState({ modal: { k: "doc", id: "ct-" + ct.f.k } }) })),
      emp: { abrir: abrirEmpresa, fatos: [["CNPJ", cnpj], ["Segmento", c.segmento || "—"], ["Porte", porte], ["Cidade / UF", cidade], ["Site", dominio], ["Origem", origem], ["Closer", closer], ["Stripe", cus]].map(([l, v]) => ({ l, v })) },
      hist: { top: evRow(ev.slice(0, 6)), lista: evRow(evF), vazia: !evF.length,
        filtros: HF.map(([k, l]) => ({ l, n: String(k === "todos" ? ev.length : ev.filter(e => e.cat === k).length), onClick: () => this.setState({ histF: k }),
          style: "display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;" + (S.histF === k ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #e3e7e8") })) },
      prox, semProx: !prox.length,
      andamento: andR.map(r => ({ titulo: r.tipo + " · " + r.titulo, sub: r.sub, status: r.status, d: IK[r.k] || I.pipe, ir: r.ir })), semAnd: !andR.length, andSub: andR.length ? String(andR.length) : "",
      docs: { sub: docs.length + " documentos · contratos, propostas, comprovantes e arquivos enviados", enviar: enviarDocs, vazia: !docsF.length,
        filtros: DCAT.map(k => ({ l: k === "todos" ? "Todos" : k, onClick: () => this.setState({ docF: k }), style: seg(S.docF === k) })),
        lista: docsF.map(d => ({ nome: d.nome, meta: d.meta, cat: d.cat, ext: d.ext, abrir: () => abrirDoc(d), acao: d.ir ? "Abrir" : d.url ? "Baixar" : d.up ? "Registro" : "Ver",
          icoSt: "flex:0 0 auto;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:9px;font-weight:800;letter-spacing:.02em;" + (d.ext === "PDF" ? "background:#fff6f4;color:#c2330f" : d.ext === "ZIP" ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#1f252c"),
          removivel: !!d.up, remTxt: S.rem === d.id ? "Remover?" : "✕", remStyle: "flex:0 0 auto;height:28px;min-width:28px;padding:0 8px;border-radius:7px;border:0;cursor:pointer;font-size:11.5px;font-weight:600;" + (S.rem === d.id ? "background:#d93c1a;color:#fff" : "background:transparent;color:#8b949e"),
          remover: () => { if (S.rem !== d.id) return this.setState({ rem: d.id }); salvarX({ docs: (X.docs || []).filter(x => x.id !== d.id) }, { t: "Arquivo removido · " + d.nome, cat: "nota", ico: "clip" }); this.setState({ rem: null }); diz(d.nome + " removido", "ok"); } })) },
      nota: { v: S.nota, set: (e) => this.setState({ nota: e.target.value }),
        btn: "height:32px;padding:0 13px;border-radius:8px;border:0;font-size:12.5px;font-weight:700;cursor:pointer;color:#fff;background:" + (S.nota.trim() ? "#d93c1a" : "#f5a38f"),
        salvar: () => { const t = S.nota.trim(); if (!t) return; salvarX({}, { t: "Nota: " + (t.length > 90 ? t.slice(0, 90) + "…" : t), meta: t.length > 90 ? t : "", cat: "nota", ico: "nota" }); this.setState({ nota: "", histF: "todos" }); diz("Nota salva no histórico", "ok"); } },
      nv, mB, mD, mP, fechar: () => this.setState({ modal: null }), parar: (e) => e.stopPropagation()
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <ClienteDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as ClienteLiga };
