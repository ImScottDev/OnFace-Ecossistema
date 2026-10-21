import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FALHAS_PARA_HANDOFF, motivoDeHandoffAutomatico } from "./politica-handoff";

/** A configuração que está publicada na Lia em produção (21/10/2026). */
const LIA = { enabled: true, onToolFailure: true, onLowConfidence: true, confidenceThreshold: 0.65 };
const semSinal = { falhasDeFerramenta: 0, confianca: null };

test("execução limpa não transfere", () => {
  assert.equal(motivoDeHandoffAutomatico(LIA, semSinal), null);
});

test("uma falha só não transfere: o agente ainda pode contornar", () => {
  assert.equal(motivoDeHandoffAutomatico(LIA, { falhasDeFerramenta: 1, confianca: null }), null);
});

test("falha repetida transfere", () => {
  const m = motivoDeHandoffAutomatico(LIA, { falhasDeFerramenta: FALHAS_PARA_HANDOFF, confianca: null });
  assert.match(String(m), /ferramentas falharam/);
});

test("confiança abaixo do limiar transfere", () => {
  assert.match(String(motivoDeHandoffAutomatico(LIA, { falhasDeFerramenta: 0, confianca: 0.4 })), /confiança/);
});

test("confiança no limiar não transfere", () => {
  assert.equal(motivoDeHandoffAutomatico(LIA, { falhasDeFerramenta: 0, confianca: 0.65 }), null);
});

test("sem confiança declarada, a regra de confiança não dispara", () => {
  assert.equal(motivoDeHandoffAutomatico(LIA, { falhasDeFerramenta: 0, confianca: null }), null);
});

test("cada chave desliga só a sua regra", () => {
  const semFalha = { ...LIA, onToolFailure: false };
  assert.equal(motivoDeHandoffAutomatico(semFalha, { falhasDeFerramenta: 5, confianca: null }), null);
  assert.match(String(motivoDeHandoffAutomatico(semFalha, { falhasDeFerramenta: 5, confianca: 0.1 })), /confiança/);

  const semConfianca = { ...LIA, onLowConfidence: false };
  assert.equal(motivoDeHandoffAutomatico(semConfianca, { falhasDeFerramenta: 0, confianca: 0.1 }), null);
});

test("handoff desligado na versão não transfere por caminho nenhum", () => {
  const off = { ...LIA, enabled: false };
  assert.equal(motivoDeHandoffAutomatico(off, { falhasDeFerramenta: 9, confianca: 0.01 }), null);
});

test("versão sem configuração de handoff não transfere sozinha", () => {
  assert.equal(motivoDeHandoffAutomatico(null, { falhasDeFerramenta: 9, confianca: 0.01 }), null);
  assert.equal(motivoDeHandoffAutomatico({}, { falhasDeFerramenta: 9, confianca: 0.01 }), null);
});

test("limiar escrito em porcentagem é entendido como porcentagem", () => {
  const cfg = { ...LIA, confidenceThreshold: 80 };
  assert.match(String(motivoDeHandoffAutomatico(cfg, { falhasDeFerramenta: 0, confianca: 0.7 })), /0\.80/);
  assert.equal(motivoDeHandoffAutomatico(cfg, { falhasDeFerramenta: 0, confianca: 0.9 }), null);
});

test("limiar inválido cai no padrão em vez de liberar tudo", () => {
  for (const ruim of [0, -1, Number.NaN, "alto", null, undefined]) {
    const cfg = { ...LIA, confidenceThreshold: ruim };
    assert.match(String(motivoDeHandoffAutomatico(cfg, { falhasDeFerramenta: 0, confianca: 0.5 })), /0\.65/, `limiar ${String(ruim)}`);
  }
});
