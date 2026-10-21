import assert from "node:assert/strict";
import test from "node:test";
import { parseSpreadsheet } from "./route";

const parse = (texto: string) => parseSpreadsheet(
  new TextEncoder().encode(texto).buffer as ArrayBuffer,
  "teste-faturamento.csv",
);

test("somente linhas de clientes entram: rodapé total não duplica receita", () => {
  const p = parse([
    "CardCode;CardName;CPFCNPJ;ValorBruto",
    "C001;Empresa Alpha;12345678000190;1.234,56",
    "C002;Empresa Beta;98765432000100;765,44",
    ";;;2.000,00",
  ].join("\r\n"));
  assert.equal(p.rows.length, 2);
  assert.equal(p.footerTotal, 2000);
  assert.equal(p.errors.length, 0);
  assert.equal(p.rows.reduce((n, row) => n + row.billedValue, 0), 2000);
});

test("rodapé rotulado TOTAL GERAL também fica fora do ledger", () => {
  const p = parse("CardCode;CardName;CPFCNPJ;ValorBruto\nA;Empresa;12345678000190;80,50\n;TOTAL GERAL;;80,50");
  assert.equal(p.footerTotal, 80.50);
  assert.equal(p.rows.length, 1);
  assert.equal(p.errors.length, 0);
});

test("total divergente no rodapé bloqueia fechamento e não cria receita fictícia", () => {
  const p = parse("CardCode;CardName;CPFCNPJ;ValorBruto\nA;Empresa;12345678000190;80,50\n;;;161,00");
  assert.equal(p.rows.length, 1);
  assert.equal(p.footerTotal, 161);
  assert.match(p.errors.join(" "), /difere da soma/);
});

test("duplicata exata fica visível como exceção, sem dupla contagem", () => {
  const p = parse("CardCode;CardName;CPFCNPJ;ValorBruto\nA;Empresa;12345678000190;80,50\nA;Empresa;12345678000190;80,50");
  assert.equal(p.rows.length, 1);
  assert.equal(p.errors.length, 1);
  assert.match(p.errors[0], /duplicata/);
});

test("linha sem valor e documento ausente não são classificados como contrato", () => {
  const p = parse("CardCode;CardName;CPFCNPJ;ValorBruto\nA;Empresa;;\nB;Outra;;10,00");
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].document, null);
  assert.match(p.errors[0], /inválido/);
});

test("linha com delimitador no nome entre aspas não divide as colunas", () => {
  const p = parse('CardCode;CardName;CPFCNPJ;ValorBruto\nA;"Empresa; Tecnologia";12345678000190;1.000,00');
  assert.equal(p.rows[0].companyName, "Empresa; Tecnologia");
  assert.equal(p.rows[0].billedValue, 1000);
});

test("fatura sem colunas mínimas não é importável", () => {
  const p = parse("Nome;Email;Valor\nA;a@b.com;99,00");
  assert.equal(p.rows.length, 0);
  assert.match(p.errors[0], /Colunas obrigatórias ausentes/);
});
