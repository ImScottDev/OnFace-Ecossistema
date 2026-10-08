// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Clientes — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * ClientesDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `ClientesDesenho.tsx`, convertido por máquina e intocável.
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
import { abrirUrlExterna } from "@/lib/callface-ligar";
import { toast } from "sonner";

import { ClientesDesenho } from "./ClientesDesenho";
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

  pagRef = React.createRef();
  state = { insAb: null, larg: typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1400, per: 12, hvE: null, hvD: null, hvG: null, filtro: "todos", busca: "", sel: {}, todos: false, menuId: null, menuRect: null, nc: null, v: 0 };

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
    const E = this.E; if (E) this._off = E.assinar(() => this.setState(s => ({ v: s.v + 1 })));
    this._med = () => { cancelAnimationFrame(this._medF); this._medF = requestAnimationFrame(() => { const el = this.pagRef.current; const w = Math.round((el ? el.getBoundingClientRect().width : (typeof window !== "undefined" ? window.innerWidth : 1440)) - 38);
      const faixa = (x) => x >= 1100 ? 4 : x >= 1080 ? 3 : x >= 1040 ? 2 : x >= 760 ? 1 : 0;
      if (faixa(w) !== faixa(this.state.larg || 0) || Math.abs(w - (this.state.larg || 0)) > 40) this.setState({ larg: w }); }); };
    this._rs = () => this._med(); window.addEventListener("resize", this._rs);
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this._med()); const tentar = () => { if (this.pagRef.current) { this._ro.observe(this.pagRef.current); this._med(); } else requestAnimationFrame(tentar); }; tentar(); }
    this._fora = (e) => { if (this.state.menuId != null && !(e.target.closest && e.target.closest("[data-cl-menu]"))) this.setState({ menuId: null }); };
    document.addEventListener("mousedown", this._fora);
    this._esc = (e) => { if (e.key === "Escape" && this.state.nexoChat) this.setState({ nexoChat: null }); else if (e.key === "Escape" && this.state.drawer) this.setState({ drawer: null }); }; document.addEventListener("keydown", this._esc);
  }
  componentWillUnmount() { if (this._off) this._off(); window.removeEventListener("resize", this._rs); document.removeEventListener("mousedown", this._fora); document.removeEventListener("keydown", this._esc); if (this._ro) this._ro.disconnect(); cancelAnimationFrame(this._medF); clearTimeout(this._nxT); }

  nexo(q) { this.setState({ nexoChat: { msgs: [], rasc: "", pensando: false, ativo: null } }); if (q) this.enviarNexo(q); }
  enviarNexo(q) { const t = String(q || "").trim(); if (!t) return;
    this.setState(s => ({ nexoChat: Object.assign({}, s.nexoChat || { msgs: [] }, { msgs: ((s.nexoChat || {}).msgs || []).concat([{ de: "eu", t }]), rasc: "", pensando: true }) }));
    clearTimeout(this._nxT); this._nxT = setTimeout(() => { const r = this.respNexo(t); this.setState(s => s.nexoChat ? { nexoChat: Object.assign({}, s.nexoChat, { pensando: false, msgs: s.nexoChat.msgs.concat([Object.assign({ de: "nexo" }, r)]) }) } : null); this.rolarNexo(); }, 700);
    this.rolarNexo(); }
  rolarNexo() { requestAnimationFrame(() => { if (this._nxEl) this._nxEl.scrollTop = this._nxEl.scrollHeight; }); }
  respNexo(q) { const t = q.toLowerCase(), X = this._ctx || {}; if (!X.ativos) return { t: "Ainda estou carregando a carteira. Tenta de novo em um segundo." };
    const lista = (arr) => arr.slice(0, 4).map(c => "• " + c.nome + " · " + X.brl(c.mrr) + "/mês").join("\n");
    if (/risco|churn|cancel/.test(t)) return X.risco.length ? { t: X.risco.length + (X.risco.length > 1 ? " clientes" : " cliente") + " com risco de churn, somando " + X.brlK(X.risco.reduce((a, c) => a + c.mrr, 0)) + " de MRR:\n" + lista(X.risco) + "\n\nSugiro uma ligação de retenção com cada um ainda esta semana.", acoes: [["ret", "Criar atividades de retenção"], ["emp:" + X.risco[0].nome, "Abrir " + X.risco[0].nome]] } : { t: "Nenhum cliente com risco de churn agora. A saúde da carteira está boa." };
    if (/expan|upsell|upgrade|cross/.test(t)) return X.expansao.length ? { t: X.expansao.length + (X.expansao.length > 1 ? " clientes têm" : " cliente tem") + " saúde alta e espaço para crescer:\n" + lista(X.expansao) + "\n\nSão bons candidatos para uma oportunidade de expansão.", acoes: [["exp", "Criar atividades de upsell"], ["emp:" + X.expansao[0].nome, "Abrir " + X.expansao[0].nome]] } : { t: "Não achei clientes com saúde alta o bastante para expansão agora." };
    if (/renova/.test(t)) return X.renov.length ? { t: X.renov.length + (X.renov.length > 1 ? " contratos completam" : " contrato completa") + " 12 meses nas próximas semanas:\n" + lista(X.renov), acoes: [["emp:" + X.renov[0].nome, "Abrir " + X.renov[0].nome]] } : { t: "Nenhuma renovação nas próximas semanas." };
    if (/parad|sem contato|inativ|atividade/.test(t)) return X.parados.length ? { t: X.parados.length + (X.parados.length > 1 ? " clientes estão" : " cliente está") + " sem contato há 30 dias ou mais:\n" + lista(X.parados) + "\n\nVale um check-in rápido.", acoes: [["emp:" + X.parados[0].nome, "Abrir " + X.parados[0].nome]] } : { t: "Todos os clientes ativos tiveram contato nos últimos 30 dias." };
    if (/produto|mix|receita por/.test(t)) { const tot = Math.max(1, X.mrrP.reduce((a, b) => a + b, 0)); return { t: "Receita por produto hoje:\n" + X.PK.map((k, i) => "• " + X.P(k)[0] + ": " + X.brlK(X.mrrP[i]) + " (" + Math.round(X.mrrP[i] / tot * 100) + "%)").join("\n") }; }
    const cm = X.cntM || [], d = cm.length > 1 ? cm[cm.length - 1] - cm[0] : 0;
    return { t: "Resumo da carteira: " + X.ativos.length + " clientes ativos, " + X.brlK(X.mrr) + " de MRR e ticket médio de " + X.brl(X.ticket) + ". " + (d > 0 ? "A base cresceu " + d + " clientes no período. " : "") + (X.risco.length ? X.risco.length + " em risco de churn e " : "") + X.expansao.length + " com potencial de expansão.", acoes: [["p:Quais clientes estão em risco?", "Ver riscos"], ["p:Onde tenho oportunidade de expansão?", "Ver expansão"]] };
  }
  chatVals() { const S = this.state, NC = S.nexoChat, E = this.E; if (!NC) return { aberto: false, msgs: [], cards: [], recentes: [] };
    const upN = (p) => this.setState(s => ({ nexoChat: Object.assign({}, s.nexoChat, p) }));
    const X = this._ctx || {};
    const criar = (arr, tipo, rot) => { if (!E || !arr || !arr.length) return; const base = E.ler("atividadesV2", null) || E.ler("atividades", null) || this.dadosDoProto.AtividadesSeed || [];
      const novas = arr.map(c => ({ id: "a" + Date.now().toString(36) + c.id, titulo: rot + " · " + c.nome, tipo, area: "CS", situacao: "A fazer", prioridade: tipo === "Ligação" ? "Alta" : "Média", resp: c.resp, assignees: [c.resp], empresa: c.nome, desc: "Criada pelo NEXO no chat de Clientes.", fim: "+2 10:00", sub: [], criadoPor: "NEXO" }));
      E.gravar({ [E.ler("atividadesV2", null) ? "atividadesV2" : "atividades"]: base.concat(novas) });
      this.setState(s => s.nexoChat ? { nexoChat: Object.assign({}, s.nexoChat, { msgs: s.nexoChat.msgs.concat([{ de: "nexo", t: "Pronto. Criei " + novas.length + (novas.length > 1 ? " atividades" : " atividade") + " para os responsáveis. Elas já aparecem em Atividades." }]) }) } : null); this.rolarNexo(); };
    const fazer = (k) => { if (k === "ret") criar(X.risco, "Ligação", "Retenção"); else if (k === "exp") criar(X.expansao, "Reunião", "Upsell");
      else if (k.indexOf("emp:") === 0) { const c = (X.ativos || []).find(x => x.nome === k.slice(4)); this.setState({ nexoChat: null }); if (c && X.irEmp) X.irEmp(c); }
      else if (k.indexOf("p:") === 0) this.enviarNexo(k.slice(2)); };
    const REC = [["Resumo da carteira", "Hoje, 10:12"], ["Clientes em risco de churn", "Hoje, 09:40"], ["Oportunidades de expansão", "Ontem, 17:05"], ["Renovações do mês", "Ontem, 11:30"]];
    const qb = (NC.busca || "").toLowerCase();
    const CARDS = [["Resumir a carteira", "Clientes, MRR, ticket e crescimento.", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5", "#fff6f4", "#c2330f", "Me dá um resumo da carteira"],
      ["Quem está em risco?", "Saúde baixa e pouco contato.", "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "#fdeeea", "#c2330f", "Quais clientes estão em risco?"],
      ["Onde expandir", "Clientes prontos para upsell.", "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6", "#e6f4ee", "#1f7256", "Onde tenho oportunidade de expansão?"],
      ["Clientes parados", "Sem contato há 30+ dias.", "M12 8v4l2.5 2.5M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "#e8f0fb", "#2c5f9e", "Quais clientes estão sem contato?"]];
    const msgs = NC.msgs || [];
    return { aberto: true, fechar: () => this.setState({ nexoChat: null }), novo: () => upN({ msgs: [], rasc: "", pensando: false, ativo: null }), busca: NC.busca || "", setBusca: (e) => upN({ busca: e.target.value }),
      intro: "Seu copiloto de relacionamento na ONFACE. " + (X.risco && X.risco.length ? "Vi " + X.risco.length + (X.risco.length > 1 ? " clientes" : " cliente") + " com risco de churn. Quer começar por aí?" : "Pergunte qualquer coisa sobre a sua carteira."),
      recentes: REC.filter(r => !qb || r[0].toLowerCase().indexOf(qb) >= 0).map(([t, q]) => ({ t, q, onClick: () => { upN({ msgs: [], ativo: t }); this.enviarNexo(t); },
        style: "display:block;width:100%;padding:9px 12px;border-radius:10px;border:0;cursor:pointer;text-align:left;" + (NC.ativo === t ? "background:#fff;box-shadow:inset 2px 0 0 #fe4f2b,0 0 0 1px #eef1f1" : "background:transparent") })),
      cards: CARDS.map(([t, s2, d, bg, c, perg]) => ({ t, s: s2, d, ico: "width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:" + bg + ";color:" + c, onClick: () => { upN({ ativo: null }); this.enviarNexo(perg); } })),
      vazio: !msgs.length && !NC.pensando, temMsgs: !!msgs.length || !!NC.pensando, pensando: !!NC.pensando, ref: (el) => { this._nxEl = el; },
      msgs: msgs.map(m => { const eu = m.de === "eu"; return { t: m.t, ehNexo: !eu, temAcoes: !eu && !!(m.acoes && m.acoes.length), acoes: (m.acoes || []).map(([k, l]) => ({ l, onClick: () => fazer(k) })),
        linha: "display:flex;align-items:flex-end;gap:10px;" + (eu ? "justify-content:flex-end" : "justify-content:flex-start"),
        bolha: "display:block;padding:11px 14px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;text-wrap:pretty;" + (eu ? "border-radius:14px 14px 4px 14px;background:#12171d;color:#fff" : "border-radius:14px 14px 14px 4px;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #eef1f1") }; }),
      rasc: NC.rasc || "", setRasc: (e) => upN({ rasc: e.target.value }), tecla: (e) => { if (e.key === "Enter") { e.preventDefault(); this.enviarNexo(NC.rasc); } },
      enviar: () => this.enviarNexo(NC.rasc),
      enviarStyle: "width:40px;height:40px;border-radius:9999px;border:0;color:#fff;display:grid;place-items:center;cursor:pointer;background:" + ((NC.rasc || "").trim() ? "#fe4f2b" : "#f5a38f") };
  }

  renderVals() {
    const S = this.state, E = this.E, D = this.dadosDoProto || {};
    const ini = D.iniciais || ((n) => (n || "").split(" ").map(x => [...x][0]).slice(0, 2).join("").toUpperCase());
    const C = (this.dadosDoProto.ClientesSeed || []).concat((E && E.ler("clientesExtra", [])) || []);
    const PROD = { CALLFACE_AI: ["Callface AI", "#fe4f2b", "#fff6f4", "#c2330f", "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"],
      WHITE_LABEL: ["White Label", "#4f3fa8", "#efecfa", "#4f3fa8", "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"],
      PABX: ["PABX", "#2c5f9e", "#e8f0fb", "#2c5f9e", "M13.8 16.6a1 1 0 0 0 1.2-.3l.4-.5A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.4z"] };
    const PK = ["CALLFACE_AI", "WHITE_LABEL", "PABX"];
    const P = (k) => PROD[k] || PROD.CALLFACE_AI;
    const brl = (n) => "R$ " + Math.round(n).toLocaleString("pt-BR");
    const brlK = (n) => n >= 1000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : brl(n);
    const eixoK = (n) => n >= 1000 ? "R$ " + Math.round(n / 1000) + "k" : "R$ " + Math.round(n);
    const hoje = new Date(), ym = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const N = S.per, meses = Array.from({ length: N }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - (N - 1 - i), 1));
    const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const ativoEm = (c, m) => c.inicio <= ym(m) && (!c.fim || c.fim > ym(m));
    const ativos = C.filter(c => !c.fim), mrr = ativos.reduce((a, c) => a + c.mrr, 0);
    const antes = new Date(hoje.getFullYear(), hoje.getMonth() - N, 1);
    const ativosAntes = C.filter(c => ativoEm(c, antes)), mrrAntes = ativosAntes.reduce((a, c) => a + c.mrr, 0);
    const novos = ativos.filter(c => c.inicio >= ym(meses[0]));
    const diasSem = (c) => { const m = /Há (\d+) dias/.exec(c.ultima || ""); return m ? +m[1] : 0; };
    const parados = ativos.filter(c => diasSem(c) >= 30);
    const saudeDe = (c) => c.status === "Inativo" ? ["Inativo", "#eeeff3", "#67787c"] : c.saude >= 70 ? ["Saudável", "#e6f4ee", "#1f7256"] : c.saude >= 45 ? ["Em atenção", "#f7edd8", "#6e5420"] : ["Em risco", "#fdeeea", "#c2330f"];
    const pct = (a, b) => b ? Math.round((a / b - 1) * 100) : null;
    const UP = "M7 17 17 7M9 7h8v8", DN = "M7 7l10 10M17 9v8H9";
    const pill = (ok) => "display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 7px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;" + (ok ? "background:#e6f4ee;color:#1f7256" : "background:#fdeeea;color:#c2330f");
    const perTxt = "vs. " + N + " meses antes";
    const ganho = (a, b, fmt) => (a - b >= 0 ? "+" : "−") + fmt(Math.abs(a - b)) + " no período";
    const dT = pct(ativos.length, ativosAntes.length), dM = pct(mrr, mrrAntes);
    const ticket = mrr / Math.max(1, ativos.length), ticketAntes = mrrAntes / Math.max(1, ativosAntes.length), dTk = pct(ticket, ticketAntes);
    const kpi = [
      ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", "Total de clientes", String(ativos.length), dT, true, perTxt],
      ["M12 1v22M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6", "Receita mensal (MRR)", brl(mrr), dM, true, perTxt],
      ["M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6", "Novos clientes", String(novos.length), null, true, novos.length ? "entraram no período e seguem ativos" : "nenhum no período"],
      ["M12 8v4l2.5 2.5M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "Clientes sem atividade", String(parados.length), null, true, "sem contato há 30+ dias"],
      ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4", "Ticket médio mensal", brl(ticket), dTk, true, perTxt]
    ].map(([ico, l, v, d, sobeBom, sub], i) => { const temD = d != null && isFinite(d), ok = temD ? (d >= 0) === sobeBom : true;
      const semBase = !temD && sub === perTxt;
      const sub2 = !semBase ? sub : i === 0 ? ganho(ativos.length, ativosAntes.length, String) : i === 1 ? ganho(mrr, mrrAntes, brlK) : "base ainda sem histórico";
      return { ico, l, v, sub: sub2, temD, dt: temD ? Math.abs(d) + "%" : "", dIco: temD && d < 0 ? DN : UP, dStyle: pill(ok) }; });
    const L = S.larg, wide = L >= 1280, mid = L >= 900;
    const kpiGrid = "display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))";

    // Evolução da receita (áreas empilhadas por produto)
    const totM = meses.map(m => C.filter(c => ativoEm(c, m)).reduce((a, c) => a + c.mrr, 0));
    const cntM = meses.map(m => C.filter(c => ativoEm(c, m)).length);
    const passo = (mx) => { const alvo = mx / 4, pot = Math.pow(10, Math.floor(Math.log10(Math.max(1, alvo)))), n2 = alvo / pot; return (n2 <= 1 ? 1 : n2 <= 2 ? 2 : n2 <= 2.5 ? 2.5 : n2 <= 5 ? 5 : 10) * pot; };
    const stC = passo(Math.max(1, ...cntM)), topC = stC * 4;
    const EN = S.evoN || 12, mE = Array.from({ length: EN }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - (EN - 1 - i), 1));
    const oculto = S.evoOff || {};
    const DKC = { CALLFACE_AI: "#fe4f2b", WHITE_LABEL: "#9a8cf2", PABX: "#5b9be6" };
    const ORD = ["PABX", "WHITE_LABEL", "CALLFACE_AI"].filter(k => !oculto[k]);
    const serie = (k) => mE.map(m => C.filter(c => c.produto === k && ativoEm(c, m)).reduce((a, c) => a + c.mrr, 0));
    const vals = ORD.map(serie);
    const cum = ORD.map((_, j) => mE.map((__, i) => vals.slice(0, j + 1).reduce((a, v) => a + v[i], 0)));
    const totE = mE.map((_, i) => cum.length ? cum[cum.length - 1][i] : 0);
    const stM = passo(Math.max(1, ...totE)), topM = stM * 4;
    const XE = (i) => EN === 1 ? 500 : i / (EN - 1) * 1000, YE = (v) => 220 - v / topM * 212;
    const curva = (ys, rev) => { const idx = ys.map((_, i) => i); if (rev) idx.reverse();
      return idx.map((i, n) => { const x = XE(i), y = YE(ys[i]); if (!n) return (rev ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); const p = idx[n - 1], xp = XE(p), yp = YE(ys[p]), xm = ((xp + x) / 2).toFixed(1); return "C" + xm + " " + yp.toFixed(1) + " " + xm + " " + y.toFixed(1) + " " + x.toFixed(1) + " " + y.toFixed(1); }).join(" "); };
    const hE = S.hvE != null && S.hvE < EN ? S.hvE : null;
    const dE = pct(totE[EN - 1], totE[0]);
    const cam = ORD.map((k, j) => { const topo = cum[j], base = j ? cum[j - 1] : mE.map(() => 0);
      return { gid: "evoG" + k, cor: DKC[k], fill: "url(#evoG" + k + ")", linha: curva(topo), area: curva(topo) + " " + curva(base, true) + " Z",
        aStyle: "transition:opacity .2s;opacity:" + (hE == null ? 1 : .85), lStyle: "" }; }).reverse();
    const dicaX = hE != null ? (EN === 1 ? 50 : hE / (EN - 1) * 100) : 0;
    const passoRot = EN > 8 && L < 1100 ? 2 : 1;
    const evo = { desc: "MRR por produto · últimos " + EN + " meses", total: brlK(totE[EN - 1]), temD: dE != null && isFinite(dE), dt: dE != null ? Math.abs(dE) + "%" : "", dIco: dE != null && dE < 0 ? DN : UP, dStyle: pill(dE == null || dE >= 0),
      pers: [[3, "3 meses"], [6, "6 meses"], [12, "12 meses"]].map(([n2, l]) => ({ l, onClick: () => this.setState({ evoN: n2, hvE: null }), style: "height:26px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (EN === n2 ? "background:rgba(255,255,255,.12);color:#fff;font-weight:600" : "background:transparent;color:#a3aab0;font-weight:500") })),
      eixo: [4, 3, 2, 1, 0].map(k2 => ({ l: eixoK(stM * k2) })), camadas: cam, sair: () => this.setState({ hvE: null }),
      cols: mE.map((m, i) => ({ entrar: () => { if (S.hvE !== i) this.setState({ hvE: i }); } })),
      rot: mE.map((m, i) => ({ l: MES[m.getMonth()], st: "position:absolute;top:0;transform:translateX(-50%);font-size:10.5px;color:#67787c;white-space:nowrap;left:" + (EN === 1 ? 50 : i / (EN - 1) * 100) + "%" + ((EN - 1 - i) % passoRot ? ";visibility:hidden" : "") + (i === 0 ? ";transform:none" : i === EN - 1 ? ";transform:translateX(-100%)" : "") })),
      temDica: hE != null,
      guia: hE != null ? "position:absolute;top:0;bottom:0;width:0;border-left:1px dashed rgba(254,79,43,.45);pointer-events:none;left:" + dicaX + "%" : "display:none",
      pts: hE != null ? ORD.map((k, j) => ({ st: "position:absolute;pointer-events:none;width:9px;height:9px;border-radius:9999px;background:" + DKC[k] + ";box-shadow:0 0 0 2px #12171d;transform:translate(-50%,-50%);left:" + dicaX + "%;top:" + (YE(cum[j][hE]) * 170 / 220) + "px" })) : [],
      dicaT: hE != null ? MES[mE[hE].getMonth()] + "/" + mE[hE].getFullYear() : "",
      dicaL: hE != null ? ORD.slice().reverse().map(k => ({ l: P(k)[0], v: brl(serie(k)[hE]), dot: "width:8px;height:8px;border-radius:2px;background:" + DKC[k] })) : [],
      dicaTot: hE != null ? brl(totE[hE]) : "",
      dicaPos: hE != null ? "position:absolute;z-index:3;pointer-events:none;top:6px;left:clamp(0px,calc(" + dicaX + "% - 90px),calc(100% - 180px));width:180px;padding:9px 11px;border-radius:10px;background:#1f252c;box-shadow:0 0 0 1px #2a3139,0 14px 30px -12px rgba(0,0,0,.6)" : "display:none",
      legenda: ["CALLFACE_AI", "WHITE_LABEL", "PABX"].map(k => { const off = !!oculto[k]; return { l: P(k)[0], onClick: () => this.setState(s => ({ evoOff: Object.assign({}, s.evoOff || {}, { [k]: !off }) })),
        st: "display:inline-flex;align-items:center;gap:7px;height:26px;padding:0 6px;border-radius:7px;border:0;background:transparent;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;color:" + (off ? "#4a5560;text-decoration:line-through" : "#a3aab0"),
        dot: "width:9px;height:9px;border-radius:2px;background:" + (off ? "#2a3139" : DKC[k]) }; }) };

    // Receita por produto
    const mrrP = PK.map(k => ativos.filter(c => c.produto === k).reduce((a, c) => a + c.mrr, 0)), totP = Math.max(1, mrrP.reduce((a, b) => a + b, 0));
    let acc = 0;
    const dist = { sair: () => this.setState({ hvD: null }),
      centro: S.hvD != null ? brlK(mrrP[S.hvD]) : brlK(mrr), centroL: S.hvD != null ? P(PK[S.hvD])[0] : "total",
      arcos: PK.map((k, i) => { const pc = mrrP[i] / totP * 100, len = Math.max(0, pc - 1.2); const o = { cor: P(k)[1], sw: S.hvD === i ? "7.4" : "6.4", da: len.toFixed(2) + " " + (100 - len).toFixed(2), off: String(-acc), entrar: () => this.setState({ hvD: i }) }; acc += pc; return o; }),
      lista: PK.map((k, i) => ({ l: P(k)[0], v: brl(mrrP[i]), pct: Math.round(mrrP[i] / totP * 100) + "%", entrar: () => this.setState({ hvD: i }),
        dot: "flex:0 0 auto;width:9px;height:9px;border-radius:9999px;background:" + P(k)[1],
        row: "display:flex;align-items:center;gap:10px;opacity:" + (S.hvD != null && S.hvD !== i ? ".45" : "1") + ";transition:opacity .15s" })) };

    // Crescimento da base (barras horizontais · últimos 6 meses)
    const M6 = Array.from({ length: 6 }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1));
    const MESL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const c6 = M6.map(m => C.filter(c => ativoEm(c, m)).length), n6 = M6.map(m => C.filter(c => c.inicio === ym(m)).length);
    const max6 = Math.max(1, ...c6), hG = S.hvG, d6 = pct(c6[5], c6[0]), dMes = c6[5] - c6[4];
    const cresc = { periodo: MESL[M6[0].getMonth()] + " – " + MESL[M6[5].getMonth()] + " " + M6[5].getFullYear(), sair: () => this.setState({ hvG: null }),
      linhas: M6.map((m, i) => ({ mes: MES[m.getMonth()], n: String(c6[i]), temNovos: n6[i] > 0, novos: "+" + n6[i], dica: MESL[m.getMonth()] + ": " + c6[i] + " ativos, " + n6[i] + (n6[i] === 1 ? " novo" : " novos"),
        entrar: () => { if (S.hvG !== i) this.setState({ hvG: i }); },
        barra: "display:flex;align-items:center;height:100%;min-width:44px;border-radius:6px;width:" + (c6[i] / max6 * 100) + "%;background:" + (i === 5 ? "#fe4f2b" : hG === i ? "#fb8e72" : "#fdc2b3") + ";transition:width .7s cubic-bezier(.16,1,.3,1),background-color .15s",
        lbl: "padding-left:9px;font-size:12px;font-weight:600;white-space:nowrap;color:" + (i === 5 ? "#fff" : "#9c3210") })),
      rodape: dMes > 0 ? "+" + dMes + (dMes === 1 ? " cliente ativo" : " clientes ativos") + " neste mês" : dMes < 0 ? dMes + " clientes ativos neste mês" : "Base estável neste mês",
      ico: dMes < 0 ? "M22 17 13.5 8.5l-5 5L2 7M16 17h6v-6" : "M22 7 13.5 15.5l-5-5L2 17M16 7h6v6", cor: dMes < 0 ? "#c2330f" : "#1f7256",
      rodape2: (d6 != null && isFinite(d6) ? (d6 >= 0 ? "Alta de " : "Queda de ") + Math.abs(d6) + "% nos últimos 6 meses · " : "") + c6[5] + " ativos hoje" };

    // Produtos mais utilizados
    const cntP = PK.map(k => ativos.filter(c => c.produto === k).length), totC = Math.max(1, ativos.length);
    const topProd = PK.map((k, i) => ({ l: P(k)[0], d: P(k)[4], pct: Math.round(cntP[i] / totC * 100) + "%", n: cntP[i] + (cntP[i] === 1 ? " cliente" : " clientes"),
      ico: "flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:" + P(k)[2] + ";color:" + P(k)[3],
      barra: "display:block;height:100%;border-radius:9999px;width:" + (cntP[i] / totC * 100) + "%;background:" + P(k)[1] + ";transition:width .7s cubic-bezier(.16,1,.3,1)" }));

    // Segmentos
    const SEGI = { "Saúde": "M22 12h-4l-3 9L9 3l-3 9H2", "Energia": "M13 2 3 14h9l-1 8 10-12h-9z", "Varejo": "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
      "Logística e Transporte": "M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "Telecomunicações": "M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01",
      "Educação": "M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5", "Indústria": "M2 20h20M4 20V9l6 4V9l6 4V5h4v15", "Engenharia": "M2 20h20M5 20V10l7-6 7 6v10M9 20v-6h6v6", "Serviços": "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" };
    const SEGC = [["#fff6f4", "#c2330f", "#fe4f2b"], ["#e8f0fb", "#2c5f9e", "#2c5f9e"], ["#e6f4ee", "#1f7256", "#1f7256"], ["#f7edd8", "#6e5420", "#c8a86a"], ["#efecfa", "#4f3fa8", "#4f3fa8"]];
    const mapS = {}; ativos.forEach(c => { const s2 = c.segmento || "Outros"; (mapS[s2] = mapS[s2] || []).push(c); });
    const segOrd = Object.keys(mapS).sort((a, b) => mapS[b].length - mapS[a].length || a.localeCompare(b));
    const segTop = segOrd.slice(0, 4), resto = segOrd.slice(4).reduce((a, s2) => a.concat(mapS[s2]), []);
    const segRows = segTop.map(s2 => [s2, mapS[s2]]).concat(resto.length ? [["Outros", resto]] : []);
    const segs = segRows.map(([l, arr], i) => { const cc = SEGC[i % SEGC.length]; return { l, d: SEGI[l] || "M4 6h16M4 12h16M4 18h10", pct: Math.round(arr.length / totC * 100) + "%", n: arr.length + (arr.length === 1 ? " cliente" : " clientes"),
      ico: "flex:0 0 auto;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:" + cc[0] + ";color:" + cc[1] }; });

    // Ticket médio por segmento
    const tks = PK.map(k => { const arr = ativos.filter(c => c.produto === k); return [k, arr.length ? arr.reduce((a, c) => a + c.mrr, 0) / arr.length : 0]; }).sort((a, b) => b[1] - a[1]);
    const stT = passo(Math.max(1, ...tks.map(x => x[1]))), topT = stT * 4;
    const tick = { eixo: [4, 3, 2, 1, 0].map(k2 => ({ l: eixoK(stT * k2) })),
      cols: tks.map(([k, v]) => ({ l: P(k)[0], v: brl(v),
        b: "display:block;width:60%;max-width:44px;border-radius:5px 5px 0 0;height:" + (v / topT * 136) + "px;background:" + P(k)[1] + ";transition:height .6s cubic-bezier(.16,1,.3,1)" })) };

    // Insights
    const irEmp = (c) => E && E.irPara("/clientes/360", c.nome, { cliente: c.id });
    const expansao = ativos.filter(c => c.saude >= 80), risco = ativos.filter(c => c.saude < 45 && c.status !== "Inativo");
    const renov = ativos.filter(c => { const [a, m] = c.inicio.split("-").map(Number); const ani = new Date(a + 1, m - 1, 1), d2 = (ani - hoje) / 864e5; return d2 >= -15 && d2 <= 45; });
    const impl = ativos.filter(c => c.status === "Em implantação");
    const selo = (bg, c) => "flex:0 0 auto;height:20px;padding:0 8px;border-radius:9999px;display:inline-flex;align-items:center;font-size:11px;font-weight:600;white-space:nowrap;background:" + bg + ";color:" + c;
    const icoI = (bg, c) => "flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:" + bg + ";color:" + c;
    const nomes = (arr) => arr.slice(0, 2).map(c => c.nome).join(", ") + (arr.length > 2 ? " e mais " + (arr.length - 2) : "");
    const somaM = (arr) => arr.reduce((a2, c) => a2 + c.mrr, 0);
    const CORES_AV = [["#fff6f4", "#c2330f"], ["#e8f0fb", "#2c5f9e"], ["#efecfa", "#4f3fa8"], ["#e6f4ee", "#1f7256"]];
    const DEF = [
      ["exp", expansao, "Oportunidade de expansão", (n) => (n > 1 ? n + " clientes com saúde alta" : "1 cliente com saúde alta") + " e espaço para upgrade de plano ou licenças.", "#e6f4ee", "#1f7256", "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6", "de MRR na base", "Criar atividade de upsell"],
      ["risco", risco, "Risco de churn", (n) => (n > 1 ? n + " clientes estão" : "1 cliente está") + " com saúde baixa e pouco contato recente.", "#fdeeea", "#c2330f", "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "de MRR em risco", "Criar atividade de retenção"],
      ["renov", renov, "Renovação próxima", (n) => (n > 1 ? n + " contratos completam" : "1 contrato completa") + " 12 meses nas próximas semanas.", "#e8f0fb", "#2c5f9e", "M12 8v4l2.5 2.5M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "de MRR para renovar", "Criar atividade de renovação"],
      ["impl", impl, "Em implantação", (n) => (n > 1 ? n + " clientes ainda estão" : "1 cliente ainda está") + " no onboarding. Acompanhe até a virada.", "#efecfa", "#4f3fa8", "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", "de MRR em implantação", "Criar atividade de acompanhamento"]
    ].filter(x => x[1].length);
    const insights = DEF.map(([k, arr, t, sFn, bg, cor, d, vL, agirTxt]) => { const ab = S.insAb === k;
      return { t, s: sFn(arr.length), n: String(arr.length), d, valor: brlK(somaM(arr)) + " " + vL, aberto: ab, agirTxt: arr.length > 1 ? agirTxt + " (" + arr.length + ")" : agirTxt,
        box: "border-radius:12px;transition:background-color .15s;" + (ab ? "background:#fafaf8;box-shadow:inset 0 0 0 1px #eef1f1" : ""),
        ico: "flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:" + bg + ";color:" + cor,
        icoP: "flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:" + (k === "risco" ? "#fdeeea" : "#fff6f4") + ";color:#c2330f",
        selo: "flex:0 0 auto;min-width:22px;height:20px;padding:0 7px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:700;background:" + bg + ";color:" + cor,
        chev: "flex:0 0 auto;margin-top:3px;transition:transform .15s;transform:rotate(" + (ab ? 180 : 0) + "deg)",
        alternar: () => this.setState(s => ({ insAb: s.insAb === k ? null : k })),
        avs: arr.slice(0, 3).map((c, j) => ({ nome: c.nome, ini: ini(c.nome), st: "width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:8.5px;font-weight:700;box-shadow:0 0 0 2px #fff;margin-left:" + (j ? "-6px" : "0") + ";background:" + CORES_AV[j % 4][0] + ";color:" + CORES_AV[j % 4][1] })),
        clientes: arr.map(c => { const sd = saudeDe(c); return { nome: c.nome, mrr: brl(c.mrr), sdT: sd[0], sd: "flex:0 0 auto;height:20px;padding:0 7px;border-radius:9999px;display:inline-flex;align-items:center;font-size:10.5px;font-weight:600;white-space:nowrap;background:" + sd[1] + ";color:" + sd[2], abrir: () => this.setState({ drawer: c.id }) }; }),
        agir: () => { if (!E) return; const base = E.ler("atividadesV2", null) || E.ler("atividades", null) || this.dadosDoProto.AtividadesSeed || [];
          const TIPO = { exp: "Reunião", risco: "Ligação", renov: "Reunião", impl: "Follow up" }[k];
          const novas = arr.map(c => ({ id: "a" + Date.now().toString(36) + c.id, titulo: agirTxt.replace("Criar atividade de ", "").replace(/^./, x => x.toUpperCase()) + " · " + c.nome, tipo: TIPO, area: k === "impl" ? "Onboarding" : "CS", situacao: "A fazer", prioridade: k === "risco" ? "Alta" : "Média", resp: c.resp, assignees: [c.resp], empresa: c.nome, desc: "Criada pelo NEXO a partir do insight “" + t + "”.", fim: "+2 10:00", sub: [], criadoPor: "NEXO" }));
          E.gravar({ [E.ler("atividadesV2", null) ? "atividadesV2" : "atividades"]: base.concat(novas) });
          E.avisar(novas.length + (novas.length > 1 ? " atividades criadas" : " atividade criada") + " para os responsáveis", "ok"); this.setState({ insAb: null }); } }; });
    const nx = { sub: insights.length ? insights.length + (insights.length > 1 ? " sinais na carteira agora" : " sinal na carteira agora") : "Nenhum sinal agora",
      stats: [[brlK(somaM(risco)), "de MRR em risco", "#ff8a70"], [brlK(somaM(expansao)), "em clientes para expandir", "#3ecf8e"]].map(([v, l, c]) => ({ v, l, vStyle: "display:block;font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:700;letter-spacing:-.02em;line-height:1;white-space:nowrap;color:" + c })) };

    // Próximas atividades
    const TIPOI = { "Ligação": [PROD.PABX[4], "#e6f4ee", "#1f7256"], "Reunião": ["M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "#fff6f4", "#c2330f"],
      "E-mail": ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6", "#e8f0fb", "#2c5f9e"], "Mensagem": ["M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", "#e6f4ee", "#1f7256"],
      "Follow up": ["M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5", "#fff6f4", "#c2330f"], "Proposta": ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", "#efecfa", "#4f3fa8"], "Tarefa": ["M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", "#eeeff3", "#4a5560"] };
    const nomesC = C.map(c => c.nome);
    const atvL = ((E && (E.ler("atividadesV2", null) || E.ler("atividades", null))) || this.dadosDoProto.AtividadesSeed || []);
    const proximas = atvL.filter(a => a && a.empresa && nomesC.indexOf(a.empresa) >= 0 && a.situacao !== "Feita" && a.situacao !== "Declinada").sort((x, y) => (parseInt((x.fim || "+99").split(" ")[0], 10) - parseInt((y.fim || "+99").split(" ")[0], 10)) || String(x.fim).localeCompare(String(y.fim))).slice(0, 5).map(a => {
      const T = TIPOI[a.tipo] || TIPOI.Tarefa, cl = C.find(c => c.nome === a.empresa);
      const m = /^([+-]\d+)(?:\s+(\d{1,2}:\d{2}))?/.exec(a.fim || ""), dd = m ? +m[1] : null;
      const dia = dd == null ? "—" : dd < 0 ? "Atras." : dd === 0 ? "Hoje" : dd === 1 ? "Amanhã" : (() => { const x = new Date(); x.setDate(x.getDate() + dd); return x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); })();
      const late = dd != null && dd < 0;
      return { t: a.titulo, s: a.empresa + " · " + (a.tipo || "Tarefa"), d: T[0], ini: ini(a.resp || "?"), resp: a.resp || "", dia, hora: m && m[2] ? m[2] : "—",
        data: "flex:0 0 auto;width:52px;padding:6px 0;border-radius:9px;text-align:center;" + (late ? "background:#fdeeea;color:#c2330f" : dd === 0 ? "background:#fff6f4;color:#c2330f" : "background:#f3f4f4;color:#1f252c"),
        ico: "flex:0 0 auto;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:" + T[1] + ";color:" + T[2], onClick: () => cl && irEmp(cl) }; });

    // Tabela
    const q = S.busca.trim().toLowerCase(), F = S.filtro;
    const passa = (c) => (!q || c.nome.toLowerCase().indexOf(q) >= 0 || (c.segmento || "").toLowerCase().indexOf(q) >= 0) &&
      (F === "todos" || (F === "saudavel" ? saudeDe(c)[0] === "Saudável" : F === "atencao" ? saudeDe(c)[0] === "Em atenção" || saudeDe(c)[0] === "Em risco" : c.status === "Inativo"));
    const ordem = (c) => { const u = c.ultima || ""; if (/^Hoje/.test(u)) return 0; if (/^Ontem/.test(u)) return 1; const m = /Há (\d+)/.exec(u); return m ? +m[1] : 999; };
    const passa2 = (c) => passa(c) && (!S.fProd || c.produto === S.fProd) && (!S.fResp || c.resp === S.fResp);
    const OR = S.ord || { col: "ultima", dir: 1 };
    const chaveOrd = { nome: (c) => c.nome, mrr: (c) => -c.mrr, saude: (c) => -(c.fim ? -1 : c.saude), desde: (c) => c.inicio, ultima: ordem, resp: (c) => c.resp || "" }[OR.col] || ordem;
    const todasL = C.filter(passa2).sort((a, b) => { const x = chaveOrd(a), y = chaveOrd(b); return (x < y ? -1 : x > y ? 1 : 0) * OR.dir || b.mrr - a.mrr; });
    const PP = S.porPag || 10, nPag = Math.max(1, Math.ceil(todasL.length / PP)), pg = Math.min(S.pag || 1, nPag);
    const lin = todasL.slice((pg - 1) * PP, pg * PP);
    const selN = Object.keys(S.sel).filter(k => S.sel[k]).length, allOn = lin.length > 0 && lin.every(c => S.sel[c.id]);
    const box = (on) => "width:16px;height:16px;border-radius:5px;border:0;padding:0;display:grid;place-items:center;cursor:pointer;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #b8bfc0");
    const seg = (on) => "height:26px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (on ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:#4a5560;font-weight:500");
    const respsL = C.map(c => c.resp).filter((x, i, a) => x && a.indexOf(x) === i).sort();
    const MESC = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const colCab = (k, l, dir) => { const on = OR.col === k; return { l, onClick: () => this.setState(s => ({ pag: 1, ord: { col: k, dir: (s.ord || {}).col === k ? -((s.ord || {}).dir || 1) : 1 } })),
      seta: on ? (OR.dir > 0 ? "M7 10l5 5 5-5" : "M7 14l5-5 5 5") : "M7 10l5 5 5-5", st: "display:flex;align-items:center;gap:4px;border:0;background:transparent;padding:0;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;justify-content:" + (dir || "flex-start") + ";color:" + (on ? "#12171d" : "#8b949e"),
      setaSt: "flex:0 0 auto;opacity:" + (on ? 1 : .35) }; };
    const ini1 = (pg - 1) * PP + 1, fim1 = Math.min(pg * PP, todasL.length);
    const janela = []; for (let i = Math.max(1, pg - 2); i <= Math.min(nPag, Math.max(1, pg - 2) + 4); i++) janela.push(i);
    const tab = { sub: todasL.length + (todasL.length === 1 ? " cliente" : " clientes") + (todasL.length !== C.length ? " de " + C.length + " na base" : " na base") + " · " + brl(todasL.reduce((a, c) => a + (c.fim ? 0 : c.mrr), 0)) + " de MRR", vazia: !lin.length,
      cab: { nome: colCab("nome", "Cliente"), mrr: colCab("mrr", "MRR", "flex-end"), saude: colCab("saude", "Saúde"), desde: colCab("desde", "Cliente desde"), ultima: colCab("ultima", "Última atividade"), resp: colCab("resp", "Responsável") },
      fProd: S.fProd || "", setProd: (e) => this.setState({ fProd: e.target.value, pag: 1 }), prods: PK.map(k => ({ v: k, l: P(k)[0] })),
      fResp: S.fResp || "", setResp: (e) => this.setState({ fResp: e.target.value, pag: 1 }), resps: respsL.map(r => ({ v: r, l: r })),
      temFiltro: !!(S.fProd || S.fResp || q || F !== "todos"), limparFiltros: () => this.setState({ fProd: "", fResp: "", busca: "", filtro: "todos", pag: 1 }),
      pagTxt: todasL.length ? ini1 + "–" + fim1 + " de " + todasL.length : "0 de 0", porPag: String(PP), setPorPag: (e) => this.setState({ porPag: +e.target.value, pag: 1 }),
      ant: () => this.setState({ pag: Math.max(1, pg - 1) }), prox: () => this.setState({ pag: Math.min(nPag, pg + 1) }),
      antSt: "width:32px;height:32px;border-radius:8px;border:0;display:grid;place-items:center;background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#1f252c;cursor:" + (pg > 1 ? "pointer" : "default;opacity:.4"),
      proxSt: "width:32px;height:32px;border-radius:8px;border:0;display:grid;place-items:center;background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#1f252c;cursor:" + (pg < nPag ? "pointer" : "default;opacity:.4"),
      pags: janela.map(n2 => ({ l: String(n2), onClick: () => this.setState({ pag: n2 }), st: "min-width:32px;height:32px;padding:0 8px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;" + (n2 === pg ? "background:#12171d;color:#fff" : "background:transparent;color:#4a5560") })),
      filtros: [["todos", "Todos"], ["saudavel", "Saudáveis"], ["atencao", "Atenção"], ["inativo", "Inativos"]].map(([k, l]) => ({ l, onClick: () => this.setState({ filtro: k, pag: 1 }), style: seg(F === k) })),
      temSel: selN > 0, selTxt: selN + (selN === 1 ? " selecionado" : " selecionados"), limparSel: () => this.setState({ sel: {} }),
      exportarSel: () => { const rows = C.filter(c => S.sel[c.id]); const q2 = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        const cs = [["Cliente", c => c.nome], ["Segmento", c => c.segmento || ""], ["Produto", c => P(c.produto)[0]], ["MRR", c => c.mrr], ["Saúde", c => saudeDe(c)[0]], ["Responsável", c => c.resp], ["Última atividade", c => c.ultima]];
        const txt = [cs.map(x => [...x][0])].concat(rows.map(c => cs.map(x => x[1](c)))).map(l2 => l2.map(q2).join(";")).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + txt], { type: "text/csv;charset=utf-8" })); a.download = "onface-clientes.csv"; document.body.appendChild(a); a.click(); a.remove();
        E && E.avisar(rows.length + (rows.length === 1 ? " cliente exportado" : " clientes exportados"), "ok"); this.setState({ sel: {} }); },
      allOn, checkAll: box(allOn), togAll: () => { const s2 = Object.assign({}, S.sel); lin.forEach(c => { s2[c.id] = !allOn; }); this.setState({ sel: s2 }); },
      linhas: lin.map(c => { const pr = P(c.produto), sd = saudeDe(c), on = !!S.sel[c.id], frio = diasSem(c) >= 30;
        const [ay0, am0] = c.inicio.split("-").map(Number);
        return { desde: MESC[am0 - 1] + "/" + String(ay0).slice(2), saudeN: c.fim ? "—" : String(c.saude), saudeTxt2: sd[0],
          saudeBar: "display:block;height:100%;border-radius:9999px;width:" + (c.fim ? 0 : c.saude) + "%;background:" + (c.fim ? "#b8bfc0" : c.saude >= 70 ? "#1f7256" : c.saude >= 45 ? "#fe4f2b" : "#d93c1a"),
          saudeCor: "font-size:11.5px;font-weight:600;white-space:nowrap;color:" + sd[2],
          nome: c.nome, ini: ini(c.nome), segmento: c.segmento || "—", produto: pr[0], mrr: brl(c.mrr), ultima: c.ultima, resp: c.resp, respIni: ini(c.resp), sel: on, abrir: () => this.setState({ drawer: c.id, menuId: null }),
          av: "flex:0 0 auto;width:28px;height:28px;border-radius:9999px;display:grid;place-items:center;font-size:10px;font-weight:700;background:" + pr[2] + ";color:" + pr[3],
          pStyle: "justify-self:start;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:600;white-space:nowrap;background:" + pr[2] + ";color:" + pr[3],
          saude: "justify-self:start;display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;background:" + sd[1] + ";color:" + sd[2],
          saudeDot: "width:6px;height:6px;border-radius:9999px;background:" + sd[2], saudeTxt: sd[0],
          ultStyle: "white-space:nowrap;font-size:12.5px;color:" + (frio ? "#c2330f" : "#4a5560"),
          check: box(on), tog: () => this.setState(s => ({ sel: Object.assign({}, s.sel, { [c.id]: !on }) })),
          abrirMenu: (e) => { const r = e.currentTarget.getBoundingClientRect(); this.setState(s => ({ menuId: s.menuId === c.id ? null : c.id, menuRect: { top: r.top, bottom: r.bottom, right: r.right } })); } }; }) };

    // Menu de ações
    // Drawer do cliente (prévia antes do Cliente 360)
    const DC = S.drawer ? C.find(x => x.id === S.drawer) : null;
    const dr = !DC ? { aberto: false, tiles: [], fatos: [], prox: [], rel: [] } : (() => {
      const pr = P(DC.produto), sd = saudeDe(DC), pd = (n) => String(n).padStart(2, "0");
      const ir360 = (aba) => { this.setState({ drawer: null }); E && E.irPara("/clientes/360", DC.nome, aba ? { cliente: DC.id, aba } : { cliente: DC.id }); };
      const [a0, m0] = DC.inicio.split("-").map(Number), meses = Math.max(0, (hoje.getFullYear() - a0) * 12 + hoje.getMonth() - (m0 - 1));
      let ren = new Date(a0 + 1, m0 - 1, 1); while (!DC.fim && ren <= hoje) ren = new Date(ren.getFullYear() + 1, ren.getMonth(), 1);
      const dRen = Math.round((ren - hoje) / 864e5);
      const h0 = new Date(); h0.setHours(0, 0, 0, 0);
      const AG = this.dadosDoProto.Agenda ? this.dadosDoProto.Agenda.itens().filter(x => x.empresa === DC.nome && ["Feita", "Declinada"].indexOf(x.situacao) < 0).sort((x, y) => (x.quando ? x.quando.getTime() : 9e15) - (y.quando ? y.quando.getTime() : 9e15)).slice(0, 3) : [];
      const RR = this.dadosDoProto.Relacoes ? this.dadosDoProto.Relacoes({ empresa: DC.nome }).itens.filter(r => r.k !== "cliente") : [];
      const diaDe = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const n = Math.round((x - h0) / 864e5); return n < 0 ? "Atrasada" : n === 0 ? "Hoje" : n === 1 ? "Amanhã" : pd(d.getDate()) + "/" + pd(d.getMonth() + 1); };
      const TI = { "Reunião": "m16 10 5-3v10l-5-3zM4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z", "Ligação": PROD.PABX[4], "E-mail": "M4 4h16v16H4zM4 7l8 6 8-6", "Mensagem": "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" };
      const tile = (l, v, s2, cor) => ({ l, v, s: s2, vStyle: "display:block;margin-top:4px;font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:700;letter-spacing:-.02em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;color:" + (cor || "#12171d") });
      return { aberto: true, ini: ini(DC.nome), nome: DC.nome, sub: [DC.segmento, pr[0]].filter(Boolean).join(" · "), stTxt: sd[0],
        stStyle: "display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:600;white-space:nowrap;background:" + sd[1] + ";color:" + sd[2], stDot: "width:6px;height:6px;border-radius:9999px;background:" + sd[2],
        desde: "Cliente há " + (meses < 1 ? "menos de 1 mês" : meses + (meses > 1 ? " meses" : " mês")),
        fechar: () => this.setState({ drawer: null }), ir360: () => ir360(null), irFin: () => ir360("financeiro"), irProd: () => ir360("produtos"),
        novaAtv: () => E && E.abrir("novaAtividade", { empresa: DC.nome }),
        tiles: [tile("MRR", brl(DC.mrr), "por mês"), tile("Saúde", DC.fim ? "—" : DC.saude + "/100", sd[0], DC.saude < 45 && !DC.fim ? "#c2330f" : null),
          tile("Renovação", DC.fim ? "Encerrado" : pd(ren.getDate()) + "/" + pd(ren.getMonth() + 1) + "/" + ren.getFullYear(), DC.fim ? "churn" : "em " + dRen + " dias", !DC.fim && dRen <= 45 ? "#c2330f" : null),
          tile("Última atividade", DC.ultima || "—", diasSem(DC) >= 30 ? "conta fria" : "contato recente", diasSem(DC) >= 30 ? "#c2330f" : null)],
        saudeBarra: "display:block;height:100%;border-radius:9999px;background:#fe4f2b;transition:width .9s cubic-bezier(.16,1,.3,1);width:" + (DC.fim ? 0 : DC.saude) + "%",
        fatos: [["Produto", pr[0]], ["Status", DC.status], ["Customer Success", DC.resp], ["Segmento", DC.segmento || "—"], ["Cliente desde", MESL[m0 - 1] + " " + a0]].map(([l, v]) => ({ l, v })),
        prox: AG.map(x => ({ t: x.titulo, s: [x.tipo, x.pessoa, x.resp].filter(Boolean).join(" · "), dia: x.quando ? diaDe(x.quando) : "Sem data", d: TI[x.tipo] || "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
          diaSt: "flex:0 0 auto;min-width:58px;height:24px;padding:0 8px;border-radius:7px;display:grid;place-items:center;font-size:11px;font-weight:700;white-space:nowrap;" + (x.quando && x.quando < h0 ? "background:#fdeeea;color:#c2330f" : "background:#f3f4f4;color:#1f252c"),
          onClick: () => { if (!E) return; if (x.tipo === "Reunião" && x.src !== "l") return E.abrir("reuniao", x.src === "o" ? { src: "o", oppId: x.oppId, i: x.idx } : { src: "p", id: x.id }); E.abrir("verAtividade", x.key); } })),
        semProx: !AG.length, rel: RR.map(r => ({ t: r.tipo + " · " + r.titulo, s: r.sub, status: r.status, ir: () => { this.setState({ drawer: null }); r.ir && r.ir(); } })), semRel: !RR.length };
    })();

    const MC = S.menuId ? C.find(x => x.id === S.menuId) : null;
    const menu = !MC ? { aberto: false, itens: [] } : (() => { const r = S.menuRect || { top: 100, bottom: 100, right: 200 }, vh = (typeof window !== "undefined" ? window.innerHeight : 900), cima = vh - r.bottom < 110;
      return { aberto: true, pos: "position:fixed;z-index:70;width:200px;padding:5px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px #e3e7e8,0 12px 28px -10px rgba(18,23,29,.3);left:" + Math.max(8, r.right - 200) + "px;" + (cima ? "bottom:" + (vh - r.top + 4) : "top:" + (r.bottom + 4)) + "px",
        itens: [
          { l: "Abrir cliente", d: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4", onClick: () => { this.setState({ menuId: null }); irEmp(MC); } },
          { l: "Nova atividade", d: "M12 5v14M5 12h14", onClick: () => { this.setState({ menuId: null }); E && E.irPara("/onface-preview/atividades", "Atividades", {}); } }
        ] }; })();

    // Novo cliente
    const NC = S.nc;
    let nc = { aberto: false, abrir: () => this.setState({ nc: { busca: "", produto: "CALLFACE_AI", mrr: "", inicio: ym(hoje), erro: "" } }), produtos: [], sugestoes: [] };
    if (NC) {
      const up = (p) => this.setState(s => ({ nc: Object.assign({}, s.nc, p) }));
      const cands = [].concat((D.LEADS || []).map(l => l.empresa), (D.OPORTUNIDADES || []).map(o => o.empresa)).filter(Boolean).filter((v, i, a2) => a2.indexOf(v) === i && nomesC.indexOf(v) < 0);
      const bq = (NC.busca || "").trim().toLowerCase(), sug = bq ? cands.filter(n2 => n2.toLowerCase().indexOf(bq) >= 0 && n2.toLowerCase() !== bq).slice(0, 6) : [];
      nc = Object.assign(nc, { aberto: true, fechar: () => this.setState({ nc: null }),
        busca: NC.busca, setBusca: (e) => up({ busca: e.target.value, erro: "" }), temSugestoes: sug.length > 0, sugestoes: sug.map(n2 => ({ l: n2, onClick: () => up({ busca: n2 }) })),
        produtos: PK.map(k => ({ l: P(k)[0], onClick: () => up({ produto: k }), style: "height:30px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;" + (NC.produto === k ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") })),
        mrr: NC.mrr, setMrr: (e) => up({ mrr: e.target.value.replace(/[^0-9]/g, ""), erro: "" }), inicio: NC.inicio, setInicio: (e) => up({ inicio: e.target.value }),
        temErro: !!NC.erro, erro: NC.erro,
        salvar: () => { const nome = (NC.busca || "").trim(), val = parseInt(NC.mrr || "0", 10);
          if (!nome) return up({ erro: "Escolha a empresa." }); if (nomesC.indexOf(nome) >= 0) return up({ erro: nome + " já está na carteira." }); if (!val) return up({ erro: "Informe o MRR." });
          const novo = { id: "cx" + Date.now().toString(36), nome, produto: NC.produto, mrr: val, inicio: NC.inicio || ym(hoje), resp: this.eu, ultima: "Hoje, agora", status: "Em implantação", saude: 75, segmento: (D.SEGMENTOS || {})[nome] || "" };
          if (E) E.gravar({ clientesExtra: (E.ler("clientesExtra", []) || []).concat([novo]) });
          E && E.avisar(nome + " entrou na carteira de clientes", "ok"); this.setState({ nc: null }); } });
    }

    const totHP = Math.max(1, mrrP.reduce((x, y) => x + y, 0)), DKH = { CALLFACE_AI: "#fe4f2b", WHITE_LABEL: "#9a8cf2", PABX: "#5b9be6" };
    const dMr = pct(mrr, mrrAntes);
    const tile = (l, v, c) => ({ l, v, vStyle: "display:block;margin-top:4px;font-family:'Plus Jakarta Sans',sans-serif;font-size:17px;font-weight:700;letter-spacing:-.02em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;color:" + (c || "#fff") });
    const hero = { cols: L >= 1080 ? "minmax(0,.85fr) minmax(0,2.1fr) minmax(0,1fr)" : "minmax(0,1fr)", dirCol: L >= 1080 ? "" : ";display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px",
      mrr: brl(mrr), dt: dMr != null && isFinite(dMr) ? Math.abs(dMr) + "%" : "+" + brlK(mrr - mrrAntes), dIco: dMr != null && dMr < 0 ? DN : UP,
      dStyle: "display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:700;white-space:nowrap;" + (dMr != null && dMr < 0 ? "background:rgba(254,79,43,.14);color:#ff8a70" : "background:rgba(62,207,142,.12);color:#3ecf8e"),
      dTxt: dMr != null && isFinite(dMr) ? "vs. " + N + " meses antes" : "no período",
      resumo: ativos.length + (ativos.length === 1 ? " cliente ativo" : " clientes ativos") + " · ticket médio de " + brl(ticket) + " por mês",
      prodTxt: brlK(mrr) + " de MRR",
      prod: PK.map((k, i) => ({ l: P(k)[0], v: brlK(mrrP[i]), pct: Math.round(mrrP[i] / totHP * 100) + "%", dica: P(k)[0] + ": " + brl(mrrP[i]),
        dot: "flex:0 0 auto;width:8px;height:8px;border-radius:2px;background:" + DKH[k], barra: "display:block;height:100%;flex:" + Math.max(0.0001, mrrP[i] / totHP) + " 0 0;background:" + DKH[k] + ";transition:flex-grow .7s cubic-bezier(.16,1,.3,1)" })),
      kpis: [tile("Clientes ativos", String(ativos.length)), tile("Novos no período", String(novos.length), novos.length ? "#3ecf8e" : "#fff"), tile("Ticket médio", brl(ticket)), tile("Sem contato 30+ dias", String(parados.length), parados.length ? "#ff8a70" : "#fff")] };
    this._ctx = { ativos, mrr, risco, expansao, renov, impl, parados, novos, ticket, mrrP, PK, P, brl, brlK, irEmp, cntM };
    return { busca: S.busca, setBusca: (e) => this.setState({ busca: e.target.value, pag: 1 }), per: String(N), perLabel: "Últimos " + N + " meses", setPer: (e) => this.setState({ per: +e.target.value, hvE: null, hvG: null }),
      kpi, kpiGrid, hero, evo, dist, cresc, topProd, segs, tick, insights, nx, semInsight: !insights.length, proximas, semProx: !proximas.length, tab, menu, nc, dr, parar: (e) => e.stopPropagation(),
      abrirNexo: () => this.nexo(""), nc2: this.chatVals(), pagRef: this.pagRef,
      irAtividades: () => E && E.irPara("/onface-preview/atividades", "Atividades", {}),
      row2: "display:grid;gap:12px;grid-template-columns:" + (L >= 1180 ? "minmax(0,1.45fr) minmax(0,1fr) minmax(0,1fr)" : mid ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)"),
      row3: "display:grid;gap:12px;align-items:start;grid-template-columns:" + (L >= 1040 ? "minmax(0,1fr) 340px" : "minmax(0,1fr)"),
      row3a: "display:flex;flex-wrap:wrap;gap:12px;align-items:stretch" };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <ClientesDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as ClientesLiga };
