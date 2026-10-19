import { test } from "node:test";
import assert from "node:assert/strict";
import { cadenceDefinitions } from "./schema";

test("schema de cadências declara propriedade e visibilidade", () => {
  assert.equal(cadenceDefinitions.ownerId.name, "owner_id");
  assert.equal(cadenceDefinitions.visibility.name, "visibility");
});
