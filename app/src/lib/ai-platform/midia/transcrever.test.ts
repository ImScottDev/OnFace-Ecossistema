import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ehMidiaSalvaPorNos } from "./transcrever";

/* O prefixo é o defeito inteiro: a agente nunca ouviu um áudio porque quem salva
   devolve `/api/uploads/...` e aqui só `/uploads/...` era aceito — 0 de 1.849
   áudios transcritos em produção, com o arquivo no disco e a chave paga. O teste
   antigo usava à mão o prefixo curto, que nenhum código de produção produz: por
   isso a suíte ficava verde com a funcionalidade morta. Aqui o primeiro caso é o
   prefixo REAL. */

test("aceita o prefixo que a produção grava", () => {
  assert.equal(ehMidiaSalvaPorNos("/api/uploads/audio.ogg"), true);
});

test("aceita também o prefixo curto, que o histórico usou", () => {
  assert.equal(ehMidiaSalvaPorNos("/uploads/audio.ogg"), true);
});

test("URL da CDN do WhatsApp não é mídia nossa", () => {
  assert.equal(ehMidiaSalvaPorNos("https://mmg.whatsapp.net/v/t62.7117-24/abc.enc"), false);
});

test("caminho parecido não passa", () => {
  assert.equal(ehMidiaSalvaPorNos("/uploadsfalso/audio.ogg"), false);
  assert.equal(ehMidiaSalvaPorNos("/api/uploadsfalso/audio.ogg"), false);
  assert.equal(ehMidiaSalvaPorNos("uploads/audio.ogg"), false);
});

test("vazio, nulo e indefinido não quebram", () => {
  assert.equal(ehMidiaSalvaPorNos(null), false);
  assert.equal(ehMidiaSalvaPorNos(undefined), false);
  assert.equal(ehMidiaSalvaPorNos(""), false);
});
