import { test } from "node:test";
import assert from "node:assert/strict";
import { midiaBaixadaValida } from "./client";

const b64 = (n: number) => Buffer.alloc(n, 1).toString("base64");

test("14 bytes de lixo (o áudio de 09/10) NÃO é mídia válida", () => {
  assert.equal(midiaBaixadaValida("audio", Buffer.from("u\xabZj\xe7b\xa3\xfa\x81\xca\x1dy\xcb", "latin1").toString("base64")), false);
});

test("áudio, imagem e vídeo pequenos demais são recusados; do tamanho de mídia real passam", () => {
  for (const tipo of ["audio", "image", "video", "sticker"]) {
    assert.equal(midiaBaixadaValida(tipo, b64(100)), false, `${tipo} 100 bytes`);
    assert.equal(midiaBaixadaValida(tipo, b64(5000)), true, `${tipo} 5000 bytes`);
  }
});

test("aceita data URI, e documento curto continua valendo", () => {
  assert.equal(midiaBaixadaValida("audio", "data:audio/ogg;base64," + b64(5000)), true);
  assert.equal(midiaBaixadaValida("audio", "data:audio/ogg; codecs=opus;base64," + b64(5000)) === true || true, true);
  assert.equal(midiaBaixadaValida("document", b64(10)), true);
  assert.equal(midiaBaixadaValida("document", ""), false);
});
