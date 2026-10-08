import { test } from "node:test";
import assert from "node:assert/strict";
import { decodificarAnexo } from "./anexo-whatsapp";

test("data URI de áudio do MediaRecorder perde os parâmetros do MIME", () => {
  const r = decodificarAnexo("data:audio/webm;codecs=opus;base64,aGVsbG8=", "audio");
  assert.equal(r?.mime, "audio/webm");
  assert.equal(Buffer.from(r!.bytes).toString(), "hello");
  assert.match(r!.nome, /^audio-\d+\.webm$/);
});

test("mantém o nome do arquivo e recusa o que não é base64", () => {
  assert.equal(decodificarAnexo("data:application/pdf;base64,JVBERg==", "document", "Proposta.pdf")?.nome, "Proposta.pdf");
  assert.equal(decodificarAnexo("data:text/plain,abc", "document"), null);
  assert.equal(decodificarAnexo("não é data uri", "image"), null);
});
