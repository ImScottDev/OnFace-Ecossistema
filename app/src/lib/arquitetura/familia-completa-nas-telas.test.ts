import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Família nova entra em TODA tabela por família, e o aceite recalcula o valor do negócio.
 *
 * Duas travas de fonte, nascidas de 03/11/2026:
 *
 * 1. Em 30/10 o Assistant entrou na lista `PK` do Cliente 360, mas não no dicionário `FAM` (rótulo, cor,
 *    ícone). `FAM[k].l` leu `undefined` e a tela caiu para TODOS os clientes, porque nenhum tem Assistant e
 *    a lista "o que ainda não tem" sempre o inclui. Toda família de `PK` precisa ter entrada nos
 *    dicionários que a tela lê pela chave.
 * 2. O aceite grava o valor do que foi aceito (`syncNegocioValoresFromPropostas`). Sem isso o ganho copiava
 *    para `mrr_fechado` a soma da proposta aceita com a expirada (R$ 789,80 para uma venda de R$ 89,90).
 */

const ler = (...p: string[]) => readFileSync(join("src", ...p), "utf8");

/** O trecho entre dois marcadores: o corpo de um dicionário declarado em sequência. */
const entre = (fonte: string, de: string, ate: string) => {
  const i = fonte.indexOf(de), j = fonte.indexOf(ate, i);
  assert.ok(i >= 0 && j > i, `não achei o trecho "${de}" … "${ate}": a trava precisa acompanhar a mudança do arquivo`);
  return fonte.slice(i, j);
};
const familiasDe = (fonte: string) => {
  const m = /const PK = \[([^\]]*)\]/.exec(fonte);
  assert.ok(m, "não achei `const PK = [...]`");
  return [...m[1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]);
};
const temChave = (trecho: string, chave: string) => new RegExp(`(^|[\\s,{])${chave}\\s*:`).test(trecho);

test("Cliente 360 (adaptador): toda família de PK tem entrada em FAM", () => {
  const f = ler("components", "onface", "proto", "ClienteProto.tsx");
  const fam = entre(f, "const FAM:", "const PK =");
  for (const k of familiasDe(f)) assert.ok(temChave(fam, k), `ClienteProto: ${k} está em PK e falta em FAM — a tela cai ao ler FAM[${k}].l`);
});

test("Cliente 360 (protótipo): toda família de PK tem entrada em FAM e em SKU", () => {
  const f = ler("components", "onface", "proto", "ClienteLiga.tsx");
  const fam = entre(f, "const FAM =", "const PK =");
  const sku = entre(f, "const SKU =", "const escolher");
  for (const k of familiasDe(f)) {
    assert.ok(temChave(fam, k), `ClienteLiga: ${k} está em PK e falta em FAM`);
    assert.ok(temChave(sku, k), `ClienteLiga: ${k} está em PK e falta em SKU — escolher() lê SKU[${k}] sem checar`);
  }
});

test("o aceite recalcula o valor do negócio", () => {
  const aceite = ler("lib", "crm", "proposta-aceite.ts");
  assert.ok(aceite.includes("syncNegocioValoresFromPropostas(proposta.negocioId)"),
    "proposta-aceite.ts deixou de recalcular o valor do negócio no aceite: o ganho volta a copiar a soma das alternativas");
});
