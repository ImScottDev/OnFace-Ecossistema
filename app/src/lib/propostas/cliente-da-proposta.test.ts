import test from "node:test";
import assert from "node:assert/strict";
import { propostaPdfHtml } from "./proposta-pdf.js";

const base = {
  numero: 1643, versao: 1, moeda: "BRL", itens: [],
  leadNome: "Suelen", leadEmpresa: "Marta Santos da Silva",
} as Parameters<typeof propostaPdfHtml>[0];

// A empresa vinculada manda sobre o texto livre do lead: a P-1643 saiu para a
// Ss Power Academy com o nome de outra pessoa na capa (06/11/2026).
test("empresa vinculada ganha do texto livre do lead", () => {
  const html = propostaPdfHtml({ ...base, clienteNome: "Ss Power Academy LTDA" });
  assert.ok(html.includes("Ss Power Academy LTDA"));
  assert.ok(!html.includes("Marta Santos da Silva"));
});

// Campo do lead vazio fazia o PDF cair no nome da pessoa (P-1635, ELGIN).
test("com o campo do lead vazio, nao cai no nome da pessoa", () => {
  const html = propostaPdfHtml({ ...base, leadEmpresa: null, leadNome: "Ivo Cavalcante", clienteNome: "ELGIN" });
  assert.ok(html.includes("ELGIN"));
  assert.ok(!html.includes("Ivo Cavalcante"));
});

test("sem cliente resolvido, mantem o texto livre de antes", () => {
  assert.ok(propostaPdfHtml({ ...base, clienteNome: null }).includes("Marta Santos da Silva"));
});
