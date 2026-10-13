import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcularItens, subtotalValidado } from "./proposta-regras";

const codigo = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as { codigo?: string }).codigo; } return null; };
const item = (o: Partial<Parameters<typeof subtotalValidado>[0]> = {}) => ({ quantidade: 2, valorUnitario: 100, desconto: 0, descontoTipo: "valor", ...o });

describe("subtotalValidado", () => {
  it("calcula valor e percentual", () => {
    assert.equal(subtotalValidado(item({ desconto: 50 })), 150);
    assert.equal(subtotalValidado(item({ desconto: 10, descontoTipo: "percentual" })), 180);
  });
  it("desconto igual ao bruto zera, mas não fica negativo", () => {
    assert.equal(subtotalValidado(item({ desconto: 200 })), 0);
    assert.equal(subtotalValidado(item({ desconto: 100, descontoTipo: "percentual" })), 0);
  });
  it("desconto acima do bruto ou de 100% é recusado", () => {
    assert.equal(codigo(() => subtotalValidado(item({ desconto: 200.01 }))), "item_desconto_maior_que_total");
    assert.equal(codigo(() => subtotalValidado(item({ desconto: 100.01, descontoTipo: "percentual" }))), "item_desconto_maior_que_total");
  });
  it("quantidade zero, negativa ou inválida é recusada", () => {
    for (const q of [0, -1, NaN, Infinity]) assert.equal(codigo(() => subtotalValidado(item({ quantidade: q }))), "item_quantidade_invalida");
  });
  it("valor e desconto negativos ou NaN são recusados", () => {
    assert.equal(codigo(() => subtotalValidado(item({ valorUnitario: -1 }))), "item_valor_invalido");
    assert.equal(codigo(() => subtotalValidado(item({ desconto: -1 }))), "item_desconto_invalido");
    assert.equal(codigo(() => subtotalValidado(item({ desconto: NaN }))), "item_desconto_invalido");
  });
  it("valor zero (item de cortesia) é aceito", () => {
    assert.equal(subtotalValidado(item({ valorUnitario: 0 })), 0);
  });
});

describe("calcularItens", () => {
  it("separa recorrente de avulso e soma o total", () => {
    const r = calcularItens([{ ...item(), tipo: "recorrente" }, { ...item({ quantidade: 1 }), tipo: "setup" }]);
    assert.deepEqual([r.totalRecorrente, r.totalAvulso, r.totalGeral], [200, 100, 300]);
  });
  it("sem itens é recusado", () => {
    assert.equal(codigo(() => calcularItens([])), "proposta_sem_itens");
  });
});

import { dataValidadePadrao, validarDataValidade, validarMoeda } from "./proposta-regras";

describe("moeda e validade", () => {
  it("só BRL, em qualquer caixa; USD/EUR/CAD recusadas com erro claro", () => {
    assert.equal(validarMoeda("brl"), "BRL");
    for (const m of ["USD", "EUR", "CAD", "", null]) assert.equal(codigo(() => validarMoeda(m)), "moeda_nao_suportada");
  });
  const hoje = new Date("2026-10-13T12:00:00Z");
  it("validade padrão é 14 dias (não 10)", () => assert.equal(dataValidadePadrao(hoje), "2026-10-27"));
  it("data de validade: hoje e +30 passam; ontem, +31 e lixo não", () => {
    assert.equal(validarDataValidade("2026-10-13", hoje), "2026-10-13");
    assert.equal(validarDataValidade("2026-11-12", hoje), "2026-11-12");
    for (const d of ["2026-10-12", "2026-11-13", "2026-02-30", "amanhã"]) assert.equal(codigo(() => validarDataValidade(d, hoje)), "validade_invalida");
  });
});
