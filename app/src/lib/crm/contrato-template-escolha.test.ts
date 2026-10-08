import assert from "node:assert/strict";
import test from "node:test";
import { escolherTemplateDe } from "./contrato-template";

const t = (nome: string, tipoDocumento: string, serviceFamily: string | null, commercialModel: string | null) => ({ nome, tipoDocumento, serviceFamily, commercialModel });
const base = [
  t("generico", "CONTRATO", null, null),
  t("pabx", "CONTRATO", "PABX", "CONTRATO_OBRIGATORIO"),
  t("wl", "CONTRATO", "WHITE_LABEL", "CONTRATO_OBRIGATORIO"),
  t("ai", "CONTRATO", "CALLFACE_AI", "CONTRATO_OBRIGATORIO"),
  t("aditivo-pabx", "ADITIVO", "PABX", null),
];

test("item do catálogo (PAGAMENTO_DIRETO) de PABX pega o contrato PABX, não o genérico", () => {
  assert.equal(escolherTemplateDe(base, "PAGAMENTO_DIRETO", "PABX")?.nome, "pabx");
  assert.equal(escolherTemplateDe(base, "PAGAMENTO_DIRETO", "CALLFACE_AI")?.nome, "ai");
});
test("modelo e família exatos continuam vencendo", () => {
  assert.equal(escolherTemplateDe(base, "CONTRATO_OBRIGATORIO", "WHITE_LABEL")?.nome, "wl");
});
test("família desconhecida ou sem template cai no genérico", () => {
  assert.equal(escolherTemplateDe(base, "PAGAMENTO_DIRETO", "UNKNOWN")?.nome, "generico");
  assert.equal(escolherTemplateDe(base, null, null)?.nome, "generico");
});
test("o tipo de documento separa contrato de aditivo", () => {
  assert.equal(escolherTemplateDe(base, "PAGAMENTO_DIRETO", "PABX", "ADITIVO")?.nome, "aditivo-pabx");
  assert.equal(escolherTemplateDe(base, "PAGAMENTO_DIRETO", "WHITE_LABEL", "ADITIVO"), null);
});
