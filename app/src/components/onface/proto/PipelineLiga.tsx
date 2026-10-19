// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Pipeline — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * PipelineDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `PipelineDesenho.tsx`, convertido por máquina e intocável.
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
import { arquivosDaOpp } from "./arquivos-da-opp";
import { abrirUrlExterna } from "@/lib/callface-ligar";
import { toast } from "sonner";

import { PipelineDesenho } from "./PipelineDesenho";
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
  expRef = React.createRef();
  state = { visao: "quadro", busca: "", sel: { resp: [], familia: [], proposta: [], parado: [], tipo: [], motivo: [] }, filtroAberto: null, expandidas: {}, listaFechadas: {},
    arrastando: null, sobre: null, aberto: null, modal: null, form: {}, tentou: false, tlTudo: false, ni: { natureza: "MRR", qtd: "1" }, np: { papel: "Influenciador" }, na: { tipo: "Ligação" }, opps: null, leads: null };

  constructor(props: any) {
    super(props);
    /* O chip "Responsável" abre marcado com quem está usando, igual a
       Propostas. A tela já abria nos seus (o servidor recorta), mas o filtro
       vinha visualmente vazio — parecia mostrar o quadro inteiro e mostrava
       só os seus. Aqui o filtro é por NOME, e o nome da sessão só existe
       depois do super(). Limpar o chip mostra o time todo. */
    const euAgora = props.usuario?.nome ?? null;
    if (euAgora) (this.state as any) = { ...(this.state as any), sel: { ...(this.state as any).sel, resp: [euAgora] } };
    const d: any = props.dados ?? {};
    for (const k of Object.keys(this.state ?? {})) {
      if ((this.state as any)[k] === null && d[k] != null) {
        (this.state as any) = { ...(this.state as any), [k]: d[k] };
      }
    }
  }

  abrirAtv(O, i, tipo) {
    /* Atividade: a peça ÚNICA (AtividadePecaProto), para criar e para ver/editar. Ela relê a tarefa por id
       a cada abertura. Não existe mais modal de atividade aqui dentro. */
    if (i == null) return this.E.abrir("novaAtividade", { empresa: O.empresa, pessoa: O.pessoa, tipo, oppId: O.id, leadId: O.leadId || null, empresaId: O.empresaId || null });
    const A = (O.atvs || [])[i] || {};
    if (A.tipo === "Reunião") return this.abrirReuniao(O, i);
    if (A.tarefaId) return this.E.abrir("verAtividade", "p:" + A.tarefaId);
    /* Registro do histórico (ligação, e-mail, nota de sistema): não é tarefa; fica na linha do tempo. */
    if (A.tipo === "Ligação" && O.leadId && /^Liga[cç][aã]o/i.test(A.titulo || "")) return this.E.abrir("relatorio", { leadId: O.leadId, audioUrl: A.audioUrl || "" });
    this.diz("Este é um registro do histórico: está na linha do tempo da oportunidade.", "aviso");
  }


  abrirReuniao(O, i) {
    /* A peça ÚNICA de Reunião (`/api/reunioes`, evento e agenda), para criar E para ver/editar: ela
       relê a reunião por id a cada abertura. Não existe mais modal de reunião aqui dentro. */
    const ctx = { oppId: O.id, leadId: O.leadId || null, empresaId: O.empresaId || null };
    if (i == null) return this.E.abrir("novaReuniao", { ...ctx, empresa: O.empresa, pessoa: O.pessoa });
    const A = (O.atvs || [])[i] || {};
    this.E.abrir("reuniao", { id: A.reuniaoId || null, ...ctx });
  }

  componentDidMount() {
    const E = this.E;
    if (E) {
      const puxa = () => this.setState({ opps: E.ler("opps", null), leads: E.ler("leads", null) });
      puxa();
      this._off = E.assinar(puxa);
      const q = E.parametro && E.parametro("opp");
      if (q) this.setState({ aberto: q });
    }
    this._fora = (e) => { const dentro = (s) => e.target.closest && e.target.closest(s);
      if (this.state.filtroAberto && !dentro("[data-pl-filtro]")) this.setState({ filtroAberto: null });
      if (this.state.exportMenu && !dentro("[data-of-expmenu]")) this.setState({ exportMenu: false }); };
    this._esc = (e) => { if (e.key === "Escape") this.setState(s => s.modal ? { modal: null } : { aberto: null, filtroAberto: null }); };
    document.addEventListener("mousedown", this._fora);
    document.addEventListener("keydown", this._esc);
  }
  componentWillUnmount() {
    if (this._off) this._off();
    document.removeEventListener("mousedown", this._fora);
    document.removeEventListener("keydown", this._esc);
  }

  diz(t, tom) { const E = this.E; if (E) E.avisar(t, tom); }
  agora() { const d = new Date(); return "Hoje, " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  base() {
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
    if (String(novo.id).indexOf("d:") === 0) novo.id = "o:" + novo.leadId;
    if (evento) novo.eventos = [{ t: evento, quando: this.agora(), autor: this.eu }].concat(novo.eventos || []);
    const i = atual.findIndex(x => x.id === novo.id || x.id === o.id);
    if (i >= 0) atual[i] = novo; else atual.push(novo);
    this.setState(s => ({ opps: atual, aberto: s.aberto === o.id ? novo.id : s.aberto }));
    if (E) E.gravar({ opps: atual });
    return novo;
  }

  removerOpp(id) {
    const E = this.E, D = this.dadosDoProto || {};
    const atual = (this.state.opps || D.OPORTUNIDADES || []).filter(x => x.id !== id);
    this.setState({ opps: atual, aberto: null });
    if (E) E.gravar({ opps: atual });
  }

  mover(o, destino) {
    const ROT = this.ROT;
    if (!o || destino === o.etapa) return;
    if ((destino === "proposta" || destino === "negociacao") && !o.proposta)
      return this.setState({ modal: { k: "propgate", id: o.id, depois: destino }, form: {}, tentou: false });
    // Ganho não tem botão: o motor fecha quando a evidência da oferta chega (contrato assinado ou pagamento).
    if (destino === "ganho") return this.diz("Ganho não tem botão: a oportunidade fecha sozinha quando o contrato é assinado ou o pagamento é confirmado.", "aviso");
    if (destino === "perdido") return this.setState({ modal: { k: "perda", id: o.id }, form: {}, tentou: false });
    this.gravarOpp(Object.assign({}, o, { etapa: destino, dias: 0 }), "Movido de " + ROT[o.etapa] + " para " + ROT[destino]);
    this.diz(o.empresa + " → " + ROT[destino], "ok");
  }

  renderVals() {
    const S = this.state;
    const D = this.dadosDoProto || {};
    const Es = this.E;
    const equipe = D.EQUIPE || ["Camila Reis", "Diego Nunes", "Ana Vitória"];
    const ini = (n) => avatarDe(n, (D.iniciais || (s => (s || "").split(" ").map(p => [...p][0]).slice(0, 2).join("").toUpperCase()))(n));
    const ROT = this.ROT = { entrada: "Entrada", diagnostico: "Diagnóstico", proposta: "Proposta", negociacao: "Negociação", ganho: "Ganho", perdido: "Perdido" };
    const COR = { entrada: "#4a5560", diagnostico: "#2c5f9e", proposta: "#c8a86a", negociacao: "#fe4f2b", ganho: "#1f7256", perdido: "#8b949e" };
    const MOTIVO_ROT = { sem_retorno: "Sem retorno", sem_interesse: "Sem interesse", preco: "Preço", concorrente: "Escolheu concorrente", sem_orcamento: "Sem orçamento", timing: "Timing / outra data", trava_negociacao: "Trava na negociação", trava_contratual: "Trava contratual", projeto_cancelado: "Projeto cancelado", sem_fit: "Sem fit após diagnóstico", no_show: "No-show", outro: "Outro", nao_respondeu: "Não respondeu", fora_perfil: "Fora de perfil", escolheu_concorrente: "Escolheu concorrente", preco_alto: "Preço alto", sem_budget: "Sem orçamento", vai_internalizar: "Vai internalizar", erro_operacional: "Erro operacional" };
    const FAM = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
    const NAT = { MRR: "Recorrente", SETUP: "Setup", PROJECT: "Projeto", ONE_TIME: "Avulso", USAGE: "Uso", HARDWARE: "Hardware" };
    const PROP = { rascunho: "Rascunho", enviada: "Enviada", visualizada: "Visualizada", ajuste_solicitado: "Ajuste solicitado", aceita: "Aceita", recusada: "Recusada", expirada: "Expirada" };
    const PROP_COR = { rascunho: "#8b949e", enviada: "#2c5f9e", visualizada: "#c8a86a", ajuste_solicitado: "#fe4f2b", aceita: "#1f7256", recusada: "#c2330f", expirada: "#8b949e" };
    const brl = (n) => "R$ " + (+n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const brl0 = (n) => "R$ " + Math.round(+n || 0).toLocaleString("pt-BR");
    const somas = (o) => { let mrr = 0, un = 0; ((o.proposta && o.proposta.itens) || o.itensProp || []).forEach(i => { const v = (+i.valor || 0) * (+i.qtd || 1); if (i.natureza === "MRR") mrr += v; else un += v; }); return { mrr, un }; };
    const famStyle = (f) => "flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:500;white-space:nowrap;color:#67787c";
    const propStyle = "display:inline-flex;align-items:center;gap:6px;height:20px;padding:0 8px;border-radius:9999px;background:#fafafa;box-shadow:inset 0 0 0 1px #eef1f1;font-size:11px;font-weight:600;color:#4a5560;white-space:nowrap";
    const propPonto = (s) => "width:6px;height:6px;border-radius:9999px;background:" + (s ? PROP_COR[s] : "#c9cfd1");
    const diasStyle = (d) => "flex:0 0 auto;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;text-align:right;color:" + (d >= 10 ? "#c2330f" : "#4a5560");

    const todas = this.base();
    const q = S.busca.trim().toLowerCase(), F = S.sel;
    const statusProp = (o) => o.proposta ? o.proposta.status : "sem";
    const passa = (o, ignora) => {
      if (q && ![o.empresa, o.pessoa].some(v => (v || "").toLowerCase().indexOf(q) >= 0)) return false;
      if (ignora !== "resp" && F.resp.length && F.resp.indexOf(o.resp) < 0) return false;
      // Família NULL conta como Callface AI no filtro, sem gravar (decisão do Scott).
      if (ignora !== "familia" && F.familia.length && F.familia.indexOf(o.familia || "CALLFACE_AI") < 0) return false;
      if (ignora !== "tipo" && F.tipo.length && F.tipo.indexOf(o.tipo || "nova") < 0) return false;
      if (ignora !== "motivo" && F.motivo.length && F.motivo.indexOf(o.motivoPerda || "") < 0) return false;
      if (ignora !== "proposta" && F.proposta.length && F.proposta.indexOf(statusProp(o)) < 0) return false;
      if (ignora !== "parado" && F.parado.length && !F.parado.some(p => o.dias >= +p)) return false;
      return true;
    };
    const vis = todas.filter(o => passa(o));
    const exp = (() => {
      const EX = S.exp || {}, esc = EX.escopo || "visao";
      const TIPO = { nova: "Nova venda", expansao: "Expansão", upgrade: "Upgrade", renovacao: "Renovação", reativacao: "Reativação" };
      const PROPS = { sem: "Sem proposta", rascunho: "Rascunho", enviada: "Enviada", visualizada: "Visualizada", ajuste_solicitado: "Ajuste solicitado", aceita: "Aceita", recusada: "Recusada" };
      const G = [
        ["etapa", "Etapa", ["entrada", "diagnostico", "proposta", "negociacao", "ganho", "perdido"].map(k => [k, ROT[k]]), o => o.etapa],
        ["resp", "Closer", equipe.map(n => [n, n]), o => o.resp],
        ["familia", "Produto", Object.keys(FAM).map(k => [k, FAM[k]]), o => o.familia],
        ["prop", "Status da proposta", Object.keys(PROPS).map(k => [k, PROPS[k]]), o => o.proposta ? o.proposta.status : "sem"],
        ["tipo", "Tipo", Object.keys(TIPO).map(k => [k, TIPO[k]]), o => o.tipo || "nova"]
      ];
      const fx = EX.f || {};
      const base = esc === "visao" ? vis : todas;
      const lista = base.filter(o => G.every(([k, , , get]) => !(fx[k] && fx[k].length) || fx[k].indexOf(get(o)) >= 0));
      /* Telefone, WhatsApp e e-mail entram aqui porque é para isso que a
         planilha serve. Faltavam porque este exportador monta o CSV no
         navegador, a partir do cartão — e o cartão não carregava contato. Ele
         carrega desde que o botão "Ligar" do drawer foi consertado, então o
         dado já está na mão; só faltava a coluna. */
      const COLS = [["opp", "Oportunidade", o => (FAM[o.familia] || "") + " · " + o.empresa], ["empresa", "Empresa", o => o.empresa], ["pessoa", "Contato", o => o.pessoa], ["cargo", "Cargo", o => o.cargo || ""],
        ["telefone", "Telefone", o => o.telefone || ""], ["whatsapp", "WhatsApp", o => o.whatsapp || ""], ["email", "E-mail", o => o.email || ""],
        ["etapa", "Etapa", o => ROT[o.etapa]], ["familia", "Produto", o => FAM[o.familia]], ["tipo", "Tipo", o => TIPO[o.tipo || "nova"]],
        ["mrr", "Recorrente/mês", o => somas(o).mrr], ["un", "Único", o => somas(o).un], ["prop", "Proposta", o => o.proposta ? PROPS[o.proposta.status] || o.proposta.status : "Sem proposta"], ["resp", "Closer", o => o.resp], ["dias", "Dias na etapa", o => o.dias], ["origem", "Origem", o => o.origem || ""], ["prox", "Próxima atividade", o => { const a = (o.atvs || []).find(x => !x.feita); return a ? a.titulo + " · " + (a.quando || "") : ""; }]];
      // Contato vem marcado por padrão: é o que o time usa a planilha para fazer.
      const colOn = EX.cols || COLS.filter(c => ["origem", "prox", "tipo"].indexOf(c[0]) < 0).map(c => c[0]);
      const fmt = EX.formato || "csv";
      const up = (p) => this.setState(s => ({ exp: Object.assign({}, s.exp || {}, p) }));
      const chip = (on) => "height:28px;padding:0 10px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (on ? "font-weight:600;background:#12171d;color:#fff" : "font-weight:500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
      const baixar = (rows, nome) => {
        const cs = COLS.filter(c => colOn.indexOf(c[0]) >= 0);
        const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        const txt = [cs.map(c => c[1])].concat(rows.map(o => cs.map(c => c[2](o)))).map(l => l.map(q).join(fmt === "csv" ? ";" : "\t")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(["\ufeff" + txt], { type: fmt === "csv" ? "text/csv;charset=utf-8" : "application/vnd.ms-excel" }));
        a.download = nome + (fmt === "csv" ? ".csv" : ".xls"); document.body.appendChild(a); a.click(); a.remove();
        this.diz(rows.length + (rows.length === 1 ? " oportunidade exportada" : " oportunidades exportadas"), "ok");
      };
      const filtrosAtivos = Object.keys(S.sel || {}).reduce((a, k) => a + ((S.sel[k] || []).length ? 1 : 0), 0) + (S.busca ? 1 : 0);
      return { aberto: !!S.exp && !!S.exp.aberto,
        resumoVisao: vis.length + (vis.length === 1 ? " oportunidade" : " oportunidades") + (filtrosAtivos ? " com os filtros aplicados" : " · todas as etapas"),
        abrirVisao: () => { this.setState({ exportMenu: false }); baixar(vis, "onface-pipeline"); },
        abrirEtapa: () => this.setState({ exportMenu: false, exp: { aberto: true, escopo: "todas", f: { etapa: ["proposta"] } } }),
        abrirCriterios: () => this.setState({ exportMenu: false, exp: { aberto: true, escopo: filtrosAtivos ? "visao" : "todas", f: {} } }),
        fechar: () => this.setState({ exp: null }),
        escopos: [["visao", "Esta visão", filtrosAtivos ? "Respeita os filtros e a busca da tela" : "Tudo o que está na tela", vis.length], ["todas", "Todo o pipeline", "Ignora os filtros da tela", todas.length]].map(([k, label, nota, n]) => ({ label, nota, conta: String(n), onClick: () => up({ escopo: k }),
          style: "display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;border-radius:9px;border:0;cursor:pointer;background:" + (esc === k ? "#fff6f4;box-shadow:inset 0 0 0 1px #f0a896" : "#fff;box-shadow:inset 0 0 0 1px #e3e7e8"),
          radio: "flex:0 0 auto;width:15px;height:15px;border-radius:9999px;box-shadow:inset 0 0 0 " + (esc === k ? "4.5px #d93c1a" : "1.5px #a9b1b4") })),
        mostraFiltros: true,
        grupos: G.map(([k, titulo, ops]) => { const on = fx[k] || []; return { titulo, ativo: on.length > 0, limpar: () => up({ f: Object.assign({}, fx, { [k]: [] }) }),
          opcoes: ops.map(([v, l]) => ({ label: l, style: chip(on.indexOf(v) >= 0), onClick: () => up({ f: Object.assign({}, fx, { [k]: on.indexOf(v) >= 0 ? on.filter(x => x !== v) : on.concat(v) }) }) })) }; }),
        colunas: COLS.map(([k, l]) => { const on = colOn.indexOf(k) >= 0; return { label: l, on, onClick: () => up({ cols: on ? colOn.filter(x => x !== k) : colOn.concat(k) }),
          style: "display:flex;align-items:center;gap:6px;height:28px;padding:0 10px 0 7px;border-radius:8px;border:0;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px " + (on ? "#a9b1b4" : "#e3e7e8"),
          caixa: "flex:0 0 auto;width:14px;height:14px;border-radius:4px;display:grid;place-items:center;" + (on ? "background:#12171d" : "box-shadow:inset 0 0 0 1.5px #a9b1b4") }; }),
        formatos: [["csv", "CSV"], ["xls", "Excel"]].map(([k, l]) => ({ label: l, style: chip(fmt === k), onClick: () => up({ formato: k }) })),
        total: String(lista.length), totalLabel: (lista.length === 1 ? "oportunidade" : "oportunidades") + " · " + colOn.length + " colunas",
        gerarLabel: "Gerar planilha", gerarStyle: "display:flex;align-items:center;gap:7px;height:34px;padding:0 15px;border-radius:8px;border:0;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;color:#fff;cursor:" + (lista.length && colOn.length ? "pointer;background:#d93c1a" : "not-allowed;background:#e3a595"),
        gerar: () => { if (!lista.length || !colOn.length) return; baixar(lista, "onface-pipeline"); this.setState({ exp: null }); } };
    })();
    const defs = [
      { k: "resp", label: "Responsável", titulo: "CLOSER", icone: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", opcoes: equipe.map(n => [n, n]) },
      { k: "familia", label: "Família", titulo: "PRODUTO", icone: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", opcoes: Object.keys(FAM).map(k => [k, FAM[k]]) },
      { k: "proposta", label: "Proposta", titulo: "STATUS DA PROPOSTA", icone: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", opcoes: [["sem", "Sem proposta"]].concat(["rascunho", "enviada", "visualizada", "ajuste_solicitado", "aceita"].map(k => [k, PROP[k]])) },
      { k: "tipo", label: "Tipo", titulo: "NOVA VENDA OU EXPANSÃO", icone: "M12 5v14M5 12h14", opcoes: [["nova", "Nova venda"], ["expansao", "Expansão"], ["renovacao", "Renovação"], ["reativacao", "Reativação"]] },
      // E1: separa o perdido de verdade do estagnado (timing, sem retorno, travas).
      { k: "motivo", label: "Motivo", titulo: "MOTIVO DA PERDA", icone: "M18 6 6 18M6 6l12 12", opcoes: Array.from(new Set(todas.map(o => o.motivoPerda).filter(Boolean))).sort().map(k => [k, MOTIVO_ROT[k] || k]) },
      { k: "parado", label: "Parado", titulo: "DIAS NA ETAPA", icone: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", opcoes: [["7", "7 dias+"], ["14", "14 dias+"]] }
    ];
    const filtros = defs.map(f => {
      const sel = F[f.k], ativo = sel.length > 0, aberto = S.filtroAberto === f.k;
      return {
        label: f.label, titulo: f.titulo, icone: f.icone, aberto, temSel: ativo, conta: String(sel.length),
        grupo: "display:flex;align-items:stretch;height:34px;border-radius:9px;overflow:hidden;background:" + (ativo ? "#d93c1a" : "#fff") + ";box-shadow:inset 0 0 0 1px " + (ativo ? "#c2330f" : aberto ? "#b8bfc0" : "#dbdede"),
        corpo: "display:flex;align-items:center;gap:7px;padding:0 11px;font-size:13px;font-weight:" + (ativo ? "600" : "500") + ";white-space:nowrap;color:" + (ativo ? "#fff" : "#1f252c") + ";background:transparent;border:0;cursor:pointer",
        seta: "display:grid;place-items:center;width:28px;padding:0;color:" + (ativo ? "#fff" : "#4a5560") + ";background:transparent;border:0;cursor:pointer",
        hover: ativo ? "background:rgba(255,255,255,.12)" : "background:#f6f7f7",
        div: "flex:0 0 auto;width:1px;background:" + (ativo ? "rgba(255,255,255,.34)" : "#e3e7e8"),
        contaStyle: "min-width:17px;height:17px;padding-inline:4px;border-radius:9999px;font-size:10px;font-weight:700;display:grid;place-items:center;background:rgba(255,255,255,.22);color:#fff",
        chev: "flex:0 0 auto;transition:transform .12s;transform:rotate(" + (aberto ? 180 : 0) + "deg)",
        abrir: () => this.setState(s => ({ filtroAberto: s.filtroAberto === f.k ? null : f.k })),
        limpar: () => this.setState(s => ({ sel: Object.assign({}, s.sel, { [f.k]: [] }) })),
        opcoes: f.opcoes.map(([v, l]) => {
          const on = sel.indexOf(v) >= 0;
          const n = todas.filter(o => passa(o, f.k) && (f.k === "proposta" ? statusProp(o) === v : f.k === "parado" ? o.dias >= +v : f.k === "familia" ? (o.familia || "CALLFACE_AI") === v : f.k === "tipo" ? (o.tipo || "nova") === v : o[f.k === "motivo" ? "motivoPerda" : f.k] === v)).length;
          return { label: l, on, n: String(n),
            caixa: "flex:0 0 auto;width:17px;height:17px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:#fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
            onClick: () => this.setState(s => { const a = s.sel[f.k].slice(); const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); return { sel: Object.assign({}, s.sel, { [f.k]: a }) }; }) };
        })
      };
    });

    const abrir = (o) => () => this.setState({ aberto: o.id, tlTudo: false });
    const cardDe = (o, c) => {
      const s = somas(o);
      return {
        empresa: o.empresa, pessoa: o.pessoa + (o.cargo ? " · " + o.cargo : ""), familia: FAM[o.familia] || "—", famStyle: famStyle(o.familia),
        temTipo: !!o.tipo && o.tipo !== "nova", tipo: ({ expansao: "Expansão", upgrade: "Upgrade", renovacao: "Renovação", reativacao: "Reativação" }[o.tipo] || "") + (o.contratoOrigem ? " · " + o.contratoOrigem.id : ""),
        tipoStyle: "display:inline-flex;align-items:center;gap:5px;margin-top:6px;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;" + (o.tipo === "renovacao" ? "background:#eeeff3;color:#4a5560" : "background:#e6f4ee;color:#1f7256"),
        temValor: (s.mrr + s.un) > 0, valorCurto: s.mrr ? brl0(s.mrr) + "/mês" : brl0(s.un),
        temUnico: !!(s.mrr && s.un), unico: "+ " + brl0(s.un) + " único",
        valorLinha: (s.mrr + s.un) > 0 ? (s.mrr ? brl0(s.mrr) + "/mês" : brl0(s.un)) : "—",
        proposta: o.proposta ? PROP[o.proposta.status] : "Sem proposta", propStyle, propPonto: propPonto(o.proposta && o.proposta.status),
        resp: o.resp || "Sem responsável", iniciais: ini(o.resp), dias: (o.dias || 0) + "d", diasStyle: diasStyle(o.dias || 0),
        abrir: abrir(o), arrastavel: true,
        pega: (e) => { if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", o.id); } this.setState({ arrastando: o.id }); },
        larga: () => this.setState({ arrastando: null, sobre: null }),
        style: "position:relative;border-radius:8px;background:#fff;padding:10px 12px;cursor:grab;outline:none;" + (S.aberto === o.id ? "border:1px solid #fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "border:1px solid #dbdede") + (S.arrastando === o.id ? ";opacity:.55" : "")
      };
    };
    const soltar = (k) => (e) => { e.preventDefault(); const id = S.arrastando; this.setState({ sobre: null, arrastando: null }); const o = todas.find(x => x.id === id); if (o) this.mover(o, k); };
    const sobre = (k) => (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; if (S.sobre !== k) this.setState({ sobre: k }); };
    const sai = (k) => () => { if (S.sobre === k) this.setState({ sobre: null }); };
    // Cabeçalho da coluna: o board carrega no máximo N cartões por coluna, então
    // lista.length subestima. Sem filtro/busca de tela vale o total do servidor;
    // com filtro, só os cartões carregados podem ser contados.
    const TOT = (D && (this.props.dados || {}).totais) || {};
    const semFiltro = !S.busca.trim() && !Object.keys(F).some(k => (F[k] || []).length);
    const contaCol = (k, lista) => String(semFiltro && TOT[k] ? TOT[k].n : lista.length);
    const totalSrv = (k, lista, fallback) => { const t = TOT[k]; if (!semFiltro || !t) return fallback; if (t.mrr == null) return t.valor ? brl0(t.valor) : fallback; const mrr = t.mrr, un = Math.max(0, (t.valor || 0) - mrr); return mrr + un ? (mrr ? brl0(mrr) + "/mês" : "") + (mrr && un ? " · " : "") + (un ? brl0(un) + " único" : "") : fallback; };
    const totalCol = (lista) => { const t = lista.reduce((a, o) => { const s = somas(o); return { mrr: a.mrr + s.mrr, un: a.un + s.un }; }, { mrr: 0, un: 0 }); return t.mrr + t.un ? brl0(t.mrr) + "/mês" + (t.un ? " · " + brl0(t.un) + " único" : "") : "Valor definido na proposta"; };
    const VAZIO = { entrada: "Oportunidade criada no Pré-vendas ou manualmente começa aqui.", diagnostico: "Reunião feita: entenda volume, dor e decisor.", proposta: "Só entra com proposta criada.", negociacao: "Ajustes, desconto e aprovação interna.", ganho: "Exige proposta aceita ou evidência.", perdido: "Sempre com motivo." };
    const GATE = { proposta: "Exige proposta criada", negociacao: "Exige proposta criada" };
    const colDefs = ["entrada", "diagnostico", "proposta", "negociacao", "ganho", "perdido"].map(k => ({ k, recolhivel: false }));
    const colunas = colDefs.filter(c => !c.recolhivel || S.expandidas[c.k]).map((c, ci) => {
      const lista = vis.filter(o => o.etapa === c.k);
      return {
        label: ROT[c.k], conta: contaCol(c.k, lista), total: totalSrv(c.k, lista, totalCol(lista)), temGate: !!GATE[c.k], gate: GATE[c.k] || "",
        ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + COR[c.k],
        recolhivel: c.recolhivel, fechar: (e) => { e.stopPropagation(); this.setState(s => ({ expandidas: Object.assign({}, s.expandidas, { [c.k]: false }) })); },
        atraso: String(260 + ci * 90), cards: lista.map(o => cardDe(o, c)), vazia: !lista.length, vazio: VAZIO[c.k],
        style: "flex:0 0 auto;width:288px;min-width:168px;display:flex;flex-direction:column;min-height:0;background:#eeeff3;border-radius:12px;padding:6px 8px 12px;transition:box-shadow .12s;" + (S.sobre === c.k ? "box-shadow:inset 0 0 0 2px rgba(255,77,41,.25)" : ""),
        sobre: sobre(c.k), sai: sai(c.k), solta: soltar(c.k)
      };
    });
    const recolhidas = colDefs.filter(c => c.recolhivel && !S.expandidas[c.k]).map(c => ({
      label: ROT[c.k], conta: contaCol(c.k, vis.filter(o => o.etapa === c.k)),
      ponto: "width:7px;height:7px;border-radius:50%;background:" + COR[c.k],
      style: "flex:0 0 auto;width:46px;display:flex;flex-direction:column;align-items:center;gap:9px;padding:10px 0 12px;border-radius:12px;background:#eeeff3;cursor:pointer;border:0;" + (S.sobre === c.k ? "box-shadow:inset 0 0 0 2px rgba(255,77,41,.25)" : ""),
      abrir: () => this.setState(s => ({ expandidas: Object.assign({}, s.expandidas, { [c.k]: true }) })),
      sobre: sobre(c.k), sai: sai(c.k), solta: soltar(c.k)
    }));
    const grupos = colDefs.map(c => {
      const lista = vis.filter(o => o.etapa === c.k), aberto = !S.listaFechadas[c.k];
      return { label: ROT[c.k], conta: contaCol(c.k, lista), total: totalSrv(c.k, lista, totalCol(lista)), aberto,
        ponto: "width:7px;height:7px;border-radius:50%;background:" + COR[c.k],
        chev: "flex:0 0 auto;transition:transform .12s;transform:rotate(" + (aberto ? 0 : -90) + "deg)",
        alternar: () => this.setState(s => ({ listaFechadas: Object.assign({}, s.listaFechadas, { [c.k]: aberto }) })),
        linhas: lista.map(o => cardDe(o, c)) };
    });

    // drawer
    const O = S.aberto ? todas.find(o => o.id === S.aberto) : null;
    let d = { passos: [], propostas: [], pessoas: [], atvs: [], timeline: [], equipe, np: {}, na: {} };
    if (O) {
      const s = somas(O), aberta = O.etapa !== "ganho" && O.etapa !== "perdido";
      const salva = (patch, ev) => this.gravarOpp(Object.assign({}, O, patch), ev);
      const ordem = ["entrada", "diagnostico", "proposta", "negociacao"], pos = ordem.indexOf(O.etapa);
      const P = O.proposta, props = O.propostas || [];
      const tl = O.eventos || [], lead = O.leadId;
      const slug = D.slug || (x => x);
      const abertas = S.propAbertas || {};
      const statusSelo = (st) => "display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:600;white-space:nowrap;"
        + ({ rascunho: "background:#eeeff3;color:#4a5560", enviada: "background:#e8f0fb;color:#2c5f9e", visualizada: "background:#f7edd8;color:#6e5420", ajuste_solicitado: "background:#fff6f4;color:#9c3210", aceita: "background:#e6f4ee;color:#1f7256", recusada: "background:#fdeeea;color:#c2330f", expirada: "background:#eeeff3;color:#8b949e", substituida: "background:#eeeff3;color:#8b949e" }[st] || "background:#eeeff3;color:#4a5560");
      const PROPX = Object.assign({ substituida: "Substituída" }, PROP);
      const setProp = (i, patch, ev) => { const a = props.slice(); a[i] = Object.assign({}, a[i], patch); salva({ propostas: a }, ev); };
      d = {
        titulo: (FAM[O.familia] || "Callface") + " · " + O.empresa,
        etapaLabel: ROT[O.etapa], etapaPonto: "width:7px;height:7px;border-radius:9999px;background:" + COR[O.etapa],
        etapaChip: "display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:9999px;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;font-size:12px;font-weight:600;color:#12171d",
        diasTexto: aberta ? "há " + (O.dias || 0) + (O.dias === 1 ? " dia" : " dias") + " nesta etapa" : "",
        valorTopo: P && (s.mrr + s.un) ? (s.mrr ? brl(s.mrr) + "/mês" : "") + (s.mrr && s.un ? " · " : "") + (s.un ? brl(s.un) + " único" : "") + " · proposta " + (PROPX[P.status] || "").toLowerCase() : "Sem valor ainda · definido na proposta, depois do diagnóstico",
        valorTopoStyle: "margin-top:4px;font-size:12.5px;font-variant-numeric:tabular-nums;" + (P ? "color:#1f252c;font-weight:600" : "color:#67787c"),
        aberta, fechada: !aberta, podeNoShow: O.etapa === "entrada" || O.etapa === "diagnostico",
        passos: ordem.map((k, i) => ({
          label: ROT[k], dica: i === pos ? "Etapa atual" : "Mover para " + ROT[k] + (GATE[k] && !P ? " · " + GATE[k] : ""),
          onClick: () => this.mover(O, k),
          barra: "display:block;height:5px;border-radius:9999px;background:" + (i < pos ? "#12171d" : i === pos ? COR[k] : "#e3e7e8"),
          rot: "font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" + (i === pos ? "font-weight:700;color:#12171d" : i < pos ? "font-weight:500;color:#4a5560" : "font-weight:500;color:#8b949e")
        })),
        ganhar: () => this.mover(O, "ganho"), perder: () => this.mover(O, "perdido"),
        noShow: () => this.setState({ modal: { k: "noshow", id: O.id }, form: {}, tentou: false }),
        fechoStyle: "display:flex;align-items:center;gap:10px;margin-top:12px;padding:11px 12px;border-radius:11px;" + (O.etapa === "ganho" ? "background:#e6f4ee;color:#1f7256" : "background:#f3f4f4;color:#4a5560"),
        fechoIco: O.etapa === "ganho" ? "M20 6 9 17l-5-5" : "M18 6 6 18M6 6l12 12",
        fechoTitulo: O.etapa === "ganho" ? "Ganha · empresa agora é Cliente" : "Perdida · " + (O.motivoPerda || "sem motivo"),
        fechoSub: O.etapa === "ganho" ? (O.evidencia || "Proposta aceita") : (O.obsPerda || "Motivo registrado para o relatório de perdas"),
        reabrir: () => { salva({ etapa: "negociacao", dias: 0 }, "Reaberta em Negociação"); this.diz("Oportunidade reaberta", "ok"); },
        abrirOpp: () => Es ? Es.irPara("/onface-preview/oportunidade", d.titulo, { opp: O.id }) : null,
        empresa: O.empresa, empIni: ini(O.empresa), pessoa: O.pessoa, pesIni: ini((O.pessoa || "").replace(/^Dr\.?\s+/, "")), cargo: O.cargo || "—",
        abrirEmpresa: () => lead && Es ? Es.irPara("/onface-preview/empresa", O.empresa, { lead }) : this.diz(O.empresa + " ainda não tem página", "aviso"),
        abrirPessoa: () => lead && Es ? Es.irPara("/onface-preview/pessoa", O.pessoa, { pessoa: slug(O.pessoa), lead }) : this.diz(O.pessoa + " ainda não tem página", "aviso"),
        resp: O.resp || equipe[0], equipe,
        setResp: (e) => { const v = e.target.value; salva({ resp: v }, "Responsável: " + v); },
        propTitulo: "Propostas (" + props.length + ")",
        semProposta: !props.length,
        semPropostaTexto: pos < 2 ? "O valor nasce na proposta. Depois do diagnóstico, crie a primeira para a oportunidade poder ir a Proposta." : "Sem proposta.",
        novaProposta: () => Es && Es.irPara("/onface-preview/proposta", "Proposta", { opp: O.id, ver: "" }),
        novaPropTxt: P && ["rascunho"].indexOf(P.status) >= 0 ? "Continuar rascunho" : P && ["enviada", "visualizada", "ajuste_solicitado"].indexOf(P.status) >= 0 ? "Nova versão" : "Nova proposta",
        propostas: props.map((p, i) => {
          const t = (p.itens || []).reduce((a, it) => { const v = (+it.valor || 0) * (+it.qtd || 1); return it.natureza === "MRR" ? { mrr: a.mrr + v, un: a.un } : { mrr: a.mrr, un: a.un + v }; }, { mrr: 0, un: 0 });
          const vig = p === P, aberta2 = abertas[i] !== undefined ? abertas[i] : vig;
          const btn = (label, onClick, forte) => ({ label, onClick, style: "height:28px;padding:0 10px;border-radius:7px;border:0;font-size:12px;font-weight:600;cursor:pointer;" + (forte ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") });
          const irP = (extra) => Es && Es.irPara("/onface-preview/proposta", "Proposta", Object.assign({ opp: O.id, ver: "" }, extra || {}));
          const acoes = [btn("Ver proposta", () => irP({ ver: String(i) }))];
          if (vig && p.status === "rascunho") {
            acoes.push(btn("Continuar editando", () => irP()));
            acoes.push(btn("Enviar ao cliente", () => { const h = new Date(); setProp(i, { status: "enviada", enviadaEm: "Hoje", log: [{ k: "enviada", quando: "Hoje, " + String(h.getHours()).padStart(2, "0") + ":" + String(h.getMinutes()).padStart(2, "0"), quem: O.resp }] }, "Proposta #" + p.codigo + "-v" + (p.versao || 1) + " enviada"); }, true));
          } else if (vig && ["enviada", "visualizada", "ajuste_solicitado"].indexOf(p.status) >= 0) {
            acoes.push(btn("Nova versão", () => irP(), p.status === "ajuste_solicitado"));
          }
          return {
            codigo: "#" + p.codigo + "-v" + (p.versao || 1), status: (PROPX[p.status] || p.status).toLowerCase(), statusStyle: statusSelo(p.status),
            codStyle: "font-size:13.5px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;font-variant-numeric:tabular-nums;color:" + (vig ? "#12171d" : "#8b949e"),
            total: brl(t.mrr + t.un), totalLinha: "Total: " + brl(t.mrr + t.un), rec: t.mrr ? "Rec: " + brl(t.mrr) + "/m" : "Sem recorrente",
            meta: (p.modo === "PREPAID" ? "Pré-pago / Checkout" : "Contrato") + " · validade " + p.validade + " dias" + (p.enviadaEm ? " · enviada " + p.enviadaEm : ""),
            aberta: aberta2, chev: "flex:0 0 auto;transition:transform .15s;transform:rotate(" + (aberta2 ? 0 : -90) + "deg)",
            alternar: () => this.setState(st => ({ propAbertas: Object.assign({}, st.propAbertas, { [i]: !aberta2 }) })),
            itens: (p.itens || []).map(it => ({ nome: it.nome + ((+it.qtd || 1) > 1 ? " × " + it.qtd : ""), natureza: NAT[it.natureza] || "", valor: brl((+it.valor || 0) * (+it.qtd || 1)) })),
            acoes, verCompleta: () => Es && Es.irPara("/onface-preview/propostas", "Propostas", { proposta: p.codigo })
          };
        }),
        pessoas: (O.pessoas || []).map((p, i) => ({
          nome: p.nome, papel: p.papel, ini: ini(p.nome.replace(/^Dr\.?\s+/, "")),
          setPapel: (e) => { const v = e.target.value; const a = O.pessoas.slice(); a[i] = Object.assign({}, p, { papel: v }); salva({ pessoas: a }); },
          remover: () => salva({ pessoas: O.pessoas.filter((_, x) => x !== i) }, p.nome + " removido da oportunidade")
        })),
        np: {
          nome: S.np.nome || "", papel: S.np.papel || "Influenciador",
          setNome: (e) => { const v = e.target.value; this.setState(st => ({ np: Object.assign({}, st.np, { nome: v }) })); },
          setPapel: (e) => { const v = e.target.value; this.setState(st => ({ np: Object.assign({}, st.np, { papel: v }) })); },
          add: () => { const n = (S.np.nome || "").trim(); if (!n) return; salva({ pessoas: (O.pessoas || []).concat({ nome: n, papel: S.np.papel || "Influenciador" }) }, n + " entrou como " + (S.np.papel || "Influenciador")); this.setState({ np: { papel: S.np.papel } }); },
          tecla: (e) => { if (e.key === "Enter") d.np.add(); }
        },
        ...(() => {
          const ui = S.dUi && S.dUi.id === O.id ? S.dUi : { id: O.id };
          const setUi = (p) => this.setState(st => ({ dUi: Object.assign({}, st.dUi && st.dUi.id === O.id ? st.dUi : { id: O.id }, p) }));
          const menu = ui.menu || null;
          const LD = lead ? (S.leads || D.LEADS || []).find(l => l.id === lead) : null;
          const IC = {
            Reunião: ["M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "#fff6f4", "#c2330f"],
            Ligação: ["M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39", "#e6f4ee", "#1f7256"],
            "E-mail": ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6", "#e8f0fb", "#2c5f9e"],
            Mensagem: ["M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", "#e6f4ee", "#1f7256"],
            Proposta: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6", "#fdeeea", "#c2330f"],
            Tarefa: ["M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", "#eeeff3", "#4a5560"]
          };
          IC["Follow up"] = IC.Tarefa;
          const VIA = {
            reuniao: ["Reunião agendada", IC.Reunião[0]], whatsapp: ["WhatsApp", IC.Mensagem[0]], ligacao: ["Ligação", IC.Ligação[0]], email: ["E-mail", IC["E-mail"][0]], outro: ["Outro", "M5 12h.01M12 12h.01M19 12h.01"]
          };
          const via = O.via || ((O.atvs || []).some(x => x.tipo === "Reunião") ? "reuniao" : (O.atvs || []).some(x => x.tipo === "E-mail") ? "email" : (O.atvs || []).some(x => x.tipo === "Ligação") ? "ligacao" : "outro");
          const abrirNa = (tipo) => { setUi({ menu: null }); if (tipo === "Reunião") return this.abrirReuniao(O); this.abrirAtv(O, null, tipo); };
          const verAtv = (i) => { setUi({ menu: null }); this.abrirAtv(O, i); };
          /* O telefone vem da OPORTUNIDADE, que agora o carrega. Procurar
             numa lista de leads era o defeito: o Pipeline carrega
             oportunidades, não leads, então `LD` vinha vazio e Ligar sempre
             respondia "Sem telefone cadastrado". A lista fica como reforço
             para quem chegou com ela carregada. */
          const tel = O.telefone || O.whatsapp || (LD && (LD.tel || LD.telefone)) || "";
          const irAt = (canal) => lead && Es ? Es.irPara("/atendimento", "Atendimento", { lead, canal }) : this.diz(O.pessoa + " ainda não tem conversa no Atendimento", "aviso");
          const canais = [
            { k: "reuniao", label: "Reunião", dica: "Agendar reunião", onClick: () => { setUi({ menu: null }); this.abrirReuniao(O); } },
            { k: "whatsapp", label: "WhatsApp", dica: "Abrir conversa no Atendimento", onClick: () => irAt("WhatsApp") },
            { k: "ligacao", label: "Ligação", dica: "Ligar pelo Callface", onClick: () => tel && Es && Es.abrirExterno ? Es.abrirExterno("https://app.callface.ai/calls?call_to=" + String(tel).replace(/\D/g, "")) : this.diz("Sem telefone cadastrado para " + O.pessoa, "aviso") },
            { k: "email", label: "E-mail", dica: "Escrever e-mail", onClick: () => irAt("E-mail") }
          ].map(c => ({ label: c.label, dica: c.k === "reuniao" && via === "reuniao" ? "Reunião agendada · agendar outra" : c.dica, temSelo: c.k === "reuniao" && via === "reuniao", onClick: c.onClick, d: VIA[c.k][1],
            style: "position:relative;display:flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 10px;border-radius:9px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;min-width:0;white-space:nowrap;overflow:hidden;"
              + (via === c.k ? "background:#fff6f4;color:#c2330f;box-shadow:inset 0 0 0 1px #f6d3c9" : "background:#f6f6f3;color:#1f252c") }));
          const item = (label, onClick, extra) => Object.assign({ label, onClick, atual: false, dot: "display:none",
            style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 10px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:500;color:#12171d" }, extra || {});
          const prox = ordem[pos + 1];
          const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
          const prevTxt = O.previsao ? (() => { const [y, m, dd] = O.previsao.split("-"); return +dd + " " + MESES[+m - 1] + " " + y; })() : "Sem previsão";
          const abertos = (O.atvs || []).map((x, i) => ({ x, i })).filter(o => !o.x.feita);
          const P1 = abertos[0];
          const setAtv = (i, patch, ev) => { const x = (O.atvs || []).slice(); x[i] = Object.assign({}, x[i], patch); salva({ atvs: x }, ev); };
          const ordenadas = abertos.concat((O.atvs || []).map((x, i) => ({ x, i })).filter(o => o.x.feita));
          const filtradas = ordenadas.filter(o => !ui.atvF || ui.atvF === "todas" || (ui.atvF === "abertas" ? !o.x.feita : o.x.feita));
          const nAtv = filtradas.length;
          const lim = ui.atvTudo ? nAtv : 4;
          const arqs = arquivosDaOpp(props, O.arquivos || [], PROPX, O.resp);
          const itensV = (P && P.itens) || O.itens || [];
          const tot = itensV.reduce((acc, it) => { const v = (+it.valor || 0) * (+it.qtd || 1); return it.natureza === "MRR" ? { mrr: acc.mrr + v, un: acc.un } : { mrr: acc.mrr, un: acc.un + v }; }, { mrr: 0, un: 0 });
          const aba = ui.aba === "prop" ? "prop" : "arq";
          const ABAS = [["arq", "Arquivos", arqs.length], ["prop", "Propostas", props.length]];
          return {
            menuAberto: !!menu, fecharMenus: () => setUi({ menu: null }),
            maisAberto: menu === "mais", toggleMais: () => setUi({ menu: menu === "mais" ? null : "mais" }),
            etapasAberto: menu === "etapas", toggleEtapas: () => setUi({ menu: menu === "etapas" ? null : "etapas" }),
            passoAberto: menu === "passo", togglePasso: () => setUi({ menu: menu === "passo" ? null : "passo" }),
            maisItens: [item("Abrir oportunidade", () => { setUi({ menu: null }); d.abrirOpp(); })]
              .concat(aberta ? [item("Marcar como perdida", () => { setUi({ menu: null }); this.mover(O, "perdido"); }, { style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 10px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:500;color:#c2330f" })] : [])
              /* Anotar sem abrir a oportunidade (pedido do Scott, 19/10): depois
                 da ligação o vendedor escreve ali mesmo. Vai para a linha do
                 tempo, não vira tarefa — nota não tem o que concluir. */
              .concat([item("Anotar", () => { setUi({ menu: null }); this.setState({ modal: { k: "nota", id: O.id }, form: {}, tentou: false }); })])
              .concat(O.etapa === "entrada" || O.etapa === "diagnostico" ? [item("Registrar no-show", () => { setUi({ menu: null }); this.setState({ modal: { k: "noshow", id: O.id }, form: {}, tentou: false }); })] : [])
              .concat(aberta ? [item("Delegar a um agente", () => { setUi({ menu: null }); window.dispatchEvent(new CustomEvent("onface:delegar-agente", { detail: { negocioId: O.id } })); })] : [])
              /* Inserir em cadência também daqui: as cadências de NEGÓCIO
                 (follow-up pós-proposta) estavam publicadas e não tinham por
                 onde entrar — a peça só era aberta em telas de lead. `O.id` é
                 o negócio, o mesmo que "Delegar a um agente" usa. */
              .concat(aberta ? [item("Inserir em cadência", () => {
                setUi({ menu: null });
                if (!this.E) return;
                window.__ofCadAlvo = { chave: O.id, nome: O.empresa || "Negócio", tipo: "negocio" };
                this.E.abrir("cadencia", O.id);
              })] : [])
              .concat(!aberta ? [item("Reabrir oportunidade", () => { setUi({ menu: null }); d.reabrir(); })] : []),
            etapasItens: ordem.map((k, i) => item(ROT[k], () => { setUi({ menu: null }); if (i !== pos) this.mover(O, k); }, { atual: i === pos, dot: "flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:" + COR[k] }))
              .concat([item("Perdido", () => { setUi({ menu: null }); this.mover(O, "perdido"); }, { dot: "flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:#8b949e" })]),
            avancarLabel: prox ? "Avançar etapa" : "Aguardando fechamento",
            avancarDica: prox ? "Mover para " + ROT[prox] : "Última etapa · fecha sozinha com contrato assinado ou pagamento",
            avancar: () => this.mover(O, prox || "ganho"),
            registrar: () => abrirNa(null),
        tags: (O.tags || []).map(n => { const t = (this.dadosDoProto.TagsOpp || []).find(x => x.nome === n) || (((this.E && this.E.ler("tagsCriadas", [])) || []).find(x => x && x.nome === n)) || {};
          return { nome: n, auto: !!t.auto, style: "display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:600;white-space:nowrap;" + (t.auto ? "background:#fff6f4;color:#c2330f;box-shadow:inset 0 0 0 1px #f6d3c9" : "background:#eeeff3;color:#1f252c") }; }),
        abrirTags: () => this.E && this.E.abrir("tagsopp", O.id),
            editando: !!ui.editar, lendo: !ui.editar,
            editarLabel: ui.editar ? "Concluir" : "Editar",
            editarStyle: "display:flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 13px;border-radius:9px;border:0;cursor:pointer;white-space:nowrap;font-size:13px;font-weight:600;flex:0 0 auto;"
              + (ui.editar ? "background:#12171d;color:#fff" : "background:#fff;color:#12171d;box-shadow:inset 0 0 0 1px #dbdede"),
            toggleEditar: () => setUi({ editar: !ui.editar, menu: null }),
            etapaChip: "display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:9999px;font-size:12px;font-weight:600;background:#f6f6f3;color:" + COR[O.etapa],
            etapaTexto: "display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:500;color:" + COR[O.etapa],
            valor: P && (s.mrr + s.un) ? (s.mrr ? brl(s.mrr) + "/mês" : "") + (s.mrr && s.un ? " + " : "") + (s.un ? brl(s.un) + " único" : "") : "Definido na proposta",
            valorStyle: "font-size:13.5px;font-variant-numeric:tabular-nums;" + (P && (s.mrr + s.un) ? "font-weight:700;color:#12171d" : "color:#8b949e"),
            respIni: ini(O.resp || equipe[0]),
            produto: FAM[O.familia] || "—", familia: O.familia,
            familias: Object.keys(FAM).map(k => ({ v: k, l: FAM[k] })),
            setFamilia: (e) => { const v = e.target.value; salva({ familia: v }, "Produto: " + FAM[v]); },
            previsao: O.previsao || "", previsaoTexto: prevTxt,
            previsaoStyle: "font-size:13.5px;white-space:nowrap;color:" + (O.previsao ? "#12171d" : "#8b949e"),
            setPrevisao: (e) => { const v = e.target.value; salva({ previsao: v }, "Previsão de fechamento alterada"); },
            origem: LD ? (LD.origem || "—") + (LD.campanha ? " · " + LD.campanha : "") : (O.origem || "Criada manualmente"),
            viaLabel: VIA[via][0], viaIco: VIA[via][1],
            canais,
            empSub: (LD && LD.segmento) || (O.pessoas || []).length + " pessoa" + ((O.pessoas || []).length === 1 ? "" : "s") + " envolvida" + ((O.pessoas || []).length === 1 ? "" : "s"),
            temProx: !!P1, semProx: !P1,
            prox: P1 ? { titulo: P1.x.titulo, tipo: P1.x.tipo, texto: P1.x.titulo + " · " + (P1.x.quando || "sem data"), ver: () => verAtv(P1.i), feito: () => setAtv(P1.i, { feita: true }, "Feita: " + P1.x.titulo) } : {},
            proxAberta: !ui.proxFechada, toggleProx: () => setUi({ proxFechada: !ui.proxFechada }),
            proxChev: "flex:0 0 auto;transition:transform .15s;transform:rotate(" + (ui.proxFechada ? -90 : 0) + "deg)",
            tlAberta: !ui.tlFechada, toggleTl: () => setUi({ tlFechada: !ui.tlFechada }),
            tlChev: "flex:0 0 auto;transition:transform .15s;transform:rotate(" + (ui.tlFechada ? -90 : 0) + "deg)",
            passoItens: P1 ? [
              item("Marcar como feito", () => { setUi({ menu: null }); setAtv(P1.i, { feita: true }, "Feita: " + P1.x.titulo); }),
              item("Ver todas as atividades", () => setUi({ menu: null, aba: "atv", atvTudo: true })),
              item("Remover", () => { setUi({ menu: null }); salva({ atvs: (O.atvs || []).filter((_, x) => x !== P1.i) }, "Removida: " + P1.x.titulo); }, { style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 10px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:500;color:#c2330f" })
            ] : [],
            resumoLendo: !ui.resumo, resumoEditando: !!ui.resumo,
            resumo: O.resumo || "Sem resumo ainda. Registre o contexto da negociação para quem pegar a oportunidade depois.",
            resumoStyle: "padding:12px 14px;border-radius:10px;background:#f6f6f3;font-size:13.5px;line-height:1.6;text-wrap:pretty;color:" + (O.resumo ? "#1f252c" : "#8b949e"),
            resumoTxt: ui.resumoTxt !== undefined ? ui.resumoTxt : (O.resumo || ""),
            editarResumo: () => setUi({ resumo: true, resumoTxt: O.resumo || "" }),
            setResumo: (e) => setUi({ resumoTxt: e.target.value }),
            cancelarResumo: () => setUi({ resumo: false, resumoTxt: undefined }),
            salvarResumo: () => { salva({ resumo: (ui.resumoTxt || "").trim() }, "Resumo atualizado"); setUi({ resumo: false, resumoTxt: undefined }); },
            abas: ABAS.map(([k, label, n]) => ({ label, n, temN: n > 0, onClick: () => setUi({ aba: k }),
              style: "flex:0 0 auto;display:flex;align-items:center;gap:6px;height:38px;padding:0 9px;border:0;background:transparent;cursor:pointer;font-size:13px;white-space:nowrap;margin-bottom:-1px;"
                + (aba === k ? "font-weight:600;color:#12171d;box-shadow:inset 0 -2px 0 #fe4f2b" : "font-weight:500;color:#67787c"),
              nStyle: "font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:" + (aba === k ? "#c2330f" : "#8b949e") })),
            abaAtv: aba === "atv", abaCom: aba === "com", abaArq: aba === "arq", abaProp: aba === "prop", abaProd: aba === "prod",
            naAberto: !!ui.na, fecharNa: () => setUi({ na: false }),
            atvMais: nAtv > 4, atvLabel: ui.atvTudo ? "Mostrar menos" : "Ver todas (" + nAtv + ")", atvAlternar: () => setUi({ atvTudo: !ui.atvTudo }),
            atvFiltros: [["todas", "Todas"], ["abertas", "Abertas"], ["concluidas", "Concluídas"]].map(([k, l]) => ({
              label: l + " · " + ordenadas.filter(o => k === "todas" || (k === "abertas" ? !o.x.feita : o.x.feita)).length,
              style: "height:28px;padding:0 11px;border-radius:7px;border:0;font-size:12px;white-space:nowrap;cursor:pointer;font-weight:" + ((ui.atvF || "todas") === k ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
              onClick: () => setUi({ atvF: k })
            })),
            atvVaziaTitulo: (ui.atvF === "abertas" ? "Nenhuma atividade aberta" : ui.atvF === "concluidas" ? "Nenhuma atividade concluída" : "Nenhuma atividade"),
            atvs: filtradas.slice(0, lim).map(({ x, i }, n) => {
              const ic = IC[x.tipo] || IC.Tarefa;
              const sit = x.situacao || (x.feita ? "Feita" : "A fazer");
              return {
                titulo: x.titulo, meta: x.tipo + " · " + (x.autor || O.resp) + (x.desc ? " · " + x.desc : ""), quando: x.quando || "sem data", situacao: sit,
                d: ic[0], dica: x.feita ? "Reabrir" : "Marcar como feita",
                seloStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;" + (sit === "Feita" ? "background:#e6f4ee;color:#1f7256" : sit === "Declinada" ? "background:#eeeff3;color:#67787c" : sit === "Em andamento" ? "background:#e8f0fb;color:#2c5f9e" : "background:#fff6f4;color:#9c3210"),
                marca: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (x.feita ? "background:#eeeff3;color:#4a5560" : "background:#fff6f4;color:#c2330f"),
                linhaStyle: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 8px;border:0;background:transparent;cursor:pointer;text-align:left;border-radius:8px;" + (n === 0 ? "" : "border-top:1px solid #f3f5f5"),
                alternar: () => setAtv(i, { feita: !x.feita }, (x.feita ? "Reaberta: " : "Feita: ") + x.titulo),
                ver: () => verAtv(i)
              };
            }),
            semAtvs: !filtradas.length,
            na: {
              titulo: S.na.titulo || "", desc: S.na.desc || "", tipo: S.na.tipo || "Ligação", quando: S.na.quando || "",
              setTitulo: (e) => { const v = e.target.value; this.setState(st => ({ na: Object.assign({}, st.na, { titulo: v }) })); },
              setDesc: (e) => { const v = e.target.value; this.setState(st => ({ na: Object.assign({}, st.na, { desc: v }) })); },
              setTipo: (e) => { const v = e.target.value; this.setState(st => ({ na: Object.assign({}, st.na, { tipo: v }) })); },
              setQuando: (e) => { const v = e.target.value; this.setState(st => ({ na: Object.assign({}, st.na, { quando: v }) })); },
              add: () => { const t = (S.na.titulo || "").trim(); if (!t) return this.diz("Dê um título à atividade", "aviso"); salva({ atvs: [{ titulo: t, desc: (S.na.desc || "").trim(), tipo: S.na.tipo || "Ligação", quando: S.na.quando || "", feita: false, autor: O.resp }].concat(O.atvs || []) }, "Atividade criada: " + t); this.setState({ na: { tipo: S.na.tipo } }); setUi({ na: false }); },
              tecla: (e) => { if (e.key === "Enter") d.na.add(); }
            },
            arquivos: arqs, semArq: !arqs.length,
            anexar: () => this.arqRef.current && this.arqRef.current.click(),
            anexou: (e) => { const l = Array.from(e.target.files || []); if (!l.length) return; salva({ arquivos: (O.arquivos || []).concat(l.map(x => ({ nome: x.name, quando: "hoje", autor: O.resp }))) }, l.length === 1 ? "Arquivo anexado: " + l[0].name : l.length + " arquivos anexados"); e.target.value = ""; },
            produtos: itensV.map(it => ({ nome: it.nome + ((+it.qtd || 1) > 1 ? " × " + it.qtd : ""), natureza: NAT[it.natureza] || it.natureza, valor: brl((+it.valor || 0) * (+it.qtd || 1)) + (it.natureza === "MRR" ? "/mês" : "") })),
            temProdutos: itensV.length > 0, semProdutos: !itensV.length,
            prodRec: tot.mrr ? "Recorrente: " + brl(tot.mrr) + "/mês" : "Sem recorrente",
            prodTotal: "Total: " + brl(tot.mrr + tot.un)
          };
        })(),
        timeline: tl.slice(0, S.tlTudo ? tl.length : 5).map((ev, i, arr) => ({ t: ev.t, meta: ev.quando + " · " + ev.autor, hora: ev.quando || "—", autor: ev.autor || "",
          dot: "flex:0 0 auto;width:9px;height:9px;border-radius:9999px;margin-top:6px;box-sizing:border-box;" + (i === 0 ? "background:#fe4f2b" : "background:#fff;border:1.5px solid #b8bdbb"),
          linha: "flex:1;width:1.5px;margin-top:5px;background:" + (i < arr.length - 1 ? "#e3e7e8" : "transparent") })),
        tlMais: tl.length > 5, tlLabel: S.tlTudo ? "Ver menos" : "Ver tudo",
        tlAlternar: () => this.setState(st => ({ tlTudo: !st.tlTudo }))
      };
    }

    // modal
    let m = { grupos: [], campos: [], resumo: [], itens: [] };
    const md0 = S.modal, MO0 = md0 ? todas.find(o => o.id === md0.id) : null;
    const md = md0, MO = MO0;
    const av = { aberto: false, situacoes: [], tipos: [], equipe: [] }; // atividade: só a peça única (pecas-host)
    const rv = { aberto: false, part: [], sits: [] }; // reunião: só a peça única (pecas-host)
    if (md && MO) {
      const Fm = S.form, s = somas(MO);
      const setF = (k, v) => this.setState(st => ({ form: Object.assign({}, st.form, { [k]: v }) }));
      const chip = (on) => "height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:" + (on ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede");
      const grupo = (k, label, ops, obrig) => ({ label, obrig: !!obrig, temErro: !!(S.tentou && obrig && !Fm[k]), erro: "Escolha uma opção",
        opcoes: ops.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return { label: l, style: chip(Fm[k] === v), onClick: () => setF(k, v) }; }) });
      const campo = (k, label, dica, obrig, longo) => { const erro = S.tentou && obrig && !(Fm[k] || "").trim(); return { label, dica, obrig: !!obrig, longo: !!longo, curto: !longo, valor: Fm[k] || "", set: (e) => setF(k, e.target.value), temErro: erro, erro: "Obrigatório",
        style: "width:100%;" + (longo ? "padding:9px 11px;resize:vertical;min-height:70px;" : "height:36px;padding:0 11px;") + "border-radius:9px;border:0;outline:0;background:#fff;font-size:13px;color:#12171d;box-shadow:inset 0 0 0 1px " + (erro ? "#d93c1a" : "#dbdede") }; };
      const tileR = (i) => "padding:11px 12px" + (i === 0 ? ";box-shadow:inset -1px 0 0 #eef1f1" : "");
      const btnForte = (cor) => "height:34px;padding:0 16px;border-radius:9px;border:0;font-size:12.5px;font-weight:600;cursor:pointer;color:#fff;background:" + cor;
      const fechar = () => this.setState({ modal: null, form: {}, tentou: false });
      const base = { temResumo: false, resumo: [], temAviso: false, grupos: [], campos: [], temSecundario: false, temItens: false, itens: [], temVer: false, ver: { meta: [] }, cancelarLabel: "Cancelar" };
      const TIPOS = ["Ligação", "Reunião", "E-mail", "Mensagem", "Tarefa", "Follow up"], SITS = ["A fazer", "Em andamento", "Feita", "Declinada"];
      const ICOT = { Ligação: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39", Reunião: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "E-mail": "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6", Mensagem: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" };
      const icoA = "flex:0 0 auto;width:36px;height:36px;border-radius:9px;background:#fff6f4;color:#c2330f;display:grid;place-items:center";
      if (md.k === "propgate") {
        m = Object.assign(base, { titulo: "Crie a proposta primeiro", sub: "Para ir a " + ROT[md.depois] + ", " + MO.empresa + " precisa de uma proposta. O valor da oportunidade nasce nela.",
          d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
          icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:9px;background:#eeeff3;color:#1f252c;display:grid;place-items:center",
          salvarLabel: "Criar proposta", salvarStyle: btnForte("#12171d"),
          salvar: () => { this.setState({ modal: null }); Es && Es.irPara("/onface-preview/proposta", "Proposta", { opp: MO.id, ver: "" }); } });
      } else if (md.k === "perda") {
        const MOT = ["Sem retorno", "Sem interesse", "Preço", "Escolheu concorrente", "Sem orçamento", "Timing / outra data", "Trava na negociação", "Trava contratual", "Projeto cancelado", "Sem fit após diagnóstico", "Outro"];
        m = Object.assign(base, { titulo: "Marcar como perdida", sub: MO.empresa + " · o motivo alimenta o relatório de perdas.", d: "M18 6 6 18M6 6l12 12",
          icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:9px;background:#fdeeea;color:#c2330f;display:grid;place-items:center",
          grupos: [grupo("motivo", "Motivo da perda", MOT, true)], campos: [campo("obs", "Observação", Fm.motivo === "Outro" ? "Obrigatória para Outro" : "Opcional", Fm.motivo === "Outro", true)],
          salvarLabel: "Marcar perdida", salvarStyle: btnForte("#c2330f"),
          salvar: () => {
            if (!Fm.motivo || (Fm.motivo === "Outro" && !(Fm.obs || "").trim())) return this.setState({ tentou: true });
            this.gravarOpp(Object.assign({}, MO, { etapa: "perdido", dias: 0, motivoPerda: Fm.motivo, obsPerda: Fm.obs || "" }), "Perdido · " + Fm.motivo);
            fechar(); this.diz(MO.empresa + " marcada como perdida", "aviso");
          } });
      } else if (md.k === "ganho") {
        const aceita = MO.proposta && MO.proposta.status === "aceita";
        m = Object.assign(base, { titulo: "Marcar como ganha", sub: aceita ? "Proposta aceita. Confirme para transformar " + MO.empresa + " em Cliente." : "Ganho exige proposta aceita ou uma evidência do fechamento.",
          d: "M20 6 9 17l-5-5", icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:9px;background:#e6f4ee;color:#1f7256;display:grid;place-items:center",
          temResumo: true, resumo: [[brl(s.mrr) + "/mês", "Recorrente"], [brl(s.un), "Único"]].map(([valor, label], i) => ({ valor, label, style: tileR(i) })),
          temAviso: !aceita, aviso: MO.proposta ? "A proposta está " + PROP[MO.proposta.status].toLowerCase() + ". Registre a evidência do fechamento." : "Não há proposta. Registre a evidência do fechamento.",
          avisoStyle: "padding:10px 12px;border-radius:10px;background:#fff6f4;color:#9c3210;font-size:12.5px;font-weight:600;line-height:1.45",
          grupos: aceita ? [] : [grupo("evid", "Evidência", ["Contrato assinado", "Pagamento confirmado", "Aceite por e-mail"], true)],
          campos: aceita ? [] : [campo("ref", "Referência", "Nº do contrato, ID do pagamento ou assunto do e-mail", true)],
          salvarLabel: "Confirmar ganho", salvarStyle: btnForte("#1f7256"),
          salvar: () => {
            if (!aceita && (!Fm.evid || !(Fm.ref || "").trim())) return this.setState({ tentou: true });
            const ev = aceita ? "Proposta aceita" : Fm.evid + " · " + Fm.ref.trim();
            this.gravarOpp(Object.assign({}, MO, { etapa: "ganho", dias: 0, evidencia: ev }), "Ganho · " + ev);
            if (Es && MO.leadId) { const ls = (Es.ler("leads", null) || D.LEADS || []).map(l => l.id === MO.leadId ? Object.assign({}, l, { etapa: "ganho" }) : l); Es.gravar({ leads: ls }); }
            fechar(); this.diz("Ganho! " + MO.empresa + " agora é Cliente", "ok");
          } });
      } else if (md.k === "nota") {
        m = Object.assign(base, { titulo: "Anotar", sub: "A nota entra na linha do tempo de " + MO.empresa + " — e aparece na ficha, no Cliente 360 e na oportunidade.",
          d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z",
          icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:9px;background:#eeeff3;color:#1f252c;display:grid;place-items:center",
          campos: [campo("texto", "Nota", "Ex: ligou, pediu para retomar depois do dia 10", true, true)],
          salvarLabel: "Salvar nota", salvarStyle: btnForte("#12171d"),
          salvar: () => {
            const texto = (Fm.texto || "").trim();
            if (!texto) return this.setState({ tentou: true });
            const pedir = this.props.registrarNota;
            fechar();
            if (!pedir) return this.diz("Anotar ainda não é gravado por esta tela.", "aviso");
            pedir(MO.id, texto);
          } });
      } else if (md.k === "noshow") {
        m = Object.assign(base, { titulo: "Registrar no-show", sub: MO.pessoa + " não apareceu. A oportunidade sai do Pipeline e o lead volta para Pré-vendas em Qualificado, com a tag No-show.",
          d: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM10 14l4 4M14 14l-4 4",
          icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:9px;background:#eeeff3;color:#1f252c;display:grid;place-items:center",
          campos: [campo("obs", "Observação", "Ex: não respondeu no WhatsApp após a reunião", false, true)],
          salvarLabel: "Devolver ao Pré-vendas", salvarStyle: btnForte("#12171d"),
          salvar: () => {
            /* Antes: tirava o cartao do estado local, devolvia o lead no localStorage do prototipo e
               avisava "voltou ao Pre-vendas" sem gravar nada. Agora so grava pelo command (registrarNoShow);
               sem ele a tela diz que nao grava e nao mexe no cartao. */
            const pedir = this.props.registrarNoShow;
            fechar();
            if (!pedir) return this.diz("Registrar no-show ainda não é gravado por esta tela.", "aviso");
            pedir(MO.id);
          } });
      } else if (md.k === "proposta") {
        const its = Fm.itens || [];
        const tot = its.reduce((a, it) => { const v = (+String(it.valor).replace(",", ".") || 0) * (+it.qtd || 1); return it.natureza === "MRR" ? { mrr: a.mrr + v, un: a.un } : { mrr: a.mrr, un: a.un + v }; }, { mrr: 0, un: 0 });
        const setIt = (i, k, v) => this.setState(st => { const a = (st.form.itens || []).slice(); a[i] = Object.assign({}, a[i], { [k]: v }); return { form: Object.assign({}, st.form, { itens: a }) }; });
        const inpI = (erro, extra) => "min-width:0;height:34px;padding:0 10px;border-radius:8px;border:0;outline:0;background:#fff;font-size:12.5px;color:#12171d;" + (extra || "") + "box-shadow:inset 0 0 0 1px " + (erro ? "#d93c1a" : "#dbdede");
        const validos = its.filter(it => (it.nome || "").trim() && +String(it.valor).replace(",", "."));
        const nova = !!md.base;
        const criar = (status) => {
          if (!validos.length || its.some(it => !(it.nome || "").trim() || !(+String(it.valor).replace(",", ".")))) return this.setState({ tentou: true });
          const itens = validos.map(it => ({ nome: it.nome.trim(), natureza: it.natureza || "MRR", valor: +String(it.valor).replace(",", "."), qtd: +it.qtd || 1 }));
          const ant = MO.propostas || [];
          const base = nova ? ant.filter(p => p.codigo === md.base) : [];
          const codigo = nova ? md.base : "P-" + (1500 + Math.floor(Date.now() / 1000) % 9000);
          const versao = nova ? Math.max.apply(null, base.map(p => p.versao || 1)) + 1 : 1;
          const props = ant.map(p => nova && p.codigo === md.base && ["aceita", "recusada"].indexOf(p.status) < 0 ? Object.assign({}, p, { status: "substituida" }) : p)
            .concat({ codigo, versao, status, modo: Fm.modo || "CONTRACT", validade: +(Fm.validade || 14), enviadaEm: status === "enviada" ? "Hoje" : null, itens });
          let o = this.gravarOpp(Object.assign({}, MO, { propostas: props }), "Proposta #" + codigo + "-v" + versao + (status === "enviada" ? " enviada" : " criada como rascunho"));
          if (md.depois) o = this.gravarOpp(Object.assign({}, o, { etapa: md.depois, dias: 0 }), "Movido de " + ROT[MO.etapa] + " para " + ROT[md.depois]);
          this.setState({ propAbertas: {} });
          fechar(); this.diz("Proposta #" + codigo + "-v" + versao + " " + (status === "enviada" ? "enviada" : "salva") + (md.depois ? " · " + MO.empresa + " em " + ROT[md.depois] : ""), "ok");
        };
        m = Object.assign(base, { titulo: nova ? "Nova versão da proposta" : "Nova proposta", sub: md.depois ? "Para ir a " + ROT[md.depois] + ", " + MO.empresa + " precisa de uma proposta." : (FAM[MO.familia] || "") + " · " + MO.empresa + (nova ? " · a versão anterior fica como substituída" : ""),
          d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5",
          icoStyle: "flex:0 0 auto;width:36px;height:36px;border-radius:9px;background:#eeeff3;color:#1f252c;display:grid;place-items:center",
          grupos: [grupo("modo", "Modo de fechamento", [["CONTRACT", "Contrato"], ["PREPAID", "Pré-pago / Checkout"]], true), grupo("validade", "Validade", [["7", "7 dias"], ["14", "14 dias"], ["22", "22 dias"], ["30", "30 dias"]], true)],
          temItens: true,
          itens: its.map((it, i) => ({
            nome: it.nome || "", natureza: it.natureza || "MRR", valor: it.valor || "", qtd: it.qtd || "1",
            nomeStyle: inpI(S.tentou && !(it.nome || "").trim()), valorStyle: inpI(S.tentou && !(+String(it.valor).replace(",", ".")), "text-align:right;"),
            setNome: (e) => setIt(i, "nome", e.target.value), setNat: (e) => setIt(i, "natureza", e.target.value),
            setValor: (e) => setIt(i, "valor", e.target.value.replace(/[^\d,.]/g, "")), setQtd: (e) => setIt(i, "qtd", e.target.value.replace(/[^\d]/g, "")),
            remover: () => this.setState(st => ({ form: Object.assign({}, st.form, { itens: (st.form.itens || []).filter((_, x) => x !== i) }) }))
          })),
          addItem: () => this.setState(st => ({ form: Object.assign({}, st.form, { itens: (st.form.itens || []).concat({ nome: "", natureza: "MRR", valor: "", qtd: "1" }) }) })),
          itensRec: tot.mrr ? "Rec: " + brl(tot.mrr) + "/m" : "Sem recorrente", itensTotal: "Total: " + brl(tot.mrr + tot.un),
          temSecundario: true, secundarioLabel: "Salvar rascunho", secundario: () => criar("rascunho"),
          salvarLabel: "Criar e enviar", salvarStyle: btnForte("#12171d"), salvar: () => criar("enviada") });
      }
    }

    return {
      busca: S.busca, setBusca: (e) => this.setState({ busca: e.target.value }), filtros,
      visoes: [["quadro", "Quadro"], ["lista", "Lista"]].map(([k, l]) => ({ label: l, onClick: () => this.setState({ visao: k }),
        style: "padding:0 12px;border-radius:7px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (S.visao === k ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.08)" : "background:transparent;color:#4a5560;font-weight:500") })),
      ehQuadro: S.visao === "quadro", ehLista: S.visao === "lista",
      colunas, recolhidas, grupos,
      exp, expRef: this.expRef, exportMenu: !!S.exportMenu, parar: (e) => e.stopPropagation(),
      toggleExportMenu: () => { const r = this.expRef.current && this.expRef.current.getBoundingClientRect(); this.setState(s => ({ exportMenu: !s.exportMenu, expRect: r ? { top: r.top, bottom: r.bottom, right: r.right, left: r.left } : null })); },
      exportMenuStyle: (() => { const r = S.expRect, vw = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1200;
        return "position:fixed;z-index:70;width:290px;max-width:calc(100vw - 20px);padding:5px;background:#fff;border-radius:11px;box-shadow:0 0 0 1px #e3e7e8,0 16px 40px -12px rgba(18,23,29,.3);top:" + ((r ? r.bottom : 60) + 6) + "px;left:" + Math.max(10, Math.min(vw - 300, (r ? r.right : 300) - 290)) + "px"; })(),
      /* A planilha sai do SERVIDOR, não daqui.
         Montada no navegador, ela só continha os cartões que a tela tinha
         carregado — o board corta em 1.800 e as colunas Ganho/Perdido nem
         abrem — e saía sem telefone e sem e-mail, porque o cartão não tem
         esses campos. A rota refaz a consulta com o MESMO recorte, sem teto,
         e busca o contato de cada lead. Ver app/(produto)/pipeline/exportar. */
      exportar: () => {
        const q = new URLSearchParams();
        if (S.busca) q.set("busca", S.busca);
        const f = S.filtros || {};
        if (f.responsavel) q.set("responsavel", f.responsavel);
        if (f.familia) q.set("familia", f.familia);
        if (f.motion) q.set("motion", f.motion);
        if (f.semProximaAcao) q.set("semProximaAcao", "1");
        const url = "/pipeline/exportar" + (q.toString() ? "?" + q.toString() : "");
        if (typeof window !== "undefined") window.location.href = url;
        this.setState({ exportMenu: false });
        this.diz("Gerando a planilha com o quadro inteiro...", "ok");
      },
      temDrawer: !!O, d, fecharDrawer: () => this.setState({ aberto: null }),
      naturezas: Object.keys(NAT).map(k => ({ v: k, l: NAT[k] })),
      papeis: ["Contato principal", "Decisor", "Influenciador", "Financeiro", "Técnico", "Usuário", "Outro"],
      tiposAtv: ["Ligação", "Reunião", "E-mail", "Mensagem", "Tarefa", "Follow up"],
      reu: { aberto: false, conv: [], duracoes: [], tipos: [], equipe: [] }, // idem
      av, rv, temModal: !!(md && MO), m, fecharModal: () => this.setState({ modal: null, form: {}, tentou: false }), parar: (e) => e.stopPropagation()
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <PipelineDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as PipelineLiga };
