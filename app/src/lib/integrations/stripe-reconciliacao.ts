/**
 * Reconciliação Stripe ↔ ONFACE — regra PURA (sem rede, sem banco).
 *
 * O webhook é o fluxo principal; esta é a rede de proteção: compara o que o
 * Stripe diz com o que o ONFACE gravou e lista as divergências POR TIPO:
 *
 *   so_no_stripe     existe no Stripe e não no ONFACE
 *   so_no_onface     existe no ONFACE (origem stripe) e o Stripe não conhece
 *   valor_diferente  existe nos dois, o valor não bate
 *   status_diferente existe nos dois, o estado não bate
 *
 * sobre três objetos: assinatura, fatura e pagamento. O Stripe é a autoridade
 * para pagamento, fatura e assinatura (definição, item 15): a divergência sempre
 * aponta o que o ONFACE deveria passar a dizer.
 *
 * A conta é COMPARTILHADA com o SaaS Callface: objeto do SaaS fica FORA da
 * comparação e é só contado (`ignoradosSaaS`), nunca listado como divergência.
 */
import { eventoDoSaaS, metadatasDe } from "./stripe-financeiro";

type Obj = Record<string, unknown>;

/* ── Entradas ─────────────────────────────────────────────────────────── */

export interface AssinaturaStripe {
  id: string;
  customerId: string | null;
  status: string;
  /** Receita mensal recorrente em REAIS, calculada como o sync calcula (preço × quantidade ÷ meses do intervalo). */
  mrr: number;
  metadata: Obj;
}

export interface FaturaStripe {
  id: string;
  customerId: string | null;
  subscriptionId: string | null;
  status: string;
  /** Em centavos. */
  amountDue: number;
  amountPaid: number;
  moeda: string;
  /** O objeto inteiro, para reconhecer o SaaS pela metadata das linhas e da assinatura. */
  bruto: Obj;
}

export interface SnapshotStripe {
  assinaturas: AssinaturaStripe[];
  faturas: FaturaStripe[];
  /** Customers que o Stripe marca como do SaaS (`ehCustomerDoSaas`). */
  customersDoSaaS: Set<string>;
}

export interface AssinaturaOnface { stripeSubscriptionId: string; status: string; mrr: number | null }
/** `status`: paga | aberta | falhou | void | uncollectible | rascunho. `valor` em reais. */
export interface FaturaOnface { externalId: string; status: string; valor: number }
/** `faturaExternalId`: o invoice do Stripe a que o pagamento pertence. */
export interface PagamentoOnface { faturaExternalId: string | null; status: string; valor: number; externalPaymentId?: string | null }

export interface SnapshotOnface {
  assinaturas: AssinaturaOnface[];
  /** Só `origem = 'stripe'`: PABX, planilha e proposta ficam fora. */
  faturas: FaturaOnface[];
  pagamentos: PagamentoOnface[];
}

/* ── Saída ────────────────────────────────────────────────────────────── */

export type TipoDivergencia = "so_no_stripe" | "so_no_onface" | "valor_diferente" | "status_diferente";
export type ObjetoReconciliado = "assinatura" | "fatura" | "pagamento";

export interface Divergencia {
  tipo: TipoDivergencia;
  objeto: ObjetoReconciliado;
  /** `sub_…` / `in_…` */
  id: string;
  customerId: string | null;
  /** O que o Stripe diz × o que o ONFACE tem. */
  stripe: string | null;
  onface: string | null;
  /** `alta` mexe em dinheiro vivo (cobrança aberta, assinatura que cobra); `baixa` é histórico. */
  gravidade: "alta" | "media" | "baixa";
  detalhe: string;
}

export interface RelatorioReconciliacao {
  totais: Record<ObjetoReconciliado, { stripe: number; onface: number; casados: number }>;
  porTipo: Record<TipoDivergencia, Record<ObjetoReconciliado, number>>;
  divergencias: Divergencia[];
  ignoradosSaaS: { assinaturas: number; faturas: number };
  /** Rascunhos do Stripe não são recebível e não entram na comparação. */
  rascunhosIgnorados: number;
}

/* ── Regras ───────────────────────────────────────────────────────────── */

const reais = (centavos: number) => centavos / 100;
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const TOLERANCIA = 0.011;
const diferem = (a: number, b: number) => Math.abs(a - b) > TOLERANCIA;

/** Status do Stripe que ainda geram cobrança. */
const COBRA = new Set(["active", "past_due", "trialing", "unpaid"]);

/** Estados equivalentes: a fatura aberta com tentativa falha fica `falhou` no ONFACE e continua `open` no Stripe. */
const FATURA_STATUS: Record<string, string[]> = {
  paid: ["paga"], open: ["aberta", "falhou"], void: ["void"], uncollectible: ["uncollectible"],
};

/** Alguma metadata carrega marca do ONFACE (`crm_*`, `negocioId`, `propostaId`, `organizacaoId`…)? Mesma régua de `eventoDoSaaS`. */
function temMarcaDoOnface(o: Obj): boolean {
  return metadatasDe(o).some((m) => Object.keys(m).some((k) =>
    k.startsWith("crm_") || ["negocioId", "propostaId", "empresaId", "onfaceEmpresaId", "organizacaoId"].includes(k)));
}

export function faturaEhDoSaaS(f: FaturaStripe, subsDoSaaS: Set<string>, customersDoSaaS: Set<string>): boolean {
  if (f.subscriptionId && subsDoSaaS.has(f.subscriptionId)) return true;
  if (eventoDoSaaS(f.bruto)) return true;
  // Sem sub e sem marca na fatura: o dono do Customer decide.
  if (!f.subscriptionId && !temMarcaDoOnface(f.bruto) && f.customerId && customersDoSaaS.has(f.customerId)) return true;
  return false;
}

const vazioPorTipo = (): Record<TipoDivergencia, Record<ObjetoReconciliado, number>> => ({
  so_no_stripe: { assinatura: 0, fatura: 0, pagamento: 0 },
  so_no_onface: { assinatura: 0, fatura: 0, pagamento: 0 },
  valor_diferente: { assinatura: 0, fatura: 0, pagamento: 0 },
  status_diferente: { assinatura: 0, fatura: 0, pagamento: 0 },
});

export function reconciliar(stripe: SnapshotStripe, onface: SnapshotOnface): RelatorioReconciliacao {
  const divergencias: Divergencia[] = [];
  const porTipo = vazioPorTipo();
  const totais = {
    assinatura: { stripe: 0, onface: 0, casados: 0 },
    fatura: { stripe: 0, onface: 0, casados: 0 },
    pagamento: { stripe: 0, onface: 0, casados: 0 },
  };
  const add = (d: Divergencia) => { divergencias.push(d); porTipo[d.tipo][d.objeto]++; };

  /* ── Assinaturas ── */
  const subsDoSaaS = new Set<string>();
  const subsDoOnface: AssinaturaStripe[] = [];
  for (const s of stripe.assinaturas) {
    const doSaaS = eventoDoSaaS({ metadata: s.metadata }) || (!!s.customerId && stripe.customersDoSaaS.has(s.customerId) && !temMarcaDoOnface({ metadata: s.metadata }));
    if (doSaaS) subsDoSaaS.add(s.id); else subsDoOnface.push(s);
  }
  const subLocal = new Map(onface.assinaturas.map((a) => [a.stripeSubscriptionId, a]));
  totais.assinatura.stripe = subsDoOnface.length;
  totais.assinatura.onface = onface.assinaturas.length;
  const subsVistas = new Set<string>();
  for (const s of subsDoOnface) {
    subsVistas.add(s.id);
    const l = subLocal.get(s.id);
    if (!l) {
      add({
        tipo: "so_no_stripe", objeto: "assinatura", id: s.id, customerId: s.customerId, stripe: `${s.status} · MRR ${fmt(s.mrr)}`, onface: null,
        gravidade: COBRA.has(s.status) ? "alta" : "baixa",
        detalhe: COBRA.has(s.status) ? "assinatura que cobra e não está no espelho: o Financeiro e o MRR não a enxergam" : "assinatura encerrada fora do espelho (histórico)",
      });
      continue;
    }
    totais.assinatura.casados++;
    if (l.status !== s.status) {
      add({
        tipo: "status_diferente", objeto: "assinatura", id: s.id, customerId: s.customerId, stripe: s.status, onface: l.status,
        gravidade: COBRA.has(s.status) !== COBRA.has(l.status) ? "alta" : "media",
        detalhe: "o Stripe é a autoridade: o sync (ou um webhook perdido) deixou o estado antigo",
      });
    }
    if (l.mrr != null && diferem(l.mrr, s.mrr)) {
      add({
        tipo: "valor_diferente", objeto: "assinatura", id: s.id, customerId: s.customerId, stripe: `MRR ${fmt(s.mrr)}`, onface: `MRR ${fmt(l.mrr)}`,
        gravidade: COBRA.has(s.status) ? "alta" : "baixa",
        detalhe: "preço, quantidade ou intervalo mudou no Stripe (upgrade, downgrade, alteração direta) e o espelho não acompanhou",
      });
    }
  }
  for (const l of onface.assinaturas) {
    if (subsVistas.has(l.stripeSubscriptionId)) continue;
    if (subsDoSaaS.has(l.stripeSubscriptionId)) {
      add({
        tipo: "so_no_onface", objeto: "assinatura", id: l.stripeSubscriptionId, customerId: null, stripe: "assinatura do SaaS Callface", onface: l.status,
        gravidade: "alta", detalhe: "o espelho do ONFACE guardou uma assinatura que a metadata do Stripe diz ser do SaaS: contamina MRR e carteira",
      });
      continue;
    }
    add({
      tipo: "so_no_onface", objeto: "assinatura", id: l.stripeSubscriptionId, customerId: null, stripe: null, onface: l.status,
      gravidade: "alta", detalhe: "o Stripe não conhece este id (apagada, de test mode ou de outra conta)",
    });
  }

  /* ── Faturas ── */
  const faturasStripe: FaturaStripe[] = [];
  let ignoradasSaaS = 0;
  let rascunhos = 0;
  for (const f of stripe.faturas) {
    if (faturaEhDoSaaS(f, subsDoSaaS, stripe.customersDoSaaS)) { ignoradasSaaS++; continue; }
    if (f.status === "draft") { rascunhos++; continue; }
    faturasStripe.push(f);
  }
  const saasIds = new Set(stripe.faturas.filter((f) => faturaEhDoSaaS(f, subsDoSaaS, stripe.customersDoSaaS)).map((f) => f.id));
  const fatLocal = new Map(onface.faturas.map((f) => [f.externalId, f]));
  totais.fatura.stripe = faturasStripe.length;
  totais.fatura.onface = onface.faturas.length;
  const fatVistas = new Set<string>();
  for (const f of faturasStripe) {
    fatVistas.add(f.id);
    const l = fatLocal.get(f.id);
    const viva = f.status === "open";
    if (!l) {
      add({
        tipo: "so_no_stripe", objeto: "fatura", id: f.id, customerId: f.customerId, stripe: `${f.status} · ${fmt(reais(f.amountDue))}`, onface: null,
        gravidade: viva ? "alta" : f.status === "paid" ? "media" : "baixa",
        detalhe: viva ? "cobrança aberta que o ONFACE não mostra: nem aging nem régua de cobrança a veem" : "fatura histórica fora do espelho (o sync olha só os últimos 60 dias + abertas)",
      });
      continue;
    }
    totais.fatura.casados++;
    const aceitos = FATURA_STATUS[f.status] ?? [];
    if (!aceitos.includes(l.status.toLowerCase())) {
      add({
        tipo: "status_diferente", objeto: "fatura", id: f.id, customerId: f.customerId, stripe: f.status, onface: l.status,
        gravidade: viva || f.status === "paid" ? "alta" : "media",
        detalhe: f.status === "paid" ? "paga no Stripe e ainda cobrável no ONFACE: risco de cobrar quem já pagou" : "o Stripe é a autoridade para o estado da fatura",
      });
    }
    if (diferem(l.valor, reais(f.amountDue))) {
      add({
        tipo: "valor_diferente", objeto: "fatura", id: f.id, customerId: f.customerId, stripe: fmt(reais(f.amountDue)), onface: fmt(l.valor),
        gravidade: "alta", detalhe: "valor devido diferente: fatura refeita, desconto ou pró-rata aplicados depois da cópia",
      });
    }
  }
  for (const l of onface.faturas) {
    if (fatVistas.has(l.externalId) || saasIds.has(l.externalId)) {
      if (saasIds.has(l.externalId)) {
        add({
          tipo: "so_no_onface", objeto: "fatura", id: l.externalId, customerId: null, stripe: "fatura do SaaS Callface", onface: `${l.status} · ${fmt(l.valor)}`,
          gravidade: "alta", detalhe: "o espelho guardou uma fatura do SaaS: entra no recebível do ONFACE por engano",
        });
      }
      continue;
    }
    // Rascunho do Stripe também não está em `faturasStripe`, mas o ONFACE pode ter copiado como `rascunho`: é esperado.
    if (stripe.faturas.some((f) => f.id === l.externalId && f.status === "draft")) continue;
    add({
      tipo: "so_no_onface", objeto: "fatura", id: l.externalId, customerId: null, stripe: null, onface: `${l.status} · ${fmt(l.valor)}`,
      gravidade: "alta", detalhe: "o Stripe não conhece este invoice (apagado ou de outra conta)",
    });
  }

  /* ── Pagamentos: cada fatura paga no Stripe tem de ter um pagamento PAID no mesmo valor ── */
  const pagos = faturasStripe.filter((f) => f.status === "paid" && f.amountPaid > 0);
  const pagosLocais = new Map<string, PagamentoOnface[]>();
  for (const p of onface.pagamentos) {
    if (p.status !== "PAID" || !p.faturaExternalId) continue;
    pagosLocais.set(p.faturaExternalId, [...(pagosLocais.get(p.faturaExternalId) ?? []), p]);
  }
  totais.pagamento.stripe = pagos.length;
  totais.pagamento.onface = onface.pagamentos.filter((p) => p.status === "PAID").length;
  const pagosVistos = new Set<string>();
  for (const f of pagos) {
    pagosVistos.add(f.id);
    const ls = pagosLocais.get(f.id);
    if (!ls?.length) {
      add({
        tipo: "so_no_stripe", objeto: "pagamento", id: f.id, customerId: f.customerId, stripe: `pago ${fmt(reais(f.amountPaid))}`, onface: null,
        gravidade: "media", detalhe: "dinheiro recebido no Stripe sem linha em `pagamentos`: o Recebimento do Financeiro fica abaixo do real",
      });
      continue;
    }
    totais.pagamento.casados++;
    const soma = ls.reduce((t, p) => t + p.valor, 0);
    if (diferem(soma, reais(f.amountPaid))) {
      add({
        tipo: "valor_diferente", objeto: "pagamento", id: f.id, customerId: f.customerId, stripe: fmt(reais(f.amountPaid)), onface: fmt(soma),
        gravidade: "alta", detalhe: ls.length > 1 ? `${ls.length} linhas PAID para a mesma fatura: pagamento duplicado ou parcial` : "valor recebido diferente do que o Stripe pagou",
      });
    }
  }
  for (const [faturaId, ls] of pagosLocais) {
    if (pagosVistos.has(faturaId)) continue;
    const doStripe = stripe.faturas.find((f) => f.id === faturaId);
    if (doStripe && saasIds.has(faturaId)) continue;
    const soma = ls.reduce((t, p) => t + p.valor, 0);
    add(doStripe
      ? {
        tipo: "status_diferente", objeto: "pagamento", id: faturaId, customerId: doStripe.customerId, stripe: `fatura ${doStripe.status}`, onface: `PAID ${fmt(soma)}`,
        gravidade: "alta", detalhe: "o ONFACE registra recebimento de uma fatura que o Stripe não mostra como paga",
      }
      : {
        tipo: "so_no_onface", objeto: "pagamento", id: faturaId, customerId: null, stripe: null, onface: `PAID ${fmt(soma)}`,
        gravidade: "alta", detalhe: "recebimento registrado para um invoice que o Stripe não conhece",
      });
  }

  const peso = { alta: 0, media: 1, baixa: 2 } as const;
  divergencias.sort((a, b) => peso[a.gravidade] - peso[b.gravidade] || a.tipo.localeCompare(b.tipo) || a.id.localeCompare(b.id));
  return {
    totais, porTipo, divergencias,
    ignoradosSaaS: { assinaturas: subsDoSaaS.size, faturas: ignoradasSaaS },
    rascunhosIgnorados: rascunhos,
  };
}

/** Texto para o terminal: contagem por tipo × objeto, e a lista (limitada) por gravidade. */
export function formatarRelatorio(r: RelatorioReconciliacao, limiteLista = 40): string {
  const linhas: string[] = [];
  linhas.push("Objeto       Stripe(ONFACE)  ONFACE  Casados");
  for (const o of ["assinatura", "fatura", "pagamento"] as const) {
    linhas.push(`${o.padEnd(12)} ${String(r.totais[o].stripe).padStart(13)}  ${String(r.totais[o].onface).padStart(6)}  ${String(r.totais[o].casados).padStart(7)}`);
  }
  linhas.push(`Fora da comparação: ${r.ignoradosSaaS.assinaturas} assinatura(s) e ${r.ignoradosSaaS.faturas} fatura(s) do SaaS; ${r.rascunhosIgnorados} rascunho(s).`);
  linhas.push("");
  linhas.push("Divergências por tipo:                 assinatura  fatura  pagamento");
  for (const t of ["so_no_stripe", "so_no_onface", "valor_diferente", "status_diferente"] as const) {
    const p = r.porTipo[t];
    linhas.push(`  ${t.padEnd(34)} ${String(p.assinatura).padStart(8)} ${String(p.fatura).padStart(7)} ${String(p.pagamento).padStart(10)}`);
  }
  linhas.push(`Total: ${r.divergencias.length}`);
  if (r.divergencias.length) {
    linhas.push("");
    for (const d of r.divergencias.slice(0, limiteLista)) {
      linhas.push(`  [${d.gravidade}] ${d.tipo} ${d.objeto} ${d.id}${d.customerId ? ` (${d.customerId})` : ""}  Stripe: ${d.stripe ?? "—"} | ONFACE: ${d.onface ?? "—"}`);
    }
    if (r.divergencias.length > limiteLista) linhas.push(`  … e mais ${r.divergencias.length - limiteLista} (use --limite-lista N ou --json arquivo)`);
  }
  return linhas.join("\n");
}
