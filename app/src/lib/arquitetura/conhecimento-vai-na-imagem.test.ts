import { strict as assert } from "node:assert";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * A base de conhecimento dos agentes mora em arquivo versionado, e arquivo
 * versionado só chega em produção se alguém copiar para a imagem.
 *
 * O que aconteceu em 21/10/2026: o Dockerfile copiava migrations e modelos de
 * contrato e NÃO copiava a base. Em produção a pasta não existia, a carga caía
 * no `existsSync` e devolvia zero sem reclamar. A base ficou congelada em
 * 13/10, a agente vendeu com o mapa de produto de junho, e ninguém viu porque
 * nada falhava — só não acontecia.
 *
 * Esta trava existe para o próximo arquivo versionado que alguém adicionar.
 */

const RAIZ = path.resolve(import.meta.dirname, "../../../..");
const DOCKERFILE = fs.readFileSync(path.join(RAIZ, "Dockerfile"), "utf8");
const BASE = path.join(RAIZ, "app/src/lib/ai-platform/conhecimento/base");

test("a base de conhecimento existe no repositório e tem snapshot", () => {
  assert.ok(fs.existsSync(BASE), "pasta da base de conhecimento sumiu");
  const mds = fs.readdirSync(BASE).filter((f) => f.endsWith(".md"));
  assert.ok(mds.length > 0, "nenhum snapshot .md na base de conhecimento");
});

test("o Dockerfile copia a base de conhecimento para a imagem", () => {
  assert.match(DOCKERFILE, /COPY .*conhecimento\/base/,
    "o Dockerfile não copia app/src/lib/ai-platform/conhecimento/base: em produção a pasta não existe e a carga devolve zero em silêncio");
});

test("o Dockerfile aponta a variável que o código procura", () => {
  assert.match(DOCKERFILE, /ENV CONHECIMENTO_BASE_DIR=/,
    "sem CONHECIMENTO_BASE_DIR o código não encontra a pasta copiada");
  const destino = DOCKERFILE.match(/ENV CONHECIMENTO_BASE_DIR=(\S+)/)?.[1];
  assert.ok(destino, "CONHECIMENTO_BASE_DIR sem valor");
  assert.ok(DOCKERFILE.includes(destino!.replace("/repo/", "./")),
    `CONHECIMENTO_BASE_DIR aponta para ${destino}, que nenhum COPY cria`);
});

test("todo snapshot declara slug e governança", () => {
  for (const arquivo of fs.readdirSync(BASE).filter((f) => f.endsWith(".md"))) {
    const texto = fs.readFileSync(path.join(BASE, arquivo), "utf8");
    assert.match(texto, /^---\n/, `${arquivo}: sem frontmatter`);
    assert.match(texto, /\nslug:\s*\S+/, `${arquivo}: sem slug`);
    assert.match(texto, /\ngovernanca:\s*(aprovado|rascunho|historico)\b/, `${arquivo}: governança ausente ou inválida`);
  }
});
