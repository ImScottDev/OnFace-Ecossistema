"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Relatório de ligação — o adaptador da peça `relatorio`.
 *
 * O desenho (`RelatorioLigacaoDesenho`) e a lógica gerada
 * (`RelatorioLigacaoLiga`) não se editam. A Liga monta tudo a partir de UMA
 * análise de exemplo (`ANALISES.c4`) com nomes trocados — aqui `renderVals`
 * é refeito sobre a ligação REAL (`ligacoes`, webhook da Callface): duração,
 * status, gravação, transcrição e o resumo da IA lido por
 * `parseResumoCallface`, o mesmo parser do Atendimento. Os estilos são os da
 * Liga; o que muda é a origem do dado.
 *
 * O que a Callface NÃO manda fica vazio, não inventado: nota de qualidade
 * (radar), sentimento, BANT e momentos marcados. Ligação sem resumo mostra o
 * aviso; sem transcrição, a lista vazia.
 *
 * Gravar:
 *  - próximo passo → `acaoCriarTarefa` (o command de Pré-vendas), dono = quem
 *    ligou; e o desfecho vira NOTA do lead (`POST /api/notas`). A nota é o que
 *    marca o passo como feito depois do reload.
 *  - marcar passo sem criar atividade → só a nota.
 *  - resumo no WhatsApp → `POST /api/whatsapp/send` (allowlist em dev).
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { toast } from "sonner";

import { acaoCriarTarefa, acaoDetalhe } from "@/app/(produto)/pre-vendas/actions";
import type { DetalheLead } from "@/lib/vendas/consultas";
import { parseResumoCallface, type ResumoCallfaceParsed } from "@/lib/utils/parse-resumo-callface";
import { RelatorioLigacaoLiga } from "./RelatorioLigacaoLiga";
import { usePecas, type AbrirPeca, type PecaProps } from "./pecas-host";

/* ── Dado ──────────────────────────────────────────────────────────────── */

interface Fala { text: string; time: number; speaker: string }
interface Ligacao {
  id: string; leadId: string | null; usuarioId: string | null;
  usuarioNome: string | null; userName: string | null;
  destinationNumber: string | null; callDate: string | null; createdAt: string;
  duracaoSegundos: number | null; callStatus: string | null;
  resumo: string | null; transcricao: Fala[] | null;
  callLink: string | null; audioUrl: string | null;
  closurePercentage: number | null;
  scheduling: { has_scheduling?: boolean; items?: Array<{ date?: string; status?: string; category?: string; communication_type?: string }> } | null;
}
interface Nota { conteudo: string }
interface Passo { k: string; t: string; meta: string; venceEm: string | null }

const STATUS: Record<string, string> = {
  FINISHED: "Atendida", MISSED: "Não atendida", BUSY: "Ocupado",
  VOICEMAIL: "Caixa postal", FAILED: "Falhou",
};
const CANAL: Record<string, string> = {
  email: "E-mail", ligacao: "Ligação", whatsapp: "WhatsApp",
  "reuniao-online-meet": "Reunião online", "reuniao-online": "Reunião online",
};

const p2 = (n: number) => String(n).padStart(2, "0");
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mmss = (s: number) => Math.floor(s / 60) + ":" + p2(Math.floor(s % 60));
const hora = (d: Date) => p2(d.getHours()) + ":" + p2(d.getMinutes());

function quandoLigou(iso: string): string {
  const d = new Date(iso), hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const mesmo = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmo(d, hoje)) return "Hoje, " + hora(d);
  if (mesmo(d, ontem)) return "Ontem, " + hora(d);
  return d.getDate() + " " + MES[d.getMonth()] + ", " + hora(d);
}
const dataCurta = (iso: string) => { const d = new Date(iso); return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " " + hora(d); };

function formatarTel(n: string | null): string {
  const d = String(n ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return n || "Sem número";
}
const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** A chave do passo: entra na nota e é por ela que o passo aparece feito. */
export function chaveDoPasso(callDate: string, t: string) {
  return `Próximo passo da ligação de ${dataCurta(callDate)}: ${t}`;
}

/** Passos reais: os agendamentos que a IA detectou (com data) e as "Próximas Ações". */
export function passosDaLigacao(lig: Pick<Ligacao, "scheduling">, parsed: ResumoCallfaceParsed | null): Passo[] {
  const out: Passo[] = [];
  for (const it of lig.scheduling?.items ?? []) {
    if (!it.category) continue;
    const d = it.date ? new Date(it.date) : null;
    const ok = d && !Number.isNaN(d.getTime());
    out.push({
      k: "s" + out.length,
      t: it.category + (ok ? " · " + p2(d!.getDate()) + "/" + p2(d!.getMonth() + 1) + " " + hora(d!) : ""),
      meta: [CANAL[it.communication_type ?? ""] ?? it.communication_type, it.status].filter(Boolean).join(" · "),
      venceEm: ok ? d!.toISOString() : null,
    });
  }
  for (const linha of parsed?.proximasAcoes ?? []) {
    const [t, meta] = linha.split(/\s+—\s+/);
    if (out.some((p) => semAcento(p.t).startsWith(semAcento(t)))) continue;
    out.push({ k: "a" + out.length, t: t.trim(), meta: (meta ?? "Sugerido pelo Callface AI").trim(), venceEm: null });
  }
  return out;
}

/* ── A Liga sobre a ligação real ───────────────────────────────────────── */

interface PropsReal {
  lig: Ligacao; lista: Ligacao[]; lead: DetalheLead | null; notas: Nota[];
  abrirPeca: AbrirPeca; recarregarNotas: () => Promise<void>;
  fechar: () => void; gravou: () => void;
}

const ICO = {
  interesses: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  dores: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  objecoes: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

class RelatorioReal extends RelatorioLigacaoLiga {
  _audio: HTMLAudioElement | null = null;
  _gravando = false;

  get p(): PropsReal { return (this as any).props; }

  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto); else toast(texto);
  }

  componentDidMount() {
    super.componentDidMount();
    const id = this.p.lig.id;
    (this as any).setState({ aberto: true, convId: id, leadId: this.p.lig.leadId, laba: "resumo", lbusca: "", lp: { id, t: 0, on: false, v: 1 }, wa: null });
  }
  componentWillUnmount() {
    super.componentWillUnmount();
    this._audio?.pause();
    this._audio = null;
  }

  /** O barramento do protótipo não existe aqui: quem abre é o hospedeiro. */
  abrir() {}

  fechar() {
    this._audio?.pause();
    (this as any).setState({ aberto: false, wa: null, lp: null });
    this.p.fechar();
  }

  /** O áudio de verdade, no lugar do relógio que fingia tocar. */
  audio(): HTMLAudioElement | null {
    const url = this.p.lig.audioUrl;
    if (!url) return null;
    if (!this._audio) {
      const a = new Audio(url);
      a.preload = "metadata";
      a.addEventListener("timeupdate", () => this.setLP({ t: a.currentTime }));
      a.addEventListener("ended", () => this.setLP({ on: false }));
      a.addEventListener("pause", () => this.setLP({ on: false }));
      a.addEventListener("play", () => this.setLP({ on: true }));
      a.addEventListener("error", () => { this.setLP({ on: false }); this.diz("Não consegui carregar a gravação desta ligação.", "erro"); });
      this._audio = a;
    }
    return this._audio;
  }
  setLP(p: Record<string, unknown>) {
    const id = this.p.lig.id;
    (this as any).setState((s: any) => ({ lp: { ...((s.lp && s.lp.id === id) ? s.lp : { id, t: 0, on: false, v: 1 }), ...p } }));
  }
  play() {
    const a = this.audio();
    if (!a) return this.diz("Esta ligação não tem gravação.");
    if (a.paused) a.play().catch(() => this.diz("Não consegui tocar a gravação.", "erro"));
    else a.pause();
  }
  tocarDe(t: number) {
    const a = this.audio();
    if (!a) return this.diz("Esta ligação não tem gravação.");
    a.currentTime = t;
    this.setLP({ t });
    if (a.paused) a.play().catch(() => this.diz("Não consegui tocar a gravação.", "erro"));
  }
  velocidade(v: number) {
    if (this._audio) this._audio.playbackRate = v;
    this.setLP({ v });
  }

  /** Desfecho do passo → nota do lead (e, se pedido, a tarefa antes). */
  async registrarPasso(passo: Passo, criarTarefa: boolean) {
    const { lig } = this.p;
    if (this._gravando) return;
    if (!lig.leadId) return this.diz("Ligação sem lead casado — não há onde registrar.", "erro");
    this._gravando = true;
    const chave = chaveDoPasso(lig.callDate ?? lig.createdAt, passo.t);
    try {
      if (criarTarefa) {
        const r = await acaoCriarTarefa({
          leadId: lig.leadId, titulo: passo.t, responsavelId: lig.usuarioId,
          venceEm: passo.venceEm, prioridade: "media", descricao: chave,
        });
        if (!r.ok) throw new Error(r.erro ?? "A atividade não foi criada.");
      }
      const res = await fetch("/api/notas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lig.leadId, conteudo: chave + (criarTarefa ? " — atividade criada." : " — marcado como feito.") }),
      });
      if (!res.ok) throw new Error("O desfecho não foi registrado.");
      await this.p.recarregarNotas();
      this.p.gravou();
      this.diz(criarTarefa ? "Atividade criada · " + passo.t : "Registrado · " + passo.t);
    } catch (e) {
      this.diz(e instanceof Error ? e.message : "Não consegui registrar.", "erro");
    } finally {
      this._gravando = false;
    }
  }

  async enviarResumoWa(texto: string) {
    const { lig } = this.p;
    if (!lig.leadId) return this.diz("Ligação sem lead casado.", "erro");
    const res = await fetch("/api/whatsapp/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lig.leadId, conteudo: texto, tipo: "text" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return this.diz(j.error || "A mensagem não foi enviada.", "erro");
    }
    (this as any).setState({ wa: null });
    this.p.gravou();
    this.diz("Resumo enviado no WhatsApp");
  }

  renderVals(): any {
    const S = (this as any).state;
    if (!S.aberto) return { aberto: false, r: {}, w: { aberto: false }, fora: () => {} };
    const { lig, lista, lead, notas, abrirPeca } = this.p;
    const parsed = parseResumoCallface(lig.resumo);
    const falasR: Fala[] = Array.isArray(lig.transcricao) ? lig.transcricao.filter((f) => f && typeof f.text === "string") : [];
    const ultimaFala = falasR.length ? Number(falasR[falasR.length - 1].time) || 0 : 0;
    const dur = Math.max(1, lig.duracaoSegundos || (this._audio && isFinite(this._audio.duration) ? this._audio.duration : 0) || Math.ceil(ultimaFala));
    const quandoIso = lig.callDate ?? lig.createdAt;
    const recebida = /\/IN-/.test(lig.audioUrl ?? "");
    const tipo = recebida ? "Ligação recebida" : "Ligação realizada";
    const pessoa = lead?.pessoa.nome || "contato";
    const primeiro = pessoa.replace(/^Dr\.?\s+/, "").split(" ")[0];
    const atendente = lig.usuarioNome || lig.userName || "Vendedor";
    const atNome = atendente.split(" ")[0];
    const clNome = pessoa === "contato" ? "Cliente" : pessoa.split(" ").slice(0, 2).join(" ");
    const ini = (n: string) => n.split(" ").slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
    const telefone = lead?.pessoa.telefone || lead?.pessoa.whatsapp || lig.destinationNumber;
    const statusRotulo = STATUS[lig.callStatus ?? ""] ?? (lig.callStatus || "Registrada");

    const LP = S.lp && S.lp.id === lig.id ? S.lp : { id: lig.id, t: 0, on: false, v: 1 };
    const ouvido = LP.on || LP.t > 0;
    const falas = falasR.map((f) => [Number(f.time) || 0, f.speaker === "client" ? "cl" : "at", f.text] as [number, string, string]);
    const quemEm = (t: number) => { let q = "at"; falas.forEach((x) => { if (x[0] <= t) q = x[1]; }); return q; };
    const falaAtual = falas.reduce((acc, x, i) => (x[0] <= LP.t ? i : acc), 0);

    // Fala do cliente: parte dos caracteres transcritos. Sem transcrição, não há conta.
    const chars = falas.reduce((s, x) => { s[x[1] as "at" | "cl"] += x[2].length; return s; }, { at: 0, cl: 0 });
    const totalChars = chars.at + chars.cl;
    const falaAt = totalChars ? Math.round((chars.at / totalChars) * 100) : null;

    const N = 88;
    const onda = Array.from({ length: N }, (_, i) => {
      const t = (i / N) * dur;
      const q = falas.length ? quemEm(t) : "at";
      const pert = falas.some((x) => Math.abs(x[0] - t) < 1.2);
      const h = pert ? 5 : Math.round(7 + 25 * Math.abs(Math.sin(i * 1.93 + 0.4) * Math.cos(i * 0.37)));
      const tocado = t <= LP.t;
      const cor = q === "at" ? (tocado ? "var(--of-tinta-forte)" : "var(--of-linha-convite)") : (tocado ? "var(--of-coral-marca)" : "var(--of-coral-anel)");
      return { style: "flex:1;min-width:1px;border-radius:9999px;height:" + h + "px;background:" + cor + ";transition:background .15s" };
    });

    // Chance de fechar: o número da IA; a nota compara com a ligação anterior do mesmo contato.
    const chanceDe = (l: Ligacao) => l.closurePercentage ?? parseResumoCallface(l.resumo)?.chanceFechamento ?? null;
    const chance = chanceDe(lig);
    const idx = lista.findIndex((l) => l.id === lig.id);
    const anterior = lista.slice(idx + 1).map(chanceDe).find((c) => c != null) ?? null;
    const comChance = lista.map(chanceDe).filter((c): c is number => c != null);
    const chanceNota = chance != null && anterior != null
      ? (chance > anterior ? "↑ " + (chance - anterior) + " pts" : chance < anterior ? "↓ " + (anterior - chance) + " pts" : "Igual") + " vs. ligação anterior"
      : "";
    const chanceSub = chance == null ? "A IA não estimou nesta ligação"
      : comChance.length > 1 ? "Média do contato: " + Math.round(comChance.reduce((a, b) => a + b, 0) / comChance.length) + "% em " + comChance.length + " ligações"
      : "Primeira estimativa deste contato";

    const urgN = parsed?.urgencia === "high" ? 3 : parsed?.urgencia === "medium" ? 2 : parsed?.urgencia === "low" ? 1 : 0;
    const urgencia = ["—", "Baixa", "Média", "Alta"][urgN];

    const q = semAcento(S.lbusca || "");
    const falasF = falas.map((x, i) => ({ x, i })).filter((o) => !q || semAcento(o.x[2]).includes(q));
    const textoTodo = semAcento(falas.map((x) => x[2]).join(" "));
    const contar = (k: string) => { const s = semAcento(k); if (!s) return 0; let n = 0, i = 0; while ((i = textoTodo.indexOf(s, i)) >= 0) { n++; i += s.length; } return n; };

    const passos = passosDaLigacao(lig, parsed);
    const feitos = new Set(passos.filter((p) => notas.some((n) => n.conteudo.includes(chaveDoPasso(quandoIso, p.t)))).map((p) => p.k));
    const nFeitos = feitos.size;

    const resumoParas = parsed?.resumoNarrativo
      ? parsed.resumoNarrativo.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
      : lig.resumo?.trim() ? [lig.resumo.trim()] : [];

    const blocos = ([
      ["INTERESSES", ICO.interesses, "var(--of-canal-whatsapp-tinta)", "var(--of-canal-whatsapp-fundo)", parsed?.interesses],
      ["DORES", ICO.dores, "var(--of-coral-acao-hover)", "var(--of-coral-fundo)", parsed?.problemas],
      ["OBJEÇÕES", ICO.objecoes, "var(--of-tinta-2)", "var(--of-calha)", parsed?.objecoes],
    ] as const).filter((b) => !!b[4]).map(([titulo, d, cor, bg, texto]) => ({
      titulo, d, n: "1", itens: [{ t: texto, temR: false, r: "" }],
      icoStyle: "flex:0 0 auto;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:" + bg + ";color:" + cor,
      bullet: "flex:0 0 auto;width:5px;height:5px;border-radius:9999px;margin-top:7px;background:" + cor,
    }));

    const ESEG = (on: boolean) => "height:30px;padding:0 14px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;" + (on ? "background:var(--of-papel);color:var(--of-tinta-forte);box-shadow:0 1px 2px rgba(18,23,29,.08)" : "background:transparent;color:var(--of-tinta-2)");
    const C26 = 2 * Math.PI * 26;

    const abrirWa = () => {
      if (!lead?.pessoa.telefone && !lead?.pessoa.whatsapp) return this.diz("Este contato não tem telefone cadastrado.", "erro");
      const base = parsed?.resumoNarrativo?.split(/\n\s*\n/)[0] ?? parsed?.objetivo ?? "";
      const proximos = passos.length ? " Próximos passos: " + passos.map((p) => p.t).join("; ") + "." : "";
      (this as any).setState({ wa: { texto: "Olá, " + primeiro + "! Obrigado pela conversa. Segue o resumo: " + base + proximos, de: 0 } });
    };

    const r = {
      ativo: true, nao: false,
      titulo: tipo + (recebida ? " de " : " para ") + pessoa,
      status: statusRotulo,
      quando: quandoLigou(quandoIso), numero: formatarTel(lig.destinationNumber), duracao: mmss(lig.duracaoSegundos ?? 0),
      atendente: (lig.callStatus === "FINISHED" ? "Atendida por " : "Feita por ") + atendente,
      geradoEm: parsed ? hora(new Date(quandoIso)) : "indisponível",
      baixar: () => {
        if (!lig.audioUrl) return this.diz("Esta ligação não tem gravação.");
        window.open(lig.audioUrl, "_blank", "noopener");
        this.diz("Abrindo a gravação (" + mmss(dur) + ")");
      },
      abrirCallface: () => {
        if (!lig.callLink) return this.diz("Esta ligação não tem link no Callface.");
        window.open(lig.callLink, "_blank", "noopener");
      },
      arco: (() => {
        const n = 34, on = Math.round(n * (chance ?? 0) / 100), out = [];
        for (let i = 0; i < n; i++) {
          const a = Math.PI - (i / (n - 1)) * Math.PI;
          const c = Math.cos(a), sn = Math.sin(a);
          out.push({ x1: (100 + 72 * c).toFixed(2), y1: (100 - 72 * sn).toFixed(2), x2: (100 + 94 * c).toFixed(2), y2: (100 - 94 * sn).toFixed(2), cor: i < on ? "var(--of-coral-marca)" : "var(--of-calha)" });
        }
        return out;
      })(),
      chance: chance ?? "—", chanceNota, chanceSub,
      chanceCor: chance == null ? "var(--of-tinta-3)" : chance >= 60 ? "var(--of-canal-whatsapp-tinta)" : chance >= 35 ? "var(--of-etapa-nutricao)" : "var(--of-coral-acao)",
      chanceDash: (C26 * (chance ?? 0) / 100).toFixed(1) + " " + C26.toFixed(1),
      urgencia, urgNota: "",
      urgBarras: [1, 2, 3].map((n) => ({ style: "width:5px;height:" + (5 + n * 3) + "px;border-radius:2px;align-self:flex-end;background:" + (n <= urgN ? "var(--of-coral-acao)" : "var(--of-fio)") })),
      // A Callface não manda sentimento nem nota de qualidade: vazio, não número inventado.
      sentCurto: "—",
      clPct: falaAt == null ? "—" : (100 - falaAt) + "%",
      notaGeral: "—", radarPts: "", radarTime: "", radarEixos: [],
      radarQuem: atNome,
      radarDestaque: "A Callface não envia nota de qualidade",
      abas: [{ label: "Resumo", style: ESEG(true), onClick: () => {} }],
      abaResumo: true, abaTrans: false, abaMom: false,
      tipo,
      relAberto: true, abrirRel: () => {},
      fecharRel: () => this.fechar(),
      objetivo: parsed?.objetivo ?? (lig.callStatus === "FINISHED" ? "A Callface não enviou análise de IA para esta ligação." : statusRotulo + " — sem conversa para analisar."),
      blocos,
      bantResumo: "A análise da Callface não traz critérios de qualificação",
      bant: [],
      levarQual: () => { if (!lig.leadId) return; this.fechar(); setTimeout(() => abrirPeca("qualificar", lig.leadId), 0); },
      resumo: (resumoParas.length ? resumoParas : ["Sem resumo da conversa."]).map((t) => ({ t })),
      chaves: (parsed?.palavrasChave ?? []).map((t) => {
        const n = contar(t);
        return { t, n: n ? "×" + n : "", style: "display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:9999px;font-size:" + (n >= 3 ? "13px;font-weight:600;background:var(--of-tinta-forte);color:var(--of-papel)" : n === 2 ? "12.5px;font-weight:600;background:var(--of-papel);color:var(--of-tinta-forte);box-shadow:inset 0 0 0 1px var(--of-linha-controle)" : "12px;font-weight:500;background:var(--of-papel-alterno);color:var(--of-tinta-2);box-shadow:inset 0 0 0 1px var(--of-fio)") };
      }),
      passosFeitos: passos.length ? nFeitos + " de " + passos.length + " feitos" : "Nenhum sugerido",
      passos: passos.map((p) => {
        const ok = feitos.has(p.k);
        return {
          t: p.t, meta: p.meta, acao: ok ? "Feito" : "Criar atividade",
          tStyle: "font-size:13px;font-weight:600;" + (ok ? "color:var(--of-tinta-3);text-decoration:line-through" : "color:var(--of-tinta-forte)"),
          checkTitulo: ok ? "Já registrado no lead" : "Marcar como feito",
          check: "flex:0 0 auto;width:20px;height:20px;border-radius:6px;border:0;padding:0;display:grid;place-items:center;cursor:pointer;" + (ok ? "background:var(--of-canal-whatsapp-tinta);color:var(--of-papel)" : "background:var(--of-papel);color:transparent;box-shadow:inset 0 0 0 1.5px var(--of-linha-convite)"),
          alternar: () => { if (ok) return this.diz("Este passo já foi registrado no lead."); this.registrarPasso(p, false); },
          btnStyle: "flex:0 0 auto;height:30px;padding:0 12px;border-radius:9999px;border:0;font-size:12px;font-weight:600;white-space:nowrap;" + (ok ? "background:var(--of-canal-whatsapp-fundo);color:var(--of-canal-whatsapp-tinta);cursor:default" : "background:var(--of-papel);color:var(--of-tinta);box-shadow:inset 0 0 0 1px var(--of-linha-controle);cursor:pointer"),
          onClick: () => { if (!ok) this.registrarPasso(p, true); },
        };
      }),
      busca: S.lbusca || "", setBusca: (e: React.ChangeEvent<HTMLInputElement>) => (this as any).setState({ lbusca: e.target.value }),
      buscaInfo: !falas.length ? "Sem transcrição" : q ? falasF.length + " trecho" + (falasF.length === 1 ? "" : "s") : falas.length + " falas",
      falas: falasF.map(({ x, i }) => {
        const at = x[1] === "at", on = i === falaAtual && ouvido;
        return {
          h: mmss(x[0]), t: x[2], quem: at ? atendente : (lead?.pessoa.nome || "Cliente"), ini: at ? ini(atendente) : ini(lead?.pessoa.nome || "Cliente"),
          av: "flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:10px;font-weight:700;" + (at ? "background:var(--of-tinta-forte);color:var(--of-papel)" : "background:var(--of-coral-fundo);color:var(--of-coral-acao-hover)"),
          style: "display:flex;align-items:flex-start;gap:10px;padding:9px 8px;border-radius:10px;cursor:pointer;transition:background .15s;" + (on ? "background:var(--of-coral-fundo)" : "background:transparent"),
          onClick: () => this.tocarDe(x[0]),
        };
      }),
      momentos: [],
      rodape: !parsed ? "A Callface não enviou análise para esta ligação"
        : passos.length ? "Análise gerada pelo Callface AI ao fim da ligação · " + nFeitos + "/" + passos.length + " próximos passos feitos"
        : "Análise gerada pelo Callface AI ao fim da ligação",
      criarAtv: () => { if (!lig.leadId) return this.diz("Ligação sem lead casado.", "erro"); this.fechar(); setTimeout(() => abrirPeca("novaAtividade", { lead: lig.leadId }), 0); },
      play: () => this.play(),
      playTitulo: LP.on ? "Pausar" : lig.audioUrl ? "Ouvir ligação" : "Sem gravação",
      playD: LP.on ? "M7 4h4v16H7zM13 4h4v16h-4z" : "M7 4v16l13-8z",
      seek: (e: React.MouseEvent<HTMLElement>) => { const rc = e.currentTarget.getBoundingClientRect(); this.tocarDe(Math.max(0, Math.min(dur, ((e.clientX - rc.left) / rc.width) * dur))); },
      onda,
      tAtual: mmss(LP.t), tTotal: mmss(dur),
      cabeca: "position:absolute;top:2px;bottom:2px;width:2px;border-radius:2px;background:var(--of-tinta-forte);pointer-events:none;transform:translateX(-1px);left:" + Math.min(100, LP.t / dur * 100).toFixed(2) + "%",
      vels: [1, 1.5, 2].map((v) => ({ label: String(v).replace(".", ",") + "×", onClick: () => this.velocidade(v), style: "height:24px;min-width:38px;padding:0 8px;border-radius:9999px;border:0;cursor:pointer;font-size:11.5px;font-weight:700;" + (LP.v === v ? "background:var(--of-papel);color:var(--of-tinta-forte);box-shadow:0 1px 2px rgba(18,23,29,.1)" : "background:transparent;color:var(--of-tinta-3)") })),
      falando: !lig.audioUrl ? "Ligação sem gravação" : ouvido && falas.length ? (quemEm(LP.t) === "at" ? atNome : clNome) + " falando" : "Clique na onda ou numa fala para ouvir",
      falandoDot: "flex:0 0 auto;width:7px;height:7px;border-radius:9999px;background:" + (ouvido && falas.length ? (quemEm(LP.t) === "at" ? "var(--of-tinta-forte)" : "var(--of-coral-marca)") : "var(--of-linha-convite)") + (LP.on ? ";animation:ofPulse 1.4s ease-out infinite" : ""),
      speakers: falaAt == null ? [] : ([[atNome, falaAt, "var(--of-tinta-forte)"], [clNome, 100 - falaAt, "var(--of-coral-marca)"]] as const).map(([nome, pct, cor]) => ({ nome, pct: pct + "%", dot: "flex:0 0 auto;width:8px;height:8px;border-radius:2px;background:" + cor, bar: "height:100%;border-radius:9999px;background:" + cor + ";width:" + pct + "%" })),
      momChips: [], pinos: [], marcas: [], legenda: [],
      enviarWa: abrirWa,
      religar: () => {
        let num = String(telefone || "").replace(/\D/g, "");
        if (num.length > 11 && num.startsWith("55")) num = num.slice(2);
        if (num.length < 10) return this.diz("Contato sem telefone cadastrado", "erro");
        window.open("https://app.callface.ai/calls?call_to=" + num, "_blank", "noopener");
        this.diz("Abrindo o Callface para ligar para " + primeiro);
        this.fechar();
      },
    };

    const W = S.wa;
    const w = !W ? { aberto: false } : {
      aberto: true,
      para: pessoa + " · " + formatarTel(lead?.pessoa.whatsapp || lead?.pessoa.telefone || null),
      numeros: [{
        label: "Seu WhatsApp conectado", onClick: () => {},
        style: "display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;border-radius:10px;border:0;cursor:pointer;text-align:left;background:var(--of-papel);box-shadow:inset 0 0 0 1.5px var(--of-tinta-forte)",
        radio: "flex:0 0 auto;width:14px;height:14px;border-radius:9999px;box-shadow:inset 0 0 0 4px var(--of-tinta-forte)",
      }],
      texto: W.texto, setTexto: (e: React.ChangeEvent<HTMLTextAreaElement>) => (this as any).setState({ wa: { ...W, texto: e.target.value } }),
      contagem: (W.texto || "").length + " caracteres",
      cancelar: () => (this as any).setState({ wa: null }),
      fora: (e: React.MouseEvent) => { if (e.target === e.currentTarget) (this as any).setState({ wa: null }); },
      enviar: () => {
        const txt = (W.texto || "").trim();
        if (!txt) return this.diz("Escreva a mensagem antes de enviar", "erro");
        this.enviarResumoWa(txt);
      },
    };
    return { aberto: true, r, w, fora: (e: React.MouseEvent) => { if (e.target === e.currentTarget) this.fechar(); } };
  }
}

/* ── A peça ────────────────────────────────────────────────────────────── */

const UUID = /^[0-9a-f-]{36}$/i;
const texto = (v: unknown) => (typeof v === "string" && v ? v : null);

export default function RelatorioLigacaoPecaProto({ id, contexto, fechar, gravou }: PecaProps) {
  const { abrir } = usePecas();
  /* A tela que sabe o lead manda `leadId` (null = não é lead); o id cru só vale sem essa chave. */
  const leadId = "leadId" in contexto ? texto(contexto.leadId) : id ?? texto(contexto.lead);
  const ligacaoId = texto(contexto.ligacaoId);
  const [carga, setCarga] = React.useState<{ lista: Ligacao[]; lig: Ligacao; lead: DetalheLead | null; notas: Nota[] } | null>(null);

  const lerNotas = React.useCallback(async (lead: string): Promise<Nota[]> => {
    const r = await fetch(`/api/notas?leadId=${encodeURIComponent(lead)}`);
    return r.ok ? r.json() : [];
  }, []);

  React.useEffect(() => {
    if (!leadId) { toast("Sem lead vinculado — o relatório mostra as ligações de um lead.", { id: "relatorio" }); fechar(); return; }
    if (!UUID.test(leadId)) { toast("Este contato ainda não é lead no CRM.", { id: "relatorio" }); fechar(); return; }
    let vivo = true;
    (async () => {
      const r = await fetch(`/api/ligacoes?leadId=${encodeURIComponent(leadId)}`);
      if (!r.ok) throw new Error();
      const lista: Ligacao[] = await r.json();
      const lig = (ligacaoId && lista.find((l) => l.id === ligacaoId)) || lista[0];
      if (!lig) { if (vivo) { toast("Nenhuma ligação da Callface registrada para este contato.", { id: "relatorio" }); fechar(); } return; }
      const [d, notas] = await Promise.all([acaoDetalhe(leadId), lerNotas(leadId)]);
      if (vivo) setCarga({ lista, lig, lead: d.ok ? d.dados?.lead ?? null : null, notas });
    })().catch(() => { if (vivo) { toast.error("Não consegui abrir o relatório da ligação."); fechar(); } });
    return () => { vivo = false; };
  }, [leadId, ligacaoId, fechar, lerNotas]);

  const recarregarNotas = React.useCallback(async () => {
    if (!leadId) return;
    const notas = await lerNotas(leadId);
    setCarga((c) => (c ? { ...c, notas } : c));
  }, [leadId, lerNotas]);

  if (!carga) return null;
  return (
    <RelatorioReal
      lig={carga.lig} lista={carga.lista} lead={carga.lead} notas={carga.notas}
      abrirPeca={abrir} recarregarNotas={recarregarNotas} fechar={fechar} gravou={gravou}
      ir={() => {}}
    />
  );
}
