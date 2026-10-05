// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Pessoa — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * PessoaDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `PessoaDesenho.tsx`, convertido por máquina e intocável.
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

import { PessoaDesenho } from "./PessoaDesenho";
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

  state = { v2: null, mencao: null, mencaoIdx: 0, visor: null, notaAnexos: [], aba: "Visão geral", canal: "Todos", editando: false, rascunho: {}, tagMenu: false, tagRect: null, tagNova: "", maisMenu: false, maisRect: null, notaTexto: "", notaAtiva: false, chamada: null, agora: 0, rev: 0 };

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
    const assinar = () => {
      const Es = this.E;
      if (!Es || this._off) return !!this._off;
      this._off = Es.assinar(() => this.setState(s => ({ rev: s.rev + 1 })));
      this.setState(s => ({ rev: s.rev + 1 }));
      return true;
    };
    if (!assinar()) this._assT = setInterval(() => { if (assinar()) clearInterval(this._assT); }, 50);
    this._fora = (e) => {
      const den = (sel) => e.target.closest && e.target.closest(sel);
      if (this.state.tagMenu && !den("[data-of-ptag]")) this.setState({ tagMenu: false });
      if (this.state.maisMenu && !den("[data-of-pmais]")) this.setState({ maisMenu: false });
      if (this.state.respMenu && !den("[data-of-presp]")) this.setState({ respMenu: false });
    };
    document.addEventListener("pointerdown", this._fora, true);
    this._k = (e) => {
      if (e.key !== "Escape") return;
      if (this.state.visor) return this.setState({ visor: null });
      if (this.state.tagMenu) return this.setState({ tagMenu: false });
      if (this.state.maisMenu) return this.setState({ maisMenu: false });
      if (this.state.respMenu) return this.setState({ respMenu: false });
      if (this.state.editando) return this.setState({ editando: false });
      if (this.state.v2) return this.setState({ v2: null });
    };
    window.addEventListener("keydown", this._k);
  }

  componentWillUnmount() {
    if (this._off) this._off();
    clearInterval(this._assT); clearInterval(this._tick);
    document.removeEventListener("pointerdown", this._fora, true);
    window.removeEventListener("keydown", this._k);
  }

  pos(r, alto) {
    const vh = (typeof window !== "undefined" ? window.innerHeight : 900);
    if (!r) return "top:120px;";
    const abaixo = vh - r.bottom - 12, acima = r.top - 12;
    const cima = abaixo < alto && acima > abaixo;
    return (cima ? "bottom:" + (vh - r.top + 6) + "px;" : "top:" + (r.bottom + 6) + "px;") + "max-height:" + Math.max(160, Math.min(alto, cima ? acima : abaixo)) + "px;";
  }

  renderVals() {
    const S = this.state;
    const Es = new Proxy({}, {
      get: (_, k) => { const E = this.E; const v = E && E[k]; return typeof v === "function" ? v.bind(E) : v; },
      has: () => !!this.E
    });
    const D = this.dadosDoProto || {};
    const slug = D.slug || ((s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""));
    const ini = D.iniciais || ((n) => (n || "").split(" ").slice(0, 2).map(p => p[0] || "").join("").toUpperCase());
    const etapas = D.ETAPAS || {};
    const diz = (t, tom) => Es && Es.avisar(t, tom);
    const leads0 = (this.E && Es.ler("leads", null)) || D.LEADS || [];
    const leads = this.E && Es.leadsCom ? Es.leadsCom(leads0) : leads0;
    const leadId = (this.E && (Es.parametro("registro") || Es.parametro("lead"))) || (leads[0] || {}).id;
    const L = leads.find(x => x.id === leadId) || leads[0] || {};
    const nomeEmp = L.empresa || "Sem empresa";
    const empresas = (this.E && Es.ler("empresas", {})) || {};
    const X = empresas[nomeEmp] || {};
    const dominio = slug(nomeEmp) + ".com.br";
    const mailDe = (n) => slug((n || "").split(" ")[0]) + "." + slug((n || "").split(" ").slice(-1)[0]) + "@" + dominio;

    const base = [
      /* ANTES: `tel: L.tel || "+55 11 91234-5678"` — telefone inventado quando o
         contato não tem número. A ficha mostrava e o botão discava para ele. */
      Object.assign({ nome: L.pessoa, cargo: L.cargo, tel: L.tel || "", principal: true }, L.email ? { email: L.email } : {})
    ].concat(L.registro ? [] : [
      { nome: "Ricardo Alves", cargo: "Gerente de TI", tel: "+55 11 99876-5432" },
      { nome: "Juliana Prado", cargo: "Gerente de CX", tel: "+55 11 98765-4321" }
    ]).concat((X.pessoas || []).map(p => ({ nome: p.nome, cargo: p.cargo, tel: p.tel, email: p.email })));
    const alvoSlug = (this.E && Es.parametro("pessoa")) || slug(L.pessoa || "");
    const bruto = base.find(p => slug(p.nome || "") === alvoSlug) || base[0];
    const pk = slug(bruto.nome || "") + "@" + slug(nomeEmp);
    const todasP = (this.E && Es.ler("pessoas", {})) || {};
    const O = todasP[pk] || {};
    /* ANTES: e-mail montado do nome (`mailDe`), LinkedIn montado do nome e
       cidade "São Paulo / SP" fixa. Três dados do contato inventados pela ficha. */
    const P = Object.assign({ email: bruto.email || "", whats: bruto.tel, linkedin: "", cidade: L.cidade || "", obs: "" }, bruto, O);
    const gravarP = (patch) => { if (!this.E) return; const t = Object.assign({}, Es.ler("pessoas", {})); t[pk] = Object.assign({}, t[pk] || {}, patch); Es.gravar({ pessoas: t }); };
    const evento = (titulo, d) => {
      if (!this.E) return;
      const t = Object.assign({}, Es.ler("empresas", {}));
      const e = t[nomeEmp] || {};
      const ag = new Date();
      const hh = String(ag.getHours()).padStart(2, "0") + ":" + String(ag.getMinutes()).padStart(2, "0");
      t[nomeEmp] = Object.assign({}, e, { eventos: [{ titulo, autor: P.nome, quando: "Hoje, " + hh, d, ts: ag.getTime() }].concat(e.eventos || []) });
      Es.gravar({ empresas: t });
    };
    const primeiro = (P.nome || "").split(" ")[0];
    const equipe = D.EQUIPE || ["Camila Reis", "Diego Nunes", "Ana Vitória"];
    const ico = {
      wa: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
      tel: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39",
      mail: "M4 4h16v16H4zM4 7l8 6 8-6",
      cal: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
      nota: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6",
      copiar: "M9 9h11v11H9zM5 15H4V4h11v1",
      abrir: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
    };
    const copiar = (v, rot) => () => {
      const reserva = () => { try { const t = document.createElement("textarea"); t.value = v; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); } catch (e) {} };
      try { const pr = navigator.clipboard && navigator.clipboard.writeText(v); if (pr && pr.catch) pr.catch(reserva); else if (!pr) reserva(); } catch (e) { reserva(); }
      diz(rot + " copiado", "ok");
    };

    const ligarCallface = () => {
      /* Lê telefone E whatsapp: a ficha mostra o número no topo vindo de
         qualquer um dos dois, e ler só `tel` fazia o botão dizer "não tem
         telefone cadastrado" com o número na tela. */
      let num = String(P.tel || P.whats || L.tel || "").replace(/\D/g, "");
      if (num.length > 11 && num.indexOf("55") === 0) num = num.slice(2);
      if (num.length < 10) return diz(primeiro + " não tem telefone cadastrado", "erro");
      if (Es && Es.abrirExterno) Es.abrirExterno("https://app.callface.ai/calls?call_to=" + num); else window.open("https://app.callface.ai/calls?call_to=" + num, "_blank");
      evento("Ligação iniciada no Callface", ico.tel);
      diz("Abrindo o Callface para ligar para " + primeiro, "ok");
    };
    const abrirAtendimento = (canal) => { if (Es) Es.irPara("/atendimento", "Atendimento", { lead: L.id, canal }); };
    const iniciarChamada = () => {
      clearInterval(this._tick);
      this.setState({ chamada: { ini: Date.now() }, agora: Date.now() });
      this._tick = setInterval(() => this.setState({ agora: Date.now() }), 1000);
    };
    const seg = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };

    // interações desta pessoa
    const eventos = (X.eventos || []).filter(ev => ev.autor === P.nome);
    const nomesBase = base.map(p => p.nome);
    const eventosEmp = (X.eventos || []).filter(ev => nomesBase.indexOf(ev.autor) < 0);
    const escopo = S.escopo || "contato";
    const escOk = (v) => escopo === "tudo" || v === escopo;
    const escChip = (v) => "display:none";
    const escRot = (v) => v === "empresa" ? "Empresa" : (P.nome || "").replace(/^Dr\.?\s+/, "").split(" ")[0];
    const mkEsc = (vs) => [["contato", (P.nome || "").replace(/^Dr\.?\s+/, "").split(" ")[0]], ["empresa", nomeEmp], ["tudo", "Tudo"]].map(([k, l]) => {
      const n = k === "tudo" ? vs.length : vs.filter(v => v === k).length, on = escopo === k;
      return { label: l, n: String(n), onClick: () => this.setState({ escopo: k }),
        style: "display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12.5px;text-align:left;" + (on ? "background:#eeeff3;color:#12171d;font-weight:600" : "background:transparent;color:#4a5560;font-weight:500"),
        d: k === "tudo" ? "M4 6h16M4 12h16M4 18h16" : k === "empresa" ? "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01" : "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
        nStyle: "font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;color:" + (on ? "#12171d" : "#8b949e") };
    });
    const semente = L.registro ? [
      { titulo: "Cadastrado em Contatos & Empresas", detalhe: (L.origem || "Cadastro manual") + (L.campanha ? " · " + L.campanha : ""), quando: dataCriacao(L.criadoEm), tipo: "Sistema", vinc: "contato" }
    ] : (bruto.principal ? [
      { titulo: "WhatsApp recebido", detalhe: "“Consegue me enviar o material?”", quando: "Ontem, 13:42", tipo: "WhatsApp", vinc: "contato" }
    ] : [
      { titulo: "E-mail enviado", detalhe: "Apresentação da " + nomeEmp + " · sem resposta", quando: "há 6 dias", tipo: "E-mail", vinc: "contato" }
    ]).concat([
      { titulo: "Lead criado via " + (L.origem || "—"), detalhe: L.campanha || "Entrada inbound", quando: "20 set", tipo: "Sistema", vinc: "empresa" },
      { titulo: "Campanha " + (L.campanha || L.origem || "—"), detalhe: L.origem || "", quando: "20 set", tipo: "Sistema", vinc: "empresa" }
    ]);
    const tipoDe = (t) => /WhatsApp/.test(t) ? "WhatsApp" : /Ligação/.test(t) ? "Ligação" : /E-mail/.test(t) ? "E-mail" : /Nota/.test(t) ? "Nota" : "Sistema";
    const todasInter0 = eventos.map(ev => ({ titulo: ev.titulo, detalhe: ev.autor, quando: ev.quando, tipo: tipoDe(ev.titulo), vinc: "contato" }))
      .concat(eventosEmp.map(ev => ({ titulo: ev.titulo, detalhe: ev.autor, quando: ev.quando, tipo: tipoDe(ev.titulo), vinc: "empresa" })))
      .concat(semente);
    const todasInter = todasInter0.filter(t => escOk(t.vinc));
    const icoTipo = { WhatsApp: ico.wa, "Ligação": ico.tel, "E-mail": ico.mail, Nota: ico.nota, Sistema: "M12 5v14M5 12h14" };
    const canalSel = S.canal;
    const inter = todasInter.filter(t => canalSel === "Todos" || t.tipo === canalSel);

    // oportunidades
    const opps = leads.filter(x => x.empresa === nomeEmp && x.etapa === "oportunidade" && (x.oppContato ? x.oppContato === P.nome : !!bruto.principal));

    // notas
    const notas = P.notas || [];
    const nt = S.notaTexto || "";
    const salvarNota = () => {
      if (!nt.trim()) return;
      const ag = new Date();
      const hh = String(ag.getHours()).padStart(2, "0") + ":" + String(ag.getMinutes()).padStart(2, "0");
      gravarP({ notas: [{ id: "n" + Date.now(), autor: this.eu, texto: nt.trim(), quando: "Hoje, " + hh }].concat(notas) });
      evento("Nota sobre " + primeiro + " adicionada", ico.nota);
      this.setState({ notaTexto: "", notaAtiva: false });
      diz("Nota adicionada", "ok");
    };

    // tags
    const tagsAtuais = P.tags || (bruto.principal && !L.registro ? ["Inbound", "Tomador de decisão"] : []);
    const tagsBase = ["Inbound", "Tomador de decisão", "Influenciador", "Técnico", "Financeiro", "Champion", "Não responde"];
    const criadas = ((this.E && Es.ler("tagsCriadas", [])) || []).map(t => typeof t === "string" ? t : t.nome);
    const todasTags = tagsBase.concat(criadas).concat(tagsAtuais).filter((t, i, a) => t && a.indexOf(t) === i);
    const novaTag = (S.tagNova || "").trim();
    const criarTag = () => {
      if (!novaTag) return;
      if (this.E && todasTags.indexOf(novaTag) < 0) Es.gravar({ tagsCriadas: ((Es.ler("tagsCriadas", [])) || []).concat(novaTag) });
      if (tagsAtuais.indexOf(novaTag) < 0) gravarP({ tags: tagsAtuais.concat(novaTag) });
      this.setState({ tagNova: "" });
    };

    // qualificação (só principal)
    const q = ((this.E && Es.ler("qual", {})) || {})[L.id] || {};
    const chip = (v) => "display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:600;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" + (v ? "background:#eeeff3;color:#1f252c" : "background:transparent;color:#8b949e;border:1px dashed #d3d8d9");
    const interesse = q.interesse ? String(q.interesse).split("|").filter(Boolean).join(", ") : L.interesse;

    // edição
    const R = S.rascunho || {};
    const setR = (k) => (e) => { const v = e.target.value; this.setState(s => ({ rascunho: Object.assign({}, s.rascunho, { [k]: v }) })); };
    const campos = [["nome", "Nome", "", false, false], ["cargo", "Cargo", "", false, false], ["email", "E-mail", "", false, false], ["tel", "Telefone", "", false, false], ["whats", "WhatsApp", "", false, false], ["linkedin", "LinkedIn", "linkedin.com/in/…", false, false], ["cidade", "Cidade / UF", "", false, false], ["obs", "Observação", "Contexto sobre " + primeiro + " para o time", true, true]];

    const abas = [["Visão geral", 0], ["Atividades", (L.registro ? 0 : 3) + (bruto.principal && (L.acao || (this.E && (Es.ler("atvs", {}) || {})[L.id])) ? 1 : 0)], ["Comunicações", todasInter.filter(t => t.tipo !== "Sistema").length], ["Oportunidades", opps.length]];
    const aba = S.aba;
    const abaVisao = aba === "Visão geral";

    return {
      nome: P.nome || "—", primeiroNome: primeiro, cargo: P.cargo || "—", empresa: nomeEmp,
      iniciais: ini(P.nome), empIniciais: ini(nomeEmp),
      principal: !!bruto.principal,
      temEtapa: !!bruto.principal,
      /* Antes: todo lead aparecia "Manual" (L.registro é o id, sempre preenchido). Agora só quando a origem diz manual. */
      origemSelo: /manual/i.test(L.origem || "") ? "Manual" : "Automática",
      etapa: L.registro ? (L.rel || "Contato") : ((etapas[L.etapa] || {}).label || "—"),
      etapaSelo: "display:inline-flex;align-items:center;gap:6px;height:23px;padding:0 9px;border-radius:7px;font-size:11.5px;font-weight:700;white-space:nowrap;background:#fff;box-shadow:inset 0 0 0 1px #e3e7e8;color:#1f252c",
      trilhaTopo: [
        { label: "Contatos & Empresas", ir: () => Es && Es.irPara("/onface-preview/contatos", "Contatos & Empresas") },
        L.empresa ? { label: nomeEmp, ir: () => Es && Es.irPara("/onface-preview/empresa", nomeEmp, { lead: L.id }) } : null
      ].filter(Boolean),
      meta: [
        { label: "", valor: P.tel || "—", d: ico.tel },
        { label: "", valor: P.email || "—", d: ico.mail },
        { label: "Responsável:", valor: L.resp || "—", d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
        /* Antes: "Hoje" ou "20 set 2026" fixos para todo lead; agora a data real de criação (ou "—"). */
        { label: "Criado em:", valor: dataCriacao(L.criadoEm), d: ico.cal }
      ],
      abas: abas.map(([t, n]) => {
        const on = aba === t;
        return {
          label: t, conta: String(n), temConta: n > 0,
          style: "display:flex;align-items:center;gap:6px;height:36px;padding:0 13px;border:0;background:transparent;cursor:pointer;font-size:13px;white-space:nowrap;" + (on ? "color:#12171d;font-weight:600;box-shadow:inset 0 -2px 0 #d93c1a" : "color:#67787c;font-weight:500"),
          onClick: () => t === "Empresa" ? (this.E && Es.irPara("/onface-preview/empresa", nomeEmp, { lead: L.id })) : this.setState({ aba: t, canal: t === "Comunicações" && S.canal === "Todos" ? "Todos" : S.canal })
        };
      }),
      gridStyle: abaVisao ? "display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:12px;align-items:start" : "display:grid;grid-template-columns:minmax(0,1fr);gap:12px;max-width:980px",
      relAtivas: (() => {
        const RR = typeof window !== "undefined" && this.dadosDoProto.Relacoes ? this.dadosDoProto.Relacoes({ pessoa: bruto.nome }) : { itens: [], perdidas: 0 };
        const ICO = { cliente: "M20 6 9 17l-5-5", opp: "M12 2v20M17 6H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6", proposta: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5", aquisicao: "M22 12h-4l-3 9L9 3l-3 9H2" };
        const TOM = { verde: ["#e6f4ee", "#1f7256"], coral: ["#fff6f4", "#c2330f"], azul: ["#e8f0fb", "#2c5f9e"], cinza: ["#eeeff3", "#4a5560"] };
        const n = RR.itens.length;
        const iniciar = () => this.E && this.E.abrir("iniciarRelacao", { empresa: nomeEmp, pessoas: [{ nome: bruto.nome, cargo: bruto.cargo || "", email: P.email || "", tel: P.whats || "" }], pessoa: bruto.nome, resp: L.resp || null, origem: L.origem || null, rel: RR.itens.some(r => r.k === "cliente") ? "Cliente" : n ? "Lead" : "Contato" });
        return { iniciar, vazio: !n, vazioTxt: "Nenhuma aquisição, oportunidade ou proposta aberta com " + (bruto.nome || "esta pessoa") + ". Por enquanto ela só existe na base.",
          conta: n ? String(n) : "", contaStyle: n ? "display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 7px;border-radius:9999px;background:#12171d;color:#fff;font-size:11.5px;font-weight:700" : "display:none",
          temPerdidas: RR.perdidas > 0, perdidasTxt: RR.perdidas + (RR.perdidas > 1 ? " oportunidades perdidas" : " oportunidade perdida") + " no histórico",
          itens: RR.itens.map((r, i) => { const t = TOM[r.tom] || TOM.cinza; return Object.assign({}, r, { d: ICO[r.k],
            ir: () => r.ir && r.ir(),
            linha: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 8px;margin:0 -8px;width:calc(100% + 16px);border:0;border-radius:9px;background:transparent;cursor:pointer;text-align:left;" + (i ? "box-shadow:inset 0 1px 0 #f1f3f3" : ""),
            ico: "flex:0 0 auto;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:" + t[0] + ";color:" + t[1],
            stStyle: "display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;background:" + t[0] + ";color:" + t[1] }); }) };
      })(),
      abaVisao,
      abaOpp: aba === "Oportunidades",
      mostraInteracoes: abaVisao || aba === "Comunicações",
      interTitulo: aba === "Comunicações" ? "Comunicações" : "Últimas interações",
      abaAtv: aba === "Atividades",
      ...(() => {
        const atv = (this.E && (Es.ler("atvs", {}) || {})[L.id]) || null;
        const icoTipo = { "Ligação": ico.tel, "Mensagem": ico.wa, "WhatsApp": ico.wa, "E-mail": ico.mail, "Reunião": "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" };
        const itens = [];
        if (bruto.principal && (L.acao || atv)) {
          const sit = (atv && atv.situacao) || "A fazer";
          itens.push({
            titulo: (atv && atv.titulo) || L.acao, tipo: (atv && atv.tipo) || "Follow up",
            meta: ((atv && atv.tipo) || "Follow up") + " · " + ((atv && atv.resp) || L.resp || "—"),
            situacao: sit, quando: (atv && atv.data ? atv.data.split("-").reverse().slice(0, 2).join("/") + " " : "") + ((atv && atv.hora) || L.venceEm || ""),
            aberta: sit !== "Feita" && sit !== "Declinada", vinc: "contato",
            onClick: () => this.E && this.E.abrir("atividade-ver", L.id)
          });
        }
        const ov = S.atvEstado || {};
        const resp = L.resp || "—";
        (L.registro ? [] : [
          ["p2", "Enviar material de " + (L.interesse || "Callface AI"), "E-mail", "A fazer", "Sex, 10:00", "Case e apresentação para " + primeiro + ".", "contato"],
          ["p3", "Ligação de qualificação", "Ligação", "Feita", "Seg, 11:30", "Confirmar porte da operação e dor principal.", "contato"],
          ["p4", "Follow up por WhatsApp", "Mensagem", "Declinada", "Seg, 09:10", "Substituído pela ligação.", "contato"],
          ["a2", "Enviar proposta comercial", "Tarefa", "A fazer", "Sex, 10:00", "Montar proposta e enviar ao decisor da " + nomeEmp + ".", "empresa"],
          ["a3", "Reunião de descoberta", "Reunião", "Feita", "Ter, 14:00", "Mapear volume de atendimento e ferramentas atuais.", "empresa"]
        ]).forEach(([id, titulo, tipo, sit0, quando, desc, vinc]) => {
          const sit = ov[id] || sit0;
          const aberta = sit !== "Feita" && sit !== "Declinada";
          itens.push({
            titulo, tipo, meta: tipo + " · " + resp + " · " + desc, situacao: sit, quando, aberta, vinc,
            onClick: () => {
              const prox = aberta ? "Feita" : "A fazer";
              this.setState(s => ({ atvEstado: Object.assign({}, s.atvEstado, { [id]: prox }) }));
              diz(prox === "Feita" ? "“" + titulo + "” marcada como feita" : "“" + titulo + "” reaberta", prox === "Feita" ? "ok" : "aviso");
            }
          });
        });
        const itensTodos = itens.slice();
        itens.length = 0; itensTodos.filter(a => escOk(a.vinc)).forEach(a => itens.push(a));
        const filtro = S.atvFiltro || "todas";
        const conta = (k) => itens.filter(a => k === "todas" || (k === "abertas" ? a.aberta : !a.aberta)).length;
        const lista = itens.filter(a => filtro === "todas" || (filtro === "abertas" ? a.aberta : !a.aberta));
        const selo = (s) => "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;"
          + (s === "Feita" ? "background:#e6f4ee;color:#1f7256" : s === "Declinada" ? "background:#eeeff3;color:#67787c" : s === "Em andamento" ? "background:#e8f0fb;color:#2c5f9e" : "background:#fff6f4;color:#9c3210");
        this._atvAbertas = conta("abertas");
        return {
          atvFiltros: [["todas", "Todas"], ["abertas", "Abertas"], ["concluidas", "Concluídas"]].map(([k, l]) => ({
            label: l + " · " + conta(k),
            style: "height:28px;padding:0 11px;border-radius:7px;border:0;font-size:12px;white-space:nowrap;cursor:pointer;font-weight:" + (filtro === k ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
            onClick: () => this.setState({ atvFiltro: k })
          })),
          atvEsc: mkEsc(itensTodos.map(a => a.vinc)),
          atvLista: lista.map((a, i) => ({
            vinc: escRot(a.vinc), vincStyle: escChip(a.vinc),
            titulo: a.titulo, meta: a.meta, situacao: a.situacao, quando: a.quando, d: icoTipo[a.tipo] || "M9 11l3 3L22 4",
            seloStyle: selo(a.situacao),
            marca: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (a.aberta ? "background:#fff6f4;color:#c2330f" : "background:#eeeff3;color:#4a5560"),
            linhaStyle: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 8px;border:0;background:transparent;cursor:pointer;text-align:left;border-radius:8px;" + (i === 0 ? "" : "border-top:1px solid #f3f5f5"),
            onClick: a.onClick
          })),
          atvVazia: lista.length === 0,
          atvVaziaTitulo: filtro === "abertas" ? "Nenhuma atividade aberta" : filtro === "concluidas" ? "Nenhuma atividade concluída" : "Nenhuma atividade"
        };
      })(),

      resumo: [
        { label: "Nome", valor: P.nome },
        { label: "Cargo", valor: P.cargo || "—" },
        { label: "E-mail", valor: P.email, cor: true, acao: copiar(P.email, "E-mail"), acaoD: ico.copiar, acaoTitulo: "Copiar e-mail" },
        { label: "Telefone", valor: P.tel || "—", acao: copiar(P.tel, "Telefone"), acaoD: ico.copiar, acaoTitulo: "Copiar telefone" },
        { label: "WhatsApp", valor: P.whats || "—", cor: true, acao: () => { evento("WhatsApp enviado", ico.wa); diz("Conversa aberta com " + primeiro, "ok"); }, acaoD: ico.wa, acaoTitulo: "Abrir conversa" },
        { label: "LinkedIn", valor: P.linkedin || "—", cor: true, acao: () => window.open("https://" + P.linkedin.replace(/^https?:\/\//, ""), "_blank"), acaoD: ico.abrir, acaoTitulo: "Abrir LinkedIn" },
        { label: "Cidade", valor: P.cidade || "—" }
      ].map(r => ({
        label: r.label, valor: r.valor, temAcao: !!r.acao, acao: r.acao || null, acaoD: r.acaoD || "", acaoTitulo: r.acaoTitulo || "",
        valorStyle: "flex:0 1 auto;min-width:0;font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (r.cor ? "#c2330f" : "#1f252c")
      })),
      obs: P.obs || "Sem observação ainda. Use Editar para registrar o contexto de " + primeiro + ".",
      obsStyle: "font-size:13px;line-height:1.55;text-wrap:pretty;" + (P.obs ? "color:#1f252c" : "color:#8b949e"),
      obsAutor: P.obs ? ("Atualizado por " + this.eu + "") : "",

      qualif: [["Interesse", interesse], ["Fit", q.fit], ["Tamanho da operação", q.tamanho ? q.tamanho + " atendentes" : ""], ["Dor principal", q.dor]].map(([label, v]) => ({ label, valor: v || "Não preenchido", style: chip(v) })),

      tags: tagsAtuais.map(t => ({ label: t, remover: () => gravarP({ tags: tagsAtuais.filter(x => x !== t) }) })),
      tagAberto: S.tagMenu,
      abrirTag: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); this.setState(s => ({ tagMenu: !s.tagMenu, tagRect: { top: r.top, bottom: r.bottom, left: r.left } })); },
      tagMenuStyle: "position:fixed;" + this.pos(S.tagRect, 340) + "left:" + Math.max(8, Math.min(S.tagRect ? S.tagRect.left : 120, (typeof window !== "undefined" ? window.innerWidth : 1440) - 280)) + "px;width:268px;z-index:60;display:flex;flex-direction:column;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22)",
      tagOpcoes: todasTags.map(t => {
        const on = tagsAtuais.indexOf(t) >= 0;
        return { label: t, on, caixa: "flex:0 0 auto;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;color:#fff;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"), onClick: () => gravarP({ tags: on ? tagsAtuais.filter(x => x !== t) : tagsAtuais.concat(t) }) };
      }),
      tagNova: S.tagNova, setTagNova: (e) => this.setState({ tagNova: e.target.value }),
      teclaTag: (e) => { if (e.key === "Enter") { e.preventDefault(); criarTag(); } }, criarTag,

      temAcao: !!(bruto.principal && L.acao), semAcao: !(bruto.principal && L.acao),
      acaoTitulo: L.acao ? L.acao + (L.venceEm ? " · " + L.venceEm : "") : "",
      acaoNota: "Com " + primeiro + " · " + (L.resp || "—"),
      verAcao: () => Es && Es.abrir("atividade-ver", L.id),
      novaAtv: () => Es && Es.abrir("atividade-nova", L.id),
      registrar: () => Es && Es.abrir("atividade-nova", L.id),
      ligar: ligarCallface,
      toques: [
        { label: "Ligar", d: ico.tel, fn: ligarCallface, primario: true },
        { label: "Enviar mensagem", d: ico.wa, fn: () => abrirAtendimento("WhatsApp") },
        { label: "Enviar e-mail", d: ico.mail, fn: () => abrirAtendimento("E-mail") }
      ].map(t => ({
        label: t.label, d: t.d, onClick: t.fn,
        style: "display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;border:0;font-size:12.5px;font-weight:600;white-space:nowrap;cursor:pointer;" + (t.primario ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
        hover: t.primario ? "background:#1f252c" : "background:#f1f3f3"
      })),

      ...(() => {
        const lista = (P.notas || []).slice().sort((a, b) => (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0));
        const txt = S.notaTexto || "";
        const anexos = S.notaAnexos || [];
        const pode = !!txt.trim() || anexos.length > 0;
        const gravarNotas = (nv) => gravarP({ notas: nv });
        const time = equipe.concat([this.eu]).filter((x, i, a) => a.indexOf(x) === i);
        const q = S.mencao ? S.mencao.q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        const mencaoLista = S.mencao ? time.filter(n => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").indexOf(q) >= 0) : [];
        const inserirMencao = (nome) => {
          const m = S.mencao;
          if (!m) return;
          const antes = txt.slice(0, m.inicio), depois = txt.slice(m.fim);
          const novo = antes + "@" + nome + " " + depois;
          const caret = (antes + "@" + nome + " ").length;
          this.setState({ notaTexto: novo, mencao: null }, () => {
            const el = this.notaRef && this.notaRef.current;
            if (el) { el.focus(); el.setSelectionRange(caret, caret); }
          });
        };
        const salvarNota = () => {
          if (!pode) return;
          const agora = new Date();
          const hh = String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0");
          gravarNotas([{ id: "n" + Date.now(), autor: this.eu, texto: txt.trim(), quando: "Hoje, " + hh, fixada: false, anexos }].concat(P.notas || []));
          evento("Nota sobre " + primeiro + " adicionada", ico.nota);
          const mencionados = time.filter(n => txt.indexOf("@" + n) >= 0);
          this.setState({ notaTexto: "", notaAtiva: false, notaAnexos: [], mencao: null });
          if (mencionados.length) return diz(mencionados.join(", ") + (mencionados.length > 1 ? " vão" : " vai") + " receber o aviso no NEXO", "ok");
          diz(anexos.length ? "Nota adicionada com " + anexos.length + (anexos.length > 1 ? " anexos" : " anexo") : "Nota adicionada", "ok");
        };
        return {
          mencaoAberta: !!S.mencao,
          mencaoVazia: !!S.mencao && mencaoLista.length === 0,
          mencaoStyle: (() => {
            const el = this.notaRef && this.notaRef.current;
            const r = el ? el.getBoundingClientRect() : null;
            return "position:fixed;" + this.pos(r ? { top: r.top, bottom: r.bottom } : null, 180) + "left:" + (r ? r.left + 8 : 120) + "px;width:240px;z-index:62;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .1s ease-out both";
          })(),
          mencaoOpcoes: mencaoLista.map((n, i) => ({
            nome: n, iniciais: ini(n),
            style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 8px;border-radius:7px;border:0;cursor:pointer;text-align:left;background:" + (i === Math.min(S.mencaoIdx, mencaoLista.length - 1) ? "#f1f3f3" : "transparent"),
            escolher: (e) => { e.preventDefault(); inserirMencao(n); }
          })),
          notasConta: lista.length ? lista.length + (lista.length > 1 ? " notas" : " nota") : "",
          notaTexto: txt,
          notaAtiva: S.notaAtiva || pode,
          notaLinhas: (S.notaAtiva || pode) ? 3 : 1,
          notaCaixaStyle: "border-radius:9px;background:#fff;box-shadow:inset 0 0 0 " + ((S.notaAtiva || pode) ? "1.5px #12171d" : "1px #dbdede"),
          setNota: (e) => {
            const v = e.target.value;
            const pos = e.target.selectionStart || v.length;
            const m = /(^|\s)@([^\s@]{0,20})$/.exec(v.slice(0, pos));
            this.setState({ notaTexto: v, mencao: m ? { q: m[2], inicio: pos - m[2].length - 1, fim: pos } : null, mencaoIdx: 0 });
          },
          blurNota: () => setTimeout(() => { if (this.state.mencao) this.setState({ mencao: null }); }, 120),
          focoNota: () => this.setState({ notaAtiva: true }),
          teclaNota: (e) => {
            if (S.mencao && mencaoLista.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); return this.setState({ mencaoIdx: (S.mencaoIdx + 1) % mencaoLista.length }); }
              if (e.key === "ArrowUp") { e.preventDefault(); return this.setState({ mencaoIdx: (S.mencaoIdx - 1 + mencaoLista.length) % mencaoLista.length }); }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); return inserirMencao(mencaoLista[Math.min(S.mencaoIdx, mencaoLista.length - 1)]); }
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return this.setState({ mencao: null }); }
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); salvarNota(); }
            if (e.key === "Escape") { e.stopPropagation(); this.setState({ notaTexto: "", notaAtiva: false }); e.currentTarget.blur(); }
          },
          cancelarNota: () => this.setState({ notaTexto: "", notaAtiva: false, notaAnexos: [] }),
          temNotaAnexos: anexos.length > 0,
          notaAnexos: anexos.map((a, i) => ({ nome: a.nome, tam: a.tam, remover: () => this.setState(s => ({ notaAnexos: s.notaAnexos.filter((_, j) => j !== i) })) })),
          anexarNota: (e) => {
            const lista = Array.from(e.target.files || []);
            const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
            window.__ofArquivos = window.__ofArquivos || {};
            const novos = lista.map((a, k) => {
              const id = "a" + Date.now() + k;
              window.__ofArquivos[id] = URL.createObjectURL(a);
              return { id, nome: a.name, tam: kb(a.size), tipo: a.type || "" };
            });
            this.setState(s => ({ notaAtiva: true, notaAnexos: (s.notaAnexos || []).concat(novos) }));
            lista.forEach((a, k) => {
              if (!/^image\//.test(a.type) || a.size > 1200000) return;
              const rd = new FileReader();
              rd.onload = () => this.setState(s => ({ notaAnexos: (s.notaAnexos || []).map(x => x.id === novos[k].id ? Object.assign({}, x, { src: rd.result }) : x) }));
              rd.readAsDataURL(a);
            });
            e.target.value = "";
          },
          salvarNota,
          notaBtnStyle: "flex:0 0 auto;height:28px;padding:0 12px;border-radius:7px;border:0;font-size:12px;font-weight:600;white-space:nowrap;cursor:" + (pode ? "pointer;background:#12171d;color:#fff" : "not-allowed;background:#e3e7e8;color:#a3a8a4"),
          notas: lista.map((n, i) => ({
            autor: n.autor, quando: n.quando, texto: n.texto, fixada: !!n.fixada, iniciais: ini(n.autor),
            temAnexos: (n.anexos || []).length > 0,
            anexos: (n.anexos || []).map(a => {
              const src = a.src || (window.__ofArquivos && window.__ofArquivos[a.id]) || "";
              const img = /^image\//.test(a.tipo || "") || /\.(png|jpe?g|gif|webp)$/i.test(a.nome);
              return {
                nome: a.nome, tam: a.tam, src, temThumb: img && !!src, semThumb: !(img && src),
                thumbStyle: "flex:0 0 auto;width:24px;height:24px;border-radius:5px;background:#eeeff3 center/cover no-repeat" + (src ? ";background-image:url('" + src + "')" : ""),
                ext: (a.nome.split(".").pop() || "").slice(0, 4).toUpperCase(),
                abrir: () => {
                  if (!src) return diz("Pré-visualização disponível só na sessão em que o arquivo foi enviado", "aviso");
                  if (img) return this.setState({ visor: { nome: a.nome, tam: a.tam, src } });
                  window.open(src, "_blank");
                }
              };
            }),
            linhaStyle: "display:flex;align-items:flex-start;gap:10px;padding:11px 8px 9px;margin:0 -8px;border-radius:9px;" + (n.fixada ? "background:#fffaf8;box-shadow:inset 0 0 0 1px #fadfd8;" : "") + (i === 0 ? "" : "margin-top:6px;"),
            fixarTitulo: n.fixada ? "Desafixar" : "Fixar no topo",
            fixarStyle: "width:26px;height:26px;border-radius:6px;border:0;background:transparent;display:grid;place-items:center;cursor:pointer;color:" + (n.fixada ? "#c2330f" : "#8b949e"),
            fixar: () => { gravarNotas((P.notas || []).map(x => x.id === n.id ? Object.assign({}, x, { fixada: !x.fixada }) : x)); diz(n.fixada ? "Nota desafixada" : "Nota fixada no topo", "ok"); },
            partes: (() => {
              const nomes = equipe.concat([this.eu]);
              const re = new RegExp("(@(?:" + nomes.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + "))", "g");
              return String(n.texto || "").split(re).filter(Boolean).map(t => ({
                txt: t,
                style: t.charAt(0) === "@" && nomes.indexOf(t.slice(1)) >= 0 ? "color:#c2330f;font-weight:600;background:#fff6f4;border-radius:4px;padding:0 2px" : ""
              }));
            })(),
            remover: () => { gravarNotas((P.notas || []).filter(x => x.id !== n.id)); diz("Nota excluída", "aviso"); }
          }))
        };
      })(),
      visor: {
        aberto: !!S.visor,
        nome: S.visor ? S.visor.nome : "", tam: S.visor ? S.visor.tam : "", src: S.visor ? S.visor.src : "",
        imgStyle: "width:min(880px,100%);height:calc(100vh - 120px);border-radius:10px;background:#fff center/contain no-repeat" + (S.visor ? ";background-image:url('" + S.visor.src + "')" : "") + ";box-shadow:0 24px 60px -12px rgba(0,0,0,.5)",
        fechar: () => this.setState({ visor: null })
      },
      notaRef: this.notaRef || (this.notaRef = React.createRef()),

      canais: ["Todos", "WhatsApp", "Ligação", "E-mail"].map(c => ({
        label: c,
        style: "height:24px;padding:0 9px;border-radius:6px;border:0;font-size:11.5px;white-space:nowrap;cursor:pointer;font-weight:" + (canalSel === c ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
        onClick: () => this.setState({ canal: c })
      })),
      interacoes: (abaVisao ? inter.slice(0, 5) : inter).map(t => ({
        titulo: t.titulo, detalhe: t.detalhe, quando: t.quando, d: icoTipo[t.tipo] || icoTipo.Sistema,
        vinc: escRot(t.vinc), vincStyle: escChip(t.vinc), temDet: !!t.detalhe,
        temRel: /^Ligação (realizada|iniciada|recebida)/.test(t.titulo || ""),
        dica: /^Ligação (realizada|iniciada|recebida)/.test(t.titulo || "") ? "Abrir relatório da ligação" : "",
        linha: "display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:start;padding:8px 6px;margin:0 -6px;border-radius:8px;border-top:1px solid #f3f5f5;" + (/^Ligação (realizada|iniciada|recebida)/.test(t.titulo || "") ? "cursor:pointer" : ""),
        hover: /^Ligação (realizada|iniciada|recebida)/.test(t.titulo || "") ? "background:#fafafa" : "",
        onClick: /^Ligação (realizada|iniciada|recebida)/.test(t.titulo || "") ? () => { if (this.E) this.E.abrir("relatorio", L.id); } : undefined,
        marca: "width:28px;height:28px;border-radius:8px;display:grid;place-items:center;" + (t.tipo === "WhatsApp" ? "background:#e6f4ee;color:#1f7256" : t.tipo === "Ligação" ? "background:#fff6f4;color:#c2330f" : "background:#eeeff3;color:#4a5560")
      })),
      semInteracoes: inter.length === 0,
      interEsc: mkEsc(todasInter0.map(t => t.vinc)),

      opps: opps.map(o => ({ titulo: (interesse || o.interesse) + " · " + o.empresa, meta: "Contato: " + (o.oppContato || o.pessoa) + " · Responsável: " + (o.resp || "—"), etapa: "Nova" })),
      semOpps: opps.length === 0,
      criarOpp: () => {
        if (!this.E) return;
        const lista = [L.empresa].concat((P.empresasExtra || []).map(x => x.nome)).filter((n, i, a) => n && a.indexOf(n) === i);
        if (!lista.length) return diz("Vincule uma empresa ao contato antes de criar a oportunidade", "erro");
        window.__ofContatoOpp = { nome: P.nome, cargo: P.cargo, email: P.email, empresas: lista.map(n => ({ nome: n, papel: n === L.empresa ? (P.cargo || "Principal") : (((P.empresasExtra || []).find(x => x.nome === n) || {}).papel || "Vinculada") })) };
        Es.abrir("oportunidade", L.id);
      },

      abrirEmpresa: () => Es && Es.irPara("/onface-preview/empresa", nomeEmp, { lead: L.id }),
      cad: (() => {
        const chave = bruto.principal ? L.id : "p:" + pk;
        const todas = (this.E && Es.ler("cadencias", {})) || {};
        const nome = Object.prototype.hasOwnProperty.call(todas, chave) ? todas[chave] : (bruto.principal && !L.registro && D.cadenciaPadrao ? D.cadenciaPadrao(L) : null);
        const pausada = !!P.cadPausada;
        return {
          tem: !!nome, sem: !nome, nome: nome || "",
          estado: nome ? (pausada ? "Pausada" : "Ativa") : "Inativa",
          selo: "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;" + (nome && !pausada ? "background:#e6f4ee;color:#1f7256" : "background:#eeeff3;color:#4a5560"),
          passos: [1, 2, 3, 4, 5].map(i => ({ style: "flex:1;height:3px;border-radius:2px;background:" + (i <= 2 ? (pausada ? "#a3a8a4" : "#fe4f2b") : "#e3e7e8") })),
          pausarLabel: pausada ? "Retomar" : "Pausar",
          pausar: () => { gravarP({ cadPausada: !pausada }); diz(pausada ? "Cadência retomada" : "Cadência pausada", pausada ? "ok" : "aviso"); },
          inserir: () => { if (!this.E) return; window.__ofCadAlvo = bruto.principal ? null : { chave, nome: primeiro }; Es.abrir("cadencia", L.id); },
          remover: () => { if (!this.E) return; const t = Object.assign({}, Es.ler("cadencias", {})); t[chave] = null; Es.gravar({ cadencias: t }); diz(primeiro + " removido da cadência", "aviso"); }
        };
      })(),
      origemC: (() => {
        const apollo = ["Marcos Tavares", "Patrícia Moura", "Felipe Andrade", "Luana Ribeiro", "Rogério Sales", "Helena Costa"].indexOf(P.nome) >= 0;
        const manual = !bruto.principal && !apollo && (X.pessoas || []).some(p => p.nome === P.nome);
        const tipos = {
          lead: { tipo: "Lead inbound", resumo: "Entrou pelo " + (L.origem || "—") + " e originou o lead", d: "M22 12h-4l-3 9L9 3l-3 9H2", cor: "background:#fff6f4;color:#c2330f",
            linhas: [["Canal", L.origem || "—"], ["Campanha", L.campanha || "—", true], ["Entrada", dataCriacao(L.criadoEm)], ["Registro", /manual/i.test(L.origem || "") ? "Manual" : "Automático"]] },
          apollo: { tipo: "Apollo", resumo: "Encontrado no enriquecimento da " + nomeEmp, d: "M21 5c0 1.66-4 3-9 3S3 6.66 3 5s4-3 9-3 9 1.34 9 3zM3 5v14c0 1.66 4 3 9 3M21 5v6M3 12c0 1.66 4 3 9 3M18 15v6M15 18h6", cor: "background:#eeeff3;color:#4a5560",
            linhas: [["Fonte", "Enriquecimento Apollo"], ["Dados", [P.email && P.email.indexOf("•") < 0 && P.email ? "e-mail revelado" : null, P.tel && P.tel !== "—" ? "telefone revelado" : null].filter(Boolean).join(" · ") || "sem dados revelados"], ["Adicionado", "Hoje"], ["Por", this.eu]] },
          manual: { tipo: "Cadastro manual", resumo: "Adicionado à mão na página da empresa", d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z", cor: "background:#eeeff3;color:#4a5560",
            linhas: [["Fonte", "Manual"], ["Adicionado", "Hoje"], ["Por", this.eu]] },
          empresa: { tipo: "Mesma da empresa", resumo: "Herdou a origem da " + nomeEmp + " (" + (L.origem || "—") + ")", d: "M3 21V7l9-4 9 4v14M9 21v-6h6v6", cor: "background:#eeeff3;color:#4a5560",
            linhas: [["Canal", L.origem || "—"], ["Vínculo", "Contato da empresa"], ["Adicionado", "—"], ["Registro", "Automático"]] }
        };
        tipos.registro = { tipo: L.origem || "Cadastro manual", resumo: "Cadastrado em Contatos & Empresas" + (L.campanha ? " · " + L.campanha : ""), d: "M12 5v14M5 12h14", cor: "background:#eeeff3;color:#4a5560",
          linhas: [["Canal", L.origem || "Cadastro manual"], ["Lista / campanha", L.campanha || "—", true], /* Antes: "Entrada: Hoje" / "Registro: Manual" para todo lead. */ ["Entrada", dataCriacao(L.criadoEm)], ["Registro", /manual/i.test(L.origem || "") ? "Manual" : "Automático"]] };
        const o = tipos[L.registro && bruto.principal ? "registro" : bruto.principal ? "lead" : apollo ? "apollo" : manual ? "manual" : "empresa"];
        return {
          tipo: o.tipo, resumo: o.resumo, d: o.d,
          icoStyle: "flex:0 0 auto;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;" + o.cor,
          linhas: o.linhas.map(([label, valor, destaque]) => ({ label, valor, style: "flex:1;min-width:0;font-size:12.5px;font-weight:500;text-wrap:pretty;color:" + (destaque && valor !== "—" ? "#c2330f" : "#1f252c") }))
        };
      })(),
      temEmpresa: !!L.empresa, semEmpresa: !L.empresa,
      ...(() => {
        const extras = P.empresasExtra || [];
        const nomesLead = leads.map(x => x.empresa).filter((n, i, a) => n && a.indexOf(n) === i);
        const V = S.v2;
        const q = V ? (V.busca || "").trim() : "";
        const livres = nomesLead.filter(n => n !== nomeEmp && !extras.some(e => e.nome === n));
        const lista = livres.filter(n => !q || n.toLowerCase().indexOf(q.toLowerCase()) >= 0).slice(0, 6);
        const setV = (p) => this.setState(s => ({ v2: Object.assign({}, s.v2, p) }));
        const nova = (V && V.nova) || {};
        const ehNova = !!V && V.modo === "nova";
        const escolhido = V ? (ehNova ? (nova.nome || "").trim() : V.sel) : "";
        const aba = (on) => "flex:1;height:30px;border-radius:7px;border:0;font-size:12.5px;cursor:pointer;white-space:nowrap;font-weight:" + (on ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560");
        return {
          empTitulo: extras.length ? "Empresas vinculadas" : "Empresa vinculada",
          temExtras: extras.length > 0,
          extras: extras.map(e => ({
            nome: e.nome, papel: e.papel || "Contato", iniciais: ini(e.nome),
            abrir: () => {
              const l = leads.find(x => x.empresa === e.nome);
              if (l && Es) return Es.irPara("/onface-preview/empresa", e.nome, { lead: l.id });
              diz(e.nome + " ainda não tem página · cadastrada só como vínculo", "aviso");
            },
            remover: () => { gravarP({ empresasExtra: extras.filter(x => x.nome !== e.nome) }); diz(e.nome + " desvinculada", "aviso"); }
          })),
          abrirVinc2: () => this.setState({ v2: { modo: "existente", busca: "", sel: null, papel: "", nova: {}, tentou: false } }),
          v2: {
            aberto: !!V,
            ehNova, ehExistente: !ehNova,
            abaExistente: aba(!ehNova), abaNova: aba(ehNova),
            irExistente: () => setV({ modo: "existente" }),
            irNova: () => setV({ modo: "nova", nova: Object.assign({ nome: q }, nova) }),
            campos: [["nome", "Nome da empresa", "Ex: Grupo Aurora", true, true], ["cnpj", "CNPJ", "00.000.000/0000-00", false, false], ["segmento", "Segmento", "Ex: Varejo", false, false], ["site", "Site", "empresa.com.br", false, true]].map(([k, label, dica, obrig, largo], i) => {
              const erro = obrig && V && V.tentou && !(nova[k] || "").trim();
              return {
                label, dica, obrig, valor: nova[k] || "",
                celula: "display:block;padding:12px 14px;min-width:0;" + (largo ? "grid-column:1 / -1;" : "") + (i ? "border-top:1px solid #eef1f1;" : "") + (k === "segmento" ? "border-left:1px solid #eef1f1;" : ""),
                style: "width:100%;height:36px;padding:0 11px;border-radius:8px;border:0;outline:0;font-size:13px;background:#fff;box-shadow:inset 0 0 0 1px " + (erro ? "#e0a597" : "#dbdede"),
                set: (e) => { const v = e.target.value; this.setState(s => ({ v2: Object.assign({}, s.v2, { nova: Object.assign({}, (s.v2 || {}).nova, { [k]: v }) }) })); }
              };
            }),
            btnLabel: ehNova ? "Cadastrar e vincular" : "Vincular",
            fechar: () => this.setState({ v2: null }),
            busca: V ? V.busca : "",
            setBusca: (e) => setV({ busca: e.target.value, sel: null, novo: false }),
            papel: V ? V.papel : "",
            setPapel: (e) => setV({ papel: e.target.value }),
            lista: lista.map(n => ({
              nome: n, iniciais: ini(n), on: !!V && V.sel === n,
              meta: ((D.SEGMENTOS || {})[n] || "Empresa") + " · " + leads.filter(x => x.empresa === n).length + " lead",
              style: "display:flex;align-items:center;gap:10px;width:100%;padding:8px 9px;border-radius:9px;border:0;cursor:pointer;background:" + (V && V.sel === n ? "#f6f6f3;box-shadow:inset 0 0 0 1.5px #12171d" : "transparent"),
              onClick: () => setV({ sel: n, novo: false })
            })),
            podeCriar: !!q && nomesLead.every(n => n.toLowerCase() !== q.toLowerCase()) && !extras.some(e => e.nome.toLowerCase() === q.toLowerCase()),
            criar: () => setV({ modo: "nova", sel: null, nova: Object.assign({}, nova, { nome: q }) }),
            criarStyle: "display:flex;align-items:center;gap:10px;width:100%;padding:8px 9px;border-radius:9px;border:0;cursor:pointer;background:" + (V && V.novo ? "#f6f6f3;box-shadow:inset 0 0 0 1.5px #12171d" : "transparent"),
            btn: "height:36px;padding:0 16px;border-radius:9px;border:0;font-size:12.5px;font-weight:600;cursor:" + (escolhido ? "pointer;background:#d93c1a;color:#fff" : "not-allowed;background:#f0c6bb;color:#fff"),
            salvar: () => {
              if (!escolhido) { if (ehNova) setV({ tentou: true }); return diz(ehNova ? "Informe o nome da empresa" : "Escolha uma empresa", "erro"); }
              if (ehNova && Es) {
                const t = Object.assign({}, Es.ler("empresas", {}));
                t[escolhido] = Object.assign({}, t[escolhido] || {}, { cnpj: nova.cnpj || undefined, segmento: nova.segmento || undefined, site: nova.site || undefined, criadaEm: "hoje" });
                Es.gravar({ empresas: t });
              }
              gravarP({ empresasExtra: extras.concat({ nome: escolhido, papel: (V.papel || "").trim(), nova: ehNova }) });
              this.setState({ v2: null });
              diz(ehNova ? escolhido + " cadastrada e vinculada a " + primeiro : P.nome + " vinculada também à " + escolhido, "ok");
            }
          }
        };
      })(),
      vincularEmpresa: () => Es && Es.abrir("vincular", L.id),
      empresaTopo: L.empresa ? nomeEmp : "+ Vincular empresa",
      empresaTopoStyle: "border:0;background:transparent;padding:0;font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px;" + (L.empresa ? "color:#12171d;text-decoration-color:#d3d8d9" : "color:#c2330f;text-decoration-color:transparent"),
      empresaTopoClick: () => L.empresa ? (this.E && Es.irPara("/onface-preview/empresa", nomeEmp, { lead: L.id })) : (this.E && Es.abrir("vincular", L.id)),
      empMeta: [X.segmento || L.segmento || (D.SEGMENTOS || {})[nomeEmp] || (L.registro ? "Sem segmento" : "Serviços"), X.funcionarios ? X.funcionarios + " funcionários" : null].filter(Boolean).join(" · "),
      empFatos: [["Cidade / UF", X.cidade || L.cidade || (L.registro ? "—" : "São Paulo / SP")], ["Site", (X.site || L.site || (L.registro ? "—" : dominio)).replace(/^https?:\/\//, "")], ["Pessoas", String(base.length)]].map(([label, valor]) => ({ label, valor })),
      resp: L.resp || "Sem responsável", respIniciais: ini(L.resp),
      respAberto: !!S.respMenu,
      respBtnStyle: "display:flex;align-items:center;gap:10px;width:100%;height:42px;padding:0 11px 0 7px;border-radius:9px;border:0;background:#fff;cursor:pointer;box-shadow:inset 0 0 0 " + (S.respMenu ? "1.5px #12171d" : "1px #dbdede"),
      respChevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (S.respMenu ? 180 : 0) + "deg)",
      abrirResp: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); this.setState(s => ({ respMenu: !s.respMenu, respRect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } })); },
      respMenuStyle: "position:fixed;" + this.pos(S.respRect, 130) + "left:" + (S.respRect ? S.respRect.left : 120) + "px;width:" + (S.respRect ? S.respRect.width : 260) + "px;z-index:60;overflow-y:auto;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22)",
      respOpcoes: (D.EQUIPE || ["Camila Reis", "Diego Nunes", "Ana Vitória"]).map(n => ({
        nome: n, iniciais: ini(n), on: L.resp === n,
        onClick: () => {
          this.setState({ respMenu: false });
          if (L.resp === n || !Es) return;
          Es.gravar({ leads: (Es.ler("leads", []) || []).map(x => x.id === L.id ? Object.assign({}, x, { resp: n }) : x) });
          diz("Responsável: " + n, "ok");
        }
      })),
      origem: L.origem || "—", campanha: L.campanha || "",
      colegas: base.filter(p => p.nome !== P.nome).map(p => ({
        nome: p.nome, cargo: p.cargo || "—", iniciais: ini(p.nome),
        abrir: () => Es && Es.irPara("/onface-preview/pessoa", p.nome, { pessoa: slug(p.nome), lead: L.id })
      })),

      ed: {
        aberto: S.editando,
        fechar: () => this.setState({ editando: false }),
        campos: campos.map(([k, label, dica, largo, area], i) => ({
          label, dica, valor: R[k] || "", linha1: !area, area,
          celula: "display:block;padding:12px 14px;min-width:0;" + (largo ? "grid-column:1 / -1;" : "") + (i >= 2 ? "border-top:1px solid #eef1f1;" : "") + (!largo && i % 2 === 1 ? "border-left:1px solid #eef1f1;" : ""),
          set: setR(k)
        })),
        salvar: () => {
          gravarP({ nome: (R.nome || "").trim() || P.nome, cargo: R.cargo, email: R.email, tel: R.tel, whats: R.whats, linkedin: R.linkedin, cidade: R.cidade, obs: R.obs });
          this.setState({ editando: false });
          diz("Contato atualizado", "ok");
        }
      },
      editarResumo: () => this.setState({ editando: true, rascunho: { nome: P.nome, cargo: P.cargo, email: P.email, tel: P.tel, whats: P.whats, linkedin: P.linkedin, cidade: P.cidade, obs: P.obs }, maisMenu: false }),
      parar: (e) => e.stopPropagation(),

      maisAberto: S.maisMenu,
      mais: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); this.setState(s => ({ maisMenu: !s.maisMenu, maisRect: { top: r.top, bottom: r.bottom, right: r.right } })); },
      maisStyle: "position:fixed;" + this.pos(S.maisRect, 180) + "right:" + (S.maisRect ? Math.max(8, (typeof window !== "undefined" ? window.innerWidth : 1440) - S.maisRect.right) : 16) + "px;width:232px;z-index:60;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22)",
      maisItens: [
        { label: "Enviar WhatsApp", d: ico.wa, fn: () => abrirAtendimento("WhatsApp") },
        { label: "Enviar e-mail", d: ico.mail, fn: () => abrirAtendimento("E-mail") },
        { label: "Copiar e-mail", d: ico.copiar, fn: copiar(P.email, "E-mail") },
        { label: "Excluir contato", perigo: true, d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6", fn: () => this.setState({ excluir: { motivo: null, obs: "", tentou: false } }) }
      ].map(m => ({
        label: m.label, d: m.d, perigo: !!m.perigo,
        style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 9px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:500;white-space:nowrap;color:" + (m.perigo ? "#c2330f" : "#1f252c"),
        onClick: () => { this.setState({ maisMenu: false }); m.fn(); }
      })),

      exc: (() => {
        const X2 = S.excluir;
        const motivos = ["Contato duplicado", "Não trabalha mais na empresa", "Dados inválidos", "Pedido de remoção (LGPD)", "Outro"];
        const precisaObs = X2 && X2.motivo === "Outro";
        const ok = X2 && X2.motivo && (!precisaObs || (X2.obs || "").trim());
        const set = (patch) => this.setState(s => ({ excluir: Object.assign({}, s.excluir, patch) }));
        return {
          aberto: !!X2, nome: P.nome, empresa: nomeEmp, iniciais: ini(P.nome),
          principal: !!bruto.principal,
          motivos: motivos.map(m => {
            const on = X2 && X2.motivo === m;
            return { label: m, on, onClick: () => set({ motivo: m }),
              style: "display:flex;align-items:center;gap:10px;width:100%;height:38px;padding:0 12px;border-radius:9px;border:0;cursor:pointer;text-align:left;font-size:13px;background:#fff;"
                + (on ? "font-weight:600;color:#12171d;box-shadow:inset 0 0 0 1.5px #12171d" : "font-weight:500;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
              radio: "flex:0 0 auto;width:15px;height:15px;border-radius:9999px;" + (on ? "box-shadow:inset 0 0 0 4.5px #12171d" : "box-shadow:inset 0 0 0 1.5px #c4c9cb") };
          }),
          obs: (X2 && X2.obs) || "",
          obsLabel: precisaObs ? "Observação *" : "Observação",
          obsStyle: "width:100%;min-height:70px;padding:10px 12px;border-radius:9px;outline:0;resize:vertical;font-family:inherit;font-size:13px;background:#fff;border:1px solid " + (precisaObs && X2.tentou && !(X2.obs || "").trim() ? "#d93c1a" : "#dbdede"),
          setObs: (e) => set({ obs: e.target.value }),
          fechar: () => this.setState({ excluir: null }),
          btnStyle: "height:36px;padding:0 15px;border-radius:9px;border:0;font-size:13px;font-weight:600;white-space:nowrap;" + (ok ? "background:#d93c1a;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
          confirmar: () => {
            if (!ok) return set({ tentou: true });
            gravarP({ excluido: true, excluidoMotivo: X2.motivo, excluidoObs: (X2.obs || "").trim() });
            evento("Contato excluído · " + P.nome + " · " + X2.motivo, "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6");
            this.setState({ excluir: null });
            diz(P.nome + " excluído", "ok");
            const E = this.E;
            if (E) L.empresa ? E.irPara("/onface-preview/empresa", nomeEmp, { lead: L.id }) : E.irPara("/onface-preview/contatos", "Contatos & Empresas");
          }
        };
      })(),

      chamada: !!S.chamada,
      chamadaTempo: S.chamada ? seg(S.agora - S.chamada.ini) : "00:00",
      encerrar: () => {
        const c = S.chamada;
        clearInterval(this._tick);
        this.setState({ chamada: null });
        if (!c) return;
        const t = seg(Date.now() - c.ini);
        evento("Ligação realizada · " + t, ico.tel);
        diz("Ligação com " + primeiro + " registrada · " + t, "ok");
      }
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <PessoaDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as PessoaLiga };

/* Data real de criação do lead (criadoEm vem do Proto). Antes a ficha afirmava "Hoje" ou uma data fixa de exemplo para todo mundo. */
function dataCriacao(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "");
}
