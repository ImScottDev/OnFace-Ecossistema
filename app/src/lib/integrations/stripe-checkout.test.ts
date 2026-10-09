import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { linhasDoCheckout, type CheckoutItem } from "./stripe-checkout";

const item = (stripePriceId: string, quantidade: number, nome = "Item"): CheckoutItem =>
  ({ nome, quantidade, valorUnitario: 10, valorTabela: 10, stripePriceId, moeda: "BRL" });

describe("linhasDoCheckout", () => {
  it("o mesmo Price em três linhas vira uma linha com a soma das quantidades", () => {
    assert.deepEqual(
      linhasDoCheckout([item("price_a", 5), item("price_a", 2), item("price_b", 1), item("price_a", 3)]),
      [{ stripePriceId: "price_a", quantidade: 10 }, { stripePriceId: "price_b", quantidade: 1 }],
    );
  });

  it("Prices diferentes ficam separados, na ordem em que aparecem", () => {
    assert.deepEqual(
      linhasDoCheckout([item("price_b", 1), item("price_a", 1)]).map((l) => l.stripePriceId),
      ["price_b", "price_a"],
    );
  });

  it("quantidade inválida vale 1, como na linha única", () => {
    assert.deepEqual(linhasDoCheckout([item("price_a", 0), item("price_a", 2.4)]), [{ stripePriceId: "price_a", quantidade: 3 }]);
  });

  it("item sem Price oficial falha em voz alta em vez de sumir do checkout", () => {
    assert.throws(() => linhasDoCheckout([item("", 1, "Ramal")]), /Ramal/);
  });
});
