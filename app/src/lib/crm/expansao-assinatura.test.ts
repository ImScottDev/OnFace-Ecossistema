/**
 * Expansão: as duas regras que decidem quanto o cliente paga.
 *
 * Regra pura, sem banco e sem Stripe — roda no portão.
 *
 *   node --import tsx --test src/lib/crm/expansao-assinatura.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { agruparPorPrice, itemComDescontoQueNaoPodeIr, type ItemDeExpansao } from "./expansao-assinatura";

const item = (p: Partial<ItemDeExpansao> & { stripePriceId: string }): ItemDeExpansao => ({
  nome: "Callface AI - Full · Mensal", quantidade: 1, valorUnitario: 179.9, valorTabela: 179.9, ...p,
});

test("o mesmo Price em duas linhas vira UMA alteração com a quantidade somada", () => {
  /* O caso real (proposta #1566, 14/10/2026): duas linhas de R$ 179,90 do
     mesmo produto. Uma alteração por linha cobraria duas vezes e a segunda
     ainda seria recusada — `adicionar_item` não aceita Price repetido. */
  const por = agruparPorPrice([item({ stripePriceId: "price_full" }), item({ stripePriceId: "price_full" })]);
  assert.equal(por.size, 1);
  assert.equal(por.get("price_full"), 2);
});

test("Prices diferentes continuam sendo itens diferentes", () => {
  const por = agruparPorPrice([
    item({ stripePriceId: "price_full", quantidade: 2 }),
    item({ stripePriceId: "price_pabx", quantidade: 3 }),
  ]);
  assert.deepEqual([...por.entries()].sort(), [["price_full", 2], ["price_pabx", 3]]);
});

test("item negociado abaixo da tabela não vai para a assinatura", () => {
  // Cobraria o valor cheio: mais do que o cliente aceitou na proposta.
  const achado = itemComDescontoQueNaoPodeIr([item({ stripePriceId: "price_full", valorUnitario: 149.9 })]);
  assert.equal(achado?.stripePriceId, "price_full");
});

test("preço cheio passa, e um centavo de arredondamento não é desconto", () => {
  assert.equal(itemComDescontoQueNaoPodeIr([item({ stripePriceId: "price_full" })]), null);
  assert.equal(itemComDescontoQueNaoPodeIr([item({ stripePriceId: "price_full", valorUnitario: 179.895 })]), null);
});
