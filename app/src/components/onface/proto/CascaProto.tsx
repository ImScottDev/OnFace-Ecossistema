"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * A casca do produto, servida pelo desenho.
 *
 * `CascaLiga` é a lógica de `OnFace Casca.dc.html`, portada; `CascaDesenho` é
 * o markup, convertido. Este arquivo é o que falta entre eles e o Next: de
 * onde vêm a rota, o título e a navegação de verdade.
 *
 * O protótipo recebe `titulo` e `subtitulo` por prop porque lá cada tela é um
 * arquivo que importa a moldura e passa os seus. Aqui é um layout só para
 * todas as rotas, então o título sai de `trilhaAtual(pathname)` — a mesma
 * fonte que a topbar antiga usava, para as duas nunca divergirem.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

import { arvoreDoMenu, trilhaAtual } from "../navegacao";
import { CascaLiga } from "./CascaLiga";
import { rotaDoDesenho } from "./rota-do-desenho";
import { PecasHost } from "./pecas-host";
import { AgentesDaOrgContexto } from "@/components/ui/avatar";
import { VerComo } from "../VerComo";
import { UsuarioDoProtoContexto, iniciaisDe, type UsuarioDoProto } from "./usuario-do-proto";
import { desenharRadar, tituloDoRadar } from "@/lib/nexo/radar-desenho";
import type { DadosRadar, MsgNexo } from "@/lib/nexo/painel";
import { perguntarAoNexo, botoesDaResposta, confirmarAcaoDoNexo } from "@/lib/nexo/cliente";
import { RespostaRica } from "../nexo/RespostaRica";
import { labelsEmBreve } from "@/lib/areas-em-breve";

/* O menu do desenho navega em `/onface-preview/…`, onde estas telas moraram
   antes de virar rota oficial. A tradução para a rota do produto mora em
   `rota-do-desenho.ts`, a mesma que todos os adaptadores usam — o mapa local
   que vivia aqui cobria só a casca e deixava as outras telas caírem em 404. */

/* Os números que a lógica portada traz FIXOS do protótipo: "3" no atalho do
   Atendimento e "3 avisos · 2 insights" no NEXO. A `CascaLiga` é gerada e não
   se edita, então a troca mora aqui, por cima do que ela calcula.
   - Atendimento: a contagem real que o layout manda; sem número (0 ou falha),
     sem badge.
   - NEXO: o resumo do botão vem de `/api/nexo/painel` (sem responsável · sem
     próxima ação, no escopo do papel); sem aviso, fica vazio. */
/* NEXO (⌘J) ligado de verdade — `lib/nexo/painel.ts` + `/api/nexo/*`.
   O protótipo trazia saudação, histórico, radar e respostas inventados; aqui
   cada pedaço vem do banco (escopo do papel) ou do agente NEXO da organização.
   O ponto pulsante só aparece quando há aviso real. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ConversaNexo = { id: string; titulo: string; quando: string };

async function pedirJson(url: string, init?: RequestInit): Promise<any> {
  const r = await fetch(url, { credentials: "same-origin", ...init });
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(corpo?.error || `HTTP ${r.status}`);
  return corpo;
}

/* Notificações: pessoais por desenho. `/api/notificacoes` já filtra pelo
   usuário da sessão, então o vendedor vê os leads dele e não a desgraça inteira
   da operação. O sino do protótipo nunca foi ligado nisso: a lista vinha vazia
   e o ponto vermelho ficava aceso de qualquer jeito. */
type Notificacao = { id: string; titulo: string; mensagem: string | null; tipo: string; lida: boolean; link: string | null; createdAt: string };

/** "agora", "há 20 min", "ontem" — o que a linha do sino mostra. */
function quando(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

class CascaLigada extends CascaLiga {
  /* O menu do produto sai de `NAVEGACAO`, não da árvore cravada em
     `CascaLiga.arvore()` (gerada, de 22/09). As duas divergiram: a cravada não
     tinha Atendimento, Chamados, Risco / Churn nem Uso da Callface AI, marcava
     três telas prontas como pendentes e não marcava a única pendente de
     verdade. A árvore da Liga não é mais consultada — ver `arvoreDoMenu`.
     "Em breve" segue AREAS_EM_BREVE do ambiente (lida no layout). */
  arvore() {
    return arvoreDoMenu(labelsEmBreve(this.props.areasEmBreve ?? []));
  }

  /* Área acesa no menu. A da Liga casa prefixo contra os `href` da árvore, o
     que não cobre rota herdada (`/empresas`, `/leads`, `/financeiro`…) nem
     página de nome próprio (`/vendas`). `trilhaAtual` é a mesma fonte do
     título da barra do topo: menu e cabeçalho nunca divergem. */
  area(rota: string): string | null {
    const t = trilhaAtual(rota);
    return t ? (t.area ?? t.item) : null;
  }

  constructor(props: any) {
    super(props);
    this.state = {
      ...this.state,
      notificacoes: [] as Notificacao[],
      naoLidasNotificacao: 0,
      nexoMsgs: { c0: [] },
      nexoConversas: [] as ConversaNexo[],
      nexoResumoReal: null as { texto: string; temAviso: boolean } | null,
      nexoRadares: {} as Record<string, DadosRadar | undefined>,
    };
  }

  componentDidMount() {
    super.componentDidMount();
    window.addEventListener("onface:nexo-abrir", this.abrirNexoDaTela as EventListener);
    this.carregarNexo();
    void this.carregarNotificacoes();
    this._notifI = setInterval(() => void this.carregarNotificacoes(), 60000);
    /* Quem pode "ver como" é o SERVIDOR que diz: a rota responde 403 para quem
       não passa por `podeVerComo`. Só com o sim dela o item entra no menu —
       assim ninguém esbarra num diálogo que não lista ninguém, e a permissão
       continua morando no back, não no cliente. */
    void fetch("/api/admin/view-as", { credentials: "same-origin" })
      .then((r) => { if (r.ok) this.setState({ podeVerComo: true } as any); })
      .catch(() => undefined);
  }

  componentWillUnmount() {
    window.removeEventListener("onface:nexo-abrir", this.abrirNexoDaTela as EventListener);
    if ((super.componentWillUnmount as any)) (super.componentWillUnmount as any)();
    clearInterval(this._notifI);
  }

  _notifI: any = null;

  abrirNexoDaTela = (evento: CustomEvent<{ pergunta?: string }>) => {
    const pergunta = evento.detail?.pergunta?.trim();
    this.setState({ nexoAberto: true, nexoAba: null, nexoPensando: false }, () => {
      if (pergunta) this.perguntarNexo(pergunta);
    });
  };

  async carregarNotificacoes() {
    try {
      const d = await pedirJson("/api/notificacoes");
      this.setState({
        notificacoes: Array.isArray(d?.notificacoes) ? d.notificacoes : [],
        naoLidasNotificacao: Number(d?.naoLidas || 0),
      });
    } catch {
      /* Sino não é razão para quebrar a casca: sem resposta, fica vazio. */
    }
  }

  async marcarTudoLido() {
    try {
      await pedirJson("/api/notificacoes", { method: "PATCH" });
      await this.carregarNotificacoes();
      return true;
    } catch {
      return false;
    }
  }

  componentDidUpdate(_prevProps?: any, prevState?: any) {
    super.componentDidUpdate();
    const S = this.state;
    if (S.nexoAberto && !prevState?.nexoAberto) this.carregarNexo();
    const aba = S.nexoAba;
    if (S.nexoAberto && (aba === "mes" || aba === "semana") && !S.nexoRadares[aba] && this._radarPedido !== aba) {
      this._radarPedido = aba;
      pedirJson(`/api/nexo/radar?modo=${aba}`)
        .then((d: DadosRadar) => this.setState((s: any) => ({ nexoRadares: { ...s.nexoRadares, [aba]: d } })))
        .catch((e) => this.diz(`Radar indisponível: ${e.message}`, "erro"))
        .finally(() => { this._radarPedido = null; });
    }
    this.corrigirTextoFixo();
  }

  /* Dois textos fixos do CascaDesenho (gerado, não se edita) que mentem com
     dado real: o placeholder com erro de digitação e a legenda "meta" da linha
     pontilhada, que aqui é o período anterior (não há meta de qualificados).
     React não reescreve atributo/texto estático, então o ajuste no DOM fica. */
  corrigirTextoFixo() {
    if (!this.state.nexoAberto || typeof document === "undefined") return;
    document.querySelectorAll<HTMLInputElement>('input[placeholder^="Oii"]').forEach((i) => {
      i.placeholder = "Pergunte ao NEXO sobre os seus números";
    });
    const ant = this.state.nexoAba === "semana" ? "semana anterior" : "mês anterior";
    document.querySelectorAll<HTMLElement>('span[style*="dotted"] + span').forEach((s) => {
      // Troca o valor do MESMO nó de texto: React segue dono dele.
      const t = s.firstChild;
      if (t?.nodeType === 3 && /^(meta|mês anterior|semana anterior)$/.test(t.nodeValue ?? "")) t.nodeValue = ant;
    });
  }

  _radarPedido: string | null = null;
  _carregando = false;

  /** Saudação, histórico e resumo do botão — a cada abertura, para não envelhecer. */
  carregarNexo() {
    if (this._carregando) return;
    this._carregando = true;
    if (!this.state.nexoMsgs.c0?.length) this.setState({ nexoPensando: this.state.nexoConversa === "c0" });
    pedirJson("/api/nexo/painel")
      .then((d: { saudacao: MsgNexo[]; resumo: { texto: string; temAviso: boolean }; conversas: ConversaNexo[] }) =>
        this.setState((s: any) => ({
          nexoMsgs: { ...s.nexoMsgs, c0: d.saudacao },
          nexoConversas: d.conversas,
          nexoResumoReal: d.resumo,
          nexoRadares: {}, // números novos: o radar recalcula na próxima abertura da aba
          nexoPensando: s.nexoConversa === "c0" ? false : s.nexoPensando,
        })))
      .catch((e) => this.setState((s: any) => ({
        nexoMsgs: { ...s.nexoMsgs, c0: [{ de: "oni", texto: `Não consegui ler os seus números agora (${e.message}).` }] },
        nexoPensando: false,
      })))
      .finally(() => { this._carregando = false; });
  }

  abrirConversa(id: string) {
    this.setState({ nexoAba: null, nexoConversa: id, nexoPensando: false });
    if (id === "c0" || this.state.nexoMsgs[id]?.length) return;
    this.setState({ nexoPensando: true });
    pedirJson(`/api/nexo/conversas/${id}`)
      .then((d: { mensagens: MsgNexo[] }) => this.setState((s: any) => ({ nexoMsgs: { ...s.nexoMsgs, [id]: d.mensagens } })))
      .catch((e) => this.diz(`Conversa indisponível: ${e.message}`, "erro"))
      .finally(() => this.setState({ nexoPensando: false }));
  }

  perguntarNexo(pergunta: string) {
    const S = this.state;
    if (S.nexoPensando) return;
    // A saudação ("c0") e a conversa nova local ainda não existem no banco:
    // a primeira pergunta abre uma conversa com id de verdade.
    const atual = S.nexoConversa;
    const id = UUID_RE.test(atual) ? atual : crypto.randomUUID();
    const anteriores = atual === "c0" ? [] : (S.nexoMsgs[atual] || []);
    this.setState((s: any) => ({
      nexoAba: null, nexoConversa: id, nexoRascunho: "", nexoPensando: true,
      nexoMsgs: { ...s.nexoMsgs, [id]: anteriores.concat([{ de: "eu", texto: pergunta }]) },
    }));
    perguntarAoNexo({ conversaId: id, pergunta, rota: this.props.rota ?? "/", area: this.props.titulo ?? "" })
      .then((d) => {
        // Ação sugerida pelo NEXO = botão que navega; o que muda estado a pessoa confirma na tela de destino.
        const rr = botoesDaResposta(d);
        const mensagem = { ...d.mensagem, texto: rr.texto, acoes: rr.botoes.map((b) => ({ label: b.rotulo, tom: "primario" as const, href: b.href ?? "", confirmar: b.confirmar })) } as MsgNexo;
        this.setState((s: any) => ({ nexoMsgs: { ...s.nexoMsgs, [id]: (s.nexoMsgs[id] || []).concat([mensagem]) } }));
        if (d.configurada && !d.falhou) pedirJson("/api/nexo/painel").then((p) => this.setState({ nexoConversas: p.conversas })).catch(() => {});
      })
      .catch((e) => this.setState((s: any) => ({
        nexoMsgs: { ...s.nexoMsgs, [id]: (s.nexoMsgs[id] || []).concat([{ de: "oni", texto: `Não consegui falar com o NEXO (${e.message}).` }]) },
      })))
      .finally(() => this.setState({ nexoPensando: false }));
  }

  render() {
    const el = super.render();
    /* "Ver como" fica fora do desenho de propósito: ele é do super admin, não
       do produto. Quem não pode nem recebe a lista — o componente some sozinho
       no 403 da rota, em vez de existir escondido por CSS. */
    const verComo = (
      <VerComo
        aberto={!!(this.state as any).verComoAberto}
        aoFechar={() => this.setState({ verComoAberto: false } as any)}
      />
    );
    if (this.state.nexoResumoReal?.temAviso) return <>{el}{verComo}</>;
    // O ponto pulsante é markup fixo do desenho (gerado); sem aviso real, some.
    return <>{el}{verComo}<style>{`button[title^="NEXO"] span[style*="of-pisca"]{display:none}`}</style></>;
  }

  renderVals() {
    const v: any = super.renderVals();
    const n: number | null = this.props.naoLidas ?? null;
    const S = this.state;

    /* O item só existe para quem a ROTA já confirmou que pode (ver o mount).
       A tela não decide permissão: ela pergunta e obedece. */
    v.itensPerfil = [
      ...(v.itensPerfil ?? []),
      ...(!(S as any).podeVerComo ? [] : [{
        label: "Ver como…",
        d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
        atalho: "",
        onClick: () => this.setState({ perfilAberto: false, verComoAberto: true } as any),
      }]),
    ];
    v.nexoResumo = S.nexoResumoReal?.texto ?? "";

    /* Sino com as notificações reais do usuário. Antes a lista não existia no
       adaptador: a casca sempre caía no estado vazio e o ponto ficava aceso. */
    const todas: Notificacao[] = S.notificacoes ?? [];
    const filtro = S.filtroSino;
    /* A aba NEXO é só intervenção proativa do agente. Nenhum tipo gravado hoje
       vem do NEXO, então ela fica honestamente vazia até existir. */
    const daAba = filtro === "nao_lidas" ? todas.filter((x) => !x.lida)
      : filtro === "nexo" ? todas.filter((x) => x.tipo.startsWith("nexo_"))
      : todas;
    v.temNotificacao = (S.naoLidasNotificacao ?? 0) > 0;
    v.itensSino = daAba.slice(0, 30).map((x) => ({
      id: x.id,
      titulo: x.titulo,
      texto: x.mensagem ?? "",
      quando: quando(x.createdAt),
      lida: x.lida,
      pontoStyle: "flex:0 0 auto;width:7px;height:7px;border-radius:9999px;margin-top:6px;background:" + (x.lida ? "transparent" : "var(--of-coral-marca)"),
      linhaStyle: "display:flex;gap:9px;width:100%;text-align:left;padding:10px 14px;border-top:1px solid var(--of-fio);background:" + (x.lida ? "var(--of-papel)" : "var(--of-papel-alterno)"),
      abrir: () => {
        this.setState({ sinoAberto: false });
        void pedirJson(`/api/notificacoes/${x.id}`, { method: "PATCH" })
          .then(() => this.carregarNotificacoes())
          .catch(() => undefined);
        if (x.link) this.props.navegar?.(x.link);
      },
    }));
    v.sinoVazio = v.itensSino.length === 0;
    v.lerTudo = () => {
      if ((S.naoLidasNotificacao ?? 0) === 0) return this.diz("Não há nada não lido", "aviso");
      void this.marcarTudoLido().then((ok) =>
        this.diz(ok ? "Tudo marcado como lido" : "Não consegui marcar como lido", ok ? "ok" : "erro"));
    };
    v.verTudo = () => { this.setState({ sinoAberto: false }); this.props.navegar?.("/tarefas"); };
    this.ligarNexo(v.nexo);
    // O perfil do topo: o desenho trazia "Scott Ferraz · Callface" fixo.
    const u: UsuarioDoProto | null = this.props.usuario ?? null;
    v.usuarioNome = u?.nome ?? "";
    v.usuarioEmail = u?.email ?? "";
    v.usuarioIniciais = u?.iniciais ?? "";
    v.usuarioOrganizacao = u?.organizacao ?? "";
    v.qa.itens = v.qa.itens.map((it: { l: string }) =>
      it.l === "Atendimento"
        ? { ...it, n: n ? (n > 99 ? "99+" : String(n)) : "", temN: !!n }
        : it,
    );
    return v;
  }

  ligarNexo(nx: any) {
    const S = this.state;
    const navegar = (href: string) => { this.setState({ nexoAberto: false }); this.props.navegar?.(href); };
    const conv: string = S.nexoConversa;
    const conversas: ConversaNexo[] = S.nexoConversas;
    const ehRadar = S.nexoAba === "mes" || S.nexoAba === "semana";
    const dados: DadosRadar | undefined = ehRadar ? S.nexoRadares[S.nexoAba] : undefined;

    nx.contexto = [this.props.usuario?.nome, this.props.titulo].filter(Boolean).join(" · ");
    if (ehRadar && dados) {
      nx.titulo = tituloDoRadar(dados);
      nx.radar = desenharRadar(dados, navegar);
    } else if (ehRadar) {
      // Enquanto o radar não chega, nada de número de exemplo: corpo vazio e "pensando".
      nx.titulo = S.nexoAba === "mes" ? "Radar do mês" : "Radar da semana";
      nx.ehRadar = false; nx.ehChat = true; nx.mensagens = []; nx.pensando = true;
      nx.sugestoes = [];
    }

    const lista: ConversaNexo[] = [{ id: "c0", titulo: "Prioridades de hoje", quando: "hoje" }, ...conversas];
    if (conv !== "c0" && !lista.some((c) => c.id === conv) && (S.nexoMsgs[conv] || []).length) {
      const primeira = (S.nexoMsgs[conv] as MsgNexo[]).find((m) => m.de === "eu");
      lista.splice(1, 0, { id: conv, titulo: primeira?.texto.slice(0, 60) ?? "Nova conversa", quando: "hoje" });
    }
    if (!ehRadar) nx.titulo = lista.find((c) => c.id === conv)?.titulo ?? "Nova conversa";
    nx.historico = lista.map((h) => ({
      titulo: h.titulo, quando: h.quando,
      style: "display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border-radius:8px;border:0;cursor:pointer;text-align:left;background:"
        + (!ehRadar && conv === h.id ? "var(--of-shell-ativo);color:var(--of-calha)" : "transparent;color:var(--of-shell-tinta-2)"),
      onClick: () => this.abrirConversa(h.id),
    }));

    if (!ehRadar) {
      const msgs: MsgNexo[] = S.nexoMsgs[conv] || [];
      const edicoes: Record<string, string> = S.nexoEdicoes || {};
      const chaveDe = (c: { runId: string; passo: number }) => `${c.runId}:${c.passo}`;
      nx.mensagens = (nx.mensagens || []).map((m: any, i: number) => {
        /* Envio de WhatsApp: o rascunho do NEXO aparece editável antes do Confirmar.
           O texto que a pessoa deixar aqui é o que vai (o servidor grava o editado). */
        const rascunhos = (msgs[i]?.acoes || []).map((a) => a.confirmar).filter((c): c is { runId: string; passo: number; rascunho?: string } => !!c?.rascunho);
        const texto = m.ehOni ? <RespostaRica texto={msgs[i]?.texto ?? ""} navegar={navegar} /> : m.texto;
        return {
        ...m,
        texto: rascunhos.length ? <>
          {texto}
          {rascunhos.map((c) => (
            <textarea key={chaveDe(c)} aria-label="Mensagem de WhatsApp a enviar" rows={4}
              value={edicoes[chaveDe(c)] ?? c.rascunho}
              onChange={(e) => this.setState((s: any) => ({ nexoEdicoes: { ...(s.nexoEdicoes || {}), [chaveDe(c)]: e.target.value } }))}
              style={{ display: "block", width: "100%", marginTop: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--of-shell-borda, var(--of-linha-controle))", font: "inherit", fontSize: 13, lineHeight: 1.5, resize: "vertical", background: "var(--of-papel)", color: "var(--of-tinta)" }} />
          ))}
        </> : texto,
        acoes: (m.acoes || []).map((a: any, j: number) => {
          const href = msgs[i]?.acoes?.[j]?.href;
          const conf = (msgs[i]?.acoes?.[j] as { confirmar?: { runId: string; passo: number; rascunho?: string } } | undefined)?.confirmar;
          if (conf) return { ...a, onClick: () => void confirmarAcaoDoNexo({ runId: conf.runId, passo: conf.passo, ...(conf.rascunho ? { conteudo: edicoes[chaveDe(conf)] ?? conf.rascunho } : {}) }).then((r) => {
            this.diz(r.texto, r.ok ? "ok" : "erro");
            if (r.ok) {
              pedirJson(`/api/nexo/conversas/${conv}`)
                .then((d: { mensagens: MsgNexo[] }) => this.setState((s: any) => ({ nexoMsgs: { ...s.nexoMsgs, [conv]: d.mensagens } })))
                .catch(() => undefined);
              if (r.href) navegar(r.href);
            }
          }).catch(() => this.diz("Não consegui confirmar. Verifique a ação antes de tentar novamente.", "erro")) };
          return { ...a, onClick: () => (href ? navegar(href) : undefined) };
        }),
      }; });
    }

    const enviar = () => { const t = String(S.nexoRascunho || "").trim(); if (t) this.perguntarNexo(t); };
    nx.enviar = enviar;
    nx.tecla = (e: React.KeyboardEvent) => { if (e.key === "Enter") enviar(); };
    if (!(ehRadar && !dados)) {
      nx.sugestoes = (nx.sugestoes || []).map((s: any) => ({ ...s, onClick: () => this.perguntarNexo(s.label) }));
    }
  }
}

/* Selo "Em breve" no item do menu. O markup da casca é gerado e não aceita o
   componente Badge; o selo segue o mesmo desenho (pílula, texto xs, medium)
   pela cor corrente, sem hex. Só é injetado quando a área está fechada. */
const seloEmBreve = (labels: string[]) =>
  labels.map((label) => `nav > div > button[title="${label}"] > span::after {
  content: "Em breve"; margin-left: 0.5rem; padding: 0.0625rem 0.5rem;
  border: 1px solid currentColor; border-radius: 999px;
  font-size: 0.6875rem; font-weight: 500; letter-spacing: 0;
}`).join("\n");

export function CascaProto({
  children,
  naoLidas = null,
  usuario: sessao,
  agentes = [],
  areasEmBreve = [],
}: {
  children: React.ReactNode;
  /** Nomes dos agentes de IA da organização (selo de IA nos avatares). */
  agentes?: string[];
  /** O usuário da sessão, lido no layout. */
  usuario: { nome: string; email: string; organizacao: string };
  /** Conversas não lidas visíveis ao usuário, contadas no layout. */
  naoLidas?: number | null;
  /** Áreas fechadas neste ambiente (AREAS_EM_BREVE): ganham o selo no menu. */
  areasEmBreve?: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  /* O NEXO escreveu (criou atividade, moveu etapa...): as telas abertas releem o servidor. */
  React.useEffect(() => {
    const reler = () => router.refresh();
    window.addEventListener("onface:dados-mudaram", reler);
    return () => window.removeEventListener("onface:dados-mudaram", reler);
  }, [router]);
  const trilha = trilhaAtual(pathname);
  const usuario = React.useMemo<UsuarioDoProto>(
    () => ({ ...sessao, iniciais: iniciaisDe(sessao.nome) }),
    [sessao],
  );

  const nomesDeAgentes = React.useMemo(() => new Set(agentes), [agentes]);

  return (
    <AgentesDaOrgContexto.Provider value={nomesDeAgentes}>
    <UsuarioDoProtoContexto.Provider value={usuario}>
    {/* As peças do protótipo abrem por cima de qualquer tela: o hospedeiro
        fica por fora do miolo e a peça aberta é irmã dele. */}
    <PecasHost>
    {labelsEmBreve(areasEmBreve).length > 0 && <style>{seloEmBreve(labelsEmBreve(areasEmBreve))}</style>}
    <CascaLigada
      areasEmBreve={areasEmBreve}
      naoLidas={naoLidas}
      usuario={usuario}
      rota={pathname}
      titulo={trilha?.item ?? "ONFACE"}
      subtitulo={trilha?.apoio ?? ""}
      /* A trilha só aparece quando há um nível acima: numa tela raiz o topo
         mostra título e subtítulo, e repetir a área ali seria dizer duas vezes
         onde a pessoa está. */
      /* Só os níveis ACIMA da página. O título já mostra o item; repeti-lo na
         trilha dava "Execuções › Execuções" e "Visão Geral › Visão Geral" —
         no protótipo a trilha é o caminho até aqui, não o lugar onde se está. */
      trilha={trilha?.area ? [{ label: trilha.area }] : []}
      /* Sair tem que encerrar a sessão de verdade: antes o botão só mostrava
         um aviso e a pessoa seguia logada. */
      sair={() => void signOut({ callbackUrl: "/login" })}
      ir={(href: string) => router.push(rotaDoDesenho(href))}
      /* Rota real do produto (ações e sinais do NEXO), sem tradução do desenho. */
      navegar={(href: string) => router.push(href)}
    >
      {/* O protótipo entrega o miolo sem recuo, porque as telas dele pintam o
          próprio fundo até a borda. As outras ~80 telas do produto esperam o
          recuo da casca — `onface-conteudo-interno` o devolve, e o CSS já
          sabe zerá-lo para quem traz `data-workspace="desenho"`. */}
      <div className="onface-conteudo-interno">{children}</div>
    </CascaLigada>
    </PecasHost>
    </UsuarioDoProtoContexto.Provider>
    </AgentesDaOrgContexto.Provider>
  );
}
