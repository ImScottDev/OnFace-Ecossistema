import assert from "node:assert/strict";
import test from "node:test";
import { ESTADOS_PROSPECCAO } from "./dominio";
import { destinosPermitidos, transicao } from "./prospeccao-transicoes";

test("Novo → Em cadência exige cadência; Em cadência → Respondeu exige evidência ou confirmação", () => {
  assert.deepEqual(transicao("novo", "em_cadencia"), { permitida: true, exige: "cadencia" });
  assert.deepEqual(transicao("em_cadencia", "respondeu"), { permitida: true, exige: "evidencia_ou_confirmacao" });
});

test("Novo não pula para Respondeu nem para Sem resposta", () => {
  for (const para of ["respondeu", "sem_resposta"] as const) {
    const t = transicao("novo", para);
    assert.equal(t.permitida, false);
    assert.match((t as { motivo: string }).motivo, /cadência/);
  }
});

test("desfechos: pré-qualificar não exige nada, oportunidade exige fluxo, descartar exige motivo", () => {
  for (const de of ["novo", "em_cadencia", "respondeu", "sem_resposta"] as const) {
    assert.deepEqual(transicao(de, "pre_qualificado"), { permitida: true, exige: null });
    assert.deepEqual(transicao(de, "oportunidade"), { permitida: true, exige: "familia_e_responsavel" });
    assert.deepEqual(transicao(de, "descartado"), { permitida: true, exige: "motivo" });
  }
});

test("quem já saiu da prospecção não volta a nenhum estado", () => {
  for (const de of ["pre_qualificado", "oportunidade", "descartado"] as const) {
    for (const para of ESTADOS_PROSPECCAO.filter((e) => e !== de)) {
      assert.equal(transicao(de, para).permitida, false, `${de} → ${para}`);
    }
  }
});

test("Respondeu não volta para a cadência nem vira Sem resposta", () => {
  assert.equal(transicao("respondeu", "em_cadencia").permitida, false);
  assert.equal(transicao("respondeu", "sem_resposta").permitida, false);
});

test("Sem resposta pode ser retomada em nova cadência", () => {
  assert.deepEqual(transicao("sem_resposta", "em_cadencia"), { permitida: true, exige: "cadencia" });
});

test("mesmo estado é recusado como no-op e estado nulo não tem transição", () => {
  const t = transicao("novo", "novo");
  assert.equal(t.permitida, false);
  assert.equal((t as { igual?: boolean }).igual, true);
  assert.equal(transicao(null, "novo").permitida, false);
});

test("destinosPermitidos concorda com transicao()", () => {
  for (const de of ESTADOS_PROSPECCAO) {
    const esperados = ESTADOS_PROSPECCAO.filter((p) => transicao(de, p).permitida).sort();
    assert.deepEqual(destinosPermitidos(de).sort(), esperados, de);
  }
});
