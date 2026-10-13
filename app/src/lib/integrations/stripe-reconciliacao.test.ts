/**
 * Regra de reconciliação Stripe ↔ ONFACE com Stripe falso: cada tipo de divergência,
 * o SaaS fora da conta, e o caso saudável sem nenhuma divergência.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatarRelatorio, reconciliar, type AssinaturaStripe, type FaturaStripe, type SnapshotOnface, type SnapshotStripe,
} from "./stripe-reconciliacao";

const ONFACE_META = { negocioId: "3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192", organizacaoId: "320a9052-dd43-4edb-9b74-34be53c5c419" };
const SAAS_META = { organization_id: "o", plan_id: "p", user_id: "u" };

const sub = (id: string, extra: Partial<AssinaturaStripe> = {}): AssinaturaStripe =>
  ({ id, customerId: `cus_${id}`, status: "active", mrr: 179.9, metadata: ONFACE_META, ...extra });
const fat = (id: string, extra: Partial<FaturaStripe> = {}): FaturaStripe => ({
  id, customerId: "cus_1", subscriptionId: "sub_1", status: "paid", amountDue: 17990, amountPaid: 17990, moeda: "brl", bruto: { id, metadata: {} }, ...extra,
});
const stripe = (s: Partial<SnapshotStripe>): SnapshotStripe => ({ assinaturas: [], faturas: [], customersDoSaaS: new Set(), ...s });
const onface = (o: Partial<SnapshotOnface>): SnapshotOnface => ({ assinaturas: [], faturas: [], pagamentos: [], ...o });

test("tudo certo: nenhuma divergência", () => {
  const r = reconciliar(
    stripe({ assinaturas: [sub("sub_1")], faturas: [fat("in_1")] }),
    onface({
      assinaturas: [{ stripeSubscriptionId: "sub_1", status: "active", mrr: 179.9 }],
      faturas: [{ externalId: "in_1", status: "paga", valor: 179.9 }],
      pagamentos: [{ faturaExternalId: "in_1", status: "PAID", valor: 179.9 }],
    }),
  );
  assert.deepEqual(r.divergencias, []);
  assert.deepEqual(r.totais.assinatura, { stripe: 1, onface: 1, casados: 1 });
  assert.deepEqual(r.totais.pagamento, { stripe: 1, onface: 1, casados: 1 });
});

test("existe no Stripe e não no ONFACE: assinatura que cobra é grave, encerrada é histórico; fatura aberta é grave", () => {
  const r = reconciliar(
    stripe({ assinaturas: [sub("sub_viva"), sub("sub_morta", { status: "canceled" })], faturas: [fat("in_aberta", { status: "open", amountPaid: 0, subscriptionId: "sub_viva" }), fat("in_paga", { subscriptionId: "sub_viva" })] }),
    onface({}),
  );
  const por = (t: string, o: string, id: string) => r.divergencias.find((d) => d.tipo === t && d.objeto === o && d.id === id);
  assert.equal(por("so_no_stripe", "assinatura", "sub_viva")?.gravidade, "alta");
  assert.equal(por("so_no_stripe", "assinatura", "sub_morta")?.gravidade, "baixa");
  assert.equal(por("so_no_stripe", "fatura", "in_aberta")?.gravidade, "alta");
  assert.equal(por("so_no_stripe", "fatura", "in_paga")?.gravidade, "media");
  assert.equal(por("so_no_stripe", "pagamento", "in_paga")?.gravidade, "media");
  assert.equal(r.porTipo.so_no_stripe.assinatura, 2);
  assert.equal(r.divergencias[0].gravidade, "alta", "ordenado por gravidade");
});

test("existe no ONFACE e não no Stripe", () => {
  const r = reconciliar(stripe({}), onface({
    assinaturas: [{ stripeSubscriptionId: "sub_fantasma", status: "active", mrr: 10 }],
    faturas: [{ externalId: "in_fantasma", status: "aberta", valor: 10 }],
    pagamentos: [{ faturaExternalId: "in_fantasma", status: "PAID", valor: 10 }],
  }));
  assert.deepEqual([r.porTipo.so_no_onface.assinatura, r.porTipo.so_no_onface.fatura, r.porTipo.so_no_onface.pagamento], [1, 1, 1]);
});

test("valor diferente: MRR da assinatura, valor devido da fatura e valor recebido (inclusive pagamento duplicado)", () => {
  const r = reconciliar(
    stripe({ assinaturas: [sub("sub_1", { mrr: 199.9 })], faturas: [fat("in_1", { amountDue: 19990, amountPaid: 19990 })] }),
    onface({
      assinaturas: [{ stripeSubscriptionId: "sub_1", status: "active", mrr: 179.9 }],
      faturas: [{ externalId: "in_1", status: "paga", valor: 179.9 }],
      pagamentos: [{ faturaExternalId: "in_1", status: "PAID", valor: 199.9 }, { faturaExternalId: "in_1", status: "PAID", valor: 199.9 }],
    }),
  );
  assert.equal(r.porTipo.valor_diferente.assinatura, 1);
  assert.equal(r.porTipo.valor_diferente.fatura, 1);
  assert.equal(r.porTipo.valor_diferente.pagamento, 1);
  assert.match(r.divergencias.find((d) => d.objeto === "pagamento")!.detalhe, /2 linhas PAID/);
});

test("status diferente: assinatura, fatura paga ainda cobrável (grave) e aberta/falhou equivalentes", () => {
  const r = reconciliar(
    stripe({
      assinaturas: [sub("sub_1", { status: "canceled" })],
      faturas: [fat("in_paga"), fat("in_aberta", { status: "open", amountPaid: 0 })],
    }),
    onface({
      assinaturas: [{ stripeSubscriptionId: "sub_1", status: "active", mrr: 179.9 }],
      faturas: [{ externalId: "in_paga", status: "aberta", valor: 179.9 }, { externalId: "in_aberta", status: "falhou", valor: 179.9 }],
      pagamentos: [{ faturaExternalId: "in_paga", status: "PAID", valor: 179.9 }],
    }),
  );
  assert.equal(r.porTipo.status_diferente.assinatura, 1);
  assert.equal(r.divergencias.find((d) => d.tipo === "status_diferente" && d.objeto === "assinatura")!.gravidade, "alta", "cobra no ONFACE e acabou no Stripe");
  const f = r.divergencias.filter((d) => d.tipo === "status_diferente" && d.objeto === "fatura");
  assert.deepEqual(f.map((d) => d.id), ["in_paga"], "open × falhou é equivalente");
  assert.match(f[0].detalhe, /cobrar quem já pagou/);
});

test("objetos do SaaS ficam fora: não viram divergência, só são contados", () => {
  const r = reconciliar(
    stripe({
      assinaturas: [sub("sub_saas", { metadata: SAAS_META }), sub("sub_cliente_saas", { customerId: "cus_saas", metadata: {} })],
      faturas: [
        fat("in_saas", { subscriptionId: "sub_saas", bruto: { id: "in_saas", parent: { subscription_details: { metadata: SAAS_META } } } }),
        fat("in_avulsa_saas", { subscriptionId: null, customerId: "cus_saas" }),
      ],
      customersDoSaaS: new Set(["cus_saas"]),
    }),
    onface({}),
  );
  assert.deepEqual(r.divergencias, []);
  assert.deepEqual(r.ignoradosSaaS, { assinaturas: 2, faturas: 2 });
});

test("SaaS que vazou para o espelho do ONFACE é apontado (contamina MRR e recebível)", () => {
  const r = reconciliar(
    stripe({ assinaturas: [sub("sub_saas", { metadata: SAAS_META })], faturas: [fat("in_saas", { subscriptionId: "sub_saas" })] }),
    onface({ assinaturas: [{ stripeSubscriptionId: "sub_saas", status: "active", mrr: 89.9 }], faturas: [{ externalId: "in_saas", status: "paga", valor: 179.9 }] }),
  );
  assert.equal(r.porTipo.so_no_onface.assinatura, 1);
  assert.equal(r.porTipo.so_no_onface.fatura, 1);
  assert.match(r.divergencias[0].detalhe, /SaaS/);
});

test("rascunho do Stripe não é recebível e não gera divergência; o relatório imprime contagem por tipo", () => {
  const r = reconciliar(stripe({ faturas: [fat("in_rasc", { status: "draft", amountDue: 0, amountPaid: 0 })] }), onface({ faturas: [{ externalId: "in_rasc", status: "rascunho", valor: 0 }] }));
  assert.deepEqual(r.divergencias, []);
  assert.equal(r.rascunhosIgnorados, 1);
  const txt = formatarRelatorio(reconciliar(stripe({ assinaturas: [sub("sub_1")] }), onface({})));
  assert.match(txt, /so_no_stripe\s+1\s+0\s+0/);
  assert.match(txt, /Total: 1/);
});
