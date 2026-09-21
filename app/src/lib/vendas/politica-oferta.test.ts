/**
 * Testes de domínio da política comercial (SPEC §50.3).
 *
 * Cobre os casos que o levantamento AS-IS apontou como risco financeiro real, e
 * os fluxos de referência do SPEC §49.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avaliarGanho, podeCriarProposta, jornadasPosVenda, type OfertaComercial,
} from "../../../../packages/domain/catalog/policies/politica-oferta.js";

const oferta = (p: Partial<OfertaComercial>): OfertaComercial => ({
  id: "of-1", codigo: "X", requiresCompanyBeforeProposal: true, requiresContract: false,
  winCondition: "PAYMENT_CONFIRMED", paymentTrigger: "ON_PROPOSAL_ACCEPTED",
  onboardingRequired: true, implementationRequired: false, ...p,
});
const estado = (p: Partial<Parameters<typeof avaliarGanho>[1]> = {}) => ({
  temEmpresa: true, propostaAceita: false, contratoAssinadoPorCompleto: false,
  pagamentoConfirmado: false, aprovacaoManual: false, ...p,
});

test("PABX: contrato assinado sozinho NÃO ganha sem a política mandar", () => {
  // Era exatamente isto que o banco permitia: won_evidence_policies liberava
  // PABX com signed_contract isolado, contra o que won-evidence.ts documentava.
  const pabx = oferta({ codigo: "PABX_CONTRACT", requiresContract: true, winCondition: "CONTRACT_FULLY_SIGNED", implementationRequired: true });
  const semAssinatura = avaliarGanho(pabx, estado({ propostaAceita: true }));
  assert.equal(semAssinatura.ganha, false);
  assert.deepEqual((semAssinatura as { falta: string[] }).falta, ["assinatura completa do contrato"]);
});

test("PABX: com contrato totalmente assinado, ganha — e o pagamento fica separado", () => {
  const pabx = oferta({ codigo: "PABX_CONTRACT", requiresContract: true, winCondition: "CONTRACT_FULLY_SIGNED", implementationRequired: true });
  const d = avaliarGanho(pabx, estado({ contratoAssinadoPorCompleto: true, pagamentoConfirmado: false }));
  assert.equal(d.ganha, true, "SPEC §15.2: venda por contrato ganha na assinatura, com cobrança podendo seguir aberta");
});

test("Callface AI direto: só ganha com pagamento, assinatura não basta", () => {
  const direto = oferta({ codigo: "CALLFACE_AI_DIRECT", winCondition: "PAYMENT_CONFIRMED" });
  assert.equal(avaliarGanho(direto, estado({ contratoAssinadoPorCompleto: true })).ganha, false);
  assert.equal(avaliarGanho(direto, estado({ pagamentoConfirmado: true })).ganha, true);
});

test("a mesma família com duas ofertas tem regras opostas, e isso é o ponto", () => {
  const direto = oferta({ codigo: "CALLFACE_AI_DIRECT", winCondition: "PAYMENT_CONFIRMED" });
  const contrato = oferta({ codigo: "CALLFACE_AI_CONTRACT", requiresContract: true, winCondition: "CONTRACT_FULLY_SIGNED" });
  const so_assinado = estado({ contratoAssinadoPorCompleto: true });
  assert.equal(avaliarGanho(direto, so_assinado).ganha, false);
  assert.equal(avaliarGanho(contrato, so_assinado).ganha, true);
});

test("aprovação manual vale como escotilha, mas é fato próprio", () => {
  const pabx = oferta({ codigo: "PABX_CONTRACT", winCondition: "CONTRACT_FULLY_SIGNED" });
  const d = avaliarGanho(pabx, estado({ aprovacaoManual: true }));
  assert.equal(d.ganha, true);
  assert.match(d.motivo, /manual/);
});

test("pessoa sem empresa entra no pipeline mas não cria proposta (SPEC §11.1)", () => {
  const of = oferta({ requiresCompanyBeforeProposal: true });
  const bloqueado = podeCriarProposta(of, { temEmpresa: false });
  assert.equal(bloqueado.ganha, false);
  assert.match(bloqueado.motivo, /empresa/);
  assert.equal(podeCriarProposta(of, { temEmpresa: true }).ganha, true);
});

test("PABX e White Label criam implantação além do onboarding (SPEC §18)", () => {
  assert.deepEqual(jornadasPosVenda(oferta({ onboardingRequired: true, implementationRequired: true })), ["ONBOARDING", "IMPLEMENTATION"]);
  assert.deepEqual(jornadasPosVenda(oferta({ onboardingRequired: true, implementationRequired: false })), ["ONBOARDING"]);
});

test("toda oferta ganha cria pelo menos onboarding", () => {
  for (const impl of [true, false]) {
    const js = jornadasPosVenda(oferta({ onboardingRequired: true, implementationRequired: impl }));
    assert.ok(js.includes("ONBOARDING"), "SPEC §18: todo serviço ganho passa por onboarding");
  }
});
