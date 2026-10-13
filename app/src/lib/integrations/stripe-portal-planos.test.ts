/**
 * Quais planos entram na troca de plano do Portal: catálogo do ONFACE conferido com um Stripe FALSO (sem rede).
 * O que se trava: nada do SaaS Callface (conta compartilhada) entra, nada que o Stripe recusaria entra, e
 * nenhum id está escrito no código — tudo vem do catálogo recebido.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { montarRelatorioDoPortal } from "./stripe-portal-relatorio";
import {
  LIMITE_PRODUTOS_DO_PORTAL, motivoDeSaaS, resolverPlanosDoPortal,
  type PrecoDoStripe, type ProdutoDoCatalogo, type ProdutoDoStripe,
} from "./stripe-portal-planos";

const cat = (nome: string, produto: string | null, precos: string[], extra: Partial<ProdutoDoCatalogo> = {}): ProdutoDoCatalogo => ({
  nome, stripeProductId: produto, ativo: true, tipo: "recorrente", categoria: "plano", origemCatalogo: "oficial_stripe", ordem: 0,
  precos: precos.map((id) => ({ stripePriceId: id, ativo: true, recorrente: true })), ...extra,
});
const prod = (id: string, extra: Partial<ProdutoDoStripe> = {}): ProdutoDoStripe => ({ id, active: true, metadata: {}, ...extra });
const preco = (id: string, product: string, extra: Partial<PrecoDoStripe> = {}): PrecoDoStripe => ({
  id, product, active: true, type: "recurring", currency: "brl", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, metadata: {}, ...extra,
});

test("motivoDeSaaS reconhece as marcas do SaaS Callface", () => {
  assert.match(motivoDeSaaS({ managed_by: "callface-backend" }) ?? "", /managed_by/);
  assert.match(motivoDeSaaS({ plan_id: "p" }) ?? "", /plan_id/);
  assert.match(motivoDeSaaS({ organization_id: "o" }) ?? "", /organization_id/);
  assert.match(motivoDeSaaS({ user_id: "u" }) ?? "", /user_id/);
  assert.equal(motivoDeSaaS({ sku_interno: "x", crm_organization_id: "o" }), null);
  assert.equal(motivoDeSaaS(null), null);
});

test("entram os planos do catálogo com os prices que o Stripe confirma, na ordem do catálogo", () => {
  const r = resolverPlanosDoPortal({
    catalogo: [cat("Full", "prod_full", ["price_full_m"], { ordem: 2 }), cat("Starter", "prod_starter", ["price_s_m", "price_s_a"], { ordem: 1 })],
    produtosStripe: [prod("prod_full"), prod("prod_starter")],
    precosStripe: [preco("price_full_m", "prod_full"), preco("price_s_m", "prod_starter"), preco("price_s_a", "prod_starter", { recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } })],
  });
  assert.deepEqual(r.planos, [{ produto: "prod_starter", precos: ["price_s_a", "price_s_m"] }, { produto: "prod_full", precos: ["price_full_m"] }]);
  assert.equal(r.aviso, null);
});

test("NADA do SaaS entra: produto ou preço marcado, mesmo que esteja no catálogo", () => {
  const r = resolverPlanosDoPortal({
    catalogo: [cat("Ok", "prod_ok", ["price_ok1", "price_ok2_year"]), cat("SaaS", "prod_saas", ["price_saas"]), cat("Misto", "prod_misto", ["price_misto_ok", "price_misto_saas"])],
    produtosStripe: [prod("prod_ok"), prod("prod_saas", { metadata: { managed_by: "callface-backend" } }), prod("prod_misto")],
    precosStripe: [
      preco("price_ok1", "prod_ok"), preco("price_ok2_year", "prod_ok", { recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } }),
      preco("price_saas", "prod_saas"),
      preco("price_misto_ok", "prod_misto"), preco("price_misto_saas", "prod_misto", { recurring: { interval: "year", interval_count: 1 }, metadata: { plan_id: "p" } }),
    ],
  });
  const ids = r.planos.flatMap((p) => [p.produto, ...p.precos]);
  assert.ok(!ids.includes("prod_saas") && !ids.includes("price_saas") && !ids.includes("price_misto_saas"));
  assert.ok(r.excluidos.some((x) => x.id === "prod_saas" && /SaaS/.test(x.motivo)));
  assert.ok(r.excluidos.some((x) => x.id === "price_misto_saas" && /SaaS/.test(x.motivo)));
  assert.deepEqual(r.planos.map((p) => p.produto).sort(), ["prod_misto", "prod_ok"]);
});

test("produto do Stripe fora do catálogo não entra: a lista nasce do catálogo, não do Stripe", () => {
  const r = resolverPlanosDoPortal({
    catalogo: [cat("A", "prod_a", ["price_a1", "price_a2"])],
    produtosStripe: [prod("prod_a"), prod("prod_solto")],
    precosStripe: [preco("price_a1", "prod_a"), preco("price_a2", "prod_a", { recurring: { interval: "year", interval_count: 1 } }), preco("price_solto", "prod_solto")],
  });
  assert.deepEqual(r.planos.map((p) => p.produto), ["prod_a"]);
});

test("o catálogo filtra por categoria, tipo, origem e situação", () => {
  const base = { produtosStripe: [prod("p1"), prod("p2"), prod("p3"), prod("p4"), prod("p5")], precosStripe: ["p1", "p2", "p3", "p4", "p5"].flatMap((p) => [preco(`${p}_m`, p), preco(`${p}_a`, p, { recurring: { interval: "year", interval_count: 1 } })]) };
  const r = resolverPlanosDoPortal({
    ...base,
    catalogo: [
      cat("plano ok", "p1", ["p1_m", "p1_a"]),
      cat("add-on", "p2", ["p2_m", "p2_a"], { categoria: "add_on" }),
      cat("avulso", "p3", ["p3_m", "p3_a"], { tipo: "avulso" }),
      cat("legado", "p4", ["p4_m", "p4_a"], { origemCatalogo: "legado" }),
      cat("inativo", "p5", ["p5_m", "p5_a"], { ativo: false }),
      cat("sem produto", null, ["x"]),
    ],
  });
  assert.deepEqual(r.planos.map((p) => p.produto), ["p1"]);
});

test("price que o Stripe recusaria ou que o portal não atualiza fica de fora, com motivo", () => {
  const r = resolverPlanosDoPortal({
    catalogo: [cat("A", "prod_a", ["ok_m", "ok_a", "usd", "medido", "escalonado", "inativo", "avulso", "sumiu", "de_outro"])],
    produtosStripe: [prod("prod_a")],
    precosStripe: [
      preco("ok_m", "prod_a"), preco("ok_a", "prod_a", { recurring: { interval: "year", interval_count: 1 } }),
      preco("usd", "prod_a", { currency: "usd", recurring: { interval: "week", interval_count: 1 } }),
      preco("medido", "prod_a", { recurring: { interval: "day", interval_count: 1, usage_type: "metered" } }),
      preco("escalonado", "prod_a", { billing_scheme: "tiered", tiers_mode: "graduated", recurring: { interval: "month", interval_count: 3 } }),
      preco("inativo", "prod_a", { active: false, recurring: { interval: "month", interval_count: 6 } }),
      preco("avulso", "prod_a", { type: "one_time", recurring: null }),
      preco("de_outro", "prod_outro"),
    ],
  });
  assert.deepEqual(r.planos, [{ produto: "prod_a", precos: ["ok_a", "ok_m"] }]);
  for (const id of ["usd", "medido", "escalonado", "inativo", "avulso", "sumiu", "de_outro"]) assert.ok(r.excluidos.some((x) => x.id === id), `${id} deve ter motivo`);
});

test("dois prices do mesmo produto e intervalo saem os dois: o Stripe recusaria a configuração inteira", () => {
  const r = resolverPlanosDoPortal({
    catalogo: [cat("A", "prod_a", ["m1", "m2", "a1"]), cat("B", "prod_b", ["b1"])],
    produtosStripe: [prod("prod_a"), prod("prod_b")],
    precosStripe: [preco("m1", "prod_a"), preco("m2", "prod_a"), preco("a1", "prod_a", { recurring: { interval: "year", interval_count: 1 } }), preco("b1", "prod_b")],
  });
  assert.deepEqual(r.planos, [{ produto: "prod_a", precos: ["a1"] }, { produto: "prod_b", precos: ["b1"] }]);
  assert.equal(r.excluidos.filter((x) => /mesmo intervalo/.test(x.motivo)).length, 2);
});

test("menos de 2 prices escolhíveis: troca de plano desligada, com aviso", () => {
  const um = resolverPlanosDoPortal({ catalogo: [cat("A", "prod_a", ["a"])], produtosStripe: [prod("prod_a")], precosStripe: [preco("a", "prod_a")] });
  assert.deepEqual(um.planos, []);
  assert.match(um.aviso ?? "", /pelo menos 2/);
  const nenhum = resolverPlanosDoPortal({ catalogo: [], produtosStripe: [], precosStripe: [] });
  assert.deepEqual(nenhum.planos, []);
  assert.match(nenhum.aviso ?? "", /nenhum plano/);
});

test(`no máximo ${LIMITE_PRODUTOS_DO_PORTAL} produtos (teto do Stripe), na ordem do catálogo`, () => {
  const ids = Array.from({ length: LIMITE_PRODUTOS_DO_PORTAL + 2 }, (_, i) => `p${i}`);
  const r = resolverPlanosDoPortal({
    catalogo: ids.map((id, i) => cat(id, id, [`${id}_m`], { ordem: i })),
    produtosStripe: ids.map((id) => prod(id)),
    precosStripe: ids.map((id) => preco(`${id}_m`, id)),
  });
  assert.equal(r.planos.length, LIMITE_PRODUTOS_DO_PORTAL);
  assert.equal(r.planos[0].produto, "p0");
  assert.equal(r.excluidos.length, 2);
});

test("o relatório do --simular mostra campo a campo o que mudaria e por que cada plano saiu", () => {
  const planos = resolverPlanosDoPortal({
    catalogo: [cat("A", "prod_a", ["a1", "a2"]), cat("SaaS", "prod_s", ["s1"])],
    produtosStripe: [prod("prod_a"), prod("prod_s", { metadata: { managed_by: "callface-backend" } })],
    precosStripe: [preco("a1", "prod_a"), preco("a2", "prod_a", { recurring: { interval: "year", interval_count: 1 } }), preco("s1", "prod_s")],
  });
  const texto = montarRelatorioDoPortal({
    configuracoes: [{ id: "bpc_padrao", active: true, is_default: true, metadata: {}, features: { customer_update: { enabled: true, allowed_updates: ["email"] }, subscription_update: { enabled: false } } }],
    politicas: {}, planos, nomes: { prod_a: "Plano A" },
  }).join("\n");
  assert.match(texto, /Decisão: CRIAR/);
  assert.match(texto, /\+ prod_a \(Plano A\): a1, a2/);
  assert.match(texto, /- prod_s: .*SaaS/);
  assert.match(texto, /features\.subscription_update\.proration_behavior/);
  assert.match(texto, /em relação à padrão da conta \(bpc_padrao\)/);
  assert.match(texto, /features\.customer_update\.allowed_updates: email → /);
  assert.match(texto, /FALTAM/);
});
