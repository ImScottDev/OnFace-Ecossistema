import assert from "node:assert/strict";
import test from "node:test";
import { diagnosticarCustomers, planejarBackfill, semEmpresasBalde, type BaseOnface } from "./stripe-saneamento";

const ORG = "11111111-1111-4111-8111-111111111111";
const E1 = "22222222-2222-4222-8222-222222222222";
const E2 = "33333333-3333-4333-8333-333333333333";
const NEG = "55555555-5555-4555-8555-555555555555";

const base = (extra: Partial<BaseOnface> = {}): BaseOnface => ({
  empresas: [
    { id: E1, organizacaoId: ORG, nome: "Acme", cnpj: "12.345.678/0001-99", stripeCustomerId: "cus_a" },
    { id: E2, organizacaoId: ORG, nome: "Beta", cnpj: null, stripeCustomerId: null },
  ],
  vinculos: [{ organizacaoId: ORG, empresaId: E1, customerId: "cus_a", fonte: "empresa" }],
  espelho: [{ stripeSubscriptionId: "sub_a", organizacaoId: ORG, empresaId: E1, customerId: "cus_a", status: "active", negocioId: NEG }],
  ...extra,
});

test("backfill: só adiciona o que falta, pula SaaS e objeto de outra empresa", () => {
  const plano = planejarBackfill({
    base: base({ vinculos: [
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_a", fonte: "empresa" },
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_saas", fonte: "lead" },
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_outra", fonte: "lead" },
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_pronto", fonte: "lead" },
    ] }),
    customers: [
      { id: "cus_a", metadata: { crm_company_id: E1, nota: "mantida" } },
      { id: "cus_saas", metadata: { user_name: "x" } },
      { id: "cus_outra", metadata: { crm_company_id: E2 } },
      { id: "cus_orfao", metadata: {} },
      { id: "cus_pronto", metadata: { organizacaoId: ORG, empresaId: E1, crm_organization_id: ORG, crm_company_id: E1, crm_cnpj: "12345678000199" } },
    ],
    assinaturas: [
      { id: "sub_a", status: "active", customer: "cus_a", metadata: {} },
      { id: "sub_saas", status: "active", customer: "cus_x", metadata: { organization_id: "o", plan_id: "p" } },
      { id: "sub_velha", status: "canceled", customer: "cus_a", metadata: {} },
    ],
  });
  const cus = plano.acoes.find((a) => a.id === "cus_a")!;
  assert.equal(cus.adicionar.organizacaoId, ORG);
  assert.equal(cus.adicionar.crm_cnpj, "12345678000199");
  assert.equal("crm_company_id" in cus.adicionar, false, "valor existente não é reescrito");
  const sub = plano.acoes.find((a) => a.id === "sub_a")!;
  assert.equal(sub.adicionar.negocioId, NEG);
  assert.equal(sub.adicionar.crm_negocio_id, NEG);
  assert.equal(plano.acoes.length, 2, "só cus_a e sub_a");
  assert.equal(plano.pulados["customer do SaaS"], 1);
  assert.equal(plano.pulados["metadata declara outra empresa"], 1);
  assert.equal(plano.pulados["customer já completo"], 1);
  assert.equal(plano.pulados["assinatura fora do espelho (provável SaaS)"], 2);
});

test("backfill é idempotente: depois de aplicado, nada a fazer", () => {
  const b = base();
  const primeiro = planejarBackfill({ base: b, customers: [{ id: "cus_a", metadata: {} }], assinaturas: [] });
  const aplicado = { id: "cus_a", metadata: primeiro.acoes[0].adicionar };
  assert.equal(planejarBackfill({ base: b, customers: [aplicado], assinaturas: [] }).acoes.length, 0);
});

const dup = (vivas: Record<string, number>, vinculados: string[] = []): ReturnType<typeof diagnosticarCustomers> => {
  const ids = Object.keys(vivas);
  return diagnosticarCustomers({
    base: base({
      empresas: [{ id: E1, organizacaoId: ORG, nome: "Acme", cnpj: null, stripeCustomerId: vinculados[0] ?? null }],
      vinculos: ids.map((customerId) => ({ organizacaoId: ORG, empresaId: E1, customerId, fonte: "lead" as const })),
      espelho: [],
    }),
    customers: ids.map((id, i) => ({ id, created: 100 + i, metadata: {} })),
    assinaturas: ids.flatMap((id) => Array.from({ length: vivas[id] }, (_, n) => ({ id: `sub_${id}_${n}`, status: "active", customer: id, metadata: {} }))),
  });
};

test("diagnóstico: um só com assinatura viva é o canônico inequívoco", () => {
  const [d] = dup({ cus_velho: 0, cus_vivo: 1 });
  assert.equal(d.canonicoProposto, "cus_vivo");
  assert.equal(d.inequivoco, true);
});

test("diagnóstico: dois com assinatura viva é decisão humana", () => {
  const [d] = dup({ cus_1: 1, cus_2: 1 });
  assert.equal(d.inequivoco, false);
  assert.match(d.motivo, /decisão humana/);
});

test("diagnóstico: sem vivas, inequívoco só se a empresa já aponta para um", () => {
  assert.equal(dup({ cus_1: 0, cus_2: 0 }, ["cus_2"])[0].inequivoco, true);
  assert.equal(dup({ cus_1: 0, cus_2: 0 })[0].inequivoco, false);
});

test("diagnóstico: empresa com um Customer só não entra, e Customer do SaaS não é candidato", () => {
  assert.equal(dup({ cus_1: 1 }).length, 0);
  const d = diagnosticarCustomers({
    base: base({ vinculos: [
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_a", fonte: "empresa" },
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_saas", fonte: "lead" },
    ] }),
    customers: [{ id: "cus_a", created: 1 }, { id: "cus_saas", created: 0, metadata: { user_cnpj: "1" } }],
    assinaturas: [],
  });
  assert.equal(d.length, 0, "sobra um candidato só");
});

test("diagnóstico: Customer com assinatura do SaaS nunca é canônico", () => {
  const d = diagnosticarCustomers({
    base: base({ vinculos: [
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_a", fonte: "empresa" },
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_misto", fonte: "lead" },
    ] }),
    customers: [{ id: "cus_a", created: 5 }, { id: "cus_misto", created: 1, metadata: {} }],
    assinaturas: [{ id: "s", status: "active", customer: "cus_misto", metadata: { organization_id: "o", plan_id: "p", user_id: "u" } }],
  });
  assert.equal(d[0].canonicoProposto, "cus_a");
});

test("a empresa-balde 'Unresolved billing identity' sai da base e nada é carimbado nela", () => {
  const BALDE = "99999999-9999-4999-8999-999999999999";
  const b = semEmpresasBalde(base({
    empresas: [
      { id: E1, organizacaoId: ORG, nome: "Acme", cnpj: null, stripeCustomerId: null },
      { id: BALDE, organizacaoId: ORG, nome: "Unresolved billing identity", cnpj: null, stripeCustomerId: null },
    ],
    vinculos: [
      { organizacaoId: ORG, empresaId: E1, customerId: "cus_ok", fonte: "lead" },
      { organizacaoId: ORG, empresaId: BALDE, customerId: "cus_x", fonte: "espelho" },
      { organizacaoId: ORG, empresaId: BALDE, customerId: "cus_y", fonte: "espelho" },
    ],
    espelho: [{ stripeSubscriptionId: "sub_x", organizacaoId: ORG, empresaId: BALDE, customerId: "cus_x", status: "active", negocioId: null }],
  }));
  assert.deepEqual(b.empresas.map((e) => e.id), [E1]);
  assert.equal(b.vinculos.length, 1);
  assert.equal(b.espelho.length, 0);
  const plano = planejarBackfill({
    base: b,
    customers: [{ id: "cus_ok", metadata: {} }, { id: "cus_x", metadata: {} }],
    assinaturas: [{ id: "sub_x", status: "active", customer: "cus_x", metadata: {} }],
  });
  assert.deepEqual(plano.acoes.map((a) => a.id), ["cus_ok"]);
  assert.equal(diagnosticarCustomers({ base: b, customers: [], assinaturas: [] }).length, 0);
});
