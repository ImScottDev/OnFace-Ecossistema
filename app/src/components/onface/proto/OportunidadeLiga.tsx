// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Oportunidade — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * OportunidadeDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `OportunidadeDesenho.tsx`, convertido por máquina e intocável.
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
import { arquivosDaOpp } from "./arquivos-da-opp";
import { abrirUrlExterna } from "@/lib/callface-ligar";
import { toast } from "sonner";

import { OportunidadeDesenho } from "./OportunidadeDesenho";
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

  arqRef = React.createRef();
  notaRef = React.createRef();
  state = { opps: null, leads: null, aba: "geral", menu: null, resEdit: false, resDraft: {}, atvF: "todas", abertas: {}, modal: null, form: {}, tentou: false };

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
    const aba = E.parametro && E.parametro("aba");
    if (aba) this.setState({ aba });
    this.forceUpdate();
  }
  componentWillUnmount() { if (this._off) this._off(); }
  componentDidUpdate() { this.autoRevisao(); }

  /* Resposta do cliente (ajuste ou recusa) gera, uma vez, a nota do sistema e a atividade de revisão do responsável. */
  autoRevisao() {
    if (!this.E || !this.oppId) return;
    const O = this.todas().find(x => x.id === this.oppId);
    if (!O || O.derivada) return;
    this._auto = this._auto || {};
    // ANTES: RESP_DEMO punha na boca do cliente frases fixas ("Fechamos com outro fornecedor...", "parcelar em 3 vezes") em toda proposta recusada/com ajuste. Ninguém escreveu isso. Agora só aparece o que o cliente de fato registrou (p.resposta / log).
    const chavesA = (O.atvs || []).map(a => a.chave).filter(Boolean), chavesN = (O.notas || []).map(n => n.chave).filter(Boolean);
    const novasA = [], novasN = [];
    const agora = new Date();
    const prazo = (q) => {
      const m = String(q || "").match(/(\d{1,2}):(\d{2})/), hoje = /^hoje/i.test(String(q || ""));
      const base = hoje && m ? new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), +m[1], +m[2]) : new Date(agora);
      base.setHours(base.getHours() + 2); base.setMinutes(base.getMinutes() < 30 ? 30 : 0); if (base.getMinutes() === 0) base.setHours(base.getHours() + 1);
      if (base.getHours() >= 19 || base.getHours() < 8) { if (base.getHours() >= 19) base.setDate(base.getDate() + 1); base.setHours(9, 0, 0, 0); }
      const mesmoDia = base.toDateString() === agora.toDateString();
      const amanha = new Date(agora); amanha.setDate(amanha.getDate() + 1);
      const dia = mesmoDia ? "Hoje" : base.toDateString() === amanha.toDateString() ? "Amanhã" : base.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      return dia + ", " + String(base.getHours()).padStart(2, "0") + ":" + String(base.getMinutes()).padStart(2, "0");
    };
    (O.propostas || []).forEach(p => {
      const k = p.status === "ajuste_solicitado" ? "ajuste" : p.status === "recusada" ? "recusada" : p.status === "aceita" && ["ganho", "perdido"].indexOf(O.etapa) < 0 ? "aceita" : null;
      if (!k) return;
      const cod = "#" + p.codigo + "-v" + (p.versao || 1), base = p.codigo + ":" + (p.versao || 1) + ":" + k;
      if (k === "aceita") {
        if (chavesA.indexOf("rev:" + base) >= 0 || this._auto["rev:" + base]) return;
        this._auto["rev:" + base] = true;
        const evA = (p.log || []).slice().reverse().find(x => x.k === "aceita") || {};
        const contrato = p.modo !== "PREPAID";
        novasA.push({ chave: "rev:" + base, auto: true, tipo: "Follow up", situacao: "A fazer", feita: false, autor: O.resp, quando: prazo(evA.quando),
          titulo: "Acompanhar o fechamento da proposta " + cod,
          desc: O.pessoa + " aceitou a proposta " + cod + (evA.quando ? " (" + evA.quando.toLowerCase() + ")" : "") + ". Acompanhe esta oportunidade até a conclusão comercial.\n\nPróximos passos:\n"
            + (contrato
              ? "• Confirmar que o contrato chegou e foi aberto por " + O.pessoa + ".\n• Acompanhar a assinatura e tirar dúvidas do jurídico, se houver.\n• Com o contrato assinado, marcar a oportunidade como ganha."
              : "• Confirmar que " + O.pessoa + " concluiu o pagamento no checkout.\n• Se o pagamento não cair, ajudar com a forma de pagamento.\n• Com o pagamento confirmado, marcar a oportunidade como ganha.") });
        return;
      }
      const ev = (p.log || []).slice().reverse().find(x => x.k === k) || {};
      const motivo = p.resposta || ev.texto || "";
      const quem = p.recusaInterna ? O.pessoa + " (informado por " + O.resp + ")" : O.pessoa;
      if (chavesA.indexOf("rev:" + base) < 0 && !this._auto["rev:" + base]) {
        this._auto["rev:" + base] = true;
        novasA.push({ chave: "rev:" + base, auto: true, tipo: k === "ajuste" ? "Tarefa" : "Follow up", situacao: "A fazer", feita: false, autor: O.resp, quando: prazo(ev.quando),
          titulo: k === "ajuste" ? "Revisar ajuste pedido na proposta " + cod : "Entender a recusa da proposta " + cod,
          desc: (k === "ajuste"
            ? quem + " pediu ajuste na proposta " + cod + (motivo ? ":\n“" + motivo + "”" : ".") + "\n\nPróximos passos:\n• Avaliar o pedido e, se precisar, alinhar desconto ou condição com a diretoria.\n• Criar a nova versão da proposta.\n• Retornar para " + O.pessoa + " com a proposta revisada."
            : quem + " recusou a proposta " + cod + (motivo ? ":\n“" + motivo + "”" : ".") + "\n\nPróximos passos:\n• Ligar para entender o motivo em detalhe.\n• Ver se cabe uma nova proposta ou se a oportunidade deve ser marcada como perdida.\n• Registrar o resultado aqui.") });
      }
      if (!p.recusaInterna && chavesN.indexOf("sis:" + base) < 0 && !this._auto["sis:" + base]) {
        this._auto["sis:" + base] = true;
        novasN.push({ autor: "Sistema", sistema: true, chave: "sis:" + base, quando: ev.quando || "Recebido pela proposta", tag: "Proposta " + cod + " · " + (k === "ajuste" ? "Ajuste solicitado" : "Recusada"),
          texto: "@" + O.resp + " " + O.pessoa + " " + (k === "ajuste" ? "pediu ajuste na proposta " + cod : "recusou a proposta " + cod) + " pela página da proposta" + (motivo ? ": “" + motivo + "”" : ".") + (k === "ajuste" ? " Crie uma nova versão para responder." : ""), anexos: [] });
      }
    });
    if (!novasA.length && !novasN.length) return;
    const evs = novasA.map(a => ({ t: "Atividade criada automaticamente · " + a.titulo, quando: this.agora(), autor: "Sistema" }));
    this.gravarOpp(Object.assign({}, O, { atvs: novasA.concat(O.atvs || []), notas: novasN.concat(O.notas || []), eventos: evs.concat(O.eventos || []) }), null);
    if (novasA.length) this.diz(novasA.length > 1 ? novasA.length + " atividades criadas para " + O.resp : (/^Acompanhar/.test(novasA[0].titulo) ? "Atividade de acompanhamento criada para " : "Atividade de revisão criada para ") + O.resp + " · " + novasA[0].quando.toLowerCase(), "ok");
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
    const MORTAS = ["recusada", "expirada", "substituida"];
    return lista.concat(derivadas).map((o, idx) => {
      const props = o.propostas || (o.proposta ? [Object.assign({ codigo: "P-" + (1540 + idx), itens: o.itens || [] }, o.proposta)] : []);
      const vig = props.slice().reverse().find(p => MORTAS.indexOf(p.status) < 0) || props[props.length - 1] || null;
      return Object.assign({}, o, { propostas: props, proposta: vig, leadId: o.leadId || (leads.find(l => l.empresa === o.empresa) || {}).id || null });
    });
  }

  gravarOpp(o, evento) {
    const E = this.E, D = this.dadosDoProto || {};
    const atual = (this.state.opps || D.OPORTUNIDADES || []).slice();
    const novo = Object.assign({}, o);
    delete novo.derivada; delete novo.proposta; delete novo.itens;
    if (String(novo.id).indexOf("d:") === 0) { novo.id = "o:" + novo.leadId; this.oppId = novo.id; }
    if (evento) novo.eventos = [{ t: evento, quando: this.agora(), autor: this.eu }].concat(novo.eventos || []);
    const i = atual.findIndex(x => x.id === novo.id || x.id === o.id);
    if (i >= 0) atual[i] = novo; else atual.push(novo);
    this.setState({ opps: atual });
    if (E) E.gravar({ opps: atual });
    return novo;
  }

  renderVals() {
    const S = this.state, D = this.dadosDoProto || {}, Es = this.E;
    const equipe = D.EQUIPE || ["Camila Reis", "Diego Nunes", "Ana Vitória"];
    const ini = D.iniciais || (s => (s || "").split(" ").map(p => [...p][0]).slice(0, 2).join("").toUpperCase());
    const slug = D.slug || (x => x);
    const ROT = { entrada: "Entrada", diagnostico: "Diagnóstico", proposta: "Proposta", negociacao: "Negociação", ganho: "Ganho", perdido: "Perdido" };
    const COR = { entrada: "#4a5560", diagnostico: "#2c5f9e", proposta: "#9c7a2e", negociacao: "#fe4f2b", ganho: "#1f7256", perdido: "#8b949e" };
    const FAM = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
    const NAT = { MRR: "Recorrente", SETUP: "Setup", PROJECT: "Projeto", ONE_TIME: "Avulso", USAGE: "Uso", HARDWARE: "Hardware" };
    const PROP = { rascunho: "Rascunho", enviada: "Enviada", visualizada: "Visualizada", ajuste_solicitado: "Ajuste solicitado", aceita: "Aceita", recusada: "Recusada", expirada: "Expirada", substituida: "Substituída" };
    const brl = (n) => "R$ " + (+n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const ordem = ["entrada", "diagnostico", "proposta", "negociacao"];
    const ir = (href, rot, p) => Es && Es.irPara(href, rot, p);
    const irPipeline = () => ir("/onface-preview/pipeline", "Pipeline");
    const trilhaTopo = [{ label: "Pipeline", ir: irPipeline }];

    const O = this.oppId ? this.todas().find(o => o.id === this.oppId || o.id === "o:" + String(this.oppId).replace(/^d:/, "")) : null;
    const base = { tituloTopo: "Oportunidade", trilhaTopo, irPipeline, temO: !!O, semO: !!this.oppId && !O, temModal: false, m: { grupos: [], campos: [], itens: [], ver: { meta: [] } }, fecharModal: () => this.setState({ modal: null }), parar: (e) => e.stopPropagation(), naturezas: [], equipe, menuAberto: false, fecharMenus: () => {} };
    if (!O) return base;

    const salva = (patch, ev) => this.gravarOpp(Object.assign({}, O, patch), ev);
    const TIME = equipe.concat([this.eu]).filter((x, i, a) => a.indexOf(x) === i);
    const mencoesDe = (txt, onPick) => { const mm = /(^|\s)@([^\s@]{0,20})$/.exec(txt || ""); if (!mm) return { temMencao: false, mencoes: [] };
      const q = mm[2].toLowerCase(); const l = TIME.filter(n => n.toLowerCase().indexOf(q) >= 0 || n.toLowerCase().split(" ").some(p => p.indexOf(q) === 0));
      return { temMencao: l.length > 0, mencoes: l.map(n => ({ nome: n, ini: ini(n), escolher: (e) => { e.preventDefault(); onPick((txt || "").slice(0, (txt || "").length - mm[2].length - 1) + "@" + n + " "); } })) }; };
    const partesDe = (txt) => { const out = []; const re = new RegExp("@(" + TIME.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g"); let last = 0, x;
      while ((x = re.exec(txt || ""))) { if (x.index > last) out.push({ txt: txt.slice(last, x.index), style: "" }); out.push({ txt: x[0], style: "font-weight:600;color:#c2330f;background:#fff6f4;border-radius:4px;padding:0 3px" }); last = x.index + x[0].length; }
      if (last < (txt || "").length) out.push({ txt: txt.slice(last), style: "" }); return out.length ? out : [{ txt: txt || "", style: "" }]; };
    const P = O.proposta, props = O.propostas || [];
    const pos = ordem.indexOf(O.etapa), aberta = O.etapa !== "ganho" && O.etapa !== "perdido";
    const LD = O.leadId ? (S.leads || D.LEADS || []).find(l => l.id === O.leadId) : null;
    const tl = O.eventos || [];
    const itensV = (P && P.itens) || [];
    const tot = itensV.reduce((a, it) => { const v = (+it.valor || 0) * (+it.qtd || 1); return it.natureza === "MRR" ? { mrr: a.mrr + v, un: a.un } : { mrr: a.mrr, un: a.un + v }; }, { mrr: 0, un: 0 });
    const titulo = (FAM[O.familia] || "Callface") + " · " + O.empresa;
    const IC = {
      Reunião: ["M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "#fff6f4", "#c2330f"],
      Ligação: ["M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39", "#e6f4ee", "#1f7256"],
      "E-mail": ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6", "#e8f0fb", "#2c5f9e"],
      Mensagem: ["M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", "#e6f4ee", "#1f7256"],
      Proposta: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", "#fdeeea", "#c2330f"],
      Tarefa: ["M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", "#eeeff3", "#4a5560"],
      Movido: ["M5 12h14M13 6l6 6-6 6", "#eeeff3", "#4a5560"]
    };
    IC["Follow up"] = IC.Tarefa;
    const icoEvento = (t) => /proposta/i.test(t) ? IC.Proposta : /reuni/i.test(t) ? IC.Reunião : /liga/i.test(t) ? IC.Ligação : /e-?mail/i.test(t) ? IC["E-mail"] : /whats|mensagem/i.test(t) ? IC.Mensagem : /movid|reaberta|ganho|perdid/i.test(t) ? IC.Movido : IC.Tarefa;

    const abrirModal = (modal, form) => this.setState({ modal, form: form || {}, tentou: false, menu: null });
    /* A atividade nasce e se edita na peça ÚNICA de Atividade (tarefas), com o vínculo desta oportunidade. */
    const registrar = () => { this.setState({ menu: null }); this.E.abrir("novaAtividade", null); };
    /* Ligação que veio do Callface: o clique abre o Relatório da ligação (áudio,
       transcrição, análise, próximos passos), não o modal genérico de atividade. */
    const verAtv = (i) => {
      const x = (O.atvs || [])[i];
      const Es3 = this.E;
      if (x && Es3 && O.leadId && x.tipo === "Ligação" && /^Liga[cç][aã]o/i.test(x.titulo || "")) return Es3.abrir("relatorio", { leadId: O.leadId, audioUrl: x.audioUrl || "" });
      if (x && x.tarefaId && Es3) return Es3.abrir("verAtividade", "p:" + x.tarefaId);
      /* Reunião: a peça ÚNICA de Reunião (reagendar, cancelar, participantes, link, situação, notas). Nunca o cartão de leitura. */
      if (x && x.reuniaoId && Es3) return Es3.abrir("reuniao", x.reuniaoId, { oppId: O.id, leadId: O.leadId || null });
      /* Registro do histórico (ligação sem relatório, e-mail, nota de sistema): não é tarefa, vive na timeline. */
      return this.setState({ aba: "tl" });
    };
    const novaProposta = () => ir("/onface-preview/proposta", "Proposta", { opp: O.id, ver: "" });
    const novaPropostaModal = () => abrirModal({ k: "proposta" }, { modo: P ? P.modo : "CONTRACT", validade: String(P && P.validade ? P.validade : 14), itens: (P && P.itens && P.itens.length ? P.itens : [{ nome: "", natureza: "MRR", valor: "", qtd: 1 }]).map(x => Object.assign({}, x, { valor: String(x.valor), qtd: String(x.qtd || 1) })) });
    const mover = (k) => {
      if (k === O.etapa) return;
      if ((k === "proposta" || k === "negociacao") && !P) { this.diz("Crie a proposta antes de avançar", "aviso"); return novaProposta(); }
      // Ganho não tem botão: o motor fecha quando a evidência da oferta chega.
      if (k === "ganho") return this.diz((O.fechamentoFalta && O.fechamentoFalta.length ? "Falta para ganhar: " + O.fechamentoFalta.join("; ") + ". " : "") + "Ganho não tem botão: a oportunidade fecha sozinha quando o contrato é assinado ou o pagamento é confirmado.", "aviso");
      if (k === "perdido") return abrirModal({ k: "perda" });
      salva({ etapa: k, dias: 0 }, "Movido de " + ROT[O.etapa] + " para " + ROT[k]);
      this.setState({ menu: null });
      this.diz(O.empresa + " → " + ROT[k], "ok");
    };
    const prox = ordem[pos + 1];
    const item = (label, onClick, extra) => Object.assign({ label, onClick, atual: false, dot: "display:none", style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 10px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:500;color:#12171d" }, extra || {});
    const cor = (c) => ({ style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 10px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:500;color:" + c });

    const abrirEmpresa = () => O.leadId ? ir("/onface-preview/empresa", O.empresa, { lead: O.leadId }) : this.diz(O.empresa + " ainda não tem página", "aviso");
    const abrirPessoa = () => O.leadId ? ir("/onface-preview/pessoa", O.pessoa, { pessoa: slug(O.pessoa), lead: O.leadId }) : this.diz(O.pessoa + " ainda não tem página", "aviso");
    // ANTES: tel/e-mail só vinham do lead (LD, sempre nulo no dado real) e o botão Ligar dizia sempre "Sem telefone cadastrado". Agora lê o contato da oportunidade (O.pessoas).
    const PP = (O.pessoas || []).find(x => x.principal) || (O.pessoas || []).find(x => x.nome === O.pessoa) || {};
    const tel = (LD && (LD.tel || LD.telefone)) || PP.telefone || "", email = (LD && LD.email) || PP.email || "";
    const criado = O.criadoEm || (tl.length ? tl[tl.length - 1].quando : "—");
    // ANTES: sem LD (lead vem vazio do Proto) 1514 de 1578 oportunidades apareciam "Criada manualmente". Agora decide por leadId / processo de origem reais.
    const procRot = O.origem && O.origem !== "—" ? O.origem : "";
    /* A origem gravada manda; só sem ela se deduz pelo lead (negócio manual com lead vinculado dizia "Veio do Pré-vendas"). */
    const viaPre = O.origemBruta ? O.origemBruta === "PRE_SALES" : (!!LD || !!O.leadId), manual = O.origemBruta === "MANUAL";
    const origem = LD ? (LD.origem || "—") : viaPre ? "Pré-vendas" : (procRot || "—");
    const valorTxt = P && (tot.mrr + tot.un) ? (tot.mrr ? brl(tot.mrr) + "/mês" : "") + (tot.mrr && tot.un ? " + " : "") + (tot.un ? brl(tot.un) : "") : "Definido na proposta";
    const metaBtn = (link) => "display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;font-size:12.5px;white-space:nowrap;cursor:" + (link ? "pointer" : "default");

    const abertos = (O.atvs || []).map((x, i) => ({ x, i })).filter(o => !o.x.feita);
    const P1 = abertos[0];
    const ordenadas = abertos.concat((O.atvs || []).map((x, i) => ({ x, i })).filter(o => o.x.feita));
    const filtradas = ordenadas.filter(o => S.atvF === "todas" || (S.atvF === "abertas" ? !o.x.feita : o.x.feita));

    const CAMPOS = [["objetivo", "Objetivo", "O que o cliente quer alcançar"], ["escopo", "Escopo", "Unidades, volume, times envolvidos"], ["contexto", "Contexto", "Momento da empresa, gatilho da compra"], ["dor", "Dor principal", "O problema que precisa ser resolvido"], ["solucao", "Solução proposta", "Como a Callface resolve"]];
    const RC = O.resumoCampos || {};
    if (!RC.dor && S.qual !== undefined) {}

    const arqs = arquivosDaOpp(props, O.arquivos || [], PROP, O.resp);
    const statusSelo = (st) => "flex:0 0 auto;display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;"
      + ({ rascunho: "background:#eeeff3;color:#4a5560", enviada: "background:#e8f0fb;color:#2c5f9e", visualizada: "background:#f7edd8;color:#6e5420", ajuste_solicitado: "background:#fff6f4;color:#9c3210", aceita: "background:#e6f4ee;color:#1f7256", recusada: "background:#fdeeea;color:#c2330f" }[st] || "background:#eeeff3;color:#8b949e");
    const somaP = (p) => (p.itens || []).reduce((a, it) => { const v = (+it.valor || 0) * (+it.qtd || 1); return it.natureza === "MRR" ? { mrr: a.mrr + v, un: a.un } : { mrr: a.mrr, un: a.un + v }; }, { mrr: 0, un: 0 });
    const setProp = (i, patch, ev) => { const a = props.slice(); a[i] = Object.assign({}, a[i], patch); salva({ propostas: a }, ev); };

    const abas = [["geral", "Visão geral", 0], ["atv", "Atividades", ordenadas.length], ["tl", "Timeline", tl.length], ["arq", "Arquivos", arqs.length], ["prop", "Propostas", props.length]];

    // modal
    let m = { dv: { produtos: [], equipe: [], pessoas: [], etapas: [] }, ehDerivar: false, grupos: [], grupos2: [], campos: [], itens: [], ver: { meta: [] }, vinc: {}, temVinc: false, temVer: false, temAviso: false, temItens: false, cancelarLabel: "Cancelar" };
    const md = S.modal;
    if (md) {
      const Fm = S.form;
      const setF = (k, v) => this.setState(st => ({ form: Object.assign({}, st.form, { [k]: v }) }));
      const chip = (on) => "height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:" + (on ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
      const grupo = (k, label, ops, obrig) => ({ label, obrig: !!obrig, temErro: !!(S.tentou && obrig && !Fm[k]), opcoes: ops.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return { label: l, style: chip(Fm[k] === v), onClick: () => setF(k, v) }; }) });
      const campo = (k, label, dica, obrig, longo) => { const erro = !!(S.tentou && obrig && !(Fm[k] || "").trim()); return { label, dica, obrig: !!obrig, longo: !!longo, curto: !longo, valor: Fm[k] || "", set: (e) => setF(k, e.target.value), temErro: erro,
        style: "width:100%;" + (longo ? "padding:9px 11px;resize:vertical;min-height:70px;" : "height:36px;padding:0 11px;") + "border-radius:9px;border:0;outline:0;background:#fff;font-size:13px;color:#12171d;box-shadow:inset 0 0 0 1px " + (erro ? "#d93c1a" : "#dbdede") }; };
      const forte = (c) => "flex:0 0 auto;white-space:nowrap;height:34px;padding:0 16px;border-radius:9px;border:0;font-size:12.5px;font-weight:600;cursor:pointer;color:#fff;background:" + c;
      const ico = (bg, c) => "flex:0 0 auto;width:36px;height:36px;border-radius:9px;background:" + bg + ";color:" + c + ";display:grid;place-items:center";
      const fechar = () => this.setState({ modal: null, form: {}, tentou: false });
      const TIPOS = ["Ligação", "Reunião", "E-mail", "Mensagem", "Tarefa", "Follow up"], SITS = ["A fazer", "Em andamento", "Feita", "Declinada"];
      const sub = O.empresa + " · " + O.pessoa;
      if (md.k === "pessoa") {
        const Est = this.E;
        const empX = (Est && Est.ler("empresas", {})[O.empresa]) || {};
        const naOpp = (O.pessoas || []).map(p => p.nome).concat(O.pessoa);
        const cands = [];
        (S.leads || D.LEADS || []).filter(l => l.empresa === O.empresa && l.pessoa).forEach(l => cands.push({ nome: l.pessoa, cargo: l.cargo || "" }));
        (empX.pessoas || []).forEach(p => cands.push({ nome: p.nome, cargo: p.cargo || "" }));
        const livres = cands.filter((c, i, a) => a.findIndex(x => x.nome === c.nome) === i && naOpp.indexOf(c.nome) < 0);
        const modo = Fm.modo || (livres.length ? "empresa" : "nova");
        const radio = (on) => ({ style: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;border:0;cursor:pointer;text-align:left;background:" + (on ? "#fff" : "#fff") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #dbdede"),
          radio: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;box-sizing:border-box;" + (on ? "border:5px solid #12171d" : "border:1.5px solid #b8bdbb") });
        const vinc = Fm.vinc || "ambos";
        m = Object.assign(m, { titulo: "Adicionar pessoa", sub: O.empresa + " · " + titulo, d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6", icoStyle: ico("#fff6f4", "#c2330f"),
          grupos: [{ label: "Como adicionar", obrig: false, temErro: false, opcoes: [["empresa", "Pessoa da empresa"], ["nova", "Cadastrar nova pessoa"]].map(([v, l]) => ({ label: l, style: chip(modo === v), onClick: () => setF("modo", v) })) }]
            .concat(modo === "empresa"
              ? (livres.length ? [{ label: "Quem", obrig: true, temErro: !!(S.tentou && !Fm.quem), opcoes: livres.map(c => ({ label: c.nome + (c.cargo ? " · " + c.cargo : ""), style: chip(Fm.quem === c.nome), onClick: () => setF("quem", c.nome) })) }] : [])
              : [])
            .concat(modo === "empresa" && !livres.length ? [] : (modo === "nova" && vinc === "empresa" ? [] : [grupo("papel", "Papel na negociação", ["Decisor", "Influenciador", "Financeiro", "Técnico", "Usuário", "Outro"], true)])),
          temAviso: modo === "empresa" && !livres.length, aviso: "Todas as pessoas da " + O.empresa + " já estão nesta oportunidade. Cadastre uma nova.",
          campos: modo === "nova" ? [campo("nome", "Nome", "Nome completo", true), campo("cargo", "Cargo", "Ex: Gerente de TI"), campo("email", "E-mail", "nome@empresa.com.br"), campo("tel", "Telefone", "+55 11 90000-0000")] : [],
          grupos2: modo === "nova" ? [{ label: "Vínculo", obrig: true, opcoes: [
            ["ambos", "Cadastrar na empresa e vincular à oportunidade", "Entra no contato da " + O.empresa + " e na negociação"],
            ["empresa", "Só cadastrar na empresa", "Fica no contato da " + O.empresa + ", fora desta oportunidade"]
          ].map(([v, l, s2]) => Object.assign({ label: l, sub: s2, onClick: () => setF("vinc", v) }, radio(vinc === v))) }] : [],
          salvarLabel: modo === "empresa" ? "Vincular à oportunidade" : (vinc === "ambos" ? "Cadastrar e vincular" : "Cadastrar na empresa"), salvarStyle: forte("#12171d"),
          salvar: () => {
            if (modo === "empresa") {
              if (!livres.length) return;
              if (!Fm.quem || !Fm.papel) return this.setState({ tentou: true });
              salva({ pessoas: (O.pessoas || []).concat({ nome: Fm.quem, papel: Fm.papel }) }, Fm.quem + " vinculado(a) como " + Fm.papel);
              fechar(); return this.diz(Fm.quem + " agora está na negociação", "ok");
            }
            const nome = (Fm.nome || "").trim();
            if (!nome || (vinc === "ambos" && !Fm.papel)) return this.setState({ tentou: true });
            if (Est) { const todas = Object.assign({}, Est.ler("empresas", {})); const X = todas[O.empresa] || {};
              todas[O.empresa] = Object.assign({}, X, { pessoas: (X.pessoas || []).concat({ nome, cargo: Fm.cargo || "", email: Fm.email || "", tel: Fm.tel || "—" }),
                eventos: [{ titulo: "Pessoa cadastrada", detalhe: nome + " · via oportunidade", quando: this.agora(), autor: this.eu }].concat(X.eventos || []) });
              Est.gravar({ empresas: todas }); }
            if (vinc === "ambos") salva({ pessoas: (O.pessoas || []).concat({ nome, papel: Fm.papel, cargo: Fm.cargo || "" }) }, nome + " cadastrado(a) e vinculado(a) como " + Fm.papel);
            else salva({}, nome + " cadastrado(a) na " + O.empresa);
            fechar(); this.diz(vinc === "ambos" ? nome + " cadastrado(a) e na negociação" : nome + " cadastrado(a) na " + O.empresa, "ok");
          } });
      } else if (md.k === "derivar") {
        const todas = this.todas();
        const abertasEmp = todas.filter(x => x.empresa === O.empresa && x.etapa !== "ganho" && x.etapa !== "perdido");
        const jaTem = (k) => abertasEmp.some(x => x.familia === k);
        const fams = Object.keys(FAM).map(k => [k, FAM[k] + (k === O.familia ? " · atual" : jaTem(k) ? " · já aberta" : "")]);
        const bloq = Fm.familia && (Fm.familia === O.familia || jaTem(Fm.familia));
        const pessoasOp = (O.pessoas || []).map(p => p.nome).filter(Boolean);
        if (O.pessoa && pessoasOp.indexOf(O.pessoa) < 0) pessoasOp.unshift(O.pessoa);
        const FICO = { CALLFACE_AI: "M12 3l1.9 5.8L20 10.7l-5 3.7 1.9 5.9L12 16.6l-4.9 3.7L9 14.4l-5-3.7 6.1-1.9z", PABX: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39", WHITE_LABEL: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" };
        const erroM = !!(S.tentou && !(Fm.motivo || "").trim());
        m = Object.assign(m, { titulo: "Derivar oportunidade", sub: "Outra negociação na " + O.empresa + ", para outro produto.",
          d: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9", icoStyle: ico("#fff6f4", "#c2330f"),
          ehDerivar: true,
          dv: {
            origem: titulo, origemSub: ROT[O.etapa] + " · " + O.resp,
            nova: (FAM[Fm.familia] || "Escolha o produto") + " · " + O.empresa, novaSub: ({ entrada: "Entrada", diagnostico: "Diagnóstico" })[Fm.etapa] + " · " + (Fm.resp || "—"),
            produtos: Object.keys(FAM).map(k => { const atual = k === O.familia, ja = !atual && jaTem(k), off = atual || ja, on = Fm.familia === k;
              return { label: FAM[k], d: FICO[k], sub: atual ? "Oportunidade atual" : ja ? "Já tem uma aberta" : "Disponível", dica: off ? (atual ? "É o produto desta oportunidade" : "Já existe uma aberta deste produto") : "",
                onClick: () => !off && setF("familia", k),
                style: "display:block;min-width:0;padding:12px;border-radius:11px;border:0;text-align:left;cursor:" + (off ? "not-allowed" : "pointer") + ";background:" + (off ? "#fafafa" : "#fff") + ";color:" + (off ? "#a3a8a4" : "#12171d") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px " + (off ? "#eef1f1" : "#dbdede")),
                ico: "display:grid;place-items:center;width:30px;height:30px;border-radius:8px;" + (off ? "background:#f1f3f3;color:#b8bdbb" : on ? "background:#12171d;color:#fff" : "background:#fff6f4;color:#c2330f") }; }),
            temAviso: !!(S.tentou && !Fm.familia), aviso: "Escolha um produto disponível",
            equipe, resp: Fm.resp || equipe[0], respIni: ini(Fm.resp || equipe[0]), setResp: (e) => setF("resp", e.target.value),
            pessoas: pessoasOp.length ? pessoasOp : [O.pessoa], pessoa: Fm.pessoa || O.pessoa, pesIni: ini((Fm.pessoa || O.pessoa || "").replace(/^Dr\.?\s+/, "")), setPessoa: (e) => setF("pessoa", e.target.value),
            etapas: [["entrada", "Entrada"], ["diagnostico", "Diagnóstico"]].map(([k, l]) => ({ label: l, onClick: () => setF("etapa", k),
              dot: "width:7px;height:7px;border-radius:9999px;background:" + COR[k],
              style: "display:flex;align-items:center;justify-content:center;gap:7px;height:34px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;" + (Fm.etapa === k ? "font-weight:600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "font-weight:500;background:transparent;color:#4a5560") })),
            motivo: Fm.motivo || "", setMotivo: (e) => setF("motivo", e.target.value), erroMotivo: erroM,
            notaCaixa: "border-radius:10px;background:#fff;box-shadow:inset 0 0 0 1px " + (erroM ? "#d93c1a" : "#dbdede"),
            temMencao: mencoesDe(Fm.motivo, v => setF("motivo", v)).temMencao, mencoes: mencoesDe(Fm.motivo, v => setF("motivo", v)).mencoes,
            motivoStyle: "width:100%;padding:10px 12px;border-radius:10px;border:0;outline:0;resize:vertical;min-height:62px;background:#fff;font-size:13px;line-height:1.5;color:#12171d;box-shadow:inset 0 0 0 1px " + (erroM ? "#d93c1a" : "#dbdede")
          },
          temVinc: false, temAviso: false, grupos: [], campos: [],
          salvarLabel: "Criar oportunidade", salvarStyle: forte("#12171d"),
          salvar: () => {
            if (!Fm.familia || !Fm.resp || !Fm.pessoa || !Fm.etapa || !(Fm.motivo || "").trim() || bloq) return this.setState({ tentou: true });
            /* Antes: empurrava a nova oportunidade so no estado local e avisava "criada" sem gravar nada
               (sumia no refresh). Agora vai pelo command de criacao; sem ele a tela diz que nao grava. */
            if (!this.props.derivar) { this.setState({ modal: null, form: {}, tentou: false }); return this.diz("Derivar oportunidade ainda não é gravado por esta tela.", "aviso"); }
            this.props.derivar({ familia: Fm.familia, resp: Fm.resp, etapa: Fm.etapa, pessoa: Fm.pessoa, motivo: Fm.motivo.trim() });
            this.setState({ modal: null, form: {}, tentou: false });
          },
          temSecundario: false });
      } else if (md.k === "perda") {
        const MOT = ["Sem retorno", "Sem interesse", "Preço", "Escolheu concorrente", "Sem orçamento", "Timing / outra data", "Trava na negociação", "Projeto cancelado", "Sem fit após diagnóstico", "Outro"];
        m = Object.assign(m, { titulo: "Marcar como perdida", sub: O.empresa + " · o motivo alimenta o relatório de perdas.", d: "M18 6 6 18M6 6l12 12", icoStyle: ico("#fdeeea", "#c2330f"),
          grupos: [grupo("motivo", "Motivo da perda", MOT, true)], campos: [campo("obs", "Observação", Fm.motivo === "Outro" ? "Obrigatória para Outro" : "Opcional", Fm.motivo === "Outro", true)],
          salvarLabel: "Marcar perdida", salvarStyle: forte("#c2330f"),
          salvar: () => { if (!Fm.motivo || (Fm.motivo === "Outro" && !(Fm.obs || "").trim())) return this.setState({ tentou: true }); salva({ etapa: "perdido", dias: 0, motivoPerda: Fm.motivo, obsPerda: Fm.obs || "" }, "Perdido · " + Fm.motivo); fechar(); this.diz(O.empresa + " marcada como perdida", "aviso"); } });
      } else if (md.k === "ganho") {
        const aceita = P && P.status === "aceita";
        m = Object.assign(m, { titulo: "Marcar como ganha", sub: aceita ? "Proposta aceita. Confirme para transformar " + O.empresa + " em Cliente." : "Ganho exige proposta aceita ou uma evidência do fechamento.", d: "M20 6 9 17l-5-5", icoStyle: ico("#e6f4ee", "#1f7256"),
          temAviso: !aceita, aviso: P ? "A proposta está " + (PROP[P.status] || "").toLowerCase() + ". Registre a evidência do fechamento." : "Não há proposta. Registre a evidência do fechamento.",
          campos: aceita ? [] : [campo("evidencia", "Evidência", "Ex: contrato assinado CT-2026-120", true)],
          salvarLabel: "Confirmar ganho", salvarStyle: forte("#1f7256"),
          salvar: () => { if (!aceita && !(Fm.evidencia || "").trim()) return this.setState({ tentou: true }); salva({ etapa: "ganho", dias: 0, evidencia: aceita ? "Proposta aceita" : Fm.evidencia.trim() }, "Ganho · " + (aceita ? "proposta aceita" : Fm.evidencia.trim())); fechar(); this.diz("Ganho! " + O.empresa + " agora é Cliente", "ok"); } });
      } else if (md.k === "proposta") {
        const its = Fm.itens || [];
        const t = its.reduce((a, it) => { const v = (+String(it.valor).replace(",", ".") || 0) * (+it.qtd || 1); return it.natureza === "MRR" ? { mrr: a.mrr + v, un: a.un } : { mrr: a.mrr, un: a.un + v }; }, { mrr: 0, un: 0 });
        const setIt = (i, k, v) => this.setState(st => { const x = (st.form.itens || []).slice(); x[i] = Object.assign({}, x[i], { [k]: v }); return { form: Object.assign({}, st.form, { itens: x }) }; });
        const inp = (erro) => "min-width:0;height:34px;padding:0 9px;border-radius:8px;border:0;outline:0;background:#fff;font-size:12.5px;color:#12171d;box-shadow:inset 0 0 0 1px " + (erro ? "#d93c1a" : "#dbdede");
        m = Object.assign(m, { titulo: P ? "Nova versão da proposta" : "Nova proposta", sub: titulo + (P ? " · substitui #" + P.codigo + "-v" + (P.versao || 1) : ""), d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", icoStyle: ico("#fdeeea", "#c2330f"),
          grupos: [grupo("modo", "Modalidade", [["CONTRACT", "Contrato"], ["PREPAID", "Pré-pago / Checkout"]], true), grupo("validade", "Validade", [["7", "7 dias"], ["14", "14 dias"], ["30", "30 dias"]], true)],
          temItens: true,
          itens: its.map((it, i) => ({ nome: it.nome || "", natureza: it.natureza || "MRR", valor: it.valor || "", qtd: it.qtd || "1",
            nomeStyle: inp(S.tentou && !(it.nome || "").trim()), valorStyle: inp(S.tentou && !(+String(it.valor).replace(",", ".") > 0)) + ";text-align:right",
            setNome: (e) => setIt(i, "nome", e.target.value), setNat: (e) => setIt(i, "natureza", e.target.value), setValor: (e) => setIt(i, "valor", e.target.value), setQtd: (e) => setIt(i, "qtd", e.target.value),
            remover: () => this.setState(st => ({ form: Object.assign({}, st.form, { itens: (st.form.itens || []).filter((_, x) => x !== i) }) })) })),
          addItem: () => this.setState(st => ({ form: Object.assign({}, st.form, { itens: (st.form.itens || []).concat({ nome: "", natureza: "SETUP", valor: "", qtd: "1" }) }) })),
          itensRec: t.mrr ? "Recorrente: " + brl(t.mrr) + "/mês" : "Sem recorrente", itensTotal: "Total: " + brl(t.mrr + t.un),
          salvarLabel: P ? "Criar nova versão" : "Criar proposta", salvarStyle: forte("#12171d"),
          salvar: () => {
            const ok = its.length && its.every(it => (it.nome || "").trim() && +String(it.valor).replace(",", ".") > 0);
            if (!Fm.modo || !Fm.validade || !ok) return this.setState({ tentou: true });
            const lista = props.map(p => p === P ? Object.assign({}, p, { status: "substituida" }) : p);
            const cod = P ? P.codigo : "P-" + (1600 + Math.floor(Math.random() * 300));
            const nova = { codigo: cod, versao: P ? (P.versao || 1) + 1 : 1, status: "rascunho", modo: Fm.modo, validade: +Fm.validade, itens: its.map(it => ({ nome: it.nome.trim(), natureza: it.natureza || "MRR", valor: +String(it.valor).replace(",", "."), qtd: +it.qtd || 1 })) };
            const patch = { propostas: lista.concat(nova) };
            if (md.depois) Object.assign(patch, { etapa: md.depois, dias: 0 });
            salva(patch, "Proposta #" + cod + "-v" + nova.versao + " criada" + (md.depois ? " · movido para " + ROT[md.depois] : ""));
            fechar(); this.setState({ aba: "prop" }); this.diz("Proposta criada como rascunho", "ok");
          } });
      }
    }

    const R = Object.assign(base, {
      tituloTopo: titulo,
      o: {
        titulo, empresa: O.empresa, pessoa: O.pessoa, cargo: O.cargo || "—", empIni: ini(O.empresa), pesIni: ini((O.pessoa || "").replace(/^Dr\.?\s+/, "")),
        empSub: (LD && LD.segmento) || (((n) => n + " pessoa" + (n === 1 ? "" : "s") + " na negociação")(Math.max((O.pessoas || []).length, O.pessoa && O.pessoa !== "Sem contato" ? 1 : 0))),
        resp: O.resp || equipe[0], respIni: ini(O.resp || equipe[0]),
        etapaLabel: ROT[O.etapa], etapaPonto: "width:7px;height:7px;border-radius:9999px;background:" + COR[O.etapa],
        etapaChip: "display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:9999px;font-size:12px;font-weight:600;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:" + COR[O.etapa],
        diasTexto: aberta ? "há " + (O.dias || 0) + (O.dias === 1 ? " dia" : " dias") + " nesta etapa" : "",
        aberta, fechada: !aberta,
        fechoStyle: "display:flex;align-items:center;gap:10px;margin-top:12px;padding:11px 12px;border-radius:11px;" + (O.etapa === "ganho" ? "background:#e6f4ee;color:#1f7256" : "background:#f3f4f4;color:#4a5560"),
        fechoIco: O.etapa === "ganho" ? "M20 6 9 17l-5-5" : "M18 6 6 18M6 6l12 12",
        fechoTitulo: O.etapa === "ganho" ? "Ganha · empresa agora é Cliente" : "Perdida · " + (O.motivoPerda || "sem motivo"),
        fechoSub: O.etapa === "ganho" ? (O.evidencia || "Proposta aceita") : (O.obsPerda || "Motivo registrado para o relatório de perdas"),
        meta: [
          ["M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", "Valor:", valorTxt, null],
          ["M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", "Produto:", FAM[O.familia] || "—", null],
          ["M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4", "Empresa:", O.empresa, abrirEmpresa],
          ["M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "Contato principal:", O.pessoa, abrirPessoa],
          ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "Responsável:", O.resp, null],
          ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20", "Origem:", origem, null],
          ["M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "Criada em:", criado, null]
        ].map(([d, label, valor, onClick]) => ({ d, label, valor, onClick: onClick || (() => {}), style: metaBtn(!!onClick), valorStyle: "font-weight:600;color:" + (onClick ? "#c2330f" : (valor === "Definido na proposta" ? "#8b949e" : "#12171d")) }))
      },
      menuAberto: !!S.menu, fecharMenus: () => this.setState({ menu: null }),
      etapasAberto: S.menu === "etapas", toggleEtapas: () => this.setState({ menu: S.menu === "etapas" ? null : "etapas" }),
      maisAberto: S.menu === "mais", toggleMais: () => this.setState({ menu: S.menu === "mais" ? null : "mais" }),
      etapasItens: ordem.map((k, i) => item(ROT[k], () => mover(k), { atual: i === pos, dot: "flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:" + COR[k] }))
        .concat([item("Perdido", () => mover("perdido"), { dot: "flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:#8b949e" })]),
      maisItens: (aberta ? [item("Marcar como perdida", () => mover("perdido"), cor("#c2330f"))] : [item("Reabrir oportunidade", () => { salva({ etapa: "negociacao", dias: 0 }, "Reaberta em Negociação"); this.setState({ menu: null }); })])
        .concat(aberta ? [item("Delegar a um agente", () => { this.setState({ menu: null }); window.dispatchEvent(new CustomEvent("onface:delegar-agente", { detail: { negocioId: O.id } })); })] : [])
        .concat([item("Ver no Pipeline", () => ir("/onface-preview/pipeline", "Pipeline", { opp: O.id }))]),
      notaRef: this.notaRef,
      novaAberto: S.menu === "nova", toggleNova: () => this.setState({ menu: S.menu === "nova" ? null : "nova" }),
      novaItens: [
        { label: "Atividade", sub: "Ligação, reunião, e-mail, tarefa…", d: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", onClick: registrar },
        { label: "Nota interna", sub: "Registro para o time, com @menção", d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5", onClick: () => this.setState({ menu: null, aba: "geral", notaAtiva: true }, () => setTimeout(() => { const el = this.notaRef.current; if (el) { el.focus(); const p = el.closest("[data-r=pagina]"); if (p) p.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - 120), behavior: "smooth" }); } }, 60)) }
      ],
      avancarLabel: prox ? "Avançar etapa" : "O que falta para ganhar",
      avancarDica: prox ? "Mover para " + ROT[prox] : "Negociação é a última etapa · fecha sozinha com contrato assinado ou pagamento confirmado",
      avancar: () => mover(prox || "ganho"),
      reabrir: () => { salva({ etapa: "negociacao", dias: 0 }, "Reaberta em Negociação"); this.diz("Oportunidade reaberta", "ok"); },
      registrar, novaProposta, novaPropostaLabel: P ? "Nova versão" : "Criar proposta",
      addPessoa: () => abrirModal({ k: "pessoa" }, { vinc: "ambos" }),
      papeis: ["Contato principal", "Decisor", "Influenciador", "Financeiro", "Técnico", "Usuário", "Outro"],
      envolvidos: (O.pessoas || []).map((p, i) => ({ p, i })).filter(({ p }) => p.nome && p.nome !== O.pessoa).map(({ p, i }) => {
        const L2 = (S.leads || D.LEADS || []).find(l => l.pessoa === p.nome);
        const PC = { Decisor: "background:#12171d;color:#fff", Financeiro: "background:#e6f4ee;color:#1f7256", "Técnico": "background:#e8f0fb;color:#2c5f9e", Influenciador: "background:#f7edd8;color:#6e5420", "Usuário": "background:#fff6f4;color:#9c3210" };
        return { nome: p.nome, ini: ini(p.nome), papel: p.papel || "Outro", sub: p.cargo || (L2 && L2.cargo) || "Sem cargo",
          linha: "display:flex;align-items:center;gap:8px;padding:9px 8px 9px 12px;background:#fff",
          papelStyle: "position:relative;flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px 0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;cursor:pointer;" + (PC[p.papel] || "background:#eeeff3;color:#4a5560"),
          setPapel: (e) => { const v = e.target.value; const x = (O.pessoas || []).slice(); x[i] = Object.assign({}, p, { papel: v }); salva({ pessoas: x }, p.nome + " agora é " + v); },
          remover: () => { salva({ pessoas: (O.pessoas || []).filter((_, k) => k !== i) }, p.nome + " desvinculado(a) da oportunidade"); this.diz(p.nome + " saiu da negociação", "aviso"); },
          abrir: () => L2 && Es ? ir("/onface-preview/pessoa", p.nome, { pessoa: slug(p.nome), lead: L2.id }) : (O.leadId && Es ? ir("/onface-preview/pessoa", p.nome, { pessoa: slug(p.nome), lead: O.leadId }) : this.diz(p.nome + " ainda não tem página", "aviso")) };
      }),
      semEnvolvidos: !(O.pessoas || []).some(p => p.nome && p.nome !== O.pessoa),
      temEnvolvidos: (O.pessoas || []).some(p => p.nome && p.nome !== O.pessoa),
      nEnvolvidos: (O.pessoas || []).filter(p => p.nome && p.nome !== O.pessoa).length,
      derivar: () => abrirModal({ k: "derivar" }, { resp: O.resp, pessoa: O.pessoa, etapa: "entrada", familia: Object.keys(FAM).find(k => k !== O.familia && !this.todas().some(x => x.empresa === O.empresa && x.familia === k && x.etapa !== "ganho" && x.etapa !== "perdido")) || null }),
      abas: abas.map(([k, label, n]) => ({ label, n, temN: n > 0, onClick: () => this.setState({ aba: k }),
        style: "flex:0 0 auto;display:flex;align-items:center;gap:6px;height:38px;padding:0 12px;border:0;background:transparent;cursor:pointer;font-size:13px;white-space:nowrap;margin-bottom:-1px;" + (S.aba === k ? "font-weight:600;color:#12171d;box-shadow:inset 0 -2px 0 #fe4f2b" : "font-weight:500;color:#67787c"),
        nStyle: "font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:" + (S.aba === k ? "#c2330f" : "#8b949e") })),
      abaGeral: S.aba === "geral", abaAtv: S.aba === "atv", abaTl: S.aba === "tl", abaArq: S.aba === "arq", abaProp: S.aba === "prop",
      irTimeline: () => this.setState({ aba: "tl" }), irPropostas: () => this.setState({ aba: "prop" }),

      resLendo: !S.resEdit, resEditando: !!S.resEdit,
      editarResumo: () => this.setState({ aba: "geral", resEdit: true, resDraft: Object.assign({}, RC), menu: null }),
      cancelarResumo: () => this.setState({ resEdit: false }),
      salvarResumo: () => { salva({ resumoCampos: Object.assign({}, S.resDraft) }, "Resumo da oportunidade atualizado"); this.setState({ resEdit: false }); this.diz("Resumo salvo", "ok"); },
      resumo: CAMPOS.map(([k, label, dica], i) => ({ label, dica, valor: RC[k] || "Não preenchido",
        valorStyle: "font-size:13px;line-height:1.55;text-wrap:pretty;color:" + (RC[k] ? "#1f252c" : "#a3a8a4"),
        draft: (S.resDraft || {})[k] || "", set: (e) => { const v = e.target.value; this.setState(st => ({ resDraft: Object.assign({}, st.resDraft, { [k]: v }) })); },
        linha: "display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr);gap:14px;align-items:start;padding:10px 0;" + (i ? "border-top:1px solid #f3f5f5" : "") })),

      temItens: itensV.length > 0, semItens: !itensV.length,
      prodFonte: P ? "Proposta #" + P.codigo + "-v" + (P.versao || 1) + " · " + (PROP[P.status] || "").toLowerCase() : "",
      itens: itensV.map(it => ({ nome: it.nome, natureza: NAT[it.natureza] || it.natureza, qtd: String(it.qtd || 1), unit: brl(it.valor) + (it.natureza === "MRR" ? "/mês" : ""), total: brl((+it.valor || 0) * (+it.qtd || 1)) })),
      prodRec: tot.mrr ? "Recorrente " + brl(tot.mrr) + "/mês · único " + brl(tot.un) : "Sem recorrente",
      prodTotal: brl(tot.mrr + tot.un),

      temProx: !!P1, semProx: !P1,
      prox: P1 ? { titulo: P1.x.titulo, sub: P1.x.tipo + " · " + (P1.x.quando || "sem data") + (P1.x.desc ? " · " + P1.x.desc : ""), d: (IC[P1.x.tipo] || IC.Tarefa)[0], ver: () => verAtv(P1.i) } : {},

      tlResumo: tl.slice(0, 5).map((ev, i, arr) => { const ic = icoEvento(ev.t); return { t: ev.t, autor: ev.autor || "", quando: ev.quando || "—", d: ic[0],
        bolha: "flex:0 0 auto;width:30px;height:30px;border-radius:9999px;display:grid;place-items:center;background:" + ic[1] + ";color:" + ic[2],
        linha: "flex:1;width:1.5px;margin:3px 0;background:" + (i < arr.length - 1 ? "#e3e7e8" : "transparent") }; }),
      tlTudo: tl.map((ev, i, arr) => ({ t: ev.t, autor: ev.autor || "", quando: ev.quando || "—",
        dot: "flex:0 0 auto;width:9px;height:9px;border-radius:9999px;margin-top:6px;box-sizing:border-box;" + (i === 0 ? "background:#fe4f2b" : "background:#fff;border:1.5px solid #b8bdbb"),
        linhaFina: "flex:1;width:1.5px;margin-top:5px;background:" + (i < arr.length - 1 ? "#e3e7e8" : "transparent") })),

      abrirEmpresa, abrirPessoa,
      contatoAcoes: [
        { label: tel || "Ligar", dica: tel ? "Ligar pelo Callface" : "Sem telefone cadastrado", d: IC.Ligação[0], onClick: () => tel && Es && Es.abrirExterno ? Es.abrirExterno("https://app.callface.ai/calls?call_to=" + String(tel).replace(/\D/g, "")) : this.diz("Sem telefone cadastrado para " + O.pessoa, "aviso") },
        { label: email ? "E-mail" : "E-mail", dica: email || "Escrever e-mail", d: IC["E-mail"][0], onClick: () => O.leadId ? ir("/atendimento", "Atendimento", { lead: O.leadId, canal: "E-mail" }) : this.diz("Sem e-mail cadastrado", "aviso") },
        { label: "WhatsApp", dica: "Abrir conversa no Atendimento", d: IC.Mensagem[0], onClick: () => O.leadId ? ir("/atendimento", "Atendimento", { lead: O.leadId, canal: "WhatsApp" }) : this.diz(O.pessoa + " ainda não tem conversa", "aviso") }
      ],
      setResp: (e) => { const v = e.target.value; salva({ resp: v }, "Responsável: " + v); },
      orig: (() => {
        const linhas = viaPre
          ? [["Canal", LD ? (LD.origem || "—") : "Pré-vendas"], ["Campanha", (LD && LD.campanha) || "—", !!(LD && LD.campanha)]].concat(LD ? [["Lead", LD.pessoa + " · " + (LD.empresa || "")]] : []).concat([["Criada em", criado], ["Registro", "Automático"]])
          : [["Canal", manual ? "Manual" : (procRot || "—")], ["Criada por", (tl.length ? tl[tl.length - 1].autor : O.resp) || O.resp], ["Criada em", criado]].concat(manual ? [["Registro", "Manual"]] : []);
        return {
          selo: viaPre ? "Automática" : manual ? "Manual" : procRot,
          d: viaPre ? "M22 12h-4l-3 9L9 3l-3 9H2" : "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
          titulo: viaPre ? "Veio do Pré-vendas" : manual ? "Criada manualmente" : procRot ? "Origem: " + procRot : "Origem não informada",
          sub: viaPre ? (LD ? "Lead " + (LD.origem || "inbound") + " qualificado e convertido em oportunidade" : "Lead de origem vinculado à oportunidade") : manual ? "Aberta direto no Pipeline, sem lead de origem" : "",
          linhas: linhas.map(([label, valor, destaque]) => ({ label, valor, valorStyle: "min-width:0;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (destaque ? "#c2330f" : "#12171d") }))
        };
      })(),
      origemLinhas: [
        ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20", "Origem", origem],
        ["M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6", "Campanha", (LD && LD.campanha) || "—"],
        ["M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "Criada em", criado]
      ].map(([d, label, valor]) => ({ d, label, valor })),

      propResumo: props.slice().reverse().slice(0, 3).map(p => { const t = somaP(p); return { codigo: "Proposta #" + p.codigo + "-v" + (p.versao || 1), meta: (p.modo === "PREPAID" ? "Pré-pago" : "Contrato") + (p.validade ? " · validade " + p.validade + " dias" : "") + /* ANTES: "validade undefined dias" (o dado real não manda validade) */ (p.enviadaEm ? " · enviada " + p.enviadaEm : ""),
        status: PROP[p.status] || p.status, statusStyle: statusSelo(p.status), total: brl(t.mrr + t.un), codStyle: "display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (p === P ? "#12171d" : "#8b949e") }; }),
      semPropostas: !props.length,
      relTiles: [
        ["M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4", 1, "Empresa", O.empresa, abrirEmpresa],
        ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", (O.pessoas || []).length || 1, "Contatos", O.pessoa + ((O.pessoas || []).length > 1 ? " e mais " + ((O.pessoas || []).length - 1) : ""), abrirPessoa],
        ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", arqs.length, "Arquivos", arqs.length ? "Propostas e anexos" : "Nenhum arquivo ainda", () => this.setState({ aba: "arq" })],
        ["M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", ordenadas.length, "Atividades", abertos.length ? abertos.length + (abertos.length > 1 ? " abertas" : " aberta") : "Nenhuma aberta", () => this.setState({ aba: "atv" })]
      ].map(([d, n, label, acao, onClick], i) => ({ d, n, label, acao, onClick,
        linha: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:0;background:#fff;cursor:pointer;text-align:left;" + (i ? "border-top:1px solid #eef1f1" : "") })),

      atvFiltros: [["todas", "Todas"], ["abertas", "Abertas"], ["concluidas", "Concluídas"]].map(([k, l]) => ({
        label: l + " · " + ordenadas.filter(o => k === "todas" || (k === "abertas" ? !o.x.feita : o.x.feita)).length,
        style: "height:28px;padding:0 11px;border-radius:7px;border:0;font-size:12px;white-space:nowrap;cursor:pointer;font-weight:" + (S.atvF === k ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
        onClick: () => this.setState({ atvF: k }) })),
      atvs: filtradas.map(({ x, i }, n) => { const sit = x.situacao || (x.feita ? "Feita" : "A fazer"); return {
        titulo: x.titulo, meta: x.tipo + " · " + (x.autor || O.resp) + (x.desc ? " · " + x.desc : ""), quando: x.quando || "sem data", situacao: sit, d: (IC[x.tipo] || IC.Tarefa)[0], ver: () => verAtv(i),
        seloStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;" + (sit === "Feita" ? "background:#e6f4ee;color:#1f7256" : sit === "Declinada" ? "background:#eeeff3;color:#67787c" : sit === "Em andamento" ? "background:#e8f0fb;color:#2c5f9e" : "background:#fff6f4;color:#9c3210"),
        marca: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (x.feita ? "background:#eeeff3;color:#4a5560" : "background:#fff6f4;color:#c2330f"),
        linhaStyle: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 8px;border:0;background:transparent;cursor:pointer;text-align:left;border-radius:8px;" + (n ? "border-top:1px solid #f3f5f5" : "") }; }),
      nt: (() => {
        const txt = S.nota || "", anx = S.notaAnexos || [], ativa = !!S.notaAtiva || !!txt, pode = !!txt.trim() || anx.length > 0;
    // ANTES: RESP_DEMO punha na boca do cliente frases fixas ("Fechamos com outro fornecedor...", "parcelar em 3 vezes") em toda proposta recusada/com ajuste. Ninguém escreveu isso. Agora só aparece o que o cliente de fato registrou (p.resposta / log).
        const chaves = (O.notas || []).map(n => n.chave).filter(Boolean);
        const virtuais = props.map(p => {
          const k = p.status === "ajuste_solicitado" ? "ajuste" : p.status === "recusada" && !p.recusaInterna ? "recusada" : null;
          if (!k) return null;
          const chave = "sis:" + p.codigo + ":" + (p.versao || 1) + ":" + k;
          if (chaves.indexOf(chave) >= 0) return null;
          const cod = "#" + p.codigo + "-v" + (p.versao || 1), txtC = p.resposta || "";
          const ev = (p.log || []).slice().reverse().find(x => x.k === k);
          return { autor: "Sistema", sistema: true, virtual: true, chave, quando: ev ? ev.quando : "Recebido pela proposta",
            tag: "Proposta " + cod + " · " + (k === "ajuste" ? "Ajuste solicitado" : "Recusada"),
            texto: "@" + O.resp + " " + O.pessoa + " " + (k === "ajuste" ? "pediu ajuste na proposta " + cod : "recusou a proposta " + cod) + " pela página da proposta" + (txtC ? ": “" + txtC + "”" : ".") + (k === "ajuste" ? " Crie uma nova versão para responder." : ""), anexos: [] };
        }).filter(Boolean);
        const lista = virtuais.map(n => ({ n, i: -1 })).concat((O.notas || []).map((n, i) => ({ n, i }))).sort((a, b) => (b.n.fixada ? 1 : 0) - (a.n.fixada ? 1 : 0));
        const salvar = () => {
          if (!pode) return;
          const nova = { autor: this.eu, quando: this.agora(), texto: txt.trim(), anexos: anx };
          salva({ notas: [nova].concat(O.notas || []) }, "Nota interna adicionada");
          const menc = TIME.filter(n => txt.indexOf("@" + n) >= 0);
          this.setState({ nota: "", notaAtiva: false, notaAnexos: [] });
          this.diz(menc.length ? menc.join(", ") + (menc.length > 1 ? " vão" : " vai") + " receber o aviso no NEXO" : "Nota adicionada", "ok");
        };
        const mc = mencoesDe(txt, v => this.setState({ nota: v }));
        return {
          conta: lista.length ? lista.length + (lista.length > 1 ? " notas" : " nota") : "",
          texto: txt, ativa, linhas: ativa ? 3 : 1, temMencao: mc.temMencao, mencoes: mc.mencoes,
          caixa: "border-radius:10px;background:" + (ativa ? "#fff" : "#fafafa") + ";box-shadow:inset 0 0 0 1px " + (ativa ? "#a9b1b4" : "#e3e7e8"),
          set: (e) => this.setState({ nota: e.target.value }), foco: () => this.setState({ notaAtiva: true }),
          tecla: (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); salvar(); } if (e.key === "Escape") { this.setState({ nota: "", notaAtiva: false, notaAnexos: [] }); e.currentTarget.blur(); } },
          cancelar: () => this.setState({ nota: "", notaAtiva: false, notaAnexos: [] }), salvar,
          btn: "flex:0 0 auto;height:28px;padding:0 12px;border-radius:7px;border:0;font-size:12px;font-weight:600;cursor:" + (pode ? "pointer;background:#12171d;color:#fff" : "default;background:#eeeff3;color:#a3a8a4"),
          temAnexos: anx.length > 0, anexos: anx.map((a, i) => ({ nome: a.nome, remover: () => this.setState(s => ({ notaAnexos: (s.notaAnexos || []).filter((_, j) => j !== i) })) })),
          anexar: (e) => { const l = Array.from(e.target.files || []).map(x => ({ nome: x.name, tam: Math.max(1, Math.round(x.size / 1024)) + " KB" })); e.target.value = ""; this.setState(s => ({ notaAtiva: true, notaAnexos: (s.notaAnexos || []).concat(l) })); },
          vazia: !lista.length,
          lista: lista.map(({ n, i }, k) => ({ autor: n.sistema ? "Sistema · Callface" : n.autor, ini: ini(n.autor), quando: n.quando, sistema: !!n.sistema, humano: !n.sistema, fixada: !!n.fixada, temTag: !!n.tag, tag: n.tag || "", partes: partesDe(n.texto),
            temAnexos: (n.anexos || []).length > 0, anexos: (n.anexos || []).map(a => ({ nome: a.nome, ext: ((a.nome || "").split(".").pop() || "").slice(0, 4).toUpperCase() })),
            linha: n.sistema ? "display:flex;align-items:flex-start;gap:10px;padding:11px 12px;margin:6px 0;border-radius:10px;background:" + (/Recusada/.test(n.tag || "") ? "#fdf3f0" : "#fff8f5") + ";box-shadow:inset 0 0 0 1px " + (/Recusada/.test(n.tag || "") ? "#f0c3b6" : "#f6d9cf") : "display:flex;align-items:flex-start;gap:10px;padding:10px 2px;" + (k ? "border-top:1px solid #f3f5f5" : ""),
            tagStyle: "display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:5px;font-size:10px;font-weight:700;" + (n.sistema ? "background:#fff;color:#c2330f;box-shadow:inset 0 0 0 1px #f0c3b6" : "background:#eeeff3;color:#4a5560"),
            fixarTitulo: n.fixada ? "Desafixar" : "Fixar no topo",
            fixarStyle: "width:26px;height:26px;border-radius:6px;border:0;display:grid;place-items:center;cursor:pointer;background:transparent;color:" + (n.fixada ? "#c2330f" : "#8b949e"),
            fixar: () => { if (i < 0) { const cp = Object.assign({}, n, { fixada: true }); delete cp.virtual; return salva({ notas: [cp].concat(O.notas || []) }); } const x = (O.notas || []).slice(); x[i] = Object.assign({}, n, { fixada: !n.fixada }); salva({ notas: x }); },
            remover: () => { salva({ notas: (O.notas || []).filter((_, j) => j !== i) }, "Nota interna excluída"); this.diz("Nota excluída", "aviso"); } }))
        };
      })(),
      semAtvs: !filtradas.length,
      atvMaisGeral: filtradas.length > 5, irAtividades: () => this.setState({ aba: "atv" }),
      atvVazia: S.atvF === "abertas" ? "Nenhuma atividade aberta" : S.atvF === "concluidas" ? "Nenhuma atividade concluída" : "Nenhuma atividade ainda",

      arquivos: arqs, semArq: !arqs.length,
      arqRef: this.arqRef,
      anexar: () => this.arqRef.current && this.arqRef.current.click(),
      anexou: (e) => { const l = Array.from(e.target.files || []); if (!l.length) return; salva({ arquivos: (O.arquivos || []).concat(l.map(x => ({ nome: x.name, quando: "hoje", autor: O.resp }))) }, l.length === 1 ? "Arquivo anexado: " + l[0].name : l.length + " arquivos anexados"); e.target.value = ""; },

      pa: (() => {
        const A = S.propAcao; if (!A || !props[A.i]) return { aberto: false };
        const p = props[A.i], cod = "#" + p.codigo + "-v" + (p.versao || 1), exc = A.k === "excluir", nv = A.k === "versao";
        const txt = (A.txt || "").trim(), ok = exc || txt.length >= 10;
        const fechar = () => this.setState({ propAcao: null });
        if (nv) return { aberto: true, fechar, exc: false, rec: false, nv: true,
          titulo: "Proposta enviada não pode ser alterada",
          sub: "A " + cod + " já está com o cliente. Para ajustar, crie a v" + ((p.versao || 1) + 1) + ": ela começa com tudo da " + cod + " e, quando for enviada, a " + cod + " passa a Substituída. O histórico continua na oportunidade.",
          icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:10px;background:#eeeff3;color:#12171d;display:grid;place-items:center", icoD: "M12 5v14M5 12h14",
          confTxt: "Criar nova versão", confStyle: "height:38px;padding:0 16px;border-radius:9px;border:0;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer;color:#fff;background:#12171d",
          confirmar: () => { this.setState({ propAcao: null }); novaProposta(); } };
        return { aberto: true, fechar, exc, rec: !exc, nv: false,
          icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:10px;background:#fdeeea;color:#c2330f;display:grid;place-items:center", icoD: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
          titulo: exc ? "Excluir rascunho " + cod + "?" : "Marcar " + cod + " como recusada",
          sub: exc ? "O rascunho some da oportunidade. Isso não pode ser desfeito." : "Use quando o cliente recusou por fora da página da proposta (ligação, reunião, WhatsApp).",
          txt: A.txt || "", setTxt: (e) => this.setState({ propAcao: Object.assign({}, A, { txt: e.target.value }) }),
          erro: !!A.tentou && !ok, contagem: txt.length + (txt.length < 10 ? " / mín. 10" : ""),
          confTxt: exc ? "Excluir rascunho" : "Marcar como recusada",
          confStyle: "height:38px;padding:0 16px;border-radius:9px;border:0;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer;color:#fff;background:" + (ok ? "#d93c1a" : "#e3a595"),
          txStyle: "width:100%;padding:10px 12px;border-radius:10px;border:0;outline:0;resize:vertical;background:#fff;font-size:13px;line-height:1.5;color:#12171d;box-shadow:inset 0 0 0 1px " + (A.tentou && !ok ? "#d93c1a" : "#dbdede"),
          confirmar: () => {
            if (!ok) return this.setState({ propAcao: Object.assign({}, A, { tentou: true }) });
            if (exc) { const a = props.slice(); a.splice(A.i, 1); this.setState({ propAcao: null }); return salva({ propostas: a }, "Rascunho " + cod + " excluído"); }
            const d = new Date(), q = "Hoje, " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
            const logAnt = p.log || [{ k: "enviada", quando: (p.enviadaEm || "Hoje") + ", 10:14", quem: O.resp }];
            this.setState({ propAcao: null });
            const a = props.slice(); a[A.i] = Object.assign({}, p, { status: "recusada", recusaInterna: true, resposta: txt, log: logAnt.concat([{ k: "recusada", quando: q, quem: O.resp, texto: txt, interna: true }]) });
            const nSis = { autor: "Sistema", sistema: true, chave: "sis:" + p.codigo + ":" + (p.versao || 1) + ":recusada", quando: q, tag: "Proposta " + cod + " · Recusada",
              texto: "@" + O.resp + " a proposta " + cod + " foi marcada como recusada por " + O.resp + ". Motivo informado pelo cliente: “" + txt + "”", anexos: [] };
            salva({ propostas: a, notas: [nSis].concat(O.notas || []) }, "Proposta " + cod + " recusada · " + txt.slice(0, 60));
          } };
      })(),
      tg: { tags: (O.tags || []).map(n => { const t = (this.dadosDoProto.TagsOpp || []).find(x => x.nome === n) || (((this.E && this.E.ler("tagsCriadas", [])) || []).find(x => x && x.nome === n)) || {};
          return { nome: n, auto: !!t.auto, style: "display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:600;white-space:nowrap;" + (t.auto ? "background:#fff6f4;color:#c2330f;box-shadow:inset 0 0 0 1px #f6d3c9" : "background:#eeeff3;color:#1f252c") }; }),
        abrirTags: () => this.E && this.E.abrir("tagsopp", O.id),
        nota: (() => { const n = (O.tags || []).filter(x => ((this.dadosDoProto.TagsOpp || []).find(t => t.nome === x) || {}).auto).length; return n ? n + (n > 1 ? " automações ativas" : " automação ativa") : ""; })() },
      propTitulo: props.length + (props.length === 1 ? " proposta" : " propostas") + (P ? " · vigente #" + P.codigo + "-v" + (P.versao || 1) : ""),
      propostas: props.map((p, i) => {
        const t = somaP(p), vig = p === P, ab = S.abertas[i] !== undefined ? S.abertas[i] : vig;
        const btn = (label, onClick, forte) => ({ label, onClick, style: "height:30px;padding:0 11px;border-radius:8px;border:0;font-size:12px;font-weight:600;cursor:pointer;" + (forte ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") });
        const cod = "#" + p.codigo + "-v" + (p.versao || 1);
        const agora = () => { const d = new Date(); return "Hoje, " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
        const ver = btn("Ver proposta", () => p.id ? Es.abrir("proposta", p.id) : ir("/onface-preview/proposta", "Proposta", { opp: O.id, ver: String(i) }));
        const acoes = [ver];
        if (vig && p.status === "rascunho") {
          acoes.push(btn("Enviar ao cliente", () => p.id ? ir("/propostas/" + p.id + "?acao=enviar") : this.diz("Salve a proposta antes de enviar", "aviso"), true));
          acoes.push(Object.assign(btn("Excluir rascunho", () => this.setState({ propAcao: { i, k: "excluir" } })), { style: "height:30px;padding:0 11px;border-radius:8px;border:0;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:#c2330f" }));
        } else if (vig && ["enviada", "visualizada", "ajuste_solicitado"].indexOf(p.status) >= 0) {
          acoes.push(btn("Ajustar proposta", () => this.setState({ propAcao: { i, k: "versao" } }), p.status === "ajuste_solicitado"));
          acoes.push(btn("Recusada", () => this.setState({ propAcao: { i, k: "recusar", txt: "" } })));
        }
        // acompanhamento
    // ANTES: RESP_DEMO punha na boca do cliente frases fixas ("Fechamos com outro fornecedor...", "parcelar em 3 vezes") em toda proposta recusada/com ajuste. Ninguém escreveu isso. Agora só aparece o que o cliente de fato registrou (p.resposta / log).
        const base = p.enviadaEm && p.enviadaEm !== "Hoje" ? p.enviadaEm : null;
        const log = p.log || (p.status === "rascunho" ? [] : [{ k: "enviada", quando: (base || "Hoje") + ", 10:14", quem: O.resp }]
          .concat(["visualizada", "ajuste_solicitado", "aceita", "recusada"].indexOf(p.status) >= 0 ? [{ k: "visualizada", quando: (base || "Hoje") + ", 14:32" }, { k: "revista", quando: "No dia seguinte, 09:05" }] : [])
          .concat(p.status === "ajuste_solicitado" ? [{ k: "ajuste", quando: "—" /* ANTES: horário fixo inventado "09:21"; o banco não guarda esse instante */, quem: O.pessoa, texto: p.resposta || "" }] : [])
          .concat(p.status === "aceita" ? [{ k: "aceita", quando: "No dia seguinte, 11:40", quem: O.pessoa }] : [])
          .concat(p.status === "recusada" ? [{ k: "recusada", quando: "—" /* ANTES: horário fixo inventado "16:02" */, quem: p.recusaInterna ? O.resp : O.pessoa, texto: p.resposta || "", interna: !!p.recusaInterna }] : []));
        const LOGT = { enviada: ["Enviada", "M22 2 11 13M22 2l-7 20-4-9-9-4z", "#2c5f9e"], visualizada: ["Aberta pela primeira vez", "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "#6e5420"], revista: ["Vista novamente", "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "#8b949e"], ajuste: ["Ajuste solicitado", "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z", "#c2330f"], aceita: ["Aceita", "M20 6 9 17l-5-5", "#1f7256"], recusada: ["Recusada", "M18 6 6 18M6 6l12 12", "#c2330f"] };
        const nViews = log.filter(x => x.k === "visualizada" || x.k === "revista").length;
        const resp = log.slice().reverse().find(x => x.texto);
        const RT = { ajuste: ["Pedido de ajuste", "#fff6f4", "#f6d3c9", "#9c3210"], recusada: ["Motivo da recusa", "#fdeeea", "#f0b4a4", "#9c3210"] };
        const rtt = resp ? RT[resp.k] : null;
        return { codigo: "#" + p.codigo + "-v" + (p.versao || 1), status: PROP[p.status] || p.status, statusStyle: statusSelo(p.status),
          codStyle: "font-size:13.5px;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums;color:" + (vig ? "#12171d" : "#8b949e"),
          meta: (p.modo === "PREPAID" ? "Pré-pago / Checkout" : "Contrato") + (p.validade ? " · validade " + p.validade + " dias" : "") + /* ANTES: "validade undefined dias" (o dado real não manda validade) */ (p.enviadaEm ? " · enviada " + p.enviadaEm : ""),
          total: brl(t.mrr + t.un), totalLinha: "Total: " + brl(t.mrr + t.un), rec: t.mrr ? "Recorrente: " + brl(t.mrr) + "/mês" : "Sem recorrente",
          aberta: ab, chev: "flex:0 0 auto;transition:transform .15s;transform:rotate(" + (ab ? 0 : -90) + "deg)",
          alternar: () => this.setState(st => ({ abertas: Object.assign({}, st.abertas, { [i]: !ab }) })),
          itens: (p.itens || []).map(it => ({ nome: it.nome + ((+it.qtd || 1) > 1 ? " × " + it.qtd : ""), natureza: NAT[it.natureza] || "", valor: brl((+it.valor || 0) * (+it.qtd || 1)) })),
          acoes,
          temLog: log.length > 0,
          logResumo: [nViews ? nViews + (nViews > 1 ? " visualizações" : " visualização") : "Ainda não aberta", log.length ? "última " + log[log.length - 1].quando.toLowerCase() : ""].filter(Boolean).join(" · "),
          log: log.map((x, k) => { const T = LOGT[x.k] || [x.k, "M12 8v4", "#67787c"]; return { t: T[0] + (x.quem ? " · " + (x.interna ? "marcada por " : "por ") + x.quem : ""), quando: x.quando, d: T[1],
            ico: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:" + T[2],
            linha: k < log.length - 1 ? "position:absolute;left:10.5px;top:24px;bottom:-6px;width:1px;background:#e3e7e8" : "display:none" }; }),
          temResp: !!rtt, respTit: rtt ? rtt[0] + (resp.interna ? " · registrado por " + resp.quem : " · " + (resp.quem || "cliente")) : "", respTxt: resp ? resp.texto : "",
          respStyle: rtt ? "padding:12px 14px;border-radius:10px;background:" + rtt[1] + ";box-shadow:inset 0 0 0 1px " + rtt[2] : "",
          respTitStyle: rtt ? "display:block;font-size:11.5px;font-weight:700;color:" + rtt[3] : "",
          temAceite: p.status === "aceita", aceiteTxt: "Aceita por " + O.pessoa + (log.find(x => x.k === "aceita") ? " · " + log.find(x => x.k === "aceita").quando.toLowerCase() : "") + (p.modo === "PREPAID" ? ". Pagamento pelo checkout." : ". Contrato enviado para assinatura.") };
      }),

      temModal: !!md, m,
      naturezas: Object.keys(NAT).map(k => ({ v: k, l: NAT[k] })),
      fecharModal: () => this.setState({ modal: null, form: {}, tentou: false })
    });
    R.atvsGeral = R.atvs.slice(0, 5);
    return R;
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <OportunidadeDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as OportunidadeLiga };
