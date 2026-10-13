// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Proposta — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * PropostaDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `PropostaDesenho.tsx`, convertido por máquina e intocável.
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

import { PropostaDesenho } from "./PropostaDesenho";
import { UsuarioDoProtoContexto } from "./usuario-do-proto";
import { nomeAposTrocarVariante, nomeDaLinha, precoDaNovaLinha } from "./linhas-da-proposta";
import { SeletorCatalogo } from "./SeletorCatalogo";

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

  esqRef = React.createRef();
  ctRef = React.createRef();
  state = { opps: null, leads: null, passo: 0, tentou: {}, d: null, idx: null, modo: "novo", sujo: false, salvoEm: null, catFam: null, cliente: false, expandido: false, enviado: null, troca: null, novoDest: "" };

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
    if (!E) return;
    const puxa = () => this.setState({ opps: E.ler("opps", null), leads: E.ler("leads", null) });
    puxa();
    this._off = E.assinar(puxa);
    this.oppId = (E.parametro && E.parametro("opp")) || "o8";
    this._rs = () => { const w = (typeof window !== "undefined" ? window.innerWidth : 1440); const e = w < 1180; if (e !== this.state.estreito) this.setState({ estreito: e }); };
    window.addEventListener("resize", this._rs); this._rs();
    this.forceUpdate();
  }
  componentWillUnmount() { if (this._off) this._off(); window.removeEventListener("resize", this._rs); }
  componentDidUpdate() {
    if (!this.state.d) { const O = this.opp(); if (O) this.iniciar(O); }
    if (this._ultPasso !== this.state.passo) { this._ultPasso = this.state.passo; if (this.esqRef.current) this.esqRef.current.scrollTop = 0; }
  }

  diz(t, tom) { const E = this.E; if (E) E.avisar(t, tom); }
  agora() { const d = new Date(); return "Hoje, " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  todas() {
    const D = this.dadosDoProto || {};
    const lista = this.state.opps || D.OPORTUNIDADES || [];
    const leads = this.state.leads || D.LEADS || [];
    const tem = {}; lista.forEach(o => { tem[(o.empresa || "").toLowerCase()] = true; if (o.leadId) tem["#" + o.leadId] = true; });
    const fam = (i) => /pabx/i.test(i || "") ? "PABX" : /white/i.test(i || "") ? "WHITE_LABEL" : "CALLFACE_AI";
    const derivadas = leads.filter(l => l.etapa === "oportunidade" && l.empresa && !tem[l.empresa.toLowerCase()] && !tem["#" + l.id]).map(l => ({
      id: "d:" + l.id, derivada: true, leadId: l.id, empresa: l.empresa, pessoa: l.pessoa, cargo: l.cargo, familia: fam(l.interesse), etapa: "entrada", resp: l.resp || "Camila Reis", dias: l.dias || 0,
      itens: [], proposta: null, pessoas: [{ nome: l.pessoa, papel: "Contato principal" }], atvs: [], eventos: [{ t: "Oportunidade criada no Pré-vendas", quando: "—", autor: l.resp || "Sistema" }]
    }));
    return lista.concat(derivadas).map((o, idx) => {
      const props = o.propostas || (o.proposta ? [Object.assign({ codigo: "P-" + (1540 + idx), itens: o.itens || [] }, o.proposta)] : []);
      return Object.assign({}, o, { propostas: props, leadId: o.leadId || (leads.find(l => l.empresa === o.empresa) || {}).id || null });
    });
  }
  opp() { return this.oppId ? this.todas().find(o => o.id === this.oppId || o.id === "o:" + String(this.oppId).replace(/^d:/, "")) : null; }

  catalogo() {
    const P = (id, nome, desc, tipo, unidade, qtd, precos, inicial) => ({ id, nome, desc, tipo, unidade, qtd, inicial: !!inicial,
      precos: precos.map((x, i) => ({ id: id + "-" + i, v: x[0], int: x[1], d: x[2], padrao: !!x[3], min: x[4], max: x[5] })) });
    return {
      CALLFACE_AI: [
        P("cf-full", "Callface AI - Full", "Plataforma completa por usuário", "plano", "usuários", 10, [[179.9, "mes", "Mensal", 1], [1799.9, "ano", "Anual · 2 meses grátis"]], true),
        P("cf-pro", "Callface AI - Pro", "Plano Pro por usuário", "plano", "usuários", 5, [[629.9, "mes", "Mensal", 1]]),
        P("cf-agente", "Callface AI - Agente IA", "Agente de voz com IA", "plano", "agentes", 1, [[349.9, "mes", "Mensal", 1], [3499, "ano", "Anual"]]),
        P("cf-500", "Callface AI - Pacote 500 Minutos", "Franquia adicional de 500 minutos", "pacote", "pacotes", 1, [[99.9, "mes", "Mensal recorrente", 1], [999, "ano", "Anual recorrente"], [119.9, "avulso", "Avulso · uso único"]]),
        P("cf-min", "Callface AI - Minutos Extras", "Minutos além da franquia", "minutos", "minutos", 1000, [[0.25, "avulso", "Avulso", 1], [0.25, "mes", "Mensal recorrente"]]),
        P("cf-setup", "Setup de implantação", "Configuração, integrações e onboarding", "setup", "un.", 1, [[1500, "avulso", "Padrão", 1], [3200, "avulso", "Com integração CRM"]], true)
      ],
      PABX: [
        P("px-ramal", "PABX - Ramal", "Ramal em nuvem com URA, fila e gravação", "plano", "ramais", 20, [[29.9, "mes", "Mensal", 1], [299, "ano", "Anual"]], true),
        P("px-linhas", "PABX - Linhas", "Número DID fixo local", "plano", "linhas", 2, [[49.9, "mes", "Mensal", 1], [499, "ano", "Anual"]], true),
        P("px-canais", "PABX - Canais", "Chamadas simultâneas", "plano", "canais", 10, [[39.9, "mes", "Faixa 1 · 1 a 9 canais", 1, 1, 9], [34.9, "mes", "Faixa 2 · 10 a 29 canais", 0, 10, 29], [29.9, "mes", "Faixa 3 · 30+ canais", 0, 30, null]]),
        P("px-bina", "PABX - BINA Inteligente", "Identificação de chamadas com dados do contato", "plano", "ramais", 20, [[9.9, "mes", "Mensal", 1], [99, "ano", "Anual"]]),
        P("px-min", "PABX - Minutos Extras", "Minutos além da franquia", "minutos", "minutos", 1000, [[0.18, "avulso", "Avulso", 1], [0.18, "mes", "Mensal recorrente"]]),
        P("px-hw", "PABX - Hardware", "Aparelhos e acessórios", "hardware", "aparelhos", 5, [[389, "avulso", "Telefone IP básico", 1], [649, "avulso", "Telefone IP gigabit"], [219, "avulso", "Headset USB"], [29.9, "mes", "Locação de telefone IP"]]),
        P("px-setup", "Instalação e configuração", "Configuração da central e portabilidade", "setup", "un.", 1, [[600, "avulso", "Padrão", 1]])
      ],
      WHITE_LABEL: [
        P("wl-lic", "Callface AI White Label - Licença", "Reserva por cliente final · cobrada na ativação", "plano", "licenças", 50, [[129.9, "mes", "Faixa 1 · 1 a 99 licenças", 1, 1, 99], [119.9, "mes", "Faixa 2 · 100 a 199 licenças", 0, 100, 199], [109.9, "mes", "Faixa 3 · 200 a 499 licenças", 0, 200, 499], [99.9, "mes", "Faixa 4 · 500+ licenças", 0, 500, null]], true),
        P("wl-setup", "Callface AI White Label - Setup", "Implantação por licença reservada", "setup", "licenças", 50, [[149.9, "avulso", "Faixa 1 · 1 a 99 licenças", 1, 1, 99], [139.9, "avulso", "Faixa 2 · 100 a 199 licenças", 0, 100, 199], [129.9, "avulso", "Faixa 3 · 200 a 499 licenças", 0, 200, 499], [119.9, "avulso", "Faixa 4 · 500+ licenças", 0, 500, null]], true)
      ]
    };
  }
  natDe(p, pr) { return pr.int === "mes" ? "MRR" : pr.int === "ano" ? "ARR" : p.tipo === "setup" ? "SETUP" : p.tipo === "hardware" ? "HARDWARE" : "ONE_TIME"; }
  prodDe(id) { const C = this.catalogo(); for (const k in C) { const p = C[k].find(x => x.id === id); if (p) return p; } return null; }
  faixaPara(p, q) { const fx = p.precos.filter(x => x.min != null); if (!fx.length) return null; return fx.find(x => q >= x.min && (x.max == null || q <= x.max)) || fx[0]; }
  novoItem(p, pr, qtd) { return { prod: p.id, preco: pr.id, nome: nomeDaLinha(p, pr), desc: p.desc, natureza: this.natDe(p, pr), valor: String(pr.v).replace(".", ","), qtd: String(qtd || p.qtd || 1), descTipo: "pct", descVal: "" }; }
  descItem(it, b) { const v = this.num(it.descVal); if (!v) return 0; return it.descTipo === "valor" ? Math.min(b, v) : b * Math.min(100, v) / 100; }

  iniciar(O) {
    const props = O.propostas || [];
    const MORTAS = ["recusada", "expirada", "substituida"];
    const vig = props.slice().reverse().find(p => MORTAS.indexOf(p.status) < 0) || null;
    const vi = vig ? props.indexOf(vig) : -1;
    const D = this.dadosDoProto || {};
    const LD = O.leadId ? (this.state.leads || D.LEADS || []).find(l => l.id === O.leadId) : null;
    /* E-mail REAL do contato (lead, ou a pessoa da oportunidade); nunca montado a partir do nome. */
    const PP = (O.pessoas || []).find(x => x.principal) || (O.pessoas || []).find(x => x.nome === O.pessoa) || null;
    const email = (LD && LD.email) || (PP && PP.email) || "";
    const FAM = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
    const cat = this.catalogo()[O.familia || "CALLFACE_AI"] || [];
    const base = {
      titulo: (FAM[O.familia] || "Callface AI") + " · " + O.empresa, familia: O.familia || "CALLFACE_AI", contato: O.pessoa, validade: 30,
      itens: cat.filter(p => p.inicial).map(p => this.novoItem(p, this.faixaPara(p, p.qtd) || p.precos.find(x => x.padrao) || p.precos[0])),
      desc: { tipo: "pct", valor: "", alvo: "mrr", meses: "sempre", justif: "" },
      prazo: "0", parcelas: "1", dia: "10", inicio: "assinatura", dataInicio: "", fidelidade: "12", reajuste: "IPCA", obs: "",
      fechamento: O.familia === "PABX" || O.familia === "WHITE_LABEL" ? "contrato" : "checkout", minuta: O.familia === "WHITE_LABEL" ? "revenda" : O.familia === "PABX" ? "locacao" : "saas", sigs: [{ nome: O.pessoa || "", email }], testemunhas: false,
      forma: "cliente", auto: true, canais: ["email"].concat((LD && (LD.tel || LD.telefone)) || (PP && PP.telefone) ? ["whatsapp"] : []), cc: [], assunto: "", intro: "", msgWa: "", wa: (LD && (LD.tel || LD.telefone)) || (PP && PP.telefone) || "", repCf: this.eu, vendAssina: true, prazoData: "", destinatarios: [O.pessoa].filter(Boolean), extras: [], teste: false, testeDias: "7", setupForma: "vista", canal: "email", para: email, msg: ""
    };
    const deProp = (p) => Object.assign({}, base, p.editor || {}, {
      titulo: (p.editor && p.editor.titulo) || base.titulo, validade: p.validade || 30, fechamento: p.modo === "PREPAID" ? "checkout" : ((p.editor && p.editor.fechamento) || "contrato"),
      itens: (p.itens || []).map(it => ({ prod: it.prod, preco: it.preco, nome: it.nome, desc: it.desc || "", natureza: it.natureza || "MRR", valor: String(it.valor).replace(".", ","), qtd: String(it.qtd || 1), descTipo: it.descTipo || "pct", descVal: it.descVal || "" }))
    });
    const Es = this.E, pv = Es && Es.parametro ? Es.parametro("ver") : null;
    if (pv != null && pv !== "" && props[+pv]) { const pp = props[+pv]; return this.setState({ d: Object.assign(deProp(pp), { codigo: pp.codigo, versao: pp.versao || 1 }), idx: +pv, modo: "ver", expandido: true, sujo: false, verVig: pp === vig }); }
    if (vig && vig.status === "rascunho") return this.setState({ d: Object.assign(deProp(vig), { codigo: vig.codigo, versao: vig.versao || 1 }), idx: vi, modo: "editar", baseInfo: null, salvoEm: "" });
    if (vig) return this.setState({ d: Object.assign(deProp(vig), { codigo: vig.codigo, versao: (vig.versao || 1) + 1 }), idx: null, modo: "versao", baseIdx: vi, baseInfo: "Nova versão da v" + (vig.versao || 1) + " · " + ({ enviada: "Enviada", visualizada: "Visualizada", ajuste_solicitado: "Ajuste solicitado", aceita: "Aceita" }[vig.status] || vig.status), sujo: true });
    this.setState({ d: Object.assign(base, { codigo: "nova", versao: 1 }), idx: null, modo: "novo", sujo: true });
  }

  num(v) { const n = parseFloat(String(v == null ? "" : v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; }

  calc(d) {
    const n = this.num.bind(this);
    let mrr = 0, unico = 0, uso = 0, anual = 0, res = 0, dm = 0, du = 0, da = 0, dr = 0;
    (d.itens || []).forEach(it => {
      const b = n(it.valor) * (n(it.qtd) || 0), x = this.descItem(it, b);
      if (it.prod === "wl-lic") { res += b; dr += x; }
      else if (it.natureza === "MRR") { mrr += b; dm += x; }
      else if (it.natureza === "ARR") { anual += b; da += x; }
      else if (it.natureza === "USAGE") uso += b;
      else { unico += b; du += x; }
    });
    const tot = mrr + unico + anual + res, pctEf = tot ? (dm + du + da + dr) / tot * 100 : 0;
    const fid = n(d.fidelidade), horiz = fid || 12, meses = horiz;
    const mrrLiq = mrr - dm, unicoLiq = unico - du, anualLiq = anual - da, resLiq = res - dr, anos = Math.max(1, Math.ceil(horiz / 12));
    const totalContrato = unicoLiq + mrrLiq * horiz + anualLiq * anos;
    const parc = d.setupForma === "parcelado" ? Math.max(1, n(d.parcelas) || 1) : 1;
    const teste = !!d.teste, tDias = teste ? Math.max(1, n(d.testeDias) || 7) : 0;
    const primeiro = unicoLiq / parc + (!teste && d.inicio === "assinatura" ? mrrLiq + anualLiq : 0);
    return { anual, da, anualLiq, anos, mrr, unico, uso, dm, du, dr, res, resLiq, mrrLiq, unicoLiq, pctEf, fid, horiz, meses, totalContrato, primeiro, parc, teste, tDias };
  }

  gravar(propPatch, oppPatch, evento) {
    const E = this.E, D = this.dadosDoProto || {};
    const O = this.opp(); if (!O) return null;
    const atual = (this.state.opps || D.OPORTUNIDADES || []).slice();
    const novo = Object.assign({}, O, oppPatch || {});
    delete novo.derivada; delete novo.proposta; delete novo.itens;
    if (String(novo.id).indexOf("d:") === 0) { novo.id = "o:" + novo.leadId; this.oppId = novo.id; }
    const props = (novo.propostas || []).slice();
    let idx = this.state.idx;
    if (propPatch) { if (idx == null || !props[idx]) { props.push(propPatch); idx = props.length - 1; } else props[idx] = propPatch; }
    if (this._marcarBase != null && props[this._marcarBase]) { props[this._marcarBase] = Object.assign({}, props[this._marcarBase], { status: "substituida" }); this._marcarBase = null; }
    novo.propostas = props;
    if (evento) novo.eventos = [{ t: evento, quando: this.agora(), autor: this.eu }].concat(novo.eventos || []);
    const i = atual.findIndex(x => x.id === novo.id || x.id === O.id);
    if (i >= 0) atual[i] = novo; else atual.push(novo);
    this.setState({ opps: atual, idx });
    if (E) E.gravar({ opps: atual });
    return novo;
  }

  /* Quem assina pela Callface, com o que a tela MOSTRA como padrão quando o vendedor não mexeu:
     vendedor responsável (e-mail do cadastro dele), representante legal (padrão de Ajustes > Contratos
     ou o usuário logado, sem e-mail inventado) e a segunda testemunha, que só existe se pedida. */
  cfEfetivo(d) {
    const O = this.opp() || {}, pad = this.props.repPadrao || {}, cf = d.sigCf || {};
    const pega = (k, nomePad, mailPad) => { const c = cf[k] || {}; return { nome: String(c.nome != null ? c.nome : nomePad || "").trim(), email: String(c.email != null ? c.email : mailPad || "").trim() }; };
    return { vend: pega("vend", O.resp, O.respEmail), rep: pega("rep", pad.nome || this.eu, pad.email), test2: d.testemunhas ? pega("test2", "", "") : null };
  }

  /* A lista que vira propostas.signatarios: cliente (contratante) primeiro, depois a Callface. Vazio não vira e-mail. */
  signatariosDe(d) {
    const O = this.opp() || {}, ct = d.ct || {}, cf = this.cfEfetivo(d);
    const pX = (nome) => (O.pessoas || []).find(p => p.nome === nome) || {};
    const cli = (d.sigs || []).map((s, i) => {
      const base = { nome: (s.nome || "").trim(), email: (s.email || "").trim(), papel: "contratante" };
      if (i > 0) return base;
      const cargo = ct.sigCargo != null ? ct.sigCargo : pX(base.nome).papel, cpf = ct.sigCpf != null ? ct.sigCpf : pX(base.nome).cpf;
      return Object.assign(base, cargo ? { cargo } : {}, cpf ? { cpf } : {});
    });
    const lado = [["testemunha_vendedor", cf.vend], ["representante_legal", cf.rep], ["testemunha_2", cf.test2]].filter(x => x[1] && x[1].nome).map(x => ({ nome: x[1].nome, email: x[1].email, papel: x[0] }));
    return cli.concat(lado);
  }

  paraProposta(d, status, extra) {
    const n = this.num.bind(this);
    /* Empresa e contato moram na Empresa e na Pessoa (uma fonte só); o editor guarda só as condições desta proposta. */
    const DONOS = ["razao", "fantasia", "cnpj", "rua", "bairro", "cep", "cidade", "uf", "sigQuem", "sigNome", "sigCargo", "sigEmail", "sigTel", "sigCpf"];
    const ct = Object.assign({}, d.ct || {}); DONOS.forEach(k => { delete ct[k]; });
    return Object.assign({ codigo: d.codigo, versao: d.versao, status, modo: d.fechamento === "checkout" ? "PREPAID" : "CONTRACT", validade: d.validade,
      signatarios: d.fechamento === "contrato" ? this.signatariosDe(d) : [],
      itens: d.itens.filter(it => (it.nome || "").trim()).map(it => ({ prod: it.prod, preco: it.preco, nome: it.nome.trim(), desc: it.desc || "", natureza: it.natureza, valor: n(it.valor), qtd: n(it.qtd) || 1, descTipo: it.descTipo || "pct", descVal: it.descVal || "", liq: n(it.valor) * (n(it.qtd) || 1) - this.descItem(it, n(it.valor) * (n(it.qtd) || 1)) })),
      editor: JSON.parse(JSON.stringify(Object.assign({}, d, { itens: undefined, ct }))) }, extra || {});
  }

  renderVals() {
    const S = this.state, D = this.dadosDoProto || {}, Es = this.E;
    const ini = (n) => avatarDe(n, (D.iniciais || (s => (s || "").split(" ").map(p => [...p][0]).slice(0, 2).join("").toUpperCase()))(n));
    const ir = (href, rot, p) => Es && Es.irPara(href, rot, p);
    const irPipeline = () => ir("/onface-preview/pipeline", "Pipeline");
    const O = this.opp();
    const base = { tituloTopo: "Criar proposta", trilhaTopo: [{ label: "Pipeline", ir: irPipeline }], irPipeline, temO: false, semO: !!this.oppId && !O,
      cab: { meta: [] }, passos: [], herdado: [], f0: { familias: [], validades: [], pessoas: [], dest: [], extras: [] }, f1: { itens: [], catalogo: [], catTabs: [] }, f2: { testeDias: [], setupFormas: [], prazos: [], inicios: [], reajustes: [], stTeste: {}, stParc: {}, stDia: {}, stFid: {} }, f3: { modelos: [], sigs: [], formas: [], fluxo: [], minutas: [] }, f4: { checks: [], canais: [], versoes: [] },
      pv: { meta: [], grupos: [], condicoes: [], fin: [], fecho: [] }, fim: { trilha: [] }, resumoKpi: [], naturezas: [], troca: { aberto: false, familias: [], contatos: [] } };
    if (!O || !S.d) return Object.assign(base, { temO: false });
    const d = Object.assign({}, S.d, { familia: O.familia || "CALLFACE_AI" });
    if (d.familia !== "CALLFACE_AI") d.fechamento = "contrato";
    if (d.familia === "WHITE_LABEL") d.teste = false;
    if (d.forma === "pix") d.forma = "cliente";
    const tipoOpp = O.tipo || "nova";
    if (tipoOpp !== "nova") { d.fechamento = "contrato"; d.minuta = "aditivo"; }
    else if (d.minuta !== "aditivo" || true) d.minuta = "contrato";
    const canaisSel = d.canais || (d.canal === "link" ? [] : [d.canal || "email"]);
    const licQ = (S.d.itens || []).filter(x => x.prod === "wl-lic").reduce((a, x) => a + this.num(x.qtd), 0);
    d.itens = (S.d.itens || []).map(it => it.prod === "wl-setup" && licQ > 0 ? Object.assign({}, it, { qtd: String(licQ) }) : it);
    const fixosWl = d.familia === "WHITE_LABEL" ? d.itens.filter(it => !it.prod && (it.natureza === "MRR" || it.natureza === "ARR")) : [];
    if (d.fechamento !== "contrato") d.fechamento = "checkout";
    if (!d.destinatarios) d.destinatarios = [d.contato].filter(Boolean);
    if (!d.extras) d.extras = [];
    const c = this.calc(d);
    const FAM = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
    const FICO = { CALLFACE_AI: "M3 14v-2a9 9 0 0 1 18 0v2M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2zM18 17v1a3 3 0 0 1-3 3h-2", PABX: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39", WHITE_LABEL: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" };
    const NAT = { MRR: "Mensal", ARR: "Anual", SETUP: "Setup", ONE_TIME: "Único", HARDWARE: "Hardware", USAGE: "Por uso" };
    const NATC = { MRR: "background:#e6f4ee;color:#1f7256", ARR: "background:#dcefe7;color:#17553f", SETUP: "background:#fff6f4;color:#9c3210", ONE_TIME: "background:#fff6f4;color:#9c3210", HARDWARE: "background:#e8f0fb;color:#2c5f9e", USAGE: "background:#f7edd8;color:#6e5420" };
    const NICO = { MRR: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5", ARR: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", SETUP: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z", ONE_TIME: "M20 6 9 17l-5-5", HARDWARE: "M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01", USAGE: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" };
    const brl = (v) => "R$ " + (+v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const n = this.num.bind(this);
    const up = (patch) => this.setState(s => ({ d: Object.assign({}, s.d, patch), sujo: true }));
    const upD = (patch) => this.setState(s => ({ d: Object.assign({}, s.d, { desc: Object.assign({}, s.d.desc, patch) }), sujo: true }));
    const upIt = (i, patch) => this.setState(s => { const x = s.d.itens.slice(); x[i] = Object.assign({}, x[i], patch); return { d: Object.assign({}, s.d, { itens: x }), sujo: true }; });
    const chip = (on) => "height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;font-weight:" + (on ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
    const seg = (on) => "display:flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 10px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (on ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560");
    const inp = (erro) => "width:100%;height:42px;padding:0 12px;border-radius:10px;border:0;outline:0;background:#fff;font-size:13.5px;font-weight:500;color:#12171d;box-shadow:inset 0 0 0 1px " + (erro ? "#d93c1a" : "#dbdede");
    const radio = (on) => "flex:0 0 auto;width:18px;height:18px;border-radius:9999px;box-sizing:border-box;" + (on ? "border:5px solid #12171d" : "border:1.5px solid #b8bdbb");
    const trilho = (on) => "flex:0 0 auto;width:34px;height:20px;border-radius:9999px;padding:2px;display:flex;background:" + (on ? "#fe4f2b" : "#d2d5d5") + ";justify-content:" + (on ? "flex-end" : "flex-start") + ";transition:background .15s";
    const bolaT = "width:16px;height:16px;border-radius:9999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)";
    const hoje = new Date();
    const fmtD = (dt) => String(dt.getDate()).padStart(2, "0") + "/" + String(dt.getMonth() + 1).padStart(2, "0") + "/" + dt.getFullYear();
    const valida = new Date(hoje.getTime() + d.validade * 864e5);
    const LD = O.leadId ? (S.leads || D.LEADS || []).find(l => l.id === O.leadId) : null;
    const empX = (Es && Es.ler("empresas", {})[O.empresa]) || {};
    const pessoas = [O.pessoa].concat((O.pessoas || []).map(p => p.nome)).filter((x, i, a) => x && a.indexOf(x) === i);
    const email = d.sigs && d.sigs[0] ? d.sigs[0].email : "";
    const ROT = { entrada: "Entrada", diagnostico: "Diagnóstico", proposta: "Proposta", negociacao: "Negociação", ganho: "Ganho", perdido: "Perdido" };

    // validação
    const v0 = !!(d.titulo || "").trim() && !!d.contato && !!d.familia;
    const itOk = (it) => (it.nome || "").trim() && n(it.valor) > 0 && n(it.qtd) > 0;
    const v1 = d.itens.length > 0 && d.itens.every(itOk);
    const precisaAprov = c.pctEf > 15;
    const v2 = !precisaAprov || !!(d.desc.justif || "").trim();
    const mailOk = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m || "");
    const cfE = this.cfEfetivo(d);
    const v3 = d.fechamento !== "contrato" || (d.sigs.length > 0 && d.sigs.every(s => (s.nome || "").trim() && mailOk(s.email)) && !!cfE.rep.nome && mailOk(cfE.rep.email) && (!cfE.test2 || !cfE.test2.email || mailOk(cfE.test2.email)) && (!cfE.vend.email || mailOk(cfE.vend.email)));
    const v4 = (canaisSel.indexOf("email") < 0 || mailOk(d.para)) && (canaisSel.indexOf("whatsapp") < 0 || (d.wa || "").replace(/\D/g, "").length >= 10);
    const oks = [v0, v1, v2, v3, v4];
    const ROTS = [["Dados", "Contexto e validade"], ["Itens e valores", "Produtos e serviços"], ["Condições", "Teste, setup e recorrência"], ["Contrato e pagamento", "Fechamento"], ["Revisão e envio", "Confira e envie"]];
    const tentou = S.tentou;
    const irPasso = (k) => this.setState({ passo: k, enviado: null });

    // cabeçalho
    const statusAtual = S.enviado ? "enviada" : "rascunho";
    const cab = {
      titulo: d.titulo || "Proposta sem título", codigo: "#" + d.codigo + "-v" + d.versao, status: S.enviado ? "Enviada" : "Rascunho",
      statusStyle: "display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;" + (S.enviado ? "background:#e8f0fb;color:#2c5f9e" : "background:#eeeff3;color:#4a5560"),
      statusDot: "width:6px;height:6px;border-radius:9999px;background:" + (S.enviado ? "#2c5f9e" : "#8b949e"),
      temBase: !!S.baseInfo, base: S.baseInfo || "",
      salvo: S.enviado ? "Versão final gerada" : S.sujo ? "Alterações não salvas" : "Rascunho salvo " + (S.salvoEm || ""),
      salvoD: S.sujo && !S.enviado ? "M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" : "M20 6 9 17l-5-5",
      salvoStyle: "display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;white-space:nowrap;color:" + (S.sujo && !S.enviado ? "#9c7a2e" : "#1f7256") + (S.modo === "ver" ? ";display:none" : ""),
      meta: [
        ["M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4", "Empresa", O.empresa],
        ["M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "Contato", d.contato || "—"],
        ["M5 12h14M13 6l6 6-6 6", "Etapa", ROT[O.etapa] || "—"],
        ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "Responsável", O.resp],
        ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20", "Origem", LD ? LD.origem || "—" : (O.origem || "Manual")]
      ].map(([dd, label, valor]) => ({ d: dd, label, valor }))
    };

    const passos = ROTS.map(([label], k) => {
      const atual = k === S.passo && !S.enviado, feito = S.enviado ? true : (k < S.passo && oks[k]), erro = !atual && !feito && tentou[k] && !oks[k];
      const cor = atual ? "#fe4f2b" : feito ? "#12171d" : erro ? "#c2330f" : "#fff";
      return { label, n: String(k + 1), feito, erro, num: !feito && !erro, onClick: () => irPasso(k),
        bola: "flex:0 0 auto;width:28px;height:28px;border-radius:9999px;display:grid;place-items:center;font-size:12px;font-weight:700;background:" + cor + ";color:" + (atual || feito || erro ? "#fff" : "#67787c") + ";box-shadow:" + (atual ? "0 0 0 4px rgba(254,79,43,.16)" : atual || feito || erro ? "none" : "inset 0 0 0 1.5px #d2d5d5"),
        linhaE: "flex:1;height:2px;border-radius:2px;background:" + (k === 0 ? "transparent" : (k <= S.passo || S.enviado ? "#12171d" : "#e3e7e8")),
        linhaD: "flex:1;height:2px;border-radius:2px;background:" + (k === ROTS.length - 1 ? "transparent" : (k < S.passo || S.enviado ? "#12171d" : "#e3e7e8")),
        labelStyle: "font-size:11.5px;text-align:center;line-height:1.25;text-wrap:balance;font-weight:" + (atual ? "700;color:#12171d" : erro ? "600;color:#c2330f" : "500;color:#67787c") };
    });

    // passo 1
    const herdado = [
      ["Empresa", O.empresa, empX.cnpj || (LD && LD.segmento) || "Cliente da oportunidade"],
      ["Oportunidade", (FAM[O.familia] || "") + " · " + O.empresa, ROT[O.etapa] + " · há " + (O.dias || 0) + " dias"],
      ["Responsável", O.resp, "Closer da oportunidade"],
      ["Origem", LD ? (LD.origem || "—") : (O.origem || "Criada manualmente"), (LD && LD.campanha) || "—"]
    ].map(([label, valor, sub], i) => ({ label, valor, sub, style: "min-width:0;padding:11px 13px;" + (i % 2 ? "box-shadow:inset 1px 0 0 #eef1f1;" : "") + (i > 1 ? "border-top:1px solid #eef1f1" : "") }));
    const dests = d.destinatarios.filter(x => pessoas.indexOf(x) >= 0 || x === d.contato);
    const setPrincipal = (v) => this.setState(s => { const ds = (s.d.destinatarios || [s.d.contato]).filter(Boolean); return { d: Object.assign({}, s.d, { contato: v, destinatarios: ds.indexOf(v) >= 0 ? ds : ds.concat(v), sigs: s.d.sigs.length ? [Object.assign({}, s.d.sigs[0], { nome: v })].concat(s.d.sigs.slice(1)) : [{ nome: v, email: "" }] }), sujo: true }; });
    const papelDe = (nm) => nm === O.pessoa ? (O.cargo || "Contato da oportunidade") : (((O.pessoas || []).find(p => p.nome === nm) || {}).papel || "Contato");
    const novoTxt = (S.novoDest || "").trim();
    const addNovo = () => {
      const v = novoTxt; if (!v) return;
      const ehMail = mailOk(v), ehTel = v.replace(/\D/g, "").length >= 10;
      if (!ehMail && !ehTel) return this.diz("Digite um e-mail ou WhatsApp válido", "erro");
      if (d.extras.some(x => x.valor === v)) return this.setState({ novoDest: "" });
      this.setState(s => ({ novoDest: "", d: Object.assign({}, s.d, { extras: (s.d.extras || []).concat({ valor: v, tipo: ehMail ? "email" : "whatsapp" }) }), sujo: true }));
    };
    const f0 = {
      titulo: d.titulo, setTitulo: (e) => up({ titulo: e.target.value }), tituloStyle: inp(tentou[0] && !(d.titulo || "").trim()),
      familias: [], famD: FICO[O.familia || "CALLFACE_AI"], famLabel: FAM[O.familia || "CALLFACE_AI"],
      abrirTroca: () => this.setState({ troca: { familia: null, contato: d.contato || O.pessoa } }),
      contato: d.contato || "—", contatoIni: ini((d.contato || "").replace(/^Dr\.?\s+/, "")), pessoas, setContato: (e) => setPrincipal(e.target.value),
      destResumo: (dests.length + d.extras.length) + ((dests.length + d.extras.length) > 1 ? " destinatários" : " destinatário"),
      dest: pessoas.map((nm, i) => { const on = dests.indexOf(nm) >= 0, pr = nm === d.contato; return {
        nome: nm, ini: ini(nm.replace(/^Dr\.?\s+/, "")), sub: papelDe(nm), ehPrincipal: pr, podePrincipal: on && !pr,
        dica: pr ? "O principal sempre recebe" : on ? "Não enviar para esta pessoa" : "Enviar também para esta pessoa",
        check: "flex:0 0 auto;width:18px;height:18px;border-radius:5px;border:0;padding:0;display:grid;place-items:center;cursor:" + (pr ? "default" : "pointer") + ";" + (on ? "background:#12171d;color:#fff" + (pr ? ";opacity:.55" : "") : "background:#fff;color:transparent;box-shadow:inset 0 0 0 1.5px #c9cecd"),
        toggle: () => { if (pr) return; up({ destinatarios: on ? dests.filter(x => x !== nm) : dests.concat(nm) }); },
        tornar: () => setPrincipal(nm),
        linha: "display:flex;align-items:center;gap:10px;padding:9px 12px;background:" + (on ? "#fff" : "#fafafa") + ";" + (i ? "border-top:1px solid #eef1f1" : "") }; }),
      extras: d.extras.map((x, i) => ({ valor: x.valor, tipo: x.tipo === "email" ? "E-mail avulso" : "WhatsApp avulso",
        d: x.tipo === "email" ? "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6" : "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
        remover: () => up({ extras: d.extras.filter((_, j) => j !== i) }) })),
      novo: S.novoDest || "", temNovo: !!novoTxt, setNovo: (e) => this.setState({ novoDest: e.target.value }),
      teclaNovo: (e) => { if (e.key === "Enter") { e.preventDefault(); addNovo(); } }, addNovo,
      emissao: fmtD(hoje), validaAte: "Emitida em " + fmtD(hoje) + " · válida até " + fmtD(valida),
      validades: [7, 15, 30, 60].map(v => ({ label: v + " dias", style: seg(d.validade === v), onClick: () => up({ validade: v }) }))
    };

    // passo 2
    const famNotas = {
      CALLFACE_AI: ["Callface AI · como cobrar", "Cada produto tem seus preços: mensal, anual ou avulso. Minutos extras podem entrar na assinatura (mensal) ou ser vendidos uma vez só (avulso)."],
      PABX: ["PABX · como cobrar", "Ramal, linhas e BINA têm preço mensal ou anual. Canais usam preço por faixa, que muda sozinho com a quantidade. Hardware pode ser venda avulsa ou locação mensal."],
      WHITE_LABEL: ["White Label · como cobrar", "A licença usa preço por faixa: o valor unitário cai conforme a quantidade de licenças. O setup é cobrado uma vez."]
    };
    const catFam = O.familia || "CALLFACE_AI";
    const CAT = this.catalogo();
    const setQ = (i, qStr) => { const it = d.itens[i]; const P = it && it.prod ? this.prodDe(it.prod) : null; const fx = P ? this.faixaPara(P, n(qStr)) : null; upIt(i, Object.assign({ qtd: qStr }, fx && fx.id !== it.preco ? { preco: fx.id, valor: String(fx.v).replace(".", ","), natureza: this.natDe(P, fx) } : {})); };
    const IL = { mes: "Mensal", ano: "Anual", avulso: "Avulso" };
    const sufP = (P, pr) => (P && P.tipo === "minutos" ? "/min" : "") + (pr.int === "mes" ? "/mês" : pr.int === "ano" ? "/ano" : "");
    const brlP = (P, pr) => (P && P.tipo === "minutos" ? "R$ " + pr.v.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : brl(pr.v)) + sufP(P, pr);
    const f1 = {
      famD: FICO[d.familia], famTitulo: famNotas[d.familia][0], famNota: famNotas[d.familia][1],
      vazio: !d.itens.length, erroItens: !!tentou[1] && !v1,
      temFixosWl: fixosWl.length > 0,
      fixosWlTxt: (fixosWl.length > 1 ? fixosWl.length + " itens têm" : "\"" + (fixosWl[0] || {}).nome + "\" tem") + " mensalidade fixa. No White Label a cobrança recorrente é só por licença ativada, então " + (fixosWl.length > 1 ? "eles aparecem" : "ele aparece") + " para o cliente como uma cobrança à parte.",
      removerFixosWl: () => { this.setState(s => ({ d: Object.assign({}, s.d, { itens: (s.d.itens || []).filter(it => fixosWl.indexOf(it) < 0 && !(!it.prod && (it.natureza === "MRR" || it.natureza === "ARR"))) }), sujo: true })); this.diz("Mensalidade fixa removida", "ok"); },
      catAberto: S.catAberto != null ? S.catAberto : !d.itens.length, toggleCat: () => this.setState(s => ({ catAberto: !(s.catAberto != null ? s.catAberto : !d.itens.length) })),
      catChev: "flex:0 0 auto;transition:transform .2s;transform:rotate(" + ((S.catAberto != null ? S.catAberto : !d.itens.length) ? "180deg" : "0deg") + ")",
      itens: d.itens.map((it, i) => {
        const bad = tentou[1] && !itOk(it), sub = n(it.valor) * (n(it.qtd) || 0);
        const dsc = this.descItem(it, sub), travada = it.prod === "wl-setup" && licQ > 0, descAberto = !!it.descOn || n(it.descVal) > 0;
        const perSuf = it.natureza === "MRR" ? "/mês" : it.natureza === "ARR" ? "/ano" : "";
        const P = it.prod ? this.prodDe(it.prod) : null;
        const PR = P ? (P.precos.find(x => x.id === it.preco) || P.precos[0]) : null;
        const tier = !!P && P.precos.some(x => x.min != null);
        const step = P && P.tipo === "minutos" ? 100 : 1;
        const fora = !!PR && Math.abs(n(it.valor) - PR.v) > 0.001;
        const dica = !P ? "" : it.prod === "wl-setup" ? "1 setup por licença reservada · acompanha a quantidade de licenças" + (fora ? " · valor negociado" : "") : it.prod === "wl-lic" ? (PR.d.split(" · ")[1] || PR.d) + " · reserva: a mensalidade é cobrada por licença ativada" : fora ? "Preço de tabela " + brlP(P, PR) + " · valor negociado"
          : tier ? PR.d + " · a faixa muda sozinha com a quantidade"
          : (P.tipo === "minutos" || P.tipo === "pacote") ? (PR.int === "avulso" ? "Compra única · não entra na assinatura" : PR.int === "ano" ? "Entra na assinatura · cobrado todo ano" : "Entra na assinatura · cobrado todo mês")
          : "";
        return { nome: it.nome, desc: it.desc || "", qtd: it.qtd, valor: it.valor, d: NICO[it.natureza] || NICO.ONE_TIME,
          natLabel: P ? (tier ? PR.d.split(" · ")[0] + " · " + IL[PR.int].toLowerCase() : PR.d) : (NAT[it.natureza] || it.natureza),
          selVal: P ? PR.id : it.natureza,
          opcoes: P ? P.precos.map(pr => ({ v: pr.id, l: pr.d + " — " + brlP(P, pr) + (pr.padrao ? " · padrão" : "") })) : Object.keys(NAT).map(k => ({ v: k, l: NAT[k] })),
          setSel: (e) => { const v = e.target.value; if (!P) return upIt(i, { natureza: v }); const pr = P.precos.find(x => x.id === v); if (pr) upIt(i, { preco: pr.id, valor: String(pr.v).replace(".", ","), natureza: this.natDe(P, pr), nome: nomeAposTrocarVariante(P, it.nome, P.precos.find(x => x.id === it.preco), pr) }); },
          temDica: !!dica, dica,
          dicaStyle: "display:flex;align-items:center;gap:5px;padding-left:38px;margin-top:2px;font-size:11.5px;color:" + (fora ? "#9c7a2e" : "#67787c"),
          unidade: P ? P.unidade : "un.",
          qtdTravada: travada, qtdLivre: !travada,
          temBruto: dsc > 0, bruto: brl(sub), temDescRow: descAberto, semDescRow: !descAberto,
          descTipos: [["pct", "%"], ["valor", "R$"]].map(([v, l]) => ({ label: l, onClick: () => upIt(i, { descTipo: v }), style: seg((it.descTipo || "pct") === v) + ";height:26px;min-width:32px;padding:0 8px;font-size:12px" })),
          descPre: it.descTipo === "valor" ? "R$" : "", descSuf: it.descTipo === "valor" ? "" : "%",
          descVal: it.descVal || "", setDescVal: (e) => upIt(i, { descVal: e.target.value.replace(/[^\d,.]/g, "") }),
          descEquiv: dsc ? "− " + brl(dsc) + perSuf : "",
          abrirDesc: () => upIt(i, { descOn: true }), tirarDesc: () => upIt(i, { descOn: false, descVal: "" }),
          subtotal: brl(sub - dsc), subLabel: it.prod === "wl-lic" ? "por mês, se todas ativas" : it.natureza === "MRR" ? "por mês" : it.natureza === "ARR" ? "por ano" : it.natureza === "USAGE" ? "sob demanda" : "uma vez",
          card: "padding:10px 10px 12px;border-radius:11px;background:#fff;box-shadow:inset 0 0 0 1px " + (bad ? "#f0b4a4" : "#e3e7e8"),
          ico: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (NATC[it.natureza] || NATC.ONE_TIME),
          nomeStyle: "flex:1;min-width:0;height:30px;padding:0;border:0;outline:0;background:transparent;font-size:13.5px;font-weight:600;color:#12171d;" + (bad && !(it.nome || "").trim() ? "box-shadow:inset 0 -1px 0 #d93c1a" : ""),
          natStyle: "position:relative;flex:0 1 auto;min-width:0;max-width:210px;display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px 0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;cursor:pointer;" + (NATC[it.natureza] || NATC.ONE_TIME),
          valorCaixa: "display:flex;align-items:center;gap:4px;height:32px;padding:0 8px;border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px " + (bad && !(n(it.valor) > 0) ? "#d93c1a" : fora ? "#e6cf9a" : "#dbdede"),
          setNome: (e) => upIt(i, { nome: e.target.value }), setDesc: (e) => upIt(i, { desc: e.target.value }),
          setQtd: (e) => setQ(i, e.target.value.replace(/\D/g, "")), setValor: (e) => upIt(i, { valor: e.target.value.replace(/[^\d,.]/g, "") }),
          menos: () => setQ(i, String(Math.max(1, (n(it.qtd) || 1) - step))), mais: () => setQ(i, String((n(it.qtd) || 0) + step)),
          remover: () => this.setState(s => ({ d: Object.assign({}, s.d, { itens: s.d.itens.filter((_, j) => j !== i) }), sujo: true })),
          subir: () => i > 0 && this.setState(s => { const x = s.d.itens.slice(); const t = x[i - 1]; x[i - 1] = x[i]; x[i] = t; return { d: Object.assign({}, s.d, { itens: x }), sujo: true }; }) };
      }),
      catNome: "Somente " + FAM[catFam], catTabs: [],
      catalogo: (CAT[catFam] || []).map((p, i) => {
        const tier = p.precos.some(x => x.min != null);
        const pad = (tier ? this.faixaPara(p, p.qtd) : null) || p.precos.find(x => x.padrao) || p.precos[0];
        /* Cada clique é uma linha nova: o mesmo produto entra quantas vezes for preciso, uma por
           variante, com quantidade, valor e desconto próprios. A conta do preço sai do estado mais
           novo (não do render), para dois cliques seguidos não nascerem na mesma variante. O catálogo fica
           aberto depois de adicionar: quem lança várias linhas do mesmo produto não reabre a lista a cada uma. */
        const nLinhas = d.itens.filter(x => x.prod === p.id).length;
        const addPr = (pr, q) => this.setState(s => ({ d: Object.assign({}, s.d, { itens: s.d.itens.concat(this.novoItem(p, pr || precoDaNovaLinha(p, s.d.itens, pad), q)) }), sujo: true, catAberto: true }));
        const ja = nLinhas > 0;
        const menor = p.precos.reduce((a, x) => (x.v < a.v ? x : a), p.precos[0]);
        const varios = p.precos.length > 1;
        const ints = p.precos.map(x => IL[x.int]).filter((x, k, a) => a.indexOf(x) === k);
        return { nome: p.nome, desc: p.desc, nPrecos: p.precos.length + (varios ? " preços" : " preço"),
          preco: varios ? p.precos.length + " variações" : brlP(p, menor),
          precoSub: ja ? nLinhas + (nLinhas > 1 ? " itens" : " item") + " na proposta · troque a variação no item" : tier ? p.precos.length + " faixas por quantidade" : varios ? ints.join(" · ") : ints[0],
          dica: ja ? "Adicionar mais uma linha deste produto (outra variante, quantidade ou valor)" : "Adicionar à proposta",
          addD: "M12 5v14M5 12h14",
          add: () => { addPr(null); this.diz(p.nome + (ja ? ": mais uma linha adicionada" : " adicionado"), "ok"); },
          addStyle: "flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;" + (ja ? "background:#e6f4ee;color:#1f7256" : "background:#12171d;color:#fff"),
          linha: "display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:10px 16px;border:0;text-align:left;cursor:pointer;background:" + (ja ? "#fafafa" : "#fff") + ";" + (i ? "border-top:1px solid #f1f3f3" : ""),
          hover: "background:#f6f6f3",
          precos: p.precos.map(pr => { const on = d.itens.some(x => x.prod === p.id && x.preco === pr.id); let dd = pr.d; const il = IL[pr.int]; if (dd.indexOf(il) === 0) dd = dd.slice(il.length).replace(/^\s*·\s*/, "").trim();
            if (tier) dd = dd.replace(/^Faixa \d+ · /, "");
            return { int: il, valor: brlP(p, pr), d: dd, temD: !!dd, padrao: pr.padrao && p.precos.length > 1 && !tier,
              natStyle: "display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:5px;font-size:10.5px;font-weight:700;" + (NATC[this.natDe(p, pr)] || NATC.ONE_TIME),
              style: "display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px 0 4px;border-radius:7px;border:0;cursor:pointer;font-size:11.5px;white-space:nowrap;background:" + (on ? "#fafafa" : "#fff") + ";box-shadow:inset 0 0 0 1px " + (on ? "#12171d" : "#e3e7e8"),
              onClick: () => addPr(pr, tier ? Math.max(pr.min || 1, pr.min === 1 ? p.qtd : pr.min) : undefined) }; })
        };
      }),
      /* O seletor em sanfona (Design System): o produto abre e o vendedor escolhe a variação ANTES
         de a linha nascer. A linha entra com quantidade 1 e o resto se ajusta no item, como antes. */
      seletorCatalogo: React.createElement(SeletorCatalogo, {
        familia: FAM[catFam],
        produtos: CAT[catFam] || [],
        noProposta: d.itens.reduce((m, x) => { if (x.preco) m[x.preco] = (m[x.preco] || 0) + 1; return m; }, {}),
        onAdicionar: (prodId, precoId) => {
          const p = (CAT[catFam] || []).find(x => x.id === prodId); const pr = p && p.precos.find(x => x.id === precoId);
          if (!p || !pr) return;
          this.setState(s => ({ d: Object.assign({}, s.d, { itens: s.d.itens.concat(this.novoItem(p, pr, 1)) }), sujo: true, catAberto: true }));
          this.diz(p.nome + (p.precos.length > 1 ? " · " + (pr.variacao || pr.d) : "") + " adicionado", "ok");
        }
      }),
      addLivre: () => this.setState(s => ({ d: Object.assign({}, s.d, { itens: s.d.itens.concat({ nome: "", desc: "", natureza: "ONE_TIME", valor: "", qtd: "1" }) }), sujo: true }))
    };

    // passo 3
    const stp = (k, min, max, suf, pas) => { const v = n(d[k]); const p = pas || 1; return { v: d[k], suf,
      set: (e) => up({ [k]: e.target.value.replace(/\D/g, "").slice(0, 3) }),
      menos: () => up({ [k]: String(Math.max(min, v - p)) }), mais: () => up({ [k]: String(max != null ? Math.min(max, v + p) : v + p) }) }; };
    const fimTeste = new Date(hoje.getTime() + c.tDias * 864e5);
    const INICIOS = (c.teste ? [["teste", "Depois do teste"]] : []).concat([["assinatura", d.fechamento === "contrato" ? "Na assinatura do contrato" : "No pagamento"], ["implantacao", "Após a implantação"], ["data", "Data específica"]]);
    const iniAtual = INICIOS.find(x => x[0] === d.inicio) || INICIOS[0];
    const PRAZOS = [["0", "Na aceitação"], ["15", "Em 15 dias"], ["30", "Em 30 dias"], ["custom", "Personalizado"]];
    const ehWl = d.familia === "WHITE_LABEL";
    const REAJ = [["IPCA", "IPCA"], ["IGP-M", "IGP-M"], ["nenhum", "Sem reajuste"]];
    const f2 = {
      teste: c.teste, bolaT,
      toggleTeste: () => up({ teste: !d.teste, inicio: !d.teste ? "teste" : (d.inicio === "teste" ? "assinatura" : d.inicio) }),
      testeTrilho: trilho(c.teste),
      testeSub: c.teste ? c.tDias + " dias grátis · primeira cobrança em " + fmtD(fimTeste) : "O cliente usa antes de pagar. A cobrança só começa quando o teste termina.",
      testeCard: "padding:14px;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 " + (c.teste ? "1.5px #12171d" : "1px #e3e7e8"),
      testeDias: [7, 14, 30].map(v => ({ label: v + " dias", style: seg(c.tDias === v) + ";flex:1", onClick: () => up({ testeDias: String(v) }) })),
      stTeste: stp("testeDias", 1, 90, "dias"),
      testeNota: "Ao aceitar, o cliente cadastra " + ({ cartao: "o cartão", boleto: "os dados de cobrança", pix: "os dados de cobrança" }[d.forma] || "o pagamento") + ". O Stripe cria a assinatura em teste e só cobra em " + fmtD(fimTeste) + (c.unico ? ". O setup segue a regra abaixo." : "."),
      temSetup: c.unico > 0, setupTotal: brl(c.unicoLiq),
      setupFormas: [["vista", "À vista"], ["parcelado", "Parcelado"]].map(([v, l]) => ({ label: l, style: seg((d.setupForma || "vista") === v) + ";flex:1;height:32px", onClick: () => up({ setupForma: v, parcelas: v === "parcelado" && n(d.parcelas) < 2 ? "3" : d.parcelas }) })),
      parcelado: d.setupForma === "parcelado", stParc: stp("parcelas", 2, 12, "vezes"), parcTxt: c.parc + "x de " + brl(c.unicoLiq / c.parc),
      prazo: d.prazo, prazoLabel: d.prazo === "custom" ? (d.prazoData ? "Em " + d.prazoData.split("-").reverse().join("/") : "Escolha a data") : (PRAZOS.find(x => x[0] === d.prazo) || PRAZOS[0])[1],
      temPrazoData: d.prazo === "custom", prazoData: d.prazoData || "", setPrazoData: (e) => up({ prazoData: e.target.value }),
      prazoDataStyle: "width:100%;height:38px;margin-top:8px;padding:0 10px;border-radius:9px;border:0;outline:0;background:#fff;font-size:13px;color:#12171d;box-shadow:inset 0 0 0 1px " + (tentou[2] && d.prazo === "custom" && !d.prazoData ? "#d93c1a" : "#dbdede"),
      temTeste: !ehWl, naoWl: !ehWl, ehWl, vencLabel: ehWl ? "Vencimento das ativações" : "Vencimento", prazos: PRAZOS.map(([v, l]) => ({ v, l })), setPrazo: (e) => up({ prazo: e.target.value }),
      recTotal: c.mrr || c.anual ? brl(c.mrrLiq) + "/mês" + (c.anual ? " + " + brl(c.anualLiq) + "/ano" : "") : c.res ? "por ativação" : "—",
      inicio: iniAtual[0], inicioLabel: iniAtual[1], inicios: INICIOS.map(([v, l]) => ({ v, l })), setInicio: (e) => up({ inicio: e.target.value }),
      stDia: Object.assign(stp("dia", 1, 28, "do mês"), {}),
      vencTxt: "Todo dia " + n(d.dia),
      vencAtalhos: [5, 10, 20, 30].map(v => ({ label: "Dia " + v, cal: false, style: seg(n(d.dia) === v && !S.calVenc) + ";flex:1;min-width:0", onClick: () => { this.setState({ calVenc: false }); up({ dia: String(v) }); } }))
        .concat([{ label: [5, 10, 20, 30].indexOf(n(d.dia)) < 0 ? "Dia " + n(d.dia) : "Outro", cal: true, style: seg(S.calVenc || [5, 10, 20, 30].indexOf(n(d.dia)) < 0) + ";flex:1;min-width:0", onClick: () => this.setState(s => ({ calVenc: !s.calVenc })) }]),
      calAberto: !!S.calVenc,
      calDias: Array.from({ length: 31 }, (_, k) => { const v = k + 1, on = n(d.dia) === v; return { n: String(v), onClick: () => { this.setState({ calVenc: false }); up({ dia: String(v) }); },
        style: "height:32px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;font-variant-numeric:tabular-nums;font-weight:" + (on ? "700;background:#12171d;color:#fff" : "500;background:transparent;color:#1f252c"),
        hover: on ? "background:#12171d" : "background:#f1f3f3" }; }),
      stFid: Object.assign(stp("fidelidade", 0, 60, n(d.fidelidade) ? "meses" : "sem", 6), {}),
      reajuste: d.reajuste, reajLabel: (REAJ.find(x => x[0] === d.reajuste) || REAJ[0])[1], reajustes: REAJ.map(([v, l]) => ({ v, l })), setReajuste: (e) => up({ reajuste: e.target.value }),
      temData: d.inicio === "data", data: d.dataInicio, setData: (e) => up({ dataInicio: e.target.value }),
      aprovacao: precisaAprov, aprovTxt: "Desconto de " + c.pctEf.toFixed(1).replace(".", ",") + "% nos itens · acima de 15% vai para o gestor",
      justif: d.desc.justif, setJustif: (e) => upD({ justif: e.target.value }),
      justifStyle: "width:100%;margin-top:8px;padding:9px 11px;border-radius:9px;border:0;outline:0;resize:vertical;background:#fff;font-size:12.5px;line-height:1.5;color:#12171d;box-shadow:inset 0 0 0 1px " + (tentou[2] && !v2 ? "#d93c1a" : "#f0d5cf"),
      obs: d.obs, setObs: (e) => up({ obs: e.target.value })
    };
    const resumoKpi = [
      { label: "Mensalidade", valor: brl(c.mrrLiq), sub: c.res ? "+ até " + brl(c.resLiq) + " em licenças" : c.anual ? "+ " + brl(c.anualLiq) + "/ano" : c.dm ? "de " + brl(c.mrr) : c.teste ? "após " + c.tDias + " dias de teste" : "recorrente", valorStyle: "display:block;margin-top:3px;font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap" },
      { label: "Setup e únicos", valor: brl(c.unicoLiq), sub: c.parc > 1 ? c.parc + "x de " + brl(c.unicoLiq / c.parc) : "uma vez", valorStyle: "display:block;margin-top:3px;font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap" },
      { label: c.fid ? "Total em " + c.fid + " meses" : "Total em 12 meses", valor: brl(c.totalContrato), sub: c.uso ? "+ uso sob demanda" : "valor do contrato", valorStyle: "display:block;margin-top:3px;font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:700;color:#ff8a70;font-variant-numeric:tabular-nums;white-space:nowrap" }
    ];

    // passo 4
    const recF = d.familia === "CALLFACE_AI" ? "checkout" : "contrato";
    const MODELOS = [
      ["checkout", "Pagamento direto", "Aceitou, paga pelo checkout do Stripe. O pagamento confirmado marca a oportunidade como ganha.", recF === "checkout" ? "Recomendado" : ""],
      ["contrato", "Com contrato", "Aceitou, assina o contrato. A assinatura marca como ganha e o Stripe cria a cobrança em seguida. Use para condição especial, fidelidade ou desconto negociado.", recF === "contrato" ? "Recomendado" : ""]
    ];
    const FORMAS = [["cliente", "Cliente escolhe", "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"], ["boleto", "Boleto", "M3 5h2v14H3zM7 5h1v14H7zM10 5h2v14h-2zM14 5h1v14h-1zM17 5h1v14h-1zM20 5h1v14h-1z"], ["cartao", "Cartão", "M2 5h20v14H2zM2 10h20M6 15h4"]];
    const FM = d.forma === "cliente" ? "Boleto ou cartão" : (FORMAS.find(x => x[0] === d.forma) || [0, "—"])[1];
    const setupTxt = c.unico ? "Setup " + (c.parc > 1 ? "em " + c.parc + "x" : "à vista") : "";
    const recTxt = c.teste ? "Assinatura em teste até " + fmtD(new Date(hoje.getTime() + c.tDias * 864e5)) : "Mensalidade " + ({ assinatura: d.fechamento === "contrato" ? "a partir da assinatura" : "a partir do pagamento", implantacao: "após a implantação", data: d.dataInicio ? "a partir de " + d.dataInicio.split("-").reverse().join("/") : "em data a definir", teste: "após o teste" }[d.inicio] || "");
    const fluxos = {
      contrato: [["Cliente aceita a proposta", "Pelo link, com data, hora e IP"], ["Contrato gerado automaticamente", "Documenso monta o documento com os dados congelados da v" + d.versao], ["Cliente é levado para assinar", (d.sigs.length || 0) + " signatário(s) do cliente + Callface · testemunha: " + (O.resp || "vendedor") + (d.testemunhas ? " e mais uma" : "")], ["Oportunidade ganha", "Evidência: contrato assinado"], ["Stripe cria a cobrança", [FM, setupTxt, recTxt].filter(Boolean).join(" · ")]],
      checkout: [["Cliente aceita a proposta", "Pelo link, com data, hora e IP"], ["Checkout do Stripe", c.teste ? "Cadastra " + FM.toLowerCase() + " · " + c.tDias + " dias de teste" : [FM, setupTxt].filter(Boolean).join(" · ")], ["Pagamento confirmado", c.teste ? "Método validado · " + recTxt.toLowerCase() : recTxt], ["Oportunidade ganha", "Empresa vira Cliente"]]
    }[d.fechamento];
    const ehAdt = d.fechamento === "contrato" && d.minuta === "aditivo";
    // ANTES: sem contrato real, inventava "Contrato nº CT-2xxx, assinado em 12/03/2026, MRR = 60% do valor" e oferecia aditivo/upgrade sobre ele. Sem contrato real, não há origem (semOrigem).
    const ORIGENS = O.contratoOrigem ? [O.contratoOrigem] : (empX.contratos && empX.contratos.length ? empX.contratos : []);
    const adtO = ORIGENS.find(x => x.id === d.adtOrigem) || ORIGENS[0] || null;
    const ALTS = [["upgrade", "Upgrade"], ["downgrade", "Downgrade"], ["inclusao", "Inclusão"], ["condicoes", "Condições"]];
    const TIPO_ROT = { nova: "Nova venda", expansao: "Expansão", upgrade: "Upgrade", renovacao: "Renovação" };
    const adtTipo = tipoOpp !== "nova" ? tipoOpp : "upgrade";
    const adtVig = d.adtVig || "ciclo";
    const hj = new Date(); const diaV = Math.min(28, n(d.dia) || 10);
    let proxV = new Date(hj.getFullYear(), hj.getMonth(), diaV); if (proxV <= hj) proxV = new Date(hj.getFullYear(), hj.getMonth() + 1, diaV);
    const restam = Math.max(1, Math.round((proxV - hj) / 864e5));
    const difM = adtO ? c.mrrLiq - adtO.mrr : 0;
    const prorata = Math.round(difM * restam / 30 * 100) / 100;
    const VIGS = [["ciclo", "No próximo ciclo", "O valor atual segue até " + fmtD(proxV) + ". O novo valor entra nesse vencimento, sem cobrança extra."],
      ["agora", "Agora, com pró-rata", "Ativa hoje. " + (difM >= 0 ? "Cobra " + brl(Math.abs(prorata)) + " proporcionais aos " + restam + " dias até " + fmtD(proxV) + "." : "Gera crédito de " + brl(Math.abs(prorata)) + " pelos " + restam + " dias até " + fmtD(proxV) + ".")]];
    const adtLinhas = adtO ? [["Hoje", brl(adtO.mrr) + "/mês"], ["Com o aditivo", brl(c.mrrLiq) + "/mês"], ["Diferença", (difM >= 0 ? "+ " : "− ") + brl(Math.abs(difM)) + "/mês", true]]
      .concat(adtVig === "agora" ? [[difM >= 0 ? "Pró-rata cobrado agora" : "Crédito no próximo ciclo", brl(Math.abs(prorata)), true]] : [["Primeira cobrança nova", fmtD(proxV)]]) : [];
    const f3 = {
      soContrato: d.familia !== "CALLFACE_AI", soContratoTxt: (d.familia === "PABX" ? "PABX" : "White Label") + " fecha sempre com contrato assinado.",
      formaNota: d.forma === "cliente" ? "No checkout do Stripe o cliente escolhe entre boleto e cartão." : "O checkout abre direto em " + FM.toLowerCase() + ".",
      vend: O.resp || "—", vendIni: ini(O.resp || ""), toggleVend: () => up({ vendAssina: d.vendAssina === false }), vendTrilho: trilho(d.vendAssina !== false), vendBola: bolaT,
      rep: d.repCf || this.eu, repIni: ini(d.repCf || this.eu), setRep: (e) => up({ repCf: e.target.value }),
      reps: [this.eu].concat((D.EQUIPE || [])).filter((x, i, a) => a.indexOf(x) === i).map(p => ({ v: p, l: p })),
      modelos: MODELOS.filter(m => d.familia === "CALLFACE_AI" || m[0] === "contrato").map(([v, l, s, tag]) => { const on = d.fechamento === v; return { label: l, sub: s, tag, radio: radio(on), onClick: () => up({ fechamento: v }),
        style: "display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:11px;border:0;cursor:pointer;text-align:left;background:#fff;box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #dbdede"),
        tagStyle: tag ? "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;background:#eeeff3;color:#4a5560;font-size:10.5px;font-weight:700;white-space:nowrap" : "display:none" }; }),
      temContrato: d.fechamento === "contrato",
      minuta: d.minuta, setMinuta: (e) => up({ minuta: e.target.value }),
      tipoTxt: tipoOpp !== "nova" ? TIPO_ROT[tipoOpp] + " · definido na oportunidade" : "Nova venda · definido na oportunidade",
      minutas: [["contrato", "Contrato " + FAM[d.familia], "Nova venda: contrato novo"], ["aditivo", "Aditivo contratual", TIPO_ROT[tipoOpp] + " do " + (adtO ? adtO.id : "contrato ativo") + ": altera o contrato e a assinatura atuais"]].filter(m => (tipoOpp === "nova") === (m[0] === "contrato")).map(([v, l, s]) => { const on = d.minuta === v; return { v, l, s,
        onClick: () => up({ minuta: v, adtOrigem: v === "aditivo" ? (d.adtOrigem || (ORIGENS[0] && ORIGENS[0].id) || "") : d.adtOrigem }), radio: radio(on), ver: (e) => { e.stopPropagation(); this.setState({ minutaVer: v }); },
        ico: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (on ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#4a5560"),
        style: "display:flex;align-items:center;gap:10px;width:100%;padding:8px;border-radius:10px;border:0;cursor:pointer;text-align:left;background:#fff;box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #e3e7e8") }; }),
      ehAditivo: ehAdt, semOrigem: !ORIGENS.length,
      origens: ORIGENS.map(og => { const on = adtO && adtO.id === og.id; return { t: og.titulo, s: "Assinado em " + og.assinado + " · " + brl(og.mrr) + "/mês hoje", radio: radio(on), onClick: () => up({ adtOrigem: og.id }),
        style: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;text-align:left;background:#fff;box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #e3e7e8") }; }),
      alteracoes: ALTS.map(([v, l]) => ({ label: l, style: seg(adtTipo === v) + ";flex:1;min-width:0", onClick: () => up({ adtTipo: v }) })),
      vigencias: VIGS.map(([v, l, s]) => { const on = adtVig === v; return { l, s, radio: radio(on), onClick: () => up({ adtVig: v }),
        style: "display:flex;align-items:flex-start;gap:10px;width:100%;padding:11px 12px;border-radius:10px;border:0;cursor:pointer;text-align:left;background:#fff;box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #e3e7e8") }; }),
      adtResumo: adtLinhas.map(([l, v, forte], i) => ({ l, v, style: "display:flex;align-items:center;gap:10px;padding:8px 0;font-size:12.5px;" + (i ? "border-top:1px solid #eef1f1;" : "") + (forte ? "font-weight:700;color:#12171d" : "color:#4a5560") })),
      adtNota: "Altera a assinatura que já existe no Stripe. Nenhuma assinatura nova é criada.",
      sigs: d.sigs.map((s, i) => ({ nome: s.nome, email: s.email,
        emailStyle: "height:34px;padding:0 10px;border-radius:8px;border:0;outline:0;background:#fff;font-size:12.5px;color:#12171d;min-width:0;box-shadow:inset 0 0 0 1px " + (tentou[3] && !mailOk(s.email) ? "#d93c1a" : "#dbdede"),
        setNome: (e) => { const v = e.target.value; this.setState(st => { const x = st.d.sigs.slice(); x[i] = Object.assign({}, x[i], { nome: v }); return { d: Object.assign({}, st.d, { sigs: x }), sujo: true }; }); },
        setEmail: (e) => { const v = e.target.value; this.setState(st => { const x = st.d.sigs.slice(); x[i] = Object.assign({}, x[i], { email: v }); return { d: Object.assign({}, st.d, { sigs: x }), sujo: true }; }); },
        remover: () => this.setState(st => ({ d: Object.assign({}, st.d, { sigs: st.d.sigs.filter((_, j) => j !== i) }), sujo: true })) })),
      addSig: () => this.setState(st => ({ d: Object.assign({}, st.d, { sigs: st.d.sigs.concat({ nome: "", email: "" }) }), sujo: true })),
      erroSig: !!tentou[3] && !v3,
      erroSigTxt: !(d.sigs.length > 0 && d.sigs.every(x => (x.nome || "").trim() && mailOk(x.email))) ? "Informe ao menos um signatário do cliente com e-mail válido" : !mailOk(cfE.rep.email) ? "Informe o representante legal da Callface com e-mail válido" : "Confira os e-mails das testemunhas",
      toggleTest: () => up({ testemunhas: !d.testemunhas }), testTrilho: trilho(d.testemunhas), testBola: bolaT,
      podeTest: !d.testemunhas, addTest: () => up({ testemunhas: true }),
      sigCf: (() => {
        // ANTES: montava "primeironome@callface.ai" e mostrava como e-mail do vendedor/representante; era chute. Sem e-mail real do usuário, fica vazio.
        const cf = d.sigCf || {}, pad = this.props.repPadrao || {};
        const linhas = [
          ["vend", "Testemunha · vendedor responsável", O.resp || "", O.respEmail || "", false],
          ["rep", "Representante legal", pad.nome || this.eu, pad.email || "", false]
        ];
        if (d.testemunhas) linhas.push(["test2", "Segunda testemunha", "", "", true]);
        return linhas.map(([k, papel, nomePad, mailPad, rem]) => {
          const cur = cf[k] || {};
          const nome = cur.nome != null ? cur.nome : nomePad;
          const email = cur.email != null ? cur.email : mailPad;
          const set = (patch) => up({ sigCf: Object.assign({}, cf, { [k]: Object.assign({}, cur, patch) }) });
          return { papel, nome, email, setNome: (e) => set({ nome: e.target.value }), setEmail: (e) => set({ email: e.target.value }),
            temReset: !rem && (cur.nome != null || cur.email != null) && (nome !== nomePad || email !== mailPad),
            reset: () => { const c2 = Object.assign({}, cf); delete c2[k]; up({ sigCf: c2 }); },
            removivel: rem, remover: () => { const c2 = Object.assign({}, cf); delete c2[k]; up({ sigCf: c2, testemunhas: false }); } };
        });
      })(),
      formas: FORMAS.map(([v, l, dd]) => { const off = false, on = d.forma === v; return { label: l, d: dd, dica: off ? "Checkout aceita só Pix e cartão" : "",
        onClick: () => !off && up({ forma: v }),
        style: "display:flex;flex-direction:row;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 10px;border-radius:11px;border:0;cursor:" + (off ? "not-allowed" : "pointer") + ";background:" + (off ? "#fafafa" : "#fff") + ";color:" + (off ? "#b8bdbb" : on ? "#12171d" : "#4a5560") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px " + (off ? "#eef1f1" : "#dbdede")) }; }),
      toggleAuto: () => up({ auto: !d.auto }), autoTrilho: trilho(d.auto), autoBola: bolaT,
      fluxoAberto: !!S.fluxoAberto, toggleFluxo: () => this.setState(s => ({ fluxoAberto: !s.fluxoAberto })),
      fluxoChev: "flex:0 0 auto;transition:transform .2s;transform:rotate(" + (S.fluxoAberto ? "180deg" : "0deg") + ")",
      fluxoResumo: fluxos.map(x => x[0].replace("Cliente aceita a proposta", "Aceite").replace("Contrato gerado automaticamente", "Contrato").replace("Cliente é levado para assinar", "Assinatura").replace("Oportunidade ganha", "Ganha").replace("Stripe cria a cobrança", "Cobrança").replace("Checkout do Stripe", "Checkout").replace("Pagamento confirmado", "Pagamento")).join(" → "),
      fluxo: fluxos.map(([t, s], i, a) => ({ n: String(i + 1), t, s, linha: "flex:1;width:1.5px;margin:3px 0;background:" + (i < a.length - 1 ? "#f3d9d1" : "transparent") }))
    };

    // dados do contrato
    const ctD = d.ct || {};
    const cidP = String(empX.cidade || "").split(/\s*[,\-–\/]\s*/);
    const EV = { razao: empX.razao || "", fantasia: empX.fantasia || O.empresa || "", cnpj: empX.cnpj || "", rua: empX.rua || "", bairro: empX.bairro || "", cep: empX.cep || "", cidade: empX.cidadeCob || cidP[0] || "", uf: empX.uf || (cidP[1] && cidP[1].length === 2 ? cidP[1].toUpperCase() : "") };
    const sig0 = (d.sigs && d.sigs[0]) || {};
    const sigNome = ctD.sigNome != null ? ctD.sigNome : (sig0.nome || d.contato || "");
    const pSig = (O.pessoas || []).find(p => p.nome === sigNome) || {};
    const SD = { sigNome, sigCargo: pessoas.indexOf(sigNome) >= 0 ? papelDe(sigNome) : "", sigEmail: sig0.nome === sigNome ? (sig0.email || "") : (pSig.email || ""), sigTel: pSig.telefone || (sigNome === O.pessoa && LD ? (LD.tel || LD.telefone || "") : ""), sigCpf: pSig.cpf || "",
      prazo: n(d.fidelidade) ? String(n(d.fidelidade)) : "", renov: "auto", aviso: "30", multa: "", dataBase: "Aniversário do contrato",
      prazoImpl: { CALLFACE_AI: "7", PABX: "15", WHITE_LABEL: "30" }[d.familia], inicioImpl: "assinatura", sla: "",
      escopo: { CALLFACE_AI: "Configuração da conta, agentes de IA, números e integrações padrão.", PABX: "Provisionamento de ramais, URA, filas, portabilidade de números e treinamento da equipe.", WHITE_LABEL: "Ambiente com marca própria, domínio, identidade visual, painel do parceiro e treinamento inicial." }[d.familia],
      especiais: d.obs || "" };
    const cv = (k) => ctD[k] != null ? ctD[k] : (EV[k] != null ? EV[k] : (SD[k] != null ? SD[k] : ""));
    const dg = (s) => String(s || "").replace(/\D/g, "");
    const setCt = (k, v, emp) => {
      this.setState(s => { const patch = { ct: Object.assign({}, s.d.ct || {}, { [k]: v }) };
        if (k === "sigNome" || k === "sigEmail") { const x = (s.d.sigs || []).slice(); x[0] = Object.assign({}, x[0] || {}, k === "sigNome" ? { nome: v } : { email: v }); patch.sigs = x; }
        return { d: Object.assign({}, s.d, patch), sujo: true }; });
      /* Uma fonte só: o que se digita aqui vai para a EMPRESA e para o CONTATO (portas de domínio, via
         props.salvarContrato), nunca fica só na proposta. Quem recebe agrupa e grava. */
      const salvar = this.props.salvarContrato;
      if (!salvar) return;
      const PK = { sigCargo: "cargo", sigEmail: "email", sigTel: "telefone", sigCpf: "cpf" };
      if (PK[k]) { const nomeS = k === "sigNome" ? v : cv("sigNome"); if (nomeS) salvar({ pessoa: { nome: nomeS, pessoaId: ((O.pessoas || []).find(p => p.nome === nomeS) || {}).id || null, [PK[k]]: v } }); }
      if (["razao", "cnpj", "rua", "bairro", "cep", "cidade", "uf"].indexOf(k) >= 0) salvar({ empresa: { [k]: v } });
    };
    const lic = d.itens.find(it => it.prod === "wl-lic");
    const descT = c.dm + c.du + c.da + (c.dr || 0);
    const INI_IMPL = [["assinatura", "Após a assinatura"], ["setup", "Após o pagamento do setup"], ["data", "Em data combinada"]];
    const RENOV = [["auto", "Automática, por igual período"], ["acordo", "Por acordo entre as partes"]];
    const quemOps = pessoas.map(p => ({ v: p, l: p + " · " + papelDe(p) })).concat([{ v: "__outro", l: "Outra pessoa" }]);
    // [chave, rótulo, fonte, tipo, obrigatório, validador, variável, largo, extra]
    const G = [
      ["emp", "Contratante", "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01", "da Empresa " + O.empresa, [
        ["razao", "Razão social", "Empresa", "in", true, null, "${Empresas.Razão Social}", true, { dica: "Nome jurídico, como no CNPJ" }],
        ["fantasia", "Nome fantasia", "Empresa", "in", false, null, "contratante.nome_fantasia"],
        ["cnpj", "CNPJ", "Empresa", "in", true, (v) => dg(v).length === 14, "${Empresas.CNPJ}", false, { dica: "00.000.000/0000-00", modo: "numeric" }],
        ["rua", "Endereço", "Empresa", "in", true, null, "${Empresas.Rua de cobrança}", true, { dica: "Rua, número e complemento" }],
        ["bairro", "Bairro", "Empresa", "in", true, null, "${Empresas.Bairro de cobrança}"],
        ["cep", "CEP", "Empresa", "in", true, (v) => dg(v).length === 8, "${Empresas.CEP de cobrança}", false, { dica: "00000-000", modo: "numeric" }],
        ["cidade", "Cidade", "Empresa", "in", true, null, "${Empresas.Cidade de cobrança}"],
        ["uf", "UF", "Empresa", "in", true, (v) => /^[A-Za-z]{2}$/.test(String(v || "").trim()), "${Empresas.Estado / UF de Cobrança}", false, { dica: "SP" }]
      ]],
      ["sig", "Signatário do contrato", "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z", "Quem assina pela empresa, não precisa ser o contato principal", [
        ["sigQuem", "Quem assina", "Contato", "sel", false, null, "", true, { opcoes: quemOps, valor: pessoas.indexOf(sigNome) >= 0 ? sigNome : "__outro" }],
        ["sigNome", "Nome completo", "Contato", "in", true, null, "signatario.nome"],
        ["sigCargo", "Cargo", "Contato", "in", true, null, "signatario.cargo"],
        ["sigEmail", "E-mail", "Contato", "in", true, (v) => mailOk(v), "signatario.email", false, { dica: "nome@empresa.com.br" }],
        ["sigTel", "Telefone", "Contato", "in", false, null, "signatario.telefone", false, { modo: "tel" }]
      ]],
      ...(ehAdt ? [["adt", "Aditivo", "M12 5v14M5 12h14", "Contrato de origem e como a alteração entra", [
        ["_orig", "Contrato de origem", "Proposta", "fixo", false, null, "${Aditivo.Contrato de origem}", true, { valor: adtO ? adtO.titulo + " · assinado em " + adtO.assinado : "—" }],
        ["_tipo", "Tipo de alteração", "Oportunidade", "fixo", false, null, "${Aditivo.Tipo}", false, { valor: TIPO_ROT[adtTipo] || "—" }],
        ["_vig", "Vigência da alteração", "Proposta", "fixo", false, null, "${Aditivo.Vigência}", false, { valor: adtVig === "agora" ? "Imediata, com pró-rata" : "No próximo ciclo (" + fmtD(proxV) + ")" }],
        ["_de", "Valor atual", "Proposta", "fixo", false, null, "${Aditivo.Valor anterior}", false, { valor: adtO ? brl(adtO.mrr) + "/mês" : "—" }],
        ["_para", "Novo valor", "Proposta", "fixo", false, null, "${Aditivo.Valor novo}", false, { valor: brl(c.mrrLiq) + "/mês" }]
      ]]] : []),
      ["obj", "Objeto e valores", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4", "Da proposta, atualiza sozinho", [
        ["_prod", "Produto", "Proposta", "fixo", false, null, "contrato.produto", false, { valor: FAM[d.familia] }],
        ["_qtd", lic ? "Licenças reservadas" : "Itens", "Proposta", "fixo", false, null, lic ? "${Itens Solicitados.Quantidade}" : "itens.quantidade", false, { valor: lic ? String(lic.qtd || 0) + " licenças" : d.itens.length + " itens" }],
        ["_itens", "Itens contratados", "Proposta", "fixo", false, null, "itens.lista", true, { valor: d.itens.filter(it => (it.nome || "").trim()).map(it => it.nome + (n(it.qtd) > 1 ? " × " + it.qtd : "")).join(" · ") || "—" }],
        ["_setup", "Setup", "Proposta", "fixo", false, null, "${Contratos.Total Setup}", false, { valor: c.unico ? brl(c.unicoLiq) : "Sem setup" }],
        ["_rec", ehWl ? "Preço por licença ativa" : "Recorrência", "Proposta", "fixo", false, null, ehWl ? "${Itens Solicitados.Preço de Lista}" : "contrato.recorrencia", false, { valor: ehWl && lic ? brl(n(lic.valor)) + "/mês" : brl(c.mrrLiq) + "/mês" + (c.anual ? " + " + brl(c.anualLiq) + "/ano" : "") }],
        ["_desc", "Descontos", "Proposta", "fixo", false, null, "contrato.descontos", false, { valor: descT ? "− " + brl(descT) : "Sem desconto" }],
        ["_total", "Total do contrato", "Proposta", "fixo", false, null, "${Contratos.Total Geral}", false, { valor: brl(c.totalContrato) }]
      ]],
      ["cob", "Cobrança", "M2 5h20v14H2zM2 10h20M6 15h4", "Das condições da proposta", [
        ["_forma", "Forma de pagamento", "Proposta", "fixo", false, null, "${Setup..Forma de pagamento}", false, { valor: FM }],
        ["_venc", ehWl ? "Vencimento das ativações" : "Vencimento", "Proposta", "fixo", false, null, "${Contratos.Vencimento}", false, { valor: "Todo dia " + d.dia }],
        ["_ini", "Início da cobrança", "Proposta", "fixo", false, null, "contrato.inicio_cobranca", false, { valor: iniAtual[1] }],
        ["_parc", "Setup", "Proposta", "fixo", false, null, "setup.parcelamento", false, { valor: c.unico ? (c.parc > 1 ? c.parc + "x de " + brl(c.unicoLiq / c.parc) : "À vista") : "Sem setup" }]
      ], { ir: 2, irTxt: "Ajustar em Condições" }],
      ["cond", "Condições contratuais", "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "Vigência, renovação, cancelamento e reajuste", [
        ["prazo", "Prazo contratual", "Contrato", "in", true, (v) => n(v) > 0, "${Contratos.Prazo Contrato (em meses)}", false, { dica: "Em meses", modo: "numeric", suf: "meses" }],
        ["renov", "Renovação", "Contrato", "sel", false, null, "contrato.renovacao", false, { opcoes: RENOV.map(([v, l]) => ({ v, l })) }],
        ["aviso", "Aviso prévio para cancelar", "Contrato", "in", true, (v) => n(v) > 0, "contrato.aviso_previo_dias", false, { dica: "Em dias", modo: "numeric" }],
        ["multa", "Multa rescisória", "Contrato", "in", true, (v) => n(v) > 0, "${Contratos.Percentual de Multa}", false, { dica: "% sobre o saldo", modo: "decimal" }],
        ["_reaj", "Índice de reajuste", "Proposta", "fixo", false, null, "contrato.reajuste_indice", false, { valor: d.reajuste === "nenhum" ? "Sem reajuste" : d.reajuste }],
        ["dataBase", "Data-base do reajuste", "Contrato", "in", false, null, "contrato.reajuste_data_base"]
      ]],
      ["impl", "Implantação", "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z", "Prazo, início e escopo", [
        ["prazoImpl", "Prazo previsto", "Contrato", "in", d.familia !== "CALLFACE_AI", (v) => n(v) > 0, "implantacao.prazo_dias", false, { dica: "Em dias úteis", modo: "numeric" }],
        ["inicioImpl", "Início", "Contrato", "sel", false, null, "implantacao.inicio", false, { opcoes: INI_IMPL.map(([v, l]) => ({ v, l })) }],
        ["escopo", "Escopo", "Contrato", "texto", false, null, "implantacao.escopo", true],
        ["sla", "SLA de atendimento", "Contrato", "in", false, null, "implantacao.sla", true, { dica: "Ex: primeira resposta em até 4h úteis" }]
      ]],
      ["esp", "Condições especiais", "M4 6h16M4 12h16M4 18h10", "Cláusulas negociadas nesta venda", [
        ["especiais", "Observações que entram no contrato", "Contrato", "texto", false, null, "contrato.condicoes_especiais", true, { dica: "Ex: carência de 30 dias no reajuste, desconto válido por 6 meses" }]
      ]],
      ["ass", "Assinatura", "M20 6 9 17l-5-5", "Quem assina e quando", [
        ["_pc", "Pelo cliente", "Contato", "fixo", false, null, "${Empresas.Razão Social}", false, { valor: sigNome || "—" }],
        ["_cf", "Pela Callface", "Proposta", "fixo", false, null, "contratada.representante", false, { valor: cfE.rep.nome || this.eu }],
        ["_test", "Testemunhas", "Proposta", "fixo", false, null, "contrato.testemunhas", false, { valor: (O.resp || "Vendedor") + (d.testemunhas ? " + segunda testemunha" : "") }],
        ["_data", "Data do contrato", "Contrato", "fixo", false, null, "${Contratos.Data de Envio do Contrato}", false, { valor: "Data em que o cliente aceitar" }],
        ["_cod", "Número do contrato", "Contrato", "fixo", false, null, "${Contratos.Código do Contrato}", true, { valor: "Gerado no aceite" }]
      ]]
    ];
    const FONTE = { Empresa: "da Empresa", Contato: "do Contato", Proposta: "da Proposta" };
    const ctPend = [];
    let ctReq = 0;
    const ctAb = S.ctAbertos || {};
    const ctGrupos = G.map(([gk, titulo, dd, sub, campos, extra]) => {
      let pendG = 0, fixos = 0;
      const cs = campos.map(([k, l, fonte, tipo, req, ok, vr, largo, x]) => {
        x = x || {};
        const v = tipo === "fixo" ? x.valor : tipo === "sel" && x.valor != null ? x.valor : cv(k);
        const vazio = !String(v == null ? "" : v).trim();
        const inval = !vazio && ok && !ok(v);
        const falta = req && (vazio || inval);
        if (req) ctReq++;
        if (falta) { pendG++; ctPend.push({ l, g: titulo, gk }); }
        if (tipo === "fixo") fixos++;
        const auto = tipo !== "fixo" && !vazio && ctD[k] == null && FONTE[fonte] && (EV[k] || SD[k]);
        const set = (e) => {
          const val = e.target.value;
          if (k === "sigQuem") {
            if (val === "__outro") return setCt("sigNome", "");
            this.setState(s => { const ctn = Object.assign({}, s.d.ct || {}, { sigNome: val, sigCargo: papelDe(val), sigEmail: val === (sig0.nome || "") ? (sig0.email || "") : "", sigTel: val === O.pessoa && LD ? (LD.tel || LD.telefone || "") : "", sigCpf: "" });
              const x2 = (s.d.sigs || []).slice(); x2[0] = Object.assign({}, x2[0] || {}, { nome: val, email: ctn.sigEmail }); return { d: Object.assign({}, s.d, { ct: ctn, sigs: x2 }), sujo: true }; });
            return;
          }
          setCt(k, x.modo === "numeric" && (k === "prazo" || k === "aviso" || k === "prazoImpl") ? val.replace(/\D/g, "").slice(0, 3) : val, fonte === "Empresa");
        };
        const bordaIn = falta ? (S.ctDoEnvio || tentou[4] ? "#d93c1a" : "#f0b8a8") : "#dbdede";
        return { l, v: v == null ? "" : String(v), req, set, dica: x.dica || "", modo: x.modo || "text", var: vr || "—",
          ehIn: tipo === "in", ehTexto: tipo === "texto", ehSel: tipo === "sel", ehFixo: tipo === "fixo",
          opcoes: x.opcoes || [], selLabel: ((x.opcoes || []).find(o => o.v === v) || { l: v })[1] || ((x.opcoes || []).find(o => o.v === v) || { l: "—" }).l,
          temTag: !!(falta || auto), tag: falta ? (inval ? "Inválido" : "Falta") : FONTE[fonte] || "",
          tagStyle: "flex:0 0 auto;font-size:10.5px;font-weight:600;white-space:nowrap;" + (falta ? "color:#c2330f" : "color:#8b949e"),
          wrap: "min-width:0;" + (largo ? "grid-column:1 / -1" : ""),
          inStyle: "width:100%;height:36px;padding:0 11px;border-radius:9px;border:0;outline:0;font-size:12.5px;font-weight:500;color:#12171d;background:" + (falta ? "#fffaf8" : "#fff") + ";box-shadow:inset 0 0 0 1px " + bordaIn,
          txStyle: "width:100%;padding:9px 11px;border-radius:9px;border:0;outline:0;resize:vertical;font-size:12.5px;line-height:1.5;color:#12171d;background:#fff;box-shadow:inset 0 0 0 1px #dbdede" };
      });
      const soFixo = fixos === cs.length;
      const aberto = ctAb[gk] != null ? ctAb[gk] : pendG > 0;
      return { titulo, d: dd, sub, campos: cs, aberto,
        toggle: () => this.setState(s => ({ ctAbertos: Object.assign({}, s.ctAbertos || {}, { [gk]: !aberto }) })),
        chev: "flex:0 0 auto;transition:transform .2s;transform:rotate(" + (aberto ? "180deg" : "0deg") + ")",
        badge: pendG ? pendG + (pendG > 1 ? " faltando" : " faltando") : soFixo ? "Automático" : "Completo",
        badgeStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;" + (pendG ? "background:#fff6f4;color:#9c3210" : soFixo ? "background:#eeeff3;color:#4a5560" : "background:#e6f4ee;color:#1f7256"),
        temIr: !!(extra && extra.ir != null), ir: () => extra && irPasso(extra.ir), irTxt: extra ? extra.irTxt : "" };
    });
    const ctOk = ctReq - ctPend.length;
    const precisaCt = d.fechamento === "contrato";
    const abrirCt = (doEnvio) => {
      const abrir = {}; ctPend.forEach(p => { abrir[p.gk] = true; });
      this.setState(s => ({ ctModal: false, ctAberto: true, ctDoEnvio: !!doEnvio, ctAbertos: Object.assign({}, s.ctAbertos || {}, abrir) }), () => requestAnimationFrame(() => { const sc = this.ctRef.current; if (sc) sc.scrollTop = 0; }));
    };
    const preencherCt = () => abrirCt(true);
    const ct = {
      precisa: precisaCt, aberto: !!S.ctAberto && precisaCt,
      abrir: () => abrirCt(false), fechar: () => this.setState({ ctAberto: false, ctDoEnvio: false }), parar: (e) => e.stopPropagation(),
      podeEnviar: !!S.ctDoEnvio && !ctPend.length, enviar: () => { this._enviarJa = true; this.setState({ ctAberto: false, ctDoEnvio: false }); },
      fecharTxt: ctPend.length ? "Continuar depois" : S.ctDoEnvio ? "Voltar" : "Concluir",
      rodape: ctPend.length ? "Falta " + ctPend.length + (ctPend.length > 1 ? " campos obrigatórios" : " campo obrigatório") + " para liberar o envio." : "Tudo pronto. O contrato será gerado no aceite.",
      cartaoSub: ctPend.length ? "Faltam " + ctPend.slice(0, 3).map(p => p.l.toLowerCase()).join(", ") + (ctPend.length > 3 ? " e mais " + (ctPend.length - 3) : "") + ". Complete antes de enviar." : "Dados validados. O contrato será gerado automaticamente quando o cliente aceitar.",
      cartao: "display:flex;align-items:center;gap:12px;width:100%;padding:14px;border-radius:12px;border:0;cursor:pointer;text-align:left;background:" + (ctPend.length ? "#fffaf8" : "#fff") + ";box-shadow:inset 0 0 0 1px " + (ctPend.length ? "#f6d3c9" : "#e3e7e8"),
      cartaoHover: "box-shadow:inset 0 0 0 1px " + (ctPend.length ? "#eeb9a8" : "#cfd4d6"),
      cartaoIco: "flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;" + (ctPend.length ? "background:#fff;color:#c2330f;box-shadow:inset 0 0 0 1px #f6d3c9" : "background:#e6f4ee;color:#1f7256"),
      cartaoD: ctPend.length ? "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 12v3M12 18h.01" : "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4",
      grupos: ctGrupos, verVars: !!S.ctVars, varsTxt: S.ctVars ? "Ocultar variáveis" : "Ver variáveis do modelo", toggleVars: () => this.setState(s => ({ ctVars: !s.ctVars })),
      status: ctPend.length ? ctPend.length + (ctPend.length > 1 ? " pendências" : " pendência") : "Pronto para gerar",
      statusStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;" + (ctPend.length ? "background:#fff6f4;color:#9c3210" : "background:#e6f4ee;color:#1f7256"),
      contagem: ctOk + " de " + ctReq + " obrigatórios",
      barra: "display:block;height:100%;border-radius:9999px;transition:width .4s cubic-bezier(.16,1,.3,1);width:" + Math.round(ctReq ? ctOk / ctReq * 100 : 100) + "%;background:" + (ctPend.length ? "#fe4f2b" : "#1f7256")
    };
    const MODS = {
      contrato: d.familia === "WHITE_LABEL" ? null : { titulo: "Contrato " + FAM[d.familia] },
      aditivo: { titulo: "Aditivo contratual", doc: "Termo aditivo ao " + (adtO ? adtO.titulo : "contrato de origem"), clausulas: ["Partes e contrato de origem", "Objeto do aditivo", "Itens e valores alterados", "Vigência e cobrança da alteração", "Ratificação das demais cláusulas", "Assinatura eletrônica"], nums: [1, 2, 3, 4, 5, 6] },
      revenda: { titulo: "Contrato White Label", doc: "Contrato de licenciamento, implantação e revenda White Label", clausulas: ["Objeto", "Definições", "Escopo da plataforma e funcionalidades incluídas", "Modelo White Label, marca, domínio e identidade visual", "Reserva de licenças, ativação e cobrança recorrente", "Setup e implantação", "Pagamento e inadimplência", "Não aliciamento", "Prazo, vigência, renovação e reajuste", "Disposições gerais", "Assinatura eletrônica", "Foro"], nums: [1, 2, 3, 4, 5, 6, 7, 16, 19, 22, 23, 24] },
      saas: { titulo: "Padrão SaaS · Callface AI" }, locacao: { titulo: "Locação e serviço · PABX" }
    };
    const MV = S.minutaVer ? (MODS[S.minutaVer] || (S.minutaVer === "contrato" ? MODS.revenda : null)) : null;
    const mv = !MV ? { aberto: false, clausulas: [], vars: [] } : {
      aberto: true, fechar: () => this.setState({ minutaVer: null }), parar: (e) => e.stopPropagation(),
      titulo: MV.titulo, temDoc: !!MV.doc, semDoc: !MV.doc,
      sub: MV.doc ? "Versão atual · " + MV.clausulas.length + " cláusulas principais" : "Sem documento cadastrado",
      docTitulo: MV.doc || "", clausulas: (MV.clausulas || []).map((t, i) => ({ n: String(MV.nums[i]), t })),
      vars: MV.doc ? ctGrupos.reduce((a, g) => a.concat(g.campos.map(cf => cf.var).filter(x => x && x.indexOf("${") === 0)), []).filter((x, i, a) => a.indexOf(x) === i).map(t => ({ t })) : [],
      usarTxt: d.minuta === S.minutaVer ? "Modelo em uso" : "Usar este modelo",
      usar: () => { up({ minuta: S.minutaVer }); this.setState({ minutaVer: null }); }
    };
    const ctm = !S.ctModal ? { aberto: false, itens: [] } : {
      aberto: true, fechar: () => this.setState({ ctModal: false }), parar: (e) => e.stopPropagation(), preencher: preencherCt,
      titulo: "Pendências (" + ctPend.length + ")",
      itens: ctPend.map((p, i) => ({ l: p.l, g: p.g, style: "display:flex;align-items:center;gap:10px;padding:10px 12px;" + (i ? "border-top:1px solid #eef1f1" : "") }))
    };

    // passo 5
    const props = O.propostas || [];
    const PROP = { rascunho: "Rascunho", enviada: "Enviada", visualizada: "Visualizada", ajuste_solicitado: "Ajuste solicitado", aceita: "Aceita", recusada: "Recusada", expirada: "Expirada", substituida: "Substituída" };
    const selo = (st) => "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;" + ({ rascunho: "background:#eeeff3;color:#4a5560", enviada: "background:#e8f0fb;color:#2c5f9e", visualizada: "background:#f7edd8;color:#6e5420", ajuste_solicitado: "background:#fff6f4;color:#9c3210", aceita: "background:#e6f4ee;color:#1f7256", recusada: "background:#fdeeea;color:#c2330f" }[st] || "background:#eeeff3;color:#8b949e");
    const pn = (d.contato || "").replace(/^Dr\.?\s+/, "").split(" ")[0] || "";
    const telCad = (LD && (LD.tel || LD.telefone)) || "";
    // ANTES: "propostas.callface.ai/p/<codigo>-v<versao>", endereço inexistente (rota real: /p/<id>). Sem id gravado, não há link.
    const linkP = d.id && typeof window !== "undefined" ? window.location.host + "/p/" + d.id : "";
    // Link que SAI da tela (copiar e WhatsApp) é a URL inteira, com o esquema: sem ele o app de mensagem não vira link clicável e, em localhost, "https://" apontava para um endereço que não existe.
    const linkAbs = d.id && typeof window !== "undefined" ? window.location.origin + "/p/" + d.id : "";
    const prodN = FAM[d.familia] || "";
    const assuntoPadrao = "Proposta " + d.titulo + " · #" + d.codigo + "-v" + d.versao;
    const introPadrao = "Olá, " + pn + "!\n\nConforme conversamos, preparei a proposta de " + prodN + " para a " + O.empresa + ". Abaixo está um resumo com os valores e as principais condições.\n\nNo link você vê todos os detalhes e pode aceitar a proposta ou pedir algum ajuste, se precisar. Qualquer dúvida, fico à disposição.";
    const waPadrao = "Oi, " + pn + "! Tudo bem? Aqui é " + ((O.resp || "").split(" ")[0] || "") + ", da Callface.\n\nAcabei de te enviar a proposta de " + prodN + " para a " + O.empresa + ":" + (linkAbs ? "\n" + linkAbs : "") + "\n\nPor lá você vê os valores e as condições, e pode aceitar ou pedir algum ajuste. A proposta vale até " + fmtD(valida) + ".\n\nQualquer dúvida, me chama por aqui!";
    const condE = [c.teste ? c.tDias + " dias de teste grátis antes da primeira cobrança" : null, c.unico ? "Setup " + (c.parc > 1 ? "em " + c.parc + "x de " + brl(c.unicoLiq / c.parc) : "à vista") : null, (ehWl ? "Ativações vencem" : "Mensalidade vence") + " todo dia " + d.dia, ehWl ? null : (c.fid ? "Fidelidade de " + c.fid + " meses" : "Sem fidelidade"), d.fechamento === "contrato" ? "Contrato com assinatura digital" : "Pagamento pelo checkout seguro do Stripe"].filter(Boolean);
    const addCc = (v) => { if (!mailOk(v)) return this.setState({ ccErro: true }); this.setState({ ccTxt: "", ccErro: false }); up({ cc: (d.cc || []).filter(x => x !== v).concat(v) }); };
    const msgPadrao = "Olá, " + ((d.contato || "").split(" ")[0] || "") + "! Segue a proposta " + d.titulo + " (#" + d.codigo + "-v" + d.versao + "), válida até " + fmtD(valida) + ". Qualquer dúvida, fico à disposição.\n\n" + O.resp + " · Callface";
    const f4 = {
      checks: [
        [v0, "Dados da proposta", v0 ? d.titulo + " · " + FAM[d.familia] + " · " + d.validade + " dias" : "Falta nome, produto ou contato", 0],
        [v1, "Itens e valores", v1 ? d.itens.length + " itens · " + brl(c.mrrLiq) + "/mês + " + brl(c.unicoLiq) : "Há itens sem nome, quantidade ou valor", 1],
        [v2, "Condições comerciais", precisaAprov ? (v2 ? "Desconto de " + c.pctEf.toFixed(1).replace(".", ",") + "% · vai para aprovação" : "Desconto acima de 15% sem justificativa") : ((c.dm + c.du) ? "Desconto de " + c.pctEf.toFixed(1).replace(".", ",") + "%" : "Sem desconto") + " · fidelidade " + (c.fid ? c.fid + " meses" : "sem"), 2],
        [v3, "Contrato e pagamento", v3 ? MODELOS.find(x => x[0] === d.fechamento)[1] + " · " + FORMAS.find(x => x[0] === d.forma)[1] : "Signatário sem nome ou e-mail válido", 3],
        ...(precisaCt ? [[!ctPend.length, "Dados do contrato", ctPend.length ? ctPend.length + " pendências: " + ctPend.slice(0, 3).map(p => p.l.toLowerCase()).join(", ") + (ctPend.length > 3 ? "…" : "") : "Pronto para gerar no aceite · " + ctReq + " campos obrigatórios", "ct"]] : []),
        [v4, "Envio", v4 ? (canaisSel.length ? canaisSel.map(x => x === "email" ? d.para + ((d.cc || []).length ? " + " + d.cc.length + " em cópia" : "") : "WhatsApp " + d.wa).join(" · ") : "Só o link") : "Confira o e-mail e o WhatsApp do contato", 4]
      ].map(([ok, t, s, k], i) => ({ t, s, onClick: () => k === "ct" ? abrirCt(false) : irPasso(k), d: ok ? "M20 6 9 17l-5-5" : "M12 8v5M12 17h.01",
        bola: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;" + (ok ? "background:#e6f4ee;color:#1f7256" : "background:#fdeeea;color:#c2330f"),
        subStyle: "display:block;font-size:11.5px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (ok ? "#67787c" : "#c2330f"),
        linha: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:0;background:#fff;cursor:pointer;text-align:left;" + (i ? "border-top:1px solid #eef1f1" : "") })),
      canais: [["email", "E-mail", "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6", d.para || "sem e-mail"], ["whatsapp", "WhatsApp", "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", d.wa || "sem número"]].map(([v, l, dd, sub]) => { const on = canaisSel.indexOf(v) >= 0; return { label: l, d: dd, sub,
        style: "display:flex;align-items:center;gap:10px;min-width:0;padding:10px 12px 10px 10px;border-radius:11px;border:0;cursor:pointer;text-align:left;background:#fff;box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #dbdede"),
        ico: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (on ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#4a5560"),
        check: "flex:0 0 auto;width:18px;height:18px;border-radius:5px;display:grid;place-items:center;" + (on ? "background:#12171d;color:#fff" : "box-shadow:inset 0 0 0 1.5px #cfd4d6;color:transparent"),
        onClick: () => up({ canais: on ? canaisSel.filter(x => x !== v) : canaisSel.concat(v), para: v === "email" && !d.para ? email : d.para }) }; }),
      temEmail: canaisSel.indexOf("email") >= 0, temWa: canaisSel.indexOf("whatsapp") >= 0, soLink: !canaisSel.length,
      link: linkP, linkRot: canaisSel.length ? "Link da proposta · vai junto na mensagem" : "Link da proposta · envie por onde preferir",
      copiar: () => { if (!linkAbs) return this.diz("Ainda não há link público para esta proposta", "info"); try { navigator.clipboard.writeText(linkAbs); } catch (e) {} this.diz("Link copiado", "ok"); },
      para: d.para, setPara: (e) => up({ para: e.target.value }), paraStyle: inp(tentou[4] && !mailOk(d.para)),
      cc: (d.cc || []).map((m, i) => ({ m, remover: () => up({ cc: (d.cc || []).filter((_, k) => k !== i) }) })),
      ccTxt: S.ccTxt || "", setCc: (e) => this.setState({ ccTxt: e.target.value, ccErro: false }),
      ccDica: (d.cc || []).length ? "Adicionar outro" : "Digite um e-mail e aperte Enter",
      ccBorda: "inset 0 0 0 1px " + (S.ccErro ? "#d93c1a" : "#dbdede"),
      teclaCc: (e) => { const v = (S.ccTxt || "").trim().replace(/,$/, ""); if ((e.key === "Enter" || e.key === ",") && v) { e.preventDefault(); addCc(v); } else if (e.key === "Backspace" && !S.ccTxt && (d.cc || []).length) up({ cc: d.cc.slice(0, -1) }); },
      blurCc: () => { const v = (S.ccTxt || "").trim(); if (v) addCc(v); },
      assunto: d.assunto || assuntoPadrao, setAssunto: (e) => up({ assunto: e.target.value }),
      intro: d.intro || introPadrao, setIntro: (e) => up({ intro: e.target.value }),
      prevAberto: !!S.prevEmail, togglePrev: () => this.setState(s => ({ prevEmail: !s.prevEmail })), prevTxt: S.prevEmail ? "Ocultar como o cliente recebe" : "Ver como o cliente recebe",
      emailCod: "#" + d.codigo + "-v" + d.versao, emailTitulo: d.titulo,
      emailKpis: [[ehWl && !c.mrr ? "Licenças" : "Mensalidade", ehWl && !c.mrr ? "Por ativação" : brl(c.mrrLiq) + "/mês"], ["Setup", c.unico ? brl(c.unicoLiq) : "Sem setup"], ["Válida até", fmtD(valida)]].map(([l, v], i) => ({ l, v, style: "min-width:0;padding:10px 14px;" + (i ? "box-shadow:inset 1px 0 0 #eef1f1" : "") })),
      emailCond: condE.map(t => ({ t })),
      emailValida: "Proposta válida até " + fmtD(valida) + ". Qualquer dúvida, é só responder este e-mail.",
      assNome: O.resp || "", assIni: ini(O.resp || ""), assCargo: "Executivo comercial · Callface",
      wa: d.wa || "", setWa: (e) => up({ wa: e.target.value }), waContato: d.contato || "Contato", waIni: ini(pn),
      waBorda: "inset 0 0 0 1px " + (tentou[4] && (d.wa || "").replace(/\D/g, "").length < 10 ? "#d93c1a" : "#dbdede"),
      waDoCadastro: !!telCad && (d.wa || "") === telCad,
      msgWa: d.msgWa || waPadrao, setMsgWa: (e) => up({ msgWa: e.target.value }),
      temVersoes: props.length > 0,
      versoes: props.map((p, i) => { const t = (p.itens || []).reduce((a, it) => a + (+it.valor || 0) * (+it.qtd || 1) * (it.natureza === "USAGE" ? 0 : 1), 0); return { codigo: "#" + p.codigo + "-v" + (p.versao || 1), status: PROP[p.status] || p.status, statusStyle: selo(p.status),
        codStyle: "font-size:12.5px;font-weight:600;color:#12171d;font-variant-numeric:tabular-nums;white-space:nowrap", meta: (p.enviadaEm ? "enviada " + p.enviadaEm : "") + (i === S.idx ? " · esta versão" : ""), total: brl(t),
        linha: "display:flex;align-items:center;gap:10px;padding:9px 12px;" + (i ? "border-top:1px solid #eef1f1" : "") }; })
    };

    // preview
    const sec = (k) => "border-radius:10px;transition:box-shadow .2s;" + (!S.cliente && !S.enviado && !S.estreito && S.passo === k ? "box-shadow:0 0 0 6px #fff,0 0 0 7px #f3c9bd" : "");
    const grupos = [["LIC", "Licenças · cobradas só quando ativadas"], ["MRR", "Mensalidade"], ["ARR", "Anuidade"], ["SETUP|ONE_TIME|HARDWARE", "Implantação e itens únicos"], ["USAGE", "Sob demanda"]].map(([ks, label]) => {
      const its = d.itens.filter(it => (it.nome || "").trim() && (ks === "LIC" ? it.prod === "wl-lic" : it.prod !== "wl-lic" && ks.split("|").indexOf(it.natureza) >= 0));
      return { label, itens: its.map(it => { const P = it.prod ? this.prodDe(it.prod) : null; const PR = P ? P.precos.find(x => x.id === it.preco) : null; const ds = [it.desc, PR && P.precos.length > 1 ? PR.d : ""].filter(Boolean).join(" · "); return { nome: it.nome, desc: ds, temDesc: !!ds, qtd: it.qtd || "1",
        unit: it.natureza === "USAGE" ? "R$ " + String(it.valor || "0") + "/un." : brl(n(it.valor)), sub: it.natureza === "USAGE" ? "sob demanda" : it.prod === "wl-lic" ? brl((n(it.valor) * (n(it.qtd) || 0) - this.descItem(it, n(it.valor) * (n(it.qtd) || 0))) / (n(it.qtd) || 1)) + "/licença ativa" : brl(n(it.valor) * (n(it.qtd) || 0) - this.descItem(it, n(it.valor) * (n(it.qtd) || 0))) + (it.natureza === "MRR" ? "/mês" : it.natureza === "ARR" ? "/ano" : "") }; }), tem: its.length > 0 };
    }).filter(g => g.tem);
    const inicioTxt = { teste: "Após o teste", assinatura: d.fechamento === "contrato" ? "Na assinatura" : "No pagamento", implantacao: "Após a implantação", data: d.dataInicio ? d.dataInicio.split("-").reverse().join("/") : "A definir" }[d.inicio];
    const finLinha = (l, v, forte, cor) => ({ l, v, style: "display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:11.5px;" + (forte ? "font-weight:700;color:#12171d;border-top:1px solid #eef1f1;margin-top:4px;padding-top:7px" : "color:" + (cor || "#4a5560")) });
    const pv = {
      sec0: sec(0), sec1: sec(1), sec2: sec(2), sec3: sec(3), sec4: sec(4),
      titulo: d.titulo || "Proposta sem título", familia: FAM[d.familia] + " · " + O.empresa,
      meta: [["Proposta nº", d.codigo + "-v" + d.versao], ["Emissão", fmtD(hoje)], ["Validade", d.validade + " dias"], ["Válida até", fmtD(valida)]].map(([l, v]) => ({ l, v })),
      empresa: O.empresa, empresaSub: [empX.cnpj ? "CNPJ " + empX.cnpj : "", (LD && LD.segmento) || ""].filter(Boolean).join(" · ") || "Cliente",
      contato: d.contato || "—", contatoSub: [(O.pessoa === d.contato ? O.cargo : ((O.pessoas || []).find(p => p.nome === d.contato) || {}).papel) || "", email].filter(Boolean).join(" · "),
      grupos, semItens: !grupos.length,
      condicoes: [].concat(c.teste ? [["Período de teste", c.tDias + " dias grátis · 1ª cobrança em " + fmtD(new Date(hoje.getTime() + c.tDias * 864e5))]] : []).concat([
        ["Desconto", (c.dm + c.du + c.da + c.dr) ? c.pctEf.toFixed(1).replace(".", ",") + "% aplicado nos itens" : "Sem desconto"],
        ["Setup", c.unico ? (c.parc > 1 ? c.parc + "x de " + brl(c.unicoLiq / c.parc) : "À vista") + " · " + (d.prazo === "custom" ? (d.prazoData ? "em " + d.prazoData.split("-").reverse().join("/") : "em data a definir") : ({ "0": "na aceitação", "15": "em 15 dias", "30": "em 30 dias" }[d.prazo] || "na aceitação")) : "Sem setup"],
        ehWl && !c.mrr ? ["Ativações", c.res ? "Vencem todo dia " + d.dia + ", por licença ativa" : "Sem licenças nesta proposta"] : ["Mensalidade", "Vence todo dia " + d.dia + " · início " + (inicioTxt || "").toLowerCase()],
        ["Fidelidade", c.fid ? c.fid + " meses" : "Sem fidelidade"],
        ["Reajuste", d.reajuste === "nenhum" ? "Sem reajuste" : "Anual pelo " + d.reajuste]
      ]).map(([l, v]) => ({ l, v })),
      fin: (ehWl && c.res > 0 ? (() => { const L = d.itens.find(it => it.prod === "wl-lic") || {}; const q = n(L.qtd) || 0; const u = q ? c.resLiq / q : 0;
          return [finLinha("Por licença ativa", brl(u) + "/mês", true), finLinha("Licenças reservadas", String(q)), finLinha("Se todas ativas", "até " + brl(c.resLiq) + "/mês", false, "#67787c")].concat(c.mrr ? [finLinha("Mensalidade fixa", brl(c.mrrLiq) + "/mês")] : [finLinha("Mensalidade hoje", "R$ 0,00", false, "#1f7256")]); })()
        : [finLinha("Mensalidade", brl(c.mrr) + "/mês")].concat(c.dm ? [finLinha("Desconto na mensalidade", "− " + brl(c.dm), false, "#c2330f")] : [])
        .concat([finLinha("Mensalidade final", brl(c.mrrLiq) + "/mês", true)])
        .concat(c.res ? [finLinha("Licenças reservadas", "até " + brl(c.resLiq) + "/mês", false, "#67787c")] : []))
        .concat(c.anual ? [finLinha("Anuidade", brl(c.anual) + "/ano")].concat(c.da ? [finLinha("Desconto na anuidade", "− " + brl(c.da), false, "#c2330f")] : []) : [])
        .concat([finLinha("Setup e únicos", brl(c.unico))])
        .concat(c.du ? [finLinha("Desconto no setup", "− " + brl(c.du), false, "#c2330f")] : [])
        .concat(c.uso ? [finLinha("Uso sob demanda", "conforme consumo", false, "#8b949e")] : [])
        .concat([finLinha("Primeiro pagamento", brl(c.primeiro), true)]),
      ...(() => {
        const wl = ehWl && !c.mrr;
        const bruto = wl ? c.unico : c.mrr + c.unico, liq = wl ? c.unicoLiq : c.mrrLiq + c.unicoLiq;
        const partes = wl ? ["setup"] : [c.mrr ? "1ª mensalidade" : null, c.unico ? "setup" : null].filter(Boolean);
        return { totalLabel: wl ? "Para começar" : "Valor da proposta", total: brl(liq),
          temTotalBruto: bruto - liq > 0.005, totalBruto: brl(bruto),
          totalSub: (partes.length ? partes.join(" + ").replace(/^./, x => x.toUpperCase()) + " · " : "") + (bruto - liq > 0.005 ? "com desconto, " : "") + "válido até " + fmtD(valida) };
      })(),
      temObs: !!(d.obs || "").trim(), obs: d.obs,
      fecho: [["Modelo", MODELOS.find(x => x[0] === d.fechamento)[1]], ["Pagamento", "Stripe · " + FORMAS.find(x => x[0] === d.forma)[1] + (c.teste ? " · " + c.tDias + " dias de teste" : "") + (d.auto ? " · recorrência automática" : "")], ["Contrato", d.fechamento === "contrato" ? (ehAdt ? "Aditivo ao " + (adtO ? adtO.id : "contrato") + " · " + (adtVig === "agora" ? "vale agora, com pró-rata" : "vale no próximo ciclo") : "Contrato " + FAM[d.familia] + " · " + d.sigs.length + " signatário(s)") : "Sem contrato"]].map(([l, v]) => ({ l, v })),
      assCliente: d.contato || "Contato", assResp: (cfE.rep.nome || this.eu) + " · Callface",
      codigoTxt: "Proposta " + d.codigo + "-v" + d.versao, validaTxt: "Válida até " + fmtD(valida),
      para: "Proposta para " + O.empresa,
      porTxt: "Preparada por " + (O.resp || "Callface") + " para " + (d.contato || "você") + (((O.pessoa === d.contato ? O.cargo : ((O.pessoas || []).find(p => p.nome === d.contato) || {}).papel) || "") ? ", " + (O.pessoa === d.contato ? O.cargo : ((O.pessoas || []).find(p => p.nome === d.contato) || {}).papel) : "") + ". Aqui estão o escopo, os valores e as condições, tudo em um lugar só.",
      kpis: [
        ehWl && c.res && !c.mrr ? ["Por licença ativa", brl((d.itens.find(it => it.prod === "wl-lic") || {}).valor || 0), "/mês", "Cobrado só quando cada licença é ativada"] : ["Mensalidade", brl(c.mrrLiq), "/mês", c.dm ? "De " + brl(c.mrr) + ", com desconto" : c.teste ? "Depois de " + c.tDias + " dias de teste" : "Recorrente"],
        ["Setup", c.unico ? brl(c.unicoLiq) : "Sem setup", "", c.unico ? (c.parc > 1 ? "Em " + c.parc + "x de " + brl(c.unicoLiq / c.parc) : "Pagamento único") : "Nada a pagar para começar"],
        [c.fid ? "Total em " + c.fid + " meses" : "Total em 12 meses", brl(c.totalContrato), "", c.uso ? "Mais uso sob demanda" : "Valor do contrato"]
      ].map(([l, v, suf, s], i) => ({ l, v, suf, s,
        style: "min-width:0;padding:16px 18px;border-radius:14px;" + (i === 0 ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1px #eef1f1"),
        lStyle: "display:block;font-size:11.5px;font-weight:600;color:" + (i === 0 ? "#a3aab0" : "#67787c"),
        vStyle: "font-family:'Plus Jakarta Sans',sans-serif;font-size:" + (i === 0 ? "26px" : "19px") + ";font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;white-space:nowrap;color:" + (i === 0 ? "#fff" : "#12171d"),
        sufStyle: "font-size:12.5px;font-weight:600;color:" + (i === 0 ? "#ff8a70" : "#67787c"),
        sStyle: "display:block;margin-top:6px;font-size:11.5px;line-height:1.4;color:" + (i === 0 ? "#a3aab0" : "#8b949e") })),
      linha: [["Aceite", "Hoje, direto por esta página"]].concat(c.teste ? [["Teste grátis", c.tDias + " dias antes da primeira cobrança"]] : []).concat(c.unico ? [["Setup", (c.parc > 1 ? c.parc + "x de " + brl(c.unicoLiq / c.parc) : brl(c.unicoLiq) + " à vista") + " · " + (d.prazo === "custom" ? (d.prazoData ? "em " + d.prazoData.split("-").reverse().join("/") : "data a combinar") : ({ "0": "no aceite", "15": "em 15 dias", "30": "em 30 dias" }[d.prazo] || "no aceite"))]] : [])
        .concat([[ehWl ? "Ativações" : "Mensalidade", "Todo dia " + d.dia + (ehWl ? ", por licença ativa" : " · início " + (inicioTxt || "").toLowerCase())]]).concat(d.reajuste !== "nenhum" ? [["Reajuste", "Uma vez por ano, pelo " + d.reajuste]] : [])
        .map(([t, s], i, arr) => ({ n: String(i + 1), t, s, trilho: "flex:1;height:2px;margin:0 6px;border-radius:9999px;background:" + (i < arr.length - 1 ? "#f3d9d1" : "transparent") })),
      proximos: (d.fechamento === "contrato"
        ? [["Aceite a proposta", "Leva um minuto, direto por esta página."], ["Assine o contrato", "Geramos o contrato com os dados desta proposta. A assinatura é digital."], ["Implantação", "Nosso time começa a implantação logo após a assinatura."]]
        : [["Aceite a proposta", "Leva um minuto, direto por esta página."], ["Pagamento seguro", "Você segue para o checkout e escolhe entre boleto e cartão."], ["Acesso liberado", "Assim que o pagamento é confirmado, a conta é ativada."]]).map(([t, s], i) => ({ n: "0" + (i + 1), t, s })),
      decTitulo: "Proposta válida até " + fmtD(valida),
      decSub: d.fechamento === "contrato" ? "Ao aceitar, você segue para a assinatura digital do contrato. Se algo não estiver certo, peça um ajuste." : "Ao aceitar, você segue para o pagamento seguro. Se algo não estiver certo, peça um ajuste.",
      decValorL: ehWl && c.res && !c.mrr ? "Setup" : "Mensalidade", decValor: ehWl && c.res && !c.mrr ? brl(c.unicoLiq) : brl(c.mrrLiq) + "/mês",
      aceitarTxt: "Aceitar proposta",
      posAceite: d.fechamento === "contrato" ? "Depois do aceite, o contrato chega pronto para você assinar digitalmente." : "Depois do aceite, você segue para o pagamento seguro.",
      layA: (d.layout || "classico") === "classico", layB: d.layout === "executivo", layC: d.layout === "essencial",
      mensal: brl(c.mrrLiq), setupV: c.unico ? brl(c.unicoLiq) : "Sem setup",
      ...(() => {
        const L = d.itens.find(it => it.prod === "wl-lic");
        const q = L ? (n(L.qtd) || 0) : 0;
        if (!ehWl || !q) return { mensalSuf: "/mês", mensalNota: "", temMensalNota: false };
        const u = (n(L.valor) * q - this.descItem(L, n(L.valor) * q)) / q;
        return { mensal: brl(u), mensalSuf: "/licença ativa", temMensalNota: true,
          mensalNota: "Nada é cobrado por mês até a primeira ativação. Com " + q + " licenças reservadas, o teto é " + brl(u * q) + "/mês se todas estiverem ativas." };
      })(),
      aceitar: () => this.setState({ dec: "aceitar", decOk: false, decMot: null, decTxt: "", decFeito: false }),
      ajuste: () => this.setState({ dec: "ajuste", decMot: null, decTxt: "", decFeito: false, decTentou: false }),
      recusar: () => this.setState({ dec: "recusar", decMot: null, decTxt: "", decFeito: false, decTentou: false }),
      baixar: () => this.diz("O PDF é gerado a partir desta página quando a proposta é enviada", "info"),
      vendIni: ini(O.resp || ""), vendPrimeiro: (O.resp || "o comercial").split(" ")[0],
      // ANTES: acrescentava o e-mail chutado "primeironome@callface.ai" ao vendedor.
      vendSub: O.resp || "",
      rodape: "Proposta " + d.codigo + "-v" + d.versao + " · página 1 de 1"
    };

    const DK = S.dec;
    const MOT = { recusar: ["Preço acima do esperado", "Escolhemos outra solução", "Não é o momento", "Escopo não atende", "Outro"], ajuste: ["Valores", "Prazo ou condições", "Itens do escopo", "Forma de pagamento", "Outro"] };
    const MIN = 10;
    const nTxt = (S.decTxt || "").trim().length;
    const decOkForm = DK === "aceitar" ? !!S.decOk : nTxt >= MIN;
    const dec = !DK ? { aberto: false, resumo: [], motivos: [] } : {
      aberto: true, form: !S.decFeito, feito: !!S.decFeito,
      fechar: () => this.setState({ dec: null, decFeito: false }), parar: (e) => e.stopPropagation(),
      ehAceite: DK === "aceitar", temMotivos: DK !== "aceitar",
      titulo: { aceitar: "Aceitar proposta", ajuste: "Pedir ajuste", recusar: "Recusar proposta" }[DK],
      sub: { aceitar: d.fechamento === "contrato" ? "Confira o resumo. Depois do aceite, enviamos o contrato já preenchido para você assinar." : "Confira o resumo. Depois do aceite, você segue para o pagamento seguro.", ajuste: "Conte o que você gostaria de mudar. " + (O.resp || "O comercial").split(" ")[0] + " recebe na hora e prepara uma nova versão.", recusar: "Tudo bem. Conte o motivo com as suas palavras: isso ajuda a gente a entender o que faltou." }[DK],
      resumo: [["Mensalidade", brl(c.mrrLiq) + "/mês"], ["Setup", c.unico ? brl(c.unicoLiq) : "Sem setup"], [c.fid ? "Total em " + c.fid + " meses" : "Total em 12 meses", brl(c.totalContrato), true]].map(([l, v, forte], i) => ({ l, v, style: "display:flex;gap:10px;padding:10px 14px;font-size:13px;" + (i ? "border-top:1px solid #eef1f1;" : "") + (forte ? "font-weight:700;color:#12171d;background:#fafafa" : "color:#4a5560") })),
      toggleAceite: () => this.setState(s => ({ decOk: !s.decOk })),
      caixa: "flex:0 0 auto;width:18px;height:18px;margin-top:1px;border-radius:5px;display:grid;place-items:center;" + (S.decOk ? "background:#12171d;color:#fff" : "box-shadow:inset 0 0 0 1.5px #b8bdbb;color:transparent"),
      motivos: (MOT[DK] || []).map(m => ({ label: m, onClick: () => this.setState({ decMot: S.decMot === m ? null : m }), style: "height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;white-space:nowrap;flex:0 0 auto;font-size:12.5px;font-weight:" + (S.decMot === m ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") })),
      texto: S.decTxt || "", setTexto: (e) => this.setState({ decTxt: e.target.value }),
      rotulo: DK === "ajuste" ? "O que você gostaria de ajustar?" : "Por que a proposta não atende?",
      dica: DK === "ajuste" ? "Ex: precisamos de 20 licenças a menos no início e setup em 3 vezes." : "Ex: o investimento ficou acima do nosso orçamento para este semestre.",
      ajuda: S.decTentou && !decOkForm ? "Escreva pelo menos " + MIN + " caracteres." : DK === "ajuste" ? (O.resp || "O comercial").split(" ")[0] + " recebe seu pedido e envia uma nova versão." : "Sua resposta vai direto para " + (O.resp || "o comercial").split(" ")[0] + ".",
      ajudaStyle: S.decTentou && !decOkForm ? "color:#c2330f;font-weight:600" : "color:#67787c",
      contagem: nTxt + (nTxt < MIN ? " / mín. " + MIN : ""),
      txStyle: "width:100%;padding:11px 12px;border-radius:10px;border:0;outline:0;resize:vertical;background:#fff;font-size:13px;line-height:1.5;color:#12171d;box-shadow:inset 0 0 0 1px " + (S.decTentou && !decOkForm ? "#d93c1a" : "#dbdede"),
      btnTxt: { aceitar: "Aceitar proposta", ajuste: "Enviar pedido", recusar: "Recusar proposta" }[DK],
      btnStyle: "height:40px;padding:0 16px;border-radius:9px;border:0;font-size:13px;font-weight:700;white-space:nowrap;cursor:" + (decOkForm ? "pointer" : "not-allowed") + ";" + (!decOkForm ? "background:#e3e7e8;color:#8b949e" : DK === "recusar" ? "background:#c2330f;color:#fff" : DK === "aceitar" ? "background:#fe4f2b;color:#12171d" : "background:#12171d;color:#fff"),
      confirmar: () => { if (!decOkForm) return this.setState({ decTentou: true }); this.setState({ decFeito: true }); },
      okIco: "width:52px;height:52px;border-radius:9999px;display:grid;place-items:center;" + (DK === "recusar" ? "background:#eeeff3;color:#4a5560" : DK === "aceitar" ? "background:#e6f4ee;color:#1f7256" : "background:#fff6f4;color:#c2330f"),
      okD: DK === "recusar" ? "M18 6 6 18M6 6l12 12" : DK === "aceitar" ? "M20 6 9 17l-5-5" : "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
      okTitulo: { aceitar: "Proposta aceita", ajuste: "Pedido enviado", recusar: "Proposta recusada" }[DK],
      okSub: { aceitar: d.fechamento === "contrato" ? "Agora é só assinar. Você está sendo levado para o contrato, já preenchido com os dados desta proposta." : "Você está sendo levado para o checkout seguro para concluir o pagamento.", ajuste: (O.resp || "O comercial").split(" ")[0] + " já recebeu o seu pedido e vai enviar uma nova versão.", recusar: "Obrigado pelo retorno. Se mudar de ideia, é só falar com a gente." }[DK],
      okNota: "Simulação. Na página do cliente, isso volta para a oportunidade como “" + { aceitar: "Proposta aceita", ajuste: "Ajuste solicitado", recusar: "Proposta recusada" }[DK] + "”" + (DK !== "aceitar" ? ", com o texto escrito pelo cliente" : "") + " e aparece no card do Pipeline."
    };

    // ações
    const salvarRascunho = () => {
      const P = this.paraProposta(d, "rascunho");
      this.gravar(P, null, S.idx == null ? "Rascunho da proposta #" + d.codigo + "-v" + d.versao + " criado" : null);
      const h = new Date();
      this.setState({ sujo: false, salvoEm: "agora", salvoPop: { hora: String(h.getHours()).padStart(2, "0") + ":" + String(h.getMinutes()).padStart(2, "0") } });
    };
    const enviar = () => {
      const bad = oks.findIndex(x => !x);
      if (bad >= 0) { this.setState({ tentou: { 0: true, 1: true, 2: true, 3: true, 4: true }, passo: bad }); return this.diz("Revise " + ROTS[bad][0].toLowerCase() + " antes de enviar", "erro"); }
      if (precisaCt && ctPend.length) return this.setState({ ctModal: true });
      if (S.modo === "versao" && S.baseIdx != null) this._marcarBase = S.baseIdx;
      const st = precisaAprov ? "rascunho" : "enviada";
      const P = this.paraProposta(d, st, { enviadaEm: precisaAprov ? undefined : "Hoje", canal: canaisSel.join("+") || "link", aprovacao: precisaAprov ? "pendente" : undefined });
      if (precisaCt) {
        const dados = {};
        ctGrupos.forEach(g => g.campos.forEach(cf => { if (cf.var && cf.var !== "—") dados[cf.var] = cf.v; }));
        P.contrato = { status: "aguardando_aceite", modelo: d.minuta, aditivoDe: ehAdt && adtO ? adtO.id : undefined, vigencia: ehAdt ? adtVig : undefined, versao: d.versao, congeladoEm: this.agora ? this.agora() : "Hoje", dados };
      }
      const mover = !precisaAprov && (O.etapa === "entrada" || O.etapa === "diagnostico") ? { etapa: "proposta", dias: 0 } : null;
      this.gravar(P, mover, precisaAprov ? "Proposta #" + d.codigo + "-v" + d.versao + " enviada para aprovação do desconto" : "Proposta #" + d.codigo + "-v" + d.versao + " enviada" + (canaisSel.length ? " por " + canaisSel.map(x => x === "email" ? "e-mail" : "WhatsApp").join(" e ") : " por link") + (precisaCt ? " · contrato preparado com os dados desta versão" : "") + (mover ? " · movido para Proposta" : ""));
      this.setState({ sujo: false, enviado: { aprov: precisaAprov, mover: !!mover } });
      this.diz(precisaAprov ? "Salva como rascunho: desconto acima de 15% exige aprovação, e o fluxo de aprovação ainda não existe. Nada foi enviado ao cliente" : "Proposta enviada para " + (canaisSel.length ? (d.contato || "o contato") : "o link"), "ok");
    };
    if (this._enviarJa) { this._enviarJa = false; setTimeout(() => enviar(), 0); }
    const avancar = () => {
      if (S.passo === 4) return enviar();
      if (!oks[S.passo]) { this.setState(s => ({ tentou: Object.assign({}, s.tentou, { [s.passo]: true }) })); return this.diz("Complete " + ROTS[S.passo][0].toLowerCase() + " para seguir", "erro"); }
      this.setState(s => ({ passo: s.passo + 1 }));
    };
    // ANTES: link inventado em propostas.callface.ai; ver comentário de linkP.
    const link = d.id && typeof window !== "undefined" ? window.location.origin + "/p/" + d.id : "";
    const E2 = S.enviado || {};
    const fim = {
      titulo: E2.aprov ? "Salva como rascunho" : "Proposta enviada",
      sub: E2.aprov ? "O desconto de " + c.pctEf.toFixed(1).replace(".", ",") + "% exige aprovação do gestor, mas o fluxo de aprovação ainda não existe. A proposta #" + d.codigo + "-v" + d.versao + " ficou como rascunho e não foi enviada."
        : "#" + d.codigo + "-v" + d.versao + " foi para " + (d.canal === "link" ? "o link público" : d.para) + ". Ela fica vinculada à oportunidade e o status atualiza sozinho." + (E2.mover ? " A oportunidade foi para a etapa Proposta." : ""),
      trilha: (E2.aprov ? ["Rascunho", "Aprovação", "Enviada", "Aceita"] : ["Rascunho", "Enviada", "Visualizada", "Aceita"]).map((l, i, a) => { const done = i <= 1; return { label: l,
        bola: "flex:0 0 auto;width:14px;height:14px;border-radius:9999px;box-sizing:border-box;" + (done ? "background:#12171d" : "background:#fff;border:1.5px solid #d2d5d5"),
        linhaE: "flex:1;height:2px;background:" + (i === 0 ? "transparent" : i <= 1 ? "#12171d" : "#e3e7e8"), linhaD: "flex:1;height:2px;background:" + (i === a.length - 1 ? "transparent" : i < 1 ? "#12171d" : "#e3e7e8"),
        labelStyle: "font-size:11.5px;font-weight:" + (done ? "600;color:#12171d" : "500;color:#8b949e") }; }),
      link: link || "—", copiar: () => { if (!link) return this.diz("Ainda não há link público para esta proposta", "info"); try { navigator.clipboard.writeText(link); } catch (e) {} this.diz("Link copiado", "ok"); }
    };
    const T = S.troca;
    const troca = !T ? { aberto: false, familias: [], contatos: [] } : {
      aberto: true, fechar: () => this.setState({ troca: null }), parar: (e) => e.stopPropagation(),
      famD: FICO[O.familia || "CALLFACE_AI"], oppNome: (FAM[O.familia] || "") + " · " + O.empresa, oppEtapa: ROT[O.etapa] || "",
      familias: Object.keys(FAM).map(k => { const atual = k === (O.familia || "CALLFACE_AI"), on = T.familia === k; return { label: FAM[k], d: FICO[k], sub: atual ? "Atual" : "Nova oportunidade",
        onClick: () => !atual && this.setState(s => ({ troca: Object.assign({}, s.troca, { familia: k }) })),
        ico: "width:32px;height:32px;border-radius:9px;display:grid;place-items:center;" + (on ? "background:#12171d;color:#fff" : atual ? "background:#eeeff3;color:#b8bdbb" : "background:#fff6f4;color:#c2330f"),
        style: "display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px 12px;border-radius:12px;border:0;text-align:center;cursor:" + (atual ? "not-allowed" : "pointer") + ";background:" + (atual ? "#fafafa" : "#fff") + ";color:" + (atual ? "#a3a8a4" : "#12171d") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px " + (atual ? "#eef1f1" : "#dbdede")) }; }),
      contato: T.contato || "", contatos: pessoas.map(p => ({ v: p, l: p })), setContato: (e) => { const v = e.target.value; this.setState(s => ({ troca: Object.assign({}, s.troca, { contato: v }) })); },
      temNovo: !!T.familia, novoNome: T.familia ? FAM[T.familia] + " · " + O.empresa : "", novoD: FICO[T.familia || "CALLFACE_AI"],
      resp: T.resp || O.resp || "", setResp: (e) => { const v = e.target.value; this.setState(s => ({ troca: Object.assign({}, s.troca, { resp: v }) })); },
      equipe: [O.resp].concat(D.EQUIPE || []).filter((x, i, a) => x && a.indexOf(x) === i).map(p => ({ v: p, l: p })),
      resumo: [["Closer", T.resp || O.resp || "—"], ["Contato", T.contato || "—"], ["Empresa", O.empresa], ["Origem", "Proposta de " + (FAM[O.familia || "CALLFACE_AI"] || "")]].map(([l, v], i) => ({ l, v, style: "min-width:0;padding:10px 14px;" + (i % 2 ? "box-shadow:inset 1px 0 0 #eef1f1;" : "") + (i > 1 ? "border-top:1px solid #eef1f1" : "") })),
      criarStyle: "height:38px;padding:0 16px;border-radius:9px;border:0;font-size:13px;font-weight:700;white-space:nowrap;" + (T.familia && T.contato ? "background:#12171d;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#8b949e;cursor:not-allowed"),
      criar: () => {
        if (!T.familia || !T.contato) return this.diz("Escolha o produto e o contato", "erro");
        const lista = (S.opps || D.OPORTUNIDADES || []).slice();
        const id = "o" + Date.now().toString(36);
        const pess = (O.pessoas && O.pessoas.length ? O.pessoas : [{ nome: O.pessoa, papel: "Contato principal" }]);
        lista.push({ id, empresa: O.empresa, pessoa: T.contato, cargo: T.contato === O.pessoa ? O.cargo : "", familia: T.familia, etapa: "entrada", resp: T.resp || O.resp, dias: 0, leadId: O.leadId, origem: O.origem,
          itens: [], propostas: [], pessoas: pess, atvs: [], eventos: [{ t: "Oportunidade criada a partir da proposta de " + (FAM[O.familia] || ""), quando: this.agora(), autor: this.eu }] });
        if (Es) Es.gravar({ opps: lista });
        this.setState({ troca: null });
        this.diz("Oportunidade " + FAM[T.familia] + " criada no Pipeline", "ok");
        ir("/onface-preview/proposta", "Proposta", { opp: id });
      }
    };
    const ultimo = S.passo === 4;

    return Object.assign(base, {
      tituloTopo: S.modo === "ver" ? "Proposta #" + d.codigo + "-v" + d.versao : S.modo === "novo" ? "Criar proposta" : S.modo === "versao" ? "Nova versão" : "Editar proposta",
      trilhaTopo: [{ label: "Pipeline", ir: irPipeline }, { label: (FAM[O.familia] || "") + " · " + O.empresa, ir: () => ir("/onface-preview/oportunidade", O.empresa, { opp: O.id }) }],
      temO: true, semO: false, troca, cab, passos, herdado, f0, f1, f2, f3, f4, ct, ctm, mv, dec, ctRef: this.ctRef, pv, resumoKpi, fim,
      naturezas: Object.keys(NAT).map(k => ({ v: k, l: NAT[k] })),
      p0: S.passo === 0 && !S.enviado, p1: S.passo === 1 && !S.enviado, p2: S.passo === 2 && !S.enviado, p3: S.passo === 3 && !S.enviado, p4: S.passo === 4 && !S.enviado,
      enviado: !!S.enviado, temRodape: !S.enviado && S.modo !== "ver", temVoltar: S.passo > 0,
      esqRef: this.esqRef,
      voltar: () => this.setState(s => ({ passo: Math.max(0, s.passo - 1) })),
      avancar, salvarRascunho,
      avancarLabel: ultimo ? (precisaAprov ? "Enviar para aprovação" : "Gerar e enviar") : "Próximo: " + ROTS[S.passo + 1][0],
      avancarD: ultimo ? "M22 2 11 13M22 2l-7 20-4-9-9-4z" : "M5 12h14M13 6l6 6-6 6",
      avancarStyle: "display:flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:9px;border:0;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;color:#fff;" + (ultimo ? "background:linear-gradient(180deg,#ff6241 0%,#fe4f2b 55%,#ef4522 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 6px 16px -6px rgba(254,79,43,.65)" : "background:#12171d"),
      irOportunidade: () => ir("/onface-preview/oportunidade", O.empresa, { opp: O.id, aba: "prop" }),
      salvoPop: !!S.salvoPop,
      salvoTxt: "Proposta #" + d.codigo + "-v" + d.versao + " salva como rascunho em " + (FAM[O.familia] || "") + " · " + O.empresa + (S.salvoPop ? ", às " + S.salvoPop.hora : "") + ". Você pode continuar de onde parou quando quiser.",
      salvoPasso: "Parou em " + ROTS[S.passo][0].toLowerCase(),
      continuarEdit: () => this.setState({ salvoPop: null }),
      salvoVoltar: () => { this.setState({ salvoPop: null }); ir("/onface-preview/oportunidade", O.empresa, { opp: O.id, aba: "prop" }); },
      estreito: !!S.estreito, temVistas: !!S.estreito && S.modo !== "ver",
      vistas: [["editor", "Editar"], ["prev", "Pré-visualizar"]].map(([k, l]) => ({ label: l, onClick: () => this.setState({ vista: k }), style: seg((S.vista || "editor") === k) })),
      mostraEditor: S.modo === "ver" ? false : S.estreito ? (S.vista || "editor") === "editor" : !S.expandido,
      mostraPrev: S.modo === "ver" ? true : S.estreito ? S.vista === "prev" : true,
      corpoStyle: "flex:1;min-height:0;display:grid;grid-template-columns:" + (S.estreito || S.expandido || S.modo === "ver" ? "minmax(0,1fr)" : "minmax(0,1.05fr) minmax(0,1fr)") + ";overflow:hidden",
      toggleCliente: () => this.setState({ cliente: !S.cliente }),
      modelosP: [["classico", "Clássico", "Documento detalhado, com tabela e resumo financeiro"], ["executivo", "Executivo", "Capa escura e resumo fixo ao lado"], ["essencial", "Essencial", "Direto ao ponto, uma coluna só"]].map(([v, l, dica]) => ({ label: l, dica, onClick: () => up({ layout: v }),
        style: "height:26px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + ((d.layout || "classico") === v ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "font-weight:500;background:transparent;color:#4a5560") })),
      clienteBtn: "display:flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:8px;border:0;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;" + (S.cliente ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
      naoVer: S.modo !== "ver",
      ver: (() => {
        if (S.modo !== "ver") return { on: false, modelos: [] };
        const PP = (O.propostas || [])[S.idx] || {};
        const ST = { rascunho: ["Rascunho", "#eeeff3", "#4a5560"], enviada: ["Enviada", "#e8f0fb", "#2c5f9e"], visualizada: ["Visualizada", "#e8f0fb", "#2c5f9e"], ajuste_solicitado: ["Ajuste solicitado", "#fff6f4", "#c2330f"], aceita: ["Aceita", "#e6f4ee", "#1f7256"], recusada: ["Recusada", "#fdeeea", "#c2330f"], expirada: ["Expirada", "#eeeff3", "#67787c"], substituida: ["Substituída", "#eeeff3", "#67787c"] }[PP.status] || [PP.status || "—", "#eeeff3", "#4a5560"];
        const rasc = PP.status === "rascunho", viva = ["recusada", "expirada", "substituida", "aceita"].indexOf(PP.status) < 0;
        const volta = () => ir("/onface-preview/oportunidade", O.empresa, { opp: O.id, aba: "prop" });
        return { on: true, voltar: volta,
          codigo: "#" + d.codigo + "-v" + d.versao, status: ST[0],
          stStyle: "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:9999px;font-size:11px;font-weight:700;background:" + ST[1] + ";color:" + ST[2],
          meta: [d.titulo, "para " + (d.contato || O.pessoa || "—"), PP.enviadaEm ? "enviada " + String(PP.enviadaEm).toLowerCase() : "ainda não enviada", "validade " + (d.validade || 30) + " dias"].join(" · "),
          modelos: [["classico", "Clássico"], ["executivo", "Executivo"], ["essencial", "Essencial"]].map(([v, l]) => ({ label: l, onClick: () => this.setState(s => ({ d: Object.assign({}, s.d, { layout: v }) })),
            style: "height:28px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + ((d.layout || "classico") === v ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "font-weight:500;background:transparent;color:#4a5560") })),
          temAcao: S.verVig && (rasc || viva),
          acaoTxt: rasc ? "Editar proposta" : "Criar nova versão",
          acaoD: rasc ? "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" : "M12 5v14M5 12h14",
          acao: () => ir("/onface-preview/proposta", "Proposta", { opp: O.id, ver: "" }) };
      })(),
      toggleExpandir: () => this.setState({ expandido: !S.expandido }), expandirDica: S.expandido ? "Voltar ao editor" : "Expandir pré-visualização",
      expandirD: S.expandido ? "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" : "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
    });
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <PropostaDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as PropostaLiga };
