"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Atendimento — o adaptador.
 *
 * `AtendimentoDesenho` é o markup convertido do handoff e `AtendimentoLiga`
 * a lógica dele, portada. Os dois são GERADOS e não se editam. Este arquivo é
 * o que fica entre eles e o produto:
 *
 *   1. traduz o contato de WhatsApp (contatos + whatsapp_mensagens) para a
 *      "conversa" que o desenho consome;
 *   2. tira, por subclasse e por pós-processamento da saída, tudo que o
 *      protótipo FABRICA — conversas extras, e-mail e telefone gerados do
 *      nome, resposta automática do cliente, presença "Online", números de
 *      WhatsApp que não existem, IA que não está ligada;
 *   3. traduz cada gravação do desenho no command real, ou avisa que ele
 *      não existe.
 *
 * O dado vem cru de `lib/atendimento/tela.ts` (server component) e é
 * convertido aqui, no cliente, porque "espera há 26 min", "Hoje" e "09:52"
 * dependem do relógio de quem olha.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { analisarConversaDoAtendimento, abrirNexo } from "@/lib/nexo/cliente";

import type { ConversaAtendimento, DadosAtendimento, LeadAtendimento } from "@/lib/atendimento/tela";
import type { ContextoAtendimento, TarefaDoLead } from "@/lib/atendimento/contexto";
import type { CadenciaDoLead } from "@/lib/atendimento/cadencias";
import { ETAPAS_PIPELINE, ROTULO_ETAPA_PIPELINE, ROTULO_FAMILIA, ROTULO_ETAPA_PRE_VENDAS } from "@/lib/vendas/dominio";
import { nomeExibicao } from "@/components/crm2/atendimento/types";
import { AtendimentoLiga } from "./AtendimentoLiga";
import { rotaDoDesenho } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";
import { acaoCriarLead } from "@/app/(produto)/pre-vendas/actions";

/* ── Utilidades de tradução ────────────────────────────────────────────── */

const TZ = "America/Sao_Paulo";
const ICO_WA = "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z";
const ICO_TODAS = "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z";

/** "5511910861344" → "+55 (11) 91086-1344". Reusa a regra do inbox atual. */
function fmtTel(t: string | null | undefined): string | null {
  if (!t) return null;
  let d = t.replace(/\D/g, "");
  /* Base de Pré-vendas guarda "11999000000" (sem país); sem o 55 a máscara não casava e
     saía "1199 9000 000". */
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d ? nomeExibicao(d, d) : null;
}

const chaveDia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}
/** O separador de dia do chat: "Hoje", "Ontem" ou "12 set". */
function diaDe(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 86_400_000);
  if (chaveDia(d) === chaveDia(hoje)) return "Hoje";
  if (chaveDia(d) === chaveDia(ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: TZ }).replace(".", "");
}
/** A hora da linha da fila: "09:52" hoje, "Ontem", "22/09" antes disso. */
function horaDaLista(iso: string | null): string {
  if (!iso) return "";
  const dia = diaDe(iso);
  if (dia === "Hoje") return hhmm(iso);
  if (dia === "Ontem") return "Ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
}
function duracao(seg: number | null): string {
  if (seg == null) return "—";
  const m = Math.round(seg / 60);
  if (m < 1) return `${Math.round(seg)}s`;
  if (m < 60) return `${m}m ${String(Math.round(seg % 60)).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Rótulo de mensagem sem texto, pelo tipo real da mensagem. */
const ROTULO_TIPO: Record<string, string> = {
  audio: "Áudio", image: "Imagem", document: "Documento", video: "Vídeo",
  sticker: "Figurinha", location: "Localização", call: "Chamada de voz no WhatsApp",
};

/**
 * Lista que não aceita as conversas inventadas do protótipo.
 *
 * O Liga monta `convs = juntar(lista)` e `juntar` faz `base.concat(EXTRA)` —
 * duas conversas 100% fabricadas (c9 "Marcos", c10 "Rede Vivace") entravam em
 * TODA lista e em toda contagem (NA FILA, SLA, abas, não-lidas). `EXTRA` e
 * `juntar` são locais de `__rv()`, sem gancho por subclasse. O ponto de
 * contato é a LISTA que nós passamos: com um `concat` próprio que devolve só
 * a cópia dela, o `juntar` vira identidade e as extras nunca entram. Os outros
 * `concat` do Liga são chamados sobre arrays dele, não sobre esta.
 * Quando o script parar de gerar EXTRA, isto fica inerte sozinho.
 */
type SessaoDoSeletor = {
  id: string; label: string; fone: string | null; status: string;
  donoId: string | null; donoNome: string | null; donoTipo: "humano" | "agente" | null;
};

/** Caixa selecionada: um número (`id` da sessão) ou todos os números de um dono (`u:<id>`; `u:` = compartilhados). */
function filtraCaixa<T extends { sessaoId: string | null }>(lista: T[], cx: string | null | undefined, sessoes: Array<{ id: string; donoId: string | null }>): T[] {
  if (!cx) return lista;
  if (cx.startsWith("u:")) {
    const dono = cx.slice(2);
    const ids = new Set(sessoes.filter((s) => (s.donoId ?? "") === dono).map((s) => s.id));
    return lista.filter((c) => !!c.sessaoId && ids.has(c.sessaoId));
  }
  return lista.filter((c) => c.sessaoId === cx);
}

function semExtra<T>(arr: T[]): T[] {
  const a = arr.slice();
  Object.defineProperty(a, "concat", { value: function (this: T[]) { return Array.prototype.slice.call(this); } });
  return a;
}

/** Vencimento da tarefa como o bloco "Próxima ação" mostra: "05/10, 14:00", "05/10" (só data) ou "Sem data". */
function quandoDaTarefa(t: TarefaDoLead): string {
  if (!t.venceEm) return "Sem data";
  if (t.soData) { const [, m, d] = t.venceEm.slice(0, 10).split("-"); return `${d}/${m}`; }
  const dt = new Date(t.venceEm);
  return `${dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ })}, ${hhmm(dt.toISOString())}`;
}
const brl = (v: string | null) => v == null ? null : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ddmm = (d: string | null) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : null;

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

type MsgDesenho = Record<string, any>;

/**
 * O status do desenho a partir do domínio.
 *
 * O desenho tem seis (novo/atendimento/aguardando/interno/retornar/resolvida);
 * o contato tem `status` open|closed, `snoozed_until` e `responsavel_id`.
 * - closed → "resolvida"; adiado para o futuro → "retornar";
 * - sem dono → "novo" (hoje 0 dos 1.731 — todo contato nasce com a sessão do dono);
 * - última mensagem nossa → "aguardando" (cliente): é derivado, não gravável;
 * - o resto → "atendimento".
 * "interno" (aguardando outro time) NUNCA é emitido: não há coluna, tabela ou
 * evento que diga isso, e emitir seria inventar.
 */
function statusDe(c: ConversaAtendimento, agora: number): string {
  if (c.status === "closed") return "resolvida";
  if (c.snoozedUntil && new Date(c.snoozedUntil).getTime() > agora) return "retornar";
  if (!c.responsavelId) return "novo";
  if (c.ultimaDirecao === "out") return "aguardando";
  return "atendimento";
}

function paraODesenho(c: ConversaAtendimento, agora: number) {
  /* Thread completa só da conversa ABERTA (vem por fetch). Para as outras,
     uma mensagem-resumo com a direção real da última: é o mínimo para
     `esperando()`, a prévia da fila e as métricas NA FILA / SLA baterem.
     Sem direção conhecida (507 contatos têm `ultima_msg` mas nenhuma linha em
     whatsapp_mensagens) vira mensagem de sistema: não conta como cliente
     esperando, porque não sabemos se é. */
  const stub: MsgDesenho[] = c.ultimaMsgAt
    ? [{
        de: c.ultimaDirecao === "in" ? "in" : c.ultimaDirecao === "out" ? "out" : "sis",
        t: c.ultimaMsg || ROTULO_TIPO[c.ultimaTipo ?? ""] || "",
        h: hhmm(c.ultimaMsgAt), dia: diaDe(c.ultimaMsgAt),
      }]
    : [];
  return {
    id: c.id,
    // O "lead" do desenho é a chave da pessoa: o lead real quando existe,
    // senão o próprio contato (ver `leadsDoDesenho`).
    lead: c.leadId ?? c.id,
    contato: { nome: nomeExibicao(c.nome, c.telefone), tel: fmtTel(c.telefone), email: c.email },
    canal: "WhatsApp",
    numero: [c.sessaoLabel, fmtTel(c.sessaoFone)].filter(Boolean).join(" · ") || "WhatsApp",
    sessaoId: c.sessaoId,
    telefone: c.telefone,
    status: statusDe(c, agora),
    retorno: c.snoozedUntil && new Date(c.snoozedUntil).getTime() > agora
      ? `${new Date(c.snoozedUntil).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ })}, ${hhmm(c.snoozedUntil)}`
      : undefined,
    // `resp` é NOME: o desenho compara `EQUIPE.indexOf(c.resp)`.
    resp: c.responsavelNome,
    // Sem coluna de prioridade no domínio: undefined, não "Média" inventada.
    prioridade: undefined,
    naoLidas: c.naoLidas,
    hora: horaDaLista(c.ultimaMsgAt),
    // Minutos desde a última mensagem do cliente. `espMin` lê isto antes do
    // mapa fixo `ESP` do protótipo (c1: 3, c2: 26…), que com id real dava "1 min" para todos.
    espera: c.ultimaDirecao === "in" && c.ultimaMsgAt
      ? Math.max(0, Math.floor((agora - new Date(c.ultimaMsgAt).getTime()) / 60_000))
      : undefined,
    msgs: stub,
  };
}

/**
 * As pessoas, na forma do lead do protótipo.
 *
 * TODA conversa ganha uma entrada: o desenho chaveia tags, "Ver pessoa" e
 * vincular por `L.id`, e o ramo `desconhecido` do `leadDe` não tem id.
 * - Contato casado com lead (direto ou pelo telefone): os dados do lead, com
 *   `desconhecido: false`. Aqui o Liga GERA e-mail e telefone a partir do nome
 *   (linhas 543/545) — a correção é por rótulo, em `renderVals`.
 * - Contato sem lead: `desconhecido: true`, que faz o Liga usar `L.email` e
 *   `L.tel` reais ("Sem e-mail" quando não há — 1.710 dos 1.731 não têm).
 * `telefone` vai sempre: é o que o "Ligar" (Callface) lê antes do gerado.
 */
function leadsDoDesenho(conversas: ConversaAtendimento[], leadsPorId: Map<string, LeadAtendimento>) {
  const vistos = new Map<string, any>();
  for (const c of conversas) {
    const l = c.leadId ? leadsPorId.get(c.leadId) : undefined;
    const id = l ? l.id : c.id;
    if (vistos.has(id)) continue;
    vistos.set(id, l
      ? {
          id, pessoa: l.nome || nomeExibicao(c.nome, c.telefone), cargo: l.cargo ?? "",
          empresa: l.empresa, empresaId: l.empresaId,
          tel: fmtTel(l.telefone ?? c.telefone), telefone: l.telefone ?? c.telefone,
          email: l.email ?? c.email, etapa: l.etapa, origem: l.origem, campanha: l.campanha,
          interesse: l.interesse, resp: l.responsavelNome, leadReal: true,
        }
      : {
          id, pessoa: nomeExibicao(c.nome, c.telefone), cargo: "", empresa: null,
          desconhecido: true, tel: fmtTel(c.telefone), telefone: c.telefone, email: c.email,
        });
  }
  return [...vistos.values()];
}

/** Mensagem de whatsapp_mensagens (rota /api/whatsapp/messages) → balão do desenho. */
function msgDoBanco(m: any, porId: Map<string, any>): MsgDesenho {
  const out = m.direcao === "out";
  const tipo = m.tipo as string;
  const texto = (m.conteudo || "").trim();
  const base: MsgDesenho = {
    de: out ? "out" : "in",
    // `failed` é o worker dizendo que não saiu pelo WhatsApp: o balão diz isso em vez de mostrar tique.
    h: hhmm(m.createdAt) + (out && m.status === "failed" ? " · não enviada" : out && m.status === "pending" ? (Date.now() - new Date(m.createdAt).getTime() > 10 * 60_000 ? " · sem confirmação" : " · enviando") : ""), dia: diaDe(m.createdAt),
    // O tique verde é o `status` real que o WhatsApp devolveu, não um timer.
    lido: out ? m.status === "read" : undefined,
    autor: m.enviadoPorNome ?? undefined,
    waId: m.uazapiMessageId ?? null,
    mediaUrl: m.mediaUrl ?? null,
    t: texto,
  };
  // `arq` junto da imagem não muda o balão (o desenho só usa `arq` sem `img`); é o que a prévia da
  // fila lê quando a imagem não tem legenda, senão a linha saía "Você: " em branco.
  if (tipo === "image" && m.mediaUrl) { base.img = m.mediaUrl; base.arq = m.mediaFilename || ROTULO_TIPO.image; }
  else if (tipo === "document" || tipo === "video") base.arq = m.mediaFilename || ROTULO_TIPO[tipo];
  // `audio` só precisa ser verdadeiro para o desenho desenhar o player; o
  // player é o de verdade (ver `tocar` na subclasse), e a duração sai do arquivo.
  else if (tipo === "audio" && m.mediaUrl) base.audio = "0:00";
  if (!base.t && !base.img && !base.arq && !base.audio) base.t = ROTULO_TIPO[tipo] || "";
  if (m.replyToId && porId.has(m.replyToId)) {
    const r = porId.get(m.replyToId);
    base.cit = { quem: r.direcao === "out" ? "Você" : "Contato", t: r.conteudo || ROTULO_TIPO[r.tipo] || "" };
  }
  return base;
}

/* ── Templates: categoria do domínio ↔ time/categoria do desenho ───────── */

const CAT_ROTULO: Record<string, [string, string]> = {
  primeiro_contato: ["Vendas", "Primeiro contato"],
  follow_up: ["Vendas", "Follow-up"],
  proposta: ["Vendas", "Proposta"],
  pos_venda: ["CS", "Pós-venda"],
  geral: ["Geral", "Geral"],
};
function categoriaDoDesenho(t: { time?: string; cat?: string }): string {
  const c = (t.cat || "").toLowerCase();
  if (c.includes("primeiro")) return "primeiro_contato";
  if (c.includes("follow")) return "follow_up";
  if (c.includes("proposta")) return "proposta";
  if (c.includes("pós") || c.includes("pos") || t.time === "CS") return "pos_venda";
  return "geral";
}

/** "hoje, 17:00" / "amanhã, 09:00" / "12/10, 09:00" → minutos a partir de agora. */
function minutosAte(rotulo: string | undefined): number | null {
  if (!rotulo) return null;
  const m = /(\d{1,2}):(\d{2})/.exec(rotulo);
  if (!m) return null;
  const d = new Date();
  if (/amanh/i.test(rotulo)) d.setDate(d.getDate() + 1);
  const dm = /(\d{1,2})\/(\d{1,2})/.exec(rotulo);
  if (dm) { d.setMonth(+dm[2] - 1, +dm[1]); if (d.getTime() < Date.now() - 86_400_000) d.setFullYear(d.getFullYear() + 1); }
  d.setHours(+m[1], +m[2], 0, 0);
  const min = Math.round((d.getTime() - Date.now()) / 60_000);
  return min >= 1 ? Math.min(min, 60 * 24 * 30) : null;
}

/* ── A subclasse ───────────────────────────────────────────────────────── */

/**
 * O protótipo com o mock trocado pelo real.
 *
 * Nada aqui edita o gerado: cada intervenção é um método sobrescrito ou uma
 * correção na SAÍDA de `renderVals`, que é a fronteira com o markup.
 */
class AtendimentoLigado extends AtendimentoLiga {
  _audio: HTMLAudioElement | null = null;
  _durs: Record<string, number> = {};
  _selAvisado: string | null = null;

  constructor(props: any) {
    super(props);
    const self = this as any;
    props.registrar?.(this);
    /* Filtro por número (caixa). O `caixaDe` do Liga casa por SUBSTRING dos
       cinco números inventados em `CAIXAS` — nenhuma conversa real pertence a
       nenhum deles e escolher um esvaziava a lista. O filtro real vai por
       `sessaoId`, aplicado na leitura da lista. */
    const lerOriginal = self.E.ler;
    self.E.ler = (k: string, alt?: any) => {
      if (k !== "conversas") return lerOriginal(k, alt);
      const todas = self.props.dados?.conversas ?? [];
      const cx = self.state?.caixaReal;
      return cx ? semExtra(filtraCaixa(todas, cx, self.props.sessoes ?? [])) : todas;
    };
    // O Liga só repassa o href; "Ver pessoa"/"Ver empresa" precisam do lead.
    self.E.irPara = (href: string, rotulo?: string, params?: any) => self.props.ir?.(href, rotulo, params);
  }

  /**
   * Desligado: TODO uso de `depois` no Liga é simulação — o tique de "lido"
   * em 900 ms, o "digitando…" em 1,3 s, a resposta FABRICADA do cliente em
   * 3,6 s ("Perfeito, obrigado!"), a sugestão de IA e a conversa inteira que
   * o "NEXO" encenava. Lido e resposta vêm do WhatsApp, pelo banco.
   */
  depois() {}

  /* O aviso do protótipo é o toast do produto. A base não define `diz` (só `E.avisar`
     chama `this.diz`): sem isto cada confirmação ("Conversa vinculada", "Tag
     adicionada", "Status: …") lançava `this.diz is not a function` DEPOIS de gravar. */
  diz(texto: string, tom?: string) {
    /* Estas o Liga anuncia ANTES do servidor responder; o adaptador avisa depois, com o
       resultado de verdade (inclusive a recusa 409). */
    if (/^(Lead .* criado em Pré-vendas|Conversa vinculada a |Nota interna salva)/.test(texto)) return;
    if (tom === "erro") toast.error(texto);
    else toast(texto);
  }

  componentDidMount() {
    super.componentDidMount?.();
    this.avisarSelecao();
  }

  componentDidUpdate(pp: any, ps: any) {
    super.componentDidUpdate?.(pp, ps);
    this.avisarSelecao();
    /* Busca de lead no seletor (Vincular / Nova conversa): vai ao servidor. */
    const st: any = this.state;
    for (const k of ["vinc", "nova"]) {
      const q = st?.[k]?.busca;
      if (typeof q === "string" && q !== ps?.[k]?.busca) this.props.buscarLeads?.(q);
    }
  }

  componentWillUnmount() {
    super.componentWillUnmount?.();
    this._audio?.pause();
  }

  /** A thread da conversa aberta é carregada sob demanda — nunca no render. */
  avisarSelecao() {
    const sel = (this as any)._selAtual ?? null;
    if (sel !== this._selAvisado) {
      this._selAvisado = sel;
      if (sel) (this as any).props.aoSelecionar?.(sel);
    }
  }

  /**
   * O player de áudio de verdade.
   *
   * O protótipo animava uma barra de 10 s sem tocar nada. Aqui toca o
   * `media_url` da mensagem e o progresso é o `currentTime` do arquivo.
   */
  tocar(k: string, _secs: number) {
    const self = this as any;
    if (self.state.play?.k === k && this._audio) {
      this._audio.pause(); this._audio = null;
      self.setState({ play: null });
      return;
    }
    this._audio?.pause();
    const [cid, idx] = k.split(":");
    const conv = (self.props.dados?.conversas ?? []).find((c: any) => c.id === cid);
    const url = conv?.msgs?.[Number(idx)]?.mediaUrl;
    if (!url) { toast("Este áudio não tem arquivo disponível."); return; }
    const a = new Audio(url);
    this._audio = a;
    a.onloadedmetadata = () => { if (Number.isFinite(a.duration)) { this._durs[k] = a.duration; self.forceUpdate(); } };
    a.ontimeupdate = () => self.setState({ play: { k, p: a.duration ? a.currentTime / a.duration : 0 } });
    a.onended = () => { this._audio = null; self.setState({ play: null }); };
    a.play().then(() => self.setState({ play: { k, p: 0 } }), () => {
      this._audio = null;
      toast.error("Não consegui tocar este áudio.");
    });
  }

  renderVals() {
    const v: any = super.renderVals();
    const self = this as any;
    const P = self.props;
    const S = self.state;
    const todas: any[] = P.dados?.conversas ?? [];
    const C = todas.find((c) => c.id === self._selAtual) ?? {};
    const L = (P.dados?.leads ?? []).find((l: any) => l.id === C.lead) ?? {};
    const aviso = (t: string) => () => toast(t);

    /* 1. E-mail e telefone gerados do nome (Liga 543/545):
          slug(primeiro)+"@"+slug(empresa)+".com.br" e "+55 11 9"+hash.
          Corrigidos pelo RÓTULO do botão, padrão `corrigirInventados`. */
    const reais: Record<string, [string | null, string, string]> = {
      "Copiar e-mail": [L.email || null, "Sem e-mail", "E-mail"],
      "Copiar telefone": [L.tel || null, "Sem telefone", "Telefone"],
    };
    for (const d of v.cv?.dados ?? []) {
      const r = reais[d.titulo];
      if (!r) continue;
      const [valor, vazio, rotulo] = r;
      d.valor = valor ?? vazio;
      d.onClick = valor
        ? () => navigator.clipboard?.writeText(valor).then(() => toast(`${rotulo} copiado`), () => toast.error("Não consegui copiar."))
        : undefined;
      if (!valor) d.acaoD = "";
    }
    if (v.reu) v.reu.email = L.email || "";

    /* 2. "1ª RESP. MÉDIA" era "3m 40s" fixo. Agora é a média real (SQL em
          lib/atendimento/tela.ts), "—" quando não há amostra. */
    for (const m of v.metricas ?? []) {
      if (m.label === "1ª RESP. MÉDIA") m.valor = P.primeiraResposta;
    }

    /* 2b. Aba "Não lidas": o `noFiltro` do Liga não conhece a chave
           "naolidas" (compara com status) — a aba contava 0 com 330 não lidas
           e, clicada, esvaziava a lista. Conta pelo dado e liga no filtro de
           não lidas que o próprio desenho já tem (`soNaoLidas`). */
    for (const a of v.abas ?? []) {
      if (a.label !== "Não lidas") continue;
      const base = filtraCaixa(todas, S.caixaReal, P.sessoes ?? []);
      a.conta = String(base.filter((c) => c.naoLidas > 0).length);
      a.onClick = () => self.setState({ aba: "todos", soNaoLidas: true });
    }

    /* 3. Histórico: as duas entradas de baixo eram inventadas para toda
          conversa ("Encerrado · dúvida sobre contrato — 12 set", "Ligação
          4:21 — 2 set"). Fica só o atendimento atual, que é real. */
    if (Array.isArray(v.historico)) v.historico = v.historico.slice(0, 1);

    /* 4. IA. Não há agente ligado (ai_sdr_contato_state tem 0 linhas). A
          "sugestão" eram frases prontas com compromisso ("envio a proposta
          até as 18h", "7 a 15 dias úteis") que o usuário enviaria de verdade. */
    v.digitando = false;
    if (v.sug) {
      /* Sugestão de resposta pelo NEXO (mesmo caminho do resumo): vem do
         servidor, vai para o campo só quando o atendente clica em "Usar". */
      const sr = S.sugReal && S.sugReal.id === C.id ? S.sugReal : null;
      v.sug.carregando = !!sr?.carregando;
      v.sug.visivel = !!sr?.texto && S.modo === "msg";
      v.sug.texto = sr?.texto ?? "";
      v.sug.pedir = () => {
        const id = C.id as string;
        if (!id) return toast("Abra uma conversa para o NEXO sugerir.");
        if (sr) return;
        self.setState({ sugReal: { id, carregando: true } });
        analisarConversaDoAtendimento(id, "sugestao").then(
          (r) => self.setState({ sugReal: r.tipo === "sugestao" ? { id, texto: r.resposta } : null }),
          (e: Error) => { self.setState({ sugReal: null }); toast.error(e.message); },
        );
      };
      v.sug.usar = () => { self.setState({ texto: sr?.texto ?? "", sugReal: null }); toast("Sugestão no campo. Revise antes de enviar."); };
      v.sug.dispensar = () => self.setState({ sugReal: null });
    }
    /* O botão contextual abre a conversa única do NEXO. A sugestão no compositor
       continua local, pois é um rascunho editável antes do envio humano. */
    const tiposNexo = ["resumo", "sentimento"];
    (v.nexoAcoes ?? []).forEach((a: any, i: number) => {
      const tipo = tiposNexo[i];
      if (!tipo || !C.id) return a.onClick = aviso("Abra uma conversa para o NEXO ler.");
      a.onClick = () => abrirNexo(`${tipo === "resumo" ? "Resuma" : "Analise o sentimento de"} a conversa WhatsApp do contato ${C.id}. Use nexo_conversas com contato_id e cite apenas o que as mensagens sustentam.`);
    });
    /* O desenho decide "rótulos nos botões" pela largura da JANELA (>= 1100), mas a conversa
       divide a janela com a casca (246), a fila (350) e o painel (340): em 1440 o cabeçalho
       da conversa tem ~500px e empurrava "⋯" e "Ocultar painel" para fora, inalcançáveis.
       Rótulos só quando cabem; sem eles os botões viram ícone, que cabe. */
    v.largo = S.w >= 1520;

    /* IA desta conversa: o estado REAL (agente publicado para este número, pausa,
       por que não respondeu) vem de /api/atendimento/conversas/:id/ia. Antes o botão
       só dizia "NEXO não está ligado" em toda conversa. */
    if (v.ia) {
      const est = C.id ? (P.iaEstados ?? {})[C.id] : undefined;
      const ativaIa = est?.estado === "ativa";
      v.ia.ativa = ativaIa;
      v.ia.btnLabel = !est ? "IA" : ativaIa ? "IA ativa" : est.estado === "pausada" ? "IA pausada" : est.estado === "desligada" ? "Ligar IA" : "Sem agente";
      v.ia.btnTitulo = est ? [est.motivo, est.aviso, est.semResposta].filter(Boolean).join(" ") : "Verificando a IA desta conversa";
      v.ia.btnStyle = "display:flex;align-items:center;gap:7px;height:34px;padding:0 12px 0 8px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;"
        + (ativaIa ? "background:var(--of-tinta-forte);color:var(--of-papel)" : "background:var(--of-papel);color:var(--of-tinta);box-shadow:inset 0 0 0 1px var(--of-linha-controle)");
      v.ia.btnClick = () => {
        if (!C.id) return;
        if (!est) return toast("Verificando a IA desta conversa. Tente de novo em instantes.");
        if (est.estado === "sem_agente") return toast(est.motivo, { description: "Abra Automações > Agentes para ligar um agente a este número." });
        P.alternarIa?.(C.id, est.estado === "pausada" || est.estado === "desligada");
      };
      v.ia.resumo = est ? [est.agente?.nome, est.aviso ?? est.semResposta].filter(Boolean).join(" · ") || est.motivo : "";
      v.ia.editar = () => (est?.agente?.id ? P.abrirAgente?.(est.agente.id) : toast("Esta resposta vem da configuração clássica do SDR, em Automações > Agentes."));
      v.ia.assumir = () => { if (C.id) P.alternarIa?.(C.id, false); };
    }

    /* 5. Números (caixas). Os cinco do protótipo — (11) 97700-4410,
          4003-1020/1030/1040/1050 — não existem; as caixas são as sessões de
          whatsapp_sessao. Contagem sobre a lista inteira, não a filtrada. */
    const sessoes: SessaoDoSeletor[] = P.sessoes ?? [];
    const cxSel: string | null = S.caixaReal ?? null;
    const sessaoSel = sessoes.find((s) => s.id === cxSel);
    const nlDe = (lista: any[]) => lista.filter((c) => c.naoLidas > 0).length;
    // Escopo Minhas / Equipe (regra única em lib/whatsapp/acesso, escolhida na URL).
    const esc: { atual: string; pode: boolean; mudar?: (e: string) => void } = P.escopo ?? { atual: "minhas", pode: false };
    /* Em "Equipe" a caixa pode ser uma PESSOA ou um AGENTE (todos os números dele): `u:<id>`. */
    const donoSel = cxSel?.startsWith("u:") ? sessoes.find((s) => (s.donoId ?? "") === cxSel.slice(2)) : undefined;
    const rotuloDono = (s: SessaoDoSeletor) => s.donoNome ?? "Compartilhado";
    if (v.caixa) {
      const lista = filtraCaixa(todas, cxSel, sessoes);
      const nl = nlDe(lista);
      v.caixa.nome = sessaoSel ? sessaoSel.label : donoSel ? rotuloDono(donoSel) : (esc.atual === "equipe" ? "Equipe · todos os números" : "Meus números");
      v.caixa.num = sessaoSel
        ? [esc.atual === "equipe" && sessaoSel.donoId !== P.euId ? rotuloDono(sessaoSel) : null, fmtTel(sessaoSel.fone) ?? "WhatsApp"].filter(Boolean).join(" · ")
        : `${donoSel ? sessoes.filter((s) => (s.donoId ?? "") === cxSel!.slice(2)).length : sessoes.length} ${(donoSel ? sessoes.filter((s) => (s.donoId ?? "") === cxSel!.slice(2)).length : sessoes.length) === 1 ? "número" : "números"}`;
      v.caixa.ehIa = false;
      v.caixa.temNaoLidas = nl > 0;
      v.caixa.naoLidas = String(nl);
      v.caixa.d = sessaoSel ? ICO_WA : ICO_TODAS;
      v.caixa.icoStyle = "flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--of-papel);color:" + (sessaoSel ? "var(--of-canal-whatsapp-tinta)" : "var(--of-tinta-forte)") + ";box-shadow:inset 0 0 0 1px var(--of-linha)";
    }
    if (v.pop?.ehCaixas) {
      const linha = (x: { id: string | null; label: string; fone: string; ehDono?: boolean; recuo?: boolean }, i: number) => {
        const doX = filtraCaixa(todas, x.id, sessoes);
        const nl = nlDe(doX);
        const on = (cxSel ?? null) === x.id;
        return {
          nome: x.label, num: x.fone, ia: false, naoIa: true, d: x.id && !x.ehDono ? ICO_WA : ICO_TODAS,
          total: String(doX.length), temNl: nl > 0, nl: String(nl),
          icoStyle: "flex:0 0 auto;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;overflow:hidden;" + (x.id && !x.ehDono ? "background:var(--of-canal-whatsapp-fundo);color:var(--of-canal-whatsapp-tinta)" : "background:var(--of-papel);color:var(--of-tinta-forte);box-shadow:inset 0 0 0 1px var(--of-linha)"),
          checkStyle: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:var(--of-tinta-forte)" : "background:transparent"),
          style: "display:flex;align-items:center;gap:10px;width:100%;padding:8px 9px;border-radius:9px;border:0;cursor:pointer;text-align:left;" + (on ? "background:var(--of-papel-tela)" : "background:transparent") + (i === 0 ? ";margin-bottom:4px;box-shadow:0 1px 0 var(--of-fio)" : "") + (x.recuo ? ";padding-left:22px" : "") + (x.ehDono ? ";margin-top:4px" : ""),
          onClick: () => self.setState({ pop: null, caixaReal: x.id }),
        };
      };
      const fone = (s: SessaoDoSeletor) => (fmtTel(s.fone) ?? "Sem número registrado") + (s.status !== "connected" ? " · desconectado" : "");
      const topo = { id: null as string | null, label: esc.atual === "equipe" ? "Todos os números da equipe" : "Todos os meus números", fone: `${sessoes.length} ${sessoes.length === 1 ? "número" : "números"}` };
      let linhas: Array<Parameters<typeof linha>[0]>;
      if (esc.atual === "equipe") {
        /* Agrupado por dono: pessoa ou agente, e cada número dele recuado abaixo. A
           linha do dono seleciona TODOS os números dele; compartilhados ficam no fim. */
        const grupos = new Map<string, SessaoDoSeletor[]>();
        for (const s of sessoes) (grupos.get(s.donoId ?? "") ?? grupos.set(s.donoId ?? "", []).get(s.donoId ?? "")!).push(s);
        linhas = [topo];
        for (const [dono, lista] of [...grupos.entries()].sort(([a], [b]) => (a === "" ? 1 : 0) - (b === "" ? 1 : 0))) {
          const primeiro = lista[0];
          const ehAgente = primeiro.donoTipo === "agente";
          linhas.push({ id: `u:${dono}`, label: (dono ? rotuloDono(primeiro) : "Compartilhados") + (ehAgente ? " · agente" : ""), fone: `${lista.length} ${lista.length === 1 ? "número" : "números"}`, ehDono: true });
          for (const s of lista) linhas.push({ id: s.id, label: s.label, fone: fone(s), recuo: true });
        }
      } else {
        linhas = [topo, ...sessoes.map((s) => ({ id: s.id, label: s.label, fone: fone(s) }))];
      }
      v.pop.caixas = linhas.map(linha);
      /* Seletor de escopo, só para quem pode ver a equipe. As duas linhas no topo SÃO o "todos os
         números" de cada escopo (a linha genérica sai); os números individuais vêm abaixo. */
      if (esc.pode) {
        const molde = v.pop.caixas[0];
        const linhaEscopo = (chave: string, nome: string, num: string, fim: boolean) => {
          const on = esc.atual === chave && !cxSel;
          const nl = esc.atual === chave ? nlDe(todas) : 0;
          return {
            ...molde, nome, num, total: esc.atual === chave ? String(todas.length) : "", temNl: nl > 0, nl: String(nl), d: ICO_TODAS,
            checkStyle: "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:var(--of-tinta-forte)" : "background:transparent"),
            style: "display:flex;align-items:center;gap:10px;width:100%;padding:8px 9px;border-radius:9px;border:0;cursor:pointer;text-align:left;" + (on ? "background:var(--of-papel-tela)" : "background:transparent") + (fim ? ";margin-bottom:4px;box-shadow:0 1px 0 var(--of-fio)" : ""),
            onClick: () => { self.setState({ pop: null, caixaReal: null }); if (esc.atual !== chave) esc.mudar?.(chave); },
          };
        };
        v.pop.caixas = [
          linhaEscopo("minhas", "Minhas conversas", "Meus números e o que está comigo", false),
          linhaEscopo("equipe", "Equipe", "Conversas de todos os números", true),
          ...v.pop.caixas.slice(1),
        ];
      }
    }

    /* 5b. O que não tem porta de domínio não aparece como se tivesse (decisão 12/10):
       "Aguardando time" não existe como status gravável; prioridade não existe no
       domínio do atendimento; trocar o número da conversa e transferir para "agente
       NEXO" não têm comando. Antes eram botões que só avisavam ao clicar. */
    if (v.pop?.titulo === "STATUS DA CONVERSA" || v.pop?.titulo === "STATUS") {
      v.pop.itens = (v.pop.itens ?? []).filter((i: any) => !/^Aguardando time\b/.test(String(i.label ?? "")));
    }
    if (v.cv?.stats) v.cv.stats = v.cv.stats.filter((s: any) => s.label !== "PRIORIDADE");
    if (v.tr?.abas) { v.tr.abas = []; v.tr.temDica = false; } // só "Pessoas" sobra; uma aba só não é escolha

    /* 6. Tags. O popup lista as cinco do protótipo ("Inbound", "Lead
          quente"…) com automações descritas que não existem. Ficam só as
          tags reais da organização (`labels`), sem a nota inventada. */
    if (v.pop?.temCriar) {
      const reaisTags = new Set<string>(P.dados?.tagsCriadas ?? []);
      v.pop.itens = (v.pop.itens ?? []).filter((i: any) => reaisTags.has(i.label)).map((i: any) => ({ ...i, nota: "", temNota: false }));
    }

    /* 7. Transferir. Presença "Online"/"Ausente · volta às 14h" é inventada
          (não há fonte de presença); a aba de números listava os cinco falsos
          e a de agentes, quatro "NEXO" que não existem. */
    if (v.tr?.aberto) {
      const aba = S.tr?.aba || "pessoas";
      if (aba === "numeros") {
        const base = (v.tr.pessoas ?? [])[0];
        v.tr.pessoas = sessoes.filter((s) => s.id !== C.sessaoId).map((s) => ({
          ...(base ?? {}),
          nome: s.label, info: fmtTel(s.fone) ?? "Sem número registrado", temImg: false, temIco: true, temIni: false, d: ICO_WA, ini: "",
          av: "width:32px;height:32px;border-radius:9px;display:grid;place-items:center;overflow:hidden;background:var(--of-canal-whatsapp-fundo);color:var(--of-canal-whatsapp-tinta)",
          presenca: "display:none",
          style: "display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;border:0;cursor:pointer;text-align:left;background:var(--of-papel);border-top:1px solid var(--of-fio);margin-top:-1px",
          check: "flex:0 0 auto;width:18px;height:18px;border-radius:9999px;display:grid;place-items:center;background:var(--of-papel);box-shadow:inset 0 0 0 1.5px var(--of-linha-convite)",
          onClick: aviso("Trocar o número de uma conversa não tem command: cada número é a sessão de WhatsApp de uma pessoa."),
        }));
      } else if (aba === "agentes") {
        v.tr.pessoas = [];
        v.tr.dica = "Nenhum agente do NEXO está ligado nesta organização.";
      } else {
        const carga: Record<string, number> = P.cargaEquipe ?? {};
        for (const p of v.tr.pessoas ?? []) {
          p.presenca = "display:none";
          if (typeof p.info === "string") p.info = p.info.replace(/^(Online|Ausente[^·]*) · /, "");
          // A contagem do desenho vinha da lista da tela (só as minhas). A carga é a da organização.
          const n = carga[String(p.nome).replace(/ \(você\)$/, "")];
          if (typeof p.info === "string" && /conversas? abertas?$/.test(p.info)) p.info = `${n ?? 0} ${n === 1 ? "conversa aberta" : "conversas abertas"}`;
        }
      }
    }

    /* 8. Nova conversa: as origens eram os números falsos. Agora as sessões
          reais; a escolhida vai como `sessaoId` no envio. */
    if (v.nova?.aberto && v.nova.ehWa) {
      const de = S.nova?.de;
      v.nova.origens = sessoes.map((s) => ({
        label: s.label, titulo: fmtTel(s.fone) ?? "",
        style: "height:32px;padding:0 12px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;white-space:nowrap;" + (de === s.id ? "font-weight:600;background:var(--of-tinta-forte);color:var(--of-papel)" : "font-weight:500;background:var(--of-papel);color:var(--of-tinta);box-shadow:inset 0 0 0 1px var(--of-linha-controle)"),
        onClick: () => self.setState((st: any) => ({ nova: { ...st.nova, de: s.id } })),
      }));
    }

    /* 9. Reunião. O confirmar do protótipo criava uma atividade local e dizia ao cliente
          "Te mandei o convite por e-mail" — convite que ninguém mandou. Agora grava a
          reunião de verdade (/api/reunioes: mesma tabela do Calendário, com evento e
          timeline) e, só se "Mandar o convite" estiver ligado, manda o aviso pelo WhatsApp
          da conversa — que pode ser recusado se o número estiver desconectado. */
    if (v.reu) {
      const X = S.reu;
      v.reu.confirmar = () => {
        if (!X || !X.data || !X.hora || !(X.titulo || "").trim()) return;
        P.agendarReuniao?.({ X, contatoId: C.id, leadId: L.leadReal ? L.id : null, email: L.email || null });
        self.setState({ reu: null });
      };
    }

    /* 10. Painel do contato: segmento caía em "Serviços" e a prioridade em
           "Média" para todo mundo. Sem fonte, "—". */
    if (v.cv) {
      v.cv.segmento = (L.empresa && (P.setores ?? {})[L.empresa]) || "—";
      for (const s of v.cv.stats ?? []) if (s.label === "PRIORIDADE") { s.valor = "—"; s.alta = false; }
      // Probabilidade "20%" e valor "A definir" eram fallback inventado do bloco de oportunidade.
      if (v.cv.relTitulo === "Oportunidade") {
        for (const c of v.cv.campos ?? []) if (["Chance", "Previsão", "Valor"].includes(c.label)) c.valor = "—";
      }
      /* 10b. Oportunidade/Cliente pelo NEGÓCIO real do lead, não por L.etapa
              (o desenho só abre o bloco quando a etapa de pré-vendas é
              "oportunidade" e preenche com o mapa fixo REL). Aberto →
              Oportunidade com a trilha do pipeline; só ganho → Cliente.
              Sem fonte (chance, saúde, chamados, CSM): "—". */
      const N = (P.contexto?.negocios ?? {})[L.id];
      if (N) {
        const pill = v.cv.etapaStyle;
        const chip = (bg: string, cor: string) => "flex:0 0 auto;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;background:" + bg + ";color:" + cor;
        const familia = N.familia ? (ROTULO_FAMILIA as Record<string, string>)[N.familia] ?? N.familia : null;
        // Mesma porta de entrada do Pipeline/Contatos: /pipeline/<id> (OportunidadeProto),
        // não o workspace legado /negocios/<id>.
        const abrirRel = () => self.props.ir?.(rotaDoDesenho("/onface-preview/oportunidade", { opp: N.id }));
        if (N.etapa === "ganho") {
          const desde = N.ganhoAt ? new Date(N.ganhoAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: TZ }).replace(".", "").replace(" de ", "/") : null;
          Object.assign(v.cv, {
            relTitulo: "Cliente", relArea: "CS", relChip: chip("var(--of-canal-whatsapp-fundo)", "var(--of-canal-whatsapp-tinta)"), relBtn: "Abrir negócio",
            etapa: desde ? "Ganho em " + desde : "Ganho", etapaStyle: pill, etapaDot: "width:6px;height:6px;border-radius:9999px;background:var(--of-canal-whatsapp-tinta)",
            temTrilha: false, trilha: [],
            campos: [
              { label: "Plano", valor: familia ?? "—" },
              { label: "Valor", valor: N.mrrFechado != null ? brl(N.mrrFechado) + "/mês" : brl(N.valor) ?? "—" },
              { label: "Saúde", valor: "—" }, { label: "Chamados", valor: "—" }, { label: "CSM", valor: "—" },
            ],
            abrirRel,
          });
        } else {
          const pos = (ETAPAS_PIPELINE as readonly string[]).indexOf(N.etapa);
          const bar = (on: boolean, atual: boolean) => "flex:1;height:4px;border-radius:9999px;background:" + (on ? "var(--of-tinta-forte)" : atual ? "var(--of-coral-marca)" : "var(--of-linha)");
          Object.assign(v.cv, {
            relTitulo: "Oportunidade", relArea: "Vendas", relChip: chip("var(--of-coral-fundo)", "var(--of-coral-acao-hover)"), relBtn: "Abrir oportunidade",
            etapa: (ROTULO_ETAPA_PIPELINE as Record<string, string>)[N.etapa] ?? N.etapa, etapaStyle: pill,
            etapaDot: "width:6px;height:6px;border-radius:9999px;background:var(--of-coral-marca)",
            temTrilha: true, trilha: ETAPAS_PIPELINE.map((k, i) => ({ label: ROTULO_ETAPA_PIPELINE[k], style: bar(i < pos, i === pos) })),
            campos: [
              { label: "Valor", valor: brl(N.valor) ?? "—" }, { label: "Produto", valor: familia ?? L.interesse ?? "—" },
              { label: "Previsão", valor: ddmm(N.previsao) ?? "—" }, { label: "Chance", valor: "—" },
              { label: "Closer", valor: N.responsavel ?? "—" },
            ],
            abrirRel,
          });
        }
      }
      /* 10c. "Próxima ação": `atvs` traz a próxima tarefa aberta do lead; o Liga mostra
              `atv.hora` como quando. "Ver"/"Criar" abrem a PEÇA de atividade (a mesma de
              Pré-vendas) por cima da conversa: o `acaoBtn` do Liga chama `E.abrir`. Antes
              mandavam para /tarefas, e a atividade nunca nascia na conversa. */
    }

    /* 10d. Cadência: "Passo 2 de 5 · próximo toque amanhã" saía de números fixos do desenho.
            Passo, total e próximo toque são da inscrição real. */
    if (v.cad?.tem) {
      const cr = (P.cadReais ?? {})[L.id] as CadenciaDoLead | undefined;
      if (cr) {
        const prox = cr.proximoEm ? new Date(cr.proximoEm) : null;
        const quando = prox
          ? `${diaDe(prox.toISOString()) === "Hoje" ? "hoje" : diaDe(prox.toISOString()).toLowerCase()}, ${hhmm(prox.toISOString())}`
          : null;
        v.cad.passo = `${cr.pausada ? "Pausada · " : ""}Passo ${cr.passo} de ${cr.total}${quando ? ` · próximo toque ${quando}` : ""}`;
      }
    }

    /* 11. Áudio: duração e posição do arquivo real (ver `tocar`). */
    (v.msgs ?? []).forEach((m: any, i: number) => {
      if (!m.temAudio) return;
      const k = `${C.id}:${i}`;
      const tocando = S.play?.k === k && this._audio;
      const seg = tocando ? this._audio!.currentTime : this._durs[k];
      m.tempoAudio = seg != null ? `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, "0")}` : "Áudio";
    });

    return v;
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

const SEM_COMMAND: Record<string, string> = {
  atvs: "A atividade não foi criada: o Atendimento ainda não grava atividade. Use Tarefas.",
  qual: "Qualificação é feita na ficha do lead, em Pré-vendas.",
};

export function AtendimentoProto({ dados, contexto, cadencias = {}, leadInicial = null }: {
  dados: DadosAtendimento;
  contexto: ContextoAtendimento;
  /** Inscrição viva de cada lead em cadência (lib/atendimento/cadencias). */
  cadencias?: Record<string, CadenciaDoLead>;
  /** Lead que veio no `?leadId=` — a tela abre direto na conversa dele. */
  leadInicial?: string | null;
}) {
  const router = useRouter();

  /* O Liga lê `window.innerWidth` num class field — roda no construtor da
     base, antes de qualquer subclasse, e derruba o SSR. É o único Liga do
     handoff assim. Até o script guardar a leitura, a tela só monta no cliente.
     (Equivale a `dynamic(..., { ssr: false })` sem um arquivo a mais.) */
  const [montado, setMontado] = React.useState(false);
  React.useEffect(() => setMontado(true), []);

  const [threads, setThreads] = React.useState<Record<string, MsgDesenho[]>>({});
  const [local, setLocal] = React.useState<Record<string, any>>({});
  const instRef = React.useRef<any>(null);
  const renderizadoRef = React.useRef<any[]>([]);

  // A verdade do servidor chegou: o que era otimista some.
  React.useEffect(() => { setLocal({}); }, [dados]);

  /* Abrir na conversa de quem veio no link. Quem chega por "Enviar mensagem"
     na ficha espera a conversa daquela pessoa, não a caixa inteira. Se o lead
     ainda não tem conversa, a lista fica como está — avisar seria ruído: o
     operador acabou de clicar e vê a tela. */
  const jaAbriu = React.useRef<string | null>(null);
  React.useEffect(() => {
    /* Só depois de montar: antes disso `instRef` está vazio e a seleção caía no
       vazio (abria a primeira conversa da lista, não a do lead). Uma vez por lead:
       cada `router.refresh` traz `dados` novo e não pode devolver o operador para cá. */
    if (!leadInicial || !montado || jaAbriu.current === leadInicial) return;
    const alvo = renderizadoRef.current.find((c: any) => c.lead === leadInicial || c.id === leadInicial);
    if (alvo && instRef.current) { jaAbriu.current = leadInicial; instRef.current.setState({ sel: alvo.id }); return; }
    /* Veio de "WhatsApp"/"E-mail" de uma ficha e o lead não tem conversa — e o
       servidor também não conseguiu abrir uma (sem número conectado ou sem
       telefone). Dizer isso: cair na caixa em silêncio parecia botão quebrado. */
    const temConversa = (dados?.conversas ?? []).some((c: any) => c.leadId === leadInicial);
    if (!temConversa) toast.warning("Este lead ainda não tem conversa. Conecte um número de WhatsApp (Ajustes) e confirme que o lead tem telefone.", { id: "sem-conversa" });
  }, [leadInicial, dados, montado]);

  const leadsPorId = React.useMemo(() => new Map(dados.leads.map((l) => [l.id, l])), [dados.leads]);
  const leadsPorIdRef = React.useRef(leadsPorId);
  leadsPorIdRef.current = leadsPorId;
  const idPorNome = React.useMemo(() => new Map(dados.equipe.map((u) => [u.nome, u.id])), [dados.equipe]);
  const labelPorNome = React.useMemo(() => new Map(dados.labels.map((l) => [l.nome, l.id])), [dados.labels]);

  const base = React.useMemo(() => {
    const agora = Date.now();
    return dados.conversas.map((c) => paraODesenho(c, agora));
  }, [dados.conversas]);

  const conversas = React.useMemo(() => semExtra(base.map((c) => {
    let x: any = c;
    if (threads[c.id]) x = { ...x, msgs: threads[c.id] };
    if (local[c.id]) x = { ...x, ...local[c.id] };
    return x;
  })), [base, threads, local]);
  renderizadoRef.current = conversas;

  /* O seletor "Vincular a lead" só enxergava os leads que já têm conversa (universo do
     desenho). Quem digita no campo dispara a busca em TODOS os leads
     (/api/atendimento/buscar-leads) e o resultado entra aqui. */
  const [leadsBuscados, setLeadsBuscados] = React.useState<any[]>([]);
  const leadsBuscadosRef = React.useRef<any[]>([]);
  leadsBuscadosRef.current = leadsBuscados;
  const ultimaBusca = React.useRef("");
  const buscarLeadsRemoto = React.useCallback(async (q: string) => {
    const termo = q.trim();
    if (termo.length < 2 || termo === ultimaBusca.current) return;
    ultimaBusca.current = termo;
    try {
      const r = await fetch(`/api/atendimento/buscar-leads?search=${encodeURIComponent(termo)}`);
      if (!r.ok) return;
      const j = await r.json();
      setLeadsBuscados((j.leads ?? []).map((l: any) => ({
        id: l.id, pessoa: l.nome, cargo: l.cargo ?? "", empresa: l.empresaNome ?? null,
        tel: fmtTel(l.telefone), telefone: l.telefone, email: null, leadReal: true,
      })));
    } catch { /* sem rede: a lista local continua valendo */ }
  }, []);
  const leadsDaConversa = React.useMemo(() => leadsDoDesenho(dados.conversas, leadsPorId), [dados.conversas, leadsPorId]);
  const leads = React.useMemo(() => {
    const ids = new Set(leadsDaConversa.map((l: any) => l.id));
    return leadsDaConversa.concat(leadsBuscados.filter((l) => !ids.has(l.id)));
  }, [leadsDaConversa, leadsBuscados]);

  const tagsLead = React.useMemo(() => {
    const t: Record<string, string[]> = {};
    for (const c of base) {
      const nomes = dados.tagsPorContato[c.id];
      if (nomes?.length) t[c.lead] = [...new Set([...(t[c.lead] ?? []), ...nomes])];
    }
    return t;
  }, [base, dados.tagsPorContato]);

  const templates = React.useMemo(() => dados.templates.map((t) => {
    const [time, cat] = CAT_ROTULO[t.categoria] ?? ["Geral", t.categoria];
    // O domínio não tem template pessoal: todos são do time, sem autor.
    return { id: t.id, nome: t.nome, time, cat, escopo: "todos", autor: "", texto: t.conteudo };
  }), [dados.templates]);

  const atvs = React.useMemo(() => {
    const a: Record<string, { titulo: string; hora: string }> = {};
    for (const [id, t] of Object.entries(contexto.tarefas)) a[id] = { titulo: t.titulo, hora: quandoDaTarefa(t) };
    return a;
  }, [contexto.tarefas]);

  const setores = React.useMemo(() => {
    const s: Record<string, string> = {};
    for (const l of dados.leads) if (l.empresa && l.setor) s[l.empresa] = l.setor;
    return s;
  }, [dados.leads]);

  /* A equipe é de NOMES (o desenho compara por nome). `EQUIPE[0]` é o "EU" do
     protótipo — quem assume ao responder, quem assina template — então quem
     está logado vem primeiro. */
  const catalogo = React.useMemo(() => ({
    EQUIPE: [dados.eu.nome, ...dados.equipe.map((u) => u.nome).filter((n) => n !== dados.eu.nome)].filter(Boolean),
    ETAPAS: Object.fromEntries(Object.entries(ROTULO_ETAPA_PRE_VENDAS).map(([k, label]) => [k, { label }])),
    LEADS: [], CONVERSAS: [],
  }), [dados.eu.nome, dados.equipe]);

  /* ── Thread da conversa aberta ── */
  /* Última "impressão digital" da thread por conversa: a consulta de fundo (a cada 3 s) só
     mexe na tela quando chegou mensagem, mudou o status (✓✓) ou a mídia ficou pronta. */
  const assinaturaThreadRef = React.useRef<Record<string, string>>({});
  const carregarThread = React.useCallback(async (id: string, opts?: { silencioso?: boolean }) => {
    try {
      const r = await fetch(`/api/whatsapp/messages/${id}?limit=100`);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const linhas: any[] = (j.messages ?? []).slice().reverse();
      const assinatura = JSON.stringify(linhas.map((m) => [m.id, m.status, m.mediaUrl]));
      if (opts?.silencioso && assinaturaThreadRef.current[id] === assinatura) return;
      assinaturaThreadRef.current[id] = assinatura;
      const porId = new Map(linhas.map((m) => [m.id, m]));
      const msgs = linhas.map((m) => ({ ...msgDoBanco(m, porId), ts: m.createdAt as string }));
      /* Notas internas do lead entram na linha do tempo da conversa (a ficha as mostra também). */
      const lid = renderizadoRef.current.find((c: any) => c.id === id)?.lead;
      if (lid && leadsPorIdRef.current.has(lid)) {
        try {
          const rn = await fetch(`/api/notas?leadId=${encodeURIComponent(lid)}`);
          if (rn.ok) {
            const nn: any[] = await rn.json();
            for (const n of nn) msgs.push({ de: "nota", t: n.conteudo, h: hhmm(n.createdAt), dia: diaDe(n.createdAt), autor: n.autorNome ?? undefined, ts: n.createdAt } as any);
            msgs.sort((a: any, b: any) => (a.ts && b.ts ? new Date(a.ts).getTime() - new Date(b.ts).getTime() : 0));
          }
        } catch { /* a conversa abre sem as notas */ }
      }
      setThreads((t) => ({ ...t, [id]: msgs }));
      // Abrir a conversa zera o não-lido no servidor (a própria rota faz isso).
      // A mensagem otimista sai: a thread do banco já a contém (ou não, se falhou).
      setLocal((l) => { const { msgs: _m, ...resto } = l[id] ?? {}; return { ...l, [id]: { ...resto, naoLidas: 0 } }; });
    } catch {
      if (!opts?.silencioso) toast.error("Não consegui carregar as mensagens desta conversa.");
    }
  }, []);

  /* ── Atualização ao vivo (mesma lógica da produção: a conversa aberta consulta a cada 3 s,
        a lista a cada 15 s). Só com a aba visível; silenciosa em caso de erro de rede. ── */
  const selecionadaRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const id = selecionadaRef.current;
      if (id) void carregarThread(id, { silencioso: true });
    }, 3000);
    return () => clearInterval(t);
  }, [carregarThread]);
  React.useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => clearInterval(t);
  }, [router]);

  /* ── Commands ── */
  const chamar = React.useCallback(async (url: string, init: RequestInit, falha: string) => {
    const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || falha);
    }
    return r.json().catch(() => ({}));
  }, []);
  const acao = React.useCallback((id: string, body: Record<string, unknown>) =>
    chamar(`/api/atendimento/conversas/${id}/acao`, { method: "POST", body: JSON.stringify(body) }, "A ação não foi aceita."), [chamar]);
  const enviar = React.useCallback((body: Record<string, unknown>) =>
    chamar("/api/whatsapp/send", { method: "POST", body: JSON.stringify(body) }, "A mensagem não foi enviada."), [chamar]);

  /* Estado da IA por conversa aberta (agente, pausa, por que não respondeu). */
  const [iaEstados, setIaEstados] = React.useState<Record<string, any>>({});
  const carregarIa = React.useCallback(async (id: string) => {
    try {
      const j = await chamar(`/api/atendimento/conversas/${id}/ia`, { method: "GET" }, "Não consegui ler o estado da IA.");
      setIaEstados((e) => ({ ...e, [id]: j }));
    } catch { /* sem estado: o botão fica em "IA" e diz que está verificando */ }
  }, [chamar]);
  const alternarIa = React.useCallback(async (id: string, ativa: boolean) => {
    try {
      const j = await chamar(`/api/atendimento/conversas/${id}/ia`, { method: "POST", body: JSON.stringify({ ativa }) }, "Não consegui alterar a IA.");
      setIaEstados((e) => ({ ...e, [id]: j }));
      toast.success(ativa ? "IA retomada nesta conversa" : "IA pausada nesta conversa. Você assumiu o atendimento.");
    } catch (e) { toast.error((e as Error).message); }
  }, [chamar]);

  /* Reunião marcada pelo painel da conversa. `X` é o formulário do desenho (data ISO, hora,
     "30 min"/"1 hora", tipo em português, nomes). */
  const agendarReuniao = React.useCallback(async (a: { X: any; contatoId: string; leadId: string | null; email: string | null }) => {
    const { X } = a;
    const quando = new Date(`${X.data}T${X.hora}:00`);
    if (Number.isNaN(quando.getTime())) return toast.error("Data ou horário inválido.");
    const duracao = X.dur === "1 hora" ? 60 : parseInt(String(X.dur), 10) || 30;
    const convidados: string[] = [...(X.convidados ?? []), ...(a.email && !(X.convidados ?? []).includes(a.email) ? [a.email] : [])];
    try {
      await chamar("/api/reunioes", {
        method: "POST",
        body: JSON.stringify({
          titulo: String(X.titulo).trim(), data: quando.toISOString(), duracao,
          tipo: X.tipo === "Ligação" ? "call" : X.tipo === "Presencial" ? "presencial" : "video",
          leadId: a.leadId, participantes: convidados.length ? convidados : null, notas: X.desc || null,
          responsavelId: idPorNome.get(X.resp) ?? dados.eu.id,
        }),
      }, "A reunião não foi agendada.");
    } catch (e) { return toast.error((e as Error).message); }
    const dia = quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
    toast.success(`Reunião agendada para ${dia} às ${X.hora}`);
    if (!X.enviar) return;
    try {
      await enviar({ contatoId: a.contatoId, tipo: "text", conteudo: `Combinado: nossa conversa fica para ${dia} às ${X.hora} (${duracao} min, ${String(X.tipo).toLowerCase()}).` });
      await carregarThread(a.contatoId);
    } catch (e) { toast.error(`A reunião foi agendada, mas o aviso não foi enviado: ${(e as Error).message}`); }
  }, [chamar, enviar, carregarThread, idPorNome, dados.eu.id]);

  const leadsCriadosRef = React.useRef(new Map<string, Promise<string | null>>());

  /**
   * Toda gravação do desenho passa por aqui — é o `gravarOpp` desta tela.
   *
   * O Liga manda a LISTA inteira (ou a filtrada pela caixa) com a mudança
   * aplicada. Diffamos contra o que foi renderizado, conversa por id, e cada
   * diferença vira command, ou aviso honesto quando o command não existe.
   * O que o próprio protótipo fabrica (mensagem 'in', mensagem de "IA") é
   * descartado: não é ação de ninguém.
   */
  const gravarConversas = React.useCallback(async (lista: any[]) => {
    const antesPorId = new Map(renderizadoRef.current.map((c: any) => [c.id, c]));
    const trabalhos: Promise<unknown>[] = [];
    const recarregar = new Set<string>();
    const avisos = new Set<string>();

    for (const depois of lista) {
      const antes: any = antesPorId.get(depois.id);

      /* Conversa nova ("Nova conversa"). Só existe envio para quem já é
         contato ou lead — número solto não tem command. */
      if (!antes) {
        if (depois.canal !== "WhatsApp") {
          /* Atendimento só envia por WhatsApp. Se o operador tentou MANDAR algo
             por outro canal (ex.: compôs um e-mail no painel), avisa que nada
             saiu, em vez do `continue` seco que engolia o envio enquanto o
             protótipo já cantava "E-mail enviado". Sem msg "out" é o artefato
             de relatório de ligação do protótipo, esse segue silencioso. */
          const tentouEnviar = (depois.msgs ?? []).some((m: any) => m.de === "out");
          if (tentouEnviar) avisos.add(`Enviar por ${depois.canal} pelo Atendimento ainda não está ligado; nada foi enviado. Por enquanto só WhatsApp.`);
          continue;
        }
        const alvo = renderizadoRef.current.find((c: any) => c.lead === depois.lead || c.id === depois.lead);
        const texto = [...(depois.msgs ?? [])].reverse().find((m: any) => m.de === "out")?.t;
        if (!alvo) { avisos.add("Iniciar conversa com um número que não é contato ainda não está ligado. Cadastre o lead em Pré-vendas."); continue; }
        if (!texto) continue;
        const de = instRef.current?.state?.nova?.de;
        const sessaoId = dados.sessoes.some((s) => s.id === de) ? de : undefined;
        trabalhos.push(enviar({ contatoId: alvo.id, tipo: "text", conteudo: texto, sessaoId }).then(() => recarregar.add(alvo.id)));
        setTimeout(() => instRef.current?.setState({ sel: alvo.id }), 0);
        continue;
      }

      const delta: Record<string, any> = {};
      const velhas = antes.msgs ?? [];
      const novas = (depois.msgs ?? []).slice(velhas.length);
      let enviou = false;
      const manter: MsgDesenho[] = [];
      for (const m of novas) {
        if (m.de === "in") continue; // resposta fabricada do cliente
        if (m.de === "out" && m.ia) { avisos.add("O NEXO não está ligado: nenhuma mensagem de IA foi enviada."); continue; }
        if (m.de === "nota") {
          /* Nota interna = nota do LEAD (tabela `notas`, a mesma da ficha). Conversa sem
             lead não tem onde guardar: avisar, em vez de mostrar uma nota que some. */
          const lid = antes.lead;
          if (!lid || !leadsPorId.has(lid)) { avisos.add("Vincule a conversa a um lead (Criar lead ou Vincular) para guardar a nota interna."); continue; }
          trabalhos.push(chamar("/api/notas", { method: "POST", body: JSON.stringify({ conteudo: m.t, leadId: lid }) }, "A nota não foi salva.")
            .then(() => { toast.success("Nota salva no lead"); recarregar.add(antes.id); }));
          continue;
        }
        if (m.de === "out") {
          enviou = true;
          /* Áudio gravado e arquivo anexado passaram a trazer o conteúdo
             (audioData / arqData). Antes a tela mostrava o balão e nada saía:
             o payload só tinha imagem ou texto. */
          const payload = m.audioData
            ? { contatoId: antes.id, tipo: "audio", mediaData: m.audioData, conteudo: "" }
            : m.arqData
            ? { contatoId: antes.id, tipo: "document", mediaData: m.arqData, fileName: m.arq, conteudo: m.t ?? "" }
            : m.img
            ? { contatoId: antes.id, tipo: "image", mediaData: m.img, fileName: m.arq, conteudo: m.t ?? "" }
            : { contatoId: antes.id, tipo: "text", conteudo: m.t };
          /* Recusa do servidor (número desconectado, anexo inválido): o balão otimista sai e o
             texto volta para o campo. Antes ficava um balão com tique, como se tivesse ido. */
          trabalhos.push(enviar(payload).then(() => recarregar.add(antes.id), (e) => {
            recarregar.add(antes.id);
            if (payload.tipo === "text") instRef.current?.setState((st: any) => (st.texto ? null : { texto: payload.conteudo }));
            throw e;
          }));
        }
        manter.push(m);
      }
      if (manter.length) delta.msgs = velhas.concat(manter);

      // Reação e apagar: as actions do WhatsApp existem, por id da mensagem.
      velhas.forEach((v0: any, i: number) => {
        const v1 = depois.msgs?.[i];
        if (!v1 || !v0.waId) return;
        const sessaoId = antes.sessaoId ?? undefined;
        if (v1.apagada && !v0.apagada) {
          trabalhos.push(chamar("/api/whatsapp/actions", { method: "POST", body: JSON.stringify({ action: "delete", phone: antes.telefone, messageId: v0.waId, sessaoId }) }, "Não consegui apagar a mensagem.").then(() => recarregar.add(antes.id)));
        } else if (v1.reacao !== v0.reacao) {
          if (v1.reacao) trabalhos.push(chamar("/api/whatsapp/actions", { method: "POST", body: JSON.stringify({ action: "react", phone: antes.telefone, messageId: v0.waId, emoji: v1.reacao, sessaoId }) }, "Não consegui reagir."));
          else avisos.add("Remover reação ainda não está ligado.");
        }
      });

      /* Assumir, transferir, fechar, reabrir e soneca existem só para a
         conversa de WhatsApp: a rota `/acao` procura o id em `contatos`, e a
         lista também traz ligação e e-mail, cujos ids não estão lá. Medido em
         06/10: fechar um item de ligação devolvia 404 e a tela dizia só "A ação
         não foi aceita". Mesmo tratamento do envio por outro canal — avisa o
         que não foi feito, em vez de chamar uma rota que vai recusar. */
      if (antes.canal && antes.canal !== "WhatsApp") {
        if (depois.resp !== antes.resp || depois.status !== antes.status) {
          avisos.add(`${antes.canal} não é uma conversa da fila: assumir, transferir ou fechar ainda não está ligado. Nada foi alterado.`);
        }
        continue;
      }

      // Responsável: nome → usuário. Sem dono = release.
      const trocouResp = depois.resp !== antes.resp;
      if (trocouResp) {
        if (!depois.resp) trabalhos.push(acao(antes.id, { acao: "release" }));
        else {
          const uid = idPorNome.get(depois.resp);
          if (!uid) avisos.add(`Não achei o usuário "${depois.resp}".`);
          else trabalhos.push(acao(antes.id, uid === dados.eu.id ? { acao: "claim" } : { acao: "transfer", usuarioId: uid }));
        }
        delta.resp = depois.resp;
      }

      // Status: só três têm command (close, reopen, snooze).
      if (depois.status !== antes.status) {
        if (depois.status === "resolvida") {
          // O modal de encerramento escreve "Atendimento encerrado · <motivo> — <obs>" como mensagem de sistema.
          const motivo = novas.find((m: any) => m.de === "sis" && /^Atendimento encerrado · /.test(m.t ?? ""))?.t?.replace(/^Atendimento encerrado · /, "") ?? null;
          trabalhos.push(acao(antes.id, { acao: "close", motivo })); delta.status = "resolvida";
        }
        else if (antes.status === "resolvida") { trabalhos.push(acao(antes.id, { acao: "reopen" })); delta.status = "atendimento"; }
        else if (depois.status === "retornar") {
          const minutos = minutosAte(depois.retorno);
          if (minutos) { trabalhos.push(acao(antes.id, { acao: "snooze", minutos })); delta.status = "retornar"; delta.retorno = depois.retorno; }
          else avisos.add("Não entendi o horário de retorno; nada foi gravado.");
        } else if (!enviou && !trocouResp) {
          /* "Aguardando cliente" é derivado da última mensagem e "Aguardando
             time" não existe no domínio. Escolher no popup não grava nada. */
          avisos.add(`O status "${depois.status === "interno" ? "Aguardando time" : depois.status}" não existe no domínio: é calculado pela conversa.`);
        }
      }

      if ((depois.naoLidas ?? 0) === 0 && (antes.naoLidas ?? 0) > 0) delta.naoLidas = 0;
      else if ((depois.naoLidas ?? 0) > (antes.naoLidas ?? 0)) { trabalhos.push(acao(antes.id, { acao: "mark_unread" })); delta.naoLidas = depois.naoLidas; }
      if (depois.numero !== antes.numero) avisos.add("Trocar o número de envio não tem command: cada número é a sessão de WhatsApp de uma pessoa.");
      if (depois.prioridade !== antes.prioridade) avisos.add("Prioridade não existe no domínio do atendimento; nada foi gravado.");
      if (depois.ia && !antes.ia) avisos.add("O NEXO não está ligado nesta organização.");
      if (depois.lead !== antes.lead) {
        /* Vincular grava contatos.lead_id (ação link_lead). Desvincular não tem command. */
        const criando = depois.lead ? leadsCriadosRef.current.get(depois.lead) : undefined;
        if (depois.lead && (dados.leads.some((l) => l.id === depois.lead) || leadsBuscadosRef.current.some((l) => l.id === depois.lead))) {
          trabalhos.push(acao(antes.id, { acao: "link_lead", leadId: depois.lead }).then(() => { toast.success("Conversa vinculada ao lead"); }));
          delta.lead = depois.lead;
        } else if (criando) {
          /* Lead criado agora pelo "Criar lead": vincula quando o id real existir. */
          trabalhos.push(criando.then((id) => {
            if (!id) throw new Error("O lead não foi criado; a conversa não foi vinculada.");
            return acao(antes.id, { acao: "link_lead", leadId: id }).then(() => { toast.success("Conversa vinculada ao lead"); });
          }));
        } else if (!depois.lead) avisos.add("Desvincular a conversa de um lead ainda não está ligado.");
      }

      if (Object.keys(delta).length) setLocal((l) => ({ ...l, [antes.id]: { ...(l[antes.id] ?? {}), ...delta } }));
    }

    avisos.forEach((a) => toast(a));
    if (!trabalhos.length) return;
    const res = await Promise.allSettled(trabalhos);
    const falhas = res.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    falhas.forEach((f) => toast.error(f.reason?.message ?? "A ação não foi gravada."));
    await Promise.all([...recarregar].map((id) => carregarThread(id)));
    router.refresh();
  }, [acao, chamar, enviar, carregarThread, idPorNome, dados.eu.id, dados.sessoes, router]);

  /* Tag criada no popup ("Criar nova tag"): vira label real da organização (a mesma lista de Ajustes e
     de Pré-vendas). A aplicação à conversa, logo em seguida, espera esta promessa. */
  const labelsCriadasRef = React.useRef(new Map<string, Promise<string>>());
  const criarTagsNovas = React.useCallback((lista: any[]) => {
    for (const item of lista) {
      const nome = String(typeof item === "string" ? item : item?.nome ?? "").trim();
      if (!nome || labelPorNome.has(nome) || labelsCriadasRef.current.has(nome)) continue;
      labelsCriadasRef.current.set(nome, chamar("/api/labels", { method: "POST", body: JSON.stringify({ nome, cor: "#6B7280" }) }, `Não consegui criar a tag "${nome}".`).then((l) => l.id as string));
    }
  }, [labelPorNome, chamar]);

  const gravarTags = React.useCallback(async (novo: Record<string, string[]>) => {
    const trabalhos: Promise<unknown>[] = [];
    for (const [chave, nomes] of Object.entries(novo)) {
      const antes = new Set(tagsLead[chave] ?? []);
      const depois = new Set(nomes ?? []);
      const contatos = renderizadoRef.current.filter((c: any) => c.lead === chave).map((c: any) => c.id);
      for (const n of depois) if (!antes.has(n) && !labelPorNome.has(n) && labelsCriadasRef.current.has(n)) {
        for (const id of contatos) trabalhos.push(labelsCriadasRef.current.get(n)!.then((labelId) => chamar(`/api/atendimento/conversas/${id}/tags`, { method: "POST", body: JSON.stringify({ labelId }) }, `Não consegui aplicar a tag "${n}".`)));
      }
      for (const n of depois) if (!antes.has(n) && labelPorNome.has(n)) {
        for (const id of contatos) trabalhos.push(chamar(`/api/atendimento/conversas/${id}/tags`, { method: "POST", body: JSON.stringify({ labelId: labelPorNome.get(n) }) }, `Não consegui aplicar a tag "${n}".`));
      }
      for (const n of antes) if (!depois.has(n) && labelPorNome.has(n)) {
        for (const id of contatos) trabalhos.push(chamar(`/api/atendimento/conversas/${id}/tags/${labelPorNome.get(n)}`, { method: "DELETE" }, `Não consegui remover a tag "${n}".`));
      }
    }
    if (!trabalhos.length) return;
    const res = await Promise.allSettled(trabalhos);
    res.forEach((r) => { if (r.status === "rejected") toast.error((r.reason as Error)?.message ?? "Tag não gravada."); });
    router.refresh();
  }, [tagsLead, labelPorNome, chamar, router]);

  const gravarTemplates = React.useCallback(async (lista: any[]) => {
    const antes = new Map(templates.map((t) => [t.id, t]));
    const depois = new Map(lista.map((t) => [t.id, t]));
    const trabalhos: Promise<unknown>[] = [];
    for (const t of lista) {
      const a = antes.get(t.id);
      if (!a) {
        trabalhos.push(chamar("/api/whatsapp/templates", { method: "POST", body: JSON.stringify({ nome: t.nome, categoria: categoriaDoDesenho(t), conteudo: t.texto }) }, "Template não foi criado."));
        if (t.escopo === "meu") toast("Templates são do time inteiro: o domínio não tem template pessoal.");
      } else if (a.nome !== t.nome || a.texto !== t.texto || a.cat !== t.cat) {
        trabalhos.push(chamar(`/api/whatsapp/templates/${t.id}`, { method: "PATCH", body: JSON.stringify({ nome: t.nome, categoria: categoriaDoDesenho(t), conteudo: t.texto }) }, "Template não foi salvo."));
      }
    }
    for (const id of antes.keys()) if (!depois.has(id)) {
      trabalhos.push(chamar(`/api/whatsapp/templates/${id}`, { method: "DELETE" }, "Template não foi excluído."));
    }
    const res = await Promise.allSettled(trabalhos);
    res.forEach((r) => { if (r.status === "rejected") toast.error((r.reason as Error)?.message ?? "Template não gravado."); });
    router.refresh();
  }, [templates, chamar, router]);

  /* "Criar lead" do painel da conversa: o desenho manda o lead novo com id local.
     Vira acaoCriarLead (a mesma porta de Pré-vendas, com origem WhatsApp); o id real
     é entregue a quem for vincular a conversa. */
  const criarLeadsNovos = React.useCallback((lista: any[]) => {
    for (const l of lista) {
      if (!l?.id || leadsPorId.has(l.id) || leadsCriadosRef.current.has(l.id)) continue;
      const eu = dados.eu.id;
      leadsCriadosRef.current.set(l.id, acaoCriarLead({
        empresa: String(l.empresa ?? "").trim(), pessoaNome: String(l.pessoa ?? "").trim(),
        cargo: l.cargo || null, email: l.email || null,
        /* Só dígitos: o campo traz a máscara "+55 (11) 90000-0088" e o contato da conversa
           guarda "5511900000088". */
        telefone: String(l.tel ?? "").replace(/\D/g, "") || null,
        origem: "WhatsApp", permitirSemEmpresa: true,
        /* O modal mostra "Responsável" e "Interesse": os dois eram descartados. */
        responsavelId: (l.resp && idPorNome.get(l.resp)) || eu,
        servicosInteresse: l.interesse && l.interesse !== "Não identificado" ? [l.interesse] : null,
      }).then((r) => {
        if (!r.ok) { toast.error(r.erro ?? "Não consegui criar o lead."); return null; }
        toast.success("Lead criado em Pré-vendas");
        return r.dados?.leadId ?? null;
      }));
    }
  }, [leadsPorId, dados.eu.id, idPorNome]);

  /* Pausar, retomar e remover do painel de cadência: viram a ação da inscrição REAL
     (mesma rota da tela de Cadências), não um estado local que sumia no reload. */
  const gravarCadencias = React.useCallback(async (novo: Record<string, any>) => {
    const trabalhos: Promise<unknown>[] = [];
    for (const [leadId, v] of Object.entries(novo)) {
      const atual = cadencias[leadId];
      if (!atual) continue; // inserir é da peça de cadência, que grava sozinha
      const acaoDaInscricao = v === null ? "cancel" : (v?.pausada ?? false) !== atual.pausada ? (v.pausada ? "pause" : "resume") : null;
      if (!acaoDaInscricao) continue;
      trabalhos.push(chamar(`/api/automacoes/cadencias/enrollments/${atual.enrollmentId}/action`, { method: "POST", body: JSON.stringify({ action: acaoDaInscricao }) }, "A cadência não foi alterada."));
    }
    if (!trabalhos.length) return;
    const res = await Promise.allSettled(trabalhos);
    res.forEach((r) => { if (r.status === "rejected") toast.error((r.reason as Error)?.message ?? "A cadência não foi alterada."); });
    router.refresh();
  }, [cadencias, chamar, router]);

  const gravar = React.useCallback((patch: Record<string, any>) => {
    if (patch.cadencias) void gravarCadencias(patch.cadencias);
    if (patch.tagsCriadas) criarTagsNovas(patch.tagsCriadas);
    if (patch.leads) criarLeadsNovos(patch.leads);
    if (patch.conversas) void gravarConversas(patch.conversas);
    if (patch.tagsLead) void gravarTags(patch.tagsLead);
    if (patch.templates) void gravarTemplates(patch.templates);
    for (const k of Object.keys(SEM_COMMAND)) if (k in patch) toast(SEM_COMMAND[k]);
  }, [gravarConversas, gravarTags, gravarTemplates, criarLeadsNovos, gravarCadencias, criarTagsNovas]);

  /* ── Navegação ── */
  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "detalhe" && id) {
      if (leadsPorId.has(id)) { router.push(`/pessoas/${id}`); return; }
      toast("Este contato ainda não é lead no CRM.");
      return;
    }
    /* Atividade guarda vínculo com um LEAD (é a tabela `tarefas`): conversa de contato sem
       cadastro não tem a quem prender a tarefa. */
    if (peca.startsWith("atividade") && !(id && leadsPorId.has(id))) {
      toast("Vincule a conversa a um lead (Criar lead ou Vincular) para criar a atividade.");
      return;
    }
    abrirPeca(peca, id, { tela: "atendimento", leadId: id && leadsPorId.has(id) ? id : null });
  }, [leadsPorId, router, abrirPeca]);

  const ir = React.useCallback((href: string, _rotulo?: string, params?: { lead?: string }) => {
    const lead = params?.lead ? leadsPorId.get(params.lead) : undefined;
    if (href.endsWith("/pessoa")) {
      if (lead) router.push(`/pessoas/${lead.id}`); else toast("Este contato ainda não é lead no CRM.");
      return;
    }
    if (href.endsWith("/empresa")) {
      if (lead?.empresaId) router.push(`/empresas/${lead.empresaId}`); else toast("Sem empresa cadastrada para este contato.");
      return;
    }
    router.push(rotaDoDesenho(href, params));
  }, [leadsPorId, router]);

  /* Minhas / Equipe vive na URL: o servidor refaz a lista inteira (lista, contadores, abas, métricas). */
  const mudarEscopo = React.useCallback((e: string) => {
    const q = new URLSearchParams(window.location.search);
    if (e === "equipe") q.set("escopo", "equipe"); else q.delete("escopo");
    q.delete("leadId");
    router.replace(`/atendimento${q.size ? `?${q}` : ""}`);
  }, [router]);

  const primeiraResposta = dados.primeiraRespostaMediaSeg == null ? "—" : duracao(dados.primeiraRespostaMediaSeg);

  if (!montado) {
    return <div data-workspace="desenho" aria-busy="true" style={{ background: "var(--of-papel-tela)" }} />;
  }

  /* Sem nenhuma conversa visível, o desenho ainda monta o cabeçalho e o painel
     de uma conversa — com "Encerrar", "Transferir" e "Ativar NEXO" clicáveis
     para conversa nenhuma. Botão sem alvo é botão mentiroso.

     Zero aqui quase sempre é a regra de privacidade (decisão de 09/09,
     lib/whatsapp/acesso): quem não é super_admin vê as próprias conversas e as
     sem dono. Dizer isso evita que o vazio pareça defeito. */
  if (conversas.length === 0) {
    return (
      <div data-workspace="desenho" style={{ background: "var(--of-papel-tela)", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: "center", background: "var(--of-papel)", borderRadius: 14, boxShadow: "inset 0 0 0 1px var(--of-linha)", padding: "28px 26px" }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 17, fontWeight: 700, color: "var(--of-tinta-forte)" }}>
            {dados.escopo === "equipe" ? "Nenhuma conversa na equipe" : "Nenhuma conversa para você agora"}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--of-tinta-3)" }}>
            {dados.escopo === "equipe"
              ? "Nenhum número da equipe tem conversa de WhatsApp."
              : "Conversas de WhatsApp são pessoais: aqui aparecem as dos seus números e as atribuídas a você."}
            {dados.sessoes.length ? ` Há ${dados.sessoes.length} ${dados.sessoes.length === 1 ? "número" : "números"} nesta visão.` : ""}
          </p>
          {dados.podeVerEquipe ? (
            <button type="button" onClick={() => mudarEscopo(dados.escopo === "equipe" ? "minhas" : "equipe")}
              style={{ marginTop: 12, height: 32, padding: "0 14px", borderRadius: 9, border: 0, cursor: "pointer", background: "var(--of-papel-tela)", color: "var(--of-tinta-forte)", fontSize: 12.5, fontWeight: 600, boxShadow: "inset 0 0 0 1px var(--of-linha)" }}>
              {dados.escopo === "equipe" ? "Ver minhas conversas" : "Ver a equipe"}
            </button>
          ) : null}
          <a href="/contatos" style={{ display: "inline-flex", marginTop: 16, height: 36, alignItems: "center", padding: "0 16px", borderRadius: 9, background: "var(--of-coral-acao)", color: "var(--of-papel)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Abrir Contatos
          </a>
        </div>
      </div>
    );
  }

  return (
    <div data-workspace="desenho">
      <AtendimentoLigado
        dados={{
          conversas,
          leads,
          tagsLead,
          // `tagsCriadas` é onde o Liga lê tags além das cinco dele: as reais.
          tagsCriadas: dados.labels.map((l) => l.nome),
          templates,
          // Próxima tarefa aberta do lead (lib/atendimento/contexto).
          atvs,
          // Sem fonte por contato de WhatsApp (ver pendências): vazio é honesto.
          qual: {},
          // A cadência é a inscrição real do lead; o painel lê o nome e o resto vem de `cadencias` abaixo.
          cadencias: Object.fromEntries(Object.entries(cadencias).map(([k, c]) => [k, { nome: c.nome, pausada: c.pausada, passo: c.passo, total: c.total }])),
        }}
        catalogo={catalogo}
        contexto={contexto}
        sessoes={dados.sessoes}
        euId={dados.eu.id}
        escopo={{ atual: dados.escopo, pode: dados.podeVerEquipe, mudar: mudarEscopo }}
        setores={setores}
        primeiraResposta={primeiraResposta}
        registrar={(i: any) => { instRef.current = i; }}
        agendarReuniao={agendarReuniao}
        cargaEquipe={dados.cargaEquipe}
        cadReais={cadencias}
        iaEstados={iaEstados}
        alternarIa={alternarIa}
        abrirAgente={(id: string) => router.push(`/automacoes/agentes/${id}`)}
        aoSelecionar={(id: string) => { selecionadaRef.current = id; void carregarThread(id); void carregarIa(id); }}
        buscarLeads={buscarLeadsRemoto}
        gravar={gravar}
        abrir={abrir}
        abrirExterno={(url: string) => window.open(url, "_blank", "noopener")}
        ir={ir}
      />
    </div>
  );
}

/* Exposto só para a conferência de números (scripts de verificação rodam a
   lógica do desenho com o dado real, sem navegador). Não é API da tela. */
export { AtendimentoLigado as _AtendimentoLigado, paraODesenho as _paraODesenho, leadsDoDesenho as _leadsDoDesenho, semExtra as _semExtra };
