"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Cliente 360 — o adaptador.
 *
 * `ClienteLiga` é o arquivo MAIS gerador do handoff: quase tudo nele deriva de
 * um hash do nome da empresa (catálogo de produtos, faturas, contratos, CNPJ,
 * cidade, oito pessoas fixas com e-mail e telefone montados do nome). Não dá
 * para "passar o dado na chave certa" porque a maioria dos blocos não lê
 * chave nenhuma — calcula.
 *
 * Por isso a estratégia aqui é SUBSTITUIR NA SAÍDA: `renderVals` chama o
 * protótipo (que continua dono dos estilos, abas, modais e estados) e troca,
 * bloco a bloco, cada chave de topo que carrega dado pelo dado real. O que
 * não tem fonte no banco vira "—" ou some — nunca o número do hash.
 *
 * Nada aqui edita o gerado: tudo mora nesta subclasse.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useOrdemDaEquipe } from "./equipe-do-proto";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import {
  acaoNovaOportunidadeDoCliente, acaoNotaDoCliente, acaoAtribuirCsm, acaoTornarPrincipal,
  acaoAdicionarPessoaAoCliente, acaoRemoverDocumentoDoCliente, type TipoDeVenda, type Resultado,
} from "@/app/(produto)/clientes/[id]/actions";
import { rotuloDeEvento } from "@/lib/vendas/rotulos-evento";
import { textoDaClasse } from "@/lib/vendas/classificacao-rotulos";
import { toast } from "sonner";

import type { ClienteDoDesenho } from "@/lib/clientes/cliente-para-o-desenho";
import { ROTULO_STATUS_ASSINATURA, situacaoFinanceira, type MotivoSemProxima } from "@/lib/clientes/financeiro-regras";
import { produtoParaExibir } from "@/lib/catalogo/rotulos";
import { geometriaFaturamento } from "@/lib/clientes/evolucao-geometria";
import { ClienteLiga } from "./ClienteLiga";
import { levarParametros } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";
import { AssinaturasDoCliente } from "../AssinaturasDoCliente";
import { UsoDoClientePainel, type PropsUsoDoCliente } from "@/components/onface/callface-ai/UsoDoClientePainel";

/** Leitura da Callface AI que a página entrega pronta (Server Component). */
export type UsoCallfaceAiDoCliente = Pick<PropsUsoDoCliente, "uso" | "erro" | "acoes">;

/* ── Vocabulário visual do protótipo ───────────────────────────────────────
 * Cópia CONSCIENTE das constantes de estilo do ClienteLiga. Elas vivem dentro
 * de `renderVals` (não são exportadas), e o gerado não se edita. Se o handoff
 * mudar a paleta, isto precisa acompanhar. */
const TT: Record<string, [string, string]> = { ok: ["var(--of-canal-whatsapp-fundo)", "var(--of-canal-whatsapp-tinta)"], coral: ["var(--of-coral-fundo)", "var(--of-coral-acao-hover)"], erro: ["var(--of-coral-fundo-forte)", "var(--of-coral-acao-hover)"], neutro: ["var(--of-calha)", "var(--of-tinta-2)"] };
const pill = (tom: string) => "flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;background:" + TT[tom][0] + ";color:" + TT[tom][1];
const dotC: Record<string, string> = { ok: "var(--of-canal-whatsapp-tinta)", coral: "var(--of-coral-marca)", erro: "var(--of-coral-acao)", neutro: "var(--of-linha-forte)" };
const dotS = (tom: string) => "width:6px;height:6px;border-radius:9999px;background:" + dotC[tom];
const I = {
  check: "M20 6 9 17l-5-5", alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  note: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7", ext: "M7 17 17 7M9 7h8v8",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", building: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4", trend: "M22 7 13.5 15.5l-5-5L2 17M16 7h6v6",
  up: "M7 17 17 7M9 7h8v8", dn: "M7 7l10 10M17 9v8H9", card: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4",
  pipe: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z", heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z",
  pulse: "M22 12h-4l-3 9L9 3l-3 9H2", swap: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5", layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", plus: "M12 5v14M5 12h14",
  wa: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z", mail: "M4 4h16v16H4zM4 7l8 6 8-6",
  tel: "M13.8 16.6a1 1 0 0 0 1.2-.3l.4-.5A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.5.4a1 1 0 0 0-.3 1.2 14 14 0 0 0 6.4 6.4z",
  video: "m16 10 5-3v10l-5-3zM4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z", dl: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
};
const FAM: Record<string, { l: string; cor: string; d: string; tile: [string, string] }> = {
  CALLFACE_AI: { l: "Callface AI", cor: "var(--of-coral-marca)", d: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", tile: ["var(--of-coral-fundo)", "var(--of-coral-acao-hover)"] },
  PABX: { l: "PABX", cor: "var(--of-coral-no-escuro-2)", d: I.tel, tile: ["var(--of-tinta-forte)", "var(--of-papel)"] },
  WHITE_LABEL: { l: "White Label", cor: "var(--of-coral-no-escuro-3)", d: I.layers, tile: ["var(--of-calha)", "var(--of-tinta)"] },
  // Família não classificada existe no banco; vai à tela com o nome honesto
  // em vez de ser escondida ou forçada numa das três.
  UNKNOWN: { l: "Não classificado", cor: "var(--of-tinta-4)", d: I.layers, tile: ["var(--of-calha)", "var(--of-tinta-2)"] },
};
const PK = ["CALLFACE_AI", "PABX", "WHITE_LABEL"];
/** Cor do selo de status: pagamento vencido é erro, nunca o verde de "Ativo". */
const tomDoStatus = (st: string) => st === "Ativo" ? "ok" : st === "Em implantação" ? "coral" : st === "Vencida" || st === "Inadimplente" ? "erro" : "neutro";
const fam = (k: string | null | undefined) => FAM[k ?? "UNKNOWN"] ?? FAM.UNKNOWN;

const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");
/** Data "só dia" do Postgres ("2026-06-09") sem o fuso jogar para o dia anterior. */
const dt = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  // timestamptz::text vem como "2026-09-16 12:51:39-03": o JS não aceita o
  // fuso sem minutos, e sem esta normalização toda data de pagamento virava "—".
  const iso = s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dmy = (d: Date | null) => d ? pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() : "—";
const dm = (d: Date) => pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
const dExt = (d: Date) => d.getDate() + " " + MES[d.getMonth()].toLowerCase() + " " + d.getFullYear();
const brl = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");
const brl2 = (n: number) => "R$ " + (+n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brlK = (n: number) => n >= 10000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : brl(n);
const ini = (n: string | null | undefined) => (n || "").split(" ").filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "—";
const tamanho = (b: number | null) => b == null ? "" : b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
const STRIPE_CUSTOMER = (id: string) => "https://dashboard.stripe.com/customers/" + id;

const btnA = "display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;background:var(--of-papel);color:var(--of-tinta);box-shadow:inset 0 0 0 1px var(--of-linha-controle)";
const tileV = (cor: string) => "display:block;margin-top:5px;font-family:'Plus Jakarta Sans',sans-serif;font-size:19px;font-weight:700;letter-spacing:-.02em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;color:" + cor;
const kpiS = (cor: string) => "display:block;margin-top:5px;font-family:'Plus Jakarta Sans',sans-serif;font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;color:" + cor;
const seg = (on: boolean) => "height:26px;padding:0 10px;border-radius:7px;border:0;cursor:pointer;font-size:12px;white-space:nowrap;" + (on ? "background:var(--of-papel);color:var(--of-tinta-forte);font-weight:600;box-shadow:0 1px 2px rgba(18,23,29,.12)" : "background:transparent;color:var(--of-tinta-2);font-weight:500");
const radio = (on: boolean) => "flex:0 0 auto;width:16px;height:16px;border-radius:9999px;box-shadow:inset 0 0 0 " + (on ? "5px var(--of-coral-marca)" : "1.5px var(--of-tinta-tenue)");
const MARCA: Record<string, string> = { coral: "background:var(--of-coral-fundo);color:var(--of-coral-acao-hover)", ok: "background:var(--of-canal-whatsapp-fundo);color:var(--of-canal-whatsapp-tinta)", erro: "background:var(--of-coral-fundo-forte);color:var(--of-coral-acao-hover)", neutro: "background:var(--of-fio-tenue);color:var(--of-tinta-2)" };

/* ── Vocabulário do domínio ─────────────────────────────────────────────── */

/** Rótulo e categoria de cada evento canônico no histórico do desenho. */
function categoriaDoEvento(tipo: string): { cat: string; d: string; tom: string } {
  if (/^(Payment|Contract)/.test(tipo)) return { cat: "financeiro", d: I.check, tom: "ok" };
  if (/^(Opportunity|Proposal|Trial)/.test(tipo)) return { cat: "comercial", d: tipo === "OpportunityWon" ? I.check : I.trend, tom: "coral" };
  if (/^Meeting/.test(tipo)) return { cat: "atividades", d: I.video, tom: "neutro" };
  if (/nota|note/i.test(tipo)) return { cat: "nota", d: I.note, tom: "neutro" };
  return { cat: "atividades", d: I.pulse, tom: "neutro" };
}

/** `pessoa_empresa_vinculos.papel` guarda a chave ("contato_principal"). */
const rotuloPapel = (p: string | null) => p ? (p.charAt(0).toUpperCase() + p.slice(1)).replace(/_/g, " ") : "Contato";

const PROPOSTA_FINAL = new Set(["aceita", "recusada", "expirada", "substituida", "Proposta Ganha"]);

/* ── A subclasse ────────────────────────────────────────────────────────── */

class ClienteLigada extends ClienteLiga {
  _semEco = false;

  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
    /* O protótipo grava e LOGO depois diz "salvo" (`salvarX` + `diz`). Aqui
       nenhuma gravação do Cliente tem command, e o adaptador já responde com
       toast honesto. Sem isto a tela mostraria os dois — "Nota salva" ao lado
       de "isto não grava" — e o primeiro é mentira. O eco do "ok" que segue
       uma gravação no mesmo tick é engolido. */
    const self = this as any;
    self.E.gravar = (patch: any) => {
      self._semEco = true;
      setTimeout(() => { self._semEco = false; }, 0);
      return self.props.gravar?.(patch);
    };
  }

  /* ── Aba "Uso da Callface AI" ────────────────────────────────────────
     O desenho gerado não tem essa aba e não se edita. Ela entra pelo
     adaptador: a aba vai na lista `abas` (o markup já itera), o `vis` do
     Liga zera todos os blocos quando a aba é "uso", e o painel é montado por
     portal num invólucro `display: contents` no fim da coluna da página —
     sem caixa própria, então não ganha gap nem desloca nada nas outras abas. */
  _alvoUso: HTMLDivElement | null = null;

  componentDidMount() {
    super.componentDidMount?.();
    const P: any = (this as any).props;
    /* O `ref` da raiz (div pai) só é preenchido DEPOIS do didMount do filho:
       lido aqui, `raiz.current` é null, o alvo nunca nasce e a aba fica em
       branco. Adia um microtask, quando o ref já existe. */
    queueMicrotask(() => {
      if (this._alvoUso) return;
      const coluna = P.raiz?.current?.querySelector('[data-r="pagina"] > div');
      if (coluna) {
        const el = document.createElement("div");
        el.style.display = "contents";
        coluna.appendChild(el);
        this._alvoUso = el;
      }
      const q = new URLSearchParams(window.location.search);
      const aba = q.get("aba");
      /* O checkout de expansão manda para cá com ?alterar-assinatura: cai no Financeiro. */
      if (aba === "uso" && P.usoCallfaceAi) (this as any).setState({ aba: "uso" });
      else if (q.get("alterar-assinatura")) (this as any).setState({ aba: "financeiro" });
      else this.forceUpdate();
    });
  }

  componentWillUnmount() {
    super.componentWillUnmount?.();
    this._alvoUso?.remove();
    this._alvoUso = null;
  }

  render() {
    const el = super.render();
    const P: any = (this as any).props;
    const aba = (this as any).state.aba;
    if (aba === "financeiro") {
      /* Assinaturas moram na aba Financeiro, como conteúdo da página (sem drawer, sem botão flutuante). */
      const ass = <div className="px-6 pb-6"><AssinaturasDoCliente empresaId={P.real.empresa.id} /></div>;
      return <>{el}{this._alvoUso ? createPortal(ass, this._alvoUso) : ass}</>;
    }
    if (aba !== "uso" || !P.usoCallfaceAi) return el;
    const pessoasDoCrm: Record<string, string> = {};
    for (const p of P.real.empresa.pessoas) {
      const lead = p.fonte === "lead" ? p.id : P.real.leadDaPessoa?.[p.id];
      if (p.email && lead) pessoasDoCrm[String(p.email).toLowerCase()] = `/pessoas/${lead}`;
    }
    const painel = <UsoDoClientePainel {...P.usoCallfaceAi} pessoasDoCrm={pessoasDoCrm} aoMudar={P.refresh} />;
    /* Sem alvo a aba nunca fica em branco: o painel entra direto, sem portal. */
    return <>{el}{this._alvoUso ? createPortal(painel, this._alvoUso) : <div className="p-3.5">{painel}</div>}</>;
  }

  /** O Liga chama `this.diz` (via E.avisar) mas não define o método. */
  diz(texto: string, tom?: string) {
    if (this._semEco && (tom ?? "ok") === "ok") return;
    if (tom === "erro") toast.error(texto); else toast(texto);
  }

  renderVals() {
    const v: any = super.renderVals();
    const S: any = (this as any).state;
    const P: any = (this as any).props;
    const R: ClienteDoDesenho = P.real;
    const nav = (href: string) => P.ir?.(href);
    const avisa = (t: string) => { toast(t); };
    const setS = (p: any) => (this as any).setState(p);
    const irAba = (k: string) => () => setS({ aba: k, menu: null, resp: null });
    const e = R.empresa;
    const hoje = new Date(), h0 = new Date(); h0.setHours(0, 0, 0, 0);

    /* ── Faturas ──────────────────────────────────────────────────────────
     * `void` e `rascunho` saem: não são cobrança. Somá-las a "Em aberto"
     * seria cobrar o cliente de algo cancelado. "Vencida" segue a mesma regra
     * do billing (`dias_atraso` > 0), não uma conta própria desta tela. */
    const fats = R.faturas
      .filter((f) => f.status === "paga" || f.status === "aberta")
      .map((f) => {
        const comp = dt(f.competencia), cobr = dt(f.dataCobranca), pagoEm = dt(f.pagaEm);
        const st = f.status === "paga" ? "Pago" : f.estado === "vencida" ? "Vencida" : "Em aberto";
        // Mês e dia de cobrança: o dia em que o Stripe cobra (vencimento, ou emissão no cartão), nunca o início do ciclo.
        return { id: f.id, comp, venc: cobr, pagoEm, st, v: Number(f.valor), ext: f.externalId, hosted: f.hostedInvoiceUrl, atraso: f.diasAtraso,
          falhou: st !== "Pago" && f.pagamentoFalhou, tentativas: f.tentativas,
          rot: f.rotuloMes, ordem: (cobr ?? pagoEm ?? comp)?.getTime() ?? 0 };
      })
      .sort((a, b) => b.ordem - a.ordem);
    const abertas = fats.filter((f) => f.st !== "Pago");
    const vencidas = fats.filter((f) => f.st === "Vencida");
    const emAberto = abertas.reduce((a, f) => a + f.v, 0), vencido = vencidas.reduce((a, f) => a + f.v, 0);
    const umAno = Date.now() - 365 * 864e5;
    const pagas12 = fats.filter((f) => f.st === "Pago" && f.pagoEm && f.pagoEm.getTime() >= umAno);
    const pago12 = pagas12.reduce((a, f) => a + f.v, 0);
    const pagoTotal = fats.filter((f) => f.st === "Pago").reduce((a, f) => a + f.v, 0);
    const maisAtraso = Math.max(0, ...vencidas.map((f) => f.atraso ?? 0));
    const proxF = abertas.filter((f) => f.venc).sort((a, b) => a.venc!.getTime() - b.venc!.getTime())[0] ?? null;
    const FST: Record<string, string> = { Pago: "ok", "Em aberto": "neutro", Vencida: "erro" };
    const copiar = (t: string, rot: string) => { navigator.clipboard.writeText(t).then(() => toast(rot + " copiado"), () => toast.error("Não deu para copiar")); };
    const abrirUrl = (u: string) => window.open(u, "_blank", "noopener");

    /* Só as ações que funcionam de verdade. "Comprovante", "Reenviar" e
       "Baixa manual" não têm command nem tabela — o markup não aceita botão
       desabilitado, então saem em vez de fingir. O link é o hosted_invoice_url
       REAL do Stripe; sem ele, nenhuma ação. */
    const fatRow = (f: typeof fats[number]) => ({
      comp: f.rot, ids: f.ext ?? "—", venc: dmy(f.venc),
      vencTxt: f.st === "Pago" ? "Pago em " + dmy(f.pagoEm) : f.venc ? (f.st === "Vencida" ? "Venceu " : "Vence ") + dmy(f.venc) : "Sem vencimento",
      valor: brl2(f.v), pago: f.st === "Pago" ? dmy(f.pagoEm) : "—",
      via: f.falhou ? "Pagamento falhou" + (f.tentativas > 1 ? " · " + f.tentativas + " tentativas" : "") + (f.st === "Vencida" && f.atraso ? " · " + f.atraso + " d em atraso" : "")
        : f.st === "Vencida" && f.atraso ? f.atraso + " dias em atraso" : f.st === "Pago" ? "Stripe" : "",
      st: f.falhou ? "Falhou" : f.st, stStyle: pill(f.falhou ? "erro" : FST[f.st]), dot: dotS(f.falhou ? "erro" : FST[f.st]),
      acoes: !f.hosted ? [] : f.st === "Pago"
        ? [{ l: "Stripe", d: I.ext, dica: "Ver fatura no Stripe", onClick: () => abrirUrl(f.hosted!), style: btnA }]
        : [{ l: "Link", d: I.link, dica: "Copiar link de pagamento", onClick: () => copiar(f.hosted!, "Link de cobrança"), style: btnA }],
    });
    const fatFil = fats.filter((f) => S.fatF === "todas" || (S.fatF === "pagas" ? f.st === "Pago" : S.fatF === "aberto" ? f.st === "Em aberto" : f.st === "Vencida"));
    const exportar = () => {
      const q = (x: unknown) => '"' + String(x ?? "").replace(/"/g, '""') + '"';
      const csv = "﻿" + [["Competência", "Stripe", "Vencimento", "Valor", "Status", "Pago em"]]
        .concat(fats.map((f) => [f.rot, f.ext ?? "", dmy(f.venc), f.v.toFixed(2).replace(".", ","), f.st, f.st === "Pago" ? dmy(f.pagoEm) : ""]))
        .map((l) => l.map(q).join(";")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = "faturas-" + e.nome.replace(/\W+/g, "-").toLowerCase() + ".csv";
      document.body.appendChild(a); a.click(); a.remove();
      toast(fats.length + " faturas exportadas");
    };

    /* ── Carteira (Produtos) ──────────────────────────────────────────────
     * A família vem de `servicos_canonicos` (portfolio_included), a mesma
     * fonte do MRR da Home/CS — assim o total do bloco bate com o hero.
     * Item = linha de `contrato_itens` do contrato do serviço quando existe
     * (nome, quantidade e preço reais); senão, o próprio serviço como uma
     * linha. Sem código SKU (o catálogo só tem 15/233) e sem "uso": nenhuma
     * tabela guarda licença em uso, então a barra fica no estado "Ativo". */
    const contratoPorId = new Map(R.contratos.map((c) => [c.id, c]));
    const grupos = new Map<string, typeof R.servicos>();
    for (const s of R.servicos) grupos.set(s.familia ?? "UNKNOWN", [...(grupos.get(s.familia ?? "UNKNOWN") ?? []), s]);
    const fams = [...grupos.entries()].map(([k, svs]) => {
      const F = fam(k);
      const mrr = svs.reduce((a, s) => a + s.valor, 0);
      const inicios = svs.map((s) => dt(contratoPorId.get(s.contratoId ?? "")?.inicio)).filter(Boolean) as Date[];
      const start = inicios.length ? new Date(Math.min(...inicios.map((d) => d.getTime()))) : null;
      const itens = svs.flatMap((s) => {
        const ct = s.contratoId ? contratoPorId.get(s.contratoId) : undefined;
        const desde = dt(ct?.inicio);
        if (ct && ct.itens.length) return ct.itens.map((i) => ({ nome: i.nome, qtd: i.quantidade, preco: i.valorUnitario, sub: i.subtotal, tipo: i.natureza ?? "Item", desde }));
        // Regra única do nome (lib/catalogo/rotulos): nome do Stripe/catálogo, senão o do legado marcado como
        // histórico; nunca o rótulo da família. Sem nome nenhum, diz que não há.
        const p = produtoParaExibir(s);
        return [{ nome: p.nome ?? `${F.l} (produto não identificado)`, qtd: 1, preco: s.valor, sub: s.valor, tipo: s.billingStatus === "CANCELED" ? "Cobrança cancelada" : s.assinaturaStatus === "vencida" || s.assinaturaStatus === "inadimplente" ? "Assinatura " + ROTULO_STATUS_ASSINATURA[s.assinaturaStatus].toLowerCase() : s.valor === 0 && s.billingStatus === "NOT_APPLICABLE" ? "Aguardando faturamento" : p.historico ? "Serviço · histórico do legado" : "Serviço", desde }];
      });
      const cancelado = svs.every((s) => s.billingStatus === "CANCELED");
      // Pagamento vencido ganha de "Ativo": a assinatura existe, mas o Stripe diz que a cobrança não passou.
      const pendente = svs.find((s) => s.assinaturaStatus === "vencida" || s.assinaturaStatus === "inadimplente");
      const st = cancelado ? "Encerrado" : pendente ? ROTULO_STATUS_ASSINATURA[pendente.assinaturaStatus!] : R.fulfillmentAberto ? "Em implantação" : "Ativo";
      return { k, F, mrr, start, itens, st, contratos: svs.map((s) => s.contratoId).filter(Boolean) as string[] };
    }).sort((a, b) => b.mrr - a.mrr);
    const mrr = fams.reduce((a, f) => a + f.mrr, 0);
    const nItens = fams.reduce((a, f) => a + f.itens.length, 0);
    const naoTem = PK.filter((k) => !grupos.has(k));
    const abrirOpp = (tipo: string | null, familia?: string) => {
      setS({ menu: null, resp: null, modal: { k: "opp", passo: tipo ? 1 : 0, tipo, familia: familia || (tipo === "crosssell" ? (naoTem[0] || fams[0]?.k) : fams[0]?.k), contato: principal?.nome ?? "", closer: R.closer ?? "", obs: "", valor: "", erro: "" } });
    };

    /* ── Contratos ────────────────────────────────────────────────────────
     * Vigência só quando `contratos.vencimento` existe (3% dos contratos).
     * O protótipo calculava renovação = início + 12 meses; aqui, sem data,
     * a barra fica vazia e o texto diz que não há data — inventar a vigência
     * é exatamente o "número que mente". */
    const abrirAnexo = (a: typeof R.anexos[number] | undefined) => {
      if (!a) return avisa("Este contrato não tem documento anexado.");
      if (!a.disponivel) return avisa("O arquivo de " + a.nome + " não está disponível neste ambiente.");
      abrirUrl(a.origem !== "legado" && a.url ? a.url : "/api/anexos-legado/" + a.id + "/download");
    };
    const ativos = R.contratos.filter((c) => c.status === "ativo");
    /* Próxima renovação = o que vem primeiro entre o vencimento de contrato e a próxima fatura de assinatura
       que ainda cobra (Stripe). Sem isto, quem paga por assinatura mensal nunca teve data. */
    const proxCob = R.assinaturas.filter((a) => a.proximaCobranca).map((a) => ({ a, d: dt(a.proximaCobranca!.data) }))
      .filter((x) => x.d && x.d >= h0).sort((x, y) => x.d!.getTime() - y.d!.getTime())[0] ?? null;
    const proxRen = [...ativos.map((c) => ({ c, d: dt(c.vencimento), mensal: false })), ...(proxCob ? [{ c: null, d: proxCob.d, mensal: proxCob.a.periodo === "mensal" }] : [])]
      .filter((x) => x.d && x.d >= h0).sort((a, b) => a.d!.getTime() - b.d!.getTime())[0] ?? null;
    const diasAte = (d: Date) => Math.round((d.getTime() - hoje.getTime()) / 864e5);
    /* As três perguntas do dono, de uma regra só (financeiro-regras.situacaoFinanceira): fatura do mês vigente,
       próxima cobrança e, quando não há, o PORQUÊ — nunca um traço mudo. */
    const sit = situacaoFinanceira(
      R.faturas.map((f) => ({ estado: f.estado, valor: Number(f.valor), mesCobranca: f.mesCobranca, dataCobranca: dt(f.dataCobranca), pagaEm: dt(f.pagaEm) })),
      R.assinaturas.map((a) => ({ statusStripe: a.status, ativa: ["active", "trialing", "past_due"].includes(a.status), fimDoPeriodo: dt(a.fimDoPeriodo), canceladaEm: dt(a.canceladaEm), cancelaNoFim: !!a.cancelaNoFimDoPeriodo, proximaCobranca: a.proximaCobranca ? { data: dt(a.proximaCobranca.data)!, valor: a.proximaCobranca.valor } : null })),
      hoje,
    );
    const SEM_PROXIMA: Record<MotivoSemProxima, (d: Date | null) => string> = {
      sem_assinatura: () => "sem assinatura no Stripe",
      cancelada: (d) => "assinatura cancelada" + (d ? " em " + dmy(d) : ""),
      suspensa: () => "o Stripe parou de cobrar",
      cancela_no_fim: (d) => "cancela" + (d ? " em " + dmy(d) : " no fim do ciclo") + ", sem nova fatura",
      sem_fim_do_ciclo: () => "Stripe ainda não informou o ciclo",
      sem_valor: (d) => "ciclo até " + dmy(d) + ", valor indisponível",
    };
    const proxTxt = "motivo" in sit.proxima ? SEM_PROXIMA[sit.proxima.motivo](sit.proxima.data) : brl2(sit.proxima.valor) + (diasAte(sit.proxima.data) < 0 ? " · ciclo já encerrado" : " · em " + diasAte(sit.proxima.data) + " dias") + (sit.proxima.assinaturas > 1 ? " · +" + (sit.proxima.assinaturas - 1) + " assinatura(s)" : "");
    const mesBrl = sit.mes.valor != null ? brl2(sit.mes.valor) : "";
    const [mesV, mesS, mesTom]: [string, string, string] = ({
      vencida: ["Vencida", mesBrl + " · venceu " + dmy(sit.mes.data), "erro"],
      a_receber: ["Em aberto", mesBrl + " · vence " + dmy(sit.mes.data), "coral"],
      recebida: ["Paga", mesBrl + (sit.mes.data ? " · em " + dmy(sit.mes.data) : ""), "ok"],
      sera_gerada: ["Ainda não gerada", "será gerada em " + dmy(sit.mes.data) + " · " + mesBrl, "neutro"],
      aguardando_stripe: ["Ainda não gerada", "ciclo acabou em " + dmy(sit.mes.data) + "; o Stripe não renovou", "erro"],
      sem_fatura_no_mes: ["Sem fatura", sit.mes.data ? "nenhuma neste mês · próxima em " + dmy(sit.mes.data) : "nenhuma esperada neste mês", "neutro"],
      sem_assinatura: ["Sem cobrança", "nenhuma assinatura cobrando", "neutro"],
    } as Record<string, [string, string, string]>)[sit.mes.estado];
    const ROT_TIPO: Record<string, string> = { documenso: "Contrato assinado", legado: "Contrato legado (Zoho)" };
    /* Contrato = assinado no Documenso ou do legado. Assinatura do Stripe NÃO
       entra aqui (fica em `R.assinaturas` e no botão "Assinaturas"). */
    const ctr = R.contratos.map((c) => {
      const ini0 = dt(c.inicio), fim = dt(c.vencimento), ativo = c.status === "ativo";
      const pct = ini0 && fim && fim > ini0 ? Math.min(100, Math.max(0, (hoje.getTime() - ini0.getTime()) / (fim.getTime() - ini0.getTime()) * 100)) : 0;
      const dias = fim ? diasAte(fim) : null;
      const urg = ativo && dias != null && dias <= 45;
      const an = R.anexos.find((a) => a.origem === "documenso" && a.entidadeId === c.id)
        ?? R.anexos.find((a) => a.origem === "legado" && a.entidadeTipo === "contrato" && a.entidadeId === c.id && a.categoria === "documento_assinado")
        ?? R.anexos.find((a) => a.origem === "legado" && a.entidadeTipo === "contrato" && a.entidadeId === c.id);
      const rotulo = c.familia ? fam(c.familia).l : c.itens[0]?.nome ?? "Contrato";
      const st = ativo ? "Ativo" : "Encerrado";
      return {
        nome: rotulo + " · " + ROT_TIPO[c.origem],
        cod: (c.codigo ?? "sem código") + (c.mrr != null ? " · " + brl(c.mrr) + "/mês" : ""),
        st, stStyle: pill(tomDoStatus(st)),
        barra: "display:block;height:100%;border-radius:9999px;background:" + (urg ? "var(--of-coral-marca)" : "var(--of-tinta-forte)") + ";transform-origin:left;transition:transform 1s cubic-bezier(.16,1,.3,1);transform:scaleX(" + (S.pronto ? pct : 0) / 100 + ")",
        iniTxt: "Início " + dmy(ini0),
        renTxt: !ativo ? "Encerrado" : fim ? "Vence " + dmy(fim) + " · " + dias + "d" : "Sem data de vencimento",
        renStyle: urg ? "color:var(--of-coral-acao-hover);font-weight:600" : "",
        // Sem arquivo disponível o botão PDF não existe (ClienteDesenho esconde
        // quando `arq` é vazio): botão que só avisa "indisponível" é botão que falha.
        arq: an?.disponivel ? an.nome : "",
        assin: an?.disponivel ? (c.origem === "documenso" ? "Assinado" + (c.assinadoEm ? " em " + dmy(dt(c.assinadoEm)) : "") : "Anexo") : "",
        abrirDoc: () => abrirAnexo(an),
      };
    });

    /* ── Pessoas ──────────────────────────────────────────────────────────
     * SÓ as pessoas reais da empresa (pessoas + leads sem pessoa canônica).
     * O protótipo completava até quatro com um POOL de nomes fixos e gerava
     * e-mail e telefone a partir do nome — isso some inteiro aqui.
     * Ninguém tem "contato principal" designado (clientes.pessoa_principal_id
     * = 0/275): o principal é a primeira pessoa com e-mail, sem o selo virar
     * afirmação de cadastro. "Último contato" = última atividade visível do
     * lead da pessoa (atividades.lead_id); sem lead ou sem atividade, "—". */
    const pessoasReais = e.pessoas;
    const designado = R.principalId ? pessoasReais.find((p) => p.id === R.principalId) ?? null : null;
    const principal = designado ?? pessoasReais.find((p) => p.email) ?? pessoasReais[0] ?? null;
    const leadDe = (p: typeof pessoasReais[number]) => p.fonte === "lead" ? p.id : R.leadDaPessoa[p.id] ?? null;
    const abrirPessoa = (p: typeof pessoasReais[number]) => {
      const l = leadDe(p);
      if (l) return nav("/pessoas/" + l);
      avisa(p.nome + " não tem ficha própria: é um contato da empresa sem lead.");
    };
    const ligar = (p: typeof pessoasReais[number]) => {
      const num = String(p.telefone || "").replace(/\D/g, "");
      if (num.length < 10) return toast.error(p.nome + " não tem telefone cadastrado");
      abrirUrl("https://app.callface.ai/calls?call_to=" + num);
    };
    const whats = (p: typeof pessoasReais[number]) => {
      if (!p.telefone) return toast.error(p.nome + " não tem telefone cadastrado");
      const l = leadDe(p);
      // WhatsApp tem ponto único de saída no produto: a tela de Atendimento.
      nav("/atendimento?canal=WhatsApp" + (l ? "&lead=" + encodeURIComponent(l) : "&contato=" + encodeURIComponent(p.nome)));
    };
    const mail = (p: typeof pessoasReais[number]) => {
      if (!p.email) return toast.error(p.nome + " não tem e-mail cadastrado");
      window.location.href = "mailto:" + p.email;
    };
    /* Toda escrita da tela passa por aqui: chama o command, avisa com a resposta
       do servidor e relê a página (a tela mostra o banco, não o que digitou). */
    const rodar = async (acao: Promise<Resultado>, ok: string): Promise<boolean> => {
      const r = await acao;
      if (!r.ok) { toast.error(r.erro); return false; }
      toast.success(ok);
      P.refresh?.();
      return true;
    };
    const tornarPrincipal = (p: { id: string; nome: string }) => () => { void rodar(acaoTornarPrincipal(e.id, p.id), p.nome + " agora é o contato principal"); };
    const pesVal = (p: typeof pessoasReais[number], i: number) => {
      const ehP = p === principal, papel = rotuloPapel(p.papel);
      return {
        nome: p.nome, cargo: p.cargo ?? "", papel, cargoPapel: [p.cargo, papel].filter(Boolean).join(" · "),
        ini: ini(p.nome), email: p.email ?? "—", tel: p.telefone ?? "—", ultimo: (() => { const l = leadDe(p), d = l ? dt(R.ultimoContatoPorLead?.[l]) : null; return d ? dmy(d) : "—"; })(), ehPrincipal: ehP, abrir: () => abrirPessoa(p),
        linha: "display:flex;align-items:center;gap:11px;flex-wrap:wrap;padding:11px 0;" + (i === 0 ? "" : "border-top:1px solid var(--of-fio-tenue)"),
        acoes: [{ titulo: "WhatsApp", d: I.wa, onClick: () => whats(p) }, { titulo: "Ligar pelo Callface", d: I.tel, onClick: () => ligar(p) }, { titulo: "E-mail", d: I.mail, onClick: () => mail(p) }],
        princTxt: ehP ? "Principal" : "Tornar principal", princDica: ehP ? (designado ? "Contato principal da conta" : "Primeiro contato com e-mail da conta (ninguém designado)") : "Tornar contato principal",
        princStyle: "flex:0 0 auto;height:30px;padding:0 10px;border-radius:7px;border:0;font-size:11.5px;font-weight:600;white-space:nowrap;cursor:" + (ehP ? "default;background:var(--of-coral-fundo);color:var(--of-coral-acao-hover)" : "pointer;background:var(--of-papel);color:var(--of-tinta-2);box-shadow:inset 0 0 0 1px var(--of-linha)"),
        tornarPrincipal: ehP && designado ? () => {} : tornarPrincipal(p),
      };
    };
    const pessoas = pessoasReais.map(pesVal);

    /* ── Documentos ───────────────────────────────────────────────────────
     * Só `anexos_legado` (nome, tamanho e data reais). Os documentos que o
     * protótipo GERAVA — contrato com cláusula e assinatura, proposta,
     * kickoff, "Notas fiscais (N)" — saem: eram texto fabricado com CNPJ e
     * signatário inventados. */
    const catDoc = (a: typeof R.anexos[number]) => a.origem === "upload" ? "Outros" : a.origem === "documenso" ? "Contratos" : a.entidadeTipo === "contrato" ? "Contratos" : a.entidadeTipo === "negocio" ? "Propostas" : "Outros";
    const docsTodos = R.anexos.map((a) => {
      const ext = (a.nome.split(".").pop() || "ARQ").slice(0, 4).toUpperCase();
      return { a, cat: catDoc(a), ext };
    });
    const docsF = docsTodos.filter((d) => S.docF === "todos" || d.cat === S.docF);

    /* ── Histórico ────────────────────────────────────────────────────────
     * Linha do tempo canônica (eventos de vendas + atividades + notas) mais o
     * que o financeiro sabe de verdade: faturas pagas e vencidas, e o início
     * de cada contrato. Nada de "Upsell" ou "Cross-sell" deduzido do hash. */
    const ev: Array<{ d: Date; t: string; meta: string; cat: string; dPath: string; tom: string }> = [];
    const push = (d: Date | null, t: string, meta: string, cat: string, dPath: string, tom = "neutro") => { if (d) ev.push({ d, t, meta, cat, dPath, tom }); };
    const desde = dt(R.clienteDesde);
    push(desde, "Virou cliente", R.closer ? "Fechado por " + R.closer : "", "comercial", I.check, "coral");
    R.contratos.forEach((c) => push(dt(c.inicio), "Contrato iniciado · " + ROT_TIPO[c.origem], [c.codigo, c.mrr != null ? brl2(c.mrr) + "/mês" : null].filter(Boolean).join(" · "), "comercial", I.doc, "coral"));
    R.iniciosDeAssinatura.forEach((a) => push(dt(a.inicio), "Assinatura iniciada no Stripe", [a.codigo, a.mrr != null ? brl2(a.mrr) + "/mês" : null].filter(Boolean).join(" · "), "comercial", I.doc, "coral"));
    fats.forEach((f) => {
      if (f.st === "Pago") push(f.pagoEm, "Fatura " + f.rot + " paga", brl2(f.v) + (f.ext ? " · " + f.ext : ""), "financeiro", I.check, "ok");
      if (f.st === "Vencida" && f.venc) push(f.venc, "Fatura " + f.rot + " venceu sem pagamento", brl2(f.v) + (f.ext ? " · " + f.ext : ""), "financeiro", I.alert, "erro");
    });
    R.timeline.forEach((t) => { const c = categoriaDoEvento(String(t.tipo)); push(dt(t.ocorridoEm), t.titulo || rotuloDeEvento(String(t.tipo)), t.usuarioNome ?? "Sistema", c.cat, c.d, c.tom); });
    /* Notas escritas na conta (notas.empresa_id): o texto inteiro mora no meta, o autor e a hora na linha. */
    R.notas.forEach((n) => { const linha = n.texto.split("\n")[0]; push(dt(n.em), "Nota: " + (linha.length > 110 ? linha.slice(0, 110) + "…" : linha), [n.autor ?? "Sem autor", n.texto.length > linha.length || linha.length > 110 ? n.texto : null].filter(Boolean).join(" · "), "nota", I.note, "neutro"); });
    ev.sort((a, b) => b.d.getTime() - a.d.getTime());
    const quando = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const n = Math.round((h0.getTime() - x.getTime()) / 864e5), hm = pad(d.getHours()) + ":" + pad(d.getMinutes());
      return n === 0 ? "Hoje, " + hm : n === 1 ? "Ontem, " + hm : n > 1 && n < 7 ? "Há " + n + " dias" : dExt(d); };
    const evRow = (arr: typeof ev) => arr.map((x, i) => ({ t: x.t, meta: x.meta, quando: quando(x.d), d: x.dPath,
      marca: "position:relative;z-index:1;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;box-shadow:0 0 0 3px var(--of-papel);" + MARCA[x.tom],
      linha: i < arr.length - 1 ? "position:absolute;left:11.25px;top:34px;bottom:-6px;width:1.5px;background:var(--of-fio)" : "display:none" }));
    const HF = [["todos", "Tudo"], ["atividades", "Atividades"], ["financeiro", "Financeiro"], ["comercial", "Comercial"], ["nota", "Notas"]];
    const evF = ev.filter((x) => S.histF === "todos" || x.cat === S.histF);

    /* ── Saúde ────────────────────────────────────────────────────────────
     * Os 7 fatores REAIS do snapshot (com a evidência em texto) no lugar dos
     * 4 do protótipo, dois dos quais não têm fonte (licenças em uso e
     * chamados de suporte). Sem snapshot, sem score. */
    const H = R.health;
    const ICO_F: Record<string, string> = { faturas_vencidas: I.card, relacionamento: I.heart, entrega: I.layers, uso_produto: I.trend };
    const TOM_F: Record<string, string> = { ok: "ok", atencao: "coral", critico: "erro", desconhecido: "neutro" };
    const sd = !H ? ["Sem avaliação", "neutro", "Esta conta ainda não tem snapshot de saúde calculado."]
      : H.status === "saudavel" ? ["Saudável", "ok", "Conta estável e com baixo risco de churn."]
      : H.status === "atencao" ? ["Em atenção", "coral", "Sinais mistos. Vale revisar a conta antes da renovação."]
      : ["Em risco", "erro", "Risco alto de churn. Priorize contato de retenção."];
    const saude = {
      n: H ? String(H.score) : "—", da: (S.pronto && H ? H.score : 0) + " 100", l: sd[0], selo: pill(sd[1]),
      txt: sd[2] + (H ? " Calculado em " + dmy(dt(H.calculadoEm)) + " · cobertura " + H.cobertura + "%." : ""),
      fatores: (H?.fatores ?? []).map((f) => ({ d: ICO_F[f.codigo] ?? I.alert, t: f.rotulo, s: f.evidencia, dot: "flex:0 0 auto;width:8px;height:8px;border-radius:9999px;background:" + dotC[TOM_F[f.estado] ?? "neutro"] })),
    };

    /* ── Gráfico ──────────────────────────────────────────────────────────
     * A série de MRR (`cliente_receita_mensal`) está vazia no banco. O que
     * existe é o FATURADO por competência — então o gráfico mostra isso e o
     * rótulo diz isso. Chamar faturamento de "MRR" seria o número que mente.
     * O modo "Por produto" sai: faturas raramente se ligam a um serviço. */
    const W = Array.from({ length: 12 }, (_, i) => new Date(hoje.getFullYear(), hoje.getMonth() - 11 + i, 1));
    const tot = W.map((m) => fats.filter((f) => { const d = f.comp ?? f.pagoEm; return d && d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth(); }).reduce((a, f) => a + f.v, 0));
    const passo = (mx: number) => { const alvo = mx / 4, pot = Math.pow(10, Math.floor(Math.log10(Math.max(1, alvo)))), n2 = alvo / pot; return (n2 <= 1 ? 1 : n2 <= 2 ? 2 : n2 <= 2.5 ? 2.5 : n2 <= 5 ? 5 : 10) * pot; };
    const stE = passo(Math.max(1, ...tot)), topo = stE * 4, Xg = (i: number) => i / 11 * 600, Yg = (val: number) => 136 - val / topo * 128;
    const curva = (ys: number[]) => ys.map((_, i) => { const x = Xg(i), y = Yg(ys[i]); if (!i) return "M" + x.toFixed(1) + " " + y.toFixed(1); const xp = Xg(i - 1), yp = Yg(ys[i - 1]), xm = ((xp + x) / 2).toFixed(1); return "C" + xm + " " + yp.toFixed(1) + " " + xm + " " + y.toFixed(1) + " " + x.toFixed(1) + " " + y.toFixed(1); }).join(" ");
    const hv = S.hv != null ? S.hv : null, hi = hv != null ? hv : 11;
    const ant = W.map((_, i) => i ? tot[i - 1] : tot[0]);
    const eixoK = (n: number) => n >= 1000 ? "R$ " + (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : "R$ " + Math.round(n);
    const dH = hi ? tot[hi] - tot[hi - 1] : 0;
    const g = {
      ...v.g, ehTotal: true, ehFam: false,
      modos: [{ l: "Faturado", onClick: () => {}, style: "height:26px;padding:0 10px;border-radius:7px;border:0;cursor:default;font-size:12px;white-space:nowrap;background:rgba(255,255,255,.12);color:var(--of-papel);font-weight:600" }],
      legenda: [{ l: "Faturado no mês", dot: "width:14px;height:2.5px;border-radius:2px;background:var(--of-coral-marca)" }, { l: "Mês anterior", dot: "width:14px;height:0;border-top:1.6px dashed var(--of-tinta-3)" }],
      pergunta: "Quanto foi faturado por mês nos últimos 12 meses",
      yl: [4, 3, 2, 1, 0].map((k) => ({ l: eixoK(stE * k), st: "position:absolute;right:0;font-size:10.5px;line-height:10px;color:var(--of-tinta-3);font-variant-numeric:tabular-nums;white-space:nowrap;top:calc(" + (Yg(stE * k) / 140 * 100) + "% - 5px)" })),
      dLinha: curva(tot), dArea: curva(tot) + " L600 140 L0 140 Z", dAnt: curva(ant), camadas: [],
      dGuia: hv != null ? "M" + Xg(hv).toFixed(1) + " 0V140" : "M0 0",
      ponto: "position:absolute;pointer-events:none;width:12px;height:12px;border-radius:9999px;background:var(--of-coral-marca);box-shadow:0 0 0 3px var(--of-tinta-forte),0 0 0 5px rgba(254,79,43,.35);transition:left .15s,top .15s;left:calc(" + (hi / 11 * 100).toFixed(2) + "% - 6px);top:calc(" + (Yg(tot[hi]) / 140 * 100).toFixed(2) + "% - 6px)",
      alvos: W.map((_, i) => ({ entrar: () => { if (S.hv !== i) setS({ hv: i }); } })),
      tipStyle: "position:absolute;z-index:3;pointer-events:none;top:-4px;width:190px;padding:9px 11px;border-radius:10px;background:var(--of-tinta);box-shadow:0 0 0 1px var(--of-shell-linha-2),0 14px 30px -12px rgba(0,0,0,.6);transition:opacity .15s;opacity:" + (hv == null ? 0 : 1) + ";" + (hi > 6 ? "right:calc(" + ((1 - hi / 11) * 100).toFixed(2) + "% + 14px)" : "left:calc(" + (hi / 11 * 100).toFixed(2) + "% + 14px)"),
      tipT: MESL[W[hi].getMonth()] + " " + W[hi].getFullYear(), tipTot: brl(tot[hi]), tipL: [],
      tipD: hi ? (dH >= 0 ? "+" : "−") + brl(Math.abs(dH)) + " vs. mês anterior" : "início da janela",
      tipDStyle: "display:block;margin-top:5px;font-size:11px;font-weight:600;color:" + (dH >= 0 ? "var(--of-sucesso-tinta)" : "var(--of-coral-no-escuro)"),
      rot: W.map((m, i) => ({ l: MES[m.getMonth()], st: "position:absolute;top:0;font-size:10.5px;white-space:nowrap;color:" + (hv === i ? "var(--of-papel)" : "var(--of-tinta-3)") + ";left:" + (i / 11 * 100) + "%;transform:" + (i === 0 ? "none" : i === 11 ? "translateX(-100%)" : "translateX(-50%)") })),
    };

    /* Evolução de FATURAMENTO (cliente_receita_mensal), empilhada por natureza
     * (MRR | Setup/Avulso | Débito recuperado | A classificar) e a linha de MRR
     * por cima. Substitui o gráfico de faturas Stripe acima quando a empresa
     * tem série carregada; sem série, cai no gráfico de faturas (conta que
     * só existe no Stripe). */
    const FAT = R.faturamento ?? [];
    const gx = FAT.length ? geometriaFaturamento(FAT, {}, 600, 140) : null;
    if (gx) {
      const n = FAT.length, hiF = S.hv != null && S.hv < n ? S.hv : n - 1, ult = FAT[n - 1];
      const mesDe = (c: string) => { const [a, m] = c.split("-").map(Number); return { a, m: m - 1 }; };
      const dF = hiF ? gx.totais[hiF] - gx.totais[hiF - 1] : 0;
      const eixo = (nv: number) => nv >= 1000 ? "R$ " + (nv / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : "R$ " + Math.round(nv);
      Object.assign(g, {
        ehTotal: true, ehFam: true,
        modos: [{ l: "Faturamento", onClick: () => {}, style: g.modos[0].style }],
        legenda: [...gx.visiveis.map((c) => ({ l: c.l, dot: "width:9px;height:9px;border-radius:2px;background:" + c.cor })), { l: "Linha de MRR", dot: "width:14px;height:2.5px;border-radius:2px;background:var(--of-coral-marca)" }],
        pergunta: "Quanto entrou por mês, por natureza, nos últimos " + n + " meses",
        yl: [4, 3, 2, 1, 0].map((k) => ({ l: eixo(gx.passo * k), st: "position:absolute;right:0;font-size:10.5px;line-height:10px;color:var(--of-tinta-3);font-variant-numeric:tabular-nums;white-space:nowrap;top:calc(" + (gx.Y(gx.passo * k) / 140 * 100) + "% - 5px)" })),
        // a linha de MRR (coral) fica sob as áreas translúcidas; sem área/anterior próprios.
        dLinha: gx.linhaMrr, dArea: "M0 0", dAnt: "M0 0",
        camadas: gx.camadas.map((c) => ({ d: c.area, cor: c.cor + "b3", st: "" })),
        dGuia: S.hv != null ? "M" + gx.X(hiF).toFixed(1) + " 0V140" : "M0 0",
        ponto: "position:absolute;pointer-events:none;width:12px;height:12px;border-radius:9999px;background:var(--of-coral-marca);box-shadow:0 0 0 3px var(--of-tinta-forte),0 0 0 5px rgba(254,79,43,.35);transition:left .15s,top .15s;left:calc(" + (hiF / Math.max(1, n - 1) * 100).toFixed(2) + "% - 6px);top:calc(" + (gx.Y(FAT[hiF].mrr) / 140 * 100).toFixed(2) + "% - 6px)",
        alvos: FAT.map((_, i) => ({ entrar: () => { if (S.hv !== i) setS({ hv: i }); } })),
        tipT: MESL[mesDe(FAT[hiF].competencia).m] + " " + mesDe(FAT[hiF].competencia).a, tipTot: brl(FAT[hiF].total),
        tipL: gx.visiveis.map((c) => ({ l: c.l, v: brl(FAT[hiF][c.k]), dot: "width:8px;height:8px;border-radius:2px;background:" + c.cor })),
        tipD: hiF ? (dF >= 0 ? "+" : "−") + brl(Math.abs(dF)) + " vs. mês anterior" : "início da janela",
        tipDStyle: "display:block;margin-top:5px;font-size:11px;font-weight:600;color:" + (dF >= 0 ? "var(--of-sucesso-tinta)" : "var(--of-coral-no-escuro)"),
        rot: FAT.map((m, i) => ({ l: MES[mesDe(m.competencia).m], st: "position:absolute;top:0;font-size:10.5px;white-space:nowrap;color:" + (S.hv === i ? "var(--of-papel)" : "var(--of-tinta-3)") + ";left:" + (i / Math.max(1, n - 1) * 100) + "%;transform:" + (i === 0 ? "none" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)") })),
      });
    }
    const ultF = FAT.length ? FAT[FAT.length - 1] : null, antF = FAT.length > 1 ? FAT[FAT.length - 2] : null;
    const mesRot = ultF ? MES[Number(ultF.competencia.slice(5)) - 1].toLowerCase() + "/" + ultF.competencia.slice(0, 4) : "";

    /* ── Stripe ───────────────────────────────────────────────────────────
     * customer id REAL. Método de pagamento não tem fonte (faturas.raw é NULL
     * e assinaturas não guardam payment_method) → "—". O "há 2 min" literal
     * do protótipo sai. Portal do cliente não tem integração → aviso. */
    const cus = R.stripeCustomerId;
    const subsAtivas = R.assinaturas.filter((a) => a.status === "active" || a.status === "trialing");
    const abrirStripe = () => cus ? abrirUrl(STRIPE_CUSTOMER(cus)) : avisa("Esta conta não tem cliente Stripe vinculado.");

    /* Portal do cliente: a sessão é efêmera (o Stripe a expira em minutos), por
       isso ela é criada no clique e nunca guardada. */
    const linkDoPortal = async (): Promise<string | null> => {
      try {
        const r = await fetch("/api/clientes/" + e.id + "/portal-stripe", { method: "POST" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d?.url) { toast.error(d?.error || "Não deu para abrir o portal do Stripe"); return null; }
        return d.url as string;
      } catch {
        toast.error("Não deu para falar com o Stripe agora.");
        return null;
      }
    };
    /* A aba é aberta ANTES do fetch: o navegador só aceita popup que saia direto
       do clique, e abrir depois da resposta cai no bloqueador. Sem `noopener`
       porque com ele o `window.open` devolve null e some o handle para navegar. */
    const gerenciarPagamento = () => {
      const aba = window.open("about:blank", "_blank");
      linkDoPortal().then((url) => {
        if (!url) return aba?.close();
        if (aba) aba.location.href = url; else abrirUrl(url);
      });
    };
    const stripe = {
      abrir: abrirStripe,
      sync: cus ? "Cliente Stripe · " + cus : "Sem cliente Stripe vinculado",
      linha: [cus, ...subsAtivas.map((a) => a.stripeSubscriptionId)].filter(Boolean).join(" · ") || "—",
      /* O rótulo deste botão no desenho é "Copiar portal do cliente", então ele
         copia mesmo — e o toast avisa do prazo, porque mandar o link para o
         cliente amanhã entrega uma sessão morta. */
      portal: () => {
        if (!cus) return avisa("Esta conta não tem cliente Stripe vinculado.");
        linkDoPortal().then((url) => {
          if (!url) return;
          navigator.clipboard.writeText(url).then(
            () => toast("Link direto do portal copiado — uso imediato", { description: "Vale poucos minutos e abre uma vez. Mande ao cliente agora; amanhã ele não abre." }),
            () => toast.error("Não deu para copiar"),
          );
        });
      },
      fatos: [
        { l: "Método", v: "—" },
        { l: "Próxima cobrança", v: "motivo" in sit.proxima ? SEM_PROXIMA[sit.proxima.motivo](sit.proxima.data) : dmy(sit.proxima.data) + " · " + brl2(sit.proxima.valor) },
        /* Conta com assinatura ativa E uma em atraso só dizia "Ativa": o estado
           ruim sumia atrás do bom. Agora cada status presente aparece, contado. */
        { l: "Assinatura", v: R.assinaturas.length
            ? [...R.assinaturas.reduce((m, a) => m.set(a.statusRotulo, (m.get(a.statusRotulo) ?? 0) + 1), new Map<string, number>())]
                .sort((x, y) => (x[0] === "Ativa" ? -1 : y[0] === "Ativa" ? 1 : 0))
                .map(([st, n]) => st + (n > 1 ? " · " + n : ""))
                .join(" · ")
            : "Sem assinatura" },
      ],
    };

    /* ── Empresa ──────────────────────────────────────────────────────────
     * Cada fato pelo cadastro; ausência = "—". Nunca o CNPJ do hash, a cidade
     * sorteada ou slug(nome)+".com.br". Origem = a aquisição mais antiga. */
    const cidadeUF = [e.cidade, e.estado].filter(Boolean).join(" / ") || null;
    const origem = e.leads.length ? e.leads[e.leads.length - 1].origem : null;
    const emp = {
      abrir: () => nav("/empresas/" + e.id),
      fatos: [["CNPJ", e.cnpj], ["Segmento", e.setor], ["Porte", e.porte], ["Cidade / UF", cidadeUF], ["Site", e.website], ["Origem", origem], ["Closer", R.closer], ["Stripe", cus]]
        .map(([l, val]) => ({ l, v: val || "—" })),
    };

    /* ── Agenda ─────────────────────────────────────────────────────────── */
    const prox = R.tarefas.slice(0, 5).map((t) => {
      const q = dt(t.venceEm); const late = q && q < h0;
      const n = q ? Math.round((new Date(q).setHours(0, 0, 0, 0) - h0.getTime()) / 864e5) : null;
      const dia = n == null ? "Sem data" : n < 0 ? "Atrasada" : n === 0 ? "Hoje" : n === 1 ? "Amanhã" : dm(q!);
      return { t: t.titulo, s: [t.tipo, t.responsavel].filter(Boolean).join(" · "), d: I.check, dia,
        hora: q && t.venceEm && t.venceEm.length > 10 ? pad(q.getHours()) + ":" + pad(q.getMinutes()) : "—",
        ico: "flex:0 0 auto;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--of-fio-tenue);color:var(--of-tinta)",
        data: "flex:0 0 auto;width:62px;padding:6px 0;border-radius:9px;text-align:center;" + (late ? "background:var(--of-coral-fundo-forte);color:var(--of-coral-acao-hover)" : dia === "Hoje" ? "background:var(--of-tinta-forte);color:var(--of-papel)" : "background:var(--of-fio-tenue);color:var(--of-tinta)"),
        onClick: () => nav("/tarefas") };
    });

    /* ── Hero ───────────────────────────────────────────────────────────── */
    const tile = (l: string, val: string, s2: string, cor: string, fn: () => void) => ({ l, v: val, s: s2, onClick: fn, vStyle: tileV(cor) });
    const primeiroPago = fats.filter((f) => f.st === "Pago" && f.pagoEm).map((f) => f.pagoEm!).sort((a, b) => a.getTime() - b.getTime())[0];
    const hero = {
      ...v.hero,
      mrr: brl(mrr),
      // Variação real do faturamento total vs. mês anterior, quando há série.
      /*
       * Três casos, não dois. O selo dizia "sem histórico de faturamento" sempre que o
       * MÊS ANTERIOR fosse zero — e aparecia ao lado de um gráfico cheio e de faturas
       * pagas listadas na mesma tela (cliente THAYS, 14/10: set/2026 R$ 180, ago/2026
       * zero, três faturas pagas desde julho). Tela que se contradiz sozinha não é lida.
       */
      ...(ultF && antF && antF.total > 0
        ? { dt: Math.abs(Math.round((ultF.total / antF.total - 1) * 100)) + "%", dIco: ultF.total >= antF.total ? I.up : I.dn, dTxt: "faturado vs. mês anterior" }
        : pagoTotal > 0 || fats.length > 0
          ? { dt: "—", dIco: I.up, dTxt: antF ? "mês anterior sem faturamento" : "primeiro mês com faturamento" }
          : { dt: "—", dIco: I.up, dTxt: "sem histórico de faturamento" }),
      dStyle: "display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:9999px;font-size:12px;font-weight:700;white-space:nowrap;background:rgba(255,255,255,.08);color:var(--of-tinta-4)",
      fams: fams.map((f) => ({ l: f.F.l, v: brl(f.mrr), dot: "flex:0 0 auto;width:8px;height:8px;border-radius:2px;background:" + f.F.cor })),
      tiles: [
        ...(ultF ? [
          tile("MRR em " + mesRot, brl(ultF.mrr), "recorrente faturado no mês", "var(--of-papel)", irAba("financeiro")),
          tile("Setup / Avulso", brl(ultF.avulso + ultF.debito), ultF.debito ? "inclui " + brl(ultF.debito) + " de débito recuperado" : "não recorrente no mês", "var(--of-papel)", irAba("financeiro")),
          tile("Total faturado em " + mesRot, brl(ultF.total), ultF.semClasse ? brl(ultF.semClasse) + " a classificar" : "MRR + setup/avulso", "var(--of-papel)", irAba("financeiro")),
        ] : []),
        tile("Receita acumulada", brlK(pagoTotal), primeiroPago ? "faturas pagas desde " + MES[primeiroPago.getMonth()].toLowerCase() + "/" + primeiroPago.getFullYear() : pagoTotal > 0 ? "faturas pagas (sem data de pagamento)" : "nenhuma fatura paga", "var(--of-papel)", irAba("financeiro")),
        tile("Em aberto", brl(emAberto), vencidas.length ? brl(vencido) + " vencido" : proxF?.venc ? "vence " + dm(proxF.venc) : "nada pendente", vencidas.length ? "var(--of-coral-no-escuro)" : "var(--of-papel)", irAba("financeiro")),
        tile("Próxima renovação", proxRen ? dmy(proxRen.d) : "—", proxRen ? (proxRen.c ? "" : "próxima fatura · ") + "em " + diasAte(proxRen.d!) + " dias" : "motivo" in sit.proxima ? SEM_PROXIMA[sit.proxima.motivo](sit.proxima.data) : "sem data de vencimento", proxRen && !proxRen.mensal && diasAte(proxRen.d!) <= 45 ? "var(--of-coral-no-escuro)" : "var(--of-papel)", () => proxRen && abrirOpp("renovacao")),
      ],
    };

    const fin = {
      ...v.fin,
      aberto: brl2(emAberto),
      abertoStyle: "display:block;margin-top:3px;font-family:'Plus Jakarta Sans',sans-serif;font-size:26px;font-weight:800;letter-spacing:-.035em;line-height:1.1;font-variant-numeric:tabular-nums;color:" + (vencidas.length ? "var(--of-coral-acao-hover)" : "var(--of-tinta-forte)"),
      abertoSub: vencidas.length ? vencidas.length + (vencidas.length > 1 ? " faturas vencidas" : " fatura vencida") + " · " + brl2(vencido) + (maisAtraso ? " · a mais antiga há " + maisAtraso + " dias" : "") : abertas.length ? abertas.length + (abertas.length > 1 ? " faturas em aberto" : " fatura em aberto") + (proxF ? " · vence " + dmy(proxF.venc) : "") : "Nenhuma fatura pendente",
      abertoSubStyle: "display:block;margin-top:3px;font-size:12px;font-weight:" + (vencidas.length ? "600;color:var(--of-coral-acao-hover)" : "500;color:var(--of-tinta-3)"),
      temCobrar: !!(vencidas[0] ?? abertas[0])?.hosted,
      cobrar: () => { const f = vencidas[0] ?? abertas[0]; if (f?.hosted) copiar(f.hosted, "Link de cobrança"); },
      /* A primeira linha é sempre a fatura do mês vigente (paga, em aberto, vencida ou "ainda não gerada"). */
      ultimas: [{ id: "mes-vigente", comp: "Fatura de " + sit.mesRotulo, vencTxt: mesS, valor: mesBrl || "—", st: mesV, stStyle: pill(mesTom), dot: dotS(mesTom) }, ...fats.slice(0, 3).map(fatRow)],
      kpis: [
        ["Em aberto", brl2(emAberto), vencidas.length ? brl2(vencido) + " vencido" + (maisAtraso ? " · há " + maisAtraso + " dias" : "") : proxF ? "vence " + dmy(proxF.venc) : abertas.length ? "sem data de vencimento" : "nada pendente", vencidas.length ? "var(--of-coral-acao-hover)" : "var(--of-tinta-forte)"],
        ["Fatura de " + sit.mesRotulo, mesV, mesS, mesTom === "erro" ? "var(--of-coral-acao-hover)" : "var(--of-tinta-forte)"],
        ["Próxima cobrança", "motivo" in sit.proxima ? "—" : dmy(sit.proxima.data), proxTxt, "var(--of-tinta-forte)"],
        ["Pago em 12 meses", brl2(pago12), pagas12.length + (pagas12.length === 1 ? " fatura paga" : " faturas pagas"), "var(--of-tinta-forte)"],
        // Responsável financeiro não é designado no banco: mostra o contato
        // principal REAL, com o e-mail real — nunca o "Financeiro" do POOL.
        ["Cobrança para", principal?.nome ?? "—", principal?.email ?? "—", "var(--of-tinta-forte)"],
      ].map(([l, val, s2, cor]) => ({ l, v: val, s: s2, vStyle: kpiS(cor) })),
      sub: fats.length + (fats.length === 1 ? " fatura" : " faturas") + " no Stripe · rascunhos e anuladas não entram",
      vazia: !fatFil.length, linhas: fatFil.map(fatRow), exportar,
    };

    const vencida = R.assinaturas.find((a) => a.statusFin === "vencida" || a.statusFin === "inadimplente");
    const statusC = fams.length && fams.every((f) => f.st === "Encerrado") ? ["Cobrança encerrada", "neutro"] : vencida ? ["Assinatura " + vencida.statusRotulo.toLowerCase(), "erro"] : R.fulfillmentAberto ? ["Em implantação", "coral"]
      /* "Cliente ativo" é uma afirmação de CLASSE: só sai quando a função única diz Cliente.
         Fora disso (ex.: ficou sem serviço ativo) a etiqueta é a classe real, com o estágio. */
      : R.classificacao.classe === "cliente" ? ["Cliente ativo", "ok"] : [textoDaClasse(R.classificacao), "neutro"];
    const ABAS: Array<[string, string, number | null, boolean?]> = [["geral", "Visão geral", null], ["produtos", "Produtos", nItens], ["financeiro", "Financeiro", vencidas.length || null, !!vencidas.length], ["pessoas", "Pessoas", pessoas.length], ["documentos", "Documentos", docsTodos.length], ["historico", "Histórico", null]];
    /* Aba de uso só existe quando a página trouxe a leitura da Callface AI.
       Vínculo pendente acende a contagem em coral: há uma decisão esperando. */
    if (P.usoCallfaceAi) {
      const pend = P.usoCallfaceAi.uso?.vinculo.estado === "pendente";
      ABAS.splice(2, 0, ["uso", "Uso da Callface AI", pend ? 1 : null, pend]);
    }

    return {
      ...v,
      cab: {
        ...v.cab,
        st: statusC[0], stStyle: pill(statusC[1]), stDot: dotS(statusC[1]),
        meta: [e.setor, desde ? "Cliente desde " + dExt(desde) : null, cidadeUF].filter(Boolean).join("  ·  "),
        tags: fams.map((f) => ({ l: f.F.l })),
        // E8: COALESCE(responsavel_cs_id, responsavel_id), resolvido em cliente-para-o-desenho.
        csm: R.csm ?? "Sem responsável", csmIni: R.csm ? ini(R.csm) : "—",
        closer: R.closer ?? "—",
        princ: principal?.nome ?? "Sem contato", princIni: ini(principal?.nome), princCargo: principal?.cargo ?? "",
      },
      resp: {
        ...v.resp,
        equipe: R.equipeIds.map((u) => ({ nome: u.nome, ini: ini(u.nome), radio: radio(u.id === R.csmId), onClick: () => { setS({ resp: null }); if (u.id !== R.csmId) void rodar(acaoAtribuirCsm(e.id, u.id), u.nome + " assumiu o Customer Success"); } })),
        pessoas: pessoasReais.map((p) => ({ nome: p.nome, cargo: p.cargo ?? "", ini: ini(p.nome), radio: radio(p === principal), onClick: () => { setS({ resp: null }); if (p !== principal || !designado) tornarPrincipal(p)(); } })),
      },
      menu: {
        ...v.menu,
        itens: [
          /* Só aparece com cliente no Stripe: sem customer não existe portal, e
             um item que só serve para explicar que não funciona é botão
             mentiroso. É a saída para "o cliente paga no boleto e quer trocar
             para cartão" — o portal é o único lugar onde ele informa o cartão. */
          ...(cus ? [{ l: "Gerenciar pagamento", d: I.swap, onClick: () => { setS({ menu: null }); gerenciarPagamento(); } }] : []),
          { l: "Abrir no Stripe", d: I.card, onClick: () => { setS({ menu: null }); abrirStripe(); } },
          { l: "Abrir empresa", d: I.building, onClick: () => { setS({ menu: null }); nav("/empresas/" + e.id); } },
          { l: "Exportar faturas (CSV)", d: I.dl, onClick: () => { setS({ menu: null }); exportar(); } },
          { l: "Copiar link do cliente", d: I.link, onClick: () => { setS({ menu: null }); copiar(window.location.href, "Link do cliente"); } },
        ],
      },
      abas: ABAS.map(([k, l, n, alerta]) => ({ l, n: n != null ? String(n) : "", temN: n != null, onClick: irAba(k),
        nStyle: "min-width:20px;height:18px;padding:0 6px;border-radius:9999px;display:grid;place-items:center;font-size:10.5px;font-weight:700;" + (alerta ? "background:var(--of-coral-acao);color:var(--of-papel)" : S.aba === k ? "background:var(--of-coral-marca);color:var(--of-papel)" : "background:var(--of-calha);color:var(--of-tinta-2)"),
        style: "flex:0 0 auto;display:flex;align-items:center;gap:7px;height:46px;padding:0 2px;border:0;background:transparent;cursor:pointer;font-size:13px;white-space:nowrap;" + (S.aba === k ? "color:var(--of-tinta-forte);font-weight:600;box-shadow:inset 0 -2px 0 var(--of-coral-marca)" : "color:var(--of-tinta-3);font-weight:500") })),
      /* "Nova atividade" e "Agendar reunião" abrem as peças canônicas de Atividades e Reunião
         com a EMPRESA real e o contato principal real. O gerado montava o contexto com o
         "principal" do protótipo (nome do pool). */
      acoes: {
        ...v.acoes,
        registrar: () => P.abrir?.("novaAtividade", { empresa: e.nome, empresaId: e.id, pessoa: principal?.nome ?? "", lead: principal ? leadDe(principal) ?? "" : "" }),
        agendar: () => { const d = new Date(hoje.getTime() + 864e5); P.abrir?.("novaReuniao", { data: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()), hora: "10:00", titulo: "Alinhamento · " + e.nome, empresa: e.nome, empresaId: e.id, pessoa: principal?.nome ?? "", leadId: principal ? leadDe(principal) ?? "" : "" }); },
      },
      hero, g,
      prodSub: nItens + (nItens === 1 ? " item" : " itens") + " · " + brl(mrr) + "/mês",
      fams: fams.map((f) => ({
        l: f.F.l, d: f.F.d, st: f.st, stStyle: pill(tomDoStatus(f.st)),
        tile: "flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:" + f.F.tile[0] + ";color:" + f.F.tile[1],
        tileG: "flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:" + f.F.tile[0] + ";color:" + f.F.tile[1],
        sub: f.itens.length + (f.itens.length > 1 ? " itens" : " item") + (f.start ? " · desde " + dmy(f.start) : ""),
        mrr: brl(f.mrr), raw: brl2(f.mrr),
        // Desconto não é registrado: diferença entre itens e serviço não é
        // "desconto negociado", é só dado de origens diferentes.
        temDesc: false, desc: "",
        contratoTxt: f.contratos.map((id) => { const c = contratoPorId.get(id); return c ? (c.codigo ?? "contrato") + (c.vencimento ? " · vence " + dmy(dt(c.vencimento)) : "") : null; }).filter(Boolean).join(" · ") || "Sem contrato vinculado",
        upsell: () => abrirOpp("expansao", f.k), upgrade: () => abrirOpp("upgrade", f.k),
        itens: f.itens.map((x) => ({
          qn: <span title={x.qtd + " × " + x.nome} className="block truncate">{x.qtd + " × " + x.nome}</span>, nome: <span title={x.nome} className="block max-w-full truncate">{x.nome}</span>, sku: "", tipo: x.tipo, qtd: String(x.qtd),
          tipoTxt: x.tipo + " · " + brl2(x.preco), preco: brl2(x.preco), sub: brl(x.sub), desde: dmy(x.desde),
          usoTxt: "Ativo", barra: "display:block;height:100%;border-radius:9999px;background:var(--of-tinta-forte);transform-origin:left;transition:transform .9s cubic-bezier(.16,1,.3,1);transform:scaleX(" + (S.pronto ? 1 : 0) + ")",
        })),
      })),
      crossTxt: naoTem.length ? e.nome + " ainda não tem " + naoTem.map((k) => FAM[k].l).join(" nem ") + ". Abra um cross-sell no Pipeline." : "A conta já tem todas as famílias.",
      saude, stripe, fin,
      pessoasTop: pessoas.slice(0, 4), pessoas,
      pesVerTodas: pessoas.length > 4 ? "Ver todas as " + pessoas.length + " pessoas" : "Ver pessoas da conta",
      pesSub: pessoas.length ? pessoas.length + (pessoas.length > 1 ? " pessoas" : " pessoa") + (principal ? " · contato principal: " + principal.nome : "") : "Nenhuma pessoa cadastrada na empresa",
      ctr, emp,
      hist: { top: evRow(ev.slice(0, 6)), lista: evRow(evF), vazia: !evF.length,
        filtros: HF.map(([k, l]) => ({ l, n: String(k === "todos" ? ev.length : ev.filter((x) => x.cat === k).length), onClick: () => setS({ histF: k }),
          style: "display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9999px;border:0;cursor:pointer;font-size:12.5px;font-weight:600;" + (S.histF === k ? "background:var(--of-tinta-forte);color:var(--of-papel)" : "background:var(--of-papel);color:var(--of-tinta);box-shadow:inset 0 0 0 1px var(--of-linha)") })) },
      prox, semProx: !prox.length,
      docs: {
        ...v.docs,
        sub: docsTodos.length + (docsTodos.length === 1 ? " documento" : " documentos") + " · enviados aqui e anexos do histórico (Zoho)",
        enviar: (ev2: any) => {
          const arqs: File[] = Array.from(ev2?.target?.files ?? []);
          if (ev2?.target) ev2.target.value = "";
          if (!arqs.length) return;
          void (async () => {
            let enviados = 0;
            for (const f of arqs) {
              const fd = new FormData(); fd.append("file", f);
              const r = await fetch("/api/clientes/" + e.id + "/documentos", { method: "POST", body: fd }).catch(() => null);
              if (r?.ok) enviados++; else toast.error(f.name + ": " + ((await r?.json().catch(() => ({})))?.error ?? "não foi possível enviar"));
            }
            if (enviados) { toast.success(enviados > 1 ? enviados + " documentos enviados" : "Documento enviado"); P.refresh?.(); }
          })();
        },
        vazia: !docsF.length,
        lista: docsF.map(({ a, cat, ext }) => ({
          nome: a.nome, meta: [a.criadoEm ? dmy(dt(a.criadoEm)) : null, tamanho(a.tamanhoBytes), a.disponivel ? null : "arquivo indisponível neste ambiente"].filter(Boolean).join(" · "),
          cat, ext, abrir: () => abrirAnexo(a), acao: a.disponivel ? "Abrir" : "Registro",
          icoSt: "flex:0 0 auto;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:9px;font-weight:800;letter-spacing:.02em;" + (ext === "PDF" ? "background:var(--of-coral-fundo);color:var(--of-coral-acao-hover)" : "background:var(--of-calha);color:var(--of-tinta)"),
          removivel: a.origem === "upload", remTxt: S.rem === a.id ? "Remover?" : "✕",
          remStyle: "flex:0 0 auto;height:28px;min-width:28px;padding:0 8px;border-radius:7px;border:0;cursor:pointer;font-size:11.5px;font-weight:600;" + (S.rem === a.id ? "background:var(--of-coral-acao);color:var(--of-papel)" : "background:transparent;color:var(--of-tinta-3)"),
          remover: () => { if (S.rem !== a.id) return setS({ rem: a.id }); setS({ rem: null }); void rodar(acaoRemoverDocumentoDoCliente(e.id, a.id), a.nome + " removido"); },
        })),
      },
      nv: v.nv?.aberto ? {
        ...v.nv,
        alvoS: (desde ? "Cliente desde " + dExt(desde) + " · " : "") + brl(mrr) + "/mês",
        tipos: (v.nv.tipos ?? []).map((t: any, i: number) => ({ ...t, ctx: [
          fams[0]?.itens[0] ? "Hoje: " + fams[0].itens[0].qtd + " × " + fams[0].itens[0].nome : "",
          (fams[0]?.itens ?? []).map((x) => x.nome).slice(0, 2).join(" + "),
          naoTem.length ? "Ainda não tem: " + naoTem.map((k) => FAM[k].l).join(", ") : "Já tem todas as famílias",
          proxRen ? "Vence em " + diasAte(proxRen.d!) + " dias · " + dmy(proxRen.d) : "Sem data de vencimento",
        ][i] ?? t.ctx })),
        efeitos: (v.nv.efeitos ?? []).map((x: any, i: number) => i === 1 && !/Novo contrato/.test(x.t) ? { ...x, s: "Ao ganhar, altera a assinatura atual no Stripe" } : x),
        contatos: pessoasReais.map((p) => { const on = S.modal?.contato === p.nome; return { nome: p.nome, cargo: [p.cargo, rotuloPapel(p.papel)].filter(Boolean).join(" · "), onClick: () => setS({ modal: { ...S.modal, contato: p.nome, erro: "" } }),
          style: "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:11px;border:0;cursor:pointer;background:var(--of-papel);box-shadow:inset 0 0 0 " + (on ? "1.5px var(--of-tinta-forte)" : "1px var(--of-linha)"), radio: radio(on) }; }),
        equipe: R.equipe,
      } : v.nv,
      // O visualizador de documento gerado e a baixa manual não abrem mais
      // (nenhum caminho da tela leva a eles), e o placeholder do modal de
      // pessoa deixa de sugerir o domínio inventado.
      mD: { aberto: false, linhas: [], assin: [] },
      mB: { aberto: false, formas: [] },
      /* Nota e "adicionar pessoa" davam toast de "salvo" e o Proto descartava
         (gravar do Cliente 360 não tem command): dois toasts contraditórios e o
         dado sumia. Neutraliza o salvar com aviso honesto, igual às outras. */
      nota: v.nota ? { ...v.nota, salvar: () => { const t = String(S.nota ?? "").trim(); if (!t) return; void rodar(acaoNotaDoCliente(e.id, t), "Nota salva no histórico").then((ok) => { if (ok) setS({ nota: "", histF: "todos" }); }); } } : v.nota,
      mP: v.mP?.aberto ? { ...v.mP, phEmail: e.dominio ? "nome@" + e.dominio : "nome@empresa.com.br",
        salvar: () => {
          const M = S.modal ?? {};
          if (!String(M.nome ?? "").trim()) return setS({ modal: { ...M, erro: "Informe o nome." } });
          void acaoAdicionarPessoaAoCliente(e.id, { nome: M.nome, cargo: M.cargo, email: M.email, telefone: M.tel, papel: M.papel }).then((r) => {
            if (!r.ok) return setS({ modal: { ...M, erro: r.erro } });
            setS({ modal: null }); toast.success(String(M.nome).trim() + " agora faz parte da conta"); P.refresh?.();
          });
        } } : v.mP,
    };
  }
}

/* ── O seed no formato do protótipo ─────────────────────────────────────── */

function clienteDoSeed(R: ClienteDoDesenho) {
  const desde = dt(R.clienteDesde) ?? dt([...R.contratos.map((c) => c.inicio), ...R.iniciosDeAssinatura.map((a) => a.inicio)].filter(Boolean).sort()[0]) ?? new Date();
  const porFam = new Map<string, number>();
  for (const s of R.servicos) porFam.set(s.familia, (porFam.get(s.familia) ?? 0) + s.valor);
  // O Liga exige `produto` numa das três famílias (lê FAM[produto].l). A
  // escolha só alimenta o miolo do protótipo, que esta tela substitui.
  const produto = [...porFam.entries()].filter(([k]) => PK.includes(k)).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "CALLFACE_AI";
  return {
    id: R.empresa.id, nome: R.empresa.nome,
    inicio: desde.getFullYear() + "-" + pad(desde.getMonth() + 1), fim: null,
    mrr: R.servicos.reduce((a, s) => a + s.valor, 0), saude: R.health?.score ?? 0,
    produto, status: R.fulfillmentAberto ? "Em implantação" : "Ativo",
    segmento: R.empresa.setor ?? "", resp: R.closer ?? "", ultima: "",
  };
}

/* ── A tela ─────────────────────────────────────────────────────────────── */

export function ClienteProto({ cliente, usoCallfaceAi }: { cliente: ClienteDoDesenho; usoCallfaceAi?: UsoCallfaceAiDoCliente }) {
  const router = useRouter();
  const raiz = React.useRef<HTMLDivElement>(null);
  const seed = React.useMemo(() => clienteDoSeed(cliente), [cliente]);

  const ordenarEquipe = useOrdemDaEquipe();
  const catalogo = React.useMemo(() => ({
    ClientesSeed: [seed],
    // Pessoas reais como "lead" da empresa: é o que faz o principal interno
    // do protótipo ser alguém real em vez do POOL (usado no modal de opp).
    LEADS: cliente.empresa.pessoas.map((p) => ({ id: p.id, empresa: cliente.empresa.nome, pessoa: p.nome, cargo: p.cargo ?? "", email: p.email, tel: p.telefone })),
    OPORTUNIDADES: [],
    HistoricoSeed: [],
    EQUIPE: ordenarEquipe(cliente.equipe),
    // Obrigatórios com ESTA forma: o Liga faz `(Agenda ?? []).itens()` e
    // `(Relacoes ?? [])({...})` — `[]` é truthy e a tela cairia com TypeError.
    Agenda: { itens: () => [] },
    Relacoes: () => ({
      itens: [
        ...cliente.empresa.oportunidades.filter((o) => o.etapa !== "ganho" && o.etapa !== "perdido").map((o) => ({
          k: "opp", tipo: "Oportunidade", titulo: o.titulo, sub: [o.etapaRotulo, o.responsavel].filter(Boolean).join(" · "),
          status: o.etapaRotulo, ir: () => router.push("/pipeline/" + o.id),
        })),
        ...cliente.empresa.propostas.filter((p) => !PROPOSTA_FINAL.has(p.status)).map((p) => ({
          k: "proposta", tipo: "Proposta", titulo: "#" + p.numero + " v" + p.versao, sub: p.total != null ? brl(p.total) : "sem valor",
          status: p.status, ir: () => router.push("/propostas/" + p.id),
        })),
      ],
    }),
  }), [seed, cliente, router, ordenarEquipe]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: unknown) => {
    abrirPeca(peca, id, { tela: "cliente", empresaId: cliente.empresa.id, empresa: cliente.empresa.nome });
  }, [abrirPeca, cliente.empresa.id, cliente.empresa.nome]);

  /* O id falso que o desenho cria → o id real do negócio gravado.
     A Liga monta a oportunidade localmente com `"o" + Date.now()` e, 350 ms
     depois, navega para esse id. Sem a tradução, o vendedor cairia num 404
     logo após criar. */
  const idsReais = React.useRef<Map<string, string>>(new Map());

  /**
   * A modal "Nova oportunidade" passa a gravar.
   *
   * Ela já existia e montava o objeto certo na tela, mas aqui a resposta era
   * "isto ainda não grava pelo Cliente 360" — o vendedor saía achando que
   * tinha criado. As outras mutações do Cliente 360 (nota, CS, pessoa,
   * documento) continuam sem command, e para elas o aviso segue honesto.
   */
  const gravar = React.useCallback(async (patch: { opps?: { id: string; tipo?: string; familia?: string; resp?: string; itens?: { valor?: number }[]; notas?: { texto?: string }[]; pessoa?: string }[] }) => {
    const nova = patch?.opps?.find((o) => o.id?.startsWith("o") && !idsReais.current.has(o.id));
    // Sem oportunidade nova no patch: é só o espelho de histórico local do protótipo
    // (`clientes360`). Todas as escritas reais da tela têm command próprio; não há o que gravar.
    if (!nova) return;

    /* O desenho chama cross-sell de "nova" no campo `tipo`; o que distingue é
       a família ser uma que o cliente ainda não tem. Renovação vem com o
       próprio nome. */
    const tipo: TipoDeVenda = nova.tipo === "expansao" ? "expansao"
      : nova.tipo === "upgrade" ? "upgrade"
      : nova.tipo === "renovacao" ? "renovacao"
      : "crosssell";

    const pessoa = cliente.empresa.pessoas.find((p) => p.nome === nova.pessoa);
    /* Responsável fica com quem criou. O desenho oferece escolher o closer,
       mas a camada de dados entrega a equipe só como lista de NOMES, e
       adivinhar o usuário por nome erraria em homônimo e em quem mudou de
       nome. Quem cria assume, e a reatribuição é um clique no Pipeline. */
    const valor = nova.itens?.[0]?.valor;

    /* Upgrade e downgrade TROCAM um serviço: o servidor precisa saber qual, senão
       soma e deixa pendência de substituição. O desenho da modal só oferece a
       família, então aqui resolvemos pelo que está na tela: família com UM serviço
       recorrente ativo não tem dúvida. Com mais de um, não adivinhamos — avisamos
       quem está vendendo, com os candidatos pelo nome. */
    const daFamilia: typeof cliente.servicos = tipo === "upgrade"
      ? cliente.servicos.filter((sv) => (sv.familia ?? "") === (nova.familia ?? "") && sv.valor > 0)
      : [];
    const servicoOrigemId = daFamilia.length === 1 ? daFamilia[0].id : null;

    const r = await acaoNovaOportunidadeDoCliente({
      empresaId: cliente.empresa.id,
      tipo,
      familia: nova.familia ?? "",
      responsavelId: null,
      pessoaId: pessoa?.id ?? null,
      valorEstimado: valor ? String(valor) : null,
      observacao: nova.notas?.[0]?.texto ?? null,
      servicoOrigemId,
    });

    if (!r.ok) {
      toast.error(r.erro);
      router.refresh();
      return;
    }
    idsReais.current.set(nova.id, r.negocioId);
    toast.success(`${r.titulo} criada no Pipeline.`);
    if (daFamilia.length > 1) {
      toast.warning(
        `Esta família tem ${daFamilia.length} serviços ativos, então o sistema não sabe qual este ${tipo} substitui: ` +
        `${daFamilia.map((sv) => sv.produtoReal ?? sv.produto ?? sv.familia).join(", ")}. Diga qual na proposta, senão o novo soma ao antigo e o MRR conta os dois.`,
        { duration: 14000 },
      );
    }
    router.refresh();
  }, [cliente.empresa.id, cliente.empresa.pessoas, router]);

  /** Troca o id falso pelo real antes de navegar. */
  const ir = React.useCallback((href: string) => {
    let destino = href;
    for (const [falso, real] of idsReais.current) {
      if (destino.includes(falso)) destino = destino.split(falso).join(real);
    }
    router.push(destino);
  }, [router]);

  return (
    <div data-workspace="desenho" ref={raiz}>
      <ClienteLigada
        real={cliente}
        raiz={raiz}
        usoCallfaceAi={usoCallfaceAi}
        dados={{ leads: catalogo.LEADS, opps: [] }}
        catalogo={catalogo}
        abrir={abrir}
        gravar={gravar}
        refresh={() => router.refresh()}
        abrirExterno={(u: string) => window.open(u, "_blank", "noopener")}
        ir={ir}
      />
    </div>
  );
}
