/**
 * A mídia do WhatsApp precisa chegar descriptografada ao nosso disco.
 *
 * O que aconteceu até 05/10/2026: o webhook extraía os dados de download, o
 * worker chamava `downloadMedia`, e o download falhava SEMPRE — porque o
 * wuzapi exige `FileEncSHA256` (o hash do arquivo ainda cifrado) para
 * descriptografar, e nós não mandávamos. O erro ia para o console, a mensagem
 * era gravada com a URL da CDN do WhatsApp, e essa URL é um blob cifrado que
 * navegador nenhum abre.
 *
 * Resultado medido no banco: 3.800 mídias — 1.404 áudios recebidos, 511
 * imagens, 278 documentos — e **zero** arquivos salvos. O operador via o balão
 * e não conseguia ouvir nem ver nada. Parecia tela quebrada; era o download.
 *
 * O segundo defeito: havia um "fallback" que tentava baixar passando só o
 * `MessageId`. Esse campo não existe em lugar nenhum do wuzapi (zero
 * ocorrências em handlers.go), então o fallback nunca teve chance — e dava a
 * impressão de que havia uma segunda tentativa.
 *
 * Esta trava lê o código, não o banco: ela vale em qualquer ambiente e falha
 * no instante em que alguém remover o campo de novo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const CLIENT = path.join(SRC, "lib", "whatsapp", "client.ts");
const WORKER = path.join(SRC, "worker", "index.ts");

/** Tira comentários de bloco e de linha: o assert olha só o que roda. */
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("o download manda a chave que descriptografa a mídia", () => {
  const client = semComentarios(fs.readFileSync(CLIENT, "utf8"));
  const corpo = client.slice(client.indexOf("export async function downloadMedia"));
  assert.match(corpo, /FileEncSHA256:\s*info\.fileEncSHA256/,
    "downloadMedia parou de mandar FileEncSHA256: o wuzapi não consegue descriptografar e a mídia volta a ficar inacessível");
  for (const campo of ["Url:", "MediaKey:", "DirectPath:", "FileSHA256:", "FileLength:", "Mimetype:"]) {
    assert.ok(corpo.includes(campo), `downloadMedia não manda ${campo}`);
  }
});

test("o webhook extrai FileEncSHA256 da mensagem e o entrega ao worker", () => {
  const worker = semComentarios(fs.readFileSync(WORKER, "utf8"));
  assert.match(worker, /const fileEncSHA256 = /,
    "o webhook não extrai mais FileEncSHA256 da mensagem recebida");
  assert.match(worker, /mediaDownloadInfo = \{[^}]*fileEncSHA256[^}]*\}/,
    "fileEncSHA256 não está sendo passado adiante em mediaDownloadInfo");
});

test("ninguém tenta baixar mídia por MessageId: esse campo não existe no wuzapi", () => {
  const client = semComentarios(fs.readFileSync(CLIENT, "utf8"));
  const worker = semComentarios(fs.readFileSync(WORKER, "utf8"));
  for (const [nome, fonte] of [["client.ts", client], ["worker/index.ts", worker]] as const) {
    assert.doesNotMatch(fonte, /MessageId:\s*messageId|downloadMediaByMessageId/,
      `${nome} voltou a tentar baixar mídia por MessageId — o wuzapi não tem esse campo, então é uma tentativa que nunca funciona e esconde a falha real`);
  }
});

test("falha de download não passa calada", () => {
  const worker = semComentarios(fs.readFileSync(WORKER, "utf8"));
  const ocorrencias = worker.match(/MIDIA NAO SALVA/g) ?? [];
  assert.ok(ocorrencias.length >= 2,
    "os dois caminhos de mídia (recebida e enviada pelo celular) precisam avisar quando o arquivo não foi salvo; " +
    `achei ${ocorrencias.length}`);
});
