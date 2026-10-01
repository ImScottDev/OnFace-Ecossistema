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
import { usePathname, useRouter } from "next/navigation";

import { trilhaAtual } from "../navegacao";
import { CascaLiga } from "./CascaLiga";
import { rotaDoDesenho } from "./rota-do-desenho";
import { PecasHost } from "./pecas-host";
import { UsuarioDoProtoContexto, iniciaisDe, type UsuarioDoProto } from "./usuario-do-proto";
import { desenharRadar, tituloDoRadar } from "@/lib/nexo/radar-desenho";
import type { DadosRadar, MsgNexo } from "@/lib/nexo/painel";

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

class CascaLigada extends CascaLiga {
  constructor(props: any) {
    super(props);
    this.state = {
      ...this.state,
      nexoMsgs: { c0: [] },
      nexoConversas: [] as ConversaNexo[],
      nexoResumoReal: null as { texto: string; temAviso: boolean } | null,
      nexoRadares: {} as Record<string, DadosRadar | undefined>,
    };
  }

  componentDidMount() {
    super.componentDidMount();
    this.carregarNexo();
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
    pedirJson("/api/nexo/perguntar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversaId: id, pergunta, rota: this.props.rota ?? "/", area: this.props.titulo ?? "" }),
    })
      .then((d: { configurada: boolean; mensagem: MsgNexo }) => {
        this.setState((s: any) => ({ nexoMsgs: { ...s.nexoMsgs, [id]: (s.nexoMsgs[id] || []).concat([d.mensagem]) } }));
        if (d.configurada) pedirJson("/api/nexo/painel").then((p) => this.setState({ nexoConversas: p.conversas })).catch(() => {});
      })
      .catch((e) => this.setState((s: any) => ({
        nexoMsgs: { ...s.nexoMsgs, [id]: (s.nexoMsgs[id] || []).concat([{ de: "oni", texto: `Não consegui falar com o NEXO (${e.message}).` }]) },
      })))
      .finally(() => this.setState({ nexoPensando: false }));
  }

  render() {
    const el = super.render();
    if (this.state.nexoResumoReal?.temAviso) return el;
    // O ponto pulsante é markup fixo do desenho (gerado); sem aviso real, some.
    return <>{el}<style>{`button[title^="NEXO"] span[style*="of-pisca"]{display:none}`}</style></>;
  }

  renderVals() {
    const v: any = super.renderVals();
    const n: number | null = this.props.naoLidas ?? null;
    const S = this.state;
    v.nexoResumo = S.nexoResumoReal?.texto ?? "";
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
      nx.mensagens = (nx.mensagens || []).map((m: any, i: number) => ({
        ...m,
        acoes: (m.acoes || []).map((a: any, j: number) => {
          const href = msgs[i]?.acoes?.[j]?.href;
          return { ...a, onClick: () => (href ? navegar(href) : undefined) };
        }),
      }));
    }

    const enviar = () => { const t = String(S.nexoRascunho || "").trim(); if (t) this.perguntarNexo(t); };
    nx.enviar = enviar;
    nx.tecla = (e: React.KeyboardEvent) => { if (e.key === "Enter") enviar(); };
    if (!(ehRadar && !dados)) {
      nx.sugestoes = (nx.sugestoes || []).map((s: any) => ({ ...s, onClick: () => this.perguntarNexo(s.label) }));
    }
  }
}

export function CascaProto({
  children,
  naoLidas = null,
  usuario: sessao,
}: {
  children: React.ReactNode;
  /** O usuário da sessão, lido no layout. */
  usuario: { nome: string; email: string; organizacao: string };
  /** Conversas não lidas visíveis ao usuário, contadas no layout. */
  naoLidas?: number | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const trilha = trilhaAtual(pathname);
  const usuario = React.useMemo<UsuarioDoProto>(
    () => ({ ...sessao, iniciais: iniciaisDe(sessao.nome) }),
    [sessao],
  );

  return (
    <UsuarioDoProtoContexto.Provider value={usuario}>
    {/* As peças do protótipo abrem por cima de qualquer tela: o hospedeiro
        fica por fora do miolo e a peça aberta é irmã dele. */}
    <PecasHost>
    <CascaLigada
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
  );
}
