// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Pecas — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * PecasDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `PecasDesenho.tsx`, convertido por máquina e intocável.
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
import { toast } from "sonner";

import { PecasDesenho } from "./PecasDesenho";
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
    abrirExterno: (url: string) => this.props.abrirExterno?.(url),
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

  constructor(props) {
    super(props);
    const E = null as any; // o store só existe depois do construtor
    const d: any = this.props.dados ?? {};
    this.state = {
      detalhe: false, detalheId: null,
      cadPausada: false, nutrir: false, motivo: null, data: "",
      atvAberta: false, atvModo: "ver", atvDraft: null,
      cadPicker: false, timelineTudo: false, secDrawer: null,
      cadModal: false, cadEscolha: null, cadOrigens: {},
      tagMenu: null, tagRect: null, tagNova: "",
      intMenu: false, intRect: null, dropMenu: null, dropRect: null, convAberto: false, convTexto: "",
      saidaMenu: false,
      desqAberto: false, desqMotivo: null, desqObs: "",
      vincAberto: false, vincModo: "vincular", vincBusca: "", vincSel: null, vincNova: {}, vincTentou: false,
      qualAberto: false, qualDados: {}, qualMenu: false, qualRect: null, qualPasso: "dados", qualOpp: {}, qualOkTitulo: "", qualOkNota: "", qualTentou: false, qualDestino: null,
      leads: d.leads || [],
      qual: d.qual || {}, cadencias: d.cadencias || {}, atvs: d.atvs || {},
      tagsLead: d.tagsLead || {}, tagsCriadas: d.tagsCriadas || []
    };
    this.qualRef = React.createRef();
  }

  componentDidMount() {
    this._ultimo = this.fotoEstado();
    const ligar = () => {
      const E = this.E;
      if (!E || this._offPecas) return !!this._offPecas;
      const puxar = (d) => {
        const patch = {};
        ["leads", "qual", "cadencias", "atvs", "tagsLead", "tagsCriadas"].forEach(k => {
          if (d[k] !== undefined && d[k] !== this.state[k]) patch[k] = d[k];
        });
        if (Object.keys(patch).length) this.setState(patch);
      };
      this._offEstado = E.assinar(puxar);
      this._offPecas = E.assinarPecas((peca, leadId) => this.abrirPeca(peca, leadId));
      puxar(E.tudo());
      this._ultimo = this.fotoEstado();
      return true;
    };
    if (!ligar()) this._ligarT = setInterval(() => { if (ligar()) clearInterval(this._ligarT); }, 50);
    this._k = (e) => {
      if (e.key !== "Escape") return;
      if (this.state.atvAberta) return this.setState({ atvAberta: false, atvDraft: null });
      if (this.state.dropMenu) return this.setState({ dropMenu: null });
      if (this.state.intMenu) return this.setState({ intMenu: false });
      if (this.state.tagMenu) return this.setState({ tagMenu: null });
      if (this.state.cadModal) return this.setState({ cadModal: false });
      if (this.state.qualMenu) return this.setState({ qualMenu: false });
      if (this.state.qualAberto) return this.setState({ qualAberto: false, qualDados: {}, qualMenu: false });
      if (this.state.vincAberto) return this.setState({ vincAberto: false });
      if (this.state.desqAberto) return this.setState({ desqAberto: false, desqMotivo: null, desqObs: "" });
      if (this.state.saidaMenu) return this.setState({ saidaMenu: false });
      if (this.state.nutrir) return this.setState({ nutrir: false, motivo: null, data: "" });
      if (this.state.detalhe) this.setState({ detalhe: false, cadPicker: false, timelineTudo: false });
    };
    document.addEventListener("keydown", this._k);
    this._fora = (e) => {
      const alvo = e.target;
      const dentro = (sel) => alvo && alvo.closest && alvo.closest(sel);
      const mudar = {};
      if (this.state.saidaMenu && !dentro("[data-of-saida]")) mudar.saidaMenu = false;
      if (this.state.qualMenu && !dentro("[data-of-qualmenu]")) mudar.qualMenu = false;
      if (this.state.tagMenu && !dentro("[data-of-tagmenu]")) mudar.tagMenu = null;
      if (this.state.intMenu && !dentro("[data-of-intmenu]")) mudar.intMenu = false;
      if (this.state.dropMenu && !dentro("[data-of-dropmenu]")) mudar.dropMenu = null;
      if (Object.keys(mudar).length) this.setState(mudar);
    };
    document.addEventListener("pointerdown", this._fora, true);
    this._resize = () => { if (this.state.tagMenu || this.state.intMenu || this.state.dropMenu) this.setState({ tagMenu: null, intMenu: false, dropMenu: null }); };
    window.addEventListener("resize", this._resize);
  }

  fotoEstado() {
    const f = {};
    ["leads", "qual", "cadencias", "atvs", "tagsLead", "tagsCriadas"].forEach(k => { f[k] = this.state[k]; });
    return f;
  }

  componentDidUpdate() {
    const anterior = this._ultimo || this.fotoEstado();
    this._ultimo = this.fotoEstado();
    const E = this.E;
    if (!E) return;
    const patch = {};
    ["leads", "qual", "cadencias", "atvs", "tagsLead", "tagsCriadas"].forEach(k => {
      if (anterior[k] !== this.state[k]) patch[k] = this.state[k];
    });
    if (Object.keys(patch).length) E.gravar(patch);
  }

  componentWillUnmount() {
    clearInterval(this._ligarT);
    if (this._offEstado) this._offEstado();
    if (this._offPecas) this._offPecas();
    document.removeEventListener("keydown", this._k);
    document.removeEventListener("pointerdown", this._fora, true);
    window.removeEventListener("resize", this._resize);
    if (this._offEstado) this._offEstado();
    if (this._offPecas) this._offPecas();
    clearTimeout(this._qk);
  }

  abrirPeca(peca, leadId) {
    const base = leadId ? { detalheId: leadId } : {};
    if (peca === "detalhe") return this.setState(Object.assign({}, base, { detalhe: true }));
    if (peca === "nutrir") return this.setState(Object.assign({}, base, { nutrir: true, motivo: null, data: "" }));
    if (peca === "desqualificar") return this.setState(Object.assign({}, base, { desqAberto: true, desqMotivo: null, desqObs: "" }));
    if (peca !== "oportunidade") window.__ofContatoOpp = null;
    if (peca === "qualificar") return this.setState(Object.assign({}, base, { qualContato: null, qualAberto: true, qualDados: {}, qualMenu: false, qualTentou: false, qualPasso: "dados", qualOpp: {}, qualDestino: null }));
    if (peca === "oportunidade") {
      const L = (this.state.leads || []).find(x => x.id === leadId);
      if (!L || !L.empresa) return this.diz("Bloqueado: lead sem empresa associada", "erro");
      const jaQualificado = L.etapa === "qualificado";
      return this.setState(Object.assign({}, base, {
        qualAberto: true, qualDados: {}, qualMenu: false, qualTentou: false, qualOpp: {},
        qualPasso: jaQualificado ? "opp" : "dados", qualDestino: "opp",
        qualOkTitulo: "Oportunidade criada", qualOkNota: "O lead seguiu para o Pipeline.",
        qualContato: window.__ofContatoOpp || null, qualEmpresa: null
      }));
    }
    if ((peca === "atividade" || peca === "atividade-ver" || peca === "atividade-nova") && this.E && !/atividades/i.test(decodeURIComponent(window.location.pathname))) {
      const E2 = this.E, L0 = (this.state.leads || []).find(x => x.id === leadId);
      if (peca === "atividade-ver" && L0 && L0.acao) return E2.abrir("verAtividade", "l:" + leadId);
      return E2.abrir("novaAtividade", { lead: leadId || "" });
    }
    if (peca === "atividade") return this.setState(Object.assign({}, base, { atvAberta: true, atvModo: "editar", atvDraft: null }));
    if (peca === "vincular") return this.setState(Object.assign({}, base, { vincAberto: true, vincModo: "vincular", vincBusca: "", vincSel: null, vincNova: { nome: "", cnpj: "", site: "", segmento: "" }, vincTentou: false }));
    if (peca === "atividade-ver" || peca === "atividade-nova") {
      const L = (this.state.leads || []).find(x => x.id === leadId);
      const nova = peca === "atividade-nova" || !(L && L.acao);
      return this.setState(Object.assign({}, base, { atvAberta: true, atvModo: nova ? "editar" : "ver", atvDraft: nova ? this.atvVazia(L) : null }));
    }
    if (peca === "cadencia") { const alvo = window.__ofCadAlvo || null; window.__ofCadAlvo = null; return this.setState(Object.assign({}, base, { cadModal: true, cadEscolha: null, cadAlvo: alvo })); }
  }

  /** O aviso do protótipo é o toast do produto. */
  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto);
    else toast(texto);
  }

  ir(href, label) {
    const E = this.E;
    if (E) E.irPara(href, label);
  }

  criarTagLead(id) {
    const nome = (this.state.tagNova || "").trim();
    if (!nome) return this.diz("Escreva o nome da tag", "erro");
    this.setState(s => ({
      tagsCriadas: (s.tagsCriadas || []).indexOf(nome) >= 0 ? s.tagsCriadas : (s.tagsCriadas || []).concat(nome),
      tagsLead: Object.assign({}, s.tagsLead, { [id]: ((s.tagsLead || {})[id] || []).concat(nome) }),
      tagNova: ""
    }));
    this.diz("Tag " + nome + " criada e aplicada", "ok");
  }

  atvVazia(L) {
    return { tipo: "Follow up", situacao: "A fazer", titulo: "", desc: "", data: "", hora: "", resp: (L && L.resp) || this.eu };
  }

  setQual(id, campo, valor, padrao) {
    this.setState(s => {
      const base = Object.assign({}, padrao || {}, s.qual[id] || {});
      return { qual: Object.assign({}, s.qual, { [id]: Object.assign(base, { [campo]: valor }) }) };
    });
  }

  setAtv(id, patch, padrao) {
    this.setState(s => {
      const base = Object.assign({}, padrao || {}, s.atvs[id] || {});
      return { atvs: Object.assign({}, s.atvs, { [id]: Object.assign(base, patch) }) };
    });
  }

  renderVals() {
    const S = this.state;
    const iniciaisDe = (n) => n ? n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() : "—";
    const L0 = S.leads.find(x => x.id === S.detalheId) || S.leads[0];
    const rotuloEtapa = { novo: "Novo", em_contato: "Em contato", qualificacao: "Qualificação", qualificado: "Qualificado", oportunidade: "Oportunidade", nutricao: "Nutrição", desqualificado: "Desqualificado" };
    const corEtapa = { novo: "#4a5560", em_contato: "#4c8fe0", qualificacao: "#9b8bd8", qualificado: "#2f9e7a", oportunidade: "#fe4f2b", nutricao: "#c8a86a", desqualificado: "#4a5560" };
    const slug = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    /* Cadência só existe se estiver REGISTRADA para este lead. O protótipo
        deduzia o nome e o passo da etapa — lead em Qualificação virava
        "Primeiro contato, passo 3 de 5" sem nenhuma inscrição no banco. Hoje
        `cadence_enrollments` tem 0 linhas: toda cadência mostrada na gaveta era
        inventada. Sem passo real, a barra de progresso não é desenhada. */
    const cadAtual = L0 && S.cadencias.hasOwnProperty(L0.id) ? S.cadencias[L0.id] : null;
    const cadPassoReal = L0 && S.cadPassos ? S.cadPassos[L0.id] : null;
    /* Qualificação só mostra o que alguém preencheu. O protótipo preenchia
        sozinho: tamanho "45" fixo, dor tirada de um dicionário pelo interesse e
        fit "Alto"/"Médio" pela tag. A gaveta dizia "2 de 4 campos" sem ninguém
        ter respondido nada. */
    const qualPadrao = {};
    const qualLead = L0 ? Object.assign({}, qualPadrao, S.qual[L0.id] || {}) : {};
    const qualPreenchidos = ["interesse", "tamanho", "dor", "fit"].filter(k => qualLead[k]).length;
    const atvPadrao = L0 ? {
      tipo: L0.acao && L0.acao.indexOf("Ligar") === 0 ? "Ligação" : L0.acao && L0.acao.indexOf("E-mail") === 0 ? "E-mail" : L0.acao && L0.acao.indexOf("Reunião") === 0 ? "Reunião" : "Follow up",
      situacao: "A fazer",
      titulo: L0.acao || "",
      desc: "",
      data: "", hora: "",
      resp: L0.resp || this.eu
    } : {};
    const ehDraft = !!S.atvDraft;
    const atvLead = ehDraft ? S.atvDraft : (L0 ? Object.assign({}, atvPadrao, S.atvs[L0.id] || {}) : {});
    const mudaAtv = (patch) => ehDraft
      ? this.setState(s => ({ atvDraft: Object.assign({}, s.atvDraft, patch) }))
      : this.setAtv(L0.id, patch, atvPadrao);
    const det = L0 ? {
      pessoa: L0.pessoa, cargo: L0.cargo,
      empresa: L0.empresa || "Sem empresa",
      semEmpresa: !L0.empresa,
      iniciais: iniciaisDe(L0.pessoa),
      avatarStyle: "flex:0 0 auto;width:38px;height:38px;border-radius:9999px;display:grid;place-items:center;font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;background:#eeeff3;color:#4a5560",
      telefone: "+55 11 9" + (7000 + (L0.id.charCodeAt(1) * 37) % 2999) + "-" + (1000 + (L0.id.charCodeAt(1) * 53) % 8999),
      email: slug(L0.pessoa.split(" ")[0]) + "@" + slug(L0.empresa || "semempresa") + ".com.br",
      toques: [
        { label: "Ligar", d: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39", onClick: () => {
          let num = ("+55 11 9" + (7000 + (L0.id.charCodeAt(1) * 37) % 2999) + "-" + (1000 + (L0.id.charCodeAt(1) * 53) % 8999)).replace(/\D/g, "");
          if (num.length > 11 && num.indexOf("55") === 0) num = num.slice(2);
          (this.E ? this.E.abrirExterno("https://app.callface.ai/calls?call_to=" + num) : window.open("https://app.callface.ai/calls?call_to=" + num, "_blank"));
          this.diz("Abrindo o Callface para ligar para " + (L0.pessoa || "").split(" ")[0], "ok");
        } },
        { label: "WhatsApp", d: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", onClick: () => { const E = this.E; if (E) E.irPara("/atendimento", "Atendimento", { lead: L0.id, canal: "WhatsApp" }); } },
        { label: "E-mail", d: "M4 4h16v16H4zM4 7l8 6 8-6", onClick: () => { const E = this.E; if (E) E.irPara("/atendimento", "Atendimento", { lead: L0.id, canal: "E-mail" }); } }
      ],
      cad: (() => {
        const ic = {"wa":"M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z","tel":"M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39","mail":"M4 4h16v16H4zM4 7l8 6 8-6","task":"M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"};
        const fluxos = [
          { k: "Primeiro contato", cor: "#4c8fe0", descricao: "Abertura em três canais nos primeiros cinco dias — para lead inbound recém-chegado.",
            passos: [
              ["Dia 0", "WhatsApp de abertura", "Mensagem curta citando a campanha de origem", "wa"],
              ["Dia 0", "Ligação de conexão", "Tentativa no mesmo dia, até 2 toques", "tel"],
              ["Dia 2", "E-mail com case", "Case do segmento do lead", "mail"],
              ["Dia 4", "WhatsApp de retomada", "Pergunta única, sem material", "wa"],
              ["Dia 5", "Tarefa de decisão", "Seguir, nutrir ou desqualificar", "task"]
            ] },
          { k: "Prospecção inbound", cor: "#9b8bd8", descricao: "Cadência longa para lead que baixou material mas não pediu contato.",
            passos: [
              ["Dia 0", "E-mail de boas-vindas", "Confirma o material e oferece conversa", "mail"],
              ["Dia 3", "WhatsApp leve", "Checagem de interesse", "wa"],
              ["Dia 7", "Ligação", "Janela comercial da manhã", "tel"],
              ["Dia 10", "Tarefa de decisão", "Encerrar ou mover para nutrição", "task"]
            ] },
          { k: "Pós-proposta", cor: "#fe4f2b", descricao: "Acompanhamento após proposta enviada — pressão leve e prazo claro.",
            passos: [
              ["Dia 1", "WhatsApp de confirmação", "Confirma o recebimento da proposta", "wa"],
              ["Dia 3", "Ligação de dúvidas", "Abre espaço para objeção", "tel"],
              ["Dia 6", "E-mail com prazo", "Reforça validade comercial", "mail"],
              ["Dia 8", "Tarefa de decisão", "Fechar, renegociar ou perder", "task"]
            ] },
          { k: "Reativação", cor: "#c8a86a", descricao: "Retoma lead parado há mais de 30 dias, com toque único por semana.",
            passos: [
              ["Dia 0", "E-mail de retomada", "Novidade do produto desde o último contato", "mail"],
              ["Dia 7", "WhatsApp", "Pergunta sobre o momento atual", "wa"],
              ["Dia 14", "Tarefa de decisão", "Nutrir ou arquivar", "task"]
            ] }
        ];
        const escolha = S.cadEscolha || "Primeiro contato";
        const atual = fluxos.find(x => x.k === escolha) || fluxos[0];
        const canaisDe = (fx) => {
          const c = {};
          fx.passos.forEach(p => { c[p[3]] = (c[p[3]] || 0) + 1; });
          return c;
        };
        const rotulos = { wa: "WhatsApp", tel: "Telefone", mail: "E-mail", task: "Tarefa" };
        const cores = { wa: "background:#eeeff3;color:#4a5560", tel: "background:#eeeff3;color:#4a5560", mail: "background:#eeeff3;color:#4a5560", task: "background:#12171d;color:#fff" };
        const usa = canaisDe(atual);
        const numeros = S.cadOrigens || {};
        const bancos = {
          wa: [["+55 11 4003-2210", "Comercial · SP"], ["+55 11 98877-1200", "Camila Reis"], ["+55 41 3030-8800", "Sul"]],
          tel: [["+55 11 4003-2200", "Tronco comercial"], ["+55 11 4003-2244", "Discador pré-vendas"]],
          mail: [["comercial@callface.com.br", "Caixa comercial"], ["camila@callface.com.br", "Camila Reis"]]
        };
        const inp = "width:100%;height:36px;padding:0 30px 0 11px;border-radius:8px;background:#fff;outline:0;font-size:12.5px;font-family:inherit;border:1px solid #dbdede;appearance:none;cursor:pointer";
        const estiloSel = { width: "100%", height: "36px", padding: "0 30px 0 11px", borderRadius: "8px", background: "#fff", outline: 0, fontSize: "12.5px", fontFamily: "inherit", border: "1px solid #dbdede", appearance: "none", cursor: "pointer", color: "#1f252c" };
        const precisa = Object.keys(bancos).filter(k => usa[k]);
        const valorDe = (k) => numeros[k] || bancos[k][0][0];
        return {
          aberto: !!S.cadModal,
          fechar: () => this.setState({ cadModal: false }),
          nome: atual.k,
          descricao: atual.descricao,
          selectStyle: inp,
          lista: fluxos.map(fx => {
            const on = fx.k === escolha;
            const c = canaisDe(fx);
            return {
              nome: fx.k,
              resumo: fx.passos.length + " passos · " + fx.passos[fx.passos.length - 1][0].toLowerCase(),
              ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + (on ? "#fe4f2b" : "#c8ccc9"),
              icones: Object.keys(c).filter(k => k !== "task").map(k => ({ d: ic[k] })),
              style: "display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:9px 10px;border-radius:9px;border:0;cursor:pointer;text-align:left;transition:background 120ms cubic-bezier(0,0,.2,1);"
                + (on ? "background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#12171d" : "background:transparent;color:#1f252c"),
              onClick: () => this.setState({ cadEscolha: fx.k })
            };
          }),
          passos: atual.passos.map((p, i) => ({
            quando: p[0], titulo: p[1], nota: p[2], d: ic[p[3]],
            temLinha: i < atual.passos.length - 1,
            marcaStyle: "flex:0 0 auto;width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;" + (i === 0 ? "background:#fe4f2b;color:#fff" : cores[p[3]])
          })),
          canais: Object.keys(usa).map(k => ({
            label: rotulos[k], d: ic[k], conta: usa[k] + (usa[k] > 1 ? " toques" : " toque"),
            style: "display:inline-flex;align-items:center;gap:6px;height:27px;padding:0 10px;border-radius:8px;font-size:11.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#1f252c"
          })),
          origens: precisa.map(k => ({
            label: rotulos[k], d: ic[k],
            selo: "flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#eeeff3;color:#4a5560",
            campo: React.createElement("select", {
              value: valorDe(k), style: estiloSel,
              onChange: (e) => {
                const v = e.target.value;
                this.setState(s => ({ cadOrigens: Object.assign({}, s.cadOrigens, { [k]: v }) }));
              }
            }, bancos[k].map(([v, nota]) => React.createElement("option", { key: v, value: v }, v + " · " + nota)))
          })),
          rodape: atual.passos.length + " toques · primeiro disparo hoje",
          btnLabel: (cadAtual ? "Trocar para esta cadência" : "Inserir na cadência"),
          btnStyle: "height:34px;padding:0 15px;border-radius:8px;background:#d93c1a;color:#fff;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;border:0;cursor:pointer",
          confirmar: () => {
            const alvo = S.cadAlvo;
            const id = alvo ? alvo.chave : L0.id;
            this.setState(s => ({ cadencias: Object.assign({}, s.cadencias, { [id]: escolha }), cadModal: false, cadPausada: false, cadAlvo: null }));
            this.diz((alvo ? alvo.nome : "Lead") + " inserido em " + escolha + " — primeiro toque sai hoje", "ok");
          }
        };
      })(),

      sec: (() => {
        const padrao = { cad: true, acao: true, qualif: false, timeline: false };
        const est = S.secDrawer || {};
        const mk = (k) => {
          const aberta = est.hasOwnProperty(k) ? est[k] : padrao[k];
          return {
            aberta, fechada: !aberta,
            chevron: "flex:0 0 auto;transition:transform .14s cubic-bezier(.2,0,.2,1);transform:rotate(" + (aberta ? 90 : 0) + "deg)",
            cabStyle: "display:flex;align-items:center;gap:8px;width:100%;padding:8px;border-radius:8px;border:0;background:transparent;cursor:pointer;text-align:left;transition:background 120ms cubic-bezier(0,0,.2,1)",
            alternar: () => this.setState(s => ({ secDrawer: Object.assign({}, padrao, s.secDrawer, { [k]: !aberta }) }))
          };
        };
        return { cad: mk("cad"), acao: mk("acao"), qualif: mk("qualif"), timeline: mk("timeline") };
      })(),
      cadResumo: (cadAtual ? cadAtual : "Fora de cadência"),
      acaoResumo: L0.acao ? (L0.venceEm ? L0.acao + " · " + L0.venceEm : L0.acao) : "Sem próxima ação",
      acaoResumoStyle: "font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px;"
        + (L0.acao ? "color:#67787c" : "color:#c2330f;font-weight:600"),
      timelineConta: "5 eventos",
      etapa: rotuloEtapa[L0.etapa],
      etapaPonto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + corEtapa[L0.etapa],
      trocarEtapa: (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        this.setState(s => ({ dropMenu: s.dropMenu === "etapa" ? null : "etapa", dropRect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } }));
      },
      dropAberto: !!S.dropMenu,
      dropTitulo: S.dropMenu === "resp" ? "RESPONSÁVEL" : "MOVER PARA",
      dropStyle: (() => {
        const r = S.dropRect;
        const vh = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerHeight : 900) : 800;
        const alto = S.dropMenu === "resp" ? 170 : 330;
        const paraCima = !!r && (vh - r.bottom - 12) < alto && r.top > vh - r.bottom;
        const pos = r ? (paraCima ? "bottom:" + (vh - r.top + 6) + "px;" : "top:" + (r.bottom + 6) + "px;") + "left:" + r.left + "px;width:" + Math.max(236, r.width) + "px;" : "top:120px;left:120px;width:240px;";
        return "position:fixed;" + pos + "max-height:" + (vh - 24) + "px;overflow-y:auto;z-index:70;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .12s ease-out both";
      })(),
      dropItens: (() => {
        const fechar = { dropMenu: null };
        if (S.dropMenu === "resp") {
          const eq = (this.dadosDoProto && this.dadosDoProto.EQUIPE) || ["Camila Reis", "Diego Nunes", "Ana Vitória"];
          return eq.map(n => ({
            label: n, iniciais: iniciaisDe(n), on: L0.resp === n, temNota: false, nota: "",
            marca: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:700;background:#eeeff3;color:#616b78",
            onClick: () => {
              this.setState(s => Object.assign({}, fechar, { leads: s.leads.map(x => x.id === L0.id ? Object.assign({}, x, { resp: n }) : x) }));
              if (L0.resp !== n) this.diz("Responsável: " + n, "ok");
            }
          }));
        }
        const ET = (this.dadosDoProto && this.dadosDoProto.ETAPAS) || {};
        const regra = { qualificado: "Abre a qualificação", oportunidade: "Qualifica e cria a oportunidade", nutricao: "Pede motivo e data de retomada", desqualificado: "Pede motivo" };
        return ["novo", "em_contato", "qualificacao", "qualificado", "oportunidade", "nutricao", "desqualificado"].map(k => ({
          label: (ET[k] && ET[k].label) || k, iniciais: "", on: L0.etapa === k,
          temNota: !!regra[k] && L0.etapa !== k, nota: regra[k] || "",
          marca: "flex:0 0 auto;width:8px;height:8px;margin:0 7px;border-radius:50%;background:" + ((ET[k] && ET[k].cor) || "#4a5560"),
          onClick: () => {
            this.setState(fechar);
            if (L0.etapa === k) return;
            if (k === "qualificado") return this.abrirPeca("qualificar", L0.id);
            if (k === "oportunidade") return this.abrirPeca("oportunidade", L0.id);
            if (k === "nutricao") return this.abrirPeca("nutrir", L0.id);
            if (k === "desqualificado") return this.abrirPeca("desqualificar", L0.id);
            this.setState(s => ({ leads: s.leads.map(x => x.id === L0.id ? Object.assign({}, x, { etapa: k }) : x) }));
            this.diz("Movido para " + ((ET[k] && ET[k].label) || k), "ok");
          }
        }));
      })(),
      resp: L0.resp || "Sem responsável",
      respIniciais: iniciaisDe(L0.resp),
      respAvatar: "flex:0 0 auto;width:20px;height:20px;border-radius:9999px;display:grid;place-items:center;font-size:9px;font-weight:700;background:"
        + (L0.resp ? "#eeeff3;color:#616b78" : "#fdeae5;color:#9c3210"),
      respTexto: "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;color:" + (L0.resp ? "#1f252c" : "#c2330f"),
      trocarResp: (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        this.setState(s => ({ dropMenu: s.dropMenu === "resp" ? null : "resp", dropRect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } }));
      },
      origem: L0.origem,
      origemSelo: "display:inline-flex;align-items:center;height:19px;padding:0 8px;border-radius:6px;background:#eeeff3;color:#4a5560;font-size:11px;font-weight:700;white-space:nowrap",
      origemDetalhe: (() => {
        const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
        const base = new Date(2026, 8, 22, 9, 14);
        const d = new Date(base.getTime() - L0.dias * 864e5 - (L0.id.charCodeAt(1) % 7) * 36e5);
        const entrada = d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear() + " · "
          + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        /* ANTES: um dicionário por origem inventava conjunto e criativo ("Formulário
           de contato", "Landing page de PABX"). Não era o anúncio de ninguém. Os
           ids reais da Meta e as UTMs chegam no lead; sem eles, "—". */
        return [
          { label: "Entrada", valor: entrada },
          { label: "Campanha", valor: L0.campanha || "—" },
          { label: "Conjunto", valor: L0.conjunto || "—" },
          { label: "Criativo", valor: L0.criativo || "—" }
        ].map(x => ({
          label: x.label, valor: x.valor,
          valorStyle: "flex:1;min-width:0;font-size:12px;line-height:1.45;text-wrap:pretty;"
            + (x.valor === "—" ? "color:#a3a8a4" : "color:#1f252c;font-weight:500")
        }));
      })(),
      tags: (() => {
        const base = (L0.tag ? [L0.tag] : []).concat([L0.interesse]);
        const extras = (S.tagsLead || {})[L0.id] || [];
        const AUTO = ["Reunião pedida", "Sem orçamento", "Enterprise", "Reativar"];
        return base.concat(extras.filter(t => base.indexOf(t) < 0)).filter(Boolean).map(t => { const au = AUTO.indexOf(t) >= 0; return { label: t, auto: au,
          style: "display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:600;white-space:nowrap;flex:0 0 auto;" + (au ? "background:#fff6f4;color:#c2330f;box-shadow:inset 0 0 0 1px #f6d3c9" : "background:#eeeff3;color:#1f252c") }; });
      })(),
      abrirTags: () => { const E = this.E; if (E) E.abrir("tagslead", L0.id); },
      tagMenu: S.tagMenu === L0.id,
      intMenu: S.intMenu,
      ...(() => {
        const cfg = (() => {
          const ql = (S.qual && S.qual[L0.id]) || {};
          const opcoes = ["White Label", "Callface AI", "PABX", "Não identificado"];
          const val = ql.interesse !== undefined ? ql.interesse : (this._int && this._int.qualPadrao ? this._int.qualPadrao.interesse : "");
          return { opcoes, marcados: String(val || "").split("|").filter(Boolean), padrao: this._int ? this._int.qualPadrao : undefined };
        })();
        const r = S.intRect;
        const vh = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerHeight : 900) : 800;
        const alto = 34 * cfg.opcoes.length + 80;
        const paraCima = !!r && (vh - r.bottom - 12) < alto && r.top > vh - r.bottom;
        const pos = r ? (paraCima ? "bottom:" + (vh - r.top + 6) + "px;" : "top:" + (r.bottom + 6) + "px;") + "left:" + r.left + "px;width:" + Math.max(220, r.width) + "px;" : "top:120px;left:120px;width:260px;";
        const gravar = (lista) => this.setQual(L0.id, "interesse", lista.join("|"), cfg.padrao);
        return {
          intMenuStyle: "position:fixed;" + pos + "z-index:70;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .12s ease-out both",
          intOpcoes: cfg.opcoes.map(o => {
            const on = cfg.marcados.indexOf(o) >= 0;
            return {
              label: o, on,
              caixa: "flex:0 0 auto;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;color:#fff;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
              onClick: () => gravar(on ? cfg.marcados.filter(x => x !== o) : cfg.marcados.concat(o))
            };
          }),
          intResumo: cfg.marcados.length ? cfg.marcados.length + " selecionado" + (cfg.marcados.length > 1 ? "s" : "") : "Nenhum selecionado",
          intLimpar: () => gravar([])
        };
      })(),
      addTagStyle: "display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;padding:0;border:0;cursor:pointer;flex:0 0 auto;background:"
        + (S.tagMenu === L0.id ? "#12171d;color:#fff" : "#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #dbdede"),
      addTagIcone: "transition:transform .14s cubic-bezier(.2,0,.2,1);transform:rotate(" + (S.tagMenu === L0.id ? 45 : 0) + "deg)",
      addTag: (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        this.setState(s => ({
          tagMenu: s.tagMenu === L0.id ? null : L0.id,
          tagRect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
        }));
      },
      tagMenuStyle: (() => {
        const r = S.tagRect;
        const vh = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerHeight : 900) : 800;
        const vw = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1200;
        const largura = Math.min(308, vw - 24);
        const abaixo = r ? vh - r.bottom - 14 : 400;
        const acima = r ? r.top - 14 : 400;
        const paraCima = !!r && abaixo < 240 && acima > abaixo;
        const teto = Math.max(200, Math.min(330, paraCima ? acima : abaixo));
        const pos = r
          ? (paraCima ? "bottom:" + (vh - r.top + 6) + "px;" : "top:" + (r.bottom + 6) + "px;")
            + "left:" + Math.max(12, Math.min(r.left, vw - largura - 12)) + "px;"
          : "top:140px;left:24px;";
        return "position:fixed;" + pos + "width:" + largura + "px;max-height:" + teto + "px;display:flex;flex-direction:column;z-index:48;"
          + "border-radius:10px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 10px 26px -6px rgba(0,0,0,.2),0 2px 4px -2px rgba(0,0,0,.1);padding:5px;animation:of-rise .12s cubic-bezier(.2,0,.2,1) both";
      })(),
      tagOpcoes: (() => {
        const catalogo = [
          ["Prioridade", "Sobe o lead no topo da fila", null],
          ["Enterprise", "Roteia para o time de contas grandes", "Pós-proposta"],
          ["Sem CNPJ", "Bloqueia criação de oportunidade", null],
          ["Reunião pedida", "Dispara fluxo de agendamento", "Primeiro contato"],
          ["Sem orçamento", "Move para nutrição em 7 dias", "Reativação"],
          ["Concorrente", "Marca para análise competitiva", null],
          ["Reativar", "Entra na régua de retomada", "Reativação"]
        ].concat(((S.tagsCriadas || []).map(t => [t, "Tag criada por você", null])));
        const atuais = ((L0.tag ? [L0.tag] : []).concat([L0.interesse])).concat((S.tagsLead || {})[L0.id] || []);
        return catalogo.map(([label, nota, fluxo]) => {
          const on = atuais.indexOf(label) >= 0;
          return {
            label, on, dispara: !!fluxo,
            nota: fluxo ? "dispara " + fluxo : nota,
            notaStyle: "display:block;font-size:11px;line-height:1.4;margin-top:1px;text-wrap:pretty;"
              + (fluxo ? "color:#9c3210;font-weight:600" : "color:#67787c"),
            caixa: "flex:0 0 auto;width:16px;height:16px;border-radius:5px;display:flex;align-items:center;justify-content:center;margin-top:2px;"
              + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
            style: "display:flex;align-items:flex-start;gap:9px;width:100%;padding:8px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left",
            onClick: () => {
              this.setState(s => {
                const atual = (s.tagsLead || {})[L0.id] || [];
                const nova = on ? atual.filter(x => x !== label) : atual.concat(label);
                return { tagsLead: Object.assign({}, s.tagsLead, { [L0.id]: nova }) };
              });
              if (!on && fluxo) this.diz("Tag " + label + " aplicada — fluxo " + fluxo + " disparado", "ok");
            }
          };
        });
      })(),
      tagNova: S.tagNova || "",
      setTagNova: (e) => this.setState({ tagNova: e.target.value }),
      tagNovaTecla: (e) => { if (e.key === "Enter") this.criarTagLead(L0.id); },
      criarTag: () => this.criarTagLead(L0.id),
      criarTagStyle: "height:32px;padding:0 13px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;border:0;"
        + ((S.tagNova || "").trim() ? "background:#12171d;color:#fff;cursor:pointer" : "background:#eeeff3;color:#a3a8a4;cursor:not-allowed"),
      temCad: !!cadAtual, semCad: !cadAtual,
      cadNome: cadAtual || "",
      cadEstado: S.cadPausada ? "Pausada" : "Ativa",
      cadSelo: "display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:5px;font-size:10.5px;font-weight:700;white-space:nowrap;background:"
        + (S.cadPausada ? "#f7edd8;color:#6e5420" : "#e6f4ee;color:#1f7256"),
      cadPasso: cadPassoReal ? "Passo " + cadPassoReal.atual + " de " + cadPassoReal.total : "",
      cadPassos: cadPassoReal ? Array.from({ length: cadPassoReal.total }, (_, k) => k + 1).map(i => ({
        style: "flex:1;height:4px;border-radius:9999px;background:" + (i <= cadPassoReal.atual ? (S.cadPausada ? "#c8a86a" : "#fe4f2b") : "#e3e7e8")
      })) : [],
      cadBotao: S.cadPausada ? "Retomar" : "Pausar",
      pausarCad: () => { const n = !S.cadPausada; this.setState({ cadPausada: n }); this.diz(n ? "Cadência pausada — nenhum toque automático sai" : "Cadência retomada", n ? "aviso" : "ok"); },
      abrirPicker: () => this.setState({ cadModal: true, cadEscolha: cadAtual || "Primeiro contato" }),
      removerCad: () => { this.setState(s => ({ cadencias: Object.assign({}, s.cadencias, { [L0.id]: null }), cadPicker: false })); this.diz("Lead removido da cadência", "aviso"); },
      cadOpcoes: [
        ["Prospecção inbound", "5 toques"], ["Primeiro contato", "3 toques"],
        ["Reengajamento", "5 toques"], ["Pós-proposta", "4 toques"]
      ].map(([nome, toques]) => ({
        label: nome, toques,
        style: "display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border-radius:6px;"
          + (cadAtual === nome ? "background:#fff6f4;font-weight:600" : ""),
        onClick: () => {
          this.setState(s => ({ cadencias: Object.assign({}, s.cadencias, { [L0.id]: nome }), cadPicker: false, cadPausada: false }));
          this.diz("Lead inserido em " + nome + " — toque 1 agendado", "ok");
        }
      })),

      temAcao: !!L0.acao, semAcao: !L0.acao,
      acao: L0.acao ? (L0.venceEm ? L0.acao + " · " + L0.venceEm : L0.acao) : "Sem próxima ação",
      acaoTipo: atvLead.tipo,
      tipoSelo: "flex:0 0 auto;display:inline-flex;align-items:center;height:19px;padding:0 7px;border-radius:5px;background:#eeeff3;color:#4a5560;font-size:10.5px;font-weight:700;white-space:nowrap",
      acaoTexto: "flex:1;min-width:0;font-size:13px;line-height:1.4;text-wrap:pretty;font-weight:" + (L0.acao ? "500;color:#12171d" : "600;color:#c2330f"),
      acaoBotao: L0.acao ? "Ver" : "Criar",
      verAcao: () => this.setState({ atvAberta: true, atvModo: L0.acao ? "ver" : "editar", atvDraft: L0.acao ? null : this.atvVazia(L0) }),
      criarAtv: () => this.setState({ atvAberta: true, atvModo: "editar", atvDraft: this.atvVazia(L0) }),

      qualProg: qualPreenchidos + " de 4 campos",
      qualProgSelo: "flex:0 0 auto;display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:5px;font-size:10.5px;font-weight:700;white-space:nowrap;background:"
        + (qualPreenchidos === 4 ? "#e6f4ee;color:#1f7256" : qualPreenchidos === 0 ? "#f7edd8;color:#6e5420" : "#eeeff3;color:#4a5560"),
      qualif: [
        { campo: "interesse", label: "Interesse", tipo: "multi", opcoes: ["White Label", "Callface AI", "PABX", "Não identificado"] },
        { campo: "tamanho", label: "Tamanho da operação", tipo: "numero" },
        { campo: "dor", label: "Dor principal", tipo: "texto", dica: "Ex: atendimento manual não escala" },
        { campo: "fit", label: "Fit", tipo: "escolha", opcoes: ["Alto", "Médio", "Baixo"] }
      ].map(q => {
        const valor = qualLead[q.campo] || "";
        const marcados = q.tipo === "multi" ? String(valor).split("|").filter(Boolean) : [];
        const n = parseInt(String(valor).replace(/[^0-9]/g, ""), 10);
        const temN = !isNaN(n) && n > 0;
        const faixa = !temN ? null
          : n <= 10 ? ["Micro", "#eeeff3", "#4a5560"]
          : n <= 50 ? ["Pequena", "#e8f0fb", "#2c5f9e"]
          : n <= 200 ? ["Média", "#e6f4ee", "#1f7256"]
          : ["Enterprise", "#fff6f4", "#9c3210"];
        const passo = (delta) => this.setQual(L0.id, q.campo, String(Math.max(1, (temN ? n : 0) + delta)), qualPadrao);
        return {
          label: q.label, dica: q.dica || "",
          ehTexto: q.tipo === "texto", ehMulti: q.tipo === "multi", ehUnico: q.tipo === "escolha", ehNumero: q.tipo === "numero",
          linhaStyle: "display:flex;flex-direction:column;gap:7px;padding:11px 12px 12px" + (q.campo === "interesse" ? "" : ";border-top:1px solid #eef1f1"),
          semChips: marcados.length === 0,
          chips: marcados.map(m => ({
            label: m,
            remover: (e) => { e.stopPropagation(); this.setQual(L0.id, q.campo, marcados.filter(x => x !== m).join("|"), qualPadrao); }
          })),
          selectStyle: "display:flex;align-items:center;gap:8px;width:100%;min-height:34px;padding:5px 10px 5px " + (marcados.length ? "5px" : "10px") + ";border-radius:8px;border:0;background:#fff;cursor:pointer;text-align:left;box-shadow:inset 0 0 0 " + (S.intMenu ? "1.5px #12171d" : "1px #dbdede"),
          abrirSelect: (e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            if (q.tipo === "multi") this._int = { campo: q.campo, opcoes: q.opcoes, marcados, qualPadrao };
            this.setState(s => ({ intMenu: !s.intMenu, intRect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } }));
          },
          valor,
          temSelo: q.tipo === "numero" ? !!faixa : (q.tipo === "multi" && marcados.length > 0),
          selo: q.tipo === "numero" ? (faixa ? faixa[0] : "") : marcados.length + " selecionado" + (marcados.length > 1 ? "s" : ""),
          seloStyle: q.tipo === "numero" && faixa
            ? "font-size:10px;font-weight:700;border-radius:5px;padding:2px 6px;white-space:nowrap;background:" + faixa[1] + ";color:" + faixa[2]
            : "font-size:11px;color:#67787c;white-space:nowrap",
          inputStyle: "width:100%;height:32px;padding:0 10px;border-radius:8px;background:#fff;outline:0;font-size:12.5px;border:1px solid " + (valor ? "#dbdede" : "#e3e7e8"),
          setTexto: (e) => this.setQual(L0.id, q.campo, q.tipo === "numero" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value, qualPadrao),
          menos: () => passo(-5),
          mais: () => passo(5),
          opcoes: (q.opcoes || []).map(o => {
            const on = q.tipo === "multi" ? marcados.indexOf(o) >= 0 : valor === o;
            return {
              label: o,
              style: "height:26px;padding:0 9px;border-radius:9999px;font-size:12px;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;font-weight:"
                + (on ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #dbdede"),
              segStyle: "display:flex;align-items:center;justify-content:center;min-width:0;height:100%;padding:0;margin:0;line-height:1;border-radius:6px;border:0;font-size:12px;white-space:nowrap;cursor:pointer;font-weight:"
                + (on ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
              onClick: () => this.setQual(L0.id, q.campo,
                q.tipo === "multi"
                  ? (on ? marcados.filter(x => x !== o) : marcados.concat(o)).join("|")
                  : (valor === o ? "" : o),
                qualPadrao)
            };
          })
        };
      }),
      empresaBtn: "display:flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:8px;font-size:12.5px;font-weight:500;white-space:nowrap;flex:0 0 auto;"
        + (L0.empresa ? "background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#1f252c;cursor:pointer" : "background:#fff6f4;box-shadow:inset 0 0 0 1px #fadfd8;color:#c2330f;font-weight:600;cursor:pointer"),
      empresaLabel: L0.empresa ? "Abrir empresa" : "Vincular empresa",
      empresaDica: L0.empresa ? "Abrir registro de " + L0.empresa : "Lead sem empresa associada",
      abrirEmpresa: () => L0.empresa
        ? (this.setState({ detalhe: false }), this.E && this.E.irPara("/onface-preview/empresa", "Empresa", { lead: L0.id }))
        : this.setState({ vincAberto: true, vincModo: "vincular", vincBusca: "", vincSel: null, vincNova: { nome: "", cnpj: "", site: "", segmento: "" }, vincTentou: false }),
      abrirContato: () => { this.setState({ detalhe: false }); const E = this.E; if (E) E.irPara("/onface-preview/pessoa", "Contato", { lead: L0.id, pessoa: slug(L0.pessoa || "") }); },

      temMaisTimeline: true,
      timelineBotao: S.timelineTudo ? "Ver menos" : "Ver tudo",
      verTimeline: () => this.setState(s => ({ timelineTudo: !s.timelineTudo })),
      timeline: (() => {
        const base = [
          { hora: "13:42", titulo: "WhatsApp recebido — pediu proposta", ator: "HUMAN", autor: L0.pessoa.split(" ")[0] },
          { hora: "13:18", titulo: "Ligação realizada · 4min 12s", ator: "HUMAN", autor: L0.resp || "—" },
          { hora: "12:55", titulo: 'Tag "' + (L0.tag || L0.interesse) + '" adicionada', ator: "AI_AGENT", autor: "ONI" },
          { hora: "11:30", titulo: "Cadência " + (L0.etapa === "novo" ? "Prospecção inbound" : "Primeiro contato") + " iniciada", ator: "AUTOMATION", autor: "Fluxo" },
          { hora: "ontem", titulo: "Lead criado via " + L0.origem, ator: "SYSTEM", autor: "—" },
          { hora: "ontem", titulo: "E-mail de boas-vindas entregue", ator: "AUTOMATION", autor: "Fluxo" },
          { hora: "2 dias", titulo: "Formulário preenchido no site", ator: "HUMAN", autor: L0.pessoa.split(" ")[0] },
          { hora: "2 dias", titulo: "Enriquecimento de dados concluído", ator: "AI_AGENT", autor: "ONI" }
        ];
        const selo = { HUMAN: ["#eeeff3", "#4a5560"], AI_AGENT: ["#fdeae5", "#9c3210"], AUTOMATION: ["#efecfa", "#4f3fa8"], SYSTEM: ["#eef1f1", "#4a5560"] };
        return (S.timelineTudo ? base : base.slice(0, 5)).map((t, i, arr) => ({
          hora: t.hora, titulo: t.titulo,
          temAutor: t.autor && t.autor !== "—",
          autor: t.ator === "AI_AGENT" ? "ONI" : t.ator === "AUTOMATION" ? "Automação" : t.autor,
          ponto: "width:8px;height:8px;border-radius:50%;flex:0 0 auto;margin-top:4px;background:" + (i === 0 ? "#fe4f2b" : "#fff") + ";box-shadow:inset 0 0 0 " + (i === 0 ? "0" : "1.6px") + " #c8ccc9",
          trilho: i === arr.length - 1 ? "display:none" : "flex:1;width:1.6px;background:#e3e7e8;margin:3px 0"
        }));
      })(),
      oportBtn: "height:34px;padding:0 13px;border-radius:8px;font-size:12.5px;font-weight:500;white-space:nowrap;flex:0 0 auto;"
        + (L0.empresa ? "background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#1f252c;cursor:pointer" : "background:#fafafa;box-shadow:inset 0 0 0 1px #e3e7e8;color:#a3a8a4;cursor:not-allowed"),
      oportDica: L0.empresa ? "Cria oportunidade no Pipeline" : "Bloqueado: lead sem empresa associada",
      desqStart: () => this.setState({ desqAberto: true, desqMotivo: null, desqObs: "" }),

      saidaMenu: S.saidaMenu,
      toggleSaida: () => this.setState(s => ({ saidaMenu: !s.saidaMenu })),
      saidaChevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (S.saidaMenu ? 180 : 0) + "deg)",
      saidas: [
        { k: "qualificar", label: "Qualificar", nota: "Grava o fato e mantém o lead no funil", ok: true,
          d: "M20 6 9 17l-5-5" },
        { k: "oportunidade", label: "Criar oportunidade", nota: L0.empresa ? "Cria a oportunidade no Pipeline" : "Bloqueado: lead sem empresa associada", ok: !!L0.empresa,
          d: "M16 20V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" },
        { k: "nutrir", label: "Mover para nutrição", nota: "Exige motivo e data de retomada", ok: true,
          d: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
        { k: "desqualificar", label: "Desqualificar", nota: "Exige motivo — sustenta o relatório de perda", ok: true, perigo: true,
          d: "M6 6l12 12M18 6L6 18" }
      ].map(s => ({
        label: s.label, nota: s.nota, d: s.d,
        style: "display:flex;align-items:flex-start;gap:9px;width:100%;padding:8px;border-radius:6px;text-align:left;border:0;background:transparent;"
          + (s.ok ? (s.perigo ? "color:#9c3210;cursor:pointer" : "color:#1f252c;cursor:pointer") : "color:#a3a8a4;cursor:not-allowed"),
        onClick: () => {
          this.setState({ saidaMenu: false });
          if (s.k === "qualificar") return this.setState({ qualAberto: true, qualDados: {}, qualMenu: false, qualTentou: false, qualPasso: "dados", qualOpp: {}, qualDestino: null });
          if (s.k === "oportunidade") {
            if (!L0.empresa) return this.diz("Bloqueado: lead sem empresa associada", "erro");
            const jaQualificado = L0.etapa === "qualificado";
            return this.setState({
              qualAberto: true, qualDados: {}, qualMenu: false, qualTentou: false, qualOpp: {},
              qualPasso: jaQualificado ? "opp" : "dados", qualDestino: "opp",
              qualOkTitulo: "Oportunidade criada", qualOkNota: "O lead seguiu para o Pipeline."
            });
          }
          if (s.k === "nutrir") return this.setState({ nutrir: true });
          return this.setState({ desqAberto: true, desqMotivo: null, desqObs: "" });
        }
      }))
    } : null;

    const motivos = [
      ["sem_resposta", "Sem resposta", true], ["sem_interesse_agora", "Sem interesse no momento", true],
      ["timing", "Timing inadequado", true], ["sem_orcamento", "Sem orçamento agora", true],
      ["contrato_vigente", "Contrato vigente", true], ["decisao_interna", "Aguardando decisão interna", false],
      ["retomar_em_data", "Retomar em outra data", true], ["outro", "Outro", false]
    ];
    const motivosNutricao = motivos.map(([k, l, exige]) => {
      const on = S.motivo === k;
      return {
        label: l, exige,
        style: "display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;font-size:12.5px;width:100%;border:1px solid "
          + (on ? "#fe4f2b;background:#fff6f4;font-weight:600" : "#e3e7e8;background:#fff"),
        radio: "flex:0 0 auto;width:14px;height:14px;border-radius:50%;border:" + (on ? "4.5px solid #d93c1a" : "1.5px solid #c5cac7"),
        onClick: () => this.setState({ motivo: k })
      };
    });

    const sel = motivos.find(m => m[0] === S.motivo);
    const exigeData = !!(sel && sel[2]);
    const faltaData = exigeData && !S.data;
    const podeNutrir = !!S.motivo && !faltaData;

    return {
      det,
      temDetalhe: S.detalhe,
      cad: det ? det.cad : { aberto: false, lista: [], passos: [], canais: [], origens: [] },
      fecharDetalhe: () => this.setState({ detalhe: false, cadPicker: false, timelineTudo: false, saidaMenu: false }),
      contato: () => this.diz("Primeiro contato registrado uma vez só — move para Em contato", "ok"),
      qualificar: () => this.setState({ qualAberto: true, qualDados: {}, qualMenu: false, qualTentou: false, qualPasso: "dados", qualOpp: {}, qualDestino: null }),
      oportunidade: () => {
        if (det && det.semEmpresa) return this.diz("Bloqueado: lead sem empresa associada", "erro");
        const id = S.detalheId;
        this.setState(s => ({ leads: s.leads.map(L => L.id === id ? Object.assign({}, L, { etapa: "oportunidade" }) : L) }));
        this.diz("Oportunidade criada no Pipeline", "ok");
      },

      temNutrir: S.nutrir,
      abrirNutrir: () => this.setState({ nutrir: true }),
      fecharNutrir: () => this.setState({ nutrir: false, motivo: null, data: "" }),
      motivosNutricao, exigeData,
      dataRetomada: S.data,
      setData: (e) => this.setState({ data: e.target.value }),
      dataStyle: "width:100%;height:34px;padding:0 11px;border-radius:8px;font-size:13px;background:#fff;border:1px solid " + (faltaData ? "#f0b5a8" : "#dbdede"),
      nutrirBtnLabel: faltaData ? "Informe a data" : "Mover para nutrição",
      nutrirBtnStyle: "height:34px;padding:0 14px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;"
        + (podeNutrir ? "background:#d93c1a;color:#fff" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
      confirmarNutrir: () => {
        if (!S.motivo) return this.diz("Escolha um motivo — nutrição sem motivo é limbo", "erro");
        if (faltaData) return this.diz("Esse motivo exige data: sem ela o lead some da operação", "erro");
        const id = S.detalheId;
        this.setState(s => ({
          leads: s.leads.map(x => x.id === id ? Object.assign({}, x, { etapa: "nutricao", acao: "Retomar contato", venceEm: S.data }) : x),
          nutrir: false, motivo: null, data: ""
        }));
        this.diz("Nutrição registrada e tarefa de retomada criada", "ok");
      },

      atvAberta: S.atvAberta && !!L0,
      fecharAtv: () => this.setState({ atvAberta: false, atvDraft: null }),
      cadPicker: S.cadPicker,
      atv: L0 ? {
        contexto: (L0.empresa || "Sem empresa") + " · " + L0.pessoa,
        ehVer: S.atvModo === "ver", ehEditar: S.atvModo === "editar",
        tituloVisto: atvLead.titulo || "Atividade sem título",
        situacao: atvLead.situacao,
        situacaoSelo: "display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;background:"
          + ({ "A fazer": "#eeeff3;color:#4a5560", "Em andamento": "#e8f0fb;color:#2c5f9e", "Feito": "#e6f4ee;color:#1f7256", "Declinada": "#fdeae5;color:#9c3210" }[atvLead.situacao] || "#eeeff3;color:#4a5560"),
        tipo: atvLead.tipo,
        tipoSelo: "display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;background:#fff6f4;color:#9c3210;font-size:11px;font-weight:700;white-space:nowrap",
        quando: (() => {
          const d = atvLead.data ? atvLead.data.split("-") : null;
          const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
          return d ? Number(d[2]) + " " + meses[Number(d[1]) - 1] + " " + d[0] + " · " + (atvLead.hora || "—") : "Sem data";
        })(),
        descVista: atvLead.desc || "Sem descrição",
        descStyle: "font-size:13px;line-height:1.5;text-wrap:pretty;" + (atvLead.desc ? "color:#1f252c" : "color:#4a5560;font-style:italic"),
        desc: atvLead.desc || "",
        setDesc: (e) => mudaAtv({ desc: e.target.value }),
        editar: () => this.setState({ atvModo: "editar" }),
        cancelarEdicao: () => this.setState(ehDraft || !atvLead.titulo ? { atvAberta: false, atvDraft: null } : { atvModo: "ver" }),
        declinarLabel: atvLead.situacao === "Declinada" ? "Reabrir" : "Declinar",
        declinarStyle: "height:34px;padding:0 13px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;background:#fff;box-shadow:inset 0 0 0 1px #f0d5cf;color:#c2330f",
        declinar: () => {
          const decl = atvLead.situacao === "Declinada";
          mudaAtv({ situacao: decl ? "A fazer" : "Declinada" });
          if (!decl) {
            this.setState(s => ({ leads: s.leads.map(x => x.id === L0.id ? Object.assign({}, x, { acao: null, venceEm: null }) : x), atvAberta: false }));
            this.diz("Atividade declinada — o lead fica sem próxima ação", "aviso");
          } else this.diz("Atividade reaberta", "aviso");
        },
        situacoes: [
          { v: "A fazer", d: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
          { v: "Em andamento", d: "M12 2a10 10 0 0 1 10 10M12 6a6 6 0 0 1 6 6" },
          { v: "Feito", d: "M20 6 9 17l-5-5" },
          { v: "Declinada", d: "M6 6l12 12M18 6L6 18" }
        ].map(s => ({
          label: s.v, d: s.d,
          style: "display:flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;font-size:12.5px;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;font-weight:"
            + (atvLead.situacao === s.v ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
          onClick: () => mudaAtv({ situacao: s.v })
        })),
        tipos: [
          { v: "Ligação", d: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" },
          { v: "Mensagem", d: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" },
          { v: "E-mail", d: "M4 4h16v16H4zM4 7l8 6 8-6" },
          { v: "Follow up", d: "M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8M3 3v5h5" },
          { v: "Reunião", d: "M8 2v4M16 2v4M3 8h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" },
          { v: "Proposta", d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" }
        ].map(t => ({
          label: t.v, d: t.d,
          style: "display:flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;font-size:12.5px;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;font-weight:"
            + (atvLead.tipo === t.v ? "600;background:#fff6f4;color:#9c3210;box-shadow:inset 0 0 0 1px #fe4f2b" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
          onClick: () => mudaAtv({ tipo: t.v })
        })),
        titulo: atvLead.titulo,
        setTitulo: (e) => mudaAtv({ titulo: e.target.value }),
        data: atvLead.data, setData: (e) => mudaAtv({ data: e.target.value }),
        hora: atvLead.hora, setHora: (e) => mudaAtv({ hora: e.target.value }),
        resp: atvLead.resp, respIniciais: iniciaisDe(atvLead.resp),
        trocarResp: () => this.diz("Atribuir responsável da atividade — combobox de usuários", "aviso"),
        concluirLabel: atvLead.situacao === "Feito" ? "Reabrir" : "Marcar como feito",
        concluirStyle: "display:flex;align-items:center;gap:6px;height:34px;padding:0 13px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;"
          + (atvLead.situacao === "Feito" ? "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede" : "background:#e6f4ee;color:#1f7256"),
        concluir: () => {
          const feito = atvLead.situacao === "Feito";
          mudaAtv({ situacao: feito ? "A fazer" : "Feito" });
          if (!feito) {
            this.setState(s => ({ leads: s.leads.map(x => x.id === L0.id ? Object.assign({}, x, { acao: null, venceEm: null }) : x), atvAberta: false }));
            this.diz("Atividade concluída — crie a próxima para não perder o lead", "ok");
          } else this.diz("Atividade reaberta", "aviso");
        },
        salvar: () => {
          const a = atvLead;
          if (!a.titulo && !a.tipo) return this.diz("Dê um título à atividade", "erro");
          this.setState(s => ({
            leads: s.leads.map(x => x.id === L0.id ? Object.assign({}, x, { acao: a.titulo || a.tipo, venceEm: a.hora || null }) : x),
            atvs: Object.assign({}, s.atvs, { [L0.id]: a }),
            atvDraft: null, atvModo: "ver"
          }));
          this.diz(ehDraft ? "Nova atividade criada em tarefas" : "Atividade salva em tarefas", "ok");
        }
      } : { situacoes: [], tipos: [] },

      qual: (() => {
        const alvo0 = S.leads.find(x => x.id === S.detalheId) || {};
        const empsOpp = (S.qualContato && S.qualContato.empresas) || [];
        const empOpp = S.qualEmpresa || (empsOpp[0] && empsOpp[0].nome) || alvo0.empresa;
        const alvo = S.qualContato ? Object.assign({}, alvo0, { pessoa: S.qualContato.nome, cargo: S.qualContato.cargo, empresa: empOpp }) : alvo0;
        const d = S.qualDados || {};
        const interesses = d.interesses || (alvo.interesse ? [alvo.interesse] : []);
        const porte = d.porte === undefined ? 45 : d.porte;
        const dor = d.dor === undefined ? "" : d.dor;
        const fit = d.fit || "Alto";
        const nPorte = parseInt(String(porte).replace(/[^0-9]/g, ""), 10);
        const porteOk = !isNaN(nPorte) && nPorte > 0;
        const completo = interesses.length > 0 && porteOk && !!dor.trim();
        const semEmpresa = !alvo.empresa;
        const mudar = (campo, valor) => this.setState(s => ({ qualDados: Object.assign({}, s.qualDados, { interesses, porte, dor, fit }, { [campo]: valor }) }));
        const faixa = !porteOk ? { label: "—", cor: "#eeeff3", tinta: "#67787c" }
          : nPorte <= 10 ? { label: "Micro", cor: "#eeeff3", tinta: "#4a5560" }
          : nPorte <= 50 ? { label: "Pequena", cor: "#e8f0fb", tinta: "#2c5f9e" }
          : nPorte <= 200 ? { label: "Média", cor: "#e6f4ee", tinta: "#1f7256" }
          : { label: "Enterprise", cor: "#fff6f4", tinta: "#9c3210" };
        const aplicar = (etapa, msg) => {
          const id = S.detalheId;
          this.setState(s => ({
            leads: s.leads.map(x => x.id === id
              ? Object.assign({}, x, { etapa, interesse: interesses[0], tag: "Fit " + fit })
              : x),
            qualAberto: false, qualDados: {}, qualMenu: false, saidaMenu: false
          }));
          this.diz(msg, "ok");
        };
        const iniciaisDe = (n) => (n || "").split(" ").slice(0, 2).map(p => p[0] || "").join("").toUpperCase() || "—";
        const passo = S.qualPasso || "dados";
        const O = S.qualOpp || {};
        const avanco = O.avanco || null;
        const ehReuniao = avanco === "reuniao";
        const inp = "width:100%;height:38px;padding:0 12px;border-radius:9px;background:#fff;outline:0;font-size:13px;font-family:inherit;border:1px solid #dbdede";
        const oppNome = (interesses[0] || alvo.interesse || "Oportunidade") + " · " + (alvo.empresa || "Sem empresa");
        /* Só quem existe na organização: nome do protótipo faz a gravação falhar com "Não encontrei … na equipe". */
        const equipe = (this.dadosDoProto && this.dadosDoProto.EQUIPE) || [];
        const slugE = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
        const mudarO = (k, v) => this.setState(s => ({ qualOpp: Object.assign({}, s.qualOpp, { [k]: v }) }));
        const vData = O.data || "2026-09-24";
        const vHora = O.hora || "14:00";
        const vTitulo = O.titulo === undefined ? (alvo.empresa || "Lead") + " x Callface" : O.titulo;
        const vTarTitulo = O.tarTitulo === undefined
          ? ({ whatsapp: "Retomar conversa no WhatsApp", ligacao: "Ligar para alinhar proposta", email: "Enviar proposta por e-mail", outro: "Próximo passo" }[avanco] || "")
          : O.tarTitulo;
        const vTarData = O.tarData || "2026-09-23";
        const vTarHora = O.tarHora || "10:00";
        const detalheOk = ehReuniao
          ? !!(vData && vHora && String(vTitulo).trim())
          : !!(String(vTarTitulo).trim() && vTarData && vTarHora);
        const fecharTudo = (msg) => {
          const id = S.detalheId;
          this.setState(s => ({
            leads: s.leads.map(x => x.id === id ? Object.assign({}, x, { etapa: "oportunidade", interesse: interesses[0], tag: "Fit " + fit, oppContato: alvo.pessoa, oppEmpresa: alvo.empresa }) : x),
            qualPasso: "ok"
          }));
          clearTimeout(this._qk);
          this._qk = setTimeout(() => {
            this.setState({ qualAberto: false, qualDados: {}, qualOpp: {}, qualPasso: "dados", qualMenu: false });
            this.diz(msg, "ok");
          }, 1500);
        };
        const rotuloAvanco = { reuniao: "Agendar reunião", whatsapp: "WhatsApp", ligacao: "Ligação", email: "E-mail", outro: "Outro" }[avanco] || "";
        return {
          aberto: S.qualAberto,
          fechar: () => { window.__ofContatoOpp = null; this.setState({ qualAberto: false, qualDados: {}, qualOpp: {}, qualPasso: "dados", qualMenu: false, qualDestino: null, qualContato: null, convAberto: false, convTexto: "" }); },

          passoDados: passo === "dados",
          passoOpp: passo === "opp",
          passoReuniao: passo === "detalhe" && ehReuniao,
          passoTarefa: passo === "detalhe" && !ehReuniao,
          passoDetalhe: passo === "detalhe",
          passoOk: passo === "ok",
          podeVoltar: passo === "detalhe" || (passo === "opp" && !(S.qualDestino === "opp" && (S.leads.find(x => x.id === S.detalheId) || {}).etapa === "qualificado")),
          voltar: () => this.setState({ qualPasso: passo === "detalhe" ? "opp" : "dados", qualMenu: false }),
          titulo: passo === "dados" ? "Qualificar lead"
            : passo === "opp" ? "Criar oportunidade"
            : passo === "detalhe" ? (ehReuniao ? "Agendar reunião" : "Próxima ação · " + rotuloAvanco)
            : "Tudo certo",
          subtitulo: passo === "dados" ? "Confirme os dados antes de qualificar."
            : passo === "opp" ? "Defina como a oportunidade entra no Pipeline."
            : passo === "detalhe" ? (ehReuniao ? "A reunião entra na agenda do closer." : "A oportunidade nasce com um próximo passo marcado.")
            : "Registro gravado.",

          inputStyle: inp,
          selectStyle: inp + ";appearance:none;padding-right:30px;cursor:pointer",
          campoResp: React.createElement("select", {
            value: O.resp || alvo.resp || equipe[0],
            style: { width: "100%", height: "38px", padding: "0 30px 0 12px", borderRadius: "9px", background: "#fff", outline: 0, fontSize: "13px", fontFamily: "inherit", border: "1px solid #dbdede", appearance: "none", cursor: "pointer", color: "#1f252c" },
            onChange: (e) => mudarO("resp", e.target.value)
          }, equipe.map(p => React.createElement("option", { key: p, value: p }, p))),
          campoEtapa: React.createElement("select", {
            value: O.etapa || "Novo",
            style: { width: "100%", height: "38px", padding: "0 30px 0 12px", borderRadius: "9px", background: "#fff", outline: 0, fontSize: "13px", fontFamily: "inherit", border: "1px solid #dbdede", appearance: "none", cursor: "pointer", color: "#1f252c" },
            onChange: (e) => mudarO("etapa", e.target.value)
          }, ["Novo", "Descoberta", "Proposta"].map(p => React.createElement("option", { key: p, value: p }, p))),
          campoCloser: React.createElement("select", {
            value: O.closer || alvo.resp || equipe[0],
            style: { width: "100%", height: "38px", padding: "0 30px 0 12px", borderRadius: "9px", background: "#fff", outline: 0, fontSize: "13px", fontFamily: "inherit", border: "1px solid #dbdede", appearance: "none", cursor: "pointer", color: "#1f252c" },
            onChange: (e) => mudarO("closer", e.target.value)
          }, equipe.map(p => React.createElement("option", { key: p, value: p }, p))),
          oppNome,
          multiEmpresa: empsOpp.length > 1,
          multiNota: S.qualContato ? S.qualContato.nome.split(" ")[0] + " está em " + empsOpp.length + " empresas" : "",
          empresasOpp: empsOpp.map(e => {
            const on = e.nome === empOpp;
            return {
              nome: e.nome, papel: e.papel, on, iniciais: iniciaisDe(e.nome),
              style: "display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:0;cursor:pointer;min-width:0;"
                + (on ? "background:#fff;box-shadow:inset 0 0 0 1.5px #12171d" : "background:#fff;box-shadow:inset 0 0 0 1px #dbdede"),
              avatar: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;font-size:10px;font-weight:700;display:grid;place-items:center;"
                + (on ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#4a5560"),
              onClick: () => this.setState({ qualEmpresa: e.nome })
            };
          }),
          responsaveis: equipe.map(p => ({ v: p, label: p })),
          etapasOpp: ["Novo", "Descoberta", "Proposta"].map(p => ({ v: p, label: p })),
          oppResp: O.resp || alvo.resp || equipe[0],
          setOppResp: (e) => mudarO("resp", e.target.value),
          oppEtapa: O.etapa || "Novo",
          setOppEtapa: (e) => mudarO("etapa", e.target.value),
          avancos: [
            { k: "reuniao", label: "Agendar reunião", d: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
            { k: "whatsapp", label: "WhatsApp", d: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" },
            { k: "ligacao", label: "Ligação", d: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" },
            { k: "email", label: "E-mail", d: "M4 4h16v16H4zM4 7l8 6 8-6" },
            { k: "outro", label: "Outro", d: "M5 12h.01M12 12h.01M19 12h.01" }
          ].map(v => {
            const on = avanco === v.k;
            return {
              label: v.label, d: v.d,
              style: "display:flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 10px;border-radius:9px;border:0;cursor:pointer;min-width:0;transition:background 120ms cubic-bezier(0,0,.2,1);"
                + (on ? "background:#12171d;color:#fff" : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#1f252c"),
              onClick: () => mudarO("avanco", v.k)
            };
          }),
          btnAvancoLabel: avanco ? "Continuar" : "Escolha como avançar",
          btnAvancoStyle: "height:34px;padding:0 15px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;border:0;"
            + (avanco ? "background:#1f7256;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          irDetalhe: () => {
            if (!avanco) return this.diz("Escolha como a oportunidade irá avançar", "erro");
            this.setState({ qualPasso: "detalhe" });
          },

          iniciaisPessoa: iniciaisDe(alvo.pessoa),
          contatoNome: alvo.pessoa || "—",
          contatoEmail: (S.qualContato && S.qualContato.email) || (slugE((alvo.pessoa || "").split(" ")[0]) + "@" + slugE(alvo.empresa || "semempresa") + ".com.br"),
          addConvidado: () => this.setState(s => ({ convAberto: !s.convAberto, convTexto: "" })),
          convAberto: !!S.convAberto,
          convTexto: S.convTexto || "",
          setConvTexto: (e) => this.setState({ convTexto: e.target.value }),
          convidados: (O.convidados || []).map(m => ({
            email: m,
            remover: () => mudarO("convidados", (O.convidados || []).filter(x => x !== m))
          })),
          temConvidados: (O.convidados || []).length > 0,
          confirmarConv: () => {
            const v = (S.convTexto || "").trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return this.diz("E-mail inválido", "erro");
            if ((O.convidados || []).indexOf(v) >= 0) return this.setState({ convTexto: "" });
            mudarO("convidados", (O.convidados || []).concat(v));
            this.setState({ convTexto: "" });
          },
          teclaConv: (e) => {
            if (e.key === "Enter") { e.preventDefault(); const b = e.currentTarget.parentNode.querySelector("[data-conv-ok]"); if (b) b.click(); }
            if (e.key === "Escape") { e.stopPropagation(); this.setState({ convAberto: false, convTexto: "" }); }
          },
          reuData: vData,
          setReuData: (e) => mudarO("data", e.target.value),
          reuHora: vHora,
          setReuHora: (e) => mudarO("hora", e.target.value),
          reuCloser: O.closer || alvo.resp || equipe[0],
          setReuCloser: (e) => mudarO("closer", e.target.value),
          duracoes: ["30 min", "45 min", "1 h"].map(d2 => ({
            label: d2,
            style: "flex:1;min-width:0;height:38px;border-radius:9px;font-size:12.5px;white-space:nowrap;border:0;cursor:pointer;font-weight:"
              + ((O.duracao || "30 min") === d2 ? "600;background:#12171d;color:#fff" : "500;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#1f252c"),
            onClick: () => mudarO("duracao", d2)
          })),
          tiposReuniao: [
            { k: "Vídeo", d: "m23 7-7 5 7 5zM1 5h15v14H1z" },
            { k: "Ligação", d: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39" },
            { k: "Presencial", d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" }
          ].map(t => ({
            label: t.k, d: t.d,
            style: "display:flex;align-items:center;justify-content:center;gap:7px;flex:1;min-width:0;height:38px;border-radius:9px;border:0;cursor:pointer;"
              + ((O.tipo || "Vídeo") === t.k ? "background:#12171d;color:#fff" : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#1f252c"),
            onClick: () => mudarO("tipo", t.k)
          })),
          reuTitulo: vTitulo,
          setReuTitulo: (e) => mudarO("titulo", e.target.value),

          tarefaIcone: { whatsapp: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", ligacao: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39", email: "M4 4h16v16H4zM4 7l8 6 8-6", outro: "M5 12h.01M12 12h.01M19 12h.01" }[avanco] || "M5 12h.01",
          canalSelo: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#eeeff3;color:#4a5560",
          tarefaDica: { whatsapp: "A conversa segue no WhatsApp — deixe o próximo toque marcado.", ligacao: "A ligação fica agendada na fila do responsável.", email: "O e-mail entra como tarefa com prazo.", outro: "Registre o próximo passo combinado." }[avanco] || "",
          tarTitulo: vTarTitulo,
          setTarTitulo: (e) => mudarO("tarTitulo", e.target.value),
          tarTituloDica: "Ex.: retomar conversa no WhatsApp",
          tarData: vTarData,
          setTarData: (e) => mudarO("tarData", e.target.value),
          tarHora: vTarHora,
          setTarHora: (e) => mudarO("tarHora", e.target.value),
          quandos: [["Hoje, 16:30", "2026-09-22", "16:30"], ["Amanhã, 10:00", "2026-09-23", "10:00"], ["Seg, 09:00", "2026-09-28", "09:00"]].map(([label, dd, hh]) => ({
            label,
            style: "height:28px;padding:0 11px;border-radius:7px;font-size:11.5px;white-space:nowrap;flex:0 0 auto;border:0;cursor:pointer;font-weight:"
              + ((vTarData === dd && vTarHora === hh) ? "600;background:#eeeff3;color:#12171d" : "500;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#67787c"),
            onClick: () => this.setState(s => ({ qualOpp: Object.assign({}, s.qualOpp, { tarData: dd, tarHora: hh }) }))
          })),
          tarObs: O.tarObs || "",
          setTarObs: (e) => mudarO("tarObs", e.target.value),

          btnFinalLabel: ehReuniao ? "Criar oportunidade + agendar reunião" : "Criar oportunidade",
          btnFinalStyle: "height:34px;padding:0 15px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;border:0;"
            + (detalheOk ? "background:#1f7256;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          concluir: () => {
            if (!detalheOk) return this.diz("Preencha os campos obrigatórios", "erro");
            fecharTudo(ehReuniao ? "Oportunidade criada e reunião agendada" : "Oportunidade criada com próximo passo marcado");
          },
          okTitulo: passo === "ok" ? (S.qualOkTitulo || "Qualificado") : "",
          okNota: passo === "ok" ? (S.qualOkNota || "qualificado_em e qualificado_por gravados.") : "",

          empresa: alvo.empresa || "Sem empresa associada",
          pessoa: (alvo.pessoa || "") + (alvo.cargo ? " · " + alvo.cargo : ""),
          canal: alvo.origem || "—",
          canalStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:21px;padding:0 8px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;"
            + ({ "Meta Ads": "background:#fff6f4;color:#9c3210", "Instagram": "background:#efecfa;color:#4f3fa8", "WhatsApp": "background:#e6f4ee;color:#1f7256", "Formulário": "background:#e8f0fb;color:#2c5f9e", "Site": "background:#e8f0fb;color:#2c5f9e", "Orgânica": "background:#f7edd8;color:#6e5420" }[alvo.origem] || "background:#eeeff3;color:#4a5560"),
          iniciais: iniciaisDe(alvo.empresa || alvo.pessoa),

          interesseConta: interesses.length ? interesses.length + " selecionado" + (interesses.length > 1 ? "s" : "") : "escolha ao menos um",
          interesses: ["White Label", "Callface AI", "PABX", "Não identificado"].map(op => {
            const on = interesses.indexOf(op) >= 0;
            return {
              label: op, on,
              style: "display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 " + (on ? "12px" : "13px") + ";border-radius:9px;font-size:12.5px;white-space:nowrap;flex:0 0 auto;border:0;cursor:pointer;transition:background 120ms cubic-bezier(0,0,.2,1);"
                + (on ? "background:#12171d;color:#fff;font-weight:600" : "background:#fff;box-shadow:inset 0 0 0 1px #dbdede;color:#1f252c;font-weight:500"),
              onClick: () => mudar("interesses", on ? interesses.filter(x => x !== op) : interesses.concat(op))
            };
          }),

          porte: String(porte),
          setPorte: (e) => mudar("porte", e.target.value.replace(/[^0-9]/g, "")),
          menos: () => mudar("porte", String(Math.max(1, (porteOk ? nPorte : 1) - 5))),
          mais: () => mudar("porte", String((porteOk ? nPorte : 0) + 5)),
          porteFaixa: faixa.label,
          porteFaixaStyle: "font-size:10.5px;font-weight:700;border-radius:5px;padding:2px 7px;white-space:nowrap;background:" + faixa.cor + ";color:" + faixa.tinta,
          portesRapidos: [10, 25, 50, 120].map(v => ({
            label: v + " atendentes",
            style: "height:26px;padding:0 10px;border-radius:7px;font-size:11.5px;font-weight:500;white-space:nowrap;flex:0 0 auto;border:0;cursor:pointer;"
              + (nPorte === v ? "background:#eeeff3;color:#12171d;font-weight:600" : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#67787c"),
            onClick: () => mudar("porte", String(v))
          })),

          dor,
          setDor: (e) => mudar("dor", e.target.value),
          dorStyle: "width:100%;height:42px;padding:0 13px;border-radius:10px;background:#fff;outline:0;font-size:13px;font-family:inherit;border:1px solid "
            + (dor.trim() ? "#dbdede" : (S.qualTentou ? "#fe4f2b" : "#f0c8bd")),
          faltaDor: !dor.trim() && !!S.qualTentou,
          faltaInteresse: interesses.length === 0 && !!S.qualTentou,
          doresRapidas: ["Alto custo com telefonia", "Perde ligação fora do horário", "Sem histórico de atendimento", "Equipe não escala"].map(t => ({
            label: t,
            style: "height:26px;padding:0 10px;border-radius:7px;font-size:11.5px;font-weight:500;white-space:nowrap;flex:0 0 auto;border:0;cursor:pointer;"
              + (dor === t ? "background:#eeeff3;color:#12171d;font-weight:600" : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#67787c"),
            onClick: () => mudar("dor", t)
          })),

          fits: [["Alto", 3, "#1f7256", "#e6f4ee", "#bfe3d4"], ["Médio", 2, "#8a6a1f", "#f7edd8", "#e6d3a8"], ["Baixo", 1, "#9c3210", "#fdeae5", "#f5cec3"]].map(([label, n, tinta, fundo, borda]) => {
            const on = fit === label;
            return {
              label, onClick: () => mudar("fit", label),
              barras: "display:inline-flex;align-items:flex-end;gap:2px;height:13px;flex:0 0 auto",
              niveis: [1, 2, 3].map(i => ({
                style: "width:3px;border-radius:2px;height:" + (i * 4 + 1) + "px;background:" + (i <= n ? (on ? tinta : "#a3a8a4") : (on ? "rgba(0,0,0,.12)" : "#e3e7e8"))
              })),
              style: "display:flex;align-items:center;justify-content:center;gap:8px;flex:1;height:40px;border-radius:10px;border:0;cursor:pointer;transition:background 120ms cubic-bezier(0,0,.2,1);"
                + (on ? "background:" + fundo + ";box-shadow:inset 0 0 0 1px " + borda + ";color:" + tinta : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#67787c")
            };
          }),

          status: completo ? "Pronto para qualificar" : (!dor.trim() ? "Falta a dor principal" : "Preencha os campos obrigatórios"),
          statusStyle: "font-size:11.5px;font-weight:600;white-space:nowrap;color:" + (completo ? "#1f7256" : (S.qualTentou ? "#c2330f" : "#67787c")),

          ancora: this.qualRef,
          grupoStyle: "display:flex;align-items:stretch;height:34px;border-radius:8px;overflow:hidden;padding:0;border:0;background:"
            + (completo ? "#1f7256;cursor:pointer" : "#e3e7e8;cursor:not-allowed"),
          corpoStyle: "display:flex;align-items:center;padding:0 14px;font-size:12.5px;font-weight:600;white-space:nowrap;"
            + (completo ? "color:#fff" : "color:#a3a8a4"),
          setaStyle: "display:flex;align-items:center;justify-content:center;width:27px;"
            + (completo ? "color:#fff" : "color:#a3a8a4") + (S.qualDestino === "opp" ? ";display:none" : ""),
          hover: completo ? "background:rgba(0,0,0,.14)" : "background:transparent",
          divisoria: ("flex:0 0 auto;width:1px;background:" + (completo ? "rgba(255,255,255,.34)" : "#d3d8d9")) + (S.qualDestino === "opp" ? ";display:none" : ""),
          chevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (S.qualMenu ? 180 : 0) + "deg)",
          menu: S.qualMenu,
          menuStyle: (() => {
            const r = S.qualRect;
            const vh = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerHeight : 900) : 800;
            const vw = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1200;
            const pos = r ? "bottom:" + (vh - r.top + 6) + "px;right:" + Math.max(10, vw - r.right) + "px;" : "bottom:90px;right:40px;";
            return "position:fixed;" + pos + "width:288px;z-index:56;border-radius:8px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 -8px 20px -4px rgba(0,0,0,.18),0 2px 4px -2px rgba(0,0,0,.12);padding:4px;animation:of-rise .12s cubic-bezier(.2,0,.2,1) both";
          })(),
          btnLabel: S.qualDestino === "opp" ? "Qualificar e continuar" : "Qualificar",
          toggleMenu: () => {
            if (!completo) {
              this.setState({ qualTentou: true });
              return this.diz(!dor.trim() ? "Falta a dor principal para qualificar" : "Preencha os campos obrigatórios para qualificar", "erro");
            }
            if (S.qualDestino === "opp") {
              if (semEmpresa) return this.diz("Bloqueado: lead sem empresa associada", "erro");
              return this.setState({ qualPasso: "opp", qualMenu: false, qualOkTitulo: "Oportunidade criada", qualOkNota: "O lead seguiu para o Pipeline." });
            }
            const el = this.qualRef.current;
            const r = el ? el.getBoundingClientRect() : null;
            this.setState(s => ({ qualMenu: !s.qualMenu, qualRect: r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null }));
          },
          opcoesSaida: [
            { k: "so", label: "Qualificar", nota: "Grava o fato e mantém o lead no funil", ok: true, d: "M20 6 9 17l-5-5" },
            { k: "opp", label: "Qualificar + criar oportunidade", nota: semEmpresa ? "Bloqueado: lead sem empresa associada" : "Cria a oportunidade no Pipeline", ok: !semEmpresa,
              d: "M16 20V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" }
          ].map(o => ({
            label: o.label, nota: o.nota, d: o.d,
            style: "display:flex;align-items:flex-start;gap:9px;width:100%;padding:8px;border-radius:6px;text-align:left;border:0;background:transparent;"
              + (o.ok ? "color:#1f252c;cursor:pointer" : "color:#a3a8a4;cursor:not-allowed"),
            onClick: () => {
              this.setState({ qualMenu: false });
              if (o.k === "so") {
                const id = S.detalheId;
                this.setState(s => ({
                  leads: s.leads.map(x => x.id === id ? Object.assign({}, x, { etapa: "qualificado", interesse: interesses[0], tag: "Fit " + fit }) : x),
                  qualPasso: "ok", qualOkTitulo: "Lead qualificado", qualOkNota: "qualificado_em e qualificado_por gravados."
                }));
                clearTimeout(this._qk);
                this._qk = setTimeout(() => this.setState({ qualAberto: false, qualDados: {}, qualOpp: {}, qualPasso: "dados" }), 1500);
                return;
              }
              if (semEmpresa) return this.diz("Bloqueado: lead sem empresa associada", "erro");
              this.setState({ qualPasso: "opp", qualOkTitulo: "Oportunidade criada", qualOkNota: "O lead seguiu para o Pipeline." });
            }
          })),
          confirmar: () => {
            if (!completo) {
              this.setState({ qualTentou: true });
              return this.diz(!dor.trim() ? "Falta a dor principal para qualificar" : "Preencha os campos obrigatórios para qualificar", "erro");
            }
            if (S.qualDestino === "opp") {
              if (semEmpresa) return this.diz("Bloqueado: lead sem empresa associada", "erro");
              return this.setState({ qualPasso: "opp", qualMenu: false, qualOkTitulo: "Oportunidade criada", qualOkNota: "O lead seguiu para o Pipeline." });
            }
            const el = this.qualRef.current;
            const r = el ? el.getBoundingClientRect() : null;
            this.setState(s => ({ qualMenu: !s.qualMenu, qualRect: r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null }));
          }
        };
      })(),

      vinc: (() => {
        const alvo = S.leads.find(x => x.id === S.detalheId);
        const nova = S.vincNova || {};
        const q = (S.vincBusca || "").trim().toLowerCase();
        const mapa = {};
        S.leads.forEach(x => { if (x.empresa) { mapa[x.empresa] = mapa[x.empresa] || { nome: x.empresa, seg: x.segmento || "", n: 0 }; mapa[x.empresa].n++; } });
        const todas = Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome));
        const lista = todas.filter(e => !q || e.nome.toLowerCase().indexOf(q) >= 0).slice(0, 7);
        const ehVinc = S.vincModo !== "cadastrar";
        const faltaNome = !(nova.nome || "").trim();
        const pode = ehVinc ? !!S.vincSel : !faltaNome;
        const aba = (on) => "flex:1;height:30px;border-radius:7px;border:0;font-size:12.5px;cursor:pointer;white-space:nowrap;font-weight:" + (on ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560");
        const campo = (k, label, dica, obrig) => ({
          label, dica, obrig, valor: nova[k] || "",
          erro: obrig && S.vincTentou && !(nova[k] || "").trim(),
          style: "width:100%;height:36px;padding:0 11px;border-radius:8px;background:#fff;outline:0;font-size:13px;border:1px solid " + (obrig && S.vincTentou && !(nova[k] || "").trim() ? "#e0a597" : "#dbdede"),
          set: (e) => { const v = e.target.value; this.setState(s => ({ vincNova: Object.assign({}, s.vincNova, { [k]: v }) })); }
        });
        const aplicar = (nome) => {
          this.setState(s => ({
            leads: s.leads.map(x => x.id === S.detalheId ? Object.assign({}, x, { empresa: nome }) : x),
            vincAberto: false
          }));
          this.diz(nome + (ehVinc ? " vinculada ao lead" : " cadastrada e vinculada"), "ok");
        };
        return {
          aberto: S.vincAberto,
          contexto: alvo ? alvo.pessoa + (alvo.cargo ? " · " + alvo.cargo : "") : "",
          fechar: () => this.setState({ vincAberto: false }),
          ehVinc, ehCad: !ehVinc,
          abaVinc: aba(ehVinc), abaCad: aba(!ehVinc),
          irVinc: () => this.setState({ vincModo: "vincular", vincTentou: false }),
          irCad: () => this.setState(s => ({ vincModo: "cadastrar", vincTentou: false, vincNova: Object.assign({}, s.vincNova, { nome: s.vincNova.nome || s.vincBusca || "" }) })),
          busca: S.vincBusca,
          setBusca: (e) => this.setState({ vincBusca: e.target.value, vincSel: null }),
          lista: lista.map(e => {
            const on = S.vincSel === e.nome;
            return {
              nome: e.nome, iniciais: iniciaisDe(e.nome),
              meta: (e.seg ? e.seg + " · " : "") + e.n + (e.n > 1 ? " leads" : " lead"),
              on,
              style: "display:flex;align-items:center;gap:10px;width:100%;padding:8px 9px;border-radius:9px;border:0;cursor:pointer;text-align:left;background:" + (on ? "#f6f6f3;box-shadow:inset 0 0 0 1.5px #12171d" : "transparent"),
              onClick: () => this.setState({ vincSel: e.nome })
            };
          }),
          vazia: lista.length === 0,
          vazioTexto: q ? "Nenhuma empresa com “" + S.vincBusca + "”." : "Nenhuma empresa cadastrada ainda.",
          campos: [
            campo("nome", "Nome da empresa", "Ex: Grupo Aurora", true),
            campo("cnpj", "CNPJ", "00.000.000/0000-00", false),
            campo("site", "Site", "empresa.com.br", false),
            campo("segmento", "Segmento", "Ex: Varejo, Saúde, Educação", false)
          ],
          btnLabel: ehVinc ? "Vincular empresa" : "Cadastrar e vincular",
          btnStyle: "height:34px;padding:0 15px;border-radius:8px;border:0;font-size:12.5px;font-weight:600;white-space:nowrap;cursor:" + (pode ? "pointer;background:#d93c1a;color:#fff" : "not-allowed;background:#f0c6bb;color:#fff"),
          confirmar: () => {
            if (ehVinc) { if (S.vincSel) aplicar(S.vincSel); return; }
            if (faltaNome) return this.setState({ vincTentou: true });
            aplicar(nova.nome.trim());
          }
        };
      })(),

      desq: (() => {
        const alvo = S.leads.find(x => x.id === S.detalheId);
        const opcoes = [
          ["sem_fit", "Sem fit"], ["fora_icp", "Fora do ICP"], ["sem_interesse", "Sem interesse"],
          ["dados_invalidos", "Dados inválidos"], ["duplicado", "Duplicado"], ["outro", "Outro"]
        ];
        const ehOutro = S.desqMotivo === "outro";
        const faltaObs = ehOutro && !S.desqObs.trim();
        const pode = !!S.desqMotivo && !faltaObs;
        return {
          aberto: S.desqAberto,
          contexto: alvo ? (alvo.empresa || "Sem empresa") + " · " + alvo.pessoa + " — o motivo sustenta o relatório de perda." : "",
          fechar: () => this.setState({ desqAberto: false, desqMotivo: null, desqObs: "" }),
          motivos: opcoes.map(([k, label]) => {
            const on = S.desqMotivo === k;
            return {
              label,
              radio: "flex:0 0 auto;width:15px;height:15px;border-radius:50%;border:" + (on ? "5px solid #d93c1a" : "1.5px solid #c8ccc9"),
              style: "display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border-radius:8px;font-size:13px;cursor:pointer;border:0;"
                + (on ? "background:#fff6f4;box-shadow:inset 0 0 0 1px #fe4f2b;font-weight:600" : "background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8"),
              onClick: () => this.setState({ desqMotivo: k })
            };
          }),
          obs: S.desqObs,
          setObs: (e) => this.setState({ desqObs: e.target.value }),
          obsRotulo: ehOutro ? "obrigatória" : "opcional",
          obsSelo: "font-size:10px;font-weight:700;border-radius:4px;padding:2px 6px;white-space:nowrap;"
            + (ehOutro ? "background:#fdeae5;color:#9c3210" : "background:#eeeff3;color:#4a5560"),
          obsDica: ehOutro ? "Descreva o motivo — obrigatório em Outro" : "Contexto que ajuda o time depois",
          obsStyle: "width:100%;padding:9px 11px;border-radius:8px;background:#fff;outline:0;font-size:13px;line-height:1.5;resize:vertical;font-family:inherit;border:1px solid "
            + (faltaObs ? "#f0b5a8" : "#dbdede"),
          btnLabel: faltaObs ? "Descreva o motivo" : "Desqualificar",
          btnStyle: "height:34px;padding:0 15px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;border:0;"
            + (pode ? "background:#c2330f;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          confirmar: () => {
            if (!S.desqMotivo) return this.diz("Escolha o motivo da desqualificação", "erro");
            if (faltaObs) return this.diz("Em Outro, a observação é obrigatória", "erro");
            const rotulo = (opcoes.find(o => o[0] === S.desqMotivo) || [])[1];
            const id = S.detalheId;
            this.setState(s => ({
              leads: s.leads.map(x => x.id === id ? Object.assign({}, x, { etapa: "desqualificado", acao: null, venceEm: null, tag: rotulo }) : x),
              desqAberto: false, desqMotivo: null, desqObs: "",
      vincAberto: false, vincModo: "vincular", vincBusca: "", vincSel: null, vincNova: {}, vincTentou: false,
      qualAberto: false, qualDados: {}, qualMenu: false, qualRect: null, qualPasso: "dados", qualOpp: {}, qualOkTitulo: "", qualOkNota: "", qualTentou: false, detalhe: false, saidaMenu: false
            }));
            this.diz("Lead desqualificado · " + rotulo, "ok");
          }
        };
      })(),

      parar: (e) => e.stopPropagation()
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <PecasDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as PecasLiga };
