// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Projeto — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * ProjetoDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `ProjetoDesenho.tsx`, convertido por máquina e intocável.
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

import { ProjetoDesenho } from "./ProjetoDesenho";
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

  state = { v: 0, aba: "geral", abertas: {}, nota: "", slide: -1, tpl: {}, mod: null, gAberto: {} };

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
    if (this.dadosDoProto.Projetos) this.dadosDoProto.Projetos.garantir();
    const a = E && E.parametro("aba"); if (a) this.setState({ aba: a });
    this._k = (e) => { if (e.key === "Escape") this.setState({ slide: -1, mod: null }); if (this.state.slide >= 0) { if (e.key === "ArrowRight") this.setState(s => ({ slide: Math.min(4, s.slide + 1) })); if (e.key === "ArrowLeft") this.setState(s => ({ slide: Math.max(0, s.slide - 1) })); } };
    document.addEventListener("keydown", this._k);
  }
  componentWillUnmount() { if (this._off) this._off(); document.removeEventListener("keydown", this._k); }

  renderVals() {
    const S = this.state, E = this.E, PR = this.dadosDoProto.Projetos, D = this.dadosDoProto || {}, EU = this.eu;
    const ini = D.iniciais || ((n) => (n || "").split(" ").filter(Boolean).slice(0, 2).map(x => [...x][0]).join("").toUpperCase());
    const slug = D.slug || ((s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""));
    const diz = (t, tom) => E && E.avisar(t, tom || "ok");
    const escuro = ((E && E.ler("temaOp", "claro")) || "claro") === "escuro";
    const TEMA = escuro ? { bg: "#0f1318", sf: "#161b21", sf2: "#1c222a", ln: "rgba(255,255,255,.08)", tx: "#eef0f1", tx2: "#b3bac0", tx3: "#7b858f", hv: "rgba(255,255,255,.05)", inp: "#12161b", ok: "#3ecf8e", okbg: "rgba(62,207,142,.12)", warn: "#e0b04f", warnbg: "rgba(224,176,79,.12)", err: "#ff7a63", errbg: "rgba(255,106,85,.12)", pri: "#eef0f1", prit: "#12171d" }
      : { bg: "#f6f6f3", sf: "#ffffff", sf2: "#fafaf8", ln: "#e3e7e8", tx: "#12171d", tx2: "#4a5560", tx3: "#8b949e", hv: "#f6f7f7", inp: "#ffffff", ok: "#1f7256", okbg: "#e6f4ee", warn: "#8a5a10", warnbg: "#fbf1dc", err: "#c2330f", errbg: "#fdeeea", pri: "#12171d", prit: "#ffffff" };
    const tema = { vars: Object.keys(TEMA).map(k => "--" + k + ":" + TEMA[k]).join(";") + ";display:flex;flex-direction:column;flex:1;min-height:0;position:relative;overflow:hidden;color:" + TEMA.tx };
    const FAM = PR.FAM, A = PR.atv(), seed = this.dadosDoProto.ClientesSeed || [];
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, "0"), dm = (d) => pad(d.getDate()) + "/" + pad(d.getMonth() + 1), dmy = (d) => dm(d) + "/" + d.getFullYear();
    const id = E && E.parametro("id"), lista = PR.lista(), p = lista.find(x => x.id === id) || lista[0];
    if (!p) return { topo: { titulo: "Projeto", sub: "", trilha: [] }, tema, h: { acoes: [] }, abas: [], v: {}, tiles: [], ctx: [], pessoas: [], hof: {}, prox: { itens: [] }, grupos: [], mats: [], play: [], tl: [], arq: { lista: [] }, kick: {}, sl: { itens: [] }, rs: {}, nota: {}, ac: {}, ir: {}, card: "", tit: "", btn: "", btnP: "", btnG: "" };
    const c = PR.calc(p, A), cl = seed.find(x => x.nome === p.empresa), opps = (E && E.ler("opps", null)) || D.OPORTUNIDADES || [];
    const quandoT = (d, h) => { if (!d) return ""; const x = PR.deIso(d), n = Math.round((x - hoje) / 864e5); return (n < 0 ? "Atrasada · " + dm(x) : n === 0 ? "Hoje" : n === 1 ? "Amanhã" : dm(x)) + (h ? ", " + h : ""); };
    const due = (k) => k ? { d: k.tipo === "Reunião" ? (k.iniD || k.fimD) : k.fimD, h: k.tipo === "Reunião" ? (k.iniH || k.fimH) : k.fimH } : { d: null, h: "" };
    const fmtQ = (iso) => { const d = new Date(iso), x = new Date(d); x.setHours(0, 0, 0, 0); const n = Math.round((hoje - x) / 864e5); return n === 0 ? "Hoje, " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : n === 1 ? "Ontem, " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : dmy(d); };
    const EST = { andamento: ["var(--sf2)", "var(--tx2)", "#8b949e"], aguardando: ["var(--warnbg)", "var(--warn)", "#e0b04f"], bloqueado: ["var(--errbg)", "var(--err)", "#ff6a55"], atrasado: ["var(--errbg)", "var(--err)", "#ff6a55"], pronto: ["var(--okbg)", "var(--ok)", "#3ecf8e"], concluido: ["var(--sf2)", "var(--tx3)", "#8b949e"] };
    const e = c.estado, estT = { andamento: p.tipo === "implantacao" ? "Em implantação" : "Em andamento", aguardando: "Aguardando cliente", bloqueado: "Bloqueado", atrasado: "Em atraso", pronto: c.cai ? "Pronto p/ CS" : "Pronto p/ handoff", concluido: p.concluido ? "Concluído" : "Handoff feito" }[e];
    const card = "display:flex;flex-direction:column;gap:11px;padding:16px;border-radius:16px;background:var(--sf);box-shadow:inset 0 0 0 1px var(--ln)", tit = "display:block;font-family:'Plus Jakarta Sans',sans-serif;font-size:14.5px;font-weight:700;letter-spacing:-.01em;color:var(--tx)";
    const btn = "height:30px;padding:0 11px;border-radius:8px;border:0;background:var(--sf);box-shadow:inset 0 0 0 1px var(--ln);color:var(--tx);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap", btnP = "height:30px;padding:0 12px;border-radius:8px;border:0;background:#d93c1a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap", btnG = "height:26px;padding:0 9px;border-radius:7px;border:0;background:transparent;color:var(--tx2);font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;box-shadow:inset 0 0 0 1px var(--ln)";
    const IC = { tel: "M13.8 16.6a1 1 0 0 0 1.2-.3l.4-.5A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.4z", wa: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", mail: "M4 4h16v16H4zM4 7l8 6 8-6", note: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", check: "M20 6 9 17l-5-5", send: "M22 2 11 13M22 2l-7 20-4-9-9-4z", alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", clip: "M21.4 11.1 12.2 20.3a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5", swap: "M17 8l4 4-4 4M3 12h18", user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" };
    const contato = p.pessoa || "Contato principal", tel = "(11) 9" + (6000 + slug(p.empresa).length * 137 % 3999) + "-" + (1000 + slug(contato).length * 211 % 8999);
    const log = (t, meta) => PR.evento(p.id, t, meta);
    const acoesH = [["Ligar", IC.tel, () => { E.abrirExterno("https://app.callface.ai/calls?call_to=" + tel.replace(/\D/g, "")); log("Ligação iniciada para " + contato, tel); }], ["WhatsApp", IC.wa, () => E.irPara("/atendimento", "Atendimento", { contato, canal: "WhatsApp" })], ["E-mail", IC.mail, () => E.irPara("/atendimento", "Atendimento", { contato, canal: "E-mail" })]].map(([l, d, onClick]) => ({ l, d, onClick }));
    const h = { ini: ini(p.empresa), nome: p.empresa, pill: "display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:9999px;font-size:11.5px;font-weight:600;background:" + EST[e][0] + ";color:" + EST[e][1], dotSt: "width:6px;height:6px;border-radius:9999px;background:" + EST[e][2], est: estT, tipo: p.tipo === "onboarding" ? "Onboarding" : "Implantação", prod: FAM[p.familia],
      meta: [p.oferta, contato + (p.cargo ? " · " + p.cargo : ""), "Responsável: " + p.resp].join("  ·  "), acoes: acoesH,
      temBloq: !!p.bloqueio, bloqT: p.bloqueio ? (p.bloqueio.kind === "cliente" ? "Aguardando cliente" : "Bloqueio externo") : "", bloqS: p.bloqueio ? p.bloqueio.t + (c.dBloq ? " · há " + c.dBloq + " dias" : "") : "", bloqCor: p.bloqueio && p.bloqueio.kind === "cliente" ? "var(--warn)" : "var(--err)", bloqBg: p.bloqueio && p.bloqueio.kind === "cliente" ? "var(--warnbg)" : "var(--errbg)",
      liberar: () => { PR.bloquear(p.id, "", ""); diz("Bloqueio resolvido", "ok"); },
      temPronto: c.pronto, prontoL: c.cai ? "Concluir e enviar para CS" : "Enviar para implantação", irHandoff: () => c.cai ? (PR.concluirCS(p.id), diz(p.empresa + " enviado para Customer Success", "ok")) : E.irPara("/operacao/onboarding", "Onboarding & Implantação", { projeto: p.id }) };
    const abrirK = (k) => () => E.abrir("verAtividade", "p:" + k.id);

    const abas = [["geral", "Visão geral"], ["atividades", "Atividades", c.abertas.length || null], ["materiais", "Materiais"], ["comunicacoes", "Comunicação"], ["arquivos", "Arquivos", (p.arquivos || []).length || null], ["timeline", "Timeline"]];
    const setAba = (k) => () => this.setState({ aba: k });

    // Visão geral
    const kAt = c.atual, pxSub = kAt && c.proxSub >= 0 ? kAt.sub[c.proxSub] : null, dd = due(kAt);
    const tile = (l, v, s, cor, barra) => ({ l, v, s, vSt: "display:block;margin-top:6px;font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.2;color:" + (cor || "var(--tx)") + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis", temBarra: barra != null, barra: "display:block;height:100%;border-radius:9999px;width:" + (barra || 0) + "%;background:" + (e === "pronto" ? "var(--ok)" : c.atraso > 0 ? "var(--err)" : "var(--tx)") });
    const tiles = [tile("Progresso", c.pct + "%", c.feitas + " de " + c.total + " subtarefas", null, c.pct), tile("Prazo", dmy(PR.deIso(p.prazo)), c.atraso > 0 ? "Atrasado há " + c.atraso + " dias" : c.dPrazo + " dias restantes", c.atraso > 0 ? "var(--err)" : null),
      tile("Próxima ação", kAt ? (pxSub ? pxSub.t : kAt.titulo) : (c.pronto ? "Enviar" : "—"), kAt ? kAt.titulo + (dd.d ? " · " + quandoT(dd.d, dd.h) : "") : (c.pronto ? (c.cai ? "para Customer Success" : "para implantação") : "nada em aberto")), tile("Fase atual", c.faseNome, c.atualIdx >= 0 ? "Tarefa " + (c.atualIdx + 1) + " de " + c.nTarefas : "")];
    const prox = { vazio: !c.abertas.length, itens: c.abertas.slice(0, 3).map(k => { const sp = (k.sub || []).findIndex(s => !s.feita), d2 = due(k), late = d2.d && PR.deIso(d2.d) < hoje;
      return { t: k.titulo, s: (k.sub || []).length ? k.sub.filter(s => s.feita).length + "/" + k.sub.length + " subtarefas" + (sp >= 0 ? " · próxima: " + k.sub[sp].t : "") : k.tipo, q: d2.d ? quandoT(d2.d, d2.h) : "sem data", qCor: late ? "var(--err)" : "var(--tx3)", concluir: () => { PR.setTarefa(k.id, true); diz("Tarefa concluída · Atividades atualizada", "ok"); }, abrir: abrirK(k) }; }) };
    const ganho = p.oppId && opps.find(o => o.id === p.oppId);
    const ctx = [{ l: "Cliente", v: p.empresa, link: cl ? () => E.irPara("/clientes/360", p.empresa, { cliente: cl.id }) : null, linkL: "Cliente 360" }, { l: "Empresa", v: p.empresa, link: () => E.irPara("/onface-preview/empresa", p.empresa, cl ? {} : { empresa: p.empresa }), linkL: "Ver empresa" },
      { l: "Contato principal", v: contato + (p.cargo ? " · " + p.cargo : ""), link: () => E.irPara("/onface-preview/pessoa", contato, { pessoa: slug(contato) }), linkL: "Ver contato" }, { l: "Origem", v: ganho ? "Oportunidade ganha · " + ganho.id : "Venda ganha no Pipeline", link: p.oppId ? () => E.irPara("/onface-preview/oportunidade", p.empresa, { opp: p.oppId, ver: "" }) : null, linkL: "Ver oportunidade" },
      { l: "Serviço", v: FAM[p.familia] + " · " + p.oferta }, { l: "Responsável", v: p.resp }].map(x => ({ l: x.l, v: x.v, temLink: !!x.link, ir: x.link || (() => {}), linkL: x.linkL || "" }));
    if (p.expansao) ctx.push({ l: "Expansão", v: "Onboarding anterior de " + p.expansao.base + " reaproveitado (" + c.herdadas + " de " + c.nTarefas + " tarefas)", temLink: false, ir: () => {}, linkL: "" });
    const hf = p.handoff, hof = { tem: !!(hf && (hf.resumo || hf.de)), titulo: p.tipo === "implantacao" ? "Contexto recebido do onboarding" : "Handoff realizado", txt: hf ? (hf.de ? "De " + hf.de + ". " : "") + (hf.para ? "Para " + hf.para + ". " : "") + (hf.resumo || "") : "", temPend: !!(hf && hf.pendencias && hf.pendencias.length), pend: hf && hf.pendencias ? hf.pendencias.join("; ") : "" };
    const pessoas = [{ nome: contato, cargo: (p.cargo || "Contato") + " · contato principal", ini: ini(contato.replace(/^Dr\.?\s+/, "")), acoes: acoesH.map(a => ({ t: a.l, d: a.d, onClick: a.onClick })) }];

    // Atividades (tarefas + subtarefas nativas)
    const kAbert = c.kids.filter(k => PR.tSt(k) === "aberta"), kFeit = c.kids.filter(k => PR.tSt(k) === "feita"), kNa = c.kids.filter(k => PR.tSt(k) === "na");
    const chk = (on, na) => "flex:0 0 auto;width:20px;height:20px;border-radius:7px;border:0;cursor:pointer;font-size:11px;font-weight:800;color:#0c0f13;display:grid;place-items:center;" + (on ? "background:var(--ok);color:#fff" : na ? "background:transparent;box-shadow:inset 0 0 0 1.5px var(--ln)" : "background:transparent;box-shadow:inset 0 0 0 1.5px var(--tx3)");
    const kRow = (k) => { const st = PR.tSt(k), feita = st === "feita", na = st === "na", sn = PR.subN(k), d2 = due(k), late = !feita && !na && d2.d && PR.deIso(d2.d) < hoje, on = S.abertas[k.id] !== undefined ? S.abertas[k.id] : (c.atual && c.atual.id === k.id);
      return { t: k.titulo, tipo: k.tipo, temAtual: !!(c.atual && c.atual.id === k.id), s: na ? "Não aplicável" + (p.expansao ? " · reaproveitada de onboarding anterior" : "") : (k.sub || []).length ? sn.d + " de " + sn.n + " subtarefas" : "Sem subtarefas", q: feita ? "concluída" : na ? "" : d2.d ? quandoT(d2.d, d2.h) : "", qCor: late ? "var(--err)" : "var(--tx3)", resp: k.resp, respIni: ini(k.resp || "?"),
        tSt: "font-size:14px;font-weight:600;color:" + (feita || na ? "var(--tx3)" : "var(--tx)") + (feita ? ";text-decoration:line-through" : ""), mark: feita ? "✓" : "", chk: chk(feita, na), concluirDica: feita ? "Reabrir tarefa" : "Concluir tarefa",
        concluir: () => { if (na) return; PR.setTarefa(k.id, !feita); diz(feita ? "Tarefa reaberta" : "Tarefa concluída · Atividades atualizada", "ok"); }, abrir: abrirK(k),
        na: () => { PR.naTarefa(k.id, !na); diz(na ? "Tarefa reativada" : "Marcada como não aplicável", "ok"); }, naL: na ? "Reativar" : "Não aplicável",
        aberta: on, toggle: () => this.setState(s => ({ abertas: Object.assign({}, s.abertas, { [k.id]: !on }) })), chev: "transition:transform .2s;transform:rotate(" + (on ? 180 : 0) + "deg)",
        semSubs: !(k.sub || []).length, subs: (k.sub || []).map((sb, i) => ({ t: sb.t, q: sb.fimD && !sb.feita ? quandoT(sb.fimD, "") : sb.feita ? "feita" : "", mark: sb.feita ? "✓" : "", chk: chk(sb.feita, na), tSt: "flex:1;min-width:0;font-size:13px;color:" + (sb.feita || na ? "var(--tx3)" : "var(--tx)") + (sb.feita ? ";text-decoration:line-through" : ""),
          toggle: () => { if (na) return; PR.setSub(k.id, i, !sb.feita); } })) }; };
    const grupos = [{ l: "Em aberto", itens: kAbert.map(kRow) }, { l: "Concluídas", itens: kFeit.map(kRow) }, { l: "Não aplicáveis", itens: kNa.map(kRow) }].filter(g => g.itens.length).map(g => ({ l: g.l, n: String(g.itens.length), itens: g.itens }));

    // Materiais
    const linkBase = "https://app.onface.com.br/f/", kForm = c.kids.find(k => k.tarefaK === "form"), formOk = p.tipo === "implantacao" || (kForm && PR.tSt(kForm) !== "aberta");
    const mats = (p.familia === "PABX" ? [{ nome: "Formulário de implantação PABX", desc: "Portabilidade, ramais, URA, linhas e contatos técnicos. O cliente preenche sem entrar na ONFACE.", k: "pabx" }]
      : p.familia === "WHITE_LABEL" ? [{ nome: "Coleta de informações White Label", desc: "Domínio, contato técnico, logo, favicon, cores e faturamento.", k: "wl" }] : [{ nome: "Guia de acessos e primeiros passos", desc: "Login, usuários, times e integrações para a primeira semana.", k: "cai" }])
      .map(m => { const url = linkBase + m.k + "/" + p.id, sent = m.k === "cai" ? true : formOk;
        return { nome: m.nome, desc: m.desc, link: url, st: sent ? "Enviado" : "Não enviado", pill: "flex:0 0 auto;display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:9999px;font-size:11px;font-weight:600;" + (sent ? "background:var(--okbg);color:var(--ok)" : "background:var(--sf);box-shadow:inset 0 0 0 1px var(--ln);color:var(--tx2)"),
          copiar: () => { try { navigator.clipboard.writeText(url); diz("Link copiado", "ok"); } catch (x) { diz("Não deu para copiar", "erro"); } },
          enviar: () => { log("Material enviado ao cliente · " + m.nome, "Link público enviado a " + contato); E.irPara("/atendimento", "Atendimento", { contato, canal: "WhatsApp" }); },
          resp: () => this.setState({ mod: { t: "Respostas · " + m.nome, /* ANTES: "Prévia do que o cliente preencheu" com linhas fixas (3 linhas de portabilidade, 6 ramais, Datora, cores #E23752, 8 usuários). Falso: nenhuma resposta é gravada ainda. */ nota: "As respostas do link público ainda não estão ligadas.",
            linhas: [{ l: "Status", v: "Sem respostas" }] } }) };});
    const jn = PR.jornada(p.familia, "onboarding").map(x => x[1]), tail = p.familia === "CALLFACE_AI" ? ["Customer Success"] : ["Implantação", "Homologação", "Go-live", "Customer Success"];
    /* Modelos de texto abaixo: removidas afirmações de fato não cadastrado (contexto já recebido, duração do treinamento/formulário, NPS, atendimento por área, time apresentado). */
    const slides = [{ kicker: "Kickoff", titulo: "Bem-vindo à Callface, " + p.empresa, sub: "Vamos alinhar o que foi contratado, como será a jornada e quem acompanha você. Produto: " + FAM[p.familia] + ".", itens: [] },
      { kicker: "Sua jornada", titulo: "Sua jornada com a Callface", sub: "" /* ANTES: o slide afirmava "cada etapa tem um responsável e um resultado claro". Falso: fato não cadastrado afirmado ao cliente. */, itens: jn.concat(tail).map((n, i) => ({ t: n, tag: c.atual && c.atual.titulo === n ? "← você está aqui" : (i === 0 && !c.atual ? "← você está aqui" : "") })) },
      { kicker: "Escopo", titulo: "O que foi contratado", sub: p.oferta, itens: [{ t: FAM[p.familia] + " · " + p.oferta, tag: "" }, { t: "Prazo estimado até " + dmy(PR.deIso(p.prazo)), tag: "" }] },
      { kicker: "Time", titulo: "Quem acompanha você", sub: "" /* ANTES: o slide listava canais de contato como fato. Falso: fato não cadastrado afirmado ao cliente. */, itens: [{ t: p.resp + " · " + (p.tipo === "onboarding" ? "Onboarding" : "Implantação"), tag: "" }, { t: contato + " · " + (p.cargo || "contato do cliente"), tag: "" }].concat([]) /* ANTES: prometia "Time de implantação apresentado após o kickoff"; nada cadastrado garante isso. */ },
      { kicker: "Próximos passos", titulo: "O que acontece agora", sub: "" /* ANTES: o slide prometia "NPS periódico" e "acompanhamento próximo"; não há NPS nem rotina cadastrados. Falso: fato não cadastrado afirmado ao cliente. */, itens: c.abertas.slice(0, 4).map(k => ({ t: k.titulo, tag: due(k).d ? quandoT(due(k).d, due(k).h) : "" })) }];
    const cur = S.slide >= 0 ? slides[Math.min(S.slide, 4)] : null;
    const kick = { cliente: p.empresa, prod: FAM[p.familia], sub: p.resp + " · " + p.oferta, ver: () => this.setState({ slide: 0 }), apresentar: () => { log("Apresentação de kickoff aberta", "Modo apresentação"); this.setState({ slide: 0 }); if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } };
    const sl = { aberto: !!cur, pos: "Slide " + (Math.min(S.slide, 4) + 1) + " de 5 · ← → para navegar", kicker: cur ? cur.kicker : "", titulo: cur ? cur.titulo : "", sub: cur ? cur.sub : "", fechar: () => this.setState({ slide: -1 }), ant: () => this.setState(s => ({ slide: Math.max(0, s.slide - 1) })), prox: () => this.setState(s => s.slide >= 4 ? { slide: -1 } : { slide: s.slide + 1 }),
      itens: cur ? cur.itens.map(it => ({ t: it.t, tag: it.tag, st: "display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;font-size:16px;color:#eef0f1;" + (it.tag ? "background:rgba(254,79,43,.12)" : "background:rgba(255,255,255,.05)"), dot: "width:8px;height:8px;border-radius:9999px;background:" + (it.tag ? "#fe4f2b" : "#4a5560") })) : [] };

    // Playbook de comunicação
    const fill = (t) => t.split("{cliente}").join(p.empresa).split("{contato}").join(contato.split(" ")[0]).split("{responsavel}").join(p.resp.split(" ")[0]).split("{link}").join(linkBase + (p.familia === "WHITE_LABEL" ? "wl" : "pabx") + "/" + p.id);
    const PB = p.tipo === "implantacao" ? [
      ["i1", "Início da implantação", "WhatsApp", "Assim que a implantação é criada", "Oi, {contato}! Sou {responsavel}, do time técnico da Callface. Vamos começar a implantação da {cliente}. Confirma a nossa reunião?", "lev"],
      ["i2", "Lembrete de pendência do cliente", "WhatsApp", "Quando algo depende do cliente há mais de 2 dias", "{contato}, tudo bem? Falta uma informação do seu lado para seguirmos com a implantação da {cliente}. Consegue me enviar hoje?", null],
      ["i3", "Agendamento da validação", "E-mail", "Antes da validação com o cliente", "Olá, {contato},\n\nEstamos prontos para validar o ambiente juntos. Qual o melhor horário nesta semana?\n\n{responsavel}", "val"],
      ["i4", "Go-live", "E-mail", "No dia do go-live", "Olá, {contato},\n\nSeu ambiente está no ar. Qualquer dúvida, nosso suporte e eu estamos à disposição.\n\n{responsavel}", "golive"]
    ] : [
      ["m1", "Primeiro contato", "WhatsApp", "Assim que o projeto nasce", "Oi, {contato}! Aqui é {responsavel}, do time da Callface. Vou conduzir os próximos passos da ativação da {cliente}. Podemos marcar o kickoff?", "contato"],
      ["m2", "Canais de atendimento", "WhatsApp", "Logo após o primeiro contato", "{contato}, nossos canais: WhatsApp neste número, e-mail e ligação pelo Callface. Para urgências, fale direto comigo, {responsavel}.", "contato"],
      ["m3", "Confirmação de kickoff", "E-mail", "Quando o kickoff é agendado", "Olá, {contato},\n\nConfirmo nosso kickoff. Pauta: jornada, escopo contratado, responsáveis e próximos passos.\n\n{responsavel}", "kick"],
      ["m4", "Resumo do kickoff", "E-mail", "No mesmo dia do kickoff", "Olá, {contato},\n\nObrigado pela reunião. O resumo do que alinhamos, com responsáveis e prazos, está na apresentação. Próximo passo: preencher o material e agendar a primeira reunião técnica.\n\n{responsavel}", "kick"]
    ].concat(p.familia === "CALLFACE_AI" ? [
      ["m5", "Guia de acessos", "E-mail", "Depois do kickoff", "Olá, {contato},\n\nSegue o guia de acessos e primeiros passos da {cliente}. Qualquer dúvida na configuração, me chame.\n\n{responsavel}", "kick"],
      ["m6", "Convite para o treinamento", "WhatsApp", "Antes da operação assistida", "{contato}, vamos agendar o treinamento com a equipe da {cliente}?", "assist"],
      ["m7", "Primeiro valor", "E-mail", "Quando o marco é registrado", "Olá, {contato},\n\nA {cliente} atingiu o primeiro valor com a Callface. Vamos comemorar e planejar os próximos passos.\n\n{responsavel}", "valor"]
    ] : [
      ["m5", "Envio do formulário", "WhatsApp", "Depois do kickoff", "{contato}, segue o link para preencher as informações da implantação: {link}. Não precisa de login.", "form"],
      ["m6", "Lembrete de preenchimento", "WhatsApp", "Se não preencher em 3 dias", "{contato}, tudo bem? Falta preencher o formulário para seguirmos com a implantação da {cliente}: {link}.", "form"],
      ["m7", "Handoff para implantação", "WhatsApp", "Na passagem para o time técnico", "{contato}, a partir de agora quem conduz a parte técnica é nosso time de implantação.", "passagem"]
    ]);
    const atualK = c.atual ? c.atual.tarefaK : null, kOrd = c.kids.map(k => k.tarefaK);
    const play = PB.map(([key, nome, canal, quando, txt, tk], i) => { const sent = p.comms && p.comms[key], agora = !sent && tk && atualK === tk, on = !!(S.tpl[key] && S.tpl[key].aberto) || agora && S.tpl[key] === undefined, val = S.tpl[key] && S.tpl[key].texto !== undefined ? S.tpl[key].texto : fill(txt), passou = !sent && tk && kOrd.indexOf(tk) >= 0 && c.atualIdx >= 0 && kOrd.indexOf(tk) < c.atualIdx;
      return { nome, canal, canalD: canal === "E-mail" ? IC.mail : IC.wa, quando: "Quando: " + quando, aberto: on, texto: val, linhas: String(Math.min(9, Math.max(3, val.split("\n").length + Math.ceil(val.length / 90)))),
        st: sent ? "Enviado em " + fmtQ(sent.quando) + " · " + sent.canal : agora ? "Sugerido agora" : passou ? "Etapa já passou" : "Aguardando etapa", stSt: "font-size:11.5px;font-weight:600;color:" + (sent ? "var(--ok)" : agora ? "#c2330f" : "var(--tx3)"),
        no: "position:relative;z-index:1;width:22px;height:22px;margin-top:15px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:700;background:" + (sent ? "var(--ok)" : "var(--sf)") + ";color:" + (sent ? "#fff" : agora ? "#c2330f" : "var(--tx3)") + ";box-shadow:inset 0 0 0 " + (sent ? "0 transparent" : agora ? "2px #fe4f2b" : "1.5px var(--ln)"), noT: sent ? "✓" : String(i + 1),
        linha: i < PB.length - 1 ? "position:absolute;left:50%;top:26px;bottom:-14px;width:1.5px;margin-left:-.75px;background:var(--ln)" : "display:none",
        verL: on ? "Fechar" : "Ver / editar", ver: () => this.setState(s => ({ tpl: Object.assign({}, s.tpl, { [key]: Object.assign({}, s.tpl[key], { aberto: !on, texto: s.tpl[key] && s.tpl[key].texto }) }) })),
        set: (ev) => { const v = ev.target.value; this.setState(s => ({ tpl: Object.assign({}, s.tpl, { [key]: Object.assign({}, s.tpl[key], { aberto: true, texto: v }) }) })); },
        envL: sent ? "Reenviar" : "Enviar", envSt: agora ? btnP : btn,
        enviar: () => { PR.comunicou(p.id, key, canal, nome); E.irPara("/atendimento", "Atendimento", { contato, canal: canal === "E-mail" ? "E-mail" : "WhatsApp", texto: val }); } }; });

    // Arquivos e timeline
    const baixar = (nome, url) => { const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); };
    const arqs = p.arquivos || [];
    const arq = { vazio: !arqs.length, lista: arqs.map(f => ({ nome: f.nome, ext: (f.nome.split(".").pop() || "ARQ").slice(0, 4).toUpperCase(), meta: f.autor + " · " + dmy(new Date(f.quando)) + " · " + f.tam, baixar: () => f.url ? baixar(f.nome, f.url) : diz("Arquivo grande demais: só o registro foi salvo", "aviso") })),
      enviar: (ev) => { const fs = Array.from(ev.target.files || []); ev.target.value = ""; if (!fs.length) return; const novos = []; let n = fs.length; const fim = () => { PR.mut(p.id, (q) => { q.arquivos = (q.arquivos || []).concat(novos); }, { t: novos.length > 1 ? novos.length + " arquivos enviados" : "Arquivo enviado · " + novos[0].nome, meta: "Arquivos do projeto" }); diz(novos.length + (novos.length > 1 ? " arquivos adicionados" : " arquivo adicionado"), "ok"); };
        fs.forEach(fl => { const b = { nome: fl.name, tam: fl.size > 1048576 ? (fl.size / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(fl.size / 1024)) + " KB", quando: new Date().toISOString(), autor: EU }; if (fl.size > 1.5 * 1048576) { novos.push(b); if (!--n) fim(); return; } const r = new FileReader(); r.onload = () => { novos.push(Object.assign(b, { url: r.result })); if (!--n) fim(); }; r.readAsDataURL(fl); }); } };
    const MARCA = { ok: "background:var(--okbg);color:var(--ok)", neutro: "background:var(--sf2);color:var(--tx2)", coral: "background:rgba(254,79,43,.12);color:#c2330f" };
    const tl = p.eventos.map((x, i, arr) => { const t = /concluiu|concluída|enviad|handoff/i.test(x.t) ? "ok" : /nota|arquivo/i.test(x.t) ? "neutro" : /aguardando|bloqueio/i.test(x.t) ? "coral" : "neutro"; const d = /nota/i.test(x.t) ? IC.note : /arquivo/i.test(x.t) ? IC.clip : /handoff|enviad/i.test(x.t) ? IC.send : /bloqueio|aguardando/i.test(x.t) ? IC.alert : IC.check;
      return { t: x.t, meta: [x.meta, x.autor].filter(Boolean).join(" · "), q: fmtQ(x.quando), d, marca: "position:relative;z-index:1;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;box-shadow:0 0 0 3px var(--sf);" + MARCA[t], linha: i < arr.length - 1 ? "position:absolute;left:11.25px;top:34px;bottom:-6px;width:1.5px;background:var(--ln)" : "display:none" }; });
    const M = S.mod;
    return { topo: { titulo: p.empresa, sub: p.tipo === "onboarding" ? "Onboarding" : "Implantação", trilha: [{ label: "Onboarding & Implantação", ir: () => E.irPara("/operacao/onboarding", "Onboarding & Implantação") }] },
      tema, h, card, tit, btn, btnP, btnG, abas: abas.map(([k, l, n]) => ({ l, temN: n != null, n: String(n), onClick: setAba(k), st: "flex:0 0 auto;display:flex;align-items:center;gap:7px;height:46px;padding:0 2px;border:0;background:transparent;cursor:pointer;font-size:13px;white-space:nowrap;" + (S.aba === k ? "color:var(--tx);font-weight:600;box-shadow:inset 0 -2px 0 #fe4f2b" : "color:var(--tx3);font-weight:500"), nSt: "min-width:20px;height:18px;padding:0 6px;border-radius:9999px;display:grid;place-items:center;font-size:10.5px;font-weight:700;" + (S.aba === k ? "background:#fe4f2b;color:#fff" : "background:var(--sf2);color:var(--tx2)") })),
      v: { geral: S.aba === "geral", atividades: S.aba === "atividades", materiais: S.aba === "materiais", comunicacoes: S.aba === "comunicacoes", arquivos: S.aba === "arquivos", timeline: S.aba === "timeline" },
      tiles, prox, ctx, hof, pessoas, grupos, mats, kick, sl, play, arq, tl,
      nota: { v: S.nota, set: (ev) => this.setState({ nota: ev.target.value }), btn: "height:32px;padding:0 13px;border-radius:8px;border:0;font-size:12.5px;font-weight:600;cursor:pointer;color:#fff;background:" + (S.nota.trim() ? "#d93c1a" : "#f5a38f"), salvar: () => { const t = S.nota.trim(); if (!t) return; PR.nota(p.id, t); this.setState({ nota: "" }); diz("Nota salva na timeline", "ok"); } },
      ac: { nova: () => E.abrir("novaAtividade", { empresa: p.empresa, pessoa: contato, projetoId: p.id }), reuniao: () => E.abrir("novaReuniao", { data: PR.iso(1), hora: "10:00", titulo: "Reunião · " + p.empresa, empresa: p.empresa, pessoa: contato }) },
      ir: { atividades: setAba("atividades"), quadro: () => E.irPara("/onface-preview/atividades", "Atividades", { projeto: p.id }) },
      rs: { aberto: !!M, titulo: M ? M.t : "", nota: M ? M.nota : "", linhas: M ? M.linhas : [] }, fechar: () => this.setState({ mod: null }), parar: (ev) => ev.stopPropagation() };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <ProjetoDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as ProjetoLiga };
