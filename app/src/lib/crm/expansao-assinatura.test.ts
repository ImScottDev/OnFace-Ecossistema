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
  assert.equal(por.get("price_full")?.quantidade, 2);
});

test("Prices diferentes continuam sendo itens diferentes", () => {
  const por = agruparPorPrice([
    item({ stripePriceId: "price_full", quantidade: 2 }),
    item({ stripePriceId: "price_pabx", quantidade: 3 }),
  ]);
  assert.deepEqual([...por.entries()].map(([p, v]) => [p, v.quantidade]).sort(), [["price_full", 2], ["price_pabx", 3]]);
});

/* O preço combinado agora entra na assinatura pelo produto oficial, para mais
   ou para menos. Só para quem não tem produto oficial é que não há onde pôr o
   valor — e aí parar é melhor do que cobrar o da tabela. */
test("fora da tabela passa quando há produto oficial para levar o valor", () => {
  const comProduto = [item({ stripePriceId: "price_full", valorUnitario: 149.9, stripeProductId: "prod_full" })];
  assert.equal(itemComDescontoQueNaoPodeIr(comProduto), null);
  const acima = [item({ stripePriceId: "price_full", valorUnitario: 5000, stripeProductId: "prod_full" })];
  assert.equal(itemComDescontoQueNaoPodeIr(acima), null);
});

test("sem produto oficial, item fora da tabela para a venda em vez de cobrar o valor errado", () => {
  const achado = itemComDescontoQueNaoPodeIr([item({ stripePriceId: "price_full", valorUnitario: 149.9 })]);
  assert.equal(achado?.stripePriceId, "price_full");
  // no preço de tabela segue sem produto: o Price oficial dá conta
  assert.equal(itemComDescontoQueNaoPodeIr([item({ stripePriceId: "price_full" })]), null);
});

test("preço cheio passa, e um centavo de arredondamento não é desconto", () => {
  assert.equal(itemComDescontoQueNaoPodeIr([item({ stripePriceId: "price_full" })]), null);
  assert.equal(itemComDescontoQueNaoPodeIr([item({ stripePriceId: "price_full", valorUnitario: 179.895 })]), null);
});
