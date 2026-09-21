/**
 * O banco do SaaS Callface AI é SOMENTE LEITURA. Esta trava existe porque uma
 * escrita acidental ali é incidente em produção do nosso próprio produto, e
 * revisão de código não é garantia — o repositório já provou isso.
 *
 * Verificada falhando de propósito antes de entrar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RAIZ_PACOTE = path.join(process.cwd(), "..", "packages", "integrations", "callface-ai");
const RAIZ_APP = path.join(process.cwd(), "src", "lib", "integrations", "callface-ai");

function arquivosTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivosTs(p) : e.name.endsWith(".ts") ? [p] : [];
  });
}

test("o adapter do SaaS não contém verbo de escrita", () => {
  const proibidos = /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|DROP\s+|ALTER\s+|CREATE\s+|TRUNCATE|GRANT|REVOKE)\b/i;
  const achados: string[] = [];
  for (const f of arquivosTs(RAIZ_PACOTE)) {
    const txt = fs.readFileSync(f, "utf8");
    // Comentário não conta: o arquivo EXPLICA que não escreve.
    const semComentario = txt.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/--.*$/gm, "");
    if (proibidos.test(semComentario)) achados.push(path.basename(f));
  }
  assert.deepEqual(achados, [], `verbo de escrita no adapter do SaaS: ${achados.join(", ")}`);
});

test("a conexão com o SaaS força somente-leitura no servidor", () => {
  const conexao = fs.readFileSync(path.join(RAIZ_PACOTE, "src", "conexao.ts"), "utf8");
  assert.match(conexao, /default_transaction_read_only:\s*"on"/,
    "a sessão precisa nascer read-only: é a única trava que vale contra código novo");
  assert.match(conexao, /begin\("read only"/,
    "toda leitura roda dentro de BEGIN READ ONLY");
  assert.match(conexao, /ssl:\s*"require"/, "o RDS exige SSL");
});

test("credencial do SaaS vem só de variável de ambiente", () => {
  for (const f of [...arquivosTs(RAIZ_PACOTE), ...arquivosTs(RAIZ_APP)]) {
    const txt = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(txt, /postgres:\/\/[^$\s"'`]*:[^@$\s"'`]+@/,
      `credencial literal em ${path.basename(f)}: a senha vem de CALLFACE_AI_DATABASE_URL`);
    assert.doesNotMatch(txt, /rds\.amazonaws\.com/,
      `host do RDS embutido em ${path.basename(f)}`);
  }
});

test("nenhuma tela ou rota fala direto com o banco do SaaS", () => {
  // O produto lê o modelo local. Quem importar o adapter fora da camada de
  // integração está criando a consulta síncrona que a arquitetura proíbe.
  const permitidos = [
    path.join("src", "lib", "integrations", "callface-ai"),
    path.join("src", "scripts"),
    path.join("src", "worker"),
  ];
  const raizSrc = path.join(process.cwd(), "src");
  const infratores: string[] = [];
  for (const f of arquivosTs(raizSrc)) {
    if (f.includes(".test.")) continue;
    if (permitidos.some((p) => f.includes(p))) continue;
    if (/@onface\/integrations-callface-ai/.test(fs.readFileSync(f, "utf8"))) {
      infratores.push(path.relative(raizSrc, f));
    }
  }
  assert.deepEqual(infratores, [],
    `importam o adapter do SaaS fora da camada de integração: ${infratores.join(", ")}`);
});
