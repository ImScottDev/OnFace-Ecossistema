/**
 * API pública v1 (SPEC §23, §30.2).
 *
 * O que estes testes travam é a propriedade estrutural que o SPEC enuncia:
 * *no public endpoint maps directly to generic table CRUD*. A API pública é
 * contrato — depois que alguém integrou, a forma da resposta vira compromisso,
 * e expor tabela transformaria cada refactor interno em quebra de integração.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DB_URL = process.env.DATABASE_URL;
const V1 = path.resolve(import.meta.dirname, "index.ts");

test("toda rota exige um escopo explícito", () => {
  const src = fs.readFileSync(V1, "utf8");
  // `rota(escopo, handler)` é o único caminho: um `app.get` que não passe por
  // ele seria um endpoint sem autenticação nem permissão.
  const gets = [...src.matchAll(/app\.get\("([^"]+)",\s*(\w+)/g)];
  const semGate = gets.filter(([, caminho, fn]) => fn !== "rota" && caminho !== "/v1");
  assert.deepEqual(
    semGate.map(([, caminho]) => caminho), [],
    "rota pública sem o pipeline de autenticação e escopo",
  );
  assert.ok(gets.length >= 8, "a superfície inicial do SPEC tem pelo menos 8 recursos");
});

test("os recursos usam nomes de domínio, não nomes de tabela", () => {
  const src = fs.readFileSync(V1, "utf8");
  const caminhos = [...src.matchAll(/app\.get\("(\/v1\/[^"]+)"/g)].map((m) => m[1]);

  // Nome de tabela na URL é o refactor interno vazando para o contrato externo.
  const TABELAS = ["leads", "negocios", "faturas", "propostas", "contratos", "empresas", "pessoas", "aquisicoes"];
  const vazando = caminhos.filter((c) => TABELAS.some((t) => c.includes(`/${t}`)));
  assert.deepEqual(vazando, [], "nome de tabela interna exposto na URL pública");
});

test("o token é guardado como hash, nunca em claro", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { gerarToken } = await import("./autenticacao.js");
  const { valor, prefixo, hash } = gerarToken();

  assert.match(valor, /^onf_/, "o token precisa ser reconhecível");
  assert.equal(hash.length, 64, "o hash guardado é SHA-256");
  assert.notEqual(hash, valor, "o valor em claro não pode ser o que se guarda");
  assert.ok(valor.startsWith(prefixo), "o prefixo serve para reconhecer o token na tela");
  assert.ok(prefixo.length < valor.length, "o prefixo não pode ser o token inteiro");

  // Um dump do banco não pode virar acesso.
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const [col] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM information_schema.columns
     WHERE table_name = 'api_tokens' AND column_name IN ('token', 'token_plain', 'secret')`);
  assert.equal(col.n, 0, "existe coluna guardando o token em claro");
});

test("token revogado e token expirado respondem igual a token inexistente", () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, "autenticacao.ts"), "utf8");
  // Distinguir os casos conta a quem tenta se o token existiu.
  const mensagens = [...src.matchAll(/erro:\s*"([^"]+)"/g)].map((m) => m[1]);
  const distintas = new Set(mensagens.filter((m) => m.includes("inválida")));
  assert.equal(distintas.size, 1, "as respostas de falha de credencial precisam ser indistinguíveis");
});
