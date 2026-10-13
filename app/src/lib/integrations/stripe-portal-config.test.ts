/**
 * Decisão da configuração do Portal: Stripe falso, sem rede.
 * O que se trava aqui: o ONFACE tem configuração PRÓPRIA, nunca usa nem altera a padrão da conta ou a do SaaS
 * sem escolha explícita, só escreve no Stripe quando a configuração diverge, e a falta de política vira mensagem.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  MARCA_CONFIG, MENSAGEM_FALTAM_POLITICAS, PortalConfigError, decidirConfiguracao, divergenciasDaConfiguracao, ehRecusaPorPoliticas,
  formDaConfiguracao, riscosDeConfiguracaoAlheia, type ConfiguracaoDoStripe,
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
};
const DO_SAAS: ConfiguracaoDoStripe = { id: "bpc_saas", active: true, is_default: false, metadata: { managed_by: "callface-backend" }, features: {} };

/** Uma configuração do ONFACE exatamente como o `formDaConfiguracao` pede. */
function nossaEmDia(extra: Partial<ConfiguracaoDoStripe> = {}): ConfiguracaoDoStripe {
  return {
    id: "bpc_onface", active: true, is_default: false, metadata: { crm_portal: MARCA_CONFIG },
    features: {
      customer_update: { enabled: true, allowed_updates: ["address", "tax_id", "name", "phone"] },
      invoice_history: { enabled: true }, payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true } },
      subscription_update: { enabled: false },
    },
    ...extra,
  };
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
  assert.deepEqual(decidirConfiguracao({ lista: [PADRAO, nossaEmDia()] }), { acao: "reusar", id: "bpc_onface" });

  const aberta = nossaEmDia();
  aberta.features!.customer_update!.allowed_updates = ["address", "tax_id", "name", "phone", "email"];
  aberta.features!.subscription_update = { enabled: true };
  const d = decidirConfiguracao({ lista: [aberta] });
  assert.equal(d.acao, "atualizar");
  assert.ok(d.acao === "atualizar" && d.diferencas.some((x) => /campos editáveis/.test(x)) && d.diferencas.some((x) => /troca de plano ligada/.test(x)));

  assert.equal(decidirConfiguracao({ lista: [nossaEmDia({ active: false })] }).acao, "criar");
});

test("o que o código pede é exatamente o que o drift considera em dia (form e verificação não se desencontram)", () => {
  assert.deepEqual(divergenciasDaConfiguracao(nossaEmDia()), []);
  const form = formDaConfiguracao();
  assert.equal(form.get("features[subscription_update][enabled]"), "false");
  assert.equal(form.get("metadata[crm_portal]"), MARCA_CONFIG);
  // versão antiga da marca força atualização
  assert.equal(decidirConfiguracao({ lista: [nossaEmDia({ metadata: { crm_portal: "crm-cliente-360-v0" } })] }).acao, "criar");
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
