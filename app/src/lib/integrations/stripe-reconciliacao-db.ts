/**
 * Reconciliação Stripe ↔ ONFACE — as pontas de I/O. A regra está em
 * `stripe-reconciliacao.ts` (pura, com teste); aqui só se LÊ o Stripe (GET, chave
 * restrita de leitura), LÊ o banco e, com `aplicar`, escreve a execução.
 *
 * `aplicar` faz duas coisas, e só estas:
 *   1. roda o `syncStripe` da organização (o mesmo job de 30 em 30 min), que
 *      traz do Stripe o que falta e corrige estado e valor — o Stripe é a
 *      autoridade;
 *   2. compara de novo e registra o que o sync NÃO resolve como caso aberto em
 *      `billing_resolution_cases` (fila `REVIEW`, motivo `RECONCILIACAO_STRIPE` na evidência), dentro de uma
 *      execução em `billing_audit_runs`. Uma pessoa decide; nada é apagado.
 * Sem `aplicar` não escreve em lugar nenhum.
 */
import { sql } from "drizzle-orm";
import { montarCaso } from "./stripe-caso-cobranca";
import { db } from "../db";
import { ehCustomerDoSaas, type CustomerStripe } from "./stripe-customer";
import {
  reconciliar, type AssinaturaStripe, type Divergencia, type FaturaStripe, type RelatorioReconciliacao,
  type SnapshotOnface, type SnapshotStripe,
} from "./stripe-reconciliacao";

const STRIPE_API = "https://api.stripe.com/v1";
const linhas = <T>(r: unknown) => r as unknown as T[];
type Obj = Record<string, unknown>;

async function leitura<T>(path: string, params: Record<string, string>): Promise<{ data: T[]; has_more: boolean }> {
  const key = process.env.STRIPE_API_KEY;
  if (!key) throw new Error("STRIPE_API_KEY não configurada (use uma chave restrita de LEITURA)");
  const url = new URL(`${STRIPE_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Stripe GET ${path}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

/** Todas as páginas. Falha ALTO se estourar o teto: relatório sobre dado cortado é pior que nenhum. */
async function todas<T extends { id: string }>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const itens: T[] = [];
  let depois: string | undefined;
  for (let i = 0; i < 1000; i++) {
    const p = await leitura<T>(path, { ...params, limit: "100", ...(depois ? { starting_after: depois } : {}) });
    itens.push(...p.data);
    if (!p.has_more) return itens;
    depois = p.data[p.data.length - 1].id;
  }
  throw new Error(`Stripe ${path}: paginação passou de 1000 páginas`);
}

/** Mesma conta do `mrrOf` do sync: preço × quantidade ÷ meses do intervalo. */
export function mrrDeAssinatura(sub: Obj): number {
  const itens = ((sub.items as { data?: Obj[] } | undefined)?.data ?? []);
  const MESES: Record<string, number> = { month: 1, year: 12, week: 0.25, day: 1 / 30 };
  let mrr = 0;
  for (const it of itens) {
    const preco = it.price as { unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null } | undefined;
    if (!preco?.recurring || !preco.unit_amount) continue;
    const meses = (MESES[preco.recurring.interval ?? "month"] ?? 1) * (preco.recurring.interval_count || 1);
    mrr += (preco.unit_amount / 100) * ((it.quantity as number | undefined) || 1) / meses;
  }
  return Math.round(mrr * 100) / 100;
}

const idDe = (v: unknown): string | null => (typeof v === "string" ? v : v && typeof v === "object" && typeof (v as Obj).id === "string" ? (v as Obj).id as string : null);

export async function lerStripe(): Promise<SnapshotStripe> {
  const subs = await todas<Obj & { id: string }>("subscriptions", { status: "all", "expand[]": "data.customer" });
  const customersDoSaaS = new Set<string>();
  const assinaturas: AssinaturaStripe[] = subs.map((s) => {
    const c = s.customer as CustomerStripe | string;
    const customerId = idDe(c);
    if (customerId && typeof c === "object" && ehCustomerDoSaas(c)) customersDoSaaS.add(customerId);
    return { id: s.id, customerId, status: String(s.status), mrr: mrrDeAssinatura(s), metadata: (s.metadata as Obj) ?? {} };
  });
  const faturasBrutas = await todas<Obj & { id: string }>("invoices", {});
  const faturas: FaturaStripe[] = faturasBrutas.map((f) => ({
    id: f.id, customerId: idDe(f.customer),
    subscriptionId: idDe(f.subscription) ?? idDe(((f.parent as Obj | undefined)?.subscription_details as Obj | undefined)?.subscription),
    status: String(f.status), amountDue: Number(f.amount_due ?? 0), amountPaid: Number(f.amount_paid ?? 0),
    moeda: String(f.currency ?? "brl"), bruto: f,
  }));
  return { assinaturas, faturas, customersDoSaaS };
}

export async function lerOnface(organizacaoId: string): Promise<SnapshotOnface> {
  const subs = linhas<{ id: string; status: string; mrr: string | null }>(await db.execute(sql`
    SELECT stripe_subscription_id AS id, status, mrr::text FROM assinaturas WHERE organizacao_id = ${organizacaoId}::uuid`));
  const faturas = linhas<{ id: string; status: string; valor: string }>(await db.execute(sql`
    SELECT external_id AS id, status, valor::text FROM faturas
     WHERE organizacao_id = ${organizacaoId}::uuid AND origem = 'stripe' AND external_id IS NOT NULL`));
  const pagamentos = linhas<{ fatura: string | null; status: string; valor: string; ext: string | null }>(await db.execute(sql`
    SELECT f.external_id AS fatura, p.status, p.amount::text AS valor, p.external_payment_id AS ext
      FROM pagamentos p JOIN faturas f ON f.id = p.fatura_id
     WHERE p.organizacao_id = ${organizacaoId}::uuid AND p.provider = 'stripe' AND f.origem = 'stripe'`));
  return {
    assinaturas: subs.map((s) => ({ stripeSubscriptionId: s.id, status: s.status, mrr: s.mrr == null ? null : Number(s.mrr) })),
    faturas: faturas.map((f) => ({ externalId: f.id, status: f.status, valor: Number(f.valor) })),
    pagamentos: pagamentos.map((p) => ({ faturaExternalId: p.fatura, status: p.status, valor: Number(p.valor), externalPaymentId: p.ext })),
  };
}

export interface ResultadoReconciliacao {
  antes: RelatorioReconciliacao;
  /** Só com `aplicar`. */
  depois?: RelatorioReconciliacao;
  execucaoId?: string;
  casosAbertos?: number;
  sync?: unknown;
}

export async function reconciliarOrganizacao(organizacaoId: string, opcoes: { aplicar: boolean } = { aplicar: false }): Promise<ResultadoReconciliacao> {
  const stripe = await lerStripe();
  const antes = reconciliar(stripe, await lerOnface(organizacaoId));
  if (!opcoes.aplicar) return { antes };

  const { syncStripe } = await import("./stripe-sync");
  const sync = await syncStripe(organizacaoId);
  const { recalcularRecebiveis } = await import("./stripe-financeiro-efeitos");
  await recalcularRecebiveis(organizacaoId);

  const depois = reconciliar(stripe, await lerOnface(organizacaoId));
  const [exec] = linhas<{ id: string }>(await db.execute(sql`
    INSERT INTO billing_audit_runs (organizacao_id, scope, status, summary, finished_at)
    VALUES (${organizacaoId}::uuid, ${JSON.stringify({ fonte: "reconciliar-stripe-onface" })}::jsonb, 'DONE',
            ${JSON.stringify({ antes: antes.porTipo, depois: depois.porTipo, totaisDepois: depois.totais, sync })}::jsonb, now())
    RETURNING id::text`));
  let abertos = 0;
  for (const d of depois.divergencias) abertos += await abrirCaso(organizacaoId, exec.id, d);
  return { antes, depois, execucaoId: exec.id, casosAbertos: abertos, sync };
}

/** Um caso por divergência, sem repetir enquanto o anterior estiver aberto. */
async function abrirCaso(organizacaoId: string, execucaoId: string, d: Divergencia): Promise<number> {
  // Fila e organização passam pela mesma validação do webhook: o CHECK do banco só aceita CONFIRMED/REVIEW/CONFLICT.
  const caso = montarCaso({
    organizacaoId, motivo: "RECONCILIACAO_STRIPE", stripeCustomerId: d.customerId, stripeSubscriptionId: d.id.startsWith("sub_") ? d.id : null,
    evidence: { ...d }, recommendedAction: { acao: "revisar_divergencia", porque: d.detalhe, stripeEhAutoridade: true },
  });
  const r = linhas<{ id: string }>(await db.execute(sql`
    INSERT INTO billing_resolution_cases (audit_run_id, organizacao_id, queue, stripe_customer_id, stripe_subscription_id, evidence, recommended_action)
    SELECT ${execucaoId}::uuid, ${caso.organizacaoId}::uuid, ${caso.queue}, ${caso.stripeCustomerId}, ${caso.stripeSubscriptionId},
           ${JSON.stringify(caso.evidence)}::jsonb, ${JSON.stringify(caso.recommendedAction)}::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM billing_resolution_cases c
        WHERE c.organizacao_id = ${organizacaoId}::uuid AND c.queue = 'REVIEW' AND c.status = 'OPEN'
          AND c.evidence->>'motivo' = 'RECONCILIACAO_STRIPE'
          AND c.evidence->>'id' = ${d.id} AND c.evidence->>'tipo' = ${d.tipo} AND c.evidence->>'objeto' = ${d.objeto})
    RETURNING id::text`));
  return r.length;
}
