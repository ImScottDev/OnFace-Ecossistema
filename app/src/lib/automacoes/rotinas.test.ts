import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROTINAS_AGENDADAS } from "./rotinas";

// O catálogo da tela precisa ser exatamente o que o worker agenda: rotina nova
// no worker sem entrada aqui some da tela; entrada aqui sem worker é rotina
// inventada.
test("catálogo de rotinas bate com os upsertJobScheduler do worker", () => {
  const fonte = readFileSync(join(__dirname, "../../worker/index.ts"), "utf8");
  const doWorker = new Set([...fonte.matchAll(/upsertJobScheduler\(\s*"([^"]+)"/g)].map((m) => m[1]));
  const doCatalogo = new Set(ROTINAS_AGENDADAS.map((r) => r.chave));

  assert.ok(doWorker.size > 0, "não achou nenhum scheduler no worker");
  assert.deepEqual([...doCatalogo].sort(), [...doWorker].sort());
  assert.equal(doCatalogo.size, ROTINAS_AGENDADAS.length, "chave duplicada no catálogo");
});
