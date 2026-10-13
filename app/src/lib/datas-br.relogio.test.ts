import { test } from "node:test";
import assert from "node:assert/strict";
import { relogioBR } from "./datas-br";

/* Rode com TZ=UTC e TZ=Asia/Tokyo também: o resultado não pode mudar. */
test("17:00Z é 13/10 14:00 em São Paulo, em qualquer fuso do processo", () => {
  const d = relogioBR("2026-10-13T17:00:00.000Z");
  assert.deepEqual([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()], [2026, 10, 13, 14, 0]);
});

test("texto cru do Postgres e virada de dia (02:30Z vira o dia anterior)", () => {
  const d = relogioBR("2026-10-14 02:30:00+00");
  assert.deepEqual([d.getDate(), d.getHours(), d.getMinutes()], [13, 23, 30]);
});
