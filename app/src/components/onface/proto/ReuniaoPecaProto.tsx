"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Peça de reunião (OnFace Reuniao.dc.html) — o adaptador.
 *
 * `ReuniaoDesenho` (markup) e `ReuniaoLiga` (lógica) são GERADOS. Aqui a
 * tabela `reunioes` vira a lista que a Liga lia do store, e o que ela gravava
 * no localStorage vira a rota que o Calendário e o CRM já usam:
 *   criar     → POST  /api/reunioes        (cria e sincroniza pela porta de calendário)
 *   editar    → PATCH /api/reunioes/:id    (reagenda/renomeia e sincroniza)
 *   situação  → PATCH /api/reunioes/:id    (status; cancelar cancela no Outlook)
 *
 * O que o protótipo inventava e aqui não existe: link do Teams fabricado,
 * aceites (RSVP) dos convidados, e-mail deduzido do nome, "sincronizado há
 * 2 min". Cada um é reescrito em `renderVals` pelo dado real — ou some.
 *
 * Local da reunião presencial: `reunioes` não tem coluna. Vai na primeira
 * linha das notas ("Local: …"), que também é o corpo do convite no Outlook.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  acaoBaseDaPeca, acaoBuscarContatosDaPeca, acaoReuniaoDaPeca,
  type LeadDaPeca, type MembroDaPeca, type OppDaPeca, type ReuniaoDaPeca,
} from "@/app/(produto)/calendario/reuniao-actions";
import { acaoNoShow } from "@/app/(produto)/pipeline/actions";
import { ReuniaoLiga } from "./ReuniaoLiga";
import type { PecaProps } from "./pecas-host";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const hm = (d: Date) => pad(d.getHours()) + ":" + pad(d.getMinutes());
const UUID = /^[0-9a-f-]{36}$/i;
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIPO_DO_FORMATO: Record<string, string> = { "Vídeo": "video", "Ligação": "call", Presencial: "presencial" };
const FORMATO_DO_TIPO: Record<string, string> = { video: "Vídeo", call: "Ligação", presencial: "Presencial" };
/** status do banco ↔ `resultado` da Liga (null = agendada). */
const RESULTADO_DO_STATUS: Record<string, string | null> = { agendada: null, realizada: "realizada", no_show: "noshow", cancelada: "cancelada" };
const STATUS_DO_RESULTADO: Record<string, string> = { agendada: "agendada", realizada: "realizada", noshow: "no_show", cancelada: "cancelada" };
const SITUACAO_DO_STATUS: Record<string, string> = { agendada: "A fazer", realizada: "Feita", no_show: "Declinada", cancelada: "Declinada" };

/** O mesmo vocabulário do NovoEventoModal: por que o Outlook não recebeu. */
const MOTIVO_OUTLOOK: Record<string, string> = {
  closer_sem_outlook: "Reunião salva no CRM, sem link nem convite: o responsável não tem Outlook conectado.",
  sem_email_destinatario: "Reunião criada no Outlook, mas sem convite: ninguém com e-mail foi incluído.",
  token_expirado: "Reunião salva no CRM, mas a conexão com o Outlook expirou — reconecte em Configurações de E-mail.",
  erro_graph: "Reunião salva no CRM, mas o Outlook recusou a criação. O convite não foi enviado.",
};

export function separarNotas(notas: string | null): { local: string; pauta: string } {
  const m = String(notas ?? "").match(/^Local: (.*)(?:\n\n?|$)/);
  return m ? { local: m[1].trim(), pauta: String(notas).slice(m[0].length) } : { local: "", pauta: notas ?? "" };
}
export function juntarNotas(local: string, pauta: string): string | null {
  const l = local.trim(), p = pauta.trim();
  return [l ? "Local: " + l : "", p].filter(Boolean).join("\n\n") || null;
}

/** Uma linha de `reunioes` no formato de item que a Liga lia (`src: "p"`). */
function paraItem(r: ReuniaoDaPeca) {
  const ini = new Date(r.data), dur = r.duracao || 30, fim = new Date(ini.getTime() + dur * 6e4);
  const { local, pauta } = separarNotas(r.notas);
  const status = r.status ?? "agendada";
  return {
    id: r.id, titulo: r.titulo, tipo: "Reunião", empresa: r.empresa ?? "", pessoa: r.pessoa ?? "", desc: pauta,
    situacao: SITUACAO_DO_STATUS[status] ?? "A fazer", resp: r.responsavel ?? "", assignees: r.responsavel ? [r.responsavel] : [],
    iniD: iso(ini), iniH: hm(ini), fimD: iso(fim), fimH: hm(fim), inicio: null, fim: null,
    reuniao: {
      data: iso(ini), hora: hm(ini), duracao: dur, formato: FORMATO_DO_TIPO[r.tipo ?? "call"] ?? "Ligação",
      closer: r.responsavel ?? "", participantes: Array.isArray(r.participantes) ? r.participantes : [],
      rsvp: {}, // sem aceite lido do Outlook: ninguém aparece como "aceitou"
      link: r.link, local, resultado: RESULTADO_DO_STATUS[status] ?? null,
    },
  };
}

function linkCurto(link: string) {
  try { const u = new URL(link); return u.host + (u.pathname.length > 1 ? "/…" + link.slice(-6) : ""); } catch { return link; }
}

function textoSync(r: ReuniaoDaPeca) {
  const quem = (r.responsavel ?? "responsável").split(" ")[0];
  if (r.syncStatus === "falhou") return "Não sincronizou com o Outlook" + (r.syncErro ? ": " + r.syncErro : "");
  if (r.temEvento || r.syncStatus === "ok") {
    const em = r.syncEm ? " · " + new Date(r.syncEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    return "Sincronizado com o Outlook de " + quem + em;
  }
  return "Só no CRM — não está no Outlook de " + quem;
}

interface Ponte {
  itens: any[];
  reunioes: Map<string, ReuniaoDaPeca>;
  opps: OppDaPeca[];
  leads: LeadDaPeca[];
  equipe: MembroDaPeca[];
  fechar: () => void;
  mudar: (id: string, corpo: Record<string, unknown>, tipo: "status" | "participantes") => void;
  salvar: (r: { id: string | null; corpo: Record<string, unknown> }) => Promise<string | null>;
  buscar: (q: string) => void;
}

class ReuniaoLigada extends ReuniaoLiga {
  _abriu = false;
  _calar = false;
  _salvando = false;

  get p(): Ponte { return (this as any).props.ponte; }

  constructor(props: any) {
    super(props);
    /* A Liga define `get eu` e depois o método `eu()`, que o sobrescreve e
       devolve a própria função: o responsável virava uma função. */
    Object.defineProperty(this, "eu", { value: () => (this as any).context?.nome ?? "Você" });
  }
  opps() { return this.p.opps.map((o) => ({ ...o, familia: undefined, etapa: "aberta", atvs: [] })); }
  leads() { return this.p.leads; }
  lista() { return this.p.itens; }
  /** E-mail só o cadastrado. O protótipo deduzia "nome@empresa.com.br". */
  emailDe(pessoa: string, empresa: string, leadId: string | null) {
    const L = this.p.leads.find((l) => (leadId && l.id === leadId) || (pessoa && l.pessoa === pessoa && (!empresa || l.empresa === empresa)));
    if (L?.email) return L.email;
    const O = this.p.opps.find((o) => (leadId && o.leadId === leadId) || (pessoa && o.pessoa === pessoa && o.empresa === empresa));
    return O?.email ?? null;
  }

  /* A Liga avisa ANTES de gravar ("Reunião marcada como…", "Convite enviado
     pelo Outlook"). O aviso real sai quando a rota responde. */
  diz(texto: string, tom?: string) {
    if (this._calar) { this._calar = false; return; }
    if (tom === "aviso") toast(texto); else toast.success(texto);
  }

  novo(pre: any) {
    (ReuniaoLiga.prototype as any).novo.call(this, pre);
    (this as any).setState((s: any) => ({ reu: s.reu && { ...s.reu, closer: s.reu.closer || (this as any).eu() } }));
  }

  /** Situação e participantes do modal de ver → PATCH. */
  gravar(ref: any, M: any, patchA: any, patchR: any) {
    this._calar = true;
    if (!ref?.id) return;
    if (patchA) {
      const status = STATUS_DO_RESULTADO[patchR?.resultado ?? "agendada"];
      if (M.RE.resultado === "cancelada" && status !== "cancelada") {
        toast.error("Reunião cancelada não reabre — o convite já foi cancelado. Agende uma nova.");
        return;
      }
      this.p.mudar(ref.id, { status }, "status");
    } else if (patchR?.participantes) {
      this.p.mudar(ref.id, { participantes: patchR.participantes }, "participantes");
    }
  }

  componentDidUpdate() {
    const s: any = (this as any).state;
    if (s.ver || s.reu) this._abriu = true;
    else if (this._abriu) { this._abriu = false; this.p.fechar(); }
  }

  async salvarReal(original: () => void) {
    const S: any = (this as any).state, RU = S.reu;
    if (!RU || this._salvando) return;
    const conv = RU.novoConv != null && RU.novoConv.trim() !== "" && !MAIL.test(RU.novoConv.trim());
    if (!RU.data || !RU.hora || !(RU.titulo || "").trim() || conv) return original();

    const edit = RU.ref?.id ?? null;
    const O = RU.oppId ? this.p.opps.find((o) => o.id === RU.oppId) ?? null : null;
    const empresa = O ? O.empresa : (RU.empresa || "").trim(), pessoa = O ? O.pessoa : (RU.pessoa || "").trim();
    const email = pessoa ? this.emailDe(pessoa, empresa, O?.leadId ?? null) : null;
    const participantes = [email, ...(RU.conv || [])].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
    const corpo: Record<string, unknown> = {
      titulo: RU.titulo.trim(),
      data: new Date(`${RU.data}T${RU.hora}:00`).toISOString(),
      duracao: RU.dur || 30,
      tipo: TIPO_DO_FORMATO[RU.tipo] ?? "video",
      notas: juntarNotas(RU.tipo === "Presencial" ? RU.local || "" : "", RU.pauta || ""),
      participantes,
    };
    if (edit) {
      const antes = this.p.reunioes.get(edit);
      if (antes && RU.closer && RU.closer !== antes.responsavel) toast("O responsável não muda por aqui — o resto foi salvo.");
    } else {
      const lead = O?.leadId ? null : this.p.leads.find((l) => l.pessoa === pessoa && (!empresa || l.empresa === empresa));
      Object.assign(corpo, {
        negocioId: O?.id ?? null,
        leadId: O?.leadId ?? lead?.id ?? null,
        attendeeEmail: participantes[0] ?? null,
        responsavelId: this.p.equipe.find((m) => m.nome === RU.closer)?.id ?? null,
      });
    }
    this._salvando = true;
    try {
      const id = await this.p.salvar({ id: edit, corpo });
      if (id) (this as any).setState({ reu: null, ver: { src: "p", id } });
    } finally { this._salvando = false; }
  }

  renderVals() {
    const v: any = super.renderVals();
    const S: any = (this as any).state;

    const r = S.ver?.id ? this.p.reunioes.get(S.ver.id) : null;
    if (v.rv.aberto && r) {
      const link = r.link;
      v.rv.temLink = !!link;
      v.rv.linkCurto = link ? linkCurto(link) : "";
      v.rv.copiar = () => { navigator.clipboard?.writeText(link ?? "").then(() => toast.success("Link da reunião copiado"), () => toast.error("Não consegui copiar o link.")); };
      v.rv.entrar = () => { if (link) window.open(link, "_blank", "noopener"); };
      v.rv.sync = textoSync(r);
      for (const pt of v.rv.part) pt.st = "Convidado";
      const n = v.rv.part.length;
      v.rv.rsResumo = n ? n + (n > 1 ? " convidados" : " convidado") : "Ninguém convidado";
    }

    if (v.reu.aberto) {
      const RU = S.reu, original = v.reu.salvar;
      v.reu.salvar = () => { void this.salvarReal(original); };
      if (this._salvando) v.reu.salvarStyle += ";opacity:.6;cursor:progress";
      const titulo = new Map(this.p.opps.map((o) => [o.id, o.titulo]));
      v.reu.oppsOpc = v.reu.oppsOpc.map((x: any) => (x.v ? { ...x, l: titulo.get(x.v) ?? x.l } : x));
      if (RU.oppId) v.reu.oppL = titulo.get(RU.oppId) ?? v.reu.oppL;
      const membro = this.p.equipe.find((m) => m.nome === RU.closer);
      const antes = RU.ref?.id ? this.p.reunioes.get(RU.ref.id) : null;
      v.reu.linkTxt = antes
        ? (antes.temEvento ? "Se mudar data, horário, título ou duração, o evento no Outlook é atualizado." : "Esta reunião não está no Outlook: as mudanças ficam no CRM.")
        : membro?.outlook
          ? "O link do Teams é gerado pelo Outlook quando você agendar."
          : (RU.closer || "O responsável") + " não tem Outlook conectado: a reunião fica só no CRM, sem link nem convite.";
      const setE = v.reu.setEmpresa, setP = v.reu.setPessoa;
      v.reu.setEmpresa = (e: any) => { setE(e); this.p.buscar(e.target.value); };
      v.reu.setPessoa = (e: any) => { setP(e); this.p.buscar(e.target.value); };
    }
    return v;
  }
}

const Ligada = ReuniaoLigada as unknown as React.ComponentType<any>;

/* ── A peça ────────────────────────────────────────────────────────────── */

type Carga = { equipe: MembroDaPeca[]; opps: OppDaPeca[]; leads: LeadDaPeca[] };

export default function ReuniaoPecaProto({ peca, id, contexto, fechar, gravou }: PecaProps) {
  const router = useRouter();
  const ctx = contexto as Record<string, any>;
  const reuniaoId = id && UUID.test(id) ? id : null;
  const negocioId = (typeof ctx.oppId === "string" && UUID.test(ctx.oppId) ? ctx.oppId : null)
    ?? (typeof ctx.oportunidadeId === "string" ? ctx.oportunidadeId : null);

  const [base, setBase] = React.useState<Carga | null>(null);
  const [reunioes, setReunioes] = React.useState<Map<string, ReuniaoDaPeca>>(new Map());
  const [buscados, setBuscados] = React.useState<LeadDaPeca[]>([]);
  const liga = React.useRef<any>(null);

  const carregarReuniao = React.useCallback(async (rid: string) => {
    const r = await acaoReuniaoDaPeca(rid);
    if (r) setReunioes((m) => new Map(m).set(r.id, r));
    return r;
  }, []);

  React.useEffect(() => {
    // Referência do protótipo (atividade nº i da oportunidade): o detalhe é o negócio.
    if (peca !== "novaReuniao" && !reuniaoId) {
      if (typeof ctx.oppId === "string" && UUID.test(ctx.oppId)) router.push(`/pipeline/${ctx.oppId}`);
      else toast("Esta reunião não está no CRM.", { id: "peca-reuniao" });
      fechar();
      return;
    }
    let vivo = true;
    Promise.all([
      acaoBaseDaPeca({ negocioId, leadId: ctx.leadId ?? null, empresaId: ctx.empresaId ?? null }),
      reuniaoId ? carregarReuniao(reuniaoId) : Promise.resolve(undefined),
    ]).then(([b, r]) => {
      if (!vivo) return;
      if (!b || r === null) { toast.error(r === null ? "Não encontrei esta reunião." : "Sessão expirada."); fechar(); return; }
      setBase(b);
    }, () => { if (vivo) { toast.error("Não consegui abrir a reunião."); fechar(); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre o modal certo assim que a carga chegou e a Liga montou.
  React.useEffect(() => {
    const L = liga.current;
    if (!base || !L) return;
    if (peca === "novaReuniao") {
      const lead = base.leads.find((l) => l.id === ctx.leadId);
      L.novo({
        data: ctx.data, hora: ctx.hora, titulo: ctx.titulo,
        empresa: ctx.empresa ?? lead?.empresa ?? "", pessoa: ctx.pessoa || lead?.pessoa || "",
        oppId: negocioId && base.opps.some((o) => o.id === negocioId) ? negocioId : "",
      });
    } else if (reuniaoId) {
      if (peca === "editarReuniao") L.editar({ src: "p", id: reuniaoId });
      else L.setState({ ver: { src: "p", id: reuniaoId }, reu: null, rvAdd: null, rvAddErro: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const busca = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscar = React.useCallback((q: string) => {
    if (busca.current) clearTimeout(busca.current);
    if (q.trim().length < 2) return;
    busca.current = setTimeout(() => {
      acaoBuscarContatosDaPeca(q).then((ls) => setBuscados((ant) => {
        const m = new Map(ant.map((l) => [l.id, l]));
        ls.forEach((l) => m.set(l.id, l));
        return [...m.values()];
      }), () => {});
    }, 250);
  }, []);
  React.useEffect(() => () => { if (busca.current) clearTimeout(busca.current); }, []);

  const mudar = React.useCallback(async (rid: string, corpo: Record<string, unknown>, tipo: "status" | "participantes") => {
    try {
      const res = await fetch(`/api/reunioes/${rid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? String(res.status));
      /* No-show é EVENTO (Bloco 01 §15): o PATCH só troca a coluna. O evento
         MeetingNoShow, a timeline, o contador do card e o retorno do Lead a
         Qualificado saem de registrarNoShow, na mesma oportunidade. */
      const nid = reunioes.get(rid)?.negocioId;
      if (corpo.status === "no_show" && nid) {
        const r2 = await acaoNoShow(nid, rid);
        if (!r2.ok) toast.error(`No-show gravado na reunião, mas o evento falhou: ${r2.erro}`);
      }
      if (j.avisoAgenda) toast(j.avisoAgenda);
      else if (tipo === "participantes") toast.success("Participantes salvos. O convite no Outlook foi atualizado.");
      else toast.success(corpo.status === "cancelada" ? "Reunião cancelada." : "Situação da reunião atualizada.");
    } catch (e) {
      toast.error(`Não consegui atualizar a reunião. Nada mudou. (${(e as Error).message})`);
    }
    await carregarReuniao(rid);
    gravou();
  }, [carregarReuniao, gravou, reunioes]);

  const salvar = React.useCallback(async ({ id: rid, corpo }: { id: string | null; corpo: Record<string, unknown> }) => {
    try {
      const res = await fetch(rid ? `/api/reunioes/${rid}` : "/api/reunioes", {
        method: rid ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? String(res.status));
      if (rid) {
        if (j.avisoAgenda) toast(j.avisoAgenda);
        else toast.success("Reunião atualizada.");
      } else {
        const o = j.outlook as { criado: boolean; motivo: string | null } | undefined;
        if (o?.criado && !o.motivo) toast.success("Reunião agendada. Convite enviado pelo Outlook.");
        else toast(j.avisoAgenda ?? (o?.motivo ? MOTIVO_OUTLOOK[o.motivo] ?? MOTIVO_OUTLOOK.erro_graph : "Reunião agendada no CRM."), { duration: 9000 });
      }
      const id2 = (rid ?? j.id) as string;
      await carregarReuniao(id2);
      gravou();
      return id2;
    } catch (e) {
      toast.error(`Não consegui salvar a reunião. (${(e as Error).message})`);
      return null;
    }
  }, [carregarReuniao, gravou]);

  const ponte = React.useMemo<Ponte | null>(() => {
    if (!base) return null;
    const ids = new Set(base.leads.map((l) => l.id));
    return {
      itens: [...reunioes.values()].map(paraItem),
      reunioes, opps: base.opps, equipe: base.equipe,
      leads: base.leads.concat(buscados.filter((l) => !ids.has(l.id)),
        // O contato da reunião aberta também é lead: é dele o e-mail do convite.
        [...reunioes.values()].filter((r) => r.leadId && r.pessoa && !ids.has(r.leadId))
          .map((r) => ({ id: r.leadId!, pessoa: r.pessoa!, empresa: r.empresa ?? "", email: r.email, cargo: "" }))),
      fechar, mudar, salvar, buscar,
    };
  }, [base, reunioes, buscados, fechar, mudar, salvar, buscar]);

  if (!ponte) return null;
  return <Ligada ref={liga} ponte={ponte} catalogo={{ EQUIPE: ponte.equipe.map((m) => m.nome) }} ir={(href: string) => router.push(href)} />;
}
