import assert from "node:assert/strict";
import test from "node:test";
import { preencherSemanas } from "./semanas";

test("semana sem ganho entra como zero até a semana corrente", () => {
  const s = preencherSemanas(
    [{ wk: "2026-09-07", mes: "07/09", ganhosAi: 3 }, { wk: "2026-09-21", mes: "21/09", ganhosAi: 1 }],
    new Date(2026, 9, 1), // quinta 01/10 → segunda 28/09
  );
  assert.deepEqual(s.map((x) => [x.wk, x.ganhosAi]), [
    ["2026-09-07", 3], ["2026-09-14", 0], ["2026-09-21", 1], ["2026-09-28", 0],
  ]);
  assert.equal(s[1].mes, "14/09");
});
