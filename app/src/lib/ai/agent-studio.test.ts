import test from "node:test";
import assert from "node:assert/strict";
import { isSystemAgentSlug } from "./agent-studio";

test("NEXO e Hermes são identidades internas, não agentes configuráveis", () => {
  assert.equal(isSystemAgentSlug("nexo"), true);
  assert.equal(isSystemAgentSlug("hermes"), true);
  assert.equal(isSystemAgentSlug("sdr"), false);
});
