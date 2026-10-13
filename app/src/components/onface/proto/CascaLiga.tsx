// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Casca — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * CascaDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `CascaDesenho.tsx`, convertido por máquina e intocável.
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

import { CascaDesenho } from "./CascaDesenho";
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

  constructor(props) {
    super(props);
    const E = null as any; // o store só existe depois do construtor
    const d: any = this.props.dados ?? {};
    this.state = {
      aberta: props.menuAberto !== undefined ? props.menuAberto !== false : d.menuAberto !== false,
      exp: d.menuGrupos || { Vendas: true, "Operação": false, Clientes: false, "Automações": false, Insights: false },
      leads: d.leads || [],
      perfilAberto: false,
      sinoAberto: false, filtroSino: "todas",
      buscaAberta: false, termo: "", idx: 0, achados: null,
      qaAberto: false, nexoAberto: false, nexoAba: null, nexoConversa: "c0", nexoRascunho: "", nexoPensando: false,
      nexoMsgs: {
        c0: [{ de: "oni", texto: "Bom dia, Scott. Olhei a sua carteira de pré-vendas agora: 5 leads estão sem próxima ação e 2 entraram hoje sem responsável." },
             { de: "oni", insight: true, rotulo: "PRIORIDADE DE HOJE", texto: "Três leads passaram do tempo de primeiro contato:", itens: ["Cliniface Saúde — 6 dias sem contato, sem responsável", "Braspar Distribuidora — 9 dias parado, sem próxima ação", "Sollar Imóveis — 14 dias em qualificação"], acoes: [{ label: "Atribuir a mim", tom: "primario" }, { label: "Criar atividades", tom: "" }] }]
      },
      aviso: null
    };
    this.buscaRef = React.createRef();
  }

  componentDidMount() {
    this._rsz = () => { const w = (typeof window !== "undefined" ? window.innerWidth : 1440); if (w !== this.state.larg) this.setState({ larg: w, menuMob: w < 768 ? this.state.menuMob : false }); };
    this._rsz();
    window.addEventListener("resize", this._rsz);
    this._ultimo = { aberta: this.state.aberta, exp: this.state.exp };
    const E = this.E;
    this._offEstado = E ? E.assinar((d) => { if (d.leads !== this.state.leads) this.setState({ leads: d.leads }); }) : null;
    this._offAviso = E ? E.assinarAviso((texto, tom) => this.diz(texto, tom)) : null;
    this._k = (e) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "b") { e.preventDefault(); this.setState(s => ({ aberta: !s.aberta })); }
      else if (cmd && e.key.toLowerCase() === "k") { e.preventDefault(); this.abrirBusca(); }
      else if (cmd && e.key.toLowerCase() === "j") { e.preventDefault(); this.setState(s => ({ nexoAberto: !s.nexoAberto })); }
      else if (e.key === "Escape") {
        if (this.state.buscaAberta) return this.setState({ buscaAberta: false });
        if (this.state.nexoAberto) return this.setState({ nexoAberto: false });
        if (this.state.perfilAberto || this.state.sinoAberto) this.setState({ perfilAberto: false, sinoAberto: false });
      }
    };
    document.addEventListener("keydown", this._k);
    this._fora = (e) => {
      const alvo = e.target;
      const dentro = (sel) => alvo && alvo.closest && alvo.closest(sel);
      const mudar = {};
      if (this.state.perfilAberto && !dentro("[data-of-perfil]")) mudar.perfilAberto = false;
      if (this.state.sinoAberto && !dentro("[data-of-sino]")) mudar.sinoAberto = false;
      if (Object.keys(mudar).length) this.setState(mudar);
    };
    document.addEventListener("pointerdown", this._fora, true);
  }

  componentDidUpdate() {
    const anterior = this._ultimo || { aberta: this.state.aberta, exp: this.state.exp };
    this._ultimo = { aberta: this.state.aberta, exp: this.state.exp };
    if (anterior.aberta !== this.state.aberta || anterior.exp !== this.state.exp) {
      const E = this.E;
      if (E) E.gravar({ menuAberto: this.state.aberta, menuGrupos: this.state.exp });
    }
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this._rsz);
    document.removeEventListener("keydown", this._k);
    document.removeEventListener("pointerdown", this._fora, true);
    if (this._offEstado) this._offEstado();
    if (this._offAviso) this._offAviso();
    clearTimeout(this._t);
    clearTimeout(this._nx);
    clearTimeout(this._bq);
  }

  diz(texto, tom) {
    clearTimeout(this._t);
    this.setState({ aviso: { texto, tom: tom || "ok" } });
    this._t = setTimeout(() => this.setState({ aviso: null }), 3400);
  }

  /* Registros na paleta: pessoa, empresa, negócio e proposta vêm de
     /api/busca-global (escopo da sessão). Debounce curto e descarta resposta
     de termo que já mudou, senão a lista pisca com o resultado velho. */
  buscarRegistros(termo) {
    clearTimeout(this._bq);
    const q = termo.trim();
    if (q.length < 2) return this.setState({ achados: null });
    this._bq = setTimeout(async () => {
      try {
        const r = await fetch("/api/busca-global?q=" + encodeURIComponent(q), { credentials: "same-origin" });
        const j = r.ok ? await r.json() : null;
        if (this.state.termo.trim() === q) this.setState({ achados: j });
      } catch { /* sem rede: a paleta segue só com destinos */ }
    }, 220);
  }

  abrirBusca() {
    this.setState({ buscaAberta: true, termo: "", idx: 0, achados: null, perfilAberto: false, sinoAberto: false },
      () => { if (this.buscaRef.current) this.buscaRef.current.focus(); });
  }

  itensBusca() {
    const nav = [];
    this.arvore().forEach(m => {
      nav.push({ label: m.label, href: m.href, tag: "" });
      (m.filhos || []).forEach(f => nav.push({ label: m.label + " › " + f.label, href: f.href, tag: f.pendente ? "em construção" : "" }));
    });
    const dNav = "M9 18l6-6-6-6";
    const dAcao = "M12 5v14M5 12h14";
    const grupos = [
      { titulo: "Ações", itens: [
        { label: "Novo lead", d: dAcao, acao: () => { this.setState({ buscaAberta: false }); this.diz("Novo lead — formulário a desenhar", "aviso"); } },
        { label: "Nova oportunidade", d: dAcao, acao: () => { this.setState({ buscaAberta: false }); this.diz("Criar oportunidade — tela a desenhar", "aviso"); } },
        { label: "Nova proposta", d: dAcao, acao: () => { this.setState({ buscaAberta: false }); this.diz("Criar proposta — tela a desenhar", "aviso"); } },
        { label: "Nova atividade", d: dAcao, acao: () => { this.setState({ buscaAberta: false }); this.diz("Criar atividade — tela a desenhar", "aviso"); } }
      ] },
      { titulo: "Ir para", itens: nav.map(n => ({
        label: n.label, d: dNav, tag: n.tag,
        acao: () => { this.setState({ buscaAberta: false }); this.ir(n.href, n.label); }
      })) }
    ];
    const q = this.state.termo.trim().toLowerCase();
    const A = this.state.achados;
    const dReg = "M9 18l6-6-6-6";
    const registros = A ? [["Pessoas", A.pessoas], ["Empresas", A.empresas], ["Negócios", A.negocios], ["Propostas", A.propostas]]
      .filter(([, l]) => l && l.length)
      .map(([titulo, l]) => ({ titulo, itens: l.map(r => ({
        /* Pessoa e empresa chegam com a classe da função única (classeRotulo):
           a paleta só a mostra, não deriva nada. Negócio e proposta não têm classe. */
        label: r.nome, d: dReg, tag: [r.classeRotulo, r.apoio].filter(Boolean).join(" · "),
        acao: () => { this.setState({ buscaAberta: false }); this.ir(r.href, r.nome); }
      })) })) : [];
    if (!q) return grupos.map(g => ({ titulo: g.titulo, itens: g.itens.slice(0, g.titulo === "Ações" ? 4 : 6) }));
    return grupos
      .map(g => ({ titulo: g.titulo, itens: g.itens.filter(i => i.label.toLowerCase().includes(q)) }))
      .filter(g => g.itens.length)
      .concat(registros);
  }

  montarRadar(modo) {
    const mes = modo === "mes";
    const meta = mes ? 48 : 12;
    const feito = mes ? 34 : 9;
    const pilhaBruta = mes
      ? [["Camila Reis", 14, "#fe4f2b"], ["Diego Nunes", 12, "#12171d"], ["Ana Vitória", 8, "#7f8b95"]]
      : [["Camila Reis", 4, "#fe4f2b"], ["Diego Nunes", 3, "#12171d"], ["Ana Vitória", 2, "#7f8b95"]];

    const N = 32, cx = 110, cy = 100, rExt = 86, rInt = 72;
    const segmentos = [];
    const preenchidos = Math.round((feito / meta) * N);
    let acum = 0;
    const faixas = pilhaBruta.map(([, v, cor], i) => {
      const ultimo = i === pilhaBruta.length - 1;
      const qtd = ultimo ? Math.max(0, preenchidos - acum) : Math.round((v / meta) * N);
      const fx = { ini: acum, fim: acum + qtd, cor };
      acum += qtd;
      return fx;
    });
    for (let i = 0; i < N; i++) {
      const ang = Math.PI - (i + 0.5) * (Math.PI / N);
      void ang;
      const c = Math.cos(ang), s = Math.sin(ang);
      const faixa = faixas.find(fx => i >= fx.ini && i < fx.fim);
      segmentos.push({
        x1: +(cx + rInt * c).toFixed(1), y1: +(cy - rInt * s).toFixed(1),
        x2: +(cx + rExt * c).toFixed(1), y2: +(cy - rExt * s).toFixed(1),
        cor: faixa ? faixa.cor : "#e8eaeb"
      });
    }

    const x0 = 36, xF = 516, yTopo = 22, yBase = 174;
    const teto = Math.ceil(meta * 1.1);
    const esc = (v) => +(yBase - (v / teto) * (yBase - yTopo)).toFixed(1);
    const px = (t) => +(x0 + t * (xF - x0)).toFixed(1);

    const marcosDef = mes
      ? [["S1", 12], ["S2", 24], ["S3", 36], ["S4", 48]]
      : [["seg", 2.4], ["ter", 4.8], ["qua", 7.2], ["qui", 9.6], ["sex", 12]];
    const nM = marcosDef.length;

    let metaLinha = "", metaArea = "M " + x0 + " " + yBase;
    marcosDef.forEach(([, v], i) => {
      const xa = px(i / nM), xb = px((i + 1) / nM), y = esc(v);
      metaLinha += (i === 0 ? "M " + xa + " " + y : " L " + xa + " " + y) + " L " + xb + " " + y;
      metaArea += " L " + xa + " " + y + " L " + xb + " " + y;
    });
    metaArea += " L " + xF + " " + yBase + " Z";

    const diario = mes
      ? [1, 2, 4, 5, 7, 9, 10, 12, 13, 15, 17, 19, 20, 22, 24, 26, 28, 30, 32, 34]
      : [2, 4, 5, 7, 9];
    const nD = diario.length;
    const pts = diario.map((v, i) => [px((i + 1) / nD), esc(v)]);
    const realLinha = pts.map((p, i) => (i === 0 ? "M " + px(0) + " " + esc(0) + " L " : "L ") + p[0] + " " + p[1]).join(" ");
    const realArea = realLinha + " L " + pts[nD - 1][0] + " " + yBase + " L " + px(0) + " " + yBase + " Z";

    const passos = [0, Math.round(teto / 3), Math.round((teto / 3) * 2), teto];
    const iniciais = (n) => n.split(" ").slice(0, 2).map(p => [...p][0]).join("").toUpperCase();
    const ritmo = feito / meta;
    const esperado = mes ? 0.75 : 0.8;

    return {
      kpis: [
        { label: "QUALIFICADOS", valor: String(feito), delta: (ritmo >= esperado ? "+" : "−") + Math.abs(Math.round((ritmo - esperado) * 100)) + " p.p.",
          ok: ritmo >= esperado, nota: "meta de " + meta + (mes ? " no mês" : " na semana") },
        { label: "1º CONTATO", valor: mes ? "3h12" : "2h48", delta: "−26%", ok: true, nota: "mediana até o primeiro toque" },
        { label: "CONVERSÃO", valor: mes ? "31%" : "34%", delta: "+4 p.p.", ok: true, nota: "lead → oportunidade" }
      ].map(k => Object.assign({}, k, {
        delta: (k.delta.indexOf("−") === 0 ? "↓ " : "↑ ") + k.delta.replace("+", "").replace("−", ""),
        deltaStyle: "font-size:11.5px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums;color:" + (k.ok ? "#1f7256" : "#c2330f")
      })),
      arco: {
        rotulo: mes ? "META DO MÊS · RESPONSÁVEIS" : "META DA SEMANA · RESPONSÁVEIS",
        segmentos,
        pct: Math.round(ritmo * 100) + "%",
        sub: feito + " de " + meta + " qualificados",
        pilha: pilhaBruta.map(([nome, v, cor]) => ({
          nome, valor: v, iniciais: avatarDe(nome, iniciais(nome)),
          share: Math.round((v / feito) * 100) + "%",
          chipStyle: "flex:0 0 auto;width:9px;height:9px;border-radius:3px;background:" + cor
        }))
      },
      degrau: {
        rotulo: mes ? "RITMO CONTRA A META" : "RITMO CONTRA A META",
        grade: passos.map(v => ({
          y: esc(v), label: String(v),
          style: "position:absolute;right:" + (100 - (30 / 520) * 100).toFixed(2) + "%;top:" + ((esc(v) / 210) * 100).toFixed(2)
            + "%;transform:translateY(-50%);font-size:10px;color:#4a5560;white-space:nowrap;pointer-events:none;font-variant-numeric:tabular-nums"
        })),
        metaLinha, metaArea, realLinha, realArea,
        pontaX: pts[nD - 1][0], pontaY: pts[nD - 1][1],
        marcos: marcosDef.map(([label], i) => ({
          label,
          style: "position:absolute;left:" + ((px((i + 0.5) / nM) / 520) * 100).toFixed(2) + "%;top:" + ((198 / 210) * 100).toFixed(2)
            + "%;transform:translate(-50%,-50%);font-size:10px;color:#4a5560;white-space:nowrap;pointer-events:none"
        })),
        nota: ritmo >= esperado
          ? "Você está acima do degrau — mantendo esse ritmo fecha " + Math.round(feito / (mes ? 0.75 : 0.8)) + " qualificados."
          : "O realizado caiu abaixo do degrau desde a " + (mes ? "terceira semana" : "quarta-feira") + ". Faltam " + (meta - feito) + " para bater a meta."
      },
      sinais: [
        { texto: "Cliniface Saúde e Braspar estão sem responsável há mais de 5 dias — são os dois maiores tickets parados.", acao: "Atribuir", tom: "urgente" },
        { texto: "Leads de Meta Ads convertem 2,1× mais que os de formulário, mas recebem o primeiro contato 4h depois.", acao: "Ver recorte", tom: "" },
        { texto: "A etapa Em contato acumulou " + this.state.leads.filter(L => L.etapa === "em_contato").length + " leads sem tarefa aberta.", acao: "Abrir", tom: "" }
      ].map((s, i) => ({
        texto: s.texto, acao: s.acao,
        linhaStyle: "display:flex;align-items:center;gap:10px;min-width:0;padding:11px 0;"
          + (i === 0 ? "" : "border-top:1px solid #f3f5f5"),
        pontoStyle: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + (s.tom === "urgente" ? "#fe4f2b" : "#c8ccc9"),
        onClick: () => this.diz("Recorte aberto a partir do radar do NEXO", "ok")
      }))
    };
  }

  arvore() {
    return [
      { label: "Início", d: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z", href: "/onface-preview/visao-geral" },
      { label: "Vendas", d: "M16 20V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v14M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z", href: "/vendas", filhos: [
        { label: "Pré-vendas", href: "/onface-preview/pre-vendas" },
        { label: "Pipeline", href: "/onface-preview/pipeline" },
        { label: "Propostas", href: "/onface-preview/propostas" },
        { label: "Prospecção", href: "/onface-preview/prospeccao" },
        { label: "Contatos & Empresas", href: "/onface-preview/contatos" }
      ] },
      { label: "Operação", d: "m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8", href: "/onface-preview/atividades", filhos: [
        { label: "Onboarding & Implantação", href: "/operacao/onboarding" },
        { label: "Customer Success", href: "/clientes/cs" }
      ] },
      { label: "Clientes", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.9", href: "/clientes", filhos: [
        { label: "Visão Geral", href: "/clientes" }
      ] },
      { grupo: "INTELIGÊNCIA", label: "Automações", d: "M4 14h7l-1 7 10-11h-7l1-7z", href: "/automacoes", filhos: [
        { label: "Visão Geral", href: "/automacoes" },
        { label: "Fluxos", href: "/automacoes/fluxos", pendente: true },
        { label: "Cadências / Follow-ups", href: "/automacoes/cadencias" },
        { label: "NEXO / Agentes IA", href: "/automacoes/agentes" },
        { label: "Execuções", href: "/automacoes/execucoes" }
      ] },
      { label: "Insights", d: "M3 3v18h18M18 17V9M13 17V5M8 17v-3", href: "/relatorios", filhos: [
        { label: "Visão Geral", href: "/relatorios" },
        { label: "Relatórios", href: "/relatorios/biblioteca", pendente: true },
        { label: "Performance", href: "/relatorios/performance", pendente: true }
      ] }
    ];
  }

  area(href) {
    if (href === "/onface-preview/empresa") href = "/onface-preview/pre-vendas";
    const pares = [];
    this.arvore().forEach(m => {
      pares.push({ href: m.href, area: m.label });
      (m.filhos || []).forEach(f => pares.push({ href: f.href, area: m.label }));
    });
    pares.sort((a, b) => b.href.length - a.href.length);
    const hit = pares.find(p => href === p.href || href.startsWith(p.href + "/"));
    return hit ? hit.area : null;
  }

  ir(href, label) {
    const E = this.E;
    if (E) E.irPara(href, label);
    else this.diz('"' + label + '" ainda não foi desenhada — em construção', "aviso");
  }

  renderVals() {
    const S = this.state;
    const rota = this.props.rota || "/onface-preview/pre-vendas";
    const ativa = this.area(rota);
    const navBase = "display:flex;align-items:center;gap:11px;padding:7px 9px;border-radius:8px;font-size:13.5px;font-weight:500;width:100%;white-space:nowrap;";
    const mob = (S.larg || 1440) < 768;
    const abertaV = mob || S.aberta;
    const largura = mob ? 280 : abertaV ? 226 : 52;
    const areas = this.arvore().map(m => {
      const on = ativa === m.label;
      // "Em breve": sem submenu e sem navegação; o selo vem de casca-em-breve.css
      // pelo title (= label). O código das páginas fica; só o acesso é sinalizado.
      const emBreve = !!m.emBreve;
      const temFilhos = !emBreve && !!(m.filhos && m.filhos.length);
      const expandido = abertaV && temFilhos && !!S.exp[m.label];
      return {
        label: m.label, d: m.d, temFilhos: temFilhos && abertaV, expandido,
        grupo: abertaV ? (m.grupo || "") : "",
        grupoStyle: "font-size:10.5px;font-weight:600;letter-spacing:.09em;color:#7e8894;padding:15px 9px 6px;white-space:nowrap",
        emBreve,
        style: navBase + (emBreve ? "color:#8b95a1;cursor:default" : on ? "background:#1f2833;color:#eeeff3;font-weight:600" : "color:#b9c1ca") + (abertaV ? "" : ";justify-content:center;padding:7px 0"),
        chevron: "flex:0 0 auto;color:#7e8894;transition:transform .14s cubic-bezier(.2,0,.2,1);transform:rotate(" + (expandido ? 0 : -90) + "deg)",
        acionar: () => {
          if (emBreve) this.diz(m.label + " fica pronta em breve", "aviso");
          else if (temFilhos && abertaV) this.setState(s => ({ exp: Object.assign({}, s.exp, { [m.label]: !s.exp[m.label] }) }));
          else this.ir(m.href, m.label);
        },
        filhos: (m.filhos || []).map(f => ({
          label: f.label, pendente: !!f.pendente,
          style: "display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:7px;font-size:12.5px;width:100%;"
            + ((rota === f.href || ((rota === "/onface-preview/empresa" || rota === "/onface-preview/pessoa") && f.href === "/onface-preview/contatos")) ? "color:#eeeff3;font-weight:600;background:#1a222c" : "color:#9aa4ae;font-weight:400"),
          ir: () => this.ir(f.href, f.label)
        }))
      };
    });

    const gruposBusca = this.itensBusca();
    const planos = [];
    gruposBusca.forEach(g => g.itens.forEach(i => { i.pos = planos.length; planos.push(i); }));
    const trilha = (this.props.trilha || []).map(t => ({
      label: t.label,
      ir: t.ir || (() => {}),
      style: "border:0;background:transparent;padding:0;font-family:'Plus Jakarta Sans',sans-serif;font-size:14.5px;font-weight:700;letter-spacing:-.01em;color:#4a5560;white-space:nowrap;cursor:pointer;flex:0 0 auto"
    }));

    return {
      titulo: this.props.titulo || "OnFace",
      subtitulo: this.props.subtitulo || "",
      temSubtitulo: !!this.props.subtitulo,
      trilha,
      aberta: abertaV, fechada: !abertaV,
      railStyle: "flex:0 0 auto;width:" + largura + "px;height:100%;min-height:0;display:flex;flex-direction:column;padding:8px;overflow:hidden;transition:width .16s cubic-bezier(.2,0,.2,1)",
      criarStyle: "display:flex;align-items:center;gap:9px;margin-top:12px;height:34px;border-radius:9px;border:0;cursor:pointer;background:" + (/atendimento/.test(this.props.rota || "") ? "#c2330f" : "#d93c1a") + ";color:#fff;font-size:13.5px;font-weight:600;flex:0 0 auto;"
        + (abertaV ? "padding:0 12px" : "justify-content:center;padding:0"),
      perfilStyle: "display:flex;align-items:center;gap:9px;padding:7px;border-radius:9px;flex:0 0 auto;margin-top:6px;" + (abertaV ? "" : "justify-content:center"),
      areas,
      toggleRail: () => mob ? this.setState(s => ({ menuMob: !s.menuMob })) : this.setState(s => ({ aberta: !s.aberta })),
      menuMob: mob && S.menuMob ? "1" : "0",
      fecharMenuMob: () => this.setState({ menuMob: false }),
      criar: () => this.ir("/atendimento", "Atendimento"),
      qa: (() => { const on = !!S.qaAberto, rota = this.props.rota || "";
        const IT = [["Atendimento", "Conversas e fila de clientes", "/atendimento", "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z", "3"],
          ["Atividades", "Seu dia, foco e timeline", "/onface-preview/atividades", "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", ""],
          ["Calendário", "Reuniões e compromissos", "/calendario", "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", ""]];
        return { alternar: () => this.setState(s2 => ({ qaAberto: !s2.qaAberto })),
          chev: "flex:0 0 auto;opacity:.85;transition:transform .28s cubic-bezier(.16,1,.3,1);transform:rotate(" + (on ? 180 : 0) + "deg)",
          /* Fechado, o painel some por `0fr` + `opacity:0` — mas continuava
             `visible`, com `pointer-events:auto` e `tabIndex:0`. Resultado
             medido em 06/10: os três botões invisíveis do Acesso rápido ficavam
             EM CIMA de Início, Vendas e Pipeline (mesmas coordenadas), comendo
             o clique do menu, e o Tab levava o foco para botão que ninguém vê.
             `pointer-events:none` devolve o clique ao menu; `visibility:hidden`
             tira do foco e do leitor de tela — e, por ser transicionável, não
             atrapalha a animação de abertura. */
          wrap: "display:grid;grid-template-rows:" + (on ? "1fr" : "0fr") + ";transition:grid-template-rows .32s cubic-bezier(.16,1,.3,1),opacity .2s ease,visibility .2s;opacity:" + (on ? 1 : 0) + ";" + (on ? "" : "pointer-events:none;visibility:hidden"),
          painel: "display:flex;flex-direction:column;gap:2px;margin-top:6px;padding:4px;border-radius:11px;background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)",
          itens: IT.map(([l, s2, href, d, n], i) => { const at = rota === href || (href === "/atendimento" && /atendimento/.test(rota));
            return { l, s: s2, d, n, temN: !!n, onClick: () => { this.setState({ qaAberto: false }); this.ir(href, l); },
              nStyle: "flex:0 0 auto;min-width:20px;height:18px;padding:0 6px;border-radius:9999px;background:#fe4f2b;color:#fff;font-size:10.5px;font-weight:700;display:grid;place-items:center",
              ico: "flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;" + (at ? "background:#fe4f2b;color:#fff" : "background:rgba(255,255,255,.07);color:#e7eaec"),
              style: "display:flex;align-items:center;gap:10px;width:100%;padding:" + (abertaV ? "6px 8px 6px 6px" : "6px 0;justify-content:center") + ";border-radius:8px;border:0;cursor:pointer;text-align:left;background:" + (at ? "rgba(255,255,255,.07)" : "transparent") + ";transition:background-color .15s ease,transform .32s cubic-bezier(.16,1,.3,1),opacity .28s ease;transition-delay:0s," + (on ? i * 45 : 0) + "ms," + (on ? i * 45 : 0) + "ms;transform:translateY(" + (on ? 0 : -6) + "px);opacity:" + (on ? 1 : 0) }; }) }; })(),

      perfilAberto: S.perfilAberto,
      togglePerfil: () => this.setState(s => ({ perfilAberto: !s.perfilAberto })),
      perfilBtnStyle: "display:flex;align-items:center;gap:8px;height:34px;padding:0 7px 0 3px;border-radius:9px;"
        + (S.perfilAberto ? "background:#f1f3f3" : ""),
      perfilChevron: "flex:0 0 auto;transition:transform .13s cubic-bezier(.2,0,.2,1);transform:rotate(" + (S.perfilAberto ? 180 : 0) + "deg)",

      itensPerfil: [
        { label: "Minha conta", rota: "/perfil", d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0", atalho: "" },
        { label: "Ajustes", rota: "/ajustes", d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z", atalho: "" }
      ].map(m => Object.assign({}, m, {
        /* As duas telas EXISTEM (/perfil e /ajustes). O protótipo respondia
           '"Minha conta" ainda não foi desenhada' e não ia a lugar nenhum. */
        onClick: () => { this.setState({ perfilAberto: false }); this.props.navegar?.(m.rota); }
      })),

      /* Sair tem que sair. Antes só mostrava o aviso "Encerrar sessão" e a
         pessoa seguia logada achando que tinha saído. O adaptador liga isto ao
         signOut do NextAuth (CascaProto). */
      sair: () => { this.setState({ perfilAberto: false }); this.props.sair?.(); },

      buscar: () => this.abrirBusca(),
      buscaAberta: S.buscaAberta, buscaRef: this.buscaRef,
      fecharBusca: () => this.setState({ buscaAberta: false }),
      termo: S.termo,
      setTermo: (e) => { const t = e.target.value; this.setState({ termo: t, idx: 0 }); this.buscarRegistros(t); },
      gruposBusca: gruposBusca.map(g => ({
        titulo: g.titulo,
        itens: g.itens.map(i => ({
          label: i.label, d: i.d, tag: i.tag || "",
          style: "display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border-radius:6px;"
            + (i.pos === S.idx ? "background:#f1f3f3" : ""),
          onClick: i.acao, onHover: () => this.setState({ idx: i.pos })
        }))
      })),
      teclaBusca: (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); this.setState({ idx: Math.min(planos.length - 1, S.idx + 1) }); }
        else if (e.key === "ArrowUp") { e.preventDefault(); this.setState({ idx: Math.max(0, S.idx - 1) }); }
        else if (e.key === "Enter") { const it = planos[S.idx]; if (it) it.acao(); }
      },
      buscaSemDados: planos.length === 0 || !S.termo.trim(),
      buscaVazioTitulo: S.termo.trim() ? "Nada com esse nome" : "Busque por pessoa, empresa, negócio ou proposta",
      buscaVazioTexto: S.termo.trim()
        ? "Nenhum destino, pessoa, empresa, negócio ou proposta encontrado. Digite ao menos 2 letras."
        : "Digite o nome, e-mail, telefone ou CNPJ. Destinos do menu também aparecem aqui.",

      /* A bolinha vermelha ficava acesa sempre, inclusive com a lista vazia.
         Só acende com não lida de verdade (hoje nada alimenta isto, então ela
         some — que é a verdade). */
      temNotificacao: !!(this.props.naoLidasNotificacao || 0),
      sinoAberto: S.sinoAberto,
      toggleSino: () => this.setState(s => ({ sinoAberto: !s.sinoAberto, perfilAberto: false })),
      sinoBtnStyle: "width:30px;height:30px;border-radius:8px;display:grid;place-items:center;position:relative;color:"
        + (S.sinoAberto ? "#12171d;background:#f1f3f3" : "#5c6672"),
      filtrosSino: [["todas", "Todas"], ["nao_lidas", "Não lidas"], ["nexo", "NEXO"]].map(([k, l]) => ({
        label: l,
        style: "height:26px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:500;white-space:nowrap;flex:0 0 auto;border:1px solid "
          + (S.filtroSino === k ? "#12171d;background:#12171d;color:#fff;font-weight:600" : "#e3e7e8;background:#fff;color:#4a5560"),
        onClick: () => this.setState({ filtroSino: k })
      })),
      sinoVazioTitulo: S.filtroSino === "nexo" ? "O NEXO não agiu ainda" : S.filtroSino === "nao_lidas" ? "Nada não lido" : "Sem notificações",
      sinoVazioTexto: S.filtroSino === "nexo"
        ? "Aqui fica o que os agentes fizeram no seu nome — cada ação com ator AI_AGENT, para você auditar."
        : "Alimentado por eventos e tarefas: lead inbound sem responsável, primeiro contato pendente, retomada de nutrição vencendo, proposta visualizada ou expirando.",
      /* Não existe fila de notificação ligada à casca: dizer "todas marcadas
         como lidas" em verde era avisar que algo aconteceu sem nada acontecer. */
      lerTudo: () => this.diz("A central de notificações ainda não está ligada", "aviso"),
      verTudo: () => { this.setState({ sinoAberto: false }); this.diz("Central de notificações — tela a desenhar", "aviso"); },


      abrirNexo: () => this.setState({ nexoAberto: true }),
      nexoResumo: "3 avisos · 2 insights",
      nexoBtnStyle: "display:flex;align-items:center;gap:9px;flex:0 0 auto;margin-top:8px;padding:8px;border-radius:10px;border:0;cursor:pointer;background:#161d26;box-shadow:inset 0 0 0 1px #242c36;transition:background 120ms cubic-bezier(0,0,.2,1);"
        + (abertaV ? "" : "justify-content:center"),
      nexoMarca: "flex:0 0 auto;width:26px;height:26px;border-radius:8px;background:rgba(254,79,43,.16);box-shadow:inset 0 0 0 1px rgba(255,77,41,.3);display:grid;place-items:center",
      nexo: (() => {
        const conv = S.nexoConversa;
        const msgs = S.nexoMsgs[conv] || [];
        const hist = [
          { id: "c0", titulo: "Prioridades de hoje", quando: "agora" },
          { id: "c1", titulo: "Por que a recusa subiu?", quando: "ontem" },
          { id: "c2", titulo: "Resumo do funil de setembro", quando: "2 dias" },
          { id: "c3", titulo: "Leads sem empresa associada", quando: "4 dias" }
        ];
        const titulos = {};
        hist.forEach(h => { titulos[h.id] = h.titulo; });
        const responder = (pergunta) => {
          const id = S.nexoConversa;
          this.setState(s => {
            const atual = (s.nexoMsgs[id] || []).concat([{ de: "eu", texto: pergunta }]);
            return { nexoMsgs: Object.assign({}, s.nexoMsgs, { [id]: atual }), nexoRascunho: "", nexoPensando: true };
          });
          clearTimeout(this._nx);
    clearTimeout(this._qk);
          this._nx = setTimeout(() => {
            const leads = this.state.leads;
            const semAcao = leads.filter(L => !L.acao && L.etapa !== "desqualificado" && L.etapa !== "nutricao").length;
            const semDono = leads.filter(L => !L.resp).length;
            const resposta = {
              de: "oni",
              texto: "Na pré-vendas agora: " + leads.length + " leads no total, " + semAcao + " sem próxima ação e " + semDono + " sem responsável.",
              itens: ["Maior risco: Sollar Imóveis, 14 dias em qualificação sem atividade", "Melhor chance: Interlagos Frotas, qualificado com proposta a montar", "Gargalo: Em contato acumula leads sem tarefa aberta"],
              acoes: [{ label: "Abrir lista filtrada", tom: "primario" }, { label: "Exportar recorte", tom: "" }]
            };
            this.setState(s => ({
              nexoMsgs: Object.assign({}, s.nexoMsgs, { [id]: (s.nexoMsgs[id] || []).concat([resposta]) }),
              nexoPensando: false
            }));
          }, 900);
        };
        return {
          aberto: S.nexoAberto,
          fechar: () => this.setState({ nexoAberto: false }),
          titulo: S.nexoAba === "mes" ? "Radar do mês · setembro"
            : S.nexoAba === "semana" ? "Radar da semana · 16–22 set"
            : (titulos[conv] || "Nova conversa"),
          contexto: S.nexoAba === "mes" || S.nexoAba === "semana" ? "Scott Ferreira · Pré-vendas" : "Pré-vendas · " + S.leads.length + " leads",
          pensando: S.nexoPensando,
          novaConversa: () => {
            const id = "n" + Date.now();
            this.setState(s => ({ nexoAba: null, nexoConversa: id, nexoMsgs: Object.assign({}, s.nexoMsgs, { [id]: [] }), nexoRascunho: "", nexoPensando: false }));
          },
          ehRadar: S.nexoAba === "mes" || S.nexoAba === "semana",
          ehChat: S.nexoAba !== "mes" && S.nexoAba !== "semana",
          atalhos: [
            { k: "mes", label: "Meu mês", d: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
            { k: "semana", label: "Minha semana", d: "M3 17l5-6 4 4 5-8 4 5" },
            { k: "copiloto", label: "Copiloto", d: "M8 10h8M8 14h5M21 12a9 9 0 1 1-3.6-7.2L21 4l-1 4.5A8.9 8.9 0 0 1 21 12z" }
          ].map(a => {
            const on = a.k === "copiloto" ? (S.nexoAba !== "mes" && S.nexoAba !== "semana") : S.nexoAba === a.k;
            return {
              label: a.label, d: a.d, ativo: on,
              style: "display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border-radius:8px;border:0;cursor:pointer;text-align:left;font-size:12.5px;background:"
                + (on ? "#1f2833;color:#eeeff3;font-weight:600" : "transparent;color:#b9c1ca"),
              onClick: () => this.setState({ nexoAba: a.k === "copiloto" ? null : a.k })
            };
          }),
          radar: this.montarRadar(S.nexoAba === "semana" ? "semana" : "mes"),
          historico: hist.map(h => ({
            titulo: h.titulo, quando: h.quando,
            style: "display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border-radius:8px;border:0;cursor:pointer;text-align:left;background:"
              + (conv === h.id ? "#1f2833;color:#eeeff3" : "transparent;color:#b9c1ca"),
            onClick: () => this.setState({ nexoAba: null, nexoConversa: h.id, nexoPensando: false })
          })),
          mensagens: msgs.map(m => {
            const eu = m.de === "eu";
            return {
              ehOni: !eu, ehInsight: !!m.insight, rotulo: m.rotulo || "",
              texto: m.texto,
              linhaStyle: "display:flex;align-items:flex-start;gap:9px;" + (eu ? "justify-content:flex-end" : ""),
              bolhaStyle: "max-width:84%;min-width:0;padding:10px 13px;border-radius:11px;"
                + (eu ? "background:#12171d" : m.insight ? "background:#fff6f4;box-shadow:inset 0 0 0 1px #fadfd8" : "background:#f6f7f7"),
              textoStyle: "font-size:13px;line-height:1.55;text-wrap:pretty;" + (eu ? "color:#eeeff3" : "color:#1f252c"),
              temItens: !!(m.itens && m.itens.length),
              itens: (m.itens || []).map(t => ({ texto: t })),
              temAcoes: !!(m.acoes && m.acoes.length),
              acoes: (m.acoes || []).map(b => ({
                label: b.label,
                style: "height:28px;padding:0 11px;border-radius:7px;font-size:12px;font-weight:600;white-space:nowrap;flex:0 0 auto;border:0;cursor:pointer;"
                  + (b.tom === "primario" ? "background:#d93c1a;color:#fff" : "background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
                onClick: () => {
                  if (b.label === "Abrir lista filtrada") {
                    this.setState({ nexoAberto: false });
                    if (this.E) this.E.abrir("filtrar-sem-acao", null);
                    return this.diz("Lista filtrada por leads sem próxima ação", "ok");
                  }
                  if (b.label === "Exportar recorte") {
                    this.setState({ nexoAberto: false });
                    if (this.E) this.E.abrir("exportar", null);
                    return;
                  }
                  this.diz("Ação do NEXO registrada com ator AI_AGENT", "ok");
                }
              }))
            };
          }),
          rascunho: S.nexoRascunho,
          setRascunho: (e) => this.setState({ nexoRascunho: e.target.value }),
          tecla: (e) => { if (e.key === "Enter" && S.nexoRascunho.trim()) responder(S.nexoRascunho.trim()); },
          enviar: () => { if (S.nexoRascunho.trim()) responder(S.nexoRascunho.trim()); },
          enviarStyle: "flex:0 0 auto;width:32px;height:32px;border-radius:8px;display:grid;place-items:center;border:0;"
            + (S.nexoRascunho.trim() ? "background:#d93c1a;color:#fff;cursor:pointer" : "background:#f1f3f3;color:#a3a8a4;cursor:not-allowed"),
          sugestoes: [
            "Quem está sem próxima ação?",
            "Leads parados há mais de 7 dias",
            "Onde o funil está travando?"
          ].map(s => ({ label: s, onClick: () => responder(s) }))
        };
      })(),

      temAviso: !!S.aviso,
      aviso: S.aviso ? S.aviso.texto : "",
      avisoPonto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:"
        + (S.aviso && S.aviso.tom === "erro" ? "#fe4f2b" : S.aviso && S.aviso.tom === "aviso" ? "#e0a93d" : "#4fd1a5"),
      parar: (e) => e.stopPropagation()
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <CascaDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as CascaLiga };
