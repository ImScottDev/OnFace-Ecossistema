// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * TagsOportunidade — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * TagsOportunidadeDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `TagsOportunidadeDesenho.tsx`, convertido por máquina e intocável.
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

import { TagsOportunidadeDesenho } from "./TagsOportunidadeDesenho";
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

  state = { oppId: null, sel: [], comEmp: true, comPes: true, pessoa: null, busca: "", novaAuto: false };

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
    this._off = E.assinarPecas((peca, id) => {
      if (peca !== "tagsopp" && peca !== "tagslead") return;
      const O = peca === "tagslead" ? this.leadAlvo(id) : this.opp(id);
      if (!O) return;
      this.setState({ oppId: id, tipo: peca === "tagslead" ? "lead" : "opp", sel: (O.tags || []).slice(), comEmp: !!O.empresa, comPes: peca !== "tagslead", pessoa: O.pessoa, busca: "", novaAuto: false });
    });
    this._esc = (e) => { if (e.key === "Escape" && this.state.oppId) this.setState({ oppId: null }); };
    document.addEventListener("keydown", this._esc);
  }
  componentWillUnmount() { if (this._off) this._off(); document.removeEventListener("keydown", this._esc); }

  opps() { const E = this.E, D = this.dadosDoProto || {}; return (E && E.ler("opps", null)) || D.OPORTUNIDADES || []; }
  opp(id) { return this.opps().find(o => o.id === id) || null; }
  leads() { const E = this.E, D = this.dadosDoProto || {}; return (E && E.ler("leads", null)) || D.LEADS || []; }
  leadAlvo(id) {
    const E = this.E, L = this.leads().find(l => l.id === id); if (!L) return null;
    const extras = ((E && E.ler("tagsLead", {})) || {})[id] || [];
    const base = (L.tag ? [L.tag] : []).concat([L.interesse]).filter(Boolean);
    return { id, lead: true, empresa: L.empresa, pessoa: L.pessoa, familia: null, tags: base.concat(extras.filter(x => base.indexOf(x) < 0)), base, resp: L.resp, eventos: [] };
  }
  slug(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  agora() { const d = new Date(); return "Hoje, " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  renderVals() {
    const S = this.state, E = this.E;
    const ehLead = S.tipo === "lead";
    const O = S.oppId ? (ehLead ? this.leadAlvo(S.oppId) : this.opp(S.oppId)) : null;
    if (!O) return { aberto: false, auto: [], org: [], pessoas: [], tiposNova: [] };
    const FAM = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
    const criadas = ((E && E.ler("tagsCriadas", [])) || []).map(t => typeof t === "string" ? { nome: t, auto: false } : t);
    const CAT_LEAD = [
      { nome: "Reunião pedida", auto: true, agente: "Cadência Primeiro contato", efeito: "Dispara o fluxo de agendamento com os horários livres do SDR" },
      { nome: "Sem orçamento", auto: true, agente: "Cadência Reativação", efeito: "Move para nutrição em 7 dias e retoma o contato depois" },
      { nome: "Enterprise", auto: true, agente: "Cadência Pós-proposta", efeito: "Roteia para o time de contas grandes" },
      { nome: "Reativar", auto: true, agente: "Cadência Reativação", efeito: "Entra na régua de retomada" },
      { nome: "Inbound", auto: false }, { nome: "Sem CNPJ", auto: false }, { nome: "Concorrente", auto: false },
      { nome: "Callface AI", auto: false }, { nome: "PABX", auto: false }, { nome: "White Label", auto: false }, { nome: "No-show", auto: false }
    ];
    const CATB = ehLead ? CAT_LEAD : (this.dadosDoProto.TagsOpp || []);
    const cat = CATB.concat(criadas.filter(c => !CATB.some(x => x.nome === c.nome)))
      .concat(S.sel.filter(n => !CATB.some(x => x.nome === n) && !criadas.some(c => c.nome === n)).map(n => ({ nome: n, auto: false })));
    const q = S.busca.trim().toLowerCase();
    const vis = cat.filter(t => !q || t.nome.toLowerCase().indexOf(q) >= 0);
    const tog = (n) => this.setState(s => ({ sel: s.sel.indexOf(n) >= 0 ? s.sel.filter(x => x !== n) : s.sel.concat(n) }));
    const caixa = (on) => "flex:0 0 auto;width:18px;height:18px;border-radius:5px;display:grid;place-items:center;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #a9b1b4");
    const pessoas = [O.pessoa].concat((O.pessoas || []).map(p => p.nome)).filter((x, i, a) => x && a.indexOf(x) === i);
    const pessoa = S.pessoa || O.pessoa;
    const autoSel = S.sel.filter(n => (cat.find(t => t.nome === n) || {}).auto && (O.tags || []).indexOf(n) < 0);
    const alvo = [ehLead ? "o lead" : "a oportunidade"].concat(S.comEmp ? [O.empresa] : []).concat(S.comPes && pessoa ? [pessoa] : []);
    const lista = (a) => a.length > 1 ? a.slice(0, -1).join(", ") + " e " + a[a.length - 1] : a[0];
    const box = (on) => "display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;border:0;cursor:pointer;background:" + (on ? "#fff" : "#fafafa") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #e3e7e8");
    const fechar = () => this.setState({ oppId: null });
    const limpa = S.busca.trim();
    const existe = cat.some(t => t.nome.toLowerCase() === limpa.toLowerCase());
    const criar = () => {
      if (!limpa || existe) return;
      if (E) E.gravar({ tagsCriadas: ((E.ler("tagsCriadas", [])) || []).filter(t => (typeof t === "string" ? t : t.nome) !== limpa).concat(S.novaAuto ? [{ nome: limpa, auto: true, agente: "Automação a configurar", efeito: "Ainda sem fluxo ligado. Configure em Automações." }] : [limpa]) });
      this.setState(s => ({ sel: s.sel.concat(limpa), busca: "" }));
    };
    const aplicar = () => {
      if (!E) return;
      if (ehLead) {
        const antes = O.tags, novas = S.sel, add = novas.filter(n => antes.indexOf(n) < 0);
        const tl = Object.assign({}, E.ler("tagsLead", {})); tl[O.id] = novas.filter(n => O.base.indexOf(n) < 0);
        const patch = { tagsLead: tl };
        if (S.comEmp && O.empresa && add.length) { const emps = Object.assign({}, E.ler("empresas", {})); const X = emps[O.empresa] || {}; const base = X.tags || O.base.slice(); emps[O.empresa] = Object.assign({}, X, { tags: base.concat(add.filter(n => base.indexOf(n) < 0)) }); patch.empresas = emps; }
        if (O.pessoa && add.length) { const ps = Object.assign({}, E.ler("pessoas", {})); const k2 = this.slug(O.pessoa) + "@" + this.slug(O.empresa); const P = ps[k2] || {}; const base = P.tags || ["Inbound", "Tomador de decisão"]; ps[k2] = Object.assign({}, P, { tags: base.concat(add.filter(n => base.indexOf(n) < 0)) }); patch.pessoas = ps; }
        E.gravar(patch); this.setState({ oppId: null });
        const autos = add.filter(n => (cat.find(x => x.nome === n) || {}).auto);
        E.avisar(autos.length ? (cat.find(x => x.nome === autos[0]).agente) + " disparada · tags aplicadas" : add.length || novas.length !== antes.length ? "Tags do lead atualizadas" : "Nenhuma mudança nas tags", "ok");
        return;
      }
      const novas = S.sel, antes = O.tags || [];
      const add = novas.filter(n => antes.indexOf(n) < 0), rem = antes.filter(n => novas.indexOf(n) < 0);
      const ops = this.opps().slice(), i = ops.findIndex(x => x.id === O.id);
      const evs = add.map(n => ({ t: "Tag “" + n + "” adicionada" + ((cat.find(t => t.nome === n) || {}).auto ? " · " + (cat.find(t => t.nome === n).agente) + " acionado" : ""), quando: this.agora(), autor: this.eu }))
        .concat(rem.map(n => ({ t: "Tag “" + n + "” removida", quando: this.agora(), autor: this.eu })));
      let atvs = (O.atvs || []).slice();
      if (add.indexOf("Follow up proposta") >= 0) atvs = [{ titulo: "Follow up da proposta", tipo: "Follow up", situacao: "A fazer", feita: false, autor: O.resp, quando: "Em 2 dias úteis", auto: true,
        desc: "Criada pela tag “Follow up proposta”. O agente de follow-up vai lembrar você e enviar um lembrete a " + O.pessoa + " se a proposta seguir sem resposta." }].concat(atvs);
      if (i >= 0) ops[i] = Object.assign({}, O, { tags: novas, atvs, eventos: evs.concat(O.eventos || []) });
      const patch = { opps: ops };
      if (S.comEmp && add.length) { const emps = Object.assign({}, E.ler("empresas", {})); const X = emps[O.empresa] || {}; const L = ((E.ler("leads", null)) || (this.dadosDoProto || {}).LEADS || []).find(l => l.empresa === O.empresa) || {};
        const base = X.tags || [L.tag, L.interesse].filter(Boolean); emps[O.empresa] = Object.assign({}, X, { tags: base.concat(add.filter(n => base.indexOf(n) < 0)) }); patch.empresas = emps; }
      if (S.comPes && pessoa && add.length) { const ps = Object.assign({}, E.ler("pessoas", {})); const k = this.slug(pessoa) + "@" + this.slug(O.empresa); const P = ps[k] || {};
        const base = P.tags || (pessoa === O.pessoa ? ["Inbound", "Tomador de decisão"] : []); ps[k] = Object.assign({}, P, { tags: base.concat(add.filter(n => base.indexOf(n) < 0)) }); patch.pessoas = ps; }
      E.gravar(patch);
      this.setState({ oppId: null });
      const autos = add.filter(n => (cat.find(t => t.nome === n) || {}).auto);
      E.avisar(!add.length && !rem.length ? "Nenhuma mudança nas tags" : autos.length ? (autos.length > 1 ? autos.length + " automações acionadas" : (cat.find(t => t.nome === autos[0]).agente) + " acionado") + " · tags aplicadas em " + lista(alvo) : "Tags atualizadas em " + lista(alvo), "ok");
    };
    return {
      aberto: true, fechar, parar: (e) => e.stopPropagation(),
      sub: ehLead ? (O.pessoa + (O.empresa ? " · " + O.empresa : "") + " · Pré-vendas") : (FAM[O.familia] || "") + " · " + O.empresa,
      titulo: ehLead ? "Tags do lead" : "Tags da oportunidade", temEmp: !!O.empresa, temPes: !ehLead, 
      empresa: O.empresa, comEmp: S.comEmp, togEmp: () => this.setState(s => ({ comEmp: !s.comEmp })), empStyle: box(S.comEmp), empCaixa: caixa(S.comEmp),
      comPes: S.comPes, togPes: () => this.setState(s => ({ comPes: !s.comPes })), pesBox: box(S.comPes), pesCaixa: caixa(S.comPes),
      pesRotulo: pessoa === O.pessoa ? "Contato da proposta" : "Outro contato", pessoa, pessoas: pessoas.map(p => ({ v: p, l: p })), setPessoa: (e) => this.setState({ pessoa: e.target.value, comPes: true }),
      alcance: "As tags novas vão para " + lista(alvo) + ". As que disparam automação começam a rodar ao aplicar.",
      busca: S.busca, setBusca: (e) => this.setState({ busca: e.target.value }), buscaLimpa: limpa,
      tecla: (e) => { if (e.key === "Enter") { e.preventDefault(); const t = vis[0]; if (t && t.nome.toLowerCase() === limpa.toLowerCase()) { tog(t.nome); this.setState({ busca: "" }); } else criar(); } },
      podeCriar: !!limpa && !existe, criar,
      tiposNova: [[false, "Organização", "Só para filtrar e agrupar", "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"], [true, "Dispara automação", "Liga um fluxo depois em Automações", "M13 2 3 14h9l-1 8 10-12h-9z"]].map(([v, l, s2, d]) => ({ l, s: s2, d, onClick: () => this.setState({ novaAuto: v }),
        style: "display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;border:0;cursor:pointer;" + (S.novaAuto === v ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") })),
      auto: vis.filter(t => t.auto).map((t, k) => { const on = S.sel.indexOf(t.nome) >= 0; return { nome: t.nome, agente: t.agente, efeito: t.efeito, on, caixa: caixa(on), onClick: () => tog(t.nome),
        linha: "display:flex;align-items:flex-start;gap:12px;width:100%;padding:12px 14px;border:0;cursor:pointer;background:" + (on ? "#fff8f6" : "#fff") + ";" + (k ? "box-shadow:inset 0 1px 0 #f1f3f3" : "") }; }),
      org: vis.filter(t => !t.auto).map(t => { const on = S.sel.indexOf(t.nome) >= 0; return { nome: t.nome, on, onClick: () => tog(t.nome),
        chip: "display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") }; }),
      temAuto: vis.some(t => t.auto), temOrg: vis.some(t => !t.auto), nada: !vis.length && !limpa,
      resumo: S.sel.length + (S.sel.length === 1 ? " tag" : " tags") + (ehLead ? " no lead" : " na oportunidade") + (autoSel.length ? " · " + autoSel.length + (autoSel.length > 1 ? " automações vão rodar" : " automação vai rodar") : ""),
      aplicar
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <TagsOportunidadeDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as TagsOportunidadeLiga };
