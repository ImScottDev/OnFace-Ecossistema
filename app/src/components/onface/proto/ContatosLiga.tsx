// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Contatos — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * ContatosDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `ContatosDesenho.tsx`, convertido por máquina e intocável.
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

import { ContatosDesenho } from "./ContatosDesenho";
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

  state = { visao: "todos", salva: null, salvando: false, nomeVisao: "", salvas: [], abertos: {}, hov: null, aba: "todos", q: "", f: { resp: [], origem: [], rel: [], tag: [] }, ord: { col: "ultima", dir: 1 }, pag: 0, marc: {}, painel: null, pop: null, modal: null, form: {}, tentou: false, imp: null, respOv: {}, extras: [], leads: null };

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
    if (E) {
      const puxa = () => this.setState({ extras: E.ler("contatosExtra", []) || [], leads: E.ler("leads", null), salvas: E.ler("visoesContatos", []) || [] });
      puxa();
      this._off = E.assinar(puxa);
    }
    this.carregarTags();
    this._fora = (e) => { if (this.state.pop && !(e.target.closest && e.target.closest("[data-ct-pop]"))) this.setState({ pop: null }); };
    this._rs = () => { const w = (typeof window !== "undefined" ? window.innerWidth : 1440); if (w !== this.state.larg) this.setState({ larg: w }); };
    this._rs();
    window.addEventListener("resize", this._rs);
    this._esc = (e) => { if (e.key === "Escape") this.setState({ pop: null, modal: null }); };
    document.addEventListener("mousedown", this._fora);
    document.addEventListener("keydown", this._esc);
  }
  componentWillUnmount() {
    if (this._off) this._off();
    document.removeEventListener("mousedown", this._fora);
    document.removeEventListener("keydown", this._esc);
    window.removeEventListener("resize", this._rs);
  }

  /* Tag é dado do banco (`entity_labels`), não do store local: o desenho
     guardava "tagsLead" no navegador e a tag nunca existia para o resto do
     produto. Chave da atribuição = "lead:<id>" ou "empresa:<id>". */
  carregarTags = async () => {
    try {
      const [ls, as] = await Promise.all([fetch("/api/labels").then(r => r.ok ? r.json() : []), fetch("/api/labels/atribuicoes").then(r => r.ok ? r.json() : [])]);
      const atribs = {};
      as.forEach(a => { const k = a.entityType + ":" + a.entityId; (atribs[k] = atribs[k] || []).push(a.labelId); });
      this.setState({ labelsOrg: ls.map(l => ({ id: l.id, nome: l.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), atribs });
    } catch (e) { /* sem rede: a tela segue sem tags, e não inventa */ }
  };

  abrirPop(k, e, largura) {
    if (this.state.pop && this.state.pop.k === k) return this.setState({ pop: null });
    const r = e.currentTarget.getBoundingClientRect();
    const w = largura || 232;
    const x = Math.max(8, Math.min(r.left, (typeof window !== "undefined" ? window.innerWidth : 1440) - w - 8));
    const cabeBaixo = r.bottom + 360 < (typeof window !== "undefined" ? window.innerHeight : 900);
    this.setState({ pop: { k, x, w, y: cabeBaixo ? r.bottom + 6 : null, b: cabeBaixo ? null : (typeof window !== "undefined" ? window.innerHeight : 900) - r.top + 6 } });
  }

  base() {
    const D = this.dadosDoProto || {};
    const slug = D.slug || (s => s), ini = D.iniciais || (s => s);
    const leads = this.state.leads || D.LEADS || [];
    const convs = D.CONVERSAS || [];
    const ov = this.state.respOv;
    const relDe = (et) => et === "nutricao" || et === "desqualificado" ? "Contato" : et === "ganho" ? "Cliente" : "Lead";
    const ultimaDe = (L) => {
      const c = convs.find(x => x.lead === L.id);
      if (c) {
        const h = String(c.hora || "");
        if (/^\d{1,2}:\d{2}$/.test(h)) return { t: "Hoje, " + h, o: 0 };
        if (/^ontem/i.test(h)) return { t: "Ontem", o: 1 };
        const d = parseInt(h, 10);
        return { t: isNaN(d) ? (h || "—") : "há " + d + " dias", o: isNaN(d) ? 2 : d };
      }
      const d = L.dias || 0;
      return d <= 1 ? { t: "Ontem, 15:18", o: 1 } : { t: "há " + d + " dias", o: d };
    };
    const telDe = (n) => { const h = [...(n || "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 90000, 7); return "+55 11 9" + String(1000 + (h % 9000)) + "-" + String(1000 + ((h * 7) % 9000)); };
    const dominio = (emp) => emp ? slug(emp) + ".com.br" : "gmail.com";
    const pessoas = [], empresas = {};
    leads.forEach(L => {
      const id = "p:" + slug(L.pessoa) + "@" + slug(L.empresa || "");
      const u = ultimaDe(L);
      pessoas.push({ id, tipo: "pessoa", nome: L.pessoa, sub: L.cargo || "—", emp: L.empresa || null, rel: relDe(L.etapa), estagio: (L.real && L.real.estagio) || "", motivo: (L.real && L.real.motivo && L.real.motivo.rotulo) || "", motivoDetalhe: (L.real && L.real.motivo && L.real.motivo.detalhe) || "", resp: ov[id] !== undefined ? ov[id] : (L.resp || null), origem: L.origem || "—", campanha: L.campanha || "", opps: L.etapa === "oportunidade" ? 1 : 0, ultima: u.t, ordem: u.o, lead: L, email: slug(L.pessoa.split(" ").filter(p => !/^dr\.?$/i.test(p))[0]) + "@" + dominio(L.empresa), tel: L.tel || telDe(L.pessoa), acao: L.acao, venceEm: L.venceEm });
      if (L.empresa) {
        const e = empresas[L.empresa] || (empresas[L.empresa] = { leads: [], ordem: 999, ultima: "—" });
        e.leads.push(L);
        if (u.o < e.ordem) { e.ordem = u.o; e.ultima = u.t; }
      }
    });
    const secundarios = [["Ricardo Alves", "Gerente de TI", "Meridiano Log"], ["Helena Duarte", "Coordenadora de Compras", "Vertex Energia"]];
    secundarios.forEach(([nome, cargo, emp]) => {
      const L = leads.find(x => x.empresa === emp);
      if (!L) return;
      const id = "p:" + slug(nome) + "@" + slug(emp);
      pessoas.push({ id, tipo: "pessoa", nome, sub: cargo, emp, rel: "Contato", resp: ov[id] !== undefined ? ov[id] : (L.resp || null), origem: "Indicação", campanha: "Cadastrado por " + (L.resp || "time"), opps: 0, ultima: "há 5 dias", ordem: 5, lead: L, secundario: true, email: slug(nome.split(" ")[0]) + "@" + dominio(emp), tel: telDe(nome), acao: null });
    });
    const peso = { Cliente: 4, Lead: 3, Prospect: 2, Contato: 1 };
    const clientes = [["Grupo Solaris", "Energia", "Fernanda Lima", "Head de Atendimento", "Camila Reis"], ["Clínica Aurea", "Saúde", "Dr. Paulo Mendes", "Diretor Clínico", "Diego Nunes"]];
    clientes.forEach(([emp, seg, nome, cargo, resp]) => {
      const idp = "p:" + slug(nome) + "@" + slug(emp);
      pessoas.push({ id: idp, tipo: "pessoa", nome, sub: cargo, emp, rel: "Cliente", resp: ov[idp] !== undefined ? ov[idp] : resp, origem: "Indicação", campanha: "Oportunidade ganha · mar/2026", opps: 0, ultima: "há 3 dias", ordem: 3, lead: null, email: slug(nome.replace(/^Dr\.?\s+/, "").split(" ")[0]) + "@" + dominio(emp), tel: telDe(nome), acao: "Check-in trimestral de uso", venceEm: "em 12 dias", cliente: true });
    });
    const prospects = [["Rota Sul Transportes", "Logística", "Marcelo Tavares", "Gerente de Operações", "Diego Nunes"], ["Nortis Seguros", "Seguros", "Juliana Prado", "Coordenadora de SAC", "Ana Vitória"]];
    prospects.forEach(([emp, seg, nome, cargo, resp]) => {
      const idp = "p:" + slug(nome) + "@" + slug(emp);
      pessoas.push({ id: idp, tipo: "pessoa", nome, sub: cargo, emp, rel: "Prospect", resp: ov[idp] !== undefined ? ov[idp] : resp, origem: "Outbound", campanha: "Prospecção · cadência outbound", opps: 0, ultima: "há 2 dias", ordem: 2, lead: null, email: slug(nome.split(" ")[0]) + "@" + dominio(emp), tel: telDe(nome), acao: "Passo 2 da cadência outbound", venceEm: "amanhã" });
    });
    const lista = Object.keys(empresas).map(nome => {
      const e = empresas[nome], L = e.leads[0], id = "e:" + slug(nome);
      const rels = e.leads.map(l => relDe(l.etapa));
      const rel = rels.sort((a, b) => peso[b] - peso[a])[0];
      return { id, tipo: "empresa", nome, sub: (D.SEGMENTOS || {})[nome] || "Serviços", emp: null, rel, estagio: "", motivo: "", motivoDetalhe: "", resp: ov[id] !== undefined ? ov[id] : (L.resp || null), origem: L.origem || "—", campanha: L.campanha || "", opps: e.leads.filter(l => l.etapa === "oportunidade").length, ultima: e.ultima, ordem: e.ordem, lead: L, leadsEmp: e.leads, email: "contato@" + dominio(nome), tel: telDe(nome), acao: L.acao, venceEm: L.venceEm };
    });
    prospects.forEach(([emp, seg, , , resp]) => {
      const id = "e:" + slug(emp);
      lista.push({ id, tipo: "empresa", nome: emp, sub: seg, emp: null, rel: "Prospect", resp: ov[id] !== undefined ? ov[id] : resp, origem: "Outbound", campanha: "Prospecção · cadência outbound", opps: 0, ultima: "há 2 dias", ordem: 2, lead: null, leadsEmp: [], email: "contato@" + dominio(emp), tel: telDe(emp), acao: "Passo 2 da cadência outbound", venceEm: "amanhã" });
    });
    clientes.forEach(([emp, seg, , , resp]) => {
      const id = "e:" + slug(emp);
      lista.push({ id, tipo: "empresa", nome: emp, sub: seg, emp: null, rel: "Cliente", resp: ov[id] !== undefined ? ov[id] : resp, origem: "Indicação", campanha: "Oportunidade ganha · mar/2026", opps: 0, ultima: "há 3 dias", ordem: 3, lead: null, leadsEmp: [], email: "contato@" + dominio(emp), tel: telDe(emp), acao: "Check-in trimestral de uso", venceEm: "em 12 dias", cliente: true });
    });
    (this.state.extras || []).forEach(x => {
      const id = x.id;
      const L = x.emp ? leads.find(l => l.empresa === x.emp) : null;
      lista.push({ id, tipo: x.tipo, nome: x.nome, sub: x.tipo === "empresa" ? (x.segmento || "Sem segmento") : (x.cargo || "—"), emp: x.tipo === "pessoa" ? (x.emp || null) : null, rel: x.rel || "Contato", resp: ov[id] !== undefined ? ov[id] : (x.resp || null), origem: x.origem || "Cadastro manual", campanha: x.campanha || (x.importado ? "Importação CSV" : "Cadastro manual"), opps: 0, ultima: "Agora", ordem: -1, lead: L, extra: true, email: x.email || "—", tel: x.tel || "—", acao: null, leadsEmp: [] });
    });
    return pessoas.concat(lista).map(r => Object.assign(r, { ini: ini(r.nome.replace(/^Dr\.?\s+/, "")) }));
  }

  gravarExtra(novos) {
    const E = this.E;
    const lista = (this.state.extras || []).concat(novos);
    this.setState({ extras: lista });
    if (E) E.gravar({ contatosExtra: lista });
  }

  renderVals() {
    const S = this.state;
    const D = this.dadosDoProto || {};
    const Es = this.E;
    const diz = (t, tom) => Es ? Es.avisar(t, tom) : null;
    const slug = D.slug || (s => s), ini = D.iniciais || (s => s);
    const equipe = D.EQUIPE || [];
    const todos = this.base();
    const ico = {
      resp: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
      origem: "M22 12h-4l-3 9L9 3l-3 9H2",
      rel: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
      mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
      tel: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
      wa: "M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z",
      pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      abrir: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
      copia: "M9 9h11v11H9zM5 15H4V4h11v1",
      predio: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01",
      web: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
      userPlus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6",
      upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
    };
    const relSelo = (r) => "display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:500;white-space:nowrap;background:#fafafa;box-shadow:inset 0 0 0 1px #eef1f1;"
      + (r === "Cliente" ? "color:#1f7256" : r === "Lead" ? "color:#c2330f" : "color:#67787c");
    const relSeloAntigo = (r) => "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:600;white-space:nowrap;"
      + (r === "Cliente" ? "background:#e6f4ee;color:#1f7256" : r === "Lead" ? "background:#fff6f4;color:#9c3210" : r === "Prospect" ? "background:#e8f0fb;color:#2c5f9e" : r === "Contato" ? "background:#eeeff3;color:#67787c" : "background:#e8f0fb;color:#2c5f9e");
    const tipoSelo = (t) => "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:600;white-space:nowrap;"
      + (t === "empresa" ? "background:#fff;color:#12171d;box-shadow:inset 0 0 0 1px #c9cfd1" : "background:#eeeff3;color:#4a5560");
    const avatarDe = (r, tam) => "flex:0 0 auto;width:" + tam + "px;height:" + tam + "px;display:grid;place-items:center;font-weight:700;font-size:" + Math.round(tam * 0.36) + "px;"
      + "font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:.01em;" + (r.tipo === "empresa" ? "border-radius:" + Math.round(tam * 0.27) + "px;background:#12171d;color:#fff" : "border-radius:9999px;background:linear-gradient(180deg,#f6f6f3,#eceeee);color:#1f252c;box-shadow:inset 0 0 0 1px #e3e7e8");
    const respAv = (n) => "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:700;" + (n ? "background:#12171d;color:#fff" : "background:transparent;color:#8b949e;box-shadow:inset 0 0 0 1px dashed #c9cfd1;border:1px dashed #c9cfd1");
    const respTx = (n) => "min-width:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (n ? "#1f252c" : "#8b949e");

    const nomeDeLabel = {}; (S.labelsOrg || []).forEach(l => { nomeDeLabel[l.id] = l.nome; });
    const alvoDe = (x) => {
      const c = x.tipo === "pessoa" ? x.lead && x.lead.real : x.real;
      if (!c) return null;
      return x.tipo === "pessoa" ? (c.leadId ? ["lead", c.leadId] : null) : (c.empresaId ? ["empresa", c.empresaId] : null);
    };
    const TLg = {}; Object.keys(S.atribs || {}).forEach(k => { TLg[k] = S.atribs[k].map(id => nomeDeLabel[id]).filter(Boolean); });
    const tagsDe = (x) => { const a = alvoDe(x); return (a && TLg[a.join(":")]) || []; };
    const nomesTags = (S.labelsOrg || []).map(l => l.nome);
    const q = S.q.trim().toLowerCase();
    const F = S.f;
    const passa = (r, ignora) => {
      if (q && ![r.nome, r.emp, r.email, r.tel, r.sub].filter(Boolean).some(v => String(v).toLowerCase().indexOf(q) >= 0)) return false;
      if (ignora !== "resp" && F.resp.length && F.resp.indexOf(r.resp || "—") < 0) return false;
      if (ignora !== "origem" && F.origem.length && F.origem.indexOf(r.origem) < 0) return false;
      if (ignora !== "rel" && F.rel.length && F.rel.indexOf(r.rel) < 0) return false;
      if (ignora !== "tag" && (F.tag || []).length && !tagsDe(r).some(t => F.tag.indexOf(t) >= 0)) return false;
      return true;
    };
    const EU = "Camila Reis";
    const larg = S.larg || 1440;
    const railLargo = true;
    const sobrepor = larg < 1480;
    const vTile = (on) => "flex:0 0 auto;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;" + (on ? "background:#fe4f2b;color:#fff" : "background:#f6f6f3;color:#1f252c;box-shadow:inset 0 0 0 1px #eef1f1");
    const VIS = [
      ["todos", "Todos os registros", "M4 6h16M4 12h16M4 18h16", () => true, "Pessoas e empresas da base"],
      ["meus", "Meus contatos", ico.resp, (r) => r.resp === EU, "Sob sua responsabilidade"],
      ["semresp", "Sem responsável", "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 8l5 5M22 8l-5 5", (r) => !r.resp, "Ninguém cuidando ainda"],
      ["sememp", "Pessoas sem empresa", "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", (r) => r.tipo === "pessoa" && !r.emp, "Contatos avulsos, sem vínculo"],
      ["opp", "Com oportunidade", "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", (r) => r.opps > 0, "Negócio aberto em andamento"],
      ["frios", "Sem contato há 7+ dias", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2", (r) => r.ordem >= 7, "Esfriando — vale retomar"]
    ];
    const visAtual = (VIS.find(v => v[0] === S.visao) || VIS[0])[3];
    const ok = (r) => passa(r) && visAtual(r);
    const emps = todos.filter(r => r.tipo === "empresa");
    const nomesE = {}; emps.forEach(e => { nomesE[e.nome] = true; });
    const estreito = !!q || F.resp.length + F.origem.length + F.rel.length + (F.tag || []).length > 0 || S.visao !== "todos";
    let topos;
    if (S.aba === "pessoas") topos = todos.filter(r => r.tipo === "pessoa" && ok(r)).map(r => ({ r, filhos: [], forcar: false }));
    else {
      topos = emps.map(e => {
        const kids = todos.filter(x => x.tipo === "pessoa" && x.emp === e.nome);
        const kOk = kids.filter(ok);
        if (!ok(e) && !kOk.length) return null;
        return { r: e, filhos: estreito ? kOk : kids, forcar: estreito && kOk.length > 0 };
      }).filter(Boolean);
      if (S.aba === "todos") topos = topos.concat(todos.filter(r => r.tipo === "pessoa" && (!r.emp || !nomesE[r.emp]) && ok(r)).map(r => ({ r, filhos: [], forcar: false })));
    }
    const o = S.ord;
    topos.sort((a, b) => o.col === "nome" ? a.r.nome.localeCompare(b.r.nome, "pt") * o.dir : ((a.r.ordem - b.r.ordem) * o.dir || a.r.nome.localeCompare(b.r.nome, "pt")));
    const fatia = topos;
    const plano = [];
    fatia.forEach(t => {
      const aberto = t.forcar || !!S.abertos[t.r.id];
      plano.push({ r: t.r, nivel: 0, nFilhos: t.filhos.length, aberto, ehTopo: true });
      if (aberto) t.filhos.forEach((k, i) => plano.push({ r: k, nivel: 1, ultimo: i === t.filhos.length - 1 }));
    });
    const pagina = plano.map(x => x.r);
    const filtrados = topos;
    const marc = S.marc;
    const nMarc = Object.keys(marc).filter(k => marc[k]).length;
    const pagMarc = pagina.filter(r => marc[r.id]).length;
    const grade = "display:grid;grid-template-columns:36px minmax(240px,2fr) 124px minmax(150px,1.1fr) minmax(140px,1fr) 104px 128px 36px;gap:10px;align-items:center;padding:0 14px";
    const chk = (on, parcial) => "flex:0 0 auto;justify-self:center;width:18px;height:18px;border-radius:9999px;border:0;padding:0;display:grid;place-items:center;cursor:pointer;" + (on || parcial ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9");

    const irPessoa = (r) => {
      if (!Es) return;
      if (r.extra) return Es.irPara("/onface-preview/pessoa", r.nome, { pessoa: slug(r.nome), registro: r.id });
      if (!r.lead) return diz(r.nome + " é um registro de exemplo sem página", "aviso");
      Es.irPara("/onface-preview/pessoa", r.nome, { pessoa: slug(r.nome), lead: r.lead.id });
    };
    const irEmpresa = (nome, L) => {
      if (!Es) return;
      const l = L || (todos.find(x => x.tipo === "pessoa" && x.emp === nome && x.lead) || {}).lead;
      const ext = !l && (todos.find(x => x.extra && x.tipo === "empresa" && x.nome === nome) || todos.find(x => x.extra && x.tipo === "pessoa" && x.emp === nome));
      if (ext) return Es.irPara("/onface-preview/empresa", nome, { registro: ext.id });
      if (!l) return diz(nome + " é um registro de exemplo sem página", "aviso");
      Es.irPara("/onface-preview/empresa", nome, { lead: l.id });
    };
    const copiar = (v, rot) => {
      const ok = () => diz(rot + " copiado", "ok");
      try { navigator.clipboard.writeText(v).then(ok, () => { const t = document.createElement("textarea"); t.value = v; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); ok(); }); }
      catch (e) { ok(); }
    };
    const ligar = (r) => { if (Es && Es.abrirExterno) Es.abrirExterno("/calls?call_to=" + String(r.tel).replace(/\D/g, "")); else diz("Ligando para " + r.nome, "ok"); };
    const whats = (r) => r.lead && Es ? Es.irPara("/atendimento", "Atendimento", { lead: r.lead.id, canal: "WhatsApp" }) : diz("Sem conversa para " + r.nome, "aviso");
    const email = (r) => r.lead && Es ? Es.irPara("/atendimento", "Atendimento", { lead: r.lead.id, canal: "E-mail" }) : diz("Sem conversa para " + r.nome, "aviso");
    const abrirAtv = (r, ver) => {
      if (!Es) return;
      if (r.extra) return r.tipo === "pessoa" ? irPessoa(r) : irEmpresa(r.nome, null);
      if (!r.lead) return diz(r.nome + " é um registro de exemplo sem página", "aviso");
      Es.abrir(ver ? "atividade-ver" : "atividade-nova", r.lead.id);
    };
    const setResp = (ids, nome) => {
      this.setState(s => { const n = Object.assign({}, s.respOv); ids.forEach(id => { n[id] = nome; }); return { respOv: n, pop: null }; });
      diz(ids.length > 1 ? ids.length + " registros agora com " + (nome || "ninguém") : "Responsável: " + (nome || "sem responsável"), "ok");
    };
    const exportar = (linhas) => {
      // Motivo e estágio vão no CSV porque o export existe para VIRAR AÇÃO:
      // exportar os perdidos/desqualificados/em nutrição sem o porquê não serve.
      const cab = ["Nome", "Tipo", "Relacionamento", "Empresa", "Cargo/Segmento", "E-mail", "Telefone", "Responsável", "Origem", "Estágio", "Motivo", "Detalhe do motivo", "Oportunidades", "Última interação"];
      const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      const csv = [cab].concat(linhas.map(r => [r.nome, r.tipo === "empresa" ? "Empresa" : "Pessoa", r.rel, r.emp || (r.tipo === "empresa" ? r.nome : ""), r.sub, r.email, r.tel, r.resp || "", r.origem, r.estagio || "", r.motivo || "", r.motivoDetalhe || "", r.opps, r.ultima])).map(l => l.map(esc).join(";")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = "onface-contatos-empresas.csv";
      document.body.appendChild(a); a.click(); a.remove();
      diz(linhas.length + " registros exportados", "ok");
    };

    /* Relacionamento é contado NO BANCO, não no array: a lista é uma fatia das
       500 pessoas com interação mais recente, e contá-la dizia "Cliente 29"
       havendo 450 (QA 06/10). O número do banco só vale quando nada está
       recortando a tela — com busca, outro filtro ou visão, a contagem volta a
       ser a do que está visível, que é o que o usuário está olhando. */
    const relDoBanco = this.props.porRelacionamento || null;
    const semRecorte = !q && !F.resp.length && !F.origem.length && !(F.tag || []).length && S.visao === "todos";
    const contaF = (k, v) => {
      if (k === "rel" && relDoBanco && semRecorte) {
        const n = relDoBanco[String(v).toLowerCase()];
        if (typeof n === "number") return n;
      }
      return todos.filter(r => passa(r, k) && (k === "resp" ? (r.resp || "—") === v : k === "tag" ? tagsDe(r).indexOf(v) >= 0 : r[k] === v)).length;
    };
    const defsF = [
      ["resp", "Responsável", ico.resp, equipe.concat(["—"]), (v) => v === "—" ? "Sem responsável" : v],
      ["origem", "Origem", ico.origem, Array.from(new Set(todos.map(r => r.origem))).sort(), (v) => v],
      ["rel", "Relacionamento", ico.rel, ["Contato", "Prospect", "Lead", "Cliente"], (v) => v],
      ["tag", "Tag", "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01", nomesTags, (v) => v]
    ];

    let pop = null;
    if (S.pop) {
      const P = S.pop;
      const base = "position:fixed;z-index:80;width:" + P.w + "px;left:" + P.x + "px;" + (P.y != null ? "top:" + P.y + "px;" : "bottom:" + P.b + "px;") + "max-height:320px;overflow:auto;padding:5px;border-radius:11px;background:#fff;box-shadow:0 0 0 1px #e3e7e8,0 16px 36px -10px rgba(18,23,29,.28)";
      const item = "display:flex;align-items:center;gap:9px;width:100%;height:32px;padding:0 8px;border-radius:7px;border:0;background:transparent;cursor:pointer;font-size:12.5px;color:#1f252c;text-align:left";
      const mk = (x) => Object.assign({ temNota: false, nota: "", notaStyle: "", temCheck: false, on: false, check: "", temIco: !!x.d, d: x.d || "", temN: x.n != null, n: x.n != null ? String(x.n) : "", style: item }, x);
      const def = defsF.find(d => d[0] === P.k);
      if (def) {
        const [k, titulo, , vals, rot] = def;
        pop = { style: base, temTitulo: true, titulo, temLimpar: F[k].length > 0,
          limpar: () => this.setState(s => ({ f: Object.assign({}, s.f, { [k]: [] }), pag: 0 })),
          itens: vals.map(v => { const on = F[k].indexOf(v) >= 0; return mk({ label: rot(v), temCheck: true, on, n: contaF(k, v), check: chk(on).replace("cursor:pointer;", "").replace("width:17px;height:17px", "width:16px;height:16px"),
            onClick: () => this.setState(s => { const a = s.f[k].slice(); const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); return { f: Object.assign({}, s.f, { [k]: a }), pag: 0 }; }) }); }) };
      } else if (P.k === "massa" || P.k.indexOf("resp:") === 0) {
        const ids = P.k === "massa" ? Object.keys(marc).filter(k => marc[k]) : [P.k.slice(5)];
        const atual = P.k === "massa" ? null : (todos.find(r => r.id === ids[0]) || {}).resp;
        pop = { style: base, temTitulo: true, titulo: P.k === "massa" ? "Responsável para " + ids.length : "Responsável", temLimpar: false, limpar: null,
          itens: equipe.map(n => mk({ label: n, temCheck: true, on: atual === n, check: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;display:grid;place-items:center;" + (atual === n ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "box-shadow:inset 0 0 0 1.5px #c8ccc9"), onClick: () => setResp(ids, n) }))
            .concat([mk({ label: "Sem responsável", d: "M18 6 6 18M6 6l12 12", onClick: () => setResp(ids, null) })]) };
      } else if (P.k === "tags") {
        const ids = Object.keys(marc).filter(k => marc[k]);
        const sel = todos.filter(x => marc[x.id]);
        const catalogo = nomesTags.map(n => [n, null, null]);
        const aplicar = async (label, fluxo, lab0) => {
          const lab = lab0 || (S.labelsOrg || []).find(l => l.nome === label);
          const comAlvo = sel.filter(alvoDe);
          if (!lab || !comAlvo.length) { diz("Estes registros não têm lead nem empresa cadastrada para receber tag.", "aviso"); return; }
          const todosTem = comAlvo.every(x => tagsDe(x).indexOf(label) >= 0);
          const ok = await Promise.all(comAlvo.map(x => { const [entityType, entityId] = alvoDe(x);
            return fetch("/api/labels/" + lab.id + "/atribuir", { method: todosTem ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityType, entityId }) }).then(r => r.ok).catch(() => false); }));
          await this.carregarTags();
          const falhas = ok.filter(v => !v).length;
          if (falhas) { diz("Tag " + label + " não gravou em " + falhas + " de " + comAlvo.length, "erro"); return; }
          diz(todosTem ? "Tag " + label + " removida de " + comAlvo.length : "Tag " + label + " em " + comAlvo.length + (comAlvo.length === 1 ? " registro" : " registros") + (fluxo ? " · fluxo " + fluxo + " disparado" : ""), "ok");
        };
        const criar = async () => {
          const t = (S.novaTag || "").trim();
          if (!t) return;
          this.setState({ novaTag: "" });
          let lab = (S.labelsOrg || []).find(l => l.nome.toLowerCase() === t.toLowerCase());
          if (!lab) {
            const r = await fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: t, cor: "#8b949e" }) }).catch(() => null);
            if (!r || !r.ok) { diz("Não consegui criar a tag " + t, "erro"); return; }
            lab = await r.json();
          }
          await aplicar(lab.nome, null, lab);
        };
        pop = { style: base, temTitulo: true, titulo: "Tag para " + ids.length + (ids.length === 1 ? " registro" : " registros"), temLimpar: false, limpar: null,
          temCriar: true, novaTag: S.novaTag || "", setNovaTag: (e) => this.setState({ novaTag: e.target.value }),
          teclaNova: (e) => { if (e.key === "Enter") criar(); }, criar,
          criarStyle: "flex:0 0 auto;height:32px;padding:0 12px;border-radius:8px;border:0;font-size:12.5px;font-weight:600;cursor:pointer;" + ((S.novaTag || "").trim() ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#8b949e"),
          itens: catalogo.map(([label, nota, fluxo]) => {
            const n = sel.filter(x => tagsDe(x).indexOf(label) >= 0).length;
            const on = n > 0 && n === sel.length;
            return mk({ label, temCheck: true, on, check: chk(on || n > 0).replace("cursor:pointer;", "").replace("width:17px;height:17px", "width:16px;height:16px") + (n > 0 && !on ? ";opacity:.5" : ""),
              temNota: true, nota: fluxo ? "dispara " + fluxo : nota,
              notaStyle: "display:block;font-size:11px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" + (fluxo ? "color:#9c3210;font-weight:600" : "color:#67787c"),
              style: item.replace("height:32px", "min-height:40px;padding-top:5px;padding-bottom:5px"),
              onClick: () => aplicar(label, fluxo) });
          }) };
      } else if (P.k === "novo") {
        const x = P.x;
        pop = { style: base.replace("left:" + x + "px;", "left:" + Math.max(8, Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1440) - P.w - 8)) + "px;"), temTitulo: false, titulo: "", temLimpar: false, limpar: null,
          itens: [
            mk({ label: "Novo contato", d: ico.userPlus, onClick: () => this.setState({ pop: null, modal: "pessoa", form: { origem: "Cadastro manual" }, tentou: false, passo: 1, destino: null }) }),
            mk({ label: "Nova empresa", d: ico.predio, onClick: () => this.setState({ pop: null, modal: "empresa", form: {}, tentou: false, passo: 1, destino: null }) }),
            mk({ label: "Empresa com pessoas", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", onClick: () => this.setState({ pop: null, modal: "empresa", form: { pessoas: [{ nome: "", cargo: "", email: "", tel: "" }] }, tentou: false, passo: 1, destino: null }) })
          ] };
      } else if (P.k.indexOf("row:") === 0) {
        const r = todos.find(x => x.id === P.k.slice(4));
        if (r) {
          const fecha = (fn) => () => { this.setState({ pop: null }); fn(); };
          const it = r.tipo === "pessoa" ? [
            mk({ label: "Abrir contato", d: ico.abrir, onClick: fecha(() => irPessoa(r)) }),
            mk({ label: "WhatsApp", d: ico.wa, onClick: fecha(() => whats(r)) }),
            mk({ label: "Ligar", d: ico.tel, onClick: fecha(() => ligar(r)) }),
            mk({ label: "Copiar e-mail", d: ico.copia, onClick: fecha(() => copiar(r.email, "E-mail")) })
          ] : [
            mk({ label: "Abrir empresa", d: ico.abrir, onClick: fecha(() => irEmpresa(r.nome, r.lead)) }),
            mk({ label: "Adicionar pessoa", d: ico.userPlus, onClick: () => this.setState({ pop: null, modal: "pessoa", form: { emp: r.nome, resp: r.resp || "" }, tentou: false, passo: 1, destino: null }) }),
            mk({ label: "Ligar", d: ico.tel, onClick: fecha(() => ligar(r)) })
          ];
          it.push(mk({ label: "Exportar registro", d: ico.upload, onClick: fecha(() => exportar([r])) }));
          pop = { style: base, temTitulo: false, titulo: "", temLimpar: false, limpar: null, itens: it };
        }
      }
    }

    const selR = S.painel ? todos.find(r => r.id === S.painel) : null;
    let p = { ehPessoa: false, ehEmpresa: false, dados: [], opps: [], pessoas: [], acoes: [], resumo: [] };
    if (selR) {
      const r = selR;
      const ehP = r.tipo === "pessoa";
      const oppsL = ehP ? (r.lead && r.opps ? [r.lead] : []) : (r.leadsEmp || []).filter(l => l.etapa === "oportunidade");
      const pessoasEmp = todos.filter(x => x.tipo === "pessoa" && x.emp === r.nome);
      const curto = (t) => /^Hoje/.test(t) ? "Hoje" : /^Ontem/.test(t) ? "Ontem" : t;
      const tile = (i) => "padding:12px 14px;min-width:0" + (i < 2 ? ";box-shadow:inset -1px 0 0 rgba(255,255,255,.24)" : "");
      p = {
        ehPessoa: ehP, ehEmpresa: !ehP,
        nome: r.nome, sub: ehP ? r.sub + (r.emp ? " · " + r.emp : "") : r.sub, ini: r.ini, avatar: avatarDe(r, 56) + (r.tipo === "pessoa" ? ";background:#fff;color:#c2330f;box-shadow:none" : ";background:#fff;color:#c2330f"),
        tipo: ehP ? "Pessoa" : "Empresa", tipoD: ehP ? ico.resp : ico.predio, rel: r.rel, relStyle: relSelo(r.rel) + ";background:#fff;color:#c2330f",
        acoes: ehP ? [
          { label: "WhatsApp", d: ico.wa, cor: "#1f7256", onClick: () => whats(r) },
          { label: "Ligar", d: ico.tel, cor: "#1f252c", onClick: () => ligar(r) },
          { label: "E-mail", d: ico.mail, cor: "#1f252c", onClick: () => email(r) }
        ] : [
          { label: "Ligar", d: ico.tel, cor: "#1f252c", onClick: () => ligar(r) },
          { label: "Nova pessoa", d: ico.userPlus, cor: "#1f252c", onClick: () => this.setState({ modal: "pessoa", form: { emp: r.nome, resp: r.resp || "", origem: "Cadastro manual" }, tentou: false, passo: 1, destino: null }) },
          { label: "Exportar", d: ico.upload, cor: "#1f252c", onClick: () => exportar([r].concat(pessoasEmp)) }
        ],
        resumo: (ehP
          ? [[String(oppsL.length), oppsL.length === 1 ? "Oportunidade" : "Oportunidades"], [curto(r.ultima), "Última interação"], [r.lead ? "WhatsApp" : "—", "Canal principal"]]
          : [[String(pessoasEmp.length), pessoasEmp.length === 1 ? "Pessoa" : "Pessoas"], [String(oppsL.length), oppsL.length === 1 ? "Oportunidade" : "Oportunidades"], [curto(r.ultima), "Última interação"]]
        ).map(([valor, label], i) => ({ valor, label, style: tile(i) })),
        temEmp: ehP && !!r.emp, semEmp: ehP && !r.emp, emp: r.emp || "", empIni: ini(r.emp || ""), segmento: (D.SEGMENTOS || {})[r.emp] || "Serviços",
        irEmpresa: () => irEmpresa(ehP ? r.emp : r.nome, r.lead),
        abrirPagina: () => ehP ? irPessoa(r) : irEmpresa(r.nome, r.lead), abrirLabel: ehP ? "Abrir contato" : "Abrir empresa",
        pessoasTitulo: "Pessoas · " + pessoasEmp.length,
        addPessoa: () => this.setState({ modal: "pessoa", form: { emp: r.nome, resp: r.resp || "", origem: "Cadastro manual" }, tentou: false, passo: 1, destino: null }),
        pessoas: pessoasEmp.map(x => ({ nome: x.nome, cargo: x.sub, ini: x.ini, rel: x.rel, relStyle: relSelo(x.rel), abrir: () => this.setState({ painel: x.id }) })),
        dados: [
          { d: ico.mail, valor: r.email, copia: r.email !== "—", copiar: () => copiar(r.email, "E-mail") },
          { d: ico.tel, valor: r.tel, copia: r.tel !== "—", copiar: () => copiar(r.tel, "Telefone") },
          ehP ? { d: ico.pin, valor: "São Paulo / SP", copia: false, copiar: null } : { d: ico.web, valor: (r.email.split("@")[1] || "—"), copia: false, copiar: null }
        ],
        resp: r.resp || "Sem responsável", respIni: r.resp ? ini(r.resp) : "+",
        respAvatar: respAv(r.resp), respStyle: respTx(r.resp),
        trocarResp: (e) => this.abrirPop("resp:" + r.id, e, 220),
        origem: r.origem, campanha: r.campanha || "—",
        oppTitulo: "Oportunidades · " + oppsL.length,
        opps: oppsL.map(l => ({ titulo: (l.interesse || "Callface AI") + " · " + (l.empresa || r.nome), etapa: "Nova" })),
        semOpps: oppsL.length === 0,
        acao: r.acao || "Nenhuma ação agendada", acaoQuando: r.acao ? (r.venceEm ? "Vence " + r.venceEm : "Sem prazo") + (r.resp ? " · " + r.resp : "") : "Agende o próximo contato para não esfriar",
        acaoBtnLabel: r.acao ? "Ver" : "Agendar",
        acaoBtnStyle: "flex:0 0 auto;height:30px;padding:0 12px;border-radius:8px;border:0;font-size:12px;font-weight:600;white-space:nowrap;cursor:pointer;" + (r.acao ? "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede" : "background:#12171d;color:#fff"),
        acaoBtnHover: r.acao ? "background:#f6f7f7" : "background:#1f252c",
        verAcao: () => abrirAtv(r, !!r.acao),
        acaoBtn: (e) => { e.stopPropagation(); abrirAtv(r, !!r.acao); }
      };
    }

    const ETAPAS_L = { novo: "Novo", em_contato: "Em contato" };
    let m = { campos: [] };
    const md = S.modal;
    if (md) {
      const Fm = S.form;
      const inp = (erro) => "width:100%;height:36px;padding:0 11px;border-radius:9px;background:#fff;outline:0;font-size:13px;color:#12171d;border:0;box-shadow:inset 0 0 0 1px " + (erro ? "#d93c1a" : "#dbdede");
      const set = (k) => (e) => { const v = e.target.value; this.setState(s => ({ form: Object.assign({}, s.form, { [k]: v }) })); };
      const campo = (k, label, o) => {
        o = o || {};
        const erro = S.tentou && o.obrig && !(Fm[k] || "").trim() ? "Obrigatório" : (S.tentou && o.valida ? o.valida(Fm[k] || "") : "");
        return { label, obrig: !!o.obrig, ehTexto: !o.opcoes, ehEscolha: !!o.opcoes, valor: Fm[k] || "", set: set(k), dica: o.dica || "", lista: o.lista || "",
          opcoes: (o.opcoes || []).map(v => Array.isArray(v) ? { v: v[0], l: v[1] } : { v, l: v }),
          inputStyle: inp(erro) + (o.opcoes ? ";cursor:pointer" : ""), temErro: !!erro, erro, wrap: "display:block;min-width:0" + (o.largo ? ";grid-column:1/-1" : "") };
      };
      const vEmail = (v) => v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? "E-mail inválido" : "";
      const respOps = [["", "Sem responsável"]].concat(equipe);
      const passo = S.passo || 1, ehP = md === "pessoa";
      const pz = Fm.pessoas || [];
      const dest = S.destino || "base";
      const INBOUND = ["Meta Ads", "Instagram", "Site", "Formulário", "WhatsApp", "Orgânica"];
      const CAD_OUT = ["Outbound · Primeiro toque", "Outbound · Decisores", "Outbound · Reativação"];
      const selo = (t) => relSelo(t);
      if ((md === "pessoa" || md === "empresa") && passo === 1) {
        m = ehP
          ? { d: ico.userPlus, titulo: "Novo contato", sub: "Passo 1 de 2 · Dados da pessoa", salvarLabel: "Continuar", ehImportar: false,
              campos: [campo("nome", "Nome", { obrig: true, largo: true, dica: "Nome completo" }), campo("cargo", "Cargo", { dica: "Ex: Gerente de CX" }), campo("emp", "Empresa", { dica: "Buscar ou digitar", lista: "ct-empresas" }),
                campo("email", "E-mail", { dica: "nome@empresa.com.br", valida: vEmail }), campo("tel", "Telefone", { dica: "+55 11 90000-0000" })] }
          : { d: ico.predio, titulo: "Nova empresa", sub: "Passo 1 de 2 · Dados da empresa", salvarLabel: "Continuar", ehImportar: false,
              campos: [campo("nome", "Nome da empresa", { obrig: true, largo: true, dica: "Razão social ou nome fantasia" }), campo("cnpj", "CNPJ", { dica: "00.000.000/0000-00" }), campo("segmento", "Segmento", { dica: "Ex: Saúde" }),
                campo("site", "Site", { dica: "empresa.com.br", largo: true })],
              temPessoas: true, semPessoas: !pz.length, pessoasTitulo: pz.length ? "Pessoas · " + pz.length : "Pessoas",
              addPessoa: () => this.setState(s => ({ form: Object.assign({}, s.form, { pessoas: (s.form.pessoas || []).concat({ nome: "", cargo: "", email: "", tel: "" }) }) })),
              pessoas: pz.map((p, k) => {
                const setK = (campoP) => (e) => { const v = e.target.value; this.setState(s => { const a = (s.form.pessoas || []).slice(); a[k] = Object.assign({}, a[k], { [campoP]: v }); return { form: Object.assign({}, s.form, { pessoas: a }) }; }); };
                return { nome: p.nome, cargo: p.cargo, email: p.email, tel: p.tel, setNome: setK("nome"), setCargo: setK("cargo"), setEmail: setK("email"), setTel: setK("tel"),
                  nomeStyle: "width:100%;height:34px;padding:0 10px;border-radius:8px;border:0;outline:0;background:#fff;font-size:12.5px;color:#12171d;box-shadow:inset 0 0 0 1px " + (S.tentou && !p.nome.trim() ? "#d93c1a" : "#dbdede"),
                  remover: () => this.setState(s => ({ form: Object.assign({}, s.form, { pessoas: (s.form.pessoas || []).filter((_, x) => x !== k) }) })) };
              }) };
      } else if (md === "pessoa" || md === "empresa") {
        const DEST = [
          ["base", "Só salvar na base", "Fica disponível para consultar e trabalhar depois. Sem processo aberto.", "Contato", "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8"],
          ["prospeccao", "Enviar para Prospecção", "Outbound: entra numa cadência de prospecção para gerar interesse.", "Prospect", "M22 12h-4l-3 9L9 3l-3 9H2"],
          ["prevendas", "Enviar para Pré-vendas", "Inbound: vira lead no quadro do Pré-vendas para qualificação.", "Lead", "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"]
        ];
        const cfg = dest === "base"
          ? [campo("origem", "Origem", { opcoes: ["Cadastro manual", "Indicação", "Evento", "Parceiro"] }), campo("resp", "Responsável", { opcoes: respOps })]
          : dest === "prospeccao"
            ? [campo("cadOut", "Cadência outbound", { obrig: true, opcoes: [["", "Escolha a cadência"]].concat(CAD_OUT) }), campo("resp", "Responsável", { obrig: true, opcoes: [["", "Escolha"]].concat(equipe) })]
            : (ehP || pz.length ? [] : [campo("cNome", "Contato principal", { obrig: true, dica: "Quem será trabalhado" }), campo("cCargo", "Cargo", { dica: "Ex: Diretor de CX" })]).concat([
                campo("origemIn", "Origem inbound", { obrig: true, opcoes: [["", "De onde veio?"]].concat(INBOUND) }), campo("etapaIni", "Etapa inicial", { opcoes: [["novo", "Novo"], ["em_contato", "Em contato"]] }),
                campo("cadIn", "Cadência", { opcoes: [["", "Sem cadência"]].concat(D.CADENCIAS || []) }), campo("resp", "Responsável", { obrig: true, opcoes: [["", "Escolha"]].concat(equipe) })]);
        m = { d: ehP ? ico.userPlus : ico.predio, titulo: ehP ? "Novo contato" : "Nova empresa", sub: "Passo 2 de 2 · Destino de " + ((Fm.nome || "").trim() || "—") + (!ehP && pz.length ? " + " + pz.length + (pz.length === 1 ? " pessoa" : " pessoas") : ""), ehImportar: false, passo2: true,
          salvarLabel: dest === "base" ? (ehP ? "Salvar contato" : "Salvar empresa") : dest === "prospeccao" ? "Salvar e enviar para Prospecção" : "Salvar e enviar para Pré-vendas",
          temConfig: true, configTitulo: dest === "base" ? "Detalhes" : dest === "prospeccao" ? "Configurar prospecção" : "Configurar pré-vendas",
          destinos: DEST.map(([k, label, desc, rel, d]) => {
            const on = dest === k;
            return { label, desc, rel, d, on, relStyle: selo(rel),
              onClick: () => this.setState({ destino: k, tentou: false }),
              style: "display:flex;align-items:center;gap:12px;width:100%;padding:12px;border-radius:11px;border:0;cursor:pointer;text-align:left;background:" + (on ? "#fff7f5" : "#fff") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px #fe4f2b" : "1px #e3e7e8"),
              hover: on ? "" : "box-shadow:inset 0 0 0 1px #a9b1b4",
              ico: "flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;" + (on ? "background:#fe4f2b;color:#fff" : "background:#f6f6f3;color:#1f252c;box-shadow:inset 0 0 0 1px #eef1f1"),
              radio: "flex:0 0 auto;width:18px;height:18px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:#fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9") };
          }),
          campos: cfg };
      } else {
        const imp = S.imp;
        const pI = S.passo || 1;
        const CAMPOS_CSV = [["", "Ignorar coluna"], ["nome", "Pessoa · Nome"], ["cargo", "Pessoa · Cargo"], ["email", "Pessoa · E-mail"], ["tel", "Pessoa · Telefone"], ["emp", "Empresa · Nome"], ["cnpj", "Empresa · CNPJ"], ["segmento", "Empresa · Segmento"], ["site", "Empresa · Site"], ["cidade", "Empresa · Cidade/UF"]];
        const COLS_MODELO = [["Nome", "nome", true], ["Cargo", "cargo"], ["E-mail", "email"], ["Telefone", "tel"], ["Empresa", "emp"], ["CNPJ", "cnpj"], ["Segmento", "segmento"], ["Site", "site"], ["Cidade/UF", "cidade"]];
        const mapa = {}; if (imp) imp.cab.forEach((c, k) => { const v = Fm["map_" + k]; if (v) mapa[v] = k; });
        const linhasM = imp ? imp.linhas.map(l => ({ nome: (l[mapa.nome] || "").trim(), emp: mapa.emp != null ? (l[mapa.emp] || "").trim() || null : null, cargo: mapa.cargo != null ? l[mapa.cargo] || "" : "", email: mapa.email != null ? l[mapa.email] || "" : "", tel: mapa.tel != null ? l[mapa.tel] || "" : "",
          cnpj: mapa.cnpj != null ? l[mapa.cnpj] || "" : "", segmento: mapa.segmento != null ? l[mapa.segmento] || "" : "", site: mapa.site != null ? l[mapa.site] || "" : "", cidade: mapa.cidade != null ? l[mapa.cidade] || "" : "" })).filter(x => x.nome) : [];
        const base = { d: ico.upload, titulo: "Importar contatos", ehImportar: false, campos: [], passo2: false, destinos: [], temConfig: false, temMapa: false, mapLinhas: [], temRevisao: false, stats: [], revLinhas: [], temDup: false, dupOps: [] };
        const dig = (t) => String(t || "").replace(/\D/g, "");
        const vistosE = {}, vistosN = {};
        const avaliadas = linhasM.map((l, k) => {
          const erros = [];
          if (l.nome.length < 2) erros.push("Nome muito curto");
          if (l.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email)) erros.push("E-mail inválido");
          if (l.tel && (dig(l.tel).length < 10 || dig(l.tel).length > 13)) erros.push("Telefone inválido");
          const kE = (l.email || "").toLowerCase(), kN = (l.nome + "|" + (l.emp || "")).toLowerCase();
          if ((kE && vistosE[kE] != null) || vistosN[kN] != null) erros.push("Repetido no arquivo (linha " + ((kE && vistosE[kE] != null ? vistosE[kE] : vistosN[kN]) + 2) + ")");
          if (kE && vistosE[kE] == null) vistosE[kE] = k; if (vistosN[kN] == null) vistosN[kN] = k;
          const par = erros.length ? null : todos.find(t => t.tipo === "pessoa" && ((l.email && t.email && t.email.toLowerCase() === kE) || (l.tel && dig(t.tel).slice(-9) === dig(l.tel).slice(-9) && dig(l.tel).length >= 10) || (t.nome.toLowerCase() === l.nome.toLowerCase() && (t.emp || "").toLowerCase() === (l.emp || "").toLowerCase())));
          return Object.assign({}, l, { k, erros, par, status: erros.length ? "erro" : par ? "existe" : "novo" });
        });
        const nNovo = avaliadas.filter(a => a.status === "novo").length, nExiste = avaliadas.filter(a => a.status === "existe").length, nErro = avaliadas.filter(a => a.status === "erro").length;
        const dupModo = S.dupModo || "atualizar";
        const aceitas = avaliadas.filter(a => a.status === "novo" || (a.status === "existe" && dupModo === "atualizar"));
        if (pI === 1) {
          m = Object.assign(base, { sub: "Passo 1 de 4 · Arquivo", ehImportar: true, salvarLabel: "Continuar",
            colunasModelo: COLS_MODELO.map(([label, , obrig], k) => ({ label: label + (obrig ? " *" : ""), style: "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:11.5px;font-weight:500;white-space:nowrap;" + (k < 4 ? "background:#eeeff3;color:#1f252c" : "background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #e3e7e8") })),
            baixarModelo: () => {
              const linhas = [COLS_MODELO.map(c => c[0]), ["Mariana Souza", "Head de CX", "mariana@nexa.com.br", "+55 11 99999-9999", "Nexa Tecnologia", "12.345.678/0001-90", "Tecnologia", "nexa.com.br", "São Paulo/SP"], ["Rafael Lima", "Coordenador de SAC", "rafael@nexa.com.br", "+55 11 98888-7777", "Nexa Tecnologia", "12.345.678/0001-90", "Tecnologia", "nexa.com.br", "São Paulo/SP"], ["Paula Reis", "Diretora de Operações", "paula@vetor.com.br", "+55 21 97777-6666", "Vetor Log", "", "Logística", "vetor.com.br", "Rio de Janeiro/RJ"]];
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob(["\ufeff" + linhas.map(l => l.join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
              a.download = "onface-modelo-importacao.csv"; document.body.appendChild(a); a.click(); a.remove();
              diz("Modelo baixado · uma linha por pessoa, repita a empresa quando tiver mais de uma", "ok");
            },
            zona: "display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 16px;border-radius:12px;cursor:pointer;text-align:center;background:" + (S.arrastando ? "#fff6f4" : "#fafafa") + ";box-shadow:inset 0 0 0 1.5px " + (S.arrastando ? "#fe4f2b" : "#dbdede"),
            zonaTitulo: imp ? imp.nome : "Arraste o CSV ou clique para escolher", zonaSub: imp ? imp.linhas.length + " linhas · " + imp.cab.length + " colunas · clique para trocar" : "Separador , ou ; · até 5 mil linhas",
            previa: imp ? imp.linhas.slice(0, 3).map(l => ({ nome: l[0] || "—", empresa: l[1] || "—", email: l[2] || "—" })) : [],
            arrastando: (e) => { e.preventDefault(); if (!S.arrastando) this.setState({ arrastando: true }); },
            soltar: (e) => { e.preventDefault(); this.setState({ arrastando: false }); const fl = e.dataTransfer.files[0]; if (fl) this.lerCsv(fl); },
            escolher: (e) => { const fl = e.target.files[0]; if (fl) this.lerCsv(fl); } });
        } else if (pI === 2) {
          const usados = {}; imp.cab.forEach((c, k) => { const v = Fm["map_" + k]; if (v) usados[v] = (usados[v] || 0) + 1; });
          m = Object.assign(base, { sub: "Passo 2 de 4 · Relacione as colunas do arquivo", salvarLabel: "Validar dados",
            temMapa: true,
            mapLinhas: imp.cab.map((c, k) => { const v = Fm["map_" + k] || ""; const rep = v && usados[v] > 1;
              return { col: c, ex: "ex: " + ((imp.linhas[0] || [])[k] || "—"), valor: v, set: set("map_" + k),
                opcoes: CAMPOS_CSV.map(o => ({ v: o[0], l: o[1] })),
                selStyle: "width:100%;height:34px;padding:0 10px;border-radius:8px;border:0;outline:0;cursor:pointer;font-size:12.5px;background:" + (v ? "#fff" : "#fafafa") + ";color:" + (v ? "#12171d" : "#8b949e") + ";box-shadow:inset 0 0 0 1px " + (rep ? "#d93c1a" : "#dbdede") }; }),
            temResumo: true, resumo: S.tentou && mapa.nome == null ? "Relacione uma coluna ao campo Nome para continuar." : Object.keys(usados).some(k => usados[k] > 1) ? "Há dois campos iguais relacionados (em vermelho) — deixe só um." : linhasM.length + " linhas com nome." + (mapa.email == null && mapa.tel == null ? " Sem e-mail ou telefone, eles não entram em cadência." : "") });
        } else if (pI === 3) {
          const filtro = S.revFiltro || (nErro ? "erro" : "todos");
          const vis = avaliadas.filter(a => filtro === "todos" || a.status === filtro);
          const seloR = (s) => "display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;" + (s === "erro" ? "background:#fdeeea;color:#c2330f" : s === "existe" ? "background:#f7edd8;color:#6e5420" : "background:#e6f4ee;color:#1f7256");
          const tileSt = (k, cor) => "display:flex;flex-direction:column;align-items:flex-start;gap:0;padding:11px 12px;border-radius:11px;border:0;cursor:pointer;text-align:left;background:" + (filtro === k ? "#fff" : "#fafafa") + ";box-shadow:inset 0 0 0 " + (filtro === k ? "1.5px " + cor : "1px #eef1f1");
          m = Object.assign(base, { sub: "Passo 3 de 4 · Revisão antes de importar", salvarLabel: aceitas.length ? "Continuar com " + aceitas.length : "Nada para importar",
            temRevisao: true,
            stats: [["novo", "Novos", nNovo, "Serão criados", "#1f7256"], ["existe", "Já existem", nExiste, dupModo === "atualizar" ? "Serão atualizados" : "Serão ignorados", "#c8a86a"], ["erro", "Com erro", nErro, nErro ? "Ficam de fora" : "Tudo certo", "#c2330f"]].map(([k, label, n, nota, cor]) => ({
              label, n: String(n), nota, ponto: "width:7px;height:7px;border-radius:9999px;background:" + cor,
              style: tileSt(k, cor), onClick: () => this.setState({ revFiltro: filtro === k ? "todos" : k }) })),
            revTitulo: filtro === "todos" ? "TODAS · " + avaliadas.length : filtro === "novo" ? "NOVOS · " + nNovo : filtro === "existe" ? "JÁ EXISTEM · " + nExiste : "COM ERRO · " + nErro,
            revLinhas: vis.map(a => ({ nome: a.nome || "(sem nome)", emp: a.emp || "Sem empresa", contato: a.email || a.tel || "—",
              status: a.status === "erro" ? "Erro" : a.status === "existe" ? "Já existe" : "Novo", selo: seloR(a.status),
              temMotivo: a.status !== "novo", motivo: a.status === "erro" ? a.erros.join(" · ") : "Igual a " + a.par.nome + (a.par.emp ? " · " + a.par.emp : "") })),
            revVazio: vis.length === 0,
            temDup: nExiste > 0, dupTexto: nExiste + (nExiste === 1 ? " contato já está" : " contatos já estão") + " na base. O que fazer?",
            dupOps: [["atualizar", "Atualizar dados"], ["ignorar", "Ignorar"]].map(([k, l]) => ({ label: l, onClick: () => this.setState({ dupModo: k }),
              style: "height:28px;padding:0 11px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (dupModo === k ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.08),inset 0 0 0 1px #e3e7e8" : "background:transparent;color:#4a5560;font-weight:500") })),
            temResumo: nErro > 0, resumo: nErro + (nErro === 1 ? " linha tem erro e fica de fora" : " linhas têm erro e ficam de fora") + ". Corrija no arquivo e importe de novo se precisar." });
        } else {
          const dest = S.destino || "base";
          const INB = ["Meta Ads", "Instagram", "Site", "Formulário", "WhatsApp", "Orgânica"];
          const COUT = ["Outbound · Primeiro toque", "Outbound · Decisores", "Outbound · Reativação"];
          const DEST = [
            ["base", "Só salvar na base", "Entram como contatos, sem processo aberto.", "Contato", "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8"],
            ["prospeccao", "Enviar para Prospecção", "Outbound: a lista entra numa cadência de prospecção.", "Prospect", "M22 12h-4l-3 9L9 3l-3 9H2"],
            ["prevendas", "Enviar para Pré-vendas", "Inbound: cada linha vira lead no quadro do Pré-vendas.", "Lead", "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"]
          ];
          const rs = S.impResps || [];
          const existentes = linhasM.filter(x => todos.some(t => t.nome.toLowerCase() === x.nome.toLowerCase() || (x.email && t.email === x.email))).length;
          const tagOps = [["", "Sem tag"]].concat(nomesTags);
          const cfg = [campo("lista", "Nome da lista", { obrig: true, largo: true, dica: "Ex: Evento CX Summit · set/26" })]
            .concat(dest === "prospeccao" ? [campo("cadOut", "Cadência outbound", { obrig: true, opcoes: [["", "Escolha a cadência"]].concat(COUT) }), campo("tagImp", "Tag", { opcoes: tagOps })]
              : dest === "prevendas" ? [campo("origemIn", "Origem inbound", { obrig: true, opcoes: [["", "De onde veio?"]].concat(INB) }), campo("etapaIni", "Etapa inicial", { opcoes: [["novo", "Novo"], ["em_contato", "Em contato"]] }), campo("cadIn", "Cadência", { opcoes: [["", "Sem cadência"]].concat(D.CADENCIAS || []) }), campo("tagImp", "Tag", { opcoes: tagOps })]
              : [campo("origem", "Origem", { opcoes: ["Importação CSV", "Evento", "Parceiro", "Indicação"] }), campo("tagImp", "Tag", { opcoes: tagOps })]);
          const por = rs.length ? Math.floor(aceitas.filter(a => a.status === "novo").length / rs.length) : 0, sobra = rs.length ? aceitas.filter(a => a.status === "novo").length % rs.length : 0;
          m = Object.assign(base, { sub: "Passo 4 de 4 · Destino de " + aceitas.length + " contatos", passo2: true, temConfig: true, configTitulo: "Configurar lista",
            salvarLabel: dest === "base" ? "Importar " + aceitas.length : dest === "prospeccao" ? "Importar e enviar para Prospecção" : "Importar e enviar para Pré-vendas",
            destinos: DEST.map(([k, label, desc, rel, d]) => { const on = dest === k; return { label, desc, rel, d, on, relStyle: relSelo(rel),
              onClick: () => this.setState({ destino: k, tentou: false }),
              style: "display:flex;align-items:center;gap:12px;width:100%;padding:12px;border-radius:11px;border:0;cursor:pointer;text-align:left;background:" + (on ? "#fff7f5" : "#fff") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px #fe4f2b" : "1px #e3e7e8"),
              hover: on ? "" : "box-shadow:inset 0 0 0 1px #a9b1b4",
              ico: "flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;" + (on ? "background:#fe4f2b;color:#fff" : "background:#f6f6f3;color:#1f252c;box-shadow:inset 0 0 0 1px #eef1f1"),
              radio: "flex:0 0 auto;width:18px;height:18px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:#fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9") }; }),
            campos: cfg,
            temResps: true, respsErro: S.tentou && !rs.length, respsNota: rs.length > 1 ? "Distribuídos igualmente entre " + rs.length + " pessoas" : "Selecione um ou mais — com vários, a lista é dividida igualmente",
            resps: equipe.map((n, k) => { const on = rs.indexOf(n) >= 0; const pos = rs.indexOf(n);
              return { nome: n, ini: ini(n), on, qtd: String(por + (pos >= 0 && pos < sobra ? 1 : 0)),
                onClick: () => this.setState({ impResps: on ? rs.filter(x => x !== n) : rs.concat(n) }),
                av: "width:20px;height:20px;border-radius:9999px;display:grid;place-items:center;font-size:8.5px;font-weight:700;" + (on ? "background:#fff;color:#12171d" : "background:#12171d;color:#fff"),
                style: "display:flex;align-items:center;gap:7px;height:32px;padding:0 11px 0 6px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;" + (on ? "background:#12171d;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede") }; }),
            temResumo: true, resumo: nNovo + (nNovo === 1 ? " novo" : " novos") + (nExiste ? " · " + nExiste + (dupModo === "atualizar" ? " atualizados" : " ignorados") : "") + (nErro ? " · " + nErro + " com erro ficam de fora" : "") + ". Os existentes mantêm o responsável atual." });
        }
        m.importarPasso = pI; m.linhasM = linhasM; m.aceitas = aceitas; m.mapaOk = mapa.nome != null && !(imp && imp.cab.some((c, k) => { const v = Fm["map_" + k]; return v && imp.cab.filter((_, j) => Fm["map_" + j] === v).length > 1; }));
      }
      const pronto = md === "importar" ? !!(S.imp && S.imp.linhas.length) : true;
      const temP = md === "pessoa" || md === "empresa" || md === "importar";
      const tot = md === "importar" ? 4 : 2, pa = S.passo || 1;
      m.temPassos = temP; m.passoTexto = temP ? pa + " de " + tot : "";
      m.voltarLabel = temP && pa > 1 ? "Voltar" : "Cancelar";
      m.voltar = () => temP && pa > 1 ? this.setState({ passo: pa - 1, tentou: false }) : this.setState({ modal: null, arrastando: false });
      if (!m.temPessoas) { m.temPessoas = false; m.pessoas = []; m.semPessoas = false; }
      if (!m.destinos) { m.passo2 = false; m.destinos = []; m.temConfig = false; }
      m.salvarStyle = "height:34px;padding:0 16px;border-radius:9px;border:0;font-size:12.5px;font-weight:600;cursor:" + (pronto ? "pointer;background:#12171d;color:#fff" : "not-allowed;background:#eeeff3;color:#8b949e");
      m.salvar = () => {
        if (md === "importar") {
          if (!pronto) return;
          const pI = S.passo || 1;
          if (pI === 1) return this.setState({ passo: 2, tentou: false });
          if (pI === 2) return m.mapaOk && m.linhasM.length ? this.setState({ passo: 3, tentou: false, revFiltro: null }) : this.setState({ tentou: true });
          if (pI === 3) return m.aceitas.length ? this.setState({ passo: 4, tentou: false, destino: S.destino || "base" }) : diz("Nenhum contato válido para importar", "erro");
          const dI = S.destino || "base", rs = S.impResps || [];
          const falta = (k) => !(Fm[k] || "").trim();
          if (falta("lista") || !rs.length || (dI === "prospeccao" && falta("cadOut")) || (dI === "prevendas" && falta("origemIn"))) return this.setState({ tentou: true });
          const lista = Fm.lista.trim(), tag = Fm.tagImp || "";
          const Est = this.E, t0 = Date.now();
          const respDe = (k) => rs[k % rs.length];
          let tagsNovo = Object.assign({}, S.tagsLead || {});
          const novasL = m.aceitas.filter(a => a.status === "novo"), atualizar = m.aceitas.filter(a => a.status === "existe");
          if (atualizar.length) {
            const ex = (this.state.extras || []).map(x => { const a = atualizar.find(u => u.par && u.par.id === x.id); return a ? Object.assign({}, x, { cargo: a.cargo || x.cargo, email: a.email || x.email, tel: a.tel || x.tel, emp: a.emp || x.emp }) : x; });
            this.setState({ extras: ex }); if (Est) Est.gravar({ contatosExtra: ex });
          }
          if (dI === "prevendas") {
            const novosL = novasL.map((l, k) => ({ id: "l" + t0 + "_" + k, etapa: Fm.etapaIni || "novo", empresa: l.emp || "", pessoa: l.nome, cargo: l.cargo, origem: Fm.origemIn, campanha: lista, resp: respDe(k), interesse: "Não identificado", dias: 0, acao: "Primeiro contato", venceEm: "hoje", email: l.email, tel: l.tel }));
            if (tag) novosL.forEach(l => { tagsNovo[l.id] = [tag]; });
            if (Est) {
              const patch = { leads: (Est.ler("leads", null) || D.LEADS || []).concat(novosL), tagsLead: tagsNovo };
              if (Fm.cadIn) { const c = Object.assign({}, Est.ler("cadencias", {})); novosL.forEach(l => { c[l.id] = Fm.cadIn; }); patch.cadencias = c; }
              Est.gravar(patch);
            }
          } else {
            const novos = novasL.map((l, k) => ({ id: "x:" + t0 + ":" + k, tipo: "pessoa", nome: l.nome, emp: l.emp, cargo: l.cargo, email: l.email, tel: l.tel, importado: true, lista, resp: respDe(k),
              rel: dI === "prospeccao" ? "Prospect" : "Contato", origem: dI === "prospeccao" ? "Outbound" : (Fm.origem || "Importação CSV"), campanha: dI === "prospeccao" ? "Lista " + lista + " · " + Fm.cadOut : "Lista " + lista }));
            const jaTem = {}; todos.forEach(t => { if (t.tipo === "empresa") jaTem[t.nome.toLowerCase()] = true; });
            const empsNovas = [];
            novasL.forEach((l, k) => { if (l.emp && !jaTem[l.emp.toLowerCase()]) { jaTem[l.emp.toLowerCase()] = true; empsNovas.push({ id: "x:" + t0 + ":e" + k, tipo: "empresa", nome: l.emp, segmento: l.segmento, cnpj: l.cnpj, site: l.site, cidade: l.cidade, importado: true, lista, resp: respDe(k), rel: dI === "prospeccao" ? "Prospect" : "Contato", origem: dI === "prospeccao" ? "Outbound" : (Fm.origem || "Importação CSV"), campanha: "Lista " + lista }); } });
            if (tag) novos.forEach(x => { tagsNovo[x.id] = [tag]; });
            this.gravarExtra(empsNovas.concat(novos));
            if (Est && tag) Est.gravar({ tagsLead: tagsNovo });
          }
          this.setState({ modal: null, imp: null, passo: 1, destino: null, impResps: [], tagsLead: tagsNovo, aba: "todos", ord: { col: "ultima", dir: 1 }, q: "" });
          return diz(novasL.length + " contatos da lista \u201c" + lista + "\u201d " + (dI === "prevendas" ? "enviados ao Pré-vendas" : dI === "prospeccao" ? "enviados para Prospecção" : "importados") + (atualizar.length ? " · " + atualizar.length + " atualizados" : "") + (rs.length > 1 ? " · divididos entre " + rs.length : ""), "ok");
        }
        const nome = (Fm.nome || "").trim();
        if ((S.passo || 1) === 1) {
          if (!nome || (md === "pessoa" && vEmail(Fm.email || "")) || (md === "empresa" && pz.some(p => !p.nome.trim()))) return this.setState({ tentou: true });
          return this.setState({ passo: 2, tentou: false, destino: S.destino || "base" });
        }
        const falta = (k) => !(Fm[k] || "").trim();
        if (dest === "prospeccao" && (falta("cadOut") || falta("resp"))) return this.setState({ tentou: true });
        if (dest === "prevendas" && (falta("origemIn") || falta("resp") || (md === "empresa" && !pz.length && falta("cNome")))) return this.setState({ tentou: true });
        const Est = this.E;
        const empN = md === "pessoa" ? ((Fm.emp || "").trim() || null) : nome;
        if (dest === "prevendas") {
          const lid = "l" + Date.now();
          const p0 = pz[0];
          const pessoa = md === "pessoa" ? nome : (p0 ? p0.nome.trim() : Fm.cNome.trim());
          const lead = { id: lid, etapa: Fm.etapaIni || "novo", empresa: empN || "", pessoa, cargo: md === "pessoa" ? (Fm.cargo || "") : (p0 ? p0.cargo : (Fm.cCargo || "")), origem: Fm.origemIn, campanha: "", resp: Fm.resp, interesse: "Não identificado", dias: 0, acao: "Primeiro contato", venceEm: "hoje", email: Fm.email || "", tel: Fm.tel || "" };
          if (Est) {
            const patch = { leads: (Est.ler("leads", null) || D.LEADS || []).concat(lead) };
            if (Fm.cadIn) patch.cadencias = Object.assign({}, Est.ler("cadencias", {}), { [lid]: Fm.cadIn });
            Est.gravar(patch);
          }
          if (md === "empresa" && pz.length > 1) this.gravarExtra(pz.slice(1).map((p, k) => ({ id: "x:" + Date.now() + ":p" + k, tipo: "pessoa", nome: p.nome.trim(), cargo: p.cargo, emp: nome, email: p.email, tel: p.tel, rel: "Contato", resp: Fm.resp, origem: Fm.origemIn, campanha: "Cadastrado com a empresa" })));
          if (md === "empresa" && p0) { lead.email = p0.email || ""; lead.tel = p0.tel || ""; }
          this.setState({ modal: null, passo: 1, destino: null, aba: "todos", ord: { col: "ultima", dir: 1 }, q: "" });
          if (Est) setTimeout(() => md === "pessoa" ? Est.irPara("/onface-preview/pessoa", pessoa, { pessoa: slug(pessoa), lead: lid }) : Est.irPara("/onface-preview/empresa", empN, { lead: lid }), 350);
          return diz(pessoa + " enviado ao Pré-vendas · " + ((ETAPAS_L[lead.etapa]) || "Novo") + (Fm.cadIn ? " · cadência " + Fm.cadIn : ""), "ok");
        }
        const id = "x:" + Date.now();
        const extra = dest === "prospeccao"
          ? { rel: "Prospect", resp: Fm.resp, origem: "Outbound", campanha: "Prospecção · " + Fm.cadOut }
          : { rel: "Contato", resp: Fm.resp || null, origem: Fm.origem || "Cadastro manual" };
        this.gravarExtra([Object.assign({ id, tipo: md, nome }, md === "pessoa" ? { cargo: Fm.cargo, emp: empN, email: Fm.email, tel: Fm.tel } : { segmento: Fm.segmento, cnpj: Fm.cnpj, site: Fm.site }, extra)]
          .concat(md === "empresa" ? pz.map((p, k) => Object.assign({ id: id + ":p" + k, tipo: "pessoa", nome: p.nome.trim(), cargo: p.cargo, emp: nome, email: p.email, tel: p.tel }, extra)) : []));
        if (md === "empresa" && pz.length) this.setState(s => ({ abertos: Object.assign({}, s.abertos, { [id]: true }) }));
        this.setState({ modal: null, passo: 1, destino: null, painel: id, aba: "todos", ord: { col: "ultima", dir: 1 }, q: "" });
        if (Est) setTimeout(() => md === "pessoa" ? Est.irPara("/onface-preview/pessoa", nome, { pessoa: slug(nome), registro: id }) : Est.irPara("/onface-preview/empresa", nome, { registro: id }), 350);
        diz((md === "pessoa" ? "Contato " : "Empresa ") + nome + (md === "empresa" && pz.length ? " com " + pz.length + (pz.length === 1 ? " pessoa" : " pessoas") : "") + (dest === "prospeccao" ? " enviado para Prospecção · " + Fm.cadOut : " salvo na base"), "ok");
      };
    }

    const nP = todos.filter(r => r.tipo === "pessoa").length, nE = todos.length - nP;
    const temFiltro = F.resp.length + F.origem.length + F.rel.length + (F.tag || []).length > 0;
    return {
      abas: [["todos", "Todos", todos.length], ["pessoas", "Pessoas", nP], ["empresas", "Empresas", nE]].map(([k, l, n]) => {
        const on = S.aba === k;
        return { label: l, n: String(n), onClick: () => this.setState({ aba: k, pag: 0 }),
          style: "display:flex;align-items:center;gap:6px;padding:0 11px;border-radius:7px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (on ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.08),inset 0 0 0 1px #e3e7e8" : "background:transparent;color:#4a5560;font-weight:500"),
          nStyle: "font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:" + (on ? "#67787c" : "#8b949e") };
      }),
      q: S.q, temQ: !!S.q, setQ: (e) => this.setState({ q: e.target.value, pag: 0 }), limparQ: () => this.setState({ q: "", pag: 0 }),
      filtros: defsF.map(([k, label, d]) => {
        const n = (F[k] || []).length, aberto = S.pop && S.pop.k === k;
        const at = n > 0;
        return { label, d, temN: at, n: String(n), onClick: (e) => this.abrirPop(k, e),
          grupo: "position:relative;flex:0 0 auto;display:flex;align-items:stretch;height:34px;border-radius:9px;overflow:hidden;background:" + (at ? "#12171d" : "#fff") + ";box-shadow:inset 0 0 0 1px " + (at ? "#12171d" : aberto ? "#a9b1b4" : "#dbdede") + ";transition:box-shadow .12s cubic-bezier(0,0,.2,1)",
          corpo: "display:flex;align-items:center;gap:7px;padding:0 11px;font-size:13px;font-weight:" + (at ? "600" : "500") + ";white-space:nowrap;color:" + (at ? "#fff" : "#1f252c") + ";background:transparent;border:0;cursor:pointer",
          seta: "display:grid;place-items:center;width:28px;padding:0;color:" + (at ? "#fff" : "#4a5560") + ";background:transparent;border:0;cursor:pointer",
          hover: at ? "background:rgba(255,255,255,.12)" : "background:#f6f7f7",
          div: "flex:0 0 auto;width:1px;background:" + (at ? "rgba(255,255,255,.34)" : "#e3e7e8"),
          conta: "flex:0 0 auto;min-width:17px;height:17px;padding-inline:4px;border-radius:9999px;font-size:10px;font-weight:700;display:grid;place-items:center;background:rgba(255,255,255,.22);color:#fff",
          chev: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (aberto ? 180 : 0) + "deg)" };
      }),
      visoes: VIS.map(([k, label, d, fn, nota]) => {
        const on = S.visao === k && !S.salva;
        return { label, d, nota, tile: vTile(on), n: String(todos.filter(fn).length), onClick: () => this.setState({ visao: k, salva: null, pag: 0, pop: null }),
          style: "flex:1;min-width:0;display:flex;align-items:center;gap:11px;width:100%;padding:8px;border-radius:8px;border:0;cursor:pointer;" + (on ? "background:#fff7f5" : "background:transparent"),
          hover: on ? "" : "background:#f6f7f7",
          nStyle: "flex:0 0 auto;min-width:24px;height:20px;padding:0 7px;border-radius:9999px;font-size:11px;font-weight:700;display:grid;place-items:center;font-variant-numeric:tabular-nums;" + (on ? "background:#fe4f2b;color:#fff" : "background:#eeeff3;color:#4a5560") };
      }),
      temSalvas: (S.salvas || []).length > 0,
      salvasVisiveis: (S.salvas || []).length > 0 && railLargo,
      railLargo,
      cardTitulo: (() => { const sv = (S.salvas || []).find(v => v.id === S.salva); return sv ? sv.nome : (VIS.find(v => v[0] === S.visao) || VIS[0])[1]; })(),
      cardSub: S.aba === "pessoas" ? "pessoas em ordem de última interação" : S.aba === "empresas" ? "empresas com suas pessoas — abra para ver quem está dentro" : "empresas com suas pessoas e contatos avulsos",
      cardTotal: topos.length + (topos.length === 1 ? " registro" : " registros"),
      abrirVisoes: (e) => this.abrirPop("visoes", e, 320),
      temPopVis: !!(S.pop && S.pop.k === "visoes"),
      popVisStyle: S.pop && S.pop.k === "visoes" ? "position:fixed;z-index:80;width:320px;left:" + S.pop.x + "px;" + (S.pop.y != null ? "top:" + S.pop.y + "px;" : "bottom:" + S.pop.b + "px;") + "max-height:min(560px,calc(100vh - 80px));overflow:auto;padding:6px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px #e3e7e8,0 16px 36px -10px rgba(18,23,29,.28);display:flex;flex-direction:column;gap:1px" : "",
      visBtn: (() => {
        const sv = (S.salvas || []).find(v => v.id === S.salva);
        const vv = VIS.find(v => v[0] === S.visao) || VIS[0];
        const at = !!sv || S.visao !== "todos", ab = !!(S.pop && S.pop.k === "visoes");
        return { label: sv ? sv.nome : vv[1], d: sv ? "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" : vv[2],
          grupo: "position:relative;flex:0 0 auto;display:flex;align-items:stretch;height:34px;border-radius:9px;overflow:hidden;background:" + (at ? "#12171d" : "#fff") + ";box-shadow:inset 0 0 0 1px " + (at ? "#12171d" : ab ? "#a9b1b4" : "#dbdede"),
          corpo: "display:flex;align-items:center;gap:7px;padding:0 11px;font-size:13px;font-weight:" + (at ? "600" : "500") + ";white-space:nowrap;color:" + (at ? "#fff" : "#1f252c") + ";background:transparent;border:0;cursor:pointer",
          seta: "display:grid;place-items:center;width:28px;padding:0;color:" + (at ? "#fff" : "#4a5560") + ";background:transparent;border:0;cursor:pointer",
          hover: at ? "background:rgba(255,255,255,.12)" : "background:#f6f7f7",
          div: "flex:0 0 auto;width:1px;background:" + (at ? "rgba(255,255,255,.34)" : "#e3e7e8"),
          chev: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (ab ? 180 : 0) + "deg)" };
      })(),
      railStyle: "flex:0 0 " + (railLargo ? "204px" : "44px") + ";min-height:0;display:flex;flex-direction:column;gap:2px;overflow-y:auto;overflow-x:hidden",
      painelStyle: sobrepor
        ? "position:absolute;top:12px;right:14px;bottom:14px;z-index:30;width:min(372px,calc(100% - 28px));display:flex;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 0 0 1px #e3e7e8,0 24px 60px -18px rgba(18,23,29,.35);overflow:hidden"
        : "flex:0 0 372px;min-height:0;display:flex;flex-direction:column;background:#fff;border-radius:14px;box-shadow:inset 0 0 0 1px #e3e7e8;overflow:hidden",
      salvas: (S.salvas || []).map(v => {
        const on = S.salva === v.id;
        return { label: v.nome, n: "", tile: vTile(on), nota: [v.aba !== "todos" ? (v.aba === "pessoas" ? "Pessoas" : "Empresas") : null, v.q ? "\u201c" + v.q + "\u201d" : null, (v.f && (v.f.resp.length + v.f.origem.length + v.f.rel.length + (v.f.tag || []).length)) ? (v.f.resp.length + v.f.origem.length + v.f.rel.length + (v.f.tag || []).length) + " filtros" : null].filter(Boolean).join(" · ") || "Visão personalizada", onClick: () => this.setState({ salva: v.id, visao: v.visao || "todos", q: v.q || "", f: Object.assign({ resp: [], origem: [], rel: [], tag: [] }, v.f || {}), aba: v.aba || "todos", pag: 0, pop: null }),
          remover: () => { const E = this.E; const lista = (S.salvas || []).filter(x => x.id !== v.id); this.setState({ salvas: lista, salva: on ? null : S.salva }); if (E) E.gravar({ visoesContatos: lista }); diz("Visão \u201c" + v.nome + "\u201d excluída", "ok"); },
          style: "flex:1;min-width:0;display:flex;align-items:center;gap:11px;width:100%;padding:8px;border-radius:8px;border:0;cursor:pointer;" + (on ? "background:#fff7f5" : "background:transparent"),
          hover: on ? "" : "background:#f6f7f7", nStyle: "display:none" };
      }),
      salvando: S.salvando, naoSalvando: !S.salvando, nomeVisao: S.nomeVisao,
      setNomeVisao: (e) => this.setState({ nomeVisao: e.target.value }),
      salvarVisao: () => estreito || S.aba !== "todos" ? this.setState({ salvando: true, nomeVisao: "" }) : diz("Aplique busca, filtros ou uma visão antes de salvar", "aviso"),
      salvarVisaoDica: "Salva busca, filtros, aba e visão atuais",
      salvarVisaoStyle: "display:flex;align-items:center;gap:9px;width:100%;height:38px;padding:0 10px;border-radius:8px;border:0;background:transparent;font-size:13px;font-weight:600;cursor:pointer;color:" + (estreito || S.aba !== "todos" ? "#c2330f" : "#a3a8a4"),
      cancelarVisao: () => this.setState({ salvando: false }),
      confirmarVisaoStyle: "flex:1;height:34px;border-radius:9px;border:0;font-size:13px;font-weight:600;cursor:pointer;" + (S.nomeVisao.trim() ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#8b949e"),
      confirmarVisao: () => this.salvarVisao(),
      teclaVisao: (e) => { if (e.key === "Enter") this.salvarVisao(); if (e.key === "Escape") this.setState({ salvando: false }); },
      temFiltro, limparFiltros: () => this.setState({ f: { resp: [], origem: [], rel: [], tag: [] }, pag: 0, salva: null }),
      abrirImportar: () => this.setState({ modal: "importar", imp: null, tentou: false, passo: 1, destino: null, impResps: [], form: {}, dupModo: "atualizar", revFiltro: null }),
      abrirNovo: (e) => this.abrirPop("novo", e, 230),
      novoStyle: "flex:0 0 auto;display:flex;align-items:center;gap:7px;height:34px;padding:0 10px 0 12px;border-radius:9px;border:0;cursor:pointer;color:#fff;font-size:13px;font-weight:600;white-space:nowrap;background:" + (S.pop && S.pop.k === "novo" ? "#c2330f" : "#d93c1a"),
      novoChev: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (S.pop && S.pop.k === "novo" ? 180 : 0) + "deg)",
      novaPessoa: () => this.setState({ modal: "pessoa", form: { origem: "Cadastro manual" }, tentou: false, passo: 1, destino: null }),
      novaEmpresa: () => this.setState({ modal: "empresa", form: {}, tentou: false, passo: 1, destino: null }),

      gradeCab: grade + ";padding-top:8px;padding-bottom:8px;position:sticky;top:0;z-index:2;background:#fafafa;border-bottom:1px solid #eef1f1;font-size:10.5px;font-weight:600;letter-spacing:.05em;color:#4a5560",
      cabCheck: chk(pagMarc > 0 && pagMarc === pagina.length, pagMarc > 0 && pagMarc < pagina.length),
      paginaMarcada: pagina.length > 0 && pagMarc === pagina.length, paginaParcial: pagMarc > 0 && pagMarc < pagina.length,
      marcarPagina: () => this.setState(s => { const n = Object.assign({}, s.marc); const todosOn = pagina.every(r => n[r.id]); pagina.forEach(r => { if (todosOn) delete n[r.id]; else n[r.id] = true; }); return { marc: n }; }),
      ordenarNome: () => this.setState(s => ({ ord: { col: "nome", dir: s.ord.col === "nome" ? -s.ord.dir : 1 } })),
      ordenarUltima: () => this.setState(s => ({ ord: { col: "ultima", dir: s.ord.col === "ultima" ? -s.ord.dir : 1 } })),
      setaNome: "flex:0 0 auto;color:" + (o.col === "nome" ? "#12171d" : "#b3bbc0"),
      setaUltima: "flex:0 0 auto;color:" + (o.col === "ultima" ? "#12171d" : "#b3bbc0"),
      linhas: plano.map(x => {
        const r = x.r;
        const on = !!marc[r.id], ativo = S.painel === r.id, hov = S.hov === r.id;
        const ehE = r.tipo === "empresa", nest = x.nivel === 1;
        const rapidas = ehE ? [
          { label: "Ligar", d: ico.tel, onClick: (e) => { e.stopPropagation(); ligar(r); } },
          { label: "Adicionar pessoa", d: ico.userPlus, onClick: (e) => { e.stopPropagation(); this.setState({ modal: "pessoa", form: { emp: r.nome, resp: r.resp || "", origem: "Cadastro manual" }, tentou: false, passo: 1, destino: null }); } },
          { label: "Abrir empresa", d: ico.abrir, onClick: (e) => { e.stopPropagation(); irEmpresa(r.nome, r.lead); } }
        ] : [
          { label: "WhatsApp", d: ico.wa, onClick: (e) => { e.stopPropagation(); whats(r); } },
          { label: "Ligar", d: ico.tel, onClick: (e) => { e.stopPropagation(); ligar(r); } },
          { label: "E-mail", d: ico.mail, onClick: (e) => { e.stopPropagation(); email(r); } }
        ];
        const bg = ativo || on ? "#fff7f5" : hov ? "#fafafa" : nest ? "#fcfcfb" : "#fff";
        return {
          nome: r.nome, sub: ehE ? r.sub : (nest ? r.sub : r.sub), ini: r.ini, avatar: avatarDe(r, nest ? 30 : 34), ehEmpresa: ehE,
          nomeStyle: "display:block;font-family:'Plus Jakarta Sans',sans-serif;font-size:" + (nest ? "13px" : "13.5px") + ";font-weight:" + (ehE ? "800" : "700") + ";letter-spacing:-.005em;color:#12171d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
          nomeCel: "display:flex;align-items:center;gap:10px;min-width:0;position:relative;height:100%;padding-left:" + (nest ? "30px" : "0"),
          aninhado: nest,
          galho: "position:absolute;left:12px;top:-8px;width:12px;height:" + (x.ultimo ? "calc(50% + 8px)" : "calc(100% + 16px)") + ";box-shadow:inset 1.5px 0 0 #dbdede" + (x.ultimo ? ",inset 0 -1.5px 0 #dbdede;border-bottom-left-radius:6px" : ""),
          rel: r.rel, relStyle: relSelo(r.rel),
          degraus: (() => { const ORD = ["Contato", "Prospect", "Lead", "Cliente"]; const k = ORD.indexOf(r.rel); const cor = r.rel === "Cliente" ? "#1f7256" : "#12171d"; return ORD.map((_, i) => "width:4px;height:12px;border-radius:2px;background:" + (i <= k ? cor : "#e3e7e8")); })(),
          relDica: "Contato → Prospect → Lead → Cliente",
          temOpp: r.opps > 0, oppDica: r.opps + (r.opps === 1 ? " oportunidade ativa no pipeline" : " oportunidades ativas no pipeline"),
          temEmp: !ehE && !nest && !!r.emp, emp: r.emp || "", empIni: ini(r.emp || ""),
          irEmpresa: (e) => { e.stopPropagation(); irEmpresa(r.emp, r.lead); },
          temExp: ehE && x.nFilhos > 0, expLabel: x.nFilhos + (x.nFilhos === 1 ? " pessoa" : " pessoas"),
          expStyle: "display:flex;align-items:center;gap:6px;height:28px;padding:0 9px;border-radius:9999px;border:0;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;color:" + (x.aberto ? "#fff;background:#12171d;box-shadow:none" : "#1f252c;background:#fff;box-shadow:inset 0 0 0 1px #dbdede"),
          expChev: "flex:0 0 auto;transition:transform .15s cubic-bezier(.2,0,.2,1);transform:rotate(" + (x.aberto ? 180 : 0) + "deg)",
          expandir: (e) => { e.stopPropagation(); this.setState(s => ({ abertos: Object.assign({}, s.abertos, { [r.id]: !x.aberto }) })); },
          semVinc: (ehE && !x.nFilhos) || (!ehE && (nest || !r.emp)), vincVazio: ehE ? "Sem pessoas" : nest ? "" : "Sem empresa",
          resp: r.resp || "Sem responsável", respIni: r.resp ? ini(r.resp) : "", respAvatar: respAv(r.resp), respStyle: respTx(r.resp),
          origem: r.origem, ultima: r.ultima,
          semHover: !hov, comHover: hov, rapidas,
          entrar: () => { if (this.state.hov !== r.id) this.setState({ hov: r.id }); },
          sair: () => { if (this.state.hov === r.id) this.setState({ hov: null }); },
          marcado: on, check: chk(on),
          marcar: (e) => { e.stopPropagation(); this.setState(s => { const n = Object.assign({}, s.marc); if (n[r.id]) delete n[r.id]; else n[r.id] = true; return { marc: n }; }); },
          menu: (e) => { e.stopPropagation(); this.abrirPop("row:" + r.id, e, 210); },
          abrir: () => this.setState({ painel: ativo ? null : r.id }),
          linha: grade + ";padding-top:" + (nest ? "8px" : "10px") + ";padding-bottom:" + (nest ? "8px" : "10px") + ";min-height:" + (nest ? "48px" : "56px") + ";cursor:pointer;transition:background .1s;border-bottom:1px solid #f3f5f5;background:" + bg
        };
      }),
      vazio: pagina.length === 0,

      temPainel: !!selR, p, fecharPainel: () => this.setState({ painel: null }),

      temSelecao: nMarc > 0, selecaoTexto: nMarc + (nMarc === 1 ? " selecionado" : " selecionados"),
      massaResp: (e) => this.abrirPop("massa", e, 220),
      massaTag: (e) => this.abrirPop("tags", e, 280),
      massaExportar: () => exportar(todos.filter(r => marc[r.id])),
      limparSelecao: () => this.setState({ marc: {} }),

      temPop: !!pop, pop: pop || { itens: [] },
      temModal: !!md, m, fecharModal: () => this.setState({ modal: null, arrastando: false }), parar: (e) => e.stopPropagation(),
      nomesEmpresas: todos.filter(r => r.tipo === "empresa").map(r => r.nome)
    };
  }

  salvarVisao() {
    const S = this.state, nome = S.nomeVisao.trim();
    if (!nome) return;
    const E = this.E;
    const v = { id: "v" + Date.now(), nome, q: S.q, f: S.f, aba: S.aba, visao: S.visao };
    const lista = (S.salvas || []).concat(v);
    this.setState({ salvas: lista, salva: v.id, salvando: false, nomeVisao: "" });
    if (E) { E.gravar({ visoesContatos: lista }); E.avisar("Visão \u201c" + nome + "\u201d salva", "ok"); }
  }

  lerCsv(file) {
    const rd = new FileReader();
    rd.onload = () => {
      const txt = String(rd.result || "").replace(/^\ufeff/, "");
      const linhas = txt.split(/\r?\n/).filter(l => l.trim());
      if (!linhas.length) return;
      const sep = (linhas[0].match(/;/g) || []).length > (linhas[0].match(/,/g) || []).length ? ";" : ",";
      const cels = (l) => l.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
      let cab = cels(linhas[0]);
      const pareceCab = cab.some(c => /nome|name|empresa|company|mail|tel|fone|phone|cargo|cnpj|segmento|site/i.test(c));
      const corpo = (pareceCab ? linhas.slice(1) : linhas).map(cels);
      if (!pareceCab) cab = cab.map((_, k) => "Coluna " + (k + 1));
      const guess = (c) => /mail/i.test(c) ? "email" : /cnpj/i.test(c) ? "cnpj" : /segmento|setor|industry/i.test(c) ? "segmento" : /site|web|dom/i.test(c) ? "site" : /cidade|uf|city/i.test(c) ? "cidade" : /tel|fone|phone|whats|cel/i.test(c) ? "tel" : /empresa|company|conta/i.test(c) ? "emp" : /cargo|title|fun/i.test(c) ? "cargo" : /nome|name/i.test(c) ? "nome" : "";
      const form = Object.assign({}, this.state.form);
      cab.forEach((c, k) => { form["map_" + k] = pareceCab ? guess(c) : ["nome", "emp", "email", "tel"][k] || ""; });
      this.setState({ imp: { nome: file.name, cab, linhas: corpo }, form });
    };
    rd.readAsText(file);
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <ContatosDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as ContatosLiga };
