/**
 * Decisão da configuração do Portal: Stripe falso, sem rede.
 * O que se trava aqui: o ONFACE tem configuração PRÓPRIA, nunca usa nem altera a padrão da conta ou a do SaaS
 * sem escolha explícita, só escreve no Stripe quando a configuração diverge, e a falta de política vira mensagem.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  MARCA_CONFIG, MENSAGEM_FALTAM_POLITICAS, PortalConfigError, corpoDaConfiguracao, decidirConfiguracao, divergenciasDaConfiguracao,
  ehRecusaPorPoliticas, formDaConfiguracao, riscosDeConfiguracaoAlheia, type ConfiguracaoDoStripe, type PlanoDoPortal,
} from "./stripe-portal-config";

/** A configuração padrão da conta live em 13/10/2026 (bpc_1Rizqo…): feita à mão, deixa trocar o e-mail, sem documento fiscal. */
const PADRAO: ConfiguracaoDoStripe = {
  id: "bpc_padrao", active: true, is_default: true, metadata: {},
  features: {
    customer_update: { enabled: true, allowed_updates: ["name", "email", "address", "phone"] },
    invoice_history: { enabled: true }, payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true } },
    subscription_update: { enabled: false },
  },
  login_page: { enabled: true },
};
const DO_SAAS: ConfiguracaoDoStripe = { id: "bpc_saas", active: true, is_default: false, metadata: { managed_by: "callface-backend" }, features: {} };

const PLANOS: PlanoDoPortal[] = [
  { produto: "prod_a", precos: ["price_a1", "price_a2"] },
  { produto: "prod_b", precos: ["price_b1"] },
];

/**
 * Uma configuração do ONFACE como o Stripe a DEVOLVE: o que pedimos + campos que ele acrescenta
 * (pausa, nulls, feedback_options, adjustable_quantity…) e a ordem das listas trocada.
 */
function nossaEmDia(extra: Partial<ConfiguracaoDoStripe> = {}, planos: PlanoDoPortal[] | null = PLANOS): ConfiguracaoDoStripe {
  const c = JSON.parse(JSON.stringify(corpoDaConfiguracao({}, planos))) as Record<string, any>;
  c.features.customer_update.allowed_updates.reverse();
  c.features.subscription_cancel.cancellation_reason.options.reverse();
  c.features.subscription_cancel.cancellation_reason.feedback_options = [];
  c.features.subscription_pause = { enabled: false };
  if (c.features.subscription_update.products) {
    c.features.subscription_update.products = c.features.subscription_update.products.map((p: any) => ({ ...p, adjustable_quantity: { enabled: false, minimum: 1 } }));
    c.features.subscription_update.products.reverse();
  }
  c.login_page.url = null;
  return { id: "bpc_onface", active: true, is_default: false, ...c, ...extra };
}

test("sem configuração do ONFACE na conta: cria, e avisa que sem política o Stripe pode recusar", () => {
  const d = decidirConfiguracao({ lista: [PADRAO, DO_SAAS], politicas: {} });
  assert.deepEqual(d, { acao: "criar", semPoliticas: true });
  assert.deepEqual(decidirConfiguracao({ lista: [PADRAO, DO_SAAS], politicas: { privacyUrl: "https://x/p", termsUrl: "https://x/t" } }), { acao: "criar", semPoliticas: false });
});

test("NUNCA adota a configuração padrão da conta nem a do SaaS como se fosse do ONFACE", () => {
  const d = decidirConfiguracao({ lista: [PADRAO, DO_SAAS] });
  assert.equal(d.acao, "criar");
  // nem mesmo se alguém copiar a marca na do SaaS: a do SaaS é intocável
  const sequestrada = { ...DO_SAAS, metadata: { managed_by: "callface-backend", crm_portal: MARCA_CONFIG } };
  assert.equal(decidirConfiguracao({ lista: [sequestrada] }).acao, "criar");
});

test("configuração do ONFACE em dia é reusada; divergente é atualizada; inativa é ignorada", () => {
  assert.deepEqual(decidirConfiguracao({ lista: [PADRAO, nossaEmDia()], planos: PLANOS }), { acao: "reusar", id: "bpc_onface" });

  const aberta = nossaEmDia();
  aberta.features!.customer_update!.allowed_updates = ["address", "tax_id", "name", "phone", "email"];
  (aberta.features as any).subscription_update.proration_behavior = "none";
  const d = decidirConfiguracao({ lista: [aberta], planos: PLANOS });
  assert.equal(d.acao, "atualizar");
  assert.ok(d.acao === "atualizar" && d.diferencas.some((x) => /customer_update\.allowed_updates/.test(x)) && d.diferencas.some((x) => /proration_behavior: none → always_invoice/.test(x)));

  assert.equal(decidirConfiguracao({ lista: [nossaEmDia({ active: false })], planos: PLANOS }).acao, "criar");
});

test("o que o código pede é exatamente o que o drift considera em dia (form e verificação não se desencontram)", () => {
  assert.deepEqual(divergenciasDaConfiguracao(nossaEmDia(), {}, PLANOS), []);
  const form = formDaConfiguracao({}, PLANOS);
  assert.equal(form.get("features[subscription_update][enabled]"), "true");
  assert.equal(form.get("metadata[crm_portal]"), MARCA_CONFIG);
  // versão antiga da marca não é reconhecida como nossa
  assert.equal(decidirConfiguracao({ lista: [nossaEmDia({ metadata: { crm_portal: "crm-cliente-360-v1" } })], planos: PLANOS }).acao, "criar");
});

test("troca de plano: lista exata de produtos e prices, só o plano muda, upgrade cobra na hora e downgrade espera o ciclo", () => {
  const f = formDaConfiguracao({}, PLANOS);
  assert.equal(f.get("features[subscription_update][enabled]"), "true");
  assert.equal(f.get("features[subscription_update][products][0][product]"), "prod_a");
  assert.equal(f.get("features[subscription_update][products][0][prices][1]"), "price_a2");
  assert.equal(f.get("features[subscription_update][products][1][product]"), "prod_b");
  assert.equal(f.get("features[subscription_update][default_allowed_updates][0]"), "price");
  assert.equal(f.get("features[subscription_update][default_allowed_updates][1]"), null, "quantidade e cupom ficam de fora");
  assert.equal(f.get("features[subscription_update][proration_behavior]"), "always_invoice");
  assert.equal(f.get("features[subscription_update][schedule_at_period_end][conditions][0][type]"), "decreasing_item_amount");
  assert.equal(f.get("features[subscription_update][restrictions][on_open_invoices]"), "block");
  assert.equal(f.get("features[subscription_update][billing_cycle_anchor]"), "unchanged");
  assert.equal(f.get("features[subscription_cancel][proration_behavior]"), "none");
});

test("sem planos: troca de plano desligada; planos desconhecidos (null): a seção nem entra, nem na criação nem na comparação", () => {
  assert.equal(formDaConfiguracao({}, []).get("features[subscription_update][enabled]"), "false");
  assert.equal(formDaConfiguracao({}, []).get("features[subscription_update][products][0][product]"), null);
  const semSecao = formDaConfiguracao({}, null);
  assert.ok(![...semSecao.keys()].some((k) => k.startsWith("features[subscription_update]")));
  // configuração com troca de plano ligada não diverge quando não sabemos os planos
  assert.deepEqual(divergenciasDaConfiguracao(nossaEmDia(), {}, null), []);
  // mas diverge se os planos mudaram no catálogo
  assert.ok(divergenciasDaConfiguracao(nossaEmDia(), {}, [{ produto: "prod_a", precos: ["price_a1"] }]).some((x) => /products/.test(x)));
});

test("a página de login hospedada fica desligada e uma ligada à mão vira divergência", () => {
  assert.equal(formDaConfiguracao().get("login_page[enabled]"), "false");
  const ligada = nossaEmDia(); ligada.login_page = { enabled: true, url: "https://billing.stripe.com/p/login/x" };
  assert.ok(divergenciasDaConfiguracao(ligada, {}, PLANOS).some((x) => /login_page\.enabled: true → false/.test(x)));
});

test("id fixado no ambiente é respeitado, com os riscos de a padrão ser a escolhida; a do SaaS é recusada", () => {
  const ok = decidirConfiguracao({ fixadoId: "bpc_padrao", lista: [PADRAO] });
  assert.equal(ok.acao, "usar_fixada");
  assert.ok(ok.acao === "usar_fixada" && ok.riscos.some((r) => /PADRÃO/.test(r)) && ok.riscos.some((r) => /e-mail/.test(r)) && ok.riscos.some((r) => /documento fiscal/.test(r)));

  // sem lista (caminho quente, sem rede): usa o que foi fixado
  assert.deepEqual(decidirConfiguracao({ fixadoId: "bpc_qualquer" }), { acao: "usar_fixada", id: "bpc_qualquer", riscos: [] });

  const saas = decidirConfiguracao({ fixadoId: "bpc_saas", lista: [DO_SAAS] });
  assert.equal(saas.acao, "recusar_fixada");
  assert.equal(decidirConfiguracao({ fixadoId: "bpc_off", lista: [{ ...PADRAO, id: "bpc_off", active: false }] }).acao, "recusar_fixada");
  assert.ok(riscosDeConfiguracaoAlheia(PADRAO).length >= 3);
});

test("a recusa do Stripe por política/termos vira erro claro; outros erros não são engolidos", () => {
  const recusa = new Error("Stripe billing_portal/configurations: HTTP 400 {\"error\":{\"message\":\"You must provide a privacy policy URL and terms of service URL\"}}");
  assert.ok(ehRecusaPorPoliticas(recusa));
  assert.ok(!ehRecusaPorPoliticas(new Error("Stripe billing_portal/configurations: HTTP 401 Invalid API Key")));
  assert.ok(!ehRecusaPorPoliticas(new Error("Stripe billing_portal/configurations: HTTP 400 invalid enum value")));
  const e = new PortalConfigError("faltam_politicas", MENSAGEM_FALTAM_POLITICAS);
  assert.equal(e.codigo, "faltam_politicas");
  assert.match(e.message, /STRIPE_PORTAL_PRIVACY_URL/);
  assert.match(e.message, /STRIPE_PORTAL_TERMS_URL/);
});
