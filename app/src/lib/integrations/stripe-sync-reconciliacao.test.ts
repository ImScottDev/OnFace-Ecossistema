import assert from "node:assert/strict";
import test from "node:test";
import { reconciliacaoDoServico } from "./stripe-sync";

// A regra é dos DOIS lados: assinatura morta encerra o serviço, assinatura viva tira o serviço do
// churn. O segundo sentido nasceu do estrago da carga do marco zero (37 serviços CHURNED com
// assinatura ativa, R$ 15.936,10/mês cobrados e fora do MRR, medido em 14/10/2026).

test("assinatura morta encerra o serviço", () => {
  assert.equal(reconciliacaoDoServico("canceled"), "encerrar");
  // o Stripe desistiu de cobrar: não é cliente ativo
  assert.equal(reconciliacaoDoServico("unpaid"), "encerrar");
});

test("assinatura viva tira o serviço do churn", () => {
  assert.equal(reconciliacaoDoServico("active"), "reativar");
  assert.equal(reconciliacaoDoServico("trialing"), "reativar");
  // past_due ainda é cobrança em curso, não churn
  assert.equal(reconciliacaoDoServico("past_due"), "reativar");
});

test("estado que não diz nada não mexe no serviço", () => {
  for (const status of ["incomplete", "incomplete_expired", "paused", ""]) {
    assert.equal(reconciliacaoDoServico(status), null, status);
  }
});

test("a decisão é por ESTADO, não por transição: mesmo estado dá sempre a mesma coisa", () => {
  // é o que torna o UPDATE idempotente — quem perdeu a borda não fica preso
  assert.equal(reconciliacaoDoServico("active"), reconciliacaoDoServico("active"));
  assert.equal(reconciliacaoDoServico("canceled"), reconciliacaoDoServico("canceled"));
});
