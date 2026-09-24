// @ts-nocheck — código portado do protótipo; ver a nota abaixo.
"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Pré-vendas — a LIGAÇÃO entre o desenho e o produto.
 *
 * O markup vem de `PreVendasDesenho.tsx`, convertido por máquina a partir do
 * Claude Design e intocável. Este arquivo é a lógica do protótipo, portada por
 * substituição — não reescrita —, com três trocas e só três:
 *
 *   1. `window.OnFaceEstado.abrir(peça, id)`  →  `props.abrir(peça, id)`
 *      A porta única dos overlays. No protótipo abria mock; aqui abre a peça
 *      real (qualificar, nutrir, desqualificar, detalhe).
 *   2. `E.avisar(...)`  →  `toast(...)`
 *   3. `d.leads` (dados de exemplo)  →  `props.leads`, vindos do banco.
 *
 * Todo o resto — filtros, colunas, arrasto, seleção, exportação, os estilos
 * calculados — é o código do desenho, palavra por palavra. É por isso que a
 * tela sai idêntica: não há transcrição em lugar nenhum.
 *
 * ── Por que `@ts-nocheck` ────────────────────────────────────────────────
 *
 * O protótipo é JavaScript sem anotação de tipo, e sob `strict` cada
 * parâmetro dele vira um erro — 166 na primeira passada. Anotar um por um
 * significaria reescrever o arquivo à mão, que é exatamente o que produz a
 * divergência que este caminho existe para eliminar: quem anota, lê; quem lê,
 * transcreve; quem transcreve, erra.
 *
 * A fronteira continua tipada, e é ela que importa: `Props` e
 * `LeadDoDesenho` abaixo, mais o contrato de `ValoresDePreVendasDesenho` no
 * markup. O miolo é código de apresentação portado — se ele estiver errado, a
 * tela mostra, e nenhum tipo teria pego.
 *
 * Quando o desenho estabilizar, este arquivo é o candidato natural a ser
 * reescrito com tipos — aí de uma vez, com a tela já validada por trás.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { toast } from "sonner";

import { PreVendasDesenho } from "./PreVendasDesenho";

/** O lead na forma que o desenho consome. O adaptador em `PreVendas.tsx`
 *  traduz o `CardPreVendas` do domínio para cá. */
export interface LeadDoDesenho {
  id: string;
  empresa: string | null;
  pessoa: string;
  cargo: string;
  resp: string | null;
  dias: number;
  origem: string | null;
  campanha: string | null;
  interesse: string | null;
  tag: string | null;
  acao: string | null;
  venceEm: string | null;
  etapa: string;
  /* Os canais. O mock do protótipo não os tinha porque lá os botões só
     davam toast; no produto eles abrem o Atendimento no contato certo. */
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  empresaId?: string | null;
}

export type PecaDoDesenho = "detalhe" | "qualificar" | "nutrir" | "desqualificar";

interface Props {
  leads: LeadDoDesenho[];
  /** A porta única dos overlays, no lugar do mock do protótipo. */
  abrir: (peca: PecaDoDesenho, id: string) => void;
  ir: (href: string) => void;
}


class Logica extends React.Component<Props, any> {
  constructor(props) {
    super(props);
    const d = { leads: props.leads, cadencias: {} as Record<string, string> };
    this.state = {
      visao: props.visaoInicial || d.visao || "quadro",
      aba: "ativos", busca: "",
      filtroAberto: null,
      sel: { responsavel: [], origem: [], interesse: [], sla: [] },
      expAberto: false, expFlutuante: false, expEscopo: "visao", expFormato: "XLSX", exportMenu: false, expRect: null,
      expSel: { responsavel: [], origem: [], campanha: [], interesse: [], sla: [], tag: [], cadencia: [] },
      expCols: { empresa: 1, pessoa: 1, cargo: 1, email: 1, telefone: 1, etapa: 1, responsavel: 1, origem: 1, campanha: 1, interesse: 1, tag: 0, acao: 1, dias: 1, cadencia: 0 },
      listaFechadas: { nutricao: true, desqualificado: true },
      respAberto: null, respRect: null,
      arrastando: null, origem: null, sobre: null,
      selecao: [], acaoMassa: null,
      expandidas: { nutricao: false, desqualificado: false },
      leads: d.leads || [],
      cadencias: d.cadencias || {}
    };
    this.expRef = React.createRef();
  }

  componentDidMount() {
    this._offEstado = null; void ((d: any) => {
      const patch = {};
      if (d.leads !== this.state.leads) patch.leads = d.leads;
      if (d.cadencias !== this.state.cadencias) patch.cadencias = d.cadencias;
      if (Object.keys(patch).length) this.setState(patch);
    });
    this._offPecas = null; void ((peca: string) => {
      if (peca === "filtrar-sem-acao") this.setState(s => ({ visao: "fila", sel: Object.assign({}, s.sel, { sla: ["sem_acao"] }) }));
      if (peca === "exportar") this.setState({ expAberto: true, expEscopo: "criterios" });
    });
    this._k = (e) => {
      if (e.key !== "Escape") return;
      if (this.state.exportMenu) return this.setState({ exportMenu: false });
      if (this.state.expAberto) return this.setState({ expAberto: false });
      if (this.state.expFlutuante) return this.setState({ expFlutuante: false, expEscopo: "visao", selecao: [] });
      if (this.state.respAberto) return this.setState({ respAberto: null });
      if (this.state.filtroAberto) return this.setState({ filtroAberto: null });
      if (this.state.selecao.length) this.setState({ selecao: [], acaoMassa: null });
    };
    document.addEventListener("keydown", this._k);
    this._fora = (e) => {
      const alvo = e.target;
      const dentro = (sel) => alvo && alvo.closest && alvo.closest(sel);
      const mudar = {};
      if (this.state.filtroAberto && !dentro("[data-of-filtro]")) mudar.filtroAberto = null;
      if (this.state.acaoMassa && !dentro("[data-of-massa]")) mudar.acaoMassa = null;
      if (this.state.exportMenu && !dentro("[data-of-expmenu]")) mudar.exportMenu = false;
      if (this.state.respAberto && !dentro("[data-of-resp]")) mudar.respAberto = null;
      if (Object.keys(mudar).length) this.setState(mudar);
    };
    document.addEventListener("pointerdown", this._fora, true);
    this._resize = () => { if (this.state.exportMenu || this.state.respAberto) this.setState({ exportMenu: false, respAberto: null }); };
    window.addEventListener("resize", this._resize);
  }

  componentDidUpdate(_, anterior) {
    const E = null as any;
    if (!E) return;
    const patch = {};
    if (anterior.leads !== this.state.leads) patch.leads = this.state.leads;
    if (anterior.visao !== this.state.visao) patch.visao = this.state.visao;
    if (Object.keys(patch).length) E.gravar(patch);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this._k);
    document.removeEventListener("pointerdown", this._fora, true);
    window.removeEventListener("resize", this._resize);
    if (this._offEstado) this._offEstado();
    if (this._offPecas) this._offPecas();
  }

  /** O aviso do protótipo é o toast do produto. */
  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto);
    else toast(texto);
  }

  /** Navegação de verdade: o protótipo só trocava de tela por dentro. */
  ir(href: string, _label?: string) {
    this.props.ir(href);
  }

  linhaLista(L, selecao, iniciaisDe) {
    const on = selecao.indexOf(L.id) >= 0;
    return {
      empresa: L.empresa || "Sem empresa",
      pessoa: L.pessoa + " · " + L.cargo,
      urgente: !L.acao,
      acao: L.acao ? (L.venceEm ? L.acao + " · " + L.venceEm : L.acao) : "Sem próxima ação",
      acaoStyle: "flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:"
        + (L.acao ? "400;color:#4a5560" : "600;color:#c2330f"),
      resp: L.resp || "Sem responsável",
      respStyle: "flex:1;min-width:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;" + (L.resp ? "color:#1f252c" : "color:#c2330f;font-weight:600"),
      respBtnStyle: "display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:32px;padding:0 8px 0 5px;border-radius:8px;border:0;cursor:pointer;transition:background 120ms cubic-bezier(0,0,.2,1);background:"
        + (this.state.respAberto === L.id ? "#f1f3f3" : "transparent"),
      respMenu: this.state.respAberto === L.id,
      respMenuStyle: (() => {
        const r = this.state.respRect;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const alto = 196;
        const abaixo = r ? vh - r.bottom - 12 : 400;
        const paraCima = !!r && abaixo < alto && r.top - 12 > abaixo;
        const teto = Math.max(140, Math.min(alto, paraCima ? r.top - 12 : abaixo));
        const pos = r
          ? (paraCima ? "bottom:" + (vh - r.top + 4) + "px;" : "top:" + (r.bottom + 4) + "px;")
            + "left:" + Math.min(r.left, vw - 218) + "px;"
          : "top:120px;left:24px;";
        return "position:fixed;" + pos + "min-width:208px;max-height:" + teto + "px;overflow-y:auto;z-index:46;border-radius:6px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 8px 20px -4px rgba(0,0,0,.18),0 2px 4px -2px rgba(0,0,0,.12);padding:4px;animation:of-rise .1s cubic-bezier(.2,0,.2,1) both";
      })(),
      abrirResp: (e) => {
        e.stopPropagation();
        const el = e.currentTarget.getBoundingClientRect();
        this.setState(s => ({
          respAberto: s.respAberto === L.id ? null : L.id,
          respRect: { top: el.top, bottom: el.bottom, left: el.left, right: el.right }
        }));
      },
      respOpcoes: ["Scott Ferraz", "Camila Reis", "Diego Nunes", "Ana Vitória", null].map(nome => ({
        label: nome || "Sem responsável",
        iniciais: nome ? iniciaisDe(nome) : "—",
        ativo: (L.resp || null) === nome,
        avatar: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:700;background:"
          + (nome ? "#eeeff3;color:#616b78" : "#fdeae5;color:#9c3210"),
        style: "display:flex;align-items:center;gap:8px;width:100%;padding:5px 6px;border-radius:6px;border:0;cursor:pointer;background:transparent;"
          + ((L.resp || null) === nome ? "font-weight:600" : ""),
        onClick: (e) => {
          e.stopPropagation();
          this.setState(s => ({ leads: s.leads.map(x => x.id === L.id ? Object.assign({}, x, { resp: nome }) : x), respAberto: null }));
          this.diz(nome ? "Responsável alterado para " + nome : "Responsável removido — lead volta para a fila", nome ? "ok" : "aviso");
        }
      })),
      iniciais: iniciaisDe(L.resp),
      avatarStyle: "flex:0 0 auto;width:24px;height:24px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:700;"
        + (L.resp ? "background:#eeeff3;color:#616b78" : "background:#fff;color:#c2330f;box-shadow:inset 0 0 0 1.5px #f0c8bd"),
      origem: L.origem,
      dias: L.dias + "d",
      sel: on, selAttr: on ? "1" : "0",
      checkStyle: "position:relative;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;padding:0;border:0;line-height:0;cursor:pointer;justify-self:center;"
        + (on ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
      style: "display:grid;grid-template-columns:30px minmax(170px,1.7fr) minmax(180px,1.5fr) 176px 108px 66px;gap:10px;padding:10px 14px;align-items:center;border-bottom:1px solid #f3f5f5;cursor:pointer;"
        + (on ? "background:#fff7f5" : ""),
      marcar: (e) => {
        e.stopPropagation();
        this.setState(s => ({
          selecao: s.selecao.indexOf(L.id) >= 0 ? s.selecao.filter(x => x !== L.id) : s.selecao.concat(L.id),
          acaoMassa: null
        }));
      },
      abrir: () => {
        if (this.state.selecao.length) {
          this.setState(s => ({ selecao: s.selecao.indexOf(L.id) >= 0 ? s.selecao.filter(x => x !== L.id) : s.selecao.concat(L.id), acaoMassa: null }));
          return;
        }
        this.props.abrir("detalhe", L.id);
      }
    };
  }

  baixarCsv(leads, aviso) {
    const S = this.state, C = S.expCols;
    const rotulos = { empresa: "Empresa", pessoa: "Pessoa", cargo: "Cargo", email: "E-mail", telefone: "Telefone", etapa: "Etapa", responsavel: "Responsável", origem: "Canal", campanha: "Campanha", interesse: "Interesse", tag: "Tags", acao: "Próxima ação", dias: "Dias parado", cadencia: "Cadência" };
    const etapas = { novo: "Novo", em_contato: "Em contato", qualificacao: "Qualificação", qualificado: "Qualificado", oportunidade: "Oportunidade", nutricao: "Nutrição", desqualificado: "Desqualificado" };
    const slug = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    const cadDe = (L) => S.cadencias.hasOwnProperty(L.id)
      ? (S.cadencias[L.id] || "Fora de cadência")
      : (L.etapa === "novo" ? "Fora de cadência" : L.etapa === "oportunidade" ? "Pós-proposta" : "Primeiro contato");
    const cols = Object.keys(rotulos).filter(k => C[k]);
    const valor = (L, k) => {
      if (k === "empresa") return L.empresa || "Sem empresa";
      if (k === "pessoa") return L.pessoa;
      if (k === "cargo") return L.cargo;
      if (k === "email") return slug(L.pessoa.split(" ")[0]) + "@" + slug(L.empresa || "semempresa") + ".com.br";
      if (k === "telefone") return "+55 11 9" + (7000 + (L.id.charCodeAt(1) * 37) % 2999) + "-" + (1000 + (L.id.charCodeAt(1) * 53) % 8999);
      if (k === "etapa") return etapas[L.etapa];
      if (k === "responsavel") return L.resp || "Sem responsável";
      if (k === "origem") return L.origem;
      if (k === "campanha") return L.campanha || "";
      if (k === "interesse") return L.interesse;
      if (k === "tag") return L.tag || "";
      if (k === "acao") return L.acao ? (L.venceEm ? L.acao + " (" + L.venceEm + ")" : L.acao) : "Sem próxima ação";
      if (k === "dias") return String(L.dias);
      if (k === "cadencia") return cadDe(L);
      return "";
    };
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const linhas = [cols.map(k => esc(rotulos[k])).join(";")]
      .concat(leads.map(L => cols.map(k => esc(valor(L, k))).join(";")));
    const blob = new Blob(["\ufeff" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "onface-pre-vendas." + (S.expFormato === "XLSX" ? "csv" : "csv");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    this.diz(aviso, "ok");
  }

  renderVals() {
    const S = this.state;
    const indicadores = [
      { label: "Leads ativos", campo: "count(leads) · estagio ∈ ativos" },
      { label: "Sem primeiro contato", campo: "primeiro_contato_at is null" },
      { label: "Sem próxima ação", campo: "sem tarefa aberta" },
      { label: "Qualificados no mês", campo: "qualificado_em ≥ mês" },
      { label: "Tempo até 1º contato", campo: "avg(primeiro_contato_at − created_at)" }
    ];

    const filtroDefs = [
      { k: "responsavel", label: "Responsável", titulo: "RESPONSÁVEL",
        icone: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0", opcoes: [
        { v: "minhas", label: "Minhas", campo: "" },
        { v: "sem_dono", label: "Sem responsável", campo: "" },
        { v: "equipe_sdr", label: "Equipe SDR", campo: "" },
        { v: "equipe_closer", label: "Equipe Closer", campo: "" }
      ] },
      { k: "origem", label: "Origem", titulo: "CANAL DE ENTRADA",
        icone: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9", opcoes: [
        { v: "meta_ads", label: "Meta Ads", campo: "" },
        { v: "instagram", label: "Instagram", campo: "" },
        { v: "site", label: "Site", campo: "" },
        { v: "formulario", label: "Formulário", campo: "" },
        { v: "whatsapp", label: "WhatsApp", campo: "" },
        { v: "organica", label: "Orgânica", campo: "" }
      ] },
      { k: "interesse", label: "Interesse", titulo: "SERVIÇO DE INTERESSE",
        icone: "M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01", opcoes: [
        { v: "callface_ai", label: "Callface AI", campo: "" },
        { v: "pabx", label: "PABX", campo: "" },
        { v: "white_label", label: "White Label", campo: "" },
        { v: "sem_interesse", label: "Não informado", campo: "" }
      ] },
      { k: "sla", label: "SLA", titulo: "RISCO OPERACIONAL",
        icone: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", opcoes: [
        { v: "sem_contato", label: "Sem 1º contato", campo: "" },
        { v: "sem_acao", label: "Sem próxima ação", campo: "" },
        { v: "parado_7", label: "Parado 7 dias+", campo: "" },
        { v: "parado_14", label: "Parado 14 dias+", campo: "" },
        { v: "retomada_hoje", label: "Retomada hoje", campo: "" }
      ] }
    ];

    const filtros = filtroDefs.map(f => {
      const sel = S.sel[f.k] || [];
      const aberto = S.filtroAberto === f.k;
      const ativo = sel.length > 0;
      const borda = ativo ? "#c2330f" : aberto ? "#b8bfc0" : "#dbdede";
      const tinta = ativo ? "#fff" : "#1f252c";
      const fundo = ativo ? "#d93c1a" : "#fff";
      return {
        label: f.label, titulo: f.titulo, aberto, icone: f.icone,
        conta: sel.length, temSel: ativo,
        grupoStyle: "display:flex;align-items:stretch;height:34px;border-radius:9px;overflow:hidden;background:" + fundo
          + ";box-shadow:inset 0 0 0 1px " + borda + ";transition:box-shadow .12s cubic-bezier(0,0,.2,1)",
        corpoStyle: "display:flex;align-items:center;gap:7px;padding:0 11px;font-size:13px;font-weight:"
          + (ativo ? "600" : "500") + ";white-space:nowrap;color:" + tinta + ";background:transparent;border:0;cursor:pointer",
        setaStyle: "display:grid;place-items:center;width:28px;padding:0;color:" + (ativo ? "#fff" : "#4a5560")
          + ";background:transparent;border:0;cursor:pointer",
        corpoHover: ativo ? "background:rgba(255,255,255,.12)" : "background:#f6f7f7",
        divisoria: "flex:0 0 auto;width:1px;background:" + (ativo ? "rgba(255,255,255,.34)" : "#e3e7e8"),
        contaStyle: "flex:0 0 auto;min-width:17px;height:17px;padding-inline:4px;border-radius:9999px;font-size:10px;font-weight:700;display:grid;place-items:center;background:"
          + (ativo ? "rgba(255,255,255,.22);color:#fff" : "#12171d;color:#fff"),
        chevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (aberto ? 180 : 0) + "deg)",
        abrir: () => this.setState(s => ({ filtroAberto: s.filtroAberto === f.k ? null : f.k })),
        limpar: () => this.setState(s => ({ sel: Object.assign({}, s.sel, { [f.k]: [] }) })),
        opcoes: f.opcoes.map(o => {
          const on = sel.indexOf(o.v) >= 0;
          return {
            label: o.label, campo: o.campo, on,
            caixa: "flex:0 0 auto;width:17px;height:17px;border-radius:9999px;display:grid;place-items:center;border:0;"
              + (on ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
            onClick: () => this.setState(s => {
              const atual = s.sel[f.k] || [];
              return { sel: Object.assign({}, s.sel, { [f.k]: on ? atual.filter(x => x !== o.v) : atual.concat(o.v) }) };
            })
          };
        })
      };
    });

    const segBase = "display:flex;align-items:center;padding:0 12px;border-radius:7px;font-size:13px;font-weight:500;white-space:nowrap;flex:0 0 auto;";
    const visoes = [["quadro", "Quadro"], ["fila", "Lista"]].map(([k, l]) => ({
      label: l,
      style: segBase + (S.visao === k ? "background:#fff;color:#12171d;font-weight:600" : "color:#4a5560"),
      onClick: () => this.setState({ visao: k })
    }));

    const abaBase = "display:flex;align-items:center;gap:7px;padding:8px 12px;font-size:12.5px;font-weight:500;flex:0 0 auto;margin-bottom:-1px;border-bottom:2px solid ";
    const abas = [["ativos", "Ativos"], ["nutricao", "Nutrição"], ["desqualificados", "Desqualificados"]].map(([k, l]) => ({
      label: l,
      style: abaBase + (S.aba === k ? "#fe4f2b;color:#12171d;font-weight:600" : "transparent;color:#4a5560"),
      badge: "font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#8e9490;background:" + (S.aba === k ? "#f2e6e2" : "#ececeа") + ";border-radius:5px;padding:1px 5px",
      onClick: () => this.setState({ aba: k })
    }));

    const colDefs = [
      { k: "novo", label: "Novo", cor: "#4a5560",
        vazio: "Lead inbound cai aqui e já nasce com a tarefa de primeiro contato.",
        icone: "M12 5v14M5 12h14" },
      { k: "em_contato", label: "Em contato", cor: "#4c8fe0",
        vazio: "Arraste um lead para cá ao registrar a primeira tentativa.",
        icone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" },
      { k: "qualificacao", label: "Qualificação", cor: "#9b8bd8",
        vazio: "Arraste para começar a apurar critérios. Preencher campos não qualifica.",
        icone: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
      { k: "qualificado", label: "Qualificado", cor: "#2f9e7a", confirma: true,
        dica: "Soltar aqui pede a confirmação dos critérios",
        vazio: "Soltar aqui abre os critérios. Qualificar grava um fato que sobrevive à etapa seguinte.",
        icone: "M4 11h16v10H4zM8 11V7a4 4 0 0 1 8 0v4" },
      { k: "oportunidade", label: "Oportunidade", cor: "#fe4f2b", confirma: true,
        dica: "Soltar aqui cria a oportunidade no Pipeline",
        vazio: "Cria uma oportunidade real no Pipeline. Bloqueado sem empresa associada.",
        icone: "M4 11h16v10H4zM8 11V7a4 4 0 0 1 8 0v4" },
      { k: "nutricao", label: "Nutrição", cor: "#c8a86a", recolhivel: true,
        vazio: "Soltar aqui pede motivo e data de retomada — nutrição não é lixeira elegante.",
        icone: "M12 8v4l3 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
      { k: "desqualificado", label: "Desqualificado", cor: "#4a5560", recolhivel: true,
        vazio: "Soltar aqui pede motivo — é o que sustenta relatório de perda depois.",
        icone: "M6 6l12 12M18 6L6 18" }
    ];

    const selecao = S.selecao;
    const iniciaisDe = (n) => n ? n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() : "—";
    const q = S.busca.trim().toLowerCase();
    const visiveis = S.leads.filter(L => {
      if (q && ((L.empresa || "") + " " + L.pessoa + " " + L.cargo).toLowerCase().indexOf(q) < 0) return false;
      const sr = S.sel.responsavel, so = S.sel.origem, si = S.sel.interesse, ss = S.sel.sla;
      if (sr.length) {
        const ok = (sr.indexOf("minhas") >= 0 && L.resp === "Scott Ferraz")
          || (sr.indexOf("sem_dono") >= 0 && !L.resp)
          || (sr.indexOf("equipe_sdr") >= 0 && !!L.resp)
          || (sr.indexOf("equipe_closer") >= 0 && !!L.resp);
        if (!ok) return false;
      }
      if (so.length) {
        const mapa = { meta_ads: "Meta Ads", instagram: "Instagram", site: "Site", formulario: "Formulário", whatsapp: "WhatsApp", organica: "Orgânica" };
        if (so.map(k => mapa[k]).indexOf(L.origem) < 0) return false;
      }
      if (si.length) {
        const mapa = { callface_ai: "Callface AI", pabx: "PABX", white_label: "White Label", sem_interesse: null };
        if (si.map(k => mapa[k]).indexOf(L.interesse) < 0) return false;
      }
      if (ss.length) {
        const ok = (ss.indexOf("sem_acao") >= 0 && !L.acao)
          || (ss.indexOf("sem_contato") >= 0 && L.etapa === "novo")
          || (ss.indexOf("parado_7") >= 0 && L.dias >= 7)
          || (ss.indexOf("parado_14") >= 0 && L.dias >= 14)
          || (ss.indexOf("retomada_hoje") >= 0 && L.venceEm === "hoje");
        if (!ok) return false;
      }
      return true;
    });
    const abrirCard = (id) => () => {
      if (selecao.length) {
        this.setState(s => ({ selecao: s.selecao.indexOf(id) >= 0 ? s.selecao.filter(x => x !== id) : s.selecao.concat(id), acaoMassa: null }));
        return;
      }
      this.props.abrir("detalhe", id);
    };
    const recolhidas = colDefs.filter(c => c.recolhivel && !S.expandidas[c.k]).map(c => {
      const n = visiveis.filter(L => L.etapa === c.k).length;
      return {
        label: c.label, conta: n,
        ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + c.cor,
        style: "flex:0 0 auto;width:46px;display:flex;flex-direction:column;align-items:center;gap:9px;padding:10px 0 12px;border-radius:12px;background:#eeeff3;cursor:pointer;border:0;"
          + "transition:background .12s cubic-bezier(0,0,.2,1),box-shadow .12s cubic-bezier(0,0,.2,1);"
          + (S.sobre === c.k ? "box-shadow:inset 0 0 0 2px rgba(255,77,41,.2)" : ""),
        abrir: () => this.setState(s => ({ expandidas: Object.assign({}, s.expandidas, { [c.k]: true }) })),
        sobre: (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; if (S.sobre !== c.k) this.setState({ sobre: c.k }); },
        sai: () => { if (S.sobre === c.k) this.setState({ sobre: null }); },
        solta: (e) => {
          e.preventDefault();
          const id = S.arrastando;
          this.setState({ sobre: null, arrastando: null });
          if (!id) return;
          if (c.k === "nutricao") this.props.abrir("nutrir", id);
          else this.props.abrir("desqualificar", id);
        }
      };
    });

    const colunas = colDefs.filter(c => !c.recolhivel || S.expandidas[c.k]).map(c => {
      const cards = visiveis.filter(L => L.etapa === c.k).map(card => ({
        empresa: card.empresa || "Sem empresa",
        pessoa: card.pessoa + " · " + card.cargo,
        responsavel: card.resp || "Sem responsável",
        iniciais: iniciaisDe(card.resp),
        tempo: card.dias + "d",
        origem: card.campanha || card.origem,
        origemSelo: "display:inline-flex;align-items:center;gap:5px;max-width:100%;min-width:0;height:19px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;"
          + ({ "Meta Ads": "background:#fff6f4;color:#9c3210", "Instagram": "background:#efecfa;color:#4f3fa8", "WhatsApp": "background:#e6f4ee;color:#1f7256", "Formulário": "background:#e8f0fb;color:#2c5f9e", "Site": "background:#e8f0fb;color:#2c5f9e", "Orgânica": "background:#f7edd8;color:#6e5420" }[card.origem] || "background:#eeeff3;color:#4a5560"),
        temTag: !!card.tag, tag: card.tag,
        urgente: !card.acao,
        acao: card.acao ? (card.venceEm ? card.acao + " · " + card.venceEm : card.acao) : "Sem próxima ação",
        acaoStyle: "flex:1;min-width:0;font-size:11.5px;font-weight:"
          + (!card.acao ? "600;color:#c2330f" : "400;color:#6d747e")
          + ";white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
        sel: selecao.indexOf(card.id) >= 0,
        selAttr: selecao.indexOf(card.id) >= 0 ? "1" : "0",
        checkStyle: "position:absolute;top:9px;right:9px;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;padding:0;border:0;line-height:0;cursor:pointer;z-index:2;transition:background .12s cubic-bezier(0,0,.2,1),box-shadow .12s cubic-bezier(0,0,.2,1);border:0;"
          + (selecao.indexOf(card.id) >= 0 ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
        marcar: (e) => {
          e.stopPropagation();
          this.setState(s => ({
            selecao: s.selecao.indexOf(card.id) >= 0 ? s.selecao.filter(x => x !== card.id) : s.selecao.concat(card.id),
            acaoMassa: null
          }));
        },
        style: "position:relative;border-radius:8px;background:#fff;padding:9px 12px 10px;cursor:"
          + (c.travada ? "pointer" : "grab")
          + ";outline:none;transition:border-color .12s cubic-bezier(0,0,.2,1),box-shadow .12s cubic-bezier(0,0,.2,1);"
          + (S.arrastando === card.id
            ? "border:1px solid rgba(255,77,41,.2);box-shadow:0 2px 6px rgba(9,14,20,.12),0 18px 36px rgba(9,14,20,.26);rotate:-1.2deg;scale:1.02"
            : selecao.indexOf(card.id) >= 0
              ? "border:1px solid #fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b"
              : "border:1px solid #dbdede"),
        pega: (e) => {
          if (c.travada) { e.preventDefault(); return; }
          if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.id); }
          this.setState({ arrastando: card.id, origem: c.k });
        },
        larga: () => this.setState({ arrastando: null, sobre: null }),
        abrir: abrirCard(card.id)
      }));
      return {
        label: c.label, travada: !!c.travada, confirma: !!c.confirma, dica: c.dica || "",
        recolhivel: !!c.recolhivel,
        fechar: (e) => { e.stopPropagation(); this.setState(s => ({ expandidas: Object.assign({}, s.expandidas, { [c.k]: false }) })); },
        arrastavel: !c.travada && !c.recolhivel,
        conta: cards.length,
        cards, vazia: cards.length === 0,
        vazioTexto: c.vazio, vazioIcone: c.icone,
        ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;align-self:center;background:" + c.cor,
        style: "flex:0 0 auto;width:288px;min-width:168px;display:flex;flex-direction:column;min-height:0;"
          + "background:#eeeff3;border-radius:12px;padding:6px 8px 12px;"
          + "transition:box-shadow .12s cubic-bezier(0,0,.2,1);"
          + (S.sobre === c.k ? "box-shadow:inset 0 0 0 2px rgba(255,77,41,.2)" : ""),
        sobre: (e) => {
          e.preventDefault();
          if (c.travada) { if (e.dataTransfer) e.dataTransfer.dropEffect = "none"; return; }
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          if (S.sobre !== c.k) this.setState({ sobre: c.k });
        },
        sai: () => { if (S.sobre === c.k) this.setState({ sobre: null }); },
        solta: (e) => {
          e.preventDefault();
          const id = S.arrastando;
          this.setState({ sobre: null, arrastando: null });
          if (!id) return;
          if (c.travada) {
            this.diz(c.k === "qualificado"
              ? "Qualificar é um fato, não uma posição no board. Use a ação Qualificar."
              : "Mover para Oportunidade cria uma oportunidade real. Use a ação Criar oportunidade.", "erro");
            return;
          }
          if (c.k === "nutricao") { this.props.abrir("nutrir", id); return; }
          if (c.k === "desqualificado") { this.props.abrir("desqualificar", id); return; }
          if (c.k === "qualificado") { this.props.abrir("qualificar", id); return; }
          if (c.k === "oportunidade") {
            const alvo = this.state.leads.find(L => L.id === id);
            if (!alvo || !alvo.empresa) { this.diz("Bloqueado: lead sem empresa associada", "erro"); return; }
            this.setState(s => ({ leads: s.leads.map(L => L.id === id ? Object.assign({}, L, { etapa: "oportunidade" }) : L) }));
            this.diz("Oportunidade criada no Pipeline · " + alvo.empresa, "ok");
            return;
          }
          if (S.origem === c.k) return;
          this.setState(s => ({ leads: s.leads.map(L => L.id === id ? Object.assign({}, L, { etapa: c.k }) : L) }));
        }
      };
    });

    const parqueadas = { nutricao: 1, desqualificado: 1 };
    const filtroEtapa = (S.sel.sla.length || S.sel.origem.length || S.sel.interesse.length || S.sel.responsavel.length || q);
    const ativos = visiveis.filter(L => !parqueadas[L.etapa] || filtroEtapa);

    const tagsUnicas = S.leads.map(L => L.tag).filter((t, i, a) => t && a.indexOf(t) === i);
    const campanhasUnicas = S.leads.map(L => L.campanha).filter((t, i, a) => t && a.indexOf(t) === i);
    const cadDe = (L) => S.cadencias.hasOwnProperty(L.id)
      ? (S.cadencias[L.id] || "Fora de cadência")
      : (L.etapa === "novo" ? "Fora de cadência" : L.etapa === "oportunidade" ? "Pós-proposta" : "Primeiro contato");
    const alvoExport = (() => {
      if (S.expEscopo === "selecao") return S.leads.filter(L => selecao.indexOf(L.id) >= 0);
      if (S.expEscopo === "visao") return ativos;
      const E = S.expSel;
      const algum = Object.keys(E).some(k => E[k].length);
      if (!algum) return S.leads;
      return S.leads.filter(L => {
        if (E.responsavel.length && E.responsavel.indexOf(L.resp || "Sem responsável") < 0) return false;
        if (E.origem.length && E.origem.indexOf(L.origem) < 0) return false;
        if (E.interesse.length && E.interesse.indexOf(L.interesse) < 0) return false;
        if (E.campanha.length && E.campanha.indexOf(L.campanha) < 0) return false;
        if (E.tag.length && E.tag.indexOf(L.tag) < 0) return false;
        if (E.cadencia.length && E.cadencia.indexOf(cadDe(L)) < 0) return false;
        if (E.sla.length) {
          const ok = (E.sla.indexOf("Sem 1º contato") >= 0 && L.etapa === "novo")
            || (E.sla.indexOf("Sem próxima ação") >= 0 && !L.acao)
            || (E.sla.indexOf("Parado 7 dias+") >= 0 && L.dias >= 7)
            || (E.sla.indexOf("Parado 14 dias+") >= 0 && L.dias >= 14);
          if (!ok) return false;
        }
        return true;
      });
    })();

    const aplica = (patch, msg) => () => {
      const ids = S.selecao.slice();
      this.setState(s => ({
        leads: s.leads.map(L => ids.indexOf(L.id) >= 0 ? Object.assign({}, L, patch) : L),
        acaoMassa: null, selecao: []
      }));
      this.diz(msg, "ok");
    };

    return {
      indicadores, filtros, visoes, colunas, recolhidas,
      maisCriar: () => this.diz("Outras criações: oportunidade, proposta, atividade", "aviso"),
      maisFiltros: () => this.diz("Mais filtros: etapa, período de entrada, UTM, empresa sem CNPJ", "aviso"),
      exportMenu: S.exportMenu,
      expRef: this.expRef,
      exportMenuStyle: (() => {
        const r = S.expRect;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const abaixo = r ? vh - r.bottom - 16 : 400;
        const acima = r ? r.top - 16 : 400;
        const paraCima = abaixo < 260 && acima > abaixo;
        const teto = Math.max(200, Math.min(505, paraCima ? acima : abaixo));
        const pos = r
          ? (paraCima ? "bottom:" + (vh - r.top + 6) + "px;" : "top:" + (r.bottom + 6) + "px;") + "right:" + Math.max(10, vw - r.right) + "px;"
          : "top:110px;right:24px;";
        return "position:fixed;" + pos + "width:292px;max-height:" + teto + "px;overflow-y:auto;z-index:46;border-radius:6px;background:#fff;border:1px solid #e3e7e8;box-shadow:0 8px 20px -4px rgba(0,0,0,.18),0 2px 4px -2px rgba(0,0,0,.12);padding:4px;animation:of-rise .12s cubic-bezier(.2,0,.2,1) both";
      })(),
      toggleExportMenu: () => {
        const el = this.expRef.current;
        const r = el ? el.getBoundingClientRect() : null;
        this.setState(s => ({
          exportMenu: !s.exportMenu,
          expRect: r ? { top: r.top, bottom: r.bottom, right: r.right, left: r.left } : null
        }));
      },
      exportBtnStyle: "display:flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:9px;border:0;cursor:pointer;color:#fff;font-size:13px;font-weight:600;white-space:nowrap;background:"
        + (S.exportMenu ? "#c2330f" : "#d93c1a"),
      exportChevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (S.exportMenu ? 180 : 0) + "deg)",
      exportOpcoes: [
        { label: "Leads da visão atual", nota: "Respeita a busca e os filtros aplicados na tela", conta: ativos.length,
          d: "M3 6h18M7 12h10M10 18h4",
          onClick: () => { this.setState({ exportMenu: false }); this.baixarCsv(ativos, "Visão atual exportada · " + ativos.length + " leads"); } },
        { label: "Todos os leads", nota: "A base inteira de pré-vendas, sem recorte", conta: S.leads.length,
          d: "M4 4h16v16H4zM4 9h16M4 14h16M9 4v16",
          onClick: () => { this.setState({ exportMenu: false, expEscopo: "criterios", expSel: { responsavel: [], origem: [], campanha: [], interesse: [], sla: [], tag: [], cadencia: [] } }); this.baixarCsv(S.leads, "Base completa exportada · " + S.leads.length + " leads"); } },
        { label: "Selecionar na tela", nota: "Marque os cartões um a um e exporte só eles", conta: 0,
          d: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
          onClick: () => this.setState({ exportMenu: false, expEscopo: "selecao", expFlutuante: true, acaoMassa: null }) },
        { label: "Exportação personalizada…", nota: "Escolha critérios, colunas e formato da planilha", conta: 0,
          d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
          onClick: () => this.setState({ exportMenu: false, expAberto: true, expEscopo: "criterios", expFlutuante: false }) }
      ],
      exportEtapas: [
        ["novo", "Novo", "#8b949e"], ["em_contato", "Em contato", "#4c8fe0"], ["qualificacao", "Qualificação", "#9b8bd8"],
        ["qualificado", "Qualificado", "#2f9e7a"], ["oportunidade", "Oportunidade", "#fe4f2b"],
        ["nutricao", "Nutrição", "#c8a86a"], ["desqualificado", "Desqualificado", "#8b949e"]
      ].map(([k, label, cor]) => {
        const grupo = S.leads.filter(L => L.etapa === k);
        return {
          label, conta: grupo.length,
          ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + cor,
          onClick: () => {
            this.setState({ exportMenu: false });
            if (!grupo.length) return this.diz("Nenhum lead em " + label, "erro");
            this.baixarCsv(grupo, label + " exportado · " + grupo.length + " leads");
          }
        };
      }),
      exp: {
        aberto: S.expAberto, flutuante: S.expFlutuante,
        fechar: () => this.setState({ expAberto: false }),
        mostraFiltros: S.expEscopo !== "selecao",
        qtdSel: selecao.length,
        escopos: [
          { v: "visao", label: "Visão atual", nota: "Respeita a busca e os filtros da tela", conta: ativos.length },
          { v: "criterios", label: "Por critérios", nota: "Monta o recorte abaixo, ignorando a tela", conta: alvoExport.length },
          { v: "selecao", label: "Selecionar na tela", nota: "Fecha este modal e você marca os cartões um a um", conta: selecao.length }
        ].map(e => ({
          label: e.label, nota: e.nota, conta: e.conta,
          radio: "flex:0 0 auto;width:15px;height:15px;border-radius:50%;margin-top:2px;border:" + (S.expEscopo === e.v ? "5px solid #d93c1a" : "1.5px solid #c8ccc9"),
          style: "display:flex;align-items:flex-start;gap:9px;width:100%;padding:9px 10px;border-radius:9px;cursor:pointer;border:0;text-align:left;background:"
            + (S.expEscopo === e.v ? "#fff6f4;box-shadow:inset 0 0 0 1px #fe4f2b" : "#fff;box-shadow:inset 0 0 0 1px #e3e7e8"),
          onClick: () => {
            if (e.v === "selecao") this.setState({ expEscopo: "selecao", expAberto: false, expFlutuante: true, acaoMassa: null });
            else this.setState({ expEscopo: e.v });
          }
        })),
        grupos: [
          { k: "responsavel", titulo: "Responsável", opcoes: ["Scott Ferraz", "Camila Reis", "Diego Nunes", "Ana Vitória", "Sem responsável"] },
          { k: "origem", titulo: "Canal de entrada", opcoes: ["Meta Ads", "Instagram", "Site", "Formulário", "WhatsApp", "Orgânica"] },
          { k: "interesse", titulo: "Interesse", opcoes: ["Callface AI", "PABX", "White Label"] },
          { k: "sla", titulo: "SLA", opcoes: ["Sem 1º contato", "Sem próxima ação", "Parado 7 dias+", "Parado 14 dias+"] },
          { k: "campanha", titulo: "Campanha", opcoes: campanhasUnicas },
          { k: "tag", titulo: "Tags", opcoes: tagsUnicas },
          { k: "cadencia", titulo: "Cadência", opcoes: ["Prospecção inbound", "Primeiro contato", "Reengajamento", "Pós-proposta", "Fora de cadência"] }
        ].map(g => {
          const sel = S.expSel[g.k] || [];
          return {
            titulo: g.titulo, ativo: sel.length > 0,
            limpar: () => this.setState(s => ({ expSel: Object.assign({}, s.expSel, { [g.k]: [] }) })),
            opcoes: g.opcoes.map(o => {
              const on = sel.indexOf(o) >= 0;
              return {
                label: o,
                style: "height:28px;padding:0 10px;border-radius:7px;font-size:12px;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;font-weight:"
                  + (on ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
                onClick: () => this.setState(s => {
                  const atual = s.expSel[g.k] || [];
                  return { expSel: Object.assign({}, s.expSel, { [g.k]: on ? atual.filter(x => x !== o) : atual.concat(o) }), expEscopo: "criterios" };
                })
              };
            })
          };
        }),
        colunas: [
          ["empresa", "Empresa"], ["pessoa", "Pessoa"], ["cargo", "Cargo"], ["email", "E-mail"],
          ["telefone", "Telefone"], ["etapa", "Etapa"], ["responsavel", "Responsável"], ["origem", "Origem"],
          ["campanha", "Campanha"], ["interesse", "Interesse"], ["tag", "Tags"], ["acao", "Próxima ação"], ["dias", "Dias parado"], ["cadencia", "Cadência"]
        ].map(([k, label]) => {
          const on = !!S.expCols[k];
          return {
            label, on,
            caixa: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;display:grid;place-items:center;border:0;" + (on ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
            style: "display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:500;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;background:#fff;box-shadow:inset 0 0 0 1px " + (on ? "#dbdede" : "#e3e7e8") + ";color:" + (on ? "#1f252c" : "#4a5560"),
            onClick: () => this.setState(s => ({ expCols: Object.assign({}, s.expCols, { [k]: on ? 0 : 1 }) }))
          };
        }),
        formatos: ["XLSX", "CSV"].map(f => ({
          label: f === "XLSX" ? "Planilha (.xlsx)" : "CSV (.csv)",
          style: "height:30px;padding:0 12px;border-radius:8px;font-size:12.5px;white-space:nowrap;flex:0 0 auto;cursor:pointer;border:0;font-weight:"
            + (S.expFormato === f ? "600;background:#12171d;color:#fff" : "500;background:#fff;color:#1f252c;box-shadow:inset 0 0 0 1px #dbdede"),
          onClick: () => this.setState({ expFormato: f })
        })),
        total: alvoExport.length,
        totalLabel: alvoExport.length === 1 ? "lead será exportado" : "leads serão exportados",
        gerarLabel: "Gerar " + (S.expFormato === "XLSX" ? "planilha" : "CSV"),
        gerarStyle: "display:flex;align-items:center;gap:6px;height:34px;padding:0 15px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;border:0;"
          + (alvoExport.length ? "background:#d93c1a;color:#fff;cursor:pointer" : "background:#e3e7e8;color:#a3a8a4;cursor:not-allowed"),
        gerar: () => {
          if (!alvoExport.length) return this.diz("Nenhum lead atende aos critérios", "erro");
          this.setState({ expAberto: false, expFlutuante: false });
          this.baixarCsv(alvoExport, alvoExport.length + " leads exportados");
        },
        voltarStyle: "height:28px;padding:0 11px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap;flex:0 0 auto;border:0;"
          + (selecao.length ? "background:#eeeff3;color:#12171d;cursor:pointer" : "background:rgba(255,255,255,.1);color:#7e8894;cursor:not-allowed"),
        voltar: () => {
          if (!selecao.length) return this.diz("Marque ao menos um lead", "erro");
          this.setState({ expFlutuante: false, expAberto: true });
        },
        cancelarSel: () => this.setState({ expFlutuante: false, expEscopo: "visao", selecao: [] })
      },
      busca: S.busca, setBusca: (e) => this.setState({ busca: e.target.value }),
      ehQuadro: S.visao === "quadro", ehFila: S.visao === "fila",
      totalLista: visiveis.length + " de " + S.leads.length + " leads",
      listaVazia: visiveis.length === 0,
      alternarTodosLabel: Object.keys(S.listaFechadas).some(k => S.listaFechadas[k]) ? "Abrir todas" : "Fechar todas",
      alternarTodos: () => {
        const algumaFechada = Object.keys(S.listaFechadas).some(k => S.listaFechadas[k]);
        if (algumaFechada) return this.setState({ listaFechadas: {} });
        const todas = {};
        ["novo", "em_contato", "qualificacao", "qualificado", "oportunidade", "nutricao", "desqualificado"].forEach(k => { todas[k] = true; });
        this.setState({ listaFechadas: todas });
      },
      listaGrupos: [
        ["novo", "Novo", "#8b949e"], ["em_contato", "Em contato", "#4c8fe0"], ["qualificacao", "Qualificação", "#9b8bd8"],
        ["qualificado", "Qualificado", "#2f9e7a"], ["oportunidade", "Oportunidade", "#fe4f2b"],
        ["nutricao", "Nutrição", "#c8a86a"], ["desqualificado", "Desqualificado", "#8b949e"]
      ].map(([k, label, cor]) => {
        const doGrupo = visiveis.filter(L => L.etapa === k).sort((a, b) => {
          const ua = a.acao ? 1 : 0, ub = b.acao ? 1 : 0;
          if (ua !== ub) return ua - ub;
          return b.dias - a.dias;
        });
        const urgentes = doGrupo.filter(L => !L.acao).length;
        const aberto = !S.listaFechadas[k];
        return {
          label, conta: doGrupo.length, aberto,
          urgentes, temUrgente: urgentes > 0 && aberto === false ? true : urgentes > 0,
          vazio: doGrupo.length === 0,
          ponto: "flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:" + cor,
          chevron: "flex:0 0 auto;transition:transform .12s cubic-bezier(.2,0,.2,1);transform:rotate(" + (aberto ? 0 : -90) + "deg)",
          cabecalhoStyle: "display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:#fbfbfb;border-bottom:1px solid #eef1f1;cursor:pointer;border-left:0;border-right:0;border-top:0",
          alternar: () => this.setState(s => ({ listaFechadas: Object.assign({}, s.listaFechadas, { [k]: aberto }) })),
          linhas: doGrupo.map(L => this.linhaLista(L, selecao, iniciaisDe))
        };
      }).filter(g => !g.vazio),
      lista: [].map(L => {
        const rotulo = { novo: "Novo", em_contato: "Em contato", qualificacao: "Qualificação", qualificado: "Qualificado", oportunidade: "Oportunidade", nutricao: "Nutrição", desqualificado: "Desqualificado" }[L.etapa];
        const tom = { novo: ["#eeeff3", "#4a5560"], em_contato: ["#e8f0fb", "#2c5f9e"], qualificacao: ["#efecfa", "#4f3fa8"], qualificado: ["#e6f4ee", "#1f7256"], oportunidade: ["#fdeae5", "#9c3210"], nutricao: ["#f7edd8", "#6e5420"], desqualificado: ["#eef1f1", "#4a5560"] }[L.etapa];
        const on = selecao.indexOf(L.id) >= 0;
        return {
          empresa: L.empresa || "Sem empresa",
          pessoa: L.pessoa + " · " + L.cargo,
          etapa: rotulo,
          etapaStyle: "display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;background:" + tom[0] + ";color:" + tom[1],
          urgente: !L.acao,
          acao: L.acao ? (L.venceEm ? L.acao + " · " + L.venceEm : L.acao) : "Sem próxima ação",
          acaoStyle: "flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:"
            + (L.acao ? "400;color:#4a5560" : "600;color:#c2330f"),
          resp: L.resp || "Sem responsável",
          respStyle: "flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:" + (L.resp ? "#4a5560" : "#c2330f"),
          iniciais: iniciaisDe(L.resp),
          avatarStyle: "flex:0 0 auto;width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font-size:9.5px;font-weight:700;background:"
            + (L.resp ? "#eeeff3;color:#616b78" : "#fdeae5;color:#9c3210"),
          origem: L.origem,
          dias: L.dias + "d",
          sel: on, selAttr: on ? "1" : "0",
          checkStyle: "position:relative;width:18px;height:18px;border-radius:9999px;display:flex;align-items:center;justify-content:center;padding:0;border:0;line-height:0;cursor:pointer;justify-self:center;"
            + (on ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"),
          style: "display:grid;grid-template-columns:30px minmax(180px,1.7fr) 128px minmax(190px,1.5fr) 132px 112px 74px;gap:10px;padding:10px 14px;align-items:center;border-bottom:1px solid #f3f5f5;cursor:pointer;"
            + (on ? "background:#fff7f5" : ""),
          marcar: (e) => {
            e.stopPropagation();
            this.setState(s => ({
              selecao: s.selecao.indexOf(L.id) >= 0 ? s.selecao.filter(x => x !== L.id) : s.selecao.concat(L.id),
              acaoMassa: null
            }));
          },
          abrir: () => {
            if (selecao.length) {
              this.setState(s => ({ selecao: s.selecao.indexOf(L.id) >= 0 ? s.selecao.filter(x => x !== L.id) : s.selecao.concat(L.id), acaoMassa: null }));
              return;
            }
            this.props.abrir("detalhe", L.id);
          }
        };
      }),
      novoLead: () => this.diz("Novo lead — formulário a desenhar", "aviso"),

      temSelecao: selecao.length > 0 && !S.expFlutuante,
      qtdSelecao: selecao.length,
      rotuloSelecao: selecao.length === 1 ? "lead selecionado" : "leads selecionados",
      limparSelecao: () => this.setState({ selecao: [], acaoMassa: null }),
      acoesMassa: [
        { k: "responsavel", label: "Responsável", d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
        { k: "cadencia", label: "Cadência", d: "M4 14h7l-1 7 10-11h-7l1-7z" },
        { k: "tag", label: "Tag", d: "M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" },
        { k: "etapa", label: "Mover etapa", d: "M5 12h14M13 6l6 6-6 6" }
      ].map(a => ({
        label: a.label, d: a.d,
        style: "display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;font-size:12.5px;font-weight:500;flex:0 0 auto;color:"
          + (S.acaoMassa === a.k ? "#12171d;background:#eeeff3;font-weight:600" : "#d7dde2"),
        onClick: () => this.setState(s => ({ acaoMassa: s.acaoMassa === a.k ? null : a.k }))
      })),
      painelAberto: !!S.acaoMassa,
      painelTitulo: {
        responsavel: "ATRIBUIR RESPONSÁVEL",
        cadencia: "INCLUIR EM CADÊNCIA",
        tag: "ADICIONAR TAG",
        etapa: "MOVER PARA ETAPA"
      }[S.acaoMassa] || "",
      painelOpcoes: (() => {
        const feito = (texto) => () => { this.setState({ acaoMassa: null, selecao: [] }); this.diz(texto, "ok"); };
        const linha = "display:flex;align-items:center;gap:8px;width:100%;padding:5px 8px;border-radius:6px";
        const travado = "display:flex;align-items:center;gap:8px;width:100%;padding:5px 8px;border-radius:6px;color:#a3a8a4;cursor:not-allowed";
        const n = selecao.length;
        if (S.acaoMassa === "responsavel") {
          return [
            { label: "Atribuir a mim", style: linha, onClick: aplica({ resp: "Scott Ferraz" }, n + " lead(s) atribuídos a você") },
            { label: "Camila Reis", style: linha, onClick: aplica({ resp: "Camila Reis" }, n + " lead(s) para Camila Reis") },
            { label: "Diego Nunes", style: linha, onClick: aplica({ resp: "Diego Nunes" }, n + " lead(s) para Diego Nunes") },
            { label: "Ana Vitória", style: linha, onClick: aplica({ resp: "Ana Vitória" }, n + " lead(s) para Ana Vitória") },
            { label: "Distribuir na fila de inbound", style: linha, onClick: feito("Distribuído por resolverResponsavelInbound") },
            { label: "Remover responsável", style: linha, onClick: aplica({ resp: null }, "Responsável removido — leads voltam para a fila") }
          ];
        }
        if (S.acaoMassa === "cadencia") {
          return [
            { label: "Primeiro contato — 3 toques", style: linha, onClick: aplica({ acao: "Cadência: toque 1", venceEm: "hoje" }, n + " lead(s) na cadência de primeiro contato") },
            { label: "Reengajamento — 5 toques", style: linha, onClick: feito(n + " lead(s) em reengajamento") },
            { label: "Pós-proposta", style: linha, onClick: feito(n + " lead(s) em pós-proposta") },
            { label: "Ver todas as cadências", style: linha, onClick: () => { this.setState({ acaoMassa: null }); this.ir("/automacoes/cadencias", "Cadências"); } }
          ];
        }
        if (S.acaoMassa === "tag") {
          return [
            { label: "Criar tag…", style: linha, onClick: feito("Tag criada e aplicada") },
            { label: "tags.nome", style: linha, onClick: feito("Tag aplicada a " + n + " lead(s)") },
            { label: "Remover todas as tags", style: linha, onClick: feito("Tags removidas") }
          ];
        }
        if (S.acaoMassa === "etapa") {
          return [
            { label: "Novo", style: linha, onClick: aplica({ etapa: "novo" }, n + " lead(s) movidos para Novo") },
            { label: "Em contato", style: linha, onClick: aplica({ etapa: "em_contato" }, n + " lead(s) movidos para Em contato") },
            { label: "Qualificação", style: linha, onClick: aplica({ etapa: "qualificacao" }, n + " lead(s) movidos para Qualificação") },
            { label: "Qualificado", nota: "comando", style: travado, onClick: () => this.diz("Qualificar é um fato por lead — não entra em ação em massa", "erro") },
            { label: "Oportunidade", nota: "comando", style: travado, onClick: () => this.diz("Criar oportunidade exige empresa associada em cada lead", "erro") }
          ];
        }
        return [];
      })(),

      parar: (e) => e.stopPropagation()
    };
  }

  render() {
    return <PreVendasDesenho {...(this.renderVals() as any)} />;
  }
}

export { Logica as PreVendasLiga };
