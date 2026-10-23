import assert from "node:assert/strict";
import test from "node:test";
import { aplicarAlteracao, ErroDeAlteracao, pagamentoEhAssincrono, pedidoDoStripe, planejarAlteracao } from "./stripe-assinatura-acoes";

/* Stripe falso: nada aqui sai para a rede. Cada teste instala o seu fetch. */
const preco = (id: string, centavos: number, interval = "month") => ({ id, active: true, unit_amount: centavos, recurring: { interval, interval_count: 1 } });
const SUB = (extra: Record<string, unknown> = {}) => ({
  id: "sub_1", status: "active", customer: "cus_1", metadata: { crm_company_id: "e1" },
  items: { data: [{ id: "si_a", quantity: 2, price: preco("price_a", 10000) }, { id: "si_b", quantity: 1, price: preco("price_b", 5000) }] },
  ...extra,
});

function fakeStripe(rotas: Record<string, unknown>) {
  const chamadas: { url: string; method: string; body: string; idem: string | null }[] = [];
  process.env.STRIPE_SECRET_KEY = "sk_test_falso";
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const h = new Headers(init.headers);
    chamadas.push({ url, method: init.method ?? "GET", body: String(init.body ?? ""), idem: h.get("Idempotency-Key") });
    const chave = Object.keys(rotas).find((k) => url.includes(k));
    if (!chave) return new Response("rota inesperada " + url, { status: 500 });
    return new Response(JSON.stringify(rotas[chave]), { status: 200 });
  }) as typeof fetch;
  return chamadas;
}
const ORIGEM = { organizacaoId: "org1", usuarioId: "u1", negocioId: "neg1", propostaId: "prop1" };

test("upgrade: mais quantidade é imediato, com pró-rata e metadata preservada", async () => {
  fakeStripe({ "subscriptions/sub_1": SUB() });
  const plano = await planejarAlteracao("sub_1", { tipo: "alterar_quantidade", itemId: "si_a", quantidade: 5 });
  assert.equal(plano.direcao, "upgrade");
  assert.equal(plano.efeito, "agora");
  const { form, path } = pedidoDoStripe(plano, { tipo: "alterar_quantidade", itemId: "si_a", quantidade: 5 }, ORIGEM);
  assert.equal(path, "subscriptions/sub_1");
  assert.equal(form.get("proration_behavior"), "always_invoice");
  assert.equal(form.get("payment_behavior"), "error_if_incomplete");
  assert.equal(form.get("items[0][quantity]"), "5");
  assert.equal(form.get("metadata[crm_organization_id]"), "org1");
  assert.equal(form.get("metadata[crm_negocio_id]"), "neg1");
  assert.equal(form.get("metadata[crm_proposal_id]"), "prop1");
});

test("downgrade vale no próximo ciclo; pedir 'agora' sem exceção é recusado; com exceção passa", async () => {
  fakeStripe({ "subscriptions/sub_1": SUB() });
  const acao = { tipo: "alterar_quantidade", itemId: "si_a", quantidade: 1 } as const;
  const plano = await planejarAlteracao("sub_1", acao);
  assert.equal(plano.direcao, "downgrade");
  assert.equal(plano.efeito, "proximo_ciclo");
  assert.equal(pedidoDoStripe(plano, acao, ORIGEM).form.get("proration_behavior"), "none");

  await assert.rejects(planejarAlteracao("sub_1", acao, { efeito: "agora" }), (e: unknown) => e instanceof ErroDeAlteracao && e.status === 422);
  const forcado = await planejarAlteracao("sub_1", acao, { efeito: "agora", sobrescrever: true });
  assert.equal(forcado.efeito, "agora");
});

test("trocar Price reenvia a quantidade (senão o Stripe zera para 1) e usa o id do item", async () => {
  fakeStripe({ "subscriptions/sub_1": SUB(), "prices/price_c": preco("price_c", 20000) });
  const acao = { tipo: "trocar_price", itemId: "si_a", novoPriceId: "price_c" } as const;
  const plano = await planejarAlteracao("sub_1", acao);
  const f = pedidoDoStripe(plano, acao, ORIGEM).form;
  assert.equal(f.get("items[0][id]"), "si_a");
  assert.equal(f.get("items[0][price]"), "price_c");
  assert.equal(f.get("items[0][quantity]"), "2");
  assert.equal(plano.direcao, "upgrade");
});

test("adicionar item já presente manda alterar quantidade; o item novo nasce com a origem", async () => {
  fakeStripe({ "subscriptions/sub_1": SUB(), "prices/price_n": preco("price_n", 3000) });
  await assert.rejects(planejarAlteracao("sub_1", { tipo: "adicionar_item", priceId: "price_a", quantidade: 1 }), /alterar quantidade/i);
  const acao = { tipo: "adicionar_item", priceId: "price_n", quantidade: 3 } as const;
  const f = pedidoDoStripe(await planejarAlteracao("sub_1", acao), acao, ORIGEM).form;
  assert.equal(f.get("items[0][price]"), "price_n");
  assert.equal(f.get("items[0][metadata][crm_negocio_id]"), "neg1");
});

test("remover o único item é recusado; cancelar no fim do período e reativar", async () => {
  fakeStripe({ "subscriptions/sub_1": SUB({ items: { data: [{ id: "si_a", quantity: 1, price: preco("price_a", 10000) }] } }) });
  await assert.rejects(planejarAlteracao("sub_1", { tipo: "remover_item", itemId: "si_a" }), /Cancelar/);
  const cancel = { tipo: "cancelar", quando: "fim_periodo" } as const;
  const f = pedidoDoStripe(await planejarAlteracao("sub_1", cancel), cancel, ORIGEM).form;
  assert.equal(f.get("cancel_at_period_end"), "true");

  fakeStripe({ "subscriptions/sub_1": SUB({ cancel_at_period_end: true }) });
  const re = { tipo: "reativar" } as const;
  assert.equal(pedidoDoStripe(await planejarAlteracao("sub_1", re), re, ORIGEM).form.get("cancel_at_period_end"), "false");
  await assert.rejects(planejarAlteracao("sub_1", { tipo: "cancelar", quando: "fim_periodo" }), /Já está marcada/);
});

test("cancelar imediato só com exceção confirmada, por DELETE e sem reembolso", async () => {
  fakeStripe({ "subscriptions/sub_1": SUB() });
  const acao = { tipo: "cancelar", quando: "agora" } as const;
  await assert.rejects(planejarAlteracao("sub_1", acao), (e: unknown) => e instanceof ErroDeAlteracao && e.status === 422);
  const plano = await planejarAlteracao("sub_1", acao, { sobrescrever: true });
  const p = pedidoDoStripe(plano, acao, ORIGEM);
  assert.equal(p.metodo, "DELETE");
  assert.equal(p.form.get("prorate"), "false");
});

test("assinatura do SaaS (organization_id/plan_id/user_id) nunca é tocada", async () => {
  const chamadas = fakeStripe({ "subscriptions/sub_1": SUB({ metadata: { organization_id: "x", plan_id: "y", user_id: "z" } }) });
  await assert.rejects(planejarAlteracao("sub_1", { tipo: "reativar" }), /SaaS/);
  assert.ok(chamadas.every((c) => c.method === "GET"));
});

test("aplicar manda a chave de idempotência estável e nenhuma outra escrita", async () => {
  const chamadas = fakeStripe({ "subscriptions/sub_1": SUB({ latest_invoice: "in_9" }) });
  const acao = { tipo: "alterar_quantidade", itemId: "si_a", quantidade: 5 } as const;
  const plano = await planejarAlteracao("sub_1", acao);
  const r1 = await aplicarAlteracao(plano, acao, ORIGEM, "abc-123");
  await aplicarAlteracao(plano, acao, ORIGEM, "abc-123");
  const posts = chamadas.filter((c) => c.method === "POST");
  assert.equal(posts.length, 2);
  assert.ok(posts.every((p) => p.idem === "onface-assin-abc-123"));
  assert.equal(r1.faturaId, "in_9");
});

/* Boleto: `error_if_incomplete` desfaz a alteração e deixa o boleto de pé,
   válido e impossível de cancelar. Aconteceu duas vezes com a mesma venda
   (Maíra cred #1581, 21 e 23/10/2026). Quem paga assim vai de
   `allow_incomplete`: a alteração entra e a fatura fica em aberto. */
test("quem paga por boleto não leva error_if_incomplete", async () => {
  fakeStripe({ "subscriptions/sub_1": SUB({ default_payment_method: { id: "pm_1", type: "boleto" } }) });
  const acao = { tipo: "alterar_quantidade", itemId: "si_a", quantidade: 5 } as const;
  const f = pedidoDoStripe(await planejarAlteracao("sub_1", acao), acao, ORIGEM).form;
  assert.equal(f.get("proration_behavior"), "always_invoice");
  assert.equal(f.get("payment_behavior"), "allow_incomplete");
});

test("pagamentoEhAssincrono olha os dois lugares, não só payment_settings", () => {
  // o caso real tinha payment_method_types null e o boleto só no método padrão
  assert.equal(pagamentoEhAssincrono({ payment_settings: { payment_method_types: null }, default_payment_method: { type: "boleto" } }), true);
  assert.equal(pagamentoEhAssincrono({ payment_settings: { payment_method_types: ["boleto", "card"] } }), true);
  // método padrão não expandido vem como id solto: não dá para afirmar que é assíncrono
  assert.equal(pagamentoEhAssincrono({ default_payment_method: "pm_1" }), false);
  assert.equal(pagamentoEhAssincrono({ payment_settings: { payment_method_types: ["card"] }, default_payment_method: { type: "card" } }), false);
  assert.equal(pagamentoEhAssincrono({}), false);
});
