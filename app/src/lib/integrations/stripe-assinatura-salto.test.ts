/**
 * Mudança de quantidade/preço de assinatura: o rastro e a regra do alerta.
 *
 * Caso real que originou isto (14/10/2026, evt_1UQRZQEd4dqxpSBfpUYMXgIC):
 * o item `si_U0CUFkEmcVhr40` da Auvo Tecnologia foi de quantidade 1 para 24 a
 * R$ 2.799,90 o unitário — a cobrança do ciclo saiu de R$ 3.159,50 para
 * R$ 67.557,20 — e a timeline registrou só "Upgrade de assinatura: R$ 3.159,50
 * → R$ 67.557,20/mês": nenhuma quantidade, nenhuma origem, nenhum aviso.
 *
 * Payload falso no shape do real (basil): sem banco, sem Redis, sem chave.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  descreverEventoFinanceiro, saltoDeCobranca, origemDaMudanca, totalDosItens,
  LIMITE_SALTO_FATOR, LIMITE_SALTO_CENTAVOS,
} from "./stripe-financeiro";

const item = (id: string, quantidade: number, unit: number, nickname: string | null = null) => ({
  id, object: "subscription_item", quantity: quantidade,
  price: { id: `price_${id}`, unit_amount: unit, currency: "brl", nickname, recurring: { interval: "month" } },
});

/** A assinatura da Auvo: licença White Label (quantidade alterada) + 4 assentos do Starter. */
const assinatura = (quantidadeLicenca: number) => ({
  id: "sub_1T2C5VEd4dqxpSBfZzKjsv59", object: "subscription", customer: "cus_U0CUewd9n2A2TB", status: "active",
  items: { object: "list", data: [
    item("si_U0CUFkEmcVhr40", quantidadeLicenca, 279990),
    item("si_Uda0QciNuE5rSq", 4, 8990, "Callface AI - Starter — Mensal"),
  ] },
});

const eventoDeQuantidade = (de: number, para: number, request: unknown = { id: "req_qVuzwqjWuNm5ci", idempotency_key: "stripe-node-retry-6486db1c" }) => ({
  id: "evt_1UQRZQEd4dqxpSBfpUYMXgIC", type: "customer.subscription.updated", created: 1760445973,
  livemode: true, request,
  data: { object: assinatura(para), previous_attributes: { items: assinatura(de).items } },
});

/* ── A regra do alerta ─────────────────────────────────────────────────── */

test("salto anormal exige dobrar E acréscimo relevante — os dois", () => {
  // O caso da Auvo: 21× e +R$ 64.397,70. Alerta.
  const auvo = saltoDeCobranca(315950, 6755720);
  assert.equal(auvo.anormal, true);
  assert.equal(auvo.deltaCentavos, 6439770);
  assert.ok(auvo.fator! > 21);

  // Dobra, mas o acréscimo é pequeno: um assento do Starter virando dois.
  // Sem o piso, todo cliente pequeno dispararia alerta e o aviso viraria ruído.
  const pequeno = saltoDeCobranca(8990, 17980);
  assert.ok(pequeno.fator! >= LIMITE_SALTO_FATOR, "dobrou");
  assert.equal(pequeno.anormal, false, "acréscimo abaixo do piso: não alerta");

  // Acréscimo grande, mas sem dobrar: expansão normal de conta grande
  // (28 → 29 assentos, o evento seguinte da própria Auvo).
  const expansao = saltoDeCobranca(6755720, 6764710);
  assert.ok(expansao.deltaCentavos > 0);
  assert.equal(expansao.anormal, false, "não dobrou: expansão normal, não alerta");

  // Um acréscimo grande que também dobra: alerta, mesmo sem mudar quantidade.
  assert.equal(saltoDeCobranca(100000, 300000).anormal, true);

  // Exatamente no limite não alerta: o limite é "mais que dobrar".
  assert.equal(saltoDeCobranca(500000, 1000000).anormal, false, `fator exatamente ${LIMITE_SALTO_FATOR}`);
  assert.equal(saltoDeCobranca(500000, 1000001).anormal, true);

  // Delta exatamente no piso, dobrando: alerta (o piso é inclusivo).
  assert.equal(saltoDeCobranca(LIMITE_SALTO_CENTAVOS, LIMITE_SALTO_CENTAVOS * 2 + 1).anormal, true);

  // Queda nunca é salto.
  assert.equal(saltoDeCobranca(6755720, 315950).anormal, false);
  assert.equal(saltoDeCobranca(6755720, 315950).deltaCentavos < 0, true);

  // Sem valor anterior não há fator; o piso decide sozinho.
  const deZero = saltoDeCobranca(0, 6755720);
  assert.equal(deZero.fator, null);
  assert.equal(deZero.anormal, true);
  assert.equal(saltoDeCobranca(0, 5000).anormal, false, "de zero, mas abaixo do piso");
  assert.equal(saltoDeCobranca(0, 0).anormal, false);
});

/* ── O rastro ──────────────────────────────────────────────────────────── */

test("alteração de quantidade deixa rastro com antes, depois, item e origem", () => {
  const f = descreverEventoFinanceiro(eventoDeQuantidade(1, 24))!;
  assert.equal(f.tipo, "SubscriptionUpgraded");

  // O título diz a QUANTIDADE, não só o total do ciclo. Era isso que faltava.
  assert.match(f.titulo, /quantidade 5 → 28/, `título: ${f.titulo}`);
  assert.match(f.titulo, /R\$ 3\.159,50 → R\$ 67\.557,20\/mês/);

  // O item que mudou é nomeado, com unitário e quantidade.
  assert.match(f.descricao!, /quantidade 1 → 24 a R\$ 2\.799,90 cada/, `descrição: ${f.descricao}`);
  // O item parado não aparece como alterado.
  assert.doesNotMatch(f.descricao!, /Starter.*quantidade 4 → 4/);

  // A origem que o Stripe informa, e o alerta na própria descrição.
  assert.match(f.descricao!, /SDK da Stripe \(não foi pelo ONFACE\)/);
  assert.match(f.descricao!, /requisição req_qVuzwqjWuNm5ci/);
  assert.match(f.descricao!, /Salto anormal/);

  // O contexto guarda os números crus, para auditoria e para o alerta do processador.
  assert.equal(f.contexto.valorAnteriorCentavos, 315950);
  assert.equal(f.contexto.valorNovoCentavos, 6755720);
  assert.equal(f.contexto.quantidadeAnterior, 5);
  assert.equal(f.contexto.quantidadeNova, 28);
  assert.equal(f.contexto.origem, "integracao_externa");
  assert.equal(f.contexto.stripeRequestId, "req_qVuzwqjWuNm5ci");
  assert.equal((f.contexto.salto as { anormal: boolean }).anormal, true);
  assert.equal((f.contexto.itensNovos as { quantidade: number }[])[0].quantidade, 24);
  assert.equal((f.contexto.itensAnteriores as { quantidade: number }[])[0].quantidade, 1);
  assert.equal(f.subscriptionId, "sub_1T2C5VEd4dqxpSBfZzKjsv59");
});

test("quantidade que muda sem mexer no total ainda deixa rastro", () => {
  // Um item a mais e outro a menos, mesmo valor: antes caía em "Itens da
  // assinatura alterados" sem número nenhum.
  const antes = { object: "list", data: [item("si_a", 2, 10000)] };
  const depois = { object: "list", data: [item("si_a", 4, 5000)] };
  const f = descreverEventoFinanceiro({
    id: "evt_x", type: "customer.subscription.updated", created: 1760445973, request: null,
    data: { object: { id: "sub_x", object: "subscription", customer: "cus_x", items: depois }, previous_attributes: { items: antes } },
  })!;
  assert.equal(f.tipo, "SubscriptionUpdated");
  assert.match(f.titulo, /Quantidade da assinatura: 2 → 4/);
  assert.match(f.descricao!, /automaticamente pelo Stripe/);
  assert.equal((f.contexto.salto as { anormal: boolean }).anormal, false, "mesmo total: nada a alertar");
});

test("renovação não inventa alteração de itens", () => {
  // Toda renovação reentrega os itens (muda current_period_*). Isso virava uma
  // linha "Itens da assinatura alterados" na timeline de todo cliente, todo mês.
  const f = descreverEventoFinanceiro({
    id: "evt_renov", type: "customer.subscription.updated", created: 1760445973,
    request: { id: null, idempotency_key: null },
    data: { object: assinatura(1), previous_attributes: { items: assinatura(1).items } },
  });
  assert.equal(f, null);
});

/* ── Origem ────────────────────────────────────────────────────────────── */

test("origem da mudança segundo o Stripe", () => {
  assert.equal(origemDaMudanca({ request: { id: null, idempotency_key: null } }).origem, "stripe_automatico");
  assert.equal(origemDaMudanca({}).origem, "stripe_automatico");
  assert.equal(origemDaMudanca({ request: { id: "req_1", idempotency_key: "onface-assin-abc" } }).origem, "onface");
  assert.equal(origemDaMudanca({ request: { id: "req_1", idempotency_key: "stripe-node-retry-abc" } }).origem, "integracao_externa");
  // Dashboard do Stripe: há requisição, sem chave de idempotência.
  assert.equal(origemDaMudanca({ request: { id: "req_1", idempotency_key: null } }).origem, "api_ou_dashboard");
  assert.match(origemDaMudanca({ request: { id: "req_1", idempotency_key: "onface-assin-abc" } }).rotulo, /auditoria/);
});

test("totalDosItens soma quantidade e detalha por item", () => {
  const t = totalDosItens(assinatura(24).items)!;
  assert.equal(t.centavos, 279990 * 24 + 8990 * 4);
  assert.equal(t.quantidade, 28);
  assert.equal(t.itens.length, 2);
  assert.equal(t.itens[0].unitCentavos, 279990);
  assert.equal(t.itens[0].centavos, 279990 * 24);
  assert.equal(t.intervalo, "month");
  assert.equal(totalDosItens({ data: [] }), null);
  assert.equal(totalDosItens(undefined), null);
});
