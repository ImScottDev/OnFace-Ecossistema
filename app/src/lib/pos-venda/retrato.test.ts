import { test } from "node:test";
import assert from "node:assert/strict";
import { montarRetrato } from "./retrato";

const agora = new Date("2026-11-09T12:00:00Z");
const base = { snapshotAt: new Date("2026-11-09T04:07:00Z"), confianca: "deterministic", chamadasFinalizadas: 14224, campanhasConcluidas: 3, campanhasAtivas: 4, agentesProntos: 2, ultimaAtividadeEm: new Date("2026-11-06T10:00:00Z") };

test("snapshot confiável e recente preenche o retrato", () => {
  const r = montarRetrato(base, agora);
  assert.equal(r.indisponivel, false);
  assert.equal(r.ligacoesFeitas, 14224);
  assert.equal(r.campanhasDisparadas, 7);
  assert.equal(r.agenteConfigurado, true);
  assert.equal(r.primeiroAcessoEm, null);
});
test("sem snapshot, identidade provável ou snapshot velho: indisponível, números null e nunca zero", () => {
  for (const s of [null, { ...base, confianca: "probable" }, { ...base, snapshotAt: new Date("2026-11-01T00:00:00Z") }]) {
    const r = montarRetrato(s, agora);
    assert.equal(r.indisponivel, true);
    assert.equal(r.ligacoesFeitas, null);
    assert.equal(r.campanhasDisparadas, null);
    assert.equal(r.agenteConfigurado, null);
  }
});
test("zero real continua zero: agente não configurado é false, não null", () => {
  const r = montarRetrato({ ...base, agentesProntos: 0, campanhasConcluidas: 0, campanhasAtivas: 0 }, agora);
  assert.equal(r.agenteConfigurado, false);
  assert.equal(r.campanhasDisparadas, 0);
});
