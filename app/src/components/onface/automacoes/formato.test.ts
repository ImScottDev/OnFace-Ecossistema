import { test } from "node:test";
import assert from "node:assert/strict";
import { quandoRelativo } from "./formato";

test("quandoRelativo arredonda para baixo em cada unidade", () => {
  const agora = Date.parse("2026-10-01T10:00:00Z");
  const antes = (ms: number) => new Date(agora - ms).toISOString();
  assert.equal(quandoRelativo(antes(30_000), agora), "agora");
  assert.equal(quandoRelativo(antes(59.9 * 60_000), agora), "há 59 min");
  assert.equal(quandoRelativo(antes(2.9 * 3_600_000), agora), "há 2 h");
  assert.equal(quandoRelativo(antes(8.5 * 86_400_000), agora), "há 8 dias");
  assert.equal(quandoRelativo(antes(1.2 * 86_400_000), agora), "há 1 dia");
});
