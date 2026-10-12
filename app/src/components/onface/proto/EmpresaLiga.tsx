// @ts-nocheck — lógica portada do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Empresa — a lógica do handoff, portada.
 *
 * GERADO por scripts/dc-logica-para-tsx.mjs a partir de
 * EmpresaDesenho.logica.txt, e depois AJUSTADO à mão onde o dado real entra.
 *
 * O markup vive em `EmpresaDesenho.tsx`, convertido por máquina e intocável.
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
import { abrirUrlExterna } from "@/lib/callface-ligar";
import { toast } from "sonner";
import { mascararTelefone, normalizarE164 } from "@/lib/telefone";

import { EmpresaDesenho } from "./EmpresaDesenho";
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

  state = { aba: "Visão geral", enr: null, tagMenu: false, tagRect: null, tagNova: "", mencao: null, mencaoIdx: 0, visor: null, etapaMenu: false, etapaRect: null, notaAnexos: [], atvFiltro: "todas", excluir: false, excAlvo: "empresa", excMotivo: null, excObs: "", excTentou: false, notaTexto: "", notaAtiva: false, respMenu: false, respRect: null, editando: null, rascunho: {}, maisMenu: false, maisRect: null, chamada: null, agora: 0, apolloCred: null, apolloSalvo: null };

  constructor(props: any) {
    super(props);
    const d: any = props.dados ?? {};
    for (const k of Object.keys(this.state ?? {})) {
      if ((this.state as any)[k] === null && d[k] != null) {
        (this.state as any) = { ...(this.state as any), [k]: d[k] };
      }
    }
  }

  /* Pedido JSON às rotas /api/apollo/*: erro vira Error com mensagem legível (nunca lista vazia silenciosa). */
  async apolloPedir(url, init) {
    let r;
    try {
      r = await fetch(url, Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, init));
    } catch (e) {
      throw new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    }
    const corpo = await r.json().catch(() => null);
    if (!r.ok) throw new Error((corpo && corpo.error) || "Falha ao falar com o servidor (HTTP " + r.status + ")");
    return corpo;
  }

  /* Saldo real do Apollo. Antes: `{ creditos: 48 }` fixo. Sem número inventado: carregando / não configurado / indisponível / erro. */
  async carregarApollo() {
    this.setState({ apolloCred: { estado: "carregando" } });
    try {
      const j = await this.apolloPedir("/api/apollo/credits");
      if (!j.configured) return this.setState({ apolloCred: { estado: "nao_configurado" } });
      if (!j.disponivel) return this.setState({ apolloCred: { estado: "sem_saldo" } });
      this.setState({ apolloCred: { estado: "ok", restantes: j.credits_remaining } });
    } catch (e) {
      this.setState({ apolloCred: { estado: "erro", msg: e.message } });
    }
  }

  /* O que o enriquecimento já gravou na empresa (a ficha não recebe estes campos do servidor). */
  async carregarSalvos() {
    const P = this.fonte();
    const L = (P.leads || []).find(x => x.id === P.leadId) || (P.leads || [])[0] || {};
    if (!L.empresaId) return;
    try {
      const j = await this.apolloPedir("/api/apollo/empresa/" + L.empresaId + "/salvos");
      this.setState({ apolloSalvo: j.campos || {} });
    } catch (e) { /* sem salvos: a ficha segue sem os campos do Apollo */ }
  }

  componentDidMount() {
    /* A relação vem do navegador (store local): só depois de hidratar, senão o servidor e o cliente discordam. */
    this.setState({ hidratado: true });
    this.carregarSalvos();
    const E = this.E;
    const assinar = () => {
      const Es = this.E;
      if (!Es || this._off) return !!this._off;
      this._off = Es.assinar(() => this.setState(s => ({ rev: (s.rev || 0) + 1 })));
      this.setState(s => ({ rev: (s.rev || 0) + 1 }));
      return true;
    };
    if (!assinar()) {
      this._assinarT = setInterval(() => { if (assinar()) clearInterval(this._assinarT); }, 50);
    }
    this._fora = (e) => {
      if (this.state.maisMenu && !(e.target.closest && e.target.closest("[data-of-emais]"))) this.setState({ maisMenu: false });
      if (this.state.respMenu && !(e.target.closest && e.target.closest("[data-of-eresp]"))) this.setState({ respMenu: false });
      if (this.state.etapaMenu && !(e.target.closest && e.target.closest("[data-of-eetapa]"))) this.setState({ etapaMenu: false });
      if (this.state.tagMenu && !(e.target.closest && e.target.closest("[data-of-etag]"))) this.setState({ tagMenu: false });
      const en = this.state.enr;
      if (en && en.menu === "areas" && !(e.target.closest && e.target.closest("[data-of-earea]"))) this.setState({ enr: Object.assign({}, en, { menu: null }) });
      if (en && en.menu === "nivel" && !(e.target.closest && e.target.closest("[data-of-enivel]"))) this.setState({ enr: Object.assign({}, en, { menu: null }) });
    };
    document.addEventListener("pointerdown", this._fora, true);
    this._k = (e) => {
      if (e.key !== "Escape") return;
      if (this.state.maisMenu) return this.setState({ maisMenu: false });
      if (this.state.respMenu) return this.setState({ respMenu: false });
      if (this.state.etapaMenu) return this.setState({ etapaMenu: false });
      if (this.state.tagMenu) return this.setState({ tagMenu: false });
      if (this.state.visor) return this.setState({ visor: null });
      if (this.state.enr) return this.setState({ enr: null });
      if (this.state.editando) return this.setState({ editando: null });
      if (this.state.excluir) return this.setState({ excluir: false });
    };
    window.addEventListener("keydown", this._k);
  }

  componentWillUnmount() {
    clearTimeout(this._enrT); clearInterval(this._enrI); clearInterval(this._assinarT);
    if (this._off) this._off();
    document.removeEventListener("pointerdown", this._fora, true);
    window.removeEventListener("keydown", this._k);
    clearInterval(this._tick);
  }

posFlutuante(r, alto) {
    const vh = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerHeight : 900) : 800;
    if (!r) return "top:120px;max-height:" + (vh - 140) + "px;overflow-y:auto;";
    const abaixo = vh - r.bottom - 12, acima = r.top - 12;
    const cima = abaixo < alto && acima > abaixo;
    const teto = Math.max(160, Math.min(alto, cima ? acima : abaixo));
    return (cima ? "bottom:" + (vh - r.top + 6) + "px;" : "top:" + (r.bottom + 6) + "px;") + "max-height:" + teto + "px;overflow-y:auto;";
  }

  anexoView(a, diz) {
    const src = a.src || (window.__ofArquivos && window.__ofArquivos[a.id]) || "";
    const img = /^image\//.test(a.tipo || "") || /\.(png|jpe?g|gif|webp)$/i.test(a.nome || "");
    return {
      src, img,
      thumbStyle: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;background:#eeeff3 center/cover no-repeat;color:#4a5560;display:grid;place-items:center;font-size:9px;font-weight:700" + (img && src ? ";background-image:url('" + src + "')" : ""),
      extVisivel: img && src ? "" : ((a.nome || "").split(".").pop() || "").slice(0, 4).toUpperCase(),
      abrir: () => {
        if (!src) return diz("Pré-visualização disponível só na sessão em que o arquivo foi enviado", "aviso");
        if (img) return this.setState({ visor: { nome: a.nome, tam: a.tam, src } });
        window.open(src, "_blank");
      }
    };
  }

  empresaDados(nome) {
    const E = this.E;
    const todas = (E && E.ler("empresas", {})) || {};
    return todas[nome] || {};
  }

  gravarEmpresa(nome, patch) {
    if (this.props.persistir) this.props.persistir({ empresa: patch });
    const E = this.E;
    if (!E) return;
    const todas = Object.assign({}, E.ler("empresas", {}));
    todas[nome] = Object.assign({}, todas[nome] || {}, patch);
    E.gravar({ empresas: todas });
  }

  registrarEvento(nome, titulo, autor, d) {
    const X = this.empresaDados(nome);
    const agora = new Date();
    const hh = String(agora.getHours()).padStart(2, "0") + ":" + String(agora.getMinutes()).padStart(2, "0");
    this.gravarEmpresa(nome, { eventos: [{ titulo, autor, quando: "Hoje, " + hh, d, ts: agora.getTime() }].concat(X.eventos || []) });
  }

  gravarLead(id, patch) {
    if (this.props.persistir) this.props.persistir({ lead: patch });
    const E = this.E;
    if (!E) return;
    E.gravar({ leads: (E.ler("leads", []) || []).map(x => x.id === id ? Object.assign({}, x, patch) : x) });
  }

  gravarQual(id, patch) {
    if (this.props.persistir) this.props.persistir({ qual: patch });
    const E = this.E;
    if (!E) return;
    const q = Object.assign({}, E.ler("qual", {}));
    q[id] = Object.assign({}, q[id] || {}, patch);
    E.gravar({ qual: q });
  }

  /* A página não recebe mais props da casca: lê o estado compartilhado e o ?lead= da URL. */
  fonte() {
    const E = this.E;
    const d: any = this.props.dados ?? {};
    const D = this.dadosDoProto || {};
    const leads = E && E.leadsCom ? E.leadsCom(d.leads || D.LEADS || []) : (d.leads || D.LEADS || []);
    const leadId = (E && (E.parametro("registro") || E.parametro("lead"))) || this.props.leadId || (leads[0] || {}).id;
    const alvo = leads.find(x => x.id === leadId) || leads[0] || {};
    const cadencias = d.cadencias || {};
    const qual = d.qual || {};
    return {
      leads, leadId,
      cadencia: Object.prototype.hasOwnProperty.call(cadencias, leadId)
        ? cadencias[leadId]
        : (alvo.registro ? null : (D.cadenciaPadrao ? D.cadenciaPadrao(alvo) : null)),
      porte: (qual[leadId] || {}).tamanho || (alvo.registro ? "" : "45"),
      qualificacao: qual[leadId] || {},
      onVoltar: () => E && E.irPara("/onface-preview/pre-vendas", "Pré-vendas"),
      onQualificar: (id) => E && E.abrir("qualificar", id || leadId),
      onRegistrar: (id) => E && E.abrir("atividade", id || leadId),
      onTrocarCadencia: (id) => E && E.abrir("cadencia", id || leadId),
      onRemoverCadencia: (id) => {
        if (!E) return;
        const c = Object.assign({}, E.tudo().cadencias);
        c[id || leadId] = null;
        E.gravar({ cadencias: c });
        E.avisar("Empresa removida da cadência", "aviso");
      },
      onAbrirLead: (id) => E && E.abrir("detalhe", id || leadId),
      onAviso: (texto, tom) => E && E.avisar(texto, tom)
    };
  }

  renderVals() {
    const P = this.fonte();
    const D = (typeof window !== "undefined" && this.dadosDoProto) || {};
    const leads = P.leads || D.LEADS || [];
    const E = leads.find(x => x.id === P.leadId) || leads[0] || {};
    const diz = P.onAviso || function () {};
    const ini = D.iniciais || ((n) => (n || "").slice(0, 2).toUpperCase());
    const slug = D.slug || ((s) => (s || "").toLowerCase().replace(/[^a-z]/g, ""));
    const etapas = D.ETAPAS || {};
    const segmentos = D.SEGMENTOS || {};

    const S = this.state;
    const nomeEmp = E.empresa || "Sem empresa";
    /* Campos que o Apollo já gravou na empresa (GET /apollo/empresa/:id/salvos) entram por cima. */
    const X = Object.assign({}, this.empresaDados(nomeEmp), S.apolloSalvo || {});
    const dominio = slug(E.empresa || "empresa") + ".com.br";
    /* Sem valores de exemplo: dado real ou "—". Antes, empresa sem registro
       recebia CNPJ, cidade, site, porte e segmento inventados. */
    const seg = X.segmento || E.segmento || segmentos[E.empresa] || "—";
    const porte = P.porte || "";
    const site = X.site || E.site || "—";
    const cnpj = X.cnpj || E.cnpj || "—";
    const cidade = X.cidade || E.cidade || "—";
    const cadE = P.cadencia === undefined ? (E.registro ? null : (D.cadenciaPadrao ? D.cadenciaPadrao(E) : null)) : P.cadencia;
    const qual = P.qualificacao || {};
    const chip = "display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;background:#eeeff3;color:#4a5560;font-size:11.5px;font-weight:600;white-space:nowrap;flex:0 0 auto";

    const ico = {
      wa: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z",
      tel: "M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39",
      mail: "M4 4h16v16H4zM4 7l8 6 8-6"
    };

    const extrasEmp = E.registro ? (((typeof window !== "undefined" && this.E && this.E.ler("contatosExtra", [])) || []).filter(x => x.tipo === "pessoa" && x.emp === E.empresa && x.nome !== E.pessoa).map(x => [x.nome, x.cargo || "", false, x.email || null, x.tel || ""])) : [];
    const pessoas = (E.registro
      ? (E.pessoa && E.pessoa !== "Sem contato" ? [[E.pessoa, E.cargo, true, E.email || null, E.tel || ""]] : []).concat(extrasEmp)
      : [
        [E.pessoa, E.cargo, true, null, "+55 11 91234-5678"],
        ["Ricardo Alves", "Gerente de TI", false, null, "+55 11 99876-5432"],
        ["Juliana Prado", "Gerente de CX", false, null, "+55 11 98765-4321"]
      ]).concat((X.pessoas || []).map(p => [p.nome, p.cargo, false, p.email, p.tel]));
    const nomesP = pessoas.map(p => [...p][0]).filter(Boolean);
    const vincDe = (quem) => nomesP.indexOf(quem) >= 0 ? quem : "Empresa";
    const vincSel = S.vinc || "tudo";
    const vincOk = (v) => vincSel === "tudo" || v === vincSel;
    const vincRotulo = (v) => v === "Empresa" ? "Empresa" : (v || "").replace(/^Dr\.?\s+/, "").split(" ")[0];
    const vincChip = (v) => "display:none";
    const mkVinc = (vs) => [["tudo", "Tudo"], ["Empresa", "Empresa"]].concat(nomesP.map(n => [n, vincRotulo(n)])).map(([k, l]) => {
      const n = k === "tudo" ? vs.length : vs.filter(v => v === k).length;
      const on = vincSel === k;
      return { k, label: l, n: String(n), onClick: () => this.setState({ vinc: k, tlTudo: false }),
        style: "display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12.5px;text-align:left;" + (on ? "background:#eeeff3;color:#12171d;font-weight:600" : "background:transparent;color:#4a5560;font-weight:500"),
        d: k === "tudo" ? "M4 6h16M4 12h16M4 18h16" : k === "Empresa" ? "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01" : "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
        nStyle: "font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;color:" + (on ? "#12171d" : "#8b949e") };
    }).filter(o => o.k === "tudo" || o.k === "Empresa" || o.n !== "0" || o.k === vincSel);
    let tlBase = [];
    const qualIni = qual.interesse ? String(qual.interesse).split("|").filter(Boolean) : [E.interesse].filter(Boolean);
    const tagsAtuais = X.tags || (E.registro ? [] : ((E.tag ? [E.tag] : []).concat([E.interesse, seg.split(" ")[0]])).filter(Boolean));
    const conjunto = X.conjunto !== undefined ? X.conjunto : (E.registro ? "" : (E.campanha ? "Interesse — gestão de atendimento" : ""));
    const criativo = X.criativo !== undefined ? X.criativo : (E.registro ? "" : (E.campanha ? "Vídeo 30s · depoimento de cliente" : "Formulário de contato"));
    const pill = (on) => "height:30px;padding:0 11px;border-radius:9999px;border:0;font-size:12.5px;white-space:nowrap;cursor:pointer;font-weight:"
      + (on ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #dbdede");
    const R = S.rascunho || {};
    const setR = (k, v) => this.setState(s => ({ rascunho: Object.assign({}, s.rascunho, { [k]: v }) }));
    let nCampo = 0;
    const linhaDe = () => "padding:13px 14px 14px;" + (nCampo++ === 0 ? "" : "border-top:1px solid #eef1f1");
    const campoTexto = (k, label, dica, largo, ajuda, masc) => ({
      label, dica: dica || "", ajuda: ajuda || "", ehTexto: true, ehSeg: false, ehChips: false, valor: R[k] || "", opcoes: [],
      linha: linhaDe(), segGrid: "",
      set: (e) => setR(k, masc ? mascararTelefone(e.target.value) : e.target.value)
    });
    const campoOpcoes = (k, label, opcoes, multi, ajuda) => {
      const atual = multi ? (R[k] || []) : R[k];
      const seg = !multi && opcoes.length <= 4;
      return {
        label, dica: "", valor: "", ehTexto: false, ehSeg: seg, ehChips: !seg,
        ajuda: ajuda || (multi ? (atual.length ? atual.length + " selecionado" + (atual.length > 1 ? "s" : "") : "Selecione um ou mais") : ""),
        linha: linhaDe(),
        segGrid: "display:grid;grid-template-columns:repeat(" + opcoes.length + ",minmax(0,1fr));gap:2px;padding:3px;border-radius:9px;background:#eeeff3;height:38px;box-sizing:border-box",
        set: () => {},
        opcoes: opcoes.map(o => {
          const on = multi ? atual.indexOf(o) >= 0 : atual === o;
          return {
            label: o, on,
            segStyle: "display:flex;align-items:center;justify-content:center;min-width:0;height:100%;padding:0 6px;border-radius:7px;border:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;font-weight:"
              + (on ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
            chipStyle: "display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 9px;border-radius:9px;border:0;font-size:12.5px;white-space:nowrap;cursor:pointer;font-weight:"
              + (on ? "600;background:#fff6f4;color:#12171d;box-shadow:inset 0 0 0 1.5px #fe4f2b" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
            caixa: "flex:0 0 auto;width:15px;height:15px;border-radius:4px;display:grid;place-items:center;color:#fff;" + (on ? "background:#fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
            onClick: () => setR(k, multi ? (on ? atual.filter(x => x !== o) : atual.concat(o)) : o)
          };
        })
      };
    };
    const equipe = D.EQUIPE || ["Camila Reis", "Diego Nunes", "Ana Vitória"];
    const todasTags = ["Inbound", "Enterprise", "Fit Alto", "Fit Médio", "Callface AI", "PABX", "White Label", seg.split(" ")[0]].filter((t, i, a) => a.indexOf(t) === i);
    const telas = {
      resumo: { titulo: "Editar resumo da empresa", campos: [
        campoTexto("cnpj", "CNPJ", "00.000.000/0000-00"), campoTexto("porte", "Porte (atendentes)", "45"),
        campoTexto("site", "Site", "https://", true), campoTexto("cidade", "Cidade / UF", "São Paulo / SP"),
        campoTexto("segmento", "Segmento", "Logística e Transporte"),
        campoTexto("funcionarios", "Funcionários", "Ex: 320 · 201–500"), campoTexto("faturamento", "Faturamento anual", "Ex: R$ 50–100 mi"),
        campoTexto("telefone", "Telefone geral", "(11) 0000-0000 ou +1 415 555 0100", false, "", true), campoTexto("linkedin", "LinkedIn", "linkedin.com/company/…"),
        campoTexto("tecnologias", "Tecnologias", "Separe com ·", true)
      ] },
      qualif: { titulo: "Editar qualificação", campos: [
        campoOpcoes("interesse", "Interesse", ["White Label", "Callface AI", "PABX", "Não identificado"], true),
        campoTexto("dor", "Dor principal", "Ex: alto custo com telefonia", true, "O que motivou o contato"),
        campoOpcoes("canal", "Canal preferido", ["Telefone", "WhatsApp", "E-mail"]),
        campoOpcoes("urgencia", "Urgência", ["Baixa", "Média", "Alta"]),
        campoOpcoes("fit", "Fit", ["Alto", "Médio", "Baixo"])
      ] },
      resp: { titulo: "Tags da empresa", campos: [
        campoOpcoes("tags", "Tags", todasTags, true)
      ] },
      origem: { titulo: "Editar origem", campos: [
        campoOpcoes("origem", "Origem", ["Meta Ads", "Instagram", "Site", "Formulário", "WhatsApp", "Orgânica"]),
        campoTexto("campanha", "Campanha", "Nome da campanha", true),
        campoTexto("conjunto", "Conjunto", "Conjunto de anúncios", true),
        campoTexto("criativo", "Criativo", "Criativo", true)
      ] },
      pessoa: { titulo: "Adicionar pessoa", campos: [
        campoTexto("nome", "Nome", "Nome completo", true), campoTexto("cargo", "Cargo", "Ex: Diretora de Operações"),
        campoTexto("tel", "Telefone", "(11) 90000-0000 ou +1 415 555 0100", false, "", true), campoTexto("email", "E-mail", "nome@" + dominio, true)
      ] }
    };
    // "—" é o que a ficha mostra para campo vazio: no formulário viraria valor digitado.
      const abrirEd = (k, inicial) => this.setState({ editando: k, rascunho: Object.fromEntries(Object.entries(inicial).map(([c, x]) => [c, x === "—" ? "" : x])), maisMenu: false });
    const salvar = () => {
      const k = S.editando;
      if (k === "resumo") {
        this.gravarEmpresa(nomeEmp, { cnpj: R.cnpj, site: R.site, cidade: R.cidade, segmento: R.segmento, funcionarios: R.funcionarios || undefined, faturamento: R.faturamento || undefined, telefone: R.telefone || undefined, linkedin: R.linkedin || undefined, tecnologias: R.tecnologias || undefined });
        const n = String(R.porte || "").replace(/[^0-9]/g, "");
        if (n) this.gravarQual(E.id, { tamanho: n });
      }
      if (k === "qualif") this.gravarQual(E.id, { interesse: (R.interesse || []).join("|"), dor: R.dor, canal: R.canal, urgencia: R.urgencia, fit: R.fit });
      if (k === "resp") this.gravarEmpresa(nomeEmp, { tags: R.tags || [] });
      if (k === "origem") { this.gravarLead(E.id, { origem: R.origem, campanha: R.campanha }); this.gravarEmpresa(nomeEmp, { conjunto: R.conjunto, criativo: R.criativo }); }
      if (k === "pessoa") {
        if (!(R.nome || "").trim()) return diz("Informe o nome da pessoa", "erro");
        if (R.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(R.email)) return diz("E-mail inválido", "erro");
        if (R.tel && !normalizarE164(R.tel)) return diz("Telefone inválido", "erro");
        this.gravarEmpresa(nomeEmp, { pessoas: (X.pessoas || []).concat({ nome: R.nome.trim(), cargo: R.cargo || "", tel: R.tel || "—", email: R.email || "" }) });
        this.registrarEvento(nomeEmp, "Pessoa vinculada", R.nome.trim(), "M12 5v14M5 12h14");
        // Sem aviso de sucesso aqui: quem confirma é o adaptador, depois de o servidor responder.
        this.setState({ editando: null });
        return;
      }
      this.setState({ editando: null });
      /* NÃO canta sucesso aqui. Estas edições passam por `gravarEmpresa`, que
         escreve no storage do protótipo (`E.gravar`), não no banco — e o
         adapter (`EmpresaProto.gravar`) responde a verdade: "Editar a empresa
         ainda não está ligado nesta tela". Os dois toasts apareciam juntos e o
         usuário lia primeiro o otimista: digitei no modal, cliquei em Salvar,
         vi "Alterações salvas", e nenhuma requisição saiu (QA 06/10). Quem
         sabe se gravou é o adapter, que já é chamado por `gravarEmpresa`
         logo acima; é dele a mensagem. */
    };
    const ligarCallface = (quem, tel) => {
      let num = String(tel || "").replace(/\D/g, "");
      if (num.length > 11 && num.indexOf("55") === 0) num = num.slice(2);
      if (num.length < 10) return diz((quem || "Contato") + " não tem telefone cadastrado", "erro");
      (this.E ? this.E.abrirExterno("https://app.callface.ai/calls?call_to=" + num) : window.open("https://app.callface.ai/calls?call_to=" + num, "_blank"));
      this.registrarEvento(nomeEmp, "Ligação iniciada no Callface", quem, ico.tel);
      diz("Abrindo o Callface para ligar para " + (quem || "").split(" ")[0], "ok");
    };
    const abrirAtendimento = (canal) => { const Es2 = this.E; if (Es2) Es2.irPara("/atendimento", "Atendimento", { lead: E.id, canal }); };
    const iniciarChamada = (quem) => {
      clearInterval(this._tick);
      this.setState({ chamada: { quem, ini: Date.now() }, agora: Date.now() });
      this._tick = setInterval(() => this.setState({ agora: Date.now() }), 1000);
    };
    const seg2 = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
    const aba = S.aba;
    const abaVisao = aba === "Visão geral";
    const ativos = (P.leads || []).filter(x => x.empresa === E.empresa && x.etapa === "oportunidade");

    return {
      nome: E.empresa || "Sem empresa",
      trilhaTopo: [
        { label: "Contatos & Empresas", ir: () => this.E && this.E.irPara("/onface-preview/contatos", "Contatos & Empresas") }
      ],
      iniciais: ini(E.empresa || E.pessoa),
      etapa: (etapas[E.etapa] || {}).label || "—",
      temEtapaTopo: !E.registro,
      /* Antes: toda empresa "Manual" (E.registro é o id, sempre preenchido). Agora só quando a origem diz manual. */
      origemSelo: /manual/i.test(E.origem || "") ? "Manual" : "Automática",
      relTopo: E.registro ? (E.rel || "Contato") : "Lead",
      relTopoStyle: "display:inline-flex;align-items:center;height:23px;padding:0 9px;border-radius:7px;font-size:11.5px;font-weight:700;white-space:nowrap;" + (!E.registro || E.rel === "Lead" ? "background:#fff6f4;color:#9c3210" : E.rel === "Cliente" ? "background:#e6f4ee;color:#1f7256" : E.rel === "Prospect" ? "background:#e8f0fb;color:#2c5f9e" : "background:#eeeff3;color:#4a5560"),
      etapaSelo: "display:inline-flex;align-items:center;height:23px;padding:0 9px;border-radius:7px;font-size:11.5px;font-weight:700;white-space:nowrap;background:#eeeff3;color:"
        + ((etapas[E.etapa] || {}).cor || "#4a5560"),
      voltar: () => P.onVoltar && P.onVoltar(),

      meta: [
        { label: "Responsável:", valor: E.resp || "Sem responsável", d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
        { label: "Origem:", valor: E.origem || "—", d: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9" },
        { label: "Campanha:", valor: E.campanha || "—", destaque: !!E.campanha, d: "M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" },
        { label: "Segmento:", valor: seg, d: "M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
        { label: "Porte:", valor: (porte ? porte + " atendentes" : "—"), d: "M3 21V7l9-4 9 4v14M9 21v-6h6v6" },
        /* Antes: "Hoje" ou "20 set 2026" fixos para toda empresa; agora a data real de criação (ou "—"). */
        { label: "Criado em:", valor: dataCriacao(E.criadoEm), d: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" }
      ].map(m => ({
        label: m.label, valor: m.valor, d: m.d,
        valorStyle: "font-weight:600;white-space:nowrap;color:" + (m.destaque ? "#c2330f" : "#12171d")
      })),

      abas: ["Visão geral", "Pessoas", "Atividades", "Timeline", "Oportunidades", "Arquivos"].map(t => {
        const on = S.aba === t;
        return {
          label: t,
          style: "height:36px;padding:0 13px;border:0;background:transparent;cursor:pointer;font-size:13px;white-space:nowrap;"
            + (on ? "color:#12171d;font-weight:600;box-shadow:inset 0 -2px 0 #d93c1a" : "color:#67787c;font-weight:500"),
          onClick: () => this.setState({ aba: t })
        };
      }),

      resumo: [
        { label: "CNPJ", valor: cnpj, tipo: "texto" },
        { label: "Porte", valor: (porte ? porte + " atendentes" : "—"), tipo: "texto" },
        { label: "Site", valor: site, tipo: "link" },
        { label: "Fonte", valor: E.origem || "—", tipo: "texto" },
        { label: "Cidade / UF", valor: cidade, tipo: "texto" },
        { label: "Interesse", tipo: "chips", chips: qualIni },
        { label: "Segmento", valor: seg, tipo: "texto" },
        { label: "Fit", tipo: "chips", chips: [qual.fit || (E.registro ? "—" : ((E.tag && E.tag.indexOf("Fit") === 0) ? E.tag.replace("Fit ", "") : "Alto"))] },
        E.empresaTel ? { label: "Telefone", valor: E.empresaTel, tipo: "texto" } : null,
        E.leadScore > 0 ? { label: "Lead score", valor: String(E.leadScore), tipo: "texto" } : null,
        E.empresaObs ? { label: "Observações", valor: E.empresaObs, tipo: "texto" } : null,
        X.funcionarios ? { label: "Funcionários", valor: X.funcionarios, tipo: "texto", apollo: !!X.deApollo } : null,
        X.faturamento ? { label: "Faturamento", valor: X.faturamento, tipo: "texto", apollo: !!X.deApollo } : null,
        X.telefone ? { label: "Telefone geral", valor: X.telefone, tipo: "texto", apollo: !!X.deApollo } : null,
        X.linkedin ? { label: "LinkedIn", valor: X.linkedin, tipo: "link", apollo: !!X.deApollo } : null,
        X.tecnologias ? { label: "Tecnologias", tipo: "chips", chips: String(X.tecnologias).split(" · "), apollo: !!X.deApollo } : null
      ].filter(Boolean).map(r => ({
        label: r.label, valor: r.valor || "", apollo: !!r.apollo,
        href: r.tipo === "link" ? (/^https?:/.test(r.valor) ? r.valor : "https://" + r.valor) : "#",
        ehTexto: r.tipo === "texto", ehChips: r.tipo === "chips", ehLink: r.tipo === "link",
        chips: (r.chips || []).map(c => ({ label: c, style: chip }))
      })),

      formularios: (E.formularios || []).map(f => ({ id: f.id, titulo: f.titulo, adHref: f.adHref || "", linhas: f.linhas })),
      temFormularios: (E.formularios || []).length > 0,
      /* Mesmos 4 campos e mesma fonte da ficha de Contato (PessoaLiga) e do
         drawer de Pré-vendas. Sem valor de exemplo: real ou "Não preenchido". */
      qualif: [
        ["Interesse", qualIni.join(", ") || "Não preenchido"],
        ["Fit", qual.fit || "Não preenchido"],
        ["Tamanho da operação", qual.tamanho ? qual.tamanho + " atendentes" : "Não preenchido"],
        ["Dor principal", qual.dor || "Não preenchido"]
      ].map(([label, valor]) => ({
        label, valor,
        style: "display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:7px;background:#eeeff3;color:#1f252c;font-size:12px;font-weight:600;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
      })),

      pessoas: pessoas.map(([nome, cargo, principal, emailX, telX], i) => ({
        nome, cargo, principal,
        iniciais: ini(nome),
        abrir: () => this.E && this.E.irPara("/onface-preview/pessoa", nome, { pessoa: slug(nome || ""), lead: E.id }),
        /* NUNCA fabricar e-mail do nome: "joao.silva@acme.com.br" parecia real
           e alguém mandava mensagem pro endereço errado. Sem e-mail real = "—",
           igual ao telefone logo abaixo. */
        email: emailX || "—",
        tel: telX || "—",
        linhaStyle: "display:flex;align-items:center;gap:11px;flex-wrap:wrap;padding:11px 0;" + (i === 0 ? "" : "border-top:1px solid #f3f5f5"),
        acoes: [
          { titulo: "WhatsApp", d: ico.wa }, { titulo: "Ligar", d: ico.tel }, { titulo: "E-mail", d: ico.mail }
        ].map(ac => Object.assign({}, ac, { onClick: () => {
          if (ac.titulo === "Ligar") return ligarCallface(nome, telX);
          abrirAtendimento(ac.titulo);
        } }))
      })),

      timeline: (tlBase = (X.eventos || []).map(ev => [ev.titulo, ev.autor, ev.quando, ev.d, false, ev.vinc || vincDe(ev.autor)]).concat(E.registro ? [
        ["Cadastrado em Contatos & Empresas", (E.origem || "Cadastro manual") + (E.campanha ? " · " + E.campanha : ""), dataCriacao(E.criadoEm), "M12 5v14M5 12h14", false, "Empresa"]
      ] : [
        ["Próxima ação agendada", E.acao || "Ligar para " + E.pessoa, "Hoje, 16:30", "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", true, E.pessoa],
        ["WhatsApp recebido", E.pessoa, "Ontem, 13:42", ico.wa, false, E.pessoa],
        ["Lead criado via " + E.origem, "Sistema", "20 set", "M12 5v14M5 12h14", false, "Empresa"],
        ["Campanha " + (E.campanha || E.origem), E.origem, "20 set", "M3 11l18-5v12L3 14v-3z", false, "Empresa"]
      ])).filter(ev => vincOk(ev[5])).filter((_, i) => S.tlTudo || i < 5).map(([titulo, autor, quando, d, coral, vinc], i, arr) => {
        const rel = /^Ligação\b/.test(titulo);
        return {
        titulo, autor, quando, d, temLinha: i < arr.length - 1,
        vinc: vincRotulo(vinc), vincStyle: vincChip(vinc), temAutor: !!autor,
        temRel: rel, dica: rel ? "Abrir relatório da ligação" : "",
        linha: "display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:start;border-radius:8px;margin:0 -6px;padding:0 6px;" + (rel ? "cursor:pointer" : ""),
        hover: rel ? "background:#fafafa" : "",
        onClick: rel ? () => { const Es2 = this.E; if (Es2) Es2.abrir("relatorio", E.id); } : undefined,
        marca: "flex:0 0 auto;width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;"
          + (coral ? "background:#fff6f4;color:#c2330f" : "background:#eeeff3;color:#4a5560")
      }; }),

      ...(() => {
        const total = tlBase.filter(ev => vincOk(ev[5])).length;
        return {
          tlVinc: mkVinc(tlBase.map(ev => ev[5])),
          tlTemMais: total > 5,
          tlBotao: S.tlTudo ? "Mostrar menos" : "Ver mais " + (total - 5),
          tlChevron: "flex:0 0 auto;transform:rotate(" + (S.tlTudo ? 180 : 0) + "deg)",
          tlAlternar: () => this.setState(s => ({ tlTudo: !s.tlTudo }))
        };
      })(),
      acaoTitulo: E.acao ? E.acao + " · " + (E.venceEm || "hoje") : (E.registro ? "Nenhuma ação agendada" : "Ligar para " + E.pessoa + " · hoje, 16:30"),
      acaoNota: E.registro && !E.acao ? "Crie uma atividade para não esquecer do próximo passo." : "Entender necessidades de telefonia e apresentar o " + E.interesse + ".",
      resp: E.resp || "Sem responsável",
      respIniciais: ini(E.resp),
      tags: tagsAtuais.map(t => ({ label: t })),

      origem: [
        ["Origem", E.origem || "—"], ["Campanha", E.campanha || "—"],
        ["Conjunto", conjunto || "—"],
        ["Criativo", criativo || "—"]
      ].map(([label, valor]) => ({
        label, valor,
        valorStyle: "flex:1;min-width:0;font-size:12.5px;line-height:1.45;text-wrap:pretty;" + (valor === "—" ? "color:#a3a8a4" : "color:#1f252c;font-weight:500")
      })),

      cadNome: cadE || "Fora de cadência",
      cadEstado: cadE ? (X.pausada ? "Pausada" : "Ativa") : "Inativa",
      temCad: !!cadE,
      pausarLabel: X.pausada ? "Retomar" : "Pausar",
      trocarLabel: cadE ? "Trocar cadência" : "Inserir em cadência",
      cadSelo: "display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;"
        + (cadE && !X.pausada ? "background:#e6f4ee;color:#1f7256" : "background:#eeeff3;color:#4a5560"),
      cadPasso: cadE ? "Passo 2 de 5" : "—",
      cadPassos: [1, 2, 3, 4, 5].map(i => ({
        style: "flex:1;height:3px;border-radius:2px;background:" + (cadE && i <= 2 ? (X.pausada ? "#a3a8a4" : "#fe4f2b") : "#e3e7e8")
      })),
      pausar: () => {
        const n = !X.pausada;
        this.gravarEmpresa(nomeEmp, { pausada: n });
        this.registrarEvento(nomeEmp, n ? "Cadência pausada" : "Cadência retomada", this.eu, "M10 4v16M14 4v16");
        diz(n ? "Cadência pausada" : "Cadência retomada", n ? "aviso" : "ok");
      },
      trocarCad: () => P.onTrocarCadencia && P.onTrocarCadencia(E.id, cadE),
      removerCad: () => P.onRemoverCadencia && P.onRemoverCadencia(E.id),

      relAtivas: (() => {
        const RR = this.state && this.state.hidratado && this.dadosDoProto.Relacoes ? this.dadosDoProto.Relacoes({ empresa: nomeEmp }) : { itens: [], perdidas: 0 };
        const ICO = { cliente: "M20 6 9 17l-5-5", opp: "M12 2v20M17 6H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6", proposta: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5", aquisicao: "M22 12h-4l-3 9L9 3l-3 9H2" };
        const TOM = { verde: ["#e6f4ee", "#1f7256"], coral: ["#fff6f4", "#c2330f"], azul: ["#e8f0fb", "#2c5f9e"], cinza: ["#eeeff3", "#4a5560"] };
        const n = RR.itens.length;
        const iniciar = () => this.E && this.E.abrir("iniciarRelacao", { empresa: nomeEmp, pessoas: pessoas.map(p => ({ nome: p[0], cargo: p[1], email: p[3] || "", tel: p[4] || "" })), pessoa: null, resp: E.resp || null, origem: E.origem || null, rel: RR.itens.some(r => r.k === "cliente") ? "Cliente" : n ? "Lead" : "Contato" });
        return { iniciar, vazio: !n, vazioTxt: "Nenhuma aquisição, oportunidade ou proposta aberta com " + nomeEmp + ". Por enquanto ela só existe na base.",
          conta: n ? String(n) : "", contaStyle: n ? "display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 7px;border-radius:9999px;background:#12171d;color:#fff;font-size:11.5px;font-weight:700" : "display:none",
          temPerdidas: RR.perdidas > 0, perdidasTxt: RR.perdidas + (RR.perdidas > 1 ? " oportunidades perdidas" : " oportunidade perdida") + " no histórico",
          itens: RR.itens.map((r, i) => { const t = TOM[r.tom] || TOM.cinza; return Object.assign({}, r, { d: ICO[r.k],
            ir: () => r.ir && r.ir(),
            linha: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 8px;margin:0 -8px;width:calc(100% + 16px);border:0;border-radius:9px;background:transparent;cursor:pointer;text-align:left;" + (i ? "box-shadow:inset 0 1px 0 #f1f3f3" : ""),
            ico: "flex:0 0 auto;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:" + t[0] + ";color:" + t[1],
            stStyle: "display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;background:" + t[0] + ";color:" + t[1] }); }) };
      })(),
      relacoes: [
        { conta: "3", label: "Contatos", d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
        { conta: "1", label: "Oportunidade", d: "M12 2v20M17 6H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" },
        { conta: "0", label: "Contratos", d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" },
        { conta: "0", label: "Tickets", d: "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" }
      ].map(r => Object.assign({}, r, {
        conta: r.label === "Contatos" ? String(pessoas.length) : r.label === "Oportunidade" ? String(ativos.length) : r.conta,
        onClick: () => {
          if (r.label === "Contatos") return this.setState({ aba: "Pessoas" });
          if (r.label === "Oportunidade") return this.setState({ aba: "Oportunidades" });
          diz("Nenhum registro em " + r.label.toLowerCase() + " para esta empresa", "aviso");
        }
      })),

      gridStyle: abaVisao
        ? "display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:12px;align-items:start"
        : "display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start;max-width:980px",
      abaVisao,
      mostraPessoas: abaVisao || aba === "Pessoas",
      mostraTimeline: abaVisao || aba === "Timeline",
      abaAtv: aba === "Atividades",
      abaOpp: aba === "Oportunidades",
      abaArq: aba === "Arquivos",
      opps: ativos.map(o => ({ titulo: (qualIni[0] || o.interesse) + " · " + o.empresa, meta: "Responsável: " + (o.resp || "—") + " · criada no Pipeline", etapa: "Nova" })),
      semOpps: ativos.length === 0,
      criarOpp: () => this.setState({ nova: { tipo: E.rel === "Cliente" ? "expansao" : "nova" } }),
      no: (() => {
        const N = S.nova; if (!N) return { aberto: false, tipos: [], familias: [], equipe: [], contatos: [] };
        const Es = this.E, DD = this.dadosDoProto || {};
        const FAM = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label" };
        const INT = { "Callface AI": "CALLFACE_AI", "PABX": "PABX", "White Label": "WHITE_LABEL" };
        const famPad = INT[E.interesse] || INT[qualIni[0]] || "CALLFACE_AI";
        const fam = N.familia || famPad;
        /* Antes: inventava "Contrato nº CT-2xxx, assinado 12/03/2026, R$ x/mês" (número sorteado do nome, MRR fixo por produto).
           Não há contrato real ligado à empresa; sem ele, a expansão não aponta para contrato nenhum. */
        const alt = N.tipo && N.tipo !== "nova";
        const cts = pessoas.map(p => [...p][0]).filter(Boolean);
        const contato = N.contato || cts[0] || E.pessoa || "";
        const resp = N.resp || E.resp || equipe[0];
        const TIPOS = [
          ["nova", "Nova venda", E.rel === "Cliente" ? "Outro produto para esta empresa, com contrato novo" : "Primeira venda para esta empresa", "M12 5v14M5 12h14"],
          ["expansao", "Expansão", "Mais licenças, ramais, números ou módulos", "M7 17 17 7M7 7h10v10"],
          ["upgrade", "Upgrade", "Troca para um plano superior", "M12 19V5M5 12l7-7 7 7"],
          ["renovacao", "Renovação", "Fim de vigência, prazo e reajuste", "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"]
        ];
        const up = (patch) => this.setState(s => ({ nova: Object.assign({}, s.nova, patch) }));
        const ok = !!(N.tipo && fam && resp && contato);
        return { aberto: true, fechar: () => this.setState({ nova: null }),
          sub: nomeEmp + " · " + (E.rel || "Contato"),
          tipos: TIPOS.map(([v, l, s, dd]) => { const on = N.tipo === v; return { l, s, d: dd, onClick: () => up({ tipo: v, familia: v === "nova" ? N.familia : famPad }),
            style: "display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:11px;border:0;cursor:pointer;text-align:left;background:#fff;box-shadow:inset 0 0 0 " + (on ? "1.5px #12171d" : "1px #dbdede"),
            ico: "flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;" + (on ? "background:#12171d;color:#fff" : "background:#eeeff3;color:#4a5560") }; }),
          temOrigem: false, origemT: "", origemS: "",
          familia: fam, famLabel: FAM[fam], familias: Object.keys(FAM).filter(k => !alt || k === famPad).map(k => ({ v: k, l: FAM[k] })), setFamilia: (ev) => up({ familia: ev.target.value }),
          resp, equipe: equipe.map(p => ({ v: p, l: p })), setResp: (ev) => up({ resp: ev.target.value }),
          contato, contatos: cts.map(p => ({ v: p, l: p })), setContato: (ev) => up({ contato: ev.target.value }),
          nota: N.nota || "", setNota: (ev) => up({ nota: ev.target.value }),
          notaDica: alt ? "Ex: quer ativar mais 30 licenças a partir do mês que vem" : "Ex: interesse em PABX para a filial de Campinas",
          temAviso: false, aviso: "",
          criarTxt: "Criar oportunidade",
          criarStyle: "height:38px;padding:0 16px;border-radius:9px;border:0;font-size:13px;font-weight:700;white-space:nowrap;" + (ok ? "background:#12171d;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#8b949e;cursor:not-allowed"),
          criar: () => {
            if (!ok || !Es) return;
            const lista = (Es.ler("opps", null) || DD.OPORTUNIDADES || []).slice();
            const id = "o" + Date.now().toString(36);
            const rot = { nova: "Nova venda", expansao: "Expansão", upgrade: "Upgrade", renovacao: "Renovação" }[N.tipo];
            lista.push({ id, empresa: nomeEmp, pessoa: contato, cargo: contato === E.pessoa ? (E.cargo || "") : "", familia: fam, etapa: "entrada", resp, dias: 0, leadId: E.id, origem: alt ? "Cliente ativo" : (E.origem || "Empresa"),
              tipo: N.tipo, nota: (N.nota || "").trim() || undefined,
              itens: [], propostas: [], pessoas: [{ nome: contato, papel: "Contato principal" }], atvs: [],
              eventos: [{ t: rot + " criada a partir da empresa", quando: "Hoje", autor: this.eu }] });
            Es.gravar({ opps: lista });
            this.registrarEvento && this.registrarEvento(nomeEmp, "Oportunidade de " + rot.toLowerCase() + " criada · " + FAM[fam], this.eu);
            this.setState({ nova: null });
            diz(rot + " criada no Pipeline", "ok");
            Es.irPara("/onface-preview/oportunidade", nomeEmp, { opp: id });
          } };
      })(),
      arquivos: (X.arquivos || []).map((a, i) => ({
        nome: a.nome, ext: (a.nome.split(".").pop() || "").slice(0, 4).toUpperCase(), meta: a.tam + " · enviado " + a.quando,
        ...(() => { const v = this.anexoView(a, diz); return { abrir: v.abrir, thumbStyle: v.thumbStyle, extVisivel: v.extVisivel }; })(),
        remover: () => this.gravarEmpresa(nomeEmp, { arquivos: (X.arquivos || []).filter((_, j) => j !== i) })
      })),
      enviarArquivo: (e) => {
        const lista = Array.from(e.target.files || []);
        if (!lista.length) return;
        const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
        window.__ofArquivos = window.__ofArquivos || {};
        const novos = lista.map((a, k) => { const id = "f" + Date.now() + k; window.__ofArquivos[id] = URL.createObjectURL(a); return { id, nome: a.name, tam: kb(a.size), tipo: a.type || "", quando: "hoje" }; });
        this.gravarEmpresa(nomeEmp, { arquivos: novos.concat(X.arquivos || []) });
        lista.forEach((a, k) => {
          if (!/^image\//.test(a.type) || a.size > 1200000) return;
          const rd = new FileReader();
          rd.onload = () => { const atual = this.empresaDados(nomeEmp).arquivos || []; this.gravarEmpresa(nomeEmp, { arquivos: atual.map(x => x.id === novos[k].id ? Object.assign({}, x, { src: rd.result }) : x) }); };
          rd.readAsDataURL(a);
        });
        this.registrarEvento(nomeEmp, lista.length > 1 ? lista.length + " arquivos enviados" : "Arquivo enviado", lista.map(a => a.name).join(", "), "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6");
        diz(lista.length > 1 ? lista.length + " arquivos enviados" : lista[0].name + " enviado", "ok");
        e.target.value = "";
      },

      editarResumo: () => abrirEd("resumo", { cnpj, porte, site, cidade, segmento: seg, funcionarios: X.funcionarios || "", faturamento: X.faturamento || "", telefone: X.telefone || "", linkedin: X.linkedin || "", tecnologias: X.tecnologias || "" }),
      editarQualif: () => abrirEd("qualif", { interesse: qualIni, dor: qual.dor || "", canal: qual.canal || (E.origem === "WhatsApp" ? "WhatsApp" : "Telefone"), urgencia: qual.urgencia || "Média", fit: qual.fit || "Alto" }),
      ...(() => {
        const lista = (X.notas || []).slice().sort((a, b) => (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0));
        const txt = S.notaTexto || "";
        const anexos = S.notaAnexos || [];
        const pode = !!txt.trim() || anexos.length > 0;
        const gravarNotas = (nv) => this.gravarEmpresa(nomeEmp, { notas: nv });
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
          gravarNotas([{ id: "n" + Date.now(), autor: this.eu, texto: txt.trim(), quando: "Hoje, " + hh, fixada: false, anexos }].concat(X.notas || []));
          if (anexos.length) this.gravarEmpresa(nomeEmp, { arquivos: anexos.map(a => ({ id: a.id, nome: a.nome, tam: a.tam, tipo: a.tipo, src: a.src, quando: "hoje · nota" })).concat(this.empresaDados(nomeEmp).arquivos || []) });
          this.registrarEvento(nomeEmp, "Nota interna adicionada", this.eu, "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6");
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
            return "position:fixed;" + this.posFlutuante(r ? { top: r.top, bottom: r.bottom } : null, 180) + "left:" + (r ? r.left + 8 : 120) + "px;width:240px;z-index:62;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .1s ease-out both";
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
            fixar: () => { gravarNotas((X.notas || []).map(x => x.id === n.id ? Object.assign({}, x, { fixada: !x.fixada }) : x)); diz(n.fixada ? "Nota desafixada" : "Nota fixada no topo", "ok"); },
            partes: (() => {
              const nomes = equipe.concat([this.eu]);
              const re = new RegExp("(@(?:" + nomes.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + "))", "g");
              return String(n.texto || "").split(re).filter(Boolean).map(t => ({
                txt: t,
                style: t.charAt(0) === "@" && nomes.indexOf(t.slice(1)) >= 0 ? "color:#c2330f;font-weight:600;background:#fff6f4;border-radius:4px;padding:0 2px" : ""
              }));
            })(),
            remover: () => { gravarNotas((X.notas || []).filter(x => x.id !== n.id)); diz("Nota excluída", "aviso"); }
          }))
        };
      })(),
      ...(() => {
        const Es = this.E;
        /* Catálogo REAL (`labels`) quando a ficha o recebe; o do protótipo (tags e fluxos inventados) só sem ele. */
        const real = Array.isArray(this.props.labels);
        const fluxos = real ? {} : { "Inbound": "Primeiro contato", "Enterprise": "Prospecção inbound", "Reativar": "Reativação", "Proposta enviada": "Pós-proposta" };
        const criadas = real ? [] : (Es && Es.ler("tagsCriadas", [])) || [];
        const base = real ? this.props.labels : ["Inbound", "Enterprise", "Fit Alto", "Reativar", "Proposta enviada", "Callface AI", "PABX", "White Label"];
        const todas = base.concat(criadas.map(t => typeof t === "string" ? t : t.nome)).concat(tagsAtuais).filter((t, i, a) => t && a.indexOf(t) === i);
        const gravar = (lista) => this.gravarEmpresa(nomeEmp, { tags: lista });
        const nova = (S.tagNova || "").trim();
        const criar = () => {
          if (!nova) return;
          if (Es && todas.indexOf(nova) < 0) Es.gravar({ tagsCriadas: criadas.concat(nova) });
          if (tagsAtuais.indexOf(nova) < 0) gravar(tagsAtuais.concat(nova));
          this.setState({ tagNova: "" });
          diz("Tag “" + nova + "” criada e aplicada", "ok");
        };
        return {
          tagsTopo: tagsAtuais.map(t => ({ label: t, remover: () => (E.registro && this.props.persistir ? this.props.persistir({ tagRemover: t }) : gravar(tagsAtuais.filter(x => x !== t))) })),
          tagAberto: S.tagMenu,
          abrirTag: (e) => {
            if (E.registro && this.props.temLead !== false && this.E) { e.stopPropagation(); this.E.abrir("tagslead", E.id); return; }
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            this.setState(s => ({ tagMenu: !s.tagMenu, tagRect: { top: r.top, bottom: r.bottom, left: r.left } }));
          },
          tagMenuStyle: (() => {
            const r = S.tagRect;
            const vw = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1200;
            return "position:fixed;" + this.posFlutuante(r, 360) + "left:" + Math.max(8, Math.min(r ? r.left : 120, vw - 300)) + "px;width:288px;z-index:60;display:flex;flex-direction:column;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .12s ease-out both";
          })(),
          tagOpcoes: todas.map(t => {
            const on = tagsAtuais.indexOf(t) >= 0;
            return {
              label: t, on, temFluxo: !!fluxos[t], fluxo: fluxos[t] ? "cadência " + fluxos[t] : "",
              caixa: "flex:0 0 auto;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;color:#fff;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
              onClick: () => {
                gravar(on ? tagsAtuais.filter(x => x !== t) : tagsAtuais.concat(t));
                if (!on && fluxos[t]) diz("Tag “" + t + "” aplicada · dispara a cadência " + fluxos[t], "ok");
              }
            };
          }),
          tagNova: S.tagNova || "",
          setTagNova: (e) => this.setState({ tagNova: e.target.value }),
          teclaTag: (e) => { if (e.key === "Enter") { e.preventDefault(); criar(); } },
          criarTag: criar,
          criarTagStyle: "flex:0 0 auto;height:32px;padding:0 12px;border-radius:7px;border:0;font-size:12px;font-weight:600;cursor:" + (nova ? "pointer;background:#12171d;color:#fff" : "not-allowed;background:#e3e7e8;color:#a3a8a4")
        };
      })(),
      etapaAberto: S.etapaMenu,
      etapaPontoTopo: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + ((etapas[E.etapa] || {}).cor || "#4a5560"),
      abrirEtapa: (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        this.setState(s => ({ etapaMenu: !s.etapaMenu, etapaRect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } }));
      },
      etapaMenuStyle: (() => {
        const r = S.etapaRect;
        const vw = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1200;
        const esq = r ? Math.min(r.left, vw - 262) : 120;
        return "position:fixed;" + this.posFlutuante(r, 312) + "left:" + Math.max(8, esq) + "px;width:254px;z-index:60;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .12s ease-out both";
      })(),
      etapaOpcoes: (() => {
        const regra = { qualificado: "Abre a qualificação", oportunidade: "Qualifica e cria a oportunidade", nutricao: "Pede motivo e data de retomada", desqualificado: "Pede motivo" };
        return ["novo", "em_contato", "qualificacao", "qualificado", "oportunidade", "nutricao", "desqualificado"].map(k => ({
          label: (etapas[k] && etapas[k].label) || k, on: E.etapa === k,
          temNota: !!regra[k] && E.etapa !== k, nota: regra[k] || "",
          ponto: "flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:" + ((etapas[k] && etapas[k].cor) || "#4a5560"),
          onClick: () => {
            this.setState({ etapaMenu: false });
            if (E.etapa === k) return;
            const Es = this.E;
            if (k === "qualificado") return Es && Es.abrir("qualificar", E.id);
            if (k === "oportunidade") return Es && Es.abrir("oportunidade", E.id);
            if (k === "nutricao") return Es && Es.abrir("nutrir", E.id);
            if (k === "desqualificado") return Es && Es.abrir("desqualificar", E.id);
            this.gravarLead(E.id, { etapa: k });
            this.registrarEvento(nomeEmp, "Movido de " + ((etapas[E.etapa] && etapas[E.etapa].label) || E.etapa || "—") + " para " + ((etapas[k] && etapas[k].label) || k), this.eu, "M5 12h14M13 6l6 6-6 6");
            diz("Movido para " + ((etapas[k] && etapas[k].label) || k), "ok");
          }
        }));
      })(),
      respAberto: S.respMenu,
      respBtnStyle: "display:flex;align-items:center;gap:10px;width:100%;height:42px;padding:0 11px 0 7px;border-radius:9px;border:0;background:#fff;cursor:pointer;box-shadow:inset 0 0 0 " + (S.respMenu ? "1.5px #12171d" : "1px #dbdede"),
      respChevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (S.respMenu ? 180 : 0) + "deg)",
      abrirResp: (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        this.setState(s => ({ respMenu: !s.respMenu, respRect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } }));
      },
      respMenuStyle: (() => {
        const r = S.respRect;
        return "position:fixed;" + this.posFlutuante(r, 130) + "left:" + (r ? r.left : 120) + "px;width:" + (r ? r.width : 260) + "px;z-index:60;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .12s ease-out both";
      })(),
      respOpcoes: equipe.map(n => ({
        nome: n, iniciais: ini(n), on: E.resp === n,
        onClick: () => {
          this.setState({ respMenu: false });
          if (E.resp === n) return;
          this.gravarLead(E.id, { resp: n });
          this.registrarEvento(nomeEmp, "Responsável alterado para " + n, this.eu, "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0");
          diz("Responsável: " + n, "ok");
        }
      })),
      editarOrigem: () => abrirEd("origem", { origem: E.origem, campanha: E.campanha || "", conjunto, criativo }),
      edAberto: !!S.editando,
      edTitulo: S.editando ? telas[S.editando].titulo : "",
      edSub: ({ resumo: "Dados cadastrais de " + nomeEmp + ".", qualif: "Critérios que o time usa para decidir se o lead segue para oportunidade.", resp: "Tags aplicadas a " + nomeEmp + ".", origem: "De onde o lead " + (E.pessoa || "") + " chegou.", pessoa: "Nova pessoa vinculada a " + nomeEmp + "." })[S.editando] || "",
      edIcone: ({ resumo: "M3 21V7l9-4 9 4v14M9 21v-6h6v6", qualif: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", resp: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z", origem: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9", pessoa: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" })[S.editando] || "M12 5v14M5 12h14",
      edCampos: S.editando ? telas[S.editando].campos : [],
      edBotao: S.editando === "pessoa" ? "Adicionar pessoa" : "Salvar",
      edFechar: () => this.setState({ editando: null }),
      edSalvar: salvar,
      parar: (e) => e.stopPropagation(),

      maisAberto: S.maisMenu,
      maisStyle: (() => {
        const r = S.maisRect;
        const vw = typeof window !== "undefined" ? (typeof window !== "undefined" ? window.innerWidth : 1440) : 1200;
        return "position:fixed;" + this.posFlutuante(r, 224) + "right:" + (r ? Math.max(8, vw - r.right) : 16) + "px;width:236px;z-index:60;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .12s ease-out both";
      })(),
      maisItens: [
        { label: "Abrir lead", d: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", k: "lead" },
        { label: "Adicionar pessoa", d: "M12 5v14M5 12h14", k: "pessoa" },
        { label: "Exportar registro", d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3", k: "exportar" },
        { label: "Mover para nutrição", d: "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4", k: "nutrir" },
        { label: "Desqualificar", d: "M18 6 6 18M6 6l12 12", k: "desq" },
        { label: "Excluir…", d: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14", k: "excluir", perigo: true }
      ].map(m => ({
        label: m.label, d: m.d,
        style: "display:flex;align-items:center;gap:9px;width:100%;height:34px;padding:0 9px;border-radius:7px;border:0;background:transparent;cursor:pointer;text-align:left;font-size:13px;font-weight:500;white-space:nowrap;color:" + (m.perigo ? "#c2330f" : "#1f252c"),
        onClick: () => {
          this.setState({ maisMenu: false });
          const Es = this.E;
          if (m.k === "lead") return Es && Es.abrir("detalhe", E.id);
          if (m.k === "pessoa") return abrirEd("pessoa", {});
          if (m.k === "nutrir") return Es && Es.abrir("nutrir", E.id);
          if (m.k === "desq") return Es && Es.abrir("desqualificar", E.id);
          if (m.k === "excluir") return this.setState({ excluir: true, excAlvo: "empresa", excMotivo: null, excObs: "", excTentou: false });
          const linhas = [["Campo", "Valor"], ["Empresa", nomeEmp], ["CNPJ", cnpj], ["Site", site], ["Cidade / UF", cidade], ["Segmento", seg], ["Porte", (porte ? porte + " atendentes" : "—")], ["Responsável", E.resp || ""], ["Origem", E.origem || ""], ["Campanha", E.campanha || ""]]
            .concat(pessoas.map(p => ["Pessoa", p[0] + " · " + (p[1] || "")]));
          const csv = linhas.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(";")).join("\n");
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
          a.download = slug(nomeEmp) + ".csv";
          a.click();
          diz("Registro de " + nomeEmp + " exportado", "ok");
        }
      })),

      chamada: !!S.chamada,
      chamadaNome: S.chamada ? "Em ligação com " + S.chamada.quem : "",
      chamadaTempo: S.chamada ? seg2(S.agora - S.chamada.ini) : "00:00",
      encerrar: () => {
        const c = S.chamada;
        clearInterval(this._tick);
        this.setState({ chamada: null });
        if (!c) return;
        const t = seg2(Date.now() - c.ini);
        this.registrarEvento(nomeEmp, "Ligação realizada · " + t, c.quem, ico.tel);
        diz("Ligação com " + c.quem + " registrada · " + t, "ok");
      },
      registrar: () => P.onRegistrar && P.onRegistrar(E.id),
      qualificar: () => P.onQualificar && P.onQualificar(E.id),
      mais: (e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        this.setState(s => ({ maisMenu: !s.maisMenu, maisRect: { top: r.top, bottom: r.bottom, right: r.right } }));
      },
      addPessoa: () => abrirEd("pessoa", {}),
      verAcao: () => this.E && this.E.abrir("atividade-ver", E.id),
      novaAtv: () => this.E && this.E.abrir("atividade-nova", E.id),
      verTodasAtv: () => this.setState({ aba: "Atividades" }),
      pulso: (() => {
        const agora = Date.now(), DIA = 864e5;
        const rel = (ms) => {
          const d = Math.floor(ms / DIA);
          if (ms < 36e5) return "há " + Math.max(1, Math.round(ms / 6e4)) + " min";
          if (d < 1) return "há " + Math.round(ms / 36e5) + " h";
          if (d === 1) return "ontem";
          return "há " + d + " dias";
        };
        const toques = (X.eventos || []).filter(ev => ev.ts && /^(Ligação realizada|WhatsApp enviado|E-mail enviado)/.test(ev.titulo));
        const semente = E.registro ? {} : { [E.pessoa]: [DIA * 1 + 36e5 * 4, "WhatsApp recebido"], "Ricardo Alves": [DIA * 6, "E-mail enviado · sem resposta"], "Juliana Prado": [DIA * 13, "Ligação · não atendeu"] };
        const lista = pessoas.map(p => {
          const t = toques.find(ev => ev.autor === p[0]);
          const s = semente[p[0]];
          const ms = t ? agora - t.ts : s ? s[0] : null;
          const canal = t ? t.titulo.replace(/ · .*/, "") : s ? s[1] : "Nunca contatado";
          return { nome: p[0], ms, canal };
        }).sort((a, b) => (a.ms == null ? 1e15 : a.ms) - (b.ms == null ? 1e15 : b.ms));
        const cor = (ms) => ms == null ? "#c2330f" : ms < DIA * 3 ? "#1f7256" : ms < DIA * 7 ? "#c8a86a" : "#c2330f";
        const maisRecente = lista.find(p => p.ms != null);
        const dias = E.dias || 0;
        const etapaLbl = (etapas[E.etapa] || {}).label || "—";
        const esfriando = E.registro ? [] : lista.filter(p => p.ms == null || p.ms >= DIA * 7);
        const sinais = [
          maisRecente ? { texto: "Último contato com " + maisRecente.nome.split(" ")[0], valor: rel(maisRecente.ms), tom: maisRecente.ms < DIA * 3 ? "ok" : maisRecente.ms < DIA * 7 ? "alerta" : "risco" } : { texto: "Ninguém da empresa foi contatado", valor: "—", tom: "risco" },
          /* Antes: "Na etapa X · N dias" (N era dias desde a criação, não o tempo na etapa) e "desde hoje" para todo registro, ambos pintados de ok/alerta/risco. Sem o dado real de tempo na etapa, não afirma nada. */
          E.acao ? { texto: "Próxima ação: " + E.acao, valor: E.venceEm || "sem data", tom: "ok" } : { texto: "Sem próxima ação agendada", valor: "agendar", tom: "risco" },
          esfriando.length ? { texto: esfriando.map(p => p.nome.split(" ")[0]).join(", ") + (esfriando.length > 1 ? " esfriando" : " esfriando") + " · 7+ dias sem toque", valor: esfriando.length + (esfriando.length > 1 ? " pessoas" : " pessoa"), tom: "alerta" } : null
        ].filter(Boolean);
        const corTom = { ok: ["#1f7256", "#fff"], alerta: ["#c8a86a", "#fffbf2"], risco: ["#c2330f", "#fff6f4"] };
        const riscos = sinais.filter(s => s.tom === "risco").length;
        const alertas = sinais.filter(s => s.tom === "alerta").length;
        return {
          /* Antes: selo "Saudável/Atenção/Em risco" calculado de dias que não são o tempo real na etapa. Sem dado confiável, não afirma saúde. */
          selo: "Sem avaliação",
          seloStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;background:#eeeff3;color:#4a5560",
          sinais: sinais.map(s => ({
            texto: s.texto, valor: s.valor,
            caixa: "display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;background:" + corTom[s.tom][1] + ";box-shadow:inset 0 0 0 1px " + (s.tom === "ok" ? "#eef1f1" : s.tom === "alerta" ? "#efe2c4" : "#fadfd8"),
            ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + corTom[s.tom][0]
          })),
          pessoas: lista.map((p, i) => ({
            nome: p.nome, iniciais: ini(p.nome), ultimo: p.canal,
            quando: p.ms == null ? "nunca" : rel(p.ms),
            quandoStyle: "flex:0 0 auto;font-size:11.5px;font-weight:600;white-space:nowrap;color:" + cor(p.ms),
            ponto: "position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;box-shadow:0 0 0 2px #fff;background:" + cor(p.ms),
            linha: "display:flex;align-items:center;gap:10px;width:100%;padding:8px 6px;margin:0 -6px;width:calc(100% + 12px);border:0;border-radius:8px;background:transparent;cursor:pointer;" + (i ? "border-top:1px solid #f3f5f5" : ""),
            abrir: () => this.E && this.E.irPara("/onface-preview/pessoa", p.nome, { pessoa: slug(p.nome), lead: E.id })
          }))
        };
      })(),
      enr: (() => {
        const Q = S.enr;
        const set = (p) => this.setState(s => ({ enr: Object.assign({}, s.enr, p) }));
        const caixa = (on) => "flex:0 0 auto;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;color:#fff;" + (on ? "background:#12171d" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9");
        const passo = Q ? Q.passo : "config";
        const areasTodas = ["Operações", "Atendimento / CX", "TI", "Financeiro", "Diretoria", "Compras"];
        const niveisTodos = ["Todos", "Gerência", "Diretoria", "C-level"];
        /* Antes: lista de 6 pessoas fixas, `mockNomes`, e-mail inventado a partir do nome, saldo fixo de 48
           créditos e "Reiniciar demonstração". Agora tudo vem do Apollo pela organização (rotas /api/apollo/*). */
        const AP = S.apolloCred || { estado: "carregando" };
        const saldoNum = AP.estado === "ok" ? AP.restantes : null;
        const naoConfig = AP.estado === "nao_configurado";
        /* Domínio REAL da empresa (site/domínio cadastrado). Antes era `<nome>.com.br` inventado. */
        const dominioReal = (() => {
          const bruto = E.dominio || X.site || E.site || "";
          if (!bruto || bruto === "—") return "";
          try { return new URL(/^https?:/.test(bruto) ? bruto : "https://" + bruto).hostname.replace(/^www\./, ""); } catch (err) { return ""; }
        })();
        const semDominio = !dominioReal;
        const CAMPOS = [["funcionarios", "Funcionários"], ["faturamento", "Faturamento"], ["linkedin", "LinkedIn"], ["telefone", "Telefone geral"], ["tecnologias", "Tecnologias"]];
        /* Só entra campo que o Apollo devolveu E que difere do que já está na ficha. */
        const camposAchados = Q && Q.dadosEmp ? CAMPOS.map(([k, l]) => [k, l, X[k] ? String(X[k]) : "", Q.dadosEmp[k] || ""]).filter(c => c[3] && c[3] !== c[2]) : [];
        const encontrados = Q && Q.achados ? Q.achados.filter(p => !p.jaImportado) : [];
        const passos = [Q && Q.empresa ? "Consultando dados de " + nomeEmp + " no Apollo…" : "", Q && Q.contatos ? "Buscando contatos do domínio " + dominioReal + "…" : ""].filter(Boolean);
        const DEPTO = { "Operações": "operations", "Atendimento / CX": "support", "TI": "information_technology", "Financeiro": "finance", "Diretoria": "c_suite" };
        const SENIOR = { "Gerência": ["manager", "head"], "Diretoria": ["director", "vp"], "C-level": ["c_suite", "owner", "founder"] };
        const buscar = async () => {
          if (!Q.empresa && !Q.contatos) return diz("Escolha o que buscar", "erro");
          if (naoConfig) return diz("A integração com o Apollo não está configurada", "erro");
          if (semDominio) return diz("Cadastre o site da empresa antes de buscar no Apollo", "erro");
          const empresaId = E.empresaId;
          if (!empresaId) return diz("Esta ficha não está ligada a uma empresa cadastrada", "erro");
          const seq = this._enrSeq = (this._enrSeq || 0) + 1;
          set({ passo: "busca", prog: 0, msg: null });
          clearInterval(this._enrI);
          this._enrI = setInterval(() => this.setState(s => s.enr ? { enr: Object.assign({}, s.enr, { prog: Math.min(2, (s.enr.prog || 0) + 1) }) } : null), 900);
          const semFiltroArea = Q.areas.filter(a => !DEPTO[a]);
          const corpoC = { empresaId, departments: Q.areas.map(a => DEPTO[a]).filter(Boolean), seniorities: Q.nivel === "Todos" ? [] : (SENIOR[Q.nivel] || []) };
          const pedir = (url, corpo) => this.apolloPedir(url, { method: "POST", body: JSON.stringify(corpo) }).then(v => ({ v }), e => ({ e }));
          const [rE, rC] = await Promise.all([
            Q.empresa ? pedir("/api/apollo/empresa/dados", { empresaId }) : null,
            Q.contatos ? pedir("/api/apollo/empresa/contatos", corpoC) : null
          ]);
          clearInterval(this._enrI);
          if (seq !== this._enrSeq || !this.state.enr) return;
          const notas = [];
          if (rE && rE.e) notas.push("Dados da empresa: " + rE.e.message);
          if (rC && rC.e) notas.push("Contatos: " + rC.e.message);
          if (rE && rE.v && !rE.v.encontrada) notas.push("O Apollo não tem dados cadastrados para " + dominioReal + ".");
          if (rC && rC.v && !rC.v.pessoas.length) notas.push("O Apollo não devolveu contatos para " + dominioReal + " com esses filtros.");
          if (rC && rC.v && semFiltroArea.length) notas.push("Sem filtro equivalente no Apollo, ignorado: " + semFiltroArea.join(", ") + ".");
          const msg = notas.join(" ");
          if (!((rE && rE.v) || (rC && rC.v))) {
            set({ passo: "config", msg });
            return diz(msg, "erro");
          }
          if ((rE && rE.e) || (rC && rC.e)) diz(msg, "erro");
          const dadosEmp = rE && rE.v ? rE.v.campos : null;
          const achados = rC && rC.v ? rC.v.pessoas : null;
          const selC = {}; if (dadosEmp) CAMPOS.forEach(([k]) => { if (dadosEmp[k] && !X[k]) selC[k] = true; });
          const selP = {}; (achados || []).forEach(p => { if (p.temEmail && !p.jaImportado) selP[p.id] = true; });
          set({ passo: "resultado", dadosEmp, achados: achados || [], erroCont: !!(rC && rC.e), msg, selC, selP, rev: {} });
        };
        const aplicar = async () => {
          if (Q.aplicando) return;
          const selC = Q.selC || {}, selP = Q.selP || {};
          const campos = Q.empresa ? camposAchados.filter(c => selC[c[0]]) : [];
          const novos = Q.contatos ? encontrados.filter(p => selP[p.id]) : [];
          if (!campos.length && !novos.length) return diz("Selecione ao menos um item para aplicar", "erro");
          if (saldoNum != null && custo > saldoNum) return diz("Créditos insuficientes · faltam " + (custo - saldoNum), "erro");
          const empresaId = E.empresaId;
          set({ aplicando: true, msg: null });
          const falhas = []; let nCampos = 0, nImp = 0;
          if (campos.length) {
            try {
              const cp = {}; campos.forEach(c => { cp[c[0]] = c[3]; });
              await this.apolloPedir("/api/apollo/empresa/aplicar", { method: "POST", body: JSON.stringify({ empresaId, campos: cp }) });
              nCampos = campos.length;
            } catch (e) { falhas.push("Dados da empresa: " + e.message); }
          }
          if (novos.length) {
            try {
              const r = await this.apolloPedir("/api/apollo/import", { method: "POST", body: JSON.stringify({ apolloIds: novos.map(p => p.id), origem: "apollo", empresaId }) });
              nImp = r.imported || 0;
              (r.results || []).filter(x => x.error).slice(0, 3).forEach(x => falhas.push(x.error));
            } catch (e) { falhas.push("Contatos: " + e.message); }
          }
          if (nCampos || nImp) { this.carregarSalvos(); this.carregarApollo(); if (this.props.recarregar) this.props.recarregar(); }
          if (!this.state.enr) return;
          const feito = [nCampos ? nCampos + (nCampos > 1 ? " campos" : " campo") : "", nImp ? nImp + (nImp > 1 ? " contatos importados" : " contato importado") : ""].filter(Boolean).join(" · ");
          if (falhas.length) {
            const txt = (feito ? feito + ". " : "") + "Falhou: " + falhas.join(" · ");
            set({ aplicando: false, msg: txt });
            return diz(txt, "erro");
          }
          this.setState({ enr: null });
          diz("Enriquecimento aplicado a " + nomeEmp + " · " + feito, "ok");
        };
        const nC = camposAchados.filter(c => (Q && Q.selC || {})[c[0]]).length;
        const nP = encontrados.filter(p => (Q && Q.selP || {})[p.id]).length;
        /* Cada contato importado passa por people/match: 1 crédito (APOLLO_COSTS.enrichPerson). Telefone não é revelado pela importação. */
        const CUSTO_EMAIL = 1;
        const custo = Q && Q.contatos ? nP * CUSTO_EMAIL : 0;
        const falta = saldoNum != null && custo > saldoNum;
        return {
          aberto: !!Q,
          /* Antes: abria já com o saldo fixo de 48. Agora busca o saldo real (GET /api/apollo/credits). */
          abrir: () => { this.setState({ enr: { passo: "config", empresa: true, contatos: true, areas: ["Operações", "Atendimento / CX", "Diretoria"], nivel: "Todos" }, maisMenu: false }); this.carregarApollo(); },
          fechar: () => { this._enrSeq = (this._enrSeq || 0) + 1; clearTimeout(this._enrT); clearInterval(this._enrI); this.setState({ enr: null }); },
          creditos: saldoNum != null ? saldoNum : AP.estado === "carregando" ? "…" : "—",
          sub: Q && Q.msg ? Q.msg
            : naoConfig ? "A integração com o Apollo não está configurada para esta organização. Cadastre a chave em Ajustes › Integrações."
            : AP.estado === "erro" ? AP.msg
            : passo === "config" && semDominio ? "Esta empresa não tem site cadastrado. Sem o domínio não dá para buscar no Apollo."
            : passo === "confirmar" ? "Confirme o uso de créditos antes de importar." : passo === "resultado" ? "Revise o que o Apollo encontrou e escolha o que aplicar." : "Complete o cadastro e encontre outros contatos a partir do domínio " + dominioReal + ".",
          passoConfig: passo === "config", passoBusca: passo === "busca", passoResultado: passo === "resultado", passoConfirmar: passo === "confirmar",
          avisoTitulo: "Essa ação consumirá " + custo + (custo === 1 ? " crédito" : " créditos") + " do Apollo",
          custoTxt: custo + (custo === 1 ? " crédito" : " créditos"),
          saldoAntes: saldoNum != null ? saldoNum + " créditos" : "indisponível", saldoDepois: saldoNum != null ? (saldoNum - custo) + " créditos" : "indisponível",
          resumoCusto: [
            nP ? { label: "Contatos importados com e-mail", conta: nP + " × " + CUSTO_EMAIL, total: nP * CUSTO_EMAIL } : null,
            nC ? { label: "Dados da empresa", conta: String(nC), total: "já consultado" } : null
          ].filter(Boolean).map((r, i) => ({ label: r.label, conta: r.conta, total: typeof r.total === "number" ? r.total + (r.total === 1 ? " crédito" : " créditos") : r.total, linha: "display:flex;align-items:center;gap:10px;padding:10px 14px;" + (i ? "border-top:1px solid #f3f5f5" : "") })),
          itens: Q ? [
            ["empresa", "Dados da empresa", "Funcionários, faturamento, LinkedIn, telefone e tecnologias", "M3 21V7l9-4 9 4v14M9 21v-6h6v6"],
            ["contatos", "Encontrar contatos", "Decisores e influenciadores na " + nomeEmp, "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M23 21v-2a4 4 0 0 0-3-3.9"]
          ].map(([k, l, n, d], i) => ({
            label: l, nota: n, d, on: !!Q[k],
            temFiltros: k === "contatos" && !!Q[k],
            bloco: i ? "border-top:1px solid #eef1f1" : "",
            trilho: "flex:0 0 auto;width:34px;height:20px;border-radius:9999px;padding:2px;box-sizing:border-box;transition:background 140ms cubic-bezier(.2,0,.2,1);background:" + (Q[k] ? "#12171d" : "#d3d8d9"),
            bolinha: "display:block;width:16px;height:16px;border-radius:9999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform 140ms cubic-bezier(.2,0,.2,1);transform:translateX(" + (Q[k] ? 14 : 0) + "px)",
            onClick: () => set({ [k]: !Q[k] })
          })) : [],
          buscaContatos: !!(Q && Q.contatos),
          areasAberto: !!(Q && Q.menu === "areas"),
          nivelAberto: !!(Q && Q.menu === "nivel"),
          areasResumo: Q ? (Q.areas.length === 0 ? "Todas as áreas" : Q.areas.length <= 2 ? Q.areas.join(", ") : Q.areas.slice(0, 2).join(", ") + " +" + (Q.areas.length - 2)) : "",
          nivelResumo: Q ? (Q.nivel === "Todos" ? "Todas" : Q.nivel) : "",
          areasBtn: "display:flex;align-items:center;gap:8px;width:100%;height:36px;padding:0 10px;border-radius:8px;border:0;background:#fff;cursor:pointer;box-shadow:inset 0 0 0 " + (Q && Q.menu === "areas" ? "1.5px #12171d" : "1px #dbdede"),
          nivelBtn: "display:flex;align-items:center;gap:8px;width:100%;height:36px;padding:0 10px;border-radius:8px;border:0;background:#fff;cursor:pointer;box-shadow:inset 0 0 0 " + (Q && Q.menu === "nivel" ? "1.5px #12171d" : "1px #dbdede"),
          abrirAreas: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); set({ menu: Q.menu === "areas" ? null : "areas", menuRect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } }); },
          abrirNivel: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); set({ menu: Q.menu === "nivel" ? null : "nivel", menuRect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width } }); },
          areasMenuStyle: Q && Q.menuRect ? "position:fixed;" + this.posFlutuante(Q.menuRect, 220) + "left:" + Q.menuRect.left + "px;width:" + Math.max(200, Q.menuRect.width) + "px;z-index:70;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .12s ease-out both" : "display:none",
          nivelMenuStyle: Q && Q.menuRect ? "position:fixed;" + this.posFlutuante(Q.menuRect, 150) + "left:" + Q.menuRect.left + "px;width:" + Math.max(180, Q.menuRect.width) + "px;z-index:70;background:#fff;border-radius:10px;padding:4px;box-shadow:0 0 0 1px #e3e7e8,0 12px 32px -8px rgba(18,23,29,.22);animation:of-fade .12s ease-out both" : "display:none",
          areasConta: Q ? (Q.areas.length ? Q.areas.length + " selecionada" + (Q.areas.length > 1 ? "s" : "") : "Todas as áreas") : "",
          areas: Q ? areasTodas.map(a => {
            const on = Q.areas.indexOf(a) >= 0;
            return { label: a, on, caixa: caixa(on),
              chip: "display:flex;align-items:center;gap:8px;min-width:0;height:34px;padding:0 10px;border-radius:8px;border:0;font-size:12.5px;white-space:nowrap;cursor:pointer;text-align:left;font-weight:" + (on ? "600;background:#fff;color:#12171d;box-shadow:inset 0 0 0 1.5px #12171d" : "500;background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #e3e7e8"),
              onClick: () => set({ areas: on ? Q.areas.filter(x => x !== a) : Q.areas.concat(a) }) };
          }) : [],
          niveis: Q ? niveisTodos.map(n => ({ label: n === "Todos" ? "Todas" : n,
            style: "display:flex;align-items:center;justify-content:center;min-width:0;height:100%;border-radius:7px;border:0;font-size:12.5px;white-space:nowrap;cursor:pointer;font-weight:" + (Q.nivel === n ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
            on: Q.nivel === n,
            onClick: () => set({ nivel: n, menu: null }) })) : [],
          barra: "height:100%;border-radius:9999px;background:#fe4f2b;transition:width .4s cubic-bezier(.2,0,.2,1);width:" + (Q ? ((Q.prog || 0) + 1) * 25 : 0) + "%",
          etapaBusca: passos.length ? passos[(Q ? (Q.prog || 0) : 0) % passos.length] : "Consultando o Apollo…",
          temCampos: !!(Q && Q.empresa && camposAchados.length),
          camposConta: nC + " de " + camposAchados.length + " selecionados",
          campos: Q && Q.empresa ? camposAchados.map((c, i) => {
            const on = !!(Q.selC || {})[c[0]];
            return { label: c[1], novo: c[3], atual: c[2], temAtual: !!c[2], on, caixa: caixa(on),
              selo: c[2] ? "Atualiza" : "Novo",
              seloStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;" + (c[2] ? "background:#eeeff3;color:#4a5560" : "background:#e6f4ee;color:#1f7256"),
              linha: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;background:transparent;cursor:pointer;" + (i ? "border-top:1px solid #f3f5f5" : ""),
              onClick: () => set({ selC: Object.assign({}, Q.selC, { [c[0]]: !on }) }) };
          }) : [],
          temContatos: !!(Q && Q.contatos) && !(Q && Q.erroCont),
          semContatos: !!(Q && Q.contatos) && !(Q && Q.erroCont) && encontrados.length === 0,
          /* Antes: "Reiniciar demo" apagava contatos de exemplo e voltava o saldo a 48. Sem demo, não há o que reiniciar. */
          podeReiniciar: false,
          /* O botão "Reiniciar demonstração" do estado vazio agora só volta para a busca (não apaga nada). */
          reiniciar: () => set({ passo: "config", msg: null }),
          listaContatosStyle: encontrados.length ? "border-radius:12px;box-shadow:inset 0 0 0 1px #e3e7e8;overflow:hidden" : "display:none",
          contatosConta: encontrados.length ? nP + " de " + encontrados.length + " · e-mail revelado ao importar" : "",
          contatos: Q && Q.contatos ? encontrados.map((p, i) => {
            const on = !!(Q.selP || {})[p.id];
            const tag = (on, off) => "display:inline-flex;align-items:center;height:22px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;cursor:" + (off ? "not-allowed;background:#fafafa;color:#c8ccc9;box-shadow:inset 0 0 0 1px #eef1f1" : on ? "pointer;background:#12171d;color:#fff" : "pointer;background:#fff;color:#4a5560;box-shadow:inset 0 0 0 1px #dbdede");
            return { nome: p.nome, cargo: (p.cargo || "Cargo não informado") + (p.organizacao ? " · " + p.organizacao : ""), iniciais: ini(p.nome), on, caixa: caixa(on),
              emailTxt: p.temEmail ? "E-mail a revelar" : "Sem e-mail no Apollo",
              telTxt: p.temTelefone ? "Tem telefone" : "Sem telefone",
              emailStyle: "min-width:0;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#8b949e",
              telStyle: "flex:0 0 auto;font-size:11.5px;white-space:nowrap;color:#8b949e",
              revEmail: (e) => {
                e.stopPropagation();
                if (!p.temEmail) return diz("O Apollo não tem e-mail para " + p.nome, "aviso");
                set({ selP: Object.assign({}, Q.selP, { [p.id]: !on }) });
              },
              revTel: (e) => { e.stopPropagation(); diz("Revelar telefone ainda não está ligado: a importação traz só o e-mail.", "aviso"); },
              revEmailLabel: !p.temEmail ? "E-mail —" : on ? "E-mail ✓" : "E-mail · " + CUSTO_EMAIL,
              revTelLabel: p.temTelefone ? "Tem telefone" : "Sem telefone",
              revEmailStyle: tag(on && p.temEmail, !p.temEmail), revTelStyle: tag(false, true),
              selo: p.temEmail ? "Com e-mail" : "Sem e-mail",
              seloStyle: "flex:0 0 auto;display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:5px;font-size:10px;font-weight:700;white-space:nowrap;" + (p.temEmail ? "background:#e6f4ee;color:#1f7256" : "background:#f7edd8;color:#6e5420"),
              linha: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;background:transparent;cursor:pointer;" + (i ? "border-top:1px solid #f3f5f5" : ""),
              onClick: () => set({ selP: Object.assign({}, Q.selP, { [p.id]: !on }) }) };
          }) : [],
          rodape: passo === "confirmar" ? "Os contatos importados ficam salvos na empresa"
            : passo === "config" ? (naoConfig ? "Configure a chave em Ajustes › Integrações para buscar" : AP.estado === "sem_saldo" ? "O Apollo não informa o saldo desta chave · dados da empresa e cada contato importado consomem créditos" : "Dados da empresa e cada contato importado consomem créditos Apollo")
            : passo === "resultado" ? (custo ? "Importar " + nP + " contato" + (nP > 1 ? "s" : "") + " · " + custo + " crédito" + (custo > 1 ? "s" : "") + (falta ? " · saldo insuficiente" : "") : "Sem custo · marque contatos para importar (e-mail · " + CUSTO_EMAIL + " crédito)")
            : "Consultando o Apollo…",
          podeVoltar: passo === "resultado" || passo === "confirmar",
          voltar: () => set({ passo: passo === "confirmar" ? "resultado" : "config", msg: null }),
          acaoLabel: Q && Q.aplicando ? "Aplicando…" : passo === "confirmar" ? "Confirmar e usar " + custo + (custo === 1 ? " crédito" : " créditos") : passo === "resultado" ? (custo ? "Continuar" : "Aplicar enriquecimento") : passo === "busca" ? "Buscando…" : "Buscar no Apollo",
          acaoStyle: "height:36px;padding:0 16px;border-radius:9px;border:0;font-size:12.5px;font-weight:600;white-space:nowrap;cursor:" + (passo === "busca" || (Q && Q.aplicando) ? "wait;background:#e3e7e8;color:#a3a8a4" : (passo === "config" && (naoConfig || semDominio)) ? "not-allowed;background:#e3e7e8;color:#a3a8a4" : (passo === "resultado" || passo === "confirmar") && falta ? "not-allowed;background:#f0c6bb;color:#fff" : "pointer;background:#d93c1a;color:#fff"),
          acao: () => {
            if (passo === "config") return buscar();
            if (passo === "resultado") {
              if (falta) return diz("Créditos insuficientes · faltam " + (custo - saldoNum), "erro");
              return custo ? set({ passo: "confirmar" }) : aplicar();
            }
            if (passo === "confirmar") return aplicar();
          }
        };
      })(),
      visor: {
        aberto: !!S.visor,
        nome: S.visor ? S.visor.nome : "", tam: S.visor ? S.visor.tam : "", src: S.visor ? S.visor.src : "",
        imgStyle: "width:min(880px,100%);height:calc(100vh - 120px);border-radius:10px;background:#fff center/contain no-repeat" + (S.visor ? ";background-image:url('" + S.visor.src + "')" : "") + ";box-shadow:0 24px 60px -12px rgba(0,0,0,.5)",
        fechar: () => this.setState({ visor: null })
      },
      notaRef: this.notaRef || (this.notaRef = React.createRef()),
      irNota: () => {
        this.setState({ aba: "Visão geral", notaAtiva: true }, () => {
          setTimeout(() => { const el = this.notaRef && this.notaRef.current; if (el) el.focus(); }, 30);
        });
      },
      ...(() => {
        const Es = this.E;
        const atv = (Es && (Es.ler("atvs", {}) || {})[E.id]) || null;
        const icoTipo = { "Ligação": ico.tel, "Mensagem": ico.wa, "WhatsApp": ico.wa, "E-mail": ico.mail, "Reunião": "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" };
        const itens = [];
        if (E.acao || atv) {
          const sit = (atv && atv.situacao) || "A fazer";
          itens.push({
            titulo: (atv && atv.titulo) || E.acao, tipo: (atv && atv.tipo) || "Follow up",
            meta: ((atv && atv.tipo) || "Follow up") + " · " + ((atv && atv.resp) || E.resp || "—"),
            situacao: sit, quando: (atv && atv.data ? atv.data.split("-").reverse().slice(0, 2).join("/") + " " : "") + ((atv && atv.hora) || E.venceEm || ""),
            aberta: sit !== "Feita" && sit !== "Declinada", vinc: (atv && atv.vinc) || E.pessoa,
            onClick: () => Es && Es.abrir("verAtividade", "l:" + E.id)
          });
        }
        const AG = this.dadosDoProto.Agenda ? this.dadosDoProto.Agenda.itens() : [];
        AG.filter(x => x.src !== "l" && x.empresa && x.empresa === E.empresa).sort((a, b) => (b.quando || 0) - (a.quando || 0)).forEach(x => {
          const sit = x.situacao || "A fazer", aberta = sit !== "Feita" && sit !== "Declinada";
          const q = x.quando ? x.quando.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "") + (x.temHora ? ", " + this.dadosDoProto.Agenda.hm(x.quando) : "") : "Sem data";
          const refR = x.tipo === "Reunião" ? (x.src === "o" ? { src: "o", oppId: x.oppId, i: x.idx } : { src: "p", id: x.id }) : null;
          itens.push({ id: x.key, titulo: x.titulo, tipo: x.tipo, meta: x.tipo + " · " + (x.resp || "—") + (x.desc ? " · " + x.desc : ""), situacao: sit, quando: q, aberta, vinc: x.pessoa || "Empresa",
            onClick: () => refR ? Es && Es.abrir("reuniao", refR) : Es && Es.abrir("verAtividade", x.key) });
        });
        const filtro = S.atvFiltro || "todas";
        const itensV = itens.filter(a => vincOk(a.vinc));
        const lista = itensV.filter(a => filtro === "todas" || (filtro === "abertas" ? a.aberta : !a.aberta));
        const selo = (s) => "flex:0 0 auto;display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;white-space:nowrap;"
          + (s === "Feita" ? "background:#e6f4ee;color:#1f7256" : s === "Declinada" ? "background:#eeeff3;color:#67787c" : s === "Em andamento" ? "background:#e8f0fb;color:#2c5f9e" : "background:#fff6f4;color:#9c3210");
        return {
          atvFiltros: [["todas", "Todas"], ["abertas", "Abertas"], ["concluidas", "Concluídas"]].map(([k, l]) => ({
            label: l + " · " + itensV.filter(a => k === "todas" || (k === "abertas" ? a.aberta : !a.aberta)).length,
            style: "height:28px;padding:0 11px;border-radius:7px;border:0;font-size:12px;white-space:nowrap;cursor:pointer;font-weight:" + (filtro === k ? "600;background:#fff;color:#12171d;box-shadow:0 1px 2px rgba(0,0,0,.08)" : "500;background:transparent;color:#4a5560"),
            onClick: () => this.setState({ atvFiltro: k })
          })),
          atvVinc: mkVinc(itens.map(a => a.vinc)),
          atvLista: lista.map((a, i) => ({
            vinc: vincRotulo(a.vinc), vincStyle: vincChip(a.vinc),
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
      exc: (() => {
        const motivo = S.excMotivo;
        const obrigObs = motivo === "Outro";
        const erroObs = S.excTentou && obrigObs && !(S.excObs || "").trim();
        const fechar = () => this.setState({ excluir: false });
        return {
          aberto: !!S.excluir, fechar,
          alvos: [
            { k: "empresa", label: "Só a empresa", nota: (this.props.nLeads > 0 ? (this.props.nLeads === 1 ? "O contato" : "Os " + this.props.nLeads + " contatos") + " continua" + (this.props.nLeads === 1 ? "" : "m") + " em Pré-vendas" : "As pessoas continuam na base") + ", sem empresa vinculada." }
          ].concat(this.props.nLeads > 0 ? [
            { k: "tudo", label: "Empresa e contatos", nota: "Remove " + nomeEmp + " e " + (this.props.nLeads === 1 ? "o contato dela" : "os " + this.props.nLeads + " contatos dela") + ", com notas e arquivos. Contato com histórico comercial não é apagado." }
          ] : [])
          .map(o => {
            const on = S.excAlvo === o.k;
            return {
              label: o.label, nota: o.nota,
              style: "display:flex;align-items:flex-start;gap:10px;width:100%;padding:11px 12px;border-radius:9px;border:0;cursor:pointer;background:" + (on ? "#fff6f4;box-shadow:inset 0 0 0 1.5px #c2330f" : "#fff;box-shadow:inset 0 0 0 1px #e3e7e8"),
              radio: "flex:0 0 auto;width:16px;height:16px;margin-top:1px;border-radius:9999px;background:#fff;box-shadow:inset 0 0 0 " + (on ? "5px #c2330f" : "1.5px #c8ccc9"),
              onClick: () => this.setState({ excAlvo: o.k })
            };
          }),
          motivos: ["Duplicado", "Cadastro de teste", "Dados inválidos", "Pedido do cliente (LGPD)", "Outro"].map(m => ({
            label: m, style: pill(motivo === m), onClick: () => this.setState({ excMotivo: m })
          })),
          erroMotivo: S.excTentou && !motivo,
          obsLabel: obrigObs ? "Observação *" : "Observação",
          obs: S.excObs || "",
          setObs: (e) => this.setState({ excObs: e.target.value }),
          obsStyle: "display:block;width:100%;padding:9px 11px;border-radius:8px;border:0;outline:0;resize:vertical;font-size:13px;line-height:1.45;background:#fff;box-shadow:inset 0 0 0 1px " + (erroObs ? "#e0a597" : "#dbdede"),
          btnLabel: S.excAlvo === "tudo" ? "Excluir empresa e lead" : "Excluir empresa",
          confirmar: () => {
            if (!motivo || (obrigObs && !(S.excObs || "").trim())) return this.setState({ excTentou: true });
            const Es = this.E;
            if (!Es) return;
            const todas = Object.assign({}, Es.ler("empresas", {}));
            delete todas[nomeEmp];
            const leadsAtuais = Es.ler("leads", []) || [];
            const novos = S.excAlvo === "tudo"
              ? leadsAtuais.filter(x => x.id !== E.id)
              : leadsAtuais.map(x => x.empresa === nomeEmp ? Object.assign({}, x, { empresa: "" }) : x);
            Es.gravar({ empresas: todas, leads: novos });
            this.setState({ excluir: false });
            Es.avisar(S.excAlvo === "tudo" ? nomeEmp + " e o lead foram excluídos · " + motivo : nomeEmp + " excluída · " + motivo, "aviso");
            Es.irPara("/onface-preview/pre-vendas", "Pré-vendas");
          }
        };
      })(),
      ligar: () => { const pr = pessoas.find(p => p[2]) || pessoas[0] || []; ligarCallface(pr[0] || E.pessoa, pr[4]); }
    };
  }

  render() {
    /* `children` atravessa: a Casca envolve o conteúdo da rota, e sem isto
       ela renderiza sozinha e a tela fica em branco. Estava consertado à MÃO
       no arquivo gerado, e a primeira regeração apagou — por isso mora aqui. */
    return <EmpresaDesenho {...(this.renderVals() as any)} children={this.props.children} />;
  }
}

export { Logica as EmpresaLiga };

/* Data real de criação do lead (criadoEm vem do Proto). Antes a ficha afirmava "Hoje" ou uma data fixa de exemplo para todo mundo. */
function dataCriacao(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "");
}
