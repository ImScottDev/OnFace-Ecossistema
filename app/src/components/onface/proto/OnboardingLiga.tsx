// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Onboarding — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * OnboardingDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `OnboardingDesenho.tsx`, convertido por máquina e intocável.
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

import { OnboardingDesenho } from "./OnboardingDesenho";
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

  state = { tab: "todos", v: 0, fam: "todos", resp: "todos", flt: null, q: "", obF: "todos", imF: "todos", drawer: null, modal: null, nx: null };

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
    const id = E && E.parametro("projeto"); if (id) this.setState({ drawer: id });
    this._esc = (e) => { if (e.key === "Escape") this.setState(s => s.modal ? { modal: null } : { drawer: null }); }; document.addEventListener("keydown", this._esc);
  }
  componentWillUnmount() { if (this._off) this._off(); document.removeEventListener("keydown", this._esc); }

  renderVals() {
    const S = this.state, E = this.E, PR = this.dadosDoProto.Projetos, D = this.dadosDoProto || {}, EU = this.eu;
    const ini = D.iniciais || ((n) => (n || "").split(" ").filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase());
    const diz = (t, tom) => E && E.avisar(t, tom || "ok");
    const escuro = false;
    const TEMA = escuro ? { bg: "#0f1318", sf: "#161b21", sf2: "#1c222a", ln: "rgba(255,255,255,.08)", tx: "#eef0f1", tx2: "#b3bac0", tx3: "#7b858f", hv: "rgba(255,255,255,.05)", inp: "#12161b", ok: "#3ecf8e", okbg: "rgba(62,207,142,.12)", warn: "#e0b04f", warnbg: "rgba(224,176,79,.12)", err: "#ff7a63", errbg: "rgba(255,106,85,.12)", hero: "#1c222a" }
      : { bg: "#f6f6f3", sf: "#ffffff", sf2: "#fafaf8", ln: "#e3e7e8", tx: "#12171d", tx2: "#4a5560", tx3: "#8b949e", hv: "#f6f7f7", inp: "#ffffff", ok: "#1f7256", okbg: "#e6f4ee", warn: "#8a5a10", warnbg: "#fbf1dc", err: "#c2330f", errbg: "#fdeeea", hero: "#12171d" };
    const tema = { vars: Object.keys(TEMA).map(k => "--" + k + ":" + TEMA[k]).join(";") + ";display:flex;flex-direction:column;flex:1;min-height:0;position:relative;overflow:hidden;color:" + TEMA.tx,
      alternar: () => E && E.gravar({ temaOp: escuro ? "claro" : "escuro" }), dica: escuro ? "Tema claro" : "Tema escuro", ico: escuro ? "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" : "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" };
    const seed = this.dadosDoProto.ClientesSeed || [], opps = (E && E.ler("opps", null)) || D.OPORTUNIDADES || [];
    const FAM = PR.FAM, A = PR.atv(), hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, "0"), dm = (d) => pad(d.getDate()) + "/" + pad(d.getMonth() + 1), isoD = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const lista = PR.lista(), rows = lista.map(p => ({ p, c: PR.calc(p, A) })), byId = (id) => rows.find(r => r.p.id === id);
    const equipeTodos = PR.EQUIPE_ONB.concat(PR.EQUIPE_IMP), qq = S.q.trim().toLowerCase();
    const base = rows.filter(r => r.c.ativo && (S.fam === "todos" || r.p.familia === S.fam) && (S.resp === "todos" || r.p.resp === S.resp) && (!qq || r.p.empresa.toLowerCase().indexOf(qq) >= 0));
    const FLT = { onb: r => r.p.tipo === "onboarding", imp: r => r.p.tipo === "implantacao", aguard: r => r.c.estado === "aguardando" || r.c.estado === "bloqueado", atraso: r => r.c.atraso > 0, golive: r => r.c.golive, pronto: r => r.c.pronto };
    const filtrado = S.flt ? base.filter(FLT[S.flt] || (() => true)) : base;
    const setF = (k) => () => this.setState(s => ({ flt: s.flt === k ? null : k }));
    const TOMK = { n: ["var(--sf2)", "var(--tx2)"], w: ["var(--warnbg)", "var(--warn)"], e: ["var(--errbg)", "var(--err)"], o: ["var(--okbg)", "var(--ok)"] }, IK = {"layers":"M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5","user":"M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z","tool":"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z","clock":"M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z","alert":"M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z","trend":"M22 7 13.5 15.5l-5-5L2 17M16 7h6v6"};
    const kpis = [["Projetos ativos", base.length, "layers", "n", null, () => this.setState({ flt: null, tab: "todos" })], ["Onboardings", base.filter(FLT.onb).length, "user", "n", null, () => this.setState({ tab: "onb", flt: null })], ["Implantações", base.filter(FLT.imp).length, "tool", "n", null, () => this.setState({ tab: "imp", flt: null })],
      ["Aguardando cliente", base.filter(FLT.aguard).length, "clock", "w", "aguard", setF("aguard")], ["Em atraso", base.filter(FLT.atraso).length, "alert", "e", "atraso", setF("atraso")], ["Go-lives na semana", base.filter(FLT.golive).length, "trend", "o", "golive", setF("golive")]]
      .map(([l, n, ic, tom, f, onClick]) => { const on = f && S.flt === f; return { l, v: String(n), d: IK[ic], onClick,
        st: "flex:1 0 148px;display:flex;align-items:center;gap:11px;padding:15px 16px;border:0;cursor:pointer;min-width:0;background:transparent;box-shadow:inset -1px 0 0 var(--ln)" + (on ? ",inset 0 -2px 0 #fe4f2b" : ""),
        tile: "flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:" + TOMK[tom][0] + ";color:" + TOMK[tom][1],
        vSt: "display:block;font-family:'Plus Jakarta Sans',sans-serif;font-size:24px;font-weight:800;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums;color:var(--tx)" }; });

    const quandoT = (d, h) => { if (!d) return ""; const x = PR.deIso(d), n = Math.round((x - hoje) / 864e5); return (n < 0 ? "Atrasada · " + dm(x) : n === 0 ? "Hoje" : n === 1 ? "Amanhã" : dm(x)) + (h ? ", " + h : ""); };
    const due = (k) => k ? { d: k.tipo === "Reunião" ? (k.iniD || k.fimD) : k.fimD, h: k.tipo === "Reunião" ? (k.iniH || k.fimH) : k.fimH } : { d: null, h: "" };
    const EST = { andamento: ["var(--sf2)", "var(--tx2)", "#8b949e"], aguardando: ["var(--warnbg)", "var(--warn)", "#e0b04f"], bloqueado: ["var(--errbg)", "var(--err)", "#ff6a55"], atrasado: ["var(--errbg)", "var(--err)", "#ff6a55"], pronto: ["var(--okbg)", "var(--ok)", "#3ecf8e"], concluido: ["var(--sf2)", "var(--tx3)", "#8b949e"] };
    const pill = (e) => "display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;background:" + EST[e][0] + ";color:" + EST[e][1];
    const dotS = (e) => "width:6px;height:6px;border-radius:9999px;background:" + EST[e][2];
    const estL = (r) => r.c.estado === "andamento" ? (r.p.tipo === "implantacao" ? "Em implantação" : "Em andamento") : r.c.estado === "pronto" ? (r.c.cai ? "Pronto p/ CS" : "Pronto p/ handoff") : r.c.estado === "aguardando" ? "Aguardando cliente" : r.c.estado === "bloqueado" ? "Bloqueado" : r.c.estado === "atrasado" ? "Em atraso" : (r.p.concluido ? "Concluído" : "Handoff feito");
    const prazoT = (r) => r.c.atraso > 0 ? "atraso " + r.c.atraso + "d" : r.c.dPrazo === 0 ? "vence hoje" : "prazo " + dm(PR.deIso(r.p.prazo));
    const clienteDe = (p) => seed.find(c => c.nome === p.empresa);
    const proxDe = (r) => { const k = r.c.atual; if (!k) return null; const sb = r.c.proxSub >= 0 ? k.sub[r.c.proxSub] : null, dd = due(k); return { t: sb ? sb.t : k.titulo, s: k.titulo, d: dd.d, h: dd.h, k }; };

    const abrirHandoff = (id) => { const r = byId(id); if (!r) return; const p = r.p, ult = p.eventos.find(e => /kickoff/i.test(e.t)), pend = [p.bloqueio ? p.bloqueio.t : null].concat(r.c.abertas.filter(k => k.tarefaK !== "passagem").map(k => k.titulo)).filter(Boolean);
      const d = new Date(hoje.getTime() + 864e5); this.setState({ modal: { k: "handoff", id, resp: PR.EQUIPE_IMP[0], data: isoD(d), hora: "14:00", resumo: [ult ? ult.meta : "", (p.notas[0] || {}).texto || "", "Escopo: " + p.oferta + "."].filter(Boolean).join(" "), pend: pend.join("\n"), erro: "" } }); };
    const acaoPronto = (r) => () => r.c.cai ? this.setState({ modal: { k: "cs", id: r.p.id } }) : abrirHandoff(r.p.id);

    const linhaDe = (r) => { const p = r.p, c = r.c, e = c.estado, pr = proxDe(r);
      let l3 = "font-size:12px;color:var(--tx2)", l3t = "";
      if (p.bloqueio) { l3 = "font-size:12px;font-weight:600;color:" + (p.bloqueio.kind === "cliente" ? "var(--warn)" : "var(--err)"); l3t = (p.bloqueio.kind === "cliente" ? "Aguardando cliente" : "Bloqueado") + " · " + p.bloqueio.t + (c.dBloq ? " · há " + c.dBloq + "d" : ""); }
      else if (c.pronto) { l3 = "font-size:12px;color:var(--ok)"; l3t = c.cai ? "Onboarding concluído" : "Kickoff, material e responsável ok"; }
      else if (pr) { l3 = "font-size:12px;color:" + (pr.d && PR.deIso(pr.d) < hoje ? "var(--err)" : "var(--tx2)"); l3t = "Próxima: " + pr.t + (pr.d ? " · " + quandoT(pr.d, pr.h) : ""); }
      else { l3 = "font-size:12px;color:var(--err)"; l3t = "Sem próxima ação definida"; }
      const pxi = (() => { if (p.bloqueio) return [p.bloqueio.t, (p.bloqueio.kind === "cliente" ? "Aguardando cliente" : "Bloqueio externo") + (c.dBloq ? " · há " + c.dBloq + "d" : ""), p.bloqueio.kind === "cliente" ? "var(--warn)" : "var(--err)"]; if (c.pronto) return [c.cai ? "Enviar para o Customer Success" : "Fazer o handoff", c.cai ? "Todas as tarefas concluídas" : "Kickoff, material e responsável ok", "var(--ok)"]; if (pr) return [pr.t, pr.s + (pr.d ? " · " + quandoT(pr.d, pr.h) : ""), pr.d && PR.deIso(pr.d) < hoje ? "var(--err)" : "var(--tx)"]; return ["Sem próxima ação", "Defina a próxima tarefa", "var(--err)"]; })();
      return { tipo: p.tipo === "onboarding" ? "Onboarding" : "Implantação", px: pxi[0], pxSub: pxi[1], pxSt: "display:block;margin-top:1px;font-size:13px;font-weight:600;color:" + pxi[2] + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
        card: "position:relative;display:flex;flex-direction:column;gap:11px;padding:14px 14px 12px 18px;border-radius:14px;background:var(--sf);box-shadow:inset 0 0 0 1px var(--ln);cursor:pointer;min-width:0;overflow:hidden", bar: "position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:" + EST[e][2],
        nome: p.empresa, ini: ini(p.empresa), prod: FAM[p.familia], pct: c.pct, fase: c.faseNome, linha3: l3, linha3T: l3t, temHerd: c.herdadas > 0, herd: "Expansão · " + c.herdadas + " de " + c.nTarefas + " tarefas reaproveitadas",
        est: estL(r), pill: pill(e), dotSt: dotS(e), prazo: prazoT(r), resp: p.resp, respIni: ini(p.resp), pronto: c.pronto, prontoTxt: c.cai ? "Todas as tarefas concluídas. Pronto para o Customer Success." : "Onboarding concluído. A implantação recebe todo o contexto.", acaoPronL: c.cai ? "Enviar para CS" : "Enviar para implantação", acaoPronto: acaoPronto(r),
        wrap: "padding:13px 16px;box-shadow:inset 0 1px 0 var(--ln)" + (S.drawer === p.id ? ";background:var(--hv)" : ""),
        barra: "display:block;height:100%;border-radius:9999px;transition:width .9s cubic-bezier(.16,1,.3,1);width:" + c.pct + "%;background:" + (e === "pronto" ? "var(--ok)" : c.atraso > 0 || e === "bloqueado" ? "var(--err)" : "var(--tx)"), abrir: () => this.setState({ drawer: p.id }) }; };
    const ord = (a, b) => (b.c.pronto - a.c.pronto) || (b.c.atraso > 0) - (a.c.atraso > 0) || b.c.pct - a.c.pct;
    const chipsF = (l2, cur, key, fams) => fams.map(([k, l]) => { const n = l2.filter(r => k === "todos" || r.p.familia === k).length, on = cur === k;
      return { l, n: String(n), onClick: () => this.setState({ [key]: k }), st: "display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (on ? "background:var(--sf);color:var(--tx);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.18),inset 0 0 0 1px var(--ln)" : "background:transparent;color:var(--tx2);font-weight:500") }; });
    const onbAll = filtrado.filter(r => r.p.tipo === "onboarding"), impAll = filtrado.filter(r => r.p.tipo === "implantacao");
    const onbL = onbAll.filter(r => S.obF === "todos" || r.p.familia === S.obF).sort(ord), impL = impAll.filter(r => S.imF === "todos" || r.p.familia === S.imF).sort(ord);
    const stats = (arr, extra) => [[arr.filter(r => ["andamento", "atrasado"].indexOf(r.c.estado) >= 0).length, " em andamento", "#8b949e", null], [arr.filter(r => r.c.estado === "aguardando").length, " aguardando cliente", "#e0b04f", "aguard"], [arr.filter(r => r.c.atraso > 0).length, " em atraso", "#ff6a55", "atraso"], extra]
      .map(([n, l, cor, f]) => ({ n: String(n), l, dot: "width:6px;height:6px;border-radius:9999px;background:" + cor, onClick: f ? setF(f) : () => {} }));
    const wsOnb = { titulo: "Onboarding", sub: "Contato, kickoff, materiais e passagem para implantação", n: String(onbAll.length), stats: stats(onbAll, [onbAll.filter(r => r.c.pronto).length, " prontos p/ handoff", "#3ecf8e", "pronto"]),
      chips: chipsF(onbAll, S.obF, "obF", [["todos", "Todos"], ["CALLFACE_AI", "Callface AI"], ["PABX", "PABX"], ["WHITE_LABEL", "White Label"]]), linhas: onbL.map(linhaDe), vazio: !onbL.length, vazioTxt: "Nenhum onboarding com esses filtros." };
    const wsImp = { titulo: "Implantação", sub: "Provisionamento, portabilidade, homologação e go-live", n: String(impAll.length), stats: stats(impAll, [impAll.filter(r => r.c.golive).length, " perto do go-live", "#3ecf8e", "golive"]),
      chips: chipsF(impAll, S.imF, "imF", [["todos", "Todos"], ["PABX", "PABX"], ["WHITE_LABEL", "White Label"]]), linhas: impL.map(linhaDe), vazio: !impL.length, vazioTxt: "Nenhuma implantação com esses filtros." };

    const atItens = []; base.forEach(r => { const p = r.p, c = r.c;
      if (c.atraso > 0) atItens.push({ r, sev: 0, nome: p.empresa, txt: "Atrasado há " + c.atraso + (c.atraso > 1 ? " dias" : " dia") + " · " + c.faseNome });
      if (p.bloqueio) atItens.push({ r, sev: p.bloqueio.kind === "externo" ? 0 : 1, nome: p.empresa, txt: p.bloqueio.t + (c.dBloq ? " há " + c.dBloq + "d" : "") });
      if (c.semProx) atItens.push({ r, sev: 1, nome: p.empresa, txt: "Sem próxima ação definida" });
      if (c.pronto) atItens.push({ r, sev: 2, nome: p.empresa, txt: c.cai ? "Pronto para Customer Success" : "Onboarding pronto, aguardando handoff" }); });
    atItens.sort((a, b) => a.sev - b.sev);
    const at = { n: String(atItens.length), vazio: !atItens.length, badge: "min-width:22px;height:20px;padding:0 7px;border-radius:9999px;display:grid;place-items:center;font-size:11px;font-weight:700;" + (atItens.some(a => a.sev === 0) ? "background:var(--errbg);color:var(--err)" : "background:var(--sf2);color:var(--tx2)"),
      itens: atItens.slice(0, 6).map(a => ({ nome: a.nome, txt: a.txt, dot: "flex:0 0 auto;width:7px;height:7px;margin-top:6px;border-radius:9999px;background:" + ["#ff6a55", "#e0b04f", "#3ecf8e"][a.sev], onClick: () => this.setState({ drawer: a.r.p.id }) })) };

    const hj = isoD(hoje), doHoje = A.filter(a => a.projetoId && !a.projeto && a.situacao !== "Feita" && a.situacao !== "Declinada" && (a.tipo === "Reunião" ? (a.iniD || a.fimD) : a.fimD) === hj && rows.some(r => r.p.id === a.projetoId && r.c.ativo)).sort((a, b) => (a.iniH || a.fimH || "99").localeCompare(b.iniH || b.fimH || "99"));
    const hojeV = { vazio: !doHoje.length, itens: doHoje.slice(0, 6).map(a => ({ h: a.iniH || a.fimH || "Hoje", t: a.titulo, s: a.empresa + " · " + a.resp.split(" ")[0], onClick: () => E && E.abrir("verAtividade", "p:" + a.id) })) };
    const glL = base.filter(FLT.golive).sort((a, b) => a.c.dPrazo - b.c.dPrazo);
    const glMes = base.filter(r => r.p.tipo === "implantacao" && r.c.dPrazo <= 30 && r.c.dPrazo >= -3).length, glTot = Math.max(glMes, glL.length), glPct = glTot ? Math.round(glL.length / glTot * 100) : 0;
    const gl = { n: String(glL.length), total: String(glTot), pct: String(glPct), dash: glPct + " 100", vazio: !glL.length, itens: glL.slice(0, 4).map(r => ({ ini: ini(r.p.empresa), nome: r.p.empresa, quando: r.c.dPrazo <= 0 ? "hoje" : r.c.dPrazo === 1 ? "amanhã" : dm(PR.deIso(r.p.prazo)), onClick: () => this.setState({ drawer: r.p.id }) })) };

    const riscoImp = base.filter(r => r.p.tipo === "implantacao" && (r.c.atraso > 0 || r.c.estado === "bloqueado" || (r.c.dPrazo <= 3 && r.c.pct < 60))), bloq = base.filter(r => r.p.bloqueio), prontos = base.filter(r => r.c.pronto);
    const headline = riscoImp.length ? "Existe" + (riscoImp.length > 1 ? "m " : " ") + riscoImp.length + (riscoImp.length > 1 ? " implantações" : " implantação") + " com risco de atraso" + (prontos.length ? " e " + prontos.length + (prontos.length > 1 ? " onboardings prontos" : " onboarding pronto") + " para handoff." : ".")
      : prontos.length ? prontos.length + (prontos.length > 1 ? " onboardings prontos" : " onboarding pronto") + " para handoff." : "Entrega em dia. Nenhum risco relevante agora.";
    const nxs = S.nx, setNx = (o) => this.setState({ nx: o });
    const sugestoes = () => { const s = []; base.forEach(r => { const pr = proxDe(r); if (r.c.semProx) s.push({ r, t: "Definir próxima ação em " + r.p.empresa }); else if (r.c.atraso > 0 && pr) s.push({ r, t: "Repactuar o prazo de “" + pr.t + "” em " + r.p.empresa }); else if (r.p.bloqueio && r.c.dBloq >= 3) s.push({ r, t: "Cobrar retorno sobre “" + r.p.bloqueio.t + "” · " + r.p.empresa }); }); return s.slice(0, 5); };
    const nx = { headline, botoes: [["Ver riscos de atraso", "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", () => { this.setState({ flt: "atraso" }); setNx({ k: "riscos" }); }], ["Identificar bloqueios", "M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8", () => setNx({ k: "bloq" })], ["Sugerir próximas ações", "M13 2 3 14h9l-1 8 10-12h-9z", () => setNx({ k: "sug" })]].map(([l, d, onClick]) => ({ l, d, onClick })),
      temRes: !!nxs, fechar: () => setNx(null), temAplicar: false, resL: [], resT: "", aplicar: () => {}, aplicarSt: "", aplicarL: "" };
    if (nxs) { const it = (r, t) => ({ t, onClick: () => this.setState({ drawer: r.p.id }) });
      if (nxs.k === "riscos") { nx.resT = riscoImp.length ? riscoImp.length + " implantações em risco" : "Sem risco de atraso nas implantações."; nx.resL = riscoImp.map(r => it(r, r.p.empresa + " · " + (r.c.atraso > 0 ? "atraso de " + r.c.atraso + "d" : r.p.bloqueio ? r.p.bloqueio.t : "prazo em " + r.c.dPrazo + "d com " + r.c.pct + "%"))); }
      if (nxs.k === "bloq") { nx.resT = bloq.length ? bloq.length + " projetos travados" : "Nenhum bloqueio ativo."; nx.resL = bloq.map(r => it(r, r.p.empresa + " · " + r.p.bloqueio.t + (r.c.dBloq ? " (" + r.c.dBloq + "d)" : "") + (r.p.bloqueio.kind === "cliente" ? " · depende do cliente" : " · dependência externa"))); }
      if (nxs.k === "sug") { const sg = sugestoes(); nx.resT = sg.length ? "Sugestões do NEXO" : "Tudo com próxima ação definida."; nx.resL = sg.map(x => it(x.r, x.t)); nx.temAplicar = sg.length > 0; nx.aplicarL = nxs.conf ? "Confirmar: criar " + sg.length + " tarefas" : "Criar " + sg.length + " tarefas";
        nx.aplicarSt = "height:30px;padding:0 12px;border-radius:8px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;color:#fff;background:" + (nxs.conf ? "#d93c1a" : "rgba(255,255,255,.16)");
        nx.aplicar = () => { if (!nxs.conf) return setNx({ k: "sug", conf: true }); const cur = PR.atv().slice();
          sg.forEach((x, i) => { const p = x.r.p, d = isoD(new Date(hoje.getTime() + 864e5)); cur.push({ id: "nx" + Date.now().toString(36) + i, projetoId: p.id, ord: 900 + i, tarefaK: "nx", titulo: x.t, tipo: "Tarefa", area: p.tipo === "onboarding" ? "Onboarding" : "Implantação", situacao: "A fazer", prioridade: "Média", resp: p.resp, assignees: [p.resp], criadoPor: "NEXO", empresa: p.empresa, pessoa: p.pessoa || "", desc: "Sugerida pelo NEXO e confirmada por " + EU + ".", fimD: d, fimH: "", sub: [], comentarios: [], log: [] }); PR.evento(p.id, "NEXO criou tarefa", x.t); });
          E.gravar({ atividadesV2: cur }); diz(sg.length + " tarefas criadas nos projetos · registradas na timeline", "ok"); setNx(null); }; } }

    const dr0 = S.drawer && byId(S.drawer), fmtQ = (iso2) => { const d = new Date(iso2), x = new Date(d); x.setHours(0, 0, 0, 0); const n = Math.round((hoje - x) / 864e5); return n === 0 ? "Hoje" : n === 1 ? "Ontem" : dm(d); };
    let dr = { aberto: false, abertas: [], pessoas: [], timeline: [], links: [] };
    if (dr0) { const p = dr0.p, c = dr0.c, e = c.estado, cl = clienteDe(p), pr = proxDe(dr0);
      const ic = { tel: "M13.8 16.6a1 1 0 0 0 1.2-.3l.4-.5A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.4z", wa: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", mail: "M4 4h16v16H4zM4 7l8 6 8-6" };
      const contato = p.pessoa || "Contato principal";
      dr = { aberto: true, ini: ini(p.empresa), nome: p.empresa, prod: FAM[p.familia], tipo: p.tipo === "onboarding" ? "Onboarding" : "Implantação", est: estL(dr0), pill: pill(e), dotSt: dotS(e), oferta: p.oferta, pct: c.pct,
        barra: "display:block;height:100%;border-radius:9999px;width:" + c.pct + "%;background:" + (e === "pronto" ? "var(--ok)" : c.atraso > 0 ? "var(--err)" : "var(--tx)"),
        temBloq: !!p.bloqueio, bloqT: p.bloqueio ? (p.bloqueio.kind === "cliente" ? "Aguardando cliente" : "Bloqueio externo") : "", bloqS: p.bloqueio ? p.bloqueio.t + (c.dBloq ? " · há " + c.dBloq + " dias" : "") : "", bloqCor: p.bloqueio && p.bloqueio.kind === "cliente" ? "var(--warn)" : "var(--err)", bloqBg: p.bloqueio && p.bloqueio.kind === "cliente" ? "var(--warnbg)" : "var(--errbg)",
        liberar: () => { PR.bloquear(p.id, "", ""); diz("Bloqueio de " + p.empresa + " resolvido", "ok"); },
        proxT: pr ? pr.t : (c.pronto ? "Enviar " + (c.cai ? "para CS" : "para implantação") : "Definir próxima ação"), proxQ: pr && pr.d ? quandoT(pr.d, pr.h) : "sem data", proxCor: pr && pr.d && PR.deIso(pr.d) < hoje ? "var(--err)" : "var(--tx3)",
        resp: p.resp, respIni: ini(p.resp), prazo: c.atraso > 0 ? "Atrasado há " + c.atraso + "d" : "Prazo " + dm(PR.deIso(p.prazo)) + " · " + c.dPrazo + "d", prazoCor: c.atraso > 0 ? "var(--err)" : "var(--tx3)",
        temHandoffInfo: !!(p.handoff && p.handoff.resumo), handoffTxt: p.handoff ? "De " + p.handoff.de + ": " + p.handoff.resumo + (p.handoff.pendencias && p.handoff.pendencias.length ? " Pendências: " + p.handoff.pendencias.join("; ") + "." : "") : "",
        nAbertas: String(c.abertas.length), semAbertas: !c.abertas.length, verAtv: () => E.irPara("/onface-preview/atividades", "Atividades", { projeto: p.id }),
        abertas: c.abertas.slice(0, 4).map(k => { const sp = (k.sub || []).findIndex(s => !s.feita), dd = due(k), late = dd.d && PR.deIso(dd.d) < hoje; return { t: k.titulo, s: (k.sub || []).length ? (k.sub.filter(s => s.feita).length) + "/" + k.sub.length + " subtarefas" + (sp >= 0 ? " · " + k.sub[sp].t : "") : k.tipo, q: dd.d ? quandoT(dd.d, dd.h) : "", qCor: late ? "var(--err)" : "var(--tx3)",
          concluir: () => { PR.setTarefa(k.id, true); diz("Tarefa concluída · Atividades atualizada", "ok"); }, abrir: () => E.abrir("verAtividade", "p:" + k.id) }; }),
        pessoas: [{ nome: contato, cargo: (p.cargo || "Contato") + " · contato principal", ini: ini(contato.replace(/^Dr\.?\s+/, "")), acoes: [["Ligar", ic.tel, () => E.abrirExterno("https://app.callface.ai/calls?call_to=" + encodeURIComponent(contato))], ["WhatsApp", ic.wa, () => E.irPara("/atendimento", "Atendimento", { contato, canal: "WhatsApp" })], ["E-mail", ic.mail, () => E.irPara("/atendimento", "Atendimento", { contato, canal: "E-mail" })]].map(([t, d, onClick]) => ({ t, d, onClick })) }],
        timeline: p.eventos.slice(0, 4).map(x => ({ t: x.t, meta: x.meta, q: fmtQ(x.quando) })),
        links: [cl ? { l: "Cliente 360", onClick: () => E.irPara("/clientes/360", p.empresa, { cliente: cl.id }) } : null, { l: "Empresa", onClick: () => E.irPara("/onface-preview/empresa", p.empresa, cl ? {} : { empresa: p.empresa }) }, p.oppId ? { l: "Oportunidade", onClick: () => E.irPara("/onface-preview/oportunidade", p.empresa, { opp: p.oppId, ver: "" }) } : null].filter(Boolean),
        completo: () => E.irPara("/operacao/projeto", p.empresa, { id: p.id }), completoSt: "flex:1 1 0;height:40px;border-radius:10px;border:0;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;" + (c.pronto ? "background:var(--sf);box-shadow:inset 0 0 0 1px var(--ln);color:var(--tx)" : "background:#d93c1a;color:#fff"),
        pronto: c.pronto, acaoPronL: c.cai ? "Enviar para CS" : "Enviar para implantação", acaoPronto: acaoPronto(dr0), podeAguardar: !p.bloqueio, aguardar: () => { PR.bloquear(p.id, "cliente", "Aguardando retorno do cliente"); diz("Marcado como aguardando cliente", "ok"); } }; }

    const M = S.modal, upM = (o) => this.setState(s => ({ modal: Object.assign({}, s.modal, o, { erro: "" }) })), rM = M && M.id ? byId(M.id) : null;
    let mh = { aberto: false, gate: [], equipe: [], efeitos: [] };
    if (M && (M.k === "handoff" || M.k === "cs") && rM) { const cai = M.k === "cs", p = rM.p;
      mh = { aberto: true, ehCS: cai, ehImp: !cai, destino: cai ? "Customer Success" : "Implantação", titulo: cai ? "Enviar " + p.empresa + " para Customer Success" : "Handoff para implantação", sub: p.empresa + " · " + FAM[p.familia] + " · " + p.oferta,
        gate: cai ? [{ n: "Todas as tarefas do onboarding concluídas" }, { n: "Primeiro valor registrado" }] : (rM.c.gate || []).map(g => ({ n: g.n })), equipe: PR.EQUIPE_IMP, resp: M.resp || "", setResp: (e) => upM({ resp: e.target.value }), data: M.data, setData: (e) => upM({ data: e.target.value }), hora: M.hora, setHora: (e) => upM({ hora: e.target.value }),
        resumo: M.resumo, setResumo: (e) => upM({ resumo: e.target.value }), pend: M.pend, setPend: (e) => upM({ pend: e.target.value }),
        efeitos: ["Cria o projeto de implantação do mesmo serviço, com as tarefas de " + FAM[p.familia], "Preserva o onboarding de origem e todo o contexto coletado", "Registra o handoff na timeline dos dois projetos", (M.resp || "O responsável") + " recebe as tarefas em Atividades", "Primeira reunião entra na agenda em " + (M.data ? M.data.split("-").reverse().slice(0, 2).join("/") : "—") + " às " + (M.hora || "—")],
        temErro: !!M.erro, erro: M.erro, confirmarL: cai ? "Confirmar e enviar para CS" : "Confirmar handoff",
        confirmar: () => { if (cai) { PR.concluirCS(p.id); diz(p.empresa + " enviado para Customer Success · handoff registrado", "ok"); return this.setState({ modal: null, drawer: null }); } if (!M.resp) return upM({ erro: "Defina o responsável da implantação." }); if (!M.data || !M.hora) return upM({ erro: "Informe data e hora da primeira reunião." });
          const imp = PR.handoff(p.id, { resp: M.resp, data: M.data, hora: M.hora, resumo: M.resumo, pendencias: (M.pend || "").split("\n").map(x => x.trim()).filter(Boolean) });
          this.setState({ modal: null, drawer: imp ? imp.id : null }); diz("Handoff feito · implantação de " + p.empresa + " com " + M.resp + " · primeira reunião agendada", "ok"); } }; }
    let mn = { aberto: false, clientes: [], fams: [], fases: [], equipe: [] };
    if (M && M.k === "novo") { const fam = M.familia, jor = PR.jornada(fam, "onboarding"), emp = M.empresa;
      const temPrevDe = (nm, f) => lista.some(x => x.empresa === nm && x.familia === f && x.tipo === "onboarding" && (x.concluido || x.handoffFeito)) || seed.some(c => c.nome === nm && c.produto === f && c.status === "Ativo");
      const prevProj = lista.find(x => x.empresa === emp && x.familia === fam && x.tipo === "onboarding" && (x.concluido || x.handoffFeito)), prevBase = seed.find(c => c.nome === emp && c.produto === fam && c.status === "Ativo");
      const temPrev = !!(emp && (prevProj || prevBase)), nomes = seed.map(c => c.nome).concat(opps.filter(o => o.etapa === "ganho").map(o => o.empresa)).filter((x, i, a) => x && a.indexOf(x) === i).sort();
      const padrao = (k, has) => PR.jornada(k, "onboarding").map(x => x[0]).filter(f => !has || (k === "CALLFACE_AI" ? f === "conf" : f === "form" || f === "passagem"));
      const chip = (on) => "height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;" + (on ? "background:var(--tx);color:var(--sf)" : "background:var(--sf2);box-shadow:inset 0 0 0 1px var(--ln);color:var(--tx2)");
      mn = { aberto: true, clientes: nomes, empresa: emp, setEmpresa: (e) => upM({ empresa: e.target.value, fases: padrao(M.familia, !!e.target.value && temPrevDe(e.target.value, M.familia)) }),
        fams: Object.keys(FAM).map(k => ({ l: FAM[k], st: chip(fam === k), onClick: () => upM({ familia: k, fases: padrao(k, !!emp && temPrevDe(emp, k)) }) })),
        temPrev, famL: FAM[fam], prevTxt: prevProj ? "Concluído no projeto anterior." : "Cliente ativo na base desde " + (prevBase ? prevBase.inicio.split("-").reverse().join("/") : "") + ".",
        fases: jor.map(([k, n]) => { const on = M.fases.indexOf(k) >= 0; return { l: n, st: chip(on), onClick: () => upM({ fases: on ? M.fases.filter(x => x !== k) : M.fases.concat([k]) }) }; }),
        equipe: PR.EQUIPE_ONB, resp: M.resp, setResp: (e) => upM({ resp: e.target.value }), prazo: M.prazo, setPrazo: (e) => upM({ prazo: e.target.value.replace(/\D/g, "") }), temErro: !!M.erro, erro: M.erro,
        criar: () => { if (!emp) return upM({ erro: "Escolha o cliente." }); if (!M.fases.length) return upM({ erro: "Marque ao menos uma tarefa que precise rodar." });
          const o = opps.find(x => x.empresa === emp && x.etapa === "ganho"); const p = PR.criar({ empresa: emp, familia: fam, resp: M.resp, prazoDias: parseInt(M.prazo || "21", 10), fases: M.fases, oppId: o ? o.id : null, pessoa: o ? o.pessoa : "", expansao: temPrev ? { base: FAM[fam], quando: prevBase ? prevBase.inicio : "", itens: FAM[fam] } : null });
          this.setState({ modal: null, drawer: p.id }); diz("Onboarding de " + emp + " criado" + (temPrev ? " · tarefas anteriores reaproveitadas" : ""), "ok"); } }; }

    const inTab = (r) => S.tab === "todos" || r.p.tipo === (S.tab === "onb" ? "onboarding" : "implantacao");
    const tabRows = base.filter(inTab);
    FLT.semprox = r => r.c.semProx;
    const fl = S.flt && FLT[S.flt] ? tabRows.filter(FLT[S.flt]) : tabRows;
    const score = (r) => (r.c.atraso > 0 ? 0 : r.c.pronto ? 1 : r.p.bloqueio ? 2 : 3) * 1000 + r.c.dPrazo + 100;
    const linhasT = fl.slice().sort((a, b) => score(a) - score(b)).map(r => { const p = r.p, c = r.c, e = c.estado, pr = proxDe(r); let px, ps, pc = "var(--tx)";
      if (p.bloqueio) { px = p.bloqueio.t; ps = (p.bloqueio.kind === "cliente" ? "Aguardando cliente" : "Bloqueio externo") + (c.dBloq ? " · há " + c.dBloq + "d" : ""); pc = p.bloqueio.kind === "cliente" ? "var(--warn)" : "var(--err)"; }
      else if (c.pronto) { px = c.cai ? "Enviar para o Customer Success" : "Fazer o handoff"; ps = c.cai ? "Todas as tarefas concluídas" : "Kickoff, material e responsável ok"; pc = "var(--ok)"; }
      else if (pr) { px = pr.t; ps = pr.s + (pr.d ? " · " + quandoT(pr.d, pr.h) : ""); if (pr.d && PR.deIso(pr.d) < hoje) pc = "var(--err)"; }
      else { px = "Sem próxima ação"; ps = "Defina a próxima tarefa"; pc = "var(--err)"; }
      return { nome: p.empresa, ini: ini(p.empresa), sub: p.oferta + (c.herdadas ? " · " + c.herdadas + " reaproveitadas" : ""), prod: FAM[p.familia], tipo: p.tipo === "onboarding" ? "Onboarding" : "Implantação", pct: c.pct, fase: c.faseNome,
        barra: "display:block;height:100%;border-radius:9999px;transition:width .9s cubic-bezier(.16,1,.3,1);width:" + c.pct + "%;background:" + (e === "pronto" ? "var(--ok)" : c.atraso > 0 || e === "bloqueado" ? "var(--err)" : "var(--tx)"),
        prox: px, proxSub: ps, proxSt: "display:block;font-size:13px;font-weight:600;color:" + pc + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis", est: estL(r), pill: pill(e), dotSt: dotS(e), prazo: prazoT(r), prazoCor: c.atraso > 0 ? "var(--err)" : "var(--tx2)", resp: p.resp, respIni: ini(p.resp),
        pronto: c.pronto, acaoPronL: c.cai ? "Enviar para CS" : "Enviar p/ implantação", acaoPronto: (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); acaoPronto(r)(); }, abrir: () => this.setState({ drawer: p.id }),
        wrap: "display:grid;grid-template-columns:minmax(210px,1.5fr) 118px minmax(150px,1fr) minmax(220px,1.6fr) 136px 92px 150px;gap:14px;align-items:center;min-height:62px;padding:8px 18px;cursor:pointer;box-shadow:inset 0 -1px 0 var(--ln)" + (S.drawer === p.id ? ";background:var(--hv)" : "") }; });
    const tabsV = [["todos", "Visão geral", base.length], ["onb", "Onboarding", base.filter(FLT.onb).length], ["imp", "Implantação", base.filter(FLT.imp).length]].map(([k, l, n]) => ({ l, n: String(n), onClick: () => this.setState({ tab: k, flt: null }),
      st: "flex:0 0 auto;display:flex;align-items:center;gap:7px;height:32px;padding:0 13px;border-radius:8px;border:0;cursor:pointer;font-size:13px;white-space:nowrap;" + (S.tab === k ? "background:#fff;color:#12171d;font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:#4a5560;font-weight:500"),
      nSt: "min-width:20px;height:18px;padding:0 6px;border-radius:9999px;display:grid;place-items:center;font-size:10.5px;font-weight:700;" + (S.tab === k ? "background:#fe4f2b;color:#fff" : "background:#e3e5e9;color:#4a5560") }));
    const chipsV = [["Todos", null, tabRows.length, "#8b949e"], ["Em atraso", "atraso", tabRows.filter(FLT.atraso).length, "#ff6a55"], ["Aguardando cliente", "aguard", tabRows.filter(FLT.aguard).length, "#e0b04f"], ["Prontos p/ handoff", "pronto", tabRows.filter(FLT.pronto).length, "#3ecf8e"], ["Go-live na semana", "golive", tabRows.filter(FLT.golive).length, "#3ecf8e"], ["Sem próxima ação", "semprox", tabRows.filter(FLT.semprox).length, "#ff6a55"]]
      .map(([l, k, n, cor]) => { const on = (S.flt || null) === k; return { l, n: String(n), onClick: () => this.setState({ flt: on ? null : k }), dot: "width:7px;height:7px;border-radius:9999px;background:" + cor,
        st: "display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 13px;border-radius:9999px;border:0;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap;" + (on ? "background:var(--tx);color:var(--sf)" : "background:var(--sf);color:var(--tx);box-shadow:inset 0 0 0 1px var(--ln)"), nSt: "font-weight:700;font-variant-numeric:tabular-nums;opacity:" + (on ? 1 : (n ? 1 : .45)) }; });

    return {
      tabs: tabsV, chips: chipsV, tb: { linhas: linhasT, vazio: !linhasT.length },
      tema, f: { q: S.q, setQ: (e) => this.setState({ q: e.target.value }), fam: S.fam, setFam: (e) => this.setState({ fam: e.target.value }), resp: S.resp, setResp: (e) => this.setState({ resp: e.target.value }), equipe: equipeTodos,
        ativo: S.fam !== "todos" || S.resp !== "todos" || !!S.flt || !!qq, limpar: () => this.setState({ fam: "todos", resp: "todos", flt: null, q: "", obF: "todos", imF: "todos" }) },
      acoes: { novo: () => this.setState({ modal: { k: "novo", empresa: "", familia: "CALLFACE_AI", fases: PR.jornada("CALLFACE_AI", "onboarding").map(x => x[0]), resp: PR.EQUIPE_ONB[0], prazo: "21", erro: "" } }) },
      kpis, ws: [Object.assign(wsOnb, { mostraVer: S.tab === "todos", verTodos: () => this.setState({ tab: "onb", flt: null }), d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4l3 2", icoSt: "flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:#fff6f4;color:#c2330f;box-shadow:inset 0 0 0 1px #f6d9cf" }), Object.assign(wsImp, { mostraVer: S.tab === "todos", verTodos: () => this.setState({ tab: "imp", flt: null }), d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z", icoSt: "flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--sf2);color:var(--tx);box-shadow:inset 0 0 0 1px var(--ln)" })].filter((w, i) => S.tab === "todos" || (S.tab === "onb" ? i === 0 : i === 1)), at, hoje: hojeV, gl, nx, dr, mh, mn, ir: { agenda: () => E && E.irPara("/onface-preview/atividades", "Atividades") },
      fechar: () => this.setState({ modal: null }), fecharDr: () => this.setState({ drawer: null }), parar: (e) => e.stopPropagation()
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <OnboardingDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as OnboardingLiga };
