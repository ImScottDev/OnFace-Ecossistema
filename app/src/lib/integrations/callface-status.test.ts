import { strict as assert } from "node:assert";
import { test } from "node:test";
import { labelDoStatusDaLigacao, ligacaoTeveConversa } from "./callface";

/* Status reais vistos em produção nas 7.215 ligações registradas:
   FINISHED 4.580, FAILED 1.476, VOICEMAIL 766, MISSED 380, BUSY 13.
   `VOICEMAIL` ganhou status próprio na plataforma e aqui não tinha tradução
   nem entrava na régua de "não houve conversa". */

test("caixa postal não é conversa", () => {
  assert.equal(ligacaoTeveConversa("VOICEMAIL", 60), false);
  assert.equal(labelDoStatusDaLigacao("VOICEMAIL"), "caixa postal");
});

test("os outros status sem conversa seguem valendo", () => {
  for (const s of ["FAILED", "NOT_COMPLETED", "BUSY", "MISSED", "NOT_ANSWERED"]) {
    assert.equal(ligacaoTeveConversa(s, 120), false, s);
  }
});

test("atendida e longa é conversa", () => {
  assert.equal(ligacaoTeveConversa("FINISHED", 60), true);
  assert.equal(ligacaoTeveConversa("ANSWERED", 15), true);
});

test("atendida mas curta demais não é conversa", () => {
  assert.equal(ligacaoTeveConversa("FINISHED", 14), false);
});

test("status desconhecido não vira rótulo feio nem some", () => {
  assert.equal(labelDoStatusDaLigacao("ALGO_NOVO"), "algo_novo");
  assert.equal(labelDoStatusDaLigacao(undefined), "finalizada");
});

test("minúsculo e misto são tratados igual", () => {
  assert.equal(ligacaoTeveConversa("voicemail", 60), false);
  assert.equal(labelDoStatusDaLigacao("Voicemail"), "caixa postal");
});
