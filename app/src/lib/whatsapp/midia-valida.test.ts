import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* UPLOADS_DIR é lido quando o módulo carrega: define antes de importar. */
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "onface-midia-"));
process.env.UPLOADS_DIR = pasta;
let client: typeof import("./client");
before(async () => { client = await import("./client"); });

const bytesReais = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 31 + 7) % 256));
const b64 = bytesReais.toString("base64");

test("cabeçalho EXATO do wuzapi 1.0.8 (com espaço depois do ;) é separado certo", () => {
  const r = client.separarDataUri(`data:audio/ogg; codecs=opus;base64,${b64}`);
  assert.equal(r.mime, "audio/ogg");
  assert.equal(r.base64, b64);
});

test("outras formas de cabeçalho e base64 puro", () => {
  assert.equal(client.separarDataUri(`data:audio/ogg;base64,${b64}`).base64, b64);
  assert.equal(client.separarDataUri(`data:audio/webm;codecs=opus;base64,${b64}`).mime, "audio/webm");
  assert.equal(client.separarDataUri(b64).mime, null);
  assert.equal(client.separarDataUri(b64).base64, b64);
});

test("REGRESSÃO 09/10: o áudio recebido é gravado com os bytes certos, não com 14 bytes de lixo", () => {
  const url = client.saveBase64ToDisk(`data:audio/ogg; codecs=opus;base64,${b64}`, "audio-teste", "audio");
  const arquivo = path.join(pasta, path.basename(url));
  const gravado = fs.readFileSync(arquivo);
  assert.equal(gravado.length, bytesReais.length);
  assert.ok(gravado.equals(bytesReais));
  assert.ok(arquivo.endsWith(".ogg"));
});

test("a trava recusa arquivo pequeno demais (inclusive com cabeçalho) e aceita mídia de verdade", () => {
  assert.equal(client.midiaBaixadaValida("audio", `data:audio/ogg; codecs=opus;base64,${Buffer.alloc(14, 1).toString("base64")}`), false);
  assert.equal(client.midiaBaixadaValida("audio", `data:audio/ogg; codecs=opus;base64,${b64}`), true);
  assert.equal(client.midiaBaixadaValida("image", Buffer.alloc(100, 1).toString("base64")), false);
  assert.equal(client.midiaBaixadaValida("document", Buffer.alloc(10, 1).toString("base64")), true);
  assert.equal(client.midiaBaixadaValida("document", ""), false);
});
