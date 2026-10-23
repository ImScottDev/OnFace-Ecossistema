import assert from "node:assert/strict";
import test from "node:test";
import {
  ehCustomerDoSaas,
  escolherCanonico,
  garantirCustomerDaEmpresa,
  idCompativelComModo,
  localizarCustomerDaEmpresa,
  localizarCustomerParaPortal,
  tipoDeDocumentoBr,
  type CustomerStripe,
  type EntradaCustomer,
  type GravacaoCustomer,
  type PortasCustomer,
} from "./stripe-customer";
import { createGroupCheckout } from "./stripe-checkout";

/* Stripe e banco FALSOS: nada aqui toca a rede nem o Postgres. */

const ORG = "11111111-1111-4111-8111-111111111111";
const EMP = "22222222-2222-4222-8222-222222222222";
const OUTRA = "33333333-3333-4333-8333-333333333333";
const LEAD = "44444444-4444-4444-8444-444444444444";
const CNPJ = "12345678000199";

interface Mundo {
  customers: Map<string, CustomerStripe>;
  assinaturas: Map<string, { metadata?: Record<string, string> }[]>;
  empresa: Map<string, string>; // empresaId -> customer
  identidade: Map<string, string>;
  espelho: Map<string, string>;
  gravacoes: GravacaoCustomer[];
  criacoes: { form: URLSearchParams; chave: string }[];
  completadas: { id: string; faltantes: Record<string, string> }[];
  taxIds: Map<string, { type: string; value: string }[]>;
  idem: Map<string, CustomerStripe>;
  seq: number;
}

function mundo(parcial: Partial<Mundo> = {}): Mundo {
  return {
    customers: new Map(), assinaturas: new Map(), empresa: new Map(), identidade: new Map(), espelho: new Map(),
    gravacoes: [], criacoes: [], completadas: [], taxIds: new Map(), idem: new Map(), seq: 0, ...parcial,
  };
}

const poe = (m: Mundo, c: CustomerStripe) => { m.customers.set(c.id, c); return c; };

function portas(m: Mundo): PortasCustomer {
  /* Exclusão mútua por chave, como o advisory lock: a 2ª chamada espera a 1ª. */
  const filas = new Map<string, Promise<unknown>>();
  return {
    modo: () => "live",
    banco: {
      serializar<T>(chave: string, fn: Parameters<PortasCustomer["banco"]["serializar"]>[1]) {
        const anterior = filas.get(chave) ?? Promise.resolve();
        const atual = anterior.catch(() => undefined).then(() => fn({
          daEmpresa: async (_o, e) => m.empresa.get(e) ?? null,
          daIdentidade: async (_o, e) => (e ? m.identidade.get(e) ?? null : null),
          doLead: async () => null,
          doEspelho: async (_o, e) => m.espelho.get(e) ?? null,
          gravar: async (g) => {
            m.gravacoes.push(g);
            if (g.empresaId) m.empresa.set(g.empresaId, g.customerId);
          },
        }));
        filas.set(chave, atual);
        return atual as Promise<T>;
      },
    },
    stripe: {
      ler: async (id) => m.customers.get(id) ?? null,
      /* Entende só o formato que o resolver gera: metadata['k']:'v' OR ... */
      buscar: async (query) => {
        const pares = [...query.matchAll(/metadata\['([^']+)'\]:'((?:[^'\\]|\\.)*)'/g)].map((x) => [x[1], x[2]] as const);
        return [...m.customers.values()].filter((c) => pares.some(([k, v]) => c.metadata?.[k] === v));
      },
      porEmail: async (email) => [...m.customers.values()].filter((c) => c.email === email),
      assinaturasDoCustomer: async (id) => m.assinaturas.get(id) ?? [],
      criar: async (form, chave) => {
        m.criacoes.push({ form, chave });
        const ja = m.idem.get(chave);
        if (ja) return ja;
        const metadata: Record<string, string> = {};
        for (const [k, v] of form.entries()) { const x = /^metadata\[(.+)\]$/.exec(k); if (x) metadata[x[1]] = v; }
        const c: CustomerStripe = { id: `cus_novo${++m.seq}`, email: form.get("email"), name: form.get("name"), created: 2000 + m.seq, metadata };
        m.customers.set(c.id, c);
        m.idem.set(chave, c);
        return c;
      },
      completarMetadata: async (id, faltantes) => {
        m.completadas.push({ id, faltantes });
        const c = m.customers.get(id)!;
        c.metadata = { ...faltantes, ...(c.metadata ?? {}) };
      },
      taxIds: async (id) => m.taxIds.get(id) ?? [],
      criarTaxId: async (id, type, value) => {
        m.taxIds.set(id, [...(m.taxIds.get(id) ?? []), { type, value }]);
      },
    },
  };
}

const entrada = (extra: Partial<EntradaCustomer> = {}): EntradaCustomer => ({
  organizacaoId: ORG, empresaId: EMP, leadId: LEAD, nome: "Acme Ltda", email: "dono@acme.com", cnpj: CNPJ, ...extra,
});

/* ── puras ──────────────────────────────────────────────────────────────── */

test("Customer do SaaS é reconhecido pela metadata (user_name, user_cnpj, organization_id...)", () => {
  assert.equal(ehCustomerDoSaas({ metadata: { user_name: "Fulano" } }), true);
  assert.equal(ehCustomerDoSaas({ metadata: { user_cnpj: "123" } }), true);
  assert.equal(ehCustomerDoSaas({ metadata: { organization_id: "o" } }), true);
  assert.equal(ehCustomerDoSaas({ metadata: { crm_company_id: EMP } }), false);
  assert.equal(ehCustomerDoSaas({ metadata: null }), false);
});

test("canônico: assinatura viva, depois o vinculado, depois o mais antigo, depois o id", () => {
  assert.equal(escolherCanonico([{ id: "b", created: 1 }, { id: "a", created: 5, assinaturasVivas: 1 }])?.id, "a");
  assert.equal(escolherCanonico([{ id: "b", created: 1 }, { id: "a", created: 5, vinculadoNaEmpresa: true }])?.id, "a");
  assert.equal(escolherCanonico([{ id: "b", created: 9 }, { id: "a", created: 5 }])?.id, "a");
  assert.equal(escolherCanonico([{ id: "b", created: 5 }, { id: "a", created: 5 }])?.id, "a");
  assert.equal(escolherCanonico([]), null);
});

test("id de teste/mock nunca serve em live", () => {
  assert.equal(idCompativelComModo("cus_test_1", "live"), false);
  assert.equal(idCompativelComModo("cus_mock_1", "live"), false);
  assert.equal(idCompativelComModo("cus_ABC", "live"), true);
  assert.equal(idCompativelComModo("cus_test_1", "test"), true);
});

/* ── o resolver ─────────────────────────────────────────────────────────── */

test("NÃO pega Customer do SaaS pelo e-mail: cria um novo", async () => {
  const m = mundo();
  poe(m, { id: "cus_saas", email: "dono@acme.com", created: 1, metadata: { user_name: "Dono", user_cnpj: CNPJ } });
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.notEqual(r.id, "cus_saas");
  assert.equal(r.metodo, "criado");
  assert.equal(m.criacoes.length, 1);
});

test("NÃO pega Customer sem metadata cuja assinatura é do SaaS", async () => {
  const m = mundo();
  poe(m, { id: "cus_saas2", email: "dono@acme.com", created: 1, metadata: {} });
  m.assinaturas.set("cus_saas2", [{ metadata: { organization_id: "o", plan_id: "p", user_id: "u" } }]);
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.notEqual(r.id, "cus_saas2");
  assert.ok(r.avisos.some((a) => a.includes("assinatura do SaaS")));
});

test("vínculo da empresa apontando para Customer do SaaS é descartado, não cobrado", async () => {
  const m = mundo();
  poe(m, { id: "cus_saas3", created: 1, metadata: { user_name: "x" } });
  m.empresa.set(EMP, "cus_saas3");
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.notEqual(r.id, "cus_saas3");
  assert.ok(r.avisos.some((a) => a.includes("SaaS")));
  assert.equal(m.empresa.get(EMP), r.id, "o vínculo foi regravado para o novo");
});

test("vínculo apontando para Customer apagado no Stripe é descartado", async () => {
  const m = mundo();
  m.empresa.set(EMP, "cus_sumiu");
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r.metodo, "criado");
  assert.ok(r.avisos.some((a) => a.includes("não existe mais")));
});

test("NÃO pega por e-mail Customer que já é de OUTRA empresa", async () => {
  const m = mundo();
  poe(m, { id: "cus_outra", email: "dono@acme.com", created: 1, metadata: { crm_company_id: OUTRA } });
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.notEqual(r.id, "cus_outra");
});

test("reusa o canônico já vinculado: não cria, não duplica, completa a metadata que falta", async () => {
  const m = mundo();
  poe(m, { id: "cus_ok", created: 1, email: "dono@acme.com", metadata: { crm_company_id: EMP } });
  m.empresa.set(EMP, "cus_ok");
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r.id, "cus_ok");
  assert.equal(r.metodo, "empresa");
  assert.equal(m.criacoes.length, 0);
  assert.equal(m.completadas.length, 1);
  const faltantes = m.completadas[0].faltantes;
  assert.equal(faltantes.organizacaoId, ORG);
  assert.equal(faltantes.empresaId, EMP);
  assert.equal(faltantes.crm_organization_id, ORG);
  assert.equal(faltantes.crm_cnpj, CNPJ);
  assert.equal("crm_company_id" in faltantes, false, "o que já existe não é reescrito");
});

test("o identificador do banco vence o e-mail: identidade da empresa antes de buscar no Stripe", async () => {
  const m = mundo();
  poe(m, { id: "cus_ident", created: 5, metadata: { crm_company_id: EMP } });
  poe(m, { id: "cus_email", created: 1, email: "dono@acme.com", metadata: {} });
  m.identidade.set(EMP, "cus_ident");
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r.id, "cus_ident");
  assert.equal(r.metodo, "identidade");
});

test("sem vínculo no banco, acha por metadata da empresa e escolhe o canônico entre vários", async () => {
  const m = mundo();
  poe(m, { id: "cus_novo_dup", created: 9, metadata: { onfaceEmpresaId: EMP } });
  poe(m, { id: "cus_antigo", created: 2, metadata: { crm_company_id: EMP } });
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r.id, "cus_antigo");
  assert.equal(r.metodo, "metadata");
  assert.equal(m.criacoes.length, 0);
});

test("acha por CNPJ na metadata quando não há id da empresa", async () => {
  const m = mundo();
  poe(m, { id: "cus_cnpj", created: 2, metadata: { cnpj: "12.345.678/0001-99" } });
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r.id, "cus_cnpj");
  assert.equal(r.metodo, "cnpj");
});

test("acha por e-mail só se o Customer não é do SaaS, e grava o vínculo de volta", async () => {
  const m = mundo();
  poe(m, { id: "cus_email_ok", created: 1, email: "dono@acme.com", metadata: {} });
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r.id, "cus_email_ok");
  assert.equal(r.metodo, "email");
  assert.equal(m.gravacoes.at(-1)?.customerId, "cus_email_ok");
  assert.equal(m.empresa.get(EMP), "cus_email_ok");
});

test("clique duplo: duas chamadas simultâneas geram UM Customer só", async () => {
  const m = mundo();
  const p = portas(m);
  const [a, b] = await Promise.all([garantirCustomerDaEmpresa(entrada(), p), garantirCustomerDaEmpresa(entrada(), p)]);
  assert.equal(a.id, b.id);
  assert.equal(m.criacoes.length, 1, "a 2ª chamada enxergou o vínculo gravado pela 1ª");
  assert.equal([...m.customers.keys()].length, 1);
});

test("clique duplo mesmo com o vínculo perdido: a chave de idempotência é estável por empresa", async () => {
  const m = mundo();
  const p = portas(m);
  await garantirCustomerDaEmpresa(entrada(), p);
  m.empresa.clear(); // gravação no banco "não aconteceu"
  m.gravacoes.length = 0;
  m.customers.forEach((c) => { c.metadata = {}; }); // e a busca por metadata ainda não indexou
  await garantirCustomerDaEmpresa(entrada({ nome: "Acme Ltda" }), p).catch(() => undefined);
  const chaves = new Set(m.criacoes.map((c) => c.chave));
  assert.equal(chaves.size, 1, "as duas tentativas usaram a MESMA chave");
  assert.equal([...m.customers.keys()].length, 1, "o Stripe devolveu o mesmo Customer");
});

test("Customer criado já nasce com a metadata completa (duas grafias) e o que o checkout mandou", async () => {
  const m = mundo();
  const NEG = "55555555-5555-4555-8555-555555555555";
  const PROP = "66666666-6666-4666-8666-666666666666";
  const r = await garantirCustomerDaEmpresa(entrada({
    metadata: { crm_negocio_id: NEG, negocioId: NEG, crm_proposal_id: PROP, propostaId: PROP, vazio: "" },
  }), portas(m));
  const c = m.customers.get(r.id)!;
  assert.equal(c.metadata?.organizacaoId, ORG);
  assert.equal(c.metadata?.empresaId, EMP);
  assert.equal(c.metadata?.negocioId, NEG);
  assert.equal(c.metadata?.propostaId, PROP);
  assert.equal(c.metadata?.crm_organization_id, ORG);
  assert.equal(c.metadata?.crm_company_id, EMP);
  assert.equal(c.metadata?.crm_negocio_id, NEG);
  assert.equal(c.metadata?.crm_proposal_id, PROP);
  assert.equal(c.metadata?.crm_cnpj, CNPJ);
  assert.equal("vazio" in (c.metadata ?? {}), false, "valor vazio não entra (apagaria a chave no Stripe)");
});

test("localizar não cria: devolve null quando a empresa nunca foi cobrada", async () => {
  const m = mundo();
  const r = await localizarCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r, null);
  assert.equal(m.criacoes.length, 0);
});

test("localizar acha o do espelho de assinaturas", async () => {
  const m = mundo();
  poe(m, { id: "cus_espelho", created: 1, metadata: {} });
  m.espelho.set(EMP, "cus_espelho");
  const r = await localizarCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r?.id, "cus_espelho");
  assert.equal(r?.metodo, "espelho");
});

test("Customer que declara OUTRA empresa na metadata não é completado com a nossa identidade", async () => {
  const m = mundo();
  poe(m, { id: "cus_dois_donos", created: 1, metadata: { crm_company_id: OUTRA } });
  m.empresa.set(EMP, "cus_dois_donos");
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(r.id, "cus_dois_donos");
  assert.equal(m.completadas.length, 0);
  assert.ok(r.avisos.some((a) => a.includes(OUTRA)));
});

/* ── o checkout leva a metadata nas duas grafias ───────────────────────── */

test("checkout: metadata com organizacaoId/empresaId/negocioId/propostaId E crm_negocio_id", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_falso";
  delete process.env.STRIPE_CHECKOUT_MODE;
  const corpos: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit = {}) => {
    corpos.push(String(init.body ?? ""));
    return new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.test/x" }), { status: 200 });
  }) as typeof fetch;
  try {
    const NEG = "55555555-5555-4555-8555-555555555555";
    const PROP = "66666666-6666-4666-8666-666666666666";
    await createGroupCheckout({
      propostaId: PROP, negocioId: NEG, grupoComercialId: "g1", organizacaoId: ORG, moeda: "BRL",
      itensRecorrentes: [{ nome: "Plano", quantidade: 1, valorUnitario: 100, valorTabela: 100, stripePriceId: "price_1", moeda: "BRL" }],
      itensAvulsos: [], customerId: "cus_ok", successUrl: "https://x/s", cancelUrl: "https://x/c",
      metadata: { crm_company_id: EMP, crm_organization_id: ORG },
    });
    const sessao = new URLSearchParams(corpos.at(-1));
    assert.equal(sessao.get("metadata[organizacaoId]"), ORG);
    assert.equal(sessao.get("metadata[empresaId]"), EMP);
    assert.equal(sessao.get("metadata[negocioId]"), NEG);
    assert.equal(sessao.get("metadata[crm_negocio_id]"), NEG);
    assert.equal(sessao.get("metadata[propostaId]"), PROP);
    assert.equal(sessao.get("metadata[crm_proposal_id]"), PROP);
    // e a mesma metadata desce para a assinatura, o pagamento e a fatura
    assert.equal(sessao.get("subscription_data[metadata][crm_negocio_id]"), NEG);
    assert.equal(sessao.get("invoice_creation[invoice_data][metadata][negocioId]") ?? sessao.get("subscription_data[metadata][negocioId]"), NEG);
  } finally {
    globalThis.fetch = original;
  }
});

/* ── portal: qualquer Customer da empresa, inclusive o do SaaS ───────────── */

test("portal: empresa só com Customer do site (SaaS) abre o portal, sem gravar nada", async () => {
  const m = mundo();
  poe(m, { id: "cus_site", created: 1, metadata: { user_name: "Dono", plan_id: "p" } });
  m.empresa.set(EMP, "cus_site");
  const r = await localizarCustomerParaPortal(entrada(), portas(m));
  assert.equal(r?.id, "cus_site");
  assert.equal(m.gravacoes.length, 0, "não vincula");
  assert.equal(m.completadas.length, 0, "não mexe na metadata do Stripe");
  // checkout continua recusando o mesmo Customer
  assert.equal((await localizarCustomerDaEmpresa(entrada(), portas(mundo({ ...m, gravacoes: [] }))))?.id ?? null, null);
});

test("portal: empresa sem nenhum Customer recebe null (a rota mostra a mensagem)", async () => {
  assert.equal(await localizarCustomerParaPortal(entrada(), portas(mundo())), null);
});

test("portal: Customer do ONFACE vence o do SaaS, mesmo que o do SaaS seja o vínculo da empresa", async () => {
  const m = mundo();
  poe(m, { id: "cus_site", created: 1, metadata: { user_name: "x" } });
  poe(m, { id: "cus_onface", created: 5, metadata: {} });
  m.empresa.set(EMP, "cus_site");
  m.identidade.set(EMP, "cus_onface");
  assert.equal((await localizarCustomerParaPortal(entrada(), portas(m)))?.id, "cus_onface");
});

test("portal: vários Customers do SaaS escolhem pelo critério canônico (o mais antigo)", async () => {
  const m = mundo();
  poe(m, { id: "cus_b", created: 9, metadata: { user_name: "x" } });
  poe(m, { id: "cus_a", created: 3, metadata: { user_name: "x" } });
  m.empresa.set(EMP, "cus_b");
  m.identidade.set(EMP, "cus_a");
  assert.equal((await localizarCustomerParaPortal(entrada(), portas(m)))?.id, "cus_a");
});

test("portal: Customer do SaaS achado pelo CNPJ também serve; apagado e de outra empresa não", async () => {
  const m = mundo();
  poe(m, { id: "cus_cnpj", created: 1, metadata: { user_cnpj: CNPJ, crm_cnpj: CNPJ } });
  poe(m, { id: "cus_outra", created: 1, metadata: { user_name: "x", crm_cnpj: CNPJ, empresaId: OUTRA } });
  assert.equal((await localizarCustomerParaPortal(entrada(), portas(m)))?.id, "cus_cnpj");
});

/* ── ID fiscal ──────────────────────────────────────────────────────────── */
/* O boleto (e o DDA do cliente) exige nome, endereço e ID FISCAL no Customer.
   O CNPJ ia só para `metadata.crm_cnpj`, que é texto livre e não entra em
   fatura nem em boleto — LIVA, 23/10/2026. */

test("grava o CNPJ como tax_id quando o Customer é criado", async () => {
  const m = mundo();
  const r = await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.deepEqual(m.taxIds.get(r.id), [{ type: "br_cnpj", value: CNPJ.replace(/\D/g, "") }]);
});

test("completa o ID fiscal num Customer que já existia sem ele", async () => {
  const m = mundo();
  poe(m, { id: "cus_antigo", metadata: { crm_company_id: EMP } });
  m.empresa.set(EMP, "cus_antigo");
  await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.deepEqual(m.taxIds.get("cus_antigo"), [{ type: "br_cnpj", value: CNPJ.replace(/\D/g, "") }]);
});

test("não duplica o ID fiscal que já está lá, mesmo formatado com pontuação", async () => {
  const m = mundo();
  poe(m, { id: "cus_antigo", metadata: { crm_company_id: EMP } });
  m.empresa.set(EMP, "cus_antigo");
  const d = CNPJ.replace(/\D/g, "");
  m.taxIds.set("cus_antigo", [{ type: "br_cnpj", value: `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}` }]);
  await garantirCustomerDaEmpresa(entrada(), portas(m));
  assert.equal(m.taxIds.get("cus_antigo")!.length, 1);
});

test("documento com tamanho inválido não vira tax_id nem derruba a venda", async () => {
  const m = mundo();
  const r = await garantirCustomerDaEmpresa(entrada({ cnpj: "123" }), portas(m));
  assert.equal(m.taxIds.get(r.id), undefined);
  assert.ok(r.id);
});

test("CPF entra como br_cpf, CNPJ como br_cnpj, lixo como nada", () => {
  assert.equal(tipoDeDocumentoBr("12345678901"), "br_cpf");
  assert.equal(tipoDeDocumentoBr("12345678000199"), "br_cnpj");
  assert.equal(tipoDeDocumentoBr("123"), null);
});
