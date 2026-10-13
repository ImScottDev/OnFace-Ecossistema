import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("resolve em ANEXOS_LEGADO_DIR e recusa path traversal", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "legado-"));
  fs.writeFileSync(path.join(dir, "a_contrato.pdf"), "x");
  process.env.ANEXOS_LEGADO_DIR = dir;
  const { resolveLocalPath } = await import("./legacy-attachment-storage");
  assert.ok(resolveLocalPath("legado-zoho/a_contrato.pdf"));
  assert.equal(resolveLocalPath("legado-zoho/../../etc/passwd"), null);
  assert.equal(resolveLocalPath("legado-zoho/nao-existe.pdf"), null);
});
