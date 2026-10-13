import test from "node:test";
import assert from "node:assert/strict";
import { dataBR, haQuanto, quandoBR } from "./datas-br";

const agora = new Date("2026-10-13T15:00:00Z");

test("timestamp cru do Postgres vira texto pt-BR no fuso de São Paulo", () => {
  assert.equal(dataBR("2026-10-07 23:46:28.445+00"), "07/10/2026");
  assert.equal(quandoBR("2026-10-07 23:46:28.445+00", agora), "07/10, 20:46");
  assert.equal(haQuanto("2026-10-07 23:46:28.445+00", agora), "há 5 dias");
});

test("hoje e coluna só-data", () => {
  assert.equal(quandoBR("2026-10-13 17:00:00+00", agora), "Hoje, 14:00");
  assert.equal(quandoBR("2026-10-13", agora), "Hoje");
  assert.equal(quandoBR(null, agora), "—");
});
