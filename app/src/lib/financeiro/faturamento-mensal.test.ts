import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bucketDaNatureza, montarSerie, ultimosMeses } from "./faturamento-natureza";

describe("faturamento mensal por natureza", () => {
  it("separa MRR, avulso, débito e não classificado sem misturar", () => {
    assert.deepEqual(["MRR", "SETUP", "ONE_TIME", "USAGE", "DEBITO_RECUPERADO", "UNKNOWN", null].map(bucketDaNatureza), ["mrr", "avulso", "avulso", "avulso", "debito", "semClasse", "semClasse"]);
  });
  it("janela de meses cruza o ano", () => {
    assert.deepEqual(ultimosMeses("2026-02", 4), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("set/2026 TX: 3.000 MRR + 6.000 débito = total 9.000; mês sem linha vale 0", () => {
    const s = montarSerie([
      { competencia: "2026-09", natureza: "MRR", valor: 3000 },
      { competencia: "2026-09", natureza: "DEBITO_RECUPERADO", valor: 6000 },
      { competencia: "2020-01", natureza: "MRR", valor: 99 }, // fora da janela
    ], ["2026-08", "2026-09"]);
    assert.equal(s[0].total, 0);
    for (const [k, v] of Object.entries({ mrr: 3000, debito: 6000, avulso: 0, total: 9000 })) assert.equal((s[1] as any)[k], v);
  });
});
