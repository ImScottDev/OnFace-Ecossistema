import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { oportunidadeAptaParaGanho } from "./oportunidade-apta";

describe("oportunidade apta para o Ganho", () => {
  it("sem empresa não é apta e diz por quê", () => {
    for (const empresaId of [null, undefined, "", "  "]) {
      const r = oportunidadeAptaParaGanho({ empresaId });
      assert.equal(r.apta, false);
      if (!r.apta) { assert.equal(r.codigo, "sem_empresa"); assert.match(r.motivo, /empresa/i); }
    }
  });

  it("com empresa é apta", () => {
    assert.deepEqual(oportunidadeAptaParaGanho({ empresaId: "13c2da6d-65e8-48a3-9539-b1b7282e7532" }), { apta: true });
  });
});
